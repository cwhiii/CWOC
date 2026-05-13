"""Custom Objects API routes for the CWOC backend.

Provides CRUD endpoints for managing Custom Objects in the generic registry,
including listing, creating, updating, soft-deleting, and restoring objects.
Zone assignment endpoints are handled separately (see task 2.3).
"""

import json
import logging
import sqlite3
from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query, Request

from src.backend.db import DB_PATH
from src.backend.models import (
    BulkReorderRequest,
    CustomObjectCreate,
    CustomObjectUpdate,
    ZoneAssignmentCreate,
    ZoneAssignmentUpdate,
)


logger = logging.getLogger(__name__)
router = APIRouter()

VALID_VALUE_TYPES = ["integer", "decimal", "boolean", "string"]


# ═══════════════════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════════════════

def _row_to_dict(row, cursor) -> dict:
    """Convert a sqlite3 Row to a plain dict using cursor.description."""
    columns = [col[0] for col in cursor.description]
    return dict(zip(columns, row))


def _format_object(obj: dict) -> dict:
    """Format a custom_objects row dict for API response."""
    # Convert integer flags to booleans
    obj["active"] = bool(obj.get("active", 1))
    obj["deleted"] = bool(obj.get("deleted", 0))
    obj["is_standard"] = bool(obj.get("is_standard", 0))
    # Parse conditional_display from JSON string
    cd = obj.get("conditional_display")
    if cd and isinstance(cd, str):
        try:
            obj["conditional_display"] = json.loads(cd)
        except (json.JSONDecodeError, ValueError):
            obj["conditional_display"] = None
    return obj


def _get_zone_assignments(conn, custom_object_id: str, owner_id: str) -> list:
    """Fetch zone assignments for a custom object."""
    cursor = conn.cursor()
    cursor.execute(
        "SELECT zone_id, config, sort_order FROM zone_assignments "
        "WHERE custom_object_id = ? AND owner_id = ?",
        (custom_object_id, owner_id)
    )
    assignments = []
    for row in cursor.fetchall():
        config = row[1]
        if config and isinstance(config, str):
            try:
                config = json.loads(config)
            except (json.JSONDecodeError, ValueError):
                config = None
        assignments.append({
            "zone_id": row[0],
            "config": config,
            "sort_order": row[2],
        })
    return assignments


# ═══════════════════════════════════════════════════════════════════════════
# GET /api/custom-objects — List all objects for user
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/api/custom-objects")
async def list_custom_objects(
    request: Request,
    type: str = Query(None),
):
    """List all custom objects for the authenticated user.

    Optional query params:
      - type: filter by object type
    """
    conn = None
    try:
        owner_id = request.state.user_id
        conn = sqlite3.connect(DB_PATH)
        conn.execute("PRAGMA busy_timeout=5000")

        query = "SELECT * FROM custom_objects WHERE owner_id = ? AND deleted = 0"
        params = [owner_id]

        if type:
            query += " AND type = ?"
            params.append(type)

        query += " ORDER BY sort_order ASC, name ASC"

        cursor = conn.cursor()
        cursor.execute(query, params)
        rows = cursor.fetchall()

        results = []
        for row in rows:
            obj = _row_to_dict(row, cursor)
            obj = _format_object(obj)
            obj["zone_assignments"] = _get_zone_assignments(conn, obj["id"], owner_id)
            results.append(obj)

        return results

    except Exception as e:
        logger.error(f"Error listing custom objects: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        if conn:
            conn.close()


# ═══════════════════════════════════════════════════════════════════════════
# POST /api/custom-objects — Create new object
# ═══════════════════════════════════════════════════════════════════════════

@router.post("/api/custom-objects")
async def create_custom_object(request: Request, obj: CustomObjectCreate):
    """Create a new custom object.

    Validates value_type, enforces unique constraint (type + category + name + owner),
    generates UUID, sets timestamps.
    """
    conn = None
    try:
        owner_id = request.state.user_id

        # Validate value_type
        if obj.value_type not in VALID_VALUE_TYPES:
            raise HTTPException(
                status_code=422,
                detail="value_type must be one of: integer, decimal, boolean, string"
            )

        now = datetime.utcnow().isoformat() + "Z"
        obj_id = str(uuid4())

        # Serialize conditional_display to JSON string
        cond_display = None
        if obj.conditional_display:
            cond_display = json.dumps(obj.conditional_display)

        conn = sqlite3.connect(DB_PATH)
        conn.execute("PRAGMA busy_timeout=5000")
        cursor = conn.cursor()

        try:
            cursor.execute(
                """INSERT INTO custom_objects
                   (id, type, sub_type, category, name, value_type, units,
                    metric_units, range_min, range_max, active, deleted,
                    sort_order, is_standard, conditional_display, owner_id,
                    created_datetime, modified_datetime)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, 0, 0, ?, ?, ?, ?)""",
                (obj_id, obj.type, obj.sub_type, None, obj.name,
                 obj.value_type, obj.units, obj.metric_units,
                 obj.range_min, obj.range_max,
                 cond_display, owner_id, now, now)
            )
            conn.commit()
        except sqlite3.IntegrityError:
            raise HTTPException(
                status_code=409,
                detail=f"A custom object with this name already exists in type '{obj.type}'"
            )

        # Return the created object
        result = {
            "id": obj_id,
            "type": obj.type,
            "sub_type": obj.sub_type,
            "name": obj.name,
            "value_type": obj.value_type,
            "units": obj.units,
            "metric_units": obj.metric_units,
            "range_min": obj.range_min,
            "range_max": obj.range_max,
            "active": True,
            "deleted": False,
            "sort_order": 0,
            "is_standard": False,
            "conditional_display": obj.conditional_display,
            "owner_id": owner_id,
            "created_datetime": now,
            "modified_datetime": now,
            "zone_assignments": [],
        }
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating custom object: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        if conn:
            conn.close()


# ═══════════════════════════════════════════════════════════════════════════
# PUT /api/custom-objects/{id} — Update mutable fields
# ═══════════════════════════════════════════════════════════════════════════

@router.put("/api/custom-objects/{id}")
async def update_custom_object(request: Request, id: str, updates: CustomObjectUpdate):
    """Update an existing custom object's mutable fields.

    Updates modified_datetime on success.
    """
    conn = None
    try:
        owner_id = request.state.user_id
        conn = sqlite3.connect(DB_PATH)
        conn.execute("PRAGMA busy_timeout=5000")
        cursor = conn.cursor()

        # Verify the object exists and belongs to this user
        cursor.execute(
            "SELECT id FROM custom_objects WHERE id = ? AND owner_id = ?",
            (id, owner_id)
        )
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail=f"Custom object {id} not found")

        # Build dynamic UPDATE statement from provided fields
        fields_to_update = []
        values = []

        if updates.name is not None:
            fields_to_update.append("name = ?")
            values.append(updates.name)
        if updates.sub_type is not None:
            fields_to_update.append("sub_type = ?")
            values.append(updates.sub_type)
        if updates.units is not None:
            fields_to_update.append("units = ?")
            values.append(updates.units)
        if updates.metric_units is not None:
            fields_to_update.append("metric_units = ?")
            values.append(updates.metric_units)
        if updates.range_min is not None:
            fields_to_update.append("range_min = ?")
            values.append(updates.range_min)
        if updates.range_max is not None:
            fields_to_update.append("range_max = ?")
            values.append(updates.range_max)
        if updates.active is not None:
            fields_to_update.append("active = ?")
            values.append(1 if updates.active else 0)
        if updates.sort_order is not None:
            fields_to_update.append("sort_order = ?")
            values.append(updates.sort_order)
        if updates.conditional_display is not None:
            fields_to_update.append("conditional_display = ?")
            values.append(json.dumps(updates.conditional_display))

        if not fields_to_update:
            raise HTTPException(status_code=400, detail="No fields to update")

        # Always update modified_datetime
        now = datetime.utcnow().isoformat() + "Z"
        fields_to_update.append("modified_datetime = ?")
        values.append(now)

        # Add WHERE clause params
        values.append(id)
        values.append(owner_id)

        cursor.execute(
            f"UPDATE custom_objects SET {', '.join(fields_to_update)} "
            f"WHERE id = ? AND owner_id = ?",
            values
        )
        conn.commit()

        # Return the updated object
        cursor.execute("SELECT * FROM custom_objects WHERE id = ?", (id,))
        row = cursor.fetchone()
        obj = _row_to_dict(row, cursor)
        obj = _format_object(obj)
        obj["zone_assignments"] = _get_zone_assignments(conn, id, owner_id)
        return obj

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating custom object: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        if conn:
            conn.close()


# ═══════════════════════════════════════════════════════════════════════════
# DELETE /api/custom-objects/{id} — Soft-delete
# ═══════════════════════════════════════════════════════════════════════════

@router.delete("/api/custom-objects/{id}")
async def delete_custom_object(request: Request, id: str):
    """Soft-delete a custom object (sets active=0, deleted=1)."""
    conn = None
    try:
        owner_id = request.state.user_id
        conn = sqlite3.connect(DB_PATH)
        conn.execute("PRAGMA busy_timeout=5000")
        cursor = conn.cursor()

        # Verify the object exists and belongs to this user
        cursor.execute(
            "SELECT id FROM custom_objects WHERE id = ? AND owner_id = ?",
            (id, owner_id)
        )
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail=f"Custom object {id} not found")

        now = datetime.utcnow().isoformat() + "Z"
        cursor.execute(
            "UPDATE custom_objects SET active = 0, deleted = 1, modified_datetime = ? "
            "WHERE id = ? AND owner_id = ?",
            (now, id, owner_id)
        )
        conn.commit()

        return {"detail": "Custom object deleted", "id": id}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting custom object: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        if conn:
            conn.close()


# ═══════════════════════════════════════════════════════════════════════════
# POST /api/custom-objects/{id}/restore — Restore soft-deleted standard object
# ═══════════════════════════════════════════════════════════════════════════

@router.post("/api/custom-objects/{id}/restore")
async def restore_custom_object(request: Request, id: str):
    """Restore a soft-deleted standard custom object.

    Returns 400 if the object is not a standard (seeded) object.
    """
    conn = None
    try:
        owner_id = request.state.user_id
        conn = sqlite3.connect(DB_PATH)
        conn.execute("PRAGMA busy_timeout=5000")
        cursor = conn.cursor()

        # Verify the object exists and belongs to this user
        cursor.execute(
            "SELECT id, is_standard, deleted FROM custom_objects WHERE id = ? AND owner_id = ?",
            (id, owner_id)
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail=f"Custom object {id} not found")

        is_standard = row[1]
        if not is_standard:
            raise HTTPException(
                status_code=400,
                detail="Only standard objects can be restored"
            )

        now = datetime.utcnow().isoformat() + "Z"
        cursor.execute(
            "UPDATE custom_objects SET active = 1, deleted = 0, modified_datetime = ? "
            "WHERE id = ? AND owner_id = ?",
            (now, id, owner_id)
        )
        conn.commit()

        # Return the restored object
        cursor.execute("SELECT * FROM custom_objects WHERE id = ?", (id,))
        restored_row = cursor.fetchone()
        obj = _row_to_dict(restored_row, cursor)
        obj = _format_object(obj)
        obj["zone_assignments"] = _get_zone_assignments(conn, id, owner_id)
        return obj

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error restoring custom object: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        if conn:
            conn.close()


# ═══════════════════════════════════════════════════════════════════════════
# GET /api/custom-objects/zone/{zone_id} — Active objects assigned to zone
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/api/custom-objects/zone/{zone_id}")
async def get_objects_by_zone(request: Request, zone_id: str):
    """Return all active custom objects assigned to a specific zone.

    Joins custom_objects with zone_assignments, filters by zone_id and active=1.
    Includes zone-specific config from the assignment in each result.
    """
    conn = None
    try:
        owner_id = request.state.user_id
        conn = sqlite3.connect(DB_PATH)
        conn.execute("PRAGMA busy_timeout=5000")
        cursor = conn.cursor()

        cursor.execute(
            """SELECT co.*, za.config AS zone_config, za.sort_order AS zone_sort_order
               FROM custom_objects co
               JOIN zone_assignments za ON za.custom_object_id = co.id
               WHERE za.zone_id = ? AND za.owner_id = ? AND co.owner_id = ?
                 AND co.active = 1 AND co.deleted = 0
               ORDER BY za.sort_order ASC, co.name ASC""",
            (zone_id, owner_id, owner_id)
        )
        rows = cursor.fetchall()

        results = []
        for row in rows:
            obj = _row_to_dict(row, cursor)
            # Extract zone-specific fields before formatting
            zone_config = obj.pop("zone_config", None)
            zone_sort_order = obj.pop("zone_sort_order", 0)

            obj = _format_object(obj)

            # Parse zone config from JSON string
            if zone_config and isinstance(zone_config, str):
                try:
                    zone_config = json.loads(zone_config)
                except (json.JSONDecodeError, ValueError):
                    zone_config = None

            obj["zone_config"] = zone_config
            obj["zone_sort_order"] = zone_sort_order
            results.append(obj)

        return results

    except Exception as e:
        logger.error(f"Error fetching objects for zone '{zone_id}': {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        if conn:
            conn.close()


# ═══════════════════════════════════════════════════════════════════════════
# POST /api/custom-objects/{id}/assign — Create zone assignment
# ═══════════════════════════════════════════════════════════════════════════

@router.post("/api/custom-objects/{id}/assign")
async def create_zone_assignment(request: Request, id: str, assignment: ZoneAssignmentCreate):
    """Create a new zone assignment for a custom object.

    Returns 404 if the object doesn't exist.
    Returns 409 if the object is already assigned to the specified zone.
    """
    conn = None
    try:
        owner_id = request.state.user_id
        conn = sqlite3.connect(DB_PATH)
        conn.execute("PRAGMA busy_timeout=5000")
        cursor = conn.cursor()

        # Verify the object exists and belongs to this user
        cursor.execute(
            "SELECT id FROM custom_objects WHERE id = ? AND owner_id = ?",
            (id, owner_id)
        )
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail=f"Custom object {id} not found")

        assignment_id = str(uuid4())

        # Serialize config to JSON string
        config_str = None
        if assignment.config is not None:
            config_str = json.dumps(assignment.config)

        try:
            cursor.execute(
                """INSERT INTO zone_assignments
                   (id, custom_object_id, zone_id, config, sort_order, owner_id)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (assignment_id, id, assignment.zone_id, config_str,
                 assignment.sort_order, owner_id)
            )
            conn.commit()
        except sqlite3.IntegrityError:
            raise HTTPException(
                status_code=409,
                detail=f"Object is already assigned to zone '{assignment.zone_id}'"
            )

        return {
            "id": assignment_id,
            "custom_object_id": id,
            "zone_id": assignment.zone_id,
            "config": assignment.config,
            "sort_order": assignment.sort_order,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating zone assignment: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        if conn:
            conn.close()


# ═══════════════════════════════════════════════════════════════════════════
# PUT /api/custom-objects/{id}/assign/{zone_id} — Update zone assignment
# ═══════════════════════════════════════════════════════════════════════════

@router.put("/api/custom-objects/{id}/assign/{zone_id}")
async def update_zone_assignment(
    request: Request, id: str, zone_id: str, updates: ZoneAssignmentUpdate
):
    """Update an existing zone assignment's config and/or sort_order.

    Returns 404 if the assignment doesn't exist.
    """
    conn = None
    try:
        owner_id = request.state.user_id
        conn = sqlite3.connect(DB_PATH)
        conn.execute("PRAGMA busy_timeout=5000")
        cursor = conn.cursor()

        # Verify the assignment exists
        cursor.execute(
            """SELECT id FROM zone_assignments
               WHERE custom_object_id = ? AND zone_id = ? AND owner_id = ?""",
            (id, zone_id, owner_id)
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Zone assignment not found")

        assignment_id = row[0]

        # Build dynamic UPDATE
        fields_to_update = []
        values = []

        if updates.config is not None:
            fields_to_update.append("config = ?")
            values.append(json.dumps(updates.config))
        if updates.sort_order is not None:
            fields_to_update.append("sort_order = ?")
            values.append(updates.sort_order)

        if not fields_to_update:
            raise HTTPException(status_code=400, detail="No fields to update")

        values.append(assignment_id)

        cursor.execute(
            f"UPDATE zone_assignments SET {', '.join(fields_to_update)} WHERE id = ?",
            values
        )
        conn.commit()

        # Return the updated assignment
        cursor.execute(
            "SELECT id, custom_object_id, zone_id, config, sort_order FROM zone_assignments WHERE id = ?",
            (assignment_id,)
        )
        updated_row = cursor.fetchone()
        config_val = updated_row[3]
        if config_val and isinstance(config_val, str):
            try:
                config_val = json.loads(config_val)
            except (json.JSONDecodeError, ValueError):
                config_val = None

        return {
            "id": updated_row[0],
            "custom_object_id": updated_row[1],
            "zone_id": updated_row[2],
            "config": config_val,
            "sort_order": updated_row[4],
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating zone assignment: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        if conn:
            conn.close()


# ═══════════════════════════════════════════════════════════════════════════
# DELETE /api/custom-objects/{id}/assign/{zone_id} — Remove zone assignment
# ═══════════════════════════════════════════════════════════════════════════

@router.delete("/api/custom-objects/{id}/assign/{zone_id}")
async def delete_zone_assignment(request: Request, id: str, zone_id: str):
    """Remove a zone assignment for a custom object.

    Returns 404 if the assignment doesn't exist.
    """
    conn = None
    try:
        owner_id = request.state.user_id
        conn = sqlite3.connect(DB_PATH)
        conn.execute("PRAGMA busy_timeout=5000")
        cursor = conn.cursor()

        # Verify the assignment exists
        cursor.execute(
            """SELECT id FROM zone_assignments
               WHERE custom_object_id = ? AND zone_id = ? AND owner_id = ?""",
            (id, zone_id, owner_id)
        )
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Zone assignment not found")

        cursor.execute(
            """DELETE FROM zone_assignments
               WHERE custom_object_id = ? AND zone_id = ? AND owner_id = ?""",
            (id, zone_id, owner_id)
        )
        conn.commit()

        return {"detail": "Zone assignment removed", "custom_object_id": id, "zone_id": zone_id}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting zone assignment: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        if conn:
            conn.close()


# ═══════════════════════════════════════════════════════════════════════════
# PUT /api/custom-objects/zone/{zone_id}/reorder — Bulk reorder assignments
# ═══════════════════════════════════════════════════════════════════════════

@router.put("/api/custom-objects/zone/{zone_id}/reorder")
async def bulk_reorder_zone_assignments(
    request: Request, zone_id: str, body: BulkReorderRequest
):
    """Bulk update sort_order for zone assignments.

    Accepts an ordered list of custom_object_ids and assigns sequential
    sort_order values (1, 2, 3, ...). IDs without an existing zone_assignment
    for this zone are skipped without error.
    """
    conn = None
    try:
        owner_id = request.state.user_id

        if not body.object_ids:
            raise HTTPException(status_code=400, detail="object_ids list is required")

        conn = sqlite3.connect(DB_PATH)
        conn.execute("PRAGMA busy_timeout=5000")
        cursor = conn.cursor()

        updated = 0
        for idx, obj_id in enumerate(body.object_ids, start=1):
            cursor.execute(
                """UPDATE zone_assignments SET sort_order = ?
                   WHERE custom_object_id = ? AND zone_id = ? AND owner_id = ?""",
                (idx, obj_id, zone_id, owner_id)
            )
            if cursor.rowcount > 0:
                updated += 1

        conn.commit()

        return {"detail": "Reorder complete", "updated": updated}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error reordering zone assignments for '{zone_id}': {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        if conn:
            conn.close()
