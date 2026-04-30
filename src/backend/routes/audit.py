"""Audit log API routes and helpers for the CWOC backend.

Provides audit log CRUD endpoints, auto-prune, and shared helpers
(get_actor_from_request, compute_audit_diff, insert_audit_entry) used by
other route modules.
"""

import csv
import io
import json
import logging
import sqlite3
from datetime import datetime, timedelta
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query, Request

from src.backend.db import DB_PATH, deserialize_json_field


logger = logging.getLogger(__name__)
router = APIRouter()


# ── Shared audit helpers (imported by other route modules) ────────────────

def get_actor_from_request(request: Request) -> str:
    """Build an actor string from the authenticated user's request state.

    Reads request.state.user_id and request.state.username (set by AuthMiddleware).
    Returns a string in the format 'username (user_id)' for audit attribution.
    Falls back to 'Unknown Gremlin' if request state is missing.
    """
    try:
        user_id = getattr(request.state, "user_id", None)
        username = getattr(request.state, "username", None)
        if user_id and username:
            return f"{username} ({user_id})"
        if username:
            return username
        if user_id:
            return user_id
        return "Unknown Gremlin"
    except Exception:
        return "Unknown Gremlin"


def get_current_actor() -> str:
    """Legacy fallback: read the username from the users table for system-level actions
    (e.g., startup version tracking) where no request context is available.
    Returns 'System' as the default actor."""
    return "System"


# Fields stored as JSON strings in SQLite that need deserialization before diff comparison
_JSON_SERIALIZED_FIELDS = {
    "tags", "checklist", "people", "child_chits", "alerts",
    "recurrence_rule", "recurrence_exceptions", "weather_data", "health_data",
    "phones", "emails", "addresses", "call_signs", "x_handles",
    "websites", "default_filters", "custom_colors", "visual_indicators",
    "chit_options", "active_clocks", "saved_locations",
}

# Fields excluded from audit diffs by default
_AUDIT_EXCLUDE_FIELDS = {"modified_datetime", "created_datetime"}


def compute_audit_diff(old_dict, new_dict, exclude_fields=None):
    """Compare two dicts field-by-field and return a list of change details.

    Each entry is {"field": str, "old": any, "new": any} for fields that differ.
    JSON-serialized fields are deserialized before comparison.
    Excludes modified_datetime and created_datetime by default.
    Returns empty list for non-dict input (with a logged warning).
    """
    if not isinstance(old_dict, dict) or not isinstance(new_dict, dict):
        logger.warning("compute_audit_diff called with non-dict input")
        return []

    if exclude_fields is None:
        exclude_fields = _AUDIT_EXCLUDE_FIELDS

    changes = []
    all_keys = set(old_dict.keys()) | set(new_dict.keys())

    for key in sorted(all_keys):
        if key in exclude_fields:
            continue

        old_val = old_dict.get(key)
        new_val = new_dict.get(key)

        # Deserialize JSON-serialized fields for meaningful comparison
        if key in _JSON_SERIALIZED_FIELDS:
            if isinstance(old_val, str):
                old_val = deserialize_json_field(old_val)
            if isinstance(new_val, str):
                new_val = deserialize_json_field(new_val)

        if old_val != new_val:
            changes.append({"field": key, "old": old_val, "new": new_val})

    return changes


def insert_audit_entry(conn, entity_type, entity_id, action, actor, changes=None, entity_summary=None):
    """Insert a single audit log row. Best-effort — never raises."""
    try:
        cursor = conn.cursor()
        entry_id = str(uuid4())
        ts = datetime.utcnow().isoformat()
        changes_json = json.dumps(changes) if changes is not None else None
        cursor.execute(
            """
            INSERT INTO audit_log (id, entity_type, entity_id, action, actor, timestamp, changes, entity_summary)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (entry_id, entity_type, str(entity_id), action, actor, ts, changes_json, entity_summary)
        )
    except Exception as e:
        logger.error(f"Audit insert failed (best-effort): {str(e)}")


def _run_auto_prune():
    """Auto-prune audit log based on settings limits. Returns (pruned_by_age, pruned_by_size)."""
    pruned_by_age = 0
    pruned_by_size = 0
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # Read audit settings
        cursor.execute("SELECT audit_log_max_days, audit_log_max_mb FROM settings WHERE user_id = 'default_user'")
        row = cursor.fetchone()
        if not row:
            return (0, 0)

        max_days = row[0]
        max_mb = row[1]

        # If both limits are None, skip pruning entirely
        if max_days is None and max_mb is None:
            return (0, 0)

        # Prune by age
        if max_days and max_days > 0:
            cutoff = (datetime.utcnow() - timedelta(days=max_days)).isoformat()
            cursor.execute("DELETE FROM audit_log WHERE timestamp < ?", (cutoff,))
            pruned_by_age = cursor.rowcount

        # Prune by size — single bulk DELETE based on average row size estimate
        if max_mb and max_mb > 0:
            max_bytes = max_mb * 1024 * 1024
            cursor.execute("""
                SELECT COUNT(*),
                       SUM(LENGTH(id) + LENGTH(entity_type) + LENGTH(entity_id) + LENGTH(action) +
                           LENGTH(actor) + LENGTH(timestamp) + COALESCE(LENGTH(changes),0) +
                           COALESCE(LENGTH(entity_summary),0))
                FROM audit_log
            """)
            count_row = cursor.fetchone()
            total_rows = count_row[0] or 0
            total_size = count_row[1] or 0
            if total_rows > 0 and total_size > max_bytes:
                avg_row_size = total_size / total_rows
                rows_to_keep = int(max_bytes / avg_row_size) if avg_row_size > 0 else total_rows
                rows_to_delete = total_rows - rows_to_keep
                if rows_to_delete > 0:
                    cursor.execute("""
                        DELETE FROM audit_log WHERE id IN (
                            SELECT id FROM audit_log ORDER BY timestamp ASC LIMIT ?
                        )
                    """, (rows_to_delete,))
                    pruned_by_size = cursor.rowcount

        conn.commit()
        logger.info(f"Auto-prune: removed {pruned_by_age} by age, {pruned_by_size} by size")
    except Exception as e:
        logger.error(f"Auto-prune error: {str(e)}")
    finally:
        if conn:
            conn.close()
    return (pruned_by_age, pruned_by_size)


# ── Allowed sort columns for audit log queries ────────────────────────────
_AUDIT_SORT_COLUMNS = {"timestamp", "actor", "action", "entity_type", "entity_summary"}

# ── Trim duration map ─────────────────────────────────────────────────────
_TRIM_DURATIONS = {
    "1h": timedelta(hours=1),
    "1d": timedelta(days=1),
    "1w": timedelta(weeks=1),
    "1m": timedelta(days=30),
    "1y": timedelta(days=365),
}


# ── Route handlers ────────────────────────────────────────────────────────

@router.get("/api/audit-log/export")
def export_audit_log_csv(
    entity_type: Optional[str] = Query(None),
    actor: Optional[str] = Query(None),
    since: Optional[str] = Query(None),
    until: Optional[str] = Query(None),
):
    """Export audit log entries as a CSV file download.
    Accepts same filters as GET /api/audit-log but no limit/offset — exports all matching."""
    from fastapi.responses import Response

    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row

        query = "SELECT * FROM audit_log"
        conditions = []
        params = []

        if entity_type:
            conditions.append("entity_type = ?")
            params.append(entity_type)
        if actor:
            conditions.append("actor = ?")
            params.append(actor)
        if since:
            conditions.append("timestamp >= ?")
            params.append(since)
        if until:
            conditions.append("timestamp <= ?")
            params.append(until)

        if conditions:
            query += " WHERE " + " AND ".join(conditions)
        query += " ORDER BY timestamp DESC"

        cursor = conn.cursor()
        cursor.execute(query, params)
        rows = cursor.fetchall()

        # Build a cache of user_id -> display_name for actor display
        actor_display_names = {}
        try:
            cursor.execute("SELECT id, display_name FROM users")
            for urow in cursor.fetchall():
                actor_display_names[urow["id"]] = urow["display_name"]
        except Exception:
            pass  # users table may not exist yet

        output = io.StringIO()
        writer = csv.writer(output)
        columns = ["timestamp", "actor", "actor_display_name", "action", "entity_type", "entity_id", "entity_summary", "changes"]
        writer.writerow(columns)

        for row in rows:
            actor_str = row["actor"] or ""
            actor_display = actor_str
            if "(" in actor_str and actor_str.endswith(")"):
                uid = actor_str.rsplit("(", 1)[-1].rstrip(")")
                if uid in actor_display_names:
                    actor_display = actor_display_names[uid]
            writer.writerow([
                row["timestamp"],
                row["actor"],
                actor_display,
                row["action"],
                row["entity_type"],
                row["entity_id"],
                row["entity_summary"] or "",
                row["changes"] or "",
            ])

        csv_content = output.getvalue()
        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=audit_log.csv"},
        )
    except Exception as e:
        logger.error(f"Error exporting audit log CSV: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to export audit log: {str(e)}")
    finally:
        if conn:
            conn.close()


@router.get("/api/audit-log")
def get_audit_log(
    entity_type: Optional[str] = Query(None),
    entity_id: Optional[str] = Query(None),
    actor: Optional[str] = Query(None),
    since: Optional[str] = Query(None),
    until: Optional[str] = Query(None),
    limit: int = Query(50),
    offset: int = Query(0),
    sort_by: str = Query("timestamp"),
    sort_order: str = Query("desc"),
):
    """Return audit log entries with optional filters, sorting, and pagination."""
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row

        # Clamp negative limit/offset to 0
        if limit < 0:
            limit = 0
        if offset < 0:
            offset = 0

        # Validate sort_by against allowed columns
        if sort_by not in _AUDIT_SORT_COLUMNS:
            sort_by = "timestamp"
        if sort_order.lower() not in ("asc", "desc"):
            sort_order = "desc"

        base_query = "FROM audit_log"
        conditions = []
        params = []

        if entity_type:
            conditions.append("entity_type = ?")
            params.append(entity_type)
        if entity_id:
            conditions.append("entity_id = ?")
            params.append(entity_id)
        if actor:
            conditions.append("actor = ?")
            params.append(actor)
        if since:
            conditions.append("timestamp >= ?")
            params.append(since)
        if until:
            conditions.append("timestamp <= ?")
            params.append(until)

        if conditions:
            base_query += " WHERE " + " AND ".join(conditions)

        # Get total count
        cursor = conn.cursor()
        cursor.execute(f"SELECT COUNT(*) {base_query}", params)
        total = cursor.fetchone()[0]

        # Get paginated entries
        data_query = f"SELECT * {base_query} ORDER BY {sort_by} {sort_order} LIMIT ? OFFSET ?"
        cursor.execute(data_query, params + [limit, offset])
        rows = cursor.fetchall()

        entries = []
        # Build a cache of user_id -> display_name for actor display
        actor_display_names = {}
        try:
            cursor.execute("SELECT id, display_name FROM users")
            for urow in cursor.fetchall():
                actor_display_names[urow["id"]] = urow["display_name"]
        except Exception:
            pass  # users table may not exist yet

        for row in rows:
            entry = dict(row)
            # Deserialize changes from JSON
            if entry.get("changes"):
                try:
                    entry["changes"] = json.loads(entry["changes"])
                except (json.JSONDecodeError, TypeError):
                    pass  # Return raw string if invalid JSON
            # Add actor_display_name by extracting user_id from actor string "username (user_id)"
            actor_str = entry.get("actor", "")
            actor_display = actor_str  # default to the raw actor string
            if "(" in actor_str and actor_str.endswith(")"):
                uid = actor_str.rsplit("(", 1)[-1].rstrip(")")
                if uid in actor_display_names:
                    actor_display = actor_display_names[uid]
            entry["actor_display_name"] = actor_display
            entries.append(entry)

        return {"entries": entries, "total": total}
    except Exception as e:
        logger.error(f"Error fetching audit log: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch audit log: {str(e)}")
    finally:
        if conn:
            conn.close()


@router.delete("/api/audit-log/trim")
def trim_audit_log(
    older_than: str = Query(...),
):
    """Trim audit log entries older than a specified timeframe.
    Accepted values: 1h, 1d, 1w, 1m, 1y."""
    conn = None
    try:
        duration = _TRIM_DURATIONS.get(older_than)
        if not duration:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid older_than value: '{older_than}'. Use one of: 1h, 1d, 1w, 1m, 1y",
            )

        cutoff = (datetime.utcnow() - duration).isoformat()

        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("DELETE FROM audit_log WHERE timestamp < ?", (cutoff,))
        deleted_count = cursor.rowcount
        conn.commit()

        label_map = {"1h": "1 hour", "1d": "1 day", "1w": "1 week", "1m": "1 month", "1y": "1 year"}
        label = label_map.get(older_than, older_than)

        return {"message": f"Trimmed entries older than {label}", "deleted_count": deleted_count}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error trimming audit log: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to trim audit log: {str(e)}")
    finally:
        if conn:
            conn.close()


@router.delete("/api/audit-log")
def clear_audit_log():
    """Delete all audit log entries."""
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM audit_log")
        total = cursor.fetchone()[0]
        cursor.execute("DELETE FROM audit_log")
        conn.commit()
        return {"message": "Audit log cleared", "deleted_count": total}
    except Exception as e:
        logger.error(f"Error clearing audit log: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to clear audit log: {str(e)}")
    finally:
        if conn:
            conn.close()


@router.post("/api/audit-log/auto-prune")
def auto_prune_audit_log():
    """Auto-prune audit log based on settings limits."""
    pruned_by_age, pruned_by_size = _run_auto_prune()
    return {"pruned_by_age": pruned_by_age, "pruned_by_size": pruned_by_size}
