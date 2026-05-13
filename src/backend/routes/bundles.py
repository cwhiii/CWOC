"""Bundle CRUD API routes for the CWOC backend.

Provides endpoints for creating, reading, updating, deleting bundles,
reordering bundle display order, managing bundle-rule associations,
initializing default bundles for new users, and email classification
into bundles (single-placement and multi-placement).
"""

import logging
import sqlite3
from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request

from src.backend.db import DB_PATH, serialize_json_field, deserialize_json_field
from src.backend.models import BundleCreate, BundleUpdate, BundleReorder, BundleRuleAssociate
from src.backend.rules_engine import evaluate_condition_tree


logger = logging.getLogger(__name__)
bundles_router = APIRouter()


# ── Helpers ───────────────────────────────────────────────────────────────

def _row_to_dict(cursor, row) -> dict:
    """Convert a sqlite3 row tuple to a dict using cursor.description."""
    columns = [col[0] for col in cursor.description]
    return dict(zip(columns, row))


def _query_bundles(cursor, owner_id: str) -> list:
    """Query all bundles for an owner, sorted by display_order ASC.
    Includes associated rule_ids for each bundle."""
    cursor.execute(
        "SELECT * FROM bundles WHERE owner_id = ? ORDER BY display_order ASC",
        (owner_id,),
    )
    bundles = []
    for row in cursor.fetchall():
        bundle = _row_to_dict(cursor, row)
        # Fetch associated rule_ids
        cursor.execute(
            "SELECT rule_id FROM bundle_rules WHERE bundle_id = ? AND owner_id = ?",
            (bundle["id"], owner_id),
        )
        bundle["rule_ids"] = [r[0] for r in cursor.fetchall()]
        bundles.append(bundle)
    return bundles


def _rename_bundle_tags(cursor, owner_id: str, old_name: str, new_name: str):
    """Update bundle tags on all chits when a bundle is renamed."""
    old_tag = f"CWOC_System/Bundle/{old_name}"
    new_tag = f"CWOC_System/Bundle/{new_name}"

    cursor.execute(
        "SELECT id, tags FROM chits WHERE owner_id = ? AND tags LIKE ?",
        (owner_id, f'%{old_tag}%'),
    )
    for row in cursor.fetchall():
        chit_id, tags_raw = row
        tags = deserialize_json_field(tags_raw) or []
        tags = [new_tag if t == old_tag else t for t in tags]
        cursor.execute(
            "UPDATE chits SET tags = ?, modified_datetime = ? WHERE id = ?",
            (serialize_json_field(tags), datetime.utcnow().isoformat(), chit_id),
        )


def _remove_bundle_tag_from_chits(cursor, owner_id: str, bundle_name: str):
    """Remove a bundle tag from all chits that have it."""
    tag = f"CWOC_System/Bundle/{bundle_name}"

    cursor.execute(
        "SELECT id, tags FROM chits WHERE owner_id = ? AND tags LIKE ?",
        (owner_id, f'%{tag}%'),
    )
    for row in cursor.fetchall():
        chit_id, tags_raw = row
        tags = deserialize_json_field(tags_raw) or []
        tags = [t for t in tags if t != tag]
        cursor.execute(
            "UPDATE chits SET tags = ?, modified_datetime = ? WHERE id = ?",
            (serialize_json_field(tags), datetime.utcnow().isoformat(), chit_id),
        )


def _initialize_default_bundles(owner_id: str):
    """Create the two default bundles and the From Contacts rule.

    - "From Contacts" (display_order=0, is_default=True, removable=True)
    - "Everything Else" (display_order=1, is_default=True, removable=False)

    Also creates a rule for "From Contacts" with:
    - trigger_type: "email_received"
    - condition: email_from contains_contact_email
    - action: add_tag "CWOC_System/Bundle/From Contacts"

    Skips if bundles already exist for this owner.
    """
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # Check if bundles already exist for this owner
        cursor.execute("SELECT COUNT(*) FROM bundles WHERE owner_id = ?", (owner_id,))
        if cursor.fetchone()[0] > 0:
            logger.debug(f"Bundles already exist for user {owner_id}, skipping initialization")
            return

        current_time = datetime.utcnow().isoformat()

        # Create "From Contacts" bundle
        from_contacts_id = str(uuid4())
        cursor.execute(
            """INSERT INTO bundles (id, owner_id, name, description, display_order,
               is_default, removable, created_datetime, modified_datetime)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                from_contacts_id, owner_id, "From Contacts",
                "Emails from people in your contacts list",
                0, 1, 1, current_time, current_time,
            ),
        )

        # Create "Everything Else" bundle
        everything_else_id = str(uuid4())
        cursor.execute(
            """INSERT INTO bundles (id, owner_id, name, description, display_order,
               is_default, removable, created_datetime, modified_datetime)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                everything_else_id, owner_id, "Everything Else",
                "Emails not matched by any other bundle",
                1, 1, 0, current_time, current_time,
            ),
        )

        # Create the "From Contacts" rule
        rule_id = str(uuid4())
        conditions = {
            "type": "leaf",
            "field": "email_from",
            "operator": "contains_contact_email",
            "value": "",
        }
        actions = [
            {"type": "add_tag", "params": {"tag": "CWOC_System/Bundle/From Contacts"}}
        ]
        cursor.execute(
            """INSERT INTO rules (id, owner_id, name, trigger_type, enabled, priority,
               conditions, actions, confirm_before_apply, created_datetime, modified_datetime)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                rule_id, owner_id, "Bundle: From Contacts", "email_received",
                1, 0,
                serialize_json_field(conditions),
                serialize_json_field(actions),
                0, current_time, current_time,
            ),
        )

        # Associate the rule with the "From Contacts" bundle
        bundle_rule_id = str(uuid4())
        cursor.execute(
            """INSERT INTO bundle_rules (id, bundle_id, rule_id, owner_id, created_datetime)
               VALUES (?, ?, ?, ?, ?)""",
            (bundle_rule_id, from_contacts_id, rule_id, owner_id, current_time),
        )

        conn.commit()
        logger.info(f"Initialized default bundles for user {owner_id}")
    except Exception as e:
        logger.error(f"Error initializing default bundles: {str(e)}")
        raise
    finally:
        if conn:
            conn.close()


# ── Bundle CRUD Endpoints ─────────────────────────────────────────────────

@bundles_router.get("/api/bundles")
def get_bundles(request: Request):
    """List all bundles for the authenticated user.

    If no bundles exist, initializes defaults ("From Contacts", "Everything Else").
    Returns bundles with their associated rule_ids and the multi-placement setting.
    """
    conn = None
    try:
        user_id = request.state.user_id
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        bundles = _query_bundles(cursor, user_id)
        if not bundles:
            conn.close()
            conn = None
            try:
                _initialize_default_bundles(user_id)
            except Exception as init_err:
                logger.error(f"Failed to initialize default bundles: {str(init_err)}")
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            bundles = _query_bundles(cursor, user_id)

        # Get bundles_multi_placement setting
        cursor.execute(
            "SELECT bundles_multi_placement FROM settings WHERE user_id = ?",
            (user_id,),
        )
        row = cursor.fetchone()
        multi_placement = bool(row[0]) if row and row[0] else False

        return {
            "bundles_multi_placement": multi_placement,
            "bundles": bundles,
        }
    except Exception as e:
        logger.error(f"Error fetching bundles: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch bundles: {str(e)}")
    finally:
        if conn:
            conn.close()


@bundles_router.post("/api/bundles")
def create_bundle(bundle: BundleCreate, request: Request):
    """Create a new bundle. UUID generated, owner_id set from authenticated user."""
    conn = None
    try:
        user_id = request.state.user_id

        # Validate name is non-empty
        if not bundle.name or not bundle.name.strip():
            raise HTTPException(status_code=422, detail="Bundle name cannot be empty")

        name = bundle.name.strip()

        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # Check for duplicate name (case-insensitive)
        cursor.execute(
            "SELECT id FROM bundles WHERE owner_id = ? AND LOWER(name) = LOWER(?)",
            (user_id, name),
        )
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="A bundle with this name already exists")

        # Determine next display_order
        cursor.execute(
            "SELECT MAX(display_order) FROM bundles WHERE owner_id = ?",
            (user_id,),
        )
        max_order = cursor.fetchone()[0]
        next_order = (max_order + 1) if max_order is not None else 0

        bundle_id = str(uuid4())
        current_time = datetime.utcnow().isoformat()

        cursor.execute(
            """INSERT INTO bundles (id, owner_id, name, description, color, display_order,
               is_default, removable, created_datetime, modified_datetime)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                bundle_id, user_id, name, bundle.description, bundle.color,
                next_order, 0, 1, current_time, current_time,
            ),
        )
        conn.commit()

        return {
            "id": bundle_id,
            "owner_id": user_id,
            "name": name,
            "description": bundle.description,
            "display_order": next_order,
            "is_default": False,
            "removable": True,
            "rule_ids": [],
            "created_datetime": current_time,
            "modified_datetime": current_time,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating bundle: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create bundle: {str(e)}")
    finally:
        if conn:
            conn.close()


@bundles_router.post("/api/bundles/reclassify")
def reclassify_emails(request: Request):
    """Reclassify all inbox emails into bundles for the authenticated user.

    Strips existing bundle tags and re-evaluates all emails against current rules.
    Called after bundle rule changes to ensure classification is up-to-date.
    """
    try:
        user_id = request.state.user_id
        reclassify_all_emails(user_id)
        return {"message": "Reclassification complete", "owner_id": user_id}
    except Exception as e:
        logger.error(f"Error in reclassify endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Reclassification failed: {str(e)}")


@bundles_router.put("/api/bundles/reorder")
def reorder_bundles(reorder: BundleReorder, request: Request):
    """Accept an ordered list of bundle IDs and update display_order to match."""
    conn = None
    try:
        user_id = request.state.user_id
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # Validate all IDs belong to the authenticated user
        for bid in reorder.bundle_ids:
            cursor.execute(
                "SELECT id FROM bundles WHERE id = ? AND owner_id = ?",
                (bid, user_id),
            )
            if not cursor.fetchone():
                raise HTTPException(
                    status_code=400,
                    detail=f"Bundle ID {bid} not found or not owned by user",
                )

        current_time = datetime.utcnow().isoformat()
        for index, bid in enumerate(reorder.bundle_ids):
            cursor.execute(
                "UPDATE bundles SET display_order = ?, modified_datetime = ? WHERE id = ? AND owner_id = ?",
                (index, current_time, bid, user_id),
            )

        conn.commit()
        return {"message": "Bundles reordered", "count": len(reorder.bundle_ids)}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error reordering bundles: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to reorder bundles: {str(e)}")
    finally:
        if conn:
            conn.close()


@bundles_router.put("/api/bundles/{bundle_id}")
def update_bundle(bundle_id: str, bundle: BundleUpdate, request: Request):
    """Update an existing bundle. Returns 404 if not owned by authenticated user."""
    conn = None
    try:
        user_id = request.state.user_id
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # Verify ownership
        cursor.execute(
            "SELECT * FROM bundles WHERE id = ? AND owner_id = ?",
            (bundle_id, user_id),
        )
        existing_row = cursor.fetchone()
        if not existing_row:
            raise HTTPException(status_code=404, detail="Bundle not found")

        existing = _row_to_dict(cursor, existing_row)
        old_name = existing["name"]
        current_time = datetime.utcnow().isoformat()

        # Build update fields
        updates = []
        params = []

        if bundle.name is not None:
            new_name = bundle.name.strip()
            if not new_name:
                raise HTTPException(status_code=422, detail="Bundle name cannot be empty")

            # Check for duplicate name (case-insensitive), excluding self
            cursor.execute(
                "SELECT id FROM bundles WHERE owner_id = ? AND LOWER(name) = LOWER(?) AND id != ?",
                (user_id, new_name, bundle_id),
            )
            if cursor.fetchone():
                raise HTTPException(status_code=400, detail="A bundle with this name already exists")

            updates.append("name = ?")
            params.append(new_name)

        if bundle.description is not None:
            updates.append("description = ?")
            params.append(bundle.description)

        if bundle.color is not None:
            updates.append("color = ?")
            params.append(bundle.color if bundle.color else None)

        if bundle.omni_view is not None:
            updates.append("omni_view = ?")
            params.append(bundle.omni_view)

        updates.append("modified_datetime = ?")
        params.append(current_time)

        if updates:
            params.append(bundle_id)
            cursor.execute(
                f"UPDATE bundles SET {', '.join(updates)} WHERE id = ?",
                params,
            )

        # If name was changed, migrate tags on chits and update associated rule actions
        if bundle.name is not None and bundle.name.strip() != old_name:
            new_name = bundle.name.strip()
            _rename_bundle_tags(cursor, user_id, old_name, new_name)

            # Update associated rule's action params to use the new tag
            new_tag = f"CWOC_System/Bundle/{new_name}"
            old_tag = f"CWOC_System/Bundle/{old_name}"
            cursor.execute(
                "SELECT rule_id FROM bundle_rules WHERE bundle_id = ? AND owner_id = ?",
                (bundle_id, user_id),
            )
            rule_ids = [r[0] for r in cursor.fetchall()]
            for rid in rule_ids:
                cursor.execute(
                    "SELECT actions FROM rules WHERE id = ? AND owner_id = ?",
                    (rid, user_id),
                )
                rule_row = cursor.fetchone()
                if rule_row and rule_row[0]:
                    actions = deserialize_json_field(rule_row[0]) or []
                    updated = False
                    for action in actions:
                        if (action.get("type") == "add_tag" and
                                action.get("params", {}).get("tag") == old_tag):
                            action["params"]["tag"] = new_tag
                            updated = True
                    if updated:
                        cursor.execute(
                            "UPDATE rules SET actions = ?, modified_datetime = ? WHERE id = ?",
                            (serialize_json_field(actions), current_time, rid),
                        )

            # Sync rule name to match bundle name
            for rid in rule_ids:
                cursor.execute(
                    "UPDATE rules SET name = ?, modified_datetime = ? WHERE id = ? AND owner_id = ?",
                    (f"Bundle: {new_name}", current_time, rid, user_id),
                )

        # Sync rule description to match bundle description (always, even if name didn't change)
        if bundle.description is not None:
            cursor.execute(
                "SELECT rule_id FROM bundle_rules WHERE bundle_id = ? AND owner_id = ?",
                (bundle_id, user_id),
            )
            desc_rule_ids = [r[0] for r in cursor.fetchall()]
            for rid in desc_rule_ids:
                cursor.execute(
                    "UPDATE rules SET description = ?, modified_datetime = ? WHERE id = ? AND owner_id = ?",
                    (bundle.description, current_time, rid, user_id),
                )

        conn.commit()

        # Return updated bundle
        cursor.execute(
            "SELECT * FROM bundles WHERE id = ? AND owner_id = ?",
            (bundle_id, user_id),
        )
        updated_row = cursor.fetchone()
        result = _row_to_dict(cursor, updated_row)
        cursor.execute(
            "SELECT rule_id FROM bundle_rules WHERE bundle_id = ? AND owner_id = ?",
            (bundle_id, user_id),
        )
        result["rule_ids"] = [r[0] for r in cursor.fetchall()]
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating bundle {bundle_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update bundle: {str(e)}")
    finally:
        if conn:
            conn.close()


@bundles_router.delete("/api/bundles/{bundle_id}")
def delete_bundle(bundle_id: str, request: Request):
    """Delete a bundle. Returns 404 if not found/owned, 403 if not removable."""
    conn = None
    try:
        user_id = request.state.user_id
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # Verify ownership
        cursor.execute(
            "SELECT * FROM bundles WHERE id = ? AND owner_id = ?",
            (bundle_id, user_id),
        )
        existing_row = cursor.fetchone()
        if not existing_row:
            raise HTTPException(status_code=404, detail="Bundle not found")

        existing = _row_to_dict(cursor, existing_row)

        # Check if removable
        if not existing.get("removable", True):
            raise HTTPException(status_code=403, detail="This bundle cannot be deleted")

        bundle_name = existing["name"]

        # Remove bundle tag from all chits
        _remove_bundle_tag_from_chits(cursor, user_id, bundle_name)

        # Get associated rule IDs before deleting bundle_rules
        cursor.execute(
            "SELECT rule_id FROM bundle_rules WHERE bundle_id = ? AND owner_id = ?",
            (bundle_id, user_id),
        )
        rule_ids = [r[0] for r in cursor.fetchall()]

        # Delete bundle_rules records
        cursor.execute(
            "DELETE FROM bundle_rules WHERE bundle_id = ? AND owner_id = ?",
            (bundle_id, user_id),
        )

        # Delete the associated rules
        for rid in rule_ids:
            cursor.execute("DELETE FROM rules WHERE id = ? AND owner_id = ?", (rid, user_id))

        # Delete the bundle record
        cursor.execute(
            "DELETE FROM bundles WHERE id = ? AND owner_id = ?",
            (bundle_id, user_id),
        )

        conn.commit()

        # Reclassify in background (emails from deleted bundle need re-sorting)
        import threading
        def _bg_reclass():
            try:
                reclassify_all_emails(user_id)
            except Exception as e:
                logger.error(f"Reclassify after bundle delete failed: {e}")
        threading.Thread(target=_bg_reclass, daemon=True).start()

        return {"message": "Bundle deleted", "id": bundle_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting bundle {bundle_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete bundle: {str(e)}")
    finally:
        if conn:
            conn.close()


# ── Bundle-Rule Association Endpoints ─────────────────────────────────────

@bundles_router.post("/api/bundles/{bundle_id}/rules")
def associate_rule_with_bundle(bundle_id: str, body: BundleRuleAssociate, request: Request):
    """Associate an existing rule with a bundle. Verifies both exist and are owned by user."""
    conn = None
    try:
        user_id = request.state.user_id
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # Verify bundle ownership
        cursor.execute(
            "SELECT id FROM bundles WHERE id = ? AND owner_id = ?",
            (bundle_id, user_id),
        )
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Bundle not found")

        # Verify rule ownership
        cursor.execute(
            "SELECT id FROM rules WHERE id = ? AND owner_id = ?",
            (body.rule_id, user_id),
        )
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Rule not found")

        # Check if association already exists
        cursor.execute(
            "SELECT id FROM bundle_rules WHERE bundle_id = ? AND rule_id = ? AND owner_id = ?",
            (bundle_id, body.rule_id, user_id),
        )
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="Rule is already associated with this bundle")

        # Create association
        assoc_id = str(uuid4())
        current_time = datetime.utcnow().isoformat()
        cursor.execute(
            """INSERT INTO bundle_rules (id, bundle_id, rule_id, owner_id, created_datetime)
               VALUES (?, ?, ?, ?, ?)""",
            (assoc_id, bundle_id, body.rule_id, user_id, current_time),
        )
        conn.commit()

        # Reclassify all emails in background now that a new rule is associated
        import threading
        def _bg_reclass():
            try:
                reclassify_all_emails(user_id)
            except Exception as e:
                logger.error(f"Reclassify after rule association failed: {e}")
        threading.Thread(target=_bg_reclass, daemon=True).start()

        return {
            "id": assoc_id,
            "bundle_id": bundle_id,
            "rule_id": body.rule_id,
            "owner_id": user_id,
            "created_datetime": current_time,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error associating rule with bundle: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to associate rule: {str(e)}")
    finally:
        if conn:
            conn.close()


@bundles_router.delete("/api/bundles/{bundle_id}/rules/{rule_id}")
def remove_rule_from_bundle(bundle_id: str, rule_id: str, request: Request):
    """Remove a rule association from a bundle."""
    conn = None
    try:
        user_id = request.state.user_id
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # Verify bundle ownership
        cursor.execute(
            "SELECT id FROM bundles WHERE id = ? AND owner_id = ?",
            (bundle_id, user_id),
        )
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Bundle not found")

        # Verify association exists
        cursor.execute(
            "SELECT id FROM bundle_rules WHERE bundle_id = ? AND rule_id = ? AND owner_id = ?",
            (bundle_id, rule_id, user_id),
        )
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Rule association not found")

        # Delete association
        cursor.execute(
            "DELETE FROM bundle_rules WHERE bundle_id = ? AND rule_id = ? AND owner_id = ?",
            (bundle_id, rule_id, user_id),
        )
        conn.commit()

        return {"message": "Rule removed from bundle", "bundle_id": bundle_id, "rule_id": rule_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error removing rule from bundle: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to remove rule association: {str(e)}")
    finally:
        if conn:
            conn.close()


# ── Bundle Classification Engine ─────────────────────────────────────────


def _load_user_contacts(cursor, owner_id: str) -> list:
    """Load all contacts for a user (for cross-reference conditions)."""
    cursor.execute("SELECT * FROM contacts WHERE owner_id = ?", (owner_id,))
    columns = [col[0] for col in cursor.description]
    return [dict(zip(columns, row)) for row in cursor.fetchall()]


def _get_rules_for_bundle(cursor, bundle_id: str, owner_id: str) -> list:
    """Load all rules associated with a bundle via the bundle_rules junction table."""
    cursor.execute(
        "SELECT rule_id FROM bundle_rules WHERE bundle_id = ? AND owner_id = ?",
        (bundle_id, owner_id),
    )
    rule_ids = [r[0] for r in cursor.fetchall()]
    if not rule_ids:
        return []

    rules = []
    for rid in rule_ids:
        cursor.execute(
            "SELECT * FROM rules WHERE id = ? AND owner_id = ?",
            (rid, owner_id),
        )
        row = cursor.fetchone()
        if row:
            columns = [col[0] for col in cursor.description]
            rules.append(dict(zip(columns, row)))
    return rules


def _add_tag_to_chit(cursor, chit_id: str, tag: str, owner_id: str):
    """Add a tag to a chit's tags list in the database."""
    cursor.execute("SELECT tags FROM chits WHERE id = ?", (chit_id,))
    row = cursor.fetchone()
    if not row:
        return

    tags = deserialize_json_field(row[0]) or []
    if tag not in tags:
        tags.append(tag)
        cursor.execute(
            "UPDATE chits SET tags = ?, modified_datetime = ? WHERE id = ?",
            (serialize_json_field(tags), datetime.utcnow().isoformat(), chit_id),
        )


def classify_email_into_bundle(chit: dict, owner_id: str):
    """Classify an email into exactly one bundle (first match by display_order).

    Evaluates bundle rules in bundle display_order (left-to-right).
    Stops at the first matching bundle and assigns only that bundle's tag.
    If no bundle matches, the email falls into "Everything Else" (no tag needed).

    Args:
        chit: The email chit dict (must have "id" key).
        owner_id: The user/owner ID.
    """
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # Load bundles sorted by display_order ASC
        cursor.execute(
            "SELECT * FROM bundles WHERE owner_id = ? ORDER BY display_order ASC",
            (owner_id,),
        )
        columns = [col[0] for col in cursor.description]
        bundles = [dict(zip(columns, row)) for row in cursor.fetchall()]

        if not bundles:
            return

        # Pre-load contacts for cross-reference conditions
        contacts = _load_user_contacts(cursor, owner_id)
        logger.debug(f"[Classify] Loaded {len(contacts)} contacts, {len(bundles)} bundles for chit {chit.get('id', '?')[:8]}")

        for bundle in bundles:
            # Skip "Everything Else" — it's computed, not rule-based
            if bundle["name"] == "Everything Else":
                continue

            rules = _get_rules_for_bundle(cursor, bundle["id"], owner_id)
            if not rules:
                logger.debug(f"[Classify]   Bundle '{bundle['name']}': no rules, skipping")
                continue

            for rule in rules:
                if not rule.get("enabled", False):
                    logger.debug(f"[Classify]   Bundle '{bundle['name']}': rule '{rule.get('name')}' disabled, skipping")
                    continue

                # Parse conditions
                conditions_raw = rule.get("conditions")
                if isinstance(conditions_raw, str):
                    conditions = deserialize_json_field(conditions_raw)
                else:
                    conditions = conditions_raw

                if not conditions or not isinstance(conditions, dict):
                    continue

                # Evaluate condition tree against the email chit
                if evaluate_condition_tree(conditions, chit, contacts):
                    # First match wins — assign this bundle's tag and stop
                    tag = f"CWOC_System/Bundle/{bundle['name']}"
                    _add_tag_to_chit(cursor, chit["id"], tag, owner_id)
                    conn.commit()
                    logger.info(
                        "Bundle classification (single): chit %s → %s",
                        chit.get("id", "?"), bundle["name"],
                    )
                    return  # Done — single placement

        # No match — email falls into "Everything Else" (no tag needed)
        logger.debug(
            "Bundle classification (single): chit %s → Everything Else (no match)",
            chit.get("id", "?"),
        )
    except Exception as e:
        logger.error(f"Error classifying email into bundle: {str(e)}")
    finally:
        if conn:
            conn.close()


def classify_email_into_bundles(chit: dict, owner_id: str):
    """Classify an email into all matching bundles (multi-placement).

    Evaluates ALL bundle rules regardless of match order.
    For each bundle, on first rule match within that bundle, assigns the
    bundle's tag and moves to the next bundle.
    If no bundle matches, the email falls into "Everything Else" (no tag needed).

    Args:
        chit: The email chit dict (must have "id" key).
        owner_id: The user/owner ID.
    """
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # Load bundles sorted by display_order ASC
        cursor.execute(
            "SELECT * FROM bundles WHERE owner_id = ? ORDER BY display_order ASC",
            (owner_id,),
        )
        columns = [col[0] for col in cursor.description]
        bundles = [dict(zip(columns, row)) for row in cursor.fetchall()]

        if not bundles:
            return

        # Pre-load contacts for cross-reference conditions
        contacts = _load_user_contacts(cursor, owner_id)
        matched_bundles = []

        for bundle in bundles:
            # Skip "Everything Else" — it's computed, not rule-based
            if bundle["name"] == "Everything Else":
                continue

            rules = _get_rules_for_bundle(cursor, bundle["id"], owner_id)
            for rule in rules:
                if not rule.get("enabled", False):
                    continue

                # Parse conditions
                conditions_raw = rule.get("conditions")
                if isinstance(conditions_raw, str):
                    conditions = deserialize_json_field(conditions_raw)
                else:
                    conditions = conditions_raw

                if not conditions or not isinstance(conditions, dict):
                    continue

                # Evaluate condition tree against the email chit
                if evaluate_condition_tree(conditions, chit, contacts):
                    # This bundle matched — add tag and move to next bundle
                    tag = f"CWOC_System/Bundle/{bundle['name']}"
                    _add_tag_to_chit(cursor, chit["id"], tag, owner_id)
                    matched_bundles.append(bundle["name"])
                    break  # Move to next bundle

        conn.commit()

        if matched_bundles:
            logger.info(
                "Bundle classification (multi): chit %s → %s",
                chit.get("id", "?"), ", ".join(matched_bundles),
            )
        else:
            logger.debug(
                "Bundle classification (multi): chit %s → Everything Else (no match)",
                chit.get("id", "?"),
            )
    except Exception as e:
        logger.error(f"Error classifying email into bundles: {str(e)}")
    finally:
        if conn:
            conn.close()


def reclassify_all_emails(owner_id: str):
    """Reclassify all inbox email chits into bundles for the given owner.

    Strips existing CWOC_System/Bundle/* tags from all emails first,
    then re-evaluates each email against the current bundle rules.
    Respects the bundles_multi_placement setting.

    Called at startup (one-time) and after a new bundle is created.
    """
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # Check multi-placement setting
        cursor.execute(
            "SELECT bundles_multi_placement FROM settings WHERE user_id = ?",
            (owner_id,),
        )
        row = cursor.fetchone()
        multi_placement = bool(row[0]) if row and row[0] else False

        # Get all email chits for this owner (inbox, not deleted)
        cursor.execute(
            """SELECT id, tags, email_from, email_to, email_cc, email_bcc,
                      email_subject, email_body_text, email_message_id
               FROM chits
               WHERE owner_id = ? AND (email_message_id IS NOT NULL OR email_status IS NOT NULL)
                     AND (deleted = 0 OR deleted IS NULL)""",
            (owner_id,),
        )
        columns = [col[0] for col in cursor.description]
        email_chits = [dict(zip(columns, r)) for r in cursor.fetchall()]

        if not email_chits:
            logger.info(f"No email chits to reclassify for user {owner_id}")
            return

        # Strip existing bundle tags from all emails
        for chit in email_chits:
            tags = deserialize_json_field(chit.get("tags")) or []
            original_len = len(tags)
            tags = [t for t in tags if not (isinstance(t, str) and t.startswith("CWOC_System/Bundle/"))]
            if len(tags) != original_len:
                cursor.execute(
                    "UPDATE chits SET tags = ?, modified_datetime = ? WHERE id = ?",
                    (serialize_json_field(tags), datetime.utcnow().isoformat(), chit["id"]),
                )
            # Update the in-memory chit for classification
            chit["tags"] = serialize_json_field(tags)

        conn.commit()
        logger.info(f"[Reclassify] Stripped bundle tags from {len(email_chits)} emails for user {owner_id}")

        # Count bundles and rules
        cursor.execute("SELECT id, name FROM bundles WHERE owner_id = ? ORDER BY display_order ASC", (owner_id,))
        all_bundles = cursor.fetchall()
        logger.info(f"[Reclassify] Found {len(all_bundles)} bundles: {[b[1] for b in all_bundles]}")

        for bid, bname in all_bundles:
            cursor.execute("SELECT COUNT(*) FROM bundle_rules WHERE bundle_id = ? AND owner_id = ?", (bid, owner_id))
            rule_count = cursor.fetchone()[0]
            logger.info(f"[Reclassify]   Bundle '{bname}' has {rule_count} rules")

        # Now classify each email
        # Close conn since classify functions open their own connections
        conn.close()
        conn = None

        classified_count = 0
        matched_count = 0
        for chit in email_chits:
            if multi_placement:
                classify_email_into_bundles(chit, owner_id)
            else:
                classify_email_into_bundle(chit, owner_id)
            classified_count += 1

        # Count how many actually got tagged
        conn2 = sqlite3.connect(DB_PATH)
        c2 = conn2.cursor()
        c2.execute(
            "SELECT COUNT(*) FROM chits WHERE owner_id = ? AND tags LIKE '%CWOC_System/Bundle/%'",
            (owner_id,),
        )
        matched_count = c2.fetchone()[0]
        conn2.close()

        logger.info(f"[Reclassify] Done: processed {classified_count} emails, {matched_count} got bundle tags")

    except Exception as e:
        logger.error(f"Error reclassifying emails: {str(e)}")
    finally:
        if conn:
            conn.close()
