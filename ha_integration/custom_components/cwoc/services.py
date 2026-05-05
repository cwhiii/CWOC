"""Service action handlers for the CWOC integration."""
import logging

import aiohttp

from homeassistant.core import HomeAssistant, ServiceCall, ServiceResponse, SupportsResponse
from homeassistant.exceptions import HomeAssistantError

from .const import (
    DOMAIN,
    SERVICE_CREATE_CHIT,
    SERVICE_ADD_CHECKLIST_ITEM,
    SERVICE_UPDATE_CHIT,
    SERVICE_SET_CHIT_STATUS,
    SERVICE_ADD_TAG,
    SERVICE_REMOVE_TAG,
)

_LOGGER = logging.getLogger(__name__)


def _get_connection_info(hass: HomeAssistant) -> tuple[str, str, str, str]:
    """Extract CWOC connection info from stored config entry data.

    Returns (cwoc_url, session_token, username, password).
    Raises HomeAssistantError if no config entry is found.
    """
    if DOMAIN not in hass.data or not hass.data[DOMAIN]:
        raise HomeAssistantError("CWOC integration is not configured")

    entry_data = hass.data[DOMAIN]
    cwoc_url = entry_data.get("cwoc_url", "").rstrip("/")
    session_token = entry_data.get("session_token", "")
    username = entry_data.get("username", "")
    password = entry_data.get("password", "")

    if not cwoc_url:
        raise HomeAssistantError("CWOC URL is not configured")

    return cwoc_url, session_token, username, password


async def _re_authenticate(cwoc_url: str, username: str, password: str) -> str | None:
    """Re-authenticate with CWOC and return a new session token, or None on failure."""
    if not username or not password:
        return None

    url = f"{cwoc_url}/api/auth/login"
    payload = {"username": username, "password": password}

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                url,
                json=payload,
                timeout=aiohttp.ClientTimeout(total=10),
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    return data.get("token") or data.get("session_token")
    except Exception:
        pass

    return None


async def _cwoc_request(
    hass: HomeAssistant,
    method: str,
    path: str,
    json_data: dict | None = None,
) -> dict:
    """Make an authenticated request to the CWOC backend.

    Handles re-authentication on 401.
    Returns the JSON response dict.
    Raises HomeAssistantError on failure.
    """
    cwoc_url, session_token, username, password = _get_connection_info(hass)
    url = f"{cwoc_url}{path}"
    headers = {}

    if session_token:
        headers["Authorization"] = f"Bearer {session_token}"

    try:
        async with aiohttp.ClientSession() as session:
            async with session.request(
                method,
                url,
                json=json_data,
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=15),
            ) as resp:
                if resp.status == 401:
                    # Try re-authentication
                    new_token = await _re_authenticate(cwoc_url, username, password)
                    if new_token:
                        # Update stored token
                        hass.data[DOMAIN]["session_token"] = new_token
                        headers["Authorization"] = f"Bearer {new_token}"
                        async with session.request(
                            method,
                            url,
                            json=json_data,
                            headers=headers,
                            timeout=aiohttp.ClientTimeout(total=15),
                        ) as retry_resp:
                            if retry_resp.status >= 400:
                                text = await retry_resp.text()
                                raise HomeAssistantError(
                                    f"CWOC returned error {retry_resp.status}: {text}"
                                )
                            return await retry_resp.json()
                    else:
                        raise HomeAssistantError(
                            "CWOC authentication failed — please reconfigure the integration"
                        )

                if resp.status >= 400:
                    text = await resp.text()
                    raise HomeAssistantError(
                        f"CWOC returned error {resp.status}: {text}"
                    )

                return await resp.json()

    except HomeAssistantError:
        raise
    except aiohttp.ClientError as err:
        raise HomeAssistantError(f"Cannot connect to CWOC: {err}") from err
    except Exception as err:
        raise HomeAssistantError(f"Error communicating with CWOC: {err}") from err


async def _resolve_chit_id(
    hass: HomeAssistant,
    chit_id: str | None,
    chit_title: str | None,
) -> str:
    """Resolve a chit ID from either chit_id or chit_title.

    If chit_id is provided, returns it directly.
    If chit_title is provided, searches for the chit by title and returns
    the most recently modified match.
    Raises HomeAssistantError if neither is provided or chit not found.
    """
    if chit_id:
        return chit_id

    if not chit_title:
        raise HomeAssistantError(
            "Either chit_id or chit_title must be provided"
        )

    # Search for chit by title
    result = await _cwoc_request(
        hass,
        "GET",
        f"/api/chits?search={chit_title}",
    )

    # Result could be a list of chits or a dict with a "chits" key
    chits = result if isinstance(result, list) else result.get("chits", [])

    # Filter for exact title match
    matches = [c for c in chits if c.get("title") == chit_title]

    if not matches:
        # Try partial match as fallback
        matches = [
            c for c in chits
            if chit_title.lower() in (c.get("title") or "").lower()
        ]

    if not matches:
        raise HomeAssistantError(f"Chit not found with title: {chit_title}")

    # Return the most recently modified one
    matches.sort(
        key=lambda c: c.get("modified_datetime") or "",
        reverse=True,
    )
    return matches[0]["id"]


async def async_handle_create_chit(hass: HomeAssistant, call: ServiceCall) -> ServiceResponse:
    """Handle the create_chit service call."""
    title = call.data.get("title")
    if not title:
        raise HomeAssistantError("Title is required for create_chit")

    payload: dict = {"title": title}

    if note := call.data.get("note"):
        payload["note"] = note

    if tags := call.data.get("tags"):
        # Tags come as comma-separated string, convert to list
        payload["tags"] = [t.strip() for t in tags.split(",") if t.strip()]

    if status := call.data.get("status"):
        payload["status"] = status

    if priority := call.data.get("priority"):
        payload["priority"] = priority

    if due_datetime := call.data.get("due_datetime"):
        payload["due_datetime"] = due_datetime

    result = await _cwoc_request(hass, "POST", "/api/chits", json_data=payload)

    chit_id = result.get("id") or result.get("chit_id")
    _LOGGER.info("Created chit with ID: %s", chit_id)

    return {"chit_id": chit_id}


async def async_handle_add_checklist_item(hass: HomeAssistant, call: ServiceCall) -> None:
    """Handle the add_checklist_item service call."""
    item_text = call.data.get("item_text")
    if not item_text:
        raise HomeAssistantError("item_text is required for add_checklist_item")

    chit_id = await _resolve_chit_id(
        hass,
        call.data.get("chit_id"),
        call.data.get("chit_title"),
    )

    # First get the current chit to read existing checklist
    chit = await _cwoc_request(hass, "GET", f"/api/chits/{chit_id}")

    checklist = chit.get("checklist") or []
    if isinstance(checklist, str):
        import json
        try:
            checklist = json.loads(checklist)
        except (json.JSONDecodeError, TypeError):
            checklist = []

    # Append new item
    checklist.append({"text": item_text, "checked": False})

    # Update the chit with the new checklist
    await _cwoc_request(
        hass,
        "PUT",
        f"/api/chits/{chit_id}",
        json_data={"checklist": checklist},
    )

    _LOGGER.info("Added checklist item to chit %s: %s", chit_id, item_text)


async def async_handle_update_chit(hass: HomeAssistant, call: ServiceCall) -> None:
    """Handle the update_chit service call."""
    chit_id = call.data.get("chit_id")
    if not chit_id:
        raise HomeAssistantError("chit_id is required for update_chit")

    payload: dict = {}

    if "title" in call.data and call.data["title"]:
        payload["title"] = call.data["title"]

    if "note" in call.data and call.data["note"]:
        payload["note"] = call.data["note"]

    if "status" in call.data and call.data["status"]:
        payload["status"] = call.data["status"]

    if "priority" in call.data and call.data["priority"]:
        payload["priority"] = call.data["priority"]

    if not payload:
        raise HomeAssistantError("No fields to update provided")

    await _cwoc_request(
        hass,
        "PUT",
        f"/api/chits/{chit_id}",
        json_data=payload,
    )

    _LOGGER.info("Updated chit %s with fields: %s", chit_id, list(payload.keys()))


async def async_handle_set_chit_status(hass: HomeAssistant, call: ServiceCall) -> None:
    """Handle the set_chit_status service call."""
    status = call.data.get("status")
    if not status:
        raise HomeAssistantError("status is required for set_chit_status")

    chit_id = await _resolve_chit_id(
        hass,
        call.data.get("chit_id"),
        call.data.get("chit_title"),
    )

    await _cwoc_request(
        hass,
        "PUT",
        f"/api/chits/{chit_id}",
        json_data={"status": status},
    )

    _LOGGER.info("Set chit %s status to: %s", chit_id, status)


async def async_handle_add_tag(hass: HomeAssistant, call: ServiceCall) -> None:
    """Handle the add_tag service call."""
    tag = call.data.get("tag")
    if not tag:
        raise HomeAssistantError("tag is required for add_tag")

    chit_id = await _resolve_chit_id(
        hass,
        call.data.get("chit_id"),
        call.data.get("chit_title"),
    )

    # Get current chit to read existing tags
    chit = await _cwoc_request(hass, "GET", f"/api/chits/{chit_id}")

    tags = chit.get("tags") or []
    if isinstance(tags, str):
        import json
        try:
            tags = json.loads(tags)
        except (json.JSONDecodeError, TypeError):
            tags = []

    # Add tag if not already present
    if tag not in tags:
        tags.append(tag)
        await _cwoc_request(
            hass,
            "PUT",
            f"/api/chits/{chit_id}",
            json_data={"tags": tags},
        )
        _LOGGER.info("Added tag '%s' to chit %s", tag, chit_id)
    else:
        _LOGGER.debug("Tag '%s' already exists on chit %s", tag, chit_id)


async def async_handle_remove_tag(hass: HomeAssistant, call: ServiceCall) -> None:
    """Handle the remove_tag service call."""
    tag = call.data.get("tag")
    if not tag:
        raise HomeAssistantError("tag is required for remove_tag")

    chit_id = await _resolve_chit_id(
        hass,
        call.data.get("chit_id"),
        call.data.get("chit_title"),
    )

    # Get current chit to read existing tags
    chit = await _cwoc_request(hass, "GET", f"/api/chits/{chit_id}")

    tags = chit.get("tags") or []
    if isinstance(tags, str):
        import json
        try:
            tags = json.loads(tags)
        except (json.JSONDecodeError, TypeError):
            tags = []

    # Remove tag if present
    if tag in tags:
        tags.remove(tag)
        await _cwoc_request(
            hass,
            "PUT",
            f"/api/chits/{chit_id}",
            json_data={"tags": tags},
        )
        _LOGGER.info("Removed tag '%s' from chit %s", tag, chit_id)
    else:
        _LOGGER.debug("Tag '%s' not found on chit %s", tag, chit_id)


async def async_register_services(hass: HomeAssistant, entry) -> None:
    """Register all CWOC service handlers.

    Stores the config entry data in hass.data[DOMAIN] for service handlers to access.
    """
    # Store connection info for service handlers
    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN].update({
        "cwoc_url": entry.data.get("cwoc_url", "").rstrip("/"),
        "session_token": entry.data.get("session_token", ""),
        "username": entry.data.get("username", ""),
        "password": entry.data.get("password", ""),
    })

    # Only register services once (they're domain-wide, not per-entry)
    if hass.services.has_service(DOMAIN, SERVICE_CREATE_CHIT):
        return

    # Register create_chit with response support
    hass.services.async_register(
        DOMAIN,
        SERVICE_CREATE_CHIT,
        lambda call: async_handle_create_chit(hass, call),
        supports_response=SupportsResponse.OPTIONAL,
    )

    hass.services.async_register(
        DOMAIN,
        SERVICE_ADD_CHECKLIST_ITEM,
        lambda call: async_handle_add_checklist_item(hass, call),
    )

    hass.services.async_register(
        DOMAIN,
        SERVICE_UPDATE_CHIT,
        lambda call: async_handle_update_chit(hass, call),
    )

    hass.services.async_register(
        DOMAIN,
        SERVICE_SET_CHIT_STATUS,
        lambda call: async_handle_set_chit_status(hass, call),
    )

    hass.services.async_register(
        DOMAIN,
        SERVICE_ADD_TAG,
        lambda call: async_handle_add_tag(hass, call),
    )

    hass.services.async_register(
        DOMAIN,
        SERVICE_REMOVE_TAG,
        lambda call: async_handle_remove_tag(hass, call),
    )

    _LOGGER.info("Registered CWOC services")
