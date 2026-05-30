"""Fernet-based encryption for storing user credentials and API keys."""

import base64
import hashlib

from cryptography.fernet import Fernet

from app.config import settings


def _derive_key(user_salt: str) -> bytes:
    """Derive a Fernet key from the app secret + user-specific salt."""
    raw = f"{settings.secret_key}:{user_salt}".encode()
    digest = hashlib.sha256(raw).digest()
    return base64.urlsafe_b64encode(digest)


def encrypt_value(plaintext: str, user_salt: str) -> str:
    """Encrypt a string value. Returns base64-encoded ciphertext."""
    key = _derive_key(user_salt)
    f = Fernet(key)
    return f.encrypt(plaintext.encode()).decode()


def decrypt_value(ciphertext: str, user_salt: str) -> str:
    """Decrypt a previously encrypted value."""
    key = _derive_key(user_salt)
    f = Fernet(key)
    return f.decrypt(ciphertext.encode()).decode()


def generate_download_token(project_id: str, file_type: str, expires_minutes: int = 60) -> str:
    """Generate a signed token for unauthenticated file downloads (used by print providers).

    Args:
        project_id: The project UUID string.
        file_type: Either "interior" or "cover".
        expires_minutes: Token validity in minutes (default 60).

    Returns:
        URL-safe base64-encoded signed token.
    """
    import hmac
    import time

    expires_at = int(time.time()) + (expires_minutes * 60)
    payload = f"{project_id}:{file_type}:{expires_at}"
    signature = hmac.new(
        settings.secret_key.encode(),
        payload.encode(),
        hashlib.sha256,
    ).hexdigest()[:32]
    token = base64.urlsafe_b64encode(f"{payload}:{signature}".encode()).decode()
    return token


def verify_download_token(token: str) -> tuple[str, str] | None:
    """Verify a download token and return (project_id, file_type) if valid.

    Returns None if the token is invalid or expired.
    """
    import hmac
    import time

    try:
        decoded = base64.urlsafe_b64decode(token.encode()).decode()
        parts = decoded.rsplit(":", 1)
        if len(parts) != 2:
            return None
        payload, signature = parts[0], parts[1]

        # Verify signature
        expected_sig = hmac.new(
            settings.secret_key.encode(),
            payload.encode(),
            hashlib.sha256,
        ).hexdigest()[:32]
        if not hmac.compare_digest(signature, expected_sig):
            return None

        # Check expiry
        payload_parts = payload.split(":")
        if len(payload_parts) != 3:
            return None
        project_id, file_type, expires_at_str = payload_parts
        if int(expires_at_str) < int(time.time()):
            return None

        return (project_id, file_type)
    except Exception:
        return None
