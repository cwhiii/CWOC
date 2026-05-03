"""Ntfy push notification sender module for the CWOC backend.

Encapsulates all Ntfy notification logic: topic generation, config retrieval,
HTTP POST delivery, and API endpoints for status/test/save validation.

Functions:
  get_ntfy_topic(user_id)           — deterministic topic from user UUID
  get_ntfy_config()                 — read ntfy provider config from DB
  send_ntfy_notification(...)       — send notification via HTTP POST

Routes:
  GET  /api/network-access/ntfy/status  — check ntfy service reachability
  POST /api/network-access/ntfy/test    — send test notification to user's topic
  POST /api/network-access/ntfy         — save ntfy config (with URL validation)
"""

import json
import logging
import sqlite3
import time
import urllib.request
import urllib.error

from fastapi import APIRouter, HTTPException, Request

from src.backend.db import DB_PATH
from src.backend.routes.audit import get_actor_from_request, insert_audit_entry


logger = logging.getLogger(__name__)
ntfy_router = APIRouter(tags=["ntfy"])


# ═══════════════════════════════════════════════════════════════════════════
# Topic Generation
# ═══════════════════════════════════════════════════════════════════════════

def get_ntfy_topic(user_id: str) -> str:
    """Return deterministic topic: 'cwoc-' + first 12 alphanumeric chars of user_id.

    Hyphens and other non-alphanumeric characters are stripped before taking
    the first 12 characters. If the user_id has fewer than 12 alphanumeric
    characters, all available characters are used.

    Args:
        user_id: The user's UUID string.

    Returns:
        A topic string like 'cwoc-a1b2c3d4e5f6'.
    """
    alphanumeric = "".join(c for c in user_id if c.isalnum())
    return "cwoc-" + alphanumeric[:12]


# ═══════════════════════════════════════════════════════════════════════════
# Config Retrieval
# ═══════════════════════════════════════════════════════════════════════════

def get_ntfy_config() -> dict:
    """Read ntfy provider config from the network_access table.

    Returns:
        dict with 'enabled' (bool) and 'server_url' (str).
        Defaults to {'enabled': False, 'server_url': 'http://localhost:2586'}
        if not configured or on error.
    """
    default = {"enabled": False, "server_url": "http://localhost:2586"}
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        row = conn.execute(
            "SELECT enabled, config FROM network_access WHERE provider = ?",
            ("ntfy",),
        ).fetchone()

        if row is None:
            return default

        enabled = bool(row["enabled"])
        config = {}
        if row["config"]:
            try:
                config = json.loads(row["config"])
            except (json.JSONDecodeError, TypeError):
                pass

        server_url = config.get("server_url", "http://localhost:2586")
        return {"enabled": enabled, "server_url": server_url}

    except Exception as e:
        logger.error(f"Error reading ntfy config: {e}")
        return default
    finally:
        if conn:
            conn.close()


# ═══════════════════════════════════════════════════════════════════════════
# Notification Sending
# ═══════════════════════════════════════════════════════════════════════════

def send_ntfy_notification(user_id: str, title: str, body: str,
                           click_url: str = None, tags: str = None,
                           priority: int = None, icon_url: str = None,
                           actions: str = None, attach_url: str = None) -> dict:
    """Send a notification via HTTP POST to the ntfy server.

    Reads config from the network_access table on each call so that
    configuration changes take effect immediately without server restart.

    Args:
        user_id:    Target user's UUID (used to compute topic).
        title:      Notification title (X-Title header).
        body:       Notification body (POST request body).
        click_url:  Optional URL to open on tap (X-Click header).
        tags:       Optional comma-separated emoji tags (X-Tags header).
        priority:   Optional priority 1-5 (X-Priority header). 5=max/urgent, 4=high, 3=default.
        icon_url:   Optional URL to notification icon (X-Icon header).
        actions:    Optional X-Actions header string for action buttons (up to 3).
        attach_url: Optional URL to attach as image (X-Attach header). Shows as large image.

    Returns:
        {'sent': True, 'topic': str} on success.
        {'sent': False, 'reason': str} on skip or failure.
    """
    # Read config fresh each time
    config = get_ntfy_config()

    if not config.get("enabled"):
        return {"sent": False, "reason": "ntfy is not enabled"}

    server_url = config.get("server_url", "http://localhost:2586")
    topic = get_ntfy_topic(user_id)
    url = f"{server_url.rstrip('/')}/{topic}"

    try:
        data = body.encode("utf-8") if body else b""
        req = urllib.request.Request(url, data=data, method="POST")

        # Ntfy supports UTF-8 in headers, but Python's urllib encodes as latin-1.
        # Use RFC 2047 base64 encoding for non-ASCII characters (emojis, etc.)
        import base64 as _b64
        try:
            title.encode("latin-1")
            req.add_header("X-Title", title)
        except UnicodeEncodeError:
            encoded_title = "=?UTF-8?B?" + _b64.b64encode(title.encode("utf-8")).decode("ascii") + "?="
            req.add_header("X-Title", encoded_title)

        # Add a unique message ID to help with deduplication if the user
        # has multiple subscriptions pointing to the same server
        import hashlib
        msg_id = hashlib.sha256(
            f"{topic}:{title}:{body}:{int(time.time())}".encode()
        ).hexdigest()[:12]
        req.add_header("X-Id", msg_id)

        if tags:
            req.add_header("X-Tags", tags)
        if click_url:
            try:
                click_url.encode("latin-1")
                req.add_header("X-Click", click_url)
            except UnicodeEncodeError:
                req.add_header("X-Click", click_url.encode("utf-8").decode("ascii", errors="ignore"))
        if priority:
            req.add_header("X-Priority", str(priority))
        if icon_url:
            req.add_header("X-Icon", icon_url)
        if actions:
            req.add_header("X-Actions", actions)
        if attach_url:
            req.add_header("X-Attach", attach_url)

        with urllib.request.urlopen(req, timeout=10) as resp:
            status_code = resp.getcode()
            if 200 <= status_code < 300:
                logger.info(f"Ntfy notification sent to topic {topic}")
                return {"sent": True, "topic": topic}
            else:
                reason = f"ntfy returned HTTP {status_code}"
                logger.warning(reason)
                return {"sent": False, "reason": reason}

    except urllib.error.HTTPError as e:
        reason = f"ntfy HTTP error: {e.code}"
        logger.warning(reason)
        return {"sent": False, "reason": reason}
    except urllib.error.URLError as e:
        reason = f"ntfy unreachable: {e.reason}"
        logger.warning(reason)
        return {"sent": False, "reason": reason}
    except Exception as e:
        reason = f"ntfy send error: {e}"
        logger.warning(reason)
        return {"sent": False, "reason": reason}


def get_user_snooze_minutes(user_id: str) -> int:
    """Read the user's snooze_length setting and return it as minutes.

    Parses strings like '5 minutes', '10 minutes', '1 hour', '30 seconds'.
    Defaults to 5 minutes if not set or unparseable.
    """
    import re
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        row = conn.execute(
            "SELECT snooze_length FROM settings WHERE user_id = ?",
            (user_id,),
        ).fetchone()
        if not row or not row["snooze_length"]:
            return 5

        s = row["snooze_length"]
        match = re.match(r"(\d+)\s*(minute|hour|second)", s, re.IGNORECASE)
        if not match:
            return 5

        val = int(match.group(1))
        unit = match.group(2).lower()
        if unit.startswith("hour"):
            return val * 60
        elif unit.startswith("second"):
            return max(1, val // 60)  # at least 1 minute
        else:
            return val
    except Exception:
        return 5
    finally:
        if conn:
            conn.close()


def build_ntfy_actions(base_url: str, chit_id: str = None, source_type: str = "chit",
                       snooze_minutes: int = 5) -> str:
    """Build the X-Actions header string with up to 3 action buttons.

    Actions (all 'view' type — opens in browser where user is already logged in):
      1. Open — opens the chit editor or Alarms tab
      2. Snooze — opens a snooze URL that triggers the snooze flow
      3. Dismiss — clears the notification (clear=true, no URL needed)

    Args:
        base_url:       Server base URL (e.g. http://192.168.1.111:3333)
        chit_id:        Chit UUID (for chit-based alerts) or None
        source_type:    'chit' or 'independent'
        snooze_minutes: Snooze duration from user settings

    Returns:
        X-Actions header string with semicolon-separated actions.
    """
    actions = []

    # Button 1: Open
    if source_type == "chit" and chit_id:
        open_url = f"{base_url}/frontend/html/editor.html?id={chit_id}"
        actions.append(f"view, Open, {open_url}, clear=true")
    else:
        open_url = f"{base_url}/?tab=Alarms&view=independent"
        actions.append(f"view, Open, {open_url}, clear=true")

    # Button 2: Snooze
    snooze_label = f"Snooze {snooze_minutes}m" if snooze_minutes < 60 else f"Snooze {snooze_minutes // 60}h"
    # Snooze opens the dashboard which will handle the snooze via the alert system
    if source_type == "chit" and chit_id:
        snooze_url = f"{base_url}/?tab=Alarms&snooze={chit_id}&mins={snooze_minutes}"
    else:
        snooze_url = f"{base_url}/?tab=Alarms&view=independent&snooze=true&mins={snooze_minutes}"
    actions.append(f"view, {snooze_label}, {snooze_url}, clear=true")

    # Button 3: Dismiss (just clears the notification)
    actions.append(f"view, Dismiss, {base_url}/, clear=true")

    return "; ".join(actions)


# ═══════════════════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════════════════

def _utcnow_iso() -> str:
    """Return current UTC time as ISO 8601 string with Z suffix."""
    from datetime import datetime
    return datetime.utcnow().isoformat() + "Z"


def _require_admin(request: Request) -> str:
    """Check that the requesting user is an admin. Return user_id if so, raise 403 otherwise."""
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        row = conn.execute(
            "SELECT is_admin FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()

        if row is None:
            raise HTTPException(status_code=401, detail="Authentication required")

        if not row["is_admin"]:
            raise HTTPException(status_code=403, detail="Admin access required")

        return user_id
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Admin check error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        if conn:
            conn.close()


def _auto_enable_ntfy(server_url: str):
    """Ensure ntfy is enabled in the network_access table with the given server_url.

    Called when the status check confirms the ntfy service is reachable.
    Creates or updates the ntfy provider row with enabled=1.
    """
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        now = _utcnow_iso()

        existing = conn.execute(
            "SELECT id, enabled, created_datetime FROM network_access WHERE provider = ?",
            ("ntfy",),
        ).fetchone()

        if existing and existing["enabled"]:
            # Already enabled — nothing to do
            conn.close()
            return

        config_json = json.dumps({"server_url": server_url})

        if existing:
            conn.execute(
                "UPDATE network_access SET enabled = 1, config = ?, modified_datetime = ? WHERE provider = ?",
                (config_json, now, "ntfy"),
            )
        else:
            from uuid import uuid4
            conn.execute(
                """INSERT INTO network_access (id, provider, enabled, config, created_datetime, modified_datetime)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (str(uuid4()), "ntfy", 1, config_json, now, now),
            )

        conn.commit()
        logger.info("Ntfy auto-enabled in network_access table")
    except Exception as e:
        logger.error(f"Failed to auto-enable ntfy: {e}")
    finally:
        if conn:
            conn.close()


# ═══════════════════════════════════════════════════════════════════════════
# API Routes
# ═══════════════════════════════════════════════════════════════════════════

@ntfy_router.get("/api/network-access/ntfy/status")
def ntfy_status(request: Request):
    """Check ntfy service reachability via its health endpoint.

    Requires admin access. Makes an HTTP GET to {server_url}/v1/health
    and returns active/unreachable/not_configured/disabled.
    Also includes 'enabled' boolean so the frontend can set button state.
    """
    _require_admin(request)

    config = get_ntfy_config()

    if not config.get("server_url"):
        return {"status": "not_configured", "enabled": False}

    # If explicitly disabled by user, report that without checking health
    if not config.get("enabled"):
        return {"status": "disabled", "enabled": False}

    server_url = config["server_url"].rstrip("/")
    health_url = f"{server_url}/v1/health"

    try:
        req = urllib.request.Request(health_url, method="GET")
        with urllib.request.urlopen(req, timeout=5) as resp:
            if resp.getcode() == 200:
                # Auto-enable ntfy in the DB when the service is reachable
                _auto_enable_ntfy(server_url)
                return {"status": "active", "enabled": True}
            else:
                return {"status": "unreachable", "enabled": True, "message": f"Health check returned HTTP {resp.getcode()}"}
    except urllib.error.HTTPError as e:
        return {"status": "unreachable", "enabled": True, "message": f"Health check returned HTTP {e.code}"}
    except urllib.error.URLError as e:
        return {"status": "unreachable", "enabled": True, "message": str(e.reason)}
    except Exception as e:
        return {"status": "unreachable", "enabled": True, "message": str(e)}


@ntfy_router.post("/api/network-access/ntfy/test")
def ntfy_test(request: Request):
    """Send a test notification to the requesting user's ntfy topic.

    Requires authentication (any logged-in user, not just admin).
    Sends title "CWOC Test" with a click URL pointing to the settings page.
    """
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    # Build the click URL using the request's origin so it works on any host/port
    host = request.headers.get("host", "localhost")
    scheme = request.headers.get("x-forwarded-proto", "https")
    base = f"{scheme}://{host}"
    click_url = f"{base}/frontend/html/settings.html"

    # Build action buttons for the test notification
    snooze_minutes = get_user_snooze_minutes(user_id)
    actions = build_ntfy_actions(base, source_type="chit", chit_id=None,
                                 snooze_minutes=snooze_minutes)

    result = send_ntfy_notification(
        user_id=user_id,
        title="CWOC Test",
        body="If you see this, Ntfy is working! Tap to open Settings.",
        click_url=click_url,
        tags="white_check_mark",
        priority=4,
        icon_url=f"{base}/static/cwoc-icon-192.png",
        actions=actions,
        attach_url=f"{base}/static/cwoc-icon-512.png",
    )

    if result.get("sent"):
        return {"success": True, "topic": result["topic"]}
    else:
        return {"success": False, "error": result.get("reason", "Unknown error")}


@ntfy_router.post("/api/network-access/ntfy")
def save_ntfy_config(body: dict, request: Request):
    """Save ntfy provider config with server_url validation.

    Rejects empty or whitespace-only server_url with a 400 error.
    Otherwise delegates to the standard network_access upsert pattern.
    """
    _require_admin(request)

    config = body.get("config", {})
    server_url = config.get("server_url", "")

    # Validate server_url — reject empty or whitespace-only
    if not server_url or not server_url.strip():
        raise HTTPException(
            status_code=400,
            detail="A valid Server URL is required. The URL cannot be empty or whitespace-only.",
        )

    # Normalize: strip whitespace from the URL
    config["server_url"] = server_url.strip()

    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        now = _utcnow_iso()

        existing = conn.execute(
            "SELECT id, created_datetime FROM network_access WHERE provider = ?",
            ("ntfy",),
        ).fetchone()

        if existing:
            row_id = existing["id"]
            created = existing["created_datetime"]
        else:
            from uuid import uuid4
            row_id = str(uuid4())
            created = now

        enabled = body.get("enabled", False)
        config_json = json.dumps(config)

        conn.execute(
            """INSERT OR REPLACE INTO network_access
               (id, provider, enabled, config, created_datetime, modified_datetime)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (row_id, "ntfy", 1 if enabled else 0, config_json, created, now),
        )

        # Audit log
        try:
            actor = get_actor_from_request(request)
            action = "updated" if existing else "created"
            insert_audit_entry(
                conn, "network_access", "ntfy", action, actor,
                entity_summary="Network access config: ntfy",
            )
        except Exception as e:
            logger.error(f"Audit logging failed for ntfy config save: {e}")

        conn.commit()

        return {
            "id": row_id,
            "provider": "ntfy",
            "enabled": bool(enabled),
            "config": config,
            "created_datetime": created,
            "modified_datetime": now,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error saving ntfy config: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save ntfy config: {str(e)}")
    finally:
        if conn:
            conn.close()


@ntfy_router.post("/api/network-access/ntfy/disable")
def disable_ntfy(request: Request):
    """Disable the ntfy provider by setting enabled=0 in the network_access table.

    Preserves the existing config (server_url, etc.) so re-enabling is seamless.
    Requires admin access. Audit logged.
    """
    _require_admin(request)

    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        now = _utcnow_iso()

        existing = conn.execute(
            "SELECT id FROM network_access WHERE provider = ?",
            ("ntfy",),
        ).fetchone()

        if not existing:
            return {"success": True, "message": "Ntfy was not configured — nothing to disable."}

        conn.execute(
            "UPDATE network_access SET enabled = 0, modified_datetime = ? WHERE provider = ?",
            (now, "ntfy"),
        )

        # Audit log
        try:
            actor = get_actor_from_request(request)
            insert_audit_entry(
                conn, "network_access", "ntfy", "disabled", actor,
                entity_summary="Ntfy notifications disabled",
            )
        except Exception as e:
            logger.error(f"Audit logging failed for ntfy disable: {e}")

        conn.commit()
        return {"success": True, "message": "Ntfy notifications disabled."}

    except Exception as e:
        logger.error(f"Error disabling ntfy: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to disable ntfy: {str(e)}")
    finally:
        if conn:
            conn.close()


@ntfy_router.post("/api/network-access/ntfy/enable")
def enable_ntfy(request: Request):
    """Re-enable the ntfy provider by setting enabled=1 in the network_access table.

    Preserves the existing config. If ntfy was never configured, auto-enables
    with the default server_url. Requires admin access. Audit logged.
    """
    _require_admin(request)

    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        now = _utcnow_iso()

        existing = conn.execute(
            "SELECT id, config FROM network_access WHERE provider = ?",
            ("ntfy",),
        ).fetchone()

        if existing:
            conn.execute(
                "UPDATE network_access SET enabled = 1, modified_datetime = ? WHERE provider = ?",
                (now, "ntfy"),
            )
        else:
            from uuid import uuid4
            config_json = json.dumps({"server_url": "http://localhost:2586"})
            conn.execute(
                """INSERT INTO network_access (id, provider, enabled, config, created_datetime, modified_datetime)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (str(uuid4()), "ntfy", 1, config_json, now, now),
            )

        # Audit log
        try:
            actor = get_actor_from_request(request)
            insert_audit_entry(
                conn, "network_access", "ntfy", "enabled", actor,
                entity_summary="Ntfy notifications enabled",
            )
        except Exception as e:
            logger.error(f"Audit logging failed for ntfy enable: {e}")

        conn.commit()
        return {"success": True, "message": "Ntfy notifications enabled."}

    except Exception as e:
        logger.error(f"Error enabling ntfy: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to enable ntfy: {str(e)}")
    finally:
        if conn:
            conn.close()
