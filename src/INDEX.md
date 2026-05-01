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

Registers all route modules (including `auth_router`, `users_router`, and `sharing_router`), runs all migrations (including `migrate_add_multi_user()`, `migrate_add_sharing()`, and `migrate_add_kiosk_users()`) and `init_db()` at import time, mounts `StaticFiles` for frontend, static, and data directories.

### 1.3 `src/backend/models.py` — Pydantic Models

| Class | Description |
|-------|-------------|
| `ShareEntry` | Share entry with `user_id: str` and `role: str` (manager or viewer) |
| `SharedTagEntry` | Tag-level share entry with `tag: str` and `shares: List[ShareEntry]` |
| `Tag` | Tag with name, color, fontColor, favorite |
| `Settings` | User settings — time format, tags, colors, indicators, calendar config, audit limits, habits success window, shared_tags, etc. |
| `Chit` | Core chit model — title, note, dates, status, checklist, alerts, recurrence, location, color, people, hide_when_instance_done, shares, stealth, assigned_to, etc. |
| `MultiValueEntry` | Label/value pair for contact multi-value fields (phone, email, etc.) |
| `Contact` | Contact model — name fields, phones, emails, addresses, social, security, notes, tags, color |
| `ImportRequest` | Import envelope — mode ("add"/"replace") + data dict |
| `UserCreate` | Create user request — username, display_name, password, email (optional), is_admin (optional, default False) |
| `UserResponse` | User response — id, username, display_name, email, is_admin, is_active, created_datetime |
| `LoginRequest` | Login request — username, password |
| `ProfileUpdate` | Profile update request — display_name (optional), email (optional) |
| `PasswordChange` | Password change request — current_password, new_password |

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
| `compute_system_tags(chit)` | Auto-assign system tags (Calendar, Tasks, Notes, etc.) based on chit properties |
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
| `migrate_add_habits_fields()` | Add `hide_when_instance_done` column to chits table and `habits_success_window` column to settings table |
| `migrate_add_border_color_settings()` | Add `overdue_border_color` and `blocked_border_color` setting columns |
| `migrate_add_multi_user()` | Create `users` and `sessions` tables, default admin account, add `owner_id`/`owner_display_name`/`owner_username` columns to chits, add `owner_id` to contacts, reassign existing data to admin user |
| `migrate_add_user_profile_image()` | Add `profile_image_url` column to users table |
| `migrate_add_alerts_owner_id()` | Add `owner_id` column to standalone_alerts and alert_state tables, assign existing rows to admin user |
| `migrate_add_login_message()` | Create `login_message` table for instance login welcome message |
| `migrate_add_instance_name()` | Add `instance_name` column to login_message table |
| `migrate_add_sharing()` | Add `shares` (TEXT), `stealth` (BOOLEAN, default 0), `assigned_to` (TEXT) columns to chits table; add `shared_tags` (TEXT) column to settings table |
| `migrate_add_kiosk_users()` | Add `kiosk_users` (TEXT) column to settings table for kiosk user selection |

### 1.6 `src/backend/serializers.py` — vCard & CSV

| Function | Description |
|----------|-------------|
| `vcard_parse(vcard_string)` | Parse a vCard 3.0 string into a contact dict |
| `vcard_print(contact)` | Serialize a contact dict to a vCard 3.0 string |
| `_csv_header()` | Return the CSV column header list for contacts |
| `csv_export(contacts)` | Export a list of contacts as a CSV string |
| `csv_import(csv_text)` | Import contacts from a CSV string; returns (contacts, errors) |

### 1.7 `src/backend/weather.py` — Weather API & Schedulers

| Function | Description |
|----------|-------------|
| `_get_chit_focus_date(chit)` | Determine the relevant date for weather lookup on a chit |
| `_partition_eligible_chits(chits, now)` | Split chits into 7-day and 8–16 day buckets for weather fetching |
| `_extract_weather_for_date(forecast_daily, focus_date)` | Pull a single day's forecast from the daily forecast array |
| `_sync_weather_fetch(url)` | Synchronous HTTP GET wrapper for weather API calls |
| `_fetch_weather_for_location(lat, lon, days)` | Async fetch of weather forecast for a lat/lon |
| `_geocode_address(address)` | Async geocode an address via Nominatim |
| `weather_update()` | Main weather update — geocodes chit locations, fetches forecasts, writes to DB |
| `_weather_hourly_loop()` | Background loop — runs `weather_update()` every hour for 7-day chits |
| `_weather_daily_loop()` | Background loop — runs `weather_update()` every 24h for 8–16 day chits |
| `start_weather_schedulers()` | Start both weather background loops |

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
| `_is_excluded(path, method)` | Return True if the request path/method should skip auth (static assets, login page, health check, login API, login-message API, kiosk page and API) |
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
| `resolve_effective_role(chit_row, user_id, owner_settings)` | Determine the effective role for a user on a chit. Resolution order: owner_id match → 'owner'; stealth=True and not owner → None; chit-level shares → role; tag-level shares → role; assigned_to match → 'viewer'; else None |
| `can_edit_chit(chit_row, user_id, owner_settings)` | Return True if the user has owner or manager role on the chit |
| `can_delete_chit(chit_row, user_id)` | Return True only if the user is the chit owner |
| `can_manage_sharing(chit_row, user_id, owner_settings)` | Return True if the user is the chit owner or has manager role (uses `resolve_effective_role()` internally and checks for `role in ("owner", "manager")`) |
| `get_shared_chits_for_user(user_id)` | Query all non-deleted, non-stealth chits shared with user_id via chit-level shares, tag-level shares, or assignment; annotates each with `effective_role`, `share_source`, `owner_display_name`, and `assigned_to_display_name` |
| `_parse_shares(shares_raw)` | Parse the shares column value into a list of dicts |
| `_parse_shared_tags(shared_tags_raw)` | Parse the shared_tags column value into a list of dicts |
| `_parse_chit_tags(tags_raw)` | Parse the chit tags column into a set of tag name strings |
| `_determine_share_source(chit, user_id, owner_settings)` | Determine which sharing path(s) grant access to the user (chit-level, tag-level, assignment, or multiple) |
| `_deserialize_chit_fields(chit)` | Deserialize JSON fields on a chit dict in place |

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
| `TestProperty8AssignmentGrantsAtLeastViewerAccess` | Assignment grants at least viewer access — assigned users get 'viewer' or higher; higher roles from other paths take precedence (120+ iterations). **Validates: Requirements 7.2** |
| `TestProperty9MigrationIdempotentAndPreservesData` | Migration is idempotent and preserves data — running `migrate_add_sharing()` multiple times produces no errors, columns exist, pre-existing data unchanged (120+ iterations). **Validates: Requirements 9.1, 9.2, 9.4** |
| `TestProperty7ManagersCanManageSharing` | Managers can manage sharing — `can_manage_sharing()` returns True for owner and manager roles, False for viewer and None (120+ iterations). **Validates: Requirements 2.1, 2.3, 2.4** |

---

### 1.18 `src/backend/routes/__init__.py`
Package marker. No public exports.

### 1.19 `src/backend/routes/chits.py` — Chit CRUD & Import/Export

All chit endpoints are scoped by `owner_id` — users can only access their own chits, plus chits shared with them via the sharing system. The `request.state.user_id` (set by `AuthMiddleware`) is used for ownership filtering, sharing permission checks, and assignment. Uses `resolve_effective_role`, `can_edit_chit`, `can_delete_chit`, and `can_manage_sharing` from `sharing.py` for access control.

| Route | Handler | Description |
|-------|---------|-------------|
| `GET /api/chits` | `get_all_chits(request)` | Return all non-deleted chits owned by the authenticated user |
| `GET /api/chits/search` | `search_chits(q, request)` | Global search across all chit fields, scoped to authenticated user |
| `POST /api/chits` | `create_chit(chit, request)` | Create a new chit with `owner_id`, `owner_display_name`, `owner_username` from authenticated user |
| `GET /api/chit/{chit_id}` | `get_chit(chit_id, request)` | Get a single chit by ID (verifies ownership or shared access via `resolve_effective_role`); includes `effective_role` and `assigned_to_display_name` in response |
| `PUT /api/chits/{chit_id}` | `update_chit(chit_id, chit, request)` | Update a chit (verifies ownership or manager access via `can_edit_chit`; non-managers/non-owners cannot change shares/stealth/assigned_to via `can_manage_sharing` guard; viewers get 403) |
| `DELETE /api/chits/{chit_id}` | `delete_chit(chit_id, request)` | Soft-delete a chit (owner only via `can_delete_chit`) |
| `PATCH /api/chits/{chit_id}/recurrence-exceptions` | `patch_recurrence_exceptions(chit_id, body, request)` | Add or update a recurrence exception (verifies ownership) |
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

| Route | Handler | Description |
|-------|---------|-------------|
| `GET /api/trash` | `get_trash()` | List all soft-deleted chits |
| `POST /api/trash/{chit_id}/restore` | `restore_chit(chit_id)` | Restore a soft-deleted chit |
| `DELETE /api/trash/{chit_id}/purge` | `purge_chit(chit_id)` | Permanently delete a chit |

### 1.21 `src/backend/routes/settings.py` — Settings & Alerts

Settings endpoints use `request.state.user_id` from `AuthMiddleware` to scope data to the authenticated user. Includes `shared_tags` serialization in settings read/save paths.

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
| `GET /profile` | `profile_page()` | Serve `profile.html` |
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
| `GET /api/release-notes` | `get_release_notes()` | Get the release notes markdown content |
| `GET /api/update/run` | `run_update()` | Run upgrade (SSE stream) |
| `GET /api/kiosk` | `get_kiosk(user_ids)` | Return combined non-deleted, non-stealth chits from specified users (comma-separated usernames or UUIDs) with `owner_display_name` attribution; also returns user display names. Unauthenticated endpoint |
| `GET /kiosk` | `kiosk_page()` | Serve `kiosk.html` page (unauthenticated) |
| `GET /wall-station` | `wall_station_redirect()` | Legacy redirect → `/kiosk` |
| `GET /api/wall-station` | `wall_station_api_redirect()` | Legacy redirect → `/api/kiosk` |

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
| `PUT /api/auth/profile` | `update_profile(body, request)` | Update display_name and/or email for authenticated user |
| `PUT /api/auth/password` | `change_password(body, request)` | Require current_password verification, hash new_password, update user. Returns 403 if current password is wrong |
| `POST /api/auth/switch` | `switch_user(body, request)` | Validate target user credentials, invalidate current session, create new session for target user |

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
| `PUT /api/chits/{chit_id}/shares` | `set_chit_shares(chit_id, body, request)` | Set entire shares list (owner only); validates role values, user_ids existence, rejects sharing with self |
| `DELETE /api/chits/{chit_id}/shares/{target_user_id}` | `remove_chit_share(chit_id, target_user_id, request)` | Remove a specific user from shares (owner only) |
| `GET /api/shared-chits` | `get_shared_chits(request)` | Return all chits shared with authenticated user, annotated with `effective_role`, `share_source`, and `owner_display_name` |
| `GET /api/settings/shared-tags` | `get_shared_tags(request)` | Return authenticated user's `shared_tags` configuration with display names |
| `PUT /api/settings/shared-tags` | `set_shared_tags(body, request)` | Set authenticated user's `shared_tags` configuration; validates role values and user_ids |

**Internal helpers:**

| Function | Description |
|----------|-------------|
| `_validate_role(role)` | Raise 400 if role is not 'manager' or 'viewer' |
| `_validate_user_ids_exist(cursor, user_ids)` | Raise 400 if any user_id does not exist in the users table |
| `_load_chit_row(cursor, chit_id)` | Load a chit by ID and return as dict; raises 404 if not found |

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

Touch event adapter for drag interactions. Maps touch events to mouse-like drag callbacks.

| Function | Description |
|----------|-------------|
| `enableTouchDrag(element, callbacks)` | Attach touch-based drag listeners (onStart, onMove, onEnd) to an element; idempotent |

#### shared-checklist.js

Inline checklist interactions for dashboard views — toggle, move, cross-chit move, and drag-and-drop rendering.

| Function | Description |
|----------|-------------|
| `toggleChecklistItem(chitId, itemIndex, newChecked)` | Toggle a checklist item's checked state and save via API |
| `moveChecklistItem(chitId, fromIndex, toIndex)` | Move a checklist item within a chit's checklist and save |
| `moveChecklistItemCrossChit(fromChitId, fromIndex, toChitId, toIndex)` | Move a checklist item between chits (or within the same chit) and save both |
| `renderInlineChecklist(container, chit, onUpdate)` | Render an interactive checklist with check/uncheck, drag-reorder, and cross-chit drag support |

#### shared-sort.js

Manual sort order persistence and drag-to-reorder for chit cards.

| Function | Description |
|----------|-------------|
| `MANUAL_ORDER_KEY` | LocalStorage key for persisted manual sort orders |
| `getManualOrder(tab)` | Get the saved manual sort order (array of chit IDs) for a view tab |
| `saveManualOrder(tab, ids)` | Save the manual sort order for a view tab to localStorage |
| `applyManualOrder(tab, chitList)` | Sort a chit list according to the saved manual order; new chits go last |
| `enableDragToReorder(container, tab, onReorder)` | Enable mouse and touch drag-to-reorder on chit cards within a container |

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
| `enableCalendarDrag(scrollContainer, dayColumns, days, chitsMap)` | Make timed calendar events draggable (move) and resizable (bottom edge); skips drag/resize for viewer-role shared chits |
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
| `formatRecurrenceRule(rule)` | Format a recurrence rule as a human-readable string |
| `getRecurrenceSeriesInfo(chit, virtualDate)` | Count occurrence number, total past instances, completed count, and success rate for a series |

#### shared-geocoding.js

Shared geocoding with progressive fallback via the backend Nominatim proxy.

| Function | Description |
|----------|-------------|
| `_geocodeAddress(address)` | Geocode an address with progressive fallback (full → no zip → city/state); returns `{lat, lon}` |

#### shared-qr.js

QR code display modal — single source of truth for all QR display across the app.

| Function | Description |
|----------|-------------|
| `showQRModal(opts)` | Show a QR code in a full-screen modal overlay; accepts title, data, ecl, info, onClose |

#### shared.js (coordinator)

Coordinator for shared code between dashboard and editor. Contains glue code for quick-edit, recurrence actions, notes layout, mobile UI, weather, audio, sync, and the global alarm system.

| Function | Description |
|----------|-------------|
| `showQuickEditModal(chit, onRefresh)` | Quick-edit modal — shift+click on any calendar chit; shows editable dropdowns and recurrence options |
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
| `enableNotesDragReorder(container, tab, onReorder)` | Enable mouse drag-to-reorder on notes cards with column-aware drop |
| `_onNotesDragMove(e)` | Handle mouse move during notes drag with live preview |
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
| `enableLongPress(el, callback)` | Attach a long-press handler (~600ms) to an element for mobile quick edit |
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
| `getHabitSuccessRate(chit, windowDays)` | Calculate the percentage of completed occurrences within a rolling window (7, 30, 90 days, or "all"); excludes broken-off dates from both numerator and denominator |
| `getHabitStreak(chit)` | Count consecutive completed periods working backward from the most recent past occurrence; broken-off dates are neutral and do not break the streak |

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

### 2.2 Dashboard (`src/frontend/js/dashboard/`)

#### main-sidebar.js

| Function | Description |
|----------|-------------|
| `onSortSelectChange()` | Handle sort dropdown change — update sort field and re-render |
| `toggleSortDir()` | Toggle sort direction between ascending and descending |
| `_updateSortUI()` | Update the sort direction button text and visibility |
| `onFilterChange()` | Re-render chits and update the clear-filters button after any filter change |
| `onFilterAnyToggle(anyCb)` | When "Any" checkbox is checked, uncheck all specific filter options |
| `onFilterSpecificToggle(filterType)` | When a specific filter option is checked, uncheck "Any"; re-check "Any" if all unchecked |
| `clearFilterGroup(containerId)` | Clear all checkboxes in a filter group and re-check "Any" |
| `_filterTagCheckboxes()` | Filter visible tag checkboxes by the tag search input query |
| `_clearAllFilters()` | Reset all sidebar filters, sort, and search to defaults |
| `_resetDefaultFilters()` | Reset search to the default filter for the current tab (from settings) |
| `_updateClearFiltersButton()` | Show/hide the clear-filters button based on whether any filters are active |
| `_getSelectedFilterValues(containerId, filterType)` | Get an array of checked filter values from a multi-select container |
| `_getSelectedStatuses()` | Get currently selected status filter values |
| `_getSelectedLabels()` | Get currently selected label/tag filter values |
| `_getSelectedPriorities()` | Get currently selected priority filter values |
| `_toggleFilterArchived()` | Toggle the show-archived checkbox via hotkey |
| `_toggleFilterPinned()` | Toggle the show-pinned checkbox via hotkey |
| `_filterFocusSearch()` | Exit hotkey mode, expand filters, and focus the search input |
| `_pickSort(field)` | Set sort field via hotkey and re-render |
| `CwocSidebarFilter(config)` | Class — reusable sidebar filter panel with search, favorites, and hotkey numbers |
| `_buildTagFilterPanel()` | Build the tag filter panel using CwocSidebarFilter with colored tag badges |
| `_syncSidebarTagCheckboxes(container, tagObjects)` | Sync hidden checkbox elements to match the sidebar tag selection array |
| `_buildPeopleFilterPanel()` | Fetch contacts and render the people filter panel |
| `_renderPeopleFilterPanel(contacts)` | Render people filter chips into both sidebar and hotkey panel containers |
| `_renderPeopleChipFilter(containerId, contacts, selection)` | Render a chip-based people filter into a specific container |
| `_isPeopleColorLight(hex)` | Check if a people chip color is light (delegates to isLightColor) |
| `clearPeopleFilter()` | Clear the people filter selection and re-render |
| `toggleSidebar()` | Toggle sidebar open/closed and persist state to localStorage |
| `_toggleTopbar()` | Toggle the topbar (header) visibility and persist to localStorage |
| `_restoreTopbarState()` | Restore topbar visibility from localStorage on page load |
| `toggleSidebarSection(sectionId)` | Toggle a sidebar section's body visibility |
| `expandSidebarSection(sectionId)` | Expand a sidebar section (used by hotkeys) |
| `_toggleFiltersSection()` | Toggle the entire Filters section open/closed |
| `_expandFiltersSection()` | Ensure the Filters section is expanded (used by hotkeys) |
| `toggleFilterGroup(groupId)` | Toggle a filter sub-group's body visibility |
| `expandFilterGroup(groupId)` | Expand a filter sub-group (used by hotkeys) |
| `restoreSidebarState()` | Restore sidebar open/closed state from localStorage on page load |
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
| `attachCalendarChitEvents(el, chit)` | Attach dblclick (edit) and shift+click (quick edit) to a calendar event element; quick-edit is disabled for viewer-role shared chits |
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
| `_emptyState(message)` | Build a styled empty-state message with an optional Create Chit button |
| `_getTagColor(tagName)` | Get tag color from cached settings tags, fallback to pastel |
| `_getTagFontColor(tagName)` | Get tag font color from cached settings tags, fallback to dark brown |
| `_buildChitHeader(chit, titleHtml, settings, opts)` | Build a standard chit card header row with icons, indicators, title, meta, 🔗 shared icon with tooltip (owner, shared users with roles, current user's role) for shared chits, stealth indicator, and assignee badge |
| `_renderChitMeta(chit, mode)` | Legacy compact meta builder — kept for backward compat |
| `displayChecklistView(chitsToDisplay)` | Render the Checklists tab — chits with interactive checklist items |
| `displayTasksView(chitsToDisplay)` | Render the Tasks tab — chits with status dropdowns and note previews; dispatches to `displayHabitsView` when in habits mode |
| `displayHabitsView(chitsToDisplay)` | Render the Habits view — recurring chits as habit cards with completion toggles, success rate badges, and streak indicators |
| `_renderHabitCards(container, habitData, showCompleted, windowDays)` | Render habit cards into a container with completion-based sorting and hide-when-done filtering |
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
| `displayProjectsView(chitsToDisplay)` | Render the Projects tab — tree view of project masters with child chits |
| `_displayProjectsKanban(chitsToDisplay)` | Render the Projects Kanban view — status columns with drag-and-drop cards |
| `displayAlarmsView(chitsToDisplay)` | Render the Alarms tab — list of chits with alerts, or independent alerts board |
| `_displayIndependentAlertsBoard()` | Render the independent alerts board with Alarms, Timers, and Stopwatches columns |
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
| `_indicatorsLoad()` | Fetch health data from API and render SVG trend charts with expand buttons |
| `_indToggleExpand(key)` | Expand/collapse a single indicator chart — fills available viewport height when expanded, updates on resize |

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
| `_globalCheckNotifications()` | Check all chit notification alerts against their fire times; supports targetType and loop re-firing |
| `_showGlobalLoopingToast(emoji, label, chitTitle, chitId, loopKey)` | Show a persistent looping notification toast that stays until acknowledged |
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
| `_applyMultiSelectFilters(chitList)` | Apply status, label, priority, and people multi-select filters |
| `_applySort(chitList)` | Sort chits by the current sort field and direction |
| `storePreviousState()` | Save the current UI state to localStorage for restoration after editor |
| `_restoreUIState()` | Restore UI state from localStorage (editor return or refresh recovery) |
| `fetchChits()` | Fetch owned chits from `/api/chits` and shared chits from `/api/shared-chits` in parallel; merges shared chits (marked with `_shared` flag) into the chits array, deduplicating by ID |
| `displayChits()` | Main render dispatcher — filter, sort, expand recurrence, and render the active view |
| `_updateTabCounts(filteredChits)` | Update tab labels with counts of displayed chits per tab |
| `_applyChitDisplayOptions()` | Apply visual options — fade past events and highlight overdue chits |

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
| `onDateModeChange()` | Handle date mode radio button change — show/hide Start/End, Due, or None fields and update dependent UI |
| `onDueCompleteToggle()` | Toggle status to Complete when the Due date Complete checkbox is checked |
| `onStatusChange()` | Sync the Due Complete checkbox when the status dropdown changes |
| `_detectDateMode(chit)` | Detect the date mode (`'due'`, `'startend'`, or `'none'`) from a chit object |
| `_setDateMode(mode)` | Set the date mode radio button and apply field greying |
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
| `_allUsersCache` | System users from `/api/auth/switchable-users` |
| `_currentShares` | Array of current shares (`{user_id, role, display_name}`) — moved from `editor-sharing.js` |
| `_sharingInitialized` | Boolean flag indicating whether sharing controls have been initialized |
| `_effectiveRole` | Current user's effective role on the chit (`'owner'`, `'manager'`, `'viewer'`, or `null` for new chits) |
| `_chitOwnerId` | Owner user_id of the current chit (used to hide owner from people list for non-owners) |
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
| `_addShare(userId, role, displayName)` | Add a user to `_currentShares`, mark unsaved, re-render tree, sync assigned-to dropdown |
| `_removeShare(userId)` | Remove a user from `_currentShares`, mark unsaved, re-render tree, sync assigned-to dropdown |
| `_updateShareRole(userId, newRole)` | Update a user's role in `_currentShares`, mark unsaved, re-render tree, sync assigned-to dropdown |
| `_renderStealthToggle()` | Render the stealth toggle checkbox at the bottom of `#peopleContent`; hidden for viewers |
| `_syncAssignedToDropdown()` | Sync the assigned-to dropdown in the Task zone with current shares; show/hide row, populate options, clear if assigned user removed |
| `initPeopleSharingControls(chit)` | Initialize sharing controls for an existing chit — loads shares, sets stealth, determines effective role, syncs assigned-to |
| `initPeopleSharingForNewChit()` | Initialize sharing controls for a new chit — empty shares, stealth off, null effective role |
| `_filterPeopleTree(query)` | Filter the people tree by search query |
| `_toggleAllPeopleGroups(event, expand)` | Expand or collapse all letter groups in the people tree (includes both contact and system user letters) |
| `_addPeopleChip(data)` | Add a person chip (deduped by name), re-render chips and tree |
| `_removePeopleChip(index)` | Remove a person chip by index, re-render chips and tree |
| `_renderPeopleChips()` | Render the active people chips (contacts) and shared users (with pill toggles) in the right column |
| `_syncPeopleHiddenField()` | Sync the hidden `#people` input with current chip names (comma-separated) |
| `_updateActivePeopleCount()` | Update the active people count badge (includes both `_peopleChipData.length` and `_currentShares.length`) |
| `_isLightColor(hex)` | Delegate to shared `isLightColor()` |
| `_setPeopleFromArray(peopleArray)` | Populate people chips from a chit's people array (called during load) |

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
| `_checkNotificationAlerts()` | Check all notifications against chit dates (using targetType) and fire when due; supports loop re-firing |
| `_notifTimingLabel(n)` | Build a human-readable timing label for a notification using targetType (e.g., "before start", "after due") |
| `_fireNotificationAlert(msg, notif, notifIdx)` | Fire a browser notification and inline toast; looping notifications show "Acknowledge" button |
| `_alertsFromChit(chit)` | Parse a chit's alerts array into the `_alertsData` structure and render |
| `_alertsToArray()` | Flatten `_alertsData` back into a single array for saving |
| `renderAllAlerts()` | Render all four alert containers (notifications, alarms, timers, stopwatches) |
| `renderAlarmsContainer()` | Render the alarms list with name, time, days, toggle, delete, and snooze bar |
| `_defaultNotifsApplied` | Tracks which date modes have had default notifications applied |
| `_applyDefaultNotifications(mode)` | Auto-populate notifications from settings defaults when a date mode is first activated |
| `renderNotificationsContainer()` | Render the notifications list with value, unit, combined timing dropdown (before/after start/due), loop toggle, and delete controls |
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
| `getSharingData()` | Return sharing fields (`shares`, `stealth`, `assigned_to`) to merge into the chit save payload; reads `_currentShares` from `editor-people.js` globals, stealth checkbox from people zone, and assigned-to dropdown from task zone |
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
| `Checklist` | Class managing a checklist UI with nested items, drag-drop reorder, inline editing, and undo |
| `Checklist.constructor(container, initialItems, onChangeCallback)` | Initialize checklist with container, optional items, and change callback |
| `Checklist.init()` | Create input field and undo button, then render |
| `Checklist.loadItems(itemsArray)` | Load checklist items from an array, replacing current items |
| `Checklist.getChecklistData()` | Return a deep copy of current checklist items for JSON serialization |
| `Checklist.createInput()` | Create the "Add new item" text input with Enter/Escape handlers |
| `Checklist.createUndoButton()` | Create the "Undo Delete" button in the zone header |
| `Checklist.addNewItem(text, level, checked, id)` | Add a new checklist item with optional level, checked state, and ID |
| `Checklist.generateId()` | Generate a random item ID |
| `Checklist.render()` | Re-render all checklist items — unchecked above, completed below with ghost parents |
| `Checklist.createItemElement(item, isCompleted, isGhost)` | Create a DOM element for a checklist item with checkbox, text, trash, and drag events |
| `Checklist.startEditing(item, textSpan)` | Start inline editing of a checklist item with Enter/Tab/Arrow key navigation |
| `Checklist.toggleCheck(item, checked)` | Toggle an item's checked state and propagate to subtree |
| `Checklist.updateCheckedStateForSubtree(item, checked)` | Recursively set checked state on all children |
| `Checklist.getParent(item)` | Find the parent item of a given item |
| `Checklist.getChildren(item)` | Find all direct children of a given item |
| `Checklist.deleteItem(item, element)` | Delete an item and its subtree with animation; push to undo stack |
| `Checklist.undoDelete()` | Restore the last deleted subtree with strobe animation |
| `Checklist.getSubtree(item)` | Get an item and all its descendants recursively |
| `Checklist.onDragStart(e, item)` | Handle drag start — store dragged item and subtree |
| `Checklist.onDragOver(e, item)` | Handle drag over — show above/below/on drop indicators |
| `Checklist.onDragLeave(e, item)` | Handle drag leave — clear drop indicators |
| `Checklist.onDrop(e, item)` | Handle drop — reorder items based on drop position (above/below/nest) |
| `Checklist.clearDropIndicator()` | Remove all drag-over CSS classes from checklist items |
| `Checklist.updateSubtreeLevels(subtree, rootLevel)` | Adjust indent levels of a subtree after a drag operation |
| `Checklist.isDescendantOf(item, ancestor)` | Check if an item is a descendant of another item |
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
| *(IIFE)* Navigate Panel | Creates the V-hotkey navigation overlay on secondary pages (not dashboard); includes Profile and User Admin (admin-only) entries; exports `cwocOpenNavModal`, `cwocCloseNavModal`, `cwocIsNavModalOpen` globally |

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
| `SettingsManager.updateForm()` | Populate all form fields from the loaded settings object |
| `SettingsManager.gatherSettings()` | Gather all form field values into a settings object for saving |
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
| `importAllData()` | Import all data: open file picker, read JSON, validate type "all", show mode dialog |
| `loadVersionInfo()` | Fetch and display the current version and install date from `/api/version` |
| `_closeUpdateModal()` | Close the update modal; show reopen button if upgrade is still running |
| `startUpgrade()` | Open the upgrade modal and prepare the UI for an upgrade |
| `runUpgrade()` | Execute the upgrade via SSE from `/api/update/run` |
| `appendLogLine(line, bold)` | Append a styled log line to the update log with auto-scroll |
| `onUpgradeComplete(data)` | Handle upgrade completion — show result, re-enable buttons, reload version |
| `copyUpdateLog()` | Copy the update log text to the clipboard |
| `loadLastLog()` | Load and display the last upgrade log from `/api/update/log` |
| `showReleaseNotes()` | Fetch and display release notes markdown in a modal |
| `closeReleaseNotesModal()` | Close the release notes modal |
| `_renderDefaultNotifList(type, items)` | Render default notification rows for a given type ('start' or 'due') |
| `_addDefaultNotifRow(type)` | Add a new default notification row for a given type |
| `_gatherDefaultNotifList(type)` | Gather default notification rows from the DOM for a given type |
| `_loadTagSharingData()` | Load shared_tags config from `GET /api/settings/shared-tags` on page init after auth is ready |
| `_loadTagSharingUserList()` | Fetch the switchable user list for the tag sharing picker (cached after first call) |
| `_getTagShares(tagName)` | Get the shares array for a specific tag from the cached config |
| `_tagHasSharing(tagName)` | Return true if a tag has any active sharing configuration |
| `_populateTagSharingUserPicker()` | Populate the tag sharing user picker dropdown, excluding current user and already-shared users |
| `_renderTagSharesList()` | Render the current tag's shares list in the tag modal with role badges and remove buttons |
| `_getTagSharingUserName(userId)` | Look up a user's display name from the cached tag sharing user list |
| `_addTagShare()` | Add a user share to the current tag; called by the "Share" button in the tag modal |
| `_removeTagShare(userId)` | Remove a user from the current tag's shares list |
| `_saveTagSharingConfig(tagName)` | Save the full shared_tags config to the server via `PUT /api/settings/shared-tags` |
| `_initTagSharingSection(tagName)` | Initialize the tag sharing section when the tag modal opens; loads user list and populates pickers |

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

#### profile.js

Profile page: display and edit user profile (display name, email), change password.

| Function | Description |
|----------|-------------|
| `_initProfileSaveSystem()` | Initialize `CwocSaveSystem` and wire up save/cancel buttons |
| `_showMessage(el, text, type)` | Show a message in the specified message div ('success' or 'error') |
| `_clearMessage(el)` | Clear a message div |
| `_loadProfile()` | Fetch user data from `GET /api/auth/me` and populate form fields |
| `_saveProfile(exitAfter)` | Save profile changes via `PUT /api/auth/profile` with `{ display_name, email }` |
| `_handlePasswordChange()` | Handle password change via `PUT /api/auth/password`; validates new password matches confirmation |
| `_monitorProfileChanges()` | Wire up input listeners on editable profile fields to track dirty state |

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
| Help Content (`.help-content`) | Help page typography and spacing |
| Author Footer (`.author-info`) | Page footer with copyright |
| Modal (`.modal`) | Full-screen modal overlay and content box |
| Loader Spinner (`.loader`) | CSS spinner animation |
| Navigate Panel (`#cwoc-nav-overlay`) | V-hotkey navigation overlay for secondary pages |
| Tablet Responsive (≤768px) | Settings grid single-column |
| Mobile Responsive (≤480px) | Stacked header, full-width modals |
| Bold Alert Modal (`.cwoc-alert-overlay`) | Full-screen alarm/timer alert shared across all pages |
| Shared Chit Card Badges | `.cwoc-owner-badge` — owner attribution badge on shared chit cards; `.cwoc-role-badge` — role indicator (viewer/manager) on shared chit cards; `.cwoc-stealth-indicator` — stealth icon on chit cards (visible to owner only) |

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
| Drag Feedback | Visual feedback during card drag operations |
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
| Responsive (≤400px) | Compact chit-specific overrides |
| Responsive (≤480px) | Mobile chit-specific overrides |


---

## 4. Load Order

All JS is loaded via `<script>` tags — no ES modules. Load order matters because later scripts depend on globals defined by earlier ones.

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
```

### 4.2 Editor (`editor.html`)

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

<!-- 2. Shared page components -->
<script src="/frontend/js/pages/shared-page.js"></script>

<!-- 3. (Optional) Shared editor if page uses editor zones -->
<script src="/frontend/js/pages/shared-editor.js"></script>

<!-- 4. Page-specific script -->
<script src="/frontend/js/pages/settings.js"></script>
```

Pages using this pattern: `settings.html`, `people.html`, `contact-editor.html`, `weather.html`, `trash.html`, `audit-log.html`, `help.html`, `profile.html`, `user-admin.html`.

New frontend pages added for multi-user system:
- `login.html` — Standalone login page (no shared header/footer, no `shared-auth.js`). Parchment-themed centered form with username/password inputs.
- `profile.html` — User profile page. Uses `shared-page.css`, `shared-page.js`, `CwocSaveSystem`. Loads `profile.js`.
- `user-admin.html` — Admin-only user management page. Uses `shared-page.css`, `shared-page.js`. Loads `user-admin.js`. Redirects non-admins to `/`.

New frontend pages added for chit sharing system:
- `kiosk.html` — Standalone unauthenticated kiosk page. Reads `users` query parameter from the URL, fetches combined data from `/api/kiosk?user_ids=...`, renders a combined calendar view and task list with `owner_display_name` attribution. Auto-refreshes every 60 seconds. Does not require authentication — no `shared-auth.js` dependency. Uses `shared-page.css` for parchment theme plus inline `<style>` for kiosk-specific layout. All JS is inline in a single IIFE.


---

## 5. File Dependency Map

### 5.1 Backend Python Imports

```
src/backend/main.py
  ├── src.backend.db          (init_db, seed_version_info)
  ├── src.backend.migrations  (all migrate_* functions, including migrate_add_multi_user, migrate_add_sharing)
  ├── src.backend.middleware   (AuthMiddleware)
  ├── src.backend.weather     (start_weather_schedulers)
  └── src.backend.routes.*    (all 9 route modules, including auth_router, users_router, and sharing_router)

src/backend/routes/chits.py
  ├── src.backend.db           (DB_PATH, serialize/deserialize, compute_system_tags, _build_export_envelope)
  ├── src.backend.models       (Chit, ImportRequest)
  ├── src.backend.sharing      (resolve_effective_role, can_edit_chit, can_delete_chit, can_manage_sharing)
  └── src.backend.routes.audit (insert_audit_entry, compute_audit_diff, get_actor_from_request)

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
  └── src.backend.routes.audit (insert_audit_entry, get_actor_from_request)

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

src/backend/weather.py
  └── src.backend.db           (DB_PATH, _update_lock, serialize_json_field)

src/backend/migrations.py
  ├── src.backend.db           (DB_PATH, serialize_json_field)
  └── src.backend.auth_utils   (hash_password — used by migrate_add_multi_user)

src/backend/serializers.py
  └── src.backend.db           (compute_display_name)

src/backend/db.py
  └── (no internal CWOC imports — leaf module)

src/backend/models.py
  └── (no internal CWOC imports — leaf module)
```

**Dependency summary:** `db.py`, `models.py`, and `auth_utils.py` are leaf modules with no internal imports. `routes/audit.py` is imported by `chits.py`, `contacts.py`, `settings.py`, and `health.py` for audit logging. `auth_utils.py` is imported by `routes/auth.py`, `routes/users.py`, and `migrations.py`. `middleware.py` is imported by `main.py`. All route modules import from `db.py`.

### 5.2 Frontend Script Load Dependencies

Scripts are loaded via `<script>` tags. Later scripts depend on globals defined by earlier ones.

```
shared-auth.js            ← MUST load first (getCurrentUser, isAdmin, waitForAuth — auth guard)
  │
  └── shared-utils.js      ← loads after shared-auth.js (getCachedSettings uses waitForAuth)
        │
        ├── shared-touch.js         (standalone — enableTouchDrag)
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
                    ├── shared-page.js    ← depends on shared.js + shared-auth.js (CwocSaveSystem, header/footer injection, user switcher, logout)
                    │     │
                    │     ├── shared-editor.js  ← depends on shared-page.js (zone toggle, dirty tracking)
                    │     │
                    │     └── [page-specific scripts]
                    │           settings.js, people.js, contact-editor.js,
                    │           contact-qr.js, weather.js, profile.js, user-admin.js
                    │
              ├── [dashboard scripts] — all depend on shared.js + shared-page.js
              │     main-sidebar.js
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
- `shared-page.js` must load after `shared.js` (uses `getCurrentUser`, `isAdmin` for user switcher and nav)
- `shared-editor.js` must load after `shared-page.js`
- `editor_checklists.js` and `editor_projects.js` load BEFORE shared scripts in editor.html (they define classes used by shared code)
- `main-init.js` and `main.js` must load last among dashboard scripts
- `editor-init.js` must load last among editor scripts
- `login.html` does NOT load `shared-auth.js` (login page doesn't need auth guard)
