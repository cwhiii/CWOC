"""Badges API routes for the CWOC backend.

Provides endpoints for listing badges (active + recently completed)
and dismissing individual badges.

Authentication is handled by the AuthMiddleware — all /api/ routes
require a valid session or device token.
"""

import logging
import sqlite3
from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException, Query, Request

from src.backend.db import DB_PATH, get_db_connection


logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/api/badges")
def get_badges(request: Request, completed_window: str = Query(default="3")):
    """Return all active badges plus completed/dismissed badges within the window.

    Query params:
        completed_window: number of days (e.g. "3", "7", "30") or "all"

    Response:
        {
            "badges": [...],
            "counts": { "active": N, "completed": N }
        }

    Sorting: by category, then by last_updated_at descending within category.
    """
    user_id = request.state.user_id
    conn = None
    try:
        conn = get_db_connection()
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # Fetch all active badges for this user (via chit ownership)
        # Badges are linked to chits via chit_id; filter by chits owned by user
        cursor.execute(
            """
            SELECT b.* FROM badges b
            JOIN chits c ON b.chit_id = c.id
            WHERE b.status = 'active' AND c.owner_id = ?
            ORDER BY b.category, b.last_updated_at DESC
            """,
            (user_id,),
        )
        active_badges = [dict(row) for row in cursor.fetchall()]

        # Fetch completed/dismissed badges within the window
        completed_badges = []
        if completed_window == "all":
            cursor.execute(
                """
                SELECT b.* FROM badges b
                JOIN chits c ON b.chit_id = c.id
                WHERE b.status IN ('completed', 'dismissed')
                AND c.owner_id = ?
                ORDER BY b.category, b.last_updated_at DESC
                """,
                (user_id,),
            )
            completed_badges = [dict(row) for row in cursor.fetchall()]
        else:
            try:
                days = int(completed_window)
            except (ValueError, TypeError):
                days = 3  # Default fallback

            cutoff = (datetime.utcnow() - timedelta(days=days)).isoformat()
            cursor.execute(
                """
                SELECT b.* FROM badges b
                JOIN chits c ON b.chit_id = c.id
                WHERE b.status IN ('completed', 'dismissed')
                AND c.owner_id = ?
                AND b.completed_at >= ?
                ORDER BY b.category, b.last_updated_at DESC
                """,
                (user_id, cutoff),
            )
            completed_badges = [dict(row) for row in cursor.fetchall()]

        all_badges = active_badges + completed_badges

        return {
            "badges": all_badges,
            "counts": {
                "active": len(active_badges),
                "completed": len(completed_badges),
            },
        }
    except Exception as e:
        logger.error(f"Error fetching badges: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch badges: {str(e)}")
    finally:
        if conn:
            conn.close()


@router.post("/api/badges/{badge_id}/dismiss")
def dismiss_badge(badge_id: str, request: Request):
    """Dismiss a badge: set status=dismissed, completed_at=now.

    Returns the updated badge object.
    """
    user_id = request.state.user_id
    conn = None
    try:
        conn = get_db_connection()
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # Verify the badge exists and belongs to the authenticated user
        cursor.execute(
            """
            SELECT b.* FROM badges b
            JOIN chits c ON b.chit_id = c.id
            WHERE b.id = ? AND c.owner_id = ?
            """,
            (badge_id, user_id),
        )
        badge_row = cursor.fetchone()
        if not badge_row:
            raise HTTPException(status_code=404, detail="Badge not found")

        # Update the badge
        now = datetime.utcnow().isoformat()
        cursor.execute(
            """
            UPDATE badges
            SET status = 'dismissed', completed_at = ?
            WHERE id = ?
            """,
            (now, badge_id),
        )
        conn.commit()

        # Fetch and return the updated badge
        cursor.execute("SELECT * FROM badges WHERE id = ?", (badge_id,))
        updated = cursor.fetchone()
        return dict(updated)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error dismissing badge {badge_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to dismiss badge: {str(e)}")
    finally:
        if conn:
            conn.close()
