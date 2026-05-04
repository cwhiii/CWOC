"""Attachment management routes for CWOC.

Provides upload, download, and delete endpoints for chit file attachments.
Files are stored on disk at /app/data/attachments/{chit_id}/{uuid}_{filename}.
Metadata is stored as a JSON array in the chit's `attachments` column.
"""

import json
import logging
import mimetypes
import os
import sqlite3
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request, UploadFile, File
from fastapi.responses import FileResponse

from src.backend.db import DB_PATH, deserialize_json_field, serialize_json_field

logger = logging.getLogger(__name__)

attachments_router = APIRouter()

# Attachment storage paths: production first, dev fallback
_ATTACHMENTS_DIR_PRODUCTION = "/app/data/attachments"
_ATTACHMENTS_DIR_DEV = os.path.join("data", "attachments")


def _get_attachments_dir() -> str:
    """Return the appropriate attachments directory for the current environment."""
    prod_parent = os.path.dirname(_ATTACHMENTS_DIR_PRODUCTION)
    if os.path.isdir(prod_parent):
        return _ATTACHMENTS_DIR_PRODUCTION
    return _ATTACHMENTS_DIR_DEV


def _get_max_size_bytes(cursor, user_id: str) -> int:
    """Load the max attachment file size from settings (default 10 MB)."""
    try:
        cursor.execute(
            "SELECT attachment_max_size_mb FROM settings WHERE user_id = ?",
            (user_id,),
        )
        row = cursor.fetchone()
        if row and row[0]:
            return int(row[0]) * 1024 * 1024
    except Exception:
        pass
    return 10 * 1024 * 1024  # 10 MB default


def _get_max_storage_bytes(cursor, user_id: str) -> int:
    """Load the max total attachment storage per user from settings (default 500 MB, 0 = unlimited)."""
    try:
        cursor.execute(
            "SELECT attachment_max_storage_mb FROM settings WHERE user_id = ?",
            (user_id,),
        )
        row = cursor.fetchone()
        if row and row[0]:
            val = int(row[0])
            if val == 0:
                return 0  # unlimited
            return val * 1024 * 1024
    except Exception:
        pass
    return 500 * 1024 * 1024  # 500 MB default


def _get_user_total_attachment_size(cursor, user_id: str) -> int:
    """Calculate the total attachment storage used by a user across all their chits."""
    try:
        cursor.execute(
            "SELECT attachments FROM chits WHERE owner_id = ? AND attachments IS NOT NULL AND attachments != ''",
            (user_id,),
        )
        total = 0
        for row in cursor.fetchall():
            atts = deserialize_json_field(row[0])
            if isinstance(atts, list):
                for att in atts:
                    total += att.get("size", 0) if isinstance(att, dict) else 0
        return total
    except Exception:
        return 0


def _load_attachments(cursor, chit_id: str) -> list:
    """Load the attachments JSON array from a chit."""
    cursor.execute("SELECT attachments FROM chits WHERE id = ?", (chit_id,))
    row = cursor.fetchone()
    if not row or not row[0]:
        return []
    result = deserialize_json_field(row[0])
    return result if isinstance(result, list) else []


def _save_attachments(cursor, chit_id: str, attachments: list):
    """Save the attachments JSON array back to the chit."""
    now = datetime.now(timezone.utc).isoformat()
    cursor.execute(
        "UPDATE chits SET attachments = ?, modified_datetime = ? WHERE id = ?",
        (serialize_json_field(attachments), now, chit_id),
    )


# ───────────────────────────────────────────────────────────────────────────
# POST /api/chits/{chit_id}/attachments — Upload a file
# ───────────────────────────────────────────────────────────────────────────

@attachments_router.post("/api/chits/{chit_id}/attachments")
async def upload_attachment(chit_id: str, request: Request, file: UploadFile = File(...)):
    """Upload a file attachment to a chit.

    Stores the file at /app/data/attachments/{chit_id}/{uuid}_{filename}
    and updates the chit's attachments JSON array.
    """
    user_id = request.state.user_id
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # Verify chit exists
        cursor.execute("SELECT id FROM chits WHERE id = ?", (chit_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Chit not found.")

        # Check file size limit
        max_size = _get_max_size_bytes(cursor, user_id)

        # Read file content
        content = await file.read()
        if len(content) > max_size:
            max_mb = max_size // (1024 * 1024)
            raise HTTPException(
                status_code=413,
                detail=f"File too large. Maximum file size is {max_mb} MB.",
            )

        # Check per-user total storage limit
        max_storage = _get_max_storage_bytes(cursor, user_id)
        if max_storage > 0:  # 0 = unlimited
            current_usage = _get_user_total_attachment_size(cursor, user_id)
            if current_usage + len(content) > max_storage:
                max_storage_mb = max_storage // (1024 * 1024)
                current_mb = round(current_usage / (1024 * 1024), 1)
                raise HTTPException(
                    status_code=413,
                    detail=f"Storage limit exceeded. You are using {current_mb} MB of {max_storage_mb} MB allowed.",
                )

        # Generate unique filename
        attachment_id = str(uuid4())
        safe_filename = os.path.basename(file.filename or "unnamed")
        stored_name = f"{attachment_id}_{safe_filename}"

        # Create directory and write file
        attachments_dir = _get_attachments_dir()
        chit_dir = os.path.join(attachments_dir, chit_id)
        os.makedirs(chit_dir, exist_ok=True)

        file_path = os.path.join(chit_dir, stored_name)
        with open(file_path, "wb") as f:
            f.write(content)

        # Detect MIME type
        mime_type = file.content_type or mimetypes.guess_type(safe_filename)[0] or "application/octet-stream"

        # Update chit's attachments JSON
        attachments = _load_attachments(cursor, chit_id)
        attachments.append({
            "id": attachment_id,
            "filename": safe_filename,
            "size": len(content),
            "mime_type": mime_type,
            "uploaded_at": datetime.now(timezone.utc).isoformat(),
        })
        _save_attachments(cursor, chit_id, attachments)
        conn.commit()

        return {
            "id": attachment_id,
            "filename": safe_filename,
            "size": len(content),
            "mime_type": mime_type,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Attachment upload error: %s", e)
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")
    finally:
        if conn:
            conn.close()


# ───────────────────────────────────────────────────────────────────────────
# GET /api/chits/{chit_id}/attachments/{attachment_id} — Download a file
# ───────────────────────────────────────────────────────────────────────────

@attachments_router.get("/api/chits/{chit_id}/attachments/{attachment_id}")
def download_attachment(chit_id: str, attachment_id: str, request: Request):
    """Download an attachment file by its ID."""
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        attachments = _load_attachments(cursor, chit_id)
        entry = None
        for a in attachments:
            if a.get("id") == attachment_id:
                entry = a
                break

        if not entry:
            raise HTTPException(status_code=404, detail="Attachment not found.")

        attachments_dir = _get_attachments_dir()
        stored_name = f"{attachment_id}_{entry['filename']}"
        file_path = os.path.join(attachments_dir, chit_id, stored_name)

        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="Attachment file not found on disk.")

        return FileResponse(
            file_path,
            filename=entry["filename"],
            media_type=entry.get("mime_type", "application/octet-stream"),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Attachment download error: %s", e)
        raise HTTPException(status_code=500, detail=f"Download failed: {str(e)}")
    finally:
        if conn:
            conn.close()


# ───────────────────────────────────────────────────────────────────────────
# DELETE /api/chits/{chit_id}/attachments/{attachment_id} — Delete a file
# ───────────────────────────────────────────────────────────────────────────

@attachments_router.delete("/api/chits/{chit_id}/attachments/{attachment_id}")
def delete_attachment(chit_id: str, attachment_id: str, request: Request):
    """Delete an attachment file and remove it from the chit's metadata."""
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        attachments = _load_attachments(cursor, chit_id)
        entry = None
        new_attachments = []
        for a in attachments:
            if a.get("id") == attachment_id:
                entry = a
            else:
                new_attachments.append(a)

        if not entry:
            raise HTTPException(status_code=404, detail="Attachment not found.")

        # Delete file from disk
        attachments_dir = _get_attachments_dir()
        stored_name = f"{attachment_id}_{entry['filename']}"
        file_path = os.path.join(attachments_dir, chit_id, stored_name)
        if os.path.exists(file_path):
            os.remove(file_path)

        # Update chit's attachments JSON
        _save_attachments(cursor, chit_id, new_attachments)
        conn.commit()

        return {"message": "Attachment deleted."}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Attachment delete error: %s", e)
        raise HTTPException(status_code=500, detail=f"Delete failed: {str(e)}")
    finally:
        if conn:
            conn.close()
