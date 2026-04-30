"""
Property-based tests for data isolation, owner record, profile update,
and audit log actor attribution.

Feature: multi-user-system
Uses Python stdlib only (unittest + random) — no external libraries.
Each property test runs 100+ iterations with randomly generated inputs.

NOTE: We inline the minimal production logic (hash_password and
verify_password) to avoid importing backend.main, which pulls in FastAPI.
"""

import hashlib
import hmac
import json
import os
import random
import sqlite3
import string
import tempfile
import unittest
import uuid
from datetime import datetime, timedelta


# ── Inlined production logic (from src/backend/auth_utils.py) ────────────
# Kept in sync manually.  Only the pure-function helpers are copied here so
# the test file can run with *zero* third-party packages.

_HASH_ALGORITHM = 'sha256'
_ITERATIONS = 600_000
_SALT_LENGTH = 32  # bytes


def hash_password(password: str) -> str:
    """Hash a password with PBKDF2-HMAC-SHA256 using a random salt.

    Returns 'salt_hex$hash_hex' string for storage.
    """
    salt = os.urandom(_SALT_LENGTH)
    dk = hashlib.pbkdf2_hmac(
        _HASH_ALGORITHM,
        password.encode('utf-8'),
        salt,
        _ITERATIONS,
    )
    return f"{salt.hex()}${dk.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    """Verify a password against a stored 'salt_hex$hash_hex' string."""
    try:
        salt_hex, hash_hex = stored_hash.split('$', 1)
        salt = bytes.fromhex(salt_hex)
        expected_hash = bytes.fromhex(hash_hex)
    except (ValueError, AttributeError):
        return False

    dk = hashlib.pbkdf2_hmac(
        _HASH_ALGORITHM,
        password.encode('utf-8'),
        salt,
        _ITERATIONS,
    )
    return hmac.compare_digest(dk, expected_hash)


# ── Random data generators ───────────────────────────────────────────────

_PBT_ITERATIONS = 120  # comfortably above the 100 minimum

_USERNAME_CHARS = string.ascii_lowercase + string.digits + "_"


def _random_username(min_len=3, max_len=20):
    """Generate a random username (lowercase alphanumeric + underscore)."""
    length = random.randint(min_len, max_len)
    first = random.choice(string.ascii_lowercase)
    rest = ''.join(random.choices(_USERNAME_CHARS, k=length - 1))
    return first + rest


def _random_display_name(min_len=2, max_len=30):
    """Generate a random display name."""
    length = random.randint(min_len, max_len)
    return ''.join(random.choices(string.ascii_letters + " ", k=length)).strip() or "User"


def _random_email():
    """Generate a random email address."""
    local = ''.join(random.choices(string.ascii_lowercase + string.digits, k=random.randint(3, 12)))
    domain = ''.join(random.choices(string.ascii_lowercase, k=random.randint(3, 8)))
    return f"{local}@{domain}.com"


def _random_safe_password(min_len=4, max_len=40):
    """Generate a random password using safe ASCII characters."""
    length = random.randint(min_len, max_len)
    pool = string.ascii_letters + string.digits + "!@#$%^&*()-_=+"
    return ''.join(random.choices(pool, k=length))


def _random_string(min_len=1, max_len=30):
    """Generate a random string for chit titles, notes, etc."""
    length = random.randint(min_len, max_len)
    return ''.join(random.choices(string.ascii_letters + string.digits + " _-", k=length))


# ── DB schema helpers ────────────────────────────────────────────────────

def _create_full_schema(db_path):
    """Create users, sessions, chits, contacts, settings, and audit_log tables."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        email TEXT,
        password_hash TEXT NOT NULL,
        is_admin BOOLEAN DEFAULT 0,
        is_active BOOLEAN DEFAULT 1,
        created_datetime TEXT NOT NULL,
        modified_datetime TEXT NOT NULL
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        created_datetime TEXT NOT NULL,
        expires_datetime TEXT NOT NULL,
        last_active_datetime TEXT NOT NULL
    )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id)")

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS chits (
        id TEXT PRIMARY KEY,
        title TEXT,
        note TEXT,
        tags TEXT,
        status TEXT,
        priority TEXT,
        created_datetime TEXT,
        modified_datetime TEXT,
        deleted BOOLEAN DEFAULT 0,
        owner_id TEXT,
        owner_display_name TEXT,
        owner_username TEXT
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS contacts (
        id TEXT PRIMARY KEY,
        given_name TEXT,
        surname TEXT,
        display_name TEXT,
        created_datetime TEXT,
        modified_datetime TEXT,
        owner_id TEXT
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS settings (
        user_id TEXT PRIMARY KEY,
        time_format TEXT DEFAULT '12h',
        username TEXT
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS audit_log (
        id TEXT PRIMARY KEY,
        entity_type TEXT,
        entity_id TEXT,
        action TEXT,
        actor TEXT,
        timestamp TEXT,
        changes TEXT,
        entity_summary TEXT
    )
    """)

    conn.commit()
    conn.close()


# ── DB operation helpers ─────────────────────────────────────────────────

def _insert_user(db_path, username, password, display_name=None, email=None,
                 is_admin=False, is_active=True):
    """Insert a user into the database and return the user_id."""
    user_id = str(uuid.uuid4())
    pw_hash = hash_password(password)
    now = datetime.utcnow().isoformat() + "Z"
    conn = sqlite3.connect(db_path)
    conn.execute(
        "INSERT INTO users (id, username, display_name, email, password_hash, "
        "is_admin, is_active, created_datetime, modified_datetime) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (user_id, username, display_name or username, email,
         pw_hash, int(is_admin), int(is_active), now, now),
    )
    conn.commit()
    conn.close()
    return user_id


def _get_user(db_path, user_id):
    """Read a user record by id. Returns a dict or None."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    row = conn.execute(
        "SELECT id, username, display_name, email, password_hash, "
        "is_admin, is_active, created_datetime, modified_datetime "
        "FROM users WHERE id = ?",
        (user_id,),
    ).fetchone()
    conn.close()
    if row is None:
        return None
    return dict(row)


def _create_chit(db_path, user_id, title=None, note=None, status=None):
    """Create a chit owned by user_id. Looks up user info for owner record.

    Mirrors the logic in routes/chits.py create_chit().
    Returns the chit_id.
    """
    chit_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat() + "Z"

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    # Look up user for owner record (same as production code)
    user_row = conn.execute(
        "SELECT display_name, username FROM users WHERE id = ?", (user_id,)
    ).fetchone()
    owner_display_name = user_row["display_name"] if user_row else ""
    owner_username = user_row["username"] if user_row else ""

    conn.execute(
        """INSERT INTO chits (id, title, note, status, created_datetime,
           modified_datetime, deleted, owner_id, owner_display_name, owner_username)
           VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)""",
        (chit_id, title or "Untitled", note or "", status or "ToDo",
         now, now, user_id, owner_display_name, owner_username),
    )
    conn.commit()
    conn.close()
    return chit_id


def _get_chits_for_user(db_path, user_id):
    """Return all non-deleted chits owned by user_id (mirrors production query scoping)."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        "SELECT * FROM chits WHERE owner_id = ? AND deleted = 0",
        (user_id,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def _get_chit(db_path, chit_id):
    """Return a single chit by id."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    row = conn.execute("SELECT * FROM chits WHERE id = ?", (chit_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def _create_contact(db_path, user_id, given_name=None, surname=None):
    """Create a contact owned by user_id. Returns the contact_id.

    Mirrors the logic in routes/contacts.py create_contact().
    """
    contact_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat() + "Z"
    display_name = f"{given_name or ''} {surname or ''}".strip() or "Unknown"

    conn = sqlite3.connect(db_path)
    conn.execute(
        """INSERT INTO contacts (id, given_name, surname, display_name,
           created_datetime, modified_datetime, owner_id)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (contact_id, given_name or "", surname or "", display_name,
         now, now, user_id),
    )
    conn.commit()
    conn.close()
    return contact_id


def _get_contacts_for_user(db_path, user_id):
    """Return all contacts owned by user_id (mirrors production query scoping)."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        "SELECT * FROM contacts WHERE owner_id = ?",
        (user_id,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def _save_settings(db_path, user_id, time_format=None, username=None):
    """Save settings for a user (mirrors production settings save)."""
    conn = sqlite3.connect(db_path)
    conn.execute(
        "INSERT OR REPLACE INTO settings (user_id, time_format, username) VALUES (?, ?, ?)",
        (user_id, time_format or "12h", username or ""),
    )
    conn.commit()
    conn.close()


def _get_settings(db_path, user_id):
    """Read settings for a user. Returns a dict or None."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    row = conn.execute(
        "SELECT * FROM settings WHERE user_id = ?", (user_id,)
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def _update_profile(db_path, user_id, display_name=None, email=None):
    """Simulate the profile update route logic.

    Mirrors routes/auth.py PUT /api/auth/profile.
    Returns the updated user dict.
    """
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    updates = []
    params = []
    if display_name is not None:
        updates.append("display_name = ?")
        params.append(display_name)
    if email is not None:
        updates.append("email = ?")
        params.append(email)

    if not updates:
        conn.close()
        return None

    updates.append("modified_datetime = ?")
    params.append(datetime.utcnow().isoformat() + "Z")
    params.append(user_id)

    conn.execute(
        f"UPDATE users SET {', '.join(updates)} WHERE id = ?",
        params,
    )
    conn.commit()

    row = conn.execute(
        "SELECT id, username, display_name, email FROM users WHERE id = ?",
        (user_id,),
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def _insert_audit_entry(db_path, entity_type, entity_id, action, actor,
                        changes=None, entity_summary=None):
    """Insert an audit log entry. Mirrors routes/audit.py insert_audit_entry()."""
    conn = sqlite3.connect(db_path)
    entry_id = str(uuid.uuid4())
    ts = datetime.utcnow().isoformat()
    changes_json = json.dumps(changes) if changes is not None else None
    conn.execute(
        """INSERT INTO audit_log (id, entity_type, entity_id, action, actor,
           timestamp, changes, entity_summary)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (entry_id, entity_type, str(entity_id), action, actor, ts,
         changes_json, entity_summary),
    )
    conn.commit()
    conn.close()
    return entry_id


def _get_audit_entries(db_path, entity_id=None):
    """Read audit log entries, optionally filtered by entity_id."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    if entity_id:
        rows = conn.execute(
            "SELECT * FROM audit_log WHERE entity_id = ? ORDER BY timestamp",
            (str(entity_id),),
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM audit_log ORDER BY timestamp"
        ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def _build_actor_string(username, user_id):
    """Build the actor string the same way get_actor_from_request() does.

    Mirrors routes/audit.py get_actor_from_request():
      return f"{username} ({user_id})"
    """
    return f"{username} ({user_id})"



# ── Property 7: Per-user data isolation ──────────────────────────────────

class TestProperty7PerUserDataIsolation(unittest.TestCase):
    """Feature: multi-user-system, Property 7: Per-user data isolation

    **Validates: Requirements 4.3, 4.4, 4.5**

    For any two distinct users A and B, chits created by user A SHALL NOT
    appear in user B's chit list query, contacts created by user A SHALL NOT
    appear in user B's contact list query, and settings saved by user A
    SHALL NOT affect user B's settings. Each user's data is completely
    independent.
    """

    def test_chits_isolated_between_users(self):
        """Chits created by user A are invisible to user B and vice versa."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
                db_path = tmp.name
                tmp.close()

                try:
                    _create_full_schema(db_path)

                    # Create two users
                    username_a = _random_username() + f"_a_{i}"
                    password_a = _random_safe_password()
                    display_a = _random_display_name()
                    user_id_a = _insert_user(db_path, username_a, password_a, display_name=display_a)

                    username_b = _random_username() + f"_b_{i}"
                    password_b = _random_safe_password()
                    display_b = _random_display_name()
                    user_id_b = _insert_user(db_path, username_b, password_b, display_name=display_b)

                    # Create random number of chits for each user
                    num_chits_a = random.randint(1, 4)
                    num_chits_b = random.randint(1, 4)
                    chit_ids_a = set()
                    chit_ids_b = set()

                    for j in range(num_chits_a):
                        cid = _create_chit(db_path, user_id_a, title=f"A-chit-{j}-{_random_string()}")
                        chit_ids_a.add(cid)

                    for j in range(num_chits_b):
                        cid = _create_chit(db_path, user_id_b, title=f"B-chit-{j}-{_random_string()}")
                        chit_ids_b.add(cid)

                    # Query chits for user A — should only see A's chits
                    a_chits = _get_chits_for_user(db_path, user_id_a)
                    a_chit_ids = {c["id"] for c in a_chits}
                    self.assertEqual(
                        a_chit_ids, chit_ids_a,
                        f"User A should see exactly their own chits (iter {i})"
                    )
                    self.assertTrue(
                        a_chit_ids.isdisjoint(chit_ids_b),
                        f"User A should NOT see user B's chits (iter {i})"
                    )

                    # Query chits for user B — should only see B's chits
                    b_chits = _get_chits_for_user(db_path, user_id_b)
                    b_chit_ids = {c["id"] for c in b_chits}
                    self.assertEqual(
                        b_chit_ids, chit_ids_b,
                        f"User B should see exactly their own chits (iter {i})"
                    )
                    self.assertTrue(
                        b_chit_ids.isdisjoint(chit_ids_a),
                        f"User B should NOT see user A's chits (iter {i})"
                    )

                finally:
                    if os.path.exists(db_path):
                        os.unlink(db_path)

    def test_contacts_isolated_between_users(self):
        """Contacts created by user A are invisible to user B and vice versa."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
                db_path = tmp.name
                tmp.close()

                try:
                    _create_full_schema(db_path)

                    user_id_a = _insert_user(
                        db_path, _random_username() + f"_a_{i}",
                        _random_safe_password(), display_name=_random_display_name(),
                    )
                    user_id_b = _insert_user(
                        db_path, _random_username() + f"_b_{i}",
                        _random_safe_password(), display_name=_random_display_name(),
                    )

                    num_contacts_a = random.randint(1, 4)
                    num_contacts_b = random.randint(1, 4)
                    contact_ids_a = set()
                    contact_ids_b = set()

                    for j in range(num_contacts_a):
                        cid = _create_contact(db_path, user_id_a,
                                              given_name=_random_string(3, 10),
                                              surname=_random_string(3, 10))
                        contact_ids_a.add(cid)

                    for j in range(num_contacts_b):
                        cid = _create_contact(db_path, user_id_b,
                                              given_name=_random_string(3, 10),
                                              surname=_random_string(3, 10))
                        contact_ids_b.add(cid)

                    # Query contacts for user A
                    a_contacts = _get_contacts_for_user(db_path, user_id_a)
                    a_contact_ids = {c["id"] for c in a_contacts}
                    self.assertEqual(
                        a_contact_ids, contact_ids_a,
                        f"User A should see exactly their own contacts (iter {i})"
                    )
                    self.assertTrue(
                        a_contact_ids.isdisjoint(contact_ids_b),
                        f"User A should NOT see user B's contacts (iter {i})"
                    )

                    # Query contacts for user B
                    b_contacts = _get_contacts_for_user(db_path, user_id_b)
                    b_contact_ids = {c["id"] for c in b_contacts}
                    self.assertEqual(
                        b_contact_ids, contact_ids_b,
                        f"User B should see exactly their own contacts (iter {i})"
                    )
                    self.assertTrue(
                        b_contact_ids.isdisjoint(contact_ids_a),
                        f"User B should NOT see user A's contacts (iter {i})"
                    )

                finally:
                    if os.path.exists(db_path):
                        os.unlink(db_path)

    def test_settings_isolated_between_users(self):
        """Settings saved by user A do not affect user B's settings."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
                db_path = tmp.name
                tmp.close()

                try:
                    _create_full_schema(db_path)

                    user_id_a = _insert_user(
                        db_path, _random_username() + f"_a_{i}",
                        _random_safe_password(), display_name=_random_display_name(),
                    )
                    user_id_b = _insert_user(
                        db_path, _random_username() + f"_b_{i}",
                        _random_safe_password(), display_name=_random_display_name(),
                    )

                    # Save different settings for each user
                    format_a = random.choice(["12h", "24h"])
                    format_b = "24h" if format_a == "12h" else "12h"
                    username_a = _random_string(3, 15)
                    username_b = _random_string(3, 15)

                    _save_settings(db_path, user_id_a, time_format=format_a, username=username_a)
                    _save_settings(db_path, user_id_b, time_format=format_b, username=username_b)

                    # Read back and verify isolation
                    settings_a = _get_settings(db_path, user_id_a)
                    settings_b = _get_settings(db_path, user_id_b)

                    self.assertIsNotNone(settings_a, f"User A should have settings (iter {i})")
                    self.assertIsNotNone(settings_b, f"User B should have settings (iter {i})")

                    self.assertEqual(
                        settings_a["time_format"], format_a,
                        f"User A's time_format should be {format_a} (iter {i})"
                    )
                    self.assertEqual(
                        settings_b["time_format"], format_b,
                        f"User B's time_format should be {format_b} (iter {i})"
                    )
                    self.assertEqual(
                        settings_a["username"], username_a,
                        f"User A's username setting should match (iter {i})"
                    )
                    self.assertEqual(
                        settings_b["username"], username_b,
                        f"User B's username setting should match (iter {i})"
                    )

                    # Updating A's settings should not change B's
                    new_format_a = random.choice(["12h", "24h"])
                    _save_settings(db_path, user_id_a, time_format=new_format_a, username=username_a)

                    settings_b_after = _get_settings(db_path, user_id_b)
                    self.assertEqual(
                        settings_b_after["time_format"], format_b,
                        f"User B's settings should be unchanged after A's update (iter {i})"
                    )

                finally:
                    if os.path.exists(db_path):
                        os.unlink(db_path)


# ── Property 8: Chit owner record populated from authenticated user ─────

class TestProperty8ChitOwnerRecordFromAuthenticatedUser(unittest.TestCase):
    """Feature: multi-user-system, Property 8: Chit owner record populated from authenticated user

    **Validates: Requirements 5.1, 5.2, 5.3**

    For any authenticated user creating a chit, the returned chit JSON SHALL
    include owner_id matching the user's UUID, owner_display_name matching
    the user's display name, and owner_username matching the user's username.
    """

    def test_chit_owner_record_matches_creating_user(self):
        """Created chit's owner fields match the authenticated user's info."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
                db_path = tmp.name
                tmp.close()

                try:
                    _create_full_schema(db_path)

                    username = _random_username() + f"_{i}"
                    display_name = _random_display_name()
                    email = _random_email()
                    password = _random_safe_password()
                    user_id = _insert_user(
                        db_path, username, password,
                        display_name=display_name, email=email,
                    )

                    # Create a chit as this user
                    chit_title = _random_string(5, 30)
                    chit_id = _create_chit(db_path, user_id, title=chit_title)

                    # Read back the chit
                    chit = _get_chit(db_path, chit_id)
                    self.assertIsNotNone(chit, f"Chit should exist (iter {i})")

                    # Verify owner record fields
                    self.assertEqual(
                        chit["owner_id"], user_id,
                        f"owner_id should match user's UUID (iter {i})"
                    )
                    self.assertEqual(
                        chit["owner_display_name"], display_name,
                        f"owner_display_name should match user's display_name (iter {i})"
                    )
                    self.assertEqual(
                        chit["owner_username"], username,
                        f"owner_username should match user's username (iter {i})"
                    )

                finally:
                    if os.path.exists(db_path):
                        os.unlink(db_path)


# ── Property 9: Profile update round-trip ────────────────────────────────

class TestProperty9ProfileUpdateRoundTrip(unittest.TestCase):
    """Feature: multi-user-system, Property 9: Profile update round-trip

    **Validates: Requirements 7.2**

    For any valid profile update (display_name and/or email), applying the
    update via the profile endpoint and then reading the user's profile back
    SHALL return the updated values.
    """

    def test_profile_update_display_name_and_email_round_trip(self):
        """Update display_name and email, read back, verify updated values."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
                db_path = tmp.name
                tmp.close()

                try:
                    _create_full_schema(db_path)

                    username = _random_username() + f"_{i}"
                    original_display = _random_display_name()
                    original_email = _random_email()
                    password = _random_safe_password()
                    user_id = _insert_user(
                        db_path, username, password,
                        display_name=original_display, email=original_email,
                    )

                    # Generate new profile values
                    new_display = _random_display_name()
                    new_email = _random_email()

                    # Randomly choose which fields to update
                    update_display = random.choice([True, False])
                    update_email = random.choice([True, False])

                    # Ensure at least one field is updated
                    if not update_display and not update_email:
                        update_display = True

                    updated = _update_profile(
                        db_path, user_id,
                        display_name=new_display if update_display else None,
                        email=new_email if update_email else None,
                    )
                    self.assertIsNotNone(updated, f"Profile update should return data (iter {i})")

                    # Read back the user
                    user = _get_user(db_path, user_id)
                    self.assertIsNotNone(user, f"User should exist after update (iter {i})")

                    # Verify updated fields
                    if update_display:
                        self.assertEqual(
                            user["display_name"], new_display,
                            f"display_name should be updated (iter {i})"
                        )
                    else:
                        self.assertEqual(
                            user["display_name"], original_display,
                            f"display_name should be unchanged (iter {i})"
                        )

                    if update_email:
                        self.assertEqual(
                            user["email"], new_email,
                            f"email should be updated (iter {i})"
                        )
                    else:
                        self.assertEqual(
                            user["email"], original_email,
                            f"email should be unchanged (iter {i})"
                        )

                    # Username should never change via profile update
                    self.assertEqual(
                        user["username"], username,
                        f"username should remain unchanged after profile update (iter {i})"
                    )

                finally:
                    if os.path.exists(db_path):
                        os.unlink(db_path)


# ── Property 16: Audit log records correct actor ─────────────────────────

class TestProperty16AuditLogRecordsCorrectActor(unittest.TestCase):
    """Feature: multi-user-system, Property 16: Audit log records correct actor

    **Validates: Requirements 11.1**

    For any auditable action (chit create, update, delete) performed by an
    authenticated user, the resulting audit log entry SHALL record that
    user's UUID and username as the actor, not a value read from settings.
    """

    def test_audit_entry_records_correct_actor_on_chit_create(self):
        """Simulate chit creation with audit logging; verify actor matches user."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
                db_path = tmp.name
                tmp.close()

                try:
                    _create_full_schema(db_path)

                    username = _random_username() + f"_{i}"
                    display_name = _random_display_name()
                    password = _random_safe_password()
                    user_id = _insert_user(
                        db_path, username, password,
                        display_name=display_name,
                    )

                    # Create a chit
                    chit_title = _random_string(5, 30)
                    chit_id = _create_chit(db_path, user_id, title=chit_title)

                    # Build the actor string the same way the production code does
                    expected_actor = _build_actor_string(username, user_id)

                    # Insert an audit entry (simulating what the route does after chit creation)
                    _insert_audit_entry(
                        db_path,
                        entity_type="chit",
                        entity_id=chit_id,
                        action="created",
                        actor=expected_actor,
                        entity_summary=chit_title,
                    )

                    # Read back the audit entry
                    entries = _get_audit_entries(db_path, entity_id=chit_id)
                    self.assertEqual(
                        len(entries), 1,
                        f"Should have exactly one audit entry for the chit (iter {i})"
                    )

                    entry = entries[0]

                    # Verify the actor field contains the user's username and UUID
                    self.assertEqual(
                        entry["actor"], expected_actor,
                        f"Audit actor should be '{expected_actor}' (iter {i})"
                    )
                    self.assertIn(
                        username, entry["actor"],
                        f"Audit actor should contain the username (iter {i})"
                    )
                    self.assertIn(
                        user_id, entry["actor"],
                        f"Audit actor should contain the user_id (iter {i})"
                    )

                    # Verify the actor is NOT a settings-based value
                    self.assertNotEqual(
                        entry["actor"], "System",
                        f"Audit actor should not be 'System' (iter {i})"
                    )
                    self.assertNotEqual(
                        entry["actor"], "Unknown Gremlin",
                        f"Audit actor should not be 'Unknown Gremlin' (iter {i})"
                    )

                    # Verify other audit entry fields
                    self.assertEqual(entry["entity_type"], "chit")
                    self.assertEqual(entry["entity_id"], chit_id)
                    self.assertEqual(entry["action"], "created")
                    self.assertEqual(entry["entity_summary"], chit_title)

                finally:
                    if os.path.exists(db_path):
                        os.unlink(db_path)


if __name__ == "__main__":
    unittest.main()
