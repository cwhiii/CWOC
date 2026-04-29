# Keep most of your code the same, but change the order of route registration
import os
import sqlite3
import json
import logging
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from pydantic import BaseModel
from typing import List, Optional, Dict
from uuid import uuid4
from datetime import datetime

# Setup logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()
PORT = int(os.getenv("PORT", 3333))
DB_PATH = os.getenv("DB_PATH", "/app/data/app.db")

# Initialize FastAPI
app = FastAPI()

# Serve static files from /app/static/ at /static/
try:
    app.mount("/static", StaticFiles(directory="/app/static"), name="static")
    logger.debug("Mounted static files at /app/static for /static/")
except Exception as e:
    logger.debug(f"Failed to mount static files at /app/static: {str(e)}")

# Serve database
try:
    app.mount("/data", StaticFiles(directory="/app/data"), name="data")
    logger.debug("Mounted data files at /app/data for /data/")
except Exception as e:
    logger.debug(f"Failed to mount data files at /app/data: {str(e)}")

# Pydantic model for chit - MOVED UP before route definitions
class Chit(BaseModel):
    id: Optional[str] = None
    title: str
    note: Optional[str] = None
    labels: Optional[List[str]] = None
    start_datetime: Optional[str] = None
    end_datetime: Optional[str] = None
    due_datetime: Optional[str] = None
    completed_datetime: Optional[str] = None
    status: Optional[str] = "ToDo"
    priority: Optional[str] = "Medium"
    checklist: Optional[List[Dict]] = None
    alarm: Optional[bool] = False
    notification: Optional[bool] = False
    recurrence: Optional[str] = None
    recurrence_id: Optional[str] = None
    location: Optional[str] = None
    color: Optional[str] = None
    people: Optional[List[str]] = None
    pinned: Optional[bool] = False
    archived: Optional[bool] = False
    deleted: Optional[bool] = False
    created_datetime: Optional[str] = None
    modified_datetime: Optional[str] = None

# Initialize SQLite database
def init_db():
    try:
        db_dir = os.path.dirname(DB_PATH)
        if not os.path.exists(db_dir):
            os.makedirs(db_dir, exist_ok=True)
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS chits (
                id TEXT PRIMARY KEY,
                title TEXT,
                note TEXT,
                labels TEXT,
                start_datetime DATETIME,
                end_datetime DATETIME,
                due_datetime DATETIME,
                completed_datetime DATETIME,
                status TEXT,
                priority TEXT,
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
                created_datetime DATETIME,
                modified_datetime DATETIME
            )
        """)
        conn.commit()
    except Exception as e:
        logger.error(f"Error initializing database: {e}")
        raise
    finally:
        conn.close()

init_db()

# JSON serialization helpers
def serialize_json_field(data):
    return json.dumps(data) if data is not None else None

def deserialize_json_field(data):
    return json.loads(data) if data and data != 'null' else None

# Route handlers for API endpoints
@app.get("/test-static")
async def test_static():
    return {"static_dir_exists": os.path.exists("/app/static")}

# Get a chit by ID
@app.get("/api/chits/{chit_id}")
def get_chit(chit_id: str):
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM chits WHERE id = ?", (chit_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Chit not found")
        chit_data = dict(row)
        chit_data["labels"] = deserialize_json_field(chit_data["labels"])
        chit_data["checklist"] = deserialize_json_field(chit_data["checklist"])
        chit_data["people"] = deserialize_json_field(chit_data["people"])
        return chit_data
    except Exception as e:
        logger.error(f"Error fetching chit {chit_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch chit: {str(e)}")
    finally:
        conn.close()

# Get all chits
@app.get("/api/chits")
def get_all_chits():
    logger.debug("Fetching chits from database")
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        logger.debug("Executing query: SELECT * FROM chits WHERE deleted = 0")
        cursor.execute("SELECT * FROM chits WHERE deleted = 0")
        rows = cursor.fetchall()
        logger.debug(f"Fetched {len(rows)} rows from database")
        chits = []
        for row in rows:
            try:
                chit_data = dict(row)

                # Ensure labels field is properly handled
                try:
                    chit_data["labels"] = deserialize_json_field(chit_data["labels"])
                    if chit_data["labels"] is None:
                        chit_data["labels"] = []
                except Exception as e:
                    logger.warning(f"Error parsing labels for chit {chit_data.get('id')}: {str(e)}")
                    chit_data["labels"] = []

                # Ensure checklist field is properly handled
                try:
                    chit_data["checklist"] = deserialize_json_field(chit_data["checklist"])
                    if chit_data["checklist"] is None:
                        chit_data["checklist"] = []
                except Exception as e:
                    logger.warning(f"Error parsing checklist for chit {chit_data.get('id')}: {str(e)}")
                    chit_data["checklist"] = []

                # Ensure people field is properly handled
                try:
                    chit_data["people"] = deserialize_json_field(chit_data["people"])
                    if chit_data["people"] is None:
                        chit_data["people"] = []
                except Exception as e:
                    logger.warning(f"Error parsing people for chit {chit_data.get('id')}: {str(e)}")
                    chit_data["people"] = []

                chits.append(chit_data)
            except Exception as e:
                logger.error(f"Error processing row: {str(e)}")
                # Continue to next row
                continue

        logger.debug(f"Returning {len(chits)} chits")
        return chits
    except Exception as e:
        logger.error(f"Error fetching all chits: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch chits: {str(e)}")
    finally:
        if 'conn' in locals():
            conn.close()

# Create a chit
@app.post("/api/chits")
def create_chit(chit: Chit):
    try:
        logger.debug(f"Received chit data: {chit.dict()}")
        chit_id = str(uuid4())
        current_time = datetime.utcnow().isoformat()
        # Auto-apply System Labels based on properties
        system_labels = []
        if chit.due_datetime or chit.start_datetime:
            system_labels.append("Calendar")
        if chit.checklist:
            system_labels.append("Checklists")
        if chit.alarm:
            system_labels.append("Alarms")
        if "Project" in (chit.labels or []):
            system_labels.append("Projects")
        if chit.status in ["ToDo", "In Progress", "Blocked", "Complete"]:
            system_labels.append("Tasks")
        if not (chit.due_datetime or chit.start_datetime or chit.end_datetime):
            system_labels.append("Notes")
        # Merge user labels with system labels
        chit_labels = list(set((chit.labels or []) + system_labels))
        logger.debug(f"Computed labels: {chit_labels}")

        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO chits (
                id, title, note, labels, start_datetime, end_datetime, due_datetime, completed_datetime, status,
                priority, checklist, alarm, notification, recurrence, recurrence_id, location, color, people,
                pinned, archived, deleted, created_datetime, modified_datetime
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                chit_id,
                chit.title,
                chit.note,
                serialize_json_field(chit_labels),
                chit.start_datetime,
                chit.end_datetime,
                chit.due_datetime,
                chit.completed_datetime,
                chit.status,
                chit.priority,
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
                current_time
            )
        )
        conn.commit()
        logger.debug(f"Chit {chit_id} created successfully")
        return {**chit.dict(), "id": chit_id, "labels": chit_labels, "created_datetime": current_time, "modified_datetime": current_time}
    except Exception as e:
        logger.error(f"Error creating chit: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create chit: {str(e)}")
    finally:
        conn.close()

# Update a chit
@app.put("/api/chits/{chit_id}")
def update_chit(chit_id: str, chit: Chit):
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM chits WHERE id = ?", (chit_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Chit not found")
        current_time = datetime.utcnow().isoformat()
        # Auto-apply System Labels based on properties
        system_labels = []
        if chit.due_datetime or chit.start_datetime:
            system_labels.append("Calendar")
        if chit.checklist:
            system_labels.append("Checklists")
        if chit.alarm:
            system_labels.append("Alarms")
        if "Project" in (chit.labels or []):
            system_labels.append("Projects")
        if chit.status in ["ToDo", "In Progress", "Blocked", "Complete"]:
            system_labels.append("Tasks")
        if not (chit.due_datetime or chit.start_datetime or chit.end_datetime):
            system_labels.append("Notes")
        chit_labels = list(set((chit.labels or []) + system_labels))
        cursor.execute(
            """
            UPDATE chits SET
                title = ?, note = ?, labels = ?, start_datetime = ?, end_datetime = ?, due_datetime = ?,
                completed_datetime = ?, status = ?, priority = ?, checklist = ?, alarm = ?, notification = ?,
                recurrence = ?, recurrence_id = ?, location = ?, color = ?, people = ?, pinned = ?,
                archived = ?, deleted = ?, modified_datetime = ?
            WHERE id = ?
            """,
            (
                chit.title,
                chit.note,
                serialize_json_field(chit_labels),
                chit.start_datetime,
                chit.end_datetime,
                chit.due_datetime,
                chit.completed_datetime,
                chit.status,
                chit.priority,
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
                chit_id
            )
        )
        conn.commit()
        return {**chit.dict(), "id": chit_id, "labels": chit_labels, "modified_datetime": current_time}
    except Exception as e:
        logger.error(f"Error updating chit: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update chit: {str(e)}")
    finally:
        conn.close()

# Delete a chit
@app.delete("/api/chits/{chit_id}")
def delete_chit(chit_id: str):
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM chits WHERE id = ?", (chit_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Chit not found")
        cursor.execute("UPDATE chits SET deleted = 1, modified_datetime = ? WHERE id = ?", (datetime.utcnow().isoformat(), chit_id))
        conn.commit()
        return {"message": "Chit deleted"}
    except Exception as e:
        logger.error(f"Error deleting chit: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete chit: {str(e)}")
    finally:
        conn.close()

# Serve index.html
@app.get("/")
def get_index():
    return FileResponse("/app/frontend/index.html")

# Serve editor.html
@app.get("/editor")
def get_editor():
    return FileResponse("/app/frontend/editor.html")

# Serve editor.html with chit ID
@app.get("/chit/{chit_id}")
def get_chit_page(chit_id: str):
    return FileResponse("/app/frontend/editor.html")

# Mount frontend files for static assets
# This ensures frontend assets like CSS, JS are available but doesn't override API routes
try:
    app.mount("/frontend", StaticFiles(directory="/app/frontend"), name="frontend")
    logger.debug("Mounted frontend files at /app/frontend for /frontend/")
except Exception as e:
    logger.debug(f"Failed to mount frontend files: {str(e)}")
