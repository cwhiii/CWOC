"""Health, version, sync, geocode, and page-serving routes for the CWOC backend.

Provides health check, instance ID, version info, health data aggregation,
update log/run, geocode proxy, WebSocket sync hub, HTTP polling sync,
and root/editor page serving.
"""

import asyncio
import json
import logging
import os
import sqlite3
import time
import urllib.request
import urllib.parse
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, RedirectResponse, StreamingResponse

from src.backend.db import (
    DB_PATH, _update_lock, deserialize_json_field,
    get_or_create_instance_id, get_version_info, update_version_info,
)
from src.backend.routes.audit import insert_audit_entry, get_current_actor
from src.backend.sharing import _deserialize_chit_fields


logger = logging.getLogger(__name__)
router = APIRouter()


# ═══════════════════════════════════════════════════════════════════════════
# Geocode Proxy
# ═══════════════════════════════════════════════════════════════════════════

_geocode_cache = {}       # key (lowercase query) → {"lat": float, "lon": float, "ts": float}
_geocode_last_req = 0.0   # timestamp of last Nominatim request (rate-limit to 1/sec)
_geocode_lock = asyncio.Lock()


def _sync_geocode_fetch(url):
    """Blocking fetch — runs in thread pool to avoid blocking the event loop."""
    req = urllib.request.Request(url, headers={"User-Agent": "CWOC-Weather/1.0"})
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode())


@router.get("/api/geocode")
async def geocode_proxy(q: str = Query(..., min_length=1)):
    global _geocode_last_req
    key = q.lower().strip()
    # Return cached result if < 24 hours old
    if key in _geocode_cache and (time.time() - _geocode_cache[key]["ts"]) < 86400:
        return {"results": [{"lat": _geocode_cache[key]["lat"], "lon": _geocode_cache[key]["lon"]}]}

    async with _geocode_lock:
        # Re-check cache (another request may have populated it while we waited)
        if key in _geocode_cache and (time.time() - _geocode_cache[key]["ts"]) < 86400:
            return {"results": [{"lat": _geocode_cache[key]["lat"], "lon": _geocode_cache[key]["lon"]}]}

        # Rate-limit: wait if less than 1.1 seconds since last request
        elapsed = time.time() - _geocode_last_req
        if elapsed < 1.1:
            await asyncio.sleep(1.1 - elapsed)

        url = "https://nominatim.openstreetmap.org/search?format=json&limit=3&q=" + urllib.parse.quote(q)
        try:
            _geocode_last_req = time.time()
            loop = asyncio.get_event_loop()
            data = await loop.run_in_executor(None, _sync_geocode_fetch, url)
            if data and len(data) > 0:
                lat = float(data[0]["lat"])
                lon = float(data[0]["lon"])
                _geocode_cache[key] = {"lat": lat, "lon": lon, "ts": time.time()}
                return {"results": [{"lat": lat, "lon": lon}]}
            return {"results": []}
        except Exception as e:
            logger.error(f"Geocode proxy error: {e}")
            raise HTTPException(status_code=502, detail="Geocoding service unavailable")


# ═══════════════════════════════════════════════════════════════════════════
# Sync Hub (WebSocket + HTTP polling fallback)
# ═══════════════════════════════════════════════════════════════════════════

# ── HTTP polling sync queue ──
_sync_messages = []  # list of { id: int, data: dict, ts: float }
_sync_next_id = 1
_sync_max_messages = 200  # keep last 200 messages


class _SyncHub:
    """Manages WebSocket connections and broadcasts sync messages to all clients."""
    def __init__(self):
        self.connections: list = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.connections.append(ws)
        logger.info(f"WS client connected ({len(self.connections)} total)")

    def disconnect(self, ws: WebSocket):
        if ws in self.connections:
            self.connections.remove(ws)
        logger.info(f"WS client disconnected ({len(self.connections)} total)")

    async def broadcast(self, message: dict, exclude: WebSocket = None):
        """Send a JSON message to all connected clients except the sender."""
        dead = []
        for ws in self.connections:
            if ws is exclude:
                continue
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)

_sync_hub = _SyncHub()


@router.post("/api/sync/send")
async def sync_send_message(body: dict):
    """Post a sync message. All other polling clients will receive it."""
    global _sync_next_id
    msg = {"id": _sync_next_id, "data": body, "ts": time.time()}
    _sync_next_id += 1
    _sync_messages.append(msg)
    # Trim old messages
    if len(_sync_messages) > _sync_max_messages:
        _sync_messages[:] = _sync_messages[-_sync_max_messages:]
    # Also broadcast to WebSocket clients
    await _sync_hub.broadcast(body)
    return {"ok": True, "id": msg["id"]}


@router.get("/api/sync/poll")
def sync_poll(after: int = Query(0)):
    """Get sync messages after the given ID."""
    results = [m["data"] for m in _sync_messages if m["id"] > after]
    last_id = _sync_messages[-1]["id"] if _sync_messages else after
    return {"messages": results, "last_id": last_id}


@router.websocket("/ws/sync")
async def websocket_sync(ws: WebSocket):
    global _sync_next_id
    await _sync_hub.connect(ws)
    try:
        while True:
            data = await ws.receive_json()
            # Also add to polling queue
            msg = {"id": _sync_next_id, "data": data, "ts": time.time()}
            _sync_next_id += 1
            _sync_messages.append(msg)
            if len(_sync_messages) > _sync_max_messages:
                _sync_messages[:] = _sync_messages[-_sync_max_messages:]
            await _sync_hub.broadcast(data, exclude=ws)
    except WebSocketDisconnect:
        _sync_hub.disconnect(ws)
    except Exception:
        _sync_hub.disconnect(ws)


# ═══════════════════════════════════════════════════════════════════════════
# Health Data Aggregation
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/api/health-data")
def get_health_data(since: Optional[str] = Query(None), until: Optional[str] = Query(None)):
    """Return all health data points from chits, sorted by date."""
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # Check if health_data column exists
        cursor.execute("PRAGMA table_info(chits)")
        columns = {row[1] for row in cursor.fetchall()}
        if "health_data" not in columns:
            logger.info("health_data column not found — returning empty")
            return []

        # Build query
        query = """SELECT id, title, start_datetime, due_datetime, created_datetime, health_data 
                   FROM chits 
                   WHERE (deleted = 0 OR deleted IS NULL) 
                   AND health_data IS NOT NULL 
                   AND health_data != '' 
                   AND health_data != 'null'
                   AND health_data != '{}'"""
        params = []

        if since:
            query += " AND (start_datetime >= ? OR due_datetime >= ? OR created_datetime >= ?)"
            params.extend([since, since, since])
        if until:
            query += " AND (start_datetime <= ? OR due_datetime <= ? OR created_datetime <= ?)"
            params.extend([until, until, until])

        query += " ORDER BY COALESCE(start_datetime, due_datetime, created_datetime) ASC"
        
        cursor.execute(query, params)
        rows = cursor.fetchall()

        results = []
        for row in rows:
            try:
                raw = row["health_data"]
                if not raw or raw in ('', 'null', '{}'):
                    continue
                hd = json.loads(raw) if isinstance(raw, str) else raw
                # Handle double-encoded JSON (string inside string)
                if isinstance(hd, str):
                    hd = json.loads(hd)
                if not isinstance(hd, dict) or not any(v is not None for v in hd.values()):
                    continue
                date_str = row["start_datetime"] or row["due_datetime"] or row["created_datetime"] or ""
                entry = {
                    "date": date_str[:10] if date_str else "",
                    "datetime": date_str,
                    "chit_id": row["id"],
                    "chit_title": row["title"] or "(Untitled)",
                }
                entry.update(hd)
                results.append(entry)
            except (json.JSONDecodeError, TypeError, KeyError) as e:
                logger.warning(f"Skipping bad health_data for chit {row['id']}: {e}")
                continue

        return results
    except Exception as e:
        logger.error(f"Error fetching health data: {str(e)}")
        # Return empty array instead of 500 to avoid breaking the UI
        return []
    finally:
        if conn:
            conn.close()


# ═══════════════════════════════════════════════════════════════════════════
# Page Serving
# ═══════════════════════════════════════════════════════════════════════════

# Root route to serve index.html as the main page
@router.get("/")
async def root():
    return FileResponse("/app/src/frontend/html/index.html")

# Login route to serve login.html (excluded from auth middleware)
@router.get("/login")
async def login_page():
    return FileResponse("/app/src/frontend/html/login.html")

# Profile route to serve profile.html
@router.get("/profile")
async def profile_page():
    return FileResponse("/app/src/frontend/html/profile.html")

# User Admin route to serve user-admin.html
@router.get("/user-admin")
async def user_admin_page():
    return FileResponse("/app/src/frontend/html/user-admin.html")

# Editor route to serve editor.html and handle chit data
@router.get("/editor")
async def editor(id: str = None):
    if id:
        # Serve editor.html; data will be fetched via /api/chit/{id}
        return FileResponse("/app/src/frontend/html/editor.html")
    return FileResponse("/app/src/frontend/html/editor.html")


# ═══════════════════════════════════════════════════════════════════════════
# Kiosk
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/api/kiosk")
def get_kiosk(user_ids: str = Query("", description="Comma-separated user UUIDs or usernames")):
    """Return combined non-deleted, non-stealth chits from the specified users.

    Unauthenticated endpoint — no request.state.user_id available.
    Accepts either UUIDs or usernames. Validates against the users table;
    returns 400 for invalid identifiers.

    Response: {
        "chits": [ ...chit objects with owner_display_name... ],
        "users": [ {"id": "uuid", "display_name": "Name"}, ... ]
    }
    """
    if not user_ids or not user_ids.strip():
        raise HTTPException(status_code=400, detail="No user IDs provided. Pass ?user_ids=username1,username2")

    raw_ids = [uid.strip() for uid in user_ids.split(",") if uid.strip()]
    if not raw_ids:
        raise HTTPException(status_code=400, detail="No user IDs provided. Pass ?user_ids=username1,username2")

    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # Try to resolve identifiers — could be UUIDs or usernames
        placeholders = ",".join("?" for _ in raw_ids)
        cursor.execute(
            f"SELECT id, display_name, username FROM users WHERE id IN ({placeholders}) OR username IN ({placeholders})",
            raw_ids + raw_ids,
        )
        found_rows = cursor.fetchall()

        # If no identifiers matched at all, return an error
        if not found_rows:
            raise HTTPException(status_code=400, detail=f"No matching users found for: {', '.join(raw_ids)}")

        resolved_ids = [row["id"] for row in found_rows]
        users_list = [{"id": row["id"], "display_name": row["display_name"] or ""} for row in found_rows]

        # Fetch non-deleted, non-stealth chits owned by those users that have the "Share" tag
        id_placeholders = ",".join("?" for _ in resolved_ids)
        cursor.execute(
            f"""SELECT * FROM chits
                WHERE (deleted = 0 OR deleted IS NULL)
                  AND (stealth = 0 OR stealth IS NULL)
                  AND owner_id IN ({id_placeholders})""",
            resolved_ids,
        )
        rows = cursor.fetchall()

        chits = []
        for row in rows:
            chit = dict(row)
            _deserialize_chit_fields(chit)
            chit["assigned_to"] = chit.get("assigned_to")
            chit["owner_display_name"] = chit.get("owner_display_name", "")
            # Only include chits that have the "Share" tag
            chit_tags = chit.get("tags") or []
            if isinstance(chit_tags, list) and any(t.lower() == "share" for t in chit_tags):
                chits.append(chit)

        return {"chits": chits, "users": users_list}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching kiosk data: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch kiosk data: {str(e)}")
    finally:
        if conn:
            conn.close()


@router.get("/kiosk")
async def kiosk_page():
    return FileResponse("/app/src/frontend/html/kiosk.html")


# Legacy redirects for old /wall-station URLs
@router.get("/wall-station")
async def wall_station_redirect(request: Request):
    query = str(request.url.query)
    target = "/kiosk" + ("?" + query if query else "")
    return RedirectResponse(url=target, status_code=301)


@router.get("/api/wall-station")
def wall_station_api_redirect(request: Request):
    query = str(request.url.query)
    target = "/api/kiosk" + ("?" + query if query else "")
    return RedirectResponse(url=target, status_code=301)


# ═══════════════════════════════════════════════════════════════════════════
# Instance ID, Version, Health Check
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/api/instance-id")
def get_instance_id():
    return {"instance_id": get_or_create_instance_id()}

@router.get("/api/version")
def get_version():
    return get_version_info()

@router.get("/health")
def health_check():
    return {"status": "healthy"}


# ═══════════════════════════════════════════════════════════════════════════
# Version Management & Update Streaming
# ═══════════════════════════════════════════════════════════════════════════

CONFIGURINATOR_PATH = "/app/install/configurinator.sh"
UPDATE_LOG_PATH = "/app/data/update.log"

# Directories to scan for release notes files (cwoc_release_*.md)
_RELEASE_NOTES_DIRS = [
    "/app/documents/release_notes",
    "documents/release_notes",
]


def _find_release_notes():
    """Scan for all cwoc_release_*.md files, return sorted list of (version, content) tuples (newest first)."""
    import glob as _glob

    found = {}  # version -> content
    for directory in _RELEASE_NOTES_DIRS:
        pattern = os.path.join(directory, "cwoc_release_*.md")
        for filepath in _glob.glob(pattern):
            basename = os.path.basename(filepath)
            # Extract version from filename: cwoc_release_YYYYMMDD.HHMM.md
            version = basename.replace("cwoc_release_", "").replace(".md", "")
            if version not in found:
                try:
                    with open(filepath, "r") as f:
                        found[version] = f.read()
                except (IOError, OSError):
                    continue
        if found:
            break  # Use first directory that has files
    # Sort by version descending (newest first)
    return sorted(found.items(), key=lambda x: x[0], reverse=True)


@router.get("/api/release-notes")
def get_release_notes():
    """Return all release notes as a list of {version, content} objects, newest first."""
    notes = _find_release_notes()
    return {"notes": [{"version": v, "content": c} for v, c in notes]}


@router.get("/api/update/log")
def get_update_log():
    try:
        with open(UPDATE_LOG_PATH, "r") as f:
            return {"log": f.read()}
    except (FileNotFoundError, IOError):
        return {"log": None}


@router.get("/api/update/run")
async def run_update():
    async def event_stream():
        process = None
        log_lines = []
        try:
            # Check if an update is already running
            if _update_lock.locked():
                yield 'data: {"type":"error","message":"Update already in progress"}\n\n'
                return

            async with _update_lock:
                # Check if the configurinator script exists
                if not os.path.isfile(CONFIGURINATOR_PATH):
                    yield 'data: {"type":"error","message":"Configurinator script not found"}\n\n'
                    return

                # Read the current version before the update starts (for audit)
                old_version = None
                try:
                    audit_pre_conn = sqlite3.connect(DB_PATH)
                    audit_pre_cursor = audit_pre_conn.cursor()
                    audit_pre_cursor.execute("SELECT value FROM instance_meta WHERE key = 'version'")
                    row = audit_pre_cursor.fetchone()
                    if row:
                        old_version = row[0]
                    audit_pre_conn.close()
                except Exception:
                    pass

                try:
                    process = await asyncio.create_subprocess_exec(
                        "sudo", "bash", CONFIGURINATOR_PATH,
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.STDOUT,
                    )
                except (OSError, PermissionError) as e:
                    yield f'data: {json.dumps({"type":"error","message":str(e)})}\n\n'
                    return

                # Emit timestamp as the first log line, right after the banner
                import time as _time
                _tz_name = _time.strftime("%Z") or "UTC"
                _now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S") + " " + _tz_name
                _ts_line = f"  Started: {_now_str}"
                log_lines.append(_ts_line)
                yield f'data: {json.dumps({"type":"log","line":_ts_line})}\n\n'

                # Stream each line from the subprocess
                while True:
                    line = await process.stdout.readline()
                    if not line:
                        break
                    decoded = line.decode("utf-8", errors="replace").rstrip()
                    log_lines.append(decoded)
                    yield f'data: {json.dumps({"type":"log","line":decoded})}\n\n'

                exit_code = await process.wait()

                if exit_code == 0:
                    # Read version from /app/src/VERSION
                    version = "unknown"
                    try:
                        with open("/app/src/VERSION", "r") as f:
                            first_line = f.readline().strip()
                            if first_line:
                                version = first_line
                    except (FileNotFoundError, IOError):
                        pass
                    installed_datetime = datetime.utcnow().isoformat() + "Z"
                    update_version_info(version, installed_datetime)

                    # Audit: log the upgrade if version changed
                    try:
                        if old_version is not None and old_version != version:
                            audit_conn = sqlite3.connect(DB_PATH)
                            actor = get_current_actor()
                            changes = [{"field": "version", "old": old_version, "new": version}]
                            insert_audit_entry(audit_conn, "system", "version", "updated", actor, changes=changes)
                            audit_conn.commit()
                            audit_conn.close()
                    except Exception as e:
                        logger.error(f"Audit: failed to log version change in run_update: {str(e)}")

                    log_lines.append("[OK] Update complete! Version: " + version)
                    yield f'data: {json.dumps({"type":"done","exit_code":0,"version":version})}\n\n'

                    # Schedule a service restart after a short delay so the
                    # SSE response has time to reach the client
                    async def _deferred_restart():
                        await asyncio.sleep(3)
                        try:
                            proc = await asyncio.create_subprocess_exec(
                                "sudo", "systemctl", "restart", "cwoc",
                                stdout=asyncio.subprocess.DEVNULL,
                                stderr=asyncio.subprocess.DEVNULL,
                            )
                            await proc.wait()
                        except Exception:
                            pass
                    asyncio.create_task(_deferred_restart())
                else:
                    log_lines.append("[ERROR] Update failed (exit code " + str(exit_code) + ")")
                    yield f'data: {json.dumps({"type":"done","exit_code":exit_code})}\n\n'

                # Save log to file
                try:
                    with open(UPDATE_LOG_PATH, "w") as f:
                        f.write("\n".join(log_lines))
                except Exception:
                    pass

        except asyncio.CancelledError:
            # Client disconnected — terminate subprocess gracefully
            if process and process.returncode is None:
                try:
                    process.terminate()
                    await process.wait()
                except Exception:
                    pass
            return

    return StreamingResponse(event_stream(), media_type="text/event-stream")
