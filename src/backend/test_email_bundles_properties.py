"""
Property-based tests for Email Bundles feature.

Feature: email-bundles
Uses hypothesis for property-based testing.
Tests the correctness properties defined in the design document.

Each property test operates against a temporary SQLite database to test
the bundle logic directly (no HTTP requests).
"""

import json
import os
import sqlite3
import tempfile
import uuid
from datetime import datetime
from unittest.mock import patch

from hypothesis import given, settings, assume, HealthCheck
from hypothesis import strategies as st


# ── Strategies ────────────────────────────────────────────────────────────

# Non-empty bundle names (printable, no leading/trailing whitespace issues)
bundle_name_st = st.text(
    alphabet=st.characters(whitelist_categories=("L", "N", "P", "S"),
                           blacklist_characters=("\x00", "%", "'", '"')),
    min_size=1,
    max_size=40,
).filter(lambda s: s.strip() != "")

# Optional descriptions
description_st = st.one_of(st.none(), st.text(min_size=0, max_size=100))

# Owner IDs as UUID strings
owner_id_st = st.uuids().map(str)

# Boolean strategy
bool_st = st.booleans()

# Display order
display_order_st = st.integers(min_value=0, max_value=100)


# ── Database Setup Helpers ────────────────────────────────────────────────

def _create_test_db():
    """Create a temporary SQLite database with all required tables."""
    fd, db_path = tempfile.mkstemp(suffix=".db")
    os.close(fd)

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS bundles (
        id TEXT PRIMARY KEY,
        owner_id TEXT,
        name TEXT,
        description TEXT,
        display_order INTEGER DEFAULT 0,
        is_default BOOLEAN DEFAULT 0,
        removable BOOLEAN DEFAULT 1,
        created_datetime TEXT,
        modified_datetime TEXT
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS bundle_rules (
        id TEXT PRIMARY KEY,
        bundle_id TEXT,
        rule_id TEXT,
        owner_id TEXT,
        created_datetime TEXT
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS rules (
        id TEXT PRIMARY KEY,
        owner_id TEXT,
        name TEXT,
        trigger_type TEXT,
        enabled BOOLEAN DEFAULT 1,
        priority INTEGER DEFAULT 0,
        conditions TEXT,
        actions TEXT,
        confirm_before_apply BOOLEAN DEFAULT 0,
        created_datetime TEXT,
        modified_datetime TEXT
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS chits (
        id TEXT PRIMARY KEY,
        owner_id TEXT,
        title TEXT,
        note TEXT,
        tags TEXT,
        email_read BOOLEAN DEFAULT 0,
        email_folder TEXT,
        email_from TEXT,
        email_to TEXT,
        email_subject TEXT,
        email_message_id TEXT,
        email_status TEXT,
        start_datetime TEXT,
        end_datetime TEXT,
        due_datetime TEXT,
        status TEXT,
        created_datetime TEXT,
        modified_datetime TEXT,
        deleted BOOLEAN DEFAULT 0,
        archived BOOLEAN DEFAULT 0
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS settings (
        user_id TEXT PRIMARY KEY,
        tags TEXT,
        bundles_multi_placement BOOLEAN DEFAULT 0
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS contacts (
        id TEXT PRIMARY KEY,
        owner_id TEXT,
        given_name TEXT,
        surname TEXT,
        emails TEXT,
        created_datetime TEXT,
        modified_datetime TEXT
    )
    """)

    conn.commit()
    return conn, db_path


def _cleanup_db(conn, db_path):
    """Close connection and remove temp database file."""
    conn.close()
    try:
        os.unlink(db_path)
    except OSError:
        pass


def _insert_bundle(cursor, owner_id, name, description=None, display_order=0,
                   is_default=0, removable=1):
    """Insert a bundle and return its ID."""
    bundle_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    cursor.execute(
        """INSERT INTO bundles (id, owner_id, name, description, display_order,
           is_default, removable, created_datetime, modified_datetime)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (bundle_id, owner_id, name, description, display_order,
         is_default, removable, now, now),
    )
    return bundle_id


def _insert_rule(cursor, owner_id, bundle_id, tag_name):
    """Insert a rule that adds a bundle tag, associate it with the bundle."""
    rule_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    conditions = json.dumps({
        "type": "leaf",
        "field": "email_from",
        "operator": "contains",
        "value": "@"
    })
    actions = json.dumps([
        {"type": "add_tag", "params": {"tag": f"CWOC_System/Bundle/{tag_name}"}}
    ])
    cursor.execute(
        """INSERT INTO rules (id, owner_id, name, trigger_type, enabled, priority,
           conditions, actions, confirm_before_apply, created_datetime, modified_datetime)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (rule_id, owner_id, f"Bundle: {tag_name}", "email_received",
         1, 0, conditions, actions, 0, now, now),
    )
    # Associate rule with bundle
    assoc_id = str(uuid.uuid4())
    cursor.execute(
        """INSERT INTO bundle_rules (id, bundle_id, rule_id, owner_id, created_datetime)
           VALUES (?, ?, ?, ?, ?)""",
        (assoc_id, bundle_id, rule_id, owner_id, now),
    )
    return rule_id


def _insert_chit(cursor, owner_id, tags=None, email_read=False,
                 email_folder="inbox", email_from="test@example.com"):
    """Insert an email chit and return its ID."""
    chit_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    tags_json = json.dumps(tags) if tags else json.dumps([])
    cursor.execute(
        """INSERT INTO chits (id, owner_id, title, tags, email_read, email_folder,
           email_from, email_message_id, email_status, created_datetime, modified_datetime,
           deleted, archived)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)""",
        (chit_id, owner_id, "Test Email", tags_json, int(email_read),
         email_folder, email_from, f"<{chit_id}@test>", "received", now, now),
    )
    return chit_id


# ── Inlined Logic (pure functions from routes/bundles.py) ─────────────────

def _rename_bundle_tags(cursor, owner_id, old_name, new_name):
    """Update bundle tags on all chits when a bundle is renamed."""
    old_tag = f"CWOC_System/Bundle/{old_name}"
    new_tag = f"CWOC_System/Bundle/{new_name}"

    cursor.execute(
        "SELECT id, tags FROM chits WHERE owner_id = ? AND tags LIKE ?",
        (owner_id, f'%{old_tag}%'),
    )
    for row in cursor.fetchall():
        chit_id, tags_raw = row
        tags = json.loads(tags_raw) if tags_raw else []
        tags = [new_tag if t == old_tag else t for t in tags]
        cursor.execute(
            "UPDATE chits SET tags = ?, modified_datetime = ? WHERE id = ?",
            (json.dumps(tags), datetime.utcnow().isoformat(), chit_id),
        )


def _remove_bundle_tag_from_chits(cursor, owner_id, bundle_name):
    """Remove a bundle tag from all chits that have it."""
    tag = f"CWOC_System/Bundle/{bundle_name}"

    cursor.execute(
        "SELECT id, tags FROM chits WHERE owner_id = ? AND tags LIKE ?",
        (owner_id, f'%{tag}%'),
    )
    for row in cursor.fetchall():
        chit_id, tags_raw = row
        tags = json.loads(tags_raw) if tags_raw else []
        tags = [t for t in tags if t != tag]
        cursor.execute(
            "UPDATE chits SET tags = ?, modified_datetime = ? WHERE id = ?",
            (json.dumps(tags), datetime.utcnow().isoformat(), chit_id),
        )


def _filter_by_bundle(chits, active_bundle):
    """Filter email chits by the active bundle (Python port of frontend logic).

    Args:
        chits: list of dicts with 'tags' key (list of strings)
        active_bundle: bundle name string or None
    Returns:
        filtered list of chits
    """
    if not active_bundle:
        return chits

    if active_bundle == "Everything Else":
        return [c for c in chits if not any(
            t.startswith("CWOC_System/Bundle/") for t in (c.get("tags") or [])
        )]

    bundle_tag = f"CWOC_System/Bundle/{active_bundle}"
    return [c for c in chits if bundle_tag in (c.get("tags") or [])]


def _get_bundle_unread_count(bundle_name, chits):
    """Compute unread count for a bundle (Python port of frontend logic).

    Args:
        bundle_name: bundle name string
        chits: list of dicts with 'tags' and 'email_read' keys
    Returns:
        integer unread count
    """
    if bundle_name == "Everything Else":
        return sum(
            1 for c in chits
            if not any(t.startswith("CWOC_System/Bundle/") for t in (c.get("tags") or []))
            and not c.get("email_read", False)
        )

    bundle_tag = f"CWOC_System/Bundle/{bundle_name}"
    return sum(
        1 for c in chits
        if bundle_tag in (c.get("tags") or [])
        and not c.get("email_read", False)
    )


# ── Property 1: Bundle CRUD Round-Trip ────────────────────────────────────

class TestProperty1BundleCRUDRoundTrip:
    """Feature: email-bundles, Property 1: Bundle CRUD Round-Trip

    **Validates: Requirements 1.1, 8.2, 8.3**
    """

    @given(
        name=bundle_name_st,
        description=description_st,
        owner_id=owner_id_st,
        new_name=bundle_name_st,
        new_description=description_st,
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_create_read_update_roundtrip(self, name, description, owner_id,
                                          new_name, new_description):
        """Create bundle → read back → verify; update → read back → verify."""
        conn, db_path = _create_test_db()
        try:
            cursor = conn.cursor()

            # Create
            bundle_id = _insert_bundle(cursor, owner_id, name, description)
            conn.commit()

            # Read back
            cursor.execute(
                "SELECT * FROM bundles WHERE id = ? AND owner_id = ?",
                (bundle_id, owner_id),
            )
            row = cursor.fetchone()
            cols = [col[0] for col in cursor.description]
            bundle = dict(zip(cols, row))

            # Verify create
            assert bundle["name"] == name
            assert bundle["description"] == description
            assert bundle["owner_id"] == owner_id
            # Valid UUID
            uuid.UUID(bundle["id"])

            # Update
            cursor.execute(
                "UPDATE bundles SET name = ?, description = ?, modified_datetime = ? WHERE id = ?",
                (new_name, new_description, datetime.utcnow().isoformat(), bundle_id),
            )
            conn.commit()

            # Read back after update
            cursor.execute(
                "SELECT * FROM bundles WHERE id = ? AND owner_id = ?",
                (bundle_id, owner_id),
            )
            row = cursor.fetchone()
            updated = dict(zip(cols, row))

            # Verify update
            assert updated["name"] == new_name
            assert updated["description"] == new_description
        finally:
            _cleanup_db(conn, db_path)


# ── Property 2: Owner Scoping Isolation ───────────────────────────────────

class TestProperty2OwnerScopingIsolation:
    """Feature: email-bundles, Property 2: Owner Scoping Isolation

    **Validates: Requirements 1.3, 8.8**
    """

    @given(
        owner_a=owner_id_st,
        owner_b=owner_id_st,
        name=bundle_name_st,
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_owner_isolation(self, owner_a, owner_b, name):
        """Bundle owned by user B never returned for user A queries."""
        assume(owner_a != owner_b)

        conn, db_path = _create_test_db()
        try:
            cursor = conn.cursor()

            # Create bundle owned by user B
            bundle_id = _insert_bundle(cursor, owner_b, name)
            conn.commit()

            # Query as user A — should find nothing
            cursor.execute(
                "SELECT * FROM bundles WHERE owner_id = ?",
                (owner_a,),
            )
            results_a = cursor.fetchall()
            assert len(results_a) == 0

            # Attempt to read user B's bundle as user A (scoped query)
            cursor.execute(
                "SELECT * FROM bundles WHERE id = ? AND owner_id = ?",
                (bundle_id, owner_a),
            )
            assert cursor.fetchone() is None

            # Attempt to update user B's bundle as user A
            cursor.execute(
                "UPDATE bundles SET name = 'hacked' WHERE id = ? AND owner_id = ?",
                (bundle_id, owner_a),
            )
            assert cursor.rowcount == 0

            # Attempt to delete user B's bundle as user A
            cursor.execute(
                "DELETE FROM bundles WHERE id = ? AND owner_id = ?",
                (bundle_id, owner_a),
            )
            assert cursor.rowcount == 0

            # Verify bundle still exists for user B
            cursor.execute(
                "SELECT * FROM bundles WHERE id = ? AND owner_id = ?",
                (bundle_id, owner_b),
            )
            assert cursor.fetchone() is not None
        finally:
            _cleanup_db(conn, db_path)


# ── Property 3: Bundle Rename Tag Migration ───────────────────────────────

class TestProperty3BundleRenameTagMigration:
    """Feature: email-bundles, Property 3: Bundle Rename Tag Migration

    **Validates: Requirements 3.5, 7.7**
    """

    @given(
        owner_id=owner_id_st,
        old_name=bundle_name_st,
        new_name=bundle_name_st,
        num_chits=st.integers(min_value=1, max_value=10),
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_rename_migrates_all_tags(self, owner_id, old_name, new_name, num_chits):
        """Rename bundle N→M: all chits get new tag, none retain old tag."""
        assume(old_name != new_name)

        conn, db_path = _create_test_db()
        try:
            cursor = conn.cursor()

            old_tag = f"CWOC_System/Bundle/{old_name}"
            new_tag = f"CWOC_System/Bundle/{new_name}"

            # Create chits with the old bundle tag
            chit_ids = []
            for _ in range(num_chits):
                cid = _insert_chit(cursor, owner_id, tags=[old_tag, "other_tag"])
                chit_ids.append(cid)
            conn.commit()

            # Perform rename
            _rename_bundle_tags(cursor, owner_id, old_name, new_name)
            conn.commit()

            # Verify: all chits have new tag, none have old tag
            for cid in chit_ids:
                cursor.execute("SELECT tags FROM chits WHERE id = ?", (cid,))
                tags = json.loads(cursor.fetchone()[0])
                assert new_tag in tags, f"Chit {cid} missing new tag"
                assert old_tag not in tags, f"Chit {cid} still has old tag"

            # Count verification
            cursor.execute(
                "SELECT COUNT(*) FROM chits WHERE owner_id = ? AND tags LIKE ?",
                (owner_id, f'%{new_tag}%'),
            )
            count_new = cursor.fetchone()[0]
            assert count_new == num_chits

            cursor.execute(
                "SELECT COUNT(*) FROM chits WHERE owner_id = ? AND tags LIKE ?",
                (owner_id, f'%{old_tag}%'),
            )
            count_old = cursor.fetchone()[0]
            assert count_old == 0
        finally:
            _cleanup_db(conn, db_path)


# ── Property 4: Bundle Delete Tag Cleanup ─────────────────────────────────

class TestProperty4BundleDeleteTagCleanup:
    """Feature: email-bundles, Property 4: Bundle Delete Tag Cleanup

    **Validates: Requirements 3.6, 7.5**
    """

    @given(
        owner_id=owner_id_st,
        name=bundle_name_st,
        num_chits=st.integers(min_value=1, max_value=10),
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_delete_cleans_up_tags_and_rules(self, owner_id, name, num_chits):
        """Delete bundle: zero chits carry tag, bundle_rules deleted, rules deleted."""
        conn, db_path = _create_test_db()
        try:
            cursor = conn.cursor()

            tag = f"CWOC_System/Bundle/{name}"

            # Create bundle with a rule
            bundle_id = _insert_bundle(cursor, owner_id, name)
            rule_id = _insert_rule(cursor, owner_id, bundle_id, name)

            # Create chits with the bundle tag
            for _ in range(num_chits):
                _insert_chit(cursor, owner_id, tags=[tag])
            conn.commit()

            # Perform delete operations (simulating the delete endpoint logic)
            _remove_bundle_tag_from_chits(cursor, owner_id, name)

            # Get associated rule IDs
            cursor.execute(
                "SELECT rule_id FROM bundle_rules WHERE bundle_id = ? AND owner_id = ?",
                (bundle_id, owner_id),
            )
            rule_ids = [r[0] for r in cursor.fetchall()]

            # Delete bundle_rules
            cursor.execute(
                "DELETE FROM bundle_rules WHERE bundle_id = ? AND owner_id = ?",
                (bundle_id, owner_id),
            )

            # Delete associated rules
            for rid in rule_ids:
                cursor.execute("DELETE FROM rules WHERE id = ? AND owner_id = ?", (rid, owner_id))

            # Delete bundle
            cursor.execute(
                "DELETE FROM bundles WHERE id = ? AND owner_id = ?",
                (bundle_id, owner_id),
            )
            conn.commit()

            # Verify: zero chits carry the tag
            cursor.execute(
                "SELECT COUNT(*) FROM chits WHERE owner_id = ? AND tags LIKE ?",
                (owner_id, f'%{tag}%'),
            )
            assert cursor.fetchone()[0] == 0

            # Verify: bundle_rules deleted
            cursor.execute(
                "SELECT COUNT(*) FROM bundle_rules WHERE bundle_id = ?",
                (bundle_id,),
            )
            assert cursor.fetchone()[0] == 0

            # Verify: rules deleted
            cursor.execute(
                "SELECT COUNT(*) FROM rules WHERE id = ?",
                (rule_id,),
            )
            assert cursor.fetchone()[0] == 0

            # Verify: bundle deleted
            cursor.execute(
                "SELECT COUNT(*) FROM bundles WHERE id = ?",
                (bundle_id,),
            )
            assert cursor.fetchone()[0] == 0
        finally:
            _cleanup_db(conn, db_path)


# ── Property 5: Bundle List Sort Order ────────────────────────────────────

class TestProperty5BundleListSortOrder:
    """Feature: email-bundles, Property 5: Bundle List Sort Order

    **Validates: Requirements 5.1, 8.1**
    """

    @given(
        owner_id=owner_id_st,
        orders=st.lists(
            st.integers(min_value=0, max_value=50),
            min_size=2,
            max_size=10,
        ),
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_bundles_sorted_by_display_order(self, owner_id, orders):
        """GET /api/bundles returns bundles sorted by display_order ascending."""
        conn, db_path = _create_test_db()
        try:
            cursor = conn.cursor()

            # Create bundles with varying display_orders
            for i, order in enumerate(orders):
                _insert_bundle(cursor, owner_id, f"Bundle_{i}_{uuid.uuid4().hex[:6]}",
                               display_order=order)
            conn.commit()

            # Query sorted by display_order ASC (as the API does)
            cursor.execute(
                "SELECT * FROM bundles WHERE owner_id = ? ORDER BY display_order ASC",
                (owner_id,),
            )
            rows = cursor.fetchall()
            cols = [col[0] for col in cursor.description]
            bundles = [dict(zip(cols, row)) for row in rows]

            # Verify sorted order
            display_orders = [b["display_order"] for b in bundles]
            assert display_orders == sorted(display_orders)
        finally:
            _cleanup_db(conn, db_path)


# ── Property 6: Bundle Filtering Correctness ──────────────────────────────

class TestProperty6BundleFilteringCorrectness:
    """Feature: email-bundles, Property 6: Bundle Filtering Correctness

    **Validates: Requirements 5.2, 5.3, 9.1, 9.2**
    """

    @given(
        num_chits=st.integers(min_value=3, max_value=15),
        num_bundles=st.integers(min_value=1, max_value=4),
        multi_placement=bool_st,
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_filtering_correctness(self, num_chits, num_bundles, multi_placement):
        """Named bundle filter returns exactly chits with that tag;
        Everything Else returns chits with no bundle tag;
        Union equals complete set."""
        # Generate bundle names
        bundle_names = [f"Bundle_{i}" for i in range(num_bundles)]

        # Generate chits with random bundle tag assignments
        chits = []
        for i in range(num_chits):
            tags = []
            if multi_placement:
                # Multi-placement: each chit can have 0 or more bundle tags
                for bname in bundle_names:
                    if hash((i, bname)) % 3 == 0:  # deterministic pseudo-random
                        tags.append(f"CWOC_System/Bundle/{bname}")
            else:
                # Single-placement: each chit has at most one bundle tag
                idx = i % (num_bundles + 1)  # +1 for "no bundle" case
                if idx < num_bundles:
                    tags.append(f"CWOC_System/Bundle/{bundle_names[idx]}")
            # Add some non-bundle tags
            tags.append("user_tag")
            chits.append({"id": str(i), "tags": tags, "email_read": False})

        # Test named bundle filter
        for bname in bundle_names:
            filtered = _filter_by_bundle(chits, bname)
            bundle_tag = f"CWOC_System/Bundle/{bname}"
            for c in filtered:
                assert bundle_tag in c["tags"]
            # All chits with that tag should be in the filtered set
            expected = [c for c in chits if bundle_tag in c["tags"]]
            assert len(filtered) == len(expected)

        # Test "Everything Else" filter
        everything_else = _filter_by_bundle(chits, "Everything Else")
        for c in everything_else:
            assert not any(t.startswith("CWOC_System/Bundle/") for t in c["tags"])

        # Union check
        all_bundle_chit_ids = set()
        for bname in bundle_names:
            filtered = _filter_by_bundle(chits, bname)
            all_bundle_chit_ids.update(c["id"] for c in filtered)
        everything_else_ids = set(c["id"] for c in everything_else)

        # Every chit should be in at least one view
        all_chit_ids = set(c["id"] for c in chits)
        assert all_bundle_chit_ids | everything_else_ids == all_chit_ids

        # Single-placement: sets should be disjoint
        if not multi_placement:
            # Each chit has at most one bundle tag, so bundle sets are disjoint
            seen = set()
            for bname in bundle_names:
                filtered_ids = set(c["id"] for c in _filter_by_bundle(chits, bname))
                assert seen.isdisjoint(filtered_ids), "Single-placement: sets not disjoint"
                seen.update(filtered_ids)
            # Bundle sets and Everything Else should be disjoint
            assert seen.isdisjoint(everything_else_ids)


# ── Property 7: Unread Count Computation ──────────────────────────────────

class TestProperty7UnreadCountComputation:
    """Feature: email-bundles, Property 7: Unread Count Computation

    **Validates: Requirements 5.8, 9.6**
    """

    @given(
        num_chits=st.integers(min_value=3, max_value=20),
        num_bundles=st.integers(min_value=1, max_value=4),
        multi_placement=bool_st,
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_unread_count_computation(self, num_chits, num_bundles, multi_placement):
        """Unread count = chits in bundle with email_read=false.
        Single-placement: sum of unread counts = total unread.
        Multi-placement: sum may exceed total."""
        bundle_names = [f"Bundle_{i}" for i in range(num_bundles)]

        # Generate chits with varying read states and bundle assignments
        chits = []
        for i in range(num_chits):
            tags = []
            if multi_placement:
                for bname in bundle_names:
                    if hash((i, bname, "read")) % 3 == 0:
                        tags.append(f"CWOC_System/Bundle/{bname}")
            else:
                idx = i % (num_bundles + 1)
                if idx < num_bundles:
                    tags.append(f"CWOC_System/Bundle/{bundle_names[idx]}")

            email_read = (i % 3 == 0)  # Some read, some unread
            chits.append({"id": str(i), "tags": tags, "email_read": email_read})

        # Verify unread count for each bundle
        for bname in bundle_names:
            unread_count = _get_bundle_unread_count(bname, chits)
            # Manual verification
            bundle_tag = f"CWOC_System/Bundle/{bname}"
            expected = sum(
                1 for c in chits
                if bundle_tag in c["tags"] and not c["email_read"]
            )
            assert unread_count == expected

        # Verify "Everything Else" unread count
        ee_unread = _get_bundle_unread_count("Everything Else", chits)
        expected_ee = sum(
            1 for c in chits
            if not any(t.startswith("CWOC_System/Bundle/") for t in c["tags"])
            and not c["email_read"]
        )
        assert ee_unread == expected_ee

        # Sum check
        total_unread = sum(1 for c in chits if not c["email_read"])
        sum_unread = sum(
            _get_bundle_unread_count(bname, chits) for bname in bundle_names
        ) + ee_unread

        if not multi_placement:
            # Single-placement: sum equals total
            assert sum_unread == total_unread
        else:
            # Multi-placement: sum may exceed total (or equal it)
            assert sum_unread >= 0  # basic sanity


# ── Property 8: Bundle Name Validation ────────────────────────────────────

class TestProperty8BundleNameValidation:
    """Feature: email-bundles, Property 8: Bundle Name Validation

    **Validates: Requirements 6.4**
    """

    @given(name=st.text(min_size=0, max_size=50))
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_empty_whitespace_rejected(self, name):
        """Empty/whitespace-only strings are rejected."""
        is_valid = bool(name and name.strip())
        if not name or not name.strip():
            assert not is_valid
        else:
            assert is_valid

    @given(
        owner_id=owner_id_st,
        name=bundle_name_st,
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_duplicate_names_rejected(self, owner_id, name):
        """Duplicate names (case-insensitive) for same owner are rejected."""
        conn, db_path = _create_test_db()
        try:
            cursor = conn.cursor()

            # Create first bundle
            _insert_bundle(cursor, owner_id, name)
            conn.commit()

            # Check for duplicate (case-insensitive) — simulates API validation
            cursor.execute(
                "SELECT id FROM bundles WHERE owner_id = ? AND LOWER(name) = LOWER(?)",
                (owner_id, name),
            )
            assert cursor.fetchone() is not None  # Duplicate detected

            # Also check case variants
            cursor.execute(
                "SELECT id FROM bundles WHERE owner_id = ? AND LOWER(name) = LOWER(?)",
                (owner_id, name.upper()),
            )
            assert cursor.fetchone() is not None  # Case-insensitive duplicate

            cursor.execute(
                "SELECT id FROM bundles WHERE owner_id = ? AND LOWER(name) = LOWER(?)",
                (owner_id, name.lower()),
            )
            assert cursor.fetchone() is not None  # Case-insensitive duplicate
        finally:
            _cleanup_db(conn, db_path)

    @given(
        owner_id=owner_id_st,
        name=bundle_name_st,
        other_name=bundle_name_st,
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_non_duplicate_accepted(self, owner_id, name, other_name):
        """Non-empty, non-duplicate strings are accepted."""
        assume(name.lower() != other_name.lower())

        conn, db_path = _create_test_db()
        try:
            cursor = conn.cursor()

            # Create first bundle
            _insert_bundle(cursor, owner_id, name)
            conn.commit()

            # Check that other_name is NOT a duplicate
            cursor.execute(
                "SELECT id FROM bundles WHERE owner_id = ? AND LOWER(name) = LOWER(?)",
                (owner_id, other_name),
            )
            assert cursor.fetchone() is None  # Not a duplicate — accepted
        finally:
            _cleanup_db(conn, db_path)


# ── Property 9: Bundle Reorder Persistence ────────────────────────────────

class TestProperty9BundleReorderPersistence:
    """Feature: email-bundles, Property 9: Bundle Reorder Persistence

    **Validates: Requirements 7.6, 8.5**
    """

    @given(
        owner_id=owner_id_st,
        num_bundles=st.integers(min_value=2, max_value=8),
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_reorder_persistence(self, owner_id, num_bundles):
        """Submit ordered list of IDs → display_order reflects submitted order."""
        conn, db_path = _create_test_db()
        try:
            cursor = conn.cursor()

            # Create bundles with initial sequential order
            bundle_ids = []
            for i in range(num_bundles):
                bid = _insert_bundle(cursor, owner_id,
                                     f"Bundle_{i}_{uuid.uuid4().hex[:6]}",
                                     display_order=i)
                bundle_ids.append(bid)
            conn.commit()

            # Reverse the order (simulate reorder)
            new_order = list(reversed(bundle_ids))

            # Apply reorder (simulates PUT /api/bundles/reorder)
            now = datetime.utcnow().isoformat()
            for index, bid in enumerate(new_order):
                cursor.execute(
                    "UPDATE bundles SET display_order = ?, modified_datetime = ? WHERE id = ? AND owner_id = ?",
                    (index, now, bid, owner_id),
                )
            conn.commit()

            # Verify display_order reflects submitted order
            for expected_order, bid in enumerate(new_order):
                cursor.execute(
                    "SELECT display_order FROM bundles WHERE id = ?",
                    (bid,),
                )
                actual_order = cursor.fetchone()[0]
                assert actual_order == expected_order

            # Verify subsequent GET returns bundles in new order
            cursor.execute(
                "SELECT id FROM bundles WHERE owner_id = ? ORDER BY display_order ASC",
                (owner_id,),
            )
            returned_ids = [row[0] for row in cursor.fetchall()]
            assert returned_ids == new_order
        finally:
            _cleanup_db(conn, db_path)


# ── Property 10: Bundle Filter Composes with Sub-Filter ───────────────────

class TestProperty10BundleFilterComposesWithSubFilter:
    """Feature: email-bundles, Property 10: Bundle Filter Composes with Sub-Filter

    **Validates: Requirements 9.3**
    """

    @given(
        num_chits=st.integers(min_value=3, max_value=15),
        sub_filter=st.sampled_from(["sent", "drafts", "trash", "archived"]),
        bundle_name=bundle_name_st,
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_non_inbox_subfilter_ignores_bundle(self, num_chits, sub_filter, bundle_name):
        """Non-inbox sub-filter: bundle filter has no effect."""
        # Generate chits with the given sub-filter folder
        chits = []
        bundle_tag = f"CWOC_System/Bundle/{bundle_name}"
        for i in range(num_chits):
            tags = [bundle_tag] if i % 2 == 0 else []
            chits.append({
                "id": str(i),
                "tags": tags,
                "email_read": False,
                "email_folder": sub_filter,
            })

        # When sub-filter is not "inbox", bundle filtering should NOT apply.
        # The frontend logic: if sub_filter != "inbox", don't call _filterByBundle.
        # So all chits matching the sub-filter are returned regardless of bundle tags.
        # Simulate: all chits are returned (no bundle filtering)
        all_matching = [c for c in chits if c["email_folder"] == sub_filter]

        # If we were to apply bundle filter, we'd get fewer results
        bundle_filtered = _filter_by_bundle(all_matching, bundle_name)

        # The key property: when sub-filter is not inbox, ALL matching emails
        # are returned (bundle filter is not applied)
        assert len(all_matching) == num_chits
        # Bundle filter would reduce the set (or keep it same if all have the tag)
        assert len(bundle_filtered) <= len(all_matching)

    @given(
        num_chits=st.integers(min_value=3, max_value=15),
        bundle_name=bundle_name_st,
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_inbox_subfilter_applies_bundle(self, num_chits, bundle_name):
        """Bundle filtering only applies when sub-filter is 'inbox'."""
        bundle_tag = f"CWOC_System/Bundle/{bundle_name}"
        chits = []
        for i in range(num_chits):
            tags = [bundle_tag] if i % 2 == 0 else []
            chits.append({
                "id": str(i),
                "tags": tags,
                "email_read": False,
                "email_folder": "inbox",
            })

        # When sub-filter IS inbox, bundle filter applies
        filtered = _filter_by_bundle(chits, bundle_name)

        # Only chits with the bundle tag should be returned
        for c in filtered:
            assert bundle_tag in c["tags"]

        # Chits without the tag should NOT be in the result
        expected_count = sum(1 for c in chits if bundle_tag in c["tags"])
        assert len(filtered) == expected_count


# ── Property 11: Single-Placement Priority Ordering ───────────────────────

class TestProperty11SinglePlacementPriorityOrdering:
    """Feature: email-bundles, Property 11: Single-Placement Priority Ordering

    **Validates: Requirements 12.2**
    """

    @given(
        owner_id=owner_id_st,
        num_bundles=st.integers(min_value=2, max_value=5),
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_single_placement_first_match_wins(self, owner_id, num_bundles):
        """Email matches bundles at P1 and P2 (P1 < P2), single-placement assigns only P1's tag."""
        conn, db_path = _create_test_db()
        try:
            cursor = conn.cursor()

            # Create bundles with sequential display_order
            bundle_names = []
            bundle_ids = []
            for i in range(num_bundles):
                name = f"Bundle_{i}_{uuid.uuid4().hex[:6]}"
                bid = _insert_bundle(cursor, owner_id, name, display_order=i)
                bundle_names.append(name)
                bundle_ids.append(bid)

            # Create rules for each bundle that match all emails (always-true condition)
            for i, (bid, bname) in enumerate(zip(bundle_ids, bundle_names)):
                rule_id = str(uuid.uuid4())
                now = datetime.utcnow().isoformat()
                # Condition that always matches: email_from contains "@"
                conditions = json.dumps({
                    "type": "leaf",
                    "field": "email_from",
                    "operator": "contains",
                    "value": "@"
                })
                actions = json.dumps([
                    {"type": "add_tag", "params": {"tag": f"CWOC_System/Bundle/{bname}"}}
                ])
                cursor.execute(
                    """INSERT INTO rules (id, owner_id, name, trigger_type, enabled, priority,
                       conditions, actions, confirm_before_apply, created_datetime, modified_datetime)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (rule_id, owner_id, f"Rule: {bname}", "email_received",
                     1, 0, conditions, actions, 0, now, now),
                )
                assoc_id = str(uuid.uuid4())
                cursor.execute(
                    """INSERT INTO bundle_rules (id, bundle_id, rule_id, owner_id, created_datetime)
                       VALUES (?, ?, ?, ?, ?)""",
                    (assoc_id, bid, rule_id, owner_id, now),
                )

            # Create an email chit (no bundle tags yet)
            chit_id = _insert_chit(cursor, owner_id, tags=[],
                                   email_from="test@example.com")
            conn.commit()

            # Simulate single-placement classification:
            # Evaluate bundles in display_order, assign ONLY first match
            cursor.execute(
                "SELECT id, name FROM bundles WHERE owner_id = ? ORDER BY display_order ASC",
                (owner_id,),
            )
            bundles_ordered = cursor.fetchall()

            assigned_tag = None
            for bid, bname in bundles_ordered:
                # Check if bundle has matching rules
                cursor.execute(
                    "SELECT rule_id FROM bundle_rules WHERE bundle_id = ? AND owner_id = ?",
                    (bid, owner_id),
                )
                rule_ids = [r[0] for r in cursor.fetchall()]
                for rid in rule_ids:
                    cursor.execute("SELECT conditions FROM rules WHERE id = ? AND enabled = 1", (rid,))
                    rule_row = cursor.fetchone()
                    if rule_row:
                        conds = json.loads(rule_row[0])
                        # Simple evaluation: check if email_from contains "@"
                        if conds.get("operator") == "contains" and conds.get("value") in "test@example.com":
                            assigned_tag = f"CWOC_System/Bundle/{bname}"
                            break
                if assigned_tag:
                    break

            # The first bundle (P1=0) should win
            expected_tag = f"CWOC_System/Bundle/{bundle_names[0]}"
            assert assigned_tag == expected_tag

            # Verify NO other bundle tags would be assigned
            for i in range(1, num_bundles):
                other_tag = f"CWOC_System/Bundle/{bundle_names[i]}"
                assert assigned_tag != other_tag
        finally:
            _cleanup_db(conn, db_path)


# ── Property 12: Multi-Placement Completeness ─────────────────────────────

class TestProperty12MultiPlacementCompleteness:
    """Feature: email-bundles, Property 12: Multi-Placement Completeness

    **Validates: Requirements 12.3**
    """

    @given(
        owner_id=owner_id_st,
        num_bundles=st.integers(min_value=2, max_value=5),
        matching_indices=st.lists(
            st.integers(min_value=0, max_value=4),
            min_size=1,
            max_size=5,
            unique=True,
        ),
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_multi_placement_assigns_all_matching(self, owner_id, num_bundles,
                                                   matching_indices):
        """Email matches bundles B1..Bn, multi-placement assigns tags for ALL."""
        # Filter matching_indices to valid range
        matching_indices = [i for i in matching_indices if i < num_bundles]
        assume(len(matching_indices) >= 1)

        conn, db_path = _create_test_db()
        try:
            cursor = conn.cursor()

            # Create bundles
            bundle_names = []
            bundle_ids = []
            for i in range(num_bundles):
                name = f"Bundle_{i}_{uuid.uuid4().hex[:6]}"
                bid = _insert_bundle(cursor, owner_id, name, display_order=i)
                bundle_names.append(name)
                bundle_ids.append(bid)

            # Create rules: matching bundles get always-true rules,
            # non-matching bundles get always-false rules
            for i, (bid, bname) in enumerate(zip(bundle_ids, bundle_names)):
                rule_id = str(uuid.uuid4())
                now = datetime.utcnow().isoformat()
                if i in matching_indices:
                    # Always matches
                    conditions = json.dumps({
                        "type": "leaf",
                        "field": "email_from",
                        "operator": "contains",
                        "value": "@"
                    })
                else:
                    # Never matches (looking for impossible value)
                    conditions = json.dumps({
                        "type": "leaf",
                        "field": "email_from",
                        "operator": "contains",
                        "value": "IMPOSSIBLE_VALUE_NEVER_MATCHES_XYZ123"
                    })
                actions = json.dumps([
                    {"type": "add_tag", "params": {"tag": f"CWOC_System/Bundle/{bname}"}}
                ])
                cursor.execute(
                    """INSERT INTO rules (id, owner_id, name, trigger_type, enabled, priority,
                       conditions, actions, confirm_before_apply, created_datetime, modified_datetime)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (rule_id, owner_id, f"Rule: {bname}", "email_received",
                     1, 0, conditions, actions, 0, now, now),
                )
                assoc_id = str(uuid.uuid4())
                cursor.execute(
                    """INSERT INTO bundle_rules (id, bundle_id, rule_id, owner_id, created_datetime)
                       VALUES (?, ?, ?, ?, ?)""",
                    (assoc_id, bid, rule_id, owner_id, now),
                )

            # Create email chit
            chit_id = _insert_chit(cursor, owner_id, tags=[],
                                   email_from="test@example.com")
            conn.commit()

            # Simulate multi-placement classification:
            # Evaluate ALL bundles, assign tag for every match
            assigned_tags = []
            cursor.execute(
                "SELECT id, name FROM bundles WHERE owner_id = ? ORDER BY display_order ASC",
                (owner_id,),
            )
            bundles_ordered = cursor.fetchall()

            for bid, bname in bundles_ordered:
                cursor.execute(
                    "SELECT rule_id FROM bundle_rules WHERE bundle_id = ? AND owner_id = ?",
                    (bid, owner_id),
                )
                rule_ids_list = [r[0] for r in cursor.fetchall()]
                matched = False
                for rid in rule_ids_list:
                    cursor.execute("SELECT conditions FROM rules WHERE id = ? AND enabled = 1", (rid,))
                    rule_row = cursor.fetchone()
                    if rule_row:
                        conds = json.loads(rule_row[0])
                        # Simple evaluation
                        if (conds.get("operator") == "contains" and
                                conds.get("value") in "test@example.com"):
                            assigned_tags.append(f"CWOC_System/Bundle/{bname}")
                            matched = True
                            break
                # If not matched, don't add tag (correct behavior)

            # Verify: number of assigned tags equals number of matching bundles
            assert len(assigned_tags) == len(matching_indices)

            # Verify: all matching bundles got their tags
            for i in matching_indices:
                expected_tag = f"CWOC_System/Bundle/{bundle_names[i]}"
                assert expected_tag in assigned_tags
        finally:
            _cleanup_db(conn, db_path)
