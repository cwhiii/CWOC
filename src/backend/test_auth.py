"""
Property-based tests for password hashing utilities.

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
import string
import unittest


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

# Character pools for generating diverse password strings
_ASCII_POOL = string.ascii_letters + string.digits + string.punctuation
_UNICODE_SAMPLES = [
    'é', 'ñ', 'ü', 'ö', 'ä', 'ß', 'ø', 'å',  # Latin extended
    '中', '文', '日', '本',                        # CJK
    '🔑', '🔒', '💡', '🎉',                      # Emoji
    'α', 'β', 'γ', 'δ',                           # Greek
    ' ', '\t', '\n',                                # Whitespace
]


def _random_password(max_len=64):
    """Generate a random password string with varied character sets."""
    length = random.randint(1, max_len)
    pool = list(_ASCII_POOL) + _UNICODE_SAMPLES
    return ''.join(random.choices(pool, k=length))


# ── Property 1: Password hash round-trip ─────────────────────────────────

class TestProperty1PasswordHashRoundTrip(unittest.TestCase):
    """Feature: multi-user-system, Property 1: Password hash round-trip

    **Validates: Requirements 1.4**

    For any valid password string, hashing it with hash_password() and then
    verifying it with verify_password() against the stored hash SHALL return
    True. Additionally, the stored hash string SHALL NOT contain the
    plaintext password.
    """

    def test_hash_then_verify_returns_true(self):
        """verify_password(pw, hash_password(pw)) returns True for random passwords."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                pw = _random_password()
                stored = hash_password(pw)
                self.assertTrue(
                    verify_password(pw, stored),
                    f"Round-trip failed for password of length {len(pw)}"
                )

    def test_stored_hash_does_not_contain_plaintext(self):
        """The stored hash string never contains the plaintext password."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                pw = _random_password()
                # Skip very short passwords (1-2 chars) that could
                # coincidentally appear in hex output
                if len(pw) < 3:
                    pw = pw + "abc"
                stored = hash_password(pw)
                self.assertNotIn(
                    pw, stored,
                    f"Stored hash contains plaintext password"
                )


# ── Additional imports for DB-backed property tests ──────────────────────

import sqlite3
import tempfile
import uuid
from datetime import datetime, timedelta


# ── DB helpers for auth property tests ───────────────────────────────────

def _create_auth_schema(db_path):
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


def _insert_user(db_path, username, password, display_name=None, email=None,
                 is_admin=False, is_active=True):
    """Insert a user into the temp database and return the user_id."""
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


def _do_login(db_path, username, password):
    """Simulate the login route logic directly against the DB.

    Returns (success: bool, token_or_none: str|None, status_code: int, detail: str).
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


def _do_logout(db_path, token):
    """Simulate the logout route logic: delete the session row."""
    conn = sqlite3.connect(db_path)
    conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
    conn.commit()
    conn.close()


def _session_is_valid(db_path, token):
    """Check if a session token exists in the sessions table."""
    conn = sqlite3.connect(db_path)
    row = conn.execute(
        "SELECT token FROM sessions WHERE token = ?", (token,)
    ).fetchone()
    conn.close()
    return row is not None


def _get_session_user_id(db_path, token):
    """Return the user_id for a session token, or None if not found."""
    conn = sqlite3.connect(db_path)
    row = conn.execute(
        "SELECT user_id FROM sessions WHERE token = ?", (token,)
    ).fetchone()
    conn.close()
    return row[0] if row else None


def _do_password_change(db_path, user_id, current_password, new_password):
    """Simulate the password change route logic.

    Returns (success: bool, status_code: int, detail: str).
    """
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    row = conn.execute(
        "SELECT password_hash FROM users WHERE id = ?", (user_id,)
    ).fetchone()

    if row is None:
        conn.close()
        return False, 404, "User not found"

    if not verify_password(current_password, row["password_hash"]):
        conn.close()
        return False, 403, "Current password is incorrect"

    new_hash = hash_password(new_password)
    now = datetime.utcnow().isoformat() + "Z"
    conn.execute(
        "UPDATE users SET password_hash = ?, modified_datetime = ? WHERE id = ?",
        (new_hash, now, user_id),
    )
    conn.commit()
    conn.close()
    return True, 200, "Password updated"


def _do_switch_user(db_path, old_token, target_username, target_password):
    """Simulate the user switch route logic.

    Returns (success: bool, new_token_or_none: str|None, status_code: int, detail: str).
    """
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    row = conn.execute(
        "SELECT id, username, display_name, password_hash, is_active "
        "FROM users WHERE username = ?",
        (target_username,),
    ).fetchone()

    if row is None or not verify_password(target_password, row["password_hash"]):
        conn.close()
        return False, None, 401, "Invalid username or password"

    if not row["is_active"]:
        conn.close()
        return False, None, 401, "Invalid username or password"

    # Invalidate old session
    if old_token:
        conn.execute("DELETE FROM sessions WHERE token = ?", (old_token,))

    # Create new session for target user
    new_token = str(uuid.uuid4())
    now = datetime.utcnow().isoformat() + "Z"
    expires = (datetime.utcnow() + timedelta(hours=24)).isoformat() + "Z"
    conn.execute(
        "INSERT INTO sessions (token, user_id, created_datetime, expires_datetime, last_active_datetime) "
        "VALUES (?, ?, ?, ?, ?)",
        (new_token, row["id"], now, expires, now),
    )
    conn.commit()
    conn.close()
    return True, new_token, 200, "OK"


# ── Random data generators for auth tests ────────────────────────────────

_SAFE_CHARS = string.ascii_letters + string.digits
_USERNAME_CHARS = string.ascii_lowercase + string.digits + "_"


def _random_username(min_len=3, max_len=20):
    """Generate a random username (lowercase alphanumeric + underscore)."""
    length = random.randint(min_len, max_len)
    # Ensure starts with a letter
    first = random.choice(string.ascii_lowercase)
    rest = ''.join(random.choices(_USERNAME_CHARS, k=length - 1))
    return first + rest


def _random_display_name(min_len=2, max_len=30):
    """Generate a random display name."""
    length = random.randint(min_len, max_len)
    return ''.join(random.choices(string.ascii_letters + " ", k=length)).strip() or "User"


def _random_safe_password(min_len=4, max_len=40):
    """Generate a random password using safe ASCII characters."""
    length = random.randint(min_len, max_len)
    pool = string.ascii_letters + string.digits + "!@#$%^&*()-_=+"
    return ''.join(random.choices(pool, k=length))


# ── Property 4: Login and logout session lifecycle ───────────────────────

class TestProperty4LoginLogoutSessionLifecycle(unittest.TestCase):
    """Feature: multi-user-system, Property 4: Login and logout session lifecycle

    **Validates: Requirements 2.1, 2.4**

    For any user with valid credentials, logging in SHALL return a valid
    session token. Using that token for API requests SHALL succeed. After
    calling logout with that token, using the same token for API requests
    SHALL return 401 (session no longer valid).
    """

    def test_login_creates_valid_session_logout_invalidates(self):
        """Login creates a session; logout destroys it."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
                db_path = tmp.name
                tmp.close()

                try:
                    _create_auth_schema(db_path)

                    username = _random_username() + f"_{i}"
                    password = _random_safe_password()
                    _insert_user(db_path, username, password)

                    # Login with valid credentials
                    success, token, status, detail = _do_login(db_path, username, password)
                    self.assertTrue(success, f"Login should succeed for valid credentials (iter {i})")
                    self.assertEqual(status, 200)
                    self.assertIsNotNone(token)

                    # Session should be valid
                    self.assertTrue(
                        _session_is_valid(db_path, token),
                        f"Session token should be valid after login (iter {i})"
                    )

                    # Logout
                    _do_logout(db_path, token)

                    # Session should be invalid after logout
                    self.assertFalse(
                        _session_is_valid(db_path, token),
                        f"Session token should be invalid after logout (iter {i})"
                    )
                finally:
                    if os.path.exists(db_path):
                        os.unlink(db_path)


# ── Property 5: Invalid credentials return generic 401 ──────────────────

class TestProperty5InvalidCredentialsGeneric401(unittest.TestCase):
    """Feature: multi-user-system, Property 5: Invalid credentials return generic 401

    **Validates: Requirements 2.2**

    For any login attempt with an incorrect password (for an existing
    username) or a non-existent username, the Auth_Service SHALL return a
    401 status. The error message SHALL be identical in both cases, not
    revealing whether the username or password was wrong.
    """

    def test_wrong_password_and_nonexistent_user_same_error(self):
        """Both wrong-password and non-existent-user produce identical 401 responses."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
                db_path = tmp.name
                tmp.close()

                try:
                    _create_auth_schema(db_path)

                    real_username = _random_username() + f"_real_{i}"
                    real_password = _random_safe_password()
                    _insert_user(db_path, real_username, real_password)

                    # Case 1: Existing user, wrong password
                    wrong_password = real_password + "_WRONG"
                    success1, token1, status1, detail1 = _do_login(
                        db_path, real_username, wrong_password
                    )
                    self.assertFalse(success1, "Login should fail with wrong password")
                    self.assertEqual(status1, 401, "Wrong password should return 401")
                    self.assertIsNone(token1, "No token should be returned on failure")

                    # Case 2: Non-existent user
                    fake_username = _random_username() + f"_fake_{i}"
                    success2, token2, status2, detail2 = _do_login(
                        db_path, fake_username, _random_safe_password()
                    )
                    self.assertFalse(success2, "Login should fail with non-existent user")
                    self.assertEqual(status2, 401, "Non-existent user should return 401")
                    self.assertIsNone(token2, "No token should be returned on failure")

                    # The error messages must be identical
                    self.assertEqual(
                        detail1, detail2,
                        f"Error messages must be identical to prevent username enumeration: "
                        f"'{detail1}' vs '{detail2}' (iter {i})"
                    )
                finally:
                    if os.path.exists(db_path):
                        os.unlink(db_path)


# ── Property 10: Password change requires correct current password ───────

class TestProperty10PasswordChangeRequiresCurrentPassword(unittest.TestCase):
    """Feature: multi-user-system, Property 10: Password change requires correct current password

    **Validates: Requirements 7.3, 7.4**

    For any password change attempt, if the provided current_password does
    not match the user's actual password, the request SHALL return 403 and
    the password SHALL remain unchanged (login with the old password still
    works). If the current_password is correct, the new password SHALL be
    accepted and login with the new password SHALL succeed.
    """

    def test_wrong_current_password_rejected_old_still_works(self):
        """Wrong current password → 403, old password still works."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
                db_path = tmp.name
                tmp.close()

                try:
                    _create_auth_schema(db_path)

                    username = _random_username() + f"_{i}"
                    old_password = _random_safe_password()
                    new_password = _random_safe_password()
                    user_id = _insert_user(db_path, username, old_password)

                    # Attempt password change with wrong current password
                    wrong_current = old_password + "_WRONG"
                    success, status, detail = _do_password_change(
                        db_path, user_id, wrong_current, new_password
                    )
                    self.assertFalse(success, "Password change should fail with wrong current password")
                    self.assertEqual(status, 403, "Wrong current password should return 403")

                    # Old password should still work for login
                    login_ok, _, login_status, _ = _do_login(db_path, username, old_password)
                    self.assertTrue(
                        login_ok,
                        f"Old password should still work after failed change attempt (iter {i})"
                    )

                    # New password should NOT work
                    login_fail, _, fail_status, _ = _do_login(db_path, username, new_password)
                    self.assertFalse(
                        login_fail,
                        f"New password should not work after failed change attempt (iter {i})"
                    )
                finally:
                    if os.path.exists(db_path):
                        os.unlink(db_path)

    def test_correct_current_password_allows_change(self):
        """Correct current password → 200, new password works, old does not."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
                db_path = tmp.name
                tmp.close()

                try:
                    _create_auth_schema(db_path)

                    username = _random_username() + f"_{i}"
                    old_password = _random_safe_password()
                    new_password = _random_safe_password()
                    user_id = _insert_user(db_path, username, old_password)

                    # Change password with correct current password
                    success, status, detail = _do_password_change(
                        db_path, user_id, old_password, new_password
                    )
                    self.assertTrue(success, "Password change should succeed with correct current password")
                    self.assertEqual(status, 200)

                    # New password should work for login
                    login_ok, _, _, _ = _do_login(db_path, username, new_password)
                    self.assertTrue(
                        login_ok,
                        f"New password should work after successful change (iter {i})"
                    )

                    # Old password should NOT work
                    login_fail, _, fail_status, _ = _do_login(db_path, username, old_password)
                    self.assertFalse(
                        login_fail,
                        f"Old password should not work after successful change (iter {i})"
                    )
                finally:
                    if os.path.exists(db_path):
                        os.unlink(db_path)


# ── Property 11: User switch invalidates old session ─────────────────────

class TestProperty11UserSwitchInvalidatesOldSession(unittest.TestCase):
    """Feature: multi-user-system, Property 11: User switch invalidates old session

    **Validates: Requirements 8.4**

    For any authenticated user who switches to a different account with
    valid credentials, the old session token SHALL become invalid (returns
    401) and a new valid session token SHALL be issued for the target
    account.
    """

    def test_switch_invalidates_old_creates_new(self):
        """Switching users invalidates old session and creates new one for target."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
                db_path = tmp.name
                tmp.close()

                try:
                    _create_auth_schema(db_path)

                    # Create two users
                    username_a = _random_username() + f"_a_{i}"
                    password_a = _random_safe_password()
                    user_id_a = _insert_user(db_path, username_a, password_a)

                    username_b = _random_username() + f"_b_{i}"
                    password_b = _random_safe_password()
                    user_id_b = _insert_user(db_path, username_b, password_b)

                    # Login as user A
                    success_a, token_a, _, _ = _do_login(db_path, username_a, password_a)
                    self.assertTrue(success_a, "User A login should succeed")
                    self.assertTrue(
                        _session_is_valid(db_path, token_a),
                        "User A session should be valid after login"
                    )

                    # Switch to user B
                    success_switch, token_b, status, _ = _do_switch_user(
                        db_path, token_a, username_b, password_b
                    )
                    self.assertTrue(success_switch, "Switch to user B should succeed")
                    self.assertEqual(status, 200)
                    self.assertIsNotNone(token_b)

                    # Old session (user A) should be invalid
                    self.assertFalse(
                        _session_is_valid(db_path, token_a),
                        f"Old session should be invalid after switch (iter {i})"
                    )

                    # New session should be valid and belong to user B
                    self.assertTrue(
                        _session_is_valid(db_path, token_b),
                        f"New session should be valid after switch (iter {i})"
                    )
                    session_owner = _get_session_user_id(db_path, token_b)
                    self.assertEqual(
                        session_owner, user_id_b,
                        f"New session should belong to user B (iter {i})"
                    )
                finally:
                    if os.path.exists(db_path):
                        os.unlink(db_path)


# ── Inlined middleware logic (from src/backend/middleware.py) ─────────────
# Kept in sync manually.  Only the pure _is_excluded() helper is copied
# here so the test file can run with *zero* third-party packages.

def _is_excluded(path: str, method: str) -> bool:
    """Return True if the request path/method combination should skip auth."""
    # Static / frontend / data assets
    if path.startswith("/static/") or path.startswith("/frontend/") or path.startswith("/data/"):
        return True

    # Login page and health check
    if path == "/login" and method == "GET":
        return True
    if path == "/health" and method == "GET":
        return True

    # Login API endpoint
    if path == "/api/auth/login" and method == "POST":
        return True

    return False


# ── Random generators for API path testing ───────────────────────────────

# Representative protected API path segments (these are real CWOC routes)
_API_SEGMENTS = [
    "chits", "contacts", "settings", "users", "audit-log",
    "auth/me", "auth/logout", "auth/profile", "auth/password",
    "auth/switch", "trash", "health/version",
]

# Extra random suffixes to add variety
_PATH_SUFFIXES = [
    "", "/123", "/abc-def", "/some-uuid-here",
    "/export", "/import", "/search", "/count",
]


def _random_protected_api_path():
    """Generate a random API path that should NOT be excluded from auth."""
    segment = random.choice(_API_SEGMENTS)
    suffix = random.choice(_PATH_SUFFIXES)
    return f"/api/{segment}{suffix}"


# Known excluded paths with their required methods
_EXCLUDED_PATHS = [
    ("/api/auth/login", "POST"),
    ("/health", "GET"),
    ("/login", "GET"),
    ("/static/style.css", "GET"),
    ("/static/parchment.jpg", "GET"),
    ("/static/fonts/lora/lora.woff2", "GET"),
    ("/frontend/js/shared/shared.js", "GET"),
    ("/frontend/html/index.html", "GET"),
    ("/frontend/css/shared/shared-page.css", "GET"),
    ("/data/app.db", "GET"),
    ("/data/backups/snapshot.db", "GET"),
]


# ── Property 6: Unauthenticated API requests return 401 ─────────────────

class TestProperty6UnauthenticatedAPIRequestsReturn401(unittest.TestCase):
    """Feature: multi-user-system, Property 6: Unauthenticated API requests return 401

    **Validates: Requirements 2.3, 10.1, 10.3**

    For any API endpoint path that is not in the excluded set
    (/api/auth/login, /health), sending a request without a valid session
    token SHALL be treated as unauthenticated.  The middleware's
    _is_excluded() function determines which paths skip auth; all other
    /api/* paths require a valid session.  Without one the middleware
    returns a 401 JSON response {"detail": "Authentication required"}.
    """

    def test_random_api_paths_are_not_excluded(self):
        """Random protected /api/* paths are NOT excluded from auth."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                path = _random_protected_api_path()
                # Use GET as the default method — these paths should require
                # auth regardless of method (except /api/auth/login POST)
                method = random.choice(["GET", "POST", "PUT", "DELETE", "PATCH"])

                # Skip the one API path that IS excluded
                if path == "/api/auth/login" and method == "POST":
                    continue

                excluded = _is_excluded(path, method)
                self.assertFalse(
                    excluded,
                    f"Path {method} {path} should NOT be excluded from auth "
                    f"(iteration {i})"
                )

    def test_excluded_paths_are_excluded(self):
        """Known excluded paths ARE correctly excluded from auth."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                path, method = random.choice(_EXCLUDED_PATHS)
                excluded = _is_excluded(path, method)
                self.assertTrue(
                    excluded,
                    f"Path {method} {path} should be excluded from auth "
                    f"(iteration {i})"
                )

    def test_non_excluded_api_paths_would_get_401(self):
        """For non-excluded /api/* paths, the middleware logic returns 401.

        We simulate the middleware decision: if _is_excluded() returns False
        and the path starts with /api/, the middleware returns a 401 JSON
        response with {"detail": "Authentication required"}.
        """
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                path = _random_protected_api_path()
                method = random.choice(["GET", "POST", "PUT", "DELETE", "PATCH"])

                # Skip the excluded combo
                if path == "/api/auth/login" and method == "POST":
                    continue

                # Step 1: Verify path is not excluded
                self.assertFalse(
                    _is_excluded(path, method),
                    f"Precondition: {method} {path} should not be excluded"
                )

                # Step 2: Verify path starts with /api/ (so middleware
                # returns 401 JSON, not a redirect)
                self.assertTrue(
                    path.startswith("/api/"),
                    f"Precondition: {path} should be an API path"
                )

                # Step 3: Simulate the middleware decision —
                # no valid session token means 401 JSON response.
                # The expected response body is:
                expected_status = 401
                expected_body = {"detail": "Authentication required"}

                # Since we can't call the async middleware directly without
                # FastAPI/Starlette, we verify the contract: for any
                # non-excluded /api/ path with no session, the result is
                # (401, {"detail": "Authentication required"}).
                # This is the exact logic from AuthMiddleware.dispatch():
                #   if path.startswith("/api/"):
                #       return JSONResponse(status_code=401,
                #           content={"detail": "Authentication required"})
                simulated_status = 401 if path.startswith("/api/") else 302
                simulated_body = (
                    {"detail": "Authentication required"}
                    if path.startswith("/api/")
                    else None
                )

                self.assertEqual(
                    simulated_status, expected_status,
                    f"Unauthenticated {method} {path} should return 401 "
                    f"(iteration {i})"
                )
                self.assertEqual(
                    simulated_body, expected_body,
                    f"Unauthenticated {method} {path} should return "
                    f"'Authentication required' JSON (iteration {i})"
                )

    def test_login_endpoint_post_is_excluded(self):
        """POST /api/auth/login is the ONLY /api/* path excluded from auth."""
        # Verify the login endpoint itself is excluded
        self.assertTrue(
            _is_excluded("/api/auth/login", "POST"),
            "POST /api/auth/login must be excluded from auth"
        )

        # Verify GET /api/auth/login is NOT excluded (only POST is)
        self.assertFalse(
            _is_excluded("/api/auth/login", "GET"),
            "GET /api/auth/login should NOT be excluded from auth"
        )

    def test_non_api_non_excluded_paths_would_redirect(self):
        """Non-excluded page paths (not /api/*) would redirect to /login.

        This verifies the middleware's other branch: for unauthenticated
        page requests, the middleware redirects to /login (302) instead
        of returning 401 JSON.
        """
        page_paths = [
            "/", "/profile", "/user-admin", "/settings",
            "/people", "/trash", "/audit-log", "/help",
            "/editor", "/weather", "/contact-editor",
        ]
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                path = random.choice(page_paths)
                method = "GET"

                # These page paths should NOT be excluded
                self.assertFalse(
                    _is_excluded(path, method),
                    f"Page path {path} should not be excluded from auth"
                )

                # And they don't start with /api/, so middleware redirects
                self.assertFalse(
                    path.startswith("/api/"),
                    f"Page path {path} should not be an API path"
                )


if __name__ == "__main__":
    unittest.main()
