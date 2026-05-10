"""
Property-based tests for Email Thread Nests feature.

Feature: email-thread-nests
Uses hypothesis for property-based testing.
Tests the correctness properties defined in the design document.

Each property test operates against a temporary SQLite database to test
the nest logic directly (no HTTP requests).
"""

import json
import os
import sqlite3
import tempfile
import uuid
from datetime import datetime

from hypothesis import given, settings, assume, HealthCheck
from hypothesis import strategies as st


# ── Strategies ────────────────────────────────────────────────────────────

# Owner IDs as UUID strings
owner_id_st = st.uuids().map(str)

# Chit IDs as UUID strings
chit_id_st = st.uuids().map(str)

# Subject strings for truncation testing
subject_st = st.text(
    alphabet=st.characters(whitelist_categories=("L", "N", "P", "S", "Z"),
                           blacklist_characters=("\x00",)),
    min_size=0,
    max_size=100,
)


# ── Database Setup Helpers ────────────────────────────────────────────────

def _create_test_db():
    """Create a temporary SQLite database with the chits table."""
    fd, db_path = tempfile.mkstemp(suffix=".db")
    os.close(fd)

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS chits (
        id TEXT PRIMARY KEY,
        owner_id TEXT,
        title TEXT,
        note TEXT,
        tags TEXT,
        status TEXT,
        start_datetime TEXT,
        end_datetime TEXT,
        due_datetime TEXT,
        email_message_id TEXT,
        email_from TEXT,
        email_to TEXT,
        email_subject TEXT,
        email_status TEXT,
        email_date TEXT,
        email_in_reply_to TEXT,
        email_references TEXT,
        nest_thread_id TEXT DEFAULT NULL,
        created_datetime TEXT,
        modified_datetime TEXT,
        deleted BOOLEAN DEFAULT 0,
        archived BOOLEAN DEFAULT 0
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


def _insert_email_chit(cursor, owner_id, chit_id=None, email_message_id=None,
                       email_status="received", subject="Test Subject"):
    """Insert an email chit and return its ID."""
    if chit_id is None:
        chit_id = str(uuid.uuid4())
    if email_message_id is None:
        email_message_id = f"<{chit_id}@test.example>"
    now = datetime.utcnow().isoformat()
    cursor.execute(
        """INSERT INTO chits (id, owner_id, title, email_message_id, email_status,
           email_subject, email_date, created_datetime, modified_datetime, deleted)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)""",
        (chit_id, owner_id, subject, email_message_id, email_status,
         subject, now, now, now),
    )
    return chit_id


def _insert_non_email_chit(cursor, owner_id, chit_id=None, nest_thread_id=None):
    """Insert a non-email chit and return its ID."""
    if chit_id is None:
        chit_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    cursor.execute(
        """INSERT INTO chits (id, owner_id, title, nest_thread_id,
           created_datetime, modified_datetime, deleted)
           VALUES (?, ?, ?, ?, ?, ?, 0)""",
        (chit_id, owner_id, "Non-email chit", nest_thread_id, now, now),
    )
    return chit_id


# ── Nest Validation Logic (inlined from routes/chits.py) ─────────────────

def validate_nest_thread_id(cursor, nest_thread_id):
    """Validate that nest_thread_id references an existing email chit.

    Returns (is_valid, error_message) tuple.
    """
    if nest_thread_id is None:
        return True, None

    # Check that the referenced chit exists
    cursor.execute("SELECT id, email_message_id, email_status FROM chits WHERE id = ?",
                   (nest_thread_id,))
    row = cursor.fetchone()

    if row is None:
        return False, "nest_thread_id references a chit that does not exist"

    _, email_message_id, email_status = row
    if email_message_id is None and email_status is None:
        return False, "nest_thread_id must reference an email chit (has email_message_id or email_status)"

    return True, None


# ── Subject Label Truncation Logic (inlined from editor-nest.js) ──────────

def nest_truncate_subject(subject):
    """Return first 35 characters of subject if length > 35, or full string otherwise.

    Result never exceeds 35 characters.
    """
    if len(subject) > 35:
        return subject[:35]
    return subject


# ── Property 1: Nest Reference Validation ─────────────────────────────────

class TestProperty1NestReferenceValidation:
    """Feature: email-thread-nests, Property 1: Nest Reference Validation

    For any chit saved with a non-null nest_thread_id, the save succeeds
    iff the referenced ID corresponds to an existing email chit.

    **Validates: Requirements 1.4**
    """

    @given(owner_id=owner_id_st)
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_valid_nest_to_email_chit_succeeds(self, owner_id):
        """Nesting to an existing email chit (with email_message_id) succeeds."""
        conn, db_path = _create_test_db()
        try:
            cursor = conn.cursor()

            # Create an email chit to nest into
            email_chit_id = _insert_email_chit(cursor, owner_id)
            conn.commit()

            # Validate nesting to this email chit
            is_valid, error = validate_nest_thread_id(cursor, email_chit_id)
            assert is_valid is True
            assert error is None
        finally:
            _cleanup_db(conn, db_path)

    @given(owner_id=owner_id_st)
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_valid_nest_to_email_status_chit_succeeds(self, owner_id):
        """Nesting to an existing email chit (with email_status only) succeeds."""
        conn, db_path = _create_test_db()
        try:
            cursor = conn.cursor()

            # Create an email chit with email_status but no email_message_id
            chit_id = str(uuid.uuid4())
            now = datetime.utcnow().isoformat()
            cursor.execute(
                """INSERT INTO chits (id, owner_id, title, email_status,
                   created_datetime, modified_datetime, deleted)
                   VALUES (?, ?, ?, ?, ?, ?, 0)""",
                (chit_id, owner_id, "Draft email", "draft", now, now),
            )
            conn.commit()

            # Validate nesting to this email chit
            is_valid, error = validate_nest_thread_id(cursor, chit_id)
            assert is_valid is True
            assert error is None
        finally:
            _cleanup_db(conn, db_path)

    @given(owner_id=owner_id_st)
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_nest_to_nonexistent_chit_fails(self, owner_id):
        """Nesting to a non-existent chit ID fails."""
        conn, db_path = _create_test_db()
        try:
            cursor = conn.cursor()

            # Try to nest to a random ID that doesn't exist
            fake_id = str(uuid.uuid4())
            is_valid, error = validate_nest_thread_id(cursor, fake_id)
            assert is_valid is False
            assert "does not exist" in error
        finally:
            _cleanup_db(conn, db_path)

    @given(owner_id=owner_id_st)
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_nest_to_non_email_chit_fails(self, owner_id):
        """Nesting to a non-email chit (no email_message_id or email_status) fails."""
        conn, db_path = _create_test_db()
        try:
            cursor = conn.cursor()

            # Create a non-email chit
            non_email_id = _insert_non_email_chit(cursor, owner_id)
            conn.commit()

            # Try to nest to this non-email chit
            is_valid, error = validate_nest_thread_id(cursor, non_email_id)
            assert is_valid is False
            assert "must reference an email chit" in error
        finally:
            _cleanup_db(conn, db_path)

    @given(owner_id=owner_id_st)
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_null_nest_thread_id_always_valid(self, owner_id):
        """A null nest_thread_id is always valid (no nesting)."""
        conn, db_path = _create_test_db()
        try:
            cursor = conn.cursor()

            is_valid, error = validate_nest_thread_id(cursor, None)
            assert is_valid is True
            assert error is None
        finally:
            _cleanup_db(conn, db_path)

    @given(
        owner_id=owner_id_st,
        num_email_chits=st.integers(min_value=1, max_value=5),
        num_non_email_chits=st.integers(min_value=1, max_value=5),
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_validation_distinguishes_email_from_non_email(self, owner_id,
                                                           num_email_chits,
                                                           num_non_email_chits):
        """For any mix of email and non-email chits, validation correctly
        accepts references to email chits and rejects references to non-email chits."""
        conn, db_path = _create_test_db()
        try:
            cursor = conn.cursor()

            email_ids = []
            for _ in range(num_email_chits):
                eid = _insert_email_chit(cursor, owner_id)
                email_ids.append(eid)

            non_email_ids = []
            for _ in range(num_non_email_chits):
                nid = _insert_non_email_chit(cursor, owner_id)
                non_email_ids.append(nid)

            conn.commit()

            # All email chit references should be valid
            for eid in email_ids:
                is_valid, error = validate_nest_thread_id(cursor, eid)
                assert is_valid is True, f"Expected valid for email chit {eid}"

            # All non-email chit references should be invalid
            for nid in non_email_ids:
                is_valid, error = validate_nest_thread_id(cursor, nid)
                assert is_valid is False, f"Expected invalid for non-email chit {nid}"

            # Non-existent ID should be invalid
            fake_id = str(uuid.uuid4())
            is_valid, error = validate_nest_thread_id(cursor, fake_id)
            assert is_valid is False
        finally:
            _cleanup_db(conn, db_path)


# ── Cascade Cleanup Logic (inlined from routes/trash.py) ──────────────────

def cascade_cleanup_on_delete(cursor, deleted_chit_id):
    """When an email chit is permanently deleted, null out all nest_thread_id
    references pointing to it.

    This simulates the cascade logic executed during permanent deletion.
    """
    cursor.execute(
        "UPDATE chits SET nest_thread_id = NULL WHERE nest_thread_id = ?",
        (deleted_chit_id,),
    )


# ── Property 2: Cascade Cleanup on Delete ─────────────────────────────────

class TestProperty2CascadeCleanupOnDelete:
    """Feature: email-thread-nests, Property 2: Cascade Cleanup on Delete

    For any email chit that is permanently deleted, all chits in the database
    whose nest_thread_id equals the deleted chit's ID shall have their
    nest_thread_id set to NULL after the deletion completes. No other chits'
    nest_thread_id values shall be affected.

    **Validates: Requirements 1.5**
    """

    @given(
        owner_id=owner_id_st,
        num_referencing=st.integers(min_value=1, max_value=5),
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_all_referencing_chits_get_nulled(self, owner_id, num_referencing):
        """All chits whose nest_thread_id equals the deleted email chit's ID
        have their nest_thread_id set to NULL after cascade cleanup."""
        conn, db_path = _create_test_db()
        try:
            cursor = conn.cursor()

            # Create the email chit that will be deleted
            email_chit_id = _insert_email_chit(cursor, owner_id)

            # Create non-email chits that reference the email chit
            referencing_ids = []
            for _ in range(num_referencing):
                nid = _insert_non_email_chit(cursor, owner_id, nest_thread_id=email_chit_id)
                referencing_ids.append(nid)

            conn.commit()

            # Verify they all reference the email chit before deletion
            for rid in referencing_ids:
                cursor.execute("SELECT nest_thread_id FROM chits WHERE id = ?", (rid,))
                assert cursor.fetchone()[0] == email_chit_id

            # Perform cascade cleanup (simulating permanent deletion)
            cascade_cleanup_on_delete(cursor, email_chit_id)
            conn.commit()

            # All referencing chits should now have nest_thread_id = NULL
            for rid in referencing_ids:
                cursor.execute("SELECT nest_thread_id FROM chits WHERE id = ?", (rid,))
                assert cursor.fetchone()[0] is None
        finally:
            _cleanup_db(conn, db_path)

    @given(
        owner_id=owner_id_st,
        num_referencing_target=st.integers(min_value=1, max_value=3),
        num_referencing_other=st.integers(min_value=1, max_value=3),
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_chits_referencing_other_emails_not_affected(self, owner_id,
                                                         num_referencing_target,
                                                         num_referencing_other):
        """Chits referencing OTHER email chits are NOT affected by the cascade."""
        conn, db_path = _create_test_db()
        try:
            cursor = conn.cursor()

            # Create two email chits: one to delete, one to keep
            target_email_id = _insert_email_chit(cursor, owner_id)
            other_email_id = _insert_email_chit(cursor, owner_id)

            # Create chits referencing the target (will be cleaned up)
            target_refs = []
            for _ in range(num_referencing_target):
                nid = _insert_non_email_chit(cursor, owner_id, nest_thread_id=target_email_id)
                target_refs.append(nid)

            # Create chits referencing the other email (should NOT be affected)
            other_refs = []
            for _ in range(num_referencing_other):
                nid = _insert_non_email_chit(cursor, owner_id, nest_thread_id=other_email_id)
                other_refs.append(nid)

            conn.commit()

            # Perform cascade cleanup for the target email only
            cascade_cleanup_on_delete(cursor, target_email_id)
            conn.commit()

            # Target references should be nulled
            for rid in target_refs:
                cursor.execute("SELECT nest_thread_id FROM chits WHERE id = ?", (rid,))
                assert cursor.fetchone()[0] is None

            # Other references should remain intact
            for rid in other_refs:
                cursor.execute("SELECT nest_thread_id FROM chits WHERE id = ?", (rid,))
                assert cursor.fetchone()[0] == other_email_id
        finally:
            _cleanup_db(conn, db_path)

    @given(
        owner_id=owner_id_st,
        num_null_chits=st.integers(min_value=1, max_value=5),
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_chits_with_null_nest_thread_id_not_affected(self, owner_id, num_null_chits):
        """Chits with NULL nest_thread_id are NOT affected by the cascade."""
        conn, db_path = _create_test_db()
        try:
            cursor = conn.cursor()

            # Create the email chit that will be deleted
            email_chit_id = _insert_email_chit(cursor, owner_id)

            # Create chits with no nest association (nest_thread_id = NULL)
            null_chit_ids = []
            for _ in range(num_null_chits):
                nid = _insert_non_email_chit(cursor, owner_id, nest_thread_id=None)
                null_chit_ids.append(nid)

            conn.commit()

            # Perform cascade cleanup
            cascade_cleanup_on_delete(cursor, email_chit_id)
            conn.commit()

            # Chits with NULL nest_thread_id should still be NULL (unaffected)
            for nid in null_chit_ids:
                cursor.execute("SELECT nest_thread_id FROM chits WHERE id = ?", (nid,))
                assert cursor.fetchone()[0] is None
        finally:
            _cleanup_db(conn, db_path)

    @given(
        owner_id=owner_id_st,
        num_referencing_target=st.integers(min_value=1, max_value=3),
        num_referencing_other=st.integers(min_value=1, max_value=3),
        num_null_chits=st.integers(min_value=0, max_value=3),
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_cascade_only_affects_exact_references(self, owner_id,
                                                    num_referencing_target,
                                                    num_referencing_other,
                                                    num_null_chits):
        """Combined test: cascade nulls only exact matches; other references
        and null values remain unchanged."""
        conn, db_path = _create_test_db()
        try:
            cursor = conn.cursor()

            # Create two email chits
            target_email_id = _insert_email_chit(cursor, owner_id)
            other_email_id = _insert_email_chit(cursor, owner_id)

            # Chits referencing the target
            target_refs = []
            for _ in range(num_referencing_target):
                nid = _insert_non_email_chit(cursor, owner_id, nest_thread_id=target_email_id)
                target_refs.append(nid)

            # Chits referencing another email
            other_refs = []
            for _ in range(num_referencing_other):
                nid = _insert_non_email_chit(cursor, owner_id, nest_thread_id=other_email_id)
                other_refs.append(nid)

            # Chits with no nest association
            null_refs = []
            for _ in range(num_null_chits):
                nid = _insert_non_email_chit(cursor, owner_id, nest_thread_id=None)
                null_refs.append(nid)

            conn.commit()

            # Perform cascade cleanup for target
            cascade_cleanup_on_delete(cursor, target_email_id)
            conn.commit()

            # Target references → NULL
            for rid in target_refs:
                cursor.execute("SELECT nest_thread_id FROM chits WHERE id = ?", (rid,))
                assert cursor.fetchone()[0] is None

            # Other references → unchanged
            for rid in other_refs:
                cursor.execute("SELECT nest_thread_id FROM chits WHERE id = ?", (rid,))
                assert cursor.fetchone()[0] == other_email_id

            # Null references → still NULL
            for nid in null_refs:
                cursor.execute("SELECT nest_thread_id FROM chits WHERE id = ?", (nid,))
                assert cursor.fetchone()[0] is None
        finally:
            _cleanup_db(conn, db_path)


# ── Property 3: Subject Label Truncation ──────────────────────────────────

class TestProperty3SubjectLabelTruncation:
    """Feature: email-thread-nests, Property 3: Subject Label Truncation

    For any string, the displayed text is the first 35 characters if
    length > 35, or the full string otherwise; result never exceeds 35 characters.

    **Validates: Requirements 2.5, 2.6**
    """

    @given(subject=subject_st)
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_truncation_never_exceeds_35_chars(self, subject):
        """Result never exceeds 35 characters regardless of input."""
        result = nest_truncate_subject(subject)
        assert len(result) <= 35

    @given(subject=subject_st)
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_short_subjects_returned_unchanged(self, subject):
        """Subjects of 35 chars or fewer are returned in full."""
        assume(len(subject) <= 35)
        result = nest_truncate_subject(subject)
        assert result == subject

    @given(subject=subject_st)
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_long_subjects_truncated_to_first_35(self, subject):
        """Subjects longer than 35 chars return exactly the first 35 characters."""
        assume(len(subject) > 35)
        result = nest_truncate_subject(subject)
        assert result == subject[:35]
        assert len(result) == 35

    @given(subject=subject_st)
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_result_is_prefix_of_original(self, subject):
        """The result is always a prefix of the original string."""
        result = nest_truncate_subject(subject)
        assert subject.startswith(result)


# ── Nest Button Visibility Logic (inlined from editor-nest.js) ────────────

def nest_is_email_chit(chit):
    """Return True if chit has email_message_id or email_status set (truthy).

    When this returns True, the nest button is hidden (chit is an email chit).
    When this returns False, the nest button is visible (chit is not an email chit).
    """
    return bool(chit.get("email_message_id") or chit.get("email_status"))


# ── Strategies for Property 4 ────────────────────────────────────────────

# email_message_id values: None, empty string, or non-empty string
email_message_id_st = st.one_of(
    st.none(),
    st.just(""),
    st.text(min_size=1, max_size=50, alphabet=st.characters(
        whitelist_categories=("L", "N", "P"),
        blacklist_characters=("\x00",)
    )),
)

# email_status values: None, empty string, or non-empty string
email_status_st = st.one_of(
    st.none(),
    st.just(""),
    st.text(min_size=1, max_size=30, alphabet=st.characters(
        whitelist_categories=("L", "N"),
        blacklist_characters=("\x00",)
    )),
)

# A chit-like dict with various combinations of email_message_id and email_status
chit_with_email_fields_st = st.fixed_dictionaries({
    "id": st.uuids().map(str),
    "title": st.text(min_size=0, max_size=50),
    "email_message_id": email_message_id_st,
    "email_status": email_status_st,
})


# ── Property 4: Nest Button Visibility ───────────────────────────────────

class TestProperty4NestButtonVisibility:
    """Feature: email-thread-nests, Property 4: Nest Button Visibility

    For any chit, the nest button is hidden (not displayed) if and only if
    the chit has a non-null `email_message_id` or a non-null `email_status`.
    For all other chits, the nest button is visible.

    **Validates: Requirements 2.7**
    """

    @given(chit=chit_with_email_fields_st)
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_chit_with_email_message_id_hides_button(self, chit):
        """Chits with a truthy email_message_id → button hidden (is_email_chit = True)."""
        assume(bool(chit.get("email_message_id")))
        result = nest_is_email_chit(chit)
        assert result is True, (
            f"Expected button hidden (is_email_chit=True) for chit with "
            f"email_message_id='{chit['email_message_id']}'"
        )

    @given(chit=chit_with_email_fields_st)
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_chit_with_email_status_hides_button(self, chit):
        """Chits with a truthy email_status → button hidden (is_email_chit = True)."""
        assume(bool(chit.get("email_status")))
        result = nest_is_email_chit(chit)
        assert result is True, (
            f"Expected button hidden (is_email_chit=True) for chit with "
            f"email_status='{chit['email_status']}'"
        )

    @given(chit=chit_with_email_fields_st)
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_chit_with_both_fields_hides_button(self, chit):
        """Chits with both email_message_id and email_status truthy → button hidden."""
        assume(bool(chit.get("email_message_id")) and bool(chit.get("email_status")))
        result = nest_is_email_chit(chit)
        assert result is True, (
            f"Expected button hidden (is_email_chit=True) for chit with "
            f"email_message_id='{chit['email_message_id']}' and "
            f"email_status='{chit['email_status']}'"
        )

    @given(chit=chit_with_email_fields_st)
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_chit_with_neither_field_shows_button(self, chit):
        """Chits with neither email_message_id nor email_status truthy → button visible."""
        assume(not bool(chit.get("email_message_id")) and not bool(chit.get("email_status")))
        result = nest_is_email_chit(chit)
        assert result is False, (
            f"Expected button visible (is_email_chit=False) for chit with "
            f"email_message_id='{chit.get('email_message_id')}' and "
            f"email_status='{chit.get('email_status')}'"
        )

    @given(chit=chit_with_email_fields_st)
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_button_hidden_iff_email_fields_truthy(self, chit):
        """The universal property: button hidden iff (email_message_id or email_status) is truthy.

        This is the core biconditional property — nest_is_email_chit returns True
        exactly when at least one of the email fields is truthy."""
        expected_hidden = bool(chit.get("email_message_id")) or bool(chit.get("email_status"))
        result = nest_is_email_chit(chit)
        assert result == expected_hidden, (
            f"Expected is_email_chit={expected_hidden} but got {result} for chit with "
            f"email_message_id='{chit.get('email_message_id')}', "
            f"email_status='{chit.get('email_status')}'"
        )


# ── Property 10: Nest Thread ID API Round-Trip ────────────────────────────

class TestProperty10NestThreadIdApiRoundTrip:
    """Feature: email-thread-nests, Property 10: Nest Thread ID API Round-Trip

    For any valid nest_thread_id value (referencing an existing email chit),
    saving it and then retrieving the chit returns the same nest_thread_id value.
    Setting nest_thread_id to null and saving results in the field being null
    on subsequent retrieval.

    **Validates: Requirements 7.1, 7.2**
    """

    @given(owner_id=owner_id_st)
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_save_valid_nest_thread_id_round_trips(self, owner_id):
        """Inserting a chit with a valid nest_thread_id and selecting it back
        returns the same nest_thread_id value."""
        conn, db_path = _create_test_db()
        try:
            cursor = conn.cursor()

            # Create an email chit to nest into
            email_chit_id = _insert_email_chit(cursor, owner_id)

            # Create a non-email chit with nest_thread_id set to the email chit
            non_email_id = _insert_non_email_chit(cursor, owner_id,
                                                   nest_thread_id=email_chit_id)
            conn.commit()

            # Retrieve the chit and verify nest_thread_id matches
            cursor.execute("SELECT nest_thread_id FROM chits WHERE id = ?",
                           (non_email_id,))
            row = cursor.fetchone()
            assert row is not None
            assert row[0] == email_chit_id
        finally:
            _cleanup_db(conn, db_path)

    @given(owner_id=owner_id_st)
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_set_nest_thread_id_to_null_round_trips(self, owner_id):
        """Setting nest_thread_id to NULL via UPDATE and selecting it back
        returns NULL."""
        conn, db_path = _create_test_db()
        try:
            cursor = conn.cursor()

            # Create an email chit to nest into
            email_chit_id = _insert_email_chit(cursor, owner_id)

            # Create a non-email chit with nest_thread_id set
            non_email_id = _insert_non_email_chit(cursor, owner_id,
                                                   nest_thread_id=email_chit_id)
            conn.commit()

            # Verify it's set
            cursor.execute("SELECT nest_thread_id FROM chits WHERE id = ?",
                           (non_email_id,))
            assert cursor.fetchone()[0] == email_chit_id

            # Update nest_thread_id to NULL (simulating un-nest via PUT)
            cursor.execute("UPDATE chits SET nest_thread_id = NULL WHERE id = ?",
                           (non_email_id,))
            conn.commit()

            # Retrieve and verify it's now NULL
            cursor.execute("SELECT nest_thread_id FROM chits WHERE id = ?",
                           (non_email_id,))
            row = cursor.fetchone()
            assert row is not None
            assert row[0] is None
        finally:
            _cleanup_db(conn, db_path)

    @given(owner_id=owner_id_st)
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_full_round_trip_set_then_clear(self, owner_id):
        """Full round-trip: insert with nest_thread_id → verify → update to NULL → verify NULL."""
        conn, db_path = _create_test_db()
        try:
            cursor = conn.cursor()

            # Create an email chit to nest into
            email_chit_id = _insert_email_chit(cursor, owner_id)

            # Step 1: Insert a non-email chit with nest_thread_id set
            non_email_id = _insert_non_email_chit(cursor, owner_id,
                                                   nest_thread_id=email_chit_id)
            conn.commit()

            # Step 2: SELECT it back and verify nest_thread_id matches
            cursor.execute("SELECT nest_thread_id FROM chits WHERE id = ?",
                           (non_email_id,))
            assert cursor.fetchone()[0] == email_chit_id

            # Step 3: UPDATE nest_thread_id to NULL
            cursor.execute("UPDATE chits SET nest_thread_id = NULL WHERE id = ?",
                           (non_email_id,))
            conn.commit()

            # Step 4: SELECT it back and verify nest_thread_id is NULL
            cursor.execute("SELECT nest_thread_id FROM chits WHERE id = ?",
                           (non_email_id,))
            assert cursor.fetchone()[0] is None
        finally:
            _cleanup_db(conn, db_path)

    @given(owner_id=owner_id_st)
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_insert_with_null_nest_thread_id_round_trips(self, owner_id):
        """Inserting a chit with nest_thread_id=NULL and selecting it back
        returns NULL (default state)."""
        conn, db_path = _create_test_db()
        try:
            cursor = conn.cursor()

            # Create a non-email chit with no nest association
            non_email_id = _insert_non_email_chit(cursor, owner_id,
                                                   nest_thread_id=None)
            conn.commit()

            # Retrieve and verify nest_thread_id is NULL
            cursor.execute("SELECT nest_thread_id FROM chits WHERE id = ?",
                           (non_email_id,))
            row = cursor.fetchone()
            assert row is not None
            assert row[0] is None
        finally:
            _cleanup_db(conn, db_path)

    @given(
        owner_id=owner_id_st,
        num_email_chits=st.integers(min_value=2, max_value=5),
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_update_nest_thread_id_to_different_email_round_trips(self, owner_id,
                                                                    num_email_chits):
        """Updating nest_thread_id from one valid email chit to another and
        selecting it back returns the new value."""
        conn, db_path = _create_test_db()
        try:
            cursor = conn.cursor()

            # Create multiple email chits
            email_ids = []
            for _ in range(num_email_chits):
                eid = _insert_email_chit(cursor, owner_id)
                email_ids.append(eid)

            # Create a non-email chit nested to the first email
            non_email_id = _insert_non_email_chit(cursor, owner_id,
                                                   nest_thread_id=email_ids[0])
            conn.commit()

            # Verify initial value
            cursor.execute("SELECT nest_thread_id FROM chits WHERE id = ?",
                           (non_email_id,))
            assert cursor.fetchone()[0] == email_ids[0]

            # Update to a different email chit
            new_target = email_ids[1]
            cursor.execute("UPDATE chits SET nest_thread_id = ? WHERE id = ?",
                           (new_target, non_email_id))
            conn.commit()

            # Verify the updated value round-trips correctly
            cursor.execute("SELECT nest_thread_id FROM chits WHERE id = ?",
                           (non_email_id,))
            assert cursor.fetchone()[0] == new_target
        finally:
            _cleanup_db(conn, db_path)


# ── Thread Search Filtering Logic (inlined from routes/email.py) ──────────

def filter_threads_by_query(threads, query):
    """Filter thread summaries by case-insensitive substring match on subject.

    Returns all threads if query is empty/falsy.
    """
    if not query:
        return threads
    q_lower = query.lower()
    return [t for t in threads if q_lower in t["subject"].lower()]


# ── Strategies for Property 5 ────────────────────────────────────────────

# Thread summary dicts with a subject field
thread_subject_st = st.text(
    alphabet=st.characters(whitelist_categories=("L", "N", "P", "S", "Z"),
                           blacklist_characters=("\x00",)),
    min_size=0,
    max_size=80,
)

thread_summary_st = st.fixed_dictionaries({
    "thread_id": st.uuids().map(str),
    "subject": thread_subject_st,
    "latest_date": st.just("2026-06-15T10:30:00Z"),
    "message_count": st.integers(min_value=1, max_value=50),
})

thread_list_st = st.lists(thread_summary_st, min_size=0, max_size=10)

# Query strings for filtering
query_st = st.text(
    alphabet=st.characters(whitelist_categories=("L", "N", "P", "S", "Z"),
                           blacklist_characters=("\x00",)),
    min_size=0,
    max_size=30,
)


# ── Property 5: Thread Search Filtering ───────────────────────────────────

class TestProperty5ThreadSearchFiltering:
    """Feature: email-thread-nests, Property 5: Thread Search Filtering

    For any search query string and any set of email threads, the filtered
    results contain exactly those threads whose subject contains the query
    as a case-insensitive substring. No thread whose subject does not contain
    the query appears in the results.

    **Validates: Requirements 3.3, 7.5**
    """

    @given(threads=thread_list_st, query=query_st)
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_all_returned_threads_contain_query(self, threads, query):
        """Every thread in the filtered results contains the query as a
        case-insensitive substring in its subject."""
        assume(len(query) > 0)
        results = filter_threads_by_query(threads, query)
        q_lower = query.lower()
        for t in results:
            assert q_lower in t["subject"].lower(), (
                f"Thread with subject '{t['subject']}' should not be in results "
                f"for query '{query}'"
            )

    @given(threads=thread_list_st, query=query_st)
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_no_matching_thread_excluded(self, threads, query):
        """No thread whose subject contains the query is excluded from results."""
        assume(len(query) > 0)
        results = filter_threads_by_query(threads, query)
        result_ids = {t["thread_id"] for t in results}
        q_lower = query.lower()
        for t in threads:
            if q_lower in t["subject"].lower():
                assert t["thread_id"] in result_ids, (
                    f"Thread with subject '{t['subject']}' should be in results "
                    f"for query '{query}' but was excluded"
                )

    @given(threads=thread_list_st)
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_empty_query_returns_all_threads(self, threads):
        """An empty query returns all threads unchanged."""
        results = filter_threads_by_query(threads, "")
        assert results == threads

    @given(threads=thread_list_st, query=query_st)
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_case_insensitive_matching(self, threads, query):
        """Case doesn't matter: uppercase query matches lowercase subject
        and vice versa. The result set is the same regardless of query case."""
        assume(len(query) > 0)
        results_original = filter_threads_by_query(threads, query)
        results_upper = filter_threads_by_query(threads, query.upper())
        results_lower = filter_threads_by_query(threads, query.lower())

        # All case variants produce the same set of thread_ids
        ids_original = {t["thread_id"] for t in results_original}
        ids_upper = {t["thread_id"] for t in results_upper}
        ids_lower = {t["thread_id"] for t in results_lower}

        assert ids_original == ids_upper, (
            f"Upper-case query '{query.upper()}' produced different results "
            f"than original '{query}'"
        )
        assert ids_original == ids_lower, (
            f"Lower-case query '{query.lower()}' produced different results "
            f"than original '{query}'"
        )


# ── Thread Endpoint Includes Nests Logic (inlined from routes/email.py) ───

def get_nested_chits_for_thread(cursor, thread_member_ids):
    """Given a set of email chit IDs (the thread members), return all non-deleted,
    non-email chits whose nest_thread_id references any of those thread member IDs,
    each with is_nest=True.

    This simulates the logic in GET /api/email/thread/{chit_id}.
    Non-email chits are those without email_message_id and email_status set.
    """
    if not thread_member_ids:
        return []
    placeholders = ",".join("?" for _ in thread_member_ids)
    cursor.execute(
        f"SELECT id, title, note, status, due_datetime, start_datetime "
        f"FROM chits WHERE nest_thread_id IN ({placeholders}) "
        f"AND (deleted = 0 OR deleted IS NULL) "
        f"AND (email_message_id IS NULL) AND (email_status IS NULL)",
        list(thread_member_ids),
    )
    results = []
    for row in cursor.fetchall():
        results.append({
            "id": row[0],
            "title": row[1] or "",
            "note": (row[2] or "")[:100],
            "status": row[3] or "",
            "due_datetime": row[4] or "",
            "start_datetime": row[5] or "",
            "is_nest": True,
        })
    return results


# ── Strategies for Property 11 ───────────────────────────────────────────

# Number of thread member emails
num_thread_members_st = st.integers(min_value=1, max_value=5)

# Number of nested chits referencing thread members
num_nested_st = st.integers(min_value=0, max_value=5)

# Number of deleted nested chits (should be excluded)
num_deleted_nested_st = st.integers(min_value=0, max_value=3)

# Number of chits referencing IDs NOT in the thread (should be excluded)
num_outside_nested_st = st.integers(min_value=0, max_value=3)


# ── Helper for Property 11 ───────────────────────────────────────────────

def _insert_non_email_chit_full(cursor, owner_id, chit_id=None, nest_thread_id=None,
                                title="Nested chit", note=None, status=None,
                                due_datetime=None, start_datetime=None, deleted=0):
    """Insert a non-email chit with full control over fields. Returns its ID."""
    if chit_id is None:
        chit_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    cursor.execute(
        """INSERT INTO chits (id, owner_id, title, note, status, due_datetime,
           start_datetime, nest_thread_id, created_datetime, modified_datetime, deleted)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (chit_id, owner_id, title, note, status, due_datetime,
         start_datetime, nest_thread_id, now, now, deleted),
    )
    return chit_id


# ── Property 11: Thread Endpoint Includes Nests ───────────────────────────

class TestProperty11ThreadEndpointIncludesNests:
    """Feature: email-thread-nests, Property 11: Thread Endpoint Includes Nests

    For any email thread queried via GET /api/email/thread/{chit_id}, the response
    includes all non-deleted chits whose nest_thread_id references any chit in that
    thread, each with is_nest set to true. Email chits in the response do NOT have
    is_nest=true (they're thread members, not nests).

    **Validates: Requirements 7.3**
    """

    @given(
        owner_id=owner_id_st,
        num_thread_members=num_thread_members_st,
        num_nested=st.integers(min_value=1, max_value=5),
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_all_non_deleted_nests_included_with_is_nest_true(self, owner_id,
                                                              num_thread_members,
                                                              num_nested):
        """All non-deleted chits referencing thread members are included
        in the response with is_nest=True."""
        conn, db_path = _create_test_db()
        try:
            cursor = conn.cursor()

            # Create thread member email chits
            thread_member_ids = set()
            for _ in range(num_thread_members):
                eid = _insert_email_chit(cursor, owner_id)
                thread_member_ids.add(eid)

            # Create non-deleted nested chits referencing thread members
            nested_ids = set()
            member_list = list(thread_member_ids)
            for i in range(num_nested):
                # Distribute references across thread members
                ref_id = member_list[i % len(member_list)]
                nid = _insert_non_email_chit_full(
                    cursor, owner_id, nest_thread_id=ref_id,
                    title=f"Nested {i}", deleted=0,
                )
                nested_ids.add(nid)

            conn.commit()

            # Query nested chits for the thread
            results = get_nested_chits_for_thread(cursor, thread_member_ids)

            # All nested chits should be in results
            result_ids = {r["id"] for r in results}
            assert nested_ids == result_ids, (
                f"Expected nested IDs {nested_ids} but got {result_ids}"
            )

            # All results should have is_nest=True
            for r in results:
                assert r["is_nest"] is True
        finally:
            _cleanup_db(conn, db_path)

    @given(
        owner_id=owner_id_st,
        num_thread_members=num_thread_members_st,
        num_deleted=st.integers(min_value=1, max_value=5),
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_deleted_nests_excluded(self, owner_id, num_thread_members, num_deleted):
        """Deleted chits referencing thread members are NOT included in results."""
        conn, db_path = _create_test_db()
        try:
            cursor = conn.cursor()

            # Create thread member email chits
            thread_member_ids = set()
            for _ in range(num_thread_members):
                eid = _insert_email_chit(cursor, owner_id)
                thread_member_ids.add(eid)

            # Create deleted nested chits referencing thread members
            deleted_ids = set()
            member_list = list(thread_member_ids)
            for i in range(num_deleted):
                ref_id = member_list[i % len(member_list)]
                did = _insert_non_email_chit_full(
                    cursor, owner_id, nest_thread_id=ref_id,
                    title=f"Deleted nest {i}", deleted=1,
                )
                deleted_ids.add(did)

            conn.commit()

            # Query nested chits for the thread
            results = get_nested_chits_for_thread(cursor, thread_member_ids)

            # No deleted chits should appear in results
            result_ids = {r["id"] for r in results}
            assert result_ids.isdisjoint(deleted_ids), (
                f"Deleted IDs {deleted_ids & result_ids} should not be in results"
            )
        finally:
            _cleanup_db(conn, db_path)

    @given(
        owner_id=owner_id_st,
        num_thread_members=num_thread_members_st,
        num_outside=st.integers(min_value=1, max_value=5),
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_chits_referencing_outside_thread_excluded(self, owner_id,
                                                       num_thread_members,
                                                       num_outside):
        """Chits referencing IDs NOT in the thread are NOT included in results."""
        conn, db_path = _create_test_db()
        try:
            cursor = conn.cursor()

            # Create thread member email chits
            thread_member_ids = set()
            for _ in range(num_thread_members):
                eid = _insert_email_chit(cursor, owner_id)
                thread_member_ids.add(eid)

            # Create a separate email chit NOT in the thread
            outside_email_id = _insert_email_chit(cursor, owner_id)
            assert outside_email_id not in thread_member_ids

            # Create chits referencing the outside email (not in thread)
            outside_nested_ids = set()
            for i in range(num_outside):
                oid = _insert_non_email_chit_full(
                    cursor, owner_id, nest_thread_id=outside_email_id,
                    title=f"Outside nest {i}", deleted=0,
                )
                outside_nested_ids.add(oid)

            conn.commit()

            # Query nested chits for the thread (should not include outside nests)
            results = get_nested_chits_for_thread(cursor, thread_member_ids)

            result_ids = {r["id"] for r in results}
            assert result_ids.isdisjoint(outside_nested_ids), (
                f"Outside IDs {outside_nested_ids & result_ids} should not be in results"
            )
        finally:
            _cleanup_db(conn, db_path)

    @given(
        owner_id=owner_id_st,
        num_thread_members=num_thread_members_st,
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_email_chits_not_marked_as_nests(self, owner_id, num_thread_members):
        """Email chits (thread members) do NOT appear in the nested chits response.
        Only non-email chits with nest_thread_id referencing thread members are returned
        with is_nest=True. The thread members themselves are separate from the nests."""
        conn, db_path = _create_test_db()
        try:
            cursor = conn.cursor()

            # Create thread member email chits
            thread_member_ids = set()
            for _ in range(num_thread_members):
                eid = _insert_email_chit(cursor, owner_id)
                thread_member_ids.add(eid)

            conn.commit()

            # Query nested chits for the thread (no nests exist)
            results = get_nested_chits_for_thread(cursor, thread_member_ids)

            # No email chit IDs should appear in the nested results
            result_ids = {r["id"] for r in results}
            assert result_ids.isdisjoint(thread_member_ids), (
                f"Thread member IDs {thread_member_ids & result_ids} should not "
                f"appear in nested chit results"
            )

            # Results should be empty since no non-email chits reference the thread
            assert len(results) == 0
        finally:
            _cleanup_db(conn, db_path)

    @given(
        owner_id=owner_id_st,
        num_thread_members=num_thread_members_st,
        num_nested=st.integers(min_value=1, max_value=4),
        num_deleted=st.integers(min_value=1, max_value=3),
        num_outside=st.integers(min_value=1, max_value=3),
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_combined_scenario(self, owner_id, num_thread_members,
                               num_nested, num_deleted, num_outside):
        """Combined test: only non-deleted chits referencing thread members are
        included; deleted and outside-thread chits are excluded; all results
        have is_nest=True."""
        conn, db_path = _create_test_db()
        try:
            cursor = conn.cursor()

            # Create thread member email chits
            thread_member_ids = set()
            for _ in range(num_thread_members):
                eid = _insert_email_chit(cursor, owner_id)
                thread_member_ids.add(eid)

            member_list = list(thread_member_ids)

            # Create valid non-deleted nested chits
            valid_nested_ids = set()
            for i in range(num_nested):
                ref_id = member_list[i % len(member_list)]
                nid = _insert_non_email_chit_full(
                    cursor, owner_id, nest_thread_id=ref_id,
                    title=f"Valid nest {i}", deleted=0,
                )
                valid_nested_ids.add(nid)

            # Create deleted nested chits (should be excluded)
            deleted_ids = set()
            for i in range(num_deleted):
                ref_id = member_list[i % len(member_list)]
                did = _insert_non_email_chit_full(
                    cursor, owner_id, nest_thread_id=ref_id,
                    title=f"Deleted nest {i}", deleted=1,
                )
                deleted_ids.add(did)

            # Create outside-thread nested chits (should be excluded)
            outside_email_id = _insert_email_chit(cursor, owner_id)
            outside_ids = set()
            for i in range(num_outside):
                oid = _insert_non_email_chit_full(
                    cursor, owner_id, nest_thread_id=outside_email_id,
                    title=f"Outside nest {i}", deleted=0,
                )
                outside_ids.add(oid)

            conn.commit()

            # Query nested chits for the thread
            results = get_nested_chits_for_thread(cursor, thread_member_ids)
            result_ids = {r["id"] for r in results}

            # Only valid nested chits should be in results
            assert result_ids == valid_nested_ids, (
                f"Expected {valid_nested_ids} but got {result_ids}"
            )

            # No deleted chits in results
            assert result_ids.isdisjoint(deleted_ids)

            # No outside-thread chits in results
            assert result_ids.isdisjoint(outside_ids)

            # No thread member email chits in results
            assert result_ids.isdisjoint(thread_member_ids)

            # All results have is_nest=True
            for r in results:
                assert r["is_nest"] is True
        finally:
            _cleanup_db(conn, db_path)

    @given(owner_id=owner_id_st)
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_empty_thread_returns_no_nests(self, owner_id):
        """An empty set of thread member IDs returns no nested chits."""
        conn, db_path = _create_test_db()
        try:
            cursor = conn.cursor()

            # Create some chits with nest_thread_id set (but thread is empty)
            some_email_id = _insert_email_chit(cursor, owner_id)
            _insert_non_email_chit_full(
                cursor, owner_id, nest_thread_id=some_email_id,
                title="Orphan nest", deleted=0,
            )
            conn.commit()

            # Query with empty thread member set
            results = get_nested_chits_for_thread(cursor, set())
            assert results == []
        finally:
            _cleanup_db(conn, db_path)


# ── Property 6: Nested Chit Thread Membership ─────────────────────────────

class TestProperty6NestedChitThreadMembership:
    """Feature: email-thread-nests, Property 6: Nested Chit Thread Membership

    For any email thread (a set of email chits grouped by message IDs/references/subject),
    the expanded view includes exactly those non-email chits whose nest_thread_id matches
    the id of any email chit in that thread. No chit with a nest_thread_id referencing a
    chit outside the thread appears.

    **Validates: Requirements 5.1, 6.1**
    """

    @given(
        owner_id=owner_id_st,
        num_thread_members=st.integers(min_value=1, max_value=5),
        num_nested=st.integers(min_value=1, max_value=5),
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_all_non_email_chits_referencing_thread_members_included(self, owner_id,
                                                                      num_thread_members,
                                                                      num_nested):
        """All non-email chits whose nest_thread_id matches any chit in the thread
        are included in the expanded view."""
        conn, db_path = _create_test_db()
        try:
            cursor = conn.cursor()

            # Create thread member email chits
            thread_member_ids = set()
            for _ in range(num_thread_members):
                eid = _insert_email_chit(cursor, owner_id)
                thread_member_ids.add(eid)

            # Create non-email chits referencing various thread members
            expected_nested_ids = set()
            member_list = list(thread_member_ids)
            for i in range(num_nested):
                ref_id = member_list[i % len(member_list)]
                nid = _insert_non_email_chit_full(
                    cursor, owner_id, nest_thread_id=ref_id,
                    title=f"Nested chit {i}", deleted=0,
                )
                expected_nested_ids.add(nid)

            conn.commit()

            # Query the expanded view membership
            results = get_nested_chits_for_thread(cursor, thread_member_ids)
            result_ids = {r["id"] for r in results}

            # All expected nested chits must be present
            assert expected_nested_ids == result_ids, (
                f"Expected nested IDs {expected_nested_ids} but got {result_ids}"
            )
        finally:
            _cleanup_db(conn, db_path)

    @given(
        owner_id=owner_id_st,
        num_thread_members=st.integers(min_value=1, max_value=5),
        num_outside=st.integers(min_value=1, max_value=5),
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_chits_referencing_ids_outside_thread_excluded(self, owner_id,
                                                           num_thread_members,
                                                           num_outside):
        """Chits whose nest_thread_id references a chit NOT in the thread
        are excluded from the expanded view."""
        conn, db_path = _create_test_db()
        try:
            cursor = conn.cursor()

            # Create thread member email chits
            thread_member_ids = set()
            for _ in range(num_thread_members):
                eid = _insert_email_chit(cursor, owner_id)
                thread_member_ids.add(eid)

            # Create a separate email chit NOT in the thread
            outside_email_id = _insert_email_chit(cursor, owner_id)
            assert outside_email_id not in thread_member_ids

            # Create chits referencing the outside email
            outside_nested_ids = set()
            for i in range(num_outside):
                oid = _insert_non_email_chit_full(
                    cursor, owner_id, nest_thread_id=outside_email_id,
                    title=f"Outside chit {i}", deleted=0,
                )
                outside_nested_ids.add(oid)

            conn.commit()

            # Query the expanded view membership for our thread
            results = get_nested_chits_for_thread(cursor, thread_member_ids)
            result_ids = {r["id"] for r in results}

            # None of the outside-thread chits should appear
            assert result_ids.isdisjoint(outside_nested_ids), (
                f"Outside IDs {outside_nested_ids & result_ids} should not appear "
                f"in the expanded thread view"
            )
        finally:
            _cleanup_db(conn, db_path)

    @given(
        owner_id=owner_id_st,
        num_thread_members=st.integers(min_value=1, max_value=5),
        num_deleted=st.integers(min_value=1, max_value=5),
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_deleted_chits_excluded_from_expanded_view(self, owner_id,
                                                       num_thread_members,
                                                       num_deleted):
        """Deleted chits whose nest_thread_id references a thread member
        are excluded from the expanded view."""
        conn, db_path = _create_test_db()
        try:
            cursor = conn.cursor()

            # Create thread member email chits
            thread_member_ids = set()
            for _ in range(num_thread_members):
                eid = _insert_email_chit(cursor, owner_id)
                thread_member_ids.add(eid)

            # Create deleted non-email chits referencing thread members
            deleted_ids = set()
            member_list = list(thread_member_ids)
            for i in range(num_deleted):
                ref_id = member_list[i % len(member_list)]
                did = _insert_non_email_chit_full(
                    cursor, owner_id, nest_thread_id=ref_id,
                    title=f"Deleted nest {i}", deleted=1,
                )
                deleted_ids.add(did)

            conn.commit()

            # Query the expanded view membership
            results = get_nested_chits_for_thread(cursor, thread_member_ids)
            result_ids = {r["id"] for r in results}

            # No deleted chits should appear
            assert result_ids.isdisjoint(deleted_ids), (
                f"Deleted IDs {deleted_ids & result_ids} should not appear "
                f"in the expanded thread view"
            )
        finally:
            _cleanup_db(conn, db_path)

    @given(
        owner_id=owner_id_st,
        num_thread_members=st.integers(min_value=1, max_value=5),
        num_email_with_nest=st.integers(min_value=1, max_value=3),
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_email_chits_never_included_as_nests(self, owner_id,
                                                  num_thread_members,
                                                  num_email_with_nest):
        """Email chits are never included as nests in the expanded view, even if
        they somehow have a nest_thread_id set referencing a thread member.

        The get_nested_chits_for_thread query only returns chits that do NOT have
        email_message_id or email_status set (they are non-email chits by definition
        of the query filtering on the chits table without email fields)."""
        conn, db_path = _create_test_db()
        try:
            cursor = conn.cursor()

            # Create thread member email chits
            thread_member_ids = set()
            for _ in range(num_thread_members):
                eid = _insert_email_chit(cursor, owner_id)
                thread_member_ids.add(eid)

            member_list = list(thread_member_ids)

            # Create email chits that also have nest_thread_id set
            # (an edge case — email chits should never be nests)
            email_with_nest_ids = set()
            for i in range(num_email_with_nest):
                ref_id = member_list[i % len(member_list)]
                chit_id = str(uuid.uuid4())
                now = datetime.utcnow().isoformat()
                cursor.execute(
                    """INSERT INTO chits (id, owner_id, title, email_message_id,
                       email_status, nest_thread_id, created_datetime,
                       modified_datetime, deleted)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)""",
                    (chit_id, owner_id, f"Email with nest {i}",
                     f"<{chit_id}@test.example>", "received",
                     ref_id, now, now),
                )
                email_with_nest_ids.add(chit_id)

            conn.commit()

            # Query the expanded view membership
            results = get_nested_chits_for_thread(cursor, thread_member_ids)
            result_ids = {r["id"] for r in results}

            # Email chits should never appear as nests
            assert result_ids.isdisjoint(email_with_nest_ids), (
                f"Email chit IDs {email_with_nest_ids & result_ids} should never "
                f"appear as nests in the expanded thread view"
            )
        finally:
            _cleanup_db(conn, db_path)

    @given(
        owner_id=owner_id_st,
        num_thread_members=st.integers(min_value=1, max_value=4),
        num_valid_nested=st.integers(min_value=1, max_value=4),
        num_deleted=st.integers(min_value=0, max_value=3),
        num_outside=st.integers(min_value=0, max_value=3),
        num_email_with_nest=st.integers(min_value=0, max_value=2),
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_combined_membership_correctness(self, owner_id, num_thread_members,
                                             num_valid_nested, num_deleted,
                                             num_outside, num_email_with_nest):
        """Combined test: the expanded view includes EXACTLY the non-email,
        non-deleted chits whose nest_thread_id references a thread member.
        Deleted chits, outside-thread chits, and email chits with nest_thread_id
        are all excluded."""
        conn, db_path = _create_test_db()
        try:
            cursor = conn.cursor()

            # Create thread member email chits
            thread_member_ids = set()
            for _ in range(num_thread_members):
                eid = _insert_email_chit(cursor, owner_id)
                thread_member_ids.add(eid)

            member_list = list(thread_member_ids)

            # Valid non-email, non-deleted chits referencing thread members (SHOULD be included)
            valid_nested_ids = set()
            for i in range(num_valid_nested):
                ref_id = member_list[i % len(member_list)]
                nid = _insert_non_email_chit_full(
                    cursor, owner_id, nest_thread_id=ref_id,
                    title=f"Valid nest {i}", deleted=0,
                )
                valid_nested_ids.add(nid)

            # Deleted chits referencing thread members (should be EXCLUDED)
            deleted_ids = set()
            for i in range(num_deleted):
                ref_id = member_list[i % len(member_list)]
                did = _insert_non_email_chit_full(
                    cursor, owner_id, nest_thread_id=ref_id,
                    title=f"Deleted nest {i}", deleted=1,
                )
                deleted_ids.add(did)

            # Chits referencing outside-thread emails (should be EXCLUDED)
            outside_ids = set()
            if num_outside > 0:
                outside_email_id = _insert_email_chit(cursor, owner_id)
                for i in range(num_outside):
                    oid = _insert_non_email_chit_full(
                        cursor, owner_id, nest_thread_id=outside_email_id,
                        title=f"Outside nest {i}", deleted=0,
                    )
                    outside_ids.add(oid)

            # Email chits with nest_thread_id set (should be EXCLUDED)
            email_nest_ids = set()
            for i in range(num_email_with_nest):
                ref_id = member_list[i % len(member_list)]
                chit_id = str(uuid.uuid4())
                now = datetime.utcnow().isoformat()
                cursor.execute(
                    """INSERT INTO chits (id, owner_id, title, email_message_id,
                       email_status, nest_thread_id, created_datetime,
                       modified_datetime, deleted)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)""",
                    (chit_id, owner_id, f"Email nest {i}",
                     f"<{chit_id}@test.example>", "received",
                     ref_id, now, now),
                )
                email_nest_ids.add(chit_id)

            conn.commit()

            # Query the expanded view membership
            results = get_nested_chits_for_thread(cursor, thread_member_ids)
            result_ids = {r["id"] for r in results}

            # Only valid nested chits should be present
            assert result_ids == valid_nested_ids, (
                f"Expected exactly {valid_nested_ids} but got {result_ids}. "
                f"Deleted: {deleted_ids & result_ids}, "
                f"Outside: {outside_ids & result_ids}, "
                f"Email nests: {email_nest_ids & result_ids}"
            )

            # Verify exclusions explicitly
            assert result_ids.isdisjoint(deleted_ids)
            assert result_ids.isdisjoint(outside_ids)
            assert result_ids.isdisjoint(email_nest_ids)
            assert result_ids.isdisjoint(thread_member_ids)

            # All results have is_nest=True
            for r in results:
                assert r["is_nest"] is True
        finally:
            _cleanup_db(conn, db_path)

# ── Nested Chit Sort Order Logic (inlined from main-email.js _emailInjectNests) ──

def sort_nested_chits(chits):
    """Sort nested chits within a thread by:
    - Group 0: chits with due_datetime (or due_date) → sort ascending by due value
    - Group 1: chits with only start_datetime (no due_date) → sort ascending by start_datetime
    - Group 2: chits with neither date → placed after top email (stable order)
    Groups are ordered: 0 < 1 < 2.
    """
    def sort_key(c):
        due = c.get("due_datetime") or c.get("due_date") or ""
        start = c.get("start_datetime") or ""
        group = 0 if due else (1 if start else 2)
        date_val = due if group == 0 else (start if group == 1 else "")
        return (group, date_val)
    return sorted(chits, key=sort_key)


# ── Strategies for Property 7 ────────────────────────────────────────────

# ISO datetime strings for due_datetime and start_datetime
_iso_datetime_st = st.datetimes(
    min_value=datetime(2020, 1, 1),
    max_value=datetime(2030, 12, 31),
).map(lambda dt: dt.isoformat())

# A chit with a due_datetime (group 0)
_chit_with_due_st = st.fixed_dictionaries({
    "id": st.uuids().map(str),
    "title": st.text(min_size=1, max_size=30),
    "due_datetime": _iso_datetime_st,
    "start_datetime": st.one_of(st.just(""), _iso_datetime_st),
})

# A chit with only start_datetime, no due_datetime (group 1)
_chit_with_start_only_st = st.fixed_dictionaries({
    "id": st.uuids().map(str),
    "title": st.text(min_size=1, max_size=30),
    "due_datetime": st.just(""),
    "due_date": st.just(""),
    "start_datetime": _iso_datetime_st,
})

# A chit with neither date (group 2)
_chit_no_dates_st = st.fixed_dictionaries({
    "id": st.uuids().map(str),
    "title": st.text(min_size=1, max_size=30),
    "due_datetime": st.just(""),
    "due_date": st.just(""),
    "start_datetime": st.just(""),
})

# Mixed list of chits from all three groups
_mixed_chit_list_st = st.lists(
    st.one_of(_chit_with_due_st, _chit_with_start_only_st, _chit_no_dates_st),
    min_size=0,
    max_size=15,
)


# ── Property 7: Nested Chit Sort Order ───────────────────────────────────

class TestProperty7NestedChitSortOrder:
    """Feature: email-thread-nests, Property 7: Nested Chit Sort Order

    For any set of nested chits within a thread, they are sorted such that:
    chits with a due_date sort by due_date ascending, then chits with only
    start_datetime sort by start_datetime ascending, then chits with neither
    date appear after the thread's top-level email. Within each group, the
    relative order is stable.

    **Validates: Requirements 5.2**
    """

    @given(chits=_mixed_chit_list_st)
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_due_date_chits_come_before_start_only_chits(self, chits):
        """Chits with due_datetime (group 0) always appear before chits with
        only start_datetime (group 1) in the sorted output."""
        sorted_chits = sort_nested_chits(chits)

        last_group0_idx = -1
        first_group1_idx = len(sorted_chits)

        for i, c in enumerate(sorted_chits):
            due = c.get("due_datetime") or c.get("due_date") or ""
            start = c.get("start_datetime") or ""
            if due:
                last_group0_idx = i
            elif start and not due:
                first_group1_idx = min(first_group1_idx, i)

        if last_group0_idx >= 0 and first_group1_idx < len(sorted_chits):
            assert last_group0_idx < first_group1_idx, (
                f"Last group-0 (due_date) chit at index {last_group0_idx} should be "
                f"before first group-1 (start_only) chit at index {first_group1_idx}"
            )

    @given(chits=_mixed_chit_list_st)
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_start_only_chits_come_before_no_date_chits(self, chits):
        """Chits with only start_datetime (group 1) always appear before chits
        with no dates (group 2) in the sorted output."""
        sorted_chits = sort_nested_chits(chits)

        last_group1_idx = -1
        first_group2_idx = len(sorted_chits)

        for i, c in enumerate(sorted_chits):
            due = c.get("due_datetime") or c.get("due_date") or ""
            start = c.get("start_datetime") or ""
            group = 0 if due else (1 if start else 2)
            if group == 1:
                last_group1_idx = i
            elif group == 2:
                first_group2_idx = min(first_group2_idx, i)

        if last_group1_idx >= 0 and first_group2_idx < len(sorted_chits):
            assert last_group1_idx < first_group2_idx, (
                f"Last group-1 (start_only) chit at index {last_group1_idx} should be "
                f"before first group-2 (no dates) chit at index {first_group2_idx}"
            )

    @given(chits=st.lists(_chit_with_due_st, min_size=2, max_size=10))
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_within_due_date_group_sorted_ascending(self, chits):
        """Within the due_date group (group 0), chits are sorted by due_datetime
        ascending."""
        sorted_chits = sort_nested_chits(chits)

        due_values = []
        for c in sorted_chits:
            due = c.get("due_datetime") or c.get("due_date") or ""
            if due:
                due_values.append(due)

        # Verify ascending order
        for i in range(len(due_values) - 1):
            assert due_values[i] <= due_values[i + 1], (
                f"Due dates not in ascending order: '{due_values[i]}' > '{due_values[i+1]}' "
                f"at positions {i} and {i+1}"
            )

    @given(chits=st.lists(_chit_with_start_only_st, min_size=2, max_size=10))
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_within_start_datetime_group_sorted_ascending(self, chits):
        """Within the start_datetime group (group 1), chits are sorted by
        start_datetime ascending."""
        sorted_chits = sort_nested_chits(chits)

        start_values = []
        for c in sorted_chits:
            due = c.get("due_datetime") or c.get("due_date") or ""
            start = c.get("start_datetime") or ""
            if start and not due:
                start_values.append(start)

        # Verify ascending order
        for i in range(len(start_values) - 1):
            assert start_values[i] <= start_values[i + 1], (
                f"Start datetimes not in ascending order: '{start_values[i]}' > "
                f"'{start_values[i+1]}' at positions {i} and {i+1}"
            )

    @given(chits=_mixed_chit_list_st)
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_sort_is_stable_within_groups(self, chits):
        """Within each group, the relative order of chits with equal sort keys
        is preserved (stable sort)."""
        sorted_chits = sort_nested_chits(chits)

        # Extract chits by group and verify stability
        # Python's sorted() is stable, so items with equal keys maintain
        # their original relative order. We verify by checking that for any
        # two chits in the same group with the same date value, their relative
        # order in the output matches their relative order in the input.
        def get_group_and_key(c):
            due = c.get("due_datetime") or c.get("due_date") or ""
            start = c.get("start_datetime") or ""
            group = 0 if due else (1 if start else 2)
            date_val = due if group == 0 else (start if group == 1 else "")
            return (group, date_val)

        # Build a map from (group, date_val) to the list of chit IDs in input order
        from collections import defaultdict
        input_order = defaultdict(list)
        for c in chits:
            key = get_group_and_key(c)
            input_order[key].append(c["id"])

        # Build a map from (group, date_val) to the list of chit IDs in output order
        output_order = defaultdict(list)
        for c in sorted_chits:
            key = get_group_and_key(c)
            output_order[key].append(c["id"])

        # For each key, the output order should match the input order (stability)
        for key in input_order:
            assert input_order[key] == output_order[key], (
                f"Sort not stable for key {key}: "
                f"input order {input_order[key]} != output order {output_order[key]}"
            )

    @given(chits=_mixed_chit_list_st)
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_overall_group_ordering(self, chits):
        """The overall sort respects group ordering: all group-0 chits come first,
        then all group-1 chits, then all group-2 chits."""
        sorted_chits = sort_nested_chits(chits)

        groups_seen = []
        for c in sorted_chits:
            due = c.get("due_datetime") or c.get("due_date") or ""
            start = c.get("start_datetime") or ""
            group = 0 if due else (1 if start else 2)
            groups_seen.append(group)

        # Groups should be non-decreasing
        for i in range(len(groups_seen) - 1):
            assert groups_seen[i] <= groups_seen[i + 1], (
                f"Group ordering violated: group {groups_seen[i]} at index {i} "
                f"followed by group {groups_seen[i+1]} at index {i+1}. "
                f"Full group sequence: {groups_seen}"
            )


# ── Top Card Selection Logic (inlined from main-email.js) ─────────────────

def select_top_card(messages):
    """Given a thread's messages list (emails + injected nests), return the top card.

    The top card is always the first email chit (never a nest). An email chit
    is one that does NOT have _isNest=True.
    """
    for msg in messages:
        if not msg.get("_isNest"):
            return msg
    return messages[0] if messages else None


# ── Strategies for Property 8 ────────────────────────────────────────────

# An email message dict (not a nest)
_email_message_st = st.fixed_dictionaries({
    "id": st.uuids().map(str),
    "email_message_id": st.text(min_size=1, max_size=30, alphabet=st.characters(
        whitelist_categories=("L", "N", "P"),
        blacklist_characters=("\x00",)
    )),
    "email_subject": st.text(min_size=1, max_size=50),
    "email_date": st.just("2026-06-15T10:30:00Z"),
    "_isNest": st.just(False),
})

# A nested chit message dict (is a nest)
_nest_message_st = st.fixed_dictionaries({
    "id": st.uuids().map(str),
    "title": st.text(min_size=1, max_size=50),
    "due_datetime": st.one_of(st.none(), st.just("2026-01-01T00:00:00Z")),
    "start_datetime": st.one_of(st.none(), st.just("2025-12-01T00:00:00Z")),
    "_isNest": st.just(True),
})

# A mixed list of messages containing at least one email
_mixed_messages_with_email_st = st.tuples(
    st.lists(_email_message_st, min_size=1, max_size=5),
    st.lists(_nest_message_st, min_size=0, max_size=5),
).map(lambda t: t[0] + t[1]).flatmap(lambda msgs: st.permutations(msgs))

# A list containing only nest messages (no emails)
_only_nests_st = st.lists(_nest_message_st, min_size=1, max_size=5)


# ── Property 8: Top Card Invariant ───────────────────────────────────────

class TestProperty8TopCardInvariant:
    """Feature: email-thread-nests, Property 8: Top Card Invariant

    For any email thread containing one or more nested chits, the topmost
    visible card of the collapsed thread is always an email chit (a chit with
    non-null email_message_id or email_status). A nested chit is never selected
    as the top card regardless of its dates or other properties.

    **Validates: Requirements 5.3**
    """

    @given(messages=_mixed_messages_with_email_st)
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_top_card_is_never_a_nest(self, messages):
        """The selected top card never has _isNest=True, regardless of
        message ordering."""
        top = select_top_card(messages)
        assert top is not None
        assert top.get("_isNest") is not True, (
            f"Top card should never be a nest, but got a nest with id={top.get('id')}"
        )

    @given(messages=_mixed_messages_with_email_st)
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_top_card_is_always_an_email_chit(self, messages):
        """The selected top card is always an email chit (has email_message_id
        or _isNest is False/absent)."""
        top = select_top_card(messages)
        assert top is not None
        # An email chit either has email_message_id set or _isNest is not True
        is_email = not top.get("_isNest")
        assert is_email, (
            f"Top card must be an email chit but got: {top}"
        )

    @given(
        emails=st.lists(_email_message_st, min_size=1, max_size=3),
        nests_with_early_dates=st.lists(
            st.fixed_dictionaries({
                "id": st.uuids().map(str),
                "title": st.text(min_size=1, max_size=50),
                "due_datetime": st.just("2020-01-01T00:00:00Z"),
                "start_datetime": st.just("2019-01-01T00:00:00Z"),
                "_isNest": st.just(True),
            }),
            min_size=1,
            max_size=5,
        ),
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_nests_with_earlier_dates_never_become_top_card(self, emails, nests_with_early_dates):
        """Even when nested chits have earlier dates than all emails, the top
        card is still an email chit."""
        # Place nests before emails to simulate worst-case ordering
        messages = nests_with_early_dates + emails
        top = select_top_card(messages)
        assert top is not None
        assert top.get("_isNest") is not True, (
            f"Nest with early dates should not be top card, but got: {top}"
        )
        # Verify the selected top card is one of the email chits
        email_ids = {e["id"] for e in emails}
        assert top["id"] in email_ids, (
            f"Top card id={top['id']} is not among email chit ids={email_ids}"
        )

    @given(
        num_emails=st.integers(min_value=1, max_value=5),
        num_nests=st.integers(min_value=1, max_value=5),
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_various_mixes_of_emails_and_nests(self, num_emails, num_nests):
        """For any mix of email and nest counts, the top card invariant holds."""
        # Build messages
        emails = [
            {"id": str(uuid.uuid4()), "email_message_id": f"<msg{i}@test>",
             "email_subject": f"Subject {i}", "email_date": "2026-06-15T10:30:00Z",
             "_isNest": False}
            for i in range(num_emails)
        ]
        nests = [
            {"id": str(uuid.uuid4()), "title": f"Nest {i}",
             "due_datetime": "2020-01-01T00:00:00Z",
             "start_datetime": "2019-06-01T00:00:00Z",
             "_isNest": True}
            for i in range(num_nests)
        ]

        # Interleave in various orders
        messages = nests + emails  # nests first (worst case)
        top = select_top_card(messages)
        assert top is not None
        assert top.get("_isNest") is not True

        messages = emails + nests  # emails first
        top = select_top_card(messages)
        assert top is not None
        assert top.get("_isNest") is not True

        # Alternating
        messages = []
        for i in range(max(num_emails, num_nests)):
            if i < num_nests:
                messages.append(nests[i])
            if i < num_emails:
                messages.append(emails[i])
        top = select_top_card(messages)
        assert top is not None
        assert top.get("_isNest") is not True

    @given(messages=_only_nests_st)
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_fallback_when_no_emails_present(self, messages):
        """Edge case: if somehow only nests exist (no emails), the function
        still returns the first message as a fallback rather than None."""
        top = select_top_card(messages)
        # When no emails exist, the function falls back to messages[0]
        # This is a defensive fallback — in practice, a thread always has
        # at least one email. The invariant is that select_top_card never
        # returns None for a non-empty list.
        assert top is not None
        assert top == messages[0]


# ── Inbox Filtering Logic (inlined from main-email.js) ────────────────────

def filter_inbox_visible(all_chits):
    """Filter chits to only those visible in the email inbox list.
    Only email chits (with email_message_id or email_status) appear.
    Chits with nest_thread_id are non-email chits and are excluded."""
    return [c for c in all_chits if (c.get("email_message_id") or c.get("email_status")) and not c.get("deleted")]


# ── Strategies for Property 9 ────────────────────────────────────────────

# An email chit visible in the inbox (has email_message_id or email_status, no nest_thread_id)
_inbox_email_chit_st = st.fixed_dictionaries({
    "id": st.uuids().map(str),
    "title": st.text(min_size=1, max_size=50),
    "email_message_id": st.text(min_size=1, max_size=50, alphabet=st.characters(
        whitelist_categories=("L", "N", "P"),
        blacklist_characters=("\x00",)
    )),
    "email_status": st.one_of(st.none(), st.just("received"), st.just("sent")),
    "nest_thread_id": st.just(None),
    "deleted": st.just(False),
})

# A non-email chit with nest_thread_id set (nested into a thread — should NOT appear in inbox)
_nested_non_email_chit_st = st.fixed_dictionaries({
    "id": st.uuids().map(str),
    "title": st.text(min_size=1, max_size=50),
    "email_message_id": st.just(None),
    "email_status": st.just(None),
    "nest_thread_id": st.text(min_size=1, max_size=36, alphabet=st.characters(
        whitelist_categories=("L", "N"),
        blacklist_characters=("\x00",)
    )),
    "deleted": st.just(False),
})

# A non-email chit without nest_thread_id (plain non-email chit — should NOT appear in inbox)
_plain_non_email_chit_st = st.fixed_dictionaries({
    "id": st.uuids().map(str),
    "title": st.text(min_size=1, max_size=50),
    "email_message_id": st.just(None),
    "email_status": st.just(None),
    "nest_thread_id": st.just(None),
    "deleted": st.just(False),
})

# A deleted email chit (should NOT appear in inbox due to deleted flag)
_deleted_email_chit_st = st.fixed_dictionaries({
    "id": st.uuids().map(str),
    "title": st.text(min_size=1, max_size=50),
    "email_message_id": st.text(min_size=1, max_size=50, alphabet=st.characters(
        whitelist_categories=("L", "N", "P"),
        blacklist_characters=("\x00",)
    )),
    "email_status": st.one_of(st.none(), st.just("received")),
    "nest_thread_id": st.just(None),
    "deleted": st.just(True),
})

# Mixed list of all chit types for comprehensive testing
_mixed_inbox_chits_st = st.lists(
    st.one_of(
        _inbox_email_chit_st,
        _nested_non_email_chit_st,
        _plain_non_email_chit_st,
        _deleted_email_chit_st,
    ),
    min_size=0,
    max_size=20,
)


# ── Property 9: Inbox Exclusion Invariant ─────────────────────────────────

class TestProperty9InboxExclusionInvariant:
    """Feature: email-thread-nests, Property 9: Inbox Exclusion Invariant

    For any set of chits displayed in the email inbox list (the non-expanded view),
    no chit with a non-null nest_thread_id appears as an independent entry.
    Nested chits only appear within their associated thread's expanded view.

    **Validates: Requirements 5.4**
    """

    @given(all_chits=_mixed_inbox_chits_st)
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_no_chit_with_nest_thread_id_appears_in_inbox(self, all_chits):
        """No chit with a non-null nest_thread_id appears in the inbox list,
        regardless of its other properties."""
        visible = filter_inbox_visible(all_chits)
        for chit in visible:
            assert not chit.get("nest_thread_id"), (
                f"Chit with nest_thread_id='{chit.get('nest_thread_id')}' "
                f"(id={chit['id']}) should not appear in the inbox list"
            )

    @given(all_chits=_mixed_inbox_chits_st)
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_email_chits_without_nest_thread_id_do_appear(self, all_chits):
        """Email chits (with email_message_id or email_status) that do NOT have
        nest_thread_id set and are not deleted DO appear in the inbox list."""
        visible = filter_inbox_visible(all_chits)
        visible_ids = {c["id"] for c in visible}

        for chit in all_chits:
            is_email = bool(chit.get("email_message_id") or chit.get("email_status"))
            has_nest = bool(chit.get("nest_thread_id"))
            is_deleted = bool(chit.get("deleted"))
            if is_email and not has_nest and not is_deleted:
                assert chit["id"] in visible_ids, (
                    f"Email chit (id={chit['id']}) without nest_thread_id "
                    f"should appear in the inbox but was excluded"
                )

    @given(all_chits=_mixed_inbox_chits_st)
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_non_email_chits_never_appear_in_inbox(self, all_chits):
        """Non-email chits (no email_message_id and no email_status) never appear
        in the inbox list, regardless of whether they have nest_thread_id set."""
        visible = filter_inbox_visible(all_chits)
        for chit in visible:
            is_email = bool(chit.get("email_message_id") or chit.get("email_status"))
            assert is_email, (
                f"Non-email chit (id={chit['id']}) should never appear in the "
                f"inbox list, but it was included. "
                f"email_message_id={chit.get('email_message_id')}, "
                f"email_status={chit.get('email_status')}"
            )

    @given(
        email_chits=st.lists(_inbox_email_chit_st, min_size=1, max_size=5),
        nested_chits=st.lists(_nested_non_email_chit_st, min_size=1, max_size=5),
        plain_chits=st.lists(_plain_non_email_chit_st, min_size=0, max_size=5),
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_inbox_contains_exactly_non_deleted_email_chits(self, email_chits,
                                                             nested_chits,
                                                             plain_chits):
        """The inbox list contains exactly the non-deleted email chits (those with
        email_message_id or email_status). Nested chits and plain non-email chits
        are always excluded."""
        all_chits = email_chits + nested_chits + plain_chits
        visible = filter_inbox_visible(all_chits)
        visible_ids = {c["id"] for c in visible}

        # All non-deleted email chits should be present
        expected_ids = {c["id"] for c in email_chits if not c.get("deleted")}
        assert visible_ids == expected_ids, (
            f"Expected inbox to contain exactly {expected_ids} "
            f"but got {visible_ids}. "
            f"Missing: {expected_ids - visible_ids}, "
            f"Extra: {visible_ids - expected_ids}"
        )

    @given(
        num_nested=st.integers(min_value=1, max_value=10),
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_all_nested_chits_excluded_even_in_large_sets(self, num_nested):
        """Even with many nested chits, none appear in the inbox."""
        nested_chits = [
            {
                "id": str(uuid.uuid4()),
                "title": f"Nested chit {i}",
                "email_message_id": None,
                "email_status": None,
                "nest_thread_id": str(uuid.uuid4()),
                "deleted": False,
            }
            for i in range(num_nested)
        ]
        visible = filter_inbox_visible(nested_chits)
        assert visible == [], (
            f"Expected empty inbox for {num_nested} nested chits, "
            f"but got {len(visible)} visible entries"
        )

    @given(all_chits=_mixed_inbox_chits_st)
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_deleted_chits_never_appear_in_inbox(self, all_chits):
        """Deleted chits never appear in the inbox, even if they are email chits."""
        visible = filter_inbox_visible(all_chits)
        for chit in visible:
            assert not chit.get("deleted"), (
                f"Deleted chit (id={chit['id']}) should not appear in the inbox"
            )
