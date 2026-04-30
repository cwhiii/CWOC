"""Authentication routes for the CWOC backend.

Provides login, logout, session management, profile updates, password changes,
and user switching. Rate limiting is enforced on login attempts using an
in-memory dictionary keyed by username.
"""

import logging
import sqlite3
import time
import uuid
from datetime import datetime, timedelta
from typing import Dict, List

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse

from src.backend.auth_utils import hash_password, verify_password
from src.backend.db import DB_PATH
from src.backend.models import LoginRequest, PasswordChange, ProfileUpdate


logger = logging.getLogger(__name__)

auth_router = APIRouter(prefix="/api/auth")

# ── Rate Limiting ─────────────────────────────────────────────────────────
# In-memory dict keyed by username → list of failed attempt timestamps.
# Max 10 failures per 900-second (15-minute) window.
_login_attempts: Dict[str, List[float]] = {}
_MAX_ATTEMPTS = 10
_WINDOW_SECONDS = 900  # 15 minutes

SESSION_COOKIE_NAME = "cwoc_session"
SESSION_LIFETIME_HOURS = 24


def _check_rate_limit(username: str) -> bool:
    """Return True if the username is rate-limited (too many failed attempts)."""
    now = time.time()
    attempts = _login_attempts.get(username, [])
    # Prune attempts outside the window
    attempts = [t for t in attempts if now - t < _WINDOW_SECONDS]
    _login_attempts[username] = attempts
    return len(attempts) >= _MAX_ATTEMPTS


def _record_failed_attempt(username: str) -> None:
    """Record a failed login attempt timestamp for rate limiting."""
    now = time.time()
    if username not in _login_attempts:
        _login_attempts[username] = []
    _login_attempts[username].append(now)


def _clear_attempts(username: str) -> None:
    """Clear failed attempts on successful login."""
    _login_attempts.pop(username, None)


def _utcnow_iso() -> str:
    """Return current UTC time as ISO 8601 string with Z suffix."""
    return datetime.utcnow().isoformat() + "Z"


def _create_session(conn: sqlite3.Connection, user_id: str) -> str:
    """Create a new session row and return the token."""
    token = str(uuid.uuid4())
    now = _utcnow_iso()
    expires = (datetime.utcnow() + timedelta(hours=SESSION_LIFETIME_HOURS)).isoformat() + "Z"
    conn.execute(
        "INSERT INTO sessions (token, user_id, created_datetime, expires_datetime, last_active_datetime) "
        "VALUES (?, ?, ?, ?, ?)",
        (token, user_id, now, expires, now),
    )
    conn.commit()
    return token


def _set_session_cookie(response: JSONResponse, token: str) -> JSONResponse:
    """Set the session cookie on a response."""
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        httponly=True,
        path="/",
        samesite="lax",
    )
    return response


def _clear_session_cookie(response: JSONResponse) -> JSONResponse:
    """Clear the session cookie on a response."""
    response.delete_cookie(
        key=SESSION_COOKIE_NAME,
        path="/",
    )
    return response


# ── POST /api/auth/login ──────────────────────────────────────────────────

@auth_router.post("/login")
def login(body: LoginRequest):
    """Validate credentials, enforce rate limit, create session, set cookie."""
    username = body.username
    password = body.password

    # Check rate limit before anything else
    if _check_rate_limit(username):
        raise HTTPException(
            status_code=429,
            detail="Too many login attempts. Please wait before retrying.",
        )

    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        row = conn.execute(
            "SELECT id, username, display_name, email, password_hash, is_admin, is_active "
            "FROM users WHERE username = ?",
            (username,),
        ).fetchone()

        # Generic error for both bad username and bad password
        if row is None or not verify_password(password, row["password_hash"]):
            _record_failed_attempt(username)
            raise HTTPException(status_code=401, detail="Invalid username or password")

        # Check if account is active
        if not row["is_active"]:
            _record_failed_attempt(username)
            raise HTTPException(status_code=401, detail="Invalid username or password")

        # Success — clear rate limit and create session
        _clear_attempts(username)
        token = _create_session(conn, row["id"])

        data = {
            "user_id": row["id"],
            "username": row["username"],
            "display_name": row["display_name"],
            "is_admin": bool(row["is_admin"]),
        }
        response = JSONResponse(content=data)
        _set_session_cookie(response, token)
        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        if conn:
            conn.close()


# ── POST /api/auth/logout ─────────────────────────────────────────────────

@auth_router.post("/logout")
def logout(request: Request):
    """Read session token from cookie, delete session row, clear cookie."""
    token = request.cookies.get(SESSION_COOKIE_NAME)
    if token:
        conn = None
        try:
            conn = sqlite3.connect(DB_PATH)
            conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
            conn.commit()
        except Exception as e:
            logger.error(f"Logout error: {e}")
        finally:
            if conn:
                conn.close()

    response = JSONResponse(content={"message": "Logged out"})
    _clear_session_cookie(response)
    return response


# ── GET /api/auth/me ──────────────────────────────────────────────────────

@auth_router.get("/me")
def get_me(request: Request):
    """Return the authenticated user's profile info from request.state."""
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        row = conn.execute(
            "SELECT id, username, display_name, email, is_admin "
            "FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()

        if row is None:
            raise HTTPException(status_code=404, detail="User not found")

        return {
            "user_id": row["id"],
            "username": row["username"],
            "display_name": row["display_name"],
            "email": row["email"],
            "is_admin": bool(row["is_admin"]),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get me error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        if conn:
            conn.close()


# ── PUT /api/auth/profile ─────────────────────────────────────────────────

@auth_router.put("/profile")
def update_profile(body: ProfileUpdate, request: Request):
    """Update display_name and/or email for the authenticated user."""
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row

        # Build dynamic update
        updates = []
        params = []
        if body.display_name is not None:
            updates.append("display_name = ?")
            params.append(body.display_name)
        if body.email is not None:
            updates.append("email = ?")
            params.append(body.email)

        if not updates:
            raise HTTPException(status_code=400, detail="No fields to update")

        updates.append("modified_datetime = ?")
        params.append(_utcnow_iso())
        params.append(user_id)

        conn.execute(
            f"UPDATE users SET {', '.join(updates)} WHERE id = ?",
            params,
        )
        conn.commit()

        # Return updated profile
        row = conn.execute(
            "SELECT id, display_name, email FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()

        return {
            "user_id": row["id"],
            "display_name": row["display_name"],
            "email": row["email"],
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Profile update error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        if conn:
            conn.close()


# ── PUT /api/auth/password ────────────────────────────────────────────────

@auth_router.put("/password")
def change_password(body: PasswordChange, request: Request):
    """Require current_password verification, hash new_password, update user."""
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        row = conn.execute(
            "SELECT password_hash FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()

        if row is None:
            raise HTTPException(status_code=404, detail="User not found")

        if not verify_password(body.current_password, row["password_hash"]):
            raise HTTPException(status_code=403, detail="Current password is incorrect")

        new_hash = hash_password(body.new_password)
        conn.execute(
            "UPDATE users SET password_hash = ?, modified_datetime = ? WHERE id = ?",
            (new_hash, _utcnow_iso(), user_id),
        )
        conn.commit()

        return {"message": "Password updated"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Password change error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        if conn:
            conn.close()


# ── POST /api/auth/switch ─────────────────────────────────────────────────

@auth_router.post("/switch")
def switch_user(body: LoginRequest, request: Request):
    """Validate target user credentials, invalidate current session, create new session."""
    username = body.username
    password = body.password

    # Rate limit applies to switch as well
    if _check_rate_limit(username):
        raise HTTPException(
            status_code=429,
            detail="Too many login attempts. Please wait before retrying.",
        )

    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row

        # Validate target user credentials
        row = conn.execute(
            "SELECT id, username, display_name, email, password_hash, is_admin, is_active "
            "FROM users WHERE username = ?",
            (username,),
        ).fetchone()

        if row is None or not verify_password(password, row["password_hash"]):
            _record_failed_attempt(username)
            raise HTTPException(status_code=401, detail="Invalid username or password")

        if not row["is_active"]:
            _record_failed_attempt(username)
            raise HTTPException(status_code=401, detail="Invalid username or password")

        # Invalidate current session
        old_token = request.cookies.get(SESSION_COOKIE_NAME)
        if old_token:
            conn.execute("DELETE FROM sessions WHERE token = ?", (old_token,))

        # Create new session for target user
        _clear_attempts(username)
        token = _create_session(conn, row["id"])

        data = {
            "user_id": row["id"],
            "username": row["username"],
            "display_name": row["display_name"],
        }
        response = JSONResponse(content=data)
        _set_session_cookie(response, token)
        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Switch user error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        if conn:
            conn.close()


# ── GET /api/auth/switchable-users ────────────────────────────────────────

@auth_router.get("/switchable-users")
def list_switchable_users(request: Request):
    """Return a minimal list of active users for the user switcher.
    Available to any authenticated user (not admin-only).
    Returns only id, username, and display_name for each active user."""
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            "SELECT id, username, display_name FROM users WHERE is_active = 1 ORDER BY display_name ASC"
        ).fetchall()

        return [
            {"id": row["id"], "username": row["username"], "display_name": row["display_name"]}
            for row in rows
        ]
    except Exception as e:
        logger.error(f"List switchable users error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        if conn:
            conn.close()
