import sqlite3
import json
import logging
from datetime import datetime
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from uuid import uuid4
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# FastAPI app
app = FastAPI()

# Database path
DB_PATH = "/app/data/app.db"

# Pydantic Models
class Tag(BaseModel):
    name: str
    color: Optional[str] = None

class Settings(BaseModel):
    user_id: str
    time_format: Optional[str] = None
    sex: Optional[str] = None
    snooze_length: Optional[str] = None
    default_filters: Optional[List[str]] = None
    alarm_orientation: Optional[str] = None
    tags: Optional[List[Tag]] = None
    custom_colors: Optional[List[str]] = None
    visual_indicators: Optional[Dict[str, str]] = None
    chit_options: Optional[Dict[str, bool]] = None

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

# Database initialization
def init_db():
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
            all_day BOOLEAN DEFAULT 0
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
            tags TEXT,
            custom_colors TEXT,
            visual_indicators TEXT,
            chit_options TEXT
        )
        """)
        conn.commit()
    except Exception as e:
        logger.error(f"Error initializing database: {str(e)}")
        raise
    finally:
        conn.close()

# Migration: Rename labels to tags
def migrate_labels_to_tags():
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(chits)")
        columns = [col[1] for col in cursor.fetchall()]
        if "labels" in columns and "tags" not in columns:
            cursor.execute("ALTER TABLE chits RENAME COLUMN labels TO tags")
            conn.commit()
            logger.info("Migrated labels column to tags")
        conn.close()
    except Exception as e:
        logger.error(f"Error migrating labels to tags: {str(e)}")
        raise

# Migration: Add all_day column if missing
def migrate_add_all_day():
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(chits)")
        columns = [col[1] for col in cursor.fetchall()]
        if "all_day" not in columns:
            cursor.execute("ALTER TABLE chits ADD COLUMN all_day BOOLEAN DEFAULT 0")
            conn.commit()
            logger.info("Added all_day column to chits table")
        conn.close()
    except Exception as e:
        logger.error(f"Error adding all_day column: {str(e)}")
        raise

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

# Initialize database and run migrations
init_db()
migrate_labels_to_tags()
migrate_add_all_day()

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

# API Endpoints (remaining unchanged)
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
            chits.append(chit)
        return chits
    except Exception as e:
        logger.error(f"Error fetching chits: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch chits: {str(e)}")
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
        chit_tags = list(set((chit.tags or []) + system_tags))
        cursor.execute(
            """
            INSERT INTO chits (
                id, title, note, tags, start_datetime, end_datetime, due_datetime,
                completed_datetime, status, priority, severity, checklist, alarm, notification,
                recurrence, recurrence_id, location, color, people, pinned, archived,
                deleted, created_datetime, modified_datetime, is_project_master, child_chits, all_day
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                chit_id,
                chit.title,
                chit.note,
                json.dumps(chit_tags),
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

@app.put("/api/chits/{chit_id}")
def update_chit(chit_id: str, chit: Chit):
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM chits WHERE id = ?", (chit_id,))
        existing = cursor.fetchone()
        current_time = datetime.utcnow().isoformat()
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
        chit_tags = list(set((chit.tags or []) + system_tags))
        if existing:
            # Update existing chit
            cursor.execute(
                """
                UPDATE chits SET
                    title = ?, note = ?, tags = ?, start_datetime = ?, end_datetime = ?, due_datetime = ?,
                    completed_datetime = ?, status = ?, priority = ?, severity = ?, checklist = ?, alarm = ?, notification = ?,
                    recurrence = ?, recurrence_id = ?, location = ?, color = ?, people = ?, pinned = ?,
                    archived = ?, deleted = ?, modified_datetime = ?, is_project_master = ?, child_chits = ?, all_day = ?
                WHERE id = ?
                """,
                (
                    chit.title,
                    chit.note,
                    json.dumps(chit_tags),
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
                    deleted, created_datetime, modified_datetime, is_project_master, child_chits, all_day
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    chit_id,
                    chit.title,
                    chit.note,
                    json.dumps(chit_tags),
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
        cursor.execute("UPDATE chits SET deleted = 1 WHERE id = ?", (chit_id,))
        conn.commit()
        return {"message": "Chit deleted successfully"}
    except Exception as e:
        logger.error(f"Error deleting chit: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete chit: {str(e)}")
    finally:
        if conn:
            conn.close()

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
                alarm_orientation, tags, custom_colors, visual_indicators, chit_options
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                settings.user_id,
                settings.time_format,
                settings.sex,
                settings.snooze_length,
                serialize_json_field(settings.default_filters),
                settings.alarm_orientation,
                serialize_json_field(settings.tags),
                serialize_json_field(settings.custom_colors),
                serialize_json_field(settings.visual_indicators),
                serialize_json_field(settings.chit_options)
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

# Health check
@app.get("/health")
def health_check():
    return {"status": "healthy"}
