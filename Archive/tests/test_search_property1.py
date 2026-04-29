"""Property-based test for search completeness and soundness (Property 1).

Feature: global-chit-search
Property 1: Search completeness and soundness

For any non-deleted chit and for any substring of any searchable field value
on that chit, searching for that substring SHALL return that chit in the
results, AND every chit in the results SHALL contain the query in at least
one searchable field.

**Validates: Requirements 3.1, 3.3, 3.4, 7.5**

Uses Python unittest with manual randomized data generation (min 100 iterations).
No external libraries (no hypothesis, no pip installs).
"""

import os
import sys
import random
import string
import tempfile
import sqlite3
import unittest

# Allow importing from the backend directory
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

import main as backend_main
from main import app
from fastapi.testclient import TestClient

NUM_ITERATIONS = 100

# ── Random data generators ───────────────────────────────────────────────────

SAFE_CHARS = string.ascii_letters + string.digits + " .-_"


def rand_str(min_len=2, max_len=30):
    """Generate a random string of safe characters."""
    length = random.randint(min_len, max_len)
    return "".join(random.choice(SAFE_CHARS) for _ in range(length))


def rand_str_or_none(probability=0.5, min_len=2, max_len=30):
    """Return a random string or None."""
    if random.random() < probability:
        return rand_str(min_len, max_len)
    return None


def rand_list_of_str(min_items=0, max_items=4):
    """Generate a list of random strings (or None)."""
    if random.random() < 0.3:
        return None
    count = random.randint(min_items, max_items)
    return [rand_str(2, 15) for _ in range(count)] if count > 0 else None


def rand_checklist():
    """Generate a random checklist (list of dicts with 'text' key) or None."""
    if random.random() < 0.5:
        return None
    count = random.randint(1, 3)
    return [{"text": rand_str(3, 20), "checked": random.choice([True, False])} for _ in range(count)]


def rand_alerts():
    """Generate a random alerts list or None."""
    if random.random() < 0.6:
        return None
    count = random.randint(1, 2)
    alerts = []
    for _ in range(count):
        alert = {}
        if random.random() < 0.5:
            alert["description"] = rand_str(3, 20)
        if random.random() < 0.5:
            alert["label"] = rand_str(3, 15)
        if random.random() < 0.5:
            alert["type"] = random.choice(["alarm", "timer", "notification"])
        alerts.append(alert)
    return alerts


def rand_datetime_str():
    """Generate a random ISO datetime string or None."""
    if random.random() < 0.5:
        return None
    year = random.randint(2020, 2025)
    month = random.randint(1, 12)
    day = random.randint(1, 28)
    hour = random.randint(0, 23)
    minute = random.randint(0, 59)
    return f"{year}-{month:02d}-{day:02d}T{hour:02d}:{minute:02d}:00"


def rand_color():
    """Generate a random hex color or None."""
    if random.random() < 0.6:
        return None
    return "#{:06x}".format(random.randint(0, 0xFFFFFF))


def generate_random_chit():
    """Generate a random chit dict suitable for POST /api/chits."""
    return {
        "title": rand_str_or_none(0.8),
        "note": rand_str_or_none(0.6, 5, 50),
        "tags": rand_list_of_str(0, 4),
        "status": random.choice([None, "ToDo", "In Progress", "Blocked", "Complete"]),
        "priority": random.choice([None, "Low", "Medium", "High", "Critical"]),
        "severity": random.choice([None, "Minor", "Major", "Critical"]),
        "location": rand_str_or_none(0.3, 3, 25),
        "people": rand_list_of_str(0, 3),
        "checklist": rand_checklist(),
        "start_datetime": rand_datetime_str(),
        "end_datetime": rand_datetime_str(),
        "due_datetime": rand_datetime_str(),
        "color": rand_color(),
        "alerts": rand_alerts(),
    }


# ── Test DB setup ────────────────────────────────────────────────────────────

def setup_test_db(tmp_dir):
    """Create a fresh SQLite database for testing."""
    db_path = os.path.join(tmp_dir, "test.db")
    contacts_dir = os.path.join(tmp_dir, "contacts")
    os.makedirs(contacts_dir, exist_ok=True)

    backend_main.DB_PATH = db_path
    backend_main.CONTACTS_DIR = contacts_dir

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS chits (
        id TEXT PRIMARY KEY,
        title TEXT,
        note TEXT,
        tags TEXT,
        start_datetime TEXT,
        end_datetime TEXT,
        due_datetime TEXT,
        completed_datetime TEXT,
        status TEXT,
        priority TEXT,
        severity TEXT,
        checklist TEXT,
        alarm BOOLEAN,
        notification BOOLEAN,
        recurrence TEXT,
        recurrence_id TEXT,
        recurrence_rule TEXT,
        recurrence_exceptions TEXT,
        location TEXT,
        color TEXT,
        people TEXT,
        pinned BOOLEAN,
        archived BOOLEAN,
        deleted BOOLEAN,
        created_datetime TEXT,
        modified_datetime TEXT,
        is_project_master BOOLEAN DEFAULT 0,
        child_chits TEXT,
        all_day BOOLEAN DEFAULT 0,
        alerts TEXT
    )
    """)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS settings (
        user_id TEXT PRIMARY KEY,
        time_format TEXT,
        sex TEXT,
        snooze_length TEXT,
        default_filters TEXT,
        alarm_orientation TEXT,
        active_clocks TEXT,
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
        custom_days_count TEXT DEFAULT '7',
        active_clocks TEXT,
        all_view_start_hour TEXT DEFAULT '0',
        all_view_end_hour TEXT DEFAULT '24',
        day_scroll_to_hour TEXT DEFAULT '5',
        saved_locations TEXT
    )
    """)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS instance_meta (
        key TEXT PRIMARY KEY,
        value TEXT
    )
    """)
    conn.commit()
    conn.close()
    return db_path, contacts_dir


# ── Helper: check if a chit matches a query ─────────────────────────────────

def chit_contains_query(chit, query):
    """Check if a chit contains the query string in at least one searchable field.

    Mirrors the backend search logic: case-insensitive substring matching
    across all searchable fields.
    """
    q_lower = query.lower()

    # Simple string fields
    for field_name in [
        "title", "note", "status", "priority", "severity",
        "location", "color",
        "start_datetime", "end_datetime", "due_datetime",
        "created_datetime", "modified_datetime",
    ]:
        value = chit.get(field_name)
        if value and q_lower in str(value).lower():
            return True

    # Tags — each tag individually
    tags = chit.get("tags")
    if tags and isinstance(tags, list):
        for tag in tags:
            if isinstance(tag, str) and q_lower in tag.lower():
                return True

    # People — each person individually
    people = chit.get("people")
    if people and isinstance(people, list):
        for person in people:
            if isinstance(person, str) and q_lower in person.lower():
                return True

    # Checklist — each item's text
    checklist = chit.get("checklist")
    if checklist and isinstance(checklist, list):
        for item in checklist:
            if isinstance(item, dict):
                item_text = item.get("text", "")
                if item_text and q_lower in str(item_text).lower():
                    return True

    # Alerts — description/label/name/type
    alerts = chit.get("alerts")
    if alerts and isinstance(alerts, list):
        for alert in alerts:
            if isinstance(alert, dict):
                for alert_key in ["description", "label", "name", "type"]:
                    alert_val = alert.get(alert_key, "")
                    if alert_val and q_lower in str(alert_val).lower():
                        return True

    return False


def pick_substring_from_chit(chit):
    """Pick a random non-empty substring from one of the chit's searchable field values.

    Returns (substring, field_name) or (None, None) if no searchable values exist.
    """
    candidates = []

    # Simple string fields
    for field_name in [
        "title", "note", "status", "priority", "severity",
        "location", "color",
        "start_datetime", "end_datetime", "due_datetime",
        "created_datetime", "modified_datetime",
    ]:
        value = chit.get(field_name)
        if value and str(value).strip():
            candidates.append((str(value), field_name))

    # Tags
    tags = chit.get("tags")
    if tags and isinstance(tags, list):
        for tag in tags:
            if isinstance(tag, str) and tag.strip():
                candidates.append((tag, "tags"))

    # People
    people = chit.get("people")
    if people and isinstance(people, list):
        for person in people:
            if isinstance(person, str) and person.strip():
                candidates.append((person, "people"))

    # Checklist items
    checklist = chit.get("checklist")
    if checklist and isinstance(checklist, list):
        for item in checklist:
            if isinstance(item, dict):
                text_val = item.get("text", "")
                if text_val and str(text_val).strip():
                    candidates.append((str(text_val), "checklist"))

    # Alerts
    alerts = chit.get("alerts")
    if alerts and isinstance(alerts, list):
        for alert in alerts:
            if isinstance(alert, dict):
                for key in ["description", "label", "type"]:
                    val = alert.get(key, "")
                    if val and str(val).strip():
                        candidates.append((str(val), "alerts"))

    if not candidates:
        return None, None

    text_val, field_name = random.choice(candidates)
    # Pick a random substring of length 1..len(text_val)
    if len(text_val) == 0:
        return None, None
    sub_len = random.randint(1, min(len(text_val), 10))
    start_idx = random.randint(0, len(text_val) - sub_len)
    substring = text_val[start_idx:start_idx + sub_len]
    return substring, field_name


# ── Property Test Class ──────────────────────────────────────────────────────

class TestSearchCompletenessAndSoundness(unittest.TestCase):
    """Feature: global-chit-search
    Property 1: Search completeness and soundness

    For any non-deleted chit and for any substring of any searchable field
    value on that chit, searching for that substring SHALL return that chit
    in the results, AND every chit in the results SHALL contain the query
    in at least one searchable field.

    **Validates: Requirements 3.1, 3.3, 3.4, 7.5**
    """

    def test_search_completeness_and_soundness(self):
        """Run 100+ iterations of randomized completeness and soundness checks."""
        completeness_pass = 0
        soundness_pass = 0

        for iteration in range(NUM_ITERATIONS):
            with tempfile.TemporaryDirectory() as tmp_dir:
                original_db = backend_main.DB_PATH
                original_contacts = backend_main.CONTACTS_DIR
                try:
                    setup_test_db(tmp_dir)
                    client = TestClient(app)

                    # Generate and insert 1-5 random chits
                    num_chits = random.randint(1, 5)
                    inserted_chits = []
                    for _ in range(num_chits):
                        chit_data = generate_random_chit()
                        resp = client.post("/api/chits", json=chit_data)
                        self.assertEqual(resp.status_code, 200,
                            f"Iteration {iteration}: POST /api/chits failed: {resp.text}")
                        created = resp.json()
                        inserted_chits.append(created)

                    # --- Completeness: pick a substring from a random chit,
                    # search for it, verify the chit appears in results ---
                    target_chit = random.choice(inserted_chits)
                    substring, field_name = pick_substring_from_chit(target_chit)

                    if substring and substring.strip():
                        query = substring.strip()
                        resp = client.get(f"/api/chits/search?q={query}")
                        self.assertEqual(resp.status_code, 200,
                            f"Iteration {iteration}: GET /api/chits/search failed: {resp.text}")
                        results = resp.json()
                        result_ids = [r["chit"]["id"] for r in results]

                        self.assertIn(target_chit["id"], result_ids,
                            f"Iteration {iteration}: Completeness failed — "
                            f"chit {target_chit['id']} not found when searching "
                            f"for '{query}' (from field '{field_name}', "
                            f"chit title='{target_chit.get('title')}')")
                        completeness_pass += 1

                        # --- Soundness: every returned chit must contain
                        # the query in at least one searchable field ---
                        for result in results:
                            chit_data = result["chit"]
                            self.assertTrue(
                                chit_contains_query(chit_data, query),
                                f"Iteration {iteration}: Soundness failed — "
                                f"chit {chit_data['id']} returned for query "
                                f"'{query}' but does not contain it in any "
                                f"searchable field. "
                                f"title={chit_data.get('title')}, "
                                f"note={chit_data.get('note')}, "
                                f"tags={chit_data.get('tags')}")
                        soundness_pass += 1

                finally:
                    backend_main.DB_PATH = original_db
                    backend_main.CONTACTS_DIR = original_contacts

        # Ensure we actually tested a meaningful number of iterations
        self.assertGreaterEqual(completeness_pass, NUM_ITERATIONS * 0.8,
            f"Too few completeness checks passed: {completeness_pass}/{NUM_ITERATIONS}")
        self.assertGreaterEqual(soundness_pass, NUM_ITERATIONS * 0.8,
            f"Too few soundness checks passed: {soundness_pass}/{NUM_ITERATIONS}")


if __name__ == "__main__":
    unittest.main()
