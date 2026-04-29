"""
Property 2: Chit eligibility partitioning by date window

Feature: chit-weather-forecasts, Property 2: Chit eligibility partitioning by date window

Validates: Requirements 3.1, 4.1

Generate random chit sets with varying locations, dates, deleted flags.
Run _partition_eligible_chits(), verify correct partitioning with no overlaps.
Uses Python stdlib only. Minimum 100 iterations.
"""

import sys
import os
import random
import string
import unittest
from datetime import datetime, timedelta

# Add backend to path so we can import helpers
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from backend.main import _partition_eligible_chits, _get_chit_focus_date


def _random_location():
    """Return a random non-empty location string or empty/None."""
    choice = random.choice(["valid", "valid", "valid", "empty", "none"])
    if choice == "valid":
        return "".join(random.choices(string.ascii_letters + " ", k=random.randint(5, 30)))
    elif choice == "empty":
        return ""
    return None


def _random_datetime_str(base, delta_days):
    """Generate a random ISO datetime string offset from base by delta_days."""
    dt = base + timedelta(days=delta_days, hours=random.randint(0, 23), minutes=random.randint(0, 59))
    return dt.isoformat()


def _generate_random_chit(now):
    """Generate a random chit dict with varying properties."""
    chit = {"id": "".join(random.choices(string.ascii_lowercase, k=8))}

    # Deleted flag
    chit["deleted"] = random.choice([True, False, False, False, None, 0, 1])

    # Location
    chit["location"] = _random_location()

    # Date fields — vary the delta range widely
    delta_range = random.randint(-10, 30)
    date_choice = random.choice(["start_only", "due_only", "both", "neither"])
    if date_choice == "start_only":
        chit["start_datetime"] = _random_datetime_str(now, delta_range)
        chit["due_datetime"] = None
    elif date_choice == "due_only":
        chit["start_datetime"] = None
        chit["due_datetime"] = _random_datetime_str(now, delta_range)
    elif date_choice == "both":
        d1 = random.randint(-10, 30)
        d2 = random.randint(-10, 30)
        chit["start_datetime"] = _random_datetime_str(now, d1)
        chit["due_datetime"] = _random_datetime_str(now, d2)
    else:
        chit["start_datetime"] = None
        chit["due_datetime"] = None

    return chit


class TestChitEligibilityPartitioning(unittest.TestCase):
    """Property 2: Chit eligibility partitioning by date window

    **Validates: Requirements 3.1, 4.1**
    """

    def test_partition_no_overlaps_and_correct_buckets(self):
        """For any set of random chits, hourly and daily buckets must not overlap
        and each chit must be in the correct bucket based on its focus date."""
        now = datetime.utcnow()

        for iteration in range(150):
            num_chits = random.randint(0, 20)
            chits = [_generate_random_chit(now) for _ in range(num_chits)]

            hourly, daily = _partition_eligible_chits(chits, now)

            hourly_ids = {c["id"] for c in hourly}
            daily_ids = {c["id"] for c in daily}

            # No overlaps between buckets
            self.assertEqual(
                len(hourly_ids & daily_ids), 0,
                f"Iteration {iteration}: overlap found between hourly and daily buckets"
            )

            today = now.date()

            # Verify each hourly chit belongs in 0-7 day window
            for chit in hourly:
                focus_date_str = _get_chit_focus_date(chit)
                self.assertIsNotNone(focus_date_str, f"Iteration {iteration}: hourly chit has no focus date")
                focus_date = datetime.strptime(focus_date_str, "%Y-%m-%d").date()
                delta = (focus_date - today).days
                self.assertTrue(
                    0 <= delta <= 7,
                    f"Iteration {iteration}: hourly chit focus_date delta={delta}, expected 0-7"
                )
                # Must not be deleted
                deleted = chit.get("deleted")
                self.assertFalse(
                    deleted is True or deleted == 1,
                    f"Iteration {iteration}: deleted chit in hourly bucket"
                )
                # Must have non-empty location
                loc = chit.get("location")
                self.assertTrue(
                    loc and str(loc).strip(),
                    f"Iteration {iteration}: empty location in hourly bucket"
                )

            # Verify each daily chit belongs in 8-16 day window
            for chit in daily:
                focus_date_str = _get_chit_focus_date(chit)
                self.assertIsNotNone(focus_date_str, f"Iteration {iteration}: daily chit has no focus date")
                focus_date = datetime.strptime(focus_date_str, "%Y-%m-%d").date()
                delta = (focus_date - today).days
                self.assertTrue(
                    8 <= delta <= 16,
                    f"Iteration {iteration}: daily chit focus_date delta={delta}, expected 8-16"
                )
                # Must not be deleted
                deleted = chit.get("deleted")
                self.assertFalse(
                    deleted is True or deleted == 1,
                    f"Iteration {iteration}: deleted chit in daily bucket"
                )
                # Must have non-empty location
                loc = chit.get("location")
                self.assertTrue(
                    loc and str(loc).strip(),
                    f"Iteration {iteration}: empty location in daily bucket"
                )

            # Verify eligible chits that should be in a bucket ARE in a bucket
            for chit in chits:
                deleted = chit.get("deleted")
                is_deleted = deleted is True or deleted == 1
                loc = chit.get("location")
                has_location = loc and str(loc).strip()
                focus_date_str = _get_chit_focus_date(chit)

                if is_deleted or not has_location or not focus_date_str:
                    # Should NOT be in any bucket
                    self.assertNotIn(
                        chit["id"], hourly_ids | daily_ids,
                        f"Iteration {iteration}: ineligible chit found in a bucket"
                    )
                    continue

                focus_date = datetime.strptime(focus_date_str, "%Y-%m-%d").date()
                delta = (focus_date - today).days

                if 0 <= delta <= 7:
                    self.assertIn(
                        chit["id"], hourly_ids,
                        f"Iteration {iteration}: eligible hourly chit not in hourly bucket (delta={delta})"
                    )
                elif 8 <= delta <= 16:
                    self.assertIn(
                        chit["id"], daily_ids,
                        f"Iteration {iteration}: eligible daily chit not in daily bucket (delta={delta})"
                    )
                else:
                    # Out of range — should not be in any bucket
                    self.assertNotIn(
                        chit["id"], hourly_ids | daily_ids,
                        f"Iteration {iteration}: out-of-range chit found in a bucket (delta={delta})"
                    )


if __name__ == "__main__":
    unittest.main()
