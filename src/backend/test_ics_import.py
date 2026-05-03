"""Unit tests for ICS import field mapping, recurrence translation, and duplicate detection."""
import sys
import os
import sqlite3
import traceback

# Allow importing modules from the backend directory
sys.path.insert(0, os.path.dirname(__file__))

# ── Patch /app paths before importing backend modules ────────────────────
_original_makedirs = os.makedirs

def _safe_makedirs(name, *args, **kwargs):
    if isinstance(name, str) and name.startswith("/app"):
        return
    return _original_makedirs(name, *args, **kwargs)

os.makedirs = _safe_makedirs

from ics_serializer import ics_parse

os.makedirs = _original_makedirs


# ── Inline copies of the pure mapping functions (no FastAPI dependency) ──
# These mirror the logic in routes/ics_import.py so we can test without
# importing FastAPI, which isn't installed on the dev machine.

from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Set
from uuid import uuid4

_FREQ_DAYS = {"DAILY": 1, "WEEKLY": 7, "MONTHLY": 30, "YEARLY": 365}
_SUPPORTED_FREQS = {"DAILY", "WEEKLY", "MONTHLY", "YEARLY"}


def _map_priority(priority_val):
    if priority_val is None or priority_val == 0:
        return None
    if 1 <= priority_val <= 4:
        return "High"
    if priority_val == 5:
        return "Medium"
    if 6 <= priority_val <= 9:
        return "Low"
    return None


def _map_vtodo_status(ics_status):
    if not ics_status:
        return None
    mapping = {"COMPLETED": "Complete", "IN-PROCESS": "In Progress", "NEEDS-ACTION": "ToDo"}
    return mapping.get(ics_status.upper())


def map_rrule_to_recurrence(rrule, start_datetime=None):
    freq = (rrule.get("freq") or "").upper()
    if freq not in _SUPPORTED_FREQS:
        return None
    result = {"freq": freq, "interval": rrule.get("interval", 1)}
    if rrule.get("byday"):
        result["byDay"] = rrule["byday"]
    if rrule.get("until"):
        raw_until = rrule["until"]
        if len(raw_until) >= 8:
            result["until"] = f"{raw_until[:4]}-{raw_until[4:6]}-{raw_until[6:8]}"
        else:
            result["until"] = raw_until
    elif rrule.get("count") and start_datetime:
        count = rrule["count"]
        interval = rrule.get("interval", 1)
        freq_days = _FREQ_DAYS.get(freq, 1)
        total_days = count * interval * freq_days
        try:
            date_str = start_datetime[:10]
            start_date = datetime.strptime(date_str, "%Y-%m-%d")
            until_date = start_date + timedelta(days=total_days)
            result["until"] = until_date.strftime("%Y-%m-%d")
        except (ValueError, TypeError):
            pass
    return result


def map_component_to_chit(component, user_id, display_name, username):
    current_time = datetime.utcnow().isoformat()
    chit_id = str(uuid4())
    tags = list(component.get("categories") or [])
    tags.append("cwoc_system/imported")
    chit = {
        "id": chit_id, "title": component.get("summary"), "note": component.get("description"),
        "tags": tags, "start_datetime": None, "end_datetime": None, "due_datetime": None,
        "completed_datetime": None, "status": None, "priority": _map_priority(component.get("priority")),
        "location": component.get("location"), "deleted": False,
        "created_datetime": current_time, "modified_datetime": current_time,
        "all_day": component.get("all_day", False),
        "owner_id": user_id, "owner_display_name": display_name, "owner_username": username,
        "recurrence_rule": None,
    }
    comp_type = component.get("type", "VEVENT")
    if comp_type == "VEVENT":
        chit["start_datetime"] = component.get("dtstart")
        chit["end_datetime"] = component.get("dtend")
        if chit["start_datetime"] and not chit["end_datetime"]:
            chit["end_datetime"] = chit["start_datetime"]
    elif comp_type == "VTODO":
        chit["due_datetime"] = component.get("due")
        chit["status"] = _map_vtodo_status(component.get("status"))
    rrule = component.get("rrule")
    if rrule:
        chit["recurrence_rule"] = map_rrule_to_recurrence(rrule, chit.get("start_datetime"))
    return chit


def find_duplicates(cursor, user_id, chits):
    if not chits:
        return set()
    cursor.execute(
        "SELECT title, start_datetime, due_datetime FROM chits WHERE owner_id = ? AND (deleted = 0 OR deleted IS NULL)",
        (user_id,),
    )
    existing = set()
    for row in cursor.fetchall():
        title = row[0] or ""
        start_dt = (row[1] or "")[:16]
        due_dt = (row[2] or "")[:16]
        if start_dt:
            existing.add((title, start_dt))
        if due_dt:
            existing.add((title, due_dt))
    duplicates = set()
    for idx, chit in enumerate(chits):
        title = chit.get("title") or ""
        start_dt = (chit.get("start_datetime") or "")[:16]
        due_dt = (chit.get("due_datetime") or "")[:16]
        if start_dt and (title, start_dt) in existing:
            duplicates.add(idx)
        elif due_dt and (title, due_dt) in existing:
            duplicates.add(idx)
    return duplicates


# ── Test Helpers ─────────────────────────────────────────────────────────

_USER_ID = "test-user-123"
_DISPLAY_NAME = "Test User"
_USERNAME = "testuser"


def _make_vevent(**overrides):
    """Build a minimal parsed VEVENT component dict."""
    comp = {
        "type": "VEVENT",
        "summary": "Test Event",
        "dtstart": "2025-06-15T10:00:00",
        "dtstart_tzid": None,
        "dtend": "2025-06-15T11:00:00",
        "dtend_tzid": None,
        "due": None,
        "due_tzid": None,
        "description": None,
        "location": None,
        "categories": [],
        "priority": None,
        "uid": "test@uid",
        "rrule": None,
        "status": None,
        "all_day": False,
    }
    comp.update(overrides)
    return comp


def _make_vtodo(**overrides):
    """Build a minimal parsed VTODO component dict."""
    comp = {
        "type": "VTODO",
        "summary": "Test Task",
        "dtstart": None,
        "dtstart_tzid": None,
        "dtend": None,
        "dtend_tzid": None,
        "due": "2025-06-20T17:00:00",
        "due_tzid": None,
        "description": None,
        "location": None,
        "categories": [],
        "priority": None,
        "uid": "todo@uid",
        "rrule": None,
        "status": "NEEDS-ACTION",
        "all_day": False,
    }
    comp.update(overrides)
    return comp


def _map(comp):
    """Shorthand for map_component_to_chit with test user."""
    return map_component_to_chit(comp, _USER_ID, _DISPLAY_NAME, _USERNAME)


# ── VEVENT Field Mapping Tests ──────────────────────────────────────────

def test_vevent_basic_mapping():
    """VEVENT fields map to correct chit fields."""
    comp = _make_vevent(
        summary="Meeting",
        description="Weekly sync",
        location="Room A",
        categories=["Work", "Meetings"],
    )
    chit = _map(comp)
    assert chit["title"] == "Meeting"
    assert chit["note"] == "Weekly sync"
    assert chit["location"] == "Room A"
    assert chit["start_datetime"] == "2025-06-15T10:00:00"
    assert chit["end_datetime"] == "2025-06-15T11:00:00"
    assert chit["owner_id"] == _USER_ID
    assert chit["owner_display_name"] == _DISPLAY_NAME
    assert chit["owner_username"] == _USERNAME
    assert chit["deleted"] is False
    assert "cwoc_system/imported" in chit["tags"]
    assert "Work" in chit["tags"]
    assert "Meetings" in chit["tags"]


def test_vevent_priority_high():
    """Priority 1-4 maps to High."""
    for p in [1, 2, 3, 4]:
        chit = _map(_make_vevent(priority=p))
        assert chit["priority"] == "High", f"Priority {p} should be High"


def test_vevent_priority_medium():
    """Priority 5 maps to Medium."""
    chit = _map(_make_vevent(priority=5))
    assert chit["priority"] == "Medium"


def test_vevent_priority_low():
    """Priority 6-9 maps to Low."""
    for p in [6, 7, 8, 9]:
        chit = _map(_make_vevent(priority=p))
        assert chit["priority"] == "Low", f"Priority {p} should be Low"


def test_vevent_all_day():
    """All-day flag propagates from parser to chit."""
    comp = _make_vevent(all_day=True, dtstart="2025-07-04", dtend=None)
    chit = _map(comp)
    assert chit["all_day"] is True


def test_vevent_missing_dtend():
    """Missing DTEND defaults to DTSTART."""
    comp = _make_vevent(dtend=None)
    chit = _map(comp)
    assert chit["end_datetime"] == chit["start_datetime"]


# ── VTODO Field Mapping Tests ───────────────────────────────────────────

def test_vtodo_basic_mapping():
    """VTODO fields map to correct chit fields."""
    comp = _make_vtodo(summary="Buy groceries", description="Milk, eggs")
    chit = _map(comp)
    assert chit["title"] == "Buy groceries"
    assert chit["note"] == "Milk, eggs"
    assert chit["due_datetime"] == "2025-06-20T17:00:00"
    assert "cwoc_system/imported" in chit["tags"]


def test_vtodo_status_completed():
    """VTODO STATUS=COMPLETED maps to Complete."""
    chit = _map(_make_vtodo(status="COMPLETED"))
    assert chit["status"] == "Complete"


def test_vtodo_status_in_process():
    """VTODO STATUS=IN-PROCESS maps to In Progress."""
    chit = _map(_make_vtodo(status="IN-PROCESS"))
    assert chit["status"] == "In Progress"


def test_vtodo_status_needs_action():
    """VTODO STATUS=NEEDS-ACTION maps to ToDo."""
    chit = _map(_make_vtodo(status="NEEDS-ACTION"))
    assert chit["status"] == "ToDo"


# ── Recurrence Mapping Tests ────────────────────────────────────────────

def test_rrule_daily():
    """DAILY recurrence maps correctly."""
    result = map_rrule_to_recurrence({"freq": "DAILY", "interval": 1, "byday": None, "until": None, "count": None})
    assert result["freq"] == "DAILY"
    assert result["interval"] == 1


def test_rrule_weekly_byday():
    """WEEKLY with BYDAY maps correctly."""
    result = map_rrule_to_recurrence({"freq": "WEEKLY", "interval": 2, "byday": ["MO", "WE", "FR"], "until": None, "count": None})
    assert result["freq"] == "WEEKLY"
    assert result["interval"] == 2
    assert result["byDay"] == ["MO", "WE", "FR"]


def test_rrule_monthly():
    """MONTHLY recurrence maps correctly."""
    result = map_rrule_to_recurrence({"freq": "MONTHLY", "interval": 1, "byday": None, "until": None, "count": None})
    assert result["freq"] == "MONTHLY"


def test_rrule_yearly():
    """YEARLY recurrence maps correctly."""
    result = map_rrule_to_recurrence({"freq": "YEARLY", "interval": 1, "byday": None, "until": None, "count": None})
    assert result["freq"] == "YEARLY"


def test_rrule_until_conversion():
    """RRULE UNTIL is converted to ISO date."""
    result = map_rrule_to_recurrence({"freq": "DAILY", "interval": 1, "byday": None, "until": "20251231T235959Z", "count": None})
    assert result["until"] == "2025-12-31"


def test_rrule_count_approximation():
    """RRULE COUNT is approximated to an until date."""
    result = map_rrule_to_recurrence(
        {"freq": "WEEKLY", "interval": 1, "byday": None, "until": None, "count": 10},
        start_datetime="2025-06-01T09:00:00",
    )
    assert result is not None
    assert "until" in result
    # 10 weeks * 1 interval * 7 days = 70 days from 2025-06-01 = 2025-08-10
    assert result["until"] == "2025-08-10"


def test_rrule_unsupported_hourly():
    """Unsupported frequency (HOURLY) returns None."""
    result = map_rrule_to_recurrence({"freq": "HOURLY", "interval": 1, "byday": None, "until": None, "count": None})
    assert result is None


def test_rrule_unsupported_minutely():
    """Unsupported frequency (MINUTELY) returns None."""
    result = map_rrule_to_recurrence({"freq": "MINUTELY", "interval": 1, "byday": None, "until": None, "count": None})
    assert result is None


# ── Duplicate Detection Tests ────────────────────────────────────────────

def _setup_test_db():
    """Create an in-memory SQLite DB with a minimal chits table for testing."""
    conn = sqlite3.connect(":memory:")
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE chits (
            id TEXT PRIMARY KEY,
            title TEXT,
            start_datetime TEXT,
            due_datetime TEXT,
            owner_id TEXT,
            deleted INTEGER DEFAULT 0
        )
    """)
    return conn, cursor


def test_duplicate_detection_match():
    """Matching title + start_datetime is detected as duplicate."""
    conn, cursor = _setup_test_db()
    cursor.execute(
        "INSERT INTO chits (id, title, start_datetime, owner_id, deleted) VALUES (?, ?, ?, ?, ?)",
        ("existing-1", "Team Meeting", "2025-06-15T10:00:00", _USER_ID, 0),
    )
    conn.commit()

    chits = [{"title": "Team Meeting", "start_datetime": "2025-06-15T10:00:00", "due_datetime": None}]
    dupes = find_duplicates(cursor, _USER_ID, chits)
    assert 0 in dupes
    conn.close()


def test_duplicate_detection_no_match():
    """Different title is not a duplicate."""
    conn, cursor = _setup_test_db()
    cursor.execute(
        "INSERT INTO chits (id, title, start_datetime, owner_id, deleted) VALUES (?, ?, ?, ?, ?)",
        ("existing-1", "Team Meeting", "2025-06-15T10:00:00", _USER_ID, 0),
    )
    conn.commit()

    chits = [{"title": "Different Event", "start_datetime": "2025-06-15T10:00:00", "due_datetime": None}]
    dupes = find_duplicates(cursor, _USER_ID, chits)
    assert len(dupes) == 0
    conn.close()


def test_duplicate_detection_vtodo():
    """VTODO duplicate detection uses due_datetime."""
    conn, cursor = _setup_test_db()
    cursor.execute(
        "INSERT INTO chits (id, title, due_datetime, owner_id, deleted) VALUES (?, ?, ?, ?, ?)",
        ("existing-1", "Buy groceries", "2025-06-20T17:00:00", _USER_ID, 0),
    )
    conn.commit()

    chits = [{"title": "Buy groceries", "start_datetime": None, "due_datetime": "2025-06-20T17:00:00"}]
    dupes = find_duplicates(cursor, _USER_ID, chits)
    assert 0 in dupes
    conn.close()


def test_all_duplicates_returns_all():
    """When all components are duplicates, all indices are returned."""
    conn, cursor = _setup_test_db()
    cursor.execute(
        "INSERT INTO chits (id, title, start_datetime, owner_id, deleted) VALUES (?, ?, ?, ?, ?)",
        ("e1", "Event A", "2025-06-15T10:00:00", _USER_ID, 0),
    )
    cursor.execute(
        "INSERT INTO chits (id, title, start_datetime, owner_id, deleted) VALUES (?, ?, ?, ?, ?)",
        ("e2", "Event B", "2025-06-16T10:00:00", _USER_ID, 0),
    )
    conn.commit()

    chits = [
        {"title": "Event A", "start_datetime": "2025-06-15T10:00:00", "due_datetime": None},
        {"title": "Event B", "start_datetime": "2025-06-16T10:00:00", "due_datetime": None},
    ]
    dupes = find_duplicates(cursor, _USER_ID, chits)
    assert dupes == {0, 1}
    conn.close()


def test_deleted_chits_not_considered_duplicates():
    """Deleted chits should not trigger duplicate detection."""
    conn, cursor = _setup_test_db()
    cursor.execute(
        "INSERT INTO chits (id, title, start_datetime, owner_id, deleted) VALUES (?, ?, ?, ?, ?)",
        ("e1", "Deleted Event", "2025-06-15T10:00:00", _USER_ID, 1),
    )
    conn.commit()

    chits = [{"title": "Deleted Event", "start_datetime": "2025-06-15T10:00:00", "due_datetime": None}]
    dupes = find_duplicates(cursor, _USER_ID, chits)
    assert len(dupes) == 0
    conn.close()


# ── Categories Splitting Test ────────────────────────────────────────────

def test_categories_split_into_tags():
    """Comma-separated CATEGORIES are split into individual tags."""
    ics_text = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nSUMMARY:Tagged\r\nCATEGORIES:Work,Personal,Important\r\nDTSTART:20250615T100000\r\nEND:VEVENT\r\nEND:VCALENDAR"
    result = ics_parse(ics_text)
    comp = result["components"][0]
    assert "Work" in comp["categories"]
    assert "Personal" in comp["categories"]
    assert "Important" in comp["categories"]

    chit = _map(comp)
    assert "Work" in chit["tags"]
    assert "Personal" in chit["tags"]
    assert "Important" in chit["tags"]
    assert "cwoc_system/imported" in chit["tags"]


# ── Ignored Components Test ──────────────────────────────────────────────

def test_non_vevent_vtodo_ignored():
    """Non-VEVENT/VTODO components are silently ignored."""
    ics_text = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VJOURNAL\r\nSUMMARY:Journal\r\nEND:VJOURNAL\r\nBEGIN:VEVENT\r\nSUMMARY:Real\r\nDTSTART:20250615T100000\r\nEND:VEVENT\r\nEND:VCALENDAR"
    result = ics_parse(ics_text)
    assert len(result["components"]) == 1
    assert result["components"][0]["summary"] == "Real"


# ── Error Handling Test ──────────────────────────────────────────────────

def test_missing_summary_skipped_with_error():
    """Component without SUMMARY is skipped with error recorded."""
    ics_text = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nDTSTART:20250615T100000\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nSUMMARY:Good\r\nDTSTART:20250615T110000\r\nEND:VEVENT\r\nEND:VCALENDAR"
    result = ics_parse(ics_text)
    assert len(result["components"]) == 1
    assert len(result["errors"]) == 1
    assert "Missing SUMMARY" in result["errors"][0]


# ── System Import Tag Test ───────────────────────────────────────────────

def test_import_tag_always_present():
    """cwoc_system/imported tag is always added."""
    chit = _map(_make_vevent(categories=[]))
    assert "cwoc_system/imported" in chit["tags"]


# ── Run all tests ────────────────────────────────────────────────────────

if __name__ == "__main__":
    test_funcs = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]
    passed = 0
    failed = 0
    for fn in test_funcs:
        try:
            fn()
            passed += 1
            print(f"  PASS  {fn.__name__}")
        except Exception as e:
            failed += 1
            print(f"  FAIL  {fn.__name__}: {e}")
            traceback.print_exc()
    print(f"\n{passed} passed, {failed} failed out of {passed + failed} tests")
    if failed:
        sys.exit(1)
