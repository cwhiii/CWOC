"""Property-based test for add mode contact import skips duplicates (Property 6).

**Validates: Requirements 6.5**

Uses Python stdlib only (random, string, uuid, sqlite3, unittest). Minimum 100 iterations.
Generates random existing and imported contacts with some matching display_name+given_name
pairs, replicates the import_userdata "add" mode contact dedup logic from backend/main.py,
and verifies:
  - Contacts whose (display_name, given_name) match an existing contact are skipped
  - Non-matching contacts are inserted with newly generated UUIDs
  - Existing contacts are not modified
  - Total count = existing + non-duplicates
"""

import json
import os
import random
import sqlite3
import string
import tempfile
import unittest
from uuid import uuid4


# ── Helpers ──────────────────────────────────────────────────────────────────

def serialize_json_field(data):
    if data is None:
        return None
    try:
        return json.dumps(data)
    except TypeError:
        return None


def _rand_str(min_len=1, max_len=30):
    length = random.randint(min_len, max_len)
    return "".join(random.choices(string.ascii_letters + string.digits + " ", k=length))


def _rand_hex_color():
    return "#" + "".join(random.choices("0123456789abcdef", k=6))


def _rand_iso_datetime():
    y = random.randint(2020, 2030)
    m = random.randint(1, 12)
    d = random.randint(1, 28)
    h, mi, s = random.randint(0, 23), random.randint(0, 59), random.randint(0, 59)
    return f"{y:04d}-{m:02d}-{d:02d}T{h:02d}:{mi:02d}:{s:02d}Z"


def _maybe(fn, prob=0.5):
    return fn() if random.random() < prob else None


def _rand_multi_value_entries():
    labels = ["Home", "Work", "Mobile", "Other"]
    return [
        {"label": random.choice(labels), "value": _rand_str(5, 25)}
        for _ in range(random.randint(0, 3))
    ]


_SENTINEL = object()  # distinguishes "not provided" from explicit None


def _generate_contact_dict(display_name=_SENTINEL, given_name=_SENTINEL):
    """Generate a random contact dict (as it would appear in an export envelope).

    If display_name or given_name are provided (including None), those exact
    values are used.  Only when the caller omits them are random values generated.
    """
    return {
        "id": str(uuid4()),
        "given_name": given_name if given_name is not _SENTINEL else _rand_str(2, 15),
        "surname": _maybe(lambda: _rand_str(2, 15), 0.6),
        "middle_names": _maybe(lambda: _rand_str(2, 15), 0.3),
        "prefix": _maybe(lambda: random.choice(["Mr", "Mrs", "Dr", "Ms"]), 0.2),
        "suffix": _maybe(lambda: random.choice(["Jr", "Sr", "III"]), 0.1),
        "nickname": _maybe(lambda: _rand_str(2, 10), 0.3),
        "display_name": display_name if display_name is not _SENTINEL else _maybe(lambda: _rand_str(5, 25), 0.7),
        "phones": _maybe(_rand_multi_value_entries, 0.5),
        "emails": _maybe(_rand_multi_value_entries, 0.5),
        "addresses": _maybe(_rand_multi_value_entries, 0.4),
        "call_signs": _maybe(_rand_multi_value_entries, 0.3),
        "x_handles": _maybe(_rand_multi_value_entries, 0.3),
        "websites": _maybe(_rand_multi_value_entries, 0.3),
        "has_signal": random.choice([True, False]),
        "signal_username": _maybe(lambda: _rand_str(3, 15), 0.3),
        "pgp_key": _maybe(lambda: _rand_str(20, 60), 0.2),
        "favorite": random.choice([True, False]),
        "color": _maybe(_rand_hex_color, 0.3),
        "organization": _maybe(lambda: _rand_str(3, 20), 0.3),
        "social_context": _maybe(lambda: _rand_str(5, 30), 0.2),
        "image_url": _maybe(lambda: "https://example.com/" + _rand_str(5, 15), 0.2),
        "notes": _maybe(lambda: _rand_str(10, 60), 0.3),
        "tags": _maybe(lambda: [_rand_str(2, 10) for _ in range(random.randint(0, 4))], 0.5),
        "created_datetime": _rand_iso_datetime(),
        "modified_datetime": _rand_iso_datetime(),
    }


CONTACT_COLUMNS = [
    "id", "given_name", "surname", "middle_names", "prefix", "suffix",
    "nickname", "display_name", "phones", "emails", "addresses",
    "call_signs", "x_handles", "websites", "has_signal", "signal_username",
    "pgp_key", "favorite", "color", "organization", "social_context",
    "image_url", "notes", "tags", "created_datetime", "modified_datetime",
]


def _create_test_db(db_path):
    """Create a fresh test database with contacts and instance_meta tables."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS contacts (
        id TEXT PRIMARY KEY,
        given_name TEXT NOT NULL,
        surname TEXT,
        middle_names TEXT,
        prefix TEXT,
        suffix TEXT,
        nickname TEXT,
        display_name TEXT,
        phones TEXT,
        emails TEXT,
        addresses TEXT,
        call_signs TEXT,
        x_handles TEXT,
        websites TEXT,
        has_signal BOOLEAN DEFAULT 0,
        signal_username TEXT,
        pgp_key TEXT,
        favorite BOOLEAN DEFAULT 0,
        color TEXT,
        organization TEXT,
        social_context TEXT,
        image_url TEXT,
        notes TEXT,
        tags TEXT,
        created_datetime TEXT,
        modified_datetime TEXT
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


def _insert_contact_raw(db_path, contact_dict):
    """Insert a contact dict into the DB, serializing JSON fields as the backend would."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    values = []
    for col in CONTACT_COLUMNS:
        val = contact_dict.get(col)
        if col in ("phones", "emails", "addresses", "call_signs", "x_handles", "websites", "tags"):
            val = serialize_json_field(val)
        elif col in ("has_signal", "favorite"):
            val = 1 if val else 0
        values.append(val)
    placeholders = ", ".join(["?"] * len(CONTACT_COLUMNS))
    col_names = ", ".join(CONTACT_COLUMNS)
    cursor.execute(f"INSERT INTO contacts ({col_names}) VALUES ({placeholders})", values)
    conn.commit()
    conn.close()


def _import_contacts_add_mode(db_path, imported_contacts):
    """Replicate the add-mode contact import logic from import_userdata in backend/main.py.

    Returns (contacts_added, contacts_skipped).
    """
    conn = sqlite3.connect(db_path)
    conn.execute("BEGIN")
    cursor = conn.cursor()

    # Load existing (display_name, given_name) pairs
    cursor.execute("SELECT display_name, given_name FROM contacts")
    existing_pairs = {(row[0], row[1]) for row in cursor.fetchall()}

    contacts_added = 0
    contacts_skipped = 0

    for c in imported_contacts:
        dn = c.get("display_name")
        gn = c.get("given_name")
        if (dn, gn) in existing_pairs:
            contacts_skipped += 1
            continue

        new_id = str(uuid4())
        conn.execute(
            """INSERT INTO contacts (
                id, given_name, surname, middle_names, prefix, suffix,
                nickname, display_name, phones, emails, addresses, call_signs,
                x_handles, websites, has_signal, signal_username, pgp_key, favorite,
                color, organization, social_context, image_url, notes, tags,
                created_datetime, modified_datetime
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                new_id,
                c.get("given_name"),
                c.get("surname"),
                c.get("middle_names"),
                c.get("prefix"),
                c.get("suffix"),
                c.get("nickname"),
                c.get("display_name"),
                serialize_json_field(c.get("phones")),
                serialize_json_field(c.get("emails")),
                serialize_json_field(c.get("addresses")),
                serialize_json_field(c.get("call_signs")),
                serialize_json_field(c.get("x_handles")),
                serialize_json_field(c.get("websites")),
                1 if c.get("has_signal") else 0,
                c.get("signal_username"),
                c.get("pgp_key"),
                1 if c.get("favorite") else 0,
                c.get("color"),
                c.get("organization"),
                c.get("social_context"),
                c.get("image_url"),
                c.get("notes"),
                serialize_json_field(c.get("tags")),
                c.get("created_datetime"),
                c.get("modified_datetime"),
            ),
        )
        contacts_added += 1

    conn.commit()
    conn.close()
    return contacts_added, contacts_skipped


# ── Test class ───────────────────────────────────────────────────────────────

class TestAddModeContactSkipsDuplicates(unittest.TestCase):
    """Property 6: Add mode contact import skips duplicates.

    For any set of existing contacts and any set of imported contacts, when
    imported via POST /api/import/userdata with mode "add", contacts whose
    display_name AND given_name both match an existing contact SHALL be
    skipped, and all non-matching contacts SHALL be inserted with newly
    generated UUIDs.

    **Validates: Requirements 6.5**
    """

    def test_add_mode_contact_skips_duplicates(self):
        """Property test: 100 iterations with random existing and imported contacts."""
        iterations = 100

        for i in range(iterations):
            with tempfile.TemporaryDirectory() as tmp_dir:
                db_path = os.path.join(tmp_dir, "test.db")
                _create_test_db(db_path)

                # Generate 1-5 existing contacts with unique (display_name, given_name) pairs
                num_existing = random.randint(1, 5)
                existing_contacts = []
                existing_pairs_so_far = set()
                for _ in range(num_existing):
                    while True:
                        c = _generate_contact_dict()
                        pair = (c["display_name"], c["given_name"])
                        if pair not in existing_pairs_so_far:
                            existing_pairs_so_far.add(pair)
                            break
                    _insert_contact_raw(db_path, c)
                    existing_contacts.append(c)

                # Snapshot existing rows before import
                conn = sqlite3.connect(db_path)
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                cursor.execute("SELECT * FROM contacts ORDER BY id")
                pre_import_rows = {row["id"]: dict(row) for row in cursor.fetchall()}
                conn.close()

                # Build imported contacts: mix of duplicates and unique
                imported_contacts = []
                expected_duplicates = []
                expected_unique = []

                # Add some duplicates (matching display_name + given_name of existing)
                num_dupes = random.randint(0, min(num_existing, 3))
                dupe_sources = random.sample(existing_contacts, num_dupes)
                for src in dupe_sources:
                    dup = _generate_contact_dict(
                        display_name=src["display_name"],
                        given_name=src["given_name"],
                    )
                    imported_contacts.append(dup)
                    expected_duplicates.append(dup)

                # Add some unique contacts (guaranteed unique display_name+given_name)
                existing_pairs = {(c["display_name"], c["given_name"]) for c in existing_contacts}
                num_unique = random.randint(1, 4)
                for _ in range(num_unique):
                    # Generate until we get a truly unique pair
                    while True:
                        c = _generate_contact_dict()
                        pair = (c["display_name"], c["given_name"])
                        if pair not in existing_pairs:
                            # Also ensure no collision with other unique imports
                            already_in_import = {
                                (ic["display_name"], ic["given_name"])
                                for ic in imported_contacts
                            }
                            if pair not in already_in_import:
                                break
                    imported_contacts.append(c)
                    expected_unique.append(c)

                # Shuffle to randomize order
                random.shuffle(imported_contacts)

                # Run the import
                added, skipped = _import_contacts_add_mode(db_path, imported_contacts)

                # ── Verify counts ────────────────────────────────────────
                self.assertEqual(
                    skipped, len(expected_duplicates),
                    f"Iteration {i}: expected {len(expected_duplicates)} skipped, got {skipped}",
                )
                self.assertEqual(
                    added, len(expected_unique),
                    f"Iteration {i}: expected {len(expected_unique)} added, got {added}",
                )

                # ── Verify total row count ───────────────────────────────
                conn = sqlite3.connect(db_path)
                cursor = conn.cursor()
                cursor.execute("SELECT COUNT(*) FROM contacts")
                total = cursor.fetchone()[0]
                conn.close()

                expected_total = num_existing + len(expected_unique)
                self.assertEqual(
                    total, expected_total,
                    f"Iteration {i}: expected total {expected_total}, got {total}",
                )

                # ── Verify existing contacts were NOT modified ───────────
                conn = sqlite3.connect(db_path)
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                for orig_id, orig_row in pre_import_rows.items():
                    cursor.execute("SELECT * FROM contacts WHERE id = ?", (orig_id,))
                    row = cursor.fetchone()
                    self.assertIsNotNone(
                        row,
                        f"Iteration {i}: existing contact {orig_id} was deleted",
                    )
                    current = dict(row)
                    for col in CONTACT_COLUMNS:
                        self.assertEqual(
                            current[col], orig_row[col],
                            f"Iteration {i}: existing contact {orig_id}, "
                            f"field '{col}' was modified: {orig_row[col]!r} -> {current[col]!r}",
                        )

                # ── Verify unique contacts were inserted with new UUIDs ──
                cursor.execute("SELECT * FROM contacts")
                all_rows = {row["id"]: dict(row) for row in cursor.fetchall()}
                conn.close()

                new_ids = set(all_rows.keys()) - set(pre_import_rows.keys())
                self.assertEqual(
                    len(new_ids), len(expected_unique),
                    f"Iteration {i}: expected {len(expected_unique)} new rows, "
                    f"found {len(new_ids)}",
                )

                # Each new row should have a UUID different from the original import id
                for uid in expected_unique:
                    original_id = uid["id"]
                    self.assertNotIn(
                        original_id, all_rows,
                        f"Iteration {i}: imported contact should have a new UUID, "
                        f"but original id {original_id} was found in DB",
                    )

                # Verify the inserted contacts' field values match the import
                # (except id which is newly generated)
                for new_id in new_ids:
                    inserted = all_rows[new_id]
                    # Find the matching import by display_name + given_name
                    match = None
                    for u in expected_unique:
                        if (u["display_name"] == inserted.get("display_name") and
                                u["given_name"] == inserted.get("given_name")):
                            match = u
                            break
                    self.assertIsNotNone(
                        match,
                        f"Iteration {i}: inserted contact {new_id} doesn't match "
                        f"any expected unique import",
                    )
                    # Verify non-id scalar fields
                    for col in CONTACT_COLUMNS:
                        if col == "id":
                            continue
                        expected_val = match.get(col)
                        actual_val = inserted[col]
                        # JSON fields are stored serialized in DB
                        if col in ("phones", "emails", "addresses", "call_signs",
                                   "x_handles", "websites", "tags"):
                            expected_val = serialize_json_field(expected_val)
                        elif col in ("has_signal", "favorite"):
                            expected_val = 1 if expected_val else 0
                        self.assertEqual(
                            actual_val, expected_val,
                            f"Iteration {i}: new contact {new_id}, field '{col}': "
                            f"expected {expected_val!r}, got {actual_val!r}",
                        )


if __name__ == "__main__":
    unittest.main()
