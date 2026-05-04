"""Database helpers, shared state, and utility functions for the CWOC backend.

Defines DB_PATH, _update_lock, CONTACT_IMAGES_DIR constants and provides
init_db(), serialization helpers, display name computation, system tag
computation, instance ID management, export envelope building, and version
info helpers.
"""

import asyncio
import sqlite3
import json
import logging
import os
from datetime import datetime
from typing import Optional, List, Any
from uuid import uuid4


logger = logging.getLogger(__name__)

# Database path
DB_PATH = "/app/data/app.db"

# Lock to prevent concurrent update runs
_update_lock = asyncio.Lock()

# Create directory for contact images
CONTACT_IMAGES_DIR = "/app/data/contacts/profile_pictures/"
os.makedirs(CONTACT_IMAGES_DIR, exist_ok=True)

# Create directory for user profile images
USER_IMAGES_DIR = "/app/data/users/profile_pictures/"
os.makedirs(USER_IMAGES_DIR, exist_ok=True)


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
    if getattr(chit, 'email_message_id', None) or getattr(chit, 'email_status', None):
        system_tags.append("CWOC_System/Email")
        # Add email folder sub-tag
        email_folder = getattr(chit, 'email_folder', None)
        if email_folder == 'inbox':
            system_tags.append("CWOC_System/Email/Inbox")
        elif email_folder == 'sent':
            system_tags.append("CWOC_System/Email/Sent")
        elif email_folder == 'drafts':
            system_tags.append("CWOC_System/Email/Drafts")
        elif email_folder == 'trash':
            system_tags.append("CWOC_System/Email/Trash")
        # Add email status sub-tag for drafts without a folder yet
        email_status = getattr(chit, 'email_status', None)
        if email_status == 'draft' and email_folder != 'drafts':
            system_tags.append("CWOC_System/Email/Drafts")
    # Habit auto-tags
    if getattr(chit, 'habit', False):
        system_tags.append("Habits")
        title = getattr(chit, 'title', None)
        if title:
            system_tags.append(f"Habits/{title}")
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
    Reads VERSION from /app/src/VERSION (production) or project-root VERSION (dev).
    """
    version = "unknown"
    for path in ["/app/src/VERSION", os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "VERSION")]:
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
    """At startup, always sync version from /app/src/VERSION into the database."""
    # Import here to avoid circular imports — audit helpers live in routes.audit
    from src.backend.routes.audit import get_current_actor, insert_audit_entry

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
        # Update installed_datetime when version changes
        if old_version is not None and old_version != version:
            cursor.execute(
                "INSERT INTO instance_meta (key, value) VALUES ('installed_datetime', ?) "
                "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
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
