"""Pydantic models for the CWOC backend.

Defines all request/response models used by the API routes:
Tag, Settings, Chit, MultiValueEntry, Contact, ImportRequest.
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel


class ShareEntry(BaseModel):
    user_id: str
    role: str  # "manager" or "viewer"

class SharedTagEntry(BaseModel):
    tag: str
    shares: List[ShareEntry]

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
    habits_success_window: Optional[str] = "30"  # "7", "30", "90", or "all"
    overdue_border_color: Optional[str] = "#b22222"  # Border color for overdue chits
    blocked_border_color: Optional[str] = "#DAA520"  # Border color for blocked chits
    shared_tags: Optional[Any] = None  # JSON array: [{"tag": "TagName", "shares": [{"user_id": "uuid", "role": "manager"|"viewer"}]}]
    kiosk_users: Optional[Any] = None  # JSON array of usernames for kiosk view
    hide_declined: Optional[str] = "0"  # "0" = show declined (faded), "1" = hide declined
    default_show_habits_on_calendar: Optional[str] = "1"  # "1" = enabled, "0" = disabled
    map_default_lat: Optional[str] = None    # Default map center latitude, e.g. "39.8283"
    map_default_lon: Optional[str] = None    # Default map center longitude, e.g. "-98.5795"
    map_default_zoom: Optional[str] = None   # Default map zoom level (1–18), e.g. "4"
    map_auto_zoom: Optional[str] = "1"       # "1" = auto-zoom to markers, "0" = use custom center/zoom
    email_account: Optional[str] = None      # JSON string: {email, display_name, imap_host, imap_port, smtp_host, smtp_port, username, password_encrypted}
    attachment_max_size_mb: Optional[str] = "10"  # Max attachment file size in MB
    attachment_max_storage_mb: Optional[str] = "500"  # Max total attachment storage per user in MB (0 = unlimited)
    default_share_contacts: Optional[str] = "0"  # "1" = new contacts default to shared vault, "0" = private

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
    habit: Optional[bool] = False                    # Explicit habit opt-in flag
    habit_goal: Optional[int] = 1                    # Completions per period target
    habit_success: Optional[int] = 0                 # Current period completion count
    show_on_calendar: Optional[bool] = True          # Whether habit appears on calendar
    habit_reset_period: Optional[str] = None         # Cooldown: null, "DAILY", "WEEKLY", "MONTHLY"
    habit_last_action_date: Optional[str] = None     # ISO date of last habit increment
    habit_hide_overall: Optional[bool] = False       # Hide overall % badge in view
    perpetual: Optional[bool] = False                # Starts now, continues forever
    shares: Optional[List[Any]] = None         # JSON array: [{"user_id": "uuid", "role": "manager"|"viewer"}]
    stealth: Optional[bool] = False            # When true, hides chit from all non-owner users
    assigned_to: Optional[str] = None          # UUID of the assigned user
    # Email fields (all optional — non-email chits have these as None)
    email_message_id: Optional[str] = None      # RFC 2822 Message-ID
    email_from: Optional[str] = None             # Sender address
    email_to: Optional[str] = None               # JSON array of recipient addresses
    email_cc: Optional[str] = None               # JSON array of CC addresses
    email_bcc: Optional[str] = None              # JSON array of BCC addresses
    email_subject: Optional[str] = None          # Subject line (also mapped to chit title)
    email_body_text: Optional[str] = None        # Plain-text body content
    email_date: Optional[str] = None             # ISO 8601 date from email Date header
    email_folder: Optional[str] = None           # "inbox", "sent", "drafts", "trash"
    email_status: Optional[str] = None           # "draft", "sent", "received"
    email_read: Optional[bool] = None            # Read/unread state
    email_in_reply_to: Optional[str] = None      # In-Reply-To Message-ID
    email_references: Optional[str] = None       # References header (space-separated Message-IDs)
    email_body_html: Optional[str] = None        # HTML body content for rich rendering
    attachments: Optional[str] = None            # JSON array of {id, filename, size, mime_type, uploaded_at}

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
    dates: Optional[List[MultiValueEntry]] = None  # [{label: "Birthday", value: "1990-05-15"}, ...]
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
    shared_to_vault: Optional[bool] = False  # When true, contact is visible to all users
    created_datetime: Optional[str] = None
    modified_datetime: Optional[str] = None

class ImportRequest(BaseModel):
    mode: str   # "add" or "replace"
    data: dict  # The full ExportEnvelope


# ── Multi-User Models ────────────────────────────────────────────────

class UserCreate(BaseModel):
    username: str
    display_name: str
    password: str
    email: Optional[str] = None
    is_admin: Optional[bool] = False

class UserResponse(BaseModel):
    id: str
    username: str
    display_name: str
    email: Optional[str] = None
    is_admin: bool
    is_active: bool
    created_datetime: str

class LoginRequest(BaseModel):
    username: str
    password: str

class ProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    email: Optional[str] = None
    phones: Optional[List[Dict[str, Any]]] = None
    emails_json: Optional[List[Dict[str, Any]]] = None
    addresses: Optional[List[Dict[str, Any]]] = None
    call_signs: Optional[List[Dict[str, Any]]] = None
    x_handles: Optional[List[Dict[str, Any]]] = None
    websites: Optional[List[Dict[str, Any]]] = None
    organization: Optional[str] = None
    social_context: Optional[str] = None
    notes: Optional[str] = None
    nickname: Optional[str] = None
    given_name: Optional[str] = None
    surname: Optional[str] = None
    middle_names: Optional[str] = None
    prefix: Optional[str] = None
    suffix: Optional[str] = None
    has_signal: Optional[bool] = None
    signal_username: Optional[str] = None
    pgp_key: Optional[str] = None
    color: Optional[str] = None
    tags: Optional[List[str]] = None

class PasswordChange(BaseModel):
    current_password: str
    new_password: str


# ── ICS Import Models ────────────────────────────────────────────────────

class ICSImportRequest(BaseModel):
    ics_content: str

class ICSImportResponse(BaseModel):
    imported: int
    skipped: int
    errors: List[str] = []


# ── Notification Model ───────────────────────────────────────────────────

class Notification(BaseModel):
    id: Optional[str] = None
    user_id: str
    chit_id: str
    chit_title: Optional[str] = None
    owner_display_name: Optional[str] = None
    notification_type: str  # "invited" or "assigned"
    status: str = "pending"  # "pending", "accepted", "declined"
    created_datetime: Optional[str] = None
