"""Rules Engine — condition tree evaluator for CWOC automation rules.

Pure-function evaluation engine that recursively walks AND/OR group nodes
and leaf conditions, returning a boolean.  Supports 14 operators, contact
cross-references, and regex with a signal-based timeout guard.

No database or HTTP dependencies — this module is independently testable.
"""

import logging
import re
import signal
from datetime import datetime
from typing import Any, Dict, List, Optional

from src.backend.db import deserialize_json_field

logger = logging.getLogger(__name__)

# ── Fields stored as JSON strings in SQLite ──────────────────────────
_JSON_LIST_FIELDS = frozenset({
    "tags", "people", "alerts", "child_chits", "checklist",
    "recurrence_exceptions", "shares",
})


# ── Condition Tree Validation ────────────────────────────────────────

def validate_condition_tree(tree: Any) -> tuple:
    """Validate the structure of a condition tree.

    Returns:
        (True, None) if valid, (False, error_message) if invalid.
    """
    if not isinstance(tree, dict):
        return False, "Condition tree node must be a dict"

    node_type = tree.get("type")
    if node_type not in ("group", "leaf"):
        return False, f"Invalid node type: {node_type!r} (must be 'group' or 'leaf')"

    if node_type == "leaf":
        for key in ("field", "operator", "value"):
            if key not in tree:
                return False, f"Leaf node missing required key: {key!r}"
        return True, None

    # Group node
    operator = tree.get("operator")
    if operator not in ("AND", "OR"):
        return False, f"Group operator must be 'AND' or 'OR', got {operator!r}"

    children = tree.get("children")
    if not isinstance(children, list):
        return False, "Group node 'children' must be a list"

    for i, child in enumerate(children):
        valid, err = validate_condition_tree(child)
        if not valid:
            return False, f"Invalid child at index {i}: {err}"

    return True, None


# ── Regex with Timeout ───────────────────────────────────────────────

class _RegexTimeoutError(Exception):
    """Raised when a regex match exceeds the allowed time."""


def _regex_match_with_timeout(pattern: str, text: str, timeout_seconds: int = 2) -> bool:
    """Compile and match a regex with a signal-based timeout guard.

    Uses SIGALRM (available on macOS / Linux) to abort catastrophic
    backtracking.  Returns False on timeout, invalid pattern, or no match.
    """

    def _handler(signum, frame):
        raise _RegexTimeoutError()

    old_handler = None
    try:
        old_handler = signal.signal(signal.SIGALRM, _handler)
        signal.alarm(timeout_seconds)
        compiled = re.compile(pattern)
        result = bool(compiled.search(text))
        signal.alarm(0)  # cancel alarm
        return result
    except _RegexTimeoutError:
        logger.warning("Regex timed out after %ds: pattern=%r", timeout_seconds, pattern)
        return False
    except re.error as exc:
        logger.warning("Invalid regex pattern %r: %s", pattern, exc)
        return False
    except Exception as exc:
        logger.warning("Unexpected error in regex match: %s", exc)
        return False
    finally:
        signal.alarm(0)
        if old_handler is not None:
            signal.signal(signal.SIGALRM, old_handler)


# ── Field Resolution Helpers ─────────────────────────────────────────

def _get_field_value(entity: dict, field: str) -> Any:
    """Extract a field value from an entity dict.

    For JSON-serialized list fields, deserializes the stored string.
    Returns None when the field is absent.
    """
    raw = entity.get(field)
    if raw is None:
        return None
    if field in _JSON_LIST_FIELDS and isinstance(raw, str):
        deserialized = deserialize_json_field(raw)
        return deserialized if deserialized is not None else raw
    return raw


def _is_empty(value: Any) -> bool:
    """Return True when a value is considered empty."""
    if value is None:
        return True
    if isinstance(value, str) and value.strip() == "":
        return True
    if isinstance(value, list) and len(value) == 0:
        return True
    return False


# ── Contact Cross-Reference ──────────────────────────────────────────

def resolve_contact_cross_ref(
    field: str,
    operator: str,
    value: str,
    entity: dict,
    contacts: Optional[List[dict]],
) -> bool:
    """Resolve a condition that cross-references user contacts.

    Supported cross-reference operators (value of *operator*):
      - ``contains_contact_city``  — True when the entity's *field* value
        contains any city found in the contacts' addresses.
      - ``contains_contact_email`` — True when the entity's *field* value
        contains any email found in the contacts' emails.
      - ``contains_contact_name``  — True when the entity's *field* value
        contains any contact display name.

    Returns False when contacts is None/empty or no match is found.
    """
    if not contacts:
        return False

    entity_value = _get_field_value(entity, field)
    if entity_value is None:
        return False
    entity_str = str(entity_value).lower()

    if operator == "contains_contact_city":
        for contact in contacts:
            addresses = contact.get("addresses") or []
            if isinstance(addresses, str):
                addresses = deserialize_json_field(addresses) or []
            for addr in addresses:
                addr_value = addr.get("value", "") if isinstance(addr, dict) else str(addr)
                # Try to extract a city-like component (comma-separated parts)
                parts = [p.strip() for p in addr_value.split(",")]
                for part in parts:
                    if part and part.lower() in entity_str:
                        return True
        return False

    if operator == "contains_contact_email":
        for contact in contacts:
            emails = contact.get("emails") or []
            if isinstance(emails, str):
                emails = deserialize_json_field(emails) or []
            for email_entry in emails:
                email_val = email_entry.get("value", "") if isinstance(email_entry, dict) else str(email_entry)
                if email_val and email_val.lower() in entity_str:
                    return True
        return False

    if operator == "contains_contact_name":
        for contact in contacts:
            display_name = contact.get("display_name") or ""
            if not display_name:
                # Build from parts
                parts = []
                for f in ("given_name", "surname"):
                    v = contact.get(f)
                    if v and v.strip():
                        parts.append(v.strip())
                display_name = " ".join(parts)
            if display_name and display_name.lower() in entity_str:
                return True
        return False

    logger.warning("Unknown cross-reference operator: %r", operator)
    return False


# ── Leaf Condition Evaluator ─────────────────────────────────────────

_CROSS_REF_OPERATORS = frozenset({
    "contains_contact_city",
    "contains_contact_email",
    "contains_contact_name",
})


def evaluate_leaf(
    leaf: dict,
    entity: dict,
    contacts: Optional[List[dict]] = None,
) -> bool:
    """Evaluate a single leaf condition against an entity.

    Returns False (not satisfied) when the referenced field is missing,
    rather than raising an error.
    """
    field = leaf.get("field", "")
    operator = leaf.get("operator", "")
    value = leaf.get("value", "")

    # Contact cross-reference operators are dispatched separately
    if operator in _CROSS_REF_OPERATORS:
        return resolve_contact_cross_ref(field, operator, value, entity, contacts)

    field_value = _get_field_value(entity, field)

    # ── List-membership operators ────────────────────────────────
    if operator == "tag_present":
        if field_value is None:
            return False
        tags = field_value if isinstance(field_value, list) else []
        return any(str(t).lower() == str(value).lower() for t in tags)

    if operator == "tag_not_present":
        if field_value is None:
            return True  # tag can't be present if there are no tags
        tags = field_value if isinstance(field_value, list) else []
        return not any(str(t).lower() == str(value).lower() for t in tags)

    if operator == "person_on_chit":
        if field_value is None:
            return False
        people = field_value if isinstance(field_value, list) else []
        return any(str(p).lower() == str(value).lower() for p in people)

    if operator == "person_not_on_chit":
        if field_value is None:
            return True  # person can't be on chit if there are no people
        people = field_value if isinstance(field_value, list) else []
        return not any(str(p).lower() == str(value).lower() for p in people)

    # ── Emptiness operators ──────────────────────────────────────
    if operator == "is_empty":
        return _is_empty(field_value)

    if operator == "is_not_empty":
        return not _is_empty(field_value)

    # ── From here on, a missing field means "not satisfied" ──────
    if field_value is None:
        return False

    field_str = str(field_value).lower()
    value_str = str(value).lower()

    # ── String comparison operators ──────────────────────────────
    if operator == "equals":
        if field_str == value_str:
            return True
        # For email fields: extract address from "Name <email>" format
        if field in ("email_from", "email_to", "email_cc", "email_bcc"):
            import re
            match = re.search(r'<([^>]+)>', field_str)
            if match:
                return match.group(1).lower() == value_str
        return False

    if operator == "not_equals":
        if field in ("email_from", "email_to", "email_cc", "email_bcc"):
            import re
            match = re.search(r'<([^>]+)>', field_str)
            if match:
                return match.group(1).lower() != value_str
        return field_str != value_str

    if operator == "contains":
        return value_str in field_str

    if operator == "not_contains":
        return value_str not in field_str

    if operator == "starts_with":
        return field_str.startswith(value_str)

    if operator == "ends_with":
        return field_str.endswith(value_str)

    # ── Numeric / date comparison operators ──────────────────────
    if operator in ("greater_than", "less_than"):
        try:
            field_num = float(field_str)
            value_num = float(value_str)
            if operator == "greater_than":
                return field_num > value_num
            return field_num < value_num
        except (ValueError, TypeError):
            # Fall back to lexicographic comparison (useful for ISO dates)
            if operator == "greater_than":
                return field_str > value_str
            return field_str < value_str

    # ── Date age operators (days since a datetime field) ─────────
    if operator in ("days_ago_greater_than", "days_ago_less_than"):
        try:
            raw = str(field_value).strip()
            if not raw:
                return False
            # Strip timezone suffix for naive UTC comparison
            # Handle: "2026-05-13T06:00:12+00:00", "2026-05-13T06:00:12Z",
            #         "2026-05-13T06:00:12", "2026-05-13 06:00:12", "2026-05-13"
            clean = raw
            if clean.endswith("Z"):
                clean = clean[:-1]
            # Strip +HH:MM or -HH:MM timezone offset at end
            if len(clean) > 19 and (clean[-6] == "+" or clean[-6] == "-"):
                clean = clean[:-6]
            elif len(clean) > 16 and (clean[-3] == "+" or clean[-3] == "-"):
                clean = clean[:-3]

            field_dt = None
            for fmt in ("%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S",
                        "%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S",
                        "%Y-%m-%d"):
                try:
                    field_dt = datetime.strptime(clean, fmt)
                    break
                except ValueError:
                    continue
            if field_dt is None:
                return False
            age_days = (datetime.utcnow() - field_dt).days
            threshold = int(value)
            if operator == "days_ago_greater_than":
                return age_days > threshold
            return age_days < threshold
        except (ValueError, TypeError):
            return False

    # ── Regex operator ───────────────────────────────────────────
    if operator == "regex_match":
        return _regex_match_with_timeout(str(value), str(field_value))

    # ── Weather condition operators ──────────────────────────────
    if operator.startswith("weather_"):
        # Weather operators: current weather or forecast window checks
        # Value format: "threshold|days|location" or "threshold|days" or just "threshold"
        try:
            parts = str(value).split("|")
            threshold = float(parts[0])
            days = int(parts[1]) if len(parts) > 1 else 1
            location_ref = parts[2] if len(parts) > 2 else "_default"
            
            owner_id = entity.get("owner_id")
            
            # Get weather data (current or forecast)
            if operator.startswith("weather_forecast_contains_") or days > 1:
                weather_data_list = _get_weather_forecast_for_location(owner_id, days, location_ref)
                if not weather_data_list:
                    return False
                # Check if ANY day in the forecast meets the criteria
                for weather_data in weather_data_list:
                    if _check_weather_condition(operator, weather_data, threshold):
                        return True
                return False
            else:
                # Current weather only
                weather_data = _get_current_weather_for_location(owner_id, location_ref)
                if not weather_data:
                    return False
                return _check_weather_condition(operator, weather_data, threshold)
        except (ValueError, TypeError):
            return False

    logger.warning("Unknown leaf operator: %r", operator)
    return False


# ── Weather Helper Functions ─────────────────────────────────────────

def _get_current_weather_for_default_location(owner_id: str) -> Optional[Dict]:
    """Get current weather data for the user's default location. Convenience wrapper."""
    return _get_current_weather_for_location(owner_id, "_default")


def _get_current_weather_for_location(owner_id: str, location_ref: str = "_default") -> Optional[Dict]:
    """Get current weather data for a specific location.

    location_ref can be:
      - "_default" — use the user's default saved location
      - A saved location label (e.g., "Home")
      - Manual coordinates as "lat,lon" (e.g., "42.3,-71.1")

    Returns weather dict or None.
    """
    coords = _resolve_location_coords(owner_id, location_ref)
    if not coords:
        return None

    try:
        from src.backend.schedulers import _sync_weather_fetch

        url = (
            f"https://api.open-meteo.com/v1/forecast"
            f"?latitude={coords['lat']}&longitude={coords['lon']}"
            f"&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,rain_sum,snowfall_sum,showers_sum,wind_gusts_10m_max,wind_speed_10m_max"
            f"&timezone=auto&forecast_days=1"
        )

        forecast_data = _sync_weather_fetch(url)
        if not forecast_data or "daily" not in forecast_data:
            return None

        daily = forecast_data["daily"]
        if not daily.get("time") or len(daily["time"]) == 0:
            return None

        idx = 0
        return {
            "high": daily.get("temperature_2m_max", [])[idx] if idx < len(daily.get("temperature_2m_max", [])) else None,
            "low": daily.get("temperature_2m_min", [])[idx] if idx < len(daily.get("temperature_2m_min", [])) else None,
            "precipitation": daily.get("precipitation_sum", [])[idx] if idx < len(daily.get("precipitation_sum", [])) else None,
            "rain": daily.get("rain_sum", [])[idx] if idx < len(daily.get("rain_sum", [])) else None,
            "snowfall": daily.get("snowfall_sum", [])[idx] if idx < len(daily.get("snowfall_sum", [])) else None,
            "showers": daily.get("showers_sum", [])[idx] if idx < len(daily.get("showers_sum", [])) else None,
            "wind_speed": daily.get("wind_speed_10m_max", [])[idx] if idx < len(daily.get("wind_speed_10m_max", [])) else None,
            "wind_gusts": daily.get("wind_gusts_10m_max", [])[idx] if idx < len(daily.get("wind_gusts_10m_max", [])) else None,
            "weather_code": daily.get("weathercode", [])[idx] if idx < len(daily.get("weathercode", [])) else None,
        }

    except Exception as e:
        logger.warning("Failed to get current weather for user %s location %s: %s", owner_id, location_ref, e)
        return None


def _get_weather_forecast_for_location(owner_id: str, days: int, location_ref: str = "_default") -> Optional[List[Dict]]:
    """Get weather forecast for a specific location for the next N days."""
    if days <= 0:
        return None

    coords = _resolve_location_coords(owner_id, location_ref)
    if not coords:
        return None

    try:
        from src.backend.schedulers import _sync_weather_fetch

        forecast_days = min(days, 16)
        url = (
            f"https://api.open-meteo.com/v1/forecast"
            f"?latitude={coords['lat']}&longitude={coords['lon']}"
            f"&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,rain_sum,snowfall_sum,showers_sum,wind_gusts_10m_max,wind_speed_10m_max"
            f"&timezone=auto&forecast_days={forecast_days}"
        )

        forecast_data = _sync_weather_fetch(url)
        if not forecast_data or "daily" not in forecast_data:
            return None

        daily = forecast_data["daily"]
        if not daily.get("time"):
            return None

        weather_list = []
        for i in range(min(days, len(daily["time"]))):
            weather_list.append({
                "date": daily["time"][i],
                "high": daily.get("temperature_2m_max", [])[i] if i < len(daily.get("temperature_2m_max", [])) else None,
                "low": daily.get("temperature_2m_min", [])[i] if i < len(daily.get("temperature_2m_min", [])) else None,
                "precipitation": daily.get("precipitation_sum", [])[i] if i < len(daily.get("precipitation_sum", [])) else None,
                "rain": daily.get("rain_sum", [])[i] if i < len(daily.get("rain_sum", [])) else None,
                "snowfall": daily.get("snowfall_sum", [])[i] if i < len(daily.get("snowfall_sum", [])) else None,
                "showers": daily.get("showers_sum", [])[i] if i < len(daily.get("showers_sum", [])) else None,
                "wind_speed": daily.get("wind_speed_10m_max", [])[i] if i < len(daily.get("wind_speed_10m_max", [])) else None,
                "wind_gusts": daily.get("wind_gusts_10m_max", [])[i] if i < len(daily.get("wind_gusts_10m_max", [])) else None,
                "weather_code": daily.get("weathercode", [])[i] if i < len(daily.get("weathercode", [])) else None,
            })

        return weather_list

    except Exception as e:
        logger.warning("Failed to get weather forecast for user %s location %s: %s", owner_id, location_ref, e)
        return None


def _resolve_location_coords(owner_id: str, location_ref: str) -> Optional[Dict]:
    """Resolve a location reference to lat/lon coordinates.

    location_ref can be "_default", a saved location label, "_manual:lat,lon",
    "_manual:City Name", or raw "lat,lon".
    Returns {"lat": float, "lon": float} or None.
    """
    if not owner_id and location_ref == "_default":
        return None

    # Handle "_manual:..." format from the weather condition builder
    if location_ref and location_ref.startswith("_manual:"):
        coords_str = location_ref[8:]  # strip "_manual:"
        if not coords_str:
            return None
        # Try parsing as lat,lon first
        if "," in coords_str:
            try:
                parts = coords_str.split(",", 1)
                lat = float(parts[0].strip())
                lon = float(parts[1].strip())
                if -90 <= lat <= 90 and -180 <= lon <= 180:
                    return {"lat": lat, "lon": lon}
            except (ValueError, IndexError):
                pass  # Not valid coords, try geocoding
        # Geocode as address/city name
        return _sync_geocode_location(coords_str)

    # Handle bare "_manual" (no coords entered yet)
    if location_ref == "_manual":
        return None

    # Try parsing as raw manual coordinates (legacy: "lat,lon")
    if location_ref and "," in location_ref and location_ref not in ("_default",):
        try:
            parts = location_ref.split(",")
            lat = float(parts[0].strip())
            lon = float(parts[1].strip())
            return {"lat": lat, "lon": lon}
        except (ValueError, IndexError):
            pass

    # Look up from saved locations
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        cursor.execute(
            "SELECT saved_locations FROM settings WHERE user_id = ?",
            (owner_id,)
        )
        row = cursor.fetchone()
        if not row or not row[0]:
            return None

        saved_locations = deserialize_json_field(row[0])
        if not isinstance(saved_locations, list):
            return None

        target_loc = None
        if location_ref == "_default":
            for loc in saved_locations:
                if isinstance(loc, dict) and loc.get("is_default"):
                    target_loc = loc
                    break
            if not target_loc and saved_locations:
                for loc in saved_locations:
                    if isinstance(loc, dict) and loc.get("lat") and loc.get("lon"):
                        target_loc = loc
                        break
        else:
            for loc in saved_locations:
                if isinstance(loc, dict) and loc.get("label") == location_ref:
                    target_loc = loc
                    break

        if target_loc and target_loc.get("lat") and target_loc.get("lon"):
            return {"lat": target_loc["lat"], "lon": target_loc["lon"]}

        return None

    except Exception as e:
        logger.warning("Failed to resolve location %s for user %s: %s", location_ref, owner_id, e)
        return None
    finally:
        if conn:
            conn.close()


def _sync_geocode_location(address: str) -> Optional[Dict]:
    """Synchronously geocode an address/city name to lat/lon using Nominatim.

    Returns {"lat": float, "lon": float} or None.
    """
    import urllib.request
    import urllib.parse

    if not address or not address.strip():
        return None

    url = "https://nominatim.openstreetmap.org/search?format=json&limit=1&q=" + urllib.parse.quote(address.strip())
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "CWOC-Weather/1.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
        if data and len(data) > 0:
            return {"lat": float(data[0]["lat"]), "lon": float(data[0]["lon"])}
        return None
    except Exception as e:
        logger.warning("Geocode failed for '%s': %s", address, e)
        return None


def _check_weather_condition(operator: str, weather_data: Dict, threshold: float) -> bool:
    """Check if weather data meets the specified condition.

    Uses a generic approach: extract metric and comparison from the operator name,
    then look up the corresponding field in weather_data.
    """
    if not weather_data:
        return False

    # Strip prefixes to get the core metric_comparison
    core = operator.replace("weather_forecast_contains_", "").replace("weather_", "")

    # Determine comparison direction
    if core.endswith("_above"):
        comparison = "above"
        metric = core[:-6]  # strip "_above"
    elif core.endswith("_below"):
        comparison = "below"
        metric = core[:-6]  # strip "_below"
    else:
        logger.warning("Unknown weather operator format: %r", operator)
        return False

    # Map metric name to weather_data key
    metric_key_map = {
        "temp_low": "low",
        "temp_high": "high",
        "precipitation": "precipitation",
        "rain": "rain",
        "snowfall": "snowfall",
        "showers": "showers",
        "wind_speed": "wind_speed",
        "wind_gusts": "wind_gusts",
    }

    data_key = metric_key_map.get(metric)
    if not data_key:
        logger.warning("Unknown weather metric: %r (from operator %r)", metric, operator)
        return False

    value = weather_data.get(data_key)
    if value is None:
        return False

    if comparison == "above":
        return value > threshold
    else:
        return value < threshold


# ── Condition Tree Evaluator ─────────────────────────────────────────

def evaluate_condition_tree(
    tree: dict,
    entity: dict,
    contacts: Optional[List[dict]] = None,
) -> bool:
    """Recursively evaluate a condition tree against an entity.

    Args:
        tree: A Condition_Tree node (group or leaf).
        entity: The triggering entity as a flat dict (chit or contact row).
        contacts: Optional list of user's contacts for cross-reference
                  conditions.

    Returns:
        True if the entity satisfies the condition tree, False otherwise.
    """
    if not isinstance(tree, dict):
        return False

    node_type = tree.get("type")

    if node_type == "leaf":
        return evaluate_leaf(tree, entity, contacts)

    if node_type == "group":
        children = tree.get("children")
        if not isinstance(children, list):
            return False

        operator = tree.get("operator", "AND")
        results = [evaluate_condition_tree(child, entity, contacts) for child in children]

        if operator == "AND":
            return all(results) if results else True   # vacuous truth
        if operator == "OR":
            return any(results) if results else False
        # Unknown group operator
        logger.warning("Unknown group operator: %r", operator)
        return False

    # Unknown node type
    return False

# ══════════════════════════════════════════════════════════════════════════
# Action Executor and Trigger Dispatcher
#
# These components have database and HTTP dependencies (unlike the pure
# evaluator above).  They are kept in the same module for cohesion but
# separated by this banner.
# ══════════════════════════════════════════════════════════════════════════

import json
import sqlite3
from uuid import uuid4

from src.backend.db import DB_PATH, serialize_json_field, compute_system_tags, ensure_tags_in_settings


# ── Dict-to-object adapter for compute_system_tags ───────────────────

class _DictAsObj:
    """Lightweight adapter that exposes dict keys as attributes.

    ``compute_system_tags`` uses attribute access (``chit.due_datetime``),
    so we wrap the raw dict to satisfy that interface.
    """

    def __init__(self, d: dict):
        self._d = d

    def __getattr__(self, name: str):
        try:
            return self._d[name]
        except KeyError:
            return None


# ── Helper: look up username for audit actor string ──────────────────

def _get_username_for_user(owner_id: str) -> str:
    """Return 'username (user_id)' for the given user, or just the user_id."""
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute(
            "SELECT username, display_name FROM users WHERE id = ?", (owner_id,)
        )
        row = cursor.fetchone()
        if row:
            return row[0] or row[1] or owner_id
        return owner_id
    except Exception:
        return owner_id
    finally:
        if conn:
            conn.close()


def _build_rule_actor(rule_name: str, rule_id: str, owner_id: str) -> str:
    """Build the audit actor string for a rule action.

    Format: ``Rule: {rule_name} ({rule_id}) on behalf of {username} ({user_id})``
    """
    username = _get_username_for_user(owner_id)
    return f"Rule: {rule_name} ({rule_id}) on behalf of {username} ({owner_id})"


# ── Helper: read a chit row as a dict ────────────────────────────────

def _read_chit(cursor, chit_id: str) -> Optional[Dict]:
    """Read a chit row and return it as a dict, or None if not found."""
    cursor.execute("SELECT * FROM chits WHERE id = ?", (chit_id,))
    row = cursor.fetchone()
    if not row:
        return None
    columns = [col[0] for col in cursor.description]
    return dict(zip(columns, row))


def _read_contact(cursor, contact_id: str) -> Optional[Dict]:
    """Read a contact row and return it as a dict, or None if not found."""
    cursor.execute("SELECT * FROM contacts WHERE id = ?", (contact_id,))
    row = cursor.fetchone()
    if not row:
        return None
    columns = [col[0] for col in cursor.description]
    return dict(zip(columns, row))


# ── Helper: recompute and persist system tags ────────────────────────

def _recompute_and_save_system_tags(cursor, chit: dict, chit_id: str):
    """Recompute system tags for a chit dict and write them back to the DB."""
    # Deserialize tags if stored as JSON string
    tags_raw = chit.get("tags")
    if isinstance(tags_raw, str):
        chit["tags"] = deserialize_json_field(tags_raw) or []

    chit_obj = _DictAsObj(chit)
    new_tags = compute_system_tags(chit_obj)
    cursor.execute(
        "UPDATE chits SET tags = ? WHERE id = ?",
        (serialize_json_field(new_tags), chit_id),
    )


# ── Action Executor ──────────────────────────────────────────────────

def execute_action(
    action: dict,
    entity_type: str,
    entity_id: str,
    owner_id: str,
    rule_name: str,
    rule_id: str,
) -> dict:
    """Execute a single rule action against an entity.

    Args:
        action: Action dict with ``type`` and ``params`` keys.
        entity_type: ``"chit"`` or ``"contact"``.
        entity_id: UUID of the target entity.
        owner_id: UUID of the rule owner (for permission checks).
        rule_name: For audit logging.
        rule_id: For audit logging.

    Returns:
        ``{"success": True/False, "message": str}``
    """
    # Late imports to avoid circular dependency at module load time
    from src.backend.routes.audit import insert_audit_entry, compute_audit_diff

    action_type = action.get("type", "")
    params = action.get("params") or {}
    conn = None

    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        current_time = datetime.utcnow().isoformat()
        actor = _build_rule_actor(rule_name, rule_id, owner_id)

        # ── Chit actions ─────────────────────────────────────────
        if entity_type == "chit":
            chit = _read_chit(cursor, entity_id)
            if not chit:
                return {"success": False, "message": f"Chit {entity_id} not found"}

            # Verify owner access
            chit_owner = chit.get("owner_id")
            if chit_owner and chit_owner != owner_id:
                return {"success": False, "message": f"Permission denied: user {owner_id} does not own chit {entity_id}"}

            old_chit = dict(chit)

            # ── Dispatch by action type ──────────────────────────
            if action_type == "add_tag":
                tag = params.get("tag", "")
                tags = deserialize_json_field(chit.get("tags")) or []
                if tag and tag not in tags:
                    tags.append(tag)
                chit["tags"] = tags
                cursor.execute(
                    "UPDATE chits SET tags = ?, modified_datetime = ? WHERE id = ?",
                    (serialize_json_field(tags), current_time, entity_id),
                )
                # Register the tag in settings so it appears in filters/editor
                if tag:
                    ensure_tags_in_settings(conn, owner_id, [tag])

            elif action_type == "remove_tag":
                tag = params.get("tag", "")
                tags = deserialize_json_field(chit.get("tags")) or []
                tags = [t for t in tags if t != tag]
                chit["tags"] = tags
                cursor.execute(
                    "UPDATE chits SET tags = ?, modified_datetime = ? WHERE id = ?",
                    (serialize_json_field(tags), current_time, entity_id),
                )

            elif action_type == "set_status":
                status = params.get("status", "")
                chit["status"] = status
                cursor.execute(
                    "UPDATE chits SET status = ?, modified_datetime = ? WHERE id = ?",
                    (status, current_time, entity_id),
                )

            elif action_type == "set_priority":
                priority = params.get("priority", "")
                chit["priority"] = priority
                cursor.execute(
                    "UPDATE chits SET priority = ?, modified_datetime = ? WHERE id = ?",
                    (priority, current_time, entity_id),
                )

            elif action_type == "set_severity":
                severity = params.get("severity", "")
                chit["severity"] = severity
                cursor.execute(
                    "UPDATE chits SET severity = ?, modified_datetime = ? WHERE id = ?",
                    (severity, current_time, entity_id),
                )

            elif action_type == "set_color":
                color = params.get("color", "")
                chit["color"] = color
                cursor.execute(
                    "UPDATE chits SET color = ?, modified_datetime = ? WHERE id = ?",
                    (color, current_time, entity_id),
                )

            elif action_type == "set_location":
                location = params.get("location", "")
                chit["location"] = location
                cursor.execute(
                    "UPDATE chits SET location = ?, modified_datetime = ? WHERE id = ?",
                    (location, current_time, entity_id),
                )

            elif action_type == "set_show_on_calendar":
                show = params.get("show", True)
                # Normalize to int for SQLite (1 = show, 0 = hide)
                # Handle string "true"/"false" from frontend select
                if isinstance(show, str):
                    show = show.lower() not in ("false", "0", "no", "")
                show_int = 1 if show else 0
                chit["show_on_calendar"] = show_int
                cursor.execute(
                    "UPDATE chits SET show_on_calendar = ?, modified_datetime = ? WHERE id = ?",
                    (show_int, current_time, entity_id),
                )

            elif action_type == "add_person":
                person = params.get("person", "")
                people = deserialize_json_field(chit.get("people")) or []
                if person and person not in people:
                    people.append(person)
                chit["people"] = people
                cursor.execute(
                    "UPDATE chits SET people = ?, modified_datetime = ? WHERE id = ?",
                    (serialize_json_field(people), current_time, entity_id),
                )

            elif action_type == "archive":
                chit["archived"] = True
                cursor.execute(
                    "UPDATE chits SET archived = 1, modified_datetime = ? WHERE id = ?",
                    (current_time, entity_id),
                )

            elif action_type == "move_to_trash":
                chit["deleted"] = True
                chit["deleted_datetime"] = current_time
                cursor.execute(
                    "UPDATE chits SET deleted = 1, deleted_datetime = ?, modified_datetime = ? WHERE id = ?",
                    (current_time, current_time, entity_id),
                )

            elif action_type == "add_to_project":
                project_id = params.get("project_id", "")
                if project_id:
                    # Read the project chit and append this chit to its child_chits
                    project = _read_chit(cursor, project_id)
                    if project:
                        child_chits = deserialize_json_field(project.get("child_chits")) or []
                        if entity_id not in child_chits:
                            child_chits.append(entity_id)
                            cursor.execute(
                                "UPDATE chits SET child_chits = ?, modified_datetime = ? WHERE id = ?",
                                (serialize_json_field(child_chits), current_time, project_id),
                            )
                    else:
                        return {"success": False, "message": f"Project chit {project_id} not found"}

            elif action_type == "add_alert":
                alert = params.get("alert", {})
                alerts = deserialize_json_field(chit.get("alerts")) or []
                alerts.append(alert)
                chit["alerts"] = alerts
                cursor.execute(
                    "UPDATE chits SET alerts = ?, modified_datetime = ? WHERE id = ?",
                    (serialize_json_field(alerts), current_time, entity_id),
                )

            elif action_type == "share_with_user":
                user_id = params.get("user_id", "")
                role = params.get("role", "viewer")
                shares = deserialize_json_field(chit.get("shares")) or []
                # Check if already shared with this user
                existing = [s for s in shares if s.get("user_id") == user_id]
                if not existing and user_id:
                    shares.append({"user_id": user_id, "role": role})
                    chit["shares"] = shares
                    cursor.execute(
                        "UPDATE chits SET shares = ?, modified_datetime = ? WHERE id = ?",
                        (serialize_json_field(shares), current_time, entity_id),
                    )

            elif action_type == "assign_to_user":
                user_id = params.get("user_id", "")
                chit["assigned_to"] = user_id
                cursor.execute(
                    "UPDATE chits SET assigned_to = ?, modified_datetime = ? WHERE id = ?",
                    (user_id, current_time, entity_id),
                )

            # ── Email-specific actions ───────────────────────────
            elif action_type == "mark_email_read":
                chit["email_read"] = True
                cursor.execute(
                    "UPDATE chits SET email_read = 1, modified_datetime = ? WHERE id = ?",
                    (current_time, entity_id),
                )

            elif action_type == "mark_email_unread":
                chit["email_read"] = False
                cursor.execute(
                    "UPDATE chits SET email_read = 0, modified_datetime = ? WHERE id = ?",
                    (current_time, entity_id),
                )

            elif action_type == "move_email_to_folder":
                folder = params.get("folder", "")
                chit["email_folder"] = folder
                cursor.execute(
                    "UPDATE chits SET email_folder = ?, modified_datetime = ? WHERE id = ?",
                    (folder, current_time, entity_id),
                )

            # ── Home Assistant actions ────────────────────────────
            elif action_type == "call_ha_service":
                from src.backend import ha_bridge
                domain = params.get("domain", "")
                service = params.get("service", "")
                ha_entity_id = params.get("entity_id", "")
                service_data = params.get("service_data") or {}
                # Build template context from the chit
                template_context = {
                    "chit_title": chit.get("title") or "",
                    "chit_status": chit.get("status") or "",
                    "rule_name": rule_name,
                    "entity_id": entity_id,
                }
                # Apply template substitution on service_data
                service_data = ha_bridge.substitute_template_placeholders(service_data, template_context)
                result = ha_bridge.call_ha_service(domain, service, ha_entity_id, service_data)
                conn.commit()
                return result

            elif action_type == "fire_ha_event":
                from src.backend import ha_bridge
                event_type = params.get("event_type", "")
                event_data = params.get("event_data") or {}
                # Build template context from the chit
                template_context = {
                    "chit_title": chit.get("title") or "",
                    "chit_status": chit.get("status") or "",
                    "rule_name": rule_name,
                    "entity_id": entity_id,
                }
                # Apply template substitution on event_data
                event_data = ha_bridge.substitute_template_placeholders(event_data, template_context)
                result = ha_bridge.fire_ha_event(event_type, event_data)
                conn.commit()
                return result

            # ── Notification action ──────────────────────────────
            elif action_type == "send_notification":
                message = params.get("message", "")
                # Template substitution for common placeholders
                chit_title = chit.get("title") or "Untitled"
                message = message.replace("{rule_name}", rule_name)
                message = message.replace("{chit_title}", chit_title)
                _send_rule_notification(owner_id, entity_id, chit_title, message)
                # Notification doesn't modify the chit, so skip tag recompute
                conn.commit()
                return {"success": True, "message": f"Notification sent: {message}"}

            # ── Create Chit action ───────────────────────────────
            elif action_type == "create_chit":
                # Create a new chit based on action parameters
                new_chit_id = str(uuid4())
                
                # Build chit data from params with template substitution
                chit_data = {
                    "id": new_chit_id,
                    "owner_id": owner_id,
                    "created_datetime": current_time,
                    "modified_datetime": current_time,
                    "title": _substitute_templates(params.get("title", ""), chit),
                    "note": _substitute_templates(params.get("note", ""), chit),
                    "status": params.get("status", "ToDo"),
                    "priority": params.get("priority", "Medium"),
                    "severity": params.get("severity", "Medium"),
                    "color": params.get("color", ""),
                    "location": _substitute_templates(params.get("location", ""), chit),
                    "start_datetime": _substitute_templates(params.get("start_datetime", ""), chit),
                    "due_datetime": _substitute_templates(params.get("due_datetime", ""), chit),
                    "point_in_time": _substitute_templates(params.get("point_in_time", ""), chit),
                    "tags": serialize_json_field(params.get("tags", [])),
                    "people": serialize_json_field(params.get("people", [])),
                    "alerts": serialize_json_field(_substitute_alert_templates(params.get("alerts", []), chit)),
                    "checklist": serialize_json_field(params.get("checklist", [])),
                    "child_chits": serialize_json_field([]),
                    "recurrence_rule": serialize_json_field({}),
                    "recurrence_exceptions": serialize_json_field([]),
                    "shares": serialize_json_field([]),
                    "archived": False,
                    "deleted": False,
                    "pinned": False,
                    "all_day": params.get("all_day", False),
                    "show_on_calendar": params.get("show_on_calendar", True),
                    "habit": False,
                }
                
                # Get owner info for the new chit
                cursor.execute(
                    "SELECT username, display_name FROM users WHERE id = ?", 
                    (owner_id,)
                )
                user_row = cursor.fetchone()
                if user_row:
                    chit_data["owner_username"] = user_row[0]
                    chit_data["owner_display_name"] = user_row[1]
                
                # Insert the new chit
                columns = list(chit_data.keys())
                placeholders = ", ".join(["?" for _ in columns])
                values = [chit_data[col] for col in columns]
                
                cursor.execute(
                    f"INSERT INTO chits ({', '.join(columns)}) VALUES ({placeholders})",
                    values
                )
                
                conn.commit()
                return {"success": True, "message": f"Created chit: {chit_data['title']}", "chit_id": new_chit_id}

            # ── Create Reminder action ───────────────────────────
            elif action_type == "create_reminder":
                # Create a reminder chit (notification + point_in_time)
                new_chit_id = str(uuid4())
                
                title = _substitute_templates(params.get("title", "Reminder"), chit)
                note = _substitute_templates(params.get("note", ""), chit)
                reminder_time = _substitute_templates(params.get("reminder_time", ""), chit)
                
                # If reminder_time is just HH:MM, prepend today's date
                if reminder_time and len(reminder_time) <= 5 and ":" in reminder_time:
                    reminder_time = datetime.utcnow().strftime("%Y-%m-%d") + "T" + reminder_time + ":00"
                
                chit_data = {
                    "id": new_chit_id,
                    "owner_id": owner_id,
                    "created_datetime": current_time,
                    "modified_datetime": current_time,
                    "title": title,
                    "note": note,
                    "status": "ToDo",
                    "priority": "Medium",
                    "severity": "Medium",
                    "color": "",
                    "location": "",
                    "start_datetime": None,
                    "due_datetime": None,
                    "point_in_time": reminder_time or None,
                    "notification": 1,
                    "alarm": 0,
                    "tags": serialize_json_field(["CWOC_System/Reminders"]),
                    "people": serialize_json_field([]),
                    "alerts": serialize_json_field([{"datetime": reminder_time, "type": "notification"}] if reminder_time else []),
                    "checklist": serialize_json_field([]),
                    "child_chits": serialize_json_field([]),
                    "recurrence_rule": serialize_json_field({}),
                    "recurrence_exceptions": serialize_json_field([]),
                    "shares": serialize_json_field([]),
                    "archived": False,
                    "deleted": False,
                    "pinned": False,
                    "all_day": False,
                    "show_on_calendar": True,
                    "habit": False,
                }
                
                # Get owner info
                cursor.execute(
                    "SELECT username, display_name FROM users WHERE id = ?",
                    (owner_id,)
                )
                user_row = cursor.fetchone()
                if user_row:
                    chit_data["owner_username"] = user_row[0]
                    chit_data["owner_display_name"] = user_row[1]
                
                columns = list(chit_data.keys())
                placeholders = ", ".join(["?" for _ in columns])
                values = [chit_data[col] for col in columns]
                
                cursor.execute(
                    f"INSERT INTO chits ({', '.join(columns)}) VALUES ({placeholders})",
                    values
                )
                
                conn.commit()
                return {"success": True, "message": f"Created reminder: {title}", "chit_id": new_chit_id}

            # ── Contact cross-reference action ───────────────────
            elif action_type == "add_matching_contacts_as_people":
                match_field = params.get("match_field", "city")
                location = chit.get("location") or ""
                if not location:
                    conn.commit()
                    return {"success": True, "message": "No location on chit, skipped"}

                # Load owner's contacts
                cursor.execute(
                    "SELECT * FROM contacts WHERE owner_id = ?", (owner_id,)
                )
                contact_rows = cursor.fetchall()
                contact_cols = [col[0] for col in cursor.description]
                contacts = [dict(zip(contact_cols, r)) for r in contact_rows]

                people = deserialize_json_field(chit.get("people")) or []
                added = []
                location_lower = location.lower()

                for contact in contacts:
                    addresses_raw = contact.get("addresses")
                    addresses = deserialize_json_field(addresses_raw) if isinstance(addresses_raw, str) else (addresses_raw or [])
                    for addr in (addresses or []):
                        addr_value = addr.get("value", "") if isinstance(addr, dict) else str(addr)
                        parts = [p.strip().lower() for p in addr_value.split(",")]
                        if any(part and part in location_lower for part in parts):
                            display_name = contact.get("display_name") or ""
                            if not display_name:
                                gn = contact.get("given_name") or ""
                                sn = contact.get("surname") or ""
                                display_name = f"{gn} {sn}".strip()
                            if display_name and display_name not in people:
                                people.append(display_name)
                                added.append(display_name)
                            break  # one match per contact is enough

                if added:
                    chit["people"] = people
                    cursor.execute(
                        "UPDATE chits SET people = ?, modified_datetime = ? WHERE id = ?",
                        (serialize_json_field(people), current_time, entity_id),
                    )

            else:
                conn.commit()
                return {"success": False, "message": f"Unknown action type: {action_type}"}

            # ── Post-action: recompute system tags + audit ───────
            # Update modified_datetime in the dict for tag recompute
            chit["modified_datetime"] = current_time
            _recompute_and_save_system_tags(cursor, chit, entity_id)

            # Compute audit diff and insert entry
            try:
                new_chit = _read_chit(cursor, entity_id)
                diff = compute_audit_diff(
                    old_chit, new_chit or chit,
                    exclude_fields={"modified_datetime", "created_datetime"},
                )
                if diff:
                    insert_audit_entry(
                        conn, "chit", entity_id, "updated", actor,
                        changes=diff,
                        entity_summary=chit.get("title"),
                    )
            except Exception as audit_err:
                logger.error("Audit logging failed for rule action (best-effort): %s", audit_err)

            conn.commit()
            return {"success": True, "message": f"Action {action_type} applied to chit {entity_id}"}

        # ── Contact actions (future extension point) ─────────────
        elif entity_type == "contact":
            contact = _read_contact(cursor, entity_id)
            if not contact:
                return {"success": False, "message": f"Contact {entity_id} not found"}

            contact_owner = contact.get("owner_id")
            if contact_owner and contact_owner != owner_id:
                return {"success": False, "message": f"Permission denied: user {owner_id} does not own contact {entity_id}"}

            # Contact actions can be extended here in the future
            return {"success": False, "message": f"Action {action_type} not supported for contacts"}

        # ── Habit trigger actions (standalone, no entity mutation) ─
        elif entity_type == "habit":
            # Habit triggers fire with a synthetic entity — actions that
            # don't require a real chit/contact are supported directly.
            if action_type == "send_notification":
                message = params.get("message", "")
                # Template substitution for habit-specific placeholders
                source_name = params.get("_entity_title") or entity_id
                message = message.replace("{rule_name}", rule_name)
                message = message.replace("{habit_name}", source_name)
                message = message.replace("{chit_title}", source_name)
                _send_rule_notification(owner_id, entity_id, source_name, message)
                conn.commit()
                return {"success": True, "message": f"Notification sent: {message}"}
            elif action_type == "call_ha_service":
                try:
                    from src.backend import ha_bridge
                    domain = params.get("domain", "")
                    service = params.get("service", "")
                    ha_entity_id = params.get("entity_id", "")
                    service_data = params.get("service_data") or {}
                    if isinstance(service_data, str):
                        service_data = json.loads(service_data)
                    result = ha_bridge.call_ha_service(domain, service, ha_entity_id, service_data)
                    conn.commit()
                    return result
                except ImportError:
                    conn.commit()
                    return {"success": False, "message": "HA bridge not available"}
                except Exception as ha_err:
                    conn.commit()
                    return {"success": False, "message": f"HA service call failed: {ha_err}"}
            elif action_type == "fire_ha_event":
                try:
                    from src.backend import ha_bridge
                    event_type = params.get("event_type", "")
                    event_data = params.get("event_data") or {}
                    if isinstance(event_data, str):
                        event_data = json.loads(event_data)
                    event_data["habit_source_id"] = entity_id
                    event_data["habit_rule_name"] = rule_name
                    result = ha_bridge.fire_ha_event(event_type, event_data)
                    conn.commit()
                    return result
                except ImportError:
                    conn.commit()
                    return {"success": False, "message": "HA bridge not available"}
                except Exception as ha_err:
                    conn.commit()
                    return {"success": False, "message": f"HA event fire failed: {ha_err}"}
            else:
                # For actions that need a real chit (add_tag, set_status, etc.),
                # try to use the source chit if available
                chit = _read_chit(cursor, entity_id)
                if chit:
                    # Re-dispatch as a chit action
                    conn.close()
                    return execute_action(action, "chit", entity_id, owner_id, rule_name, rule_id)
                else:
                    conn.commit()
                    return {"success": False, "message": f"Action '{action_type}' requires a chit target but habit entity '{entity_id}' is not a chit. Use send_notification or HA actions for habit triggers."}

        else:
            return {"success": False, "message": f"Unknown entity type: {entity_type}"}

    except Exception as exc:
        logger.error("Action %s failed on %s %s: %s", action_type, entity_type, entity_id, exc)
        return {"success": False, "message": f"Action failed: {str(exc)}"}
    finally:
        if conn:
            conn.close()


# ── Notification helper ──────────────────────────────────────────────

def _send_rule_notification(owner_id: str, chit_id: str, chit_title: str, message: str):
    """Send push and ntfy notifications for a rule action.

    Uses the same helpers as the alert scheduler — gracefully skips if
    push or ntfy modules are unavailable.
    """
    # Web Push
    try:
        from src.backend.routes.push import send_push_to_user
        payload = {
            "title": "CWOC Rule",
            "body": message,
            "icon": "/static/cwoc-icon-192.png",
            "badge": "/static/cwoc-icon-192.png",
            "data": {
                "chit_id": chit_id,
                "url": f"/frontend/html/editor.html?id={chit_id}",
            },
        }
        send_push_to_user(owner_id, payload)
    except ImportError:
        logger.debug("Push routes not available — skipping push notification")
    except Exception as exc:
        logger.warning("Push notification failed for rule action: %s", exc)

    # Ntfy
    try:
        from src.backend.routes.ntfy import send_ntfy_notification
        from src.backend.schedulers import _get_server_base_url
        base = _get_server_base_url()
        ntfy_click = f"{base}/frontend/html/editor.html?id={chit_id}" if chit_id else None
        send_ntfy_notification(
            user_id=owner_id,
            title="CWOC Rule",
            body=message,
            click_url=ntfy_click,
            tags="robot_face",
            priority=3,
        )
    except ImportError:
        logger.debug("Ntfy routes not available — skipping ntfy notification")
    except Exception as exc:
        logger.warning("Ntfy notification failed for rule action: %s", exc)


# ── Habit Trigger Matching ────────────────────────────────────────────

def _match_habit_trigger(rule: dict, entity: dict) -> bool:
    """Check if a habit trigger rule matches the incoming habit event entity.

    The rule's habit_trigger_config specifies which habit source to watch.
    The entity dict (synthetic, built by the scheduler) contains:
      - source_rule_id: the habit rule that fired
      - source_chit_id: the habit chit that changed
      - source_type: "rule" or "chit"
      - habit_event: "achieved", "missed", or "due"

    Matching logic:
      - If habit_trigger_config.source_rule_id == "*" or source_chit_id == "*",
        match any habit of that type.
      - Otherwise, match on exact source ID.
    """
    config_raw = rule.get("habit_trigger_config")
    if not config_raw:
        # No config = match all habit events of this trigger type
        return True

    if isinstance(config_raw, str):
        try:
            config = json.loads(config_raw)
        except (json.JSONDecodeError, TypeError):
            return True  # Can't parse config, default to match
    else:
        config = config_raw

    if not isinstance(config, dict):
        return True

    source_type = config.get("source_type", "rule")
    entity_source_type = entity.get("source_type", "rule")

    # Must match source type (rule vs chit)
    if source_type != entity_source_type and source_type != "any":
        return False

    # Check source ID matching
    if source_type == "rule" or source_type == "any":
        config_rule_id = config.get("source_rule_id", "*")
        if config_rule_id != "*" and config_rule_id != entity.get("source_rule_id"):
            return False

    if source_type == "chit" or source_type == "any":
        config_chit_id = config.get("source_chit_id", "*")
        if config_chit_id != "*" and config_chit_id != entity.get("source_chit_id"):
            return False

    return True


# ── Trigger Dispatcher ───────────────────────────────────────────────

def dispatch_trigger(
    trigger_type: str,
    entity_type: str,
    entity: dict,
    owner_id: str,
):
    """Fire-and-forget: load matching rules, evaluate, execute/queue actions.

    Called from chit/contact route handlers after create/update operations.
    Runs in a background thread so it doesn't block the API response.

    This is a synchronous function — all operations are SQLite calls that
    don't benefit from async.  Callers should invoke it via
    ``threading.Thread(target=dispatch_trigger, …, daemon=True).start()``.

    Args:
        trigger_type: One of chit_created, chit_updated, email_received,
                      contact_created, contact_updated, scheduled,
                      ha_state_change, ha_webhook, habit_achieved,
                      habit_missed, habit_due.
        entity_type: ``"chit"``, ``"contact"``, or ``"habit"``.
        entity: The triggering entity as a flat dict. For habit triggers,
                this is a synthetic dict with habit metadata (rule_id,
                rule_name, habit_status, streak, period, etc.).
        owner_id: UUID of the entity owner.
    """
    from src.backend.routes.audit import insert_audit_entry

    entity_id = entity.get("id", "unknown")
    logger.info(
        "dispatch_trigger called: trigger_type=%s, entity_type=%s, entity_id=%s, owner_id=%s",
        trigger_type, entity_type, entity_id, owner_id,
    )

    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # ── 1. Load enabled rules for this trigger + owner ───────
        cursor.execute(
            "SELECT * FROM rules WHERE owner_id = ? AND trigger_type = ? AND enabled = 1 "
            "ORDER BY priority ASC",
            (owner_id, trigger_type),
        )
        columns = [col[0] for col in cursor.description]
        rules = [dict(zip(columns, row)) for row in cursor.fetchall()]

        logger.info(
            "dispatch_trigger: found %d enabled rule(s) for trigger_type=%s, owner_id=%s",
            len(rules), trigger_type, owner_id,
        )

        if not rules:
            return

        # ── 2. Pre-load contacts if any rule uses cross-ref ──────
        contacts = None
        needs_contacts = False
        for rule in rules:
            conditions_raw = rule.get("conditions")
            actions_raw = rule.get("actions")
            cond_str = conditions_raw if isinstance(conditions_raw, str) else json.dumps(conditions_raw or {})
            act_str = actions_raw if isinstance(actions_raw, str) else json.dumps(actions_raw or [])
            if "contact" in cond_str.lower() or "add_matching_contacts" in act_str.lower():
                needs_contacts = True
                break

        if needs_contacts:
            cursor.execute(
                "SELECT * FROM contacts WHERE owner_id = ?", (owner_id,)
            )
            contact_cols = [col[0] for col in cursor.description]
            contacts = [dict(zip(contact_cols, r)) for r in cursor.fetchall()]

        # ── 3. Evaluate each rule ────────────────────────────────
        for rule in rules:
            rule_id = rule.get("id", "")
            rule_name = rule.get("name", "")
            confirm = rule.get("confirm_before_apply", 1)
            current_time = datetime.utcnow().isoformat()

            # Parse conditions
            conditions_raw = rule.get("conditions")
            if isinstance(conditions_raw, str):
                conditions = deserialize_json_field(conditions_raw)
            else:
                conditions = conditions_raw

            # Parse actions
            actions_raw = rule.get("actions")
            if isinstance(actions_raw, str):
                actions_list = deserialize_json_field(actions_raw)
            else:
                actions_list = actions_raw
            actions_list = actions_list or []

            # Evaluate condition tree
            matched = False
            try:
                # For habit triggers, first check source matching
                if trigger_type in ("habit_achieved", "habit_missed", "habit_due"):
                    matched = _match_habit_trigger(rule, entity)
                    # If source matched and conditions exist, also evaluate them
                    if matched and conditions and isinstance(conditions, dict):
                        matched = evaluate_condition_tree(conditions, entity, contacts)
                elif conditions and isinstance(conditions, dict):
                    matched = evaluate_condition_tree(conditions, entity, contacts)
                logger.info(
                    "dispatch_trigger: rule '%s' (%s) conditions_matched=%s",
                    rule_name, rule_id, matched,
                )
            except Exception as eval_err:
                logger.error("Rule %s (%s) condition evaluation failed: %s", rule_name, rule_id, eval_err)

            # ── Execute or queue actions ─────────────────────────
            actions_executed = 0
            actions_failed = 0

            if matched:
                if confirm:
                    # Queue each action for confirmation
                    for act in actions_list:
                        try:
                            act_type = act.get("type", "unknown")
                            act_params = act.get("params", {})
                            description = _build_action_description(act_type, act_params, entity)
                            confirmation_id = str(uuid4())
                            cursor.execute(
                                "INSERT INTO rule_confirmations "
                                "(id, rule_id, rule_name, owner_id, action_description, "
                                " action_data, target_entity_type, target_entity_id, created_datetime) "
                                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                                (
                                    confirmation_id,
                                    rule_id,
                                    rule_name,
                                    owner_id,
                                    description,
                                    serialize_json_field(act),
                                    entity_type,
                                    entity.get("id", ""),
                                    current_time,
                                ),
                            )
                            actions_executed += 1
                        except Exception as q_err:
                            logger.error("Failed to queue confirmation for rule %s: %s", rule_id, q_err)
                            actions_failed += 1
                else:
                    # Execute actions immediately
                    for act in actions_list:
                        result = execute_action(
                            act, entity_type, entity.get("id", ""),
                            owner_id, rule_name, rule_id,
                        )
                        if result.get("success"):
                            actions_executed += 1
                        else:
                            actions_failed += 1

            # ── 4. Insert execution log entry ────────────────────
            entities_matched = 1 if matched else 0
            if actions_failed > 0 and actions_executed > 0:
                result_summary = f"partial: {actions_executed} of {actions_executed + actions_failed} actions {'queued' if confirm and matched else 'applied'}"
            elif matched and actions_executed > 0:
                result_summary = f"success: {actions_executed} actions {'queued for confirmation' if confirm else 'applied'}"
            elif matched and actions_executed == 0 and actions_failed > 0:
                result_summary = f"failed: all {actions_failed} actions failed"
            elif matched and not actions_list:
                result_summary = "matched but no actions configured"
            else:
                result_summary = "no match"

            logger.info(
                "dispatch_trigger: rule '%s' (%s) result=%s (actions_ok=%d, actions_fail=%d)",
                rule_name, rule_id, result_summary, actions_executed, actions_failed,
            )

            log_id = str(uuid4())
            try:
                cursor.execute(
                    "INSERT INTO rule_execution_log "
                    "(id, rule_id, owner_id, trigger_event, entities_evaluated, "
                    " entities_matched, actions_executed, actions_failed, "
                    " result_summary, executed_datetime) "
                    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    (
                        log_id,
                        rule_id,
                        owner_id,
                        trigger_type,
                        1,  # single entity evaluated
                        entities_matched,
                        actions_executed,
                        actions_failed,
                        result_summary,
                        current_time,
                    ),
                )
            except Exception as log_err:
                logger.error("Failed to insert execution log for rule %s: %s", rule_id, log_err)

            # ── 5. Update rule metadata ──────────────────────────
            try:
                run_count = (rule.get("run_count") or 0) + 1
                cursor.execute(
                    "UPDATE rules SET last_run_datetime = ?, run_count = ?, last_run_result = ? "
                    "WHERE id = ?",
                    (current_time, run_count, result_summary, rule_id),
                )
            except Exception as meta_err:
                logger.error("Failed to update rule %s metadata: %s", rule_id, meta_err)

        conn.commit()

    except Exception as exc:
        logger.error("dispatch_trigger(%s, %s) failed: %s", trigger_type, entity_type, exc)
    finally:
        if conn:
            conn.close()


# ── Helper: template substitution ───────────────────────────────────

def _substitute_alert_templates(alerts: list, entity: dict) -> list:
    """Apply template substitution to alert datetime fields."""
    if not alerts or not isinstance(alerts, list):
        return alerts
    result = []
    for alert in alerts:
        if isinstance(alert, dict):
            new_alert = dict(alert)
            if "datetime" in new_alert:
                new_alert["datetime"] = _substitute_templates(new_alert["datetime"], entity)
            result.append(new_alert)
        else:
            result.append(alert)
    return result


def _substitute_templates(text: str, entity: dict) -> str:
    """Substitute template placeholders in text with entity values.
    
    Supports placeholders like {{title}}, {{status}}, {{today}}, {{weather_low}}, etc.
    """
    if not isinstance(text, str) or not text:
        return text
        
    # Common template substitutions
    substitutions = {
        "{{title}}": str(entity.get("title", "")),
        "{{note}}": str(entity.get("note", "")),
        "{{status}}": str(entity.get("status", "")),
        "{{priority}}": str(entity.get("priority", "")),
        "{{severity}}": str(entity.get("severity", "")),
        "{{location}}": str(entity.get("location", "")),
        "{{color}}": str(entity.get("color", "")),
        "{{today}}": datetime.utcnow().strftime("%Y-%m-%d"),
        "{{now}}": datetime.utcnow().isoformat(),
        "{{owner_id}}": str(entity.get("owner_id", "")),
    }
    
    # Weather template variables — fetch on demand if any weather placeholder is present
    if "{{weather_" in text:
        owner_id = entity.get("owner_id", "")
        weather = _get_current_weather_for_default_location(owner_id) if owner_id else None
        if weather:
            substitutions["{{weather_low}}"] = str(weather.get("low", "?"))
            substitutions["{{weather_high}}"] = str(weather.get("high", "?"))
            substitutions["{{weather_precipitation}}"] = str(weather.get("precipitation", "?"))
            substitutions["{{weather_wind_speed}}"] = str(weather.get("wind_speed", "?"))
            substitutions["{{weather_wind_gusts}}"] = str(weather.get("wind_gusts", "?"))
            substitutions["{{weather_code}}"] = str(weather.get("weather_code", "?"))
        else:
            substitutions["{{weather_low}}"] = "?"
            substitutions["{{weather_high}}"] = "?"
            substitutions["{{weather_precipitation}}"] = "?"
            substitutions["{{weather_wind_speed}}"] = "?"
            substitutions["{{weather_wind_gusts}}"] = "?"
            substitutions["{{weather_code}}"] = "?"
    
    # Apply substitutions
    result = text
    for placeholder, value in substitutions.items():
        result = result.replace(placeholder, value)
        
    return result


# ── Helper: human-readable action description ────────────────────────

def _build_action_description(action_type: str, params: dict, entity: dict) -> str:
    """Build a human-readable description of a proposed action for the
    confirmation UI."""
    entity_title = entity.get("title") or entity.get("display_name") or entity.get("id", "unknown")

    descriptions = {
        "add_tag": f"Add tag '{params.get('tag', '')}' to '{entity_title}'",
        "remove_tag": f"Remove tag '{params.get('tag', '')}' from '{entity_title}'",
        "set_status": f"Set status to '{params.get('status', '')}' on '{entity_title}'",
        "set_priority": f"Set priority to '{params.get('priority', '')}' on '{entity_title}'",
        "set_severity": f"Set severity to '{params.get('severity', '')}' on '{entity_title}'",
        "set_color": f"Set color to '{params.get('color', '')}' on '{entity_title}'",
        "set_location": f"Set location to '{params.get('location', '')}' on '{entity_title}'",
        "add_person": f"Add person '{params.get('person', '')}' to '{entity_title}'",
        "archive": f"Archive '{entity_title}'",
        "move_to_trash": f"Move '{entity_title}' to trash",
        "add_to_project": f"Add '{entity_title}' to project {params.get('project_id', '')}",
        "add_alert": f"Add alert to '{entity_title}'",
        "share_with_user": f"Share '{entity_title}' with user {params.get('user_id', '')} as {params.get('role', 'viewer')}",
        "assign_to_user": f"Assign '{entity_title}' to user {params.get('user_id', '')}",
        "mark_email_read": f"Mark '{entity_title}' as read",
        "mark_email_unread": f"Mark '{entity_title}' as unread",
        "move_email_to_folder": f"Move '{entity_title}' to folder '{params.get('folder', '')}'",
        "send_notification": f"Send notification: {params.get('message', '')}",
        "add_matching_contacts_as_people": f"Add matching contacts as people on '{entity_title}'",
        "call_ha_service": f"Call HA service {params.get('domain', '')}.{params.get('service', '')} on {params.get('entity_id', '')}",
        "fire_ha_event": f"Fire Home Assistant event '{params.get('event_type', '')}' with {len(params.get('event_data', {}) or {})} data fields",
        "create_chit": f"Create new chit: {params.get('title', 'Untitled')}",
        "create_reminder": f"Create reminder: {params.get('title', 'Reminder')} at {params.get('reminder_time', '?')}",
    }
    return descriptions.get(action_type, f"Execute {action_type} on '{entity_title}'")
