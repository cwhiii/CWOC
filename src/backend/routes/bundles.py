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

from src.backend.db import DB_PATH, serialize_json_field, deserialize_json_field, row_to_dict
from src.backend.models import BundleCreate, BundleUpdate, BundleReorder, BundleRuleAssociate
from src.backend.rules_engine import evaluate_condition_tree


logger = logging.getLogger(__name__)
bundles_router = APIRouter()


# ── Helpers ───────────────────────────────────────────────────────────────


def _condition_tree_has_leaves(tree: dict) -> bool:
    """Check if a condition tree contains at least one leaf condition.

    An empty group (no children) or nested groups with no leaves would
    evaluate to True via vacuous truth in evaluate_condition_tree, which
    causes rules with no conditions to match every email. This helper
    lets bundle classification skip such rules.
    """
    if not isinstance(tree, dict):
        return False
    node_type = tree.get("type")
    if node_type == "leaf":
        return True
    if node_type == "group":
        children = tree.get("children")
        if not isinstance(children, list) or not children:
            return False
        return any(_condition_tree_has_leaves(child) for child in children)
    return False


def _query_bundles(cursor, owner_id: str) -> list:
    """Query all bundles for an owner, sorted by display_order ASC.
    Includes associated rule_ids for each bundle."""
    cursor.execute(
        "SELECT * FROM bundles WHERE owner_id = ? ORDER BY display_order ASC",
        (owner_id,),
    )
    bundles = []
    for row in cursor.fetchall():
        bundle = row_to_dict(cursor, row)
        # Fetch associated rule_ids
        cursor.execute(
            "SELECT rule_id FROM bundle_rules WHERE bundle_id = ? AND owner_id = ?",
            (bundle["id"], owner_id),
        )
        bundle["rule_ids"] = [r[0] for r in cursor.fetchall()]
        bundles.append(bundle)
    return bundles


def _rename_bundle_tags(cursor, owner_id: str, old_name: str, new_name: str):
    """DEPRECATED — no longer needed. Bundle tags use IDs, not names.
    Kept as a no-op for any old code paths that still call it."""
    pass


def _merge_condition_into_bundle_rule(cursor, bundle_id: str, owner_id: str, new_leaf: dict, bundle_name: str = "") -> str:
    """Merge a new leaf condition into the bundle's single rule.

    Each bundle has exactly ONE rule. If the bundle already has a rule, the new
    condition is added as an OR sibling. If no rule exists, one is created.

    Also consolidates legacy multi-rule bundles: if a bundle has multiple rules
    from the old behavior, they are merged into a single rule with an OR group.

    Args:
        cursor: Active DB cursor (caller manages commit)
        bundle_id: The bundle to add the condition to
        owner_id: The authenticated user
        new_leaf: A condition leaf dict, e.g. {"type": "leaf", "field": "email_from", "operator": "contains", "value": "foo@bar.com"}
        bundle_name: Optional bundle name for the rule name

    Returns:
        The rule_id of the bundle's (single) rule.
    """
    now = datetime.utcnow().isoformat()
    new_tag = f"CWOC_System/BundleID/{bundle_id}"

    # Get all existing rules for this bundle
    cursor.execute(
        "SELECT rule_id FROM bundle_rules WHERE bundle_id = ? AND owner_id = ?",
        (bundle_id, owner_id),
    )
    existing_rule_ids = [r[0] for r in cursor.fetchall()]

    if not existing_rule_ids:
        # No rule exists — create one with the new leaf wrapped in an OR group
        rule_id = str(uuid4())
        conditions = {
            "type": "group",
            "operator": "OR",
            "children": [new_leaf]
        }
        actions = [{"type": "add_tag", "params": {"tag": new_tag}}]
        rule_name = f"Bundle: {bundle_name}" if bundle_name else f"Bundle rule"

        cursor.execute("""
            INSERT INTO rules (id, owner_id, name, trigger_type, enabled, priority,
                             conditions, actions, confirm_before_apply, created_datetime, modified_datetime)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            rule_id, owner_id, rule_name, "email_received",
            1, 0,
            serialize_json_field(conditions),
            serialize_json_field(actions),
            0, now, now
        ))

        # Create bundle_rules association
        assoc_id = str(uuid4())
        cursor.execute("""
            INSERT INTO bundle_rules (id, bundle_id, rule_id, owner_id, created_datetime)
            VALUES (?, ?, ?, ?, ?)
        """, (assoc_id, bundle_id, rule_id, owner_id, now))

        return rule_id

    # ── Bundle has existing rule(s) — consolidate into one ──
    # Load all existing rules' conditions
    all_leaves = []
    primary_rule_id = existing_rule_ids[0]

    for rid in existing_rule_ids:
        cursor.execute(
            "SELECT conditions FROM rules WHERE id = ? AND owner_id = ?",
            (rid, owner_id),
        )
        row = cursor.fetchone()
        if not row:
            continue
        conds = deserialize_json_field(row[0])
        if not conds:
            continue
        # Extract leaves from whatever structure exists
        _extract_leaves(conds, all_leaves)

    # Add the new leaf (check for duplicates first)
    if not _leaf_already_exists(new_leaf, all_leaves):
        all_leaves.append(new_leaf)

    # Build the consolidated OR group
    conditions = {
        "type": "group",
        "operator": "OR",
        "children": all_leaves
    }

    # Update the primary rule with the merged conditions
    cursor.execute("""
        UPDATE rules SET conditions = ?, modified_datetime = ? WHERE id = ? AND owner_id = ?
    """, (serialize_json_field(conditions), now, primary_rule_id, owner_id))

    # Delete any extra rules and their associations (consolidation)
    if len(existing_rule_ids) > 1:
        for rid in existing_rule_ids[1:]:
            cursor.execute("DELETE FROM bundle_rules WHERE rule_id = ? AND owner_id = ?", (rid, owner_id))
            cursor.execute("DELETE FROM rules WHERE id = ? AND owner_id = ?", (rid, owner_id))

    return primary_rule_id


def _extract_leaves(node: dict, leaves: list):
    """Recursively extract all leaf conditions from a condition tree."""
    if not isinstance(node, dict):
        return
    if node.get("type") == "leaf":
        leaves.append(node)
    elif node.get("type") == "group":
        for child in (node.get("children") or []):
            _extract_leaves(child, leaves)


def _leaf_already_exists(new_leaf: dict, existing_leaves: list) -> bool:
    """Check if a leaf condition already exists in the list (same field, operator, value)."""
    for leaf in existing_leaves:
        if (leaf.get("field") == new_leaf.get("field") and
            leaf.get("operator") == new_leaf.get("operator") and
            leaf.get("value") == new_leaf.get("value")):
            return True
    return False


def _remove_bundle_tag_by_id(cursor, owner_id: str, bundle_id: str):
    """Remove a bundle tag from all chits that have it (by bundle ID)."""
    tag = f"CWOC_System/BundleID/{bundle_id}"

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


def _remove_bundle_tag_from_chits(cursor, owner_id: str, bundle_name: str):
    """DEPRECATED — use _remove_bundle_tag_by_id instead.
    Kept for backward compat with old migration code."""
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
                from_contacts_id, owner_id, "👤 From Contacts",
                "Emails from people in your contacts list",
                0, 1, 1, current_time, current_time,
            ),
        )

        # Create "Everything Else" bundle (catch-all)
        everything_else_id = str(uuid4())
        cursor.execute(
            """INSERT INTO bundles (id, owner_id, name, description, display_order,
               is_default, removable, is_catch_all, created_datetime, modified_datetime)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                everything_else_id, owner_id, "📬 Everything Else",
                "Emails not matched by any other bundle",
                1, 1, 0, 1, current_time, current_time,
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
            {"type": "add_tag", "params": {"tag": f"CWOC_System/BundleID/{from_contacts_id}"}}
        ]
        cursor.execute(
            """INSERT INTO rules (id, owner_id, name, trigger_type, enabled, priority,
               conditions, actions, confirm_before_apply, created_datetime, modified_datetime)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                rule_id, owner_id, "Bundle: 👤 From Contacts", "email_received",
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
    Also ensures auto-bundles (Newsletters, Receipts, Calendar Invites) exist.
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

        # Ensure auto-bundles exist (idempotent)
        conn.close()
        conn = None
        try:
            ensure_auto_bundles_exist(user_id)
        except Exception as e:
            logger.warning(f"Failed to ensure auto-bundles in get_bundles: {e}")
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


@bundles_router.post("/api/bundles/{bundle_id}/add-rule")
async def add_rule_to_bundle(bundle_id: str, request: Request):
    """Add a new OR condition to the bundle's single rule.
    
    Merges the new condition into the bundle's existing rule as an OR sibling.
    If no rule exists yet, creates one.
    
    Request body:
    - match_type: "subject" or "sender"
    - match_value: the subject line or sender email to match
    """
    conn = None
    try:
        owner_id = request.state.user_id
        body = await request.json()
        
        match_type = body.get("match_type")
        match_value = body.get("match_value", "").strip()
        
        if match_type not in ["subject", "sender"]:
            raise HTTPException(status_code=400, detail="match_type must be 'subject' or 'sender'")
        
        if not match_value:
            raise HTTPException(status_code=400, detail="match_value is required")
        
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Verify bundle exists and is owned by user
        cursor.execute(
            "SELECT name, removable, is_catch_all FROM bundles WHERE id = ? AND owner_id = ?",
            (bundle_id, owner_id)
        )
        bundle_row = cursor.fetchone()
        if not bundle_row:
            raise HTTPException(status_code=404, detail="Bundle not found")
        
        bundle_name, removable, is_catch_all = bundle_row
        
        # Don't allow adding rules to the catch-all bundle
        if is_catch_all:
            raise HTTPException(status_code=400, detail="Cannot add rules to the catch-all bundle")
        
        # Build the new leaf condition
        if match_type == "subject":
            new_leaf = {
                "type": "leaf",
                "field": "email_subject",
                "operator": "contains",
                "value": match_value
            }
        else:  # sender
            new_leaf = {
                "type": "leaf",
                "field": "email_from",
                "operator": "contains",
                "value": match_value
            }
        
        # Merge into the bundle's single rule
        rule_id = _merge_condition_into_bundle_rule(cursor, bundle_id, owner_id, new_leaf, bundle_name)
        
        conn.commit()
        
        logger.info(f"Added condition to bundle {bundle_name} rule for {match_type}='{match_value}'")
        
        return {
            "success": True,
            "rule_id": rule_id,
            "rule_name": f"Bundle: {bundle_name}",
            "bundle_name": bundle_name
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding rule to bundle: {e}")
        raise HTTPException(status_code=500, detail="Failed to add rule to bundle")
    finally:
        if conn:
            conn.close()


@bundles_router.post("/api/bundles/{bundle_id}/drop-email")
async def drop_email_to_bundle(bundle_id: str, request: Request):
    """Handle drag-drop of an email into a bundle tab.

    Supports four modes:
    - "move_once": Just re-tag this single email into the target bundle
    - "always_sender": Create a rule matching sender email, then optionally reclassify
    - "always_subject": Create a rule matching subject (supports * wildcard), then optionally reclassify
    - "always_recipient": Create a rule matching recipient address, then optionally reclassify

    Request body:
    - chit_id: ID of the email chit being dropped
    - mode: "move_once" | "always_sender" | "always_subject" | "always_recipient"
    - match_value: the value to match (pre-populated from email, user may have edited it)
    - apply_retroactively: boolean — if true, reclassify all existing inbox emails
    """
    conn = None
    try:
        owner_id = request.state.user_id
        body = await request.json()

        chit_id = body.get("chit_id")
        mode = body.get("mode")
        match_value = body.get("match_value", "").strip()
        apply_retroactively = body.get("apply_retroactively", False)

        if not chit_id:
            raise HTTPException(status_code=400, detail="chit_id is required")
        if mode not in ("move_once", "always_sender", "always_subject", "always_recipient"):
            raise HTTPException(status_code=400, detail="Invalid mode")
        if mode != "move_once" and not match_value:
            raise HTTPException(status_code=400, detail="match_value is required for 'always' modes")

        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # Verify bundle exists and is owned by user
        cursor.execute(
            "SELECT name, is_catch_all FROM bundles WHERE id = ? AND owner_id = ?",
            (bundle_id, owner_id)
        )
        bundle_row = cursor.fetchone()
        if not bundle_row:
            raise HTTPException(status_code=404, detail="Bundle not found")

        bundle_name, is_catch_all = bundle_row

        if is_catch_all:
            raise HTTPException(status_code=400, detail="Cannot drop emails into the catch-all bundle")

        # ── Move the single email: remove existing bundle tags, add new one ──
        cursor.execute("SELECT tags FROM chits WHERE id = ? AND owner_id = ?", (chit_id, owner_id))
        chit_row = cursor.fetchone()
        if not chit_row:
            raise HTTPException(status_code=404, detail="Email not found")

        tags = deserialize_json_field(chit_row[0]) or []
        # Remove all existing bundle tags (both old name-based and new ID-based)
        tags = [t for t in tags if not (
            (isinstance(t, str) and (t.startswith("CWOC_System/Bundle/") or t.startswith("CWOC_System/BundleID/"))) or
            (isinstance(t, dict) and ((t.get("name", "")).startswith("CWOC_System/Bundle/") or (t.get("name", "")).startswith("CWOC_System/BundleID/")))
        )]
        # Add new bundle tag (by ID)
        new_tag = f"CWOC_System/BundleID/{bundle_id}"
        tags.append(new_tag)

        now = datetime.utcnow().isoformat()
        cursor.execute(
            "UPDATE chits SET tags = ?, modified_datetime = ? WHERE id = ? AND owner_id = ?",
            (serialize_json_field(tags), now, chit_id, owner_id)
        )

        rule_id = None
        rule_name = None

        # ── Create a rule for "always" modes ──
        if mode != "move_once":

            if mode == "always_sender":
                field = "email_from"
                operator = "wildcard" if "*" in match_value else "contains"
            elif mode == "always_subject":
                field = "email_subject"
                operator = "wildcard" if "*" in match_value else "equals"
            elif mode == "always_recipient":
                field = "email_to"
                operator = "wildcard" if "*" in match_value else "contains"

            new_leaf = {
                "type": "leaf",
                "field": field,
                "operator": operator,
                "value": match_value
            }

            rule_id = _merge_condition_into_bundle_rule(cursor, bundle_id, owner_id, new_leaf, bundle_name)
            rule_name = f"Bundle: {bundle_name}"

        conn.commit()

        # ── Retroactive reclassification ──
        reclassified_count = 0
        if apply_retroactively and mode != "move_once":
            reclassified_count = _apply_rule_retroactively(conn, cursor, owner_id, bundle_id, mode, match_value)

        logger.info(f"Drop-email: mode={mode}, bundle={bundle_name}, chit={chit_id}, rule={rule_id}, retroactive={reclassified_count}")

        return {
            "success": True,
            "mode": mode,
            "bundle_id": bundle_id,
            "bundle_name": bundle_name,
            "rule_id": rule_id,
            "rule_name": rule_name,
            "reclassified_count": reclassified_count
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in drop-email: {e}")
        raise HTTPException(status_code=500, detail="Failed to process email drop")
    finally:
        if conn:
            conn.close()


def _apply_rule_retroactively(conn, cursor, owner_id: str, bundle_id: str, mode: str, match_value: str) -> int:
    """Apply a newly created rule retroactively to all existing inbox emails.

    Returns the count of emails that were reclassified.
    """
    import fnmatch

    # Get all inbox email chits
    cursor.execute(
        "SELECT id, tags, email_from, title, email_to FROM chits WHERE owner_id = ? AND deleted = 0 AND (email_message_id IS NOT NULL OR email_status IS NOT NULL)",
        (owner_id,)
    )
    rows = cursor.fetchall()

    new_tag = f"CWOC_System/BundleID/{bundle_id}"
    now = datetime.utcnow().isoformat()
    count = 0

    for row in rows:
        cid, raw_tags, email_from, title, email_to = row
        tags = deserialize_json_field(raw_tags) or []

        # Check if already in this bundle
        already_in = any(
            (isinstance(t, str) and t == new_tag) or
            (isinstance(t, dict) and t.get("name") == new_tag)
            for t in tags
        )
        if already_in:
            continue

        # Check if the email matches the rule
        matched = False
        if mode == "always_sender":
            sender = (email_from or "").lower()
            pattern = match_value.lower()
            if "*" in pattern:
                matched = fnmatch.fnmatch(sender, pattern)
            else:
                matched = pattern in sender
        elif mode == "always_subject":
            subject = (title or "").lower()
            pattern = match_value.lower()
            if "*" in pattern:
                matched = fnmatch.fnmatch(subject, pattern)
            else:
                matched = subject == pattern
        elif mode == "always_recipient":
            recipients = (email_to or "").lower()
            pattern = match_value.lower()
            if "*" in pattern:
                matched = fnmatch.fnmatch(recipients, pattern)
            else:
                matched = pattern in recipients

        if matched:
            # Remove existing bundle tags (both old name-based and new ID-based), add new one
            tags = [t for t in tags if not (
                (isinstance(t, str) and (t.startswith("CWOC_System/Bundle/") or t.startswith("CWOC_System/BundleID/"))) or
                (isinstance(t, dict) and ((t.get("name", "")).startswith("CWOC_System/Bundle/") or (t.get("name", "")).startswith("CWOC_System/BundleID/")))
            )]
            tags.append(new_tag)
            cursor.execute(
                "UPDATE chits SET tags = ?, modified_datetime = ? WHERE id = ?",
                (serialize_json_field(tags), now, cid)
            )
            count += 1

    if count > 0:
        conn.commit()

    return count


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

        existing = row_to_dict(cursor, existing_row)
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

        # Name changes are purely cosmetic — tags use bundle ID, not name.
        # No tag migration needed.
        # Sync rule name to match bundle name
        if bundle.name is not None:
            cursor.execute(
                "SELECT rule_id FROM bundle_rules WHERE bundle_id = ? AND owner_id = ?",
                (bundle_id, user_id),
            )
            rule_ids = [r[0] for r in cursor.fetchall()]
            new_name = bundle.name.strip()
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
        result = row_to_dict(cursor, updated_row)
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

        existing = row_to_dict(cursor, existing_row)

        # Check if removable
        if not existing.get("removable", True):
            raise HTTPException(status_code=403, detail="This bundle cannot be deleted")

        bundle_name = existing["name"]

        # Remove bundle tag from all chits (by ID)
        _remove_bundle_tag_by_id(cursor, user_id, bundle_id)

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


@bundles_router.post("/api/bundles/{bundle_id}/disable")
def disable_bundle(bundle_id: str, request: Request):
    """Disable an auto-bundle: set display_order to -1 and strip its tags from all emails.

    The bundle remains in the DB but is hidden from the UI and stops receiving
    new classifications. Can be re-enabled by updating display_order back.
    """
    conn = None
    try:
        user_id = request.state.user_id
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # Verify ownership
        cursor.execute(
            "SELECT name, display_order FROM bundles WHERE id = ? AND owner_id = ?",
            (bundle_id, user_id),
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Bundle not found")

        bundle_name = row[0]
        current_time = datetime.utcnow().isoformat()

        # Set display_order to -1 (disabled marker)
        cursor.execute(
            "UPDATE bundles SET display_order = -1, modified_datetime = ? WHERE id = ?",
            (current_time, bundle_id),
        )

        # Strip this bundle's tag from all emails
        _remove_bundle_tag_by_id(cursor, user_id, bundle_id)

        conn.commit()
        logger.info(f"Disabled auto-bundle '{bundle_name}' for user {user_id}")
        return {"message": "Bundle disabled", "id": bundle_id, "name": bundle_name}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error disabling bundle {bundle_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to disable bundle: {str(e)}")
    finally:
        if conn:
            conn.close()


# ── Bundle-Rule Association Endpoints ─────────────────────────────────────

@bundles_router.get("/api/bundles/{bundle_id}/rules")
def get_bundle_rules(bundle_id: str, request: Request):
    """Get all rules associated with a bundle, with full rule details."""
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

        # Get all rules for this bundle
        rules = _get_rules_for_bundle(cursor, bundle_id, user_id)

        # Deserialize JSON fields for each rule
        result = []
        for rule in rules:
            rule["conditions"] = deserialize_json_field(rule.get("conditions"))
            rule["actions"] = deserialize_json_field(rule.get("actions"))
            rule["enabled"] = bool(rule.get("enabled", 1))
            result.append(rule)

        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching bundle rules: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch bundle rules: {str(e)}")
    finally:
        if conn:
            conn.close()


@bundles_router.post("/api/bundles/{bundle_id}/consolidate-rules")
def consolidate_bundle_rules(bundle_id: str, request: Request):
    """Consolidate multiple legacy rules into a single rule with an OR group.

    If the bundle already has only one rule, returns it as-is.
    If it has multiple rules (from old per-sender behavior), merges all their
    conditions into a single OR group in one rule and deletes the extras.

    Returns the single rule_id for the bundle.
    """
    conn = None
    try:
        user_id = request.state.user_id
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # Verify bundle ownership
        cursor.execute(
            "SELECT name FROM bundles WHERE id = ? AND owner_id = ?",
            (bundle_id, user_id),
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Bundle not found")
        bundle_name = row[0]

        # Get all existing rules for this bundle
        cursor.execute(
            "SELECT rule_id FROM bundle_rules WHERE bundle_id = ? AND owner_id = ?",
            (bundle_id, user_id),
        )
        existing_rule_ids = [r[0] for r in cursor.fetchall()]

        if not existing_rule_ids:
            # No rules — create an empty OR group rule
            now = datetime.utcnow().isoformat()
            rule_id = str(uuid4())
            new_tag = f"CWOC_System/BundleID/{bundle_id}"
            conditions = {"type": "group", "operator": "OR", "children": []}
            actions = [{"type": "add_tag", "params": {"tag": new_tag}}]

            cursor.execute("""
                INSERT INTO rules (id, owner_id, name, trigger_type, enabled, priority,
                                 conditions, actions, confirm_before_apply, created_datetime, modified_datetime)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                rule_id, user_id, f"Bundle: {bundle_name}", "email_received",
                1, 0, serialize_json_field(conditions), serialize_json_field(actions),
                0, now, now
            ))
            assoc_id = str(uuid4())
            cursor.execute("""
                INSERT INTO bundle_rules (id, bundle_id, rule_id, owner_id, created_datetime)
                VALUES (?, ?, ?, ?, ?)
            """, (assoc_id, bundle_id, rule_id, user_id, now))
            conn.commit()
            return {"rule_id": rule_id}

        if len(existing_rule_ids) == 1:
            # Already consolidated — but ensure it's an OR group structure
            rule_id = existing_rule_ids[0]
            cursor.execute(
                "SELECT conditions FROM rules WHERE id = ? AND owner_id = ?",
                (rule_id, user_id),
            )
            cond_row = cursor.fetchone()
            if cond_row:
                conds = deserialize_json_field(cond_row[0])
                # If it's a bare leaf, wrap it in an OR group
                if conds and conds.get("type") == "leaf":
                    wrapped = {"type": "group", "operator": "OR", "children": [conds]}
                    now = datetime.utcnow().isoformat()
                    cursor.execute("""
                        UPDATE rules SET conditions = ?, modified_datetime = ? WHERE id = ? AND owner_id = ?
                    """, (serialize_json_field(wrapped), now, rule_id, user_id))
                    conn.commit()
            return {"rule_id": rule_id}

        # Multiple rules — consolidate into one
        now = datetime.utcnow().isoformat()
        primary_rule_id = existing_rule_ids[0]
        all_leaves = []

        for rid in existing_rule_ids:
            cursor.execute(
                "SELECT conditions FROM rules WHERE id = ? AND owner_id = ?",
                (rid, user_id),
            )
            row = cursor.fetchone()
            if not row:
                continue
            conds = deserialize_json_field(row[0])
            if conds:
                _extract_leaves(conds, all_leaves)

        # Build consolidated OR group
        conditions = {"type": "group", "operator": "OR", "children": all_leaves}

        cursor.execute("""
            UPDATE rules SET conditions = ?, name = ?, modified_datetime = ? WHERE id = ? AND owner_id = ?
        """, (serialize_json_field(conditions), f"Bundle: {bundle_name}", now, primary_rule_id, user_id))

        # Delete extra rules and their associations
        for rid in existing_rule_ids[1:]:
            cursor.execute("DELETE FROM bundle_rules WHERE rule_id = ? AND owner_id = ?", (rid, user_id))
            cursor.execute("DELETE FROM rules WHERE id = ? AND owner_id = ?", (rid, user_id))

        conn.commit()
        return {"rule_id": primary_rule_id}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error consolidating bundle rules: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to consolidate rules: {str(e)}")
    finally:
        if conn:
            conn.close()


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


def _is_generic_condition(conditions: dict) -> bool:
    """Check if a condition tree uses only generic/broad operators.

    Generic operators: contains_contact_email (matches any contact).
    Specific operators: contains, equals, starts_with, etc. (targeted match).

    For compound conditions (AND/OR), returns True only if ALL leaves are generic.
    """
    if not conditions:
        return False
    ctype = conditions.get("type", "leaf")
    if ctype == "leaf":
        op = conditions.get("operator", "")
        return op in ("contains_contact_email",)
    elif ctype in ("and", "or"):
        children = conditions.get("children", [])
        if not children:
            return False
        return all(_is_generic_condition(c) for c in children)
    return False


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
    """Classify an email into exactly one bundle (specific rules first, then generic).

    Two-pass evaluation:
    1. First pass: evaluate SPECIFIC rules (sender/subject contains) across all bundles
       in display_order. Specific rules always win over generic ones.
    2. Second pass: evaluate GENERIC rules (contains_contact_email) across all bundles
       in display_order. Only runs if no specific rule matched.

    This ensures that explicit user-created sender rules (e.g., "Add to Bundle")
    always take priority over the broad "From Contacts" catch-all.

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

        # Collect all bundle rules, split into specific vs generic
        # "Generic" = uses contains_contact_email operator (broad catch-all)
        # "Specific" = uses contains, equals, starts_with, etc. (targeted)
        specific_matches = []  # [(bundle, rule, conditions)]
        generic_matches = []   # [(bundle, rule, conditions)]

        for bundle in bundles:
            if bundle.get("is_catch_all"):
                continue

            rules = _get_rules_for_bundle(cursor, bundle["id"], owner_id)
            for rule in rules:
                if not rule.get("enabled", False):
                    continue

                conditions_raw = rule.get("conditions")
                if isinstance(conditions_raw, str):
                    conditions = deserialize_json_field(conditions_raw)
                else:
                    conditions = conditions_raw

                if not conditions or not isinstance(conditions, dict):
                    continue
                # Skip rules with empty condition trees (no leaves = vacuous truth match-all)
                if not _condition_tree_has_leaves(conditions):
                    continue

                # Determine if this is a generic or specific rule
                is_generic = _is_generic_condition(conditions)
                if is_generic:
                    generic_matches.append((bundle, rule, conditions))
                else:
                    specific_matches.append((bundle, rule, conditions))

        # Pass 1: Evaluate specific rules (in bundle display_order)
        for bundle, rule, conditions in specific_matches:
            if evaluate_condition_tree(conditions, chit, contacts):
                tag = f"CWOC_System/BundleID/{bundle['id']}"
                _add_tag_to_chit(cursor, chit["id"], tag, owner_id)
                conn.commit()
                logger.info(
                    "Bundle classification (single/specific): chit %s → %s",
                    chit.get("id", "?"), bundle["name"],
                )
                return

        # Pass 2: Evaluate generic rules (only if no specific match)
        for bundle, rule, conditions in generic_matches:
            if evaluate_condition_tree(conditions, chit, contacts):
                tag = f"CWOC_System/BundleID/{bundle['id']}"
                _add_tag_to_chit(cursor, chit["id"], tag, owner_id)
                conn.commit()
                logger.info(
                    "Bundle classification (single/generic): chit %s → %s",
                    chit.get("id", "?"), bundle["name"],
                )
                return

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
            # Skip catch-all bundle — it's computed, not rule-based
            if bundle.get("is_catch_all"):
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
                # Skip rules with empty condition trees (no leaves = vacuous truth match-all)
                if not _condition_tree_has_leaves(conditions):
                    continue

                # Evaluate condition tree against the email chit
                if evaluate_condition_tree(conditions, chit, contacts):
                    # This bundle matched — add tag and move to next bundle
                    tag = f"CWOC_System/BundleID/{bundle['id']}"
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

        # Strip existing bundle tags from all emails (both old name-based and new ID-based)
        for chit in email_chits:
            tags = deserialize_json_field(chit.get("tags")) or []
            original_len = len(tags)
            tags = [t for t in tags if not (isinstance(t, str) and (t.startswith("CWOC_System/Bundle/") or t.startswith("CWOC_System/BundleID/")))]
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
            # Also apply auto-bundle classification
            classify_email_auto_bundles(chit, chit["id"], owner_id)
            classified_count += 1

        # Count how many actually got tagged
        conn2 = sqlite3.connect(DB_PATH)
        c2 = conn2.cursor()
        c2.execute(
            "SELECT COUNT(*) FROM chits WHERE owner_id = ? AND (tags LIKE '%CWOC_System/Bundle/%' OR tags LIKE '%CWOC_System/BundleID/%')",
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


# ── Auto-Bundle System Bundles ────────────────────────────────────────────
# Built-in bundles that auto-classify based on email signals:
# - Newsletters: List-Unsubscribe header present
# - Receipts: noreply@ sender + transactional subject patterns
# - Calendar Invites: text/calendar MIME part

AUTO_BUNDLE_NEWSLETTERS = "🗑️ Junk"
AUTO_BUNDLE_RECEIPTS = "🧾 Receipts"
AUTO_BUNDLE_CALENDAR = "🗓️ Calendar Invites"
AUTO_BUNDLE_FINANCE = "🏦 Finance"

# Transactional subject patterns for Receipts detection
_RECEIPT_SUBJECT_PATTERNS = [
    "order confirmation", "your order has shipped", "your order",
    "order #", "invoice #", "purchase confirmation",
    "payment received", "payment confirmation",
    "your receipt", "receipt for your",
]

# Finance/banking subject patterns
_FINANCE_SUBJECT_PATTERNS = [
    "statement is ready", "statement available", "your statement",
    "billing statement", "account statement", "monthly statement",
    "payment due", "payment reminder", "bill is ready",
    "autopay", "auto-pay", "automatic payment",
    "balance update", "account alert", "low balance",
    "direct deposit", "transaction alert", "fraud alert",
    "credit score", "fico score",
    "tax document", "tax form", "1099", "w-2",
]

# Known financial institution sender domains
_FINANCE_SENDER_DOMAINS = [
    "chase.com", "bankofamerica.com", "wellsfargo.com", "citi.com",
    "capitalone.com", "discover.com", "americanexpress.com", "amex.com",
    "usaa.com", "navyfederal.org", "pnc.com", "usbank.com",
    "ally.com", "synchrony.com", "barclays.com", "barclaycard",
    "paypal.com", "venmo.com", "zelle", "cashapp.com",
    "mint.com", "creditkarma.com", "experian.com", "equifax.com",
    "transunion.com", "irs.gov", "turbotax", "hrblock",
    "fidelity.com", "vanguard.com", "schwab.com", "etrade.com",
    "robinhood.com", "wealthfront.com", "betterment.com",
    "sofi.com", "marcus.com", "lending", "mortgage",
    "monarchmoney.com", "monarch.com",
]

# noreply-style sender patterns
_NOREPLY_PATTERNS = [
    "noreply@", "no-reply@", "donotreply@", "do-not-reply@",
    "notifications@", "mailer@", "automated@", "system@",
]


def _is_noreply_sender(email_from: str) -> bool:
    """Check if the sender address matches a noreply pattern."""
    if not email_from:
        return False
    lower = email_from.lower()
    return any(pat in lower for pat in _NOREPLY_PATTERNS)


def _is_receipt_subject(subject: str) -> bool:
    """Check if the subject matches transactional/receipt patterns."""
    if not subject:
        return False
    lower = subject.lower()
    return any(pat in lower for pat in _RECEIPT_SUBJECT_PATTERNS)


def _is_finance_email(email_from: str, subject: str) -> bool:
    """Check if an email is from a financial institution or has finance subject patterns.

    Matches if:
    - Sender domain matches a known financial institution, OR
    - Subject matches finance/banking patterns (statement, payment due, etc.)
    """
    if not email_from and not subject:
        return False
    from_lower = (email_from or "").lower()
    subject_lower = (subject or "").lower()

    # Check sender domain
    if any(domain in from_lower for domain in _FINANCE_SENDER_DOMAINS):
        return True

    # Check subject patterns (only if sender is noreply-style to avoid false positives)
    if _is_noreply_sender(email_from) and any(pat in subject_lower for pat in _FINANCE_SUBJECT_PATTERNS):
        return True

    return False


def ensure_auto_bundles_exist(owner_id: str):
    """Ensure the three system auto-bundles exist for a user.

    Creates them if missing. These are non-removable system bundles
    placed after user bundles but before "Everything Else".
    Does NOT create rules — classification is done directly by signal detection.

    Also handles migration: renames legacy names to current canonical names
    (Newsletters → Clutter, Junk → Clutter) if they exist as non-removable auto-bundles.
    """
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # Migration: rename "Newsletters" or "Junk" → "Clutter" if non-removable auto-bundle
        for old_name in ("Newsletters", "Junk", "🗑️ Junk"):
            cursor.execute(
                "SELECT id FROM bundles WHERE owner_id = ? AND name = ? AND removable = 0",
                (owner_id, old_name),
            )
            old_row = cursor.fetchone()
            if old_row:
                # Check if "Clutter" or "🗑️ Clutter" already exists
                cursor.execute(
                    "SELECT id FROM bundles WHERE owner_id = ? AND (name = '🗑️ Clutter' OR name = 'Clutter')",
                    (owner_id,),
                )
                if not cursor.fetchone():
                    _rename_bundle_tags(cursor, owner_id, old_name, "🗑️ Clutter")
                    cursor.execute(
                        "UPDATE bundles SET name = '🗑️ Clutter', description = 'Emails with unsubscribe links (marketing, newsletters, clutter)', modified_datetime = ? WHERE id = ?",
                        (datetime.utcnow().isoformat(), old_row[0]),
                    )
                    conn.commit()
                    logger.info(f"Renamed auto-bundle '{old_name}' → '🗑️ Clutter' for user {owner_id}")
                break

        # Get existing non-removable auto-bundles by description (stable across renames)
        cursor.execute(
            "SELECT id, name, description FROM bundles WHERE owner_id = ? AND removable = 0 AND (is_catch_all = 0 OR is_catch_all IS NULL)",
            (owner_id,),
        )
        existing_auto_rows = cursor.fetchall()

        # Build a set of description keywords that already exist
        # Each auto-bundle is identified by keywords in its description, NOT by name
        existing_desc_keys = set()
        for _, _, desc in existing_auto_rows:
            desc_lower = (desc or "").lower()
            if "unsubscribe" in desc_lower or "junk" in desc_lower or "newsletter" in desc_lower or "clutter" in desc_lower:
                existing_desc_keys.add("junk")
            if "receipt" in desc_lower or "order confirmation" in desc_lower:
                existing_desc_keys.add("receipts")
            if "banking" in desc_lower or "bills" in desc_lower or "financial" in desc_lower:
                existing_desc_keys.add("finance")
            if "calendar" in desc_lower or "invitation" in desc_lower:
                existing_desc_keys.add("calendar")

        # Get the current max display_order (before the catch-all bundle)
        cursor.execute(
            "SELECT MAX(display_order) FROM bundles WHERE owner_id = ? AND (is_catch_all = 0 OR is_catch_all IS NULL)",
            (owner_id,),
        )
        max_order_row = cursor.fetchone()
        next_order = (max_order_row[0] + 1) if max_order_row and max_order_row[0] is not None else 0

        current_time = datetime.utcnow().isoformat()
        # (default_name, description, desc_key for dedup)
        auto_bundles = [
            (AUTO_BUNDLE_NEWSLETTERS, "Emails with unsubscribe links (marketing, newsletters, junk)", "junk"),
            (AUTO_BUNDLE_RECEIPTS, "Order confirmations, invoices, payment receipts", "receipts"),
            (AUTO_BUNDLE_FINANCE, "Banking, bills, statements, financial alerts", "finance"),
            (AUTO_BUNDLE_CALENDAR, "Calendar invitations and event updates", "calendar"),
        ]

        created = 0
        for name, description, desc_key in auto_bundles:
            if desc_key not in existing_desc_keys:
                bundle_id = str(uuid4())
                cursor.execute(
                    """INSERT INTO bundles (id, owner_id, name, description, display_order,
                       is_default, removable, created_datetime, modified_datetime)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (bundle_id, owner_id, name, description,
                     next_order, 1, 0, current_time, current_time),
                )
                next_order += 1
                created += 1

        # Ensure catch-all bundle is always last
        if created > 0:
            cursor.execute(
                "UPDATE bundles SET display_order = ? WHERE owner_id = ? AND is_catch_all = 1",
                (next_order, owner_id),
            )

        conn.commit()
        if created > 0:
            logger.info(f"Created {created} auto-bundles for user {owner_id}")
    except Exception as e:
        logger.error(f"Error ensuring auto-bundles: {e}")
    finally:
        if conn:
            conn.close()


def classify_email_auto_bundles(parsed: dict, chit_id: str, owner_id: str):
    """Classify an email into auto-bundles based on signal detection.

    Called during IMAP sync AFTER the chit is created. Checks:
    1. Clutter: has_list_unsubscribe AND sender not in another bundle
    2. Receipts: noreply sender + transactional subject
    3. Calendar Invites: has text/calendar MIME part

    If the sender is already classified into a user-created bundle,
    the Clutter auto-bundle is skipped (sender is "promoted").

    Looks up actual bundle names from DB (handles user renames).

    Args:
        parsed: The parsed email dict from _parse_email_message (with signal fields).
        chit_id: The ID of the created chit.
        owner_id: The user/owner ID.
    """
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # Look up actual auto-bundle IDs (user may have renamed them)
        # Auto-bundles are non-removable (removable=0) and not the catch-all
        # Skip disabled bundles (display_order = -1)
        cursor.execute(
            "SELECT id, name, description FROM bundles WHERE owner_id = ? AND removable = 0 AND (is_catch_all = 0 OR is_catch_all IS NULL) AND display_order != -1",
            (owner_id,),
        )
        auto_bundle_rows = cursor.fetchall()

        # Identify bundles by their description (stable even after rename)
        junk_bundle_id = None
        receipts_bundle_id = None
        finance_bundle_id = None
        calendar_bundle_id = None
        for bid, name, desc in auto_bundle_rows:
            desc_lower = (desc or "").lower()
            if "unsubscribe" in desc_lower or "junk" in desc_lower or "newsletter" in desc_lower or "clutter" in desc_lower:
                junk_bundle_id = bid
            elif "receipt" in desc_lower or "order confirmation" in desc_lower:
                receipts_bundle_id = bid
            elif "banking" in desc_lower or "bills" in desc_lower or "financial" in desc_lower:
                finance_bundle_id = bid
            elif "calendar" in desc_lower or "invitation" in desc_lower:
                calendar_bundle_id = bid

        if not junk_bundle_id and not receipts_bundle_id and not calendar_bundle_id and not finance_bundle_id:
            return  # No auto-bundles found

        # Load current tags on the chit
        cursor.execute("SELECT tags FROM chits WHERE id = ?", (chit_id,))
        row = cursor.fetchone()
        if not row:
            return
        tags = deserialize_json_field(row[0]) or []

        # Build set of auto-bundle tags for exclusion check
        auto_tags = set()
        if junk_bundle_id:
            auto_tags.add(f"CWOC_System/BundleID/{junk_bundle_id}")
        if receipts_bundle_id:
            auto_tags.add(f"CWOC_System/BundleID/{receipts_bundle_id}")
        if finance_bundle_id:
            auto_tags.add(f"CWOC_System/BundleID/{finance_bundle_id}")
        if calendar_bundle_id:
            auto_tags.add(f"CWOC_System/BundleID/{calendar_bundle_id}")
        # Include the catch-all bundle tag in the exclusion set
        cursor.execute(
            "SELECT id FROM bundles WHERE owner_id = ? AND is_catch_all = 1",
            (owner_id,),
        )
        catch_all_row = cursor.fetchone()
        if catch_all_row:
            auto_tags.add(f"CWOC_System/BundleID/{catch_all_row[0]}")

        # Check if already in a non-auto bundle (user-created bundle = "promoted")
        has_user_bundle = any(
            t.startswith("CWOC_System/BundleID/") and t not in auto_tags
            for t in tags if isinstance(t, str)
        )

        added_tags = []

        # 1. Calendar Invites — highest priority, always applies
        if calendar_bundle_id and parsed.get("has_calendar_attachment"):
            tag = f"CWOC_System/BundleID/{calendar_bundle_id}"
            if tag not in tags:
                added_tags.append(tag)

        # 2. Finance — known financial domains or finance subject patterns
        email_from = parsed.get("email_from", "")
        subject = parsed.get("email_subject", "")
        if finance_bundle_id and _is_finance_email(email_from, subject):
            tag = f"CWOC_System/BundleID/{finance_bundle_id}"
            if tag not in tags:
                added_tags.append(tag)

        # 3. Receipts — noreply sender + transactional subject (skip if already Finance)
        if receipts_bundle_id and _is_noreply_sender(email_from) and _is_receipt_subject(subject):
            finance_tag = f"CWOC_System/BundleID/{finance_bundle_id}" if finance_bundle_id else ""
            if finance_tag not in tags and finance_tag not in added_tags:
                tag = f"CWOC_System/BundleID/{receipts_bundle_id}"
                if tag not in tags:
                    added_tags.append(tag)

        # 4. Junk — List-Unsubscribe present, but NOT if sender is in a user bundle
        if junk_bundle_id and parsed.get("has_list_unsubscribe") and not has_user_bundle:
            # Also skip if already classified as Receipts or Calendar
            skip = False
            if receipts_bundle_id:
                rt = f"CWOC_System/BundleID/{receipts_bundle_id}"
                if rt in tags or rt in added_tags:
                    skip = True
            if calendar_bundle_id and not skip:
                ct = f"CWOC_System/BundleID/{calendar_bundle_id}"
                if ct in tags or ct in added_tags:
                    skip = True
            if not skip:
                tag = f"CWOC_System/BundleID/{junk_bundle_id}"
                if tag not in tags:
                    added_tags.append(tag)

        # Apply tags
        if added_tags:
            tags.extend(added_tags)
            cursor.execute(
                "UPDATE chits SET tags = ?, modified_datetime = ? WHERE id = ?",
                (serialize_json_field(tags), datetime.utcnow().isoformat(), chit_id),
            )
            conn.commit()
            logger.info(
                f"[AutoBundle] chit {chit_id[:8]} → {', '.join(t.split('/')[-1] for t in added_tags)}"
            )

    except Exception as e:
        logger.error(f"[AutoBundle] Error classifying chit {chit_id}: {e}")
    finally:
        if conn:
            conn.close()
