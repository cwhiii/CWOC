# Implementation Plan: Email Integration

## Overview

This plan adds a basic email client to CWOC by treating emails as chits with email-specific fields. The implementation uses Python's stdlib `imaplib`, `smtplib`, and `email` modules to connect to an external Gmail server (MVP), with CWOC's FastAPI backend as the API layer and SQLite as the local cache/store. The work is ordered to build foundational layers first (database, models, validation) before adding features that depend on them (sync, send, UI).

**Language:** Python (backend), vanilla JavaScript/HTML/CSS (frontend)

**No software installs on the dev machine.** The `cryptography` package is installed on the server only via `configurinator.sh` and `cwoc-push.sh`. All tests use Python's built-in `unittest` module.

## Tasks

- [x] 1. Database migrations — add email columns to chits table and email_account to settings
  - [x] 1.1 Add `migrate_add_email_fields()` function to `src/backend/migrations.py`
    - Add 13 email columns to `chits` table: `email_message_id` (TEXT), `email_from` (TEXT), `email_to` (TEXT), `email_cc` (TEXT), `email_bcc` (TEXT), `email_subject` (TEXT), `email_body_text` (TEXT), `email_date` (TEXT), `email_folder` (TEXT), `email_status` (TEXT), `email_read` (BOOLEAN), `email_in_reply_to` (TEXT), `email_references` (TEXT)
    - Add `email_account` (TEXT) column to `settings` table
    - Follow the existing column-existence-check pattern (`PRAGMA table_info` → check → `ALTER TABLE`)
    - _Requirements: 6.1, 6.2_
  - [x] 1.2 Register the migration in `src/backend/main.py`
    - Import `migrate_add_email_fields` from `migrations.py`
    - Call it in the migration sequence after `migrate_add_contact_dates()`
    - _Requirements: 6.2_
  - [ ]* 1.3 Write unit tests for the email migration
    - Test in `src/backend/test_email.py` using `unittest`
    - Test that migration runs without error on a fresh DB
    - Test that migration is idempotent (running twice doesn't fail)
    - Test that all 13 email columns exist on chits table after migration
    - Test that `email_account` column exists on settings table after migration
    - _Requirements: 6.2_

- [x] 2. Backend models — add email fields to Chit and email_account to Settings
  - [x] 2.1 Add email fields to the `Chit` Pydantic model in `src/backend/models.py`
    - Add all 13 optional email fields: `email_message_id`, `email_from`, `email_to`, `email_cc`, `email_bcc`, `email_subject`, `email_body_text`, `email_date`, `email_folder`, `email_status`, `email_read`, `email_in_reply_to`, `email_references`
    - All fields `Optional` with `None` default
    - _Requirements: 6.1, 6.5_
  - [x] 2.2 Add `email_account` field to the `Settings` Pydantic model in `src/backend/models.py`
    - `email_account: Optional[str] = None` — JSON string containing email config
    - _Requirements: 1.2_
  - [x] 2.3 Update chit serialization/deserialization in `src/backend/routes/chits.py`
    - In `get_all_chits`, `get_chit`, and `search_chits`: deserialize `email_to`, `email_cc`, `email_bcc` via `deserialize_json_field`; convert `email_read` to `bool`
    - In `create_chit` and `update_chit`: serialize `email_to`, `email_cc`, `email_bcc` via `serialize_json_field`; include all email columns in INSERT/UPDATE SQL
    - _Requirements: 6.1, 6.3_
  - [x] 2.4 Update settings serialization in `src/backend/routes/settings.py`
    - In `get_settings`: deserialize `email_account` via `deserialize_json_field`
    - In `save_settings`: include `email_account` in the INSERT OR REPLACE SQL (preserve existing value if not provided, like `shared_tags`)
    - _Requirements: 1.2_

- [x] 3. Reserved tag namespace enforcement — protect `CWOC_System/` prefix
  - [x] 3.1 Add backend validation helpers
    - Add `RESERVED_TAG_PREFIX = "cwoc_system/"` constant and `_strip_reserved_tags(tags)` / `_validate_tag_name(name)` functions to `src/backend/routes/chits.py`
    - `_strip_reserved_tags`: filter out any tags whose `.lower()` starts with the prefix
    - `_validate_tag_name`: return `False` if name starts with prefix (case-insensitive)
    - _Requirements: 11.1, 11.2, 11.4_
  - [x] 3.2 Enforce in chit create/update routes
    - In `create_chit` and `update_chit` in `src/backend/routes/chits.py`: strip `CWOC_System/` tags from user-submitted `chit.tags` before passing to `compute_system_tags`. System tags are computed separately and merged.
    - _Requirements: 11.2, 11.4_
  - [x] 3.3 Enforce in settings save route
    - In `save_settings` in `src/backend/routes/settings.py`: before saving, check each tag in `settings.tags` list — if any tag's `name` starts with `CWOC_System/` (case-insensitive), return 400 with the specified error message
    - _Requirements: 11.1, 11.4_
  - [x] 3.4 Add frontend validation for tag creation
    - In `src/frontend/js/pages/settings.js`: validate tag name on creation, show inline error if it starts with `CWOC_System/`
    - In `src/frontend/js/shared/shared-tags.js` (or wherever inline tag creation lives): validate tag name before submission, show inline error
    - _Requirements: 11.3_
  - [ ]* 3.5 Write unit tests for reserved tag namespace
    - Test in `src/backend/test_email.py` using `unittest`
    - Test `_validate_tag_name` returns False for `CWOC_System/Email`, `cwoc_system/Foo`, `CWOC_SYSTEM/Bar`, `Cwoc_System/X`
    - Test `_validate_tag_name` returns True for `MyTag`, `System`, `cwoc_email`
    - Test `_strip_reserved_tags` removes reserved tags and preserves non-reserved tags in order
    - _Requirements: 11.1, 11.2, 11.4_

- [x] 4. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Crypto module — Fernet encryption with graceful fallback
  - [x] 5.1 Create crypto helper functions in `src/backend/routes/email.py`
    - Implement `_get_or_create_fernet_key()`: load key from `/app/data/email.key` or generate + save a new one
    - Implement `_get_fernet()`: return a `Fernet` instance (import `cryptography.fernet` with `try/except ImportError` — if not available, fall back to base64 obfuscation)
    - Implement `_encrypt_password(plaintext) -> str` and `_decrypt_password(ciphertext) -> str`
    - Graceful fallback: if `cryptography` is not installed (dev machine), use base64 encoding as a non-secure fallback with a logged warning
    - Key file path: `/app/data/email.key` (production) with a dev fallback to `data/email.key`
    - _Requirements: 1.5_
  - [ ]* 5.2 Write unit tests for password encryption round-trip
    - Test in `src/backend/test_email.py` using `unittest`
    - Test encrypt then decrypt returns original password for various strings (empty, unicode, special chars)
    - Test that the fallback (base64) path works when `cryptography` is not available
    - _Requirements: 1.5_

- [x] 6. System tag integration — add `CWOC_System/Email` to `compute_system_tags`
  - [x] 6.1 Update `compute_system_tags` in `src/backend/db.py`
    - Add check: if `getattr(chit, 'email_message_id', None)` or `getattr(chit, 'email_status', None)`, append `"CWOC_System/Email"` to system_tags
    - This triggers for both received emails (have message_id) and drafts (have email_status)
    - _Requirements: 2.4, 6.4_
  - [ ]* 6.2 Write unit tests for email system tag computation
    - Test in `src/backend/test_email.py` using `unittest`
    - Test that a chit with `email_message_id` set gets `CWOC_System/Email` tag
    - Test that a chit with `email_status="draft"` (no message_id) gets the tag
    - Test that a chit with neither field does NOT get the tag
    - Test that all other system tags are computed identically to pre-email behavior
    - _Requirements: 2.4, 6.4, 6.5_

- [x] 7. Email sync engine — IMAP fetch, parse, store
  - [x] 7.1 Implement IMAP connection and sync functions in `src/backend/routes/email.py`
    - `_connect_imap(account: dict) -> imaplib.IMAP4_SSL`: connect and authenticate to IMAP server
    - `_get_last_sync_date(cursor, owner_id: str) -> str`: query most recent `email_date` for this user's email chits
    - `_fetch_new_messages(imap, since_date: str) -> list`: SEARCH SINCE + FETCH RFC822
    - Use IMAP `SEEN` flag to set `email_read` field
    - _Requirements: 2.1, 2.7_
  - [x] 7.2 Implement email parsing functions
    - `_parse_email_message(raw_bytes: bytes) -> dict`: parse MIME message, extract From, To, Cc, Subject, Date, Message-ID, In-Reply-To, References headers
    - `_extract_text_from_message(msg) -> str`: walk MIME parts, prefer text/plain, fallback to stripping HTML tags from text/html
    - Parse email `Date` header and store as chit's `start_datetime` (ISO 8601)
    - _Requirements: 2.2, 2.3, 2.5_
  - [x] 7.3 Implement chit creation from parsed email
    - `_create_email_chit(cursor, parsed: dict, owner_id: str)`: INSERT into chits table with all email fields populated, `email_folder="inbox"`, `email_status="received"`, auto-compute system tags
    - Deduplication: check `email_message_id` doesn't already exist before inserting
    - _Requirements: 2.1, 2.2_
  - [x] 7.4 Implement backfill estimation function
    - `_estimate_backfill(account: dict) -> dict`: connect to IMAP, count total messages, estimate storage size, return `{message_count, estimated_mb}`
    - _Requirements: 1.7_
  - [ ]* 7.5 Write unit tests for email parsing
    - Test in `src/backend/test_email.py` using `unittest`
    - Test `_parse_email_message` with a constructed RFC 2822 message — verify all fields extracted correctly
    - Test `_extract_text_from_message` with plain-text and multipart messages
    - Test reply/forward subject prefix logic (no "Re: Re:" doubling)
    - Test deduplication logic (same Message-ID not inserted twice)
    - _Requirements: 2.2, 2.3, 2.5_

- [x] 8. Email send module — SMTP compose, send
  - [x] 8.1 Implement SMTP connection and send functions in `src/backend/routes/email.py`
    - `_connect_smtp(account: dict) -> smtplib.SMTP`: connect with STARTTLS and authenticate
    - `_build_rfc2822_message(chit: dict, account: dict) -> email.message.EmailMessage`: construct valid RFC 2822 message from chit fields using Python's `email.message` stdlib
    - `_send_email(smtp, message, from_addr)`: send and capture server-assigned Message-ID
    - _Requirements: 3.1, 3.5_
  - [x] 8.2 Implement reply and forward helpers
    - `_prepare_reply(original_chit: dict, account: dict) -> dict`: create reply draft data with `email_to` set to original sender, `email_in_reply_to` set to original Message-ID, subject prefixed with "Re: " (no doubling), original body quoted below separator
    - `_prepare_forward(original_chit: dict) -> dict`: create forward draft data with empty `email_to`, subject prefixed with "Fwd: " (no doubling), original body quoted below separator
    - _Requirements: 3.4, 4.4, 4.5_
  - [ ]* 8.3 Write unit tests for message construction and send flow
    - Test in `src/backend/test_email.py` using `unittest`
    - Test `_build_rfc2822_message` produces valid message with correct headers
    - Test reply subject prefix logic (no "Re: Re:" doubling)
    - Test forward subject prefix logic (no "Fwd: Fwd:" doubling)
    - Test that send failure leaves chit status as "draft"
    - _Requirements: 3.2, 3.3, 3.4, 3.5_

- [x] 9. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Backend email routes — FastAPI router with all endpoints
  - [x] 10.1 Create `src/backend/routes/email.py` router scaffold and register it
    - Create `email_router = APIRouter()` with all endpoint stubs
    - Import and register in `main.py`: `from src.backend.routes.email import email_router` + `app.include_router(email_router)`
    - Add pre-config guard: if any email endpoint is called before `email_account` is configured, return 400 with `"No email account configured. Go to Settings → Email Account to set up your email."`
    - _Requirements: 10.1, 10.6_
  - [x] 10.2 Implement `POST /api/email/sync` endpoint
    - Load email_account credentials from settings, decrypt password, call sync engine
    - Return `{new_count: int}` on success
    - Handle IMAP errors with descriptive messages (401, 502, 504)
    - _Requirements: 10.2, 2.1, 2.6_
  - [x] 10.3 Implement `POST /api/email/send/{chit_id}` endpoint
    - Load chit, verify it's a draft, load credentials, decrypt password, build message, send via SMTP
    - On success: update chit `email_status` to "sent", `email_folder` to "sent", populate `email_message_id`
    - On failure: return error, leave chit as draft
    - Validate non-empty `email_to` before sending (422 if empty)
    - _Requirements: 10.3, 3.1, 3.2, 3.3_
  - [x] 10.4 Implement `PATCH /api/email/{chit_id}/read` endpoint
    - Set `email_read` to true on the specified email chit
    - _Requirements: 10.4, 8.1_
  - [x] 10.5 Implement `POST /api/email/test-connection` endpoint
    - Accept credentials from request body (or use saved settings)
    - Test IMAP connection (connect + login + logout)
    - Test SMTP connection (connect + STARTTLS + login + quit)
    - Return success/failure for each with descriptive error messages
    - _Requirements: 10.5, 1.3, 1.4_
  - [x] 10.6 Implement `POST /api/email/backfill-estimate` endpoint
    - Call `_estimate_backfill` and return `{message_count, estimated_mb}`
    - _Requirements: 1.7_
  - [ ]* 10.7 Write unit tests for email routes
    - Test in `src/backend/test_email.py` using `unittest`
    - Test that endpoints return 400 when no email account is configured
    - Test that send endpoint returns 400 for non-draft chits
    - Test that send endpoint returns 422 for empty To field
    - Test mark-as-read endpoint updates `email_read` field
    - _Requirements: 10.2, 10.3, 10.4, 10.5, 10.6_

- [x] 11. Email zone in chit editor — HTML + JS + CSS
  - [x] 11.1 Add Email zone HTML to `src/frontend/html/editor.html`
    - Add `<div id="emailSection" class="zone collapsed">` with zone header (toggle icon, title "✉️ Email", Send/Reply/Forward buttons), and zone content with From (read-only), To, Cc, Bcc input fields, and Body textarea
    - Follow the existing zone pattern (like Notes, Dates, Tags zones)
    - Include expand button in header like Notes zone
    - _Requirements: 4.1, 4.8_
  - [x] 11.2 Create `src/frontend/js/editor/editor-email.js`
    - `initEmailZone(chit)`: populate email fields from chit data, show/hide Send vs Reply/Forward buttons based on `email_status`
    - `getEmailData()`: collect email field values for save (serialize To/Cc/Bcc as arrays)
    - `hasEmailData(chit)`: check if chit has email data (for `applyZoneStates` auto-expand)
    - `_emailReply(chit)`: create reply draft chit via API, navigate to editor
    - `_emailForward(chit)`: create forward draft chit via API, navigate to editor
    - `_emailSend(chitId)`: call `POST /api/email/send/{id}`, show success/error toast
    - `_setEmailZoneReadOnly(readOnly)`: toggle field editability based on email_status
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_
  - [x] 11.3 Create `src/frontend/css/editor/editor-email.css`
    - Style the email zone using existing parchment theme variables, Lora font, brown-tone palette
    - Tag-chip style for recipient fields (To, Cc, Bcc) consistent with existing tag/people chips
    - Full-width layout on small screens for mobile-friendliness
    - _Requirements: 9.1, 9.3, 4.8_
  - [x] 11.4 Integrate email zone into editor save/load flow
    - In `editor-save.js`: include email fields from `getEmailData()` in the save payload
    - In `editor-init.js`: call `initEmailZone(chit)` during editor initialization; add `editor-email.js` and `editor-email.css` to `editor.html` script/link tags
    - Wire `applyZoneStates` to auto-expand email zone when chit has email data, auto-collapse when it doesn't
    - Auto-mark email as read when opening an email chit (call `PATCH /api/email/{id}/read`)
    - _Requirements: 4.2, 4.7, 8.1_

- [x] 12. Email dashboard tab — main-email.js + tab bar integration
  - [x] 12.1 Add Email tab to dashboard tab bar in `src/frontend/html/index.html`
    - Add "Email" tab button with icon + label, following existing tab pattern
    - Add keyboard shortcut for the Email tab
    - _Requirements: 5.1_
  - [x] 12.2 Create `src/frontend/js/dashboard/main-email.js`
    - `displayEmailView(chitsToDisplay)`: render email list sorted by `email_date` descending, showing sender, subject (title), date, read/unread status
    - `_buildEmailRow(chit)`: build a single email row element using `chit-card` CSS class with email-specific additions
    - `_emailSubFilter` state and `_setEmailSubFilter(filter)`: switch between Inbox (default), By Tag, Drafts, Trash
    - `_checkMail()`: call `POST /api/email/sync`, show toast with count, refresh list
    - `_composeEmail()`: navigate to editor with `?new=email` param to create draft chit
    - `_getUnreadCount()`: return count of unread inbox emails for badge
    - Empty state with "Compose" button when no email chits exist, following `_emptyState` pattern
    - Bold text + distinct background for unread emails
    - Mobile-friendly compact single-column layout on small screens
    - _Requirements: 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10_
  - [x] 12.3 Integrate email tab into dashboard dispatch
    - In `main-views.js`: add Email tab to `filterChits()` dispatch — filter for chits with email data, pass to `displayEmailView`
    - Add `main-email.js` script tag to `index.html`
    - Update unread badge on chit fetch
    - Add email-specific sub-filter control (only visible when Email tab is active)
    - _Requirements: 5.1, 5.2, 5.7, 8.2_
  - [x] 12.4 Add email tab CSS styles
    - Add email row styles to dashboard CSS (read/unread distinction, sender/subject layout)
    - Style email sub-filter control
    - Style unread count badge on tab
    - Follow existing `chit-card` pattern with email-specific additions
    - _Requirements: 9.2, 5.3_

- [x] 13. Email deletion and restore — trash integration
  - [x] 13.1 Implement email delete behavior
    - When deleting an email chit: set `email_folder` to "trash" AND `deleted` to true (existing soft-delete)
    - When restoring an email chit from trash: set `email_folder` back to "inbox" AND clear `deleted` flag
    - Update trash restore logic in `src/backend/routes/trash.py` to handle `email_folder` reset
    - _Requirements: 7.1, 7.2, 7.3_

- [x] 14. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 15. Settings page email account section
  - [x] 15.1 Add "Email Account" section to `src/frontend/html/settings.html`
    - Add fields: email address, display name, IMAP host, IMAP port, SMTP host, SMTP port, username, password
    - Pre-populate with Gmail defaults (`imap.gmail.com:993`, `smtp.gmail.com:587`)
    - Password field masked with show/hide toggle
    - "Test Connection" button with inline success/failure indicator
    - "Backfill" button that first shows estimation, then confirmation warning before proceeding
    - _Requirements: 1.1, 1.3, 1.6, 1.7_
  - [x] 15.2 Add settings page JavaScript for email account
    - In `src/frontend/js/pages/settings.js`: load/save email_account JSON from/to settings API
    - Wire "Test Connection" button to `POST /api/email/test-connection`
    - Wire "Backfill" button to `POST /api/email/backfill-estimate` first, then show warning modal with message count and estimated size, then trigger full sync on confirm
    - Encrypt password before saving (send plaintext to backend, backend encrypts)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.7_

- [x] 16. Deployment script updates — configurinator.sh + cwoc-push.sh
  - [x] 16.1 Update `install/configurinator.sh` to install `cryptography` package
    - Add `cryptography` to the `required_pkgs` variable in the `install_python_deps()` function
    - This ensures the package is installed in the server venv at `/app/venv/`
    - _Requirements: 1.5_
  - [x] 16.2 Update `cwoc-push.sh` to install `cryptography` on push
    - Add a step after rsync that runs `ssh "$SERVER" "/app/venv/bin/pip install cryptography -q"` to ensure the package is present after code push
    - _Requirements: 1.5_

- [x] 17. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 18. Update INDEX.md, version, and release notes
  - [x] 18.1 Update `src/INDEX.md` with all new files and functions
    - Add entries for `src/backend/routes/email.py` (all endpoints and internal functions)
    - Add entries for `src/frontend/js/dashboard/main-email.js` (all functions)
    - Add entries for `src/frontend/js/editor/editor-email.js` (all functions)
    - Add entries for `src/frontend/css/editor/editor-email.css`
    - Update entries for modified files: `models.py`, `migrations.py`, `main.py`, `db.py`, `routes/chits.py`, `routes/settings.py`, `routes/trash.py`
    - _Requirements: all_
  - [x] 18.2 Update `src/VERSION` with current timestamp
    - Run `date "+%Y%m%d.%H%M"` and write the result to `src/VERSION`
    - _Requirements: all_
  - [x] 18.3 Create release notes
    - Create `documents/release_notes/cwoc_release_{version}.md` with a brief summary of the email integration feature
    - _Requirements: all_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- **No software installs on the dev machine** — the `cryptography` package is server-only; code uses `try/except ImportError` with base64 fallback
- All tests use Python's built-in `unittest` module only — no hypothesis, no pytest, no external test libraries
- Property-based tests are NOT included per project constraints (no hypothesis available)
- The version update and INDEX.md update are the LAST task per project conventions
