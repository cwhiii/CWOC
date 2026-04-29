"""Trash API routes for the CWOC backend.

Provides endpoints for listing soft-deleted chits, restoring them,
and permanently purging them.
"""

import logging
import sqlite3
from datetime import datetime

from fastapi import APIRouter, HTTPException

from src.backend.db import DB_PATH, deserialize_json_field


logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/api/trash")
def get_trash():
    """Get all soft-deleted chits, sorted by most recently deleted."""
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM chits WHERE deleted = 1 ORDER BY modified_datetime DESC")
        trash = []
        for row in cursor.fetchall():
            chit = dict(zip([col[0] for col in cursor.description], row))
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
def restore_chit(chit_id: str):
    """Restore a soft-deleted chit."""
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("UPDATE chits SET deleted = 0, modified_datetime = ? WHERE id = ?",
                       (datetime.utcnow().isoformat(), chit_id))
        conn.commit()
        return {"message": "Chit restored"}
    except Exception as e:
        logger.error(f"Error restoring chit: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.close()


@router.delete("/api/trash/{chit_id}/purge")
def purge_chit(chit_id: str):
    """Permanently delete a chit from the database."""
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("DELETE FROM chits WHERE id = ? AND deleted = 1", (chit_id,))
        conn.commit()
        return {"message": "Chit permanently deleted"}
    except Exception as e:
        logger.error(f"Error purging chit: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.close()
