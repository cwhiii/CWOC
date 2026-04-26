"""Property-based test for search results relevance (Property 5).

**Validates: Requirements 3.2**

Uses Hypothesis to generate contacts and a query substring, GET with ?q=,
and verify every returned contact has at least one field containing the query
as a case-insensitive substring.
"""
import sys
import os
import tempfile
import sqlite3

# Allow importing from the backend directory
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from hypothesis import given, settings, assume
from hypothesis.strategies import (
    booleans,
    composite,
    lists,
    none,
    one_of,
    text,
)

import main as backend_main
from main import app

from fastapi.testclient import TestClient


# ── Strategies ───────────────────────────────────────────────────────────────

_SAFE_VALUE_CHARS = text(
    alphabet="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .-_+@#/&()'",
    min_size=1,
    max_size=40,
)

_SAFE_LABEL_CHARS = text(
    alphabet="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_",
    min_size=1,
    max_size=15,
)

_NAME_PART = one_of(none(), _SAFE_VALUE_CHARS)


@composite
def multi_value_entry(draw):
    """Generate a single MultiValueEntry dict with optional label and a value."""
    label = draw(one_of(none(), _SAFE_LABEL_CHARS))
    value = draw(_SAFE_VALUE_CHARS)
    return {"label": label, "value": value}


@composite
def multi_value_list(draw):
    """Generate either None or a non-empty list of MultiValueEntry dicts."""
    return draw(one_of(none(), lists(multi_value_entry(), min_size=1, max_size=3)))


@composite
def contact_strategy(draw):
    """Generate an arbitrary Contact dict with multi-value fields for search testing."""
    given_name = draw(_SAFE_VALUE_CHARS)
    contact = {
        "given_name": given_name,
        "surname": draw(_NAME_PART),
        "middle_names": draw(_NAME_PART),
        "prefix": draw(_NAME_PART),
        "suffix": draw(_NAME_PART),
        "phones": draw(multi_value_list()),
        "emails": draw(multi_value_list()),
        "addresses": draw(multi_value_list()),
        "call_signs": draw(multi_value_list()),
        "x_handles": draw(multi_value_list()),
        "websites": draw(multi_value_list()),
        "has_signal": draw(booleans()),
        "favorite": draw(booleans()),
    }
    return contact


# Query: a short non-empty alphanumeric string (avoids SQL LIKE special chars)
_QUERY_CHARS = text(
    alphabet="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
    min_size=1,
    max_size=10,
)


# ── Test setup helpers ───────────────────────────────────────────────────────

def _setup_test_db(tmp_dir):
    """Create a fresh SQLite database and contacts directory for testing."""
    db_path = os.path.join(tmp_dir, "test.db")
    contacts_dir = os.path.join(tmp_dir, "contacts")
    os.makedirs(contacts_dir, exist_ok=True)

    backend_main.DB_PATH = db_path
    backend_main.CONTACTS_DIR = contacts_dir

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS contacts (
        id TEXT PRIMARY KEY,
        given_name TEXT NOT NULL,
        surname TEXT,
        middle_names TEXT,
        prefix TEXT,
        suffix TEXT,
        display_name TEXT,
        phones TEXT,
        emails TEXT,
        addresses TEXT,
        call_signs TEXT,
        x_handles TEXT,
        websites TEXT,
        has_signal BOOLEAN DEFAULT 0,
        pgp_key TEXT,
        favorite BOOLEAN DEFAULT 0,
        created_datetime TEXT,
        modified_datetime TEXT
    )
    """)
    conn.commit()
    conn.close()

    return db_path, contacts_dir


def _contact_matches_query(contact, query):
    """Check if a contact has at least one searchable field containing the query
    as a case-insensitive substring.

    The API searches across: display_name, emails (JSON), phones (JSON),
    and call_signs (JSON).
    """
    q_lower = query.lower()

    # Check display_name
    display_name = contact.get("display_name") or ""
    if q_lower in display_name.lower():
        return True

    # Check multi-value JSON fields that the API searches
    for field in ("emails", "phones", "call_signs"):
        entries = contact.get(field)
        if entries:
            for entry in entries:
                if isinstance(entry, dict):
                    val = entry.get("value") or ""
                    lbl = entry.get("label") or ""
                else:
                    val = str(entry)
                    lbl = ""
                if q_lower in val.lower() or q_lower in lbl.lower():
                    return True

    return False


# ── Property Test ────────────────────────────────────────────────────────────

@given(
    contacts=lists(contact_strategy(), min_size=1, max_size=8),
    query=_QUERY_CHARS,
)
@settings(max_examples=100, deadline=None)
def test_search_results_relevance(contacts, query):
    """Property 5: Search results relevance.

    For any set of contacts and any non-empty search query string q, every
    contact returned by GET /api/contacts?q={q} SHALL have at least one field
    (display_name, email value, phone value, or call_sign value) that contains
    q as a case-insensitive substring.

    **Validates: Requirements 3.2**
    """
    with tempfile.TemporaryDirectory() as tmp_dir:
        original_db_path = backend_main.DB_PATH
        original_contacts_dir = backend_main.CONTACTS_DIR
        try:
            _setup_test_db(tmp_dir)
            client = TestClient(app)

            # Insert all contacts
            for c in contacts:
                resp = client.post("/api/contacts", json=c)
                assert resp.status_code == 200, (
                    f"POST /api/contacts failed with {resp.status_code}: {resp.text}"
                )

            # Search with query
            resp = client.get(f"/api/contacts?q={query}")
            assert resp.status_code == 200, (
                f"GET /api/contacts?q={query} failed with {resp.status_code}: {resp.text}"
            )
            results = resp.json()

            # Every returned contact must match the query in at least one
            # searchable field
            for contact in results:
                assert _contact_matches_query(contact, query), (
                    f"Contact returned by search does not match query '{query}'!\n"
                    f"Contact: display_name={contact.get('display_name')}, "
                    f"emails={contact.get('emails')}, "
                    f"phones={contact.get('phones')}, "
                    f"call_signs={contact.get('call_signs')}"
                )
        finally:
            backend_main.DB_PATH = original_db_path
            backend_main.CONTACTS_DIR = original_contacts_dir
