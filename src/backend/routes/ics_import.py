"""ICS calendar import route for the CWOC backend.

Provides POST /api/import/ics endpoint that parses .ics file content,
maps VEVENT/VTODO components to chits, handles recurrence translation
and duplicate detection, and inserts chits in a single transaction.
"""

import logging
import sqlite3
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Set
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request

from src.backend.db import DB_PATH, serialize_json_field, compute_system_tags
from src.backend.models import ICSImportRequest, ICSImportResponse, Chit
from src.backend.ics_serializer import ics_parse


logger = logging.getLogger(__name__)
router = APIRouter()


# ── Field Mapper ─────────────────────────────────────────────────────────

def _map_priority(priority_val: Optional[int]) -> Optional[str]:
    """Map RFC 5545 priority (1-9) to CWOC priority string."""
    if priority_val is None or priority_val == 0:
        return None
    if 1 <= priority_val <= 4:
        return "High"
    if priority_val == 5:
        return "Medium"
    if 6 <= priority_val <= 9:
        return "Low"
    return None


def _map_vtodo_status(ics_status: Optional[str]) -> Optional[str]:
    """Map iCalendar VTODO STATUS to CWOC chit status."""
    if not ics_status:
        return None
    mapping = {
        "COMPLETED": "Complete",
        "IN-PROCESS": "In Progress",
        "NEEDS-ACTION": "ToDo",
    }
    return mapping.get(ics_status.upper())


def map_component_to_chit(
    component: dict,
    user_id: str,
    display_name: str,
    username: str,
) -> dict:
    """Map a parsed ICS component to a CWOC chit dict ready for DB insert."""
    current_time = datetime.utcnow().isoformat()
    chit_id = str(uuid4())

    # Base tags: CATEGORIES + system import tag
    tags = list(component.get("categories") or [])
    tags.append("cwoc_system/imported")

    chit: Dict[str, Any] = {
        "id": chit_id,
        "title": component.get("summary"),
        "note": component.get("description"),
        "tags": tags,
        "start_datetime": None,
        "end_datetime": None,
        "due_datetime": None,
        "completed_datetime": None,
        "status": None,
        "priority": _map_priority(component.get("priority")),
        "severity": None,
        "checklist": None,
        "alarm": None,
        "notification": None,
        "recurrence": None,
        "recurrence_id": None,
        "recurrence_rule": None,
        "recurrence_exceptions": None,
        "location": component.get("location"),
        "color": None,
        "people": None,
        "pinned": None,
        "archived": None,
        "deleted": False,
        "created_datetime": current_time,
        "modified_datetime": current_time,
        "is_project_master": False,
        "child_chits": None,
        "all_day": component.get("all_day", False),
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

    comp_type = component.get("type", "VEVENT")

    if comp_type == "VEVENT":
        chit["start_datetime"] = component.get("dtstart")
        chit["end_datetime"] = component.get("dtend")
        # Handle missing DTEND
        if chit["start_datetime"] and not chit["end_datetime"]:
            chit["end_datetime"] = chit["start_datetime"]
    elif comp_type == "VTODO":
        chit["due_datetime"] = component.get("due")
        chit["status"] = _map_vtodo_status(component.get("status"))

    # Recurrence
    rrule = component.get("rrule")
    if rrule:
        recurrence = map_rrule_to_recurrence(rrule, chit.get("start_datetime"))
        chit["recurrence_rule"] = recurrence

    # Compute system tags using a temporary Chit model
    try:
        temp_chit = Chit(**{k: v for k, v in chit.items() if k in Chit.__fields__})
        chit["tags"] = compute_system_tags(temp_chit)
        # Ensure cwoc_system/imported is still present
        if "cwoc_system/imported" not in chit["tags"]:
            chit["tags"].append("cwoc_system/imported")
    except Exception:
        pass  # Keep manually built tags if Chit construction fails

    return chit


# ── Recurrence Translator ───────────────────────────────────────────────

# Approximate days per frequency for COUNT→until conversion
_FREQ_DAYS = {
    "DAILY": 1,
    "WEEKLY": 7,
    "MONTHLY": 30,
    "YEARLY": 365,
}

_SUPPORTED_FREQS = {"DAILY", "WEEKLY", "MONTHLY", "YEARLY"}


def map_rrule_to_recurrence(rrule: dict, start_datetime: Optional[str] = None) -> Optional[dict]:
    """Translate an ICS RRULE dict to CWOC recurrence_rule format.

    Returns None for unsupported frequencies (SECONDLY, MINUTELY, HOURLY).
    """
    freq = (rrule.get("freq") or "").upper()
    if freq not in _SUPPORTED_FREQS:
        return None

    result: Dict[str, Any] = {
        "freq": freq,
        "interval": rrule.get("interval", 1),
    }

    # byDay
    if rrule.get("byday"):
        result["byDay"] = rrule["byday"]

    # until
    if rrule.get("until"):
        raw_until = rrule["until"]
        # Convert iCal UNTIL to ISO date: 20251231T235959Z → 2025-12-31
        if len(raw_until) >= 8:
            result["until"] = f"{raw_until[:4]}-{raw_until[4:6]}-{raw_until[6:8]}"
        else:
            result["until"] = raw_until
    elif rrule.get("count") and start_datetime:
        # Approximate COUNT to an until date
        count = rrule["count"]
        interval = rrule.get("interval", 1)
        freq_days = _FREQ_DAYS.get(freq, 1)
        total_days = count * interval * freq_days

        # Parse start date
        try:
            date_str = start_datetime[:10]  # YYYY-MM-DD
            start_date = datetime.strptime(date_str, "%Y-%m-%d")
            until_date = start_date + timedelta(days=total_days)
            result["until"] = until_date.strftime("%Y-%m-%d")
        except (ValueError, TypeError):
            pass

    return result


# ── Duplicate Detector ───────────────────────────────────────────────────

def find_duplicates(cursor, user_id: str, chits: List[dict]) -> Set[int]:
    """Check which mapped chits already exist in the DB.

    Returns a set of indices into the chits list that are duplicates.
    Matching is case-sensitive title + exact start_datetime (or due_datetime
    for tasks), truncated to the minute.
    """
    if not chits:
        return set()

    # Fetch existing non-deleted chits for this user
    cursor.execute(
        "SELECT title, start_datetime, due_datetime FROM chits WHERE owner_id = ? AND (deleted = 0 OR deleted IS NULL)",
        (user_id,),
    )
    existing = set()
    for row in cursor.fetchall():
        title = row[0] or ""
        start_dt = (row[1] or "")[:16]  # truncate to minute
        due_dt = (row[2] or "")[:16]
        if start_dt:
            existing.add((title, start_dt))
        if due_dt:
            existing.add((title, due_dt))

    duplicates: Set[int] = set()
    for idx, chit in enumerate(chits):
        title = chit.get("title") or ""
        start_dt = (chit.get("start_datetime") or "")[:16]
        due_dt = (chit.get("due_datetime") or "")[:16]

        if start_dt and (title, start_dt) in existing:
            duplicates.add(idx)
        elif due_dt and (title, due_dt) in existing:
            duplicates.add(idx)

    return duplicates



# ── POST Endpoint ────────────────────────────────────────────────────────

@router.post("/api/import/ics", response_model=ICSImportResponse)
async def import_ics(body: ICSImportRequest, request: Request):
    """Import iCalendar (.ics) file content as CWOC chits."""
    user_id = request.state.user_id

    # Parse ICS content
    parsed = ics_parse(body.ics_content)

    if "error" in parsed:
        raise HTTPException(status_code=400, detail=parsed["error"])

    components = parsed.get("components", [])
    parse_errors = list(parsed.get("errors", []))

    if not components and not parse_errors:
        raise HTTPException(status_code=400, detail="No valid components found in the ICS file")

    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # Look up user info
        cursor.execute("SELECT display_name, username FROM users WHERE id = ?", (user_id,))
        user_row = cursor.fetchone()
        display_name = user_row[0] if user_row else ""
        username = user_row[1] if user_row else getattr(request.state, "username", "")

        # Map all components to chits
        mapped_chits: List[dict] = []
        mapping_errors: List[str] = []

        for i, comp in enumerate(components):
            try:
                chit = map_component_to_chit(comp, user_id, display_name, username)
                mapped_chits.append(chit)
            except Exception as e:
                mapping_errors.append(f"Component {i + 1}: {str(e)}")

        # Detect duplicates
        duplicate_indices = find_duplicates(cursor, user_id, mapped_chits)

        # Insert non-duplicate chits in a single transaction
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
                mapping_errors.append(f"Insert error for '{chit.get('title', '?')}': {str(e)}")

        conn.commit()

        all_errors = parse_errors + mapping_errors
        return ICSImportResponse(
            imported=imported_count,
            skipped=skipped_count,
            errors=all_errors,
        )

    except HTTPException:
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"ICS import failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")
    finally:
        if conn:
            conn.close()
