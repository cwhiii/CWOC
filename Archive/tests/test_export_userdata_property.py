"""Property-based test for user data export completeness and correctness (Property 2).

**Validates: Requirements 3.2, 3.4, 3.5, 3.6, 9.4**

Uses Python stdlib only (random, string, uuid, unittest). Minimum 100 iterations.
Generates random settings and contact records with varied combinations of null/populated
JSON fields, inserts them into a temporary SQLite database, replicates the export_userdata
logic (same deserialization + envelope building as backend/main.py), and verifies:
  - Envelope structure: type="userdata", version (str), exported_at (str), instance_id (str),
    data object with settings (list) and contacts (list)
  - All inserted settings and contacts appear in the export
  - JSON-serialized fields are deserialized (native objects/arrays, not raw strings)
  - Boolean fields on contacts are native booleans
  - active_clocks remains a string (comma-separated, not JSON)
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


# ── Replicated helpers from backend/main.py (stdlib only, no FastAPI) ────────

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
    """Replicate the envelope builder from backend/main.py."""
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


def _export_userdata_logic(db_path):
    """Replicate the GET /api/export/userdata endpoint logic from backend/main.py.

    Connects to the given DB, queries all settings and contacts, deserializes
    JSON fields, converts booleans, and wraps in an export envelope.
    """
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Read instance_id
    cursor.execute("SELECT value FROM instance_meta WHERE key = 'instance_id'")
    row = cursor.fetchone()
    instance_id = row[0] if row else "unknown"

    # --- Settings ---
    cursor.execute("SELECT * FROM settings")
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
        settings.append(s)

    # --- Contacts ---
    cursor.execute("SELECT * FROM contacts")
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

    conn.close()
    return _build_export_envelope(
        "userdata", {"settings": settings, "contacts": contacts}, instance_id
    )


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


def _rand_tags():
    """Generate random tag objects like [{name, color, fontColor, favorite}]."""
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
    """Generate random default_filters object like {tab: "filter text"}."""
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
    """Generate a comma-separated string of clock formats (NOT JSON)."""
    options = ["24hour", "12hour", "utc", "local"]
    chosen = random.sample(options, random.randint(1, len(options)))
    return ",".join(chosen)


def _rand_multi_value_entries():
    """Generate random list of {label, value} objects for phones/emails/etc."""
    labels = ["Home", "Work", "Mobile", "Other"]
    return [
        {"label": random.choice(labels), "value": _rand_str(5, 25)}
        for _ in range(random.randint(0, 4))
    ]


def generate_random_settings():
    """Generate a random settings record.

    Returns (user_id, raw_row_dict, expected_deserialized_dict).
    raw_row_dict has values as stored in SQLite (JSON strings).
    expected_deserialized_dict has values as they should appear in the export.
    """
    user_id = _rand_str(5, 15)

    # JSON fields
    tags = _maybe(_rand_tags, 0.7)
    default_filters = _maybe(_rand_default_filters, 0.5)
    custom_colors = _maybe(_rand_custom_colors, 0.6)
    visual_indicators = _maybe(_rand_visual_indicators, 0.5)
    chit_options = _maybe(_rand_chit_options, 0.5)
    saved_locations = _maybe(_rand_saved_locations, 0.5)

    # active_clocks is a comma-separated string, NOT JSON
    active_clocks = _maybe(_rand_active_clocks, 0.6)

    # Scalar fields
    time_format = _maybe(lambda: random.choice(["12", "24"]), 0.5)
    sex = _maybe(lambda: random.choice(["M", "F", "X"]), 0.3)
    snooze_length = _maybe(lambda: str(random.randint(1, 30)), 0.4)
    alarm_orientation = _maybe(lambda: random.choice(["top", "bottom"]), 0.3)
    calendar_snap = _maybe(lambda: str(random.choice([5, 10, 15, 30, 60])), 0.5)
    week_start_day = _maybe(lambda: str(random.randint(0, 6)), 0.4)
    work_start_hour = _maybe(lambda: str(random.randint(0, 12)), 0.3)
    work_end_hour = _maybe(lambda: str(random.randint(13, 23)), 0.3)
    work_days = _maybe(lambda: ",".join(str(d) for d in sorted(random.sample(range(7), random.randint(1, 7)))), 0.3)
    enabled_periods = _maybe(lambda: ",".join(random.sample(["Itinerary", "Day", "Week", "Work", "SevenDay", "Month", "Year"], random.randint(1, 7))), 0.3)
    custom_days_count = _maybe(lambda: str(random.randint(2, 30)), 0.3)
    all_view_start_hour = _maybe(lambda: str(random.randint(0, 12)), 0.3)
    all_view_end_hour = _maybe(lambda: str(random.randint(13, 24)), 0.3)
    day_scroll_to_hour = _maybe(lambda: str(random.randint(0, 23)), 0.3)
    username = _maybe(lambda: _rand_str(3, 20), 0.4)
    audit_log_max_days = _maybe(lambda: random.randint(30, 3650), 0.3)
    audit_log_max_mb = _maybe(lambda: random.randint(1, 100), 0.3)

    raw = {
        "user_id": user_id,
        "time_format": time_format,
        "sex": sex,
        "snooze_length": snooze_length,
        "default_filters": serialize_json_field(default_filters),
        "alarm_orientation": alarm_orientation,
        "active_clocks": active_clocks,
        "tags": serialize_json_field(tags),
        "custom_colors": serialize_json_field(custom_colors),
        "visual_indicators": serialize_json_field(visual_indicators),
        "chit_options": serialize_json_field(chit_options),
        "calendar_snap": calendar_snap,
        "week_start_day": week_start_day,
        "work_start_hour": work_start_hour,
        "work_end_hour": work_end_hour,
        "work_days": work_days,
        "enabled_periods": enabled_periods,
        "custom_days_count": custom_days_count,
        "all_view_start_hour": all_view_start_hour,
        "all_view_end_hour": all_view_end_hour,
        "day_scroll_to_hour": day_scroll_to_hour,
        "saved_locations": serialize_json_field(saved_locations),
        "username": username,
        "audit_log_max_days": audit_log_max_days,
        "audit_log_max_mb": audit_log_max_mb,
    }

    expected = {
        "user_id": user_id,
        "time_format": time_format,
        "sex": sex,
        "snooze_length": snooze_length,
        "default_filters": default_filters,
        "alarm_orientation": alarm_orientation,
        "active_clocks": active_clocks,  # stays as string
        "tags": tags,
        "custom_colors": custom_colors,
        "visual_indicators": visual_indicators,
        "chit_options": chit_options,
        "calendar_snap": calendar_snap,
        "week_start_day": week_start_day,
        "work_start_hour": work_start_hour,
        "work_end_hour": work_end_hour,
        "work_days": work_days,
        "enabled_periods": enabled_periods,
        "custom_days_count": custom_days_count,
        "all_view_start_hour": all_view_start_hour,
        "all_view_end_hour": all_view_end_hour,
        "day_scroll_to_hour": day_scroll_to_hour,
        "saved_locations": saved_locations,
        "username": username,
        "audit_log_max_days": audit_log_max_days,
        "audit_log_max_mb": audit_log_max_mb,
    }

    return user_id, raw, expected


def generate_random_contact():
    """Generate a random contact record.

    Returns (contact_id, raw_row_dict, expected_deserialized_dict).
    raw_row_dict has values as stored in SQLite (JSON strings, 0/1 bools).
    expected_deserialized_dict has values as they should appear in the export.
    """
    contact_id = str(uuid4())
    given_name = _rand_str(2, 15)

    # JSON fields
    phones = _maybe(_rand_multi_value_entries, 0.6)
    emails = _maybe(_rand_multi_value_entries, 0.6)
    addresses = _maybe(_rand_multi_value_entries, 0.5)
    call_signs = _maybe(_rand_multi_value_entries, 0.4)
    x_handles = _maybe(_rand_multi_value_entries, 0.4)
    websites = _maybe(_rand_multi_value_entries, 0.4)
    tags = _maybe(lambda: [_rand_str(2, 10) for _ in range(random.randint(0, 4))], 0.5)

    # Boolean fields (stored as 0/1 in SQLite)
    has_signal = _rand_bool_int()
    favorite = _rand_bool_int()

    # Scalar fields
    surname = _maybe(lambda: _rand_str(2, 15), 0.6)
    middle_names = _maybe(lambda: _rand_str(2, 15), 0.3)
    prefix = _maybe(lambda: random.choice(["Mr", "Mrs", "Dr", "Ms"]), 0.2)
    suffix = _maybe(lambda: random.choice(["Jr", "Sr", "III", "PhD"]), 0.1)
    nickname = _maybe(lambda: _rand_str(2, 10), 0.3)
    display_name = _maybe(lambda: _rand_str(5, 25), 0.7)
    signal_username = _maybe(lambda: _rand_str(3, 15), 0.3)
    pgp_key = _maybe(lambda: _rand_str(20, 60), 0.2)
    color = _maybe(_rand_hex_color, 0.3)
    organization = _maybe(lambda: _rand_str(3, 20), 0.3)
    social_context = _maybe(lambda: _rand_str(5, 30), 0.2)
    image_url = _maybe(lambda: "https://example.com/" + _rand_str(5, 15), 0.2)
    notes = _maybe(lambda: _rand_str(10, 60), 0.3)
    created_datetime = _rand_iso_datetime()
    modified_datetime = _rand_iso_datetime()

    raw = {
        "id": contact_id,
        "given_name": given_name,
        "surname": surname,
        "middle_names": middle_names,
        "prefix": prefix,
        "suffix": suffix,
        "nickname": nickname,
        "display_name": display_name,
        "phones": serialize_json_field(phones),
        "emails": serialize_json_field(emails),
        "addresses": serialize_json_field(addresses),
        "call_signs": serialize_json_field(call_signs),
        "x_handles": serialize_json_field(x_handles),
        "websites": serialize_json_field(websites),
        "has_signal": has_signal,
        "signal_username": signal_username,
        "pgp_key": pgp_key,
        "favorite": favorite,
        "color": color,
        "organization": organization,
        "social_context": social_context,
        "image_url": image_url,
        "notes": notes,
        "tags": serialize_json_field(tags),
        "created_datetime": created_datetime,
        "modified_datetime": modified_datetime,
    }

    expected = {
        "id": contact_id,
        "given_name": given_name,
        "surname": surname,
        "middle_names": middle_names,
        "prefix": prefix,
        "suffix": suffix,
        "nickname": nickname,
        "display_name": display_name,
        "phones": phones,
        "emails": emails,
        "addresses": addresses,
        "call_signs": call_signs,
        "x_handles": x_handles,
        "websites": websites,
        "has_signal": bool(has_signal),
        "signal_username": signal_username,
        "pgp_key": pgp_key,
        "favorite": bool(favorite),
        "color": color,
        "organization": organization,
        "social_context": social_context,
        "image_url": image_url,
        "notes": notes,
        "tags": tags,
        "created_datetime": created_datetime,
        "modified_datetime": modified_datetime,
    }

    return contact_id, raw, expected


# ── DB setup helpers ─────────────────────────────────────────────────────────

SETTINGS_COLUMNS = [
    "user_id", "time_format", "sex", "snooze_length", "default_filters",
    "alarm_orientation", "active_clocks", "tags", "custom_colors",
    "visual_indicators", "chit_options", "calendar_snap", "week_start_day",
    "work_start_hour", "work_end_hour", "work_days", "enabled_periods",
    "custom_days_count", "all_view_start_hour", "all_view_end_hour",
    "day_scroll_to_hour", "saved_locations", "username",
    "audit_log_max_days", "audit_log_max_mb",
]

CONTACT_COLUMNS = [
    "id", "given_name", "surname", "middle_names", "prefix", "suffix",
    "nickname", "display_name", "phones", "emails", "addresses",
    "call_signs", "x_handles", "websites", "has_signal", "signal_username",
    "pgp_key", "favorite", "color", "organization", "social_context",
    "image_url", "notes", "tags", "created_datetime", "modified_datetime",
]

# JSON-serialized fields in settings that get deserialized in the export
SETTINGS_JSON_FIELDS = [
    "tags", "default_filters", "custom_colors", "visual_indicators",
    "chit_options", "saved_locations",
]

# JSON-serialized fields in contacts that get deserialized in the export
CONTACT_JSON_FIELDS = [
    "phones", "emails", "addresses", "call_signs", "x_handles",
    "websites", "tags",
]

CONTACT_BOOL_FIELDS = ["has_signal", "favorite"]


def _create_test_db(db_path):
    """Create a fresh test database with settings, contacts, and instance_meta tables."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

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


def _insert_settings(db_path, raw_row):
    """Insert a single settings raw row dict into the database."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    placeholders = ", ".join(["?"] * len(SETTINGS_COLUMNS))
    col_names = ", ".join(SETTINGS_COLUMNS)
    values = [raw_row.get(col) for col in SETTINGS_COLUMNS]
    cursor.execute(f"INSERT INTO settings ({col_names}) VALUES ({placeholders})", values)
    conn.commit()
    conn.close()


def _insert_contact(db_path, raw_row):
    """Insert a single contact raw row dict into the database."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    placeholders = ", ".join(["?"] * len(CONTACT_COLUMNS))
    col_names = ", ".join(CONTACT_COLUMNS)
    values = [raw_row.get(col) for col in CONTACT_COLUMNS]
    cursor.execute(f"INSERT INTO contacts ({col_names}) VALUES ({placeholders})", values)
    conn.commit()
    conn.close()


# ── Test class ───────────────────────────────────────────────────────────────

class TestUserdataExportCompletenessAndCorrectness(unittest.TestCase):
    """Property 2: User data export completeness and correctness.

    For any set of settings and contact records in the database (with any
    combination of populated and null JSON-serialized fields), calling the
    export_userdata logic SHALL return a valid Export Envelope with
    type="userdata", a version string, an ISO 8601 exported_at timestamp,
    an instance_id string, and a data object containing a settings array
    and a contacts array, where every record has all JSON-serialized fields
    in their deserialized form.

    **Validates: Requirements 3.2, 3.4, 3.5, 3.6, 9.4**
    """

    def test_userdata_export_completeness(self):
        """Property test: 100 iterations with random settings and contact data."""
        iterations = 100

        for i in range(iterations):
            with tempfile.TemporaryDirectory() as tmp_dir:
                db_path = os.path.join(tmp_dir, "test.db")
                _create_test_db(db_path)

                # Generate 1-3 random settings records per iteration
                num_settings = random.randint(1, 3)
                expected_settings = {}
                for _ in range(num_settings):
                    uid, raw, expected = generate_random_settings()
                    _insert_settings(db_path, raw)
                    expected_settings[uid] = expected

                # Generate 0-5 random contact records per iteration
                num_contacts = random.randint(0, 5)
                expected_contacts = {}
                for _ in range(num_contacts):
                    cid, raw, expected = generate_random_contact()
                    _insert_contact(db_path, raw)
                    expected_contacts[cid] = expected

                # Call the replicated export logic
                envelope = _export_userdata_logic(db_path)

                # ── Verify envelope structure ────────────────────────────
                self.assertEqual(
                    envelope["type"], "userdata",
                    f"Iteration {i}: envelope type should be 'userdata', got '{envelope.get('type')}'"
                )
                self.assertIsInstance(
                    envelope["version"], str,
                    f"Iteration {i}: version should be a string"
                )
                self.assertTrue(
                    len(envelope["version"]) > 0,
                    f"Iteration {i}: version should be non-empty"
                )
                self.assertIsInstance(
                    envelope["exported_at"], str,
                    f"Iteration {i}: exported_at should be a string"
                )
                self.assertTrue(
                    envelope["exported_at"].endswith("Z"),
                    f"Iteration {i}: exported_at should end with 'Z', got '{envelope['exported_at']}'"
                )
                self.assertIsInstance(
                    envelope["instance_id"], str,
                    f"Iteration {i}: instance_id should be a string"
                )
                self.assertTrue(
                    len(envelope["instance_id"]) > 0,
                    f"Iteration {i}: instance_id should be non-empty"
                )

                # Verify data is an object with settings and contacts arrays
                data = envelope["data"]
                self.assertIsInstance(
                    data, dict,
                    f"Iteration {i}: data should be a dict"
                )
                self.assertIn(
                    "settings", data,
                    f"Iteration {i}: data should contain 'settings' key"
                )
                self.assertIn(
                    "contacts", data,
                    f"Iteration {i}: data should contain 'contacts' key"
                )
                self.assertIsInstance(
                    data["settings"], list,
                    f"Iteration {i}: data.settings should be a list"
                )
                self.assertIsInstance(
                    data["contacts"], list,
                    f"Iteration {i}: data.contacts should be a list"
                )

                # ── Verify all inserted settings are present ─────────────
                exported_settings_by_id = {s["user_id"]: s for s in data["settings"]}
                self.assertEqual(
                    len(exported_settings_by_id), len(expected_settings),
                    f"Iteration {i}: expected {len(expected_settings)} settings, "
                    f"got {len(exported_settings_by_id)}"
                )

                for uid, expected in expected_settings.items():
                    self.assertIn(
                        uid, exported_settings_by_id,
                        f"Iteration {i}: settings '{uid}' missing from export"
                    )
                    exported = exported_settings_by_id[uid]

                    # Verify each field matches expected deserialized form
                    for field in SETTINGS_COLUMNS:
                        exp_val = expected[field]
                        got_val = exported.get(field)
                        self.assertEqual(
                            got_val, exp_val,
                            f"Iteration {i}, settings '{uid}', field '{field}': "
                            f"expected {exp_val!r}, got {got_val!r}"
                        )

                    # Verify JSON fields are NOT raw strings (deserialized)
                    for field in SETTINGS_JSON_FIELDS:
                        val = exported.get(field)
                        if val is not None:
                            self.assertNotIsInstance(
                                val, str,
                                f"Iteration {i}, settings '{uid}': "
                                f"'{field}' should be deserialized, not a raw string"
                            )

                    # Verify active_clocks stays as a string (or None)
                    ac = exported.get("active_clocks")
                    if ac is not None:
                        self.assertIsInstance(
                            ac, str,
                            f"Iteration {i}, settings '{uid}': "
                            f"'active_clocks' should remain a string, got {type(ac).__name__}"
                        )

                # ── Verify all inserted contacts are present ─────────────
                exported_contacts_by_id = {c["id"]: c for c in data["contacts"]}
                self.assertEqual(
                    len(exported_contacts_by_id), len(expected_contacts),
                    f"Iteration {i}: expected {len(expected_contacts)} contacts, "
                    f"got {len(exported_contacts_by_id)}"
                )

                for cid, expected in expected_contacts.items():
                    self.assertIn(
                        cid, exported_contacts_by_id,
                        f"Iteration {i}: contact {cid} missing from export"
                    )
                    exported = exported_contacts_by_id[cid]

                    # Verify each field matches expected deserialized form
                    for field in CONTACT_COLUMNS:
                        exp_val = expected[field]
                        got_val = exported.get(field)
                        self.assertEqual(
                            got_val, exp_val,
                            f"Iteration {i}, contact {cid}, field '{field}': "
                            f"expected {exp_val!r}, got {got_val!r}"
                        )

                    # Verify JSON fields are NOT raw strings (deserialized)
                    for field in CONTACT_JSON_FIELDS:
                        val = exported.get(field)
                        if val is not None:
                            self.assertNotIsInstance(
                                val, str,
                                f"Iteration {i}, contact {cid}: "
                                f"'{field}' should be deserialized, not a raw string"
                            )

                    # Verify boolean fields are native booleans
                    for field in CONTACT_BOOL_FIELDS:
                        val = exported.get(field)
                        self.assertIsInstance(
                            val, bool,
                            f"Iteration {i}, contact {cid}: "
                            f"'{field}' should be a bool, got {type(val).__name__}"
                        )

    def test_empty_db_export(self):
        """Edge case: exporting from empty settings and contacts tables returns valid envelope."""
        with tempfile.TemporaryDirectory() as tmp_dir:
            db_path = os.path.join(tmp_dir, "test.db")
            _create_test_db(db_path)

            envelope = _export_userdata_logic(db_path)

            self.assertEqual(envelope["type"], "userdata")
            self.assertIsInstance(envelope["version"], str)
            self.assertIsInstance(envelope["exported_at"], str)
            self.assertIsInstance(envelope["instance_id"], str)
            data = envelope["data"]
            self.assertIsInstance(data, dict)
            self.assertIsInstance(data["settings"], list)
            self.assertIsInstance(data["contacts"], list)
            self.assertEqual(len(data["settings"]), 0)
            self.assertEqual(len(data["contacts"]), 0)

    def test_envelope_json_serializable(self):
        """Verify the envelope can be serialized to JSON (round-trip through json.dumps/loads)."""
        iterations = 20

        for i in range(iterations):
            with tempfile.TemporaryDirectory() as tmp_dir:
                db_path = os.path.join(tmp_dir, "test.db")
                _create_test_db(db_path)

                # Insert some settings and contacts
                num_settings = random.randint(1, 2)
                for _ in range(num_settings):
                    _, raw, _ = generate_random_settings()
                    _insert_settings(db_path, raw)

                num_contacts = random.randint(1, 3)
                for _ in range(num_contacts):
                    _, raw, _ = generate_random_contact()
                    _insert_contact(db_path, raw)

                envelope = _export_userdata_logic(db_path)

                # Must be JSON-serializable with indent=2 (same as endpoint)
                try:
                    serialized = json.dumps(envelope, indent=2)
                except (TypeError, ValueError) as e:
                    self.fail(f"Iteration {i}: envelope not JSON-serializable: {e}")

                # Round-trip: parse back and compare
                parsed = json.loads(serialized)
                self.assertEqual(
                    parsed["type"], envelope["type"],
                    f"Iteration {i}: type mismatch after JSON round-trip"
                )
                self.assertEqual(
                    len(parsed["data"]["settings"]), len(envelope["data"]["settings"]),
                    f"Iteration {i}: settings length mismatch after JSON round-trip"
                )
                self.assertEqual(
                    len(parsed["data"]["contacts"]), len(envelope["data"]["contacts"]),
                    f"Iteration {i}: contacts length mismatch after JSON round-trip"
                )


if __name__ == "__main__":
    unittest.main()
