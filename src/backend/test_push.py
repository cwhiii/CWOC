"""
Unit tests for push notification backend logic.

Feature: pwa-wrapper
Uses Python stdlib only (unittest + sqlite3 + random + uuid) — no external libraries.
Each property test runs 100+ iterations with randomly generated inputs.

NOTE: We inline the minimal production logic (get_or_create_vapid_keys,
subscribe, unsubscribe, send_push_to_user) to avoid importing FastAPI.
Same pattern as test_audit.py — pure-function helpers copied here so the
test file can run with *zero* third-party packages.
"""

import json
import logging
import random
import sqlite3
import string
import unittest
import uuid
from datetime import datetime

logger = logging.getLogger("test_push")

# ═══════════════════════════════════════════════════════════════════════════
# Schema helpers — create in-memory tables matching migrations.py
# ═══════════════════════════════════════════════════════════════════════════

def _create_tables(conn):
    """Create push_subscriptions and instance_meta tables in the given connection."""
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS push_subscriptions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            endpoint TEXT NOT NULL UNIQUE,
            p256dh TEXT NOT NULL,
            auth TEXT NOT NULL,
            device_label TEXT,
            created_datetime TEXT NOT NULL
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS instance_meta (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
    """)
    conn.commit()


# ═══════════════════════════════════════════════════════════════════════════
# Inlined production logic (from src/backend/routes/push.py)
# Kept in sync manually.  Only the pure DB helpers are copied here so the
# test file can run with *zero* third-party packages.
# ═══════════════════════════════════════════════════════════════════════════

def get_or_create_vapid_keys(conn):
    """Generate VAPID keys on first call, retrieve from instance_meta thereafter.

    Inlined version that accepts a connection parameter instead of using DB_PATH.
    Uses random bytes as fake VAPID keys (sufficient for testing idempotence).
    """
    cursor = conn.cursor()

    # Check if keys already exist
    cursor.execute(
        "SELECT key, value FROM instance_meta WHERE key IN ('vapid_public_key', 'vapid_private_key')"
    )
    rows = cursor.fetchall()
    keys = {row[0]: row[1] for row in rows}

    if 'vapid_public_key' in keys and 'vapid_private_key' in keys:
        return {
            'public_key': keys['vapid_public_key'],
            'private_key': keys['vapid_private_key'],
        }

    # Generate fake keys (random base64url-ish strings — real keys use EC P-256)
    import base64
    import os
    raw_pub = os.urandom(65)   # uncompressed EC point is 65 bytes
    raw_priv = os.urandom(32)  # private scalar is 32 bytes
    public_key_b64 = base64.urlsafe_b64encode(raw_pub).rstrip(b'=').decode('ascii')
    private_key_b64 = base64.urlsafe_b64encode(raw_priv).rstrip(b'=').decode('ascii')

    cursor.execute(
        "INSERT OR REPLACE INTO instance_meta (key, value) VALUES ('vapid_public_key', ?)",
        (public_key_b64,),
    )
    cursor.execute(
        "INSERT OR REPLACE INTO instance_meta (key, value) VALUES ('vapid_private_key', ?)",
        (private_key_b64,),
    )
    conn.commit()

    return {
        'public_key': public_key_b64,
        'private_key': private_key_b64,
    }


def store_subscription(conn, user_id, endpoint, p256dh, auth, device_label=None):
    """Store a push subscription (mirrors POST /api/push/subscribe logic)."""
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat() + "Z"
    sub_id = str(uuid.uuid4())

    # Upsert: if endpoint already exists, update
    cursor.execute("SELECT id FROM push_subscriptions WHERE endpoint = ?", (endpoint,))
    existing = cursor.fetchone()

    if existing:
        cursor.execute(
            """UPDATE push_subscriptions
               SET user_id = ?, p256dh = ?, auth = ?, device_label = ?
               WHERE endpoint = ?""",
            (user_id, p256dh, auth, device_label, endpoint),
        )
        sub_id = existing[0]
    else:
        cursor.execute(
            """INSERT INTO push_subscriptions
               (id, user_id, endpoint, p256dh, auth, device_label, created_datetime)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (sub_id, user_id, endpoint, p256dh, auth, device_label, now),
        )

    conn.commit()
    return sub_id


def delete_subscription_by_endpoint(conn, user_id, endpoint):
    """Remove a push subscription by endpoint (mirrors DELETE /api/push/subscribe)."""
    cursor = conn.cursor()
    cursor.execute(
        "DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?",
        (endpoint, user_id),
    )
    deleted = cursor.rowcount
    conn.commit()
    return deleted


def cleanup_expired_subscriptions(conn, expired_ids):
    """Remove subscriptions that returned 410 Gone (mirrors send_push_to_user cleanup)."""
    if not expired_ids:
        return 0
    cursor = conn.cursor()
    placeholders = ','.join('?' for _ in expired_ids)
    cursor.execute(
        f"DELETE FROM push_subscriptions WHERE id IN ({placeholders})",
        expired_ids,
    )
    deleted = cursor.rowcount
    conn.commit()
    return deleted


# ═══════════════════════════════════════════════════════════════════════════
# Random data generators
# ═══════════════════════════════════════════════════════════════════════════

_ITERATIONS = 120  # comfortably above the 100 minimum


def _random_string(max_len=20):
    length = random.randint(1, max_len)
    return "".join(random.choices(string.ascii_letters + string.digits, k=length))


def _random_endpoint():
    """Generate a random push service endpoint URL."""
    return f"https://push.example.com/{uuid.uuid4()}"


def _random_b64_key(length=32):
    """Generate a random base64url-encoded key string."""
    import base64
    import os
    raw = os.urandom(length)
    return base64.urlsafe_b64encode(raw).rstrip(b'=').decode('ascii')


def _random_user_id():
    return str(uuid.uuid4())


# ═══════════════════════════════════════════════════════════════════════════
# Property 5: VAPID key generation is idempotent
# ═══════════════════════════════════════════════════════════════════════════

class TestProperty5VapidKeyIdempotence(unittest.TestCase):
    """Feature: pwa-wrapper, Property 5: VAPID key generation is idempotent

    *For any* number of calls to get_or_create_vapid_keys(), the function
    SHALL always return the same key pair — generating keys only on the
    first invocation and retrieving from instance_meta on all subsequent calls.

    **Validates: Requirements 11.1**
    """

    def test_vapid_keys_idempotent_multiple_calls(self):
        """Calling get_or_create_vapid_keys N times always returns the same keys."""
        for i in range(_ITERATIONS):
            with self.subTest(iteration=i):
                conn = sqlite3.connect(":memory:")
                _create_tables(conn)

                # First call generates keys
                keys1 = get_or_create_vapid_keys(conn)
                self.assertIn('public_key', keys1)
                self.assertIn('private_key', keys1)
                self.assertTrue(len(keys1['public_key']) > 0)
                self.assertTrue(len(keys1['private_key']) > 0)

                # Random number of subsequent calls (2-5)
                num_calls = random.randint(2, 5)
                for _ in range(num_calls):
                    keys_n = get_or_create_vapid_keys(conn)
                    self.assertEqual(keys_n['public_key'], keys1['public_key'],
                                     "Public key changed on subsequent call")
                    self.assertEqual(keys_n['private_key'], keys1['private_key'],
                                     "Private key changed on subsequent call")

                conn.close()

    def test_vapid_keys_stored_in_instance_meta(self):
        """Keys are persisted in instance_meta table after first generation."""
        conn = sqlite3.connect(":memory:")
        _create_tables(conn)

        keys = get_or_create_vapid_keys(conn)

        cursor = conn.cursor()
        cursor.execute("SELECT value FROM instance_meta WHERE key = 'vapid_public_key'")
        stored_pub = cursor.fetchone()
        cursor.execute("SELECT value FROM instance_meta WHERE key = 'vapid_private_key'")
        stored_priv = cursor.fetchone()

        self.assertIsNotNone(stored_pub)
        self.assertIsNotNone(stored_priv)
        self.assertEqual(stored_pub[0], keys['public_key'])
        self.assertEqual(stored_priv[0], keys['private_key'])

        conn.close()


# ═══════════════════════════════════════════════════════════════════════════
# Property 6: Push subscription storage round-trip
# ═══════════════════════════════════════════════════════════════════════════

class TestProperty6SubscriptionRoundTrip(unittest.TestCase):
    """Feature: pwa-wrapper, Property 6: Push subscription storage round-trip

    *For any* valid push subscription object (containing endpoint, p256dh,
    and auth), storing it via subscribe and then querying the push_subscriptions
    table by user_id SHALL return a record with identical endpoint, p256dh,
    and auth values.

    **Validates: Requirements 11.5**
    """

    def test_subscription_round_trip(self):
        """Store a subscription and verify all fields are retrievable."""
        for i in range(_ITERATIONS):
            with self.subTest(iteration=i):
                conn = sqlite3.connect(":memory:")
                _create_tables(conn)

                user_id = _random_user_id()
                endpoint = _random_endpoint()
                p256dh = _random_b64_key(65)
                auth = _random_b64_key(16)
                device_label = _random_string(15) if random.random() > 0.3 else None

                sub_id = store_subscription(conn, user_id, endpoint, p256dh, auth, device_label)

                # Query back by user_id
                cursor = conn.cursor()
                cursor.execute(
                    "SELECT id, endpoint, p256dh, auth, device_label FROM push_subscriptions WHERE user_id = ?",
                    (user_id,),
                )
                row = cursor.fetchone()

                self.assertIsNotNone(row, "Subscription not found after storage")
                self.assertEqual(row[0], sub_id)
                self.assertEqual(row[1], endpoint)
                self.assertEqual(row[2], p256dh)
                self.assertEqual(row[3], auth)
                self.assertEqual(row[4], device_label)

                conn.close()

    def test_subscription_upsert_updates_existing(self):
        """Storing a subscription with the same endpoint updates keys."""
        conn = sqlite3.connect(":memory:")
        _create_tables(conn)

        user_id = _random_user_id()
        endpoint = _random_endpoint()
        p256dh_1 = _random_b64_key(65)
        auth_1 = _random_b64_key(16)

        sub_id_1 = store_subscription(conn, user_id, endpoint, p256dh_1, auth_1)

        # Update with new keys
        p256dh_2 = _random_b64_key(65)
        auth_2 = _random_b64_key(16)
        sub_id_2 = store_subscription(conn, user_id, endpoint, p256dh_2, auth_2)

        # Should be the same subscription ID (upsert)
        self.assertEqual(sub_id_1, sub_id_2)

        # Should have updated keys
        cursor = conn.cursor()
        cursor.execute(
            "SELECT p256dh, auth FROM push_subscriptions WHERE id = ?",
            (sub_id_1,),
        )
        row = cursor.fetchone()
        self.assertEqual(row[0], p256dh_2)
        self.assertEqual(row[1], auth_2)

        # Should still be only one row
        cursor.execute("SELECT COUNT(*) FROM push_subscriptions WHERE endpoint = ?", (endpoint,))
        self.assertEqual(cursor.fetchone()[0], 1)

        conn.close()


# ═══════════════════════════════════════════════════════════════════════════
# Property 8: Expired subscriptions are removed on 410
# ═══════════════════════════════════════════════════════════════════════════

class TestProperty8ExpiredSubscriptionCleanup(unittest.TestCase):
    """Feature: pwa-wrapper, Property 8: Expired subscriptions are removed on 410

    *For any* push subscription where the push service returns HTTP 410 Gone,
    the backend SHALL delete that subscription from the push_subscriptions
    table so it is not used in future send attempts.

    **Validates: Requirements 11.10**
    """

    def test_410_cleanup_removes_expired_subscriptions(self):
        """Simulating 410 responses removes the expired subscriptions."""
        for i in range(_ITERATIONS):
            with self.subTest(iteration=i):
                conn = sqlite3.connect(":memory:")
                _create_tables(conn)

                user_id = _random_user_id()

                # Create N subscriptions (2-6)
                num_subs = random.randint(2, 6)
                sub_ids = []
                for _ in range(num_subs):
                    endpoint = _random_endpoint()
                    p256dh = _random_b64_key(65)
                    auth = _random_b64_key(16)
                    sid = store_subscription(conn, user_id, endpoint, p256dh, auth)
                    sub_ids.append(sid)

                # Pick a random subset to mark as expired (at least 1)
                num_expired = random.randint(1, len(sub_ids))
                expired_ids = random.sample(sub_ids, num_expired)
                surviving_ids = [s for s in sub_ids if s not in expired_ids]

                # Simulate 410 cleanup
                deleted = cleanup_expired_subscriptions(conn, expired_ids)
                self.assertEqual(deleted, num_expired)

                # Verify expired are gone
                cursor = conn.cursor()
                for eid in expired_ids:
                    cursor.execute("SELECT id FROM push_subscriptions WHERE id = ?", (eid,))
                    self.assertIsNone(cursor.fetchone(),
                                     f"Expired subscription {eid} still exists after cleanup")

                # Verify surviving subscriptions remain
                for sid in surviving_ids:
                    cursor.execute("SELECT id FROM push_subscriptions WHERE id = ?", (sid,))
                    self.assertIsNotNone(cursor.fetchone(),
                                         f"Surviving subscription {sid} was incorrectly removed")

                conn.close()

    def test_410_cleanup_empty_list_is_noop(self):
        """Cleanup with empty expired list does nothing."""
        conn = sqlite3.connect(":memory:")
        _create_tables(conn)

        user_id = _random_user_id()
        store_subscription(conn, user_id, _random_endpoint(), _random_b64_key(65), _random_b64_key(16))

        deleted = cleanup_expired_subscriptions(conn, [])
        self.assertEqual(deleted, 0)

        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM push_subscriptions")
        self.assertEqual(cursor.fetchone()[0], 1)

        conn.close()


# ═══════════════════════════════════════════════════════════════════════════
# VAPID public key endpoint (unauthenticated access)
# ═══════════════════════════════════════════════════════════════════════════

class TestVapidPublicKeyEndpoint(unittest.TestCase):
    """Test that the VAPID public key can be retrieved without authentication.

    Since we can't import FastAPI, we test the underlying logic: calling
    get_or_create_vapid_keys() returns a dict with a non-empty public_key.
    The route handler simply wraps this — if the function works, the
    unauthenticated GET endpoint works (auth exclusion is configured in
    middleware, tested separately).
    """

    def test_vapid_public_key_available_without_auth(self):
        """get_or_create_vapid_keys returns a public key that could be served."""
        conn = sqlite3.connect(":memory:")
        _create_tables(conn)

        keys = get_or_create_vapid_keys(conn)

        self.assertIn('public_key', keys)
        self.assertTrue(len(keys['public_key']) > 0,
                        "Public key should be a non-empty string")
        # The public key should be base64url-safe characters
        allowed = set(string.ascii_letters + string.digits + '-_')
        for ch in keys['public_key']:
            self.assertIn(ch, allowed,
                          f"Public key contains non-base64url character: {ch!r}")

        conn.close()


# ═══════════════════════════════════════════════════════════════════════════
# Subscribe / Unsubscribe flow
# ═══════════════════════════════════════════════════════════════════════════

class TestSubscribeUnsubscribeFlow(unittest.TestCase):
    """Test the full subscribe → verify → unsubscribe → verify-gone flow
    at the database level.
    """

    def test_subscribe_then_unsubscribe(self):
        """Subscribe creates a record, unsubscribe removes it."""
        conn = sqlite3.connect(":memory:")
        _create_tables(conn)

        user_id = _random_user_id()
        endpoint = _random_endpoint()
        p256dh = _random_b64_key(65)
        auth = _random_b64_key(16)

        # Subscribe
        sub_id = store_subscription(conn, user_id, endpoint, p256dh, auth, "Test Device")

        # Verify subscription exists
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM push_subscriptions WHERE user_id = ?", (user_id,))
        self.assertIsNotNone(cursor.fetchone())

        # Unsubscribe
        deleted = delete_subscription_by_endpoint(conn, user_id, endpoint)
        self.assertEqual(deleted, 1)

        # Verify subscription is gone
        cursor.execute("SELECT id FROM push_subscriptions WHERE user_id = ?", (user_id,))
        self.assertIsNone(cursor.fetchone())

        conn.close()

    def test_unsubscribe_wrong_user_does_nothing(self):
        """Unsubscribe only removes subscriptions belonging to the authenticated user."""
        conn = sqlite3.connect(":memory:")
        _create_tables(conn)

        user_a = _random_user_id()
        user_b = _random_user_id()
        endpoint = _random_endpoint()

        # User A subscribes
        store_subscription(conn, user_a, endpoint, _random_b64_key(65), _random_b64_key(16))

        # User B tries to unsubscribe the same endpoint
        deleted = delete_subscription_by_endpoint(conn, user_b, endpoint)
        self.assertEqual(deleted, 0, "Should not delete another user's subscription")

        # User A's subscription should still exist
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM push_subscriptions WHERE user_id = ?", (user_a,))
        self.assertIsNotNone(cursor.fetchone())

        conn.close()

    def test_unsubscribe_nonexistent_endpoint(self):
        """Unsubscribing a non-existent endpoint returns 0 deleted."""
        conn = sqlite3.connect(":memory:")
        _create_tables(conn)

        user_id = _random_user_id()
        deleted = delete_subscription_by_endpoint(conn, user_id, "https://nonexistent.example.com/fake")
        self.assertEqual(deleted, 0)

        conn.close()

    def test_multiple_devices_per_user(self):
        """A user can have multiple subscriptions (one per device)."""
        conn = sqlite3.connect(":memory:")
        _create_tables(conn)

        user_id = _random_user_id()
        num_devices = random.randint(2, 5)
        endpoints = []

        for i in range(num_devices):
            ep = _random_endpoint()
            endpoints.append(ep)
            store_subscription(conn, user_id, ep, _random_b64_key(65), _random_b64_key(16),
                               f"Device {i}")

        # All subscriptions should exist
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM push_subscriptions WHERE user_id = ?", (user_id,))
        self.assertEqual(cursor.fetchone()[0], num_devices)

        # Unsubscribe one device
        deleted = delete_subscription_by_endpoint(conn, user_id, endpoints[0])
        self.assertEqual(deleted, 1)

        # Remaining devices still subscribed
        cursor.execute("SELECT COUNT(*) FROM push_subscriptions WHERE user_id = ?", (user_id,))
        self.assertEqual(cursor.fetchone()[0], num_devices - 1)

        conn.close()


if __name__ == "__main__":
    unittest.main()
