"""Property-based test for Saved Locations API round-trip (Property 1).

Feature: saved-locations-weather, Property 1: Saved locations API round-trip

**Validates: Requirements 3.3, 3.4**

Uses Hypothesis to generate random saved_locations arrays with varying labels,
addresses, and is_default flags. POSTs settings with the generated saved_locations
to /api/settings, then GETs from /api/settings/default_user and verifies the
saved_locations round-trip correctly.
"""
import sys
import os
import json
import tempfile
import sqlite3

# Allow importing from the backend directory
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from hypothesis import given, settings as h_settings, assume
from hypothesis.strategies import (
    booleans,
    composite,
    lists,
    text,
)

import main as backend_main
from main import app

from fastapi.testclient import TestClient


# ── Strategies ───────────────────────────────────────────────────────────────

_SAFE_LABEL = text(
    alphabet="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -_",
    min_size=1,
    max_size=30,
)

_SAFE_ADDRESS = text(
    alphabet="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,#-",
    min_size=1,
    max_size=80,
)


@composite
def saved_location_entry(draw):
    """Generate a single saved location dict with label, address, is_default."""
    return {
        "label": draw(_SAFE_LABEL),
        "address": draw(_SAFE_ADDRESS),
        "is_default": draw(booleans()),
    }


@composite
def saved_locations_list(draw):
    """Generate a list of 0-10 saved location entries."""
    return draw(lists(saved_location_entry(), min_size=0, max_size=10))


# ── Test DB setup ────────────────────────────────────────────────────────────

def _setup_test_db(tmp_dir):
    """Create a fresh SQLite database with the settings table for testing."""
    db_path = os.path.join(tmp_dir, "test.db")

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS settings (
        user_id TEXT PRIMARY KEY,
        time_format TEXT,
        sex TEXT,
        snooze_length TEXT,
        default_filters TEXT,
        alarm_orientation TEXT,
        active_clocks TEXT,
        saved_locations TEXT,
        tags TEXT,
        custom_colors TEXT,
        visual_indicators TEXT,
        chit_options TEXT,
        calendar_snap TEXT DEFAULT '15',
        week_start_day TEXT DEFAULT '0',
        work_start_hour TEXT DEFAULT '8',
        work_end_hour TEXT DEFAULT '17',
        work_days TEXT DEFAULT '1,2,3,4,5',
        enabled_periods TEXT DEFAULT 'Itinerary,Day,Week,Work,SevenDay,Month,Year',
        custom_days_count TEXT DEFAULT '7'
    )
    """)
    conn.commit()
    conn.close()

    # Patch the module-level DB_PATH
    backend_main.DB_PATH = db_path
    return db_path


# ── Property Test ────────────────────────────────────────────────────────────

@given(locations=saved_locations_list())
@h_settings(max_examples=100, deadline=None)
def test_saved_locations_api_round_trip(locations):
    """Property 1: Saved locations API round-trip.

    For any valid saved_locations array (containing objects with label, address,
    and is_default fields), POSTing it to /api/settings and then GETting from
    /api/settings/default_user SHALL return an equivalent saved_locations array.

    Feature: saved-locations-weather, Property 1: Saved locations API round-trip
    **Validates: Requirements 3.3, 3.4**
    """
    with tempfile.TemporaryDirectory() as tmp_dir:
        original_db_path = backend_main.DB_PATH
        try:
            _setup_test_db(tmp_dir)
            client = TestClient(app)

            # The Pydantic model expects saved_locations as a JSON string
            locations_json_str = json.dumps(locations)

            payload = {
                "user_id": "default_user",
                "saved_locations": locations_json_str,
            }

            # POST the settings
            resp = client.post("/api/settings", json=payload)
            assert resp.status_code == 200, (
                f"POST /api/settings failed with {resp.status_code}: {resp.text}"
            )

            # GET the settings back
            resp = client.get("/api/settings/default_user")
            assert resp.status_code == 200, (
                f"GET /api/settings/default_user failed with {resp.status_code}: {resp.text}"
            )
            result = resp.json()

            # The GET endpoint deserializes saved_locations via deserialize_json_field.
            # Since POST serializes with serialize_json_field (json.dumps on the string),
            # and GET deserializes with deserialize_json_field (json.loads), the round-trip
            # should return the original JSON string.
            returned_locations = result.get("saved_locations")

            # Parse both for comparison (the returned value may be a string or parsed list)
            if isinstance(returned_locations, str):
                returned_parsed = json.loads(returned_locations)
            elif returned_locations is None:
                returned_parsed = None
            else:
                returned_parsed = returned_locations

            # For empty list input, the backend may return [] or None
            if locations == []:
                assert returned_parsed == [] or returned_parsed is None or returned_parsed == "[]", (
                    f"Expected empty list or None for empty input, got: {returned_parsed}"
                )
            else:
                assert returned_parsed == locations, (
                    f"Saved locations round-trip mismatch!\n"
                    f"--- sent ---\n{locations}\n"
                    f"--- got (raw) ---\n{returned_locations}\n"
                    f"--- got (parsed) ---\n{returned_parsed}"
                )
        finally:
            backend_main.DB_PATH = original_db_path
