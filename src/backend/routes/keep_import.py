"""Google Keep import route for the CWOC backend.

Provides POST /api/import/google-keep endpoint that parses Google Takeout
Keep JSON files, maps notes/lists to chits with proper content, labels as tags,
checklist items, and handles duplicate detection.

Google Takeout exports Keep as one JSON file per note with structure:
{
  "color": "DEFAULT" | "RED" | "ORANGE" | "YELLOW" | "GREEN" | "TEAL" |
           "BLUE" | "CERULEAN" | "PURPLE" | "PINK" | "BROWN" | "GRAY",
  "isTrashed": false,
  "isPinned": false,
  "isArchived": false,
  "textContent": "Note body text",       (for text notes)
  "listContent": [                        (for list/checklist notes)
    {"text": "Item text", "isChecked": false},
    ...
  ],
  "title": "Note title",
  "userEditedTimestampUsec": 1588817493657000,
  "createdTimestampUsec": 1588817421250000,
  "labels": [{"name": "Label Name"}],
  "annotations": [...],
  "attachments": [...]
}

The endpoint accepts an array of these note objects (the frontend reads
multiple JSON files and sends them as an array).
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

class GoogleKeepImportRequest(BaseModel):
    notes: List[dict]
    target_user_id: Optional[str] = None


class GoogleKeepImportResponse(BaseModel):
    imported: int
    skipped: int
    errors: List[str] = []


# ── Helpers ──────────────────────────────────────────────────────────────

def _is_admin(conn, user_id: str) -> bool:
    """Check if the given user has admin privileges."""
    row = conn.execute(
        "SELECT is_admin FROM users WHERE id = ?", (user_id,)
    ).fetchone()
    return bool(row and row[0])


def _usec_to_iso(usec: Optional[int]) -> Optional[str]:
    """Convert microsecond timestamp to ISO datetime string."""
    if not usec:
        return None
    try:
        seconds = usec / 1_000_000
        dt = datetime.utcfromtimestamp(seconds)
        return dt.isoformat()
    except (ValueError, OSError, OverflowError):
        return None


# Google Keep color names → CWOC hex colors
_KEEP_COLORS = {
    "DEFAULT": None,
    "RED": "#f28b82",
    "ORANGE": "#fbbc04",
    "YELLOW": "#fff475",
    "GREEN": "#ccff90",
    "TEAL": "#a7ffeb",
    "BLUE": "#cbf0f8",
    "CERULEAN": "#aecbfa",
    "PURPLE": "#d7aefb",
    "PINK": "#fdcfe8",
    "BROWN": "#e6c9a8",
    "GRAY": "#e8eaed",
}


def _map_color(keep_color: Optional[str]) -> Optional[str]:
    """Map Google Keep color name to a hex color."""
    if not keep_color:
        return None
    return _KEEP_COLORS.get(keep_color.upper())


def _build_checklist(list_content: List[dict]) -> Optional[List[dict]]:
    """Convert Google Keep listContent to CWOC checklist format.

    Keep format: [{"text": "Item", "isChecked": true/false}, ...]
    CWOC format: [{"text": "Item", "checked": true/false, "id": "uuid"}, ...]
    """
    if not list_content:
        return None
    items = []
    for item in list_content:
        text = item.get("text", "").strip()
        if not text:
            continue
        items.append({
            "id": str(uuid4()),
            "text": text,
            "checked": bool(item.get("isChecked", False)),
        })
    return items if items else None


def map_note_to_chit(
    note: dict,
    user_id: str,
    display_name: str,
    username: str,
    batch_tag: str,
) -> dict:
    """Map a Google Keep note to a CWOC chit dict ready for DB insert."""
    current_time = datetime.utcnow().isoformat()
    chit_id = str(uuid4())

    # Tags: system import tags + Keep labels
    tags = [
        "cwoc_system/imported",
        batch_tag,
        "calendar/imported/Google Keep",
    ]
    labels = note.get("labels") or []
    for label in labels:
        name = label.get("name")
        if name:
            tags.append(name)

    # Determine content type
    list_content = note.get("listContent")
    text_content = note.get("textContent")

    checklist = None
    note_text = None

    if list_content:
        checklist = _build_checklist(list_content)
    if text_content:
        note_text = text_content

    # Timestamps
    created = _usec_to_iso(note.get("createdTimestampUsec")) or current_time
    modified = _usec_to_iso(note.get("userEditedTimestampUsec")) or current_time

    # Color
    color = _map_color(note.get("color"))

    # Pinned
    pinned = bool(note.get("isPinned", False))

    chit: Dict[str, Any] = {
        "id": chit_id,
        "title": note.get("title") or "",
        "note": note_text,
        "tags": tags,
        "start_datetime": None,
        "end_datetime": None,
        "due_datetime": None,
        "completed_datetime": None,
        "status": None,
        "priority": None,
        "severity": None,
        "checklist": checklist,
        "alarm": None,
        "notification": None,
        "recurrence": None,
        "recurrence_id": None,
        "recurrence_rule": None,
        "recurrence_exceptions": None,
        "location": None,
        "color": color,
        "people": None,
        "pinned": pinned,
        "archived": bool(note.get("isArchived", False)),
        "deleted": False,
        "created_datetime": created,
        "modified_datetime": modified,
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
        "show_on_calendar": False,
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
        if "calendar/imported/Google Keep" not in chit["tags"]:
            chit["tags"].append("calendar/imported/Google Keep")
        # Re-add user labels
        for label in labels:
            name = label.get("name")
            if name and name not in chit["tags"]:
                chit["tags"].append(name)
    except Exception:
        pass

    return chit


def find_duplicates(cursor, user_id: str, chits: List[dict]) -> Set[int]:
    """Check which mapped chits already exist in the DB.

    Matching: title + created_datetime (truncated to minute).
    """
    if not chits:
        return set()

    cursor.execute(
        "SELECT title, created_datetime FROM chits WHERE owner_id = ? AND (deleted = 0 OR deleted IS NULL)",
        (user_id,),
    )
    existing = set()
    for row in cursor.fetchall():
        title = row[0] or ""
        created = (row[1] or "")[:16]
        if title and created:
            existing.add((title, created))

    duplicates: Set[int] = set()
    for idx, chit in enumerate(chits):
        title = chit.get("title") or ""
        created = (chit.get("created_datetime") or "")[:16]
        if title and created and (title, created) in existing:
            duplicates.add(idx)

    return duplicates


# ── POST Endpoint ────────────────────────────────────────────────────────

@router.post("/api/import/google-keep", response_model=GoogleKeepImportResponse)
async def import_google_keep(body: GoogleKeepImportRequest, request: Request):
    """Import Google Keep notes (Takeout JSON) as CWOC chits.

    Expects an array of note objects (frontend reads multiple JSON files
    and sends them as a single array).

    Admins can pass target_user_id to import on behalf of another user.
    """
    user_id = request.state.user_id

    notes = body.notes
    if not notes:
        raise HTTPException(status_code=400, detail="No notes provided")

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

        # Build batch tag
        today_str = datetime.utcnow().strftime("%Y-%m-%d")
        batch_tag = f"cwoc_system/imported/Google Keep/{today_str}"

        # Map notes to chits (skip trashed notes and notes without title+content)
        mapped_chits: List[dict] = []
        all_errors: List[str] = []

        for i, note in enumerate(notes):
            # Skip trashed notes
            if note.get("isTrashed", False):
                continue

            title = note.get("title", "")
            text_content = note.get("textContent", "")
            list_content = note.get("listContent")

            # Skip notes with no title and no content
            if not title and not text_content and not list_content:
                all_errors.append(f"Note {i + 1}: No title or content, skipped")
                continue

            try:
                chit = map_note_to_chit(note, target_user_id, display_name, username, batch_tag)
                mapped_chits.append(chit)
            except Exception as e:
                all_errors.append(f"Note {i + 1}: {str(e)}")

        # Detect duplicates
        duplicate_indices = find_duplicates(cursor, target_user_id, mapped_chits)

        # Insert non-duplicate chits
        imported_count = 0
        skipped_count = len(duplicate_indices)

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
                        1 if chit["archived"] else 0,
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

        conn.commit()

        # Register tags in settings
        try:
            all_tags = []
            for idx, chit in enumerate(mapped_chits):
                if idx in duplicate_indices:
                    continue
                all_tags.extend(chit.get("tags") or [])
            ensure_tags_in_settings(conn, target_user_id, all_tags)
        except Exception as e:
            logger.warning(f"Google Keep import: could not register tags: {str(e)}")

        return GoogleKeepImportResponse(
            imported=imported_count,
            skipped=skipped_count,
            errors=all_errors,
        )

    except HTTPException:
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Google Keep import failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")
    finally:
        if conn:
            conn.close()
