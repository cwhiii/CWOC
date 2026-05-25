"""Admin-only user management routes for the CWOC backend.

Provides endpoints for listing, creating, deactivating, reactivating,
and resetting passwords for user accounts. All endpoints require the
requesting user to be an admin (is_admin=True); non-admins receive 403.

After the unified-user-contacts migration, all user data lives in the
`contacts` table. A contact with `username IS NOT NULL` is a login user.
"""

import json
import logging
import sqlite3
import uuid
from datetime import datetime

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from src.backend.auth_utils import hash_password
from src.backend.db import DB_PATH, utcnow_iso, require_admin
from src.backend.models import UserCreate, UserResponse


class PasswordReset(BaseModel):
    new_password: str


logger = logging.getLogger(__name__)

users_router = APIRouter(prefix="/api/users")


def _user_row_to_response(row: sqlite3.Row) -> dict:
    """Convert a contacts database row (user-contact) to a UserResponse-compatible dict.

    Extracts the System email from the emails JSON array for backward compatibility.
    NEVER returns password_hash or private_pgp_key_encrypted.
    """
    # Extract email from the emails JSON array (look for "System" label)
    email = None
    emails_raw = row["emails"] if "emails" in row.keys() else None
    if emails_raw:
        try:
            emails_list = json.loads(emails_raw) if isinstance(emails_raw, str) else emails_raw
            for entry in emails_list:
                if isinstance(entry, dict) and entry.get("label") == "System":
                    email = entry.get("value")
                    break
        except (json.JSONDecodeError, TypeError):
            pass

    return {
        "id": row["id"],
        "username": row["username"],
        "display_name": row["display_name"],
        "email": email,
        "is_admin": bool(row["is_admin"]),
        "is_active": bool(row["is_active"]),
        "created_datetime": row["created_datetime"],
        "image_url": row["image_url"] if "image_url" in row.keys() else None,
    }


# ── GET /api/users ────────────────────────────────────────────────────────

@users_router.get("")
def list_users(request: Request):
    """List all users (admin only). Returns user-contacts from the contacts table."""
    require_admin(request)

    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            "SELECT id, username, display_name, emails, is_admin, is_active, "
            "created_datetime, image_url "
            "FROM contacts WHERE username IS NOT NULL ORDER BY created_datetime ASC"
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
    """Create a new user (admin only). Inserts a contact record with auth fields,
    shared_to_vault=1, and email stored in the emails JSON array with label 'System'."""
    require_admin(request)

    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row

        # Check username uniqueness (case-insensitive) against contacts table
        existing = conn.execute(
            "SELECT id FROM contacts WHERE LOWER(username) = LOWER(?)",
            (body.username,),
        ).fetchone()

        if existing:
            raise HTTPException(status_code=409, detail="Username already exists")

        user_id = str(uuid.uuid4())
        now = utcnow_iso()
        password_hash = hash_password(body.password)

        # Build emails JSON array with System label
        emails_json = []
        if body.email:
            emails_json.append({"label": "System", "value": body.email})

        conn.execute(
            "INSERT INTO contacts (id, username, display_name, emails, password_hash, "
            "is_admin, is_active, shared_to_vault, created_datetime, modified_datetime, "
            "sync_version, owner_id) "
            "VALUES (?, ?, ?, ?, ?, ?, 1, 1, ?, ?, 1, ?)",
            (
                user_id,
                body.username,
                body.display_name,
                json.dumps(emails_json),
                password_hash,
                1 if body.is_admin else 0,
                now,
                now,
                user_id,
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
    require_admin(request)

    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row

        # Verify target user-contact exists
        target = conn.execute(
            "SELECT id, is_admin, is_active FROM contacts WHERE id = ? AND username IS NOT NULL",
            (user_id,),
        ).fetchone()

        if target is None:
            raise HTTPException(status_code=404, detail="User not found")

        # Prevent deactivation of the last active admin
        if target["is_admin"]:
            active_admin_count = conn.execute(
                "SELECT COUNT(*) as cnt FROM contacts WHERE is_admin = 1 AND is_active = 1 AND username IS NOT NULL"
            ).fetchone()["cnt"]

            if active_admin_count <= 1:
                raise HTTPException(
                    status_code=400,
                    detail="Cannot deactivate the last admin account",
                )

        # Deactivate the user-contact and bump sync_version
        now = utcnow_iso()
        conn.execute(
            "UPDATE contacts SET is_active = 0, modified_datetime = ?, sync_version = sync_version + 1 "
            "WHERE id = ? AND username IS NOT NULL",
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
    """Reactivate a user (admin only). Sets is_active=True on the contact record."""
    require_admin(request)

    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row

        # Verify target user-contact exists
        target = conn.execute(
            "SELECT id FROM contacts WHERE id = ? AND username IS NOT NULL",
            (user_id,),
        ).fetchone()

        if target is None:
            raise HTTPException(status_code=404, detail="User not found")

        now = utcnow_iso()
        conn.execute(
            "UPDATE contacts SET is_active = 1, modified_datetime = ?, sync_version = sync_version + 1 "
            "WHERE id = ? AND username IS NOT NULL",
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
    """Reset a user's password (admin only). Hashes the new password and updates the contact record."""
    require_admin(request)

    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row

        # Verify target user-contact exists
        target = conn.execute(
            "SELECT id FROM contacts WHERE id = ? AND username IS NOT NULL",
            (user_id,),
        ).fetchone()

        if target is None:
            raise HTTPException(status_code=404, detail="User not found")

        now = utcnow_iso()
        password_hash = hash_password(body.new_password)
        conn.execute(
            "UPDATE contacts SET password_hash = ?, modified_datetime = ?, sync_version = sync_version + 1 "
            "WHERE id = ? AND username IS NOT NULL",
            (password_hash, now, user_id),
        )

        # Invalidate all sessions for the target user so they must log in with the new password
        conn.execute(
            "DELETE FROM sessions WHERE user_id = ?",
            (user_id,),
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
    """Update a user's profile fields (admin only). Can change username, display_name, email, is_admin.
    Updates the contact record directly. Bumps sync_version for mobile sync."""
    require_admin(request)

    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row

        target = conn.execute(
            "SELECT id, username, display_name, emails, is_admin, is_active, created_datetime, image_url "
            "FROM contacts WHERE id = ? AND username IS NOT NULL",
            (user_id,),
        ).fetchone()

        if target is None:
            raise HTTPException(status_code=404, detail="User not found")

        # Build update fields
        updates = []
        params = []

        if body.username is not None and body.username != target["username"]:
            # Check uniqueness (case-insensitive) against contacts table
            existing = conn.execute(
                "SELECT id FROM contacts WHERE LOWER(username) = LOWER(?) AND id != ?",
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
            # Update the System email in the emails JSON array
            emails_raw = target["emails"]
            try:
                emails_list = json.loads(emails_raw) if emails_raw else []
            except (json.JSONDecodeError, TypeError):
                emails_list = []

            # Replace or add the System email entry
            filtered = [e for e in emails_list if not (isinstance(e, dict) and e.get("label") == "System")]
            if body.email:
                filtered.insert(0, {"label": "System", "value": body.email})
            updates.append("emails = ?")
            params.append(json.dumps(filtered))

        if body.is_admin is not None:
            # Prevent removing admin from the last admin
            if not body.is_admin and target["is_admin"]:
                active_admin_count = conn.execute(
                    "SELECT COUNT(*) as cnt FROM contacts WHERE is_admin = 1 AND is_active = 1 AND username IS NOT NULL"
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

        now = utcnow_iso()
        updates.append("modified_datetime = ?")
        params.append(now)
        updates.append("sync_version = sync_version + 1")
        params.append(user_id)

        conn.execute(
            f"UPDATE contacts SET {', '.join(updates)} WHERE id = ? AND username IS NOT NULL",
            params,
        )
        conn.commit()

        # Re-fetch updated user-contact
        updated = conn.execute(
            "SELECT id, username, display_name, emails, is_admin, is_active, created_datetime, image_url "
            "FROM contacts WHERE id = ? AND username IS NOT NULL",
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
