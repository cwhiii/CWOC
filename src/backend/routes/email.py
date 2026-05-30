"""Email integration routes and helpers for CWOC.

Provides IMAP sync, SMTP send, email parsing, and password encryption.
"""

import base64
import email
import email.message
import email.utils
import email.policy
import html as html_mod
import imaplib
import logging
import mimetypes
import smtplib
import os
import re
import sqlite3
import threading
from datetime import datetime, timedelta, timezone
from email.header import decode_header
from uuid import uuid4

from src.backend.db import DB_PATH, serialize_json_field, compute_system_tags, get_next_sync_version
from src.backend.rules_engine import dispatch_trigger
from src.backend.routes.bundles import classify_email_into_bundle, classify_email_into_bundles, classify_email_auto_bundles, ensure_auto_bundles_exist

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════
# Crypto helpers — Fernet encryption with graceful base64 fallback
# ═══════════════════════════════════════════════════════════════════════════

# Try to import cryptography; fall back to base64 obfuscation if unavailable
try:
    from cryptography.fernet import Fernet
    _HAS_FERNET = True
except ImportError:
    _HAS_FERNET = False
    logger.warning(
        "cryptography package not available — email passwords will use "
        "base64 encoding (NOT secure). Install cryptography for production use."
    )

# Key file paths: production first, dev fallback
_KEY_PATH_PRODUCTION = "/app/data/email.key"
_KEY_PATH_DEV = os.path.join("data", "email.key")


def _get_key_path() -> str:
    """Return the appropriate key file path for the current environment."""
    prod_dir = os.path.dirname(_KEY_PATH_PRODUCTION)
    if os.path.isdir(prod_dir):
        return _KEY_PATH_PRODUCTION
    return _KEY_PATH_DEV


def _get_or_create_fernet_key() -> bytes:
    """Load the Fernet key from disk, or generate and save a new one.

    Production path: /app/data/email.key
    Dev fallback:    data/email.key  (if /app/data/ doesn't exist)
    """
    key_path = _get_key_path()

    # Try to load existing key
    if os.path.exists(key_path):
        with open(key_path, "rb") as f:
            key = f.read().strip()
        if key:
            return key

    # Generate a new key
    if _HAS_FERNET:
        key = Fernet.generate_key()
    else:
        # For the base64 fallback we still need a key-shaped value so the
        # interface stays consistent, but it isn't used for real crypto.
        key = base64.urlsafe_b64encode(os.urandom(32))

    # Ensure the directory exists
    key_dir = os.path.dirname(key_path)
    if key_dir:
        os.makedirs(key_dir, exist_ok=True)

    with open(key_path, "wb") as f:
        f.write(key)

    logger.info("Generated new email encryption key at %s", key_path)
    return key


def _get_fernet():
    """Return a Fernet instance, or None if cryptography is unavailable.

    When Fernet is unavailable the encrypt/decrypt helpers fall back to
    plain base64 encoding (logged as a warning on import).
    """
    if not _HAS_FERNET:
        return None
    key = _get_or_create_fernet_key()
    return Fernet(key)


def _encrypt_password(plaintext: str) -> str:
    """Encrypt a password string for storage.

    Uses Fernet symmetric encryption when the cryptography package is
    available.  Falls back to base64 encoding on dev machines where
    cryptography is not installed.
    """
    fernet = _get_fernet()
    if fernet is not None:
        token = fernet.encrypt(plaintext.encode("utf-8"))
        return token.decode("utf-8")

    # Base64 fallback (NOT secure — dev only)
    logger.warning("Using base64 fallback for password encryption (not secure)")
    return base64.b64encode(plaintext.encode("utf-8")).decode("utf-8")


def _decrypt_password(ciphertext: str) -> str:
    """Decrypt a stored password string.

    Uses Fernet symmetric decryption when the cryptography package is
    available.  Falls back to base64 decoding on dev machines.
    """
    fernet = _get_fernet()
    if fernet is not None:
        plaintext = fernet.decrypt(ciphertext.encode("utf-8"))
        return plaintext.decode("utf-8")

    # Base64 fallback
    logger.warning("Using base64 fallback for password decryption (not secure)")
    return base64.b64decode(ciphertext.encode("utf-8")).decode("utf-8")


# ═══════════════════════════════════════════════════════════════════════════
# Tracking Pixel & External Content Stripping
# ═══════════════════════════════════════════════════════════════════════════


def _strip_tracking_pixels(html: str) -> str:
    """Remove 1x1 and 1x2 pixel tracking images from HTML email content.

    Detects tracking pixels by:
    - Explicit width/height attributes of 1 or 2 (any combination)
    - Inline style with width/height of 1px or 2px
    - Images with no alt text and very small dimensions

    Returns the HTML with tracking pixel <img> tags removed.
    """
    if not html:
        return html

    # Pattern 1: <img> with width="1" height="1" (or 2) in attributes
    # Matches any img tag where both width and height are 1 or 2
    def _is_tracking_pixel(match):
        tag = match.group(0)
        # Check explicit width/height attributes
        w_attr = re.search(r'\bwidth\s*=\s*["\']?([12])\b', tag, re.IGNORECASE)
        h_attr = re.search(r'\bheight\s*=\s*["\']?([12])\b', tag, re.IGNORECASE)
        if w_attr and h_attr:
            return True
        # Check inline style for width:1px/2px and height:1px/2px
        style_match = re.search(r'style\s*=\s*["\']([^"\']*)["\']', tag, re.IGNORECASE)
        if style_match:
            style = style_match.group(1)
            w_style = re.search(r'width\s*:\s*[12]px', style, re.IGNORECASE)
            h_style = re.search(r'height\s*:\s*[12]px', style, re.IGNORECASE)
            if w_style and h_style:
                return True
        return False

    # Find all <img> tags and remove tracking pixels
    def _replace_pixel(match):
        if _is_tracking_pixel(match):
            return ''  # Remove the tracking pixel
        return match.group(0)

    result = re.sub(r'<img\b[^>]*/?>', _replace_pixel, html, flags=re.IGNORECASE)
    return result


def _strip_external_content(html: str) -> str:
    """Replace all external image sources with a placeholder.

    Replaces remote <img src="http..."> with a data URI placeholder,
    preserving the tag structure so a "Load external content" action
    can restore them on the frontend.

    Stores the original src in a data-original-src attribute.
    """
    if not html:
        return html

    def _replace_external_img(match):
        tag = match.group(0)
        src_match = re.search(r'src\s*=\s*["\']?(https?://[^"\'>\s]+)["\']?', tag, re.IGNORECASE)
        if not src_match:
            return tag  # No external src, leave as-is
        original_src = src_match.group(1)
        # Replace src with a 1x1 transparent placeholder and store original
        placeholder = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
        new_tag = tag[:src_match.start(1)] + placeholder + tag[src_match.end(1):]
        # Add data-original-src attribute
        new_tag = new_tag.replace('<img', '<img data-original-src="' + original_src + '"', 1)
        return new_tag

    result = re.sub(r'<img\b[^>]*/?>', _replace_external_img, html, flags=re.IGNORECASE)
    return result


def _get_user_email_privacy_settings(cursor, user_id: str) -> dict:
    """Fetch email privacy settings for a user.

    Returns dict with keys:
      block_tracking_pixels: bool
      external_content: str ('block', 'allow', 'known_senders')
      read_receipts: str ('never', 'always', 'ask', 'contacts_only')
      undo_send_delay: int (seconds)
    """
    cursor.execute(
        "SELECT email_block_tracking_pixels, email_external_content, "
        "email_read_receipts, email_undo_send_delay FROM settings WHERE user_id = ?",
        (user_id,)
    )
    row = cursor.fetchone()
    if not row:
        return {
            "block_tracking_pixels": True,
            "external_content": "allow",
            "read_receipts": "never",
            "undo_send_delay": 5,
        }
    return {
        "block_tracking_pixels": row[0] != "0",
        "external_content": row[1] or "allow",
        "read_receipts": row[2] or "never",
        "undo_send_delay": int(row[3] or 5),
    }


# ═══════════════════════════════════════════════════════════════════════════
# IMAP connection and sync functions
# ═══════════════════════════════════════════════════════════════════════════


def _unwrap_json_list(val) -> list:
    """Unwrap a potentially double/triple-encoded JSON list.

    Handles cases like:
      '["addr@x.com"]'                          → ["addr@x.com"]
      ["[\\"addr@x.com\\"]"]                     → ["addr@x.com"]
      ["[\\"Name <addr@x.com>\\"]"]              → ["Name <addr@x.com>"]
      '[]'                                       → []
      None                                       → []
    """
    import json as _json
    if val is None:
        return []
    # If it's a raw string, try to parse it
    if isinstance(val, str):
        try:
            val = _json.loads(val)
        except (ValueError, TypeError):
            return [val] if val.strip() else []
    if not isinstance(val, list):
        return [val] if val else []
    # Unwrap: if every element is a string that looks like a JSON array, parse it
    # Keep unwrapping until stable
    changed = True
    while changed:
        changed = False
        if len(val) == 1 and isinstance(val[0], str) and val[0].strip().startswith("["):
            try:
                inner = _json.loads(val[0])
                if isinstance(inner, list):
                    val = inner
                    changed = True
            except (ValueError, TypeError):
                pass
    return val


def _connect_imap(account: dict) -> imaplib.IMAP4_SSL:
    """Connect and authenticate to the configured IMAP server.

    Supports SSL/TLS (default, port 993) and STARTTLS (port 143).
    The ``imap_security`` field controls the connection mode:
      - "ssl" (default): Use IMAP4_SSL (implicit TLS)
      - "starttls": Use IMAP4 then upgrade with STARTTLS
      - "none": Use IMAP4 without encryption (not recommended)

    Args:
        account: dict with keys ``imap_host``, ``imap_port``, ``username``,
                 ``imap_security``, and ``password_encrypted`` (or ``password``).

    Returns:
        An authenticated IMAP connection with INBOX selected.

    Raises:
        imaplib.IMAP4.error: on authentication or connection failure.
    """
    host = account.get("imap_host", "imap.gmail.com")
    port = int(account.get("imap_port", 993))
    security = account.get("imap_security", "ssl")

    # Set a socket-level timeout (60s) to prevent hanging on unresponsive servers
    import socket
    _IMAP_TIMEOUT = 60

    if security == "starttls":
        imap = imaplib.IMAP4(host, port)
        imap.socket().settimeout(_IMAP_TIMEOUT)
        imap.starttls()
    elif security == "none":
        imap = imaplib.IMAP4(host, port)
        imap.socket().settimeout(_IMAP_TIMEOUT)
    else:
        # Default: SSL/TLS
        imap = imaplib.IMAP4_SSL(host, port, timeout=_IMAP_TIMEOUT)

    # Decrypt the stored password (or use plaintext if provided directly)
    password = account.get("password")
    if not password:
        password = _decrypt_password(account.get("password_encrypted", ""))

    username = account.get("username", account.get("email", ""))
    imap.login(username, password)
    imap.select("INBOX")
    return imap


def _get_last_sync_date(cursor, owner_id: str) -> str:
    """Query the most recent ``email_date`` for this user's email chits.

    Returns an IMAP-compatible date string (e.g. ``"01-Jan-2025"``) for use
    with ``SEARCH SINCE``.  If no email chits exist yet, returns a date 30
    days in the past as a reasonable default window.
    """
    cursor.execute(
        "SELECT MAX(email_date) FROM chits WHERE email_message_id IS NOT NULL AND deleted != 1"
    )
    row = cursor.fetchone()
    if row and row[0]:
        try:
            dt = datetime.fromisoformat(row[0])
            return dt.strftime("%d-%b-%Y")
        except (ValueError, TypeError):
            pass

    # Default: 30 days ago
    fallback = datetime.now(timezone.utc) - timedelta(days=30)
    return fallback.strftime("%d-%b-%Y")


def _fetch_new_messages(imap, since_date: str, max_fetch: int = 50, offset: int = 0) -> list:
    """Fetch messages from IMAP.

    Args:
        imap: An authenticated ``imaplib.IMAP4_SSL`` with a mailbox selected.
        since_date: IMAP date string (unused — kept for API compat).
        max_fetch: Maximum number of messages to fetch in this batch.
        offset: Number of newest messages to skip (for paging).

    Returns:
        A list of ``(raw_bytes, flags_bytes)`` tuples — one per message.
    """
    # Use UID SEARCH ALL to get all messages — Gmail's SINCE search returns
    # stale results. UIDs are stable. Don't close/re-select as that corrupts
    # subsequent fetches.
    _fetch_log = []
    _fetch_log.append(f"Starting UID SEARCH ALL")
    status, data = imap.uid('search', None, "ALL")
    _fetch_log.append(f"UID SEARCH ALL: status={status}, data_len={len(data) if data else 0}, data[0]_len={len(data[0]) if data and data[0] else 0}")
    if status != "OK" or not data or not data[0]:
        _fetch_log.append("SEARCH returned nothing, returning empty")
        # Store log in module-level var for sync-status to read
        global _last_fetch_log
        _last_fetch_log = _fetch_log
        return []

    # Reverse UIDs so newest messages are fetched first
    uids = data[0].split()
    _fetch_log.append(f"Total UIDs from SEARCH: {len(uids)}")
    _fetch_log.append(f"First 3 UIDs: {uids[:3]}, Last 3 UIDs: {uids[-3:]}")
    uids.reverse()

    # Limit to max_fetch messages starting from offset (newest first)
    uids = uids[offset:offset + max_fetch]
    _fetch_log.append(f"After reverse+slice (offset={offset}, max={max_fetch}): fetching {len(uids)} UIDs")

    messages = []
    fetch_errors = 0
    for i, uid in enumerate(uids):
        # Fetch using UID command for stability
        status, msg_data = imap.uid('fetch', uid, "(BODY.PEEK[] FLAGS)")
        if status != "OK" or not msg_data:
            fetch_errors += 1
            if i < 3:
                _fetch_log.append(f"  UID {uid}: FETCH FAILED status={status}")
            continue

        raw_bytes = None
        flags_bytes = b""
        for part in msg_data:
            if isinstance(part, tuple):
                # The tuple contains (envelope, body_bytes)
                raw_bytes = part[1]
                # The envelope string often contains FLAGS info
                envelope = part[0]
                if isinstance(envelope, bytes):
                    flags_bytes = envelope
            elif isinstance(part, bytes):
                # Sometimes FLAGS come as a separate bytes element
                if b"FLAGS" in part:
                    flags_bytes = part

        if raw_bytes:
            messages.append((raw_bytes, flags_bytes))
            if i < 3:
                _fetch_log.append(f"  UID {uid}: OK, {len(raw_bytes)} bytes, starts_with={raw_bytes[:60]}")
        else:
            fetch_errors += 1
            if i < 3:
                _fetch_log.append(f"  UID {uid}: raw_bytes is None, msg_data={repr(msg_data)[:200]}")

    _fetch_log.append(f"Done: {len(messages)} messages fetched, {fetch_errors} errors")
    _last_fetch_log = _fetch_log
    return messages


# Module-level var to store fetch debug log
_last_fetch_log = []


# ═══════════════════════════════════════════════════════════════════════════
# Email parsing functions
# ═══════════════════════════════════════════════════════════════════════════


def _decode_header_value(value):
    """Decode an RFC 2047 encoded header value into a plain string."""
    if value is None:
        return ""
    decoded_parts = decode_header(value)
    result = []
    for part, charset in decoded_parts:
        if isinstance(part, bytes):
            result.append(part.decode(charset or "utf-8", errors="replace"))
        else:
            result.append(part)
    return "".join(result)


def _parse_email_message(raw_bytes: bytes) -> dict:
    """Parse a raw RFC 2822 email message into a dict of chit-ready fields.

    Extracts: From, To, Cc, Subject, Date, Message-ID, In-Reply-To,
    References headers, and the plain-text body.

    Returns:
        A dict with keys: ``email_from``, ``email_to`` (list), ``email_cc``
        (list), ``email_subject``, ``email_date`` (ISO 8601), ``email_message_id``,
        ``email_in_reply_to``, ``email_references``, ``email_body_text``,
        ``email_read``, ``start_datetime``.
    """
    msg = email.message_from_bytes(raw_bytes, policy=email.policy.default)

    # Extract and decode headers
    from_addr = _decode_header_value(msg.get("From", ""))
    subject = _decode_header_value(msg.get("Subject", ""))
    message_id = msg.get("Message-ID", "")
    in_reply_to = msg.get("In-Reply-To", "")
    references = msg.get("References", "")

    # Parse To and Cc into lists of addresses
    to_raw = _decode_header_value(msg.get("To", ""))
    cc_raw = _decode_header_value(msg.get("Cc", ""))
    email_to = [addr.strip() for addr in to_raw.split(",") if addr.strip()] if to_raw else []
    email_cc = [addr.strip() for addr in cc_raw.split(",") if addr.strip()] if cc_raw else []

    # Parse the Date header into ISO 8601
    date_str = msg.get("Date", "")
    email_date = ""
    point_in_time = ""
    if date_str:
        try:
            parsed_date = email.utils.parsedate_to_datetime(date_str)
            email_date = parsed_date.isoformat()
            point_in_time = parsed_date.isoformat()
        except (ValueError, TypeError):
            # Fall back to storing the raw date string
            email_date = date_str
            point_in_time = date_str

    # Extract body text
    body_text = _extract_text_from_message(msg)

    # Extract HTML body (for rich rendering)
    body_html = _extract_html_from_message(msg)

    # Extract file attachments
    extracted_attachments = _extract_attachments_from_message(msg)

    # Detect auto-bundle signals
    has_list_unsubscribe = bool(msg.get("List-Unsubscribe", ""))
    has_calendar_attachment = _has_calendar_part(msg)
    disposition_notification_to = msg.get("Disposition-Notification-To", "")

    return {
        "email_from": from_addr,
        "email_to": email_to,
        "email_cc": email_cc,
        "email_subject": subject,
        "email_date": email_date,
        "email_message_id": message_id.strip() if message_id else "",
        "email_in_reply_to": in_reply_to.strip() if in_reply_to else "",
        "email_references": references.strip() if references else "",
        "email_body_text": body_text,
        "email_body_html": body_html,
        "point_in_time": point_in_time,
        "extracted_attachments": extracted_attachments,
        # Auto-bundle signals
        "has_list_unsubscribe": has_list_unsubscribe,
        "has_calendar_attachment": has_calendar_attachment,
        "disposition_notification_to": disposition_notification_to,
    }


def _has_calendar_part(msg) -> bool:
    """Check if the email contains a text/calendar MIME part (iCal invite)."""
    if not msg.is_multipart():
        return msg.get_content_type() == "text/calendar"
    for part in msg.walk():
        if part.get_content_type() == "text/calendar":
            return True
    return False


def _extract_text_from_message(msg) -> str:
    """Walk MIME parts and extract the best plain-text body.

    Prefers ``text/plain`` parts.  Falls back to stripping HTML tags from
    ``text/html`` parts if no plain-text part is found.
    """
    plain_parts = []
    html_parts = []

    if msg.is_multipart():
        for part in msg.walk():
            content_type = part.get_content_type()
            # Skip multipart containers and attachments
            disposition = str(part.get("Content-Disposition", ""))
            if "attachment" in disposition:
                continue
            if content_type == "text/plain":
                payload = part.get_content()
                if isinstance(payload, bytes):
                    charset = part.get_content_charset() or "utf-8"
                    payload = payload.decode(charset, errors="replace")
                plain_parts.append(payload)
            elif content_type == "text/html":
                payload = part.get_content()
                if isinstance(payload, bytes):
                    charset = part.get_content_charset() or "utf-8"
                    payload = payload.decode(charset, errors="replace")
                html_parts.append(payload)
    else:
        content_type = msg.get_content_type()
        payload = msg.get_content()
        if isinstance(payload, bytes):
            charset = msg.get_content_charset() or "utf-8"
            payload = payload.decode(charset, errors="replace")
        if content_type == "text/plain":
            plain_parts.append(payload)
        elif content_type == "text/html":
            html_parts.append(payload)

    # Prefer plain text
    if plain_parts:
        return "\n".join(plain_parts)

    # Fallback: strip HTML tags
    if html_parts:
        html_text = "\n".join(html_parts)
        return _strip_html_tags(html_text)

    return ""


def _extract_html_from_message(msg) -> str:
    """Walk MIME parts and extract the HTML body if present.

    Returns the raw HTML string, or empty string if no HTML part found.
    """
    html_parts = []

    if msg.is_multipart():
        for part in msg.walk():
            content_type = part.get_content_type()
            disposition = str(part.get("Content-Disposition", ""))
            if "attachment" in disposition:
                continue
            if content_type == "text/html":
                payload = part.get_content()
                if isinstance(payload, bytes):
                    charset = part.get_content_charset() or "utf-8"
                    payload = payload.decode(charset, errors="replace")
                html_parts.append(payload)
    else:
        content_type = msg.get_content_type()
        if content_type == "text/html":
            payload = msg.get_content()
            if isinstance(payload, bytes):
                charset = msg.get_content_charset() or "utf-8"
                payload = payload.decode(charset, errors="replace")
            html_parts.append(payload)

    return "\n".join(html_parts) if html_parts else ""


def _strip_html_tags(html: str) -> str:
    """Remove HTML tags and decode common entities, returning plain text."""
    # Remove <style> and <script> blocks entirely
    text = re.sub(r"<style[^>]*>.*?</style>", "", html, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<script[^>]*>.*?</script>", "", text, flags=re.DOTALL | re.IGNORECASE)
    # Replace <br> and <p> with newlines
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"</p>", "\n", text, flags=re.IGNORECASE)
    # Strip remaining tags
    text = re.sub(r"<[^>]+>", "", text)
    # Decode common HTML entities
    text = text.replace("&amp;", "&")
    text = text.replace("&lt;", "<")
    text = text.replace("&gt;", ">")
    text = text.replace("&quot;", '"')
    text = text.replace("&#39;", "'")
    text = text.replace("&nbsp;", " ")
    # Strip zero-width / invisible named entities
    text = text.replace("&zwnj;", "")
    text = text.replace("&zwj;", "")
    text = text.replace("&lrm;", "")
    text = text.replace("&rlm;", "")
    text = text.replace("&shy;", "")
    # Decode any remaining HTML entities (numeric and named)
    text = html_mod.unescape(text)
    # Strip zero-width / invisible Unicode characters that survived decoding
    text = re.sub(r"[\u200B\u200C\u200D\u200E\u200F\uFEFF\u00AD\u034F]", "", text)
    # Collapse excessive whitespace but preserve paragraph breaks
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()


# ═══════════════════════════════════════════════════════════════════════════
# Email attachment extraction
# ═══════════════════════════════════════════════════════════════════════════


def _extract_attachments_from_message(msg) -> list:
    """Walk MIME parts and extract file attachments.

    Returns a list of dicts: ``[{filename, content_bytes, mime_type, size}]``.
    Only extracts parts with ``Content-Disposition: attachment`` or inline
    parts that are not text/html/plain (e.g. inline images).
    """
    attachments = []
    if not msg.is_multipart():
        return attachments

    for part in msg.walk():
        content_type = part.get_content_type()
        disposition = str(part.get("Content-Disposition", ""))

        # Skip multipart containers
        if content_type.startswith("multipart/"):
            continue

        # Identify attachments: explicit attachment disposition, or non-text inline parts
        is_attachment = "attachment" in disposition
        is_inline_file = (
            "inline" in disposition
            and content_type not in ("text/plain", "text/html")
        )

        if not is_attachment and not is_inline_file:
            continue

        try:
            payload = part.get_payload(decode=True)
            if payload is None:
                continue
        except Exception:
            continue

        # Extract filename from Content-Disposition or Content-Type
        filename = part.get_filename()
        if filename:
            filename = _decode_header_value(filename)
        if not filename:
            # Generate a name from the content type
            ext = mimetypes.guess_extension(content_type) or ""
            filename = f"attachment{ext}"

        attachments.append({
            "filename": filename,
            "content_bytes": payload,
            "mime_type": content_type,
            "size": len(payload),
        })

    return attachments


def _save_email_attachments(chit_id: str, extracted: list) -> list:
    """Save extracted email attachment files to disk and return metadata list.

    Uses the same storage layout as manual uploads:
    ``/app/data/attachments/{chit_id}/{uuid}_{filename}``

    Args:
        chit_id: The chit ID to store attachments under.
        extracted: List of dicts from ``_extract_attachments_from_message``.

    Returns:
        A list of attachment metadata dicts (same schema as manual uploads):
        ``[{id, filename, size, mime_type, uploaded_at}]``
    """
    from src.backend.routes.attachments import _get_attachments_dir

    if not extracted:
        return []

    attachments_dir = _get_attachments_dir()
    chit_dir = os.path.join(attachments_dir, chit_id)
    os.makedirs(chit_dir, exist_ok=True)

    metadata = []
    now = datetime.now(timezone.utc).isoformat()

    for att in extracted:
        attachment_id = str(uuid4())
        safe_filename = os.path.basename(att["filename"] or "unnamed")
        stored_name = f"{attachment_id}_{safe_filename}"
        file_path = os.path.join(chit_dir, stored_name)

        try:
            with open(file_path, "wb") as f:
                f.write(att["content_bytes"])
        except Exception as e:
            logger.warning("Failed to save email attachment %s: %s", safe_filename, e)
            continue

        metadata.append({
            "id": attachment_id,
            "filename": safe_filename,
            "size": att["size"],
            "mime_type": att["mime_type"],
            "uploaded_at": now,
        })

    return metadata


# ═══════════════════════════════════════════════════════════════════════════
# Thread ID computation
# ═══════════════════════════════════════════════════════════════════════════


def _compute_thread_id(message_id: str, in_reply_to: str, references: str) -> str:
    """Compute the thread_id for an email message.

    The thread_id is the root message-ID of the conversation:
    1. First entry in the References header (the original message that started the thread)
    2. Fallback: the In-Reply-To message-ID
    3. Fallback: the email's own Message-ID (it IS the thread root)

    This gives every email in a conversation the same thread_id,
    allowing O(1) groupBy on the client.
    """
    # References header lists message-IDs oldest-first, so first = root
    if references:
        refs = references.split()
        if refs:
            return refs[0].strip()

    # No references but has in-reply-to — use that as the thread root
    if in_reply_to:
        return in_reply_to

    # This message is the thread root
    return message_id


# ═══════════════════════════════════════════════════════════════════════════
# Chit creation from parsed email
# ═══════════════════════════════════════════════════════════════════════════


def _create_email_chit(cursor, parsed: dict, owner_id: str, account_id: str = None, account_nickname: str = None) -> str | None:
    """Insert a new chit from a parsed email message.

    Performs deduplication by checking ``email_message_id`` before inserting.

    Args:
        cursor: An active SQLite cursor (caller manages the transaction).
        parsed: Dict returned by ``_parse_email_message``.
        owner_id: The user/owner ID for the chit.
        account_id: The email account ID this message belongs to.
        account_nickname: The account's nickname for system tag assignment.

    Returns:
        The new chit ID if inserted, or ``None`` if the message was a
        duplicate.
    """
    message_id = parsed.get("email_message_id", "")

    # Deduplication: skip if this Message-ID already exists
    if message_id:
        cursor.execute(
            "SELECT id FROM chits WHERE email_message_id = ? AND (deleted = 0 OR deleted IS NULL)",
            (message_id,),
        )
        if cursor.fetchone():
            return None

    chit_id = str(uuid4())
    now = datetime.now(timezone.utc).isoformat()

    # Compute system tags using a lightweight namespace object
    class _ChitProxy:
        """Minimal proxy so compute_system_tags can use getattr."""
        pass

    proxy = _ChitProxy()
    proxy.due_datetime = None
    proxy.start_datetime = None
    proxy.point_in_time = parsed.get("point_in_time") or None
    proxy.end_datetime = None
    proxy.checklist = None
    proxy.alarm = None
    proxy.notification = None
    proxy.tags = []
    proxy.status = None
    proxy.habit = False
    proxy.title = parsed.get("email_subject", "")
    proxy.email_message_id = message_id
    proxy.email_status = "received"
    proxy.email_folder = "inbox"

    tags = compute_system_tags(proxy)

    # Add account nickname as a system tag for filtering/rules
    if account_nickname:
        tags.append(f"CWOC_System/Email/Account/{account_nickname}")

    tags_json = serialize_json_field(tags)

    # Serialize list fields as JSON
    email_to_json = serialize_json_field(parsed.get("email_to", []))
    email_cc_json = serialize_json_field(parsed.get("email_cc", []))

    # Save email attachments to disk and get metadata
    extracted_attachments = parsed.get("extracted_attachments", [])
    attachment_metadata = _save_email_attachments(chit_id, extracted_attachments)
    attachments_json = serialize_json_field(attachment_metadata) if attachment_metadata else None

    # Compute thread_id from references/in-reply-to chain
    in_reply_to = (parsed.get("email_in_reply_to", "") or "").strip()
    references = (parsed.get("email_references", "") or "").strip()
    thread_id = _compute_thread_id(message_id, in_reply_to, references)

    # Assign sync_version for mobile sync tracking
    sync_version = get_next_sync_version(cursor)

    cursor.execute(
        """INSERT INTO chits (
            id, title, tags, point_in_time,
            created_datetime, modified_datetime,
            owner_id,
            email_message_id, email_from, email_to, email_cc,
            email_subject, email_body_text, email_body_html, email_date,
            email_folder, email_status, email_read,
            email_in_reply_to, email_references,
            email_account_id,
            attachments,
            thread_id,
            deleted, archived, pinned,
            sync_version
        ) VALUES (
            ?, ?, ?, ?,
            ?, ?,
            ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?,
            ?, ?,
            ?,
            ?,
            ?,
            ?, ?, ?,
            ?
        )""",
        (
            chit_id,
            parsed.get("email_subject", "(No Subject)"),
            tags_json,
            parsed.get("point_in_time") or None,
            now,
            now,
            owner_id,
            message_id,
            parsed.get("email_from", ""),
            email_to_json,
            email_cc_json,
            parsed.get("email_subject", ""),
            parsed.get("email_body_text", ""),
            parsed.get("email_body_html", "") or None,
            parsed.get("email_date", ""),
            "inbox",
            "received",
            parsed.get("email_read", False),
            parsed.get("email_in_reply_to", ""),
            parsed.get("email_references", ""),
            account_id,
            attachments_json,
            thread_id,
            False,
            False,
            False,
            sync_version,
        ),
    )
    return chit_id


# ═══════════════════════════════════════════════════════════════════════════
# Backfill estimation
# ═══════════════════════════════════════════════════════════════════════════


def _estimate_backfill(account: dict) -> dict:
    """Connect to IMAP and estimate the total mailbox size.

    Args:
        account: Email account credentials dict.

    Returns:
        ``{"message_count": int, "estimated_mb": float}`` where
        ``estimated_mb`` assumes ~50 KB per message.
    """
    imap = None
    try:
        imap = _connect_imap(account)
        # SELECT already done in _connect_imap; get message count
        status, data = imap.search(None, "ALL")
        if status != "OK" or not data or not data[0]:
            return {"message_count": 0, "estimated_mb": 0.0}

        message_count = len(data[0].split())
        # Estimate ~50 KB per message
        estimated_mb = round(message_count * 50 / 1024, 1)
        return {"message_count": message_count, "estimated_mb": estimated_mb}
    finally:
        if imap:
            try:
                imap.logout()
            except Exception:
                pass


# ═══════════════════════════════════════════════════════════════════════════
# SMTP connection and send functions
# ═══════════════════════════════════════════════════════════════════════════


def _connect_smtp(account: dict) -> smtplib.SMTP:
    """Connect and authenticate to the configured SMTP server.

    Supports STARTTLS (default, port 587), SSL/TLS (port 465), and
    unencrypted (not recommended). The ``smtp_security`` field controls mode:
      - "starttls" (default): Connect plain then upgrade with STARTTLS
      - "ssl": Use SMTP_SSL (implicit TLS, typically port 465)
      - "none": No encryption (not recommended)

    Args:
        account: dict with keys ``smtp_host``, ``smtp_port``, ``username``,
                 ``smtp_security``, and ``password_encrypted`` (or ``password``).

    Returns:
        An authenticated SMTP connection ready to send.

    Raises:
        smtplib.SMTPAuthenticationError: on authentication failure.
        smtplib.SMTPConnectError: on connection failure.
    """
    host = account.get("smtp_host", "smtp.gmail.com")
    port = int(account.get("smtp_port", 587))
    security = account.get("smtp_security", "starttls")

    if security == "ssl":
        smtp = smtplib.SMTP_SSL(host, port, timeout=15)
        smtp.ehlo()
    elif security == "none":
        smtp = smtplib.SMTP(host, port, timeout=15)
        smtp.ehlo()
    else:
        # Default: STARTTLS
        smtp = smtplib.SMTP(host, port, timeout=15)
        smtp.ehlo()
        smtp.starttls()
        smtp.ehlo()

    # Decrypt the stored password (or use plaintext if provided directly)
    password = account.get("password")
    if not password:
        password = _decrypt_password(account.get("password_encrypted", ""))

    username = account.get("username", account.get("email", ""))
    smtp.login(username, password)
    return smtp


def _build_rfc2822_message(chit: dict, account: dict) -> email.message.EmailMessage:
    """Construct a valid RFC 2822 email message from chit fields.

    Uses Python's ``email.message.EmailMessage`` to build a standards-
    compliant message with all required headers.

    Args:
        chit: dict with email fields (``email_to``, ``email_cc``, ``email_bcc``,
              ``email_subject``, ``email_body_text``, ``email_in_reply_to``,
              ``email_references``).
        account: dict with ``email`` and ``display_name`` for the From header.

    Returns:
        A fully constructed ``email.message.EmailMessage`` ready to send.
    """
    msg = email.message.EmailMessage()

    # From header — use display name if available
    display_name = account.get("display_name", "")
    from_addr = account.get("email", account.get("username", ""))
    if display_name:
        msg["From"] = email.utils.formataddr((display_name, from_addr))
    else:
        msg["From"] = from_addr

    # To header — accept list or comma-separated string
    to_addrs = chit.get("email_to", [])
    if isinstance(to_addrs, str):
        to_addrs = [a.strip() for a in to_addrs.split(",") if a.strip()]
    if to_addrs:
        msg["To"] = ", ".join(to_addrs)

    # Cc header
    cc_addrs = chit.get("email_cc", [])
    if isinstance(cc_addrs, str):
        cc_addrs = [a.strip() for a in cc_addrs.split(",") if a.strip()]
    if cc_addrs:
        msg["Cc"] = ", ".join(cc_addrs)

    # Bcc header — included in the message object for sendmail envelope,
    # but most MTAs strip it before delivery
    bcc_addrs = chit.get("email_bcc", [])
    if isinstance(bcc_addrs, str):
        bcc_addrs = [a.strip() for a in bcc_addrs.split(",") if a.strip()]
    if bcc_addrs:
        msg["Bcc"] = ", ".join(bcc_addrs)

    # Subject
    msg["Subject"] = chit.get("email_subject", "")

    # Date — current time in RFC 2822 format
    msg["Date"] = email.utils.formatdate(localtime=True)

    # Message-ID — generate a unique one
    domain = from_addr.split("@")[-1] if "@" in from_addr else "localhost"
    msg["Message-ID"] = email.utils.make_msgid(domain=domain)

    # Threading headers for replies
    in_reply_to = chit.get("email_in_reply_to", "")
    if in_reply_to:
        msg["In-Reply-To"] = in_reply_to

    references = chit.get("email_references", "")
    if references:
        msg["References"] = references

    # Read receipt request (Disposition-Notification-To header)
    if chit.get("email_request_read_receipt"):
        msg["Disposition-Notification-To"] = from_addr

    # Body — plain text + HTML alternative (markdown → HTML)
    # The email body is written as markdown in the frontend. We always send
    # a multipart/alternative with both plain text and rendered HTML.
    body = chit.get("email_body_text", "")
    signature = account.get("signature", "")

    # Detect PGP-encrypted body — send as plain text only (no HTML conversion)
    is_pgp_encrypted = body.strip().startswith("-----BEGIN PGP MESSAGE-----")

    if is_pgp_encrypted:
        # PGP-encrypted messages are sent as plain text only.
        # No signature appended (it would be outside the encrypted envelope).
        msg.set_content(body)
    else:
        # Build plain text version (with signature if not already present)
        plain_body = body
        if signature and "\n--\n" not in body:
            plain_body = body + "\n\n--\n" + signature
        msg.set_content(plain_body)

        # Build HTML version — convert markdown body + signature to HTML
        try:
            # Split body from any existing signature separator
            if "\n--\n" in plain_body:
                body_parts = plain_body.split("\n--\n", 1)
                body_text = body_parts[0]
                sig_text = body_parts[1] if len(body_parts) > 1 else ""
            else:
                body_text = plain_body
                sig_text = ""

            html_body_content = _markdown_to_html(body_text) if body_text.strip() else ""
            html_sig = ""
            if sig_text.strip():
                html_sig = "<br><br>--<br>" + _markdown_to_html(sig_text)

            html_full = (
                '<div style="font-family:sans-serif;font-size:14px;line-height:1.5;">'
                + html_body_content
                + html_sig
                + '</div>'
            )
            msg.add_alternative(html_full, subtype='html')
        except Exception as e:
            logger.warning("Failed to add HTML alternative: %s", e)

    return msg


def _markdown_to_html(md_text: str) -> str:
    """Convert a markdown string to HTML using a minimal converter.

    Handles: **bold**, *italic*, [text](url), `inline code`, headers (# to ###),
    unordered lists (- item), blockquotes (> text), and single newlines as <br>.
    No external dependencies — uses regex substitution.
    """
    import html as _html_mod
    text = _html_mod.escape(md_text)

    # Process line-by-line for block-level elements
    lines = text.split('\n')
    result_lines = []
    in_ul = False
    in_ol = False

    for line in lines:
        stripped = line.strip()

        # Headers: ### h3, ## h2, # h1
        if stripped.startswith('### '):
            if in_ul: result_lines.append('</ul>'); in_ul = False
            if in_ol: result_lines.append('</ol>'); in_ol = False
            result_lines.append('<h3>' + stripped[4:] + '</h3>')
            continue
        if stripped.startswith('## '):
            if in_ul: result_lines.append('</ul>'); in_ul = False
            if in_ol: result_lines.append('</ol>'); in_ol = False
            result_lines.append('<h2>' + stripped[3:] + '</h2>')
            continue
        if stripped.startswith('# '):
            if in_ul: result_lines.append('</ul>'); in_ul = False
            if in_ol: result_lines.append('</ol>'); in_ol = False
            result_lines.append('<h1>' + stripped[2:] + '</h1>')
            continue

        # Unordered list items: - item or * item
        if re.match(r'^[-*]\s+', stripped):
            if in_ol: result_lines.append('</ol>'); in_ol = False
            if not in_ul:
                result_lines.append('<ul>')
                in_ul = True
            result_lines.append('<li>' + stripped[2:].strip() + '</li>')
            continue

        # Ordered list items: 1. item, 2. item, etc.
        ol_match = re.match(r'^(\d+)\.\s+', stripped)
        if ol_match:
            if in_ul: result_lines.append('</ul>'); in_ul = False
            if not in_ol:
                result_lines.append('<ol>')
                in_ol = True
            result_lines.append('<li>' + stripped[ol_match.end():] + '</li>')
            continue

        # Blockquote: > text
        if stripped.startswith('&gt; '):
            if in_ul: result_lines.append('</ul>'); in_ul = False
            if in_ol: result_lines.append('</ol>'); in_ol = False
            result_lines.append('<blockquote>' + stripped[5:] + '</blockquote>')
            continue

        # Close lists if we hit a non-list line
        if in_ul: result_lines.append('</ul>'); in_ul = False
        if in_ol: result_lines.append('</ol>'); in_ol = False

        result_lines.append(line)

    if in_ul: result_lines.append('</ul>')
    if in_ol: result_lines.append('</ol>')

    text = '\n'.join(result_lines)

    # Inline formatting
    # Strikethrough: ~~text~~ (must come before bold to avoid conflicts)
    text = re.sub(r'~~(.+?)~~', r'<del>\1</del>', text)
    # Bold: **text**
    text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)
    # Italic: *text*
    text = re.sub(r'\*(.+?)\*', r'<em>\1</em>', text)
    # Inline code: `text`
    text = re.sub(r'`(.+?)`', r'<code>\1</code>', text)
    # Links: [text](url)
    text = re.sub(r'\[(.+?)\]\((.+?)\)', r'<a href="\2">\1</a>', text)
    # Horizontal rule: --- or ***
    text = re.sub(r'^(---|\*\*\*)$', '<hr>', text, flags=re.MULTILINE)
    # Single newlines → <br> (but not after block elements)
    text = re.sub(r'(?<!</h[123]>)(?<!</ul>)(?<!</li>)(?<!</blockquote>)(?<!</hr>)\n(?!<)', '<br>\n', text)
    return text


def _send_email(smtp: smtplib.SMTP, message: email.message.EmailMessage, from_addr: str) -> str:
    """Send an email message and return the server-assigned Message-ID.

    Args:
        smtp: An authenticated ``smtplib.SMTP`` connection.
        message: A fully constructed ``email.message.EmailMessage``.
        from_addr: The sender's email address for the SMTP envelope.

    Returns:
        The Message-ID string from the constructed message.
    """
    # Collect all recipient addresses for the SMTP envelope
    all_recipients = []

    to_header = message.get("To", "")
    if to_header:
        all_recipients.extend([a.strip() for a in to_header.split(",") if a.strip()])

    cc_header = message.get("Cc", "")
    if cc_header:
        all_recipients.extend([a.strip() for a in cc_header.split(",") if a.strip()])

    bcc_header = message.get("Bcc", "")
    if bcc_header:
        all_recipients.extend([a.strip() for a in bcc_header.split(",") if a.strip()])

    # Send the message
    smtp.sendmail(from_addr, all_recipients, message.as_string())

    # Return the Message-ID that was set on the message
    return message.get("Message-ID", "")


# ═══════════════════════════════════════════════════════════════════════════
# Reply and forward helpers
# ═══════════════════════════════════════════════════════════════════════════


def _add_subject_prefix(subject: str, prefix: str) -> str:
    """Add a prefix (``Re: `` or ``Fwd: ``) to a subject without doubling.

    If the subject already starts with the given prefix (case-insensitive),
    it is returned unchanged. Otherwise the prefix is prepended.

    Args:
        subject: The original subject line.
        prefix: The prefix to add, e.g. ``"Re: "`` or ``"Fwd: "``.

    Returns:
        The subject with the prefix applied exactly once.
    """
    if not subject:
        return prefix.rstrip()

    # Check if subject already starts with this prefix (case-insensitive)
    if subject.lower().startswith(prefix.lower()):
        return subject

    return f"{prefix}{subject}"


def _prepare_reply(original_chit: dict, account: dict) -> dict:
    """Create reply draft data from an original email chit.

    Sets ``email_to`` to the original sender, ``email_in_reply_to`` to the
    original Message-ID, builds the References chain, prefixes the subject
    with ``Re: `` (no doubling), and quotes the original body below a
    separator line.

    Args:
        original_chit: dict with the original email chit's fields.
        account: dict with the user's email account info.

    Returns:
        A dict of fields suitable for creating a new draft chit.
    """
    original_from = original_chit.get("email_from", "")
    original_subject = original_chit.get("email_subject", "")
    original_body = original_chit.get("email_body_text", "")
    original_message_id = original_chit.get("email_message_id", "")
    original_date = original_chit.get("email_date", "")

    # Build References chain: original references + original message-id
    original_refs = original_chit.get("email_references", "")
    if original_refs and original_message_id:
        references = f"{original_refs} {original_message_id}"
    elif original_message_id:
        references = original_message_id
    else:
        references = original_refs

    # Quote the original body
    quoted_lines = []
    if original_body:
        for line in original_body.splitlines():
            quoted_lines.append(f"> {line}")
    quoted_body = "\n".join(quoted_lines)

    # Build the reply body with separator
    separator = f"\n\n--- On {original_date}, {original_from} wrote ---\n"
    reply_body = f"{separator}{quoted_body}"

    return {
        "email_to": [original_from] if original_from else [],
        "email_cc": [],
        "email_bcc": [],
        "email_subject": _add_subject_prefix(original_subject, "Re: "),
        "email_body_text": reply_body,
        "email_in_reply_to": original_message_id,
        "email_references": references,
        "email_folder": "drafts",
        "email_status": "draft",
        "email_read": True,
    }


def _prepare_forward(original_chit: dict) -> dict:
    """Create forward draft data from an original email chit.

    Sets ``email_to`` to empty (user fills in the recipient), prefixes the
    subject with ``Fwd: `` (no doubling), and quotes the original message
    below a separator with the original headers summarized.

    Args:
        original_chit: dict with the original email chit's fields.

    Returns:
        A dict of fields suitable for creating a new draft chit.
    """
    original_from = original_chit.get("email_from", "")
    original_subject = original_chit.get("email_subject", "")
    original_body = original_chit.get("email_body_text", "")
    original_date = original_chit.get("email_date", "")

    # Format original To as a readable string
    original_to = original_chit.get("email_to", [])
    if isinstance(original_to, list):
        original_to_str = ", ".join(original_to)
    else:
        original_to_str = str(original_to)

    # Build the forwarded body with original message headers
    separator = "\n\n--- Forwarded message ---"
    header_block = (
        f"\nFrom: {original_from}"
        f"\nDate: {original_date}"
        f"\nSubject: {original_subject}"
        f"\nTo: {original_to_str}"
    )
    forward_body = f"{separator}{header_block}\n\n{original_body}"

    return {
        "email_to": [],
        "email_cc": [],
        "email_bcc": [],
        "email_subject": _add_subject_prefix(original_subject, "Fwd: "),
        "email_body_text": forward_body,
        "email_in_reply_to": "",
        "email_references": "",
        "email_folder": "drafts",
        "email_status": "draft",
        "email_read": True,
    }


# ═══════════════════════════════════════════════════════════════════════════
# FastAPI Router — Email Endpoints
# ═══════════════════════════════════════════════════════════════════════════

import json as _json

from fastapi import APIRouter, HTTPException, Request

from src.backend.db import DB_PATH, deserialize_json_field

email_router = APIRouter()

# Track whether a sync is currently running per user
_email_sync_running = {}
_email_sync_progress = {}  # Track sync progress for diagnostics


@email_router.get("/api/email/sync-debug")
def email_sync_debug():
    """Return the exhaustive sync debug log from the last sync run."""
    import json as _j
    try:
        with open("/tmp/cwoc_sync_debug.json", "r") as f:
            return _j.load(f)
    except FileNotFoundError:
        return {"error": "No sync debug log found. Run a sync first."}
    except Exception as e:
        return {"error": str(e)}


@email_router.get("/api/email/sync-status")
def email_sync_status(request: Request):
    """Check if an email sync is currently running for this user."""
    user_id = request.state.user_id
    is_running = _email_sync_running.get(user_id, False)
    progress = _email_sync_progress.get(user_id, {})
    return {"syncing": is_running, **progress}


@email_router.get("/api/email/diagnostic")
def email_diagnostic(request: Request):
    """Diagnostic endpoint: report email sync state and DB counts."""
    user_id = request.state.user_id
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # Count inbox emails (non-deleted)
        cursor.execute(
            "SELECT COUNT(*) FROM chits WHERE owner_id = ? AND email_message_id IS NOT NULL AND email_folder = 'inbox' AND (deleted = 0 OR deleted IS NULL)",
            (user_id,),
        )
        inbox_count = cursor.fetchone()[0]

        # Live IMAP: fetch 1 newest message and show raw bytes
        imap_raw_preview = None
        imap_error = None
        imap_msg_data_repr = None
        try:
            accounts = _get_all_email_accounts(cursor, user_id)
            if accounts:
                account = accounts[0]
                if account.get("password_encrypted"):
                    account["password"] = _decrypt_password(account["password_encrypted"])
                imap = _connect_imap(account)
                # UID search for all
                status, data = imap.uid('search', None, "ALL")
                if status == "OK" and data and data[0]:
                    uids = data[0].split()
                    newest_uid = uids[-1]  # highest UID = newest
                    # Fetch it
                    status2, msg_data = imap.uid('fetch', newest_uid, "(BODY.PEEK[] FLAGS)")
                    # Show the raw structure of msg_data
                    imap_msg_data_repr = repr(msg_data)[:500]
                    # Extract raw_bytes the same way _fetch_new_messages does
                    for part in msg_data:
                        if isinstance(part, tuple):
                            raw = part[1]
                            if isinstance(raw, bytes):
                                imap_raw_preview = raw[:500].decode("utf-8", errors="replace")
                            break
                imap.logout()
        except Exception as e:
            imap_error = str(e)

        return {
            "inbox_count": inbox_count,
            "imap_raw_preview": imap_raw_preview,
            "imap_msg_data_repr": imap_msg_data_repr,
            "imap_error": imap_error,
            "sync_running": _email_sync_running.get(user_id, False),
            "sync_progress": _email_sync_progress.get(user_id, {}),
        }
    except Exception as e:
        return {"error": str(e)}
    finally:
        if conn:
            conn.close()
def _get_email_account(cursor, user_id: str, account_id: str = None) -> dict:
    """Load and return an email account config for the given user.

    If account_id is provided, returns that specific account from email_accounts.
    If account_id is None, returns the first account (for backward compatibility).

    Raises HTTPException(400) if no email account is configured.
    """
    cursor.execute(
        "SELECT email_account, email_accounts FROM settings WHERE user_id = ?", (user_id,)
    )
    row = cursor.fetchone()
    if not row:
        raise HTTPException(
            status_code=400,
            detail="No email account configured. Go to Settings → Email to set up your email.",
        )

    # Try multi-account first
    accounts_json = row[1] if len(row) > 1 else None
    if accounts_json:
        accounts = deserialize_json_field(accounts_json)
        if isinstance(accounts, list) and len(accounts) > 0:
            if account_id:
                for acct in accounts:
                    if isinstance(acct, dict) and acct.get("id") == account_id:
                        return acct
                raise HTTPException(
                    status_code=400,
                    detail=f"Email account '{account_id}' not found.",
                )
            # Return first account as default
            return accounts[0]

    # Fall back to legacy single account
    old_acct_json = row[0]
    if not old_acct_json:
        raise HTTPException(
            status_code=400,
            detail="No email account configured. Go to Settings → Email to set up your email.",
        )
    account = deserialize_json_field(old_acct_json)
    if not account or not isinstance(account, dict):
        raise HTTPException(
            status_code=400,
            detail="No email account configured. Go to Settings → Email to set up your email.",
        )
    return account


def _get_all_email_accounts(cursor, user_id: str) -> list:
    """Load and return all email account configs for the given user.

    Returns a list of account dicts. Falls back to legacy single account.
    Returns empty list if no accounts configured.
    """
    cursor.execute(
        "SELECT email_account, email_accounts FROM settings WHERE user_id = ?", (user_id,)
    )
    row = cursor.fetchone()
    if not row:
        return []

    # Try multi-account first
    accounts_json = row[1] if len(row) > 1 else None
    if accounts_json:
        accounts = deserialize_json_field(accounts_json)
        if isinstance(accounts, list) and len(accounts) > 0:
            return [a for a in accounts if isinstance(a, dict) and a.get("email")]

    # Fall back to legacy single account
    old_acct_json = row[0]
    if old_acct_json:
        account = deserialize_json_field(old_acct_json)
        if isinstance(account, dict) and account.get("email"):
            return [account]

    return []


# ═══════════════════════════════════════════════════════════════════════════
# Deletion sync — detect emails removed from IMAP and soft-delete locally
# ═══════════════════════════════════════════════════════════════════════════


def _sync_deletions(imap, cursor, owner_id: str, account_id: str) -> int:
    """Check which local email chits still exist on the IMAP server.

    For each non-deleted inbox email chit belonging to *account_id*, search
    IMAP by Message-ID.  If the message is no longer present in INBOX, the
    chit is soft-deleted (``deleted = 1``, ``email_folder = 'trash'``).

    This handles the case where a user deletes an email in Gmail (or any
    IMAP provider) and expects that deletion to propagate into CWOC.

    Args:
        imap: An authenticated ``imaplib.IMAP4_SSL`` with INBOX selected.
        cursor: An active SQLite cursor (caller manages the transaction).
        owner_id: The user/owner ID.
        account_id: The email account ID to scope the check.

    Returns:
        The number of chits that were soft-deleted.
    """
    # Fetch all non-deleted inbox email chits for this account
    if account_id:
        cursor.execute(
            """SELECT id, email_message_id FROM chits
               WHERE owner_id = ?
                 AND email_account_id = ?
                 AND email_message_id IS NOT NULL
                 AND email_message_id != ''
                 AND email_folder = 'inbox'
                 AND (deleted = 0 OR deleted IS NULL)""",
            (owner_id, account_id),
        )
    else:
        cursor.execute(
            """SELECT id, email_message_id FROM chits
               WHERE owner_id = ?
                 AND email_message_id IS NOT NULL
                 AND email_message_id != ''
                 AND email_folder = 'inbox'
                 AND (deleted = 0 OR deleted IS NULL)""",
            (owner_id,),
        )

    local_emails = cursor.fetchall()  # [(chit_id, message_id), ...]
    if not local_emails:
        return 0

    logger.info("Deletion sync: checking %d local inbox emails against IMAP", len(local_emails))
    now = datetime.now(timezone.utc).isoformat()
    deleted_count = 0

    for chit_id, message_id in local_emails:
        if not message_id:
            continue
        try:
            # Search IMAP for this specific Message-ID
            # The HEADER search criterion checks the Message-ID header
            status, data = imap.search(
                None, f'HEADER Message-ID "{message_id}"'
            )
            found = status == "OK" and data and data[0] and data[0].strip()

            if not found:
                # Message no longer in INBOX — soft-delete the chit
                cursor.execute(
                    """UPDATE chits
                       SET deleted = 1,
                           email_folder = 'trash',
                           modified_datetime = ?
                       WHERE id = ?""",
                    (now, chit_id),
                )
                deleted_count += 1
                logger.info(
                    "Deletion sync: soft-deleted chit %s (Message-ID: %s)",
                    chit_id, message_id,
                )
        except Exception as e:
            # Don't let a single lookup failure abort the whole sync
            logger.warning(
                "Deletion sync: failed to check Message-ID %s: %s",
                message_id, e,
            )
            continue

    return deleted_count


# ───────────────────────────────────────────────────────────────────────────
# POST /api/email/sync — Trigger manual IMAP sync
# ───────────────────────────────────────────────────────────────────────────

@email_router.post("/api/email/sync")
def email_sync(request: Request):
    """Kick off email sync in a background thread and return immediately.

    Returns ``{"status": "syncing"}`` immediately. The actual sync runs in the
    background. The frontend will see new chits appear on the next fetchChits
    poll or WebSocket broadcast.
    """
    user_id = request.state.user_id

    # Check if a sync is already running for this user
    if _email_sync_running.get(user_id):
        return {"status": "already_syncing"}

    # Validate that accounts exist before spawning the thread
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    accounts = _get_all_email_accounts(cursor, user_id)
    conn.close()
    if not accounts:
        raise HTTPException(
            status_code=400,
            detail="No email accounts configured. Go to Settings → Email to set up your email.",
        )

    # Run the actual sync in a background thread
    threading.Thread(
        target=_email_sync_worker,
        args=(user_id,),
        daemon=True,
    ).start()

    return {"status": "syncing", "accounts": len(accounts)}


def _email_sync_worker(user_id: str):
    """Background worker that performs the actual IMAP sync.

    Runs in a daemon thread so it doesn't block the request/response cycle.
    """
    _email_sync_running[user_id] = True
    _email_sync_progress[user_id] = {"stage": "starting"}
    logger.info("[Email Sync] Background sync started for user %s", user_id)

    try:
        _do_email_sync(user_id)
    except Exception as e:
        logger.error("[Email Sync] Background sync failed for user %s: %s", user_id, e)
        _email_sync_progress[user_id] = {"stage": "error", "error": str(e)}
    finally:
        _email_sync_running[user_id] = False
        logger.info("[Email Sync] Background sync finished for user %s", user_id)


def _do_email_sync(user_id: str):
    """The actual email sync logic, extracted from the old synchronous endpoint."""
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        accounts = _get_all_email_accounts(cursor, user_id)
        if not accounts:
            logger.warning("[Email Sync] No accounts configured for user %s", user_id)
            return

        # Get shared sync settings from the first account (they share config)
        shared_max_pull = int(accounts[0].get("max_pull", 50) or 50)

        total_new = 0
        total_deleted = 0
        accounts_synced = 0
        sync_errors = []
        all_email_summaries = []
        all_email_chits = []
        sync_details = []

        for account in accounts:
            account_id = account.get("id", "")
            account_email = account.get("email", "unknown")
            imap = None

            # Decrypt the stored password for IMAP auth
            if account.get("password_encrypted"):
                account["password"] = _decrypt_password(account["password_encrypted"])

            try:
                # Connect to IMAP
                try:
                    imap = _connect_imap(account)
                except imaplib.IMAP4.error as e:
                    err_msg = str(e)
                    if "AUTHENTICATIONFAILED" in err_msg.upper() or "LOGIN" in err_msg.upper():
                        sync_errors.append(f"{account_email}: IMAP authentication failed")
                        continue
                    sync_errors.append(f"{account_email}: Cannot reach IMAP server")
                    continue
                except (OSError, ConnectionError, TimeoutError) as e:
                    sync_errors.append(f"{account_email}: Cannot reach IMAP server — {str(e)}")
                    continue
                except Exception as e:
                    sync_errors.append(f"{account_email}: IMAP error — {str(e)}")
                    continue

                # Determine sync window
                since_date = _get_last_sync_date(cursor, user_id)
                _email_sync_progress[user_id] = {"stage": "fetching", "account": account_email, "since": since_date}

                # Fetch and process messages in pages until caught up.
                # Each page fetches max_pull newest messages starting from an offset.
                # Stops when a full page is all duplicates (we've caught up).
                page_offset = 0
                new_count = 0
                skipped_dupes = 0
                batch_size = shared_max_pull
                batch_num = 0
                total_fetched = 0
                caught_up = False

                while not caught_up:
                    _email_sync_progress[user_id] = {"stage": "fetching", "account": account_email, "page": page_offset // shared_max_pull + 1, "new_so_far": new_count}
                    try:
                        messages = _fetch_new_messages(imap, since_date, max_fetch=shared_max_pull, offset=page_offset)
                        logger.info(f"[Sync] {account_email}: page {page_offset // shared_max_pull + 1}, fetched {len(messages)} messages (offset={page_offset})")
                    except Exception as e:
                        sync_errors.append(f"{account_email}: Error fetching messages — {str(e)}")
                        break

                    if not messages:
                        # No more messages to fetch
                        break

                    total_fetched += len(messages)
                    page_new = 0
                    page_dupes = 0

                    _email_sync_progress[user_id] = {"stage": "processing", "account": account_email, "imap_found": total_fetched, "page": page_offset // shared_max_pull + 1, "new_so_far": new_count}

                    for raw_bytes, flags_bytes in messages:
                        try:
                            parsed = _parse_email_message(raw_bytes)

                            # Check IMAP SEEN flag to set email_read
                            if flags_bytes and b"\\Seen" in flags_bytes:
                                parsed["email_read"] = True
                            else:
                                parsed["email_read"] = False

                            chit_id = _create_email_chit(cursor, parsed, user_id, account_id=account_id, account_nickname=account.get("nickname"))
                            if chit_id:
                                new_count += 1
                                page_new += 1
                                subj = parsed.get("email_subject", "(No Subject)")
                                sender = parsed.get("email_from", "Unknown")
                                logger.info(f"[Sync] New email: {subj} from {sender}")
                                all_email_summaries.append(f"{subj} — {sender}")
                                all_email_chits.append({"id": chit_id, **parsed, "owner_id": user_id})
                                if new_count % batch_size == 0:
                                    conn.commit()
                                    batch_num += 1
                            else:
                                skipped_dupes += 1
                                page_dupes += 1

                            # Update progress
                            _email_sync_progress[user_id] = {
                                "stage": "processing",
                                "account": account_email,
                                "total_fetched": total_fetched,
                                "processed": new_count + skipped_dupes,
                                "new": new_count,
                                "dupes": skipped_dupes,
                                "page": page_offset // shared_max_pull + 1,
                            }
                        except Exception as e:
                            logger.warning("Failed to parse/store email message: %s", e)
                            continue

                    # Commit after each page
                    conn.commit()

                    # If this entire page was duplicates, we've caught up — stop paging
                    if page_new == 0 and page_dupes > 0:
                        caught_up = True
                        logger.info(f"[Sync] {account_email}: caught up (page was all duplicates)")
                    else:
                        # Move to next page (older messages)
                        page_offset += shared_max_pull

                # Final commit
                conn.commit()
                from src.backend.db import chit_cache
                chit_cache.invalidate(user_id)
                total_new += new_count
                nickname = account.get("nickname", account_email)
                sync_details.append({
                    "account": nickname,
                    "imap_found": total_fetched,
                    "new": new_count,
                    "skipped_dupes": skipped_dupes,
                    "since": since_date
                })
                logger.info(f"[Sync] {nickname}: {new_count} new, {skipped_dupes} duplicates skipped ({total_fetched} fetched from IMAP)")

                # ── Deletion sync: detect emails removed from IMAP ────────
                _email_sync_progress[user_id] = {
                    "stage": "deletion_sync",
                    "account": account_email,
                    "new_so_far": total_new,
                    "total_fetched": total_fetched,
                    "dupes": skipped_dupes,
                }
                try:
                    acct_deleted = _sync_deletions(imap, cursor, user_id, account_id)
                    total_deleted += acct_deleted
                    if acct_deleted:
                        logger.info(
                            "Deletion sync: %d chit(s) soft-deleted for account %s",
                            acct_deleted, account_email,
                        )
                except Exception as e:
                    logger.warning(
                        "Deletion sync failed for %s: %s", account_email, e
                    )
                    sync_errors.append(
                        f"{account_email}: Deletion sync error — {str(e)}"
                    )

                accounts_synced += 1

            finally:
                if imap:
                    try:
                        imap.logout()
                    except Exception:
                        pass

        # Backfill: ensure all email chits for each account have the nickname tag
        for account in accounts:
            nickname = account.get("nickname")
            acct_id = account.get("id")
            if not nickname or not acct_id:
                continue
            target_tag = f"CWOC_System/Email/Account/{nickname}"
            try:
                cursor.execute(
                    "SELECT id, tags FROM chits WHERE email_account_id = ? AND owner_id = ? AND (deleted = 0 OR deleted IS NULL)",
                    (acct_id, user_id)
                )
                for row in cursor.fetchall():
                    chit_id_row, tags_raw = row
                    import json as _jb
                    existing_tags = _jb.loads(tags_raw) if tags_raw else []
                    if target_tag not in existing_tags:
                        existing_tags.append(target_tag)
                        cursor.execute(
                            "UPDATE chits SET tags = ? WHERE id = ?",
                            (_jb.dumps(existing_tags), chit_id_row)
                        )
            except Exception as e:
                logger.warning(f"Backfill account tag failed for {nickname}: {e}")

        # Backfill: assign orphan email chits (no email_account_id) to the first account
        if len(accounts) > 0:
            first_acct = accounts[0]
            first_id = first_acct.get("id")
            first_nickname = first_acct.get("nickname")
            if first_id:
                try:
                    cursor.execute(
                        "SELECT id, tags FROM chits WHERE (email_account_id IS NULL OR email_account_id = '') "
                        "AND email_message_id IS NOT NULL AND owner_id = ? AND (deleted = 0 OR deleted IS NULL)",
                        (user_id,)
                    )
                    orphan_rows = cursor.fetchall()
                    for row in orphan_rows:
                        chit_id_row, tags_raw = row
                        import json as _jb2
                        existing_tags = _jb2.loads(tags_raw) if tags_raw else []
                        # Assign account ID
                        update_sql = "UPDATE chits SET email_account_id = ?"
                        params = [first_id]
                        # Also add nickname tag if applicable
                        if first_nickname:
                            target_tag = f"CWOC_System/Email/Account/{first_nickname}"
                            if target_tag not in existing_tags:
                                existing_tags.append(target_tag)
                                update_sql += ", tags = ?"
                                params.append(_jb2.dumps(existing_tags))
                        update_sql += " WHERE id = ?"
                        params.append(chit_id_row)
                        cursor.execute(update_sql, params)
                    if orphan_rows:
                        logger.info(f"Backfilled {len(orphan_rows)} orphan email chits to account {first_acct.get('email', '?')}")
                except Exception as e:
                    logger.warning(f"Backfill orphan emails failed: {e}")

        conn.commit()
        chit_cache.invalidate(user_id)

        # ── Bundle classification for new email chits ─────────────────
        if all_email_chits:
            try:
                # Ensure auto-bundles exist before classification
                try:
                    ensure_auto_bundles_exist(user_id)
                except Exception as e:
                    logger.warning(f"Failed to ensure auto-bundles: {e}")

                # Read the bundles_multi_placement setting
                multi_placement = False
                try:
                    conn2 = sqlite3.connect(DB_PATH)
                    c2 = conn2.cursor()
                    c2.execute(
                        "SELECT bundles_multi_placement FROM settings WHERE user_id = ?",
                        (user_id,),
                    )
                    row = c2.fetchone()
                    if row and row[0]:
                        multi_placement = bool(row[0])
                    conn2.close()
                except Exception as e:
                    logger.warning(f"Failed to read bundles_multi_placement setting: {e}")

                for email_chit_data in all_email_chits:
                    try:
                        if multi_placement:
                            classify_email_into_bundles(email_chit_data, user_id)
                        else:
                            classify_email_into_bundle(email_chit_data, user_id)
                    except Exception as e:
                        logger.warning(
                            "Bundle classification failed for chit %s: %s",
                            email_chit_data.get("id", "?"), e,
                        )

                # Auto-bundle classification (Newsletters, Receipts, Calendar Invites)
                for email_chit_data in all_email_chits:
                    try:
                        classify_email_auto_bundles(email_chit_data, email_chit_data["id"], user_id)
                    except Exception as e:
                        logger.warning(
                            "Auto-bundle classification failed for chit %s: %s",
                            email_chit_data.get("id", "?"), e,
                        )
            except Exception as e:
                logger.warning(f"Bundle classification error: {e}")

        # ── Badge detection: scan new emails for trackable smart links ────
        if all_email_chits:
            try:
                from src.backend.badge_integration import process_badges_batch
                process_badges_batch(all_email_chits, user_id)
            except Exception as e:
                logger.warning(f"Badge detection error during sync: {e}")

        # Fire-and-forget: dispatch rules engine triggers for new email chits
        # (non-bundle "email_received" rules still fire via normal dispatch)
        try:
            for email_chit_data in all_email_chits:
                logger.info("Firing rules engine trigger: email_received for chit %s, owner %s", email_chit_data.get("id", "?"), user_id)
                threading.Thread(
                    target=dispatch_trigger,
                    args=("email_received", "chit", email_chit_data, user_id),
                    daemon=True,
                ).start()
        except Exception:
            pass

        # Send push notification for each new email individually
        # Skip ntfy if a WebSocket client is connected (the app will show its own notification)
        if total_new > 0:
            try:
                from src.backend.routes.health import _sync_hub
                ws_connected = _sync_hub.has_connections()
            except Exception:
                ws_connected = False

            if ws_connected:
                logger.info("[Email Sync] WebSocket client connected — skipping ntfy (app will notify natively)")
            else:
                try:
                    from src.backend.routes.ntfy import send_ntfy_notification
                    from src.backend.schedulers import _get_server_base_url
                    base = _get_server_base_url()
                    icon_url = f"{base}/static/cwoc-icon-192.png"

                    for email_chit in all_email_chits:
                        chit_id = email_chit.get("id", "")
                        subject = email_chit.get("title") or email_chit.get("email_subject") or "No subject"
                        sender = email_chit.get("email_from", "Unknown")
                        click_url = f"{base}/frontend/html/editor.html?id={chit_id}&expand=email"
                        send_ntfy_notification(
                            user_id=user_id,
                            title=f"📬 {sender}",
                            body=subject,
                            click_url=click_url,
                            tags="email,incoming_envelope",
                            icon_url=icon_url,
                        )
                except Exception as e:
                    logger.warning(f"Ntfy notification failed for new email: {e}")

            # Send Web Push notifications for email (with action buttons for mobile browser)
            try:
                from src.backend.routes.push import send_push_to_user
                for email_chit in all_email_chits:
                    chit_id = email_chit.get("id", "")
                    subject = email_chit.get("title") or email_chit.get("email_subject") or "No subject"
                    sender = email_chit.get("email_from", "Unknown")
                    push_payload = {
                        "title": f"📬 {sender}",
                        "body": subject,
                        "icon": "/static/cwoc-icon-192.png",
                        "badge": "/static/cwoc-icon-192.png",
                        "data": {
                            "url": f"/frontend/html/editor.html?id={chit_id}&expand=email",
                            "chitId": chit_id,
                            "type": "email",
                        },
                        "actions": [
                            {"action": "trash", "title": "Trash"},
                            {"action": "archive", "title": "Archive"},
                            {"action": "markread", "title": "Mark Read"},
                        ],
                    }
                    send_push_to_user(user_id, push_payload)
            except ImportError:
                pass  # pywebpush not available
            except Exception as e:
                logger.warning(f"Web Push notification failed for new email: {e}")

            # Store notifications ONLY for calendar invites (emails with text/calendar MIME part)
            try:
                calendar_invite_chits = [c for c in all_email_chits if c.get("has_calendar_attachment")]
                if calendar_invite_chits:
                    notif_conn = sqlite3.connect(DB_PATH)
                    notif_cursor = notif_conn.cursor()
                    now_iso = datetime.utcnow().isoformat()
                    for email_chit in calendar_invite_chits:
                        chit_id = email_chit.get("id", "")
                        subject = email_chit.get("title") or email_chit.get("email_subject") or "No subject"
                        sender = email_chit.get("email_from", "Unknown")
                        notif_cursor.execute(
                            """INSERT INTO notifications
                               (id, user_id, chit_id, chit_title, owner_display_name,
                                notification_type, status, created_datetime)
                               VALUES (?, ?, ?, ?, ?, 'calendar_invite', 'pending', ?)""",
                            (str(uuid4()), user_id, chit_id, f"📅 {sender}: {subject}", "", now_iso),
                        )
                    notif_conn.commit()
                    notif_conn.close()
            except Exception as e:
                logger.warning(f"Failed to store calendar invite notifications in DB: {e}")

            # Broadcast WebSocket "chits_changed" so the mobile app triggers an incremental sync
            try:
                import asyncio
                import time as _time
                from src.backend.routes.health import _sync_hub, _sync_messages, _sync_max_messages, _sync_event_loop
                import src.backend.routes.health as health_module

                payload = {"type": "chits_changed", "entity": "chit", "source": "email_sync"}
                msg = {"id": health_module._sync_next_id, "data": payload, "ts": _time.time()}
                health_module._sync_next_id += 1
                _sync_messages.append(msg)
                if len(_sync_messages) > _sync_max_messages:
                    _sync_messages[:] = _sync_messages[-_sync_max_messages:]

                # Schedule the async broadcast on the main event loop
                if _sync_event_loop is not None:
                    asyncio.run_coroutine_threadsafe(
                        _sync_hub.broadcast(payload, msg_id=msg["id"]),
                        _sync_event_loop
                    )
                logger.info("[Email Sync] Broadcast chits_changed to WebSocket clients")
            except Exception as e:
                logger.warning(f"[Email Sync] WebSocket broadcast failed (best-effort): {e}")

        result = {"new_count": total_new, "deleted_count": total_deleted, "accounts_synced": accounts_synced}
        if sync_errors:
            result["errors"] = sync_errors
        if all_email_summaries:
            result["imported"] = all_email_summaries[:20]
        if sync_details:
            result["details"] = sync_details

        _email_sync_progress[user_id] = {"stage": "done", "new_count": total_new, "deleted_count": total_deleted, "accounts_synced": accounts_synced, "details": sync_details, "errors": sync_errors, "fetch_log": _last_fetch_log}
        logger.info("[Email Sync] Complete: %d new, %d deleted, %d accounts", total_new, total_deleted, accounts_synced)
        if sync_errors:
            logger.warning("[Email Sync] Errors: %s", sync_errors)

    except Exception as e:
        logger.error("[Email Sync] Error: %s", e)
    finally:
        if conn:
            conn.close()


# ───────────────────────────────────────────────────────────────────────────
# POST /api/email/send/{chit_id} — Send a draft email via SMTP
# ───────────────────────────────────────────────────────────────────────────


def _do_send_email_by_id(chit_id: str, user_id: str) -> dict:
    """Internal: send a draft email chit via SMTP.

    Called by both the API endpoint and the send-later scheduler.
    Returns {"status": "sent", "email_message_id": ...} on success.
    Raises HTTPException on failure (when called from API) or raises
    generic Exception (when called from scheduler).
    """
    conn = None
    smtp_conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # Load the chit
        cursor.execute("SELECT * FROM chits WHERE id = ?", (chit_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Email chit not found.")

        chit = dict(row)

        # Verify it's a draft
        if chit.get("email_status") != "draft":
            raise HTTPException(
                status_code=400,
                detail="Cannot send: this email has already been sent.",
            )

        # Validate non-empty email_to
        email_to = chit.get("email_to")
        if email_to:
            email_to = deserialize_json_field(email_to)
        email_to = _unwrap_json_list(email_to)
        if not email_to or (isinstance(email_to, list) and len(email_to) == 0):
            raise HTTPException(
                status_code=422,
                detail="Cannot send: no recipients specified.",
            )

        # Load email account credentials
        cursor2 = conn.cursor()
        chit_account_id = chit.get("email_account_id")
        account = _get_email_account(cursor2, user_id, account_id=chit_account_id)

        # Decrypt password
        if account.get("password_encrypted"):
            account["password"] = _decrypt_password(account["password_encrypted"])

        # Build the chit dict with deserialized fields for message construction
        chit_data = dict(chit)
        chit_data["email_to"] = email_to
        chit_data["email_cc"] = deserialize_json_field(chit.get("email_cc")) or []
        chit_data["email_bcc"] = deserialize_json_field(chit.get("email_bcc")) or []

        for _fld in ("email_to", "email_cc", "email_bcc"):
            chit_data[_fld] = _unwrap_json_list(chit_data[_fld])

        logger.info(f"Sending email — To: {chit_data['email_to']}, Cc: {chit_data['email_cc']}, Bcc: {chit_data['email_bcc']}")
        logger.info(f"Sending email — Subject: {chit_data.get('email_subject', '')}")

        # Build the RFC 2822 message
        message = _build_rfc2822_message(chit_data, account)
        from_addr = account.get("email", account.get("username", ""))

        # Connect to SMTP and send
        try:
            smtp_conn = _connect_smtp(account)
            sent_message_id = _send_email(smtp_conn, message, from_addr)
        except smtplib.SMTPAuthenticationError:
            raise HTTPException(status_code=401, detail="SMTP authentication failed.")
        except (smtplib.SMTPConnectError, OSError, ConnectionError, TimeoutError) as e:
            raise HTTPException(
                status_code=502,
                detail=f"Cannot reach SMTP server {account.get('smtp_host', '?')}:{account.get('smtp_port', '?')} — {type(e).__name__}: {e}",
            )
        except smtplib.SMTPRecipientsRefused as e:
            refused = ", ".join(e.recipients.keys()) if e.recipients else "unknown"
            raise HTTPException(status_code=422, detail=f"Recipient address rejected: {refused}")
        except smtplib.SMTPDataError as e:
            if "size" in str(e).lower() or "552" in str(e):
                raise HTTPException(status_code=413, detail="Message exceeds server size limit.")
            raise HTTPException(status_code=502, detail=f"SMTP error: {str(e)}")

        # On success: update chit status and clear send_at
        now = datetime.now(timezone.utc).isoformat()

        current_tags_raw = chit.get("tags", "[]")
        current_tags = deserialize_json_field(current_tags_raw) if isinstance(current_tags_raw, str) else (current_tags_raw or [])
        updated_tags = [t for t in current_tags if not (isinstance(t, str) and t.startswith("CWOC_System/Email/"))]
        updated_tags.append("CWOC_System/Email/Sent")
        if "CWOC_System/Email" not in updated_tags:
            updated_tags.append("CWOC_System/Email")

        cursor.execute(
            """UPDATE chits
               SET email_status = 'sent',
                   email_folder = 'sent',
                   email_message_id = ?,
                   email_send_at = NULL,
                   tags = ?,
                   modified_datetime = ?
               WHERE id = ?""",
            (sent_message_id, serialize_json_field(updated_tags), now, chit_id),
        )
        conn.commit()

        return {"status": "sent", "email_message_id": sent_message_id}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Email send error: %s", e)
        raise HTTPException(status_code=500, detail=f"Email send failed: {str(e)}")
    finally:
        if smtp_conn:
            try:
                smtp_conn.quit()
            except Exception:
                pass
        if conn:
            conn.close()


@email_router.post("/api/email/send/{chit_id}")
def email_send(chit_id: str, request: Request):
    """Send a draft email chit via SMTP.

    On success, updates the chit's ``email_status`` to ``"sent"``,
    ``email_folder`` to ``"sent"``, and populates ``email_message_id``.
    """
    user_id = request.state.user_id
    # Clear any scheduled send_at since this is an immediate send
    try:
        _conn = sqlite3.connect(DB_PATH)
        _cur = _conn.cursor()
        _cur.execute("UPDATE chits SET email_send_at = NULL WHERE id = ?", (chit_id,))
        _conn.commit()
        _conn.close()
    except Exception:
        pass
    return _do_send_email_by_id(chit_id, user_id)


# ───────────────────────────────────────────────────────────────────────────
# POST /api/email/schedule/{chit_id} — Schedule an email for later sending
# ───────────────────────────────────────────────────────────────────────────


@email_router.post("/api/email/schedule/{chit_id}")
def email_schedule(chit_id: str, body: dict, request: Request):
    """Schedule a draft email to be sent at a future time.

    Body: {"send_at": "ISO 8601 datetime"}
    To cancel: {"send_at": null}
    """
    user_id = request.state.user_id
    conn = None

    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # Verify chit exists and is a draft owned by user
        cursor.execute(
            "SELECT id, email_status, owner_id FROM chits WHERE id = ?", (chit_id,)
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Email chit not found.")
        if row[1] != "draft":
            raise HTTPException(status_code=400, detail="Only drafts can be scheduled.")
        if row[2] != user_id:
            raise HTTPException(status_code=403, detail="Not your email.")

        send_at = body.get("send_at")

        cursor.execute(
            "UPDATE chits SET email_send_at = ?, modified_datetime = ? WHERE id = ?",
            (send_at, datetime.now(timezone.utc).isoformat(), chit_id),
        )
        conn.commit()

        if send_at:
            return {"status": "scheduled", "send_at": send_at}
        else:
            return {"status": "cancelled"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Email schedule error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.close()


# ───────────────────────────────────────────────────────────────────────────
# GET /api/email/thread/{chit_id} — Get email conversation thread
# ───────────────────────────────────────────────────────────────────────────

def _strip_email_prefixes(subject: str) -> str:
    """Strip Re:/Fwd:/Fw: prefixes from a subject line for thread matching."""
    if not subject:
        return ""
    cleaned = subject.strip()
    while True:
        match = re.match(r'^(Re|Fwd|Fw)\s*:\s*', cleaned, re.IGNORECASE)
        if match:
            cleaned = cleaned[match.end():].strip()
        else:
            break
    return cleaned


@email_router.get("/api/email/thread/{chit_id}")
def email_thread(chit_id: str, request: Request):
    """Find all related emails in a conversation thread.

    Matches by email_in_reply_to, email_references, email_message_id,
    and by normalized subject line (stripping Re:/Fwd: prefixes).

    Returns a list sorted by email_date ascending (oldest first).
    """
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # Load the anchor chit
        cursor.execute("SELECT * FROM chits WHERE id = ?", (chit_id,))
        anchor = cursor.fetchone()
        if not anchor:
            raise HTTPException(status_code=404, detail="Email chit not found.")
        anchor = dict(anchor)

        # Collect all message IDs related to this thread
        message_ids = set()
        if anchor.get("email_message_id"):
            message_ids.add(anchor["email_message_id"].strip())
        if anchor.get("email_in_reply_to"):
            message_ids.add(anchor["email_in_reply_to"].strip())
        if anchor.get("email_references"):
            for ref in anchor["email_references"].split():
                ref = ref.strip()
                if ref:
                    message_ids.add(ref)

        logger.info(f"[Thread] Anchor chit {chit_id}: message_id={anchor.get('email_message_id')!r}, "
                     f"in_reply_to={anchor.get('email_in_reply_to')!r}, "
                     f"references={anchor.get('email_references')!r}, "
                     f"subject={anchor.get('email_subject') or anchor.get('title')!r}")
        logger.info(f"[Thread] Collected {len(message_ids)} message_ids: {message_ids}")

        # Normalized subject for fallback matching
        anchor_subject = _strip_email_prefixes(anchor.get("email_subject") or anchor.get("title") or "")

        # Find all email chits that share any of these message IDs or have matching subject
        thread_ids = {chit_id}  # always include the anchor
        thread_chits = {}

        # Query all email chits (non-deleted)
        cursor.execute(
            "SELECT id, email_from, email_date, email_status, title, email_body_text, "
            "email_message_id, email_in_reply_to, email_references, email_subject "
            "FROM chits WHERE (deleted = 0 OR deleted IS NULL) AND email_message_id IS NOT NULL"
        )
        for row in cursor.fetchall():
            row_dict = dict(row)
            rid = row_dict["id"]
            r_msg_id = (row_dict.get("email_message_id") or "").strip()
            r_reply_to = (row_dict.get("email_in_reply_to") or "").strip()
            r_refs = (row_dict.get("email_references") or "").strip()
            r_subject = _strip_email_prefixes(row_dict.get("email_subject") or row_dict.get("title") or "")

            # Check message ID overlap
            row_ids = set()
            if r_msg_id:
                row_ids.add(r_msg_id)
            if r_reply_to:
                row_ids.add(r_reply_to)
            if r_refs:
                for ref in r_refs.split():
                    ref = ref.strip()
                    if ref:
                        row_ids.add(ref)

            matched = bool(message_ids & row_ids)

            # Fallback: match by normalized subject
            if not matched and anchor_subject and r_subject and anchor_subject.lower() == r_subject.lower():
                matched = True

            if matched:
                thread_ids.add(rid)
                thread_chits[rid] = row_dict

        logger.info(f"[Thread] Found {len(thread_ids)} matches (including anchor) for chit {chit_id}")

        # Ensure anchor is in the result
        if chit_id not in thread_chits:
            thread_chits[chit_id] = {
                "id": anchor["id"],
                "email_from": anchor.get("email_from", ""),
                "email_date": anchor.get("email_date", ""),
                "email_status": anchor.get("email_status", ""),
                "title": anchor.get("title", ""),
                "email_body_text": anchor.get("email_body_text", ""),
            }

        # Build response list sorted by email_date ascending
        result = []
        for rid, row_dict in thread_chits.items():
            body_text = row_dict.get("email_body_text") or ""
            preview = body_text[:100].replace("\n", " ").strip()
            result.append({
                "id": rid,
                "email_from": row_dict.get("email_from", ""),
                "email_date": row_dict.get("email_date", ""),
                "email_status": row_dict.get("email_status", ""),
                "title": row_dict.get("title", ""),
                "email_body_text_preview": preview,
            })

        result.sort(key=lambda x: x.get("email_date") or "")

        # Query nested chits: non-deleted chits whose nest_thread_id references any thread member
        if thread_ids:
            placeholders = ",".join("?" for _ in thread_ids)
            cursor.execute(
                f"SELECT id, title, note, status, due_datetime, start_datetime "
                f"FROM chits WHERE nest_thread_id IN ({placeholders}) "
                f"AND (deleted = 0 OR deleted IS NULL)",
                list(thread_ids),
            )
            for row in cursor.fetchall():
                nest_dict = dict(row)
                note_raw = nest_dict.get("note") or ""
                note_preview = note_raw[:100]
                result.append({
                    "id": nest_dict["id"],
                    "title": nest_dict.get("title") or "",
                    "note": note_preview,
                    "status": nest_dict.get("status") or "",
                    "due_datetime": nest_dict.get("due_datetime") or "",
                    "start_datetime": nest_dict.get("start_datetime") or "",
                    "is_nest": True,
                })

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Email thread error: %s", e)
        raise HTTPException(status_code=500, detail=f"Failed to load email thread: {str(e)}")
    finally:
        if conn:
            conn.close()


# ───────────────────────────────────────────────────────────────────────────
# GET /api/email/threads/recent — Recent email threads for thread picker
# ───────────────────────────────────────────────────────────────────────────

@email_router.get("/api/email/threads/recent")
def email_threads_recent(request: Request, q: str = None):
    """Return the 20 most recent email threads for the thread picker.

    Groups email chits by normalized subject (stripping Re:/Fwd:/Fw: prefixes)
    and returns thread summaries sorted by latest email_date descending.

    Query Parameters:
        q (optional): Case-insensitive substring filter on normalized subject.

    Returns:
        JSON array of thread summaries:
        ``[{thread_id, subject, latest_date, message_count}]``
    """
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # Fetch all non-deleted email chits with their subject and date
        cursor.execute(
            "SELECT id, email_subject, title, email_date "
            "FROM chits "
            "WHERE (deleted = 0 OR deleted IS NULL) "
            "AND email_message_id IS NOT NULL"
        )

        # Group by normalized subject
        threads: dict = {}  # normalized_subject_lower -> {subject, latest_date, message_count, thread_id}
        for row in cursor.fetchall():
            row_dict = dict(row)
            raw_subject = row_dict.get("email_subject") or row_dict.get("title") or ""
            normalized = _strip_email_prefixes(raw_subject)
            norm_key = normalized.lower()

            email_date = row_dict.get("email_date") or ""

            if norm_key not in threads:
                threads[norm_key] = {
                    "subject": normalized or "(No Subject)",
                    "latest_date": email_date,
                    "message_count": 1,
                    "thread_id": row_dict["id"],
                }
            else:
                threads[norm_key]["message_count"] += 1
                # Update thread_id and latest_date if this email is newer
                if email_date > threads[norm_key]["latest_date"]:
                    threads[norm_key]["latest_date"] = email_date
                    threads[norm_key]["thread_id"] = row_dict["id"]

        # Apply optional search filter
        results = list(threads.values())
        if q:
            q_lower = q.lower()
            results = [t for t in results if q_lower in t["subject"].lower()]

        # Sort by latest_date descending
        results.sort(key=lambda x: x.get("latest_date") or "", reverse=True)

        # Return top 20
        return results[:20]

    except Exception as e:
        logger.error("Failed to load recent threads: %s", e)
        raise HTTPException(status_code=500, detail="Failed to load recent threads")
    finally:
        if conn:
            conn.close()


# ───────────────────────────────────────────────────────────────────────────
# POST /api/email/archive-original — Archive the original email by Message-ID
# ───────────────────────────────────────────────────────────────────────────

@email_router.post("/api/email/archive-original")
async def email_archive_original(request: Request):
    """Archive the original email chit that was replied to.

    Expects JSON body: ``{"message_id": "<Message-ID>"}``

    Finds the chit with the matching ``email_message_id`` and sets
    ``archived = 1``.
    """
    user_id = request.state.user_id
    conn = None
    try:
        body = await request.json()
        message_id = body.get("message_id", "").strip()
        if not message_id:
            raise HTTPException(status_code=400, detail="message_id required")

        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        cursor.execute(
            "UPDATE chits SET archived = 1, modified_datetime = ? WHERE email_message_id = ? AND owner_id = ? AND (deleted = 0 OR deleted IS NULL)",
            (datetime.now(timezone.utc).isoformat(), message_id, user_id),
        )
        affected = cursor.rowcount
        conn.commit()

        if affected == 0:
            return {"status": "not_found", "message": "No matching email found to archive."}

        return {"status": "archived", "count": affected}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Archive-original error: %s", e)
        raise HTTPException(status_code=500, detail=f"Failed to archive original: {str(e)}")
    finally:
        if conn:
            conn.close()


# ───────────────────────────────────────────────────────────────────────────
# PATCH /api/email/{chit_id}/read — Toggle email read state
# ───────────────────────────────────────────────────────────────────────────

@email_router.patch("/api/email/{chit_id}/read")
def email_toggle_read(chit_id: str, request: Request):
    """Toggle ``email_read`` on the specified email chit.

    If the chit is currently unread, marks it as read. If already read,
    marks it as unread. Returns the new state.
    """
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        cursor.execute(
            "SELECT email_read FROM chits WHERE id = ?", (chit_id,)
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Email chit not found.")

        current_read = bool(row[0])
        new_read = not current_read

        cursor.execute(
            "UPDATE chits SET email_read = ? WHERE id = ?", (int(new_read), chit_id)
        )
        conn.commit()
        return {"email_read": new_read}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Toggle-read error: %s", e)
        raise HTTPException(status_code=500, detail=f"Failed to toggle email read state: {str(e)}")
    finally:
        if conn:
            conn.close()
            conn.close()


# ───────────────────────────────────────────────────────────────────────────
# ───────────────────────────────────────────────────────────────────────────
# GET /api/email/{chit_id}/raw — Download reconstructed .eml from stored data
# ───────────────────────────────────────────────────────────────────────────

@email_router.get("/api/email/{chit_id}/raw")
def email_download_raw(chit_id: str, request: Request):
    """Build an RFC 2822 .eml file from the stored email fields and return as download.

    No IMAP connection needed — reconstructs the message from the chit's
    email_from, email_to, email_cc, email_subject, email_body_text,
    email_body_html, email_date, and email_message_id fields.
    """
    import email as _email_mod
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText
    from email.utils import formatdate, parsedate_to_datetime
    from fastapi.responses import Response

    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        cursor.execute(
            "SELECT email_message_id, email_from, email_to, email_cc, email_bcc, "
            "email_subject, email_body_text, email_body_html, email_date "
            "FROM chits WHERE id = ?",
            (chit_id,),
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Email chit not found.")

        subject = row["email_subject"] or ""
        body_text = row["email_body_text"] or ""
        body_html = row["email_body_html"] or ""

        # Build the MIME message
        if body_html and body_text:
            msg = MIMEMultipart("alternative")
            msg.attach(MIMEText(body_text, "plain", "utf-8"))
            msg.attach(MIMEText(body_html, "html", "utf-8"))
        elif body_html:
            msg = MIMEText(body_html, "html", "utf-8")
        else:
            msg = MIMEText(body_text, "plain", "utf-8")

        # Set headers
        if row["email_from"]:
            msg["From"] = row["email_from"]
        if row["email_to"]:
            msg["To"] = row["email_to"]
        if row["email_cc"]:
            msg["Cc"] = row["email_cc"]
        if row["email_bcc"]:
            msg["Bcc"] = row["email_bcc"]
        if subject:
            msg["Subject"] = subject
        if row["email_message_id"]:
            msg["Message-ID"] = row["email_message_id"]
        if row["email_date"]:
            msg["Date"] = row["email_date"]

        raw_bytes = msg.as_bytes()

        # Build a safe filename
        safe_subject = "".join(c for c in subject if c.isalnum() or c in " -_").strip()[:50]
        if not safe_subject:
            safe_subject = "email"
        filename = f"{safe_subject}.eml"

        return Response(
            content=raw_bytes,
            media_type="message/rfc822",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Raw email download error: %s", e)
        raise HTTPException(status_code=500, detail=f"Failed to build email: {str(e)}")
    finally:
        if conn:
            conn.close()


# ───────────────────────────────────────────────────────────────────────────
# POST /api/email/test-connection — Test IMAP + SMTP connectivity
# ───────────────────────────────────────────────────────────────────────────

@email_router.post("/api/email/test-connection")
async def email_test_connection(request: Request):
    """Test IMAP and SMTP connectivity with provided or saved credentials.

    Accepts an optional JSON body with credentials. If no body is provided,
    uses the saved email_account from settings.

    Returns ``{"imap": {"success": bool, "message": str}, "smtp": {"success": bool, "message": str}}``.
    """
    user_id = request.state.user_id

    # Try to parse request body for credentials
    account = None
    try:
        body = await request.json()
        if body and isinstance(body, dict) and body.get("email"):
            account = body
    except Exception:
        pass

    # Fall back to saved settings if no credentials in body
    if not account:
        conn = None
        try:
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            account = _get_email_account(cursor, user_id)
        finally:
            if conn:
                conn.close()

    # Decrypt password if needed
    if account.get("password_encrypted") and not account.get("password"):
        account["password"] = _decrypt_password(account["password_encrypted"])

    # Test IMAP
    imap_result = {"success": False, "message": ""}
    imap_conn = None
    try:
        host = account.get("imap_host", "imap.gmail.com")
        port = int(account.get("imap_port", 993))
        imap_security = account.get("imap_security", "ssl")
        password = account.get("password", "")
        username = account.get("username", account.get("email", ""))

        if imap_security == "starttls":
            imap_conn = imaplib.IMAP4(host, port)
            imap_conn.starttls()
        elif imap_security == "none":
            imap_conn = imaplib.IMAP4(host, port)
        else:
            imap_conn = imaplib.IMAP4_SSL(host, port)

        imap_conn.login(username, password)
        imap_conn.logout()
        imap_conn = None
        imap_result = {"success": True, "message": "IMAP connection successful."}
    except imaplib.IMAP4.error as e:
        imap_result = {"success": False, "message": f"IMAP authentication failed: {str(e)}"}
    except (OSError, ConnectionError, TimeoutError) as e:
        imap_result = {"success": False, "message": f"Cannot reach IMAP server: {str(e)}"}
    except Exception as e:
        imap_result = {"success": False, "message": f"IMAP error: {str(e)}"}
    finally:
        if imap_conn:
            try:
                imap_conn.logout()
            except Exception:
                pass

    # Test SMTP
    smtp_result = {"success": False, "message": ""}
    smtp_conn = None
    try:
        host = account.get("smtp_host", "smtp.gmail.com")
        port = int(account.get("smtp_port", 587))
        smtp_security = account.get("smtp_security", "starttls")
        password = account.get("password", "")
        username = account.get("username", account.get("email", ""))

        if smtp_security == "ssl":
            smtp_conn = smtplib.SMTP_SSL(host, port, timeout=15)
            smtp_conn.ehlo()
        elif smtp_security == "none":
            smtp_conn = smtplib.SMTP(host, port, timeout=15)
            smtp_conn.ehlo()
        else:
            smtp_conn = smtplib.SMTP(host, port, timeout=15)
            smtp_conn.ehlo()
            smtp_conn.starttls()
            smtp_conn.ehlo()

        smtp_conn.login(username, password)
        smtp_conn.quit()
        smtp_conn = None
        smtp_result = {"success": True, "message": "SMTP connection successful."}
    except smtplib.SMTPAuthenticationError as e:
        smtp_result = {"success": False, "message": f"SMTP authentication failed: {str(e)}"}
    except (OSError, ConnectionError, TimeoutError) as e:
        smtp_result = {"success": False, "message": f"Cannot reach SMTP server: {str(e)}"}
    except Exception as e:
        smtp_result = {"success": False, "message": f"SMTP error: {str(e)}"}
    finally:
        if smtp_conn:
            try:
                smtp_conn.quit()
            except Exception:
                pass

    return {"imap": imap_result, "smtp": smtp_result}


# ───────────────────────────────────────────────────────────────────────────
# POST /api/email/backfill-estimate — Estimate mailbox size for backfill
# ───────────────────────────────────────────────────────────────────────────

@email_router.post("/api/email/backfill-estimate")
def email_backfill_estimate(request: Request):
    """Query IMAP for total message count and estimated storage size.

    Returns ``{"message_count": int, "estimated_mb": float}``.
    """
    user_id = request.state.user_id
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        account = _get_email_account(cursor, user_id)

        # Decrypt password
        if account.get("password_encrypted"):
            account["password"] = _decrypt_password(account["password_encrypted"])

        result = _estimate_backfill(account)
        return result

    except HTTPException:
        raise
    except imaplib.IMAP4.error as e:
        err_msg = str(e)
        if "AUTHENTICATIONFAILED" in err_msg.upper() or "LOGIN" in err_msg.upper():
            raise HTTPException(
                status_code=401,
                detail="IMAP authentication failed. Check your email and app password.",
            )
        raise HTTPException(
            status_code=502,
            detail=f"Cannot reach IMAP server: {str(e)}",
        )
    except (OSError, ConnectionError, TimeoutError) as e:
        raise HTTPException(
            status_code=502,
            detail=f"Cannot reach IMAP server: {str(e)}",
        )
    except Exception as e:
        logger.error("Backfill estimate error: %s", e)
        raise HTTPException(status_code=500, detail=f"Backfill estimate failed: {str(e)}")
    finally:
        if conn:
            conn.close()
