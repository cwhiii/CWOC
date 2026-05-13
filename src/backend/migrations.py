"""Database migration functions for the CWOC backend.

All migrate_* functions and init_contacts_table() live here.
Each migration checks if the column/table already exists before making changes.
Migrations are called sequentially at startup from main.py.
"""

import logging
import os
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
    default_share_contacts (TEXT DEFAULT '0'): user preference for new contacts.

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
            cursor.execute("ALTER TABLE settings ADD COLUMN default_share_contacts TEXT DEFAULT '0'")
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
        conn.commit()
    except Exception as e:
        logger.error(f"Error adding Omni View settings columns: {str(e)}")
    finally:
        if conn:
            conn.close()
