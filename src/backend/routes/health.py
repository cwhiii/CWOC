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

# Profile route — serves the unified contact-editor page in profile mode.
# The ?mode=profile param is added client-side by the redirect.
@router.get("/profile")
async def profile_page():
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url="/frontend/html/contact-editor.html?mode=profile", status_code=302)

# User Admin route to serve user-admin.html
@router.get("/user-admin")
async def user_admin_page():
    return FileResponse("/app/src/frontend/html/user-admin.html")

# Admin Chit Tool route
@router.get("/admin-chits")
async def admin_chits_page():
    return FileResponse("/app/src/frontend/html/admin-chits.html")

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
def get_kiosk(tags: str = Query("", description="Comma-separated tag names to filter by")):
    """Return combined non-deleted, non-stealth chits that have any of the specified tags.

    Unauthenticated endpoint — no request.state.user_id available.
    Filters chits by tag membership (case-insensitive match).

    Response: {
        "chits": [ ...chit objects with owner_display_name... ],
        "tags": [ "tag1", "tag2", ... ]
    }
    """
    if not tags or not tags.strip():
        raise HTTPException(status_code=400, detail="No tags provided. Pass ?tags=TagName1,TagName2")

    raw_tags = [t.strip() for t in tags.split(",") if t.strip()]
    if not raw_tags:
        raise HTTPException(status_code=400, detail="No tags provided. Pass ?tags=TagName1,TagName2")

    # Lowercase for case-insensitive matching
    tag_set_lower = {t.lower() for t in raw_tags}

    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # Fetch all non-deleted, non-stealth chits that have tags
        cursor.execute(
            """SELECT * FROM chits
                WHERE (deleted = 0 OR deleted IS NULL)
                  AND (stealth = 0 OR stealth IS NULL)
                  AND tags IS NOT NULL
                  AND tags != '' AND tags != '[]' AND tags != 'null'"""
        )
        rows = cursor.fetchall()

        chits = []
        for row in rows:
            chit = dict(row)
            _deserialize_chit_fields(chit)
            chit["assigned_to"] = chit.get("assigned_to")
            chit["owner_display_name"] = chit.get("owner_display_name", "")
            # Check if chit has any of the requested tags (case-insensitive)
            # Also match child tags: selecting "Work" includes chits tagged "Work/Projects"
            chit_tags = chit.get("tags") or []
            if isinstance(chit_tags, list):
                matched = False
                for chit_tag in chit_tags:
                    chit_tag_lower = chit_tag.lower()
                    for filter_tag_lower in tag_set_lower:
                        if chit_tag_lower == filter_tag_lower or chit_tag_lower.startswith(filter_tag_lower + '/'):
                            matched = True
                            break
                    if matched:
                        break
                if matched:
                    chits.append(chit)

        return {"chits": chits, "tags": raw_tags}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching kiosk data: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch kiosk data: {str(e)}")
    finally:
        if conn:
            conn.close()


@router.get("/api/kiosk/config")
def get_kiosk_config():
    """Return the saved kiosk tag list and week_start_day from settings. Unauthenticated endpoint.
    Returns { "tags": ["Tag1", "Tag2", ...], "week_start_day": 0 }

    Prioritises the settings row that actually has kiosk tags configured.
    Falls back to the first row for week_start_day if no row has tags.
    """
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row

        # Try to find a row that has kiosk_users configured first
        row = conn.execute(
            """SELECT kiosk_users, week_start_day FROM settings
               WHERE kiosk_users IS NOT NULL AND kiosk_users != '' AND kiosk_users != '[]' AND kiosk_users != 'null'
               LIMIT 1"""
        ).fetchone()

        # Fall back to any row (for week_start_day)
        if not row:
            row = conn.execute("SELECT kiosk_users, week_start_day FROM settings LIMIT 1").fetchone()

        if not row:
            return {"tags": [], "week_start_day": 0}
        raw = row["kiosk_users"] if row["kiosk_users"] else None
        tags = []
        if raw:
            tags = json.loads(raw) if isinstance(raw, str) else raw
            if not isinstance(tags, list):
                tags = []
        wsd = 0
        try:
            wsd = int(row["week_start_day"]) if row["week_start_day"] else 0
        except (ValueError, TypeError):
            pass
        return {"tags": tags, "week_start_day": wsd}
    except Exception as e:
        logger.error(f"Error fetching kiosk config: {e}")
        return {"tags": [], "week_start_day": 0}
    finally:
        if conn:
            conn.close()


@router.get("/maps")
async def maps_page():
    return FileResponse("/app/src/frontend/html/maps.html")


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
# SSL Certificate Download
# ═══════════════════════════════════════════════════════════════════════════

_SSL_CA_CERT_PATH = "/etc/ssl/cwoc/cwoc-ca.crt"
_SSL_CERT_PATH = "/etc/ssl/cwoc/cwoc.crt"  # fallback for legacy single-cert setups


@router.get("/api/ssl-cert")
def download_ssl_cert():
    """Download the server's CA certificate for device trust.

    Returns the CA certificate (PEM-encoded) that users install on their
    phones/tablets to trust the CWOC server. This enables PWA installation
    over HTTPS with a self-signed certificate chain.

    Prefers the CA cert (cwoc-ca.crt) from the new two-cert setup.
    Falls back to the server cert (cwoc.crt) for legacy single-cert installs.
    No authentication required — the CA cert is public by nature.
    """
    # Prefer the CA cert (new setup)
    if os.path.isfile(_SSL_CA_CERT_PATH):
        return FileResponse(
            _SSL_CA_CERT_PATH,
            media_type="application/x-pem-file",
            filename="cwoc-ca.crt",
            headers={"Content-Disposition": "attachment; filename=cwoc-ca.crt"},
        )
    # Fall back to server cert (legacy single-cert setup)
    if os.path.isfile(_SSL_CERT_PATH):
        return FileResponse(
            _SSL_CERT_PATH,
            media_type="application/x-pem-file",
            filename="cwoc-server.crt",
            headers={"Content-Disposition": "attachment; filename=cwoc-server.crt"},
        )
    raise HTTPException(status_code=404, detail="SSL certificate not found on this server")


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
