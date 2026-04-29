# ═══════════════════════════════════════════════════════════════════════════
# Section 1: Imports
# ═══════════════════════════════════════════════════════════════════════════

import asyncio
import sqlite3
import json
import logging
import os
import re
import csv
import io
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, HTTPException, Query, UploadFile, File, Response, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from uuid import uuid4
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
import urllib.request
import urllib.parse
import urllib.error
import time


# ═══════════════════════════════════════════════════════════════════════════
# Section 2: Constants & Configuration
# ═══════════════════════════════════════════════════════════════════════════

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# FastAPI app
app = FastAPI()

# ── No-cache middleware for frontend/static files ─────────────────────────
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request as StarletteRequest

class NoCacheStaticMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: StarletteRequest, call_next):
        response = await call_next(request)
        path = request.url.path
        if path.startswith("/frontend/") or path.startswith("/static/"):
            response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"
        return response

app.add_middleware(NoCacheStaticMiddleware)

# Database path
DB_PATH = "/app/data/app.db"

# Lock to prevent concurrent update runs
_update_lock = asyncio.Lock()


# ═══════════════════════════════════════════════════════════════════════════
# Section 3: Pydantic Models
# ═══════════════════════════════════════════════════════════════════════════

class Tag(BaseModel):
    name: str
    color: Optional[str] = None
    fontColor: Optional[str] = None
    favorite: Optional[bool] = False

class Settings(BaseModel):
    user_id: str
    time_format: Optional[str] = None
    sex: Optional[str] = None
    snooze_length: Optional[str] = None
    default_filters: Optional[Any] = None  # Object {tab: "filter text"} or legacy List[str]
    alarm_orientation: Optional[str] = None
    active_clocks: Optional[str] = None  # JSON array of active clock format values, e.g. '["24hour","12hour"]'
    saved_locations: Optional[str] = None  # JSON array of saved location objects, e.g. '[{"label":"Home","address":"4 Rolling Mill Way, Canton, MA 02021","is_default":true}]'
    tags: Optional[List[Tag]] = None
    custom_colors: Optional[List[Any]] = None
    visual_indicators: Optional[Dict[str, Any]] = None
    chit_options: Optional[Dict[str, bool]] = None
    calendar_snap: Optional[str] = "15"
    week_start_day: Optional[str] = "0"  # 0=Sunday, 1=Monday, etc.
    work_start_hour: Optional[str] = "8"
    work_end_hour: Optional[str] = "17"
    work_days: Optional[str] = "1,2,3,4,5"  # CSV of day numbers (0=Sun, 1=Mon, ...)
    enabled_periods: Optional[str] = "Itinerary,Day,Week,Work,SevenDay,Month,Year"
    custom_days_count: Optional[str] = "7"  # for X Days view
    all_view_start_hour: Optional[str] = "0"  # hour range for non-work views
    all_view_end_hour: Optional[str] = "24"
    day_scroll_to_hour: Optional[str] = "5"  # initial scroll position on calendar load
    username: Optional[str] = None  # Display name for audit log attribution
    audit_log_max_days: Optional[int] = 1096
    audit_log_max_mb: Optional[int] = 1
    default_notifications: Optional[Dict[str, Any]] = None  # { start: [...], due: [...] }
    unit_system: Optional[str] = "imperial"  # "imperial" or "metric"

class Chit(BaseModel):
    id: Optional[str] = None
    title: Optional[str] = None
    note: Optional[str] = None
    tags: Optional[List[str]] = None
    start_datetime: Optional[str] = None
    end_datetime: Optional[str] = None
    due_datetime: Optional[str] = None
    completed_datetime: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    severity: Optional[str] = None  # Added severity here
    checklist: Optional[List[Dict[str, Any]]] = None
    alarm: Optional[bool] = None
    notification: Optional[bool] = None
    recurrence: Optional[str] = None
    recurrence_id: Optional[str] = None
    recurrence_rule: Optional[Dict[str, Any]] = None  # { freq, interval, byDay, until }
    recurrence_exceptions: Optional[List[Dict[str, Any]]] = None  # [{ date, completed, title, broken_off }]
    location: Optional[str] = None
    color: Optional[str] = None
    people: Optional[List[str]] = None
    pinned: Optional[bool] = None
    archived: Optional[bool] = None
    deleted: Optional[bool] = None
    created_datetime: Optional[str] = None
    modified_datetime: Optional[str] = None
    is_project_master: Optional[bool] = False  # New field
    child_chits: Optional[List[str]] = None    # New field
    all_day: Optional[bool] = False            # All-day event flag
    alerts: Optional[List[Dict[str, Any]]] = None  # Alarms, timers, stopwatches, notifications
    progress_percent: Optional[int] = None     # 0-100 progress percentage
    time_estimate: Optional[str] = None        # Free-text time estimate (e.g. "2h 30m")
    weather_data: Optional[str] = None         # JSON string of weather forecast data
    health_data: Optional[str] = None          # JSON string of health indicator readings

class MultiValueEntry(BaseModel):
    label: Optional[str] = None    # "Work", "Home", "Mobile", custom
    value: Optional[str] = None

class Contact(BaseModel):
    id: Optional[str] = None
    given_name: str                          # Required
    surname: Optional[str] = None
    middle_names: Optional[str] = None
    prefix: Optional[str] = None
    suffix: Optional[str] = None
    nickname: Optional[str] = None
    display_name: Optional[str] = None
    phones: Optional[List[MultiValueEntry]] = None
    emails: Optional[List[MultiValueEntry]] = None
    addresses: Optional[List[MultiValueEntry]] = None
    call_signs: Optional[List[MultiValueEntry]] = None
    x_handles: Optional[List[MultiValueEntry]] = None
    websites: Optional[List[MultiValueEntry]] = None
    has_signal: Optional[bool] = False
    signal_username: Optional[str] = None
    pgp_key: Optional[str] = None
    favorite: Optional[bool] = False
    color: Optional[str] = None
    organization: Optional[str] = None
    social_context: Optional[str] = None
    image_url: Optional[str] = None
    notes: Optional[str] = None
    tags: Optional[List[str]] = None
    created_datetime: Optional[str] = None
    modified_datetime: Optional[str] = None

class ImportRequest(BaseModel):
    mode: str   # "add" or "replace"
    data: dict  # The full ExportEnvelope


# ═══════════════════════════════════════════════════════════════════════════
# Section 4: Database Helpers (init, migrations, serialize/deserialize)
# ═══════════════════════════════════════════════════════════════════════════

def compute_display_name(contact) -> str:
    """Concatenate prefix + given_name + middle_names + surname + suffix into a display name."""
    parts = []
    # Support both dict and Pydantic model access
    if isinstance(contact, dict):
        for field in ["prefix", "given_name", "middle_names", "surname", "suffix"]:
            val = contact.get(field)
            if val and val.strip():
                parts.append(val.strip())
    else:
        for field in ["prefix", "given_name", "middle_names", "surname", "suffix"]:
            val = getattr(contact, field, None)
            if val and val.strip():
                parts.append(val.strip())
    return " ".join(parts)

# JSON serialization/deserialization helpers
def serialize_json_field(data: Any) -> Optional[str]:
    if data is None:
        return None
    try:
        return json.dumps(data)
    except TypeError as e:
        logger.error(f"Serialization error: {str(e)}")
        return None

def deserialize_json_field(data: Optional[str]) -> Any:
    if data is None:
        return None
    try:
        return json.loads(data)
    except json.JSONDecodeError as e:
        logger.error(f"Deserialization error: {str(e)}")
        return None


def compute_system_tags(chit) -> List[str]:
    """Compute system tags based on chit properties. Returns merged list of user + system tags."""
    system_tags = []
    if chit.due_datetime or chit.start_datetime:
        system_tags.append("CWOC_System/Calendar")
    if chit.checklist:
        system_tags.append("CWOC_System/Checklists")
    if chit.alarm:
        system_tags.append("CWOC_System/Alarms")
    if "Project" in (chit.tags or []):
        system_tags.append("CWOC_System/Projects")
    if chit.status in ["ToDo", "In Progress", "Blocked", "Complete"]:
        system_tags.append("CWOC_System/Tasks")
    if not (chit.due_datetime or chit.start_datetime or chit.end_datetime):
        system_tags.append("CWOC_System/Notes")
    # Strip old flat system tags from user tags before merging
    old_system = {"Calendar", "Checklists", "Alarms", "Projects", "Tasks", "Notes"}
    user_tags = [t for t in (chit.tags or []) if t not in old_system]
    return list(set(user_tags + system_tags))

# Database initialization
def init_db():
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS chits (
            id TEXT PRIMARY KEY,
            title TEXT,
            note TEXT,
            tags TEXT,
            start_datetime TEXT,
            end_datetime TEXT,
            due_datetime TEXT,
            completed_datetime TEXT,
            status TEXT,
            priority TEXT,
            severity TEXT,
            checklist TEXT,
            alarm BOOLEAN,
            notification BOOLEAN,
            recurrence TEXT,
            recurrence_id TEXT,
            location TEXT,
            color TEXT,
            people TEXT,
            pinned BOOLEAN,
            archived BOOLEAN,
            deleted BOOLEAN,
            created_datetime TEXT,
            modified_datetime TEXT,
            is_project_master BOOLEAN DEFAULT 0,
            child_chits TEXT,
            all_day BOOLEAN DEFAULT 0,
            alerts TEXT,
            recurrence_rule TEXT,
            recurrence_exceptions TEXT
        )
        """)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS settings (
            user_id TEXT PRIMARY KEY,
            time_format TEXT,
            sex TEXT,
            snooze_length TEXT,
            default_filters TEXT,
            alarm_orientation TEXT,
            active_clocks TEXT,
            tags TEXT,
            custom_colors TEXT,
            visual_indicators TEXT,
            chit_options TEXT,
            calendar_snap TEXT DEFAULT '15'
        )
        """)
        conn.commit()
    except Exception as e:
        logger.error(f"Error initializing database: {str(e)}")
        raise
    finally:
        if conn:
            conn.close()

# Instance ID: generate a unique ID for this installation
def get_or_create_instance_id():
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("CREATE TABLE IF NOT EXISTS instance_meta (key TEXT PRIMARY KEY, value TEXT)")
        cursor.execute("SELECT value FROM instance_meta WHERE key = 'instance_id'")
        row = cursor.fetchone()
        if row:
            return row[0]
        iid = str(uuid4())
        cursor.execute("INSERT INTO instance_meta (key, value) VALUES ('instance_id', ?)", (iid,))
        conn.commit()
        return iid
    except Exception as e:
        logger.error(f"Error getting instance ID: {str(e)}")
        return "unknown"
    finally:
        if conn:
            conn.close()

# Export envelope builder
def _build_export_envelope(data_type, data):
    """Build a self-contained export envelope with metadata and payload.
    Reads VERSION from /app/VERSION (production) or project-root VERSION (dev).
    """
    version = "unknown"
    for path in ["/app/VERSION", os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "VERSION")]:
        try:
            with open(path, "r") as f:
                first_line = f.readline().strip()
                if first_line:
                    version = first_line
                    break
        except (FileNotFoundError, IOError):
            continue
    return {
        "type": data_type,
        "version": version,
        "exported_at": datetime.utcnow().isoformat() + "Z",
        "instance_id": get_or_create_instance_id(),
        "data": data,
    }

# Version info helpers
def get_version_info():
    """Read version + installed_datetime from instance_meta.
    Returns {"version": str, "installed_datetime": str|None}."""
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT key, value FROM instance_meta WHERE key IN ('version', 'installed_datetime')")
        rows = {row[0]: row[1] for row in cursor.fetchall()}
        return {
            "version": rows.get("version", "unknown"),
            "installed_datetime": rows.get("installed_datetime", None)
        }
    except Exception as e:
        logger.error(f"Error getting version info: {str(e)}")
        return {"version": "unknown", "installed_datetime": None}
    finally:
        if conn:
            conn.close()

def update_version_info(version, installed_datetime):
    """Upsert version and installed_datetime into instance_meta."""
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO instance_meta (key, value) VALUES ('version', ?) "
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (version,)
        )
        cursor.execute(
            "INSERT INTO instance_meta (key, value) VALUES ('installed_datetime', ?) "
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (installed_datetime,)
        )
        conn.commit()
    except Exception as e:
        logger.error(f"Error updating version info: {str(e)}")
    finally:
        if conn:
            conn.close()

def seed_version_info():
    """At startup, always sync version from /app/VERSION into the database."""
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # Read the currently stored version before upserting
        old_version = None
        try:
            cursor.execute("SELECT value FROM instance_meta WHERE key = 'version'")
            row = cursor.fetchone()
            if row:
                old_version = row[0]
        except Exception:
            pass

        # Read version from /app/VERSION
        version = "unknown"
        try:
            with open("/app/VERSION", "r") as f:
                first_line = f.readline().strip()
                if first_line:
                    version = first_line
        except (FileNotFoundError, IOError):
            pass
        installed_datetime = datetime.utcnow().isoformat() + "Z"
        # Upsert version
        cursor.execute(
            "INSERT INTO instance_meta (key, value) VALUES ('version', ?) "
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (version,)
        )
        # Only set installed_datetime if it doesn't exist yet
        cursor.execute(
            "INSERT OR IGNORE INTO instance_meta (key, value) VALUES ('installed_datetime', ?)",
            (installed_datetime,)
        )
        conn.commit()

        # Audit: log version change if version actually changed
        if old_version is not None and old_version != version:
            try:
                audit_conn = sqlite3.connect(DB_PATH)
                actor = get_current_actor()
                changes = [{"field": "version", "old": old_version, "new": version}]
                insert_audit_entry(audit_conn, "system", "version", "updated", actor, changes=changes)
                audit_conn.commit()
                audit_conn.close()
            except Exception as e:
                logger.error(f"Audit: failed to log version change in seed_version_info: {str(e)}")

    except Exception as e:
        logger.error(f"Error seeding version info: {str(e)}")
    finally:
        if conn:
            conn.close()

# Migration: Rename labels to tags
def migrate_labels_to_tags():
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(chits)")
        columns = [col[1] for col in cursor.fetchall()]
        if "labels" in columns and "tags" not in columns:
            cursor.execute("ALTER TABLE chits RENAME COLUMN labels TO tags")
            conn.commit()
            logger.info("Migrated labels column to tags")
    except Exception as e:
        logger.error(f"Error migrating labels to tags: {str(e)}")
        raise
    finally:
        if conn:
            conn.close()

# Migration: Add all_day column if missing
def migrate_add_all_day():
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(chits)")
        columns = [col[1] for col in cursor.fetchall()]
        if "all_day" not in columns:
            cursor.execute("ALTER TABLE chits ADD COLUMN all_day BOOLEAN DEFAULT 0")
            conn.commit()
            logger.info("Added all_day column to chits table")
    except Exception as e:
        logger.error(f"Error adding all_day column: {str(e)}")
        raise
    finally:
        if conn:
            conn.close()

# Migration: Add alerts column if missing
def migrate_add_alerts():
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(chits)")
        columns = [col[1] for col in cursor.fetchall()]
        if "alerts" not in columns:
            cursor.execute("ALTER TABLE chits ADD COLUMN alerts TEXT")
            conn.commit()
            logger.info("Added alerts column to chits table")
    except Exception as e:
        logger.error(f"Error adding alerts column: {str(e)}")
        raise
    finally:
        if conn:
            conn.close()

def migrate_add_calendar_snap():
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(settings)")
        columns = [col[1] for col in cursor.fetchall()]
        if "calendar_snap" not in columns:
            cursor.execute("ALTER TABLE settings ADD COLUMN calendar_snap TEXT DEFAULT '15'")
            conn.commit()
            logger.info("Added calendar_snap column to settings table")
        if "week_start_day" not in columns:
            cursor.execute("ALTER TABLE settings ADD COLUMN week_start_day TEXT DEFAULT '0'")
            conn.commit()
            logger.info("Added week_start_day column to settings table")
    except Exception as e:
        logger.error(f"Error adding calendar settings columns: {str(e)}")
        raise
    finally:
        if conn:
            conn.close()

def migrate_add_recurrence_fields():
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(chits)")
        columns = [col[1] for col in cursor.fetchall()]
        if "recurrence_rule" not in columns:
            cursor.execute("ALTER TABLE chits ADD COLUMN recurrence_rule TEXT")
            conn.commit()
            logger.info("Added recurrence_rule column to chits table")
        if "recurrence_exceptions" not in columns:
            cursor.execute("ALTER TABLE chits ADD COLUMN recurrence_exceptions TEXT")
            conn.commit()
            logger.info("Added recurrence_exceptions column to chits table")
        # Migrate old recurrence strings to new format
        cursor.execute("SELECT id, recurrence FROM chits WHERE recurrence IS NOT NULL AND recurrence != ''")
        rows = cursor.fetchall()
        for row in rows:
            chit_id, old_rec = row
            freq_map = {"Hourly": "HOURLY", "Daily": "DAILY", "Weekly": "WEEKLY", "Monthly": "MONTHLY", "Yearly": "YEARLY"}
            if old_rec in freq_map:
                new_rule = serialize_json_field({"freq": freq_map[old_rec], "interval": 1})
                cursor.execute("UPDATE chits SET recurrence_rule = ? WHERE id = ?", (new_rule, chit_id))
        conn.commit()
    except Exception as e:
        logger.error(f"Error adding recurrence fields: {str(e)}")
        raise
    finally:
        if conn:
            conn.close()

def migrate_add_work_hours():
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(settings)")
        columns = [col[1] for col in cursor.fetchall()]
        if "work_start_hour" not in columns:
            cursor.execute("ALTER TABLE settings ADD COLUMN work_start_hour TEXT DEFAULT '8'")
        if "work_end_hour" not in columns:
            cursor.execute("ALTER TABLE settings ADD COLUMN work_end_hour TEXT DEFAULT '17'")
        if "work_days" not in columns:
            cursor.execute("ALTER TABLE settings ADD COLUMN work_days TEXT DEFAULT '1,2,3,4,5'")
        if "enabled_periods" not in columns:
            cursor.execute("ALTER TABLE settings ADD COLUMN enabled_periods TEXT DEFAULT 'Itinerary,Day,Week,Work,SevenDay,Month,Year'")
        if "custom_days_count" not in columns:
            cursor.execute("ALTER TABLE settings ADD COLUMN custom_days_count TEXT DEFAULT '7'")
        if "active_clocks" not in columns:
            cursor.execute("ALTER TABLE settings ADD COLUMN active_clocks TEXT")
        if "all_view_start_hour" not in columns:
            cursor.execute("ALTER TABLE settings ADD COLUMN all_view_start_hour TEXT DEFAULT '0'")
        if "all_view_end_hour" not in columns:
            cursor.execute("ALTER TABLE settings ADD COLUMN all_view_end_hour TEXT DEFAULT '24'")
        if "day_scroll_to_hour" not in columns:
            cursor.execute("ALTER TABLE settings ADD COLUMN day_scroll_to_hour TEXT DEFAULT '5'")
        conn.commit()
    except Exception as e:
        logger.error(f"Error adding work hours columns: {str(e)}")
        raise
    finally:
        if conn:
            conn.close()

# Migration: Add saved_locations column if missing
def migrate_add_saved_locations():
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(settings)")
        columns = [col[1] for col in cursor.fetchall()]
        if "saved_locations" not in columns:
            cursor.execute("ALTER TABLE settings ADD COLUMN saved_locations TEXT")
            conn.commit()
            logger.info("Added saved_locations column to settings table")
    except Exception as e:
        logger.error(f"Error adding saved_locations column: {str(e)}")
        raise
    finally:
        if conn:
            conn.close()

# Initialize contacts table
def init_contacts_table():
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS contacts (
            id TEXT PRIMARY KEY,
            given_name TEXT NOT NULL,
            surname TEXT,
            middle_names TEXT,
            prefix TEXT,
            suffix TEXT,
            display_name TEXT,
            phones TEXT,
            emails TEXT,
            addresses TEXT,
            call_signs TEXT,
            x_handles TEXT,
            websites TEXT,
            has_signal BOOLEAN DEFAULT 0,
            pgp_key TEXT,
            favorite BOOLEAN DEFAULT 0,
            created_datetime TEXT,
            modified_datetime TEXT
        )
        """)
        conn.commit()
    except Exception as e:
        logger.error(f"Error initializing contacts table: {str(e)}")
        raise
    finally:
        if conn:
            conn.close()

def migrate_contacts_add_new_fields():
    """Add nickname, signal_username, color, organization, social_context, image_url, notes, tags columns."""
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(contacts)")
        existing = {row[1] for row in cursor.fetchall()}
        new_cols = [
            ("nickname", "TEXT"),
            ("signal_username", "TEXT"),
            ("color", "TEXT"),
            ("organization", "TEXT"),
            ("social_context", "TEXT"),
            ("image_url", "TEXT"),
            ("notes", "TEXT"),
            ("tags", "TEXT"),
        ]
        for col_name, col_type in new_cols:
            if col_name not in existing:
                cursor.execute(f"ALTER TABLE contacts ADD COLUMN {col_name} {col_type}")
                logger.info(f"Added column {col_name} to contacts table")
        conn.commit()
    except Exception as e:
        logger.error(f"Error adding new contact fields: {str(e)}")
        raise
    finally:
        if conn:
            conn.close()

def migrate_add_progress_and_estimate():
    """Add progress_percent and time_estimate columns to chits if missing."""
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(chits)")
        existing = {row[1] for row in cursor.fetchall()}
        if "progress_percent" not in existing:
            cursor.execute("ALTER TABLE chits ADD COLUMN progress_percent INTEGER")
            logger.info("Added column progress_percent to chits table")
        if "time_estimate" not in existing:
            cursor.execute("ALTER TABLE chits ADD COLUMN time_estimate TEXT")
            logger.info("Added column time_estimate to chits table")
        conn.commit()
    except Exception as e:
        logger.error(f"Error adding progress/estimate fields: {str(e)}")
    finally:
        if conn:
            conn.close()

def migrate_add_username():
    """Add username column to settings if missing."""
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(settings)")
        existing = {row[1] for row in cursor.fetchall()}
        if "username" not in existing:
            cursor.execute("ALTER TABLE settings ADD COLUMN username TEXT")
            logger.info("Added column username to settings table")
        conn.commit()
    except Exception as e:
        logger.error(f"Error adding username field: {str(e)}")
    finally:
        if conn:
            conn.close()

def migrate_add_weather_data():
    """Add weather_data column to chits if missing."""
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(chits)")
        existing = {row[1] for row in cursor.fetchall()}
        if "weather_data" not in existing:
            cursor.execute("ALTER TABLE chits ADD COLUMN weather_data TEXT")
            logger.info("Added weather_data column to chits table")
        if "health_data" not in existing:
            cursor.execute("ALTER TABLE chits ADD COLUMN health_data TEXT")
            logger.info("Added health_data column to chits table")
        conn.commit()
    except Exception as e:
        logger.error(f"Error adding weather_data column: {str(e)}")
    finally:
        if conn:
            conn.close()


# ── Audit Log: migration + helpers ───────────────────────────────────────

def migrate_add_audit_log():
    """Create audit_log table and indexes if they don't already exist."""
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS audit_log (
                id TEXT PRIMARY KEY,
                entity_type TEXT NOT NULL,
                entity_id TEXT NOT NULL,
                action TEXT NOT NULL,
                actor TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                changes TEXT,
                entity_summary TEXT
            )
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_audit_entity
            ON audit_log (entity_type, entity_id)
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_audit_timestamp
            ON audit_log (timestamp)
        """)
        conn.commit()
        logger.info("Audit log table and indexes ready")
    except Exception as e:
        logger.error(f"Error creating audit_log table: {str(e)}")
    finally:
        if conn:
            conn.close()


def migrate_add_audit_settings():
    """Add audit_log_max_days and audit_log_max_mb columns to settings table."""
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(settings)")
        existing = {row[1] for row in cursor.fetchall()}
        if "audit_log_max_days" not in existing:
            cursor.execute("ALTER TABLE settings ADD COLUMN audit_log_max_days INTEGER DEFAULT 1096")
        if "audit_log_max_mb" not in existing:
            cursor.execute("ALTER TABLE settings ADD COLUMN audit_log_max_mb REAL DEFAULT 1.0")
        conn.commit()
        logger.info("Audit settings columns ready")
    except Exception as e:
        logger.error(f"Error adding audit settings columns: {str(e)}")
    finally:
        if conn:
            conn.close()


def migrate_add_default_notifications():
    """Add default_notifications and unit_system columns to settings table."""
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(settings)")
        existing = {row[1] for row in cursor.fetchall()}
        if "default_notifications" not in existing:
            cursor.execute("ALTER TABLE settings ADD COLUMN default_notifications TEXT")
            conn.commit()
            logger.info("Added default_notifications column to settings table")
        if "unit_system" not in existing:
            cursor.execute("ALTER TABLE settings ADD COLUMN unit_system TEXT DEFAULT 'imperial'")
            conn.commit()
            logger.info("Added unit_system column to settings table")
    except Exception as e:
        logger.error(f"Error adding settings columns: {str(e)}")
    finally:
        if conn:
            conn.close()

def migrate_add_standalone_alerts():
    """Create standalone_alerts table for independent alerts not connected to any chit."""
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS standalone_alerts (
                id TEXT PRIMARY KEY,
                _type TEXT NOT NULL,
                name TEXT,
                data TEXT,
                created_datetime TEXT,
                modified_datetime TEXT
            )
        """)
        conn.commit()
        logger.info("standalone_alerts table ready")
    except Exception as e:
        logger.error(f"Error creating standalone_alerts table: {str(e)}")
    finally:
        if conn:
            conn.close()


def migrate_add_alert_state():
    """Create alert_state table for persisting dismiss/snooze state across devices."""
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS alert_state (
                alert_key TEXT PRIMARY KEY,
                state TEXT NOT NULL,
                until_ts TEXT,
                updated_at TEXT NOT NULL
            )
        """)
        conn.commit()
        logger.info("alert_state table ready")
    except Exception as e:
        logger.error(f"Error creating alert_state table: {str(e)}")
    finally:
        if conn:
            conn.close()


def migrate_contact_images_to_data():
    """Move contact profile images from /app/static/contact_images/ to data/contacts/profile_pictures/
    and update image_url values in the contacts table."""
    import shutil
    old_dir = "/app/static/contact_images/"
    new_dir = "/app/data/contacts/profile_pictures/"
    os.makedirs(new_dir, exist_ok=True)

    # Step 1: Copy image files from old to new location (if old dir exists and has files)
    if os.path.isdir(old_dir):
        for fname in os.listdir(old_dir):
            old_path = os.path.join(old_dir, fname)
            new_path = os.path.join(new_dir, fname)
            if os.path.isfile(old_path) and not os.path.exists(new_path):
                shutil.copy2(old_path, new_path)
                logger.info(f"Copied contact image {fname} to {new_dir}")

    # Step 2: Update image_url values in the contacts table
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT id, image_url FROM contacts WHERE image_url IS NOT NULL AND image_url != ''")
        rows = cursor.fetchall()
        updated = 0
        for row in rows:
            contact_id, image_url = row
            if image_url and image_url.startswith("/static/contact_images/"):
                new_url = image_url.replace("/static/contact_images/", "/data/contacts/profile_pictures/")
                cursor.execute("UPDATE contacts SET image_url = ? WHERE id = ?", (new_url, contact_id))
                updated += 1
        conn.commit()
        logger.info(f"migrate_contact_images_to_data: updated {updated} image_url rows")
    except Exception as e:
        logger.error(f"Error in migrate_contact_images_to_data: {str(e)}")
    finally:
        if conn:
            conn.close()


def _run_auto_prune():
    """Auto-prune audit log based on settings limits. Returns (pruned_by_age, pruned_by_size)."""
    pruned_by_age = 0
    pruned_by_size = 0
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # Read audit settings
        cursor.execute("SELECT audit_log_max_days, audit_log_max_mb FROM settings WHERE user_id = 'default_user'")
        row = cursor.fetchone()
        if not row:
            return (0, 0)

        max_days = row[0]
        max_mb = row[1]

        # If both limits are None, skip pruning entirely
        if max_days is None and max_mb is None:
            return (0, 0)

        # Prune by age
        if max_days and max_days > 0:
            cutoff = (datetime.utcnow() - timedelta(days=max_days)).isoformat()
            cursor.execute("DELETE FROM audit_log WHERE timestamp < ?", (cutoff,))
            pruned_by_age = cursor.rowcount

        # Prune by size — single bulk DELETE based on average row size estimate
        if max_mb and max_mb > 0:
            max_bytes = max_mb * 1024 * 1024
            cursor.execute("""
                SELECT COUNT(*),
                       SUM(LENGTH(id) + LENGTH(entity_type) + LENGTH(entity_id) + LENGTH(action) +
                           LENGTH(actor) + LENGTH(timestamp) + COALESCE(LENGTH(changes),0) +
                           COALESCE(LENGTH(entity_summary),0))
                FROM audit_log
            """)
            count_row = cursor.fetchone()
            total_rows = count_row[0] or 0
            total_size = count_row[1] or 0
            if total_rows > 0 and total_size > max_bytes:
                avg_row_size = total_size / total_rows
                rows_to_keep = int(max_bytes / avg_row_size) if avg_row_size > 0 else total_rows
                rows_to_delete = total_rows - rows_to_keep
                if rows_to_delete > 0:
                    cursor.execute("""
                        DELETE FROM audit_log WHERE id IN (
                            SELECT id FROM audit_log ORDER BY timestamp ASC LIMIT ?
                        )
                    """, (rows_to_delete,))
                    pruned_by_size = cursor.rowcount

        conn.commit()
        logger.info(f"Auto-prune: removed {pruned_by_age} by age, {pruned_by_size} by size")
    except Exception as e:
        logger.error(f"Auto-prune error: {str(e)}")
    finally:
        if conn:
            conn.close()
    return (pruned_by_age, pruned_by_size)


def get_current_actor() -> str:
    """Read the username from settings for default_user.
    Returns 'Unknown Gremlin' if no username is configured or on any error."""
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT username FROM settings WHERE user_id = 'default_user'")
        row = cursor.fetchone()
        if row and row[0]:
            return row[0]
        return "Unknown Gremlin"
    except Exception:
        return "Unknown Gremlin"
    finally:
        if conn:
            conn.close()


# Fields stored as JSON strings in SQLite that need deserialization before diff comparison
_JSON_SERIALIZED_FIELDS = {
    "tags", "checklist", "people", "child_chits", "alerts",
    "recurrence_rule", "recurrence_exceptions", "weather_data", "health_data",
    "phones", "emails", "addresses", "call_signs", "x_handles",
    "websites", "default_filters", "custom_colors", "visual_indicators",
    "chit_options", "active_clocks", "saved_locations",
}

# Fields excluded from audit diffs by default
_AUDIT_EXCLUDE_FIELDS = {"modified_datetime", "created_datetime"}


def compute_audit_diff(old_dict, new_dict, exclude_fields=None):
    """Compare two dicts field-by-field and return a list of change details.

    Each entry is {"field": str, "old": any, "new": any} for fields that differ.
    JSON-serialized fields are deserialized before comparison.
    Excludes modified_datetime and created_datetime by default.
    Returns empty list for non-dict input (with a logged warning).
    """
    if not isinstance(old_dict, dict) or not isinstance(new_dict, dict):
        logger.warning("compute_audit_diff called with non-dict input")
        return []

    if exclude_fields is None:
        exclude_fields = _AUDIT_EXCLUDE_FIELDS

    changes = []
    all_keys = set(old_dict.keys()) | set(new_dict.keys())

    for key in sorted(all_keys):
        if key in exclude_fields:
            continue

        old_val = old_dict.get(key)
        new_val = new_dict.get(key)

        # Deserialize JSON-serialized fields for meaningful comparison
        if key in _JSON_SERIALIZED_FIELDS:
            if isinstance(old_val, str):
                old_val = deserialize_json_field(old_val)
            if isinstance(new_val, str):
                new_val = deserialize_json_field(new_val)

        if old_val != new_val:
            changes.append({"field": key, "old": old_val, "new": new_val})

    return changes


def insert_audit_entry(conn, entity_type, entity_id, action, actor, changes=None, entity_summary=None):
    """Insert a single audit log row. Best-effort — never raises."""
    try:
        cursor = conn.cursor()
        entry_id = str(uuid4())
        ts = datetime.utcnow().isoformat()
        changes_json = json.dumps(changes) if changes is not None else None
        cursor.execute(
            """
            INSERT INTO audit_log (id, entity_type, entity_id, action, actor, timestamp, changes, entity_summary)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (entry_id, entity_type, str(entity_id), action, actor, ts, changes_json, entity_summary)
        )
    except Exception as e:
        logger.error(f"Audit insert failed (best-effort): {str(e)}")


# Contact DB helpers

def _serialize_contact_for_db(contact) -> dict:
    """Extract contact fields into a dict ready for SQLite insertion.
    Handles both Pydantic models and plain dicts.
    """
    def _get(field, default=None):
        if isinstance(contact, dict):
            return contact.get(field, default)
        return getattr(contact, field, default)

    # Convert MultiValueEntry lists to list-of-dicts for JSON serialization
    def _mv_to_dicts(entries):
        if not entries:
            return None
        result = []
        for e in entries:
            if isinstance(e, dict):
                result.append(e)
            else:
                result.append(e.dict())
        return result if result else None

    return {
        "given_name": _get("given_name"),
        "surname": _get("surname"),
        "middle_names": _get("middle_names"),
        "prefix": _get("prefix"),
        "suffix": _get("suffix"),
        "nickname": _get("nickname"),
        "display_name": compute_display_name(contact),
        "phones": serialize_json_field(_mv_to_dicts(_get("phones"))),
        "emails": serialize_json_field(_mv_to_dicts(_get("emails"))),
        "addresses": serialize_json_field(_mv_to_dicts(_get("addresses"))),
        "call_signs": serialize_json_field(_mv_to_dicts(_get("call_signs"))),
        "x_handles": serialize_json_field(_mv_to_dicts(_get("x_handles"))),
        "websites": serialize_json_field(_mv_to_dicts(_get("websites"))),
        "has_signal": 1 if _get("has_signal") else 0,
        "signal_username": _get("signal_username"),
        "pgp_key": _get("pgp_key"),
        "favorite": 1 if _get("favorite") else 0,
        "color": _get("color"),
        "organization": _get("organization"),
        "social_context": _get("social_context"),
        "image_url": _get("image_url"),
        "notes": _get("notes"),
        "tags": serialize_json_field(_get("tags")),
    }


def _row_to_contact(row: dict) -> dict:
    """Convert a SQLite row dict into a Contact-compatible JSON dict."""
    row["phones"] = deserialize_json_field(row.get("phones"))
    row["emails"] = deserialize_json_field(row.get("emails"))
    row["addresses"] = deserialize_json_field(row.get("addresses"))
    row["call_signs"] = deserialize_json_field(row.get("call_signs"))
    row["x_handles"] = deserialize_json_field(row.get("x_handles"))
    row["websites"] = deserialize_json_field(row.get("websites"))
    row["has_signal"] = bool(row.get("has_signal"))
    row["favorite"] = bool(row.get("favorite"))
    # Ensure new fields have defaults if missing from older rows
    row.setdefault("nickname", None)
    row.setdefault("signal_username", None)
    row.setdefault("color", None)
    row.setdefault("organization", None)
    row.setdefault("social_context", None)
    row.setdefault("image_url", None)
    row.setdefault("notes", None)
    row["tags"] = deserialize_json_field(row.get("tags"))
    return row


def _write_vcf_file(contact_id: str, contact) -> None:
    """Write a .vcf file for the given contact to CONTACTS_DIR."""
    vcf_content = vcard_print(contact)
    filepath = os.path.join(CONTACTS_DIR, f"{contact_id}.vcf")
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(vcf_content)


# ═══════════════════════════════════════════════════════════════════════════
# Section 5: vCard & CSV Serializers
# ═══════════════════════════════════════════════════════════════════════════

def vcard_parse(vcard_string: str) -> dict:
    """Parse a vCard 3.0 string into a Contact dict.

    Maps standard vCard properties (N, FN, TEL, EMAIL, ADR, URL) and
    custom X-properties (X-SIGNAL, X-PGP-KEY, X-CALLSIGN, X-XHANDLE)
    to Contact model fields.  Returns a plain dict suitable for
    constructing a Contact Pydantic model.
    """
    contact: Dict[str, Any] = {
        "given_name": "",
        "surname": None,
        "middle_names": None,
        "prefix": None,
        "suffix": None,
        "phones": [],
        "emails": [],
        "addresses": [],
        "websites": [],
        "call_signs": [],
        "x_handles": [],
        "has_signal": False,
        "pgp_key": None,
        "favorite": False,
    }

    fn_value = None  # fallback display name from FN line

    # Unfold continuation lines (RFC 2425 §5.8.1): a line starting with
    # a space or tab is a continuation of the previous logical line.
    unfolded_lines: List[str] = []
    for raw_line in vcard_string.splitlines():
        if raw_line.startswith((" ", "\t")) and unfolded_lines:
            unfolded_lines[-1] += raw_line[1:]
        else:
            unfolded_lines.append(raw_line)

    for line in unfolded_lines:
        line = line.strip()
        if not line or line.upper() in ("BEGIN:VCARD", "END:VCARD", "VERSION:3.0"):
            continue

        # Split into property name (with params) and value
        colon_idx = line.find(":")
        if colon_idx == -1:
            continue
        prop_part = line[:colon_idx]
        value = line[colon_idx + 1:]

        # Parse property name and parameters (e.g. TEL;TYPE=Work)
        parts = prop_part.split(";")
        prop_name = parts[0].upper()
        params: Dict[str, str] = {}
        for p in parts[1:]:
            if "=" in p:
                pk, pv = p.split("=", 1)
                params[pk.upper()] = pv
            else:
                # Bare parameter (e.g. ";WORK") treated as TYPE
                params["TYPE"] = p

        label = params.get("TYPE", None)

        if prop_name == "N":
            # N:Surname;GivenName;MiddleNames;Prefix;Suffix
            n_parts = value.split(";")
            while len(n_parts) < 5:
                n_parts.append("")
            contact["surname"] = n_parts[0] if n_parts[0] else None
            contact["given_name"] = n_parts[1] if n_parts[1] else ""
            contact["middle_names"] = n_parts[2] if n_parts[2] else None
            contact["prefix"] = n_parts[3] if n_parts[3] else None
            contact["suffix"] = n_parts[4] if n_parts[4] else None

        elif prop_name == "FN":
            fn_value = value

        elif prop_name == "TEL":
            if value:
                contact["phones"].append({"label": label, "value": value})

        elif prop_name == "EMAIL":
            if value:
                contact["emails"].append({"label": label, "value": value})

        elif prop_name == "ADR":
            # ADR;TYPE=x:PO Box;Extended;Street;City;Region;PostalCode;Country
            if value:
                adr_parts = value.split(";")
                while len(adr_parts) < 7:
                    adr_parts.append("")
                # Build a human-readable address string, skipping empty parts
                formatted_parts = [p.strip() for p in adr_parts if p.strip()]
                formatted = ", ".join(formatted_parts)
                if formatted:
                    contact["addresses"].append({"label": label, "value": formatted})

        elif prop_name == "URL":
            if value:
                contact["websites"].append({"label": label, "value": value})

        elif prop_name == "X-SIGNAL":
            contact["has_signal"] = value.lower() in ("true", "1", "yes")

        elif prop_name == "X-PGP-KEY":
            contact["pgp_key"] = value if value else None

        elif prop_name == "X-CALLSIGN":
            if value:
                contact["call_signs"].append({"label": label, "value": value})

        elif prop_name == "X-XHANDLE":
            if value:
                contact["x_handles"].append({"label": label, "value": value})

        elif prop_name == "X-FAVORITE":
            contact["favorite"] = value.lower() in ("true", "1", "yes")

    # If given_name is still empty, try to extract from FN as a fallback
    if not contact["given_name"] and fn_value:
        contact["given_name"] = fn_value

    # Clean up empty multi-value lists → None for consistency
    for mv_field in ("phones", "emails", "addresses", "websites", "call_signs", "x_handles"):
        if not contact[mv_field]:
            contact[mv_field] = None

    return contact


def vcard_print(contact) -> str:
    """Format a Contact (dict or Pydantic model) into a valid vCard 3.0 string.

    Handles all mapped properties including multi-value fields with TYPE
    parameters and custom X-properties.
    """

    def _get(field: str, default=None):
        if isinstance(contact, dict):
            return contact.get(field, default)
        return getattr(contact, field, default)

    lines: List[str] = []
    lines.append("BEGIN:VCARD")
    lines.append("VERSION:3.0")

    # N property
    surname = _get("surname") or ""
    given_name = _get("given_name") or ""
    middle_names = _get("middle_names") or ""
    prefix = _get("prefix") or ""
    suffix = _get("suffix") or ""
    lines.append(f"N:{surname};{given_name};{middle_names};{prefix};{suffix}")

    # FN property — computed display name
    display = _get("display_name")
    if not display:
        display = compute_display_name(contact)
    if display:
        lines.append(f"FN:{display}")

    # Multi-value fields helper
    def _add_multi(prop: str, field: str):
        entries = _get(field)
        if not entries:
            return
        for entry in entries:
            if isinstance(entry, dict):
                lbl = entry.get("label")
                val = entry.get("value") or ""
            else:
                lbl = getattr(entry, "label", None)
                val = getattr(entry, "value", None) or ""
            if not val:
                continue
            if lbl:
                lines.append(f"{prop};TYPE={lbl}:{val}")
            else:
                lines.append(f"{prop}:{val}")

    _add_multi("TEL", "phones")
    _add_multi("EMAIL", "emails")

    # ADR needs special handling — value is a formatted string, we store it
    # back in the street field of the structured ADR format
    addresses = _get("addresses")
    if addresses:
        for entry in addresses:
            if isinstance(entry, dict):
                lbl = entry.get("label")
                val = entry.get("value") or ""
            else:
                lbl = getattr(entry, "label", None)
                val = getattr(entry, "value", None) or ""
            if not val:
                continue
            # Put the full formatted address in the street field
            adr_value = f";;{val};;;;"
            if lbl:
                lines.append(f"ADR;TYPE={lbl}:{adr_value}")
            else:
                lines.append(f"ADR:{adr_value}")

    _add_multi("URL", "websites")

    # X-SIGNAL
    has_signal = _get("has_signal")
    if has_signal:
        lines.append("X-SIGNAL:true")

    # X-PGP-KEY
    pgp_key = _get("pgp_key")
    if pgp_key:
        lines.append(f"X-PGP-KEY:{pgp_key}")

    _add_multi("X-CALLSIGN", "call_signs")
    _add_multi("X-XHANDLE", "x_handles")

    # X-FAVORITE
    favorite = _get("favorite")
    if favorite:
        lines.append("X-FAVORITE:true")

    lines.append("END:VCARD")
    return "\r\n".join(lines)


# Multi-value field names that get flattened into numbered columns (up to 5 each)
_CSV_MULTI_VALUE_FIELDS = ["phones", "emails", "addresses", "call_signs", "x_handles", "websites"]
_CSV_MAX_MULTI = 5


def _csv_header() -> list:
    """Build the canonical CSV header row."""
    cols = ["given_name", "surname", "middle_names", "prefix", "suffix"]
    for field in _CSV_MULTI_VALUE_FIELDS:
        # Strip trailing 's' for column prefix (phones -> phone, addresses -> addresse -> address)
        col_prefix = field.rstrip("es") if field.endswith("sses") else (
            field.rstrip("s") if field.endswith("s") else field
        )
        # Nicer prefixes for known fields
        _prefix_map = {
            "phones": "phone",
            "emails": "email",
            "addresses": "address",
            "call_signs": "call_sign",
            "x_handles": "x_handle",
            "websites": "website",
        }
        col_prefix = _prefix_map.get(field, col_prefix)
        for i in range(1, _CSV_MAX_MULTI + 1):
            cols.append(f"{col_prefix}_{i}_label")
            cols.append(f"{col_prefix}_{i}_value")
    cols.extend(["has_signal", "pgp_key", "favorite"])
    return cols


def csv_export(contacts: list) -> str:
    """Flatten a list of Contact dicts/models into a CSV string with header row.

    Multi-value fields (phones, emails, etc.) are expanded into up to 5
    numbered column pairs: {type}_1_label, {type}_1_value, ...
    """
    header = _csv_header()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(header)

    for contact in contacts:
        def _get(field, default=None):
            if isinstance(contact, dict):
                return contact.get(field, default)
            return getattr(contact, field, default)

        row = [
            _get("given_name") or "",
            _get("surname") or "",
            _get("middle_names") or "",
            _get("prefix") or "",
            _get("suffix") or "",
        ]

        for field in _CSV_MULTI_VALUE_FIELDS:
            entries = _get(field) or []
            for i in range(_CSV_MAX_MULTI):
                if i < len(entries):
                    entry = entries[i]
                    if isinstance(entry, dict):
                        row.append(entry.get("label") or "")
                        row.append(entry.get("value") or "")
                    else:
                        row.append(getattr(entry, "label", None) or "")
                        row.append(getattr(entry, "value", None) or "")
                else:
                    row.append("")
                    row.append("")

        row.append("true" if _get("has_signal") else "false")
        row.append(_get("pgp_key") or "")
        row.append("true" if _get("favorite") else "false")

        writer.writerow(row)

    return output.getvalue()


# Reverse mapping: column prefix -> Contact field name
_CSV_COL_PREFIX_TO_FIELD = {
    "phone": "phones",
    "email": "emails",
    "address": "addresses",
    "call_sign": "call_signs",
    "x_handle": "x_handles",
    "website": "websites",
}


def csv_import(csv_text: str) -> tuple:
    """Parse a CSV string back into a list of Contact dicts.

    Returns (contacts, errors) where errors is a list of
    {"row": <1-based row number>, "reason": "..."} dicts for skipped rows.
    """
    contacts = []
    errors = []

    reader = csv.DictReader(io.StringIO(csv_text))

    for row_idx, row in enumerate(reader, start=2):  # row 1 is header, data starts at 2
        given_name = (row.get("given_name") or "").strip()
        if not given_name:
            errors.append({"row": row_idx, "reason": "Missing given_name"})
            continue

        contact = {
            "given_name": given_name,
            "surname": (row.get("surname") or "").strip() or None,
            "middle_names": (row.get("middle_names") or "").strip() or None,
            "prefix": (row.get("prefix") or "").strip() or None,
            "suffix": (row.get("suffix") or "").strip() or None,
        }

        # Reconstruct multi-value fields from numbered columns
        for col_prefix, field_name in _CSV_COL_PREFIX_TO_FIELD.items():
            entries = []
            for i in range(1, _CSV_MAX_MULTI + 1):
                label_key = f"{col_prefix}_{i}_label"
                value_key = f"{col_prefix}_{i}_value"
                label = (row.get(label_key) or "").strip()
                value = (row.get(value_key) or "").strip()
                if value:
                    entries.append({"label": label or None, "value": value})
            contact[field_name] = entries if entries else None

        # Boolean / text fields
        has_signal_str = (row.get("has_signal") or "").strip().lower()
        contact["has_signal"] = has_signal_str in ("true", "1", "yes")

        contact["pgp_key"] = (row.get("pgp_key") or "").strip() or None

        fav_str = (row.get("favorite") or "").strip().lower()
        contact["favorite"] = fav_str in ("true", "1", "yes")

        contacts.append(contact)

    return (contacts, errors)


# ═══════════════════════════════════════════════════════════════════════════
# Section 6: Database Initialization (runs at import time)
# ═══════════════════════════════════════════════════════════════════════════

# Create contacts directory for .vcf file storage
CONTACTS_DIR = "/app/data/contacts/"
os.makedirs(CONTACTS_DIR, exist_ok=True)

# Initialize database and run all migrations
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

# Create directory for contact images
CONTACT_IMAGES_DIR = "/app/data/contacts/profile_pictures/"
os.makedirs(CONTACT_IMAGES_DIR, exist_ok=True)


# ═══════════════════════════════════════════════════════════════════════════
# Section 7: Static File Serving & Page Routes
# ═══════════════════════════════════════════════════════════════════════════

# ── Geocode Proxy (avoids CORS and rate-limit issues with Nominatim) ──────
_geocode_cache = {}       # key (lowercase query) → {"lat": float, "lon": float, "ts": float}
_geocode_last_req = 0.0   # timestamp of last Nominatim request (rate-limit to 1/sec)
_geocode_lock = asyncio.Lock()

def _sync_geocode_fetch(url):
    """Blocking fetch — runs in thread pool to avoid blocking the event loop."""
    req = urllib.request.Request(url, headers={"User-Agent": "CWOC-Weather/1.0"})
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode())

@app.get("/api/geocode")
async def geocode_proxy(q: str = Query(..., min_length=1)):
    key = q.lower().strip()
    # Return cached result if < 24 hours old
    if key in _geocode_cache and (time.time() - _geocode_cache[key]["ts"]) < 86400:
        return {"results": [{"lat": _geocode_cache[key]["lat"], "lon": _geocode_cache[key]["lon"]}]}

    global _geocode_last_req
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
# Section 6b: Sync Hub (WebSocket + HTTP polling fallback)
# ═══════════════════════════════════════════════════════════════════════════

# ── HTTP polling sync queue ──
# Each message gets a sequential ID. Clients poll with their last-seen ID.
_sync_messages = []  # list of { id: int, data: dict, ts: float }
_sync_next_id = 1
_sync_max_messages = 200  # keep last 200 messages

@app.post("/api/sync/send")
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

@app.get("/api/sync/poll")
def sync_poll(after: int = Query(0)):
    """Get sync messages after the given ID."""
    results = [m["data"] for m in _sync_messages if m["id"] > after]
    last_id = _sync_messages[-1]["id"] if _sync_messages else after
    return {"messages": results, "last_id": last_id}


# ── WebSocket sync (used when proxy supports it) ──

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


@app.websocket("/ws/sync")
async def websocket_sync(ws: WebSocket):
    await _sync_hub.connect(ws)
    try:
        while True:
            data = await ws.receive_json()
            # Also add to polling queue
            global _sync_next_id
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
# Health Data Aggregation API
# ═══════════════════════════════════════════════════════════════════════════

@app.get("/api/health-data")
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


# Serve all files from /frontend/ (e.g., index.html, settings.html, editor.html)
app.mount("/frontend", StaticFiles(directory="/app/frontend"), name="frontend")

# Serve all files from /static/ (e.g., images)
app.mount("/static", StaticFiles(directory="/app/static"), name="static")

# Serve contact profile pictures from data/contacts/
app.mount("/data/contacts", StaticFiles(directory="/app/data/contacts"), name="data_contacts")

# Root route to serve index.html as the main page
@app.get("/")
async def root():
    return FileResponse("/app/frontend/index.html")

# Editor route to serve editor.html and handle chit data
@app.get("/editor")
async def editor(id: str = None):
    if id:
        # Serve editor.html; data will be fetched via /api/chit/{id}
        return FileResponse("/app/frontend/editor.html")
    return FileResponse("/app/frontend/editor.html")


# ═══════════════════════════════════════════════════════════════════════════
# Section 8: Chit API Routes
# ═══════════════════════════════════════════════════════════════════════════

@app.get("/api/instance-id")
def get_instance_id():
    return {"instance_id": get_or_create_instance_id()}

@app.get("/api/version")
def get_version():
    return get_version_info()

@app.get("/api/chits")
def get_all_chits():
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM chits WHERE deleted = 0 OR deleted IS NULL")
        chits = []
        for row in cursor.fetchall():
            chit = dict(zip([col[0] for col in cursor.description], row))
            chit["tags"] = deserialize_json_field(chit["tags"])
            chit["checklist"] = deserialize_json_field(chit["checklist"])
            chit["people"] = deserialize_json_field(chit["people"])
            chit["child_chits"] = deserialize_json_field(chit.get("child_chits"))
            chit["is_project_master"] = bool(chit.get("is_project_master"))
            chit["all_day"] = bool(chit.get("all_day"))
            chit["alerts"] = deserialize_json_field(chit.get("alerts"))
            chit["recurrence_rule"] = deserialize_json_field(chit.get("recurrence_rule"))
            chit["recurrence_exceptions"] = deserialize_json_field(chit.get("recurrence_exceptions"))
            chit["weather_data"] = deserialize_json_field(chit.get("weather_data"))
            chit["health_data"] = deserialize_json_field(chit.get("health_data"))
            chits.append(chit)
        return chits
    except Exception as e:
        logger.error(f"Error fetching chits: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch chits: {str(e)}")
    finally:
        if conn:
            conn.close()


@app.get("/api/chits/search")
def search_chits(q: Optional[str] = Query(None)):
    """Global search across all chit fields. Returns matching chits with matched field names."""
    if not q or not q.strip():
        return []

    query_lower = q.strip().lower()
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM chits WHERE deleted = 0 OR deleted IS NULL")
        results = []

        for row in cursor.fetchall():
            chit = dict(zip([col[0] for col in cursor.description], row))
            # Deserialize JSON fields
            chit["tags"] = deserialize_json_field(chit["tags"])
            chit["checklist"] = deserialize_json_field(chit["checklist"])
            chit["people"] = deserialize_json_field(chit["people"])
            chit["child_chits"] = deserialize_json_field(chit.get("child_chits"))
            chit["is_project_master"] = bool(chit.get("is_project_master"))
            chit["all_day"] = bool(chit.get("all_day"))
            chit["alerts"] = deserialize_json_field(chit.get("alerts"))
            chit["recurrence_rule"] = deserialize_json_field(chit.get("recurrence_rule"))
            chit["recurrence_exceptions"] = deserialize_json_field(chit.get("recurrence_exceptions"))
            chit["weather_data"] = deserialize_json_field(chit.get("weather_data"))
            chit["health_data"] = deserialize_json_field(chit.get("health_data"))

            matched_fields = []

            # Simple string fields
            for field_name in [
                "title", "note", "status", "priority", "severity",
                "location", "color",
                "start_datetime", "end_datetime", "due_datetime",
                "created_datetime", "modified_datetime",
            ]:
                value = chit.get(field_name)
                if value and query_lower in str(value).lower():
                    matched_fields.append(field_name)

            # Tags — check each tag name individually
            tags = chit.get("tags")
            if tags and isinstance(tags, list):
                for tag in tags:
                    if isinstance(tag, str) and query_lower in tag.lower():
                        matched_fields.append("tags")
                        break

            # People — check each person individually
            people = chit.get("people")
            if people and isinstance(people, list):
                for person in people:
                    if isinstance(person, str) and query_lower in person.lower():
                        matched_fields.append("people")
                        break

            # Checklist — check each item's text field
            checklist = chit.get("checklist")
            if checklist and isinstance(checklist, list):
                for item in checklist:
                    if isinstance(item, dict):
                        item_text = item.get("text", "")
                        if item_text and query_lower in str(item_text).lower():
                            matched_fields.append("checklist")
                            break

            # Alerts — check each alert's description/label fields
            alerts = chit.get("alerts")
            if alerts and isinstance(alerts, list):
                for alert in alerts:
                    if isinstance(alert, dict):
                        for alert_key in ["description", "label", "name", "type"]:
                            alert_val = alert.get(alert_key, "")
                            if alert_val and query_lower in str(alert_val).lower():
                                matched_fields.append("alerts")
                                break
                        if "alerts" in matched_fields:
                            break

            if matched_fields:
                results.append({"chit": chit, "matched_fields": matched_fields})

        return results
    except Exception as e:
        logger.error(f"Error searching chits: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to search chits: {str(e)}")
    finally:
        if conn:
            conn.close()


@app.post("/api/chits")
def create_chit(chit: Chit):
    conn = None
    try:
        chit_id = str(uuid4())
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        current_time = datetime.utcnow().isoformat()
        chit_tags = compute_system_tags(chit)
        cursor.execute(
            """
            INSERT INTO chits (
                id, title, note, tags, start_datetime, end_datetime, due_datetime,
                completed_datetime, status, priority, severity, checklist, alarm, notification,
                recurrence, recurrence_id, location, color, people, pinned, archived,
                deleted, created_datetime, modified_datetime, is_project_master, child_chits, all_day, alerts,
                recurrence_rule, recurrence_exceptions, weather_data, health_data
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                chit_id,
                chit.title,
                chit.note,
                serialize_json_field(chit_tags),
                chit.start_datetime,
                chit.end_datetime,
                chit.due_datetime,
                chit.completed_datetime,
                chit.status,
                chit.priority,
                chit.severity,
                serialize_json_field(chit.checklist),
                chit.alarm,
                chit.notification,
                chit.recurrence,
                chit.recurrence_id,
                chit.location,
                chit.color,
                serialize_json_field(chit.people),
                chit.pinned,
                chit.archived,
                chit.deleted if chit.deleted is not None else False,
                current_time,
                current_time,
                chit.is_project_master,
                serialize_json_field(chit.child_chits),
                chit.all_day if chit.all_day is not None else False,
                serialize_json_field(chit.alerts),
                serialize_json_field(chit.recurrence_rule),
                serialize_json_field(chit.recurrence_exceptions),
                serialize_json_field(chit.weather_data),
                serialize_json_field(chit.health_data),
            )
        )
        conn.commit()
        return {**chit.dict(), "id": chit_id, "tags": chit_tags, "created_datetime": current_time, "modified_datetime": current_time}
    except Exception as e:
        logger.error(f"Error creating chit: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create chit: {str(e)}")
    finally:
        if conn:
            conn.close()

# API endpoint to get chit data
@app.get("/api/chit/{chit_id}")
def get_chit(chit_id: str):
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM chits WHERE id = ?", (chit_id,))
        row = cursor.fetchone()
        if not row:
            logger.info(f"Chit not found for ID: {chit_id}")
            raise HTTPException(status_code=404, detail="Chit not found")
        chit = dict(zip([col[0] for col in cursor.description], row))
        chit["tags"] = deserialize_json_field(chit["tags"])
        chit["checklist"] = deserialize_json_field(chit["checklist"])
        chit["people"] = deserialize_json_field(chit["people"])
        chit["child_chits"] = deserialize_json_field(chit.get("child_chits"))
        chit["is_project_master"] = bool(chit.get("is_project_master"))
        chit["all_day"] = bool(chit.get("all_day"))
        chit["alerts"] = deserialize_json_field(chit.get("alerts"))
        chit["recurrence_rule"] = deserialize_json_field(chit.get("recurrence_rule"))
        chit["recurrence_exceptions"] = deserialize_json_field(chit.get("recurrence_exceptions"))
        chit["weather_data"] = deserialize_json_field(chit.get("weather_data"))
        chit["health_data"] = deserialize_json_field(chit.get("health_data"))
        return chit
    except sqlite3.Error as e:
        logger.error(f"Database error fetching chit {chit_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error fetching chit {chit_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")
    finally:
        if conn:
            conn.close()

@app.put("/api/chits/{chit_id}")
def update_chit(chit_id: str, chit: Chit):
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM chits WHERE id = ?", (chit_id,))
        existing = cursor.fetchone()
        current_time = datetime.utcnow().isoformat()
        chit_tags = compute_system_tags(chit)
        if existing:
            # Capture old state for audit diff
            old_chit_dict = dict(zip([col[0] for col in cursor.description], existing))

            # Update existing chit
            cursor.execute(
                """
                UPDATE chits SET
                    title = ?, note = ?, tags = ?, start_datetime = ?, end_datetime = ?, due_datetime = ?,
                    completed_datetime = ?, status = ?, priority = ?, severity = ?, checklist = ?, alarm = ?, notification = ?,
                    recurrence = ?, recurrence_id = ?, location = ?, color = ?, people = ?, pinned = ?,
                    archived = ?, deleted = ?, modified_datetime = ?, is_project_master = ?, child_chits = ?, all_day = ?, alerts = ?,
                    recurrence_rule = ?, recurrence_exceptions = ?, weather_data = ?, health_data = ?
                WHERE id = ?
                """,
                (
                    chit.title,
                    chit.note,
                    serialize_json_field(chit_tags),
                    chit.start_datetime,
                    chit.end_datetime,
                    chit.due_datetime,
                    chit.completed_datetime,
                    chit.status,
                    chit.priority,
                    chit.severity,
                    serialize_json_field(chit.checklist),
                    chit.alarm,
                    chit.notification,
                    chit.recurrence,
                    chit.recurrence_id,
                    chit.location,
                    chit.color,
                    serialize_json_field(chit.people),
                    chit.pinned,
                    chit.archived,
                    chit.deleted if chit.deleted is not None else False,
                    current_time,
                    chit.is_project_master,
                    serialize_json_field(chit.child_chits),
                    chit.all_day if chit.all_day is not None else False,
                    serialize_json_field(chit.alerts),
                    serialize_json_field(chit.recurrence_rule),
                    serialize_json_field(chit.recurrence_exceptions),
                    serialize_json_field(chit.weather_data),
                    serialize_json_field(chit.health_data),
                    chit_id,
                )
            )
            # Audit logging for chit update (Task 2.2)
            try:
                new_chit_dict = {
                    "title": chit.title, "note": chit.note, "tags": serialize_json_field(chit_tags),
                    "start_datetime": chit.start_datetime, "end_datetime": chit.end_datetime,
                    "due_datetime": chit.due_datetime, "completed_datetime": chit.completed_datetime,
                    "status": chit.status, "priority": chit.priority, "severity": chit.severity,
                    "checklist": serialize_json_field(chit.checklist), "alarm": chit.alarm,
                    "notification": chit.notification, "recurrence": chit.recurrence,
                    "recurrence_id": chit.recurrence_id, "location": chit.location, "color": chit.color,
                    "people": serialize_json_field(chit.people), "pinned": chit.pinned,
                    "archived": chit.archived, "deleted": chit.deleted if chit.deleted is not None else False,
                    "is_project_master": chit.is_project_master,
                    "child_chits": serialize_json_field(chit.child_chits),
                    "all_day": chit.all_day if chit.all_day is not None else False,
                    "alerts": serialize_json_field(chit.alerts),
                    "recurrence_rule": serialize_json_field(chit.recurrence_rule),
                    "recurrence_exceptions": serialize_json_field(chit.recurrence_exceptions),
                    "weather_data": serialize_json_field(chit.weather_data),
                    "health_data": serialize_json_field(chit.health_data),
                }
                diff = compute_audit_diff(old_chit_dict, new_chit_dict, exclude_fields={"modified_datetime", "created_datetime"})
                if diff:
                    actor = get_current_actor()
                    insert_audit_entry(conn, "chit", chit_id, "updated", actor, changes=diff, entity_summary=chit.title)
            except Exception as e:
                logger.error(f"Audit logging failed for chit update (best-effort): {str(e)}")
        else:
            # Create new chit
            cursor.execute(
                """
                INSERT INTO chits (
                    id, title, note, tags, start_datetime, end_datetime, due_datetime,
                    completed_datetime, status, priority, severity, checklist, alarm, notification,
                    recurrence, recurrence_id, location, color, people, pinned, archived,
                    deleted, created_datetime, modified_datetime, is_project_master, child_chits, all_day, alerts,
                    recurrence_rule, recurrence_exceptions, weather_data, health_data
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    chit_id,
                    chit.title,
                    chit.note,
                    serialize_json_field(chit_tags),
                    chit.start_datetime,
                    chit.end_datetime,
                    chit.due_datetime,
                    chit.completed_datetime,
                    chit.status,
                    chit.priority,
                    chit.severity,
                    serialize_json_field(chit.checklist),
                    chit.alarm,
                    chit.notification,
                    chit.recurrence,
                    chit.recurrence_id,
                    chit.location,
                    chit.color,
                    serialize_json_field(chit.people),
                    chit.pinned,
                    chit.archived,
                    chit.deleted if chit.deleted is not None else False,
                    current_time,
                    current_time,
                    chit.is_project_master,
                    serialize_json_field(chit.child_chits),
                    chit.all_day if chit.all_day is not None else False,
                    serialize_json_field(chit.alerts),
                    serialize_json_field(chit.recurrence_rule),
                    serialize_json_field(chit.recurrence_exceptions),
                    serialize_json_field(chit.weather_data),
                    serialize_json_field(chit.health_data),
                )
            )
            # Audit logging for chit creation (Task 2.1)
            try:
                actor = get_current_actor()
                insert_audit_entry(conn, "chit", chit_id, "created", actor, entity_summary=chit.title)
            except Exception as e:
                logger.error(f"Audit logging failed for chit creation (best-effort): {str(e)}")
        conn.commit()
        return {**chit.dict(), "id": chit_id, "tags": chit_tags, "modified_datetime": current_time}
    except Exception as e:
        logger.error(f"Error updating/creating chit: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update/create chit: {str(e)}")
    finally:
        if conn:
            conn.close()

@app.delete("/api/chits/{chit_id}")
def delete_chit(chit_id: str):
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM chits WHERE id = ?", (chit_id,))
        existing_chit = cursor.fetchone()
        if not existing_chit:
            raise HTTPException(status_code=404, detail="Chit not found")
        # Capture chit title for audit logging before soft-delete
        chit_columns = [col[0] for col in cursor.description]
        chit_dict = dict(zip(chit_columns, existing_chit))
        chit_title = chit_dict.get("title")

        cursor.execute("UPDATE chits SET deleted = 1, modified_datetime = ? WHERE id = ?",
                       (datetime.utcnow().isoformat(), chit_id))
        # Audit logging for chit deletion (Task 2.3)
        try:
            actor = get_current_actor()
            insert_audit_entry(conn, "chit", chit_id, "deleted", actor, entity_summary=chit_title)
        except Exception as e:
            logger.error(f"Audit logging failed for chit deletion (best-effort): {str(e)}")
        conn.commit()
        return {"message": "Chit deleted successfully"}
    except Exception as e:
        logger.error(f"Error deleting chit: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete chit: {str(e)}")
    finally:
        if conn:
            conn.close()

@app.patch("/api/chits/{chit_id}/recurrence-exceptions")
def patch_recurrence_exceptions(chit_id: str, body: dict):
    """Add or update a recurrence exception on a parent chit.
    Body: { "exception": { "date": "YYYY-MM-DD", "completed": bool, "broken_off": bool, "title": str, ... } }
    """
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT recurrence_exceptions FROM chits WHERE id = ?", (chit_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Chit not found")
        exceptions = deserialize_json_field(row["recurrence_exceptions"]) or []
        new_exc = body.get("exception", {})
        exc_date = new_exc.get("date")
        if not exc_date:
            raise HTTPException(status_code=400, detail="Exception must have a date")
        # Replace existing exception for this date, or append
        exceptions = [e for e in exceptions if e.get("date") != exc_date]
        exceptions.append(new_exc)
        cursor.execute(
            "UPDATE chits SET recurrence_exceptions = ?, modified_datetime = ? WHERE id = ?",
            (serialize_json_field(exceptions), datetime.utcnow().isoformat(), chit_id)
        )
        conn.commit()
        return {"message": "Exception updated", "exceptions": exceptions}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error patching recurrence exceptions: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.close()


# ═══════════════════════════════════════════════════════════════════════════
# Section 9: Trash API Routes
# ═══════════════════════════════════════════════════════════════════════════

@app.get("/api/trash")
def get_trash():
    """Get all soft-deleted chits, sorted by most recently deleted."""
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM chits WHERE deleted = 1 ORDER BY modified_datetime DESC")
        trash = []
        for row in cursor.fetchall():
            chit = dict(zip([col[0] for col in cursor.description], row))
            chit["tags"] = deserialize_json_field(chit["tags"])
            chit["checklist"] = deserialize_json_field(chit["checklist"])
            chit["people"] = deserialize_json_field(chit["people"])
            chit["child_chits"] = deserialize_json_field(chit.get("child_chits"))
            chit["is_project_master"] = bool(chit.get("is_project_master"))
            chit["all_day"] = bool(chit.get("all_day"))
            chit["alerts"] = deserialize_json_field(chit.get("alerts"))
            chit["recurrence_rule"] = deserialize_json_field(chit.get("recurrence_rule"))
            chit["recurrence_exceptions"] = deserialize_json_field(chit.get("recurrence_exceptions"))
            trash.append(chit)
        return trash
    except Exception as e:
        logger.error(f"Error fetching trash: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.close()


@app.post("/api/trash/{chit_id}/restore")
def restore_chit(chit_id: str):
    """Restore a soft-deleted chit."""
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("UPDATE chits SET deleted = 0, modified_datetime = ? WHERE id = ?",
                       (datetime.utcnow().isoformat(), chit_id))
        conn.commit()
        return {"message": "Chit restored"}
    except Exception as e:
        logger.error(f"Error restoring chit: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.close()


@app.delete("/api/trash/{chit_id}/purge")
def purge_chit(chit_id: str):
    """Permanently delete a chit from the database."""
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("DELETE FROM chits WHERE id = ? AND deleted = 1", (chit_id,))
        conn.commit()
        return {"message": "Chit permanently deleted"}
    except Exception as e:
        logger.error(f"Error purging chit: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.close()


# ═══════════════════════════════════════════════════════════════════════════
# Section 9b: Data Management Export/Import API Routes
# ═══════════════════════════════════════════════════════════════════════════

@app.get("/api/export/chits")
def export_chits():
    """Export ALL chit records (including soft-deleted) as a JSON export envelope."""
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM chits")
        rows = cursor.fetchall()

        chits = []
        for row in rows:
            chit = dict(row)
            # Deserialize JSON-serialized fields
            chit["tags"] = deserialize_json_field(chit.get("tags"))
            chit["checklist"] = deserialize_json_field(chit.get("checklist"))
            chit["people"] = deserialize_json_field(chit.get("people"))
            chit["child_chits"] = deserialize_json_field(chit.get("child_chits"))
            chit["alerts"] = deserialize_json_field(chit.get("alerts"))
            chit["recurrence_rule"] = deserialize_json_field(chit.get("recurrence_rule"))
            chit["recurrence_exceptions"] = deserialize_json_field(chit.get("recurrence_exceptions"))
            chit["weather_data"] = deserialize_json_field(chit.get("weather_data"))
            chit["health_data"] = deserialize_json_field(chit.get("health_data"))
            # Convert boolean fields to native booleans
            chit["alarm"] = bool(chit.get("alarm"))
            chit["notification"] = bool(chit.get("notification"))
            chit["pinned"] = bool(chit.get("pinned"))
            chit["archived"] = bool(chit.get("archived"))
            chit["deleted"] = bool(chit.get("deleted"))
            chit["is_project_master"] = bool(chit.get("is_project_master"))
            chit["all_day"] = bool(chit.get("all_day"))
            chits.append(chit)

        envelope = _build_export_envelope("chits", chits)
        return Response(content=json.dumps(envelope, indent=2), media_type="application/json")
    except Exception as e:
        logger.error(f"Export chits failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")
    finally:
        if conn:
            conn.close()


@app.get("/api/export/userdata")
def export_userdata():
    """Export ALL settings and contacts records as a JSON export envelope."""
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # --- Settings ---
        cursor.execute("SELECT * FROM settings")
        settings_rows = cursor.fetchall()
        settings = []
        for row in settings_rows:
            s = dict(row)
            s["tags"] = deserialize_json_field(s.get("tags"))
            s["default_filters"] = deserialize_json_field(s.get("default_filters"))
            s["custom_colors"] = deserialize_json_field(s.get("custom_colors"))
            s["visual_indicators"] = deserialize_json_field(s.get("visual_indicators"))
            s["chit_options"] = deserialize_json_field(s.get("chit_options"))
            # active_clocks is a comma-separated string, not JSON — keep as-is
            s["saved_locations"] = deserialize_json_field(s.get("saved_locations"))
            s["default_notifications"] = deserialize_json_field(s.get("default_notifications"))
            settings.append(s)

        # --- Contacts ---
        cursor.execute("SELECT * FROM contacts")
        contact_rows = cursor.fetchall()
        contacts = []
        for row in contact_rows:
            c = dict(row)
            c["phones"] = deserialize_json_field(c.get("phones"))
            c["emails"] = deserialize_json_field(c.get("emails"))
            c["addresses"] = deserialize_json_field(c.get("addresses"))
            c["call_signs"] = deserialize_json_field(c.get("call_signs"))
            c["x_handles"] = deserialize_json_field(c.get("x_handles"))
            c["websites"] = deserialize_json_field(c.get("websites"))
            c["tags"] = deserialize_json_field(c.get("tags"))
            c["has_signal"] = bool(c.get("has_signal"))
            c["favorite"] = bool(c.get("favorite"))
            contacts.append(c)

        envelope = _build_export_envelope("userdata", {"settings": settings, "contacts": contacts})
        return Response(content=json.dumps(envelope, indent=2), media_type="application/json")
    except Exception as e:
        logger.error(f"Export userdata failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")
    finally:
        if conn:
            conn.close()


@app.post("/api/import/chits")
def import_chits(req: ImportRequest):
    """Import chit records from a JSON export envelope."""
    # Validate mode
    if req.mode not in ("add", "replace"):
        raise HTTPException(status_code=400, detail="Invalid mode: must be 'add' or 'replace'")

    envelope = req.data

    # Validate envelope required fields
    for field in ("type", "version", "exported_at", "data"):
        if field not in envelope:
            raise HTTPException(status_code=400, detail="Invalid export envelope: missing required fields")

    # Validate envelope type
    if envelope.get("type") != "chits":
        raise HTTPException(status_code=400, detail="Invalid data: expected type 'chits'")

    records = envelope.get("data", [])
    if not isinstance(records, list):
        raise HTTPException(status_code=400, detail="Invalid data: expected 'data' to be a list")

    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.execute("BEGIN")

        if req.mode == "replace":
            conn.execute("DELETE FROM chits")

        imported = 0
        for chit in records:
            new_id = str(uuid4())
            conn.execute(
                """INSERT INTO chits (
                    id, title, note, tags, start_datetime, end_datetime,
                    due_datetime, completed_datetime, status, priority, severity,
                    checklist, alarm, notification, recurrence, recurrence_id,
                    location, color, people, pinned, archived, deleted,
                    created_datetime, modified_datetime, is_project_master,
                    child_chits, all_day, alerts, recurrence_rule,
                    recurrence_exceptions, progress_percent, time_estimate,
                    weather_data, health_data
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (
                    new_id,
                    chit.get("title"),
                    chit.get("note"),
                    serialize_json_field(chit.get("tags")),
                    chit.get("start_datetime"),
                    chit.get("end_datetime"),
                    chit.get("due_datetime"),
                    chit.get("completed_datetime"),
                    chit.get("status"),
                    chit.get("priority"),
                    chit.get("severity"),
                    serialize_json_field(chit.get("checklist")),
                    1 if chit.get("alarm") else 0,
                    1 if chit.get("notification") else 0,
                    chit.get("recurrence"),
                    chit.get("recurrence_id"),
                    chit.get("location"),
                    chit.get("color"),
                    serialize_json_field(chit.get("people")),
                    1 if chit.get("pinned") else 0,
                    1 if chit.get("archived") else 0,
                    1 if chit.get("deleted") else 0,
                    chit.get("created_datetime"),
                    chit.get("modified_datetime"),
                    1 if chit.get("is_project_master") else 0,
                    serialize_json_field(chit.get("child_chits")),
                    1 if chit.get("all_day") else 0,
                    serialize_json_field(chit.get("alerts")),
                    serialize_json_field(chit.get("recurrence_rule")),
                    serialize_json_field(chit.get("recurrence_exceptions")),
                    chit.get("progress_percent"),
                    chit.get("time_estimate"),
                    serialize_json_field(chit.get("weather_data")),
                    serialize_json_field(chit.get("health_data")),
                ),
            )
            imported += 1

        conn.commit()
        return {"summary": {"imported": imported}}
    except HTTPException:
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Import chits failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")
    finally:
        if conn:
            conn.close()


@app.post("/api/import/userdata")
def import_userdata(req: ImportRequest):
    """Import user data (settings + contacts) from a JSON export envelope."""
    # Validate mode
    if req.mode not in ("add", "replace"):
        raise HTTPException(status_code=400, detail="Invalid mode: must be 'add' or 'replace'")

    envelope = req.data

    # Validate envelope required fields
    for field in ("type", "version", "exported_at", "data"):
        if field not in envelope:
            raise HTTPException(status_code=400, detail="Invalid export envelope: missing required fields")

    # Validate envelope type
    if envelope.get("type") != "userdata":
        raise HTTPException(status_code=400, detail="Invalid data: expected type 'userdata'")

    payload = envelope.get("data", {})
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Invalid data: expected 'data' to be an object")

    settings_records = payload.get("settings", [])
    contact_records = payload.get("contacts", [])

    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.execute("BEGIN")

        if req.mode == "replace":
            # ── Replace mode: delete everything, then insert all ──
            conn.execute("DELETE FROM settings")
            conn.execute("DELETE FROM contacts")

            settings_replaced = 0
            for s in settings_records:
                conn.execute(
                    """INSERT OR REPLACE INTO settings (
                        user_id, time_format, sex, snooze_length, default_filters,
                        alarm_orientation, active_clocks, saved_locations, tags, custom_colors,
                        visual_indicators, chit_options, calendar_snap, week_start_day,
                        work_start_hour, work_end_hour, work_days, enabled_periods,
                        custom_days_count, all_view_start_hour, all_view_end_hour,
                        day_scroll_to_hour, username, audit_log_max_days, audit_log_max_mb
                    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                    (
                        s.get("user_id"),
                        s.get("time_format"),
                        s.get("sex"),
                        s.get("snooze_length"),
                        serialize_json_field(s.get("default_filters")),
                        s.get("alarm_orientation"),
                        s.get("active_clocks"),
                        serialize_json_field(s.get("saved_locations")),
                        serialize_json_field(s.get("tags")),
                        serialize_json_field(s.get("custom_colors")),
                        serialize_json_field(s.get("visual_indicators")),
                        serialize_json_field(s.get("chit_options")),
                        s.get("calendar_snap"),
                        s.get("week_start_day"),
                        s.get("work_start_hour"),
                        s.get("work_end_hour"),
                        s.get("work_days"),
                        s.get("enabled_periods"),
                        s.get("custom_days_count"),
                        s.get("all_view_start_hour"),
                        s.get("all_view_end_hour"),
                        s.get("day_scroll_to_hour"),
                        s.get("username"),
                        s.get("audit_log_max_days"),
                        s.get("audit_log_max_mb"),
                    ),
                )
                settings_replaced += 1

            contacts_replaced = 0
            for c in contact_records:
                new_id = str(uuid4())
                conn.execute(
                    """INSERT INTO contacts (
                        id, given_name, surname, middle_names, prefix, suffix,
                        nickname, display_name, phones, emails, addresses, call_signs,
                        x_handles, websites, has_signal, signal_username, pgp_key, favorite,
                        color, organization, social_context, image_url, notes, tags,
                        created_datetime, modified_datetime
                    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                    (
                        new_id,
                        c.get("given_name"),
                        c.get("surname"),
                        c.get("middle_names"),
                        c.get("prefix"),
                        c.get("suffix"),
                        c.get("nickname"),
                        c.get("display_name"),
                        serialize_json_field(c.get("phones")),
                        serialize_json_field(c.get("emails")),
                        serialize_json_field(c.get("addresses")),
                        serialize_json_field(c.get("call_signs")),
                        serialize_json_field(c.get("x_handles")),
                        serialize_json_field(c.get("websites")),
                        1 if c.get("has_signal") else 0,
                        c.get("signal_username"),
                        c.get("pgp_key"),
                        1 if c.get("favorite") else 0,
                        c.get("color"),
                        c.get("organization"),
                        c.get("social_context"),
                        c.get("image_url"),
                        c.get("notes"),
                        serialize_json_field(c.get("tags")),
                        c.get("created_datetime"),
                        c.get("modified_datetime"),
                    ),
                )
                contacts_replaced += 1

            conn.commit()
            return {"summary": {"settings_replaced": settings_replaced, "contacts_replaced": contacts_replaced}}

        else:
            # ── Add mode: merge settings arrays, insert non-duplicate contacts ──
            settings_merged = 0
            for s in settings_records:
                user_id = s.get("user_id", "default_user")
                cursor = conn.cursor()
                cursor.execute("SELECT * FROM settings WHERE user_id = ?", (user_id,))
                existing_row = cursor.fetchone()

                if existing_row:
                    col_names = [desc[0] for desc in cursor.description]
                    existing = dict(zip(col_names, existing_row))

                    # Deserialize existing array fields
                    existing_tags = deserialize_json_field(existing.get("tags")) or []
                    existing_custom_colors = deserialize_json_field(existing.get("custom_colors")) or []
                    existing_saved_locations = deserialize_json_field(existing.get("saved_locations")) or []

                    # Imported array fields (already deserialized in envelope)
                    imported_tags = s.get("tags") or []
                    imported_custom_colors = s.get("custom_colors") or []
                    imported_saved_locations = s.get("saved_locations") or []

                    # Merge tags: deduplicate by tag name
                    existing_tag_names = {t.get("name") for t in existing_tags if isinstance(t, dict)}
                    for tag in imported_tags:
                        if isinstance(tag, dict) and tag.get("name") not in existing_tag_names:
                            existing_tags.append(tag)
                            existing_tag_names.add(tag.get("name"))

                    # Merge custom_colors: deduplicate by string value
                    existing_color_set = set(existing_custom_colors)
                    for color in imported_custom_colors:
                        if color not in existing_color_set:
                            existing_custom_colors.append(color)
                            existing_color_set.add(color)

                    # Merge saved_locations: deduplicate by label
                    existing_loc_labels = {loc.get("label") for loc in existing_saved_locations if isinstance(loc, dict)}
                    for loc in imported_saved_locations:
                        if isinstance(loc, dict) and loc.get("label") not in existing_loc_labels:
                            existing_saved_locations.append(loc)
                            existing_loc_labels.add(loc.get("label"))

                    # UPDATE existing row with merged arrays only
                    conn.execute(
                        """UPDATE settings SET tags = ?, custom_colors = ?, saved_locations = ?
                           WHERE user_id = ?""",
                        (
                            serialize_json_field(existing_tags),
                            serialize_json_field(existing_custom_colors),
                            serialize_json_field(existing_saved_locations),
                            user_id,
                        ),
                    )
                    settings_merged += 1
                else:
                    # No existing settings row — insert the imported one
                    conn.execute(
                        """INSERT OR REPLACE INTO settings (
                            user_id, time_format, sex, snooze_length, default_filters,
                            alarm_orientation, active_clocks, saved_locations, tags, custom_colors,
                            visual_indicators, chit_options, calendar_snap, week_start_day,
                            work_start_hour, work_end_hour, work_days, enabled_periods,
                            custom_days_count, all_view_start_hour, all_view_end_hour,
                            day_scroll_to_hour, username, audit_log_max_days, audit_log_max_mb
                        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                        (
                            user_id,
                            s.get("time_format"),
                            s.get("sex"),
                            s.get("snooze_length"),
                            serialize_json_field(s.get("default_filters")),
                            s.get("alarm_orientation"),
                            s.get("active_clocks"),
                            serialize_json_field(s.get("saved_locations")),
                            serialize_json_field(s.get("tags")),
                            serialize_json_field(s.get("custom_colors")),
                            serialize_json_field(s.get("visual_indicators")),
                            serialize_json_field(s.get("chit_options")),
                            s.get("calendar_snap"),
                            s.get("week_start_day"),
                            s.get("work_start_hour"),
                            s.get("work_end_hour"),
                            s.get("work_days"),
                            s.get("enabled_periods"),
                            s.get("custom_days_count"),
                            s.get("all_view_start_hour"),
                            s.get("all_view_end_hour"),
                            s.get("day_scroll_to_hour"),
                            s.get("username"),
                            s.get("audit_log_max_days"),
                            s.get("audit_log_max_mb"),
                        ),
                    )
                    settings_merged += 1

            # ── Add mode contacts: skip duplicates by display_name + given_name ──
            cursor = conn.cursor()
            cursor.execute("SELECT display_name, given_name FROM contacts")
            existing_contacts = {(row[0], row[1]) for row in cursor.fetchall()}

            contacts_added = 0
            contacts_skipped = 0
            for c in contact_records:
                dn = c.get("display_name")
                gn = c.get("given_name")
                if (dn, gn) in existing_contacts:
                    contacts_skipped += 1
                    continue

                new_id = str(uuid4())
                conn.execute(
                    """INSERT INTO contacts (
                        id, given_name, surname, middle_names, prefix, suffix,
                        nickname, display_name, phones, emails, addresses, call_signs,
                        x_handles, websites, has_signal, signal_username, pgp_key, favorite,
                        color, organization, social_context, image_url, notes, tags,
                        created_datetime, modified_datetime
                    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                    (
                        new_id,
                        c.get("given_name"),
                        c.get("surname"),
                        c.get("middle_names"),
                        c.get("prefix"),
                        c.get("suffix"),
                        c.get("nickname"),
                        c.get("display_name"),
                        serialize_json_field(c.get("phones")),
                        serialize_json_field(c.get("emails")),
                        serialize_json_field(c.get("addresses")),
                        serialize_json_field(c.get("call_signs")),
                        serialize_json_field(c.get("x_handles")),
                        serialize_json_field(c.get("websites")),
                        1 if c.get("has_signal") else 0,
                        c.get("signal_username"),
                        c.get("pgp_key"),
                        1 if c.get("favorite") else 0,
                        c.get("color"),
                        c.get("organization"),
                        c.get("social_context"),
                        c.get("image_url"),
                        c.get("notes"),
                        serialize_json_field(c.get("tags")),
                        c.get("created_datetime"),
                        c.get("modified_datetime"),
                    ),
                )
                contacts_added += 1

            conn.commit()
            return {"summary": {"contacts_added": contacts_added, "contacts_skipped": contacts_skipped, "settings_merged": settings_merged}}

    except HTTPException:
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Import userdata failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")
    finally:
        if conn:
            conn.close()


# ═══════════════════════════════════════════════════════════════════════════
# Section 10: Settings API Routes
# ═══════════════════════════════════════════════════════════════════════════

@app.get("/api/settings/{user_id}")
def get_settings(user_id: str):
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM settings WHERE user_id = ?", (user_id,))
        row = cursor.fetchone()
        if not row:
            return {"user_id": user_id}  # Return empty settings
        settings = dict(zip([col[0] for col in cursor.description], row))
        settings["tags"] = deserialize_json_field(settings["tags"])
        settings["default_filters"] = deserialize_json_field(settings["default_filters"])
        settings["custom_colors"] = deserialize_json_field(settings["custom_colors"])
        settings["visual_indicators"] = deserialize_json_field(settings["visual_indicators"])
        settings["chit_options"] = deserialize_json_field(settings["chit_options"])
        settings["active_clocks"] = deserialize_json_field(settings.get("active_clocks"))
        settings["saved_locations"] = deserialize_json_field(settings.get("saved_locations"))
        settings["default_notifications"] = deserialize_json_field(settings.get("default_notifications"))
        return settings
    except Exception as e:
        logger.error(f"Error fetching settings: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch settings: {str(e)}")
    finally:
        if conn:
            conn.close()

@app.post("/api/settings")
def save_settings(settings: Settings):
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # --- Audit: fetch old settings before overwrite ---
        old_settings_dict = None
        try:
            cursor.execute("SELECT * FROM settings WHERE user_id = ?", (settings.user_id,))
            old_row = cursor.fetchone()
            if old_row:
                old_settings_dict = dict(zip([col[0] for col in cursor.description], old_row))
        except Exception as e:
            logger.error(f"Audit: failed to fetch old settings: {str(e)}")

        # Build the new settings dict using the same serialization as the INSERT
        new_settings_dict = {
            "user_id": settings.user_id,
            "time_format": settings.time_format,
            "sex": settings.sex,
            "snooze_length": settings.snooze_length,
            "default_filters": serialize_json_field(settings.default_filters),
            "alarm_orientation": settings.alarm_orientation,
            "active_clocks": settings.active_clocks,
            "saved_locations": settings.saved_locations,
            "tags": serialize_json_field([t.dict() for t in settings.tags]) if settings.tags else None,
            "custom_colors": serialize_json_field(settings.custom_colors),
            "visual_indicators": serialize_json_field(settings.visual_indicators),
            "chit_options": serialize_json_field(settings.chit_options),
            "calendar_snap": settings.calendar_snap or "15",
            "week_start_day": settings.week_start_day or "0",
            "work_start_hour": settings.work_start_hour or "8",
            "work_end_hour": settings.work_end_hour or "17",
            "work_days": settings.work_days or "1,2,3,4,5",
            "enabled_periods": settings.enabled_periods or "Itinerary,Day,Week,Work,SevenDay,Month,Year",
            "custom_days_count": settings.custom_days_count or "7",
            "all_view_start_hour": settings.all_view_start_hour or "0",
            "all_view_end_hour": settings.all_view_end_hour or "24",
            "day_scroll_to_hour": settings.day_scroll_to_hour or "5",
            "username": settings.username,
            "audit_log_max_days": settings.audit_log_max_days,
            "audit_log_max_mb": settings.audit_log_max_mb,
            "default_notifications": serialize_json_field(settings.default_notifications),
            "unit_system": settings.unit_system or "imperial",
        }

        cursor.execute(
            """
            INSERT OR REPLACE INTO settings (
                user_id, time_format, sex, snooze_length, default_filters,
                alarm_orientation, active_clocks, saved_locations, tags, custom_colors, visual_indicators, chit_options,
                calendar_snap, week_start_day, work_start_hour, work_end_hour, work_days, enabled_periods, custom_days_count,
                all_view_start_hour, all_view_end_hour, day_scroll_to_hour,
                username, audit_log_max_days, audit_log_max_mb, default_notifications, unit_system
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                new_settings_dict["user_id"],
                new_settings_dict["time_format"],
                new_settings_dict["sex"],
                new_settings_dict["snooze_length"],
                new_settings_dict["default_filters"],
                new_settings_dict["alarm_orientation"],
                new_settings_dict["active_clocks"],
                new_settings_dict["saved_locations"],
                new_settings_dict["tags"],
                new_settings_dict["custom_colors"],
                new_settings_dict["visual_indicators"],
                new_settings_dict["chit_options"],
                new_settings_dict["calendar_snap"],
                new_settings_dict["week_start_day"],
                new_settings_dict["work_start_hour"],
                new_settings_dict["work_end_hour"],
                new_settings_dict["work_days"],
                new_settings_dict["enabled_periods"],
                new_settings_dict["custom_days_count"],
                new_settings_dict["all_view_start_hour"],
                new_settings_dict["all_view_end_hour"],
                new_settings_dict["day_scroll_to_hour"],
                new_settings_dict["username"],
                new_settings_dict["audit_log_max_days"],
                new_settings_dict["audit_log_max_mb"],
                new_settings_dict["default_notifications"],
                new_settings_dict["unit_system"],
            )
        )

        # --- Audit: compute diff and insert entry if anything changed ---
        try:
            if old_settings_dict:
                audit_exclude = {"modified_datetime", "created_datetime", "user_id"}
                changes = compute_audit_diff(old_settings_dict, new_settings_dict, exclude_fields=audit_exclude)
                if changes:
                    actor = get_current_actor()
                    insert_audit_entry(conn, "settings", settings.user_id, "updated", actor, changes=changes)
        except Exception as e:
            logger.error(f"Audit: failed to log settings change: {str(e)}")

        conn.commit()

        # Auto-prune audit log if limits changed
        try:
            _run_auto_prune()
        except Exception as e:
            logger.error(f"Auto-prune after settings save failed: {str(e)}")

        return settings
    except Exception as e:
        logger.error(f"Error saving settings: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to save settings: {str(e)}")
    finally:
        if conn:
            conn.close()


# ═══════════════════════════════════════════════════════════════════════════
# Section 10b: Independent Alerts API Routes
# ═══════════════════════════════════════════════════════════════════════════

@app.get("/api/standalone-alerts")
def get_standalone_alerts():
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM standalone_alerts ORDER BY created_datetime DESC")
        rows = cursor.fetchall()
        results = []
        for row in rows:
            item = dict(row)
            item["data"] = deserialize_json_field(item.get("data"))
            results.append(item)
        return results
    except Exception as e:
        logger.error(f"Error fetching standalone alerts: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.close()


@app.post("/api/standalone-alerts")
def create_standalone_alert(body: dict):
    conn = None
    try:
        alert_id = str(uuid4())
        now = datetime.utcnow().isoformat()
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        _type = body.get("_type", "alarm")
        name = body.get("name", "")
        data = {k: v for k, v in body.items() if k not in ("id", "created_datetime", "modified_datetime")}
        cursor.execute(
            "INSERT INTO standalone_alerts (id, _type, name, data, created_datetime, modified_datetime) VALUES (?,?,?,?,?,?)",
            (alert_id, _type, name, serialize_json_field(data), now, now)
        )
        # Audit logging
        try:
            actor = get_current_actor()
            insert_audit_entry(conn, "independent_alert", alert_id, "created", actor, entity_summary=f"{_type}: {name}" if name else _type)
        except Exception as e:
            logger.error(f"Audit logging failed for independent alert creation: {str(e)}")
        conn.commit()
        data["id"] = alert_id
        data["created_datetime"] = now
        data["modified_datetime"] = now
        return data
    except Exception as e:
        logger.error(f"Error creating standalone alert: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.close()


@app.put("/api/standalone-alerts/{alert_id}")
def update_standalone_alert(alert_id: str, body: dict):
    conn = None
    try:
        now = datetime.utcnow().isoformat()
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        # Capture old state for audit diff
        cursor.execute("SELECT * FROM standalone_alerts WHERE id=?", (alert_id,))
        old_row = cursor.fetchone()
        old_data_str = None
        if old_row:
            old_cols = [col[0] for col in cursor.description]
            old_dict = dict(zip(old_cols, old_row))
            old_data_str = old_dict.get("data")

        _type = body.get("_type", "alarm")
        name = body.get("name", "")
        data = {k: v for k, v in body.items() if k not in ("id", "created_datetime", "modified_datetime")}
        new_data_str = serialize_json_field(data)
        cursor.execute(
            "UPDATE standalone_alerts SET _type=?, name=?, data=?, modified_datetime=? WHERE id=?",
            (_type, name, new_data_str, now, alert_id)
        )
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Standalone alert not found")
        # Audit logging
        try:
            if old_data_str != new_data_str:
                changes = [{"field": "data", "old": old_data_str, "new": new_data_str}]
                actor = get_current_actor()
                insert_audit_entry(conn, "independent_alert", alert_id, "updated", actor, changes=changes, entity_summary=f"{_type}: {name}" if name else _type)
        except Exception as e:
            logger.error(f"Audit logging failed for independent alert update: {str(e)}")
        conn.commit()
        data["id"] = alert_id
        data["modified_datetime"] = now
        return data
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating standalone alert: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.close()


@app.delete("/api/standalone-alerts/{alert_id}")
def delete_standalone_alert(alert_id: str):
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        # Get name for audit summary before deleting
        cursor.execute("SELECT _type, name FROM standalone_alerts WHERE id=?", (alert_id,))
        row = cursor.fetchone()
        summary = None
        if row:
            summary = f"{row[0]}: {row[1]}" if row[1] else row[0]
        cursor.execute("DELETE FROM standalone_alerts WHERE id=?", (alert_id,))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Standalone alert not found")
        # Audit logging
        try:
            actor = get_current_actor()
            insert_audit_entry(conn, "independent_alert", alert_id, "deleted", actor, entity_summary=summary)
        except Exception as e:
            logger.error(f"Audit logging failed for independent alert deletion: {str(e)}")
        conn.commit()
        return {"message": "Standalone alert deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting standalone alert: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.close()


# ═══════════════════════════════════════════════════════════════════════════
# Section 10c: Alert State API (dismiss/snooze persistence)
# ═══════════════════════════════════════════════════════════════════════════

@app.get("/api/alert-state")
def get_alert_states():
    """Get all non-expired alert states (dismissed/snoozed)."""
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        now = datetime.utcnow().isoformat()
        # Return dismissed (no expiry) and snoozed (not yet expired)
        cursor.execute("SELECT * FROM alert_state WHERE state = 'dismissed' OR (state = 'snoozed' AND until_ts > ?)", (now,))
        return [dict(row) for row in cursor.fetchall()]
    except Exception as e:
        logger.error(f"Error fetching alert states: {str(e)}")
        return []
    finally:
        if conn:
            conn.close()


@app.post("/api/alert-state")
def set_alert_state(body: dict):
    """Set dismiss/snooze state for an alert key."""
    conn = None
    try:
        alert_key = body.get("alert_key")
        state = body.get("state", "dismissed")  # 'dismissed' or 'snoozed'
        until_ts = body.get("until_ts")
        if not alert_key:
            raise HTTPException(status_code=400, detail="alert_key required")
        now = datetime.utcnow().isoformat()
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute(
            "INSERT OR REPLACE INTO alert_state (alert_key, state, until_ts, updated_at) VALUES (?,?,?,?)",
            (alert_key, state, until_ts, now)
        )
        conn.commit()
        # Broadcast via WebSocket to all connected clients
        return {"alert_key": alert_key, "state": state, "until_ts": until_ts}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error setting alert state: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.close()


@app.delete("/api/alert-state/cleanup")
def cleanup_alert_states():
    """Remove expired snooze states and old dismissed states (>24h)."""
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        now = datetime.utcnow().isoformat()
        yesterday = (datetime.utcnow() - timedelta(days=1)).isoformat()
        cursor.execute("DELETE FROM alert_state WHERE (state = 'snoozed' AND until_ts < ?) OR (state = 'dismissed' AND updated_at < ?)", (now, yesterday))
        conn.commit()
        return {"cleaned": cursor.rowcount}
    except Exception as e:
        logger.error(f"Error cleaning alert states: {str(e)}")
        return {"cleaned": 0}
    finally:
        if conn:
            conn.close()


# ═══════════════════════════════════════════════════════════════════════════
# Section 11: Contact API Routes
# ═══════════════════════════════════════════════════════════════════════════

@app.post("/api/contacts")
def create_contact(contact: Contact):
    conn = None
    try:
        contact_id = str(uuid4())
        current_time = datetime.now().isoformat()
        display_name = compute_display_name(contact)

        # Build a dict for vcard_print that includes all fields
        contact_dict = contact.dict()
        contact_dict["id"] = contact_id
        contact_dict["display_name"] = display_name
        contact_dict["created_datetime"] = current_time
        contact_dict["modified_datetime"] = current_time

        # Write .vcf file
        _write_vcf_file(contact_id, contact_dict)

        # Insert SQLite row
        db_fields = _serialize_contact_for_db(contact)
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO contacts (
                id, given_name, surname, middle_names, prefix, suffix,
                nickname, display_name, phones, emails, addresses, call_signs,
                x_handles, websites, has_signal, signal_username, pgp_key, favorite,
                color, organization, social_context, image_url, notes, tags,
                created_datetime, modified_datetime
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                contact_id,
                db_fields["given_name"],
                db_fields["surname"],
                db_fields["middle_names"],
                db_fields["prefix"],
                db_fields["suffix"],
                db_fields["nickname"],
                db_fields["display_name"],
                db_fields["phones"],
                db_fields["emails"],
                db_fields["addresses"],
                db_fields["call_signs"],
                db_fields["x_handles"],
                db_fields["websites"],
                db_fields["has_signal"],
                db_fields["signal_username"],
                db_fields["pgp_key"],
                db_fields["favorite"],
                db_fields["color"],
                db_fields["organization"],
                db_fields["social_context"],
                db_fields["image_url"],
                db_fields["notes"],
                db_fields["tags"],
                current_time,
                current_time,
            ),
        )
        # Audit logging for contact creation (Task 3.1)
        try:
            actor = get_current_actor()
            insert_audit_entry(conn, "contact", contact_id, "created", actor, entity_summary=display_name)
        except Exception as e:
            logger.error(f"Audit logging failed for contact creation (best-effort): {str(e)}")
        conn.commit()
        return contact_dict
    except Exception as e:
        logger.error(f"Error creating contact: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create contact: {str(e)}")
    finally:
        if conn:
            conn.close()


@app.get("/api/contacts")
def get_contacts(q: Optional[str] = Query(None)):
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        if q:
            like_pattern = f"%{q}%"
            cursor.execute(
                """
                SELECT * FROM contacts
                WHERE display_name LIKE ? COLLATE NOCASE
                   OR emails LIKE ? COLLATE NOCASE
                   OR phones LIKE ? COLLATE NOCASE
                   OR call_signs LIKE ? COLLATE NOCASE
                ORDER BY favorite DESC, display_name COLLATE NOCASE ASC
                """,
                (like_pattern, like_pattern, like_pattern, like_pattern),
            )
        else:
            cursor.execute(
                "SELECT * FROM contacts ORDER BY favorite DESC, display_name COLLATE NOCASE ASC"
            )

        columns = [col[0] for col in cursor.description]
        contacts = []
        for row in cursor.fetchall():
            contact = dict(zip(columns, row))
            contacts.append(_row_to_contact(contact))
        return contacts
    except Exception as e:
        logger.error(f"Error fetching contacts: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch contacts: {str(e)}")
    finally:
        if conn:
            conn.close()


@app.get("/api/contacts/export")
def export_contacts(format: str = Query(...)):
    """Export all contacts as a .vcf or .csv file download."""
    if format not in ("vcf", "csv"):
        raise HTTPException(status_code=400, detail="Invalid format. Use 'vcf' or 'csv'")

    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM contacts ORDER BY favorite DESC, display_name COLLATE NOCASE ASC")
        columns = [col[0] for col in cursor.description]
        contacts = []
        for row in cursor.fetchall():
            contact = dict(zip(columns, row))
            contacts.append(_row_to_contact(contact))

        if format == "vcf":
            vcf_parts = [vcard_print(c) for c in contacts]
            content = "\r\n".join(vcf_parts)
            return Response(
                content=content,
                media_type="text/vcard",
                headers={"Content-Disposition": "attachment; filename=contacts.vcf"},
            )
        else:
            content = csv_export(contacts)
            return Response(
                content=content,
                media_type="text/csv",
                headers={"Content-Disposition": "attachment; filename=contacts.csv"},
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error exporting contacts: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to export contacts: {str(e)}")
    finally:
        if conn:
            conn.close()


@app.get("/api/contacts/{contact_id}/export")
def export_single_contact(contact_id: str, format: str = Query(...)):
    """Export a single contact as a .vcf file download."""
    if format != "vcf":
        raise HTTPException(status_code=400, detail="Invalid format. Use 'vcf'")

    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM contacts WHERE id = ?", (contact_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail=f"Contact {contact_id} not found")
        columns = [col[0] for col in cursor.description]
        contact = _row_to_contact(dict(zip(columns, row)))

        vcf_content = vcard_print(contact)
        display = contact.get("display_name") or contact.get("given_name") or "contact"
        # Sanitize filename
        safe_name = re.sub(r'[^\w\s-]', '', display).strip().replace(' ', '_')
        return Response(
            content=vcf_content,
            media_type="text/vcard",
            headers={"Content-Disposition": f"attachment; filename={safe_name}.vcf"},
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error exporting contact {contact_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to export contact: {str(e)}")
    finally:
        if conn:
            conn.close()


@app.get("/api/contacts/{contact_id}")
def get_contact(contact_id: str):
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM contacts WHERE id = ?", (contact_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail=f"Contact {contact_id} not found")
        columns = [col[0] for col in cursor.description]
        contact = dict(zip(columns, row))
        return _row_to_contact(contact)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching contact {contact_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        if conn:
            conn.close()


@app.put("/api/contacts/{contact_id}")
def update_contact(contact_id: str, contact: Contact):
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM contacts WHERE id = ?", (contact_id,))
        existing = cursor.fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail=f"Contact {contact_id} not found")

        current_time = datetime.now().isoformat()
        display_name = compute_display_name(contact)

        # Build dict for vcf and response
        contact_dict = contact.dict()
        contact_dict["id"] = contact_id
        contact_dict["display_name"] = display_name
        contact_dict["modified_datetime"] = current_time
        # Preserve original created_datetime
        columns = [col[0] for col in cursor.description]
        existing_row = dict(zip(columns, existing))
        contact_dict["created_datetime"] = existing_row["created_datetime"]
        # Preserve image_url if not explicitly provided in the update
        if contact_dict.get("image_url") is None and existing_row.get("image_url"):
            contact_dict["image_url"] = existing_row["image_url"]

        # Write updated .vcf file
        _write_vcf_file(contact_id, contact_dict)

        # Capture old contact state for audit diff (Task 3.2)
        old_contact_dict = dict(existing_row)

        # Update SQLite row
        db_fields = _serialize_contact_for_db(contact)
        # Preserve image_url from existing row if not in the update payload
        if db_fields.get("image_url") is None and existing_row.get("image_url"):
            db_fields["image_url"] = existing_row["image_url"]
        cursor.execute(
            """
            UPDATE contacts SET
                given_name = ?, surname = ?, middle_names = ?, prefix = ?, suffix = ?,
                nickname = ?, display_name = ?, phones = ?, emails = ?, addresses = ?,
                call_signs = ?, x_handles = ?, websites = ?,
                has_signal = ?, signal_username = ?, pgp_key = ?, favorite = ?,
                color = ?, organization = ?, social_context = ?, image_url = ?,
                notes = ?, tags = ?,
                modified_datetime = ?
            WHERE id = ?
            """,
            (
                db_fields["given_name"],
                db_fields["surname"],
                db_fields["middle_names"],
                db_fields["prefix"],
                db_fields["suffix"],
                db_fields["nickname"],
                db_fields["display_name"],
                db_fields["phones"],
                db_fields["emails"],
                db_fields["addresses"],
                db_fields["call_signs"],
                db_fields["x_handles"],
                db_fields["websites"],
                db_fields["has_signal"],
                db_fields["signal_username"],
                db_fields["pgp_key"],
                db_fields["favorite"],
                db_fields["color"],
                db_fields["organization"],
                db_fields["social_context"],
                db_fields["image_url"],
                db_fields["notes"],
                db_fields["tags"],
                current_time,
                contact_id,
            ),
        )
        # Audit logging for contact update (Task 3.2)
        try:
            new_contact_dict = dict(db_fields)
            new_contact_dict["id"] = contact_id
            new_contact_dict["modified_datetime"] = current_time
            new_contact_dict["created_datetime"] = existing_row["created_datetime"]
            diff = compute_audit_diff(old_contact_dict, new_contact_dict, exclude_fields={"modified_datetime", "created_datetime"})
            if diff:
                actor = get_current_actor()
                insert_audit_entry(conn, "contact", contact_id, "updated", actor, changes=diff, entity_summary=display_name)
        except Exception as e:
            logger.error(f"Audit logging failed for contact update (best-effort): {str(e)}")
        conn.commit()
        return contact_dict
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating contact {contact_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update contact: {str(e)}")
    finally:
        if conn:
            conn.close()


@app.delete("/api/contacts/{contact_id}")
def delete_contact(contact_id: str):
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT id, display_name FROM contacts WHERE id = ?", (contact_id,))
        existing = cursor.fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail=f"Contact {contact_id} not found")
        contact_display_name = existing[1]

        # Remove .vcf file from disk
        vcf_path = os.path.join(CONTACTS_DIR, f"{contact_id}.vcf")
        if os.path.exists(vcf_path):
            os.remove(vcf_path)

        # Delete SQLite row
        cursor.execute("DELETE FROM contacts WHERE id = ?", (contact_id,))
        # Audit logging for contact deletion (Task 3.3)
        try:
            actor = get_current_actor()
            insert_audit_entry(conn, "contact", contact_id, "deleted", actor, entity_summary=contact_display_name)
        except Exception as e:
            logger.error(f"Audit logging failed for contact deletion (best-effort): {str(e)}")
        conn.commit()
        return {"message": f"Contact {contact_id} deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting contact {contact_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete contact: {str(e)}")
    finally:
        if conn:
            conn.close()


@app.post("/api/contacts/{contact_id}/image")
async def upload_contact_image(contact_id: str, file: UploadFile = File(...)):
    """Upload a profile image for a contact. Stores in data/contacts/profile_pictures/."""
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM contacts WHERE id = ?", (contact_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail=f"Contact {contact_id} not found")

        # Validate file type
        allowed = {"image/jpeg", "image/png", "image/gif", "image/webp"}
        if file.content_type not in allowed:
            raise HTTPException(status_code=400, detail="Only JPEG, PNG, GIF, and WebP images are allowed")

        # Determine extension from content type
        ext_map = {"image/jpeg": ".jpg", "image/png": ".png", "image/gif": ".gif", "image/webp": ".webp"}
        ext = ext_map.get(file.content_type, ".jpg")
        filename = f"{contact_id}{ext}"
        filepath = os.path.join(CONTACT_IMAGES_DIR, filename)

        # Remove any existing image for this contact (different extension)
        for old_ext in ext_map.values():
            old_path = os.path.join(CONTACT_IMAGES_DIR, f"{contact_id}{old_ext}")
            if os.path.exists(old_path) and old_path != filepath:
                os.remove(old_path)

        # Save file
        contents = await file.read()
        with open(filepath, "wb") as f:
            f.write(contents)

        image_url = f"/data/contacts/profile_pictures/{filename}"

        # Update DB
        cursor.execute("UPDATE contacts SET image_url = ?, modified_datetime = ? WHERE id = ?",
                        (image_url, datetime.now().isoformat(), contact_id))
        conn.commit()
        return {"image_url": image_url}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading image for contact {contact_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to upload image: {str(e)}")
    finally:
        if conn:
            conn.close()


@app.delete("/api/contacts/{contact_id}/image")
def delete_contact_image(contact_id: str):
    """Remove a contact's profile image."""
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT image_url FROM contacts WHERE id = ?", (contact_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail=f"Contact {contact_id} not found")

        image_url = row[0]
        if image_url:
            filepath = os.path.join("/app", image_url.lstrip("/"))
            if os.path.exists(filepath):
                os.remove(filepath)

        cursor.execute("UPDATE contacts SET image_url = NULL, modified_datetime = ? WHERE id = ?",
                        (datetime.now().isoformat(), contact_id))
        conn.commit()
        return {"message": "Image removed"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting image for contact {contact_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete image: {str(e)}")
    finally:
        if conn:
            conn.close()


@app.patch("/api/contacts/{contact_id}/favorite")
def toggle_contact_favorite(contact_id: str):
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM contacts WHERE id = ?", (contact_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail=f"Contact {contact_id} not found")

        columns = [col[0] for col in cursor.description]
        contact = dict(zip(columns, row))
        contact = _row_to_contact(contact)

        # Toggle favorite
        new_favorite = not contact["favorite"]
        current_time = datetime.now().isoformat()

        # Update SQLite
        cursor.execute(
            "UPDATE contacts SET favorite = ?, modified_datetime = ? WHERE id = ?",
            (1 if new_favorite else 0, current_time, contact_id),
        )
        conn.commit()

        # Update contact dict for vcf write and response
        contact["favorite"] = new_favorite
        contact["modified_datetime"] = current_time

        # Rewrite .vcf file with updated favorite
        _write_vcf_file(contact_id, contact)

        return contact
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error toggling favorite for contact {contact_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to toggle favorite: {str(e)}")
    finally:
        if conn:
            conn.close()


@app.post("/api/contacts/import")
async def import_contacts(file: UploadFile = File(...)):
    """Import contacts from a .vcf or .csv file upload.

    Returns a summary: {imported, skipped, errors}.
    """
    filename = (file.filename or "").lower()
    if not (filename.endswith(".vcf") or filename.endswith(".csv")):
        raise HTTPException(status_code=400, detail="Unsupported file type. Use .vcf or .csv")

    content = (await file.read()).decode("utf-8", errors="replace")
    imported = 0
    skipped = 0
    errors_list: List[Dict[str, Any]] = []

    if filename.endswith(".vcf"):
        # Split on BEGIN:VCARD / END:VCARD boundaries
        vcard_blocks = re.findall(
            r"(BEGIN:VCARD.*?END:VCARD)",
            content,
            re.DOTALL | re.IGNORECASE,
        )
        for idx, block in enumerate(vcard_blocks, start=1):
            conn = None
            try:
                parsed = vcard_parse(block)
                if not parsed.get("given_name"):
                    errors_list.append({"entry": idx, "reason": "Missing given_name"})
                    skipped += 1
                    continue

                # Create contact: assign UUID, compute display_name, write .vcf, insert DB row
                contact_id = str(uuid4())
                current_time = datetime.now().isoformat()
                display_name = compute_display_name(parsed)

                contact_dict = dict(parsed)
                contact_dict["id"] = contact_id
                contact_dict["display_name"] = display_name
                contact_dict["created_datetime"] = current_time
                contact_dict["modified_datetime"] = current_time

                _write_vcf_file(contact_id, contact_dict)

                db_fields = _serialize_contact_for_db(contact_dict)
                conn = sqlite3.connect(DB_PATH)
                cursor = conn.cursor()
                cursor.execute(
                    """
                    INSERT INTO contacts (
                        id, given_name, surname, middle_names, prefix, suffix,
                        display_name, phones, emails, addresses, call_signs,
                        x_handles, websites, has_signal, pgp_key, favorite,
                        created_datetime, modified_datetime
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        contact_id,
                        db_fields["given_name"],
                        db_fields["surname"],
                        db_fields["middle_names"],
                        db_fields["prefix"],
                        db_fields["suffix"],
                        db_fields["display_name"],
                        db_fields["phones"],
                        db_fields["emails"],
                        db_fields["addresses"],
                        db_fields["call_signs"],
                        db_fields["x_handles"],
                        db_fields["websites"],
                        db_fields["has_signal"],
                        db_fields["pgp_key"],
                        db_fields["favorite"],
                        current_time,
                        current_time,
                    ),
                )
                conn.commit()
                imported += 1
            except Exception as e:
                errors_list.append({"entry": idx, "reason": str(e)})
                skipped += 1
            finally:
                if conn:
                    conn.close()

    elif filename.endswith(".csv"):
        contacts_parsed, csv_errors = csv_import(content)

        # csv_errors use "row" key — remap to "entry" for consistent response
        for err in csv_errors:
            errors_list.append({"entry": err["row"], "reason": err["reason"]})
            skipped += 1

        for idx, parsed in enumerate(contacts_parsed):
            conn = None
            try:
                contact_id = str(uuid4())
                current_time = datetime.now().isoformat()
                display_name = compute_display_name(parsed)

                contact_dict = dict(parsed)
                contact_dict["id"] = contact_id
                contact_dict["display_name"] = display_name
                contact_dict["created_datetime"] = current_time
                contact_dict["modified_datetime"] = current_time

                _write_vcf_file(contact_id, contact_dict)

                db_fields = _serialize_contact_for_db(contact_dict)
                conn = sqlite3.connect(DB_PATH)
                cursor = conn.cursor()
                cursor.execute(
                    """
                    INSERT INTO contacts (
                        id, given_name, surname, middle_names, prefix, suffix,
                        display_name, phones, emails, addresses, call_signs,
                        x_handles, websites, has_signal, pgp_key, favorite,
                        created_datetime, modified_datetime
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        contact_id,
                        db_fields["given_name"],
                        db_fields["surname"],
                        db_fields["middle_names"],
                        db_fields["prefix"],
                        db_fields["suffix"],
                        db_fields["display_name"],
                        db_fields["phones"],
                        db_fields["emails"],
                        db_fields["addresses"],
                        db_fields["call_signs"],
                        db_fields["x_handles"],
                        db_fields["websites"],
                        db_fields["has_signal"],
                        db_fields["pgp_key"],
                        db_fields["favorite"],
                        current_time,
                        current_time,
                    ),
                )
                conn.commit()
                imported += 1
            except Exception as e:
                errors_list.append({"entry": idx, "reason": str(e)})
                skipped += 1
            finally:
                if conn:
                    conn.close()

    return {"imported": imported, "skipped": skipped, "errors": errors_list}


# ═══════════════════════════════════════════════════════════════════════════
# Section 11.5: Audit Log API Endpoints
# ═══════════════════════════════════════════════════════════════════════════

# ── Allowed sort columns for audit log queries ────────────────────────────
_AUDIT_SORT_COLUMNS = {"timestamp", "actor", "action", "entity_type", "entity_summary"}

# ── Trim duration map ─────────────────────────────────────────────────────
_TRIM_DURATIONS = {
    "1h": timedelta(hours=1),
    "1d": timedelta(days=1),
    "1w": timedelta(weeks=1),
    "1m": timedelta(days=30),
    "1y": timedelta(days=365),
}


@app.get("/api/audit-log/export")
def export_audit_log_csv(
    entity_type: Optional[str] = Query(None),
    actor: Optional[str] = Query(None),
    since: Optional[str] = Query(None),
    until: Optional[str] = Query(None),
):
    """Export audit log entries as a CSV file download.
    Accepts same filters as GET /api/audit-log but no limit/offset — exports all matching."""
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row

        query = "SELECT * FROM audit_log"
        conditions = []
        params = []

        if entity_type:
            conditions.append("entity_type = ?")
            params.append(entity_type)
        if actor:
            conditions.append("actor = ?")
            params.append(actor)
        if since:
            conditions.append("timestamp >= ?")
            params.append(since)
        if until:
            conditions.append("timestamp <= ?")
            params.append(until)

        if conditions:
            query += " WHERE " + " AND ".join(conditions)
        query += " ORDER BY timestamp DESC"

        cursor = conn.cursor()
        cursor.execute(query, params)
        rows = cursor.fetchall()

        output = io.StringIO()
        writer = csv.writer(output)
        columns = ["timestamp", "actor", "action", "entity_type", "entity_id", "entity_summary", "changes"]
        writer.writerow(columns)

        for row in rows:
            writer.writerow([
                row["timestamp"],
                row["actor"],
                row["action"],
                row["entity_type"],
                row["entity_id"],
                row["entity_summary"] or "",
                row["changes"] or "",
            ])

        csv_content = output.getvalue()
        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=audit_log.csv"},
        )
    except Exception as e:
        logger.error(f"Error exporting audit log CSV: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to export audit log: {str(e)}")
    finally:
        if conn:
            conn.close()


@app.get("/api/audit-log")
def get_audit_log(
    entity_type: Optional[str] = Query(None),
    entity_id: Optional[str] = Query(None),
    actor: Optional[str] = Query(None),
    since: Optional[str] = Query(None),
    until: Optional[str] = Query(None),
    limit: int = Query(50),
    offset: int = Query(0),
    sort_by: str = Query("timestamp"),
    sort_order: str = Query("desc"),
):
    """Return audit log entries with optional filters, sorting, and pagination."""
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row

        # Clamp negative limit/offset to 0
        if limit < 0:
            limit = 0
        if offset < 0:
            offset = 0

        # Validate sort_by against allowed columns
        if sort_by not in _AUDIT_SORT_COLUMNS:
            sort_by = "timestamp"
        if sort_order.lower() not in ("asc", "desc"):
            sort_order = "desc"

        base_query = "FROM audit_log"
        conditions = []
        params = []

        if entity_type:
            conditions.append("entity_type = ?")
            params.append(entity_type)
        if entity_id:
            conditions.append("entity_id = ?")
            params.append(entity_id)
        if actor:
            conditions.append("actor = ?")
            params.append(actor)
        if since:
            conditions.append("timestamp >= ?")
            params.append(since)
        if until:
            conditions.append("timestamp <= ?")
            params.append(until)

        if conditions:
            base_query += " WHERE " + " AND ".join(conditions)

        # Get total count
        cursor = conn.cursor()
        cursor.execute(f"SELECT COUNT(*) {base_query}", params)
        total = cursor.fetchone()[0]

        # Get paginated entries
        data_query = f"SELECT * {base_query} ORDER BY {sort_by} {sort_order} LIMIT ? OFFSET ?"
        cursor.execute(data_query, params + [limit, offset])
        rows = cursor.fetchall()

        entries = []
        for row in rows:
            entry = dict(row)
            # Deserialize changes from JSON
            if entry.get("changes"):
                try:
                    entry["changes"] = json.loads(entry["changes"])
                except (json.JSONDecodeError, TypeError):
                    pass  # Return raw string if invalid JSON
            entries.append(entry)

        return {"entries": entries, "total": total}
    except Exception as e:
        logger.error(f"Error fetching audit log: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch audit log: {str(e)}")
    finally:
        if conn:
            conn.close()


@app.delete("/api/audit-log/trim")
def trim_audit_log(
    older_than: str = Query(...),
):
    """Trim audit log entries older than a specified timeframe.
    Accepted values: 1h, 1d, 1w, 1m, 1y."""
    conn = None
    try:
        duration = _TRIM_DURATIONS.get(older_than)
        if not duration:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid older_than value: '{older_than}'. Use one of: 1h, 1d, 1w, 1m, 1y",
            )

        cutoff = (datetime.utcnow() - duration).isoformat()

        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("DELETE FROM audit_log WHERE timestamp < ?", (cutoff,))
        deleted_count = cursor.rowcount
        conn.commit()

        label_map = {"1h": "1 hour", "1d": "1 day", "1w": "1 week", "1m": "1 month", "1y": "1 year"}
        label = label_map.get(older_than, older_than)

        return {"message": f"Trimmed entries older than {label}", "deleted_count": deleted_count}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error trimming audit log: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to trim audit log: {str(e)}")
    finally:
        if conn:
            conn.close()


@app.delete("/api/audit-log")
def clear_audit_log():
    """Delete all audit log entries."""
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM audit_log")
        total = cursor.fetchone()[0]
        cursor.execute("DELETE FROM audit_log")
        conn.commit()
        return {"message": "Audit log cleared", "deleted_count": total}
    except Exception as e:
        logger.error(f"Error clearing audit log: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to clear audit log: {str(e)}")
    finally:
        if conn:
            conn.close()


@app.post("/api/audit-log/auto-prune")
def auto_prune_audit_log():
    """Auto-prune audit log based on settings limits."""
    pruned_by_age, pruned_by_size = _run_auto_prune()
    return {"pruned_by_age": pruned_by_age, "pruned_by_size": pruned_by_size}


# ═══════════════════════════════════════════════════════════════════════════
# Section 12: Version Management & Update Streaming
# ═══════════════════════════════════════════════════════════════════════════

CONFIGURINATOR_PATH = "/app/install/configurinator.sh"
UPDATE_LOG_PATH = "/app/data/update.log"

@app.get("/api/update/log")
def get_update_log():
    try:
        with open(UPDATE_LOG_PATH, "r") as f:
            return {"log": f.read()}
    except (FileNotFoundError, IOError):
        return {"log": None}

@app.get("/api/update/run")
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
                    # Read version from /app/VERSION
                    version = "unknown"
                    try:
                        with open("/app/VERSION", "r") as f:
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


# ═══════════════════════════════════════════════════════════════════════════
# Section 13: Weather Update Service
# ═══════════════════════════════════════════════════════════════════════════

# --- 13.1: Helper — get chit focus date ---

def _get_chit_focus_date(chit):
    """Return the earliest date from start_datetime or due_datetime as YYYY-MM-DD.
    Returns None if neither field has a value."""
    dates = []
    for field in ("start_datetime", "due_datetime"):
        val = chit.get(field) if isinstance(chit, dict) else getattr(chit, field, None)
        if val and isinstance(val, str) and val.strip():
            try:
                # Parse ISO datetime and extract date portion
                dt = datetime.fromisoformat(val.replace("Z", "+00:00"))
                dates.append(dt.date())
            except (ValueError, TypeError):
                # Try parsing just the date portion (first 10 chars)
                try:
                    dt = datetime.strptime(val[:10], "%Y-%m-%d")
                    dates.append(dt.date())
                except (ValueError, TypeError):
                    pass
    if not dates:
        return None
    return min(dates).isoformat()


# --- 13.2: Helper — partition eligible chits ---

def _partition_eligible_chits(chits, now):
    """Partition chits into hourly (0-7 days) and daily (8-16 days) buckets.
    Filters: non-deleted, non-empty location, has a focus_date in range.
    Returns (hourly_chits, daily_chits)."""
    from datetime import timedelta
    today = now.date() if hasattr(now, 'date') else now
    hourly_chits = []
    daily_chits = []
    for chit in chits:
        # Check deleted flag
        deleted = chit.get("deleted") if isinstance(chit, dict) else getattr(chit, "deleted", None)
        if deleted:
            continue
        # Check location
        location = chit.get("location") if isinstance(chit, dict) else getattr(chit, "location", None)
        if not location or not str(location).strip():
            continue
        # Get focus date
        focus_date_str = _get_chit_focus_date(chit)
        if not focus_date_str:
            continue
        try:
            focus_date = datetime.strptime(focus_date_str, "%Y-%m-%d").date()
        except (ValueError, TypeError):
            continue
        delta_days = (focus_date - today).days
        if 0 <= delta_days <= 7:
            hourly_chits.append(chit)
        elif 8 <= delta_days <= 16:
            daily_chits.append(chit)
    return hourly_chits, daily_chits


# --- 13.3: Helper — extract weather for a specific date ---

def _extract_weather_for_date(forecast_daily, focus_date):
    """Extract weather data for a specific date from an Open-Meteo daily response.
    Returns a weather_data dict or None if focus_date not found."""
    times = forecast_daily.get("time", [])
    try:
        idx = times.index(focus_date)
    except ValueError:
        return None
    return {
        "focus_date": focus_date,
        "updated_time": datetime.utcnow().isoformat() + "Z",
        "high": forecast_daily.get("temperature_2m_max", [])[idx] if idx < len(forecast_daily.get("temperature_2m_max", [])) else None,
        "low": forecast_daily.get("temperature_2m_min", [])[idx] if idx < len(forecast_daily.get("temperature_2m_min", [])) else None,
        "precipitation": forecast_daily.get("precipitation_sum", [])[idx] if idx < len(forecast_daily.get("precipitation_sum", [])) else None,
        "weather_code": forecast_daily.get("weathercode", [])[idx] if idx < len(forecast_daily.get("weathercode", [])) else None,
    }


# --- 13.4: Weather fetch helpers ---

def _sync_weather_fetch(url):
    """Blocking fetch for Open-Meteo data — runs in thread pool."""
    req = urllib.request.Request(url, headers={"User-Agent": "CWOC-Weather/1.0"})
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode())


async def _fetch_weather_for_location(lat, lon, days=16):
    """Fetch multi-day forecast from Open-Meteo for a given lat/lon.
    Returns parsed JSON response."""
    url = (
        f"https://api.open-meteo.com/v1/forecast"
        f"?latitude={lat}&longitude={lon}"
        f"&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum"
        f"&timezone=auto&forecast_days={days}"
    )
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _sync_weather_fetch, url)


# --- 13.5: Internal geocode helper (reuses existing cache/lock) ---

async def _geocode_address(address):
    """Geocode an address string, reusing the existing _geocode_cache and rate limiting.
    Returns {"lat": float, "lon": float} or None on failure."""
    global _geocode_last_req
    key = address.lower().strip()
    # Return cached result if < 24 hours old
    if key in _geocode_cache and (time.time() - _geocode_cache[key]["ts"]) < 86400:
        return {"lat": _geocode_cache[key]["lat"], "lon": _geocode_cache[key]["lon"]}

    async with _geocode_lock:
        # Re-check cache after acquiring lock
        if key in _geocode_cache and (time.time() - _geocode_cache[key]["ts"]) < 86400:
            return {"lat": _geocode_cache[key]["lat"], "lon": _geocode_cache[key]["lon"]}

        # Rate-limit: wait if less than 1.1 seconds since last request
        elapsed = time.time() - _geocode_last_req
        if elapsed < 1.1:
            await asyncio.sleep(1.1 - elapsed)

        url = "https://nominatim.openstreetmap.org/search?format=json&limit=3&q=" + urllib.parse.quote(address)
        try:
            _geocode_last_req = time.time()
            loop = asyncio.get_event_loop()
            data = await loop.run_in_executor(None, _sync_geocode_fetch, url)
            if data and len(data) > 0:
                lat = float(data[0]["lat"])
                lon = float(data[0]["lon"])
                _geocode_cache[key] = {"lat": lat, "lon": lon, "ts": time.time()}
                return {"lat": lat, "lon": lon}
            return None
        except Exception as e:
            logger.error(f"Geocode error for '{address}': {e}")
            return None


# --- 13.6: POST /api/weather/update endpoint ---

@app.post("/api/weather/update")
async def weather_update():
    """Trigger weather update for all eligible chits."""
    # Prevent concurrent runs
    if _update_lock.locked():
        return {"updated": 0, "skipped": 0, "message": "Update already in progress"}

    async with _update_lock:
        start_time = time.time()
        updated = 0
        skipped = 0

        try:
            # Query all non-deleted chits with location and date fields
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM chits WHERE (deleted = 0 OR deleted IS NULL) "
                "AND location IS NOT NULL AND location != '' "
                "AND (start_datetime IS NOT NULL OR due_datetime IS NOT NULL)"
            )
            rows = cursor.fetchall()
            columns = [col[0] for col in cursor.description]
            all_chits = [dict(zip(columns, row)) for row in rows]
            conn.close()

            # Partition into hourly and daily buckets
            now = datetime.utcnow()
            hourly_chits, daily_chits = _partition_eligible_chits(all_chits, now)
            eligible_chits = hourly_chits + daily_chits

            if not eligible_chits:
                elapsed = time.time() - start_time
                return {"updated": 0, "skipped": 0, "elapsed_seconds": round(elapsed, 2)}

            # Group chits by unique location string
            location_groups = {}
            for chit in eligible_chits:
                loc = (chit.get("location") or "").strip()
                if loc:
                    location_groups.setdefault(loc, []).append(chit)

            # Geocode each unique location once
            location_coords = {}
            for loc in location_groups:
                try:
                    coords = await _geocode_address(loc)
                    if coords:
                        location_coords[loc] = coords
                    else:
                        logger.warning(f"Weather update: geocode failed for '{loc}'")
                        skipped += len(location_groups[loc])
                except Exception as e:
                    logger.error(f"Weather update: geocode error for '{loc}': {e}")
                    skipped += len(location_groups[loc])

            # Fetch 16-day forecast per unique location
            location_forecasts = {}
            for loc, coords in location_coords.items():
                try:
                    forecast = await _fetch_weather_for_location(coords["lat"], coords["lon"], days=16)
                    if forecast and "daily" in forecast:
                        location_forecasts[loc] = forecast["daily"]
                    else:
                        logger.warning(f"Weather update: no daily data for '{loc}'")
                        skipped += len(location_groups[loc])
                except Exception as e:
                    logger.error(f"Weather update: forecast fetch error for '{loc}': {e}")
                    skipped += len(location_groups[loc])

            # Update each chit's weather_data
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            for loc, chits_for_loc in location_groups.items():
                if loc not in location_forecasts:
                    continue
                forecast_daily = location_forecasts[loc]
                for chit in chits_for_loc:
                    focus_date_str = _get_chit_focus_date(chit)
                    if not focus_date_str:
                        skipped += 1
                        continue
                    weather_data = _extract_weather_for_date(forecast_daily, focus_date_str)
                    if weather_data:
                        try:
                            cursor.execute(
                                "UPDATE chits SET weather_data = ?, modified_datetime = ? WHERE id = ?",
                                (serialize_json_field(weather_data), datetime.utcnow().isoformat(), chit["id"])
                            )
                            updated += 1
                        except Exception as e:
                            logger.error(f"Weather update: DB write error for chit {chit['id']}: {e}")
                            skipped += 1
                    else:
                        skipped += 1
            conn.commit()
            conn.close()

        except Exception as e:
            logger.error(f"Weather update error: {e}")

        elapsed = time.time() - start_time
        return {"updated": updated, "skipped": skipped, "elapsed_seconds": round(elapsed, 2)}


# --- 13.7: Background scheduler tasks ---

async def _weather_hourly_loop():
    """Background task: update weather for chits in the 0-7 day window every 60 minutes."""
    while True:
        try:
            await asyncio.sleep(3600)  # 60 minutes
            if _update_lock.locked():
                logger.info("Weather hourly loop: update already in progress, skipping")
                continue
            async with _update_lock:
                logger.info("Weather hourly loop: starting update")
                conn = sqlite3.connect(DB_PATH)
                cursor = conn.cursor()
                cursor.execute(
                    "SELECT * FROM chits WHERE (deleted = 0 OR deleted IS NULL) "
                    "AND location IS NOT NULL AND location != '' "
                    "AND (start_datetime IS NOT NULL OR due_datetime IS NOT NULL)"
                )
                rows = cursor.fetchall()
                columns = [col[0] for col in cursor.description]
                all_chits = [dict(zip(columns, row)) for row in rows]
                conn.close()

                now = datetime.utcnow()
                hourly_chits, _ = _partition_eligible_chits(all_chits, now)
                if not hourly_chits:
                    logger.info("Weather hourly loop: no eligible chits")
                    continue

                # Group by location
                location_groups = {}
                for chit in hourly_chits:
                    loc = (chit.get("location") or "").strip()
                    if loc:
                        location_groups.setdefault(loc, []).append(chit)

                # Geocode + fetch + update
                for loc, chits_for_loc in location_groups.items():
                    try:
                        coords = await _geocode_address(loc)
                        if not coords:
                            continue
                        forecast = await _fetch_weather_for_location(coords["lat"], coords["lon"], days=7)
                        if not forecast or "daily" not in forecast:
                            continue
                        forecast_daily = forecast["daily"]
                        conn = sqlite3.connect(DB_PATH)
                        cursor = conn.cursor()
                        for chit in chits_for_loc:
                            focus_date_str = _get_chit_focus_date(chit)
                            if not focus_date_str:
                                continue
                            weather_data = _extract_weather_for_date(forecast_daily, focus_date_str)
                            if weather_data:
                                cursor.execute(
                                    "UPDATE chits SET weather_data = ?, modified_datetime = ? WHERE id = ?",
                                    (serialize_json_field(weather_data), datetime.utcnow().isoformat(), chit["id"])
                                )
                        conn.commit()
                        conn.close()
                    except Exception as e:
                        logger.error(f"Weather hourly loop error for '{loc}': {e}")
                logger.info("Weather hourly loop: update complete")
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Weather hourly loop unexpected error: {e}")


async def _weather_daily_loop():
    """Background task: update weather for chits in the 8-16 day window every 24 hours."""
    while True:
        try:
            await asyncio.sleep(86400)  # 24 hours
            if _update_lock.locked():
                logger.info("Weather daily loop: update already in progress, skipping")
                continue
            async with _update_lock:
                logger.info("Weather daily loop: starting update")
                conn = sqlite3.connect(DB_PATH)
                cursor = conn.cursor()
                cursor.execute(
                    "SELECT * FROM chits WHERE (deleted = 0 OR deleted IS NULL) "
                    "AND location IS NOT NULL AND location != '' "
                    "AND (start_datetime IS NOT NULL OR due_datetime IS NOT NULL)"
                )
                rows = cursor.fetchall()
                columns = [col[0] for col in cursor.description]
                all_chits = [dict(zip(columns, row)) for row in rows]
                conn.close()

                now = datetime.utcnow()
                _, daily_chits = _partition_eligible_chits(all_chits, now)
                if not daily_chits:
                    logger.info("Weather daily loop: no eligible chits")
                    continue

                # Group by location
                location_groups = {}
                for chit in daily_chits:
                    loc = (chit.get("location") or "").strip()
                    if loc:
                        location_groups.setdefault(loc, []).append(chit)

                # Geocode + fetch + update
                for loc, chits_for_loc in location_groups.items():
                    try:
                        coords = await _geocode_address(loc)
                        if not coords:
                            continue
                        forecast = await _fetch_weather_for_location(coords["lat"], coords["lon"], days=16)
                        if not forecast or "daily" not in forecast:
                            continue
                        forecast_daily = forecast["daily"]
                        conn = sqlite3.connect(DB_PATH)
                        cursor = conn.cursor()
                        for chit in chits_for_loc:
                            focus_date_str = _get_chit_focus_date(chit)
                            if not focus_date_str:
                                continue
                            weather_data = _extract_weather_for_date(forecast_daily, focus_date_str)
                            if weather_data:
                                cursor.execute(
                                    "UPDATE chits SET weather_data = ?, modified_datetime = ? WHERE id = ?",
                                    (serialize_json_field(weather_data), datetime.utcnow().isoformat(), chit["id"])
                                )
                        conn.commit()
                        conn.close()
                    except Exception as e:
                        logger.error(f"Weather daily loop error for '{loc}': {e}")
                logger.info("Weather daily loop: update complete")
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Weather daily loop unexpected error: {e}")


# Register background weather tasks on startup
@app.on_event("startup")
async def start_weather_schedulers():
    # Auto-prune audit log in background (never blocks server startup)
    async def _deferred_auto_prune():
        await asyncio.sleep(10)  # Let server fully start first
        try:
            _run_auto_prune()
        except Exception as e:
            logger.error(f"Deferred auto-prune failed: {str(e)}")
    asyncio.create_task(_deferred_auto_prune())
    asyncio.create_task(_weather_hourly_loop())
    asyncio.create_task(_weather_daily_loop())
    logger.info("Weather scheduler tasks started (hourly + daily)")


# ═══════════════════════════════════════════════════════════════════════════
# Section 14: Health Check
# ═══════════════════════════════════════════════════════════════════════════

@app.get("/health")
def health_check():
    return {"status": "healthy"}
