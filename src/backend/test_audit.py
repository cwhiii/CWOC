"""
Property-based tests for audit diff helpers.

Feature: audit-log
Uses Python stdlib only (unittest + random) — no external libraries.
Each property test runs 100+ iterations with randomly generated inputs.

NOTE: We inline the minimal production logic (compute_audit_diff and its
dependencies) to avoid importing backend.main, which pulls in FastAPI.
"""

import json
import logging
import random
import string
import sys
import os
import unittest

# ── Inlined production logic (from src/backend/routes/audit.py) ──────────
# Kept in sync manually.  Only the pure-function helpers are copied here so
# the test file can run with *zero* third-party packages.

logger = logging.getLogger("test_audit")

def _deserialize_json_field(data):
    if data is None:
        return None
    try:
        return json.loads(data)
    except (json.JSONDecodeError, TypeError):
        return None

_JSON_SERIALIZED_FIELDS = {
    "tags", "checklist", "people", "child_chits", "alerts",
    "recurrence_rule", "recurrence_exceptions", "weather_data",
    "phones", "emails", "addresses", "call_signs", "x_handles",
    "websites", "default_filters", "custom_colors", "visual_indicators",
    "chit_options", "active_clocks", "saved_locations",
}

_AUDIT_EXCLUDE_FIELDS = {"modified_datetime", "created_datetime"}


def compute_audit_diff(old_dict, new_dict, exclude_fields=None):
    """Mirror of src.backend.routes.audit.compute_audit_diff — kept in sync manually."""
    if not isinstance(old_dict, dict) or not isinstance(new_dict, dict):
        logger.warning("compute_audit_diff called with non-dict input")
        return []

    if exclude_fields is None:
        exclude_fields = _AUDIT_EXCLUDE_FIELDS

    changes = []
    all_keys = set(old_dict.keys()) | set(new_dict.keys())

    for key in sorted(all_keys):
        if key in exclude_fields:
            continue

        old_val = old_dict.get(key)
        new_val = new_dict.get(key)

        if key in _JSON_SERIALIZED_FIELDS:
            if isinstance(old_val, str):
                old_val = _deserialize_json_field(old_val)
            if isinstance(new_val, str):
                new_val = _deserialize_json_field(new_val)

        if old_val != new_val:
            changes.append({"field": key, "old": old_val, "new": new_val})

    return changes


# ── Random data generators ───────────────────────────────────────────────

_ITERATIONS = 120  # comfortably above the 100 minimum


def _random_string(max_len=20):
    length = random.randint(0, max_len)
    return "".join(random.choices(string.ascii_letters + string.digits + " _-", k=length))


def _random_primitive():
    """Return a random JSON-safe primitive value."""
    kind = random.choice(["str", "int", "float", "bool", "none"])
    if kind == "str":
        return _random_string()
    elif kind == "int":
        return random.randint(-1000, 1000)
    elif kind == "float":
        return round(random.uniform(-1000, 1000), 4)
    elif kind == "bool":
        return random.choice([True, False])
    else:
        return None


def _random_value(depth=0):
    """Return a random JSON-safe value, including lists and dicts up to a depth limit."""
    if depth >= 2:
        return _random_primitive()
    kind = random.choice(["primitive", "primitive", "primitive", "list", "dict"])
    if kind == "list":
        length = random.randint(0, 4)
        return [_random_primitive() for _ in range(length)]
    elif kind == "dict":
        length = random.randint(0, 3)
        return {_random_string(8): _random_primitive() for _ in range(length)}
    else:
        return _random_primitive()


def _random_dict(min_keys=0, max_keys=10):
    """Generate a random dictionary with varied value types."""
    avoid = _AUDIT_EXCLUDE_FIELDS | _JSON_SERIALIZED_FIELDS
    num_keys = random.randint(min_keys, max_keys)
    d = {}
    while len(d) < num_keys:
        k = _random_string(12)
        if k and k not in avoid:
            d[k] = _random_value()
    return d


# ── Property 1: Identical dictionaries produce empty diff ────────────────

class TestProperty1IdenticalDictsEmptyDiff(unittest.TestCase):
    """Feature: audit-log, Property 1: Identical dictionaries produce empty diff"""

    def test_identical_dicts_produce_empty_diff(self):
        for i in range(_ITERATIONS):
            with self.subTest(iteration=i):
                d = _random_dict(min_keys=1, max_keys=10)
                result = compute_audit_diff(d, d)
                self.assertEqual(result, [], f"Expected empty diff for identical dict, got {result!r}")


# ── Property 2: Differing dictionaries produce non-empty diff ────────────

class TestProperty2DifferingDictsNonEmptyDiff(unittest.TestCase):
    """Feature: audit-log, Property 2: Differing dictionaries produce non-empty diff"""

    def test_differing_dicts_produce_non_empty_diff(self):
        excluded = _AUDIT_EXCLUDE_FIELDS
        for i in range(_ITERATIONS):
            with self.subTest(iteration=i):
                base = _random_dict(min_keys=1, max_keys=8)
                non_excluded_keys = [k for k in base if k not in excluded]
                if non_excluded_keys:
                    target_key = random.choice(non_excluded_keys)
                else:
                    target_key = "diff_field_" + _random_string(6)
                modified = dict(base)
                old_val = modified.get(target_key)
                new_val = old_val
                attempts = 0
                while new_val == old_val and attempts < 20:
                    new_val = _random_value()
                    attempts += 1
                if new_val == old_val:
                    new_val = "FORCED_DIFFERENT_VALUE"
                modified[target_key] = new_val
                result = compute_audit_diff(base, modified)
                self.assertTrue(len(result) > 0)
                changed_fields = {entry["field"] for entry in result}
                actually_different = set()
                all_keys = set(base.keys()) | set(modified.keys())
                for k in all_keys:
                    if k not in excluded and base.get(k) != modified.get(k):
                        actually_different.add(k)
                self.assertTrue(changed_fields & actually_different)


# ── Property 3: Diff excludes bookkeeping fields ────────────────────────

class TestProperty3DiffExcludesBookkeepingFields(unittest.TestCase):
    """Feature: audit-log, Property 3: Diff excludes bookkeeping fields"""

    def test_diff_excludes_bookkeeping_fields(self):
        bookkeeping = {"modified_datetime", "created_datetime"}
        for i in range(_ITERATIONS):
            with self.subTest(iteration=i):
                old_dict = _random_dict(min_keys=0, max_keys=6)
                new_dict = dict(old_dict)
                old_dict["modified_datetime"] = "2025-01-01T00:00:00"
                new_dict["modified_datetime"] = "2025-06-15T12:30:00"
                old_dict["created_datetime"] = "2024-01-01T00:00:00"
                new_dict["created_datetime"] = "2024-12-31T23:59:59"
                if random.random() < 0.5:
                    extra_key = "extra_" + _random_string(5)
                    new_dict[extra_key] = _random_value()
                result = compute_audit_diff(old_dict, new_dict)
                returned_fields = {entry["field"] for entry in result}
                self.assertTrue(returned_fields.isdisjoint(bookkeeping))


# ── Property 4: Changes JSON round-trip ──────────────────────────────────

class TestProperty4ChangesJsonRoundTrip(unittest.TestCase):
    """Feature: audit-log, Property 4: Changes JSON round-trip"""

    def test_changes_json_round_trip(self):
        for i in range(_ITERATIONS):
            with self.subTest(iteration=i):
                num_changes = random.randint(0, 8)
                changes = []
                for _ in range(num_changes):
                    entry = {
                        "field": _random_string(15),
                        "old": _random_value(),
                        "new": _random_value(),
                    }
                    changes.append(entry)
                serialized = json.dumps(changes)
                deserialized = json.loads(serialized)
                self.assertEqual(deserialized, changes)


if __name__ == "__main__":
    unittest.main()
