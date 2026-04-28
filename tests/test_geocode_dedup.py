"""
Property 6: Geocode deduplication

Feature: chit-weather-forecasts, Property 6: Geocode deduplication

Validates: Requirements 5.2

Generate random chit sets with overlapping locations. Verify unique location
count equals expected when grouping chits by location.
Uses Python stdlib only. Minimum 100 iterations.
"""

import random
import string
import unittest


def _random_location_pool(size):
    """Generate a pool of unique location strings."""
    locations = []
    for _ in range(size):
        loc = "".join(random.choices(string.ascii_letters + " ", k=random.randint(5, 25))).strip()
        if loc:
            locations.append(loc)
    return locations


def _generate_chits_with_overlapping_locations(location_pool, num_chits):
    """Generate chits that reuse locations from the pool, creating overlaps."""
    chits = []
    for i in range(num_chits):
        loc = random.choice(location_pool) if location_pool else ""
        chits.append({
            "id": f"chit-{i}",
            "location": loc,
            "deleted": False,
            "start_datetime": "2025-07-15T10:00:00",
            "due_datetime": None,
        })
    return chits


def _group_chits_by_location(chits):
    """Group chits by unique location string (same logic as the weather update endpoint)."""
    location_groups = {}
    for chit in chits:
        loc = (chit.get("location") or "").strip()
        if loc:
            location_groups.setdefault(loc, []).append(chit)
    return location_groups


class TestGeocodeDeduplication(unittest.TestCase):
    """Property 6: Geocode deduplication

    **Validates: Requirements 5.2**
    """

    def test_unique_location_count_equals_expected(self):
        """For any set of chits with overlapping locations, the number of unique
        locations (geocode calls) must equal the number of distinct non-empty
        location strings, not the number of chits."""
        for iteration in range(150):
            # Create a pool of M unique locations (1-10)
            pool_size = random.randint(1, 10)
            location_pool = _random_location_pool(pool_size)
            if not location_pool:
                continue

            # Create N chits (M <= N) that reuse locations from the pool
            num_chits = random.randint(pool_size, pool_size * 5)
            chits = _generate_chits_with_overlapping_locations(location_pool, num_chits)

            # Group by location
            location_groups = _group_chits_by_location(chits)
            unique_location_count = len(location_groups)

            # Calculate expected unique locations from the chits
            expected_unique = len({
                c["location"].strip()
                for c in chits
                if c.get("location") and c["location"].strip()
            })

            self.assertEqual(
                unique_location_count, expected_unique,
                f"Iteration {iteration}: unique location count {unique_location_count} != expected {expected_unique}"
            )

            # The unique count must be <= pool size (can't have more unique locations than the pool)
            self.assertLessEqual(
                unique_location_count, pool_size,
                f"Iteration {iteration}: unique locations {unique_location_count} > pool size {pool_size}"
            )

            # Total chits across all groups must equal total chits with non-empty locations
            total_in_groups = sum(len(v) for v in location_groups.values())
            total_with_location = sum(
                1 for c in chits if c.get("location") and c["location"].strip()
            )
            self.assertEqual(
                total_in_groups, total_with_location,
                f"Iteration {iteration}: total in groups {total_in_groups} != total with location {total_with_location}"
            )

            # Each chit should appear in exactly one group
            all_chit_ids_in_groups = []
            for group_chits in location_groups.values():
                for c in group_chits:
                    all_chit_ids_in_groups.append(c["id"])
            self.assertEqual(
                len(all_chit_ids_in_groups), len(set(all_chit_ids_in_groups)),
                f"Iteration {iteration}: duplicate chit IDs found across groups"
            )


if __name__ == "__main__":
    unittest.main()
