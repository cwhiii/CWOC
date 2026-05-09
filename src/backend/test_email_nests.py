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
    """Return first 15 characters of subject if length > 15, or full string otherwise.

    Result never exceeds 15 characters.
    """
    if len(subject) > 15:
        return subject[:15]
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


# ── Property 3: Subject Label Truncation ──────────────────────────────────

class TestProperty3SubjectLabelTruncation:
    """Feature: email-thread-nests, Property 3: Subject Label Truncation

    For any string, the displayed text is the first 15 characters if
    length > 15, or the full string otherwise; result never exceeds 15 characters.

    **Validates: Requirements 2.5, 2.6**
    """

    @given(subject=subject_st)
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_truncation_never_exceeds_15_chars(self, subject):
        """Result never exceeds 15 characters regardless of input."""
        result = nest_truncate_subject(subject)
        assert len(result) <= 15

    @given(subject=subject_st)
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_short_subjects_returned_unchanged(self, subject):
        """Subjects of 15 chars or fewer are returned in full."""
        assume(len(subject) <= 15)
        result = nest_truncate_subject(subject)
        assert result == subject

    @given(subject=subject_st)
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_long_subjects_truncated_to_first_15(self, subject):
        """Subjects longer than 15 chars return exactly the first 15 characters."""
        assume(len(subject) > 15)
        result = nest_truncate_subject(subject)
        assert result == subject[:15]
        assert len(result) == 15

    @given(subject=subject_st)
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_result_is_prefix_of_original(self, subject):
        """The result is always a prefix of the original string."""
        result = nest_truncate_subject(subject)
        assert subject.startswith(result)
