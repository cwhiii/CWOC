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
from zoneinfo import available_timezones

from fastapi import APIRouter, HTTPException, Query, Request, Response

from src.backend.db import (
    DB_PATH, serialize_json_field, deserialize_json_field,
    compute_system_tags, _build_export_envelope, ensure_tags_in_settings,
    get_next_sync_version,
)
from src.backend.models import Chit, ImportRequest
from src.backend.routes.audit import insert_audit_entry, compute_audit_diff, get_actor_from_request
from src.backend.sharing import resolve_effective_role, can_edit_chit, can_delete_chit, can_manage_sharing
from src.backend.routes.notifications import _create_share_notifications
from src.backend.rules_engine import dispatch_trigger


logger = logging.getLogger(__name__)
router = APIRouter()


# ═══════════════════════════════════════════════════════════════════════════
# Assignment Notification Helper
# ═══════════════════════════════════════════════════════════════════════════

def _send_assignment_notifications(assigned_to: str, chit_id: str, chit_title: str,
                                   assigner_display_name: str):
    """Send push + ntfy notifications when a user is assigned to a chit.

    Fires both Web Push and ntfy in a background thread so the API response
    is never blocked. Failures are logged and swallowed.

    Args:
        assigned_to: User ID of the newly assigned user.
        chit_id: The chit's UUID.
        chit_title: Display title for the notification.
        assigner_display_name: Display name of the person who assigned the chit.
    """
    def _do_send():
        title = chit_title or "(Untitled chit)"
        body = f"Assigned to you by {assigner_display_name}"

        # --- Web Push ---
        try:
            from src.backend.routes.push import send_push_to_user
            payload = {
                "title": f"📋 {title}",
                "body": body,
                "icon": "/static/cwoc-icon-192.png",
                "badge": "/static/cwoc-icon-192.png",
                "data": {
                    "chit_id": chit_id,
                    "url": f"/frontend/html/editor.html?id={chit_id}",
                },
            }
            result = send_push_to_user(assigned_to, payload)
            if result.get("sent", 0) > 0:
                logger.info(f"Assignment push sent for chit {chit_id} to user {assigned_to}")
            else:
                logger.debug(f"Assignment push skipped for chit {chit_id}: {result}")
        except Exception as e:
            logger.warning(f"Assignment push failed for chit {chit_id}: {e}")

        # --- Ntfy ---
        try:
            from src.backend.routes.ntfy import send_ntfy_notification
            from src.backend.schedulers import _get_server_base_url

            base = _get_server_base_url()
            click_url = f"{base}/frontend/html/editor.html?id={chit_id}"
            icon_url = f"{base}/static/cwoc-icon-192.png"

            # Build simple actions: Open + Dismiss
            open_action = f"view, Open, {click_url}, clear=true"
            dismiss_action = f"view, Dismiss, {base}/, clear=true"
            actions = f"{open_action}; {dismiss_action}"

            result = send_ntfy_notification(
                user_id=assigned_to,
                title=f"📋 {title}",
                body=body,
                click_url=click_url,
                tags="clipboard",
                priority=4,  # high — noticeable but not alarm-level
                icon_url=icon_url,
                actions=actions,
            )
            if result.get("sent"):
                logger.info(f"Assignment ntfy sent for chit {chit_id} to user {assigned_to}")
            else:
                logger.debug(f"Assignment ntfy skipped for chit {chit_id}: {result.get('reason')}")
        except Exception as e:
            logger.warning(f"Assignment ntfy failed for chit {chit_id}: {e}")

    threading.Thread(target=_do_send, daemon=True).start()

# --- Reserved tag namespace enforcement ---
RESERVED_TAG_PREFIX = "cwoc_system/"


# ═══════════════════════════════════════════════════════════════════════════
# Timezone Validation
# ═══════════════════════════════════════════════════════════════════════════

def validate_timezone(tz_value):
    """Validate that a timezone string is a recognized IANA timezone.

    Returns True if valid (including None, which means floating chit).
    Returns False if the value is a non-null string not in the IANA database.
    """
    if tz_value is None:
        return True
    return tz_value in available_timezones()


def _validate_nest_thread_id(cursor, chit):
    """Validate nest_thread_id on save.

    Rules:
    - Email chits (has email_message_id or email_status) cannot have nest_thread_id set
    - If nest_thread_id is non-null, the referenced chit must exist and be an email chit
    Raises HTTPException(422) on validation failure.
    """
    # Treat empty string as null
    nest_id = chit.nest_thread_id if chit.nest_thread_id else None

    # Check if the chit being saved is itself an email chit
    if nest_id and (chit.email_message_id or chit.email_status):
        raise HTTPException(
            status_code=422,
            detail="Email chits cannot be nested into threads — they already belong to threads natively",
        )

    if nest_id:
        cursor.execute(
            "SELECT id, email_message_id, email_status FROM chits WHERE id = ?",
            (nest_id,),
        )
        ref_row = cursor.fetchone()
        if not ref_row:
            raise HTTPException(
                status_code=422,
                detail="nest_thread_id references a chit that does not exist",
            )
        # ref_row is a tuple: (id, email_message_id, email_status)
        ref_email_message_id = ref_row[1]
        ref_email_status = ref_row[2]
        if not ref_email_message_id and not ref_email_status:
            raise HTTPException(
                status_code=422,
                detail="nest_thread_id must reference an email chit (has email_message_id or email_status)",
            )


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


def _cascade_prerequisite_unblock(cursor, conn, completed_chit_id, _visited=None):
    """When a chit is marked Complete, find all chits that have it as a prerequisite.
    If ALL their prerequisites are now Complete, set their status to 'ToDo'.
    Also: if a dependent has auto_complete_checklist enabled, check if it can auto-complete.
    Recursive: if auto-complete sets a dependent to Complete, cascades further up."""
    if _visited is None:
        _visited = set()
    if completed_chit_id in _visited:
        return
    _visited.add(completed_chit_id)

    # Find all chits that reference this chit in their prerequisites
    cursor.execute(
        "SELECT id, prerequisites, status FROM chits WHERE prerequisites LIKE ? AND (deleted = 0 OR deleted IS NULL)",
        (f'%{completed_chit_id}%',)
    )
    dependents = cursor.fetchall()
    for dep_id, dep_prereqs_raw, dep_status in dependents:
        dep_prereqs = deserialize_json_field(dep_prereqs_raw)
        if not dep_prereqs or completed_chit_id not in dep_prereqs:
            continue
        # Check if ALL prerequisites of this dependent are now Complete
        placeholders = ",".join("?" * len(dep_prereqs))
        cursor.execute(
            f"SELECT id, status FROM chits WHERE id IN ({placeholders})",
            dep_prereqs
        )
        all_prereqs_complete = True
        for _, prereq_status in cursor.fetchall():
            if prereq_status != "Complete":
                all_prereqs_complete = False
                break
        # Standard unblock: if currently Blocked and all prereqs done, set to ToDo
        if all_prereqs_complete and dep_status == "Blocked":
            cursor.execute(
                "UPDATE chits SET status = 'ToDo', modified_datetime = ? WHERE id = ?",
                (datetime.utcnow().isoformat(), dep_id)
            )
            conn.commit()
            logger.info(f"Prerequisites cascade: unblocked chit {dep_id} (all prereqs complete)")
        # Auto-complete cascade: if all prereqs complete and auto_complete_checklist enabled, try to complete
        if all_prereqs_complete:
            _try_auto_complete(cursor, conn, dep_id, _visited)


def _try_auto_complete(cursor, conn, chit_id, _visited=None):
    """Attempt to auto-complete a chit if auto_complete_checklist is enabled and conditions are met.
    Conditions: all non-blank checklist items checked AND all prerequisites Complete.
    If no checklist items exist, only prerequisites need to be Complete.
    Recursive: if this chit becomes Complete, cascades to its dependents."""
    cursor.execute(
        "SELECT auto_complete_checklist, status, checklist, prerequisites FROM chits WHERE id = ?",
        (chit_id,)
    )
    row = cursor.fetchone()
    if not row or not row[0]:  # auto_complete_checklist not enabled
        return
    current_status = row[1] or ""
    checklist_data = deserialize_json_field(row[2]) or []
    prereq_ids = deserialize_json_field(row[3]) or []

    # Check prerequisites
    if prereq_ids:
        placeholders = ",".join("?" * len(prereq_ids))
        cursor.execute(f"SELECT status FROM chits WHERE id IN ({placeholders})", prereq_ids)
        for (prereq_status,) in cursor.fetchall():
            if prereq_status != "Complete":
                return  # Can't auto-complete — prereq not done

    # Check checklist
    non_blank = [item for item in checklist_data if isinstance(item, dict) and (item.get("text") or "").strip()]
    if non_blank:
        all_checked = all(item.get("checked") for item in non_blank)
        if not all_checked:
            return  # Can't auto-complete — unchecked items remain
    elif not prereq_ids:
        return  # No checklist and no prereqs — nothing to auto-complete on

    # All conditions met — set to Complete
    if current_status != "Complete":
        cursor.execute(
            "UPDATE chits SET status = 'Complete', modified_datetime = ? WHERE id = ?",
            (datetime.utcnow().isoformat(), chit_id)
        )
        conn.commit()
        logger.info(f"Auto-complete: chit {chit_id} set to Complete (all checklist + prereqs done)")
        # Recurse: this chit is now Complete, cascade to its dependents
        _cascade_prerequisite_unblock(cursor, conn, chit_id, _visited)


def _cascade_auto_complete_revert(cursor, conn, reverted_chit_id, _visited=None):
    """When a chit's status changes AWAY from Complete, find all chits with
    auto_complete_checklist enabled that have this chit as a prerequisite,
    and revert them to ToDo. Recursive: reverted dependents cascade further up."""
    if _visited is None:
        _visited = set()
    if reverted_chit_id in _visited:
        return
    _visited.add(reverted_chit_id)

    cursor.execute(
        "SELECT id, prerequisites, status, auto_complete_checklist FROM chits "
        "WHERE auto_complete_checklist = 1 AND prerequisites LIKE ? AND (deleted = 0 OR deleted IS NULL)",
        (f'%{reverted_chit_id}%',)
    )
    dependents = cursor.fetchall()
    for dep_id, dep_prereqs_raw, dep_status, _ in dependents:
        dep_prereqs = deserialize_json_field(dep_prereqs_raw)
        if not dep_prereqs or reverted_chit_id not in dep_prereqs:
            continue
        # If the dependent is currently Complete, revert to ToDo and recurse
        if dep_status == "Complete":
            cursor.execute(
                "UPDATE chits SET status = 'ToDo', modified_datetime = ? WHERE id = ?",
                (datetime.utcnow().isoformat(), dep_id)
            )
            conn.commit()
            logger.info(f"Auto-complete revert: chit {dep_id} set to ToDo (prereq {reverted_chit_id} no longer Complete)")
            # Recurse: dep_id is no longer Complete, cascade to its dependents
            _cascade_auto_complete_revert(cursor, conn, dep_id, _visited)


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
            chit["show_on_calendar"] = chit.get("show_on_calendar", 1) not in (0, False)
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
            chit["snoozed_until"] = chit.get("snoozed_until")
            chit["prerequisites"] = deserialize_json_field(chit.get("prerequisites"))
            chit["checklist_autosave"] = bool(chit.get("checklist_autosave")) if chit.get("checklist_autosave") is not None else None
            chit["auto_complete_checklist"] = bool(chit.get("auto_complete_checklist")) if chit.get("auto_complete_checklist") is not None else None
            chit["has_unviewed_conflict"] = bool(chit.get("has_unviewed_conflict"))
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



@router.post("/api/chits")
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

        # Auto-set status to "ToDo" when assigned_to is set and no status exists
        if chit.assigned_to and not chit.status:
            chit.status = "ToDo"

        # Validate timezone field
        if not validate_timezone(chit.timezone):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid timezone: '{chit.timezone}' is not a recognized IANA timezone"
            )

        # Validate nest_thread_id before saving
        _validate_nest_thread_id(cursor, chit)

        # Assign sync_version for mobile sync tracking
        sync_version = get_next_sync_version(cursor)

        cursor.execute(
            """
            INSERT INTO chits (
                id, title, note, tags, start_datetime, end_datetime, due_datetime, point_in_time,
                completed_datetime, status, priority, severity, checklist, alarm, notification,
                recurrence, recurrence_id, location, color, people, pinned, archived,
                deleted, created_datetime, modified_datetime, is_project_master, child_chits, all_day, timezone, alerts,
                recurrence_rule, recurrence_exceptions, weather_data, health_data,
                habit, habit_goal, habit_success, show_on_calendar,
                habit_reset_period, habit_last_action_date, habit_hide_overall, perpetual,
                owner_id, owner_display_name, owner_username,
                shares, stealth, assigned_to,
                email_message_id, email_from, email_to, email_cc, email_bcc,
                email_subject, email_body_text, email_body_html, email_date, email_folder,
                email_status, email_read, email_in_reply_to, email_references,
                attachments, availability, snoozed_until, prerequisites,
                checklist_autosave, auto_complete_checklist, sync_version
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                chit_id,
                chit.title,
                chit.note,
                serialize_json_field(chit_tags),
                chit.start_datetime,
                chit.end_datetime,
                chit.due_datetime,
                chit.point_in_time,
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
                chit.timezone,
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
                chit.snoozed_until,
                serialize_json_field(chit.prerequisites),
                1 if chit.checklist_autosave else 0 if chit.checklist_autosave is not None else None,
                1 if (chit.auto_complete_checklist is None or chit.auto_complete_checklist) else 0,
                sync_version,
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

        # Send push + ntfy notifications if assigned_to is set on new chit
        try:
            if chit.assigned_to and chit.assigned_to != user_id:
                _send_assignment_notifications(
                    chit.assigned_to, chit_id, chit.title, owner_display_name
                )
        except Exception as e:
            logger.error(f"Assignment notification failed for new chit (best-effort): {str(e)}")

        conn.commit()
        chit_data = {
            **chit.dict(), "id": chit_id, "tags": chit_tags,
            "created_datetime": current_time, "modified_datetime": current_time,
            "owner_id": user_id, "owner_display_name": owner_display_name, "owner_username": owner_username,
            "sync_version": sync_version, "has_unviewed_conflict": False,
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
    except HTTPException:
        raise
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
        chit["show_on_calendar"] = chit.get("show_on_calendar", 1) not in (0, False)
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
        chit["snoozed_until"] = chit.get("snoozed_until")
        chit["prerequisites"] = deserialize_json_field(chit.get("prerequisites"))
        chit["checklist_autosave"] = bool(chit.get("checklist_autosave")) if chit.get("checklist_autosave") is not None else None
        chit["auto_complete_checklist"] = bool(chit.get("auto_complete_checklist")) if chit.get("auto_complete_checklist") is not None else None
        chit["has_unviewed_conflict"] = bool(chit.get("has_unviewed_conflict"))
        chit["effective_role"] = effective_role

        # ── Email privacy: strip tracking pixels / external content ──
        if chit.get("email_body_html") and chit.get("email_status") in ("received", "sent"):
            try:
                from src.backend.routes.email import (
                    _strip_tracking_pixels,
                    _strip_external_content,
                    _get_user_email_privacy_settings,
                )
                privacy = _get_user_email_privacy_settings(cursor, user_id)
                if privacy["block_tracking_pixels"]:
                    chit["email_body_html"] = _strip_tracking_pixels(chit["email_body_html"])
                if privacy["external_content"] == "block":
                    chit["email_body_html"] = _strip_external_content(chit["email_body_html"])
                # Pass privacy settings to frontend for UI decisions
                chit["_email_privacy"] = privacy
            except Exception as e:
                logger.warning(f"Email privacy filtering failed for chit {chit_id}: {e}")

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

            # Auto-set status to "ToDo" when assigned_to is newly set and no status exists
            if chit.assigned_to and not chit.status:
                old_assigned = existing_dict_check.get("assigned_to")
                old_status = existing_dict_check.get("status")
                if not old_status:
                    chit.status = "ToDo"

            # Capture old state for audit diff
            old_chit_dict = existing_dict_check

            # Validate timezone field
            if not validate_timezone(chit.timezone):
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid timezone: '{chit.timezone}' is not a recognized IANA timezone"
                )

            # Validate nest_thread_id before saving
            _validate_nest_thread_id(cursor, chit)

            # Preserve existing attachments if not provided in the request
            # (upload endpoint saves directly to DB; don't overwrite with null)
            if chit.attachments is None:
                chit.attachments = existing_dict_check.get("attachments")

            # Auto-complete checklist: enforce status based on checklist + prerequisites
            if chit.auto_complete_checklist:
                prereq_ids = deserialize_json_field(serialize_json_field(chit.prerequisites)) if chit.prerequisites else []
                prereqs_ok = True
                if prereq_ids:
                    placeholders = ",".join("?" * len(prereq_ids))
                    cursor.execute(f"SELECT status FROM chits WHERE id IN ({placeholders})", prereq_ids)
                    for (ps,) in cursor.fetchall():
                        if ps != "Complete":
                            prereqs_ok = False
                            break
                non_blank = [item for item in (chit.checklist or []) if isinstance(item, dict) and (item.get("text") or "").strip()]
                checklist_ok = all(item.get("checked") for item in non_blank) if non_blank else True
                has_something = bool(non_blank) or bool(prereq_ids)
                if has_something and checklist_ok and prereqs_ok and chit.status != "Complete":
                    chit.status = "Complete"
                elif has_something and (not checklist_ok or not prereqs_ok) and chit.status == "Complete":
                    chit.status = "ToDo"

            # Assign sync_version for mobile sync tracking
            sync_version = get_next_sync_version(cursor)

            # Update existing chit
            cursor.execute(
                """
                UPDATE chits SET
                    title = ?, note = ?, tags = ?, start_datetime = ?, end_datetime = ?, due_datetime = ?, point_in_time = ?,
                    completed_datetime = ?, status = ?, priority = ?, severity = ?, checklist = ?, alarm = ?, notification = ?,
                    recurrence = ?, recurrence_id = ?, location = ?, color = ?, people = ?, pinned = ?,
                    archived = ?, deleted = ?, modified_datetime = ?, is_project_master = ?, child_chits = ?, all_day = ?, timezone = ?, alerts = ?,
                    recurrence_rule = ?, recurrence_exceptions = ?, weather_data = ?, health_data = ?,
                    habit = ?, habit_goal = ?, habit_success = ?, show_on_calendar = ?,
                    habit_reset_period = ?, habit_last_action_date = ?, habit_hide_overall = ?, perpetual = ?,
                    shares = ?, stealth = ?, assigned_to = ?,
                    email_message_id = ?, email_from = ?, email_to = ?, email_cc = ?, email_bcc = ?,
                    email_subject = ?, email_body_text = ?, email_body_html = ?, email_date = ?, email_folder = ?,
                    email_status = ?, email_read = ?, email_in_reply_to = ?, email_references = ?,
                    attachments = ?, availability = ?, nest_thread_id = ?, snoozed_until = ?,
                    prerequisites = ?, checklist_autosave = ?, auto_complete_checklist = ?,
                    sync_version = ?
                WHERE id = ?
                """,
                (
                    chit.title,
                    chit.note,
                    serialize_json_field(chit_tags),
                    chit.start_datetime,
                    chit.end_datetime,
                    chit.due_datetime,
                    chit.point_in_time,
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
                    chit.timezone,
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
                    chit.nest_thread_id,
                    chit.snoozed_until,
                    serialize_json_field(chit.prerequisites),
                    1 if chit.checklist_autosave else 0 if chit.checklist_autosave is not None else None,
                    1 if (chit.auto_complete_checklist is None or chit.auto_complete_checklist) else 0,
                    sync_version,
                    chit_id,
                )
            )
            # Audit logging for chit update
            try:
                new_chit_dict = {
                    "title": chit.title, "note": chit.note, "tags": serialize_json_field(chit_tags),
                    "start_datetime": chit.start_datetime, "end_datetime": chit.end_datetime,
                    "due_datetime": chit.due_datetime, "point_in_time": chit.point_in_time,
                    "completed_datetime": chit.completed_datetime,
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
                    "snoozed_until": chit.snoozed_until,
                }
                diff = compute_audit_diff(old_chit_dict, new_chit_dict, exclude_fields={
                    "modified_datetime", "created_datetime", "id", "owner_id",
                    "owner_display_name", "owner_username", "deleted_datetime",
                })
                if diff:
                    actor = get_actor_from_request(request)
                    # Check if this is a revert operation (signaled by ?revert=1 query param)
                    is_revert = request.query_params.get("revert") == "1"
                    audit_action = "reverted" if is_revert else "updated"
                    insert_audit_entry(conn, "chit", chit_id, audit_action, actor, changes=diff, entity_summary=chit.title)
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

            # Send push + ntfy notifications if assigned_to changed to a new user
            try:
                old_assigned = old_chit_dict.get("assigned_to")
                if chit.assigned_to and chit.assigned_to != old_assigned and chit.assigned_to != user_id:
                    # Look up assigner display name
                    cursor.execute("SELECT display_name, username FROM users WHERE id = ?", (user_id,))
                    _assigner_row = cursor.fetchone()
                    _assigner_name = (_assigner_row[0] or _assigner_row[1]) if _assigner_row else "Someone"
                    _send_assignment_notifications(
                        chit.assigned_to, chit_id, chit.title, _assigner_name
                    )
            except Exception as e:
                logger.error(f"Assignment notification failed for chit update (best-effort): {str(e)}")
        else:
            # Create new chit — look up owner info
            cursor.execute("SELECT display_name, username FROM users WHERE id = ?", (user_id,))
            user_row = cursor.fetchone()
            owner_display_name = user_row[0] if user_row else ""
            owner_username = user_row[1] if user_row else request.state.username

            # Validate timezone field
            if not validate_timezone(chit.timezone):
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid timezone: '{chit.timezone}' is not a recognized IANA timezone"
                )

            # Validate nest_thread_id before saving
            _validate_nest_thread_id(cursor, chit)

            # Assign sync_version for mobile sync tracking
            sync_version = get_next_sync_version(cursor)

            cursor.execute(
                """
                INSERT INTO chits (
                    id, title, note, tags, start_datetime, end_datetime, due_datetime, point_in_time,
                    completed_datetime, status, priority, severity, checklist, alarm, notification,
                    recurrence, recurrence_id, location, color, people, pinned, archived,
                    deleted, created_datetime, modified_datetime, is_project_master, child_chits, all_day, timezone, alerts,
                    recurrence_rule, recurrence_exceptions, weather_data, health_data,
                    habit, habit_goal, habit_success, show_on_calendar,
                    habit_reset_period, habit_last_action_date, habit_hide_overall, perpetual,
                    owner_id, owner_display_name, owner_username,
                    shares, stealth, assigned_to,
                    email_message_id, email_from, email_to, email_cc, email_bcc,
                    email_subject, email_body_text, email_body_html, email_date, email_folder,
                    email_status, email_read, email_in_reply_to, email_references,
                    attachments, availability, snoozed_until, prerequisites,
                    checklist_autosave, auto_complete_checklist, sync_version
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    chit_id,
                    chit.title,
                    chit.note,
                    serialize_json_field(chit_tags),
                    chit.start_datetime,
                    chit.end_datetime,
                    chit.due_datetime,
                    chit.point_in_time,
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
                    chit.timezone,
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
                    chit.snoozed_until,
                    serialize_json_field(chit.prerequisites),
                    1 if chit.checklist_autosave else 0 if chit.checklist_autosave is not None else None,
                    1 if (chit.auto_complete_checklist is None or chit.auto_complete_checklist) else 0,
                    sync_version,
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
            # Send push + ntfy notifications if assigned_to is set on new chit via PUT
            try:
                if chit.assigned_to and chit.assigned_to != user_id:
                    _send_assignment_notifications(
                        chit.assigned_to, chit_id, chit.title, owner_display_name
                    )
            except Exception as e:
                logger.error(f"Assignment notification failed for new chit via PUT (best-effort): {str(e)}")
        conn.commit()

        # ── Prerequisite cascade: when a chit is marked Complete, unblock dependents ──
        try:
            if chit.status == "Complete":
                _cascade_prerequisite_unblock(cursor, conn, chit_id)
        except Exception as e:
            logger.error(f"Prerequisite cascade failed (best-effort): {str(e)}")

        # ── Reverse cascade: when a chit moves AWAY from Complete, revert auto-complete dependents ──
        try:
            old_status = old_chit_dict.get("status") if old_chit_dict else None
            if old_status == "Complete" and chit.status != "Complete":
                _cascade_auto_complete_revert(cursor, conn, chit_id)
        except Exception as e:
            logger.error(f"Auto-complete revert cascade failed (best-effort): {str(e)}")

        chit_data = {**chit.dict(), "id": chit_id, "tags": chit_tags, "modified_datetime": current_time, "sync_version": sync_version, "has_unviewed_conflict": False}
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

        # Fire habit triggers when chit-based habit status changes
        try:
            if chit.habit and existing and old_chit_dict:
                old_success = old_chit_dict.get("habit_success", 0) or 0
                new_success = chit.habit_success or 0
                goal = chit.habit_goal or 1
                # Habit achieved: success just reached goal
                if new_success >= goal and old_success < goal:
                    from src.backend.schedulers import _fire_chit_habit_trigger
                    _fire_chit_habit_trigger("habit_achieved", chit_data, user_id)
        except Exception:
            pass  # Never block the API response for habit triggers

        return chit_data
    except HTTPException:
        raise
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
        # Assign sync_version for mobile sync tracking
        sync_version = get_next_sync_version(cursor)
        # If this is an email chit, also move it to the trash folder
        if chit_dict.get("email_message_id") or chit_dict.get("email_status"):
            cursor.execute(
                "UPDATE chits SET deleted = 1, email_folder = 'trash', modified_datetime = ?, sync_version = ? WHERE id = ?",
                (current_time, sync_version, chit_id),
            )
        else:
            cursor.execute(
                "UPDATE chits SET deleted = 1, modified_datetime = ?, sync_version = ? WHERE id = ?",
                (current_time, sync_version, chit_id),
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


@router.patch("/api/chits/{chit_id}/fields")
def patch_chit_fields(chit_id: str, body: dict, request: Request):
    """Update only the specified fields on a chit.
    Body: { "pinned": true } or { "archived": true } etc.
    Only allows safe scalar fields to be patched.
    """
    ALLOWED_FIELDS = {
        "pinned", "archived", "status", "priority", "severity", "color",
        "title", "note", "location", "all_day", "perpetual", "stealth",
        "habit_success", "habit_goal", "habit_last_action_date",
        "habit_hide_overall", "show_on_calendar", "availability",
        "snoozed_until", "assigned_to", "recurrence_exceptions",
    }
    conn = None
    try:
        user_id = request.state.user_id
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT owner_id, shares FROM chits WHERE id = ? AND (deleted = 0 OR deleted IS NULL)", (chit_id,))
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

        fields_to_update = {k: v for k, v in body.items() if k in ALLOWED_FIELDS}
        if not fields_to_update:
            raise HTTPException(status_code=400, detail="No valid fields to update")

        # Capture old status for reverse cascade check
        old_status = None
        if "status" in fields_to_update:
            cursor.execute("SELECT status FROM chits WHERE id = ?", (chit_id,))
            status_row = cursor.fetchone()
            old_status = status_row["status"] if status_row else None

        set_clauses = []
        values = []
        for field, value in fields_to_update.items():
            set_clauses.append(f"{field} = ?")
            if isinstance(value, bool):
                values.append(1 if value else 0)
            elif isinstance(value, (list, dict)):
                values.append(serialize_json_field(value))
            else:
                values.append(value)

        # Assign sync_version for mobile sync tracking
        sync_version = get_next_sync_version(cursor)
        set_clauses.append("sync_version = ?")
        values.append(sync_version)

        set_clauses.append("modified_datetime = ?")
        values.append(datetime.utcnow().isoformat())
        values.append(chit_id)

        sql = f"UPDATE chits SET {', '.join(set_clauses)} WHERE id = ?"
        cursor.execute(sql, values)
        conn.commit()

        # Prerequisite cascade when status is patched to Complete
        if fields_to_update.get("status") == "Complete":
            try:
                conn.row_factory = None  # Reset row_factory for the cascade helper
                _cascade_prerequisite_unblock(cursor, conn, chit_id)
            except Exception as e:
                logger.error(f"Prerequisite cascade failed in patch (best-effort): {str(e)}")

        # Reverse cascade: when status moves away from Complete, revert auto-complete dependents
        if old_status == "Complete" and fields_to_update.get("status") != "Complete":
            try:
                conn.row_factory = None
                _cascade_auto_complete_revert(cursor, conn, chit_id)
            except Exception as e:
                logger.error(f"Auto-complete revert cascade failed in patch (best-effort): {str(e)}")

        return {"message": "Updated", "fields": list(fields_to_update.keys())}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error patching chit fields: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.close()


# ── Prerequisites: circular dependency check ──────────────────────────────────

@router.post("/api/chits/check-prerequisites")
def check_prerequisites_circular(body: dict, request: Request):
    """Check if adding a prerequisite would create a circular dependency.
    Body: { "chit_id": "...", "prerequisite_id": "..." }
    Returns: { "circular": true/false, "chain": [...] }
    """
    user_id = request.state.user_id
    chit_id = body.get("chit_id")
    prereq_id = body.get("prerequisite_id")
    if not chit_id or not prereq_id:
        raise HTTPException(status_code=400, detail="chit_id and prerequisite_id required")
    if chit_id == prereq_id:
        return {"circular": True, "chain": [chit_id]}

    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # BFS: starting from prereq_id, follow its prerequisites to see if we reach chit_id
        visited = set()
        queue = [prereq_id]
        chain = [prereq_id]
        while queue:
            current = queue.pop(0)
            if current in visited:
                continue
            visited.add(current)
            cursor.execute("SELECT prerequisites FROM chits WHERE id = ? AND (deleted = 0 OR deleted IS NULL)", (current,))
            row = cursor.fetchone()
            if not row or not row[0]:
                continue
            prereqs = deserialize_json_field(row[0])
            if not prereqs:
                continue
            for pid in prereqs:
                if pid == chit_id:
                    chain.append(pid)
                    return {"circular": True, "chain": chain}
                if pid not in visited:
                    queue.append(pid)
                    chain.append(pid)

        return {"circular": False, "chain": []}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error checking prerequisites circular: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.close()


# ── Prerequisites: status check (are all prereqs complete?) ───────────────────

@router.get("/api/chits/{chit_id}/prerequisites-status")
def get_prerequisites_status(chit_id: str, request: Request):
    """Return the status of all prerequisites for a chit.
    Returns: { "all_complete": true/false, "prerequisites": [{id, title, status, color}] }
    """
    user_id = request.state.user_id
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT prerequisites FROM chits WHERE id = ? AND (deleted = 0 OR deleted IS NULL)", (chit_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Chit not found")
        prereq_ids = deserialize_json_field(row[0]) or []
        if not prereq_ids:
            return {"all_complete": True, "prerequisites": []}

        placeholders = ",".join("?" * len(prereq_ids))
        cursor.execute(
            f"SELECT id, title, status, color FROM chits WHERE id IN ({placeholders}) AND (deleted = 0 OR deleted IS NULL)",
            prereq_ids
        )
        results = []
        all_complete = True
        for r in cursor.fetchall():
            status = r[2]
            if status != "Complete":
                all_complete = False
            results.append({"id": r[0], "title": r[1], "status": r[2], "color": r[3]})
        return {"all_complete": all_complete, "prerequisites": results}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching prerequisites status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
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

        # Auto-complete: if enabled, evaluate checklist + prerequisites and update status
        cursor.execute("SELECT auto_complete_checklist, status, prerequisites FROM chits WHERE id = ?", (chit_id,))
        ac_row = cursor.fetchone()
        if ac_row and ac_row["auto_complete_checklist"]:
            non_blank = [item for item in checklist_data if isinstance(item, dict) and (item.get("text") or "").strip()]
            prereq_ids = deserialize_json_field(ac_row["prerequisites"]) or []
            prereqs_ok = True
            if prereq_ids:
                placeholders = ",".join("?" * len(prereq_ids))
                cursor.execute(f"SELECT status FROM chits WHERE id IN ({placeholders})", prereq_ids)
                for (ps,) in cursor.fetchall():
                    if ps != "Complete":
                        prereqs_ok = False
                        break
            checklist_ok = all(item.get("checked") for item in non_blank) if non_blank else True
            has_something = bool(non_blank) or bool(prereq_ids)
            current_status = ac_row["status"] or ""
            if has_something and checklist_ok and prereqs_ok and current_status != "Complete":
                cursor.execute(
                    "UPDATE chits SET status = ?, modified_datetime = ? WHERE id = ?",
                    ("Complete", datetime.utcnow().isoformat(), chit_id)
                )
            elif has_something and (not checklist_ok or not prereqs_ok) and current_status == "Complete":
                cursor.execute(
                    "UPDATE chits SET status = ?, modified_datetime = ? WHERE id = ?",
                    ("ToDo", datetime.utcnow().isoformat(), chit_id)
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



# ── Snooze endpoint ───────────────────────────────────────────────────────

@router.post("/api/chits/{chit_id}/snooze")
def snooze_chit(chit_id: str, request: Request, body: dict = {}):
    """Snooze a chit until a specified datetime. Hides it from views until then.

    Body: { "until": "ISO 8601 datetime" } or { "minutes": 30 }
    To unsnooze: { "until": null }
    """
    conn = None
    try:
        user_id = request.state.user_id
        data = body

        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT owner_id FROM chits WHERE id = ? AND (deleted = 0 OR deleted IS NULL)", (chit_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Chit not found")
        if row[0] != user_id:
            raise HTTPException(status_code=403, detail="Only the owner can snooze a chit")

        # Determine snoozed_until value
        snoozed_until = None
        if "until" in data:
            snoozed_until = data["until"]  # ISO string or null
        elif "minutes" in data:
            from datetime import timedelta
            minutes = int(data["minutes"])
            snoozed_until = (datetime.utcnow() + timedelta(minutes=minutes)).isoformat()

        current_time = datetime.utcnow().isoformat()
        cursor.execute(
            "UPDATE chits SET snoozed_until = ?, modified_datetime = ? WHERE id = ?",
            (snoozed_until, current_time, chit_id),
        )
        conn.commit()

        return {"message": "Chit snoozed" if snoozed_until else "Chit unsnoozed", "snoozed_until": snoozed_until}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error snoozing chit {chit_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to snooze chit: {str(e)}")
    finally:
        if conn:
            conn.close()


# ── Conflict dismissal endpoint ───────────────────────────────────────────

@router.post("/api/chit/{chit_id}/dismiss-conflict")
def dismiss_conflict(chit_id: str, request: Request):
    """Dismiss the unviewed conflict flag on a chit.

    Sets has_unviewed_conflict = false and assigns a new sync_version
    so other devices see the flag change.

    Authorization: The requesting user must own the chit or have manager access.
    """
    conn = None
    try:
        user_id = request.state.user_id
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        cursor.execute(
            "SELECT owner_id, shares, assigned_to, stealth, tags FROM chits WHERE id = ? AND (deleted = 0 OR deleted IS NULL)",
            (chit_id,),
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Chit not found")

        # Build a dict for role resolution
        chit_dict = dict(row)
        owner_id = chit_dict.get("owner_id")

        # Load owner settings for tag-level sharing resolution
        owner_settings = None
        if owner_id and owner_id != user_id:
            cursor.execute("SELECT shared_tags FROM settings WHERE user_id = ?", (owner_id,))
            settings_row = cursor.fetchone()
            if settings_row and settings_row["shared_tags"]:
                owner_settings = {"shared_tags": settings_row["shared_tags"]}

        effective_role = resolve_effective_role(chit_dict, user_id, owner_settings)
        if effective_role is None:
            raise HTTPException(status_code=404, detail="Chit not found")
        if effective_role == "viewer":
            raise HTTPException(status_code=403, detail="You do not have permission to dismiss conflicts on this chit")

        # Clear the conflict flag and assign new sync_version
        sync_version = get_next_sync_version(cursor)
        cursor.execute(
            "UPDATE chits SET has_unviewed_conflict = 0, sync_version = ? WHERE id = ?",
            (sync_version, chit_id),
        )
        conn.commit()

        return {"message": "Conflict dismissed", "sync_version": sync_version}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error dismissing conflict on chit {chit_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to dismiss conflict: {str(e)}")
    finally:
        if conn:
            conn.close()
