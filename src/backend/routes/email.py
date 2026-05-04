"""Email integration routes and helpers for CWOC.

Provides IMAP sync, SMTP send, email parsing, and password encryption.
"""

import base64
import email
import email.message
import email.utils
import email.policy
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

from src.backend.db import DB_PATH, serialize_json_field, compute_system_tags
from src.backend.rules_engine import dispatch_trigger

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

    if security == "starttls":
        imap = imaplib.IMAP4(host, port)
        imap.starttls()
    elif security == "none":
        imap = imaplib.IMAP4(host, port)
    else:
        # Default: SSL/TLS
        imap = imaplib.IMAP4_SSL(host, port)

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


def _fetch_new_messages(imap, since_date: str) -> list:
    """Fetch messages from IMAP that are newer than *since_date*.

    Args:
        imap: An authenticated ``imaplib.IMAP4_SSL`` with a mailbox selected.
        since_date: IMAP date string (``"DD-Mon-YYYY"``).

    Returns:
        A list of ``(raw_bytes, flags_bytes)`` tuples — one per message.
        ``flags_bytes`` contains the IMAP FLAGS response so the caller can
        check the ``\\Seen`` flag.
    """
    status, data = imap.search(None, f'SINCE {since_date}')
    if status != "OK" or not data or not data[0]:
        return []

    uids = data[0].split()
    messages = []
    for uid in uids:
        # Fetch both the full message and its flags
        # Use BODY.PEEK[] instead of RFC822 to avoid setting the \Seen flag
        status, msg_data = imap.fetch(uid, "(BODY.PEEK[] FLAGS)")
        if status != "OK" or not msg_data:
            logger.warning("Failed to fetch message UID %s", uid)
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

    return messages


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
    start_datetime = ""
    if date_str:
        try:
            parsed_date = email.utils.parsedate_to_datetime(date_str)
            email_date = parsed_date.isoformat()
            start_datetime = parsed_date.isoformat()
        except (ValueError, TypeError):
            # Fall back to storing the raw date string
            email_date = date_str
            start_datetime = date_str

    # Extract body text
    body_text = _extract_text_from_message(msg)

    # Extract HTML body (for rich rendering)
    body_html = _extract_html_from_message(msg)

    # Extract file attachments
    extracted_attachments = _extract_attachments_from_message(msg)

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
        "start_datetime": start_datetime,
        "extracted_attachments": extracted_attachments,
    }


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
    proxy.start_datetime = parsed.get("start_datetime") or None
    proxy.end_datetime = None
    proxy.checklist = None
    proxy.alarm = None
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

    cursor.execute(
        """INSERT INTO chits (
            id, title, tags, start_datetime,
            created_datetime, modified_datetime,
            owner_id,
            email_message_id, email_from, email_to, email_cc,
            email_subject, email_body_text, email_body_html, email_date,
            email_folder, email_status, email_read,
            email_in_reply_to, email_references,
            email_account_id,
            attachments,
            deleted, archived, pinned
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
            ?, ?, ?
        )""",
        (
            chit_id,
            parsed.get("email_subject", "(No Subject)"),
            tags_json,
            parsed.get("start_datetime") or None,
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
            False,
            False,
            False,
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

    # Body — plain text + HTML alternative (markdown → HTML)
    # The email body is written as markdown in the frontend. We always send
    # a multipart/alternative with both plain text and rendered HTML.
    body = chit.get("email_body_text", "")
    signature = account.get("signature", "")

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
    """Fetch new messages from all configured IMAP servers.

    Returns ``{"new_count": int, "accounts_synced": int, "errors": list}``.
    """
    user_id = request.state.user_id
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        accounts = _get_all_email_accounts(cursor, user_id)
        if not accounts:
            raise HTTPException(
                status_code=400,
                detail="No email accounts configured. Go to Settings → Email to set up your email.",
            )

        # Get shared sync settings from the first account (they share config)
        shared_max_pull = int(accounts[0].get("max_pull", 50) or 50)

        total_new = 0
        total_deleted = 0
        accounts_synced = 0
        sync_errors = []
        all_email_summaries = []
        all_email_chits = []

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

                # Fetch new messages
                try:
                    messages = _fetch_new_messages(imap, since_date)
                except Exception as e:
                    sync_errors.append(f"{account_email}: Error fetching messages — {str(e)}")
                    continue

                # Parse and store each message (respect max_pull limit per account)
                new_count = 0
                for raw_bytes, flags_bytes in messages:
                    if new_count >= shared_max_pull:
                        break
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
                            subj = parsed.get("email_subject", "(No Subject)")
                            sender = parsed.get("email_from", "Unknown")
                            all_email_summaries.append(f"{subj} — {sender}")
                            all_email_chits.append({"id": chit_id, **parsed, "owner_id": user_id})
                    except Exception as e:
                        logger.warning("Failed to parse/store email message: %s", e)
                        continue

                total_new += new_count

                # ── Deletion sync: detect emails removed from IMAP ────────
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

        # Fire-and-forget: dispatch rules engine triggers for new email chits
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

        # Send push notification if new emails were fetched
        if total_new > 0:
            try:
                from src.backend.routes.ntfy import send_ntfy_notification
                from src.backend.schedulers import _get_server_base_url
                base = _get_server_base_url()
                ntfy_title = f"📬 {total_new} new email{'s' if total_new != 1 else ''}"
                if all_email_summaries:
                    body_lines = all_email_summaries[:5]
                    if len(all_email_summaries) > 5:
                        body_lines.append(f"… and {len(all_email_summaries) - 5} more")
                    ntfy_body = "\n".join(body_lines)
                else:
                    ntfy_body = "You have new mail in CWOC."
                click_url = f"{base}/frontend/html/index.html"
                icon_url = f"{base}/static/cwoc-icon-192.png"
                send_ntfy_notification(
                    user_id=user_id,
                    title=ntfy_title,
                    body=ntfy_body,
                    click_url=click_url,
                    tags="email,incoming_envelope",
                    icon_url=icon_url,
                )
            except Exception as e:
                logger.warning(f"Ntfy notification failed for new email: {e}")

        result = {"new_count": total_new, "deleted_count": total_deleted, "accounts_synced": accounts_synced}
        if sync_errors:
            result["errors"] = sync_errors
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Email sync error: %s", e)
        raise HTTPException(status_code=500, detail=f"Email sync failed: {str(e)}")
    finally:
        if conn:
            conn.close()


# ───────────────────────────────────────────────────────────────────────────
# POST /api/email/send/{chit_id} — Send a draft email via SMTP
# ───────────────────────────────────────────────────────────────────────────

@email_router.post("/api/email/send/{chit_id}")
def email_send(chit_id: str, request: Request):
    """Send a draft email chit via SMTP.

    On success, updates the chit's ``email_status`` to ``"sent"``,
    ``email_folder`` to ``"sent"``, and populates ``email_message_id``.
    """
    user_id = request.state.user_id
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
        # Unwrap double/triple-encoded JSON: '["[\"addr\"]"]' → ["addr"]
        email_to = _unwrap_json_list(email_to)
        if not email_to or (isinstance(email_to, list) and len(email_to) == 0):
            raise HTTPException(
                status_code=422,
                detail="Cannot send: no recipients specified.",
            )

        # Load email account credentials
        # Reset row_factory for settings query
        cursor2 = conn.cursor()
        # Use the chit's email_account_id if available, otherwise default
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

        # Unwrap any double-encoded JSON arrays
        for _fld in ("email_to", "email_cc", "email_bcc"):
            chit_data[_fld] = _unwrap_json_list(chit_data[_fld])

        logger.info(f"Sending email — To: {chit_data['email_to']}, Cc: {chit_data['email_cc']}, Bcc: {chit_data['email_bcc']}")
        logger.info(f"Sending email — Body length: {len(chit_data.get('email_body_text', '') or '')}, Body preview: {repr((chit_data.get('email_body_text', '') or '')[:200])}")
        logger.info(f"Sending email — Subject: {chit_data.get('email_subject', '')}, Title: {chit_data.get('title', '')}")
        logger.info(f"Sending email — note field: {repr((chit_data.get('note', '') or '')[:200])}")
        logger.info(f"Sending email — raw email_body_text type: {type(chit.get('email_body_text'))}, value: {repr((chit.get('email_body_text') or '')[:200])}")

        # Build the RFC 2822 message
        message = _build_rfc2822_message(chit_data, account)
        from_addr = account.get("email", account.get("username", ""))

        # Connect to SMTP and send
        try:
            smtp_conn = _connect_smtp(account)
            sent_message_id = _send_email(smtp_conn, message, from_addr)
        except smtplib.SMTPAuthenticationError:
            raise HTTPException(
                status_code=401,
                detail="SMTP authentication failed.",
            )
        except (smtplib.SMTPConnectError, OSError, ConnectionError, TimeoutError) as e:
            import logging
            logging.error(f"SMTP connection failed: {type(e).__name__}: {e}")
            raise HTTPException(
                status_code=502,
                detail=f"Cannot reach SMTP server {account.get('smtp_host', '?')}:{account.get('smtp_port', '?')} — {type(e).__name__}: {e}",
            )
        except smtplib.SMTPRecipientsRefused as e:
            refused = ", ".join(e.recipients.keys()) if e.recipients else "unknown"
            raise HTTPException(
                status_code=422,
                detail=f"Recipient address rejected: {refused}",
            )
        except smtplib.SMTPDataError as e:
            if "size" in str(e).lower() or "552" in str(e):
                raise HTTPException(
                    status_code=413,
                    detail="Message exceeds server size limit.",
                )
            raise HTTPException(
                status_code=502,
                detail=f"SMTP error: {str(e)}",
            )

        # On success: update chit status
        now = datetime.now(timezone.utc).isoformat()

        # Recompute system tags for the sent email
        # Read current tags, strip old email folder tags, add new ones
        current_tags_raw = chit.get("tags", "[]")
        current_tags = deserialize_json_field(current_tags_raw) if isinstance(current_tags_raw, str) else (current_tags_raw or [])
        # Remove old email folder system tags
        updated_tags = [t for t in current_tags if not (isinstance(t, str) and t.startswith("CWOC_System/Email/"))]
        updated_tags.append("CWOC_System/Email/Sent")
        # Ensure base email tag is present
        if "CWOC_System/Email" not in updated_tags:
            updated_tags.append("CWOC_System/Email")

        cursor.execute(
            """UPDATE chits
               SET email_status = 'sent',
                   email_folder = 'sent',
                   email_message_id = ?,
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
