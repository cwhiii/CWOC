"""Authentication routes for the CWOC backend.

Provides login, logout, session management, profile updates, password changes,
and user switching. Rate limiting is enforced on login attempts using an
in-memory dictionary keyed by username.
"""

import logging
import os
import sqlite3
import time
import uuid
from datetime import datetime, timedelta
from typing import Dict, List

from fastapi import APIRouter, HTTPException, Request, UploadFile, File
from fastapi.responses import JSONResponse

from src.backend.auth_utils import hash_password, verify_password
from src.backend.db import DB_PATH, USER_IMAGES_DIR
from src.backend.models import LoginRequest, PasswordChange, ProfileUpdate, PrivatePgpKeyRequest


logger = logging.getLogger(__name__)

auth_router = APIRouter(prefix="/api/auth")

# ── Rate Limiting ─────────────────────────────────────────────────────────
# In-memory dict keyed by username → list of failed attempt timestamps.
# Max 10 failures per 900-second (15-minute) window.
_login_attempts: Dict[str, List[float]] = {}
_MAX_ATTEMPTS = 10
_WINDOW_SECONDS = 900  # 15 minutes

SESSION_COOKIE_NAME = "cwoc_session"
SESSION_LIFETIME_HOURS = 24  # Default fallback


def _get_session_lifetime_hours(conn: sqlite3.Connection, user_id: str) -> int:
    """Read the session_lifetime setting for a user. Returns hours (0 = never expire)."""
    try:
        row = conn.execute(
            "SELECT session_lifetime FROM settings WHERE user_id = ?",
            (user_id,),
        ).fetchone()
        if row and row[0]:
            val = int(row[0])
            return val  # 0 means never expire
    except Exception:
        pass
    return SESSION_LIFETIME_HOURS


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
    lifetime_hours = _get_session_lifetime_hours(conn, user_id)
    if lifetime_hours == 0:
        # Never expire: set expiry far in the future (10 years)
        expires = (datetime.utcnow() + timedelta(days=3650)).isoformat() + "Z"
    else:
        expires = (datetime.utcnow() + timedelta(hours=lifetime_hours)).isoformat() + "Z"
    conn.execute(
        "INSERT INTO sessions (token, user_id, created_datetime, expires_datetime, last_active_datetime) "
        "VALUES (?, ?, ?, ?, ?)",
        (token, user_id, now, expires, now),
    )
    conn.commit()
    return token


def _set_session_cookie(response: JSONResponse, token: str, lifetime_hours: int = SESSION_LIFETIME_HOURS) -> JSONResponse:
    """Set the session cookie on a response."""
    if lifetime_hours == 0:
        max_age = 3650 * 24 * 3600  # ~10 years
    else:
        max_age = lifetime_hours * 3600
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=True,
        path="/",
        samesite="lax",
        max_age=max_age,
    )
    return response


def _clear_session_cookie(response: JSONResponse) -> JSONResponse:
    """Clear the session cookie on a response."""
    response.delete_cookie(
        key=SESSION_COOKIE_NAME,
        path="/",
        secure=True,
    )
    return response


# ── POST /api/auth/login ──────────────────────────────────────────────────

@auth_router.post("/login")
def login(body: LoginRequest):
    """Validate credentials, enforce rate limit, create session, set cookie."""
    username = body.username
    password = body.password

    # Normalize username for case-insensitive comparison
    username_lower = username.strip().lower()

    # Check rate limit before anything else
    if _check_rate_limit(username_lower):
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
            "FROM users WHERE LOWER(username) = ?",
            (username_lower,),
        ).fetchone()

        # Generic error for both bad username and bad password
        if row is None or not verify_password(password, row["password_hash"]):
            _record_failed_attempt(username_lower)
            raise HTTPException(status_code=401, detail="Invalid username or password")

        # Check if account is active
        if not row["is_active"]:
            _record_failed_attempt(username_lower)
            raise HTTPException(status_code=401, detail="Invalid username or password")

        # Success — clear rate limit and create session
        _clear_attempts(username_lower)
        lifetime_hours = _get_session_lifetime_hours(conn, row["id"])
        token = _create_session(conn, row["id"])

        data = {
            "user_id": row["id"],
            "username": row["username"],
            "display_name": row["display_name"],
            "is_admin": bool(row["is_admin"]),
        }
        response = JSONResponse(content=data)
        _set_session_cookie(response, token, lifetime_hours)
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


# ── User profile helper ────────────────────────────────────────────────────

def _user_profile_dict(row, is_self=None):
    """Convert a user DB row to a full profile dict with all contact-like fields."""
    from src.backend.db import deserialize_json_field
    keys = row.keys() if hasattr(row, 'keys') else []
    def _get(field, default=None):
        return row[field] if field in keys else default
    result = {
        "user_id": row["id"],
        "username": row["username"],
        "display_name": row["display_name"],
        "email": row["email"],
        "is_admin": bool(row["is_admin"]),
        "profile_image_url": _get("profile_image_url"),
        "created_datetime": _get("created_datetime"),
        "phones": deserialize_json_field(_get("phones")),
        "emails_json": deserialize_json_field(_get("emails_json")),
        "addresses": deserialize_json_field(_get("addresses")),
        "call_signs": deserialize_json_field(_get("call_signs")),
        "x_handles": deserialize_json_field(_get("x_handles")),
        "websites": deserialize_json_field(_get("websites")),
        "organization": _get("organization"),
        "social_context": _get("social_context"),
        "notes": _get("notes"),
        "nickname": _get("nickname"),
        "given_name": _get("given_name"),
        "surname": _get("surname"),
        "middle_names": _get("middle_names"),
        "prefix": _get("prefix"),
        "suffix": _get("suffix"),
        "has_signal": bool(_get("has_signal")),
        "signal_username": _get("signal_username"),
        "pgp_key": _get("pgp_key"),
        "has_private_pgp_key": bool(_get("private_pgp_key_encrypted")),
        "color": _get("color"),
        "tags": deserialize_json_field(_get("tags")),
    }
    if is_self is not None:
        result["is_self"] = is_self
    return result


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
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()

        if row is None:
            raise HTTPException(status_code=404, detail="User not found")

        return _user_profile_dict(row)
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
        if body.nickname is not None:
            updates.append("nickname = ?")
            params.append(body.nickname)
        if body.organization is not None:
            updates.append("organization = ?")
            params.append(body.organization)
        if body.social_context is not None:
            updates.append("social_context = ?")
            params.append(body.social_context)
        if body.notes is not None:
            updates.append("notes = ?")
            params.append(body.notes)

        from src.backend.db import serialize_json_field
        if body.phones is not None:
            updates.append("phones = ?")
            params.append(serialize_json_field(body.phones))
        if body.emails_json is not None:
            updates.append("emails_json = ?")
            params.append(serialize_json_field(body.emails_json))
        if body.addresses is not None:
            updates.append("addresses = ?")
            params.append(serialize_json_field(body.addresses))
        if body.call_signs is not None:
            updates.append("call_signs = ?")
            params.append(serialize_json_field(body.call_signs))
        if body.x_handles is not None:
            updates.append("x_handles = ?")
            params.append(serialize_json_field(body.x_handles))
        if body.websites is not None:
            updates.append("websites = ?")
            params.append(serialize_json_field(body.websites))

        # Name fields
        if body.given_name is not None:
            updates.append("given_name = ?")
            params.append(body.given_name)
        if body.surname is not None:
            updates.append("surname = ?")
            params.append(body.surname)
        if body.middle_names is not None:
            updates.append("middle_names = ?")
            params.append(body.middle_names)
        if body.prefix is not None:
            updates.append("prefix = ?")
            params.append(body.prefix)
        if body.suffix is not None:
            updates.append("suffix = ?")
            params.append(body.suffix)

        # Security fields
        if body.has_signal is not None:
            updates.append("has_signal = ?")
            params.append(1 if body.has_signal else 0)
        if body.signal_username is not None:
            updates.append("signal_username = ?")
            params.append(body.signal_username)
        if body.pgp_key is not None:
            updates.append("pgp_key = ?")
            params.append(body.pgp_key)

        # Color and tags
        if body.color is not None:
            updates.append("color = ?")
            params.append(body.color)
        if body.tags is not None:
            updates.append("tags = ?")
            params.append(serialize_json_field(body.tags))

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
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return _user_profile_dict(row)
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


# ── POST /api/auth/private-pgp-key — Retrieve private PGP key (password required) ──

@auth_router.post("/private-pgp-key")
def get_private_pgp_key(body: PrivatePgpKeyRequest, request: Request):
    """Retrieve the user's private PGP key after password verification.

    Requires ``password`` field. Returns the decrypted private key only
    if the password matches.
    """
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        row = conn.execute(
            "SELECT password_hash, private_pgp_key_encrypted FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()

        if row is None:
            raise HTTPException(status_code=404, detail="User not found")

        if not verify_password(body.password, row["password_hash"]):
            raise HTTPException(status_code=403, detail="Incorrect password")

        encrypted_key = row["private_pgp_key_encrypted"]
        if not encrypted_key:
            return {"private_pgp_key": None}

        # Decrypt the stored key
        from src.backend.routes.email import _decrypt_password
        try:
            decrypted = _decrypt_password(encrypted_key)
        except Exception as e:
            logger.error(f"Failed to decrypt private PGP key: {e}")
            raise HTTPException(status_code=500, detail="Failed to decrypt key")

        return {"private_pgp_key": decrypted}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get private PGP key error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        if conn:
            conn.close()


# ── PUT /api/auth/private-pgp-key — Save private PGP key (password required) ──

@auth_router.put("/private-pgp-key")
def save_private_pgp_key(body: PrivatePgpKeyRequest, request: Request):
    """Save or update the user's private PGP key after password verification.

    Requires ``password`` and optionally ``private_pgp_key`` fields.
    The key is encrypted at rest using Fernet. Send ``private_pgp_key: null``
    or empty string to remove the stored key.
    """
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

        if not verify_password(body.password, row["password_hash"]):
            raise HTTPException(status_code=403, detail="Incorrect password")

        # Encrypt and store (or clear if empty/null)
        encrypted_value = None
        if body.private_pgp_key and body.private_pgp_key.strip():
            from src.backend.routes.email import _encrypt_password
            encrypted_value = _encrypt_password(body.private_pgp_key.strip())

        conn.execute(
            "UPDATE users SET private_pgp_key_encrypted = ?, modified_datetime = ? WHERE id = ?",
            (encrypted_value, _utcnow_iso(), user_id),
        )
        conn.commit()

        return {"message": "Private PGP key saved" if encrypted_value else "Private PGP key removed"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Save private PGP key error: {e}")
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

    # Normalize username for case-insensitive comparison
    username_lower = username.strip().lower()

    # Rate limit applies to switch as well
    if _check_rate_limit(username_lower):
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
            "FROM users WHERE LOWER(username) = ?",
            (username_lower,),
        ).fetchone()

        if row is None or not verify_password(password, row["password_hash"]):
            _record_failed_attempt(username_lower)
            raise HTTPException(status_code=401, detail="Invalid username or password")

        if not row["is_active"]:
            _record_failed_attempt(username_lower)
            raise HTTPException(status_code=401, detail="Invalid username or password")

        # Invalidate current session
        old_token = request.cookies.get(SESSION_COOKIE_NAME)
        if old_token:
            conn.execute("DELETE FROM sessions WHERE token = ?", (old_token,))

        # Create new session for target user
        _clear_attempts(username_lower)
        lifetime_hours = _get_session_lifetime_hours(conn, row["id"])
        token = _create_session(conn, row["id"])

        data = {
            "user_id": row["id"],
            "username": row["username"],
            "display_name": row["display_name"],
        }
        response = JSONResponse(content=data)
        _set_session_cookie(response, token, lifetime_hours)
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
    from src.backend.db import deserialize_json_field

    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            "SELECT id, username, display_name, email, emails_json, profile_image_url, color FROM users WHERE is_active = 1 ORDER BY display_name ASC"
        ).fetchall()

        return [
            {
                "id": row["id"],
                "username": row["username"],
                "display_name": row["display_name"],
                "email": row["email"] if "email" in row.keys() else None,
                "emails_json": deserialize_json_field(row["emails_json"] if "emails_json" in row.keys() else None),
                "profile_image_url": row["profile_image_url"] if "profile_image_url" in row.keys() else None,
                "color": row["color"] if "color" in row.keys() else None,
            }
            for row in rows
        ]
    except Exception as e:
        logger.error(f"List switchable users error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        if conn:
            conn.close()


# ── POST /api/auth/profile-image ──────────────────────────────────────────

@auth_router.post("/profile-image")
async def upload_profile_image(request: Request, file: UploadFile = File(...)):
    """Upload a profile image for the authenticated user. Stores in data/users/profile_pictures/."""
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    allowed = {"image/jpeg", "image/png", "image/gif", "image/webp"}
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, GIF, and WebP images are allowed")

    ext_map = {"image/jpeg": ".jpg", "image/png": ".png", "image/gif": ".gif", "image/webp": ".webp"}
    ext = ext_map.get(file.content_type, ".jpg")
    filename = f"{user_id}{ext}"
    filepath = os.path.join(USER_IMAGES_DIR, filename)

    # Remove old images with different extensions
    for old_ext in ext_map.values():
        old_path = os.path.join(USER_IMAGES_DIR, f"{user_id}{old_ext}")
        if os.path.exists(old_path) and old_path != filepath:
            os.remove(old_path)

    conn = None
    try:
        contents = await file.read()
        with open(filepath, "wb") as f:
            f.write(contents)

        image_url = f"/data/users/profile_pictures/{filename}"

        conn = sqlite3.connect(DB_PATH)
        conn.execute(
            "UPDATE users SET profile_image_url = ?, modified_datetime = ? WHERE id = ?",
            (image_url, datetime.utcnow().isoformat() + "Z", user_id),
        )
        conn.commit()

        return {"profile_image_url": image_url}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Profile image upload error: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload image")
    finally:
        if conn:
            conn.close()


# ── DELETE /api/auth/profile-image ────────────────────────────────────────

@auth_router.delete("/profile-image")
def delete_profile_image(request: Request):
    """Remove the authenticated user's profile image."""
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        row = conn.execute("SELECT profile_image_url FROM users WHERE id = ?", (user_id,)).fetchone()

        if row and row["profile_image_url"]:
            # Delete the file
            filepath = "/app" + row["profile_image_url"]
            if os.path.exists(filepath):
                os.remove(filepath)

        conn.execute(
            "UPDATE users SET profile_image_url = NULL, modified_datetime = ? WHERE id = ?",
            (datetime.utcnow().isoformat() + "Z", user_id),
        )
        conn.commit()

        return {"message": "Profile image removed"}
    except Exception as e:
        logger.error(f"Profile image delete error: {e}")
        raise HTTPException(status_code=500, detail="Failed to remove image")
    finally:
        if conn:
            conn.close()


# ── GET /api/auth/user-profile/{user_id} ──────────────────────────────────

@auth_router.get("/user-profile/{target_user_id}")
def get_user_profile(target_user_id: str, request: Request):
    """Return a user's public profile info. Any authenticated user can view."""
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        row = conn.execute(
            "SELECT * FROM users WHERE id = ? AND is_active = 1",
            (target_user_id,),
        ).fetchone()

        if row is None:
            raise HTTPException(status_code=404, detail="User not found")

        return _user_profile_dict(row, is_self=(row["id"] == user_id))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get user profile error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        if conn:
            conn.close()


# ── GET /api/auth/login-message ───────────────────────────────────────────

@auth_router.get("/login-message")
def get_login_message():
    """Return the login welcome message and instance name. Public endpoint (no auth required)."""
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        row = conn.execute("SELECT message, instance_name FROM login_message WHERE id = 1").fetchone()
        return {
            "message": row["message"] if row else "",
            "instance_name": row["instance_name"] if row else ""
        }
    except Exception as e:
        logger.error(f"Get login message error: {e}")
        return {"message": ""}
    finally:
        if conn:
            conn.close()


# ── POST /api/auth/login-message ──────────────────────────────────────────

@auth_router.post("/login-message")
def save_login_message(body: dict, request: Request):
    """Save the login welcome message. Admin only."""
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        user = conn.execute("SELECT is_admin FROM users WHERE id = ?", (user_id,)).fetchone()
        if not user or not user["is_admin"]:
            raise HTTPException(status_code=403, detail="Admin access required")
        message = body.get("message", "")
        instance_name = body.get("instance_name", "")
        now = datetime.utcnow().isoformat() + "Z"
        conn.execute("UPDATE login_message SET message = ?, instance_name = ?, modified_datetime = ? WHERE id = 1", (message, instance_name, now))
        conn.commit()
        return {"message": message, "instance_name": instance_name}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Save login message error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        if conn:
            conn.close()
