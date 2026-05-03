# CWOC — Complete Code Index

> Auto-generated map of every public function, class, route handler, and CSS section.
> Updated as part of the Mega Restructure (Phase 11).

---

## Table of Contents

1. [Backend (Python)](#1-backend-python)
2. [Frontend JS](#2-frontend-js)
3. [Frontend CSS](#3-frontend-css)
4. [Load Order](#4-load-order)
5. [File Dependency Map](#5-file-dependency-map)

---

## 1. Backend (Python)

All backend code lives under `src/backend/`. Run with:
```bash
uvicorn src.backend.main:app --host 0.0.0.0 --port 3333 --reload
```

### 1.1 `src/backend/__init__.py`
Package marker. No public exports.

### 1.2 `src/backend/main.py` — Entry Point

| Symbol | Description |
|--------|-------------|
| `app` | FastAPI application instance |
| `NoCacheStaticMiddleware` | Middleware that adds no-cache headers to `/frontend/`, `/static/`, `/data/` responses |
| `AuthMiddleware` | (imported from `middleware.py`) Session-based auth middleware — validates `cwoc_session` cookie, injects user identity into `request.state` |
| `on_startup()` | Startup event — calls `start_weather_schedulers()` |
| `serve_service_worker()` | `GET /sw.js` — Serve the service worker from `src/pwa/sw.js` with `Content-Type: application/javascript` and `Service-Worker-Allowed: /` header |
| `serve_manifest()` | `GET /manifest.json` — Serve the web app manifest from `src/pwa/manifest.json` with `Content-Type: application/json` |
| `serve_icon_192()` | `GET /static/cwoc-icon-192.png` — Serve 192×192 PWA icon from `src/pwa/` |
| `serve_icon_512()` | `GET /static/cwoc-icon-512.png` — Serve 512×512 PWA icon from `src/pwa/` |

Registers all route modules (including `auth_router`, `users_router`, `sharing_router`, `notifications_router`, `network_access_router`, `push_router`, and `ntfy_router`), runs all migrations (including `migrate_add_multi_user()`, `migrate_add_sharing()`, `migrate_add_kiosk_users()`, `migrate_add_network_access()`, `migrate_add_notifications()`, `migrate_habits_overhaul()`, `migrate_habits_phase2()`, `migrate_add_push_subscriptions()`, `migrate_add_vapid_keys()`, `migrate_add_map_settings()`, and `migrate_add_contact_dates()`) and `init_db()` at import time, mounts `StaticFiles` for frontend, static, data, and PWA directories.

### 1.3 `src/backend/models.py` — Pydantic Models

| Class | Description |
|-------|-------------|
| `ShareEntry` | Share entry with `user_id: str` and `role: str` (manager or viewer) |
| `SharedTagEntry` | Tag-level share entry with `tag: str` and `shares: List[ShareEntry]` |
| `Tag` | Tag with name, color, fontColor, favorite |
| `Settings` | User settings — time format, tags, colors, indicators, calendar config, audit limits, habits success window, shared_tags, hide_declined, map settings (map_default_lat, map_default_lon, map_default_zoom, map_auto_zoom), etc. |
| `Chit` | Core chit model — title, note, dates, status, checklist, alerts, recurrence, location, color, people, habit, habit_goal, habit_success, show_on_calendar, habit_reset_period, habit_last_action_date, habit_hide_overall, perpetual, shares, stealth, assigned_to, etc. |
| `MultiValueEntry` | Label/value pair for contact multi-value fields (phone, email, etc.) |
| `Contact` | Contact model — name fields, phones, emails, addresses, dates, social, security, notes, tags, color |
| `ImportRequest` | Import envelope — mode ("add"/"replace") + data dict |
| `UserCreate` | Create user request — username, display_name, password, email (optional), is_admin (optional, default False) |
| `UserResponse` | User response — id, username, display_name, email, is_admin, is_active, created_datetime |
| `LoginRequest` | Login request — username, password |
| `ProfileUpdate` | Profile update request — display_name (optional), email (optional) |
| `PasswordChange` | Password change request — current_password, new_password |
| `Notification` | Notification record — `id`, `user_id`, `chit_id`, `chit_title`, `owner_display_name`, `notification_type` ("invited" or "assigned"), `status` ("pending", "accepted", "declined"), `created_datetime` |

### 1.4 `src/backend/db.py` — Database Helpers & Shared State

| Symbol | Description |
|--------|-------------|
| `DB_PATH` | Absolute path to the SQLite database file |
| `CONTACT_IMAGES_DIR` | Absolute path to profile pictures directory |
| `_update_lock` | Threading lock for concurrent update protection |
| `init_db()` | Creates `chits` and `settings` tables if they don't exist |
| `compute_display_name(contact)` | Build display name from contact name fields |
| `serialize_json_field(data)` | Serialize a Python object to a JSON string (or None) |
| `deserialize_json_field(data)` | Deserialize a JSON string to a Python object (or None) |
| `compute_system_tags(chit)` | Auto-assign system tags (Calendar, Tasks, Notes, Habits, Habits/[title], etc.) based on chit properties; adds `Habits` and `Habits/[title]` tags when `habit=True` |
| `get_or_create_instance_id()` | Get or create a persistent instance UUID |
| `_build_export_envelope(data_type, data)` | Wrap data in an export envelope with metadata |
| `get_version_info()` | Read version info from the `version_info` table |
| `update_version_info(version, installed_datetime)` | Write version info |
| `seed_version_info()` | Seed initial version info from `/app/src/VERSION` if table is empty |

### 1.5 `src/backend/migrations.py` — Database Migrations

All migrations run at startup. Each checks if the column/table already exists before altering.

| Function | Description |
|----------|-------------|
| `migrate_labels_to_tags()` | Rename `labels` column to `tags` |
| `migrate_add_all_day()` | Add `all_day` boolean column |
| `migrate_add_alerts()` | Add `alerts` JSON column |
| `migrate_add_calendar_snap()` | Add `calendar_snap` setting column |
| `migrate_add_recurrence_fields()` | Add `recurrence_rule`, `recurrence_exceptions`, `recurrence_id` columns |
| `migrate_add_work_hours()` | Add work hours, week start, enabled periods, and related settings columns |
| `migrate_add_saved_locations()` | Add `saved_locations` setting column |
| `init_contacts_table()` | Create the `contacts` table |
| `migrate_contacts_add_new_fields()` | Add call_signs, x_handles, websites, signal, pgp, social_context, etc. to contacts |
| `migrate_add_progress_and_estimate()` | Add `progress_percent` and `time_estimate` columns to chits |
| `migrate_add_username()` | Add `username` setting column |
| `migrate_add_weather_data()` | Add `weather_data` column to chits and `health_data` column |
| `migrate_add_audit_log()` | Create the `audit_log` table |
| `migrate_add_audit_settings()` | Add `audit_log_max_days` and `audit_log_max_mb` setting columns |
| `migrate_add_default_notifications()` | Add `default_notifications` setting column |
| `migrate_add_standalone_alerts()` | Create the `standalone_alerts` table |
| `migrate_add_alert_state()` | Create the `alert_states` table |
| `migrate_contact_images_to_data()` | Move contact images from `/static/contact_images/` to `data/contacts/profile_pictures/` |
| `migrate_add_habits_fields()` | Add `habits_success_window` column to settings table (legacy — `hide_when_instance_done` removed by `migrate_habits_overhaul`) |
| `migrate_add_border_color_settings()` | Add `overdue_border_color` and `blocked_border_color` setting columns |
| `migrate_add_multi_user()` | Create `users` and `sessions` tables, default admin account, add `owner_id`/`owner_display_name`/`owner_username` columns to chits, add `owner_id` to contacts, reassign existing data to admin user |
| `migrate_add_user_profile_image()` | Add `profile_image_url` column to users table |
| `migrate_add_alerts_owner_id()` | Add `owner_id` column to standalone_alerts and alert_state tables, assign existing rows to admin user |
| `migrate_add_login_message()` | Create `login_message` table for instance login welcome message |
| `migrate_add_instance_name()` | Add `instance_name` column to login_message table |
| `migrate_add_sharing()` | Add `shares` (TEXT), `stealth` (BOOLEAN, default 0), `assigned_to` (TEXT) columns to chits table; add `shared_tags` (TEXT) column to settings table |
| `migrate_add_kiosk_users()` | Add `kiosk_users` (TEXT) column to settings table for kiosk tag selection |
| `migrate_add_hide_declined()` | Add `hide_declined` (TEXT, default '0') column to settings table for hiding declined RSVP chits |
| `migrate_add_network_access()` | Create `network_access` table with columns: `id` (TEXT PRIMARY KEY), `provider` (TEXT NOT NULL UNIQUE), `enabled` (BOOLEAN DEFAULT 0), `config` (TEXT), `created_datetime` (TEXT), `modified_datetime` (TEXT) |
| `migrate_add_notifications()` | Create `notifications` table with columns: `id` (TEXT PRIMARY KEY), `user_id` (TEXT NOT NULL), `chit_id` (TEXT NOT NULL), `chit_title` (TEXT), `owner_display_name` (TEXT), `notification_type` (TEXT NOT NULL), `status` (TEXT NOT NULL DEFAULT 'pending'), `created_datetime` (TEXT NOT NULL); creates index `idx_notifications_user_id` on `user_id` |
| `migrate_habits_overhaul()` | Add `habit` (BOOLEAN DEFAULT 0), `habit_goal` (INTEGER DEFAULT 1), `habit_success` (INTEGER DEFAULT 0), `show_on_calendar` (BOOLEAN DEFAULT 1) columns to chits table; add `default_show_habits_on_calendar` (TEXT DEFAULT '1') column to settings table; remove `hide_when_instance_done` column via table rebuild (copy-to-temp, recreate, copy-back) |
| `migrate_habits_phase2()` | Add `habit_reset_period` (TEXT DEFAULT NULL), `habit_last_action_date` (TEXT DEFAULT NULL), `habit_hide_overall` (BOOLEAN DEFAULT 0), `perpetual` (BOOLEAN DEFAULT 0) columns to chits table |
| `migrate_add_push_subscriptions()` | Create `push_subscriptions` table with columns: `id` (TEXT PRIMARY KEY), `user_id` (TEXT NOT NULL), `endpoint` (TEXT NOT NULL UNIQUE), `p256dh` (TEXT NOT NULL), `auth` (TEXT NOT NULL), `device_label` (TEXT), `created_datetime` (TEXT NOT NULL). Uses `CREATE TABLE IF NOT EXISTS` for idempotency |
| `migrate_add_vapid_keys()` | Ensure `instance_meta` table exists for storing VAPID key pair as key-value rows (`vapid_public_key`, `vapid_private_key`). Uses `CREATE TABLE IF NOT EXISTS` for idempotency |
| `migrate_add_map_settings()` | Add `map_default_lat` (TEXT), `map_default_lon` (TEXT), `map_default_zoom` (TEXT), `map_auto_zoom` (TEXT DEFAULT '1') columns to settings table for map start view configuration |
| `migrate_add_contact_dates()` | Add `dates` (TEXT) column to contacts table for multi-value date entries (Birthday, Anniversary, etc.) stored as JSON |

### 1.6 `src/backend/serializers.py` — vCard & CSV

| Function | Description |
|----------|-------------|
| `vcard_parse(vcard_string)` | Parse a vCard 3.0 string into a contact dict |
| `vcard_print(contact)` | Serialize a contact dict to a vCard 3.0 string |
| `_csv_header()` | Return the CSV column header list for contacts |
| `csv_export(contacts)` | Export a list of contacts as a CSV string |
| `csv_import(csv_text)` | Import contacts from a CSV string; returns (contacts, errors) |

### 1.6b `src/backend/ics_serializer.py` — iCalendar (.ics) Parser & Printer

| Function | Description |
|----------|-------------|
| `_unfold_lines(text)` | RFC 5545 line unfolding — continuation lines starting with space/tab are appended to previous line |
| `_parse_datetime(value, params)` | Parse DTSTART/DTEND/DUE value into structured dict with value, tzid, all_day |
| `_parse_rrule(value)` | Parse RRULE value string into structured dict (freq, interval, byday, until, count) |
| `_parse_property_line(line)` | Parse a single iCalendar property line into (name, params_dict, value) |
| `_parse_component(lines, comp_type)` | Parse property lines of a single VEVENT or VTODO component |
| `ics_parse(ics_text)` | Parse an iCalendar (.ics) file into structured component data; returns dict with components and errors |
| `ics_print(components)` | Serialize a list of parsed component dicts back into valid iCalendar text |
| `_format_dt_property(prop_name, value, tzid, all_day)` | Format a datetime property for iCalendar output |
| `_iso_to_ical(iso_str, all_day)` | Convert ISO date/datetime string back to iCalendar format |
| `_format_rrule(rrule)` | Serialize an RRULE dict back into RFC 5545 RRULE format string |

### 1.7 `src/backend/schedulers.py` — Weather API, Schedulers & Push Notifications

| Function | Description |
|----------|-------------|
| `_send_chit_push(owner_id, chit_id, chit_title, time_label, time_value)` | Send a push notification for a chit event to the chit owner. Imports `send_push_to_user` from push routes; fails silently if pywebpush unavailable |
| `_send_chit_ntfy(owner_id, chit_id, chit_title, time_label, time_value)` | Send an ntfy notification for a chit event to the chit owner. Includes action buttons (Open, Snooze, Dismiss) and CWOC logo as large image attachment. Snooze duration from user settings. Fails silently on error |
| `_get_chit_focus_date(chit)` | Determine the relevant date for weather lookup on a chit |
| `_partition_eligible_chits(chits, now)` | Split chits into 7-day and 8–16 day buckets for weather fetching |
| `_extract_weather_for_date(forecast_daily, focus_date)` | Pull a single day's forecast from the daily forecast array |
| `_sync_weather_fetch(url)` | Synchronous HTTP GET wrapper for weather API calls |
| `_fetch_weather_for_location(lat, lon, days)` | Async fetch of weather forecast for a lat/lon |
| `_geocode_address(address)` | Async geocode an address via Nominatim |
| `weather_update()` | Main weather update — geocodes chit locations, fetches forecasts, writes to DB |
| `_weather_hourly_loop()` | Background loop — runs `weather_update()` every hour for 7-day chits |
| `_weather_daily_loop()` | Background loop — runs `weather_update()` every 24h for 8–16 day chits |
| `_alert_push_loop()` | Background loop — runs every 60 seconds, checks for chits whose start/due time falls within the last 60-second window, sends push notifications to chit owners via `_send_chit_push()` and ntfy notifications via `_send_chit_ntfy()` |
| `start_weather_schedulers()` | Start weather background loops (hourly + daily) and the alert push loop |

### 1.8 `src/backend/test_audit.py` — Audit Diff Property Tests

| Class / Function | Description |
|------------------|-------------|
| `TestProperty1IdenticalDictsEmptyDiff` | Identical dicts produce empty diff (100+ iterations) |
| `TestProperty2DifferingDictsNonEmptyDiff` | Differing dicts produce non-empty diff (100+ iterations) |
| `TestProperty3DiffExcludesBookkeepingFields` | Diff excludes `modified_datetime` and `created_datetime` |
| `TestProperty4ChangesJsonRoundTrip` | Changes list survives JSON round-trip |

### 1.9 `src/backend/test_vcard.py` — vCard Unit Tests

| Function | Description |
|----------|-------------|
| `test_basic_round_trip()` | Full contact round-trips through print → parse → print |
| `test_parse_standard_vcard()` | Parse a standard vCard 3.0 string |
| `test_print_minimal_contact()` | Print a contact with only a given name |
| `test_parse_missing_fields()` | Parse a vCard with only N and FN |
| `test_parse_fn_fallback()` | Fall back to FN when N is missing given_name |
| `test_no_type_parameter()` | Properties without TYPE parameter |
| `test_signal_false()` | X-SIGNAL:false parses as has_signal=False |
| `test_empty_value_entries_skipped()` | Multi-value entries with empty values are skipped |
| `test_address_round_trip()` | Address formatting survives a round-trip |
| `test_favorite_round_trip()` | Favorite flag survives a round-trip |

### 1.9b `src/backend/test_ics.py` — ICS Parser & Printer Unit Tests

| Function | Description |
|----------|-------------|
| `test_basic_vevent_parsing()` | Parse a simple VEVENT with core fields |
| `test_vevent_priority()` | Parse VEVENT with priority value |
| `test_vevent_categories()` | Parse VEVENT with comma-separated categories |
| `test_basic_vtodo_parsing()` | Parse a VTODO with core fields |
| `test_line_unfolding()` | Continuation lines are unfolded |
| `test_tzid_preservation()` | TZID parameter on DTSTART/DTEND is preserved |
| `test_all_day_event()` | DATE-only DTSTART marks event as all-day |
| `test_datetime_event_not_all_day()` | DATE-TIME DTSTART is not all-day |
| `test_rrule_daily()` | Parse RRULE with FREQ=DAILY |
| `test_rrule_weekly_byday()` | Parse RRULE with FREQ=WEEKLY and BYDAY |
| `test_rrule_monthly()` | Parse RRULE with FREQ=MONTHLY |
| `test_rrule_yearly()` | Parse RRULE with FREQ=YEARLY |
| `test_rrule_until()` | Parse RRULE with UNTIL clause |
| `test_rrule_count()` | Parse RRULE with COUNT clause |
| `test_round_trip_vevent()` | Parse → print → parse produces equivalent data |
| `test_round_trip_all_day()` | All-day event round-trips correctly |
| `test_missing_vcalendar()` | Content without BEGIN:VCALENDAR returns error |
| `test_no_components()` | VCALENDAR with no VEVENT/VTODO returns error |
| `test_missing_summary_skipped()` | Component without SUMMARY is skipped with error |
| `test_vtimezone_ignored()` | VTIMEZONE components are silently ignored |
| `test_vjournal_ignored()` | VJOURNAL components are silently ignored |
| `test_valarm_inside_vevent_ignored()` | VALARM nested inside VEVENT is ignored |
| `test_utc_z_suffix()` | DTSTART with Z suffix is parsed correctly |
| `test_multiple_events()` | Multiple VEVENTs are all parsed |
| `test_mixed_vevent_vtodo()` | Mix of VEVENT and VTODO are all parsed |
| `test_print_wraps_vcalendar()` | ics_print wraps output in VCALENDAR |
| `test_print_vevent_fields()` | ics_print outputs all VEVENT fields |

### 1.9c `src/backend/test_ics_import.py` — ICS Import Unit Tests

| Function | Description |
|----------|-------------|
| `test_vevent_basic_mapping()` | VEVENT fields map to correct chit fields |
| `test_vevent_priority_high/medium/low()` | Priority tier mapping (1-4→High, 5→Medium, 6-9→Low) |
| `test_vevent_all_day()` | All-day flag propagates from parser to chit |
| `test_vevent_missing_dtend()` | Missing DTEND defaults to DTSTART |
| `test_vtodo_basic_mapping()` | VTODO fields map to correct chit fields |
| `test_vtodo_status_completed/in_process/needs_action()` | VTODO status mapping |
| `test_rrule_daily/weekly_byday/monthly/yearly()` | Recurrence mapping tests |
| `test_rrule_until_conversion()` | RRULE UNTIL converted to ISO date |
| `test_rrule_count_approximation()` | RRULE COUNT approximated to until date |
| `test_rrule_unsupported_hourly/minutely()` | Unsupported frequencies return None |
| `test_duplicate_detection_match/no_match/vtodo()` | Duplicate detection tests |
| `test_all_duplicates_returns_all()` | All-duplicate file returns all indices |
| `test_deleted_chits_not_considered_duplicates()` | Deleted chits don't trigger duplicates |
| `test_categories_split_into_tags()` | CATEGORIES split into individual tags |
| `test_non_vevent_vtodo_ignored()` | Non-VEVENT/VTODO components ignored |
| `test_missing_summary_skipped_with_error()` | Missing SUMMARY skipped with error |
| `test_import_tag_always_present()` | cwoc_system/imported tag always added |

### 1.10 `src/backend/auth_utils.py` — Password Hashing Utilities

Uses Python stdlib only — `hashlib.pbkdf2_hmac` with SHA-256, `os.urandom` for salt generation. No external dependencies.

| Function | Description |
|----------|-------------|
| `hash_password(password)` | Hash a password with PBKDF2-HMAC-SHA256 (600,000 iterations, 32-byte random salt). Returns `'salt_hex$hash_hex'` string |
| `verify_password(password, stored_hash)` | Verify a password against a stored `'salt_hex$hash_hex'` string using constant-time comparison |

### 1.11 `src/backend/middleware.py` — Authentication Middleware

Session-based authentication middleware for all CWOC requests.

| Symbol | Description |
|--------|-------------|
| `SESSION_COOKIE_NAME` | Cookie name constant: `"cwoc_session"` |
| `_INACTIVITY_SECONDS` | Inactivity timeout: 24 hours (86,400 seconds) |
| `_CLEANUP_INTERVAL` | Periodic cleanup interval: every 100 requests |
| `_is_excluded(path, method)` | Return True if the request path/method should skip auth (static assets, login page, health check, login API, login-message API, kiosk page and API, PWA files: `/sw.js`, `/manifest.json`, `/pwa/*`, `/api/push/vapid-public-key`) |
| `_cleanup_expired_sessions()` | Delete sessions past their `expires_datetime` or inactive > 24h |
| `AuthMiddleware` | Starlette `BaseHTTPMiddleware` subclass — validates `cwoc_session` cookie, injects `request.state.user_id` and `request.state.username`, returns 401 for API paths or redirects to `/login` for page paths |

### 1.12 `src/backend/test_auth.py` — Auth Property Tests

| Class / Function | Description |
|------------------|-------------|
| `TestProperty1PasswordHashRoundTrip` | Password hash round-trip: `verify_password(pw, hash_password(pw))` returns True, stored hash doesn't contain plaintext (100+ iterations) |
| `TestProperty4LoginLogoutSessionLifecycle` | Login creates session, logout invalidates it (100+ iterations) |
| `TestProperty5InvalidCredentialsGeneric401` | Invalid credentials return generic 401 — never reveal whether username or password was wrong (100+ iterations) |
| `TestProperty6UnauthenticatedAPIRequestsReturn401` | Unauthenticated API requests to protected paths return 401 (100+ iterations) |
| `TestProperty10PasswordChangeRequiresCurrentPassword` | Password change requires correct current password, rejects wrong password (100+ iterations) |
| `TestProperty11UserSwitchInvalidatesOldSession` | User switch invalidates old session and creates new one (100+ iterations) |

### 1.13 `src/backend/test_users.py` — User Management Property Tests

| Class / Function | Description |
|------------------|-------------|
| `TestProperty2UserCreationPersistsAllFields` | User creation persists all required fields (100+ iterations) |
| `TestProperty3UsernameUniqueness` | Username uniqueness enforced — duplicate usernames rejected (100+ iterations) |
| `TestProperty13DeactivationReactivationLifecycle` | Deactivation sets `is_active=False` and invalidates sessions; reactivation restores `is_active=True` (100+ iterations) |
| `TestProperty14LastAdminProtection` | Cannot deactivate the last active admin account (100+ iterations) |
| `TestProperty15MultipleConcurrentSessions` | Multiple concurrent sessions per user are supported (100+ iterations) |

### 1.14 `src/backend/test_isolation.py` — Data Isolation Property Tests

| Class / Function | Description |
|------------------|-------------|
| `TestProperty7PerUserDataIsolation` | Per-user data isolation — users cannot see each other's chits or contacts (100+ iterations) |
| `TestProperty8ChitOwnerRecordFromAuthenticatedUser` | Chit owner record populated from authenticated user on creation (100+ iterations) |
| `TestProperty9ProfileUpdateRoundTrip` | Profile update round-trip — display_name and email persist correctly (100+ iterations) |
| `TestProperty16AuditLogRecordsCorrectActor` | Audit log records correct actor from authenticated user (100+ iterations) |

### 1.15 `src/backend/test_migration.py` — Migration Property Tests

| Class / Function | Description |
|------------------|-------------|
| `TestProperty12MigrationIdempotency` | `migrate_add_multi_user()` is idempotent — running multiple times produces no errors and same result (100+ iterations) |

### 1.16 `src/backend/sharing.py` — Permission Resolution Engine

Provides functions to determine a user's effective role on a chit, check edit/delete/manage permissions, and query all chits shared with a given user. Role precedence (highest to lowest): owner > manager > viewer.

| Function | Description |
|----------|-------------|
| `_higher_role(a, b)` | Return whichever role has higher precedence, or the non-None one |
| `resolve_effective_role(chit_row, user_id, owner_settings)` | Determine the effective role for a user on a chit. Resolution order: owner_id match → 'owner'; stealth=True and not owner → None; chit-level shares → role; tag-level shares → role; assigned_to match → 'manager' (floor); else None |
| `can_edit_chit(chit_row, user_id, owner_settings)` | Return True if the user has owner or manager role on the chit |
| `can_delete_chit(chit_row, user_id, owner_settings)` | Return True if the user is the chit owner or has manager role (uses `resolve_effective_role()` internally) |
| `can_manage_sharing(chit_row, user_id, owner_settings)` | Return True if the user is the chit owner or has manager role (uses `resolve_effective_role()` internally and checks for `role in ("owner", "manager")`) |
| `get_shared_chits_for_user(user_id)` | Query all non-deleted, non-stealth chits shared with user_id via chit-level shares, tag-level shares, or assignment; annotates each with `effective_role`, `share_source`, `owner_display_name` (enriched from users table), and `assigned_to_display_name`; raises on error instead of silently returning empty list |
| `_parse_shares(shares_raw)` | Parse the shares column value into a list of dicts |
| `_parse_shared_tags(shared_tags_raw)` | Parse the shared_tags column value into a list of dicts |
| `_parse_chit_tags(tags_raw)` | Parse the chit tags column into a set of tag name strings |
| `_determine_share_source(chit, user_id, owner_settings)` | Determine which sharing path(s) grant access to the user (chit-level, tag-level, assignment, or multiple) |
| `_normalize_share_rsvp(shares)` | Ensure every share entry has a valid `rsvp_status`, defaulting to `"invited"` for entries missing the field |
| `_deserialize_chit_fields(chit)` | Deserialize JSON fields on a chit dict in place; normalizes `rsvp_status` on share entries via `_normalize_share_rsvp` |

### 1.17 `src/backend/test_sharing.py` — Sharing Permission Property Tests

Property-based tests for the chit sharing permission resolution engine. Uses Python stdlib only (unittest + random) — no external libraries. Each property test runs 120+ iterations with randomly generated inputs. Inlines minimal production logic from `sharing.py` to avoid importing backend modules.

| Class / Function | Description |
|------------------|-------------|
| `TestProperty1ViewerAccessIsReadOnly` | Viewer access is read-only — chit-level and tag-level viewer shares return 'viewer' role and `can_edit_chit` returns False (120+ iterations). **Validates: Requirements 1.2, 2.2** |
| `TestProperty2ManagerAccessAllowsEditing` | Manager access allows editing — chit-level and tag-level manager shares return at least 'manager' role and `can_edit_chit` returns True (120+ iterations). **Validates: Requirements 1.3, 2.3** |
| `TestProperty3OnlyOwnerCanDeleteAndManageSharing` | Only owner can delete — non-owners get False for `can_delete_chit`; owners and managers get True for `can_manage_sharing`; only owners get True for `can_delete_chit` (120+ iterations). **Validates: Requirements 1.4, 2.6** |
| `TestProperty4RemovingShareRevokesAccess` | Removing a share revokes access — users with no sharing path get None from `resolve_effective_role` (120+ iterations). **Validates: Requirements 1.5, 2.4, 2.5** |
| `TestProperty5MultiplePathsResolveToHighestRole` | Multiple sharing paths resolve to highest role — highest role wins across chit-level, tag-level, and assignment paths (120+ iterations). **Validates: Requirements 5.1, 5.2** |
| `TestProperty6OwnerAlwaysHasFullControl` | Owner always has full control — owner gets 'owner' role, can edit, delete, and manage sharing regardless of stealth/shares/assigned_to (120+ iterations). **Validates: Requirements 5.3, 6.3** |
| `TestProperty7StealthOverridesAllSharingForNonOwners` | Stealth overrides all sharing for non-owners — stealth chits return None for all non-owners regardless of shares (120+ iterations). **Validates: Requirements 5.4, 6.2** |
| `TestProperty8AssignmentGrantsAtLeastViewerAccess` | Assignment grants at least manager access — assigned users get 'manager' or higher; higher roles from other paths take precedence (120+ iterations). **Validates: Requirements 7.2** |
| `TestProperty9MigrationIdempotentAndPreservesData` | Migration is idempotent and preserves data — running `migrate_add_sharing()` multiple times produces no errors, columns exist, pre-existing data unchanged (120+ iterations). **Validates: Requirements 9.1, 9.2, 9.4** |
| `TestProperty7ManagersCanManageSharing` | Managers can manage sharing — `can_manage_sharing()` returns True for owner and manager roles, False for viewer and None (120+ iterations). **Validates: Requirements 2.1, 2.3, 2.4** |

### 1.17b `src/backend/test_rsvp.py` — RSVP Property Tests

Property-based tests for the chit invitation RSVP system. Uses Python stdlib only (unittest + random) — no external libraries. Each property test runs 120+ iterations with randomly generated inputs. Inlines minimal production logic from `sharing.py` to avoid importing backend modules.

| Class / Function | Description |
|------------------|-------------|
| `TestProperty1RsvpStatusAlwaysValid` | RSVP status is always valid — valid entries remain valid after normalization, missing entries get valid default, mixed entries all become valid, API validation rejects invalid statuses (120+ iterations). **Validates: Requirements 1.1, 1.2** |
| `TestProperty2MissingRsvpNormalized` | Missing rsvp_status normalized to invited — entries without rsvp_status get 'invited' after normalization, including entries with extra fields, minimal entries, and empty dicts; JSON round-trip preserves normalization (120+ iterations). **Validates: Requirements 1.3** |
| `TestProperty3RsvpRoundTripPreservation` | RSVP status round-trip preservation — single and multiple share entries preserve rsvp_status through JSON serialize/deserialize + normalization; all share fields preserved; double round-trip is idempotent (120+ iterations). **Validates: Requirements 1.4** |
| `TestProperty4RsvpUpdateAuthorization` | RSVP update authorization — update succeeds only when user is in shares, not owner, and status is valid; rejected when not in shares (404), when owner (403), or when status is invalid (400) (120+ iterations). **Validates: Requirements 2.4, 2.6, 2.7, 2.8, 6.4** |
| `TestProperty5OwnerExclusionFromRsvp` | Owner exclusion from RSVP — owner is never in shares with rsvp_status, RSVP update from owner is rejected with 403, owner removal from shares preserves other entries (120+ iterations). **Validates: Requirements 2.8** |
| `TestProperty6HideDeclinedFilteringCorrectness` | Hide declined filtering correctness — declined chits are removed, non-declined chits preserved, owned chits never filtered, empty shares not filtered, mixed statuses correctly handled (120+ iterations). **Validates: Requirements 5.2, 7.2** |
| `TestProperty7HideDeclinedSettingRoundTrip` | Hide declined setting round-trip — boolean values survive "0"/"1" string conversion, save and load produce same value, default is "0", only "1" enables hiding (120+ iterations). **Validates: Requirements 5.5** |

### 1.17c `src/backend/test_habits.py` — Habits Overhaul Property Tests

Property-based tests for the habits overhaul feature. Uses Python stdlib only (unittest + random) — no external libraries. Each property test runs 100+ iterations with randomly generated inputs.

| Class / Function | Description |
|------------------|-------------|
| `TestProperty4TagComputation` | Habit tag computation — `compute_system_tags` includes `Habits` and `Habits/[title]` tags when `habit=True`, excludes them when `habit=False` (100+ iterations). **Validates: Properties 4, 5** |
| `TestProperty8HabitSuccessCap` | Habit success cap — `habit_success` never exceeds `habit_goal` after capping logic (100+ iterations). **Validates: Property 8** |
| `TestProperty12SuccessRate` | Success rate calculation — verifies `(periods where habit_success >= habit_goal) / total non-broken-off periods * 100` formula with random period histories (100+ iterations). **Validates: Property 12** |
| `TestProperty13Streak` | Streak calculation — verifies consecutive completed periods walking backward, broken-off periods neutral (100+ iterations). **Validates: Property 13** |
| `TestProperty16MigrationIdempotency` | Migration idempotency — running `migrate_habits_overhaul()` multiple times produces no errors, new columns exist, `hide_when_instance_done` does not exist (100+ iterations). **Validates: Property 16** |
| `TestProperty17CrudRoundTrip` | CRUD round-trip — saving and loading a chit with random `habit`, `habit_goal`, `habit_success`, `show_on_calendar` values returns the same values (100+ iterations). **Validates: Property 17** |

---

### 1.18 `src/backend/routes/__init__.py`
Package marker. No public exports.

### 1.19 `src/backend/routes/chits.py` — Chit CRUD & Import/Export

All chit endpoints are scoped by `owner_id` — users can only access their own chits, plus chits shared with them via the sharing system. The `request.state.user_id` (set by `AuthMiddleware`) is used for ownership filtering, sharing permission checks, and assignment. Uses `resolve_effective_role`, `can_edit_chit`, `can_delete_chit`, and `can_manage_sharing` from `sharing.py` for access control.

| Route | Handler | Description |
|-------|---------|-------------|
| `GET /api/chits` | `get_all_chits(request)` | Return all non-deleted chits owned by the authenticated user |
| `GET /api/chits/search` | `search_chits(q, request)` | Global search across all chit fields, scoped to authenticated user |
| `POST /api/chits` | `create_chit(chit, request)` | Create a new chit with `owner_id`, `owner_display_name`, `owner_username` from authenticated user. Creates notifications for shared users via `_create_share_notifications()` |
| `GET /api/chit/{chit_id}` | `get_chit(chit_id, request)` | Get a single chit by ID (verifies ownership or shared access via `resolve_effective_role`); includes `effective_role` and `assigned_to_display_name` in response |
| `PUT /api/chits/{chit_id}` | `update_chit(chit_id, chit, request)` | Update a chit (verifies ownership or manager access via `can_edit_chit`; managers can persist shares/assigned_to via `can_manage_sharing` guard; stealth is always preserved for non-owners; viewers get 403). Creates notifications for newly shared users via `_create_share_notifications()` |
| `DELETE /api/chits/{chit_id}` | `delete_chit(chit_id, request)` | Soft-delete a chit (owner or manager via `can_delete_chit`; loads owner_settings for role resolution) |
| `PATCH /api/chits/{chit_id}/recurrence-exceptions` | `patch_recurrence_exceptions(chit_id, body, request)` | Add or update a recurrence exception (verifies ownership) |
| `PATCH /api/chits/{chit_id}/rsvp` | `update_rsvp_status(chit_id, body, request)` | Update the current user's RSVP status on a shared chit. Validates `rsvp_status` is one of `invited`, `accepted`, `declined` (400 if invalid). Rejects owner (403). Rejects users not in shares (404). Enforces cross-user RSVP protection (managers cannot update another user's RSVP). Updates the user's `rsvp_status` in the shares JSON, syncs corresponding notification status, saves with `modified_datetime`, logs audit entry. Returns `{ "message": "RSVP status updated", "rsvp_status": "<value>" }` |
| `GET /api/export/chits` | `export_chits(request)` | Export authenticated user's chits as JSON envelope |
| `GET /api/export/userdata` | `export_userdata(request)` | Export authenticated user's settings + contacts as JSON envelope |
| `GET /api/export/all` | `export_all(request)` | Export authenticated user's data (chits + settings + contacts + standalone alerts) as combined JSON envelope |
| `POST /api/import/chits` | `import_chits(req, request)` | Import chits from JSON envelope (scoped to authenticated user) |
| `POST /api/import/userdata` | `import_userdata(req, request)` | Import user data from JSON envelope (scoped to authenticated user) |
| `POST /api/import/all` | `import_all(req, request)` | Import all data from combined JSON envelope (scoped to authenticated user) |

**Internal helpers:**

| Function | Description |
|----------|-------------|
| `_enrich_assigned_to_display_names(cursor, chits)` | Batch-lookup display names for `assigned_to` user IDs and add as `assigned_to_display_name` on each chit dict |

### 1.20 `src/backend/routes/trash.py` — Trash

All trash endpoints are user-scoped: regular users see/act on only their own deleted chits (`owner_id` match). Admins see and can restore/purge any user's deleted chits.

| Route | Handler | Description |
|-------|---------|-------------|
| `GET /api/trash` | `get_trash(request)` | List soft-deleted chits (own only; admins see all) |
| `POST /api/trash/{chit_id}/restore` | `restore_chit(chit_id, request)` | Restore a soft-deleted chit (own only; admins can restore any) |
| `DELETE /api/trash/{chit_id}/purge` | `purge_chit(chit_id, request)` | Permanently delete a chit (own only; admins can purge any) |

| Helper | Description |
|--------|-------------|
| `_is_admin(conn, user_id)` | Check if the given user has admin privileges |

### 1.21 `src/backend/routes/settings.py` — Settings & Alerts

Settings endpoints use `request.state.user_id` from `AuthMiddleware` to scope data to the authenticated user. Includes `shared_tags`, `hide_declined`, and map settings (`map_default_lat`, `map_default_lon`, `map_default_zoom`, `map_auto_zoom`) serialization in settings read/save paths.

| Route | Handler | Description |
|-------|---------|-------------|
| `GET /api/settings/{user_id}` | `get_settings(user_id)` | Get user settings |
| `POST /api/settings` | `save_settings(settings)` | Save user settings (INSERT OR REPLACE) |
| `GET /api/standalone-alerts` | `get_standalone_alerts()` | List independent alerts |
| `POST /api/standalone-alerts` | `create_standalone_alert(body)` | Create an independent alert |
| `PUT /api/standalone-alerts/{alert_id}` | `update_standalone_alert(alert_id, body)` | Update an independent alert |
| `DELETE /api/standalone-alerts/{alert_id}` | `delete_standalone_alert(alert_id)` | Delete an independent alert |
| `GET /api/alert-state` | `get_alert_states()` | Get all non-expired alert states |
| `POST /api/alert-state` | `set_alert_state(body)` | Set dismiss/snooze state for an alert |
| `DELETE /api/alert-state/cleanup` | `cleanup_alert_states()` | Remove expired snooze/dismiss states |

### 1.22 `src/backend/routes/contacts.py` — Contacts

All contact endpoints are scoped by `owner_id` — users can only access their own contacts.

| Route | Handler | Description |
|-------|---------|-------------|
| `POST /api/contacts` | `create_contact(contact, request)` | Create a new contact (sets `owner_id` from authenticated user) |
| `GET /api/contacts` | `get_contacts(q, request)` | List contacts owned by authenticated user (optional search) |
| `GET /api/contacts/export` | `export_contacts(format, request)` | Export authenticated user's contacts as .vcf or .csv |
| `GET /api/contacts/{contact_id}/export` | `export_single_contact(contact_id, format, request)` | Export a single contact (verifies ownership) |
| `GET /api/contacts/{contact_id}` | `get_contact(contact_id, request)` | Get a single contact (verifies ownership) |
| `PUT /api/contacts/{contact_id}` | `update_contact(contact_id, contact, request)` | Update a contact (verifies ownership) |
| `DELETE /api/contacts/{contact_id}` | `delete_contact(contact_id, request)` | Delete a contact (verifies ownership) |
| `POST /api/contacts/{contact_id}/image` | `upload_contact_image(contact_id, file)` | Upload a profile image |
| `DELETE /api/contacts/{contact_id}/image` | `delete_contact_image(contact_id)` | Remove a profile image |
| `PATCH /api/contacts/{contact_id}/favorite` | `toggle_contact_favorite(contact_id, request)` | Toggle favorite status (verifies ownership) |
| `POST /api/contacts/import` | `import_contacts(file, request)` | Import contacts from .vcf or .csv file (scoped to authenticated user) |

**Internal helpers:**

| Function | Description |
|----------|-------------|
| `_serialize_contact_for_db(contact)` | Convert a Contact model to a DB-ready dict |
| `_row_to_contact(row)` | Convert a DB row dict to an API-ready contact dict |
| `_write_vcf_file(contact_id, contact)` | Write a .vcf file for a contact |

### 1.22b `src/backend/routes/ics_import.py` — ICS Calendar Import

| Route | Handler | Description |
|-------|---------|-------------|
| `POST /api/import/ics` | `import_ics(body, request)` | Import iCalendar (.ics) file content as CWOC chits |

**Internal helpers:**

| Function | Description |
|----------|-------------|
| `_map_priority(priority_val)` | Map RFC 5545 priority (1-9) to CWOC priority string (High/Medium/Low) |
| `_map_vtodo_status(ics_status)` | Map iCalendar VTODO STATUS to CWOC chit status |
| `map_component_to_chit(component, user_id, display_name, username)` | Map a parsed ICS component to a CWOC chit dict ready for DB insert |
| `map_rrule_to_recurrence(rrule, start_datetime)` | Translate ICS RRULE dict to CWOC recurrence_rule format |
| `find_duplicates(cursor, user_id, chits)` | Check which mapped chits already exist in the DB (title + datetime match) |

### 1.23 `src/backend/routes/audit.py` — Audit Log

| Route | Handler | Description |
|-------|---------|-------------|
| `GET /api/audit-log` | `get_audit_log(...)` | Query audit entries (filterable, sortable, paginated) |
| `GET /api/audit-log/export` | `export_audit_log_csv(...)` | Export audit log as CSV |
| `DELETE /api/audit-log/trim` | `trim_audit_log(older_than)` | Prune entries older than a date |
| `DELETE /api/audit-log` | `clear_audit_log()` | Delete all audit log entries |
| `POST /api/audit-log/auto-prune` | `auto_prune_audit_log()` | Auto-prune based on settings limits |

**Shared helpers (imported by other route modules):**

| Function | Description |
|----------|-------------|
| `get_actor_from_request(request)` | Build an actor string from `request.state.user_id` and `request.state.username` (set by `AuthMiddleware`). Returns `'username (user_id)'` for audit attribution |
| `get_current_actor()` | Legacy fallback for system-level actions (no request context). Returns `'System'` |
| `compute_audit_diff(old_dict, new_dict, exclude_fields)` | Compute field-level diffs between two dicts |
| `insert_audit_entry(conn, entity_type, entity_id, action, actor, changes, entity_summary)` | Insert an audit log row |
| `_run_auto_prune()` | Internal auto-prune logic |

### 1.24 `src/backend/routes/health.py` — Health, Version, Sync, Pages & Kiosk

| Route | Handler | Description |
|-------|---------|-------------|
| `GET /` | `root()` | Serve `index.html` as the main page |
| `GET /login` | `login_page()` | Serve `login.html` (excluded from auth middleware) |
| `GET /profile` | `profile_page()` | Redirect to `contact-editor.html?mode=profile` |
| `GET /user-admin` | `user_admin_page()` | Serve `user-admin.html` |
| `GET /editor` | `editor(id)` | Serve `editor.html` (accepts `?id=` param) |
| `GET /api/geocode` | `geocode_proxy(q)` | Geocoding proxy to OpenStreetMap Nominatim |
| `POST /api/sync/send` | `sync_send_message(body)` | Post a sync message |
| `GET /api/sync/poll` | `sync_poll(after)` | Poll for sync messages after a given ID |
| `WS /ws/sync` | `websocket_sync(ws)` | WebSocket for real-time sync |
| `GET /api/health-data` | `get_health_data(since, until)` | Return health data points from chits |
| `GET /api/instance-id` | `get_instance_id()` | Get the instance UUID |
| `GET /api/version` | `get_version()` | Get version info |
| `GET /health` | `health_check()` | Health check endpoint |
| `GET /api/update/log` | `get_update_log()` | Get the last update log |
| `GET /api/release-notes` | `get_release_notes()` | Return all release notes as a list of `{version, content}` objects (newest first), scanned from `cwoc_release_*.md` files |
| `GET /api/update/run` | `run_update()` | Run upgrade (SSE stream) |
| `GET /api/kiosk` | `get_kiosk(tags)` | Return combined non-deleted, non-stealth chits matching any of the specified tags (comma-separated, case-insensitive). Unauthenticated endpoint |
| `GET /api/kiosk/config` | `get_kiosk_config()` | Return saved kiosk tag list and `week_start_day` from settings. Prioritises the row with kiosk tags configured. Unauthenticated endpoint |
| `GET /kiosk` | `kiosk_page()` | Serve `kiosk.html` page (unauthenticated) |
| `GET /wall-station` | `wall_station_redirect()` | Legacy redirect → `/kiosk` |
| `GET /api/wall-station` | `wall_station_api_redirect()` | Legacy redirect → `/api/kiosk` |
| `GET /maps` | `maps_page()` | Serve `maps.html` — interactive Leaflet map of chits with locations |

**Internal helpers:**

| Symbol | Description |
|--------|-------------|
| `_SyncHub` | Class managing WebSocket connections and message broadcasting |
| `_sync_geocode_fetch(url)` | Synchronous HTTP GET for geocoding |

### 1.25 `src/backend/routes/auth.py` — Authentication Routes

Provides login, logout, session management, profile updates, password changes, and user switching. Rate limiting is enforced on login attempts using an in-memory dictionary keyed by username.

| Route | Handler | Description |
|-------|---------|-------------|
| `POST /api/auth/login` | `login(body)` | Validate credentials, enforce rate limit (10 attempts / 15 min), create session, set `cwoc_session` cookie |
| `POST /api/auth/logout` | `logout(request)` | Read session token from cookie, delete session row, clear cookie |
| `GET /api/auth/me` | `get_me(request)` | Return authenticated user's profile info (user_id, username, display_name, email, is_admin) |
| `GET /api/auth/user-profile/{user_id}` | `get_user_profile(target_user_id, request)` | Return any active user's public profile (display_name, username, email, profile_image_url, created_datetime, is_self flag). Any authenticated user can view |
| `PUT /api/auth/profile` | `update_profile(body, request)` | Update display_name and/or email for authenticated user |
| `PUT /api/auth/password` | `change_password(body, request)` | Require current_password verification, hash new_password, update user. Returns 403 if current password is wrong |
| `POST /api/auth/switch` | `switch_user(body, request)` | Validate target user credentials, invalidate current session, create new session for target user |
| `GET /api/auth/switchable-users` | `list_switchable_users(request)` | Return minimal list of active users (id, username, display_name, profile_image_url, color) for sharing and people filters |

**Internal helpers:**

| Function | Description |
|----------|-------------|
| `_check_rate_limit(username)` | Return True if the username is rate-limited (≥10 failed attempts in 15 min window) |
| `_record_failed_attempt(username)` | Record a failed login attempt timestamp |
| `_clear_attempts(username)` | Clear failed attempts on successful login |
| `_create_session(conn, user_id)` | Create a new session row and return the token |
| `_set_session_cookie(response, token)` | Set the `cwoc_session` HttpOnly cookie on a response |
| `_clear_session_cookie(response)` | Clear the session cookie on a response |

### 1.26 `src/backend/routes/users.py` — Admin-Only User Management

All endpoints require the requesting user to be an admin (`is_admin=True`); non-admins receive 403.

| Route | Handler | Description |
|-------|---------|-------------|
| `GET /api/users` | `list_users(request)` | List all users (admin only), returns UserResponse list |
| `POST /api/users` | `create_user(body, request)` | Create a new user (admin only), enforce username uniqueness (409 on duplicate) |
| `PUT /api/users/{user_id}/deactivate` | `deactivate_user(user_id, request)` | Deactivate a user (admin only), invalidate all sessions, prevent deactivation of last admin (400) |
| `PUT /api/users/{user_id}/reactivate` | `reactivate_user(user_id, request)` | Reactivate a user (admin only) |
| `PUT /api/users/{user_id}/reset-password` | `reset_password(user_id, body, request)` | Reset a user's password (admin only) |

**Internal helpers:**

| Function | Description |
|----------|-------------|
| `PasswordReset` | Pydantic model for password reset request body (`new_password: str`) |
| `_require_admin(request)` | Check that the requesting user is an admin; return `user_id` if so, raise 403 otherwise |
| `_user_row_to_response(row)` | Convert a user database row to a UserResponse-compatible dict |

### 1.27 `src/backend/routes/sharing.py` — Sharing Management Endpoints

Provides endpoints for managing chit-level shares, querying shared chits, and managing tag-level sharing configuration. All chit-level sharing endpoints are owner-only (verified via `can_manage_sharing`). Includes audit logging for all sharing changes.

| Route | Handler | Description |
|-------|---------|-------------|
| `GET /api/chits/{chit_id}/shares` | `get_chit_shares(chit_id, request)` | Return shares list for a chit with display names (owner only) |
| `PUT /api/chits/{chit_id}/shares` | `set_chit_shares(chit_id, body, request)` | Set entire shares list (owner only); validates role values, user_ids existence, rejects sharing with self; creates notifications for newly shared users via `_create_share_notifications()` |
| `DELETE /api/chits/{chit_id}/shares/{target_user_id}` | `remove_chit_share(chit_id, target_user_id, request)` | Remove a specific user from shares (owner only) |
| `GET /api/shared-chits` | `get_shared_chits(request)` | Return all chits shared with authenticated user, annotated with `effective_role`, `share_source`, and `owner_display_name` |
| `GET /api/settings/shared-tags` | `get_shared_tags(request)` | Return authenticated user's `shared_tags` configuration with display names |
| `PUT /api/settings/shared-tags` | `set_shared_tags(body, request)` | Set authenticated user's `shared_tags` configuration; validates role values and user_ids; persists `tag_permission` field ("view" or "manage") per share entry |

**Internal helpers:**

| Function | Description |
|----------|-------------|
| `_validate_role(role)` | Raise 400 if role is not 'manager' or 'viewer' |
| `_validate_user_ids_exist(cursor, user_ids)` | Raise 400 if any user_id does not exist in the users table |
| `_load_chit_row(cursor, chit_id)` | Load a chit by ID and return as dict; raises 404 if not found |

### 1.28 `src/backend/routes/network_access.py` — Network Access Provider Configuration

Admin-only endpoints for managing network access provider configurations (e.g., Tailscale). Provides CRUD for provider configs stored in the `network_access` table, plus Tailscale-specific service control endpoints (status, up, down). Static Tailscale routes are registered before the `{provider}` catch-all to avoid path parameter conflicts.

| Route | Handler | Description |
|-------|---------|-------------|
| `GET /api/network-access/tailscale/status` | `tailscale_status(request)` | Check Tailscale installation and connection state via subprocess; returns `not_installed`, `installed_inactive`, `active` (with ip/hostname), or `error` (with message) |
| `POST /api/network-access/tailscale/up` | `tailscale_up(request)` | Start Tailscale with saved auth key from DB; runs `tailscale up --authkey=<key>` via subprocess (timeout=30); returns 400 if no auth key, 500 on subprocess failure |
| `POST /api/network-access/tailscale/down` | `tailscale_down(request)` | Stop Tailscale via `tailscale down` subprocess (timeout=15); audit logs the action |
| `GET /api/network-access` | `list_network_access(request)` | List all provider configs from `network_access` table, ordered by provider |
| `GET /api/network-access/{provider}` | `get_network_access(provider, request)` | Get single provider config, or default `{ provider, enabled: false, config: {} }` if not found |
| `POST /api/network-access/{provider}` | `save_network_access(provider, body, request)` | Create/update provider config using `INSERT OR REPLACE`; preserves id on update; audit logs the change |

**Internal helpers:**

| Function | Description |
|----------|-------------|
| `_utcnow_iso()` | Return current UTC time as ISO 8601 string with Z suffix |
| `_require_admin(request)` | Check that the requesting user is an admin; return `user_id` if so, raise 403 otherwise |
| `_row_to_dict(row)` | Convert a `network_access` row to a response dict, deserializing the config JSON |

### 1.29 `src/backend/test_network_access.py` — Network Access Property & Unit Tests

Property-based tests for network access provider configuration. Uses Python stdlib only (unittest + random) — no external libraries. Each property test runs 120+ iterations with randomly generated inputs. Inlines minimal production logic (direct DB operations) to avoid importing FastAPI.

| Class / Function | Description |
|------------------|-------------|
| `TestProperty1ProviderConfigRoundTrip` | Provider config API round-trip — POST then GET returns matching provider, enabled, and config fields (120+ iterations). **Validates: Requirements 1.3, 2.2, 2.4** |
| `TestProperty2GetAllReturnsAllStoredProviders` | GET all returns all stored providers — no missing entries, no duplicates (120+ iterations). **Validates: Requirements 2.1, 8.2** |
| `TestProperty3AuthKeyInTailscaleUpCommand` | Auth key included in tailscale up command — saved auth key appears as `--authkey=<exact_key>` in command args (120+ iterations). **Validates: Requirements 7.4** |
| `TestEdgeCasesAndAdminEnforcement` | Unit tests for migration idempotency, default config for missing provider, admin-only enforcement, no-auth-key error, and provider uniqueness. **Validates: Requirements 1.2, 1.4, 2.3, 2.5, 2.6, 7.3** |

### 1.30 `src/backend/routes/notifications.py` — Notification API Routes

Provides endpoints for listing, updating, and dismissing sharing notifications. Also provides the helper function `_create_share_notifications()` used by `routes/chits.py` and `routes/sharing.py` to create notifications when shares change.

| Route | Handler | Description |
|-------|---------|-------------|
| `GET /api/notifications` | `list_notifications(request)` | List all notifications for the authenticated user, ordered by `created_datetime` DESC (newest first) |
| `PATCH /api/notifications/{id}` | `update_notification(notification_id, body, request)` | Accept or decline a notification (`status: "accepted" \| "declined"`); syncs RSVP on the chit's shares entry; verifies notification belongs to requesting user |
| `DELETE /api/notifications/{id}` | `delete_notification(notification_id, request)` | Dismiss (delete) a notification; verifies notification belongs to requesting user |

**Internal helpers:**

| Function | Description |
|----------|-------------|
| `_create_share_notifications(cursor, chit_id, chit_title, owner_display_name, old_shares, new_shares, assigned_to_new, assigned_to_old)` | Create notification records for each newly shared user. Compares old_shares to new_shares; for each new user_id, inserts a notification row with `notification_type` "assigned" (if user is newly assigned) or "invited" (otherwise). Called by `routes/chits.py` and `routes/sharing.py` |

### 1.31 `src/backend/routes/push.py` — Push Notification API Routes

Provides endpoints for VAPID key retrieval, push subscription management, and sending push notifications to user devices via Web Push. Gracefully degrades when pywebpush is not installed — VAPID key and subscribe endpoints still work, only send fails silently.

| Route | Handler | Description |
|-------|---------|-------------|
| `GET /api/push/vapid-public-key` | `get_vapid_public_key()` | Return VAPID public key for push subscription (no auth required — excluded in middleware) |
| `POST /api/push/subscribe` | `subscribe_push(request)` | Store push subscription for authenticated user (upserts by endpoint) |
| `DELETE /api/push/subscribe` | `unsubscribe_push(request)` | Remove a push subscription by endpoint (user-scoped) |
| `POST /api/push/send` | `send_push(request)` | Internal endpoint to send push notification to a user's devices |

**Module-level state:**

| Symbol | Description |
|--------|-------------|
| `_PUSH_AVAILABLE` | Boolean flag — True if pywebpush is importable |
| `_py_vapid` | Cached `py_vapid` module reference (or None) |
| `_webpush_mod` | Cached `pywebpush` module reference (or None) |

**Helpers:**

| Function | Description |
|----------|-------------|
| `ensure_pywebpush()` | Check if pywebpush is importable and set module-level `_PUSH_AVAILABLE` flag. Called once at module import time. Does NOT attempt to install anything |
| `get_or_create_vapid_keys()` | Generate VAPID keys on first call, retrieve from `instance_meta` thereafter. Tries `py_vapid` first, falls back to `cryptography` library. Returns dict with `public_key` and `private_key` (base64url-encoded) |
| `_generate_vapid_keys_with_py_vapid()` | Generate VAPID keys using `py_vapid` (bundled with pywebpush). Returns `(public_key_b64, private_key_b64)` |
| `_generate_vapid_keys_with_cryptography()` | Generate VAPID keys using the `cryptography` library directly (fallback). Returns `(public_key_b64, private_key_b64)` |
| `send_push_to_user(user_id, payload)` | Send push notification to all of a user's subscribed devices. Automatically removes subscriptions that return 410 Gone. Returns dict with `sent`, `failed`, `cleaned` counts |

### 1.32 `src/backend/test_push.py` — Push Notification Property & Unit Tests

Property-based tests for push notification backend logic. Uses Python stdlib only (unittest + sqlite3 + random + uuid) — no external libraries. Each property test runs 120+ iterations with randomly generated inputs. Inlines minimal production logic (direct DB operations) to avoid importing FastAPI.

| Class / Function | Description |
|------------------|-------------|
| `TestProperty5VapidKeyIdempotence` | VAPID key generation is idempotent — calling `get_or_create_vapid_keys()` N times always returns the same key pair (120+ iterations). **Validates: Requirements 11.1** |
| `TestProperty6SubscriptionRoundTrip` | Push subscription storage round-trip — storing a subscription and querying by user_id returns identical endpoint, p256dh, and auth values; upsert updates existing endpoint (120+ iterations). **Validates: Requirements 11.5** |
| `TestProperty8ExpiredSubscriptionCleanup` | Expired subscriptions removed on 410 — simulating 410 responses removes expired subscriptions while preserving surviving ones (120+ iterations). **Validates: Requirements 11.10** |
| `TestVapidPublicKeyEndpoint` | VAPID public key available without auth — `get_or_create_vapid_keys()` returns a non-empty base64url-encoded public key |
| `TestSubscribeUnsubscribeFlow` | Full subscribe → verify → unsubscribe → verify-gone flow; wrong-user unsubscribe does nothing; multiple devices per user supported |

### 1.33 `src/backend/routes/ntfy.py` — Ntfy Push Notification Sender

Ntfy push notification sender module. Encapsulates all Ntfy notification logic: topic generation, config retrieval, HTTP POST delivery, and API endpoints for status/test/save. Uses Python stdlib only (`urllib.request`, `sqlite3`, `json`). No external dependencies.

| Function / Route | Description |
|------------------|-------------|
| `get_ntfy_topic(user_id)` | Return deterministic topic: `'cwoc-'` + first 12 alphanumeric chars of user_id (hyphens stripped) |
| `get_ntfy_config()` | Read ntfy provider config from `network_access` table. Returns `{'enabled': bool, 'server_url': str}` with default `http://localhost:2586` |
| `send_ntfy_notification(user_id, title, body, click_url, tags, priority, icon_url, actions)` | Send notification via HTTP POST to `{server_url}/{topic}` with X-Title, X-Tags, X-Click, X-Actions headers; 10s timeout; graceful error handling. Returns `{'sent': True, 'topic': str}` or `{'sent': False, 'reason': str}` |
| `get_user_snooze_minutes(user_id)` | Read user's `snooze_length` setting and return as integer minutes. Defaults to 5 |
| `build_ntfy_actions(base_url, chit_id, source_type, snooze_minutes)` | Build X-Actions header string with Open, Snooze, and Dismiss buttons. All `view` type (opens in browser) |
| `GET /api/network-access/ntfy/status` | `ntfy_status(request)` — Check ntfy service reachability via `{server_url}/v1/health`; returns `active`, `disabled`, `unreachable`, or `not_configured` plus `enabled` boolean. Admin only |
| `POST /api/network-access/ntfy/test` | `ntfy_test(request)` — Send test notification ("CWOC Test") to requesting user's topic. Any authenticated user |
| `POST /api/network-access/ntfy` | `save_ntfy_config(body, request)` — Save ntfy config with server_url validation (rejects empty/whitespace-only). Admin only. Audit logged |
| `POST /api/network-access/ntfy/disable` | `disable_ntfy(request)` — Disable ntfy notifications (sets enabled=0, preserves config). Admin only. Audit logged |
| `POST /api/network-access/ntfy/enable` | `enable_ntfy(request)` — Re-enable ntfy notifications (sets enabled=1, preserves config). Admin only. Audit logged |

**Internal helpers:**

| Function | Description |
|----------|-------------|
| `_utcnow_iso()` | Return current UTC time as ISO 8601 string with Z suffix |
| `_require_admin(request)` | Check that the requesting user is an admin; return `user_id` if so, raise 403 otherwise |

### 1.34 `src/backend/test_ntfy.py` — Ntfy Property & Unit Tests

Property-based tests for the ntfy push notification module. Uses Python stdlib only (unittest + sqlite3 + random + uuid) — no external libraries. Each property test runs 120+ iterations with randomly generated inputs. Inlines minimal production logic (direct DB operations) to avoid importing FastAPI.

| Class / Function | Description |
|------------------|-------------|
| `TestGetNtfyTopic` | Unit tests for `get_ntfy_topic()` — standard UUID, prefix check, determinism, hyphen exclusion, short/empty user_id, max length. **Validates: Requirements 2.1, 2.2** |
| `TestGetNtfyConfig` | Unit tests for `get_ntfy_config()` — default when no config, reads saved config, disabled config, default server_url when missing. **Validates: Requirements 1.1, 1.3, 11.4** |
| `TestBuildNtfyRequest` | Unit tests for HTTP request construction — URL construction, trailing slash stripping, X-Title/X-Click/X-Tags headers, body passthrough. **Validates: Requirements 3.1, 3.2, 3.3, 3.4** |
| `TestServerUrlValidation` | Unit tests for server URL validation — empty/whitespace rejection, valid URL acceptance, save rejects invalid, strips whitespace, preserves row ID, config unchanged on invalid. **Validates: Requirements 1.4** |
| `TestSendNtfyNotificationSkip` | Unit tests for skip behavior when ntfy is disabled or not configured. **Validates: Requirements 4.2, 11.5** |
| `TestPBTTopicDeterminismAndFormat` | Property 1: Topic = 'cwoc-' + first 12 alnum chars, deterministic (120 iterations). **Validates: Requirements 2.1, 2.2** |
| `TestPBTWhitespaceURLRejection` | Property 2: Whitespace-only URLs rejected, config unchanged (120 iterations). **Validates: Requirements 1.4** |
| `TestPBTHTTPRequestConstruction` | Property 3: Request URL, headers, body match inputs (120 iterations). **Validates: Requirements 3.1, 3.2, 3.4** |
| `TestPBTTitleDefaulting` | Property 4: Empty/None titles default to "CWOC Reminder" (120 iterations). **Validates: Requirements 4.5** |
| `TestPBTDisabledProviderSkip` | Property 5: Disabled/unconfigured provider always skips (120 iterations). **Validates: Requirements 11.5, 4.2** |

---

## 2. Frontend JavaScript

All frontend JS lives under `src/frontend/js/`. No ES modules — all functions are in global scope, loaded via `<script>` tags.

### 2.1 Shared (`src/frontend/js/shared/`)


#### shared-auth.js

Frontend authentication guard for all CWOC pages. Loads BEFORE `shared-utils.js` in the script order. Runs on every page (except `login.html`) and checks auth status on page load.

| Function | Description |
|----------|-------------|
| `getCurrentUser()` | Returns the cached authenticated user object `{ user_id, username, display_name, email, is_admin }`, or null |
| `isAdmin()` | Returns true if the cached user has admin privileges (`is_admin === true`) |
| `waitForAuth()` | Returns a Promise that resolves to the user object once the auth check completes |

On load: calls `GET /api/auth/me`. If 401: stores current URL in `localStorage` as `cwoc_auth_return`, redirects to `/login`.


#### shared-utils.js

Core utility functions shared across all CWOC pages. Must load after `shared-auth.js` (uses `waitForAuth()` for user-scoped settings).

| Function | Description |
|----------|-------------|
| `getCachedSettings()` | Promise-based settings fetch with caching; waits for auth, then fetches from `/api/settings/{user_id}` using the authenticated user's ID |
| `_invalidateSettingsCache()` | Clear the settings cache to force a fresh fetch on next call |
| `_convertTemp(c)` | Convert Celsius temperature for display based on user's `unit_system` setting (metric → °C, imperial → °F) |
| `_tempUnit()` | Return the temperature unit label (`'°C'` or `'°F'`) based on user's `unit_system` setting |
| `_isMetricUnits()` | Return true if the user's `unit_system` is `'metric'` |
| `_convertWind(kmh)` | Convert wind speed from km/h for display; returns `{ value, unit }` (metric → km/h, imperial → mph) |
| `_tempBarRange()` | Return `{ barMin, barMax }` for temperature bar visuals (metric: -10–40°C, imperial: -14–104°F) |
| `cwocConfirm(message, opts)` | Show a parchment-styled confirm modal; returns a Promise resolving to boolean |
| `generateUniqueId()` | Create a unique ID string from timestamp + random base-36 |
| `formatDate(date)` | Format a Date as `YYYY-Mon-DD` string |
| `formatTime(date)` | Format a Date as `HH:MM` (24-hour locale string) |
| `setSaveButtonUnsaved()` | Mark the CwocSaveSystem save button as unsaved |
| `contrastColorForBg(hex)` | Return dark or light text color for readable contrast on a given background hex |
| `applyChitColors(el, bgColor)` | Apply background color and auto-contrast font color to a DOM element |
| `isLightColor(hex)` | Return true if the given hex color is light (luminance > 140) |
| `_utcToLocalDate(isoString)` | Parse an ISO datetime string into a local Date object |
| `_parseISOTime(isoString)` | Parse an ISO datetime string and return a formatted `HH:MM` time string |
| `getPastelColor(label)` | Generate a deterministic pastel RGB color from a string label |

#### shared-touch.js

Unified touch gesture system for drag and long-press interactions.

| Symbol | Description |
|--------|-------------|
| `TOUCH_DRAG_HOLD_MS` | Duration (ms) user must hold before drag activates (400ms) |
| `TOUCH_LONGPRESS_HOLD_MS` | Duration (ms) user must hold before long-press fires (1200ms) |
| `TOUCH_DRAG_MOVE_THRESHOLD` | Max finger movement (px) allowed during hold period (10px) |
| `enableTouchDrag(element, callbacks, options)` | Drag-only touch adapter (onStart, onMove, onEnd); options: { holdMs, moveThreshold, immediate }; idempotent |
| `enableTouchGesture(element, callbacks, options)` | Unified drag + long-press gesture (onDragStart, onDragMove, onDragEnd, onLongPress); short hold → drag, long hold → action; idempotent |

#### shared-checklist.js

Inline checklist interactions for dashboard views — toggle, move, cross-chit move, and drag-and-drop rendering.

| Function | Description |
|----------|-------------|
| `toggleChecklistItem(chitId, itemIndex, newChecked)` | Toggle a checklist item's checked state and save via API |
| `moveChecklistItem(chitId, fromIndex, toIndex)` | Move a checklist item within a chit's checklist and save |
| `moveChecklistItemCrossChit(fromChitId, fromIndex, toChitId, toIndex)` | Move a checklist item between chits (or within the same chit) and save both |
| `renderInlineChecklist(container, chit, onUpdate)` | Render an interactive checklist with check/uncheck, drag-reorder, and cross-chit drag support |
| `_updateChecklistProgressCount(container, chit)` | Update the "X/Y ✓" progress count element after a checkbox toggle |

#### shared-sort.js

Manual sort order persistence, drag-to-reorder for chit cards, and post-drag click suppression.

| Function | Description |
|----------|-------------|
| `_markDragJustEnded()` | Set `window._dragJustEnded` flag to suppress spurious click/dblclick events after a drag operation; auto-clears after the browser's post-drag click fires |
| *(capture listeners)* | Document-level capture-phase click/dblclick listeners that swallow events on draggable elements while `_dragJustEnded` is true |
| `MANUAL_ORDER_KEY` | LocalStorage key for persisted manual sort orders |
| `getManualOrder(tab)` | Get the saved manual sort order (array of chit IDs) for a view tab |
| `saveManualOrder(tab, ids)` | Save the manual sort order for a view tab to localStorage |
| `applyManualOrder(tab, chitList)` | Sort a chit list according to the saved manual order; new chits go last |
| `enableDragToReorder(container, tab, onReorder, longPressMap)` | Enable mouse and touch drag-to-reorder on chit cards; optional longPressMap (chitId → callback) enables unified drag + long-press via enableTouchGesture |

#### shared-indicators.js

Visual indicator helpers for chit cards and calendar events — alert type detection, icon mapping, and display-mode logic.

| Symbol | Description |
|--------|-------------|
| `_ALERT_TYPES` | Array of valid alert type values: alarm, timer, stopwatch, notification |
| `_chitHasAlerts(chit)` | Return true if a chit has any real alerts (array or legacy boolean flags) |
| `_ALERT_ICON_MAP` | Object mapping alert types to their emoji icons |
| `_STATUS_ICONS` | Object mapping task status strings to Font Awesome HTML icon strings |
| `_getAlertIndicators(chit, settings, context)` | Return alert indicator icon string based on visual_indicators settings and rendering context |
| `_getAllIndicators(chit, settings, context)` | Return all visual indicator icons (alerts + people + health + recurrence) for a chit |
| `_shouldShow(mode, context)` | Return true if a display mode ("always"/"never"/"space") permits showing in a given context |
| `_chitAlertTypesPresent(chit)` | Return an object mapping each alert type to true/false for presence on a chit |

#### shared-calendar.js

Calendar display helpers, drag interactions, multi-day rendering, and pinch zoom.

| Symbol | Description |
|--------|-------------|
| `getCalendarDateInfo(chit)` | Normalize a chit's date info for calendar display; returns start, end, isAllDay, isDueOnly, hasDate |
| `chitMatchesDay(chit, day)` | Check if a chit should appear on a given calendar day |
| `calendarEventTitle(chit, isDueOnly, info, settings, context)` | Build the title HTML for a calendar event with indicator icons; includes owner badge (`👤 owner_display_name`) for shared events |
| `calendarEventTooltip(chit, info)` | Build a tooltip string for a calendar event with time, recurrence info, and owner attribution for shared events |
| `_calSnapMinutes` | Current snap grid interval in minutes (loaded from settings) |
| `_loadCalSnapSetting()` | Load the calendar snap setting from user settings |
| `_snapToGrid(minutes)` | Snap a minute value to the nearest grid interval |
| `_showSnapGrid(container)` | Show a visual snap grid overlay on a calendar container (deferred until first drag movement) |
| `_hideSnapGrid()` | Remove the snap grid overlay |
| `enableCalendarDrag(scrollContainer, dayColumns, days, chitsMap, longPressMap)` | Make timed calendar events draggable (move) and resizable (bottom edge); skips drag/resize for viewer-role shared chits. Optional `longPressMap` (Map of element → long-press callback) enables unified gesture coordination via `enableTouchGesture()` instead of `enableTouchDrag()` for elements with a long-press callback, preventing race conditions between drag and long-press |
| `_onCalDragMove(e)` | Handle mouse/touch move during calendar drag operations |
| `_onCalDragEnd(e)` | Handle mouse/touch end during calendar drag; save new times via API |
| `_showRecurringDragModal(parentId, dateStr, newTimes, virtualChit)` | Show a modal after dragging a recurring instance with apply-scope options |
| `enableMonthDrag(monthGrid, onDrop)` | Enable month view drag — move chits between day cells; prevents drag for viewer-role shared chits |
| `enableAllDayDrag(allDayEventsRow, days)` | Enable drag for all-day events between day cells in the all-day row; prevents drag for viewer-role shared chits |
| `renderAllDayEventsInCells(dayData, allDayEventsRow, settings, context)` | Render all-day events into a CSS Grid row with multi-day spanning and row packing |
| `_calZoomScale` | Current vertical zoom scale for calendar time views |
| `enableCalendarPinchZoom(scrollContainer)` | Enable pinch-to-zoom on a calendar scroll container (vertical axis only) |

#### shared-tags.js

Tag tree utilities, filtering, inline tag creation, system tag detection, and chit link resolution.

| Function | Description |
|----------|-------------|
| `buildTagTree(flatTags)` | Build a nested tag tree from a flat array of tag objects |
| `flattenTagTree(tree, originalNames)` | Flatten a tag tree back to a flat list of leaf tag objects |
| `matchesTagFilter(chitTags, filterTag)` | Check if a chit's tags match a filter tag (including descendants) |
| `renderTagTree(container, tree, selectedTags, onToggle, opts)` | Render a tag tree as an expandable/collapsible HTML tree with checkboxes |
| `trackRecentTag(tagPath)` | Track a tag as recently used (session-level, max 3) |
| `getRecentTags()` | Get the list of recently used tags (up to 3) |
| `createTagInline(name, opts)` | Create a tag inline — adds it to settings if it doesn't already exist |
| `SYSTEM_TAGS` | Array of system tag names that should not appear in user-facing tag lists |
| `isSystemTag(tagName)` | Return true if a tag name is a system tag (flat or `CWOC_System/` prefix) |
| `resolveChitLinks(html, allChits)` | Replace `[[title]]` patterns in HTML with links to matching chits |

#### shared-recurrence.js

Recurrence expansion, formatting, series info computation, and date advancement by frequency.

| Function | Description |
|----------|-------------|
| `_advanceRecurrence(current, freq, interval, byDayNums)` | Advance a Date by one recurrence interval (minutely through yearly) |
| `expandRecurrence(chit, rangeStart, rangeEnd)` | Expand a recurring chit into virtual instances for a date range |
| `formatRecurrenceRule(rule, isHabit)` | Format a recurrence rule as a human-readable string; when isHabit is true, omits day/date suffixes |
| `getRecurrenceSeriesInfo(chit, virtualDate)` | Count occurrence number, total past instances, completed count, and success rate for a series |

#### shared-geocoding.js

Shared geocoding with progressive fallback via the backend Nominatim proxy. Includes a localStorage-backed geocode cache shared across all pages (maps, weather, editor, etc.).

| Function | Description |
|----------|-------------|
| `_loadGeocodeCache()` | Load geocode cache from localStorage on startup |
| `_saveGeocodeCache()` | Persist geocode cache to localStorage |
| `getGeocodeCached(address)` | Get cached `{lat, lon}` for an address, or null if not cached |
| `setGeocodeCache(address, lat, lon)` | Store a geocode result in the shared cache and persist to localStorage |
| `_geocodeAddress(address)` | Geocode an address with progressive fallback (full → no zip → city/state); checks shared cache first, caches results; returns `{lat, lon}` |

#### shared-sidebar-filter.js

Reusable sidebar filter panel component extracted from `main-sidebar.js`. Used by both the dashboard and maps page for tag and people filters.

| Function | Description |
|----------|-------------|
| `CwocSidebarFilter(config)` | Creates a filter panel with search input, hotkey numbers (1-9), favorites-first sorting, and colored badges. Config: `containerId`, `items` (array of `{name, favorite, color?}`), `selection` (mutated array), `onChange`, `searchPlaceholder`, `showColorBadge` |

#### shared-sidebar.js

Shared sidebar component — builds and injects the sidebar DOM, then wires behavior via Page_Context callbacks. Auto-injection runs at parse time if `<body data-sidebar>` is present (mirrors the `shared-page.js` pattern). Each page calls `_cwocInitSidebar(context)` with page-specific callbacks. Contains sidebar toggle, filter section management, notification inbox, topbar toggle, and version footer.

Depends on: `shared.js` (`_isMobileOverlay`, `_showSidebarBackdrop`, `_hideSidebarBackdrop`), `shared-sidebar-filter.js` (`CwocSidebarFilter`, optional).

| Symbol | Description |
|--------|-------------|
| `_cwocSidebarContext` | Module-level state — stored Page_Context object |
| `_notifInboxItems` | Cached notification list for the inbox |
| `_cwocInjectSidebar()` | IIFE that builds and injects the complete sidebar HTML if `<body>` has `data-sidebar` attribute. Produces identical DOM structure, IDs, and classes as the original inline sidebar. Inserts as first child of `<body>` |
| `_cwocInitSidebar(context)` | Initializes sidebar behavior with a Page_Context object containing page-specific callbacks. Wires all button onclick handlers with sensible defaults, populates period dropdown from `context.periodOptions`, restores sidebar state, initializes mobile backdrop, loads tag/people filters, fetches notifications, fetches version for footer |
| `_wireFilterCheckboxes(context)` | Wires filter checkbox `onchange` events (status, priority, display, sharing) to the page's `onFilterChange` callback |
| `toggleSidebar()` | Sidebar open/close toggle with `localStorage` persistence under `sidebarState` key. Handles mobile backdrop show/hide. Dispatches `resize` event after transition |
| `restoreSidebarState()` | Restores sidebar open/closed state from `localStorage` on page load; on mobile (≤768px) always defaults to collapsed |
| `toggleSidebarSection(sectionId)` | Toggle a sidebar section's body visibility (expand/collapse) |
| `expandSidebarSection(sectionId)` | Expand a sidebar section (used by hotkeys) |
| `_toggleFiltersSection()` | Toggle the Filters section open/closed; shows/hides the Clear Filters row |
| `_expandFiltersSection()` | Ensure the Filters section is expanded (used by hotkeys) |
| `toggleFilterGroup(groupId)` | Toggle a filter sub-group's body visibility |
| `expandFilterGroup(groupId)` | Expand a filter sub-group (used by hotkeys) |
| `_toggleTopbar()` | Toggle the topbar (header) visibility with `localStorage` persistence |
| `_restoreTopbarState()` | Restore topbar visibility from `localStorage` on page load |
| `_toggleNotifInbox()` | Toggle the notification inbox expanded/collapsed; re-renders on expand |
| `_fetchNotifications()` | Fetch notifications from `GET /api/notifications` and update the badge + cached list; re-renders inbox if expanded |
| `_updateNotifBadge()` | Update the notification badge count from `_notifInboxItems` (pending count) |
| `_renderNotifInbox()` | Render the notification inbox list with chit title links, owner name, and Accept/Decline buttons |
| `_respondNotification(notifId, status)` | Accept or decline a notification via `PATCH /api/notifications/{id}`; removes from list, updates badge, refreshes chits |
| `_fetchSidebarVersion()` | Fetch version from `/api/version` and populate the sidebar footer link title |

#### shared-qr.js

QR code display modal — single source of truth for all QR display across the app.

| Function | Description |
|----------|-------------|
| `showQRModal(opts)` | Show a QR code in a full-screen modal overlay; accepts title, data, ecl, info, onClose |

#### shared.js (coordinator)

Coordinator for shared code between dashboard and editor. Contains glue code for quick-edit, recurrence actions, notes layout, mobile UI, weather, audio, sync, and the global alarm system.

| Function | Description |
|----------|-------------|
| `showQuickEditModal(chit, onRefresh)` | Quick-edit modal — shift+click on any calendar chit; shows editable dropdowns, recurrence options, and RSVP accept/decline controls for shared chits (calls `PATCH /api/chits/{id}/rsvp`) |
| `_showDeleteSubMenu(actionRow, delBtn, parentId, chitId, dateStr, chit, closeModal, onRefresh)` | Show a delete sub-menu with options: this instance / this and following / all / cancel |
| `showRecurrenceActionModal(chit, onRefresh)` | Backward-compat alias for `showQuickEditModal` |
| `_recurrenceAddException(parentId, exception)` | Add or replace an exception on a recurring chit via PATCH |
| `_checkRecurrenceAutoArchive(parentId)` | Auto-archive a recurring chit if all instances up to end date are completed or broken off |
| `_renderSeriesSummary(container, virtualChit, parentId)` | Render a series summary showing all instances with their completion status |
| `_recurrenceRemoveException(parentId, dateStr)` | Remove an exception for a specific date (e.g., un-complete) |
| `_recurrenceCompleteSeries(parentId)` | Mark the entire recurring series as Complete |
| `_recurrenceBreakOff(parentId, virtualChit, dateStr)` | Break off a single recurring instance into a standalone chit and open in editor |
| `NOTES_CARD_WIDTH` | Default card width constant for notes masonry layout (336px) |
| `NOTES_GAP` | Gap constant between notes cards (10px) |
| `_notesColMetrics(container)` | Calculate column count and actual card width for notes layout (responsive) |
| `_notesColLeft(colIdx, actualCardWidth)` | Get the left px offset for a given column index |
| `_assignMissingCols(cards, colCount)` | Assign initial column to cards that don't have one (shortest column first) |
| `_buildNoteColumns(cards, colCount)` | Build column groups from cards' `data-col` attributes |
| `_stackColumn(colCards, colIdx, actualCardWidth, skipCard)` | Position cards in a single column top-to-bottom |
| `applyNotesLayout(container)` | Apply column-persistent masonry layout to a notes-view container |
| `enableNotesDragReorder(container, tab, onReorder)` | Enable mouse and touch drag-to-reorder on notes cards with column-aware drop; touch uses enableTouchGesture for unified drag + long-press inline edit |
| `_onNotesDragMove(e)` | Handle mouse move during notes drag with live preview |
| `_onNotesDragMoveXY(clientX, clientY)` | Shared drag-move logic for notes reorder (used by both mouse and touch); sets `pointer-events: none` on the dragged card before `elementFromPoint()` calls to prevent the floating card from blocking hit testing in the absolute-positioned masonry layout, then restores it |
| `_onNotesDragEnd(e)` | Handle mouse up during notes drag; save new order |
| `_onNotesDragKey(e)` | Handle ESC key to cancel notes drag |
| `_ensureSidebarBackdrop()` | Ensure the sidebar backdrop element exists in the DOM |
| `_onSidebarBackdropClick()` | Handle click on sidebar backdrop — close sidebar and hide backdrop |
| `_showSidebarBackdrop()` | Show the sidebar backdrop overlay |
| `_hideSidebarBackdrop()` | Hide the sidebar backdrop overlay |
| `_isMobileOverlay()` | Check if the current viewport is in mobile/tablet overlay mode (≤768px) |
| `initMobileSidebar()` | Initialize mobile sidebar overlay behavior with swipe and close button |
| `initMobileActionsModal()` | On mobile, replace header buttons with a single "☰ Actions" trigger and modal |
| `_openMobileActionsModal()` | Open the mobile actions modal and populate with cloned header buttons |
| `enableLongPress(el, callback)` | DEPRECATED: Attach a long-press handler to an element; uses centralized TOUCH_LONGPRESS_HOLD_MS timing. Prefer enableTouchGesture() for new code |
| `initMobileViewsButton()` | On mobile (≤480px), add a "☰ Views" button with a slide-in panel for C CAPTN tabs |
| `initMobileReferenceClose()` | Add a close button inside the reference overlay content for mobile |
| `loadSavedLocations()` | Fetch saved locations from settings and cache for the page lifetime |
| `getDefaultLocation()` | Return the saved location marked as default, or null |
| `getWeatherFromCache(address)` | Get cached 16-day forecast for an address, or null if stale |
| `fetchAndCacheWeather(address)` | Fetch 16-day forecast for an address and store in cache |
| `prefetchSavedLocationWeather()` | Prefetch weather for all saved locations (async, non-blocking) |
| `_saveWeatherCacheToLS()` | Persist weather forecast cache to localStorage |
| `_showDeleteUndoToast(chitId, chitTitle, onExpire, onUndo)` | Show a delete-undo toast with a countdown timer bar |
| `initAudioUnlock()` | Initialize the mobile audio unlock system (resume AudioContext on first gesture) |
| `cwocPlayAudio(audio, opts)` | Play an audio file reliably with retry on blocked playback |
| `initSyncWebSocket()` | Initialize WebSocket sync connection (with HTTP polling fallback) |
| `_startSyncPolling()` | Start HTTP polling fallback for sync |
| `_pollSync()` | Execute a single sync poll request |
| `_dispatchSyncMessage(msg)` | Dispatch a sync message to registered handlers |
| `syncSend(type, data)` | Send a sync message via WebSocket or HTTP POST fallback |
| `syncOn(type, callback)` | Register a handler for a sync message type |
| `_sharedFmtTime(time24)` | Format a 24h time string respecting the user's time format setting |
| `_sharedPlayAlarm()` | Play the alarm sound (looping, with 5-minute auto-stop) |
| `_sharedStopAlarm()` | Stop the alarm sound and vibration |
| `_sharedPlayTimer()` | Play the timer sound (looping) |
| `_sharedStopTimer()` | Stop the timer sound |
| `_sharedGetSnoozeMs()` | Get the snooze duration in milliseconds from settings |
| `_sharedPersistDismiss(key)` | Persist an alert dismiss state to the API |
| `_sharedPersistSnooze(key, untilTs)` | Persist an alert snooze state to the API |
| `_sharedLoadAlertStates()` | Load persisted dismiss/snooze states from the API |
| `_sharedFetchData()` | Fetch chits and independent alerts for the alarm system |
| `_sharedShowAlertModal(opts)` | Show a bold full-screen alert modal with dismiss, snooze, and navigation buttons |
| `_sharedDismissModal(overlay, opts)` | Dismiss and remove an alert modal overlay |
| `_sharedBrowserNotif(title, body, chitId)` | Show a browser notification for an alert |
| `_sharedCheckAlarms()` | The alarm checker — runs every second, checks chit alarms and independent alerts |
| `_initSharedAlarmSync()` | Register sync handlers for alarm_fired, alert_dismissed, alert_snoozed, timer_fired, etc. |
| `_initSharedAlarmSystem()` | Initialize the global alarm system (settings, state, data fetch, interval, sync) |
| `_openQuickAlertModal()` | Open the Quick Alert modal (! hotkey) — context-aware for dashboard vs editor |
| `_closeQuickAlertModal()` | Close the Quick Alert modal |
| `_quickAlertCreate(type)` | Dispatch alert creation by type (alarm/timer/stopwatch) to the correct context (uses `mainEditor` for editor detection) |
| `_quickAlertAddToChit(type)` | Add an alert to the current chit's _alertsData, expand alerts zone, scroll to it, and close modal (editor context) |
| `_quickAlertAddIndependent(type)` | Create an independent alert — delegates to dashboard or direct fetch |
| `_quickAlertAddIndependentDashboard(type)` | Create an independent alert using the dashboard's _createIndependentAlert, then show Done/View buttons |
| `_showQuickAlertCreatedActions(type)` | Replace quick alert modal content with Done and View buttons after creation |
| `_showQuickAlertToast(type)` | Show a brief toast confirming alert creation (non-dashboard pages) |
| `_initSharedHotkeys()` | Register the global keydown listener for !, \`, ~ hotkeys on all pages |
| `getCurrentPeriodDate(chit)` | Return the current period's date as a `YYYY-MM-DD` string for a recurring chit based on its frequency (daily, weekly, monthly, yearly, custom interval) |
| `_getPreviousPeriodDate(chit)` | Return the previous period's date as a `YYYY-MM-DD` string for a recurring chit, one interval before the current period |
| `_evaluateHabitRollover(chit)` | Detect period change for a habit chit; if the current period has advanced, snapshot `habit_success`/`habit_goal` into a recurrence exception for the ended period, reset `habit_success` to 0, and clear Complete status. Returns whether rollover occurred |
| `_persistHabitRollover(chit)` | Persist a habit chit's rollover state to the backend via PUT `/api/chits/{id}` |
| `getHabitSuccessRate(chit, windowDays)` | Calculate the percentage of periods where `habit_success >= habit_goal` within a rolling window (7, 30, 90 days, or "all"); excludes broken-off dates from both numerator and denominator; falls back to legacy `completed` field for old entries |
| `getHabitStreak(chit)` | Count consecutive periods where `habit_success >= habit_goal` walking backward from the most recent past period; broken-off dates are neutral and do not break the streak; handles legacy entries |
| `_buildHabitCounter(opts)` | Build a reusable habit counter widget (HTMLElement) with [−] progress text [+] buttons; accepts `success`, `goal`, `onIncrement`, `onDecrement` callbacks; used by habit cards, habit zone header, and history rows |

#### test_habits_helpers.js — Property Test: getCurrentPeriodDate

| Symbol | Description |
|--------|-------------|
| Property 3 | getCurrentPeriodDate returns a valid current-period date (150+ random iterations + edge cases) |
| **Validates** | Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7 |

#### test_habits_success_rate.js — Property Test: Success Rate Calculation

| Symbol | Description |
|--------|-------------|
| Property 4 | Success rate calculation correctness (120+ random iterations + edge cases) |
| **Validates** | Requirements 4.1, 4.6, 4.7 |

#### test_habits_streak.js — Property Test: Streak Calculation

| Symbol | Description |
|--------|-------------|
| Property 5 | Streak calculation correctness (120+ random iterations + edge cases) |
| **Validates** | Requirements 5.1, 5.2, 5.3, 5.4 |

#### test_habits_sort.js — Property Test: Completion-Based Sort Ordering

| Symbol | Description |
|--------|-------------|
| Property 8 | Completion-based sort ordering (120+ random iterations + edge cases) |
| **Validates** | Requirements 2.7, 2.8, 9.1, 9.2 |

#### shared-calculator.js

Calculator Popover module — a floating, draggable arithmetic calculator available on every CWOC page via `F4`. Provides basic arithmetic with correct operator precedence (`*`/`/` before `+`/`-`), insert-to-field and persist-mode for the editor page. Loaded after `shared.js` and before `shared-page.js` on all pages.

**Public API:**

| Function | Description |
|----------|-------------|
| `cwocToggleCalculator()` | Opens or closes the calculator popover. Captures `document.activeElement` as source field before opening. Creates the popover singleton on first call |
| `cwocIsCalculatorOpen()` | Returns `true` if the calculator is currently visible. Used by ESC chain handlers in `editor-init.js` and `main-init.js` |
| `cwocCloseCalculator()` | Closes the calculator, unchecks Persist, deactivates persist mode. Expression and result state are preserved for the next open |

**Internal Functions:**

| Function | Description |
|----------|-------------|
| `_calcTokenize(expr)` | Tokenize an arithmetic expression string into NUMBER and OP tokens. Handles multi-digit numbers, decimals, and unary minus. Returns null for malformed expressions |
| `_calcParse(tokens)` | Recursive-descent parser respecting standard arithmetic precedence (`*`/`/` before `+`/`-`). Returns numeric result or `'Error'` |
| `_calcEvaluate(expr)` | Evaluate an arithmetic expression string. Tokenizes, parses, and returns a number or `'Error'` for malformed expressions, division by zero, Infinity, or expressions exceeding the 50-character cap |
| `_calcFormatResult(num)` | Format a numeric result for display — rounds to reasonable decimal places and removes trailing zeros |
| `_calcCreatePopover()` | Build the full calculator popover DOM (title bar, display, button grid, insert/persist row) and append to `document.body` as a singleton |
| `_calcOnButton(value)` | Handle a calculator button press — digit, decimal, operator, equals, clear, backspace. Manages expression chaining after equals |
| `_calcUpdateDisplay()` | Update the calculator display with current expression and result. Triggers persist auto-update if active on the editor page |
| `_calcInitDrag(titleBar)` | Attach mouse and touch drag handlers to the title bar for repositioning. Converts right-based to left-based positioning on first drag |
| `_calcClampToViewport(el)` | Clamp the popover element so it stays fully within the visible viewport. Called on every drag move and on window resize |
| `_calcDragStart(clientX, clientY)` | Begin a drag operation — record offset between pointer and popover top-left corner |
| `_calcDragMove(clientX, clientY)` | Reposition the popover during drag and clamp to viewport |
| `_calcDragEnd()` | End the current drag operation |
| `_calcInitKeyboard(popover)` | Attach keydown listener for keyboard input — digits, operators, Enter (equals), Backspace, Escape (close). Stops propagation for handled keys |
| `_calcInitFocusTrap(popover)` | Attach focus-trap keydown listener — Tab/Shift+Tab cycle through focusable elements within the popover only |
| `_calcInsertResult()` | Write the current result into the captured source field (`.value` or `.textContent`). Fires `input` event for dirty-tracking. Silently disables persist if source field is stale |
| `_calcIsEditorPage()` | Returns `true` if the current page is the chit editor (`editor.html` or `/editor` path) |
| `_calcSetupHotkey()` | Register the global `F4` keydown listener. Called once on script load |

**Module-level State:**

| Variable | Description |
|----------|-------------|
| `_calcExpression` | Current expression string, e.g. `"12+3*4"` |
| `_calcResult` | Last computed result as a string |
| `_calcSourceField` | DOM element that had focus when hotkey was pressed |
| `_calcPersistActive` | Whether persist mode is on |
| `_calcPopoverEl` | Reference to the popover DOM element (singleton) |
| `_calcIsOpen` | Whether the popover is currently visible |
| `_calcLastOperatorWasEquals` | Track if last action was `=` for chaining |
| `_calcDragState` | Drag state object — `active`, `offsetX`, `offsetY` |
| `_calcMaxExprLength` | Maximum allowed expression length (50 characters) |
| `_calcDisplaySymbols` | Map of internal operators to display symbols (`*`→`×`, `/`→`÷`) |
| `_calcInternalOps` | Map of display symbols back to internal operators |

**ESC Chain Integration:**
- `editor-init.js`: Calculator check added at the very top of the ESC keydown handler — if `cwocIsCalculatorOpen()`, calls `cwocCloseCalculator()` and returns before all other ESC checks
- `main-init.js`: Same pattern — calculator check before reference overlay, clock modal, and other ESC handlers

### 2.2 Dashboard (`src/frontend/js/dashboard/`)

#### main-sidebar.js

Dashboard sidebar wrapper — thin layer over `shared-sidebar.js`. Registers dashboard-specific Page_Context callbacks and retains dashboard-only filter, sort, tag, and people panel logic. Shared sidebar functions (`toggleSidebar`, `restoreSidebarState`, `toggleSidebarSection`, `expandSidebarSection`, `_toggleFiltersSection`, `_expandFiltersSection`, `toggleFilterGroup`, `expandFilterGroup`, `_toggleNotifInbox`, `_fetchNotifications`, `_updateNotifBadge`, `_renderNotifInbox`, `_respondNotification`, `_toggleTopbar`, `_restoreTopbarState`) are now in `shared-sidebar.js`.

Depends on: `shared-sidebar.js` (`_cwocInitSidebar`, `toggleSidebar`, `restoreSidebarState`, `_restoreTopbarState`, etc.), `shared.js` (`getPastelColor`, `isSystemTag`, `buildTagTree`, `renderTagTree`, `getCachedSettings`), `main.js` globals (`currentTab`, `currentSortField`, `currentSortDir`, `_cachedTagObjects`, `_chitOptions`, `_defaultFilters`, etc.).

| Function | Description |
|----------|-------------|
| `_initDashboardSidebar()` | Registers dashboard-specific Page_Context callbacks with `_cwocInitSidebar()` (onCreateChit, onToday, onPeriodChange, onPreviousPeriod, onNextPeriod, onFilterChange, onClearFilters, onSortChange, onSortDirToggle, onContactsClick, onClockClick, onWeatherClick, onCalculatorClick, onReferenceClick, onHelpClick, periodOptions, loadTagFilters, loadPeopleFilters). Calls `_restoreTopbarState()` after init |
| `onSortSelectChange()` | Handle sort dropdown change — update sort field and re-render |
| `toggleSortDir()` | Toggle sort direction between ascending and descending |
| `_updateSortUI()` | Update the sort direction button text and visibility |
| `onFilterChange()` | Re-render chits and update the clear-filters button after any filter change |
| `onFilterAnyToggle(anyCb)` | When "Any" checkbox is checked, uncheck all specific filter options |
| `onFilterSpecificToggle(filterType)` | When a specific filter option is checked, uncheck "Any"; re-check "Any" if all unchecked |
| `clearFilterGroup(containerId)` | Clear all checkboxes in a filter group and re-check "Any" |
| `_filterTagCheckboxes()` | Filter visible tag checkboxes by the tag search input query |
| `_clearAllFilters()` | Reset all sidebar filters (including sharing filters "Shared with me" / "Shared by me"), sort, and search to defaults |
| `_resetDefaultFilters()` | Reset search to the default filter for the current tab (from settings) |
| `_updateClearFiltersButton()` | Show/hide the clear-filters button based on whether any filters are active (including sharing filters) |
| `_getSelectedFilterValues(containerId, filterType)` | Get an array of checked filter values from a multi-select container |
| `_getSelectedStatuses()` | Get currently selected status filter values |
| `_getSelectedLabels()` | Get currently selected label/tag filter values |
| `_getSelectedPriorities()` | Get currently selected priority filter values |
| `_toggleFilterArchived()` | Toggle the show-archived checkbox via hotkey |
| `_toggleFilterPinned()` | Toggle the show-pinned checkbox via hotkey |
| `_filterFocusSearch()` | Exit hotkey mode, expand filters, and focus the search input |
| `_pickSort(field)` | Set sort field via hotkey and re-render |
| `_buildTagFilterPanel()` | Build the tag filter panel using CwocSidebarFilter with colored tag badges |
| `_syncSidebarTagCheckboxes(container, tagObjects)` | Sync hidden checkbox elements to match the sidebar tag selection array |
| `_buildPeopleFilterPanel()` | Fetch contacts and system users, then render the people filter panel |
| `_renderPeopleFilterPanel(contacts)` | Render people filter chips (contacts + users) into both sidebar and hotkey panel containers |
| `_renderPeopleChipFilter(containerId, contacts, users, selection)` | Render a chip-based people filter into a specific container; user chips get a thicker dark border and user icon |
| `_isPeopleColorLight(hex)` | Check if a people chip color is light (delegates to isLightColor) |
| `clearPeopleFilter()` | Clear the people filter selection and re-render |
| `_loadLabelFilters()` | Load tag/label filters from settings API and render the tag tree in the sidebar |

#### main-hotkeys.js

| Function | Description |
|----------|-------------|
| `_showPanel(panelId)` | Show a hotkey overlay panel by ID |
| `_hideAllPanels()` | Hide all hotkey overlay panels |
| `_dimSidebar(activeId, activeFilterGroupId)` | No-op — legacy sidebar dimming replaced by full-screen overlay panels |
| `_undimSidebar()` | Hide all panels (legacy compat wrapper) |
| `_exitHotkeyMode()` | Exit the current hotkey submenu mode and hide all panels |
| `_pickNav(href)` | Navigate to a page selected from the Navigate hotkey panel |
| `_pickPeriod(period)` | Switch to a calendar period selected from the Period hotkey panel |
| `_applyEnabledPeriods()` | Apply enabled periods — hide disabled options in dropdown and grey out in panels |
| `_openModePanel()` | Build and show the Mode panel (M key) for the current tab's view modes |
| `_enterFilterSub(type)` | Enter a filter sub-panel (status, label, priority, or people) from the Filter hotkey |
| `_buildFilterSubPanel(containerId, checkboxSelector)` | Build a hotkey sub-panel with numbered options mirroring sidebar checkboxes |
| `openHelpPage()` | Navigate to the help page |
| `_toggleReference()` | Toggle the keyboard reference overlay on/off |
| `_closeReference()` | Close the keyboard reference overlay |

#### main-calendar.js

| Function | Description |
|----------|-------------|
| `getWeekStart(date)` | Get the start of the week for a given date (respects week start day setting) |
| `getMonthStart(date)` | Get the first day of the month for a given date |
| `getYearStart(date)` | Get January 1st of the year for a given date |
| `formatDate(date)` | Format a date as "DD Day" for calendar headers (dashboard-specific) |
| `formatWeekRange(start, end)` | Format a week date range as "Mon DD — Mon DD" HTML spans |
| `chitColor(chit)` | Return the display color for a chit (transparent/null → pale cream) |
| `changePeriod()` | Handle period dropdown change — update view and re-render |
| `goToToday()` | Navigate the calendar to today's date |
| `previousPeriod()` | Navigate to the previous calendar period (day/week/month/year) |
| `nextPeriod()` | Navigate to the next calendar period (day/week/month/year) |
| `updateDateRange()` | Update the date range display in the sidebar header |
| `openChitForEdit(chit)` | Open a chit in the editor (handles virtual recurring instances) |
| `attachCalendarChitEvents(el, chit)` | Attach dblclick (edit) and shift+click (quick edit) to a calendar event element; quick-edit is disabled for viewer-role shared chits. No longer calls `enableLongPress()` — long-press callbacks are now passed through to `enableCalendarDrag()` via `longPressMap` for unified gesture coordination |
| `attachEmptySlotCreate(col, day, defaultDurationMin)` | Attach dblclick on empty calendar space to create a new chit at that time |
| `_getResponsiveDayCount()` | Return the number of days to show in week view (always 7) |
| `displayWeekView(chitsToDisplay, opts)` | Render the week calendar view with hour grid, all-day events, and timed events |
| `displayWorkView(chitsToDisplay)` | Render the work hours calendar view (filtered days and hours) |
| `displayMonthView(chitsToDisplay)` | Render the month calendar grid view |
| `displayItineraryView(chitsToDisplay)` | Render the itinerary (agenda) view — future events sorted chronologically |
| `displayDayView(chitsToDisplay, opts)` | Render the single-day calendar view with hour grid |
| `displayYearView(chitsToDisplay)` | Render the year overview with heat-map colored day cells |
| `_addAllDayHeightCap(eventsRow, container)` | Cap the all-day events area height and add a Show More/Less toggle |
| `scrollToSixAM()` | Scroll the time-based view to the configured scroll-to hour |
| `renderTimeBar(viewType)` | Render and maintain a "current time" bar in time-based views |
| `displaySevenDayView(chitsToDisplay, opts)` | Render the X-day view (same as week but always starts from today) |
| `_checkWeatherNavIntent()` | Check for weather page → Day view navigation intent in sessionStorage |
| `_executeWeatherFlash()` | Poll for rendered chit elements then flash chits at a weather location |
| `_flashChitsAtLocation(location)` | Flash-highlight calendar chits matching a given location |

#### main-views.js

| Function | Description |
|----------|-------------|
| `_isViewerRole(chit)` | Check if a chit is shared with viewer-only access (no inline edits allowed) |
| `_isSharedChit(chit)` | Check if a chit is shared (has an `effective_role` from the sharing system) |
| `_getUserRsvpStatus(chit)` | Returns the current user's `rsvp_status` from a chit's shares array, or `null` if the user is not a shared user (e.g. owner or not in shares) |
| `_isDeclinedByCurrentUser(chit)` | Returns true if the current user has declined this shared chit; returns false for owned chits (owners don't have RSVP status) |
| `_emptyState(message)` | Build a styled empty-state message with an optional Create Chit button |
| `_getTagColor(tagName)` | Get tag color from cached settings tags, fallback to pastel |
| `_getTagFontColor(tagName)` | Get tag font color from cached settings tags, fallback to dark brown |
| `_buildChitHeader(chit, titleHtml, settings, opts)` | Build a standard chit card header row with icons, indicators, title, meta, 🔗 shared icon with tooltip (owner, shared users with roles, current user's role) for shared chits, stealth indicator, assignee badge, RSVP status indicators (⏳/✓/✗ per shared user), and RSVP accept/decline action buttons for shared users (calls `PATCH /api/chits/{id}/rsvp`) |
| `_renderChitMeta(chit, mode)` | Legacy compact meta builder — kept for backward compat |
| `_buildNotePreview(chit, extraStyle)` | Build an expandable note preview element with "show more/less" toggle for mobile |
| `displayChecklistView(chitsToDisplay)` | Render the Checklists tab — chits with interactive checklist items |
| `displayTasksView(chitsToDisplay)` | Render the Tasks tab — chits with status dropdowns and note previews; dispatches to `displayHabitsView` when in habits mode |
| `displayHabitsView(chitsToDisplay)` | Render the Habits view — filters by `chit.habit === true`, evaluates period rollover, renders habit cards in 3 sections (🔜 On Deck, 😌 Out of Mind, ✅ Accomplished) with metric boxes, note preview, and debounced save |
| `_isResetPeriodActive(chit)` | Check if a habit's reset period cooldown is currently active (user acted within the current Daily/Weekly/Monthly period) |
| `_getResetEndDate(chit)` | Calculate the date when a habit's reset period ends based on `habit_reset_period` and `habit_last_action_date`; returns null if no reset period or no last action date |
| `_habitUrgencyScore(h)` | Calculate urgency score for a habit (lower = more urgent): days until next action needed = time left in cycle / remaining completions; used to sort On Deck habits |
| `_getTodayISO()` | Get today's date as an ISO string (YYYY-MM-DD) |
| `_renderHabitCards(container, habitChits, windowDays)` | Render habit cards into a container with 3-section sorting: 🔜 On Deck (sorted by urgency via `_habitUrgencyScore`), 😌 Out of Mind (reset period active), ✅ Accomplished (complete); cards show metric boxes (📊 Progress with [−][+], 🎯 Cycle %, 📈 Overall %, 🔥 Streak), note preview (markdown, 7-line max), period label; fade-out animation between sections; debounced save on increment/decrement |
| `_persistHabitUpdate(chit)` | Persist a habit chit's updated `habit_success` and status to the backend via PUT `/api/chits/{id}` |
| `displayNotesView(chitsToDisplay)` | Render the Notes tab — markdown notes in a masonry column layout |
| `displayAssignedToMeView(chitsToDisplay)` | Render the "Assigned to Me" view — chits where `assigned_to` matches the current user's ID, with owner badges and role indicators |
| `_setProjectsMode(mode)` | Set Projects view mode (list or kanban) and re-render |
| `_restoreViewModeButtons()` | Restore view mode button highlights for Projects, Alarms, and Tasks tabs |
| `_setAlarmsMode(mode)` | Set Alarms view mode (list or independent) and re-render |
| `_setTasksMode(mode)` | Set Tasks view mode (tasks, habits, or assigned), persist to localStorage, update button highlights, and re-render |
| `_tasksViewMode` | Current Tasks view mode string (`'tasks'`, `'habits'`, or `'assigned'`), loaded from localStorage |
| `_fetchIndependentAlerts()` | Fetch independent alerts from the API and cache locally |
| `_createIndependentAlert(alertData)` | Create a new independent alert via API and refresh the view |
| `_updateIndependentAlert(id, alertData)` | Update an existing independent alert via API and refresh |
| `_deleteIndependentAlert(id)` | Delete an independent alert, clean up runtime state, and refresh |
| `displayProjectsView(chitsToDisplay)` | Render the Projects tab — list view of project masters with draggable child chits (reorder, touch gesture, long-press quick-edit); list mode now includes project-level HTML5 drag and `enableTouchGesture()` on project boxes for reorder, plus `onLongPress` for quick-edit |
| `_displayProjectsKanban(chitsToDisplay)` | Render the Projects Kanban view — status columns with drag-and-drop cards; attaches `enableTouchGesture()` to `.kanban-project-header` elements for touch drag-to-reorder of projects with `onLongPress` to open the editor |
| `displayAlarmsView(chitsToDisplay)` | Render the Alarms tab — list of chits with alerts, or independent alerts board |
| `_displayIndependentAlertsBoard()` | Render the independent alerts board with Alarms, Timers, and Stopwatches columns; now includes HTML5 drag and `enableTouchGesture()` on `.sa-card` elements for drag-to-reorder within each type column, with order persisted to localStorage |
| `_addIndependentAlert(type)` | Create a new independent alert of the given type with sensible defaults |
| `_buildIndependentCard(id, type, data)` | Build an independent alert card element and delegate to type-specific builder |
| `_parseTimeInput(str)` | Parse various time input formats ("HH:MM", "H:MM AM/PM") into 24h "HH:MM" |
| `_buildSaAlarmCard(card, id, data)` | Build the UI for an independent alarm card (name, time, days, snooze bar) |
| `_saFmtTimer(s, tenths)` | Format seconds (with optional tenths) as HH:MM:SS display string |
| `_buildSaTimerCard(card, id, data)` | Build the UI for an independent timer card (duration inputs, countdown bar, controls) |
| `_saSwFmt(ms)` | Format milliseconds as HH:MM:SS.cc stopwatch display string |
| `_buildSaStopwatchCard(card, id, data)` | Build the UI for an independent stopwatch card (display, start/pause/lap/reset) |
| `_renderSaLaps(container, laps)` | Render lap times list inside a stopwatch card |
| `filterChits(tab)` | Switch to a tab, update sidebar visibility, and re-render chits |
| `searchChits()` | Trigger a re-render of chits (called from sidebar search input) |
| `highlightMatch(text, query)` | HTML-escape text and wrap query matches in `<mark>` tags |
| `displayIndicatorsView()` | Render the Indicators tab — health trend charts with responsive SVG, grid-based latest cards |
| `_indSaveSelection()` | Persist selected indicator checkboxes to localStorage |
| `_indRestoreSelection()` | Restore indicator checkbox selection from localStorage |
| `_indFmtDate(d)` | Format a Date as YYYY-MM-DD string for indicator date inputs |
| `_indicatorsSetRange(range)` | Set the indicator time range (day/week/month/year/all) and reload |
| `_indicatorsHighlightBtn(range)` | Highlight the active time range button in the Indicators sidebar |
| `_indicatorsLoadCustomRange()` | Load indicators with custom date range from inputs |
| `_indicatorsLoad()` | Fetch health data from API and render SVG trend charts with expand buttons; attaches `enableTouchGesture()` to `div[data-ind-key]` chart sections for touch drag-to-reorder, with order persisted to localStorage |
| `_indToggleExpand(key)` | Expand/collapse a single indicator chart — fills available viewport height when expanded, updates on resize |
| `_enableIndicatorsDragReorder(container)` | Enable drag-to-reorder on indicator chart divs, persists order to localStorage |
| `_restoreIndicatorsOrder(container)` | Restore saved indicator chart order from localStorage |

#### main-alerts.js

| Function | Description |
|----------|-------------|
| `_loadAlertStates()` | Load persisted dismiss/snooze states from the backend API |
| `_persistDismiss(alertKey)` | Persist an alert dismiss state to the backend |
| `_persistSnooze(snoozeKey, untilTs)` | Persist an alert snooze state with expiry timestamp to the backend |
| `_globalFmtTime(time24)` | Format a 24h time string respecting the global time format setting |
| `_globalPlayAlarm()` | Play the alarm sound (looping, with 5-minute auto-stop) |
| `_globalStopAlarm()` | Stop the alarm sound and clear the auto-stop timeout |
| `_globalPlayTimer()` | Play the timer sound (looping) |
| `_globalStopTimer()` | Stop the timer sound |
| `_globalDayAbbr(date)` | Get the 3-letter day abbreviation for a Date object |
| `_showGlobalToast(emoji, label, chitTitle, chitId, onDismiss)` | Show a persistent toast notification; delegates alarms to the alert modal |
| `_showAlertModal(opts)` | Show a bold full-screen alert modal with dismiss, snooze, and open buttons |
| `_dismissAlertModal(overlay, onDismiss)` | Dismiss and remove an alert modal overlay with animation |
| `_showTimerDoneModal(timerName, onDismiss)` | Show a "Time's up!" alert modal for a completed timer |
| `_sendBrowserNotification(title, body, chitId, playSound)` | Send a browser notification with vibration and click-to-open |
| `_globalCheckAlarms()` | Check all chit-based and independent alarms against the current time |
| `_globalCheckNotifications()` | Check all chit notification alerts against their fire times; supports habit cycle-end targeting and only_if_undone suppression for habits |
| `_globalGetHabitCycleEnd(chit)` | Calculate the end-of-cycle datetime for a habit chit using its recurrence_rule.freq |
| `_getSnoozeMs()` | Get the snooze duration in milliseconds from settings |
| `_startGlobalAlertSystem()` | Initialize the global alert system — permissions, intervals, sync listeners |

#### main-search.js

| Function | Description |
|----------|-------------|
| `displaySearchView()` | Render the global search view with search bar and results container |
| `_renderSearchResults(container, viSettings)` | Render search result cards with sidebar filters applied |
| `_getChitFieldValue(chit, fieldName)` | Extract a displayable string value for a chit field by name |
| `_saveSearch()` | Save the current sidebar search text to localStorage |
| `_loadSavedSearch(text)` | Load a saved search into the sidebar search input and trigger search |
| `_deleteSavedSearch(text)` | Delete a saved search from localStorage |
| `_renderSavedSearches()` | Render saved search chips in the sidebar |

#### main-modals.js

| Function | Description |
|----------|-------------|
| `_openClockModal()` | Open (or toggle) the clock modal with configurable clock types |
| `_renderClocks(container, activeClocks, isVertical)` | Render all active clock displays (24h, 12h, analog, HST) into the modal |
| `_renderHSTClock(dayFraction, hstVal)` | Render the Holeman Simplified Time progress bar clock |
| `_renderAnalogClock(h24, min, sec)` | Render an SVG analog clock face with hour, minute, and second hands |
| `_closeClockModal()` | Close the clock modal and clear its update interval |
| `_getWeatherIcon(code)` | Get a weather emoji icon for a WMO weather code |
| `_escHtml(str)` | HTML-escape a string (ampersand, angle brackets, quotes) |
| `_getPrecipLabel(code)` | Get a precipitation type label (rain/snow/thunder/drizzle) for a WMO code |
| `_formatPrecip(precipMm, weatherCode)` | Format precipitation amount and type for display |
| `_celsiusToFahrenheit(c)` | Convert Celsius to Fahrenheit, rounded to nearest integer |
| `_isWeatherStale(updatedTime)` | Check if a weather timestamp is older than 24 hours |
| `_queueChitWeatherFetch(location, span)` | Queue a weather fetch for a chit indicator span (batched) |
| `_processChitWxQueue()` | Process the queued chit weather fetches with rate limiting |
| `_fetchAndApplyChitWeather(address, spans)` | Geocode an address, fetch weather, and update indicator spans |
| `_buildWeatherModalHTML(content)` | Build the weather modal HTML wrapper with forecast button and close hint |
| `_buildLocationSelectorHTML(locations, selectedAddress)` | Build the location dropdown HTML for the weather modal |
| `_onWeatherModalLocChange()` | Handle location dropdown change in the weather modal |
| `_onWeatherModalManualGo()` | Handle manual location input submission in the weather modal |
| `_openWeatherModal()` | Open the weather modal with saved locations and live forecast |
| `_fetchWeatherForModal(address, label)` | Fetch weather data for a location and render in the weather modal body |
| `_closeWeatherModal()` | Close the weather modal |
| `_fetchWeatherForCache(address, cacheKey)` | Pre-fetch weather for a location and store in localStorage (background) |
| `_prefetchChitWeather(chitList)` | Pre-fetch weather for all chits with locations (deduplicates) |
| `changeView()` | Handle period dropdown change from the editor form |
| `toggleAllDay()` | Toggle all-day mode — show/hide time inputs |
| `setColor(color, name)` | Set the color picker value and display name |
| `_convertDBDateToDisplayDate(dateString)` | Convert a database ISO date string to a display-formatted date |
| `deleteChit()` | Delete the current chit with confirmation and undo toast |
| `cancelEdit()` | Cancel editing and return to the previous tab/view |

#### main-init.js

| Function | Description |
|----------|-------------|
| `_getBreakpointCategory()` | Return the current breakpoint category (mobile/tablet/desktop) |
| `_onDebouncedResize()` | Debounced resize handler — re-renders only when viewport crosses a breakpoint |
| `_checkTabOverflow()` | Detect tab bar overflow and progressively reduce padding or switch to icon-only |
| `_applyArchiveFilter(chitList)` | Filter chits by pinned/archived/unmarked toggle states |
| `_applyMultiSelectFilters(chitList)` | Apply status, label, priority, people, and sharing ("Shared with me" / "Shared by me") multi-select filters |
| `_applySort(chitList)` | Sort chits by the current sort field and direction |
| `storePreviousState()` | Save the current UI state to localStorage for restoration after editor |
| `_restoreUIState()` | Restore UI state: prefers sessionStorage (refresh) for tab/view/period, layers localStorage (editor return) for filters |
| `_checkPendingDeleteUndo()` | Check sessionStorage for a pending delete-undo from the editor and show the undo toast on the dashboard |
| `fetchChits()` | Fetch owned chits from `/api/chits` and shared chits from `/api/shared-chits` in parallel; merges shared chits (marked with `_shared` flag) into the chits array, deduplicating by ID |
| `displayChits()` | Main render dispatcher — filter (including hide-declined RSVP filter), sort, expand recurrence, and render the active view |
| `_updateTabCounts(filteredChits)` | Update tab labels with counts of displayed chits per tab |
| `_applyChitDisplayOptions()` | Apply visual options — fade past events and highlight overdue chits |
| `DOMContentLoaded handler` | Main init — wires up sidebar, hotkeys, mobile UI, weather refresh, resize handler, notification inbox, and PWA install button (`#pwa-install-btn` → `handleInstallClick()` from `pwa-register.js`) |

#### main.js

Coordinator file — declares shared state variables referenced by all dashboard sub-scripts. No functions; only state declarations.

| Variable | Description |
|----------|-------------|
| `currentTab` | Active tab name (default: "Calendar") |
| `chits` | Array of all loaded chit objects |
| `currentWeekStart` | Date object for the start of the current calendar period |
| `currentView` | Active calendar view name (default: "Week") |
| `previousState` | Previous tab/view state for editor return navigation |
| `_weekViewDayOffset` | Responsive week view paging offset |
| `currentSortField` | Active sort field name (null = default sort) |
| `currentSortDir` | Sort direction ("asc" or "desc") |
| `_hotkeyMode` | Current hotkey submenu state (null = top-level) |
| `_cachedTagObjects` | Cached tag objects from settings for color lookups |
| `_chitOptions` | Chit display options loaded from settings |
| `_snoozeRegistry` | Snooze registry mapping alert keys to expiry timestamps |
| `_defaultFilters` | Default search filters per tab from settings |
| `_globalSearchResults` | Cached global search result objects |
| `_globalSearchQuery` | Current global search query string |
| `_weekStartDay` | Week start day setting (0=Sun, 1=Mon, etc.) |

### 2.3 Editor (`src/frontend/js/editor/`)

#### editor.js (coordinator)

Minimal coordinator that loads AFTER all editor sub-scripts. Holds shared editor state variables referenced by multiple sub-scripts, plus a few small utilities.

| Symbol | Description |
|--------|-------------|
| `chitId` | Current chit ID (set by `_initializeChitId` in editor-init.js) |
| `currentWeatherLat` | Weather latitude state — set by editor-location.js, read by editor-save.js |
| `currentWeatherLon` | Weather longitude state — set by editor-location.js, read by editor-save.js |
| `currentWeatherData` | Weather response data — set by editor-location.js, read by editor-save.js |
| `weatherIcons` | Const map of WMO weather codes → emoji icons |
| `defaultColors` | Const array of default color palette objects (`{hex, name}`) |
| `checklistContainer` | Reference to the `#checklist-container` DOM element |
| `_onChecklistChange()` | Mark save button unsaved when checklist changes |
| `dragIndicator` | Drag indicator element reference (used by drag-drop systems) |
| `healthIndicatorWarningsShown` | Set tracking which health indicator warnings have been shown |
| `userTimezoneOffset` | Current user's timezone offset in minutes |
| `_convertDBDateToDisplayDate(dateString)` | Convert a UTC ISO date string to a local display date (`YYYY-Mon-DD`) |

#### editor-dates.js

Date mode system, recurrence picker, time picker dropdown, and date-clearing helpers.

| Symbol | Description |
|--------|-------------|
| `_dateModeSuppressUnsaved` | Flag to suppress unsaved marking during init |
| `onDateModeChange()` | Handle date mode radio button change — show/hide Start/End, Due, Perpetual, or None fields; handles ♾️ Perpetual radio (sets start=now, disables end date) and updates dependent UI |
| `onDueCompleteToggle()` | Toggle status to Complete when the Due date Complete checkbox is checked |
| `onStatusChange()` | Sync the Due Complete checkbox when the status dropdown changes |
| `_detectDateMode(chit)` | Detect the date mode (`'due'`, `'startend'`, or `'none'`) from a chit object |
| `_setDateMode(mode)` | Set the date mode radio button and apply field greying; supports `'perpetual'` mode (sets start=now, disables end date) |
| `toggleAllDay()` | Toggle all-day mode — hide/show time inputs for all date modes |
| `_snapMinutes` | Time picker snap interval in minutes (default 15, loaded from settings) |
| `_updateRecurrenceLabels()` | Update recurrence dropdown labels with contextual day/month names from the active date |
| `onRecurrenceChange()` | Handle recurrence dropdown change — show/hide custom row and update icon |
| `onRepeatToggle()` | Toggle repeat options visibility when the repeat checkbox changes |
| `onRecurrenceFreqChange()` | Show/hide the by-day checkboxes when custom frequency is WEEKLY |
| `onRecurrenceEndsToggle()` | Toggle recurrence end-date visibility based on the "ends never" checkbox |
| `_onRecurrenceFreqChange()` | Alias for `onRecurrenceFreqChange()` |
| `_updateByDayVisibility()` | Alias for `onRecurrenceFreqChange()` |
| `onRecurrenceToggle()` | Alias for `onRecurrenceChange()` |
| `_buildRecurrenceRule()` | Build a recurrence rule object from the current form state (or null if repeat disabled) |
| `_loadRecurrenceRule(rule)` | Populate the recurrence UI from a saved recurrence rule object |
| `_loadSnapSetting()` | Load the time-picker snap interval from user settings |
| `_showTimeDropdown(inputEl)` | Show a snap-aligned time dropdown below a time input element |
| `clearStartAndEndDates()` | Clear all start/end date and time input fields |
| `clearDueDate()` | Clear the due date and time input fields |
| `onHabitToggle()` | Handle 🎯 Habit button toggle in the Task zone header — when checked: auto-enable Repeat with Daily if not already on, reveal habit controls, lock Repeat, force all-day, hide "None" date option; when unchecked: hide controls, unlock Repeat, restore date options |
| `_updateHabitProgressDisplay()` | Update the habit progress "X / Y" display from current `habit_success` and `habit_goal` values |
| `onHabitGoalChange()` | Handle habit goal input change — enforce minimum of 1, update progress display, mark unsaved |
| `_toggleAllDayBtn()` | Toggle the All Day button — mirrors the hidden checkbox and calls `toggleAllDay()` |
| `_updateAllDayBtnState()` | Sync the All Day button appearance (teal active, disabled when habit forces all-day) from the hidden checkbox state |
| `onPerpetualToggle()` | Handle ♾️ Perpetual radio option — sets start date to today, disables end date, continues forever. Perpetual is now a radio option in dateMode, not a separate checkbox |
| `_fmtPerpetualDate()` | Format a date string for the perpetual description (e.g. "May 2, 2026") |
| `onHabitResetToggle()` | Handle Reset checkbox toggle — show/hide the number and unit inputs |
| `_updateResetUnitOptions()` | Update the reset period unit dropdown options based on the habit's cycle frequency — limits units to one level smaller than the cycle (e.g., WEEKLY → Day(s) only, MONTHLY → Day(s)/Week(s), YEARLY → Day(s)/Week(s)/Month(s)) |

#### editor-habits.js

Habits zone logic: period history display, inline editing of past counts, and canvas-based habit charts. New file created as part of the habits overhaul. Visible only when `habit=true`.

| Symbol | Description |
|--------|-------------|
| `_loadHabitLog(chit)` | Build period history from recurrence_exceptions, display in reverse chronological order with editable counts and charts |
| `_buildPeriodRow(exception, index)` | Build a single period row element showing date and "X / Y" completion count with click-to-edit |
| `_startInlineEdit(element, exception, index)` | Start inline editing of a past period's habit_success count; saves on Enter/blur, cancels on Escape |
| `_renderHabitCharts(chit, exceptions, windowDays)` | Render all three habit charts into the charts container using `<canvas>` elements in a 2-column grid |
| `_drawCompletionChart(canvas, exceptions, goal)` | Draw a completion bar chart showing habit_success per period with a habit_goal reference line |
| `_drawSuccessRateChart(canvas, exceptions)` | Draw a success rate trend line chart showing rolling percentage over time |
| `_drawStreakChart(canvas, exceptions)` | Draw a streak timeline visualization showing consecutive completion periods |
| `_toggleHabitLogZone(visible)` | Show or hide the Habits zone based on the habit flag state |
| `_formatCurrentPeriodLabel(chit)` | Format a human-readable label for the current habit period (e.g., "Week of May 5", "May 2026", "May 2, 2026") based on the recurrence frequency |

#### editor-tags.js

Tag tree rendering, search, selection, favorites, recents, and inline tag creation in the editor.

| Symbol | Description |
|--------|-------------|
| `_loadTags()` | Load and normalize tags from user settings; returns array of `{name, color}` |
| `_renderTags(tags, selectedTags)` | Render the full tag zone — tree, favorites row, recents row, active tags panel, and count badge |
| `toggleAllTags(event, expand)` | Expand or collapse all tag tree nodes |
| `createTag(event)` | Navigate to the settings page for tag creation |
| `clearTagSearch(event)` | Clear the tag search input and reset the filter |
| `_filterTagTree(query)` | Filter the tag tree by search text — hides non-matching items and empty groups |
| `addSearchedTag(event)` | Add a tag by name from the search input, persist to settings if new, and re-render |
| `navigateToSettings()` | Navigate to the settings page (with unsaved-changes check) |

#### editor-people.js

People zone: contacts, system users, sharing controls. Loads all contacts and system users from the API, renders them in a merged grouped alphabetical tree, manages people chips (add/remove), syncs the hidden people field for save, provides search/filter within the people tree, and manages sharing state (shares, stealth, assigned-to). System users appear with inline pill toggles (Viewer/Manager) for role selection. Contacts appear as plain chips (no pill toggle). Depends on: `shared.js` (`setSaveButtonUnsaved`, `isLightColor`), `shared-auth.js` (`getCurrentUser`), `editor-sharing.js` (`_sharingUserList`, `_loadSharingUserList`, `getSharingData`). Loaded after: `editor-sharing.js`. Loaded before: `editor-init.js`, `editor.js`.

| Symbol | Description |
|--------|-------------|
| `_peopleDropdown` | Reference to the people dropdown element |
| `_peopleDebounceTimer` | Debounce timer for people search input |
| `_peopleApiAvailable` | Flag indicating whether the contacts API is reachable |
| `_peopleChipData` | Array of active people chips (`{display_name, id, color, image_url}`) |
| `_allContactsCache` | Full contacts list fetched from the API for the tree |
| `_peopleGroupsExpanded` | Object tracking which letter groups are expanded/collapsed |
| `_currentPeopleFilter` | Current search filter string (preserved across re-renders) |
| `_allUsersCache` | System users from `/api/auth/switchable-users` |
| `_currentShares` | Array of current shares (`{user_id, role, display_name}`) — moved from `editor-sharing.js` |
| `_sharingInitialized` | Boolean flag indicating whether sharing controls have been initialized |
| `_effectiveRole` | Current user's effective role on the chit (`'owner'`, `'manager'`, `'viewer'`, or `null` for new chits) |
| `_chitOwnerId` | Owner user_id of the current chit (used to hide owner from people list for non-owners) |
| `_chitOwnerDisplayName` | Owner display name (for assignee dropdown) |
| `_focusPeopleSearch()` | Focus the people search input |
| `_initPeopleAutocomplete()` | Initialize the people zone — load contacts and system users, attach search listeners |
| `_clearPeopleSearch(event)` | Clear the people search input and reset the tree filter |
| `_loadAllContactsForTree()` | Fetch all contacts from `/api/contacts` and render the people tree |
| `_loadAllUsersForTree()` | Fetch system users from `/api/auth/switchable-users` (or reuse `_sharingUserList`), cache in `_allUsersCache`, and render the people tree |
| `_renderPeopleTree(filter)` | Render the merged grouped alphabetical tree with contacts and system users; hides items already added/shared; includes stealth toggle at bottom |
| `_renderContactChipInTree(parent, c)` | Render a contact chip in the tree; hides completely when already added to the chit |
| `_renderUserChipInTree(parent, u, showControls)` | Render a system user chip in the tree (left column only); simple clickable chip with username tooltip; hides when already shared |
| `_getUserInfoById(userId)` | Look up a user object from `_allUsersCache` by user ID |
| `_findShareByUserId(userId)` | Find a share entry in `_currentShares` by user ID |
| `_addShare(userId, role, displayName)` | Add a user to `_currentShares` with `rsvp_status: 'invited'`, mark unsaved, re-render tree, sync assigned-to dropdown |
| `_removeShare(userId)` | Remove a user from `_currentShares`, mark unsaved, re-render tree, sync assigned-to dropdown |
| `_updateShareRole(userId, newRole)` | Update a user's role in `_currentShares`, mark unsaved, re-render tree, sync assigned-to dropdown |
| `_renderStealthToggle()` | Render the stealth toggle checkbox at the bottom of `#peopleContent`; hidden for viewers |
| `_applyStealthGreyout()` | Grey out sharing controls, people chips, assigned-to row, and search when stealth is enabled |
| `_onAssignedToChange()` | Handle assigned-to dropdown change: auto-add user to shares as manager (Requirements 2.1, 2.2, 2.3, 10.2, 10.3). If user not in shares, adds with `role: "manager"`, `rsvp_status: "invited"`. If viewer, upgrades to manager |
| `_syncAssignedToDropdown()` | Sync the assigned-to dropdown in the Task zone with current shares; show/hide row, populate options from owner + all system users (Requirement 2.5), clear if assigned user removed |
| `initPeopleSharingControls(chit)` | Initialize sharing controls for an existing chit — loads shares, sets stealth, determines effective role, syncs assigned-to |
| `initPeopleSharingForNewChit()` | Initialize sharing controls for a new chit — empty shares, stealth off, null effective role |
| `_filterPeopleTree(query)` | Filter the people tree by search query |
| `_contactMatchesFilter(c, filter)` | Check if a contact matches a search filter across all fields (name, email, phone, address, org, social context, call signs, X handles, websites, notes, tags) |
| `_toggleAllPeopleGroups(event, expand)` | Expand or collapse all letter groups in the people tree (includes both contact and system user letters) |
| `_addPeopleChip(data)` | Add a person chip (deduped by name), re-render chips and tree |
| `_removePeopleChip(index)` | Remove a person chip by index, re-render chips and tree |
| `_renderPeopleChips()` | Render the active people chips (contacts) and shared users (with user-circle icons, pill toggles, RSVP status badges, and accept/decline controls for the current user) in the right column |
| `_syncPeopleHiddenField()` | Sync the hidden `#people` input with current chip names (comma-separated) |
| `_updateActivePeopleCount()` | Update the active people count badge (includes both `_peopleChipData.length` and `_currentShares.length`) |
| `_isLightColor(hex)` | Delegate to shared `isLightColor()` |
| `_setPeopleFromArray(peopleArray)` | Populate people chips from a chit's people array (called during load) |
| `_expandModalFilter` | Current search filter string for the expand modal |
| `openPeopleExpandModal()` | Open the full-screen People expand modal — fully interactive with search, add/remove, role management, assign, favorites, user icons |
| `_renderExpandModalContent()` | Render the expand modal content (search bar, table header, favorites section, alphabetical groups with column layout) |
| `_el(tag, cls, text)` | Helper to create an element with class and optional text content |
| `_renderExpandRow(person, showControls, assignedToId)` | Render a single table row — controls column (left: +/✕, pill toggle, assign, RSVP), data columns (icon, thumb, name, email, org, notes, status), edit button (right: open profile/contact in new tab) |
| `closePeopleExpandModal()` | Close the People expand modal (also triggered by ESC key) |

#### editor-location.js

Location zone: geocoding, map, weather display, saved locations, and directions.

| Symbol | Description |
|--------|-------------|
| `_getCoordinates(address)` | Geocode an address — delegates to shared `_geocodeAddress()` |
| `_getWeather(lat, lon)` | Fetch a 1-day weather forecast from Open-Meteo for given coordinates |
| `_fetchWeatherData(address)` | Full weather pipeline — geocode, fetch, display, cache, and update `currentWeather*` globals |
| `_getPrecipType(code)` | Map a WMO weather code to a precipitation type string (rain/snow/thunder/drizzle) |
| `_editorFormatPrecip(precipMm, weatherCode)` | Format precipitation amount with type label (e.g., `"3cm rain"`) |
| `_displayWeatherInCompactSection(weatherData, address)` | Render weather data into the compact weather section with temperature bar and icons |
| `_displayMapInUI(lat, lon, address)` | Render an OpenStreetMap iframe embed for the given coordinates |
| `loadSavedLocationsDropdown()` | Populate the `#saved-locations-dropdown` from cached saved locations |
| `onSavedLocationSelect()` | Handle selection from the saved-locations dropdown — populate input and trigger fetch |
| `onAddDefaultLocation(event)` | "+Location" button handler — populate from the default saved location |
| `onClearLocation(event)` | Clear location input, map display, and weather section |
| `loadCompactLocationDropdown()` | Populate the `#compact-location-dropdown` from cached saved locations |
| `onCompactLocationSelect()` | Handle selection from the compact location dropdown — populate and sync |
| `searchLocationMap(event)` | Search for a location — fetch weather (if date set) and display map |
| `openLocationInNewTab(event)` | Open the current location in Google Maps or OpenStreetMap in a new tab |
| `openLocationDirections(event)` | Open directions to the current location (with geolocation for origin) |
| `_viewLocationInContext(event)` | Navigate to the maps page centered on the chit's location (View in Context) |
| `_updateViewInContextBtn()` | Show/hide the "View in Context" button based on location input value |

#### editor-notes.js

Notes zone: auto-grow, chit linking, markdown render, modal.

| Symbol | Description |
|--------|-------------|
| `autoGrowNote(el)` | Auto-grow the notes textarea to fit content (up to 60% viewport height); triggers chit link autocomplete |
| `_chitLinkDropdown` | Reference to the active `[[ ]]` chit link autocomplete dropdown element |
| `_chitLinkStart` | Character index where the current `[[` autocomplete trigger begins |
| `_checkChitLinkAutocomplete(textarea)` | Check the textarea cursor position for an open `[[` and show matching chit titles |
| `_showChitLinkDropdown(textarea, matches)` | Render and position the chit link autocomplete dropdown below the textarea |
| `_removeChitLinkDropdown()` | Remove the chit link autocomplete dropdown from the DOM |
| `_insertChitLink(textarea, title)` | Insert a selected chit title into the textarea and close the dropdown |
| `shrinkNoteToFourLines(event)` | Collapse the notes textarea/rendered output to four lines height |
| `_setNotesRenderToggleLabel(isRendered, source)` | Update the render/edit toggle button label for main or modal notes |
| `toggleNotesViewMode(event)` | Toggle between edit (textarea) and rendered (markdown) views for notes |
| `copyNotesToClipboard(event, source)` | Copy notes text to clipboard from main textarea or modal |
| `downloadNotes(event, source)` | Download notes as a `.md` file named after the chit title |
| `openNotesModal(event)` | Open the fullscreen notes editing modal, pre-populated with current note text |
| `closeNotesModal(save)` | Close the notes modal; if save is true, copy modal text back to main textarea |
| `toggleModalNotesRender()` | Toggle between edit and rendered views inside the notes modal |

#### editor-alerts.js

Alerts zone: alarms, timers, stopwatches, notifications.

| Symbol | Description |
|--------|-------------|
| `window._alertsData` | Global alerts state object with arrays: `alarms`, `timers`, `stopwatches`, `notifications` |
| `_stopwatchIntervals` | Map of stopwatch index to interval IDs |
| `window._editorTimeFormat` | Current time format setting (`"24hour"` or `"12hour"`) |
| `_loadEditorTimeFormat()` | Load the time format setting from user settings |
| `_fmtAlarmTime(time24)` | Format a 24h time string respecting the user's time format preference |
| `_alarmAudio` | Cached Audio object for alarm sound |
| `_timerAudio` | Cached Audio object for timer sound |
| `_playAlarmSound()` | Play the alarm sound on loop |
| `_stopAlarmSound()` | Stop and reset the alarm sound |
| `_playTimerSound()` | Play the timer sound on loop |
| `_alarmCheckerInterval` | Interval ID for the alarm checker loop |
| `_triggeredAlarms` | Set of alarm keys already triggered today (prevents re-firing) |
| `_startAlarmChecker()` | Start the per-second alarm checker interval |
| `_stopAlarmChecker()` | Stop the alarm checker interval |
| `_dayAbbr(date)` | Return the 3-letter day abbreviation for a Date |
| `_checkAlarms()` | Check all alarms against the current time and fire matching ones |
| `_showAlarmAlert(alarm, onDismiss)` | Show a non-blocking overlay alert for a fired alarm with dismiss and snooze buttons |
| `_notifCheckerInterval` | Interval ID for the notification checker loop |
| `_firedNotifications` | Set of notification keys already fired (prevents re-firing) |
| `_startNotificationChecker()` | Start the 30-second notification checker interval |
| `_stopNotificationChecker()` | Stop the notification checker interval |
| `_checkNotificationAlerts()` | Check all notifications against chit dates (using targetType) and fire when due; supports habit cycle-end targeting and only_if_undone suppression |
| `_getHabitCycleEnd()` | Calculate the end-of-cycle datetime for the current habit period (DAILY/WEEKLY/MONTHLY/YEARLY) |
| `_notifTimingLabel(n)` | Build a human-readable timing label for a notification — handles "cycle" targetType for habits and normal before/after start/due |
| `_fireNotificationAlert(msg, notif, notifIdx)` | Fire a browser notification and inline toast with auto-dismiss |
| `_alertsFromChit(chit)` | Parse a chit's alerts array into the `_alertsData` structure and render |
| `_alertsToArray()` | Flatten `_alertsData` back into a single array for saving |
| `renderAllAlerts()` | Render all four alert containers (notifications, alarms, timers, stopwatches) |
| `renderAlarmsContainer()` | Render the alarms list with name, time, days, toggle, delete, and snooze bar |
| `_defaultNotifsApplied` | Tracks which date modes have had default notifications applied |
| `_applyDefaultNotifications(mode)` | Auto-populate notifications from settings defaults when a date mode is first activated |
| `renderNotificationsContainer()` | Render the notifications list with value, unit, timing dropdown (habit-aware: "before end of cycle" for habits, before/after start/due otherwise), "disable if done" checkbox for habits, and delete controls |
| `_habitPeriodLabel()` | Return a human-readable label for the current habit cycle period (day/week/month/year) |
| `_notifTargetLabel()` | Return "start", "due", or "start/due" based on which date fields the chit has (legacy helper) |
| `_editingAlarmIdx` | Index of the alarm currently being edited (or null) |
| `openAlarmModal(event)` | Add a new alarm inline with default time and today's day |
| `editAlarmItem(idx)` | Open the alarm edit modal for a specific alarm index |
| `addAlarm()` | Save alarm data from the modal (create or update) |
| `toggleAlarmEnabled(idx)` | Toggle an alarm's enabled state; cancels snooze if disabling |
| `deleteAlarmItem(idx)` | Delete an alarm by index and re-render |
| `closeAlarmModal(save)` | Close the alarm modal |
| `_editingTimerIdx` | Index of the timer currently being edited (or null) |
| `openTimerModal(event)` | Add a new timer inline with zero duration |
| `editTimerItem(idx)` | Open the timer edit modal for a specific timer index |
| `addTimer()` | Save timer data from the modal (create or update) |
| `closeTimerModal(save)` | Close the timer modal |
| `window._swRuntime` | Runtime state for stopwatches: `{ running, elapsed, intervalId, laps }` per index |
| `addStopwatch(event)` | Add a new stopwatch inline |
| `deleteStopwatchItem(idx)` | Delete a stopwatch by index, stop its interval, and rebuild runtime map |
| `_swFmt(ms)` | Format milliseconds as `HH:MM:SS.cc` stopwatch display |
| `renderStopwatchesContainer()` | Render the stopwatches list with display, start/pause, lap, and reset controls |
| `renderLaps(idx, container)` | Render lap times for a stopwatch into a container |
| `closeStopwatchModal()` | Close the stopwatch modal |
| `saveStopwatchDetails()` | Save stopwatch name from the modal and re-render |
| `window._timerRuntime` | Runtime state for timers: `{ remaining, intervalId, running }` per index |
| `renderTimersContainer()` | Render the timers list with input/countdown modes, start/pause, and reset controls |
| `deleteTimerItem(idx)` | Delete a timer by index, stop its interval, and rebuild runtime map |
| `openNotificationModal(event)` | Add a new notification inline with 15-minute default |
| `addNotification()` | Save notification data from the modal |
| `deleteNotificationItem(idx)` | Delete a notification by index and re-render |
| `closeNotificationModal(save)` | Close the notification modal |
| `validateNotificationInputs()` | Enable/disable the notification modal submit button based on input validity |

#### editor-color.js

Color zone: swatches, custom colors, background tinting.

| Symbol | Description |
|--------|-------------|
| `_fetchCustomColors()` | Fetch custom colors from user settings; returns normalized `[{hex, name}]` array |
| `_setColor(hex, name)` | Set the chit color — updates hidden input, preview, editor background, and swatch selection |
| `_updateColorPreview()` | Sync the color preview element, editor background, and swatch highlights with the current color value |
| `_renderCustomColors(customColors)` | Render custom color swatches into the `#custom-colors` container |
| `_attachColorSwatchListeners()` | Attach click listeners to all `.color-swatch` elements to set color on click |

#### editor-health.js

Health indicators zone: vitals, body metrics, activity, and cycle tracking.

| Symbol | Description |
|--------|-------------|
| `window._healthData` | Global object holding current health indicator values |
| `_healthFields` | Array of health field definitions (id, key, label, unit, metricUnit, flags) |
| `renderHealthIndicator(indicatorId)` | Render a single health indicator input field (number, checkbox, or blood pressure pair) |
| `_loadHealthData(chit)` | Load health data from a chit into `_healthData` and render all indicators with correct units |
| `_gatherHealthData()` | Collect all non-null health data values into an object for saving (or null if empty) |

#### editor-save.js

Save system: build chit object, save, delete, pin, archive, QR.

| Symbol | Description |
|--------|-------------|
| `createISODateTimeString(dateStr, timeStr, isAllDay, isEnd)` | Convert date/time strings to an ISO datetime string, handling all-day and end-of-day logic |
| `convertMonthFormat(dateStr)` | Convert `YYYY-Mon-DD` format to `YYYY-MM-DD` numeric format |
| `setMediaSource(elementId, src)` | Set the `src` attribute of a media element, validating the URL first |
| `isValidMediaSource(src)` | Validate a media source URL (non-empty, parseable, not "editor") |
| `buildChitObject()` | Collect all form values into a chit object; returns null if validation fails |
| `_showInstanceBanner(dateStr)` | Show a banner indicating single recurrence instance editing |
| `_saveInstanceException(dateStr)` | Save changes as a recurrence exception for a single instance via PATCH |
| `_isSaving` | Guard flag to prevent concurrent save operations |
| `saveChitData()` | Main save — build chit, POST/PUT to API, sync, and navigate home |
| `chitExists(chitId)` | Check if a chit exists in the backend by ID |
| `saveChit()` | Convenience wrapper that calls `saveChitData()` |
| `saveChitAndStay()` | Save the chit and stay on the editor page (no navigation) |
| `deleteChit()` | Show the delete confirmation modal for the current chit |
| `_getEditorReturnUrl()` | Get the URL to navigate to when exiting the editor; uses 'from' query param if present (e.g. kiosk), otherwise '/' |
| `performDeleteChit()` | Execute the chit deletion with undo toast |
| `setSaveButtonSaved()` | Mark the save button as saved (delegates to CwocSaveSystem) |
| `cancelOrExit()` | Cancel or exit the editor (delegates to CwocSaveSystem or navigates home) |
| `markEditorUnsaved()` | Mark the editor as having unsaved changes |
| `markEditorSaved()` | Mark the editor as saved |
| `togglePinned()` | Toggle the chit's pinned state and update the pin button UI |
| `toggleArchived()` | Toggle the chit's archived state and update the archive button UI |
| `_showQRCode(e)` | Show a QR code modal with data/link mode toggle for the current chit |

#### editor-sharing.js

Thin data-layer module for the chit editor. Provides user list fetching/caching, sharing data gathering for save, zone state detection, and display name lookup. UI rendering has been moved to `editor-people.js` (merged People zone). Depends on: `shared-auth.js` (`getCurrentUser`). Loaded before: `editor-people.js`, `editor-init.js`.

| Symbol | Description |
|--------|-------------|
| `_sharingUserList` | Cached list of switchable users (fetched once). Exported as a global for `editor-people.js` |
| `_loadSharingUserList()` | Fetch the list of switchable users from `/api/auth/switchable-users` (cached after first call) |
| `_getUserDisplayName(userId)` | Look up a user's display name from the cached user list or `_currentShares` |
| `getSharingData()` | Return sharing fields (`shares`, `stealth`, `assigned_to`) to merge into the chit save payload; reads `_currentShares` from `editor-people.js` globals (preserving `rsvp_status`), stealth checkbox from people zone, and assigned-to dropdown from task zone. Applies assign auto-add logic (Requirements 2.2, 2.3): if assigned_to is set and user is not in shares, adds them as manager; if viewer, upgrades to manager |
| `hasSharingData(chit)` | Returns true if the chit has sharing data (shares, stealth, or assigned_to); used by `applyZoneStates` |

#### editor-init.js

Editor initialization, zone management, owner chip rendering, and DOMContentLoaded handler.

| Symbol | Description |
|--------|-------------|
| `_initializeChitId()` | Parse chit ID and instance from URL params; generate new ID if creating |
| `toggleZone(event, sectionId, contentId)` | Toggle a zone section's expand/collapse state (delegates to `cwocToggleZone`) |
| `_toggleSection(contentId, button)` | Toggle a section's visibility between hidden and visible |
| `resetEditorForNewChit()` | Reset all editor fields, zones, alerts, tags, and weather for a blank new chit; calls `initPeopleSharingForNewChit()` and `_renderOwnerChipForCurrentUser()` |
| `_collapseAllZonesForNewChit()` | Collapse all zones, then expand only the zone matching the source tab (no `sharingSection` entry) |
| `setSelectValue(selectElement, value)` | Set a `<select>` element's value with case-insensitive matching |
| `initializeFlatpickr(selector, options)` | Initialize a Flatpickr date picker on a selector with error handling |
| `_renderOwnerChip(chit)` | Render the owner chip inside `#cwoc-owner-chip-container` for an existing chit; resolves profile image from `getCurrentUser()` or `_allUsersCache` |
| `_renderOwnerChipForCurrentUser()` | Render the owner chip for a new chit — shows the current user's own chip |
| `_buildOwnerChipElement(displayName, profileImageUrl)` | Build an owner chip DOM element matching the people chip visual style (`people-chip cwoc-owner-chip`) |
| `loadChitData(chitId)` | Load a chit from the API and populate all editor fields, zones, and states; calls `_renderOwnerChip(chit)` and `initPeopleSharingControls(chit)` instead of old sharing zone init; applies viewer read-only mode for viewer-role chits |
| `_applyViewerReadOnlyMode(chit)` | Apply read-only mode when the current user has viewer role — disables form fields, hides save/delete buttons, shows read-only banner |
| `applyZoneStates(chit)` | Expand zones with data and collapse empty zones after loading a chit; no `sharingSection` entry; `peopleSection` checks `hasSharingData` |
| `DOMContentLoaded handler` | Main init — wires up save system, Flatpickr, checklist, color swatches, event listeners, hotkeys, ESC chain, and conditionally loads or resets chit data |

#### editor_checklists.js

Checklist class: nested items, drag-drop, inline editing, undo.

| Symbol | Description |
|--------|-------------|
| `MAX_INDENT_LEVEL` | Maximum nesting depth for checklist items (4) |
| `Checklist` | Class managing a checklist UI with nested items, drag-drop reorder, inline editing, and inline undo countdown |
| `Checklist.constructor(container, initialItems, onChangeCallback)` | Initialize checklist with container, optional items, and change callback |
| `Checklist.init()` | Create input field and header buttons, then render |
| `Checklist.loadItems(itemsArray)` | Load checklist items from an array, replacing current items |
| `Checklist.getChecklistData()` | Return a deep copy of current checklist items for JSON serialization |
| `Checklist.createInput()` | Create the "Add new item" text input with Enter/Escape handlers |
| `Checklist._createHeaderButtons()` | Create "Clear Checked" button and count display in the zone header (with stopPropagation) |
| `Checklist.addNewItem(text, level, checked, id)` | Add a new checklist item with optional level, checked state, and ID |
| `Checklist.generateId()` | Generate a random item ID |
| `Checklist.render()` | Re-render all checklist items — unchecked above, completed below (collapsible, collapsed by default) with ghost parents; updates count |
| `Checklist.createItemElement(item, isCompleted, isGhost)` | Create a DOM element for a checklist item with checkbox, text, trash, and drag events |
| `Checklist.startEditing(item, textSpan, clickEvent)` | Start inline editing — cursor positioned at click point via canvas measurement; Enter/Tab/Arrow key navigation |
| `Checklist.toggleCheck(item, checked)` | Toggle an item's checked state and propagate to subtree |
| `Checklist.updateCheckedStateForSubtree(item, checked)` | Recursively set checked state on all children |
| `Checklist.getParent(item)` | Find the parent item of a given item |
| `Checklist.getChildren(item)` | Find all direct children of a given item |
| `Checklist.deleteItem(item, element)` | Delete an item and its subtree with animation; shows inline undo countdown |
| `Checklist.getSubtree(item)` | Get an item and all its descendants recursively |
| `Checklist._updateCount()` | Update the count display (x / y) in the zone header and toggle Clear Checked button visibility |
| `Checklist.clearCheckedItems()` | Async — delete all checked items after cwocConfirm, show inline undo countdown |
| `Checklist._showUndoCountdown(removedItems, label)` | Show an inline undo countdown bar (8s) with Undo button; restores items if clicked |
| `Checklist._notifyChange()` | Call the external change callback with current checklist data |

#### editor_projects.js

Projects zone: Kanban board for project master chits.

| Symbol | Description |
|--------|-------------|
| `projectState` | Local state object: `projectChit`, `childChits` map, `projectMasters` list |
| `saveCurrentChit()` | Mark the editor as having unsaved changes (delegates to `setSaveButtonUnsaved`) |
| `initializeProjectZone(projectChitId)` | Initialize the projects zone — fetch masters, load project data, render Kanban |
| `clearProjectsContent()` | Clear the projects zone and reset project state |
| `updateHeaderButtonsVisibility()` | Show/hide Add and Filter buttons based on project master status |
| `renderChildChitsByStatus()` | Render child chits grouped by status columns with drag-drop between sections |
| `updateChitStatus(chitId, newStatus)` | Update a child chit's status and re-render |
| `createChildChitCard(chit)` | Create a card element for a child chit with drag handle, status dropdown, title, date, open, move, and delete controls |
| `handleStatusChange(childChitId, newStatus)` | Update a child chit's status in local state |
| `handleDueDateChange(childChitId, newDueDate)` | Update a child chit's due date in local state |
| `moveChildChitToProject(childChitId, targetProjectId)` | Move a child chit from the current project to a different project |
| `fetchProjectMasters()` | Fetch all project master chits from the API |
| `saveProjectChanges()` | Save all child chit changes to the backend (called on main save) |
| `openAddChitModal()` | Open a modal to search and select an existing chit to add as a child |
| `addChildChit(chit)` | Add a chit to the project's child chits and re-render |
| `addProjectItem()` | Alias for `openAddChitModal()` |
| `toggleProjectMaster()` | Toggle project master status with confirmation if children exist |
| `chitExists(chitId)` | Check if a chit exists in the backend by ID |
| `loadProjectData(projectChitId)` | Fetch the project chit and all its child chits from the backend |

### 2.4 Pages (`src/frontend/js/pages/`)

#### shared-page.js

Shared page components: save/cancel button system, auto header/footer injection, user switcher, navigate panel (V hotkey).

| Symbol | Description |
|--------|-------------|
| `CwocSaveSystem` | Class — shared save/cancel button system managing "Saved / Save & Stay / Save & Exit / Cancel" pattern |
| `CwocSaveSystem.hasChanges()` | Returns true if there are unsaved changes |
| `CwocSaveSystem.markSaved()` | Mark as saved — show greyed-out "Saved" button, hide Save & Stay / Save & Exit |
| `CwocSaveSystem.markUnsaved()` | Mark as unsaved — show Save & Stay / Save & Exit, change Cancel to "❌ Cancel" |
| `CwocSaveSystem.cancelOrExit()` | Handle exit with unsaved-changes confirmation modal |
| *(IIFE)* Auto-header/footer injection | Injects `.header-and-buttons` header and `.author-info` footer into `.settings-panel` when `body[data-page-title]` is set; includes user switcher, profile link, logout button; wires ESC-to-go-back |
| *(IIFE)* User Switcher | Dropdown + password prompt for switching accounts. Fetches `GET /api/users` to list active accounts, prompts for target user's password, calls `POST /api/auth/switch` |
| `_cwocToggleUserDropdown(switcherWrap)` | Toggle the user dropdown on the switcher button |
| `_cwocShowSwitchPasswordPrompt(targetUser)` | Show a parchment-styled password prompt modal for switching to a user |
| `_cwocLogout()` | Logout: `POST /api/auth/logout`, then redirect to `/login` |
| *(IIFE)* Navigate Panel | Creates the V-hotkey navigation overlay on secondary pages (not dashboard); includes Profile, Maps, and User Admin (admin-only) entries; exports `cwocOpenNavModal`, `cwocCloseNavModal`, `cwocIsNavModalOpen` globally |

#### shared-editor.js

Reusable editor patterns: zone collapse, editor save system, Alt+N hotkeys.

| Symbol | Description |
|--------|-------------|
| `cwocToggleZone(event, sectionId, contentId)` | Toggle a collapsible zone open/closed; ignores clicks on interactive child elements |
| `CwocEditorSaveSystem` | Class — wraps `CwocSaveSystem` with editor defaults; auto-listens to input/textarea/select changes |
| `CwocEditorSaveSystem.markUnsaved()` | Mark the editor as having unsaved changes |
| `CwocEditorSaveSystem.markSaved()` | Mark the editor as saved |
| `CwocEditorSaveSystem.hasChanges()` | Returns true if there are unsaved changes |
| `CwocEditorSaveSystem.cancelOrExit()` | Handle cancel/exit with unsaved-changes confirmation |
| `CwocEditorSaveSystem._attachInputListeners()` | Attach change listeners to all inputs, textareas, and selects on the page |
| `cwocInitEditorHotkeys(zoneMap)` | Initialize Alt+N hotkeys for zone focus/expand; zoneMap maps key chars to `[sectionId, contentId]` pairs |

#### settings.js

Settings page logic: tags, colors, clocks, locations, indicators, import/export, version/upgrade.

| Symbol | Description |
|--------|-------------|
| `renderLocationsSection(locations)` | Render saved location rows into `#locations-list` from data array |
| `_appendLocationRow(container, label, address, isDefault)` | Append a single location row to the container |
| `addLocationRow()` | Global function called by the "+" button — adds an empty location row |
| `_autoSelectSingleLocation()` | Auto-select logic: if exactly one row has a non-empty address, auto-check its radio |
| `collectLocationsData()` | Read all location rows from the DOM and return the array for saving |
| `updateGrid(preserveOrder)` | Rebuild the clock format grid from active formats |
| `processTagsInInput(input)` | Process `#tag` patterns in a filter input and render highlighted overlay |
| `updateInactiveZone()` | Rebuild the inactive clock zone from formats not in the active grid |
| `setupDragListeners()` | Wire drag-start/end/over/drop listeners on format items, grid slots, and inactive items |
| `handleDragStart(e)` | Handle drag start — store value, reduce opacity |
| `handleDragEnd(e)` | Handle drag end — restore opacity |
| `handleDragOver(e)` | Handle drag over — prevent default |
| `handleDropOnGrid(e)` | Handle drop on the active grid — swap or add clock format |
| `handleDropOnInactive(e)` | Handle drop on the inactive zone — remove clock format from grid |
| `_toggleCombineAlerts()` | Toggle visibility of combined vs individual alert rows based on Combine Alerts checkbox |
| `toggleAuditPruneInputs()` | Toggle disabled state of audit prune inputs based on Enable Pruning checkbox |
| `_toggleMapAutoZoom()` | Toggle disabled/dimmed state of lat/lon/zoom inputs based on auto-zoom checkbox |
| `_loadMapSettings(settings)` | Populate map settings UI (auto-zoom checkbox, lat/lon/zoom inputs) from the settings object on page load |
| `_collectMapSettings()` | Read map settings UI values for inclusion in the save payload; validates lat (−90 to 90), lon (−180 to 180), zoom (1–18) |
| `_toggleWorkConfig()` | Toggle visibility of Work Week config based on Work Hours period checkbox |
| `_toggleXDaysConfig()` | Toggle visibility of X Days config based on SevenDay period checkbox |
| `_initHourDropdownPair(startId, endId, defaultStart, defaultEnd)` | Populate a pair of hour dropdowns (start/end) and constrain each based on the other |
| `_syncHourDropdowns(startId, endId)` | After one dropdown changes, disable invalid options in the other |
| `addFirstClock()` | Move the first inactive clock format into the active grid |
| `toggleOrientation()` | Toggle clock container between horizontal and vertical layout |
| `_isColorLight(hexColor)` | Check if a hex color is light (luminance > 186) |
| `loadColors()` | Load custom colors from cached settings and render them |
| `openColorPicker()` | Open the native color picker input and add the chosen color |
| `saveColors(colors)` | Save custom colors array to the backend via POST `/api/settings` |
| `addColor(newColor)` | Add a new color to the list, save, and re-render |
| `deleteColor(hex, name)` | Delete a color with confirmation modal, save, and re-render |
| `renderColors(colors)` | Render color swatches into `#color-list` |
| `confirmDelete()` | Confirm deletion of the current `itemToDelete` (color or tag) |
| `handleTagInput(event)` | Handle keypress in the new-tag input — Enter adds tag, Shift+Enter opens tag modal |
| `handleInfoClick(event)` | Handle Shift+click on the info button — opens tag modal for new tag |
| `addTag()` | Add a new tag from the input field with duplicate checking |
| `_tagColorPalette` | Array of default tag color palette objects `{ bg, fg }` |
| `openTagModal(tag)` | Open the tag editor modal with color swatches, font color, preview, and favorite toggle |
| `saveTag()` | Save the current tag's name, colors, and favorite state from the modal |
| `deleteTag()` | Delete the current tag and close the modal |
| `_renderSettingsTagTree()` | Render the tag tree in the settings page using the shared `renderTagTree` |
| `_findFullPathForBadge(tree, badge, row)` | Helper: find the full path for a badge element in the tag tree |
| `closeTagModal()` | Close the tag editor modal |
| `toggleTagFavorite()` | Toggle the favorite star in the tag modal |
| `openDeleteModal(event, item)` | Open the delete confirmation modal for a tag or color |
| `closeDuplicateTagModal()` | Close the duplicate tag warning modal |
| `saveSettings()` | Save & Exit — save settings then navigate back |
| `saveSettingsAndStay()` | Save & Stay — save settings without navigating |
| `cancelSettings()` | Cancel/exit with unsaved-changes check via `CwocSaveSystem` |
| `_initPillToggle(pillId, hiddenInputId)` | Initialize a two-option pill toggle (e.g., sex, unit system) |
| `_updatePillToggle(pillId, activeVal)` | Update pill toggle visual state to reflect the active value |
| `SettingsService` | Class — static methods for loading and saving settings via the API |
| `SettingsService.loadAll()` | Load all settings from the cached settings API |
| `SettingsService.saveAll(settings)` | Save all settings via POST `/api/settings` |
| `SettingsManager` | Class — manages settings lifecycle: load, populate form, gather, save |
| `SettingsManager.initialize()` | Load settings from API and populate the form |
| `SettingsManager.updateForm()` | Populate all form fields from the loaded settings object; includes map settings via `_loadMapSettings()` |
| `SettingsManager.gatherSettings()` | Gather all form field values into a settings object for saving; includes map settings via `_collectMapSettings()` |
| `SettingsManager.save()` | Save gathered settings to the backend and reload canonical state |
| `SettingsManager.setupEventListeners()` | Set up additional event listeners (currently a no-op) |
| `setSaveButtonSaved()` | Mark the save system as saved (delegates to `CwocSaveSystem.markSaved`) |
| `closeDeleteModal()` | Close the delete confirmation modal |
| `monitorChanges()` | Attach change/input listeners and MutationObservers to detect unsaved changes |
| `_triggerJsonDownload(data, filename)` | Create a Blob from a data string and trigger a browser download |
| `exportChitData()` | Export all chit data as a JSON file download via GET `/api/export/chits` |
| `exportUserData()` | Export all user data (settings + contacts) as a JSON file download via GET `/api/export/userdata` |
| `exportAllData()` | Export all data (chits + settings + contacts + alerts) as a single JSON file via GET `/api/export/all` |
| `_showImportModeDialog(type, fileData)` | Show the Add/Replace import mode dialog for chit, user, or all data |
| `_showReplaceConfirmDialog(type, onConfirm)` | Double-confirm replace with two sequential `cwocConfirm` dialogs |
| `_doImport(type, mode, fileData)` | Perform the actual import POST request to `/api/import/chits`, `/api/import/userdata`, or `/api/import/all` |
| `importChitData()` | Import chit data: open file picker, read JSON, validate, show mode dialog |
| `importUserData()` | Import user data: open file picker, read JSON, validate, show mode dialog |
| `triggerIcsImport()` | Import Calendar (.ics): open file picker, read ICS text, POST to /api/import/ics, display results |
| `importAllData()` | Import all data: open file picker, read JSON, validate type "all", show mode dialog |
| `loadVersionInfo()` | Fetch and display the current version and install date from `/api/version` |
| `_closeUpdateModal()` | Close the update modal; show reopen button if upgrade is still running |
| `startUpgrade()` | Open the upgrade modal and prepare the UI for an upgrade |
| `runUpgrade()` | Execute the upgrade via SSE from `/api/update/run` |
| `appendLogLine(line, bold)` | Append a styled log line to the update log with auto-scroll |
| `onUpgradeComplete(data)` | Handle upgrade completion — show result, re-enable buttons, reload version |
| `copyUpdateLog()` | Copy the update log text to the clipboard |
| `loadLastLog()` | Load and display the last upgrade log from `/api/update/log` |
| `showReleaseNotes()` | Fetch all release notes from `/api/release-notes` and display the newest in a paginated modal |
| `_renderCurrentReleaseNote()` | Render the currently selected release note (by `_releaseNotesIndex`) into the modal |
| `_updateReleaseNotesNav()` | Update prev/next button states and counter text |
| `releaseNotesPrev()` | Navigate to the next older release note |
| `releaseNotesNext()` | Navigate to the next newer release note |
| `closeReleaseNotesModal()` | Close the release notes modal |
| `_renderDefaultNotifList(type, items)` | Render default notification rows for a given type ('start' or 'due') |
| `_addDefaultNotifRow(type)` | Add a new default notification row for a given type |
| `_gatherDefaultNotifList(type)` | Gather default notification rows from the DOM for a given type |
| `_loadTagSharingData()` | Load shared_tags config from `GET /api/settings/shared-tags` on page init after auth is ready |
| `_loadTagSharingUserList()` | Fetch the switchable user list for the tag sharing picker (cached after first call) |
| `_getTagShares(tagName)` | Get the shares array for a specific tag from the cached config |
| `_tagHasSharing(tagName)` | Return true if a tag has any active sharing configuration |
| `_populateTagSharingUserPicker()` | Populate the tag sharing user picker dropdown, excluding current user and already-shared users |
| `_renderTagSharesList()` | Render the current tag's shares list in the tag modal with role badges, `tag_permission` toggle (view/manage), and remove buttons |
| `_getTagSharingUserName(userId)` | Look up a user's display name from the cached tag sharing user list |
| `_addTagShare()` | Add a user share to the current tag; called by the "Share" button in the tag modal |
| `_removeTagShare(userId)` | Remove a user from the current tag's shares list |
| `_saveTagSharingConfig(tagName)` | Save the full shared_tags config to the server via `PUT /api/settings/shared-tags` |
| `_initTagSharingSection(tagName)` | Initialize the tag sharing section when the tag modal opens; loads user list and populates pickers |
| `_propagateTagSharingToSubTags(parentTagName)` | Propagate a parent tag's sharing config to all sub-tags (eager propagation at save time) |
| `_inheritParentTagSharing(tagName)` | When a new sub-tag is added, inherit the parent tag's sharing config if the parent has one |
| `_enforceTagPermission(tagName)` | Enforce tag permission on the Settings page — "view" users cannot rename, recolor, or delete shared tags; "manage" users get full access |
| `_getTagPermissionForCurrentUser(tagName)` | Get the current user's `tag_permission` ("view" or "manage") for a shared tag; returns null if not shared with the user |
| `refreshTailscaleStatus()` | Fetch `GET /api/network-access/tailscale/status`, update status badge (⚪ Not Installed / 🟡 Inactive / 🟢 Connected / 🔴 Error), show/hide IP+hostname and error rows |
| `loadTailscaleConfig()` | Fetch `GET /api/network-access/tailscale`, populate auth key input and enabled checkbox |
| `saveTailscaleConfig()` | Collect auth key and enabled state, POST to `/api/network-access/tailscale`, show success/error feedback |
| `tailscaleUp()` | POST to `/api/network-access/tailscale/up`, show result, refresh status on success |
| `tailscaleDown()` | POST to `/api/network-access/tailscale/down`, show result, refresh status on success |
| `toggleAuthKeyVisibility()` | Toggle auth key input between `type="password"` and `type="text"`, update toggle button label |
| `openTailscaleApp()` | Open Tailscale app via deep link. Uses `intent://` URI on Android (Firefox-compatible), falls back to `tailscale://` on other platforms |
| `refreshNtfyStatus()` | Fetch `GET /api/network-access/ntfy/status`, update status badge (🟢 active / ⚪ inactive / 🔴 error) |
| `loadNtfyConfig()` | Fetch `GET /api/network-access/ntfy`, populate server URL input and enabled checkbox, display user's topic |
| `saveNtfyConfig()` | Collect server URL and enabled state, POST to `/api/network-access/ntfy`, show success/error feedback |
| `testNtfyNotification()` | POST to `/api/network-access/ntfy/test`, show success/error feedback |
| `openNtfyApp()` | Open Ntfy app via deep link using `ntfy://` URL scheme |
| `disableNtfyService()` | POST to `/api/network-access/ntfy/disable`, disable ntfy notifications, swap button to Enable |
| `enableNtfyService()` | POST to `/api/network-access/ntfy/enable`, re-enable ntfy notifications, swap button to Disable |
| `_ntfyUpdateDisableButton(isEnabled)` | Update the disable/enable button label based on current ntfy enabled state |
| `toggleNtfySection()` | Toggle visibility of the Ntfy config section body |

#### people.js

People page: rolodex browse view with search, favorites, users section, import/export. Sections (Favorites, Users, All Contacts) are collapsible with localStorage persistence. A Group/Ungroup toggle lets users switch between the grouped three-section view and a flat alphabetical list combining all entries.

| Symbol | Description |
|--------|-------------|
| `_getCollapseState()` | Get section collapse state from localStorage |
| `_setCollapseState(state)` | Save section collapse state to localStorage |
| `_isSectionCollapsed(sectionId)` | Check if a section is collapsed |
| `_toggleSection(sectionId)` | Toggle a section's collapsed state and re-render |
| `_loadGroupState()` | Load group/ungroup preference from localStorage |
| `_updateGroupButton()` | Update the group toggle button label and icon to reflect current state |
| `_loadUsers()` | Fetch active users from GET `/api/auth/switchable-users` |
| `loadContacts(query)` | Fetch contacts from GET `/api/contacts` (optionally filtered by query) |
| `_onSearchInput()` | Search input handler — client-side filter with debounced API fallback |
| `_applyFilter()` | Client-side filter: match query against display name, nickname, org, emails, phones, etc. |
| `_renderList()` | Render the filtered contact list; grouped mode shows Favorites/Users/All Contacts sections, ungrouped mode shows a single flat alphabetical list |
| `_renderSection(sectionId, label, items, query, rowFactory)` | Render a collapsible section with divider header and content wrapper |
| `_createUserRow(user, query)` | Create a user row element with profile image, display name, and username |
| `_createRow(contact, query)` | Create a single contact row element with star, thumbnail, name, details, and share button |
| `_toggleFavorite(contact, starEl)` | Toggle favorite via PATCH `/api/contacts/:id/favorite` and re-render |
| `_shareContact(contact)` | Share contact via QR code using `showContactQrCode` from contact-qr.js |
| `_showImportResult(result)` | Show the import result modal with imported/skipped counts and errors |
| `closeImportModal()` | Close the import result modal |
| `_hideExportDropdown()` | Hide the export format dropdown |
| `_escapeHtml(str)` | Escape HTML special characters in a string |
| `_highlightMatch(text, query)` | Highlight matching substring in text with a `<mark>` tag |

#### contact-editor.js

Contact editor page: 3-column zone layout, image upload, multi-value fields, color picker, save/delete/share.

| Symbol | Description |
|--------|-------------|
| `_renderContactTags()` | Render contact tag chips with remove buttons into `#contactTagsChips` |
| `_initContactTags()` | Initialize contact tags input with Enter-to-add and auto "Contact/" prefix |
| `_initDisplayNameUpdater()` | Wire input/change listeners on name fields to update the display name header live |
| `_updateDisplayNameHeader()` | Compute and update the display name header from prefix/given/middle/surname/suffix |
| `_loadContact(id)` | Load a contact from GET `/api/contacts/:id` and populate the form |
| `_initSaveSystem()` | Initialize `CwocEditorSaveSystem` for the contact editor |
| `_initHotkeys()` | Initialize Alt+N zone focus hotkeys for the 8 editor zones |
| `_stageImage(file)` | Stage an image locally (preview only) — resizes to max 512px, actual upload on save |
| `_uploadPendingImage()` | Upload the pending image file to POST `/api/contacts/:id/image` |
| `_removePendingImage()` | Remove the contact image via DELETE `/api/contacts/:id/image` |
| `_setProfileImage(url)` | Set or clear the profile image display and related buttons |
| `triggerImageUpload()` | Global — trigger the hidden file input for image upload |
| `viewContactImage()` | Global — open the full-size image modal |
| `removeContactImage()` | Global — clear the pending image and mark for removal on save |
| `_initSignalToggle()` | Initialize Signal username field visibility based on checkbox state |
| `onSignalToggle()` | Global — toggle Signal username input visibility on checkbox change |
| `_initColorPicker()` | Build color swatches and wire hex input for contact color selection |
| `_selectColor(hex, fromInput)` | Select a color: update preview, hex input, editor background tint, and swatch highlight |
| `onDropdownCustomChange(selectId, customInputId)` | Global — handle prefix/suffix dropdown change; show/hide custom input |
| `_getDropdownCustomValue(selectId, customInputId)` | Get the effective value from a dropdown+custom-input pair |
| `_setDropdownCustomValue(selectId, customInputId, value)` | Set a dropdown+custom-input pair to a value (auto-selects "Custom" if needed) |
| `addMultiValueEntry(fieldName, defaultLabel, defaultValue)` | Global — add a multi-value row (phone, email, address, etc.) with label, value, and remove button |
| `_setupUrlToggle(input, link)` | Wire focus/blur handlers to toggle a clickable URL link next to website inputs |
| `_getMultiValueEntries(fieldName)` | Read all multi-value rows for a field and return `[{label, value}]` |
| `_setMultiValueEntries(fieldName, entries)` | Clear and repopulate multi-value rows for a field |
| `_updateFavoriteDisplay()` | Update the favorite button star icon and title |
| `toggleFavorite()` | Global — toggle favorite via PATCH `/api/contacts/:id/favorite` or locally for new contacts |
| `collectContactData()` | Global — gather all form fields into a contact data object for saving |
| `populateContactForm(contact)` | Global — populate all form fields from a contact object |
| `_showBriefMessage(msg, isError)` | Show a brief success/error message in the save button area |
| `_saveContact()` | Save the contact via POST (new) or PUT (existing) to `/api/contacts` |
| `saveContactAndStay()` | Global — save contact without navigating |
| `saveContactAndExit()` | Global — save contact then navigate to people page |
| `cancelOrExit()` | Global — cancel/exit with unsaved-changes check |
| `deleteContact()` | Global — delete contact via DELETE `/api/contacts/:id` with confirmation |
| `shareContact()` | Global — share contact via QR code using `showContactQrCode` |
| `closeQrModal()` | Global — close the QR modal overlay |
| `_contactEditorState` | Global object — exposes `getContactId`, `setContactId`, `isFavorite`, `setFavorite`, `getSaveSystem` |
| `_showContactAddressMap(addresses)` | Geocode the first address and display an OpenStreetMap embed |
| `_viewAddressInContext(address, focusType)` | Navigate to the maps page centered on the given address (View in Context) |

#### contact-qr.js

Reusable vCard + QR code generation for contact sharing.

| Symbol | Description |
|--------|-------------|
| `generateContactVCard(contact)` | Build a vCard 3.0 string from a contact object (client-side) |
| `_QR_MAX_BYTES` | Constant — maximum QR code byte capacity at error correction level L (2953) |
| `showContactQrCode(contact)` | Show a QR code for a contact using the shared `showQRModal`; handles too-large vCards |

#### weather.js

Weather page: 16-day forecasts for all saved locations rendered as a scrollable table.

| Symbol | Description |
|--------|-------------|
| `_wxPageIcons` | Object — WMO weather code → emoji icon map |
| `_wxPageGetIcon(code)` | Get the emoji icon for a WMO weather code |
| `_wxPageC2F(c)` | Convert Celsius to Fahrenheit (rounded) |
| `_wxPrecipType(code)` | Get precipitation type string from WMO weather code |
| `_wxIsExtreme(highC, lowC, weatherCode)` | Check if weather conditions are extreme |
| `_wxFormatPrecip(precipMm, weatherCode)` | Format precipitation: nearest cm with type, sub-0.5cm = just type, none = '—' |
| `_wxDow` | Array — day-of-week abbreviations (Sun–Sat) |
| `_wxMon` | Array — month abbreviations (Jan–Dec) |
| `_wxFormatDate(dateStr)` | Format a YYYY-MM-DD string into `{ dow, label }` for the header |
| `_wxIsToday(dateStr)` | Check if a YYYY-MM-DD string is today |
| `_initWeatherSidebarShared()` | Initialize shared sidebar for weather page with period/filter/date-nav support |
| `_wxCurrentPeriodOffset` | Number — offset from "now" for prev/next period navigation |
| `_wxAllChits` | Array — all chits, stored for sidebar filter matching on weather page |
| `_wxOnFilterChange()` | Handler for weather filter/period changes — updates date display and applies date filter |
| `_wxApplyDateFilter()` | Shows/hides weather day blocks and date headers based on period, status, tags, priority, people, and text filters |
| `_wxClearFilters()` | Reset weather filters and period to defaults |
| `_wxPrevPeriod()` | Navigate to previous period (decrement offset) |
| `_wxNextPeriod()` | Navigate to next period (increment offset) |
| `_wxUpdateDateDisplay()` | Update sidebar year/range display based on current period and offset |
| `_initWeatherPage()` | IIFE — main page init: load locations, fetch forecasts, render table, add city rows |
| `_wxFetchForecast(loc)` | Fetch 16-day forecast for a single location (shared cache → fresh fetch fallback) |
| `_wxDayOfWeek(dateStr)` | Get the day-of-week (0=Sun..6=Sat) for a YYYY-MM-DD string |
| `_wxBuildLocDateMap(chits, locations)` | Build a map of location index → Set of date strings where chits exist |
| `_wxRenderTable(container, locations, results, weekStartDay, chitsByLocDate)` | Render the full weather forecast table with date headers, location rows, and day blocks |
| `_wxEsc(str)` | Simple HTML escape (ampersand, angle brackets, quotes) |
| `_wxInitBlockClick(container)` | Wire day block click → navigate to dashboard Day view via sessionStorage |
| `_wxDrawWeekLines(container)` | Draw full-height week separator lines (absolute-positioned) |
| `_wxInitDragDrop(container)` | Wire drag-and-drop row reordering on the weather table |
| `_wxOnDragStart(e)` | Handle drag start for weather row reordering |
| `_wxOnDragOver(e)` | Handle drag over for weather row reordering |
| `_wxOnDragEnter(e)` | Handle drag enter — add highlight class |
| `_wxOnDragLeave()` | Handle drag leave — remove highlight class |
| `_wxOnDrop(e)` | Handle drop — reorder rows and persist new order |
| `_wxOnDragEnd()` | Handle drag end — clean up dragging styles |
| `_wxSaveRowOrder(table)` | Save the current row order to localStorage by location label |
| `_wxGetSavedRowOrder()` | Get saved row order from localStorage (array of label strings or null) |
| `_wxExtractCity(address)` | Extract a city name from a full address string (e.g., "City, ST") |
| `_wxBuildCityGroups(chits, savedLocations, forecastDates)` | Build city groups from chits at non-saved locations with date→title mapping |
| `_wxAddCityRows(container, allChits, savedLocations, forecastDates, weekStartDay)` | Add city-based weather rows for chits at non-saved locations; fetch weather per city |

#### profile.js — REMOVED (merged into contact-editor.js)

Profile functionality is now part of `contact-editor.js`. When `?mode=profile` is in the URL, the contact editor switches to profile mode with these additional functions:

| Function | Description |
|----------|-------------|
| `_initProfileMode()` | Switch UI to profile mode: show account/password zones, hide contact-only features (favorite, tags, delete, QR), update labels |
| `_loadProfile()` | Load own profile via `GET /api/auth/me` or another user's via `GET /api/auth/user-profile/{id}` |
| `_populateProfileForm(user)` | Populate the shared form fields from a user profile object (maps user API fields to shared element IDs) |
| `_saveProfile()` | Save profile data via `PUT /api/auth/profile` |
| `_applyReadOnlyMode(displayName)` | Disable all inputs, hide save/password, show read-only banner for viewing other users |
| `changeProfilePassword()` | Change password via `PUT /api/auth/password` with validation |

#### user-admin.js

Admin-only page for managing user accounts. Provides user table listing, create user modal, deactivate/reactivate, and reset password.

| Function | Description |
|----------|-------------|
| `_showAdminMessage(text, type)` | Show an inline message in the admin message area |
| `_clearAdminMessage()` | Clear the admin message area |
| `_loadUsers()` | Fetch all users from `GET /api/users` and render the table |
| `_renderUserTable()` | Render the user table into `#user-table-wrap` |
| `openCreateUserModal()` | Open the create user modal and clear previous input |
| `closeCreateUserModal()` | Close the create user modal |
| `submitCreateUser()` | Submit the create user form via `POST /api/users` |
| `deactivateUser(userId)` | Deactivate a user via `PUT /api/users/{id}/deactivate` |
| `reactivateUser(userId)` | Reactivate a user via `PUT /api/users/{id}/reactivate` |
| `openResetPasswordModal(userId, username)` | Open the reset password modal for a specific user |
| `closeResetPasswordModal()` | Close the reset password modal |
| `submitResetPassword()` | Submit the reset password form via `PUT /api/users/{id}/reset-password` |

#### maps.js

Maps page: interactive Leaflet map with two display modes — **Chits** (chit locations as color-coded markers using chit's own color) and **People** (contact addresses as markers). Uses shared sidebar via `shared-sidebar.js` with maps-specific Page_Context callbacks. Mode toggle (Chits/Both/People) injected into the shared `.header-and-buttons` header. Period dropdown filter (week/month/quarter/year/all), CwocSidebarFilter for tags and people (using shared sidebar container IDs: `label-multi`, `people-multi`, `status-multi`, `priority-multi`), blocked/overdue cluster indicators, color-coded markers, focus mode for "View in Context" navigation, fullscreen mode, default view reset, and responsive layout with mobile sidebar overlay.

| Symbol | Description |
|--------|-------------|
| **Module-level state** | |
| `_mapsLeafletMap` | Leaflet map instance |
| `_mapsClusterGroup` | MarkerClusterGroup instance for chit marker clustering |
| `_mapsAllChits` | Cached array of all fetched chits |
| `_mapsGeocodeCache` | *(removed — uses shared cache from shared-geocoding.js)* |
| `_mapsStatusColors` | Object mapping status strings to hex colors (kept for popup display) |
| `_mapsNoStatusColor` | Default hex color for chits with no status (`#9E9E9E`) |
| `MAPS_MODE_KEY` | localStorage key for persisting the current mode (`'cwoc_maps_mode'`) |
| `_mapsCurrentMode` | Current mode: `'chits'`, `'both'`, or `'people'` |
| `_mapsAllContacts` | Cached array of all fetched contacts |
| `_mapsFocusMode` | Boolean flag — when true, skip fitBounds on marker placement (set by focus query param) |
| `_mapsChitsFilterStatus` | Selected status filter values (array) |
| `_mapsChitsFilterTags` | Selected tag filter values (array, mutated by CwocSidebarFilter) |
| `_mapsChitsFilterPriority` | Selected priority filter values (array) |
| `_mapsChitsFilterPeople` | Selected people filter values (array, mutated by CwocSidebarFilter) |
| `_mapsChitsFilterText` | Text search query for chits filter |
| `_mapsPeriodOffset` | Number — period offset for prev/next navigation (0 = current) |
| `_mapsPeopleFilterText` | Text search query for people filter |
| `_mapsPeopleFilterFavoritesOnly` | Favorites-only toggle state (boolean) |
| `_mapsPeopleFilterTags` | Selected tag filter values for people (array, mutated by CwocSidebarFilter) |
| `_mapsShowAllPeople` | When true, show all people regardless of date filters (boolean) |
| **Header & Mode Toggle** | |
| `_injectModeToggle()` | Creates Chits/Both/People mode toggle and sidebar toggle button, injects them into the shared `.header-and-buttons` header created by shared-page.js. Sidebar toggle calls shared sidebar's `toggleSidebar()` |
| `_getPeriodDateRange(period)` | Returns `{start, end}` Date objects for "week", "month", "quarter", "year", or "all" (null dates) |
| `_isChitOverdue(chit)` | Returns true if chit has a `due_datetime` in the past and status is not 'Complete' |
| **Mode Management** | |
| `_mapsGetMode()` | Returns current mode (`"chits"`, `"both"`, or `"people"`) |
| `_mapsSetMode(mode)` | Sets mode, persists to localStorage, updates toggle button active states, triggers mode switch |
| `_mapsRestoreMode()` | Reads mode from localStorage, validates, defaults to `"chits"` |
| `_onModeToggleChange(e)` | Click handler for mode toggle buttons — reads `data-mode` and calls `_mapsSetMode()` |
| `_switchToChitsMode()` | Transitions to Chits mode — clears all markers, reloads chit filter data, loads chits |
| `_switchToPeopleMode()` | Transitions to People mode — clears all markers, loads contacts |
| `_switchToBothMode()` | Transitions to Both mode (async) — clears all markers once, then loads chits and contacts sequentially to prevent race conditions, fits bounds to all markers after both sets are placed |
| `_removeMarkersByType(type)` | Removes only markers of the given type ('chit' or 'contact') from the shared cluster group, preserving the other type's markers |
| `_fitBoundsToAllMarkers()` | Fits the map bounds to encompass all markers currently in the cluster group; respects auto-zoom and focus mode settings |
| **Shared Sidebar Initialization** | |
| `_initMapsSidebarShared()` | Initializes the shared sidebar for the maps page via `_cwocInitSidebar()` with maps-specific Page_Context (onCreateChit, onToday, onPeriodChange, onFilterChange, onClearFilters, onMapsClick no-op, periodOptions, loadTagFilters, loadPeopleFilters). Hides `.author-info` footer. Wires sidebar `transitionend` to invalidate Leaflet map size. Passes `currentPage: 'maps'` to highlight Maps button |
| **Chits Filter Panel** | |
| `_initChitsFilters()` | Sets up chits filter panel — period dropdown, status/priority checkboxes, and text search are wired by `_cwocInitSidebar()` via shared sidebar. Loads dynamic filter data (tags, people) via `_loadChitsFilterData()` |
| `_loadChitsFilterData()` | Fetches tags from settings and contacts/users, builds CwocSidebarFilter instances for tags (`#label-multi`) and people (`#people-multi`) using the shared sidebar's standard container IDs |
| `_matchesChitTextSearch(chit, query)` | Case-insensitive text search across chit title, note, location, and tags |
| `_applyChitsFilters(chits)` | Applies all chit filters (status, tags, priority, people, text, period date range) — AND-combined. Reads from shared sidebar's `#period-select`, `#status-multi`, `#priority-multi`, `#search` |
| `_onChitsFilterChange()` | Handler for chit filter changes — reads filter state from shared sidebar's standard containers and re-renders |
| `_clearChitsFilters()` | Resets all chit filters to defaults (period back to "week"), resets shared sidebar's status/priority checkboxes, clears search, re-renders CwocSidebarFilter panels |
| **Entry point & map init** | |
| `_mapsInit()` | Entry point: injects mode toggle, checks `prefer_google_maps`, reads map settings for initial view, restores mode, initializes both cluster groups, wires toggle, calls `_initMapsSidebarShared()`, initializes filters, handles focus query parameter, triggers mode |
| `_initLeafletMap()` | Creates Leaflet map instance with OpenStreetMap tile layer; adds Fullscreen and DefaultView controls; configures chit cluster `iconCreateFunction` with mixed cluster detection, blocked (red border) and overdue (orange border) cluster indicators |
| **Utility helpers** | |
| `_hexToRgba(hex, alpha)` | Converts a hex color string (e.g. `"#FF0000"`) to an `rgba(r, g, b, alpha)` CSS string for semi-transparent fills |
| **Fullscreen Control** | |
| `L.Control.Fullscreen` | Leaflet control that toggles browser fullscreen mode via `document.documentElement.requestFullscreen()` / `document.exitFullscreen()`; updates button icon (expand ↔ compress) on `fullscreenchange`; hides itself if `document.fullscreenEnabled` is false; position: topright |
| **Default View Control** | |
| `L.Control.DefaultView` | Leaflet control that resets map to user's configured default view; if auto-zoom enabled → fitBounds to visible markers; if auto-zoom disabled with custom center/zoom → setView; otherwise → default US view (39.8283, -98.5795, zoom 4); position: topright |
| **Chits mode** | |
| `_fetchAndDisplayChits()` | Fetches chits from `/api/chits`, applies filters, geocodes, and places markers |
| `_handleFocusAddress(focusType, address)` | Geocodes address from query params, centers map at zoom 15, shows temporary highlight marker, loads mode markers |
| `_filterAndRender()` | Applies chit filters, geocodes, and places markers; in "both" mode only removes chit markers (preserving contacts) before re-adding |
| `_filterChitsByDateRange(chits, startDate, endDate)` | Returns chits with non-empty location and at least one date field within the range |
| `_geocodeChits(chits)` | Geocodes each chit's location via `_geocodeAddress()` with in-memory cache deduplication |
| `_getMarkerColor(status)` | Returns hex color for a chit status (used in popups) |
| `_buildPopupContent(chit)` | Returns HTML for a chit marker popup with title, date, status icon in icons row, and editor link |
| `_placeMarkers(geocodedChits)` | Creates colored markers using chit's own `color` field (fallback `#d2b48c`); removes only existing chit markers before adding new ones (preserves contacts in "both" mode); stores `_cwocChit` on each marker for cluster blocked/overdue detection; respects auto-zoom setting |
| `_mapsToDateString(date)` | Converts a Date to `YYYY-MM-DD` string |
| **People mode** | |
| `_fetchAndDisplayContacts()` | Fetches contacts from `/api/contacts`, applies people filters (respects `_mapsShowAllPeople` flag to bypass filters), geocodes, places contact markers; removes only contact markers on empty results (preserves chits in "both" mode) |
| `_geocodeContacts(contacts)` | Geocodes contact addresses via shared `_geocodeAddress()` cache |
| `_placeContactMarkers(geocodedContacts)` | Removes existing contact markers first, then creates new contact markers with semi-transparent fills; sets `_cwocMarkerType = 'contact'` on each marker; adds to shared cluster group, fits bounds |
| `_buildContactPopupContent(contact, address)` | Builds popup HTML for contact markers (name, address, org, phone, email, editor link) |
| `_getContactMarkerColor(contact)` | Returns contact's color if non-null/non-empty, else default teal (`#008080`) |
| **People Filter Panel** | |
| `_initPeopleFilters()` | Sets up people filter panel event handlers (text search, favorites toggle, clear button) |
| `_buildPeopleTagChips(contacts)` | Builds tag filter using CwocSidebarFilter from unique tags across all contacts |
| `_mapsContactMatchesFilter(contact, query)` | Case-insensitive text search across all contact fields (replicates `_contactMatchesFilter` logic) |
| `_applyPeopleFilters(contacts)` | Applies all people filters (favorites, tags, text) — AND-combined |
| `_onPeopleFilterChange()` | Handler for people filter changes — re-filters and re-renders contact markers |
| `_clearPeopleFilters()` | Resets all people filters to defaults, re-renders CwocSidebarFilter tag panel |
| **Shared UI helpers** | |
| `_mapsShowLoading()` | Shows a floating toast-style loading indicator overlaid on the map |
| `_mapsHideLoading()` | Hides the floating toast loading indicator |
| `_showInfoMessage(msg)` | Shows info message (e.g., no results) |
| `_hideInfoMessage()` | Hides info message |
| `_mapsFormatDate(isoString)` | Formats an ISO datetime string for popup display |
| `_mapsEsc(str)` | HTML escape for popup content |


## 3. Frontend CSS

All frontend CSS lives under `src/frontend/css/`, organized into three directories.

### 3.1 Shared (`src/frontend/css/shared/`)

#### shared-page.css
Shared styles for ALL secondary pages (settings, help, trash, people, contacts, weather, audit-log). Canonical source of truth for the common CWOC CSS variable set.

| Section | Description |
|---------|-------------|
| CSS Variables | `:root` custom properties — parchment colors, brown tones, accent gold, button/hover, danger/info, border, text, header-bg |
| Base Body | Parchment background, Courier New font, base padding |
| Page Panel (`.settings-panel`) | Main content wrapper — gradient background, border, shadow, max-width |
| Page Header Bar (`.header-and-buttons`) | Logo + title + nav buttons row |
| Headings | `h2`, `h3` styling with brown tones |
| Standard Button (`.standard-button`) | Gradient nav/action buttons |
| Action Buttons (`.cwoc-btn`) | Dark brown buttons matching dashboard sidebar style |
| Settings Grid (`.settings-grid`) | CSS Grid for settings-like block layouts |
| Form Elements | Select, input, textarea styling |
| Tables (`.cwoc-table`) | Shared table styling with header and hover rows |
| Tag Chips (`.cwoc-tag-chip`) | Inline tag chip styling |
| Empty State (`.cwoc-empty`) | Centered empty-state message |
| Toolbar (`.cwoc-toolbar`) | Flex toolbar for button rows |
| Indicator / Checkbox Lists | Flex column lists for settings checkboxes |
| Help Content (`.help-content`) | Help page typography and spacing — includes Ntfy Notifications section (setup flow, topic subscription, local vs Tailscale access, troubleshooting) and Maps View section (date range filter, marker popups, clustering, color-coded status markers, Google Maps preference warning) |
| Author Footer (`.author-info`) | Page footer with copyright |
| Modal (`.modal`) | Full-screen modal overlay and content box |
| Loader Spinner (`.loader`) | CSS spinner animation |
| Navigate Panel (`#cwoc-nav-overlay`) | V-hotkey navigation overlay for secondary pages |
| Tablet Responsive (≤768px) | Settings grid single-column |
| Mobile Responsive (≤480px) | Stacked header, full-width modals |
| Bold Alert Modal (`.cwoc-alert-overlay`) | Full-screen alarm/timer alert shared across all pages |
| Shared Chit Card Badges | `.cwoc-owner-badge` — owner attribution badge on shared chit cards; `.cwoc-role-badge` — role indicator (viewer/manager) on shared chit cards; `.cwoc-stealth-indicator` — stealth icon on chit cards (visible to owner only) |
| Calculator Popover | `.cwoc-calc-popover` — main container (fixed position, z-index 200000, parchment styling); `.cwoc-calc-titlebar` — drag handle with title text and close button; `.cwoc-calc-display` — expression/result display area; `.cwoc-calc-buttons` — 4-column grid layout for calculator buttons; `.cwoc-calc-btn` — individual button styling (digits, operators, special); `.cwoc-calc-btn-op` — operator button variant (accent gold); `.cwoc-calc-btn-eq` — equals button variant (brown); `.cwoc-calc-btn-clear` — clear/backspace variant; `.cwoc-calc-actions` — insert button and persist checkbox row; `.cwoc-calc-persist-indicator` — visual indicator when persist is active |
| Maps People Mode | `.maps-mode-toggle` — mode toggle container; `.maps-mode-btn` — toggle buttons with active state; `.maps-chits-filter-panel` / `.maps-people-filter-panel` — filter panel containers; `.maps-filter-group` — filter section groups; `.maps-filter-tags` — tag chip areas; `.maps-filter-search` — text search inputs; `.maps-clear-filters-btn` — clear filters button; `.maps-favorites-toggle` — favorites-only toggle; `.maps-contact-marker` — semi-transparent contact marker styling (fill via `_hexToRgba`, full-opacity border); `.maps-people-cluster` — square teal cluster icons for people mode; `.maps-people-legend` — people mode legend; responsive rules for ≤768px (collapsible filter panels, stacked layout) |
| Maps Page Layout | `body[data-page-title="Maps View"]` — full viewport override (padding: 0, overflow: hidden, height: 100vh); `.maps-header` — maps page header bar with mode toggle centered, sidebar toggle left, nav buttons right; `.maps-page-layout` — flexbox row container for sidebar + main content (`height: calc(100vh - header)`); `.maps-sidebar` — collapsible left sidebar (240px width, flex-shrink 0, scrollable); `.maps-sidebar.collapsed` — width collapses to 0, content hidden; `.maps-sidebar-toggle-btn` — parchment-themed hamburger toggle button; `.maps-sidebar-scroll` — scrollable inner area for filter panels; `.maps-sidebar-panel` — container for a mode's filter controls; `.maps-main` — flex-grow container for the map; `.maps-sidebar-backdrop` — semi-transparent mobile sidebar backdrop overlay |
| Maps Cluster Icons | `.maps-chit-cluster` — square cluster icon with amber/brown gradient (+ `-small`, `-medium`, `-large` size variants); `.maps-people-cluster` — square cluster icon with teal gradient (+ size variants); `.maps-mixed-cluster` — square icon with inscribed circle, purple gradient for mixed chit+contact clusters (+ size variants); `.maps-mixed-cluster-inner` / `.maps-mixed-cluster-circle` — inner structure for mixed cluster icon |
| Maps Controls | `.maps-fullscreen-control` / `.maps-fullscreen-btn` — fullscreen map control button (44×44px min tap target, topright position); `.maps-default-view-control` / `.maps-default-view-btn` — default view reset map control button (44×44px min tap target, topright position) |
| Maps Mobile Responsive | At ≤768px: sidebar overlays with `position: fixed`, backdrop shows; mode toggle compact styling; map container fills full viewport width |

#### shared-editor.css
Reusable editor patterns shared by the Chit Editor and Contact Editor. Self-contained `:root` variables (must match shared-page.css).

| Section | Description |
|---------|-------------|
| CSS Variables | Editor color palette — shared vars + editor-specific (accent-teal, warning-orange, zone colors) |
| Base Body | Font family and base styling |
| Header Row (`.header-row`) | Logo + title + button groups layout |
| Header Button Groups (`.buttons`) | Left/right button group flex layout |
| General Button Styles | Base button padding, colors, hover, disabled states |
| Editor Container (`.editor`) | Main editor wrapper — background, border, max-width |
| Form Field Styles (`.field`) | Label + input field layout, full-width variants |
| Zone Container Pattern (`.zone-container`) | Collapsible section — header, toggle icon, body, actions |
| Modal Overlay (`.modal`) | Unsaved-changes and confirmation modals |
| Main Zones Grid (`.main-zones-grid`) | Two-column responsive grid for editor zones |
| Toggle Switch (`.switch`) | Reusable on/off toggle component |
| Responsive (≤400px) | Compact header, single-column grid |
| Tablet (≤768px) | Full-width editor, wrapped zone headers |
| Mobile (≤480px) | Stacked header, mobile actions trigger/modal |
| Mobile Actions Modal | Slide-up modal for mobile button access |
| User Switcher (`.cwoc-user-switcher`) | User switcher button, dropdown, and password prompt modal styles |
| Logout Button (`.cwoc-logout-btn`) | Logout button styling in the header |

### 3.2 Dashboard (`src/frontend/css/dashboard/`)

#### styles-variables.css
Dashboard CSS custom properties. Loads FIRST among dashboard stylesheets.

| Section | Description |
|---------|-------------|
| Shared Variables | `:root` vars matching shared-page.css (parchment, brown tones, header-bg) |
| Dashboard-specific Variables | Sidebar bg/border, button bg/border colors |

#### styles-layout.css
Body, header, top bar, logo, week navigation, general form elements, and core layout rules.

| Section | Description |
|---------|-------------|
| Body | Parchment background, font, overflow hidden |
| Header (`h1`) | Title styling, background, height |
| Top Bar / Logo | Logo image, header flex layout |
| Week Navigation | Period nav buttons, week range display |
| Form Elements | General input/select/button styling for dashboard |
| Completed Task (`.completed-task`) | Dimmed styling for completed tasks |
| Checklist All Done (`.checklist-all-done`) | Strikethrough title when all checklist items are checked |

#### styles-sidebar.css
Sidebar positioning, sections, buttons, scroll, filters, multi-select controls, order controls.

| Section | Description |
|---------|-------------|
| Sidebar (`.sidebar`) | Fixed positioning, slide-in transition, scroll layout |
| Sidebar Scroll | Scrollable content area above pinned bottom |
| Sidebar Sections | Section labels, action buttons, create-chit button |
| Filter Groups | Collapsible filter sections with toggle arrows |
| Multi-select Controls | Checkbox lists for status/priority/tag/people filters |
| Order Controls | Sort dropdown and direction button |
| Clear Filters | Clear-all and reset-defaults buttons |
| CwocSidebarFilter | Reusable sidebar filter component |
| Notification Inbox | Notification inbox button with 🔔 icon, count badge, expanded list container, notification cards with chit title, owner name, Accept/Decline buttons, and empty state |

#### styles-tabs.css
Tab bar, tab styling, active/hover states, icon-only mode, tab count, and tab image rules.

| Section | Description |
|---------|-------------|
| Tab Bar (`.tabs`) | Flex container, no-wrap, overflow hidden |
| Tab Styling (`.tab`) | Background, border, font, padding, hover/active states |
| Icon-only Mode | Compact tab display with images only |
| Tab Count | Badge-style count indicators on tabs |

#### styles-calendar.css
All calendar view styles: week, day, month, year, itinerary, timed/all-day events, drag handles.

| Section | Description |
|---------|-------------|
| Week View Grid | CSS Grid layout with hour column + 7 day columns |
| Day Headers | Sticky headers with date display |
| Hour Blocks | Time labels and hour-row backgrounds |
| Timed Events | Absolute-positioned event cards with overlap detection |
| All-day Events | Multi-day spanning events in a dedicated row |
| Month Grid | Month view day cells and event rendering |
| Year View | Compact year overview with month grids |
| Itinerary View | List-style chronological event display |
| Day View | Single-day expanded view |
| Drag Resize Handles | Bottom-edge resize cursor for events |
| Time-now Bar | Red line indicating current time |
| Weather Flash | Animation for weather data loading |

#### styles-cards.css
Chit card styling, notes masonry layout, markdown, people chips, view-specific layouts.

| Section | Description |
|---------|-------------|
| Chit Card (`.chit-card`) | Border, padding, hover, cursor, color |
| Card Header Row | Title, meta info, completed/archived states |
| Drag Feedback | Visual feedback during card drag operations — `.cwoc-dragging` (desktop HTML5 drag), `.cwoc-touch-dragging` (mobile touch drag with pulse animation), `@keyframes cwoc-drag-pulse` |
| Projects Child Items (`.projects-child-item`) | Draggable child chit items in non-Kanban projects list view |
| Notes Masonry | Multi-column masonry layout for notes view |
| Markdown Styling | Rendered markdown within cards |
| Weather Indicator | Weather icon/data on cards |
| People Chips | People name chips on cards |
| View-specific Layouts | Card variations per tab view |
| Notes Drop Indicator | Drop target indicator for notes reorder |
| Owner Badge (`.cwoc-owner-badge`) | Owner attribution badge on chit cards (multi-user) |
| Stealth Indicator (`.cwoc-stealth-indicator`) | 🥷 stealth icon on chit cards, visible to owner only |
| Assignee Badge (`.cwoc-assignee-badge`) | Assigned-to display name badge on chit cards |
| Role Badge (`.cwoc-role-badge`) | Role indicator badge (viewer/manager) on shared chit cards |
| Shared Icon (`.cwoc-shared-icon`) | 🔗 shared icon on dashboard chit cards with hover tooltip showing owner, shared users with roles, and current user's role |
| Declined Chit (`.chit-card.declined-chit`) | Faded visual treatment for chits declined by the current user (`opacity: 0.35`, hover `0.7`); also applies to calendar events (`.timed-event.declined-chit`, `.day-event.declined-chit`, `.month-event.declined-chit`, `.all-day-event.declined-chit`, `.itinerary-event.declined-chit`) |
| RSVP Indicators (`.cwoc-rsvp-indicators`, `.cwoc-rsvp-indicator`) | Small per-user RSVP status indicators on chit cards — `invited` (⏳ neutral), `accepted` (✓ green), `declined` (✗ muted/strikethrough) with display name tooltips |
| RSVP Action Buttons (`.cwoc-rsvp-actions`, `.cwoc-rsvp-btn`) | Accept/decline action buttons on shared chit cards — `.cwoc-rsvp-accept-btn.cwoc-rsvp-btn-active` (green tint), `.cwoc-rsvp-decline-btn.cwoc-rsvp-btn-active` (red tint) |

#### styles-hotkeys.css
Hotkey overlay, panels, reference overlay, and sidebar dimming.

| Section | Description |
|---------|-------------|
| Sidebar Dimming (`.hotkey-overlay`) | Full-screen grey overlay for submenu mode |
| Hotkey Panel (`.hotkey-panel`) | Floating submenu panel — centered, z-indexed |
| Panel Options | Clickable option rows with key badges |
| Reference Overlay | Full reference overlay with tree-structured layout (direct actions, submenus, mouse/editor) |
| Reference Tree | Tree-based columns with groups, submenu roots, indented children, clickable links |

#### styles-modals.css
Delete modal, clock modal, weather modal, quick-edit modal, alert modal.

| Section | Description |
|---------|-------------|
| Delete Chit Modal | Confirmation dialog for chit deletion |
| Clock Modal | Live clock display overlay |
| Weather Modal | Weather forecast overlay |
| Quick-edit Modal | Shift+click inline edit modal for calendar events |
| Bold Alert Modal | Full-screen alarm/timer alert display |

#### styles-responsive.css
All `@media` breakpoint rules for the dashboard.

| Section | Description |
|---------|-------------|
| Tablet (≤768px) | Header wrap, tab scroll, sidebar overlay, compact cards |
| Mobile (≤480px) | Stacked layout, hamburger menu, touch-friendly targets |
| Small Mobile (≤400px) | Ultra-compact adjustments |

#### styles.css
Coordinator file — loads LAST among dashboard sub-stylesheets. Contains only rules that don't fit into any single sub-stylesheet or future overrides.

| Section | Description |
|---------|-------------|
| (coordinator) | Loads after all sub-stylesheets; currently empty — reserved for overrides |

### 3.3 Editor (`src/frontend/css/editor/`)

#### editor.css
Chit-specific styles. Base editor styles (header-row, zones, fields, buttons) come from shared-editor.css.

| Section | Description |
|---------|-------------|
| Archived State | Reduced opacity for archived chits |
| Checklist Container | Checklist item layout, drag handles, nesting, checkbox styling |
| Zone Extensions | Health box, color swatches, and other chit-specific zone content |
| Notes Modal | Expandable notes editing modal overlay |
| Compact Location | Location dropdown in title/weather area |
| Active Tags | Tag chip wrapping in tags zone |
| Grid Span | Two-column spanning for title/weather container |
| Date Mode Layout | Radio-based date mode selector (Start/End, Due, None) |
| Projects Zone | Kanban-style project container, status sections, drag handles, status dropdowns |
| Archive/Audit Buttons | Header button styling for archive and audit log |
| Sharing Panel | 🔗 Sharing zone styles — current shares list, share list items, user name, role badges (manager/viewer), remove button, add share controls row, user picker, role select, add button, stealth toggle row, assigned-to picker row, empty state message |
| Sharing UI Overhaul | `.cwoc-pill-toggle` — inline pill toggle for system user role selection (Viewer/Manager); `.people-user-row` — system user row with chip + pill toggle; `.cwoc-owner-chip` — owner chip in title zone matching people chip style; `#cwoc-owner-chip-container` — inline layout for owner chip; `.sharing-assigned-row` — assigned-to dropdown row in task zone; `.cwoc-stealth-toggle-row` — stealth toggle at bottom of people zone |
| Read-Only Banner | `.cwoc-readonly-banner` — banner for viewer-role shared chits with warning background and border |
| People Expand Modal | `.people-expand-modal` — nearly full-screen modal overlay with alphabetical list of all people (contacts + system users), type labels ("Contact", "Viewer", "Manager", "Assigned"), shrink button (⤡), and ESC-to-close support |
| Responsive (≤400px) | Compact chit-specific overrides |
| Responsive (≤480px) | Mobile chit-specific overrides |

### 3.4 Settings HTML — Network Access Block (`settings.html`)

The `#network-access-block` div inside the `#admin-section` `.settings-grid` provides the Tailscale and Ntfy configuration UI.

**Tailscale section:** Status indicator row with refresh button, IP/hostname info row (hidden by default), error message row (hidden by default), auth key password input with visibility toggle, enabled checkbox, and Save Config / Connect / Disconnect buttons.

**Ntfy section:** Toggle button with status icon (🟢 active / ⚪ inactive / 🔴 error), collapsible config body with status indicator + refresh button, server URL input (default: `http://localhost:2586`), read-only topic display (per-user, computed from logged-in user's UUID), 💾 Save Config button, and 🔔 Test button.

---

## 3.5 Install Scripts

### `install/configurinator.sh` — Server Provisioning Script

| Function | Description |
|----------|-------------|
| `install_tailscale()` | Install Tailscale if not already present; uses `command -v tailscale` to check, runs official install script (`curl -fsSL https://tailscale.com/install.sh \| bash`); non-fatal on failure (`log_warn` + `return 0`); does NOT attempt `tailscale up` or `tailscale login` |

Called in both fresh-install and upgrade paths of `main()`, after `configure_https` and before `start_and_verify`.

`install_python_deps()` includes `pywebpush` in the `required_pkgs` list, installed via `/app/venv/bin/pip`.

### `cwoc-push.sh` — Push Service Startup Script

Ensures push-related services stay running. Checks Tailscale and Ntfy service status on each invocation.

| Block | Description |
|-------|-------------|
| Tailscale check | If Tailscale is installed, ensure it stays running via `systemctl start tailscale` |
| Ntfy check | If ntfy is installed (`command -v ntfy` or `/usr/bin/ntfy`), ensure it stays running via `systemctl start ntfy` |

---

## 3.6 PWA Files (`src/pwa/`)

All Progressive Web App files live under `src/pwa/`. Served by FastAPI via explicit routes (`/sw.js`, `/manifest.json`) and a static mount (`/pwa/*`).

### `src/pwa/manifest.json` — Web App Manifest

JSON manifest defining the PWA identity: `name`, `short_name`, `display` (standalone), `start_url`, `scope`, `theme_color` (#8b5a2b), `background_color` (#f5e6cc), `orientation` (any), and `icons` array (192×192 and 512×512 PNGs).

### `src/pwa/sw.js` — Service Worker

Cache strategy: app-shell URLs use stale-while-revalidate; `/api/*` is network-only; external origins are passthrough; navigation misses fall back to `offline.html`. Versioned cache name: `cwoc-shell-v1`.

| Handler | Description |
|---------|-------------|
| `install` | Pre-cache app shell URLs (HTML pages, CSS, JS, icons, fonts) + `offline.html`, then `skipWaiting()` |
| `activate` | Delete old versioned caches, then `clients.claim()` |
| `fetch` | Route requests: network-only for `/api/*`, passthrough for external origins, stale-while-revalidate for app shell, offline fallback for navigation misses |
| `push` | Parse push event payload as JSON, display notification via `showNotification()` with title, body, icon, badge, and data |
| `notificationclick` | Close notification, navigate to chit URL from payload data, focus existing CWOC window or open new one |

| Symbol | Description |
|--------|-------------|
| `CACHE_NAME` | Versioned cache name constant: `'cwoc-shell-v1'` |
| `APP_SHELL_URLS` | Array of all app shell URLs to pre-cache (HTML, CSS, JS, icons, fonts) |

### `src/pwa/pwa-register.js` — Service Worker Registration & Push Subscription

Loaded via `<script>` on every page. Handles service worker registration, install prompt capture, standalone mode detection, and push notification subscription. All functions are globally accessible (no modules).

| Symbol | Description |
|--------|-------------|
| `_pwaInstallPrompt` | Deferred `beforeinstallprompt` event, captured for later use |
| `registerServiceWorker()` | Register the service worker at `/sw.js` with root scope. Checks for browser support first — fails silently if unsupported |
| `captureInstallPrompt()` | Listen for `beforeinstallprompt` event, defer it, show install button in sidebar. Also listens for `appinstalled` to clean up |
| `handleInstallClick()` | Trigger the deferred install prompt. Called when the user clicks the install button. Hides button on accept or dismiss |
| `_detectStandaloneMode()` | Detect if the app is running in standalone mode (installed). Hides install button if already installed |
| `subscribeToPush()` | Subscribe the browser to push notifications: fetch VAPID public key from `/api/push/vapid-public-key`, subscribe via `pushManager.subscribe()`, POST subscription to `/api/push/subscribe`. Only runs after notification permission is granted |
| `_urlBase64ToUint8Array(base64String)` | Convert a base64url-encoded string to a Uint8Array (needed for `applicationServerKey`) |
| `_arrayBufferToBase64(buffer)` | Convert an ArrayBuffer to a base64 string (used to serialize push subscription keys) |
| `_handleSubscriptionChange()` | Handle push subscription changes — re-subscribe if subscription was lost but permission is still granted |

### `src/pwa/offline.html` — Offline Fallback Page

Standalone offline fallback page served when navigation requests fail. CWOC parchment theme with friendly "no network" message, retry button, and link to dashboard. Uses `shared-page.css` with inline fallback styles for full offline capability.

### `src/pwa/cwoc-icon-192.png` — 192×192 PWA Icon

PWA icon at 192×192 pixels. Referenced by `manifest.json` and `<link rel="apple-touch-icon">`. Served at `/static/cwoc-icon-192.png` via explicit route in `main.py`.

### `src/pwa/cwoc-icon-512.png` — 512×512 PWA Icon

PWA icon at 512×512 pixels. Referenced by `manifest.json`. Served at `/static/cwoc-icon-512.png` via explicit route in `main.py`.


---

## 4. Load Order

All JS is loaded via `<script>` tags — no ES modules. Load order matters because later scripts depend on globals defined by earlier ones.

**PWA meta tags (all pages except `login.html`):**
All HTML pages include the following PWA `<head>` tags: `<link rel="manifest" href="/manifest.json">`, `<meta name="theme-color" content="#8b5a2b">`, `<link rel="apple-touch-icon" href="/static/cwoc-icon-192.png">`, `<meta name="apple-mobile-web-app-capable" content="yes">`, `<meta name="apple-mobile-web-app-status-bar-style" content="default">`. Each page also loads `<script src="/pwa/pwa-register.js"></script>` before closing `</body>`.

### 4.1 Dashboard (`index.html`)

**CSS link order:**
```html
<!-- CDN -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css" />

<!-- Dashboard sub-stylesheets (order matters — variables first, responsive last) -->
<link rel="stylesheet" href="/frontend/css/dashboard/styles-variables.css" />
<link rel="stylesheet" href="/frontend/css/dashboard/styles-layout.css" />
<link rel="stylesheet" href="/frontend/css/dashboard/styles-sidebar.css" />
<link rel="stylesheet" href="/frontend/css/dashboard/styles-tabs.css" />
<link rel="stylesheet" href="/frontend/css/dashboard/styles-calendar.css" />
<link rel="stylesheet" href="/frontend/css/dashboard/styles-cards.css" />
<link rel="stylesheet" href="/frontend/css/dashboard/styles-hotkeys.css" />
<link rel="stylesheet" href="/frontend/css/dashboard/styles-modals.css" />
<link rel="stylesheet" href="/frontend/css/dashboard/styles-responsive.css" />
<link rel="stylesheet" href="/frontend/css/dashboard/styles.css" />

<!-- CDN (icons) -->
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" />
```

**CDN scripts (in `<head>`):**
```html
<script src="https://cdn.jsdelivr.net/npm/flatpickr"></script>
<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js"></script>
```

**App scripts (at end of `<body>`):**
```html
<!-- 1. Shared sub-scripts (order matters — auth first, then utils, coordinator last) -->
<script src="/frontend/js/shared/shared-auth.js"></script>
<script src="/frontend/js/shared/shared-utils.js"></script>
<script src="/frontend/js/shared/shared-touch.js"></script>
<script src="/frontend/js/shared/shared-checklist.js"></script>
<script src="/frontend/js/shared/shared-sort.js"></script>
<script src="/frontend/js/shared/shared-indicators.js"></script>
<script src="/frontend/js/shared/shared-calendar.js"></script>
<script src="/frontend/js/shared/shared-tags.js"></script>
<script src="/frontend/js/shared/shared-recurrence.js"></script>
<script src="/frontend/js/shared/shared-geocoding.js"></script>
<script src="/frontend/js/shared/shared-qr.js"></script>
<script src="/frontend/js/shared/shared.js"></script>
<script src="/frontend/js/shared/shared-calculator.js"></script>
<script src="/frontend/js/shared/shared-sidebar-filter.js"></script>
<script src="/frontend/js/shared/shared-sidebar.js"></script>

<!-- 2. Shared page components -->
<script src="/frontend/js/pages/shared-page.js"></script>

<!-- 3. Dashboard sub-scripts (order matters — init and main last) -->
<script src="/frontend/js/dashboard/main-sidebar.js"></script>
<script src="/frontend/js/dashboard/main-hotkeys.js"></script>
<script src="/frontend/js/dashboard/main-calendar.js"></script>
<script src="/frontend/js/dashboard/main-views.js"></script>
<script src="/frontend/js/dashboard/main-alerts.js"></script>
<script src="/frontend/js/dashboard/main-search.js"></script>
<script src="/frontend/js/dashboard/main-modals.js"></script>
<script src="/frontend/js/dashboard/main-init.js"></script>
<script src="/frontend/js/dashboard/main.js"></script>

<!-- 4. PWA registration (service worker, install prompt, push subscription) -->
<script src="/pwa/pwa-register.js"></script>
```

**CSS link order:**
```html
<!-- CDN -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css" />
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" />

<!-- Editor stylesheets (shared-editor first, then chit-specific) -->
<link rel="stylesheet" href="/frontend/css/shared/shared-editor.css" />
<link rel="stylesheet" href="/frontend/css/editor/editor.css" />
```

**CDN scripts (in `<head>`):**
```html
<script src="https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js"></script>
```

**App scripts (at end of `<body>`):**
```html
<!-- 1. Editor class files (must load before shared scripts that reference them) -->
<script src="/frontend/js/editor/editor_checklists.js"></script>
<script src="/frontend/js/editor/editor_projects.js"></script>

<!-- 2. Shared sub-scripts (auth first, then utils) -->
<script src="/frontend/js/shared/shared-auth.js"></script>
<script src="/frontend/js/shared/shared-utils.js"></script>
<script src="/frontend/js/shared/shared-touch.js"></script>
<script src="/frontend/js/shared/shared-checklist.js"></script>
<script src="/frontend/js/shared/shared-sort.js"></script>
<script src="/frontend/js/shared/shared-indicators.js"></script>
<script src="/frontend/js/shared/shared-calendar.js"></script>
<script src="/frontend/js/shared/shared-tags.js"></script>
<script src="/frontend/js/shared/shared-recurrence.js"></script>
<script src="/frontend/js/shared/shared-geocoding.js"></script>
<script src="/frontend/js/shared/shared-qr.js"></script>
<script src="/frontend/js/shared/shared.js"></script>
<script src="/frontend/js/shared/shared-calculator.js"></script>

<!-- 3. Shared page + editor components -->
<script src="/frontend/js/pages/shared-page.js"></script>
<script src="/frontend/js/pages/shared-editor.js"></script>

<!-- 4. Editor sub-scripts (zone modules, then save, then sharing data-layer, then people, then init) -->
<script src="/frontend/js/editor/editor.js"></script>
<script src="/frontend/js/editor/editor-dates.js"></script>
<script src="/frontend/js/editor/editor-tags.js"></script>
<script src="/frontend/js/editor/editor-location.js"></script>
<script src="/frontend/js/editor/editor-notes.js"></script>
<script src="/frontend/js/editor/editor-alerts.js"></script>
<script src="/frontend/js/editor/editor-color.js"></script>
<script src="/frontend/js/editor/editor-health.js"></script>
<script src="/frontend/js/editor/editor-save.js"></script>
<script src="/frontend/js/editor/editor-sharing.js"></script>
<script src="/frontend/js/editor/editor-people.js"></script>
<script src="/frontend/js/editor/editor-init.js"></script>

<!-- 5. CDN (loaded last) -->
<script src="https://cdn.jsdelivr.net/npm/flatpickr"></script>
<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>

<!-- 6. PWA registration (service worker, install prompt, push subscription) -->
<script src="/pwa/pwa-register.js"></script>
```

### 4.3 Secondary Pages (settings, people, weather, trash, etc.)

All secondary pages follow the same shared pattern. Example from `settings.html`:

**CSS link order:**
```html
<link rel="stylesheet" href="/frontend/css/shared/shared-page.css" />
<link rel="stylesheet" href="/frontend/css/shared/shared-editor.css" />  <!-- only if page has editor-like zones -->
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" />
<style>/* page-specific styles only */</style>
```

**App scripts (at end of `<body>`):**
```html
<!-- 1. Shared sub-scripts (same order as dashboard — auth first, then utils) -->
<script src="/frontend/js/shared/shared-auth.js"></script>
<script src="/frontend/js/shared/shared-utils.js"></script>
<script src="/frontend/js/shared/shared-touch.js"></script>
<script src="/frontend/js/shared/shared-checklist.js"></script>
<script src="/frontend/js/shared/shared-sort.js"></script>
<script src="/frontend/js/shared/shared-indicators.js"></script>
<script src="/frontend/js/shared/shared-calendar.js"></script>
<script src="/frontend/js/shared/shared-tags.js"></script>
<script src="/frontend/js/shared/shared-recurrence.js"></script>
<script src="/frontend/js/shared/shared-geocoding.js"></script>
<script src="/frontend/js/shared/shared-qr.js"></script>
<script src="/frontend/js/shared/shared.js"></script>
<script src="/frontend/js/shared/shared-calculator.js"></script>

<!-- 2. Shared page components -->
<script src="/frontend/js/pages/shared-page.js"></script>

<!-- 3. (Optional) Shared editor if page uses editor zones -->
<script src="/frontend/js/pages/shared-editor.js"></script>

<!-- 4. Page-specific script -->
<script src="/frontend/js/pages/settings.js"></script>

<!-- 5. PWA registration (service worker, install prompt, push subscription) -->
<script src="/pwa/pwa-register.js"></script>
```

Pages using this pattern: `settings.html`, `people.html`, `contact-editor.html`, `weather.html`, `trash.html`, `audit-log.html`, `help.html`, `profile.html`, `user-admin.html`, `maps.html`.

New frontend pages added for multi-user system:
- `login.html` — Standalone login page (no shared header/footer, no `shared-auth.js`). Parchment-themed centered form with username/password inputs.
- `profile.html` — User profile page. Uses `shared-page.css`, `shared-page.js`, `CwocSaveSystem`. Loads `profile.js`.
- `user-admin.html` — Admin-only user management page. Uses `shared-page.css`, `shared-page.js`. Loads `user-admin.js`. Redirects non-admins to `/`.

New frontend pages added for chit sharing system:
- `kiosk.html` — Standalone unauthenticated kiosk page. Reads `users` query parameter from the URL, fetches combined data from `/api/kiosk?user_ids=...`, renders a combined calendar view and task list with `owner_display_name` attribution. Auto-refreshes every 60 seconds. Does not require authentication — no `shared-auth.js` dependency. Uses `shared-page.css` for parchment theme plus inline `<style>` for kiosk-specific layout. All JS is inline in a single IIFE.

New frontend pages added for Maps View:
- `maps.html` — Interactive Leaflet map page with two display modes: Chits (location-based chit markers) and People (contact address markers). Features mode toggle with localStorage persistence, chits filter panel (status, tags, priority, people, text search, date range), people filter panel (text search, favorites toggle, tag chips), mode-specific legends, separate cluster groups with distinct styling, contact popups with editor links, and responsive mobile layout with collapsible filter panels. Uses `shared-page.css` for parchment theme plus inline `<style>` for map-specific layout. Loads Leaflet.js, Leaflet.markercluster (CDN), shared scripts, `shared-page.js`, and `maps.js`. Served at `/maps` via `health.py`.


---

## 5. File Dependency Map

### 5.1 Backend Python Imports

```
src/backend/main.py
  ├── src.backend.db          (init_db, seed_version_info)
  ├── src.backend.migrations  (all migrate_* functions, including migrate_add_multi_user, migrate_add_sharing, migrate_add_push_subscriptions, migrate_add_vapid_keys)
  ├── src.backend.middleware   (AuthMiddleware)
  ├── src.backend.weather     (start_weather_schedulers)
  └── src.backend.routes.*    (all 12 route modules, including auth_router, users_router, sharing_router, notifications_router, network_access_router, push_router, and ntfy_router)

src/backend/routes/chits.py
  ├── src.backend.db           (DB_PATH, serialize/deserialize, compute_system_tags, _build_export_envelope)
  ├── src.backend.models       (Chit, ImportRequest)
  ├── src.backend.sharing      (resolve_effective_role, can_edit_chit, can_delete_chit, can_manage_sharing)
  ├── src.backend.routes.audit (insert_audit_entry, compute_audit_diff, get_actor_from_request)
  └── src.backend.routes.notifications (_create_share_notifications)

src/backend/routes/trash.py
  └── src.backend.db           (DB_PATH, deserialize_json_field)

src/backend/routes/settings.py
  ├── src.backend.db           (DB_PATH, serialize/deserialize)
  ├── src.backend.models       (Settings)
  └── src.backend.routes.audit (insert_audit_entry, compute_audit_diff, get_actor_from_request, _run_auto_prune)

src/backend/routes/contacts.py
  ├── src.backend.db           (DB_PATH, CONTACT_IMAGES_DIR, serialize/deserialize, compute_display_name)
  ├── src.backend.models       (Contact)
  ├── src.backend.serializers  (vcard_parse, vcard_print, csv_export, csv_import)
  └── src.backend.routes.audit (insert_audit_entry, compute_audit_diff, get_actor_from_request)

src/backend/routes/audit.py
  └── src.backend.db           (DB_PATH, deserialize_json_field)

src/backend/routes/health.py
  ├── src.backend.db           (DB_PATH, _update_lock, deserialize_json_field, get_or_create_instance_id, get_version_info, update_version_info)
  └── src.backend.routes.audit (insert_audit_entry, get_current_actor)

src/backend/routes/sharing.py
  ├── src.backend.db           (DB_PATH, serialize_json_field, deserialize_json_field)
  ├── src.backend.sharing      (can_manage_sharing, get_shared_chits_for_user)
  ├── src.backend.routes.audit (insert_audit_entry, get_actor_from_request)
  └── src.backend.routes.notifications (_create_share_notifications)

src/backend/routes/notifications.py
  └── src.backend.db           (DB_PATH, serialize_json_field, deserialize_json_field)

src/backend/routes/network_access.py
  ├── src.backend.db           (DB_PATH)
  └── src.backend.routes.audit (get_actor_from_request, insert_audit_entry)

src/backend/routes/push.py
  └── src.backend.db           (DB_PATH)

src/backend/routes/ntfy.py
  ├── src.backend.db           (DB_PATH)
  └── src.backend.routes.audit (get_actor_from_request, insert_audit_entry)

src/backend/sharing.py
  └── src.backend.db           (DB_PATH, deserialize_json_field)

src/backend/routes/auth.py
  ├── src.backend.auth_utils   (hash_password, verify_password)
  ├── src.backend.db           (DB_PATH)
  └── src.backend.models       (LoginRequest, PasswordChange, ProfileUpdate)

src/backend/routes/users.py
  ├── src.backend.auth_utils   (hash_password)
  ├── src.backend.db           (DB_PATH)
  └── src.backend.models       (UserCreate, UserResponse)

src/backend/middleware.py
  └── src.backend.db           (DB_PATH)

src/backend/auth_utils.py
  └── (no internal CWOC imports — leaf module)

src/backend/schedulers.py
  ├── src.backend.db           (DB_PATH, _update_lock, serialize_json_field)
  ├── src.backend.routes.push  (send_push_to_user — imported lazily in _send_chit_push)
  └── src.backend.routes.ntfy  (send_ntfy_notification — imported lazily in _send_chit_ntfy)

src/backend/migrations.py
  ├── src.backend.db           (DB_PATH, serialize_json_field)
  └── src.backend.auth_utils   (hash_password — used by migrate_add_multi_user)

src/backend/serializers.py
  └── src.backend.db           (compute_display_name)

src/backend/ics_serializer.py
  └── (no internal CWOC imports — leaf module, stdlib only)

src/backend/routes/ics_import.py
  ├── src.backend.db           (DB_PATH, serialize_json_field, compute_system_tags)
  ├── src.backend.models       (ICSImportRequest, ICSImportResponse, Chit)
  └── src.backend.ics_serializer (ics_parse)

src/backend/db.py
  └── (no internal CWOC imports — leaf module)

src/backend/models.py
  └── (no internal CWOC imports — leaf module)
```

**Dependency summary:** `db.py`, `models.py`, and `auth_utils.py` are leaf modules with no internal imports. `routes/audit.py` is imported by `chits.py`, `contacts.py`, `settings.py`, `health.py`, `sharing.py`, `network_access.py`, and `ntfy.py` for audit logging. `routes/notifications.py` is imported by `chits.py` and `sharing.py` for notification creation. `routes/push.py` is imported lazily by `weather.py` for push notification sending. `routes/ntfy.py` is imported lazily by `weather.py` for ntfy notification sending. `auth_utils.py` is imported by `routes/auth.py`, `routes/users.py`, and `migrations.py`. `middleware.py` is imported by `main.py`. All route modules import from `db.py`.

### 5.2 Frontend Script Load Dependencies

Scripts are loaded via `<script>` tags. Later scripts depend on globals defined by earlier ones.

```
shared-auth.js            ← MUST load first (getCurrentUser, isAdmin, waitForAuth — auth guard)
  │
  └── shared-utils.js      ← loads after shared-auth.js (getCachedSettings uses waitForAuth)
        │
        ├── shared-touch.js         (standalone — enableTouchDrag, enableTouchGesture)
        ├── shared-checklist.js     (uses fetch, DOM — no shared-utils deps)
        ├── shared-sort.js          (uses localStorage — no shared-utils deps)
        ├── shared-indicators.js    (standalone — alert type detection)
        ├── shared-calendar.js      (uses getCachedSettings from shared-utils)
        ├── shared-tags.js          (uses getCachedSettings, fetch)
        ├── shared-recurrence.js    (standalone — date math)
        ├── shared-geocoding.js     (uses fetch)
        └── shared-qr.js            (uses qrcode-generator CDN lib)
              │
              └── shared.js          ← coordinator: depends on ALL above shared sub-scripts
                    │                   (uses shared-calendar, shared-tags, shared-recurrence,
                    │                    shared-indicators, shared-sort, shared-touch, shared-qr,
                    │                    shared-utils, shared-geocoding)
                    │
                    ├── shared-calculator.js  ← depends on shared.js (uses cwocToggleCalculator pattern)
                    │
                    ├── shared-sidebar-filter.js  ← depends on shared.js (CwocSidebarFilter component)
                    │
                    └── shared-sidebar.js    ← depends on shared.js + shared-sidebar-filter.js
                          │                   (sidebar injection IIFE, _cwocInitSidebar, toggleSidebar,
                          │                    restoreSidebarState, notifications, topbar toggle)
                          │
                    ├── shared-page.js    ← depends on shared.js + shared-auth.js (CwocSaveSystem, header/footer injection, user switcher, logout)
                    │     │
                    │     ├── shared-editor.js  ← depends on shared-page.js (zone toggle, dirty tracking)
                    │     │
                    │     └── [page-specific scripts]
                    │           settings.js, people.js, contact-editor.js,
                    │           contact-qr.js, weather.js, profile.js, user-admin.js,
                    │           maps.js (depends on shared-sidebar.js for _cwocInitSidebar)
                    │
              ├── [dashboard scripts] — all depend on shared.js + shared-sidebar.js + shared-page.js
              │     main-sidebar.js    (thin wrapper — depends on shared-sidebar.js for _cwocInitSidebar, toggleSidebar, etc.)
              │     main-hotkeys.js
              │     main-calendar.js   (uses shared-calendar, shared-indicators)
              │     main-views.js      (uses shared-tags, shared-sort, shared-indicators)
              │     main-alerts.js     (uses shared alarm system from shared.js)
              │     main-search.js
              │     main-modals.js
              │     main-init.js       (calls init functions from all above)
              │     main.js            (entry point — calls main-init)
              │
              └── [editor scripts] — all depend on shared.js + shared-page.js + shared-editor.js
                    editor_checklists.js  ← loads BEFORE shared scripts (class definition)
                    editor_projects.js    ← loads BEFORE shared scripts (class definition)
                    editor.js             (core editor globals and helpers)
                    editor-dates.js       (date zone logic)
                    editor-tags.js        (tag zone — uses shared-tags)
                    editor-people.js      (people zone + sharing controls — depends on editor-sharing.js globals)
                    editor-location.js    (location zone — uses shared-geocoding)
                    editor-notes.js       (notes zone)
                    editor-alerts.js      (alerts zone)
                    editor-color.js       (color zone)
                    editor-health.js      (health indicators zone)
                    editor-save.js        (save/exit logic)
                    editor-sharing.js     (sharing data-layer — uses shared-auth; provides _sharingUserList, getSharingData, hasSharingData for editor-people.js and editor-init.js)
                    editor-init.js        (entry point — calls init functions)
```

**Key rules:**
- `shared-auth.js` must always load first among app scripts (checks auth, provides `getCurrentUser`, `isAdmin`, `waitForAuth`)
- `shared-utils.js` must load after `shared-auth.js` (uses `waitForAuth()` for user-scoped settings)
- `shared.js` must load after all other `shared-*.js` sub-scripts
- `shared-sidebar-filter.js` must load after `shared.js` (uses DOM utilities)
- `shared-sidebar.js` must load after `shared-sidebar-filter.js` and `shared.js` (uses `_isMobileOverlay`, `_showSidebarBackdrop`, `CwocSidebarFilter`)
- `shared-page.js` must load after `shared-sidebar.js` (uses `getCurrentUser`, `isAdmin` for user switcher and nav)
- `shared-editor.js` must load after `shared-page.js`
- `editor_checklists.js` and `editor_projects.js` load BEFORE shared scripts in editor.html (they define classes used by shared code)
- `main-sidebar.js` depends on `shared-sidebar.js` (calls `_cwocInitSidebar`, uses `toggleSidebar`, `restoreSidebarState`, `_restoreTopbarState`)
- `main-init.js` and `main.js` must load last among dashboard scripts
- `editor-init.js` must load last among editor scripts
- `login.html` does NOT load `shared-auth.js` (login page doesn't need auth guard)
