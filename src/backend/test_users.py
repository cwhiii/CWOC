"""
Property-based tests for user management.

Feature: multi-user-system
Uses Python stdlib only (unittest + random) — no external libraries.
Each property test runs 100+ iterations with randomly generated inputs.

NOTE: We inline the minimal production logic (hash_password and
verify_password) to avoid importing backend.main, which pulls in FastAPI.
"""

import hashlib
import hmac
import os
import random
import re
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


# ── DB helpers ───────────────────────────────────────────────────────────

def _create_schema(db_path):
    """Create users and sessions tables in a temp database."""
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
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions (expires_datetime)")
    conn.commit()
    conn.close()


def _create_user(db_path, username, password, display_name=None, email=None,
                 is_admin=False, is_active=True):
    """Create a user in the database. Returns the user_id.

    Mirrors the logic in routes/users.py POST /api/users.
    """
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


def _read_user(db_path, user_id):
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


def _do_login(db_path, username, password):
    """Simulate the login route logic directly against the DB.

    Returns (success, token_or_none, status_code, detail).
    """
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    row = conn.execute(
        "SELECT id, username, display_name, password_hash, is_active "
        "FROM users WHERE username = ?",
        (username,),
    ).fetchone()

    if row is None or not verify_password(password, row["password_hash"]):
        conn.close()
        return False, None, 401, "Invalid username or password"

    if not row["is_active"]:
        conn.close()
        return False, None, 401, "Invalid username or password"

    # Create session
    token = str(uuid.uuid4())
    now = datetime.utcnow().isoformat() + "Z"
    expires = (datetime.utcnow() + timedelta(hours=24)).isoformat() + "Z"
    conn.execute(
        "INSERT INTO sessions (token, user_id, created_datetime, expires_datetime, last_active_datetime) "
        "VALUES (?, ?, ?, ?, ?)",
        (token, row["id"], now, expires, now),
    )
    conn.commit()
    conn.close()
    return True, token, 200, "OK"


def _deactivate_user(db_path, user_id):
    """Simulate the deactivate route logic.

    Returns (success, status_code, detail).
    Mirrors routes/users.py PUT /api/users/{user_id}/deactivate.
    """
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    target = conn.execute(
        "SELECT id, is_admin, is_active FROM users WHERE id = ?",
        (user_id,),
    ).fetchone()

    if target is None:
        conn.close()
        return False, 404, "User not found"

    # Prevent deactivation of the last active admin
    if target["is_admin"]:
        active_admin_count = conn.execute(
            "SELECT COUNT(*) as cnt FROM users WHERE is_admin = 1 AND is_active = 1"
        ).fetchone()["cnt"]

        if active_admin_count <= 1:
            conn.close()
            return False, 400, "Cannot deactivate the last admin account"

    # Deactivate the user
    now = datetime.utcnow().isoformat() + "Z"
    conn.execute(
        "UPDATE users SET is_active = 0, modified_datetime = ? WHERE id = ?",
        (now, user_id),
    )

    # Invalidate all sessions for this user
    conn.execute(
        "DELETE FROM sessions WHERE user_id = ?",
        (user_id,),
    )

    conn.commit()
    conn.close()
    return True, 200, "User deactivated"


def _reactivate_user(db_path, user_id):
    """Simulate the reactivate route logic.

    Returns (success, status_code, detail).
    Mirrors routes/users.py PUT /api/users/{user_id}/reactivate.
    """
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    target = conn.execute(
        "SELECT id FROM users WHERE id = ?",
        (user_id,),
    ).fetchone()

    if target is None:
        conn.close()
        return False, 404, "User not found"

    now = datetime.utcnow().isoformat() + "Z"
    conn.execute(
        "UPDATE users SET is_active = 1, modified_datetime = ? WHERE id = ?",
        (now, user_id),
    )
    conn.commit()
    conn.close()
    return True, 200, "User reactivated"


def _session_is_valid(db_path, token):
    """Check if a session token exists in the sessions table."""
    conn = sqlite3.connect(db_path)
    row = conn.execute(
        "SELECT token FROM sessions WHERE token = ?", (token,)
    ).fetchone()
    conn.close()
    return row is not None


def _count_user_sessions(db_path, user_id):
    """Count the number of active sessions for a user."""
    conn = sqlite3.connect(db_path)
    row = conn.execute(
        "SELECT COUNT(*) FROM sessions WHERE user_id = ?", (user_id,)
    ).fetchone()
    conn.close()
    return row[0]


def _invalidate_session(db_path, token):
    """Delete a single session token (simulates logout)."""
    conn = sqlite3.connect(db_path)
    conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
    conn.commit()
    conn.close()


# ── UUID v4 regex ────────────────────────────────────────────────────────

_UUID4_RE = re.compile(
    r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
    re.IGNORECASE,
)

# ── ISO 8601 regex (basic check) ────────────────────────────────────────

_ISO8601_RE = re.compile(
    r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?$'
)


# ── Property 2: User creation persists all required fields ───────────────

class TestProperty2UserCreationPersistsAllFields(unittest.TestCase):
    """Feature: multi-user-system, Property 2: User creation persists all required fields

    **Validates: Requirements 1.1, 1.3**

    For any valid user creation input (username, display_name, password,
    optional email), creating the user and reading it back SHALL return a
    record with a valid UUID v4 as the id, the exact username, display_name,
    and email provided, a non-empty password_hash, is_active = True, and
    valid ISO 8601 created_datetime and modified_datetime timestamps.
    """

    def test_created_user_has_all_required_fields(self):
        """Create user with random data, read back, verify all fields match."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
                db_path = tmp.name
                tmp.close()

                try:
                    _create_schema(db_path)

                    username = _random_username() + f"_{i}"
                    display_name = _random_display_name()
                    password = _random_safe_password()
                    email = _random_email() if random.random() > 0.3 else None

                    user_id = _create_user(
                        db_path, username, password,
                        display_name=display_name, email=email,
                    )

                    # Read back
                    user = _read_user(db_path, user_id)
                    self.assertIsNotNone(user, f"User should exist after creation (iter {i})")

                    # UUID v4 format
                    self.assertRegex(
                        user["id"], _UUID4_RE,
                        f"User id should be a valid UUID v4 (iter {i}): {user['id']}"
                    )

                    # Exact field matches
                    self.assertEqual(
                        user["username"], username,
                        f"Username mismatch (iter {i})"
                    )
                    self.assertEqual(
                        user["display_name"], display_name,
                        f"Display name mismatch (iter {i})"
                    )
                    self.assertEqual(
                        user["email"], email,
                        f"Email mismatch (iter {i})"
                    )

                    # Non-empty password_hash
                    self.assertTrue(
                        user["password_hash"] and len(user["password_hash"]) > 0,
                        f"password_hash should be non-empty (iter {i})"
                    )

                    # is_active defaults to True (1)
                    self.assertEqual(
                        user["is_active"], 1,
                        f"is_active should be 1 (True) for new user (iter {i})"
                    )

                    # Valid ISO 8601 timestamps
                    self.assertRegex(
                        user["created_datetime"], _ISO8601_RE,
                        f"created_datetime should be valid ISO 8601 (iter {i}): {user['created_datetime']}"
                    )
                    self.assertRegex(
                        user["modified_datetime"], _ISO8601_RE,
                        f"modified_datetime should be valid ISO 8601 (iter {i}): {user['modified_datetime']}"
                    )

                finally:
                    if os.path.exists(db_path):
                        os.unlink(db_path)


# ── Property 3: Username uniqueness ─────────────────────────────────────

class TestProperty3UsernameUniqueness(unittest.TestCase):
    """Feature: multi-user-system, Property 3: Username uniqueness

    **Validates: Requirements 1.2**

    For any username, after successfully creating a user with that username,
    attempting to create a second user with the same username (case-sensitive)
    SHALL be rejected with an error.
    """

    def test_duplicate_username_rejected(self):
        """Create user, try to create another with same username, verify rejection."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
                db_path = tmp.name
                tmp.close()

                try:
                    _create_schema(db_path)

                    username = _random_username() + f"_{i}"
                    password1 = _random_safe_password()
                    password2 = _random_safe_password()

                    # First creation should succeed
                    user_id1 = _create_user(db_path, username, password1)
                    self.assertIsNotNone(user_id1, f"First user creation should succeed (iter {i})")

                    # Second creation with same username should raise IntegrityError
                    with self.assertRaises(
                        sqlite3.IntegrityError,
                        msg=f"Duplicate username should raise IntegrityError (iter {i})"
                    ):
                        _create_user(db_path, username, password2,
                                     display_name="Different Name",
                                     email="different@example.com")

                finally:
                    if os.path.exists(db_path):
                        os.unlink(db_path)


# ── Property 13: Deactivation and reactivation lifecycle ─────────────────

class TestProperty13DeactivationReactivationLifecycle(unittest.TestCase):
    """Feature: multi-user-system, Property 13: Deactivation and reactivation lifecycle

    **Validates: Requirements 12.4, 12.5**

    For any non-last-admin user, deactivating the user SHALL invalidate all
    their active sessions and reject future login attempts. Reactivating the
    same user SHALL allow login attempts to succeed again.
    """

    def test_deactivate_invalidates_sessions_and_blocks_login_reactivate_restores(self):
        """Create non-admin user, deactivate (verify sessions deleted, login fails),
        reactivate (verify login works again)."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
                db_path = tmp.name
                tmp.close()

                try:
                    _create_schema(db_path)

                    # Create an admin user (needed so the non-admin isn't the last admin)
                    admin_username = _random_username() + f"_admin_{i}"
                    admin_password = _random_safe_password()
                    _create_user(db_path, admin_username, admin_password, is_admin=True)

                    # Create a non-admin user
                    username = _random_username() + f"_user_{i}"
                    password = _random_safe_password()
                    user_id = _create_user(db_path, username, password, is_admin=False)

                    # Login to create a session
                    success, token, status, _ = _do_login(db_path, username, password)
                    self.assertTrue(success, f"Login should succeed before deactivation (iter {i})")
                    self.assertTrue(
                        _session_is_valid(db_path, token),
                        f"Session should be valid before deactivation (iter {i})"
                    )

                    # Deactivate the user
                    deact_ok, deact_status, deact_detail = _deactivate_user(db_path, user_id)
                    self.assertTrue(deact_ok, f"Deactivation should succeed (iter {i})")
                    self.assertEqual(deact_status, 200)

                    # Session should be invalidated
                    self.assertFalse(
                        _session_is_valid(db_path, token),
                        f"Session should be invalid after deactivation (iter {i})"
                    )

                    # Login should fail for deactivated user
                    login_ok, _, login_status, _ = _do_login(db_path, username, password)
                    self.assertFalse(
                        login_ok,
                        f"Login should fail for deactivated user (iter {i})"
                    )

                    # Reactivate the user
                    react_ok, react_status, react_detail = _reactivate_user(db_path, user_id)
                    self.assertTrue(react_ok, f"Reactivation should succeed (iter {i})")
                    self.assertEqual(react_status, 200)

                    # Login should succeed again
                    login_ok2, token2, login_status2, _ = _do_login(db_path, username, password)
                    self.assertTrue(
                        login_ok2,
                        f"Login should succeed after reactivation (iter {i})"
                    )
                    self.assertIsNotNone(token2)

                finally:
                    if os.path.exists(db_path):
                        os.unlink(db_path)


# ── Property 14: Last admin protection ───────────────────────────────────

class TestProperty14LastAdminProtection(unittest.TestCase):
    """Feature: multi-user-system, Property 14: Last admin protection

    **Validates: Requirements 12.6**

    For any set of user accounts where exactly one user has is_admin = True,
    attempting to deactivate that user SHALL be rejected, ensuring the
    instance always has at least one active administrator.
    """

    def test_single_admin_cannot_be_deactivated(self):
        """Create exactly one admin user, try to deactivate, verify rejection."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
                db_path = tmp.name
                tmp.close()

                try:
                    _create_schema(db_path)

                    # Create a single admin
                    admin_username = _random_username() + f"_admin_{i}"
                    admin_password = _random_safe_password()
                    admin_id = _create_user(
                        db_path, admin_username, admin_password, is_admin=True
                    )

                    # Optionally add some non-admin users
                    num_non_admins = random.randint(0, 3)
                    for j in range(num_non_admins):
                        _create_user(
                            db_path,
                            _random_username() + f"_nonadmin_{i}_{j}",
                            _random_safe_password(),
                            is_admin=False,
                        )

                    # Try to deactivate the sole admin — should be rejected
                    deact_ok, deact_status, deact_detail = _deactivate_user(db_path, admin_id)
                    self.assertFalse(
                        deact_ok,
                        f"Deactivating the last admin should be rejected (iter {i})"
                    )
                    self.assertEqual(
                        deact_status, 400,
                        f"Should return 400 for last admin deactivation (iter {i})"
                    )
                    self.assertIn(
                        "last admin", deact_detail.lower(),
                        f"Error message should mention last admin (iter {i})"
                    )

                finally:
                    if os.path.exists(db_path):
                        os.unlink(db_path)

    def test_two_admins_one_can_be_deactivated_then_last_protected(self):
        """Create two admins, deactivate one (success), try to deactivate the
        other (rejection)."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
                db_path = tmp.name
                tmp.close()

                try:
                    _create_schema(db_path)

                    # Create two admins
                    admin1_username = _random_username() + f"_a1_{i}"
                    admin1_password = _random_safe_password()
                    admin1_id = _create_user(
                        db_path, admin1_username, admin1_password, is_admin=True
                    )

                    admin2_username = _random_username() + f"_a2_{i}"
                    admin2_password = _random_safe_password()
                    admin2_id = _create_user(
                        db_path, admin2_username, admin2_password, is_admin=True
                    )

                    # Deactivate admin1 — should succeed (admin2 still active)
                    deact_ok, deact_status, _ = _deactivate_user(db_path, admin1_id)
                    self.assertTrue(
                        deact_ok,
                        f"Deactivating first admin should succeed when second exists (iter {i})"
                    )
                    self.assertEqual(deact_status, 200)

                    # Now try to deactivate admin2 — should be rejected (last admin)
                    deact_ok2, deact_status2, deact_detail2 = _deactivate_user(db_path, admin2_id)
                    self.assertFalse(
                        deact_ok2,
                        f"Deactivating the last remaining admin should be rejected (iter {i})"
                    )
                    self.assertEqual(
                        deact_status2, 400,
                        f"Should return 400 for last admin deactivation (iter {i})"
                    )

                finally:
                    if os.path.exists(db_path):
                        os.unlink(db_path)


# ── Property 15: Multiple concurrent sessions per user ───────────────────

class TestProperty15MultipleConcurrentSessions(unittest.TestCase):
    """Feature: multi-user-system, Property 15: Multiple concurrent sessions per user

    **Validates: Requirements 3.5**

    For any user, creating multiple sessions (by logging in from different
    contexts) SHALL result in all sessions being independently valid.
    Invalidating one session SHALL NOT affect the others.
    """

    def test_multiple_sessions_independently_valid(self):
        """Create multiple sessions for same user, invalidate one, verify others
        still valid."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
                db_path = tmp.name
                tmp.close()

                try:
                    _create_schema(db_path)

                    username = _random_username() + f"_{i}"
                    password = _random_safe_password()
                    _create_user(db_path, username, password)

                    # Create multiple sessions (2 to 5)
                    num_sessions = random.randint(2, 5)
                    tokens = []
                    for _ in range(num_sessions):
                        success, token, status, _ = _do_login(db_path, username, password)
                        self.assertTrue(success, f"Login should succeed (iter {i})")
                        self.assertIsNotNone(token)
                        tokens.append(token)

                    # All sessions should be valid
                    for t in tokens:
                        self.assertTrue(
                            _session_is_valid(db_path, t),
                            f"All sessions should be valid initially (iter {i})"
                        )

                    # Pick a random session to invalidate
                    idx_to_invalidate = random.randint(0, len(tokens) - 1)
                    invalidated_token = tokens[idx_to_invalidate]
                    _invalidate_session(db_path, invalidated_token)

                    # The invalidated session should be gone
                    self.assertFalse(
                        _session_is_valid(db_path, invalidated_token),
                        f"Invalidated session should no longer be valid (iter {i})"
                    )

                    # All other sessions should still be valid
                    for j, t in enumerate(tokens):
                        if j == idx_to_invalidate:
                            continue
                        self.assertTrue(
                            _session_is_valid(db_path, t),
                            f"Session {j} should still be valid after invalidating session {idx_to_invalidate} (iter {i})"
                        )

                finally:
                    if os.path.exists(db_path):
                        os.unlink(db_path)


if __name__ == "__main__":
    unittest.main()
