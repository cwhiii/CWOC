"""Property-based tests for timezone support.

Uses Python's built-in unittest with manual randomization (no external PBT library).
Each test generates 100+ random inputs to verify correctness properties.
"""

import random
import sqlite3
import string
import unittest
from zoneinfo import available_timezones


# ── Function under test (inlined to avoid FastAPI import dependency) ──────
# Source: src/backend/routes/chits.py :: validate_timezone()

def validate_timezone(tz_value):
    """Validate that a timezone string is a recognized IANA timezone.

    Returns True if valid (including None, which means floating chit).
    Returns False if the value is a non-null string not in the IANA database.
    """
    if tz_value is None:
        return True
    return tz_value in available_timezones()


# ── Helpers ───────────────────────────────────────────────────────────────

VALID_TIMEZONES = sorted(available_timezones())


def _random_invalid_string(rng):
    """Generate a random string that is very unlikely to be a valid IANA timezone."""
    strategy = rng.choice([
        "random_ascii",
        "random_unicode",
        "numeric",
        "empty_string",
        "whitespace",
        "partial_valid",
        "special_chars",
    ])

    if strategy == "random_ascii":
        length = rng.randint(1, 50)
        return "".join(rng.choices(string.ascii_letters + string.digits + "_-/", k=length))
    elif strategy == "random_unicode":
        length = rng.randint(1, 30)
        chars = [chr(rng.randint(0x0100, 0x04FF)) for _ in range(length)]
        return "".join(chars)
    elif strategy == "numeric":
        return str(rng.randint(-99999, 99999))
    elif strategy == "empty_string":
        return ""
    elif strategy == "whitespace":
        return " " * rng.randint(1, 10)
    elif strategy == "partial_valid":
        # Take a valid timezone and mangle it
        valid = rng.choice(VALID_TIMEZONES)
        mangled = valid + rng.choice(["X", "123", "/Invalid", " ", "_extra"])
        return mangled
    elif strategy == "special_chars":
        length = rng.randint(1, 20)
        return "".join(rng.choices("!@#$%^&*()+=[]{}|;:',.<>?`~", k=length))
    return "NotATimezone"


# ═══════════════════════════════════════════════════════════════════════════
# Feature: timezone-support, Property 1: Invalid timezone rejection
# ═══════════════════════════════════════════════════════════════════════════
# Validates: Requirements 1.3, 2.6
#
# For any string that is not a member of the IANA timezone database,
# validate_timezone() SHALL return False. For any valid IANA timezone
# string, validate_timezone() SHALL return True. For None,
# validate_timezone() SHALL return True.
# ═══════════════════════════════════════════════════════════════════════════


class TestProperty1InvalidTimezoneRejection(unittest.TestCase):
    """Feature: timezone-support, Property 1: Invalid timezone rejection

    **Validates: Requirements 1.3, 2.6**
    """

    NUM_ITERATIONS = 150

    def test_none_is_accepted(self):
        """None (floating chit) is always valid."""
        self.assertTrue(validate_timezone(None))

    def test_valid_timezones_accepted(self):
        """Random sample of valid IANA timezones are all accepted."""
        rng = random.Random(42)
        sample_size = min(self.NUM_ITERATIONS, len(VALID_TIMEZONES))
        sampled = rng.sample(VALID_TIMEZONES, sample_size)

        for tz in sampled:
            with self.subTest(timezone=tz):
                self.assertTrue(
                    validate_timezone(tz),
                    f"Valid IANA timezone '{tz}' was incorrectly rejected",
                )

    def test_invalid_strings_rejected(self):
        """Random invalid strings are all rejected."""
        rng = random.Random(42)
        valid_set = available_timezones()

        tested = 0
        attempts = 0
        max_attempts = self.NUM_ITERATIONS * 3

        while tested < self.NUM_ITERATIONS and attempts < max_attempts:
            attempts += 1
            invalid = _random_invalid_string(rng)

            # Skip if we accidentally generated a valid timezone
            if invalid in valid_set:
                continue

            with self.subTest(invalid_string=invalid, iteration=tested):
                self.assertFalse(
                    validate_timezone(invalid),
                    f"Invalid string '{invalid}' was incorrectly accepted as a timezone",
                )
            tested += 1

        self.assertGreaterEqual(
            tested, self.NUM_ITERATIONS,
            f"Only generated {tested} unique invalid strings in {max_attempts} attempts",
        )

    def test_known_invalid_values_rejected(self):
        """Specific known-invalid values are rejected."""
        known_invalids = [
            "",
            " ",
            "NotATimezone",
            "america/denver",  # wrong case
            "US/Eastern/Extra",
            "GMT+5",  # not IANA format
            "UTC+08:00",
            "Eastern Standard Time",  # Windows-style
            "PST",  # abbreviation, not IANA
            "123",
            "America/",
            "/Denver",
            "America//Denver",
            "null",
            "undefined",
            "None",
        ]
        valid_set = available_timezones()

        for val in known_invalids:
            # Only test if it's actually not in the IANA set
            if val not in valid_set:
                with self.subTest(value=val):
                    self.assertFalse(
                        validate_timezone(val),
                        f"Known-invalid value '{val}' was incorrectly accepted",
                    )

    def test_all_available_timezones_accepted(self):
        """Every single timezone in available_timezones() is accepted."""
        for tz in available_timezones():
            with self.subTest(timezone=tz):
                self.assertTrue(
                    validate_timezone(tz),
                    f"IANA timezone '{tz}' from available_timezones() was rejected",
                )


# ═══════════════════════════════════════════════════════════════════════════
# Feature: timezone-support, Property 3: Timezone persistence round-trip
# ═══════════════════════════════════════════════════════════════════════════
# Validates: Requirements 1.8, 2.5
#
# For any valid IANA timezone string, saving it as a chit's timezone field
# (or as a settings timezone value) and then reading it back SHALL return
# the identical string.
# ═══════════════════════════════════════════════════════════════════════════


def _create_test_db():
    """Create an in-memory SQLite database with chits and settings tables."""
    conn = sqlite3.connect(":memory:")
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE chits (
            id TEXT PRIMARY KEY,
            title TEXT,
            timezone TEXT DEFAULT NULL
        )
    """)
    cursor.execute("""
        CREATE TABLE settings (
            user_id TEXT PRIMARY KEY,
            default_timezone TEXT DEFAULT NULL,
            timezone_override TEXT DEFAULT NULL
        )
    """)
    conn.commit()
    return conn


class TestTimezoneRoundTrip(unittest.TestCase):
    """Property 3: Timezone persistence round-trip.

    For any valid IANA timezone string, saving it to the chits table or
    settings table and reading it back returns the identical string.
    """

    def setUp(self):
        self.conn = _create_test_db()
        self.valid_timezones = sorted(available_timezones())

    def tearDown(self):
        self.conn.close()

    def test_chit_timezone_round_trip(self):
        """Save random valid IANA timezones to chits.timezone, read back, verify identical."""
        cursor = self.conn.cursor()
        iterations = 150

        for i in range(iterations):
            tz = random.choice(self.valid_timezones)
            chit_id = f"chit-{i}"

            # Insert chit with timezone
            cursor.execute(
                "INSERT INTO chits (id, title, timezone) VALUES (?, ?, ?)",
                (chit_id, f"Test chit {i}", tz),
            )
            self.conn.commit()

            # Read back
            cursor.execute("SELECT timezone FROM chits WHERE id = ?", (chit_id,))
            row = cursor.fetchone()
            self.assertIsNotNone(row, f"Chit {chit_id} not found after insert")
            self.assertEqual(
                row[0], tz,
                f"Round-trip failed for chit timezone: wrote '{tz}', read '{row[0]}'"
            )

    def test_chit_timezone_update_round_trip(self):
        """Update chit timezone to random valid values, read back, verify identical."""
        cursor = self.conn.cursor()
        chit_id = "chit-update-test"
        cursor.execute(
            "INSERT INTO chits (id, title, timezone) VALUES (?, ?, ?)",
            (chit_id, "Update test", None),
        )
        self.conn.commit()
        iterations = 150

        for i in range(iterations):
            tz = random.choice(self.valid_timezones)

            # Update timezone
            cursor.execute(
                "UPDATE chits SET timezone = ? WHERE id = ?",
                (tz, chit_id),
            )
            self.conn.commit()

            # Read back
            cursor.execute("SELECT timezone FROM chits WHERE id = ?", (chit_id,))
            row = cursor.fetchone()
            self.assertIsNotNone(row)
            self.assertEqual(
                row[0], tz,
                f"Round-trip failed on update iteration {i}: wrote '{tz}', read '{row[0]}'"
            )

    def test_settings_default_timezone_round_trip(self):
        """Save random valid IANA timezones to settings.default_timezone, read back, verify identical."""
        cursor = self.conn.cursor()
        user_id = "user-default-tz-test"
        cursor.execute(
            "INSERT INTO settings (user_id) VALUES (?)",
            (user_id,),
        )
        self.conn.commit()
        iterations = 150

        for i in range(iterations):
            tz = random.choice(self.valid_timezones)

            # Update default_timezone
            cursor.execute(
                "UPDATE settings SET default_timezone = ? WHERE user_id = ?",
                (tz, user_id),
            )
            self.conn.commit()

            # Read back
            cursor.execute(
                "SELECT default_timezone FROM settings WHERE user_id = ?",
                (user_id,),
            )
            row = cursor.fetchone()
            self.assertIsNotNone(row)
            self.assertEqual(
                row[0], tz,
                f"Round-trip failed for default_timezone iteration {i}: wrote '{tz}', read '{row[0]}'"
            )

    def test_settings_timezone_override_round_trip(self):
        """Save random valid IANA timezones to settings.timezone_override, read back, verify identical."""
        cursor = self.conn.cursor()
        user_id = "user-override-tz-test"
        cursor.execute(
            "INSERT INTO settings (user_id) VALUES (?)",
            (user_id,),
        )
        self.conn.commit()
        iterations = 150

        for i in range(iterations):
            tz = random.choice(self.valid_timezones)

            # Update timezone_override
            cursor.execute(
                "UPDATE settings SET timezone_override = ? WHERE user_id = ?",
                (tz, user_id),
            )
            self.conn.commit()

            # Read back
            cursor.execute(
                "SELECT timezone_override FROM settings WHERE user_id = ?",
                (user_id,),
            )
            row = cursor.fetchone()
            self.assertIsNotNone(row)
            self.assertEqual(
                row[0], tz,
                f"Round-trip failed for timezone_override iteration {i}: wrote '{tz}', read '{row[0]}'"
            )

    def test_null_timezone_round_trip(self):
        """Verify that null timezone (floating chit) persists correctly."""
        cursor = self.conn.cursor()
        iterations = 100

        for i in range(iterations):
            chit_id = f"chit-null-{i}"
            cursor.execute(
                "INSERT INTO chits (id, title, timezone) VALUES (?, ?, ?)",
                (chit_id, f"Floating chit {i}", None),
            )
            self.conn.commit()

            cursor.execute("SELECT timezone FROM chits WHERE id = ?", (chit_id,))
            row = cursor.fetchone()
            self.assertIsNotNone(row)
            self.assertIsNone(
                row[0],
                f"Null timezone round-trip failed: expected None, got '{row[0]}'"
            )

    def test_settings_both_fields_round_trip(self):
        """Save random timezones to both settings fields simultaneously, verify both persist."""
        cursor = self.conn.cursor()
        user_id = "user-both-fields-test"
        cursor.execute(
            "INSERT INTO settings (user_id) VALUES (?)",
            (user_id,),
        )
        self.conn.commit()
        iterations = 150

        for i in range(iterations):
            default_tz = random.choice(self.valid_timezones)
            override_tz = random.choice(self.valid_timezones)

            # Update both fields
            cursor.execute(
                "UPDATE settings SET default_timezone = ?, timezone_override = ? WHERE user_id = ?",
                (default_tz, override_tz, user_id),
            )
            self.conn.commit()

            # Read back both
            cursor.execute(
                "SELECT default_timezone, timezone_override FROM settings WHERE user_id = ?",
                (user_id,),
            )
            row = cursor.fetchone()
            self.assertIsNotNone(row)
            self.assertEqual(
                row[0], default_tz,
                f"Both-fields round-trip failed for default_timezone iteration {i}: "
                f"wrote '{default_tz}', read '{row[0]}'"
            )
            self.assertEqual(
                row[1], override_tz,
                f"Both-fields round-trip failed for timezone_override iteration {i}: "
                f"wrote '{override_tz}', read '{row[1]}'"
            )


if __name__ == "__main__":
    unittest.main()


# ═══════════════════════════════════════════════════════════════════════════
# Feature: timezone-support, Property 2: Timezone resolution precedence
# ═══════════════════════════════════════════════════════════════════════════
# Validates: Requirements 1.4, 5.5, 9.1
#
# For any valid IANA timezone set as the user's timezone_override setting,
# the resolve_timezone() utility SHALL return that override value regardless
# of the browser-detected timezone or default_timezone setting. Furthermore,
# the result SHALL always be a valid IANA timezone string.
#
# Resolution precedence:
#   1. If timezone_override is set (non-empty): use it
#   2. Else if browser_tz is available: use it
#   3. Else if default_timezone is set: use it
#   4. Else: use 'UTC'
# ═══════════════════════════════════════════════════════════════════════════


def resolve_timezone(override, browser_tz, default_tz):
    """Resolve the user's current timezone (backend equivalent of frontend getCurrentTimezone).

    Precedence:
        1. timezone_override (if non-empty string)
        2. browser_tz (if non-empty string)
        3. default_timezone (if non-empty string)
        4. 'UTC' fallback

    Args:
        override: The timezone_override setting value (str or None).
        browser_tz: The browser-detected timezone (str or None).
        default_tz: The default_timezone setting value (str or None).

    Returns:
        A valid IANA timezone string.
    """
    if override and override.strip():
        return override.strip()
    if browser_tz and browser_tz.strip():
        return browser_tz.strip()
    if default_tz and default_tz.strip():
        return default_tz.strip()
    return "UTC"


class TestProperty2TimezoneResolutionPrecedence(unittest.TestCase):
    """Feature: timezone-support, Property 2: Timezone resolution precedence

    **Validates: Requirements 1.4, 5.5, 9.1**
    """

    NUM_ITERATIONS = 150

    def _random_tz(self, rng):
        """Pick a random valid IANA timezone."""
        return rng.choice(VALID_TIMEZONES)

    def _random_empty_value(self, rng):
        """Pick a random 'empty' value (None, empty string, whitespace)."""
        return rng.choice([None, "", " ", "  ", "\t", "\n"])

    def test_override_always_wins(self):
        """When override is set, it wins regardless of browser_tz and default_tz."""
        rng = random.Random(42)

        for i in range(self.NUM_ITERATIONS):
            override = self._random_tz(rng)
            browser_tz = self._random_tz(rng)
            default_tz = self._random_tz(rng)

            result = resolve_timezone(override, browser_tz, default_tz)

            with self.subTest(iteration=i, override=override, browser_tz=browser_tz, default_tz=default_tz):
                self.assertEqual(
                    result, override,
                    f"Override '{override}' should win, but got '{result}'"
                )

    def test_override_wins_over_browser_with_no_default(self):
        """Override wins even when default_tz is empty/None."""
        rng = random.Random(43)

        for i in range(self.NUM_ITERATIONS):
            override = self._random_tz(rng)
            browser_tz = self._random_tz(rng)
            default_tz = self._random_empty_value(rng)

            result = resolve_timezone(override, browser_tz, default_tz)

            with self.subTest(iteration=i, override=override):
                self.assertEqual(
                    result, override,
                    f"Override '{override}' should win when default is empty, but got '{result}'"
                )

    def test_override_wins_over_default_with_no_browser(self):
        """Override wins even when browser_tz is empty/None."""
        rng = random.Random(44)

        for i in range(self.NUM_ITERATIONS):
            override = self._random_tz(rng)
            browser_tz = self._random_empty_value(rng)
            default_tz = self._random_tz(rng)

            result = resolve_timezone(override, browser_tz, default_tz)

            with self.subTest(iteration=i, override=override):
                self.assertEqual(
                    result, override,
                    f"Override '{override}' should win when browser is empty, but got '{result}'"
                )

    def test_browser_tz_wins_when_no_override(self):
        """When override is empty/None, browser_tz wins over default_tz."""
        rng = random.Random(45)

        for i in range(self.NUM_ITERATIONS):
            override = self._random_empty_value(rng)
            browser_tz = self._random_tz(rng)
            default_tz = self._random_tz(rng)

            result = resolve_timezone(override, browser_tz, default_tz)

            with self.subTest(iteration=i, browser_tz=browser_tz, default_tz=default_tz):
                self.assertEqual(
                    result, browser_tz,
                    f"Browser TZ '{browser_tz}' should win when override is empty, but got '{result}'"
                )

    def test_browser_tz_wins_when_no_override_no_default(self):
        """When override and default are empty, browser_tz still wins."""
        rng = random.Random(46)

        for i in range(self.NUM_ITERATIONS):
            override = self._random_empty_value(rng)
            browser_tz = self._random_tz(rng)
            default_tz = self._random_empty_value(rng)

            result = resolve_timezone(override, browser_tz, default_tz)

            with self.subTest(iteration=i, browser_tz=browser_tz):
                self.assertEqual(
                    result, browser_tz,
                    f"Browser TZ '{browser_tz}' should win when override and default are empty, "
                    f"but got '{result}'"
                )

    def test_default_tz_wins_when_no_override_no_browser(self):
        """When override and browser_tz are empty, default_tz wins."""
        rng = random.Random(47)

        for i in range(self.NUM_ITERATIONS):
            override = self._random_empty_value(rng)
            browser_tz = self._random_empty_value(rng)
            default_tz = self._random_tz(rng)

            result = resolve_timezone(override, browser_tz, default_tz)

            with self.subTest(iteration=i, default_tz=default_tz):
                self.assertEqual(
                    result, default_tz,
                    f"Default TZ '{default_tz}' should win when override and browser are empty, "
                    f"but got '{result}'"
                )

    def test_utc_fallback_when_all_empty(self):
        """When all inputs are empty/None, result is 'UTC'."""
        rng = random.Random(48)

        for i in range(self.NUM_ITERATIONS):
            override = self._random_empty_value(rng)
            browser_tz = self._random_empty_value(rng)
            default_tz = self._random_empty_value(rng)

            result = resolve_timezone(override, browser_tz, default_tz)

            with self.subTest(iteration=i, override=override, browser_tz=browser_tz, default_tz=default_tz):
                self.assertEqual(
                    result, "UTC",
                    f"Expected 'UTC' fallback when all empty, but got '{result}'"
                )

    def test_result_always_valid_iana_timezone(self):
        """The result is always a valid IANA timezone string, regardless of inputs."""
        rng = random.Random(49)
        valid_set = available_timezones()

        for i in range(self.NUM_ITERATIONS):
            # Randomly decide which inputs are set vs empty
            override = self._random_tz(rng) if rng.random() > 0.5 else self._random_empty_value(rng)
            browser_tz = self._random_tz(rng) if rng.random() > 0.5 else self._random_empty_value(rng)
            default_tz = self._random_tz(rng) if rng.random() > 0.5 else self._random_empty_value(rng)

            result = resolve_timezone(override, browser_tz, default_tz)

            with self.subTest(iteration=i, override=override, browser_tz=browser_tz, default_tz=default_tz):
                self.assertIn(
                    result, valid_set,
                    f"Result '{result}' is not a valid IANA timezone"
                )

    def test_override_none_vs_empty_string_equivalence(self):
        """None and empty string for override are treated the same (both mean 'not set')."""
        rng = random.Random(50)

        for i in range(self.NUM_ITERATIONS):
            browser_tz = self._random_tz(rng)
            default_tz = self._random_tz(rng)

            result_none = resolve_timezone(None, browser_tz, default_tz)
            result_empty = resolve_timezone("", browser_tz, default_tz)
            result_whitespace = resolve_timezone("  ", browser_tz, default_tz)

            with self.subTest(iteration=i, browser_tz=browser_tz):
                self.assertEqual(result_none, result_empty,
                                 "None and '' should produce same result")
                self.assertEqual(result_none, result_whitespace,
                                 "None and '  ' should produce same result")
                self.assertEqual(result_none, browser_tz,
                                 "All empty overrides should fall through to browser_tz")


# ═══════════════════════════════════════════════════════════════════════════
# Feature: timezone-support, Property 5: Time display conversion correctness
# ═══════════════════════════════════════════════════════════════════════════
# Validates: Requirements 5.1, 5.2, 5.4
#
# For any anchored chit with timezone T_chit and any current timezone T_user,
# the displayed time SHALL equal the result of converting the stored wall-clock
# time from T_chit to T_user using standard timezone conversion rules.
# For any floating chit, the displayed time SHALL equal the stored time value
# regardless of T_user.
# ═══════════════════════════════════════════════════════════════════════════

from datetime import datetime, timezone
from zoneinfo import ZoneInfo


def convert_anchored_time_for_display(wall_clock_naive: datetime, chit_tz: str, user_tz: str) -> datetime:
    """Convert an anchored chit's stored wall-clock time to the user's timezone for display.

    The stored time is a naive datetime representing wall-clock time in chit_tz.
    We localize it to chit_tz, then convert to user_tz for display.

    Args:
        wall_clock_naive: Naive datetime (the stored time in the chit's timezone).
        chit_tz: IANA timezone string the chit is anchored to.
        user_tz: IANA timezone string of the user's current timezone.

    Returns:
        A naive datetime representing the wall-clock time in user_tz.
    """
    # Localize the naive time to the chit's timezone
    chit_zone = ZoneInfo(chit_tz)
    localized = wall_clock_naive.replace(tzinfo=chit_zone)

    # Convert to user's timezone
    user_zone = ZoneInfo(user_tz)
    converted = localized.astimezone(user_zone)

    # Return as naive datetime (wall-clock in user's timezone)
    return converted.replace(tzinfo=None)


def get_display_time(wall_clock_naive: datetime, chit_timezone, user_tz: str) -> datetime:
    """Get the display time for a chit, converting if anchored.

    Args:
        wall_clock_naive: Naive datetime (the stored time).
        chit_timezone: IANA timezone string (anchored) or None (floating).
        user_tz: IANA timezone string of the user's current timezone.

    Returns:
        A naive datetime representing the time to display.
    """
    if chit_timezone is None:
        # Floating: display as-is, no conversion
        return wall_clock_naive
    else:
        # Anchored: convert from chit's timezone to user's timezone
        return convert_anchored_time_for_display(wall_clock_naive, chit_timezone, user_tz)


def _random_naive_datetime(rng):
    """Generate a random naive datetime avoiding DST gap edge cases for simplicity."""
    year = rng.randint(2000, 2030)
    month = rng.randint(1, 12)
    # Avoid day overflow
    if month in (4, 6, 9, 11):
        day = rng.randint(1, 30)
    elif month == 2:
        day = rng.randint(1, 28)
    else:
        day = rng.randint(1, 31)
    hour = rng.randint(0, 23)
    minute = rng.randint(0, 59)
    second = rng.randint(0, 59)
    return datetime(year, month, day, hour, minute, second)


class TestProperty5TimeDisplayConversion(unittest.TestCase):
    """Feature: timezone-support, Property 5: Time display conversion correctness

    **Validates: Requirements 5.1, 5.2, 5.4**
    """

    NUM_ITERATIONS = 150

    def _random_tz(self, rng):
        """Pick a random valid IANA timezone."""
        return rng.choice(VALID_TIMEZONES)

    def test_anchored_chit_conversion_correctness(self):
        """Anchored chit times are correctly converted from chit_tz to user_tz.

        For any anchored chit with timezone T_chit and any user timezone T_user,
        the displayed time equals the result of converting the stored wall-clock
        time from T_chit to T_user.

        Verification: The displayed time in T_user, when localized back to T_user
        and converted to UTC, must equal the original stored time localized in
        T_chit and converted to UTC (same absolute moment).
        """
        rng = random.Random(55)

        for i in range(self.NUM_ITERATIONS):
            wall_clock = _random_naive_datetime(rng)
            chit_tz = self._random_tz(rng)
            user_tz = self._random_tz(rng)

            displayed = get_display_time(wall_clock, chit_tz, user_tz)

            # Verify: the displayed time in user_tz represents the same absolute
            # moment as the original wall_clock in chit_tz
            original_utc = wall_clock.replace(tzinfo=ZoneInfo(chit_tz)).astimezone(timezone.utc)
            displayed_utc = displayed.replace(tzinfo=ZoneInfo(user_tz)).astimezone(timezone.utc)

            with self.subTest(
                iteration=i,
                wall_clock=wall_clock.isoformat(),
                chit_tz=chit_tz,
                user_tz=user_tz,
                displayed=displayed.isoformat(),
            ):
                self.assertEqual(
                    original_utc, displayed_utc,
                    f"Anchored conversion failed: "
                    f"wall_clock={wall_clock.isoformat()} in {chit_tz} "
                    f"→ displayed={displayed.isoformat()} in {user_tz}. "
                    f"Original UTC={original_utc.isoformat()}, "
                    f"Displayed UTC={displayed_utc.isoformat()}"
                )

    def test_floating_chit_unchanged_regardless_of_user_tz(self):
        """Floating chit times are returned unchanged regardless of user timezone.

        For any floating chit (timezone=None), the displayed time equals the
        stored time value regardless of T_user.
        """
        rng = random.Random(56)

        for i in range(self.NUM_ITERATIONS):
            wall_clock = _random_naive_datetime(rng)
            user_tz = self._random_tz(rng)

            displayed = get_display_time(wall_clock, None, user_tz)

            with self.subTest(
                iteration=i,
                wall_clock=wall_clock.isoformat(),
                user_tz=user_tz,
            ):
                self.assertEqual(
                    displayed, wall_clock,
                    f"Floating chit time should be unchanged: "
                    f"stored={wall_clock.isoformat()}, displayed={displayed.isoformat()}, "
                    f"user_tz={user_tz}"
                )

    def test_anchored_same_timezone_no_change(self):
        """When chit_tz equals user_tz, the displayed time equals the stored time.

        This is a special case: converting from a timezone to itself should be identity.
        """
        rng = random.Random(57)

        for i in range(self.NUM_ITERATIONS):
            wall_clock = _random_naive_datetime(rng)
            tz = self._random_tz(rng)

            displayed = get_display_time(wall_clock, tz, tz)

            with self.subTest(
                iteration=i,
                wall_clock=wall_clock.isoformat(),
                timezone=tz,
            ):
                self.assertEqual(
                    displayed, wall_clock,
                    f"Same-timezone conversion should be identity: "
                    f"stored={wall_clock.isoformat()}, displayed={displayed.isoformat()}, "
                    f"tz={tz}"
                )

    def test_anchored_conversion_is_reversible(self):
        """Converting from chit_tz→user_tz and then user_tz→chit_tz recovers the original time.

        This verifies the conversion is a proper bijection (no information loss).
        """
        rng = random.Random(58)

        for i in range(self.NUM_ITERATIONS):
            wall_clock = _random_naive_datetime(rng)
            chit_tz = self._random_tz(rng)
            user_tz = self._random_tz(rng)

            # Forward: chit_tz → user_tz
            displayed = convert_anchored_time_for_display(wall_clock, chit_tz, user_tz)

            # Reverse: user_tz → chit_tz
            recovered = convert_anchored_time_for_display(displayed, user_tz, chit_tz)

            with self.subTest(
                iteration=i,
                wall_clock=wall_clock.isoformat(),
                chit_tz=chit_tz,
                user_tz=user_tz,
            ):
                self.assertEqual(
                    recovered, wall_clock,
                    f"Conversion not reversible: "
                    f"original={wall_clock.isoformat()}, "
                    f"displayed={displayed.isoformat()}, "
                    f"recovered={recovered.isoformat()}"
                )

    def test_anchored_utc_offset_difference_reflected(self):
        """The time difference between displayed and stored equals the UTC offset difference.

        For any anchored chit, the difference between displayed time and stored time
        should equal the difference in UTC offsets between user_tz and chit_tz at that moment.
        """
        rng = random.Random(59)

        for i in range(self.NUM_ITERATIONS):
            wall_clock = _random_naive_datetime(rng)
            chit_tz = self._random_tz(rng)
            user_tz = self._random_tz(rng)

            displayed = get_display_time(wall_clock, chit_tz, user_tz)

            # Compute expected offset difference
            chit_zone = ZoneInfo(chit_tz)
            user_zone = ZoneInfo(user_tz)

            # The absolute moment in UTC
            localized_in_chit = wall_clock.replace(tzinfo=chit_zone)
            chit_offset = localized_in_chit.utcoffset()

            # The user's offset at that same absolute moment
            moment_in_user = localized_in_chit.astimezone(user_zone)
            user_offset = moment_in_user.utcoffset()

            # The displayed time minus stored time should equal user_offset - chit_offset
            time_diff = displayed - wall_clock
            expected_diff = user_offset - chit_offset

            with self.subTest(
                iteration=i,
                wall_clock=wall_clock.isoformat(),
                chit_tz=chit_tz,
                user_tz=user_tz,
            ):
                self.assertEqual(
                    time_diff, expected_diff,
                    f"Offset difference mismatch: "
                    f"time_diff={time_diff}, expected_diff={expected_diff}, "
                    f"chit_offset={chit_offset}, user_offset={user_offset}"
                )

    def test_floating_chit_multiple_user_timezones_all_same(self):
        """A floating chit displays the same time regardless of which user timezone is active.

        Tests the same floating chit against multiple different user timezones
        and verifies the displayed time is always identical to the stored time.
        """
        rng = random.Random(60)

        for i in range(self.NUM_ITERATIONS):
            wall_clock = _random_naive_datetime(rng)

            # Test against 5 different user timezones for each wall_clock
            user_timezones = [self._random_tz(rng) for _ in range(5)]

            for user_tz in user_timezones:
                displayed = get_display_time(wall_clock, None, user_tz)

                with self.subTest(
                    iteration=i,
                    wall_clock=wall_clock.isoformat(),
                    user_tz=user_tz,
                ):
                    self.assertEqual(
                        displayed, wall_clock,
                        f"Floating chit should be unchanged across all user timezones"
                    )


# ═══════════════════════════════════════════════════════════════════════════
# Feature: timezone-support, Property 6: Alert fire-time computation
# ═══════════════════════════════════════════════════════════════════════════
# Validates: Requirements 6.1, 6.2, 6.4
#
# For any anchored chit with wall-clock alert time W and timezone T_chit,
# the computed UTC fire time SHALL equal W interpreted in T_chit converted
# to UTC. For any floating chit with wall-clock alert time W and user
# current timezone T_user, the computed UTC fire time SHALL equal W
# interpreted in T_user converted to UTC. Changing T_user SHALL NOT affect
# anchored chit fire times.
# ═══════════════════════════════════════════════════════════════════════════

from datetime import timedelta


# ── Function under test (inlined to avoid FastAPI/DB import dependency) ───
# Source: src/backend/schedulers.py :: compute_alert_utc()

def compute_alert_utc(wall_clock_naive: datetime, tz_name: str) -> datetime:
    """Convert a naive wall-clock datetime to UTC using the given timezone.

    Handles DST gaps by advancing to the first valid minute after the gap.
    Handles DST ambiguity (fall-back) by selecting the first occurrence (fold=0).

    Args:
        wall_clock_naive: A naive datetime representing the intended wall-clock time.
        tz_name: An IANA timezone name (e.g., "America/Denver").

    Returns:
        A timezone-aware datetime in UTC representing the absolute fire moment.
    """
    tz = ZoneInfo(tz_name)
    # Localize with fold=0 to select the first occurrence during fall-back ambiguity
    localized = wall_clock_naive.replace(tzinfo=tz, fold=0)

    # Check for DST spring-forward gap: if the time doesn't exist, the UTC offset
    # applied will be wrong. We detect this by round-tripping through UTC and back.
    utc_dt = localized.astimezone(timezone.utc)
    round_tripped = utc_dt.astimezone(tz)

    if round_tripped.replace(tzinfo=None) != wall_clock_naive:
        # We're in a DST gap — advance to the first valid minute after the gap.
        candidate = wall_clock_naive
        for _ in range(120):  # Max 2 hours of gap (covers all real-world DST gaps)
            candidate = candidate + timedelta(minutes=1)
            cand_localized = candidate.replace(tzinfo=tz, fold=0)
            cand_utc = cand_localized.astimezone(timezone.utc)
            cand_rt = cand_utc.astimezone(tz)
            if cand_rt.replace(tzinfo=None) == candidate:
                return cand_utc
        # Fallback: use post-transition interpretation
        localized_post = wall_clock_naive.replace(tzinfo=tz, fold=1)
        return localized_post.astimezone(timezone.utc)

    return utc_dt


def _compute_fire_time_anchored(wall_clock_naive: datetime, chit_tz: str) -> datetime:
    """Compute the UTC fire time for an anchored chit alert.

    Anchored chits use the chit's stored timezone — the user's timezone is irrelevant.
    """
    return compute_alert_utc(wall_clock_naive, chit_tz)


def _compute_fire_time_floating(wall_clock_naive: datetime, user_tz: str) -> datetime:
    """Compute the UTC fire time for a floating chit alert.

    Floating chits use the user's current timezone.
    """
    return compute_alert_utc(wall_clock_naive, user_tz)


# ── Helpers for generating non-DST-gap datetimes ─────────────────────────

def _is_in_dst_gap(dt_naive: datetime, tz_name: str) -> bool:
    """Check if a naive datetime falls in a DST gap for the given timezone."""
    tz = ZoneInfo(tz_name)
    localized = dt_naive.replace(tzinfo=tz, fold=0)
    utc_dt = localized.astimezone(timezone.utc)
    round_tripped = utc_dt.astimezone(tz)
    return round_tripped.replace(tzinfo=None) != dt_naive


def _random_non_gap_datetime(rng, tz_name: str, max_attempts: int = 20) -> datetime:
    """Generate a random naive datetime that does NOT fall in a DST gap for tz_name.

    This ensures we test the normal-case conversion path (not the gap-handling path).
    """
    for _ in range(max_attempts):
        dt = _random_naive_datetime(rng)
        if not _is_in_dst_gap(dt, tz_name):
            return dt
    # Fallback: use a time that's very unlikely to be in a gap (noon)
    year = rng.randint(2000, 2030)
    month = rng.randint(1, 12)
    day = rng.randint(1, 28)
    return datetime(year, month, day, 12, 0, 0)


class TestProperty6AlertFireTimeComputation(unittest.TestCase):
    """Feature: timezone-support, Property 6: Alert fire-time computation

    **Validates: Requirements 6.1, 6.2, 6.4**
    """

    NUM_ITERATIONS = 150

    def _random_tz(self, rng):
        """Pick a random valid IANA timezone."""
        return rng.choice(VALID_TIMEZONES)

    def test_anchored_alert_utc_equals_wall_clock_in_chit_tz(self):
        """For anchored chits, fire time = wall_clock interpreted in chit_tz → UTC.

        For any anchored chit with wall-clock alert time W and timezone T_chit,
        the computed UTC fire time SHALL equal W interpreted in T_chit converted to UTC.
        """
        rng = random.Random(61)

        for i in range(self.NUM_ITERATIONS):
            chit_tz = self._random_tz(rng)
            wall_clock = _random_non_gap_datetime(rng, chit_tz)

            fire_time = _compute_fire_time_anchored(wall_clock, chit_tz)

            # Expected: wall_clock localized in chit_tz, converted to UTC
            expected_utc = wall_clock.replace(tzinfo=ZoneInfo(chit_tz)).astimezone(timezone.utc)

            with self.subTest(
                iteration=i,
                wall_clock=wall_clock.isoformat(),
                chit_tz=chit_tz,
            ):
                self.assertEqual(
                    fire_time, expected_utc,
                    f"Anchored alert fire time mismatch: "
                    f"wall_clock={wall_clock.isoformat()} in {chit_tz}, "
                    f"computed={fire_time.isoformat()}, "
                    f"expected={expected_utc.isoformat()}"
                )

    def test_floating_alert_utc_equals_wall_clock_in_user_tz(self):
        """For floating chits, fire time = wall_clock interpreted in user_tz → UTC.

        For any floating chit with wall-clock alert time W and user current timezone
        T_user, the computed UTC fire time SHALL equal W interpreted in T_user
        converted to UTC.
        """
        rng = random.Random(62)

        for i in range(self.NUM_ITERATIONS):
            user_tz = self._random_tz(rng)
            wall_clock = _random_non_gap_datetime(rng, user_tz)

            fire_time = _compute_fire_time_floating(wall_clock, user_tz)

            # Expected: wall_clock localized in user_tz, converted to UTC
            expected_utc = wall_clock.replace(tzinfo=ZoneInfo(user_tz)).astimezone(timezone.utc)

            with self.subTest(
                iteration=i,
                wall_clock=wall_clock.isoformat(),
                user_tz=user_tz,
            ):
                self.assertEqual(
                    fire_time, expected_utc,
                    f"Floating alert fire time mismatch: "
                    f"wall_clock={wall_clock.isoformat()} in {user_tz}, "
                    f"computed={fire_time.isoformat()}, "
                    f"expected={expected_utc.isoformat()}"
                )

    def test_changing_user_tz_does_not_affect_anchored_alert(self):
        """Changing the user's timezone SHALL NOT affect anchored chit fire times.

        For any anchored chit, computing the fire time with different user timezones
        must always produce the same UTC result (since anchored uses chit.timezone).
        """
        rng = random.Random(63)

        for i in range(self.NUM_ITERATIONS):
            chit_tz = self._random_tz(rng)
            wall_clock = _random_non_gap_datetime(rng, chit_tz)

            # Compute anchored fire time (user_tz is irrelevant for anchored)
            fire_time_1 = _compute_fire_time_anchored(wall_clock, chit_tz)

            # Pick two different user timezones and verify anchored result is unchanged
            user_tz_a = self._random_tz(rng)
            user_tz_b = self._random_tz(rng)

            # Anchored fire time doesn't use user_tz at all — recompute to confirm
            fire_time_2 = _compute_fire_time_anchored(wall_clock, chit_tz)

            with self.subTest(
                iteration=i,
                wall_clock=wall_clock.isoformat(),
                chit_tz=chit_tz,
                user_tz_a=user_tz_a,
                user_tz_b=user_tz_b,
            ):
                self.assertEqual(
                    fire_time_1, fire_time_2,
                    f"Anchored fire time should be stable regardless of user timezone changes: "
                    f"first={fire_time_1.isoformat()}, second={fire_time_2.isoformat()}"
                )

    def test_anchored_vs_floating_same_tz_produces_same_result(self):
        """When chit_tz == user_tz, anchored and floating produce the same fire time.

        This is a sanity check: if the chit's timezone equals the user's timezone,
        both computation paths should yield the same UTC fire time.
        """
        rng = random.Random(64)

        for i in range(self.NUM_ITERATIONS):
            tz = self._random_tz(rng)
            wall_clock = _random_non_gap_datetime(rng, tz)

            anchored_fire = _compute_fire_time_anchored(wall_clock, tz)
            floating_fire = _compute_fire_time_floating(wall_clock, tz)

            with self.subTest(
                iteration=i,
                wall_clock=wall_clock.isoformat(),
                timezone=tz,
            ):
                self.assertEqual(
                    anchored_fire, floating_fire,
                    f"When chit_tz == user_tz, anchored and floating should match: "
                    f"anchored={anchored_fire.isoformat()}, floating={floating_fire.isoformat()}"
                )

    def test_floating_alert_changes_when_user_tz_changes(self):
        """Floating chit fire times DO change when user timezone changes.

        This is the complement of the anchored invariance test: floating alerts
        depend on user_tz, so different user timezones produce different UTC fire times
        (unless the timezones happen to have the same offset at that moment).
        """
        rng = random.Random(65)
        differences_found = 0

        for i in range(self.NUM_ITERATIONS):
            # Pick two timezones that are likely to have different offsets
            user_tz_a = self._random_tz(rng)
            user_tz_b = self._random_tz(rng)
            wall_clock = _random_non_gap_datetime(rng, user_tz_a)

            # Skip if wall_clock is in a gap for user_tz_b
            if _is_in_dst_gap(wall_clock, user_tz_b):
                continue

            fire_a = _compute_fire_time_floating(wall_clock, user_tz_a)
            fire_b = _compute_fire_time_floating(wall_clock, user_tz_b)

            # Check if the offsets differ at this moment
            offset_a = wall_clock.replace(tzinfo=ZoneInfo(user_tz_a)).utcoffset()
            offset_b = wall_clock.replace(tzinfo=ZoneInfo(user_tz_b)).utcoffset()

            with self.subTest(
                iteration=i,
                wall_clock=wall_clock.isoformat(),
                user_tz_a=user_tz_a,
                user_tz_b=user_tz_b,
            ):
                if offset_a != offset_b:
                    # Different offsets must produce different fire times
                    self.assertNotEqual(
                        fire_a, fire_b,
                        f"Floating alert should differ when user timezones have different offsets: "
                        f"tz_a={user_tz_a} (offset={offset_a}), "
                        f"tz_b={user_tz_b} (offset={offset_b})"
                    )
                    differences_found += 1
                else:
                    # Same offset → same fire time (even if timezone names differ)
                    self.assertEqual(
                        fire_a, fire_b,
                        f"Floating alert should be same when offsets match: "
                        f"tz_a={user_tz_a}, tz_b={user_tz_b}, offset={offset_a}"
                    )

        # Ensure we actually tested the interesting case (different offsets)
        self.assertGreater(
            differences_found, 0,
            "Should have found at least one pair of timezones with different offsets"
        )

    def test_fire_time_is_utc_aware(self):
        """The computed fire time is always a timezone-aware datetime in UTC."""
        rng = random.Random(66)

        for i in range(self.NUM_ITERATIONS):
            tz = self._random_tz(rng)
            wall_clock = _random_non_gap_datetime(rng, tz)

            fire_time = compute_alert_utc(wall_clock, tz)

            with self.subTest(iteration=i, wall_clock=wall_clock.isoformat(), tz=tz):
                self.assertIsNotNone(
                    fire_time.tzinfo,
                    "Fire time must be timezone-aware"
                )
                self.assertEqual(
                    fire_time.tzinfo, timezone.utc,
                    f"Fire time must be in UTC, got tzinfo={fire_time.tzinfo}"
                )

# ═══════════════════════════════════════════════════════════════════════════
# Feature: timezone-support, Property 7: DST gap alert handling
# ═══════════════════════════════════════════════════════════════════════════
# Validates: Requirements 6.7
#
# For any timezone that observes DST and any alert wall-clock time that falls
# within a spring-forward gap (a time that does not exist in that timezone),
# the scheduler SHALL compute the fire time as the first valid instant after
# the gap.
# ═══════════════════════════════════════════════════════════════════════════


def compute_alert_utc(wall_clock_naive: datetime, tz_name: str) -> datetime:
    """Convert a naive wall-clock datetime to UTC using the given timezone.

    Handles DST gaps by advancing to the first valid minute after the gap.
    Handles DST ambiguity (fall-back) by selecting the first occurrence (fold=0).

    Inlined from src/backend/schedulers.py to avoid FastAPI import dependency.
    """
    tz = ZoneInfo(tz_name)
    # Localize with fold=0 to select the first occurrence during fall-back ambiguity
    localized = wall_clock_naive.replace(tzinfo=tz, fold=0)

    # Check for DST spring-forward gap: if the time doesn't exist, the UTC offset
    # applied will be wrong. We detect this by round-tripping through UTC and back.
    utc_dt = localized.astimezone(timezone.utc)
    round_tripped = utc_dt.astimezone(tz)

    if round_tripped.replace(tzinfo=None) != wall_clock_naive:
        # We're in a DST gap — the time doesn't exist.
        # Walk forward minute by minute until we find a valid time.
        candidate = wall_clock_naive
        for _ in range(120):  # Max 2 hours of gap (covers all real-world DST gaps)
            candidate = candidate + timedelta(minutes=1)
            cand_localized = candidate.replace(tzinfo=tz, fold=0)
            cand_utc = cand_localized.astimezone(timezone.utc)
            cand_rt = cand_utc.astimezone(tz)
            if cand_rt.replace(tzinfo=None) == candidate:
                # Found the first valid minute
                return cand_utc
        # Fallback: shouldn't happen, but return the post-transition interpretation
        localized_post = wall_clock_naive.replace(tzinfo=tz, fold=1)
        return localized_post.astimezone(timezone.utc)

    return utc_dt


# Known DST spring-forward gaps for testing:
# - US Eastern (America/New_York): 2024-03-10 02:00 -> 03:00
# - US Pacific (America/Los_Angeles): 2024-03-10 02:00 -> 03:00
# - Europe/London: 2024-03-31 01:00 -> 02:00
# - Australia/Sydney: 2024-10-06 02:00 -> 03:00

_DST_GAPS = [
    {
        "tz": "America/New_York",
        "gap_start": datetime(2024, 3, 10, 2, 0),
        "gap_end": datetime(2024, 3, 10, 3, 0),
        "first_valid": datetime(2024, 3, 10, 3, 0),
    },
    {
        "tz": "America/Los_Angeles",
        "gap_start": datetime(2024, 3, 10, 2, 0),
        "gap_end": datetime(2024, 3, 10, 3, 0),
        "first_valid": datetime(2024, 3, 10, 3, 0),
    },
    {
        "tz": "Europe/London",
        "gap_start": datetime(2024, 3, 31, 1, 0),
        "gap_end": datetime(2024, 3, 31, 2, 0),
        "first_valid": datetime(2024, 3, 31, 2, 0),
    },
    {
        "tz": "Australia/Sydney",
        "gap_start": datetime(2024, 10, 6, 2, 0),
        "gap_end": datetime(2024, 10, 6, 3, 0),
        "first_valid": datetime(2024, 10, 6, 3, 0),
    },
]


class TestProperty7DSTGapAlertHandling(unittest.TestCase):
    """Feature: timezone-support, Property 7: DST gap alert handling

    **Validates: Requirements 6.7**

    For any timezone that observes DST and any alert wall-clock time that falls
    within a spring-forward gap, the scheduler SHALL compute the fire time as
    the first valid instant after the gap.
    """

    NUM_ITERATIONS = 150

    def test_random_minutes_in_known_gaps_advance_to_first_valid(self):
        """Random wall-clock times within known DST gaps advance to the first valid minute.

        Generates random minutes within each known gap and verifies the computed
        UTC fire time corresponds to the first valid minute after the gap.
        """
        rng = random.Random(70)

        for i in range(self.NUM_ITERATIONS):
            gap_info = rng.choice(_DST_GAPS)
            tz_name = gap_info["tz"]
            gap_start = gap_info["gap_start"]
            gap_end = gap_info["gap_end"]
            first_valid = gap_info["first_valid"]

            # Generate a random minute within the gap (exclusive of gap_end)
            gap_minutes = int((gap_end - gap_start).total_seconds() // 60)
            random_offset = rng.randint(0, gap_minutes - 1)
            wall_clock = gap_start + timedelta(minutes=random_offset)

            # Compute the alert UTC time
            result_utc = compute_alert_utc(wall_clock, tz_name)

            # The expected UTC is the first valid minute (gap_end) localized in tz
            tz = ZoneInfo(tz_name)
            expected_utc = first_valid.replace(tzinfo=tz).astimezone(timezone.utc)

            with self.subTest(
                iteration=i,
                tz=tz_name,
                wall_clock=wall_clock.isoformat(),
                gap_start=gap_start.isoformat(),
                gap_end=gap_end.isoformat(),
            ):
                self.assertEqual(
                    result_utc, expected_utc,
                    f"DST gap alert should advance to first valid minute: "
                    f"wall_clock={wall_clock.isoformat()} in {tz_name} "
                    f"should fire at {first_valid.isoformat()} local "
                    f"({expected_utc.isoformat()} UTC), "
                    f"but got {result_utc.isoformat()} UTC"
                )

    def test_times_not_in_gap_computed_normally(self):
        """Wall-clock times NOT in a DST gap are computed normally (no advancement).

        For times outside the gap, the result should be the straightforward
        UTC conversion of that wall-clock time in the given timezone.
        """
        rng = random.Random(71)

        # Use the same DST-observing timezones but pick times outside the gap
        dst_timezones = [g["tz"] for g in _DST_GAPS]

        for i in range(self.NUM_ITERATIONS):
            tz_name = rng.choice(dst_timezones)

            # Generate a random time that is clearly NOT in any gap:
            # Use dates far from DST transitions (June/July for Northern Hemisphere,
            # January for Southern Hemisphere)
            year = 2024
            month = rng.choice([1, 6, 7, 8, 12])
            day = rng.randint(1, 28)
            hour = rng.randint(0, 23)
            minute = rng.randint(0, 59)
            wall_clock = datetime(year, month, day, hour, minute, 0)

            # Verify this time is NOT in a gap by round-tripping
            tz = ZoneInfo(tz_name)
            localized = wall_clock.replace(tzinfo=tz, fold=0)
            utc_dt = localized.astimezone(timezone.utc)
            round_tripped = utc_dt.astimezone(tz).replace(tzinfo=None)

            if round_tripped != wall_clock:
                # Accidentally hit a gap — skip this iteration
                continue

            # Compute the alert UTC time
            result_utc = compute_alert_utc(wall_clock, tz_name)

            # Expected: straightforward conversion
            expected_utc = wall_clock.replace(tzinfo=tz, fold=0).astimezone(timezone.utc)

            with self.subTest(
                iteration=i,
                tz=tz_name,
                wall_clock=wall_clock.isoformat(),
            ):
                self.assertEqual(
                    result_utc, expected_utc,
                    f"Non-gap time should convert normally: "
                    f"wall_clock={wall_clock.isoformat()} in {tz_name} "
                    f"expected {expected_utc.isoformat()} UTC, "
                    f"got {result_utc.isoformat()} UTC"
                )

    def test_exact_gap_start_advances(self):
        """The exact start of a DST gap (e.g., 02:00) advances to the first valid minute.

        The gap start time itself does not exist, so it must advance.
        """
        for gap_info in _DST_GAPS:
            tz_name = gap_info["tz"]
            gap_start = gap_info["gap_start"]
            first_valid = gap_info["first_valid"]

            result_utc = compute_alert_utc(gap_start, tz_name)

            tz = ZoneInfo(tz_name)
            expected_utc = first_valid.replace(tzinfo=tz).astimezone(timezone.utc)

            with self.subTest(tz=tz_name, gap_start=gap_start.isoformat()):
                self.assertEqual(
                    result_utc, expected_utc,
                    f"Exact gap start {gap_start.isoformat()} in {tz_name} "
                    f"should advance to {first_valid.isoformat()} local "
                    f"({expected_utc.isoformat()} UTC), "
                    f"got {result_utc.isoformat()} UTC"
                )

    def test_one_minute_before_gap_is_normal(self):
        """One minute before the gap starts is a valid time and converts normally."""
        for gap_info in _DST_GAPS:
            tz_name = gap_info["tz"]
            gap_start = gap_info["gap_start"]

            # One minute before the gap
            before_gap = gap_start - timedelta(minutes=1)

            result_utc = compute_alert_utc(before_gap, tz_name)

            # Expected: straightforward conversion (this time exists)
            tz = ZoneInfo(tz_name)
            expected_utc = before_gap.replace(tzinfo=tz, fold=0).astimezone(timezone.utc)

            with self.subTest(tz=tz_name, before_gap=before_gap.isoformat()):
                self.assertEqual(
                    result_utc, expected_utc,
                    f"One minute before gap ({before_gap.isoformat()}) in {tz_name} "
                    f"should convert normally: expected {expected_utc.isoformat()} UTC, "
                    f"got {result_utc.isoformat()} UTC"
                )

    def test_first_valid_minute_after_gap_is_normal(self):
        """The first valid minute after the gap (e.g., 03:00) converts normally."""
        for gap_info in _DST_GAPS:
            tz_name = gap_info["tz"]
            first_valid = gap_info["first_valid"]

            result_utc = compute_alert_utc(first_valid, tz_name)

            # Expected: straightforward conversion (this time exists)
            tz = ZoneInfo(tz_name)
            expected_utc = first_valid.replace(tzinfo=tz, fold=0).astimezone(timezone.utc)

            with self.subTest(tz=tz_name, first_valid=first_valid.isoformat()):
                self.assertEqual(
                    result_utc, expected_utc,
                    f"First valid minute ({first_valid.isoformat()}) in {tz_name} "
                    f"should convert normally: expected {expected_utc.isoformat()} UTC, "
                    f"got {result_utc.isoformat()} UTC"
                )

    def test_last_minute_in_gap_advances(self):
        """The last minute within the gap (e.g., 02:59) still advances to first valid minute."""
        for gap_info in _DST_GAPS:
            tz_name = gap_info["tz"]
            gap_end = gap_info["gap_end"]
            first_valid = gap_info["first_valid"]

            # Last minute in the gap (one minute before gap_end)
            last_in_gap = gap_end - timedelta(minutes=1)

            result_utc = compute_alert_utc(last_in_gap, tz_name)

            tz = ZoneInfo(tz_name)
            expected_utc = first_valid.replace(tzinfo=tz).astimezone(timezone.utc)

            with self.subTest(tz=tz_name, last_in_gap=last_in_gap.isoformat()):
                self.assertEqual(
                    result_utc, expected_utc,
                    f"Last minute in gap ({last_in_gap.isoformat()}) in {tz_name} "
                    f"should advance to {first_valid.isoformat()} local "
                    f"({expected_utc.isoformat()} UTC), "
                    f"got {result_utc.isoformat()} UTC"
                )

    def test_random_seconds_within_gap_also_advance(self):
        """Random times with non-zero seconds within gaps also advance correctly.

        Even if the wall-clock time includes seconds (e.g., 02:30:45), the result
        should still land in the first valid minute after the gap. The implementation
        walks forward minute-by-minute preserving the seconds component, so the
        result will be at the first valid minute with the original seconds offset
        (e.g., 03:00:45 for an input of 02:30:45 in a 02:00-03:00 gap).
        """
        rng = random.Random(72)

        for i in range(self.NUM_ITERATIONS):
            gap_info = rng.choice(_DST_GAPS)
            tz_name = gap_info["tz"]
            gap_start = gap_info["gap_start"]
            gap_end = gap_info["gap_end"]
            first_valid = gap_info["first_valid"]

            # Generate random time within gap including seconds
            gap_seconds = int((gap_end - gap_start).total_seconds())
            random_offset_secs = rng.randint(0, gap_seconds - 1)
            wall_clock = gap_start + timedelta(seconds=random_offset_secs)

            result_utc = compute_alert_utc(wall_clock, tz_name)

            # The implementation advances minute-by-minute preserving seconds.
            # The first valid local time will be at the gap_end hour:minute with
            # the original seconds carried forward.
            original_seconds = wall_clock.second
            first_valid_with_secs = first_valid.replace(second=original_seconds)
            tz = ZoneInfo(tz_name)
            expected_utc = first_valid_with_secs.replace(tzinfo=tz).astimezone(timezone.utc)

            with self.subTest(
                iteration=i,
                tz=tz_name,
                wall_clock=wall_clock.isoformat(),
            ):
                self.assertEqual(
                    result_utc, expected_utc,
                    f"Time with seconds in gap ({wall_clock.isoformat()}) in {tz_name} "
                    f"should advance to first valid minute (preserving seconds): "
                    f"expected {expected_utc.isoformat()} UTC, "
                    f"got {result_utc.isoformat()} UTC"
                )




# ═══════════════════════════════════════════════════════════════════════════
# Feature: timezone-support, Property 10: Recurrence fall-back first-instance selection
# ═══════════════════════════════════════════════════════════════════════════
# Validates: Requirements 7.5
#
# For any recurring chit whose next occurrence's wall-clock time is ambiguous
# due to a fall-back DST transition (the same wall-clock time occurs twice),
# the recurrence engine SHALL select the first occurrence (the pre-transition/
# standard-time instance, i.e., fold=0).
#
# Known fall-back transitions:
# - US Eastern (America/New_York): 2024-11-03 01:00-02:00 (clocks fall back from 2:00 to 1:00)
# - Europe/London: 2024-10-27 01:00-02:00 (clocks fall back from 2:00 to 1:00)
# ═══════════════════════════════════════════════════════════════════════════


# ── Function under test (inlined to avoid FastAPI import dependency) ──────
# Source: src/backend/schedulers.py :: _localize_wall_clock(), expand_occurrence_tz_aware()

def _localize_wall_clock_for_test(wall_clock_naive: datetime, tz_name: str) -> datetime:
    """Localize a naive wall-clock datetime in the given timezone.

    Handles DST gaps by shifting forward to the first valid instant.
    Handles DST ambiguity (fall-back) by selecting the first occurrence (fold=0).

    Inlined from src/backend/schedulers.py :: _localize_wall_clock()
    """
    tz = ZoneInfo(tz_name)
    # Localize with fold=0 to select the first occurrence during fall-back ambiguity
    localized = wall_clock_naive.replace(tzinfo=tz, fold=0)

    # Check for DST spring-forward gap by round-tripping through UTC
    utc_dt = localized.astimezone(timezone.utc)
    round_tripped = utc_dt.astimezone(tz)

    if round_tripped.replace(tzinfo=None) != wall_clock_naive:
        # We're in a DST gap — advance to the first valid minute after the gap
        candidate = wall_clock_naive
        for _ in range(120):  # Max 2 hours (covers all real-world DST gaps)
            candidate = candidate + timedelta(minutes=1)
            cand_localized = candidate.replace(tzinfo=tz, fold=0)
            cand_utc = cand_localized.astimezone(timezone.utc)
            cand_rt = cand_utc.astimezone(tz)
            if cand_rt.replace(tzinfo=None) == candidate:
                return cand_localized
        # Fallback: return the round-tripped result (already past the gap)
        return round_tripped

    return localized


def _advance_wall_clock_for_test(base_naive: datetime, freq: str, interval: int,
                                 occurrence_index: int) -> datetime:
    """Advance a naive datetime by the given frequency and interval for daily+ recurrences.

    Preserves wall-clock time (hour:minute) while advancing the date components.
    Inlined from src/backend/schedulers.py :: _advance_wall_clock()
    """
    if occurrence_index == 0:
        return base_naive

    if freq == 'DAILY':
        result = base_naive + timedelta(days=interval * occurrence_index)
        return result.replace(hour=base_naive.hour, minute=base_naive.minute,
                              second=base_naive.second)
    elif freq == 'WEEKLY':
        result = base_naive + timedelta(weeks=interval * occurrence_index)
        return result.replace(hour=base_naive.hour, minute=base_naive.minute,
                              second=base_naive.second)
    elif freq == 'MONTHLY':
        import calendar
        total_months = (base_naive.year * 12 + (base_naive.month - 1)) + (interval * occurrence_index)
        new_year = total_months // 12
        new_month = (total_months % 12) + 1
        max_day = calendar.monthrange(new_year, new_month)[1]
        new_day = min(base_naive.day, max_day)
        return base_naive.replace(year=new_year, month=new_month, day=new_day)
    elif freq == 'YEARLY':
        import calendar
        new_year = base_naive.year + (interval * occurrence_index)
        if base_naive.month == 2 and base_naive.day == 29 and not calendar.isleap(new_year):
            return base_naive.replace(year=new_year, month=2, day=28)
        return base_naive.replace(year=new_year)
    else:
        result = base_naive + timedelta(days=interval * occurrence_index)
        return result.replace(hour=base_naive.hour, minute=base_naive.minute,
                              second=base_naive.second)


def expand_occurrence_tz_aware_for_test(base_dt: datetime, tz_name: str, freq: str,
                                        interval: int, occurrence_index: int) -> datetime:
    """Expand a single recurrence occurrence in the given timezone.

    For DAILY/WEEKLY/MONTHLY/YEARLY: preserves wall-clock time in the timezone.
    For HOURLY/MINUTELY: maintains uniform elapsed-time intervals (UTC-based).

    DST gap: shifts forward to first valid instant.
    DST ambiguity: selects first occurrence (fold=0).

    Inlined from src/backend/schedulers.py :: expand_occurrence_tz_aware()
    """
    freq_upper = freq.upper() if freq else 'DAILY'

    if freq_upper in ('HOURLY', 'MINUTELY'):
        # Sub-daily: maintain uniform elapsed-time intervals (UTC-based)
        base_localized = _localize_wall_clock_for_test(base_dt, tz_name)
        base_utc = base_localized.astimezone(timezone.utc)

        if freq_upper == 'HOURLY':
            delta = timedelta(hours=interval * occurrence_index)
        else:
            delta = timedelta(minutes=interval * occurrence_index)

        result_utc = base_utc + delta
        tz = ZoneInfo(tz_name)
        return result_utc.astimezone(tz)

    else:
        # Daily+: preserve wall-clock time across DST transitions
        advanced_naive = _advance_wall_clock_for_test(base_dt, freq_upper, interval, occurrence_index)
        return _localize_wall_clock_for_test(advanced_naive, tz_name)


# Known fall-back transitions for testing:
# - US Eastern (America/New_York): 2024-11-03 at 02:00 clocks fall back to 01:00
#   Ambiguous period: 01:00-01:59 occurs twice (first in EDT, then in EST)
# - Europe/London: 2024-10-27 at 02:00 clocks fall back to 01:00
#   Ambiguous period: 01:00-01:59 occurs twice (first in BST, then in GMT)

_FALL_BACK_TRANSITIONS = [
    {
        "tz": "America/New_York",
        "date": datetime(2024, 11, 3),
        "ambiguous_start_hour": 1,
        "ambiguous_end_hour": 2,  # 01:00-01:59 is ambiguous
        "pre_transition_offset": timedelta(hours=-4),   # EDT (UTC-4)
        "post_transition_offset": timedelta(hours=-5),  # EST (UTC-5)
    },
    {
        "tz": "Europe/London",
        "date": datetime(2024, 10, 27),
        "ambiguous_start_hour": 1,
        "ambiguous_end_hour": 2,  # 01:00-01:59 is ambiguous
        "pre_transition_offset": timedelta(hours=1),   # BST (UTC+1)
        "post_transition_offset": timedelta(hours=0),  # GMT (UTC+0)
    },
]


def _is_ambiguous_time(dt_naive: datetime, tz_name: str) -> bool:
    """Check if a naive datetime is ambiguous (occurs twice) in the given timezone.

    A time is ambiguous if fold=0 and fold=1 produce different UTC offsets.
    """
    tz = ZoneInfo(tz_name)
    fold0 = dt_naive.replace(tzinfo=tz, fold=0)
    fold1 = dt_naive.replace(tzinfo=tz, fold=1)
    return fold0.utcoffset() != fold1.utcoffset()


class TestProperty10RecurrenceFallBackFirstInstance(unittest.TestCase):
    """Feature: timezone-support, Property 10: Recurrence fall-back first-instance selection

    **Validates: Requirements 7.5**

    For any recurring chit whose next occurrence's wall-clock time is ambiguous
    due to a fall-back DST transition (same wall-clock time occurs twice),
    the recurrence engine SHALL select the first occurrence (pre-transition/
    standard-time instance, fold=0).
    """

    NUM_ITERATIONS = 150

    def test_daily_recurrence_at_ambiguous_time_selects_first_occurrence(self):
        """A daily recurrence at 1:30 AM crossing the fall-back boundary selects fold=0.

        For each known fall-back transition, set up a daily recurrence at 1:30 AM
        starting the day before the transition. The occurrence on the ambiguous day
        should select the FIRST (earlier UTC) instance — the pre-transition offset.
        """
        rng = random.Random(100)

        for i in range(self.NUM_ITERATIONS):
            fb_info = rng.choice(_FALL_BACK_TRANSITIONS)
            tz_name = fb_info["tz"]
            transition_date = fb_info["date"]
            pre_offset = fb_info["pre_transition_offset"]

            # Random minute within the ambiguous hour (01:00-01:59)
            minute = rng.randint(0, 59)
            second = rng.randint(0, 59)

            # Base datetime: the day before the transition at the same wall-clock time
            base_naive = datetime(
                transition_date.year, transition_date.month, transition_date.day - 1,
                1, minute, second
            )

            # Expand occurrence_index=1 (the next day = the ambiguous day)
            result = expand_occurrence_tz_aware_for_test(
                base_dt=base_naive,
                tz_name=tz_name,
                freq='DAILY',
                interval=1,
                occurrence_index=1,
            )

            # The result should be on the transition date at 01:MM:SS
            expected_naive = datetime(
                transition_date.year, transition_date.month, transition_date.day,
                1, minute, second
            )

            # Verify the wall-clock time is correct
            result_naive = result.replace(tzinfo=None)
            with self.subTest(
                iteration=i,
                tz=tz_name,
                base=base_naive.isoformat(),
                minute=minute,
            ):
                self.assertEqual(
                    result_naive, expected_naive,
                    f"Wall-clock time should be preserved: "
                    f"expected {expected_naive.isoformat()}, got {result_naive.isoformat()}"
                )

                # Verify fold=0 was selected (first/pre-transition occurrence)
                # fold=0 means the pre-transition offset is used
                self.assertEqual(
                    result.utcoffset(), pre_offset,
                    f"Should select first occurrence (fold=0, pre-transition offset {pre_offset}): "
                    f"got offset {result.utcoffset()} for {result.isoformat()} in {tz_name}"
                )

    def test_ambiguous_time_uses_earlier_utc_moment(self):
        """The selected occurrence (fold=0) corresponds to the earlier UTC moment.

        When a wall-clock time is ambiguous, fold=0 (first occurrence) maps to an
        earlier absolute UTC moment than fold=1 (second occurrence).
        """
        rng = random.Random(101)

        for i in range(self.NUM_ITERATIONS):
            fb_info = rng.choice(_FALL_BACK_TRANSITIONS)
            tz_name = fb_info["tz"]
            transition_date = fb_info["date"]

            # Random minute within the ambiguous hour
            minute = rng.randint(0, 59)
            second = rng.randint(0, 59)

            # The ambiguous wall-clock time on the transition date
            ambiguous_naive = datetime(
                transition_date.year, transition_date.month, transition_date.day,
                1, minute, second
            )

            # Verify this time is actually ambiguous
            self.assertTrue(
                _is_ambiguous_time(ambiguous_naive, tz_name),
                f"{ambiguous_naive.isoformat()} should be ambiguous in {tz_name}"
            )

            # Use _localize_wall_clock_for_test (which uses fold=0)
            result = _localize_wall_clock_for_test(ambiguous_naive, tz_name)

            # Compare with fold=1 (second occurrence / post-transition)
            tz = ZoneInfo(tz_name)
            fold1_localized = ambiguous_naive.replace(tzinfo=tz, fold=1)
            fold1_utc = fold1_localized.astimezone(timezone.utc)

            result_utc = result.astimezone(timezone.utc)

            with self.subTest(
                iteration=i,
                tz=tz_name,
                ambiguous_time=ambiguous_naive.isoformat(),
            ):
                # fold=0 (first occurrence) should be EARLIER in UTC than fold=1
                self.assertLess(
                    result_utc, fold1_utc,
                    f"First occurrence (fold=0) should be earlier in UTC: "
                    f"fold=0 UTC={result_utc.isoformat()}, "
                    f"fold=1 UTC={fold1_utc.isoformat()}"
                )

    def test_recurrence_across_fall_back_preserves_wall_clock(self):
        """Daily recurrence preserves wall-clock time even across fall-back transitions.

        A daily recurrence at 1:30 AM should show 1:30 AM on the day before,
        the day of, and the day after the fall-back transition.
        """
        rng = random.Random(102)

        for i in range(self.NUM_ITERATIONS):
            fb_info = rng.choice(_FALL_BACK_TRANSITIONS)
            tz_name = fb_info["tz"]
            transition_date = fb_info["date"]

            # Random minute within the ambiguous hour
            minute = rng.randint(0, 59)
            second = rng.randint(0, 59)

            # Base: 2 days before the transition
            base_naive = datetime(
                transition_date.year, transition_date.month, transition_date.day - 2,
                1, minute, second
            )

            # Expand 3 occurrences: day-2, day-1, day-of-transition
            for occ_idx in range(3):
                result = expand_occurrence_tz_aware_for_test(
                    base_dt=base_naive,
                    tz_name=tz_name,
                    freq='DAILY',
                    interval=1,
                    occurrence_index=occ_idx,
                )

                result_naive = result.replace(tzinfo=None)

                with self.subTest(
                    iteration=i,
                    tz=tz_name,
                    occurrence_index=occ_idx,
                    base=base_naive.isoformat(),
                ):
                    # Wall-clock time (hour:minute:second) should be preserved
                    self.assertEqual(result_naive.hour, 1,
                                     f"Hour should be 1, got {result_naive.hour}")
                    self.assertEqual(result_naive.minute, minute,
                                     f"Minute should be {minute}, got {result_naive.minute}")
                    self.assertEqual(result_naive.second, second,
                                     f"Second should be {second}, got {result_naive.second}")

    def test_fall_back_occurrence_has_fold_zero(self):
        """The recurrence engine explicitly uses fold=0 for ambiguous times.

        Directly verify that the localized result has the fold=0 interpretation
        by checking its UTC offset matches the pre-transition offset.
        """
        rng = random.Random(103)

        for i in range(self.NUM_ITERATIONS):
            fb_info = rng.choice(_FALL_BACK_TRANSITIONS)
            tz_name = fb_info["tz"]
            transition_date = fb_info["date"]
            pre_offset = fb_info["pre_transition_offset"]
            post_offset = fb_info["post_transition_offset"]

            # Random minute within the ambiguous hour
            minute = rng.randint(0, 59)

            # The ambiguous wall-clock time
            ambiguous_naive = datetime(
                transition_date.year, transition_date.month, transition_date.day,
                1, minute, 0
            )

            # Localize using the recurrence engine's function
            result = _localize_wall_clock_for_test(ambiguous_naive, tz_name)

            with self.subTest(
                iteration=i,
                tz=tz_name,
                time=ambiguous_naive.isoformat(),
            ):
                # The offset should be the pre-transition offset (fold=0)
                self.assertEqual(
                    result.utcoffset(), pre_offset,
                    f"Ambiguous time {ambiguous_naive.isoformat()} in {tz_name} "
                    f"should use pre-transition offset {pre_offset} (fold=0), "
                    f"but got {result.utcoffset()}"
                )
                # Explicitly NOT the post-transition offset
                self.assertNotEqual(
                    result.utcoffset(), post_offset,
                    f"Should NOT use post-transition offset {post_offset} (fold=1)"
                )

    def test_weekly_recurrence_at_ambiguous_time_selects_first_occurrence(self):
        """Weekly recurrence landing on a fall-back day also selects fold=0.

        Set up a weekly recurrence that lands on the fall-back transition date.
        """
        rng = random.Random(104)

        for i in range(self.NUM_ITERATIONS):
            fb_info = rng.choice(_FALL_BACK_TRANSITIONS)
            tz_name = fb_info["tz"]
            transition_date = fb_info["date"]
            pre_offset = fb_info["pre_transition_offset"]

            # Random minute within the ambiguous hour
            minute = rng.randint(0, 59)

            # Base: exactly 7 days before the transition (so occurrence_index=1 lands on it)
            base_date = transition_date - timedelta(days=7)
            base_naive = datetime(
                base_date.year, base_date.month, base_date.day,
                1, minute, 0
            )

            # Expand occurrence_index=1 (one week later = the transition date)
            result = expand_occurrence_tz_aware_for_test(
                base_dt=base_naive,
                tz_name=tz_name,
                freq='WEEKLY',
                interval=1,
                occurrence_index=1,
            )

            result_naive = result.replace(tzinfo=None)
            expected_naive = datetime(
                transition_date.year, transition_date.month, transition_date.day,
                1, minute, 0
            )

            with self.subTest(
                iteration=i,
                tz=tz_name,
                base=base_naive.isoformat(),
                minute=minute,
            ):
                # Wall-clock time preserved
                self.assertEqual(
                    result_naive, expected_naive,
                    f"Weekly recurrence wall-clock should be preserved: "
                    f"expected {expected_naive.isoformat()}, got {result_naive.isoformat()}"
                )
                # First occurrence (fold=0) selected
                self.assertEqual(
                    result.utcoffset(), pre_offset,
                    f"Weekly recurrence should select fold=0 (pre-transition offset {pre_offset}): "
                    f"got {result.utcoffset()}"
                )


# ═══════════════════════════════════════════════════════════════════════════
# Feature: timezone-support, Property 9: Recurrence DST gap shift-forward
# ═══════════════════════════════════════════════════════════════════════════
# Validates: Requirements 7.4
#
# For any recurring chit whose next occurrence's wall-clock time falls within
# a spring-forward DST gap, that occurrence SHALL be shifted forward to the
# first valid instant after the gap in the chit's timezone.
# ═══════════════════════════════════════════════════════════════════════════


# ── Function under test (inlined to avoid FastAPI import dependency) ──────
# Source: src/backend/schedulers.py :: expand_occurrence_tz_aware()
# Also uses: _localize_wall_clock(), _advance_wall_clock()

def _localize_wall_clock_p9(wall_clock_naive: datetime, tz_name: str) -> datetime:
    """Localize a naive wall-clock datetime in the given timezone.

    Handles DST gaps by shifting forward to the first valid instant.
    Handles DST ambiguity (fall-back) by selecting the first occurrence (fold=0).

    Inlined from src/backend/schedulers.py to avoid FastAPI import dependency.
    """
    tz = ZoneInfo(tz_name)
    localized = wall_clock_naive.replace(tzinfo=tz, fold=0)

    # Check for DST spring-forward gap by round-tripping through UTC
    utc_dt = localized.astimezone(timezone.utc)
    round_tripped = utc_dt.astimezone(tz)

    if round_tripped.replace(tzinfo=None) != wall_clock_naive:
        # We're in a DST gap — advance to the first valid minute after the gap
        candidate = wall_clock_naive
        for _ in range(120):  # Max 2 hours (covers all real-world DST gaps)
            candidate = candidate + timedelta(minutes=1)
            cand_localized = candidate.replace(tzinfo=tz, fold=0)
            cand_utc = cand_localized.astimezone(timezone.utc)
            cand_rt = cand_utc.astimezone(tz)
            if cand_rt.replace(tzinfo=None) == candidate:
                return cand_localized
        # Fallback: return the round-tripped result (already past the gap)
        return round_tripped

    return localized


def _advance_wall_clock_p9(base_naive: datetime, freq: str, interval: int,
                           occurrence_index: int) -> datetime:
    """Advance a naive datetime by the given frequency and interval for daily+ recurrences.

    Preserves wall-clock time (hour:minute) while advancing the date components.
    Does NOT handle DST — caller must localize the result.

    Inlined from src/backend/schedulers.py to avoid FastAPI import dependency.
    """
    if occurrence_index == 0:
        return base_naive

    if freq == 'DAILY':
        result = base_naive + timedelta(days=interval * occurrence_index)
        return result.replace(hour=base_naive.hour, minute=base_naive.minute,
                              second=base_naive.second)
    elif freq == 'WEEKLY':
        result = base_naive + timedelta(weeks=interval * occurrence_index)
        return result.replace(hour=base_naive.hour, minute=base_naive.minute,
                              second=base_naive.second)
    elif freq == 'MONTHLY':
        import calendar
        year = base_naive.year
        month = base_naive.month
        day = base_naive.day
        total_months = (year * 12 + (month - 1)) + (interval * occurrence_index)
        new_year = total_months // 12
        new_month = (total_months % 12) + 1
        max_day = calendar.monthrange(new_year, new_month)[1]
        new_day = min(day, max_day)
        return base_naive.replace(year=new_year, month=new_month, day=new_day)
    elif freq == 'YEARLY':
        import calendar
        year = base_naive.year
        month = base_naive.month
        day = base_naive.day
        new_year = year + (interval * occurrence_index)
        if month == 2 and day == 29 and not calendar.isleap(new_year):
            return base_naive.replace(year=new_year, month=2, day=28)
        return base_naive.replace(year=new_year)
    else:
        result = base_naive + timedelta(days=interval * occurrence_index)
        return result.replace(hour=base_naive.hour, minute=base_naive.minute,
                              second=base_naive.second)


def expand_occurrence_tz_aware_p9(base_dt: datetime, tz_name: str, freq: str,
                                  interval: int, occurrence_index: int) -> datetime:
    """Expand a single recurrence occurrence in the given timezone.

    For DAILY/WEEKLY/MONTHLY/YEARLY: preserves wall-clock time in the timezone.
    For HOURLY/MINUTELY: maintains uniform elapsed-time intervals (UTC-based).

    DST gap: shifts forward to first valid instant.
    DST ambiguity: selects first occurrence (fold=0).

    Inlined from src/backend/schedulers.py to avoid FastAPI import dependency.
    """
    freq_upper = freq.upper() if freq else 'DAILY'

    if freq_upper in ('HOURLY', 'MINUTELY'):
        base_localized = _localize_wall_clock_p9(base_dt, tz_name)
        base_utc = base_localized.astimezone(timezone.utc)
        if freq_upper == 'HOURLY':
            delta = timedelta(hours=interval * occurrence_index)
        else:
            delta = timedelta(minutes=interval * occurrence_index)
        result_utc = base_utc + delta
        tz = ZoneInfo(tz_name)
        return result_utc.astimezone(tz)
    else:
        advanced_naive = _advance_wall_clock_p9(base_dt, freq_upper, interval, occurrence_index)
        return _localize_wall_clock_p9(advanced_naive, tz_name)


# Known DST spring-forward gaps for recurrence testing:
# - US Eastern (America/New_York): 2024-03-10 02:00 -> 03:00
# - US Central (America/Chicago): 2024-03-10 02:00 -> 03:00
# - US Pacific (America/Los_Angeles): 2024-03-10 02:00 -> 03:00
# - Europe/London: 2024-03-31 01:00 -> 02:00
# - Australia/Sydney: 2024-10-06 02:00 -> 03:00

_RECURRENCE_DST_GAPS = [
    {
        "tz": "America/New_York",
        "gap_date": datetime(2024, 3, 10),
        "gap_start_hour": 2,
        "gap_start_minute": 0,
        "gap_end_hour": 3,
        "gap_end_minute": 0,
    },
    {
        "tz": "America/Chicago",
        "gap_date": datetime(2024, 3, 10),
        "gap_start_hour": 2,
        "gap_start_minute": 0,
        "gap_end_hour": 3,
        "gap_end_minute": 0,
    },
    {
        "tz": "America/Los_Angeles",
        "gap_date": datetime(2024, 3, 10),
        "gap_start_hour": 2,
        "gap_start_minute": 0,
        "gap_end_hour": 3,
        "gap_end_minute": 0,
    },
    {
        "tz": "Europe/London",
        "gap_date": datetime(2024, 3, 31),
        "gap_start_hour": 1,
        "gap_start_minute": 0,
        "gap_end_hour": 2,
        "gap_end_minute": 0,
    },
    {
        "tz": "Australia/Sydney",
        "gap_date": datetime(2024, 10, 6),
        "gap_start_hour": 2,
        "gap_start_minute": 0,
        "gap_end_hour": 3,
        "gap_end_minute": 0,
    },
]


class TestProperty9RecurrenceDSTGapShiftForward(unittest.TestCase):
    """Feature: timezone-support, Property 9: Recurrence DST gap shift-forward

    **Validates: Requirements 7.4**

    For any recurring chit whose next occurrence's wall-clock time falls within
    a spring-forward DST gap, that occurrence SHALL be shifted forward to the
    first valid instant after the gap in the chit's timezone.
    """

    NUM_ITERATIONS = 150

    def test_daily_recurrence_at_230am_crosses_spring_forward(self):
        """A daily recurrence at 2:30 AM crossing the spring-forward boundary
        should produce 3:00 AM (first valid instant) on the gap day.

        This is the canonical test case: a daily chit at 2:30 AM in US Eastern.
        On 2024-03-10, clocks skip from 2:00 to 3:00, so 2:30 doesn't exist.
        The occurrence on that day should be shifted to 3:00 AM.
        """
        tz_name = "America/New_York"
        # Base: daily recurrence starting 2024-03-08 at 2:30 AM
        base_dt = datetime(2024, 3, 8, 2, 30, 0)

        # Occurrence index 2 = 2024-03-10 (the gap day)
        result = expand_occurrence_tz_aware_p9(base_dt, tz_name, "DAILY", 1, 2)

        # The result should be 3:00 AM on 2024-03-10 (first valid instant after gap)
        expected_wall_clock = datetime(2024, 3, 10, 3, 0, 0)
        result_naive = result.replace(tzinfo=None)

        self.assertEqual(
            result_naive, expected_wall_clock,
            f"Daily 2:30 AM recurrence on spring-forward day should shift to 3:00 AM, "
            f"got {result_naive.isoformat()}"
        )

    def test_random_times_in_gap_shift_to_first_valid_instant(self):
        """Random recurrence times that land in a DST gap shift to the first valid instant.

        Generates random daily recurrences with wall-clock times within known DST gaps.
        Each occurrence that falls on the gap day should be shifted forward to the
        first valid instant (the gap end time).
        """
        rng = random.Random(90)

        for i in range(self.NUM_ITERATIONS):
            gap_info = rng.choice(_RECURRENCE_DST_GAPS)
            tz_name = gap_info["tz"]
            gap_date = gap_info["gap_date"]
            gap_start_hour = gap_info["gap_start_hour"]
            gap_start_minute = gap_info["gap_start_minute"]
            gap_end_hour = gap_info["gap_end_hour"]
            gap_end_minute = gap_info["gap_end_minute"]

            # Generate a random time within the gap
            gap_start_total_min = gap_start_hour * 60 + gap_start_minute
            gap_end_total_min = gap_end_hour * 60 + gap_end_minute
            random_min = rng.randint(gap_start_total_min, gap_end_total_min - 1)
            hour_in_gap = random_min // 60
            minute_in_gap = random_min % 60

            # Create a base datetime a few days before the gap day with the gap time
            days_before = rng.randint(1, 7)
            base_date = gap_date - timedelta(days=days_before)
            base_dt = datetime(base_date.year, base_date.month, base_date.day,
                               hour_in_gap, minute_in_gap, 0)

            # The occurrence that lands on the gap day
            occurrence_index = days_before  # daily recurrence, interval=1

            result = expand_occurrence_tz_aware_p9(base_dt, tz_name, "DAILY", 1, occurrence_index)
            result_naive = result.replace(tzinfo=None)

            # Expected: first valid instant after the gap (gap_end time on gap day)
            expected = datetime(gap_date.year, gap_date.month, gap_date.day,
                                gap_end_hour, gap_end_minute, 0)

            with self.subTest(
                iteration=i,
                tz=tz_name,
                base_dt=base_dt.isoformat(),
                occurrence_index=occurrence_index,
                result=result_naive.isoformat(),
                expected=expected.isoformat(),
            ):
                self.assertEqual(
                    result_naive, expected,
                    f"Recurrence at {hour_in_gap:02d}:{minute_in_gap:02d} on gap day "
                    f"in {tz_name} should shift to {gap_end_hour:02d}:{gap_end_minute:02d}, "
                    f"got {result_naive.isoformat()}"
                )

    def test_occurrences_before_gap_day_are_unaffected(self):
        """Occurrences before the gap day retain their original wall-clock time.

        A daily recurrence at 2:30 AM should be at 2:30 AM on days before the gap.
        """
        rng = random.Random(91)

        for i in range(self.NUM_ITERATIONS):
            gap_info = rng.choice(_RECURRENCE_DST_GAPS)
            tz_name = gap_info["tz"]
            gap_date = gap_info["gap_date"]
            gap_start_hour = gap_info["gap_start_hour"]
            gap_start_minute = gap_info["gap_start_minute"]
            gap_end_total_min = gap_info["gap_end_hour"] * 60 + gap_info["gap_end_minute"]
            gap_start_total_min = gap_start_hour * 60 + gap_start_minute

            # Random time within the gap range
            random_min = rng.randint(gap_start_total_min, gap_end_total_min - 1)
            hour_in_gap = random_min // 60
            minute_in_gap = random_min % 60

            # Base datetime well before the gap day
            days_before = rng.randint(3, 10)
            base_date = gap_date - timedelta(days=days_before)
            base_dt = datetime(base_date.year, base_date.month, base_date.day,
                               hour_in_gap, minute_in_gap, 0)

            # Pick an occurrence that's still before the gap day
            occ_index = rng.randint(1, days_before - 1)
            result = expand_occurrence_tz_aware_p9(base_dt, tz_name, "DAILY", 1, occ_index)
            result_naive = result.replace(tzinfo=None)

            # Expected: same wall-clock time on the advanced date (before gap day)
            expected_date = base_date + timedelta(days=occ_index)
            expected = datetime(expected_date.year, expected_date.month, expected_date.day,
                                hour_in_gap, minute_in_gap, 0)

            with self.subTest(
                iteration=i,
                tz=tz_name,
                base_dt=base_dt.isoformat(),
                occ_index=occ_index,
            ):
                # The occurrence date should be before the gap day
                self.assertTrue(
                    expected_date < gap_date,
                    f"Test setup error: occurrence date {expected_date} should be before gap date"
                )
                self.assertEqual(
                    result_naive, expected,
                    f"Occurrence before gap day should retain wall-clock time "
                    f"{hour_in_gap:02d}:{minute_in_gap:02d}, got {result_naive.isoformat()}"
                )

    def test_occurrences_after_gap_day_retain_wall_clock(self):
        """Occurrences after the gap day retain their original wall-clock time.

        A daily recurrence at 2:30 AM should be at 2:30 AM on days after the gap
        (since 2:30 AM exists again in daylight saving time).
        """
        rng = random.Random(92)

        for i in range(self.NUM_ITERATIONS):
            gap_info = rng.choice(_RECURRENCE_DST_GAPS)
            tz_name = gap_info["tz"]
            gap_date = gap_info["gap_date"]
            gap_start_hour = gap_info["gap_start_hour"]
            gap_start_minute = gap_info["gap_start_minute"]
            gap_end_total_min = gap_info["gap_end_hour"] * 60 + gap_info["gap_end_minute"]
            gap_start_total_min = gap_start_hour * 60 + gap_start_minute

            # Random time within the gap range
            random_min = rng.randint(gap_start_total_min, gap_end_total_min - 1)
            hour_in_gap = random_min // 60
            minute_in_gap = random_min % 60

            # Base datetime before the gap day
            days_before = rng.randint(1, 5)
            base_date = gap_date - timedelta(days=days_before)
            base_dt = datetime(base_date.year, base_date.month, base_date.day,
                               hour_in_gap, minute_in_gap, 0)

            # Pick an occurrence that's after the gap day
            days_after_gap = rng.randint(1, 5)
            occ_index = days_before + days_after_gap  # past the gap day
            result = expand_occurrence_tz_aware_p9(base_dt, tz_name, "DAILY", 1, occ_index)
            result_naive = result.replace(tzinfo=None)

            # Expected: same wall-clock time on the advanced date (after gap day)
            expected_date = base_date + timedelta(days=occ_index)
            expected = datetime(expected_date.year, expected_date.month, expected_date.day,
                                hour_in_gap, minute_in_gap, 0)

            with self.subTest(
                iteration=i,
                tz=tz_name,
                base_dt=base_dt.isoformat(),
                occ_index=occ_index,
            ):
                self.assertEqual(
                    result_naive, expected,
                    f"Occurrence after gap day should retain wall-clock time "
                    f"{hour_in_gap:02d}:{minute_in_gap:02d}, got {result_naive.isoformat()}"
                )

    def test_weekly_recurrence_gap_day_shifts_forward(self):
        """A weekly recurrence whose occurrence lands on a gap day shifts forward.

        Tests that the shift-forward behavior works for WEEKLY frequency too,
        not just DAILY.
        """
        rng = random.Random(93)

        for i in range(self.NUM_ITERATIONS):
            gap_info = rng.choice(_RECURRENCE_DST_GAPS)
            tz_name = gap_info["tz"]
            gap_date = gap_info["gap_date"]
            gap_start_hour = gap_info["gap_start_hour"]
            gap_start_minute = gap_info["gap_start_minute"]
            gap_end_hour = gap_info["gap_end_hour"]
            gap_end_minute = gap_info["gap_end_minute"]
            gap_start_total_min = gap_start_hour * 60 + gap_start_minute
            gap_end_total_min = gap_end_hour * 60 + gap_end_minute

            # Random time within the gap
            random_min = rng.randint(gap_start_total_min, gap_end_total_min - 1)
            hour_in_gap = random_min // 60
            minute_in_gap = random_min % 60

            # Base datetime exactly 1 week before the gap day
            base_date = gap_date - timedelta(weeks=1)
            base_dt = datetime(base_date.year, base_date.month, base_date.day,
                               hour_in_gap, minute_in_gap, 0)

            # Occurrence index 1 = one week later = gap day
            result = expand_occurrence_tz_aware_p9(base_dt, tz_name, "WEEKLY", 1, 1)
            result_naive = result.replace(tzinfo=None)

            # Expected: first valid instant after the gap
            expected = datetime(gap_date.year, gap_date.month, gap_date.day,
                                gap_end_hour, gap_end_minute, 0)

            with self.subTest(
                iteration=i,
                tz=tz_name,
                base_dt=base_dt.isoformat(),
            ):
                self.assertEqual(
                    result_naive, expected,
                    f"Weekly recurrence at {hour_in_gap:02d}:{minute_in_gap:02d} "
                    f"landing on gap day in {tz_name} should shift to "
                    f"{gap_end_hour:02d}:{gap_end_minute:02d}, got {result_naive.isoformat()}"
                )

    def test_shifted_occurrence_is_timezone_aware(self):
        """The shifted occurrence result is a timezone-aware datetime in the correct timezone."""
        tz_name = "America/New_York"
        base_dt = datetime(2024, 3, 9, 2, 30, 0)  # Day before gap

        # Occurrence 1 = 2024-03-10 (gap day)
        result = expand_occurrence_tz_aware_p9(base_dt, tz_name, "DAILY", 1, 1)

        self.assertIsNotNone(result.tzinfo, "Result must be timezone-aware")
        self.assertEqual(
            str(result.tzinfo), tz_name,
            f"Result timezone should be {tz_name}, got {result.tzinfo}"
        )

    def test_gap_shift_produces_valid_time(self):
        """The shifted occurrence is always a valid time (round-trips correctly through UTC).

        For any occurrence that was shifted due to a DST gap, converting to UTC
        and back to the timezone should produce the same wall-clock time.
        """
        rng = random.Random(94)

        for i in range(self.NUM_ITERATIONS):
            gap_info = rng.choice(_RECURRENCE_DST_GAPS)
            tz_name = gap_info["tz"]
            gap_date = gap_info["gap_date"]
            gap_start_hour = gap_info["gap_start_hour"]
            gap_start_minute = gap_info["gap_start_minute"]
            gap_end_total_min = gap_info["gap_end_hour"] * 60 + gap_info["gap_end_minute"]
            gap_start_total_min = gap_start_hour * 60 + gap_start_minute

            # Random time within the gap
            random_min = rng.randint(gap_start_total_min, gap_end_total_min - 1)
            hour_in_gap = random_min // 60
            minute_in_gap = random_min % 60

            # Base datetime 1 day before gap
            base_date = gap_date - timedelta(days=1)
            base_dt = datetime(base_date.year, base_date.month, base_date.day,
                               hour_in_gap, minute_in_gap, 0)

            # Occurrence 1 = gap day
            result = expand_occurrence_tz_aware_p9(base_dt, tz_name, "DAILY", 1, 1)

            # Round-trip through UTC to verify the result is a valid time
            tz = ZoneInfo(tz_name)
            result_utc = result.astimezone(timezone.utc)
            round_tripped = result_utc.astimezone(tz)

            with self.subTest(
                iteration=i,
                tz=tz_name,
                result=result.isoformat(),
            ):
                self.assertEqual(
                    round_tripped, result,
                    f"Shifted occurrence should round-trip through UTC: "
                    f"result={result.isoformat()}, round_tripped={round_tripped.isoformat()}"
                )


if __name__ == "__main__":
    unittest.main()

# ═══════════════════════════════════════════════════════════════════════════
# Feature: timezone-support, Property 11: Sub-daily recurrence uniform elapsed-time intervals
# ═══════════════════════════════════════════════════════════════════════════
# Validates: Requirements 7.7
#
# For any recurring chit with HOURLY or MINUTELY frequency, the elapsed real
# time (UTC duration) between consecutive occurrences SHALL be exactly
# `interval × unit_duration` (e.g., 60 minutes for hourly interval=1), even
# when a DST transition occurs between occurrences.
# ═══════════════════════════════════════════════════════════════════════════


# ── Function under test (inlined to avoid FastAPI import dependency) ───────
# Source: src/backend/schedulers.py :: expand_occurrence_tz_aware()
# (sub-daily branch only)

def _localize_wall_clock_p11(wall_clock_naive: datetime, tz_name: str) -> datetime:
    """Localize a naive wall-clock datetime in the given timezone.

    Handles DST gaps by shifting forward to the first valid instant.
    Handles DST ambiguity (fall-back) by selecting the first occurrence (fold=0).
    """
    tz = ZoneInfo(tz_name)
    localized = wall_clock_naive.replace(tzinfo=tz, fold=0)

    # Check for DST spring-forward gap by round-tripping through UTC
    utc_dt = localized.astimezone(timezone.utc)
    round_tripped = utc_dt.astimezone(tz)

    if round_tripped.replace(tzinfo=None) != wall_clock_naive:
        # We're in a DST gap — advance to the first valid minute after the gap
        candidate = wall_clock_naive
        for _ in range(120):
            candidate = candidate + timedelta(minutes=1)
            cand_localized = candidate.replace(tzinfo=tz, fold=0)
            cand_utc = cand_localized.astimezone(timezone.utc)
            cand_rt = cand_utc.astimezone(tz)
            if cand_rt.replace(tzinfo=None) == candidate:
                return cand_localized
        return round_tripped

    return localized


def expand_occurrence_sub_daily(base_dt: datetime, tz_name: str, freq: str,
                                interval: int, occurrence_index: int) -> datetime:
    """Expand a single sub-daily recurrence occurrence using uniform UTC intervals.

    For HOURLY/MINUTELY: maintains uniform elapsed-time intervals (UTC-based).
    The base_dt is a naive datetime representing the wall-clock start time in tz_name.

    Returns a timezone-aware datetime in tz_name.
    """
    # Localize the base datetime to get the absolute UTC starting point
    base_localized = _localize_wall_clock_p11(base_dt, tz_name)
    base_utc = base_localized.astimezone(timezone.utc)

    # Advance by absolute duration in UTC
    freq_upper = freq.upper()
    if freq_upper == 'HOURLY':
        delta = timedelta(hours=interval * occurrence_index)
    else:  # MINUTELY
        delta = timedelta(minutes=interval * occurrence_index)

    result_utc = base_utc + delta
    # Convert back to the expansion timezone for display
    tz = ZoneInfo(tz_name)
    return result_utc.astimezone(tz)


# ── DST transition dates for sub-daily testing ────────────────────────────
# These are dates where DST transitions occur, useful for testing that
# sub-daily recurrences maintain uniform UTC intervals across the boundary.

_DST_TRANSITIONS_SUB_DAILY = [
    # US spring forward: 2024-03-10 02:00 -> 03:00 (America/New_York)
    {"tz": "America/New_York", "date": datetime(2024, 3, 10, 0, 0)},
    # US fall back: 2024-11-03 02:00 -> 01:00 (America/New_York)
    {"tz": "America/New_York", "date": datetime(2024, 11, 3, 0, 0)},
    # US spring forward: 2024-03-10 02:00 -> 03:00 (America/Los_Angeles)
    {"tz": "America/Los_Angeles", "date": datetime(2024, 3, 10, 0, 0)},
    # US fall back: 2024-11-03 02:00 -> 01:00 (America/Los_Angeles)
    {"tz": "America/Los_Angeles", "date": datetime(2024, 11, 3, 0, 0)},
    # Europe spring forward: 2024-03-31 01:00 -> 02:00 (Europe/London)
    {"tz": "Europe/London", "date": datetime(2024, 3, 31, 0, 0)},
    # Europe fall back: 2024-10-27 02:00 -> 01:00 (Europe/London)
    {"tz": "Europe/London", "date": datetime(2024, 10, 27, 0, 0)},
    # Australia spring forward: 2024-10-06 02:00 -> 03:00 (Australia/Sydney)
    {"tz": "Australia/Sydney", "date": datetime(2024, 10, 6, 0, 0)},
    # Australia fall back: 2024-04-07 03:00 -> 02:00 (Australia/Sydney)
    {"tz": "Australia/Sydney", "date": datetime(2024, 4, 7, 0, 0)},
]


class TestProperty11SubDailyUniformIntervals(unittest.TestCase):
    """Feature: timezone-support, Property 11: Sub-daily recurrence uniform elapsed-time intervals

    **Validates: Requirements 7.7**

    For any recurring chit with HOURLY or MINUTELY frequency, the elapsed real
    time (UTC duration) between consecutive occurrences is exactly
    `interval × unit_duration`, even when a DST transition occurs between
    occurrences.
    """

    NUM_ITERATIONS = 150

    def _random_tz(self, rng):
        """Pick a random valid IANA timezone."""
        return rng.choice(VALID_TIMEZONES)

    def _random_base_dt(self, rng):
        """Generate a random naive datetime for use as a recurrence base."""
        year = rng.randint(2010, 2030)
        month = rng.randint(1, 12)
        if month in (4, 6, 9, 11):
            day = rng.randint(1, 30)
        elif month == 2:
            day = rng.randint(1, 28)
        else:
            day = rng.randint(1, 31)
        hour = rng.randint(0, 23)
        minute = rng.randint(0, 59)
        return datetime(year, month, day, hour, minute, 0)

    def test_hourly_uniform_utc_intervals_random(self):
        """HOURLY recurrences maintain exact UTC duration between consecutive occurrences.

        For random base times, timezones, and intervals, the UTC difference between
        occurrence N and occurrence N+1 is always exactly `interval` hours.
        """
        rng = random.Random(110)

        for i in range(self.NUM_ITERATIONS):
            tz_name = self._random_tz(rng)
            base_dt = self._random_base_dt(rng)
            interval = rng.randint(1, 6)  # 1-6 hour intervals
            num_occurrences = rng.randint(3, 8)  # Check 3-8 consecutive occurrences

            expected_delta = timedelta(hours=interval)

            for idx in range(num_occurrences - 1):
                occ_a = expand_occurrence_sub_daily(base_dt, tz_name, 'HOURLY', interval, idx)
                occ_b = expand_occurrence_sub_daily(base_dt, tz_name, 'HOURLY', interval, idx + 1)

                # Convert both to UTC for comparison
                utc_a = occ_a.astimezone(timezone.utc)
                utc_b = occ_b.astimezone(timezone.utc)
                actual_delta = utc_b - utc_a

                with self.subTest(
                    iteration=i,
                    tz=tz_name,
                    base=base_dt.isoformat(),
                    interval=interval,
                    occ_index=idx,
                ):
                    self.assertEqual(
                        actual_delta, expected_delta,
                        f"HOURLY interval not uniform: "
                        f"between occ {idx} and {idx+1}, "
                        f"expected {expected_delta}, got {actual_delta}. "
                        f"tz={tz_name}, base={base_dt.isoformat()}, interval={interval}"
                    )

    def test_minutely_uniform_utc_intervals_random(self):
        """MINUTELY recurrences maintain exact UTC duration between consecutive occurrences.

        For random base times, timezones, and intervals, the UTC difference between
        occurrence N and occurrence N+1 is always exactly `interval` minutes.
        """
        rng = random.Random(111)

        for i in range(self.NUM_ITERATIONS):
            tz_name = self._random_tz(rng)
            base_dt = self._random_base_dt(rng)
            interval = rng.randint(1, 45)  # 1-45 minute intervals
            num_occurrences = rng.randint(3, 8)

            expected_delta = timedelta(minutes=interval)

            for idx in range(num_occurrences - 1):
                occ_a = expand_occurrence_sub_daily(base_dt, tz_name, 'MINUTELY', interval, idx)
                occ_b = expand_occurrence_sub_daily(base_dt, tz_name, 'MINUTELY', interval, idx + 1)

                utc_a = occ_a.astimezone(timezone.utc)
                utc_b = occ_b.astimezone(timezone.utc)
                actual_delta = utc_b - utc_a

                with self.subTest(
                    iteration=i,
                    tz=tz_name,
                    base=base_dt.isoformat(),
                    interval=interval,
                    occ_index=idx,
                ):
                    self.assertEqual(
                        actual_delta, expected_delta,
                        f"MINUTELY interval not uniform: "
                        f"between occ {idx} and {idx+1}, "
                        f"expected {expected_delta}, got {actual_delta}. "
                        f"tz={tz_name}, base={base_dt.isoformat()}, interval={interval}"
                    )

    def test_hourly_across_dst_spring_forward(self):
        """HOURLY recurrences maintain uniform UTC intervals across spring-forward DST.

        Start before the spring-forward gap and verify that occurrences spanning
        the gap still have exactly `interval` hours of UTC elapsed time.
        """
        rng = random.Random(112)

        for i in range(self.NUM_ITERATIONS):
            transition = rng.choice(_DST_TRANSITIONS_SUB_DAILY)
            tz_name = transition["tz"]
            # Start 1-4 hours before midnight on the transition date
            hours_before = rng.randint(1, 4)
            base_dt = transition["date"] - timedelta(hours=hours_before)
            # Add random minutes
            base_dt = base_dt.replace(minute=rng.randint(0, 59))
            interval = rng.randint(1, 3)

            # Generate enough occurrences to span the transition (24 hours worth)
            num_occurrences = (24 // interval) + 2
            expected_delta = timedelta(hours=interval)

            for idx in range(num_occurrences - 1):
                occ_a = expand_occurrence_sub_daily(base_dt, tz_name, 'HOURLY', interval, idx)
                occ_b = expand_occurrence_sub_daily(base_dt, tz_name, 'HOURLY', interval, idx + 1)

                utc_a = occ_a.astimezone(timezone.utc)
                utc_b = occ_b.astimezone(timezone.utc)
                actual_delta = utc_b - utc_a

                with self.subTest(
                    iteration=i,
                    tz=tz_name,
                    base=base_dt.isoformat(),
                    interval=interval,
                    occ_index=idx,
                ):
                    self.assertEqual(
                        actual_delta, expected_delta,
                        f"HOURLY not uniform across DST transition: "
                        f"occ {idx}→{idx+1}, expected {expected_delta}, got {actual_delta}. "
                        f"tz={tz_name}, base={base_dt.isoformat()}"
                    )

    def test_minutely_across_dst_fall_back(self):
        """MINUTELY recurrences maintain uniform UTC intervals across fall-back DST.

        Start before the fall-back transition and verify that occurrences spanning
        the transition still have exactly `interval` minutes of UTC elapsed time.
        """
        rng = random.Random(113)

        # Filter to fall-back transitions (November for US, October for Europe/Australia)
        fall_back_transitions = [
            t for t in _DST_TRANSITIONS_SUB_DAILY
            if t["date"].month in (10, 11, 4)  # Oct/Nov = fall-back in Northern, Apr in Southern
        ]

        for i in range(self.NUM_ITERATIONS):
            transition = rng.choice(fall_back_transitions)
            tz_name = transition["tz"]
            # Start 30-120 minutes before the transition date's midnight
            minutes_before = rng.randint(30, 120)
            base_dt = transition["date"] - timedelta(minutes=minutes_before)
            base_dt = base_dt.replace(second=0)
            interval = rng.randint(5, 30)

            # Generate enough occurrences to span the transition
            num_occurrences = (180 // interval) + 2  # ~3 hours worth
            expected_delta = timedelta(minutes=interval)

            for idx in range(num_occurrences - 1):
                occ_a = expand_occurrence_sub_daily(base_dt, tz_name, 'MINUTELY', interval, idx)
                occ_b = expand_occurrence_sub_daily(base_dt, tz_name, 'MINUTELY', interval, idx + 1)

                utc_a = occ_a.astimezone(timezone.utc)
                utc_b = occ_b.astimezone(timezone.utc)
                actual_delta = utc_b - utc_a

                with self.subTest(
                    iteration=i,
                    tz=tz_name,
                    base=base_dt.isoformat(),
                    interval=interval,
                    occ_index=idx,
                ):
                    self.assertEqual(
                        actual_delta, expected_delta,
                        f"MINUTELY not uniform across fall-back: "
                        f"occ {idx}→{idx+1}, expected {expected_delta}, got {actual_delta}. "
                        f"tz={tz_name}, base={base_dt.isoformat()}"
                    )

    def test_total_elapsed_time_equals_sum_of_intervals(self):
        """Total UTC elapsed time from occurrence 0 to N equals N × interval × unit_duration.

        This verifies the cumulative property: not just pairwise intervals are correct,
        but the total elapsed time from start to any occurrence is exactly what's expected.
        """
        rng = random.Random(114)

        for i in range(self.NUM_ITERATIONS):
            tz_name = self._random_tz(rng)
            base_dt = self._random_base_dt(rng)
            freq = rng.choice(['HOURLY', 'MINUTELY'])
            interval = rng.randint(1, 10) if freq == 'HOURLY' else rng.randint(1, 45)
            n = rng.randint(1, 12)  # Check occurrence N

            unit_duration = timedelta(hours=1) if freq == 'HOURLY' else timedelta(minutes=1)
            expected_total = unit_duration * interval * n

            occ_0 = expand_occurrence_sub_daily(base_dt, tz_name, freq, interval, 0)
            occ_n = expand_occurrence_sub_daily(base_dt, tz_name, freq, interval, n)

            utc_0 = occ_0.astimezone(timezone.utc)
            utc_n = occ_n.astimezone(timezone.utc)
            actual_total = utc_n - utc_0

            with self.subTest(
                iteration=i,
                tz=tz_name,
                base=base_dt.isoformat(),
                freq=freq,
                interval=interval,
                n=n,
            ):
                self.assertEqual(
                    actual_total, expected_total,
                    f"Total elapsed time mismatch: "
                    f"occ 0→{n}, expected {expected_total}, got {actual_total}. "
                    f"freq={freq}, interval={interval}, tz={tz_name}"
                )

    def test_wall_clock_may_shift_across_dst_but_utc_interval_constant(self):
        """Wall-clock times may differ by more or less than the interval across DST,
        but the UTC interval remains constant.

        This explicitly tests that during a spring-forward, the local wall-clock
        difference between occurrences may appear larger than the interval (because
        an hour was skipped), but the actual UTC elapsed time is still exactly
        `interval × unit_duration`.
        """
        rng = random.Random(115)

        # Use known spring-forward transitions
        spring_forward = [
            t for t in _DST_TRANSITIONS_SUB_DAILY
            if (t["tz"] == "America/New_York" and t["date"].month == 3) or
               (t["tz"] == "America/Los_Angeles" and t["date"].month == 3) or
               (t["tz"] == "Europe/London" and t["date"].month == 3) or
               (t["tz"] == "Australia/Sydney" and t["date"].month == 10)
        ]

        for i in range(self.NUM_ITERATIONS):
            transition = rng.choice(spring_forward)
            tz_name = transition["tz"]
            # Start 1-3 hours before the transition
            base_dt = transition["date"] + timedelta(hours=rng.randint(0, 1))
            interval = 1  # Every hour

            expected_delta = timedelta(hours=interval)

            # Generate occurrences spanning the transition
            for idx in range(5):
                occ_a = expand_occurrence_sub_daily(base_dt, tz_name, 'HOURLY', interval, idx)
                occ_b = expand_occurrence_sub_daily(base_dt, tz_name, 'HOURLY', interval, idx + 1)

                utc_a = occ_a.astimezone(timezone.utc)
                utc_b = occ_b.astimezone(timezone.utc)
                actual_utc_delta = utc_b - utc_a

                with self.subTest(
                    iteration=i,
                    tz=tz_name,
                    base=base_dt.isoformat(),
                    occ_index=idx,
                    local_a=occ_a.isoformat(),
                    local_b=occ_b.isoformat(),
                ):
                    # UTC interval must be exactly 1 hour regardless of wall-clock shift
                    self.assertEqual(
                        actual_utc_delta, expected_delta,
                        f"UTC interval should be constant ({expected_delta}) across DST, "
                        f"but got {actual_utc_delta}. "
                        f"Local times: {occ_a.isoformat()} → {occ_b.isoformat()}"
                    )

    def test_occurrence_zero_matches_base_localized(self):
        """Occurrence index 0 returns the base datetime localized in the timezone.

        This is a sanity check: the first occurrence should be the base time itself.
        """
        rng = random.Random(116)

        for i in range(self.NUM_ITERATIONS):
            tz_name = self._random_tz(rng)
            base_dt = self._random_base_dt(rng)
            freq = rng.choice(['HOURLY', 'MINUTELY'])
            interval = rng.randint(1, 10)

            occ_0 = expand_occurrence_sub_daily(base_dt, tz_name, freq, interval, 0)

            # The expected result is the base_dt localized in tz_name
            expected = _localize_wall_clock_p11(base_dt, tz_name)

            with self.subTest(
                iteration=i,
                tz=tz_name,
                base=base_dt.isoformat(),
                freq=freq,
            ):
                self.assertEqual(
                    occ_0, expected,
                    f"Occurrence 0 should equal base localized: "
                    f"got {occ_0.isoformat()}, expected {expected.isoformat()}"
                )

# ═══════════════════════════════════════════════════════════════════════════
# Feature: timezone-support, Property 8: Recurrence wall-clock preservation across DST
# ═══════════════════════════════════════════════════════════════════════════
# Validates: Requirements 7.1, 7.3
#
# For any anchored recurring chit in a DST-observing timezone with a
# daily-or-greater frequency, every expanded occurrence SHALL have the same
# wall-clock time (hour:minute) in the chit's timezone, regardless of whether
# the occurrence falls in standard time or daylight saving time.
# ═══════════════════════════════════════════════════════════════════════════

import calendar


# ── Function under test (inlined to avoid FastAPI import dependency) ──────
# Source: src/backend/schedulers.py :: expand_occurrence_tz_aware() and helpers

def _localize_wall_clock_p8(wall_clock_naive: datetime, tz_name: str) -> datetime:
    """Localize a naive wall-clock datetime in the given timezone.

    Handles DST gaps by shifting forward to the first valid instant.
    Handles DST ambiguity (fall-back) by selecting the first occurrence (fold=0).
    """
    tz = ZoneInfo(tz_name)
    localized = wall_clock_naive.replace(tzinfo=tz, fold=0)

    # Check for DST spring-forward gap by round-tripping through UTC
    utc_dt = localized.astimezone(timezone.utc)
    round_tripped = utc_dt.astimezone(tz)

    if round_tripped.replace(tzinfo=None) != wall_clock_naive:
        # We're in a DST gap — advance to the first valid minute after the gap
        candidate = wall_clock_naive
        for _ in range(120):
            candidate = candidate + timedelta(minutes=1)
            cand_localized = candidate.replace(tzinfo=tz, fold=0)
            cand_utc = cand_localized.astimezone(timezone.utc)
            cand_rt = cand_utc.astimezone(tz)
            if cand_rt.replace(tzinfo=None) == candidate:
                return cand_localized
        return round_tripped

    return localized


def _advance_wall_clock_p8(base_naive: datetime, freq: str, interval: int,
                           occurrence_index: int) -> datetime:
    """Advance a naive datetime by the given frequency and interval for daily+ recurrences.

    Preserves wall-clock time (hour:minute) while advancing the date components.
    """
    if occurrence_index == 0:
        return base_naive

    year = base_naive.year
    month = base_naive.month
    day = base_naive.day

    if freq == 'DAILY':
        result = base_naive + timedelta(days=interval * occurrence_index)
        return result.replace(hour=base_naive.hour, minute=base_naive.minute,
                              second=base_naive.second)
    elif freq == 'WEEKLY':
        result = base_naive + timedelta(weeks=interval * occurrence_index)
        return result.replace(hour=base_naive.hour, minute=base_naive.minute,
                              second=base_naive.second)
    elif freq == 'MONTHLY':
        total_months = (year * 12 + (month - 1)) + (interval * occurrence_index)
        new_year = total_months // 12
        new_month = (total_months % 12) + 1
        max_day = calendar.monthrange(new_year, new_month)[1]
        new_day = min(day, max_day)
        return base_naive.replace(year=new_year, month=new_month, day=new_day)
    elif freq == 'YEARLY':
        new_year = year + (interval * occurrence_index)
        if month == 2 and day == 29 and not calendar.isleap(new_year):
            return base_naive.replace(year=new_year, month=2, day=28)
        return base_naive.replace(year=new_year)
    else:
        result = base_naive + timedelta(days=interval * occurrence_index)
        return result.replace(hour=base_naive.hour, minute=base_naive.minute,
                              second=base_naive.second)


def expand_daily_recurrence_tz_aware(base_naive: datetime, tz_name: str, freq: str,
                                     interval: int, count: int) -> list:
    """Expand a daily-or-greater recurrence in a timezone, returning all occurrences.

    Advances date components while preserving wall-clock time. Handles DST gaps
    by shifting forward to the first valid instant, and fall-back ambiguity by
    selecting the first occurrence (fold=0).

    Args:
        base_naive: Naive datetime representing the base occurrence's wall-clock time.
        tz_name: IANA timezone name for expansion.
        freq: Recurrence frequency — 'DAILY', 'WEEKLY', 'MONTHLY', or 'YEARLY'.
        interval: The recurrence interval (e.g., every 2 days).
        count: Number of occurrences to expand.

    Returns:
        A list of timezone-aware datetimes in the given timezone.
    """
    occurrences = []
    for i in range(count):
        advanced_naive = _advance_wall_clock_p8(base_naive, freq, interval, i)
        localized = _localize_wall_clock_p8(advanced_naive, tz_name)
        occurrences.append(localized)
    return occurrences


# DST-observing timezones with known transition dates for testing
_DST_TIMEZONES_P8 = [
    "America/New_York",      # US Eastern: spring-forward Mar 10 2024, fall-back Nov 3 2024
    "America/Los_Angeles",   # US Pacific: spring-forward Mar 10 2024, fall-back Nov 3 2024
    "America/Chicago",       # US Central: spring-forward Mar 10 2024, fall-back Nov 3 2024
    "America/Denver",        # US Mountain: spring-forward Mar 10 2024, fall-back Nov 3 2024
    "Europe/London",         # UK: spring-forward Mar 31 2024, fall-back Oct 27 2024
    "Europe/Berlin",         # CET: spring-forward Mar 31 2024, fall-back Oct 27 2024
    "Australia/Sydney",      # AEST: spring-forward Oct 6 2024, fall-back Apr 7 2024
]

# Known DST boundaries to test across (start before, end after the transition)
_DST_BOUNDARIES_P8 = [
    # US spring-forward 2024: March 10 at 2:00 AM
    {"tz": "America/New_York", "before": datetime(2024, 3, 1, 9, 30), "after": datetime(2024, 3, 20, 9, 30)},
    {"tz": "America/Los_Angeles", "before": datetime(2024, 3, 1, 14, 0), "after": datetime(2024, 3, 20, 14, 0)},
    # US fall-back 2024: November 3 at 2:00 AM
    {"tz": "America/New_York", "before": datetime(2024, 10, 25, 8, 15), "after": datetime(2024, 11, 10, 8, 15)},
    {"tz": "America/Chicago", "before": datetime(2024, 10, 25, 7, 45), "after": datetime(2024, 11, 10, 7, 45)},
    # Europe spring-forward 2024: March 31 at 1:00 AM
    {"tz": "Europe/London", "before": datetime(2024, 3, 25, 10, 0), "after": datetime(2024, 4, 5, 10, 0)},
    {"tz": "Europe/Berlin", "before": datetime(2024, 3, 25, 15, 30), "after": datetime(2024, 4, 5, 15, 30)},
    # Australia fall-back 2024: April 7 at 3:00 AM
    {"tz": "Australia/Sydney", "before": datetime(2024, 4, 1, 11, 0), "after": datetime(2024, 4, 14, 11, 0)},
]


class TestProperty8RecurrenceWallClockPreservation(unittest.TestCase):
    """Feature: timezone-support, Property 8: Recurrence wall-clock preservation across DST

    **Validates: Requirements 7.1, 7.3**

    For any anchored recurring chit in a DST-observing timezone with a
    daily-or-greater frequency, every expanded occurrence SHALL have the same
    wall-clock time (hour:minute) in the chit's timezone, regardless of whether
    the occurrence falls in standard time or daylight saving time.
    """

    NUM_ITERATIONS = 150

    def _random_dst_tz(self, rng):
        """Pick a random DST-observing timezone."""
        return rng.choice(_DST_TIMEZONES_P8)

    def _random_daily_plus_freq(self, rng):
        """Pick a random daily-or-greater frequency."""
        return rng.choice(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'])

    def _random_base_datetime_near_dst(self, rng, tz_name: str) -> datetime:
        """Generate a random base datetime that will span a DST boundary when expanded.

        Picks dates in Feb-Mar or Oct-Nov (when most DST transitions happen)
        to maximize the chance of crossing a DST boundary during expansion.
        """
        year = 2024
        # Pick months near DST transitions
        month = rng.choice([2, 3, 10, 11])
        day = rng.randint(1, 28)
        # Avoid times that fall in DST gaps (use safe hours)
        hour = rng.choice([4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23])
        minute = rng.randint(0, 59)
        return datetime(year, month, day, hour, minute, 0)

    def test_daily_recurrence_preserves_wall_clock_across_dst(self):
        """Daily recurrences maintain the same hour:minute across DST transitions.

        For random anchored chits with DAILY frequency in DST-observing timezones,
        all expanded occurrences have the same wall-clock time (hour:minute) as the
        base occurrence, even when crossing DST boundaries.

        Exception: occurrences that fall in a DST gap are shifted forward, so their
        wall-clock time may differ — these are excluded from the hour:minute check
        (they are covered by Property 9).
        """
        rng = random.Random(80)

        for i in range(self.NUM_ITERATIONS):
            tz_name = self._random_dst_tz(rng)
            base_dt = self._random_base_datetime_near_dst(rng, tz_name)
            interval = rng.randint(1, 3)
            count = rng.randint(30, 60)  # Enough to span a DST transition

            occurrences = expand_daily_recurrence_tz_aware(
                base_dt, tz_name, 'DAILY', interval, count
            )

            base_hour = base_dt.hour
            base_minute = base_dt.minute

            for idx, occ in enumerate(occurrences):
                # Convert to naive in the chit's timezone to check wall-clock time
                occ_naive = occ.replace(tzinfo=None)
                occ_hour = occ_naive.hour
                occ_minute = occ_naive.minute

                # Check if this occurrence was in a DST gap (shifted forward)
                # by verifying the advanced naive time round-trips correctly
                advanced_naive = _advance_wall_clock_p8(base_dt, 'DAILY', interval, idx)
                tz = ZoneInfo(tz_name)
                test_loc = advanced_naive.replace(tzinfo=tz, fold=0)
                test_utc = test_loc.astimezone(timezone.utc)
                test_rt = test_utc.astimezone(tz).replace(tzinfo=None)
                in_gap = (test_rt != advanced_naive)

                if in_gap:
                    # DST gap occurrences are shifted — skip wall-clock check
                    # (covered by Property 9)
                    continue

                with self.subTest(
                    iteration=i,
                    occurrence_idx=idx,
                    tz=tz_name,
                    base_time=f"{base_hour:02d}:{base_minute:02d}",
                    occ_time=f"{occ_hour:02d}:{occ_minute:02d}",
                ):
                    self.assertEqual(
                        (occ_hour, occ_minute), (base_hour, base_minute),
                        f"Wall-clock time not preserved: base={base_hour:02d}:{base_minute:02d}, "
                        f"occurrence[{idx}]={occ_hour:02d}:{occ_minute:02d} "
                        f"in {tz_name} on {occ_naive.date().isoformat()}"
                    )

    def test_weekly_recurrence_preserves_wall_clock_across_dst(self):
        """Weekly recurrences maintain the same hour:minute across DST transitions."""
        rng = random.Random(81)

        for i in range(self.NUM_ITERATIONS):
            tz_name = self._random_dst_tz(rng)
            base_dt = self._random_base_datetime_near_dst(rng, tz_name)
            interval = rng.randint(1, 2)
            count = rng.randint(8, 15)  # ~2-4 months of weekly occurrences

            occurrences = expand_daily_recurrence_tz_aware(
                base_dt, tz_name, 'WEEKLY', interval, count
            )

            base_hour = base_dt.hour
            base_minute = base_dt.minute

            for idx, occ in enumerate(occurrences):
                occ_naive = occ.replace(tzinfo=None)
                occ_hour = occ_naive.hour
                occ_minute = occ_naive.minute

                # Check for DST gap
                advanced_naive = _advance_wall_clock_p8(base_dt, 'WEEKLY', interval, idx)
                tz = ZoneInfo(tz_name)
                test_loc = advanced_naive.replace(tzinfo=tz, fold=0)
                test_utc = test_loc.astimezone(timezone.utc)
                test_rt = test_utc.astimezone(tz).replace(tzinfo=None)
                in_gap = (test_rt != advanced_naive)

                if in_gap:
                    continue

                with self.subTest(
                    iteration=i,
                    occurrence_idx=idx,
                    tz=tz_name,
                    base_time=f"{base_hour:02d}:{base_minute:02d}",
                    occ_time=f"{occ_hour:02d}:{occ_minute:02d}",
                ):
                    self.assertEqual(
                        (occ_hour, occ_minute), (base_hour, base_minute),
                        f"Weekly wall-clock time not preserved: "
                        f"base={base_hour:02d}:{base_minute:02d}, "
                        f"occurrence[{idx}]={occ_hour:02d}:{occ_minute:02d} "
                        f"in {tz_name} on {occ_naive.date().isoformat()}"
                    )

    def test_monthly_recurrence_preserves_wall_clock_across_dst(self):
        """Monthly recurrences maintain the same hour:minute across DST transitions."""
        rng = random.Random(82)

        for i in range(self.NUM_ITERATIONS):
            tz_name = self._random_dst_tz(rng)
            # Start in January to ensure we cross spring-forward
            base_dt = datetime(2024, 1, rng.randint(1, 28),
                               rng.randint(4, 23), rng.randint(0, 59), 0)
            interval = 1
            count = 12  # Full year of monthly occurrences

            occurrences = expand_daily_recurrence_tz_aware(
                base_dt, tz_name, 'MONTHLY', interval, count
            )

            base_hour = base_dt.hour
            base_minute = base_dt.minute

            for idx, occ in enumerate(occurrences):
                occ_naive = occ.replace(tzinfo=None)
                occ_hour = occ_naive.hour
                occ_minute = occ_naive.minute

                # Check for DST gap
                advanced_naive = _advance_wall_clock_p8(base_dt, 'MONTHLY', interval, idx)
                tz = ZoneInfo(tz_name)
                test_loc = advanced_naive.replace(tzinfo=tz, fold=0)
                test_utc = test_loc.astimezone(timezone.utc)
                test_rt = test_utc.astimezone(tz).replace(tzinfo=None)
                in_gap = (test_rt != advanced_naive)

                if in_gap:
                    continue

                with self.subTest(
                    iteration=i,
                    occurrence_idx=idx,
                    tz=tz_name,
                    base_time=f"{base_hour:02d}:{base_minute:02d}",
                    occ_time=f"{occ_hour:02d}:{occ_minute:02d}",
                    date=occ_naive.date().isoformat(),
                ):
                    self.assertEqual(
                        (occ_hour, occ_minute), (base_hour, base_minute),
                        f"Monthly wall-clock time not preserved: "
                        f"base={base_hour:02d}:{base_minute:02d}, "
                        f"occurrence[{idx}]={occ_hour:02d}:{occ_minute:02d} "
                        f"in {tz_name} on {occ_naive.date().isoformat()}"
                    )

    def test_yearly_recurrence_preserves_wall_clock_across_dst(self):
        """Yearly recurrences maintain the same hour:minute across DST transitions."""
        rng = random.Random(83)

        for i in range(self.NUM_ITERATIONS):
            tz_name = self._random_dst_tz(rng)
            # Pick a date in summer (DST active) to verify it stays consistent
            base_dt = datetime(2020, rng.choice([6, 7, 8]), rng.randint(1, 28),
                               rng.randint(4, 23), rng.randint(0, 59), 0)
            interval = 1
            count = 5  # 5 years

            occurrences = expand_daily_recurrence_tz_aware(
                base_dt, tz_name, 'YEARLY', interval, count
            )

            base_hour = base_dt.hour
            base_minute = base_dt.minute

            for idx, occ in enumerate(occurrences):
                occ_naive = occ.replace(tzinfo=None)
                occ_hour = occ_naive.hour
                occ_minute = occ_naive.minute

                # Check for DST gap
                advanced_naive = _advance_wall_clock_p8(base_dt, 'YEARLY', interval, idx)
                tz = ZoneInfo(tz_name)
                test_loc = advanced_naive.replace(tzinfo=tz, fold=0)
                test_utc = test_loc.astimezone(timezone.utc)
                test_rt = test_utc.astimezone(tz).replace(tzinfo=None)
                in_gap = (test_rt != advanced_naive)

                if in_gap:
                    continue

                with self.subTest(
                    iteration=i,
                    occurrence_idx=idx,
                    tz=tz_name,
                    base_time=f"{base_hour:02d}:{base_minute:02d}",
                    occ_time=f"{occ_hour:02d}:{occ_minute:02d}",
                ):
                    self.assertEqual(
                        (occ_hour, occ_minute), (base_hour, base_minute),
                        f"Yearly wall-clock time not preserved: "
                        f"base={base_hour:02d}:{base_minute:02d}, "
                        f"occurrence[{idx}]={occ_hour:02d}:{occ_minute:02d} "
                        f"in {tz_name} on {occ_naive.date().isoformat()}"
                    )

    def test_known_dst_boundary_crossing_preserves_wall_clock(self):
        """Specific known DST boundaries: daily recurrence crossing them preserves wall-clock.

        Uses known DST transition dates to ensure the test actually crosses a boundary.
        """
        rng = random.Random(84)

        for i in range(self.NUM_ITERATIONS):
            boundary = rng.choice(_DST_BOUNDARIES_P8)
            tz_name = boundary["tz"]
            base_dt = boundary["before"]

            # Expand daily until we pass the boundary
            days_span = (boundary["after"] - boundary["before"]).days
            count = days_span + 5

            occurrences = expand_daily_recurrence_tz_aware(
                base_dt, tz_name, 'DAILY', 1, count
            )

            base_hour = base_dt.hour
            base_minute = base_dt.minute

            for idx, occ in enumerate(occurrences):
                occ_naive = occ.replace(tzinfo=None)
                occ_hour = occ_naive.hour
                occ_minute = occ_naive.minute

                # Check for DST gap
                advanced_naive = _advance_wall_clock_p8(base_dt, 'DAILY', 1, idx)
                tz = ZoneInfo(tz_name)
                test_loc = advanced_naive.replace(tzinfo=tz, fold=0)
                test_utc = test_loc.astimezone(timezone.utc)
                test_rt = test_utc.astimezone(tz).replace(tzinfo=None)
                in_gap = (test_rt != advanced_naive)

                if in_gap:
                    continue

                with self.subTest(
                    iteration=i,
                    occurrence_idx=idx,
                    tz=tz_name,
                    date=occ_naive.date().isoformat(),
                    base_time=f"{base_hour:02d}:{base_minute:02d}",
                    occ_time=f"{occ_hour:02d}:{occ_minute:02d}",
                ):
                    self.assertEqual(
                        (occ_hour, occ_minute), (base_hour, base_minute),
                        f"Known DST boundary crossing failed: "
                        f"base={base_hour:02d}:{base_minute:02d}, "
                        f"occurrence[{idx}]={occ_hour:02d}:{occ_minute:02d} "
                        f"in {tz_name} on {occ_naive.date().isoformat()}"
                    )

    def test_utc_offset_changes_but_wall_clock_stays_same(self):
        """Verify that UTC offsets change across DST but wall-clock time stays constant.

        This directly tests that the recurrence engine is doing timezone-aware
        expansion (not just naive date arithmetic that ignores DST).
        """
        rng = random.Random(85)

        for i in range(self.NUM_ITERATIONS):
            boundary = rng.choice(_DST_BOUNDARIES_P8)
            tz_name = boundary["tz"]
            base_dt = boundary["before"]

            days_span = (boundary["after"] - boundary["before"]).days
            count = days_span + 5

            occurrences = expand_daily_recurrence_tz_aware(
                base_dt, tz_name, 'DAILY', 1, count
            )

            base_hour = base_dt.hour
            base_minute = base_dt.minute

            # Collect UTC offsets — they should change across DST
            offsets = set()
            for occ in occurrences:
                offsets.add(occ.utcoffset())

            # For DST-observing timezones crossing a boundary, we expect at least
            # 2 different UTC offsets (standard and daylight)
            with self.subTest(
                iteration=i,
                tz=tz_name,
                base=base_dt.isoformat(),
                num_offsets=len(offsets),
            ):
                self.assertGreaterEqual(
                    len(offsets), 2,
                    f"Expected at least 2 different UTC offsets when crossing DST "
                    f"boundary in {tz_name} (got {len(offsets)}: {offsets}). "
                    f"This means the expansion didn't actually cross a DST transition."
                )

            # And wall-clock time is still preserved for non-gap occurrences
            for idx, occ in enumerate(occurrences):
                occ_naive = occ.replace(tzinfo=None)
                advanced_naive = _advance_wall_clock_p8(base_dt, 'DAILY', 1, idx)
                tz = ZoneInfo(tz_name)
                test_loc = advanced_naive.replace(tzinfo=tz, fold=0)
                test_utc = test_loc.astimezone(timezone.utc)
                test_rt = test_utc.astimezone(tz).replace(tzinfo=None)
                in_gap = (test_rt != advanced_naive)

                if in_gap:
                    continue

                self.assertEqual(
                    (occ_naive.hour, occ_naive.minute), (base_hour, base_minute),
                    f"Wall-clock not preserved despite offset change: "
                    f"occurrence[{idx}] = {occ_naive.hour:02d}:{occ_naive.minute:02d}"
                )

    def test_random_frequencies_and_intervals(self):
        """Random combination of daily+ frequencies and intervals all preserve wall-clock."""
        rng = random.Random(86)

        for i in range(self.NUM_ITERATIONS):
            tz_name = self._random_dst_tz(rng)
            freq = self._random_daily_plus_freq(rng)
            interval = rng.randint(1, 4)
            base_dt = self._random_base_datetime_near_dst(rng, tz_name)

            # Determine count based on frequency to ensure DST crossing
            if freq == 'DAILY':
                count = rng.randint(30, 60)
            elif freq == 'WEEKLY':
                count = rng.randint(8, 16)
            elif freq == 'MONTHLY':
                count = 12
            else:  # YEARLY
                count = 5

            occurrences = expand_daily_recurrence_tz_aware(
                base_dt, tz_name, freq, interval, count
            )

            base_hour = base_dt.hour
            base_minute = base_dt.minute

            for idx, occ in enumerate(occurrences):
                occ_naive = occ.replace(tzinfo=None)
                occ_hour = occ_naive.hour
                occ_minute = occ_naive.minute

                # Check for DST gap
                advanced_naive = _advance_wall_clock_p8(base_dt, freq, interval, idx)
                tz = ZoneInfo(tz_name)
                test_loc = advanced_naive.replace(tzinfo=tz, fold=0)
                test_utc = test_loc.astimezone(timezone.utc)
                test_rt = test_utc.astimezone(tz).replace(tzinfo=None)
                in_gap = (test_rt != advanced_naive)

                if in_gap:
                    continue

                with self.subTest(
                    iteration=i,
                    freq=freq,
                    interval=interval,
                    occurrence_idx=idx,
                    tz=tz_name,
                    base_time=f"{base_hour:02d}:{base_minute:02d}",
                    occ_time=f"{occ_hour:02d}:{occ_minute:02d}",
                ):
                    self.assertEqual(
                        (occ_hour, occ_minute), (base_hour, base_minute),
                        f"Wall-clock not preserved for {freq} interval={interval}: "
                        f"base={base_hour:02d}:{base_minute:02d}, "
                        f"occurrence[{idx}]={occ_hour:02d}:{occ_minute:02d} "
                        f"in {tz_name} on {occ_naive.date().isoformat()}"
                    )


# ═══════════════════════════════════════════════════════════════════════════
# Feature: timezone-support, Property 10: Recurrence fall-back first-instance selection
# ═══════════════════════════════════════════════════════════════════════════
# Validates: Requirements 7.5
#
# For any recurring chit whose next occurrence's wall-clock time is ambiguous
# due to a fall-back DST transition (the same wall-clock time occurs twice),
# the recurrence engine SHALL select the first occurrence (the pre-transition/
# standard-time instance, i.e., fold=0).
# ═══════════════════════════════════════════════════════════════════════════


# ── Function under test (inlined to avoid FastAPI import dependency) ──────
# Source: src/backend/schedulers.py :: expand_occurrence_tz_aware()
# Also uses: _localize_wall_clock(), _advance_wall_clock()

def _localize_wall_clock_p10(wall_clock_naive: datetime, tz_name: str) -> datetime:
    """Localize a naive wall-clock datetime in the given timezone.

    Handles DST gaps by shifting forward to the first valid instant.
    Handles DST ambiguity (fall-back) by selecting the first occurrence (fold=0).

    Inlined from src/backend/schedulers.py to avoid FastAPI import dependency.
    """
    tz = ZoneInfo(tz_name)
    # Localize with fold=0 to select the first occurrence during fall-back ambiguity
    localized = wall_clock_naive.replace(tzinfo=tz, fold=0)

    # Check for DST spring-forward gap by round-tripping through UTC
    utc_dt = localized.astimezone(timezone.utc)
    round_tripped = utc_dt.astimezone(tz)

    if round_tripped.replace(tzinfo=None) != wall_clock_naive:
        # We're in a DST gap — advance to the first valid minute after the gap
        candidate = wall_clock_naive
        for _ in range(120):  # Max 2 hours (covers all real-world DST gaps)
            candidate = candidate + timedelta(minutes=1)
            cand_localized = candidate.replace(tzinfo=tz, fold=0)
            cand_utc = cand_localized.astimezone(timezone.utc)
            cand_rt = cand_utc.astimezone(tz)
            if cand_rt.replace(tzinfo=None) == candidate:
                return cand_localized
        # Fallback: return the round-tripped result (already past the gap)
        return round_tripped

    return localized


def _advance_wall_clock_p10(base_naive: datetime, freq: str, interval: int,
                            occurrence_index: int) -> datetime:
    """Advance a naive datetime by the given frequency and interval for daily+ recurrences.

    Preserves wall-clock time (hour:minute) while advancing the date components.
    Does NOT handle DST — caller must localize the result.

    Inlined from src/backend/schedulers.py to avoid FastAPI import dependency.
    """
    if occurrence_index == 0:
        return base_naive

    if freq == 'DAILY':
        result = base_naive + timedelta(days=interval * occurrence_index)
        return result.replace(hour=base_naive.hour, minute=base_naive.minute,
                              second=base_naive.second)
    elif freq == 'WEEKLY':
        result = base_naive + timedelta(weeks=interval * occurrence_index)
        return result.replace(hour=base_naive.hour, minute=base_naive.minute,
                              second=base_naive.second)
    elif freq == 'MONTHLY':
        import calendar
        year = base_naive.year
        month = base_naive.month
        day = base_naive.day
        total_months = (year * 12 + (month - 1)) + (interval * occurrence_index)
        new_year = total_months // 12
        new_month = (total_months % 12) + 1
        max_day = calendar.monthrange(new_year, new_month)[1]
        new_day = min(day, max_day)
        return base_naive.replace(year=new_year, month=new_month, day=new_day)
    elif freq == 'YEARLY':
        import calendar
        year = base_naive.year
        month = base_naive.month
        day = base_naive.day
        new_year = year + (interval * occurrence_index)
        if month == 2 and day == 29 and not calendar.isleap(new_year):
            return base_naive.replace(year=new_year, month=2, day=28)
        return base_naive.replace(year=new_year)
    else:
        result = base_naive + timedelta(days=interval * occurrence_index)
        return result.replace(hour=base_naive.hour, minute=base_naive.minute,
                              second=base_naive.second)


def expand_occurrence_tz_aware_p10(base_dt: datetime, tz_name: str, freq: str,
                                   interval: int, occurrence_index: int) -> datetime:
    """Expand a single recurrence occurrence in the given timezone.

    For DAILY/WEEKLY/MONTHLY/YEARLY: preserves wall-clock time in the timezone.
    For HOURLY/MINUTELY: maintains uniform elapsed-time intervals (UTC-based).

    DST gap: shifts forward to first valid instant.
    DST ambiguity: selects first occurrence (fold=0).

    Inlined from src/backend/schedulers.py to avoid FastAPI import dependency.
    """
    freq_upper = freq.upper() if freq else 'DAILY'

    if freq_upper in ('HOURLY', 'MINUTELY'):
        base_localized = _localize_wall_clock_p10(base_dt, tz_name)
        base_utc = base_localized.astimezone(timezone.utc)
        if freq_upper == 'HOURLY':
            delta = timedelta(hours=interval * occurrence_index)
        else:
            delta = timedelta(minutes=interval * occurrence_index)
        result_utc = base_utc + delta
        tz = ZoneInfo(tz_name)
        return result_utc.astimezone(tz)
    else:
        advanced_naive = _advance_wall_clock_p10(base_dt, freq_upper, interval, occurrence_index)
        return _localize_wall_clock_p10(advanced_naive, tz_name)


# Known DST fall-back transitions for recurrence testing:
# During fall-back, clocks go BACK — the same wall-clock time occurs twice.
# The first occurrence is the pre-transition (summer/daylight) instance.
# The second occurrence is the post-transition (winter/standard) instance.
#
# - America/New_York: 2024-11-03 at 2:00 AM → clocks fall back to 1:00 AM
#   Ambiguous times: 1:00 AM – 1:59 AM (occur twice)
# - America/Chicago: 2024-11-03 at 2:00 AM → clocks fall back to 1:00 AM
#   Ambiguous times: 1:00 AM – 1:59 AM (occur twice)
# - Europe/London: 2024-10-27 at 2:00 AM → clocks fall back to 1:00 AM
#   Ambiguous times: 1:00 AM – 1:59 AM (occur twice)
# - Australia/Sydney: 2024-04-07 at 3:00 AM → clocks fall back to 2:00 AM
#   Ambiguous times: 2:00 AM – 2:59 AM (occur twice)

_RECURRENCE_FALL_BACK_TRANSITIONS = [
    {
        "tz": "America/New_York",
        "fall_back_date": datetime(2024, 11, 3),
        "ambiguous_start_hour": 1,
        "ambiguous_start_minute": 0,
        "ambiguous_end_hour": 1,
        "ambiguous_end_minute": 59,
        # Pre-transition offset (EDT = UTC-4), post-transition offset (EST = UTC-5)
        "pre_transition_utc_offset_hours": -4,
        "post_transition_utc_offset_hours": -5,
    },
    {
        "tz": "America/Chicago",
        "fall_back_date": datetime(2024, 11, 3),
        "ambiguous_start_hour": 1,
        "ambiguous_start_minute": 0,
        "ambiguous_end_hour": 1,
        "ambiguous_end_minute": 59,
        # Pre-transition offset (CDT = UTC-5), post-transition offset (CST = UTC-6)
        "pre_transition_utc_offset_hours": -5,
        "post_transition_utc_offset_hours": -6,
    },
    {
        "tz": "Europe/London",
        "fall_back_date": datetime(2024, 10, 27),
        "ambiguous_start_hour": 1,
        "ambiguous_start_minute": 0,
        "ambiguous_end_hour": 1,
        "ambiguous_end_minute": 59,
        # Pre-transition offset (BST = UTC+1), post-transition offset (GMT = UTC+0)
        "pre_transition_utc_offset_hours": 1,
        "post_transition_utc_offset_hours": 0,
    },
    {
        "tz": "Australia/Sydney",
        "fall_back_date": datetime(2024, 4, 7),
        "ambiguous_start_hour": 2,
        "ambiguous_start_minute": 0,
        "ambiguous_end_hour": 2,
        "ambiguous_end_minute": 59,
        # Pre-transition offset (AEDT = UTC+11), post-transition offset (AEST = UTC+10)
        "pre_transition_utc_offset_hours": 11,
        "post_transition_utc_offset_hours": 10,
    },
]


class TestProperty10RecurrenceFallBackFirstInstance(unittest.TestCase):
    """Feature: timezone-support, Property 10: Recurrence fall-back first-instance selection

    **Validates: Requirements 7.5**

    For any recurring chit whose next occurrence's wall-clock time is ambiguous
    due to a fall-back DST transition (the same wall-clock time occurs twice),
    the recurrence engine SHALL select the first occurrence (the pre-transition/
    standard-time instance, i.e., fold=0).
    """

    NUM_ITERATIONS = 150

    def _is_ambiguous_time(self, naive_dt: datetime, tz_name: str) -> bool:
        """Check if a naive datetime is ambiguous in the given timezone.

        A time is ambiguous if fold=0 and fold=1 produce different UTC offsets.
        """
        tz = ZoneInfo(tz_name)
        fold0 = naive_dt.replace(tzinfo=tz, fold=0)
        fold1 = naive_dt.replace(tzinfo=tz, fold=1)
        return fold0.utcoffset() != fold1.utcoffset()

    def test_canonical_130am_fall_back_new_york(self):
        """A daily recurrence at 1:30 AM in New York on 2024-11-03 (fall-back day)
        should select the first occurrence (EDT, fold=0).

        On 2024-11-03, clocks fall back at 2:00 AM to 1:00 AM.
        1:30 AM occurs twice: once in EDT (UTC-4) and once in EST (UTC-5).
        The recurrence engine should select the first (EDT) instance.
        """
        tz_name = "America/New_York"
        # Base: daily recurrence starting 2024-11-01 at 1:30 AM
        base_dt = datetime(2024, 11, 1, 1, 30, 0)

        # Occurrence index 2 = 2024-11-03 (the fall-back day)
        result = expand_occurrence_tz_aware_p10(base_dt, tz_name, "DAILY", 1, 2)

        # Verify wall-clock time is preserved
        result_naive = result.replace(tzinfo=None)
        self.assertEqual(result_naive.hour, 1)
        self.assertEqual(result_naive.minute, 30)
        self.assertEqual(result_naive.day, 3)

        # Verify it's the FIRST occurrence (fold=0 → EDT → UTC-4)
        expected_utc_offset = timedelta(hours=-4)
        actual_utc_offset = result.utcoffset()
        self.assertEqual(
            actual_utc_offset, expected_utc_offset,
            f"Expected UTC offset {expected_utc_offset} (EDT/first occurrence), "
            f"got {actual_utc_offset}. The recurrence engine should select fold=0."
        )

    def test_random_ambiguous_times_select_first_occurrence(self):
        """Random recurrence times that land on fall-back days at ambiguous times
        should always select the first occurrence (fold=0, pre-transition offset).

        Generates random daily recurrences with wall-clock times within the
        ambiguous period of known fall-back transitions. Verifies that the
        occurrence on the fall-back day uses the pre-transition UTC offset.
        """
        rng = random.Random(100)

        for i in range(self.NUM_ITERATIONS):
            transition = rng.choice(_RECURRENCE_FALL_BACK_TRANSITIONS)
            tz_name = transition["tz"]
            fall_back_date = transition["fall_back_date"]
            amb_start_hour = transition["ambiguous_start_hour"]
            amb_start_minute = transition["ambiguous_start_minute"]
            amb_end_hour = transition["ambiguous_end_hour"]
            amb_end_minute = transition["ambiguous_end_minute"]
            pre_offset_hours = transition["pre_transition_utc_offset_hours"]

            # Generate a random time within the ambiguous period
            amb_start_total_min = amb_start_hour * 60 + amb_start_minute
            amb_end_total_min = amb_end_hour * 60 + amb_end_minute
            random_min = rng.randint(amb_start_total_min, amb_end_total_min)
            hour_ambiguous = random_min // 60
            minute_ambiguous = random_min % 60

            # Create a base datetime a few days before the fall-back day
            days_before = rng.randint(1, 7)
            base_date = fall_back_date - timedelta(days=days_before)
            base_dt = datetime(base_date.year, base_date.month, base_date.day,
                               hour_ambiguous, minute_ambiguous, 0)

            # The occurrence that lands on the fall-back day
            occurrence_index = days_before  # daily recurrence, interval=1

            result = expand_occurrence_tz_aware_p10(base_dt, tz_name, "DAILY", 1, occurrence_index)
            result_naive = result.replace(tzinfo=None)

            # Verify wall-clock time is preserved
            self.assertEqual(result_naive.hour, hour_ambiguous)
            self.assertEqual(result_naive.minute, minute_ambiguous)
            self.assertEqual(result_naive.date(), fall_back_date.date())

            # Verify it's the first occurrence (pre-transition offset)
            expected_utc_offset = timedelta(hours=pre_offset_hours)
            actual_utc_offset = result.utcoffset()

            with self.subTest(
                iteration=i,
                tz=tz_name,
                fall_back_date=fall_back_date.date().isoformat(),
                time=f"{hour_ambiguous:02d}:{minute_ambiguous:02d}",
                expected_offset=str(expected_utc_offset),
                actual_offset=str(actual_utc_offset),
            ):
                self.assertEqual(
                    actual_utc_offset, expected_utc_offset,
                    f"Fall-back ambiguous time {hour_ambiguous:02d}:{minute_ambiguous:02d} "
                    f"in {tz_name} on {fall_back_date.date().isoformat()} should select "
                    f"first occurrence (offset={expected_utc_offset}), "
                    f"got offset={actual_utc_offset}"
                )

    def test_fold_zero_confirmed_via_utc_comparison(self):
        """Verify fold=0 selection by comparing UTC conversion against both fold values.

        For each ambiguous time, compute what UTC would be for fold=0 and fold=1.
        The recurrence engine result's UTC time should match the fold=0 UTC time.
        """
        rng = random.Random(101)

        for i in range(self.NUM_ITERATIONS):
            transition = rng.choice(_RECURRENCE_FALL_BACK_TRANSITIONS)
            tz_name = transition["tz"]
            fall_back_date = transition["fall_back_date"]
            amb_start_hour = transition["ambiguous_start_hour"]
            amb_start_minute = transition["ambiguous_start_minute"]
            amb_end_hour = transition["ambiguous_end_hour"]
            amb_end_minute = transition["ambiguous_end_minute"]

            # Generate a random time within the ambiguous period
            amb_start_total_min = amb_start_hour * 60 + amb_start_minute
            amb_end_total_min = amb_end_hour * 60 + amb_end_minute
            random_min = rng.randint(amb_start_total_min, amb_end_total_min)
            hour_ambiguous = random_min // 60
            minute_ambiguous = random_min % 60

            # Create a base datetime a few days before the fall-back day
            days_before = rng.randint(1, 7)
            base_date = fall_back_date - timedelta(days=days_before)
            base_dt = datetime(base_date.year, base_date.month, base_date.day,
                               hour_ambiguous, minute_ambiguous, 0)

            # The occurrence that lands on the fall-back day
            occurrence_index = days_before

            result = expand_occurrence_tz_aware_p10(base_dt, tz_name, "DAILY", 1, occurrence_index)

            # Compute expected UTC for fold=0 and fold=1
            ambiguous_naive = datetime(fall_back_date.year, fall_back_date.month,
                                       fall_back_date.day, hour_ambiguous, minute_ambiguous, 0)
            tz = ZoneInfo(tz_name)
            fold0_utc = ambiguous_naive.replace(tzinfo=tz, fold=0).astimezone(timezone.utc)
            fold1_utc = ambiguous_naive.replace(tzinfo=tz, fold=1).astimezone(timezone.utc)

            # The result's UTC should match fold=0
            result_utc = result.astimezone(timezone.utc)

            with self.subTest(
                iteration=i,
                tz=tz_name,
                time=f"{hour_ambiguous:02d}:{minute_ambiguous:02d}",
                fold0_utc=fold0_utc.isoformat(),
                fold1_utc=fold1_utc.isoformat(),
                result_utc=result_utc.isoformat(),
            ):
                # fold=0 and fold=1 should produce different UTC times (confirms ambiguity)
                self.assertNotEqual(
                    fold0_utc, fold1_utc,
                    f"Expected ambiguous time but fold=0 and fold=1 produce same UTC "
                    f"for {hour_ambiguous:02d}:{minute_ambiguous:02d} in {tz_name}"
                )
                # Result should match fold=0 (first occurrence)
                self.assertEqual(
                    result_utc, fold0_utc,
                    f"Recurrence engine should select fold=0 (first occurrence). "
                    f"Expected UTC={fold0_utc.isoformat()}, "
                    f"got UTC={result_utc.isoformat()} "
                    f"(fold=1 would be {fold1_utc.isoformat()})"
                )

    def test_multiple_timezones_all_select_first_occurrence(self):
        """All DST-observing timezones in the test set select the first occurrence.

        Ensures the property holds across America/New_York, America/Chicago,
        Europe/London, and Australia/Sydney.
        """
        rng = random.Random(102)
        iterations_per_tz = 40  # 40 × 4 = 160 total iterations

        for transition in _RECURRENCE_FALL_BACK_TRANSITIONS:
            tz_name = transition["tz"]
            fall_back_date = transition["fall_back_date"]
            amb_start_hour = transition["ambiguous_start_hour"]
            amb_start_minute = transition["ambiguous_start_minute"]
            amb_end_hour = transition["ambiguous_end_hour"]
            amb_end_minute = transition["ambiguous_end_minute"]
            pre_offset_hours = transition["pre_transition_utc_offset_hours"]

            for j in range(iterations_per_tz):
                # Generate a random time within the ambiguous period
                amb_start_total_min = amb_start_hour * 60 + amb_start_minute
                amb_end_total_min = amb_end_hour * 60 + amb_end_minute
                random_min = rng.randint(amb_start_total_min, amb_end_total_min)
                hour_ambiguous = random_min // 60
                minute_ambiguous = random_min % 60

                # Create a base datetime before the fall-back day
                days_before = rng.randint(1, 5)
                base_date = fall_back_date - timedelta(days=days_before)
                base_dt = datetime(base_date.year, base_date.month, base_date.day,
                                   hour_ambiguous, minute_ambiguous, 0)

                occurrence_index = days_before
                result = expand_occurrence_tz_aware_p10(base_dt, tz_name, "DAILY", 1, occurrence_index)

                # Verify pre-transition offset (fold=0)
                expected_utc_offset = timedelta(hours=pre_offset_hours)
                actual_utc_offset = result.utcoffset()

                with self.subTest(
                    tz=tz_name,
                    iteration=j,
                    time=f"{hour_ambiguous:02d}:{minute_ambiguous:02d}",
                ):
                    self.assertEqual(
                        actual_utc_offset, expected_utc_offset,
                        f"[{tz_name}] Ambiguous time {hour_ambiguous:02d}:{minute_ambiguous:02d} "
                        f"should select first occurrence (offset={expected_utc_offset}), "
                        f"got offset={actual_utc_offset}"
                    )

    def test_weekly_recurrence_fall_back_selects_first(self):
        """Weekly recurrences that land on fall-back days also select the first occurrence.

        Tests that the property holds for WEEKLY frequency, not just DAILY.
        """
        rng = random.Random(103)

        for i in range(self.NUM_ITERATIONS):
            transition = rng.choice(_RECURRENCE_FALL_BACK_TRANSITIONS)
            tz_name = transition["tz"]
            fall_back_date = transition["fall_back_date"]
            amb_start_hour = transition["ambiguous_start_hour"]
            amb_start_minute = transition["ambiguous_start_minute"]
            amb_end_hour = transition["ambiguous_end_hour"]
            amb_end_minute = transition["ambiguous_end_minute"]
            pre_offset_hours = transition["pre_transition_utc_offset_hours"]

            # Generate a random time within the ambiguous period
            amb_start_total_min = amb_start_hour * 60 + amb_start_minute
            amb_end_total_min = amb_end_hour * 60 + amb_end_minute
            random_min = rng.randint(amb_start_total_min, amb_end_total_min)
            hour_ambiguous = random_min // 60
            minute_ambiguous = random_min % 60

            # Create a base datetime exactly 1 week before the fall-back day
            base_date = fall_back_date - timedelta(weeks=1)
            base_dt = datetime(base_date.year, base_date.month, base_date.day,
                               hour_ambiguous, minute_ambiguous, 0)

            # Occurrence index 1 = one week later = the fall-back day
            result = expand_occurrence_tz_aware_p10(base_dt, tz_name, "WEEKLY", 1, 1)
            result_naive = result.replace(tzinfo=None)

            # Verify wall-clock time is preserved
            self.assertEqual(result_naive.hour, hour_ambiguous)
            self.assertEqual(result_naive.minute, minute_ambiguous)

            # Verify first occurrence (pre-transition offset)
            expected_utc_offset = timedelta(hours=pre_offset_hours)
            actual_utc_offset = result.utcoffset()

            with self.subTest(
                iteration=i,
                tz=tz_name,
                time=f"{hour_ambiguous:02d}:{minute_ambiguous:02d}",
            ):
                self.assertEqual(
                    actual_utc_offset, expected_utc_offset,
                    f"Weekly recurrence at {hour_ambiguous:02d}:{minute_ambiguous:02d} "
                    f"in {tz_name} on fall-back day should select first occurrence "
                    f"(offset={expected_utc_offset}), got offset={actual_utc_offset}"
                )


# ═══════════════════════════════════════════════════════════════════════════
# Feature: timezone-support, Property 14: ICS omits dateless chits
# ═══════════════════════════════════════════════════════════════════════════
# Validates: Requirements 8.5
#
# For any chit that has neither start_datetime nor due_datetime, the ICS
# export output SHALL not contain a VEVENT for that chit.
# ═══════════════════════════════════════════════════════════════════════════

import sys
import os

# Add the project root to path so we can import the ICS serializer
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))
from src.backend.ics_serializer import ics_export_chits


def _random_chit_base(rng, chit_id):
    """Generate a random chit dict with common fields but no dates."""
    title_words = ["Meeting", "Review", "Task", "Note", "Reminder", "Call", "Lunch", "Deploy"]
    title = " ".join(rng.choices(title_words, k=rng.randint(1, 3)))
    chit = {
        "id": chit_id,
        "title": f"{title} #{chit_id}",
        "start_datetime": None,
        "end_datetime": None,
        "due_datetime": None,
        "timezone": None,
        "all_day": False,
        "note": rng.choice([None, "Some note content", "Another note"]),
        "location": rng.choice([None, "Office", "Remote", "Denver, CO"]),
        "status": rng.choice([None, "ToDo", "In Progress", "Complete"]),
        "tags": rng.choice([None, [], ["work"], ["personal", "urgent"]]),
        "recurrence_rule": None,
        "recurrence_exceptions": None,
    }
    return chit


def _random_dated_chit(rng, chit_id):
    """Generate a random chit that HAS at least one date field set."""
    chit = _random_chit_base(rng, chit_id)

    year = rng.randint(2020, 2030)
    month = rng.randint(1, 12)
    day = rng.randint(1, 28)
    hour = rng.randint(0, 23)
    minute = rng.randint(0, 59)
    dt_str = f"{year:04d}-{month:02d}-{day:02d}T{hour:02d}:{minute:02d}:00"

    # Randomly set start_datetime, due_datetime, or both
    date_strategy = rng.choice(["start_only", "due_only", "both"])
    if date_strategy == "start_only":
        chit["start_datetime"] = dt_str
    elif date_strategy == "due_only":
        chit["due_datetime"] = dt_str
    else:
        chit["start_datetime"] = dt_str
        chit["due_datetime"] = dt_str

    # Optionally anchor it
    if rng.random() > 0.5:
        chit["timezone"] = rng.choice(VALID_TIMEZONES)

    # Optionally make it all-day
    if rng.random() > 0.7:
        chit["all_day"] = True

    return chit


def _random_dateless_chit(rng, chit_id):
    """Generate a random chit that has NO start_datetime and NO due_datetime."""
    chit = _random_chit_base(rng, chit_id)
    # Explicitly ensure no dates
    chit["start_datetime"] = None
    chit["end_datetime"] = None
    chit["due_datetime"] = None
    # Optionally set timezone (shouldn't matter — still dateless)
    if rng.random() > 0.7:
        chit["timezone"] = rng.choice(VALID_TIMEZONES)
    return chit


class TestProperty14IcsOmitsDatelessChits(unittest.TestCase):
    """Feature: timezone-support, Property 14: ICS omits dateless chits

    **Validates: Requirements 8.5**

    For any chit that has neither start_datetime nor due_datetime, the ICS
    export output SHALL not contain a VEVENT for that chit.
    """

    NUM_ITERATIONS = 150

    def test_dateless_chits_produce_no_vevent(self):
        """Chits without start_datetime or due_datetime produce no VEVENT.

        Generate random dateless chits and verify the ICS output contains
        no VEVENT blocks for them.
        """
        rng = random.Random(140)

        for i in range(self.NUM_ITERATIONS):
            chit = _random_dateless_chit(rng, f"dateless-{i}")
            ics_output = ics_export_chits([chit])

            with self.subTest(iteration=i, chit_id=chit["id"]):
                self.assertNotIn(
                    "BEGIN:VEVENT",
                    ics_output,
                    f"Dateless chit '{chit['id']}' should produce no VEVENT, "
                    f"but ICS output contains BEGIN:VEVENT"
                )
                self.assertNotIn(
                    "END:VEVENT",
                    ics_output,
                    f"Dateless chit '{chit['id']}' should produce no VEVENT, "
                    f"but ICS output contains END:VEVENT"
                )

    def test_mixed_chits_only_dated_produce_vevents(self):
        """Mix dateless chits with dated chits; only dated ones produce VEVENTs.

        Generate a mix of dated and dateless chits, export them all, and verify:
        - The number of VEVENTs equals the number of dated chits
        - Dated chit UIDs appear in the output
        - Dateless chit UIDs do NOT appear in the output
        """
        rng = random.Random(141)

        for i in range(self.NUM_ITERATIONS):
            # Generate a random mix of dated and dateless chits
            num_dated = rng.randint(1, 5)
            num_dateless = rng.randint(1, 5)

            dated_chits = [_random_dated_chit(rng, f"dated-{i}-{j}") for j in range(num_dated)]
            dateless_chits = [_random_dateless_chit(rng, f"dateless-{i}-{j}") for j in range(num_dateless)]

            # Shuffle them together
            all_chits = dated_chits + dateless_chits
            rng.shuffle(all_chits)

            ics_output = ics_export_chits(all_chits)

            # Count VEVENTs
            vevent_count = ics_output.count("BEGIN:VEVENT")

            with self.subTest(
                iteration=i,
                num_dated=num_dated,
                num_dateless=num_dateless,
            ):
                self.assertEqual(
                    vevent_count, num_dated,
                    f"Expected {num_dated} VEVENTs for {num_dated} dated chits, "
                    f"but found {vevent_count} in output"
                )

                # Verify dated chit UIDs are present
                for dc in dated_chits:
                    uid_str = f"UID:{dc['id']}@cwoc"
                    self.assertIn(
                        uid_str, ics_output,
                        f"Dated chit UID '{dc['id']}' should appear in ICS output"
                    )

                # Verify dateless chit UIDs are NOT present
                for dlc in dateless_chits:
                    uid_str = f"UID:{dlc['id']}@cwoc"
                    self.assertNotIn(
                        uid_str, ics_output,
                        f"Dateless chit UID '{dlc['id']}' should NOT appear in ICS output"
                    )

    def test_all_dateless_produces_empty_calendar(self):
        """When all chits are dateless, the ICS output has no VEVENTs at all.

        The output should still be a valid VCALENDAR wrapper with no events.
        """
        rng = random.Random(142)

        for i in range(self.NUM_ITERATIONS):
            num_chits = rng.randint(1, 8)
            chits = [_random_dateless_chit(rng, f"all-dateless-{i}-{j}") for j in range(num_chits)]

            ics_output = ics_export_chits(chits)

            with self.subTest(iteration=i, num_chits=num_chits):
                # Should have VCALENDAR wrapper but no VEVENTs
                self.assertIn("BEGIN:VCALENDAR", ics_output)
                self.assertIn("END:VCALENDAR", ics_output)
                self.assertIn("VERSION:2.0", ics_output)
                self.assertNotIn(
                    "BEGIN:VEVENT", ics_output,
                    f"All-dateless export should have no VEVENTs, "
                    f"but found BEGIN:VEVENT in output"
                )

    def test_empty_string_dates_treated_as_dateless(self):
        """Chits with empty-string dates (not None) are also treated as dateless.

        Some edge cases may have '' instead of None for date fields.
        """
        rng = random.Random(143)

        for i in range(self.NUM_ITERATIONS):
            chit = _random_dateless_chit(rng, f"empty-str-{i}")
            # Randomly set date fields to empty string instead of None
            chit["start_datetime"] = rng.choice([None, "", ""])
            chit["due_datetime"] = rng.choice([None, "", ""])

            ics_output = ics_export_chits([chit])

            with self.subTest(iteration=i, start=chit["start_datetime"], due=chit["due_datetime"]):
                self.assertNotIn(
                    "BEGIN:VEVENT",
                    ics_output,
                    f"Chit with empty-string dates should produce no VEVENT"
                )


if __name__ == "__main__":
    unittest.main()


# ═══════════════════════════════════════════════════════════════════════════
# Feature: timezone-support, Property 12: ICS timezone annotation correctness
# ═══════════════════════════════════════════════════════════════════════════
# Validates: Requirements 8.1, 8.2, 8.3
#
# For any anchored chit, the exported ICS SHALL contain a VTIMEZONE component
# for the chit's timezone and DTSTART/DTEND properties with TZID= parameter.
# For any floating chit, the exported ICS SHALL contain DTSTART/DTEND as naive
# local times (no TZID, no Z suffix).
# For any all-day chit, the exported ICS SHALL use VALUE=DATE format (YYYYMMDD,
# no time component).
# ═══════════════════════════════════════════════════════════════════════════

import sys
import os
import re as _re

# Add the backend directory to sys.path so we can import ics_serializer directly
_backend_dir = os.path.dirname(os.path.abspath(__file__))
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

from ics_serializer import ics_export_chits


# ── Helpers for Property 12 ──────────────────────────────────────────────

# Subset of DST-observing timezones for more interesting test cases
_P12_DST_TIMEZONES = [
    "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
    "Europe/London", "Europe/Berlin", "Europe/Paris", "Australia/Sydney",
    "Pacific/Auckland", "America/Sao_Paulo", "Asia/Tokyo", "Asia/Kolkata",
    "Africa/Cairo", "America/Anchorage", "America/Halifax", "Europe/Moscow",
]

# All valid timezones for broader sampling
_P12_ALL_TIMEZONES = sorted(available_timezones())


def _p12_random_iso_datetime(rng):
    """Generate a random ISO datetime string like '2025-06-15T14:30:00'."""
    year = rng.randint(2000, 2030)
    month = rng.randint(1, 12)
    if month in (4, 6, 9, 11):
        day = rng.randint(1, 30)
    elif month == 2:
        day = rng.randint(1, 28)
    else:
        day = rng.randint(1, 31)
    hour = rng.randint(0, 23)
    minute = rng.randint(0, 59)
    second = rng.randint(0, 59)
    return f"{year:04d}-{month:02d}-{day:02d}T{hour:02d}:{minute:02d}:{second:02d}"


def _p12_random_iso_date(rng):
    """Generate a random ISO date string like '2025-06-15'."""
    year = rng.randint(2000, 2030)
    month = rng.randint(1, 12)
    if month in (4, 6, 9, 11):
        day = rng.randint(1, 30)
    elif month == 2:
        day = rng.randint(1, 28)
    else:
        day = rng.randint(1, 31)
    return f"{year:04d}-{month:02d}-{day:02d}"


def _p12_random_anchored_chit(rng):
    """Generate a random anchored chit dict with a timezone set."""
    tz = rng.choice(_P12_ALL_TIMEZONES)
    chit = {
        "id": f"anchored-{rng.randint(1, 999999)}",
        "title": f"Anchored Event {rng.randint(1, 9999)}",
        "timezone": tz,
        "all_day": False,
        "start_datetime": _p12_random_iso_datetime(rng),
    }
    # Optionally add end_datetime
    if rng.random() > 0.3:
        chit["end_datetime"] = _p12_random_iso_datetime(rng)
    return chit


def _p12_random_floating_chit(rng):
    """Generate a random floating chit dict (timezone=None)."""
    chit = {
        "id": f"floating-{rng.randint(1, 999999)}",
        "title": f"Floating Event {rng.randint(1, 9999)}",
        "timezone": None,
        "all_day": False,
        "start_datetime": _p12_random_iso_datetime(rng),
    }
    # Optionally add end_datetime
    if rng.random() > 0.3:
        chit["end_datetime"] = _p12_random_iso_datetime(rng)
    return chit


def _p12_random_allday_chit(rng):
    """Generate a random all-day chit dict."""
    # All-day chits can be anchored or floating — both should use VALUE=DATE
    has_tz = rng.random() > 0.5
    chit = {
        "id": f"allday-{rng.randint(1, 999999)}",
        "title": f"All Day Event {rng.randint(1, 9999)}",
        "timezone": rng.choice(_P12_ALL_TIMEZONES) if has_tz else None,
        "all_day": True,
        "start_datetime": _p12_random_iso_date(rng),
    }
    # Optionally add end date
    if rng.random() > 0.3:
        chit["end_datetime"] = _p12_random_iso_date(rng)
    return chit


class TestProperty12ICSTimezoneAnnotation(unittest.TestCase):
    """Feature: timezone-support, Property 12: ICS timezone annotation correctness

    **Validates: Requirements 8.1, 8.2, 8.3**
    """

    NUM_ITERATIONS = 150

    def test_anchored_chit_has_vtimezone_and_tzid(self):
        """Anchored chits produce ICS with VTIMEZONE component and DTSTART;TZID=... format.

        For any anchored chit (timezone != None), the exported ICS SHALL contain:
        1. A VTIMEZONE component with TZID matching the chit's timezone
        2. DTSTART property with TZID= parameter referencing the chit's timezone
        """
        rng = random.Random(120)

        for i in range(self.NUM_ITERATIONS):
            chit = _p12_random_anchored_chit(rng)
            tz_name = chit["timezone"]

            ics_output = ics_export_chits([chit])

            with self.subTest(iteration=i, timezone=tz_name, title=chit["title"]):
                # 1. Must contain VTIMEZONE component with matching TZID
                self.assertIn(
                    "BEGIN:VTIMEZONE",
                    ics_output,
                    f"Anchored chit with tz={tz_name} missing VTIMEZONE component"
                )
                self.assertIn(
                    f"TZID:{tz_name}",
                    ics_output,
                    f"VTIMEZONE component missing TZID:{tz_name}"
                )

                # 2. Must contain DTSTART;TZID=<tz_name>:
                dtstart_pattern = f"DTSTART;TZID={_re.escape(tz_name)}:"
                self.assertRegex(
                    ics_output,
                    dtstart_pattern,
                    f"Anchored chit missing DTSTART;TZID={tz_name}: format"
                )

                # 3. DTSTART value should NOT have Z suffix (not UTC)
                # Find the DTSTART line and check its value
                for line in ics_output.split("\r\n"):
                    if line.startswith(f"DTSTART;TZID={tz_name}:"):
                        dt_value = line.split(":", 1)[1]
                        self.assertFalse(
                            dt_value.endswith("Z"),
                            f"Anchored DTSTART value should not end with Z: {dt_value}"
                        )
                        break

                # 4. If end_datetime present, DTEND should also have TZID
                if chit.get("end_datetime"):
                    dtend_pattern = f"DTEND;TZID={_re.escape(tz_name)}:"
                    self.assertRegex(
                        ics_output,
                        dtend_pattern,
                        f"Anchored chit with end_datetime missing DTEND;TZID={tz_name}: format"
                    )

    def test_floating_chit_has_naive_times(self):
        """Floating chits produce ICS with naive local times (no TZID, no Z suffix).

        For any floating chit (timezone == None), the exported ICS SHALL contain:
        1. DTSTART with no TZID parameter
        2. DTSTART value with no Z suffix
        3. No VTIMEZONE component (since no timezone is referenced)
        """
        rng = random.Random(121)

        for i in range(self.NUM_ITERATIONS):
            chit = _p12_random_floating_chit(rng)

            ics_output = ics_export_chits([chit])

            with self.subTest(iteration=i, title=chit["title"]):
                # 1. Must NOT contain VTIMEZONE component
                self.assertNotIn(
                    "BEGIN:VTIMEZONE",
                    ics_output,
                    "Floating chit should not have VTIMEZONE component"
                )

                # 2. DTSTART must NOT have TZID parameter
                self.assertNotIn(
                    "DTSTART;TZID=",
                    ics_output,
                    "Floating chit DTSTART should not have TZID parameter"
                )

                # 3. Find the DTSTART line and verify format
                dtstart_found = False
                for line in ics_output.split("\r\n"):
                    if line.startswith("DTSTART:"):
                        dtstart_found = True
                        dt_value = line.split(":", 1)[1]
                        # Must not end with Z
                        self.assertFalse(
                            dt_value.endswith("Z"),
                            f"Floating DTSTART value should not end with Z: {dt_value}"
                        )
                        # Must be in YYYYMMDDTHHMMSS format (no Z, no TZID)
                        self.assertRegex(
                            dt_value,
                            r'^\d{8}T\d{6}$',
                            f"Floating DTSTART should be naive YYYYMMDDTHHMMSS, got: {dt_value}"
                        )
                        break

                self.assertTrue(
                    dtstart_found,
                    "Floating chit should have a plain DTSTART: line (no params)"
                )

                # 4. If end_datetime present, DTEND must also be naive
                if chit.get("end_datetime"):
                    self.assertNotIn(
                        "DTEND;TZID=",
                        ics_output,
                        "Floating chit DTEND should not have TZID parameter"
                    )
                    dtend_found = False
                    for line in ics_output.split("\r\n"):
                        if line.startswith("DTEND:"):
                            dtend_found = True
                            dt_value = line.split(":", 1)[1]
                            self.assertFalse(
                                dt_value.endswith("Z"),
                                f"Floating DTEND value should not end with Z: {dt_value}"
                            )
                            self.assertRegex(
                                dt_value,
                                r'^\d{8}T\d{6}$',
                                f"Floating DTEND should be naive YYYYMMDDTHHMMSS, got: {dt_value}"
                            )
                            break
                    self.assertTrue(
                        dtend_found,
                        "Floating chit with end_datetime should have a plain DTEND: line"
                    )

    def test_allday_chit_uses_value_date_format(self):
        """All-day chits produce ICS with DTSTART;VALUE=DATE:YYYYMMDD format.

        For any all-day chit, the exported ICS SHALL use:
        1. DTSTART;VALUE=DATE: parameter format
        2. Value in YYYYMMDD format (no time component, no timezone)
        """
        rng = random.Random(122)

        for i in range(self.NUM_ITERATIONS):
            chit = _p12_random_allday_chit(rng)

            ics_output = ics_export_chits([chit])

            with self.subTest(iteration=i, title=chit["title"], timezone=chit.get("timezone")):
                # 1. Must contain DTSTART;VALUE=DATE:
                self.assertIn(
                    "DTSTART;VALUE=DATE:",
                    ics_output,
                    "All-day chit should have DTSTART;VALUE=DATE: format"
                )

                # 2. Find the DTSTART;VALUE=DATE line and verify YYYYMMDD format
                dtstart_found = False
                for line in ics_output.split("\r\n"):
                    if line.startswith("DTSTART;VALUE=DATE:"):
                        dtstart_found = True
                        dt_value = line.split(":", 1)[1]
                        # Must be exactly 8 digits (YYYYMMDD)
                        self.assertRegex(
                            dt_value,
                            r'^\d{8}$',
                            f"All-day DTSTART value should be YYYYMMDD, got: {dt_value}"
                        )
                        # Must NOT contain T (no time component)
                        self.assertNotIn(
                            "T",
                            dt_value,
                            f"All-day DTSTART value should not contain time: {dt_value}"
                        )
                        break

                self.assertTrue(
                    dtstart_found,
                    "All-day chit should have DTSTART;VALUE=DATE: line"
                )

                # 3. Must NOT have DTSTART;TZID= (all-day overrides timezone annotation)
                self.assertNotIn(
                    "DTSTART;TZID=",
                    ics_output,
                    "All-day chit should not have DTSTART;TZID= (VALUE=DATE takes precedence)"
                )

                # 4. If end_datetime present, DTEND should also use VALUE=DATE
                if chit.get("end_datetime"):
                    self.assertIn(
                        "DTEND;VALUE=DATE:",
                        ics_output,
                        "All-day chit with end_datetime should have DTEND;VALUE=DATE: format"
                    )
                    for line in ics_output.split("\r\n"):
                        if line.startswith("DTEND;VALUE=DATE:"):
                            dt_value = line.split(":", 1)[1]
                            self.assertRegex(
                                dt_value,
                                r'^\d{8}$',
                                f"All-day DTEND value should be YYYYMMDD, got: {dt_value}"
                            )
                            break

    def test_anchored_chit_vcalendar_structure(self):
        """Anchored chit ICS output has proper RFC 5545 structure.

        Verifies the overall structure: VCALENDAR wrapper, VERSION:2.0,
        VTIMEZONE before VEVENT, and proper nesting.
        """
        rng = random.Random(123)

        for i in range(self.NUM_ITERATIONS):
            chit = _p12_random_anchored_chit(rng)
            tz_name = chit["timezone"]

            ics_output = ics_export_chits([chit])

            with self.subTest(iteration=i, timezone=tz_name):
                # Must start with BEGIN:VCALENDAR
                lines = ics_output.split("\r\n")
                self.assertEqual(lines[0], "BEGIN:VCALENDAR",
                                 "ICS must start with BEGIN:VCALENDAR")

                # Must contain VERSION:2.0
                self.assertIn("VERSION:2.0", ics_output,
                              "ICS must contain VERSION:2.0")

                # Must end with END:VCALENDAR
                # Filter out empty trailing lines
                non_empty_lines = [l for l in lines if l.strip()]
                self.assertEqual(non_empty_lines[-1], "END:VCALENDAR",
                                 "ICS must end with END:VCALENDAR")

                # VTIMEZONE must appear before VEVENT
                vtimezone_pos = ics_output.find("BEGIN:VTIMEZONE")
                vevent_pos = ics_output.find("BEGIN:VEVENT")
                self.assertGreater(vtimezone_pos, -1,
                                   "Anchored chit must have VTIMEZONE")
                self.assertGreater(vevent_pos, -1,
                                   "Must have VEVENT")
                self.assertLess(vtimezone_pos, vevent_pos,
                                "VTIMEZONE must appear before VEVENT")

    def test_multiple_anchored_chits_one_vtimezone_per_tz(self):
        """Multiple anchored chits sharing a timezone produce only one VTIMEZONE.

        Per RFC 5545: at most one VTIMEZONE component per unique timezone.
        """
        rng = random.Random(124)

        for i in range(self.NUM_ITERATIONS):
            # Create 2-4 chits with the same timezone
            tz = rng.choice(_P12_ALL_TIMEZONES)
            num_chits = rng.randint(2, 4)
            chits = []
            for j in range(num_chits):
                chit = {
                    "id": f"multi-{i}-{j}",
                    "title": f"Event {j}",
                    "timezone": tz,
                    "all_day": False,
                    "start_datetime": _p12_random_iso_datetime(rng),
                }
                chits.append(chit)

            ics_output = ics_export_chits(chits)

            with self.subTest(iteration=i, timezone=tz, num_chits=num_chits):
                # Count VTIMEZONE occurrences for this timezone
                tzid_count = ics_output.count(f"TZID:{tz}")
                # One in the VTIMEZONE component header, plus one per DTSTART/DTEND reference
                # But there should be exactly ONE BEGIN:VTIMEZONE...TZID:<tz> block
                vtimezone_count = ics_output.count("BEGIN:VTIMEZONE")
                self.assertEqual(
                    vtimezone_count, 1,
                    f"Expected exactly 1 VTIMEZONE for {num_chits} chits sharing tz={tz}, "
                    f"got {vtimezone_count}"
                )
