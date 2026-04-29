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

from src.backend.routes.chits import router as chits_router
from src.backend.routes.trash import router as trash_router
from src.backend.routes.settings import router as settings_router
from src.backend.routes.contacts import router as contacts_router
from src.backend.routes.audit import router as audit_router
from src.backend.routes.health import router as health_router

app.include_router(chits_router)
app.include_router(trash_router)
app.include_router(settings_router)
app.include_router(contacts_router)
app.include_router(audit_router)
app.include_router(health_router)


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


# ═══════════════════════════════════════════════════════════════════════════
# Startup Events
# ═══════════════════════════════════════════════════════════════════════════

from src.backend.weather import start_weather_schedulers

@app.on_event("startup")
async def on_startup():
    await start_weather_schedulers()
