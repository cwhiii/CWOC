"""Admin-only user management routes for the CWOC backend.

Provides endpoints for listing, creating, deactivating, reactivating,
and resetting passwords for user accounts. All endpoints require the
requesting user to be an admin (is_admin=True); non-admins receive 403.
"""

import logging
import sqlite3
import uuid
from datetime import datetime

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from src.backend.auth_utils import hash_password
from src.backend.db import DB_PATH
from src.backend.models import UserCreate, UserResponse


class PasswordReset(BaseModel):
    new_password: str


logger = logging.getLogger(__name__)

users_router = APIRouter(prefix="/api/users")


def _utcnow_iso() -> str:
    """Return current UTC time as ISO 8601 string with Z suffix."""
    return datetime.utcnow().isoformat() + "Z"


def _require_admin(request: Request) -> str:
    """Check that the requesting user is an admin. Return user_id if so, raise 403 otherwise."""
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        row = conn.execute(
            "SELECT is_admin FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()

        if row is None:
            raise HTTPException(status_code=401, detail="Authentication required")

        if not row["is_admin"]:
            raise HTTPException(status_code=403, detail="Admin access required")

        return user_id
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Admin check error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        if conn:
            conn.close()


def _user_row_to_response(row: sqlite3.Row) -> dict:
    """Convert a user database row to a UserResponse-compatible dict."""
    return {
        "id": row["id"],
        "username": row["username"],
        "display_name": row["display_name"],
        "email": row["email"],
        "is_admin": bool(row["is_admin"]),
        "is_active": bool(row["is_active"]),
        "created_datetime": row["created_datetime"],
        "profile_image_url": row["profile_image_url"] if "profile_image_url" in row.keys() else None,
    }


# ── GET /api/users ────────────────────────────────────────────────────────

@users_router.get("")
def list_users(request: Request):
    """List all users (admin only). Returns a list of UserResponse objects."""
    _require_admin(request)

    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            "SELECT id, username, display_name, email, is_admin, is_active, created_datetime, profile_image_url "
            "FROM users ORDER BY created_datetime ASC"
        ).fetchall()

        return [_user_row_to_response(row) for row in rows]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"List users error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        if conn:
            conn.close()


# ── POST /api/users ───────────────────────────────────────────────────────

@users_router.post("")
def create_user(body: UserCreate, request: Request):
    """Create a new user (admin only). Requires username, display_name, password."""
    _require_admin(request)

    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row

        # Check username uniqueness (case-insensitive)
        existing = conn.execute(
            "SELECT id FROM users WHERE LOWER(username) = LOWER(?)",
            (body.username,),
        ).fetchone()

        if existing:
            raise HTTPException(status_code=409, detail="Username already exists")

        user_id = str(uuid.uuid4())
        now = _utcnow_iso()
        password_hash = hash_password(body.password)

        conn.execute(
            "INSERT INTO users (id, username, display_name, email, password_hash, is_admin, is_active, created_datetime, modified_datetime) "
            "VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)",
            (
                user_id,
                body.username,
                body.display_name,
                body.email,
                password_hash,
                1 if body.is_admin else 0,
                now,
                now,
            ),
        )
        conn.commit()

        response_data = {
            "id": user_id,
            "username": body.username,
            "display_name": body.display_name,
            "email": body.email,
            "is_admin": bool(body.is_admin),
            "is_active": True,
            "created_datetime": now,
        }
        return JSONResponse(content=response_data, status_code=201)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Create user error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        if conn:
            conn.close()


# ── PUT /api/users/{user_id}/deactivate ───────────────────────────────────

@users_router.put("/{user_id}/deactivate")
def deactivate_user(user_id: str, request: Request):
    """Deactivate a user (admin only). Invalidates all their sessions.
    Prevents deactivation of the last active admin."""
    _require_admin(request)

    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row

        # Verify target user exists
        target = conn.execute(
            "SELECT id, is_admin, is_active FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()

        if target is None:
            raise HTTPException(status_code=404, detail="User not found")

        # Prevent deactivation of the last active admin
        if target["is_admin"]:
            active_admin_count = conn.execute(
                "SELECT COUNT(*) as cnt FROM users WHERE is_admin = 1 AND is_active = 1"
            ).fetchone()["cnt"]

            if active_admin_count <= 1:
                raise HTTPException(
                    status_code=400,
                    detail="Cannot deactivate the last admin account",
                )

        # Deactivate the user
        now = _utcnow_iso()
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
        return {"message": "User deactivated"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Deactivate user error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        if conn:
            conn.close()


# ── PUT /api/users/{user_id}/reactivate ───────────────────────────────────

@users_router.put("/{user_id}/reactivate")
def reactivate_user(user_id: str, request: Request):
    """Reactivate a user (admin only). Sets is_active=True."""
    _require_admin(request)

    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row

        # Verify target user exists
        target = conn.execute(
            "SELECT id FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()

        if target is None:
            raise HTTPException(status_code=404, detail="User not found")

        now = _utcnow_iso()
        conn.execute(
            "UPDATE users SET is_active = 1, modified_datetime = ? WHERE id = ?",
            (now, user_id),
        )
        conn.commit()

        return {"message": "User reactivated"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Reactivate user error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        if conn:
            conn.close()


# ── PUT /api/users/{user_id}/reset-password ───────────────────────────────

@users_router.put("/{user_id}/reset-password")
def reset_password(user_id: str, body: PasswordReset, request: Request):
    """Reset a user's password (admin only). Hashes the new password and updates the record."""
    _require_admin(request)

    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row

        # Verify target user exists
        target = conn.execute(
            "SELECT id FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()

        if target is None:
            raise HTTPException(status_code=404, detail="User not found")

        now = _utcnow_iso()
        password_hash = hash_password(body.new_password)
        conn.execute(
            "UPDATE users SET password_hash = ?, modified_datetime = ? WHERE id = ?",
            (password_hash, now, user_id),
        )
        conn.commit()

        return {"message": "Password reset"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Reset password error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        if conn:
            conn.close()


# ── PUT /api/users/{user_id} ──────────────────────────────────────────────

class UserUpdate(BaseModel):
    username: str = None
    display_name: str = None
    email: str = None
    is_admin: bool = None


@users_router.put("/{user_id}")
def update_user(user_id: str, body: UserUpdate, request: Request):
    """Update a user's profile fields (admin only). Can change username, display_name, email, is_admin."""
    _require_admin(request)

    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row

        target = conn.execute(
            "SELECT id, username, display_name, email, is_admin, is_active, created_datetime FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()

        if target is None:
            raise HTTPException(status_code=404, detail="User not found")

        # Build update fields
        updates = []
        params = []

        if body.username is not None and body.username != target["username"]:
            # Check uniqueness (case-insensitive)
            existing = conn.execute(
                "SELECT id FROM users WHERE LOWER(username) = LOWER(?) AND id != ?",
                (body.username, user_id),
            ).fetchone()
            if existing:
                raise HTTPException(status_code=409, detail="Username already exists")
            updates.append("username = ?")
            params.append(body.username)

        if body.display_name is not None:
            updates.append("display_name = ?")
            params.append(body.display_name)

        if body.email is not None:
            updates.append("email = ?")
            params.append(body.email)

        if body.is_admin is not None:
            # Prevent removing admin from the last admin
            if not body.is_admin and target["is_admin"]:
                active_admin_count = conn.execute(
                    "SELECT COUNT(*) as cnt FROM users WHERE is_admin = 1 AND is_active = 1"
                ).fetchone()["cnt"]
                if active_admin_count <= 1:
                    raise HTTPException(
                        status_code=400,
                        detail="Cannot remove admin from the last admin account",
                    )
            updates.append("is_admin = ?")
            params.append(1 if body.is_admin else 0)

        if not updates:
            return _user_row_to_response(target)

        now = _utcnow_iso()
        updates.append("modified_datetime = ?")
        params.append(now)
        params.append(user_id)

        conn.execute(
            f"UPDATE users SET {', '.join(updates)} WHERE id = ?",
            params,
        )
        conn.commit()

        # Re-fetch updated user
        updated = conn.execute(
            "SELECT id, username, display_name, email, is_admin, is_active, created_datetime FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()

        return _user_row_to_response(updated)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update user error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        if conn:
            conn.close()
