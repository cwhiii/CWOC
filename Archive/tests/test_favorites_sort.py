"""Property-based test for favorites-first alphabetical sort invariant (Property 2).

**Validates: Requirements 3.8, 4.8, 10.5, 14.3, 15.2, 15.3, 15.4, 16.3**

Uses Hypothesis to generate N contacts with random favorite flags and display
names, insert all via POST /api/contacts, GET the full list, and verify that
all favorites appear before all non-favorites and each group is sorted
alphabetically by display_name (case-insensitive).
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

_NAME_PART = one_of(none(), _SAFE_VALUE_CHARS)


@composite
def contact_with_favorite(draw):
    """Generate a minimal contact dict with a given_name and favorite flag."""
    given_name = draw(_SAFE_VALUE_CHARS)
    contact = {
        "given_name": given_name,
        "surname": draw(_NAME_PART),
        "middle_names": draw(_NAME_PART),
        "prefix": draw(_NAME_PART),
        "suffix": draw(_NAME_PART),
        "favorite": draw(booleans()),
    }
    return contact


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

@given(contacts=lists(contact_with_favorite(), min_size=1, max_size=10))
@settings(max_examples=100, deadline=None)
def test_favorites_first_sort_invariant(contacts):
    """Property 2: Favorites-first alphabetical sort invariant.

    For any set of contacts with arbitrary favorite flags and display names,
    the list returned by GET /api/contacts SHALL be ordered such that all
    contacts with favorite=true appear before all contacts with favorite=false,
    and within each group contacts are sorted alphabetically by display_name
    (case-insensitive).

    **Validates: Requirements 3.8, 4.8, 10.5, 14.3, 15.2, 15.3, 15.4, 16.3**
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

            # GET the full list
            resp = client.get("/api/contacts")
            assert resp.status_code == 200, (
                f"GET /api/contacts failed with {resp.status_code}: {resp.text}"
            )
            result = resp.json()

            # Verify we got back the same number of contacts
            assert len(result) == len(contacts), (
                f"Expected {len(contacts)} contacts, got {len(result)}"
            )

            # Split into favorites and non-favorites
            favorites = [c for c in result if c.get("favorite")]
            non_favorites = [c for c in result if not c.get("favorite")]

            # All favorites must appear before all non-favorites
            if favorites and non_favorites:
                # Find the index of the last favorite and first non-favorite
                last_fav_idx = -1
                first_non_fav_idx = len(result)
                for i, c in enumerate(result):
                    if c.get("favorite"):
                        last_fav_idx = i
                    elif first_non_fav_idx == len(result):
                        first_non_fav_idx = i

                assert last_fav_idx < first_non_fav_idx, (
                    f"Favorites not all before non-favorites! "
                    f"Last favorite at index {last_fav_idx}, "
                    f"first non-favorite at index {first_non_fav_idx}.\n"
                    f"Order: {[(c.get('display_name'), c.get('favorite')) for c in result]}"
                )

            # Within favorites, verify alphabetical sort (case-insensitive)
            fav_names = [c.get("display_name", "") for c in favorites]
            assert fav_names == sorted(fav_names, key=lambda n: (n or "").lower()), (
                f"Favorites not alphabetically sorted!\n"
                f"Got: {fav_names}\n"
                f"Expected: {sorted(fav_names, key=lambda n: (n or '').lower())}"
            )

            # Within non-favorites, verify alphabetical sort (case-insensitive)
            non_fav_names = [c.get("display_name", "") for c in non_favorites]
            assert non_fav_names == sorted(non_fav_names, key=lambda n: (n or "").lower()), (
                f"Non-favorites not alphabetically sorted!\n"
                f"Got: {non_fav_names}\n"
                f"Expected: {sorted(non_fav_names, key=lambda n: (n or '').lower())}"
            )
        finally:
            # Restore original paths
            backend_main.DB_PATH = original_db_path
            backend_main.CONTACTS_DIR = original_contacts_dir
