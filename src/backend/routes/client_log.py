"""Client and server log endpoints for remote diagnostics.

Provides:
  POST /api/client-log — receive log entries from mobile/remote clients
  GET /api/client-log  — return last 200 lines of client-log.txt
  GET /api/server-log  — return last 200 lines from journalctl -u cwoc

No authentication required (device diagnostics need to work pre-auth).
"""

import logging
import os
import subprocess
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Request
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter()

# Log file path — same /app/data/ directory as the database
CLIENT_LOG_PATH = "/app/data/client-log.txt"
MAX_RETURN_LINES = 200
MAX_FILE_LINES = 5000  # Rotate when file exceeds this many lines


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
async def get_server_log():
    """Return the last 200 lines from the cwoc systemd service journal."""
    try:
        result = subprocess.run(
            ["journalctl", "-u", "cwoc", "--no-pager", "-n", "200"],
            capture_output=True,
            text=True,
            timeout=10
        )
        lines = result.stdout.strip().split("\n") if result.stdout.strip() else []
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
    """If the log file exceeds MAX_FILE_LINES, trim to the last MAX_FILE_LINES."""
    try:
        with open(CLIENT_LOG_PATH, "r", encoding="utf-8") as f:
            lines = f.readlines()
        if len(lines) > MAX_FILE_LINES:
            with open(CLIENT_LOG_PATH, "w", encoding="utf-8") as f:
                f.writelines(lines[-MAX_FILE_LINES:])
    except Exception:
        pass
