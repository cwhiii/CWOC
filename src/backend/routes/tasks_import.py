"""Google Tasks import route for the CWOC backend.

Provides POST /api/import/google-tasks endpoint that parses Google Takeout
Tasks JSON files, maps tasks to chits with proper status/due dates/subtasks,
handles duplicate detection, and inserts chits in a single transaction.

Google Takeout exports Tasks as JSON with structure:
{
  "kind": "tasks#taskList",
  "id": "...",
  "title": "List Name",
  "items": [
    {
      "kind": "tasks#task",
      "id": "...",
      "title": "Task title",
      "notes": "Optional notes",
      "status": "needsAction" | "completed",
      "due": "2025-06-15T00:00:00.000Z",
      "completed": "2025-06-14T10:30:00.000Z",
      "created": "2025-06-01T08:00:00.000Z",
      "updated": "2025-06-14T10:30:00.000Z",
      "parent": "parent_task_id_for_subtasks",
      "task_type": "PERSONAL_TASK"
    }
  ]
}
"""

import json
import logging
import sqlite3
from datetime import datetime
from typing import Any, Dict, List, Optional, Set
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from src.backend.db import DB_PATH, serialize_json_field, compute_system_tags, ensure_tags_in_settings
from src.backend.models import Chit


logger = logging.getLogger(__name__)
router = APIRouter()


# ── Models ───────────────────────────────────────────────────────────────

class GoogleTasksImportRequest(BaseModel):
    json_content: str
    target_user_id: Optional[str] = None


class GoogleTasksImportResponse(BaseModel):
    imported: int
    skipped: int
    list_name: str = ""
    errors: List[str] = []


# ── Helpers ──────────────────────────────────────────────────────────────

def _is_admin(conn, user_id: str) -> bool:
    """Check if the given user has admin privileges."""
    row = conn.execute(
        "SELECT is_admin FROM users WHERE id = ?", (user_id,)
    ).fetchone()
    return bool(row and row[0])


def _parse_rfc3339(value: Optional[str]) -> Optional[str]:
    """Convert RFC 3339 timestamp to ISO format suitable for CWOC.

    Input:  '2025-06-15T00:00:00.000Z' or '2025-06-15T10:30:00Z'
    Output: '2025-06-15T00:00:00' (strip trailing Z and milliseconds)
    """
    if not value:
        return None
    # Strip trailing Z and any milliseconds
    s = value.strip()
    if s.endswith('Z'):
        s = s[:-1]
    # Remove milliseconds if present
    if '.' in s:
        s = s[:s.index('.')]
    return s


def _map_status(google_status: Optional[str]) -> Optional[str]:
    """Map Google Tasks status to CWOC status."""
    if not google_status:
        return "ToDo"
    mapping = {
        "needsAction": "ToDo",
        "completed": "Complete",
    }
    return mapping.get(google_status, "ToDo")


def map_task_to_chit(
    task: dict,
    list_name: str,
    user_id: str,
    display_name: str,
    username: str,
    batch_tag: str,
) -> dict:
    """Map a Google Tasks item to a CWOC chit dict ready for DB insert."""
    current_time = datetime.utcnow().isoformat()
    chit_id = str(uuid4())

    # Tags: system import tags + list name tag
    tags = [
        "cwoc_system/imported",
        batch_tag,
        f"calendar/imported/{list_name}",
    ]

    # Parse dates
    due_datetime = _parse_rfc3339(task.get("due"))
    completed_datetime = _parse_rfc3339(task.get("completed"))
    created = _parse_rfc3339(task.get("created")) or current_time
    updated = _parse_rfc3339(task.get("updated")) or current_time

    chit: Dict[str, Any] = {
        "id": chit_id,
        "title": task.get("title") or "",
        "note": task.get("notes"),
        "tags": tags,
        "start_datetime": None,
        "end_datetime": None,
        "due_datetime": due_datetime,
        "completed_datetime": completed_datetime,
        "status": _map_status(task.get("status")),
        "priority": None,
        "severity": None,
        "checklist": None,
        "alarm": None,
        "notification": None,
        "recurrence": None,
        "recurrence_id": None,
        "recurrence_rule": None,
        "recurrence_exceptions": None,
        "location": None,
        "color": None,
        "people": None,
        "pinned": None,
        "archived": None,
        "deleted": False,
        "created_datetime": created,
        "modified_datetime": updated,
        "is_project_master": False,
        "child_chits": None,
        "all_day": False,
        "alerts": None,
        "progress_percent": None,
        "time_estimate": None,
        "weather_data": None,
        "health_data": None,
        "habit": False,
        "habit_goal": 1,
        "habit_success": 0,
        "show_on_calendar": True,
        "habit_reset_period": None,
        "habit_last_action_date": None,
        "habit_hide_overall": False,
        "perpetual": False,
        "owner_id": user_id,
        "owner_display_name": display_name,
        "owner_username": username,
        "shares": None,
        "stealth": False,
        "assigned_to": None,
    }

    # Compute system tags
    try:
        temp_chit = Chit(**{k: v for k, v in chit.items() if k in Chit.__fields__})
        chit["tags"] = compute_system_tags(temp_chit)
        # Ensure import tags are preserved
        if "cwoc_system/imported" not in chit["tags"]:
            chit["tags"].append("cwoc_system/imported")
        if batch_tag not in chit["tags"]:
            chit["tags"].append(batch_tag)
        cal_tag = f"calendar/imported/{list_name}"
        if cal_tag not in chit["tags"]:
            chit["tags"].append(cal_tag)
    except Exception:
        pass

    return chit


def find_duplicates(cursor, user_id: str, chits: List[dict]) -> Set[int]:
    """Check which mapped chits already exist in the DB.

    Matching: title + due_datetime (truncated to minute).
    """
    if not chits:
        return set()

    cursor.execute(
        "SELECT title, due_datetime FROM chits WHERE owner_id = ? AND (deleted = 0 OR deleted IS NULL)",
        (user_id,),
    )
    existing = set()
    for row in cursor.fetchall():
        title = row[0] or ""
        due_dt = (row[1] or "")[:16]
        if due_dt:
            existing.add((title, due_dt))

    duplicates: Set[int] = set()
    for idx, chit in enumerate(chits):
        title = chit.get("title") or ""
        due_dt = (chit.get("due_datetime") or "")[:16]
        if due_dt and (title, due_dt) in existing:
            duplicates.add(idx)

    return duplicates


# ── POST Endpoint ────────────────────────────────────────────────────────

@router.post("/api/import/google-tasks", response_model=GoogleTasksImportResponse)
async def import_google_tasks(body: GoogleTasksImportRequest, request: Request):
    """Import Google Tasks (Takeout JSON) as CWOC chits.

    Admins can pass target_user_id to import on behalf of another user.
    """
    user_id = request.state.user_id

    # Parse JSON content
    try:
        data = json.loads(body.json_content)
    except (json.JSONDecodeError, ValueError) as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {str(e)}")

    # Validate structure — expect a task list object with "items"
    if not isinstance(data, dict):
        raise HTTPException(status_code=400, detail="Expected a JSON object (Google Tasks list)")

    # Handle both single list and array of lists
    task_lists = []
    if data.get("kind") == "tasks#taskList" or "items" in data:
        task_lists = [data]
    elif isinstance(data, list):
        task_lists = data
    else:
        raise HTTPException(
            status_code=400,
            detail="Unrecognized format. Expected a Google Tasks Takeout JSON file with 'items' array."
        )

    if not task_lists:
        raise HTTPException(status_code=400, detail="No task lists found in the file")

    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # Determine target user
        target_user_id = user_id
        if body.target_user_id and body.target_user_id != user_id:
            if not _is_admin(conn, user_id):
                raise HTTPException(status_code=403, detail="Only admins can import on behalf of another user")
            target_user_id = body.target_user_id

        # Look up target user info
        cursor.execute("SELECT display_name, username FROM users WHERE id = ?", (target_user_id,))
        user_row = cursor.fetchone()
        if not user_row:
            raise HTTPException(status_code=404, detail="Target user not found")
        display_name = user_row[0] or ""
        username = user_row[1] or ""

        total_imported = 0
        total_skipped = 0
        all_errors: List[str] = []
        last_list_name = ""

        for task_list in task_lists:
            list_name = task_list.get("title") or "My Tasks"
            last_list_name = list_name
            items = task_list.get("items") or []

            if not items:
                continue

            # Build batch tag
            today_str = datetime.utcnow().strftime("%Y-%m-%d")
            batch_tag = f"cwoc_system/imported/{list_name}/{today_str}"

            # Map tasks to chits (skip tasks without titles)
            mapped_chits: List[dict] = []
            for i, task in enumerate(items):
                title = task.get("title")
                if not title:
                    all_errors.append(f"Task {i + 1} in '{list_name}': Missing title, skipped")
                    continue
                try:
                    chit = map_task_to_chit(task, list_name, target_user_id, display_name, username, batch_tag)
                    mapped_chits.append(chit)
                except Exception as e:
                    all_errors.append(f"Task {i + 1} in '{list_name}': {str(e)}")

            # Detect duplicates
            duplicate_indices = find_duplicates(cursor, target_user_id, mapped_chits)

            # Insert non-duplicate chits
            skipped_count = len(duplicate_indices)
            imported_count = 0

            for idx, chit in enumerate(mapped_chits):
                if idx in duplicate_indices:
                    continue

                try:
                    cursor.execute(
                        """
                        INSERT INTO chits (
                            id, title, note, tags, start_datetime, end_datetime, due_datetime,
                            completed_datetime, status, priority, severity, checklist, alarm, notification,
                            recurrence, recurrence_id, location, color, people, pinned, archived,
                            deleted, created_datetime, modified_datetime, is_project_master, child_chits,
                            all_day, alerts, recurrence_rule, recurrence_exceptions, weather_data, health_data,
                            habit, habit_goal, habit_success, show_on_calendar,
                            habit_reset_period, habit_last_action_date, habit_hide_overall, perpetual,
                            owner_id, owner_display_name, owner_username,
                            shares, stealth, assigned_to
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            chit["id"],
                            chit["title"],
                            chit["note"],
                            serialize_json_field(chit["tags"]),
                            chit["start_datetime"],
                            chit["end_datetime"],
                            chit["due_datetime"],
                            chit["completed_datetime"],
                            chit["status"],
                            chit["priority"],
                            chit["severity"],
                            serialize_json_field(chit["checklist"]),
                            chit["alarm"],
                            chit["notification"],
                            chit["recurrence"],
                            chit["recurrence_id"],
                            chit["location"],
                            chit["color"],
                            serialize_json_field(chit["people"]),
                            chit["pinned"],
                            chit["archived"],
                            0,  # deleted = False
                            chit["created_datetime"],
                            chit["modified_datetime"],
                            1 if chit["is_project_master"] else 0,
                            serialize_json_field(chit["child_chits"]),
                            1 if chit["all_day"] else 0,
                            serialize_json_field(chit["alerts"]),
                            serialize_json_field(chit["recurrence_rule"]),
                            serialize_json_field(chit["recurrence_exceptions"]),
                            serialize_json_field(chit["weather_data"]),
                            serialize_json_field(chit["health_data"]),
                            1 if chit["habit"] else 0,
                            chit["habit_goal"] if chit["habit_goal"] is not None else 1,
                            chit["habit_success"] if chit["habit_success"] is not None else 0,
                            1 if chit["show_on_calendar"] else 0,
                            chit["habit_reset_period"],
                            chit["habit_last_action_date"],
                            1 if chit["habit_hide_overall"] else 0,
                            1 if chit["perpetual"] else 0,
                            chit["owner_id"],
                            chit["owner_display_name"],
                            chit["owner_username"],
                            serialize_json_field(chit["shares"]),
                            1 if chit["stealth"] else 0,
                            chit["assigned_to"],
                        ),
                    )
                    imported_count += 1
                except Exception as e:
                    all_errors.append(f"Insert error for '{chit.get('title', '?')}': {str(e)}")

            total_imported += imported_count
            total_skipped += skipped_count

            # Register tags in settings
            try:
                all_tags = []
                for idx, chit in enumerate(mapped_chits):
                    if idx in duplicate_indices:
                        continue
                    all_tags.extend(chit.get("tags") or [])
                ensure_tags_in_settings(conn, target_user_id, all_tags)
            except Exception as e:
                logger.warning(f"Google Tasks import: could not register tags: {str(e)}")

        conn.commit()

        return GoogleTasksImportResponse(
            imported=total_imported,
            skipped=total_skipped,
            list_name=last_list_name,
            errors=all_errors,
        )

    except HTTPException:
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Google Tasks import failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")
    finally:
        if conn:
            conn.close()
