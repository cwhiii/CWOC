"""Chit CRUD API routes for the CWOC backend.

Provides endpoints for creating, reading, updating, deleting chits,
managing recurrence exceptions, and import/export of chit data and userdata.
"""

import json
import logging
import sqlite3
import threading
from datetime import datetime
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query, Request, Response

from src.backend.db import (
    DB_PATH, serialize_json_field, deserialize_json_field,
    compute_system_tags, _build_export_envelope, ensure_tags_in_settings,
)
from src.backend.models import Chit, ImportRequest
from src.backend.routes.audit import insert_audit_entry, compute_audit_diff, get_actor_from_request
from src.backend.sharing import resolve_effective_role, can_edit_chit, can_delete_chit, can_manage_sharing
from src.backend.routes.notifications import _create_share_notifications
from src.backend.rules_engine import dispatch_trigger


logger = logging.getLogger(__name__)
router = APIRouter()

# --- Reserved tag namespace enforcement ---
RESERVED_TAG_PREFIX = "cwoc_system/"


def _strip_reserved_tags(tags):
    """Remove any user-submitted tags that start with CWOC_System/ (case-insensitive).

    Tags can be either strings or dicts with a "name" key — handles both formats.
    """
    if not tags or not isinstance(tags, list):
        return tags
    result = []
    for t in tags:
        if isinstance(t, dict):
            name = t.get("name", "")
            if not str(name).lower().startswith(RESERVED_TAG_PREFIX):
                result.append(t)
        elif isinstance(t, str):
            if not t.lower().startswith(RESERVED_TAG_PREFIX):
                result.append(t)
        else:
            result.append(t)
    return result


def _validate_tag_name(name):
    """Return False if the tag name uses the reserved CWOC_System/ prefix (case-insensitive)."""
    return not str(name).lower().startswith(RESERVED_TAG_PREFIX)


def _enrich_assigned_to_display_names(cursor, chits):
    """Batch-lookup display names for assigned_to user IDs and add as assigned_to_display_name."""
    assigned_ids = set()
    for chit in chits:
        aid = chit.get("assigned_to")
        if aid:
            assigned_ids.add(aid)
    if not assigned_ids:
        for chit in chits:
            chit["assigned_to_display_name"] = None
        return
    # Fetch display names for all assigned user IDs
    placeholders = ",".join("?" for _ in assigned_ids)
    cursor.execute(
        f"SELECT id, display_name, username FROM users WHERE id IN ({placeholders})",
        list(assigned_ids),
    )
    name_map = {}
    for row in cursor.fetchall():
        name_map[row[0]] = row[1] or row[2] or row[0]
    for chit in chits:
        aid = chit.get("assigned_to")
        chit["assigned_to_display_name"] = name_map.get(aid) if aid else None

@router.get("/api/chits")
def get_all_chits(request: Request):
    conn = None
    try:
        user_id = request.state.user_id
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM chits WHERE (deleted = 0 OR deleted IS NULL) AND owner_id = ?", (user_id,))
        chits = []
        for row in cursor.fetchall():
            chit = dict(zip([col[0] for col in cursor.description], row))
            chit["tags"] = deserialize_json_field(chit["tags"])
            chit["checklist"] = deserialize_json_field(chit["checklist"])
            chit["people"] = deserialize_json_field(chit["people"])
            chit["child_chits"] = deserialize_json_field(chit.get("child_chits"))
            chit["is_project_master"] = bool(chit.get("is_project_master"))
            chit["all_day"] = bool(chit.get("all_day"))
            chit["pinned"] = bool(chit.get("pinned"))
            chit["archived"] = bool(chit.get("archived"))
            chit["alerts"] = deserialize_json_field(chit.get("alerts"))
            chit["recurrence_rule"] = deserialize_json_field(chit.get("recurrence_rule"))
            chit["recurrence_exceptions"] = deserialize_json_field(chit.get("recurrence_exceptions"))
            chit["weather_data"] = deserialize_json_field(chit.get("weather_data"))
            chit["health_data"] = deserialize_json_field(chit.get("health_data"))
            chit["habit"] = bool(chit.get("habit"))
            chit["habit_goal"] = int(chit.get("habit_goal") or 1)
            chit["habit_success"] = int(chit.get("habit_success") or 0)
            chit["show_on_calendar"] = bool(chit.get("show_on_calendar", 1))
            chit["habit_reset_period"] = chit.get("habit_reset_period")
            chit["habit_last_action_date"] = chit.get("habit_last_action_date")
            chit["habit_hide_overall"] = bool(chit.get("habit_hide_overall"))
            chit["perpetual"] = bool(chit.get("perpetual"))
            chit["shares"] = deserialize_json_field(chit.get("shares"))
            chit["stealth"] = bool(chit.get("stealth"))
            chit["assigned_to"] = chit.get("assigned_to")
            # Email fields
            chit["email_to"] = deserialize_json_field(chit.get("email_to"))
            chit["email_cc"] = deserialize_json_field(chit.get("email_cc"))
            chit["email_bcc"] = deserialize_json_field(chit.get("email_bcc"))
            chit["email_read"] = bool(chit.get("email_read")) if chit.get("email_read") is not None else None
            chits.append(chit)

        # Enrich chits with assigned_to_display_name (batch lookup)
        _enrich_assigned_to_display_names(cursor, chits)

        return chits
    except Exception as e:
        logger.error(f"Error fetching chits: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch chits: {str(e)}")
    finally:
        if conn:
            conn.close()



def create_chit(chit: Chit, request: Request):
    conn = None
    try:
        chit_id = str(uuid4())
        user_id = request.state.user_id
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # Look up the authenticated user's display_name and username for the owner record
        cursor.execute("SELECT display_name, username FROM users WHERE id = ?", (user_id,))
        user_row = cursor.fetchone()
        owner_display_name = user_row[0] if user_row else ""
        owner_username = user_row[1] if user_row else request.state.username

        current_time = datetime.utcnow().isoformat()
        # Strip any reserved CWOC_System/ tags from user-submitted tags before computing system tags
        chit.tags = _strip_reserved_tags(chit.tags)
        chit_tags = compute_system_tags(chit)
        cursor.execute(
            """
            INSERT INTO chits (
                id, title, note, tags, start_datetime, end_datetime, due_datetime,
                completed_datetime, status, priority, severity, checklist, alarm, notification,
                recurrence, recurrence_id, location, color, people, pinned, archived,
                deleted, created_datetime, modified_datetime, is_project_master, child_chits, all_day, alerts,
                recurrence_rule, recurrence_exceptions, weather_data, health_data,
                habit, habit_goal, habit_success, show_on_calendar,
                habit_reset_period, habit_last_action_date, habit_hide_overall, perpetual,
                owner_id, owner_display_name, owner_username,
                shares, stealth, assigned_to,
                email_message_id, email_from, email_to, email_cc, email_bcc,
                email_subject, email_body_text, email_body_html, email_date, email_folder,
                email_status, email_read, email_in_reply_to, email_references,
                attachments, availability
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                chit_id,
                chit.title,
                chit.note,
                serialize_json_field(chit_tags),
                chit.start_datetime,
                chit.end_datetime,
                chit.due_datetime,
                chit.completed_datetime,
                chit.status,
                chit.priority,
                chit.severity,
                serialize_json_field(chit.checklist),
                chit.alarm,
                chit.notification,
                chit.recurrence,
                chit.recurrence_id,
                chit.location,
                chit.color,
                serialize_json_field(chit.people),
                chit.pinned,
                chit.archived,
                chit.deleted if chit.deleted is not None else False,
                current_time,
                current_time,
                chit.is_project_master,
                serialize_json_field(chit.child_chits),
                chit.all_day if chit.all_day is not None else False,
                serialize_json_field(chit.alerts),
                serialize_json_field(chit.recurrence_rule),
                serialize_json_field(chit.recurrence_exceptions),
                serialize_json_field(chit.weather_data),
                serialize_json_field(chit.health_data),
                1 if chit.habit else 0,
                chit.habit_goal if chit.habit_goal is not None else 1,
                chit.habit_success if chit.habit_success is not None else 0,
                1 if chit.show_on_calendar is None or chit.show_on_calendar else 0,
                chit.habit_reset_period,
                chit.habit_last_action_date,
                1 if chit.habit_hide_overall else 0,
                1 if chit.perpetual else 0,
                user_id,
                owner_display_name,
                owner_username,
                serialize_json_field(chit.shares),
                1 if chit.stealth else 0,
                chit.assigned_to,
                chit.email_message_id,
                chit.email_from,
                serialize_json_field(chit.email_to),
                serialize_json_field(chit.email_cc),
                serialize_json_field(chit.email_bcc),
                chit.email_subject,
                chit.email_body_text,
                chit.email_body_html,
                chit.email_date,
                chit.email_folder,
                chit.email_status,
                1 if chit.email_read else 0 if chit.email_read is not None else None,
                chit.email_in_reply_to,
                chit.email_references,
                serialize_json_field(chit.attachments) if chit.attachments else None,
                chit.availability,
            )
        )
        # Create notifications for shared users on new chit creation
        try:
            new_shares = chit.shares if isinstance(chit.shares, list) else []
            if new_shares:
                _create_share_notifications(
                    cursor, chit_id, chit.title, owner_display_name,
                    [], new_shares,
                    assigned_to_new=chit.assigned_to,
                    assigned_to_old=None,
                )
        except Exception as e:
            logger.error(f"Notification creation failed for new chit (best-effort): {str(e)}")

        conn.commit()
        chit_data = {
            **chit.dict(), "id": chit_id, "tags": chit_tags,
            "created_datetime": current_time, "modified_datetime": current_time,
            "owner_id": user_id, "owner_display_name": owner_display_name, "owner_username": owner_username,
        }
        # Fire-and-forget: dispatch rules engine trigger for chit creation
        try:
            logger.info("Firing rules engine trigger: chit_created for chit %s, owner %s", chit_id, user_id)
            threading.Thread(
                target=dispatch_trigger,
                args=("chit_created", "chit", chit_data, user_id),
                daemon=True,
            ).start()
        except Exception:
            pass  # Never block the API response for rules engine
        return chit_data
    except Exception as e:
        logger.error(f"Error creating chit: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create chit: {str(e)}")
    finally:
        if conn:
            conn.close()


# API endpoint to get chit data
@router.get("/api/chit/{chit_id}")
def get_chit(chit_id: str, request: Request):
    conn = None
    try:
        user_id = request.state.user_id
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM chits WHERE id = ?", (chit_id,))
        row = cursor.fetchone()
        if not row:
            logger.info(f"Chit not found for ID: {chit_id}")
            raise HTTPException(status_code=404, detail="Chit not found")
        chit = dict(zip([col[0] for col in cursor.description], row))
        # Check access via permission resolution (owner, manager, viewer, or None)
        owner_settings = None
        chit_owner_id = chit.get("owner_id")
        if chit_owner_id and chit_owner_id != user_id:
            # Load owner's settings for tag-level share resolution
            cursor.execute("SELECT shared_tags FROM settings WHERE user_id = ?", (chit_owner_id,))
            settings_row = cursor.fetchone()
            if settings_row and settings_row[0]:
                owner_settings = {"shared_tags": settings_row[0]}
        effective_role = resolve_effective_role(chit, user_id, owner_settings)
        if effective_role is None:
            raise HTTPException(status_code=404, detail="Chit not found")
        chit["tags"] = deserialize_json_field(chit["tags"])
        chit["checklist"] = deserialize_json_field(chit["checklist"])
        chit["people"] = deserialize_json_field(chit["people"])
        chit["child_chits"] = deserialize_json_field(chit.get("child_chits"))
        chit["is_project_master"] = bool(chit.get("is_project_master"))
        chit["all_day"] = bool(chit.get("all_day"))
        chit["pinned"] = bool(chit.get("pinned"))
        chit["archived"] = bool(chit.get("archived"))
        chit["alerts"] = deserialize_json_field(chit.get("alerts"))
        chit["recurrence_rule"] = deserialize_json_field(chit.get("recurrence_rule"))
        chit["recurrence_exceptions"] = deserialize_json_field(chit.get("recurrence_exceptions"))
        chit["weather_data"] = deserialize_json_field(chit.get("weather_data"))
        chit["health_data"] = deserialize_json_field(chit.get("health_data"))
        chit["habit"] = bool(chit.get("habit"))
        chit["habit_goal"] = int(chit.get("habit_goal") or 1)
        chit["habit_success"] = int(chit.get("habit_success") or 0)
        chit["show_on_calendar"] = bool(chit.get("show_on_calendar", 1))
        chit["habit_reset_period"] = chit.get("habit_reset_period")
        chit["habit_last_action_date"] = chit.get("habit_last_action_date")
        chit["habit_hide_overall"] = bool(chit.get("habit_hide_overall"))
        chit["perpetual"] = bool(chit.get("perpetual"))
        chit["shares"] = deserialize_json_field(chit.get("shares"))
        chit["stealth"] = bool(chit.get("stealth"))
        chit["assigned_to"] = chit.get("assigned_to")
        # Email fields
        chit["email_to"] = deserialize_json_field(chit.get("email_to"))
        chit["email_cc"] = deserialize_json_field(chit.get("email_cc"))
        chit["email_bcc"] = deserialize_json_field(chit.get("email_bcc"))
        chit["email_read"] = bool(chit.get("email_read")) if chit.get("email_read") is not None else None
        chit["effective_role"] = effective_role

        # Enrich with assigned_to_display_name
        _enrich_assigned_to_display_names(cursor, [chit])

        return chit
    except sqlite3.Error as e:
        logger.error(f"Database error fetching chit {chit_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error fetching chit {chit_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")
    finally:
        if conn:
            conn.close()


@router.put("/api/chits/{chit_id}")
def update_chit(chit_id: str, chit: Chit, request: Request):
    conn = None
    try:
        user_id = request.state.user_id
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM chits WHERE id = ?", (chit_id,))
        existing = cursor.fetchone()
        current_time = datetime.utcnow().isoformat()
        # Strip any reserved CWOC_System/ tags from user-submitted tags before computing system tags
        chit.tags = _strip_reserved_tags(chit.tags)
        chit_tags = compute_system_tags(chit)
        if existing:
            existing_dict_check = dict(zip([col[0] for col in cursor.description], existing))

            # Permission check: load owner settings for role resolution
            owner_settings = None
            chit_owner_id = existing_dict_check.get("owner_id")
            if chit_owner_id and chit_owner_id != user_id:
                cursor.execute("SELECT shared_tags FROM settings WHERE user_id = ?", (chit_owner_id,))
                settings_row = cursor.fetchone()
                if settings_row and settings_row[0]:
                    owner_settings = {"shared_tags": settings_row[0]}

            effective_role = resolve_effective_role(existing_dict_check, user_id, owner_settings)
            if effective_role is None:
                raise HTTPException(status_code=404, detail="Chit not found")
            if effective_role == "viewer":
                raise HTTPException(status_code=403, detail="You have read-only access to this chit")
            if not can_edit_chit(existing_dict_check, user_id, owner_settings):
                raise HTTPException(status_code=403, detail="You have read-only access to this chit")

            # Stealth is ALWAYS preserved for non-owners (stealth is owner-only)
            if existing_dict_check.get("owner_id") != user_id:
                chit.stealth = bool(existing_dict_check.get("stealth"))

            # Non-managers cannot change shares or assigned_to — preserve existing values
            if not can_manage_sharing(existing_dict_check, user_id, owner_settings):
                chit.shares = deserialize_json_field(existing_dict_check.get("shares"))
                chit.assigned_to = existing_dict_check.get("assigned_to")

            # Capture old state for audit diff
            old_chit_dict = existing_dict_check

            # Update existing chit
            cursor.execute(
                """
                UPDATE chits SET
                    title = ?, note = ?, tags = ?, start_datetime = ?, end_datetime = ?, due_datetime = ?,
                    completed_datetime = ?, status = ?, priority = ?, severity = ?, checklist = ?, alarm = ?, notification = ?,
                    recurrence = ?, recurrence_id = ?, location = ?, color = ?, people = ?, pinned = ?,
                    archived = ?, deleted = ?, modified_datetime = ?, is_project_master = ?, child_chits = ?, all_day = ?, alerts = ?,
                    recurrence_rule = ?, recurrence_exceptions = ?, weather_data = ?, health_data = ?,
                    habit = ?, habit_goal = ?, habit_success = ?, show_on_calendar = ?,
                    habit_reset_period = ?, habit_last_action_date = ?, habit_hide_overall = ?, perpetual = ?,
                    shares = ?, stealth = ?, assigned_to = ?,
                    email_message_id = ?, email_from = ?, email_to = ?, email_cc = ?, email_bcc = ?,
                    email_subject = ?, email_body_text = ?, email_body_html = ?, email_date = ?, email_folder = ?,
                    email_status = ?, email_read = ?, email_in_reply_to = ?, email_references = ?,
                    attachments = ?, availability = ?
                WHERE id = ?
                """,
                (
                    chit.title,
                    chit.note,
                    serialize_json_field(chit_tags),
                    chit.start_datetime,
                    chit.end_datetime,
                    chit.due_datetime,
                    chit.completed_datetime,
                    chit.status,
                    chit.priority,
                    chit.severity,
                    serialize_json_field(chit.checklist),
                    chit.alarm,
                    chit.notification,
                    chit.recurrence,
                    chit.recurrence_id,
                    chit.location,
                    chit.color,
                    serialize_json_field(chit.people),
                    chit.pinned,
                    chit.archived,
                    chit.deleted if chit.deleted is not None else False,
                    current_time,
                    chit.is_project_master,
                    serialize_json_field(chit.child_chits),
                    chit.all_day if chit.all_day is not None else False,
                    serialize_json_field(chit.alerts),
                    serialize_json_field(chit.recurrence_rule),
                    serialize_json_field(chit.recurrence_exceptions),
                    serialize_json_field(chit.weather_data),
                    serialize_json_field(chit.health_data),
                    1 if chit.habit else 0,
                    chit.habit_goal if chit.habit_goal is not None else 1,
                    chit.habit_success if chit.habit_success is not None else 0,
                    1 if chit.show_on_calendar is None or chit.show_on_calendar else 0,
                    chit.habit_reset_period,
                    chit.habit_last_action_date,
                    1 if chit.habit_hide_overall else 0,
                    1 if chit.perpetual else 0,
                    serialize_json_field(chit.shares),
                    1 if chit.stealth else 0,
                    chit.assigned_to,
                    chit.email_message_id,
                    chit.email_from,
                    serialize_json_field(chit.email_to),
                    serialize_json_field(chit.email_cc),
                    serialize_json_field(chit.email_bcc),
                    chit.email_subject,
                    chit.email_body_text,
                    chit.email_body_html,
                    chit.email_date,
                    chit.email_folder,
                    chit.email_status,
                    1 if chit.email_read else 0 if chit.email_read is not None else None,
                    chit.email_in_reply_to,
                    chit.email_references,
                    serialize_json_field(chit.attachments) if chit.attachments else None,
                    chit.availability,
                    chit_id,
                )
            )
            # Audit logging for chit update
            try:
                new_chit_dict = {
                    "title": chit.title, "note": chit.note, "tags": serialize_json_field(chit_tags),
                    "start_datetime": chit.start_datetime, "end_datetime": chit.end_datetime,
                    "due_datetime": chit.due_datetime, "completed_datetime": chit.completed_datetime,
                    "status": chit.status, "priority": chit.priority, "severity": chit.severity,
                    "checklist": serialize_json_field(chit.checklist), "alarm": chit.alarm,
                    "notification": chit.notification, "recurrence": chit.recurrence,
                    "recurrence_id": chit.recurrence_id, "location": chit.location, "color": chit.color,
                    "people": serialize_json_field(chit.people), "pinned": chit.pinned,
                    "archived": chit.archived, "deleted": chit.deleted if chit.deleted is not None else False,
                    "is_project_master": chit.is_project_master,
                    "child_chits": serialize_json_field(chit.child_chits),
                    "all_day": chit.all_day if chit.all_day is not None else False,
                    "alerts": serialize_json_field(chit.alerts),
                    "recurrence_rule": serialize_json_field(chit.recurrence_rule),
                    "recurrence_exceptions": serialize_json_field(chit.recurrence_exceptions),
                    "weather_data": serialize_json_field(chit.weather_data),
                    "health_data": serialize_json_field(chit.health_data),
                    "habit": 1 if chit.habit else 0,
                    "habit_goal": chit.habit_goal if chit.habit_goal is not None else 1,
                    "habit_success": chit.habit_success if chit.habit_success is not None else 0,
                    "show_on_calendar": 1 if chit.show_on_calendar is None or chit.show_on_calendar else 0,
                    "habit_reset_period": chit.habit_reset_period,
                    "habit_last_action_date": chit.habit_last_action_date,
                    "habit_hide_overall": 1 if chit.habit_hide_overall else 0,
                    "perpetual": 1 if chit.perpetual else 0,
                    "shares": serialize_json_field(chit.shares),
                    "stealth": 1 if chit.stealth else 0,
                    "assigned_to": chit.assigned_to,
                    "email_message_id": chit.email_message_id,
                    "email_from": chit.email_from,
                    "email_to": serialize_json_field(chit.email_to),
                    "email_cc": serialize_json_field(chit.email_cc),
                    "email_bcc": serialize_json_field(chit.email_bcc),
                    "email_subject": chit.email_subject,
                    "email_body_text": chit.email_body_text,
                    "email_body_html": chit.email_body_html,
                    "email_date": chit.email_date,
                    "email_folder": chit.email_folder,
                    "email_status": chit.email_status,
                    "email_read": 1 if chit.email_read else 0 if chit.email_read is not None else None,
                    "email_in_reply_to": chit.email_in_reply_to,
                    "email_references": chit.email_references,
                    "attachments": serialize_json_field(chit.attachments) if chit.attachments else None,
                }
                diff = compute_audit_diff(old_chit_dict, new_chit_dict, exclude_fields={"modified_datetime", "created_datetime"})
                if diff:
                    actor = get_actor_from_request(request)
                    insert_audit_entry(conn, "chit", chit_id, "updated", actor, changes=diff, entity_summary=chit.title)
            except Exception as e:
                logger.error(f"Audit logging failed for chit update (best-effort): {str(e)}")

            # Create notifications for newly shared users
            try:
                old_shares = deserialize_json_field(old_chit_dict.get("shares")) or []
                new_shares = chit.shares if isinstance(chit.shares, list) else []
                old_assigned = old_chit_dict.get("assigned_to")
                # Look up owner display name for the notification
                cursor.execute("SELECT display_name, username FROM users WHERE id = ?", (existing_dict_check.get("owner_id") or user_id,))
                _owner_row = cursor.fetchone()
                _owner_display = _owner_row[0] or _owner_row[1] if _owner_row else ""
                _create_share_notifications(
                    cursor, chit_id, chit.title, _owner_display,
                    old_shares, new_shares,
                    assigned_to_new=chit.assigned_to,
                    assigned_to_old=old_assigned,
                )
            except Exception as e:
                logger.error(f"Notification creation failed for chit update (best-effort): {str(e)}")
        else:
            # Create new chit — look up owner info
            cursor.execute("SELECT display_name, username FROM users WHERE id = ?", (user_id,))
            user_row = cursor.fetchone()
            owner_display_name = user_row[0] if user_row else ""
            owner_username = user_row[1] if user_row else request.state.username

            cursor.execute(
                """
                INSERT INTO chits (
                    id, title, note, tags, start_datetime, end_datetime, due_datetime,
                    completed_datetime, status, priority, severity, checklist, alarm, notification,
                    recurrence, recurrence_id, location, color, people, pinned, archived,
                    deleted, created_datetime, modified_datetime, is_project_master, child_chits, all_day, alerts,
                    recurrence_rule, recurrence_exceptions, weather_data, health_data,
                    habit, habit_goal, habit_success, show_on_calendar,
                    habit_reset_period, habit_last_action_date, habit_hide_overall, perpetual,
                    owner_id, owner_display_name, owner_username,
                    shares, stealth, assigned_to,
                    email_message_id, email_from, email_to, email_cc, email_bcc,
                    email_subject, email_body_text, email_body_html, email_date, email_folder,
                    email_status, email_read, email_in_reply_to, email_references,
                    attachments, availability
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    chit_id,
                    chit.title,
                    chit.note,
                    serialize_json_field(chit_tags),
                    chit.start_datetime,
                    chit.end_datetime,
                    chit.due_datetime,
                    chit.completed_datetime,
                    chit.status,
                    chit.priority,
                    chit.severity,
                    serialize_json_field(chit.checklist),
                    chit.alarm,
                    chit.notification,
                    chit.recurrence,
                    chit.recurrence_id,
                    chit.location,
                    chit.color,
                    serialize_json_field(chit.people),
                    chit.pinned,
                    chit.archived,
                    chit.deleted if chit.deleted is not None else False,
                    current_time,
                    current_time,
                    chit.is_project_master,
                    serialize_json_field(chit.child_chits),
                    chit.all_day if chit.all_day is not None else False,
                    serialize_json_field(chit.alerts),
                    serialize_json_field(chit.recurrence_rule),
                    serialize_json_field(chit.recurrence_exceptions),
                    serialize_json_field(chit.weather_data),
                    serialize_json_field(chit.health_data),
                    1 if chit.habit else 0,
                    chit.habit_goal if chit.habit_goal is not None else 1,
                    chit.habit_success if chit.habit_success is not None else 0,
                    1 if chit.show_on_calendar is None or chit.show_on_calendar else 0,
                    chit.habit_reset_period,
                    chit.habit_last_action_date,
                    1 if chit.habit_hide_overall else 0,
                    1 if chit.perpetual else 0,
                    user_id,
                    owner_display_name,
                    owner_username,
                    serialize_json_field(chit.shares),
                    1 if chit.stealth else 0,
                    chit.assigned_to,
                    chit.email_message_id,
                    chit.email_from,
                    serialize_json_field(chit.email_to),
                    serialize_json_field(chit.email_cc),
                    serialize_json_field(chit.email_bcc),
                    chit.email_subject,
                    chit.email_body_text,
                    chit.email_body_html,
                    chit.email_date,
                    chit.email_folder,
                    chit.email_status,
                    1 if chit.email_read else 0 if chit.email_read is not None else None,
                    chit.email_in_reply_to,
                    chit.email_references,
                    serialize_json_field(chit.attachments) if chit.attachments else None,
                    chit.availability,
                )
            )
            # Audit logging for chit creation
            try:
                actor = get_actor_from_request(request)
                insert_audit_entry(conn, "chit", chit_id, "created", actor, entity_summary=chit.title)
            except Exception as e:
                logger.error(f"Audit logging failed for chit creation (best-effort): {str(e)}")
            # Create notifications for shared users on new chit creation via PUT
            try:
                new_shares = chit.shares if isinstance(chit.shares, list) else []
                if new_shares:
                    _create_share_notifications(
                        cursor, chit_id, chit.title, owner_display_name,
                        [], new_shares,
                        assigned_to_new=chit.assigned_to,
                        assigned_to_old=None,
                    )
            except Exception as e:
                logger.error(f"Notification creation failed for new chit via PUT (best-effort): {str(e)}")
        conn.commit()
        chit_data = {**chit.dict(), "id": chit_id, "tags": chit_tags, "modified_datetime": current_time}
        # Fire-and-forget: dispatch rules engine trigger for chit update or creation
        try:
            trigger = "chit_updated" if existing else "chit_created"
            logger.info("Firing rules engine trigger: %s for chit %s, owner %s", trigger, chit_id, user_id)
            threading.Thread(
                target=dispatch_trigger,
                args=(trigger, "chit", chit_data, user_id),
                daemon=True,
            ).start()
        except Exception:
            pass  # Never block the API response for rules engine
        return chit_data
    except Exception as e:
        logger.error(f"Error updating/creating chit: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update/create chit: {str(e)}")
    finally:
        if conn:
            conn.close()


@router.delete("/api/chits/{chit_id}")
def delete_chit(chit_id: str, request: Request):
    conn = None
    try:
        user_id = request.state.user_id
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM chits WHERE id = ?", (chit_id,))
        existing_chit = cursor.fetchone()
        if not existing_chit:
            raise HTTPException(status_code=404, detail="Chit not found")
        # Capture chit title for audit logging before soft-delete
        chit_columns = [col[0] for col in cursor.description]
        chit_dict = dict(zip(chit_columns, existing_chit))

        # Load owner settings for role resolution (needed for non-owner managers)
        owner_settings = None
        chit_owner_id = chit_dict.get("owner_id")
        if chit_owner_id and chit_owner_id != user_id:
            cursor.execute("SELECT shared_tags FROM settings WHERE user_id = ?", (chit_owner_id,))
            settings_row = cursor.fetchone()
            if settings_row and settings_row[0]:
                owner_settings = {"shared_tags": settings_row[0]}

        # Owner or manager can delete — others get 404 to avoid revealing chit existence
        if not can_delete_chit(chit_dict, user_id, owner_settings):
            raise HTTPException(status_code=404, detail="Chit not found")
        chit_title = chit_dict.get("title")

        current_time = datetime.utcnow().isoformat()
        # If this is an email chit, also move it to the trash folder
        if chit_dict.get("email_message_id") or chit_dict.get("email_status"):
            cursor.execute(
                "UPDATE chits SET deleted = 1, email_folder = 'trash', modified_datetime = ? WHERE id = ?",
                (current_time, chit_id),
            )
        else:
            cursor.execute(
                "UPDATE chits SET deleted = 1, modified_datetime = ? WHERE id = ?",
                (current_time, chit_id),
            )
        # Audit logging for chit deletion
        try:
            actor = get_actor_from_request(request)
            insert_audit_entry(conn, "chit", chit_id, "deleted", actor, entity_summary=chit_title)
        except Exception as e:
            logger.error(f"Audit logging failed for chit deletion (best-effort): {str(e)}")
        conn.commit()
        return {"message": "Chit deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting chit: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete chit: {str(e)}")
    finally:
        if conn:
            conn.close()


@router.patch("/api/chits/{chit_id}/checklist")
def patch_chit_checklist(chit_id: str, body: dict, request: Request):
    """Save only the checklist field of a chit (auto-save).
    Body: { "checklist": [...] }
    Does NOT update modified_datetime to avoid triggering sync conflicts.
    """
    conn = None
    try:
        user_id = request.state.user_id
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        # Verify ownership or manager-level share access
        cursor.execute("SELECT owner_id, shares FROM chits WHERE id = ?", (chit_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Chit not found")
        owner_id = row["owner_id"]
        has_access = (owner_id == user_id)
        if not has_access:
            shares = deserialize_json_field(row["shares"]) or []
            has_access = any(
                s.get("user_id") == user_id and s.get("role") in ("manager", "editor")
                for s in shares
            )
        if not has_access:
            raise HTTPException(status_code=404, detail="Chit not found")
        checklist_data = body.get("checklist", [])
        cursor.execute(
            "UPDATE chits SET checklist = ? WHERE id = ?",
            (serialize_json_field(checklist_data), chit_id)
        )
        conn.commit()
        return {"message": "Checklist saved"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error patching checklist: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.close()


@router.patch("/api/chits/{chit_id}/recurrence-exceptions")
def patch_recurrence_exceptions(chit_id: str, body: dict, request: Request):
    """Add or update a recurrence exception on a parent chit.
    Body: { "exception": { "date": "YYYY-MM-DD", "completed": bool, "broken_off": bool, "title": str, ... } }
    """
    conn = None
    try:
        user_id = request.state.user_id
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        # First verify ownership
        cursor.execute("SELECT owner_id, recurrence_exceptions FROM chits WHERE id = ?", (chit_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Chit not found")
        if row["owner_id"] and row["owner_id"] != user_id:
            raise HTTPException(status_code=404, detail="Chit not found")
        exceptions = deserialize_json_field(row["recurrence_exceptions"]) or []
        new_exc = body.get("exception", {})
        exc_date = new_exc.get("date")
        if not exc_date:
            raise HTTPException(status_code=400, detail="Exception must have a date")
        # Replace existing exception for this date, or append
        exceptions = [e for e in exceptions if e.get("date") != exc_date]
        exceptions.append(new_exc)
        cursor.execute(
            "UPDATE chits SET recurrence_exceptions = ?, modified_datetime = ? WHERE id = ?",
            (serialize_json_field(exceptions), datetime.utcnow().isoformat(), chit_id)
        )
        conn.commit()
        return {"message": "Exception updated", "exceptions": exceptions}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error patching recurrence exceptions: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.close()


# ═══════════════════════════════════════════════════════════════════════════
# RSVP Status
# ═══════════════════════════════════════════════════════════════════════════

@router.patch("/api/chits/{chit_id}/rsvp")
def update_rsvp_status(chit_id: str, body: dict, request: Request):
    """Update the current user's RSVP status on a shared chit.

    Body: { "rsvp_status": "accepted" | "declined" | "invited" }

    Authorization: The requesting user must be in the chit's shares list.
    The owner cannot have an RSVP status.
    Users can only update their own RSVP status.
    """
    VALID_RSVP_STATUSES = {"invited", "accepted", "declined"}

    rsvp_status = body.get("rsvp_status")
    if rsvp_status not in VALID_RSVP_STATUSES:
        raise HTTPException(
            status_code=400,
            detail="Invalid rsvp_status. Must be one of: invited, accepted, declined",
        )

    # Cross-user RSVP protection: reject if a target_user_id is specified and differs from the requester
    target_user_id = body.get("target_user_id")
    if target_user_id and target_user_id != request.state.user_id:
        raise HTTPException(status_code=403, detail="You can only update your own RSVP status")

    conn = None
    try:
        user_id = request.state.user_id
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        cursor.execute("SELECT id, owner_id, shares, title FROM chits WHERE id = ?", (chit_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Chit not found or user not in shares list")

        # Owner cannot have RSVP status
        if row["owner_id"] == user_id:
            raise HTTPException(status_code=403, detail="Owner cannot have RSVP status")

        # Parse shares and find the requesting user's own entry only
        shares = deserialize_json_field(row["shares"]) or []
        user_found = False
        for entry in shares:
            if isinstance(entry, dict) and entry.get("user_id") == user_id:
                entry["rsvp_status"] = rsvp_status
                user_found = True
                break

        if not user_found:
            raise HTTPException(status_code=404, detail="Chit not found or user not in shares list")

        # Save updated shares back to the database
        current_time = datetime.utcnow().isoformat()
        cursor.execute(
            "UPDATE chits SET shares = ?, modified_datetime = ? WHERE id = ?",
            (serialize_json_field(shares), current_time, chit_id),
        )

        # Sync corresponding notification status to match the new RSVP status
        try:
            cursor.execute(
                """UPDATE notifications SET status = ?
                   WHERE user_id = ? AND chit_id = ? AND status = 'pending'""",
                (rsvp_status, user_id, chit_id),
            )
        except Exception as e:
            logger.error(f"Notification sync failed for RSVP update (best-effort): {str(e)}")

        # Audit logging
        try:
            actor = get_actor_from_request(request)
            insert_audit_entry(
                conn, "chit", chit_id, "rsvp_updated", actor,
                changes=[{"field": "rsvp_status", "old": None, "new": rsvp_status}],
                entity_summary=row["title"],
            )
        except Exception as e:
            logger.error(f"Audit logging failed for RSVP update (best-effort): {str(e)}")

        conn.commit()
        return {"message": "RSVP status updated", "rsvp_status": rsvp_status}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating RSVP status for chit {chit_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update RSVP status")
    finally:
        if conn:
            conn.close()


