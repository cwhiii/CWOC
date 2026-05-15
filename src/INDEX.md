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
| `on_startup()` | Startup event — calls `start_weather_schedulers()`, `start_rules_scheduler()`, and `start_ha_polling_scheduler()` |
| `serve_service_worker()` | `GET /sw.js` — Serve the service worker from `src/pwa/sw.js` with `Content-Type: application/javascript` and `Service-Worker-Allowed: /` header |
| `serve_manifest()` | `GET /manifest.json` — Serve the web app manifest from `src/pwa/manifest.json` with `Content-Type: application/json` |
| `serve_icon_192()` | `GET /static/cwoc-icon-192.png` — Serve 192×192 PWA icon from `src/pwa/` |
| `serve_icon_512()` | `GET /static/cwoc-icon-512.png` — Serve 512×512 PWA icon from `src/pwa/` |

Registers all route modules (including `auth_router`, `users_router`, `sharing_router`, `notifications_router`, `network_access_router`, `push_router`, `ntfy_router`, `email_router`, `attachments_router`, `rules_router`, `bundles_router`, `custom_objects_router`, `custom_zones_router`, `ha_router`, `sync_router`, and `devices_router`), runs all migrations (including `migrate_add_multi_user()`, `migrate_add_sharing()`, `migrate_add_kiosk_users()`, `migrate_add_network_access()`, `migrate_add_notifications()`, `migrate_habits_overhaul()`, `migrate_habits_phase2()`, `migrate_add_push_subscriptions()`, `migrate_add_vapid_keys()`, `migrate_add_map_settings()`, `migrate_add_contact_dates()`, `migrate_add_email_fields()`, `migrate_add_attachments()`, `migrate_add_email_body_html()`, `migrate_add_fts5()`, `migrate_add_contact_vault()`, `migrate_create_rules_tables()`, `migrate_add_habit_mode_to_rules()`, `migrate_create_ha_config()`, `migrate_create_bundles_tables()`, `migrate_add_nest_thread_id()`, `migrate_create_custom_objects_tables()`, `migrate_create_custom_zones_table()`, `migrate_bundles_omni_view()`, `migrate_omni_view_settings()`, `migrate_add_timezone_column()`, and `migrate_add_sync_version()`) and `init_db()` at import time, mounts `StaticFiles` for frontend, static, data, and PWA directories.

### 1.3 `src/backend/models.py` — Pydantic Models

| Class | Description |
|-------|-------------|
| `ShareEntry` | Share entry with `user_id: str` and `role: str` (manager or viewer) |
| `SharedTagEntry` | Tag-level share entry with `tag: str` and `shares: List[ShareEntry]` |
| `Tag` | Tag with name, color, fontColor, favorite |
| `Settings` | User settings — time format, tags, colors, indicators, calendar config, audit limits, habits success window, shared_tags, hide_declined, map settings (map_default_lat, map_default_lon, map_default_zoom, map_auto_zoom), email_account (JSON string containing email config), default_share_contacts, omni_layout (JSON string — Omni View section layout config), omni_locked_filters (JSON string — locked filter defaults for Omni View), default_timezone (Optional[str] — user's default IANA timezone), timezone_override (Optional[str] — manual current timezone override), default_view (Optional[str] — user's preferred landing view, defaults to 'Calendar'), etc. |
| `Chit` | Core chit model — title, note, dates, status, checklist, alerts, recurrence, location, color, people, habit, habit_goal, habit_success, show_on_calendar, habit_reset_period, habit_last_action_date, habit_hide_overall, perpetual, shares, stealth, assigned_to, email fields (email_message_id, email_from, email_to, email_cc, email_bcc, email_subject, email_body_text, email_date, email_folder, email_status, email_read, email_in_reply_to, email_references), nest_thread_id (Optional[str] — ID of an email chit in the target thread for nesting non-email chits into email threads), timezone (Optional[str] — IANA timezone identifier for anchored chits, null for floating), etc. |
| `MultiValueEntry` | Label/value pair for contact multi-value fields (phone, email, etc.) |
| `Contact` | Contact model — name fields, phones, emails, addresses, dates, social, security, notes, tags, color, shared_to_vault |
| `ImportRequest` | Import envelope — mode ("add"/"replace") + data dict |
| `UserCreate` | Create user request — username, display_name, password, email (optional), is_admin (optional, default False) |
| `UserResponse` | User response — id, username, display_name, email, is_admin, is_active, created_datetime |
| `LoginRequest` | Login request — username, password |
| `ProfileUpdate` | Profile update request — display_name (optional), email (optional) |
| `PasswordChange` | Password change request — current_password, new_password |
| `Notification` | Notification record — `id`, `user_id`, `chit_id`, `chit_title`, `owner_display_name`, `notification_type` ("invited" or "assigned"), `status` ("pending", "accepted", "declined"), `created_datetime` |
| `RuleCreate` | Create rule request — `name` (str), `description` (Optional), `enabled` (Optional bool, default True), `priority` (Optional int, default 0), `trigger_type` (str), `conditions` (Optional dict — condition tree JSON), `actions` (Optional list — array of action objects), `confirm_before_apply` (Optional bool, default True), `schedule_config` (Optional dict), `habit_mode` (Optional bool, default False) |
| `RuleUpdate` | Update rule request — all fields Optional: `name`, `description`, `enabled`, `priority`, `trigger_type`, `conditions`, `actions`, `confirm_before_apply`, `schedule_config`, `habit_mode`, `habit_history` (Optional list — engine-managed habit execution history) |
| `RuleReorder` | Reorder rules request — `rule_ids` (List[str]) — ordered list of rule IDs |
| `HAConfigUpdate` | HA config update request — `ha_base_url` (Optional[str]), `ha_access_token` (Optional[str]), `ha_poll_interval` (Optional[int], default 30) |
| `HAWebhookPayload` | HA webhook payload — `action` (str), `user_id` (Optional[str]), `chit_id` (Optional[str]), `chit_title` (Optional[str]), `title` (Optional[str]), `note` (Optional[str]), `tags` (Optional[List[str]]), `status` (Optional[str]), `priority` (Optional[str]), `due_datetime` (Optional[str]), `checklist` (Optional[List[Dict]]), `item_text` (Optional[str]), `fields` (Optional[Dict]), `payload` (Optional[Dict]) |
| `BundleCreate` | Create bundle request — `name` (str), `description` (Optional[str]) |
| `BundleUpdate` | Update bundle request — `name` (Optional[str]), `description` (Optional[str]), `omni_view` (Optional[bool]) |
| `BundleReorder` | Reorder bundles request — `bundle_ids` (List[str]) — ordered list of bundle IDs |
| `BundleRuleAssociate` | Associate rule with bundle request — `rule_id` (str) |
| `CustomObjectCreate` | Create custom object request — `type` (str), `sub_type` (Optional[str]), `category` (Optional[str]), `name` (str), `value_type` (str — one of integer/decimal/boolean/string), `units` (Optional[str]), `metric_units` (Optional[str]), `range_min` (Optional[float]), `range_max` (Optional[float]), `conditional_display` (Optional[Dict[str, Any]]) |
| `CustomObjectUpdate` | Update custom object request — all Optional: `name`, `sub_type`, `category`, `units`, `metric_units`, `range_min`, `range_max`, `active` (bool), `sort_order` (int), `conditional_display` (Dict[str, Any]) |
| `ZoneAssignmentCreate` | Create zone assignment request — `zone_id` (str), `config` (Optional[Dict[str, Any]]), `sort_order` (Optional[int], default 0) |
| `ZoneAssignmentUpdate` | Update zone assignment request — `config` (Optional[Dict[str, Any]]), `sort_order` (Optional[int]) |
| `CustomZoneCreate` | Create custom zone request — `name` (str) |
| `CustomZoneUpdate` | Update custom zone request — `name` (Optional[str]), `sort_order` (Optional[int]) |
| `BulkReorderRequest` | Bulk reorder zone assignments request — `object_ids` (List[str]) — ordered list of custom object IDs |

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
| `compute_system_tags(chit)` | Auto-assign system tags (Calendar, Tasks, Notes, Habits, Habits/[title], CWOC_System/Email, etc.) based on chit properties; adds `Habits` and `Habits/[title]` tags when `habit=True`; adds `CWOC_System/Email` when `email_message_id` or `email_status` is set |
| `get_or_create_instance_id()` | Get or create a persistent instance UUID |
| `_build_export_envelope(data_type, data)` | Wrap data in an export envelope with metadata |
| `get_version_info()` | Read version info from the `version_info` table |
| `update_version_info(version, installed_datetime)` | Write version info |
| `utcnow_iso()` | Return current UTC time as ISO 8601 string with Z suffix (shared helper) |
| `row_to_dict(cursor, row)` | Convert a sqlite3 row tuple to a dict using cursor.description (shared helper) |
| `require_admin(request)` | Check that the requesting user is an admin; return user_id or raise 401/403 (shared helper) |
| `seed_version_info()` | Seed initial version info from `/app/src/VERSION` if table is empty |
| `get_next_sync_version(cursor)` | Atomically get and increment the global sync version counter in `sync_state` table. Must be called within the same transaction as the record write. Returns the version number to assign |

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
| `migrate_add_email_fields()` | Add 13 email columns to chits table: `email_message_id` (TEXT), `email_from` (TEXT), `email_to` (TEXT), `email_cc` (TEXT), `email_bcc` (TEXT), `email_subject` (TEXT), `email_body_text` (TEXT), `email_date` (TEXT), `email_folder` (TEXT), `email_status` (TEXT), `email_read` (BOOLEAN), `email_in_reply_to` (TEXT), `email_references` (TEXT); add `email_account` (TEXT) column to settings table. Uses column-existence-check pattern (`PRAGMA table_info` → check → `ALTER TABLE`) |
| `migrate_add_attachments()` | Add `attachments` (TEXT) column to chits table for JSON array of attachment metadata; add `attachment_max_size_mb` (TEXT DEFAULT '10') column to settings table |
| `migrate_add_email_body_html()` | Add `email_body_html` (TEXT) column to chits table for HTML email body rendering |
| `migrate_add_fts5()` | Create `chits_fts` FTS5 virtual table indexing title, note, email_body_text, email_subject; add INSERT/UPDATE/DELETE triggers for sync; rebuild index from existing data. Gracefully handles missing FTS5 support |
| `migrate_add_contact_vault()` | Add `shared_to_vault` (BOOLEAN DEFAULT 0) column to contacts table; add `default_share_contacts` (TEXT DEFAULT '0') column to settings table. Enables the shared Contact Vault feature |
| `migrate_create_rules_tables()` | Create `rules`, `rule_confirmations`, and `rule_execution_log` tables using `CREATE TABLE IF NOT EXISTS`. Rules table: `id` (TEXT PRIMARY KEY), `owner_id`, `name`, `description`, `enabled` (BOOLEAN DEFAULT 1), `priority` (INTEGER DEFAULT 0), `trigger_type`, `conditions` (TEXT — JSON condition tree), `actions` (TEXT — JSON array), `confirm_before_apply` (BOOLEAN DEFAULT 1), `schedule_config` (TEXT — JSON), `created_datetime`, `modified_datetime`, `last_run_datetime`, `run_count` (INTEGER DEFAULT 0), `last_run_result`. Rule confirmations table: `id`, `rule_id`, `rule_name`, `owner_id`, `action_description`, `action_data` (TEXT — JSON), `target_entity_type`, `target_entity_id`, `created_datetime`. Rule execution log table: `id`, `rule_id`, `owner_id`, `trigger_event`, `entities_evaluated`, `entities_matched`, `actions_executed`, `actions_failed`, `result_summary`, `executed_datetime`. Fully idempotent |
| `migrate_add_email_accounts()` | Add `email_accounts` (TEXT) column to settings table for multi-account email; add `email_account_id` (TEXT) to chits; migrate existing `email_account` data into `email_accounts` array with generated IDs. Fully idempotent |
| `migrate_create_ha_config()` | Create `ha_config` table with columns: `id` (INTEGER PRIMARY KEY CHECK id=1), `ha_base_url` (TEXT), `ha_access_token` (TEXT), `ha_webhook_secret` (TEXT), `ha_poll_interval` (INTEGER DEFAULT 30), `configured_by` (TEXT), `modified_datetime` (TEXT). INSERT OR IGNORE a single row with id=1 and auto-generated UUID for ha_webhook_secret. Fully idempotent |
| `migrate_add_view_order()` | Add `view_order` (TEXT) column to settings table for storing user's custom tab order as a JSON array. Fully idempotent |
| `migrate_create_bundles_tables()` | Create `bundles` table (id, owner_id, name, description, display_order, is_default, removable, created_datetime, modified_datetime), `bundle_rules` junction table (id, bundle_id, rule_id, owner_id, created_datetime), and add `bundles_multi_placement` (BOOLEAN DEFAULT 0) column to settings table. Fully idempotent |
| `migrate_add_nest_thread_id()` | Add `nest_thread_id` (TEXT DEFAULT NULL) column to chits table for nesting non-email chits into email threads. Uses column-existence-check pattern (`PRAGMA table_info` → check → `ALTER TABLE`). Fully idempotent |
| `migrate_add_snoozed_until()` | Add `snoozed_until` (TEXT DEFAULT NULL) column to chits table for chit-level snooze. Fully idempotent |
| `migrate_add_session_lifetime()` | Add `session_lifetime` (TEXT DEFAULT '24') column to settings table for configurable session duration. Fully idempotent |
| `migrate_add_notification_delivery_target()` | Add `delivery_target` (TEXT) column to notifications table for device-targeted notification delivery (desktop/mobile). Fully idempotent |
| `migrate_add_autosave_settings()` | Add `autosave_desktop` (TEXT DEFAULT '0') and `autosave_mobile` (TEXT DEFAULT '0') columns to settings table for per-platform auto-save toggles. Fully idempotent |
| `migrate_fix_double_encoded_attachments()` | Fix attachments fields that were double-encoded by serialize_json_field — detects and unwraps double-encoded JSON strings. Fully idempotent |
| `migrate_create_custom_objects_tables()` | Create `custom_objects` table (id, type, sub_type, category, name, value_type, units, metric_units, range_min, range_max, active, deleted, sort_order, is_standard, conditional_display, owner_id, created_datetime, modified_datetime) and `zone_assignments` table (id, custom_object_id, zone_id, config, sort_order, owner_id) with UNIQUE constraints. Fully idempotent |
| `seed_custom_objects(owner_id)` | Seed the standard library of Custom Objects for a user if none exist yet. Seeds Illnesses (10), Injuries (10), Allergies (10), Vitals (6), Body (3), Activity (2) — all with `is_standard=1`. Does NOT create zone assignments |
| `migrate_create_custom_zones_table()` | Create `custom_zones` table (id TEXT PK, zone_id TEXT, name TEXT, sort_order INTEGER DEFAULT 0, owner_id TEXT, created_datetime TEXT) with UNIQUE constraint on (zone_id, owner_id). Fully idempotent |
| `migrate_create_sort_orders_table()` | Create `sort_orders` table (owner_id, view_tab, order_data, modified_datetime) with composite PRIMARY KEY (owner_id, view_tab) for persisting manual chit ordering across devices |
| `migrate_create_sort_preferences_table()` | Create `sort_preferences` table (owner_id, view_tab, sort_field, sort_dir, modified_datetime) with composite PRIMARY KEY (owner_id, view_tab) for persisting sort field/direction per view tab |
| `migrate_bundles_omni_view()` | Add `omni_view` (BOOLEAN DEFAULT 0) column to bundles table. Fully idempotent |
| `migrate_omni_view_settings()` | Add `omni_layout` (TEXT) and `omni_locked_filters` (TEXT) columns to settings table for Omni View layout configuration and locked filter defaults. Fully idempotent |
| `migrate_add_smart_actions_config()` | Add `smart_actions_config` (TEXT) column to settings table for badges/smart action preferences and custom detectors. Fully idempotent |
| `migrate_add_habit_mode_to_rules()` | Add `habit_mode` (BOOLEAN DEFAULT 0) and `habit_history` (TEXT) columns to rules table. Uses column-existence-check pattern. Fully idempotent |
| `migrate_add_custom_view_filters()` | Add `custom_view_filters` (TEXT) column to settings table for per-view custom filter/sort defaults. Fully idempotent |
| `migrate_add_timezone_column()` | Add `timezone` (TEXT DEFAULT NULL) column to chits table for anchored/floating timezone support. Uses column-existence-check pattern. Fully idempotent |
| `migrate_add_default_view()` | Add `default_view` (TEXT DEFAULT 'Calendar') column to settings table for user's preferred landing view. Fully idempotent |
| `migrate_add_sync_version()` | Add `sync_version` (INTEGER DEFAULT 0) and `has_unviewed_conflict` (BOOLEAN DEFAULT 0) columns to chits table; add `sync_version` (INTEGER DEFAULT 0) to contacts and settings tables; create `sync_state` table (single-row global counter); create `device_tokens` table (id, user_id, token_hash, device_name, created_datetime, last_seen_datetime, last_sync_version, revoked); create indexes `idx_chits_sync_version`, `idx_chits_owner_sync`, `idx_contacts_sync_version`, `idx_device_tokens_user`, `idx_device_tokens_hash`; backfill existing records with sequential sync_version values based on `modified_datetime` order. Fully idempotent |

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
| `_build_vtimezone(tz_name, year)` | Generate a VTIMEZONE component for the given IANA timezone and year. Uses `zoneinfo` to determine standard/daylight transitions. Returns empty string if timezone has no transitions (fixed offset) |
| `_format_utc_offset(offset)` | Format a `timedelta` UTC offset as `+HHMM` or `-HHMM` string |
| `_chit_to_ical_datetime(dt_str, all_day)` | Convert a chit datetime string to iCalendar format (`YYYYMMDD` for all-day, `YYYYMMDDTHHMMSS` for timed) |
| `_format_chit_rrule(recurrence_rule)` | Serialize a CWOC `recurrence_rule` dict to RFC 5545 RRULE string. Returns None if rule is empty or invalid |
| `_format_exdates(exceptions, tz_name, all_day)` | Format recurrence exceptions as EXDATE lines with optional TZID context |
| `ics_export_chits(chits)` | Export a list of chit dicts to RFC 5545 iCalendar format. Anchored chits: VTIMEZONE + TZID; floating chits: naive local times; all-day: VALUE=DATE. Omits chits without start_datetime or due_datetime. One VTIMEZONE per unique timezone |

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
| `_alert_push_loop()` | Background loop — runs every 15 seconds, checks for chits whose start/due time falls within the last 15-second window, sends push notifications to chit owners via `_send_chit_push()` and ntfy notifications via `_send_chit_ntfy()`. Handles habit cycle notifications (targetType "cycle") using `_get_habit_cycle_end()` |
| `_get_habit_cycle_end(chit, now)` | Calculate the end-of-cycle datetime for a habit chit based on its recurrence frequency (DAILY/WEEKLY/MONTHLY/YEARLY) |
| `_snooze_check_loop()` | Background loop — runs every 60 seconds, clears `snoozed_until` for expired snoozes and sends push notification |
| `_email_send_later_loop()` | Background loop — runs every 5 seconds, finds draft emails with `email_send_at <= now` and sends them via `_do_send_email_by_id()`; clears `email_send_at` on permanent errors to prevent infinite retries |
| `start_weather_schedulers()` | Start weather background loops (hourly + daily), alert push loop, snooze check loop, and email send-later loop |
| `_is_scheduled_rule_due(rule, now)` | Check whether a scheduled rule is due for execution based on its `schedule_config` (frequency, interval, time_of_day, or cron expression) and `last_run_datetime`. Supports daily and hourly frequencies with 90-second grace for scheduler jitter. If `schedule_config` contains a `cron` field, parses it with `parse_cron()` and checks `matches(parsed, now)` |
| `_derive_period_from_cron(cron_expr)` | Derive habit period (daily/weekly/monthly) from a cron expression. Daily if fires once per day, weekly if fires once per week (specific DOW), monthly if fires on specific DOM, sub-daily defaults to daily |
| `_get_previous_period_date(period, now)` | Get the previous period's date string (YYYY-MM-DD) based on period type (daily/weekly/monthly) |
| `_check_and_insert_missed_habit_entries(rule, now, cursor)` | Insert "missed" habit history entries for periods where the rule should have fired but didn't (e.g., server was down). Also fires `habit_missed` trigger for other rules to react |
| `_fire_habit_trigger(trigger_type, source_rule_id, source_rule_name, owner_id, habit_history, now)` | Fire a habit_achieved or habit_missed trigger in a background thread. Builds a synthetic entity dict with habit metadata (streak, source info) and dispatches to the rules engine |
| `_fire_chit_habit_trigger(trigger_type, chit, owner_id)` | Fire a habit trigger for a chit-based habit (achieved/missed/due). Builds a synthetic entity dict from the chit's habit fields |
| `_habit_due_loop()` | Background loop — runs every 60 seconds, checks all enabled rules with trigger_type='habit_due', evaluates offset timing against source habit schedules, fires triggers when within the time window |
| `_check_habit_due_rule(due_rule, now, cursor, conn)` | Check if a single habit_due rule should fire based on its offset config. Compares current time against source habit's scheduled time plus/minus offset |
| `_rules_scheduled_loop()` | Background loop — runs every 60 seconds, loads all enabled scheduled rules, checks if each is due, queries matching entities (chits or contacts), evaluates condition tree, executes or queues actions, inserts execution log entries, updates rule metadata. Records habit history after execution for habit-mode rules. Fires habit_achieved trigger on success. On first iteration runs after 5-second delay to catch overdue rules after restart |
| `start_rules_scheduler()` | Register the background rules scheduler task and habit_due loop as asyncio tasks. Called from `main.py` on startup |
| `compute_alert_utc(wall_clock_naive, tz_name)` | Convert a naive wall-clock datetime to UTC using the given timezone. Handles DST gaps by advancing to the next valid minute. Handles DST ambiguity by selecting the first (pre-transition) instance (fold=0) |
| `get_user_current_timezone(user_id)` | Resolve the user's current timezone from settings. Precedence: `timezone_override` → `default_timezone` → `'UTC'` fallback |
| `_localize_wall_clock(wall_clock_naive, tz_name)` | Localize a naive wall-clock datetime in the given timezone. Handles DST gaps (advance to first valid minute) and ambiguity (fold=0) |
| `_advance_wall_clock(base_naive, freq, interval, occurrence_index)` | Advance a naive datetime by the given frequency and interval for daily+ recurrences. Preserves wall-clock time across DST transitions |
| `expand_occurrence_tz_aware(base_dt, tz_name, freq, interval, occurrence_index)` | Expand a single recurrence occurrence in the given timezone. Daily+: preserves wall-clock time. Sub-daily (HOURLY/MINUTELY): maintains uniform elapsed-time intervals (UTC-based). Handles DST gap/ambiguity |

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

Session-based authentication middleware for all CWOC requests. Also supports Bearer token authentication for mobile device tokens: if the session cookie check fails, checks for an `Authorization: Bearer <token>` header and validates against the `device_tokens` table (sha256 hash lookup). On successful Bearer auth, sets `request.state.device_id` in addition to `user_id` and `username`.

| Symbol | Description |
|--------|-------------|
| `SESSION_COOKIE_NAME` | Cookie name constant: `"cwoc_session"` |
| `_INACTIVITY_SECONDS` | Inactivity timeout: 24 hours (86,400 seconds) |
| `_CLEANUP_INTERVAL` | Periodic cleanup interval: every 100 requests |
| `_is_excluded(path, method)` | Return True if the request path/method should skip auth (static assets, login page, health check, login API, login-message API, kiosk page and API, PWA files: `/sw.js`, `/manifest.json`, `/pwa/*`, `/api/push/vapid-public-key`, `/api/auth/device-token`) |
| `_cleanup_expired_sessions()` | Delete sessions past their `expires_datetime` or inactive > 24h |
| `AuthMiddleware` | Starlette `BaseHTTPMiddleware` subclass — validates `cwoc_session` cookie first; if no valid session, checks `Authorization: Bearer <token>` header against `device_tokens` table (sha256 hash lookup, non-revoked, active user); injects `request.state.user_id`, `request.state.username`, and `request.state.device_id` (for Bearer auth); updates `last_seen_datetime` on device token; returns 401 for API paths or redirects to `/login` for page paths |

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

### 1.17d `src/backend/test_timezone.py` — Timezone Support Property Tests

Property-based tests for the timezone support feature. Uses Python stdlib only (unittest + random + zoneinfo) — no external libraries. Each property test runs 100+ iterations with randomly generated inputs.

| Class / Function | Description |
|------------------|-------------|
| `TestProperty1InvalidTimezoneRejection` | Invalid timezone rejection — random non-IANA strings are rejected; valid IANA values are accepted (100+ iterations). **Validates: Requirements 1.3, 2.6** |
| `TestProperty2TimezoneResolutionPrecedence` | Timezone resolution precedence — override always wins over browser detection and default; result is always a valid IANA timezone string (100+ iterations). **Validates: Requirements 1.4, 5.5, 9.1** |
| `TestProperty3TimezonePersistenceRoundTrip` | Timezone persistence round-trip — saving a valid IANA timezone string to chit or settings and reading back returns the identical string (100+ iterations). **Validates: Requirements 1.8, 2.5** |
| `TestProperty5TimeDisplayConversion` | Time display conversion correctness — anchored chit times are correctly converted; floating chit times remain unchanged (100+ iterations). **Validates: Requirements 5.1, 5.2, 5.4** |
| `TestProperty6AlertFireTimeComputation` | Alert fire-time computation — anchored alerts compute correctly from chit timezone; floating from user timezone; changing user timezone does not affect anchored alert times (100+ iterations). **Validates: Requirements 6.1, 6.2, 6.4** |
| `TestProperty7DSTGapAlertHandling` | DST gap alert handling — alerts in spring-forward gaps advance to first valid minute (100+ iterations). **Validates: Requirements 6.7** |
| `TestProperty8RecurrenceWallClockPreservation` | Recurrence wall-clock preservation across DST — daily+ anchored recurrences maintain same wall-clock time across DST boundaries (100+ iterations). **Validates: Requirements 7.1, 7.3** |
| `TestProperty9RecurrenceDSTGapShiftForward` | Recurrence DST gap shift-forward — occurrences in spring-forward gaps shift to first valid instant (100+ iterations). **Validates: Requirements 7.4** |
| `TestProperty10RecurrenceFallBackFirstInstance` | Recurrence fall-back first-instance selection — ambiguous fall-back times select first occurrence (fold=0) (100+ iterations). **Validates: Requirements 7.5** |
| `TestProperty11SubDailyUniformIntervals` | Sub-daily recurrence uniform elapsed-time intervals — HOURLY/MINUTELY recurrences maintain exact UTC duration between occurrences across DST (100+ iterations). **Validates: Requirements 7.7** |
| `TestProperty12ICSTimezoneAnnotation` | ICS timezone annotation correctness — anchored → VTIMEZONE + TZID; floating → naive; all-day → VALUE=DATE (100+ iterations). **Validates: Requirements 8.1, 8.2, 8.3** |
| `TestProperty14ICSOmitsDatelessChits` | ICS omits dateless chits — chits without start_datetime or due_datetime produce no VEVENT (100+ iterations). **Validates: Requirements 8.5** |

---

### 1.18 `src/backend/routes/__init__.py`
Package marker. No public exports.

### 1.19 `src/backend/routes/chits.py` — Chit CRUD

All chit endpoints are scoped by `owner_id` — users can only access their own chits, plus chits shared with them via the sharing system. The `request.state.user_id` (set by `AuthMiddleware`) is used for ownership filtering, sharing permission checks, and assignment. Uses `resolve_effective_role`, `can_edit_chit`, `can_delete_chit`, and `can_manage_sharing` from `sharing.py` for access control. Includes reserved tag namespace enforcement (`CWOC_System/` prefix) and email field serialization/deserialization.

| Route | Handler | Description |
|-------|---------|-------------|
| `GET /api/chits` | `get_all_chits(request)` | Return all non-deleted chits owned by the authenticated user |
| `POST /api/chits` | `create_chit(chit, request)` | Create a new chit with `owner_id`, `owner_display_name`, `owner_username` from authenticated user |
| `GET /api/chit/{chit_id}` | `get_chit(chit_id, request)` | Get a single chit by ID (verifies ownership or shared access) |
| `PUT /api/chits/{chit_id}` | `update_chit(chit_id, chit, request)` | Update a chit (verifies ownership or manager access) |
| `DELETE /api/chits/{chit_id}` | `delete_chit(chit_id, request)` | Soft-delete a chit (owner or manager) |
| `PATCH /api/chits/{chit_id}/recurrence-exceptions` | `patch_recurrence_exceptions(chit_id, body, request)` | Add or update a recurrence exception |
| `PATCH /api/chits/{chit_id}/rsvp` | `update_rsvp_status(chit_id, body, request)` | Update the current user's RSVP status on a shared chit |
| `POST /api/chits/{chit_id}/snooze` | `snooze_chit(chit_id, request)` | Snooze/unsnooze a chit. Body: `{"minutes": N}` or `{"until": "ISO"}` or `{"until": null}` to unsnooze. Owner-only |
| `POST /api/chit/{chit_id}/dismiss-conflict` | `dismiss_conflict(chit_id, request)` | Dismiss the unviewed conflict flag on a chit. Sets `has_unviewed_conflict = 0`, assigns new sync_version. Requires owner or manager access |

**Internal helpers:**

| Function | Description |
|----------|-------------|
| `validate_timezone(tz_value)` | Validate that a timezone string is a recognized IANA timezone. Returns True for valid IANA values or None; False for invalid non-null values. Uses `zoneinfo.available_timezones()` |
| `_strip_reserved_tags(tags)` | Remove user-submitted tags with reserved `CWOC_System/` prefix |
| `_validate_tag_name(name)` | Return `False` if tag name uses reserved prefix |
| `_enrich_assigned_to_display_names(cursor, chits)` | Batch-lookup display names for `assigned_to` user IDs |
| `_validate_nest_thread_id(cursor, chit)` | Validate `nest_thread_id` on save — if non-null, verifies the referenced chit exists and is an email chit (`email_message_id IS NOT NULL OR email_status IS NOT NULL`); rejects nest on email chits themselves; returns 422 on invalid |

### 1.19b `src/backend/routes/chits_search.py` — Chit Search

Boolean search expression parser used by global search and admin chit search.

| Route | Handler | Description |
|-------|---------|-------------|
| `GET /api/chits/search` | `search_chits(q, request)` | Global search with boolean operators, #tags, field::value |

**Internal helpers:**

| Function | Description |
|----------|-------------|
| `_search_filter_chits(chits_list, query_str)` | Filter chit dicts using boolean search expression parser (&&, \|\|, !, #tags, field::value, parentheses) |

### 1.19c `src/backend/routes/chits_import.py` — Chit Import/Export

Data management endpoints for exporting and importing chits, userdata, and combined bundles.

| Route | Handler | Description |
|-------|---------|-------------|
| `GET /api/export/chits` | `export_chits(request)` | Export user's chits as JSON envelope |
| `GET /api/export/userdata` | `export_userdata(request)` | Export user's settings + contacts as JSON envelope |
| `GET /api/export/all` | `export_all(request)` | Export all user data as combined JSON envelope |
| `POST /api/import/chits` | `import_chits(req, request)` | Import chits from JSON envelope |
| `POST /api/import/userdata` | `import_userdata(req, request)` | Import user data from JSON envelope |
| `POST /api/import/all` | `import_all(req, request)` | Import all data from combined JSON envelope |

### 1.20 `src/backend/routes/trash.py` — Trash

All trash endpoints are user-scoped: regular users see/act on only their own deleted chits (`owner_id` match). Admins see and can restore/purge any user's deleted chits. Restore logic resets `email_folder` to `"inbox"` for email chits (detected by `email_message_id` or `email_status`).

| Route | Handler | Description |
|-------|---------|-------------|
| `GET /api/trash` | `get_trash(request)` | List soft-deleted chits (own only; admins see all) |
| `POST /api/trash/{chit_id}/restore` | `restore_chit(chit_id, request)` | Restore a soft-deleted chit (own only; admins can restore any) |
| `DELETE /api/trash/{chit_id}/purge` | `purge_chit(chit_id, request)` | Permanently delete a chit (own only; admins can purge any). On email chit deletion, cascades cleanup: nulls `nest_thread_id` on any chits referencing the deleted chit |

| Helper | Description |
|--------|-------------|
| `_is_admin(conn, user_id)` | Check if the given user has admin privileges |
| `_can_purge_record(cursor, sync_version, owner_id)` | Check if all active (non-revoked, seen within 90 days) device tokens for the user have `last_sync_version >= sync_version`. Returns True if safe to purge (all devices have synced past it), False if any active device hasn't synced yet. Devices with `last_seen_datetime` older than 90 days are excluded from the check |

### 1.21 `src/backend/routes/settings.py` — Settings & Alerts

Settings endpoints use `request.state.user_id` from `AuthMiddleware` to scope data to the authenticated user. Includes `shared_tags`, `hide_declined`, map settings (`map_default_lat`, `map_default_lon`, `map_default_zoom`, `map_auto_zoom`), and `email_account` serialization in settings read/save paths. Tag creation validates against the reserved `CWOC_System/` prefix (returns 400 if violated). Timezone fields (`default_timezone`, `timezone_override`) are validated against `zoneinfo.available_timezones()` on save — returns 400 if invalid.

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
| `GET /api/sort-orders` | `get_sort_orders()` | Get all manual sort orders for the authenticated user |
| `PUT /api/sort-orders/{view_tab}` | `save_sort_order(view_tab, body)` | Save manual sort order for a specific view tab |
| `DELETE /api/sort-orders` | `delete_all_sort_orders()` | Delete all manual sort orders and sort preferences for the authenticated user |
| `GET /api/sort-preferences` | `get_sort_preferences()` | Get all sort preferences (field + direction) for the authenticated user |
| `PUT /api/sort-preferences/{view_tab}` | `save_sort_preference(view_tab, body)` | Save sort preference (field + direction) for a specific view tab |

### 1.22 `src/backend/routes/contacts.py` — Contacts

Contact endpoints are scoped by `owner_id`. Users can access their own contacts plus any contact with `shared_to_vault = 1` (Contact Vault). Vault contacts from other users are read-only.

| Route | Handler | Description |
|-------|---------|-------------|
| `POST /api/contacts` | `create_contact(contact, request)` | Create a new contact (sets `owner_id` from authenticated user, supports `shared_to_vault` flag) |
| `GET /api/contacts` | `get_contacts(q, request)` | List contacts owned by authenticated user plus vault contacts from other users (optional search). Vault contacts include `is_vault_contact: true` |
| `GET /api/contacts/export` | `export_contacts(format, request)` | Export authenticated user's own contacts as .vcf or .csv |
| `GET /api/contacts/{contact_id}/export` | `export_single_contact(contact_id, format, request)` | Export a single contact (allows owner or vault access) |
| `GET /api/contacts/{contact_id}` | `get_contact(contact_id, request)` | Get a single contact (allows owner or vault access) |
| `PUT /api/contacts/{contact_id}` | `update_contact(contact_id, contact, request)` | Update a contact (verifies ownership) |
| `DELETE /api/contacts/{contact_id}` | `delete_contact(contact_id, request)` | Delete a contact (verifies ownership) |
| `POST /api/contacts/{contact_id}/image` | `upload_contact_image(contact_id, file)` | Upload a profile image |
| `DELETE /api/contacts/{contact_id}/image` | `delete_contact_image(contact_id)` | Remove a profile image |
| `PATCH /api/contacts/{contact_id}/favorite` | `toggle_contact_favorite(contact_id, request)` | Toggle favorite status (verifies ownership) |
| `POST /api/contacts/import` | `import_contacts(file, request)` | Import contacts from .vcf or .csv file (scoped to authenticated user) |

**Internal helpers:**

| Function | Description |
|----------|-------------|
| `_serialize_contact_for_db(contact)` | Convert a Contact model to a DB-ready dict (includes `shared_to_vault`) |
| `_row_to_contact(row)` | Convert a DB row dict to an API-ready contact dict (includes `shared_to_vault`) |
| `_write_vcf_file(contact_id, contact)` | Write a .vcf file for a contact |

### 1.22b `src/backend/routes/ics_import.py` — ICS Calendar Import

| Route | Handler | Description |
|-------|---------|-------------|
| `POST /api/import/ics` | `import_ics(body, request)` | Import iCalendar (.ics) file content as CWOC chits |
| `GET /api/import/ics/batches` | `get_import_batches(request)` | List all ICS import batches for the current user |
| `POST /api/import/ics/batches/delete` | `delete_import_batch(body, request)` | Soft-delete all chits in a specific import batch |

**Internal helpers:**

| Function | Description |
|----------|-------------|
| `_map_priority(priority_val)` | Map RFC 5545 priority (1-9) to CWOC priority string (High/Medium/Low) |
| `_map_vtodo_status(ics_status)` | Map iCalendar VTODO STATUS to CWOC chit status |
| `map_component_to_chit(component, user_id, display_name, username, batch_tag, calendar_name)` | Map a parsed ICS component to a CWOC chit dict ready for DB insert |
| `map_rrule_to_recurrence(rrule, start_datetime)` | Translate ICS RRULE dict to CWOC recurrence_rule format |
| `find_duplicates(cursor, user_id, chits)` | Check which mapped chits already exist in the DB (title + datetime match) |

### 1.22c `src/backend/routes/tasks_import.py` — Google Tasks Import

| Route | Handler | Description |
|-------|---------|-------------|
| `POST /api/import/google-tasks` | `import_google_tasks(body, request)` | Import Google Tasks (Takeout JSON) as CWOC chits |

**Internal helpers:**

| Function | Description |
|----------|-------------|
| `_parse_rfc3339(value)` | Convert RFC 3339 timestamp to CWOC ISO format |
| `_map_status(google_status)` | Map Google Tasks status (needsAction/completed) to CWOC status |
| `map_task_to_chit(task, list_name, user_id, display_name, username, batch_tag)` | Map a Google Tasks item to a CWOC chit dict |
| `find_duplicates(cursor, user_id, chits)` | Check for duplicate tasks by title + due_datetime |

### 1.22d `src/backend/routes/keep_import.py` — Google Keep Import

| Route | Handler | Description |
|-------|---------|-------------|
| `POST /api/import/google-keep` | `import_google_keep(body, request)` | Import Google Keep notes (Takeout JSON) as CWOC chits |

**Internal helpers:**

| Function | Description |
|----------|-------------|
| `_usec_to_iso(usec)` | Convert microsecond timestamp to ISO datetime string |
| `_map_color(keep_color)` | Map Google Keep color name to hex color |
| `_build_checklist(list_content)` | Convert Keep listContent to CWOC checklist format |
| `map_note_to_chit(note, user_id, display_name, username, batch_tag)` | Map a Google Keep note to a CWOC chit dict |
| `find_duplicates(cursor, user_id, chits)` | Check for duplicate notes by title + created_datetime |

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
| `GET /attachments` | `attachments_page()` | Serve `attachments.html` (all attachments grid) |
| `GET /api/geocode` | `geocode_proxy(q)` | Geocoding proxy to OpenStreetMap Nominatim |
| `POST /api/sync/send` | `sync_send_message(body)` | Post a sync message |
| `GET /api/sync/poll` | `sync_poll(after)` | Poll for sync messages after a given ID |
| `WS /ws/sync` | `websocket_sync(ws)` | WebSocket for real-time sync |
| `GET /api/health-data` | `get_health_data(since, until)` | Return health data points from chits |
| `GET /api/instance-id` | `get_instance_id()` | Get the instance UUID |
| `GET /api/version` | `get_version()` | Get version info |
| `GET /health` | `health_check()` | Health check endpoint |
| `GET /api/disk-usage` | `get_disk_usage()` | Return disk usage stats (total, used, free in bytes) for the data partition |
| `GET /api/update/log` | `get_update_log()` | Get the last update log |
| `GET /api/release-notes` | `get_release_notes()` | Return daily release notes as a list of `{date, content}` objects (newest first), scanned from `release_notes-YYYYMMDD.md` files |
| `GET /api/update/run` | `run_update()` | Run upgrade (SSE stream) |
| `POST /api/restart` | `restart_service()` | Restart the CWOC systemd service (admin only) |
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
| `POST /api/auth/private-pgp-key` | `get_private_pgp_key(body, request)` | Retrieve user's private PGP key after password verification. Returns decrypted key or null. 403 if password wrong |
| `PUT /api/auth/private-pgp-key` | `save_private_pgp_key(body, request)` | Save/update user's private PGP key after password verification. Key encrypted at rest via Fernet. Send empty to remove |
| `POST /api/auth/switch` | `switch_user(body, request)` | Validate target user credentials, invalidate current session, create new session for target user |
| `GET /api/auth/switchable-users` | `list_switchable_users(request)` | Return minimal list of active users (id, username, display_name, profile_image_url, color) for sharing and people filters |

**Internal helpers:**

| Function | Description |
|----------|-------------|
| `_check_rate_limit(username)` | Return True if the username is rate-limited (≥10 failed attempts in 15 min window) |
| `_record_failed_attempt(username)` | Record a failed login attempt timestamp |
| `_clear_attempts(username)` | Clear failed attempts on successful login |
| `_create_session(conn, user_id)` | Create a new session row using the user's configured session_lifetime and return the token |
| `_set_session_cookie(response, token, lifetime_hours)` | Set the `cwoc_session` HttpOnly cookie on a response with appropriate max_age |
| `_get_session_lifetime_hours(conn, user_id)` | Read the session_lifetime setting for a user; returns hours (0 = never expire) |
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

Provides endpoints for listing, creating, updating, and dismissing notifications. Also provides the helper function `_create_share_notifications()` used by `routes/chits.py` and `routes/sharing.py` to create notifications when shares change. Supports device-targeted delivery via `delivery_target` column (desktop/mobile filtering).

| Route | Handler | Description |
|-------|---------|-------------|
| `GET /api/notifications` | `list_notifications(request, device)` | List all notifications for the authenticated user, ordered by `created_datetime` DESC. Optional `?device=mobile\|desktop` query param filters out notifications with a non-matching `delivery_target` |
| `POST /api/notifications` | `create_notification(body, request)` | Create a custom notification (type "reminder") with optional `delivery_target` ("desktop"/"mobile"). Body: `{message, chit_id?, delivery_target?}` |
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

### 1.35 `src/backend/routes/email.py` — Email Integration Routes & Helpers

Provides IMAP sync, SMTP send, email parsing, password encryption, reply/forward helpers, and all email API endpoints. Uses Python stdlib `imaplib`, `smtplib`, `email`, and `email.utils` modules. Password encryption uses `cryptography.fernet.Fernet` when available, with a base64 fallback for dev environments.

**Crypto helpers:**

| Function | Description |
|----------|-------------|
| `_HAS_FERNET` | Boolean flag — True if `cryptography.fernet` is importable |
| `_KEY_PATH_PRODUCTION` | Production key file path: `/app/data/email.key` |
| `_KEY_PATH_DEV` | Dev fallback key file path: `data/email.key` |
| `_get_key_path()` | Return the appropriate key file path for the current environment |
| `_get_or_create_fernet_key()` | Load the Fernet key from disk, or generate and save a new one |
| `_get_fernet()` | Return a `Fernet` instance, or `None` if cryptography is unavailable |
| `_encrypt_password(plaintext)` | Encrypt a password string for storage (Fernet or base64 fallback) |
| `_decrypt_password(ciphertext)` | Decrypt a stored password string (Fernet or base64 fallback) |

**IMAP sync functions:**

| Function | Description |
|----------|-------------|
| `_connect_imap(account)` | Connect and authenticate to the configured IMAP server; returns `imaplib.IMAP4_SSL` with INBOX selected |
| `_get_last_sync_date(cursor, owner_id)` | Query the most recent `email_date` for this user's email chits; returns IMAP-compatible date string; defaults to 30 days ago |
| `_fetch_new_messages(imap, since_date)` | Fetch messages from IMAP newer than `since_date`; returns list of `(raw_bytes, flags_bytes)` tuples |

**Email parsing functions:**

| Function | Description |
|----------|-------------|
| `_decode_header_value(value)` | Decode an RFC 2047 encoded header value into a plain string |
| `_parse_email_message(raw_bytes)` | Parse a raw RFC 2822 email message into a dict of chit-ready fields (From, To, Cc, Subject, Date, Message-ID, In-Reply-To, References, body text, body HTML) |
| `_extract_text_from_message(msg)` | Walk MIME parts and extract the best plain-text body; prefers `text/plain`, falls back to stripping HTML tags from `text/html` |
| `_extract_html_from_message(msg)` | Walk MIME parts and extract the HTML body if present; returns raw HTML string or empty string |
| `_strip_html_tags(html)` | Remove HTML tags and decode common entities, returning plain text |
| `_extract_attachments_from_message(msg)` | Walk MIME parts and extract file attachments; returns list of `{filename, content_bytes, mime_type, size}` dicts |
| `_save_email_attachments(chit_id, extracted)` | Save extracted email attachment files to disk and return metadata list matching manual upload schema |
| `_strip_email_prefixes(subject)` | Strip Re:/Fwd:/Fw: prefixes from a subject line for thread matching |

**Chit creation from parsed email:**

| Function | Description |
|----------|-------------|
| `_create_email_chit(cursor, parsed, owner_id, account_id)` | Insert a new chit from a parsed email message; performs deduplication by `email_message_id`; auto-computes system tags; stores email_account_id; returns chit ID or `None` if duplicate |

**Backfill estimation:**

| Function | Description |
|----------|-------------|
| `_estimate_backfill(account)` | Connect to IMAP and estimate total mailbox size; returns `{message_count, estimated_mb}` (~50 KB per message estimate) |
| `_sync_deletions(imap, cursor, owner_id, account_id)` | Check which local inbox email chits still exist on IMAP; soft-deletes chits whose Message-ID is no longer found; returns count of deleted chits |

**SMTP send functions:**

| Function | Description |
|----------|-------------|
| `_connect_smtp(account)` | Connect and authenticate to the configured SMTP server with STARTTLS |
| `_build_rfc2822_message(chit, account)` | Construct a valid RFC 2822 `EmailMessage` from chit fields with all required headers (From, To, Cc, Bcc, Subject, Date, Message-ID, In-Reply-To, References) |
| `_send_email(smtp, message, from_addr)` | Send an email message and return the Message-ID |

**Reply and forward helpers:**

| Function | Description |
|----------|-------------|
| `_add_subject_prefix(subject, prefix)` | Add `Re: ` or `Fwd: ` prefix to a subject without doubling (case-insensitive check) |
| `_prepare_reply(original_chit, account)` | Create reply draft data — sets `email_to` to original sender, `email_in_reply_to` to original Message-ID, builds References chain, quotes original body below separator |
| `_prepare_forward(original_chit)` | Create forward draft data — empty `email_to`, subject prefixed with `Fwd: `, original message headers and body quoted below separator |

**Router endpoints:**

| Route | Handler | Description |
|-------|---------|-------------|
| `POST /api/email/sync` | `email_sync(request)` | Fetch new messages from configured IMAP servers and soft-delete chits for emails removed from IMAP; returns `{new_count, deleted_count, accounts_synced}` |
| `POST /api/email/send/{chit_id}` | `email_send(chit_id, request)` | Send a draft email chit via SMTP; delegates to `_do_send_email_by_id()`; clears `email_send_at` first |
| `POST /api/email/schedule/{chit_id}` | `email_schedule(chit_id, body, request)` | Schedule a draft email for future sending; body `{send_at: ISO datetime}` or `{send_at: null}` to cancel |
| `PATCH /api/email/{chit_id}/read` | `email_toggle_read(chit_id, request)` | Toggle `email_read` on the specified email chit; returns `{email_read: bool}` |
| `GET /api/email/{chit_id}/raw` | `email_download_raw(chit_id, request)` | Re-fetch the raw RFC 2822 email from IMAP by Message-ID and return as `.eml` download; searches across INBOX, Sent, All Mail folders |
| `GET /api/email/thread/{chit_id}` | `email_thread(chit_id, request)` | Find all related emails in a conversation thread by Message-ID references and normalized subject matching; returns list sorted by `email_date` ascending. Includes nested chits (non-email chits with `nest_thread_id` referencing any thread member) with `is_nest: true` flag |
| `GET /api/email/threads/recent` | `email_threads_recent(request, q)` | Return 20 most recent email threads for the thread picker; uses `_strip_email_prefixes()` normalization to group by subject; optional `q` query parameter for case-insensitive substring filter on subject; sorted by latest `email_date` descending; returns `[{thread_id, subject, latest_date, message_count}]` |
| `POST /api/email/test-connection` | `email_test_connection(request)` | Test IMAP and SMTP connectivity with provided or saved credentials; returns `{imap: {success, message}, smtp: {success, message}}` |
| `POST /api/email/backfill-estimate` | `email_backfill_estimate(request)` | Query IMAP for total message count and estimated storage size; returns `{message_count, estimated_mb}` |

**Internal helpers:**

| Function | Description |
|----------|-------------|
| `_get_email_account(cursor, user_id, account_id)` | Load and return an email account config for the given user; if account_id provided returns that specific account from email_accounts array; raises HTTPException(400) if not found |
| `_get_all_email_accounts(cursor, user_id)` | Load and return all email account configs for the given user; falls back to legacy single account; returns empty list if none configured |
| `_do_send_email_by_id(chit_id, user_id)` | Internal send logic: validates draft status, loads account, builds RFC 2822 message, sends via SMTP, updates chit status to "sent"; called by both API endpoint and send-later scheduler |
| `_strip_tracking_pixels(html)` | Remove 1x1/1x2 pixel tracking images from HTML email content by detecting small width/height attributes or inline styles |
| `_strip_external_content(html)` | Replace all external image sources with a data URI placeholder, storing original src in `data-original-src` attribute for frontend restore |
| `_get_user_email_privacy_settings(cursor, user_id)` | Fetch email privacy settings (block_tracking_pixels, external_content, read_receipts, undo_send_delay) for a user |

---

### 1.36 `src/backend/routes/attachments.py` — Attachment Management Routes

Provides upload, download, and delete endpoints for chit file attachments. Files are stored on disk at `/app/data/attachments/{chit_id}/{uuid}_{filename}`. Metadata is stored as a JSON array in the chit's `attachments` column.

| Function | Description |
|----------|-------------|
| `_get_attachments_dir()` | Return the appropriate attachments directory for the current environment |
| `_get_max_size_bytes(cursor, user_id)` | Load the max attachment size from settings (default 10 MB) |
| `_get_max_storage_bytes(cursor, user_id)` | Load the max total attachment storage per user from settings (default 500 MB, 0 = unlimited) |
| `_get_user_total_attachment_size(cursor, user_id)` | Calculate the total attachment storage used by a user across all their chits |
| `_load_attachments(cursor, chit_id)` | Load the attachments JSON array from a chit |
| `_save_attachments(cursor, chit_id, attachments)` | Save the attachments JSON array back to the chit |

| Route | Handler | Description |
|-------|---------|-------------|
| `POST /api/chits/{chit_id}/attachments` | `upload_attachment(chit_id, request, file)` | Upload a file attachment; validates size limit; stores file on disk and updates chit metadata |
| `GET /api/chits/{chit_id}/attachments/{attachment_id}` | `download_attachment(chit_id, attachment_id, request)` | Download an attachment file by its ID |
| `DELETE /api/chits/{chit_id}/attachments/{attachment_id}` | `delete_attachment(chit_id, attachment_id, request)` | Delete an attachment file and remove it from the chit's metadata |
| `GET /api/attachments` | `list_all_attachments(request)` | List all attachments across all non-deleted chits for the current user; returns flat array with chit_id and chit_title |
| `DELETE /api/attachments/bulk` | `bulk_delete_attachments(request, items)` | Bulk delete multiple attachments; expects JSON array of `{chit_id, attachment_id}` objects |

### 1.37 `src/backend/rules_engine.py` — Rules Engine: Condition Tree Evaluator, Action Executor & Trigger Dispatcher

Pure-function evaluation engine that recursively walks AND/OR group nodes and leaf conditions, returning a boolean. Supports 14 operators, contact cross-references, and regex with a signal-based timeout guard. Also contains the action executor and trigger dispatcher (which have database dependencies).

| Function | Description |
|----------|-------------|
| `validate_condition_tree(tree)` | Validate the structure of a condition tree. Returns `(True, None)` if valid, `(False, error_message)` if invalid. Checks node type (group/leaf), required keys, group operator (AND/OR), and recursively validates children |
| `_regex_match_with_timeout(pattern, text, timeout_seconds=2)` | Compile and match a regex with a SIGALRM-based timeout guard. Returns False on timeout, invalid pattern, or no match. Prevents catastrophic backtracking |
| `_get_field_value(entity, field)` | Extract a field value from an entity dict. Deserializes JSON-serialized list fields (tags, people, alerts, etc.) via `deserialize_json_field`. Returns None when field is absent |
| `_is_empty(value)` | Return True when a value is considered empty (None, whitespace-only string, or empty list) |
| `resolve_contact_cross_ref(field, operator, value, entity, contacts)` | Resolve a condition that cross-references user contacts. Supports `contains_contact_city`, `contains_contact_email`, `contains_contact_name` operators. Returns False when contacts is None/empty or no match found |
| `evaluate_leaf(leaf, entity, contacts=None)` | Evaluate a single leaf condition against an entity. Supports 16+ operators: equals, not_equals, contains, not_contains, starts_with, ends_with, is_empty, is_not_empty, greater_than, less_than, regex_match, tag_present, tag_not_present, person_on_chit, person_not_on_chit, days_ago_greater_than, days_ago_less_than, plus weather operators (weather_temp_low_below, weather_temp_high_above, etc.) and forecast operators (weather_forecast_contains_*). Returns False for missing fields instead of raising errors |
| `evaluate_condition_tree(tree, entity, contacts=None)` | Recursively evaluate a condition tree against an entity. Group nodes use AND (all) or OR (any) logic. Empty AND groups return True (vacuous truth), empty OR groups return False |
| `_get_current_weather_for_default_location(owner_id)` | Get current weather data for the user's default saved location via Open-Meteo. Returns dict with high, low, precipitation, wind_speed, wind_gusts, weather_code or None |
| `_get_weather_forecast_for_default_location(owner_id, days)` | Get multi-day weather forecast for the user's default saved location. Returns list of weather dicts (one per day) or None |
| `_check_weather_condition(operator, weather_data, threshold)` | Check if weather data meets the specified condition (temp/precip/wind comparisons). Returns bool |
| `WEATHER_CONDITION_FIELDS` | frozenset of weather field names for field-based evaluation (weather_code, weather_temperature_high, weather_temperature_low, weather_precipitation, weather_wind_speed) |
| `_WEATHER_FIELD_TO_API_KEY` | Dict mapping weather field names to Open-Meteo daily API response keys (e.g., weather_temperature_high → temperature_2m_max) |
| `_evaluate_weather_condition(leaf)` | Evaluate a weather-field-based condition leaf — geocodes `weather_location`, fetches today's daily forecast from Open-Meteo, extracts relevant metric, compares against threshold using specified operator. Returns False on any failure (geocode, API, timeout) |
| `_substitute_templates(text, entity, trigger_field)` | Resolve `{{placeholder}}` patterns in text against entity fields. Supports `{{today}}`, `{{now}}`, `{{trigger_field}}`, and any entity field name. Unresolved placeholders replaced with empty string |
| `execute_action(action, entity_type, entity_id, owner_id, rule_name, rule_id)` | Execute a single rule action against an entity. Supports chit actions (add_tag, remove_tag, set_status, set_priority, set_severity, set_color, set_location, add_person, archive, move_to_trash, add_to_project, add_alert, share_with_user, assign_to_user, create_chit), email actions (mark_email_read, mark_email_unread, move_email_to_folder), HA actions (call_ha_service, fire_ha_event), send_notification, and add_matching_contacts_as_people. Recomputes system tags, inserts audit entry. Returns `{"success": bool, "message": str}` |
| `dispatch_trigger(trigger_type, entity_type, entity, owner_id)` | Synchronous fire-and-forget trigger dispatcher (called via threading.Thread from route handlers). Loads enabled rules for owner with matching trigger_type, ordered by priority ASC. Evaluates condition tree (with habit-trigger-specific source matching for habit_achieved/habit_missed/habit_due), handles confirm_before_apply branching (queue to rule_confirmations or execute immediately). Inserts execution log entry, updates rule metadata (last_run_datetime, run_count, last_run_result). Pre-loads contacts if any rule uses cross-reference conditions. Recognizes trigger types: chit_created, chit_updated, email_received, contact_created, contact_updated, scheduled, ha_state_change, ha_webhook, habit_achieved, habit_missed, habit_due. Includes comprehensive logging at each step |
| `_match_habit_trigger(rule, entity)` | Check if a habit trigger rule matches the incoming habit event entity based on habit_trigger_config (source_rule_id, source_chit_id, source_type). Wildcard "*" matches any source |
| `_build_action_description(action_type, params, entity)` | Build a human-readable description of a proposed action for the confirmation UI. Maps each action type to a descriptive string with entity title and parameter values. HA actions: `call_ha_service` → "Call HA service {domain}.{service} on {entity_id}", `fire_ha_event` → "Fire Home Assistant event '{event_type}' with {N} data fields" |
| `_send_rule_notification(owner_id, chit_id, chit_title, message)` | Send push and ntfy notifications for a rule action. Uses the same helpers as the alert scheduler — gracefully skips if push or ntfy modules are unavailable |

**Internal helpers:**

| Function | Description |
|----------|-------------|
| `_DictAsObj` | Lightweight adapter class that exposes dict keys as attributes for `compute_system_tags` compatibility |
| `_get_username_for_user(owner_id)` | Return username for the given user from the users table, or just the user_id on failure |
| `_build_rule_actor(rule_name, rule_id, owner_id)` | Build the audit actor string: `"Rule: {rule_name} ({rule_id}) on behalf of {username} ({user_id})"` |
| `_read_chit(cursor, chit_id)` | Read a chit row and return as dict, or None if not found |
| `_read_contact(cursor, contact_id)` | Read a contact row and return as dict, or None if not found |
| `_recompute_and_save_system_tags(cursor, chit, chit_id)` | Recompute system tags for a chit dict and write them back to the DB |

### 1.38 `src/backend/routes/rules.py` — Rules CRUD API Routes

Provides endpoints for creating, reading, updating, deleting rules, toggling enabled state, reordering priorities, managing pending confirmations, and querying execution logs. All endpoints scoped by `owner_id` from authenticated user. Returns 404 for rules not owned by authenticated user (avoids leaking existence).

| Route | Handler | Description |
|-------|---------|-------------|
| `GET /api/rules` | `list_rules(request)` | List all rules for the authenticated user, sorted by priority ASC. Supports `?habit=true` query parameter to filter only habit-mode rules |
| `GET /api/rules/{rule_id}` | `get_rule(rule_id, request)` | Get a single rule by ID. Returns 404 if not owned by authenticated user |
| `POST /api/rules` | `create_rule(rule, request)` | Create a new rule. UUID generated, owner_id set from authenticated user |
| `PUT /api/rules/{rule_id}` | `update_rule(rule_id, rule, request)` | Update an existing rule. Only updates provided (non-None) fields. Returns 404 if not owned |
| `DELETE /api/rules/{rule_id}` | `delete_rule(rule_id, request)` | Delete a rule and clean up pending confirmations. Returns 404 if not owned |
| `PATCH /api/rules/{rule_id}/toggle` | `toggle_rule(rule_id, request)` | Toggle the enabled flag of a rule. Returns 404 if not owned |
| `PUT /api/rules/reorder` | `reorder_rules(reorder, request)` | Accept an ordered list of rule IDs and update their priorities to match index order |
| `GET /api/rules/confirmations` | `list_confirmations(request)` | List pending confirmations for the authenticated user, sorted by timestamp DESC |
| `POST /api/rules/confirmations/{id}/accept` | `accept_confirmation(confirmation_id, request)` | Execute the queued action and delete the confirmation record. Returns 404 if not owned |
| `POST /api/rules/confirmations/{id}/dismiss` | `dismiss_confirmation(confirmation_id, request)` | Discard the queued action and delete the confirmation record. Returns 404 if not owned |
| `GET /api/rules/{rule_id}/log` | `get_rule_execution_log(rule_id, request)` | Execution log for a specific rule (paginated with limit/offset). Returns 404 if rule not owned |
| `GET /api/rules/log` | `get_all_execution_logs(request)` | Execution log across all rules for the authenticated user, with optional filters (rule_id, since, until) and pagination (limit/offset) |

**Internal helpers:**

| Function | Description |
|----------|-------------|
| `_deserialize_rule(rule)` | Deserialize JSON-stored fields (conditions, actions, schedule_config) on a rule dict for API responses. If `habit_mode` is true, computes and attaches `habit_summary` object (current_status, streak, success_rate, last_achieved_datetime, period) |
| `_deserialize_confirmation(conf)` | Deserialize JSON-stored fields (action_data) on a confirmation dict |
| `_compute_habit_summary(rule)` | Compute habit_summary object for a habit rule: current_status (due/achieved/missed), streak, success_rate, last_achieved_datetime, period |
| `_get_period_start(now, period)` | Get the start datetime of the current period (daily/weekly/monthly) |
| `_get_period_end(now, period)` | Get the end datetime of the current period (daily/weekly/monthly) |
| `_compute_streak(habit_history, period, now)` | Compute consecutive achieved periods walking backward from current period |
| `_compute_success_rate(habit_history)` | Compute achieved/total ratio from habit history entries |

### 1.39 `src/backend/test_rules_engine.py` — Rules Engine Property Tests

Property-based tests for the rules engine. Uses Python stdlib only (unittest + random + sqlite3 + uuid) — no external libraries. Each property test runs 100+ iterations with randomly generated inputs.

| Class / Function | Description |
|------------------|-------------|
| `TestProperty1ConditionTreeSerializationRoundTrip` | Condition tree serialization round-trip — generate random condition trees with arbitrary nesting, serialize via `serialize_json_field`, deserialize via `deserialize_json_field`, verify structural equivalence (100+ iterations). **Validates: Requirements 1.4, 12.1, 12.2, 12.3** |
| `TestProperty2LeafConditionOperatorCorrectness` | Leaf condition operator correctness — generate random entities and leaf conditions for each supported operator, verify correct boolean result against operator semantics including JSON-serialized list field deserialization (100+ iterations). **Validates: Requirements 2.2, 2.5, 2.7** |
| `TestProperty3BooleanGroupEvaluationCorrectness` | Boolean group evaluation correctness — generate random nested AND/OR trees with known leaf values, verify group evaluation matches expected boolean logic (AND = all, OR = any) at every nesting level (100+ iterations). **Validates: Requirements 2.1** |
| `TestProperty4MissingFieldSafety` | Missing field safety — generate random field names not present on entity, verify evaluator returns False without raising exceptions (100+ iterations). **Validates: Requirements 2.8** |
| `TestProperty10ConditionTreeValidation` | Condition tree validation — generate random valid and invalid condition trees, verify validation accepts valid trees and rejects malformed ones (missing keys, invalid operator, non-array children) (100+ iterations). **Validates: Requirements 12.4** |
| `TestProperty5DispatchPriorityOrderingAndAllMatch` | Dispatch priority ordering and all-match semantics — generate random rule sets with different priorities, verify dispatch evaluates in ascending priority order and executes ALL matching rules (100+ iterations). **Validates: Requirements 3.7, 3.8** |
| `TestProperty8ConfirmationModeBranching` | Confirmation mode branching — generate random rules with confirm_before_apply True/False, verify queuing vs immediate execution behavior (100+ iterations). **Validates: Requirements 5.1, 5.2, 5.7** |
| `TestProperty7ActionFailureContinuation` | Action failure continuation — generate action sequences where some actions fail, verify executor continues executing remaining actions and logs failures (100+ iterations). **Validates: Requirements 4.8** |
| `TestProperty11OwnerScopingIsolation` | Owner scoping isolation — generate random users and rules, verify querying with user A's owner_id never returns user B's rules (100+ iterations). **Validates: Requirements 1.3, 7.9** |

### 1.40 `src/backend/ha_bridge.py` — Home Assistant Bridge Module

HA communication module using Python stdlib `urllib.request`. Handles all outbound calls to Home Assistant REST API, entity state polling, and template placeholder substitution. All HTTP errors return `{success: False, message: "..."}` without raising exceptions.

| Function | Description |
|----------|-------------|
| `get_ha_config()` | Read ha_config row from DB, decrypt token using `_decrypt_password` from routes/email.py. Returns config dict or None |
| `is_ha_configured()` | Quick check for URL + token presence in ha_config table |
| `call_ha_service(domain, service, entity_id, service_data, timeout=10)` | POST to `{ha_base_url}/api/services/{domain}/{service}` with Bearer token auth. Returns `{success, message}` |
| `fire_ha_event(event_type, event_data, timeout=10)` | POST to `{ha_base_url}/api/events/{event_type}` with Bearer token auth. Returns `{success, message}` |
| `get_ha_entity_state(entity_id)` | GET `/api/states/{entity_id}` from HA. Returns state dict or error |
| `get_ha_entities()` | GET `/api/states` from HA, return simplified entity list (entity_id, state, friendly_name) |
| `get_ha_services()` | GET `/api/services` from HA, return service domain/service list |
| `test_ha_connection(base_url, token)` | GET `/api/` to validate HA connectivity and token. Returns `{success, message}` |
| `substitute_template_placeholders(data, context)` | Replace `{chit_title}`, `{chit_status}`, `{rule_name}`, `{entity_id}` placeholders in string values within a dict |
| `start_ha_polling_scheduler()` | Start the background polling loop as an asyncio task |
| `_ha_polling_loop()` | Background loop — polls monitored entities at configured interval, detects state changes, dispatches `ha_state_change` triggers |
| `update_monitored_entities()` | Rebuild the monitored entity set from enabled rules with `ha_state_change` triggers |

**Internal state:**

| Symbol | Description |
|--------|-------------|
| `_monitored_entities` | In-memory set of entity_ids to poll |
| `_last_known_states` | In-memory dict mapping entity_id → last known state value |

### 1.41 `src/backend/routes/ha.py` — Home Assistant API Routes

Provides HA configuration management, entity/service proxy endpoints, and webhook receiver. Admin-only config endpoints; authenticated entity/service endpoints; token-authenticated webhook endpoint.

| Route | Handler | Description |
|-------|---------|-------------|
| `GET /api/ha/stats` | `get_ha_stats(request)` | Return chit statistics for the authenticated user (total_chits, todo_count, in_progress_count, blocked_count, complete_count, overdue_count, inbox_count, tag_counts) |
| `POST /api/ha/config` | `save_ha_config(body, request)` | Admin-only — save HA config (encrypt token before storage) |
| `GET /api/ha/config` | `get_ha_config(request)` | Admin-only — return config with masked token |
| `POST /api/ha/config/test` | `test_ha_config(body, request)` | Admin-only — test connection via `ha_bridge.test_ha_connection()` |
| `POST /api/ha/config/regenerate-webhook` | `regenerate_webhook_secret(request)` | Admin-only — regenerate webhook secret UUID |
| `GET /api/ha/entities` | `get_ha_entities(request)` | Authenticated — proxy to HA `/api/states` with 60s cache, return simplified entity list |
| `GET /api/ha/services` | `get_ha_services(request)` | Authenticated — proxy to HA `/api/services` with 60s cache |
| `POST /api/ha/webhook` | `receive_webhook(request)` | Token-authenticated — process webhook actions: create_chit, add_checklist_item, update_chit, trigger_rule |

**Internal helpers:**

| Function | Description |
|----------|-------------|
| `_get_authenticated_user_id(request)` | Extract user_id from request state |
| `_require_admin(request)` | Verify requesting user is admin; raise 403 otherwise |
| `_validate_webhook_token(request)` | Validate webhook token from query param or Authorization header against stored secret |
| `_resolve_webhook_user(payload, configured_by)` | Resolve user_id from payload or fall back to configured_by admin |
| `_find_chit_by_id_or_title(cursor, chit_id, chit_title, owner_id)` | Look up a chit by ID or title (most recently modified for duplicate titles) |

### 1.42 `src/backend/test_ha_integration.py` — Home Assistant Integration Property Tests

Property-based tests for the HA integration feature. Uses Python stdlib only (unittest + random + sqlite3 + uuid) — no external libraries. Each property test runs 120+ iterations with randomly generated inputs. Inlines minimal production logic to avoid importing backend modules. 17 properties across 39 test methods.

| Class / Function | Description |
|------------------|-------------|
| `TestProperty1StatsComputationCorrectness` | Stats computation correctness — generate random chit sets, verify total_chits, todo_count, overdue_count, inbox_count, tag_counts (excludes CWOC_System/ tags) (120+ iterations). **Validates: Requirements 1.1, 1.4, 1.5, 1.6** |
| `TestProperty2HAConfigSaveReadRoundTrip` | HA config save/read round-trip — generate random URLs and tokens, verify encrypt→decrypt round-trip preserves values (120+ iterations). **Validates: Requirements 12.2, 12.5, 13.1** |
| `TestProperty3GracefulSkipWhenUnconfigured` | Graceful skip when HA unconfigured — call bridge functions with no config, verify returns `{success: False}` without exceptions (120+ iterations). **Validates: Requirements 7.6, 9.4** |
| `TestProperty4HABridgeRequestURLConstruction` | HA bridge request URL construction — verify call_ha_service and fire_ha_event construct correct URLs with Bearer token (120+ iterations). **Validates: Requirements 7.1, 9.2** |
| `TestProperty5TemplatePlaceholderSubstitution` | Template placeholder substitution — generate random dicts with placeholders, verify all replaced correctly (120+ iterations). **Validates: Requirements 7.5, 9.5** |
| `TestProperty6CallHAServiceDescriptionFormat` | call_ha_service description format — verify description contains domain, service, entity_id (120+ iterations). **Validates: Requirements 9.6** |
| `TestProperty7FireHAEventDescriptionFormat` | fire_ha_event description format — verify format "Fire Home Assistant event '{event_type}' with {N} data fields" (120+ iterations). **Validates: Requirements 7.9** |
| `TestProperty8StateChangeDetection` | State change detection — verify trigger fires when old != new state, no trigger when same (120+ iterations). **Validates: Requirements 10.3** |
| `TestProperty9WebhookTokenValidation` | Webhook token validation — verify rejection when token != secret, acceptance when equal (120+ iterations). **Validates: Requirements 11.2, 11.8** |
| `TestProperty10WebhookUserResolution` | Webhook user resolution — verify user_id from payload when present, fallback to configured_by when absent (120+ iterations). **Validates: Requirements 11.3** |
| `TestProperty14WebhookTriggerRulePayloadPassthrough` | Webhook trigger rule payload passthrough — verify entity dict contains all original payload fields (120+ iterations). **Validates: Requirements 11.7, 18.2** |
| `TestProperty15WebhookRequiredFieldValidation` | Webhook required field validation — verify HTTP 400 for missing required fields per action type (120+ iterations). **Validates: Requirements 11.9** |
| `TestProperty16EntityListSimplification` | Entity list simplification — verify simplified list has same count, each item has entity_id, state, friendly_name (120+ iterations). **Validates: Requirements 15.1** |
| `TestProperty17MonitoredEntitySetComputation` | Monitored entity set computation — verify set = union of ha_entity_id from enabled ha_state_change rules (120+ iterations). **Validates: Requirements 10.5, 14.3, 14.4** |
| `TestProperty18MigrationIdempotency` | Migration idempotency — call migrate_create_ha_config multiple times, verify no errors, correct schema, exactly one row (120+ iterations). **Validates: Requirements 13.1, 13.2, 13.3** |
| `TestProperty19SensorCreationFromStatsData` | Sensor creation from stats data — verify sensor count = 5 + N tags, each native_value matches stats field (120+ iterations). **Validates: Requirements 5.1, 5.4, 5.5** |
| `TestProperty20ChitLookupByTitleOrID` | Chit lookup by title or ID — verify title lookup returns same chit as ID lookup for unique titles, most recently modified for duplicates (120+ iterations). **Validates: Requirements 6.6** |

### 1.43 `ha_integration/custom_components/cwoc/` — Home Assistant Custom Integration

Complete HA custom integration package deployed to HA's `custom_components/` directory.

#### `__init__.py` — Integration Setup

| Function | Description |
|----------|-------------|
| `async_setup_entry(hass, entry)` | Create coordinator, forward to sensor platform, register services |
| `async_unload_entry(hass, entry)` | Unload platforms |

#### `config_flow.py` — Config Flow

| Class | Description |
|-------|-------------|
| `CwocConfigFlow` | Config flow extending `ConfigFlow` — `async_step_user()` presents form with cwoc_url, username, password; validates via POST to `/api/auth/login` |
| `CwocOptionsFlow` | Options flow for reconfiguration (update URL/credentials) |

#### `coordinator.py` — DataUpdateCoordinator

| Class | Description |
|-------|-------------|
| `CwocDataUpdateCoordinator` | Extends `DataUpdateCoordinator` — `_async_update_data()` fetches `/api/ha/stats`; handles connection errors and 401 (raises `ConfigEntryAuthFailed`) |

#### `sensor.py` — Sensor Platform

| Class / Function | Description |
|------------------|-------------|
| `async_setup_entry(hass, entry, async_add_entities)` | Register sensor entities from coordinator data |
| `CwocSensor` | Fixed sensors: cwoc_total_chits, cwoc_todo_count, cwoc_in_progress_count, cwoc_overdue_count, cwoc_inbox_count |
| `CwocTagSensor` | Dynamic tag sensors: cwoc_tag_{name}_count — reports 0 when count is zero |

#### `services.py` — Service Handlers

| Function | Description |
|----------|-------------|
| `create_chit(hass, call)` | Create a chit via CWOC API; returns created chit ID |
| `add_checklist_item(hass, call)` | Add checklist item to a chit |
| `update_chit(hass, call)` | Update chit fields |
| `set_chit_status(hass, call)` | Set chit status (supports lookup by chit_id or chit_title) |
| `add_tag(hass, call)` | Add tag to a chit (supports lookup by chit_id or chit_title) |
| `remove_tag(hass, call)` | Remove tag from a chit (supports lookup by chit_id or chit_title) |

#### `const.py` — Constants

| Symbol | Description |
|--------|-------------|
| `DOMAIN` | Integration domain: "cwoc" |
| `DEFAULT_SCAN_INTERVAL` | Default polling interval: 30 seconds |

#### `manifest.json` — Integration Manifest

Config flow enabled, no external requirements (uses built-in aiohttp).

#### `services.yaml` — Service Definitions

Full field descriptions for all six services.

#### `strings.json` / `translations/en.json` — UI Strings

Config flow step titles, field labels, error messages.

#### `icons.json` — Service Icons

MDI icon mappings for each service action.

### 1.49 `src/backend/cron_parser.py` — Pure-Python Cron Expression Parser

Parses standard 5-field cron expressions (minute hour day-of-month month day-of-week) into sets of valid values, checks datetime matching, and generates human-readable descriptions. No external dependencies — uses only Python stdlib.

| Function | Description |
|----------|-------------|
| `parse_cron(expression: str) -> dict` | Parse a 5-field cron expression into a structured dict with keys: minutes, hours, days_of_month, months, days_of_week (each a set of valid ints). Returns None if invalid |
| `matches(parsed: dict, dt: datetime) -> bool` | Check if a datetime matches a parsed cron expression. Returns False if parsed is None or invalid |
| `describe(expression: str) -> str` | Return a human-readable description of a cron expression (e.g., "Every day at 6:00 AM"). Returns "Invalid cron expression" if unparseable |

**Internal helpers:**

| Function | Description |
|----------|-------------|
| `_replace_names(token, name_map)` | Replace named values (MON, JAN, etc.) with their numeric equivalents |
| `_parse_field(token, min_val, max_val, name_map)` | Parse a single cron field token into a set of valid integers. Supports: *, values, ranges, lists, steps |
| `_parse_part(part, min_val, max_val)` | Parse a single part of a cron field (no commas) |
| `_format_time(hour, minute)` | Format hour and minute as human-readable time (12-hour with AM/PM) |
| `_describe_common_patterns(minute_f, hour_f, dom_f, month_f, dow_f, parsed)` | Match well-known cron patterns and return a friendly description |
| `_describe_generic(parsed)` | Build a generic description from parsed cron fields |
| `_format_set(values)` | Format a set of integers as a compact string |

### 1.44 `src/backend/routes/bundles.py` — Bundle CRUD & Classification

Provides endpoints for creating, reading, updating, deleting bundles, reordering bundle display order, managing bundle-rule associations, initializing default bundles for new users, and email classification into bundles (single-placement and multi-placement). All endpoints scoped by `owner_id` from authenticated user.

| Route | Handler | Description |
|-------|---------|-------------|
| `GET /api/bundles` | `get_bundles(request)` | Return all bundles for the authenticated user sorted by display_order ASC; includes associated rule_ids and `bundles_multi_placement` setting; auto-initializes defaults if none exist |
| `POST /api/bundles` | `create_bundle(bundle, request)` | Create a new bundle; validates non-empty name and no case-insensitive duplicate for owner; returns 400/422 on validation failure |
| `PUT /api/bundles/{bundle_id}` | `update_bundle(bundle_id, bundle, request)` | Update bundle name/description; migrates tags on chits if name changed; returns 404 if not found/owned |
| `DELETE /api/bundles/{bundle_id}` | `delete_bundle(bundle_id, request)` | Delete a bundle; returns 403 if non-removable, 404 if not found; removes bundle tags from chits, deletes associated rules and bundle_rules |
| `PUT /api/bundles/reorder` | `reorder_bundles(reorder, request)` | Reorder bundles by setting display_order from ordered ID list; validates all IDs belong to user |
| `POST /api/bundles/{bundle_id}/add-rule` | `add_rule_to_bundle(bundle_id, request)` | Add a new OR condition rule to an existing bundle; creates rule matching emails by subject or sender; validates bundle exists and is not catch-all; triggers reclassification |
| `POST /api/bundles/{bundle_id}/rules` | `associate_rule_with_bundle(bundle_id, body, request)` | Associate an existing rule with a bundle |
| `DELETE /api/bundles/{bundle_id}/rules/{rule_id}` | `remove_rule_from_bundle(bundle_id, rule_id, request)` | Remove a rule association from a bundle |

**Internal helpers:**

| Function | Description |
|----------|-------------|
| `_row_to_dict(cursor, row)` | Convert a cursor row to a dict using column names |
| `_query_bundles(cursor, owner_id)` | Query all bundles for an owner sorted by display_order ASC |
| `_rename_bundle_tags(cursor, owner_id, old_name, new_name)` | Update `CWOC_System/Bundle/{old}` → `CWOC_System/Bundle/{new}` on all affected chits |
| `_remove_bundle_tag_from_chits(cursor, owner_id, bundle_name)` | Remove a bundle tag from all chits that have it |
| `_initialize_default_bundles(owner_id)` | Create "From Contacts" and "Everything Else" default bundles with associated rule |
| `_load_user_contacts(cursor, owner_id)` | Load user's contacts for cross-reference conditions |
| `_get_rules_for_bundle(cursor, bundle_id, owner_id)` | Load all rules associated with a bundle |
| `_add_tag_to_chit(cursor, chit_id, tag, owner_id)` | Add a tag to a chit's tags JSON array |
| `classify_email_into_bundle(chit, owner_id)` | Single-placement classification — first matching bundle wins |
| `classify_email_into_bundles(chit, owner_id)` | Multi-placement classification — all matching bundles assigned |

### 1.45 `src/backend/test_email_bundles_properties.py` — Email Bundles Property Tests

Property-based tests for the Email Bundles feature. Uses hypothesis for property-based testing. 12 properties across 12 test classes.

| Class | Description |
|-------|-------------|
| `TestProperty1BundleCRUDRoundTrip` | Create → read → update → read round-trip preserves all fields. **Validates: Requirements 1.1, 8.2, 8.3** |
| `TestProperty2OwnerScopingIsolation` | Bundle owned by user B never returned for user A queries; cross-user CRUD returns 404/no-op. **Validates: Requirements 1.3, 8.8** |
| `TestProperty3BundleRenameTagMigration` | Rename bundle N→M: all chits get new tag, none retain old tag, count preserved. **Validates: Requirements 3.5, 7.7** |
| `TestProperty4BundleDeleteTagCleanup` | Delete bundle: zero chits carry tag, bundle_rules deleted, rules deleted. **Validates: Requirements 3.6, 7.5** |
| `TestProperty5BundleListSortOrder` | GET /api/bundles returns bundles sorted by display_order ascending. **Validates: Requirements 5.1, 8.1** |
| `TestProperty6BundleFilteringCorrectness` | Named bundle filter returns exactly matching chits; Everything Else returns untagged; union = complete set. **Validates: Requirements 5.2, 5.3, 9.1, 9.2** |
| `TestProperty7UnreadCountComputation` | Unread count = chits in bundle with email_read=false; single-placement sum = total. **Validates: Requirements 5.8, 9.6** |
| `TestProperty8BundleNameValidation` | Empty/whitespace rejected; case-insensitive duplicates rejected; valid names accepted. **Validates: Requirements 6.4** |
| `TestProperty9BundleReorderPersistence` | Reorder persists display_order 0,1,2...; subsequent GET returns new order. **Validates: Requirements 7.6, 8.5** |
| `TestProperty10BundleFilterComposesWithSubFilter` | Non-inbox sub-filter ignores bundle filter; inbox sub-filter applies it. **Validates: Requirements 9.3** |
| `TestProperty11SinglePlacementPriorityOrdering` | Single-placement assigns only first matching bundle's tag (by display_order). **Validates: Requirements 12.2** |
| `TestProperty12MultiPlacementCompleteness` | Multi-placement assigns tags for ALL matching bundles. **Validates: Requirements 12.3** |

### 1.46 `src/backend/test_email_nests.py` — Email Thread Nests Property Tests

Property-based tests for the Email Thread Nests feature. Uses hypothesis for property-based testing. 11 properties across 11 test classes.

| Class | Description |
|-------|-------------|
| `TestProperty1NestReferenceValidation` | Save with non-null nest_thread_id succeeds iff referenced ID is an existing email chit; rejects non-existent or non-email references. **Validates: Requirements 1.4** |
| `TestProperty2CascadeCleanupOnDelete` | Permanently deleting an email chit nulls nest_thread_id on all referencing chits; no other chits affected. **Validates: Requirements 1.5** |
| `TestProperty3SubjectLabelTruncation` | Displayed text is first 15 chars if length > 15, or full string otherwise; result never exceeds 15 chars. **Validates: Requirements 2.5, 2.6** |
| `TestProperty4NestButtonVisibility` | Nest button hidden iff chit has non-null email_message_id or email_status; visible for all other chits. **Validates: Requirements 2.7** |
| `TestProperty5ThreadSearchFiltering` | Filtered results contain exactly those threads whose subject contains the query as a case-insensitive substring. **Validates: Requirements 3.3, 7.5** |
| `TestProperty6NestedChitThreadMembership` | Expanded view includes exactly those non-email chits whose nest_thread_id matches any chit in the thread. **Validates: Requirements 5.1, 6.1** |
| `TestProperty7NestedChitSortOrder` | Chits with due_date sort ascending, then start_datetime ascending, then after top email; stable within groups. **Validates: Requirements 5.2** |
| `TestProperty8TopCardInvariant` | Topmost visible card of collapsed thread is always an email chit; nested chit never selected as top card. **Validates: Requirements 5.3** |
| `TestProperty9InboxExclusionInvariant` | No chit with non-null nest_thread_id appears as independent entry in email inbox list. **Validates: Requirements 5.4** |
| `TestProperty10NestThreadIdApiRoundTrip` | Saving a valid nest_thread_id and retrieving returns the same value; setting to null results in null on retrieval. **Validates: Requirements 7.1, 7.2** |
| `TestProperty11ThreadEndpointIncludesNests` | Thread endpoint response includes all non-deleted chits whose nest_thread_id references any thread member, each with is_nest=true. **Validates: Requirements 7.3** |

### 1.47 `src/backend/routes/custom_objects.py` — Custom Objects Registry CRUD & Zone Assignments

Provides CRUD endpoints for managing Custom Objects in the generic registry, including listing, creating, updating, soft-deleting, restoring, and zone assignment management. All endpoints scoped by `owner_id` from authenticated user.

| Route | Handler | Description |
|-------|---------|-------------|
| `GET /api/custom-objects` | `list_custom_objects(request, type, category)` | List all non-deleted custom objects for the user, optional `?type=` and `?category=` filters. Returns zone_assignments as nested array |
| `POST /api/custom-objects` | `create_custom_object(request, obj)` | Create a new custom object. Validates value_type, enforces unique constraint (409 on duplicate), generates UUID, sets timestamps |
| `PUT /api/custom-objects/{id}` | `update_custom_object(request, id, updates)` | Update mutable fields on an existing custom object. Updates modified_datetime |
| `DELETE /api/custom-objects/{id}` | `delete_custom_object(request, id)` | Soft-delete a custom object (sets active=0, deleted=1) |
| `POST /api/custom-objects/{id}/restore` | `restore_custom_object(request, id)` | Restore a soft-deleted standard object. Returns 400 if not standard |
| `GET /api/custom-objects/zone/{zone_id}` | `get_objects_by_zone(request, zone_id)` | Return all active custom objects assigned to a zone. Joins with zone_assignments, excludes inactive/deleted |
| `POST /api/custom-objects/{id}/assign` | `create_zone_assignment(request, id, assignment)` | Create a zone assignment. Returns 409 if already assigned |
| `PUT /api/custom-objects/{id}/assign/{zone_id}` | `update_zone_assignment(request, id, zone_id, updates)` | Update zone assignment config and/or sort_order |
| `DELETE /api/custom-objects/{id}/assign/{zone_id}` | `delete_zone_assignment(request, id, zone_id)` | Remove a zone assignment |
| `PUT /api/custom-objects/zone/{zone_id}/reorder` | `bulk_reorder_zone_assignments(request, zone_id, body)` | Bulk update sort_order for zone assignments. Accepts `{"object_ids": [...]}`, updates sort_order sequentially (1, 2, 3, ...). Skips missing assignments without error |

**Internal helpers:**

| Function | Description |
|----------|-------------|
| `_row_to_dict(row, cursor)` | Convert a sqlite3 Row to a plain dict using cursor.description |
| `_format_object(obj)` | Format a custom_objects row dict for API response — converts integer flags to booleans, parses conditional_display JSON |
| `_get_zone_assignments(conn, custom_object_id, owner_id)` | Fetch zone assignments for a custom object, parsing config JSON |

### 1.48 `src/backend/routes/custom_zones.py` — Custom Zones CRUD

Provides CRUD endpoints for managing Custom Zones — user-defined named collections of Custom Objects that render as collapsible zones in the chit editor. All endpoints scoped by `owner_id` from authenticated user.

| Route | Handler | Description |
|-------|---------|-------------|
| `GET /api/custom-zones` | `list_custom_zones(request)` | List all custom zones for the user, ordered by sort_order. Includes object_count via COUNT on zone_assignments |
| `POST /api/custom-zones` | `create_custom_zone(request, zone)` | Create a new zone (accepts name, generates zone_id via slugification). Validates non-empty name, checks uniqueness (409 on duplicate) |
| `PUT /api/custom-zones/{zone_id}` | `update_custom_zone(request, zone_id, updates)` | Update name and/or sort_order. Zone_id does NOT change on rename |
| `DELETE /api/custom-zones/{zone_id}` | `delete_custom_zone(request, zone_id)` | Delete zone record AND cascade delete all zone_assignments for that zone. Health_data on chits is preserved |

**Internal helpers:**

| Function | Description |
|----------|-------------|
| `_slugify_zone_name(name)` | Generate zone_id from name: lowercase, replace non-alphanumeric with `_`, collapse consecutive, strip leading/trailing, prefix `cz_` |

### 1.50 `src/backend/routes/sync.py` — Sync API (Pull & Push)

Provides endpoints for mobile sync: pulling changes since a given sync version, and pushing local changes from mobile clients with field-level conflict resolution.

| Route | Handler | Description |
|-------|---------|-------------|
| `GET /api/sync/changes` | `get_sync_changes(request, since, include)` | Pull changes since a given sync version. Query params: `since` (int, default 0), `include` (comma-separated: chits, contacts, settings). Returns `{server_version, chits: [...], contacts: [...], settings: {...}}`. Includes soft-deleted chits. Updates `last_sync_version` on the requesting device token |
| `POST /api/sync/push` | `sync_push(request)` | Push local changes from mobile clients. Accepts JSON body: `{chits: [...], contacts: [...], settings: {...}}`. For each record: creates if new, updates if no conflict, resolves via field-level LWW merge if conflict. Returns per-record status (accepted/created/merged/conflict/error). Writes audit log entries for conflicts |

**Internal helpers:**

| Function | Description |
|----------|-------------|
| `_deserialize_chit_for_sync(chit)` | Deserialize JSON fields on a chit dict in place for sync response. Mirrors the deserialization done in the GET /api/chits endpoint |
| `_deserialize_contact_for_sync(contact)` | Deserialize JSON fields on a contact dict in place for sync response |
| `_resolve_conflict(server_chit, client_chit)` | Field-level conflict resolution for chits using Last-Writer-Wins (LWW) on `modified_datetime`. Returns `(merged_dict, conflict_fields_list)`. Sets `has_unviewed_conflict = true` on the merged record |
| `_resolve_contact_conflict(server_contact, client_contact)` | Field-level conflict resolution for contacts using LWW on `modified_datetime`. Returns `(merged_dict, conflict_fields_list)` |
| `_build_chit_insert_values(chit, user_id, sync_version, current_time)` | Build the column names and values tuple for inserting a new chit from a sync push |
| `_build_chit_update_values(chit, sync_version, current_time, chit_id)` | Build the SET clause values tuple for updating an existing chit from a sync push |
| `_apply_settings_from_push(cursor, user_id, settings_data, sync_version, current_time)` | Apply settings from a sync push using LWW on entire record (no field-level merge) |

### 1.51 `src/backend/routes/devices.py` — Device Token Management

Provides endpoints for creating device tokens (mobile app authentication), listing registered devices, revoking device tokens, and renaming devices.

| Route | Handler | Description |
|-------|---------|-------------|
| `POST /api/auth/device-token` | `create_device_token(body)` | Validate username/password credentials and issue a new device token. Generates token via `secrets.token_urlsafe(32)`, stores sha256 hash in `device_tokens` table. Returns raw token (one time only), device_id, device_name, created_datetime. No existing session required |
| `GET /api/devices` | `list_devices(request)` | Return all non-revoked device tokens for the authenticated user (id, device_name, created_datetime, last_seen_datetime, last_sync_version — never the token itself) |
| `DELETE /api/devices/{device_id}` | `revoke_device(device_id, request)` | Revoke a device token (sets `revoked = 1`). Immediately rejects future requests using that token. Verifies device belongs to authenticated user |
| `PATCH /api/devices/{device_id}` | `rename_device(device_id, body, request)` | Update the `device_name` for a registered device token. Rejects rename on revoked devices. Verifies device belongs to authenticated user |

**Pydantic models:**

| Class | Description |
|-------|-------------|
| `DeviceTokenRequest` | Create device token request — `username` (str), `password` (str), `device_name` (Optional[str], default "Unknown Device") |
| `DeviceRenameRequest` | Rename device request — `device_name` (str) |

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


#### shared-tab-sync.js

Cross-tab data sharing with leader election. Uses BroadcastChannel to share chit data between open tabs so only one tab (the "leader") fetches from the API. Leader election uses the Web Locks API — when the leader tab closes, the lock is released and another tab automatically acquires it. Loads after `shared-auth.js`, before `shared-utils.js`.

| Function | Description |
|----------|-------------|
| `cwocTabSyncInvalidate()` | Notify all tabs that data has changed. Leader re-fetches and broadcasts; follower tells the leader to re-fetch |
| `cwocTabSyncIsLeader()` | Returns true if this tab is the leader (responsible for API fetches) |
| `cwocTabSyncBroadcastChits(chitsData)` | Called by `fetchChits()` after completion — broadcasts fresh data to follower tabs (leader only) |

Internal state on `window._cwocTabSync`: `{ isLeader, channel, tabId, lastBroadcastTs, leaderHeartbeatTimer, followerTimeoutTimer, initialized }`.


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
| `cwocToast(message, type, duration)` | Show a brief auto-dismissing notification toast at top-center; type: 'success'/'error'/'info'; duration in ms (default 3000, error 5000) |
| `cwocUndoToast(message, opts)` | Show a bottom-center undo toast with countdown bar and Undo button; opts: `duration` (ms, default 5000), `onExpire` (callback), `onUndo` (callback), `id` (element ID for coexistence) |
| `cwocConfirm(message, opts)` | Show a parchment-styled confirm modal; returns a Promise resolving to boolean |
| `cwocPromptModal(title, placeholder, onConfirm, opts)` | Show a parchment-styled input modal (replaces browser `prompt()`); calls `onConfirm(value)` when user submits |
| `cwocUnsavedModal(opts)` | Show a three-button unsaved-changes modal (Save/Discard/Cancel); returns Promise resolving to `'save'`, `'discard'`, or `'cancel'`; opts: `message`, `saveLabel`, `discardLabel`, `cancelLabel` |
| `cwocChitPickerModal(options)` | Shared chit picker modal (table with search, status/priority filters, multi-select checkboxes). Options: `title`, `confirmLabel`, `onConfirm(selectedChits)`, `filterChits(chit)→bool`, `disabledIds`, `preSelectedIds`, `beforeSelect(id)→Promise<bool>`, `onItemDblClick(chit)` |
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
| `cwocMatchesSearch(chit, searchText)` | Check if a chit matches a plain-text search term across title, note, tags (excluding system tags), status, people, location, priority, severity, checklist |
| `cwocExtractSearchTerms(query)` | Extract positive (non-negated) search terms from a boolean query string for highlighting; strips operators (&&, \|\|, !, ()), #tag prefixes, and field:: prefixes (extracts just the value portion from field::value syntax) |
| `cwocHighlightTerms(text, terms)` | HTML-escape text and wrap matching terms in `<mark>` tags for search result highlighting |
| `_escHtml(str)` | Escape HTML special characters (`&`, `<`, `>`, `"`, `'`) for safe DOM insertion — single source of truth |
| `_cwocWeatherIcons` | WMO weather code → emoji icon map (single source of truth) |
| `_cwocGetWeatherIcon(code)` | Get weather emoji icon for a WMO weather code |
| `_cwocGetPrecipType(code)` | Get precipitation type string (`rain`, `snow`, `thunder`, `drizzle`, or `''`) from a WMO weather code |
| `_cwocFormatPrecip(precipMm, weatherCode, emptyVal)` | Format precipitation amount with type for display; returns emptyVal when no precipitation |
| `_convertDBDateToDisplayDate(dateString)` | Convert a UTC ISO date string to a local display date (YYYY-Mon-DD) |
| `cwocContactMatchesFilter(contact, query)` | Check if a contact matches a search query across all fields (name, email, phone, address, org, tags, etc.) |
| `_cwocGetHabitCycleEnd(freq)` | Calculate the end-of-cycle datetime for a habit based on its recurrence frequency (DAILY, WEEKLY, MONTHLY, YEARLY) |
| `cwocHighlightMatch(text, query)` | HTML-escape text and highlight matching query substrings with `<mark>` tags |
| `_detectBrowserTimezone()` | Detect browser timezone via `Intl.DateTimeFormat().resolvedOptions().timeZone`. Returns IANA timezone string or null if unavailable |
| `getCurrentTimezone()` | Resolve the user's current timezone. Precedence: settings `timezone_override` → browser detection via `_detectBrowserTimezone()` → `default_timezone` from settings → `'UTC'` fallback. Returns a Promise resolving to a valid IANA timezone string |
| `convertTimezoneForDisplay(isoString, fromTz, toTz, opts)` | Convert a naive datetime string from one IANA timezone to another for display using `Intl.DateTimeFormat` with `timeZone` option. Used by dashboard and calendar for anchored chit time display |
| `getChitDisplayTime(chit, field, currentTz)` | Get the display time for a chit, converting if anchored. Floating chits (timezone == null): returns time as-is. Anchored chits: converts from `chit.timezone` to `currentTz`. Handles invalid/unrecognized timezone gracefully (display unconverted with ⚠️ indicator). Returns `{ date, warning }` or null |

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

Inline checklist interactions for dashboard views — toggle, move, cross-chit move, drag-and-drop rendering, and inline markdown rendering.

| Function | Description |
|----------|-------------|
| `renderChecklistItemMarkdown(span, text)` | Render markdown inline for a checklist item's text span (bold, italic, links, code, strikethrough) using marked.js |
| `toggleChecklistItem(chitId, itemIndex, newChecked)` | Toggle a checklist item's checked state and save via API |
| `moveChecklistItem(chitId, fromIndex, toIndex)` | Move a checklist item within a chit's checklist and save |
| `moveChecklistItemCrossChit(fromChitId, fromIndex, toChitId, toIndex)` | Move a checklist item between chits (or within the same chit) and save both |
| `renderInlineChecklist(container, chit, onUpdate)` | Render an interactive checklist with check/uncheck, drag-reorder, and cross-chit drag support |
| `_updateChecklistProgressCount(container, chit)` | Update the "X/Y ✓" progress count element after a checkbox toggle |

#### shared-sort.js

Manual sort order persistence, drag-to-reorder for chit cards, edge-scroll during drag, and post-drag click suppression.

| Function | Description |
|----------|-------------|
| `_edgeScrollUpdate(container, clientY, opts)` | Start/update rAF-based auto-scrolling when pointer is near container edges during drag; falls back to viewport scroll on mobile |
| `_edgeScrollStop()` | Stop any active edge-scroll animation loop |
| `_markDragJustEnded()` | Set `window._dragJustEnded` flag to suppress spurious click/dblclick events after a drag operation; auto-clears after the browser's post-drag click fires |
| *(capture listeners)* | Document-level capture-phase click/dblclick listeners that swallow events on draggable elements while `_dragJustEnded` is true |
| `MANUAL_ORDER_KEY` | LocalStorage key for persisted manual sort orders |
| `SORT_PREFS_KEY` | LocalStorage key for persisted sort preferences (field + direction per tab) |
| `_loadSortPreferencesFromServer()` | Load sort preferences from backend API into localStorage on page init (server is source of truth) |
| `_loadSortOrdersFromServer()` | Load sort orders from backend API into localStorage on page init (server is source of truth) |
| `getSortPreference(tab)` | Get the saved sort preference (field + direction) for a view tab |
| `saveSortPreference(tab, field, dir)` | Save the sort preference for a view tab to localStorage and backend API |
| `resetAllSortOrders()` | Reset all sort orders and preferences (both local and server); returns a Promise |
| `getManualOrder(tab)` | Get the saved manual sort order (array of chit IDs) for a view tab |
| `saveManualOrder(tab, ids)` | Save the manual sort order for a view tab to localStorage and backend API |
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
| `_getAllIndicators(chit, settings, context)` | Return all visual indicator icons (alerts + people + indicators + custom data + recurrence + attachments) for a chit; uses `window._indicatorObjectIds` to split health_data into ❤️ (indicators zone) vs 📊 (custom zones); attachment 📎 is last/lowest priority |
| `_shouldShow(mode, context)` | Return true if a display mode ("always"/"never"/"space") permits showing in a given context |
| `_chitAlertTypesPresent(chit)` | Return an object mapping each alert type to true/false for presence on a chit |
| `_computePrerequisiteFlags(allChits)` | Compute `_hasIncompletePrereqs` flag on each chit for the ⛓️ chain indicator |

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
| `_postSettingsWithRetry(body)` | POST to /api/settings with 401 retry — checks auth and retries once on 401 |
| `buildTagTree(flatTags)` | Build a nested tag tree from a flat array of tag objects |
| `flattenTagTree(tree, originalNames)` | Flatten a tag tree back to a flat list of leaf tag objects |
| `matchesTagFilter(chitTags, filterTag)` | Check if a chit's tags match a filter tag (including descendants) |
| `renderTagTree(container, tree, selectedTags, onToggle, opts)` | Render a tag tree as an expandable/collapsible HTML tree with checkboxes; opts.onSelectOnly enables Shift+Click to select only one tag |
| `trackRecentTag(tagPath)` | Track a tag as recently used (session-level, max 3) |
| `getRecentTags()` | Get the list of recently used tags (up to 3) |
| `createTagInline(name, opts)` | Create a tag inline — adds it to settings if it doesn't already exist (partial update, tags only) |
| `updateTagInline(oldName, tagData)` | Update an existing tag in settings (rename, recolor, favorite) — partial update |
| `deleteTagInline(tagName)` | Delete a tag and sub-tags from settings — partial update |
| `SYSTEM_TAGS` | Array of system tag names that should not appear in user-facing tag lists |
| `isSystemTag(tagName)` | Return true if a tag name is a system tag (flat or `CWOC_System/` prefix) |
| `resolveChitLinks(html, allChits)` | Replace `[[title]]` patterns in HTML with links to matching chits |

#### shared-tag-modal.js

Shared tag creation/editing modal with full functionality (create, rename, recolor, font color, swatches, favorite, delete, sharing). Self-contained injectable component usable from both the settings page and the chit editor.

| Symbol | Description |
|--------|-------------|
| `cwocTagModal.inject()` | Inject the modal HTML into the page (auto-called on DOMContentLoaded) |
| `cwocTagModal.open(tagName, opts)` | Open the modal for editing (tagName) or creating (null). Options: `onSave`, `onDelete`, `onClose`, `allTags`, `tagData`, `prefillName`, `skipPersist` |
| `cwocTagModal.close()` | Close the modal |
| `cwocTagModal.isOpen()` | Returns true if the modal is currently displayed |

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
| `_detectTimezoneFromCoords(lat, lon, country)` | Detect timezone from coordinates using a longitude-band heuristic combined with country/region data. Returns IANA timezone string or null on failure |

#### shared-sidebar-filter.js

Reusable sidebar filter panel component extracted from `main-sidebar.js`. Used by both the dashboard and maps page for tag and people filters.

| Function | Description |
|----------|-------------|
| `CwocSidebarFilter(config)` | Creates a filter panel with search input, hotkey numbers (1-9), favorites-first sorting, and colored badges. Config: `containerId`, `items` (array of `{name, favorite, color?}`), `selection` (mutated array), `onChange`, `searchPlaceholder`, `showColorBadge`. Shift+Click selects only that item. |
| `cwocLoadTagFilter(config)` | Shared tag filter loader — renders "Any Tag" / "Tagless" virtual options + CwocSidebarFilter into `#label-multi`. Stores selection in `window._sidebarTagSelection`. Config: `onChange` callback. |
| `cwocChitPassesTagFilter(chitTags)` | Returns true if a chit's tags pass the current tag filter (handles real tags, tagless, any, nothing selected). |
| `cwocClearTagFilter()` | Reset tag filter to default ("Any Tag" selected). |
| `_cwocUpdateTagVirtualOptions()` | Update visual state of "Any Tag" / "Tagless" buttons based on current selection. |
| `_cwocRenderTagList(container, tagObjects, onChange)` | Internal: render the CwocSidebarFilter tag list below virtual options. |

#### shared-sidebar.js

Shared sidebar component — builds and injects the sidebar DOM, then wires behavior via Page_Context callbacks. Auto-injection runs at parse time if `<body data-sidebar>` is present (mirrors the `shared-page.js` pattern). Each page calls `_cwocInitSidebar(context)` with page-specific callbacks. Contains sidebar toggle, filter section management, notification inbox, topbar toggle, and version footer.

Depends on: `shared.js` (`_isMobileOverlay`, `_showSidebarBackdrop`, `_hideSidebarBackdrop`), `shared-sidebar-filter.js` (`CwocSidebarFilter`, optional).

| Symbol | Description |
|--------|-------------|
| `_cwocSidebarContext` | Module-level state — stored Page_Context object |
| `_notifInboxItems` | Cached notification list for the inbox |
| `_cwocInjectSidebar()` | IIFE that builds and injects the complete sidebar HTML if `<body>` has `data-sidebar` attribute. Produces identical DOM structure, IDs, and classes as the original inline sidebar. Inserts as first child of `<body>`. Includes 🤖 Rules sidebar button in half-width row next to Calculator button using `sidebar-compact-btn` CSS class, navigating to `/frontend/html/rules-manager.html` with title "Rules Engine (F10)" |
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

#### shared-timepicker.js

iOS-style drum roller time picker. Mobile-friendly scroll-snap time picker that mimics native iOS drum roller UX. Supports 12-hour and 24-hour modes based on CWOC settings. No seconds — hours and minutes only. Opens as a bottom-sheet on mobile, centered modal on desktop.

| Symbol | Description |
|----------|-------------|
| `cwocTimePicker.open(inputEl, options)` | Open the drum roller picker for the given input element. Reads current value, lets user scroll to select, writes back "HH:MM" (24h) on confirm. Options: `{ minuteStep }` |

#### shared-hotkeys.js

Universal hotkey dispatch loaded by all pages. Contains the tab map and action key handlers. On the dashboard, tab keys call `filterChits()` directly; on secondary pages, they navigate to `/?tab=X` via `cwoc_jump_tab` localStorage. Change the key mappings here and they apply everywhere.

| Function | Description |
|----------|-------------|
| `_cwocHotkeyTabMap` | Object mapping lowercase keys to tab names (c→Calendar, h→Checklists, b→Notebook, etc.) |
| `_cwocIsDashboard()` | Returns true if the current page is the main dashboard |
| `_cwocSwitchTab(tabName)` | Switch to a tab — calls `filterChits()` on dashboard, navigates via `cwoc_jump_tab` on secondary pages |
| `_cwocHandleActionHotkey(keyLower, e)` | Handle action keys (K, S, W, L, R); returns true if handled |
| `_cwocDispatchHotkey(e)` | Main entry point — dispatches tab and action hotkeys; returns true if consumed |
| `_resolveHotkeyTab(keyLower)` | Resolve a hotkey to the correct tab, accounting for Notebook (n/h → Notebook when active) |

#### shared.js (coordinator)

Coordinator for shared code between dashboard and editor. Contains glue code for quick-edit, recurrence actions, notes layout, mobile UI, weather, audio, sync, and the global alarm system.

| Function | Description |
|----------|-------------|
| `showQuickEditModal(chit, onRefresh)` | Quick-edit modal — shift+click on any calendar chit; shows editable dropdowns, recurrence options, and RSVP accept/decline controls for shared chits (calls `PATCH /api/chits/{id}/rsvp`) |
| `_showSnoozeSubMenu(actionRow, snzBtn, chitId, closeModal, onRefresh)` | Show inline snooze presets in the quick-edit modal |
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
| `_showDeleteUndoToast(chitId, chitTitle, onExpire, onUndo, customMessage)` | Show a delete-undo toast — delegates to cwocUndoToast |
| `initAudioUnlock()` | Initialize the mobile audio unlock system (resume AudioContext on first gesture) |
| `cwocPlayAudio(audio, opts)` | Play an audio file reliably with retry on blocked playback |
| `_showAddToBundleModal(chit)` | Show the "Add to Bundle" modal for an email chit; allows user to choose between subject or sender matching, then select a bundle |
| `_loadBundlesForModal(selectEl)` | Load bundles into the bundle selection dropdown from cached settings or API |
| `_populateBundleSelect(selectEl, bundles)` | Populate the bundle select dropdown with bundle options, filtering out "Everything Else" |
| `_executeAddToBundle(chit, overlay)` | Execute the "Add to Bundle" action by creating a new rule and triggering reclassification |
| `initSyncWebSocket()` | Initialize WebSocket sync connection (with HTTP polling fallback) |
| `_startSyncPolling()` | Start HTTP polling fallback for sync |
| `_pollSync()` | Execute a single sync poll request |
| `_dispatchSyncMessage(msg)` | Dispatch a sync message to registered handlers |
| `syncSend(type, data)` | Send a sync message via WebSocket or HTTP POST fallback |
| `syncOn(type, callback)` | Register a handler for a sync message type |
| `_pageHasUnsavedChanges()` | Check if the current page has unsaved changes (works across all page types) |
| `_showAutoRefreshBanner()` | Show a banner warning that data was updated on another device |
| `_handleRemoteDataChange(type)` | Handle a remote data change — auto-reload or show warning if unsaved |
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
| `_openQuickAlertModal()` | Open the Quick Alert modal (! hotkey) — shows R/A/T/S type picker (Reminder, Alarm, Timer, Stopwatch) |
| `_closeQuickAlertModal()` | Close the Quick Alert modal |
| `_quickAlertShowEditor(type)` | Show the inline editor form for the selected alert type inside the quick alert modal |
| `_quickAlertSave(type, data, andView, autoStart)` | Save alert from quick alert editor — routes reminder to _quickReminderSave, others context-aware (editor vs dashboard vs standalone) |
| `_quickReminderSave(data, andView)` | Create a chit with point_in_time date and notification alert from the Quick Reminder form |
| `_quickAlertAddToChit(type)` | Deprecated — now handled by _quickAlertSave |
| `_quickAlertAddIndependent(type)` | Deprecated |
| `_quickAlertAddIndependentDashboard(type)` | Deprecated |
| `_quickAlertJumpToIndependent()` | Switch to Alarms tab in independent mode after creating an alert |
| `_showQuickAlertToast(type)` | Show a brief toast confirming alert/reminder creation (non-dashboard pages) |
| `_initSharedHotkeys()` | Register the global keydown listener for !, \`, ~ hotkeys on all pages |
| `_printNoteWithChoice(text, title)` | Show a modal with Raw/Rendered choice, then open a print tab with the note content |
| `_openPrintTab(text, title, mode)` | Print note content via a hidden iframe without leaving the page (raw or rendered) |
| `_printChit()` | Print the entire chit with all populated zones (dates, status, location, tags, people, notes, checklist, alerts, color, flags) via hidden iframe |
| `_escHtml(str)` | HTML-escape helper for print functions |
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

#### shared-smart-links.js

Generalized "smart link" detection for email chits — scans email text for recognizable patterns (tracking numbers, flights, hotels, rentals, events, restaurants, transit, orders) and returns actionable badge buttons. Supports user configuration (enable/disable detectors, custom detectors) via `initSmartLinkRegistry()`.

**Public API:**

| Function | Description |
|----------|-------------|
| `initSmartLinkRegistry(config)` | Initialize the detector registry with user preferences. Called once after settings are loaded. Accepts `{disabled, disabledCategories, maxResults, customDetectors}` |
| `detectSmartLinks(chit, options)` | Detect all smart links in an email chit. Returns array of `{category, name, code, url, icon, label}`. Respects disabled detectors/categories from config |
| `detectSmartLinkFirst(chit)` | Legacy wrapper — returns first match in old format `{carrier, number, url, logo}` or null |

**Module-level State:**

| Variable | Description |
|----------|-------------|
| `_smartLinkDetectors` | Array of built-in detector definitions (Package, Flight, Hotel, Rental, Event, Restaurant, Transit, Order) |
| `_smartLinkConfig` | Current configuration: `{disabled, disabledCategories, maxResults, customDetectors}` |

#### shared-habits.js

Shared habit rule fetching and rendering for the Habits view. Fetches habit-mode rules from the API and renders them alongside chit habits with a 🤖 badge.

| Function | Description |
|----------|-------------|
| `fetchHabitRules()` | Fetch habit rules from `GET /api/rules?habit=true`. Returns array of habit rules with habit_summary |
| `_renderHabitRuleCards(container, habitRules)` | Render habit rule cards with 🤖 badge, showing rule name, current period status (due/achieved/missed), streak, and success rate. Click navigates to rule editor |

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
| `_clearAllFilters()` | Reset sidebar filters to custom view defaults (if set) or system defaults |
| `_applySystemDefaults()` | Apply hardcoded system defaults to all sidebar filters |
| `_applyFilterStateToSidebar(state)` | Apply a saved filter state object to the sidebar UI (statuses, priorities, tags, people, text, display, sort, project) |
| `_applyCustomViewFilters(tab)` | Apply custom view filters for a tab on entry; falls back to legacy default_filters text |
| `_resetDefaultFilters()` | Reset to custom view defaults or legacy text defaults for the current tab |
| `_updateClearFiltersButton()` | Show/hide the defaults button based on whether custom or legacy defaults exist |
| `_getSelectedFilterValues(containerId, filterType)` | Get an array of checked filter values from a multi-select container |
| `_getSelectedStatuses()` | Get currently selected status filter values |
| `_getSelectedLabels()` | Get currently selected label/tag filter values (reads from _sidebarTagSelection directly to support virtual parent nodes) |
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
| `_updateTagVirtualOptions()` | Dashboard wrapper: delegates to shared `_cwocUpdateTagVirtualOptions` |
| `_onTagToggled()` | Handle toggling a real tag — disables virtual options when real tags are selected |
| `_selectOnlyTag(fullPath)` | Select ONLY the given tag, deselecting all others (Shift+Click handler) |
| `_loadLabelFilters()` | Load dashboard settings + call shared `cwocLoadTagFilter` to render the tag filter |

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
| `_rulesSetupHotkey()` | Register the global F10 keydown listener to navigate to the Rules Manager at `/frontend/html/rules-manager.html`. Follows the same pattern as F4 (Calculator). Called once at script load time |

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

#### main-views.js (coordinator)

| Function | Description |
|----------|-------------|
| `_isViewerRole(chit)` | Check if a chit is shared with viewer-only access (no inline edits allowed) |
| `_isSharedChit(chit)` | Check if a chit is shared (has an `effective_role` from the sharing system) |
| `_getUserRsvpStatus(chit)` | Returns the current user's `rsvp_status` from a chit's shares array |
| `_isDeclinedByCurrentUser(chit)` | Returns true if the current user has declined this shared chit |
| `_emptyState(message)` | Build a styled empty-state message with an optional Create Chit button |
| `_getTagColor(tagName)` | Get tag color from cached settings tags, fallback to pastel |
| `_getTagFontColor(tagName)` | Get tag font color from cached settings tags, fallback to dark brown |
| `_buildChitHeader(chit, titleHtml, settings, opts)` | Build a standard chit card header row with icons, indicators, title, meta, shared icon, RSVP indicators/buttons |
| `_buildNotePreview(chit, extraStyle)` | Build an expandable note preview element with "show more/less" toggle |
| `_hasNonDefaultLocation(chit)` | Check if a chit's location differs from the user's default saved location |
| `_buildMapThumbnail(chit)` | Build a small static OSM map thumbnail for chit cards (Tasks, Checklists, Notes) |
| `_renderMapTile(container, lat, lon)` | Render an OSM tile image with pin overlay into a container element |
| `_buildMapIcon(chit)` | Build a simple map pin icon for compact views (Calendar, Alarms, Projects) |
| `_renderChitMeta(chit, mode)` | Legacy compact meta builder — kept for backward compat |
| `displayChecklistView(chitsToDisplay)` | Render the Checklists tab — chits with interactive checklist items |
| `_restoreViewModeButtons()` | Restore view mode button highlights for Projects, Alarms, and Tasks tabs |
| `_updateUrlHash()` | Update the URL hash to reflect current tab + mode (e.g., `#calendar/day`) |
| `_parseUrlHash()` | Parse the URL hash and return `{ tab, mode }` or null |
| `filterChits(tab)` | Switch to a tab, update URL hash, update sidebar visibility, and re-render chits |
| `searchChits()` | Trigger a re-render of chits (called from sidebar search input) |
| `highlightMatch(text, query)` | HTML-escape text and wrap query matches in `<mark>` tags |

#### main-views-tasks.js

| Function | Description |
|----------|-------------|
| `displayTasksView(chitsToDisplay)` | Render the Tasks tab — chits with status dropdowns and note previews; dispatches to habits/assigned modes |
| `displayAssignedToMeView(chitsToDisplay)` | Render the "Assigned to Me" view — chits where `assigned_to` matches the current user |
| `_setTasksMode(mode)` | Set Tasks view mode (tasks, habits, or assigned), persist to localStorage, and re-render |
| `_tasksViewMode` | Current Tasks view mode string, loaded from localStorage |

#### main-views-habits.js

| Function | Description |
|----------|-------------|
| `displayHabitsView(chitsToDisplay)` | Render the Habits view — habit cards in 3 sections (On Deck, Out of Mind, Accomplished) |
| `_renderHabitCards(container, habitData, windowDays)` | Render habit cards with metric boxes, progress, streaks, and debounced save |
| `_isResetPeriodActive(chit)` | Check if a habit's reset period cooldown is currently active |
| `_getResetEndDate(chit)` | Calculate the date when a habit's reset period ends |
| `_habitUrgencyScore(h)` | Calculate urgency score for a habit (lower = more urgent) |
| `_getTodayISO()` | Get today's date as YYYY-MM-DD |
| `_persistHabitUpdate(chit)` | Debounced habit update — delays 1 second, resets on each click |
| `_optimisticHabitCardUpdate(card, chit, newSuccess, goal)` | Instant UI feedback for habit card changes with section animation |
| `_updateStatusBadge(card, status)` | Update or remove the status badge on a habit card |
| `_onHabitsWindowChange(newVal)` | Handle habits success window dropdown change |
| `_initHabitsWindowDropdown()` | Initialize the sidebar habits success window dropdown from settings |
| `_fetchAndRenderRuleHabits(container)` | Fetch habit rules via `fetchHabitRules()` and render them in the habits view |
| `_renderAggregateSuccessRate(container, ruleHabits)` | Render combined success rate bar including rule habits |
| `_onHabitsIncludeRulesChange(checked)` | Handle toggle for including rule habits in the overall success rate calculation |

#### main-views-notes.js

| Function | Description |
|----------|-------------|
| `displayNotesView(chitsToDisplay)` | Render the Notes tab — markdown notes in masonry column layout with inline editing |

#### main-views-notebook.js

| Function | Description |
|----------|-------------|
| `displayNotebookView(chitsToDisplay)` | Render the Notebook tab — combined Notes + Checklists in masonry column layout |

#### main-views-projects.js

| Function | Description |
|----------|-------------|
| `_setProjectsMode(mode)` | Set Projects view mode (list or kanban) and re-render |
| `_showProjectQuickMenu(e, project)` | Show context menu on Shift+click with "Create New Child Chit" and "Open in Editor" |
| `_projectQuickCreateChild(project)` | Create a new chit and add it as a child of the given project |
| `displayProjectsView(chitsToDisplay)` | Render the Projects tab — list view with draggable child chits |
| `_kanbanFetchAndPreserveScroll()` | Fetch chits and re-render, preserving scroll position |
| `_displayProjectsKanban(chitsToDisplay)` | Render the Projects Kanban view — status columns with drag-and-drop |
| `_renderKanbanBoard(chitList, projects, chitMap, _viSettings)` | Inner render for Kanban board with cross-project drag support |
| `_projectsViewMode` | Current Projects view mode string, loaded from localStorage |

#### main-views-alarms.js

| Function | Description |
|----------|-------------|
| `_setAlarmsMode(mode)` | Set Alarms view mode (list or independent) and re-render |
| `_fetchIndependentAlerts()` | Fetch independent alerts from the API and cache locally |
| `_createIndependentAlert(alertData)` | Create a new independent alert via API and refresh |
| `_updateIndependentAlert(id, alertData)` | Update an existing independent alert via API and refresh |
| `_deleteIndependentAlert(id)` | Delete an independent alert, clean up runtime state, and refresh |
| `displayAlarmsView(chitsToDisplay)` | Render the Alarms tab — list of chits with alerts |
| `_displayIndependentAlertsBoard()` | Render the independent alerts board with Alarms, Timers, Stopwatches columns |
| `_addIndependentAlert(type)` | Create a new independent alert with sensible defaults |
| `_buildIndependentCard(id, type, data)` | Build an independent alert card element |
| `_parseTimeInput(str)` | Parse time input formats into 24h "HH:MM" |
| `_buildSaAlarmCard(card, id, data)` | Build UI for an independent alarm card |
| `_saFmtTimer(s, tenths)` | Format seconds as HH:MM:SS display string |
| `_buildSaTimerCard(card, id, data)` | Build UI for an independent timer card |
| `_saSwFmt(ms)` | Format milliseconds as HH:MM:SS.cc stopwatch display |
| `_buildSaStopwatchCard(card, id, data)` | Build UI for an independent stopwatch card |
| `_renderSaLaps(container, laps)` | Render lap times list inside a stopwatch card |
| `_alarmsViewMode` | Current Alarms view mode string, loaded from localStorage |

#### main-views-indicators.js

| Function | Description |
|----------|-------------|
| `_indInitViewMode()` | Initialize `_indViewMode` from localStorage (calendar/log/charts) |
| `_indBuildModeToggleHtml(activeMode)` | Build HTML for the 3-value pill toggle (Calendar \| Log \| Charts) |
| `_indAttachModeToggleListener()` | Attach click listener to the mode pill toggle |
| `displayIndicatorsView()` | Render the Indicators tab — health trend charts with responsive SVG |
| `_indicatorsLoad()` | Fetch health data from API and render SVG trend charts |
| `_indSaveSelection()` | Persist selected indicator checkboxes to localStorage |
| `_indRestoreSelection()` | Restore indicator checkbox selection from localStorage |
| `_indPopulateGraphFilter()` | Fetch objects from graphs zone and populate sidebar filter checkboxes |
| `_indRestoreOneOffGraphs()` | Restore one-off graph entries from localStorage that aren't in the graphs zone |
| `_indShowAddGraphPicker()` | Show modal picker to add a one-off graph for any Custom Object not in the filter |
| `_indAddOneOffGraph(obj)` | Add a one-off graph checkbox, check it, save selection, and reload charts |
| `_indFmtDate(d)` | Format a Date as YYYY-MM-DD string |
| `_indicatorsSetRange(range)` | Set the indicator time range and reload |
| `_indicatorsHighlightBtn(range)` | Highlight the active time range button |
| `_indicatorsLoadCustomRange()` | Load indicators with custom date range |
| `_indToggleExpand(key)` | Expand/collapse a single indicator chart |
| `_enableIndicatorsDragReorder(container)` | Enable drag-to-reorder on indicator chart divs |
| `_restoreIndicatorsOrder(container)` | Restore saved indicator chart order from localStorage |
| `_classifyDayColor(dayReadings, objects)` | Classify a day's color for calendar mode — returns "green", "amber", or "none" |
| `_indicatorsRenderCalendar(data, objects)` | Render Calendar Mode — year-view grid with color-coded day cells |
| `_findObjectByLegacyKey(legacyKey, objects)` | Find a Custom Object by legacy key name using the legacy-to-name mapping |
| `_buildLogSummary(healthData, objects)` | Build readable summary string from health_data, resolving UUID keys to display names |
| `_indicatorsRenderLog(data, objects)` | Render Log Mode — reverse-chronological list of chits with health readings |
| `_escapeHtml(str)` | Escape HTML special characters for safe insertion |

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
| `_globalCheckNotifications()` | Check all chit notification alerts against their fire times; supports habit cycle-end targeting, only_if_undone suppression, and weather-based notifications |
| `_globalCheckWeatherNotification(chit, alert, alertIdx)` | Check a weather notification against the chit's weather_data; fires once per day if forecast condition is met |
| `_globalGetHabitCycleEnd(chit)` | Calculate the end-of-cycle datetime for a habit chit using its recurrence_rule.freq |
| `_getSnoozeMs()` | Get the snooze duration in milliseconds from settings |
| `_startGlobalAlertSystem()` | Initialize the global alert system — permissions, intervals, sync listeners |

#### main-search.js

| Function | Description |
|----------|-------------|
| `displaySearchView()` | Render the global search view with search bar, email toggle, dropdown filters (status, priority, tag picker), and results container |
| `_renderSearchResults(container, viSettings)` | Render search result cards — title matches first, snippets for non-title matches, applies email/status/priority/tag filters |
| `_getSearchSnippet(text, terms)` | Extract a contextual snippet (~160 chars) around the first matching term in text |
| `_getChitFieldValue(chit, fieldName)` | Extract a displayable string value for a chit field by name |
| `_saveSearch()` | Save the current sidebar search text to localStorage |
| `_loadSavedSearch(text)` | Load a saved search into the sidebar search input and trigger search |
| `_deleteSavedSearch(text)` | Delete a saved search from localStorage |
| `_renderSavedSearches()` | Render saved search chips in the sidebar |

#### main-email.js

Email tab view — renders the Email dashboard tab with inbox-style list view. Loaded by `index.html` before `main.js`.

| Symbol | Description |
|--------|-------------|
| `_emailSubFilter` | Email sub-filter state: `'inbox'` (default), `'bytag'`, `'drafts'`, `'trash'` |
| `_emailUnreadTop` | Whether to sort unread emails to the top (toggle in sidebar) |
| `_emailDashContactsCache` | Cached contacts array for sender image lookup |
| `_emailLoadDashContacts()` | Load contacts for sender image lookup (cached after first call) |
| `_emailGetContactImage(senderRaw)` | Look up a contact's image_url by matching sender email address |
| `displayEmailView(chitsToDisplay)` | Display email chits in the Email tab list view; filters by sub-filter, sorts by `email_date` descending (with optional unread-at-top); renders action bar with Check Mail, Compose, and sub-filter buttons. Called from `filterChits()` dispatch in `main-views.js` |
| `_buildEmailCard(chit, viSettings)` | Build a single email card element with contact image in checkbox area (checkbox on hover), sender, subject, preview, date, hover actions |
| `_setEmailSubFilter(filter)` | Set the email sub-filter (`'inbox'`, `'bytag'`, `'drafts'`, `'trash'`) and refresh the view |
| `_checkMail()` | Trigger a manual email sync via `POST /api/email/sync`; shows toast with count, refreshes chit list |
| `_composeEmail()` | Navigate to editor with `?new=email` param to create a draft email chit |
| `_getUnreadCount()` | Return count of unread inbox emails for the badge |
| `_updateEmailBadge()` | Update the unread count badge on the Email tab |
| `_emailEmptyState(container)` | Show empty state for the email tab with Compose and Check Mail buttons |
| `_escHtml(str)` | Simple HTML escape helper |
| `_emailGetFileIcon(mimeType)` | Get a file type emoji icon for attachment display in email cards |
| `_showToast(msg, type)` | Simple toast helper — delegates to shared `showToast` if available |
| `_emailShowErrorWithSettingsLink(errorMsg, hint)` | Show error toast with "Go to Settings" button for email configuration issues |
| `_showAccountErrorDetails(nickname, errorMsg)` | Show persistent error toast with Copy Error and Go to Settings buttons |
| `_toggleEmailReadStatus(chit, card)` | Toggle read/unread status via `PATCH /api/email/{id}/read` and update card visual state |
| `_toggleEmailUnreadTop()` | Toggle unread-at-top sorting and re-render email view |
| `_emailBulkToggleRead()` | Bulk toggle read/unread for all selected emails via PATCH |
| `_emailRepliedToCache` | Cached Set of message IDs that have been replied to (rebuilt each render) |
| `_emailBuildRepliedCache()` | Build the replied-to cache by scanning all chits for `email_in_reply_to` |
| `_emailHasReply(messageId)` | Check if a given message ID has been replied to |
| `_emailDetectTracking(chit)` | Detect tracking numbers (UPS, USPS, FedEx, UniUni) and flight numbers in email subject + body; returns `{ carrier, number, url, logo }` or null |
| `_emailQuickArchive(chit, card)` | Quick-archive a single email with undo countdown toast; hides card immediately, archives on expiry, restores on undo |
| `_emailQuickDelete(chit, card)` | Quick-delete (soft delete) a single email with undo countdown toast; hides card immediately, deletes on expiry, restores on undo |
| `_emailRestoreCard(card)` | Restore a hidden email card back to visible state (used by undo) |
| `_emailStripHtml(str)` | Strip HTML tags and decode entities from a string for clean plain-text display |
| `_emailStripMarkdown(str)` | Strip markdown formatting (links, bold, italic, code, headings) returning plain text |
| `_emailShiftSelect(currentCb)` | Shift+click range selection — checks/unchecks all checkboxes between last clicked and current |
| `_emailLastCheckedIndex` | Tracks the last clicked checkbox index for shift+click range selection |
| `_emailInjectNests(threads)` | Inject nested chits into email threads after grouping — filters chits with non-null `nest_thread_id`, injects into matching threads, sorts by due_date → start_datetime → position after top email, marks with `_isNest = true` flag |
| `_buildNestedChitCard(chit)` | Build card for nested chit in thread view — renders nest icon (fa-dove), chit title, content preview; click navigates to editor |
| `_nestGetContentPreview(chit)` | Get content preview for nested chit card — first line of note, checklist summary, or status |

#### main-email-bundles.js

Email bundle toolbar, tabs, filtering, creation modal, context menu, and drag-to-reorder. Loaded by `index.html` after `main-email.js`.

| Symbol | Description |
|--------|-------------|
| `_emailActiveBundle` | Currently active bundle name (persisted to localStorage) |
| `_emailBundlesData` | Cached bundles array from API |
| `_fetchBundles(callback)` | Fetch bundles from `GET /api/bundles` and cache; calls callback with bundle data |
| `_filterByBundle(chits, activeBundle)` | Filter email chits by active bundle tag; "Everything Else" returns chits with no bundle tag |
| `_getBundleUnreadCount(bundleName, emailChits)` | Compute unread count for a bundle (chits with bundle tag and email_read=false) |
| `_renderBundleToolbar(emailChits)` | Build the permanent two-row toolbar (Row 1: bulk actions, Row 2: bundle tabs) |
| `_renderBundleTabs(container, bundles, emailChits)` | Render bundle tabs with unread badges and "+" button |
| `_setActiveBundle(bundleName)` | Set active bundle, persist to localStorage, refresh view |
| `_persistActiveBundle()` | Save active bundle to localStorage key `cwoc_email_active_bundle` |
| `_updateBundleTabActiveStates()` | Update tab visual active states |
| `_bundleOnSubFilterChange(newFilter)` | Reset/dim bundle tabs when sub-filter changes away from inbox |
| `_emailBundleSelectAll(checked)` | Select/deselect all visible email checkboxes |
| `_bundleUpdateActionStates()` | Enable/disable bulk action buttons based on selection count |
| `_openBundleModal(editBundle)` | Open bundle creation/edit modal; pre-populates if editing |
| `_bundleModalEscHandler(e)` | ESC key handler for bundle modal (closes modal) |
| `_closeBundleModal()` | Close the bundle modal and remove ESC listener |
| `_bundleModalSubmit()` | Validate and submit bundle modal (create or update) |
| `_bundleModalCreate(name, description)` | POST to `/api/bundles`, then navigate to Rule Editor |
| `_bundleModalUpdate(name, description)` | PUT to `/api/bundles/{id}` to update name/description |
| `_showBundleModalHint(msg)` | Show validation hint message in the modal |
| `_showBundleContextMenu(bundle, x, y)` | Show context menu on bundle tab (Edit, Reorder, Delete) |
| `_closeBundleContextMenu()` | Close the bundle context menu |
| `_bundleContextMenuOutsideClick(e)` | Outside-click handler to close context menu |
| `_bundleContextMenuEscHandler(e)` | ESC handler to close context menu |
| `_attachBundleTabContextMenu(tab, bundle)` | Attach right-click and long-press handlers to a bundle tab |
| `_deleteBundleConfirm(bundle)` | Show delete confirmation via `cwocConfirm()`, then DELETE bundle |
| `_enableBundleReorder()` | Enable drag-and-drop reorder mode on bundle tabs |
| `_bundleReorderDragStart(e)` | Drag start handler for bundle reorder |
| `_bundleReorderDragEnd(e)` | Drag end handler for bundle reorder |
| `_bundleReorderDragOver(e)` | Drag over handler for bundle reorder (visual feedback) |
| `_bundleReorderDrop(e)` | Drop handler for bundle reorder (rearrange DOM) |
| `_persistBundleReorder(orderedIds)` | PUT to `/api/bundles/reorder` with new order |
| `_bundleReorderFinishOnClick(e)` | Click-outside handler to finish reorder mode |
| `_disableBundleReorder()` | Disable reorder mode and remove drag listeners |

#### main-omni.js

Omni View rendering, HST bar, section orchestration, email pagination, and filter lock. Loaded by `index.html` after `main-email-bundles.js`.

| Function | Description |
|----------|-------------|
| `displayOmniView(filteredChits)` | Main entry point — builds two-column layout with configurable sections |
| `_buildOmniSection(sectionConfig, widthClass)` | Builds a section wrapper element with header |
| `_populateOmniSections(filteredChits, visibleSections)` | Routes chits to section renderers |
| `_omniDeduplicateChits(filteredChits)` | Categorizes chits into sections with strict deduplication |
| `_renderOmniChrono(contentEl, chronoItems, viSettings)` | Chrono Anchored section renderer |
| `_buildTimeUntilBadge(startTime, now)` | Creates time-until badge element |
| `_formatTimeUntil(minutes)` | Formats minutes into readable badge string |
| `_updateOmniTimeUntilBadges(contentEl)` | Periodic badge updater |
| `_renderOmniOnDeck(contentEl, ondeckItems, viSettings)` | On Deck section renderer |
| `_calculateHabitStreak(chit)` | Calculates consecutive successful habit periods |
| `_renderOmniSoon(contentEl, soonItems, viSettings)` | Soon section renderer |
| `_buildDueDateBadge(dueDate, now)` | Creates due-date badge element |
| `_renderOmniHST(contentEl, chronoItems)` | HST bar renderer |
| `_placeOmniHSTWeather(iconsLayer)` | Fetches and places weather icons on HST bar |
| `_renderHSTWeatherIcons(iconsLayer, codes)` | Renders weather icons at hour positions |
| `_renderOmniWeather(contentEl)` | Weather bar renderer |
| `_populateOmniWeatherBar(bar)` | Populates weather bar with data |
| `_buildWeatherBarContent(bar, daily, locationLabel)` | Builds weather bar content |
| `_escOmniHtml(str)` | HTML escape helper |
| `_renderOmniPinnedNotes(contentEl, pinnedNotes, viSettings)` | Pinned Notes section renderer |
| `_renderOmniPinnedChecklists(contentEl, pinnedChecklists, viSettings)` | Pinned Checklists section renderer |
| `_renderOmniEmail(contentEl, allEmailChits)` | Email section renderer with pagination |
| `_getOmniEnabledBundles()` | Returns Omni-enabled bundles |
| `_applyOmniEntryFilters()` | Applies locked filter defaults on Omni View entry |
| `_applyLockedFiltersToSidebar(locked)` | Programmatically sets sidebar filter UI |
| `_showOmniLockedIndicator(show)` | Shows/hides locked-filters indicator |
| `_lockOmniFilters()` | Saves current filters as Omni View defaults |
| `_showOmniLockBtn()` | Shows the Lock Filters button in sidebar |
| `_hideOmniLockBtn()` | Hides the Lock Filters button |

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
| `_applyViewOrder(viewOrder)` | Reorder the tab bar DOM elements based on the user's saved view_order setting |
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
| `_onChecklistChange()` | Mark save button unsaved when checklist changes; evaluates auto-complete status |
| `_autoCompleteChecklistEnabled` | Per-chit flag for auto-complete checklist feature |
| `_initAutoCompleteChecklist(chit)` | Initialize the auto-complete checklist button from chit data |
| `_showAutoCompleteBtnIfChild()` | Show/hide the auto-complete button based on project membership |
| `_updateAutoCompleteBtn()` | Update the auto-complete button visual state (active/inactive) |
| `_evaluateAutoCompleteChecklist()` | Evaluate checklist state and auto-set status if auto-complete is enabled |
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
| `setPointInTimeNow()` | Set the Point in Time date and time fields to the current moment |
| `clearPointInTime()` | Clear the Point in Time date and time fields |
| `_initTimezonePicker()` | Initialize the timezone picker. Populates datalist with common abbreviation entries (active today) + all IANA timezones. Injects abbreviation labels into date rows. Wires up geocoding on Enter/blur |
| `_getTimezoneAbbreviation(ianaTimezone)` | Get the short timezone abbreviation for today's date in the given timezone using `Intl.DateTimeFormat` with `timeZoneName: 'short'` |
| `_getTimezoneLongName(ianaTimezone)` | Get the long timezone name using `Intl.DateTimeFormat` with `timeZoneName: 'long'` |
| `_buildTzTooltip(ianaTimezone)` | Build a multi-line title string with abbreviation, long name, and IANA identifier for hover tooltip |
| `_injectTzAbbrevLabels()` | Inject/update `.tz-abbrev-label` spans at the end of each visible date-mode-fields div (startEnd, due, pointInTime) |
| `_updateTzAbbrevLabels()` | Update all timezone abbreviation labels — floating (muted, user's TZ) or anchored (full opacity, chit's TZ). Tooltip shows all name forms |
| `_onTzAbbrevClick(e)` | Handle click on abbreviation label — open the timezone picker modal |
| `_openTzPickerModal()` | Open the timezone picker modal, pre-fill input if timezone is already set |
| `_closeTzPickerModal()` | Close the timezone picker modal without applying changes (cancel) |
| `_onTimezoneModalInputChange()` | Handle input change inside the modal — validate and auto-close on valid selection after 200ms |
| `_onTzModalSelect(tz)` | Apply a timezone selection from the modal and close it |
| `_onTzModalClear()` | Clear timezone (revert to floating) and close the modal |
| `_onTimezoneInputSubmit()` | Handle Enter on timezone input — attempt address geocoding if value doesn't match a known timezone |
| `_geocodeForTimezone(query)` | Geocode an address via `/api/geocode?q=...` then call `_detectTimezoneFromCoords` to auto-select timezone and close modal |
| `_showTimezoneSuggestion(detectedTz)` | Show the timezone suggestion prompt when location geocode detects a different timezone. Accept sets `chit.timezone` to detected value; dismiss hides prompt |

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

Tag tree rendering, search, selection, favorites, recents, and tag creation/editing in the editor via the shared tag modal.

| Symbol | Description |
|--------|-------------|
| `_loadTags()` | Load and normalize tags from user settings; returns array of `{name, color}` |
| `_renderTags(tags, selectedTags)` | Render the full tag zone — tree, favorites row, recents row, active tags panel, and count badge |
| `toggleAllTags(event, expand)` | Expand or collapse all tag tree nodes |
| `createTag(event)` | Open the shared tag modal for creating a new tag |
| `editTag(event, tagName)` | Open the shared tag modal for editing an existing tag |
| `clearTagSearch(event)` | Clear the tag search input and reset the filter |
| `_filterTagTree(query)` | Filter the tag tree as-you-type — hides non-matching items and empty groups |
| `navigateToSettings()` | Navigate to the settings page |

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
| `_showPeopleChipContextMenu(e, chipData, chipIdx)` | Show a context menu (shift-click/right-click) on a people chip with View Contact and Remove options |
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
| `_notesListContinue(textarea)` | Handle Enter key to auto-continue list items (bullets, numbers, checkboxes, blockquotes); returns true if handled |
| `_notesRenumberOrderedList(textarea, fromPos)` | Renumber consecutive ordered list items following the cursor position after a new item is inserted |
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
| `closeNotesModal(save)` | Close the notes modal; if save is true, copy modal text back to main textarea (from whichever mode is active) |
| `toggleModalNotesRender()` | Toggle between edit and rendered views inside the notes modal (Edit/Render mode) |
| `_notesModalMode` | Current notes modal mode: `'editrender'` or `'livepreview'` |
| `_switchNotesModalMode(mode)` | Switch the notes modal between Edit/Render and Live Preview modes; syncs content between panes |
| `_wireNotesModalLivePreview()` | Wire the live preview input listener for real-time markdown rendering (only once) |
| `_updateNotesModalLivePreview()` | Update the live preview output from the live preview input using `marked.parse()` |
| `_printNote(event)` | Print note from the editor — shows Raw/Rendered choice modal, opens print tab |

#### editor-send-content.js

Send notes/checklist content to another chit via a single-select chit picker modal.

| Symbol | Description |
|--------|-------------|
| `_sendContentModal` | Reference to the send-content modal DOM element |
| `_sendContentModalOpen` | Boolean flag indicating if the send-content modal is open |
| `_sendContentType` | Current content type being sent: `'notes'` or `'checklist'` |
| `_openSendContentModal(e, contentType)` | Open the single-select chit picker modal for sending notes or checklist content |
| `_closeSendContentModal()` | Close the send-content modal |
| `_sendContentRenderChits(chits)` | Render the chit list in the modal with radio-button single-select |
| `_sendContentHighlight(text, term)` | Highlight search term matches in chit titles |
| `_sendContentUpdateButtons()` | Enable/disable Copy and Move buttons based on selection state |
| `_sendContentApplyFilters()` | Apply search text and status filter to the chit list |
| `_sendContentMatchesSearch(chit, term)` | Check if a chit matches the search term (title, status, tags) |
| `_executeSendContent(mode)` | Execute the copy or move operation to the selected target chit |
| `_sendContentUndoState` | State object for the active undo bar (interval, element) |
| `_showSendContentUndoBar(mode, targetChit, savedTarget, undoData)` | Show an undo countdown bar in the zone header after send |
| `_undoSendContent(mode, targetChit, undoData)` | Undo a send operation by restoring both source and target chits |

#### editor-send-item.js

Send a single checklist item (+ children) to another chit via a quick popup or full search modal.

| Symbol | Description |
|--------|-------------|
| `_sendItemPopup` | Reference to the per-item send popup DOM element |
| `_sendItemPopupOpen` | Boolean flag indicating if the send-item popup is open |
| `_sendItemTarget` | Current target: `{ item, checklist }` |
| `_sendItemRecentChits` | Cached array of the 3 most recently edited chits |
| `_sendItemChitsCache` | Cached full chit list for popup/search (avoids redundant API calls) |
| `_sendItemChitsCacheTime` | Timestamp of last cache fill |
| `_SEND_ITEM_CACHE_TTL` | Cache TTL in ms (30 seconds) |
| `_openSendItemPopup(e, item, checklist)` | Open the quick send popup near a checklist item |
| `_closeSendItemPopup()` | Close the send-item popup |
| `_fetchRecentChitsForItem()` | Fetch all chits and populate the recent-3 list |
| `_renderSendItemPopup(allChits)` | Render the popup content with recent chits and search button |
| `_openSendItemSearchModal()` | Open the full search modal for single-item send |
| `_closeSendItemSearchModal()` | Close the send-item search modal |
| `_fetchChitsForItemSearch()` | Fetch and render chits in the search modal |
| `_sendItemSearchRenderChits(chits)` | Render chit rows in the search modal table |
| `_sendItemSearchUpdateButtons()` | Enable/disable Copy and Move buttons based on selection |
| `_sendItemSearchApplyFilters()` | Apply search and status filters to the chit list |
| `_executeSendItem(mode, targetChit)` | Execute copy or move of item subtree to target chit |
| `_sendItemSpawnNewChit(mode)` | Spawn a new chit editor pre-populated with the item + children (mode: 'copy' or 'move') |
| `_sendItemConfirmAndNavigate()` | Show save/discard/cancel modal before navigating to the new prefilled editor |
| `_flashChecklistAddArrow()` | Flash a ↓ arrow at the checklist input when an item is added |

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
| `renderNotificationsContainer()` | Render the notifications list with value, unit, timing dropdown (habit-aware: "Will Be Missed Within" for habit cycle notifications, before/after start/due otherwise), "disable if done" checkbox for non-habit-direction habits, and delete controls |
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
| `_appendWeatherControls(row, n, idx)` | Append weather condition controls (condition dropdown, threshold, forecast hint) to a notification row |
| `_weatherCodeToPrecipType(code)` | Map a WMO weather code to a precipitation type string (rain/snow/hail/drizzle/thunder) |
| `_checkWeatherNotification(n, idx, title)` | Check a weather notification against stored forecast data; fires once per page load if condition is met |
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

Health indicators zone (data-driven): dynamically renders health indicator input fields by querying the Custom Objects registry. Supports conditional_display rules, imperial/metric unit switching, range highlighting, default vs per-chit indicators, and an "Add Indicator" picker modal.

| Symbol | Description |
|--------|-------------|
| `window._healthData` | Global object holding current health indicator values (UUID-keyed) |
| `window._indicatorObjects` | Cached zone query result (all Custom Objects assigned to indicators_zone) |
| `window._perChitIndicators` | Array of UUIDs of per-chit indicators on current chit |
| `window._healthUnitSystem` | Current unit system ('imperial' or 'metric') |
| `_evaluateConditionalDisplay(rule, settings)` | Evaluate a conditional_display rule against user settings; returns boolean |
| `_getUnitLabel(obj, unitSystem)` | Get the appropriate unit label based on the user's unit system |
| `_getRangeHighlightClass(value, rangeMin, rangeMax)` | Determine the CSS class for range highlighting (high/low/none) |
| `_fetchIndicatorObjects()` | Fetch indicator objects from zone API, caches in window._indicatorObjects |
| `_renderIndicatorField(obj, value)` | Render a single indicator field (numeric, checkbox, or text based on value_type) |
| `_showAddIndicatorPicker()` | Open modal listing non-default indicators available to add to current chit |
| `_addPerChitIndicator(obj)` | Add a per-chit indicator: render field, update state, mark dirty |
| `_getDefaultIndicators(objects)` | Filter objects to those with config.is_default === true |
| `_getNonDefaultIndicators(objects)` | Filter objects to those without config.is_default === true |
| `_identifyPerChitIndicators(healthData, defaultObjects, allObjects)` | Identify per-chit indicator UUIDs from health_data not in the default set |
| `_loadHealthData(chit)` | Orchestrate: parse health_data, fetch objects, evaluate conditional display, render default + per-chit fields, add "Add Indicator" button |
| `_gatherHealthData()` | Collect all non-null health data values into a UUID-keyed object for saving (or null if empty) |

#### editor-custom-zones.js

Dynamic custom zone rendering in the chit editor. On chit load, discovers user's custom zones via GET /api/custom-zones, fetches assigned objects for each zone, evaluates conditional_display rules, and renders collapsible Zone_Panels in the .main-zones-grid. Reuses pure functions from editor-health.js. Loaded after editor-health.js, before editor-save.js.

| Symbol | Description |
|--------|-------------|
| `window._customZoneData` | Global object holding current custom zone field values (UUID-keyed) |
| `window._customZonePanels` | Array tracking rendered zone panel element IDs |
| `_fetchCustomZones()` | Fetch all custom zones for the current user from GET /api/custom-zones |
| `_fetchZoneObjects(zoneId)` | Fetch objects assigned to a specific zone from GET /api/custom-objects/zone/{zone_id} |
| `_renderCustomZonePanel(zone, objects, settings, healthData)` | Render a collapsible Zone_Panel for a custom zone with 3-column field grid |
| `_renderCustomZoneField(obj, value, unitSystem)` | Render a single custom zone field (numeric, checkbox, or text based on value_type) with range highlighting and unit labels |
| `_loadCustomZones(chit)` | Entry point called during editor init — orchestrates zone discovery, object fetching, conditional display evaluation, and panel rendering |
| `_gatherCustomZoneData()` | Collect UUID-keyed values from all custom zone fields for the save flow |

#### editor-email.js

Email zone: populate, collect, reply, forward, send. Handles the Email zone in the chit editor: populating fields from chit data, collecting field values for save, toggling read-only state based on `email_status`, and creating reply/forward drafts via the API. Depends on: `shared-utils.js` (`cwocToast`, `generateUniqueId`), `shared-editor.js` (`cwocToggleZone`), `editor-save.js` (`setSaveButtonUnsaved`). Loaded before: `editor-save.js`, `editor-init.js`.

| Symbol | Description |
|--------|-------------|
| `_emailCurrentChit` | Module-level state — stores the currently loaded chit for reply/forward operations |
| `initEmailZone(chit)` | Populate email zone fields from chit data (From, To, Cc, Bcc, Body) and configure button visibility based on `email_status` (draft: show Send; received: show Reply/Forward; sent: hide all; no status: show Send). Wires change listeners for dirty tracking |
| `getEmailData()` | Collect email field values for save; returns an object with email fields (To/Cc/Bcc as arrays, body text, subject from title, preserved metadata), or `null` if the email zone has no content |
| `hasEmailData(chit)` | Check if a chit has email data (used by `applyZoneStates` for auto-expand); returns `true` if `email_message_id`, `email_status`, or `email_from` is set |
| `_emailReply()` | Create a reply draft chit via `POST /api/chits` and navigate to the editor; sets `email_to` to original sender, `email_in_reply_to` to original Message-ID, subject prefixed with "Re: " (no doubling), body quoted below separator |
| `_emailForward()` | Create a forward draft chit via `POST /api/chits` and navigate to the editor; empty `email_to`, subject prefixed with "Fwd: " (no doubling), body quoted below separator |
| `_emailSend()` | Send the current draft email with undo-send countdown (configurable delay); validates To field; saves chit first, then shows countdown bar — actual send happens when timer expires; clicking Undo cancels the send |
| `_emailSendLater()` | Open Flatpickr datetime picker to schedule email for future sending; saves chit, then calls `POST /api/email/schedule/{id}` with chosen datetime |
| `_emailCancelScheduled()` | Cancel a scheduled send by clearing `email_send_at` via `POST /api/email/schedule/{id}` with `{send_at: null}` |
| `_emailLoadExternalContent()` | Restore blocked external images in email HTML iframes by swapping `data-original-src` back to `src` |
| `_emailUndoSendCountdown(chitId, archiveOriginal)` | Show undo-send countdown bar; if timer expires, calls `_emailDoActualSend`; if Undo clicked, cancels |
| `_emailDoActualSend(chitId, archiveOriginal)` | Actually send the email via `POST /api/email/send/{id}` after undo countdown expires; updates UI to sent state; optionally archives the replied-to email |
| `_setEmailZoneReadOnly(readOnly)` | Toggle field editability for the email zone (To, Cc, Bcc, Body) — sets `disabled` and `readOnly` properties; hides render toggle when read-only |
| `_fetchEmailThread(chitId)` | Fetch the email thread for a chit via `GET /api/email/thread/{chit_id}` and render it below the body |
| `_renderEmailThread(thread, currentId)` | Render the email thread section with sender, date, preview for each message; current email highlighted; renders nested chits (entries with `is_nest: true`) using `_buildNestedChitThreadItem()` |
| `_buildNestedChitThreadItem(entry)` | Build nested chit item for editor thread view — renders nest icon, title, and preview for chits with `is_nest: true`; click navigates to that chit's editor page |
| `toggleEmailViewMode(event)` | Toggle email body between edit (textarea) and rendered (markdown) views in the small zone |
| `_setEmailRenderToggleLabel(isRendered)` | Update the email render toggle button label/icon |
| `_switchEmailExpandMode(mode)` | Switch email expand modal between 'editrender' and 'livepreview' modes |
| `_toggleEmailExpandRender()` | Toggle email expand modal body between edit and rendered views (Edit/Render mode only) |
| `_setEmailExpandRenderLabel(isRendered)` | Update the email expand render toggle button label |
| `_wireEmailBodyPreview()` | (Legacy) Wire live markdown preview on the email body textarea; no longer called for small zone |
| `_wireExpandBodyPreview()` | Wire live markdown preview on the expand modal's email body textarea; creates preview div dynamically |
| `_setupHtmlEmailView(htmlContent, bodyEl)` | Set up HTML email view with toggle button and sandboxed iframe using DOMPurify sanitization |
| `_switchEmailView(mode)` | Switch between 'html' and 'text' views for email body rendering |
| `_resizeEmailIframe(iframe)` | Auto-resize an iframe to fit its content height |
| `_activateEmailZone()` | Activate email mode on a non-email chit — moves zone to top-left, expands it, sets draft status, focuses To field, wires autocomplete |
| `_deactivateEmailZone()` | Deactivate email mode — confirms if content exists, clears fields, restores original save buttons |
| `_updateEmailButtons(status)` | Update email zone button visibility based on status (draft/received/sent/none) |
| `_showEmailSaveButtons(isEmail)` | Toggle between normal and email-specific save buttons; patches CwocSaveSystem |
| `_emailSaveAndSend()` | Validate To field then delegate to `_emailSend()` |
| `_openEmailExpandModal()` | Open fullscreen modal for email body with HTML/Text pill toggle, CC/BCC toggles, and action buttons |
| `_emailDownloadRaw()` | Download the raw .eml file for the current email chit from IMAP via `GET /api/email/{id}/raw` |
| `_switchExpandView(mode)` | Switch between HTML and Text views in the expand modal |
| `_closeEmailExpandModal(save)` | Close the email expand modal; if save=true, sync fields back to the zone |
| `_emailCopyChipsToExpand(sourceInputId, targetInputId)` | Copy recipient chips from the small editor to the expand modal |
| `_emailCopyChipsFromExpand(expandInputId, smallInputId)` | Copy recipient chips from the expand modal back to the small editor |
| `_renderEmailAttachmentBar(chit)` | Render email attachment icon chips at the bottom-right of the email body field in the small zone |
| `_renderExpandEmailAttachmentBar(chit)` | Render email attachment icon chips inside the expand modal body |
| `_getEmailAttachmentList(chit)` | Parse the attachments list from a chit; returns array or null |
| `_buildEmailAttachmentBar(attachments, chitId)` | Build the attachment bar DOM element with downloadable icon chips flowing right-to-left |
| `_formatAttSize(bytes)` | Format a byte size into a human-readable string (B/KB/MB) |
| `_toggleExpandCcBcc(field)` | Toggle Cc or Bcc field visibility in the expand modal |
| `_escapeHtmlAttr(str)` | Escape text for safe insertion into HTML attributes |
| `_emailLoadContacts()` | Fetch contacts for autocomplete (cached after first call) |
| `_emailSearchContacts(query)` | Search cached contacts by query string, return top 5 matches (favorites first) |
| `_wireEmailAutocomplete(inputId, dropdownId)` | Wire up autocomplete on an email input field |
| `_toggleEmailCcBcc(field)` | Toggle Cc or Bcc field visibility in the email zone |

#### editor-email-pgp.js

PGP encryption and decryption for emails. Provides client-side PGP encryption using OpenPGP.js for outgoing emails, and in-place decryption for received PGP-encrypted messages. Depends on: `openpgp.min.js` (CDN), `editor-email.js` (`_emailContactsCache`, `_emailGetFieldValue`, `_emailCurrentChit`), `shared-utils.js` (`cwocToast`).

| Symbol | Description |
|--------|-------------|
| `_pgpEnabled` | Module-level state — whether PGP encryption is currently enabled for this draft |
| `_pgpRecipientKeys` | Map of recipient email → PGP public key text |
| `_emailTogglePgp()` | Toggle PGP encryption on/off; validates all recipients have keys before enabling |
| `_updatePgpButtonState()` | Update the PGP button visual state (active green lock / inactive open lock) |
| `_pgpCheckAvailability()` | Check if PGP is available for current recipients; shows/hides PGP button accordingly |
| `_pgpEncryptBody(plaintext)` | Encrypt message body with recipients' PGP public keys; returns ASCII-armored ciphertext |
| `_pgpPreSendEncrypt()` | Pre-send hook — encrypts body if PGP enabled; returns true on success, false on failure |
| `_pgpExtractEmails(fieldValue)` | Extract plain email addresses from "Name <email>" formatted string |
| `_pgpFindKeyForEmail(emailAddr)` | Look up a PGP public key for an email address from the contacts cache |
| `_pgpInitForDraft()` | Initialize PGP UI hooks — wire recipient change detection via MutationObserver |
| `_pgpDecryptInPlace()` | Entry point for decrypting a received PGP message — shows password modal, then decrypts |
| `_pgpShowPasswordModal(onConfirm)` | Show parchment-themed password modal; calls onConfirm(password) on submit |
| `_pgpPerformDecrypt(password)` | Fetch private key via API, decrypt message with openpgp.js, display in-place (no save) |

#### editor-attachments.js

Attachments zone: upload, list, download, delete. Handles the Attachments zone in the chit editor: populating from chit data, file upload via drag-drop or file picker, listing attached files with download/delete actions, and upload progress indication. Depends on: `shared-utils.js` (`cwocToast`), `editor-save.js` (`setSaveButtonUnsaved`). Loaded before: `editor-save.js`, `editor-init.js`.

| Symbol | Description |
|--------|-------------|
| `_attachmentsData` | Module-level state — current attachments list (parsed from chit.attachments JSON) |
| `initAttachmentsZone(chit)` | Initialize the attachments zone from chit data; parse attachments JSON, render list, wire upload |
| `getAttachmentsData()` | Return current attachments data for save as JSON string, or null if empty |
| `hasAttachmentData(chit)` | Check if a chit has attachment data (used by `applyZoneStates` for auto-expand) |
| `_renderAttachmentsList()` | Render the list of attached files with icon, name, size, download link, and delete button |
| `_wireAttachmentUpload()` | Wire up the file upload area (button click + drag-drop events) |
| `_uploadFiles(files)` | Upload one or more files to the current chit via `POST /api/chits/{id}/attachments` |
| `_deleteAttachment(attachmentId, filename)` | Delete an attachment via `DELETE /api/chits/{id}/attachments/{id}` with confirmation |

#### editor-nest.js

Nest button logic: thread picker, nest/un-nest, button state management. Handles the nest-into-email-thread feature in the chit editor: button visibility based on chit type, thread picker modal, nest association management. Depends on: `shared-utils.js` (`cwocToast`), `editor-save.js` (`setSaveButtonUnsaved`). Loaded before: `editor-save.js`, `editor-init.js`.

| Symbol | Description |
|--------|-------------|
| `initNestButton(chit)` | Initialize nest button state based on `chit.nest_thread_id`; hides button for email chits |
| `getNestData()` | Return current `nest_thread_id` value for save payload |
| `_nestIsEmailChit(chit)` | Return true if chit has `email_message_id` or `email_status` (used to hide nest button) |
| `_nestButtonClick()` | Toggle: if active, remove nest; if inactive, open picker |
| `_nestOpenPicker()` | Fetch recent threads via `GET /api/email/threads/recent`, render picker modal |
| `_nestSelectThread(threadId, subject)` | Set `nest_thread_id`, update button to active state, mark dirty |
| `_nestRemove()` | Clear `nest_thread_id`, update button to inactive state, mark dirty |
| `_nestTruncateSubject(subject)` | Return first 15 chars of subject (or full if shorter) |
| `_nestFetchThreads(query)` | Fetch recent threads from API with optional query filter |
| `_nestRenderPicker(threads)` | Render thread picker modal from template |
| `_nestRenderList(listEl, threads)` | Render thread list items inside picker |
| `_nestClosePicker()` | Close and remove picker modal overlay |
| `_nestSetActive(subject)` | Set button to active state (blue, shows truncated subject label) |
| `_nestSetInactive()` | Set button to inactive state (muted brown, no label) |

#### editor-snooze.js

Snooze zone: hide a chit from views until a specified time. Provides the snooze modal with preset durations and a custom date/time picker. When snoozed, the chit behaves like archived but auto-unsnoozes at the specified time. Depends on: `shared.js` (`cwocToast`, `setSaveButtonUnsaved`). Loaded before: `editor-save.js`, `editor-init.js`.

| Symbol | Description |
|--------|-------------|
| `_currentSnoozedUntil` | Global: current snooze expiry ISO string or null |
| `_initSnooze(chit)` | Initialize snooze state from loaded chit data |
| `_updateSnoozeButton()` | Update snooze button appearance based on current state |
| `_formatSnoozeLabel(date)` | Format a date for display in snooze tooltip |
| `_openSnoozeModal()` | Open the snooze modal with presets and custom picker |
| `_closeSnoozeModal()` | Close the snooze modal overlay |
| `_doSnooze(minutes)` | Snooze for a given number of minutes (preset) |
| `_doSnoozeCustom()` | Snooze until a custom date/time from the modal inputs |
| `_doUnsnooze()` | Remove snooze (wake up now) |

#### editor-prerequisites.js

Prerequisites picker for the Task zone. Uses the shared `cwocChitPickerModal()` (same table/search/filter UI as "Add Child Chits" in Projects) with multi-select checkboxes. Shows selected prerequisites as full-color items with inline-editable status. Handles circular dependency detection via `beforeSelect`, auto-block/unblock logic, and manual override warnings. Depends on: `shared-utils.js` (`cwocToast`, `cwocConfirm`, `cwocChitPickerModal`), `editor-save.js` (`setSaveButtonUnsaved`). Loaded before: `editor-save.js`, `editor-init.js`.

| Symbol | Description |
|--------|-------------|
| `_prereqSelectedIds` | Global: array of currently selected prerequisite chit IDs |
| `_prereqChitCache` | Global: cached chit data for rendering the list |
| `initPrerequisites(chit)` | Load prerequisites from chit data into the UI |
| `getPrerequisitesData()` | Return current prerequisites array for save payload |
| `openPrereqPicker()` | Open the shared chit picker modal for selecting prerequisites |
| `_renderPrereqList()` | Render the selected prerequisites list (full-color items with inline status) |
| `_onPrereqStatusChange(selectEl)` | Handle inline status change — patches via PATCH /api/chits/{id}/fields |
| `_removePrereq(id)` | Remove a prerequisite from the selected list |
| `_checkPrereqAutoBlock()` | Auto-block/unblock based on prerequisite completion status |
| `checkPrereqStatusOverride(newStatus)` | Warn when manually overriding a prereq-blocked status |
| `_prereqEsc(str)` | HTML escape helper |
| `_prereqContrastColor(hex)` | Return black or white text color based on background luminance |

#### editor-save.js

Save system: build chit object, save, delete, pin, archive, QR.

| Symbol | Description |
|--------|-------------|
| `_executePendingProjectRemoval()` | Execute deferred project removal (remove child from parent project's child_chits) after save |
| `_executePendingProjectAddition()` | Execute deferred project addition (add child to project's child_chits, ensure child has status) after save |
| `createISODateTimeString(dateStr, timeStr, isAllDay, isEnd)` | Convert date/time strings to an ISO datetime string, handling all-day and end-of-day logic |
| `convertMonthFormat(dateStr)` | Convert `YYYY-Mon-DD` format to `YYYY-MM-DD` numeric format |
| `setMediaSource(elementId, src)` | Set the `src` attribute of a media element, validating the URL first |
| `isValidMediaSource(src)` | Validate a media source URL (non-empty, parseable, not "editor") |
| `buildChitObject()` | Collect all form values into a chit object; includes `getNestData()` result for nest_thread_id; returns null if validation fails |
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
| `cancelOrExit()` | Cancel or exit the editor; delegates to auto-save exit handler when auto-save is enabled, otherwise to CwocSaveSystem |
| `_handleAutoSaveExit()` | Handle exit when auto-save is enabled — immediate navigate if saved, wait if saving, trigger save if pending, show modal on failure |
| `_showAutoSaveExitFailModal()` | Show Discard/Retry modal when auto-save exit fails |
| `markEditorUnsaved()` | Mark the editor as having unsaved changes |
| `markEditorSaved()` | Mark the editor as saved |
| `togglePinned()` | Toggle the chit's pinned state and update the pin button UI |
| `toggleArchived()` | Toggle the chit's archived state and update the archive button UI |
| `_showQRCode(e)` | Show a QR code modal with data/link mode toggle for the current chit |
| `_optPrintChit()` | Options menu handler — close menu and invoke `_printChit()` |

#### editor-autosave.js

Auto-save system for the chit editor. Provides automatic persistence of chit edits after a 2-second debounce period. Controlled by per-platform (mobile/desktop) toggles in user settings. Uses the existing `saveChitAndStay()` function for persistence and `buildChitObject()` for validation gating. Depends on: `editor-save.js` (`saveChitAndStay`, `buildChitObject`, `_isSaving`), `shared-utils.js` (`getCachedSettings`). Loaded after: `editor-save.js`. Loaded before: `editor-init.js`.

| Symbol | Description |
|--------|-------------|
| `CwocAutoSave(settings)` | Constructor — initializes auto-save with user settings object; evaluates platform, reads setting, sets up resize listener |
| `CwocAutoSave.prototype._detectPlatform()` | Detect current platform based on viewport width (≤768px = mobile) |
| `CwocAutoSave.prototype._readSettingForPlatform()` | Read the appropriate auto-save setting (`autosave_mobile` or `autosave_desktop`) for the current platform |
| `CwocAutoSave.prototype._onResize()` | Handle viewport resize — re-evaluate platform setting when crossing 768px boundary |
| `CwocAutoSave.prototype.enable()` | Enable auto-save manually (overrides setting) |
| `CwocAutoSave.prototype.disable()` | Disable auto-save manually (overrides setting) |
| `CwocAutoSave.prototype.scheduleAutoSave()` | Schedule an auto-save after the 2000ms debounce period; resets timer on each call |
| `CwocAutoSave.prototype.cancelPending()` | Cancel any pending auto-save timer |
| `CwocAutoSave.prototype.isEnabled()` | Check if auto-save is currently enabled |
| `CwocAutoSave.prototype.getState()` | Get the current auto-save state ('saved'\|'pending'\|'saving'\|'error') |
| `CwocAutoSave.prototype._performSave()` | Perform the actual save with validation gate and in-flight guard |
| `CwocAutoSave.prototype.notifySaveComplete()` | Notify auto-save that a save completed (clears retry flag, updates state) |
| `CwocAutoSave.prototype.notifySaveError()` | Notify auto-save that a save failed externally |
| `CwocAutoSave.prototype._updateIndicator()` | Update the auto-save indicator element based on current state |
| `CwocAutoSave.prototype._showIndicator()` | Show the auto-save indicator element |
| `CwocAutoSave.prototype._hideIndicator()` | Hide the auto-save indicator element |
| `CwocAutoSave.prototype._hideSaveButtons()` | Hide manual save buttons when auto-save is enabled |
| `CwocAutoSave.prototype._showSaveButtons()` | Show manual save buttons when auto-save is disabled |
| `CwocAutoSave.prototype.saveImmediately()` | Perform an immediate save (used for exit-with-pending-changes); returns a promise |
| `CwocAutoSave.prototype.destroy()` | Clean up event listeners |

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

#### editor-mobile-zones.js

Mobile swipe-based zone navigation for the chit editor. On mobile (≤768px), transforms the editor into a single-zone-at-a-time view with swipe navigation between zones, a sticky zone header, and a zone list overlay. Depends on: `editor-init.js`, `shared-mobile.js`. Loaded after: `editor-init.js`.

| Symbol | Description |
|--------|-------------|
| `_mobileZoneOrder` | Ordered array of zone definitions for mobile navigation (Overview, Date, Task, Note, Checklist, Tags, People, Location, Alerts, Projects, Color, Health, Attachments, Email, Habits) |
| `_mobileCurrentZoneIdx` | Current zone index in mobile view |
| `_mobileZoneModeActive` | Whether mobile zone mode is currently active |
| `_mobileTabZoneMap` | Map of dashboard tab names to zone section IDs for determining start zone |
| `_getMobileVisibleZones()` | Get list of currently visible/available zones (filters out hidden ones) |
| `_isZoneEmpty(zoneInfo)` | Check if a zone has meaningful content (for greying out in zone list) |
| `_getMobileStartZoneIdx()` | Get the starting zone index based on the source tab from localStorage |
| `_mobileShowZone(idx)` | Show a specific zone by index, hiding all others |
| `_mobileNextZone()` | Navigate to next zone (wraps around) |
| `_mobilePrevZone()` | Navigate to previous zone (wraps around) |
| `_createMobileZoneHeader()` | Create the sticky mobile zone navigation header element |
| `_updateMobileZoneHeader(zoneInfo, idx, total)` | Update the sticky header content (icon, label, counter) |
| `_restoreMobileOverviewElements(container)` | Restore elements hidden by the overview panel when navigating away |
| `_renderMobileOverview(container)` | Render the mobile Overview panel — compact read-only summary of populated fields with tap-to-navigate |
| `_getOverviewDatesText()` | Get a compact text summary of the chit's dates/times for the overview |
| `_createMobileZoneList()` | Create the zone list overlay (slide-in panel from right) |
| `_openMobileZoneList()` | Open the zone list, refreshing items with empty state |
| `_closeMobileZoneList()` | Close the zone list overlay |
| `_openMobileActionsSidebar()` | Open the left actions sidebar with save buttons (when unsaved), calendar toggle, calculator, snooze, options, exit |
| `_closeMobileActionsSidebar()` | Close the left actions sidebar |
| `_updateMobileUnsavedIndicator(hasUnsaved)` | Show/hide the unsaved-changes dot on the mobile zone header ☰ button |
| `_initMobileZoneSwipe()` | Initialize swipe gestures (header: prev/next, body: actions/zone-list) |
| `_activateMobileZoneMode()` | Activate mobile zone mode (add body class, create UI, show starting zone) |
| `_deactivateMobileZoneMode()` | Deactivate mobile zone mode (restore all zones, remove body class) |
| `initMobileZoneNav()` | Initialize mobile zone navigation; sets up resize listener |

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
| `Checklist.toggleCheck(item, checked)` | Toggle an item's checked state and propagate to subtree; animates check-off with strikethrough + fade |
| `Checklist.updateCheckedStateForSubtree(item, checked)` | Recursively set checked state on all children |
| `Checklist.getParent(item)` | Find the parent item of a given item |
| `Checklist.getChildren(item)` | Find all direct children of a given item |
| `Checklist.deleteItem(item, element)` | Delete an item and its subtree with animation; shows inline undo countdown |
| `Checklist.getSubtree(item)` | Get an item and all its descendants recursively |
| `Checklist._updateCount()` | Update the count display (x / y) in the zone header and toggle Clear Checked button visibility |
| `Checklist.clearCheckedItems()` | Async — delete all checked items after cwocConfirm, show inline undo countdown |
| `Checklist.deleteUncheckedItems()` | Async — delete all unchecked items after cwocConfirm |
| `Checklist.cleanUpEmptyItems()` | Remove all items with empty or whitespace-only text |
| `Checklist._showUndoCountdown(removedItems, label)` | Show an inline undo countdown bar (8s) with Undo button; restores items if clicked |
| `Checklist._notifyChange()` | Call the external change callback with current checklist data |
| `Checklist._toggleSelectItem(itemId, e)` | Toggle multi-select state for an item |
| `Checklist._rangeSelectTo(itemId)` | Select a range of items from last selected to target |
| `Checklist._clearSelection()` | Clear all multi-select state |
| `Checklist._selectAll()` | Select all unchecked items |
| `Checklist._updateSelectVisuals()` | Update DOM classes for selected items |
| `Checklist._updateMultiSelectToolbar()` | Show/hide/update the multi-select batch action toolbar |
| `Checklist._multiSelectSendToChit()` | Open send-to-chit modal for batch-selected items |
| `_pasteClipboardAsChecklistItems(checklist)` | Async — read clipboard text and create each line as a checklist item (same parsing as note-to-checklist) |
| `_copyIncompleteToClipboard(checklist)` | Copy all unchecked items to clipboard as markdown checklist lines |
| `_prefetchSendItemChits()` | Pre-fetch chit list in background for instant send-item popup loading |

#### editor_projects.js

Projects zone: Kanban board for project master chits.

| Symbol | Description |
|--------|-------------|
| `projectState` | Local state object: `projectChit`, `childChits` map, `projectMasters` list |
| `saveCurrentChit()` | Mark the editor as having unsaved changes (delegates to `setSaveButtonUnsaved`) |
| `initializeProjectZone(projectChitId)` | Initialize the projects zone — fetch masters, load project data, render Kanban |
| `clearProjectsContent()` | Clear the projects zone and reset project state |
| `updateHeaderButtonsVisibility()` | Show/hide Add and Filter buttons based on project master status |
| `renderChildChitsByStatus()` | Render child chits grouped by status columns with drag-drop between sections and within-column reorder |
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
| `createNewChildChit(event)` | Create a brand new chit via API and immediately add it as a child of the current project |
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
| `cwocInitEditorHotkeys(zoneMap, saveFns)` | Initialize Alt+N hotkeys for zone focus/expand and F7 save hotkeys; zoneMap maps key chars to `[sectionId, contentId]` pairs; saveFns = `{ saveAndStay, saveAndExit }` |

#### settings.js

Settings page logic: tags, colors, clocks, locations, indicators, import/export, version/upgrade.

| Symbol | Description |
|--------|-------------|
| `_populateTimezoneDatalist()` | Populate timezone datalists with IANA timezone names from the browser using `Intl.supportedValuesOf('timeZone')` |
| `_clearTimezoneOverride()` | Clear the timezone override field and mark settings as unsaved |
| `_isValidTimezone(value)` | Validate a timezone value against the IANA timezone list. Returns true for valid IANA timezone or empty string |
| `_validateTimezoneSettings()` | Validate timezone settings before save. Returns true if valid, false if invalid (shows error toast) |
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
| `handleTagInput(event)` | Handle keypress in the new-tag input — Enter quick-creates tag, Shift+Enter opens tag modal for options |
| `handleInfoClick(event)` | Handle click on the add button — plain click quick-creates, Shift+click opens tag modal |
| `addTag()` | Quick-create a new tag from the input field with default color (no modal) |
| `_tagColorPalette` | Array of default tag color palette objects `{ bg, fg }` |
| `openTagModal(tag)` | Open the tag editor modal with color swatches, font color, preview, and favorite toggle |
| `saveTag()` | Save the current tag's name, colors, and favorite state from the modal |
| `deleteTag()` | Delete the current tag and close the modal |
| `_renderSettingsTagTree()` | Render the tag tree in the settings page using the shared `renderTagTree` |
| `_findFullPathForBadge(tree, badge, row)` | Helper: find the full path for a badge element in the tag tree |
| `closeTagModal()` | Close the tag editor modal |
| `toggleTagFavorite()` | Toggle the favorite star in the tag modal |
| `openDeleteModal(event, item)` | Open the delete confirmation modal for a tag or color |
| `_switchSettingsTab(tabId)` | Switch between settings tabs (general, views, collections, email, admin); persists to localStorage |
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
| `triggerGoogleTasksImport()` | Import Google Tasks (.json): open file picker, read JSON, POST to /api/import/google-tasks, display results |
| `triggerGoogleKeepImport()` | Import Google Keep (.json): open multi-file picker, read all JSON files, POST to /api/import/google-keep |
| `_sendKeepImport(notes, btn, originalText)` | Send parsed Keep notes array to the backend |
| `loadImportBatches()` | Load and display ICS import batches in the settings UI |
| `_escHtml(str)` | Escape HTML for safe insertion |
| `_deleteImportBatch(batch)` | Delete an import batch after confirmation (soft-delete all chits in batch) |
| `loadIcsImportOwnerPicker()` | Populate the ICS import owner picker with all users (admin only) |
| `importAllData()` | Import all data: open file picker, read JSON, validate type "all", show mode dialog |
| `loadVersionInfo()` | Fetch and display the current version and install date from `/api/version` |
| `refreshDiskUsage()` | Fetch and display disk usage (used/total/percent) from `/api/disk-usage` |
| `_formatBytes(bytes)` | Format byte count into human-readable string (KB, MB, GB, etc.) |
| `_closeUpdateModal()` | Close the update modal; show reopen button if upgrade is still running |
| `startUpgrade()` | Open the upgrade modal and prepare the UI for an upgrade |
| `runUpgrade()` | Execute the upgrade via SSE from `/api/update/run` |
| `appendLogLine(line, bold)` | Append a styled log line to the update log with auto-scroll |
| `onUpgradeComplete(data)` | Handle upgrade completion — show result, re-enable buttons, reload version |
| `copyUpdateLog()` | Copy the update log text to the clipboard |
| `loadLastLog()` | Load and display the last upgrade log from `/api/update/log` |
| `showReleaseNotes()` | Fetch daily release notes from `/api/release-notes` and display the current day in a paginated modal |
| `_formatReleaseDate(dateStr)` | Format YYYYMMDD string as human-readable date (e.g., "May 14, 2026") |
| `_renderCurrentReleaseNote()` | Render the currently selected day's release notes into the modal |
| `_updateReleaseNotesNav()` | Update prev/next button states and counter text |
| `releaseNotesPrev()` | Navigate to the next older day's release notes |
| `releaseNotesNext()` | Navigate to the next newer day's release notes |
| `closeReleaseNotesModal()` | Close the release notes modal |
| `restartCwoc()` | Admin-only: confirm and POST to `/api/restart` to restart the CWOC service |
| `_waitForServerAndReload()` | Poll `/health` after restart and reload the page once the server is back |
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
| `loadHAConfig()` | Fetch `GET /api/ha/config`, populate HA base URL, masked token, poll interval, and webhook URL display |
| `saveHAConfig()` | Collect HA config values, POST to `/api/ha/config`, show success/error feedback |
| `testHAConnection()` | POST to `/api/ha/config/test` with current URL and token, show connection result |
| `regenerateHAWebhook()` | POST to `/api/ha/config/regenerate-webhook` with confirmation, update displayed webhook URL |
| `toggleHATokenVisibility()` | Toggle HA access token input between `type="password"` and `type="text"` |
| `copyHAWebhookUrl()` | Copy the webhook URL to clipboard with visual feedback |
| `_openArrangeViewsModal()` | Open the Arrange Views modal, load current view order from settings |
| `_closeArrangeViewsModal()` | Close the Arrange Views modal |
| `_resetViewOrder()` | Reset view order to default (Calendar, Checklists, Tasks, Projects, Notes, Email, Indicators, Alarms) |
| `_renderArrangeViewsGrid()` | Render draggable tab buttons in the arrange views modal grid; auto-hides Notes/Checklists when Notebook is active |
| `_setupArrangeViewsDrag()` | Set up HTML5 drag-and-drop for the arrange views grid |
| `_setupArrangeViewsTouch(grid)` | Set up touch-based drag support for mobile devices |
| `_getViewItemAtPoint(grid, x, y, exclude)` | Find the view-tab-item element at a given point (excluding the dragged item) |
| `_collectViewOrder()` | Collect the current view order for saving; returns null if matches default |
| `_allAvailableViews` | All available views including hidden-by-default ones (Notebook) |
| `_resetSortOrders()` | Reset all sort orders and preferences via confirmation modal; calls DELETE /api/sort-orders and clears localStorage |

#### settings-badges.js

Badges (Smart Actions) settings section — manages enable/disable toggles for built-in detectors, custom detector CRUD, and max results configuration.

| Symbol | Description |
|--------|-------------|
| `_initBadgesSettings()` | Initialize the badges settings section: parse config, render categories, wire events |
| `_renderBadgeCategories()` | Render all built-in detector categories with toggle checkboxes |
| `_onBadgeCategoryToggle(e)` | Handle category-level toggle — enable/disable all detectors in a category |
| `_onBadgeDetectorToggle(e)` | Handle individual detector toggle — add/remove from disabled map |
| `_renderBadgeCustomList()` | Render the list of user-defined custom detectors with edit/delete buttons |
| `_openBadgeCustomModal(existing)` | Open the custom detector form modal (empty for new, populated for edit) |
| `_closeBadgeCustomModal()` | Close the custom detector form modal |
| `_saveBadgeCustomDetector()` | Validate and save a custom detector (new or edited) |
| `_gatherBadgesConfig()` | Serialize the current badges config to JSON string for settings save |

#### settings-custom-filters.js

Custom Filters & Sorting settings section — per-view custom filter/sort defaults. Each view gets a button that opens a modal with the full sidebar filter UI (status, priority, display toggles, text search, sort). Saved state auto-applies on view entry.

| Symbol | Description |
|--------|-------------|
| `_customFilterViews` | Array of view definitions in display order (Omni first, then tab order) |
| `_customViewFilters` | In-memory state of custom view filters (loaded from settings) |
| `_systemDisplayDefaults` | System defaults for display toggle checkboxes |
| `_renderCustomFilterButtons()` | Render the per-view button list in the settings page |
| `_loadCustomViewFilters(settings)` | Load custom view filters from settings object (with Omni backward compat) |
| `_gatherCustomViewFilters()` | Serialize custom view filters to JSON string for settings save |
| `_openCustomFilterModal(viewKey)` | Open the filter modal for a specific view |
| `_closeCustomFilterModal()` | Close the filter modal |
| `_buildCustomFilterHTML(viewKey)` | Build the filter UI HTML for the modal |
| `_populateCustomFilterModal(viewKey)` | Populate modal with saved state or system defaults |
| `_gatherCustomFilterModalState()` | Gather current modal state into a filter object |
| `_isSystemDefault(state)` | Check if a filter state equals system defaults |
| `_saveCustomFilterModal()` | Save modal state and close |
| `_resetCustomFilterModal()` | Reset modal to system defaults |

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
| `_initSignalToggle()` | Initialize Signal username field visibility and message button listeners |
| `onSignalToggle()` | Global — toggle Signal username input and message button visibility on checkbox change |
| `_updateSignalMessageBtn()` | Show/hide the Signal message button based on whether a username/phone is entered |
| `openSignalMessage()` | Global — open Signal deep link to message the contact (phone or username) |
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

#### attachments.js

All Attachments grid page: displays every attachment across all chits in a visual grid with multi-select (click, Shift+click range, Ctrl/Cmd+click toggle) and bulk delete.

| Symbol | Description |
|--------|-------------|
| `_allAttachments` | Module-level state — flat array of all attachment objects with chit_id and chit_title |
| `_selectedSet` | Module-level state — Set of selected indices |
| `_lastClickedIndex` | Module-level state — last clicked index for Shift+click range selection |
| `init()` | Wire bulk delete button and load attachments |
| `loadAttachments()` | Fetch all attachments via `GET /api/attachments` and render the grid |
| `renderGrid(wrap)` | Build the attachment card grid with thumbnails, filenames, chit links, and selection checkboxes |
| `handleSelect(idx, e)` | Handle card selection: single click, Shift+click range, Ctrl/Cmd+click toggle |
| `syncSelectionDOM()` | Sync selected class and checkbox state across all cards |
| `updateSelectionUI()` | Show/hide bulk actions bar and update selected count |
| `bulkDelete()` | Confirm and execute bulk delete via `DELETE /api/attachments/bulk` |
| `getFileIcon(mimeType)` | Return emoji icon for a MIME type |

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
| `unlockPrivatePgpKey()` | Prompt for password, fetch private PGP key via POST /api/auth/private-pgp-key, show unlocked textarea |
| `lockPrivatePgpKey()` | Hide private PGP key textarea, clear cached password |
| `savePrivatePgpKey()` | Save private PGP key via PUT /api/auth/private-pgp-key (requires cached password) |
| `removePrivatePgpKey()` | Confirm and remove private PGP key (saves empty value) |

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
| `_loadChitsFilterData()` | Loads tag filter via shared `cwocLoadTagFilter()` and people filter via CwocSidebarFilter into the shared sidebar's standard container IDs |
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

#### rules-manager.js

Rules Manager page logic — fetches and displays rules, handles toggle/reorder/delete, and manages pending confirmations. Loaded by `rules-manager.html`.

| Function | Description |
|----------|-------------|
| `_escHtml(str)` | Escape HTML special characters in a string |
| `_formatTimestamp(iso)` | Format an ISO datetime string as `YYYY-MM-DD HH:MM` |
| `_triggerLabel(type)` | Map trigger type to human-readable label (e.g., `chit_created` → `Chit Created`) |
| `loadRules()` | Fetch rules from `GET /api/rules` and render the rules table |
| `renderRulesTable()` | Render the rules table with columns: drag handle, enabled toggle, name (clickable link to editor), trigger type badge, priority, last run, run count, delete button. Attaches drag-and-drop for reorder |
| `toggleRule(ruleId)` | Toggle a rule's enabled state via `PATCH /api/rules/{id}/toggle` |
| `deleteRule(ruleId, ruleName)` | Delete a rule with `cwocConfirm()` confirmation via `DELETE /api/rules/{id}` |
| `_initDragReorder()` | Initialize HTML5 drag-and-drop on the rules table for reorder |
| `_saveReorder(ruleIds)` | Save new rule order via `PUT /api/rules/reorder` |
| `loadConfirmations()` | Fetch pending confirmations from `GET /api/rules/confirmations` |
| `renderConfirmations()` | Render the pending confirmations section with Accept/Dismiss buttons. Hidden when empty |
| `toggleConfirmations()` | Toggle the confirmations section body collapsed/expanded |
| `acceptConfirmation(confirmationId)` | Accept a confirmation via `POST /api/rules/confirmations/{id}/accept` |
| `dismissConfirmation(confirmationId)` | Dismiss a confirmation via `POST /api/rules/confirmations/{id}/dismiss` |

#### rule-editor.js

Rule Editor page logic — handles creating and editing rules with condition tree builder, action configuration, trigger selection, and save/cancel via `CwocSaveSystem`. Loaded by `rule-editor.html`.

| Symbol | Description |
|--------|-------------|
| `CHIT_FIELDS` | Array of field definitions for chit triggers (title, note, status, priority, severity, location, color, tags, people, archived, pinned, all_day, habit, dates, `_weather`) |
| `EMAIL_FIELDS` | Array of field definitions for email triggers (title, note, email_from, email_to, email_cc, email_bcc, email_account_id, email_subject, email_body_text, email_folder, email_read, status, priority, tags, people, location) |
| `CONTACT_FIELDS` | Array of field definitions for contact triggers (given_name, surname, organization, tags, emails, phones, addresses) |
| `HA_STATE_CHANGE_FIELDS` | Array of field definitions for HA state change triggers (ha_entity_id, old_state, new_state, attributes) |
| `HABIT_TRIGGER_FIELDS` | Array of field definitions for habit triggers (source_rule_name, source_chit_title, habit_event, streak, habit_goal, habit_success, offset_minutes, timestamp, plus chit fields) |
| `DATE_TYPE_FIELDS` | Array of date-type field names for which days_ago operators are shown |
| `OPERATOR_GROUPS` | Array of operator groups for optgroup rendering (Comparison, Text, Presence, Tags & People, Date Age, Weather — Current, Weather — Forecast) |
| `OPERATORS` | Flat array of all operators (built from OPERATOR_GROUPS) |
| `NO_VALUE_OPERATORS` | Array of operators that don't need a value input (is_empty, is_not_empty) |
| `WEATHER_FORECAST_OPERATORS` | Array of forecast window operators that use "threshold\|days" value format |
| `WEATHER_OPERATORS` | Array of all weather operators (current + forecast) |
| `ACTION_GROUPS` | Array of action groups for optgroup rendering (Tags & People, Status & Priority, Appearance & Location, Lifecycle, Create & Notify, Email, Home Assistant) |
| `CHIT_ACTION_TYPES` | Flat array of all action types (built from ACTION_GROUPS). Includes create_chit, call_ha_service, fire_ha_event with custom renderers |
| `WEATHER_FIELDS` | Array of weather condition field definitions (weather_code, weather_temperature_high, weather_temperature_low, weather_precipitation, weather_wind_speed) — only shown when trigger type is "scheduled" |
| `BOOLEAN_FIELDS` | Array of boolean field names that render as true/false dropdowns (archived, pinned, all_day, habit, email_read) |
| `EMAIL_ADDRESS_FIELDS` | Array of email address field names that render as contact autocomplete in email mode (email_from, email_to, email_cc, email_bcc) |
| `_cachedTagList` | Cached flat list of user tags (excluding system tags) for the tag picker, sorted favorites-first then alphabetical |
| `_cachedPeopleList` | Cached list of contact display names for smart person inputs |
| `_cachedLocationsList` | Cached list of saved location names for smart location inputs |
| `_loadTagList()` | Async function that fetches tags from `getCachedSettings()`, filters out system tags, sorts favorites-first, and caches in `_cachedTagList` |
| `_loadPeopleList()` | Async function that fetches contacts from `/api/contacts` and caches display names |
| `_loadLocationsList()` | Async function that fetches saved locations from settings and caches names |
| `_renderSearchableInput(currentValue, options, placeholder, onChange)` | Creates a text input with a filterable dropdown of existing values |
| `_renderSmartInput(leaf, onChange)` | Factory function that returns the appropriate DOM element for a condition leaf's value input based on field/operator mapping (email→autocomplete, priority→dropdown, location→combobox, color→swatches, weather→numeric+location, boolean→true/false, default→plain text) |
| `_renderPlainTextInput(currentValue, onChange)` | Creates a plain text input (fallback for unmapped fields) |
| `_renderDropdownInput(currentValue, options, placeholder, onChange)` | Reusable dropdown helper for priority/status/severity/boolean fields — pre-selects current value, shows placeholder if unset |
| `_renderEmailAccountDropdown(currentValue, onChange)` | Email account dropdown populated from `getCachedSettings()` → `email_accounts`. Shows nickname or email as label, stores account ID. Shows unrecognized indicator for saved values not matching current accounts |
| `_renderContactAutocomplete(options)` | Reusable contact autocomplete component — queries `/api/contacts?q=` on 2+ chars, shows up to 10 results. Supports `mode: 'email'` (shows name+email, stores email) and `mode: 'name'` (shows name, stores name). Caches most recent API response. Dismisses on blur/Escape/selection |
| `_renderLocationCombobox(currentValue, onChange)` | Location combobox with saved locations dropdown + text input. Loads from `getCachedSettings()` → `saved_locations`. Falls back to text-only if empty |
| `_renderColorSwatches(currentValue, onChange)` | Color swatches widget with default palette + custom colors from settings. Highlights selected swatch, includes hex text input |
| `_renderWeatherInput(leaf, onChange)` | Weather condition input — numeric threshold input + location combobox. Stores weather_location as additional property on the leaf node |
| `_renderCreateChitAction(action, container)` | Create Chit action panel with smart input controls for title, note, status, priority, tags, start/due datetime, location, color, and people. All fields optional, text fields support `{{placeholder}}` template syntax |
| `_getFieldsForTrigger()` | Return the appropriate field definitions array based on the selected trigger type |
| `renderConditionTree()` | Render the condition tree into the `#condition-tree` container |
| `_renderNode(node, isRoot)` | Render a single condition tree node (dispatches to group or leaf renderer) |
| `_renderGroup(group, isRoot)` | Render a group node with AND/OR toggle, children, and add condition/group buttons |
| `_renderLeaf(leaf)` | Render a leaf condition with field dropdown (with weather fields for scheduled triggers), grouped operator dropdown, smart value inputs (via `_renderSmartInput` factory), weather condition multi-inputs, and remove button |
| `_removeNode(nodeId)` | Remove a node from the condition tree by ID |
| `_serializeTree(node)` | Serialize the condition tree for API submission (strips internal `_id` fields) |
| `_deserializeTree(node)` | Deserialize a condition tree from API data (adds internal `_id` fields) |
| `_countLeaves(node)` | Count the number of leaf conditions in a tree |
| `addActionRow(actionData)` | Add an action row to the actions list |
| `removeAction(index)` | Remove an action row by index |
| `renderActions()` | Render all action rows with type dropdown and dynamic parameter inputs |
| `_onTriggerChange()` | Handle trigger type dropdown change — show/hide schedule config, re-render condition tree with new field options |
| `_onScheduleFrequencyChange()` | Handle schedule frequency change — show/hide interval input for hourly frequency |
| `_validate()` | Validate the rule form — require name, trigger type, at least one condition, at least one action with type selected |
| `saveRule(andExit)` | Save the rule via `POST /api/rules` (new) or `PUT /api/rules/{id}` (existing). Updates URL for new rules |
| `cancelOrExit()` | Cancel or exit via `CwocSaveSystem` |
| `_loadRule(ruleId)` | Load an existing rule from `GET /api/rules/{id}` and populate all form fields |
| `_renderHAServiceAction(actionRow, params)` | Render call_ha_service action fields: domain, service, entity_id inputs with "Fetch Entities"/"Fetch Services" buttons, KV editor for service_data, JSON preview panel |
| `_renderHAEventAction(actionRow, params)` | Render fire_ha_event action fields: event_type input with autocomplete suggestions (cwoc_chit_created, cwoc_chit_updated, cwoc_email_received, cwoc_status_changed, cwoc_tag_added), KV editor for event_data, JSON preview panel |
| `_renderHAStateChangeTrigger()` | Render ha_state_change trigger config: entity_id input with "Fetch Entities" autocomplete, polling interval hint |
| `_renderHAWebhookTrigger()` | Render ha_webhook trigger config: hint text explaining webhook-driven rules |
| `_fetchHAEntities()` | Fetch entities from `GET /api/ha/entities`, populate searchable entity picker modal |
| `_fetchHAServices()` | Fetch services from `GET /api/ha/services`, populate searchable service picker modal |
| `_renderKVEditor(container, data, onChange)` | Render a key-value editor for service_data/event_data with add/remove rows |
| `_renderJSONPreview(container, data)` | Render a read-only JSON preview panel below action inputs |
| `_showEntityPickerModal(entities, onSelect)` | Show searchable entity picker modal with filtering |
| `_showServicePickerModal(services, onSelect)` | Show searchable service picker modal with domain grouping |
| `_describeCron(expr)` | Client-side human-readable cron description for the preview line |
| `_updateCronPreview()` | Update the cron preview text from current input field values |
| `_assembleCronExpression()` | Assemble a 5-field cron expression string from the five input fields |
| `_validateCronExpression(expr)` | Basic client-side cron validation (5 space-separated fields, valid characters) |
| `_setCronFields(expr)` | Populate the five cron input fields from a cron expression string |
| `_getScheduleMode()` | Get the current schedule mode (simple or cron) from the toggle |
| `_setScheduleMode(mode)` | Set the schedule mode and toggle UI visibility between Simple and Cron sections |
| `_initCronBuilder()` | Initialize cron builder event listeners (preset buttons, input change handlers, mode toggle) |

#### custom-objects-editor.js

Custom Objects Editor page: browse, create, edit, toggle, soft-delete, restore, and manage zone assignments for Custom Objects.

| Symbol | Description |
|--------|-------------|
| `_coAllObjects` | Array — full list of custom objects from API |
| `_coFilteredObjects` | Array — objects after type/search filter applied |
| `_coEditingId` | String or null — ID of object being edited (null = create mode) |
| `_coDeleteTargetId` | String or null — ID of object pending deletion |
| `_coZoneModalObjectId` | String or null — ID of object currently in zone modal |
| `_coCloneTemplates()` | Clone modal templates from `<template>` elements and append to body |
| `_coFetchAll()` | Fetch all custom objects from `GET /api/custom-objects` and re-render |
| `_coPopulateTypeFilter()` | Populate the type filter dropdown from unique types in data |
| `_coApplyFilters()` | Apply type and search filters to the object list |
| `_coRenderList()` | Render the filtered object list grouped by type |
| `_coCreateRow(obj)` | Create a single object row element with name, zone badges, and action buttons |
| `_coInitEditModal()` | Wire up edit modal cancel/save buttons |
| `_coOpenEditModal(obj)` | Open the create/edit modal, populate fields from object or clear for create |
| `_coCloseEditModal()` | Close the edit modal |
| `_coToggleNumericFields()` | Show/hide units and range fields based on value_type selection |
| `_coPopulateDatalist(datalistId, field)` | Populate a datalist with unique values from all objects for autocomplete |
| `_coSaveObject()` | Save (create or update) a custom object via POST/PUT |
| `_coToggleActive(objectId, newActive)` | Toggle active status via PUT |
| `_coInitDeleteModal()` | Wire up delete modal cancel/confirm buttons |
| `_coOpenDeleteModal(obj)` | Open the delete confirmation modal |
| `_coCloseDeleteModal()` | Close the delete modal |
| `_coConfirmDelete()` | Confirm soft-delete via DELETE endpoint |
| `_coRestoreObject(objectId)` | Restore a soft-deleted standard object via POST restore |
| `_coQuickLog()` | Create a Quick Log chit (point_in_time = now, status = "Complete") and navigate to editor |
| `_coOpenZoneModal(obj)` | Open the zone management modal for an object — renders all known zones with toggles |
| `_coGetAllKnownZones()` | Gather all unique zone identifiers from all objects' zone_assignments |
| `_coRenderZoneList(obj)` | Render the zone list inside the zone modal with toggles, sort_order, and config editors |
| `_coCreateZoneItem(objectId, zoneId, isAssigned, za)` | Create a single zone item element with checkbox toggle, sort input, and config textarea |
| `_coAssignZone(objectId, zoneId)` | Assign object to a zone via POST `/api/custom-objects/{id}/assign` |
| `_coUnassignZone(objectId, zoneId)` | Unassign object from a zone via DELETE `/api/custom-objects/{id}/assign/{zone_id}` |
| `_coUpdateZoneAssignment(objectId, zoneId, config, sortOrder)` | Update zone assignment config/sort_order via PUT |
| `_coRefreshAfterZoneChange(objectId)` | Refresh data and re-render zone modal after any zone change |
| `_coHandleEsc(e)` | ESC key handler — closes modals from innermost to outermost |
| `_coEscape(str)` | HTML-escape a string for safe insertion |
| `_coFetchIndicators()` | Fetch objects assigned to indicators_zone and render the listing |
| `_coRenderIndicatorsList()` | Render indicators zone objects with drag handles, sorted by sort_order |
| `_coInitIndicatorDragReorder()` | Initialize drag-to-reorder for indicator rows (HTML5 + touch) |
| `_coIndicatorOnDragStart(e)` | HTML5 dragstart handler for indicator rows |
| `_coIndicatorOnDragOver(e)` | HTML5 dragover handler — shows drop position indicator |
| `_coIndicatorOnDragEnd()` | HTML5 dragend handler — cleans up drag state |
| `_coIndicatorOnDrop(e)` | HTML5 drop handler — calculates new order and persists |
| `_coIndicatorOnTouchStart(row, data)` | Touch drag start — creates placeholder, floats row |
| `_coIndicatorOnTouchMove(row, data)` | Touch drag move — repositions row and placeholder |
| `_coIndicatorOnTouchEnd(row, data)` | Touch drag end — restores row, reads new order, persists |
| `_coIndicatorPersistOrder(orderedObjectIds)` | Persist indicator order via PUT `/api/custom-objects/zone/indicators_zone/reorder` |
| `_coToggleZonePreview()` | Toggle the zone preview panel visibility — renders or hides the preview |
| `_coRenderZonePreview()` | Render the zone preview panel using collapsible Zone_Panel layout with 3-column field grid |
| `_coPreviewRenderField(obj, unitSystem)` | Render a single preview field with appropriate input type, range highlighting, and unit label |
| `_coPreviewEvaluateConditionalDisplay(rule, settings)` | Evaluate conditional_display rule against user settings (pure function) |
| `_coPreviewGetUnitLabel(obj, unitSystem)` | Get unit label based on user's unit system (pure function) |
| `_coPreviewGetRangeHighlightClass(value, rangeMin, rangeMax)` | Determine CSS class for range highlighting (pure function) |
| `_coAllZones` | Array — full list of custom zones from API |
| `_coZoneEditorZone` | Object or null — zone currently being edited in zone editor modal |
| `_coZoneEditorObjects` | Array — objects assigned to the zone being edited |
| `_coFetchZones()` | Fetch all custom zones from GET /api/custom-zones and render the listing |
| `_coRenderZonesList()` | Render the custom zones listing with name, object count, edit/delete buttons |
| `_coInitZoneDragReorder()` | Initialize drag-to-reorder for zone rows (HTML5 + touch) |
| `_coZoneOnDragStart(e)` | HTML5 dragstart handler for zone rows |
| `_coZoneOnDragOver(e)` | HTML5 dragover handler — shows drop position indicator |
| `_coZoneOnDragEnd()` | HTML5 dragend handler — cleans up drag state |
| `_coZoneOnDrop(e)` | HTML5 drop handler — calculates new order and persists |
| `_coZoneOnTouchStart(row, data)` | Touch drag start — creates placeholder, floats row |
| `_coZoneOnTouchMove(row, data)` | Touch drag move — repositions row and placeholder |
| `_coZoneOnTouchEnd(row, data)` | Touch drag end — restores row, reads new order, persists |
| `_coZonePersistOrder(orderedZoneIds)` | Persist zone order via PUT /api/custom-zones/{zone_id} with new sort_order values |
| `_coDeleteZone(zone)` | Delete a zone with confirmation via DELETE /api/custom-zones/{zone_id} |
| `_coInitCreateZoneModal()` | Wire up create zone modal cancel/submit buttons |
| `_coOpenCreateZoneModal()` | Open the create zone modal |
| `_coCloseCreateZoneModal()` | Close the create zone modal |
| `_coSubmitCreateZone()` | Submit zone creation via POST /api/custom-zones, then open zone editor |
| `_coInitZoneEditorModal()` | Initialize zone editor modal controls (close, name blur, add button) |
| `_coOpenZoneEditor(zone)` | Open the zone editor modal for a zone — fetches objects, renders list |
| `_coCloseZoneEditor()` | Close the zone editor modal and refresh zones list |
| `_coZoneEditorSaveName()` | Save zone name change via PUT /api/custom-zones/{zone_id} |
| `_coZoneEditorFetchObjects()` | Fetch objects assigned to the zone being edited |
| `_coZoneEditorRenderObjects()` | Render assigned objects in zone editor, grouped by sub_type, sorted by sort_order |
| `_coZoneEditorRemoveObject(obj)` | Remove object from zone via DELETE /api/custom-objects/{id}/assign/{zone_id} |
| `_coInitZoneEditorDragReorder()` | Initialize drag-to-reorder for zone editor cards (HTML5 + touch) |
| `_coZoneEditorOnDragStart(e)` | HTML5 dragstart for zone editor cards |
| `_coZoneEditorOnDragOver(e)` | HTML5 dragover for zone editor cards |
| `_coZoneEditorOnDragEnd()` | HTML5 dragend for zone editor cards |
| `_coZoneEditorOnDrop(e)` | HTML5 drop for zone editor cards |
| `_coZoneEditorOnTouchStart(card, data)` | Touch drag start for zone editor cards |
| `_coZoneEditorOnTouchMove(card, data)` | Touch drag move for zone editor cards |
| `_coZoneEditorOnTouchEnd(card, data)` | Touch drag end for zone editor cards |
| `_coZoneEditorPersistOrder()` | Persist zone editor card order via PUT /api/custom-objects/zone/{zone_id}/reorder |
| `_coToggleZonePreview()` | Toggle the zone preview panel visibility — renders or hides the preview |
| `_coRenderZonePreview()` | Render the zone preview panel using collapsible Zone_Panel layout with 3-column field grid |
| `_coPreviewRenderField(obj, unitSystem)` | Render a single preview field with appropriate input type, range highlighting, and unit label |
| `_coPreviewEvaluateConditionalDisplay(rule, settings)` | Evaluate conditional_display rule against user settings (pure function) |
| `_coPreviewGetUnitLabel(obj, unitSystem)` | Get unit label based on user's unit system (pure function) |
| `_coPreviewGetRangeHighlightClass(value, rangeMin, rangeMax)` | Determine CSS class for range highlighting (pure function) |


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
| Help Content (`.help-content`) | Help page typography and spacing — includes Ntfy Notifications section (setup flow, topic subscription, local vs Tailscale access, troubleshooting), Maps View section (date range filter, marker popups, clustering, color-coded status markers, Google Maps preference warning), and Home Assistant Integration section (setup process, HA custom integration deployment, CWOC connection config, webhook payload format, use case examples) |
| Author Footer (`.author-info`) | Page footer with copyright |
| Modal (`.modal`) | Full-screen modal overlay and content box |
| Universal Modal Overlay (`.cwoc-overlay`) | Shared fixed-position overlay backdrop for all modals — `position: fixed`, full viewport, `rgba(0,0,0,0.5)` background, `z-index: 9999`, flexbox centering. Used by `cwocConfirm`, `cwocPromptModal`, `cwocUnsavedModal` |
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

#### shared-rules.css
Rules-specific styles used by `rules-manager.html` and `rule-editor.html`. Depends on CSS variables from `shared-page.css`.

| Section | Description |
|---------|-------------|
| Pending Confirmations (`.rules-confirmations`) | Collapsible section with gold accent border, header with toggle arrow, confirmation cards with rule name, action description, timestamp, and Accept/Dismiss buttons |
| Rules Toolbar (`.rules-toolbar`) | Flex toolbar for rules page action buttons |
| Enabled Toggle (`.rule-enabled-toggle`) | Sliding toggle switch for rule enabled/disabled state with brown/parchment colors |
| Trigger Badge (`.trigger-badge`) | Inline badge with color-coded backgrounds per trigger type: `chit_created` (green), `chit_updated` (yellow), `email_received` (blue), `contact_created` (purple), `contact_updated` (pink), `scheduled` (brown), `ha_state_change` (teal), `ha_webhook` (orange) |
| Rule Name Link (`.rule-name-link`) | Underlined clickable rule name in the table |
| Drag Handle (`.rule-drag-handle`) | Grab cursor drag handle for rule reorder |
| Drag States (`.rule-dragging`, `.rule-drag-over`) | Visual feedback during drag-and-drop reorder |
| Delete Button (`.rule-delete-btn`) | Danger-colored delete button in the rules table |
| Condition Tree (`.condition-tree`, `.condition-group`, `.condition-leaf`) | Indented tree layout with left-border lines for nesting, AND/OR operator toggle buttons, add condition/group buttons, field/operator/value inputs, and remove buttons |
| Condition Operator Toggle (`.condition-operator-toggle`) | Inline AND/OR toggle button pair with active state highlighting |
| Action Rows (`.action-rows`, `.action-row`) | Flex layout for action configuration with type dropdown, dynamic parameter inputs, and remove button |
| Action Add Button (`.action-add-btn`) | Parchment-styled button for adding new action rows |
| Tag Picker Widget (`.rule-tag-picker`) | Wrapper with relative positioning for tag picker dropdown; input with parchment styling; `.rule-tag-picker-dropdown` absolute dropdown with max-height scroll; `.rule-tag-picker-item` clickable tag rows with color dot and optional favorite star; `.rule-tag-picker-empty` italic empty state message |
| Rule Editor Sections (`.rule-section`) | Card-style sections for rule editor form areas (info, trigger, conditions, actions, settings) |
| Schedule Config (`.schedule-config`) | Collapsible schedule configuration fields (frequency, interval, time of day) shown when "Scheduled" trigger is selected |
| Rule Toggle Row (`.rule-toggle-row`) | Flex row for confirm-before-apply toggle |
| Rule Button Bar (`.rule-button-bar`) | Save/Cancel button bar at bottom of rule editor |
| Responsive (≤768px) | Tablet breakpoints — reduced condition group indentation, stacked leaf conditions and action rows, stacked confirmation cards |
| Responsive (≤480px) | Mobile breakpoints — minimal indentation, compact operator toggles, full-width buttons |
| HA Action Panel (`.ha-action-panel`) | Container for HA action configuration with domain/service/entity inputs and fetch buttons |
| KV Editor (`.ha-kv-editor`) | Key-value pair editor for service_data and event_data with add/remove row buttons |
| JSON Preview (`.ha-json-preview`) | Read-only JSON preview panel with monospace font and parchment background |
| Entity/Service Picker Modal (`.ha-picker-modal`) | Searchable modal for selecting HA entities or services with filter input, scrollable list, and domain grouping |
| Smart Input Wrapper (`.smart-input-wrapper`, `.smart-input-field`) | Base searchable dropdown wrapper with relative positioning and parchment-styled input |
| Smart Input Dropdown (`.smart-input-dropdown`, `.smart-input-option`) | Generic dropdown select styling and absolute-positioned option list with hover highlighting |
| Smart Input Unrecognized (`.smart-input-unrecognized`) | Red italic indicator for saved values not matching current options (e.g., deleted email account) |
| Smart Input Color Swatches (`.smart-input-color-swatches`, `.smart-input-swatch-grid`, `.smart-input-swatch`, `.smart-input-swatch-selected`, `.smart-input-color-hex`) | Color swatches grid with clickable circles, selection checkmark indicator, and hex text input |
| Smart Input Autocomplete (`.smart-input-autocomplete-wrapper`, `.smart-input-autocomplete`, `.smart-input-autocomplete-dropdown`, `.smart-input-autocomplete-item`) | Contact autocomplete widget — input with absolute dropdown, name+email display items, hover states |
| Smart Input Location (`.smart-input-location-combobox`, `.smart-input-location-input`) | Location combobox with text input and saved locations dropdown |
| Smart Input Weather (`.smart-input-weather-wrapper`, `.smart-input-weather-numeric`, `.smart-input-weather-location`) | Weather input — flex layout with numeric threshold input and location combobox side by side |
| Smart Input Create Chit Panel (`.smart-input-create-chit-panel`, `.create-chit-field-group`, `.create-chit-field-label`) | Create Chit action panel — 2-column grid layout with field groups and full-width spanning |

#### shared-timepicker.css
iOS-style drum roller time picker styles. Mobile-first bottom-sheet on phones, centered modal on desktop. Parchment theme with scroll-snap drums, fade masks, highlight bar, and animated open/close transitions.

| Section | Description |
|---------|-------------|
| Overlay (`.cwoc-tp-overlay`) | Fixed full-screen backdrop with fade animation |
| Modal (`.cwoc-tp-modal`) | Bottom-sheet on mobile, centered card on desktop with slide/scale transitions |
| Drums (`.cwoc-tp-drums`, `.cwoc-tp-drum`) | Flex container for hour/minute/AM-PM scroll columns with fade masks |
| Scroller (`.cwoc-tp-scroller`) | Scroll-snap container with hidden scrollbars and touch momentum |
| Items (`.cwoc-tp-item`) | Individual time values with selected state scaling and opacity transitions |
| Highlight (`.cwoc-tp-highlight`) | Center-aligned selection indicator bar |
| Buttons (`.cwoc-tp-buttons`) | Cancel / Now / Set button row |

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
| Birthday Events | Concave-notch clip-path shape (`.birthday-event`), birthday chip (`.birthday-chip`), and chip thumbnail (`.birthday-chip-img`) |

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
| Map Thumbnail (`.chit-map-thumbnail`) | Small OSM map tile on chit cards (Tasks, Checklists, Notes) for non-default locations — 120×80px, bottom-right, with pin overlay |
| Map Pin Icon (`.chit-location-icon`) | Compact map-marker-alt icon for Alarms/Projects/Calendar views |
| Tracking Button (`.email-track-btn`) | Inline carrier logo + "Track" link button on email cards with detected tracking numbers (UPS, USPS, FedEx, UniUni) or flight numbers |

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

#### styles-email-bundles.css
Email bundle toolbar, tabs, modal, and context menu styles. Loaded after `styles.css` in `index.html`.

| Section | Description |
|---------|-------------|
| Bundle Toolbar Container (`.bundle-toolbar`) | Sticky two-row toolbar with parchment background and bottom shadow |
| Row 1: Bulk Action Controls (`.bundle-toolbar-actions`) | Select all, archive, tag, mark read/unread buttons; greyed-out when no selection |
| Row 2: Bundle Tabs (`.bundle-tabs-row`) | Horizontal scrollable tab bar with active tab accent border |
| Unread Count Badge (`.bundle-unread-badge`) | Small circular badge on bundle tabs showing unread count |
| "+" Create Bundle Button (`.bundle-add-btn`) | Subtle circular button at end of tab row |
| Dimmed State (`.bundle-tabs-row.dimmed`) | Opacity 0.4 and non-interactive when sub-filter is not "inbox" |
| Mobile Responsive | Horizontal scroll for tabs, wrapping for controls at ≤600px |
| Context Menu (`.bundle-context-menu`) | Parchment dropdown with Edit, Reorder, Delete options |
| Drag-and-drop Reorder (`.bundle-tabs-row.reorder-active`) | Grab cursor, drag-over highlight, drop indicator |
| Bundle Modal (`.cwoc-modal.bundle-modal`) | Centered overlay modal with name input, description textarea, action buttons |
| Modal Form Fields (`.bundle-modal-field`) | Input and textarea styling within the modal |
| Modal Action Buttons (`.bundle-modal-actions`) | Cancel and Define Rule/Save button row |
| Modal Hint (`.bundle-modal-hint`) | Validation error/hint message display |
| Modal Mobile Responsive | Full-width modal at ≤600px |

#### styles-omni.css
Omni View layout, HST bar styling, section cards, and responsive rules. Loaded after `styles-email-bundles.css` in `index.html`.

| Section | Description |
|---------|-------------|
| Omni Layout | Two-column responsive grid for Omni View sections |
| Section Cards | Section wrapper styling with headers and content areas |
| HST Bar | Holeman Simplified Time progress bar with weather icon overlay |
| Chrono Anchored | Time-until badges and chronological item styling |
| On Deck | Habit streak display and on-deck item cards |
| Soon | Due-date badges and upcoming item styling |
| Weather Bar | Horizontal weather forecast bar |
| Pinned Notes | Pinned notes section layout |
| Pinned Checklists | Pinned checklists section layout |
| Email Section | Email cards with pagination controls |
| Locked Filters Indicator | Visual indicator for active locked filters |
| Lock Filters Button | Sidebar lock/unlock button styling |
| Responsive (≤768px) | Single-column layout, compact sections |
| Responsive (≤480px) | Mobile-optimized spacing and font sizes |

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

#### editor-email.css
Email zone styles for the chit editor. Uses the parchment theme variables from `shared-editor.css`. Load AFTER `shared-editor.css` and `editor.css`.

| Section | Description |
|---------|-------------|
| Email Zone Container (`#emailSection`) | Border, border-radius, margin, background, overflow, collapse transition; `.collapsed` state with reduced opacity |
| Email Zone Content (`.zone-content`) | Padding and background for the zone body |
| Expand Button (`.expand-btn`) | Zone header expand/collapse button styling |
| Email Field Rows (`.email-field`) | Flex layout for label + input pairs (From, To, Cc, Bcc); label styling with min-width, font-weight, Lora serif font |
| Email Field Inputs | Text input styling with inset border, Lora font, focus ring with accent-teal |
| From Display (`.email-from-display`) | Read-only From field with dotted border, italic text, parchment background |
| Email Body (`#emailBody`) | Full-width textarea with min-height 180px, vertical resize, Lora font, placeholder styling |
| Disabled / Read-Only States | Parchment background, dotted border, reduced opacity for disabled/readonly fields |
| Recipient Tag Chips (`.email-recipient-chip`) | Inline-flex chip styling consistent with existing tag/people chip pattern; accent-teal background, remove button |
| Email Action Buttons | `#emailSendBtn` (info-blue), `#emailReplyBtn` / `#emailForwardBtn` (aged-brown) with hover states |
| Responsive — Tablet (≤768px) | Reduced gap and font sizes for email fields |
| Responsive — Mobile (≤480px) | Stacked column layout for email fields, full-width inputs, 16px font to prevent iOS zoom |
| Email Thread Section (`.email-thread-*`) | Thread conversation view below email body: header, list, items with sender/date/preview, current-email highlight |
| HTML Email Rendering (`.email-html-*`) | Toggle buttons for HTML/Text view, sandboxed iframe styling |

#### editor-attachments.css
Attachments zone styles for the chit editor. Uses the parchment theme variables from `shared-editor.css`. Load AFTER `shared-editor.css` and `editor.css`.

| Section | Description |
|---------|-------------|
| Attachment List (`.attachment-item`) | Flex layout for icon, name, size, download/delete actions |
| Upload Area (`.attachment-upload-area`) | Dashed border drop zone with drag-over highlight |
| Upload Progress (`.attachment-progress`) | Pulsing animation for upload status |
| Responsive — Mobile (≤480px) | Stacked layout for upload area |

#### editor-nest.css
Nest button and thread picker styles for the chit editor. Uses the parchment theme variables from `shared-editor.css`. Load AFTER `shared-editor.css` and `editor.css`.

| Section | Description |
|---------|-------------|
| Nest Button Label (`.nest-button-label`) | Smaller font, ellipsis overflow, max-width for truncated subject display |
| Nest Button Active (`.nest-button-active`) | Blue color matching pinned button active state |
| Thread Picker Modal (`.nest-thread-picker-modal`) | Parchment modal styling (background #fffaf0, border #6b4e31, Lora font) |
| Picker Search (`.nest-picker-search`) | Search input styling for thread filter |
| Picker List (`.nest-picker-list`) | Scrollable list with max-height |
| Picker Item (`.nest-picker-item`) | Individual thread entry (44px min height for touch targets) |
| Nested Chit Card (`.email-nest-card`) | Nested chit card in thread view with subtle left border tint |
| Nest Icon (`.email-nest-icon`) | Nest icon (fa-dove) styling |
| Responsive — Mobile (≤480px) | Mobile-friendly with 44px minimum tap targets |

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
| `deploy_ha_integration()` | Deploy HA custom integration to a user-specified HA custom_components path. Copies `ha_integration/custom_components/cwoc/` to the target directory. Offers update (overwrite) option for existing deployments. Displays reminder to restart Home Assistant after deployment |

Called in both fresh-install and upgrade paths of `main()`, after `configure_https` and before `start_and_verify`.

`install_python_deps()` includes `pywebpush` and `cryptography` in the `required_pkgs` list, installed via `/app/venv/bin/pip`.

### `cwoc-push.sh` — Push Service Startup Script

Ensures push-related services stay running. Checks Tailscale and Ntfy service status on each invocation. Also installs `cryptography` package via pip on push.

| Block | Description |
|-------|-------------|
| cryptography install | Runs `ssh "$SERVER" "/app/venv/bin/pip install cryptography -q"` to ensure the package is present after code push |
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
<script src="/frontend/js/dashboard/main-views-tasks.js"></script>
<script src="/frontend/js/dashboard/main-views-habits.js"></script>
<script src="/frontend/js/dashboard/main-views-notes.js"></script>
<script src="/frontend/js/dashboard/main-views-notebook.js"></script>
<script src="/frontend/js/dashboard/main-views-projects.js"></script>
<script src="/frontend/js/dashboard/main-views-alarms.js"></script>
<script src="/frontend/js/dashboard/main-views-indicators.js"></script>
<script src="/frontend/js/dashboard/main-views.js"></script>
<script src="/frontend/js/dashboard/main-alerts.js"></script>
<script src="/frontend/js/dashboard/main-search.js"></script>
<script src="/frontend/js/dashboard/main-email.js"></script>
<script src="/frontend/js/dashboard/main-email-bundles.js"></script>
<script src="/frontend/js/dashboard/main-omni.js"></script>
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
<link rel="stylesheet" href="/frontend/css/editor/editor-email.css" />
<link rel="stylesheet" href="/frontend/css/editor/editor-attachments.css" />
<link rel="stylesheet" href="/frontend/css/editor/editor-nest.css" />
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

<!-- 4. Editor sub-scripts (zone modules, then email, then save, then sharing data-layer, then people, then init) -->
<script src="/frontend/js/editor/editor.js"></script>
<script src="/frontend/js/editor/editor-dates.js"></script>
<script src="/frontend/js/editor/editor-tags.js"></script>
<script src="/frontend/js/editor/editor-location.js"></script>
<script src="/frontend/js/editor/editor-notes.js"></script>
<script src="/frontend/js/editor/editor-send-content.js"></script>
<script src="/frontend/js/editor/editor-send-item.js"></script>
<script src="/frontend/js/editor/editor-alerts.js"></script>
<script src="/frontend/js/editor/editor-color.js"></script>
<script src="/frontend/js/editor/editor-health.js"></script>
<script src="/frontend/js/editor/editor-custom-zones.js"></script>
<script src="/frontend/js/editor/editor-email.js"></script>
<script src="/frontend/js/editor/editor-email-pgp.js"></script>
<script src="/frontend/js/editor/editor-attachments.js"></script>
<script src="/frontend/js/editor/editor-nest.js"></script>
<script src="/frontend/js/editor/editor-snooze.js"></script>
<script src="/frontend/js/editor/editor-prerequisites.js"></script>
<script src="/frontend/js/editor/editor-save.js"></script>
<script src="/frontend/js/editor/editor-autosave.js"></script>
<script src="/frontend/js/editor/editor-sharing.js"></script>
<script src="/frontend/js/editor/editor-people.js"></script>
<script src="/frontend/js/editor/editor-init.js"></script>
<script src="/frontend/js/editor/editor-mobile-zones.js"></script>

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

Pages using this pattern: `settings.html`, `people.html`, `contact-editor.html`, `weather.html`, `trash.html`, `audit-log.html`, `help.html`, `profile.html`, `user-admin.html`, `maps.html`, `rules-manager.html`, `rule-editor.html`.

New frontend pages added for multi-user system:
- `login.html` — Standalone login page (no shared header/footer, no `shared-auth.js`). Parchment-themed centered form with username/password inputs.
- `profile.html` — User profile page. Uses `shared-page.css`, `shared-page.js`, `CwocSaveSystem`. Loads `profile.js`.
- `user-admin.html` — Admin-only user management page. Uses `shared-page.css`, `shared-page.js`. Loads `user-admin.js`. Redirects non-admins to `/`.

New frontend pages added for chit sharing system:
- `kiosk.html` — Standalone unauthenticated kiosk page. Reads `users` query parameter from the URL, fetches combined data from `/api/kiosk?user_ids=...`, renders a combined calendar view and task list with `owner_display_name` attribution. Auto-refreshes every 60 seconds. Does not require authentication — no `shared-auth.js` dependency. Uses `shared-page.css` for parchment theme plus inline `<style>` for kiosk-specific layout. All JS is inline in a single IIFE.

New frontend pages added for Maps View:
- `maps.html` — Interactive Leaflet map page with two display modes: Chits (location-based chit markers) and People (contact address markers). Features mode toggle with localStorage persistence, chits filter panel (status, tags, priority, people, text search, date range), people filter panel (text search, favorites toggle, tag chips), mode-specific legends, separate cluster groups with distinct styling, contact popups with editor links, and responsive mobile layout with collapsible filter panels. Uses `shared-page.css` for parchment theme plus inline `<style>` for map-specific layout. Loads Leaflet.js, Leaflet.markercluster (CDN), shared scripts, `shared-page.js`, and `maps.js`. Served at `/maps` via `health.py`.

New frontend pages added for Rules Engine:
- `rules-manager.html` — Rules Manager page. Uses `shared-page.css` and `shared-rules.css` for styling, `shared-page.js` for header/footer injection. Displays rules table with enabled toggle, name, trigger type badge, priority, last run, run count, and delete button. Pending confirmations section at top (collapsible, hidden when empty) with Accept/Dismiss buttons. "New Rule" button navigates to `rule-editor.html`. Drag-and-drop reorder. Loads `rules-manager.js`. `data-page-title="Rules Manager"`, `data-page-icon="🤖"`.
- `rule-editor.html` — Rule Editor page. Uses `shared-page.css` and `shared-rules.css` for styling, `shared-page.js` for header/footer injection. Sections: Rule Info (name, description), Trigger (dropdown with ha_state_change and ha_webhook options + config panels), Conditions (visual tree builder), Actions (dynamic list with call_ha_service and fire_ha_event types), Settings (confirm toggle), Save/Cancel via `CwocSaveSystem`. Contains `<template>` elements: `tmpl-smart-autocomplete` (contact autocomplete input + dropdown), `tmpl-smart-color-swatches` (color swatches grid + hex input), `tmpl-smart-location-combobox` (location text input with saved locations), `tmpl-smart-weather-input` (numeric threshold + location selector), `tmpl-smart-create-chit` (Create Chit action panel grid). Loads `rule-editor.js`. `data-page-title="Rule Editor"`, `data-page-icon="🤖"`.


---

## 5. File Dependency Map

### 5.1 Backend Python Imports

```
src/backend/main.py
  ├── src.backend.db          (init_db, seed_version_info)
  ├── src.backend.migrations  (all migrate_* functions, including migrate_add_multi_user, migrate_add_sharing, migrate_add_push_subscriptions, migrate_add_vapid_keys, migrate_add_email_fields, migrate_add_attachments, migrate_add_email_body_html, migrate_add_fts5, migrate_add_contact_vault, migrate_create_rules_tables, migrate_add_habit_mode_to_rules, migrate_add_sync_version)
  ├── src.backend.middleware   (AuthMiddleware)
  ├── src.backend.weather     (start_weather_schedulers)
  ├── src.backend.schedulers  (start_rules_scheduler)
  └── src.backend.routes.*    (all 17 route modules, including auth_router, users_router, sharing_router, notifications_router, network_access_router, push_router, ntfy_router, email_router, attachments_router, rules_router, bundles_router, custom_objects_router, custom_zones_router, ha_router, sync_router, and devices_router)

src/backend/routes/chits.py
  ├── src.backend.db           (DB_PATH, serialize/deserialize, compute_system_tags, get_next_sync_version, _build_export_envelope)
  ├── src.backend.models       (Chit, ImportRequest)
  ├── src.backend.sharing      (resolve_effective_role, can_edit_chit, can_delete_chit, can_manage_sharing)
  ├── src.backend.routes.audit (insert_audit_entry, compute_audit_diff, get_actor_from_request)
  ├── src.backend.routes.notifications (_create_share_notifications)
  └── src.backend.rules_engine (dispatch_trigger — called after chit create/update/email_received)

src/backend/routes/trash.py
  └── src.backend.db           (DB_PATH, deserialize_json_field, get_next_sync_version)

src/backend/routes/settings.py
  ├── src.backend.db           (DB_PATH, serialize/deserialize)
  ├── src.backend.models       (Settings)
  └── src.backend.routes.audit (insert_audit_entry, compute_audit_diff, get_actor_from_request, _run_auto_prune)

src/backend/routes/contacts.py
  ├── src.backend.db           (DB_PATH, CONTACT_IMAGES_DIR, serialize/deserialize, compute_display_name)
  ├── src.backend.models       (Contact)
  ├── src.backend.serializers  (vcard_parse, vcard_print, csv_export, csv_import)
  ├── src.backend.routes.audit (insert_audit_entry, compute_audit_diff, get_actor_from_request)
  └── src.backend.rules_engine (dispatch_trigger — called after contact create/update)

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

src/backend/routes/email.py
  └── src.backend.db           (DB_PATH, serialize_json_field, deserialize_json_field, compute_system_tags)

src/backend/routes/attachments.py
  └── src.backend.db           (DB_PATH, serialize_json_field, deserialize_json_field)

src/backend/routes/custom_objects.py
  ├── src.backend.db           (DB_PATH)
  └── src.backend.models       (CustomObjectCreate, CustomObjectUpdate, ZoneAssignmentCreate, ZoneAssignmentUpdate, BulkReorderRequest)

src/backend/routes/custom_zones.py
  ├── src.backend.db           (DB_PATH)
  └── src.backend.models       (CustomZoneCreate, CustomZoneUpdate)

src/backend/routes/sync.py
  ├── src.backend.db           (DB_PATH, compute_system_tags, deserialize_json_field, get_next_sync_version, serialize_json_field)
  └── src.backend.routes.audit (insert_audit_entry)

src/backend/routes/devices.py
  ├── src.backend.auth_utils   (verify_password)
  └── src.backend.db           (DB_PATH, utcnow_iso)

src/backend/rules_engine.py
  ├── src.backend.db           (DB_PATH, serialize_json_field, deserialize_json_field, compute_system_tags)
  ├── src.backend.routes.audit (insert_audit_entry, compute_audit_diff)
  ├── src.backend.routes.push  (send_push_to_user — imported lazily in _send_rule_notification)
  └── src.backend.routes.ntfy  (send_ntfy_notification — imported lazily in _send_rule_notification)

src/backend/routes/rules.py
  ├── src.backend.db           (DB_PATH, serialize_json_field, deserialize_json_field)
  ├── src.backend.models       (RuleCreate, RuleUpdate, RuleReorder)
  ├── src.backend.cron_parser  (parse_cron, describe — used for period derivation and habit summary)
  ├── src.backend.routes.audit (get_actor_from_request, insert_audit_entry, compute_audit_diff)
  └── src.backend.rules_engine (execute_action)

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
  ├── src.backend.db           (DB_PATH, _update_lock, serialize_json_field, deserialize_json_field)
  ├── src.backend.cron_parser  (parse_cron, matches)
  ├── src.backend.routes.push  (send_push_to_user — imported lazily in _send_chit_push)
  ├── src.backend.routes.ntfy  (send_ntfy_notification — imported lazily in _send_chit_ntfy)
  └── src.backend.rules_engine (evaluate_condition_tree, execute_action, _build_action_description — imported lazily in _rules_scheduled_loop)

src/backend/migrations.py
  ├── src.backend.db           (DB_PATH, serialize_json_field)
  └── src.backend.auth_utils   (hash_password — used by migrate_add_multi_user)

src/backend/serializers.py
  └── src.backend.db           (compute_display_name)

src/backend/ics_serializer.py
  └── (no internal CWOC imports — leaf module, stdlib only)

src/backend/cron_parser.py
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

**Dependency summary:** `db.py`, `models.py`, `auth_utils.py`, and `cron_parser.py` are leaf modules with no internal imports. `routes/audit.py` is imported by `chits.py`, `contacts.py`, `settings.py`, `health.py`, `sharing.py`, `network_access.py`, `ntfy.py`, `rules.py`, and `sync.py` for audit logging. `routes/notifications.py` is imported by `chits.py` and `sharing.py` for notification creation. `routes/push.py` is imported lazily by `weather.py` and `rules_engine.py` for push notification sending. `routes/ntfy.py` is imported lazily by `weather.py` and `rules_engine.py` for ntfy notification sending. `routes/email.py` imports from `db.py` only (plus stdlib `imaplib`, `smtplib`, `email`; optional `cryptography.fernet`). `auth_utils.py` is imported by `routes/auth.py`, `routes/users.py`, `routes/devices.py`, and `migrations.py`. `cron_parser.py` is imported by `schedulers.py` for cron expression parsing. `middleware.py` is imported by `main.py`. `rules_engine.py` is imported by `routes/rules.py` (for `execute_action`), `routes/chits.py` and `routes/contacts.py` (for `dispatch_trigger`), and `schedulers.py` (for condition evaluation and action execution in scheduled rules). All route modules import from `db.py`.

### 5.2 Frontend Script Load Dependencies

Scripts are loaded via `<script>` tags. Later scripts depend on globals defined by earlier ones.

```
shared-auth.js            ← MUST load first (getCurrentUser, isAdmin, waitForAuth — auth guard)
  │
  └── shared-tab-sync.js   ← loads after shared-auth.js (BroadcastChannel + Web Locks leader election)
        │
        └── shared-utils.js      ← loads after shared-auth.js (getCachedSettings uses waitForAuth)
              │
        ├── shared-touch.js         (standalone — enableTouchDrag, enableTouchGesture)
        ├── shared-checklist.js     (uses fetch, DOM — no shared-utils deps)
        ├── shared-sort.js          (uses localStorage — no shared-utils deps)
        ├── shared-indicators.js    (standalone — alert type detection)
        ├── shared-calendar.js      (uses getCachedSettings from shared-utils)
        ├── shared-tags.js          (uses getCachedSettings, fetch)
        ├── shared-tag-modal.js     (uses shared-tags, shared-utils; injectable tag edit modal)
        ├── shared-recurrence.js    (standalone — date math)
        ├── shared-geocoding.js     (uses fetch)
        └── shared-qr.js            (uses qrcode-generator CDN lib)
        └── shared-hotkeys.js       (standalone — no dependencies)
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
              │     main-views-tasks.js
              │     main-views-habits.js (uses shared-habits.js for fetchHabitRules)
              │     main-views-notes.js
              │     main-views-notebook.js
              │     main-views-projects.js
              │     main-views-alarms.js
              │     main-views-indicators.js
              │     main-views.js      (coordinator — uses shared-tags, shared-sort, shared-indicators)
              │     main-alerts.js     (uses shared alarm system from shared.js)
              │     main-search.js
              │     main-email.js      (email tab view — displayEmailView, _checkMail, _composeEmail, _updateEmailBadge, _emailQuickArchive, _emailQuickDelete, _emailHasReply, _emailDetectTracking, _emailGetContactImage, _toggleEmailUnreadTop, _emailShowErrorWithSettingsLink, _emailInjectNests, _buildNestedChitCard, _nestGetContentPreview)
              │     main-email-bundles.js (bundle toolbar, tabs, filtering, modal, context menu, reorder — _fetchBundles, _filterByBundle, _renderBundleToolbar, _openBundleModal, _showBundleContextMenu)
              │     main-omni.js       (Omni View — displayOmniView, HST bar, section orchestration, email pagination, filter lock)
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
                    editor-send-content.js (send notes/checklist to another chit)
                    editor-send-item.js   (send single checklist item to another chit)
                    editor-alerts.js      (alerts zone)
                    editor-color.js       (color zone)
                    editor-health.js      (health indicators zone)
                    editor-custom-zones.js (custom zones — depends on editor-health.js; provides _loadCustomZones, _gatherCustomZoneData)
                    editor-email.js       (email zone — depends on shared-utils, shared-editor, editor-save; includes thread view and HTML rendering)
                    editor-email-pgp.js   (PGP encrypt/decrypt — depends on openpgp.min.js CDN, editor-email.js; provides _pgpPreSendEncrypt, _pgpInitForDraft, _pgpDecryptInPlace)
                    editor-attachments.js (attachments zone — depends on shared-utils, editor-save)
                    editor-nest.js        (nest button + thread picker — depends on shared-utils, editor-save)
                    editor-snooze.js      (snooze modal + state — depends on shared.js; provides _initSnooze, _currentSnoozedUntil for editor-save)
                    editor-prerequisites.js (prerequisites picker — depends on shared-utils, editor-save; provides initPrerequisites, getPrerequisitesData)
                    editor-save.js        (save/exit logic)
                    editor-autosave.js    (auto-save system — depends on editor-save.js; provides CwocAutoSave class)
                    editor-sharing.js     (sharing data-layer — uses shared-auth; provides _sharingUserList, getSharingData, hasSharingData for editor-people.js and editor-init.js)
                    editor-init.js        (entry point — calls init functions)
                    editor-mobile-zones.js (mobile swipe zone navigation — depends on editor-init.js, shared-mobile.js)
```

**Key rules:**
- `shared-auth.js` must always load first among app scripts (checks auth, provides `getCurrentUser`, `isAdmin`, `waitForAuth`)
- `shared-tab-sync.js` must load after `shared-auth.js` (no deps on shared-utils; provides cross-tab data sharing)
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
