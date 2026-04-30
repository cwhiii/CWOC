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
        }

        cursor.execute(
            """
            INSERT OR REPLACE INTO settings (
                user_id, time_format, sex, snooze_length, default_filters,
                alarm_orientation, active_clocks, saved_locations, tags, custom_colors, visual_indicators, chit_options,
                calendar_snap, week_start_day, work_start_hour, work_end_hour, work_days, enabled_periods, custom_days_count,
                all_view_start_hour, all_view_end_hour, day_scroll_to_hour,
                username, audit_log_max_days, audit_log_max_mb, default_notifications, unit_system,
                habits_success_window, overdue_border_color, blocked_border_color
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
