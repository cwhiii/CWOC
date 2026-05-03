"""Push notification API routes for the CWOC backend.

Provides endpoints for VAPID key retrieval, push subscription management,
and sending push notifications to user devices via Web Push.

Routes:
  GET    /api/push/vapid-public-key  — return VAPID public key (no auth required)
  POST   /api/push/subscribe         — store push subscription for authenticated user
  DELETE /api/push/subscribe         — remove a push subscription by endpoint
  POST   /api/push/send              — internal: send push to a user's devices

Helpers:
  get_or_create_vapid_keys()  — generate/retrieve VAPID key pair from instance_meta
  send_push_to_user()         — send push to all user subscriptions, clean up 410s
  ensure_pywebpush()          — check if pywebpush is importable, set availability flag
"""

import base64
import json
import logging
import sqlite3
from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request

from src.backend.db import DB_PATH


logger = logging.getLogger(__name__)
push_router = APIRouter(prefix="/api/push", tags=["push"])


# ═══════════════════════════════════════════════════════════════════════════
# Module-Level Push Availability Check
# ═══════════════════════════════════════════════════════════════════════════

_PUSH_AVAILABLE = False
_py_vapid = None
_webpush_mod = None


def ensure_pywebpush():
    """Check if pywebpush is importable and set module-level availability flag.

    Does NOT attempt to install anything — the configurator script handles
    installation. If pywebpush is not available, push-sending features are
    disabled but VAPID key and subscribe endpoints still work.
    """
    global _PUSH_AVAILABLE, _py_vapid, _webpush_mod
    try:
        import py_vapid
        import pywebpush
        _py_vapid = py_vapid
        _webpush_mod = pywebpush
        _PUSH_AVAILABLE = True
        logger.info("pywebpush is available — push notifications enabled")
    except ImportError:
        _PUSH_AVAILABLE = False
        _py_vapid = None
        _webpush_mod = None
        logger.warning(
            "pywebpush is not installed — push notification sending is disabled. "
            "VAPID key and subscription endpoints will still work. "
            "Run the configurator script to install pywebpush."
        )


# Run once at module import time
ensure_pywebpush()


# ═══════════════════════════════════════════════════════════════════════════
# VAPID Key Management
# ═══════════════════════════════════════════════════════════════════════════

def _generate_vapid_keys_with_py_vapid():
    """Generate VAPID keys using py_vapid (bundled with pywebpush).

    Returns:
        tuple of (public_key_b64, private_key_b64) base64url-encoded strings.
    """
    from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat

    vapid = _py_vapid.Vapid()
    vapid.generate_keys()

    raw_private = vapid.private_key.private_numbers().private_value.to_bytes(32, 'big')
    raw_public = vapid.public_key.public_bytes(
        encoding=Encoding.X962,
        format=PublicFormat.UncompressedPoint,
    )

    public_key_b64 = base64.urlsafe_b64encode(raw_public).rstrip(b'=').decode('ascii')
    private_key_b64 = base64.urlsafe_b64encode(raw_private).rstrip(b'=').decode('ascii')
    return public_key_b64, private_key_b64


def _generate_vapid_keys_with_cryptography():
    """Generate VAPID keys using the cryptography library directly.

    Fallback when py_vapid is not available but cryptography is installed.

    Returns:
        tuple of (public_key_b64, private_key_b64) base64url-encoded strings.
    """
    from cryptography.hazmat.primitives.asymmetric import ec
    from cryptography.hazmat.backends import default_backend
    from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat

    private_key = ec.generate_private_key(ec.SECP256R1(), default_backend())
    public_key = private_key.public_key()

    raw_private = private_key.private_numbers().private_value.to_bytes(32, 'big')
    raw_public = public_key.public_bytes(
        encoding=Encoding.X962,
        format=PublicFormat.UncompressedPoint,
    )

    public_key_b64 = base64.urlsafe_b64encode(raw_public).rstrip(b'=').decode('ascii')
    private_key_b64 = base64.urlsafe_b64encode(raw_private).rstrip(b'=').decode('ascii')
    return public_key_b64, private_key_b64


def get_or_create_vapid_keys() -> dict:
    """Generate VAPID keys on first call, retrieve from instance_meta thereafter.

    Tries py_vapid first (bundled with pywebpush), falls back to the
    cryptography library. Keys are stored in instance_meta as two rows:
      - vapid_public_key  (base64url-encoded)
      - vapid_private_key (base64url-encoded)

    Returns:
        dict with 'public_key' and 'private_key' (base64url-encoded strings),
        or empty dict if keys cannot be generated.
    """
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # Check if keys already exist in instance_meta
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

        # Keys don't exist yet — generate them
        public_key_b64 = None
        private_key_b64 = None

        if _py_vapid is not None:
            try:
                public_key_b64, private_key_b64 = _generate_vapid_keys_with_py_vapid()
            except Exception as e:
                logger.warning(f"py_vapid key generation failed, trying cryptography: {e}")

        if public_key_b64 is None:
            try:
                public_key_b64, private_key_b64 = _generate_vapid_keys_with_cryptography()
            except ImportError:
                logger.error(
                    "Cannot generate VAPID keys — neither pywebpush nor cryptography "
                    "library available. Push notifications will not work until "
                    "pywebpush is installed."
                )
                return {}
            except Exception as e:
                logger.error(f"VAPID key generation failed: {e}")
                return {}

        # Store the generated keys in instance_meta
        cursor.execute(
            "INSERT OR REPLACE INTO instance_meta (key, value) VALUES ('vapid_public_key', ?)",
            (public_key_b64,),
        )
        cursor.execute(
            "INSERT OR REPLACE INTO instance_meta (key, value) VALUES ('vapid_private_key', ?)",
            (private_key_b64,),
        )
        conn.commit()
        logger.info("VAPID key pair generated and stored in instance_meta")

        return {
            'public_key': public_key_b64,
            'private_key': private_key_b64,
        }

    except Exception as e:
        logger.error(f"Error in get_or_create_vapid_keys: {e}")
        return {}
    finally:
        if conn:
            conn.close()


# ═══════════════════════════════════════════════════════════════════════════
# Push Sending Helper
# ═══════════════════════════════════════════════════════════════════════════

def send_push_to_user(user_id: str, payload: dict) -> dict:
    """Send a push notification to all of a user's subscribed devices.

    Sends to every active subscription for the user. Subscriptions that
    return 410 Gone are automatically removed from the database.

    Args:
        user_id: The user whose devices should receive the push.
        payload: Dict with notification data (title, body, icon, data, etc.).

    Returns:
        dict with 'sent', 'failed', and 'cleaned' counts.
    """
    if not _PUSH_AVAILABLE:
        logger.warning("Push send skipped — pywebpush not available")
        return {'sent': 0, 'failed': 0, 'cleaned': 0, 'error': 'pywebpush not available'}

    vapid_keys = get_or_create_vapid_keys()
    if not vapid_keys:
        logger.error("Push send failed — no VAPID keys available")
        return {'sent': 0, 'failed': 0, 'cleaned': 0, 'error': 'no VAPID keys'}

    conn = None
    sent = 0
    failed = 0
    cleaned = 0

    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        cursor.execute(
            "SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?",
            (user_id,),
        )
        subscriptions = cursor.fetchall()

        if not subscriptions:
            logger.info(f"No push subscriptions found for user {user_id}")
            return {'sent': 0, 'failed': 0, 'cleaned': 0}

        payload_json = json.dumps(payload)
        vapid_claims = {"sub": "mailto:cwoc@localhost"}
        expired_ids = []

        for sub in subscriptions:
            subscription_info = {
                "endpoint": sub["endpoint"],
                "keys": {
                    "p256dh": sub["p256dh"],
                    "auth": sub["auth"],
                },
            }

            try:
                _webpush_mod.webpush(
                    subscription_info=subscription_info,
                    data=payload_json,
                    vapid_private_key=vapid_keys['private_key'],
                    vapid_claims=vapid_claims,
                )
                sent += 1
            except Exception as e:
                error_str = str(e)
                # 410 Gone means the subscription is expired — remove it
                if '410' in error_str:
                    expired_ids.append(sub["id"])
                    cleaned += 1
                    logger.info(f"Push subscription {sub['id']} returned 410 — removing")
                else:
                    failed += 1
                    logger.error(f"Push send failed for subscription {sub['id']}: {e}")

        # Clean up expired subscriptions
        if expired_ids:
            placeholders = ','.join('?' for _ in expired_ids)
            cursor.execute(
                f"DELETE FROM push_subscriptions WHERE id IN ({placeholders})",
                expired_ids,
            )
            conn.commit()
            logger.info(f"Removed {len(expired_ids)} expired push subscription(s)")

    except Exception as e:
        logger.error(f"Error sending push to user {user_id}: {e}")
        return {'sent': sent, 'failed': failed + 1, 'cleaned': cleaned, 'error': str(e)}
    finally:
        if conn:
            conn.close()

    return {'sent': sent, 'failed': failed, 'cleaned': cleaned}


# ═══════════════════════════════════════════════════════════════════════════
# API Routes
# ═══════════════════════════════════════════════════════════════════════════

@push_router.get("/vapid-public-key")
def get_vapid_public_key():
    """Return the VAPID public key for push subscription.

    No authentication required — the frontend needs this key to subscribe
    to push notifications via the Push API. The auth middleware must exclude
    this path (GET /api/push/vapid-public-key) for unauthenticated access.
    """
    keys = get_or_create_vapid_keys()
    if not keys or 'public_key' not in keys:
        raise HTTPException(
            status_code=503,
            detail="VAPID keys not available — push notifications are not configured",
        )
    return {"public_key": keys['public_key']}


@push_router.post("/subscribe")
async def subscribe_push(request: Request):
    """Store a push subscription for the authenticated user.

    Expects JSON body:
    {
        "endpoint": "https://push-service.example.com/...",
        "keys": {
            "p256dh": "base64url-encoded-key",
            "auth": "base64url-encoded-secret"
        },
        "device_label": "optional device name"
    }

    If the endpoint already exists, updates the keys and user association.
    """
    user_id = request.state.user_id

    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    endpoint = body.get("endpoint")
    keys = body.get("keys", {})
    p256dh = keys.get("p256dh")
    auth = keys.get("auth")
    device_label = body.get("device_label")

    if not endpoint or not p256dh or not auth:
        raise HTTPException(
            status_code=400,
            detail="Missing required fields: endpoint, keys.p256dh, keys.auth",
        )

    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        now = datetime.utcnow().isoformat() + "Z"
        sub_id = str(uuid4())

        # Upsert: if endpoint already exists, update the keys and user
        cursor.execute(
            "SELECT id FROM push_subscriptions WHERE endpoint = ?",
            (endpoint,),
        )
        existing = cursor.fetchone()

        if existing:
            cursor.execute(
                """UPDATE push_subscriptions
                   SET user_id = ?, p256dh = ?, auth = ?, device_label = ?
                   WHERE endpoint = ?""",
                (user_id, p256dh, auth, device_label, endpoint),
            )
            sub_id = existing[0]
            logger.info(f"Updated push subscription {sub_id} for user {user_id}")
        else:
            cursor.execute(
                """INSERT INTO push_subscriptions
                   (id, user_id, endpoint, p256dh, auth, device_label, created_datetime)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (sub_id, user_id, endpoint, p256dh, auth, device_label, now),
            )
            logger.info(f"Created push subscription {sub_id} for user {user_id}")

        conn.commit()
        return {"id": sub_id, "status": "subscribed"}

    except sqlite3.IntegrityError as e:
        logger.error(f"Push subscribe integrity error: {e}")
        raise HTTPException(status_code=409, detail="Subscription conflict")
    except Exception as e:
        logger.error(f"Error storing push subscription: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to store subscription: {e}")
    finally:
        if conn:
            conn.close()


@push_router.delete("/subscribe")
async def unsubscribe_push(request: Request):
    """Remove a push subscription by endpoint.

    Expects JSON body:
    {
        "endpoint": "https://push-service.example.com/..."
    }

    Only deletes subscriptions belonging to the authenticated user.
    """
    user_id = request.state.user_id

    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    endpoint = body.get("endpoint")
    if not endpoint:
        raise HTTPException(status_code=400, detail="Missing required field: endpoint")

    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        cursor.execute(
            "DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?",
            (endpoint, user_id),
        )
        deleted = cursor.rowcount
        conn.commit()

        if deleted == 0:
            raise HTTPException(status_code=404, detail="Subscription not found")

        logger.info(f"Removed push subscription for user {user_id}, endpoint: {endpoint[:60]}...")
        return {"status": "unsubscribed"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error removing push subscription: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to remove subscription: {e}")
    finally:
        if conn:
            conn.close()


@push_router.post("/send")
async def send_push(request: Request):
    """Internal endpoint to send a push notification to a user's devices.

    Expects JSON body:
    {
        "user_id": "target-user-uuid",
        "title": "Notification Title",
        "body": "Notification body text",
        "icon": "/static/cwoc-icon-192.png",
        "data": {
            "chit_id": "uuid",
            "url": "/frontend/html/editor.html?id=uuid"
        }
    }

    Called by the alert scheduler when a chit's alarm/start/due time arrives.
    Requires authentication (caller must be a logged-in user).
    """
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    target_user_id = body.get("user_id")
    if not target_user_id:
        raise HTTPException(status_code=400, detail="Missing required field: user_id")

    payload = {
        "title": body.get("title", "CWOC"),
        "body": body.get("body", ""),
        "icon": body.get("icon", "/static/cwoc-icon-192.png"),
        "badge": body.get("badge", "/static/cwoc-icon-192.png"),
        "data": body.get("data", {}),
    }

    result = send_push_to_user(target_user_id, payload)

    # Also send via Ntfy (parallel channel — failures don't affect Web Push result)
    try:
        from src.backend.routes.ntfy import send_ntfy_notification, build_ntfy_actions, get_user_snooze_minutes
        from src.backend.schedulers import _get_server_base_url
        ntfy_title = body.get("title", "CWOC")
        ntfy_body = body.get("body", "")
        ntfy_click = None
        data = body.get("data", {})
        if data.get("url"):
            ntfy_click = data["url"]
        base = _get_server_base_url()
        chit_id = data.get("chit_id")
        snooze_minutes = get_user_snooze_minutes(target_user_id)
        actions = build_ntfy_actions(base, chit_id=chit_id, source_type="chit",
                                     snooze_minutes=snooze_minutes)
        send_ntfy_notification(
            user_id=target_user_id,
            title=ntfy_title,
            body=ntfy_body,
            click_url=ntfy_click,
            tags="bell",
            icon_url=f"{base}/static/cwoc-icon-192.png",
            actions=actions,
        )
    except Exception as e:
        logger.debug(f"Ntfy send alongside push failed (non-fatal): {e}")

    return result


@push_router.post("/api/push/send-delayed")
async def send_push_delayed(request: Request):
    """Send a push notification now, then a second one after a server-side delay.

    Used by the test buttons so the delayed notification fires even when the
    browser is throttled or closed. The delay runs on the server via asyncio.

    Expects JSON body:
    {
        "user_id": "target-user-uuid",
        "title1": "First notification title",
        "body1": "First notification body",
        "title2": "Second notification title",
        "body2": "Second notification body",
        "delay": 10,
        "icon": "/static/cwoc-icon-192.png",
        "data": {}
    }
    """
    import asyncio

    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    target_user_id = body.get("user_id")
    if not target_user_id:
        raise HTTPException(status_code=400, detail="Missing required field: user_id")

    delay = body.get("delay", 10)
    icon = body.get("icon", "/static/cwoc-icon-192.png")
    data = body.get("data", {})

    # Send first notification immediately
    payload1 = {
        "title": body.get("title1", "CWOC Test (1/2)"),
        "body": body.get("body1", "First test notification."),
        "icon": icon,
        "badge": icon,
        "data": data,
    }
    result1 = send_push_to_user(target_user_id, payload1)

    # Also send first via Ntfy
    try:
        from src.backend.routes.ntfy import send_ntfy_notification
        ntfy_click = data.get("url") if data else None
        send_ntfy_notification(
            user_id=target_user_id,
            title=payload1["title"],
            body=payload1["body"],
            click_url=ntfy_click,
            tags="bell",
        )
    except Exception as e:
        logger.debug(f"Ntfy send (1/2) failed (non-fatal): {e}")

    # Schedule second notification after delay (server-side, not browser-side)
    async def _send_second():
        await asyncio.sleep(delay)
        payload2 = {
            "title": body.get("title2", "CWOC Test (2/2)"),
            "body": body.get("body2", f"This arrived after {delay} seconds. Notifications work!"),
            "icon": icon,
            "badge": icon,
            "data": data,
        }
        send_push_to_user(target_user_id, payload2)

        # Also send second via Ntfy
        try:
            from src.backend.routes.ntfy import send_ntfy_notification
            send_ntfy_notification(
                user_id=target_user_id,
                title=payload2["title"],
                body=payload2["body"],
                click_url=ntfy_click,
                tags="bell",
            )
        except Exception:
            pass

    asyncio.ensure_future(_send_second())

    return {
        "sent": result1.get("sent", 0),
        "failed": result1.get("failed", 0),
        "cleaned": result1.get("cleaned", 0),
        "delayed_scheduled": True,
        "delay_seconds": delay,
    }
