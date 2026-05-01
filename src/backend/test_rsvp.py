"""
Property-based tests for the chit invitation RSVP system.

Feature: chit-invitation-rsvp
Uses Python stdlib only (unittest + random) — no external libraries.
Each property test runs 120+ iterations with randomly generated inputs.

NOTE: We inline the minimal production logic from src/backend/sharing.py
to avoid importing backend modules that pull in FastAPI.
"""

import json
import random
import string
import unittest
import uuid


# ── Inlined production logic (from src/backend/sharing.py) ───────────────
# Kept in sync manually.  Only the pure-function helpers are copied here so
# the test file can run with *zero* third-party packages.

VALID_RSVP_STATUSES = {"invited", "accepted", "declined"}


def _normalize_share_rsvp(shares):
    """Ensure every share entry has a valid rsvp_status, defaulting to 'invited'.

    Mirrors src/backend/sharing._normalize_share_rsvp — kept in sync manually.
    """
    if not isinstance(shares, list):
        return shares
    for entry in shares:
        if isinstance(entry, dict) and entry.get("rsvp_status") is None:
            entry["rsvp_status"] = "invited"
    return shares


def _validate_rsvp_status(status):
    """Validate that an rsvp_status value is one of the allowed values.

    Mirrors the validation logic in the PATCH /api/chits/{chit_id}/rsvp endpoint.
    Returns True if valid, False otherwise.
    """
    return status in VALID_RSVP_STATUSES


# ── Random data generators ───────────────────────────────────────────────

_PBT_ITERATIONS = 120  # comfortably above the 100 minimum


def _random_uuid():
    """Generate a random UUID string."""
    return str(uuid.uuid4())


def _random_string(max_len=20):
    """Generate a random alphanumeric string."""
    length = random.randint(1, max_len)
    return "".join(random.choices(string.ascii_letters + string.digits + " _-", k=length))


def _random_role():
    """Return a random sharing role (manager or viewer)."""
    return random.choice(["manager", "viewer"])


def _random_rsvp_status_valid():
    """Return a random valid RSVP status."""
    return random.choice(["invited", "accepted", "declined"])


def _random_share_entry(rsvp_status=None, include_rsvp=True):
    """Generate a random share entry dict.

    Args:
        rsvp_status: If provided, use this value. Otherwise generate randomly.
        include_rsvp: If False, omit the rsvp_status key entirely.
    """
    entry = {
        "user_id": _random_uuid(),
        "role": _random_role(),
    }
    if include_rsvp:
        if rsvp_status is not None:
            entry["rsvp_status"] = rsvp_status
        else:
            entry["rsvp_status"] = _random_rsvp_status_valid()
    return entry


def _random_shares_list_valid(min_count=1, max_count=6):
    """Generate a random list of share entries with valid rsvp_status values."""
    count = random.randint(min_count, max_count)
    return [_random_share_entry(rsvp_status=_random_rsvp_status_valid()) for _ in range(count)]


def _random_shares_list_mixed(min_count=1, max_count=6):
    """Generate a random list of share entries — some with valid rsvp_status, some missing.

    This simulates the real-world scenario: new entries have valid statuses set by
    the frontend/API, while legacy entries may be missing the field entirely.
    """
    count = random.randint(min_count, max_count)
    shares = []
    for _ in range(count):
        if random.random() < 0.5:
            # Entry with valid rsvp_status (set by API/frontend)
            shares.append(_random_share_entry(rsvp_status=_random_rsvp_status_valid()))
        else:
            # Legacy entry missing rsvp_status
            shares.append(_random_share_entry(include_rsvp=False))
    return shares


# ── Property 1: RSVP status is always valid ──────────────────────────────

class TestProperty1RsvpStatusAlwaysValid(unittest.TestCase):
    """Feature: chit-invitation-rsvp, Property 1: RSVP status is always valid

    **Validates: Requirements 1.1, 1.2**

    For any share entry in any chit's shares list, the rsvp_status field
    SHALL be present and its value SHALL be one of "invited", "accepted",
    or "declined". When a new share entry is created, rsvp_status SHALL
    default to "invited".

    The system enforces this property through two mechanisms:
    1. The PATCH endpoint validates that only valid statuses are accepted
    2. The normalization function ensures missing statuses default to "invited"

    Together, these guarantee that after normalization, all share entries
    that entered the system through valid paths have a valid rsvp_status.
    """

    def test_valid_entries_remain_valid_after_normalization(self):
        """Share entries with valid rsvp_status values remain valid after normalization."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                # Generate shares where all entries have valid rsvp_status
                shares = _random_shares_list_valid(min_count=1, max_count=8)

                # Record original statuses
                original_statuses = [entry["rsvp_status"] for entry in shares]

                # Verify all are valid before normalization
                for status in original_statuses:
                    self.assertIn(status, VALID_RSVP_STATUSES)

                # Run normalization
                normalized = _normalize_share_rsvp(shares)

                # All entries must still have valid rsvp_status, unchanged
                for j, entry in enumerate(normalized):
                    self.assertIn(
                        "rsvp_status", entry,
                        f"Share entry {j} missing rsvp_status after normalization "
                        f"(iter {i}): {entry!r}"
                    )
                    self.assertIn(
                        entry["rsvp_status"], VALID_RSVP_STATUSES,
                        f"Share entry {j} has invalid rsvp_status "
                        f"'{entry['rsvp_status']}' after normalization "
                        f"(iter {i}): {entry!r}"
                    )
                    self.assertEqual(
                        entry["rsvp_status"], original_statuses[j],
                        f"Share entry {j} rsvp_status changed from "
                        f"'{original_statuses[j]}' to '{entry['rsvp_status']}' "
                        f"(iter {i})"
                    )

    def test_missing_entries_get_valid_default_after_normalization(self):
        """Share entries missing rsvp_status get 'invited' (a valid status) after normalization."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                # Generate shares with no rsvp_status (simulating legacy/new entries)
                count = random.randint(1, 8)
                shares = [_random_share_entry(include_rsvp=False) for _ in range(count)]

                # Verify none have rsvp_status before normalization
                for entry in shares:
                    self.assertNotIn("rsvp_status", entry)

                # Run normalization
                normalized = _normalize_share_rsvp(shares)

                # All entries should now have rsvp_status == "invited" (a valid value)
                for j, entry in enumerate(normalized):
                    self.assertIn(
                        "rsvp_status", entry,
                        f"Share entry {j} missing rsvp_status after normalization "
                        f"(iter {i}): {entry!r}"
                    )
                    self.assertEqual(
                        entry["rsvp_status"], "invited",
                        f"Share entry {j} should default to 'invited', got "
                        f"'{entry['rsvp_status']}' (iter {i}): {entry!r}"
                    )
                    self.assertIn(
                        entry["rsvp_status"], VALID_RSVP_STATUSES,
                        f"Default rsvp_status 'invited' should be in valid set "
                        f"(iter {i})"
                    )

    def test_mixed_entries_all_valid_after_normalization(self):
        """A mix of valid and missing rsvp_status entries all become valid after normalization."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                # Generate a mix: some entries have valid status, some are missing
                shares = _random_shares_list_mixed(min_count=1, max_count=8)

                # Track which had valid status and which were missing
                had_status = []
                for entry in shares:
                    if "rsvp_status" in entry:
                        had_status.append(entry["rsvp_status"])
                    else:
                        had_status.append(None)

                # Run normalization
                normalized = _normalize_share_rsvp(shares)

                # Every entry must now have a valid rsvp_status
                for j, entry in enumerate(normalized):
                    self.assertIn(
                        "rsvp_status", entry,
                        f"Share entry {j} missing rsvp_status after normalization "
                        f"(iter {i}): {entry!r}"
                    )
                    self.assertIn(
                        entry["rsvp_status"], VALID_RSVP_STATUSES,
                        f"Share entry {j} has invalid rsvp_status "
                        f"'{entry['rsvp_status']}' after normalization "
                        f"(iter {i}): {entry!r}"
                    )

                    # Entries that had valid status should be unchanged
                    if had_status[j] is not None:
                        self.assertEqual(
                            entry["rsvp_status"], had_status[j],
                            f"Share entry {j} valid status changed from "
                            f"'{had_status[j]}' to '{entry['rsvp_status']}' "
                            f"(iter {i})"
                        )
                    else:
                        # Entries that were missing should now be "invited"
                        self.assertEqual(
                            entry["rsvp_status"], "invited",
                            f"Share entry {j} missing status should default to "
                            f"'invited', got '{entry['rsvp_status']}' (iter {i})"
                        )

    def test_api_validation_rejects_invalid_statuses(self):
        """The API validation function rejects all non-valid rsvp_status values."""
        invalid_values = [
            "pending", "maybe", "tentative", "yes", "no",
            "ACCEPTED", "Declined", "INVITED",
            "", "null", "undefined",
            True, False, 0, 1, -1, 42, 3.14, None,
        ]
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                # Valid statuses must pass validation
                valid_status = _random_rsvp_status_valid()
                self.assertTrue(
                    _validate_rsvp_status(valid_status),
                    f"Valid status '{valid_status}' should pass validation (iter {i})"
                )

                # A random invalid value must fail validation
                invalid_val = random.choice(invalid_values + [_random_string(10)])
                if invalid_val not in VALID_RSVP_STATUSES:
                    self.assertFalse(
                        _validate_rsvp_status(invalid_val),
                        f"Invalid status '{invalid_val}' should fail validation (iter {i})"
                    )


# ── Property 2: Missing rsvp_status normalized to invited ────────────────

class TestProperty2MissingRsvpNormalized(unittest.TestCase):
    """Feature: chit-invitation-rsvp, Property 2: Missing rsvp_status normalized to invited

    **Validates: Requirements 1.3**

    For any share entry that lacks an rsvp_status field (legacy data),
    loading the chit through the backend SHALL produce a share entry
    with rsvp_status set to "invited".
    """

    def test_entries_without_rsvp_status_get_invited(self):
        """All share entries missing rsvp_status are normalized to 'invited'."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                # Generate 1-8 share entries, all missing rsvp_status
                count = random.randint(1, 8)
                shares = [_random_share_entry(include_rsvp=False) for _ in range(count)]

                # Confirm none have rsvp_status before normalization
                for entry in shares:
                    self.assertNotIn("rsvp_status", entry)

                # Normalize
                normalized = _normalize_share_rsvp(shares)

                # Every entry must now have rsvp_status == "invited"
                for j, entry in enumerate(normalized):
                    self.assertIn(
                        "rsvp_status", entry,
                        f"Entry {j} missing rsvp_status after normalization "
                        f"(iter {i}): {entry!r}"
                    )
                    self.assertEqual(
                        entry["rsvp_status"], "invited",
                        f"Entry {j} should be 'invited', got "
                        f"'{entry['rsvp_status']}' (iter {i}): {entry!r}"
                    )

    def test_entries_with_extra_fields_still_normalized(self):
        """Share entries with extra/unexpected fields but no rsvp_status get 'invited'."""
        extra_field_pools = [
            "display_name", "email", "avatar_url", "added_at",
            "notes", "color", "priority", "custom_field",
        ]
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                count = random.randint(1, 6)
                shares = []
                for _ in range(count):
                    entry = {
                        "user_id": _random_uuid(),
                        "role": _random_role(),
                    }
                    # Add 0-4 random extra fields
                    num_extras = random.randint(0, 4)
                    chosen_extras = random.sample(
                        extra_field_pools, min(num_extras, len(extra_field_pools))
                    )
                    for field in chosen_extras:
                        entry[field] = _random_string(15)
                    # Ensure rsvp_status is NOT present
                    entry.pop("rsvp_status", None)
                    shares.append(entry)

                # Normalize
                normalized = _normalize_share_rsvp(shares)

                for j, entry in enumerate(normalized):
                    self.assertEqual(
                        entry["rsvp_status"], "invited",
                        f"Entry {j} with extra fields should be 'invited', got "
                        f"'{entry.get('rsvp_status')}' (iter {i}): {entry!r}"
                    )
                    # Extra fields should still be present (not stripped)
                    self.assertIn("user_id", entry)
                    self.assertIn("role", entry)

    def test_minimal_entries_only_user_id(self):
        """Share entries with only user_id (no role, no rsvp_status) get 'invited'."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                count = random.randint(1, 6)
                shares = [{"user_id": _random_uuid()} for _ in range(count)]

                normalized = _normalize_share_rsvp(shares)

                for j, entry in enumerate(normalized):
                    self.assertEqual(
                        entry["rsvp_status"], "invited",
                        f"Minimal entry {j} should be 'invited', got "
                        f"'{entry.get('rsvp_status')}' (iter {i}): {entry!r}"
                    )

    def test_empty_dict_entries_get_invited(self):
        """Completely empty dict entries still get rsvp_status set to 'invited'."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                count = random.randint(1, 5)
                shares = [{} for _ in range(count)]

                normalized = _normalize_share_rsvp(shares)

                for j, entry in enumerate(normalized):
                    self.assertEqual(
                        entry["rsvp_status"], "invited",
                        f"Empty entry {j} should be 'invited', got "
                        f"'{entry.get('rsvp_status')}' (iter {i}): {entry!r}"
                    )

    def test_json_round_trip_preserves_normalization(self):
        """Entries missing rsvp_status, after JSON serialize/deserialize + normalize, get 'invited'."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                count = random.randint(1, 6)
                shares = [_random_share_entry(include_rsvp=False) for _ in range(count)]

                # Simulate a JSON round-trip (as happens in SQLite storage)
                serialized = json.dumps(shares)
                deserialized = json.loads(serialized)

                # Confirm rsvp_status is still absent after round-trip
                for entry in deserialized:
                    self.assertNotIn("rsvp_status", entry)

                # Normalize
                normalized = _normalize_share_rsvp(deserialized)

                for j, entry in enumerate(normalized):
                    self.assertEqual(
                        entry["rsvp_status"], "invited",
                        f"Entry {j} after JSON round-trip should be 'invited', got "
                        f"'{entry.get('rsvp_status')}' (iter {i}): {entry!r}"
                    )


if __name__ == "__main__":
    unittest.main()


# ── Property 3: RSVP status round-trip preservation ──────────────────────

class TestProperty3RsvpRoundTripPreservation(unittest.TestCase):
    """Feature: chit-invitation-rsvp, Property 3: RSVP status round-trip preservation

    **Validates: Requirements 1.4**

    For any chit with shares containing rsvp_status values, saving the chit
    and then loading it SHALL produce share entries with identical rsvp_status
    values.

    The round-trip simulates the real database path:
    1. Build share entries with valid rsvp_status values (in-memory)
    2. Serialize to JSON string (simulating SQLite INSERT/UPDATE)
    3. Deserialize from JSON string (simulating SQLite SELECT)
    4. Run _normalize_share_rsvp (as _deserialize_chit_fields does on load)
    5. Assert every rsvp_status is identical to the original
    """

    def test_single_entry_round_trip(self):
        """A single share entry preserves its rsvp_status through JSON round-trip + normalization."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                original_status = _random_rsvp_status_valid()
                shares = [_random_share_entry(rsvp_status=original_status)]

                # Simulate save: serialize to JSON
                serialized = json.dumps(shares)

                # Simulate load: deserialize from JSON
                loaded = json.loads(serialized)

                # Normalize (as backend does on load)
                normalized = _normalize_share_rsvp(loaded)

                self.assertEqual(len(normalized), 1)
                self.assertEqual(
                    normalized[0]["rsvp_status"], original_status,
                    f"Round-trip changed rsvp_status from '{original_status}' "
                    f"to '{normalized[0]['rsvp_status']}' (iter {i})"
                )

    def test_multiple_entries_round_trip(self):
        """Multiple share entries each preserve their rsvp_status through JSON round-trip + normalization."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                shares = _random_shares_list_valid(min_count=1, max_count=8)

                # Record original statuses
                original_statuses = [entry["rsvp_status"] for entry in shares]

                # Simulate save: serialize to JSON
                serialized = json.dumps(shares)

                # Simulate load: deserialize from JSON
                loaded = json.loads(serialized)

                # Normalize (as backend does on load)
                normalized = _normalize_share_rsvp(loaded)

                # Same count
                self.assertEqual(
                    len(normalized), len(original_statuses),
                    f"Entry count changed from {len(original_statuses)} to "
                    f"{len(normalized)} (iter {i})"
                )

                # Each rsvp_status must be identical
                for j, entry in enumerate(normalized):
                    self.assertEqual(
                        entry["rsvp_status"], original_statuses[j],
                        f"Entry {j} rsvp_status changed from "
                        f"'{original_statuses[j]}' to '{entry['rsvp_status']}' "
                        f"after round-trip (iter {i})"
                    )

    def test_round_trip_preserves_all_share_fields(self):
        """The round-trip preserves user_id, role, and rsvp_status together — no field corruption."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                shares = _random_shares_list_valid(min_count=1, max_count=6)

                # Snapshot originals
                originals = [
                    {
                        "user_id": e["user_id"],
                        "role": e["role"],
                        "rsvp_status": e["rsvp_status"],
                    }
                    for e in shares
                ]

                # Round-trip
                serialized = json.dumps(shares)
                loaded = json.loads(serialized)
                normalized = _normalize_share_rsvp(loaded)

                for j, entry in enumerate(normalized):
                    self.assertEqual(
                        entry["user_id"], originals[j]["user_id"],
                        f"Entry {j} user_id corrupted after round-trip (iter {i})"
                    )
                    self.assertEqual(
                        entry["role"], originals[j]["role"],
                        f"Entry {j} role corrupted after round-trip (iter {i})"
                    )
                    self.assertEqual(
                        entry["rsvp_status"], originals[j]["rsvp_status"],
                        f"Entry {j} rsvp_status corrupted after round-trip (iter {i})"
                    )

    def test_double_round_trip_is_idempotent(self):
        """Two consecutive round-trips produce the same rsvp_status values as one."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                shares = _random_shares_list_valid(min_count=1, max_count=6)
                original_statuses = [e["rsvp_status"] for e in shares]

                # First round-trip
                s1 = json.dumps(shares)
                l1 = json.loads(s1)
                n1 = _normalize_share_rsvp(l1)

                # Second round-trip
                s2 = json.dumps(n1)
                l2 = json.loads(s2)
                n2 = _normalize_share_rsvp(l2)

                for j, entry in enumerate(n2):
                    self.assertEqual(
                        entry["rsvp_status"], original_statuses[j],
                        f"Entry {j} rsvp_status drifted after double round-trip: "
                        f"'{original_statuses[j]}' → '{entry['rsvp_status']}' "
                        f"(iter {i})"
                    )


# ── Inlined RSVP update authorization logic (from routes/chits.py) ───────
# Pure-function mirror of the PATCH /api/chits/{chit_id}/rsvp authorization
# checks.  No FastAPI, no database — just the decision logic.

def _check_rsvp_update_authorization(user_id, owner_id, shares, requested_status):
    """Check whether an RSVP update request should succeed or be rejected.

    Mirrors the authorization logic in the PATCH /api/chits/{chit_id}/rsvp
    endpoint in src/backend/routes/chits.py.

    Args:
        user_id: The ID of the user requesting the RSVP update.
        owner_id: The ID of the chit owner.
        shares: List of share entry dicts (each with at least 'user_id').
        requested_status: The rsvp_status value the user wants to set.

    Returns:
        A tuple (allowed: bool, error_code: int | None, error_detail: str | None).
        - (True, None, None) if the update should succeed.
        - (False, 400, ...) if the requested_status is invalid.
        - (False, 403, ...) if the user is the owner.
        - (False, 404, ...) if the user is not in the shares list.
    """
    # Step 1: Validate rsvp_status
    if requested_status not in VALID_RSVP_STATUSES:
        return (False, 400, "Invalid rsvp_status. Must be one of: invited, accepted, declined")

    # Step 2: Owner cannot have RSVP status
    if user_id == owner_id:
        return (False, 403, "Owner cannot have RSVP status")

    # Step 3: User must be in the shares list
    user_found = False
    for entry in shares:
        if isinstance(entry, dict) and entry.get("user_id") == user_id:
            user_found = True
            break

    if not user_found:
        return (False, 404, "Chit not found or user not in shares list")

    # All checks passed
    return (True, None, None)


# ── Property 4: RSVP update authorization ────────────────────────────────

class TestProperty4RsvpUpdateAuthorization(unittest.TestCase):
    """Feature: chit-invitation-rsvp, Property 4: RSVP update authorization

    **Validates: Requirements 2.4, 2.6, 2.7, 2.8, 6.4**

    For any user and any chit, an RSVP status update request SHALL succeed
    if and only if: (a) the user is in the chit's shares list, (b) the user
    is not the chit owner, and (c) the requested rsvp_status is a valid value.
    All other requests SHALL be rejected.
    """

    # ── Helper generators ────────────────────────────────────────────────

    def _random_invalid_status(self):
        """Generate a random string that is NOT a valid RSVP status."""
        invalid_pool = [
            "pending", "maybe", "tentative", "yes", "no",
            "ACCEPTED", "Declined", "INVITED",
            "", "null", "undefined", "none", "true", "false",
        ]
        # Mix in random strings for variety
        candidate = random.choice(invalid_pool + [_random_string(12)])
        # Ensure it's truly invalid (random string could theoretically match)
        while candidate in VALID_RSVP_STATUSES:
            candidate = _random_string(12)
        return candidate

    def _build_scenario(self, user_in_shares, user_is_owner, valid_status):
        """Build a randomized test scenario with the specified conditions.

        Args:
            user_in_shares: Whether the requesting user should be in the shares list.
            user_is_owner: Whether the requesting user should be the chit owner.
            valid_status: Whether the requested rsvp_status should be valid.

        Returns:
            (user_id, owner_id, shares, requested_status)
        """
        user_id = _random_uuid()

        if user_is_owner:
            owner_id = user_id
        else:
            owner_id = _random_uuid()

        # Build a shares list with 0-5 other users
        other_count = random.randint(0, 5)
        shares = [_random_share_entry() for _ in range(other_count)]

        if user_in_shares:
            # Add the requesting user to the shares list at a random position
            user_entry = {
                "user_id": user_id,
                "role": _random_role(),
                "rsvp_status": _random_rsvp_status_valid(),
            }
            insert_pos = random.randint(0, len(shares))
            shares.insert(insert_pos, user_entry)

        if valid_status:
            requested_status = _random_rsvp_status_valid()
        else:
            requested_status = self._random_invalid_status()

        return user_id, owner_id, shares, requested_status

    # ── Test: all conditions met → success ───────────────────────────────

    def test_success_when_in_shares_not_owner_valid_status(self):
        """RSVP update succeeds when user is in shares, not owner, and status is valid."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                user_id, owner_id, shares, requested_status = self._build_scenario(
                    user_in_shares=True, user_is_owner=False, valid_status=True,
                )

                allowed, error_code, error_detail = _check_rsvp_update_authorization(
                    user_id, owner_id, shares, requested_status,
                )

                self.assertTrue(
                    allowed,
                    f"Should succeed: user in shares, not owner, valid status "
                    f"'{requested_status}' (iter {i}). Got error {error_code}: {error_detail}"
                )
                self.assertIsNone(error_code)
                self.assertIsNone(error_detail)

    # ── Test: user not in shares → rejected (404) ────────────────────────

    def test_rejected_when_not_in_shares(self):
        """RSVP update is rejected when user is not in the shares list."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                user_id, owner_id, shares, requested_status = self._build_scenario(
                    user_in_shares=False, user_is_owner=False, valid_status=True,
                )

                allowed, error_code, error_detail = _check_rsvp_update_authorization(
                    user_id, owner_id, shares, requested_status,
                )

                self.assertFalse(
                    allowed,
                    f"Should be rejected: user not in shares (iter {i})"
                )
                self.assertEqual(
                    error_code, 404,
                    f"Expected 404 for user not in shares, got {error_code} (iter {i})"
                )

    # ── Test: user is owner → rejected (403) ─────────────────────────────

    def test_rejected_when_user_is_owner(self):
        """RSVP update is rejected when user is the chit owner."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                user_id, owner_id, shares, requested_status = self._build_scenario(
                    user_in_shares=True, user_is_owner=True, valid_status=True,
                )

                allowed, error_code, error_detail = _check_rsvp_update_authorization(
                    user_id, owner_id, shares, requested_status,
                )

                self.assertFalse(
                    allowed,
                    f"Should be rejected: user is owner (iter {i})"
                )
                self.assertEqual(
                    error_code, 403,
                    f"Expected 403 for owner, got {error_code} (iter {i})"
                )

    # ── Test: invalid status → rejected (400) ────────────────────────────

    def test_rejected_when_invalid_status(self):
        """RSVP update is rejected when requested status is invalid."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                user_id, owner_id, shares, requested_status = self._build_scenario(
                    user_in_shares=True, user_is_owner=False, valid_status=False,
                )

                allowed, error_code, error_detail = _check_rsvp_update_authorization(
                    user_id, owner_id, shares, requested_status,
                )

                self.assertFalse(
                    allowed,
                    f"Should be rejected: invalid status '{requested_status}' (iter {i})"
                )
                self.assertEqual(
                    error_code, 400,
                    f"Expected 400 for invalid status, got {error_code} (iter {i})"
                )

    # ── Test: owner + invalid status → rejected (400 takes precedence) ───

    def test_rejected_invalid_status_checked_before_owner(self):
        """Invalid status is checked before owner check (400 before 403)."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                user_id, owner_id, shares, requested_status = self._build_scenario(
                    user_in_shares=True, user_is_owner=True, valid_status=False,
                )

                allowed, error_code, error_detail = _check_rsvp_update_authorization(
                    user_id, owner_id, shares, requested_status,
                )

                self.assertFalse(
                    allowed,
                    f"Should be rejected: owner + invalid status (iter {i})"
                )
                # 400 takes precedence over 403 because status validation is first
                self.assertEqual(
                    error_code, 400,
                    f"Expected 400 (invalid status checked first), got {error_code} (iter {i})"
                )

    # ── Test: not in shares + invalid status → rejected (400 first) ──────

    def test_rejected_invalid_status_checked_before_shares(self):
        """Invalid status is checked before shares membership (400 before 404)."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                user_id, owner_id, shares, requested_status = self._build_scenario(
                    user_in_shares=False, user_is_owner=False, valid_status=False,
                )

                allowed, error_code, error_detail = _check_rsvp_update_authorization(
                    user_id, owner_id, shares, requested_status,
                )

                self.assertFalse(
                    allowed,
                    f"Should be rejected: not in shares + invalid status (iter {i})"
                )
                self.assertEqual(
                    error_code, 400,
                    f"Expected 400 (invalid status checked first), got {error_code} (iter {i})"
                )

    # ── Test: comprehensive random scenarios ─────────────────────────────

    def test_comprehensive_random_authorization_scenarios(self):
        """Randomly generate all combinations and verify the authorization decision is correct."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                # Randomly pick each condition
                user_in_shares = random.choice([True, False])
                user_is_owner = random.choice([True, False])
                valid_status = random.choice([True, False])

                user_id, owner_id, shares, requested_status = self._build_scenario(
                    user_in_shares=user_in_shares,
                    user_is_owner=user_is_owner,
                    valid_status=valid_status,
                )

                allowed, error_code, error_detail = _check_rsvp_update_authorization(
                    user_id, owner_id, shares, requested_status,
                )

                # Determine expected outcome based on the authorization rules
                # The endpoint checks in order: (1) valid status, (2) not owner, (3) in shares
                if not valid_status:
                    # Invalid status → 400 (checked first)
                    self.assertFalse(allowed, f"Invalid status should be rejected (iter {i})")
                    self.assertEqual(error_code, 400, f"Expected 400 for invalid status (iter {i})")
                elif user_is_owner:
                    # Owner → 403 (checked second)
                    self.assertFalse(allowed, f"Owner should be rejected (iter {i})")
                    self.assertEqual(error_code, 403, f"Expected 403 for owner (iter {i})")
                elif not user_in_shares:
                    # Not in shares → 404 (checked third)
                    self.assertFalse(allowed, f"Not in shares should be rejected (iter {i})")
                    self.assertEqual(error_code, 404, f"Expected 404 for not in shares (iter {i})")
                else:
                    # All conditions met → success
                    self.assertTrue(
                        allowed,
                        f"Should succeed: in_shares={user_in_shares}, "
                        f"is_owner={user_is_owner}, valid={valid_status} (iter {i}). "
                        f"Got error {error_code}: {error_detail}"
                    )


# ── Property 5: Owner exclusion from RSVP ────────────────────────────────

class TestProperty5OwnerExclusionFromRsvp(unittest.TestCase):
    """Feature: chit-invitation-rsvp, Property 5: Owner exclusion from RSVP

    **Validates: Requirements 2.8**

    For any chit, the owner SHALL never appear in the shares list with an
    rsvp_status field.  The RSVP system applies exclusively to shared users,
    not the owner.

    This property is enforced at two levels:
    1. The shares list should never contain the owner as a shared user with
       an rsvp_status — the frontend prevents this, and the backend treats
       the owner differently from shared users.
    2. The PATCH /api/chits/{chit_id}/rsvp endpoint rejects requests from
       the owner with a 403 error.
    """

    # ── Helper: build a random chit dict with owner and shares ───────────

    def _random_chit_with_shares(self, include_owner_in_shares=False):
        """Generate a random chit-like dict with an owner_id and shares list.

        Args:
            include_owner_in_shares: If True, deliberately insert the owner
                into the shares list (to test the edge case).

        Returns:
            (owner_id, shares) tuple.
        """
        owner_id = _random_uuid()

        # Build 0-5 shares with other users (never the owner)
        other_count = random.randint(0, 5)
        shares = []
        for _ in range(other_count):
            shares.append({
                "user_id": _random_uuid(),
                "role": _random_role(),
                "rsvp_status": _random_rsvp_status_valid(),
            })

        if include_owner_in_shares:
            # Deliberately add the owner to the shares list (edge case)
            owner_entry = {
                "user_id": owner_id,
                "role": random.choice(["manager", "viewer"]),
                "rsvp_status": _random_rsvp_status_valid(),
            }
            insert_pos = random.randint(0, len(shares))
            shares.insert(insert_pos, owner_entry)

        return owner_id, shares

    # ── Test: well-formed shares never contain the owner ─────────────────

    def test_well_formed_shares_exclude_owner(self):
        """In a properly constructed shares list, the owner never appears with rsvp_status."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                owner_id, shares = self._random_chit_with_shares(
                    include_owner_in_shares=False,
                )

                # Verify the owner is not in the shares list at all
                owner_entries = [
                    entry for entry in shares
                    if isinstance(entry, dict) and entry.get("user_id") == owner_id
                ]
                self.assertEqual(
                    len(owner_entries), 0,
                    f"Owner {owner_id} should not appear in shares list "
                    f"(iter {i}): found {owner_entries!r}"
                )

                # Verify no share entry with rsvp_status belongs to the owner
                for j, entry in enumerate(shares):
                    if isinstance(entry, dict) and "rsvp_status" in entry:
                        self.assertNotEqual(
                            entry.get("user_id"), owner_id,
                            f"Share entry {j} has rsvp_status but belongs to "
                            f"owner {owner_id} (iter {i}): {entry!r}"
                        )

    # ── Test: RSVP update from owner is always rejected with 403 ─────────

    def test_owner_rsvp_update_always_rejected_403(self):
        """RSVP update requests from the owner are always rejected with 403."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                owner_id, shares = self._random_chit_with_shares(
                    include_owner_in_shares=random.choice([True, False]),
                )

                # Owner tries to update RSVP with a valid status
                requested_status = _random_rsvp_status_valid()

                allowed, error_code, error_detail = _check_rsvp_update_authorization(
                    user_id=owner_id,
                    owner_id=owner_id,
                    shares=shares,
                    requested_status=requested_status,
                )

                self.assertFalse(
                    allowed,
                    f"Owner RSVP update should always be rejected (iter {i}). "
                    f"owner_id={owner_id}, status={requested_status}"
                )
                self.assertEqual(
                    error_code, 403,
                    f"Expected 403 for owner RSVP update, got {error_code} "
                    f"(iter {i})"
                )

    # ── Test: owner rejected even when present in shares list ────────────

    def test_owner_rejected_even_if_in_shares(self):
        """Even if the owner is erroneously in the shares list, RSVP update is rejected."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                owner_id, shares = self._random_chit_with_shares(
                    include_owner_in_shares=True,
                )

                # Confirm the owner IS in the shares list for this edge case
                owner_in_shares = any(
                    isinstance(e, dict) and e.get("user_id") == owner_id
                    for e in shares
                )
                self.assertTrue(
                    owner_in_shares,
                    f"Setup error: owner should be in shares for this test (iter {i})"
                )

                # Owner tries every valid RSVP status — all must be rejected
                for status in ["invited", "accepted", "declined"]:
                    allowed, error_code, error_detail = _check_rsvp_update_authorization(
                        user_id=owner_id,
                        owner_id=owner_id,
                        shares=shares,
                        requested_status=status,
                    )

                    self.assertFalse(
                        allowed,
                        f"Owner in shares should still be rejected for "
                        f"status '{status}' (iter {i})"
                    )
                    self.assertEqual(
                        error_code, 403,
                        f"Expected 403 for owner in shares, got {error_code} "
                        f"for status '{status}' (iter {i})"
                    )

    # ── Test: non-owner shared users CAN have rsvp_status ────────────────

    def test_non_owner_shared_users_can_have_rsvp_status(self):
        """Non-owner users in the shares list are allowed to have rsvp_status (contrast test)."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                owner_id, shares = self._random_chit_with_shares(
                    include_owner_in_shares=False,
                )

                # Ensure at least one shared user exists
                if not shares:
                    shares.append({
                        "user_id": _random_uuid(),
                        "role": _random_role(),
                        "rsvp_status": _random_rsvp_status_valid(),
                    })

                # Pick a random shared user (not the owner)
                shared_user = random.choice(shares)
                shared_user_id = shared_user["user_id"]

                # This user should be allowed to update RSVP
                requested_status = _random_rsvp_status_valid()

                allowed, error_code, error_detail = _check_rsvp_update_authorization(
                    user_id=shared_user_id,
                    owner_id=owner_id,
                    shares=shares,
                    requested_status=requested_status,
                )

                self.assertTrue(
                    allowed,
                    f"Non-owner shared user should be allowed to update RSVP "
                    f"(iter {i}). user={shared_user_id}, owner={owner_id}, "
                    f"status={requested_status}. Got error {error_code}: {error_detail}"
                )

    # ── Test: owner with invalid status gets 400 (not 403) ──────────────

    def test_owner_with_invalid_status_gets_400_before_403(self):
        """When the owner sends an invalid status, 400 is returned (validation before owner check)."""
        invalid_statuses = [
            "pending", "maybe", "yes", "no", "ACCEPTED", "", "null",
        ]
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                owner_id, shares = self._random_chit_with_shares(
                    include_owner_in_shares=random.choice([True, False]),
                )

                # Owner sends an invalid status
                invalid_status = random.choice(
                    invalid_statuses + [_random_string(10)]
                )
                # Ensure it's truly invalid
                while invalid_status in VALID_RSVP_STATUSES:
                    invalid_status = _random_string(10)

                allowed, error_code, error_detail = _check_rsvp_update_authorization(
                    user_id=owner_id,
                    owner_id=owner_id,
                    shares=shares,
                    requested_status=invalid_status,
                )

                self.assertFalse(
                    allowed,
                    f"Owner with invalid status should be rejected (iter {i})"
                )
                # 400 takes precedence over 403 because validation is checked first
                self.assertEqual(
                    error_code, 400,
                    f"Expected 400 (invalid status checked before owner), "
                    f"got {error_code} (iter {i})"
                )


# ── Inlined hide-declined filter logic (from frontend) ───────────────────
# Pure-function mirrors of _isDeclinedByCurrentUser (main-views.js) and
# the hide-declined filter in displayChits (main-init.js).


def _is_declined_by_current_user(chit, current_user_id):
    """Check if the current user has declined this shared chit.

    Mirrors _isDeclinedByCurrentUser() in src/frontend/js/dashboard/main-views.js.
    Returns False for owned chits (owners don't have RSVP status).

    Args:
        chit: Dict with at least 'owner_id' and 'shares' keys.
        current_user_id: The ID of the current user.

    Returns:
        True if the current user's rsvp_status is 'declined', False otherwise.
    """
    if not current_user_id:
        return False
    # Owners don't have RSVP status
    if chit.get("owner_id") == current_user_id:
        return False
    shares = chit.get("shares") or []
    for entry in shares:
        if isinstance(entry, dict) and entry.get("user_id") == current_user_id:
            return (entry.get("rsvp_status") or "invited") == "declined"
    return False


def _apply_hide_declined_filter(chits_list, current_user_id, hide_declined_enabled):
    """Apply the hide-declined filter to a list of chits.

    Mirrors the hide-declined filter block in displayChits() in
    src/frontend/js/dashboard/main-init.js:

        if (_hideDeclinedSetting === '1' && typeof _isDeclinedByCurrentUser === 'function') {
            filteredChits = filteredChits.filter(function(c) { return !_isDeclinedByCurrentUser(c); });
        }

    Args:
        chits_list: List of chit dicts.
        current_user_id: The ID of the current user.
        hide_declined_enabled: Whether the hide_declined setting is "1" (enabled).

    Returns:
        Filtered list of chits (new list, original is not modified).
    """
    if not hide_declined_enabled:
        return list(chits_list)
    return [c for c in chits_list if not _is_declined_by_current_user(c, current_user_id)]


# ── Random chit generators for Property 6 ────────────────────────────────

def _random_chit(owner_id, current_user_id=None, force_rsvp_status=None,
                 include_current_user=None, is_owned=False):
    """Generate a random chit dict for hide-declined filter testing.

    Args:
        owner_id: The owner_id for the chit.
        current_user_id: If provided and include_current_user is True,
            add this user to the shares list.
        force_rsvp_status: If set, force the current user's rsvp_status to this value.
        include_current_user: If True, include current_user_id in shares.
            If False, exclude them. If None, random.
        is_owned: If True, set owner_id to current_user_id (owned chit).

    Returns:
        A chit dict with id, owner_id, title, and shares.
    """
    chit_id = _random_uuid()
    actual_owner = current_user_id if is_owned else owner_id

    # Build shares with 0-4 other random users
    other_count = random.randint(0, 4)
    shares = []
    for _ in range(other_count):
        shares.append({
            "user_id": _random_uuid(),
            "role": _random_role(),
            "rsvp_status": _random_rsvp_status_valid(),
        })

    # Optionally include the current user in shares
    should_include = include_current_user if include_current_user is not None else random.choice([True, False])
    if should_include and current_user_id and not is_owned:
        rsvp = force_rsvp_status if force_rsvp_status else _random_rsvp_status_valid()
        user_entry = {
            "user_id": current_user_id,
            "role": _random_role(),
            "rsvp_status": rsvp,
        }
        insert_pos = random.randint(0, len(shares))
        shares.insert(insert_pos, user_entry)

    return {
        "id": chit_id,
        "owner_id": actual_owner,
        "title": _random_string(15),
        "shares": shares,
    }


# ── Property 6: Hide declined filtering correctness ─────────────────────

class TestProperty6HideDeclinedFilteringCorrectness(unittest.TestCase):
    """Feature: chit-invitation-rsvp, Property 6: Hide declined filtering correctness

    **Validates: Requirements 5.2, 7.2**

    For any set of chits and a user with hide_declined enabled, the filtered
    output SHALL contain zero chits where that user's rsvp_status is "declined".
    All non-declined chits SHALL still be present.
    """

    # ── Core property: no declined chits remain after filtering ──────────

    def test_no_declined_chits_remain_after_filter(self):
        """When hide_declined is enabled, zero chits with declined status for the current user remain."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                current_user_id = _random_uuid()
                other_owner = _random_uuid()

                # Generate a random set of chits with various RSVP statuses
                chit_count = random.randint(0, 15)
                chits_list = []
                for _ in range(chit_count):
                    chit = _random_chit(
                        owner_id=other_owner,
                        current_user_id=current_user_id,
                    )
                    chits_list.append(chit)

                # Apply hide-declined filter
                filtered = _apply_hide_declined_filter(
                    chits_list, current_user_id, hide_declined_enabled=True,
                )

                # Assert: zero declined chits remain
                for chit in filtered:
                    self.assertFalse(
                        _is_declined_by_current_user(chit, current_user_id),
                        f"Declined chit '{chit['id']}' should have been filtered "
                        f"out (iter {i}): shares={chit['shares']!r}"
                    )

    # ── Core property: all non-declined chits are preserved ──────────────

    def test_all_non_declined_chits_preserved(self):
        """When hide_declined is enabled, all non-declined chits remain in the output."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                current_user_id = _random_uuid()
                other_owner = _random_uuid()

                # Generate random chits
                chit_count = random.randint(0, 15)
                chits_list = []
                for _ in range(chit_count):
                    chit = _random_chit(
                        owner_id=other_owner,
                        current_user_id=current_user_id,
                    )
                    chits_list.append(chit)

                # Identify non-declined chits before filtering
                non_declined_ids = {
                    c["id"] for c in chits_list
                    if not _is_declined_by_current_user(c, current_user_id)
                }

                # Apply hide-declined filter
                filtered = _apply_hide_declined_filter(
                    chits_list, current_user_id, hide_declined_enabled=True,
                )
                filtered_ids = {c["id"] for c in filtered}

                # All non-declined chits must still be present
                self.assertEqual(
                    non_declined_ids, filtered_ids,
                    f"Non-declined chits should be preserved (iter {i}). "
                    f"Missing: {non_declined_ids - filtered_ids}, "
                    f"Extra: {filtered_ids - non_declined_ids}"
                )

    # ── Edge case: all chits are declined ────────────────────────────────

    def test_all_declined_results_in_empty_list(self):
        """When every chit is declined by the current user, the filtered list is empty."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                current_user_id = _random_uuid()
                other_owner = _random_uuid()

                # Generate chits where the current user has declined all
                chit_count = random.randint(1, 10)
                chits_list = []
                for _ in range(chit_count):
                    chit = _random_chit(
                        owner_id=other_owner,
                        current_user_id=current_user_id,
                        force_rsvp_status="declined",
                        include_current_user=True,
                    )
                    chits_list.append(chit)

                filtered = _apply_hide_declined_filter(
                    chits_list, current_user_id, hide_declined_enabled=True,
                )

                self.assertEqual(
                    len(filtered), 0,
                    f"All-declined list should be empty after filter (iter {i}), "
                    f"got {len(filtered)} chits"
                )

    # ── Edge case: no chits are declined ─────────────────────────────────

    def test_none_declined_preserves_all(self):
        """When no chits are declined, the filtered list is identical to the input."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                current_user_id = _random_uuid()
                other_owner = _random_uuid()

                # Generate chits where the current user has accepted or is invited
                chit_count = random.randint(1, 10)
                chits_list = []
                for _ in range(chit_count):
                    status = random.choice(["invited", "accepted"])
                    chit = _random_chit(
                        owner_id=other_owner,
                        current_user_id=current_user_id,
                        force_rsvp_status=status,
                        include_current_user=True,
                    )
                    chits_list.append(chit)

                filtered = _apply_hide_declined_filter(
                    chits_list, current_user_id, hide_declined_enabled=True,
                )

                self.assertEqual(
                    len(filtered), len(chits_list),
                    f"No-declined list should preserve all chits (iter {i}). "
                    f"Expected {len(chits_list)}, got {len(filtered)}"
                )
                original_ids = [c["id"] for c in chits_list]
                filtered_ids = [c["id"] for c in filtered]
                self.assertEqual(original_ids, filtered_ids)

    # ── Edge case: mixed statuses ────────────────────────────────────────

    def test_mixed_statuses_filters_only_declined(self):
        """With a mix of invited, accepted, and declined, only declined are removed."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                current_user_id = _random_uuid()
                other_owner = _random_uuid()

                # Build a controlled mix: some invited, some accepted, some declined
                chits_list = []
                expected_kept = []
                for status in ["invited", "accepted", "declined"]:
                    count = random.randint(1, 5)
                    for _ in range(count):
                        chit = _random_chit(
                            owner_id=other_owner,
                            current_user_id=current_user_id,
                            force_rsvp_status=status,
                            include_current_user=True,
                        )
                        chits_list.append(chit)
                        if status != "declined":
                            expected_kept.append(chit["id"])

                # Shuffle to randomize order
                random.shuffle(chits_list)

                filtered = _apply_hide_declined_filter(
                    chits_list, current_user_id, hide_declined_enabled=True,
                )

                filtered_ids = {c["id"] for c in filtered}
                expected_ids = set(expected_kept)

                self.assertEqual(
                    filtered_ids, expected_ids,
                    f"Mixed filter should keep only non-declined (iter {i}). "
                    f"Missing: {expected_ids - filtered_ids}, "
                    f"Extra: {filtered_ids - expected_ids}"
                )

    # ── Edge case: empty shares (not shared) ─────────────────────────────

    def test_chits_with_empty_shares_preserved(self):
        """Chits with no shares (owned, not shared) are never filtered out."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                current_user_id = _random_uuid()

                # Generate chits owned by the current user with empty shares
                chit_count = random.randint(1, 10)
                chits_list = []
                for _ in range(chit_count):
                    chit = {
                        "id": _random_uuid(),
                        "owner_id": current_user_id,
                        "title": _random_string(10),
                        "shares": [],
                    }
                    chits_list.append(chit)

                filtered = _apply_hide_declined_filter(
                    chits_list, current_user_id, hide_declined_enabled=True,
                )

                self.assertEqual(
                    len(filtered), len(chits_list),
                    f"Owned chits with empty shares should all be preserved "
                    f"(iter {i}). Expected {len(chits_list)}, got {len(filtered)}"
                )

    # ── Edge case: owned chits are never filtered ────────────────────────

    def test_owned_chits_never_filtered(self):
        """Chits owned by the current user are never filtered, even if shares exist."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                current_user_id = _random_uuid()

                # Generate owned chits (some may have shares with other users)
                chit_count = random.randint(1, 10)
                chits_list = []
                for _ in range(chit_count):
                    chit = _random_chit(
                        owner_id=current_user_id,
                        current_user_id=current_user_id,
                        is_owned=True,
                    )
                    chits_list.append(chit)

                filtered = _apply_hide_declined_filter(
                    chits_list, current_user_id, hide_declined_enabled=True,
                )

                self.assertEqual(
                    len(filtered), len(chits_list),
                    f"Owned chits should never be filtered (iter {i}). "
                    f"Expected {len(chits_list)}, got {len(filtered)}"
                )

    # ── Filter disabled: nothing is filtered ─────────────────────────────

    def test_filter_disabled_preserves_all(self):
        """When hide_declined is disabled, all chits are preserved including declined ones."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                current_user_id = _random_uuid()
                other_owner = _random_uuid()

                # Generate chits with some declined
                chits_list = []
                for _ in range(random.randint(1, 10)):
                    chit = _random_chit(
                        owner_id=other_owner,
                        current_user_id=current_user_id,
                        force_rsvp_status="declined",
                        include_current_user=True,
                    )
                    chits_list.append(chit)

                # Filter is DISABLED
                filtered = _apply_hide_declined_filter(
                    chits_list, current_user_id, hide_declined_enabled=False,
                )

                self.assertEqual(
                    len(filtered), len(chits_list),
                    f"Disabled filter should preserve all chits (iter {i}). "
                    f"Expected {len(chits_list)}, got {len(filtered)}"
                )

    # ── User not in shares: chit is preserved ────────────────────────────

    def test_user_not_in_shares_chit_preserved(self):
        """Chits where the current user is not in the shares list are never filtered."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                current_user_id = _random_uuid()
                other_owner = _random_uuid()

                # Generate chits where the current user is NOT in shares
                chit_count = random.randint(1, 10)
                chits_list = []
                for _ in range(chit_count):
                    chit = _random_chit(
                        owner_id=other_owner,
                        current_user_id=current_user_id,
                        include_current_user=False,
                    )
                    chits_list.append(chit)

                filtered = _apply_hide_declined_filter(
                    chits_list, current_user_id, hide_declined_enabled=True,
                )

                self.assertEqual(
                    len(filtered), len(chits_list),
                    f"Chits without current user in shares should be preserved "
                    f"(iter {i}). Expected {len(chits_list)}, got {len(filtered)}"
                )


# ── Inlined hide_declined setting round-trip logic (from settings route) ─
# Pure-function mirrors of the save/load path for the hide_declined setting
# in src/backend/routes/settings.py and src/backend/models.py.


def _serialize_hide_declined(value):
    """Simulate saving the hide_declined setting to the database.

    Mirrors the save path in save_settings() in src/backend/routes/settings.py:
        "hide_declined": settings.hide_declined or "0"

    The Pydantic model defines: hide_declined: Optional[str] = "0"
    The route applies: settings.hide_declined or "0" (falsy → "0")

    Args:
        value: A boolean to convert to the stored string representation.

    Returns:
        The string that would be stored in SQLite ("0" or "1").
    """
    return "1" if value else "0"


def _deserialize_hide_declined(stored_value):
    """Simulate loading the hide_declined setting from the database.

    Mirrors the load path in get_settings() in src/backend/routes/settings.py.
    The hide_declined column is plain TEXT — no JSON parsing needed.
    The value is returned as-is from the database row dict.

    Args:
        stored_value: The string value from SQLite ("0" or "1").

    Returns:
        The string value as loaded (unchanged).
    """
    return stored_value


def _hide_declined_to_bool(stored_value):
    """Convert the stored hide_declined string back to a boolean.

    Mirrors the frontend interpretation in main-init.js:
        if (_hideDeclinedSetting === '1' && ...)

    Args:
        stored_value: The string value from the settings API ("0" or "1").

    Returns:
        True if "1", False otherwise.
    """
    return stored_value == "1"


# ── Property 7: Hide declined setting round-trip ─────────────────────────

class TestProperty7HideDeclinedSettingRoundTrip(unittest.TestCase):
    """Feature: chit-invitation-rsvp, Property 7: Hide declined setting round-trip

    **Validates: Requirements 5.5**

    For any boolean value of the hide_declined setting, saving it to the
    backend and loading it back SHALL produce the same value.

    The setting is stored as TEXT in SQLite: "0" = show declined (faded),
    "1" = hide them entirely. Default is "0".
    """

    # ── Core property: boolean → string → stored → loaded → boolean ──────

    def test_round_trip_preserves_boolean_value(self):
        """A random boolean, serialized to '0'/'1', saved, loaded, and converted back matches the original."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                # Generate a random boolean
                original_bool = random.choice([True, False])

                # Convert to storage string ("0" or "1")
                stored_string = _serialize_hide_declined(original_bool)

                # Verify the stored string is valid
                self.assertIn(
                    stored_string, ("0", "1"),
                    f"Stored string should be '0' or '1', got '{stored_string}' "
                    f"(iter {i}, original={original_bool})"
                )

                # Simulate load from database
                loaded_string = _deserialize_hide_declined(stored_string)

                # Verify loaded string matches stored string
                self.assertEqual(
                    loaded_string, stored_string,
                    f"Loaded string should match stored string: "
                    f"'{loaded_string}' != '{stored_string}' (iter {i})"
                )

                # Convert back to boolean
                result_bool = _hide_declined_to_bool(loaded_string)

                # Assert round-trip preserves the original boolean value
                self.assertEqual(
                    result_bool, original_bool,
                    f"Round-trip failed: {original_bool} → '{stored_string}' → "
                    f"'{loaded_string}' → {result_bool} (iter {i})"
                )

    # ── String representation consistency ────────────────────────────────

    def test_true_always_serializes_to_1(self):
        """True always serializes to '1'."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                stored = _serialize_hide_declined(True)
                self.assertEqual(
                    stored, "1",
                    f"True should serialize to '1', got '{stored}' (iter {i})"
                )

    def test_false_always_serializes_to_0(self):
        """False always serializes to '0'."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                stored = _serialize_hide_declined(False)
                self.assertEqual(
                    stored, "0",
                    f"False should serialize to '0', got '{stored}' (iter {i})"
                )

    # ── Default value ────────────────────────────────────────────────────

    def test_default_value_is_0(self):
        """The default hide_declined value is '0' (show declined, faded)."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                # The Pydantic model default is "0"
                default_value = "0"

                # Loading the default should produce False (don't hide)
                result = _hide_declined_to_bool(default_value)
                self.assertFalse(
                    result,
                    f"Default '0' should convert to False, got {result} (iter {i})"
                )

                # Round-trip the default: False → "0" → "0" → False
                stored = _serialize_hide_declined(False)
                self.assertEqual(stored, default_value)
                loaded = _deserialize_hide_declined(stored)
                self.assertEqual(loaded, default_value)
                final = _hide_declined_to_bool(loaded)
                self.assertFalse(final)

    # ── Repeated saves ───────────────────────────────────────────────────

    def test_repeated_saves_are_idempotent(self):
        """Saving the same value multiple times produces the same stored string each time."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                original_bool = random.choice([True, False])

                # Save multiple times
                num_saves = random.randint(2, 10)
                results = []
                for _ in range(num_saves):
                    stored = _serialize_hide_declined(original_bool)
                    loaded = _deserialize_hide_declined(stored)
                    results.append(loaded)

                # All results should be identical
                self.assertTrue(
                    all(r == results[0] for r in results),
                    f"Repeated saves should be idempotent: {results} "
                    f"(iter {i}, original={original_bool})"
                )

                # And the final value should match the original
                final_bool = _hide_declined_to_bool(results[-1])
                self.assertEqual(
                    final_bool, original_bool,
                    f"Final value after {num_saves} saves should match original: "
                    f"{original_bool} → {final_bool} (iter {i})"
                )

    # ── Conversion consistency ───────────────────────────────────────────

    def test_conversion_consistency_string_to_bool_to_string(self):
        """Converting '0'/'1' to bool and back to string is consistent."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                # Start with a random valid stored string
                original_string = random.choice(["0", "1"])

                # Convert to bool
                bool_value = _hide_declined_to_bool(original_string)

                # Convert back to string
                result_string = _serialize_hide_declined(bool_value)

                # Should match the original
                self.assertEqual(
                    result_string, original_string,
                    f"String→bool→string should be consistent: "
                    f"'{original_string}' → {bool_value} → '{result_string}' "
                    f"(iter {i})"
                )

    def test_bool_to_string_to_bool_consistency(self):
        """Converting bool to '0'/'1' and back to bool is consistent."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                # Start with a random boolean
                original_bool = random.choice([True, False])

                # Convert to string
                string_value = _serialize_hide_declined(original_bool)

                # Convert back to bool
                result_bool = _hide_declined_to_bool(string_value)

                # Should match the original
                self.assertEqual(
                    result_bool, original_bool,
                    f"Bool→string→bool should be consistent: "
                    f"{original_bool} → '{string_value}' → {result_bool} "
                    f"(iter {i})"
                )

    # ── Dict-based round-trip (simulating settings dict serialization) ───

    def test_settings_dict_round_trip(self):
        """Simulate the full settings dict save/load path for hide_declined."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                original_bool = random.choice([True, False])

                # Simulate building the settings dict (as save_settings does)
                settings_dict = {
                    "user_id": _random_uuid(),
                    "time_format": random.choice(["12", "24"]),
                    "hide_declined": _serialize_hide_declined(original_bool),
                }

                # Simulate saving to DB and loading back (the value is stored as-is)
                stored_value = settings_dict["hide_declined"]
                loaded_dict = {
                    "user_id": settings_dict["user_id"],
                    "time_format": settings_dict["time_format"],
                    "hide_declined": _deserialize_hide_declined(stored_value),
                }

                # Convert back to boolean
                result_bool = _hide_declined_to_bool(loaded_dict["hide_declined"])

                self.assertEqual(
                    result_bool, original_bool,
                    f"Settings dict round-trip failed: {original_bool} → "
                    f"'{stored_value}' → '{loaded_dict['hide_declined']}' → "
                    f"{result_bool} (iter {i})"
                )
