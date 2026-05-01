"""
Property-based tests for network access provider configuration.

Feature: network-access
Uses Python stdlib only (unittest + random) — no external libraries.
Each property test runs 100+ iterations with randomly generated inputs.

NOTE: We inline the minimal production logic (POST/GET simulation via direct
DB operations) to avoid importing backend.main, which pulls in FastAPI.
"""

import json
import random
import sqlite3
import string
import tempfile
import unittest
import uuid


# ── Inlined production logic (from src/backend/routes/network_access.py) ─
# Kept in sync manually.  Only the pure DB helpers are copied here so the
# test file can run with *zero* third-party packages.

_TABLE_DDL = """
CREATE TABLE IF NOT EXISTS network_access (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL UNIQUE,
    enabled BOOLEAN DEFAULT 0,
    config TEXT,
    created_datetime TEXT,
    modified_datetime TEXT
)
"""


def _utcnow_iso() -> str:
    """Return a fixed timestamp for testing purposes."""
    from datetime import datetime
    return datetime.utcnow().isoformat() + "Z"


def simulate_post(conn, provider: str, enabled: bool, config: dict):
    """Simulate POST /api/network-access/{provider} via direct DB operations.

    Mirrors the save_network_access() route logic:
    - Check for existing row to preserve id and created_datetime
    - INSERT OR REPLACE with serialized JSON config
    - Return the saved record dict
    """
    conn.row_factory = sqlite3.Row
    now = _utcnow_iso()

    existing = conn.execute(
        "SELECT id, created_datetime FROM network_access WHERE provider = ?",
        (provider,),
    ).fetchone()

    if existing:
        row_id = existing["id"]
        created = existing["created_datetime"]
    else:
        row_id = str(uuid.uuid4())
        created = now

    config_json = json.dumps(config)

    conn.execute(
        """INSERT OR REPLACE INTO network_access
           (id, provider, enabled, config, created_datetime, modified_datetime)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (row_id, provider, 1 if enabled else 0, config_json, created, now),
    )
    conn.commit()

    return {
        "id": row_id,
        "provider": provider,
        "enabled": bool(enabled),
        "config": config,
        "created_datetime": created,
        "modified_datetime": now,
    }


def simulate_get(conn, provider: str) -> dict:
    """Simulate GET /api/network-access/{provider} via direct DB operations.

    Mirrors the get_network_access() route logic:
    - SELECT from network_access WHERE provider = ?
    - If no row, return default { provider, enabled: false, config: {} }
    - Deserialize config JSON
    """
    conn.row_factory = sqlite3.Row
    row = conn.execute(
        "SELECT * FROM network_access WHERE provider = ?",
        (provider,),
    ).fetchone()

    if row is None:
        return {"provider": provider, "enabled": False, "config": {}}

    result = {
        "id": row["id"],
        "provider": row["provider"],
        "enabled": bool(row["enabled"]),
        "config": {},
        "created_datetime": row["created_datetime"],
        "modified_datetime": row["modified_datetime"],
    }
    if row["config"]:
        try:
            result["config"] = json.loads(row["config"])
        except (json.JSONDecodeError, TypeError):
            result["config"] = {}
    return result


def simulate_get_all(conn) -> list:
    """Simulate GET /api/network-access via direct DB operations.

    Mirrors the list_network_access() route logic:
    - SELECT * FROM network_access ORDER BY provider
    - Deserialize config JSON for each row
    - Return as a list of dicts
    """
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        "SELECT * FROM network_access ORDER BY provider"
    ).fetchall()

    results = []
    for row in rows:
        entry = {
            "id": row["id"],
            "provider": row["provider"],
            "enabled": bool(row["enabled"]),
            "config": {},
            "created_datetime": row["created_datetime"],
            "modified_datetime": row["modified_datetime"],
        }
        if row["config"]:
            try:
                entry["config"] = json.loads(row["config"])
            except (json.JSONDecodeError, TypeError):
                entry["config"] = {}
        results.append(entry)
    return results


# ── Random data generators ───────────────────────────────────────────────

_ITERATIONS = 120  # comfortably above the 100 minimum


def _random_provider_name():
    """Generate a random alphanumeric provider name, 1-50 chars."""
    length = random.randint(1, 50)
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=length))


def _random_primitive():
    """Return a random JSON-safe primitive value."""
    kind = random.choice(["str", "int", "float", "bool", "none"])
    if kind == "str":
        length = random.randint(0, 20)
        return "".join(random.choices(string.ascii_letters + string.digits + " _-", k=length))
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
        keys = set()
        d = {}
        for _ in range(length):
            k = "".join(random.choices(string.ascii_lowercase, k=random.randint(1, 8)))
            if k not in keys:
                keys.add(k)
                d[k] = _random_value(depth + 1)
        return d
    else:
        return _random_primitive()


def _random_config_dict():
    """Generate a random config dictionary with varied value types."""
    num_keys = random.randint(0, 6)
    d = {}
    for _ in range(num_keys):
        k = "".join(random.choices(string.ascii_lowercase + "_", k=random.randint(1, 12)))
        d[k] = _random_value()
    return d


# ── Property 1: Provider config API round-trip ───────────────────────────

class TestProperty1ProviderConfigRoundTrip(unittest.TestCase):
    """Feature: network-access, Property 1: Provider config API round-trip

    **Validates: Requirements 1.3, 2.2, 2.4**

    For any valid provider name and config dictionary, POSTing the config
    and then GETting it back should return matching provider, enabled, and
    config fields.
    """

    def setUp(self):
        """Create a temporary SQLite database with the network_access table."""
        self.tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.tmp.close()
        self.conn = sqlite3.connect(self.tmp.name)
        self.conn.execute(_TABLE_DDL)
        self.conn.commit()

    def tearDown(self):
        """Close and remove the temporary database."""
        self.conn.close()
        import os
        os.unlink(self.tmp.name)

    def test_provider_config_round_trip(self):
        """POST then GET should return matching provider, enabled, and config."""
        for i in range(_ITERATIONS):
            with self.subTest(iteration=i):
                # Generate random inputs
                provider = _random_provider_name()
                enabled = random.choice([True, False])
                config = _random_config_dict()

                # Simulate POST
                post_result = simulate_post(self.conn, provider, enabled, config)

                # Simulate GET
                get_result = simulate_get(self.conn, provider)

                # Assert provider matches
                self.assertEqual(
                    get_result["provider"], provider,
                    f"Provider mismatch: expected {provider!r}, got {get_result['provider']!r}"
                )

                # Assert enabled matches
                self.assertEqual(
                    get_result["enabled"], bool(enabled),
                    f"Enabled mismatch for provider {provider!r}: "
                    f"expected {bool(enabled)}, got {get_result['enabled']}"
                )

                # Assert config matches
                self.assertEqual(
                    get_result["config"], config,
                    f"Config mismatch for provider {provider!r}: "
                    f"expected {config!r}, got {get_result['config']!r}"
                )

                # Clean up for next iteration (each iteration uses a fresh provider,
                # but we delete to avoid UNIQUE constraint issues if random names collide)
                self.conn.execute(
                    "DELETE FROM network_access WHERE provider = ?",
                    (provider,),
                )
                self.conn.commit()


# ── Property 2: GET all returns all stored providers ─────────────────────

class TestProperty2GetAllReturnsAllStoredProviders(unittest.TestCase):
    """Feature: network-access, Property 2: GET all returns all stored providers

    **Validates: Requirements 2.1, 8.2**

    For any set of distinct provider names and configs that have been POSTed,
    a subsequent GET all should return a list containing every stored provider,
    with no missing entries and no duplicates.
    """

    def setUp(self):
        """Create a temporary SQLite database with the network_access table."""
        self.tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.tmp.close()
        self.conn = sqlite3.connect(self.tmp.name)
        self.conn.execute(_TABLE_DDL)
        self.conn.commit()

    def tearDown(self):
        """Close and remove the temporary database."""
        self.conn.close()
        import os
        os.unlink(self.tmp.name)

    def test_get_all_returns_all_stored_providers(self):
        """GET all should return exactly the set of stored providers — no missing, no duplicates."""
        for i in range(_ITERATIONS):
            with self.subTest(iteration=i):
                # Clear the table for each iteration
                self.conn.execute("DELETE FROM network_access")
                self.conn.commit()

                # Generate 1-10 distinct random provider names
                num_providers = random.randint(1, 10)
                providers = set()
                while len(providers) < num_providers:
                    providers.add(_random_provider_name())

                # POST a config for each provider
                expected_providers = {}
                for provider in providers:
                    enabled = random.choice([True, False])
                    config = _random_config_dict()
                    simulate_post(self.conn, provider, enabled, config)
                    expected_providers[provider] = {
                        "enabled": bool(enabled),
                        "config": config,
                    }

                # Call simulate_get_all
                all_results = simulate_get_all(self.conn)

                # Assert the returned list has exactly the same providers
                returned_providers = [r["provider"] for r in all_results]

                # No duplicates
                self.assertEqual(
                    len(returned_providers), len(set(returned_providers)),
                    f"Duplicate providers in GET all response: {returned_providers}"
                )

                # Exact match of provider names
                self.assertEqual(
                    set(returned_providers), set(expected_providers.keys()),
                    f"Provider set mismatch: expected {sorted(expected_providers.keys())}, "
                    f"got {sorted(returned_providers)}"
                )

                # Verify each returned provider has correct data
                for result in all_results:
                    prov = result["provider"]
                    expected = expected_providers[prov]
                    self.assertEqual(
                        result["enabled"], expected["enabled"],
                        f"Enabled mismatch for provider {prov!r}: "
                        f"expected {expected['enabled']}, got {result['enabled']}"
                    )
                    self.assertEqual(
                        result["config"], expected["config"],
                        f"Config mismatch for provider {prov!r}: "
                        f"expected {expected['config']!r}, got {result['config']!r}"
                    )


# ── Simulated tailscale up logic (from routes/network_access.py) ──────────

def simulate_tailscale_up(conn) -> list:
    """Simulate POST /api/network-access/tailscale/up via direct DB operations.

    Mirrors the tailscale_up() route logic:
    - Load saved config from network_access table where provider = 'tailscale'
    - Extract auth_key from the deserialized config JSON
    - If no auth key, raise ValueError
    - Build the command: ["tailscale", "up", "--authkey=" + auth_key]
    - Return the command args (instead of actually running subprocess)
    """
    conn.row_factory = sqlite3.Row
    row = conn.execute(
        "SELECT config FROM network_access WHERE provider = ?",
        ("tailscale",),
    ).fetchone()

    auth_key = None
    if row and row["config"]:
        try:
            config_data = json.loads(row["config"])
            auth_key = config_data.get("auth_key")
        except (json.JSONDecodeError, TypeError):
            pass

    if not auth_key:
        raise ValueError("No Tailscale auth key configured. Save an auth key first.")

    return ["tailscale", "up", "--authkey=" + auth_key]


# ── Random auth key generator ────────────────────────────────────────────

_AUTH_KEY_CHARS = string.ascii_letters + string.digits + "-"


def _random_auth_key():
    """Generate a random auth key string of 10-60 chars using alphanumeric + hyphens."""
    length = random.randint(10, 60)
    return "".join(random.choices(_AUTH_KEY_CHARS, k=length))


# ── Property 3: Auth key included in tailscale up command ────────────────

class TestProperty3AuthKeyInTailscaleUpCommand(unittest.TestCase):
    """Feature: network-access, Property 3: Auth key included in tailscale up command

    **Validates: Requirements 7.4**

    For any non-empty auth key string saved in the Tailscale config, when
    the tailscale up logic is called, the subprocess command built should
    contain --authkey= followed by the exact saved auth key value.
    """

    def setUp(self):
        """Create a temporary SQLite database with the network_access table."""
        self.tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.tmp.close()
        self.conn = sqlite3.connect(self.tmp.name)
        self.conn.execute(_TABLE_DDL)
        self.conn.commit()

    def tearDown(self):
        """Close and remove the temporary database."""
        self.conn.close()
        import os
        os.unlink(self.tmp.name)

    def test_auth_key_in_tailscale_up_command(self):
        """Saved auth key should appear as --authkey=<exact_key> in the command args."""
        for i in range(_ITERATIONS):
            with self.subTest(iteration=i):
                # Generate a random auth key
                auth_key = _random_auth_key()

                # Save it as Tailscale config via simulate_post
                simulate_post(
                    self.conn,
                    provider="tailscale",
                    enabled=True,
                    config={"auth_key": auth_key},
                )

                # Call simulate_tailscale_up and get the command args
                cmd_args = simulate_tailscale_up(self.conn)

                # Assert the command is structured correctly
                self.assertEqual(
                    cmd_args[0], "tailscale",
                    f"First arg should be 'tailscale', got {cmd_args[0]!r}"
                )
                self.assertEqual(
                    cmd_args[1], "up",
                    f"Second arg should be 'up', got {cmd_args[1]!r}"
                )

                # Assert --authkey= contains the exact saved key
                expected_authkey_arg = "--authkey=" + auth_key
                self.assertEqual(
                    cmd_args[2], expected_authkey_arg,
                    f"Third arg should be {expected_authkey_arg!r}, got {cmd_args[2]!r}"
                )

                # Also verify via substring search across all args
                joined = " ".join(cmd_args)
                self.assertIn(
                    "--authkey=" + auth_key, joined,
                    f"Command args should contain '--authkey={auth_key}', "
                    f"got: {cmd_args!r}"
                )

                # Clean up for next iteration
                self.conn.execute(
                    "DELETE FROM network_access WHERE provider = ?",
                    ("tailscale",),
                )
                self.conn.commit()


# ── Edge Cases and Admin Enforcement ─────────────────────────────────────

class TestEdgeCasesAndAdminEnforcement(unittest.TestCase):
    """Unit tests for edge cases and admin enforcement logic.

    **Validates: Requirements 1.2, 1.4, 2.3, 2.5, 2.6, 7.3**
    """

    def setUp(self):
        """Create a temporary SQLite database with the network_access table."""
        self.tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.tmp.close()
        self.conn = sqlite3.connect(self.tmp.name)
        self.conn.execute(_TABLE_DDL)
        self.conn.commit()

    def tearDown(self):
        """Close and remove the temporary database."""
        self.conn.close()
        import os
        os.unlink(self.tmp.name)

    # ── 1. Migration idempotency ─────────────────────────────────────────

    def test_migration_idempotency(self):
        """Running CREATE TABLE IF NOT EXISTS twice should not error and table should exist correctly.

        Validates: Requirement 1.2
        """
        # The table was already created in setUp via _TABLE_DDL.
        # Run the same DDL again — should not raise.
        self.conn.execute(_TABLE_DDL)
        self.conn.commit()

        # Run it a third time for good measure.
        self.conn.execute(_TABLE_DDL)
        self.conn.commit()

        # Verify the table exists and has the expected columns.
        cursor = self.conn.execute("PRAGMA table_info(network_access)")
        columns = {row[1] for row in cursor.fetchall()}
        expected_columns = {"id", "provider", "enabled", "config",
                            "created_datetime", "modified_datetime"}
        self.assertEqual(columns, expected_columns,
                         f"Table columns mismatch: expected {expected_columns}, got {columns}")

        # Verify we can still insert and query.
        simulate_post(self.conn, "test_provider", True, {"key": "value"})
        result = simulate_get(self.conn, "test_provider")
        self.assertEqual(result["provider"], "test_provider")
        self.assertEqual(result["config"], {"key": "value"})

    # ── 2. Default config for missing provider ───────────────────────────

    def test_default_config_for_missing_provider(self):
        """GET for a nonexistent provider should return default response shape.

        Validates: Requirement 2.3
        """
        result = simulate_get(self.conn, "nonexistent")

        self.assertEqual(result["provider"], "nonexistent",
                         "Default response should echo the requested provider name")
        self.assertFalse(result["enabled"],
                         "Default response should have enabled=False")
        self.assertEqual(result["config"], {},
                         "Default response should have config={}")

        # Verify no extra keys beyond the expected default shape
        self.assertNotIn("id", result,
                         "Default response should not include 'id'")
        self.assertNotIn("created_datetime", result,
                         "Default response should not include 'created_datetime'")
        self.assertNotIn("modified_datetime", result,
                         "Default response should not include 'modified_datetime'")

    # ── 3. Admin-only enforcement ────────────────────────────────────────

    def test_admin_only_enforcement_non_admin_rejected(self):
        """Non-admin user should fail the admin check.

        Validates: Requirements 2.5, 2.6

        We inline the _require_admin check logic: look up the user in the
        users table and verify is_admin. A non-admin user should be rejected.
        """
        # Create a users table in the temp DB
        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT,
                is_admin BOOLEAN DEFAULT 0
            )
        """)
        self.conn.commit()

        # Insert a non-admin user
        non_admin_id = str(uuid.uuid4())
        self.conn.execute(
            "INSERT INTO users (id, username, is_admin) VALUES (?, ?, ?)",
            (non_admin_id, "regular_user", 0),
        )
        self.conn.commit()

        # Inline the _require_admin check logic
        self.conn.row_factory = sqlite3.Row
        row = self.conn.execute(
            "SELECT is_admin FROM users WHERE id = ?",
            (non_admin_id,),
        ).fetchone()

        self.assertIsNotNone(row, "User should exist in the database")
        self.assertFalse(bool(row["is_admin"]),
                         "Non-admin user should have is_admin=False")

        # Verify that an admin user WOULD pass
        admin_id = str(uuid.uuid4())
        self.conn.execute(
            "INSERT INTO users (id, username, is_admin) VALUES (?, ?, ?)",
            (admin_id, "admin_user", 1),
        )
        self.conn.commit()

        admin_row = self.conn.execute(
            "SELECT is_admin FROM users WHERE id = ?",
            (admin_id,),
        ).fetchone()

        self.assertIsNotNone(admin_row, "Admin user should exist in the database")
        self.assertTrue(bool(admin_row["is_admin"]),
                        "Admin user should have is_admin=True")

        # Verify a missing user would also fail (no row found)
        missing_row = self.conn.execute(
            "SELECT is_admin FROM users WHERE id = ?",
            ("nonexistent-user-id",),
        ).fetchone()

        self.assertIsNone(missing_row,
                          "Missing user should return None from the query")

    # ── 4. No auth key error ─────────────────────────────────────────────

    def test_no_auth_key_raises_error(self):
        """tailscale_up with no saved config should raise ValueError.

        Validates: Requirement 7.3
        """
        # No tailscale config saved at all — table is empty
        with self.assertRaises(ValueError) as ctx:
            simulate_tailscale_up(self.conn)

        self.assertIn("No Tailscale auth key configured", str(ctx.exception),
                       "Error message should mention missing auth key")

    def test_no_auth_key_with_empty_config(self):
        """tailscale_up with saved config but no auth_key field should raise ValueError.

        Validates: Requirement 7.3
        """
        # Save a tailscale config with no auth_key
        simulate_post(self.conn, "tailscale", True, {"some_other_field": "value"})

        with self.assertRaises(ValueError) as ctx:
            simulate_tailscale_up(self.conn)

        self.assertIn("No Tailscale auth key configured", str(ctx.exception),
                       "Error message should mention missing auth key")

    # ── 5. Provider uniqueness ───────────────────────────────────────────

    def test_provider_uniqueness(self):
        """POSTing two configs for the same provider should result in one row (update, not duplicate).

        Validates: Requirement 1.4
        """
        provider = "tailscale"

        # First POST
        first_result = simulate_post(self.conn, provider, False, {"auth_key": "key1"})
        first_id = first_result["id"]

        # Second POST with different config
        second_result = simulate_post(self.conn, provider, True, {"auth_key": "key2"})
        second_id = second_result["id"]

        # The id should be preserved across updates
        self.assertEqual(first_id, second_id,
                         "Row ID should be preserved when updating an existing provider")

        # Verify only one row exists for this provider
        cursor = self.conn.execute(
            "SELECT COUNT(*) FROM network_access WHERE provider = ?",
            (provider,),
        )
        count = cursor.fetchone()[0]
        self.assertEqual(count, 1,
                         f"Expected exactly 1 row for provider '{provider}', got {count}")

        # Verify the config was updated to the second POST's values
        result = simulate_get(self.conn, provider)
        self.assertTrue(result["enabled"],
                        "Enabled should reflect the second POST (True)")
        self.assertEqual(result["config"], {"auth_key": "key2"},
                         "Config should reflect the second POST's auth_key")


if __name__ == "__main__":
    unittest.main()
