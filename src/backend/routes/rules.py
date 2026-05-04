"""Rules CRUD API routes for the CWOC backend.

Provides endpoints for creating, reading, updating, deleting rules,
toggling enabled state, reordering priorities, managing pending
confirmations, and querying execution logs.
"""

import json
import logging
import sqlite3
from datetime import datetime
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query, Request

from src.backend.db import DB_PATH, serialize_json_field, deserialize_json_field
from src.backend.models import RuleCreate, RuleUpdate, RuleReorder
from src.backend.routes.audit import get_actor_from_request, insert_audit_entry, compute_audit_diff
from src.backend.rules_engine import execute_action


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/rules")


# ── Helper: deserialize JSON fields on a rule row dict ────────────────

def _deserialize_rule(rule: dict) -> dict:
    """Deserialize JSON-stored fields on a rule dict for API responses."""
    rule["conditions"] = deserialize_json_field(rule.get("conditions"))
    rule["actions"] = deserialize_json_field(rule.get("actions"))
    rule["schedule_config"] = deserialize_json_field(rule.get("schedule_config"))
    rule["enabled"] = bool(rule.get("enabled", 1))
    rule["confirm_before_apply"] = bool(rule.get("confirm_before_apply", 1))
    return rule


def _deserialize_confirmation(conf: dict) -> dict:
    """Deserialize JSON-stored fields on a confirmation dict."""
    conf["action_data"] = deserialize_json_field(conf.get("action_data"))
    return conf


def _row_to_dict(cursor, row) -> dict:
    """Convert a sqlite3 row tuple to a dict using cursor.description."""
    columns = [col[0] for col in cursor.description]
    return dict(zip(columns, row))


# ── Rules CRUD ────────────────────────────────────────────────────────

@router.get("")
def list_rules(request: Request):
    """List all rules for the authenticated user, sorted by priority ASC."""
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
            rule = _row_to_dict(cursor, row)
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
            entries.append(_row_to_dict(cursor, row))

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
            conf = _row_to_dict(cursor, row)
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
        rule = _row_to_dict(cursor, row)
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
                last_run_datetime, run_count, last_run_result
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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

        existing_dict = _row_to_dict(cursor, existing)
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

        # Return the updated rule
        cursor.execute(
            "SELECT * FROM rules WHERE id = ? AND owner_id = ?",
            (rule_id, user_id),
        )
        updated_row = cursor.fetchone()
        updated = _row_to_dict(cursor, updated_row)
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

        conf = _row_to_dict(cursor, row)
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
            entries.append(_row_to_dict(cursor, row))

        return {"entries": entries, "total": total}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching execution log for rule {rule_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch execution log: {str(e)}")
    finally:
        if conn:
            conn.close()
