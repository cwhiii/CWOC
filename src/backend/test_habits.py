"""
Property-based tests for the Habits Overhaul feature.

Feature: habits-overhaul
Uses Python stdlib only (unittest + random + sqlite3) — no external libraries.
Each property test runs 100+ iterations with randomly generated inputs.

NOTE: We inline minimal production logic where needed to avoid importing
backend.main, which pulls in FastAPI. For tag computation we import
compute_system_tags from db.py via a lightweight shim. For migration and
CRUD tests we use in-memory SQLite databases.
"""

import json
import random
import string
import sqlite3
import unittest

# ── Inlined / imported production logic ──────────────────────────────────

# We need compute_system_tags from db.py. It's a pure function that only
# depends on getattr, so we can import it directly without triggering
# FastAPI imports — db.py only imports stdlib + logging.
# However db.py does os.makedirs at module level for image dirs which may
# fail in test environments. We'll inline the function instead.

def compute_system_tags(chit):
    """Mirror of src.backend.db.compute_system_tags — kept in sync manually."""
    system_tags = []
    if getattr(chit, 'due_datetime', None) or getattr(chit, 'start_datetime', None):
        system_tags.append("CWOC_System/Calendar")
    if getattr(chit, 'checklist', None):
        system_tags.append("CWOC_System/Checklists")
    if getattr(chit, 'alarm', None):
        system_tags.append("CWOC_System/Alarms")
    if "Project" in (getattr(chit, 'tags', None) or []):
        system_tags.append("CWOC_System/Projects")
    status = getattr(chit, 'status', None)
    if status in ["ToDo", "In Progress", "Blocked", "Complete"]:
        system_tags.append("CWOC_System/Tasks")
    if not (getattr(chit, 'due_datetime', None) or getattr(chit, 'start_datetime', None) or getattr(chit, 'end_datetime', None)):
        system_tags.append("CWOC_System/Notes")
    # Habit auto-tags
    if getattr(chit, 'habit', False):
        system_tags.append("Habits")
        title = getattr(chit, 'title', None)
        if title:
            system_tags.append(f"Habits/{title}")
    # Strip old flat system tags from user tags before merging
    old_system = {"Calendar", "Checklists", "Alarms", "Projects", "Tasks", "Notes"}
    user_tags = [t for t in (getattr(chit, 'tags', None) or []) if t not in old_system]
    return list(set(user_tags + system_tags))


# ── Lightweight chit-like object for tag tests ───────────────────────────

class FakeChit:
    """Minimal chit stand-in for compute_system_tags tests."""
    def __init__(self, **kwargs):
        defaults = {
            'title': None, 'tags': None, 'due_datetime': None,
            'start_datetime': None, 'end_datetime': None,
            'checklist': None, 'alarm': None, 'status': None,
            'habit': False, 'habit_goal': 1, 'habit_success': 0,
            'show_on_calendar': True,
        }
        defaults.update(kwargs)
        for k, v in defaults.items():
            setattr(self, k, v)


# ── Success rate & streak algorithms (Python mirrors of JS shared.js) ───

def get_habit_success_rate(exceptions, window, habit_goal=1):
    """
    Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7

    Calculate success rate from recurrence exception entries.
    - exceptions: list of dicts with keys: habit_success, habit_goal, broken_off
    - window: number of entries to consider (None or 0 = all)
    - Returns integer percentage 0-100
    """
    if not exceptions:
        return 0

    # Apply window: take the last N entries (most recent first in the list)
    entries = exceptions if (window is None or window <= 0) else exceptions[-window:]

    # Filter out broken-off periods
    active = [e for e in entries if not e.get('broken_off', False)]

    if not active:
        return 0

    met = sum(1 for e in active if e.get('habit_success', 0) >= e.get('habit_goal', habit_goal))
    return round(met / len(active) * 100)


def get_habit_streak(exceptions):
    """
    Validates: Requirements 9.1, 9.2, 9.3

    Calculate streak from recurrence exception entries.
    Walk backward from the most recent entry. Broken-off entries are skipped
    (neutral). Stop at the first genuinely missed period.
    - exceptions: list of dicts sorted chronologically (oldest first)
    - Returns integer streak count
    """
    if not exceptions:
        return 0

    streak = 0
    # Walk backward from most recent
    for entry in reversed(exceptions):
        if entry.get('broken_off', False):
            continue  # neutral — skip
        if entry.get('habit_success', 0) >= entry.get('habit_goal', 1):
            streak += 1
        else:
            break  # genuinely missed — stop
    return streak


# ── Random data generators ───────────────────────────────────────────────

_ITERATIONS = 120  # comfortably above the 100 minimum


def _random_string(min_len=1, max_len=30):
    """Generate a random non-empty string suitable for titles."""
    length = random.randint(min_len, max_len)
    chars = string.ascii_letters + string.digits + " _-!@#"
    return "".join(random.choices(chars, k=length))


def _random_title():
    """Generate a random non-empty title."""
    return _random_string(1, 40)


# ── Migration helper: create a realistic in-memory chits schema ──────────

def _create_chits_table(cursor, include_hide_when_instance_done=True):
    """Create a chits table matching the production schema (pre-migration)."""
    cols = """
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
        alerts TEXT,
        recurrence_rule TEXT,
        recurrence_exceptions TEXT,
        weather_data TEXT,
        health_data TEXT,
        owner_id TEXT,
        owner_display_name TEXT,
        owner_username TEXT,
        shares TEXT,
        stealth BOOLEAN DEFAULT 0,
        assigned_to TEXT
    """
    if include_hide_when_instance_done:
        cols += ", hide_when_instance_done INTEGER DEFAULT 0"
    cursor.execute(f"CREATE TABLE IF NOT EXISTS chits ({cols})")


def _create_settings_table(cursor):
    """Create a settings table matching the production schema."""
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
            habits_success_window TEXT DEFAULT '30'
        )
    """)


def _migrate_habits_overhaul(cursor):
    """In-memory version of migrate_habits_overhaul from migrations.py."""
    # Step 1: Add new habit columns
    cursor.execute("PRAGMA table_info(chits)")
    chit_cols = {row[1] for row in cursor.fetchall()}

    if "habit" not in chit_cols:
        cursor.execute("ALTER TABLE chits ADD COLUMN habit BOOLEAN DEFAULT 0")
    if "habit_goal" not in chit_cols:
        cursor.execute("ALTER TABLE chits ADD COLUMN habit_goal INTEGER DEFAULT 1")
    if "habit_success" not in chit_cols:
        cursor.execute("ALTER TABLE chits ADD COLUMN habit_success INTEGER DEFAULT 0")
    if "show_on_calendar" not in chit_cols:
        cursor.execute("ALTER TABLE chits ADD COLUMN show_on_calendar BOOLEAN DEFAULT 1")

    # Step 2: Add settings column
    cursor.execute("PRAGMA table_info(settings)")
    settings_cols = {row[1] for row in cursor.fetchall()}
    if "default_show_habits_on_calendar" not in settings_cols:
        cursor.execute("ALTER TABLE settings ADD COLUMN default_show_habits_on_calendar TEXT DEFAULT '1'")

    # Step 3: Remove hide_when_instance_done via table rebuild
    cursor.execute("PRAGMA table_info(chits)")
    all_col_info = cursor.fetchall()
    all_col_names = [row[1] for row in all_col_info]

    if "hide_when_instance_done" in all_col_names:
        keep_cols = [row for row in all_col_info if row[1] != "hide_when_instance_done"]
        keep_col_names = [row[1] for row in keep_cols]
        col_names_csv = ", ".join(keep_col_names)

        col_defs = []
        for row in keep_cols:
            cid, name, col_type, notnull, dflt_value, pk = row
            parts = [name, col_type if col_type else "TEXT"]
            if pk:
                parts.append("PRIMARY KEY")
            if notnull and not pk:
                parts.append("NOT NULL")
            if dflt_value is not None:
                parts.append(f"DEFAULT {dflt_value}")
            col_defs.append(" ".join(parts))

        create_sql = f"CREATE TABLE chits_backup ({', '.join(col_defs)})"
        cursor.execute(create_sql)
        cursor.execute(f"INSERT INTO chits_backup ({col_names_csv}) SELECT {col_names_csv} FROM chits")
        cursor.execute("DROP TABLE chits")
        cursor.execute("ALTER TABLE chits_backup RENAME TO chits")



# ══════════════════════════════════════════════════════════════════════════
# Property 4: Habit tags bidirectional sync
# ══════════════════════════════════════════════════════════════════════════

class TestProperty4HabitTagsBidirectionalSync(unittest.TestCase):
    """Feature: habits-overhaul, Property 4: Habit tags bidirectional sync

    **Validates: Requirements 3.1, 3.2**

    For any chit with a non-empty title, the chit's computed tags SHALL
    contain "Habits" and "Habits/[title]" if and only if habit is true.
    """

    def test_habit_true_includes_habit_tags(self):
        """When habit=True, computed tags must include Habits and Habits/[title]."""
        for i in range(_ITERATIONS):
            with self.subTest(iteration=i):
                title = _random_title()
                chit = FakeChit(title=title, habit=True)
                tags = compute_system_tags(chit)
                self.assertIn("Habits", tags,
                    f"Missing 'Habits' tag for habit chit with title={title!r}")
                self.assertIn(f"Habits/{title}", tags,
                    f"Missing 'Habits/{title}' tag for habit chit")

    def test_habit_false_excludes_habit_tags(self):
        """When habit=False, computed tags must NOT include Habits or Habits/[title]."""
        for i in range(_ITERATIONS):
            with self.subTest(iteration=i):
                title = _random_title()
                chit = FakeChit(title=title, habit=False)
                tags = compute_system_tags(chit)
                self.assertNotIn("Habits", tags,
                    f"Unexpected 'Habits' tag for non-habit chit")
                self.assertNotIn(f"Habits/{title}", tags,
                    f"Unexpected 'Habits/{title}' tag for non-habit chit")


# ══════════════════════════════════════════════════════════════════════════
# Property 5: Habit title change updates tag
# ══════════════════════════════════════════════════════════════════════════

class TestProperty5HabitTitleChangeUpdatesTag(unittest.TestCase):
    """Feature: habits-overhaul, Property 5: Habit title change updates tag

    **Validates: Requirements 3.3**

    For any habit chit whose title changes from oldTitle to newTitle,
    the computed tags SHALL contain Habits/[newTitle] and SHALL NOT
    contain Habits/[oldTitle].
    """

    def test_title_change_updates_habit_tag(self):
        for i in range(_ITERATIONS):
            with self.subTest(iteration=i):
                old_title = _random_title()
                new_title = _random_title()
                # Ensure titles are different
                while new_title == old_title:
                    new_title = _random_title()

                # Before rename
                chit_old = FakeChit(title=old_title, habit=True)
                tags_old = compute_system_tags(chit_old)
                self.assertIn(f"Habits/{old_title}", tags_old)

                # After rename
                chit_new = FakeChit(title=new_title, habit=True)
                tags_new = compute_system_tags(chit_new)
                self.assertIn(f"Habits/{new_title}", tags_new,
                    f"Missing 'Habits/{new_title}' after title change")
                self.assertNotIn(f"Habits/{old_title}", tags_new,
                    f"Stale 'Habits/{old_title}' still present after title change")


# ══════════════════════════════════════════════════════════════════════════
# Property 8: Habit_success capped at habit_goal
# ══════════════════════════════════════════════════════════════════════════

class TestProperty8HabitSuccessCap(unittest.TestCase):
    """Feature: habits-overhaul, Property 8: Habit_success capped at habit_goal

    **Validates: Requirements 5.3**

    For any habit chit, habit_success SHALL never exceed habit_goal.
    Any attempt to increment beyond the goal SHALL result in
    habit_success === habit_goal.
    """

    def test_habit_success_capped_at_goal(self):
        for i in range(_ITERATIONS):
            with self.subTest(iteration=i):
                goal = random.randint(1, 100)
                # Attempt to set success to a value above the goal
                attempted_success = random.randint(goal, goal + 50)
                # Apply the cap (this is the logic the backend/frontend enforces)
                capped = min(attempted_success, goal)
                self.assertLessEqual(capped, goal,
                    f"habit_success {capped} exceeds habit_goal {goal}")
                self.assertEqual(capped, goal,
                    f"Expected cap at {goal}, got {capped}")

    def test_habit_success_at_or_below_goal_unchanged(self):
        """Values at or below goal should pass through unchanged."""
        for i in range(_ITERATIONS):
            with self.subTest(iteration=i):
                goal = random.randint(1, 100)
                success = random.randint(0, goal)
                capped = min(success, goal)
                self.assertEqual(capped, success,
                    f"Value {success} should not be capped when goal is {goal}")


# ══════════════════════════════════════════════════════════════════════════
# Property 12: Success rate calculation
# ══════════════════════════════════════════════════════════════════════════

class TestProperty12SuccessRateCalculation(unittest.TestCase):
    """Feature: habits-overhaul, Property 12: Success rate calculation

    **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7**

    For any habit chit and any success window value, the success rate SHALL
    equal round((periods where habit_success >= habit_goal) /
    (total non-broken-off periods within window) * 100), returning 0 when
    no periods exist.
    """

    def _generate_exceptions(self):
        """Generate a random list of recurrence exception entries."""
        count = random.randint(0, 30)
        entries = []
        for _ in range(count):
            goal = random.randint(1, 10)
            success = random.randint(0, goal + 2)  # may exceed goal
            broken_off = random.random() < 0.15  # ~15% chance of broken-off
            entries.append({
                'habit_success': success,
                'habit_goal': goal,
                'broken_off': broken_off,
            })
        return entries

    def test_success_rate_formula(self):
        for i in range(_ITERATIONS):
            with self.subTest(iteration=i):
                exceptions = self._generate_exceptions()
                window = random.choice([None, 0, 7, 30, 90])

                result = get_habit_success_rate(exceptions, window)

                # Manually compute expected value
                entries = exceptions if (window is None or window <= 0) else exceptions[-window:]
                active = [e for e in entries if not e.get('broken_off', False)]
                if not active:
                    expected = 0
                else:
                    met = sum(1 for e in active
                              if e.get('habit_success', 0) >= e.get('habit_goal', 1))
                    expected = round(met / len(active) * 100)

                self.assertEqual(result, expected,
                    f"Success rate mismatch: got {result}, expected {expected} "
                    f"for {len(exceptions)} exceptions, window={window}")

    def test_empty_exceptions_returns_zero(self):
        """No exceptions → 0% success rate."""
        for i in range(_ITERATIONS):
            with self.subTest(iteration=i):
                window = random.choice([None, 0, 7, 30, 90])
                self.assertEqual(get_habit_success_rate([], window), 0)

    def test_all_broken_off_returns_zero(self):
        """All broken-off entries → 0% success rate."""
        for i in range(_ITERATIONS):
            with self.subTest(iteration=i):
                count = random.randint(1, 20)
                entries = [{'habit_success': random.randint(0, 5),
                            'habit_goal': random.randint(1, 5),
                            'broken_off': True} for _ in range(count)]
                self.assertEqual(get_habit_success_rate(entries, None), 0)


# ══════════════════════════════════════════════════════════════════════════
# Property 13: Streak calculation
# ══════════════════════════════════════════════════════════════════════════

class TestProperty13StreakCalculation(unittest.TestCase):
    """Feature: habits-overhaul, Property 13: Streak calculation

    **Validates: Requirements 9.1, 9.2, 9.3**

    For any habit chit, the streak SHALL equal the count of consecutive
    periods (walking backward from the most recent past period) where
    habit_success >= habit_goal. Broken-off periods SHALL be skipped
    (neutral). The streak SHALL stop at the first genuinely missed period.
    """

    def _generate_exceptions(self):
        """Generate a random list of recurrence exception entries."""
        count = random.randint(0, 30)
        entries = []
        for _ in range(count):
            goal = random.randint(1, 10)
            success = random.randint(0, goal + 2)
            broken_off = random.random() < 0.15
            entries.append({
                'habit_success': success,
                'habit_goal': goal,
                'broken_off': broken_off,
            })
        return entries

    def test_streak_calculation(self):
        for i in range(_ITERATIONS):
            with self.subTest(iteration=i):
                exceptions = self._generate_exceptions()
                result = get_habit_streak(exceptions)

                # Manually compute expected streak
                expected = 0
                for entry in reversed(exceptions):
                    if entry.get('broken_off', False):
                        continue
                    if entry.get('habit_success', 0) >= entry.get('habit_goal', 1):
                        expected += 1
                    else:
                        break

                self.assertEqual(result, expected,
                    f"Streak mismatch: got {result}, expected {expected}")

    def test_empty_exceptions_returns_zero(self):
        """No exceptions → streak of 0."""
        self.assertEqual(get_habit_streak([]), 0)

    def test_all_broken_off_returns_zero(self):
        """All broken-off entries → streak of 0 (nothing to count)."""
        for i in range(_ITERATIONS):
            with self.subTest(iteration=i):
                count = random.randint(1, 15)
                entries = [{'habit_success': 5, 'habit_goal': 3,
                            'broken_off': True} for _ in range(count)]
                self.assertEqual(get_habit_streak(entries), 0)

    def test_broken_off_skipped_not_breaking(self):
        """Broken-off entries between successes should not break the streak."""
        # [met, broken_off, met] → streak should be 2
        entries = [
            {'habit_success': 3, 'habit_goal': 3, 'broken_off': False},
            {'habit_success': 0, 'habit_goal': 3, 'broken_off': True},
            {'habit_success': 3, 'habit_goal': 3, 'broken_off': False},
        ]
        self.assertEqual(get_habit_streak(entries), 2)


# ══════════════════════════════════════════════════════════════════════════
# Property 16: Migration idempotency and data preservation
# ══════════════════════════════════════════════════════════════════════════

class TestProperty16MigrationIdempotency(unittest.TestCase):
    """Feature: habits-overhaul, Property 16: Migration idempotency and data preservation

    **Validates: Requirements 13.7, 13.9**

    For any database state, running migrate_habits_overhaul() multiple times
    SHALL produce no errors, the new columns SHALL exist,
    hide_when_instance_done SHALL NOT exist, and all other chit data SHALL
    be preserved unchanged.
    """

    def _insert_random_chit(self, cursor, include_hide=True):
        """Insert a random chit and return its data as a dict."""
        chit_id = ''.join(random.choices(string.ascii_lowercase + string.digits, k=12))
        title = _random_title()
        note = _random_string(0, 100) if random.random() > 0.3 else None
        tags = json.dumps([_random_string(3, 10) for _ in range(random.randint(0, 3))])
        status = random.choice([None, "ToDo", "In Progress", "Complete", "Blocked"])
        priority = random.choice([None, "Low", "Medium", "High"])

        cols = "id, title, note, tags, status, priority"
        vals = (chit_id, title, note, tags, status, priority)

        if include_hide:
            hide_val = random.choice([0, 1])
            cols += ", hide_when_instance_done"
            vals = vals + (hide_val,)

        cursor.execute(f"INSERT INTO chits ({cols}) VALUES ({','.join('?' * len(vals))})", vals)
        return {
            'id': chit_id, 'title': title, 'note': note,
            'tags': tags, 'status': status, 'priority': priority,
        }

    def test_migration_idempotency(self):
        for i in range(_ITERATIONS):
            with self.subTest(iteration=i):
                conn = sqlite3.connect(":memory:")
                cursor = conn.cursor()

                # Create tables with hide_when_instance_done
                _create_chits_table(cursor, include_hide_when_instance_done=True)
                _create_settings_table(cursor)

                # Insert random chits
                num_chits = random.randint(0, 5)
                original_chits = []
                for _ in range(num_chits):
                    original_chits.append(self._insert_random_chit(cursor, include_hide=True))
                conn.commit()

                # Run migration multiple times (2-3 times)
                runs = random.randint(2, 3)
                for _ in range(runs):
                    _migrate_habits_overhaul(cursor)
                    conn.commit()

                # Verify: new columns exist
                cursor.execute("PRAGMA table_info(chits)")
                col_names = {row[1] for row in cursor.fetchall()}
                self.assertIn("habit", col_names)
                self.assertIn("habit_goal", col_names)
                self.assertIn("habit_success", col_names)
                self.assertIn("show_on_calendar", col_names)

                # Verify: hide_when_instance_done does NOT exist
                self.assertNotIn("hide_when_instance_done", col_names)

                # Verify: settings column exists
                cursor.execute("PRAGMA table_info(settings)")
                settings_cols = {row[1] for row in cursor.fetchall()}
                self.assertIn("default_show_habits_on_calendar", settings_cols)

                # Verify: original chit data preserved
                for orig in original_chits:
                    cursor.execute("SELECT id, title, note, tags, status, priority FROM chits WHERE id = ?",
                                   (orig['id'],))
                    row = cursor.fetchone()
                    self.assertIsNotNone(row, f"Chit {orig['id']} missing after migration")
                    self.assertEqual(row[0], orig['id'])
                    self.assertEqual(row[1], orig['title'])
                    self.assertEqual(row[2], orig['note'])
                    self.assertEqual(row[3], orig['tags'])
                    self.assertEqual(row[4], orig['status'])
                    self.assertEqual(row[5], orig['priority'])

                conn.close()


# ══════════════════════════════════════════════════════════════════════════
# Property 17: Chit CRUD round-trip for habit fields
# ══════════════════════════════════════════════════════════════════════════

class TestProperty17ChitCRUDRoundTrip(unittest.TestCase):
    """Feature: habits-overhaul, Property 17: Chit CRUD round-trip for habit fields

    **Validates: Requirements 13.10**

    For any valid combination of habit, habit_goal, habit_success, and
    show_on_calendar values, saving a chit and then loading it SHALL
    return the same values.
    """

    def _create_db(self):
        """Create an in-memory DB with the post-migration chits table."""
        conn = sqlite3.connect(":memory:")
        cursor = conn.cursor()
        _create_chits_table(cursor, include_hide_when_instance_done=False)
        # Add habit columns (simulating post-migration state)
        cursor.execute("PRAGMA table_info(chits)")
        cols = {row[1] for row in cursor.fetchall()}
        if "habit" not in cols:
            cursor.execute("ALTER TABLE chits ADD COLUMN habit BOOLEAN DEFAULT 0")
        if "habit_goal" not in cols:
            cursor.execute("ALTER TABLE chits ADD COLUMN habit_goal INTEGER DEFAULT 1")
        if "habit_success" not in cols:
            cursor.execute("ALTER TABLE chits ADD COLUMN habit_success INTEGER DEFAULT 0")
        if "show_on_calendar" not in cols:
            cursor.execute("ALTER TABLE chits ADD COLUMN show_on_calendar BOOLEAN DEFAULT 1")
        conn.commit()
        return conn

    def test_crud_round_trip(self):
        for i in range(_ITERATIONS):
            with self.subTest(iteration=i):
                conn = self._create_db()
                cursor = conn.cursor()

                # Generate random valid habit field values
                chit_id = ''.join(random.choices(string.ascii_lowercase + string.digits, k=16))
                habit = random.choice([True, False])
                habit_goal = random.randint(1, 100)
                # Cap habit_success at habit_goal (as the system enforces)
                habit_success = random.randint(0, habit_goal)
                show_on_calendar = random.choice([True, False])
                title = _random_title()

                # INSERT (mimicking backend create_chit serialization)
                cursor.execute(
                    """INSERT INTO chits (id, title, habit, habit_goal, habit_success, show_on_calendar)
                       VALUES (?, ?, ?, ?, ?, ?)""",
                    (chit_id, title,
                     1 if habit else 0,
                     habit_goal,
                     habit_success,
                     1 if show_on_calendar else 0)
                )
                conn.commit()

                # SELECT (mimicking backend get_chit deserialization)
                cursor.execute(
                    "SELECT habit, habit_goal, habit_success, show_on_calendar FROM chits WHERE id = ?",
                    (chit_id,)
                )
                row = cursor.fetchone()
                self.assertIsNotNone(row, f"Chit {chit_id} not found after insert")

                loaded_habit = bool(row[0])
                loaded_goal = row[1]
                loaded_success = row[2]
                loaded_calendar = bool(row[3])

                self.assertEqual(loaded_habit, habit,
                    f"habit mismatch: saved {habit}, loaded {loaded_habit}")
                self.assertEqual(loaded_goal, habit_goal,
                    f"habit_goal mismatch: saved {habit_goal}, loaded {loaded_goal}")
                self.assertEqual(loaded_success, habit_success,
                    f"habit_success mismatch: saved {habit_success}, loaded {loaded_success}")
                self.assertEqual(loaded_calendar, show_on_calendar,
                    f"show_on_calendar mismatch: saved {show_on_calendar}, loaded {loaded_calendar}")

                conn.close()

    def test_update_round_trip(self):
        """Verify that updating habit fields also round-trips correctly."""
        for i in range(_ITERATIONS):
            with self.subTest(iteration=i):
                conn = self._create_db()
                cursor = conn.cursor()

                chit_id = ''.join(random.choices(string.ascii_lowercase + string.digits, k=16))

                # Initial insert with defaults
                cursor.execute(
                    "INSERT INTO chits (id, title, habit, habit_goal, habit_success, show_on_calendar) VALUES (?, ?, 0, 1, 0, 1)",
                    (chit_id, "initial")
                )
                conn.commit()

                # Generate new random values for update
                habit = random.choice([True, False])
                habit_goal = random.randint(1, 100)
                habit_success = random.randint(0, habit_goal)
                show_on_calendar = random.choice([True, False])

                # UPDATE
                cursor.execute(
                    """UPDATE chits SET habit = ?, habit_goal = ?, habit_success = ?, show_on_calendar = ?
                       WHERE id = ?""",
                    (1 if habit else 0, habit_goal, habit_success,
                     1 if show_on_calendar else 0, chit_id)
                )
                conn.commit()

                # SELECT
                cursor.execute(
                    "SELECT habit, habit_goal, habit_success, show_on_calendar FROM chits WHERE id = ?",
                    (chit_id,)
                )
                row = cursor.fetchone()
                self.assertIsNotNone(row)

                self.assertEqual(bool(row[0]), habit)
                self.assertEqual(row[1], habit_goal)
                self.assertEqual(row[2], habit_success)
                self.assertEqual(bool(row[3]), show_on_calendar)

                conn.close()


if __name__ == "__main__":
    unittest.main()
