"""Client and server log endpoints for remote diagnostics.

Provides:
  POST /api/client-log — receive log entries from mobile/remote clients
  GET /api/client-log  — return last 200 lines of client-log.txt
  GET /api/server-log  — return last 200 lines from journalctl -u cwoc

No authentication required (device diagnostics need to work pre-auth).
"""

import logging
import os
import sqlite3
import subprocess
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Request
from pydantic import BaseModel

from src.backend.db import DB_PATH

logger = logging.getLogger(__name__)
router = APIRouter()

# Log file paths — same /app/data/ directory as the database
CLIENT_LOG_PATH = "/app/data/client-log.txt"
UPDATE_LOG_PATH = "/app/data/update.log"
MAX_RETURN_LINES = 500
MAX_FILE_LINES = 5000  # Fallback line limit if settings unavailable


class ClientLogEntry(BaseModel):
    message: str
    level: Optional[str] = "info"
    source: Optional[str] = "unknown"
    timestamp: Optional[str] = None


@router.post("/api/client-log")
async def post_client_log(entry: ClientLogEntry, request: Request):
    """Append a log entry from a remote client to client-log.txt."""
    # Use client-provided timestamp if available, otherwise server UTC time
    ts = entry.timestamp or datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    level = (entry.level or "info").upper()
    source = entry.source or "unknown"
    line = f"[{ts}] [{level}] [{source}] {entry.message}\n"

    try:
        # Ensure data directory exists
        os.makedirs(os.path.dirname(CLIENT_LOG_PATH), exist_ok=True)

        # Append the line
        with open(CLIENT_LOG_PATH, "a", encoding="utf-8") as f:
            f.write(line)

        # Rotate if file is too large (keep last MAX_FILE_LINES lines)
        _maybe_rotate()

    except Exception as e:
        logger.error(f"Failed to write client log: {e}")
        return {"ok": False, "error": str(e)}

    return {"ok": True}


@router.get("/api/client-log")
async def get_client_log():
    """Return the last 200 lines of the client log."""
    if not os.path.exists(CLIENT_LOG_PATH):
        return {"lines": [], "count": 0}

    try:
        with open(CLIENT_LOG_PATH, "r", encoding="utf-8") as f:
            all_lines = f.readlines()

        tail = all_lines[-MAX_RETURN_LINES:]
        return {"lines": [l.rstrip("\n") for l in tail], "count": len(tail)}

    except Exception as e:
        logger.error(f"Failed to read client log: {e}")
        return {"lines": [], "count": 0, "error": str(e)}


@router.get("/api/server-log")
async def get_server_log(grep: str = None):
    """Return the last lines from the cwoc systemd service journal.

    Optional query param `grep` filters lines (case-insensitive substring match).
    When grep is provided, fetches more lines (5000) to find relevant entries.
    """
    try:
        n_lines = "5000" if grep else "500"
        result = subprocess.run(
            ["journalctl", "-u", "cwoc", "--no-pager", "-n", n_lines],
            capture_output=True,
            text=True,
            timeout=10
        )
        lines = result.stdout.strip().split("\n") if result.stdout.strip() else []
        if grep:
            grep_lower = grep.lower()
            lines = [l for l in lines if grep_lower in l.lower()]
        return {"lines": lines, "count": len(lines)}

    except FileNotFoundError:
        # journalctl not available (e.g., dev machine without systemd)
        return {"lines": ["journalctl not available on this system"], "count": 1}
    except subprocess.TimeoutExpired:
        return {"lines": ["journalctl timed out"], "count": 1, "error": "timeout"}
    except Exception as e:
        logger.error(f"Failed to read server log: {e}")
        return {"lines": [], "count": 0, "error": str(e)}


def _maybe_rotate():
    """Prune the client log based on settings (max age and max size).

    Falls back to line-count rotation if settings are unavailable.
    Also prunes the update log using the same limits.
    """
    try:
        max_days, max_mb = _get_log_limits()
        _prune_log_file(CLIENT_LOG_PATH, max_days, max_mb)
        _prune_log_file(UPDATE_LOG_PATH, max_days, max_mb)
    except Exception:
        # Fallback: simple line-count trim
        try:
            with open(CLIENT_LOG_PATH, "r", encoding="utf-8") as f:
                lines = f.readlines()
            if len(lines) > MAX_FILE_LINES:
                with open(CLIENT_LOG_PATH, "w", encoding="utf-8") as f:
                    f.writelines(lines[-MAX_FILE_LINES:])
        except Exception:
            pass


def _get_log_limits():
    """Read log_max_days and log_max_mb from settings. Returns (days, mb) or defaults."""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT log_max_days, log_max_mb FROM settings WHERE user_id = 'default_user'")
        row = cursor.fetchone()
        conn.close()
        if row:
            days = row[0] if row[0] is not None else 30
            mb = row[1] if row[1] is not None else 5
            return (days, mb)
    except Exception:
        pass
    return (30, 5)


def _prune_log_file(path, max_days, max_mb):
    """Prune a log file by age and size limits.

    Removes lines older than max_days, then trims from the top if file exceeds max_mb.
    If both limits are None/0, pruning is disabled.
    """
    if not os.path.exists(path):
        return

    if not max_days and not max_mb:
        return  # Pruning disabled

    try:
        with open(path, "r", encoding="utf-8") as f:
            lines = f.readlines()

        if not lines:
            return

        pruned = lines

        # Age-based pruning: remove lines older than max_days
        if max_days and max_days > 0:
            cutoff = datetime.utcnow() - timedelta(days=max_days)
            cutoff_str = cutoff.strftime("%Y-%m-%d %H:%M:%S")
            # Lines are formatted as [YYYY-MM-DD HH:MM:SS] ...
            # Keep lines where the timestamp is >= cutoff
            new_lines = []
            for line in pruned:
                if line.startswith("[") and "]" in line:
                    ts_str = line[1:line.index("]")]
                    if ts_str >= cutoff_str:
                        new_lines.append(line)
                else:
                    new_lines.append(line)  # Keep lines without timestamps
            pruned = new_lines

        # Size-based pruning: trim from the top if file exceeds max_mb
        if max_mb and max_mb > 0:
            max_bytes = max_mb * 1024 * 1024
            total_size = sum(len(l.encode("utf-8")) for l in pruned)
            while total_size > max_bytes and len(pruned) > 1:
                removed = pruned.pop(0)
                total_size -= len(removed.encode("utf-8"))

        # Only rewrite if we actually pruned something
        if len(pruned) < len(lines):
            with open(path, "w", encoding="utf-8") as f:
                f.writelines(pruned)
    except Exception as e:
        logger.warning("Failed to prune log file %s: %s", path, e)
