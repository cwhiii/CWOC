"""Unit tests for ics_parse and ics_print."""
import sys
import os

# Allow importing modules from the backend directory
sys.path.insert(0, os.path.dirname(__file__))

# ── Patch /app paths before importing backend modules ────────────────────
_original_makedirs = os.makedirs

def _safe_makedirs(name, *args, **kwargs):
    if isinstance(name, str) and name.startswith("/app"):
        return
    return _original_makedirs(name, *args, **kwargs)

os.makedirs = _safe_makedirs

from ics_serializer import ics_parse, ics_print

os.makedirs = _original_makedirs


# ── Helper to build minimal ICS text ────────────────────────────────────

def _wrap_vcal(*components):
    """Wrap component blocks in a VCALENDAR envelope."""
    parts = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Test//EN"]
    for c in components:
        parts.append(c)
    parts.append("END:VCALENDAR")
    return "\r\n".join(parts)


def _vevent(**props):
    """Build a VEVENT block from keyword properties."""
    lines = ["BEGIN:VEVENT"]
    for k, v in props.items():
        lines.append(f"{k}:{v}")
    lines.append("END:VEVENT")
    return "\r\n".join(lines)


def _vtodo(**props):
    """Build a VTODO block from keyword properties."""
    lines = ["BEGIN:VTODO"]
    for k, v in props.items():
        lines.append(f"{k}:{v}")
    lines.append("END:VTODO")
    return "\r\n".join(lines)


# ── VEVENT Parsing Tests ────────────────────────────────────────────────

def test_basic_vevent_parsing():
    """Parse a simple VEVENT with core fields."""
    ics = _wrap_vcal(_vevent(
        SUMMARY="Team Meeting",
        DTSTART="20250615T100000",
        DTEND="20250615T110000",
        DESCRIPTION="Weekly sync",
        LOCATION="Room A",
        UID="abc123@test",
    ))
    result = ics_parse(ics)
    assert "error" not in result
    assert len(result["components"]) == 1
    comp = result["components"][0]
    assert comp["type"] == "VEVENT"
    assert comp["summary"] == "Team Meeting"
    assert comp["dtstart"] == "2025-06-15T10:00:00"
    assert comp["dtend"] == "2025-06-15T11:00:00"
    assert comp["description"] == "Weekly sync"
    assert comp["location"] == "Room A"
    assert comp["uid"] == "abc123@test"
    assert comp["all_day"] is False


def test_vevent_priority():
    """Parse VEVENT with priority value."""
    ics = _wrap_vcal(_vevent(SUMMARY="High Pri", PRIORITY="1"))
    result = ics_parse(ics)
    assert result["components"][0]["priority"] == 1


def test_vevent_categories():
    """Parse VEVENT with comma-separated categories."""
    ics = _wrap_vcal(_vevent(SUMMARY="Tagged", CATEGORIES="Work,Meetings,Important"))
    result = ics_parse(ics)
    assert result["components"][0]["categories"] == ["Work", "Meetings", "Important"]


# ── VTODO Parsing Tests ─────────────────────────────────────────────────

def test_basic_vtodo_parsing():
    """Parse a VTODO with core fields."""
    ics = _wrap_vcal(_vtodo(
        SUMMARY="Buy groceries",
        DUE="20250620T170000",
        STATUS="NEEDS-ACTION",
        PRIORITY="5",
        DESCRIPTION="Milk, eggs, bread",
        UID="todo1@test",
    ))
    result = ics_parse(ics)
    assert "error" not in result
    assert len(result["components"]) == 1
    comp = result["components"][0]
    assert comp["type"] == "VTODO"
    assert comp["summary"] == "Buy groceries"
    assert comp["due"] == "2025-06-20T17:00:00"
    assert comp["status"] == "NEEDS-ACTION"
    assert comp["priority"] == 5
    assert comp["description"] == "Milk, eggs, bread"


# ── Line Unfolding Tests ────────────────────────────────────────────────

def test_line_unfolding():
    """Continuation lines (starting with space/tab) are unfolded."""
    ics_text = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nSUMMARY:This is a very\r\n  long summary that spans\r\n  multiple lines\r\nDTSTART:20250615T100000\r\nEND:VEVENT\r\nEND:VCALENDAR"
    result = ics_parse(ics_text)
    assert "error" not in result
    assert result["components"][0]["summary"] == "This is a very long summary that spans multiple lines"


# ── TZID Preservation Tests ─────────────────────────────────────────────

def test_tzid_preservation():
    """TZID parameter on DTSTART/DTEND is preserved."""
    ics_text = _wrap_vcal(
        "BEGIN:VEVENT\r\nSUMMARY:NYC Meeting\r\n"
        "DTSTART;TZID=America/New_York:20250615T100000\r\n"
        "DTEND;TZID=America/New_York:20250615T110000\r\n"
        "END:VEVENT"
    )
    result = ics_parse(ics_text)
    comp = result["components"][0]
    assert comp["dtstart_tzid"] == "America/New_York"
    assert comp["dtend_tzid"] == "America/New_York"
    assert comp["dtstart"] == "2025-06-15T10:00:00"


# ── All-Day Event Detection ─────────────────────────────────────────────

def test_all_day_event():
    """DATE-only DTSTART marks event as all-day."""
    ics = _wrap_vcal(_vevent(SUMMARY="Holiday", DTSTART="20250704"))
    result = ics_parse(ics)
    comp = result["components"][0]
    assert comp["all_day"] is True
    assert comp["dtstart"] == "2025-07-04"


def test_datetime_event_not_all_day():
    """DATE-TIME DTSTART is not all-day."""
    ics = _wrap_vcal(_vevent(SUMMARY="Meeting", DTSTART="20250615T100000"))
    result = ics_parse(ics)
    assert result["components"][0]["all_day"] is False


# ── RRULE Parsing Tests ─────────────────────────────────────────────────

def test_rrule_daily():
    """Parse RRULE with FREQ=DAILY."""
    ics = _wrap_vcal(_vevent(SUMMARY="Daily", DTSTART="20250601T090000", RRULE="FREQ=DAILY;INTERVAL=1"))
    result = ics_parse(ics)
    rrule = result["components"][0]["rrule"]
    assert rrule["freq"] == "DAILY"
    assert rrule["interval"] == 1


def test_rrule_weekly_byday():
    """Parse RRULE with FREQ=WEEKLY and BYDAY."""
    ics = _wrap_vcal(_vevent(SUMMARY="MWF", DTSTART="20250601T090000",
                              RRULE="FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR"))
    result = ics_parse(ics)
    rrule = result["components"][0]["rrule"]
    assert rrule["freq"] == "WEEKLY"
    assert rrule["byday"] == ["MO", "WE", "FR"]


def test_rrule_monthly():
    """Parse RRULE with FREQ=MONTHLY."""
    ics = _wrap_vcal(_vevent(SUMMARY="Monthly", DTSTART="20250601T090000",
                              RRULE="FREQ=MONTHLY;INTERVAL=2"))
    result = ics_parse(ics)
    rrule = result["components"][0]["rrule"]
    assert rrule["freq"] == "MONTHLY"
    assert rrule["interval"] == 2


def test_rrule_yearly():
    """Parse RRULE with FREQ=YEARLY."""
    ics = _wrap_vcal(_vevent(SUMMARY="Birthday", DTSTART="20250315",
                              RRULE="FREQ=YEARLY"))
    result = ics_parse(ics)
    rrule = result["components"][0]["rrule"]
    assert rrule["freq"] == "YEARLY"


def test_rrule_until():
    """Parse RRULE with UNTIL clause."""
    ics = _wrap_vcal(_vevent(SUMMARY="Limited", DTSTART="20250601T090000",
                              RRULE="FREQ=DAILY;UNTIL=20251231T235959Z"))
    result = ics_parse(ics)
    rrule = result["components"][0]["rrule"]
    assert rrule["until"] == "20251231T235959Z"


def test_rrule_count():
    """Parse RRULE with COUNT clause."""
    ics = _wrap_vcal(_vevent(SUMMARY="Counted", DTSTART="20250601T090000",
                              RRULE="FREQ=WEEKLY;COUNT=10"))
    result = ics_parse(ics)
    rrule = result["components"][0]["rrule"]
    assert rrule["count"] == 10


# ── Round-Trip Tests ─────────────────────────────────────────────────────

def test_round_trip_vevent():
    """Parse → print → parse produces equivalent data."""
    ics = _wrap_vcal(_vevent(
        SUMMARY="Round Trip",
        DTSTART="20250615T100000",
        DTEND="20250615T110000",
        DESCRIPTION="Test round trip",
        LOCATION="Office",
        UID="rt1@test",
        PRIORITY="3",
        CATEGORIES="Work,Test",
        RRULE="FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE",
    ))
    result1 = ics_parse(ics)
    assert "error" not in result1
    printed = ics_print(result1["components"])
    result2 = ics_parse(printed)
    assert "error" not in result2

    c1 = result1["components"][0]
    c2 = result2["components"][0]
    assert c1["summary"] == c2["summary"]
    assert c1["dtstart"] == c2["dtstart"]
    assert c1["dtend"] == c2["dtend"]
    assert c1["description"] == c2["description"]
    assert c1["location"] == c2["location"]
    assert c1["priority"] == c2["priority"]
    assert c1["categories"] == c2["categories"]
    assert c1["rrule"]["freq"] == c2["rrule"]["freq"]
    assert c1["rrule"]["byday"] == c2["rrule"]["byday"]


def test_round_trip_all_day():
    """All-day event round-trips correctly."""
    ics = _wrap_vcal(_vevent(SUMMARY="All Day", DTSTART="20250704"))
    result1 = ics_parse(ics)
    printed = ics_print(result1["components"])
    result2 = ics_parse(printed)
    c1 = result1["components"][0]
    c2 = result2["components"][0]
    assert c1["all_day"] == c2["all_day"] == True
    assert c1["dtstart"] == c2["dtstart"]


# ── Error Case Tests ────────────────────────────────────────────────────

def test_missing_vcalendar():
    """Content without BEGIN:VCALENDAR returns error."""
    result = ics_parse("BEGIN:VEVENT\r\nSUMMARY:Oops\r\nEND:VEVENT")
    assert "error" in result
    assert "BEGIN:VCALENDAR" in result["error"]


def test_no_components():
    """VCALENDAR with no VEVENT/VTODO returns error."""
    result = ics_parse("BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR")
    assert "error" in result


def test_missing_summary_skipped():
    """Component without SUMMARY is skipped with error recorded."""
    ics = _wrap_vcal(
        _vevent(DTSTART="20250615T100000"),  # no SUMMARY
        _vevent(SUMMARY="Good Event", DTSTART="20250615T110000"),
    )
    result = ics_parse(ics)
    assert "error" not in result
    assert len(result["components"]) == 1
    assert result["components"][0]["summary"] == "Good Event"
    assert len(result["errors"]) == 1
    assert "Missing SUMMARY" in result["errors"][0]


# ── Ignored Component Types ─────────────────────────────────────────────

def test_vtimezone_ignored():
    """VTIMEZONE components are silently ignored."""
    ics = _wrap_vcal(
        "BEGIN:VTIMEZONE\r\nTZID:America/New_York\r\nEND:VTIMEZONE",
        _vevent(SUMMARY="After TZ", DTSTART="20250615T100000"),
    )
    result = ics_parse(ics)
    assert "error" not in result
    assert len(result["components"]) == 1
    assert result["components"][0]["summary"] == "After TZ"


def test_vjournal_ignored():
    """VJOURNAL components are silently ignored."""
    ics = _wrap_vcal(
        "BEGIN:VJOURNAL\r\nSUMMARY:Journal Entry\r\nEND:VJOURNAL",
        _vevent(SUMMARY="Real Event", DTSTART="20250615T100000"),
    )
    result = ics_parse(ics)
    assert len(result["components"]) == 1
    assert result["components"][0]["summary"] == "Real Event"


def test_valarm_inside_vevent_ignored():
    """VALARM nested inside VEVENT is silently ignored."""
    ics_text = _wrap_vcal(
        "BEGIN:VEVENT\r\nSUMMARY:With Alarm\r\nDTSTART:20250615T100000\r\n"
        "BEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:Reminder\r\nEND:VALARM\r\n"
        "END:VEVENT"
    )
    result = ics_parse(ics_text)
    assert len(result["components"]) == 1
    assert result["components"][0]["summary"] == "With Alarm"


# ── UTC / Z suffix Tests ────────────────────────────────────────────────

def test_utc_z_suffix():
    """DTSTART with Z suffix is parsed correctly."""
    ics = _wrap_vcal(_vevent(SUMMARY="UTC Event", DTSTART="20250615T100000Z"))
    result = ics_parse(ics)
    comp = result["components"][0]
    assert comp["dtstart"] == "2025-06-15T10:00:00Z"
    assert comp["dtstart_tzid"] == "UTC"


# ── Multiple Components ─────────────────────────────────────────────────

def test_multiple_events():
    """Multiple VEVENTs are all parsed."""
    ics = _wrap_vcal(
        _vevent(SUMMARY="Event 1", DTSTART="20250601T090000"),
        _vevent(SUMMARY="Event 2", DTSTART="20250602T090000"),
        _vevent(SUMMARY="Event 3", DTSTART="20250603T090000"),
    )
    result = ics_parse(ics)
    assert len(result["components"]) == 3


def test_mixed_vevent_vtodo():
    """Mix of VEVENT and VTODO components are all parsed."""
    ics = _wrap_vcal(
        _vevent(SUMMARY="Event", DTSTART="20250601T090000"),
        _vtodo(SUMMARY="Task", DUE="20250602T170000", STATUS="NEEDS-ACTION"),
    )
    result = ics_parse(ics)
    assert len(result["components"]) == 2
    assert result["components"][0]["type"] == "VEVENT"
    assert result["components"][1]["type"] == "VTODO"


# ── Printer Tests ────────────────────────────────────────────────────────

def test_print_wraps_vcalendar():
    """ics_print wraps output in VCALENDAR with VERSION and PRODID."""
    output = ics_print([])
    assert output.startswith("BEGIN:VCALENDAR")
    assert "VERSION:2.0" in output
    assert "PRODID:-//CWOC//EN" in output
    assert output.strip().endswith("END:VCALENDAR")


def test_print_vevent_fields():
    """ics_print outputs all VEVENT fields."""
    comp = {
        "type": "VEVENT",
        "summary": "Test",
        "dtstart": "2025-06-15T10:00:00",
        "dtstart_tzid": "America/New_York",
        "dtend": "2025-06-15T11:00:00",
        "dtend_tzid": "America/New_York",
        "description": "Desc",
        "location": "Room",
        "uid": "test@uid",
        "priority": 3,
        "categories": ["Work", "Test"],
        "all_day": False,
        "rrule": {"freq": "WEEKLY", "interval": 2, "byday": ["MO", "WE"], "until": None, "count": None},
        "status": None,
        "due": None,
    }
    output = ics_print([comp])
    assert "SUMMARY:Test" in output
    assert "DESCRIPTION:Desc" in output
    assert "LOCATION:Room" in output
    assert "UID:test@uid" in output
    assert "PRIORITY:3" in output
    assert "CATEGORIES:Work,Test" in output
    assert "DTSTART;TZID=America/New_York:" in output
    assert "RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE" in output


# ── Run all tests ────────────────────────────────────────────────────────

if __name__ == "__main__":
    import traceback
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
