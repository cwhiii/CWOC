"""Home Assistant API routes for the CWOC backend.

Provides the stats endpoint for HA DataUpdateCoordinator polling,
and will be expanded with config, proxy, and webhook endpoints.
"""

import json
import logging
import sqlite3
from datetime import datetime

from fastapi import APIRouter, HTTPException, Request

from src.backend.db import DB_PATH


logger = logging.getLogger(__name__)
ha_router = APIRouter(prefix="/api/ha")


# ═══════════════════════════════════════════════════════════════════════════
# Authentication helper
# ═══════════════════════════════════════════════════════════════════════════

def _get_authenticated_user_id(request: Request) -> str:
    """Get the authenticated user ID from request state or Bearer token.

    The middleware handles session cookie auth and sets request.state.user_id.
    This helper also supports Bearer token auth (session token in Authorization
    header) for the HA DataUpdateCoordinator which stores the session token.

    Returns the user_id or raises HTTPException 401.
    """
    # First check if middleware already authenticated via cookie
    user_id = getattr(request.state, "user_id", None)
    if user_id:
        return user_id

    # Fall back to Bearer token (same session token, just passed in header)
    auth_header = request.headers.get("authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:].strip()
        if token:
            conn = None
            try:
                conn = sqlite3.connect(DB_PATH)
                conn.row_factory = sqlite3.Row
                row = conn.execute(
                    "SELECT s.user_id, s.expires_datetime, s.last_active_datetime, u.is_active "
                    "FROM sessions s JOIN users u ON s.user_id = u.id "
                    "WHERE s.token = ?",
                    (token,),
                ).fetchone()
                if row and row["is_active"]:
                    expires = datetime.fromisoformat(row["expires_datetime"].replace("Z", ""))
                    if datetime.utcnow() < expires:
                        return row["user_id"]
            except Exception as e:
                logger.error(f"Bearer token auth error: {e}")
            finally:
                if conn:
                    conn.close()

    raise HTTPException(status_code=401, detail="Authentication required")


# ═══════════════════════════════════════════════════════════════════════════
# GET /api/ha/stats — Aggregated chit counts for DataUpdateCoordinator
# ═══════════════════════════════════════════════════════════════════════════

@ha_router.get("/stats")
def get_stats(request: Request):
    """Return aggregated chit statistics for the authenticated user.

    Used by the HA DataUpdateCoordinator to poll a single endpoint for all
    sensor data. Returns total_chits, status counts, overdue, inbox, and
    per-tag counts (user-defined tags only, excluding CWOC_System/ prefix).
    """
    user_id = _get_authenticated_user_id(request)

    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # Query all non-deleted chits for this user
        cursor.execute(
            "SELECT status, tags, due_datetime, email_read, email_status "
            "FROM chits WHERE (deleted = 0 OR deleted IS NULL) AND owner_id = ?",
            (user_id,),
        )
        rows = cursor.fetchall()

        now = datetime.utcnow()

        total_chits = 0
        todo_count = 0
        in_progress_count = 0
        blocked_count = 0
        complete_count = 0
        overdue_count = 0
        inbox_count = 0
        tag_counts: dict = {}

        for row in rows:
            total_chits += 1
            status = row["status"] or ""

            # Status counts
            if status == "ToDo":
                todo_count += 1
            elif status == "In Progress":
                in_progress_count += 1
            elif status == "Blocked":
                blocked_count += 1
            elif status == "Complete":
                complete_count += 1

            # Overdue: non-complete with past due_datetime
            due_dt = row["due_datetime"]
            if due_dt and status != "Complete":
                try:
                    due_parsed = datetime.fromisoformat(due_dt.replace("Z", ""))
                    if due_parsed < now:
                        overdue_count += 1
                except (ValueError, TypeError):
                    pass

            # Inbox: unread received emails
            email_read = row["email_read"]
            email_status = row["email_status"]
            if email_status == "received" and not email_read:
                inbox_count += 1

            # Tag counts (user-defined only, exclude CWOC_System/ prefix)
            tags_raw = row["tags"]
            if tags_raw:
                try:
                    tags_list = json.loads(tags_raw) if isinstance(tags_raw, str) else tags_raw
                    if isinstance(tags_list, list):
                        for tag in tags_list:
                            tag_name = tag if isinstance(tag, str) else (tag.get("name", "") if isinstance(tag, dict) else "")
                            if tag_name and not tag_name.startswith("CWOC_System/"):
                                tag_counts[tag_name] = tag_counts.get(tag_name, 0) + 1
                except (json.JSONDecodeError, TypeError):
                    pass

        return {
            "total_chits": total_chits,
            "todo_count": todo_count,
            "in_progress_count": in_progress_count,
            "blocked_count": blocked_count,
            "complete_count": complete_count,
            "overdue_count": overdue_count,
            "inbox_count": inbox_count,
            "tag_counts": tag_counts,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Stats computation error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to compute stats: {e}")
    finally:
        if conn:
            conn.close()

# ═══════════════════════════════════════════════════════════════════════════
# Imports for remaining endpoints
# ═══════════════════════════════════════════════════════════════════════════

import time
from uuid import uuid4

from src.backend.models import HAConfigUpdate, HAWebhookPayload
from src.backend.routes.email import _encrypt_password
from src.backend import ha_bridge


# ═══════════════════════════════════════════════════════════════════════════
# In-memory proxy cache (60s TTL)
# ═══════════════════════════════════════════════════════════════════════════

_proxy_cache: dict = {}  # key → {"data": ..., "timestamp": float}
_CACHE_TTL = 60  # seconds


def _get_cached(key: str):
    """Return cached data if within TTL, else None."""
    entry = _proxy_cache.get(key)
    if entry and (time.time() - entry["timestamp"]) < _CACHE_TTL:
        return entry["data"]
    return None


def _set_cached(key: str, data):
    """Store data in cache with current timestamp."""
    _proxy_cache[key] = {"data": data, "timestamp": time.time()}


# ═══════════════════════════════════════════════════════════════════════════
# Admin check helper
# ═══════════════════════════════════════════════════════════════════════════

def _require_admin(user_id: str):
    """Check if user_id is an admin. Raises HTTPException 403 if not."""
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        row = conn.execute(
            "SELECT is_admin FROM users WHERE id = ?", (user_id,)
        ).fetchone()
        if not row or not row["is_admin"]:
            raise HTTPException(status_code=403, detail="Admin access required")
    finally:
        if conn:
            conn.close()


# ═══════════════════════════════════════════════════════════════════════════
# POST /api/ha/config — Save HA config (admin-only)
# ═══════════════════════════════════════════════════════════════════════════

@ha_router.post("/config")
def save_ha_config(request: Request, config_update: HAConfigUpdate):
    """Save HA configuration. Admin-only. Encrypts token before storage."""
    user_id = _get_authenticated_user_id(request)
    _require_admin(user_id)

    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # Build update fields
        updates = []
        params = []

        if config_update.ha_base_url is not None:
            # Basic URL validation
            url = config_update.ha_base_url.strip()
            if url and not (url.startswith("http://") or url.startswith("https://")):
                raise HTTPException(status_code=400, detail="Invalid HA base URL")
            updates.append("ha_base_url = ?")
            params.append(url)

        if config_update.ha_access_token is not None:
            # Encrypt the token before storage
            token = config_update.ha_access_token.strip()
            if token:
                encrypted = _encrypt_password(token)
                updates.append("ha_access_token = ?")
                params.append(encrypted)
            else:
                updates.append("ha_access_token = ?")
                params.append("")

        if config_update.ha_poll_interval is not None:
            updates.append("ha_poll_interval = ?")
            params.append(config_update.ha_poll_interval)

        # Always update configured_by and modified_datetime
        updates.append("configured_by = ?")
        params.append(user_id)
        updates.append("modified_datetime = ?")
        params.append(datetime.utcnow().isoformat())

        if updates:
            sql = f"UPDATE ha_config SET {', '.join(updates)} WHERE id = 1"
            cursor.execute(sql, params)
            conn.commit()

        return {"success": True, "message": "HA configuration saved"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to save HA config: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save HA config: {e}")
    finally:
        if conn:
            conn.close()


# ═══════════════════════════════════════════════════════════════════════════
# GET /api/ha/config — Get HA config with masked token (admin-only)
# ═══════════════════════════════════════════════════════════════════════════

@ha_router.get("/config")
def get_ha_config_endpoint(request: Request):
    """Return HA configuration with masked token. Admin-only."""
    user_id = _get_authenticated_user_id(request)
    _require_admin(user_id)

    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        row = conn.execute("SELECT * FROM ha_config WHERE id = 1").fetchone()

        if not row:
            return {
                "ha_base_url": "",
                "ha_access_token_masked": "",
                "ha_webhook_secret": "",
                "ha_poll_interval": 30,
                "configured_by": None,
                "modified_datetime": None,
            }

        config = dict(row)
        # Mask the token
        token = config.get("ha_access_token", "")
        if token:
            masked = token[:4] + "****" + token[-4:] if len(token) > 8 else "****"
        else:
            masked = ""

        return {
            "ha_base_url": config.get("ha_base_url", ""),
            "ha_access_token_masked": masked,
            "ha_webhook_secret": config.get("ha_webhook_secret", ""),
            "ha_poll_interval": config.get("ha_poll_interval", 30),
            "configured_by": config.get("configured_by"),
            "modified_datetime": config.get("modified_datetime"),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get HA config: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get HA config: {e}")
    finally:
        if conn:
            conn.close()


# ═══════════════════════════════════════════════════════════════════════════
# POST /api/ha/config/test — Test HA connection (admin-only)
# ═══════════════════════════════════════════════════════════════════════════

@ha_router.post("/config/test")
def test_ha_connection_endpoint(request: Request):
    """Test connection to Home Assistant. Admin-only."""
    user_id = _get_authenticated_user_id(request)
    _require_admin(user_id)

    # Read current config from DB
    config = ha_bridge.get_ha_config()
    if not config or not config.get("ha_base_url") or not config.get("ha_access_token_decrypted"):
        return {"success": False, "message": "HA not configured — save URL and token first"}

    result = ha_bridge.test_ha_connection(
        config["ha_base_url"],
        config["ha_access_token_decrypted"],
    )
    return result


# ═══════════════════════════════════════════════════════════════════════════
# POST /api/ha/config/regenerate-webhook — Regenerate webhook secret (admin-only)
# ═══════════════════════════════════════════════════════════════════════════

@ha_router.post("/config/regenerate-webhook")
def regenerate_webhook_secret(request: Request):
    """Regenerate the webhook secret UUID. Admin-only."""
    user_id = _get_authenticated_user_id(request)
    _require_admin(user_id)

    new_secret = str(uuid4())
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.execute(
            "UPDATE ha_config SET ha_webhook_secret = ?, modified_datetime = ? WHERE id = 1",
            (new_secret, datetime.utcnow().isoformat()),
        )
        conn.commit()
        return {"success": True, "ha_webhook_secret": new_secret}
    except Exception as e:
        logger.error(f"Failed to regenerate webhook secret: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to regenerate webhook secret: {e}")
    finally:
        if conn:
            conn.close()


# ═══════════════════════════════════════════════════════════════════════════
# GET /api/ha/entities — Proxy to HA /api/states (60s cache)
# ═══════════════════════════════════════════════════════════════════════════

@ha_router.get("/entities")
def get_entities(request: Request):
    """Proxy to HA /api/states with 60s cache. Returns simplified entity list."""
    _get_authenticated_user_id(request)

    if not ha_bridge.is_ha_configured():
        raise HTTPException(status_code=400, detail="Home Assistant is not configured")

    # Check cache
    cached = _get_cached("entities")
    if cached is not None:
        return cached

    entities = ha_bridge.get_ha_entities()
    if entities is None:
        raise HTTPException(status_code=502, detail="Cannot reach Home Assistant")

    # Even an empty list is a valid response (HA might have no entities)
    _set_cached("entities", entities)
    return entities


# ═══════════════════════════════════════════════════════════════════════════
# GET /api/ha/services — Proxy to HA /api/services (60s cache)
# ═══════════════════════════════════════════════════════════════════════════

@ha_router.get("/services")
def get_services(request: Request):
    """Proxy to HA /api/services with 60s cache."""
    _get_authenticated_user_id(request)

    if not ha_bridge.is_ha_configured():
        raise HTTPException(status_code=400, detail="Home Assistant is not configured")

    # Check cache
    cached = _get_cached("services")
    if cached is not None:
        return cached

    services = ha_bridge.get_ha_services()
    if services is None:
        raise HTTPException(status_code=502, detail="Cannot reach Home Assistant")

    _set_cached("services", services)
    return services


# ═══════════════════════════════════════════════════════════════════════════
# POST /api/ha/webhook — Inbound webhook from HA automations
# ═══════════════════════════════════════════════════════════════════════════

def _validate_webhook_token(request: Request) -> str:
    """Validate webhook token from query param or Authorization header.

    Returns the ha_config's configured_by user_id if valid.
    Raises HTTPException 401 if invalid.
    """
    # Get token from query param or Authorization header
    token = request.query_params.get("token", "")
    if not token:
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:].strip()

    if not token:
        raise HTTPException(status_code=401, detail="Invalid or missing webhook token")

    # Validate against stored webhook secret
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        row = conn.execute(
            "SELECT ha_webhook_secret, configured_by FROM ha_config WHERE id = 1"
        ).fetchone()

        if not row:
            raise HTTPException(status_code=401, detail="Invalid or missing webhook token")

        stored_secret = row["ha_webhook_secret"]
        if not stored_secret or token != stored_secret:
            raise HTTPException(status_code=401, detail="Invalid or missing webhook token")

        return row["configured_by"] or ""
    finally:
        if conn:
            conn.close()


def _resolve_webhook_user(payload: HAWebhookPayload, default_user_id: str) -> str:
    """Resolve the target user_id from webhook payload.

    If user_id is provided and non-empty, use it. Otherwise use configured_by admin.
    """
    if payload.user_id and payload.user_id.strip():
        return payload.user_id.strip()
    return default_user_id


def _find_chit_by_id_or_title(chit_id: str = None, chit_title: str = None, owner_id: str = None) -> dict:
    """Look up a chit by chit_id or chit_title. Returns chit dict or raises 404."""
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row

        if chit_id:
            row = conn.execute(
                "SELECT * FROM chits WHERE id = ? AND (deleted = 0 OR deleted IS NULL)",
                (chit_id,),
            ).fetchone()
        elif chit_title and owner_id:
            # Search by title, return most recently modified
            row = conn.execute(
                "SELECT * FROM chits WHERE title = ? AND owner_id = ? "
                "AND (deleted = 0 OR deleted IS NULL) "
                "ORDER BY modified_datetime DESC LIMIT 1",
                (chit_title, owner_id),
            ).fetchone()
        else:
            raise HTTPException(status_code=400, detail="Must provide chit_id or chit_title")

        if not row:
            identifier = chit_id or chit_title
            raise HTTPException(status_code=404, detail=f"Chit not found: {identifier}")

        return dict(row)
    finally:
        if conn:
            conn.close()


@ha_router.post("/webhook")
def handle_webhook(request: Request, payload: HAWebhookPayload):
    """Process inbound webhook from HA automations.

    Token-authenticated via query param or Authorization header.
    Supports actions: create_chit, add_checklist_item, update_chit, trigger_rule.
    """
    # Validate webhook token
    configured_by = _validate_webhook_token(request)

    # Validate action field
    if not payload.action:
        raise HTTPException(status_code=400, detail="Missing required field: action")

    # Resolve target user
    user_id = _resolve_webhook_user(payload, configured_by)

    try:
        if payload.action == "create_chit":
            return _webhook_create_chit(payload, user_id)
        elif payload.action == "add_checklist_item":
            return _webhook_add_checklist_item(payload, user_id)
        elif payload.action == "update_chit":
            return _webhook_update_chit(payload, user_id)
        elif payload.action == "trigger_rule":
            return _webhook_trigger_rule(payload, user_id)
        else:
            raise HTTPException(status_code=400, detail=f"Unknown action: {payload.action}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Webhook processing failed: {e}")
        raise HTTPException(status_code=500, detail=f"Webhook processing failed: {e}")


# ── Webhook action handlers ──────────────────────────────────────────────

def _webhook_create_chit(payload: HAWebhookPayload, user_id: str) -> dict:
    """Create a new chit from webhook payload."""
    if not payload.title:
        raise HTTPException(
            status_code=400, detail="Action create_chit requires: title"
        )

    chit_id = str(uuid4())
    now = datetime.utcnow().isoformat()

    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # Serialize tags and checklist
        tags_json = json.dumps(payload.tags) if payload.tags else None
        checklist_json = json.dumps(payload.checklist) if payload.checklist else None

        cursor.execute(
            """INSERT INTO chits (id, owner_id, title, note, tags, status, priority,
               due_datetime, checklist, created_datetime, modified_datetime, deleted)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)""",
            (
                chit_id,
                user_id,
                payload.title,
                payload.note or "",
                tags_json,
                payload.status or "ToDo",
                payload.priority or "",
                payload.due_datetime,
                checklist_json,
                now,
                now,
            ),
        )
        conn.commit()

        return {"success": True, "chit_id": chit_id, "message": "Chit created"}
    finally:
        if conn:
            conn.close()


def _webhook_add_checklist_item(payload: HAWebhookPayload, user_id: str) -> dict:
    """Add a checklist item to an existing chit."""
    if not payload.item_text:
        raise HTTPException(
            status_code=400,
            detail="Action add_checklist_item requires: item_text",
        )
    if not payload.chit_id and not payload.chit_title:
        raise HTTPException(
            status_code=400,
            detail="Action add_checklist_item requires: chit_id or chit_title",
        )

    chit = _find_chit_by_id_or_title(payload.chit_id, payload.chit_title, user_id)
    chit_id = chit["id"]

    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # Get current checklist
        row = cursor.execute(
            "SELECT checklist FROM chits WHERE id = ?", (chit_id,)
        ).fetchone()

        checklist_raw = row["checklist"] if row else None
        checklist = []
        if checklist_raw:
            try:
                checklist = json.loads(checklist_raw) if isinstance(checklist_raw, str) else checklist_raw
            except (json.JSONDecodeError, TypeError):
                checklist = []

        if not isinstance(checklist, list):
            checklist = []

        # Append new item
        new_item = {
            "id": str(uuid4()),
            "text": payload.item_text,
            "checked": False,
        }
        checklist.append(new_item)

        # Update chit
        now = datetime.utcnow().isoformat()
        cursor.execute(
            "UPDATE chits SET checklist = ?, modified_datetime = ? WHERE id = ?",
            (json.dumps(checklist), now, chit_id),
        )
        conn.commit()

        return {"success": True, "chit_id": chit_id, "message": "Checklist item added"}
    finally:
        if conn:
            conn.close()


def _webhook_update_chit(payload: HAWebhookPayload, user_id: str) -> dict:
    """Update fields on an existing chit."""
    if not payload.chit_id:
        raise HTTPException(
            status_code=400, detail="Action update_chit requires: chit_id"
        )

    chit = _find_chit_by_id_or_title(payload.chit_id, None, user_id)
    chit_id = chit["id"]

    # Determine which fields to update
    updates = []
    params = []

    # Check explicit fields from payload
    if payload.title is not None:
        updates.append("title = ?")
        params.append(payload.title)
    if payload.note is not None:
        updates.append("note = ?")
        params.append(payload.note)
    if payload.status is not None:
        updates.append("status = ?")
        params.append(payload.status)
    if payload.priority is not None:
        updates.append("priority = ?")
        params.append(payload.priority)
    if payload.due_datetime is not None:
        updates.append("due_datetime = ?")
        params.append(payload.due_datetime)
    if payload.tags is not None:
        updates.append("tags = ?")
        params.append(json.dumps(payload.tags))
    if payload.checklist is not None:
        updates.append("checklist = ?")
        params.append(json.dumps(payload.checklist))

    # Also handle arbitrary fields dict
    if payload.fields:
        for field_name, field_value in payload.fields.items():
            # Serialize lists/dicts as JSON
            if isinstance(field_value, (list, dict)):
                updates.append(f"{field_name} = ?")
                params.append(json.dumps(field_value))
            else:
                updates.append(f"{field_name} = ?")
                params.append(field_value)

    if not updates:
        return {"success": True, "chit_id": chit_id, "message": "No fields to update"}

    # Always update modified_datetime
    now = datetime.utcnow().isoformat()
    updates.append("modified_datetime = ?")
    params.append(now)
    params.append(chit_id)

    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        sql = f"UPDATE chits SET {', '.join(updates)} WHERE id = ?"
        conn.execute(sql, params)
        conn.commit()

        return {"success": True, "chit_id": chit_id, "message": "Chit updated"}
    except Exception as e:
        logger.error(f"Failed to update chit {chit_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Webhook processing failed: {e}")
    finally:
        if conn:
            conn.close()


def _webhook_trigger_rule(payload: HAWebhookPayload, user_id: str) -> dict:
    """Fire the trigger dispatcher with ha_webhook trigger type."""
    import threading
    from src.backend.rules_engine import dispatch_trigger

    # Build entity dict from the full payload
    entity_dict = {
        "action": payload.action,
        "user_id": payload.user_id,
        "chit_id": payload.chit_id,
        "chit_title": payload.chit_title,
        "title": payload.title,
        "note": payload.note,
        "tags": payload.tags,
        "status": payload.status,
        "priority": payload.priority,
        "due_datetime": payload.due_datetime,
        "item_text": payload.item_text,
    }

    # Include payload dict if provided
    if payload.payload:
        entity_dict.update(payload.payload)

    # Remove None values for cleaner entity dict
    entity_dict = {k: v for k, v in entity_dict.items() if v is not None}

    # Ensure there's an id field for the trigger dispatcher
    if "id" not in entity_dict:
        entity_dict["id"] = payload.chit_id or str(uuid4())

    # Fire trigger in background thread
    threading.Thread(
        target=dispatch_trigger,
        args=("ha_webhook", "chit", entity_dict, user_id),
        daemon=True,
    ).start()

    return {"success": True, "message": "Trigger dispatched"}
