"""Restic backup integration routes and helpers for CWOC.

Provides backup configuration management, credential encryption/decryption,
repository URL construction, and credential environment variable mapping
for all supported restic backend types.
"""

import asyncio
import json
import logging
import os
import re
import shutil
import sqlite3
import subprocess
import time
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Request

from src.backend.db import DB_PATH, require_admin


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/backup")


# ═══════════════════════════════════════════════════════════════════════════
# Crypto helpers — Fernet encryption reusing the existing email.key
# ═══════════════════════════════════════════════════════════════════════════

# Try to import cryptography; fall back to base64 obfuscation if unavailable
try:
    from cryptography.fernet import Fernet
    _HAS_FERNET = True
except ImportError:
    import base64
    _HAS_FERNET = False
    logger.warning(
        "cryptography package not available — backup credentials will use "
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
    """Load the Fernet key from disk, or generate and save a new one."""
    key_path = _get_key_path()

    if os.path.exists(key_path):
        with open(key_path, "rb") as f:
            key = f.read().strip()
        if key:
            return key

    # Generate a new key
    if _HAS_FERNET:
        key = Fernet.generate_key()
    else:
        import base64 as _b64
        key = _b64.urlsafe_b64encode(os.urandom(32))

    key_dir = os.path.dirname(key_path)
    if key_dir:
        os.makedirs(key_dir, exist_ok=True)

    with open(key_path, "wb") as f:
        f.write(key)

    logger.info("Generated new backup encryption key at %s", key_path)
    return key


def _get_fernet():
    """Return a Fernet instance, or None if cryptography is unavailable."""
    if not _HAS_FERNET:
        return None
    key = _get_or_create_fernet_key()
    return Fernet(key)


def _encrypt_credential(value: str) -> str:
    """Encrypt a credential string for storage.

    Uses Fernet symmetric encryption when the cryptography package is
    available. Falls back to base64 encoding on dev machines.
    """
    if not value:
        return ""
    fernet = _get_fernet()
    if fernet is not None:
        token = fernet.encrypt(value.encode("utf-8"))
        return token.decode("utf-8")

    # Base64 fallback (NOT secure — dev only)
    import base64 as _b64
    logger.warning("Using base64 fallback for credential encryption (not secure)")
    return _b64.b64encode(value.encode("utf-8")).decode("utf-8")


def _decrypt_credential(value: str) -> str:
    """Decrypt a stored credential string.

    Uses Fernet symmetric decryption when the cryptography package is
    available. Falls back to base64 decoding on dev machines.
    """
    if not value:
        return ""
    fernet = _get_fernet()
    if fernet is not None:
        plaintext = fernet.decrypt(value.encode("utf-8"))
        return plaintext.decode("utf-8")

    # Base64 fallback
    import base64 as _b64
    logger.warning("Using base64 fallback for credential decryption (not secure)")
    return _b64.b64decode(value.encode("utf-8")).decode("utf-8")


# ═══════════════════════════════════════════════════════════════════════════
# Configuration helpers — load/save from backup_config table
# ═══════════════════════════════════════════════════════════════════════════

def _load_backup_config(target_id: str = None) -> dict | None:
    """Read a single backup target configuration from the database.

    Args:
        target_id: The UUID of the target to load. If None, loads the first
                   available target (backward compat).

    Returns a dict with all config fields (credentials decrypted), or None
    if no configuration exists.
    """
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        if target_id:
            cursor.execute("SELECT * FROM backup_config WHERE id = ?", (target_id,))
        else:
            cursor.execute("SELECT * FROM backup_config LIMIT 1")
        row = cursor.fetchone()
        if not row:
            return None

        config = dict(row)
        return _deserialize_backup_config(config)
    except Exception as e:
        logger.error(f"Failed to load backup config: {e}")
        return None
    finally:
        if conn:
            conn.close()


def _load_all_backup_configs() -> list:
    """Load all backup target configurations from the database.

    Returns a list of dicts (credentials decrypted), or empty list if none exist.
    """
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM backup_config ORDER BY name")
        rows = cursor.fetchall()
        return [_deserialize_backup_config(dict(row)) for row in rows]
    except Exception as e:
        logger.error(f"Failed to load backup configs: {e}")
        return []
    finally:
        if conn:
            conn.close()


def _deserialize_backup_config(config: dict) -> dict:
    """Decrypt credentials and parse JSON fields on a raw backup_config row."""
    # Decrypt the repository password
    if config.get("repo_password_encrypted"):
        config["repo_password"] = _decrypt_credential(config["repo_password_encrypted"])
    else:
        config["repo_password"] = ""

    # Decrypt backend credentials (stored as encrypted JSON string)
    if config.get("backend_credentials_encrypted"):
        decrypted_json = _decrypt_credential(config["backend_credentials_encrypted"])
        try:
            config["backend_credentials"] = json.loads(decrypted_json)
        except (json.JSONDecodeError, TypeError):
            config["backend_credentials"] = {}
    else:
        config["backend_credentials"] = {}

    # Parse JSON fields
    for field in ("backup_paths", "backup_history"):
        if config.get(field):
            try:
                config[field] = json.loads(config[field])
            except (json.JSONDecodeError, TypeError):
                config[field] = []
        else:
            config[field] = []

    for field in ("retention_policy", "notification_recipients"):
        if config.get(field):
            try:
                config[field] = json.loads(config[field])
            except (json.JSONDecodeError, TypeError):
                config[field] = {}
        else:
            config[field] = {}

    if config.get("last_backup_result"):
        try:
            config["last_backup_result"] = json.loads(config["last_backup_result"])
        except (json.JSONDecodeError, TypeError):
            config["last_backup_result"] = None
    else:
        config["last_backup_result"] = None

    # Convert integer booleans
    config["enabled"] = bool(config.get("enabled", 0))
    config["notification_transfer"] = bool(config.get("notification_transfer", 1))
    config["notification_maintenance"] = bool(config.get("notification_maintenance", 1))

    return config


def _save_backup_config(config: dict) -> dict:
    """Encrypt credentials and persist backup configuration to the database.

    Accepts a dict with plaintext credentials and JSON-serializable fields.
    The config must have an 'id' field (UUID). If the row exists, it's updated;
    otherwise a new row is inserted.
    Returns {"success": True} on success, {"success": False, "error": "..."} on failure.
    """
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.execute("PRAGMA busy_timeout=5000")
        cursor = conn.cursor()
        now = datetime.now(timezone.utc).isoformat()

        target_id = config.get("id")
        if not target_id:
            import uuid
            target_id = str(uuid.uuid4())
            config["id"] = target_id

        # Encrypt the repository password
        repo_password_encrypted = ""
        if config.get("repo_password"):
            repo_password_encrypted = _encrypt_credential(config["repo_password"])

        # Encrypt backend credentials (as JSON string)
        backend_credentials_encrypted = ""
        if config.get("backend_credentials"):
            creds_json = json.dumps(config["backend_credentials"])
            backend_credentials_encrypted = _encrypt_credential(creds_json)

        # Serialize JSON fields
        backup_paths = json.dumps(config.get("backup_paths", []))
        retention_policy = json.dumps(config.get("retention_policy", {}))
        notification_recipients = json.dumps(config.get("notification_recipients", {}))
        last_backup_result = json.dumps(config.get("last_backup_result")) if config.get("last_backup_result") else None
        backup_history = json.dumps(config.get("backup_history", []))

        # Check if a row already exists
        cursor.execute("SELECT id FROM backup_config WHERE id = ?", (target_id,))
        exists = cursor.fetchone() is not None

        if exists:
            cursor.execute("""
                UPDATE backup_config SET
                    name = ?,
                    enabled = ?,
                    repo_type = ?,
                    repo_url = ?,
                    repo_password_encrypted = ?,
                    backend_credentials_encrypted = ?,
                    backup_paths = ?,
                    schedule_frequency = ?,
                    schedule_time = ?,
                    retention_policy = ?,
                    notification_recipients = ?,
                    notification_transfer = ?,
                    notification_maintenance = ?,
                    last_backup_time = ?,
                    last_backup_result = ?,
                    next_backup_time = ?,
                    last_check_time = ?,
                    backup_history = ?,
                    retry_count = ?,
                    updated_at = ?
                WHERE id = ?
            """, (
                config.get("name", "Backup"),
                1 if config.get("enabled") else 0,
                config.get("repo_type", "local"),
                config.get("repo_url", ""),
                repo_password_encrypted,
                backend_credentials_encrypted,
                backup_paths,
                config.get("schedule_frequency", "daily"),
                config.get("schedule_time", "02:00"),
                retention_policy,
                notification_recipients,
                1 if config.get("notification_transfer", True) else 0,
                1 if config.get("notification_maintenance", True) else 0,
                config.get("last_backup_time"),
                last_backup_result,
                config.get("next_backup_time"),
                config.get("last_check_time"),
                backup_history,
                config.get("retry_count", 0),
                now,
                target_id,
            ))
        else:
            cursor.execute("""
                INSERT INTO backup_config (
                    id, name, enabled, repo_type, repo_url, repo_password_encrypted,
                    backend_credentials_encrypted, backup_paths, schedule_frequency,
                    schedule_time, retention_policy, notification_recipients,
                    notification_transfer, notification_maintenance,
                    last_backup_time, last_backup_result, next_backup_time,
                    last_check_time, backup_history, retry_count,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                target_id,
                config.get("name", "Backup"),
                1 if config.get("enabled") else 0,
                config.get("repo_type", "local"),
                config.get("repo_url", ""),
                repo_password_encrypted,
                backend_credentials_encrypted,
                backup_paths,
                config.get("schedule_frequency", "daily"),
                config.get("schedule_time", "02:00"),
                retention_policy,
                notification_recipients,
                1 if config.get("notification_transfer", True) else 0,
                1 if config.get("notification_maintenance", True) else 0,
                config.get("last_backup_time"),
                last_backup_result,
                config.get("next_backup_time"),
                config.get("last_check_time"),
                backup_history,
                config.get("retry_count", 0),
                now,
                now,
            ))

        conn.commit()
        return {"success": True}
    except Exception as e:
        logger.error(f"Failed to save backup config: {e}", exc_info=True)
        return {"success": False, "error": str(e)}
    finally:
        if conn:
            conn.close()


def _delete_backup_config(target_id: str) -> bool:
    """Delete a backup target configuration from the database.

    Args:
        target_id: The UUID of the target to delete.

    Returns True on success, False on failure.
    """
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.execute("PRAGMA busy_timeout=5000")
        cursor = conn.cursor()
        cursor.execute("DELETE FROM backup_config WHERE id = ?", (target_id,))
        conn.commit()
        return cursor.rowcount > 0
    except Exception as e:
        logger.error(f"Failed to delete backup config {target_id}: {e}")
        return False
    finally:
        if conn:
            conn.close()


# ═══════════════════════════════════════════════════════════════════════════
# Repository URL construction
# ═══════════════════════════════════════════════════════════════════════════

def _build_repo_url(config: dict) -> str:
    """Construct the correct restic repository URL for the configured backend type.

    Args:
        config: Backup configuration dict with repo_type and repo_url fields.

    Returns:
        The formatted repository URL string for restic.

    Repository URL formats by type:
        local:  /path/to/repo
        sftp:   sftp:user@host:/path
        s3:     s3:endpoint/bucket
        b2:     b2:bucket:/path
        azure:  azure:container:/path
        gcs:    gs:bucket:/path
        rest:   rest:http://host:port/
        rclone: rclone:remote:path
    """
    repo_type = config.get("repo_type", "local")
    repo_url = config.get("repo_url", "")

    if not repo_url:
        return ""

    # For types that already include the prefix in the URL field,
    # just return as-is. For types where the user provides only the
    # path/address portion, prepend the appropriate prefix.
    prefix_map = {
        "local": "",
        "sftp": "sftp:",
        "s3": "s3:",
        "b2": "b2:",
        "azure": "azure:",
        "gcs": "gs:",
        "rest": "rest:",
        "rclone": "rclone:",
    }

    prefix = prefix_map.get(repo_type, "")

    # If the URL already starts with the expected prefix, return as-is
    if prefix and repo_url.startswith(prefix):
        return repo_url

    # For local paths, return the raw path (no prefix)
    if repo_type == "local":
        return repo_url

    return f"{prefix}{repo_url}"


# ═══════════════════════════════════════════════════════════════════════════
# Credential environment variable mapping
# ═══════════════════════════════════════════════════════════════════════════

def _get_credential_env_vars(config: dict) -> dict:
    """Map backend type to the correct environment variables for restic subprocess.

    Builds a dict of environment variables that should be passed to the restic
    subprocess. Always includes RESTIC_PASSWORD and RESTIC_REPOSITORY.
    Backend-specific credentials are added based on repo_type.

    Args:
        config: Backup configuration dict with decrypted credentials.

    Returns:
        Dict of environment variable name → value pairs.
    """
    env_vars = {}

    # Always set the repository URL and password
    repo_url = _build_repo_url(config)
    if repo_url:
        env_vars["RESTIC_REPOSITORY"] = repo_url

    repo_password = config.get("repo_password", "")
    if repo_password:
        env_vars["RESTIC_PASSWORD"] = repo_password

    # Backend-specific credential environment variables
    repo_type = config.get("repo_type", "local")
    backend_creds = config.get("backend_credentials", {})

    if repo_type == "sftp":
        # SFTP password auth: use SSHPASS env var (requires sshpass installed)
        # and set RESTIC_SFTP_COMMAND to use sshpass for password-based SSH
        if backend_creds.get("password"):
            env_vars["SSHPASS"] = backend_creds["password"]
            # Build custom SSH command with sshpass and optional port/key
            ssh_cmd_parts = ["sshpass", "-e", "ssh"]
            if backend_creds.get("port") and backend_creds["port"] != "22":
                ssh_cmd_parts.extend(["-p", str(backend_creds["port"])])
            if backend_creds.get("ssh_key_path"):
                ssh_cmd_parts.extend(["-i", backend_creds["ssh_key_path"]])
            ssh_cmd_parts.extend(["-o", "StrictHostKeyChecking=accept-new"])
            env_vars["RESTIC_SFTP_COMMAND"] = " ".join(ssh_cmd_parts)
        elif backend_creds.get("ssh_key_path"):
            # Key-only auth: custom SSH command with key and optional port
            ssh_cmd_parts = ["ssh"]
            if backend_creds.get("port") and backend_creds["port"] != "22":
                ssh_cmd_parts.extend(["-p", str(backend_creds["port"])])
            ssh_cmd_parts.extend(["-i", backend_creds["ssh_key_path"]])
            ssh_cmd_parts.extend(["-o", "StrictHostKeyChecking=accept-new"])
            env_vars["RESTIC_SFTP_COMMAND"] = " ".join(ssh_cmd_parts)
        elif backend_creds.get("port") and backend_creds["port"] != "22":
            # Non-standard port only
            env_vars["RESTIC_SFTP_COMMAND"] = f"ssh -p {backend_creds['port']} -o StrictHostKeyChecking=accept-new"

    elif repo_type == "s3":
        if backend_creds.get("access_key_id"):
            env_vars["AWS_ACCESS_KEY_ID"] = backend_creds["access_key_id"]
        if backend_creds.get("secret_access_key"):
            env_vars["AWS_SECRET_ACCESS_KEY"] = backend_creds["secret_access_key"]

    elif repo_type == "b2":
        if backend_creds.get("account_id"):
            env_vars["B2_ACCOUNT_ID"] = backend_creds["account_id"]
        if backend_creds.get("account_key"):
            env_vars["B2_ACCOUNT_KEY"] = backend_creds["account_key"]

    elif repo_type == "azure":
        if backend_creds.get("account_name"):
            env_vars["AZURE_ACCOUNT_NAME"] = backend_creds["account_name"]
        if backend_creds.get("account_key"):
            env_vars["AZURE_ACCOUNT_KEY"] = backend_creds["account_key"]

    elif repo_type == "gcs":
        if backend_creds.get("credentials_path"):
            env_vars["GOOGLE_APPLICATION_CREDENTIALS"] = backend_creds["credentials_path"]

    return env_vars


# ═══════════════════════════════════════════════════════════════════════════
# Restic command executor
# ═══════════════════════════════════════════════════════════════════════════

# Sensitive env var names that must never be logged
_SENSITIVE_ENV_KEYS = frozenset({
    "RESTIC_PASSWORD",
    "SSHPASS",
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "B2_ACCOUNT_ID",
    "B2_ACCOUNT_KEY",
    "AZURE_ACCOUNT_NAME",
    "AZURE_ACCOUNT_KEY",
    "GOOGLE_APPLICATION_CREDENTIALS",
})


def _check_restic_available() -> dict | None:
    """Check if the restic binary is available on the system PATH.

    Uses shutil.which() to locate the restic executable.

    Returns:
        None if restic is available, or an error dict if missing.
    """
    if shutil.which("restic") is None:
        return {
            "success": False,
            "stdout": "",
            "stderr": "restic binary not found",
            "exit_code": -2,
            "duration": 0.0,
            "error": "restic_not_found",
            "message": "Restic is not installed on this server. Please re-run the configurator to install it.",
        }
    return None


def _categorize_restic_error(result: dict) -> dict:
    """Categorize a restic command result into a specific error type.

    Examines the result dict from _run_restic_command and returns a
    categorized error dict with a human-readable message and error code.

    Args:
        result: The result dict from _run_restic_command.

    Returns:
        Dict with keys: success (False), error (str), message (str),
        plus the original result fields (stdout, stderr, exit_code, duration).
    """
    stderr = result.get("stderr", "").lower()
    exit_code = result.get("exit_code", 1)

    # Timeout: exit_code -1 means the process was killed due to timeout
    if exit_code == -1:
        return {
            **result,
            "error": "timeout",
            "message": "Restic command timed out and was terminated. The operation may need more time or the repository may be unreachable.",
        }

    # Authentication failure: wrong repository password
    if "wrong password" in stderr:
        return {
            **result,
            "error": "auth_failed",
            "message": "Repository password is incorrect. Please check your backup configuration.",
        }

    # Storage full
    if "no space" in stderr:
        return {
            **result,
            "error": "storage_full",
            "message": "Backup storage is full. Free up space on the target or switch to a larger storage backend.",
        }

    # Generic/uncategorized error
    error_detail = result.get("stderr", "").strip() or "Unknown error"
    return {
        **result,
        "error": "restic_error",
        "message": f"Restic command failed: {error_detail}",
    }


async def _run_restic_command(args: list, config: dict, timeout: int | None = None) -> dict:
    """Execute a restic command with proper credential handling.

    Runs restic as a subprocess via run_in_executor so it doesn't block the
    event loop. Credentials are passed exclusively through environment
    variables — never as command-line arguments.

    Args:
        args: Command arguments (e.g., ["backup", "--files-from", "/tmp/paths.txt"]).
              The first element is treated as the command type for logging.
        config: Backup configuration dict (with decrypted credentials).
        timeout: Subprocess timeout in seconds. If None, defaults to 3600s for
                 backup/restore operations and 300s for status/list/snapshots/check.

    Returns:
        Dict with keys:
            success (bool): True if exit code is 0
            stdout (str): Captured standard output
            stderr (str): Captured standard error
            exit_code (int): Process exit code (-1 on timeout)
            duration (float): Wall-clock seconds the command ran
    """
    # Determine the command type for logging and default timeout
    cmd_type = args[0] if args else "unknown"

    if timeout is None:
        # Long-running operations get 1 hour; quick operations get 5 minutes
        long_running = {"backup", "restore"}
        timeout = 3600 if cmd_type in long_running else 300

    # Check that restic binary is available before attempting to run
    restic_check = _check_restic_available()
    if restic_check is not None:
        logger.error("Restic binary not found — cannot execute '%s' command", cmd_type)
        return restic_check

    # Build the full command
    full_cmd = ["restic"] + args

    # Build environment: inherit current env + add credential env vars
    env = os.environ.copy()
    cred_env = _get_credential_env_vars(config)
    env.update(cred_env)

    # Log the start of the operation (without credential values)
    logger.info(
        "Restic command starting: type=%s, args_count=%d, timeout=%ds",
        cmd_type, len(args), timeout
    )

    start_time = time.monotonic()

    def _execute():
        """Run the subprocess in a thread (called via run_in_executor)."""
        try:
            result = subprocess.run(
                full_cmd,
                env=env,
                capture_output=True,
                text=True,
                timeout=timeout,
            )
            return {
                "success": result.returncode == 0,
                "stdout": result.stdout,
                "stderr": result.stderr,
                "exit_code": result.returncode,
                "timed_out": False,
            }
        except subprocess.TimeoutExpired as e:
            # The process is killed automatically by subprocess.run on timeout
            return {
                "success": False,
                "stdout": e.stdout if e.stdout else "",
                "stderr": e.stderr if e.stderr else "",
                "exit_code": -1,
                "timed_out": True,
            }

    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, _execute)

    duration = time.monotonic() - start_time

    # Add duration to result
    result["duration"] = round(duration, 2)

    # Log completion (without credential values)
    if result["timed_out"]:
        logger.error(
            "Restic command timed out: type=%s, timeout=%ds, duration=%.2fs",
            cmd_type, timeout, duration
        )
    elif result["success"]:
        logger.info(
            "Restic command completed: type=%s, exit_code=%d, duration=%.2fs",
            cmd_type, result["exit_code"], duration
        )
    else:
        logger.warning(
            "Restic command failed: type=%s, exit_code=%d, duration=%.2fs",
            cmd_type, result["exit_code"], duration
        )

    # Remove internal flag before returning
    del result["timed_out"]

    return result


# ═══════════════════════════════════════════════════════════════════════════
# Pre-backup database copy
# ═══════════════════════════════════════════════════════════════════════════

# Module-level lock to prevent concurrent backup operations
_backup_lock = asyncio.Lock()

PRE_BACKUP_DB_PATH = "/tmp/cwoc-pre-backup.db"


async def _create_pre_backup_copy() -> bool:
    """Create a consistent database copy via sqlite3 .backup command.

    Executes `sqlite3 /app/data/app.db ".backup /tmp/cwoc-pre-backup.db"` in a
    thread executor to avoid blocking the event loop. This ensures the backed-up
    database is not corrupted by concurrent writes.

    Returns:
        True on success, False on failure (backup should be aborted).
    """
    cmd = ["sqlite3", str(DB_PATH), f".backup {PRE_BACKUP_DB_PATH}"]

    def _run():
        return subprocess.run(cmd, capture_output=True, text=True, timeout=60)

    try:
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, _run)

        if result.returncode == 0:
            logger.info("Pre-backup database copy created at %s", PRE_BACKUP_DB_PATH)
            return True
        else:
            logger.error(
                "Pre-backup database copy failed (exit code %d): %s",
                result.returncode,
                result.stderr.strip() if result.stderr else "unknown error",
            )
            return False
    except subprocess.TimeoutExpired:
        logger.error("Pre-backup database copy timed out after 60 seconds")
        return False
    except Exception as e:
        logger.error("Pre-backup database copy failed with exception: %s", e)
        return False


# ═══════════════════════════════════════════════════════════════════════════
# Notification integration — sends via existing ntfy system
# ═══════════════════════════════════════════════════════════════════════════

async def _send_backup_notification(config: dict, result: dict) -> None:
    """Send a backup/restore/prune completion notification via ntfy.

    Uses the existing send_ntfy_notification() from routes/ntfy.py to deliver
    push notifications to configured admin recipients. Respects notification
    preferences for operation type (transfer vs maintenance) and trigger
    condition (success only, failure only, or both).

    Silently skips notification if ntfy is disabled/not configured or if
    any error occurs during the send — never raises to the caller.

    Args:
        config: Backup configuration dict (contains notification preferences).
        result: The operation result dict with keys:
            - success (bool): Whether the operation succeeded
            - message (str): Human-readable result description
            - operation (str, optional): "backup", "restore", or "prune" (defaults to "backup")
    """
    try:
        # Step 1: Determine operation type
        operation = result.get("operation", "backup")

        # Step 2: Check if this operation type should send notifications
        # backup/restore = transfer; prune = maintenance
        if operation in ("backup", "restore"):
            if not config.get("notification_transfer", True):
                logger.debug("Backup notification skipped: transfer notifications disabled")
                return
        elif operation == "prune":
            if not config.get("notification_maintenance", True):
                logger.debug("Backup notification skipped: maintenance notifications disabled")
                return

        # Step 3: Check if the trigger preference matches the result
        notification_prefs = config.get("notification_recipients", {})
        trigger = notification_prefs.get("trigger", "both")

        is_success = result.get("success", False)

        if trigger == "success" and not is_success:
            logger.debug("Backup notification skipped: trigger is 'success' but operation failed")
            return
        elif trigger == "failure" and is_success:
            logger.debug("Backup notification skipped: trigger is 'failure' but operation succeeded")
            return
        # trigger == "both" always sends

        # Step 4: Determine recipients
        admins = notification_prefs.get("admins", "all")

        # Get the list of user IDs to notify
        recipient_ids = _get_notification_recipients(admins)
        if not recipient_ids:
            logger.debug("Backup notification skipped: no recipients found")
            return

        # Step 5: Format the notification
        title = "CWOC Backup"
        body = _format_notification_body(operation, result)

        # Step 6: Send to each recipient
        from src.backend.routes.ntfy import send_ntfy_notification

        for user_id in recipient_ids:
            try:
                ntfy_result = send_ntfy_notification(
                    user_id=user_id,
                    title=title,
                    body=body,
                    tags="white_check_mark" if is_success else "x",
                    priority=3 if is_success else 4,
                )
                if ntfy_result.get("sent"):
                    logger.info("Backup notification sent to user %s", user_id)
                else:
                    reason = ntfy_result.get("reason", "unknown")
                    logger.debug("Backup notification not sent to user %s: %s", user_id, reason)
            except Exception as e:
                logger.warning("Failed to send backup notification to user %s: %s", user_id, e)

    except Exception as e:
        # Never raise to the caller — notification failures are non-fatal
        logger.warning("Backup notification failed (non-fatal): %s", e)


def _get_notification_recipients(admins) -> list:
    """Resolve the notification recipients to a list of user IDs.

    Args:
        admins: Either the string "all" (notify all users) or a list of
                specific user IDs.

    Returns:
        List of user_id strings to notify. Empty list if none found.
    """
    if isinstance(admins, list):
        return admins

    # "all" — query all user IDs from the settings table
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT user_id FROM settings")
        rows = cursor.fetchall()
        return [row[0] for row in rows if row[0]]
    except Exception as e:
        logger.warning("Failed to query notification recipients: %s", e)
        return []
    finally:
        if conn:
            conn.close()


def _format_notification_body(operation: str, result: dict) -> str:
    """Format the notification body with operation type, result, and details.

    Args:
        operation: "backup", "restore", or "prune"
        result: The operation result dict (success, message, duration, snapshot_id, etc.)

    Returns:
        Formatted notification body string.
    """
    op_label = operation.capitalize()
    is_success = result.get("success", False)
    status = "completed successfully" if is_success else "failed"
    message = result.get("message", "")

    # Build the body
    body = f"{op_label} {status}"

    # Add relevant details
    details = []
    if result.get("duration"):
        details.append(f"{result['duration']:.1f}s")
    if result.get("snapshot_id") and is_success:
        details.append(f"snapshot {result['snapshot_id']}")

    if details:
        body += f" — {', '.join(details)}"

    # If failed and message has more info than just the status, append it
    if not is_success and message and message != body:
        # Avoid duplicating the operation name in the body
        if not message.lower().startswith(op_label.lower()):
            body += f"\n{message}"
        else:
            body = message

    return body


# ═══════════════════════════════════════════════════════════════════════════
# Core backup orchestration
# ═══════════════════════════════════════════════════════════════════════════

async def _run_backup(config: dict) -> dict:
    """Execute a full backup operation with pre-backup copy, restic backup, and cleanup.

    Orchestrates the complete backup workflow:
    1. Acquire the backup lock (non-blocking). If already held, return error.
    2. Create a pre-backup database copy. If it fails, abort.
    3. Build the restic backup command with selected paths from config.
    4. Execute restic backup via _run_restic_command.
    5. Clean up /tmp/cwoc-pre-backup.db (always, success or failure).
    6. Update config with last_backup_time, last_backup_result, and backup_history.
    7. Persist updated config to the database.
    8. Send notification (stub for now).
    9. Return result dict.

    Args:
        config: Backup configuration dict (with decrypted credentials and backup_paths).

    Returns:
        Dict with keys:
            success (bool): Whether the backup completed successfully
            message (str): Human-readable result description
            snapshot_id (str|None): Snapshot ID on success, None on failure
            duration (float): Total operation duration in seconds
            error (str|None): Error type identifier on failure
    """
    start_time = time.monotonic()

    # Step 1: Try to acquire the lock (non-blocking)
    if _backup_lock.locked():
        return {
            "success": False,
            "message": "A backup is already in progress",
            "snapshot_id": None,
            "duration": 0.0,
            "error": "backup_in_progress",
        }

    async with _backup_lock:
        try:
            # Step 2: Create pre-backup database copy
            copy_ok = await _create_pre_backup_copy()
            if not copy_ok:
                result = {
                    "success": False,
                    "message": "Failed to create pre-backup database copy",
                    "snapshot_id": None,
                    "duration": round(time.monotonic() - start_time, 2),
                    "error": "pre_backup_copy_failed",
                }
                await _send_backup_notification(config, result)
                return result

            # Step 3: Build the file list from selected paths in config
            paths = config.get("backup_paths", [])
            if not paths:
                result = {
                    "success": False,
                    "message": "No backup paths configured",
                    "snapshot_id": None,
                    "duration": round(time.monotonic() - start_time, 2),
                    "error": "no_paths_configured",
                }
                await _send_backup_notification(config, result)
                return result

            # Step 4: Execute restic backup with selected paths
            restic_result = await _run_restic_command(["backup"] + paths, config)

            # Parse snapshot ID from restic output if successful
            snapshot_id = None
            if restic_result["success"]:
                # restic outputs "snapshot <id> saved" on success
                stdout = restic_result.get("stdout", "")
                for line in stdout.splitlines():
                    if "snapshot" in line and "saved" in line:
                        parts = line.split()
                        for i, part in enumerate(parts):
                            if part == "snapshot" and i + 1 < len(parts):
                                snapshot_id = parts[i + 1]
                                break
                        if snapshot_id:
                            break

            # Build the result
            duration = round(time.monotonic() - start_time, 2)
            if restic_result["success"]:
                result = {
                    "success": True,
                    "message": "Backup completed successfully",
                    "snapshot_id": snapshot_id,
                    "duration": duration,
                    "error": None,
                }
            else:
                error_msg = restic_result.get("stderr", "").strip() or "Unknown error"
                result = {
                    "success": False,
                    "message": f"Backup failed: {error_msg}",
                    "snapshot_id": None,
                    "duration": duration,
                    "error": "restic_error",
                }

        finally:
            # Step 5: Always delete the pre-backup copy
            try:
                if os.path.exists(PRE_BACKUP_DB_PATH):
                    os.remove(PRE_BACKUP_DB_PATH)
                    logger.info("Deleted pre-backup database copy at %s", PRE_BACKUP_DB_PATH)
            except OSError as e:
                logger.warning("Failed to delete pre-backup copy: %s", e)

        # Step 6: Update config with backup results
        now = datetime.now(timezone.utc).isoformat()
        config["last_backup_time"] = now
        config["last_backup_result"] = {
            "success": result["success"],
            "message": result["message"],
            "snapshot_id": result.get("snapshot_id"),
            "duration": result["duration"],
        }

        # Step 7: Append to backup_history (max 10 entries, trim oldest)
        history = config.get("backup_history", [])
        if not isinstance(history, list):
            history = []
        history_entry = {
            "timestamp": now,
            "success": result["success"],
            "message": result["message"],
            "snapshot_id": result.get("snapshot_id"),
            "duration": result["duration"],
        }
        history.append(history_entry)
        # Keep only the 10 most recent entries
        if len(history) > 10:
            history = history[-10:]
        config["backup_history"] = history

        # Step 8: Persist updated config
        _save_backup_config(config)

        # Step 9: Send notification
        await _send_backup_notification(config, result)

        # Step 10: Auto-prune if backup succeeded and retention policy is configured
        if result["success"]:
            retention = config.get("retention_policy", {})
            if retention and isinstance(retention, dict):
                has_any = any(
                    retention.get(k, 0) > 0
                    for k in ("keep_last", "keep_daily", "keep_weekly", "keep_monthly", "keep_yearly")
                )
                if has_any:
                    try:
                        prune_args = ["forget", "--prune"]
                        for key, flag in [
                            ("keep_last", "--keep-last"),
                            ("keep_daily", "--keep-daily"),
                            ("keep_weekly", "--keep-weekly"),
                            ("keep_monthly", "--keep-monthly"),
                            ("keep_yearly", "--keep-yearly"),
                        ]:
                            val = retention.get(key, 0)
                            if val and int(val) > 0:
                                prune_args.extend([flag, str(int(val))])
                        prune_result = await _run_restic_command(prune_args, config, timeout=600)
                        if prune_result["success"]:
                            logger.info("Auto-prune completed successfully after backup")
                        else:
                            logger.warning("Auto-prune failed after backup: %s", prune_result.get("stderr", ""))
                    except Exception as e:
                        logger.warning("Auto-prune error after backup: %s", e)

        return result


# ═══════════════════════════════════════════════════════════════════════════
# API Endpoints — Configuration (Multi-Target)
# ═══════════════════════════════════════════════════════════════════════════

_PASSWORD_MASK = "••••••••"


def _mask_config_for_response(config: dict) -> dict:
    """Mask sensitive fields in a config dict for API response."""
    has_password = bool(config.get("repo_password"))
    masked_password = _PASSWORD_MASK if has_password else ""

    masked_credentials = {}
    backend_creds = config.get("backend_credentials", {})
    for key, value in backend_creds.items():
        masked_credentials[key] = _PASSWORD_MASK if value else ""

    return {
        "id": config.get("id"),
        "name": config.get("name", "Backup"),
        "configured": True,
        "enabled": config.get("enabled", False),
        "repo_type": config.get("repo_type", "local"),
        "repo_url": config.get("repo_url", ""),
        "repo_password": masked_password,
        "backend_credentials": masked_credentials,
        "backup_paths": config.get("backup_paths", []),
        "schedule_frequency": config.get("schedule_frequency", "daily"),
        "schedule_time": config.get("schedule_time", "02:00"),
        "retention_policy": config.get("retention_policy", {}),
        "notification_recipients": config.get("notification_recipients", {}),
        "notification_transfer": config.get("notification_transfer", True),
        "notification_maintenance": config.get("notification_maintenance", True),
        "last_backup_time": config.get("last_backup_time"),
        "last_backup_result": config.get("last_backup_result"),
        "next_backup_time": config.get("next_backup_time"),
    }


@router.get("/targets")
def get_backup_targets(request: Request):
    """Return all backup target configurations (summary list).

    Requires admin access. Passwords are masked.
    Includes repo_size for local targets (computed from disk).
    Also detects orphaned local repos (data on disk with no config).
    """
    require_admin(request)

    configs = _load_all_backup_configs()

    targets = []
    configured_local_paths = set()

    for c in configs:
        masked = _mask_config_for_response(c)
        # Compute repo size for local targets (fast disk check)
        if c.get("repo_type") == "local" and c.get("repo_url"):
            masked["repo_size"] = _get_local_dir_size_formatted(c["repo_url"])
            configured_local_paths.add(os.path.normpath(c["repo_url"]))
        else:
            masked["repo_size"] = None
        targets.append(masked)

    # Detect orphaned local repos — directories with a restic config file
    # that aren't referenced by any backup target
    orphans = []
    backup_base = "/app/data/backups"
    if os.path.isdir(backup_base):
        for entry in os.listdir(backup_base):
            entry_path = os.path.normpath(os.path.join(backup_base, entry))
            if not os.path.isdir(entry_path):
                continue
            # Check if it's a restic repo (has a "config" file)
            if not os.path.isfile(os.path.join(entry_path, "config")):
                continue
            # Skip if it's already configured
            if entry_path in configured_local_paths:
                continue
            # It's an orphan
            orphans.append({
                "path": entry_path,
                "repo_size": _get_local_dir_size_formatted(entry_path),
            })

    return {"targets": targets, "orphans": orphans}


@router.get("/config")
def get_backup_config(request: Request, target_id: str = None):
    """Return a single backup target configuration with passwords masked.

    If target_id is provided, returns that specific target.
    If not provided, returns the first target (backward compat).

    Requires admin access.
    """
    require_admin(request)

    config = _load_backup_config(target_id)
    if not config:
        return {
            "configured": False,
            "enabled": False,
            "repo_type": "local",
            "repo_url": "",
            "repo_password": "",
            "backend_credentials": {},
            "backup_paths": [],
            "schedule_frequency": "daily",
            "schedule_time": "02:00",
            "retention_policy": {},
            "notification_recipients": {},
            "notification_transfer": True,
            "notification_maintenance": True,
        }

    return _mask_config_for_response(config)


@router.post("/config")
async def save_backup_config_endpoint(request: Request):
    """Save or update a backup target configuration.

    If 'id' is provided in the body, updates that target.
    If no 'id', creates a new target (runs restic init).
    If restic init fails, returns error and does not persist.

    Requires admin access.
    """
    require_admin(request)

    body = await request.json()

    target_id = body.get("id")

    # Build the config dict from the request body
    new_config = {
        "id": target_id,
        "name": body.get("name", "Backup"),
        "enabled": body.get("enabled", False),
        "repo_type": body.get("repo_type", "local"),
        "repo_url": body.get("repo_url", ""),
        "repo_password": body.get("repo_password", ""),
        "backend_credentials": body.get("backend_credentials", {}),
        "backup_paths": body.get("backup_paths", []),
        "schedule_frequency": body.get("schedule_frequency", "daily"),
        "schedule_time": body.get("schedule_time", "02:00"),
        "retention_policy": body.get("retention_policy", {}),
        "notification_recipients": body.get("notification_recipients", {}),
        "notification_transfer": body.get("notification_transfer", True),
        "notification_maintenance": body.get("notification_maintenance", True),
    }

    # If updating an existing target, preserve masked passwords
    existing_config = _load_backup_config(target_id) if target_id else None

    if new_config["repo_password"] == _PASSWORD_MASK and existing_config:
        new_config["repo_password"] = existing_config.get("repo_password", "")

    if existing_config and existing_config.get("backend_credentials"):
        existing_creds = existing_config["backend_credentials"]
        for key, value in new_config["backend_credentials"].items():
            if value == _PASSWORD_MASK and key in existing_creds:
                new_config["backend_credentials"][key] = existing_creds[key]

    # Determine if this is a new target (no existing row)
    is_new_target = existing_config is None

    # Check for duplicate repo URL — prevent two targets pointing at the same repository
    if is_new_target:
        effective_url = _build_repo_url(new_config)
        if effective_url:
            all_configs = _load_all_backup_configs()
            for existing in all_configs:
                if _build_repo_url(existing) == effective_url:
                    return {
                        "success": False,
                        "error": "duplicate_repo",
                        "message": f"A backup target already exists for this repository ({existing.get('name', 'Unnamed')}). Each target must use a unique repository location.",
                    }

    if is_new_target:
        # For local repos, ensure the parent directory exists
        if new_config.get("repo_type") == "local":
            repo_path = new_config.get("repo_url", "/app/data/backups/restic")
            try:
                os.makedirs(repo_path, exist_ok=True)
                logger.info("Ensured local backup directory exists: %s", repo_path)
            except OSError as e:
                logger.error("Failed to create local backup directory %s: %s", repo_path, e)
                return {
                    "success": False,
                    "error": "dir_create_failed",
                    "message": f"Failed to create backup directory: {e}",
                }

        # Run restic init to initialize the repository
        init_result = await _run_restic_command(["init"], new_config)

        if not init_result["success"]:
            # If the repo already exists, that's fine — treat as success
            stderr = init_result.get("stderr", "")
            if "config file already exists" in stderr or "already initialized" in stderr:
                logger.info("Backup repository already initialized at %s — reusing existing repo", new_config.get("repo_url"))
            else:
                logger.error(
                    "restic init failed (exit_code=%d): %s",
                    init_result["exit_code"],
                    stderr,
                )
                return {
                    "success": False,
                    "error": "init_failed",
                    "message": "Failed to initialize backup repository. Check your repository URL, password, and credentials.",
                    "details": stderr,
                }
        else:
            logger.info("Backup repository initialized successfully")
    else:
        # Preserve runtime fields from existing config
        new_config["last_backup_time"] = existing_config.get("last_backup_time")
        new_config["last_backup_result"] = existing_config.get("last_backup_result")
        new_config["next_backup_time"] = existing_config.get("next_backup_time")
        new_config["last_check_time"] = existing_config.get("last_check_time")
        new_config["backup_history"] = existing_config.get("backup_history", [])
        new_config["retry_count"] = existing_config.get("retry_count", 0)

    # Save the configuration
    save_result = _save_backup_config(new_config)
    if not save_result.get("success"):
        return {
            "success": False,
            "error": "save_failed",
            "message": "Failed to save backup configuration to database.",
            "details": save_result.get("error", "Unknown error"),
        }

    return {"success": True, "id": new_config["id"]}


@router.delete("/config/{target_id}")
def delete_backup_target(target_id: str, request: Request):
    """Delete a backup target configuration.

    Requires admin access.
    """
    require_admin(request)

    deleted = _delete_backup_config(target_id)
    if not deleted:
        return {"success": False, "error": "not_found", "message": "Backup target not found."}

    return {"success": True}


@router.delete("/config/{target_id}/destroy")
def delete_backup_target_and_data(target_id: str, request: Request):
    """Delete a backup target configuration AND its repository data.

    This is destructive and irreversible — all snapshots are permanently lost.
    Requires admin access.
    """
    require_admin(request)

    # Load the config first so we know where the repo is
    config = _load_backup_config(target_id)
    if not config:
        return {"success": False, "error": "not_found", "message": "Backup target not found."}

    # Determine the repo path to delete
    repo_type = config.get("repo_type", "local")
    repo_url = config.get("repo_url", "")

    # Only delete local repo data automatically — remote repos require manual cleanup
    data_deleted = False
    if repo_type == "local" and repo_url:
        try:
            if os.path.isdir(repo_url):
                shutil.rmtree(repo_url)
                logger.info("Deleted local backup repository at %s", repo_url)
                data_deleted = True
            else:
                logger.warning("Local backup path does not exist: %s", repo_url)
                data_deleted = True  # Nothing to delete = success
        except OSError as e:
            logger.error("Failed to delete backup repository at %s: %s", repo_url, e)
            return {
                "success": False,
                "error": "delete_data_failed",
                "message": f"Failed to delete repository data: {e}",
            }
    elif repo_type != "local":
        # For remote repos, we can't delete the data — just remove the config
        logger.info("Remote repo (%s) — config removed but remote data must be deleted manually", repo_type)

    # Delete the config from the database
    deleted = _delete_backup_config(target_id)
    if not deleted:
        return {"success": False, "error": "db_delete_failed", "message": "Failed to remove configuration from database."}

    return {
        "success": True,
        "data_deleted": data_deleted,
        "message": "Backup target and repository data deleted." if data_deleted else "Configuration removed. Remote repository data must be deleted manually.",
    }


@router.delete("/orphan")
def delete_orphan_repo(request: Request, path: str = None):
    """Delete an orphaned local backup repository (data on disk with no config).

    Only allows deletion of directories under /app/data/backups/ that contain
    a restic config file and are not referenced by any backup target.

    Requires admin access.
    """
    require_admin(request)

    if not path:
        return {"success": False, "error": "missing_path", "message": "Path is required."}

    # Security: only allow paths under the backup base directory
    backup_base = "/app/data/backups"
    norm_path = os.path.normpath(path)
    if not norm_path.startswith(backup_base):
        return {"success": False, "error": "invalid_path", "message": "Path must be under /app/data/backups/."}

    # Verify it's actually a restic repo
    if not os.path.isdir(norm_path) or not os.path.isfile(os.path.join(norm_path, "config")):
        return {"success": False, "error": "not_a_repo", "message": "Path is not a valid restic repository."}

    # Verify it's not referenced by any config
    configs = _load_all_backup_configs()
    for c in configs:
        if c.get("repo_type") == "local" and os.path.normpath(c.get("repo_url", "")) == norm_path:
            return {"success": False, "error": "not_orphan", "message": "This repository is still referenced by a backup target. Use Delete All instead."}

    # Delete it
    try:
        shutil.rmtree(norm_path)
        logger.info("Deleted orphaned backup repository at %s", norm_path)
        return {"success": True, "message": "Orphaned repository data deleted."}
    except OSError as e:
        logger.error("Failed to delete orphaned repo at %s: %s", norm_path, e)
        return {"success": False, "error": "delete_failed", "message": f"Failed to delete: {e}"}


# ═══════════════════════════════════════════════════════════════════════════
# API Endpoints — Snapshots
# ═══════════════════════════════════════════════════════════════════════════


@router.get("/snapshots")
async def get_backup_snapshots(request: Request, target_id: str = None):
    """List all snapshots in the backup repository.

    Runs `restic snapshots --json` and returns the parsed snapshot list.
    Each snapshot includes id, short_id, time, hostname, and paths.

    Requires admin access. target_id specifies which backup target to query.
    """
    require_admin(request)

    config = _load_backup_config(target_id)
    if not config:
        return {
            "success": False,
            "error": "not_configured",
            "message": "Backup target not found or not configured.",
            "snapshots": [],
        }

    result = await _run_restic_command(["snapshots", "--json"], config)

    if not result["success"]:
        stderr = result.get("stderr", "").strip()

        # Check for authentication error
        if "wrong password" in stderr.lower():
            return {
                "success": False,
                "error": "auth_failed",
                "message": "Repository password is incorrect. Please check your backup configuration.",
                "snapshots": [],
            }

        # Generic connectivity / other error
        return {
            "success": False,
            "error": "repo_error",
            "message": f"Failed to list snapshots: {stderr or 'Repository unreachable or unknown error'}",
            "snapshots": [],
        }

    # Parse the JSON output from restic
    stdout = result.get("stdout", "").strip()
    try:
        raw_snapshots = json.loads(stdout) if stdout else []
    except (json.JSONDecodeError, TypeError):
        return {
            "success": False,
            "error": "parse_error",
            "message": "Failed to parse snapshot data from restic.",
            "snapshots": [],
        }

    # Extract relevant fields from each snapshot
    snapshots = []
    for snap in raw_snapshots:
        snapshots.append({
            "id": snap.get("id", ""),
            "short_id": snap.get("short_id", ""),
            "time": snap.get("time", ""),
            "hostname": snap.get("hostname", ""),
            "paths": snap.get("paths", []),
            "summary": snap.get("summary", {}),
        })

    # Fetch per-snapshot sizes via `restic stats` for each snapshot
    for snap_info in snapshots:
        try:
            stats_result = await _run_restic_command(
                ["stats", snap_info["id"], "--json"], config, timeout=60
            )
            if stats_result["success"] and stats_result.get("stdout"):
                stats_data = json.loads(stats_result["stdout"])
                snap_info["summary"]["total_size"] = stats_data.get("total_size", 0)
        except Exception:
            pass  # Size unavailable — leave summary as-is

    return {
        "success": True,
        "snapshots": snapshots,
    }


@router.get("/snapshots/{snapshot_id}/size")
async def get_snapshot_size(snapshot_id: str, request: Request, target_id: str = None):
    """Get the size of a specific snapshot.

    Runs `restic stats <snapshot_id> --json` and returns the total size.

    Requires admin access.
    """
    require_admin(request)

    config = _load_backup_config(target_id)
    if not config:
        return {"success": False, "error": "not_configured", "size": None}

    result = await _run_restic_command(["stats", snapshot_id, "--json"], config)
    if not result["success"]:
        return {"success": False, "error": "stats_failed", "size": None}

    try:
        stats = json.loads(result["stdout"])
        total_size = stats.get("total_size", 0)
        return {"success": True, "size": total_size, "size_formatted": _format_bytes(total_size)}
    except (json.JSONDecodeError, TypeError):
        return {"success": False, "error": "parse_error", "size": None}


@router.get("/snapshots/{snapshot_id}/download")
async def download_snapshot(snapshot_id: str, request: Request, target_id: str = None):
    """Download a snapshot as a tar.gz archive.

    Restores the snapshot to a temporary directory, creates a tar.gz archive,
    and streams it as a file download. Cleans up the temp directory afterward.

    Requires admin access.
    """
    from fastapi.responses import FileResponse
    import tempfile
    import tarfile

    require_admin(request)

    config = _load_backup_config(target_id)
    if not config:
        return {"success": False, "error": "not_configured", "message": "Backup target not found."}

    # Create a temp directory for the restore
    export_dir = tempfile.mkdtemp(prefix="cwoc-export-")
    archive_path = export_dir + ".tar.gz"

    try:
        # Restore snapshot to temp directory
        restore_result = await _run_restic_command(
            ["restore", snapshot_id, "--target", export_dir],
            config,
        )

        if not restore_result["success"]:
            return {
                "success": False,
                "error": "restore_failed",
                "message": f"Failed to export snapshot: {restore_result.get('stderr', 'Unknown error')}",
            }

        # Create tar.gz archive
        loop = asyncio.get_event_loop()

        def _create_archive():
            with tarfile.open(archive_path, "w:gz") as tar:
                tar.add(export_dir, arcname="cwoc-backup")

        await loop.run_in_executor(None, _create_archive)

        # Return the file as a download
        filename = f"cwoc-backup-{snapshot_id[:8]}.tar.gz"
        return FileResponse(
            path=archive_path,
            filename=filename,
            media_type="application/gzip",
            background=_cleanup_export(export_dir, archive_path),
        )

    except Exception as e:
        logger.error(f"Snapshot download failed: {e}")
        # Clean up on error
        import shutil as _shutil
        _shutil.rmtree(export_dir, ignore_errors=True)
        if os.path.exists(archive_path):
            os.remove(archive_path)
        return {"success": False, "error": "export_failed", "message": str(e)}


def _cleanup_export(export_dir: str, archive_path: str):
    """Background task to clean up export temp files after download completes."""
    from starlette.background import BackgroundTask
    import shutil as _shutil

    async def _do_cleanup():
        _shutil.rmtree(export_dir, ignore_errors=True)
        if os.path.exists(archive_path):
            os.remove(archive_path)

    return BackgroundTask(_do_cleanup)


@router.delete("/snapshots/{snapshot_id}")
async def delete_snapshot(snapshot_id: str, request: Request, target_id: str = None):
    """Delete a single snapshot from the repository using `restic forget`.

    This permanently removes the snapshot. If it's the only snapshot referencing
    certain data, that data becomes eligible for cleanup (run prune to reclaim space).

    Requires admin access.
    """
    require_admin(request)

    config = _load_backup_config(target_id)
    if not config:
        return {"success": False, "error": "not_configured", "message": "Backup target not found."}

    # Use `restic forget <snapshot_id>` to remove just this snapshot
    result = await _run_restic_command(["forget", snapshot_id], config, timeout=120)

    if not result["success"]:
        error_msg = result.get("stderr", "").strip() or "Unknown error"
        logger.error("Failed to delete snapshot %s: %s", snapshot_id, error_msg)
        return {
            "success": False,
            "error": "forget_failed",
            "message": f"Failed to delete snapshot: {error_msg}",
        }

    logger.info("Deleted snapshot %s", snapshot_id)
    return {"success": True, "message": f"Snapshot {snapshot_id} deleted."}


# ═══════════════════════════════════════════════════════════════════════════
# API Endpoints — Manual Backup Trigger
# ═══════════════════════════════════════════════════════════════════════════


@router.post("/run")
async def run_backup_now(request: Request, target_id: str = None):
    """Trigger an immediate backup operation for a specific target.

    If target_id is provided, runs backup for that target only.
    If not provided, runs backup for all enabled targets.

    Requires admin access.
    """
    require_admin(request)

    if target_id:
        config = _load_backup_config(target_id)
        if not config:
            return {
                "success": False,
                "error": "not_configured",
                "message": "Backup target not found.",
            }
        result = await _run_backup(config)
        return result
    else:
        # Run all enabled targets
        configs = _load_all_backup_configs()
        if not configs:
            return {
                "success": False,
                "error": "not_configured",
                "message": "No backup targets configured.",
            }
        results = []
        for config in configs:
            if config.get("enabled"):
                result = await _run_backup(config)
                results.append({"target_id": config["id"], "name": config.get("name", "Backup"), **result})
        if not results:
            return {"success": False, "error": "none_enabled", "message": "No backup targets are enabled."}
        all_ok = all(r["success"] for r in results)
        return {"success": all_ok, "results": results}


# ═══════════════════════════════════════════════════════════════════════════
# API Endpoints — Restore
# ═══════════════════════════════════════════════════════════════════════════


@router.post("/restore")
async def restore_snapshot(request: Request):
    """Restore files from a specific backup snapshot.

    Accepts a JSON body with:
        snapshot_id (str, required): The snapshot ID to restore from.
        target (str, optional): Target path for restore. Defaults to "/".
        target_id (str, optional): Which backup target to restore from.

    Runs `restic restore <snapshot_id> --target <target>` and notifies the
    admin that a server restart may be required for database changes to take
    effect.

    Requires admin access.
    """
    require_admin(request)

    body = await request.json()
    backup_target_id = body.get("target_id")

    config = _load_backup_config(backup_target_id)
    if not config:
        return {
            "success": False,
            "error": "not_configured",
            "message": "Backup target not found or not configured.",
        }

    snapshot_id = body.get("snapshot_id")
    target = body.get("target", "/")

    if not snapshot_id:
        return {
            "success": False,
            "error": "missing_snapshot_id",
            "message": "snapshot_id is required.",
        }

    # Run restic restore
    restic_result = await _run_restic_command(
        ["restore", snapshot_id, "--target", target],
        config,
    )

    if restic_result["success"]:
        # Send notification about successful restore
        restore_notification = {
            "success": True,
            "message": f"Restore from snapshot {snapshot_id} completed successfully. Server restart may be required for database changes to take effect.",
            "operation": "restore",
        }
        await _send_backup_notification(config, restore_notification)

        return {
            "success": True,
            "message": "Restore completed successfully.",
            "note": "Server restart may be required for database changes to take effect.",
            "snapshot_id": snapshot_id,
            "target": target,
            "duration": restic_result["duration"],
        }
    else:
        error_msg = restic_result.get("stderr", "").strip() or "Unknown error"

        # Send notification about failed restore
        restore_notification = {
            "success": False,
            "message": f"Restore from snapshot {snapshot_id} failed: {error_msg}",
            "operation": "restore",
        }
        await _send_backup_notification(config, restore_notification)

        return {
            "success": False,
            "error": "restore_failed",
            "message": f"Restore failed: {error_msg}",
            "details": restic_result.get("stderr", ""),
            "snapshot_id": snapshot_id,
            "duration": restic_result["duration"],
        }


# ═══════════════════════════════════════════════════════════════════════════
# API Endpoints — Status Display
# ═══════════════════════════════════════════════════════════════════════════


@router.get("/info")
async def get_backup_info(request: Request, target_id: str = None):
    """Return current backup status information at a glance.

    Returns configured state, enabled state, last backup time/result,
    next scheduled backup time, repository size, and snapshot count.
    If no target_id, returns summary across all targets.

    Requires admin access.
    """
    require_admin(request)

    if target_id:
        config = _load_backup_config(target_id)
        if not config:
            return {"configured": False, "enabled": False}
    else:
        config = _load_backup_config()
        if not config:
            return {"configured": False, "enabled": False}

    # Base info from stored config
    info = {
        "configured": True,
        "enabled": config.get("enabled", False),
        "last_backup_time": config.get("last_backup_time"),
        "last_backup_result": config.get("last_backup_result"),
        "next_backup_time": config.get("next_backup_time"),
        "repo_size": None,
        "snapshot_count": 0,
    }

    # Try to get repo size via restic stats --json
    try:
        stats_result = await _run_restic_command(["stats", "--json"], config, timeout=300)
        if stats_result["success"] and stats_result.get("stdout"):
            stats_data = json.loads(stats_result["stdout"])
            total_size = stats_data.get("total_size", 0)
            # Format size to human-readable string
            info["repo_size"] = _format_bytes(total_size)
    except Exception as e:
        logger.warning("Failed to get repo stats for /info endpoint: %s", e)

    # Try to get snapshot count via restic snapshots --json
    try:
        snap_result = await _run_restic_command(["snapshots", "--json"], config, timeout=300)
        if snap_result["success"] and snap_result.get("stdout"):
            snapshots = json.loads(snap_result["stdout"])
            if isinstance(snapshots, list):
                info["snapshot_count"] = len(snapshots)
    except Exception as e:
        logger.warning("Failed to get snapshot count for /info endpoint: %s", e)

    return info


def _format_bytes(num_bytes: int) -> str:
    """Format a byte count into a human-readable string (e.g., '1.2 GB')."""
    if num_bytes < 1024:
        return f"{num_bytes} B"
    elif num_bytes < 1024 * 1024:
        return f"{num_bytes / 1024:.1f} KB"
    elif num_bytes < 1024 * 1024 * 1024:
        return f"{num_bytes / (1024 * 1024):.1f} MB"
    else:
        return f"{num_bytes / (1024 * 1024 * 1024):.1f} GB"


def _get_local_dir_size_formatted(path: str) -> str | None:
    """Get the total size of a local directory, formatted as a human-readable string.

    Returns None if the path doesn't exist or isn't accessible.
    """
    if not path or not os.path.isdir(path):
        return None
    try:
        total = 0
        for dirpath, _dirnames, filenames in os.walk(path):
            for f in filenames:
                fp = os.path.join(dirpath, f)
                try:
                    total += os.path.getsize(fp)
                except OSError:
                    pass
        return _format_bytes(total)
    except OSError:
        return None


# ═══════════════════════════════════════════════════════════════════════════
# API Endpoints — Repository Health Check
# ═══════════════════════════════════════════════════════════════════════════


@router.get("/status")
async def get_backup_status(request: Request, target_id: str = None):
    """Check repository health by running `restic check`.

    Returns repository reachability, last check timestamp, and any error
    messages. If no backup configuration exists, returns a "not_configured"
    status.

    Requires admin access. target_id specifies which backup target to check.
    """
    require_admin(request)

    config = _load_backup_config(target_id)
    if not config:
        return {"status": "not_configured"}

    # Run restic check against the configured repository
    check_result = await _run_restic_command(["check"], config)

    # Update last_check_time in config and persist
    now = datetime.now(timezone.utc).isoformat()
    config["last_check_time"] = now
    _save_backup_config(config)

    if check_result["success"]:
        return {
            "status": "healthy",
            "reachable": True,
            "last_check": now,
            "message": None,
        }
    else:
        error_msg = check_result.get("stderr", "").strip() or check_result.get("stdout", "").strip() or "Unknown error"
        return {
            "status": "error",
            "reachable": False,
            "last_check": now,
            "message": error_msg,
        }


# ═══════════════════════════════════════════════════════════════════════════
# API Endpoints — Prune (Retention Policy)
# ═══════════════════════════════════════════════════════════════════════════


@router.post("/prune")
async def prune_snapshots(request: Request, target_id: str = None):
    """Run restic forget --prune with configured retention flags.

    Applies the retention policy (keep-last, keep-daily, keep-weekly,
    keep-monthly, keep-yearly) to remove old snapshots and reclaim space.
    Refuses to prune if no retention policy values are configured.

    Requires admin access. target_id specifies which backup target to prune.
    """
    require_admin(request)

    config = _load_backup_config(target_id)
    if not config:
        return {
            "success": False,
            "error": "not_configured",
            "message": "Backup target not found or not configured.",
        }

    # Check that retention policy exists and has at least one non-zero value
    retention = config.get("retention_policy", {})
    if not retention or not isinstance(retention, dict):
        return {
            "success": False,
            "error": "no_retention_policy",
            "message": "No retention policy is configured. Set at least one retention value (keep-last, keep-daily, etc.) before pruning.",
        }

    # Map retention policy keys to restic flags
    flag_map = {
        "keep_last": "--keep-last",
        "keep_daily": "--keep-daily",
        "keep_weekly": "--keep-weekly",
        "keep_monthly": "--keep-monthly",
        "keep_yearly": "--keep-yearly",
    }

    # Build the forget command args, only including non-zero/non-null values
    forget_args = ["forget", "--prune"]
    has_any_flag = False

    for key, flag in flag_map.items():
        value = retention.get(key)
        if value and int(value) > 0:
            forget_args.extend([flag, str(int(value))])
            has_any_flag = True

    if not has_any_flag:
        return {
            "success": False,
            "error": "no_retention_policy",
            "message": "No retention policy values are set. Configure at least one keep-* value before pruning.",
        }

    # Run restic forget --prune with retention flags
    restic_result = await _run_restic_command(forget_args, config)

    if restic_result["success"]:
        # Parse output to determine snapshots removed and space reclaimed
        stdout = restic_result.get("stdout", "")
        stderr = restic_result.get("stderr", "")
        combined_output = stdout + "\n" + stderr

        snapshots_removed = _parse_snapshots_removed(combined_output)
        space_reclaimed = _parse_space_reclaimed(combined_output)

        # Send notification about successful prune
        prune_notification = {
            "success": True,
            "message": f"Prune completed: {snapshots_removed} snapshot(s) removed, {space_reclaimed} reclaimed.",
            "operation": "prune",
        }
        await _send_backup_notification(config, prune_notification)

        return {
            "success": True,
            "snapshots_removed": snapshots_removed,
            "space_reclaimed": space_reclaimed,
            "duration": restic_result["duration"],
        }
    else:
        error_msg = restic_result.get("stderr", "").strip() or "Unknown error"

        # Send notification about failed prune
        prune_notification = {
            "success": False,
            "message": f"Prune failed: {error_msg}",
            "operation": "prune",
        }
        await _send_backup_notification(config, prune_notification)

        return {
            "success": False,
            "error": "prune_failed",
            "message": f"Prune failed: {error_msg}",
            "details": restic_result.get("stderr", ""),
            "duration": restic_result["duration"],
        }


def _parse_snapshots_removed(output: str) -> int:
    """Parse restic forget output to count how many snapshots were removed.

    Restic outputs lines like "remove <N> snapshots" or lists individual
    snapshot removals. This function counts them from the combined output.
    """

    count = 0

    # Pattern: "remove N snapshots" (restic forget summary line)
    for match in re.finditer(r"remove\s+(\d+)\s+snapshot", output, re.IGNORECASE):
        count += int(match.group(1))

    # If no summary line found, count individual "removed snapshot <id>" lines
    if count == 0:
        count = len(re.findall(r"removing snapshot", output, re.IGNORECASE))

    return count


def _parse_space_reclaimed(output: str) -> str:
    """Parse restic prune output to find space reclaimed.

    Restic prune outputs lines like:
        "will delete 123 packs and free 456.789 MiB"
    or similar. Returns the human-readable size string, or "unknown" if
    not found in the output.
    """

    # Pattern: "free 123.456 MiB" or "free 1.23 GiB" etc.
    match = re.search(r"free\s+([\d.]+\s*[KMGT]i?B)", output, re.IGNORECASE)
    if match:
        return match.group(1).strip()

    # Alternative pattern: "reclaimed 123.456 MiB"
    match = re.search(r"reclaim(?:ed)?\s+([\d.]+\s*[KMGT]i?B)", output, re.IGNORECASE)
    if match:
        return match.group(1).strip()

    # Alternative: look for "deleted ... freeing ..."
    match = re.search(r"freeing\s+([\d.]+\s*[KMGT]i?B)", output, re.IGNORECASE)
    if match:
        return match.group(1).strip()

    return "unknown"


# ═══════════════════════════════════════════════════════════════════════════
# Backup Scheduler — asyncio background task
# ═══════════════════════════════════════════════════════════════════════════

# Module-level state for tracking next backup time per target
_target_schedule_state: dict = {}  # {target_id: {"next_time": datetime, "config_hash": str}}


def _config_schedule_hash(config: dict) -> str:
    """Return a simple hash of schedule-relevant config fields.

    Used to detect when the schedule configuration has changed so we can
    recalculate next_backup_time without requiring a server restart.
    """
    return f"{config.get('schedule_frequency')}|{config.get('schedule_time')}|{config.get('enabled')}"


def _calculate_next_run(config: dict) -> datetime | None:
    """Calculate the next scheduled backup time based on frequency and schedule_time.

    Args:
        config: Backup configuration dict with schedule_frequency and schedule_time fields.
            - schedule_frequency: "hourly", "every_6_hours", "daily", "weekly", "manual"
            - schedule_time: "HH:MM" string (used for daily and weekly)

    Returns:
        A datetime object (UTC) representing the next time a backup should run,
        or None if the schedule is "manual" or cannot be determined.

    Schedule logic:
        - hourly: next run is the top of the next hour
        - every_6_hours: next run is the next 6-hour boundary (00:00, 06:00, 12:00, 18:00)
        - daily: next run is today at schedule_time if not yet past, otherwise tomorrow
        - weekly: next run is next Monday at schedule_time (or today if Monday and not yet past)
    """
    frequency = config.get("schedule_frequency", "manual")
    schedule_time = config.get("schedule_time", "02:00")

    if frequency == "manual":
        return None

    now = datetime.now(timezone.utc)

    if frequency == "hourly":
        # Next run is the top of the next hour
        next_run = now.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)
        return next_run

    elif frequency == "every_6_hours":
        # Next 6-hour boundary: 00:00, 06:00, 12:00, 18:00
        current_hour = now.hour
        # Find the next boundary hour
        boundaries = [0, 6, 12, 18]
        next_boundary = None
        for b in boundaries:
            if b > current_hour:
                next_boundary = b
                break
        if next_boundary is None:
            # Past 18:00, next boundary is 00:00 tomorrow
            next_run = (now + timedelta(days=1)).replace(
                hour=0, minute=0, second=0, microsecond=0
            )
        else:
            next_run = now.replace(
                hour=next_boundary, minute=0, second=0, microsecond=0
            )
        return next_run

    elif frequency == "daily":
        # Parse schedule_time (HH:MM)
        try:
            parts = schedule_time.split(":")
            target_hour = int(parts[0])
            target_minute = int(parts[1]) if len(parts) > 1 else 0
        except (ValueError, IndexError):
            target_hour = 2
            target_minute = 0

        # Today at schedule_time
        today_run = now.replace(
            hour=target_hour, minute=target_minute, second=0, microsecond=0
        )
        if now < today_run:
            return today_run
        else:
            # Tomorrow at schedule_time
            return today_run + timedelta(days=1)

    elif frequency == "weekly":
        # Next Monday at schedule_time (or today if Monday and not yet past)
        try:
            parts = schedule_time.split(":")
            target_hour = int(parts[0])
            target_minute = int(parts[1]) if len(parts) > 1 else 0
        except (ValueError, IndexError):
            target_hour = 2
            target_minute = 0

        # Monday is weekday 0
        days_until_monday = (7 - now.weekday()) % 7
        if days_until_monday == 0:
            # Today is Monday — check if the time has passed
            today_run = now.replace(
                hour=target_hour, minute=target_minute, second=0, microsecond=0
            )
            if now < today_run:
                return today_run
            else:
                # Next Monday
                return today_run + timedelta(days=7)
        else:
            # Next Monday
            next_monday = now + timedelta(days=days_until_monday)
            return next_monday.replace(
                hour=target_hour, minute=target_minute, second=0, microsecond=0
            )

    return None


async def _backup_scheduler_loop():
    """Background task: run scheduled backups for all configured targets.

    Iterates over all backup targets each cycle. Each target has its own
    independent schedule, retry count, and next_backup_time.
    """
    global _target_schedule_state

    # Initial delay to let the server fully start
    await asyncio.sleep(30)
    logger.info("Backup scheduler started")

    while True:
        try:
            configs = _load_all_backup_configs()

            if not configs:
                await asyncio.sleep(60)
                continue

            now = datetime.now(timezone.utc)

            for config in configs:
                target_id = config.get("id")
                if not target_id:
                    continue

                # Skip if not enabled or schedule is manual
                if not config.get("enabled") or config.get("schedule_frequency") == "manual":
                    _target_schedule_state.pop(target_id, None)
                    continue

                # Get or create state for this target
                state = _target_schedule_state.get(target_id, {})
                current_hash = _config_schedule_hash(config)

                # Recalculate next_backup_time if config has changed
                if state.get("config_hash") != current_hash:
                    next_time = _calculate_next_run(config)
                    state = {"next_time": next_time, "config_hash": current_hash}
                    _target_schedule_state[target_id] = state
                    if next_time:
                        logger.info(
                            "Backup scheduler [%s]: next run recalculated to %s (frequency=%s)",
                            config.get("name", target_id),
                            next_time.isoformat(),
                            config.get("schedule_frequency"),
                        )
                        config["next_backup_time"] = next_time.isoformat()
                        _save_backup_config(config)

                # Check if it's time to run this target
                next_time = state.get("next_time")
                if next_time and now >= next_time:
                    target_name = config.get("name", target_id)
                    logger.info("Backup scheduler [%s]: scheduled backup is due, starting...", target_name)
                    result = await _run_backup(config)

                    # Reload config to get updated state from _run_backup
                    config = _load_backup_config(target_id)
                    if config:
                        if result.get("success"):
                            config["retry_count"] = 0
                            next_time = _calculate_next_run(config)
                            logger.info("Backup scheduler [%s]: backup succeeded", target_name)
                        else:
                            retry_count = config.get("retry_count", 0) + 1
                            config["retry_count"] = retry_count

                            if retry_count < 3:
                                next_time = datetime.now(timezone.utc) + timedelta(minutes=15)
                                logger.warning(
                                    "Backup scheduler [%s]: failed (attempt %d/3), retrying in 15 min",
                                    target_name, retry_count,
                                )
                            else:
                                config["retry_count"] = 0
                                next_time = _calculate_next_run(config)
                                logger.error(
                                    "Backup scheduler [%s]: failed after 3 attempts, giving up until next run",
                                    target_name,
                                )

                        # Persist and update state
                        state["next_time"] = next_time
                        state["config_hash"] = _config_schedule_hash(config)
                        _target_schedule_state[target_id] = state
                        if next_time:
                            config["next_backup_time"] = next_time.isoformat()
                        _save_backup_config(config)

        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Backup scheduler error: {e}")

        await asyncio.sleep(60)


async def start_backup_scheduler():
    """Create the backup scheduler asyncio task.

    Called from on_startup() in main.py to register the background task.
    """
    asyncio.create_task(_backup_scheduler_loop())
    logger.info("Backup scheduler task registered")
