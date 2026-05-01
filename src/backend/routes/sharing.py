"""Sharing management API routes for the CWOC backend.

Provides endpoints for managing chit-level shares, querying shared chits,
and managing tag-level sharing configuration.

Routes:
  GET    /api/chits/{chit_id}/shares          — list shares for a chit (owner only)
  PUT    /api/chits/{chit_id}/shares          — set entire shares list (owner only)
  DELETE /api/chits/{chit_id}/shares/{user_id} — remove a user from shares (owner only)
  GET    /api/shared-chits                     — all chits shared with authenticated user
  GET    /api/settings/shared-tags             — authenticated user's shared_tags config
  PUT    /api/settings/shared-tags             — set authenticated user's shared_tags config
"""

import logging
import sqlite3
from datetime import datetime

from fastapi import APIRouter, HTTPException, Request

from src.backend.db import (
    DB_PATH,
    serialize_json_field,
    deserialize_json_field,
)
from src.backend.sharing import can_manage_sharing, get_shared_chits_for_user
from src.backend.routes.audit import insert_audit_entry, get_actor_from_request
from src.backend.routes.notifications import _create_share_notifications


logger = logging.getLogger(__name__)
sharing_router = APIRouter()

# Valid role values for sharing
_VALID_ROLES = {"manager", "viewer"}


# ── Helpers ───────────────────────────────────────────────────────────────

def _validate_role(role: str) -> None:
    """Raise 400 if role is not 'manager' or 'viewer'."""
    if role not in _VALID_ROLES:
        raise HTTPException(status_code=400, detail="Role must be 'manager' or 'viewer'")


def _validate_user_ids_exist(cursor, user_ids: list) -> None:
    """Raise 400 if any user_id does not exist in the users table."""
    if not user_ids:
        return
    placeholders = ",".join("?" for _ in user_ids)
    cursor.execute(f"SELECT id FROM users WHERE id IN ({placeholders})", user_ids)
    found_ids = {row[0] for row in cursor.fetchall()}
    missing = set(user_ids) - found_ids
    if missing:
        raise HTTPException(status_code=400, detail="User not found")


def _load_chit_row(cursor, chit_id: str) -> dict:
    """Load a chit by ID and return as dict. Raises 404 if not found."""
    cursor.execute("SELECT * FROM chits WHERE id = ?", (chit_id,))
    row = cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Chit not found")
    return dict(zip([col[0] for col in cursor.description], row))


# ═══════════════════════════════════════════════════════════════════════════
# Chit-Level Sharing Endpoints
# ═══════════════════════════════════════════════════════════════════════════

@sharing_router.get("/api/chits/{chit_id}/shares")
def get_chit_shares(chit_id: str, request: Request):
    """Return the shares list for a chit with display names. Owner only."""
    user_id = request.state.user_id
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        chit_row = _load_chit_row(cursor, chit_id)

        if not can_manage_sharing(chit_row, user_id):
            raise HTTPException(status_code=403, detail="Only the chit owner can manage sharing")

        shares = deserialize_json_field(chit_row.get("shares")) or []

        # Enrich each share entry with display_name from users table
        enriched = []
        for entry in shares:
            uid = entry.get("user_id")
            role = entry.get("role")
            display_name = ""
            if uid:
                cursor.execute("SELECT display_name FROM users WHERE id = ?", (uid,))
                user_row = cursor.fetchone()
                if user_row:
                    display_name = user_row[0] or ""
            enriched.append({
                "user_id": uid,
                "role": role,
                "display_name": display_name,
            })

        return {"shares": enriched}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching chit shares: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch shares: {str(e)}")
    finally:
        if conn:
            conn.close()


@sharing_router.put("/api/chits/{chit_id}/shares")
def set_chit_shares(chit_id: str, body: dict, request: Request):
    """Set the entire shares list for a chit. Owner only.

    Body: { "shares": [{"user_id": "uuid", "role": "manager"|"viewer"}, ...] }
    Validates role values, user_ids existence, and rejects sharing with self.
    """
    user_id = request.state.user_id
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        chit_row = _load_chit_row(cursor, chit_id)

        if not can_manage_sharing(chit_row, user_id):
            raise HTTPException(status_code=403, detail="Only the chit owner can manage sharing")

        new_shares = body.get("shares", [])
        if not isinstance(new_shares, list):
            raise HTTPException(status_code=400, detail="shares must be a list")

        # Validate each entry
        share_user_ids = []
        for entry in new_shares:
            uid = entry.get("user_id")
            role = entry.get("role")

            if not uid:
                raise HTTPException(status_code=400, detail="Each share entry must have a user_id")

            # Reject sharing with self
            if uid == user_id:
                raise HTTPException(status_code=400, detail="Cannot share a chit with yourself")

            _validate_role(role)
            share_user_ids.append(uid)

        # Validate all user_ids exist
        _validate_user_ids_exist(cursor, share_user_ids)

        # Capture old shares for audit diff
        old_shares = deserialize_json_field(chit_row.get("shares")) or []

        # Update the chit's shares column
        now = datetime.utcnow().isoformat()
        cursor.execute(
            "UPDATE chits SET shares = ?, modified_datetime = ? WHERE id = ?",
            (serialize_json_field(new_shares), now, chit_id),
        )

        # Audit logging
        try:
            actor = get_actor_from_request(request)
            changes = [{"field": "shares", "old": old_shares, "new": new_shares}]
            insert_audit_entry(
                conn, "chit", chit_id, "shares_updated", actor,
                changes=changes, entity_summary=chit_row.get("title"),
            )
        except Exception as e:
            logger.error(f"Audit logging failed for shares update (best-effort): {str(e)}")

        # Create notifications for newly shared users
        try:
            owner_display = chit_row.get("owner_display_name") or ""
            assigned_to = chit_row.get("assigned_to")
            _create_share_notifications(
                cursor, chit_id, chit_row.get("title"), owner_display,
                old_shares, new_shares,
                assigned_to_new=assigned_to,
                assigned_to_old=assigned_to,
            )
        except Exception as e:
            logger.error(f"Notification creation failed for shares update (best-effort): {str(e)}")

        conn.commit()
        return {"shares": new_shares}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error setting chit shares: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update shares: {str(e)}")
    finally:
        if conn:
            conn.close()


@sharing_router.delete("/api/chits/{chit_id}/shares/{target_user_id}")
def remove_chit_share(chit_id: str, target_user_id: str, request: Request):
    """Remove a specific user from a chit's shares list. Owner only."""
    user_id = request.state.user_id
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        chit_row = _load_chit_row(cursor, chit_id)

        if not can_manage_sharing(chit_row, user_id):
            raise HTTPException(status_code=403, detail="Only the chit owner can manage sharing")

        old_shares = deserialize_json_field(chit_row.get("shares")) or []
        new_shares = [s for s in old_shares if s.get("user_id") != target_user_id]

        if len(new_shares) == len(old_shares):
            raise HTTPException(status_code=404, detail="User not found in shares")

        now = datetime.utcnow().isoformat()
        cursor.execute(
            "UPDATE chits SET shares = ?, modified_datetime = ? WHERE id = ?",
            (serialize_json_field(new_shares), now, chit_id),
        )

        # Audit logging
        try:
            actor = get_actor_from_request(request)
            changes = [{"field": "shares", "old": old_shares, "new": new_shares}]
            insert_audit_entry(
                conn, "chit", chit_id, "share_removed", actor,
                changes=changes, entity_summary=chit_row.get("title"),
            )
        except Exception as e:
            logger.error(f"Audit logging failed for share removal (best-effort): {str(e)}")

        conn.commit()
        return {"shares": new_shares}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error removing chit share: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to remove share: {str(e)}")
    finally:
        if conn:
            conn.close()


# ═══════════════════════════════════════════════════════════════════════════
# Shared Chits Query Endpoint
# ═══════════════════════════════════════════════════════════════════════════

@sharing_router.get("/api/shared-chits")
def get_shared_chits(request: Request):
    """Return all chits shared with the authenticated user.

    Each chit is annotated with effective_role, share_source, and owner_display_name.
    """
    user_id = request.state.user_id
    try:
        results = get_shared_chits_for_user(user_id)
        return results
    except Exception as e:
        logger.error(f"Error fetching shared chits: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch shared chits: {str(e)}")


# ═══════════════════════════════════════════════════════════════════════════
# Tag-Level Sharing Endpoints
# ═══════════════════════════════════════════════════════════════════════════

@sharing_router.get("/api/settings/shared-tags")
def get_shared_tags(request: Request):
    """Return the authenticated user's shared_tags configuration with display names."""
    user_id = request.state.user_id
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        cursor.execute("SELECT shared_tags FROM settings WHERE user_id = ?", (user_id,))
        row = cursor.fetchone()

        shared_tags = []
        if row and row["shared_tags"]:
            shared_tags = deserialize_json_field(row["shared_tags"]) or []

        # Enrich each share entry with display_name
        for tag_entry in shared_tags:
            for share in (tag_entry.get("shares") or []):
                uid = share.get("user_id")
                if uid:
                    cursor.execute("SELECT display_name FROM users WHERE id = ?", (uid,))
                    user_row = cursor.fetchone()
                    share["display_name"] = user_row["display_name"] if user_row else ""

        return {"shared_tags": shared_tags}
    except Exception as e:
        logger.error(f"Error fetching shared tags: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch shared tags: {str(e)}")
    finally:
        if conn:
            conn.close()


@sharing_router.put("/api/settings/shared-tags")
def set_shared_tags(body: dict, request: Request):
    """Set the authenticated user's shared_tags configuration.

    Body: { "shared_tags": [{"tag": "TagName", "shares": [{"user_id": "uuid", "role": "manager"|"viewer"}]}] }
    Validates role values and user_ids existence.
    """
    user_id = request.state.user_id
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        new_shared_tags = body.get("shared_tags", [])
        if not isinstance(new_shared_tags, list):
            raise HTTPException(status_code=400, detail="shared_tags must be a list")

        # Validate each entry
        all_user_ids = []
        for tag_entry in new_shared_tags:
            tag_name = tag_entry.get("tag")
            if not tag_name:
                raise HTTPException(status_code=400, detail="Each shared_tags entry must have a tag name")

            shares = tag_entry.get("shares", [])
            if not isinstance(shares, list):
                raise HTTPException(status_code=400, detail="shares must be a list")

            for share in shares:
                uid = share.get("user_id")
                role = share.get("role")

                if not uid:
                    raise HTTPException(status_code=400, detail="Each share entry must have a user_id")

                # Reject sharing with self
                if uid == user_id:
                    raise HTTPException(status_code=400, detail="Cannot share a tag with yourself")

                _validate_role(role)
                all_user_ids.append(uid)

        # Validate all user_ids exist
        _validate_user_ids_exist(cursor, all_user_ids)

        # Capture old shared_tags for audit diff
        cursor.execute("SELECT shared_tags FROM settings WHERE user_id = ?", (user_id,))
        row = cursor.fetchone()
        old_shared_tags = deserialize_json_field(row["shared_tags"]) if row and row["shared_tags"] else []

        # Strip display_name from entries before saving (display_name is enriched on read)
        clean_shared_tags = []
        for tag_entry in new_shared_tags:
            clean_shares = []
            for share in (tag_entry.get("shares") or []):
                entry = {
                    "user_id": share.get("user_id"),
                    "role": share.get("role"),
                }
                # Persist tag_permission if provided (default: "view")
                tp = share.get("tag_permission", "view")
                if tp not in ("view", "manage"):
                    tp = "view"
                entry["tag_permission"] = tp
                clean_shares.append(entry)
            clean_shared_tags.append({
                "tag": tag_entry.get("tag"),
                "shares": clean_shares,
            })

        # Update the settings row
        serialized = serialize_json_field(clean_shared_tags)

        # Check if settings row exists
        if row:
            cursor.execute(
                "UPDATE settings SET shared_tags = ? WHERE user_id = ?",
                (serialized, user_id),
            )
        else:
            cursor.execute(
                "INSERT INTO settings (user_id, shared_tags) VALUES (?, ?)",
                (user_id, serialized),
            )

        # Audit logging
        try:
            actor = get_actor_from_request(request)
            changes = [{"field": "shared_tags", "old": old_shared_tags, "new": clean_shared_tags}]
            insert_audit_entry(
                conn, "settings", user_id, "shared_tags_updated", actor,
                changes=changes,
            )
        except Exception as e:
            logger.error(f"Audit logging failed for shared_tags update (best-effort): {str(e)}")

        conn.commit()
        return {"shared_tags": clean_shared_tags}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error setting shared tags: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update shared tags: {str(e)}")
    finally:
        if conn:
            conn.close()
