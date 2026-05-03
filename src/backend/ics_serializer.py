"""iCalendar (.ics) serialization/deserialization for calendar import.

Provides ics_parse() and ics_print() — pure-Python functions using only
stdlib, following the same architectural pattern as vcard_parse/vcard_print
in serializers.py.

Handles RFC 5545 line unfolding, VEVENT/VTODO extraction, TZID preservation,
DATE vs DATE-TIME detection, and RRULE parsing/serialization.
"""

import re
from typing import List, Dict, Any, Optional


def _unfold_lines(text: str) -> List[str]:
    """Unfold RFC 5545 continuation lines.

    Lines starting with a space or tab are continuations of the previous
    logical line (RFC 5545 §3.1).
    """
    unfolded: List[str] = []
    for raw_line in text.splitlines():
        if raw_line.startswith((" ", "\t")) and unfolded:
            unfolded[-1] += raw_line[1:]
        else:
            unfolded.append(raw_line)
    return unfolded


def _parse_property(line: str) -> Optional[tuple]:
    """Parse a single iCalendar content line into (name, params_dict, value).

    Returns None if the line has no colon separator.
    """
    # Find the colon that separates property name+params from value.
    # Colons can appear inside quoted parameter values, so we track quotes.
    colon_idx = -1
    in_quotes = False
    for i, ch in enumerate(line):
        if ch == '"':
            in_quotes = not in_quotes
        elif ch == ':' and not in_quotes:
            colon_idx = i
            break

    if colon_idx == -1:
        return None

    prop_part = line[:colon_idx]
    value = line[colon_idx + 1:]

    # Split property name from parameters on semicolons
    parts = prop_part.split(";")
    prop_name = parts[0].upper()
    params: Dict[str, str] = {}
    for p in parts[1:]:
        if "=" in p:
            pk, pv = p.split("=", 1)
            params[pk.upper()] = pv.strip('"')
        else:
            params["TYPE"] = p

    return (prop_name, params, value)


def _parse_datetime_value(value: str) -> tuple:
    """Parse a DTSTART/DTEND/DUE value string.

    Returns (iso_string, is_all_day).
    - DATE format (8 digits): returns (YYYY-MM-DD, True)
    - DATE-TIME format: returns (ISO datetime string, False)
    """
    value = value.strip()

    # DATE format: exactly 8 digits like 20250615
    if re.match(r'^\d{8}$', value):
        return (f"{value[:4]}-{value[4:6]}-{value[6:8]}", True)

    # DATE-TIME format: 20250615T100000 or 20250615T100000Z
    m = re.match(r'^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$', value)
    if m:
        yr, mo, dy, hr, mi, sc, z = m.groups()
        iso = f"{yr}-{mo}-{dy}T{hr}:{mi}:{sc}"
        if z:
            iso += "Z"
        return (iso, False)

    # Already in ISO-ish format — return as-is
    return (value, False)


def _parse_rrule(value: str) -> Dict[str, Any]:
    """Parse an RRULE value string into a structured dict.

    Example input: FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;UNTIL=20251231T235959Z
    """
    result: Dict[str, Any] = {
        "freq": None,
        "interval": 1,
        "byday": None,
        "until": None,
        "count": None,
    }

    for part in value.split(";"):
        if "=" not in part:
            continue
        key, val = part.split("=", 1)
        key = key.upper().strip()
        val = val.strip()

        if key == "FREQ":
            result["freq"] = val.upper()
        elif key == "INTERVAL":
            try:
                result["interval"] = int(val)
            except ValueError:
                result["interval"] = 1
        elif key == "BYDAY":
            result["byday"] = [d.strip() for d in val.split(",")]
        elif key == "UNTIL":
            parsed, _ = _parse_datetime_value(val)
            result["until"] = parsed
        elif key == "COUNT":
            try:
                result["count"] = int(val)
            except ValueError:
                pass

    return result


def ics_parse(ics_text: str) -> dict:
    """Parse an iCalendar (.ics) string into structured component dictionaries.

    Returns a dict with structure:
    {
        "components": [
            {
                "type": "VEVENT" | "VTODO",
                "summary": str | None,
                "dtstart": str | None,
                "dtstart_tzid": str | None,
                "dtend": str | None,
                "dtend_tzid": str | None,
                "due": str | None,
                "description": str | None,
                "location": str | None,
                "categories": [str, ...],
                "priority": int | None,
                "uid": str | None,
                "rrule": dict | None,
                "status": str | None,
                "all_day": bool,
            },
            ...
        ],
        "errors": [str, ...]
    }

    Returns {"error": "..."} if the content is not valid iCalendar.
    """
    if not ics_text or not ics_text.strip():
        return {"error": "Invalid iCalendar file: empty content"}

    lines = _unfold_lines(ics_text)

    # Validate that the file begins with BEGIN:VCALENDAR
    # Skip any leading blank lines
    first_content_line = None
    for line in lines:
        stripped = line.strip()
        if stripped:
            first_content_line = stripped
            break

    if not first_content_line or first_content_line.upper() != "BEGIN:VCALENDAR":
        return {"error": "Invalid iCalendar file: does not begin with BEGIN:VCALENDAR"}

    components: List[Dict[str, Any]] = []
    errors: List[str] = []

    # Track component blocks
    current_component: Optional[Dict[str, Any]] = None
    current_type: Optional[str] = None
    component_index = 0
    in_nested = 0  # Track nested components like VALARM inside VEVENT

    # Component types we care about
    supported_types = {"VEVENT", "VTODO"}
    # Component types we silently ignore (including nested ones)
    ignored_types = {"VTIMEZONE", "VJOURNAL", "VFREEBUSY", "VALARM", "DAYLIGHT", "STANDARD"}

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue

        upper = stripped.upper()

        # Check for BEGIN markers
        if upper.startswith("BEGIN:"):
            comp_type = upper[6:].strip()

            if current_component is not None:
                # We're inside a component — this is a nested component
                in_nested += 1
                continue

            if comp_type in supported_types:
                current_type = comp_type
                current_component = {
                    "type": comp_type,
                    "summary": None,
                    "dtstart": None,
                    "dtstart_tzid": None,
                    "dtend": None,
                    "dtend_tzid": None,
                    "due": None,
                    "description": None,
                    "location": None,
                    "categories": [],
                    "priority": None,
                    "uid": None,
                    "rrule": None,
                    "status": None,
                    "all_day": False,
                }
                component_index += 1
            # else: VCALENDAR, VTIMEZONE, etc. — silently ignore
            continue

        # Check for END markers
        if upper.startswith("END:"):
            comp_type = upper[4:].strip()

            if in_nested > 0:
                in_nested -= 1
                continue

            if comp_type == current_type and current_component is not None:
                # Validate: must have SUMMARY
                if not current_component["summary"]:
                    errors.append(f"Component {component_index}: Missing SUMMARY property")
                else:
                    components.append(current_component)
                current_component = None
                current_type = None
            continue

        # If we're inside a nested component, skip its properties
        if in_nested > 0:
            continue

        # Parse properties only when inside a supported component
        if current_component is None:
            continue

        parsed = _parse_property(stripped)
        if parsed is None:
            continue

        prop_name, params, value = parsed

        if prop_name == "SUMMARY":
            current_component["summary"] = value

        elif prop_name == "DESCRIPTION":
            current_component["description"] = value

        elif prop_name == "LOCATION":
            current_component["location"] = value

        elif prop_name == "DTSTART":
            tzid = params.get("TZID")
            dt_val, is_all_day = _parse_datetime_value(value)
            current_component["dtstart"] = dt_val
            current_component["dtstart_tzid"] = tzid
            if params.get("VALUE", "").upper() == "DATE" or is_all_day:
                current_component["all_day"] = True

        elif prop_name == "DTEND":
            tzid = params.get("TZID")
            dt_val, is_all_day = _parse_datetime_value(value)
            current_component["dtend"] = dt_val
            current_component["dtend_tzid"] = tzid
            if params.get("VALUE", "").upper() == "DATE" or is_all_day:
                current_component["all_day"] = True

        elif prop_name == "DUE":
            dt_val, is_all_day = _parse_datetime_value(value)
            current_component["due"] = dt_val
            if params.get("VALUE", "").upper() == "DATE" or is_all_day:
                current_component["all_day"] = True

        elif prop_name == "CATEGORIES":
            cats = [c.strip() for c in value.split(",") if c.strip()]
            current_component["categories"].extend(cats)

        elif prop_name == "PRIORITY":
            try:
                current_component["priority"] = int(value)
            except ValueError:
                pass

        elif prop_name == "UID":
            current_component["uid"] = value

        elif prop_name == "RRULE":
            current_component["rrule"] = _parse_rrule(value)

        elif prop_name == "STATUS":
            current_component["status"] = value.upper()

    # Check if we have any components
    if not components and not errors:
        return {"error": "Invalid iCalendar file: no VEVENT or VTODO components found"}

    return {"components": components, "errors": errors}


def _format_rrule(rrule: Dict[str, Any]) -> str:
    """Serialize an RRULE dict back into RFC 5545 RRULE format.

    Example output: FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;UNTIL=20251231T235959Z
    """
    parts = []

    if rrule.get("freq"):
        parts.append(f"FREQ={rrule['freq']}")

    interval = rrule.get("interval", 1)
    if interval and interval != 1:
        parts.append(f"INTERVAL={interval}")

    if rrule.get("byday"):
        parts.append(f"BYDAY={','.join(rrule['byday'])}")

    if rrule.get("until"):
        until_val = rrule["until"]
        # If it's already in compact iCal format (no dashes), use as-is
        if "T" in until_val and "-" not in until_val:
            parts.append(f"UNTIL={until_val}")
        elif "T" in until_val:
            # ISO datetime like 2025-12-31T23:59:59Z → 20251231T235959Z
            clean = until_val.replace("-", "").replace(":", "")
            parts.append(f"UNTIL={clean}")
        else:
            # ISO date like 2025-12-31 → 20251231
            clean = until_val.replace("-", "")
            parts.append(f"UNTIL={clean}")

    if rrule.get("count"):
        parts.append(f"COUNT={rrule['count']}")

    return ";".join(parts)


def _format_datetime_prop(prop_name: str, value: str, tzid: Optional[str], all_day: bool) -> str:
    """Format a DTSTART/DTEND/DUE property line with optional TZID and DATE format.

    For all-day events, uses VALUE=DATE parameter and date-only format.
    For timed events with TZID, includes TZID parameter.
    """
    if all_day:
        # Convert ISO date (YYYY-MM-DD) to compact DATE format (YYYYMMDD)
        date_val = value.replace("-", "")
        # Strip any time component if present
        if "T" in date_val:
            date_val = date_val.split("T")[0]
        return f"{prop_name};VALUE=DATE:{date_val}"

    # Timed event — convert ISO datetime to compact format
    dt_val = value
    if "-" in dt_val and "T" in dt_val:
        # ISO format like 2025-06-15T10:00:00 → 20250615T100000
        dt_val = dt_val.replace("-", "").replace(":", "")
    elif "-" in dt_val and "T" not in dt_val:
        # Date-only in ISO but not all_day — treat as date with no time
        dt_val = dt_val.replace("-", "")

    if tzid:
        return f"{prop_name};TZID={tzid}:{dt_val}"
    else:
        return f"{prop_name}:{dt_val}"


def ics_print(components: List[Dict[str, Any]]) -> str:
    """Serialize a list of component dictionaries into a valid iCalendar string.

    Wraps output in BEGIN:VCALENDAR / END:VCALENDAR with VERSION:2.0
    and PRODID:-//CWOC//EN.

    Input: list of component dicts (same format as ics_parse output).
    Output: valid iCalendar string.
    """
    lines: List[str] = []
    lines.append("BEGIN:VCALENDAR")
    lines.append("VERSION:2.0")
    lines.append("PRODID:-//CWOC//EN")

    for comp in components:
        comp_type = comp.get("type", "VEVENT")
        all_day = comp.get("all_day", False)

        lines.append(f"BEGIN:{comp_type}")

        # UID
        if comp.get("uid"):
            lines.append(f"UID:{comp['uid']}")

        # SUMMARY
        if comp.get("summary"):
            lines.append(f"SUMMARY:{comp['summary']}")

        # DESCRIPTION
        if comp.get("description"):
            lines.append(f"DESCRIPTION:{comp['description']}")

        # LOCATION (VEVENT)
        if comp.get("location"):
            lines.append(f"LOCATION:{comp['location']}")

        # DTSTART
        if comp.get("dtstart"):
            lines.append(_format_datetime_prop(
                "DTSTART", comp["dtstart"],
                comp.get("dtstart_tzid"), all_day
            ))

        # DTEND
        if comp.get("dtend"):
            lines.append(_format_datetime_prop(
                "DTEND", comp["dtend"],
                comp.get("dtend_tzid"), all_day
            ))

        # DUE (VTODO)
        if comp.get("due"):
            lines.append(_format_datetime_prop(
                "DUE", comp["due"],
                None, all_day
            ))

        # STATUS (VTODO)
        if comp.get("status"):
            lines.append(f"STATUS:{comp['status']}")

        # PRIORITY
        if comp.get("priority") is not None:
            lines.append(f"PRIORITY:{comp['priority']}")

        # CATEGORIES
        if comp.get("categories"):
            lines.append(f"CATEGORIES:{','.join(comp['categories'])}")

        # RRULE
        if comp.get("rrule"):
            rrule_str = _format_rrule(comp["rrule"])
            if rrule_str:
                lines.append(f"RRULE:{rrule_str}")

        lines.append(f"END:{comp_type}")

    lines.append("END:VCALENDAR")
    return "\r\n".join(lines)
