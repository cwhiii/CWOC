"""Property-based test for favorite toggle involution (Property 6).

**Validates: Requirements 3.9**

Uses Hypothesis to generate a contact, create it via POST, PATCH favorite
twice, and verify the favorite flag returns to its original state.
"""
import sys
import os
import tempfile
import sqlite3

# Allow importing from the backend directory
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from hypothesis import given, settings, assume
from hypothesis.strategies import (
    booleans,
    composite,
    none,
    one_of,
    text,
)

import main as backend_main
from main import app

from fastapi.testclient import TestClient


# ── Strategies ───────────────────────────────────────────────────────────────

_SAFE_VALUE_CHARS = text(
    alphabet="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .-_+@#/&()'",
    min_size=1,
    max_size=40,
)

_NAME_PART = one_of(none(), _SAFE_VALUE_CHARS)


@composite
def contact_strategy(draw):
    """Generate a minimal contact dict with a given_name and favorite flag."""
    given_name = draw(_SAFE_VALUE_CHARS)
    contact = {
        "given_name": given_name,
        "surname": draw(_NAME_PART),
        "middle_names": draw(_NAME_PART),
        "prefix": draw(_NAME_PART),
        "suffix": draw(_NAME_PART),
        "favorite": draw(booleans()),
    }
    return contact
