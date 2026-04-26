"""Property-based test for Contact API round-trip (Property 1).

**Validates: Requirements 1.1, 1.4, 1.5, 1.6, 1.8, 1.9**

Uses Hypothesis to generate valid Contact objects with varied name parts,
multi-value fields with labels, boolean flags, and PGP key text, then
POSTs each contact via the API and GETs it back by id, comparing all
fields (excluding server-assigned id, created_datetime, modified_datetime,
and display_name).
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
    just,
    lists,
    none,
    one_of,
    text,
)

import main as backend_main
from main import app, init_contacts_table

from fastapi.testclient import TestClient


# ── Strategies (reused from test_vcard_roundtrip.py) ─────────────────────────

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
def pgp_key_strategy(draw):
    """Generate either None or a non-empty PGP key string."""
    return draw(one_of(none(), _SAFE_VALUE_CHARS))


@composite
def contact_strategy(draw):
    """Generate an arbitrary Contact dict suitable for API round-trip testing."""
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
        "pgp_key": draw(pgp_key_strategy()),
        "favorite": draw(booleans()),
    }
    return contact


# ── Fields to compare (excluding server-assigned ones) ───────────────────────

EXCLUDED_FIELDS = {"id", "created_datetime", "modified_datetime", "display_name"}

COMPARED_FIELDS = [
    "given_name",
    "surname",
    "middle_names",
    "prefix",
    "suffix",
    "phones",
    "emails",
    "addresses",
    "call_signs",
    "x_handles",
    "websites",
    "has_signal",
    "pgp_key",
    "favorite",
]


def _normalize_multi_value(entries):
    """Normalize a multi-value field for comparison.

    The API may return None or an empty list interchangeably, and entries
    may come back as dicts with label/value keys.  Normalize to a sorted
    list of (label, value) tuples, or None if empty.
    """
    if not entries:
        return None
    result = []
    for e in entries:
        label = e.get("label") if isinstance(e, dict) else getattr(e, "label", None)
        value = e.get("value") if isinstance(e, dict) else getattr(e, "value", None)
        result.append((label, value))
    return sorted(result, key=lambda x: (x[0] or "", x[1] or ""))


def _normalize_contact(contact_dict):
    """Return a dict of comparable fields with normalized multi-value entries."""
    normalized = {}
    for field in COMPARED_FIELDS:
        val = contact_dict.get(field)
        if field in ("phones", "emails", "addresses", "call_signs", "x_handles", "websites"):
            normalized[field] = _normalize_multi_value(val)
        else:
            normalized[field] = val
    return normalized


# ── Test setup helpers ───────────────────────────────────────────────────────

def _setup_test_db(tmp_dir):
    """Create a fresh SQLite database and contacts directory for testing."""
    db_path = os.path.join(tmp_dir, "test.db")
    contacts_dir = os.path.join(tmp_dir, "contacts")
    os.makedirs(contacts_dir, exist_ok=True)

    # Patch the module-level DB_PATH and CONTACTS_DIR
    backend_main.DB_PATH = db_path
    backend_main.CONTACTS_DIR = contacts_dir

    # Initialize the contacts table in the test database
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


# ── Property Test ────────────────────────────────────────────────────────────

@given(contact=contact_strategy())
@settings(max_examples=200, deadline=None)
def test_contact_api_round_trip_property(contact):
    """Property 1: Contact API round-trip.

    For any valid Contact object, creating it via POST /api/contacts and
    then retrieving it via GET /api/contacts/{id} SHALL return a contact
    whose fields are equivalent to the original (excluding server-assigned
    id, created_datetime, modified_datetime, and display_name).

    **Validates: Requirements 1.1, 1.4, 1.5, 1.6, 1.8, 1.9**
    """
    with tempfile.TemporaryDirectory() as tmp_dir:
        original_db_path = backend_main.DB_PATH
        original_contacts_dir = backend_main.CONTACTS_DIR
        try:
            _setup_test_db(tmp_dir)
            client = TestClient(app)

            # POST the contact
            resp = client.post("/api/contacts", json=contact)
            assert resp.status_code == 200, (
                f"POST /api/contacts failed with {resp.status_code}: {resp.text}"
            )
            created = resp.json()
            contact_id = created["id"]
            assert contact_id, "Server did not assign an id"

            # GET the contact back
            resp = client.get(f"/api/contacts/{contact_id}")
            assert resp.status_code == 200, (
                f"GET /api/contacts/{contact_id} failed with {resp.status_code}: {resp.text}"
            )
            retrieved = resp.json()

            # Compare fields (excluding server-assigned ones)
            sent_normalized = _normalize_contact(contact)
            got_normalized = _normalize_contact(retrieved)

            assert sent_normalized == got_normalized, (
                f"Contact API round-trip mismatch!\n"
                f"--- sent (normalized) ---\n{sent_normalized}\n"
                f"--- got (normalized) ---\n{got_normalized}\n"
                f"--- original contact ---\n{contact}\n"
                f"--- retrieved ---\n{retrieved}"
            )
        finally:
            # Restore original paths
            backend_main.DB_PATH = original_db_path
            backend_main.CONTACTS_DIR = original_contacts_dir
