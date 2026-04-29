"""Property-based test for vCard serialization round-trip (Property 3).

**Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5**

Uses Hypothesis to generate arbitrary Contact dicts with varied name parts,
multi-value fields with labels, Signal flag, and PGP key, then asserts that
vcard_print(vcard_parse(vcard_print(contact))) == vcard_print(contact).
"""
import sys
import os

# Allow importing from the backend directory
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from hypothesis import given, settings, assume
from hypothesis.strategies import (
    booleans,
    composite,
    just,
    lists,
    none,
    one_of,
    text,
)

from main import vcard_parse, vcard_print


# ── Strategies ───────────────────────────────────────────────────────────────

# Characters safe for vCard values: no line breaks, no semicolons (break ADR
# and N field parsing), no colons in labels (break property:value split).
_SAFE_VALUE_CHARS = text(
    alphabet="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .-_+@#/&()'",
    min_size=1,
    max_size=40,
)

_SAFE_LABEL_CHARS = text(
    alphabet="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_",
    min_size=1,
    max_size=15,
)

# Name part: either None or a safe non-empty string
_NAME_PART = one_of(none(), _SAFE_VALUE_CHARS)


@composite
def multi_value_entry(draw):
    """Generate a single MultiValueEntry dict with optional label and a value."""
    label = draw(one_of(none(), _SAFE_LABEL_CHARS))
    value = draw(_SAFE_VALUE_CHARS)
    return {"label": label, "value": value}


@composite
def multi_value_list(draw):
    """Generate either None or a non-empty list of MultiValueEntry dicts."""
    entries = draw(one_of(none(), lists(multi_value_entry(), min_size=1, max_size=3)))
    return entries


@composite
def pgp_key_strategy(draw):
    """Generate either None or a non-empty PGP key string."""
    return draw(one_of(none(), _SAFE_VALUE_CHARS))


@composite
def contact_strategy(draw):
    """Generate an arbitrary Contact dict suitable for vCard round-trip testing."""
    given_name = draw(_SAFE_VALUE_CHARS)

    contact = {
        "given_name": given_name,
        "surname": draw(_NAME_PART),
        "middle_names": draw(_NAME_PART),
        "prefix": draw(_NAME_PART),
        "suffix": draw(_NAME_PART),
        "phones": draw(multi_value_list()),
        "emails": draw(multi_value_list()),
        "addresses": draw(multi_value_list()),
        "call_signs": draw(multi_value_list()),
        "x_handles": draw(multi_value_list()),
        "websites": draw(multi_value_list()),
        "has_signal": draw(booleans()),
        "pgp_key": draw(pgp_key_strategy()),
        "favorite": draw(booleans()),
    }
    return contact


# ── Property Test ────────────────────────────────────────────────────────────

@given(contact=contact_strategy())
@settings(max_examples=200, deadline=None)
def test_vcard_round_trip_property(contact):
    """Property 3: vCard serialization round-trip.

    For any valid Contact object, formatting it with vcard_print, parsing the
    result with vcard_parse, and formatting again with vcard_print SHALL produce
    a vCard string equivalent to the first vcard_print output.

    **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5**
    """
    first_print = vcard_print(contact)
    parsed = vcard_parse(first_print)
    second_print = vcard_print(parsed)

    assert first_print == second_print, (
        f"vCard round-trip mismatch!\n"
        f"--- first vcard_print ---\n{first_print}\n"
        f"--- after parse + print ---\n{second_print}\n"
        f"--- original contact ---\n{contact}"
    )
