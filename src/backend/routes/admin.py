"""Admin-only chit management routes.

Provides endpoints for searching all chits (regardless of owner) and
performing bulk updates (e.g., set owner_id). Requires admin privileges.
Reuses the global search logic from chits.py.
"""

import logging
import sqlite3
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel

from src.backend.db import DB_PATH, deserialize_json_field, serialize_json_field
from src.backend.routes.chits import _search_filter_chits

logger = logging.getLogger(__name__)

admin_router = APIRouter(prefix="/api/admin")


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
        raise HTTPException(status_code=500, detail="Internal error")
    finally:
        if conn:
            conn.close()


@admin_router.get("/chits")
def admin_search_chits(request: Request, q: Optional[str] = None, owner_id: Optional[str] = None,
                       no_owner: Optional[bool] = None, limit: int = 500):
    """Search all chits regardless of owner. Admin only.

    Query params:
      - q: text search using the same boolean search syntax as global search
           (supports #tags, &&, ||, !, parentheses)
      - owner_id: filter by specific owner
      - no_owner: if true, show chits with NULL/empty owner_id
      - limit: max results (default 500)
    """
    _require_admin(request)

    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # Build SQL conditions for owner filtering only — text search is done in Python
        conditions = []
        params = []

        if no_owner:
            conditions.append("(owner_id IS NULL OR owner_id = '')")
        elif owner_id:
            conditions.append("owner_id = ?")
            params.append(owner_id)

        where = " WHERE " + " AND ".join(conditions) if conditions else ""
        sql = f"SELECT * FROM chits{where} ORDER BY modified_datetime DESC"

        cursor.execute(sql, params)
        rows = cursor.fetchall()

        # Deserialize all rows
        all_chits = []
        for row in rows:
            chit = dict(row)
            chit["tags"] = deserialize_json_field(chit.get("tags"))
            chit["child_chits"] = deserialize_json_field(chit.get("child_chits"))
            chit["checklist"] = deserialize_json_field(chit.get("checklist"))
            chit["people"] = deserialize_json_field(chit.get("people"))
            chit["is_project_master"] = bool(chit.get("is_project_master"))
            chit["deleted"] = bool(chit.get("deleted"))
            chit["pinned"] = bool(chit.get("pinned"))
            chit["archived"] = bool(chit.get("archived"))
            chit["alerts"] = deserialize_json_field(chit.get("alerts"))
            chit["attachments"] = deserialize_json_field(chit.get("attachments"))
            chit["assigned_to"] = chit.get("assigned_to")
            all_chits.append(chit)

        # If there's a text query, use the same search logic as global search
        if q and q.strip():
            all_chits = _search_filter_chits(all_chits, q.strip())

        # Apply limit
        return all_chits[:limit]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Admin chit search error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.close()


@admin_router.get("/users")
def admin_list_users(request: Request):
    """List all users (id, username, display_name). Admin only."""
    _require_admin(request)

    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            "SELECT id, username, display_name, is_admin, is_active FROM users ORDER BY username"
        ).fetchall()
        return [dict(r) for r in rows]
    except Exception as e:
        logger.error(f"Admin list users error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.close()


class BulkUpdateRequest(BaseModel):
    chit_ids: List[str]
    updates: dict  # e.g. {"owner_id": "some-uuid", "status": "ToDo"}


@admin_router.post("/chits/bulk-update")
def admin_bulk_update(body: BulkUpdateRequest, request: Request):
    """Bulk update fields on multiple chits. Admin only.

    Allowed fields: owner_id, owner_display_name, owner_username, status,
    priority, deleted, archived, pinned, tags.
    """
    _require_admin(request)

    allowed_fields = {
        "owner_id", "owner_display_name", "owner_username",
        "status", "priority", "severity",
        "deleted", "archived", "pinned",
        "tags", "color",
    }

    # Validate updates
    updates = {}
    for key, value in body.updates.items():
        if key not in allowed_fields:
            raise HTTPException(status_code=400, detail=f"Field '{key}' not allowed for bulk update")
        updates[key] = value

    if not updates:
        raise HTTPException(status_code=400, detail="No valid updates provided")

    if not body.chit_ids:
        raise HTTPException(status_code=400, detail="No chit IDs provided")

    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.execute("BEGIN")

        # If setting owner_id, also look up display_name and username
        if "owner_id" in updates and "owner_display_name" not in updates:
            conn.row_factory = sqlite3.Row
            user_row = conn.execute(
                "SELECT display_name, username FROM users WHERE id = ?",
                (updates["owner_id"],)
            ).fetchone()
            if user_row:
                updates["owner_display_name"] = user_row["display_name"]
                updates["owner_username"] = user_row["username"]
            conn.row_factory = None

        # Build SET clause
        set_parts = []
        set_params = []
        for key, value in updates.items():
            if key == "tags":
                set_parts.append(f"{key} = ?")
                set_params.append(serialize_json_field(value))
            elif key in ("deleted", "archived", "pinned"):
                set_parts.append(f"{key} = ?")
                set_params.append(1 if value else 0)
            else:
                set_parts.append(f"{key} = ?")
                set_params.append(value)

        set_clause = ", ".join(set_parts)

        updated = 0
        for chit_id in body.chit_ids:
            params = set_params + [chit_id]
            conn.execute(f"UPDATE chits SET {set_clause} WHERE id = ?", params)
            updated += conn.execute("SELECT changes()").fetchone()[0]

        conn.commit()
        return {"updated": updated}
    except HTTPException:
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Admin bulk update error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.close()
