"""Custom Zones API routes for the CWOC backend.

Provides CRUD endpoints for managing Custom Zones — user-defined named
collections of Custom Objects that render as collapsible zones in the chit editor.
"""

import logging
import re
import sqlite3
from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request

from src.backend.db import DB_PATH
from src.backend.models import CustomZoneCreate, CustomZoneUpdate


logger = logging.getLogger(__name__)
router = APIRouter()


# ═══════════════════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════════════════

def _slugify_zone_name(name: str) -> str:
    """Generate a zone_id from a user-provided name.

    Steps:
      1. Lowercase the name
      2. Replace non-alphanumeric characters with underscores
      3. Collapse consecutive underscores
      4. Strip leading/trailing underscores
      5. Prefix with 'cz_'
    """
    slug = name.lower()
    slug = re.sub(r'[^a-z0-9]', '_', slug)
    slug = re.sub(r'_+', '_', slug)
    slug = slug.strip('_')
    return f"cz_{slug}"


# ═══════════════════════════════════════════════════════════════════════════
# GET /api/custom-zones — List all zones for user
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/api/custom-zones")
async def list_custom_zones(request: Request):
    """List all custom zones for the authenticated user, ordered by sort_order.

    Includes object_count (number of zone_assignments for each zone).
    """
    conn = None
    try:
        owner_id = request.state.user_id
        conn = sqlite3.connect(DB_PATH)
        conn.execute("PRAGMA busy_timeout=5000")
        cursor = conn.cursor()

        cursor.execute(
            """SELECT cz.id, cz.zone_id, cz.name, cz.sort_order, cz.owner_id,
                      cz.created_datetime,
                      COUNT(za.id) AS object_count
               FROM custom_zones cz
               LEFT JOIN zone_assignments za ON za.zone_id = cz.zone_id AND za.owner_id = cz.owner_id
               WHERE cz.owner_id = ?
               GROUP BY cz.id
               ORDER BY cz.sort_order ASC, cz.name ASC""",
            (owner_id,)
        )
        rows = cursor.fetchall()

        results = []
        for row in rows:
            results.append({
                "id": row[0],
                "zone_id": row[1],
                "name": row[2],
                "sort_order": row[3],
                "owner_id": row[4],
                "created_datetime": row[5],
                "object_count": row[6],
            })

        return results

    except Exception as e:
        logger.error(f"Error listing custom zones: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        if conn:
            conn.close()


# ═══════════════════════════════════════════════════════════════════════════
# POST /api/custom-zones — Create a new zone
# ═══════════════════════════════════════════════════════════════════════════

@router.post("/api/custom-zones")
async def create_custom_zone(request: Request, zone: CustomZoneCreate):
    """Create a new custom zone.

    Accepts a name, generates zone_id via slugification.
    Validates non-empty name and checks uniqueness of zone_id per owner.
    """
    conn = None
    try:
        owner_id = request.state.user_id

        # Validate non-empty name
        name = zone.name.strip() if zone.name else ""
        if not name:
            raise HTTPException(status_code=422, detail="Zone name is required")

        # Generate zone_id from name
        zone_id = _slugify_zone_name(name)

        # Edge case: if slugification produces empty slug (e.g. name is all symbols)
        if zone_id == "cz_":
            raise HTTPException(status_code=422, detail="Zone name is required")

        now = datetime.utcnow().isoformat() + "Z"
        record_id = str(uuid4())

        conn = sqlite3.connect(DB_PATH)
        conn.execute("PRAGMA busy_timeout=5000")
        cursor = conn.cursor()

        try:
            cursor.execute(
                """INSERT INTO custom_zones (id, zone_id, name, sort_order, owner_id, created_datetime)
                   VALUES (?, ?, ?, 0, ?, ?)""",
                (record_id, zone_id, name, owner_id, now)
            )
            conn.commit()
        except sqlite3.IntegrityError:
            raise HTTPException(
                status_code=409,
                detail="A zone with this identifier already exists"
            )

        return {
            "id": record_id,
            "zone_id": zone_id,
            "name": name,
            "sort_order": 0,
            "owner_id": owner_id,
            "created_datetime": now,
            "object_count": 0,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating custom zone: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        if conn:
            conn.close()


# ═══════════════════════════════════════════════════════════════════════════
# PUT /api/custom-zones/{zone_id} — Update name and/or sort_order
# ═══════════════════════════════════════════════════════════════════════════

@router.put("/api/custom-zones/{zone_id}")
async def update_custom_zone(request: Request, zone_id: str, updates: CustomZoneUpdate):
    """Update an existing custom zone's name and/or sort_order.

    The zone_id does NOT change on rename — only the display name changes.
    """
    conn = None
    try:
        owner_id = request.state.user_id
        conn = sqlite3.connect(DB_PATH)
        conn.execute("PRAGMA busy_timeout=5000")
        cursor = conn.cursor()

        # Verify the zone exists and belongs to this user
        cursor.execute(
            "SELECT id FROM custom_zones WHERE zone_id = ? AND owner_id = ?",
            (zone_id, owner_id)
        )
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Zone not found")

        # Build dynamic UPDATE statement
        fields_to_update = []
        values = []

        if updates.name is not None:
            name = updates.name.strip()
            if not name:
                raise HTTPException(status_code=422, detail="Zone name is required")
            fields_to_update.append("name = ?")
            values.append(name)
        if updates.sort_order is not None:
            fields_to_update.append("sort_order = ?")
            values.append(updates.sort_order)

        if not fields_to_update:
            raise HTTPException(status_code=400, detail="No fields to update")

        values.append(zone_id)
        values.append(owner_id)

        cursor.execute(
            f"UPDATE custom_zones SET {', '.join(fields_to_update)} "
            f"WHERE zone_id = ? AND owner_id = ?",
            values
        )
        conn.commit()

        # Return the updated zone with object_count
        cursor.execute(
            """SELECT cz.id, cz.zone_id, cz.name, cz.sort_order, cz.owner_id,
                      cz.created_datetime,
                      COUNT(za.id) AS object_count
               FROM custom_zones cz
               LEFT JOIN zone_assignments za ON za.zone_id = cz.zone_id AND za.owner_id = cz.owner_id
               WHERE cz.zone_id = ? AND cz.owner_id = ?
               GROUP BY cz.id""",
            (zone_id, owner_id)
        )
        row = cursor.fetchone()

        return {
            "id": row[0],
            "zone_id": row[1],
            "name": row[2],
            "sort_order": row[3],
            "owner_id": row[4],
            "created_datetime": row[5],
            "object_count": row[6],
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating custom zone: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        if conn:
            conn.close()


# ═══════════════════════════════════════════════════════════════════════════
# DELETE /api/custom-zones/{zone_id} — Delete zone and cascade assignments
# ═══════════════════════════════════════════════════════════════════════════

@router.delete("/api/custom-zones/{zone_id}")
async def delete_custom_zone(request: Request, zone_id: str):
    """Delete a custom zone and cascade delete all its zone_assignments.

    Health_data on chits is NOT purged (data is preserved).
    """
    conn = None
    try:
        owner_id = request.state.user_id
        conn = sqlite3.connect(DB_PATH)
        conn.execute("PRAGMA busy_timeout=5000")
        cursor = conn.cursor()

        # Verify the zone exists and belongs to this user
        cursor.execute(
            "SELECT id FROM custom_zones WHERE zone_id = ? AND owner_id = ?",
            (zone_id, owner_id)
        )
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Zone not found")

        # Cascade delete all zone_assignments for this zone
        cursor.execute(
            "DELETE FROM zone_assignments WHERE zone_id = ? AND owner_id = ?",
            (zone_id, owner_id)
        )

        # Delete the zone record itself
        cursor.execute(
            "DELETE FROM custom_zones WHERE zone_id = ? AND owner_id = ?",
            (zone_id, owner_id)
        )
        conn.commit()

        return {"detail": "Zone deleted", "zone_id": zone_id}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting custom zone: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        if conn:
            conn.close()
