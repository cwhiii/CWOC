"""Chit CRUD API routes for the CWOC backend.

Provides endpoints for creating, reading, updating, deleting chits,
managing recurrence exceptions, and import/export of chit data and userdata.
"""

import json
import logging
import sqlite3
from datetime import datetime
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query, Request, Response

from src.backend.db import (
    DB_PATH, serialize_json_field, deserialize_json_field,
    compute_system_tags, _build_export_envelope,
)
from src.backend.models import Chit, ImportRequest
from src.backend.routes.audit import insert_audit_entry, compute_audit_diff, get_actor_from_request
from src.backend.sharing import resolve_effective_role, can_edit_chit, can_delete_chit, can_manage_sharing


logger = logging.getLogger(__name__)
router = APIRouter()


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
            chit["alerts"] = deserialize_json_field(chit.get("alerts"))
            chit["recurrence_rule"] = deserialize_json_field(chit.get("recurrence_rule"))
            chit["recurrence_exceptions"] = deserialize_json_field(chit.get("recurrence_exceptions"))
            chit["weather_data"] = deserialize_json_field(chit.get("weather_data"))
            chit["health_data"] = deserialize_json_field(chit.get("health_data"))
            chit["hide_when_instance_done"] = bool(chit.get("hide_when_instance_done"))
            chit["shares"] = deserialize_json_field(chit.get("shares"))
            chit["stealth"] = bool(chit.get("stealth"))
            chit["assigned_to"] = chit.get("assigned_to")
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


@router.get("/api/chits/search")
def search_chits(request: Request, q: Optional[str] = Query(None)):
    """Global search across all chit fields. Returns matching chits with matched field names."""
    if not q or not q.strip():
        return []

    query_lower = q.strip().lower()
    conn = None
    try:
        user_id = request.state.user_id
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM chits WHERE (deleted = 0 OR deleted IS NULL) AND owner_id = ?", (user_id,))
        results = []

        for row in cursor.fetchall():
            chit = dict(zip([col[0] for col in cursor.description], row))
            # Deserialize JSON fields
            chit["tags"] = deserialize_json_field(chit["tags"])
            chit["checklist"] = deserialize_json_field(chit["checklist"])
            chit["people"] = deserialize_json_field(chit["people"])
            chit["child_chits"] = deserialize_json_field(chit.get("child_chits"))
            chit["is_project_master"] = bool(chit.get("is_project_master"))
            chit["all_day"] = bool(chit.get("all_day"))
            chit["alerts"] = deserialize_json_field(chit.get("alerts"))
            chit["recurrence_rule"] = deserialize_json_field(chit.get("recurrence_rule"))
            chit["recurrence_exceptions"] = deserialize_json_field(chit.get("recurrence_exceptions"))
            chit["weather_data"] = deserialize_json_field(chit.get("weather_data"))
            chit["health_data"] = deserialize_json_field(chit.get("health_data"))
            chit["hide_when_instance_done"] = bool(chit.get("hide_when_instance_done"))
            chit["shares"] = deserialize_json_field(chit.get("shares"))
            chit["stealth"] = bool(chit.get("stealth"))
            chit["assigned_to"] = chit.get("assigned_to")

            matched_fields = []

            # Simple string fields
            for field_name in [
                "title", "note", "status", "priority", "severity",
                "location", "color",
                "start_datetime", "end_datetime", "due_datetime",
                "created_datetime", "modified_datetime",
            ]:
                value = chit.get(field_name)
                if value and query_lower in str(value).lower():
                    matched_fields.append(field_name)

            # Tags — check each tag name individually
            tags = chit.get("tags")
            if tags and isinstance(tags, list):
                for tag in tags:
                    if isinstance(tag, str) and query_lower in tag.lower():
                        matched_fields.append("tags")
                        break

            # People — check each person individually
            people = chit.get("people")
            if people and isinstance(people, list):
                for person in people:
                    if isinstance(person, str) and query_lower in person.lower():
                        matched_fields.append("people")
                        break

            # Checklist — check each item's text field
            checklist = chit.get("checklist")
            if checklist and isinstance(checklist, list):
                for item in checklist:
                    if isinstance(item, dict):
                        item_text = item.get("text", "")
                        if item_text and query_lower in str(item_text).lower():
                            matched_fields.append("checklist")
                            break

            # Alerts — check each alert's description/label fields
            alerts = chit.get("alerts")
            if alerts and isinstance(alerts, list):
                for alert in alerts:
                    if isinstance(alert, dict):
                        for alert_key in ["description", "label", "name", "type"]:
                            alert_val = alert.get(alert_key, "")
                            if alert_val and query_lower in str(alert_val).lower():
                                matched_fields.append("alerts")
                                break
                        if "alerts" in matched_fields:
                            break

            if matched_fields:
                results.append({"chit": chit, "matched_fields": matched_fields})

        # Enrich with assigned_to_display_name
        _enrich_assigned_to_display_names(cursor, [r["chit"] for r in results])

        return results
    except Exception as e:
        logger.error(f"Error searching chits: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to search chits: {str(e)}")
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
        chit_tags = compute_system_tags(chit)
        cursor.execute(
            """
            INSERT INTO chits (
                id, title, note, tags, start_datetime, end_datetime, due_datetime,
                completed_datetime, status, priority, severity, checklist, alarm, notification,
                recurrence, recurrence_id, location, color, people, pinned, archived,
                deleted, created_datetime, modified_datetime, is_project_master, child_chits, all_day, alerts,
                recurrence_rule, recurrence_exceptions, weather_data, health_data, hide_when_instance_done,
                owner_id, owner_display_name, owner_username,
                shares, stealth, assigned_to
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                1 if chit.hide_when_instance_done else 0,
                user_id,
                owner_display_name,
                owner_username,
                serialize_json_field(chit.shares),
                1 if chit.stealth else 0,
                chit.assigned_to,
            )
        )
        conn.commit()
        return {
            **chit.dict(), "id": chit_id, "tags": chit_tags,
            "created_datetime": current_time, "modified_datetime": current_time,
            "owner_id": user_id, "owner_display_name": owner_display_name, "owner_username": owner_username,
        }
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
        chit["alerts"] = deserialize_json_field(chit.get("alerts"))
        chit["recurrence_rule"] = deserialize_json_field(chit.get("recurrence_rule"))
        chit["recurrence_exceptions"] = deserialize_json_field(chit.get("recurrence_exceptions"))
        chit["weather_data"] = deserialize_json_field(chit.get("weather_data"))
        chit["health_data"] = deserialize_json_field(chit.get("health_data"))
        chit["hide_when_instance_done"] = bool(chit.get("hide_when_instance_done"))
        chit["shares"] = deserialize_json_field(chit.get("shares"))
        chit["stealth"] = bool(chit.get("stealth"))
        chit["assigned_to"] = chit.get("assigned_to")
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

            # Non-managers/non-owners cannot change shares, stealth, or assigned_to — preserve existing values
            if not can_manage_sharing(existing_dict_check, user_id, owner_settings):
                chit.shares = deserialize_json_field(existing_dict_check.get("shares"))
                chit.stealth = bool(existing_dict_check.get("stealth"))
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
                    hide_when_instance_done = ?,
                    shares = ?, stealth = ?, assigned_to = ?
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
                    1 if chit.hide_when_instance_done else 0,
                    serialize_json_field(chit.shares),
                    1 if chit.stealth else 0,
                    chit.assigned_to,
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
                    "hide_when_instance_done": 1 if chit.hide_when_instance_done else 0,
                    "shares": serialize_json_field(chit.shares),
                    "stealth": 1 if chit.stealth else 0,
                    "assigned_to": chit.assigned_to,
                }
                diff = compute_audit_diff(old_chit_dict, new_chit_dict, exclude_fields={"modified_datetime", "created_datetime"})
                if diff:
                    actor = get_actor_from_request(request)
                    insert_audit_entry(conn, "chit", chit_id, "updated", actor, changes=diff, entity_summary=chit.title)
            except Exception as e:
                logger.error(f"Audit logging failed for chit update (best-effort): {str(e)}")
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
                    recurrence_rule, recurrence_exceptions, weather_data, health_data, hide_when_instance_done,
                    owner_id, owner_display_name, owner_username,
                    shares, stealth, assigned_to
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                    1 if chit.hide_when_instance_done else 0,
                    user_id,
                    owner_display_name,
                    owner_username,
                    serialize_json_field(chit.shares),
                    1 if chit.stealth else 0,
                    chit.assigned_to,
                )
            )
            # Audit logging for chit creation
            try:
                actor = get_actor_from_request(request)
                insert_audit_entry(conn, "chit", chit_id, "created", actor, entity_summary=chit.title)
            except Exception as e:
                logger.error(f"Audit logging failed for chit creation (best-effort): {str(e)}")
        conn.commit()
        return {**chit.dict(), "id": chit_id, "tags": chit_tags, "modified_datetime": current_time}
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
        # Only owner can delete — non-owners get 404 to avoid revealing chit existence
        if not can_delete_chit(chit_dict, user_id):
            raise HTTPException(status_code=404, detail="Chit not found")
        chit_title = chit_dict.get("title")

        cursor.execute("UPDATE chits SET deleted = 1, modified_datetime = ? WHERE id = ?",
                       (datetime.utcnow().isoformat(), chit_id))
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

        # Parse shares and find the requesting user's entry
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
            chit["hide_when_instance_done"] = bool(chit.get("hide_when_instance_done"))
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
                    weather_data, health_data, hide_when_instance_done,
                    owner_id, owner_display_name, owner_username,
                    shares, stealth, assigned_to
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
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
                    1 if chit.get("hide_when_instance_done") else 0,
                    user_id,
                    owner_display_name,
                    owner_username,
                    serialize_json_field(chit.get("shares")),
                    1 if chit.get("stealth") else 0,
                    chit.get("assigned_to"),
                ),
            )
            imported += 1

        conn.commit()
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
            for f in ("alarm", "notification", "pinned", "archived", "deleted", "is_project_master", "all_day", "hide_when_instance_done", "stealth"):
                chit[f] = bool(chit.get(f))
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
                    weather_data, health_data, hide_when_instance_done,
                    owner_id, owner_display_name, owner_username,
                    shares, stealth, assigned_to
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
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
                    1 if chit.get("hide_when_instance_done") else 0,
                    user_id,
                    owner_display_name,
                    owner_username,
                    serialize_json_field(chit.get("shares")),
                    1 if chit.get("stealth") else 0,
                    chit.get("assigned_to"),
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
                    default_notifications, unit_system
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
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
