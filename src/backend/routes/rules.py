"""Rules CRUD API routes for the CWOC backend.

Provides endpoints for creating, reading, updating, deleting rules,
toggling enabled state, reordering priorities, managing pending
confirmations, and querying execution logs.
"""

import json
import logging
import sqlite3
from datetime import datetime, timedelta
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query, Request

from src.backend.db import DB_PATH, serialize_json_field, deserialize_json_field, row_to_dict
from src.backend.models import RuleCreate, RuleUpdate, RuleReorder
from src.backend.routes.audit import get_actor_from_request, insert_audit_entry, compute_audit_diff
from src.backend.rules_engine import execute_action
from src.backend.cron_parser import parse_cron
from src.backend.schedulers import _derive_period_from_cron


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/rules")


# ── Helper: deserialize JSON fields on a rule row dict ────────────────


def _compute_habit_summary(rule: dict) -> dict:
    """Compute the habit_summary object for a habit rule.

    Returns: {
        "current_status": "due" | "achieved" | "missed",
        "streak": int (consecutive achieved periods),
        "success_rate": float (achieved / total in window),
        "last_achieved_datetime": str or None,
        "period": "daily" | "weekly" | "monthly"
    }
    """
    now = datetime.utcnow()

    # Derive period from cron expression
    schedule_config = rule.get("schedule_config")
    if isinstance(schedule_config, str):
        try:
            schedule_config = json.loads(schedule_config)
        except (json.JSONDecodeError, TypeError):
            schedule_config = {}
    schedule_config = schedule_config or {}
    cron_expr = schedule_config.get("cron", "")
    period = _derive_period_from_cron(cron_expr) if cron_expr else "daily"

    # Parse habit_history
    history_raw = rule.get("habit_history")
    if isinstance(history_raw, str) and history_raw.strip():
        try:
            habit_history = json.loads(history_raw)
        except (json.JSONDecodeError, TypeError):
            habit_history = []
    else:
        habit_history = history_raw if isinstance(history_raw, list) else []

    if not isinstance(habit_history, list):
        habit_history = []

    # Determine current period boundaries
    period_start = _get_period_start(now, period)
    period_end = _get_period_end(now, period)

    # Current status: check if there's an "achieved" entry in the current period
    current_status = "due"
    for entry in habit_history:
        entry_date_str = entry.get("date", "")
        try:
            entry_date = datetime.strptime(entry_date_str, "%Y-%m-%d")
        except (ValueError, TypeError):
            continue
        if period_start <= entry_date < period_end:
            if entry.get("status") == "achieved":
                current_status = "achieved"
                break
            elif entry.get("status") == "missed":
                current_status = "missed"

    # If still "due", check if the period has passed without execution
    # (only relevant if we're past the scheduled time in the current period)
    # For now, "due" means no entry yet for this period

    # Compute streak (consecutive achieved periods, counting backward from most recent)
    streak = _compute_streak(habit_history, period, now)

    # Compute success_rate (achieved / total periods in the history window)
    success_rate = _compute_success_rate(habit_history)

    # Find last_achieved_datetime
    last_achieved_datetime = None
    for entry in reversed(habit_history):
        if entry.get("status") == "achieved":
            last_achieved_datetime = entry.get("executed_datetime")
            break

    return {
        "current_status": current_status,
        "streak": streak,
        "success_rate": success_rate,
        "last_achieved_datetime": last_achieved_datetime,
        "period": period,
    }


def _get_period_start(now: datetime, period: str) -> datetime:
    """Get the start of the current period (midnight UTC)."""
    if period == "daily":
        return datetime(now.year, now.month, now.day)
    elif period == "weekly":
        # Start of week (Monday)
        days_since_monday = now.weekday()  # Mon=0
        start = now - timedelta(days=days_since_monday)
        return datetime(start.year, start.month, start.day)
    elif period == "monthly":
        return datetime(now.year, now.month, 1)
    return datetime(now.year, now.month, now.day)


def _get_period_end(now: datetime, period: str) -> datetime:
    """Get the end of the current period (start of next period)."""
    if period == "daily":
        return datetime(now.year, now.month, now.day) + timedelta(days=1)
    elif period == "weekly":
        days_since_monday = now.weekday()
        start = now - timedelta(days=days_since_monday)
        end = start + timedelta(days=7)
        return datetime(end.year, end.month, end.day)
    elif period == "monthly":
        if now.month == 12:
            return datetime(now.year + 1, 1, 1)
        return datetime(now.year, now.month + 1, 1)
    return datetime(now.year, now.month, now.day) + timedelta(days=1)


def _compute_streak(habit_history: list, period: str, now: datetime) -> int:
    """Compute consecutive achieved periods counting backward from the most recent."""
    if not habit_history:
        return 0

    # Group entries by period and check if each period was achieved
    # Work backward from the current period
    streak = 0
    check_date = now

    # Look back up to 365 periods max
    for _ in range(365):
        period_start = _get_period_start(check_date, period)
        period_end = _get_period_end(check_date, period)

        # Check if any entry in this period is "achieved"
        achieved_in_period = False
        for entry in habit_history:
            entry_date_str = entry.get("date", "")
            try:
                entry_date = datetime.strptime(entry_date_str, "%Y-%m-%d")
            except (ValueError, TypeError):
                continue
            if period_start <= entry_date < period_end:
                if entry.get("status") == "achieved":
                    achieved_in_period = True
                    break

        if achieved_in_period:
            streak += 1
        else:
            # If this is the current period and it's still "due" (not yet missed),
            # skip it and continue checking previous periods
            if period_start <= now < period_end and streak == 0:
                # Current period hasn't ended yet — don't break streak
                pass
            else:
                break

        # Move to previous period
        if period == "daily":
            check_date = period_start - timedelta(days=1)
        elif period == "weekly":
            check_date = period_start - timedelta(days=1)
        elif period == "monthly":
            check_date = period_start - timedelta(days=1)
        else:
            check_date = period_start - timedelta(days=1)

    return streak


def _compute_success_rate(habit_history: list) -> float:
    """Compute success rate as achieved / total entries in history."""
    if not habit_history:
        return 0.0

    total = len(habit_history)
    achieved = sum(1 for entry in habit_history if entry.get("status") == "achieved")

    if total == 0:
        return 0.0

    return round(achieved / total, 2)


def _deserialize_rule(rule: dict) -> dict:
    """Deserialize JSON-stored fields on a rule dict for API responses."""
    rule["conditions"] = deserialize_json_field(rule.get("conditions"))
    rule["actions"] = deserialize_json_field(rule.get("actions"))
    rule["schedule_config"] = deserialize_json_field(rule.get("schedule_config"))
    rule["habit_trigger_config"] = deserialize_json_field(rule.get("habit_trigger_config"))
    rule["enabled"] = bool(rule.get("enabled", 1))
    rule["confirm_before_apply"] = bool(rule.get("confirm_before_apply", 1))

    # Compute habit_summary for habit rules
    if rule.get("habit_mode"):
        rule["habit_summary"] = _compute_habit_summary(rule)
        # Also deserialize habit_history for the response
        history_raw = rule.get("habit_history")
        if isinstance(history_raw, str) and history_raw.strip():
            try:
                rule["habit_history"] = json.loads(history_raw)
            except (json.JSONDecodeError, TypeError):
                rule["habit_history"] = []
        elif not isinstance(history_raw, list):
            rule["habit_history"] = []

    return rule


def _deserialize_confirmation(conf: dict) -> dict:
    """Deserialize JSON-stored fields on a confirmation dict."""
    conf["action_data"] = deserialize_json_field(conf.get("action_data"))
    return conf


# ── Rules CRUD ────────────────────────────────────────────────────────

@router.get("")
def list_rules(request: Request, habit: Optional[str] = Query(None)):
    """List all rules for the authenticated user, sorted by priority ASC.

    Query params:
        habit=true — filter to only habit-mode rules
    """
    conn = None
    try:
        user_id = request.state.user_id
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM rules WHERE owner_id = ? ORDER BY priority ASC",
            (user_id,),
        )
        rules = []
        for row in cursor.fetchall():
            rule = row_to_dict(cursor, row)
            # Filter to habit rules if ?habit=true
            if habit and habit.lower() == "true":
                if not rule.get("habit_mode"):
                    continue
            rules.append(_deserialize_rule(rule))
        return rules
    except Exception as e:
        logger.error(f"Error listing rules: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to list rules: {str(e)}")
    finally:
        if conn:
            conn.close()


@router.get("/log")
def get_all_execution_logs(
    request: Request,
    rule_id: Optional[str] = Query(None),
    since: Optional[str] = Query(None),
    until: Optional[str] = Query(None),
    limit: int = Query(50),
    offset: int = Query(0),
):
    """Execution log across all rules for the authenticated user, with optional filters."""
    conn = None
    try:
        user_id = request.state.user_id
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        if limit < 0:
            limit = 0
        if offset < 0:
            offset = 0

        base = "FROM rule_execution_log WHERE owner_id = ?"
        params = [user_id]

        if rule_id:
            base += " AND rule_id = ?"
            params.append(rule_id)
        if since:
            base += " AND executed_datetime >= ?"
            params.append(since)
        if until:
            base += " AND executed_datetime <= ?"
            params.append(until)

        # Total count
        cursor.execute(f"SELECT COUNT(*) {base}", params)
        total = cursor.fetchone()[0]

        # Paginated entries
        cursor.execute(
            f"SELECT * {base} ORDER BY executed_datetime DESC LIMIT ? OFFSET ?",
            params + [limit, offset],
        )
        entries = []
        for row in cursor.fetchall():
            entries.append(row_to_dict(cursor, row))

        return {"entries": entries, "total": total}
    except Exception as e:
        logger.error(f"Error fetching execution logs: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch execution logs: {str(e)}")
    finally:
        if conn:
            conn.close()


@router.get("/confirmations")
def list_confirmations(request: Request):
    """List pending confirmations for the authenticated user, sorted by timestamp DESC."""
    conn = None
    try:
        user_id = request.state.user_id
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM rule_confirmations WHERE owner_id = ? ORDER BY created_datetime DESC",
            (user_id,),
        )
        confirmations = []
        for row in cursor.fetchall():
            conf = row_to_dict(cursor, row)
            confirmations.append(_deserialize_confirmation(conf))
        return confirmations
    except Exception as e:
        logger.error(f"Error listing confirmations: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to list confirmations: {str(e)}")
    finally:
        if conn:
            conn.close()


@router.get("/{rule_id}")
def get_rule(rule_id: str, request: Request):
    """Get a single rule by ID. Returns 404 if not owned by authenticated user."""
    conn = None
    try:
        user_id = request.state.user_id
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM rules WHERE id = ? AND owner_id = ?",
            (rule_id, user_id),
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Rule not found")
        rule = row_to_dict(cursor, row)
        return _deserialize_rule(rule)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching rule {rule_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch rule: {str(e)}")
    finally:
        if conn:
            conn.close()


@router.post("")
def create_rule(rule: RuleCreate, request: Request):
    """Create a new rule. UUID generated, owner_id set from authenticated user."""
    conn = None
    try:
        user_id = request.state.user_id
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        rule_id = str(uuid4())
        current_time = datetime.utcnow().isoformat()

        cursor.execute(
            """
            INSERT INTO rules (
                id, owner_id, name, description, enabled, priority,
                trigger_type, conditions, actions, confirm_before_apply,
                schedule_config, created_datetime, modified_datetime,
                last_run_datetime, run_count, last_run_result,
                habit_mode, habit_trigger_config
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                rule_id,
                user_id,
                rule.name,
                rule.description,
                1 if rule.enabled else 0,
                rule.priority if rule.priority is not None else 0,
                rule.trigger_type,
                serialize_json_field(rule.conditions),
                serialize_json_field(rule.actions),
                1 if rule.confirm_before_apply else 0,
                serialize_json_field(rule.schedule_config),
                current_time,
                current_time,
                None,
                0,
                None,
                1 if rule.habit_mode else 0,
                serialize_json_field(rule.habit_trigger_config),
            ),
        )
        conn.commit()

        # Return the created rule
        return {
            "id": rule_id,
            "owner_id": user_id,
            "name": rule.name,
            "description": rule.description,
            "enabled": bool(rule.enabled),
            "priority": rule.priority if rule.priority is not None else 0,
            "trigger_type": rule.trigger_type,
            "conditions": rule.conditions,
            "actions": rule.actions,
            "confirm_before_apply": bool(rule.confirm_before_apply),
            "schedule_config": rule.schedule_config,
            "habit_trigger_config": rule.habit_trigger_config,
            "created_datetime": current_time,
            "modified_datetime": current_time,
            "last_run_datetime": None,
            "run_count": 0,
            "last_run_result": None,
        }
    except Exception as e:
        logger.error(f"Error creating rule: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create rule: {str(e)}")
    finally:
        if conn:
            conn.close()


@router.put("/reorder")
def reorder_rules(reorder: RuleReorder, request: Request):
    """Accept an ordered list of rule IDs and update their priorities to match."""
    conn = None
    try:
        user_id = request.state.user_id
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        current_time = datetime.utcnow().isoformat()
        for index, rid in enumerate(reorder.rule_ids):
            cursor.execute(
                "UPDATE rules SET priority = ?, modified_datetime = ? WHERE id = ? AND owner_id = ?",
                (index, current_time, rid, user_id),
            )

        conn.commit()
        return {"message": "Rules reordered", "count": len(reorder.rule_ids)}
    except Exception as e:
        logger.error(f"Error reordering rules: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to reorder rules: {str(e)}")
    finally:
        if conn:
            conn.close()


@router.put("/{rule_id}")
def update_rule(rule_id: str, rule: RuleUpdate, request: Request):
    """Update an existing rule. Returns 404 if not owned by authenticated user."""
    conn = None
    try:
        user_id = request.state.user_id
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # Verify ownership
        cursor.execute(
            "SELECT * FROM rules WHERE id = ? AND owner_id = ?",
            (rule_id, user_id),
        )
        existing = cursor.fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Rule not found")

        existing_dict = row_to_dict(cursor, existing)
        current_time = datetime.utcnow().isoformat()

        # Build update fields — only update fields that were provided (not None)
        updates = []
        params = []

        if rule.name is not None:
            updates.append("name = ?")
            params.append(rule.name)
        if rule.description is not None:
            updates.append("description = ?")
            params.append(rule.description)
        if rule.enabled is not None:
            updates.append("enabled = ?")
            params.append(1 if rule.enabled else 0)
        if rule.priority is not None:
            updates.append("priority = ?")
            params.append(rule.priority)
        if rule.trigger_type is not None:
            updates.append("trigger_type = ?")
            params.append(rule.trigger_type)
        if rule.conditions is not None:
            updates.append("conditions = ?")
            params.append(serialize_json_field(rule.conditions))
        if rule.actions is not None:
            updates.append("actions = ?")
            params.append(serialize_json_field(rule.actions))
        if rule.confirm_before_apply is not None:
            updates.append("confirm_before_apply = ?")
            params.append(1 if rule.confirm_before_apply else 0)
        if rule.schedule_config is not None:
            updates.append("schedule_config = ?")
            params.append(serialize_json_field(rule.schedule_config))
        if rule.habit_trigger_config is not None:
            updates.append("habit_trigger_config = ?")
            params.append(serialize_json_field(rule.habit_trigger_config))

        # Always update modified_datetime
        updates.append("modified_datetime = ?")
        params.append(current_time)

        if updates:
            params.append(rule_id)
            cursor.execute(
                f"UPDATE rules SET {', '.join(updates)} WHERE id = ?",
                params,
            )

        conn.commit()

        # If this is a bundle rule, trigger reclassification in background
        cursor.execute(
            "SELECT bundle_id FROM bundle_rules WHERE rule_id = ? AND owner_id = ?",
            (rule_id, user_id),
        )
        is_bundle_rule = cursor.fetchone()
        if is_bundle_rule:
            import threading
            def _bg_reclass():
                try:
                    from src.backend.routes.bundles import reclassify_all_emails
                    reclassify_all_emails(user_id)
                except Exception as e:
                    logger.error(f"Reclassify after rule update failed: {e}")
            threading.Thread(target=_bg_reclass, daemon=True).start()

        # Return the updated rule
        cursor.execute(
            "SELECT * FROM rules WHERE id = ? AND owner_id = ?",
            (rule_id, user_id),
        )
        updated_row = cursor.fetchone()
        updated = row_to_dict(cursor, updated_row)
        return _deserialize_rule(updated)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating rule {rule_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update rule: {str(e)}")
    finally:
        if conn:
            conn.close()


@router.delete("/{rule_id}")
def delete_rule(rule_id: str, request: Request):
    """Delete a rule. Returns 404 if not owned by authenticated user."""
    conn = None
    try:
        user_id = request.state.user_id
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # Verify ownership
        cursor.execute(
            "SELECT id FROM rules WHERE id = ? AND owner_id = ?",
            (rule_id, user_id),
        )
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Rule not found")

        cursor.execute("DELETE FROM rules WHERE id = ?", (rule_id,))
        # Also clean up any pending confirmations for this rule
        cursor.execute("DELETE FROM rule_confirmations WHERE rule_id = ?", (rule_id,))
        conn.commit()

        return {"message": "Rule deleted", "id": rule_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting rule {rule_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete rule: {str(e)}")
    finally:
        if conn:
            conn.close()


@router.patch("/{rule_id}/toggle")
def toggle_rule(rule_id: str, request: Request):
    """Toggle the enabled flag of a rule. Returns 404 if not owned."""
    conn = None
    try:
        user_id = request.state.user_id
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        cursor.execute(
            "SELECT id, enabled FROM rules WHERE id = ? AND owner_id = ?",
            (rule_id, user_id),
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Rule not found")

        current_enabled = row[1]
        new_enabled = 0 if current_enabled else 1
        current_time = datetime.utcnow().isoformat()

        cursor.execute(
            "UPDATE rules SET enabled = ?, modified_datetime = ? WHERE id = ?",
            (new_enabled, current_time, rule_id),
        )
        conn.commit()

        return {"id": rule_id, "enabled": bool(new_enabled)}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error toggling rule {rule_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to toggle rule: {str(e)}")
    finally:
        if conn:
            conn.close()


# ── Confirmations ─────────────────────────────────────────────────────

@router.post("/confirmations/{confirmation_id}/accept")
def accept_confirmation(confirmation_id: str, request: Request):
    """Execute the queued action and delete the confirmation record."""
    conn = None
    try:
        user_id = request.state.user_id
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        cursor.execute(
            "SELECT * FROM rule_confirmations WHERE id = ? AND owner_id = ?",
            (confirmation_id, user_id),
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Confirmation not found")

        conf = row_to_dict(cursor, row)
        action_data = deserialize_json_field(conf.get("action_data"))
        entity_type = conf.get("target_entity_type", "chit")
        entity_id = conf.get("target_entity_id", "")
        rule_name = conf.get("rule_name", "")
        rule_id = conf.get("rule_id", "")

        # Close the connection before calling execute_action (it opens its own)
        cursor.execute(
            "DELETE FROM rule_confirmations WHERE id = ?",
            (confirmation_id,),
        )
        conn.commit()
        conn.close()
        conn = None

        # Execute the queued action
        result = {"success": False, "message": "No action data"}
        if action_data and isinstance(action_data, dict):
            result = execute_action(
                action_data, entity_type, entity_id,
                user_id, rule_name, rule_id,
            )

        return {
            "message": "Confirmation accepted",
            "id": confirmation_id,
            "action_result": result,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error accepting confirmation {confirmation_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to accept confirmation: {str(e)}")
    finally:
        if conn:
            conn.close()


@router.post("/confirmations/{confirmation_id}/dismiss")
def dismiss_confirmation(confirmation_id: str, request: Request):
    """Discard the queued action and delete the confirmation record."""
    conn = None
    try:
        user_id = request.state.user_id
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        cursor.execute(
            "SELECT id FROM rule_confirmations WHERE id = ? AND owner_id = ?",
            (confirmation_id, user_id),
        )
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Confirmation not found")

        cursor.execute(
            "DELETE FROM rule_confirmations WHERE id = ?",
            (confirmation_id,),
        )
        conn.commit()

        return {"message": "Confirmation dismissed", "id": confirmation_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error dismissing confirmation {confirmation_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to dismiss confirmation: {str(e)}")
    finally:
        if conn:
            conn.close()


# ── Execution Logs ────────────────────────────────────────────────────

@router.get("/{rule_id}/log")
def get_rule_execution_log(
    rule_id: str,
    request: Request,
    limit: int = Query(50),
    offset: int = Query(0),
):
    """Execution log for a specific rule (paginated). Returns 404 if rule not owned."""
    conn = None
    try:
        user_id = request.state.user_id
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # Verify rule ownership
        cursor.execute(
            "SELECT id FROM rules WHERE id = ? AND owner_id = ?",
            (rule_id, user_id),
        )
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Rule not found")

        if limit < 0:
            limit = 0
        if offset < 0:
            offset = 0

        # Total count
        cursor.execute(
            "SELECT COUNT(*) FROM rule_execution_log WHERE rule_id = ? AND owner_id = ?",
            (rule_id, user_id),
        )
        total = cursor.fetchone()[0]

        # Paginated entries
        cursor.execute(
            "SELECT * FROM rule_execution_log WHERE rule_id = ? AND owner_id = ? "
            "ORDER BY executed_datetime DESC LIMIT ? OFFSET ?",
            (rule_id, user_id, limit, offset),
        )
        entries = []
        for row in cursor.fetchall():
            entries.append(row_to_dict(cursor, row))

        return {"entries": entries, "total": total}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching execution log for rule {rule_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch execution log: {str(e)}")
    finally:
        if conn:
            conn.close()
