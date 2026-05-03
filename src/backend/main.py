# ═══════════════════════════════════════════════════════════════════════════
# CWOC Backend — Entry Point
#
# This is the FastAPI application entry point. All route handlers, models,
# database helpers, and migrations have been extracted into focused modules:
#
#   src/backend/models.py       — Pydantic models
#   src/backend/db.py           — DB path, helpers, shared state
#   src/backend/migrations.py   — All migrate_* functions
#   src/backend/serializers.py  — vCard & CSV serializers
#   src/backend/weather.py      — Weather update service
#   src/backend/routes/chits.py — Chit CRUD + export/import
#   src/backend/routes/trash.py — Trash list, restore, purge
#   src/backend/routes/settings.py — Settings, standalone alerts, alert state
#   src/backend/routes/contacts.py — Contact CRUD, image, import/export
#   src/backend/routes/audit.py — Audit log + shared helpers
#   src/backend/routes/health.py — Health, version, sync, geocode, pages
#   src/backend/routes/auth.py  — Authentication, sessions, profile
#   src/backend/routes/users.py — Admin-only user management
#   src/backend/routes/network_access.py — Network access provider config
#   src/backend/routes/push.py — Web Push notification endpoints
#   src/backend/routes/ntfy.py — Ntfy push notification sender & endpoints
#   src/backend/middleware.py   — Auth middleware (session validation)
#
# PWA files served directly from src/pwa/:
#   GET /sw.js          — Service worker (Content-Type: application/javascript)
#   GET /manifest.json  — Web app manifest (Content-Type: application/json)
#   /pwa/*              — Static mount for pwa-register.js, offline.html, etc.
#   /static/cwoc-icon-* — PWA icons served from src/pwa/ via explicit routes
#   src/backend/middleware.py   — Auth middleware (session validation)
# ═══════════════════════════════════════════════════════════════════════════

import asyncio
import logging
import os

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request as StarletteRequest

# ── Setup logging ─────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── FastAPI app ───────────────────────────────────────────────────────────
app = FastAPI()


# ── No-cache middleware for frontend/static/data files ────────────────────
class NoCacheStaticMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: StarletteRequest, call_next):
        response = await call_next(request)
        path = request.url.path
        if path.startswith("/frontend/") or path.startswith("/static/") or path.startswith("/data/"):
            response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"
        return response

app.add_middleware(NoCacheStaticMiddleware)

# ── Auth middleware — validates session cookie, injects user identity ─────
from src.backend.middleware import AuthMiddleware
app.add_middleware(AuthMiddleware)


# ═══════════════════════════════════════════════════════════════════════════
# Database Initialization & Migrations
# (executed at import time, same order as the original monolith)
# ═══════════════════════════════════════════════════════════════════════════

from src.backend.db import init_db, seed_version_info
from src.backend.migrations import (
    migrate_labels_to_tags,
    migrate_add_all_day,
    migrate_add_alerts,
    migrate_add_calendar_snap,
    migrate_add_recurrence_fields,
    migrate_add_work_hours,
    migrate_add_saved_locations,
    init_contacts_table,
    migrate_contacts_add_new_fields,
    migrate_add_progress_and_estimate,
    migrate_add_username,
    migrate_add_weather_data,
    migrate_add_audit_log,
    migrate_add_audit_settings,
    migrate_add_default_notifications,
    migrate_add_standalone_alerts,
    migrate_add_alert_state,
    migrate_contact_images_to_data,
    migrate_add_habits_fields,
    migrate_add_border_color_settings,
    migrate_add_multi_user,
    migrate_add_user_profile_image,
    migrate_add_alerts_owner_id,
    migrate_add_login_message,
    migrate_add_instance_name,
    migrate_add_sharing,
    migrate_add_kiosk_users,
    migrate_add_hide_declined,
    migrate_add_network_access,
    migrate_add_notifications,
    migrate_add_user_profile_fields,
    migrate_habits_overhaul,
    migrate_habits_phase2,
    migrate_add_push_subscriptions,
    migrate_add_vapid_keys,
    migrate_add_running_timers,
    migrate_add_map_settings,
    migrate_add_contact_dates,
)

# Initialize database and run all migrations (same order as before)
init_db()
migrate_labels_to_tags()
migrate_add_all_day()
migrate_add_alerts()
migrate_add_calendar_snap()
migrate_add_recurrence_fields()
migrate_add_work_hours()
migrate_add_saved_locations()
init_contacts_table()
migrate_contacts_add_new_fields()
migrate_add_progress_and_estimate()
migrate_add_username()
migrate_add_weather_data()
migrate_add_audit_log()
migrate_add_audit_settings()
migrate_add_default_notifications()
migrate_add_standalone_alerts()
migrate_add_alert_state()
migrate_contact_images_to_data()
migrate_add_habits_fields()
migrate_add_border_color_settings()
migrate_add_multi_user()
migrate_add_user_profile_image()
migrate_add_alerts_owner_id()
migrate_add_login_message()
migrate_add_instance_name()
migrate_add_sharing()
migrate_add_kiosk_users()
migrate_add_hide_declined()
migrate_add_network_access()
migrate_add_notifications()
migrate_add_user_profile_fields()
migrate_habits_overhaul()
migrate_habits_phase2()
migrate_add_push_subscriptions()
migrate_add_vapid_keys()
migrate_add_running_timers()
migrate_add_map_settings()
migrate_add_contact_dates()
seed_version_info()


# ═══════════════════════════════════════════════════════════════════════════
# Register Route Modules
# ═══════════════════════════════════════════════════════════════════════════

from src.backend.routes.auth import auth_router
from src.backend.routes.users import users_router
from src.backend.routes.chits import router as chits_router
from src.backend.routes.trash import router as trash_router
from src.backend.routes.settings import router as settings_router
from src.backend.routes.contacts import router as contacts_router
from src.backend.routes.audit import router as audit_router
from src.backend.routes.health import router as health_router
from src.backend.routes.sharing import sharing_router
from src.backend.routes.notifications import notifications_router
from src.backend.routes.network_access import router as network_access_router
from src.backend.routes.push import push_router
from src.backend.routes.ntfy import ntfy_router

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(chits_router)
app.include_router(trash_router)
app.include_router(sharing_router)
app.include_router(notifications_router)
app.include_router(settings_router)
app.include_router(contacts_router)
app.include_router(audit_router)
app.include_router(health_router)
app.include_router(ntfy_router)
app.include_router(network_access_router)
app.include_router(push_router)


# ═══════════════════════════════════════════════════════════════════════════
# PWA File Serving
# ═══════════════════════════════════════════════════════════════════════════

# Resolve the PWA directory path (works both locally and in /app/ container)
_PWA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "src", "pwa")


@app.get("/sw.js", include_in_schema=False)
async def serve_service_worker():
    """Serve the service worker at root scope with correct headers."""
    return FileResponse(
        os.path.join(_PWA_DIR, "sw.js"),
        media_type="application/javascript",
        headers={"Service-Worker-Allowed": "/"},
    )


@app.get("/manifest.json", include_in_schema=False)
async def serve_manifest():
    """Serve the web app manifest with correct content type."""
    return FileResponse(
        os.path.join(_PWA_DIR, "manifest.json"),
        media_type="application/json",
    )


@app.get("/static/cwoc-icon-192.png", include_in_schema=False)
async def serve_icon_192():
    """Serve 192x192 PWA icon (referenced by manifest and apple-touch-icon)."""
    return FileResponse(
        os.path.join(_PWA_DIR, "cwoc-icon-192.png"),
        media_type="image/png",
    )


@app.get("/static/cwoc-icon-512.png", include_in_schema=False)
async def serve_icon_512():
    """Serve 512x512 PWA icon (referenced by manifest)."""
    return FileResponse(
        os.path.join(_PWA_DIR, "cwoc-icon-512.png"),
        media_type="image/png",
    )


# ═══════════════════════════════════════════════════════════════════════════
# Static File Serving
# ═══════════════════════════════════════════════════════════════════════════

# Serve frontend files from organized subdirectories under src/frontend/
app.mount("/frontend/html", StaticFiles(directory="/app/src/frontend/html"), name="frontend_html")
app.mount("/frontend/js", StaticFiles(directory="/app/src/frontend/js"), name="frontend_js")
app.mount("/frontend/css", StaticFiles(directory="/app/src/frontend/css"), name="frontend_css")

# Serve all files from /static/ (e.g., images, audio)
app.mount("/static", StaticFiles(directory="/app/src/static"), name="static")

# Serve contact profile pictures from data/contacts/
app.mount("/data/contacts", StaticFiles(directory="/app/data/contacts"), name="data_contacts")

# Serve user profile pictures from data/users/
app.mount("/data/users", StaticFiles(directory="/app/data/users"), name="data_users")

# Serve PWA files (pwa-register.js, offline.html, etc.) from src/pwa/
app.mount("/pwa", StaticFiles(directory="/app/src/pwa"), name="pwa")


# ═══════════════════════════════════════════════════════════════════════════
# Startup Events
# ═══════════════════════════════════════════════════════════════════════════

from src.backend.schedulers import start_weather_schedulers

@app.on_event("startup")
async def on_startup():
    await start_weather_schedulers()
