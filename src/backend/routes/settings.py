"""Settings API routes for the CWOC backend.

Provides endpoints for getting/saving user settings, standalone alert CRUD,
and alert state management (dismiss/snooze persistence).
"""

import logging
import sqlite3
from datetime import datetime, timedelta
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request

from src.backend.db import (
    DB_PATH, serialize_json_field, deserialize_json_field,
)
from src.backend.models import Settings
from src.backend.routes.audit import (
    insert_audit_entry, compute_audit_diff, get_actor_from_request, _run_auto_prune,
)
from src.backend.routes.email import _encrypt_password


logger = logging.getLogger(__name__)
router = APIRouter()


# ═══════════════════════════════════════════════════════════════════════════
# Settings CRUD
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/api/settings/{user_id}")
def get_settings(user_id: str, request: Request):
    # Validate that the requested user_id matches the authenticated user
    authenticated_user_id = request.state.user_id
    if user_id != authenticated_user_id:
        raise HTTPException(status_code=403, detail="Cannot access another user's settings")
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM settings WHERE user_id = ?", (authenticated_user_id,))
        row = cursor.fetchone()
        if not row:
            return {"user_id": authenticated_user_id}  # Return empty settings
        settings = dict(zip([col[0] for col in cursor.description], row))
        settings["tags"] = deserialize_json_field(settings["tags"])
        settings["default_filters"] = deserialize_json_field(settings["default_filters"])
        settings["custom_colors"] = deserialize_json_field(settings["custom_colors"])
        settings["visual_indicators"] = deserialize_json_field(settings["visual_indicators"])
        settings["chit_options"] = deserialize_json_field(settings["chit_options"])
        settings["active_clocks"] = deserialize_json_field(settings.get("active_clocks"))
        settings["saved_locations"] = deserialize_json_field(settings.get("saved_locations"))
        settings["default_notifications"] = deserialize_json_field(settings.get("default_notifications"))
        settings["shared_tags"] = deserialize_json_field(settings.get("shared_tags"))
        settings["kiosk_users"] = deserialize_json_field(settings.get("kiosk_users"))
        settings["email_account"] = deserialize_json_field(settings.get("email_account"))
        # Decrypt the email password so the frontend can populate the field
        if isinstance(settings.get("email_account"), dict) and settings["email_account"].get("password_encrypted"):
            try:
                from src.backend.routes.email import _decrypt_password  # lazy import to avoid circular deps
                settings["email_account"]["password"] = _decrypt_password(settings["email_account"]["password_encrypted"])
            except Exception as e:
                logger.error(f"Failed to decrypt email password: {e}")
                settings["email_account"]["password"] = ""
        settings["default_show_habits_on_calendar"] = settings.get("default_show_habits_on_calendar", "1")
        settings["map_default_lat"] = settings.get("map_default_lat")
        settings["map_default_lon"] = settings.get("map_default_lon")
        settings["map_default_zoom"] = settings.get("map_default_zoom")
        settings["map_auto_zoom"] = settings.get("map_auto_zoom", "1")
        return settings
    except Exception as e:
        logger.error(f"Error fetching settings: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch settings: {str(e)}")
    finally:
        if conn:
            conn.close()

@router.post("/api/settings")
def save_settings(settings: Settings, request: Request):
    # Ensure the settings user_id matches the authenticated user
    authenticated_user_id = request.state.user_id
    if settings.user_id != authenticated_user_id:
        raise HTTPException(status_code=403, detail="Cannot modify another user's settings")

    # Validate reserved tag namespace — reject any tag starting with CWOC_System/
    RESERVED_TAG_PREFIX = "cwoc_system/"
    if settings.tags:
        for tag in settings.tags:
            if tag.name.lower().startswith(RESERVED_TAG_PREFIX):
                raise HTTPException(
                    status_code=400,
                    detail="Tags starting with 'CWOC_System/' are reserved for system use and cannot be created manually."
                )

    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # --- Audit: fetch old settings before overwrite ---
        old_settings_dict = None
        try:
            cursor.execute("SELECT * FROM settings WHERE user_id = ?", (settings.user_id,))
            old_row = cursor.fetchone()
            if old_row:
                old_settings_dict = dict(zip([col[0] for col in cursor.description], old_row))
        except Exception as e:
            logger.error(f"Audit: failed to fetch old settings: {str(e)}")

        # Build the new settings dict using the same serialization as the INSERT
        # Preserve shared_tags if not provided by the frontend (shared_tags are
        # managed via the dedicated PUT /api/settings/shared-tags endpoint and
        # the tag modal save flow — the main settings save should not overwrite them)
        preserved_shared_tags = None
        if settings.shared_tags is None and old_settings_dict:
            preserved_shared_tags = old_settings_dict.get("shared_tags")

        # Preserve email_account if not provided by the frontend (email_account
        # is managed via the Settings → Email Account section and should not be
        # overwritten by a general settings save that omits it)
        preserved_email_account = None
        if settings.email_account is None and old_settings_dict:
            preserved_email_account = old_settings_dict.get("email_account")

        # If email_account is provided, encrypt the password before storing
        _final_email_account = preserved_email_account
        if settings.email_account is not None:
            try:
                import json as _json
                acct = _json.loads(settings.email_account) if isinstance(settings.email_account, str) else settings.email_account
                if isinstance(acct, dict) and acct.get("password"):
                    # Encrypt plaintext password → password_encrypted, remove plaintext
                    acct["password_encrypted"] = _encrypt_password(acct["password"])
                    del acct["password"]
                elif isinstance(acct, dict) and not acct.get("password") and not acct.get("password_encrypted"):
                    # No new password provided — preserve the old encrypted password
                    if old_settings_dict and old_settings_dict.get("email_account"):
                        old_acct = deserialize_json_field(old_settings_dict["email_account"])
                        if isinstance(old_acct, dict) and old_acct.get("password_encrypted"):
                            acct["password_encrypted"] = old_acct["password_encrypted"]
                _final_email_account = serialize_json_field(acct) if isinstance(acct, dict) else settings.email_account
            except Exception as e:
                logger.error(f"Error processing email_account password: {str(e)}")
                _final_email_account = settings.email_account

        new_settings_dict = {
            "user_id": settings.user_id,
            "time_format": settings.time_format,
            "sex": settings.sex,
            "snooze_length": settings.snooze_length,
            "default_filters": serialize_json_field(settings.default_filters),
            "alarm_orientation": settings.alarm_orientation,
            "active_clocks": settings.active_clocks,
            "saved_locations": settings.saved_locations,
            "tags": serialize_json_field([t.dict() for t in settings.tags]) if settings.tags else None,
            "custom_colors": serialize_json_field(settings.custom_colors),
            "visual_indicators": serialize_json_field(settings.visual_indicators),
            "chit_options": serialize_json_field(settings.chit_options),
            "calendar_snap": settings.calendar_snap or "15",
            "week_start_day": settings.week_start_day or "0",
            "work_start_hour": settings.work_start_hour or "8",
            "work_end_hour": settings.work_end_hour or "17",
            "work_days": settings.work_days or "1,2,3,4,5",
            "enabled_periods": settings.enabled_periods or "Itinerary,Day,Week,Work,SevenDay,Month,Year",
            "custom_days_count": settings.custom_days_count or "7",
            "all_view_start_hour": settings.all_view_start_hour or "0",
            "all_view_end_hour": settings.all_view_end_hour or "24",
            "day_scroll_to_hour": settings.day_scroll_to_hour or "5",
            "username": settings.username,
            "audit_log_max_days": settings.audit_log_max_days,
            "audit_log_max_mb": settings.audit_log_max_mb,
            "default_notifications": serialize_json_field(settings.default_notifications),
            "unit_system": settings.unit_system or "imperial",
            "habits_success_window": settings.habits_success_window or "30",
            "overdue_border_color": settings.overdue_border_color or "#b22222",
            "blocked_border_color": settings.blocked_border_color or "#DAA520",
            "shared_tags": preserved_shared_tags if settings.shared_tags is None else serialize_json_field(settings.shared_tags),
            "kiosk_users": serialize_json_field(settings.kiosk_users),
            "hide_declined": settings.hide_declined or "0",
            "default_show_habits_on_calendar": settings.default_show_habits_on_calendar or "1",
            "map_default_lat": settings.map_default_lat,
            "map_default_lon": settings.map_default_lon,
            "map_default_zoom": settings.map_default_zoom,
            "map_auto_zoom": settings.map_auto_zoom or "1",
            "email_account": _final_email_account,
        }

        cursor.execute(
            """
            INSERT OR REPLACE INTO settings (
                user_id, time_format, sex, snooze_length, default_filters,
                alarm_orientation, active_clocks, saved_locations, tags, custom_colors, visual_indicators, chit_options,
                calendar_snap, week_start_day, work_start_hour, work_end_hour, work_days, enabled_periods, custom_days_count,
                all_view_start_hour, all_view_end_hour, day_scroll_to_hour,
                username, audit_log_max_days, audit_log_max_mb, default_notifications, unit_system,
                habits_success_window, overdue_border_color, blocked_border_color, shared_tags, kiosk_users,
                hide_declined, default_show_habits_on_calendar,
                map_default_lat, map_default_lon, map_default_zoom, map_auto_zoom,
                email_account
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                new_settings_dict["user_id"],
                new_settings_dict["time_format"],
                new_settings_dict["sex"],
                new_settings_dict["snooze_length"],
                new_settings_dict["default_filters"],
                new_settings_dict["alarm_orientation"],
                new_settings_dict["active_clocks"],
                new_settings_dict["saved_locations"],
                new_settings_dict["tags"],
                new_settings_dict["custom_colors"],
                new_settings_dict["visual_indicators"],
                new_settings_dict["chit_options"],
                new_settings_dict["calendar_snap"],
                new_settings_dict["week_start_day"],
                new_settings_dict["work_start_hour"],
                new_settings_dict["work_end_hour"],
                new_settings_dict["work_days"],
                new_settings_dict["enabled_periods"],
                new_settings_dict["custom_days_count"],
                new_settings_dict["all_view_start_hour"],
                new_settings_dict["all_view_end_hour"],
                new_settings_dict["day_scroll_to_hour"],
                new_settings_dict["username"],
                new_settings_dict["audit_log_max_days"],
                new_settings_dict["audit_log_max_mb"],
                new_settings_dict["default_notifications"],
                new_settings_dict["unit_system"],
                new_settings_dict["habits_success_window"],
                new_settings_dict["overdue_border_color"],
                new_settings_dict["blocked_border_color"],
                new_settings_dict["shared_tags"],
                new_settings_dict["kiosk_users"],
                new_settings_dict["hide_declined"],
                new_settings_dict["default_show_habits_on_calendar"],
                new_settings_dict["map_default_lat"],
                new_settings_dict["map_default_lon"],
                new_settings_dict["map_default_zoom"],
                new_settings_dict["map_auto_zoom"],
                new_settings_dict["email_account"],
            )
        )

        # --- Audit: compute diff and insert entry if anything changed ---
        try:
            if old_settings_dict:
                audit_exclude = {"modified_datetime", "created_datetime", "user_id"}
                changes = compute_audit_diff(old_settings_dict, new_settings_dict, exclude_fields=audit_exclude)
                if changes:
                    actor = get_actor_from_request(request)
                    insert_audit_entry(conn, "settings", settings.user_id, "updated", actor, changes=changes)
        except Exception as e:
            logger.error(f"Audit: failed to log settings change: {str(e)}")

        conn.commit()

        # Auto-prune audit log if limits changed
        try:
            _run_auto_prune()
        except Exception as e:
            logger.error(f"Auto-prune after settings save failed: {str(e)}")

        return settings
    except Exception as e:
        logger.error(f"Error saving settings: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to save settings: {str(e)}")
    finally:
        if conn:
            conn.close()


# ═══════════════════════════════════════════════════════════════════════════
# Standalone (Independent) Alerts
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/api/standalone-alerts")
def get_standalone_alerts(request: Request):
    conn = None
    try:
        user_id = request.state.user_id
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM standalone_alerts WHERE owner_id = ? ORDER BY created_datetime DESC", (user_id,))
        rows = cursor.fetchall()
        results = []
        for row in rows:
            item = dict(row)
            item["data"] = deserialize_json_field(item.get("data"))
            results.append(item)
        return results
    except Exception as e:
        logger.error(f"Error fetching standalone alerts: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.close()


@router.post("/api/standalone-alerts")
def create_standalone_alert(body: dict, request: Request):
    conn = None
    try:
        user_id = request.state.user_id
        alert_id = str(uuid4())
        now = datetime.utcnow().isoformat()
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        _type = body.get("_type", "alarm")
        name = body.get("name", "")
        data = {k: v for k, v in body.items() if k not in ("id", "created_datetime", "modified_datetime")}
        cursor.execute(
            "INSERT INTO standalone_alerts (id, _type, name, data, created_datetime, modified_datetime, owner_id) VALUES (?,?,?,?,?,?,?)",
            (alert_id, _type, name, serialize_json_field(data), now, now, user_id)
        )
        # Audit logging
        try:
            actor = get_actor_from_request(request)
            insert_audit_entry(conn, "independent_alert", alert_id, "created", actor, entity_summary=f"{_type}: {name}" if name else _type)
        except Exception as e:
            logger.error(f"Audit logging failed for independent alert creation: {str(e)}")
        conn.commit()
        data["id"] = alert_id
        data["created_datetime"] = now
        data["modified_datetime"] = now
        return data
    except Exception as e:
        logger.error(f"Error creating standalone alert: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.close()


@router.put("/api/standalone-alerts/{alert_id}")
def update_standalone_alert(alert_id: str, body: dict, request: Request):
    conn = None
    try:
        user_id = request.state.user_id
        now = datetime.utcnow().isoformat()
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        # Capture old state for audit diff — verify ownership
        cursor.execute("SELECT * FROM standalone_alerts WHERE id=? AND owner_id=?", (alert_id, user_id))
        old_row = cursor.fetchone()
        old_data_str = None
        if old_row:
            old_cols = [col[0] for col in cursor.description]
            old_dict = dict(zip(old_cols, old_row))
            old_data_str = old_dict.get("data")

        _type = body.get("_type", "alarm")
        name = body.get("name", "")
        data = {k: v for k, v in body.items() if k not in ("id", "created_datetime", "modified_datetime")}
        new_data_str = serialize_json_field(data)
        cursor.execute(
            "UPDATE standalone_alerts SET _type=?, name=?, data=?, modified_datetime=? WHERE id=? AND owner_id=?",
            (_type, name, new_data_str, now, alert_id, user_id)
        )
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Standalone alert not found")
        # Audit logging
        try:
            if old_data_str != new_data_str:
                changes = [{"field": "data", "old": old_data_str, "new": new_data_str}]
                actor = get_actor_from_request(request)
                insert_audit_entry(conn, "independent_alert", alert_id, "updated", actor, changes=changes, entity_summary=f"{_type}: {name}" if name else _type)
        except Exception as e:
            logger.error(f"Audit logging failed for independent alert update: {str(e)}")
        conn.commit()
        data["id"] = alert_id
        data["modified_datetime"] = now
        return data
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating standalone alert: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.close()


@router.delete("/api/standalone-alerts/{alert_id}")
def delete_standalone_alert(alert_id: str, request: Request):
    conn = None
    try:
        user_id = request.state.user_id
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        # Get name for audit summary before deleting — verify ownership
        cursor.execute("SELECT _type, name FROM standalone_alerts WHERE id=? AND owner_id=?", (alert_id, user_id))
        row = cursor.fetchone()
        summary = None
        if row:
            summary = f"{row[0]}: {row[1]}" if row[1] else row[0]
        cursor.execute("DELETE FROM standalone_alerts WHERE id=? AND owner_id=?", (alert_id, user_id))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Standalone alert not found")
        # Audit logging
        try:
            actor = get_actor_from_request(request)
            insert_audit_entry(conn, "independent_alert", alert_id, "deleted", actor, entity_summary=summary)
        except Exception as e:
            logger.error(f"Audit logging failed for independent alert deletion: {str(e)}")
        conn.commit()
        return {"message": "Standalone alert deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting standalone alert: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.close()


# ═══════════════════════════════════════════════════════════════════════════
# Alert State (dismiss/snooze persistence)
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/api/alert-state")
def get_alert_states(request: Request):
    """Get all non-expired alert states (dismissed/snoozed) for the authenticated user."""
    conn = None
    try:
        user_id = request.state.user_id
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        now = datetime.utcnow().isoformat()
        # Return dismissed (no expiry) and snoozed (not yet expired) for this user
        cursor.execute(
            "SELECT * FROM alert_state WHERE owner_id = ? AND (state = 'dismissed' OR (state = 'snoozed' AND until_ts > ?))",
            (user_id, now)
        )
        return [dict(row) for row in cursor.fetchall()]
    except Exception as e:
        logger.error(f"Error fetching alert states: {str(e)}")
        return []
    finally:
        if conn:
            conn.close()


@router.post("/api/alert-state")
def set_alert_state(body: dict, request: Request):
    """Set dismiss/snooze state for an alert key, scoped to the authenticated user."""
    conn = None
    try:
        user_id = request.state.user_id
        alert_key = body.get("alert_key")
        state = body.get("state", "dismissed")  # 'dismissed' or 'snoozed'
        until_ts = body.get("until_ts")
        if not alert_key:
            raise HTTPException(status_code=400, detail="alert_key required")
        now = datetime.utcnow().isoformat()
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        # Delete any existing state for this key+user, then insert
        cursor.execute("DELETE FROM alert_state WHERE alert_key = ? AND owner_id = ?", (alert_key, user_id))
        cursor.execute(
            "INSERT INTO alert_state (alert_key, state, until_ts, updated_at, owner_id) VALUES (?,?,?,?,?)",
            (alert_key, state, until_ts, now, user_id)
        )
        conn.commit()
        return {"alert_key": alert_key, "state": state, "until_ts": until_ts}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error setting alert state: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.close()


@router.delete("/api/alert-state/cleanup")
def cleanup_alert_states():
    """Remove expired snooze states and old dismissed states (>24h)."""
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        now = datetime.utcnow().isoformat()
        yesterday = (datetime.utcnow() - timedelta(days=1)).isoformat()
        cursor.execute("DELETE FROM alert_state WHERE (state = 'snoozed' AND until_ts < ?) OR (state = 'dismissed' AND updated_at < ?)", (now, yesterday))
        conn.commit()
        return {"cleaned": cursor.rowcount}
    except Exception as e:
        logger.error(f"Error cleaning alert states: {str(e)}")
        return {"cleaned": 0}
    finally:
        if conn:
            conn.close()


# ═══════════════════════════════════════════════════════════════════════════
# Running Timer State (for server-side Ntfy notifications)
# ═══════════════════════════════════════════════════════════════════════════

# In-memory map of active timer tasks: key -> asyncio.Task
# Key format: "chit:<source_id>:<alert_index>" or "independent:<source_id>"
_timer_tasks = {}


def _timer_key(source_type, source_id, alert_index=None):
    """Build a unique key for a timer task."""
    if alert_index is not None:
        return f"{source_type}:{source_id}:{alert_index}"
    return f"{source_type}:{source_id}"


async def _timer_fire_task(key, delay_seconds, user_id, name, source_type, source_id):
    """Async task that waits for the timer to expire, then sends Ntfy notification."""
    import asyncio
    try:
        await asyncio.sleep(delay_seconds)
    except asyncio.CancelledError:
        logger.debug(f"Timer task cancelled: {key}")
        return

    # Timer expired — send notification
    logger.info(f"Timer expired: {key} — sending Ntfy to user {user_id}")
    try:
        from src.backend.routes.ntfy import send_ntfy_notification, build_ntfy_actions, get_user_snooze_minutes
        from src.backend.schedulers import _get_server_base_url
        base = _get_server_base_url()
        if source_type == "chit" and source_id:
            click_url = f"{base}/frontend/html/editor.html?id={source_id}"
        else:
            # Independent alerts — link to the Alarms tab in independent mode
            click_url = f"{base}/?tab=Alarms&view=independent"
        icon_url = f"{base}/static/cwoc-icon-192.png"

        # Build action buttons (Open, Snooze, Dismiss)
        snooze_minutes = get_user_snooze_minutes(user_id)
        actions = build_ntfy_actions(base, chit_id=source_id if source_type == "chit" else None,
                                     source_type=source_type, snooze_minutes=snooze_minutes)

        send_ntfy_notification(
            user_id=user_id,
            title=f"{name or 'Timer'} — Time's up!",
            body="Your timer has finished.",
            click_url=click_url,
            tags="timer_clock",
            priority=5,
            icon_url=icon_url,
            actions=actions,
        )
    except Exception as e:
        logger.warning(f"Ntfy failed for timer {key}: {e}")

    # Also try Web Push
    try:
        from src.backend.schedulers import _send_chit_push
        _send_chit_push(user_id, source_id or "", name or "Timer", "⏱️ Timer done:", "Time's up!")
    except Exception as e:
        logger.debug(f"Web Push failed for timer {key}: {e}")

    # Clean up
    _timer_tasks.pop(key, None)


@router.post("/api/timer-state")
async def register_running_timer(request: Request):
    """Register a running timer — schedules a delayed Ntfy notification.

    When the timer expires, the server sends a push notification immediately
    (no polling delay). If the timer is paused or reset before expiry,
    the scheduled task is cancelled via DELETE /api/timer-state.

    Expects JSON body:
    {
        "source_type": "chit" or "independent",
        "source_id": "<chit_id or alert_id>",
        "alert_index": 0,  (for chit timers — index in the alerts array)
        "end_ts": "2026-05-02T15:30:00Z",  (ISO datetime when timer expires)
        "name": "My Timer"  (optional display name)
    }
    """
    import asyncio

    user_id = request.state.user_id
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    source_type = body.get("source_type")
    source_id = body.get("source_id")
    end_ts = body.get("end_ts")

    if not source_type or not source_id or not end_ts:
        raise HTTPException(status_code=400, detail="Missing required fields: source_type, source_id, end_ts")

    # Parse end_ts and compute delay
    try:
        end_dt = datetime.fromisoformat(end_ts.replace("Z", "+00:00")).replace(tzinfo=None)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid end_ts format")

    delay = (end_dt - datetime.utcnow()).total_seconds()
    if delay < 0:
        delay = 0  # Already expired — fire immediately

    key = _timer_key(source_type, source_id, body.get("alert_index"))

    # Cancel any existing task for this timer
    old_task = _timer_tasks.pop(key, None)
    if old_task and not old_task.done():
        old_task.cancel()

    # Schedule the new task
    task = asyncio.create_task(
        _timer_fire_task(key, delay, user_id, body.get("name"), source_type, source_id)
    )
    _timer_tasks[key] = task

    logger.info(f"Timer scheduled: {key} fires in {delay:.1f}s")
    return {"status": "scheduled", "key": key, "delay_seconds": round(delay, 1)}


@router.delete("/api/timer-state")
async def cancel_running_timer(request: Request):
    """Cancel a running timer (paused or reset by the user).

    Cancels the scheduled asyncio task so no notification is sent.

    Expects JSON body:
    {
        "source_type": "chit" or "independent",
        "source_id": "<chit_id or alert_id>",
        "alert_index": 0  (optional, for chit timers)
    }
    """
    user_id = request.state.user_id
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    source_type = body.get("source_type")
    source_id = body.get("source_id")

    if not source_type or not source_id:
        raise HTTPException(status_code=400, detail="Missing required fields: source_type, source_id")

    key = _timer_key(source_type, source_id, body.get("alert_index"))
    task = _timer_tasks.pop(key, None)
    if task and not task.done():
        task.cancel()
        logger.info(f"Timer cancelled: {key}")
        return {"status": "cancelled"}
    return {"status": "not_found"}


@router.post("/api/timer-state-cancel")
async def cancel_running_timer_beacon(request: Request):
    """Cancel a running timer via POST (for sendBeacon on page unload).

    Same as DELETE /api/timer-state but accepts POST since sendBeacon
    can only send POST requests.
    """
    user_id = request.state.user_id
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    source_type = body.get("source_type")
    source_id = body.get("source_id")

    if not source_type or not source_id:
        return {"status": "missing_fields"}

    key = _timer_key(source_type, source_id, body.get("alert_index"))
    task = _timer_tasks.pop(key, None)
    if task and not task.done():
        task.cancel()
        logger.info(f"Timer cancelled (beacon): {key}")
        return {"status": "cancelled"}
    return {"status": "not_found"}
