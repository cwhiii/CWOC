"""Chit import/export API routes.

Provides endpoints for exporting and importing chits, userdata, and combined
all-data bundles.
"""

import json
import logging
import sqlite3
from datetime import datetime
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request

from src.backend.db import (
    DB_PATH, serialize_json_field, deserialize_json_field,
    compute_system_tags, _build_export_envelope, ensure_tags_in_settings,
)
from src.backend.models import Chit, ImportRequest
from src.backend.routes.audit import insert_audit_entry, compute_audit_diff, get_actor_from_request
from src.backend.sharing import resolve_effective_role
from src.backend.rules_engine import dispatch_trigger


logger = logging.getLogger(__name__)
router = APIRouter()

# ═══════════════════════════════════════════════════════════════════════════
# Data Management Export/Import
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/api/export/chits")
def export_chits(request: Request):
    """Export ALL chit records (including soft-deleted) for the authenticated user as a JSON export envelope."""
    conn = None
    try:
        user_id = request.state.user_id
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM chits WHERE owner_id = ?", (user_id,))
        rows = cursor.fetchall()

        chits = []
        for row in rows:
            chit = dict(row)
            # Deserialize JSON-serialized fields
            chit["tags"] = deserialize_json_field(chit.get("tags"))
            chit["checklist"] = deserialize_json_field(chit.get("checklist"))
            chit["people"] = deserialize_json_field(chit.get("people"))
            chit["child_chits"] = deserialize_json_field(chit.get("child_chits"))
            chit["alerts"] = deserialize_json_field(chit.get("alerts"))
            chit["recurrence_rule"] = deserialize_json_field(chit.get("recurrence_rule"))
            chit["recurrence_exceptions"] = deserialize_json_field(chit.get("recurrence_exceptions"))
            chit["weather_data"] = deserialize_json_field(chit.get("weather_data"))
            chit["health_data"] = deserialize_json_field(chit.get("health_data"))
            # Convert boolean fields to native booleans
            chit["alarm"] = bool(chit.get("alarm"))
            chit["notification"] = bool(chit.get("notification"))
            chit["pinned"] = bool(chit.get("pinned"))
            chit["archived"] = bool(chit.get("archived"))
            chit["deleted"] = bool(chit.get("deleted"))
            chit["is_project_master"] = bool(chit.get("is_project_master"))
            chit["all_day"] = bool(chit.get("all_day"))
            chit["habit"] = bool(chit.get("habit"))
            chit["habit_goal"] = int(chit.get("habit_goal") or 1)
            chit["habit_success"] = int(chit.get("habit_success") or 0)
            chit["show_on_calendar"] = bool(chit.get("show_on_calendar", 1))
            chit["shares"] = deserialize_json_field(chit.get("shares"))
            chit["stealth"] = bool(chit.get("stealth"))
            chit["assigned_to"] = chit.get("assigned_to")
            chits.append(chit)

        envelope = _build_export_envelope("chits", chits)
        return Response(content=json.dumps(envelope, indent=2), media_type="application/json")
    except Exception as e:
        logger.error(f"Export chits failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")
    finally:
        if conn:
            conn.close()


@router.get("/api/export/userdata")
def export_userdata(request: Request):
    """Export ALL settings and contacts records for the authenticated user as a JSON export envelope."""
    conn = None
    try:
        user_id = request.state.user_id
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # --- Settings ---
        cursor.execute("SELECT * FROM settings WHERE user_id = ?", (user_id,))
        settings_rows = cursor.fetchall()
        settings = []
        for row in settings_rows:
            s = dict(row)
            s["tags"] = deserialize_json_field(s.get("tags"))
            s["default_filters"] = deserialize_json_field(s.get("default_filters"))
            s["custom_colors"] = deserialize_json_field(s.get("custom_colors"))
            s["visual_indicators"] = deserialize_json_field(s.get("visual_indicators"))
            s["chit_options"] = deserialize_json_field(s.get("chit_options"))
            # active_clocks is a comma-separated string, not JSON — keep as-is
            s["saved_locations"] = deserialize_json_field(s.get("saved_locations"))
            s["default_notifications"] = deserialize_json_field(s.get("default_notifications"))
            settings.append(s)

        # Strip sensitive fields from settings before export
        _SENSITIVE_SETTINGS_FIELDS = ("email_account", "email_accounts")
        for s in settings:
            for field in _SENSITIVE_SETTINGS_FIELDS:
                s.pop(field, None)

        # --- Contacts ---
        cursor.execute("SELECT * FROM contacts WHERE owner_id = ?", (user_id,))
        contact_rows = cursor.fetchall()
        contacts = []
        for row in contact_rows:
            c = dict(row)
            c["phones"] = deserialize_json_field(c.get("phones"))
            c["emails"] = deserialize_json_field(c.get("emails"))
            c["addresses"] = deserialize_json_field(c.get("addresses"))
            c["call_signs"] = deserialize_json_field(c.get("call_signs"))
            c["x_handles"] = deserialize_json_field(c.get("x_handles"))
            c["websites"] = deserialize_json_field(c.get("websites"))
            c["tags"] = deserialize_json_field(c.get("tags"))
            c["has_signal"] = bool(c.get("has_signal"))
            c["favorite"] = bool(c.get("favorite"))
            contacts.append(c)

        envelope = _build_export_envelope("userdata", {"settings": settings, "contacts": contacts})
        return Response(content=json.dumps(envelope, indent=2), media_type="application/json")
    except Exception as e:
        logger.error(f"Export userdata failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")
    finally:
        if conn:
            conn.close()


@router.post("/api/import/chits")
def import_chits(req: ImportRequest, request: Request):
    """Import chit records from a JSON export envelope."""
    # Validate mode
    if req.mode not in ("add", "replace"):
        raise HTTPException(status_code=400, detail="Invalid mode: must be 'add' or 'replace'")

    envelope = req.data

    # Validate envelope required fields
    for field in ("type", "version", "exported_at", "data"):
        if field not in envelope:
            raise HTTPException(status_code=400, detail="Invalid export envelope: missing required fields")

    # Validate envelope type
    if envelope.get("type") != "chits":
        raise HTTPException(status_code=400, detail="Invalid data: expected type 'chits'")

    records = envelope.get("data", [])
    if not isinstance(records, list):
        raise HTTPException(status_code=400, detail="Invalid data: expected 'data' to be a list")

    conn = None
    try:
        user_id = request.state.user_id
        conn = sqlite3.connect(DB_PATH)
        conn.execute("BEGIN")

        # Look up owner info for imported chits
        cursor = conn.cursor()
        cursor.execute("SELECT display_name, username FROM users WHERE id = ?", (user_id,))
        user_row = cursor.fetchone()
        owner_display_name = user_row[0] if user_row else ""
        owner_username = user_row[1] if user_row else request.state.username

        if req.mode == "replace":
            conn.execute("DELETE FROM chits WHERE owner_id = ?", (user_id,))

        imported = 0
        for chit in records:
            new_id = str(uuid4())
            conn.execute(
                """INSERT INTO chits (
                    id, title, note, tags, start_datetime, end_datetime,
                    due_datetime, completed_datetime, status, priority, severity,
                    checklist, alarm, notification, recurrence, recurrence_id,
                    location, color, people, pinned, archived, deleted,
                    created_datetime, modified_datetime, is_project_master,
                    child_chits, all_day, alerts, recurrence_rule,
                    recurrence_exceptions, progress_percent, time_estimate,
                    weather_data, health_data,
                    habit, habit_goal, habit_success, show_on_calendar,
                    owner_id, owner_display_name, owner_username,
                    shares, stealth, assigned_to,
                    availability
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (
                    new_id,
                    chit.get("title"),
                    chit.get("note"),
                    serialize_json_field(chit.get("tags")),
                    chit.get("start_datetime"),
                    chit.get("end_datetime"),
                    chit.get("due_datetime"),
                    chit.get("completed_datetime"),
                    chit.get("status"),
                    chit.get("priority"),
                    chit.get("severity"),
                    serialize_json_field(chit.get("checklist")),
                    1 if chit.get("alarm") else 0,
                    1 if chit.get("notification") else 0,
                    chit.get("recurrence"),
                    chit.get("recurrence_id"),
                    chit.get("location"),
                    chit.get("color"),
                    serialize_json_field(chit.get("people")),
                    1 if chit.get("pinned") else 0,
                    1 if chit.get("archived") else 0,
                    1 if chit.get("deleted") else 0,
                    chit.get("created_datetime"),
                    chit.get("modified_datetime"),
                    1 if chit.get("is_project_master") else 0,
                    serialize_json_field(chit.get("child_chits")),
                    1 if chit.get("all_day") else 0,
                    serialize_json_field(chit.get("alerts")),
                    serialize_json_field(chit.get("recurrence_rule")),
                    serialize_json_field(chit.get("recurrence_exceptions")),
                    chit.get("progress_percent"),
                    chit.get("time_estimate"),
                    serialize_json_field(chit.get("weather_data")),
                    serialize_json_field(chit.get("health_data")),
                    1 if chit.get("habit") else 0,
                    chit.get("habit_goal") if chit.get("habit_goal") is not None else 1,
                    chit.get("habit_success") if chit.get("habit_success") is not None else 0,
                    1 if chit.get("show_on_calendar", True) else 0,
                    user_id,
                    owner_display_name,
                    owner_username,
                    serialize_json_field(chit.get("shares")),
                    1 if chit.get("stealth") else 0,
                    chit.get("assigned_to"),
                    chit.get("availability"),
                ),
            )
            imported += 1

        conn.commit()
        
        # Merge any new tags from imported chits into the user's settings tag list
        try:
            all_imported_tags = []
            for chit in records:
                chit_tags = chit.get("tags") or []
                if isinstance(chit_tags, str):
                    try:
                        chit_tags = json.loads(chit_tags)
                    except (json.JSONDecodeError, TypeError):
                        chit_tags = []
                for tag_name in chit_tags:
                    if tag_name and isinstance(tag_name, str):
                        all_imported_tags.append(tag_name)
            ensure_tags_in_settings(conn, user_id, all_imported_tags)
        except Exception as e:
            logger.warning(f"Could not merge imported tags into settings: {str(e)}")

        return {"summary": {"imported": imported}}
    except HTTPException:
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Import chits failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")
    finally:
        if conn:
            conn.close()


@router.post("/api/import/userdata")
def import_userdata(req: ImportRequest, request: Request):
    """Import user data (settings + contacts) from a JSON export envelope."""
    # Validate mode
    if req.mode not in ("add", "replace"):
        raise HTTPException(status_code=400, detail="Invalid mode: must be 'add' or 'replace'")

    envelope = req.data

    # Validate envelope required fields
    for field in ("type", "version", "exported_at", "data"):
        if field not in envelope:
            raise HTTPException(status_code=400, detail="Invalid export envelope: missing required fields")

    # Validate envelope type
    if envelope.get("type") != "userdata":
        raise HTTPException(status_code=400, detail="Invalid data: expected type 'userdata'")

    payload = envelope.get("data", {})
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Invalid data: expected 'data' to be an object")

    settings_records = payload.get("settings", [])
    contact_records = payload.get("contacts", [])

    conn = None
    try:
        user_id = request.state.user_id
        conn = sqlite3.connect(DB_PATH)
        conn.execute("BEGIN")

        if req.mode == "replace":
            # ── Replace mode: delete user's data, then insert all ──
            conn.execute("DELETE FROM settings WHERE user_id = ?", (user_id,))
            conn.execute("DELETE FROM contacts WHERE owner_id = ?", (user_id,))

            settings_replaced = 0
            for s in settings_records:
                conn.execute(
                    """INSERT OR REPLACE INTO settings (
                        user_id, time_format, sex, snooze_length, default_filters,
                        alarm_orientation, active_clocks, saved_locations, tags, custom_colors,
                        visual_indicators, chit_options, calendar_snap, week_start_day,
                        work_start_hour, work_end_hour, work_days, enabled_periods,
                        custom_days_count, all_view_start_hour, all_view_end_hour,
                        day_scroll_to_hour, username, audit_log_max_days, audit_log_max_mb
                    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                    (
                        s.get("user_id"),
                        s.get("time_format"),
                        s.get("sex"),
                        s.get("snooze_length"),
                        serialize_json_field(s.get("default_filters")),
                        s.get("alarm_orientation"),
                        s.get("active_clocks"),
                        serialize_json_field(s.get("saved_locations")),
                        serialize_json_field(s.get("tags")),
                        serialize_json_field(s.get("custom_colors")),
                        serialize_json_field(s.get("visual_indicators")),
                        serialize_json_field(s.get("chit_options")),
                        s.get("calendar_snap"),
                        s.get("week_start_day"),
                        s.get("work_start_hour"),
                        s.get("work_end_hour"),
                        s.get("work_days"),
                        s.get("enabled_periods"),
                        s.get("custom_days_count"),
                        s.get("all_view_start_hour"),
                        s.get("all_view_end_hour"),
                        s.get("day_scroll_to_hour"),
                        s.get("username"),
                        s.get("audit_log_max_days"),
                        s.get("audit_log_max_mb"),
                    ),
                )
                settings_replaced += 1

            contacts_replaced = 0
            for c in contact_records:
                new_id = str(uuid4())
                conn.execute(
                    """INSERT INTO contacts (
                        id, given_name, surname, middle_names, prefix, suffix,
                        nickname, display_name, phones, emails, addresses, call_signs,
                        x_handles, websites, has_signal, signal_username, pgp_key, favorite,
                        color, organization, social_context, image_url, notes, tags,
                        created_datetime, modified_datetime, owner_id
                    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                    (
                        new_id,
                        c.get("given_name"),
                        c.get("surname"),
                        c.get("middle_names"),
                        c.get("prefix"),
                        c.get("suffix"),
                        c.get("nickname"),
                        c.get("display_name"),
                        serialize_json_field(c.get("phones")),
                        serialize_json_field(c.get("emails")),
                        serialize_json_field(c.get("addresses")),
                        serialize_json_field(c.get("call_signs")),
                        serialize_json_field(c.get("x_handles")),
                        serialize_json_field(c.get("websites")),
                        1 if c.get("has_signal") else 0,
                        c.get("signal_username"),
                        c.get("pgp_key"),
                        1 if c.get("favorite") else 0,
                        c.get("color"),
                        c.get("organization"),
                        c.get("social_context"),
                        c.get("image_url"),
                        c.get("notes"),
                        serialize_json_field(c.get("tags")),
                        c.get("created_datetime"),
                        c.get("modified_datetime"),
                        user_id,
                    ),
                )
                contacts_replaced += 1

            conn.commit()
            return {"summary": {"settings_replaced": settings_replaced, "contacts_replaced": contacts_replaced}}

        else:
            # ── Add mode: merge settings arrays, insert non-duplicate contacts ──
            settings_merged = 0
            for s in settings_records:
                settings_user_id = s.get("user_id", user_id)
                cursor = conn.cursor()
                cursor.execute("SELECT * FROM settings WHERE user_id = ?", (settings_user_id,))
                existing_row = cursor.fetchone()

                if existing_row:
                    col_names = [desc[0] for desc in cursor.description]
                    existing = dict(zip(col_names, existing_row))

                    # Deserialize existing array fields
                    existing_tags = deserialize_json_field(existing.get("tags")) or []
                    existing_custom_colors = deserialize_json_field(existing.get("custom_colors")) or []
                    existing_saved_locations = deserialize_json_field(existing.get("saved_locations")) or []

                    # Imported array fields (already deserialized in envelope)
                    imported_tags = s.get("tags") or []
                    imported_custom_colors = s.get("custom_colors") or []
                    imported_saved_locations = s.get("saved_locations") or []

                    # Merge tags: deduplicate by tag name
                    existing_tag_names = {t.get("name") for t in existing_tags if isinstance(t, dict)}
                    for tag in imported_tags:
                        if isinstance(tag, dict) and tag.get("name") not in existing_tag_names:
                            existing_tags.append(tag)
                            existing_tag_names.add(tag.get("name"))

                    # Merge custom_colors: deduplicate by string value
                    existing_color_set = set(existing_custom_colors)
                    for color in imported_custom_colors:
                        if color not in existing_color_set:
                            existing_custom_colors.append(color)
                            existing_color_set.add(color)

                    # Merge saved_locations: deduplicate by label
                    existing_loc_labels = {loc.get("label") for loc in existing_saved_locations if isinstance(loc, dict)}
                    for loc in imported_saved_locations:
                        if isinstance(loc, dict) and loc.get("label") not in existing_loc_labels:
                            existing_saved_locations.append(loc)
                            existing_loc_labels.add(loc.get("label"))

                    # UPDATE existing row with merged arrays only
                    conn.execute(
                        """UPDATE settings SET tags = ?, custom_colors = ?, saved_locations = ?
                           WHERE user_id = ?""",
                        (
                            serialize_json_field(existing_tags),
                            serialize_json_field(existing_custom_colors),
                            serialize_json_field(existing_saved_locations),
                            settings_user_id,
                        ),
                    )
                    settings_merged += 1
                else:
                    # No existing settings row — insert the imported one
                    conn.execute(
                        """INSERT OR REPLACE INTO settings (
                            user_id, time_format, sex, snooze_length, default_filters,
                            alarm_orientation, active_clocks, saved_locations, tags, custom_colors,
                            visual_indicators, chit_options, calendar_snap, week_start_day,
                            work_start_hour, work_end_hour, work_days, enabled_periods,
                            custom_days_count, all_view_start_hour, all_view_end_hour,
                            day_scroll_to_hour, username, audit_log_max_days, audit_log_max_mb
                        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                        (
                            settings_user_id,
                            s.get("time_format"),
                            s.get("sex"),
                            s.get("snooze_length"),
                            serialize_json_field(s.get("default_filters")),
                            s.get("alarm_orientation"),
                            s.get("active_clocks"),
                            serialize_json_field(s.get("saved_locations")),
                            serialize_json_field(s.get("tags")),
                            serialize_json_field(s.get("custom_colors")),
                            serialize_json_field(s.get("visual_indicators")),
                            serialize_json_field(s.get("chit_options")),
                            s.get("calendar_snap"),
                            s.get("week_start_day"),
                            s.get("work_start_hour"),
                            s.get("work_end_hour"),
                            s.get("work_days"),
                            s.get("enabled_periods"),
                            s.get("custom_days_count"),
                            s.get("all_view_start_hour"),
                            s.get("all_view_end_hour"),
                            s.get("day_scroll_to_hour"),
                            s.get("username"),
                            s.get("audit_log_max_days"),
                            s.get("audit_log_max_mb"),
                        ),
                    )
                    settings_merged += 1

            # ── Add mode contacts: skip duplicates by display_name + given_name ──
            cursor = conn.cursor()
            cursor.execute("SELECT display_name, given_name FROM contacts WHERE owner_id = ?", (user_id,))
            existing_contacts = {(row[0], row[1]) for row in cursor.fetchall()}

            contacts_added = 0
            contacts_skipped = 0
            for c in contact_records:
                dn = c.get("display_name")
                gn = c.get("given_name")
                if (dn, gn) in existing_contacts:
                    contacts_skipped += 1
                    continue

                new_id = str(uuid4())
                conn.execute(
                    """INSERT INTO contacts (
                        id, given_name, surname, middle_names, prefix, suffix,
                        nickname, display_name, phones, emails, addresses, call_signs,
                        x_handles, websites, has_signal, signal_username, pgp_key, favorite,
                        color, organization, social_context, image_url, notes, tags,
                        created_datetime, modified_datetime, owner_id
                    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                    (
                        new_id,
                        c.get("given_name"),
                        c.get("surname"),
                        c.get("middle_names"),
                        c.get("prefix"),
                        c.get("suffix"),
                        c.get("nickname"),
                        c.get("display_name"),
                        serialize_json_field(c.get("phones")),
                        serialize_json_field(c.get("emails")),
                        serialize_json_field(c.get("addresses")),
                        serialize_json_field(c.get("call_signs")),
                        serialize_json_field(c.get("x_handles")),
                        serialize_json_field(c.get("websites")),
                        1 if c.get("has_signal") else 0,
                        c.get("signal_username"),
                        c.get("pgp_key"),
                        1 if c.get("favorite") else 0,
                        c.get("color"),
                        c.get("organization"),
                        c.get("social_context"),
                        c.get("image_url"),
                        c.get("notes"),
                        serialize_json_field(c.get("tags")),
                        c.get("created_datetime"),
                        c.get("modified_datetime"),
                        user_id,
                    ),
                )
                contacts_added += 1

            conn.commit()
            return {"summary": {"contacts_added": contacts_added, "contacts_skipped": contacts_skipped, "settings_merged": settings_merged}}

    except HTTPException:
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Import userdata failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")
    finally:
        if conn:
            conn.close()


@router.get("/api/export/all")
def export_all(request: Request):
    """Export ALL data (chits + settings + contacts) for the authenticated user as a single combined JSON envelope."""
    conn = None
    try:
        user_id = request.state.user_id
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # ── Chits ──
        cursor.execute("SELECT * FROM chits WHERE owner_id = ?", (user_id,))
        chits = []
        for row in cursor.fetchall():
            chit = dict(row)
            for f in ("tags", "checklist", "people", "child_chits", "alerts",
                       "recurrence_rule", "recurrence_exceptions", "weather_data", "health_data", "shares"):
                chit[f] = deserialize_json_field(chit.get(f))
            for f in ("alarm", "notification", "pinned", "archived", "deleted", "is_project_master", "all_day", "habit", "stealth"):
                chit[f] = bool(chit.get(f))
            chit["habit_goal"] = int(chit.get("habit_goal") or 1)
            chit["habit_success"] = int(chit.get("habit_success") or 0)
            chit["show_on_calendar"] = bool(chit.get("show_on_calendar", 1))
            chits.append(chit)

        # ── Settings ──
        cursor.execute("SELECT * FROM settings WHERE user_id = ?", (user_id,))
        settings = []
        for row in cursor.fetchall():
            s = dict(row)
            for f in ("tags", "default_filters", "custom_colors", "visual_indicators",
                       "chit_options", "saved_locations", "default_notifications"):
                s[f] = deserialize_json_field(s.get(f))
            settings.append(s)

        # Strip sensitive fields from settings before export
        _SENSITIVE_SETTINGS_FIELDS = ("email_account", "email_accounts")
        for s in settings:
            for field in _SENSITIVE_SETTINGS_FIELDS:
                s.pop(field, None)

        # ── Contacts ──
        cursor.execute("SELECT * FROM contacts WHERE owner_id = ?", (user_id,))
        contacts = []
        for row in cursor.fetchall():
            c = dict(row)
            for f in ("phones", "emails", "addresses", "call_signs", "x_handles", "websites", "tags"):
                c[f] = deserialize_json_field(c.get(f))
            for f in ("has_signal", "favorite"):
                c[f] = bool(c.get(f))
            contacts.append(c)

        # ── Standalone alerts ──
        sa_alerts = []
        try:
            cursor.execute("SELECT * FROM standalone_alerts")
            for row in cursor.fetchall():
                a = dict(row)
                a["data"] = deserialize_json_field(a.get("data"))
                sa_alerts.append(a)
        except Exception:
            pass  # table may not exist

        envelope = _build_export_envelope("all", {
            "chits": chits,
            "settings": settings,
            "contacts": contacts,
            "standalone_alerts": sa_alerts,
        })
        return Response(content=json.dumps(envelope, indent=2), media_type="application/json")
    except Exception as e:
        logger.error(f"Export all failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")
    finally:
        if conn:
            conn.close()


@router.post("/api/import/all")
def import_all(req: ImportRequest, request: Request):
    """Import ALL data (chits + settings + contacts + standalone alerts) from a combined envelope."""
    if req.mode not in ("add", "replace"):
        raise HTTPException(status_code=400, detail="Invalid mode: must be 'add' or 'replace'")

    envelope = req.data
    for field in ("type", "version", "exported_at", "data"):
        if field not in envelope:
            raise HTTPException(status_code=400, detail="Invalid export envelope: missing required fields")

    if envelope.get("type") != "all":
        raise HTTPException(status_code=400, detail="Invalid data: expected type 'all'")

    payload = envelope.get("data", {})
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Invalid data: expected 'data' to be an object")

    conn = None
    try:
        user_id = request.state.user_id
        conn = sqlite3.connect(DB_PATH)
        conn.execute("BEGIN")

        # Look up owner info for imported data
        cur = conn.cursor()
        cur.execute("SELECT display_name, username FROM users WHERE id = ?", (user_id,))
        user_row = cur.fetchone()
        owner_display_name = user_row[0] if user_row else ""
        owner_username = user_row[1] if user_row else request.state.username

        summary = {}

        if req.mode == "replace":
            conn.execute("DELETE FROM chits WHERE owner_id = ?", (user_id,))
            conn.execute("DELETE FROM settings WHERE user_id = ?", (user_id,))
            conn.execute("DELETE FROM contacts WHERE owner_id = ?", (user_id,))
            try:
                conn.execute("DELETE FROM standalone_alerts")
            except Exception:
                pass

        # ── Import chits ──
        chit_count = 0
        for chit in payload.get("chits", []):
            new_id = str(uuid4()) if req.mode == "add" else (chit.get("id") or str(uuid4()))
            conn.execute(
                """INSERT OR REPLACE INTO chits (
                    id, title, note, tags, start_datetime, end_datetime,
                    due_datetime, completed_datetime, status, priority, severity,
                    checklist, alarm, notification, recurrence, recurrence_id,
                    location, color, people, pinned, archived, deleted,
                    created_datetime, modified_datetime, is_project_master,
                    child_chits, all_day, alerts, recurrence_rule,
                    recurrence_exceptions, progress_percent, time_estimate,
                    weather_data, health_data,
                    habit, habit_goal, habit_success, show_on_calendar,
                    owner_id, owner_display_name, owner_username,
                    shares, stealth, assigned_to, availability
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (
                    new_id, chit.get("title"), chit.get("note"),
                    serialize_json_field(chit.get("tags")),
                    chit.get("start_datetime"), chit.get("end_datetime"),
                    chit.get("due_datetime"), chit.get("completed_datetime"),
                    chit.get("status"), chit.get("priority"), chit.get("severity"),
                    serialize_json_field(chit.get("checklist")),
                    1 if chit.get("alarm") else 0, 1 if chit.get("notification") else 0,
                    chit.get("recurrence"), chit.get("recurrence_id"),
                    chit.get("location"), chit.get("color"),
                    serialize_json_field(chit.get("people")),
                    1 if chit.get("pinned") else 0, 1 if chit.get("archived") else 0,
                    1 if chit.get("deleted") else 0,
                    chit.get("created_datetime"), chit.get("modified_datetime"),
                    1 if chit.get("is_project_master") else 0,
                    serialize_json_field(chit.get("child_chits")),
                    1 if chit.get("all_day") else 0,
                    serialize_json_field(chit.get("alerts")),
                    serialize_json_field(chit.get("recurrence_rule")),
                    serialize_json_field(chit.get("recurrence_exceptions")),
                    chit.get("progress_percent"), chit.get("time_estimate"),
                    serialize_json_field(chit.get("weather_data")),
                    serialize_json_field(chit.get("health_data")),
                    1 if chit.get("habit") else 0,
                    chit.get("habit_goal") if chit.get("habit_goal") is not None else 1,
                    chit.get("habit_success") if chit.get("habit_success") is not None else 0,
                    1 if chit.get("show_on_calendar", True) else 0,
                    user_id,
                    owner_display_name,
                    owner_username,
                    serialize_json_field(chit.get("shares")),
                    1 if chit.get("stealth") else 0,
                    chit.get("assigned_to"),
                    chit.get("availability"),
                ),
            )
            chit_count += 1
        summary["chits_imported"] = chit_count

        # ── Import settings ──
        settings_count = 0
        for s in payload.get("settings", []):
            conn.execute(
                """INSERT OR REPLACE INTO settings (
                    user_id, time_format, sex, snooze_length, default_filters,
                    alarm_orientation, active_clocks, saved_locations, tags, custom_colors,
                    visual_indicators, chit_options, calendar_snap, week_start_day,
                    work_start_hour, work_end_hour, work_days, enabled_periods,
                    custom_days_count, all_view_start_hour, all_view_end_hour,
                    day_scroll_to_hour, username, audit_log_max_days, audit_log_max_mb,
                    default_notifications, unit_system, default_show_habits_on_calendar
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (
                    s.get("user_id"), s.get("time_format"), s.get("sex"), s.get("snooze_length"),
                    serialize_json_field(s.get("default_filters")),
                    s.get("alarm_orientation"), s.get("active_clocks"),
                    serialize_json_field(s.get("saved_locations")),
                    serialize_json_field(s.get("tags")),
                    serialize_json_field(s.get("custom_colors")),
                    serialize_json_field(s.get("visual_indicators")),
                    serialize_json_field(s.get("chit_options")),
                    s.get("calendar_snap"), s.get("week_start_day"),
                    s.get("work_start_hour"), s.get("work_end_hour"),
                    s.get("work_days"), s.get("enabled_periods"),
                    s.get("custom_days_count"), s.get("all_view_start_hour"),
                    s.get("all_view_end_hour"), s.get("day_scroll_to_hour"),
                    s.get("username"), s.get("audit_log_max_days"), s.get("audit_log_max_mb"),
                    serialize_json_field(s.get("default_notifications")),
                    s.get("unit_system"),
                    s.get("default_show_habits_on_calendar", "1"),
                ),
            )
            settings_count += 1
        summary["settings_imported"] = settings_count

        # ── Import contacts ──
        contacts_count = 0
        for c in payload.get("contacts", []):
            new_id = str(uuid4()) if req.mode == "add" else (c.get("id") or str(uuid4()))
            conn.execute(
                """INSERT OR REPLACE INTO contacts (
                    id, given_name, surname, middle_names, prefix, suffix, nickname,
                    display_name, phones, emails, addresses, call_signs, x_handles,
                    websites, notes, color, image_url, tags, has_signal, favorite,
                    created_datetime, modified_datetime, owner_id
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (
                    new_id, c.get("given_name"), c.get("surname"), c.get("middle_names"),
                    c.get("prefix"), c.get("suffix"), c.get("nickname"), c.get("display_name"),
                    serialize_json_field(c.get("phones")),
                    serialize_json_field(c.get("emails")),
                    serialize_json_field(c.get("addresses")),
                    serialize_json_field(c.get("call_signs")),
                    serialize_json_field(c.get("x_handles")),
                    serialize_json_field(c.get("websites")),
                    c.get("notes"), c.get("color"), c.get("image_url"),
                    serialize_json_field(c.get("tags")),
                    1 if c.get("has_signal") else 0, 1 if c.get("favorite") else 0,
                    c.get("created_datetime"), c.get("modified_datetime"),
                    user_id,
                ),
            )
            contacts_count += 1
        summary["contacts_imported"] = contacts_count

        # ── Import standalone alerts ──
        alerts_count = 0
        for a in payload.get("standalone_alerts", []):
            new_id = str(uuid4()) if req.mode == "add" else (a.get("id") or str(uuid4()))
            conn.execute(
                "INSERT OR REPLACE INTO standalone_alerts (id, data, created_at) VALUES (?,?,?)",
                (new_id, serialize_json_field(a.get("data")), a.get("created_at")),
            )
            alerts_count += 1
        summary["alerts_imported"] = alerts_count

        conn.commit()

        # Merge any new tags from imported chits into the user's settings tag list
        try:
            cur.execute("SELECT tags FROM settings WHERE user_id = ?", (user_id,))
            settings_row = cur.fetchone()
            existing_tags = []
            if settings_row and settings_row[0]:
                existing_tags = deserialize_json_field(settings_row[0]) or []

            existing_tag_names = set()
            for t in existing_tags:
                if isinstance(t, str):
                    existing_tag_names.add(t)
                elif isinstance(t, dict) and t.get("name"):
                    existing_tag_names.add(t["name"])

            new_tags_added = False
            for chit in payload.get("chits", []):
                chit_tags = chit.get("tags") or []
                if isinstance(chit_tags, str):
                    try:
                        chit_tags = json.loads(chit_tags)
                    except (json.JSONDecodeError, TypeError):
                        chit_tags = []
                for tag_name in chit_tags:
                    if not tag_name or not isinstance(tag_name, str):
                        continue
                    if tag_name.startswith("CWOC_System/"):
                        continue
                    if tag_name not in existing_tag_names:
                        existing_tag_names.add(tag_name)
                        existing_tags.append({"name": tag_name, "color": None, "favorite": False})
                        new_tags_added = True

            if new_tags_added:
                cur.execute(
                    "UPDATE settings SET tags = ? WHERE user_id = ?",
                    (serialize_json_field(existing_tags), user_id)
                )
                conn.commit()
        except Exception as e:
            logger.warning(f"Could not merge imported tags into settings: {str(e)}")

        return {"summary": summary}
    except HTTPException:
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Import all failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")
    finally:
        if conn:
            conn.close()
