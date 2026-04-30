"""
Property-based tests for multi-user migration idempotency.

Feature: multi-user-system
Uses Python stdlib only (unittest + random) — no external libraries.

The migration function is tested against a temporary SQLite database
to avoid touching the production database. DB_PATH is patched in both
src.backend.db and src.backend.migrations so all code paths use the
temp file.

We also patch CONTACT_IMAGES_DIR and os.makedirs at module level to
prevent the db.py module-level os.makedirs("/app/...") call from
failing on dev machines where /app doesn't exist.
"""

import os
import random
import sqlite3
import string
import sys
import tempfile
import unittest
from unittest.mock import patch
from uuid import uuid4

# ── Patch /app paths before importing backend modules ────────────────────
# db.py runs os.makedirs(CONTACT_IMAGES_DIR) at import time, which fails
# on dev machines. We patch it before any backend imports happen.

_original_makedirs = os.makedirs

def _safe_makedirs(name, *args, **kwargs):
    """Skip makedirs for /app paths that don't exist on dev machines."""
    if isinstance(name, str) and name.startswith("/app"):
        return
    return _original_makedirs(name, *args, **kwargs)

# Apply the patch before importing backend modules
os.makedirs = _safe_makedirs

from src.backend.migrations import migrate_add_multi_user
from src.backend import db as _db_module
from src.backend import migrations as _migrations_module

# Restore original makedirs after imports
os.makedirs = _original_makedirs


# ── Random data generators ───────────────────────────────────────────────

_PBT_ITERATIONS = 30  # Migration is heavier than pure functions; 30 is sufficient

_ASCII_POOL = string.ascii_letters + string.digits


def _random_string(min_len=1, max_len=32):
    """Generate a random alphanumeric string."""
    length = random.randint(min_len, max_len)
    return ''.join(random.choices(_ASCII_POOL, k=length))


def _random_chit_row():
    """Return a minimal chit tuple suitable for INSERT."""
    return (
        str(uuid4()),   # id
        _random_string(3, 40),  # title
        _random_string(0, 100) if random.random() > 0.3 else None,  # note
        None,  # tags
        None,  # start_datetime
        None,  # end_datetime
        None,  # due_datetime
        None,  # completed_datetime
        random.choice(["ToDo", "In Progress", "Complete", None]),  # status
        None,  # priority
        None,  # severity
        None,  # checklist
        0,     # alarm
        0,     # notification
        None,  # recurrence
        None,  # recurrence_id
        None,  # location
        None,  # color
        None,  # people
        0,     # pinned
        0,     # archived
        0,     # deleted
        "2025-01-01T00:00:00Z",  # created_datetime
        "2025-01-01T00:00:00Z",  # modified_datetime
        0,     # is_project_master
        None,  # child_chits
        0,     # all_day
        None,  # alerts
        None,  # recurrence_rule
        None,  # recurrence_exceptions
    )


def _random_contact_row():
    """Return a minimal contact tuple suitable for INSERT."""
    return (
        str(uuid4()),
        _random_string(2, 20),  # given_name
        _random_string(2, 20) if random.random() > 0.3 else None,  # surname
        None,  # middle_names
        None,  # prefix
        None,  # suffix
        None,  # display_name
        None,  # phones
        None,  # emails
        None,  # addresses
        None,  # call_signs
        None,  # x_handles
        None,  # websites
        0,     # has_signal
        None,  # pgp_key
        0,     # favorite
        "2025-01-01T00:00:00Z",  # created_datetime
        "2025-01-01T00:00:00Z",  # modified_datetime
    )


# ── Helpers ──────────────────────────────────────────────────────────────

def _create_base_schema(db_path):
    """Create the base tables that init_db() and init_contacts_table() would create."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # chits table (matches init_db in db.py)
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
        recurrence_exceptions TEXT
    )
    """)

    # settings table (matches init_db in db.py)
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
        calendar_snap TEXT DEFAULT '15'
    )
    """)

    # contacts table (matches init_contacts_table in migrations.py)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS contacts (
        id TEXT PRIMARY KEY,
        given_name TEXT NOT NULL,
        surname TEXT,
        middle_names TEXT,
        prefix TEXT,
        suffix TEXT,
        display_name TEXT,
        phones TEXT,
        emails TEXT,
        addresses TEXT,
        call_signs TEXT,
        x_handles TEXT,
        websites TEXT,
        has_signal BOOLEAN DEFAULT 0,
        pgp_key TEXT,
        favorite BOOLEAN DEFAULT 0,
        created_datetime TEXT,
        modified_datetime TEXT
    )
    """)

    # Add the username column to settings (added by migrate_add_username)
    cursor.execute("PRAGMA table_info(settings)")
    existing = {row[1] for row in cursor.fetchall()}
    if "username" not in existing:
        cursor.execute("ALTER TABLE settings ADD COLUMN username TEXT")

    conn.commit()
    conn.close()


def _seed_random_data(db_path):
    """Insert random chits, contacts, and a default_user settings row."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Insert random chits
    num_chits = random.randint(0, 10)
    for _ in range(num_chits):
        row = _random_chit_row()
        cursor.execute(
            "INSERT INTO chits VALUES (" + ",".join(["?"] * len(row)) + ")",
            row,
        )

    # Insert random contacts
    num_contacts = random.randint(0, 5)
    for _ in range(num_contacts):
        row = _random_contact_row()
        cursor.execute(
            "INSERT INTO contacts VALUES (" + ",".join(["?"] * len(row)) + ")",
            row,
        )

    # Insert default_user settings row
    display_name = _random_string(3, 20)
    cursor.execute(
        "INSERT OR IGNORE INTO settings (user_id, username) VALUES (?, ?)",
        ("default_user", display_name),
    )

    conn.commit()
    conn.close()
    return num_chits, num_contacts


def _snapshot_db(db_path):
    """Take a snapshot of the database state for comparison.

    Returns a dict with table schemas, row counts, and key data.
    """
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    snapshot = {}

    # Get all table names
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    tables = [row[0] for row in cursor.fetchall()]
    snapshot["tables"] = sorted(tables)

    # For each table, capture schema and row count
    for table in tables:
        cursor.execute(f"PRAGMA table_info({table})")
        columns = [(row[1], row[2]) for row in cursor.fetchall()]
        snapshot[f"{table}_columns"] = columns

        cursor.execute(f"SELECT COUNT(*) FROM {table}")
        snapshot[f"{table}_count"] = cursor.fetchone()[0]

    # Capture specific data points for idempotency checks
    # Users table
    if "users" in tables:
        cursor.execute("SELECT id, username, display_name, is_admin, is_active FROM users ORDER BY username")
        snapshot["users_data"] = [dict(row) for row in cursor.fetchall()]

    # Check that all chits have owner_id set
    if "chits" in tables:
        cursor.execute("SELECT COUNT(*) FROM chits WHERE owner_id IS NULL")
        snapshot["chits_null_owner"] = cursor.fetchone()[0]

    # Check that all contacts have owner_id set
    if "contacts" in tables:
        cursor.execute("PRAGMA table_info(contacts)")
        contact_cols = {row[1] for row in cursor.fetchall()}
        if "owner_id" in contact_cols:
            cursor.execute("SELECT COUNT(*) FROM contacts WHERE owner_id IS NULL")
            snapshot["contacts_null_owner"] = cursor.fetchone()[0]

    # Check settings re-keying
    if "settings" in tables:
        cursor.execute("SELECT user_id FROM settings ORDER BY user_id")
        snapshot["settings_user_ids"] = [row[0] for row in cursor.fetchall()]

    # Sessions table indexes
    if "sessions" in tables:
        cursor.execute("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='sessions' ORDER BY name")
        snapshot["sessions_indexes"] = [row[0] for row in cursor.fetchall()]

    conn.close()
    return snapshot


# ── Property 12: Migration idempotency ───────────────────────────────────

class TestProperty12MigrationIdempotency(unittest.TestCase):
    """Feature: multi-user-system, Property 12: Migration idempotency

    **Validates: Requirements 9.7**

    For any database state, running the multi-user migration function
    multiple times SHALL produce the same result as running it once,
    with no errors on subsequent runs.
    """

    def _run_migration_with_temp_db(self, db_path):
        """Run migrate_add_multi_user() with DB_PATH patched to db_path."""
        # Patch DB_PATH on the already-imported module objects directly
        old_db = _db_module.DB_PATH
        old_mig = _migrations_module.DB_PATH
        try:
            _db_module.DB_PATH = db_path
            _migrations_module.DB_PATH = db_path
            migrate_add_multi_user()
        finally:
            _db_module.DB_PATH = old_db
            _migrations_module.DB_PATH = old_mig

    def test_migration_idempotency_repeated_runs(self):
        """Running migrate_add_multi_user() N times produces the same result as once."""
        for iteration in range(_PBT_ITERATIONS):
            with self.subTest(iteration=iteration):
                # Create a fresh temp database for each iteration
                tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
                db_path = tmp.name
                tmp.close()

                try:
                    # Set up base schema and seed random data
                    _create_base_schema(db_path)
                    _seed_random_data(db_path)

                    # Run migration once and snapshot
                    self._run_migration_with_temp_db(db_path)
                    snapshot_after_first = _snapshot_db(db_path)

                    # Run migration additional times (2-5 more)
                    extra_runs = random.randint(2, 5)
                    for _ in range(extra_runs):
                        self._run_migration_with_temp_db(db_path)

                    snapshot_after_many = _snapshot_db(db_path)

                    # Verify: same tables exist
                    self.assertEqual(
                        snapshot_after_first["tables"],
                        snapshot_after_many["tables"],
                        "Table set changed after repeated migrations",
                    )

                    # Verify: same columns in each table
                    for table in snapshot_after_first["tables"]:
                        self.assertEqual(
                            snapshot_after_first[f"{table}_columns"],
                            snapshot_after_many[f"{table}_columns"],
                            f"Columns in {table} changed after repeated migrations",
                        )

                    # Verify: same row counts
                    for table in snapshot_after_first["tables"]:
                        self.assertEqual(
                            snapshot_after_first[f"{table}_count"],
                            snapshot_after_many[f"{table}_count"],
                            f"Row count in {table} changed after repeated migrations",
                        )

                    # Verify: same user data
                    self.assertEqual(
                        snapshot_after_first.get("users_data"),
                        snapshot_after_many.get("users_data"),
                        "Users data changed after repeated migrations",
                    )

                    # Verify: no null owners in chits
                    self.assertEqual(
                        snapshot_after_first.get("chits_null_owner", 0),
                        0,
                        "Some chits still have NULL owner_id after migration",
                    )
                    self.assertEqual(
                        snapshot_after_many.get("chits_null_owner", 0),
                        0,
                        "Some chits have NULL owner_id after repeated migrations",
                    )

                    # Verify: no null owners in contacts
                    self.assertEqual(
                        snapshot_after_first.get("contacts_null_owner", 0),
                        0,
                        "Some contacts still have NULL owner_id after migration",
                    )
                    self.assertEqual(
                        snapshot_after_many.get("contacts_null_owner", 0),
                        0,
                        "Some contacts have NULL owner_id after repeated migrations",
                    )

                    # Verify: settings user_ids are the same
                    self.assertEqual(
                        snapshot_after_first.get("settings_user_ids"),
                        snapshot_after_many.get("settings_user_ids"),
                        "Settings user_ids changed after repeated migrations",
                    )

                    # Verify: no 'default_user' remains in settings
                    self.assertNotIn(
                        "default_user",
                        snapshot_after_many.get("settings_user_ids", []),
                        "default_user still present in settings after migration",
                    )

                    # Verify: sessions indexes are the same
                    self.assertEqual(
                        snapshot_after_first.get("sessions_indexes"),
                        snapshot_after_many.get("sessions_indexes"),
                        "Sessions indexes changed after repeated migrations",
                    )

                    # Verify: exactly one admin user exists
                    users = snapshot_after_many.get("users_data", [])
                    admin_users = [u for u in users if u["username"] == "admin"]
                    self.assertEqual(
                        len(admin_users), 1,
                        f"Expected exactly 1 admin user, found {len(admin_users)}",
                    )

                finally:
                    # Clean up temp database
                    if os.path.exists(db_path):
                        os.unlink(db_path)


if __name__ == "__main__":
    unittest.main()
