"""
Property-based tests for the chit sharing permission resolution engine.

Feature: chit-sharing-system
Uses Python stdlib only (unittest + random) — no external libraries.
Each property test runs 120+ iterations with randomly generated inputs.

NOTE: We inline the minimal production logic from src/backend/sharing.py
to avoid importing backend modules that pull in FastAPI.
"""

import json
import os
import random
import sqlite3
import string
import tempfile
import unittest
import uuid


# ── Inlined production logic (from src/backend/sharing.py) ───────────────
# Kept in sync manually.  Only the pure-function helpers are copied here so
# the test file can run with *zero* third-party packages.

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


def _parse_shares(shares_raw):
    """Parse the shares column value into a list of dicts."""
    if shares_raw is None:
        return []
    if isinstance(shares_raw, list):
        return shares_raw
    try:
        parsed = json.loads(shares_raw)
        if isinstance(parsed, list):
            return parsed
    except (json.JSONDecodeError, TypeError):
        pass
    return []


def _parse_shared_tags(shared_tags_raw):
    """Parse the shared_tags column value into a list of dicts."""
    if shared_tags_raw is None:
        return []
    if isinstance(shared_tags_raw, list):
        return shared_tags_raw
    try:
        parsed = json.loads(shared_tags_raw)
        if isinstance(parsed, list):
            return parsed
    except (json.JSONDecodeError, TypeError):
        pass
    return []


def _parse_chit_tags(tags_raw):
    """Parse the chit tags column into a set of tag name strings."""
    if tags_raw is None:
        return set()
    if isinstance(tags_raw, list):
        return set(tags_raw)
    try:
        parsed = json.loads(tags_raw)
        if isinstance(parsed, list):
            return set(parsed)
    except (json.JSONDecodeError, TypeError):
        pass
    return set()


def resolve_effective_role(chit_row, user_id, owner_settings=None):
    """Determine the effective role for a user on a given chit.

    Returns: 'owner', 'manager', 'viewer', or None (no access).
    """
    if not chit_row or not user_id:
        return None

    # 1. Owner check
    if chit_row.get("owner_id") == user_id:
        return "owner"

    # 2. Stealth override
    stealth = chit_row.get("stealth")
    if stealth and stealth not in (0, "0", False, None):
        return None

    best_role = None

    # 3. Chit-level shares
    shares = _parse_shares(chit_row.get("shares"))
    for entry in shares:
        if entry.get("user_id") == user_id:
            role = entry.get("role")
            if role in ("manager", "viewer"):
                best_role = _higher_role(best_role, role)

    # 4. Tag-level shares
    if owner_settings is not None:
        shared_tags = _parse_shared_tags(owner_settings.get("shared_tags"))
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

    # 5. Assignment
    if chit_row.get("assigned_to") == user_id:
        best_role = _higher_role(best_role, "viewer")

    return best_role


def can_edit_chit(chit_row, user_id, owner_settings=None):
    """Return True if the user has owner or manager role on the chit."""
    role = resolve_effective_role(chit_row, user_id, owner_settings)
    return role in ("owner", "manager")


def can_delete_chit(chit_row, user_id):
    """Return True only if the user is the chit owner."""
    if not chit_row or not user_id:
        return False
    return chit_row.get("owner_id") == user_id


def can_manage_sharing(chit_row, user_id, owner_settings=None):
    """Return True if the user is the chit owner or has manager role."""
    if not chit_row or not user_id:
        return False
    role = resolve_effective_role(chit_row, user_id, owner_settings)
    return role in ("owner", "manager")


# ── Random data generators ───────────────────────────────────────────────

_PBT_ITERATIONS = 120  # minimum required by spec

_TAG_POOL = [
    "Family Calendar", "Work", "Personal", "Shopping", "Health",
    "Travel", "Finance", "Recipes", "Meetings", "Birthdays",
    "Homework", "Errands", "Fitness", "Reading", "Garden",
]


def _random_uuid():
    """Generate a random UUID string."""
    return str(uuid.uuid4())


def _random_title(max_len=30):
    """Generate a random chit title."""
    length = random.randint(1, max_len)
    return "".join(random.choices(string.ascii_letters + string.digits + " ", k=length)).strip() or "Chit"


def _random_tags(min_count=0, max_count=4):
    """Generate a random list of tag names."""
    count = random.randint(min_count, max_count)
    return random.sample(_TAG_POOL, k=min(count, len(_TAG_POOL)))


def _random_role():
    """Return a random sharing role (manager or viewer)."""
    return random.choice(["manager", "viewer"])


def _random_shares(user_ids, min_count=0, max_count=None):
    """Generate a random shares list for the given user IDs."""
    if max_count is None:
        max_count = len(user_ids)
    count = random.randint(min_count, min(max_count, len(user_ids)))
    chosen = random.sample(user_ids, k=count)
    return [{"user_id": uid, "role": _random_role()} for uid in chosen]


def _random_chit(owner_id, shares=None, tags=None, stealth=False, assigned_to=None):
    """Build a random chit dict with the given parameters."""
    return {
        "id": _random_uuid(),
        "owner_id": owner_id,
        "title": _random_title(),
        "tags": tags if tags is not None else _random_tags(),
        "shares": shares,
        "stealth": 1 if stealth else 0,
        "assigned_to": assigned_to,
        "deleted": 0,
    }


def _random_owner_settings(shared_tags=None):
    """Build a random owner_settings dict."""
    return {"shared_tags": shared_tags}


def _random_shared_tags_config(tags, user_ids, role=None):
    """Build a shared_tags config list for the given tags and user IDs."""
    result = []
    for tag in tags:
        shares = []
        for uid in user_ids:
            shares.append({"user_id": uid, "role": role or _random_role()})
        result.append({"tag": tag, "shares": shares})
    return result


# ── Property 1: Viewer access is read-only ───────────────────────────────

class TestProperty1ViewerAccessIsReadOnly(unittest.TestCase):
    """Feature: chit-sharing-system, Property 1: Viewer access is read-only

    **Validates: Requirements 1.2, 2.2**

    For any chit and any user granted viewer role (via chit-level shares
    or tag-level shares), resolve_effective_role SHALL return 'viewer'
    and can_edit_chit SHALL return False.
    """

    def test_chit_level_viewer_is_read_only(self):
        """Chit-level viewer share → role='viewer', can_edit=False."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                owner_id = _random_uuid()
                viewer_id = _random_uuid()
                shares = [{"user_id": viewer_id, "role": "viewer"}]
                # Add random extra shares to make it realistic
                for _ in range(random.randint(0, 3)):
                    shares.append({"user_id": _random_uuid(), "role": _random_role()})
                chit = _random_chit(owner_id, shares=shares)

                role = resolve_effective_role(chit, viewer_id)
                self.assertEqual(role, "viewer",
                                 f"Expected 'viewer', got '{role}' (iter {i})")
                self.assertFalse(can_edit_chit(chit, viewer_id),
                                 f"Viewer should not be able to edit (iter {i})")

    def test_tag_level_viewer_is_read_only(self):
        """Tag-level viewer share → role='viewer', can_edit=False."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                owner_id = _random_uuid()
                viewer_id = _random_uuid()
                tags = _random_tags(min_count=1, max_count=3)
                chit = _random_chit(owner_id, shares=None, tags=tags)

                shared_tags = _random_shared_tags_config(tags, [viewer_id], role="viewer")
                owner_settings = _random_owner_settings(shared_tags=shared_tags)

                role = resolve_effective_role(chit, viewer_id, owner_settings)
                self.assertEqual(role, "viewer",
                                 f"Expected 'viewer', got '{role}' (iter {i})")
                self.assertFalse(can_edit_chit(chit, viewer_id, owner_settings),
                                 f"Tag-level viewer should not be able to edit (iter {i})")


# ── Property 2: Manager access allows editing ────────────────────────────

class TestProperty2ManagerAccessAllowsEditing(unittest.TestCase):
    """Feature: chit-sharing-system, Property 2: Manager access allows editing

    **Validates: Requirements 1.3, 2.3**

    For any chit and any user granted manager role (via chit-level shares
    or tag-level shares), resolve_effective_role SHALL return at least
    'manager' and can_edit_chit SHALL return True.
    """

    def test_chit_level_manager_can_edit(self):
        """Chit-level manager share → role>='manager', can_edit=True."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                owner_id = _random_uuid()
                manager_id = _random_uuid()
                shares = [{"user_id": manager_id, "role": "manager"}]
                for _ in range(random.randint(0, 3)):
                    shares.append({"user_id": _random_uuid(), "role": _random_role()})
                chit = _random_chit(owner_id, shares=shares)

                role = resolve_effective_role(chit, manager_id)
                self.assertIn(role, ("manager", "owner"),
                              f"Expected at least 'manager', got '{role}' (iter {i})")
                self.assertTrue(can_edit_chit(chit, manager_id),
                                f"Manager should be able to edit (iter {i})")

    def test_tag_level_manager_can_edit(self):
        """Tag-level manager share → role>='manager', can_edit=True."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                owner_id = _random_uuid()
                manager_id = _random_uuid()
                tags = _random_tags(min_count=1, max_count=3)
                chit = _random_chit(owner_id, shares=None, tags=tags)

                shared_tags = _random_shared_tags_config(tags, [manager_id], role="manager")
                owner_settings = _random_owner_settings(shared_tags=shared_tags)

                role = resolve_effective_role(chit, manager_id, owner_settings)
                self.assertIn(role, ("manager", "owner"),
                              f"Expected at least 'manager', got '{role}' (iter {i})")
                self.assertTrue(can_edit_chit(chit, manager_id, owner_settings),
                                f"Tag-level manager should be able to edit (iter {i})")


# ── Property 3: Only owner can delete ────────────────────────────────────

class TestProperty3OnlyOwnerCanDelete(unittest.TestCase):
    """Feature: chit-sharing-system, Property 3: Only owner can delete

    **Validates: Requirements 1.4, 2.6**

    For any chit and any user who is not the owner, can_delete_chit
    SHALL return False. When user_id == owner_id, can_delete_chit
    SHALL return True.
    """

    def test_non_owner_cannot_delete(self):
        """Non-owner users (any role) cannot delete."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                owner_id = _random_uuid()
                other_id = _random_uuid()
                role = _random_role()
                shares = [{"user_id": other_id, "role": role}]
                chit = _random_chit(owner_id, shares=shares)

                self.assertFalse(can_delete_chit(chit, other_id),
                                 f"Non-owner ({role}) should not delete (iter {i})")

    def test_owner_can_delete_and_manage(self):
        """Owner can always delete and manage sharing."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                owner_id = _random_uuid()
                # Add random shares and settings to ensure they don't interfere
                other_ids = [_random_uuid() for _ in range(random.randint(0, 4))]
                shares = _random_shares(other_ids)
                chit = _random_chit(owner_id, shares=shares,
                                    stealth=random.choice([True, False]),
                                    assigned_to=random.choice(other_ids) if other_ids else None)

                self.assertTrue(can_delete_chit(chit, owner_id),
                                f"Owner should always be able to delete (iter {i})")
                self.assertTrue(can_manage_sharing(chit, owner_id),
                                f"Owner should always be able to manage sharing (iter {i})")


# ── Property 4: Removing a share revokes access ─────────────────────────

class TestProperty4RemovingShareRevokesAccess(unittest.TestCase):
    """Feature: chit-sharing-system, Property 4: Removing a share revokes access

    **Validates: Requirements 1.5, 2.4, 2.5**

    For any chit and any user, if the user is not present in the chit's
    shares list, not present in any matching tag's shares in the owner's
    shared_tags, and not the assigned_to user, then resolve_effective_role
    SHALL return None.
    """

    def test_no_shares_no_tags_no_assignment_means_no_access(self):
        """User with no sharing path gets None."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                owner_id = _random_uuid()
                outsider_id = _random_uuid()

                # Build shares that do NOT include outsider_id
                other_ids = [_random_uuid() for _ in range(random.randint(0, 4))]
                shares = _random_shares(other_ids)
                tags = _random_tags(min_count=0, max_count=3)
                chit = _random_chit(owner_id, shares=shares, tags=tags)

                # Build tag shares that do NOT include outsider_id
                tag_user_ids = [_random_uuid() for _ in range(random.randint(0, 3))]
                shared_tags = _random_shared_tags_config(tags, tag_user_ids) if tags else []
                owner_settings = _random_owner_settings(shared_tags=shared_tags)

                role = resolve_effective_role(chit, outsider_id, owner_settings)
                self.assertIsNone(role,
                                  f"User with no sharing path should get None, got '{role}' (iter {i})")


# ── Property 5: Multiple sharing paths resolve to highest role ───────────

class TestProperty5MultiplePathsResolveToHighestRole(unittest.TestCase):
    """Feature: chit-sharing-system, Property 5: Multiple sharing paths resolve to highest role

    **Validates: Requirements 5.1, 5.2**

    For any chit and any non-owner user who has access through multiple
    paths, resolve_effective_role SHALL return the highest role across all
    paths, where precedence is owner > manager > viewer.
    """

    def test_highest_role_wins_across_paths(self):
        """Multiple sharing paths → highest role is returned."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                owner_id = _random_uuid()
                target_id = _random_uuid()

                # Randomly assign roles via different paths
                chit_role = random.choice(["manager", "viewer", None])
                tag_role = random.choice(["manager", "viewer", None])
                is_assigned = random.choice([True, False])

                # Build chit-level shares
                shares = []
                if chit_role:
                    shares.append({"user_id": target_id, "role": chit_role})
                # Add noise shares
                for _ in range(random.randint(0, 2)):
                    shares.append({"user_id": _random_uuid(), "role": _random_role()})

                tags = _random_tags(min_count=1, max_count=3)
                assigned_to = target_id if is_assigned else None
                chit = _random_chit(owner_id, shares=shares, tags=tags,
                                    assigned_to=assigned_to)

                # Build tag-level shares
                shared_tags = []
                if tag_role:
                    shared_tags = _random_shared_tags_config(tags, [target_id], role=tag_role)
                owner_settings = _random_owner_settings(shared_tags=shared_tags)

                # Compute expected highest role
                roles_present = []
                if chit_role:
                    roles_present.append(chit_role)
                if tag_role:
                    roles_present.append(tag_role)
                if is_assigned:
                    roles_present.append("viewer")

                if not roles_present:
                    expected = None
                else:
                    expected = max(roles_present, key=lambda r: _ROLE_RANK.get(r, 0))

                actual = resolve_effective_role(chit, target_id, owner_settings)
                self.assertEqual(actual, expected,
                                 f"Expected '{expected}', got '{actual}' "
                                 f"(chit_role={chit_role}, tag_role={tag_role}, "
                                 f"assigned={is_assigned}, iter {i})")


# ── Property 6: Owner always has full control ────────────────────────────

class TestProperty6OwnerAlwaysHasFullControl(unittest.TestCase):
    """Feature: chit-sharing-system, Property 6: Owner always has full control

    **Validates: Requirements 5.3, 6.3**

    For any chit (including stealth chits) where user_id == owner_id,
    resolve_effective_role SHALL return 'owner', can_edit_chit SHALL
    return True, can_delete_chit SHALL return True, and can_manage_sharing
    SHALL return True, regardless of shares, stealth, or assigned_to.
    """

    def test_owner_has_full_control_always(self):
        """Owner always gets full control regardless of chit state."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                owner_id = _random_uuid()
                other_ids = [_random_uuid() for _ in range(random.randint(0, 4))]
                shares = _random_shares(other_ids)
                tags = _random_tags()
                stealth = random.choice([True, False])
                assigned_to = random.choice(other_ids) if other_ids else None
                chit = _random_chit(owner_id, shares=shares, tags=tags,
                                    stealth=stealth, assigned_to=assigned_to)

                # Build random owner settings
                shared_tags = _random_shared_tags_config(tags, other_ids) if tags and other_ids else []
                owner_settings = _random_owner_settings(shared_tags=shared_tags)

                role = resolve_effective_role(chit, owner_id, owner_settings)
                self.assertEqual(role, "owner",
                                 f"Owner role should be 'owner', got '{role}' "
                                 f"(stealth={stealth}, iter {i})")
                self.assertTrue(can_edit_chit(chit, owner_id, owner_settings),
                                f"Owner should always be able to edit (iter {i})")
                self.assertTrue(can_delete_chit(chit, owner_id),
                                f"Owner should always be able to delete (iter {i})")
                self.assertTrue(can_manage_sharing(chit, owner_id),
                                f"Owner should always be able to manage sharing (iter {i})")


# ── Property 7: Stealth overrides all sharing for non-owners ─────────────

class TestProperty7StealthOverridesAllSharingForNonOwners(unittest.TestCase):
    """Feature: chit-sharing-system, Property 7: Stealth overrides all sharing for non-owners

    **Validates: Requirements 5.4, 6.2**

    For any chit where stealth == True and any user where user_id !=
    owner_id, resolve_effective_role SHALL return None regardless of
    shares, tag-level sharing, or assigned_to.
    """

    def test_stealth_hides_from_non_owners(self):
        """Stealth chits are invisible to all non-owners."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                owner_id = _random_uuid()
                non_owner_id = _random_uuid()

                # Give the non-owner every possible sharing path
                shares = [{"user_id": non_owner_id, "role": random.choice(["manager", "viewer"])}]
                tags = _random_tags(min_count=1, max_count=3)
                chit = _random_chit(owner_id, shares=shares, tags=tags,
                                    stealth=True, assigned_to=non_owner_id)

                shared_tags = _random_shared_tags_config(tags, [non_owner_id], role="manager")
                owner_settings = _random_owner_settings(shared_tags=shared_tags)

                role = resolve_effective_role(chit, non_owner_id, owner_settings)
                self.assertIsNone(role,
                                  f"Stealth chit should hide from non-owner, got '{role}' (iter {i})")


# ── Property 8: Assignment grants at least viewer access ─────────────────

class TestProperty8AssignmentGrantsAtLeastViewerAccess(unittest.TestCase):
    """Feature: chit-sharing-system, Property 8: Assignment grants at least viewer access

    **Validates: Requirements 7.2**

    For any non-stealth chit where assigned_to is set to a user's ID,
    resolve_effective_role SHALL return at least 'viewer' for that user.
    If the user also has a higher role via chit-level or tag-level shares,
    the higher role SHALL be returned instead.
    """

    def test_assignment_alone_grants_viewer(self):
        """Assignment with no other shares → viewer access."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                owner_id = _random_uuid()
                assignee_id = _random_uuid()
                chit = _random_chit(owner_id, shares=None, assigned_to=assignee_id)

                role = resolve_effective_role(chit, assignee_id)
                self.assertEqual(role, "viewer",
                                 f"Assignment alone should grant 'viewer', got '{role}' (iter {i})")

    def test_assignment_plus_higher_role_returns_higher(self):
        """Assignment + higher chit-level role → higher role wins."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                owner_id = _random_uuid()
                assignee_id = _random_uuid()
                higher_role = random.choice(["manager", "viewer"])
                shares = [{"user_id": assignee_id, "role": higher_role}]
                chit = _random_chit(owner_id, shares=shares, assigned_to=assignee_id)

                role = resolve_effective_role(chit, assignee_id)
                expected = higher_role if higher_role == "manager" else "viewer"
                self.assertEqual(role, expected,
                                 f"Expected '{expected}' (share={higher_role}), got '{role}' (iter {i})")
                # At minimum viewer
                self.assertIn(role, ("manager", "viewer", "owner"),
                              f"Assigned user should have at least viewer access (iter {i})")


# ── Property 9: Migration is idempotent and preserves data ───────────────

class TestProperty9MigrationIdempotentAndPreservesData(unittest.TestCase):
    """Feature: chit-sharing-system, Property 9: Migration is idempotent and preserves data

    **Validates: Requirements 9.1, 9.2, 9.4**

    For any database state, running migrate_add_sharing() multiple times
    SHALL produce no errors, the shares, stealth, assigned_to columns
    SHALL exist on the chits table, the shared_tags column SHALL exist
    on the settings table, and all pre-existing row data SHALL remain
    unchanged.
    """

    @staticmethod
    def _create_test_schema(db_path):
        """Create minimal chits and settings tables for migration testing."""
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS chits (
                id TEXT PRIMARY KEY,
                title TEXT,
                note TEXT,
                tags TEXT,
                owner_id TEXT,
                deleted BOOLEAN DEFAULT 0,
                created_datetime TEXT,
                modified_datetime TEXT
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS settings (
                user_id TEXT PRIMARY KEY,
                time_format TEXT,
                tags TEXT
            )
        """)
        conn.commit()
        conn.close()

    @staticmethod
    def _run_migration(db_path):
        """Run the migrate_add_sharing logic against a specific db_path.

        Inlined from src/backend/migrations.py to avoid importing the module
        (which depends on DB_PATH being the production path).
        """
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        cursor.execute("PRAGMA table_info(chits)")
        chit_cols = {row[1] for row in cursor.fetchall()}
        if "shares" not in chit_cols:
            cursor.execute("ALTER TABLE chits ADD COLUMN shares TEXT")
        if "stealth" not in chit_cols:
            cursor.execute("ALTER TABLE chits ADD COLUMN stealth BOOLEAN DEFAULT 0")
        if "assigned_to" not in chit_cols:
            cursor.execute("ALTER TABLE chits ADD COLUMN assigned_to TEXT")

        cursor.execute("PRAGMA table_info(settings)")
        settings_cols = {row[1] for row in cursor.fetchall()}
        if "shared_tags" not in settings_cols:
            cursor.execute("ALTER TABLE settings ADD COLUMN shared_tags TEXT")

        conn.commit()
        conn.close()

    @staticmethod
    def _get_columns(db_path, table):
        """Return the set of column names for a table."""
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute(f"PRAGMA table_info({table})")
        cols = {row[1] for row in cursor.fetchall()}
        conn.close()
        return cols

    def test_migration_idempotent_and_preserves_data(self):
        """Running migration multiple times is safe and preserves data."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
                db_path = tmp.name
                tmp.close()

                try:
                    self._create_test_schema(db_path)

                    # Insert random pre-existing data
                    conn = sqlite3.connect(db_path)
                    chit_id = _random_uuid()
                    owner_id = _random_uuid()
                    title = _random_title()
                    tags = json.dumps(_random_tags())
                    conn.execute(
                        "INSERT INTO chits (id, title, tags, owner_id, deleted) "
                        "VALUES (?, ?, ?, ?, 0)",
                        (chit_id, title, tags, owner_id),
                    )
                    settings_user_id = _random_uuid()
                    time_format = random.choice(["12h", "24h"])
                    conn.execute(
                        "INSERT INTO settings (user_id, time_format) VALUES (?, ?)",
                        (settings_user_id, time_format),
                    )
                    conn.commit()
                    conn.close()

                    # Run migration multiple times (2-5 times)
                    run_count = random.randint(2, 5)
                    for _ in range(run_count):
                        self._run_migration(db_path)

                    # Verify columns exist on chits
                    chit_cols = self._get_columns(db_path, "chits")
                    self.assertIn("shares", chit_cols,
                                  f"shares column should exist (iter {i})")
                    self.assertIn("stealth", chit_cols,
                                  f"stealth column should exist (iter {i})")
                    self.assertIn("assigned_to", chit_cols,
                                  f"assigned_to column should exist (iter {i})")

                    # Verify columns exist on settings
                    settings_cols = self._get_columns(db_path, "settings")
                    self.assertIn("shared_tags", settings_cols,
                                  f"shared_tags column should exist (iter {i})")

                    # Verify pre-existing data is unchanged
                    conn = sqlite3.connect(db_path)
                    conn.row_factory = sqlite3.Row
                    chit_row = conn.execute(
                        "SELECT * FROM chits WHERE id = ?", (chit_id,)
                    ).fetchone()
                    self.assertIsNotNone(chit_row, f"Chit should still exist (iter {i})")
                    self.assertEqual(chit_row["title"], title,
                                     f"Chit title should be unchanged (iter {i})")
                    self.assertEqual(chit_row["tags"], tags,
                                     f"Chit tags should be unchanged (iter {i})")
                    self.assertEqual(chit_row["owner_id"], owner_id,
                                     f"Chit owner_id should be unchanged (iter {i})")

                    settings_row = conn.execute(
                        "SELECT * FROM settings WHERE user_id = ?",
                        (settings_user_id,)
                    ).fetchone()
                    self.assertIsNotNone(settings_row,
                                         f"Settings should still exist (iter {i})")
                    self.assertEqual(settings_row["time_format"], time_format,
                                     f"Settings time_format should be unchanged (iter {i})")
                    conn.close()

                finally:
                    if os.path.exists(db_path):
                        os.unlink(db_path)


# ── Property 7 (sharing-ui-overhaul): Managers can manage sharing ────────

class TestProperty7ManagersCanManageSharing(unittest.TestCase):
    """Feature: sharing-ui-overhaul, Property 7: Managers can manage sharing

    **Validates: Requirements 2.1, 2.3, 2.4**

    For any chit and any user whose effective role is 'owner' or 'manager',
    can_manage_sharing() SHALL return True. For any user whose effective
    role is 'viewer' or None, can_manage_sharing() SHALL return False.
    """

    def test_owner_can_manage_sharing(self):
        """Owner always gets can_manage_sharing() == True."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                owner_id = _random_uuid()
                other_ids = [_random_uuid() for _ in range(random.randint(0, 4))]
                shares = _random_shares(other_ids)
                tags = _random_tags()
                stealth = random.choice([True, False])
                assigned_to = random.choice(other_ids) if other_ids else None
                chit = _random_chit(owner_id, shares=shares, tags=tags,
                                    stealth=stealth, assigned_to=assigned_to)

                shared_tags = _random_shared_tags_config(tags, other_ids) if tags and other_ids else []
                owner_settings = _random_owner_settings(shared_tags=shared_tags)

                self.assertTrue(can_manage_sharing(chit, owner_id, owner_settings),
                                f"Owner should always be able to manage sharing "
                                f"(stealth={stealth}, iter {i})")

    def test_chit_level_manager_can_manage_sharing(self):
        """Chit-level manager gets can_manage_sharing() == True."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                owner_id = _random_uuid()
                manager_id = _random_uuid()
                shares = [{"user_id": manager_id, "role": "manager"}]
                for _ in range(random.randint(0, 3)):
                    shares.append({"user_id": _random_uuid(), "role": _random_role()})
                chit = _random_chit(owner_id, shares=shares)

                self.assertTrue(can_manage_sharing(chit, manager_id),
                                f"Chit-level manager should be able to manage sharing (iter {i})")

    def test_tag_level_manager_can_manage_sharing(self):
        """Tag-level manager gets can_manage_sharing() == True."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                owner_id = _random_uuid()
                manager_id = _random_uuid()
                tags = _random_tags(min_count=1, max_count=3)
                chit = _random_chit(owner_id, shares=None, tags=tags)

                shared_tags = _random_shared_tags_config(tags, [manager_id], role="manager")
                owner_settings = _random_owner_settings(shared_tags=shared_tags)

                self.assertTrue(can_manage_sharing(chit, manager_id, owner_settings),
                                f"Tag-level manager should be able to manage sharing (iter {i})")

    def test_viewer_cannot_manage_sharing(self):
        """Viewer gets can_manage_sharing() == False."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                owner_id = _random_uuid()
                viewer_id = _random_uuid()
                shares = [{"user_id": viewer_id, "role": "viewer"}]
                for _ in range(random.randint(0, 3)):
                    shares.append({"user_id": _random_uuid(), "role": _random_role()})
                chit = _random_chit(owner_id, shares=shares)

                self.assertFalse(can_manage_sharing(chit, viewer_id),
                                 f"Viewer should not be able to manage sharing (iter {i})")

    def test_no_access_cannot_manage_sharing(self):
        """User with no access gets can_manage_sharing() == False."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                owner_id = _random_uuid()
                outsider_id = _random_uuid()
                other_ids = [_random_uuid() for _ in range(random.randint(0, 4))]
                shares = _random_shares(other_ids)
                chit = _random_chit(owner_id, shares=shares)

                self.assertFalse(can_manage_sharing(chit, outsider_id),
                                 f"User with no access should not manage sharing (iter {i})")

    def test_stealth_blocks_manager_from_managing(self):
        """Manager on a stealth chit gets can_manage_sharing() == False."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                owner_id = _random_uuid()
                manager_id = _random_uuid()
                shares = [{"user_id": manager_id, "role": "manager"}]
                chit = _random_chit(owner_id, shares=shares, stealth=True)

                self.assertFalse(can_manage_sharing(chit, manager_id),
                                 f"Manager on stealth chit should not manage sharing (iter {i})")


if __name__ == "__main__":
    unittest.main()
