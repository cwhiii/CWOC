# ═══════════════════════════════════════════════════════════════════════════
# CWOC Backend — Entry Point
#
# This is the FastAPI application entry point. All route handlers, models,
# database helpers, and migrations have been extracted into focused modules:
#
#   backend/models.py       — Pydantic models
#   backend/db.py           — DB path, helpers, shared state
#   backend/migrations.py   — All migrate_* functions
#   backend/serializers.py  — vCard & CSV serializers
#   backend/weather.py      — Weather update service
#   backend/routes/chits.py — Chit CRUD + export/import
#   backend/routes/trash.py — Trash list, restore, purge
#   backend/routes/settings.py — Settings, standalone alerts, alert state
#   backend/routes/contacts.py — Contact CRUD, image, import/export
#   backend/routes/audit.py — Audit log + shared helpers
#   backend/routes/health.py — Health, version, sync, geocode, pages
# ═══════════════════════════════════════════════════════════════════════════

import asyncio
import logging

from fastapi import FastAPI
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


# ═══════════════════════════════════════════════════════════════════════════
# Database Initialization & Migrations
# (executed at import time, same order as the original monolith)
# ═══════════════════════════════════════════════════════════════════════════

from backend.db import init_db, seed_version_info
from backend.migrations import (
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
seed_version_info()


# ═══════════════════════════════════════════════════════════════════════════
# Register Route Modules
# ═══════════════════════════════════════════════════════════════════════════

from backend.routes.chits import router as chits_router
from backend.routes.trash import router as trash_router
from backend.routes.settings import router as settings_router
from backend.routes.contacts import router as contacts_router
from backend.routes.audit import router as audit_router
from backend.routes.health import router as health_router

app.include_router(chits_router)
app.include_router(trash_router)
app.include_router(settings_router)
app.include_router(contacts_router)
app.include_router(audit_router)
app.include_router(health_router)


# ═══════════════════════════════════════════════════════════════════════════
# Static File Serving
# ═══════════════════════════════════════════════════════════════════════════

# Serve all files from /frontend/ (e.g., index.html, settings.html, editor.html)
app.mount("/frontend", StaticFiles(directory="/app/frontend"), name="frontend")

# Serve all files from /static/ (e.g., images)
app.mount("/static", StaticFiles(directory="/app/static"), name="static")

# Serve contact profile pictures from data/contacts/
app.mount("/data/contacts", StaticFiles(directory="/app/data/contacts"), name="data_contacts")


# ═══════════════════════════════════════════════════════════════════════════
# Startup Events
# ═══════════════════════════════════════════════════════════════════════════

from backend.weather import start_weather_schedulers

@app.on_event("startup")
async def on_startup():
    await start_weather_schedulers()
