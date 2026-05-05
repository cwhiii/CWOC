"""Network Access API routes for the CWOC backend.

Provides CRUD endpoints for managing network access provider configurations
(e.g., Tailscale, future providers), plus Tailscale-specific service control
endpoints (status, up, down). All endpoints require admin access.
"""

import json
import logging
import sqlite3
import subprocess
from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request

from src.backend.db import DB_PATH
from src.backend.routes.audit import get_actor_from_request, insert_audit_entry


logger = logging.getLogger(__name__)
router = APIRouter()


# ── Helpers ───────────────────────────────────────────────────────────────

def _utcnow_iso() -> str:
    """Return current UTC time as ISO 8601 string with Z suffix."""
    return datetime.utcnow().isoformat() + "Z"


def _encrypt_auth_key(plaintext: str) -> str:
    """Encrypt an auth key using Fernet symmetric encryption."""
    try:
        from src.backend.routes.email import _encrypt_password
        return _encrypt_password(plaintext)
    except Exception:
        return plaintext  # Fallback: store as-is if encryption unavailable


def _decrypt_auth_key(ciphertext: str) -> str:
    """Decrypt an auth key using Fernet symmetric encryption."""
    try:
        from src.backend.routes.email import _decrypt_password
        return _decrypt_password(ciphertext)
    except Exception:
        return ciphertext  # Fallback: return as-is (may be plaintext from before encryption)


def _require_admin(request: Request) -> str:
    """Check that the requesting user is an admin. Return user_id if so, raise 403 otherwise."""
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        row = conn.execute(
            "SELECT is_admin FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()

        if row is None:
            raise HTTPException(status_code=401, detail="Authentication required")

        if not row["is_admin"]:
            raise HTTPException(status_code=403, detail="Admin access required")

        return user_id
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Admin check error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        if conn:
            conn.close()


def _row_to_dict(row: sqlite3.Row) -> dict:
    """Convert a network_access row to a response dict, deserializing the config JSON."""
    result = {
        "id": row["id"],
        "provider": row["provider"],
        "enabled": bool(row["enabled"]),
        "config": {},
        "created_datetime": row["created_datetime"],
        "modified_datetime": row["modified_datetime"],
    }
    if row["config"]:
        try:
            config = json.loads(row["config"])
            # Decrypt auth_key for frontend display
            if isinstance(config, dict) and config.get("auth_key"):
                config["auth_key"] = _decrypt_auth_key(config["auth_key"])
            result["config"] = config
        except (json.JSONDecodeError, TypeError):
            result["config"] = {}
    return result

def _ensure_tailscaled():
    """Ensure the tailscaled daemon is running. Returns (ok, error_msg)."""
    import time
    import os
    SOCK = "/var/run/tailscale/tailscaled.sock"
    TUN = "/dev/net/tun"
    try:
        # Check for TUN device first — common issue in LXC containers
        if not os.path.exists(TUN):
            return False, (
                "TUN device not available (/dev/net/tun missing). "
                "If running in a Proxmox LXC container, add these lines to the container config "
                "on the Proxmox host (/etc/pve/lxc/<CTID>.conf):\n"
                "  lxc.cgroup2.devices.allow: c 10:200 rwm\n"
                "  lxc.mount.entry: /dev/net/tun dev/net/tun none bind,create=file\n"
                "Then restart the container."
            )

        # Check if already running
        check = subprocess.run(
            ["systemctl", "is-active", "tailscaled"],
            capture_output=True, text=True, timeout=5,
        )
        if check.stdout.strip() != "active":
            # Not running — try to start it
            start = subprocess.run(
                ["systemctl", "start", "tailscaled"],
                capture_output=True, text=True, timeout=15,
            )
            if start.returncode != 0:
                return False, start.stderr.strip() or "Failed to start tailscaled daemon"

        # Wait for socket to become available (up to 5 seconds)
        for _ in range(10):
            if os.path.exists(SOCK):
                return True, None
            time.sleep(0.5)

        return False, f"tailscaled is active but socket {SOCK} not found"
    except subprocess.TimeoutExpired:
        return False, "Timed out starting tailscaled daemon"
    except Exception as e:
        return False, str(e)



@router.get("/api/network-access/tailscale/status")
def tailscale_status(request: Request):
    """Get Tailscale service status — checks installation and connection state."""
    _require_admin(request)

    try:
        import os

        # Step 1: Check if tailscale is installed
        which_result = subprocess.run(
            ["which", "tailscale"],
            capture_output=True, text=True, timeout=10,
        )
        if which_result.returncode != 0:
            return {"status": "not_installed"}

        # Step 2: Check TUN device
        if not os.path.exists("/dev/net/tun"):
            return {"status": "error", "message": (
                "TUN device not available (/dev/net/tun missing). "
                "If running in a Proxmox LXC container, add TUN access to the container config. "
                "See Help → Network Access → Troubleshooting for details."
            )}

        # Step 3: Ensure daemon is running
        daemon_ok, daemon_err = _ensure_tailscaled()
        if not daemon_ok:
            return {"status": "error", "message": daemon_err}

        # Step 3: Get tailscale status as JSON
        status_result = subprocess.run(
            ["tailscale", "status", "--json"],
            capture_output=True, text=True, timeout=10,
        )
        if status_result.returncode != 0:
            return {"status": "installed_inactive"}

        # Step 4: Parse the JSON output
        status_data = json.loads(status_result.stdout)

        # Check BackendState — "Stopped" means tailscale down was called
        backend_state = status_data.get("BackendState", "")
        if backend_state == "Stopped":
            return {"status": "installed_inactive"}

        tailscale_ips = status_data.get("TailscaleIPs", [])
        ip = tailscale_ips[0] if tailscale_ips else None

        self_node = status_data.get("Self", {})
        hostname = self_node.get("HostName")

        if ip and backend_state == "Running":
            return {"status": "active", "ip": ip, "hostname": hostname}

        return {"status": "installed_inactive"}

    except subprocess.TimeoutExpired:
        return {"status": "error", "message": "Tailscale status check timed out"}
    except json.JSONDecodeError:
        return {"status": "error", "message": "Failed to parse Tailscale status output"}
    except Exception as e:
        logger.error(f"Tailscale status check error: {e}")
        return {"status": "error", "message": str(e)}


@router.post("/api/network-access/tailscale/up")
def tailscale_up(request: Request):
    """Start Tailscale with the saved auth key from the network_access table."""
    _require_admin(request)

    # Load saved Tailscale config from DB
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        row = conn.execute(
            "SELECT config FROM network_access WHERE provider = ?",
            ("tailscale",),
        ).fetchone()

        auth_key = None
        if row and row["config"]:
            try:
                config_data = json.loads(row["config"])
                auth_key = config_data.get("auth_key")
                # Decrypt the auth key if it was encrypted
                if auth_key:
                    auth_key = _decrypt_auth_key(auth_key)
            except (json.JSONDecodeError, TypeError):
                pass

        if not auth_key:
            raise HTTPException(
                status_code=400,
                detail="No Tailscale auth key configured. Save an auth key first.",
            )

        # Ensure tailscaled daemon is running before attempting connect
        daemon_ok, daemon_err = _ensure_tailscaled()
        if not daemon_ok:
            raise HTTPException(
                status_code=500,
                detail=f"Cannot start tailscaled daemon: {daemon_err}",
            )

        # Run tailscale up with the auth key
        # Force re-authentication so a new key/account is always applied
        # --reset clears existing state, --force-reauth ensures fresh login
        result = subprocess.run(
            ["tailscale", "up", "--reset", "--authkey=" + auth_key],
            capture_output=True, text=True, timeout=30,
        )

        if result.returncode != 0:
            detail = (result.stderr or result.stdout or "Tailscale command failed").strip()
            logger.error(f"tailscale up failed (rc={result.returncode}): {detail}")
            raise HTTPException(status_code=500, detail=detail)

        # Verify the connection actually worked by checking status
        import time
        time.sleep(1)
        verify = subprocess.run(
            ["tailscale", "status", "--json"],
            capture_output=True, text=True, timeout=10,
        )
        connected = False
        ip = None
        hostname = None
        if verify.returncode == 0:
            try:
                vdata = json.loads(verify.stdout)
                if vdata.get("BackendState") == "Running":
                    ips = vdata.get("TailscaleIPs", [])
                    ip = ips[0] if ips else None
                    hostname = vdata.get("Self", {}).get("HostName")
                    connected = bool(ip)
            except (json.JSONDecodeError, KeyError):
                pass

        if not connected:
            raise HTTPException(
                status_code=500,
                detail="Tailscale command succeeded but connection could not be verified. The auth key may be invalid.",
            )

        # Audit log the action
        try:
            actor = get_actor_from_request(request)
            insert_audit_entry(
                conn, "network_access", "tailscale", "tailscale_up", actor,
                entity_summary="Tailscale service started",
            )
            conn.commit()
        except Exception as e:
            logger.error(f"Audit logging failed for tailscale up: {e}")

        return {"success": True, "message": "Tailscale connected", "ip": ip, "hostname": hostname}

    except HTTPException:
        raise
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=500, detail="Tailscale up command timed out")
    except Exception as e:
        logger.error(f"Tailscale up error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.close()


@router.post("/api/network-access/tailscale/down")
def tailscale_down(request: Request):
    """Stop the Tailscale service."""
    _require_admin(request)

    conn = None
    try:
        result = subprocess.run(
            ["tailscale", "down"],
            capture_output=True, text=True, timeout=15,
        )

        if result.returncode != 0:
            raise HTTPException(
                status_code=500,
                detail=result.stderr or "Tailscale command failed",
            )

        # Audit log the action
        try:
            conn = sqlite3.connect(DB_PATH)
            actor = get_actor_from_request(request)
            insert_audit_entry(
                conn, "network_access", "tailscale", "tailscale_down", actor,
                entity_summary="Tailscale service stopped",
            )
            conn.commit()
        except Exception as e:
            logger.error(f"Audit logging failed for tailscale down: {e}")

        return {"success": True, "message": "Tailscale disconnected"}

    except HTTPException:
        raise
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=500, detail="Tailscale down command timed out")
    except Exception as e:
        logger.error(f"Tailscale down error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.close()


# ═══════════════════════════════════════════════════════════════════════════
# Generic CRUD endpoints
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/api/network-access")
def list_network_access(request: Request):
    """List all provider configs from the network_access table."""
    _require_admin(request)

    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            "SELECT * FROM network_access ORDER BY provider"
        ).fetchall()
        return [_row_to_dict(row) for row in rows]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing network access configs: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to list network access configs: {str(e)}")
    finally:
        if conn:
            conn.close()


@router.get("/api/network-access/{provider}")
def get_network_access(provider: str, request: Request):
    """Get a single provider config, or a default if not found."""
    _require_admin(request)

    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        row = conn.execute(
            "SELECT * FROM network_access WHERE provider = ?",
            (provider,),
        ).fetchone()

        if row is None:
            return {"provider": provider, "enabled": False, "config": {}}

        return _row_to_dict(row)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching network access config for {provider}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch network access config: {str(e)}")
    finally:
        if conn:
            conn.close()


@router.post("/api/network-access/{provider}")
def save_network_access(provider: str, body: dict, request: Request):
    """Create or update a provider config using INSERT OR REPLACE."""
    _require_admin(request)

    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        now = _utcnow_iso()

        # Check for existing row to preserve id and created_datetime
        existing = conn.execute(
            "SELECT id, created_datetime, config FROM network_access WHERE provider = ?",
            (provider,),
        ).fetchone()

        old_auth_key = None
        if existing:
            row_id = existing["id"]
            created = existing["created_datetime"]
            try:
                old_config = json.loads(existing["config"]) if existing["config"] else {}
                old_auth_key = old_config.get("auth_key", "")
                # Decrypt for comparison
                if old_auth_key:
                    old_auth_key = _decrypt_auth_key(old_auth_key)
            except (json.JSONDecodeError, TypeError):
                old_auth_key = ""
        else:
            row_id = str(uuid4())
            created = now

        enabled = body.get("enabled", False)
        config = body.get("config", {})
        new_auth_key = config.get("auth_key", "")

        # Encrypt the auth key before storing
        if new_auth_key:
            config["auth_key"] = _encrypt_auth_key(new_auth_key)
        config_json = json.dumps(config)

        conn.execute(
            """INSERT OR REPLACE INTO network_access
               (id, provider, enabled, config, created_datetime, modified_datetime)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (row_id, provider, 1 if enabled else 0, config_json, created, now),
        )

        # Audit log the change
        try:
            actor = get_actor_from_request(request)
            action = "updated" if existing else "created"
            insert_audit_entry(
                conn, "network_access", provider, action, actor,
                entity_summary=f"Network access config: {provider}",
            )
        except Exception as e:
            logger.error(f"Audit logging failed for network access save: {e}")

        conn.commit()

        # If this is Tailscale and the auth key changed, disconnect + logout
        # so the old registration is purged and Connect uses the new key fresh
        tailscale_disconnected = False
        if provider == "tailscale" and old_auth_key is not None and new_auth_key != old_auth_key:
            try:
                subprocess.run(
                    ["tailscale", "down"],
                    capture_output=True, text=True, timeout=15,
                )
                subprocess.run(
                    ["tailscale", "logout"],
                    capture_output=True, text=True, timeout=15,
                )
                tailscale_disconnected = True
                logger.info("Tailscale disconnected and logged out (auth key changed)")
            except Exception as e:
                logger.warning(f"Failed to disconnect Tailscale after key change: {e}")

        # Return with decrypted auth_key for frontend display
        response_config = dict(config)
        if response_config.get("auth_key"):
            response_config["auth_key"] = new_auth_key  # Use the original plaintext

        return {
            "id": row_id,
            "provider": provider,
            "enabled": bool(enabled),
            "config": response_config,
            "created_datetime": created,
            "modified_datetime": now,
            "tailscale_disconnected": tailscale_disconnected,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error saving network access config for {provider}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save network access config: {str(e)}")
    finally:
        if conn:
            conn.close()
