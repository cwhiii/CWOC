"""Database migration functions for the CWOC backend.

All migrate_* functions and init_contacts_table() live here.
Each migration checks if the column/table already exists before making changes.
Migrations are called sequentially at startup from main.py.
"""

import logging
import os
import re
import sqlite3

from uuid import uuid4

from src.backend.db import DB_PATH, serialize_json_field, deserialize_json_field


logger = logging.getLogger(__name__)


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


# ── Audit Log: migration ─────────────────────────────────────────────────

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


def migrate_add_log_limits():
    """Add log_max_days and log_max_mb columns to settings table for client/update log pruning."""
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(settings)")
        existing = {row[1] for row in cursor.fetchall()}
        if "log_max_days" not in existing:
            cursor.execute("ALTER TABLE settings ADD COLUMN log_max_days INTEGER DEFAULT 30")
        if "log_max_mb" not in existing:
            cursor.execute("ALTER TABLE settings ADD COLUMN log_max_mb REAL DEFAULT 5.0")
        conn.commit()
        logger.info("Log limits columns ready")
    except Exception as e:
        logger.error(f"Error adding log limits columns: {str(e)}")
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


def migrate_add_habits_fields():
    """Add hide_when_instance_done column to chits and habits_success_window column to settings."""
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(chits)")
        chit_columns = {row[1] for row in cursor.fetchall()}
        if "hide_when_instance_done" not in chit_columns:
            cursor.execute("ALTER TABLE chits ADD COLUMN hide_when_instance_done INTEGER DEFAULT 0")
            logger.info("Added hide_when_instance_done column to chits table")
        cursor.execute("PRAGMA table_info(settings)")
        settings_columns = {row[1] for row in cursor.fetchall()}
        if "habits_success_window" not in settings_columns:
            cursor.execute("ALTER TABLE settings ADD COLUMN habits_success_window TEXT DEFAULT '30'")
            logger.info("Added habits_success_window column to settings table")
        conn.commit()
    except Exception as e:
        logger.error(f"Error adding habits fields: {str(e)}")
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


def migrate_add_border_color_settings():
    """Add overdue_border_color and blocked_border_color columns to settings table."""
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(settings)")
        existing = {row[1] for row in cursor.fetchall()}
        if "overdue_border_color" not in existing:
            cursor.execute("ALTER TABLE settings ADD COLUMN overdue_border_color TEXT DEFAULT '#b22222'")
            logger.info("Added overdue_border_color column to settings table")
        if "blocked_border_color" not in existing:
            cursor.execute("ALTER TABLE settings ADD COLUMN blocked_border_color TEXT DEFAULT '#DAA520'")
            logger.info("Added blocked_border_color column to settings table")
        conn.commit()
    except Exception as e:
        logger.error(f"Error adding border color settings columns: {str(e)}")
    finally:
        if conn:
            conn.close()


# ── Multi-User System: migration ─────────────────────────────────────────

def migrate_add_multi_user():
    """Create users/sessions tables, default admin account, and add ownership
    columns to chits/contacts. Assigns all existing data to the admin user.

    Fully idempotent — safe to run multiple times. Every step checks for
    table/column existence before making changes.
    """
    import uuid
    from datetime import datetime
    from src.backend.auth_utils import hash_password

    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # ── 1. Create users table ────────────────────────────────────────
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT NOT NULL UNIQUE,
                display_name TEXT NOT NULL,
                email TEXT,
                password_hash TEXT NOT NULL,
                is_admin BOOLEAN DEFAULT 0,
                is_active BOOLEAN DEFAULT 1,
                created_datetime TEXT NOT NULL,
                modified_datetime TEXT NOT NULL
            )
        """)

        # ── 2. Create sessions table ─────────────────────────────────────
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                token TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                created_datetime TEXT NOT NULL,
                expires_datetime TEXT NOT NULL,
                last_active_datetime TEXT NOT NULL
            )
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_sessions_user
            ON sessions (user_id)
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_sessions_expires
            ON sessions (expires_datetime)
        """)

        # ── 3. Create default admin user (if not already present) ────────
        cursor.execute("SELECT id FROM users WHERE username = 'admin'")
        admin_row = cursor.fetchone()

        if admin_row:
            admin_id = admin_row[0]
        else:
            admin_id = str(uuid.uuid4())
            now = datetime.utcnow().isoformat() + "Z"

            # Try to read display name from existing settings for default_user
            display_name = "Admin"
            try:
                cursor.execute(
                    "SELECT username FROM settings WHERE user_id = 'default_user'"
                )
                settings_row = cursor.fetchone()
                if settings_row and settings_row[0] and settings_row[0].strip():
                    display_name = settings_row[0].strip()
            except Exception:
                pass

            password_hash = hash_password("cwoc")

            cursor.execute(
                """INSERT INTO users
                   (id, username, display_name, email, password_hash,
                    is_admin, is_active, created_datetime, modified_datetime)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (admin_id, "admin", display_name, None, password_hash,
                 1, 1, now, now),
            )
            logger.info("Created default admin user (username='admin')")

        # ── 4. Add owner columns to chits table ─────────────────────────
        cursor.execute("PRAGMA table_info(chits)")
        chit_columns = {row[1] for row in cursor.fetchall()}

        if "owner_id" not in chit_columns:
            cursor.execute("ALTER TABLE chits ADD COLUMN owner_id TEXT")
            logger.info("Added owner_id column to chits table")
        if "owner_display_name" not in chit_columns:
            cursor.execute("ALTER TABLE chits ADD COLUMN owner_display_name TEXT")
            logger.info("Added owner_display_name column to chits table")
        if "owner_username" not in chit_columns:
            cursor.execute("ALTER TABLE chits ADD COLUMN owner_username TEXT")
            logger.info("Added owner_username column to chits table")

        # ── 5. Assign existing chits to admin ────────────────────────────
        # Read admin display_name and username for populating owner fields
        cursor.execute(
            "SELECT display_name, username FROM users WHERE id = ?", (admin_id,)
        )
        admin_info = cursor.fetchone()
        admin_display = admin_info[0] if admin_info else "Admin"
        admin_username = admin_info[1] if admin_info else "admin"

        cursor.execute(
            """UPDATE chits
               SET owner_id = ?, owner_display_name = ?, owner_username = ?
               WHERE owner_id IS NULL""",
            (admin_id, admin_display, admin_username),
        )

        # ── 6. Add owner_id column to contacts table ────────────────────
        cursor.execute("PRAGMA table_info(contacts)")
        contact_columns = {row[1] for row in cursor.fetchall()}

        if "owner_id" not in contact_columns:
            cursor.execute("ALTER TABLE contacts ADD COLUMN owner_id TEXT")
            logger.info("Added owner_id column to contacts table")

        # ── 7. Assign existing contacts to admin ─────────────────────────
        cursor.execute(
            "UPDATE contacts SET owner_id = ? WHERE owner_id IS NULL",
            (admin_id,),
        )

        # ── 8. Re-key settings from 'default_user' to admin UUID ────────
        cursor.execute(
            "UPDATE settings SET user_id = ? WHERE user_id = 'default_user'",
            (admin_id,),
        )

        conn.commit()
        logger.info("Multi-user migration complete")
    except Exception as e:
        logger.error(f"Error in migrate_add_multi_user: {str(e)}")
        raise
    finally:
        if conn:
            conn.close()


# ── User Profile Image: migration ────────────────────────────────────────

def migrate_add_user_profile_image():
    """Add profile_image_url column to users table if it doesn't exist."""
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # Check if column already exists
        cols = [row[1] for row in cursor.execute("PRAGMA table_info(users)").fetchall()]
        if "profile_image_url" not in cols:
            cursor.execute("ALTER TABLE users ADD COLUMN profile_image_url TEXT")
            logger.info("Added profile_image_url column to users table")

        conn.commit()
    except Exception as e:
        logger.error(f"Error in migrate_add_user_profile_image: {str(e)}")
        raise
    finally:
        if conn:
            conn.close()


# ── Standalone alerts & alert state: add owner_id ────────────────────────

def migrate_add_alerts_owner_id():
    """Add owner_id column to standalone_alerts and alert_state tables,
    and assign existing rows to the default admin user."""
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # ── standalone_alerts ──
        cols = [row[1] for row in cursor.execute("PRAGMA table_info(standalone_alerts)").fetchall()]
        if "owner_id" not in cols:
            cursor.execute("ALTER TABLE standalone_alerts ADD COLUMN owner_id TEXT")
            # Assign existing alerts to the first admin user
            admin_row = cursor.execute(
                "SELECT id FROM users WHERE is_admin = 1 AND is_active = 1 ORDER BY created_datetime ASC LIMIT 1"
            ).fetchone()
            if admin_row:
                cursor.execute("UPDATE standalone_alerts SET owner_id = ? WHERE owner_id IS NULL", (admin_row[0],))
            logger.info("Added owner_id column to standalone_alerts table")

        # ── alert_state ──
        cols2 = [row[1] for row in cursor.execute("PRAGMA table_info(alert_state)").fetchall()]
        if "owner_id" not in cols2:
            cursor.execute("ALTER TABLE alert_state ADD COLUMN owner_id TEXT")
            if admin_row:
                cursor.execute("UPDATE alert_state SET owner_id = ? WHERE owner_id IS NULL", (admin_row[0],))
            logger.info("Added owner_id column to alert_state table")

        conn.commit()
    except Exception as e:
        logger.error(f"Error in migrate_add_alerts_owner_id: {str(e)}")
        raise
    finally:
        if conn:
            conn.close()


# ── Login welcome message table ──────────────────────────────────────────

def migrate_add_login_message():
    """Create login_message table for storing the instance login welcome message."""
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS login_message (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                message TEXT DEFAULT '',
                modified_datetime TEXT
            )
        """)
        # Ensure the single row exists
        cursor.execute("INSERT OR IGNORE INTO login_message (id, message) VALUES (1, '')")
        conn.commit()
        logger.info("login_message table ready")
    except Exception as e:
        logger.error(f"Error in migrate_add_login_message: {str(e)}")
        raise
    finally:
        if conn:
            conn.close()


# ── Login message: add instance_name column ──────────────────────────────

def migrate_add_instance_name():
    """Add instance_name column to login_message table."""
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cols = [row[1] for row in cursor.execute("PRAGMA table_info(login_message)").fetchall()]
        if "instance_name" not in cols:
            cursor.execute("ALTER TABLE login_message ADD COLUMN instance_name TEXT DEFAULT ''")
            logger.info("Added instance_name column to login_message table")
        conn.commit()
    except Exception as e:
        logger.error(f"Error in migrate_add_instance_name: {str(e)}")
        raise
    finally:
        if conn:
            conn.close()


# ── Chit Sharing System: migration ──────────────────────────────────────

def migrate_add_sharing():
    """Add sharing columns to chits and settings tables.

    Adds to chits: shares (TEXT), stealth (BOOLEAN DEFAULT 0), assigned_to (TEXT).
    Adds to settings: shared_tags (TEXT).

    Fully idempotent — safe to run multiple times. Each column is checked
    for existence before being added.
    """
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # ── chits table ──────────────────────────────────────────────────
        cursor.execute("PRAGMA table_info(chits)")
        chit_cols = {row[1] for row in cursor.fetchall()}

        if "shares" not in chit_cols:
            cursor.execute("ALTER TABLE chits ADD COLUMN shares TEXT")
            logger.info("Added shares column to chits table")
        if "stealth" not in chit_cols:
            cursor.execute("ALTER TABLE chits ADD COLUMN stealth BOOLEAN DEFAULT 0")
            logger.info("Added stealth column to chits table")
        if "assigned_to" not in chit_cols:
            cursor.execute("ALTER TABLE chits ADD COLUMN assigned_to TEXT")
            logger.info("Added assigned_to column to chits table")

        # ── settings table ───────────────────────────────────────────────
        cursor.execute("PRAGMA table_info(settings)")
        settings_cols = {row[1] for row in cursor.fetchall()}

        if "shared_tags" not in settings_cols:
            cursor.execute("ALTER TABLE settings ADD COLUMN shared_tags TEXT")
            logger.info("Added shared_tags column to settings table")

        conn.commit()
        logger.info("Sharing migration complete")
    except Exception as e:
        logger.error(f"Error in migrate_add_sharing: {str(e)}")
        raise
    finally:
        if conn:
            conn.close()


# ── Kiosk Users: migration ───────────────────────────────────────────────

def migrate_add_kiosk_users():
    """Add kiosk_users column to settings table.

    Stores a JSON array of usernames selected for the kiosk view.
    Fully idempotent — safe to run multiple times.
    """
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        cursor.execute("PRAGMA table_info(settings)")
        settings_cols = {row[1] for row in cursor.fetchall()}

        if "kiosk_users" not in settings_cols:
            cursor.execute("ALTER TABLE settings ADD COLUMN kiosk_users TEXT")
            logger.info("Added kiosk_users column to settings table")

        conn.commit()
        logger.info("Kiosk users migration complete")
    except Exception as e:
        logger.error(f"Error in migrate_add_kiosk_users: {str(e)}")
        raise
    finally:
        if conn:
            conn.close()


# ── Hide Declined Setting: migration ─────────────────────────────────────

def migrate_add_hide_declined():
    """Add hide_declined column to settings table.

    Stores '0' (show declined chits with faded treatment) or '1' (hide them entirely).
    Fully idempotent — safe to run multiple times.
    """
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        cursor.execute("PRAGMA table_info(settings)")
        settings_cols = {row[1] for row in cursor.fetchall()}

        if "hide_declined" not in settings_cols:
            cursor.execute("ALTER TABLE settings ADD COLUMN hide_declined TEXT DEFAULT '0'")
            logger.info("Added hide_declined column to settings table")

        conn.commit()
        logger.info("Hide declined migration complete")
    except Exception as e:
        logger.error(f"Error in migrate_add_hide_declined: {str(e)}")
        raise
    finally:
        if conn:
            conn.close()


# ── Network Access: migration ────────────────────────────────────────────

def migrate_add_network_access():
    """Create network_access table for storing network provider configurations."""
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS network_access (
                id TEXT PRIMARY KEY,
                provider TEXT NOT NULL UNIQUE,
                enabled BOOLEAN DEFAULT 0,
                config TEXT,
                created_datetime TEXT,
                modified_datetime TEXT
            )
        """)
        conn.commit()
        logger.info("network_access table ready")
    except Exception as e:
        logger.error(f"Error creating network_access table: {str(e)}")
    finally:
        if conn:
            conn.close()


# ── Notifications Table: migration ───────────────────────────────────────

def migrate_add_notifications():
    """Create notifications table for the sharing notification system.

    Stores notification records when chits are shared with users via
    invite or assign actions. Each notification tracks the chit, owner,
    type (invited/assigned), and status (pending/accepted/declined).

    Fully idempotent — uses CREATE TABLE IF NOT EXISTS and
    CREATE INDEX IF NOT EXISTS.
    """
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS notifications (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                chit_id TEXT NOT NULL,
                chit_title TEXT,
                owner_display_name TEXT,
                notification_type TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                created_datetime TEXT NOT NULL
            )
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_notifications_user_id
            ON notifications (user_id)
        """)

        conn.commit()
        logger.info("notifications table and indexes ready")
    except Exception as e:
        logger.error(f"Error creating notifications table: {str(e)}")
        raise
    finally:
        if conn:
            conn.close()


# ── User Profile Fields: migration ───────────────────────────────────────

def migrate_add_user_profile_fields():
    """Add contact-like profile fields to the users table.

    Adds all fields that contacts have, stored as JSON strings where applicable.
    Fully idempotent — checks column existence before adding.
    """
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        cols = [row[1] for row in cursor.execute("PRAGMA table_info(users)").fetchall()]

        new_cols = [
            ("phones", "TEXT"),
            ("emails_json", "TEXT"),       # 'emails_json' to avoid conflict with existing 'email' column
            ("addresses", "TEXT"),
            ("call_signs", "TEXT"),
            ("x_handles", "TEXT"),
            ("websites", "TEXT"),
            ("organization", "TEXT"),
            ("social_context", "TEXT"),
            ("notes", "TEXT"),
            ("nickname", "TEXT"),
            ("given_name", "TEXT"),
            ("surname", "TEXT"),
            ("middle_names", "TEXT"),
            ("prefix", "TEXT"),
            ("suffix", "TEXT"),
            ("has_signal", "INTEGER DEFAULT 0"),
            ("signal_username", "TEXT"),
            ("pgp_key", "TEXT"),
            ("color", "TEXT"),
            ("tags", "TEXT"),
        ]

        for col_name, col_type in new_cols:
            if col_name not in cols:
                cursor.execute(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}")
                logger.info(f"Added {col_name} column to users table")

        conn.commit()
    except Exception as e:
        logger.error(f"Error in migrate_add_user_profile_fields: {str(e)}")
        raise
    finally:
        if conn:
            conn.close()


# ── Habits Overhaul: migration ───────────────────────────────────────────

def migrate_habits_overhaul():
    """Add habit fields to chits, add setting, remove hide_when_instance_done via table rebuild.

    Steps:
    1. Add habit (BOOLEAN DEFAULT 0), habit_goal (INTEGER DEFAULT 1),
       habit_success (INTEGER DEFAULT 0), show_on_calendar (BOOLEAN DEFAULT 1)
       columns to chits (with existence checks).
    2. Add default_show_habits_on_calendar (TEXT DEFAULT '1') column to settings.
    3. Remove hide_when_instance_done column via table rebuild:
       - Read current columns from PRAGMA table_info
       - Create chits_backup with all columns except hide_when_instance_done
       - Copy data from chits to chits_backup
       - Drop chits
       - Rename chits_backup to chits

    Fully idempotent — safe to run multiple times.
    """
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # ── Step 1: Add new habit columns to chits ───────────────────────
        cursor.execute("PRAGMA table_info(chits)")
        chit_cols = {row[1] for row in cursor.fetchall()}

        if "habit" not in chit_cols:
            cursor.execute("ALTER TABLE chits ADD COLUMN habit BOOLEAN DEFAULT 0")
            logger.info("Added habit column to chits table")
        if "habit_goal" not in chit_cols:
            cursor.execute("ALTER TABLE chits ADD COLUMN habit_goal INTEGER DEFAULT 1")
            logger.info("Added habit_goal column to chits table")
        if "habit_success" not in chit_cols:
            cursor.execute("ALTER TABLE chits ADD COLUMN habit_success INTEGER DEFAULT 0")
            logger.info("Added habit_success column to chits table")
        if "show_on_calendar" not in chit_cols:
            cursor.execute("ALTER TABLE chits ADD COLUMN show_on_calendar BOOLEAN DEFAULT 1")
            logger.info("Added show_on_calendar column to chits table")

        # ── Step 2: Add default_show_habits_on_calendar to settings ──────
        cursor.execute("PRAGMA table_info(settings)")
        settings_cols = {row[1] for row in cursor.fetchall()}

        if "default_show_habits_on_calendar" not in settings_cols:
            cursor.execute("ALTER TABLE settings ADD COLUMN default_show_habits_on_calendar TEXT DEFAULT '1'")
            logger.info("Added default_show_habits_on_calendar column to settings table")

        # ── Step 3: Remove hide_when_instance_done via table rebuild ─────
        # Re-read columns after potential additions above
        cursor.execute("PRAGMA table_info(chits)")
        all_col_info = cursor.fetchall()
        all_col_names = [row[1] for row in all_col_info]

        if "hide_when_instance_done" in all_col_names:
            # Build column list without hide_when_instance_done
            keep_cols = [row for row in all_col_info if row[1] != "hide_when_instance_done"]
            keep_col_names = [row[1] for row in keep_cols]
            col_names_csv = ", ".join(keep_col_names)

            # Build CREATE TABLE statement for backup
            col_defs = []
            for row in keep_cols:
                # row: (cid, name, type, notnull, dflt_value, pk)
                cid, name, col_type, notnull, dflt_value, pk = row
                parts = [name, col_type if col_type else "TEXT"]
                if pk:
                    parts.append("PRIMARY KEY")
                if notnull and not pk:
                    parts.append("NOT NULL")
                if dflt_value is not None:
                    parts.append(f"DEFAULT {dflt_value}")
                col_defs.append(" ".join(parts))

            create_sql = f"CREATE TABLE chits_backup ({', '.join(col_defs)})"

            # Execute the rebuild inside a transaction
            cursor.execute(create_sql)
            cursor.execute(f"INSERT INTO chits_backup ({col_names_csv}) SELECT {col_names_csv} FROM chits")
            cursor.execute("DROP TABLE chits")
            cursor.execute("ALTER TABLE chits_backup RENAME TO chits")
            logger.info("Removed hide_when_instance_done column from chits table via table rebuild")

        conn.commit()
        logger.info("Habits overhaul migration complete")
    except Exception as e:
        logger.error(f"Error in migrate_habits_overhaul: {str(e)}")
        raise
    finally:
        if conn:
            conn.close()


# ── Habits Phase 2: reset period, hide overall, perpetual ────────────────

def migrate_habits_phase2():
    """Add habit_reset_period, habit_last_action_date, habit_hide_overall, perpetual to chits.

    Fully idempotent — safe to run multiple times.
    """
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        cursor.execute("PRAGMA table_info(chits)")
        chit_cols = {row[1] for row in cursor.fetchall()}

        if "habit_reset_period" not in chit_cols:
            cursor.execute("ALTER TABLE chits ADD COLUMN habit_reset_period TEXT DEFAULT NULL")
            logger.info("Added habit_reset_period column to chits table")
        if "habit_last_action_date" not in chit_cols:
            cursor.execute("ALTER TABLE chits ADD COLUMN habit_last_action_date TEXT DEFAULT NULL")
            logger.info("Added habit_last_action_date column to chits table")
        if "habit_hide_overall" not in chit_cols:
            cursor.execute("ALTER TABLE chits ADD COLUMN habit_hide_overall BOOLEAN DEFAULT 0")
            logger.info("Added habit_hide_overall column to chits table")
        if "perpetual" not in chit_cols:
            cursor.execute("ALTER TABLE chits ADD COLUMN perpetual BOOLEAN DEFAULT 0")
            logger.info("Added perpetual column to chits table")

        conn.commit()
        logger.info("Habits phase 2 migration complete")
    except Exception as e:
        logger.error(f"Error in migrate_habits_phase2: {str(e)}")
        raise
    finally:
        if conn:
            conn.close()


# ── Push Notifications: migrations ───────────────────────────────────────

def migrate_add_push_subscriptions():
    """Create push_subscriptions table for storing Web Push subscription objects.

    Each row represents one browser/device subscription for a user.
    Uses CREATE TABLE IF NOT EXISTS for idempotency.
    """
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS push_subscriptions (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                endpoint TEXT NOT NULL UNIQUE,
                p256dh TEXT NOT NULL,
                auth TEXT NOT NULL,
                device_label TEXT,
                created_datetime TEXT NOT NULL
            )
        """)
        conn.commit()
        logger.info("push_subscriptions table ready")
    except Exception as e:
        logger.error(f"Error creating push_subscriptions table: {str(e)}")
        raise
    finally:
        if conn:
            conn.close()


def migrate_add_vapid_keys():
    """Ensure instance_meta table exists for storing VAPID key pair.

    The instance_meta table is a generic key-value store that already exists
    (created in db.py for instance_id/version tracking). This migration
    ensures it's present so VAPID keys can be stored as rows:
      - key='vapid_public_key',  value=<base64url-encoded public key>
      - key='vapid_private_key', value=<base64url-encoded private key>

    Uses CREATE TABLE IF NOT EXISTS for idempotency.
    """
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS instance_meta (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )
        """)
        conn.commit()
        logger.info("instance_meta table ready (for VAPID keys)")
    except Exception as e:
        logger.error(f"Error ensuring instance_meta table: {str(e)}")
        raise
    finally:
        if conn:
            conn.close()


# ── Running Timers: server-side tracking for Ntfy notifications ──────────

def migrate_add_running_timers():
    """Create running_timers table for tracking active timer countdowns.

    When a user starts a timer (chit or independent), the browser POSTs
    the expected end timestamp. The server's alert loop checks this table
    and sends Ntfy notifications when timers expire.

    Uses CREATE TABLE IF NOT EXISTS for idempotency.
    """
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS running_timers (
                id TEXT PRIMARY KEY,
                owner_id TEXT NOT NULL,
                source_type TEXT NOT NULL,
                source_id TEXT NOT NULL,
                alert_index INTEGER,
                end_ts TEXT NOT NULL,
                name TEXT,
                created_datetime TEXT NOT NULL
            )
        """)
        conn.commit()
        logger.info("running_timers table ready")
    except Exception as e:
        logger.error(f"Error creating running_timers table: {str(e)}")
        raise
    finally:
        if conn:
            conn.close()


# ── Contact Dates: migration ─────────────────────────────────────────────

def migrate_add_contact_dates():
    """Add 'dates' TEXT column to contacts table for multi-value date entries.

    Stores JSON array of {label, value} objects (e.g. Birthday, Anniversary).
    Fully idempotent — checks column existence before adding.
    """
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(contacts)")
        columns = {row[1] for row in cursor.fetchall()}
        if "dates" not in columns:
            cursor.execute("ALTER TABLE contacts ADD COLUMN dates TEXT")
            conn.commit()
            logger.info("Added dates column to contacts table")
    except Exception as e:
        logger.error(f"migrate_add_contact_dates: {e}")
    finally:
        if conn:
            conn.close()


# ── Map Settings: migration ──────────────────────────────────────────────

def migrate_add_map_settings():
    """Add map_default_lat, map_default_lon, map_default_zoom, map_auto_zoom columns to settings.

    Stores the user's preferred default map center, zoom level, and auto-zoom behavior.
    Fully idempotent — checks column existence before adding.
    """
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        cursor.execute("PRAGMA table_info(settings)")
        existing = {row[1] for row in cursor.fetchall()}

        if "map_default_lat" not in existing:
            cursor.execute("ALTER TABLE settings ADD COLUMN map_default_lat TEXT")
            logger.info("Added map_default_lat column to settings table")
        if "map_default_lon" not in existing:
            cursor.execute("ALTER TABLE settings ADD COLUMN map_default_lon TEXT")
            logger.info("Added map_default_lon column to settings table")
        if "map_default_zoom" not in existing:
            cursor.execute("ALTER TABLE settings ADD COLUMN map_default_zoom TEXT")
            logger.info("Added map_default_zoom column to settings table")
        if "map_auto_zoom" not in existing:
            cursor.execute("ALTER TABLE settings ADD COLUMN map_auto_zoom TEXT DEFAULT '1'")
            logger.info("Added map_auto_zoom column to settings table")

        conn.commit()
        logger.info("Map settings migration complete")
    except Exception as e:
        logger.error(f"Error adding map settings columns: {str(e)}")
        raise
    finally:
        if conn:
            conn.close()


# ── Email Integration: migration ─────────────────────────────────────────

def migrate_add_email_fields():
    """Add email columns to chits table and email_account to settings table.

    Adds 13 email columns to chits: email_message_id, email_from, email_to,
    email_cc, email_bcc, email_subject, email_body_text, email_date,
    email_folder, email_status, email_read, email_in_reply_to, email_references.

    Adds email_account (TEXT) column to settings table.

    Fully idempotent — checks column existence before adding.
    """
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # ── chits table ──────────────────────────────────────────────────
        cursor.execute("PRAGMA table_info(chits)")
        chit_cols = {row[1] for row in cursor.fetchall()}

        email_chit_columns = [
            ("email_message_id", "TEXT"),
            ("email_from", "TEXT"),
            ("email_to", "TEXT"),
            ("email_cc", "TEXT"),
            ("email_bcc", "TEXT"),
            ("email_subject", "TEXT"),
            ("email_body_text", "TEXT"),
            ("email_date", "TEXT"),
            ("email_folder", "TEXT"),
            ("email_status", "TEXT"),
            ("email_read", "BOOLEAN"),
            ("email_in_reply_to", "TEXT"),
            ("email_references", "TEXT"),
        ]

        for col_name, col_type in email_chit_columns:
            if col_name not in chit_cols:
                cursor.execute(f"ALTER TABLE chits ADD COLUMN {col_name} {col_type}")
                logger.info(f"Added {col_name} column to chits table")

        # ── settings table ───────────────────────────────────────────────
        cursor.execute("PRAGMA table_info(settings)")
        settings_cols = {row[1] for row in cursor.fetchall()}

        if "email_account" not in settings_cols:
            cursor.execute("ALTER TABLE settings ADD COLUMN email_account TEXT")
            logger.info("Added email_account column to settings table")

        conn.commit()
        logger.info("Email fields migration complete")
    except Exception as e:
        logger.error(f"Error in migrate_add_email_fields: {str(e)}")
        raise
    finally:
        if conn:
            conn.close()


# ── Attachments: migration ────────────────────────────────────────────────

def migrate_add_attachments():
    """Add attachments TEXT column to chits table and attachment_max_size_mb to settings.

    The attachments column stores a JSON array of attachment metadata objects:
    [{id, filename, size, mime_type, uploaded_at}]

    Fully idempotent — checks column existence before adding.
    """
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # ── chits table ──────────────────────────────────────────────────
        cursor.execute("PRAGMA table_info(chits)")
        chit_cols = {row[1] for row in cursor.fetchall()}

        if "attachments" not in chit_cols:
            cursor.execute("ALTER TABLE chits ADD COLUMN attachments TEXT")
            logger.info("Added attachments column to chits table")

        # ── settings table ───────────────────────────────────────────────
        cursor.execute("PRAGMA table_info(settings)")
        settings_cols = {row[1] for row in cursor.fetchall()}

        if "attachment_max_size_mb" not in settings_cols:
            cursor.execute("ALTER TABLE settings ADD COLUMN attachment_max_size_mb TEXT DEFAULT '10'")
            logger.info("Added attachment_max_size_mb column to settings table")

        if "attachment_max_storage_mb" not in settings_cols:
            cursor.execute("ALTER TABLE settings ADD COLUMN attachment_max_storage_mb TEXT DEFAULT '500'")
            logger.info("Added attachment_max_storage_mb column to settings table")

        conn.commit()
        logger.info("Attachments migration complete")
    except Exception as e:
        logger.error(f"Error in migrate_add_attachments: {str(e)}")
        raise
    finally:
        if conn:
            conn.close()


# ── HTML Email Body: migration ────────────────────────────────────────────

def migrate_add_email_body_html():
    """Add email_body_html TEXT column to chits table.

    Stores the HTML version of email bodies for rich rendering.

    Fully idempotent — checks column existence before adding.
    """
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        cursor.execute("PRAGMA table_info(chits)")
        chit_cols = {row[1] for row in cursor.fetchall()}

        if "email_body_html" not in chit_cols:
            cursor.execute("ALTER TABLE chits ADD COLUMN email_body_html TEXT")
            logger.info("Added email_body_html column to chits table")

        conn.commit()
        logger.info("Email body HTML migration complete")
    except Exception as e:
        logger.error(f"Error in migrate_add_email_body_html: {str(e)}")
        raise
    finally:
        if conn:
            conn.close()


# ── FTS5 Full-Text Search: migration ─────────────────────────────────────

def migrate_add_fts5():
    """Create FTS5 virtual table and triggers for full-text search on chits.

    Creates chits_fts virtual table indexing title, note, email_body_text,
    and email_subject. Adds INSERT/UPDATE/DELETE triggers to keep the FTS
    index in sync. Rebuilds the index from existing data.

    Fully idempotent — checks table existence before creating.
    """
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # Check if FTS table already exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='chits_fts'")
        if cursor.fetchone():
            logger.info("chits_fts table already exists, skipping FTS5 migration")
            conn.close()
            return        # Create FTS5 virtual table
        cursor.execute("""
            CREATE VIRTUAL TABLE IF NOT EXISTS chits_fts USING fts5(
                title, note, email_body_text, email_subject,
                content=chits, content_rowid=rowid
            )
        """)
        logger.info("Created chits_fts FTS5 virtual table")

        # Create triggers to keep FTS in sync
        # INSERT trigger
        cursor.execute("""
            CREATE TRIGGER IF NOT EXISTS chits_fts_insert AFTER INSERT ON chits BEGIN
                INSERT INTO chits_fts(rowid, title, note, email_body_text, email_subject)
                VALUES (new.rowid, new.title, new.note, new.email_body_text, new.email_subject);
            END
        """)

        # DELETE trigger
        cursor.execute("""
            CREATE TRIGGER IF NOT EXISTS chits_fts_delete AFTER DELETE ON chits BEGIN
                INSERT INTO chits_fts(chits_fts, rowid, title, note, email_body_text, email_subject)
                VALUES ('delete', old.rowid, old.title, old.note, old.email_body_text, old.email_subject);
            END
        """)

        # UPDATE trigger
        cursor.execute("""
            CREATE TRIGGER IF NOT EXISTS chits_fts_update AFTER UPDATE ON chits BEGIN
                INSERT INTO chits_fts(chits_fts, rowid, title, note, email_body_text, email_subject)
                VALUES ('delete', old.rowid, old.title, old.note, old.email_body_text, old.email_subject);
                INSERT INTO chits_fts(rowid, title, note, email_body_text, email_subject)
                VALUES (new.rowid, new.title, new.note, new.email_body_text, new.email_subject);
            END
        """)
        logger.info("Created FTS5 sync triggers")

        # Rebuild the FTS index from existing data
        cursor.execute("INSERT INTO chits_fts(chits_fts) VALUES('rebuild')")
        logger.info("Rebuilt FTS5 index from existing data")

        conn.commit()
        logger.info("FTS5 migration complete")
    except Exception as e:
        logger.error(f"Error in migrate_add_fts5: {str(e)}")
        # FTS5 may not be available in all SQLite builds — log but don't crash
        logger.warning("FTS5 migration failed — full-text search will fall back to LIKE queries")
    finally:
        if conn:
            conn.close()


# ── Shared Contact Vault: migration ──────────────────────────────────────

def migrate_add_contact_vault():
    """Add shared_to_vault column to contacts table and default_share_contacts to settings.

    shared_to_vault (BOOLEAN DEFAULT 0): when true, the contact is visible to all users.
    default_share_contacts (TEXT DEFAULT '1'): user preference for new contacts.

    Fully idempotent — checks column existence before adding.
    """
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # ── contacts table ───────────────────────────────────────────────
        cursor.execute("PRAGMA table_info(contacts)")
        contact_cols = {row[1] for row in cursor.fetchall()}

        if "shared_to_vault" not in contact_cols:
            cursor.execute("ALTER TABLE contacts ADD COLUMN shared_to_vault BOOLEAN DEFAULT 0")
            logger.info("Added shared_to_vault column to contacts table")

        # ── settings table ───────────────────────────────────────────────
        cursor.execute("PRAGMA table_info(settings)")
        settings_cols = {row[1] for row in cursor.fetchall()}

        if "default_share_contacts" not in settings_cols:
            cursor.execute("ALTER TABLE settings ADD COLUMN default_share_contacts TEXT DEFAULT '1'")
            logger.info("Added default_share_contacts column to settings table")

        conn.commit()
        logger.info("Contact vault migration complete")
    except Exception as e:
        logger.error(f"Error in migrate_add_contact_vault: {str(e)}")
        raise
    finally:
        if conn:
            conn.close()


# ── Contact Soft-Delete: migration ────────────────────────────────────────

def migrate_add_contact_soft_delete():
    """Add deleted and deleted_datetime columns to contacts table.

    deleted (BOOLEAN DEFAULT 0): soft-delete flag.
    deleted_datetime (TEXT): ISO timestamp of when the contact was deleted.

    Fully idempotent — checks column existence before adding.
    """
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        cursor.execute("PRAGMA table_info(contacts)")
        contact_cols = {row[1] for row in cursor.fetchall()}

        if "deleted" not in contact_cols:
            cursor.execute("ALTER TABLE contacts ADD COLUMN deleted BOOLEAN DEFAULT 0")
            logger.info("Added deleted column to contacts table")

        if "deleted_datetime" not in contact_cols:
            cursor.execute("ALTER TABLE contacts ADD COLUMN deleted_datetime TEXT")
            logger.info("Added deleted_datetime column to contacts table")

        conn.commit()
        logger.info("Contact soft-delete migration complete")
    except Exception as e:
        logger.error(f"Error in migrate_add_contact_soft_delete: {str(e)}")
        raise
    finally:
        if conn:
            conn.close()


# ── Rules Engine: migration ──────────────────────────────────────────────

def migrate_create_rules_tables():
    """Create rules, rule_confirmations, and rule_execution_log tables if they don't exist.

    The rules table stores user-defined automation rules with triggers,
    conditions (JSON condition tree), and actions (JSON array).

    The rule_confirmations table stores pending actions awaiting user approval
    when a rule has confirm_before_apply enabled.

    The rule_execution_log table records every rule evaluation for
    troubleshooting and audit purposes.

    Fully idempotent — uses CREATE TABLE IF NOT EXISTS.
    """
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS rules (
                id TEXT PRIMARY KEY,
                owner_id TEXT,
                name TEXT,
                description TEXT,
                enabled BOOLEAN DEFAULT 1,
                priority INTEGER DEFAULT 0,
                trigger_type TEXT,
                conditions TEXT,
                actions TEXT,
                confirm_before_apply BOOLEAN DEFAULT 1,
                schedule_config TEXT,
                created_datetime TEXT,
                modified_datetime TEXT,
                last_run_datetime TEXT,
                run_count INTEGER DEFAULT 0,
                last_run_result TEXT
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS rule_confirmations (
                id TEXT PRIMARY KEY,
                rule_id TEXT,
                rule_name TEXT,
                owner_id TEXT,
                action_description TEXT,
                action_data TEXT,
                target_entity_type TEXT,
                target_entity_id TEXT,
                created_datetime TEXT
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS rule_execution_log (
                id TEXT PRIMARY KEY,
                rule_id TEXT,
                owner_id TEXT,
                trigger_event TEXT,
                entities_evaluated INTEGER DEFAULT 0,
                entities_matched INTEGER DEFAULT 0,
                actions_executed INTEGER DEFAULT 0,
                actions_failed INTEGER DEFAULT 0,
                result_summary TEXT,
                executed_datetime TEXT
            )
        """)

        conn.commit()
        logger.info("Rules tables created/verified")
    except Exception as e:
        logger.error(f"Error creating rules tables: {str(e)}")
    finally:
        if conn:
            conn.close()


# ── Multi-Account Email: migration ───────────────────────────────────────

def migrate_add_email_accounts():
    """Add email_accounts column to settings and email_account_id to chits.

    email_accounts (TEXT) stores a JSON array of account objects, each with:
    {id, email, display_name, imap_host, imap_port, smtp_host, smtp_port,
     username, password_encrypted}

    email_account_id (TEXT) on chits tracks which account an email belongs to.

    Migrates existing email_account (single object) into email_accounts array.

    Fully idempotent — checks column existence before adding.
    """
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # ── settings table: add email_accounts column ────────────────────
        cursor.execute("PRAGMA table_info(settings)")
        settings_cols = {row[1] for row in cursor.fetchall()}

        if "email_accounts" not in settings_cols:
            cursor.execute("ALTER TABLE settings ADD COLUMN email_accounts TEXT")
            logger.info("Added email_accounts column to settings table")

            # Migrate existing email_account → email_accounts array
            cursor.execute("SELECT user_id, email_account FROM settings WHERE email_account IS NOT NULL AND email_account != ''")
            rows = cursor.fetchall()
            for user_id, old_acct_json in rows:
                try:
                    import json as _json
                    old_acct = _json.loads(old_acct_json) if isinstance(old_acct_json, str) else old_acct_json
                    if isinstance(old_acct, dict) and old_acct.get("email"):
                        # Assign a stable ID to the migrated account
                        old_acct["id"] = str(uuid4())
                        new_accounts = [old_acct]
                        cursor.execute(
                            "UPDATE settings SET email_accounts = ? WHERE user_id = ?",
                            (_json.dumps(new_accounts), user_id)
                        )
                        logger.info(f"Migrated email_account to email_accounts for user {user_id}")
                except Exception as e:
                    logger.warning(f"Failed to migrate email_account for user {user_id}: {e}")

        # ── chits table: add email_account_id column ─────────────────────
        cursor.execute("PRAGMA table_info(chits)")
        chit_cols = {row[1] for row in cursor.fetchall()}

        if "email_account_id" not in chit_cols:
            cursor.execute("ALTER TABLE chits ADD COLUMN email_account_id TEXT")
            logger.info("Added email_account_id column to chits table")

        conn.commit()
        logger.info("Multi-account email migration complete")
    except Exception as e:
        logger.error(f"Error in migrate_add_email_accounts: {str(e)}")
    finally:
        if conn:
            conn.close()


# ── Availability (Busy/Free) field: migration ────────────────────────────

def migrate_add_availability():
    """Add availability TEXT column to chits table.

    Stores "busy", "free", or NULL (unset / "-").
    Used for calendar availability display and iCal export.

    Fully idempotent — checks column existence before adding.
    """
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        cursor.execute("PRAGMA table_info(chits)")
        columns = {row[1] for row in cursor.fetchall()}

        if "availability" not in columns:
            cursor.execute("ALTER TABLE chits ADD COLUMN availability TEXT")
            conn.commit()
            logger.info("Added availability column to chits table")
    except Exception as e:
        logger.error(f"Error in migrate_add_availability: {str(e)}")
    finally:
        if conn:
            conn.close()

# ── Home Assistant Integration: migration ────────────────────────────────

def migrate_create_ha_config():
    """Create ha_config table for instance-wide Home Assistant connection settings.

    Single-row table (enforced by CHECK id=1) storing the HA base URL,
    encrypted access token, auto-generated webhook secret, poll interval,
    and the admin user who configured it.

    Inserts the default row with a generated UUID webhook secret on first run.

    Fully idempotent — uses CREATE TABLE IF NOT EXISTS and INSERT OR IGNORE.
    """
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS ha_config (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                ha_base_url TEXT,
                ha_access_token TEXT,
                ha_webhook_secret TEXT,
                ha_poll_interval INTEGER DEFAULT 30,
                configured_by TEXT,
                modified_datetime TEXT
            )
        """)
        # Ensure the single row exists with an auto-generated webhook secret
        cursor.execute(
            "INSERT OR IGNORE INTO ha_config (id, ha_webhook_secret) VALUES (1, ?)",
            (str(uuid4()),)
        )
        conn.commit()
        logger.info("ha_config table ready")
    except Exception as e:
        logger.error(f"Error in migrate_create_ha_config: {str(e)}")
        raise
    finally:
        if conn:
            conn.close()


# ── Checklist Autosave: migration ────────────────────────────────────────

def migrate_add_checklist_autosave():
    """Add checklist_autosave column to settings and chits tables.

    Settings: TEXT default '1' (enabled by default).
    Chits: TEXT (per-chit override, NULL = use global setting).
    """
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # Settings table
        cursor.execute("PRAGMA table_info(settings)")
        settings_cols = [col[1] for col in cursor.fetchall()]
        if "checklist_autosave" not in settings_cols:
            cursor.execute("ALTER TABLE settings ADD COLUMN checklist_autosave TEXT DEFAULT '1'")
            logger.info("Added checklist_autosave column to settings table")

        # Chits table
        cursor.execute("PRAGMA table_info(chits)")
        chits_cols = [col[1] for col in cursor.fetchall()]
        if "checklist_autosave" not in chits_cols:
            cursor.execute("ALTER TABLE chits ADD COLUMN checklist_autosave TEXT")
            logger.info("Added checklist_autosave column to chits table")

        conn.commit()
    except Exception as e:
        logger.error(f"Error in migrate_add_checklist_autosave: {str(e)}")
        raise
    finally:
        if conn:
            conn.close()


# ── View Order: migration ────────────────────────────────────────────────

def migrate_add_view_order():
    """Add view_order column to settings table.

    Stores a JSON array of tab names in the user's preferred order,
    e.g. '["Calendar","Checklists","Tasks","Projects","Notes","Email","Indicators","Alarms"]'
    NULL means use the default order.
    """
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        cursor.execute("PRAGMA table_info(settings)")
        settings_cols = [col[1] for col in cursor.fetchall()]
        if "view_order" not in settings_cols:
            cursor.execute("ALTER TABLE settings ADD COLUMN view_order TEXT")
            logger.info("Added view_order column to settings table")

        conn.commit()
    except Exception as e:
        logger.error(f"Error in migrate_add_view_order: {str(e)}")
        raise
    finally:
        if conn:
            conn.close()


# ── Recent Tags: migration ───────────────────────────────────────────────

def migrate_add_recent_tags():
    """Add recent_tags column to settings table.

    Stores a JSON array of recently used tag paths, persisted across sessions/devices.
    """
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        cursor.execute("PRAGMA table_info(settings)")
        settings_cols = [col[1] for col in cursor.fetchall()]
        if "recent_tags" not in settings_cols:
            cursor.execute("ALTER TABLE settings ADD COLUMN recent_tags TEXT")
            logger.info("Added recent_tags column to settings table")

        conn.commit()
    except Exception as e:
        logger.error(f"Error in migrate_add_recent_tags: {str(e)}")
        raise
    finally:
        if conn:
            conn.close()

# ── Paginate Email: migration ────────────────────────────────────────────

def migrate_add_paginate_email():
    """Add paginate_email column to settings table.

    When '1', the email dashboard view loads 50 messages at a time with a
    'Load More' button instead of rendering all at once.
    """
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        cursor.execute("PRAGMA table_info(settings)")
        settings_cols = [col[1] for col in cursor.fetchall()]
        if "paginate_email" not in settings_cols:
            cursor.execute("ALTER TABLE settings ADD COLUMN paginate_email TEXT DEFAULT '0'")
            logger.info("Added paginate_email column to settings table")

        conn.commit()
    except Exception as e:
        logger.error(f"Error in migrate_add_paginate_email: {str(e)}")
        raise
    finally:
        if conn:
            conn.close()


def migrate_fix_double_encoded_attachments():
    """Fix attachments fields that were double-encoded by serialize_json_field.

    When a chit with attachments was updated via PUT, the attachments string
    was passed through json.dumps() again, wrapping it in extra quotes/escaping.
    This migration detects and unwraps any double-encoded values.
    """
    import json
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        cursor.execute("SELECT id, attachments FROM chits WHERE attachments IS NOT NULL AND attachments != ''")
        rows = cursor.fetchall()
        fixed = 0
        for chit_id, att_raw in rows:
            if not att_raw:
                continue
            # Try to detect double-encoding: if parsing gives a string instead of a list,
            # it's been double-encoded. Keep unwrapping until we get a list or give up.
            value = att_raw
            unwrap_count = 0
            while isinstance(value, str) and unwrap_count < 5:
                try:
                    parsed = json.loads(value)
                    if isinstance(parsed, list):
                        # Got the actual array — check if we needed to unwrap
                        if unwrap_count > 0:
                            # The original DB value was double-encoded; save the clean version
                            cursor.execute("UPDATE chits SET attachments = ? WHERE id = ?", (value, chit_id))
                            fixed += 1
                        break
                    elif isinstance(parsed, str):
                        # Still a string after parsing — double-encoded, unwrap further
                        value = parsed
                        unwrap_count += 1
                    else:
                        break  # unexpected type
                except (json.JSONDecodeError, ValueError):
                    break  # not valid JSON, leave as-is

        if fixed > 0:
            conn.commit()
            logger.info(f"Fixed {fixed} double-encoded attachments fields")
        else:
            logger.info("No double-encoded attachments found")
    except Exception as e:
        logger.error(f"Error in migrate_fix_double_encoded_attachments: {str(e)}")
    finally:
        if conn:
            conn.close()

# ── Email Bundles: migration ─────────────────────────────────────────────

def migrate_create_bundles_tables():
    """Create bundles and bundle_rules tables if they don't exist.
    Also adds bundles_multi_placement column to settings table.

    The bundles table stores user-defined email bundle categories with
    display properties (name, description, order, removability).

    The bundle_rules junction table links bundles to their classification
    rules in the rules table.

    Fully idempotent — uses CREATE TABLE IF NOT EXISTS and PRAGMA table_info checks.
    """
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # ── Create bundles table ─────────────────────────────────────────
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS bundles (
                id TEXT PRIMARY KEY,
                owner_id TEXT,
                name TEXT,
                description TEXT,
                color TEXT,
                display_order INTEGER DEFAULT 0,
                is_default BOOLEAN DEFAULT 0,
                removable BOOLEAN DEFAULT 1,
                created_datetime TEXT,
                modified_datetime TEXT
            )
        """)

        # ── Create bundle_rules junction table ───────────────────────────
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS bundle_rules (
                id TEXT PRIMARY KEY,
                bundle_id TEXT,
                rule_id TEXT,
                owner_id TEXT,
                created_datetime TEXT
            )
        """)

        # ── Add bundles_multi_placement to settings table ────────────────
        cursor.execute("PRAGMA table_info(settings)")
        columns = [col[1] for col in cursor.fetchall()]
        if "bundles_multi_placement" not in columns:
            cursor.execute("ALTER TABLE settings ADD COLUMN bundles_multi_placement BOOLEAN DEFAULT 0")
            logger.info("Added bundles_multi_placement column to settings table")

        # ── Add bundles_enabled to settings table ────────────────────────
        cursor.execute("PRAGMA table_info(settings)")
        columns = [col[1] for col in cursor.fetchall()]
        if "bundles_enabled" not in columns:
            cursor.execute("ALTER TABLE settings ADD COLUMN bundles_enabled BOOLEAN DEFAULT 1")
            logger.info("Added bundles_enabled column to settings table")
        if "bundles_show_count" not in columns:
            cursor.execute("ALTER TABLE settings ADD COLUMN bundles_show_count TEXT DEFAULT 'both'")
            logger.info("Added bundles_show_count column to settings table")

        # ── Add color column to bundles table if missing ─────────────────
        cursor.execute("PRAGMA table_info(bundles)")
        bundle_columns = [col[1] for col in cursor.fetchall()]
        if "color" not in bundle_columns:
            cursor.execute("ALTER TABLE bundles ADD COLUMN color TEXT")
            logger.info("Added color column to bundles table")

        conn.commit()
        logger.info("Bundles tables created/verified")

        # ── Deduplicate bundles (fix for double-initialization) ──────────
        cursor.execute("SELECT DISTINCT owner_id FROM bundles")
        owners = [r[0] for r in cursor.fetchall()]
        for oid in owners:
            cursor.execute(
                "SELECT id, name, display_order FROM bundles WHERE owner_id = ? ORDER BY display_order ASC, created_datetime ASC",
                (oid,),
            )
            all_bundles = cursor.fetchall()
            seen_names = {}
            for bid, bname, border in all_bundles:
                lower_name = bname.lower()
                if lower_name in seen_names:
                    # Duplicate — delete this one and its rules
                    cursor.execute("DELETE FROM bundle_rules WHERE bundle_id = ?", (bid,))
                    cursor.execute("DELETE FROM bundles WHERE id = ?", (bid,))
                    logger.info(f"Removed duplicate bundle '{bname}' (id={bid}) for owner {oid}")
                else:
                    seen_names[lower_name] = bid
        conn.commit()

        # ── Deduplicate "Bundle: " rules (fix for double-initialization) ─
        cursor.execute("SELECT DISTINCT owner_id FROM rules")
        rule_owners = [r[0] for r in cursor.fetchall()]
        for oid in rule_owners:
            cursor.execute(
                "SELECT id, name FROM rules WHERE owner_id = ? AND name LIKE 'Bundle: %' ORDER BY created_datetime ASC",
                (oid,),
            )
            all_bundle_rules = cursor.fetchall()
            seen_rule_names = {}
            for rid, rname in all_bundle_rules:
                lower_rname = rname.lower()
                if lower_rname in seen_rule_names:
                    # Duplicate rule — delete its bundle_rules associations and the rule itself
                    cursor.execute("DELETE FROM bundle_rules WHERE rule_id = ?", (rid,))
                    cursor.execute("DELETE FROM rules WHERE id = ?", (rid,))
                    logger.info(f"Removed duplicate rule '{rname}' (id={rid}) for owner {oid}")
                else:
                    seen_rule_names[lower_rname] = rid
        conn.commit()

    except Exception as e:
        logger.error(f"Error creating bundles tables: {str(e)}")
    finally:
        if conn:
            conn.close()


# ── Email Thread Nests: migration ────────────────────────────────────────

def migrate_add_nest_thread_id():
    """Add nest_thread_id column to chits table if it doesn't exist.

    This column stores the ID of an email chit in the target thread,
    allowing non-email chits to be nested into email threads.
    """
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(chits)")
        columns = [col[1] for col in cursor.fetchall()]
        if "nest_thread_id" not in columns:
            cursor.execute("ALTER TABLE chits ADD COLUMN nest_thread_id TEXT DEFAULT NULL")
            conn.commit()
            logger.info("Added nest_thread_id column to chits table")
    except Exception as e:
        logger.error(f"Error adding nest_thread_id column: {str(e)}")
        raise
    finally:
        if conn:
            conn.close()


# ── Audit Log Cleanup: remove bogus fields from existing entries ─────────

def migrate_cleanup_audit_junk_fields():
    """Remove bogus 'id', 'owner_id', 'owner_display_name', 'owner_username',
    'deleted_datetime' fields from existing audit_log changes arrays.
    Deletes entries that have no real changes left after cleanup."""
    import json as _json

    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # Check if audit_log table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='audit_log'")
        if not cursor.fetchone():
            return

        junk_fields = {"id", "owner_id", "owner_display_name", "owner_username", "deleted_datetime"}

        cursor.execute("SELECT id, changes FROM audit_log WHERE changes IS NOT NULL")
        rows = cursor.fetchall()

        cleaned = 0
        deleted = 0
        for row_id, changes_raw in rows:
            try:
                changes = _json.loads(changes_raw)
            except (ValueError, TypeError):
                continue
            if not isinstance(changes, list):
                continue

            filtered = [c for c in changes if c.get("field") not in junk_fields]
            if len(filtered) == len(changes):
                continue  # No junk fields in this entry

            if not filtered:
                # No real changes left — delete the entry
                cursor.execute("DELETE FROM audit_log WHERE id = ?", (row_id,))
                deleted += 1
            else:
                # Update with cleaned changes
                cursor.execute("UPDATE audit_log SET changes = ? WHERE id = ?",
                               (_json.dumps(filtered), row_id))
                cleaned += 1

        conn.commit()
        if cleaned or deleted:
            logger.info(f"Audit cleanup: cleaned {cleaned} entries, deleted {deleted} empty entries")
    except Exception as e:
        logger.error(f"Error cleaning audit log junk fields: {str(e)}")
    finally:
        if conn:
            conn.close()


def migrate_add_show_map_thumbnails():
    """Add show_map_thumbnails column to settings table."""
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(settings)")
        existing = {row[1] for row in cursor.fetchall()}
        if "show_map_thumbnails" not in existing:
            cursor.execute("ALTER TABLE settings ADD COLUMN show_map_thumbnails TEXT DEFAULT '1'")
            conn.commit()
            logger.info("Added show_map_thumbnails column to settings table")
    except Exception as e:
        logger.error(f"Error adding show_map_thumbnails column: {str(e)}")
    finally:
        if conn:
            conn.close()


def migrate_add_snoozed_until():
    """Add snoozed_until column to chits table for chit-level snooze."""
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(chits)")
        existing = {row[1] for row in cursor.fetchall()}
        if "snoozed_until" not in existing:
            cursor.execute("ALTER TABLE chits ADD COLUMN snoozed_until TEXT")
            conn.commit()
            logger.info("Added snoozed_until column to chits table")
    except Exception as e:
        logger.error(f"Error adding snoozed_until column: {str(e)}")
    finally:
        if conn:
            conn.close()


# ── Session Lifetime Setting: migration ──────────────────────────────────

def migrate_add_session_lifetime():
    """Add session_lifetime column to settings table."""
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(settings)")
        existing = {row[1] for row in cursor.fetchall()}
        if "session_lifetime" not in existing:
            cursor.execute("ALTER TABLE settings ADD COLUMN session_lifetime TEXT DEFAULT '24'")
            conn.commit()
            logger.info("Added session_lifetime column to settings table")
    except Exception as e:
        logger.error(f"Error adding session_lifetime column: {str(e)}")
    finally:
        if conn:
            conn.close()


# ── Notification Delivery Target: migration ──────────────────────────────

def migrate_add_notification_delivery_target():
    """Add delivery_target column to notifications table.

    Stores 'desktop', 'mobile', or NULL (no restriction — show everywhere).
    When set, the notification is only surfaced to clients matching that device type.
    This enables "notify me next time I'm on desktop" style deferred delivery.

    Fully idempotent — checks column existence before adding.
    """
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(notifications)")
        existing = {row[1] for row in cursor.fetchall()}
        if "delivery_target" not in existing:
            cursor.execute("ALTER TABLE notifications ADD COLUMN delivery_target TEXT")
            conn.commit()
            logger.info("Added delivery_target column to notifications table")
    except Exception as e:
        logger.error(f"Error adding delivery_target column: {str(e)}")
    finally:
        if conn:
            conn.close()


# ── Notification Snoozed Until: migration ────────────────────────────────

def migrate_add_notification_snoozed_until():
    """Add snoozed_until column to notifications table.

    Stores an ISO datetime. When set and in the future, the notification
    is hidden from fetch results until the snooze expires.

    Fully idempotent — checks column existence before adding.
    """
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(notifications)")
        existing = {row[1] for row in cursor.fetchall()}
        if "snoozed_until" not in existing:
            cursor.execute("ALTER TABLE notifications ADD COLUMN snoozed_until TEXT")
            conn.commit()
            logger.info("Added snoozed_until column to notifications table")
    except Exception as e:
        logger.error(f"Error adding snoozed_until column to notifications: {str(e)}")
    finally:
        if conn:
            conn.close()

# ── Point in Time: migration ─────────────────────────────────────────────

def migrate_add_point_in_time():
    """Add point_in_time TEXT column to chits table.

    A reference timestamp — not a deadline, not a scheduled event.
    Used to record 'when something happened' or 'when this is relevant'
    without any action semantics (no overdue, no calendar placement).
    """
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(chits)")
        existing = {row[1] for row in cursor.fetchall()}
        if "point_in_time" not in existing:
            cursor.execute("ALTER TABLE chits ADD COLUMN point_in_time TEXT")
            conn.commit()
            logger.info("Added point_in_time column to chits table")
    except Exception as e:
        logger.error(f"Error adding point_in_time column to chits: {str(e)}")
    finally:
        if conn:
            conn.close()

# ── Email start_datetime → point_in_time migration ───────────────────────

def migrate_email_start_to_point_in_time():
    """Move start_datetime to point_in_time for all email chits.

    Emails should only have point_in_time (reference timestamp), not
    start_datetime (which causes them to appear as calendar events).
    Copies start_datetime → point_in_time where point_in_time is null,
    then clears start_datetime on those rows.
    """
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        # Only act on email chits that have start_datetime but no point_in_time
        cursor.execute(
            """UPDATE chits
               SET point_in_time = start_datetime,
                   start_datetime = NULL,
                   end_datetime = NULL
               WHERE email_message_id IS NOT NULL
                 AND start_datetime IS NOT NULL
                 AND (point_in_time IS NULL OR point_in_time = '')"""
        )
        affected = cursor.rowcount
        conn.commit()
        if affected > 0:
            logger.info(f"Migrated {affected} email chits: start_datetime → point_in_time")
    except Exception as e:
        logger.error(f"Error in migrate_email_start_to_point_in_time: {str(e)}")
    finally:
        if conn:
            conn.close()


# ── Prerequisites column migration ───────────────────────────────────────

def migrate_add_prerequisites():
    """Add prerequisites column (JSON array of chit IDs) to chits table."""
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(chits)")
        existing = {row[1] for row in cursor.fetchall()}
        if "prerequisites" not in existing:
            cursor.execute("ALTER TABLE chits ADD COLUMN prerequisites TEXT")
            conn.commit()
            logger.info("Added prerequisites column to chits table")
    except Exception as e:
        logger.error(f"Error adding prerequisites column to chits: {str(e)}")
    finally:
        if conn:
            conn.close()


# ── Auto-Save Settings: migration ────────────────────────────────────────

def migrate_add_autosave_settings():
    """Add autosave_desktop and autosave_mobile columns to settings table.

    Both columns store '0' (disabled) or '1' (enabled), defaulting to '0'.
    Fully idempotent — checks column existence before adding.
    """
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(settings)")
        existing = {row[1] for row in cursor.fetchall()}
        if "autosave_desktop" not in existing:
            cursor.execute("ALTER TABLE settings ADD COLUMN autosave_desktop TEXT DEFAULT '0'")
            logger.info("Added autosave_desktop column to settings table")
        if "autosave_mobile" not in existing:
            cursor.execute("ALTER TABLE settings ADD COLUMN autosave_mobile TEXT DEFAULT '0'")
            logger.info("Added autosave_mobile column to settings table")
        conn.commit()
    except Exception as e:
        logger.error(f"Error adding autosave settings columns: {str(e)}")
        raise
    finally:
        if conn:
            conn.close()


# ── Auto-Complete Checklist: migration ────────────────────────────────────

def migrate_add_auto_complete_checklist():
    """Add auto_complete_checklist column to chits table.

    Stores NULL (not set), 1 (enabled), or 0 (disabled).
    Fully idempotent — checks column existence before adding.
    """
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(chits)")
        existing = {row[1] for row in cursor.fetchall()}
        if "auto_complete_checklist" not in existing:
            cursor.execute("ALTER TABLE chits ADD COLUMN auto_complete_checklist BOOLEAN DEFAULT NULL")
            conn.commit()
            logger.info("Added auto_complete_checklist column to chits table")
    except Exception as e:
        logger.error(f"Error adding auto_complete_checklist column: {str(e)}")
        raise
    finally:
        if conn:
            conn.close()


# ── Custom Objects: migration ─────────────────────────────────────────────

def seed_custom_objects(owner_id):
    """Seed the standard library of Custom Objects for a user if none exist yet.

    Only seeds if no custom_objects rows exist for the given owner_id.
    All seeded entries have is_standard=1. No zone_assignments are created.
    """
    import json
    from datetime import datetime

    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # Check if any custom_objects already exist for this owner
        cursor.execute(
            "SELECT COUNT(*) FROM custom_objects WHERE owner_id = ?", (owner_id,)
        )
        count = cursor.fetchone()[0]
        if count > 0:
            logger.info(f"Custom objects already exist for owner {owner_id}, skipping seed")
            return

        now = datetime.utcnow().isoformat() + "Z"
        sort_order = 0

        def _insert(obj_type, sub_type, name, value_type, units=None,
                    metric_units=None, range_min=None, range_max=None,
                    conditional_display=None):
            nonlocal sort_order
            sort_order += 1
            cond_json = json.dumps(conditional_display) if conditional_display else None
            cursor.execute(
                """INSERT INTO custom_objects
                   (id, type, sub_type, category, name, value_type, units,
                    metric_units, range_min, range_max, active, deleted,
                    sort_order, is_standard, conditional_display, owner_id,
                    created_datetime, modified_datetime)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, 1, ?, ?, ?, ?)""",
                (str(uuid4()), obj_type, sub_type, None, name, value_type,
                 units, metric_units, range_min, range_max, sort_order,
                 cond_json, owner_id, now, now)
            )

        # ── Illnesses (10 items) — type="Symptom", category="Illnesses", boolean
        for name in [
            "Cough", "Fatigue/Tiredness", "Fever/Chills", "Headache",
            "Runny or Stuffy Nose", "Sore Throat", "Sneezing",
            "Muscle/Body Aches", "Nausea/Vomiting/Diarrhea", "Shortness of Breath"
        ]:
            _insert("Symptom", "Illnesses", name, "boolean")

        # ── Injuries (10 items) — type="Symptom", category="Injuries", boolean
        for name in [
            "Pain (localized)", "Swelling", "Bruising/Redness",
            "Limited Movement/Stiffness", "Bleeding", "Tenderness",
            "Headache (head injuries)", "Nausea/Dizziness (concussion)",
            "Numbness/Tingling", "Fatigue (trauma/blood loss)"
        ]:
            _insert("Symptom", "Injuries", name, "boolean")

        # ── Allergies (10 items) — type="Symptom", category="Allergies", boolean
        for name in [
            "Sneezing", "Runny or Stuffy Nose", "Itchy/Watery Eyes",
            "Itching/Rash/Hives", "Cough/Post-nasal Drip", "Fatigue",
            "Headache/Sinus Pressure", "Swelling (lips, face, throat)",
            "Shortness of Breath/Wheezing", "Redness/Skin Irritation"
        ]:
            _insert("Symptom", "Allergies", name, "boolean")

        # ── Vitals (6 items) — type="Vital", category="Vitals"
        _insert("Vital", "Vitals", "Heart Rate", "integer",
                units="bpm", metric_units="bpm", range_min=60, range_max=100)
        _insert("Vital", "Vitals", "Blood Pressure Systolic", "integer",
                units="mmHg", metric_units="mmHg", range_min=90, range_max=120)
        _insert("Vital", "Vitals", "Blood Pressure Diastolic", "integer",
                units="mmHg", metric_units="mmHg", range_min=60, range_max=80)
        _insert("Vital", "Vitals", "Oxygen Saturation", "integer",
                units="%", metric_units="%", range_min=95, range_max=100)
        _insert("Vital", "Vitals", "Temperature", "decimal",
                units="°F", metric_units="°C", range_min=97.0, range_max=99.0)
        _insert("Vital", "Vitals", "Period Active", "boolean",
                conditional_display={"setting": "sex", "equals": "Woman"})

        # ── Body (3 items) — type="Measurement", category="Body"
        _insert("Measurement", "Body", "Weight", "decimal",
                units="lbs", metric_units="kg")
        _insert("Measurement", "Body", "Height", "decimal",
                units="in", metric_units="cm")
        _insert("Measurement", "Body", "Glucose", "integer",
                units="mg/dL", metric_units="mmol/L")

        # ── Activity (2 items) — type="Activity", category="Activity"
        _insert("Activity", "Activity", "Distance", "decimal",
                units="mi", metric_units="km")
        _insert("Activity", "Activity", "Calories", "integer",
                units="kcal", metric_units="kcal")

        conn.commit()
        logger.info(f"Seeded {sort_order} standard custom objects for owner {owner_id}")
    except Exception as e:
        logger.error(f"Error seeding custom objects: {str(e)}")
        raise
    finally:
        if conn:
            conn.close()


def migrate_create_custom_objects_tables():
    """Create custom_objects and zone_assignments tables if they don't exist.

    custom_objects: stores generic object definitions (type, name, value_type, etc.)
    zone_assignments: maps objects to consumer zones with per-zone config.

    Fully idempotent — uses CREATE TABLE IF NOT EXISTS.
    """
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # ── custom_objects table ─────────────────────────────────────────
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS custom_objects (
                id TEXT PRIMARY KEY,
                type TEXT NOT NULL,
                sub_type TEXT,
                category TEXT,
                name TEXT NOT NULL,
                value_type TEXT NOT NULL,
                units TEXT,
                metric_units TEXT,
                range_min REAL,
                range_max REAL,
                active INTEGER DEFAULT 1,
                deleted INTEGER DEFAULT 0,
                sort_order INTEGER DEFAULT 0,
                is_standard INTEGER DEFAULT 0,
                conditional_display TEXT,
                owner_id TEXT,
                created_datetime TEXT,
                modified_datetime TEXT
            )
        """)

        # Unique constraint: name must be unique within type+category per owner
        cursor.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS idx_custom_objects_unique_name
            ON custom_objects (type, category, name, owner_id)
        """)

        # ── zone_assignments table ───────────────────────────────────────
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS zone_assignments (
                id TEXT PRIMARY KEY,
                custom_object_id TEXT NOT NULL,
                zone_id TEXT NOT NULL,
                config TEXT,
                sort_order INTEGER DEFAULT 0,
                owner_id TEXT
            )
        """)

        # Unique constraint: one assignment per object+zone per owner
        cursor.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS idx_zone_assignments_unique
            ON zone_assignments (custom_object_id, zone_id, owner_id)
        """)

        conn.commit()
        logger.info("custom_objects and zone_assignments tables ready")
    except Exception as e:
        logger.error(f"Error creating custom_objects tables: {str(e)}")
        raise
    finally:
        if conn:
            conn.close()


def migrate_custom_objects_remove_category():
    """Migrate category data into sub_type and update the unique index.

    Moves category values into sub_type (where sub_type is currently null),
    then drops the old unique index on (type, category, name, owner_id) and
    creates a new one on (type, sub_type, name, owner_id).

    Fully idempotent — checks if migration is needed before running.
    """
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # Check if category column exists (if table doesn't exist, skip)
        cursor.execute("PRAGMA table_info(custom_objects)")
        columns = [row[1] for row in cursor.fetchall()]
        if 'category' not in columns:
            return  # Already migrated or table doesn't exist

        # Copy category → sub_type where sub_type is null and category is not null
        cursor.execute("""
            UPDATE custom_objects
            SET sub_type = category
            WHERE sub_type IS NULL AND category IS NOT NULL
        """)

        # Drop old unique index and create new one
        cursor.execute("DROP INDEX IF EXISTS idx_custom_objects_unique_name")
        cursor.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS idx_custom_objects_unique_name
            ON custom_objects (type, sub_type, name, owner_id)
        """)

        conn.commit()
        logger.info("Migrated custom_objects: category → sub_type, updated unique index")
    except Exception as e:
        logger.error(f"Error in migrate_custom_objects_remove_category: {str(e)}")
        raise
    finally:
        if conn:
            conn.close()


# ── Indicators Zone: initialization migration ─────────────────────────────

def migrate_indicators_zone_init(owner_id):
    """Create default indicators_zone assignments for seeded Vital, Measurement,
    and Activity objects.

    Idempotent — only runs if no indicators_zone assignments exist for this owner.
    Called at startup after seed_custom_objects().
    """
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # Check if already initialized
        cursor.execute(
            "SELECT COUNT(*) FROM zone_assignments WHERE zone_id = 'indicators_zone' AND owner_id = ?",
            (owner_id,)
        )
        if cursor.fetchone()[0] > 0:
            return

        # Get all seeded Vital, Measurement, Activity objects for this owner
        cursor.execute("""
            SELECT id FROM custom_objects
            WHERE owner_id = ? AND is_standard = 1 AND deleted = 0
              AND type IN ('Vital', 'Measurement', 'Activity')
            ORDER BY sort_order ASC
        """, (owner_id,))
        objects = cursor.fetchall()

        if not objects:
            logger.warning(f"No seeded Vital/Measurement/Activity objects found for owner {owner_id}, skipping zone init")
            return

        config = serialize_json_field({"is_default": True})
        sort_order = 0
        for (obj_id,) in objects:
            sort_order += 1
            cursor.execute("""
                INSERT INTO zone_assignments (id, custom_object_id, zone_id, config, sort_order, owner_id)
                VALUES (?, ?, 'indicators_zone', ?, ?, ?)
            """, (str(uuid4()), obj_id, config, sort_order, owner_id))

        # Also create "graphs" zone assignments for numeric objects (integer/decimal)
        # so the charts view filter is populated out of the box
        cursor.execute(
            "SELECT COUNT(*) FROM zone_assignments WHERE zone_id = 'graphs' AND owner_id = ?",
            (owner_id,)
        )
        if cursor.fetchone()[0] == 0:
            cursor.execute("""
                SELECT id FROM custom_objects
                WHERE owner_id = ? AND is_standard = 1 AND deleted = 0
                  AND type IN ('Vital', 'Measurement', 'Activity')
                  AND value_type IN ('integer', 'decimal')
                ORDER BY sort_order ASC
            """, (owner_id,))
            numeric_objects = cursor.fetchall()
            graphs_config = serialize_json_field({})
            graphs_sort = 0
            for (obj_id,) in numeric_objects:
                graphs_sort += 1
                cursor.execute("""
                    INSERT INTO zone_assignments (id, custom_object_id, zone_id, config, sort_order, owner_id)
                    VALUES (?, ?, 'graphs', ?, ?, ?)
                """, (str(uuid4()), obj_id, graphs_config, graphs_sort, owner_id))
            logger.info(f"Initialized graphs zone with {graphs_sort} assignments for owner {owner_id}")

        conn.commit()
        logger.info(f"Initialized indicators_zone with {sort_order} assignments for owner {owner_id}")
    except Exception as e:
        logger.error(f"Error in migrate_indicators_zone_init: {str(e)}")
        raise
    finally:
        if conn:
            conn.close()


# ── Indicators Zone: legacy health_data migration ─────────────────────────

LEGACY_KEY_MAP = {
    "heart_rate": "Heart Rate",
    "bp_systolic": "Blood Pressure Systolic",
    "bp_diastolic": "Blood Pressure Diastolic",
    "spo2": "Oxygen Saturation",
    "temperature": "Temperature",
    "weight": "Weight",
    "height": "Height",
    "glucose": "Glucose",
    "distance": "Distance",
    "period_active": "Period Active",
}


def migrate_health_data_to_uuids(owner_id):
    """Migrate legacy string keys in chit health_data to Custom Object UUIDs.

    For each chit with health_data containing legacy keys (e.g. "heart_rate"),
    adds a new entry keyed by the corresponding Custom Object UUID with the same
    value. Original legacy key entries are preserved (non-destructive).

    Idempotent — skips if UUID key already exists in that chit's health_data.
    Logs a warning for unknown legacy keys.
    Called at startup after migrate_indicators_zone_init().
    """
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # Build runtime mapping: legacy key → Custom Object UUID
        legacy_to_uuid = {}
        for legacy_key, obj_name in LEGACY_KEY_MAP.items():
            cursor.execute(
                "SELECT id FROM custom_objects WHERE name = ? AND owner_id = ? AND is_standard = 1 AND deleted = 0",
                (obj_name, owner_id)
            )
            row = cursor.fetchone()
            if row:
                legacy_to_uuid[legacy_key] = row[0]
            else:
                logger.warning(f"migrate_health_data_to_uuids: no Custom Object found for '{obj_name}' (owner {owner_id})")

        if not legacy_to_uuid:
            logger.warning(f"migrate_health_data_to_uuids: no legacy→UUID mappings built for owner {owner_id}, skipping")
            return

        # Scan all chits with non-null health_data for this owner
        cursor.execute(
            "SELECT id, health_data FROM chits WHERE owner_id = ? AND health_data IS NOT NULL AND health_data != ''",
            (owner_id,)
        )
        chits = cursor.fetchall()

        updated_count = 0
        for chit_id, health_data_raw in chits:
            health_data = deserialize_json_field(health_data_raw)
            if not health_data or not isinstance(health_data, dict):
                continue

            modified = False
            for legacy_key, uuid_key in legacy_to_uuid.items():
                if legacy_key in health_data:
                    # Idempotent: skip if UUID key already exists
                    if uuid_key not in health_data:
                        health_data[uuid_key] = health_data[legacy_key]
                        modified = True

            # Warn about unknown legacy keys (keys that aren't UUIDs and aren't in LEGACY_KEY_MAP)
            for key in health_data:
                if key not in LEGACY_KEY_MAP and not _looks_like_uuid(key):
                    logger.warning(f"migrate_health_data_to_uuids: unknown legacy key '{key}' in chit {chit_id}")

            if modified:
                cursor.execute(
                    "UPDATE chits SET health_data = ? WHERE id = ?",
                    (serialize_json_field(health_data), chit_id)
                )
                updated_count += 1

        conn.commit()
        if updated_count > 0:
            logger.info(f"migrate_health_data_to_uuids: migrated {updated_count} chits for owner {owner_id}")
    except Exception as e:
        logger.error(f"Error in migrate_health_data_to_uuids: {str(e)}")
        raise
    finally:
        if conn:
            conn.close()


def _looks_like_uuid(s):
    """Quick check if a string looks like a UUID (contains dashes and is ~36 chars)."""
    return isinstance(s, str) and len(s) == 36 and s.count('-') == 4


# ── Sort Orders: per-user, per-view manual sort order persistence ────────

def migrate_create_sort_orders_table():
    """Create sort_orders table for persisting manual chit ordering across devices."""
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sort_orders (
                owner_id TEXT NOT NULL,
                view_tab TEXT NOT NULL,
                order_data TEXT NOT NULL,
                modified_datetime TEXT NOT NULL,
                PRIMARY KEY (owner_id, view_tab)
            )
        """)
        conn.commit()
        logger.info("sort_orders table ready")
    except Exception as e:
        logger.error(f"Error creating sort_orders table: {str(e)}")
    finally:
        if conn:
            conn.close()


def migrate_create_sort_preferences_table():
    """Create sort_preferences table for persisting sort field/direction per view tab."""
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sort_preferences (
                owner_id TEXT NOT NULL,
                view_tab TEXT NOT NULL,
                sort_field TEXT NOT NULL,
                sort_dir TEXT NOT NULL DEFAULT 'asc',
                modified_datetime TEXT NOT NULL,
                PRIMARY KEY (owner_id, view_tab)
            )
        """)
        conn.commit()
        logger.info("sort_preferences table ready")
    except Exception as e:
        logger.error(f"Error creating sort_preferences table: {str(e)}")
    finally:
        if conn:
            conn.close()

def migrate_add_private_pgp_key():
    """Add private_pgp_key_encrypted column to users table.

    Stores the user's PGP private key encrypted at rest using Fernet.
    Never returned in normal profile responses — requires password
    verification via a dedicated endpoint.
    """
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cols = [row[1] for row in cursor.execute("PRAGMA table_info(users)").fetchall()]
        if "private_pgp_key_encrypted" not in cols:
            cursor.execute("ALTER TABLE users ADD COLUMN private_pgp_key_encrypted TEXT")
            logger.info("Added private_pgp_key_encrypted column to users table")
        conn.commit()
    except Exception as e:
        logger.error(f"Error in migrate_add_private_pgp_key: {str(e)}")
        raise
    finally:
        if conn:
            conn.close()


def migrate_create_custom_zones_table():
    """Create custom_zones table for user-defined zone metadata.

    Stores zone name, zone_id (slugified identifier), sort_order, and owner.
    Fully idempotent — uses CREATE TABLE IF NOT EXISTS.
    """
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS custom_zones (
                id TEXT PRIMARY KEY,
                zone_id TEXT NOT NULL,
                name TEXT NOT NULL,
                sort_order INTEGER DEFAULT 0,
                owner_id TEXT NOT NULL,
                created_datetime TEXT NOT NULL,
                UNIQUE (zone_id, owner_id)
            )
        """)

        conn.commit()
        logger.info("custom_zones table ready")
    except Exception as e:
        logger.error(f"Error creating custom_zones table: {str(e)}")
        raise
    finally:
        if conn:
            conn.close()


# ── Omni View: bundles omni_view column ──────────────────────────────────

def migrate_bundles_omni_view():
    """Add omni_view column to bundles table.

    Stores 0 (not included in Omni View) or 1 (included).
    Fully idempotent — checks column existence before adding.
    """
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(bundles)")
        columns = [row[1] for row in cursor.fetchall()]
        if "omni_view" not in columns:
            cursor.execute("ALTER TABLE bundles ADD COLUMN omni_view INTEGER DEFAULT 0")
            conn.commit()
            logger.info("Added omni_view column to bundles table")
    except Exception as e:
        logger.error(f"Error adding omni_view column to bundles: {str(e)}")
    finally:
        if conn:
            conn.close()


# ── Omni View: settings columns ──────────────────────────────────────────

def migrate_omni_view_settings():
    """Add omni_layout and omni_locked_filters columns to settings table.

    omni_layout — TEXT, default NULL — stores JSON layout config for Omni View sections.
    omni_locked_filters — TEXT, default NULL — stores JSON filter defaults for Omni View.
    Fully idempotent — checks column existence before adding.
    """
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(settings)")
        columns = [row[1] for row in cursor.fetchall()]
        if "omni_layout" not in columns:
            cursor.execute("ALTER TABLE settings ADD COLUMN omni_layout TEXT")
            logger.info("Added omni_layout column to settings table")
        if "omni_locked_filters" not in columns:
            cursor.execute("ALTER TABLE settings ADD COLUMN omni_locked_filters TEXT")
            logger.info("Added omni_locked_filters column to settings table")
        if "omni_hst_clock_mode" not in columns:
            cursor.execute("ALTER TABLE settings ADD COLUMN omni_hst_clock_mode TEXT DEFAULT 'both'")
            logger.info("Added omni_hst_clock_mode column to settings table")
        conn.commit()
    except Exception as e:
        logger.error(f"Error adding Omni View settings columns: {str(e)}")
    finally:
        if conn:
            conn.close()

def migrate_omni_email_count():
    """Add omni_email_count column to settings table."""
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(settings)")
        columns = [row[1] for row in cursor.fetchall()]
        if "omni_email_count" not in columns:
            cursor.execute("ALTER TABLE settings ADD COLUMN omni_email_count TEXT DEFAULT '3'")
            conn.commit()
            logger.info("Added omni_email_count column to settings table")
    except Exception as e:
        logger.error(f"Error adding omni_email_count column: {str(e)}")
    finally:
        if conn:
            conn.close()


def migrate_omni_normalize_colors():
    """Add omni_normalize_colors column to settings table."""
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(settings)")
        columns = [row[1] for row in cursor.fetchall()]
        if "omni_normalize_colors" not in columns:
            cursor.execute("ALTER TABLE settings ADD COLUMN omni_normalize_colors TEXT DEFAULT '0'")
            conn.commit()
            logger.info("Added omni_normalize_colors column to settings table")
    except Exception as e:
        logger.error(f"Error adding omni_normalize_colors column: {str(e)}")
    finally:
        if conn:
            conn.close()


# ── Smart Actions Config: migration ──────────────────────────────────────

def migrate_add_smart_actions_config():
    """Add smart_actions_config column to settings table."""
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(settings)")
        columns = [row[1] for row in cursor.fetchall()]
        if "smart_actions_config" not in columns:
            cursor.execute("ALTER TABLE settings ADD COLUMN smart_actions_config TEXT")
            conn.commit()
            logger.info("Added smart_actions_config column to settings table")
    except Exception as e:
        logger.error(f"Error adding smart_actions_config column: {str(e)}")
    finally:
        if conn:
            conn.close()

# ── Auto-Complete Default ON: migration ──────────────────────────────────

def migrate_auto_complete_default_on():
    """Set auto_complete_checklist to 1 (true) for all existing chits where it is NULL."""
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("UPDATE chits SET auto_complete_checklist = 1 WHERE auto_complete_checklist IS NULL")
        updated = cursor.rowcount
        conn.commit()
        if updated:
            logger.info(f"migrate_auto_complete_default_on: set {updated} chits to auto_complete_checklist=1")
    except Exception as e:
        logger.error(f"Error in migrate_auto_complete_default_on: {str(e)}")
    finally:
        if conn:
            conn.close()

# ── Habit Mode for Rules: migration ──────────────────────────────────────

def migrate_add_habit_mode_to_rules():
    """Add habit_mode and habit_history columns to rules table if missing."""
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(rules)")
        columns = [row[1] for row in cursor.fetchall()]
        if "habit_mode" not in columns:
            cursor.execute("ALTER TABLE rules ADD COLUMN habit_mode BOOLEAN DEFAULT 0")
            logger.info("Added habit_mode column to rules table")
        if "habit_history" not in columns:
            cursor.execute("ALTER TABLE rules ADD COLUMN habit_history TEXT")
            logger.info("Added habit_history column to rules table")
        conn.commit()
    except Exception as e:
        logger.error(f"Error adding habit mode columns to rules: {str(e)}")
    finally:
        if conn:
            conn.close()

# ── Custom View Filters: migration ───────────────────────────────────────

def migrate_add_custom_view_filters():
    """Add custom_view_filters column to settings table if missing."""
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(settings)")
        columns = [row[1] for row in cursor.fetchall()]
        if "custom_view_filters" not in columns:
            cursor.execute("ALTER TABLE settings ADD COLUMN custom_view_filters TEXT")
            logger.info("Added custom_view_filters column to settings table")
        conn.commit()
    except Exception as e:
        logger.error(f"Error adding custom_view_filters column: {str(e)}")
    finally:
        if conn:
            conn.close()


# ── Email Privacy & Send Later: migration ────────────────────────────────

def migrate_add_email_privacy_and_send_later():
    """Add email_send_at column to chits and email privacy settings to settings table.

    New chit column:
      - email_send_at: TEXT (nullable ISO datetime) — scheduled send time

    New settings columns:
      - email_block_tracking_pixels: TEXT DEFAULT '1' — block 1x1/1x2 images
      - email_external_content: TEXT DEFAULT 'block' — 'block', 'allow', 'known_senders'
      - email_read_receipts: TEXT DEFAULT 'never' — 'never', 'always', 'ask', 'contacts_only'
      - email_undo_send_delay: TEXT DEFAULT '5' — seconds before send fires
    """
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # ── Chits: email_send_at ──
        cursor.execute("PRAGMA table_info(chits)")
        chit_cols = {row[1] for row in cursor.fetchall()}
        if "email_send_at" not in chit_cols:
            cursor.execute("ALTER TABLE chits ADD COLUMN email_send_at TEXT")
            logger.info("Added email_send_at column to chits table")
        if "email_request_read_receipt" not in chit_cols:
            cursor.execute("ALTER TABLE chits ADD COLUMN email_request_read_receipt BOOLEAN DEFAULT 0")
            logger.info("Added email_request_read_receipt column to chits table")

        # ── Settings: email privacy fields ──
        cursor.execute("PRAGMA table_info(settings)")
        settings_cols = {row[1] for row in cursor.fetchall()}
        if "email_block_tracking_pixels" not in settings_cols:
            cursor.execute("ALTER TABLE settings ADD COLUMN email_block_tracking_pixels TEXT DEFAULT '1'")
            logger.info("Added email_block_tracking_pixels column to settings table")
        if "email_external_content" not in settings_cols:
            cursor.execute("ALTER TABLE settings ADD COLUMN email_external_content TEXT DEFAULT 'allow'")
            logger.info("Added email_external_content column to settings table")
        if "email_read_receipts" not in settings_cols:
            cursor.execute("ALTER TABLE settings ADD COLUMN email_read_receipts TEXT DEFAULT 'never'")
            logger.info("Added email_read_receipts column to settings table")
        if "email_undo_send_delay" not in settings_cols:
            cursor.execute("ALTER TABLE settings ADD COLUMN email_undo_send_delay TEXT DEFAULT '5'")
            logger.info("Added email_undo_send_delay column to settings table")
        if "email_group_by" not in settings_cols:
            cursor.execute("ALTER TABLE settings ADD COLUMN email_group_by TEXT DEFAULT 'date'")
            logger.info("Added email_group_by column to settings table")

        conn.commit()
    except Exception as e:
        logger.error(f"Error in migrate_add_email_privacy_and_send_later: {str(e)}")
    finally:
        if conn:
            conn.close()


# ── Habit Trigger Config: migration ──────────────────────────────────────

def migrate_add_habit_trigger_config():
    """Add habit_trigger_config column to rules table if missing.

    This column stores JSON config for habit_achieved/habit_missed/habit_due
    trigger types:
    {
        "source_rule_id": "uuid",       # Which habit rule to watch
        "source_type": "rule" | "chit", # Whether watching a rule-habit or chit-habit
        "source_chit_id": "uuid",       # If source_type=chit, which chit
        "offset_minutes": int,          # For habit_due: negative=before, positive=after
        "event": "achieved" | "missed" | "due"  # Which event to fire on
    }
    """
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(rules)")
        columns = [row[1] for row in cursor.fetchall()]
        if "habit_trigger_config" not in columns:
            cursor.execute("ALTER TABLE rules ADD COLUMN habit_trigger_config TEXT")
            logger.info("Added habit_trigger_config column to rules table")
        conn.commit()
    except Exception as e:
        logger.error(f"Error adding habit_trigger_config column to rules: {str(e)}")
    finally:
        if conn:
            conn.close()


# ── Timezone Support: migration ──────────────────────────────────────────

def migrate_add_timezone_column():
    """Add nullable timezone column to chits table and default_timezone/timezone_override to settings."""
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # Chits table: timezone column for per-chit anchored timezone
        cursor.execute("PRAGMA table_info(chits)")
        columns = [row[1] for row in cursor.fetchall()]
        if "timezone" not in columns:
            cursor.execute("ALTER TABLE chits ADD COLUMN timezone TEXT DEFAULT NULL")
            logger.info("Added timezone column to chits table")

        # Settings table: default_timezone and timezone_override
        cursor.execute("PRAGMA table_info(settings)")
        settings_cols = [row[1] for row in cursor.fetchall()]
        if "default_timezone" not in settings_cols:
            cursor.execute("ALTER TABLE settings ADD COLUMN default_timezone TEXT")
            logger.info("Added default_timezone column to settings table")
        if "timezone_override" not in settings_cols:
            cursor.execute("ALTER TABLE settings ADD COLUMN timezone_override TEXT")
            logger.info("Added timezone_override column to settings table")

        conn.commit()
    except Exception as e:
        logger.error(f"Error in timezone migration: {str(e)}")
        raise
    finally:
        if conn:
            conn.close()


# ── Default View: migration ──────────────────────────────────────────────

def migrate_add_default_view():
    """Add default_view column to settings table.

    Stores the user's preferred default dashboard view (Calendar, Checklists,
    Tasks, Projects, Notes, Email, Indicators, Alarms, Omni).
    Defaults to 'Calendar' if not set.
    """
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        cursor.execute("PRAGMA table_info(settings)")
        settings_cols = {row[1] for row in cursor.fetchall()}

        if "default_view" not in settings_cols:
            cursor.execute("ALTER TABLE settings ADD COLUMN default_view TEXT DEFAULT 'Calendar'")
            logger.info("Added default_view column to settings table")

        conn.commit()
    except Exception as e:
        logger.error(f"Error in default_view migration: {str(e)}")
        raise
    finally:
        if conn:
            conn.close()


# ── Android Settings Parity: add missing columns ─────────────────────────

def migrate_add_android_settings_parity():
    """Add settings columns needed for Android app parity.

    These columns were managed by the Android app (Room migration 7→8) but
    never existed on the server. Adding them enables proper bidirectional sync.

    Fully idempotent — checks column existence before adding.
    """
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(settings)")
        existing = {row[1] for row in cursor.fetchall()}

        new_columns = {
            "clock_orientation": "TEXT",
            "hidden_views": "TEXT",
            "combine_alerts": "TEXT DEFAULT '0'",
            "projects_show_child_count": "TEXT DEFAULT '0'",
            "projects_show_checklist_count": "TEXT DEFAULT '0'",
            "email_check_interval": "TEXT DEFAULT '15'",
            "email_max_pull": "TEXT DEFAULT '100'",
            "email_signature": "TEXT",
            "email_bundles_count_display": "TEXT",
            "instance_name": "TEXT",
            "welcome_message": "TEXT",
            "audit_log_pruning_enabled": "TEXT DEFAULT '0'",
            "tailscale_enabled": "TEXT DEFAULT '0'",
            "tailscale_auth_key": "TEXT",
            "ntfy_enabled": "TEXT DEFAULT '0'",
            "ha_enabled": "TEXT DEFAULT '0'",
            "ha_poll_interval": "TEXT DEFAULT '30'",
            "kiosk_selected_tags": "TEXT",
        }

        for col_name, col_type in new_columns.items():
            if col_name not in existing:
                cursor.execute(f"ALTER TABLE settings ADD COLUMN {col_name} {col_type}")
                logger.info(f"Added {col_name} column to settings table")

        conn.commit()
        logger.info("Android settings parity migration complete")
    except Exception as e:
        logger.error(f"Error in migrate_add_android_settings_parity: {str(e)}")
        raise
    finally:
        if conn:
            conn.close()


# ── Mobile Sync: sync_version columns and indexes ────────────────────────

def migrate_add_sync_version():
    """Add sync_version and has_unviewed_conflict columns for mobile sync support.

    Adds to chits: sync_version (INTEGER DEFAULT 0), has_unviewed_conflict (BOOLEAN DEFAULT 0)
    Adds to contacts: sync_version (INTEGER DEFAULT 0)
    Adds to settings: sync_version (INTEGER DEFAULT 0)

    Creates indexes:
    - idx_chits_sync_version on chits(sync_version)
    - idx_chits_owner_sync on chits(owner_id, sync_version)
    - idx_contacts_sync_version on contacts(sync_version)

    Creates sync_state table (single-row global version counter).
    Creates device_tokens table (long-lived device authentication).

    Backfills existing records with sequential sync_version values ordered by
    modified_datetime (chits first, then contacts, then settings). Updates
    sync_state.next_version to max_assigned + 1. Only runs if records still
    have sync_version = 0 (idempotent on subsequent startups).

    Fully idempotent — checks column existence before adding, uses
    CREATE TABLE/INDEX IF NOT EXISTS, and INSERT OR IGNORE for the seed row.
    """
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # ── chits table ──────────────────────────────────────────────────
        cursor.execute("PRAGMA table_info(chits)")
        chit_cols = {row[1] for row in cursor.fetchall()}

        if "sync_version" not in chit_cols:
            cursor.execute("ALTER TABLE chits ADD COLUMN sync_version INTEGER DEFAULT 0")
            logger.info("Added sync_version column to chits table")
        if "has_unviewed_conflict" not in chit_cols:
            cursor.execute("ALTER TABLE chits ADD COLUMN has_unviewed_conflict BOOLEAN DEFAULT 0")
            logger.info("Added has_unviewed_conflict column to chits table")

        # ── contacts table ───────────────────────────────────────────────
        cursor.execute("PRAGMA table_info(contacts)")
        contact_cols = {row[1] for row in cursor.fetchall()}

        if "sync_version" not in contact_cols:
            cursor.execute("ALTER TABLE contacts ADD COLUMN sync_version INTEGER DEFAULT 0")
            logger.info("Added sync_version column to contacts table")

        # ── settings table ───────────────────────────────────────────────
        cursor.execute("PRAGMA table_info(settings)")
        settings_cols = {row[1] for row in cursor.fetchall()}

        if "sync_version" not in settings_cols:
            cursor.execute("ALTER TABLE settings ADD COLUMN sync_version INTEGER DEFAULT 0")
            logger.info("Added sync_version column to settings table")

        # ── indexes ──────────────────────────────────────────────────────
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_chits_sync_version
            ON chits (sync_version)
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_chits_owner_sync
            ON chits (owner_id, sync_version)
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_contacts_sync_version
            ON contacts (sync_version)
        """)

        # ── sync_state table (global version counter) ────────────────────
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sync_state (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                next_version INTEGER NOT NULL DEFAULT 1
            )
        """)
        cursor.execute("INSERT OR IGNORE INTO sync_state (id, next_version) VALUES (1, 1)")
        logger.info("sync_state table ready")

        # ── device_tokens table (long-lived device authentication) ───────
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS device_tokens (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                token_hash TEXT NOT NULL UNIQUE,
                device_name TEXT NOT NULL DEFAULT 'Unknown Device',
                created_datetime TEXT NOT NULL,
                last_seen_datetime TEXT NOT NULL,
                last_sync_version INTEGER DEFAULT 0,
                revoked BOOLEAN DEFAULT 0,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_device_tokens_user
            ON device_tokens (user_id)
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_device_tokens_hash
            ON device_tokens (token_hash)
        """)
        logger.info("device_tokens table ready")

        # ── Backfill existing records with sequential sync_version ────────
        # Only runs if any records still have sync_version = 0 (idempotent).
        # Assigns sequential versions: chits (by modified_datetime), then
        # contacts (by modified_datetime), then settings (by user_id).
        cursor.execute("SELECT COUNT(*) FROM chits WHERE sync_version = 0")
        unversioned_chits = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM contacts WHERE sync_version = 0")
        unversioned_contacts = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM settings WHERE sync_version = 0")
        unversioned_settings = cursor.fetchone()[0]

        if unversioned_chits + unversioned_contacts + unversioned_settings > 0:
            version = 1

            # Chits — ordered by modified_datetime (NULLs last)
            cursor.execute("""
                SELECT id FROM chits
                WHERE sync_version = 0
                ORDER BY COALESCE(modified_datetime, '9999') ASC
            """)
            for (chit_id,) in cursor.fetchall():
                cursor.execute(
                    "UPDATE chits SET sync_version = ? WHERE id = ?",
                    (version, chit_id)
                )
                version += 1

            # Contacts — ordered by modified_datetime (NULLs last)
            cursor.execute("""
                SELECT id FROM contacts
                WHERE sync_version = 0
                ORDER BY COALESCE(modified_datetime, '9999') ASC
            """)
            for (contact_id,) in cursor.fetchall():
                cursor.execute(
                    "UPDATE contacts SET sync_version = ? WHERE id = ?",
                    (version, contact_id)
                )
                version += 1

            # Settings — no modified_datetime column, order by user_id
            cursor.execute("""
                SELECT user_id FROM settings
                WHERE sync_version = 0
                ORDER BY user_id ASC
            """)
            for (uid,) in cursor.fetchall():
                cursor.execute(
                    "UPDATE settings SET sync_version = ? WHERE user_id = ?",
                    (version, uid)
                )
                version += 1

            # Update sync_state.next_version to 1 higher than max assigned
            cursor.execute(
                "UPDATE sync_state SET next_version = ? WHERE id = 1",
                (version,)
            )
            logger.info(f"Backfilled {unversioned_chits} chits, {unversioned_contacts} contacts, "
                        f"{unversioned_settings} settings with sync_version 1–{version - 1}; "
                        f"next_version set to {version}")

        conn.commit()
        logger.info("Sync version migration complete")
    except Exception as e:
        logger.error(f"Error in migrate_add_sync_version: {str(e)}")
        raise
    finally:
        if conn:
            conn.close()


# ── Fix "Evertything Else" bundle name typo ──────────────────────────────

def migrate_fix_everything_else_typo():
    """Fix the typo 'Evertything Else' → 'Everything Else' in bundles table.
    Also renames any corresponding tags on chits.
    Additionally adds is_catch_all column to bundles table for proper identification."""
    from datetime import datetime
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # ── Add is_catch_all column if missing ───────────────────────────
        cols = [row[1] for row in cursor.execute("PRAGMA table_info(bundles)").fetchall()]
        if "is_catch_all" not in cols:
            cursor.execute("ALTER TABLE bundles ADD COLUMN is_catch_all BOOLEAN DEFAULT 0")
            logger.info("Added is_catch_all column to bundles table")

        # ── Fix the typo and set is_catch_all on the correct bundle ──────
        # First fix the typo variant
        cursor.execute("SELECT id, owner_id FROM bundles WHERE name = 'Evertything Else'")
        typo_rows = cursor.fetchall()
        for bundle_id, owner_id in typo_rows:
            cursor.execute(
                "UPDATE bundles SET name = 'Everything Else', is_catch_all = 1, modified_datetime = ? WHERE id = ?",
                (datetime.utcnow().isoformat(), bundle_id),
            )
            # Fix any tags on chits that reference the typo
            old_tag = "CWOC_System/Bundle/Evertything Else"
            new_tag = "CWOC_System/Bundle/Everything Else"
            cursor.execute(
                "SELECT id, tags FROM chits WHERE owner_id = ? AND tags LIKE ?",
                (owner_id, f'%{old_tag}%'),
            )
            for chit_id, tags_raw in cursor.fetchall():
                tags = deserialize_json_field(tags_raw) or []
                tags = [new_tag if t == old_tag else t for t in tags]
                cursor.execute(
                    "UPDATE chits SET tags = ?, modified_datetime = ? WHERE id = ?",
                    (serialize_json_field(tags), datetime.utcnow().isoformat(), chit_id),
                )

        # Now set is_catch_all on correctly-named "Everything Else" bundles too
        cursor.execute(
            "UPDATE bundles SET is_catch_all = 1 WHERE name = 'Everything Else' AND is_catch_all = 0"
        )

        conn.commit()
        if typo_rows:
            logger.info(f"Fixed 'Evertything Else' typo in {len(typo_rows)} bundle(s)")
        logger.info("is_catch_all flag set on all 'Everything Else' bundles")
    except Exception as e:
        logger.error(f"Error in migrate_fix_everything_else_typo: {str(e)}")
    finally:
        if conn:
            conn.close()




# ── Deduplicate Auto-Bundles & Convert to ID-Based Tags: migration ───────

def migrate_dedup_auto_bundles():
    """Remove duplicate auto-bundles, reset to canonical defaults, and convert
    ALL bundle tags from name-based (CWOC_System/Bundle/{name}) to ID-based
    (CWOC_System/BundleID/{id}).

    After this migration, bundle names are purely cosmetic — renaming a bundle
    never requires updating any chit tags.
    """
    from datetime import datetime

    CANONICAL = {
        "junk": ("🗑️ Junk", "Emails with unsubscribe links (marketing, newsletters, junk)", "#8b4513"),
        "receipts": ("🧾 Receipts", "Order confirmations, invoices, payment receipts", "#6b8e23"),
        "finance": ("🏦 Finance", "Banking, bills, statements, financial alerts", "#2e5090"),
        "calendar": ("🗓️ Calendar Invites", "Calendar invitations and event updates", "#8b008b"),
    }

    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        cursor.execute("SELECT DISTINCT owner_id FROM bundles")
        owners = [row[0] for row in cursor.fetchall()]

        total_removed = 0
        total_converted = 0

        for owner_id in owners:
            # ── 1. Dedup non-removable auto-bundles and reset to canonical ──
            cursor.execute(
                "SELECT id, name, description, created_datetime FROM bundles "
                "WHERE owner_id = ? AND removable = 0 AND (is_catch_all = 0 OR is_catch_all IS NULL) "
                "ORDER BY created_datetime ASC",
                (owner_id,),
            )
            auto_rows = cursor.fetchall()

            categories = {}
            for row in auto_rows:
                bid, name, desc, created = row
                desc_lower = (desc or "").lower()
                cat = None
                if "unsubscribe" in desc_lower or "junk" in desc_lower or "newsletter" in desc_lower or "clutter" in desc_lower:
                    cat = "junk"
                elif "receipt" in desc_lower or "order confirmation" in desc_lower:
                    cat = "receipts"
                elif "banking" in desc_lower or "bills" in desc_lower or "financial" in desc_lower:
                    cat = "finance"
                elif "calendar" in desc_lower or "invitation" in desc_lower:
                    cat = "calendar"
                if cat:
                    if cat not in categories:
                        categories[cat] = []
                    categories[cat].append(row)

            for cat, rows in categories.items():
                if len(rows) > 1:
                    keep = rows[0]
                    for dup_id, _, _, _ in rows[1:]:
                        cursor.execute("DELETE FROM bundle_rules WHERE bundle_id = ? AND owner_id = ?", (dup_id, owner_id))
                        cursor.execute("DELETE FROM bundles WHERE id = ?", (dup_id,))
                        total_removed += 1
                else:
                    keep = rows[0]

                keep_id = keep[0]
                canonical_name, canonical_desc, canonical_color = CANONICAL[cat]
                cursor.execute(
                    "UPDATE bundles SET name = ?, description = ?, color = ?, modified_datetime = ? WHERE id = ?",
                    (canonical_name, canonical_desc, canonical_color, datetime.utcnow().isoformat(), keep_id),
                )

            # ── 2. Reset catch-all ──
            cursor.execute(
                "SELECT id FROM bundles WHERE owner_id = ? AND is_catch_all = 1", (owner_id,)
            )
            catch_all = cursor.fetchone()
            if catch_all:
                cursor.execute(
                    "UPDATE bundles SET name = ?, description = ?, color = ?, modified_datetime = ? WHERE id = ?",
                    ("📬 Everything Else", "Emails not matched by any other bundle", None, datetime.utcnow().isoformat(), catch_all[0]),
                )

            # ── 3. Reset "From Contacts" ──
            cursor.execute(
                "SELECT id FROM bundles WHERE owner_id = ? AND removable = 1 AND is_default = 1 "
                "AND description LIKE '%contacts%'", (owner_id,)
            )
            fc_row = cursor.fetchone()
            if fc_row:
                cursor.execute(
                    "UPDATE bundles SET name = ?, description = ?, color = ?, modified_datetime = ? WHERE id = ?",
                    ("👤 From Contacts", "Emails from people in your contacts list", "#4a7c59", datetime.utcnow().isoformat(), fc_row[0]),
                )

            # ── 4. Convert ALL name-based tags to ID-based tags ──
            cursor.execute("SELECT id, name FROM bundles WHERE owner_id = ?", (owner_id,))
            name_to_id = {}
            for bid, bname in cursor.fetchall():
                name_to_id[bname] = bid

            # Also map historical names to current bundle IDs
            # (handles tags that reference old names before the rename above)
            for cat, rows in categories.items():
                if rows:
                    keep_id = rows[0][0]
                    # Map all known historical names for this category
                    historical = {
                        "junk": ["Junk", "Newsletters", "Clutter", "🗑️ Junk", "🗑️ Clutter"],
                        "receipts": ["Receipts", "🧾 Receipts"],
                        "finance": ["Finance", "🏦 Finance"],
                        "calendar": ["Calendar Invites", "🗓️ Calendar Invites"],
                    }
                    for hist_name in historical.get(cat, []):
                        if hist_name not in name_to_id:
                            name_to_id[hist_name] = keep_id

            # Map catch-all historical names
            if catch_all:
                for hist_name in ["Everything Else", "Evertything Else", "📬 Everything Else"]:
                    if hist_name not in name_to_id:
                        name_to_id[hist_name] = catch_all[0]

            # Map From Contacts historical names
            if fc_row:
                for hist_name in ["From Contacts", "👤 From Contacts"]:
                    if hist_name not in name_to_id:
                        name_to_id[hist_name] = fc_row[0]

            # Find all chits with old-style bundle tags
            cursor.execute(
                "SELECT id, tags FROM chits WHERE owner_id = ? AND tags LIKE '%CWOC_System/Bundle/%'",
                (owner_id,),
            )
            chit_rows = cursor.fetchall()

            for chit_id, tags_raw in chit_rows:
                tags = deserialize_json_field(tags_raw) or []
                new_tags = []
                changed = False
                for t in tags:
                    if isinstance(t, str) and t.startswith("CWOC_System/Bundle/"):
                        old_name = t[len("CWOC_System/Bundle/"):]
                        bid = name_to_id.get(old_name)
                        if bid:
                            new_tag = f"CWOC_System/BundleID/{bid}"
                            if new_tag not in new_tags:
                                new_tags.append(new_tag)
                        changed = True
                    else:
                        new_tags.append(t)
                if changed:
                    cursor.execute(
                        "UPDATE chits SET tags = ?, modified_datetime = ? WHERE id = ?",
                        (serialize_json_field(new_tags), datetime.utcnow().isoformat(), chit_id),
                    )
                    total_converted += 1

            # ── 5. Update rule actions to use ID-based tags ──
            cursor.execute(
                "SELECT r.id, r.actions FROM rules r "
                "JOIN bundle_rules br ON br.rule_id = r.id "
                "WHERE br.owner_id = ?",
                (owner_id,),
            )
            rule_rows = cursor.fetchall()
            for rule_id, actions_raw in rule_rows:
                actions = deserialize_json_field(actions_raw) or []
                updated = False
                for action in actions:
                    if action.get("type") == "add_tag":
                        tag = action.get("params", {}).get("tag", "")
                        if tag.startswith("CWOC_System/Bundle/"):
                            old_name = tag[len("CWOC_System/Bundle/"):]
                            bid = name_to_id.get(old_name)
                            if bid:
                                action["params"]["tag"] = f"CWOC_System/BundleID/{bid}"
                                updated = True
                if updated:
                    cursor.execute(
                        "UPDATE rules SET actions = ?, modified_datetime = ? WHERE id = ?",
                        (serialize_json_field(actions), datetime.utcnow().isoformat(), rule_id),
                    )

        conn.commit()
        if total_removed > 0:
            logger.info(f"Dedup auto-bundles: removed {total_removed} duplicate(s)")
        if total_converted > 0:
            logger.info(f"Converted {total_converted} chit(s) from name-based to ID-based bundle tags")
    except Exception as e:
        logger.error(f"Error in migrate_dedup_auto_bundles: {str(e)}")
    finally:
        if conn:
            conn.close()


# ── Unified User-Contacts: migration ─────────────────────────────────────

def migrate_unify_users_contacts():
    """Merge users into contacts table — a user IS a contact with auth fields.

    Steps:
    1. Add auth columns to contacts: username (TEXT UNIQUE), password_hash (TEXT),
       is_admin (BOOLEAN DEFAULT 0), is_active (BOOLEAN DEFAULT 1),
       private_pgp_key_encrypted (TEXT). Each wrapped in try/except for idempotency.
    2. Create partial unique index on contacts(username) WHERE username IS NOT NULL.
    3. For each user in the users table: INSERT into contacts (preserving UUID)
       or UPDATE existing contact with auth fields. Maps:
       - user.email → emails JSON entry with label "System"
       - user.profile_image_url → contact.image_url
       - user.emails_json → merged into contact emails array
       - All profile fields (given_name, surname, phones, addresses, etc.)
    4. Set shared_to_vault = 1 on all migrated user-contacts.
    5. Rename users table to users_deprecated (with existence check).

    Fully idempotent — safe to run multiple times.
    """
    import json as _json
    from datetime import datetime

    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # ── 1. Add auth columns to contacts table ────────────────────────
        # Note: username uniqueness is enforced by the partial unique index
        # (step 2), not by a column constraint — SQLite doesn't support
        # UNIQUE constraints on ALTER TABLE ADD COLUMN.
        auth_columns = [
            ("username", "TEXT"),
            ("password_hash", "TEXT"),
            ("is_admin", "BOOLEAN DEFAULT 0"),
            ("is_active", "BOOLEAN DEFAULT 1"),
            ("private_pgp_key_encrypted", "TEXT"),
        ]

        for col_name, col_def in auth_columns:
            try:
                cursor.execute(f"ALTER TABLE contacts ADD COLUMN {col_name} {col_def}")
                logger.info(f"Added {col_name} column to contacts table")
            except Exception:
                # Column already exists — idempotent
                pass

        # ── 2. Create partial unique index on username ───────────────────
        cursor.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_username
            ON contacts(username) WHERE username IS NOT NULL
        """)

        # ── 3. Migrate user records into contacts ────────────────────────
        # Check if users table still exists (may have been renamed already)
        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
        )
        if cursor.fetchone():
            cursor.execute("SELECT * FROM users")
            user_columns = [desc[0] for desc in cursor.description]
            users = cursor.fetchall()

            for user_row in users:
                user = dict(zip(user_columns, user_row))
                user_id = user["id"]

                # Build the emails JSON array
                emails_list = []

                # Add the System email from user.email
                if user.get("email"):
                    emails_list.append({"label": "System", "value": user["email"]})

                # Merge in emails_json (additional emails from user profile)
                if user.get("emails_json"):
                    try:
                        extra_emails = _json.loads(user["emails_json"]) if isinstance(user["emails_json"], str) else user["emails_json"]
                        if isinstance(extra_emails, list):
                            for entry in extra_emails:
                                # Avoid duplicating the System email
                                if isinstance(entry, dict) and entry.get("label") != "System":
                                    emails_list.append(entry)
                                elif isinstance(entry, dict) and entry.get("label") == "System":
                                    # If there's already a System email from emails_json, skip
                                    # (we already added it from user.email)
                                    pass
                    except (ValueError, TypeError):
                        pass

                emails_json_str = serialize_json_field(emails_list) if emails_list else None

                # Check if a contact with this ID already exists
                cursor.execute("SELECT id FROM contacts WHERE id = ?", (user_id,))
                existing_contact = cursor.fetchone()

                # Also check if a contact with this username already exists
                # (from a previous partial migration run)
                if not existing_contact and user.get("username"):
                    cursor.execute(
                        "SELECT id FROM contacts WHERE username = ?",
                        (user["username"],)
                    )
                    existing_by_username = cursor.fetchone()
                    if existing_by_username:
                        # Username already migrated to a different contact row — skip
                        logger.info(
                            f"User '{user['username']}' already exists in contacts "
                            f"(id={existing_by_username[0]}), skipping"
                        )
                        continue

                now = datetime.utcnow().isoformat() + "Z"

                if existing_contact:
                    # UPDATE existing contact with auth fields and profile data
                    cursor.execute("""
                        UPDATE contacts SET
                            username = ?,
                            password_hash = ?,
                            is_admin = ?,
                            is_active = ?,
                            private_pgp_key_encrypted = ?,
                            display_name = COALESCE(?, display_name),
                            given_name = COALESCE(?, given_name),
                            surname = COALESCE(?, surname),
                            middle_names = COALESCE(?, middle_names),
                            prefix = COALESCE(?, prefix),
                            suffix = COALESCE(?, suffix),
                            nickname = COALESCE(?, nickname),
                            phones = COALESCE(?, phones),
                            emails = COALESCE(?, emails),
                            addresses = COALESCE(?, addresses),
                            call_signs = COALESCE(?, call_signs),
                            x_handles = COALESCE(?, x_handles),
                            websites = COALESCE(?, websites),
                            organization = COALESCE(?, organization),
                            social_context = COALESCE(?, social_context),
                            notes = COALESCE(?, notes),
                            has_signal = COALESCE(?, has_signal),
                            signal_username = COALESCE(?, signal_username),
                            pgp_key = COALESCE(?, pgp_key),
                            color = COALESCE(?, color),
                            tags = COALESCE(?, tags),
                            image_url = COALESCE(?, image_url),
                            shared_to_vault = 1,
                            modified_datetime = ?
                        WHERE id = ?
                    """, (
                        user["username"],
                        user["password_hash"],
                        user.get("is_admin", 0),
                        user.get("is_active", 1),
                        user.get("private_pgp_key_encrypted"),
                        user.get("display_name"),
                        user.get("given_name"),
                        user.get("surname"),
                        user.get("middle_names"),
                        user.get("prefix"),
                        user.get("suffix"),
                        user.get("nickname"),
                        user.get("phones"),
                        emails_json_str,
                        user.get("addresses"),
                        user.get("call_signs"),
                        user.get("x_handles"),
                        user.get("websites"),
                        user.get("organization"),
                        user.get("social_context"),
                        user.get("notes"),
                        user.get("has_signal"),
                        user.get("signal_username"),
                        user.get("pgp_key"),
                        user.get("color"),
                        user.get("tags"),
                        user.get("profile_image_url"),
                        now,
                        user_id,
                    ))
                else:
                    # INSERT new contact record preserving the user's UUID
                    cursor.execute("""
                        INSERT OR IGNORE INTO contacts (
                            id, given_name, surname, middle_names, prefix, suffix,
                            display_name, nickname, phones, emails, addresses,
                            call_signs, x_handles, websites, has_signal, signal_username,
                            pgp_key, color, organization, social_context, notes, tags,
                            image_url, shared_to_vault, created_datetime, modified_datetime,
                            owner_id, username, password_hash, is_admin, is_active,
                            private_pgp_key_encrypted
                        ) VALUES (
                            ?, ?, ?, ?, ?, ?,
                            ?, ?, ?, ?, ?,
                            ?, ?, ?, ?, ?,
                            ?, ?, ?, ?, ?, ?,
                            ?, 1, ?, ?,
                            ?, ?, ?, ?, ?,
                            ?
                        )
                    """, (
                        user_id,
                        user.get("given_name") or user.get("display_name") or "",
                        user.get("surname"),
                        user.get("middle_names"),
                        user.get("prefix"),
                        user.get("suffix"),
                        user.get("display_name"),
                        user.get("nickname"),
                        user.get("phones"),
                        emails_json_str,
                        user.get("addresses"),
                        user.get("call_signs"),
                        user.get("x_handles"),
                        user.get("websites"),
                        user.get("has_signal", 0),
                        user.get("signal_username"),
                        user.get("pgp_key"),
                        user.get("color"),
                        user.get("organization"),
                        user.get("social_context"),
                        user.get("notes"),
                        user.get("tags"),
                        user.get("profile_image_url"),
                        user.get("created_datetime") or now,
                        now,
                        user_id,  # owner_id = self
                        user["username"],
                        user["password_hash"],
                        user.get("is_admin", 0),
                        user.get("is_active", 1),
                        user.get("private_pgp_key_encrypted"),
                    ))

                logger.info(f"Migrated user '{user['username']}' (id={user_id}) into contacts")

            # ── 4. Ensure all user-contacts have shared_to_vault = 1 ─────
            cursor.execute(
                "UPDATE contacts SET shared_to_vault = 1 WHERE username IS NOT NULL"
            )

            # ── 5. Rename users table to users_deprecated ────────────────
            cursor.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='users_deprecated'"
            )
            if not cursor.fetchone():
                cursor.execute(
                    "ALTER TABLE users RENAME TO users_deprecated"
                )
                logger.info("Renamed users table to users_deprecated")
            else:
                # Already renamed in a previous partial run — drop the leftover users table
                cursor.execute("DROP TABLE IF EXISTS users")
                logger.info("users_deprecated already exists; dropped leftover users table")

        conn.commit()
        logger.info("Unified user-contacts migration complete")
    except Exception as e:
        logger.error(f"Error in migrate_unify_users_contacts: {str(e)}")
        raise
    finally:
        if conn:
            conn.close()


# ── Email Thread ID: migration ───────────────────────────────────────────

def migrate_add_email_thread_id():
    """Add thread_id column to chits table and backfill existing email chits.

    The thread_id groups emails into conversations. It's computed as:
    1. The root message-ID from the References header (first entry)
    2. Fallback: the In-Reply-To message-ID
    3. Fallback: the email's own Message-ID (it's the thread root)

    This allows the mobile app to do a simple groupBy(threadId) instead of
    expensive O(n²) client-side threading.
    """
    import re

    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # Add column if missing
        cursor.execute("PRAGMA table_info(chits)")
        columns = {row[1] for row in cursor.fetchall()}
        if "thread_id" not in columns:
            cursor.execute("ALTER TABLE chits ADD COLUMN thread_id TEXT")
            logger.info("Added thread_id column to chits table")

        # Backfill: compute thread_id for all email chits that don't have one
        cursor.execute(
            """SELECT id, email_message_id, email_in_reply_to, email_references
               FROM chits
               WHERE email_message_id IS NOT NULL
                 AND email_message_id != ''
                 AND (thread_id IS NULL OR thread_id = '')"""
        )
        rows = cursor.fetchall()
        if rows:
            logger.info(f"Backfilling thread_id for {len(rows)} email chits")

            # First pass: compute thread_id for each email based on its own headers
            # thread_id = first reference (root of chain), or in_reply_to, or own message_id
            thread_ids = {}  # chit_id -> thread_id
            msg_id_to_thread = {}  # message_id -> thread_id (for unification)

            for row in rows:
                chit_id, message_id, in_reply_to, references = row
                message_id = (message_id or "").strip()
                in_reply_to = (in_reply_to or "").strip()
                references = (references or "").strip()

                # Parse references to find the root message-ID
                root_id = None
                if references:
                    # References header contains space-separated message-IDs, oldest first
                    refs = references.split()
                    if refs:
                        root_id = refs[0].strip()

                if not root_id and in_reply_to:
                    root_id = in_reply_to

                if not root_id:
                    root_id = message_id

                thread_ids[chit_id] = root_id

            # Second pass: unify threads — if a message's own ID is used as
            # another message's root, they share the same thread
            # Build message_id -> computed thread_id mapping
            for row in rows:
                chit_id, message_id, _, _ = row
                message_id = (message_id or "").strip()
                if message_id:
                    msg_id_to_thread[message_id] = thread_ids[chit_id]

            # Resolve chains: follow thread_id references until stable
            # (handles case where root_id points to another message that has its own root)
            def resolve_thread(tid):
                seen = set()
                current = tid
                while current in msg_id_to_thread and current != msg_id_to_thread.get(current) and current not in seen:
                    seen.add(current)
                    current = msg_id_to_thread[current]
                return current

            # Update all chits with resolved thread_ids
            for chit_id, tid in thread_ids.items():
                resolved = resolve_thread(tid)
                cursor.execute(
                    "UPDATE chits SET thread_id = ? WHERE id = ?",
                    (resolved, chit_id),
                )

            logger.info(f"Backfilled thread_id for {len(rows)} email chits")

        # Create index for fast groupBy queries
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS idx_chits_thread_id ON chits (thread_id)"
        )

        conn.commit()
        logger.info("Email thread_id migration complete")
    except Exception as e:
        logger.error(f"Error in migrate_add_email_thread_id: {str(e)}")
        raise
    finally:
        if conn:
            conn.close()


# ── Email ESC Quick Exit setting: migration ──────────────────────────────

def migrate_add_email_esc_quick_exit():
    """Add email_esc_quick_exit column to settings table.

    When '1', pressing ESC in the expanded email viewer also exits the chit editor.
    Default '0' = just closes the viewer.
    """
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        cursor.execute("PRAGMA table_info(settings)")
        settings_cols = [col[1] for col in cursor.fetchall()]
        if "email_esc_quick_exit" not in settings_cols:
            cursor.execute("ALTER TABLE settings ADD COLUMN email_esc_quick_exit TEXT DEFAULT '0'")
            logger.info("Added email_esc_quick_exit column to settings table")

        conn.commit()
    except Exception as e:
        logger.error(f"Error in migrate_add_email_esc_quick_exit: {str(e)}")
        raise
    finally:
        if conn:
            conn.close()

# ── Cleanup: remove stale email-type notifications ───────────────────────

def migrate_cleanup_email_notifications():
    """Remove all notification_type='email' notifications.

    These were incorrectly created for every incoming email. Only calendar
    invites should generate accept/decline notifications. This one-time
    cleanup removes the stale entries.
    """
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("DELETE FROM notifications WHERE notification_type = 'email'")
        deleted = cursor.rowcount
        if deleted:
            logger.info(f"Cleaned up {deleted} stale email-type notifications")
        conn.commit()
    except Exception as e:
        logger.error(f"Error in migrate_cleanup_email_notifications: {str(e)}")
    finally:
        if conn:
            conn.close()


# ── Restic Backup: backup_config table ───────────────────────────────────

def migrate_backup_config():
    """Create backup_config table for storing restic backup target configurations.

    Multi-row table — each row is an independent backup target with its own
    repository, schedule, retention policy, and operational state.
    """
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # Check if the table exists and whether the id column is TEXT or INTEGER.
        # Older versions created `id INTEGER PRIMARY KEY` which rejects UUID strings.
        # If that's the case, we need to recreate the table with TEXT PRIMARY KEY.
        needs_recreate = False
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='backup_config'")
        if cursor.fetchone():
            cursor.execute("PRAGMA table_info(backup_config)")
            cols = {row[1]: row[2] for row in cursor.fetchall()}
            if cols.get("id", "").upper() == "INTEGER":
                needs_recreate = True
                logger.info("backup_config table has INTEGER id — recreating with TEXT PRIMARY KEY")

        if needs_recreate:
            # Preserve any existing data
            cursor.execute("SELECT * FROM backup_config")
            existing_rows = cursor.fetchall()
            col_names = [desc[0] for desc in cursor.description]

            cursor.execute("DROP TABLE backup_config")
            cursor.execute("""
                CREATE TABLE backup_config (
                    id TEXT PRIMARY KEY,
                    name TEXT DEFAULT 'Backup',
                    enabled INTEGER DEFAULT 0,
                    repo_type TEXT DEFAULT 'local',
                    repo_url TEXT,
                    repo_password_encrypted TEXT,
                    backend_credentials_encrypted TEXT,
                    backup_paths TEXT,
                    schedule_frequency TEXT DEFAULT 'daily',
                    schedule_time TEXT DEFAULT '02:00',
                    retention_policy TEXT,
                    notification_recipients TEXT,
                    notification_transfer INTEGER DEFAULT 1,
                    notification_maintenance INTEGER DEFAULT 1,
                    last_backup_time TEXT,
                    last_backup_result TEXT,
                    next_backup_time TEXT,
                    last_check_time TEXT,
                    backup_history TEXT,
                    retry_count INTEGER DEFAULT 0,
                    created_at TEXT,
                    updated_at TEXT
                )
            """)
            # Re-insert existing rows with string IDs
            if existing_rows:
                import uuid as _uuid
                new_col_names = [
                    "id", "name", "enabled", "repo_type", "repo_url",
                    "repo_password_encrypted", "backend_credentials_encrypted",
                    "backup_paths", "schedule_frequency", "schedule_time",
                    "retention_policy", "notification_recipients",
                    "notification_transfer", "notification_maintenance",
                    "last_backup_time", "last_backup_result", "next_backup_time",
                    "last_check_time", "backup_history", "retry_count",
                    "created_at", "updated_at",
                ]
                for row in existing_rows:
                    row_dict = dict(zip(col_names, row))
                    # Ensure id is a string UUID
                    row_id = str(row_dict.get("id", ""))
                    if not row_id or row_id.isdigit():
                        row_id = str(_uuid.uuid4())
                    values = [row_id]
                    for col in new_col_names[1:]:
                        values.append(row_dict.get(col))
                    placeholders = ", ".join(["?"] * len(new_col_names))
                    cursor.execute(
                        f"INSERT OR IGNORE INTO backup_config ({', '.join(new_col_names)}) VALUES ({placeholders})",
                        values,
                    )
            conn.commit()
            logger.info("Recreated backup_config table with TEXT PRIMARY KEY")
        else:
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS backup_config (
                    id TEXT PRIMARY KEY,
                    name TEXT DEFAULT 'Backup',
                    enabled INTEGER DEFAULT 0,
                    repo_type TEXT DEFAULT 'local',
                    repo_url TEXT,
                    repo_password_encrypted TEXT,
                    backend_credentials_encrypted TEXT,
                    backup_paths TEXT,
                    schedule_frequency TEXT DEFAULT 'daily',
                    schedule_time TEXT DEFAULT '02:00',
                    retention_policy TEXT,
                    notification_recipients TEXT,
                    notification_transfer INTEGER DEFAULT 1,
                    notification_maintenance INTEGER DEFAULT 1,
                    last_backup_time TEXT,
                    last_backup_result TEXT,
                    next_backup_time TEXT,
                    last_check_time TEXT,
                    backup_history TEXT,
                    retry_count INTEGER DEFAULT 0,
                    created_at TEXT,
                    updated_at TEXT
                )
            """)

        # Migrate legacy single-row config (id=1) to new format if it exists
        cursor.execute("SELECT id FROM backup_config WHERE id = '1' OR id = 1")
        legacy_row = cursor.fetchone()
        if legacy_row:
            # Generate a proper UUID for the legacy row
            import uuid
            new_id = str(uuid.uuid4())
            cursor.execute(
                "UPDATE backup_config SET id = ?, name = 'Primary Backup' WHERE id = '1' OR id = 1",
                (new_id,)
            )
            conn.commit()
            logger.info("Migrated legacy backup_config row to id=%s", new_id)

        # Ensure 'name' column exists (for tables created before multi-target support)
        cursor.execute("PRAGMA table_info(backup_config)")
        columns = [row[1] for row in cursor.fetchall()]
        if "name" not in columns:
            cursor.execute("ALTER TABLE backup_config ADD COLUMN name TEXT DEFAULT 'Backup'")
            conn.commit()

        conn.commit()
        logger.info("backup_config table ready")
    except Exception as e:
        logger.error(f"Error in migrate_backup_config: {str(e)}")
    finally:
        if conn:
            conn.close()


# ── Tag ID System: one-time data migration ───────────────────────────────

def migrate_tags_to_id_system():
    """Migrate all tag references from name-based to UUID-based system.

    Steps (all in a single transaction):
      1. Assign UUIDs to tag registry entries that don't have one
      2. Convert chit tags from names to IDs
      3. Convert settings references (recent_tags, custom_view_filters,
         shared_tags, kiosk_selected_tags, omni_locked_filters)
      4. Convert rules engine references (tag_present/tag_not_present conditions,
         add_tag/remove_tag actions)

    Idempotent: detects already-converted values via UUID regex and skips them.
    Transactional: rolls back everything on any failure.
    """
    import json
    import re

    UUID_PATTERN = re.compile(
        r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
        re.IGNORECASE
    )

    SYSTEM_TAG_PREFIXES = ("cwoc_system/", "habits/")

    def _is_uuid(value):
        return isinstance(value, str) and bool(UUID_PATTERN.match(value))

    def _is_system_tag(value):
        if not isinstance(value, str):
            return False
        return value.lower().startswith(SYSTEM_TAG_PREFIXES)

    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA busy_timeout=5000")
        cursor = conn.cursor()

        # ── Get all users ────────────────────────────────────────────────
        cursor.execute("SELECT user_id, tags, recent_tags, custom_view_filters, shared_tags, kiosk_selected_tags, omni_locked_filters FROM settings")
        settings_columns = [desc[0] for desc in cursor.description]
        all_settings_rows = cursor.fetchall()

        for settings_row in all_settings_rows:
            user_id = settings_row[0]
            raw_tags = settings_row[1]
            raw_recent_tags = settings_row[2]
            raw_custom_view_filters = settings_row[3]
            raw_shared_tags = settings_row[4]
            raw_kiosk_selected_tags = settings_row[5]
            raw_omni_locked_filters = settings_row[6]

            # ── Step 1: Assign UUIDs to tag registry entries ─────────────
            tag_registry = deserialize_json_field(raw_tags) or []
            name_to_id = {}  # lowercase name → UUID (for lookups)
            registry_modified = False

            for tag_entry in tag_registry:
                if not isinstance(tag_entry, dict):
                    continue
                tag_name = tag_entry.get("name", "")
                tag_id = tag_entry.get("id")

                # If already has a valid UUID, just record the mapping
                if tag_id and _is_uuid(tag_id):
                    if tag_name:
                        name_to_id[tag_name.lower()] = tag_id
                    continue

                # Assign a new UUID
                new_id = str(uuid4())
                tag_entry["id"] = new_id
                registry_modified = True
                if tag_name:
                    name_to_id[tag_name.lower()] = new_id

            # Also handle legacy string-only entries (convert to dict)
            new_registry = []
            for tag_entry in tag_registry:
                if isinstance(tag_entry, str):
                    # Legacy string entry — convert to dict with UUID
                    existing_id = name_to_id.get(tag_entry.lower())
                    if existing_id:
                        new_registry.append({
                            "id": existing_id,
                            "name": tag_entry,
                            "color": None,
                            "fontColor": None,
                            "favorite": False
                        })
                    else:
                        new_id = str(uuid4())
                        name_to_id[tag_entry.lower()] = new_id
                        new_registry.append({
                            "id": new_id,
                            "name": tag_entry,
                            "color": None,
                            "fontColor": None,
                            "favorite": False
                        })
                    registry_modified = True
                else:
                    new_registry.append(tag_entry)

            if registry_modified:
                tag_registry = new_registry

            # Helper: resolve a name to an ID, creating orphan entry if needed
            def _resolve_name(name):
                if not name or not isinstance(name, str):
                    return name
                if _is_uuid(name):
                    return name  # Already an ID
                if _is_system_tag(name):
                    return name  # System tags stay as names
                lower = name.lower()
                if lower in name_to_id:
                    return name_to_id[lower]
                # Orphaned name — create a new registry entry
                new_id = str(uuid4())
                name_to_id[lower] = new_id
                tag_registry.append({
                    "id": new_id,
                    "name": name,
                    "color": None,
                    "fontColor": None,
                    "favorite": False
                })
                return new_id

            # ── Step 2: Convert chit tags from names to IDs ──────────────
            cursor.execute(
                "SELECT id, tags FROM chits WHERE owner_id = ? AND tags IS NOT NULL AND tags != '' AND tags != '[]'",
                (user_id,)
            )
            chit_rows = cursor.fetchall()

            for chit_id, raw_chit_tags in chit_rows:
                chit_tags = deserialize_json_field(raw_chit_tags)
                if not isinstance(chit_tags, list) or not chit_tags:
                    continue

                # Check if already fully converted (all entries are UUIDs or system tags)
                needs_conversion = False
                for tag_val in chit_tags:
                    if isinstance(tag_val, str) and not _is_uuid(tag_val) and not _is_system_tag(tag_val):
                        needs_conversion = True
                        break

                if not needs_conversion:
                    continue

                # Convert each tag
                converted_tags = []
                for tag_val in chit_tags:
                    if not isinstance(tag_val, str) or not tag_val:
                        continue
                    converted_tags.append(_resolve_name(tag_val))

                cursor.execute(
                    "UPDATE chits SET tags = ? WHERE id = ?",
                    (serialize_json_field(converted_tags), chit_id)
                )

            # ── Step 3: Convert settings references ──────────────────────

            settings_modified = False

            # recent_tags: array of name strings → array of Tag_IDs
            recent_tags = deserialize_json_field(raw_recent_tags)
            if isinstance(recent_tags, list) and recent_tags:
                needs_conversion = any(
                    isinstance(t, str) and not _is_uuid(t) and not _is_system_tag(t)
                    for t in recent_tags
                )
                if needs_conversion:
                    recent_tags = [_resolve_name(t) for t in recent_tags if isinstance(t, str)]
                    raw_recent_tags = serialize_json_field(recent_tags)
                    settings_modified = True

            # custom_view_filters: for each view's tags array, convert names to IDs
            custom_view_filters = deserialize_json_field(raw_custom_view_filters)
            if isinstance(custom_view_filters, dict) and custom_view_filters:
                cvf_modified = False
                for view_key, view_config in custom_view_filters.items():
                    if not isinstance(view_config, dict):
                        continue
                    view_tags = view_config.get("tags")
                    if not isinstance(view_tags, list) or not view_tags:
                        continue
                    needs_conversion = any(
                        isinstance(t, str) and not _is_uuid(t) and not _is_system_tag(t)
                        for t in view_tags
                    )
                    if needs_conversion:
                        view_config["tags"] = [_resolve_name(t) for t in view_tags if isinstance(t, str)]
                        cvf_modified = True
                if cvf_modified:
                    raw_custom_view_filters = serialize_json_field(custom_view_filters)
                    settings_modified = True

            # shared_tags: for each entry, convert tag field from name to Tag_ID
            shared_tags = deserialize_json_field(raw_shared_tags)
            if isinstance(shared_tags, list) and shared_tags:
                st_modified = False
                for entry in shared_tags:
                    if not isinstance(entry, dict):
                        continue
                    tag_val = entry.get("tag")
                    if isinstance(tag_val, str) and tag_val and not _is_uuid(tag_val) and not _is_system_tag(tag_val):
                        entry["tag"] = _resolve_name(tag_val)
                        st_modified = True
                if st_modified:
                    raw_shared_tags = serialize_json_field(shared_tags)
                    settings_modified = True

            # kiosk_selected_tags: array of names → array of Tag_IDs
            kiosk_selected_tags = deserialize_json_field(raw_kiosk_selected_tags)
            if isinstance(kiosk_selected_tags, list) and kiosk_selected_tags:
                needs_conversion = any(
                    isinstance(t, str) and not _is_uuid(t) and not _is_system_tag(t)
                    for t in kiosk_selected_tags
                )
                if needs_conversion:
                    kiosk_selected_tags = [_resolve_name(t) for t in kiosk_selected_tags if isinstance(t, str)]
                    raw_kiosk_selected_tags = serialize_json_field(kiosk_selected_tags)
                    settings_modified = True

            # omni_locked_filters: if it has a tags array, convert names to IDs
            omni_locked_filters = deserialize_json_field(raw_omni_locked_filters)
            if isinstance(omni_locked_filters, dict) and omni_locked_filters:
                omni_tags = omni_locked_filters.get("tags")
                if isinstance(omni_tags, list) and omni_tags:
                    needs_conversion = any(
                        isinstance(t, str) and not _is_uuid(t) and not _is_system_tag(t)
                        for t in omni_tags
                    )
                    if needs_conversion:
                        omni_locked_filters["tags"] = [_resolve_name(t) for t in omni_tags if isinstance(t, str)]
                        raw_omni_locked_filters = serialize_json_field(omni_locked_filters)
                        settings_modified = True

            # ── Save updated tag registry (always, since we may have added orphan entries) ──
            cursor.execute(
                "UPDATE settings SET tags = ? WHERE user_id = ?",
                (serialize_json_field(tag_registry), user_id)
            )

            # Save other settings fields if modified
            if settings_modified:
                cursor.execute(
                    """UPDATE settings SET
                        recent_tags = ?,
                        custom_view_filters = ?,
                        shared_tags = ?,
                        kiosk_selected_tags = ?,
                        omni_locked_filters = ?
                    WHERE user_id = ?""",
                    (
                        raw_recent_tags,
                        raw_custom_view_filters,
                        raw_shared_tags,
                        raw_kiosk_selected_tags,
                        raw_omni_locked_filters,
                        user_id,
                    )
                )

            # ── Step 4: Convert rules engine references ──────────────────
            cursor.execute(
                "SELECT id, conditions, actions FROM rules WHERE owner_id = ?",
                (user_id,)
            )
            rule_rows = cursor.fetchall()

            for rule_id, raw_conditions, raw_actions in rule_rows:
                rule_modified = False

                # Convert conditions (recursive tree)
                conditions = deserialize_json_field(raw_conditions)
                if conditions:
                    if _convert_rule_conditions(conditions, _resolve_name):
                        raw_conditions = serialize_json_field(conditions)
                        rule_modified = True

                # Convert actions
                actions = deserialize_json_field(raw_actions)
                if isinstance(actions, list):
                    for action in actions:
                        if not isinstance(action, dict):
                            continue
                        action_type = action.get("type", "")
                        params = action.get("params", {})
                        if not isinstance(params, dict):
                            continue

                        if action_type in ("add_tag", "remove_tag"):
                            tag_val = params.get("tag")
                            if isinstance(tag_val, str) and tag_val and not _is_uuid(tag_val) and not _is_system_tag(tag_val):
                                params["tag"] = _resolve_name(tag_val)
                                rule_modified = True

                if rule_modified:
                    cursor.execute(
                        "UPDATE rules SET conditions = ?, actions = ? WHERE id = ?",
                        (
                            serialize_json_field(conditions) if conditions else raw_conditions,
                            serialize_json_field(actions) if actions else raw_actions,
                            rule_id,
                        )
                    )

        # ── Commit the entire transaction ────────────────────────────────
        conn.commit()
        logger.info("Tag ID system migration complete — all tag references converted to UUIDs")

    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Error in migrate_tags_to_id_system — rolled back: {str(e)}")
        raise
    finally:
        if conn:
            conn.close()


def _convert_rule_conditions(node, resolve_fn):
    """Recursively convert tag name values in rule condition tree to Tag_IDs.

    Returns True if any modification was made.
    """
    if not isinstance(node, dict):
        return False

    modified = False

    # Group node — recurse into children
    if node.get("type") == "group":
        children = node.get("children", [])
        for child in children:
            if _convert_rule_conditions(child, resolve_fn):
                modified = True
        return modified

    # Leaf node — check if it's a tag operator
    operator = node.get("operator", "")
    if operator in ("tag_present", "tag_not_present"):
        value = node.get("value")
        if isinstance(value, str) and value:
            uuid_pat = re.compile(
                r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
                re.IGNORECASE
            )
            if not uuid_pat.match(value) and not value.lower().startswith(("cwoc_system/", "habits/")):
                node["value"] = resolve_fn(value)
                modified = True

    return modified

# ── Seed Extended Color Palette: one-time data migration ─────────────────

def migrate_seed_extended_colors():
    """One-time migration: add the extended color palette to each user's custom_colors.

    The default palette was trimmed to the original 6 colors. All the extra colors
    that were previously hardcoded in various pickers are now seeded into the user's
    custom_colors setting so they remain available everywhere via the unified picker.

    Idempotent — only adds colors that aren't already in the user's custom_colors.
    """
    import json as _json

    # Colors to seed (everything that was in the various palettes minus the 6 defaults)
    SEED_COLORS = [
        "#b22222", "#DAA520", "#D4764E", "#D45B5B", "#C2185B",
        "#7B1FA2", "#512DA8", "#303F9F", "#1976D2", "#0097A7",
        "#00897B", "#388E3C", "#689F38", "#AFB42B", "#F9A825",
        "#FF8F00", "#D84315", "#795548", "#546E7A", "#8D6E63",
        "#E91E63"
    ]

    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # Get all users' settings
        cursor.execute("SELECT user_id, custom_colors FROM settings")
        rows = cursor.fetchall()

        for user_id, custom_colors_raw in rows:
            # Parse existing custom colors
            existing = []
            if custom_colors_raw:
                try:
                    existing = _json.loads(custom_colors_raw)
                    if not isinstance(existing, list):
                        existing = []
                except (ValueError, TypeError):
                    existing = []

            # Normalize existing to lowercase hex set for dedup
            existing_lower = set()
            for c in existing:
                if isinstance(c, str):
                    existing_lower.add(c.lower())
                elif isinstance(c, dict) and c.get("hex"):
                    existing_lower.add(c["hex"].lower())

            # Add seed colors that aren't already present
            added = 0
            for hex_color in SEED_COLORS:
                if hex_color.lower() not in existing_lower:
                    existing.append(hex_color)
                    existing_lower.add(hex_color.lower())
                    added += 1

            if added > 0:
                cursor.execute(
                    "UPDATE settings SET custom_colors = ? WHERE user_id = ?",
                    (_json.dumps(existing), user_id)
                )
                logger.info(f"Seeded {added} extended colors into custom_colors for user {user_id}")

        conn.commit()
    except Exception as e:
        logger.error(f"Error seeding extended colors: {str(e)}")
    finally:
        if conn:
            conn.close()


# ── Badges Table: migration ──────────────────────────────────────────────

def migrate_add_badges_table():
    """Create badges table for persisted smart link detections.

    Stores detected badges (package tracking, flights, hotels, etc.) with
    deduplication on (provider_name, code). Includes indexes on status,
    category, and the provider+code composite.

    Also adds badges_completed_window column to settings table (default "3").

    Fully idempotent — uses CREATE TABLE IF NOT EXISTS and
    CREATE INDEX IF NOT EXISTS, checks column existence before adding.
    """
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # ── Create badges table ──────────────────────────────────────────
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS badges (
                id TEXT PRIMARY KEY,
                chit_id TEXT NOT NULL,
                category TEXT NOT NULL,
                provider_name TEXT NOT NULL,
                code TEXT NOT NULL,
                url TEXT NOT NULL,
                icon TEXT,
                label TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'active',
                detected_at TEXT NOT NULL,
                last_updated_at TEXT NOT NULL,
                completed_at TEXT,
                last_email_subject TEXT,
                UNIQUE(provider_name, code)
            )
        """)

        # ── Create indexes ───────────────────────────────────────────────
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_badges_status ON badges(status)
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_badges_category ON badges(category)
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_badges_provider_code ON badges(provider_name, code)
        """)

        # ── Add badges_completed_window to settings ──────────────────────
        cursor.execute("PRAGMA table_info(settings)")
        settings_cols = {row[1] for row in cursor.fetchall()}

        if "badges_completed_window" not in settings_cols:
            cursor.execute("ALTER TABLE settings ADD COLUMN badges_completed_window TEXT DEFAULT '3'")
            logger.info("Added badges_completed_window column to settings table")

        conn.commit()
        logger.info("Badges table and indexes ready")
    except Exception as e:
        logger.error(f"Error in migrate_add_badges_table: {str(e)}")
        raise
    finally:
        if conn:
            conn.close()


# ── Location Vault Toggle: migration ───────────────────────────────────────

def migrate_add_location_vault_toggle():
    """Add location_shared_to_vault column to chits table.

    When a chit has a location, this flag controls whether the location
    is shared to the vault (visible to all users) or kept private.
    Defaults to true (shared) to match contact behavior.

    Fully idempotent — checks column existence before adding.
    """
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        cursor.execute("PRAGMA table_info(chits)")
        chit_cols = {row[1] for row in cursor.fetchall()}

        if "location_shared_to_vault" not in chit_cols:
            cursor.execute("ALTER TABLE chits ADD COLUMN location_shared_to_vault BOOLEAN DEFAULT 1")
            logger.info("Added location_shared_to_vault column to chits table")

        conn.commit()
    except Exception as e:
        logger.error(f"Error in migrate_add_location_vault_toggle: {str(e)}")
        raise
    finally:
        if conn:
            conn.close()
# ── Multiple Locations: migration ─────────────────────────────────────────

def migrate_add_multiple_locations():
    """Add locations column to chits table for storing multiple locations per chit.

    Each chit can now have multiple locations with labels, geocoded coordinates,
    and a primary flag. The existing 'location' column is preserved as a
    denormalized copy of the primary location address for backward compatibility.

    Data structure: JSON array of LocationEntry objects:
    [
        {"address": "123 Main St", "label": "Home", "lat": 42.123, "lon": -71.456, "is_primary": true},
        {"address": "456 Oak Ave", "label": "Office", "lat": 42.124, "lon": -71.457, "is_primary": false}
    ]

    Migration behavior:
    - If 'locations' column doesn't exist, add it
    - If chit has existing 'location' value but no 'locations', migrate it:
      - Create locations array with single entry
      - Set is_primary = true
      - Copy address to 'location' column (already there, but ensure consistency)

    Fully idempotent — checks column existence before adding.
    """
    import json

    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        cursor.execute("PRAGMA table_info(chits)")
        chit_cols = {row[1] for row in cursor.fetchall()}

        # Add locations column if missing
        if "locations" not in chit_cols:
            cursor.execute("ALTER TABLE chits ADD COLUMN locations TEXT")
            logger.info("Added locations column to chits table")

        # Migrate existing single locations to the new array format
        # Only migrate chits that have a location but no locations array
        cursor.execute("SELECT id, location FROM chits WHERE location IS NOT NULL AND location != '' AND (locations IS NULL OR locations = '')")
        rows_to_migrate = cursor.fetchall()

        for chit_id, location_addr in rows_to_migrate:
            if location_addr and location_addr.strip():
                # Create the locations array with the existing location as primary
                locations_array = json.dumps([{
                    "address": location_addr.strip(),
                    "label": None,
                    "lat": None,
                    "lon": None,
                    "is_primary": True
                }])
                cursor.execute("UPDATE chits SET locations = ? WHERE id = ?", (locations_array, chit_id))

        if rows_to_migrate:
            logger.info(f"Migrated {len(rows_to_migrate)} chits from single location to locations array")

        conn.commit()
        logger.info("Multiple locations migration complete")
    except Exception as e:
        logger.error(f"Error in migrate_add_multiple_locations: {str(e)}")
        raise
    finally:
        if conn:
            conn.close()