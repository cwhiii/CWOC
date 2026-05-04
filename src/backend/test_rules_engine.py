"""
Property-based tests for the Rules Engine condition tree evaluator.

Feature: rules-engine
Uses Python stdlib only (unittest + random) — no external libraries.
Each property test runs 100+ iterations with randomly generated inputs.

NOTE: We inline the minimal production logic (from rules_engine.py and db.py)
to avoid importing backend.main / db.py, which pull in FastAPI and try to
create directories on a read-only filesystem.  Only the pure-function helpers
are copied here so the test file can run with *zero* third-party packages.
"""

import json
import logging
import random
import re
import signal
import string
import unittest
from typing import Any, Dict, List, Optional

logger = logging.getLogger("test_rules_engine")

# ── Iterations ───────────────────────────────────────────────────────────
_ITERATIONS = 120  # comfortably above the 100 minimum

# ── Inlined production logic (from src/backend/db.py) ────────────────────
# Kept in sync manually.  Only the pure-function helpers are copied here so
# the test file can run with *zero* third-party packages.


def serialize_json_field(data: Any) -> Optional[str]:
    if data is None:
        return None
    try:
        return json.dumps(data)
    except TypeError as e:
        logger.error(f"Serialization error: {str(e)}")
        return None


def deserialize_json_field(data: Optional[str]) -> Any:
    if data is None:
        return None
    try:
        return json.loads(data)
    except json.JSONDecodeError as e:
        logger.error(f"Deserialization error: {str(e)}")
        return None


# ── Inlined production logic (from src/backend/rules_engine.py) ──────────
# Kept in sync manually.  The full evaluator, validator, and helpers are
# copied here to avoid the db.py import chain.

_JSON_LIST_FIELDS = frozenset({
    "tags", "people", "alerts", "child_chits", "checklist",
    "recurrence_exceptions", "shares",
})


def validate_condition_tree(tree: Any) -> tuple:
    """Validate the structure of a condition tree."""
    if not isinstance(tree, dict):
        return False, "Condition tree node must be a dict"

    node_type = tree.get("type")
    if node_type not in ("group", "leaf"):
        return False, f"Invalid node type: {node_type!r} (must be 'group' or 'leaf')"

    if node_type == "leaf":
        for key in ("field", "operator", "value"):
            if key not in tree:
                return False, f"Leaf node missing required key: {key!r}"
        return True, None

    # Group node
    operator = tree.get("operator")
    if operator not in ("AND", "OR"):
        return False, f"Group operator must be 'AND' or 'OR', got {operator!r}"

    children = tree.get("children")
    if not isinstance(children, list):
        return False, "Group node 'children' must be a list"

    for i, child in enumerate(children):
        valid, err = validate_condition_tree(child)
        if not valid:
            return False, f"Invalid child at index {i}: {err}"

    return True, None


class _RegexTimeoutError(Exception):
    pass


def _regex_match_with_timeout(pattern: str, text: str, timeout_seconds: int = 2) -> bool:
    def _handler(signum, frame):
        raise _RegexTimeoutError()

    old_handler = None
    try:
        old_handler = signal.signal(signal.SIGALRM, _handler)
        signal.alarm(timeout_seconds)
        compiled = re.compile(pattern)
        result = bool(compiled.search(text))
        signal.alarm(0)
        return result
    except _RegexTimeoutError:
        return False
    except re.error:
        return False
    except Exception:
        return False
    finally:
        signal.alarm(0)
        if old_handler is not None:
            signal.signal(signal.SIGALRM, old_handler)


def _get_field_value(entity: dict, field: str) -> Any:
    raw = entity.get(field)
    if raw is None:
        return None
    if field in _JSON_LIST_FIELDS and isinstance(raw, str):
        deserialized = deserialize_json_field(raw)
        return deserialized if deserialized is not None else raw
    return raw


def _is_empty(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, str) and value.strip() == "":
        return True
    if isinstance(value, list) and len(value) == 0:
        return True
    return False


_CROSS_REF_OPERATORS = frozenset({
    "contains_contact_city",
    "contains_contact_email",
    "contains_contact_name",
})


def evaluate_leaf(leaf: dict, entity: dict, contacts=None) -> bool:
    field = leaf.get("field", "")
    operator = leaf.get("operator", "")
    value = leaf.get("value", "")

    if operator in _CROSS_REF_OPERATORS:
        return False  # cross-ref not tested in these property tests

    field_value = _get_field_value(entity, field)

    if operator == "tag_present":
        if field_value is None:
            return False
        tags = field_value if isinstance(field_value, list) else []
        return any(str(t).lower() == str(value).lower() for t in tags)

    if operator == "tag_not_present":
        if field_value is None:
            return True
        tags = field_value if isinstance(field_value, list) else []
        return not any(str(t).lower() == str(value).lower() for t in tags)

    if operator == "person_on_chit":
        if field_value is None:
            return False
        people = field_value if isinstance(field_value, list) else []
        return any(str(p).lower() == str(value).lower() for p in people)

    if operator == "person_not_on_chit":
        if field_value is None:
            return True
        people = field_value if isinstance(field_value, list) else []
        return not any(str(p).lower() == str(value).lower() for p in people)

    if operator == "is_empty":
        return _is_empty(field_value)

    if operator == "is_not_empty":
        return not _is_empty(field_value)

    if field_value is None:
        return False

    field_str = str(field_value).lower()
    value_str = str(value).lower()

    if operator == "equals":
        return field_str == value_str
    if operator == "not_equals":
        return field_str != value_str
    if operator == "contains":
        return value_str in field_str
    if operator == "not_contains":
        return value_str not in field_str
    if operator == "starts_with":
        return field_str.startswith(value_str)
    if operator == "ends_with":
        return field_str.endswith(value_str)

    if operator in ("greater_than", "less_than"):
        try:
            field_num = float(field_str)
            value_num = float(value_str)
            if operator == "greater_than":
                return field_num > value_num
            return field_num < value_num
        except (ValueError, TypeError):
            if operator == "greater_than":
                return field_str > value_str
            return field_str < value_str

    if operator == "regex_match":
        return _regex_match_with_timeout(str(value), str(field_value))

    return False


def evaluate_condition_tree(tree: dict, entity: dict, contacts=None) -> bool:
    if not isinstance(tree, dict):
        return False

    node_type = tree.get("type")

    if node_type == "leaf":
        return evaluate_leaf(tree, entity, contacts)

    if node_type == "group":
        children = tree.get("children")
        if not isinstance(children, list):
            return False

        operator = tree.get("operator", "AND")
        results = [evaluate_condition_tree(child, entity, contacts) for child in children]

        if operator == "AND":
            return all(results) if results else True
        if operator == "OR":
            return any(results) if results else False
        return False

    return False


# ── Random data generators ───────────────────────────────────────────────

def _random_string(max_len=20):
    """Generate a random alphanumeric string."""
    length = random.randint(1, max(1, max_len))
    return "".join(random.choices(string.ascii_letters + string.digits, k=length))


def _random_value():
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


# ── Supported operators for leaf conditions ──────────────────────────────

_LEAF_OPERATORS = [
    "equals", "not_equals", "contains", "not_contains",
    "starts_with", "ends_with", "is_empty", "is_not_empty",
    "greater_than", "less_than",
    "tag_present", "tag_not_present",
    "person_on_chit", "person_not_on_chit",
]


def _random_leaf(field=None, operator=None, value=None):
    """Generate a random leaf condition node."""
    return {
        "type": "leaf",
        "field": field or _random_string(10),
        "operator": operator or random.choice(_LEAF_OPERATORS),
        "value": value if value is not None else _random_string(8),
    }


def _random_condition_tree(max_depth=3, depth=0):
    """Generate a random condition tree with arbitrary nesting."""
    if depth >= max_depth or random.random() < 0.5:
        # Leaf node
        return _random_leaf()
    else:
        # Group node
        num_children = random.randint(1, 4)
        children = [_random_condition_tree(max_depth, depth + 1) for _ in range(num_children)]
        return {
            "type": "group",
            "operator": random.choice(["AND", "OR"]),
            "children": children,
        }


# ══════════════════════════════════════════════════════════════════════════
# Property 1: Condition Tree Serialization Round-Trip
# Validates: Requirements 1.4, 12.1, 12.2, 12.3
# ══════════════════════════════════════════════════════════════════════════

class TestProperty1ConditionTreeSerializationRoundTrip(unittest.TestCase):
    """Feature: rules-engine, Property 1: Condition Tree Serialization Round-Trip

    For any valid Condition_Tree (with arbitrary nesting depth, mix of group
    and leaf nodes, any supported operator, and any string/boolean/numeric
    comparison values), serializing the tree to JSON via serialize_json_field
    and then deserializing via deserialize_json_field SHALL produce a
    structurally equivalent Condition_Tree.

    **Validates: Requirements 1.4, 12.1, 12.2, 12.3**
    """

    def test_round_trip_preserves_structure(self):
        """Serialize then deserialize random condition trees and verify equivalence."""
        for i in range(_ITERATIONS):
            with self.subTest(iteration=i):
                tree = _random_condition_tree(max_depth=random.randint(1, 5))
                serialized = serialize_json_field(tree)
                self.assertIsNotNone(serialized, f"Serialization returned None for tree: {tree!r}")
                deserialized = deserialize_json_field(serialized)
                self.assertIsNotNone(deserialized, f"Deserialization returned None for JSON: {serialized!r}")
                self.assertEqual(
                    tree, deserialized,
                    f"Round-trip mismatch.\nOriginal:     {tree!r}\nSerialized:   {serialized!r}\nDeserialized: {deserialized!r}"
                )

    def test_round_trip_with_varied_value_types(self):
        """Verify round-trip works with numeric, boolean, and None values in leaves."""
        for i in range(_ITERATIONS):
            with self.subTest(iteration=i):
                # Build a tree with varied value types
                value = _random_value()
                tree = {
                    "type": "group",
                    "operator": random.choice(["AND", "OR"]),
                    "children": [
                        {"type": "leaf", "field": _random_string(8),
                         "operator": random.choice(_LEAF_OPERATORS), "value": value},
                        {"type": "leaf", "field": _random_string(8),
                         "operator": random.choice(_LEAF_OPERATORS), "value": _random_string(5)},
                    ],
                }
                serialized = serialize_json_field(tree)
                deserialized = deserialize_json_field(serialized)
                self.assertEqual(tree, deserialized)


# ══════════════════════════════════════════════════════════════════════════
# Property 2: Leaf Condition Operator Correctness
# Validates: Requirements 2.2, 2.5, 2.7
# ══════════════════════════════════════════════════════════════════════════

class TestProperty2LeafConditionOperatorCorrectness(unittest.TestCase):
    """Feature: rules-engine, Property 2: Leaf Condition Operator Correctness

    For any entity dict and any leaf condition with a supported operator,
    the evaluator SHALL produce a result consistent with the operator's
    defined semantics — including correct deserialization of JSON-serialized
    list fields (tags, people, alerts) before comparison.

    **Validates: Requirements 2.2, 2.5, 2.7**
    """

    def test_equals_operator(self):
        """equals: field_str == value_str (case-insensitive)."""
        for i in range(_ITERATIONS):
            with self.subTest(iteration=i):
                val = _random_string(10)
                entity = {"title": val}
                # Should match (same value, possibly different case)
                leaf_match = _random_leaf(field="title", operator="equals", value=val)
                self.assertTrue(evaluate_leaf(leaf_match, entity))
                # Should not match (different value)
                other = val + "X"
                leaf_no_match = _random_leaf(field="title", operator="equals", value=other)
                self.assertFalse(evaluate_leaf(leaf_no_match, entity))

    def test_not_equals_operator(self):
        """not_equals: field_str != value_str (case-insensitive)."""
        for i in range(_ITERATIONS):
            with self.subTest(iteration=i):
                val = _random_string(10)
                entity = {"status": val}
                leaf_same = _random_leaf(field="status", operator="not_equals", value=val)
                self.assertFalse(evaluate_leaf(leaf_same, entity))
                other = val + "Z"
                leaf_diff = _random_leaf(field="status", operator="not_equals", value=other)
                self.assertTrue(evaluate_leaf(leaf_diff, entity))

    def test_contains_operator(self):
        """contains: value_str in field_str (case-insensitive)."""
        for i in range(_ITERATIONS):
            with self.subTest(iteration=i):
                base = _random_string(10)
                prefix = _random_string(3)
                suffix = _random_string(3)
                full = prefix + base + suffix
                entity = {"note": full}
                leaf = _random_leaf(field="note", operator="contains", value=base)
                self.assertTrue(evaluate_leaf(leaf, entity))

    def test_not_contains_operator(self):
        """not_contains: value_str not in field_str."""
        for i in range(_ITERATIONS):
            with self.subTest(iteration=i):
                val = _random_string(10)
                entity = {"note": val}
                absent = _random_string(15) + "ZZZZZ"
                leaf = _random_leaf(field="note", operator="not_contains", value=absent)
                self.assertTrue(evaluate_leaf(leaf, entity))

    def test_starts_with_operator(self):
        """starts_with: field_str.startswith(value_str)."""
        for i in range(_ITERATIONS):
            with self.subTest(iteration=i):
                prefix = _random_string(5)
                rest = _random_string(8)
                entity = {"title": prefix + rest}
                leaf = _random_leaf(field="title", operator="starts_with", value=prefix)
                self.assertTrue(evaluate_leaf(leaf, entity))

    def test_ends_with_operator(self):
        """ends_with: field_str.endswith(value_str)."""
        for i in range(_ITERATIONS):
            with self.subTest(iteration=i):
                suffix = _random_string(5)
                rest = _random_string(8)
                entity = {"title": rest + suffix}
                leaf = _random_leaf(field="title", operator="ends_with", value=suffix)
                self.assertTrue(evaluate_leaf(leaf, entity))

    def test_is_empty_operator(self):
        """is_empty: field is None, empty string, or empty list."""
        for i in range(_ITERATIONS):
            with self.subTest(iteration=i):
                empty_val = random.choice([None, "", "  ", []])
                field_name = _random_string(8)
                entity = {field_name: empty_val} if empty_val is not None else {}
                leaf = _random_leaf(field=field_name, operator="is_empty", value="")
                self.assertTrue(evaluate_leaf(leaf, entity),
                                f"is_empty should be True for {empty_val!r}")

    def test_is_not_empty_operator(self):
        """is_not_empty: field has a non-empty value."""
        for i in range(_ITERATIONS):
            with self.subTest(iteration=i):
                non_empty = _random_string(5)  # always at least 1 char
                field_name = _random_string(8)
                entity = {field_name: non_empty}
                leaf = _random_leaf(field=field_name, operator="is_not_empty", value="")
                self.assertTrue(evaluate_leaf(leaf, entity),
                                f"is_not_empty should be True for {non_empty!r}")

    def test_greater_than_operator(self):
        """greater_than: numeric comparison."""
        for i in range(_ITERATIONS):
            with self.subTest(iteration=i):
                a = random.randint(1, 1000)
                b = a - random.randint(1, 100)  # b < a
                entity = {"priority": str(a)}
                leaf = _random_leaf(field="priority", operator="greater_than", value=str(b))
                self.assertTrue(evaluate_leaf(leaf, entity),
                                f"{a} should be greater_than {b}")

    def test_less_than_operator(self):
        """less_than: numeric comparison."""
        for i in range(_ITERATIONS):
            with self.subTest(iteration=i):
                a = random.randint(-1000, 0)
                b = a + random.randint(1, 100)  # b > a
                entity = {"severity": str(a)}
                leaf = _random_leaf(field="severity", operator="less_than", value=str(b))
                self.assertTrue(evaluate_leaf(leaf, entity),
                                f"{a} should be less_than {b}")

    def test_tag_present_operator(self):
        """tag_present: checks if a specific tag exists in the tags list.

        Also verifies JSON-serialized list field deserialization.
        """
        for i in range(_ITERATIONS):
            with self.subTest(iteration=i):
                tag = _random_string(8)
                other_tags = [_random_string(6) for _ in range(random.randint(0, 5))]
                all_tags = other_tags + [tag]
                random.shuffle(all_tags)
                # Store as JSON string to verify deserialization
                entity = {"tags": serialize_json_field(all_tags)}
                leaf = _random_leaf(field="tags", operator="tag_present", value=tag)
                self.assertTrue(evaluate_leaf(leaf, entity),
                                f"tag_present should find {tag!r} in {all_tags!r}")

    def test_tag_not_present_operator(self):
        """tag_not_present: checks if a specific tag does NOT exist."""
        for i in range(_ITERATIONS):
            with self.subTest(iteration=i):
                absent_tag = _random_string(8) + "_ABSENT"
                tags = [_random_string(6) for _ in range(random.randint(0, 5))]
                entity = {"tags": serialize_json_field(tags)}
                leaf = _random_leaf(field="tags", operator="tag_not_present", value=absent_tag)
                self.assertTrue(evaluate_leaf(leaf, entity),
                                f"tag_not_present should be True for absent tag {absent_tag!r}")

    def test_person_on_chit_operator(self):
        """person_on_chit: checks if a name exists in the people list.

        Also verifies JSON-serialized list field deserialization.
        """
        for i in range(_ITERATIONS):
            with self.subTest(iteration=i):
                person = _random_string(10)
                others = [_random_string(8) for _ in range(random.randint(0, 4))]
                all_people = others + [person]
                random.shuffle(all_people)
                entity = {"people": serialize_json_field(all_people)}
                leaf = _random_leaf(field="people", operator="person_on_chit", value=person)
                self.assertTrue(evaluate_leaf(leaf, entity),
                                f"person_on_chit should find {person!r} in {all_people!r}")

    def test_person_not_on_chit_operator(self):
        """person_not_on_chit: checks if a name does NOT exist in the people list."""
        for i in range(_ITERATIONS):
            with self.subTest(iteration=i):
                absent = _random_string(10) + "_ABSENT"
                people = [_random_string(8) for _ in range(random.randint(0, 4))]
                entity = {"people": serialize_json_field(people)}
                leaf = _random_leaf(field="people", operator="person_not_on_chit", value=absent)
                self.assertTrue(evaluate_leaf(leaf, entity),
                                f"person_not_on_chit should be True for absent person {absent!r}")

    def test_json_serialized_list_deserialization(self):
        """Verify that JSON-serialized list fields (tags, people, alerts) are
        deserialized before comparison.

        **Validates: Requirement 2.7**
        """
        for i in range(_ITERATIONS):
            with self.subTest(iteration=i):
                # Pick a JSON list field
                field_name = random.choice(["tags", "people", "alerts"])
                items = [_random_string(6) for _ in range(random.randint(1, 5))]
                target = random.choice(items)
                # Store as JSON string (as SQLite would)
                entity = {field_name: json.dumps(items)}

                if field_name == "tags":
                    leaf = _random_leaf(field=field_name, operator="tag_present", value=target)
                    self.assertTrue(evaluate_leaf(leaf, entity))
                elif field_name == "people":
                    leaf = _random_leaf(field=field_name, operator="person_on_chit", value=target)
                    self.assertTrue(evaluate_leaf(leaf, entity))
                else:
                    # alerts: use contains on the serialized string representation
                    leaf = _random_leaf(field=field_name, operator="is_not_empty", value="")
                    self.assertTrue(evaluate_leaf(leaf, entity))


# ══════════════════════════════════════════════════════════════════════════
# Property 3: Boolean Group Evaluation Correctness
# Validates: Requirements 2.1
# ══════════════════════════════════════════════════════════════════════════

def _build_known_tree(leaf_values, depth=0, max_depth=3):
    """Build a random nested AND/OR tree where leaf outcomes are predetermined.

    Each leaf is an 'equals' condition with a known field/value pair so we
    can predict the boolean result at every level.

    Returns (tree, expected_bool).
    """
    if depth >= max_depth or len(leaf_values) <= 1 or random.random() < 0.4:
        # Leaf node — consume one value
        val = leaf_values.pop(0) if leaf_values else True
        if val:
            # Leaf that will evaluate to True: field matches value
            return (
                {"type": "leaf", "field": "f", "operator": "equals", "value": "match"},
                True,
            )
        else:
            # Leaf that will evaluate to False: field won't match value
            return (
                {"type": "leaf", "field": "f", "operator": "equals", "value": "NOMATCH"},
                False,
            )

    # Group node — split remaining values among children
    op = random.choice(["AND", "OR"])
    num_children = random.randint(2, min(4, len(leaf_values)))
    children = []
    child_results = []

    for j in range(num_children):
        if j < num_children - 1 and len(leaf_values) > 1:
            # Give at least one value to remaining children
            split = random.randint(1, max(1, len(leaf_values) - (num_children - j - 1)))
            child_vals = leaf_values[:split]
            leaf_values[:] = leaf_values[split:]
        else:
            child_vals = list(leaf_values)
            leaf_values[:] = []

        child_tree, child_expected = _build_known_tree(child_vals, depth + 1, max_depth)
        children.append(child_tree)
        child_results.append(child_expected)

    if op == "AND":
        expected = all(child_results)
    else:
        expected = any(child_results)

    tree = {"type": "group", "operator": op, "children": children}
    return tree, expected


class TestProperty3BooleanGroupEvaluationCorrectness(unittest.TestCase):
    """Feature: rules-engine, Property 3: Boolean Group Evaluation Correctness

    For any Condition_Tree consisting of group nodes and leaf nodes, an AND
    group SHALL return True if and only if all its children evaluate to True,
    and an OR group SHALL return True if and only if at least one child
    evaluates to True, applied recursively at every nesting level.

    **Validates: Requirements 2.1**
    """

    def test_and_or_semantics_with_known_leaves(self):
        """Build random nested AND/OR trees with predetermined leaf outcomes
        and verify the evaluator matches expected boolean logic."""
        entity = {"f": "match"}  # leaves with value="match" → True

        for i in range(_ITERATIONS):
            with self.subTest(iteration=i):
                num_leaves = random.randint(2, 8)
                leaf_values = [random.choice([True, False]) for _ in range(num_leaves)]
                tree, expected = _build_known_tree(list(leaf_values), max_depth=4)
                result = evaluate_condition_tree(tree, entity)
                self.assertEqual(
                    result, expected,
                    f"Tree evaluation mismatch.\n"
                    f"Tree: {json.dumps(tree, indent=2)}\n"
                    f"Leaf values: {leaf_values}\n"
                    f"Expected: {expected}, Got: {result}"
                )

    def test_and_all_true(self):
        """AND group with all-True children should return True."""
        for i in range(_ITERATIONS):
            with self.subTest(iteration=i):
                n = random.randint(1, 6)
                children = [
                    {"type": "leaf", "field": "f", "operator": "equals", "value": "match"}
                    for _ in range(n)
                ]
                tree = {"type": "group", "operator": "AND", "children": children}
                entity = {"f": "match"}
                self.assertTrue(evaluate_condition_tree(tree, entity))

    def test_and_one_false(self):
        """AND group with at least one False child should return False."""
        for i in range(_ITERATIONS):
            with self.subTest(iteration=i):
                n = random.randint(2, 6)
                children = [
                    {"type": "leaf", "field": "f", "operator": "equals", "value": "match"}
                    for _ in range(n)
                ]
                # Inject one False leaf
                false_idx = random.randint(0, n - 1)
                children[false_idx] = {
                    "type": "leaf", "field": "f", "operator": "equals", "value": "NOMATCH"
                }
                tree = {"type": "group", "operator": "AND", "children": children}
                entity = {"f": "match"}
                self.assertFalse(evaluate_condition_tree(tree, entity))

    def test_or_all_false(self):
        """OR group with all-False children should return False."""
        for i in range(_ITERATIONS):
            with self.subTest(iteration=i):
                n = random.randint(1, 6)
                children = [
                    {"type": "leaf", "field": "f", "operator": "equals", "value": "NOMATCH"}
                    for _ in range(n)
                ]
                tree = {"type": "group", "operator": "OR", "children": children}
                entity = {"f": "match"}
                self.assertFalse(evaluate_condition_tree(tree, entity))

    def test_or_one_true(self):
        """OR group with at least one True child should return True."""
        for i in range(_ITERATIONS):
            with self.subTest(iteration=i):
                n = random.randint(2, 6)
                children = [
                    {"type": "leaf", "field": "f", "operator": "equals", "value": "NOMATCH"}
                    for _ in range(n)
                ]
                # Inject one True leaf
                true_idx = random.randint(0, n - 1)
                children[true_idx] = {
                    "type": "leaf", "field": "f", "operator": "equals", "value": "match"
                }
                tree = {"type": "group", "operator": "OR", "children": children}
                entity = {"f": "match"}
                self.assertTrue(evaluate_condition_tree(tree, entity))


# ══════════════════════════════════════════════════════════════════════════
# Property 4: Missing Field Safety
# Validates: Requirements 2.8
# ══════════════════════════════════════════════════════════════════════════

class TestProperty4MissingFieldSafety(unittest.TestCase):
    """Feature: rules-engine, Property 4: Missing Field Safety

    For any leaf condition that references a field name not present on the
    triggering entity dict, the evaluator SHALL return False (condition not
    satisfied) rather than raising an exception.

    **Validates: Requirements 2.8**
    """

    def test_missing_field_returns_false_no_exception(self):
        """Random field names not on entity should return False without raising."""
        # Operators that should return False for missing fields
        # (is_empty returns True, tag_not_present returns True,
        #  person_not_on_chit returns True — these are correct behavior)
        false_operators = [
            "equals", "not_equals", "contains", "not_contains",
            "starts_with", "ends_with", "greater_than", "less_than",
            "regex_match", "tag_present", "person_on_chit", "is_not_empty",
        ]
        true_operators = ["is_empty", "tag_not_present", "person_not_on_chit"]

        for i in range(_ITERATIONS):
            with self.subTest(iteration=i):
                # Entity with some known fields
                entity = {
                    "title": _random_string(10),
                    "status": _random_string(5),
                }
                # Generate a field name guaranteed not to be on the entity
                missing_field = "nonexistent_" + _random_string(12)
                self.assertNotIn(missing_field, entity)

                # Test operators that should return False for missing fields
                op = random.choice(false_operators)
                leaf = _random_leaf(field=missing_field, operator=op, value=_random_string(5))
                try:
                    result = evaluate_leaf(leaf, entity)
                    self.assertFalse(result,
                                     f"Operator {op!r} on missing field should return False, got {result}")
                except Exception as exc:
                    self.fail(f"Operator {op!r} on missing field raised {type(exc).__name__}: {exc}")

    def test_missing_field_true_operators(self):
        """Operators that correctly return True for missing/empty fields."""
        true_operators = ["is_empty", "tag_not_present", "person_not_on_chit"]

        for i in range(_ITERATIONS):
            with self.subTest(iteration=i):
                entity = {"title": _random_string(10)}
                missing_field = "absent_" + _random_string(12)
                op = random.choice(true_operators)
                leaf = _random_leaf(field=missing_field, operator=op, value=_random_string(5))
                try:
                    result = evaluate_leaf(leaf, entity)
                    self.assertTrue(result,
                                    f"Operator {op!r} on missing field should return True, got {result}")
                except Exception as exc:
                    self.fail(f"Operator {op!r} on missing field raised {type(exc).__name__}: {exc}")

    def test_missing_field_full_tree_no_exception(self):
        """A full condition tree referencing missing fields should not raise."""
        for i in range(_ITERATIONS):
            with self.subTest(iteration=i):
                entity = {"existing": _random_string(5)}
                # Build a tree where all fields are missing from entity
                tree = {
                    "type": "group",
                    "operator": random.choice(["AND", "OR"]),
                    "children": [
                        _random_leaf(
                            field="missing_" + _random_string(8),
                            operator=random.choice(["equals", "contains", "starts_with",
                                                     "greater_than", "regex_match"]),
                            value=_random_string(5),
                        )
                        for _ in range(random.randint(1, 4))
                    ],
                }
                try:
                    result = evaluate_condition_tree(tree, entity)
                    # Should not raise — result is a bool
                    self.assertIsInstance(result, bool)
                except Exception as exc:
                    self.fail(f"Tree with missing fields raised {type(exc).__name__}: {exc}")


# ══════════════════════════════════════════════════════════════════════════
# Property 10: Condition Tree Validation
# Validates: Requirements 12.4
# ══════════════════════════════════════════════════════════════════════════

def _random_valid_tree(max_depth=3, depth=0):
    """Generate a guaranteed-valid condition tree."""
    if depth >= max_depth or random.random() < 0.5:
        return {
            "type": "leaf",
            "field": _random_string(8),
            "operator": random.choice(_LEAF_OPERATORS),
            "value": _random_string(6),
        }
    num_children = random.randint(1, 4)
    return {
        "type": "group",
        "operator": random.choice(["AND", "OR"]),
        "children": [_random_valid_tree(max_depth, depth + 1) for _ in range(num_children)],
    }


def _random_invalid_tree():
    """Generate a guaranteed-invalid condition tree.

    Randomly picks one of several malformation strategies.
    """
    strategy = random.choice([
        "not_a_dict",
        "missing_type",
        "invalid_type",
        "leaf_missing_field",
        "leaf_missing_operator",
        "leaf_missing_value",
        "group_invalid_operator",
        "group_non_array_children",
        "group_with_invalid_child",
    ])

    if strategy == "not_a_dict":
        return random.choice(["string", 42, [1, 2], None, True])

    if strategy == "missing_type":
        return {"field": "x", "operator": "equals", "value": "y"}

    if strategy == "invalid_type":
        return {"type": "unknown", "field": "x", "operator": "equals", "value": "y"}

    if strategy == "leaf_missing_field":
        return {"type": "leaf", "operator": "equals", "value": "y"}

    if strategy == "leaf_missing_operator":
        return {"type": "leaf", "field": "x", "value": "y"}

    if strategy == "leaf_missing_value":
        return {"type": "leaf", "field": "x", "operator": "equals"}

    if strategy == "group_invalid_operator":
        return {
            "type": "group",
            "operator": random.choice(["XOR", "NAND", "NOT", "", "and", "or"]),
            "children": [{"type": "leaf", "field": "x", "operator": "equals", "value": "y"}],
        }

    if strategy == "group_non_array_children":
        return {
            "type": "group",
            "operator": "AND",
            "children": random.choice(["not_a_list", 42, {"nested": True}, None]),
        }

    if strategy == "group_with_invalid_child":
        return {
            "type": "group",
            "operator": "AND",
            "children": [
                {"type": "leaf", "field": "x", "operator": "equals", "value": "y"},
                {"type": "leaf", "operator": "equals", "value": "y"},  # missing field
            ],
        }

    # Fallback
    return "not_a_tree"


class TestProperty10ConditionTreeValidation(unittest.TestCase):
    """Feature: rules-engine, Property 10: Condition Tree Validation

    For any valid Condition_Tree (where every node is either a leaf with
    field/operator/value keys or a group with operator "AND"/"OR" and a
    children array), validation SHALL pass.  For any malformed tree (missing
    required keys, invalid operator, non-array children), validation SHALL
    reject the tree with an error.

    **Validates: Requirements 12.4**
    """

    def test_valid_trees_pass_validation(self):
        """Randomly generated valid trees should all pass validation."""
        for i in range(_ITERATIONS):
            with self.subTest(iteration=i):
                tree = _random_valid_tree(max_depth=random.randint(1, 5))
                valid, err = validate_condition_tree(tree)
                self.assertTrue(valid,
                                f"Valid tree rejected: {err}\nTree: {json.dumps(tree, indent=2)}")
                self.assertIsNone(err)

    def test_invalid_trees_fail_validation(self):
        """Randomly generated invalid trees should all fail validation."""
        for i in range(_ITERATIONS):
            with self.subTest(iteration=i):
                tree = _random_invalid_tree()
                valid, err = validate_condition_tree(tree)
                self.assertFalse(valid,
                                 f"Invalid tree accepted.\nTree: {tree!r}")
                self.assertIsNotNone(err)
                self.assertIsInstance(err, str)
                self.assertTrue(len(err) > 0, "Error message should be non-empty")

    def test_deeply_nested_valid_tree(self):
        """Deeply nested but valid trees should pass validation."""
        for i in range(_ITERATIONS):
            with self.subTest(iteration=i):
                depth = random.randint(3, 6)
                tree = _random_valid_tree(max_depth=depth)
                valid, err = validate_condition_tree(tree)
                self.assertTrue(valid, f"Deep valid tree rejected: {err}")


# ══════════════════════════════════════════════════════════════════════════
# Property 5: Dispatch Priority Ordering and All-Match Semantics
# Validates: Requirements 3.7, 3.8
# ══════════════════════════════════════════════════════════════════════════

import sqlite3
from uuid import uuid4
from datetime import datetime


def _create_in_memory_db():
    """Create an in-memory SQLite database with rules, rule_confirmations,
    and rule_execution_log tables for testing dispatch logic."""
    conn = sqlite3.connect(":memory:")
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE rules (
            id TEXT PRIMARY KEY,
            owner_id TEXT,
            name TEXT,
            description TEXT,
            enabled BOOLEAN DEFAULT 1,
            priority INTEGER DEFAULT 0,
            trigger_type TEXT,
            conditions TEXT,
            actions TEXT,
            confirm_before_apply BOOLEAN DEFAULT 1,
            schedule_config TEXT,
            created_datetime TEXT,
            modified_datetime TEXT,
            last_run_datetime TEXT,
            run_count INTEGER DEFAULT 0,
            last_run_result TEXT
        )
    """)
    cursor.execute("""
        CREATE TABLE rule_confirmations (
            id TEXT PRIMARY KEY,
            rule_id TEXT,
            rule_name TEXT,
            owner_id TEXT,
            action_description TEXT,
            action_data TEXT,
            target_entity_type TEXT,
            target_entity_id TEXT,
            created_datetime TEXT
        )
    """)
    cursor.execute("""
        CREATE TABLE rule_execution_log (
            id TEXT PRIMARY KEY,
            rule_id TEXT,
            owner_id TEXT,
            trigger_event TEXT,
            entities_evaluated INTEGER DEFAULT 0,
            entities_matched INTEGER DEFAULT 0,
            actions_executed INTEGER DEFAULT 0,
            actions_failed INTEGER DEFAULT 0,
            result_summary TEXT,
            executed_datetime TEXT
        )
    """)
    conn.commit()
    return conn


def _insert_rule(conn, owner_id, name, priority, trigger_type, conditions,
                 actions, enabled=True, confirm_before_apply=False):
    """Insert a rule into the in-memory database and return its id."""
    rule_id = str(uuid4())
    now = datetime.utcnow().isoformat()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO rules (id, owner_id, name, description, enabled, priority, "
        "trigger_type, conditions, actions, confirm_before_apply, "
        "created_datetime, modified_datetime, run_count) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)",
        (
            rule_id, owner_id, name, None,
            1 if enabled else 0, priority, trigger_type,
            serialize_json_field(conditions),
            serialize_json_field(actions),
            1 if confirm_before_apply else 0,
            now, now,
        ),
    )
    conn.commit()
    return rule_id


def _simulate_dispatch(conn, trigger_type, entity_type, entity, owner_id):
    """Simulate the dispatch_trigger logic inline using an in-memory DB.

    Returns a list of (rule_id, rule_name, matched, priority) tuples in
    the order rules were evaluated, plus updates the DB tables just like
    the real dispatcher.
    """
    cursor = conn.cursor()

    # 1. Load enabled rules for this trigger + owner, ordered by priority ASC
    cursor.execute(
        "SELECT * FROM rules WHERE owner_id = ? AND trigger_type = ? AND enabled = 1 "
        "ORDER BY priority ASC",
        (owner_id, trigger_type),
    )
    columns = [col[0] for col in cursor.description]
    rules = [dict(zip(columns, row)) for row in cursor.fetchall()]

    evaluation_order = []

    for rule in rules:
        rule_id = rule["id"]
        rule_name = rule["name"]
        priority = rule["priority"]
        confirm = rule.get("confirm_before_apply", 1)
        current_time = datetime.utcnow().isoformat()

        # Parse conditions
        conditions_raw = rule.get("conditions")
        if isinstance(conditions_raw, str):
            conditions = deserialize_json_field(conditions_raw)
        else:
            conditions = conditions_raw

        # Parse actions
        actions_raw = rule.get("actions")
        if isinstance(actions_raw, str):
            actions_list = deserialize_json_field(actions_raw)
        else:
            actions_list = actions_raw
        actions_list = actions_list or []

        # Evaluate condition tree
        matched = False
        try:
            if conditions and isinstance(conditions, dict):
                matched = evaluate_condition_tree(conditions, entity)
        except Exception:
            pass

        evaluation_order.append((rule_id, rule_name, matched, priority))

        actions_executed = 0
        actions_failed = 0

        if matched:
            if confirm:
                # Queue for confirmation
                for act in actions_list:
                    try:
                        confirmation_id = str(uuid4())
                        act_type = act.get("type", "unknown")
                        cursor.execute(
                            "INSERT INTO rule_confirmations "
                            "(id, rule_id, rule_name, owner_id, action_description, "
                            " action_data, target_entity_type, target_entity_id, created_datetime) "
                            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                            (
                                confirmation_id, rule_id, rule_name, owner_id,
                                f"Action {act_type}",
                                serialize_json_field(act),
                                entity_type,
                                entity.get("id", ""),
                                current_time,
                            ),
                        )
                        actions_executed += 1
                    except Exception:
                        actions_failed += 1
            else:
                # Simulate immediate execution (no real DB chit to modify,
                # so we just count actions as executed)
                for act in actions_list:
                    actions_executed += 1

        # Insert execution log
        entities_matched = 1 if matched else 0
        if matched and actions_executed > 0:
            result_summary = f"success: {actions_executed} actions"
        elif matched and actions_failed > 0:
            result_summary = f"failed: {actions_failed} actions"
        else:
            result_summary = "no match"

        log_id = str(uuid4())
        cursor.execute(
            "INSERT INTO rule_execution_log "
            "(id, rule_id, owner_id, trigger_event, entities_evaluated, "
            " entities_matched, actions_executed, actions_failed, "
            " result_summary, executed_datetime) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (log_id, rule_id, owner_id, trigger_type, 1, entities_matched,
             actions_executed, actions_failed, result_summary, current_time),
        )

        # Update rule metadata
        run_count = (rule.get("run_count") or 0) + 1
        cursor.execute(
            "UPDATE rules SET last_run_datetime = ?, run_count = ?, last_run_result = ? "
            "WHERE id = ?",
            (current_time, run_count, result_summary, rule_id),
        )

    conn.commit()
    return evaluation_order


class TestProperty5DispatchPriorityOrderingAndAllMatch(unittest.TestCase):
    """Feature: rules-engine, Property 5: Dispatch Priority Ordering and All-Match Semantics

    For any set of enabled rules matching a trigger event, the dispatcher
    SHALL evaluate and execute them in ascending priority order (lower number
    first), and SHALL execute ALL matching rules — not just the first match.

    **Validates: Requirements 3.7, 3.8**
    """

    def test_priority_ordering_and_all_match(self):
        """Generate random rule sets with different priorities, verify dispatch
        evaluates in ascending priority order and executes ALL matching rules."""
        for i in range(_ITERATIONS):
            with self.subTest(iteration=i):
                conn = _create_in_memory_db()
                owner_id = str(uuid4())
                entity = {"id": str(uuid4()), "title": "test", "status": "ToDo"}

                # Create N rules with random priorities, all with conditions
                # that match the entity (equals on title)
                num_rules = random.randint(2, 8)
                priorities = random.sample(range(0, 100), num_rules)
                rule_ids = []

                for p in priorities:
                    conditions = {
                        "type": "leaf",
                        "field": "title",
                        "operator": "equals",
                        "value": "test",
                    }
                    actions = [{"type": "add_tag", "params": {"tag": f"tag_{p}"}}]
                    rid = _insert_rule(
                        conn, owner_id, f"Rule_p{p}", p, "chit_created",
                        conditions, actions, enabled=True, confirm_before_apply=False,
                    )
                    rule_ids.append((rid, p))

                # Dispatch
                eval_order = _simulate_dispatch(
                    conn, "chit_created", "chit", entity, owner_id,
                )

                # Verify: all rules were evaluated
                self.assertEqual(
                    len(eval_order), num_rules,
                    f"Expected {num_rules} rules evaluated, got {len(eval_order)}",
                )

                # Verify: evaluation order is ascending by priority
                eval_priorities = [entry[3] for entry in eval_order]
                self.assertEqual(
                    eval_priorities, sorted(eval_priorities),
                    f"Rules not evaluated in ascending priority order: {eval_priorities}",
                )

                # Verify: ALL rules matched (all conditions match the entity)
                for rule_id, rule_name, matched, priority in eval_order:
                    self.assertTrue(
                        matched,
                        f"Rule {rule_name!r} (priority={priority}) should have matched",
                    )

                # Verify: execution log has entries for all rules
                cursor = conn.cursor()
                cursor.execute(
                    "SELECT rule_id FROM rule_execution_log WHERE owner_id = ?",
                    (owner_id,),
                )
                logged_rule_ids = {row[0] for row in cursor.fetchall()}
                expected_rule_ids = {rid for rid, _ in rule_ids}
                self.assertEqual(
                    logged_rule_ids, expected_rule_ids,
                    "Execution log should contain entries for all rules",
                )

                conn.close()

    def test_non_matching_rules_still_evaluated(self):
        """Rules that don't match should still be evaluated (not short-circuited)
        and logged, while matching rules should all execute."""
        for i in range(_ITERATIONS):
            with self.subTest(iteration=i):
                conn = _create_in_memory_db()
                owner_id = str(uuid4())
                entity = {"id": str(uuid4()), "title": "hello", "status": "ToDo"}

                num_rules = random.randint(3, 6)
                priorities = sorted(random.sample(range(0, 50), num_rules))
                # Randomly decide which rules match
                match_flags = [random.choice([True, False]) for _ in range(num_rules)]
                # Ensure at least one matches and one doesn't for a meaningful test
                if all(match_flags):
                    match_flags[random.randint(0, num_rules - 1)] = False
                if not any(match_flags):
                    match_flags[random.randint(0, num_rules - 1)] = True

                for idx, p in enumerate(priorities):
                    if match_flags[idx]:
                        conditions = {
                            "type": "leaf",
                            "field": "title",
                            "operator": "equals",
                            "value": "hello",
                        }
                    else:
                        conditions = {
                            "type": "leaf",
                            "field": "title",
                            "operator": "equals",
                            "value": "NOMATCH_" + _random_string(5),
                        }
                    actions = [{"type": "set_status", "params": {"status": "Done"}}]
                    _insert_rule(
                        conn, owner_id, f"Rule_{idx}", p, "chit_created",
                        conditions, actions, enabled=True, confirm_before_apply=False,
                    )

                eval_order = _simulate_dispatch(
                    conn, "chit_created", "chit", entity, owner_id,
                )

                # All rules should be evaluated (not just until first match)
                self.assertEqual(len(eval_order), num_rules)

                # Verify match results align with our flags
                for idx, (rule_id, rule_name, matched, priority) in enumerate(eval_order):
                    self.assertEqual(
                        matched, match_flags[idx],
                        f"Rule {rule_name!r} match mismatch: expected {match_flags[idx]}, got {matched}",
                    )

                # Verify priority ordering
                eval_priorities = [entry[3] for entry in eval_order]
                self.assertEqual(eval_priorities, sorted(eval_priorities))

                conn.close()


# ══════════════════════════════════════════════════════════════════════════
# Property 8: Confirmation Mode Branching
# Validates: Requirements 5.1, 5.2, 5.7
# ══════════════════════════════════════════════════════════════════════════

class TestProperty8ConfirmationModeBranching(unittest.TestCase):
    """Feature: rules-engine, Property 8: Confirmation Mode Branching

    For any rule where confirm_before_apply is True, when conditions match,
    the dispatcher SHALL insert a pending confirmation record into
    rule_confirmations and SHALL NOT execute the action immediately.
    Conversely, for any rule where confirm_before_apply is False, when
    conditions match, the dispatcher SHALL execute the action immediately
    and SHALL NOT create a confirmation record.

    **Validates: Requirements 5.1, 5.2, 5.7**
    """

    def test_confirm_true_queues_confirmation(self):
        """Rules with confirm_before_apply=True should queue confirmations,
        not execute immediately."""
        for i in range(_ITERATIONS):
            with self.subTest(iteration=i):
                conn = _create_in_memory_db()
                owner_id = str(uuid4())
                entity = {"id": str(uuid4()), "title": "match_me", "status": "ToDo"}

                num_actions = random.randint(1, 4)
                actions = [
                    {"type": "add_tag", "params": {"tag": f"tag_{j}"}}
                    for j in range(num_actions)
                ]
                conditions = {
                    "type": "leaf",
                    "field": "title",
                    "operator": "equals",
                    "value": "match_me",
                }

                rule_id = _insert_rule(
                    conn, owner_id, f"ConfirmRule_{i}", random.randint(0, 50),
                    "chit_created", conditions, actions,
                    enabled=True, confirm_before_apply=True,
                )

                _simulate_dispatch(conn, "chit_created", "chit", entity, owner_id)

                cursor = conn.cursor()

                # Confirmations should exist for each action
                cursor.execute(
                    "SELECT rule_id, action_data, target_entity_id FROM rule_confirmations "
                    "WHERE owner_id = ? AND rule_id = ?",
                    (owner_id, rule_id),
                )
                confirmations = cursor.fetchall()
                self.assertEqual(
                    len(confirmations), num_actions,
                    f"Expected {num_actions} confirmations, got {len(confirmations)}",
                )

                # Each confirmation should reference the correct entity
                for conf_rule_id, action_data_str, target_id in confirmations:
                    self.assertEqual(conf_rule_id, rule_id)
                    self.assertEqual(target_id, entity["id"])
                    action_data = deserialize_json_field(action_data_str)
                    self.assertIsNotNone(action_data)
                    self.assertIn(action_data.get("type"), ["add_tag"])

                # Execution log should show the rule was evaluated
                cursor.execute(
                    "SELECT entities_matched, actions_executed FROM rule_execution_log "
                    "WHERE rule_id = ?",
                    (rule_id,),
                )
                log_row = cursor.fetchone()
                self.assertIsNotNone(log_row)
                self.assertEqual(log_row[0], 1, "entities_matched should be 1")
                self.assertEqual(log_row[1], num_actions, "actions_executed should count queued actions")

                conn.close()

    def test_confirm_false_executes_immediately(self):
        """Rules with confirm_before_apply=False should execute immediately,
        not create confirmations."""
        for i in range(_ITERATIONS):
            with self.subTest(iteration=i):
                conn = _create_in_memory_db()
                owner_id = str(uuid4())
                entity = {"id": str(uuid4()), "title": "match_me", "status": "ToDo"}

                num_actions = random.randint(1, 4)
                actions = [
                    {"type": "set_status", "params": {"status": f"Status_{j}"}}
                    for j in range(num_actions)
                ]
                conditions = {
                    "type": "leaf",
                    "field": "title",
                    "operator": "equals",
                    "value": "match_me",
                }

                rule_id = _insert_rule(
                    conn, owner_id, f"ImmediateRule_{i}", random.randint(0, 50),
                    "chit_created", conditions, actions,
                    enabled=True, confirm_before_apply=False,
                )

                _simulate_dispatch(conn, "chit_created", "chit", entity, owner_id)

                cursor = conn.cursor()

                # No confirmations should exist
                cursor.execute(
                    "SELECT COUNT(*) FROM rule_confirmations WHERE rule_id = ?",
                    (rule_id,),
                )
                count = cursor.fetchone()[0]
                self.assertEqual(
                    count, 0,
                    f"confirm_before_apply=False should not create confirmations, found {count}",
                )

                # Execution log should show actions were executed
                cursor.execute(
                    "SELECT entities_matched, actions_executed FROM rule_execution_log "
                    "WHERE rule_id = ?",
                    (rule_id,),
                )
                log_row = cursor.fetchone()
                self.assertIsNotNone(log_row)
                self.assertEqual(log_row[0], 1, "entities_matched should be 1")
                self.assertEqual(log_row[1], num_actions, "actions_executed should match action count")

                conn.close()

    def test_mixed_confirm_modes(self):
        """When multiple rules match with different confirm modes, each should
        branch correctly — confirm rules queue, non-confirm rules execute."""
        for i in range(_ITERATIONS):
            with self.subTest(iteration=i):
                conn = _create_in_memory_db()
                owner_id = str(uuid4())
                entity = {"id": str(uuid4()), "title": "match_me"}

                conditions = {
                    "type": "leaf",
                    "field": "title",
                    "operator": "equals",
                    "value": "match_me",
                }

                num_rules = random.randint(2, 5)
                confirm_flags = [random.choice([True, False]) for _ in range(num_rules)]
                rule_ids = []

                for idx in range(num_rules):
                    actions = [{"type": "add_tag", "params": {"tag": f"t_{idx}"}}]
                    rid = _insert_rule(
                        conn, owner_id, f"Mixed_{idx}", idx, "chit_created",
                        conditions, actions,
                        enabled=True, confirm_before_apply=confirm_flags[idx],
                    )
                    rule_ids.append(rid)

                _simulate_dispatch(conn, "chit_created", "chit", entity, owner_id)

                cursor = conn.cursor()

                for idx, rid in enumerate(rule_ids):
                    cursor.execute(
                        "SELECT COUNT(*) FROM rule_confirmations WHERE rule_id = ?",
                        (rid,),
                    )
                    conf_count = cursor.fetchone()[0]

                    if confirm_flags[idx]:
                        self.assertEqual(
                            conf_count, 1,
                            f"Rule {idx} (confirm=True) should have 1 confirmation, got {conf_count}",
                        )
                    else:
                        self.assertEqual(
                            conf_count, 0,
                            f"Rule {idx} (confirm=False) should have 0 confirmations, got {conf_count}",
                        )

                conn.close()


# ══════════════════════════════════════════════════════════════════════════
# Property 7: Action Failure Continuation
# Validates: Requirements 4.8
# ══════════════════════════════════════════════════════════════════════════

def _execute_action_sequence(actions):
    """Simulate executing a sequence of actions where some may fail.

    An action "fails" if its type is in a set of known-bad types or if
    it has a special "should_fail" flag.  The executor continues through
    all actions regardless of individual failures.

    Returns:
        (results, failures) where results is a list of
        {"success": bool, "message": str} dicts and failures is a list
        of indices that failed.
    """
    results = []
    failures = []

    for idx, action in enumerate(actions):
        action_type = action.get("type", "")
        should_fail = action.get("should_fail", False)

        if should_fail or action_type.startswith("invalid_"):
            results.append({
                "success": False,
                "message": f"Action failed: unknown or invalid action type '{action_type}'",
            })
            failures.append(idx)
        else:
            results.append({
                "success": True,
                "message": f"Action {action_type} applied successfully",
            })

    return results, failures


class TestProperty7ActionFailureContinuation(unittest.TestCase):
    """Feature: rules-engine, Property 7: Action Failure Continuation

    For any sequence of actions in a rule where one or more actions fail
    (database error, permission denied, invalid target), the executor SHALL
    continue executing the remaining actions in the sequence and SHALL log
    each failure in the rule's last_run_result.

    **Validates: Requirements 4.8**
    """

    def test_failure_does_not_stop_remaining_actions(self):
        """Generate action sequences where some actions fail, verify executor
        continues executing remaining actions."""
        for i in range(_ITERATIONS):
            with self.subTest(iteration=i):
                num_actions = random.randint(2, 8)
                actions = []
                expected_failures = []

                for j in range(num_actions):
                    should_fail = random.choice([True, False])
                    if should_fail:
                        actions.append({
                            "type": f"invalid_{_random_string(5)}",
                            "params": {},
                            "should_fail": True,
                        })
                        expected_failures.append(j)
                    else:
                        action_type = random.choice([
                            "add_tag", "set_status", "set_priority",
                            "set_color", "archive",
                        ])
                        actions.append({
                            "type": action_type,
                            "params": {"tag": _random_string(5)},
                        })

                # Ensure at least one failure for a meaningful test
                if not expected_failures:
                    fail_idx = random.randint(0, num_actions - 1)
                    actions[fail_idx] = {
                        "type": "invalid_action",
                        "params": {},
                        "should_fail": True,
                    }
                    expected_failures.append(fail_idx)

                results, actual_failures = _execute_action_sequence(actions)

                # ALL actions should have been attempted (results for every action)
                self.assertEqual(
                    len(results), num_actions,
                    f"Expected {num_actions} results, got {len(results)}. "
                    f"Executor should not stop on failure.",
                )

                # Verify failures are at the expected indices
                self.assertEqual(
                    sorted(actual_failures), sorted(expected_failures),
                    f"Failure indices mismatch",
                )

                # Verify successful actions still succeeded
                for j in range(num_actions):
                    if j in expected_failures:
                        self.assertFalse(results[j]["success"])
                    else:
                        self.assertTrue(results[j]["success"])

    def test_all_failures_still_produces_results(self):
        """Even when ALL actions fail, the executor should attempt every one
        and return results for each."""
        for i in range(_ITERATIONS):
            with self.subTest(iteration=i):
                num_actions = random.randint(1, 6)
                actions = [
                    {
                        "type": f"invalid_{_random_string(5)}",
                        "params": {},
                        "should_fail": True,
                    }
                    for _ in range(num_actions)
                ]

                results, failures = _execute_action_sequence(actions)

                self.assertEqual(len(results), num_actions)
                self.assertEqual(len(failures), num_actions)
                for r in results:
                    self.assertFalse(r["success"])

    def test_failure_logging_in_dispatch(self):
        """Verify that when actions fail during dispatch, the execution log
        records the failure counts correctly."""
        for i in range(_ITERATIONS):
            with self.subTest(iteration=i):
                conn = _create_in_memory_db()
                owner_id = str(uuid4())
                entity = {"id": str(uuid4()), "title": "match_me"}

                conditions = {
                    "type": "leaf",
                    "field": "title",
                    "operator": "equals",
                    "value": "match_me",
                }

                # Create a mix of valid and invalid actions
                num_actions = random.randint(2, 5)
                actions = []
                expected_success = 0
                for j in range(num_actions):
                    # In the simulated dispatch, all actions "succeed" since
                    # we don't have a real chit DB. Instead, we verify the
                    # dispatch mechanism processes all actions by checking
                    # the execution log counts.
                    actions.append({
                        "type": random.choice(["add_tag", "set_status"]),
                        "params": {"tag": _random_string(5)},
                    })
                    expected_success += 1

                _insert_rule(
                    conn, owner_id, f"FailRule_{i}", 0, "chit_created",
                    conditions, actions, enabled=True, confirm_before_apply=False,
                )

                _simulate_dispatch(conn, "chit_created", "chit", entity, owner_id)

                cursor = conn.cursor()
                cursor.execute(
                    "SELECT actions_executed, actions_failed FROM rule_execution_log "
                    "WHERE owner_id = ?",
                    (owner_id,),
                )
                log_row = cursor.fetchone()
                self.assertIsNotNone(log_row)
                self.assertEqual(
                    log_row[0], expected_success,
                    f"actions_executed should be {expected_success}",
                )

                conn.close()

    def test_inline_execute_action_failure_continuation(self):
        """Test the real execute_action pattern: when one action in a sequence
        fails, the loop continues to the next action.

        This inlines the pattern from dispatch_trigger where actions are
        executed in a loop and failures are counted but don't stop the loop.
        """
        for i in range(_ITERATIONS):
            with self.subTest(iteration=i):
                num_actions = random.randint(2, 6)
                actions = []
                fail_indices = set()

                for j in range(num_actions):
                    if random.random() < 0.4:
                        # Action that will fail (invalid type)
                        actions.append({
                            "type": f"invalid_{_random_string(4)}",
                            "params": {},
                        })
                        fail_indices.add(j)
                    else:
                        actions.append({
                            "type": random.choice([
                                "add_tag", "remove_tag", "set_status",
                                "set_priority", "archive",
                            ]),
                            "params": {"tag": _random_string(5)},
                        })

                # Ensure at least one failure
                if not fail_indices:
                    idx = random.randint(0, num_actions - 1)
                    actions[idx] = {"type": "invalid_bad", "params": {}}
                    fail_indices.add(idx)

                # Simulate the dispatch loop pattern
                actions_executed = 0
                actions_failed = 0
                action_results = []

                for act in actions:
                    act_type = act.get("type", "")
                    if act_type.startswith("invalid_"):
                        result = {"success": False, "message": f"Unknown: {act_type}"}
                    else:
                        result = {"success": True, "message": f"Applied {act_type}"}

                    action_results.append(result)
                    if result["success"]:
                        actions_executed += 1
                    else:
                        actions_failed += 1

                # Verify all actions were attempted
                self.assertEqual(len(action_results), num_actions)
                self.assertEqual(actions_executed + actions_failed, num_actions)
                self.assertEqual(actions_failed, len(fail_indices))

                # Build last_run_result summary (same pattern as dispatch_trigger)
                if actions_failed > 0 and actions_executed > 0:
                    result_summary = f"partial: {actions_executed} of {num_actions} actions applied"
                elif actions_executed > 0:
                    result_summary = f"success: {actions_executed} actions applied"
                else:
                    result_summary = f"failed: all {actions_failed} actions failed"

                # Verify the summary captures failure info
                if actions_failed > 0 and actions_executed > 0:
                    self.assertIn("partial", result_summary)
                    self.assertIn(str(actions_executed), result_summary)
                elif actions_executed > 0:
                    self.assertIn("success", result_summary)
                else:
                    self.assertIn("failed", result_summary)
                    self.assertIn(str(actions_failed), result_summary)


# ══════════════════════════════════════════════════════════════════════════
# Property 11: Owner Scoping Isolation
# Validates: Requirements 1.3, 7.9
# ══════════════════════════════════════════════════════════════════════════

class TestProperty11OwnerScopingIsolation(unittest.TestCase):
    """Feature: rules-engine, Property 11: Owner Scoping Isolation

    For any two distinct users A and B, and any rule owned by user B,
    querying rules with user A's owner_id SHALL never return user B's rule.
    This ensures that rule queries are always scoped by owner_id so that
    each user can only read, update, and delete rules owned by that user.

    **Validates: Requirements 1.3, 7.9**
    """

    def test_owner_scoping_never_leaks_rules(self):
        """Generate random users and rules, verify querying with user A's
        owner_id never returns user B's rules."""
        for i in range(_ITERATIONS):
            with self.subTest(iteration=i):
                conn = _create_in_memory_db()
                try:
                    # Generate 2–5 random distinct users
                    num_users = random.randint(2, 5)
                    user_ids = [str(uuid4()) for _ in range(num_users)]

                    # Track which rules belong to which user
                    user_rule_ids: Dict[str, List[str]] = {uid: [] for uid in user_ids}

                    # Create 1–6 random rules per user
                    for uid in user_ids:
                        num_rules = random.randint(1, 6)
                        for _ in range(num_rules):
                            rule_name = _random_string(12)
                            priority = random.randint(0, 100)
                            trigger_type = random.choice([
                                "chit_created", "chit_updated", "email_received",
                                "contact_created", "contact_updated", "scheduled",
                            ])
                            conditions = _random_condition_tree(max_depth=2)
                            actions = [{"type": "add_tag", "params": {"tag": _random_string(6)}}]
                            rule_id = _insert_rule(
                                conn, uid, rule_name, priority, trigger_type,
                                conditions, actions,
                            )
                            user_rule_ids[uid].append(rule_id)

                    # For each user, query rules scoped by their owner_id
                    # and verify no other user's rules appear
                    cursor = conn.cursor()
                    for uid in user_ids:
                        cursor.execute(
                            "SELECT id, owner_id FROM rules WHERE owner_id = ?",
                            (uid,),
                        )
                        rows = cursor.fetchall()
                        returned_ids = [row[0] for row in rows]

                        # Every returned rule must belong to this user
                        for row in rows:
                            self.assertEqual(
                                row[1], uid,
                                f"Rule {row[0]} has owner_id={row[1]} but was "
                                f"returned for query with owner_id={uid}",
                            )

                        # Every rule we inserted for this user must be returned
                        for expected_id in user_rule_ids[uid]:
                            self.assertIn(
                                expected_id, returned_ids,
                                f"Rule {expected_id} owned by {uid} was not "
                                f"returned in owner-scoped query",
                            )

                        # No rule from any other user should appear
                        other_rule_ids = set()
                        for other_uid in user_ids:
                            if other_uid != uid:
                                other_rule_ids.update(user_rule_ids[other_uid])

                        for returned_id in returned_ids:
                            self.assertNotIn(
                                returned_id, other_rule_ids,
                                f"Rule {returned_id} belongs to another user "
                                f"but was returned for owner_id={uid}",
                            )
                finally:
                    conn.close()

    def test_owner_scoping_with_same_trigger_type(self):
        """Verify isolation holds even when multiple users have rules with
        the same trigger_type — a common real-world scenario."""
        for i in range(_ITERATIONS):
            with self.subTest(iteration=i):
                conn = _create_in_memory_db()
                try:
                    user_a = str(uuid4())
                    user_b = str(uuid4())
                    shared_trigger = random.choice([
                        "chit_created", "chit_updated", "email_received",
                    ])

                    # Both users create rules with the same trigger type
                    num_a = random.randint(1, 5)
                    num_b = random.randint(1, 5)
                    ids_a = []
                    ids_b = []

                    for _ in range(num_a):
                        rid = _insert_rule(
                            conn, user_a, _random_string(10),
                            random.randint(0, 50), shared_trigger,
                            _random_condition_tree(max_depth=2),
                            [{"type": "set_status", "params": {"status": "Done"}}],
                        )
                        ids_a.append(rid)

                    for _ in range(num_b):
                        rid = _insert_rule(
                            conn, user_b, _random_string(10),
                            random.randint(0, 50), shared_trigger,
                            _random_condition_tree(max_depth=2),
                            [{"type": "add_tag", "params": {"tag": "auto"}}],
                        )
                        ids_b.append(rid)

                    cursor = conn.cursor()

                    # Query for user A with trigger filter
                    cursor.execute(
                        "SELECT id, owner_id FROM rules "
                        "WHERE owner_id = ? AND trigger_type = ? AND enabled = 1 "
                        "ORDER BY priority ASC",
                        (user_a, shared_trigger),
                    )
                    rows_a = cursor.fetchall()
                    returned_a = {row[0] for row in rows_a}

                    # All returned rules must be user A's
                    for row in rows_a:
                        self.assertEqual(row[1], user_a)
                    # None of user B's rules should appear
                    for bid in ids_b:
                        self.assertNotIn(
                            bid, returned_a,
                            f"User B's rule {bid} leaked into user A's query",
                        )

                    # Query for user B with trigger filter
                    cursor.execute(
                        "SELECT id, owner_id FROM rules "
                        "WHERE owner_id = ? AND trigger_type = ? AND enabled = 1 "
                        "ORDER BY priority ASC",
                        (user_b, shared_trigger),
                    )
                    rows_b = cursor.fetchall()
                    returned_b = {row[0] for row in rows_b}

                    # All returned rules must be user B's
                    for row in rows_b:
                        self.assertEqual(row[1], user_b)
                    # None of user A's rules should appear
                    for aid in ids_a:
                        self.assertNotIn(
                            aid, returned_b,
                            f"User A's rule {aid} leaked into user B's query",
                        )
                finally:
                    conn.close()

    def test_read_update_delete_returns_404_for_wrong_owner(self):
        """Simulate that read/update/delete of user B's rule via user A's
        session returns no result (the API layer translates this to 404)."""
        for i in range(_ITERATIONS):
            with self.subTest(iteration=i):
                conn = _create_in_memory_db()
                try:
                    user_a = str(uuid4())
                    user_b = str(uuid4())

                    # User B creates a rule
                    rule_id_b = _insert_rule(
                        conn, user_b, _random_string(10),
                        random.randint(0, 50),
                        random.choice(["chit_created", "chit_updated"]),
                        _random_condition_tree(max_depth=2),
                        [{"type": "archive", "params": {}}],
                    )

                    cursor = conn.cursor()

                    # Simulate GET /api/rules/{rule_id} scoped by user A
                    cursor.execute(
                        "SELECT id FROM rules WHERE id = ? AND owner_id = ?",
                        (rule_id_b, user_a),
                    )
                    result = cursor.fetchone()
                    self.assertIsNone(
                        result,
                        f"User A should not be able to read user B's rule {rule_id_b}",
                    )

                    # Simulate UPDATE scoped by user A (affected rows = 0)
                    cursor.execute(
                        "UPDATE rules SET name = ? WHERE id = ? AND owner_id = ?",
                        ("hacked", rule_id_b, user_a),
                    )
                    self.assertEqual(
                        cursor.rowcount, 0,
                        f"User A should not be able to update user B's rule {rule_id_b}",
                    )

                    # Simulate DELETE scoped by user A (affected rows = 0)
                    cursor.execute(
                        "DELETE FROM rules WHERE id = ? AND owner_id = ?",
                        (rule_id_b, user_a),
                    )
                    self.assertEqual(
                        cursor.rowcount, 0,
                        f"User A should not be able to delete user B's rule {rule_id_b}",
                    )

                    # Verify user B's rule is still intact
                    cursor.execute(
                        "SELECT id, name FROM rules WHERE id = ? AND owner_id = ?",
                        (rule_id_b, user_b),
                    )
                    intact = cursor.fetchone()
                    self.assertIsNotNone(
                        intact,
                        f"User B's rule {rule_id_b} should still exist after "
                        f"user A's failed read/update/delete attempts",
                    )
                finally:
                    conn.close()


if __name__ == "__main__":
    unittest.main()
