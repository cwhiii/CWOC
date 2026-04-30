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
    hide_when_instance_done: Optional[bool] = False  # Hide from Habits view when current period is done
    shares: Optional[List[Any]] = None         # JSON array: [{"user_id": "uuid", "role": "manager"|"viewer"}]
    stealth: Optional[bool] = False            # When true, hides chit from all non-owner users
    assigned_to: Optional[str] = None          # UUID of the assigned user

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

class PasswordChange(BaseModel):
    current_password: str
    new_password: str
