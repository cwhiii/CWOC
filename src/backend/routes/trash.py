"""Trash API routes for the CWOC backend.

Provides endpoints for listing soft-deleted chits, restoring them,
and permanently purging them.

Regular users see only their own deleted chits.
Admins see all deleted chits across all users.
"""

import logging
import sqlite3
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Request

from src.backend.db import DB_PATH, deserialize_json_field


logger = logging.getLogger(__name__)
router = APIRouter()


def _is_admin(conn, user_id: str) -> bool:
    """Check if the given user has admin privileges."""
    row = conn.execute(
        "SELECT is_admin FROM users WHERE id = ?", (user_id,)
    ).fetchone()
    return bool(row and row[0])


def _can_purge_record(cursor, sync_version: int, owner_id: str) -> bool:
    """Check if all active devices for this user have synced past this record's version.

    Returns True if purge is safe (all active devices have seen this version,
    or no devices are registered). Returns False if any active device hasn't
    synced past it yet.

    Devices with last_seen_datetime older than 90 days are excluded from this
    check — stale devices don't block cleanup.
    """
    stale_cutoff = (datetime.now(timezone.utc) - timedelta(days=90)).isoformat()

    row = cursor.execute(
        "SELECT MIN(last_sync_version) AS min_version FROM device_tokens "
        "WHERE user_id = ? AND revoked = 0 AND last_seen_datetime >= ?",
        (owner_id, stale_cutoff),
    ).fetchone()

    # No active (non-stale, non-revoked) devices — allow purge (web-only user)
    if row is None or row["min_version"] is None:
        return True

    # Only purge if all active devices have synced past this record's version
    return sync_version <= row["min_version"]


@router.get("/api/trash")
def get_trash(request: Request):
    """Get soft-deleted chits, sorted by most recently deleted.

    Regular users see only their own deleted chits.
    Admins see all deleted chits.
    """
    user_id = request.state.user_id
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        if _is_admin(conn, user_id):
            cursor.execute(
                "SELECT * FROM chits WHERE deleted = 1 ORDER BY modified_datetime DESC"
            )
        else:
            cursor.execute(
                "SELECT * FROM chits WHERE deleted = 1 AND owner_id = ? ORDER BY modified_datetime DESC",
                (user_id,),
            )

        trash = []
        for row in cursor.fetchall():
            chit = dict(row)
            chit["tags"] = deserialize_json_field(chit["tags"])
            chit["checklist"] = deserialize_json_field(chit["checklist"])
            chit["people"] = deserialize_json_field(chit["people"])
            chit["child_chits"] = deserialize_json_field(chit.get("child_chits"))
            chit["is_project_master"] = bool(chit.get("is_project_master"))
            chit["all_day"] = bool(chit.get("all_day"))
            chit["alerts"] = deserialize_json_field(chit.get("alerts"))
            chit["recurrence_rule"] = deserialize_json_field(chit.get("recurrence_rule"))
            chit["recurrence_exceptions"] = deserialize_json_field(chit.get("recurrence_exceptions"))
            trash.append(chit)
        return trash
    except Exception as e:
        logger.error(f"Error fetching trash: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.close()


@router.post("/api/trash/{chit_id}/restore")
def restore_chit(chit_id: str, request: Request):
    """Restore a soft-deleted chit.

    Regular users can only restore their own chits.
    Admins can restore any chit.
    """
    user_id = request.state.user_id
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # Verify the chit exists and is deleted
        row = cursor.execute(
            "SELECT id, owner_id, email_message_id, email_status FROM chits WHERE id = ? AND deleted = 1", (chit_id,)
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Chit not found in trash")

        # Non-admins can only restore their own chits
        if row["owner_id"] != user_id and not _is_admin(conn, user_id):
            raise HTTPException(status_code=403, detail="Not authorized")

        current_time = datetime.utcnow().isoformat()
        # If this is an email chit, restore email_folder back to inbox
        if row["email_message_id"] or row["email_status"]:
            cursor.execute(
                "UPDATE chits SET deleted = 0, email_folder = 'inbox', modified_datetime = ? WHERE id = ?",
                (current_time, chit_id),
            )
        else:
            cursor.execute(
                "UPDATE chits SET deleted = 0, modified_datetime = ? WHERE id = ?",
                (current_time, chit_id),
            )
        conn.commit()
        return {"message": "Chit restored"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error restoring chit: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.close()


@router.delete("/api/trash/{chit_id}/purge")
def purge_chit(chit_id: str, request: Request):
    """Permanently delete a chit from the database.

    Regular users can only purge their own chits.
    Admins can purge any chit.
    """
    user_id = request.state.user_id
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # Verify the chit exists and is deleted
        row = cursor.execute(
            "SELECT id, owner_id, sync_version, email_message_id, email_status FROM chits WHERE id = ? AND deleted = 1", (chit_id,)
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Chit not found in trash")

        # Non-admins can only purge their own chits
        if row["owner_id"] != user_id and not _is_admin(conn, user_id):
            raise HTTPException(status_code=403, detail="Not authorized")

        # Tombstone retention: don't purge if any active device hasn't synced past it
        chit_sync_version = row["sync_version"] or 0
        if not _can_purge_record(cursor, chit_sync_version, row["owner_id"]):
            raise HTTPException(
                status_code=409,
                detail="Cannot purge: one or more devices have not yet synced this deletion"
            )

        # Cascade cleanup: if this is an email chit, null out any nest_thread_id references
        if row["email_message_id"] or row["email_status"]:
            cursor.execute(
                "UPDATE chits SET nest_thread_id = NULL WHERE nest_thread_id = ?",
                (chit_id,),
            )

        cursor.execute("DELETE FROM chits WHERE id = ? AND deleted = 1", (chit_id,))
        conn.commit()
        return {"message": "Chit permanently deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error purging chit: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.close()


# ── Contact Trash Endpoints ──────────────────────────────────────────────

@router.get("/api/trash/contacts")
def get_contact_trash(request: Request):
    """Get soft-deleted contacts, sorted by most recently deleted.

    Regular users see only their own deleted contacts.
    Admins see all deleted contacts.
    Vault contacts (shared_to_vault=1) are visible to all users.
    """
    user_id = request.state.user_id
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        if _is_admin(conn, user_id):
            cursor.execute(
                "SELECT * FROM contacts WHERE deleted = 1 ORDER BY deleted_datetime DESC"
            )
        else:
            cursor.execute(
                """SELECT * FROM contacts
                   WHERE deleted = 1 AND (owner_id = ? OR shared_to_vault = 1)
                   ORDER BY deleted_datetime DESC""",
                (user_id,),
            )

        contacts = []
        for row in cursor.fetchall():
            contact = dict(row)
            contact["tags"] = deserialize_json_field(contact.get("tags"))
            contact["shared_to_vault"] = bool(contact.get("shared_to_vault"))
            contacts.append(contact)
        return contacts
    except Exception as e:
        logger.error(f"Error fetching contact trash: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.close()


@router.post("/api/trash/contacts/{contact_id}/restore")
def restore_contact(contact_id: str, request: Request):
    """Restore a soft-deleted contact.

    Regular users can only restore their own contacts (or vault contacts).
    Admins can restore any contact.
    """
    user_id = request.state.user_id
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        row = cursor.execute(
            "SELECT id, owner_id, shared_to_vault FROM contacts WHERE id = ? AND deleted = 1", (contact_id,)
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Contact not found in trash")

        # Non-admins can only restore their own or vault contacts
        is_owner = not row["owner_id"] or row["owner_id"] == user_id
        is_vault = bool(row["shared_to_vault"])
        if not is_owner and not is_vault and not _is_admin(conn, user_id):
            raise HTTPException(status_code=403, detail="Not authorized")

        current_time = datetime.utcnow().isoformat()
        cursor.execute(
            "UPDATE contacts SET deleted = 0, deleted_datetime = NULL, modified_datetime = ? WHERE id = ?",
            (current_time, contact_id),
        )
        conn.commit()
        return {"message": "Contact restored"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error restoring contact: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.close()


@router.delete("/api/trash/contacts/{contact_id}/purge")
def purge_contact(contact_id: str, request: Request):
    """Permanently delete a contact from the database.

    Regular users can only purge their own contacts (or vault contacts).
    Admins can purge any contact.
    """
    import os
    user_id = request.state.user_id
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        row = cursor.execute(
            "SELECT id, owner_id, shared_to_vault, sync_version FROM contacts WHERE id = ? AND deleted = 1", (contact_id,)
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Contact not found in trash")

        # Non-admins can only purge their own or vault contacts
        is_owner = not row["owner_id"] or row["owner_id"] == user_id
        is_vault = bool(row["shared_to_vault"])
        if not is_owner and not is_vault and not _is_admin(conn, user_id):
            raise HTTPException(status_code=403, detail="Not authorized")

        # Tombstone retention: don't purge if any active device hasn't synced past it
        contact_owner = row["owner_id"] or user_id
        contact_sync_version = row["sync_version"] or 0
        if not _can_purge_record(cursor, contact_sync_version, contact_owner):
            raise HTTPException(
                status_code=409,
                detail="Cannot purge: one or more devices have not yet synced this deletion"
            )

        # Remove vcf file if it exists
        contacts_dir = "/app/data/contacts/"
        vcf_path = os.path.join(contacts_dir, f"{contact_id}.vcf")
        if os.path.exists(vcf_path):
            os.remove(vcf_path)

        # Remove profile image if it exists
        images_dir = "/app/data/contacts/profile_pictures/"
        for ext in (".jpg", ".png", ".gif", ".webp"):
            img_path = os.path.join(images_dir, f"{contact_id}{ext}")
            if os.path.exists(img_path):
                os.remove(img_path)

        cursor.execute("DELETE FROM contacts WHERE id = ? AND deleted = 1", (contact_id,))
        conn.commit()
        return {"message": "Contact permanently deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error purging contact: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.close()
