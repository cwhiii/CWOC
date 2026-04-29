import os
import sqlite3
from fastapi import FastAPI, Form, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from dotenv import load_dotenv
import smtplib
from email.mime.text import MIMEText
import logging
from datetime import datetime

# Setup logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()
PORT = int(os.getenv("PORT", 3334))
DB_PATH = os.getenv("DB_PATH", "app/data/email_client.db")
SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
EMAIL = os.getenv("EMAIL")
PASSWORD = os.getenv("PASSWORD")
FROM_EMAIL = "cwoc-email@cwholemaniii.com"

# Initialize FastAPI
app = FastAPI()

# Mount static files
app.mount("/static", StaticFiles(directory="app/static"), name="static")

# Setup Jinja2 templates
templates = Jinja2Templates(directory="app/frontend")

# Initialize SQLite database
def init_db():
    try:
        db_dir = os.path.dirname(DB_PATH)
        if not os.path.exists(db_dir):
            os.makedirs(db_dir, exist_ok=True)
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS emails (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                subject TEXT,
                body TEXT,
                recipients TEXT,
                sent_datetime DATETIME
            )
        """)
        conn.commit()
    except Exception as e:
        logger.error(f"Error initializing database: {e}")
        raise
    finally:
        conn.close()

init_db()

# Home page
@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM emails ORDER BY sent_datetime DESC")
        emails = [dict(row) for row in cursor.fetchall()]
        current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        default_subject = f"CWOC EMail Test {current_time}"
        default_body = "Emptiness is the night of the soul."
        default_recipients = "cwoc-email@cwholemaniii.com"
        return templates.TemplateResponse(
            "email_index.html",
            {
                "request": request,
                "emails": emails,
                "default_subject": default_subject,
                "default_body": default_body,
                "default_recipients": default_recipients
            }
        )
    except Exception as e:
        logger.error(f"Error fetching emails: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch emails")
    finally:
        conn.close()

# Send email
@app.post("/send", response_class=RedirectResponse)
async def send_email(subject: str = Form(...), body: str = Form(...), recipients: str = Form(...)):
    conn = None
    try:
        # Prepare email
        msg = MIMEText(body)
        msg["Subject"] = subject
        msg["From"] = FROM_EMAIL
        msg["To"] = recipients

        # Send email with valid hostname
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT, timeout=10, local_hostname="localhost") as server:
            server.set_debuglevel(1)  # Enable SMTP debug logs
            server.starttls()
            server.login(EMAIL, PASSWORD)
            server.sendmail(FROM_EMAIL, recipients.split(","), msg.as_string())

        # Store in database
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO emails (subject, body, recipients, sent_datetime) VALUES (?, ?, ?, datetime('now'))",
            (subject, body, recipients)
        )
        conn.commit()
        logger.debug("Email sent and stored successfully")
        return RedirectResponse(url="/", status_code=303)
    except Exception as e:
        logger.error(f"Error sending email: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")
    finally:
        if conn is not None:
            conn.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)
