"""Notification API routes for the CWOC backend.

Provides endpoints for listing, updating, and dismissing sharing notifications.
Also provides the helper function _create_share_notifications() used by
routes/chits.py and routes/sharing.py to create notifications when shares change.

Routes:
  GET    /api/notifications                — list notifications for authenticated user
  PATCH  /api/notifications/{id}           — accept or decline a notification (syncs RSVP)
  DELETE /api/notifications/{id}           — dismiss a notification
"""

import logging
import sqlite3
from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request

from src.backend.db import (
    DB_PATH,
    serialize_json_field,
    deserialize_json_field,
)


logger = logging.getLogger(__name__)
notifications_router = APIRouter()


# ═══════════════════════════════════════════════════════════════════════════
# Notification Creation Helper
# ═══════════════════════════════════════════════════════════════════════════

def _create_share_notifications(cursor, chit_id, chit_title, owner_display_name,
                                old_shares, new_shares, assigned_to_new=None,
                                assigned_to_old=None):
    """Create notification records for each newly shared user.

    Compares old_shares to new_shares. For each user_id present in new_shares
    but not in old_shares, inserts a notification row.

    The notification_type is "assigned" if the new user is the newly assigned user,
    otherwise "invited".

    Args:
        cursor: Active SQLite cursor (caller manages the connection/commit).
        chit_id: The chit being shared.
        chit_title: Title of the chit (for display in notifications).
        owner_display_name: Display name of the chit owner.
        old_shares: Previous shares list (list of dicts with "user_id" keys), or None.
        new_shares: Updated shares list (list of dicts with "user_id" keys), or None.
        assigned_to_new: The new assigned_to user ID (or None).
        assigned_to_old: The previous assigned_to user ID (or None).
    """
    old_user_ids = {s.get("user_id") for s in (old_shares or []) if isinstance(s, dict)}
    now = datetime.utcnow().isoformat()

    for entry in (new_shares or []):
        if not isinstance(entry, dict):
            continue
        uid = entry.get("user_id")
        if not uid or uid in old_user_ids:
            continue

        # Determine notification type
        if uid == assigned_to_new and assigned_to_old != uid:
            notif_type = "assigned"
        else:
            notif_type = "invited"

        cursor.execute(
            """INSERT INTO notifications
               (id, user_id, chit_id, chit_title, owner_display_name,
                notification_type, status, created_datetime)
               VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)""",
            (str(uuid4()), uid, chit_id, chit_title, owner_display_name,
             notif_type, now),
        )


# ═══════════════════════════════════════════════════════════════════════════
# GET /api/notifications
# ═══════════════════════════════════════════════════════════════════════════

@notifications_router.get("/api/notifications")
def list_notifications(request: Request):
    """List all notifications for the authenticated user, newest first."""
    user_id = request.state.user_id
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute(
            """SELECT id, user_id, chit_id, chit_title, owner_display_name,
                      notification_type, status, created_datetime
               FROM notifications
               WHERE user_id = ?
               ORDER BY created_datetime DESC""",
            (user_id,),
        )
        rows = cursor.fetchall()
        columns = [col[0] for col in cursor.description]
        return [dict(zip(columns, row)) for row in rows]
    except Exception as e:
        logger.error(f"Error listing notifications: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to list notifications: {str(e)}")
    finally:
        if conn:
            conn.close()


# ═══════════════════════════════════════════════════════════════════════════
# PATCH /api/notifications/{notification_id}
# ═══════════════════════════════════════════════════════════════════════════

@notifications_router.patch("/api/notifications/{notification_id}")
def update_notification(notification_id: str, body: dict, request: Request):
    """Accept or decline a notification and sync RSVP on the chit's shares entry.

    Body: { "status": "accepted" | "declined" }
    """
    user_id = request.state.user_id
    new_status = body.get("status")
    if new_status not in ("accepted", "declined"):
        raise HTTPException(status_code=400, detail="Status must be 'accepted' or 'declined'")

    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # Load the notification
        cursor.execute(
            "SELECT id, user_id, chit_id FROM notifications WHERE id = ?",
            (notification_id,),
        )
        notif_row = cursor.fetchone()
        if not notif_row:
            raise HTTPException(status_code=404, detail="Notification not found")

        notif_user_id = notif_row[1]
        chit_id = notif_row[2]

        # Verify the notification belongs to the requesting user
        if notif_user_id != user_id:
            raise HTTPException(status_code=404, detail="Notification not found")

        # Update notification status
        cursor.execute(
            "UPDATE notifications SET status = ? WHERE id = ?",
            (new_status, notification_id),
        )

        # Sync RSVP on the chit's shares entry
        cursor.execute("SELECT shares FROM chits WHERE id = ?", (chit_id,))
        chit_row = cursor.fetchone()
        if chit_row:
            shares = deserialize_json_field(chit_row[0]) or []
            for entry in shares:
                if isinstance(entry, dict) and entry.get("user_id") == user_id:
                    entry["rsvp_status"] = new_status
                    break
            cursor.execute(
                "UPDATE chits SET shares = ?, modified_datetime = ? WHERE id = ?",
                (serialize_json_field(shares), datetime.utcnow().isoformat(), chit_id),
            )

        conn.commit()
        return {"message": "Notification updated", "status": new_status}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating notification {notification_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update notification: {str(e)}")
    finally:
        if conn:
            conn.close()


# ═══════════════════════════════════════════════════════════════════════════
# DELETE /api/notifications/{notification_id}
# ═══════════════════════════════════════════════════════════════════════════

@notifications_router.delete("/api/notifications/{notification_id}")
def delete_notification(notification_id: str, request: Request):
    """Dismiss (delete) a notification. Only the notification owner can delete it."""
    user_id = request.state.user_id
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # Load the notification
        cursor.execute(
            "SELECT id, user_id FROM notifications WHERE id = ?",
            (notification_id,),
        )
        notif_row = cursor.fetchone()
        if not notif_row:
            raise HTTPException(status_code=404, detail="Notification not found")

        # Verify the notification belongs to the requesting user
        if notif_row[1] != user_id:
            raise HTTPException(status_code=404, detail="Notification not found")

        cursor.execute("DELETE FROM notifications WHERE id = ?", (notification_id,))
        conn.commit()
        return {"message": "Notification dismissed"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting notification {notification_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete notification: {str(e)}")
    finally:
        if conn:
            conn.close()
