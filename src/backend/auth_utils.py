"""Password hashing utilities for CWOC multi-user authentication.

Uses Python stdlib only — hashlib.pbkdf2_hmac with SHA-256, os.urandom
for salt generation. No external dependencies.

Storage format: 'salt_hex$hash_hex' where salt is 32 bytes (64 hex chars)
and hash is derived with 600,000 PBKDF2 iterations.
"""

import hashlib
import hmac
import os


# PBKDF2 configuration
_HASH_ALGORITHM = 'sha256'
_ITERATIONS = 600_000
_SALT_LENGTH = 32  # bytes


def hash_password(password: str) -> str:
    """Hash a password with PBKDF2-HMAC-SHA256 using a random salt.

    Args:
        password: The plaintext password to hash.

    Returns:
        A string in the format 'salt_hex$hash_hex' suitable for database storage.
    """
    salt = os.urandom(_SALT_LENGTH)
    dk = hashlib.pbkdf2_hmac(
        _HASH_ALGORITHM,
        password.encode('utf-8'),
        salt,
        _ITERATIONS,
    )
    return f"{salt.hex()}${dk.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    """Verify a password against a stored hash string.

    Args:
        password: The plaintext password to verify.
        stored_hash: The stored hash in 'salt_hex$hash_hex' format.

    Returns:
        True if the password matches, False otherwise.
    """
    try:
        salt_hex, hash_hex = stored_hash.split('$', 1)
        salt = bytes.fromhex(salt_hex)
        expected_hash = bytes.fromhex(hash_hex)
    except (ValueError, AttributeError):
        return False

    dk = hashlib.pbkdf2_hmac(
        _HASH_ALGORITHM,
        password.encode('utf-8'),
        salt,
        _ITERATIONS,
    )
    # Constant-time comparison to prevent timing attacks
    return hmac.compare_digest(dk, expected_hash)
