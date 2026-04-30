"""Permission resolution engine for the CWOC chit sharing system.

Provides functions to determine a user's effective role on a chit,
check edit/delete/manage permissions, and query all chits shared
with a given user.

Role precedence (highest to lowest): owner > manager > viewer.

Resolution order for resolve_effective_role:
1. owner_id match → 'owner'
2. stealth=True and not owner → None (overrides all sharing)
3. chit-level shares → role from shares list
4. tag-level shares → role from owner's shared_tags settings
5. assigned_to match → 'viewer'
6. None → no access

When multiple sharing paths exist, the highest role wins.
"""

import logging
import sqlite3

from src.backend.db import DB_PATH, deserialize_json_field


logger = logging.getLogger(__name__)


# ── Role precedence ──────────────────────────────────────────────────────

_ROLE_RANK = {
    "owner": 3,
    "manager": 2,
    "viewer": 1,
}


def _higher_role(a, b):
    """Return whichever role has higher precedence, or the non-None one."""
    if a is None:
        return b
    if b is None:
        return a
    return a if _ROLE_RANK.get(a, 0) >= _ROLE_RANK.get(b, 0) else b


# ── Core permission resolution ───────────────────────────────────────────

def resolve_effective_role(chit_row, user_id, owner_settings=None):
    """Determine the effective role for a user on a given chit.

    Args:
        chit_row: dict with at least owner_id, stealth, shares, tags, assigned_to.
        user_id: the UUID of the user whose role we are resolving.
        owner_settings: dict with a 'shared_tags' key (JSON array or already
                        deserialized list). May be None if tag-level sharing
                        is not applicable.

    Returns:
        'owner', 'manager', 'viewer', or None (no access).
    """
    if not chit_row or not user_id:
        return None

    # 1. Owner check — always first, always full control
    if chit_row.get("owner_id") == user_id:
        return "owner"

    # 2. Stealth override — non-owners get nothing
    stealth = chit_row.get("stealth")
    if stealth and stealth not in (0, "0", False, None):
        return None

    # We'll collect the best role across all sharing paths
    best_role = None

    # 3. Chit-level shares
    shares_raw = chit_row.get("shares")
    shares = _parse_shares(shares_raw)
    for entry in shares:
        if entry.get("user_id") == user_id:
            role = entry.get("role")
            if role in ("manager", "viewer"):
                best_role = _higher_role(best_role, role)

    # 4. Tag-level shares
    if owner_settings is not None:
        shared_tags_raw = owner_settings.get("shared_tags")
        shared_tags = _parse_shared_tags(shared_tags_raw)
        chit_tags = _parse_chit_tags(chit_row.get("tags"))

        for tag_entry in shared_tags:
            tag_name = tag_entry.get("tag")
            if tag_name and tag_name in chit_tags:
                tag_shares = tag_entry.get("shares") or []
                for share in tag_shares:
                    if share.get("user_id") == user_id:
                        role = share.get("role")
                        if role in ("manager", "viewer"):
                            best_role = _higher_role(best_role, role)

    # 5. Assignment — grants at minimum viewer access
    if chit_row.get("assigned_to") == user_id:
        best_role = _higher_role(best_role, "viewer")

    return best_role


# ── Permission check helpers ─────────────────────────────────────────────

def can_edit_chit(chit_row, user_id, owner_settings=None):
    """Return True if the user has owner or manager role on the chit."""
    role = resolve_effective_role(chit_row, user_id, owner_settings)
    return role in ("owner", "manager")


def can_delete_chit(chit_row, user_id):
    """Return True only if the user is the chit owner."""
    if not chit_row or not user_id:
        return False
    return chit_row.get("owner_id") == user_id


def can_manage_sharing(chit_row, user_id):
    """Return True only if the user is the chit owner."""
    if not chit_row or not user_id:
        return False
    return chit_row.get("owner_id") == user_id


# ── Query: shared chits for a user ──────────────────────────────────────

def get_shared_chits_for_user(user_id):
    """Query all non-deleted, non-stealth chits shared with user_id.

    Checks three sharing paths:
    - Chit-level shares (shares JSON contains user_id)
    - Tag-level shares (owner's shared_tags settings match chit tags)
    - Assignment (assigned_to = user_id)

    Returns a list of dicts, each containing:
        - All chit fields (deserialized)
        - effective_role: the resolved role string
        - share_source: 'chit-level', 'tag-level', 'assignment', or 'multiple'
        - owner_display_name: the chit owner's display name
    """
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # Step 1: Find candidate chits — non-deleted, non-stealth, not owned by user
        # We look for chits where:
        #   - shares JSON contains the user_id, OR
        #   - assigned_to matches the user_id
        # Tag-level sharing requires a second pass against owner settings.
        cursor.execute(
            """SELECT * FROM chits
               WHERE (deleted = 0 OR deleted IS NULL)
                 AND (stealth = 0 OR stealth IS NULL)
                 AND owner_id != ?
                 AND (
                     shares LIKE ? OR
                     assigned_to = ?
                 )""",
            (user_id, f"%{user_id}%", user_id),
        )
        chit_share_rows = [dict(row) for row in cursor.fetchall()]

        # Step 2: Find chits shared via tag-level sharing
        # Load all owner settings that have shared_tags referencing this user
        cursor.execute(
            """SELECT user_id, shared_tags FROM settings
               WHERE shared_tags IS NOT NULL AND shared_tags LIKE ?""",
            (f"%{user_id}%",),
        )
        owner_settings_rows = cursor.fetchall()

        # Build a map: owner_id → parsed shared_tags
        owner_shared_tags_map = {}
        for row in owner_settings_rows:
            owner_id = row["user_id"]
            shared_tags = _parse_shared_tags(row["shared_tags"])
            # Filter to only tags that include this user
            relevant_tags = set()
            for tag_entry in shared_tags:
                for share in (tag_entry.get("shares") or []):
                    if share.get("user_id") == user_id:
                        relevant_tags.add(tag_entry.get("tag"))
                        break
            if relevant_tags:
                owner_shared_tags_map[owner_id] = {
                    "shared_tags": shared_tags,
                    "relevant_tags": relevant_tags,
                }

        # Query chits from those owners that have matching tags
        tag_shared_chits = []
        for owner_id, tag_info in owner_shared_tags_map.items():
            cursor.execute(
                """SELECT * FROM chits
                   WHERE (deleted = 0 OR deleted IS NULL)
                     AND (stealth = 0 OR stealth IS NULL)
                     AND owner_id = ?""",
                (owner_id,),
            )
            for row in cursor.fetchall():
                chit = dict(row)
                chit_tags = _parse_chit_tags(chit.get("tags"))
                if chit_tags & tag_info["relevant_tags"]:
                    tag_shared_chits.append(chit)

        # Step 3: Merge candidates (deduplicate by chit id)
        all_candidates = {}
        for chit in chit_share_rows:
            all_candidates[chit["id"]] = chit
        for chit in tag_shared_chits:
            if chit["id"] not in all_candidates:
                all_candidates[chit["id"]] = chit

        # Step 4: Resolve effective role for each candidate and build results
        results = []
        for chit_id, chit in all_candidates.items():
            owner_id = chit.get("owner_id")

            # Load owner settings for tag-level resolution
            owner_settings = None
            if owner_id in owner_shared_tags_map:
                owner_settings = {"shared_tags": owner_shared_tags_map[owner_id]["shared_tags"]}

            role = resolve_effective_role(chit, user_id, owner_settings)
            if role is None:
                continue

            # Determine share source
            share_source = _determine_share_source(chit, user_id, owner_settings)

            # Deserialize JSON fields for the response
            _deserialize_chit_fields(chit)

            chit["effective_role"] = role
            chit["share_source"] = share_source
            chit["owner_display_name"] = chit.get("owner_display_name", "")
            results.append(chit)

        # Enrich with assigned_to_display_name (batch lookup)
        assigned_ids = set()
        for chit in results:
            aid = chit.get("assigned_to")
            if aid:
                assigned_ids.add(aid)
        if assigned_ids:
            placeholders = ",".join("?" for _ in assigned_ids)
            cursor.execute(
                f"SELECT id, display_name, username FROM users WHERE id IN ({placeholders})",
                list(assigned_ids),
            )
            name_map = {}
            for row in cursor.fetchall():
                uid = row["id"] if isinstance(row, sqlite3.Row) else row[0]
                dname = row["display_name"] if isinstance(row, sqlite3.Row) else row[1]
                uname = row["username"] if isinstance(row, sqlite3.Row) else row[2]
                name_map[uid] = dname or uname or uid
            for chit in results:
                aid = chit.get("assigned_to")
                chit["assigned_to_display_name"] = name_map.get(aid) if aid else None
        else:
            for chit in results:
                chit["assigned_to_display_name"] = None

        return results

    except Exception as e:
        logger.error(f"Error fetching shared chits for user {user_id}: {str(e)}")
        return []
    finally:
        if conn:
            conn.close()


# ── Internal helpers ─────────────────────────────────────────────────────

def _parse_shares(shares_raw):
    """Parse the shares column value into a list of dicts."""
    if shares_raw is None:
        return []
    if isinstance(shares_raw, list):
        return shares_raw
    parsed = deserialize_json_field(shares_raw)
    if isinstance(parsed, list):
        return parsed
    return []


def _parse_shared_tags(shared_tags_raw):
    """Parse the shared_tags column value into a list of dicts."""
    if shared_tags_raw is None:
        return []
    if isinstance(shared_tags_raw, list):
        return shared_tags_raw
    parsed = deserialize_json_field(shared_tags_raw)
    if isinstance(parsed, list):
        return parsed
    return []


def _parse_chit_tags(tags_raw):
    """Parse the chit tags column into a set of tag name strings."""
    if tags_raw is None:
        return set()
    if isinstance(tags_raw, list):
        return set(tags_raw)
    parsed = deserialize_json_field(tags_raw)
    if isinstance(parsed, list):
        return set(parsed)
    return set()


def _determine_share_source(chit, user_id, owner_settings):
    """Determine which sharing path(s) grant access to the user."""
    sources = []

    # Check chit-level shares
    shares = _parse_shares(chit.get("shares"))
    for entry in shares:
        if entry.get("user_id") == user_id:
            sources.append("chit-level")
            break

    # Check tag-level shares
    if owner_settings is not None:
        shared_tags = _parse_shared_tags(owner_settings.get("shared_tags"))
        chit_tags = _parse_chit_tags(chit.get("tags"))
        for tag_entry in shared_tags:
            tag_name = tag_entry.get("tag")
            if tag_name and tag_name in chit_tags:
                for share in (tag_entry.get("shares") or []):
                    if share.get("user_id") == user_id:
                        sources.append("tag-level")
                        break
                if "tag-level" in sources:
                    break

    # Check assignment
    if chit.get("assigned_to") == user_id:
        sources.append("assignment")

    if len(sources) > 1:
        return "multiple"
    elif len(sources) == 1:
        return sources[0]
    return "unknown"


def _deserialize_chit_fields(chit):
    """Deserialize JSON fields on a chit dict in place."""
    chit["tags"] = deserialize_json_field(chit["tags"]) if isinstance(chit.get("tags"), str) else chit.get("tags")
    chit["checklist"] = deserialize_json_field(chit.get("checklist")) if isinstance(chit.get("checklist"), str) else chit.get("checklist")
    chit["people"] = deserialize_json_field(chit.get("people")) if isinstance(chit.get("people"), str) else chit.get("people")
    chit["child_chits"] = deserialize_json_field(chit.get("child_chits")) if isinstance(chit.get("child_chits"), str) else chit.get("child_chits")
    chit["alerts"] = deserialize_json_field(chit.get("alerts")) if isinstance(chit.get("alerts"), str) else chit.get("alerts")
    chit["recurrence_rule"] = deserialize_json_field(chit.get("recurrence_rule")) if isinstance(chit.get("recurrence_rule"), str) else chit.get("recurrence_rule")
    chit["recurrence_exceptions"] = deserialize_json_field(chit.get("recurrence_exceptions")) if isinstance(chit.get("recurrence_exceptions"), str) else chit.get("recurrence_exceptions")
    chit["weather_data"] = deserialize_json_field(chit.get("weather_data")) if isinstance(chit.get("weather_data"), str) else chit.get("weather_data")
    chit["health_data"] = deserialize_json_field(chit.get("health_data")) if isinstance(chit.get("health_data"), str) else chit.get("health_data")
    chit["shares"] = deserialize_json_field(chit.get("shares")) if isinstance(chit.get("shares"), str) else chit.get("shares")
    chit["is_project_master"] = bool(chit.get("is_project_master"))
    chit["all_day"] = bool(chit.get("all_day"))
    chit["hide_when_instance_done"] = bool(chit.get("hide_when_instance_done"))
    chit["stealth"] = bool(chit.get("stealth"))
