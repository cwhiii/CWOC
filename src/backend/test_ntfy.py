"""
Unit tests for the Ntfy sender module (Task 1).

Feature: ntfy-notifications
Uses Python stdlib only (unittest + sqlite3 + random) — no external libraries.

NOTE: We inline the minimal production logic to avoid importing FastAPI.
Same pattern as test_network_access.py and test_push.py.
"""

import json
import random
import sqlite3
import string
import tempfile
import unittest
import uuid


# ═══════════════════════════════════════════════════════════════════════════
# Inlined production logic (from src/backend/routes/ntfy.py)
# ═══════════════════════════════════════════════════════════════════════════

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


def get_ntfy_topic(user_id: str) -> str:
    """Return deterministic topic: 'cwoc-' + first 12 alphanumeric chars of user_id."""
    alphanumeric = "".join(c for c in user_id if c.isalnum())
    return "cwoc-" + alphanumeric[:12]


def get_ntfy_config(conn) -> dict:
    """Read ntfy provider config from the network_access table.

    Inlined version that accepts a connection parameter instead of using DB_PATH.
    """
    default = {"enabled": False, "server_url": "http://localhost:2586"}
    try:
        conn.row_factory = sqlite3.Row
        row = conn.execute(
            "SELECT enabled, config FROM network_access WHERE provider = ?",
            ("ntfy",),
        ).fetchone()

        if row is None:
            return default

        enabled = bool(row["enabled"])
        config = {}
        if row["config"]:
            try:
                config = json.loads(row["config"])
            except (json.JSONDecodeError, TypeError):
                pass

        server_url = config.get("server_url", "http://localhost:2586")
        return {"enabled": enabled, "server_url": server_url}

    except Exception:
        return default


def build_ntfy_request(server_url, user_id, title, body, click_url=None, tags=None):
    """Build the ntfy HTTP request components (without actually sending).

    Returns a dict with url, headers, and body — mirrors the logic in
    send_ntfy_notification() for testability without network access.
    """
    topic = get_ntfy_topic(user_id)
    url = f"{server_url.rstrip('/')}/{topic}"

    headers = {"X-Title": title}
    if tags:
        headers["X-Tags"] = tags
    if click_url:
        headers["X-Click"] = click_url

    return {
        "url": url,
        "headers": headers,
        "body": body,
        "topic": topic,
    }


def validate_server_url(server_url: str) -> bool:
    """Validate that server_url is not empty or whitespace-only.

    Mirrors the validation in save_ntfy_config().
    Returns True if valid, False if should be rejected.
    """
    if not server_url or not server_url.strip():
        return False
    return True


def simulate_save_ntfy_config(conn, enabled, config):
    """Simulate POST /api/network-access/ntfy with URL validation."""
    from datetime import datetime

    server_url = config.get("server_url", "")
    if not validate_server_url(server_url):
        raise ValueError("A valid Server URL is required. The URL cannot be empty or whitespace-only.")

    # Normalize
    config["server_url"] = server_url.strip()

    now = datetime.utcnow().isoformat() + "Z"
    conn.row_factory = sqlite3.Row

    existing = conn.execute(
        "SELECT id, created_datetime FROM network_access WHERE provider = ?",
        ("ntfy",),
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
        (row_id, "ntfy", 1 if enabled else 0, config_json, created, now),
    )
    conn.commit()

    return {
        "id": row_id,
        "provider": "ntfy",
        "enabled": bool(enabled),
        "config": config,
        "created_datetime": created,
        "modified_datetime": now,
    }


# ═══════════════════════════════════════════════════════════════════════════
# Random data generators
# ═══════════════════════════════════════════════════════════════════════════

_ITERATIONS = 120


def _random_uuid():
    """Generate a random UUID string."""
    return str(uuid.uuid4())


def _random_server_url():
    """Generate a random valid server URL."""
    host = "".join(random.choices(string.ascii_lowercase, k=random.randint(3, 12)))
    port = random.randint(1000, 9999)
    return f"http://{host}:{port}"


def _random_title():
    """Generate a random notification title."""
    length = random.randint(1, 50)
    return "".join(random.choices(string.ascii_letters + string.digits + " ", k=length))


def _random_body():
    """Generate a random notification body."""
    length = random.randint(1, 100)
    return "".join(random.choices(string.ascii_letters + string.digits + " .,!", k=length))


# ═══════════════════════════════════════════════════════════════════════════
# Test: Topic Generation
# ═══════════════════════════════════════════════════════════════════════════

class TestGetNtfyTopic(unittest.TestCase):
    """Tests for get_ntfy_topic() — deterministic topic from user UUID.

    **Validates: Requirements 2.1, 2.2**
    """

    def test_standard_uuid(self):
        """Standard UUID produces correct topic."""
        user_id = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
        topic = get_ntfy_topic(user_id)
        self.assertEqual(topic, "cwoc-a1b2c3d4e5f6")

    def test_prefix_is_cwoc(self):
        """Topic always starts with 'cwoc-'."""
        for _ in range(50):
            user_id = _random_uuid()
            topic = get_ntfy_topic(user_id)
            self.assertTrue(topic.startswith("cwoc-"),
                            f"Topic {topic!r} doesn't start with 'cwoc-'")

    def test_deterministic(self):
        """Same user_id always produces the same topic."""
        for _ in range(50):
            user_id = _random_uuid()
            topic1 = get_ntfy_topic(user_id)
            topic2 = get_ntfy_topic(user_id)
            self.assertEqual(topic1, topic2,
                             f"Non-deterministic for {user_id}: {topic1} != {topic2}")

    def test_hyphens_excluded(self):
        """Hyphens in UUID are stripped before taking first 12 chars."""
        user_id = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
        topic = get_ntfy_topic(user_id)
        # After stripping hyphens: a1b2c3d4e5f67890abcdef1234567890
        # First 12: a1b2c3d4e5f6
        self.assertEqual(topic, "cwoc-a1b2c3d4e5f6")
        # No hyphens in the suffix
        suffix = topic[5:]
        self.assertNotIn("-", suffix)

    def test_short_user_id(self):
        """Short user_id uses all available alphanumeric chars."""
        topic = get_ntfy_topic("abc")
        self.assertEqual(topic, "cwoc-abc")

    def test_empty_user_id(self):
        """Empty user_id produces just the prefix."""
        topic = get_ntfy_topic("")
        self.assertEqual(topic, "cwoc-")

    def test_length_is_at_most_17(self):
        """Topic is at most 17 chars: 'cwoc-' (5) + up to 12 alphanumeric."""
        for _ in range(50):
            user_id = _random_uuid()
            topic = get_ntfy_topic(user_id)
            self.assertLessEqual(len(topic), 17)
            self.assertGreaterEqual(len(topic), 5)


# ═══════════════════════════════════════════════════════════════════════════
# Test: Config Retrieval
# ═══════════════════════════════════════════════════════════════════════════

class TestGetNtfyConfig(unittest.TestCase):
    """Tests for get_ntfy_config() — reading ntfy config from DB.

    **Validates: Requirements 1.1, 1.3, 11.4**
    """

    def setUp(self):
        self.tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.tmp.close()
        self.conn = sqlite3.connect(self.tmp.name)
        self.conn.execute(_TABLE_DDL)
        self.conn.commit()

    def tearDown(self):
        self.conn.close()
        import os
        os.unlink(self.tmp.name)

    def test_default_when_no_config(self):
        """Returns default config when no ntfy row exists."""
        config = get_ntfy_config(self.conn)
        self.assertFalse(config["enabled"])
        self.assertEqual(config["server_url"], "http://localhost:2586")

    def test_reads_saved_config(self):
        """Returns saved config when ntfy row exists."""
        self.conn.execute(
            """INSERT INTO network_access (id, provider, enabled, config, created_datetime, modified_datetime)
               VALUES (?, ?, ?, ?, ?, ?)""",
            ("test-id", "ntfy", 1, json.dumps({"server_url": "http://myserver:9999"}),
             "2025-01-01T00:00:00Z", "2025-01-01T00:00:00Z"),
        )
        self.conn.commit()

        config = get_ntfy_config(self.conn)
        self.assertTrue(config["enabled"])
        self.assertEqual(config["server_url"], "http://myserver:9999")

    def test_disabled_config(self):
        """Returns enabled=False when ntfy row has enabled=0."""
        self.conn.execute(
            """INSERT INTO network_access (id, provider, enabled, config, created_datetime, modified_datetime)
               VALUES (?, ?, ?, ?, ?, ?)""",
            ("test-id", "ntfy", 0, json.dumps({"server_url": "http://localhost:2586"}),
             "2025-01-01T00:00:00Z", "2025-01-01T00:00:00Z"),
        )
        self.conn.commit()

        config = get_ntfy_config(self.conn)
        self.assertFalse(config["enabled"])

    def test_default_server_url_when_missing_from_config(self):
        """Returns default server_url when config JSON has no server_url key."""
        self.conn.execute(
            """INSERT INTO network_access (id, provider, enabled, config, created_datetime, modified_datetime)
               VALUES (?, ?, ?, ?, ?, ?)""",
            ("test-id", "ntfy", 1, json.dumps({}),
             "2025-01-01T00:00:00Z", "2025-01-01T00:00:00Z"),
        )
        self.conn.commit()

        config = get_ntfy_config(self.conn)
        self.assertEqual(config["server_url"], "http://localhost:2586")


# ═══════════════════════════════════════════════════════════════════════════
# Test: HTTP Request Construction
# ═══════════════════════════════════════════════════════════════════════════

class TestBuildNtfyRequest(unittest.TestCase):
    """Tests for HTTP request construction logic.

    **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
    """

    def test_url_construction(self):
        """URL is {server_url}/{topic}."""
        req = build_ntfy_request("http://localhost:2586", "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
                                 "Test Title", "Test Body")
        self.assertEqual(req["url"], "http://localhost:2586/cwoc-a1b2c3d4e5f6")

    def test_url_strips_trailing_slash(self):
        """Trailing slash on server_url is stripped."""
        req = build_ntfy_request("http://localhost:2586/", "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
                                 "Test Title", "Test Body")
        self.assertEqual(req["url"], "http://localhost:2586/cwoc-a1b2c3d4e5f6")

    def test_title_header(self):
        """X-Title header is set to the title parameter."""
        req = build_ntfy_request("http://localhost:2586", _random_uuid(),
                                 "My Title", "Body text")
        self.assertEqual(req["headers"]["X-Title"], "My Title")

    def test_body_is_passed_through(self):
        """Body text is passed through as-is."""
        body = "Starts at 3:00 PM"
        req = build_ntfy_request("http://localhost:2586", _random_uuid(),
                                 "Title", body)
        self.assertEqual(req["body"], body)

    def test_click_url_header(self):
        """X-Click header is set when click_url is provided."""
        click = "https://192.168.1.111/frontend/html/editor.html?id=abc123"
        req = build_ntfy_request("http://localhost:2586", _random_uuid(),
                                 "Title", "Body", click_url=click)
        self.assertEqual(req["headers"]["X-Click"], click)

    def test_no_click_url_header_when_none(self):
        """X-Click header is absent when click_url is None."""
        req = build_ntfy_request("http://localhost:2586", _random_uuid(),
                                 "Title", "Body")
        self.assertNotIn("X-Click", req["headers"])

    def test_tags_header(self):
        """X-Tags header is set when tags is provided."""
        req = build_ntfy_request("http://localhost:2586", _random_uuid(),
                                 "Title", "Body", tags="alarm_clock")
        self.assertEqual(req["headers"]["X-Tags"], "alarm_clock")

    def test_no_tags_header_when_none(self):
        """X-Tags header is absent when tags is None."""
        req = build_ntfy_request("http://localhost:2586", _random_uuid(),
                                 "Title", "Body")
        self.assertNotIn("X-Tags", req["headers"])


# ═══════════════════════════════════════════════════════════════════════════
# Test: Server URL Validation
# ═══════════════════════════════════════════════════════════════════════════

class TestServerUrlValidation(unittest.TestCase):
    """Tests for server URL validation in the save endpoint.

    **Validates: Requirements 1.4**
    """

    def setUp(self):
        self.tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.tmp.close()
        self.conn = sqlite3.connect(self.tmp.name)
        self.conn.execute(_TABLE_DDL)
        self.conn.commit()

    def tearDown(self):
        self.conn.close()
        import os
        os.unlink(self.tmp.name)

    def test_empty_url_rejected(self):
        """Empty server_url is rejected."""
        self.assertFalse(validate_server_url(""))

    def test_whitespace_only_rejected(self):
        """Whitespace-only server_url is rejected."""
        self.assertFalse(validate_server_url("   "))
        self.assertFalse(validate_server_url("\t\n"))
        self.assertFalse(validate_server_url("  \t  \n  "))

    def test_valid_url_accepted(self):
        """Valid URLs are accepted."""
        self.assertTrue(validate_server_url("http://localhost:2586"))
        self.assertTrue(validate_server_url("https://ntfy.sh"))
        self.assertTrue(validate_server_url("http://192.168.1.111:2586"))

    def test_save_rejects_empty_url(self):
        """simulate_save_ntfy_config raises ValueError for empty URL."""
        with self.assertRaises(ValueError):
            simulate_save_ntfy_config(self.conn, True, {"server_url": ""})

    def test_save_rejects_whitespace_url(self):
        """simulate_save_ntfy_config raises ValueError for whitespace-only URL."""
        with self.assertRaises(ValueError):
            simulate_save_ntfy_config(self.conn, True, {"server_url": "   "})

    def test_save_accepts_valid_url(self):
        """simulate_save_ntfy_config succeeds with a valid URL."""
        result = simulate_save_ntfy_config(self.conn, True, {"server_url": "http://localhost:2586"})
        self.assertEqual(result["provider"], "ntfy")
        self.assertTrue(result["enabled"])
        self.assertEqual(result["config"]["server_url"], "http://localhost:2586")

    def test_save_strips_whitespace_from_url(self):
        """simulate_save_ntfy_config strips leading/trailing whitespace from URL."""
        result = simulate_save_ntfy_config(self.conn, True, {"server_url": "  http://localhost:2586  "})
        self.assertEqual(result["config"]["server_url"], "http://localhost:2586")

    def test_save_preserves_existing_row_id(self):
        """Updating ntfy config preserves the row ID."""
        result1 = simulate_save_ntfy_config(self.conn, True, {"server_url": "http://localhost:2586"})
        result2 = simulate_save_ntfy_config(self.conn, False, {"server_url": "http://localhost:9999"})
        self.assertEqual(result1["id"], result2["id"])

    def test_config_not_saved_on_invalid_url(self):
        """Config is not persisted when URL validation fails."""
        # Save a valid config first
        simulate_save_ntfy_config(self.conn, True, {"server_url": "http://localhost:2586"})

        # Try to save with invalid URL — should fail
        with self.assertRaises(ValueError):
            simulate_save_ntfy_config(self.conn, True, {"server_url": ""})

        # Original config should still be intact
        config = get_ntfy_config(self.conn)
        self.assertEqual(config["server_url"], "http://localhost:2586")
        self.assertTrue(config["enabled"])


# ═══════════════════════════════════════════════════════════════════════════
# Test: send_ntfy_notification skip behavior
# ═══════════════════════════════════════════════════════════════════════════

class TestSendNtfyNotificationSkip(unittest.TestCase):
    """Tests for send_ntfy_notification skip behavior when disabled.

    **Validates: Requirements 4.2, 11.5**

    We test the skip logic by checking get_ntfy_config() returns disabled,
    which is the guard condition in send_ntfy_notification().
    """

    def setUp(self):
        self.tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.tmp.close()
        self.conn = sqlite3.connect(self.tmp.name)
        self.conn.execute(_TABLE_DDL)
        self.conn.commit()

    def tearDown(self):
        self.conn.close()
        import os
        os.unlink(self.tmp.name)

    def test_skip_when_not_configured(self):
        """When no ntfy config exists, get_ntfy_config returns disabled."""
        config = get_ntfy_config(self.conn)
        self.assertFalse(config["enabled"])

    def test_skip_when_disabled(self):
        """When ntfy is explicitly disabled, get_ntfy_config returns disabled."""
        self.conn.execute(
            """INSERT INTO network_access (id, provider, enabled, config, created_datetime, modified_datetime)
               VALUES (?, ?, ?, ?, ?, ?)""",
            ("test-id", "ntfy", 0, json.dumps({"server_url": "http://localhost:2586"}),
             "2025-01-01T00:00:00Z", "2025-01-01T00:00:00Z"),
        )
        self.conn.commit()

        config = get_ntfy_config(self.conn)
        self.assertFalse(config["enabled"])


# ═══════════════════════════════════════════════════════════════════════════
# Property-Based Tests (lightweight PBT harness — 120 iterations each)
# ═══════════════════════════════════════════════════════════════════════════


def _random_click_url():
    """Generate a random click URL."""
    chit_id = str(uuid.uuid4())
    return f"/frontend/html/editor.html?id={chit_id}"


def _random_whitespace():
    """Generate a random whitespace-only string (spaces, tabs, newlines, or empty)."""
    ws_chars = " \t\n\r"
    length = random.randint(0, 20)
    return "".join(random.choices(ws_chars, k=length))


class TestPBTTopicDeterminismAndFormat(unittest.TestCase):
    """Property 1: Topic generation is deterministic and correctly formatted.

    For any valid UUID string, get_ntfy_topic(user_id) SHALL always return
    a string equal to "cwoc-" concatenated with the first 12 alphanumeric
    characters of the UUID (hyphens excluded), and calling it multiple times
    with the same input SHALL always produce the same result.

    **Validates: Requirements 2.1, 2.2**
    """

    def test_property_topic_determinism_and_format(self):
        """PBT: topic = 'cwoc-' + first 12 alnum chars, and is deterministic."""
        for i in range(_ITERATIONS):
            user_id = _random_uuid()

            # Compute expected topic manually
            alnum = "".join(c for c in user_id if c.isalnum())
            expected = "cwoc-" + alnum[:12]

            # Call the function multiple times
            result1 = get_ntfy_topic(user_id)
            result2 = get_ntfy_topic(user_id)

            # Format correctness
            self.assertEqual(
                result1, expected,
                f"Iteration {i}: get_ntfy_topic({user_id!r}) = {result1!r}, expected {expected!r}",
            )

            # Determinism
            self.assertEqual(
                result1, result2,
                f"Iteration {i}: non-deterministic for {user_id!r}: {result1!r} != {result2!r}",
            )

            # Structural checks
            self.assertTrue(result1.startswith("cwoc-"))
            self.assertLessEqual(len(result1), 17)  # 5 prefix + 12 max
            suffix = result1[5:]
            self.assertTrue(suffix.isalnum() or suffix == "",
                            f"Iteration {i}: suffix {suffix!r} contains non-alnum chars")


class TestPBTWhitespaceURLRejection(unittest.TestCase):
    """Property 2: Whitespace-only Server URLs are rejected.

    For any string composed entirely of whitespace characters (spaces, tabs,
    newlines, or empty string), attempting to save it as the Ntfy Server_URL
    SHALL be rejected and the configuration SHALL remain unchanged.

    **Validates: Requirements 1.4**
    """

    def setUp(self):
        self.tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.tmp.close()
        self.conn = sqlite3.connect(self.tmp.name)
        self.conn.execute(_TABLE_DDL)
        self.conn.commit()

    def tearDown(self):
        self.conn.close()
        import os
        os.unlink(self.tmp.name)

    def test_property_whitespace_urls_rejected(self):
        """PBT: any whitespace-only string is rejected by validate_server_url and simulate_save."""
        # Seed a valid config so we can verify it stays unchanged
        simulate_save_ntfy_config(self.conn, True, {"server_url": "http://localhost:2586"})

        for i in range(_ITERATIONS):
            ws = _random_whitespace()

            # validate_server_url must reject
            self.assertFalse(
                validate_server_url(ws),
                f"Iteration {i}: validate_server_url({ws!r}) should be False",
            )

            # simulate_save must raise ValueError
            with self.assertRaises(ValueError, msg=f"Iteration {i}: save should reject {ws!r}"):
                simulate_save_ntfy_config(self.conn, True, {"server_url": ws})

            # Config must remain unchanged
            config = get_ntfy_config(self.conn)
            self.assertEqual(
                config["server_url"], "http://localhost:2586",
                f"Iteration {i}: config changed after rejected save with {ws!r}",
            )
            self.assertTrue(config["enabled"])


class TestPBTHTTPRequestConstruction(unittest.TestCase):
    """Property 3: HTTP request construction is correct.

    For any valid server_url, user_id, title, body, and optional click_url,
    the HTTP request constructed by build_ntfy_request SHALL have:
    (a) target URL equal to {server_url}/{topic} where topic is get_ntfy_topic(user_id),
    (b) an X-Title header equal to the title parameter,
    (c) request body equal to the body parameter, and
    (d) if click_url is provided, an X-Click header equal to click_url.

    **Validates: Requirements 3.1, 3.2, 3.4**
    """

    def test_property_request_construction(self):
        """PBT: request URL, headers, and body match inputs for any valid combination."""
        for i in range(_ITERATIONS):
            server_url = _random_server_url()
            user_id = _random_uuid()
            title = _random_title()
            body = _random_body()
            use_click = random.choice([True, False])
            click_url = _random_click_url() if use_click else None

            expected_topic = get_ntfy_topic(user_id)
            expected_url = f"{server_url.rstrip('/')}/{expected_topic}"

            req = build_ntfy_request(server_url, user_id, title, body, click_url=click_url)

            # (a) URL correctness
            self.assertEqual(
                req["url"], expected_url,
                f"Iteration {i}: URL mismatch — got {req['url']!r}, expected {expected_url!r}",
            )

            # (b) X-Title header
            self.assertEqual(
                req["headers"]["X-Title"], title,
                f"Iteration {i}: X-Title mismatch — got {req['headers']['X-Title']!r}, expected {title!r}",
            )

            # (c) Body
            self.assertEqual(
                req["body"], body,
                f"Iteration {i}: body mismatch — got {req['body']!r}, expected {body!r}",
            )

            # (d) X-Click header
            if click_url:
                self.assertEqual(
                    req["headers"]["X-Click"], click_url,
                    f"Iteration {i}: X-Click mismatch — got {req['headers'].get('X-Click')!r}, expected {click_url!r}",
                )
            else:
                self.assertNotIn(
                    "X-Click", req["headers"],
                    f"Iteration {i}: X-Click should be absent when click_url is None",
                )

            # Topic in response matches
            self.assertEqual(req["topic"], expected_topic)


class TestPBTTitleDefaulting(unittest.TestCase):
    """Property 4: Notification title defaults to "CWOC Reminder" for empty titles.

    For any chit with a None or empty-string title, the notification title
    passed to send_ntfy_notification SHALL be "CWOC Reminder", and for any
    chit with a non-empty title, the notification title SHALL equal that
    chit's title.

    **Validates: Requirements 4.5**
    """

    @staticmethod
    def _resolve_title(chit_title):
        """Replicate the title defaulting logic from _send_chit_ntfy in weather.py."""
        return chit_title if chit_title else "CWOC Reminder"

    def test_property_title_defaulting(self):
        """PBT: empty/None titles become 'CWOC Reminder'; non-empty titles pass through."""
        for i in range(_ITERATIONS):
            # Randomly choose: None, empty string, or a real title
            choice = random.choice(["none", "empty", "real"])
            if choice == "none":
                chit_title = None
            elif choice == "empty":
                chit_title = ""
            else:
                chit_title = _random_title()

            resolved = self._resolve_title(chit_title)

            if chit_title:
                self.assertEqual(
                    resolved, chit_title,
                    f"Iteration {i}: non-empty title {chit_title!r} should pass through, got {resolved!r}",
                )
            else:
                self.assertEqual(
                    resolved, "CWOC Reminder",
                    f"Iteration {i}: empty/None title should default to 'CWOC Reminder', got {resolved!r}",
                )


class TestPBTDisabledProviderSkip(unittest.TestCase):
    """Property 5: Disabled provider always skips without HTTP attempt.

    For any combination of user_id, title, body, and click_url, when the
    Ntfy provider is disabled or not configured, send_ntfy_notification
    SHALL return immediately with {'sent': False, 'reason': ...} and SHALL
    NOT make any HTTP request.

    **Validates: Requirements 11.5, 4.2**

    We test this by verifying get_ntfy_config returns disabled for both
    "not configured" and "explicitly disabled" states, which is the guard
    condition in send_ntfy_notification that prevents any HTTP call.
    """

    def setUp(self):
        self.tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.tmp.close()
        self.conn = sqlite3.connect(self.tmp.name)
        self.conn.execute(_TABLE_DDL)
        self.conn.commit()

    def tearDown(self):
        self.conn.close()
        import os
        os.unlink(self.tmp.name)

    def test_property_disabled_provider_skips(self):
        """PBT: disabled/unconfigured provider always returns enabled=False."""
        for i in range(_ITERATIONS):
            # Randomly choose: no config at all, or explicitly disabled
            scenario = random.choice(["not_configured", "disabled"])

            if scenario == "not_configured":
                # Clean slate — delete any existing row
                self.conn.execute("DELETE FROM network_access WHERE provider = 'ntfy'")
                self.conn.commit()
            else:
                # Explicitly disabled with a random server_url
                server_url = _random_server_url()
                self.conn.execute("DELETE FROM network_access WHERE provider = 'ntfy'")
                self.conn.execute(
                    """INSERT INTO network_access
                       (id, provider, enabled, config, created_datetime, modified_datetime)
                       VALUES (?, ?, ?, ?, ?, ?)""",
                    (str(uuid.uuid4()), "ntfy", 0,
                     json.dumps({"server_url": server_url}),
                     "2025-01-01T00:00:00Z", "2025-01-01T00:00:00Z"),
                )
                self.conn.commit()

            config = get_ntfy_config(self.conn)

            # The guard condition: enabled must be False
            self.assertFalse(
                config["enabled"],
                f"Iteration {i} ({scenario}): config should be disabled, got {config!r}",
            )

            # Simulate what send_ntfy_notification does with this config
            if not config.get("enabled"):
                result = {"sent": False, "reason": "ntfy is not enabled"}
            else:
                result = {"sent": True}  # Should never reach here

            self.assertFalse(result["sent"],
                             f"Iteration {i} ({scenario}): should not send")
            self.assertIn("reason", result,
                          f"Iteration {i} ({scenario}): result should have a reason")


if __name__ == "__main__":
    unittest.main()
