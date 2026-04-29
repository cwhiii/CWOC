"""Property-based test for add mode chit import preserving fields with new IDs (Property 4).

**Validates: Requirements 4.4**

Uses Python stdlib only (random, string, uuid, unittest). Minimum 100 iterations.
Generates random chit envelopes, replicates the import_chits "add" mode logic
against a temp SQLite DB, and verifies:
  - Each imported chit has a NEW UUID different from the original ID in the envelope
  - All other fields (title, note, tags, checklist, people, etc.) match the original values
  - JSON fields are serialized for DB storage and correctly round-trip when deserialized
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


# ── Random data generators (same pattern as test_export_chits_property.py) ───

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


def _rand_tags():
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


def _rand_bool():
    return random.choice([True, False])


def generate_random_chit():
    """Generate a random chit dict as it would appear in an export envelope.

    Returns (original_id, chit_dict) where chit_dict has deserialized
    (native) field values — the same format the export endpoint produces.
    """
    chit_id = str(uuid4())

    tags = _maybe(_rand_tags, 0.7)
    checklist = _maybe(_rand_checklist, 0.5)
    people = _maybe(_rand_people, 0.5)
    child_chits = _maybe(_rand_child_chits, 0.4)
    alerts = _maybe(_rand_alerts, 0.5)
    recurrence_rule = _maybe(_rand_recurrence_rule, 0.4)
    recurrence_exceptions = _maybe(_rand_recurrence_exceptions, 0.3)
    weather_data = _maybe(_rand_weather_data, 0.4)

    return chit_id, {
        "id": chit_id,
        "title": _maybe(_rand_str, 0.9),
        "note": _maybe(lambda: _rand_str(5, 100), 0.6),
        "tags": tags,
        "start_datetime": _maybe(_rand_iso_datetime, 0.5),
        "end_datetime": _maybe(_rand_iso_datetime, 0.4),
        "due_datetime": _maybe(_rand_iso_datetime, 0.4),
        "completed_datetime": _maybe(_rand_iso_datetime, 0.3),
        "status": _maybe(lambda: random.choice(["ToDo", "In Progress", "Blocked", "Complete"]), 0.5),
        "priority": _maybe(lambda: random.choice(["Low", "Medium", "High", "Critical"]), 0.5),
        "severity": _maybe(lambda: random.choice(["Low", "Medium", "High"]), 0.3),
        "checklist": checklist,
        "alarm": _rand_bool(),
        "notification": _rand_bool(),
        "recurrence": _maybe(lambda: random.choice(["Daily", "Weekly", "Monthly"]), 0.3),
        "recurrence_id": _maybe(lambda: str(uuid4()), 0.2),
        "location": _maybe(lambda: _rand_str(5, 30), 0.3),
        "color": _maybe(lambda: "#" + "".join(random.choices("0123456789abcdef", k=6)), 0.3),
        "people": people,
        "pinned": _rand_bool(),
        "archived": _rand_bool(),
        "deleted": _rand_bool(),
        "created_datetime": _rand_iso_datetime(),
        "modified_datetime": _rand_iso_datetime(),
        "is_project_master": _rand_bool(),
        "child_chits": child_chits,
        "all_day": _rand_bool(),
        "alerts": alerts,
        "recurrence_rule": recurrence_rule,
        "recurrence_exceptions": recurrence_exceptions,
        "progress_percent": _maybe(lambda: random.randint(0, 100), 0.3),
        "time_estimate": _maybe(lambda: _rand_str(2, 10), 0.3),
        "weather_data": weather_data,
    }


# ── DB setup helpers ─────────────────────────────────────────────────────────

CHIT_COLUMNS = [
    "id", "title", "note", "tags", "start_datetime", "end_datetime",
    "due_datetime", "completed_datetime", "status", "priority", "severity",
    "checklist", "alarm", "notification", "recurrence", "recurrence_id",
    "location", "color", "people", "pinned", "archived", "deleted",
    "created_datetime", "modified_datetime", "is_project_master", "child_chits",
    "all_day", "alerts", "recurrence_rule", "recurrence_exceptions",
    "progress_percent", "time_estimate", "weather_data",
]

JSON_FIELDS = [
    "tags", "checklist", "people", "child_chits",
    "alerts", "recurrence_rule", "recurrence_exceptions", "weather_data",
]

BOOL_FIELDS = [
    "alarm", "notification", "pinned", "archived",
    "deleted", "is_project_master", "all_day",
]


def _create_test_db(db_path):
    """Create a fresh test database with the chits table."""
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
    conn.commit()
    conn.close()


# ── Replicated import "add" mode logic from backend/main.py ─────────────────

def _import_chits_add(db_path, chit_records):
    """Replicate the POST /api/import/chits add mode logic.

    For each chit in the envelope data, generate a new UUID and insert
    with all fields preserved (JSON fields serialized, booleans as 0/1).
    Returns a list of (original_id, new_id) tuples.
    """
    conn = sqlite3.connect(db_path)
    id_mapping = []

    for chit in chit_records:
        new_id = str(uuid4())
        original_id = chit.get("id")
        id_mapping.append((original_id, new_id))

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
    return id_mapping


def _read_all_chits(db_path):
    """Read all chits from the DB and deserialize JSON/boolean fields.

    Returns a dict keyed by chit ID with deserialized field values.
    """
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM chits")
    rows = cursor.fetchall()
    conn.close()

    result = {}
    for row in rows:
        chit = dict(row)
        for field in JSON_FIELDS:
            chit[field] = deserialize_json_field(chit.get(field))
        for field in BOOL_FIELDS:
            chit[field] = bool(chit.get(field))
        result[chit["id"]] = chit
    return result


# ── Test class ───────────────────────────────────────────────────────────────

class TestAddModeChitImportPreservesFields(unittest.TestCase):
    """Property 4: Add mode chit import preserves fields with new IDs.

    For any valid chit export envelope imported via POST /api/import/chits
    with mode "add", each imported chit SHALL be inserted with a newly
    generated UUID that differs from the original ID, and all other field
    values (title, note, tags, dates, status, priority, checklist, alerts,
    etc.) SHALL be preserved identically to the input.

    **Validates: Requirements 4.4**
    """

    def test_add_mode_chit_preserves_fields_with_new_ids(self):
        """Property test: 100 iterations with random chit envelopes."""
        iterations = 100

        for i in range(iterations):
            with tempfile.TemporaryDirectory() as tmp_dir:
                db_path = os.path.join(tmp_dir, "test.db")
                _create_test_db(db_path)

                # Generate 1-5 random chits for this iteration
                num_chits = random.randint(1, 5)
                original_chits = {}
                chit_records = []
                for _ in range(num_chits):
                    orig_id, chit = generate_random_chit()
                    original_chits[orig_id] = chit
                    chit_records.append(chit)

                # Run the import add logic
                id_mapping = _import_chits_add(db_path, chit_records)

                # Read back all chits from DB
                db_chits = _read_all_chits(db_path)

                # Verify correct number of chits inserted
                self.assertEqual(
                    len(db_chits), num_chits,
                    f"Iteration {i}: expected {num_chits} chits in DB, got {len(db_chits)}"
                )

                # Verify each imported chit
                for orig_id, new_id in id_mapping:
                    original = original_chits[orig_id]

                    # New ID must differ from original
                    self.assertNotEqual(
                        new_id, orig_id,
                        f"Iteration {i}: new ID should differ from original {orig_id}"
                    )

                    # New ID must exist in DB
                    self.assertIn(
                        new_id, db_chits,
                        f"Iteration {i}: new ID {new_id} not found in DB"
                    )

                    # Original ID must NOT exist in DB
                    self.assertNotIn(
                        orig_id, db_chits,
                        f"Iteration {i}: original ID {orig_id} should not be in DB"
                    )

                    db_chit = db_chits[new_id]

                    # Verify all non-ID fields match
                    for field in CHIT_COLUMNS:
                        if field == "id":
                            continue  # ID is expected to differ

                        expected = original[field]
                        actual = db_chit.get(field)

                        self.assertEqual(
                            actual, expected,
                            f"Iteration {i}, chit orig={orig_id}, field '{field}': "
                            f"expected {expected!r}, got {actual!r}"
                        )

                # Verify all new IDs are unique (no collisions)
                new_ids = [new_id for _, new_id in id_mapping]
                self.assertEqual(
                    len(new_ids), len(set(new_ids)),
                    f"Iteration {i}: new IDs should all be unique"
                )


if __name__ == "__main__":
    unittest.main()
