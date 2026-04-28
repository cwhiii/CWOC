"""Property-based test for add mode settings merge deduplication (Property 5).

**Validates: Requirements 6.4**

Uses Python stdlib only (random, string, json, sqlite3, unittest). Minimum 100 iterations.
Generates random existing settings and imported settings with overlapping array fields
(tags, custom_colors, saved_locations), replicates the import_userdata "add" mode merge
logic from backend/main.py, and verifies:
  - Result arrays are the deduplicated union of existing and imported values
  - No existing items are removed
  - No duplicate items appear (by name/value/label)
  - Scalar fields are NOT overwritten
"""

import json
import os
import random
import sqlite3
import string
import tempfile
import unittest
from uuid import uuid4


# ── Replicated helpers from backend/main.py (stdlib only, no FastAPI) ────────

def serialize_json_field(data):
    if data is None:
        return None
    try:
        return json.dumps(data)
    except TypeError:
        return None


def deserialize_json_field(data):
    if data is None:
        return None
    try:
        return json.loads(data)
    except (json.JSONDecodeError, TypeError):
        return None


# ── Replicated add-mode settings merge logic from backend/main.py ────────────

def _merge_settings_add_mode(db_path, imported_settings_record):
    """Replicate the add-mode settings merge from import_userdata in backend/main.py.

    Given a DB with an existing settings row and an imported settings record
    (already deserialized, as it would appear in the export envelope), merge
    array fields and leave scalar fields untouched.
    """
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    user_id = imported_settings_record.get("user_id", "default_user")

    cursor = conn.cursor()
    cursor.execute("SELECT * FROM settings WHERE user_id = ?", (user_id,))
    existing_row = cursor.fetchone()

    if existing_row:
        existing = dict(existing_row)

        # Deserialize existing array fields
        existing_tags = deserialize_json_field(existing.get("tags")) or []
        existing_custom_colors = deserialize_json_field(existing.get("custom_colors")) or []
        existing_saved_locations = deserialize_json_field(existing.get("saved_locations")) or []

        # Imported array fields (already deserialized in envelope)
        imported_tags = imported_settings_record.get("tags") or []
        imported_custom_colors = imported_settings_record.get("custom_colors") or []
        imported_saved_locations = imported_settings_record.get("saved_locations") or []

        # Merge tags: deduplicate by tag name
        existing_tag_names = {t.get("name") for t in existing_tags if isinstance(t, dict)}
        for tag in imported_tags:
            if isinstance(tag, dict) and tag.get("name") not in existing_tag_names:
                existing_tags.append(tag)
                existing_tag_names.add(tag.get("name"))

        # Merge custom_colors: deduplicate by string value
        existing_color_set = set(existing_custom_colors)
        for color in imported_custom_colors:
            if color not in existing_color_set:
                existing_custom_colors.append(color)
                existing_color_set.add(color)

        # Merge saved_locations: deduplicate by label
        existing_loc_labels = {loc.get("label") for loc in existing_saved_locations if isinstance(loc, dict)}
        for loc in imported_saved_locations:
            if isinstance(loc, dict) and loc.get("label") not in existing_loc_labels:
                existing_saved_locations.append(loc)
                existing_loc_labels.add(loc.get("label"))

        # UPDATE existing row with merged arrays only (scalar fields untouched)
        conn.execute(
            """UPDATE settings SET tags = ?, custom_colors = ?, saved_locations = ?
               WHERE user_id = ?""",
            (
                serialize_json_field(existing_tags),
                serialize_json_field(existing_custom_colors),
                serialize_json_field(existing_saved_locations),
                user_id,
            ),
        )
    else:
        # No existing row — insert the imported one
        conn.execute(
            """INSERT OR REPLACE INTO settings (
                user_id, time_format, sex, snooze_length, default_filters,
                alarm_orientation, active_clocks, saved_locations, tags, custom_colors,
                visual_indicators, chit_options, calendar_snap, week_start_day,
                work_start_hour, work_end_hour, work_days, enabled_periods,
                custom_days_count, all_view_start_hour, all_view_end_hour,
                day_scroll_to_hour, username, audit_log_max_days, audit_log_max_mb
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                user_id,
                imported_settings_record.get("time_format"),
                imported_settings_record.get("sex"),
                imported_settings_record.get("snooze_length"),
                serialize_json_field(imported_settings_record.get("default_filters")),
                imported_settings_record.get("alarm_orientation"),
                imported_settings_record.get("active_clocks"),
                serialize_json_field(imported_settings_record.get("saved_locations")),
                serialize_json_field(imported_settings_record.get("tags")),
                serialize_json_field(imported_settings_record.get("custom_colors")),
                serialize_json_field(imported_settings_record.get("visual_indicators")),
                serialize_json_field(imported_settings_record.get("chit_options")),
                imported_settings_record.get("calendar_snap"),
                imported_settings_record.get("week_start_day"),
                imported_settings_record.get("work_start_hour"),
                imported_settings_record.get("work_end_hour"),
                imported_settings_record.get("work_days"),
                imported_settings_record.get("enabled_periods"),
                imported_settings_record.get("custom_days_count"),
                imported_settings_record.get("all_view_start_hour"),
                imported_settings_record.get("all_view_end_hour"),
                imported_settings_record.get("day_scroll_to_hour"),
                imported_settings_record.get("username"),
                imported_settings_record.get("audit_log_max_days"),
                imported_settings_record.get("audit_log_max_mb"),
            ),
        )

    conn.commit()
    conn.close()


def _read_settings(db_path, user_id):
    """Read and deserialize a settings row from the DB."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM settings WHERE user_id = ?", (user_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        return None
    s = dict(row)
    s["tags"] = deserialize_json_field(s.get("tags"))
    s["custom_colors"] = deserialize_json_field(s.get("custom_colors"))
    s["saved_locations"] = deserialize_json_field(s.get("saved_locations"))
    s["default_filters"] = deserialize_json_field(s.get("default_filters"))
    s["visual_indicators"] = deserialize_json_field(s.get("visual_indicators"))
    s["chit_options"] = deserialize_json_field(s.get("chit_options"))
    return s


# ── DB setup ─────────────────────────────────────────────────────────────────

def _create_test_db(db_path):
    """Create a fresh test database with settings and instance_meta tables."""
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
        all_view_start_hour TEXT DEFAULT '0',
        all_view_end_hour TEXT DEFAULT '24',
        day_scroll_to_hour TEXT DEFAULT '5',
        saved_locations TEXT,
        username TEXT,
        audit_log_max_days INTEGER DEFAULT 1096,
        audit_log_max_mb REAL DEFAULT 1.0
    )
    """)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS instance_meta (
        key TEXT PRIMARY KEY,
        value TEXT
    )
    """)
    cursor.execute(
        "INSERT OR IGNORE INTO instance_meta (key, value) VALUES ('instance_id', ?)",
        (str(uuid4()),),
    )
    conn.commit()
    conn.close()


SETTINGS_COLUMNS = [
    "user_id", "time_format", "sex", "snooze_length", "default_filters",
    "alarm_orientation", "active_clocks", "tags", "custom_colors",
    "visual_indicators", "chit_options", "calendar_snap", "week_start_day",
    "work_start_hour", "work_end_hour", "work_days", "enabled_periods",
    "custom_days_count", "all_view_start_hour", "all_view_end_hour",
    "day_scroll_to_hour", "saved_locations", "username",
    "audit_log_max_days", "audit_log_max_mb",
]

SCALAR_FIELDS = [
    "time_format", "sex", "snooze_length", "default_filters",
    "alarm_orientation", "active_clocks", "visual_indicators",
    "chit_options", "calendar_snap", "week_start_day",
    "work_start_hour", "work_end_hour", "work_days", "enabled_periods",
    "custom_days_count", "all_view_start_hour", "all_view_end_hour",
    "day_scroll_to_hour", "username", "audit_log_max_days", "audit_log_max_mb",
]


def _insert_settings_raw(db_path, raw_row):
    """Insert a single settings raw row dict into the database."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    placeholders = ", ".join(["?"] * len(SETTINGS_COLUMNS))
    col_names = ", ".join(SETTINGS_COLUMNS)
    values = [raw_row.get(col) for col in SETTINGS_COLUMNS]
    cursor.execute(f"INSERT INTO settings ({col_names}) VALUES ({placeholders})", values)
    conn.commit()
    conn.close()


# ── Random data generators ───────────────────────────────────────────────────

TAG_NAME_POOL = [
    "Work", "Personal", "Urgent", "Home", "Travel", "Health", "Finance",
    "Shopping", "Meeting", "Deadline", "Birthday", "Holiday", "Project",
    "Review", "Followup", "Idea", "Bug", "Feature", "Research", "Admin",
]

COLOR_POOL = [
    "#ff0000", "#00ff00", "#0000ff", "#ffff00", "#ff00ff", "#00ffff",
    "#800000", "#008000", "#000080", "#808000", "#800080", "#008080",
    "#c0c0c0", "#ff8000", "#8000ff", "#0080ff", "#ff0080", "#80ff00",
    "#00ff80", "#ff8080",
]

LOCATION_LABEL_POOL = [
    "Home", "Work", "Gym", "School", "Office", "Park", "Library",
    "Hospital", "Airport", "Station", "Mall", "Church", "Cafe",
    "Restaurant", "Beach", "Mountain", "Lake", "Farm", "Studio", "Lab",
]


def _rand_str(min_len=2, max_len=15):
    length = random.randint(min_len, max_len)
    return "".join(random.choices(string.ascii_letters + string.digits, k=length))


def _rand_hex_color():
    return "#" + "".join(random.choices("0123456789abcdef", k=6))


def _rand_tag(name=None):
    """Generate a random tag object with a given or random name."""
    return {
        "name": name or random.choice(TAG_NAME_POOL),
        "color": _rand_hex_color(),
        "fontColor": _rand_hex_color() if random.random() < 0.5 else None,
        "favorite": random.choice([True, False]),
    }


def _rand_saved_location(label=None):
    """Generate a random saved location with a given or random label."""
    return {
        "label": label or random.choice(LOCATION_LABEL_POOL),
        "address": _rand_str(10, 40),
        "is_default": random.choice([True, False]),
    }


def _generate_overlapping_settings(user_id):
    """Generate existing and imported settings with guaranteed overlapping array fields.

    Returns (existing_raw_db_row, imported_deserialized_record,
             existing_tags, imported_tags,
             existing_colors, imported_colors,
             existing_locations, imported_locations).
    """
    # Pick some tag names for overlap
    num_existing_tags = random.randint(1, 6)
    num_imported_tags = random.randint(1, 6)
    num_overlap_tags = random.randint(0, min(num_existing_tags, num_imported_tags))

    shared_tag_names = random.sample(TAG_NAME_POOL, num_overlap_tags)
    remaining_names = [n for n in TAG_NAME_POOL if n not in shared_tag_names]
    existing_only_names = random.sample(remaining_names, min(num_existing_tags - num_overlap_tags, len(remaining_names)))
    remaining_names = [n for n in remaining_names if n not in existing_only_names]
    imported_only_names = random.sample(remaining_names, min(num_imported_tags - num_overlap_tags, len(remaining_names)))

    existing_tags = [_rand_tag(n) for n in shared_tag_names + existing_only_names]
    imported_tags = [_rand_tag(n) for n in shared_tag_names + imported_only_names]
    random.shuffle(existing_tags)
    random.shuffle(imported_tags)

    # Pick some colors for overlap
    num_existing_colors = random.randint(1, 6)
    num_imported_colors = random.randint(1, 6)
    num_overlap_colors = random.randint(0, min(num_existing_colors, num_imported_colors, len(COLOR_POOL)))

    shared_colors = random.sample(COLOR_POOL, num_overlap_colors)
    remaining_colors = [c for c in COLOR_POOL if c not in shared_colors]
    existing_only_colors = random.sample(remaining_colors, min(num_existing_colors - num_overlap_colors, len(remaining_colors)))
    remaining_colors = [c for c in remaining_colors if c not in existing_only_colors]
    imported_only_colors = random.sample(remaining_colors, min(num_imported_colors - num_overlap_colors, len(remaining_colors)))

    existing_colors = shared_colors + existing_only_colors
    imported_colors = shared_colors + imported_only_colors
    random.shuffle(existing_colors)
    random.shuffle(imported_colors)

    # Pick some location labels for overlap
    num_existing_locs = random.randint(1, 5)
    num_imported_locs = random.randint(1, 5)
    num_overlap_locs = random.randint(0, min(num_existing_locs, num_imported_locs, len(LOCATION_LABEL_POOL)))

    shared_loc_labels = random.sample(LOCATION_LABEL_POOL, num_overlap_locs)
    remaining_labels = [l for l in LOCATION_LABEL_POOL if l not in shared_loc_labels]
    existing_only_labels = random.sample(remaining_labels, min(num_existing_locs - num_overlap_locs, len(remaining_labels)))
    remaining_labels = [l for l in remaining_labels if l not in existing_only_labels]
    imported_only_labels = random.sample(remaining_labels, min(num_imported_locs - num_overlap_locs, len(remaining_labels)))

    existing_locations = [_rand_saved_location(l) for l in shared_loc_labels + existing_only_labels]
    imported_locations = [_rand_saved_location(l) for l in shared_loc_labels + imported_only_labels]
    random.shuffle(existing_locations)
    random.shuffle(imported_locations)

    # Scalar fields for existing row
    existing_time_format = random.choice(["12", "24"])
    existing_sex = random.choice(["M", "F", "X", None])
    existing_snooze = str(random.randint(1, 30))
    existing_username = _rand_str(3, 12)
    existing_calendar_snap = str(random.choice([5, 10, 15, 30, 60]))

    # Different scalar fields for imported row (to verify they don't overwrite)
    imported_time_format = "24" if existing_time_format == "12" else "12"
    imported_sex = "X" if existing_sex != "X" else "M"
    imported_snooze = str(random.randint(31, 60))
    imported_username = _rand_str(3, 12) + "_imported"
    imported_calendar_snap = str(random.choice([5, 10, 15, 30, 60]))

    existing_raw = {
        "user_id": user_id,
        "time_format": existing_time_format,
        "sex": existing_sex,
        "snooze_length": existing_snooze,
        "default_filters": None,
        "alarm_orientation": "top",
        "active_clocks": "24hour,utc",
        "tags": serialize_json_field(existing_tags),
        "custom_colors": serialize_json_field(existing_colors),
        "visual_indicators": None,
        "chit_options": None,
        "calendar_snap": existing_calendar_snap,
        "week_start_day": "0",
        "work_start_hour": "8",
        "work_end_hour": "17",
        "work_days": "1,2,3,4,5",
        "enabled_periods": "Day,Week,Month",
        "custom_days_count": "7",
        "all_view_start_hour": "0",
        "all_view_end_hour": "24",
        "day_scroll_to_hour": "5",
        "saved_locations": serialize_json_field(existing_locations),
        "username": existing_username,
        "audit_log_max_days": 365,
        "audit_log_max_mb": 10,
    }

    imported_record = {
        "user_id": user_id,
        "time_format": imported_time_format,
        "sex": imported_sex,
        "snooze_length": imported_snooze,
        "default_filters": {"Calendar": "test"},
        "alarm_orientation": "bottom",
        "active_clocks": "12hour",
        "tags": imported_tags,
        "custom_colors": imported_colors,
        "visual_indicators": {"showPriority": True},
        "chit_options": {"showCompleted": True},
        "calendar_snap": imported_calendar_snap,
        "week_start_day": "1",
        "work_start_hour": "9",
        "work_end_hour": "18",
        "work_days": "0,1,2,3,4",
        "enabled_periods": "Itinerary,Day,Week",
        "custom_days_count": "14",
        "all_view_start_hour": "6",
        "all_view_end_hour": "22",
        "day_scroll_to_hour": "8",
        "saved_locations": imported_locations,
        "username": imported_username,
        "audit_log_max_days": 730,
        "audit_log_max_mb": 50,
    }

    return (existing_raw, imported_record,
            existing_tags, imported_tags,
            existing_colors, imported_colors,
            existing_locations, imported_locations)


# ── Test class ───────────────────────────────────────────────────────────────

class TestAddModeSettingsMergeDedup(unittest.TestCase):
    """Property 5: Add mode settings merge deduplicates array fields.

    For any existing settings record and any valid imported settings record,
    when imported via POST /api/import/userdata with mode "add", the resulting
    array fields (tags, custom_colors, saved_locations) SHALL be the
    deduplicated union of the existing and imported values — no existing items
    are removed, and no duplicate items appear.

    **Validates: Requirements 6.4**
    """

    def test_add_mode_settings_merge_dedup(self):
        """Property test: 100 iterations with overlapping array fields."""
        iterations = 100

        for i in range(iterations):
            with tempfile.TemporaryDirectory() as tmp_dir:
                db_path = os.path.join(tmp_dir, "test.db")
                _create_test_db(db_path)

                user_id = "default_user"
                (existing_raw, imported_record,
                 existing_tags, imported_tags,
                 existing_colors, imported_colors,
                 existing_locations, imported_locations) = _generate_overlapping_settings(user_id)

                # Snapshot existing scalar values before merge
                existing_scalars = {
                    "time_format": existing_raw["time_format"],
                    "sex": existing_raw["sex"],
                    "snooze_length": existing_raw["snooze_length"],
                    "alarm_orientation": existing_raw["alarm_orientation"],
                    "active_clocks": existing_raw["active_clocks"],
                    "calendar_snap": existing_raw["calendar_snap"],
                    "week_start_day": existing_raw["week_start_day"],
                    "work_start_hour": existing_raw["work_start_hour"],
                    "work_end_hour": existing_raw["work_end_hour"],
                    "work_days": existing_raw["work_days"],
                    "enabled_periods": existing_raw["enabled_periods"],
                    "custom_days_count": existing_raw["custom_days_count"],
                    "all_view_start_hour": existing_raw["all_view_start_hour"],
                    "all_view_end_hour": existing_raw["all_view_end_hour"],
                    "day_scroll_to_hour": existing_raw["day_scroll_to_hour"],
                    "username": existing_raw["username"],
                    "audit_log_max_days": existing_raw["audit_log_max_days"],
                    "audit_log_max_mb": existing_raw["audit_log_max_mb"],
                }

                # Insert existing settings into DB
                _insert_settings_raw(db_path, existing_raw)

                # Run the merge
                _merge_settings_add_mode(db_path, imported_record)

                # Read the result
                result = _read_settings(db_path, user_id)
                self.assertIsNotNone(result, f"Iteration {i}: settings row missing after merge")

                result_tags = result.get("tags") or []
                result_colors = result.get("custom_colors") or []
                result_locations = result.get("saved_locations") or []

                # ── Verify tags: deduplicated union ──────────────────────
                # All existing tag names must be present
                existing_tag_names = {t["name"] for t in existing_tags}
                result_tag_names = {t["name"] for t in result_tags if isinstance(t, dict)}
                for name in existing_tag_names:
                    self.assertIn(
                        name, result_tag_names,
                        f"Iteration {i}: existing tag '{name}' was removed during merge"
                    )

                # All imported tag names must be present
                imported_tag_names = {t["name"] for t in imported_tags}
                for name in imported_tag_names:
                    self.assertIn(
                        name, result_tag_names,
                        f"Iteration {i}: imported tag '{name}' missing from result"
                    )

                # Result should be the union
                expected_tag_names = existing_tag_names | imported_tag_names
                self.assertEqual(
                    result_tag_names, expected_tag_names,
                    f"Iteration {i}: result tags should be union of existing and imported"
                )

                # No duplicate tag names
                result_tag_name_list = [t["name"] for t in result_tags if isinstance(t, dict)]
                self.assertEqual(
                    len(result_tag_name_list), len(set(result_tag_name_list)),
                    f"Iteration {i}: result tags contain duplicates: {result_tag_name_list}"
                )

                # ── Verify custom_colors: deduplicated union ─────────────
                existing_color_set = set(existing_colors)
                result_color_set = set(result_colors)

                for color in existing_color_set:
                    self.assertIn(
                        color, result_color_set,
                        f"Iteration {i}: existing color '{color}' was removed during merge"
                    )

                imported_color_set = set(imported_colors)
                for color in imported_color_set:
                    self.assertIn(
                        color, result_color_set,
                        f"Iteration {i}: imported color '{color}' missing from result"
                    )

                expected_colors = existing_color_set | imported_color_set
                self.assertEqual(
                    result_color_set, expected_colors,
                    f"Iteration {i}: result colors should be union of existing and imported"
                )

                # No duplicate colors
                self.assertEqual(
                    len(result_colors), len(set(result_colors)),
                    f"Iteration {i}: result colors contain duplicates"
                )

                # ── Verify saved_locations: deduplicated union ───────────
                existing_loc_labels = {loc["label"] for loc in existing_locations}
                result_loc_labels = {loc["label"] for loc in result_locations if isinstance(loc, dict)}

                for label in existing_loc_labels:
                    self.assertIn(
                        label, result_loc_labels,
                        f"Iteration {i}: existing location '{label}' was removed during merge"
                    )

                imported_loc_labels = {loc["label"] for loc in imported_locations}
                for label in imported_loc_labels:
                    self.assertIn(
                        label, result_loc_labels,
                        f"Iteration {i}: imported location '{label}' missing from result"
                    )

                expected_loc_labels = existing_loc_labels | imported_loc_labels
                self.assertEqual(
                    result_loc_labels, expected_loc_labels,
                    f"Iteration {i}: result locations should be union of existing and imported"
                )

                # No duplicate location labels
                result_loc_label_list = [loc["label"] for loc in result_locations if isinstance(loc, dict)]
                self.assertEqual(
                    len(result_loc_label_list), len(set(result_loc_label_list)),
                    f"Iteration {i}: result locations contain duplicate labels"
                )

                # ── Verify scalar fields NOT overwritten ─────────────────
                for field, expected_val in existing_scalars.items():
                    actual_val = result.get(field)
                    self.assertEqual(
                        actual_val, expected_val,
                        f"Iteration {i}: scalar field '{field}' was overwritten. "
                        f"Expected {expected_val!r}, got {actual_val!r}"
                    )


if __name__ == "__main__":
    unittest.main()
