"""Device token management routes for the CWOC backend.

Provides endpoints for creating device tokens (mobile app authentication),
listing registered devices, revoking device tokens, and renaming devices.
"""

import hashlib
import logging
import secrets
import sqlite3
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional

from src.backend.auth_utils import verify_password
from src.backend.db import DB_PATH, utcnow_iso


logger = logging.getLogger(__name__)

devices_router = APIRouter()


# ── Pydantic Models ───────────────────────────────────────────────────────

class DeviceTokenRequest(BaseModel):
    username: str
    password: str
    device_name: Optional[str] = "Unknown Device"


class DeviceRenameRequest(BaseModel):
    device_name: str


# ── POST /api/auth/device-token ───────────────────────────────────────────

@devices_router.post("/api/auth/device-token")
def create_device_token(body: DeviceTokenRequest):
    """Validate credentials and issue a new device token.

    This endpoint does NOT require an existing session — it uses
    username/password directly (same as login). The raw token is returned
    exactly once; only the sha256 hash is stored on the server.
    """
    username = body.username.strip().lower()
    device_name = body.device_name or "Unknown Device"

    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row

        # Validate credentials (same logic as login)
        row = conn.execute(
            "SELECT id, username, password_hash, is_active "
            "FROM users WHERE LOWER(username) = ?",
            (username,),
        ).fetchone()

        if row is None or not verify_password(body.password, row["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid username or password")

        if not row["is_active"]:
            raise HTTPException(status_code=401, detail="Invalid username or password")

        # Generate token
        raw_token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()

        # Store in device_tokens table
        device_id = str(uuid4())
        now = utcnow_iso()

        conn.execute(
            "INSERT INTO device_tokens (id, user_id, token_hash, device_name, "
            "created_datetime, last_seen_datetime, last_sync_version, revoked) "
            "VALUES (?, ?, ?, ?, ?, ?, 0, 0)",
            (device_id, row["id"], token_hash, device_name, now, now),
        )
        conn.commit()

        return {
            "device_id": device_id,
            "token": raw_token,
            "device_name": device_name,
            "created_datetime": now,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Create device token error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        if conn:
            conn.close()


# ── GET /api/devices ──────────────────────────────────────────────────────

@devices_router.get("/api/devices")
def list_devices(request: Request):
    """Return all non-revoked device tokens for the authenticated user.

    Returns id, device_name, created_datetime, last_seen_datetime,
    last_sync_version — never the token itself.
    """
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row

        rows = conn.execute(
            "SELECT id, device_name, created_datetime, last_seen_datetime, last_sync_version "
            "FROM device_tokens WHERE user_id = ? AND revoked = 0 "
            "ORDER BY created_datetime DESC",
            (user_id,),
        ).fetchall()

        return [
            {
                "id": row["id"],
                "device_name": row["device_name"],
                "created_datetime": row["created_datetime"],
                "last_seen_datetime": row["last_seen_datetime"],
                "last_sync_version": row["last_sync_version"],
            }
            for row in rows
        ]

    except Exception as e:
        logger.error(f"List devices error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        if conn:
            conn.close()


# ── DELETE /api/devices/{device_id} ───────────────────────────────────────

@devices_router.delete("/api/devices/{device_id}")
def revoke_device(device_id: str, request: Request):
    """Revoke a device token (sets revoked=1). Immediately rejects future requests."""
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row

        # Verify the device belongs to this user
        row = conn.execute(
            "SELECT id, user_id FROM device_tokens WHERE id = ?",
            (device_id,),
        ).fetchone()

        if row is None:
            raise HTTPException(status_code=404, detail="Device not found")

        if row["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Not authorized to revoke this device")

        conn.execute(
            "UPDATE device_tokens SET revoked = 1 WHERE id = ?",
            (device_id,),
        )
        conn.commit()

        return {"message": "Device revoked"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Revoke device error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        if conn:
            conn.close()


# ── PATCH /api/devices/{device_id} ────────────────────────────────────────

@devices_router.patch("/api/devices/{device_id}")
def rename_device(device_id: str, body: DeviceRenameRequest, request: Request):
    """Update the device_name for a registered device token."""
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    if not body.device_name or not body.device_name.strip():
        raise HTTPException(status_code=400, detail="device_name is required")

    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row

        # Verify the device belongs to this user
        row = conn.execute(
            "SELECT id, user_id, revoked FROM device_tokens WHERE id = ?",
            (device_id,),
        ).fetchone()

        if row is None:
            raise HTTPException(status_code=404, detail="Device not found")

        if row["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Not authorized to rename this device")

        if row["revoked"]:
            raise HTTPException(status_code=400, detail="Cannot rename a revoked device")

        conn.execute(
            "UPDATE device_tokens SET device_name = ? WHERE id = ?",
            (body.device_name.strip(), device_id),
        )
        conn.commit()

        return {"message": "Device renamed", "device_name": body.device_name.strip()}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Rename device error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        if conn:
            conn.close()
