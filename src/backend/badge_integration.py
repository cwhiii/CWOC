"""
badge_integration.py — Badge detection integration for the email ingestion pipeline.

Hooks badge detection into email chit creation/update flows:
  - Runs detect_badges() against email chit text
  - UPSERTs matches into the badges table (dedup by provider_name + code)
  - Implements email-based completion for Package badges (delivery keywords)

Called from:
  - routes/email.py (_do_email_sync) — when new emails are synced via IMAP
  - routes/chits.py (create_chit, update_chit) — when email chits are created/updated via API
"""

import logging
import sqlite3
from datetime import datetime, timezone
from uuid import uuid4

from src.backend.db import DB_PATH, get_db_connection

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════
# Delivery Keywords for Package Completion
# ═══════════════════════════════════════════════════════════════════════════

DELIVERY_KEYWORDS = [
    "delivered",
    "delivery complete",
    "has been delivered",
    "was delivered",
]


def _check_delivery_completion(text: str) -> bool:
    """Check if email text contains delivery-related keywords.

    Args:
        text: Combined email text (subject + body) to scan.

    Returns:
        True if any delivery keyword is found (case-insensitive).
    """
    if not text:
        return False
    text_lower = text.lower()
    return any(kw in text_lower for kw in DELIVERY_KEYWORDS)


# ═══════════════════════════════════════════════════════════════════════════
# Badge UPSERT Logic
# ═══════════════════════════════════════════════════════════════════════════

def _upsert_badge(cursor, chit_id: str, match: dict, email_subject: str):
    """UPSERT a single badge into the badges table.

    Uses INSERT ... ON CONFLICT(provider_name, code) DO UPDATE for dedup.

    On insert: set status=active, detected_at=now, last_updated_at=now
    On update: set last_updated_at=now, last_email_subject, chit_id

    For Package badges, also checks delivery keywords for auto-completion.

    Args:
        cursor: Active SQLite cursor (caller manages transaction).
        chit_id: The source email chit ID.
        match: Dict from detect_badges() with category, provider_name, code, url, icon, label.
        email_subject: The email subject line for last_email_subject field.
    """
    now = datetime.now(timezone.utc).isoformat()
    badge_id = str(uuid4())

    # Determine if this is a completion event (Package + delivery keywords in subject)
    # We check the subject here; the full text check happens at the caller level
    # and is passed via the match dict if needed.
    is_completed = match.get("_is_completed", False)

    if is_completed:
        # UPSERT with completion: set status=completed, completed_at=now
        cursor.execute(
            """INSERT INTO badges (id, chit_id, category, provider_name, code, url, icon, label,
                                   status, detected_at, last_updated_at, completed_at, last_email_subject)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?)
               ON CONFLICT(provider_name, code) DO UPDATE SET
                   last_updated_at = excluded.last_updated_at,
                   last_email_subject = excluded.last_email_subject,
                   chit_id = excluded.chit_id,
                   status = 'completed',
                   completed_at = excluded.completed_at
            """,
            (
                badge_id, chit_id, match["category"], match["provider_name"],
                match["code"], match["url"], match["icon"], match["label"],
                now, now, now, email_subject,
            ),
        )
    else:
        # Standard UPSERT: insert as active, or update existing
        cursor.execute(
            """INSERT INTO badges (id, chit_id, category, provider_name, code, url, icon, label,
                                   status, detected_at, last_updated_at, last_email_subject)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
               ON CONFLICT(provider_name, code) DO UPDATE SET
                   last_updated_at = excluded.last_updated_at,
                   last_email_subject = excluded.last_email_subject,
                   chit_id = excluded.chit_id
            """,
            (
                badge_id, chit_id, match["category"], match["provider_name"],
                match["code"], match["url"], match["icon"], match["label"],
                now, now, email_subject,
            ),
        )


# ═══════════════════════════════════════════════════════════════════════════
# Main Integration Function
# ═══════════════════════════════════════════════════════════════════════════

def process_badges_for_chit(chit_data: dict, owner_id: str, cursor=None):
    """Run badge detection on an email chit and UPSERT matches into the badges table.

    This is the main entry point called from email ingestion and chit CRUD routes.
    Only processes chits that are email chits (have email_message_id or email_status).

    Args:
        chit_data: Dict with chit fields (email_subject, email_body_text, email_from, id, title).
        owner_id: The user/owner ID (used to load settings for detector config).
        cursor: Optional active SQLite cursor. If None, creates its own connection.

    Returns:
        Number of badges upserted (0 if not an email chit or no matches).
    """
    # Only process email chits
    if not chit_data.get("email_message_id") and not chit_data.get("email_status"):
        return 0

    chit_id = chit_data.get("id")
    if not chit_id:
        return 0

    # Load user settings for smart_actions_config
    own_conn = False
    conn = None
    try:
        if cursor is None:
            conn = get_db_connection()
            cursor = conn.cursor()
            own_conn = True

        # Fetch settings for this user
        cursor.execute(
            "SELECT smart_actions_config FROM settings WHERE user_id = ?",
            (owner_id,),
        )
        row = cursor.fetchone()
        settings = {"smart_actions_config": row[0] if row else None}

        # Run detection
        from src.backend.badge_detectors import detect_badges
        matches = detect_badges(chit_data, settings)

        if not matches:
            return 0

        # Build combined text for delivery keyword check
        subject = chit_data.get("email_subject") or chit_data.get("title") or ""
        body_text = chit_data.get("email_body_text") or ""
        combined_text = subject + " " + body_text
        has_delivery = _check_delivery_completion(combined_text)

        email_subject = subject

        upserted = 0
        for match in matches:
            # Mark Package badges as completed if delivery keywords found
            if match["category"] == "Package" and has_delivery:
                match["_is_completed"] = True

            _upsert_badge(cursor, chit_id, match, email_subject)
            upserted += 1

        if own_conn:
            conn.commit()

        if upserted > 0:
            logger.info(
                "[Badges] Detected %d badge(s) for chit %s (owner %s)",
                upserted, chit_id, owner_id,
            )

        return upserted

    except Exception as e:
        logger.error("[Badges] Error processing badges for chit %s: %s", chit_id, e)
        return 0
    finally:
        if own_conn and conn:
            conn.close()


def process_badges_batch(email_chits: list, owner_id: str):
    """Process badge detection for a batch of email chits (used during sync).

    More efficient than calling process_badges_for_chit individually —
    uses a single DB connection for the entire batch.

    Args:
        email_chits: List of chit data dicts from the email sync.
        owner_id: The user/owner ID.

    Returns:
        Total number of badges upserted across all chits.
    """
    if not email_chits:
        return 0

    conn = None
    total_upserted = 0
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Load settings once for the batch
        cursor.execute(
            "SELECT smart_actions_config FROM settings WHERE user_id = ?",
            (owner_id,),
        )
        row = cursor.fetchone()
        settings = {"smart_actions_config": row[0] if row else None}

        from src.backend.badge_detectors import detect_badges

        for chit_data in email_chits:
            chit_id = chit_data.get("id")
            if not chit_id:
                continue

            try:
                matches = detect_badges(chit_data, settings)
                if not matches:
                    continue

                # Build combined text for delivery keyword check
                subject = chit_data.get("email_subject") or chit_data.get("title") or ""
                body_text = chit_data.get("email_body_text") or ""
                combined_text = subject + " " + body_text
                has_delivery = _check_delivery_completion(combined_text)

                email_subject = subject

                for match in matches:
                    if match["category"] == "Package" and has_delivery:
                        match["_is_completed"] = True

                    _upsert_badge(cursor, chit_id, match, email_subject)
                    total_upserted += 1

            except Exception as e:
                logger.warning("[Badges] Error processing chit %s in batch: %s", chit_id, e)
                continue

        conn.commit()

        if total_upserted > 0:
            logger.info(
                "[Badges] Batch: detected %d badge(s) across %d email(s) for owner %s",
                total_upserted, len(email_chits), owner_id,
            )

        return total_upserted

    except Exception as e:
        logger.error("[Badges] Batch processing error: %s", e)
        return 0
    finally:
        if conn:
            conn.close()
