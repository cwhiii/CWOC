"""Property-based test for import validation rejection (Property 3).

**Validates: Requirements 4.6, 6.7, 10.3, 10.4**

Uses Python stdlib only (random, string, uuid, unittest). Minimum 100 iterations.
Generates random invalid import requests — invalid modes, mismatched envelope types,
and missing required envelope fields — replicates the validation logic from
import_chits and import_userdata endpoints against a temp SQLite DB, and verifies:
  - Each invalid request is rejected (raises ValueError)
  - The database is not modified (row counts unchanged)
"""

import json
import os
import random
import sqlite3
import string
import tempfile
import unittest
from uuid import uuid4


# ── Replicated validation logic from backend/main.py (stdlib only) ───────

REQUIRED_ENVELOPE_FIELDS = ("type", "version", "exported_at", "data")


def _validate_import_chits(mode, envelope, db_path):
    """Replicate the validation portion of POST /api/import/chits.

    Raises ValueError on invalid input (equivalent to HTTP 400).
    On valid input, performs the actual import (add or replace).
    """
    # Validate mode
    if mode not in ("add", "replace"):
        raise ValueError("Invalid mode: must be 'add' or 'replace'")

    # Validate envelope required fields
    for field in REQUIRED_ENVELOPE_FIELDS:
        if field not in envelope:
            raise ValueError("Invalid export envelope: missing required fields")

    # Validate envelope type
    if envelope.get("type") != "chits":
        raise ValueError("Invalid data: expected type 'chits'")

    records = envelope.get("data", [])
    if not isinstance(records, list):
        raise ValueError("Invalid data: expected 'data' to be a list")

    # If we get here, the request is valid — perform the import
    conn = sqlite3.connect(db_path)
    try:
        conn.execute("BEGIN")
        if mode == "replace":
            conn.execute("DELETE FROM chits")
        for chit in records:
            new_id = str(uuid4())
            conn.execute(
                "INSERT INTO chits (id, title, note) VALUES (?, ?, ?)",
                (new_id, chit.get("title"), chit.get("note")),
            )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def _validate_import_userdata(mode, envelope, db_path):
    """Replicate the validation portion of POST /api/import/userdata.

    Raises ValueError on invalid input (equivalent to HTTP 400).
    On valid input, performs the actual import (add or replace).
    """
    # Validate mode
    if mode not in ("add", "replace"):
        raise ValueError("Invalid mode: must be 'add' or 'replace'")

    # Validate envelope required fields
    for field in REQUIRED_ENVELOPE_FIELDS:
        if field not in envelope:
            raise ValueError("Invalid export envelope: missing required fields")

    # Validate envelope type
    if envelope.get("type") != "userdata":
        raise ValueError("Invalid data: expected type 'userdata'")

    payload = envelope.get("data", {})
    if not isinstance(payload, dict):
        raise ValueError("Invalid data: expected 'data' to be an object")

    # If we get here, the request is valid — perform the import
    conn = sqlite3.connect(db_path)
    try:
        conn.execute("BEGIN")
        if mode == "replace":
            conn.execute("DELETE FROM settings")
            conn.execute("DELETE FROM contacts")
        for c in payload.get("contacts", []):
            new_id = str(uuid4())
            conn.execute(
                "INSERT INTO contacts (id, given_name) VALUES (?, ?)",
                (new_id, c.get("given_name", "Unknown")),
            )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# ── DB setup helpers ─────────────────────────────────────────────────────

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
        tags TEXT,
        custom_colors TEXT,
        saved_locations TEXT
    )
    """)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS contacts (
        id TEXT PRIMARY KEY,
        given_name TEXT NOT NULL,
        surname TEXT,
        display_name TEXT,
        phones TEXT,
        emails TEXT,
        addresses TEXT,
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


def _seed_db(db_path, num_chits=3, num_contacts=2):
    """Insert some seed records so we can verify they're untouched after rejection."""
    conn = sqlite3.connect(db_path)
    for _ in range(num_chits):
        conn.execute(
            "INSERT INTO chits (id, title) VALUES (?, ?)",
            (str(uuid4()), f"seed-chit-{uuid4().hex[:6]}"),
        )
    conn.execute(
        "INSERT OR IGNORE INTO settings (user_id, time_format) VALUES ('default_user', '24hour')"
    )
    for _ in range(num_contacts):
        conn.execute(
            "INSERT INTO contacts (id, given_name) VALUES (?, ?)",
            (str(uuid4()), f"Contact-{uuid4().hex[:6]}"),
        )
    conn.commit()
    conn.close()


def _count_rows(db_path, table):
    conn = sqlite3.connect(db_path)
    count = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
    conn.close()
    return count


# ── Random data generators ───────────────────────────────────────────────

def _rand_str(min_len=1, max_len=20):
    length = random.randint(min_len, max_len)
    return "".join(random.choices(string.ascii_letters + string.digits + " _-", k=length))


def _rand_invalid_mode():
    """Generate a mode string that is NOT 'add' or 'replace'."""
    while True:
        mode = _rand_str(1, 15)
        if mode not in ("add", "replace"):
            return mode


def _rand_valid_envelope(data_type):
    """Build a structurally valid envelope for the given type."""
    if data_type == "chits":
        data = [{"title": _rand_str(), "note": _rand_str()} for _ in range(random.randint(0, 3))]
    else:
        data = {
            "settings": [{"user_id": "default_user", "time_format": "12hour"}],
            "contacts": [{"given_name": _rand_str()} for _ in range(random.randint(0, 3))],
        }
    return {
        "type": data_type,
        "version": "20260101.0000",
        "exported_at": "2026-01-01T00:00:00Z",
        "instance_id": str(uuid4()),
        "data": data,
    }


def _rand_mismatched_type(expected_type):
    """Generate a type string that does NOT match the expected type."""
    while True:
        t = random.choice(["chits", "userdata", _rand_str(2, 12)])
        if t != expected_type:
            return t


def _rand_envelope_missing_field(data_type):
    """Build an envelope with one required field randomly removed."""
    envelope = _rand_valid_envelope(data_type)
    field_to_remove = random.choice(list(REQUIRED_ENVELOPE_FIELDS))
    del envelope[field_to_remove]
    return envelope, field_to_remove


# ── Test class ───────────────────────────────────────────────────────────

class TestImportValidationRejectsInvalid(unittest.TestCase):
    """Property 3: Import validation rejects invalid requests.

    For any import request where the mode is not "add" or "replace",
    or where the envelope type does not match the endpoint's expected type,
    or where required envelope fields are missing, the backend SHALL return
    HTTP 400 (ValueError in our replicated logic) and make no changes to
    the database.

    **Validates: Requirements 4.6, 6.7, 10.3, 10.4**
    """

    def test_import_validation_rejects_invalid(self):
        """Property test: 100+ iterations with random invalid import requests."""
        iterations = 100

        for i in range(iterations):
            with tempfile.TemporaryDirectory() as tmp_dir:
                db_path = os.path.join(tmp_dir, "test.db")
                _create_test_db(db_path)

                num_chits = random.randint(1, 5)
                num_contacts = random.randint(1, 4)
                _seed_db(db_path, num_chits=num_chits, num_contacts=num_contacts)

                # Snapshot row counts before any invalid request
                chits_before = _count_rows(db_path, "chits")
                settings_before = _count_rows(db_path, "settings")
                contacts_before = _count_rows(db_path, "contacts")

                # Pick a random invalid scenario
                scenario = random.choice([
                    "invalid_mode_chits",
                    "invalid_mode_userdata",
                    "mismatched_type_chits",
                    "mismatched_type_userdata",
                    "missing_field_chits",
                    "missing_field_userdata",
                ])

                if scenario == "invalid_mode_chits":
                    mode = _rand_invalid_mode()
                    envelope = _rand_valid_envelope("chits")
                    with self.assertRaises(
                        ValueError,
                        msg=f"Iteration {i} ({scenario}): invalid mode '{mode}' should be rejected",
                    ):
                        _validate_import_chits(mode, envelope, db_path)

                elif scenario == "invalid_mode_userdata":
                    mode = _rand_invalid_mode()
                    envelope = _rand_valid_envelope("userdata")
                    with self.assertRaises(
                        ValueError,
                        msg=f"Iteration {i} ({scenario}): invalid mode '{mode}' should be rejected",
                    ):
                        _validate_import_userdata(mode, envelope, db_path)

                elif scenario == "mismatched_type_chits":
                    mode = random.choice(["add", "replace"])
                    envelope = _rand_valid_envelope("chits")
                    envelope["type"] = _rand_mismatched_type("chits")
                    with self.assertRaises(
                        ValueError,
                        msg=f"Iteration {i} ({scenario}): type '{envelope['type']}' should be rejected for chits import",
                    ):
                        _validate_import_chits(mode, envelope, db_path)

                elif scenario == "mismatched_type_userdata":
                    mode = random.choice(["add", "replace"])
                    envelope = _rand_valid_envelope("userdata")
                    envelope["type"] = _rand_mismatched_type("userdata")
                    with self.assertRaises(
                        ValueError,
                        msg=f"Iteration {i} ({scenario}): type '{envelope['type']}' should be rejected for userdata import",
                    ):
                        _validate_import_userdata(mode, envelope, db_path)

                elif scenario == "missing_field_chits":
                    mode = random.choice(["add", "replace"])
                    envelope, removed = _rand_envelope_missing_field("chits")
                    with self.assertRaises(
                        ValueError,
                        msg=f"Iteration {i} ({scenario}): missing '{removed}' should be rejected for chits import",
                    ):
                        _validate_import_chits(mode, envelope, db_path)

                elif scenario == "missing_field_userdata":
                    mode = random.choice(["add", "replace"])
                    envelope, removed = _rand_envelope_missing_field("userdata")
                    with self.assertRaises(
                        ValueError,
                        msg=f"Iteration {i} ({scenario}): missing '{removed}' should be rejected for userdata import",
                    ):
                        _validate_import_userdata(mode, envelope, db_path)

                # Verify DB was NOT modified
                chits_after = _count_rows(db_path, "chits")
                settings_after = _count_rows(db_path, "settings")
                contacts_after = _count_rows(db_path, "contacts")

                self.assertEqual(
                    chits_before, chits_after,
                    f"Iteration {i} ({scenario}): chits count changed from {chits_before} to {chits_after}",
                )
                self.assertEqual(
                    settings_before, settings_after,
                    f"Iteration {i} ({scenario}): settings count changed from {settings_before} to {settings_after}",
                )
                self.assertEqual(
                    contacts_before, contacts_after,
                    f"Iteration {i} ({scenario}): contacts count changed from {contacts_before} to {contacts_after}",
                )


if __name__ == "__main__":
    unittest.main()
