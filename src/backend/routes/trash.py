"""Trash API routes for the CWOC backend.

Provides endpoints for listing soft-deleted chits, restoring them,
and permanently purging them.

Regular users see only their own deleted chits.
Admins see all deleted chits across all users.
"""

import logging
import sqlite3
from datetime import datetime

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
            "SELECT id, owner_id FROM chits WHERE id = ? AND deleted = 1", (chit_id,)
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Chit not found in trash")

        # Non-admins can only restore their own chits
        if row["owner_id"] != user_id and not _is_admin(conn, user_id):
            raise HTTPException(status_code=403, detail="Not authorized")

        cursor.execute(
            "UPDATE chits SET deleted = 0, modified_datetime = ? WHERE id = ?",
            (datetime.utcnow().isoformat(), chit_id),
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
            "SELECT id, owner_id FROM chits WHERE id = ? AND deleted = 1", (chit_id,)
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Chit not found in trash")

        # Non-admins can only purge their own chits
        if row["owner_id"] != user_id and not _is_admin(conn, user_id):
            raise HTTPException(status_code=403, detail="Not authorized")

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
