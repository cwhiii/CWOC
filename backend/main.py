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
from datetime import datetime
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, HTTPException, Query, UploadFile, File, Response
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
        system_tags.append("Calendar")
    if chit.checklist:
        system_tags.append("Checklists")
    if chit.alarm:
        system_tags.append("Alarms")
    if "Project" in (chit.tags or []):
        system_tags.append("Projects")
    if chit.status in ["ToDo", "In Progress", "Blocked", "Complete"]:
        system_tags.append("Tasks")
    if not (chit.due_datetime or chit.start_datetime or chit.end_datetime):
        system_tags.append("Notes")
    return list(set((chit.tags or []) + system_tags))

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
seed_version_info()

# Create directory for contact images
CONTACT_IMAGES_DIR = "/app/static/contact_images/"
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


# Serve all files from /frontend/ (e.g., index.html, settings.html, editor.html)
app.mount("/frontend", StaticFiles(directory="/app/frontend"), name="frontend")

# Serve all files from /static/ (e.g., images)
app.mount("/static", StaticFiles(directory="/app/static"), name="static")

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
                recurrence_rule, recurrence_exceptions
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            # Update existing chit
            cursor.execute(
                """
                UPDATE chits SET
                    title = ?, note = ?, tags = ?, start_datetime = ?, end_datetime = ?, due_datetime = ?,
                    completed_datetime = ?, status = ?, priority = ?, severity = ?, checklist = ?, alarm = ?, notification = ?,
                    recurrence = ?, recurrence_id = ?, location = ?, color = ?, people = ?, pinned = ?,
                    archived = ?, deleted = ?, modified_datetime = ?, is_project_master = ?, child_chits = ?, all_day = ?, alerts = ?,
                    recurrence_rule = ?, recurrence_exceptions = ?
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
                    chit_id,
                )
            )
        else:
            # Create new chit
            cursor.execute(
                """
                INSERT INTO chits (
                    id, title, note, tags, start_datetime, end_datetime, due_datetime,
                    completed_datetime, status, priority, severity, checklist, alarm, notification,
                    recurrence, recurrence_id, location, color, people, pinned, archived,
                    deleted, created_datetime, modified_datetime, is_project_master, child_chits, all_day, alerts,
                    recurrence_rule, recurrence_exceptions
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                )
            )
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
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Chit not found")
        cursor.execute("UPDATE chits SET deleted = 1, modified_datetime = ? WHERE id = ?",
                       (datetime.utcnow().isoformat(), chit_id))
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
        cursor.execute(
            """
            INSERT OR REPLACE INTO settings (
                user_id, time_format, sex, snooze_length, default_filters,
                alarm_orientation, active_clocks, saved_locations, tags, custom_colors, visual_indicators, chit_options,
                calendar_snap, week_start_day, work_start_hour, work_end_hour, work_days, enabled_periods, custom_days_count,
                all_view_start_hour, all_view_end_hour, day_scroll_to_hour
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                settings.user_id,
                settings.time_format,
                settings.sex,
                settings.snooze_length,
                serialize_json_field(settings.default_filters),
                settings.alarm_orientation,
                settings.active_clocks,
                settings.saved_locations,
                # Serialize tags as list of dicts (Pydantic Tag objects need .dict())
                serialize_json_field([t.dict() for t in settings.tags]) if settings.tags else None,
                serialize_json_field(settings.custom_colors),
                serialize_json_field(settings.visual_indicators),
                serialize_json_field(settings.chit_options),
                settings.calendar_snap or "15",
                settings.week_start_day or "0",
                settings.work_start_hour or "8",
                settings.work_end_hour or "17",
                settings.work_days or "1,2,3,4,5",
                settings.enabled_periods or "Itinerary,Day,Week,Work,SevenDay,Month,Year",
                settings.custom_days_count or "7",
                settings.all_view_start_hour or "0",
                settings.all_view_end_hour or "24",
                settings.day_scroll_to_hour or "5"
            )
        )
        conn.commit()
        return settings
    except Exception as e:
        logger.error(f"Error saving settings: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to save settings: {str(e)}")
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

        # Write updated .vcf file
        _write_vcf_file(contact_id, contact_dict)

        # Update SQLite row
        db_fields = _serialize_contact_for_db(contact)
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
        cursor.execute("SELECT id FROM contacts WHERE id = ?", (contact_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail=f"Contact {contact_id} not found")

        # Remove .vcf file from disk
        vcf_path = os.path.join(CONTACTS_DIR, f"{contact_id}.vcf")
        if os.path.exists(vcf_path):
            os.remove(vcf_path)

        # Delete SQLite row
        cursor.execute("DELETE FROM contacts WHERE id = ?", (contact_id,))
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
    """Upload a profile image for a contact. Stores in /static/contact_images/."""
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

        image_url = f"/static/contact_images/{filename}"

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
# Section 13: Health Check
# ═══════════════════════════════════════════════════════════════════════════

@app.get("/health")
def health_check():
    return {"status": "healthy"}
