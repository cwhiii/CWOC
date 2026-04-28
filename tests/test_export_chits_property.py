"""Property-based test for chit export completeness and correctness (Property 1).

**Validates: Requirements 2.2, 2.4, 2.5, 9.3**

Uses Python stdlib only (random, string, uuid, unittest). Minimum 100 iterations.
Generates random chit records with varied combinations of null/populated JSON fields,
inserts them into a temporary SQLite database, replicates the export_chits logic
(same deserialization + envelope building as backend/main.py), and verifies:
  - Envelope structure: type="chits", version (str), exported_at (str), instance_id (str), data (list)
  - All inserted chits appear in the export
  - JSON-serialized fields are deserialized (native objects/arrays, not raw strings)
  - Boolean fields are native booleans
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


def _export_chits_logic(db_path):
    """Replicate the GET /api/export/chits endpoint logic from backend/main.py.

    Connects to the given DB, queries all chits, deserializes JSON fields,
    converts booleans, and wraps in an export envelope.
    """
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Read instance_id
    cursor.execute("SELECT value FROM instance_meta WHERE key = 'instance_id'")
    row = cursor.fetchone()
    instance_id = row[0] if row else "unknown"

    cursor.execute("SELECT * FROM chits")
    rows = cursor.fetchall()

    chits = []
    for row in rows:
        chit = dict(row)
        # Deserialize JSON-serialized fields (same as export_chits endpoint)
        chit["tags"] = deserialize_json_field(chit.get("tags"))
        chit["checklist"] = deserialize_json_field(chit.get("checklist"))
        chit["people"] = deserialize_json_field(chit.get("people"))
        chit["child_chits"] = deserialize_json_field(chit.get("child_chits"))
        chit["alerts"] = deserialize_json_field(chit.get("alerts"))
        chit["recurrence_rule"] = deserialize_json_field(chit.get("recurrence_rule"))
        chit["recurrence_exceptions"] = deserialize_json_field(chit.get("recurrence_exceptions"))
        chit["weather_data"] = deserialize_json_field(chit.get("weather_data"))
        # Convert boolean fields to native booleans
        chit["alarm"] = bool(chit.get("alarm"))
        chit["notification"] = bool(chit.get("notification"))
        chit["pinned"] = bool(chit.get("pinned"))
        chit["archived"] = bool(chit.get("archived"))
        chit["deleted"] = bool(chit.get("deleted"))
        chit["is_project_master"] = bool(chit.get("is_project_master"))
        chit["all_day"] = bool(chit.get("all_day"))
        chits.append(chit)

    conn.close()
    return _build_export_envelope("chits", chits, instance_id)


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


def _rand_bool_int():
    return random.choice([0, 1])


def generate_random_chit():
    """Generate a random chit dict with varied null/populated field combinations.

    Returns (chit_id, raw_row_dict, expected_deserialized_dict).
    raw_row_dict has values as stored in SQLite (JSON strings, 0/1 bools).
    expected_deserialized_dict has values as they should appear in the export.
    """
    chit_id = str(uuid4())

    # JSON fields — randomly populated or null
    tags = _maybe(_rand_tags, 0.7)
    checklist = _maybe(_rand_checklist, 0.5)
    people = _maybe(_rand_people, 0.5)
    child_chits = _maybe(_rand_child_chits, 0.4)
    alerts = _maybe(_rand_alerts, 0.5)
    recurrence_rule = _maybe(_rand_recurrence_rule, 0.4)
    recurrence_exceptions = _maybe(_rand_recurrence_exceptions, 0.3)
    weather_data = _maybe(_rand_weather_data, 0.4)

    # Boolean fields (stored as 0/1 in SQLite)
    alarm = _rand_bool_int()
    notification = _rand_bool_int()
    pinned = _rand_bool_int()
    archived = _rand_bool_int()
    deleted = _rand_bool_int()
    is_project_master = _rand_bool_int()
    all_day = _rand_bool_int()

    # Text/scalar fields
    title = _maybe(_rand_str, 0.9)
    note = _maybe(lambda: _rand_str(5, 100), 0.6)
    start_datetime = _maybe(_rand_iso_datetime, 0.5)
    end_datetime = _maybe(_rand_iso_datetime, 0.4)
    due_datetime = _maybe(_rand_iso_datetime, 0.4)
    completed_datetime = _maybe(_rand_iso_datetime, 0.3)
    status = _maybe(lambda: random.choice(["ToDo", "In Progress", "Blocked", "Complete"]), 0.5)
    priority = _maybe(lambda: random.choice(["Low", "Medium", "High", "Critical"]), 0.5)
    severity = _maybe(lambda: random.choice(["Low", "Medium", "High"]), 0.3)
    recurrence = _maybe(lambda: random.choice(["Daily", "Weekly", "Monthly"]), 0.3)
    recurrence_id = _maybe(lambda: str(uuid4()), 0.2)
    location = _maybe(lambda: _rand_str(5, 30), 0.3)
    color = _maybe(lambda: "#" + "".join(random.choices("0123456789abcdef", k=6)), 0.3)
    created_datetime = _rand_iso_datetime()
    modified_datetime = _rand_iso_datetime()
    progress_percent = _maybe(lambda: random.randint(0, 100), 0.3)
    time_estimate = _maybe(lambda: _rand_str(2, 10), 0.3)

    # Raw row as stored in SQLite
    raw = {
        "id": chit_id,
        "title": title,
        "note": note,
        "tags": serialize_json_field(tags),
        "start_datetime": start_datetime,
        "end_datetime": end_datetime,
        "due_datetime": due_datetime,
        "completed_datetime": completed_datetime,
        "status": status,
        "priority": priority,
        "severity": severity,
        "checklist": serialize_json_field(checklist),
        "alarm": alarm,
        "notification": notification,
        "recurrence": recurrence,
        "recurrence_id": recurrence_id,
        "location": location,
        "color": color,
        "people": serialize_json_field(people),
        "pinned": pinned,
        "archived": archived,
        "deleted": deleted,
        "created_datetime": created_datetime,
        "modified_datetime": modified_datetime,
        "is_project_master": is_project_master,
        "child_chits": serialize_json_field(child_chits),
        "all_day": all_day,
        "alerts": serialize_json_field(alerts),
        "recurrence_rule": serialize_json_field(recurrence_rule),
        "recurrence_exceptions": serialize_json_field(recurrence_exceptions),
        "progress_percent": progress_percent,
        "time_estimate": time_estimate,
        "weather_data": serialize_json_field(weather_data),
    }

    # Expected deserialized form in the export
    expected = {
        "id": chit_id,
        "title": title,
        "note": note,
        "tags": tags,
        "start_datetime": start_datetime,
        "end_datetime": end_datetime,
        "due_datetime": due_datetime,
        "completed_datetime": completed_datetime,
        "status": status,
        "priority": priority,
        "severity": severity,
        "checklist": checklist,
        "alarm": bool(alarm),
        "notification": bool(notification),
        "recurrence": recurrence,
        "recurrence_id": recurrence_id,
        "location": location,
        "color": color,
        "people": people,
        "pinned": bool(pinned),
        "archived": bool(archived),
        "deleted": bool(deleted),
        "created_datetime": created_datetime,
        "modified_datetime": modified_datetime,
        "is_project_master": bool(is_project_master),
        "child_chits": child_chits,
        "all_day": bool(all_day),
        "alerts": alerts,
        "recurrence_rule": recurrence_rule,
        "recurrence_exceptions": recurrence_exceptions,
        "progress_percent": progress_percent,
        "time_estimate": time_estimate,
        "weather_data": weather_data,
    }

    return chit_id, raw, expected


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


def _create_test_db(db_path):
    """Create a fresh test database with the chits table and instance_meta."""
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


def _insert_chit(db_path, raw_row):
    """Insert a single chit raw row dict into the database."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    placeholders = ", ".join(["?"] * len(CHIT_COLUMNS))
    col_names = ", ".join(CHIT_COLUMNS)
    values = [raw_row.get(col) for col in CHIT_COLUMNS]
    cursor.execute(f"INSERT INTO chits ({col_names}) VALUES ({placeholders})", values)
    conn.commit()
    conn.close()


# ── Test class ───────────────────────────────────────────────────────────────

class TestChitExportCompletenessAndCorrectness(unittest.TestCase):
    """Property 1: Chit export completeness and correctness.

    For any set of chit records in the database (with any combination of
    populated and null fields, including JSON-serialized fields), calling
    the export_chits logic SHALL return a valid Export Envelope with
    type="chits", a version string, an ISO 8601 exported_at timestamp,
    an instance_id string, and a data array containing every chit record
    with all JSON-serialized fields in their deserialized (native) form.

    **Validates: Requirements 2.2, 2.4, 2.5, 9.3**
    """

    def test_chit_export_completeness(self):
        """Property test: 100 iterations with random chit data."""
        iterations = 100

        for i in range(iterations):
            with tempfile.TemporaryDirectory() as tmp_dir:
                db_path = os.path.join(tmp_dir, "test.db")
                _create_test_db(db_path)

                # Generate 1-5 random chits per iteration
                num_chits = random.randint(1, 5)
                expected_chits = {}
                for _ in range(num_chits):
                    chit_id, raw, expected = generate_random_chit()
                    _insert_chit(db_path, raw)
                    expected_chits[chit_id] = expected

                # Call the replicated export logic
                envelope = _export_chits_logic(db_path)

                # ── Verify envelope structure ────────────────────────────
                self.assertEqual(
                    envelope["type"], "chits",
                    f"Iteration {i}: envelope type should be 'chits', got '{envelope.get('type')}'"
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
                # Verify exported_at looks like ISO 8601 (ends with Z)
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
                self.assertIsInstance(
                    envelope["data"], list,
                    f"Iteration {i}: data should be a list"
                )

                # ── Verify all inserted chits are present ────────────────
                exported_by_id = {c["id"]: c for c in envelope["data"]}
                self.assertEqual(
                    len(exported_by_id), len(expected_chits),
                    f"Iteration {i}: expected {len(expected_chits)} chits, got {len(exported_by_id)}"
                )

                for chit_id, expected in expected_chits.items():
                    self.assertIn(
                        chit_id, exported_by_id,
                        f"Iteration {i}: chit {chit_id} missing from export"
                    )
                    exported = exported_by_id[chit_id]

                    # Verify each field matches expected deserialized form
                    for field in CHIT_COLUMNS:
                        exp_val = expected[field]
                        got_val = exported.get(field)
                        self.assertEqual(
                            got_val, exp_val,
                            f"Iteration {i}, chit {chit_id}, field '{field}': "
                            f"expected {exp_val!r}, got {got_val!r}"
                        )

                    # Verify JSON fields are NOT raw strings (deserialized)
                    json_fields = [
                        "tags", "checklist", "people", "child_chits",
                        "alerts", "recurrence_rule", "recurrence_exceptions",
                        "weather_data",
                    ]
                    for field in json_fields:
                        val = exported.get(field)
                        if val is not None:
                            self.assertNotIsInstance(
                                val, str,
                                f"Iteration {i}, chit {chit_id}: "
                                f"'{field}' should be deserialized, not a raw string"
                            )

                    # Verify boolean fields are native booleans
                    bool_fields = [
                        "alarm", "notification", "pinned", "archived",
                        "deleted", "is_project_master", "all_day",
                    ]
                    for field in bool_fields:
                        val = exported.get(field)
                        self.assertIsInstance(
                            val, bool,
                            f"Iteration {i}, chit {chit_id}: "
                            f"'{field}' should be a bool, got {type(val).__name__}"
                        )

    def test_empty_db_export(self):
        """Edge case: exporting from an empty chits table returns valid envelope with empty data."""
        with tempfile.TemporaryDirectory() as tmp_dir:
            db_path = os.path.join(tmp_dir, "test.db")
            _create_test_db(db_path)

            envelope = _export_chits_logic(db_path)

            self.assertEqual(envelope["type"], "chits")
            self.assertIsInstance(envelope["version"], str)
            self.assertIsInstance(envelope["exported_at"], str)
            self.assertIsInstance(envelope["instance_id"], str)
            self.assertIsInstance(envelope["data"], list)
            self.assertEqual(len(envelope["data"]), 0)

    def test_envelope_json_serializable(self):
        """Verify the envelope can be serialized to JSON (round-trip through json.dumps/loads)."""
        iterations = 20

        for i in range(iterations):
            with tempfile.TemporaryDirectory() as tmp_dir:
                db_path = os.path.join(tmp_dir, "test.db")
                _create_test_db(db_path)

                num_chits = random.randint(1, 5)
                for _ in range(num_chits):
                    _, raw, _ = generate_random_chit()
                    _insert_chit(db_path, raw)

                envelope = _export_chits_logic(db_path)

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
                    len(parsed["data"]), len(envelope["data"]),
                    f"Iteration {i}: data length mismatch after JSON round-trip"
                )


if __name__ == "__main__":
    unittest.main()
