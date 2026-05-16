"""Sync API routes for the CWOC backend.

Provides endpoints for mobile sync:
  GET  /api/sync/changes  — pull changes since a given sync version
  POST /api/sync/push     — push local changes from mobile clients
"""

import logging
import sqlite3
import time
from datetime import datetime
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query, Request

from src.backend.db import (
    DB_PATH,
    compute_system_tags,
    deserialize_json_field,
    get_next_sync_version,
    serialize_json_field,
)
from src.backend.routes.audit import insert_audit_entry

logger = logging.getLogger(__name__)

sync_router = APIRouter()


# ═══════════════════════════════════════════════════════════════════════════
# Chit Deserialization Helper
# ═══════════════════════════════════════════════════════════════════════════

def _deserialize_chit_for_sync(chit: dict) -> dict:
    """Deserialize JSON fields on a chit dict in place for sync response.

    Mirrors the deserialization done in the GET /api/chits endpoint.
    """
    chit["tags"] = deserialize_json_field(chit.get("tags"))
    chit["checklist"] = deserialize_json_field(chit.get("checklist"))
    chit["people"] = deserialize_json_field(chit.get("people"))
    chit["child_chits"] = deserialize_json_field(chit.get("child_chits"))
    chit["is_project_master"] = bool(chit.get("is_project_master"))
    chit["all_day"] = bool(chit.get("all_day"))
    chit["pinned"] = bool(chit.get("pinned"))
    chit["archived"] = bool(chit.get("archived"))
    chit["deleted"] = bool(chit.get("deleted"))
    chit["alarm"] = bool(chit.get("alarm"))
    chit["notification"] = bool(chit.get("notification"))
    chit["alerts"] = deserialize_json_field(chit.get("alerts"))
    chit["recurrence_rule"] = deserialize_json_field(chit.get("recurrence_rule"))
    chit["recurrence_exceptions"] = deserialize_json_field(chit.get("recurrence_exceptions"))
    chit["weather_data"] = deserialize_json_field(chit.get("weather_data"))
    chit["health_data"] = deserialize_json_field(chit.get("health_data"))
    chit["habit"] = bool(chit.get("habit"))
    chit["habit_goal"] = int(chit.get("habit_goal") or 1)
    chit["habit_success"] = int(chit.get("habit_success") or 0)
    chit["show_on_calendar"] = chit.get("show_on_calendar", 1) not in (0, False)
    chit["habit_reset_period"] = chit.get("habit_reset_period")
    chit["habit_last_action_date"] = chit.get("habit_last_action_date")
    chit["habit_hide_overall"] = bool(chit.get("habit_hide_overall"))
    chit["perpetual"] = bool(chit.get("perpetual"))
    chit["shares"] = deserialize_json_field(chit.get("shares"))
    chit["stealth"] = bool(chit.get("stealth"))
    chit["assigned_to"] = chit.get("assigned_to")
    chit["email_to"] = deserialize_json_field(chit.get("email_to"))
    chit["email_cc"] = deserialize_json_field(chit.get("email_cc"))
    chit["email_bcc"] = deserialize_json_field(chit.get("email_bcc"))
    chit["email_read"] = bool(chit.get("email_read")) if chit.get("email_read") is not None else None
    chit["snoozed_until"] = chit.get("snoozed_until")
    chit["prerequisites"] = deserialize_json_field(chit.get("prerequisites"))
    chit["checklist_autosave"] = bool(chit.get("checklist_autosave")) if chit.get("checklist_autosave") is not None else None
    chit["auto_complete_checklist"] = bool(chit.get("auto_complete_checklist")) if chit.get("auto_complete_checklist") is not None else None
    chit["has_unviewed_conflict"] = bool(chit.get("has_unviewed_conflict"))
    return chit


def _deserialize_contact_for_sync(contact: dict) -> dict:
    """Deserialize JSON fields on a contact dict in place for sync response."""
    contact["phones"] = deserialize_json_field(contact.get("phones"))
    contact["emails"] = deserialize_json_field(contact.get("emails"))
    contact["addresses"] = deserialize_json_field(contact.get("addresses"))
    contact["call_signs"] = deserialize_json_field(contact.get("call_signs"))
    contact["x_handles"] = deserialize_json_field(contact.get("x_handles"))
    contact["websites"] = deserialize_json_field(contact.get("websites"))
    contact["dates"] = deserialize_json_field(contact.get("dates"))
    contact["has_signal"] = bool(contact.get("has_signal"))
    contact["favorite"] = bool(contact.get("favorite"))
    contact["tags"] = deserialize_json_field(contact.get("tags"))
    contact["shared_to_vault"] = bool(contact.get("shared_to_vault"))
    return contact


# ═══════════════════════════════════════════════════════════════════════════
# Sync Pull Endpoint
# ═══════════════════════════════════════════════════════════════════════════

@sync_router.get("/api/sync/changes")
def get_sync_changes(
    request: Request,
    since: int = Query(default=0, description="Sync version to pull changes from"),
    include: Optional[str] = Query(default="chits", description="Comma-separated list: chits,contacts,settings"),
):
    """Pull all records changed since the given sync version.

    Returns chits (owned + shared), contacts, and/or settings that have
    sync_version > since. Includes soft-deleted chits so clients can
    remove them locally.

    The server_version field is the current max sync_version (next_version - 1)
    which the client stores as its high-water mark for the next pull.
    """
    conn = None
    try:
        user_id = request.state.user_id

        # Parse the include parameter
        include_set = set()
        if include:
            include_set = {item.strip().lower() for item in include.split(",")}
        if not include_set:
            include_set = {"chits"}

        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # Get the current server version (next_version - 1)
        cursor.execute("SELECT next_version FROM sync_state WHERE id = 1")
        row = cursor.fetchone()
        server_version = (row[0] - 1) if row else 0

        response = {"server_version": server_version}

        # ── Chits (owned + shared) ──────────────────────────────────────
        if "chits" in include_set:
            # Owned chits (including soft-deleted) with sync_version > since
            cursor.execute(
                """SELECT * FROM chits
                   WHERE owner_id = ? AND sync_version > ?""",
                (user_id, since),
            )
            columns = [col[0] for col in cursor.description]
            owned_chits = [dict(zip(columns, row)) for row in cursor.fetchall()]

            # Shared chits: chits not owned by user but shared via
            # chit-level shares or assignment, with sync_version > since
            cursor.execute(
                """SELECT * FROM chits
                   WHERE owner_id != ?
                     AND sync_version > ?
                     AND (stealth = 0 OR stealth IS NULL)
                     AND (shares LIKE ? OR assigned_to = ?)""",
                (user_id, since, f"%{user_id}%", user_id),
            )
            shared_chits = [dict(zip(columns, row)) for row in cursor.fetchall()]

            # Tag-level shared chits: check owner settings for shared_tags
            cursor.execute(
                """SELECT user_id, shared_tags FROM settings
                   WHERE shared_tags IS NOT NULL AND shared_tags LIKE ?""",
                (f"%{user_id}%",),
            )
            tag_shared_chits = []
            for settings_row in cursor.fetchall():
                owner_id = settings_row[0]
                shared_tags_raw = settings_row[1]
                shared_tags = deserialize_json_field(shared_tags_raw) or []

                # Find tags shared with this user
                relevant_tags = set()
                for tag_entry in shared_tags:
                    if not isinstance(tag_entry, dict):
                        continue
                    for share in (tag_entry.get("shares") or []):
                        if isinstance(share, dict) and share.get("user_id") == user_id:
                            relevant_tags.add(tag_entry.get("tag"))
                            break

                if not relevant_tags:
                    continue

                # Query chits from this owner with sync_version > since
                cursor.execute(
                    """SELECT * FROM chits
                       WHERE owner_id = ?
                         AND sync_version > ?
                         AND (stealth = 0 OR stealth IS NULL)""",
                    (owner_id, since),
                )
                for chit_row in cursor.fetchall():
                    chit = dict(zip(columns, chit_row))
                    # Check if any of the chit's tags match the shared tags
                    chit_tags_raw = deserialize_json_field(chit.get("tags"))
                    if chit_tags_raw:
                        chit_tag_names = set()
                        for t in chit_tags_raw:
                            if isinstance(t, str):
                                chit_tag_names.add(t)
                            elif isinstance(t, dict) and t.get("name"):
                                chit_tag_names.add(t["name"])
                        if chit_tag_names & relevant_tags:
                            tag_shared_chits.append(chit)

            # Merge all chits, deduplicating by ID
            all_chits_map = {}
            for chit in owned_chits:
                all_chits_map[chit["id"]] = chit
            for chit in shared_chits:
                if chit["id"] not in all_chits_map:
                    all_chits_map[chit["id"]] = chit
            for chit in tag_shared_chits:
                if chit["id"] not in all_chits_map:
                    all_chits_map[chit["id"]] = chit

            # Deserialize all chits
            chits_result = []
            for chit in all_chits_map.values():
                _deserialize_chit_for_sync(chit)
                chits_result.append(chit)

            response["chits"] = chits_result

        # ── Contacts ────────────────────────────────────────────────────
        if "contacts" in include_set:
            cursor.execute(
                """SELECT * FROM contacts
                   WHERE (owner_id = ? OR shared_to_vault = 1)
                     AND sync_version > ?""",
                (user_id, since),
            )
            columns = [col[0] for col in cursor.description]
            contacts_result = []
            for row in cursor.fetchall():
                contact = dict(zip(columns, row))
                _deserialize_contact_for_sync(contact)
                contacts_result.append(contact)

            response["contacts"] = contacts_result

        # ── Settings ────────────────────────────────────────────────────
        if "settings" in include_set:
            cursor.execute(
                """SELECT * FROM settings
                   WHERE user_id = ? AND sync_version > ?""",
                (user_id, since),
            )
            row = cursor.fetchone()
            if row:
                columns = [col[0] for col in cursor.description]
                settings = dict(zip(columns, row))
                # Deserialize JSON fields (same as GET /api/settings)
                settings["tags"] = deserialize_json_field(settings.get("tags"))
                settings["default_filters"] = deserialize_json_field(settings.get("default_filters"))
                settings["custom_colors"] = deserialize_json_field(settings.get("custom_colors"))
                settings["visual_indicators"] = deserialize_json_field(settings.get("visual_indicators"))
                settings["chit_options"] = deserialize_json_field(settings.get("chit_options"))
                settings["active_clocks"] = deserialize_json_field(settings.get("active_clocks"))
                settings["saved_locations"] = deserialize_json_field(settings.get("saved_locations"))
                settings["default_notifications"] = deserialize_json_field(settings.get("default_notifications"))
                settings["shared_tags"] = deserialize_json_field(settings.get("shared_tags"))
                settings["kiosk_users"] = deserialize_json_field(settings.get("kiosk_users"))
                settings["email_account"] = deserialize_json_field(settings.get("email_account"))
                settings["email_accounts"] = deserialize_json_field(settings.get("email_accounts"))
                settings["view_order"] = deserialize_json_field(settings.get("view_order"))
                settings["recent_tags"] = deserialize_json_field(settings.get("recent_tags"))
                settings["custom_view_filters"] = deserialize_json_field(settings.get("custom_view_filters"))
                response["settings"] = settings
            else:
                response["settings"] = None

        # ── Update device last_sync_version ─────────────────────────────
        # If the request came via a device token (Bearer auth), record the
        # server_version so tombstone retention knows this device is caught up.
        device_id = getattr(request.state, "device_id", None)
        if device_id:
            try:
                cursor.execute(
                    "UPDATE device_tokens SET last_sync_version = ? WHERE id = ?",
                    (server_version, device_id),
                )
                conn.commit()
            except Exception as e:
                logger.warning(f"Sync pull: failed to update last_sync_version for device {device_id}: {e}")

        return response

    except Exception as e:
        logger.error(f"Error in sync pull for user {user_id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Sync pull failed: {str(e)}")
    finally:
        if conn:
            conn.close()


# ═══════════════════════════════════════════════════════════════════════════
# Sync Push Endpoint
# ═══════════════════════════════════════════════════════════════════════════

# ═══════════════════════════════════════════════════════════════════════════
# Conflict Resolution — Merge Field Definitions
# ═══════════════════════════════════════════════════════════════════════════

# Fields that participate in field-level conflict resolution for CHITS.
# These are user-editable fields where independent edits on different
# devices can produce meaningful conflicts. Metadata fields (id, owner_id,
# created_datetime, sync_version, etc.) are excluded — they're system-managed.
_MERGE_FIELDS = [
    "title", "note", "tags", "status", "priority", "severity",
    "checklist", "people", "start_datetime", "end_datetime", "due_datetime",
    "all_day", "color", "location", "alerts", "recurrence_rule",
    "recurrence_exceptions", "deleted", "pinned", "archived",
    "assigned_to", "shares", "child_chits", "is_project_master",
    "habit", "habit_goal", "snoozed_until", "prerequisites", "availability",
]

# JSON-serialized fields that need deserialization before comparison (chits)
_JSON_MERGE_FIELDS = frozenset([
    "tags", "checklist", "people", "alerts",
    "recurrence_rule", "recurrence_exceptions",
    "child_chits", "shares", "prerequisites",
])

# Fields that participate in field-level conflict resolution for CONTACTS.
# Same LWW strategy as chits — compare modified_datetime per field.
_CONTACT_MERGE_FIELDS = [
    "given_name", "surname", "middle_names", "prefix", "suffix",
    "nickname", "phones", "emails", "addresses", "call_signs",
    "x_handles", "websites", "dates", "has_signal", "signal_username",
    "pgp_key", "favorite", "color", "organization", "social_context",
    "image_url", "notes", "tags", "shared_to_vault",
]

# JSON-serialized fields for contacts
_CONTACT_JSON_MERGE_FIELDS = frozenset([
    "phones", "emails", "addresses", "call_signs",
    "x_handles", "websites", "dates", "tags",
])


def _resolve_conflict(server_chit: dict, client_chit: dict) -> tuple:
    """Field-level conflict resolution using Last Write Wins (LWW) per field.

    For each field in _MERGE_FIELDS:
    - If both sides have the same value: no conflict, skip.
    - If values differ: compare modified_datetime timestamps. The side with
      the later timestamp wins that field.

    Sets has_unviewed_conflict = true on the merged record (handled by caller).

    Returns a 3-tuple:
      - merged_updates (dict): fields where the client won (need to be written
        to the server). Only contains fields that differ from the server's
        current value and where the client's timestamp is later.
      - conflict_fields (list[str]): all fields that had differing values,
        regardless of which side won.
      - resolution_details (list[dict]): per-field audit info with keys:
        field, server_value, client_value, resolved_to ("server" or "client").
        Used by task 5.3 for audit log entries.
    """
    conflict_fields = []
    merged_updates = {}
    resolution_details = []

    server_time = server_chit.get("modified_datetime") or ""
    client_time = client_chit.get("modified_datetime") or ""

    for field in _MERGE_FIELDS:
        server_val = server_chit.get(field)
        client_val = client_chit.get(field)

        # Normalize JSON fields stored as strings on the server side
        # so we can do a fair equality comparison against the client's
        # already-deserialized values.
        server_val_normalized = server_val
        if isinstance(server_val, str) and field in _JSON_MERGE_FIELDS:
            server_val_normalized = deserialize_json_field(server_val)

        # No conflict if values are equal after normalization
        if server_val_normalized == client_val:
            continue

        # Values differ — apply LWW based on modified_datetime
        if client_time > server_time:
            # Client wins — record the update to apply to the server
            merged_updates[field] = client_val
            resolved_to = "client"
        else:
            # Server wins (or tie goes to server) — no update needed
            resolved_to = "server"

        conflict_fields.append(field)

        # Build audit detail for this field (use normalized server value
        # for readability in the audit log)
        resolution_details.append({
            "field": field,
            "server_value": server_val_normalized,
            "client_value": client_val,
            "resolved_to": resolved_to,
        })

    return merged_updates, conflict_fields, resolution_details


def _resolve_contact_conflict(server_contact: dict, client_contact: dict) -> tuple:
    """Field-level conflict resolution for contacts using LWW per field.

    Same strategy as chits: for each field in _CONTACT_MERGE_FIELDS,
    compare values. If they differ, the side with the later modified_datetime wins.

    Returns a 3-tuple:
      - merged_updates (dict): fields where the client won (need to be written)
      - conflict_fields (list[str]): all fields that had differing values
      - resolution_details (list[dict]): per-field audit info
    """
    conflict_fields = []
    merged_updates = {}
    resolution_details = []

    server_time = server_contact.get("modified_datetime") or ""
    client_time = client_contact.get("modified_datetime") or ""

    for field in _CONTACT_MERGE_FIELDS:
        server_val = server_contact.get(field)
        client_val = client_contact.get(field)

        # Normalize JSON fields stored as strings on the server side
        server_val_normalized = server_val
        if isinstance(server_val, str) and field in _CONTACT_JSON_MERGE_FIELDS:
            server_val_normalized = deserialize_json_field(server_val)

        # No conflict if values are equal after normalization
        if server_val_normalized == client_val:
            continue

        # Values differ — apply LWW based on modified_datetime
        if client_time > server_time:
            merged_updates[field] = client_val
            resolved_to = "client"
        else:
            resolved_to = "server"

        conflict_fields.append(field)

        resolution_details.append({
            "field": field,
            "server_value": server_val_normalized,
            "client_value": client_val,
            "resolved_to": resolved_to,
        })

    return merged_updates, conflict_fields, resolution_details


# Settings fields that are JSON-serialized in the database
_SETTINGS_JSON_FIELDS = frozenset([
    "tags", "default_filters", "custom_colors", "visual_indicators",
    "chit_options", "default_notifications", "kiosk_users", "shared_tags",
    "active_clocks", "saved_locations", "recent_tags", "custom_view_filters",
    "email_account", "email_accounts", "view_order",
])

# All valid settings columns that can be pushed from a mobile client
_SETTINGS_PUSH_FIELDS = frozenset([
    "time_format", "sex", "snooze_length", "default_filters",
    "alarm_orientation", "active_clocks", "saved_locations", "tags",
    "custom_colors", "visual_indicators", "chit_options", "calendar_snap",
    "week_start_day", "work_start_hour", "work_end_hour", "work_days",
    "enabled_periods", "custom_days_count", "all_view_start_hour",
    "all_view_end_hour", "day_scroll_to_hour",
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
    "default_timezone", "timezone_override", "default_view",
])


def _apply_settings_from_push(cursor, user_id: str, settings_data: dict, sync_version: int, current_time: str):
    """Apply settings fields from a push payload to the database.

    Filters to only valid settings columns, serializes JSON fields,
    and writes them all in a single UPDATE statement.
    """
    update_dict = {}
    for key, value in settings_data.items():
        if key in ("user_id", "last_known_sync_version", "modified_datetime", "sync_version"):
            continue  # Skip metadata fields
        if key not in _SETTINGS_PUSH_FIELDS:
            continue  # Ignore unknown fields

        if key in _SETTINGS_JSON_FIELDS and value is not None:
            update_dict[key] = serialize_json_field(value)
        else:
            update_dict[key] = value

    # Always set sync_version and modified_datetime
    update_dict["sync_version"] = sync_version
    update_dict["modified_datetime"] = settings_data.get("modified_datetime") or current_time

    if not update_dict:
        return

    set_clauses = [f"{col} = ?" for col in update_dict.keys()]
    values = list(update_dict.values()) + [user_id]
    cursor.execute(
        f"UPDATE settings SET {', '.join(set_clauses)} WHERE user_id = ?",
        values,
    )


def _build_chit_insert_values(chit: dict, user_id: str, sync_version: int, current_time: str) -> tuple:
    """Build the column names and values tuple for inserting a new chit from push data."""
    # Compute system tags based on chit properties
    class _ChitProxy:
        """Minimal proxy to satisfy compute_system_tags interface."""
        def __init__(self, d):
            self._d = d
        def __getattr__(self, name):
            return self._d.get(name)

    proxy = _ChitProxy(chit)
    proxy.tags = chit.get("tags") or []
    computed_tags = compute_system_tags(proxy)

    return (
        chit.get("id") or str(uuid4()),
        chit.get("title"),
        chit.get("note"),
        serialize_json_field(computed_tags),
        chit.get("start_datetime"),
        chit.get("end_datetime"),
        chit.get("due_datetime"),
        chit.get("point_in_time"),
        chit.get("completed_datetime"),
        chit.get("status"),
        chit.get("priority"),
        chit.get("severity"),
        serialize_json_field(chit.get("checklist")),
        chit.get("alarm"),
        chit.get("notification"),
        chit.get("recurrence"),
        chit.get("recurrence_id"),
        chit.get("location"),
        chit.get("color"),
        serialize_json_field(chit.get("people")),
        1 if chit.get("pinned") else 0,
        1 if chit.get("archived") else 0,
        1 if chit.get("deleted") else 0,
        current_time,
        chit.get("modified_datetime") or current_time,
        1 if chit.get("is_project_master") else 0,
        serialize_json_field(chit.get("child_chits")),
        1 if chit.get("all_day") else 0,
        chit.get("timezone"),
        serialize_json_field(chit.get("alerts")),
        serialize_json_field(chit.get("recurrence_rule")),
        serialize_json_field(chit.get("recurrence_exceptions")),
        serialize_json_field(chit.get("weather_data")),
        serialize_json_field(chit.get("health_data")),
        1 if chit.get("habit") else 0,
        chit.get("habit_goal") or 1,
        chit.get("habit_success") or 0,
        1 if chit.get("show_on_calendar", True) else 0,
        chit.get("habit_reset_period"),
        chit.get("habit_last_action_date"),
        1 if chit.get("habit_hide_overall") else 0,
        1 if chit.get("perpetual") else 0,
        user_id,
        serialize_json_field(chit.get("shares")),
        1 if chit.get("stealth") else 0,
        chit.get("assigned_to"),
        serialize_json_field(chit.get("email_to")),
        serialize_json_field(chit.get("email_cc")),
        serialize_json_field(chit.get("email_bcc")),
        chit.get("email_message_id"),
        chit.get("email_from"),
        chit.get("email_subject"),
        chit.get("email_body_text"),
        chit.get("email_body_html"),
        chit.get("email_date"),
        chit.get("email_folder"),
        chit.get("email_status"),
        1 if chit.get("email_read") else 0 if chit.get("email_read") is not None else None,
        chit.get("email_in_reply_to"),
        chit.get("email_references"),
        serialize_json_field(chit.get("attachments")),
        chit.get("availability"),
        chit.get("snoozed_until"),
        serialize_json_field(chit.get("prerequisites")),
        1 if chit.get("checklist_autosave") else 0 if chit.get("checklist_autosave") is not None else None,
        1 if chit.get("auto_complete_checklist", True) else 0,
        sync_version,
    )


_INSERT_CHIT_SQL = """
    INSERT INTO chits (
        id, title, note, tags, start_datetime, end_datetime, due_datetime, point_in_time,
        completed_datetime, status, priority, severity, checklist, alarm, notification,
        recurrence, recurrence_id, location, color, people, pinned, archived,
        deleted, created_datetime, modified_datetime, is_project_master, child_chits,
        all_day, timezone, alerts, recurrence_rule, recurrence_exceptions,
        weather_data, health_data, habit, habit_goal, habit_success, show_on_calendar,
        habit_reset_period, habit_last_action_date, habit_hide_overall, perpetual,
        owner_id, shares, stealth, assigned_to,
        email_to, email_cc, email_bcc, email_message_id, email_from,
        email_subject, email_body_text, email_body_html, email_date, email_folder,
        email_status, email_read, email_in_reply_to, email_references,
        attachments, availability, snoozed_until, prerequisites,
        checklist_autosave, auto_complete_checklist, sync_version
    ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
"""


def _build_chit_update_values(chit: dict, sync_version: int, current_time: str, chit_id: str) -> tuple:
    """Build the values tuple for updating an existing chit from push data (no conflict)."""
    # Compute system tags
    class _ChitProxy:
        def __init__(self, d):
            self._d = d
        def __getattr__(self, name):
            return self._d.get(name)

    proxy = _ChitProxy(chit)
    proxy.tags = chit.get("tags") or []
    computed_tags = compute_system_tags(proxy)

    return (
        chit.get("title"),
        chit.get("note"),
        serialize_json_field(computed_tags),
        chit.get("start_datetime"),
        chit.get("end_datetime"),
        chit.get("due_datetime"),
        chit.get("point_in_time"),
        chit.get("completed_datetime"),
        chit.get("status"),
        chit.get("priority"),
        chit.get("severity"),
        serialize_json_field(chit.get("checklist")),
        chit.get("alarm"),
        chit.get("notification"),
        chit.get("recurrence"),
        chit.get("recurrence_id"),
        chit.get("location"),
        chit.get("color"),
        serialize_json_field(chit.get("people")),
        1 if chit.get("pinned") else 0,
        1 if chit.get("archived") else 0,
        1 if chit.get("deleted") else 0,
        chit.get("modified_datetime") or current_time,
        1 if chit.get("is_project_master") else 0,
        serialize_json_field(chit.get("child_chits")),
        1 if chit.get("all_day") else 0,
        chit.get("timezone"),
        serialize_json_field(chit.get("alerts")),
        serialize_json_field(chit.get("recurrence_rule")),
        serialize_json_field(chit.get("recurrence_exceptions")),
        serialize_json_field(chit.get("weather_data")),
        serialize_json_field(chit.get("health_data")),
        1 if chit.get("habit") else 0,
        chit.get("habit_goal") or 1,
        chit.get("habit_success") or 0,
        1 if chit.get("show_on_calendar", True) else 0,
        chit.get("habit_reset_period"),
        chit.get("habit_last_action_date"),
        1 if chit.get("habit_hide_overall") else 0,
        1 if chit.get("perpetual") else 0,
        serialize_json_field(chit.get("shares")),
        1 if chit.get("stealth") else 0,
        chit.get("assigned_to"),
        serialize_json_field(chit.get("email_to")),
        serialize_json_field(chit.get("email_cc")),
        serialize_json_field(chit.get("email_bcc")),
        chit.get("email_message_id"),
        chit.get("email_from"),
        chit.get("email_subject"),
        chit.get("email_body_text"),
        chit.get("email_body_html"),
        chit.get("email_date"),
        chit.get("email_folder"),
        chit.get("email_status"),
        1 if chit.get("email_read") else 0 if chit.get("email_read") is not None else None,
        chit.get("email_in_reply_to"),
        chit.get("email_references"),
        serialize_json_field(chit.get("attachments")),
        chit.get("availability"),
        chit.get("snoozed_until"),
        serialize_json_field(chit.get("prerequisites")),
        1 if chit.get("checklist_autosave") else 0 if chit.get("checklist_autosave") is not None else None,
        1 if chit.get("auto_complete_checklist", True) else 0,
        sync_version,
        chit_id,
    )


_UPDATE_CHIT_SQL = """
    UPDATE chits SET
        title = ?, note = ?, tags = ?, start_datetime = ?, end_datetime = ?,
        due_datetime = ?, point_in_time = ?, completed_datetime = ?, status = ?,
        priority = ?, severity = ?, checklist = ?, alarm = ?, notification = ?,
        recurrence = ?, recurrence_id = ?, location = ?, color = ?, people = ?,
        pinned = ?, archived = ?, deleted = ?, modified_datetime = ?,
        is_project_master = ?, child_chits = ?, all_day = ?, timezone = ?,
        alerts = ?, recurrence_rule = ?, recurrence_exceptions = ?,
        weather_data = ?, health_data = ?, habit = ?, habit_goal = ?,
        habit_success = ?, show_on_calendar = ?, habit_reset_period = ?,
        habit_last_action_date = ?, habit_hide_overall = ?, perpetual = ?,
        shares = ?, stealth = ?, assigned_to = ?,
        email_to = ?, email_cc = ?, email_bcc = ?, email_message_id = ?,
        email_from = ?, email_subject = ?, email_body_text = ?, email_body_html = ?,
        email_date = ?, email_folder = ?, email_status = ?, email_read = ?,
        email_in_reply_to = ?, email_references = ?, attachments = ?,
        availability = ?, snoozed_until = ?, prerequisites = ?,
        checklist_autosave = ?, auto_complete_checklist = ?, sync_version = ?
    WHERE id = ?
"""


@sync_router.post("/api/sync/push")
async def sync_push(request: Request):
    """Push local changes from a mobile client to the server.

    Accepts a JSON body with:
      - chits: array of chit records to create/update
      - contacts: array of contact records to create/update
      - settings: settings object (LWW on entire record)

    For each chit/contact:
      - If ID doesn't exist on server → INSERT (status: "created")
      - If ID exists and server sync_version <= client's last_known_sync_version → UPDATE (status: "accepted")
      - If ID exists and server sync_version > client's last_known_sync_version → CONFLICT → resolve (status: "merged")

    For settings:
      - LWW on entire record — if conflict, compare modified_datetime and take the later one entirely
      - No field-level merge for settings

    Returns per-record status and the current server_version.
    """
    conn = None
    try:
        user_id = request.state.user_id
        body = await request.json()

        chits_to_push = body.get("chits") or []
        contacts_to_push = body.get("contacts") or []
        settings_to_push = body.get("settings")  # single object or None

        conn = sqlite3.connect(DB_PATH)
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA busy_timeout=5000")
        cursor = conn.cursor()

        current_time = datetime.utcnow().isoformat()
        chit_results = []
        broadcast_payloads = []

        for client_chit in chits_to_push:
            chit_id = client_chit.get("id")
            if not chit_id:
                chit_results.append({"id": None, "status": "error", "detail": "Missing chit ID"})
                continue

            try:
                # Check if chit exists on server
                cursor.execute(
                    "SELECT sync_version, owner_id FROM chits WHERE id = ?",
                    (chit_id,),
                )
                existing = cursor.fetchone()

                if existing is None:
                    # ── CREATE: chit doesn't exist on server ──
                    sync_version = get_next_sync_version(cursor)
                    values = _build_chit_insert_values(client_chit, user_id, sync_version, current_time)
                    cursor.execute(_INSERT_CHIT_SQL, values)
                    chit_results.append({
                        "id": chit_id,
                        "status": "created",
                        "sync_version": sync_version,
                    })
                    broadcast_payloads.append({
                        "type": "chit_created",
                        "chit_id": chit_id,
                        "owner_id": user_id,
                        "sync_version": sync_version,
                    })

                else:
                    server_sync_version = existing[0] or 0
                    server_owner_id = existing[1]
                    client_last_known = client_chit.get("last_known_sync_version", 0) or 0

                    if server_sync_version <= client_last_known:
                        # ── UPDATE: no conflict — server hasn't changed since client last saw it ──
                        sync_version = get_next_sync_version(cursor)
                        values = _build_chit_update_values(client_chit, sync_version, current_time, chit_id)
                        cursor.execute(_UPDATE_CHIT_SQL, values)
                        chit_results.append({
                            "id": chit_id,
                            "status": "accepted",
                            "sync_version": sync_version,
                        })
                        broadcast_payloads.append({
                            "type": "chit_updated",
                            "chit_id": chit_id,
                            "owner_id": server_owner_id or user_id,
                            "sync_version": sync_version,
                        })

                    else:
                        # ── CONFLICT: server was modified after client's last sync ──
                        # Fetch full server chit for conflict resolution
                        cursor.execute("SELECT * FROM chits WHERE id = ?", (chit_id,))
                        server_row = cursor.fetchone()
                        columns = [col[0] for col in cursor.description]
                        server_chit = dict(zip(columns, server_row))

                        merged_updates, conflict_fields, resolution_details = _resolve_conflict(server_chit, client_chit)

                        sync_version = get_next_sync_version(cursor)

                        if merged_updates:
                            # Apply merged field updates
                            set_clauses = []
                            set_values = []
                            for field, value in merged_updates.items():
                                # Serialize JSON fields before writing to SQLite
                                if field in _JSON_MERGE_FIELDS:
                                    value = serialize_json_field(value)
                                set_clauses.append(f"{field} = ?")
                                set_values.append(value)

                            # Always update sync_version, modified_datetime, has_unviewed_conflict
                            set_clauses.append("sync_version = ?")
                            set_values.append(sync_version)
                            set_clauses.append("modified_datetime = ?")
                            set_values.append(client_chit.get("modified_datetime") or current_time)
                            set_clauses.append("has_unviewed_conflict = ?")
                            set_values.append(1)

                            set_values.append(chit_id)
                            cursor.execute(
                                f"UPDATE chits SET {', '.join(set_clauses)} WHERE id = ?",
                                tuple(set_values),
                            )
                        else:
                            # No field updates needed, but still bump sync_version and flag conflict
                            cursor.execute(
                                "UPDATE chits SET sync_version = ?, has_unviewed_conflict = 1 WHERE id = ?",
                                (sync_version, chit_id),
                            )

                        result_entry = {
                            "id": chit_id,
                            "status": "merged",
                            "sync_version": sync_version,
                        }
                        if conflict_fields:
                            result_entry["conflict_fields"] = conflict_fields
                        if resolution_details:
                            result_entry["resolution_details"] = resolution_details
                        chit_results.append(result_entry)

                        broadcast_payloads.append({
                            "type": "chit_updated",
                            "chit_id": chit_id,
                            "owner_id": server_owner_id or user_id,
                            "sync_version": sync_version,
                            "conflict": True,
                        })

                        # ── Audit log entry for conflict resolution ──
                        if resolution_details:
                            # Determine actor: "device:<name>" for token auth, username for session auth
                            device_id = getattr(request.state, "device_id", None)
                            if device_id:
                                cursor.execute(
                                    "SELECT device_name FROM device_tokens WHERE id = ?",
                                    (device_id,),
                                )
                                device_row = cursor.fetchone()
                                actor = f"device:{device_row[0]}" if device_row else f"device:{device_id}"
                            else:
                                actor = getattr(request.state, "username", None) or "web"

                            insert_audit_entry(
                                conn,
                                entity_type="chit",
                                entity_id=chit_id,
                                action="sync_conflict_resolved",
                                actor=actor,
                                changes=resolution_details,
                            )

            except Exception as e:
                logger.error(f"Error processing pushed chit {chit_id}: {str(e)}", exc_info=True)
                chit_results.append({
                    "id": chit_id,
                    "status": "error",
                    "detail": str(e),
                })

        # ── Process Contacts ────────────────────────────────────────────
        contact_results = []
        for client_contact in contacts_to_push:
            contact_id = client_contact.get("id")
            if not contact_id:
                contact_results.append({"id": None, "status": "error", "detail": "Missing contact ID"})
                continue

            try:
                # Check if contact exists on server
                cursor.execute(
                    "SELECT sync_version, owner_id FROM contacts WHERE id = ?",
                    (contact_id,),
                )
                existing = cursor.fetchone()

                if existing is None:
                    # ── CREATE: contact doesn't exist on server ──
                    sync_version = get_next_sync_version(cursor)

                    # Compute display_name from client data
                    given = client_contact.get("given_name") or ""
                    surname = client_contact.get("surname") or ""
                    display_name = f"{given} {surname}".strip() or client_contact.get("nickname") or "Unknown"

                    cursor.execute(
                        """INSERT INTO contacts (
                            id, given_name, surname, middle_names, prefix, suffix,
                            nickname, display_name, phones, emails, addresses, call_signs,
                            x_handles, websites, dates, has_signal, signal_username, pgp_key,
                            favorite, color, organization, social_context, image_url, notes,
                            tags, shared_to_vault,
                            created_datetime, modified_datetime, owner_id, sync_version
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                        (
                            contact_id,
                            client_contact.get("given_name"),
                            client_contact.get("surname"),
                            client_contact.get("middle_names"),
                            client_contact.get("prefix"),
                            client_contact.get("suffix"),
                            client_contact.get("nickname"),
                            display_name,
                            serialize_json_field(client_contact.get("phones")),
                            serialize_json_field(client_contact.get("emails")),
                            serialize_json_field(client_contact.get("addresses")),
                            serialize_json_field(client_contact.get("call_signs")),
                            serialize_json_field(client_contact.get("x_handles")),
                            serialize_json_field(client_contact.get("websites")),
                            serialize_json_field(client_contact.get("dates")),
                            1 if client_contact.get("has_signal") else 0,
                            client_contact.get("signal_username"),
                            client_contact.get("pgp_key"),
                            1 if client_contact.get("favorite") else 0,
                            client_contact.get("color"),
                            client_contact.get("organization"),
                            client_contact.get("social_context"),
                            client_contact.get("image_url"),
                            client_contact.get("notes"),
                            serialize_json_field(client_contact.get("tags")),
                            1 if client_contact.get("shared_to_vault") else 0,
                            current_time,
                            client_contact.get("modified_datetime") or current_time,
                            user_id,
                            sync_version,
                        ),
                    )
                    contact_results.append({
                        "id": contact_id,
                        "status": "created",
                        "sync_version": sync_version,
                    })
                    broadcast_payloads.append({
                        "type": "contact_created",
                        "contact_id": contact_id,
                        "owner_id": user_id,
                        "sync_version": sync_version,
                    })

                else:
                    server_sync_version = existing[0] or 0
                    server_owner_id = existing[1]
                    client_last_known = client_contact.get("last_known_sync_version", 0) or 0

                    if server_sync_version <= client_last_known:
                        # ── UPDATE: no conflict ──
                        sync_version = get_next_sync_version(cursor)

                        given = client_contact.get("given_name") or ""
                        surname = client_contact.get("surname") or ""
                        display_name = f"{given} {surname}".strip() or client_contact.get("nickname") or "Unknown"

                        cursor.execute(
                            """UPDATE contacts SET
                                given_name = ?, surname = ?, middle_names = ?, prefix = ?, suffix = ?,
                                nickname = ?, display_name = ?, phones = ?, emails = ?, addresses = ?,
                                call_signs = ?, x_handles = ?, websites = ?, dates = ?,
                                has_signal = ?, signal_username = ?, pgp_key = ?, favorite = ?,
                                color = ?, organization = ?, social_context = ?, image_url = ?,
                                notes = ?, tags = ?, shared_to_vault = ?,
                                modified_datetime = ?, sync_version = ?
                            WHERE id = ?""",
                            (
                                client_contact.get("given_name"),
                                client_contact.get("surname"),
                                client_contact.get("middle_names"),
                                client_contact.get("prefix"),
                                client_contact.get("suffix"),
                                client_contact.get("nickname"),
                                display_name,
                                serialize_json_field(client_contact.get("phones")),
                                serialize_json_field(client_contact.get("emails")),
                                serialize_json_field(client_contact.get("addresses")),
                                serialize_json_field(client_contact.get("call_signs")),
                                serialize_json_field(client_contact.get("x_handles")),
                                serialize_json_field(client_contact.get("websites")),
                                serialize_json_field(client_contact.get("dates")),
                                1 if client_contact.get("has_signal") else 0,
                                client_contact.get("signal_username"),
                                client_contact.get("pgp_key"),
                                1 if client_contact.get("favorite") else 0,
                                client_contact.get("color"),
                                client_contact.get("organization"),
                                client_contact.get("social_context"),
                                client_contact.get("image_url"),
                                client_contact.get("notes"),
                                serialize_json_field(client_contact.get("tags")),
                                1 if client_contact.get("shared_to_vault") else 0,
                                client_contact.get("modified_datetime") or current_time,
                                sync_version,
                                contact_id,
                            ),
                        )
                        contact_results.append({
                            "id": contact_id,
                            "status": "accepted",
                            "sync_version": sync_version,
                        })
                        broadcast_payloads.append({
                            "type": "contact_updated",
                            "contact_id": contact_id,
                            "owner_id": server_owner_id or user_id,
                            "sync_version": sync_version,
                        })

                    else:
                        # ── CONFLICT: field-level merge (same as chits) ──
                        cursor.execute("SELECT * FROM contacts WHERE id = ?", (contact_id,))
                        server_row = cursor.fetchone()
                        columns = [col[0] for col in cursor.description]
                        server_contact = dict(zip(columns, server_row))

                        merged_updates, conflict_fields, resolution_details = _resolve_contact_conflict(
                            server_contact, client_contact
                        )

                        sync_version = get_next_sync_version(cursor)

                        if merged_updates:
                            set_clauses = []
                            set_values = []
                            for field, value in merged_updates.items():
                                if field in _CONTACT_JSON_MERGE_FIELDS:
                                    value = serialize_json_field(value)
                                # Convert booleans to int for SQLite
                                elif field in ("has_signal", "favorite", "shared_to_vault"):
                                    value = 1 if value else 0
                                set_clauses.append(f"{field} = ?")
                                set_values.append(value)

                            # Recompute display_name if name fields changed
                            if any(f in merged_updates for f in ("given_name", "surname", "nickname")):
                                # Use merged values where client won, server values otherwise
                                given = merged_updates.get("given_name", server_contact.get("given_name")) or ""
                                surname_val = merged_updates.get("surname", server_contact.get("surname")) or ""
                                nick = merged_updates.get("nickname", server_contact.get("nickname"))
                                new_display = f"{given} {surname_val}".strip() or nick or "Unknown"
                                set_clauses.append("display_name = ?")
                                set_values.append(new_display)

                            set_clauses.append("sync_version = ?")
                            set_values.append(sync_version)
                            set_clauses.append("modified_datetime = ?")
                            set_values.append(client_contact.get("modified_datetime") or current_time)

                            set_values.append(contact_id)
                            cursor.execute(
                                f"UPDATE contacts SET {', '.join(set_clauses)} WHERE id = ?",
                                tuple(set_values),
                            )
                        else:
                            # No field updates needed, but still bump sync_version
                            cursor.execute(
                                "UPDATE contacts SET sync_version = ? WHERE id = ?",
                                (sync_version, contact_id),
                            )

                        result_entry = {
                            "id": contact_id,
                            "status": "merged",
                            "sync_version": sync_version,
                        }
                        if conflict_fields:
                            result_entry["conflict_fields"] = conflict_fields
                        if resolution_details:
                            result_entry["resolution_details"] = resolution_details
                        contact_results.append(result_entry)

                        broadcast_payloads.append({
                            "type": "contact_updated",
                            "contact_id": contact_id,
                            "owner_id": server_owner_id or user_id,
                            "sync_version": sync_version,
                            "conflict": True,
                        })

                        # ── Audit log entry for contact conflict resolution ──
                        if resolution_details:
                            device_id = getattr(request.state, "device_id", None)
                            if device_id:
                                cursor.execute(
                                    "SELECT device_name FROM device_tokens WHERE id = ?",
                                    (device_id,),
                                )
                                device_row = cursor.fetchone()
                                actor = f"device:{device_row[0]}" if device_row else f"device:{device_id}"
                            else:
                                actor = getattr(request.state, "username", None) or "web"

                            insert_audit_entry(
                                conn,
                                entity_type="contact",
                                entity_id=contact_id,
                                action="sync_conflict_resolved",
                                actor=actor,
                                changes=resolution_details,
                            )

            except Exception as e:
                logger.error(f"Error processing pushed contact {contact_id}: {str(e)}", exc_info=True)
                contact_results.append({
                    "id": contact_id,
                    "status": "error",
                    "detail": str(e),
                })

        # ── Process Settings (LWW on entire record) ─────────────────────
        settings_result = None
        if settings_to_push:
            try:
                # Fetch current server settings for this user
                cursor.execute(
                    "SELECT sync_version, modified_datetime FROM settings WHERE user_id = ?",
                    (user_id,),
                )
                server_settings_row = cursor.fetchone()

                if server_settings_row is None:
                    # No settings on server — create from client data
                    sync_version = get_next_sync_version(cursor)
                    cursor.execute(
                        "INSERT OR IGNORE INTO settings (user_id, sync_version) VALUES (?, ?)",
                        (user_id, sync_version),
                    )
                    # Apply all client settings fields
                    _apply_settings_from_push(cursor, user_id, settings_to_push, sync_version, current_time)
                    settings_result = {
                        "status": "created",
                        "sync_version": sync_version,
                    }
                else:
                    server_sync_version = server_settings_row[0] or 0
                    server_modified = server_settings_row[1] or ""
                    client_last_known = settings_to_push.get("last_known_sync_version", 0) or 0
                    client_modified = settings_to_push.get("modified_datetime") or ""

                    if server_sync_version <= client_last_known:
                        # No conflict — client's version is based on latest server state
                        sync_version = get_next_sync_version(cursor)
                        _apply_settings_from_push(cursor, user_id, settings_to_push, sync_version, current_time)
                        settings_result = {
                            "status": "accepted",
                            "sync_version": sync_version,
                        }
                    else:
                        # Conflict — LWW on entire record (no field-level merge)
                        if client_modified > server_modified:
                            # Client wins — overwrite server settings entirely
                            sync_version = get_next_sync_version(cursor)
                            _apply_settings_from_push(cursor, user_id, settings_to_push, sync_version, current_time)
                            settings_result = {
                                "status": "accepted",
                                "sync_version": sync_version,
                            }
                        else:
                            # Server wins — reject client's settings push
                            settings_result = {
                                "status": "server_wins",
                                "sync_version": server_sync_version,
                            }

            except Exception as e:
                logger.error(f"Error processing pushed settings: {str(e)}", exc_info=True)
                settings_result = {
                    "status": "error",
                    "detail": str(e),
                }

        conn.commit()

        # Get final server version after all writes
        cursor.execute("SELECT next_version FROM sync_state WHERE id = 1")
        row = cursor.fetchone()
        server_version = (row[0] - 1) if row else 0

        # Broadcast changes via the sync hub (fire-and-forget)
        if broadcast_payloads:
            try:
                from src.backend.routes.health import _sync_hub, _sync_messages, _sync_max_messages
                import asyncio

                # Access the module-level _sync_next_id via the module
                import src.backend.routes.health as health_module

                for payload in broadcast_payloads:
                    # Add to polling queue
                    msg = {"id": health_module._sync_next_id, "data": payload, "ts": time.time()}
                    health_module._sync_next_id += 1
                    _sync_messages.append(msg)
                    if len(_sync_messages) > _sync_max_messages:
                        _sync_messages[:] = _sync_messages[-_sync_max_messages:]
                    # Broadcast to WebSocket clients
                    await _sync_hub.broadcast(payload)
            except Exception as e:
                logger.error(f"Sync broadcast failed (best-effort): {str(e)}")

        response = {
            "results": {
                "chits": chit_results,
                "contacts": contact_results,
                "settings": settings_result,
            },
            "server_version": server_version,
        }

        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in sync push for user {getattr(request.state, 'user_id', 'unknown')}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Sync push failed: {str(e)}")
    finally:
        if conn:
            conn.close()
