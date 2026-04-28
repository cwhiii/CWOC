"""Property-based test for export-import round trip (Property 7).

**Validates: Requirements 8.5, 5.3, 7.3**

Uses Python stdlib only (random, string, uuid, unittest). Minimum 100 iterations.
For each iteration:
  1. Create temp DB with chits, settings, contacts tables
  2. Insert random records
  3. Export (replicated logic from backend/main.py)
  4. Import in REPLACE mode (replicated logic from backend/main.py)
  5. Export again
  6. Compare the two exports: same field values for all non-ID fields (chits/contacts
     get new UUIDs in replace mode), settings user_id preserved, ignore export metadata
"""

import json
import os
import random
import sqlite3
import string
import tempfile
import unittest
from datetime import datetime, timezone
from uuid import uuid4


# ── Replicated helpers from backend/main.py ──────────────────────────────────

def serialize_json_field(data):
    if data is None:
        return None
    try:
        return json.dumps(data)
    except TypeError:
        return None


def deserialize_json_field(data):
    if data is None:
        return None
    try:
        return json.loads(data)
    except (json.JSONDecodeError, TypeError):
        return None


def _build_export_envelope(data_type, data, instance_id):
    version = "unknown"
    version_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "VERSION"
    )
    try:
        with open(version_path, "r") as f:
            first_line = f.readline().strip()
            if first_line:
                version = first_line
    except (FileNotFoundError, IOError):
        pass
    return {
        "type": data_type,
        "version": version,
        "exported_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "instance_id": instance_id,
        "data": data,
    }


# ── Random data generators ───────────────────────────────────────────────────

def _rand_str(min_len=1, max_len=30):
    length = random.randint(min_len, max_len)
    return "".join(random.choices(string.ascii_letters + string.digits + " ", k=length))


def _rand_iso_datetime():
    y = random.randint(2020, 2030)
    m = random.randint(1, 12)
    d = random.randint(1, 28)
    h = random.randint(0, 23)
    mi = random.randint(0, 59)
    s = random.randint(0, 59)
    return f"{y:04d}-{m:02d}-{d:02d}T{h:02d}:{mi:02d}:{s:02d}Z"


def _maybe(fn, prob=0.5):
    return fn() if random.random() < prob else None


def _rand_bool_int():
    return random.choice([0, 1])


def _rand_hex_color():
    return "#" + "".join(random.choices("0123456789abcdef", k=6))


def _rand_tags_list():
    return [_rand_str(2, 10) for _ in range(random.randint(0, 5))]


def _rand_checklist():
    return [
        {"text": _rand_str(3, 20), "checked": random.choice([True, False])}
        for _ in range(random.randint(0, 4))
    ]


def _rand_people():
    return [_rand_str(3, 15) for _ in range(random.randint(0, 3))]


def _rand_child_chits():
    return [str(uuid4()) for _ in range(random.randint(0, 3))]


def _rand_alerts():
    return [
        {"type": random.choice(["alarm", "timer", "notification"]), "time": _rand_iso_datetime()}
        for _ in range(random.randint(0, 3))
    ]


def _rand_recurrence_rule():
    return {
        "freq": random.choice(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]),
        "interval": random.randint(1, 10),
    }


def _rand_recurrence_exceptions():
    return [
        {"date": _rand_iso_datetime()[:10], "completed": random.choice([True, False])}
        for _ in range(random.randint(0, 3))
    ]


def _rand_weather_data():
    return {
        "focus_date": _rand_iso_datetime()[:10],
        "high": round(random.uniform(-30, 50), 1),
        "low": round(random.uniform(-30, 50), 1),
        "precipitation": round(random.uniform(0, 100), 1),
        "weather_code": random.randint(0, 99),
    }


def _rand_tag_objects():
    return [
        {
            "name": _rand_str(2, 10),
            "color": _rand_hex_color(),
            "fontColor": _rand_hex_color() if random.random() < 0.5 else None,
            "favorite": random.choice([True, False]),
        }
        for _ in range(random.randint(0, 5))
    ]


def _rand_default_filters():
    tabs = ["Calendar", "Checklists", "Alarms", "Projects", "Tasks", "Notes"]
    return {t: _rand_str(2, 15) for t in random.sample(tabs, random.randint(0, len(tabs)))}


def _rand_custom_colors():
    return [_rand_hex_color() for _ in range(random.randint(0, 6))]


def _rand_visual_indicators():
    keys = ["showPriority", "showStatus", "showDueDate", "showTags"]
    return {k: random.choice([True, False]) for k in random.sample(keys, random.randint(0, len(keys)))}


def _rand_chit_options():
    keys = ["showCompleted", "showArchived", "showDeleted", "compactView"]
    return {k: random.choice([True, False]) for k in random.sample(keys, random.randint(0, len(keys)))}


def _rand_saved_locations():
    return [
        {
            "label": _rand_str(3, 10),
            "address": _rand_str(10, 40),
            "is_default": random.choice([True, False]),
        }
        for _ in range(random.randint(0, 3))
    ]


def _rand_active_clocks():
    options = ["24hour", "12hour", "utc", "local"]
    chosen = random.sample(options, random.randint(1, len(options)))
    return ",".join(chosen)


def _rand_multi_value_entries():
    labels = ["Home", "Work", "Mobile", "Other"]
    return [
        {"label": random.choice(labels), "value": _rand_str(5, 25)}
        for _ in range(random.randint(0, 4))
    ]


# ── Record generators ────────────────────────────────────────────────────────

CHIT_COLUMNS = [
    "id", "title", "note", "tags", "start_datetime", "end_datetime",
    "due_datetime", "completed_datetime", "status", "priority", "severity",
    "checklist", "alarm", "notification", "recurrence", "recurrence_id",
    "location", "color", "people", "pinned", "archived", "deleted",
    "created_datetime", "modified_datetime", "is_project_master", "child_chits",
    "all_day", "alerts", "recurrence_rule", "recurrence_exceptions",
    "progress_percent", "time_estimate", "weather_data",
]

CHIT_JSON_FIELDS = [
    "tags", "checklist", "people", "child_chits",
    "alerts", "recurrence_rule", "recurrence_exceptions", "weather_data",
]

CHIT_BOOL_FIELDS = [
    "alarm", "notification", "pinned", "archived",
    "deleted", "is_project_master", "all_day",
]

SETTINGS_COLUMNS = [
    "user_id", "time_format", "sex", "snooze_length", "default_filters",
    "alarm_orientation", "active_clocks", "tags", "custom_colors",
    "visual_indicators", "chit_options", "calendar_snap", "week_start_day",
    "work_start_hour", "work_end_hour", "work_days", "enabled_periods",
    "custom_days_count", "all_view_start_hour", "all_view_end_hour",
    "day_scroll_to_hour", "saved_locations", "username",
    "audit_log_max_days", "audit_log_max_mb",
]

SETTINGS_JSON_FIELDS = [
    "tags", "default_filters", "custom_colors", "visual_indicators",
    "chit_options", "saved_locations",
]

CONTACT_COLUMNS = [
    "id", "given_name", "surname", "middle_names", "prefix", "suffix",
    "nickname", "display_name", "phones", "emails", "addresses",
    "call_signs", "x_handles", "websites", "has_signal", "signal_username",
    "pgp_key", "favorite", "color", "organization", "social_context",
    "image_url", "notes", "tags", "created_datetime", "modified_datetime",
]

CONTACT_JSON_FIELDS = [
    "phones", "emails", "addresses", "call_signs", "x_handles",
    "websites", "tags",
]

CONTACT_BOOL_FIELDS = ["has_signal", "favorite"]


def generate_random_chit_raw():
    """Generate a random chit as a raw DB row dict (JSON serialized, bools as 0/1)."""
    chit_id = str(uuid4())
    return {
        "id": chit_id,
        "title": _maybe(_rand_str, 0.9),
        "note": _maybe(lambda: _rand_str(5, 100), 0.6),
        "tags": serialize_json_field(_maybe(_rand_tags_list, 0.7)),
        "start_datetime": _maybe(_rand_iso_datetime, 0.5),
        "end_datetime": _maybe(_rand_iso_datetime, 0.4),
        "due_datetime": _maybe(_rand_iso_datetime, 0.4),
        "completed_datetime": _maybe(_rand_iso_datetime, 0.3),
        "status": _maybe(lambda: random.choice(["ToDo", "In Progress", "Blocked", "Complete"]), 0.5),
        "priority": _maybe(lambda: random.choice(["Low", "Medium", "High", "Critical"]), 0.5),
        "severity": _maybe(lambda: random.choice(["Low", "Medium", "High"]), 0.3),
        "checklist": serialize_json_field(_maybe(_rand_checklist, 0.5)),
        "alarm": _rand_bool_int(),
        "notification": _rand_bool_int(),
        "recurrence": _maybe(lambda: random.choice(["Daily", "Weekly", "Monthly"]), 0.3),
        "recurrence_id": _maybe(lambda: str(uuid4()), 0.2),
        "location": _maybe(lambda: _rand_str(5, 30), 0.3),
        "color": _maybe(_rand_hex_color, 0.3),
        "people": serialize_json_field(_maybe(_rand_people, 0.5)),
        "pinned": _rand_bool_int(),
        "archived": _rand_bool_int(),
        "deleted": _rand_bool_int(),
        "created_datetime": _rand_iso_datetime(),
        "modified_datetime": _rand_iso_datetime(),
        "is_project_master": _rand_bool_int(),
        "child_chits": serialize_json_field(_maybe(_rand_child_chits, 0.4)),
        "all_day": _rand_bool_int(),
        "alerts": serialize_json_field(_maybe(_rand_alerts, 0.5)),
        "recurrence_rule": serialize_json_field(_maybe(_rand_recurrence_rule, 0.4)),
        "recurrence_exceptions": serialize_json_field(_maybe(_rand_recurrence_exceptions, 0.3)),
        "progress_percent": _maybe(lambda: random.randint(0, 100), 0.3),
        "time_estimate": _maybe(lambda: _rand_str(2, 10), 0.3),
        "weather_data": serialize_json_field(_maybe(_rand_weather_data, 0.4)),
    }


def generate_random_settings_raw():
    """Generate a random settings record as a raw DB row dict."""
    return {
        "user_id": _rand_str(5, 15),
        "time_format": _maybe(lambda: random.choice(["12", "24"]), 0.5),
        "sex": _maybe(lambda: random.choice(["M", "F", "X"]), 0.3),
        "snooze_length": _maybe(lambda: str(random.randint(1, 30)), 0.4),
        "default_filters": serialize_json_field(_maybe(_rand_default_filters, 0.5)),
        "alarm_orientation": _maybe(lambda: random.choice(["top", "bottom"]), 0.3),
        "active_clocks": _maybe(_rand_active_clocks, 0.6),
        "tags": serialize_json_field(_maybe(_rand_tag_objects, 0.7)),
        "custom_colors": serialize_json_field(_maybe(_rand_custom_colors, 0.6)),
        "visual_indicators": serialize_json_field(_maybe(_rand_visual_indicators, 0.5)),
        "chit_options": serialize_json_field(_maybe(_rand_chit_options, 0.5)),
        "calendar_snap": _maybe(lambda: str(random.choice([5, 10, 15, 30, 60])), 0.5),
        "week_start_day": _maybe(lambda: str(random.randint(0, 6)), 0.4),
        "work_start_hour": _maybe(lambda: str(random.randint(0, 12)), 0.3),
        "work_end_hour": _maybe(lambda: str(random.randint(13, 23)), 0.3),
        "work_days": _maybe(lambda: ",".join(str(d) for d in sorted(random.sample(range(7), random.randint(1, 7)))), 0.3),
        "enabled_periods": _maybe(lambda: ",".join(random.sample(["Itinerary", "Day", "Week", "Work", "SevenDay", "Month", "Year"], random.randint(1, 7))), 0.3),
        "custom_days_count": _maybe(lambda: str(random.randint(2, 30)), 0.3),
        "all_view_start_hour": _maybe(lambda: str(random.randint(0, 12)), 0.3),
        "all_view_end_hour": _maybe(lambda: str(random.randint(13, 24)), 0.3),
        "day_scroll_to_hour": _maybe(lambda: str(random.randint(0, 23)), 0.3),
        "saved_locations": serialize_json_field(_maybe(_rand_saved_locations, 0.5)),
        "username": _maybe(lambda: _rand_str(3, 20), 0.4),
        "audit_log_max_days": _maybe(lambda: random.randint(30, 3650), 0.3),
        "audit_log_max_mb": _maybe(lambda: random.randint(1, 100), 0.3),
    }


def generate_random_contact_raw():
    """Generate a random contact record as a raw DB row dict."""
    return {
        "id": str(uuid4()),
        "given_name": _rand_str(2, 15),
        "surname": _maybe(lambda: _rand_str(2, 15), 0.6),
        "middle_names": _maybe(lambda: _rand_str(2, 15), 0.3),
        "prefix": _maybe(lambda: random.choice(["Mr", "Mrs", "Dr", "Ms"]), 0.2),
        "suffix": _maybe(lambda: random.choice(["Jr", "Sr", "III", "PhD"]), 0.1),
        "nickname": _maybe(lambda: _rand_str(2, 10), 0.3),
        "display_name": _maybe(lambda: _rand_str(5, 25), 0.7),
        "phones": serialize_json_field(_maybe(_rand_multi_value_entries, 0.6)),
        "emails": serialize_json_field(_maybe(_rand_multi_value_entries, 0.6)),
        "addresses": serialize_json_field(_maybe(_rand_multi_value_entries, 0.5)),
        "call_signs": serialize_json_field(_maybe(_rand_multi_value_entries, 0.4)),
        "x_handles": serialize_json_field(_maybe(_rand_multi_value_entries, 0.4)),
        "websites": serialize_json_field(_maybe(_rand_multi_value_entries, 0.4)),
        "has_signal": _rand_bool_int(),
        "signal_username": _maybe(lambda: _rand_str(3, 15), 0.3),
        "pgp_key": _maybe(lambda: _rand_str(20, 60), 0.2),
        "favorite": _rand_bool_int(),
        "color": _maybe(_rand_hex_color, 0.3),
        "organization": _maybe(lambda: _rand_str(3, 20), 0.3),
        "social_context": _maybe(lambda: _rand_str(5, 30), 0.2),
        "image_url": _maybe(lambda: "https://example.com/" + _rand_str(5, 15), 0.2),
        "notes": _maybe(lambda: _rand_str(10, 60), 0.3),
        "tags": serialize_json_field(_maybe(lambda: [_rand_str(2, 10) for _ in range(random.randint(0, 4))], 0.5)),
        "created_datetime": _rand_iso_datetime(),
        "modified_datetime": _rand_iso_datetime(),
    }


# ── DB setup ─────────────────────────────────────────────────────────────────

def _create_test_db(db_path):
    """Create a fresh test database with chits, settings, contacts, and instance_meta."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS chits (
        id TEXT PRIMARY KEY,
        title TEXT,
        note TEXT,
        tags TEXT,
        start_datetime TEXT,
        end_datetime TEXT,
        due_datetime TEXT,
        completed_datetime TEXT,
        status TEXT,
        priority TEXT,
        severity TEXT,
        checklist TEXT,
        alarm BOOLEAN,
        notification BOOLEAN,
        recurrence TEXT,
        recurrence_id TEXT,
        location TEXT,
        color TEXT,
        people TEXT,
        pinned BOOLEAN,
        archived BOOLEAN,
        deleted BOOLEAN,
        created_datetime TEXT,
        modified_datetime TEXT,
        is_project_master BOOLEAN DEFAULT 0,
        child_chits TEXT,
        all_day BOOLEAN DEFAULT 0,
        alerts TEXT,
        recurrence_rule TEXT,
        recurrence_exceptions TEXT,
        progress_percent INTEGER,
        time_estimate TEXT,
        weather_data TEXT
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS settings (
        user_id TEXT PRIMARY KEY,
        time_format TEXT,
        sex TEXT,
        snooze_length TEXT,
        default_filters TEXT,
        alarm_orientation TEXT,
        active_clocks TEXT,
        tags TEXT,
        custom_colors TEXT,
        visual_indicators TEXT,
        chit_options TEXT,
        calendar_snap TEXT DEFAULT '15',
        week_start_day TEXT DEFAULT '0',
        work_start_hour TEXT DEFAULT '8',
        work_end_hour TEXT DEFAULT '17',
        work_days TEXT DEFAULT '1,2,3,4,5',
        enabled_periods TEXT DEFAULT 'Itinerary,Day,Week,Work,SevenDay,Month,Year',
        custom_days_count TEXT DEFAULT '7',
        all_view_start_hour TEXT DEFAULT '0',
        all_view_end_hour TEXT DEFAULT '24',
        day_scroll_to_hour TEXT DEFAULT '5',
        saved_locations TEXT,
        username TEXT,
        audit_log_max_days INTEGER DEFAULT 1096,
        audit_log_max_mb REAL DEFAULT 1.0
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS contacts (
        id TEXT PRIMARY KEY,
        given_name TEXT NOT NULL,
        surname TEXT,
        middle_names TEXT,
        prefix TEXT,
        suffix TEXT,
        nickname TEXT,
        display_name TEXT,
        phones TEXT,
        emails TEXT,
        addresses TEXT,
        call_signs TEXT,
        x_handles TEXT,
        websites TEXT,
        has_signal BOOLEAN DEFAULT 0,
        signal_username TEXT,
        pgp_key TEXT,
        favorite BOOLEAN DEFAULT 0,
        color TEXT,
        organization TEXT,
        social_context TEXT,
        image_url TEXT,
        notes TEXT,
        tags TEXT,
        created_datetime TEXT,
        modified_datetime TEXT
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS instance_meta (
        key TEXT PRIMARY KEY,
        value TEXT
    )
    """)
    cursor.execute(
        "INSERT OR IGNORE INTO instance_meta (key, value) VALUES ('instance_id', ?)",
        (str(uuid4()),),
    )
    conn.commit()
    conn.close()


def _insert_chit(db_path, raw):
    conn = sqlite3.connect(db_path)
    placeholders = ", ".join(["?"] * len(CHIT_COLUMNS))
    col_names = ", ".join(CHIT_COLUMNS)
    values = [raw.get(col) for col in CHIT_COLUMNS]
    conn.execute(f"INSERT INTO chits ({col_names}) VALUES ({placeholders})", values)
    conn.commit()
    conn.close()


def _insert_settings(db_path, raw):
    conn = sqlite3.connect(db_path)
    placeholders = ", ".join(["?"] * len(SETTINGS_COLUMNS))
    col_names = ", ".join(SETTINGS_COLUMNS)
    values = [raw.get(col) for col in SETTINGS_COLUMNS]
    conn.execute(f"INSERT INTO settings ({col_names}) VALUES ({placeholders})", values)
    conn.commit()
    conn.close()


def _insert_contact(db_path, raw):
    conn = sqlite3.connect(db_path)
    placeholders = ", ".join(["?"] * len(CONTACT_COLUMNS))
    col_names = ", ".join(CONTACT_COLUMNS)
    values = [raw.get(col) for col in CONTACT_COLUMNS]
    conn.execute(f"INSERT INTO contacts ({col_names}) VALUES ({placeholders})", values)
    conn.commit()
    conn.close()


# ── Replicated export logic ──────────────────────────────────────────────────

def _export_chits_logic(db_path):
    """Replicate GET /api/export/chits."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute("SELECT value FROM instance_meta WHERE key = 'instance_id'")
    row = cursor.fetchone()
    instance_id = row[0] if row else "unknown"

    cursor.execute("SELECT * FROM chits")
    rows = cursor.fetchall()
    chits = []
    for row in rows:
        chit = dict(row)
        for f in CHIT_JSON_FIELDS:
            chit[f] = deserialize_json_field(chit.get(f))
        for f in CHIT_BOOL_FIELDS:
            chit[f] = bool(chit.get(f))
        chits.append(chit)

    conn.close()
    return _build_export_envelope("chits", chits, instance_id)


def _export_userdata_logic(db_path):
    """Replicate GET /api/export/userdata."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute("SELECT value FROM instance_meta WHERE key = 'instance_id'")
    row = cursor.fetchone()
    instance_id = row[0] if row else "unknown"

    # Settings
    cursor.execute("SELECT * FROM settings")
    settings = []
    for row in cursor.fetchall():
        s = dict(row)
        for f in SETTINGS_JSON_FIELDS:
            s[f] = deserialize_json_field(s.get(f))
        # active_clocks stays as string
        settings.append(s)

    # Contacts
    cursor.execute("SELECT * FROM contacts")
    contacts = []
    for row in cursor.fetchall():
        c = dict(row)
        for f in CONTACT_JSON_FIELDS:
            c[f] = deserialize_json_field(c.get(f))
        for f in CONTACT_BOOL_FIELDS:
            c[f] = bool(c.get(f))
        contacts.append(c)

    conn.close()
    return _build_export_envelope(
        "userdata", {"settings": settings, "contacts": contacts}, instance_id
    )


# ── Replicated import REPLACE mode logic ─────────────────────────────────────

def _import_chits_replace(db_path, envelope):
    """Replicate POST /api/import/chits with mode=replace."""
    records = envelope["data"]
    conn = sqlite3.connect(db_path)
    conn.execute("BEGIN")
    conn.execute("DELETE FROM chits")

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
                weather_data
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
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
            ),
        )

    conn.commit()
    conn.close()


def _import_userdata_replace(db_path, envelope):
    """Replicate POST /api/import/userdata with mode=replace."""
    payload = envelope["data"]
    settings_records = payload.get("settings", [])
    contact_records = payload.get("contacts", [])

    conn = sqlite3.connect(db_path)
    conn.execute("BEGIN")
    conn.execute("DELETE FROM settings")
    conn.execute("DELETE FROM contacts")

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

    for c in contact_records:
        new_id = str(uuid4())
        conn.execute(
            """INSERT INTO contacts (
                id, given_name, surname, middle_names, prefix, suffix,
                nickname, display_name, phones, emails, addresses, call_signs,
                x_handles, websites, has_signal, signal_username, pgp_key, favorite,
                color, organization, social_context, image_url, notes, tags,
                created_datetime, modified_datetime
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
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
            ),
        )

    conn.commit()
    conn.close()


# ── Comparison helpers ───────────────────────────────────────────────────────

# Fields to compare for chits (all except "id" which gets a new UUID)
CHIT_COMPARE_FIELDS = [f for f in CHIT_COLUMNS if f != "id"]

# Fields to compare for contacts (all except "id" which gets a new UUID)
CONTACT_COMPARE_FIELDS = [f for f in CONTACT_COLUMNS if f != "id"]


def _chit_sort_key(chit):
    """Stable sort key for chits — use created_datetime + title as composite key."""
    return (chit.get("created_datetime") or "", chit.get("title") or "")


def _contact_sort_key(contact):
    """Stable sort key for contacts — use given_name + created_datetime."""
    return (contact.get("given_name") or "", contact.get("created_datetime") or "")


def _settings_sort_key(s):
    """Stable sort key for settings — use user_id."""
    return s.get("user_id") or ""


# ── Test class ───────────────────────────────────────────────────────────────

class TestExportImportRoundTrip(unittest.TestCase):
    """Property 7: Export-import round trip.

    For any valid dataset (chits, or settings+contacts), exporting the data,
    then importing it in "replace" mode, then exporting again SHALL produce
    a dataset equivalent to the first export (same records with same field
    values, ignoring generated IDs and export metadata like exported_at).

    **Validates: Requirements 8.5, 5.3, 7.3**
    """

    def test_chit_round_trip(self):
        """Property test: chit export → replace import → re-export produces equivalent data.
        100 iterations.
        """
        iterations = 100

        for i in range(iterations):
            with tempfile.TemporaryDirectory() as tmp_dir:
                db_path = os.path.join(tmp_dir, "test.db")
                _create_test_db(db_path)

                # Insert 1-5 random chits
                num_chits = random.randint(1, 5)
                for _ in range(num_chits):
                    _insert_chit(db_path, generate_random_chit_raw())

                # Export 1
                export1 = _export_chits_logic(db_path)

                # Import in replace mode (clears DB, inserts with new IDs)
                _import_chits_replace(db_path, export1)

                # Export 2
                export2 = _export_chits_logic(db_path)

                # ── Compare ──────────────────────────────────────────────
                chits1 = sorted(export1["data"], key=_chit_sort_key)
                chits2 = sorted(export2["data"], key=_chit_sort_key)

                self.assertEqual(
                    len(chits1), len(chits2),
                    f"Iteration {i}: chit count mismatch: {len(chits1)} vs {len(chits2)}"
                )

                for j, (c1, c2) in enumerate(zip(chits1, chits2)):
                    # IDs should differ (replace mode generates new UUIDs)
                    # but all other fields should match
                    for field in CHIT_COMPARE_FIELDS:
                        val1 = c1.get(field)
                        val2 = c2.get(field)
                        self.assertEqual(
                            val1, val2,
                            f"Iteration {i}, chit {j}, field '{field}': "
                            f"{val1!r} != {val2!r}"
                        )

    def test_userdata_round_trip(self):
        """Property test: userdata export → replace import → re-export produces equivalent data.
        100 iterations.
        """
        iterations = 100

        for i in range(iterations):
            with tempfile.TemporaryDirectory() as tmp_dir:
                db_path = os.path.join(tmp_dir, "test.db")
                _create_test_db(db_path)

                # Insert 1-2 random settings records
                num_settings = random.randint(1, 2)
                for _ in range(num_settings):
                    _insert_settings(db_path, generate_random_settings_raw())

                # Insert 0-4 random contacts
                num_contacts = random.randint(0, 4)
                for _ in range(num_contacts):
                    _insert_contact(db_path, generate_random_contact_raw())

                # Export 1
                export1 = _export_userdata_logic(db_path)

                # Import in replace mode
                _import_userdata_replace(db_path, export1)

                # Export 2
                export2 = _export_userdata_logic(db_path)

                # ── Compare settings ─────────────────────────────────────
                settings1 = sorted(export1["data"]["settings"], key=_settings_sort_key)
                settings2 = sorted(export2["data"]["settings"], key=_settings_sort_key)

                self.assertEqual(
                    len(settings1), len(settings2),
                    f"Iteration {i}: settings count mismatch: "
                    f"{len(settings1)} vs {len(settings2)}"
                )

                for j, (s1, s2) in enumerate(zip(settings1, settings2)):
                    # Settings user_id is preserved in replace mode
                    for field in SETTINGS_COLUMNS:
                        val1 = s1.get(field)
                        val2 = s2.get(field)
                        self.assertEqual(
                            val1, val2,
                            f"Iteration {i}, settings {j}, field '{field}': "
                            f"{val1!r} != {val2!r}"
                        )

                # ── Compare contacts ─────────────────────────────────────
                contacts1 = sorted(export1["data"]["contacts"], key=_contact_sort_key)
                contacts2 = sorted(export2["data"]["contacts"], key=_contact_sort_key)

                self.assertEqual(
                    len(contacts1), len(contacts2),
                    f"Iteration {i}: contacts count mismatch: "
                    f"{len(contacts1)} vs {len(contacts2)}"
                )

                for j, (c1, c2) in enumerate(zip(contacts1, contacts2)):
                    # IDs differ (replace mode generates new UUIDs)
                    for field in CONTACT_COMPARE_FIELDS:
                        val1 = c1.get(field)
                        val2 = c2.get(field)
                        self.assertEqual(
                            val1, val2,
                            f"Iteration {i}, contact {j}, field '{field}': "
                            f"{val1!r} != {val2!r}"
                        )


if __name__ == "__main__":
    unittest.main()
