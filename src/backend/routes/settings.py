"""Settings API routes for the CWOC backend.

Provides endpoints for getting/saving user settings, standalone alert CRUD,
and alert state management (dismiss/snooze persistence).
"""

import logging
import sqlite3
from datetime import datetime, timedelta
from uuid import uuid4
from zoneinfo import available_timezones

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request

from src.backend.db import (
    DB_PATH, serialize_json_field, deserialize_json_field,
    get_next_sync_version,
)
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
        # Multi-account email: deserialize and decrypt passwords
        settings["email_accounts"] = deserialize_json_field(settings.get("email_accounts"))
        if isinstance(settings.get("email_accounts"), list):
            for acct in settings["email_accounts"]:
                if isinstance(acct, dict) and acct.get("password_encrypted"):
                    try:
                        from src.backend.routes.email import _decrypt_password
                        acct["password"] = _decrypt_password(acct["password_encrypted"])
                    except Exception as e:
                        logger.error(f"Failed to decrypt email password for account {acct.get('email', '?')}: {e}")
                        acct["password"] = ""
        # Decrypt the email password so the frontend can populate the field (legacy single account)
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
        settings["default_share_contacts"] = settings.get("default_share_contacts", "0")
        settings["checklist_autosave"] = settings.get("checklist_autosave", "1")
        settings["view_order"] = deserialize_json_field(settings.get("view_order"))
        settings["recent_tags"] = deserialize_json_field(settings.get("recent_tags"))
        settings["session_lifetime"] = settings.get("session_lifetime", "24")
        settings["autosave_desktop"] = settings.get("autosave_desktop", "0")
        settings["autosave_mobile"] = settings.get("autosave_mobile", "0")
        settings["custom_view_filters"] = deserialize_json_field(settings.get("custom_view_filters"))
        settings["hidden_views"] = deserialize_json_field(settings.get("hidden_views"))
        settings["kiosk_selected_tags"] = deserialize_json_field(settings.get("kiosk_selected_tags"))

        # ── Include bundles data (piggyback on settings to avoid separate API call) ──
        try:
            # Ensure auto-bundles exist (Newsletters, Receipts, Calendar Invites)
            from src.backend.routes.bundles import _initialize_default_bundles, ensure_auto_bundles_exist
            try:
                ensure_auto_bundles_exist(authenticated_user_id)
            except Exception as auto_err:
                logger.warning(f"Failed to ensure auto-bundles in settings: {auto_err}")

            cursor.execute(
                "SELECT * FROM bundles WHERE owner_id = ? ORDER BY display_order ASC",
                (authenticated_user_id,),
            )
            bundle_rows = cursor.fetchall()
            if not bundle_rows:
                # Auto-initialize default bundles
                conn.close()
                conn = None
                try:
                    _initialize_default_bundles(authenticated_user_id)
                except Exception as init_err:
                    logger.error(f"Failed to init default bundles: {init_err}")
                conn = sqlite3.connect(DB_PATH)
                cursor = conn.cursor()
                cursor.execute(
                    "SELECT * FROM bundles WHERE owner_id = ? ORDER BY display_order ASC",
                    (authenticated_user_id,),
                )
                bundle_rows = cursor.fetchall()

            bundles = []
            if bundle_rows:
                bundle_cols = [col[0] for col in cursor.description]
                for brow in bundle_rows:
                    b = dict(zip(bundle_cols, brow))
                    cursor.execute(
                        "SELECT rule_id FROM bundle_rules WHERE bundle_id = ? AND owner_id = ?",
                        (b["id"], authenticated_user_id),
                    )
                    b["rule_ids"] = [r[0] for r in cursor.fetchall()]
                    bundles.append(b)
            settings["bundles"] = bundles
        except Exception as bundle_err:
            logger.error(f"Error loading bundles in settings: {bundle_err}")
            settings["bundles"] = []

        return settings
    except Exception as e:
        logger.error(f"Error fetching settings: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch settings: {str(e)}")
    finally:
        if conn:
            conn.close()

@router.post("/api/settings")
async def save_settings(request: Request, background_tasks: BackgroundTasks):
    """Partial-update settings save. Only fields present in the request body are
    updated — omitted fields are left untouched in the database. This prevents
    partial saves from wiping unrelated settings."""
    import json as _json

    authenticated_user_id = request.state.user_id

    # Parse raw JSON body so we know exactly which keys were sent
    body = await request.json()

    # Validate user_id if provided
    sent_user_id = body.get("user_id", authenticated_user_id)
    if sent_user_id != authenticated_user_id:
        raise HTTPException(status_code=403, detail="Cannot modify another user's settings")

    # Validate reserved tag namespace
    RESERVED_TAG_PREFIX = "cwoc_system/"
    if "tags" in body and body["tags"]:
        for tag in body["tags"]:
            if isinstance(tag, dict) and tag.get("name", "").lower().startswith(RESERVED_TAG_PREFIX):
                raise HTTPException(
                    status_code=400,
                    detail="Tags starting with 'CWOC_System/' are reserved for system use and cannot be created manually."
                )

    # Validate timezone fields against IANA timezone database
    _valid_timezones = available_timezones()
    if "default_timezone" in body:
        tz_val = body["default_timezone"]
        if tz_val is not None and tz_val != "" and tz_val not in _valid_timezones:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid timezone: '{tz_val}' is not a recognized IANA timezone"
            )
    if "timezone_override" in body:
        tz_val = body["timezone_override"]
        if tz_val is not None and tz_val != "" and tz_val not in _valid_timezones:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid timezone: '{tz_val}' is not a recognized IANA timezone"
            )

    # Fields that need JSON serialization before storage
    JSON_FIELDS = {
        "tags", "default_filters", "custom_colors", "visual_indicators",
        "chit_options", "default_notifications", "kiosk_users", "shared_tags",
        "recent_tags", "custom_view_filters", "hidden_views", "kiosk_selected_tags",
    }

    # All valid settings columns (excluding user_id which is the key)
    VALID_COLUMNS = {
        "time_format", "sex", "snooze_length", "default_filters",
        "alarm_orientation", "active_clocks", "saved_locations", "tags",
        "custom_colors", "visual_indicators", "chit_options", "calendar_snap",
        "week_start_day", "work_start_hour", "work_end_hour", "work_days",
        "enabled_periods", "custom_days_count", "all_view_start_hour",
        "all_view_end_hour", "day_scroll_to_hour", "username",
        "audit_log_max_days", "audit_log_max_mb", "default_notifications",
        "unit_system", "habits_success_window", "overdue_border_color",
        "blocked_border_color", "shared_tags", "kiosk_users", "hide_declined",
        "default_show_habits_on_calendar", "map_default_lat", "map_default_lon",
        "map_default_zoom", "map_auto_zoom", "email_account", "email_accounts",
        "attachment_max_size_mb", "attachment_max_storage_mb",
        "default_share_contacts", "checklist_autosave", "autosave_desktop",
        "autosave_mobile", "view_order", "recent_tags", "paginate_email",
        "bundles_multi_placement", "bundles_enabled", "bundles_show_count",
        "show_map_thumbnails", "session_lifetime", "omni_layout",
        "omni_locked_filters", "omni_hst_clock_mode", "omni_email_count",
        "omni_normalize_colors", "custom_view_filters",
        "default_timezone", "timezone_override",
        "default_view",
        # Migration 7→8 fields (Android parity)
        "clock_orientation", "hidden_views", "combine_alerts",
        "projects_show_child_count", "projects_show_checklist_count",
        "email_check_interval", "email_max_pull", "email_signature",
        "email_bundles_count_display",
        "instance_name", "welcome_message", "audit_log_pruning_enabled",
        "tailscale_enabled", "tailscale_auth_key",
        "ntfy_enabled", "ha_enabled", "ha_poll_interval",
        "kiosk_selected_tags",
        # Email privacy (already in DB from earlier migration)
        "email_block_tracking_pixels", "email_external_content",
        "email_read_receipts", "email_undo_send_delay", "email_group_by",
    }

    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # --- Audit: fetch old settings before update ---
        old_settings_dict = None
        try:
            cursor.execute("SELECT * FROM settings WHERE user_id = ?", (authenticated_user_id,))
            old_row = cursor.fetchone()
            if old_row:
                old_settings_dict = dict(zip([col[0] for col in cursor.description], old_row))
        except Exception as e:
            logger.error(f"Audit: failed to fetch old settings: {str(e)}")

        # Build the update dict from only the keys that were actually sent
        update_dict = {}
        for key, value in body.items():
            if key == "user_id":
                continue  # Not a settable column
            if key not in VALID_COLUMNS:
                continue  # Ignore unknown fields

            # Serialize JSON fields
            if key == "tags" and value is not None:
                # Tags come as list of dicts from frontend
                if isinstance(value, list):
                    update_dict[key] = serialize_json_field(value)
                else:
                    update_dict[key] = value
            elif key in JSON_FIELDS and value is not None:
                update_dict[key] = serialize_json_field(value)
            elif key == "email_account" and value is not None:
                # Encrypt email password before storing
                try:
                    acct = _json.loads(value) if isinstance(value, str) else value
                    if isinstance(acct, dict) and acct.get("password"):
                        acct["password_encrypted"] = _encrypt_password(acct["password"])
                        del acct["password"]
                    elif isinstance(acct, dict) and not acct.get("password") and not acct.get("password_encrypted"):
                        # No new password — preserve old encrypted password
                        if old_settings_dict and old_settings_dict.get("email_account"):
                            old_acct = deserialize_json_field(old_settings_dict["email_account"])
                            if isinstance(old_acct, dict) and old_acct.get("password_encrypted"):
                                acct["password_encrypted"] = old_acct["password_encrypted"]
                    update_dict[key] = serialize_json_field(acct) if isinstance(acct, dict) else value
                except Exception as e:
                    logger.error(f"Error processing email_account password: {str(e)}")
                    update_dict[key] = value
            elif key == "email_accounts" and value is not None:
                # Encrypt email passwords for multi-account
                try:
                    accounts = _json.loads(value) if isinstance(value, str) else value
                    if isinstance(accounts, list):
                        old_accounts_by_id = {}
                        if old_settings_dict and old_settings_dict.get("email_accounts"):
                            old_list = deserialize_json_field(old_settings_dict["email_accounts"])
                            if isinstance(old_list, list):
                                for oa in old_list:
                                    if isinstance(oa, dict) and oa.get("id"):
                                        old_accounts_by_id[oa["id"]] = oa
                        for acct in accounts:
                            if not isinstance(acct, dict):
                                continue
                            if acct.get("password"):
                                acct["password_encrypted"] = _encrypt_password(acct["password"])
                                del acct["password"]
                            elif not acct.get("password_encrypted"):
                                old_acct = old_accounts_by_id.get(acct.get("id"))
                                if old_acct and old_acct.get("password_encrypted"):
                                    acct["password_encrypted"] = old_acct["password_encrypted"]
                        update_dict[key] = serialize_json_field(accounts)
                    else:
                        update_dict[key] = value
                except Exception as e:
                    logger.error(f"Error processing email_accounts passwords: {str(e)}")
                    update_dict[key] = value
            else:
                update_dict[key] = value

        if not update_dict:
            return {"user_id": authenticated_user_id, "status": "no changes"}

        # Ensure the row exists (INSERT if brand new user)
        if not old_settings_dict:
            cursor.execute("INSERT OR IGNORE INTO settings (user_id) VALUES (?)", (authenticated_user_id,))

        # Assign sync_version for mobile sync tracking
        sync_version = get_next_sync_version(cursor)
        update_dict["sync_version"] = sync_version

        # Build dynamic UPDATE statement with only the provided fields
        set_clauses = [f"{col} = ?" for col in update_dict.keys()]
        values = list(update_dict.values()) + [authenticated_user_id]
        cursor.execute(
            f"UPDATE settings SET {', '.join(set_clauses)} WHERE user_id = ?",
            values
        )

        # --- Audit: compute diff and insert entry if anything changed ---
        try:
            if old_settings_dict:
                audit_exclude = {"modified_datetime", "created_datetime", "user_id"}
                changes = compute_audit_diff(old_settings_dict, update_dict, exclude_fields=audit_exclude)
                if changes:
                    actor = get_actor_from_request(request)
                    insert_audit_entry(conn, "settings", authenticated_user_id, "updated", actor, changes=changes)
        except Exception as e:
            logger.error(f"Audit: failed to log settings change: {str(e)}")

        conn.commit()

        # Auto-prune audit log if limits changed
        try:
            if "audit_log_max_days" in update_dict or "audit_log_max_mb" in update_dict:
                _run_auto_prune()
        except Exception as e:
            logger.error(f"Auto-prune after settings save failed: {str(e)}")

        # ── Timezone change detection: recalculate floating alerts ──
        # If timezone_override or default_timezone changed, trigger recalculation
        # of all pending floating chit alerts in a background task (within 60s).
        try:
            _tz_changed = False
            if old_settings_dict:
                old_override = (old_settings_dict.get("timezone_override") or "").strip()
                old_default = (old_settings_dict.get("default_timezone") or "").strip()
                new_override = (update_dict.get("timezone_override", old_override) or "").strip() if "timezone_override" in update_dict else old_override
                new_default = (update_dict.get("default_timezone", old_default) or "").strip() if "default_timezone" in update_dict else old_default
                # Determine effective timezone before and after
                old_effective = old_override if old_override else (old_default if old_default else "UTC")
                new_effective = new_override if new_override else (new_default if new_default else "UTC")
                if old_effective != new_effective:
                    _tz_changed = True
            elif "timezone_override" in update_dict or "default_timezone" in update_dict:
                # New user row — any timezone setting is a "change" from default UTC
                _tz_changed = True

            if _tz_changed:
                from src.backend.schedulers import recalculate_floating_alerts
                background_tasks.add_task(recalculate_floating_alerts, authenticated_user_id)
                logger.info(f"Timezone change detected for user '{authenticated_user_id}' — scheduled floating alert recalculation")
        except Exception as e:
            logger.error(f"Timezone change detection failed: {str(e)}")

        return {"user_id": authenticated_user_id, "status": "ok"}
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


# ═══════════════════════════════════════════════════════════════════════════
# Sort Orders (per-view manual chit ordering, persisted across devices)
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/api/sort-orders")
def get_sort_orders(request: Request):
    """Get all manual sort orders for the authenticated user."""
    conn = None
    try:
        user_id = request.state.user_id
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute(
            "SELECT view_tab, order_data, modified_datetime FROM sort_orders WHERE owner_id = ?",
            (user_id,)
        )
        rows = cursor.fetchall()
        result = {}
        for row in rows:
            result[row["view_tab"]] = deserialize_json_field(row["order_data"])
        return result
    except Exception as e:
        logger.error(f"Error fetching sort orders: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.close()


@router.put("/api/sort-orders/{view_tab}")
def save_sort_order(view_tab: str, body: dict, request: Request):
    """Save the manual sort order for a specific view tab."""
    conn = None
    try:
        user_id = request.state.user_id
        ids = body.get("ids", [])
        now = datetime.utcnow().isoformat() + "Z"
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute(
            """INSERT INTO sort_orders (owner_id, view_tab, order_data, modified_datetime)
               VALUES (?, ?, ?, ?)
               ON CONFLICT(owner_id, view_tab) DO UPDATE SET
                 order_data = excluded.order_data,
                 modified_datetime = excluded.modified_datetime""",
            (user_id, view_tab, serialize_json_field(ids), now)
        )
        conn.commit()
        return {"status": "ok", "view_tab": view_tab, "count": len(ids)}
    except Exception as e:
        logger.error(f"Error saving sort order: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.close()


@router.delete("/api/sort-orders")
def delete_all_sort_orders(request: Request):
    """Delete all manual sort orders and sort preferences for the authenticated user."""
    conn = None
    try:
        user_id = request.state.user_id
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("DELETE FROM sort_orders WHERE owner_id = ?", (user_id,))
        cursor.execute("DELETE FROM sort_preferences WHERE owner_id = ?", (user_id,))
        conn.commit()
        return {"status": "ok", "message": "All sort orders and preferences reset"}
    except Exception as e:
        logger.error(f"Error deleting sort orders: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.close()


# ═══════════════════════════════════════════════════════════════════════════
# Sort Preferences (per-view sort field + direction, persisted across devices)
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/api/sort-preferences")
def get_sort_preferences(request: Request):
    """Get all sort preferences (field + direction) for the authenticated user."""
    conn = None
    try:
        user_id = request.state.user_id
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute(
            "SELECT view_tab, sort_field, sort_dir FROM sort_preferences WHERE owner_id = ?",
            (user_id,)
        )
        rows = cursor.fetchall()
        result = {}
        for row in rows:
            result[row["view_tab"]] = {"field": row["sort_field"], "dir": row["sort_dir"]}
        return result
    except Exception as e:
        logger.error(f"Error fetching sort preferences: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.close()


@router.put("/api/sort-preferences/{view_tab}")
def save_sort_preference(view_tab: str, body: dict, request: Request):
    """Save the sort preference (field + direction) for a specific view tab."""
    conn = None
    try:
        user_id = request.state.user_id
        sort_field = body.get("field", "")
        sort_dir = body.get("dir", "asc")
        now = datetime.utcnow().isoformat() + "Z"
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        if not sort_field:
            # Empty field means "no sort" — delete the preference
            cursor.execute(
                "DELETE FROM sort_preferences WHERE owner_id = ? AND view_tab = ?",
                (user_id, view_tab)
            )
        else:
            cursor.execute(
                """INSERT INTO sort_preferences (owner_id, view_tab, sort_field, sort_dir, modified_datetime)
                   VALUES (?, ?, ?, ?, ?)
                   ON CONFLICT(owner_id, view_tab) DO UPDATE SET
                     sort_field = excluded.sort_field,
                     sort_dir = excluded.sort_dir,
                     modified_datetime = excluded.modified_datetime""",
                (user_id, view_tab, sort_field, sort_dir, now)
            )
        conn.commit()
        return {"status": "ok", "view_tab": view_tab, "field": sort_field, "dir": sort_dir}
    except Exception as e:
        logger.error(f"Error saving sort preference: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.close()
