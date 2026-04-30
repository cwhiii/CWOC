"""Authentication middleware for the CWOC backend.

Validates the cwoc_session cookie on every request, injects user identity
into request.state, and periodically cleans up expired sessions.

Excluded paths (no auth required):
  POST /api/auth/login, GET /login, GET /health,
  /static/*, /frontend/*, /data/*
"""

import logging
import sqlite3
from datetime import datetime, timedelta

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, RedirectResponse

from src.backend.db import DB_PATH


logger = logging.getLogger(__name__)

SESSION_COOKIE_NAME = "cwoc_session"

# Inactivity timeout: 24 hours
_INACTIVITY_SECONDS = 24 * 60 * 60

# Periodic cleanup: run every N requests (lightweight counter)
_request_counter = 0
_CLEANUP_INTERVAL = 100


def _utcnow_iso() -> str:
    """Return current UTC time as ISO 8601 string with Z suffix."""
    return datetime.utcnow().isoformat() + "Z"


def _is_excluded(path: str, method: str) -> bool:
    """Return True if the request path/method combination should skip auth."""
    # Static / frontend / data assets
    if path.startswith("/static/") or path.startswith("/frontend/") or path.startswith("/data/"):
        return True

    # Login page and health check
    if path == "/login" and method == "GET":
        return True
    if path == "/health" and method == "GET":
        return True

    # Login API endpoint
    if path == "/api/auth/login" and method == "POST":
        return True

    # Login welcome message (public, read-only)
    if path == "/api/auth/login-message" and method == "GET":
        return True

    return False


def _cleanup_expired_sessions() -> None:
    """Delete sessions that are past their expires_datetime or inactive > 24h."""
    conn = None
    try:
        now = _utcnow_iso()
        cutoff = (datetime.utcnow() - timedelta(seconds=_INACTIVITY_SECONDS)).isoformat() + "Z"
        conn = sqlite3.connect(DB_PATH)
        conn.execute(
            "DELETE FROM sessions WHERE expires_datetime < ? OR last_active_datetime < ?",
            (now, cutoff),
        )
        conn.commit()
    except Exception as e:
        logger.error(f"Session cleanup error: {e}")
    finally:
        if conn:
            conn.close()


class AuthMiddleware(BaseHTTPMiddleware):
    """Validate cwoc_session cookie and inject user identity into request.state.

    For authenticated requests: sets request.state.user_id and request.state.username.
    For unauthenticated /api/ requests: returns 401 JSON.
    For unauthenticated page requests: redirects to /login.
    """

    async def dispatch(self, request: Request, call_next):
        global _request_counter

        path = request.url.path
        method = request.method.upper()

        # Skip auth for excluded paths
        if _is_excluded(path, method):
            return await call_next(request)

        # Periodic session cleanup
        _request_counter += 1
        if _request_counter >= _CLEANUP_INTERVAL:
            _request_counter = 0
            _cleanup_expired_sessions()

        # Read session cookie
        token = request.cookies.get(SESSION_COOKIE_NAME)

        if token:
            # Look up session in database
            conn = None
            try:
                conn = sqlite3.connect(DB_PATH)
                conn.row_factory = sqlite3.Row
                row = conn.execute(
                    "SELECT s.token, s.user_id, s.expires_datetime, s.last_active_datetime, "
                    "u.username, u.is_active "
                    "FROM sessions s JOIN users u ON s.user_id = u.id "
                    "WHERE s.token = ?",
                    (token,),
                ).fetchone()

                if row:
                    now = datetime.utcnow()
                    expires = datetime.fromisoformat(row["expires_datetime"].replace("Z", ""))
                    last_active = datetime.fromisoformat(row["last_active_datetime"].replace("Z", ""))

                    # Check expiry: absolute expiry OR 24h inactivity
                    session_expired = now > expires
                    session_inactive = (now - last_active).total_seconds() > _INACTIVITY_SECONDS

                    if not session_expired and not session_inactive and row["is_active"]:
                        # Valid session — update last_active and inject user info
                        new_last_active = _utcnow_iso()
                        conn.execute(
                            "UPDATE sessions SET last_active_datetime = ? WHERE token = ?",
                            (new_last_active, token),
                        )
                        conn.commit()

                        request.state.user_id = row["user_id"]
                        request.state.username = row["username"]
                        return await call_next(request)
                    else:
                        # Expired or inactive session — clean it up
                        conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
                        conn.commit()

            except Exception as e:
                logger.error(f"Auth middleware error: {e}")
            finally:
                if conn:
                    conn.close()

        # No valid session — return appropriate error
        if path.startswith("/api/"):
            return JSONResponse(
                status_code=401,
                content={"detail": "Authentication required"},
            )
        else:
            # Page request — redirect to login
            return RedirectResponse(url="/login", status_code=302)
