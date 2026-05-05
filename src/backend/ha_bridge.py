"""Home Assistant Bridge — all HA communication logic for CWOC.

Handles service calls, event firing, state polling, entity/service listing,
connection testing, and template placeholder substitution. Uses stdlib
urllib.request for all HTTP calls — no pip installs required.
"""

import asyncio
import json
import logging
import sqlite3
import threading
import urllib.request
import urllib.error
from typing import Any, Dict, Optional, Set
from uuid import uuid4

from src.backend.db import DB_PATH
from src.backend.routes.email import _decrypt_password, _encrypt_password

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════
# In-memory state tracking for polling scheduler
# ═══════════════════════════════════════════════════════════════════════════

# owner_id → {entity_id, ...}
_monitored_entities: Dict[str, Set[str]] = {}

# entity_id → {state, attributes, last_changed}
_last_known_states: Dict[str, dict] = {}

# Polling loop control
_polling_task: Optional[asyncio.Task] = None


# ═══════════════════════════════════════════════════════════════════════════
# HA Config helpers
# ═══════════════════════════════════════════════════════════════════════════

def get_ha_config() -> Optional[dict]:
    """Read ha_config row from DB, decrypt token. Returns None if not configured."""
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM ha_config WHERE id = 1")
        row = cursor.fetchone()
        if not row:
            return None
        columns = [col[0] for col in cursor.description]
        config = dict(zip(columns, row))

        # Decrypt the access token if present
        encrypted_token = config.get("ha_access_token")
        if encrypted_token:
            try:
                config["ha_access_token_decrypted"] = _decrypt_password(encrypted_token)
            except Exception as e:
                logger.error("Failed to decrypt HA access token: %s", e)
                config["ha_access_token_decrypted"] = None
        else:
            config["ha_access_token_decrypted"] = None

        return config
    except Exception as e:
        logger.error("Failed to read ha_config: %s", e)
        return None
    finally:
        if conn:
            conn.close()


def is_ha_configured() -> bool:
    """Quick check — returns True if ha_config has a URL and token."""
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT ha_base_url, ha_access_token FROM ha_config WHERE id = 1")
        row = cursor.fetchone()
        if not row:
            return False
        base_url, token = row
        return bool(base_url and base_url.strip() and token and token.strip())
    except Exception:
        return False
    finally:
        if conn:
            conn.close()


# ═══════════════════════════════════════════════════════════════════════════
# HTTP helper
# ═══════════════════════════════════════════════════════════════════════════

def _ha_request(method: str, url: str, token: str, data: Optional[dict] = None,
                timeout: int = 10) -> dict:
    """Make an HTTP request to the HA REST API.

    Returns:
        {success: bool, message: str, status_code: int, data: any}
    """
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    body = None
    if data is not None:
        body = json.dumps(data).encode("utf-8")

    req = urllib.request.Request(url, data=body, headers=headers, method=method)

    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            status_code = response.status
            response_body = response.read().decode("utf-8")
            try:
                response_data = json.loads(response_body)
            except (json.JSONDecodeError, ValueError):
                response_data = response_body
            return {
                "success": True,
                "message": "OK",
                "status_code": status_code,
                "data": response_data,
            }
    except urllib.error.HTTPError as e:
        error_body = ""
        try:
            error_body = e.read().decode("utf-8")
        except Exception:
            pass
        return {
            "success": False,
            "message": f"HA returned {e.code}: {error_body[:200]}",
            "status_code": e.code,
            "data": None,
        }
    except urllib.error.URLError as e:
        reason = str(e.reason) if hasattr(e, "reason") else str(e)
        if "timed out" in reason.lower() or "timeout" in reason.lower():
            return {
                "success": False,
                "message": "HA request timed out",
                "status_code": 0,
                "data": None,
            }
        return {
            "success": False,
            "message": f"Cannot connect to HA: {reason}",
            "status_code": 0,
            "data": None,
        }
    except TimeoutError:
        return {
            "success": False,
            "message": "HA request timed out",
            "status_code": 0,
            "data": None,
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"HA request failed: {str(e)}",
            "status_code": 0,
            "data": None,
        }


# ═══════════════════════════════════════════════════════════════════════════
# Service calls (CWOC → HA)
# ═══════════════════════════════════════════════════════════════════════════

def call_ha_service(domain: str, service: str, entity_id: Optional[str] = None,
                    service_data: Optional[dict] = None, timeout: int = 10) -> dict:
    """POST to HA /api/services/{domain}/{service}. Returns {success, message, status_code}."""
    if not domain or not service:
        return {"success": False, "message": "Missing required domain or service"}

    config = get_ha_config()
    if not config:
        return {"success": False, "message": "HA not configured"}

    base_url = config.get("ha_base_url", "").rstrip("/")
    token = config.get("ha_access_token_decrypted")

    if not base_url or not token:
        return {"success": False, "message": "HA not configured"}

    url = f"{base_url}/api/services/{domain}/{service}"

    # Build request body
    body = service_data.copy() if service_data else {}
    if entity_id:
        body["entity_id"] = entity_id

    result = _ha_request("POST", url, token, data=body, timeout=timeout)
    return result


# ═══════════════════════════════════════════════════════════════════════════
# Event firing (CWOC → HA Event Bus)
# ═══════════════════════════════════════════════════════════════════════════

def fire_ha_event(event_type: str, event_data: Optional[dict] = None,
                  timeout: int = 10) -> dict:
    """POST to HA /api/events/{event_type}. Returns {success, message, status_code}."""
    if not event_type:
        return {"success": False, "message": "Missing required event_type"}

    config = get_ha_config()
    if not config:
        return {"success": False, "message": "HA not configured"}

    base_url = config.get("ha_base_url", "").rstrip("/")
    token = config.get("ha_access_token_decrypted")

    if not base_url or not token:
        return {"success": False, "message": "HA not configured"}

    url = f"{base_url}/api/events/{event_type}"

    result = _ha_request("POST", url, token, data=event_data or {}, timeout=timeout)
    return result


# ═══════════════════════════════════════════════════════════════════════════
# State polling
# ═══════════════════════════════════════════════════════════════════════════

def get_ha_entity_state(entity_id: str) -> Optional[dict]:
    """GET /api/states/{entity_id}. Returns parsed state dict or None on error."""
    config = get_ha_config()
    if not config:
        return None

    base_url = config.get("ha_base_url", "").rstrip("/")
    token = config.get("ha_access_token_decrypted")

    if not base_url or not token:
        return None

    url = f"{base_url}/api/states/{entity_id}"
    result = _ha_request("GET", url, token)

    if result.get("success"):
        return result.get("data")
    return None


def get_ha_entities() -> list:
    """GET /api/states — returns simplified list of {entity_id, state, friendly_name}."""
    config = get_ha_config()
    if not config:
        return []

    base_url = config.get("ha_base_url", "").rstrip("/")
    token = config.get("ha_access_token_decrypted")

    if not base_url or not token:
        return []

    url = f"{base_url}/api/states"
    result = _ha_request("GET", url, token, timeout=15)

    if not result.get("success"):
        return []

    states = result.get("data", [])
    if not isinstance(states, list):
        return []

    simplified = []
    for state_obj in states:
        if not isinstance(state_obj, dict):
            continue
        simplified.append({
            "entity_id": state_obj.get("entity_id", ""),
            "state": state_obj.get("state", ""),
            "friendly_name": (state_obj.get("attributes") or {}).get("friendly_name", ""),
        })

    return simplified


def get_ha_services() -> list:
    """GET /api/services — returns list of {domain, services: [{service, description, fields}]}."""
    config = get_ha_config()
    if not config:
        return []

    base_url = config.get("ha_base_url", "").rstrip("/")
    token = config.get("ha_access_token_decrypted")

    if not base_url or not token:
        return []

    url = f"{base_url}/api/services"
    result = _ha_request("GET", url, token, timeout=15)

    if not result.get("success"):
        return []

    services = result.get("data", [])
    if not isinstance(services, list):
        return []

    return services


# ═══════════════════════════════════════════════════════════════════════════
# Connection testing
# ═══════════════════════════════════════════════════════════════════════════

def test_ha_connection(base_url: str, token: str) -> dict:
    """GET /api/ with provided credentials. Returns {success, message, ha_version}."""
    if not base_url or not token:
        return {"success": False, "message": "Missing base URL or token", "ha_version": None}

    base_url = base_url.rstrip("/")
    url = f"{base_url}/api/"

    result = _ha_request("GET", url, token, timeout=10)

    if result.get("success"):
        data = result.get("data", {})
        ha_version = None
        if isinstance(data, dict):
            ha_version = data.get("version")
        return {
            "success": True,
            "message": "Connected successfully",
            "ha_version": ha_version,
        }
    else:
        return {
            "success": False,
            "message": result.get("message", "Connection failed"),
            "ha_version": None,
        }


# ═══════════════════════════════════════════════════════════════════════════
# Template substitution
# ═══════════════════════════════════════════════════════════════════════════

def substitute_template_placeholders(data: Any, context: dict) -> Any:
    """Replace {chit_title}, {chit_status}, {rule_name}, {entity_id} in string values.

    Recursively processes dicts and lists. Non-string values are left unchanged.
    """
    if isinstance(data, str):
        result = data
        for key, value in context.items():
            placeholder = "{" + key + "}"
            if placeholder in result:
                result = result.replace(placeholder, str(value) if value is not None else "")
        return result
    elif isinstance(data, dict):
        return {k: substitute_template_placeholders(v, context) for k, v in data.items()}
    elif isinstance(data, list):
        return [substitute_template_placeholders(item, context) for item in data]
    else:
        return data


# ═══════════════════════════════════════════════════════════════════════════
# Polling scheduler
# ═══════════════════════════════════════════════════════════════════════════

def update_monitored_entities():
    """Reload monitored entity set from DB. Called when ha_state_change rules change."""
    global _monitored_entities
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # Load all enabled rules with trigger_type = 'ha_state_change'
        cursor.execute(
            "SELECT owner_id, schedule_config FROM rules "
            "WHERE trigger_type = 'ha_state_change' AND enabled = 1"
        )
        rows = cursor.fetchall()

        new_monitored: Dict[str, Set[str]] = {}
        for owner_id, schedule_config_raw in rows:
            # Parse schedule_config JSON
            schedule_config = {}
            if schedule_config_raw:
                if isinstance(schedule_config_raw, str):
                    try:
                        schedule_config = json.loads(schedule_config_raw)
                    except (json.JSONDecodeError, ValueError):
                        continue
                elif isinstance(schedule_config_raw, dict):
                    schedule_config = schedule_config_raw

            entity_id = schedule_config.get("ha_entity_id")
            if entity_id:
                if owner_id not in new_monitored:
                    new_monitored[owner_id] = set()
                new_monitored[owner_id].add(entity_id)

        _monitored_entities = new_monitored
        logger.info(
            "Updated monitored HA entities: %d owners, %d total entities",
            len(_monitored_entities),
            sum(len(v) for v in _monitored_entities.values()),
        )
    except Exception as e:
        logger.error("Failed to update monitored entities: %s", e)
    finally:
        if conn:
            conn.close()


async def _ha_polling_loop():
    """Background loop: poll monitored entities, fire triggers on state change."""
    from src.backend.rules_engine import dispatch_trigger

    # Wait for server to fully start
    await asyncio.sleep(15)

    logger.info("HA polling scheduler started")

    while True:
        try:
            # Get poll interval from config
            config = get_ha_config()
            poll_interval = 30  # default
            if config:
                poll_interval = config.get("ha_poll_interval") or 30

            # Skip if HA is not configured
            if not config or not config.get("ha_base_url") or not config.get("ha_access_token_decrypted"):
                await asyncio.sleep(poll_interval)
                continue

            # Skip if no entities to monitor
            if not _monitored_entities:
                await asyncio.sleep(poll_interval)
                continue

            base_url = config.get("ha_base_url", "").rstrip("/")
            token = config.get("ha_access_token_decrypted")

            # Poll each monitored entity
            all_entity_ids = set()
            for entity_set in _monitored_entities.values():
                all_entity_ids.update(entity_set)

            for entity_id in all_entity_ids:
                try:
                    url = f"{base_url}/api/states/{entity_id}"
                    result = _ha_request("GET", url, token, timeout=10)

                    if not result.get("success"):
                        logger.warning(
                            "Failed to poll HA entity %s: %s",
                            entity_id, result.get("message")
                        )
                        continue

                    state_data = result.get("data", {})
                    if not isinstance(state_data, dict):
                        continue

                    new_state = state_data.get("state", "")
                    attributes = state_data.get("attributes", {})
                    last_changed = state_data.get("last_changed", "")

                    # Check for state change
                    old_entry = _last_known_states.get(entity_id)
                    old_state = old_entry.get("state", "") if old_entry else None

                    # Update last known state
                    _last_known_states[entity_id] = {
                        "state": new_state,
                        "attributes": attributes,
                        "last_changed": last_changed,
                    }

                    # Fire trigger if state changed (and we had a previous state)
                    if old_state is not None and old_state != new_state:
                        trigger_entity = {
                            "id": entity_id,
                            "ha_entity_id": entity_id,
                            "old_state": old_state,
                            "new_state": new_state,
                            "attributes": attributes,
                            "last_changed": last_changed,
                        }

                        # Fire for each owner monitoring this entity
                        for owner_id, entity_set in _monitored_entities.items():
                            if entity_id in entity_set:
                                threading.Thread(
                                    target=dispatch_trigger,
                                    args=("ha_state_change", "chit", trigger_entity, owner_id),
                                    daemon=True,
                                ).start()

                        logger.info(
                            "HA state change detected: %s %s → %s",
                            entity_id, old_state, new_state,
                        )

                except Exception as entity_err:
                    logger.error("Error polling HA entity %s: %s", entity_id, entity_err)

            await asyncio.sleep(poll_interval)

        except Exception as loop_err:
            logger.error("HA polling loop error: %s", loop_err)
            await asyncio.sleep(30)


async def start_ha_polling_scheduler():
    """Called from main.py on_startup. Loads monitored entities and starts polling loop."""
    global _polling_task

    # Load monitored entities from DB
    update_monitored_entities()

    # Start the polling background task
    _polling_task = asyncio.create_task(_ha_polling_loop())
    logger.info("HA polling scheduler registered")
