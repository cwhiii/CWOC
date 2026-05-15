# Implementation Plan: Mobile Sync Preparation (Server-Side)

## Overview

Add sync version tracking, sync API endpoints, device token authentication, conflict resolution, and tombstone retention to the CWOC backend. These changes prepare the server for the upcoming Android mobile app while maintaining full backward compatibility with the existing web app.

All changes are backend Python (FastAPI/SQLite). No frontend changes. No installations. No npm/pip.

## Tasks

- [x] 1. Database migrations — sync infrastructure
  - [x] 1.1 Add `sync_version` column to chits table
    - Add migration function `migrate_add_sync_version()` in `src/backend/migrations.py`
    - Add `sync_version INTEGER DEFAULT 0` to chits table (with existence check)
    - Add `has_unviewed_conflict BOOLEAN DEFAULT 0` to chits table (with existence check)
    - Add `sync_version INTEGER DEFAULT 0` to contacts table (with existence check)
    - Add `sync_version INTEGER DEFAULT 0` to settings table (with existence check)
    - Create index `idx_chits_sync_version` on chits(sync_version)
    - Create index `idx_chits_owner_sync` on chits(owner_id, sync_version)
    - Create index `idx_contacts_sync_version` on contacts(sync_version)
    - _Requirements: 1.1, 1.4, 4.1_

  - [x] 1.2 Create `sync_state` table (global counter)
    - Create table with single row: `id INTEGER PRIMARY KEY CHECK (id = 1), next_version INTEGER NOT NULL DEFAULT 1`
    - Insert initial row: `INSERT OR IGNORE INTO sync_state (id, next_version) VALUES (1, 1)`
    - _Requirements: 1.4_

  - [x] 1.3 Create `device_tokens` table
    - Create table: id TEXT PK, user_id TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, device_name TEXT, created_datetime TEXT, last_seen_datetime TEXT, last_sync_version INTEGER DEFAULT 0, revoked BOOLEAN DEFAULT 0
    - Create index `idx_device_tokens_user` on device_tokens(user_id)
    - Create index `idx_device_tokens_hash` on device_tokens(token_hash)
    - _Requirements: 5.5_

  - [x] 1.4 Register migration in `main.py` startup sequence
    - Call the new migration function from the startup migration block in `src/backend/main.py`
    - Ensure idempotency (safe to run multiple times)
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 1.5 Backfill existing records with sync versions
    - In the migration, after adding columns, backfill all existing chits/contacts/settings with sequential sync_version values based on `modified_datetime` order
    - Update `sync_state.next_version` to be 1 higher than the max assigned version
    - This ensures existing data is properly ordered for clients doing their first full sync
    - _Requirements: 1.4, 2.4_

- [x] 2. Sync version helper and integration with existing CRUD
  - [x] 2.1 Create `get_next_sync_version()` helper in `src/backend/db.py`
    - Function takes a cursor, atomically increments `sync_state.next_version`, returns the previous value
    - Must be called within the same transaction as the record write
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 2.2 Integrate sync_version into chit create/update in `src/backend/routes/chits.py`
    - In the POST (create) handler: call `get_next_sync_version()`, include `sync_version` in the INSERT statement
    - In the PUT (update) handler: call `get_next_sync_version()`, include `sync_version` in the UPDATE statement
    - In the soft-delete handler: call `get_next_sync_version()`, update `sync_version` when setting deleted flag
    - Include `sync_version` and `has_unviewed_conflict` in all GET responses (single chit and list)
    - _Requirements: 1.1, 1.2, 1.3, 1.5_

  - [x] 2.3 Integrate sync_version into contacts create/update in `src/backend/routes/contacts.py`
    - Same pattern as chits: assign sync_version on create, update, and delete
    - Include `sync_version` in GET responses
    - _Requirements: 8.1_

  - [x] 2.4 Integrate sync_version into settings update in `src/backend/routes/settings.py`
    - Assign sync_version on every settings write
    - Include `sync_version` in GET response
    - _Requirements: 8.2_

- [x] 3. Device token authentication
  - [x] 3.1 Create `src/backend/routes/devices.py` route module
    - `POST /api/auth/device-token` — accepts {username, password, device_name}, validates credentials, generates token via `secrets.token_urlsafe(32)`, stores sha256 hash in device_tokens table, returns raw token (one time only)
    - `GET /api/devices` — returns all non-revoked device tokens for authenticated user (id, device_name, created_datetime, last_seen_datetime, last_sync_version — NOT the token itself)
    - `DELETE /api/devices/{device_id}` — sets revoked=1 on the device token
    - `PATCH /api/devices/{device_id}` — updates device_name
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 3.2 Extend auth middleware to support Bearer tokens
    - In `src/backend/middleware.py`, after the session cookie check fails, check for `Authorization: Bearer <token>` header
    - Hash the provided token with sha256, look up in device_tokens table
    - If found and not revoked: set `request.state.user_id` and `request.state.username` from the associated user record
    - Update `last_seen_datetime` on the device_tokens row
    - If not found or revoked: fall through to existing 401 behavior
    - Add `/api/auth/device-token` to the excluded paths list (it needs username/password auth, not token auth)
    - _Requirements: 5.6, 5.7_

  - [x] 3.3 Register devices route module in `main.py`
    - Import and include the devices router
    - _Requirements: 5.1, 6.1_

- [x] 4. Sync pull endpoint
  - [x] 4.1 Create `src/backend/routes/sync.py` route module
    - `GET /api/sync/changes?since={version}&include=chits,contacts,settings`
    - Query chits where `sync_version > since` AND (owner_id = user_id OR shared with user)
    - Query contacts where `sync_version > since` AND owner_id = user_id (if "contacts" in include)
    - Query settings where `sync_version > since` AND user_id = user_id (if "settings" in include)
    - Return `{server_version: <current max>, chits: [...], contacts: [...], settings: {...}}`
    - Include soft-deleted chits (they need to sync so the client knows to delete locally)
    - Deserialize JSON fields same as existing chit list endpoint
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 8.3_

  - [x] 4.2 Register sync route module in `main.py`
    - Import and include the sync router
    - _Requirements: 2.1_

- [x] 5. Sync push endpoint with conflict resolution
  - [x] 5.1 Implement `POST /api/sync/push` in `src/backend/routes/sync.py`
    - Accept JSON body: `{chits: [...], contacts: [...], settings: {...}}`
    - For each chit in the push:
      - If ID doesn't exist on server: INSERT (create) with new sync_version
      - If ID exists and server's sync_version <= client's last known version: UPDATE with new sync_version
      - If ID exists and server's sync_version > client's last known version: CONFLICT — call conflict resolver
    - Return per-record status: accepted, created, merged, or error
    - Broadcast all changes via existing WebSocket sync hub
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.7, 3.8, 3.9_

  - [x] 5.2 Implement field-level conflict resolution
    - Define the list of mergeable fields (title, note, tags, status, priority, checklist, etc.)
    - For each conflicting field: compare modified_datetime, take the later value (LWW)
    - Set `has_unviewed_conflict = true` on the merged record
    - Return list of conflict_fields in the response
    - _Requirements: 3.4, 3.5, 3.6, 4.2_

  - [x] 5.3 Write audit log entries for conflicts
    - For each resolved conflict, insert an audit_log entry with:
      - `action = "sync_conflict_resolved"`
      - `entity_type = "chit"` (or "contact")
      - `entity_id = <chit uuid>`
      - `actor = "device:<device_name>"`
      - `changes` JSON containing: field name, server_value, client_value, resolved_to ("server" or "client")
    - _Requirements: 3.5, 4.5, 4.6_

  - [x] 5.4 Implement contacts and settings push handling
    - Contacts: same field-level merge as chits
    - Settings: LWW on entire record (no field-level merge)
    - _Requirements: 8.4, 8.5, 8.6_

- [x] 6. Conflict dismissal endpoint
  - [x] 6.1 Add `POST /api/chit/{id}/dismiss-conflict` endpoint
    - Sets `has_unviewed_conflict = false` on the specified chit
    - Verify the authenticated user owns or has manager access to the chit
    - Assign new sync_version (so other devices see the flag change)
    - _Requirements: 4.3, 4.4_

- [x] 7. Tombstone retention
  - [x] 7.1 Modify trash purge logic in `src/backend/routes/trash.py`
    - Before hard-deleting a record, check if all non-revoked devices for that user have `last_sync_version >= chit.sync_version`
    - If any active device hasn't synced past it, skip the purge for that record
    - Devices with `last_seen_datetime` older than 90 days are excluded from this check (stale devices don't block cleanup)
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 8. Update `last_sync_version` on device after successful pull
  - [x] 8.1 In the sync pull endpoint, after returning results, update the device_tokens row
    - Set `last_sync_version` to the `server_version` value returned in the response
    - This requires knowing which device made the request (from the Bearer token lookup in middleware)
    - Add `request.state.device_id` in the middleware when authenticating via device token
    - _Requirements: 5.8_

- [x] 9. Checkpoint — verify all endpoints work together
  - Manually verify (or describe test scenarios):
    - Create a chit via existing API → sync_version is assigned
    - Pull changes with since=0 → all chits returned with sync_versions
    - Push a new chit → created on server with sync_version
    - Push an edit to existing chit (no conflict) → updated
    - Push an edit to a chit that was also edited on server → conflict resolved, audit entry created, has_unviewed_conflict set
    - Dismiss conflict → flag cleared
    - Device token creation, listing, revocation all work
    - Trash purge respects tombstone retention

- [x] 10. Documentation updates
  - [x] 10.1 Update help documentation
    - Add documentation for the new device management feature (if exposed in web UI later)
    - Document the sync conflict notification behavior (banner on chit, link to audit log)
    - _Requirements: all_

  - [x] 10.2 Update `src/INDEX.md` with new files and functions
    - Add `routes/sync.py` with all functions
    - Add `routes/devices.py` with all functions
    - Add `get_next_sync_version()` in db.py
    - Update `migrations.py` entry with new migration function
    - Update `middleware.py` entry with Bearer token auth

  - [x] 10.3 Update version number
    - Run `date "+%Y%m%d.%H%M"` and update `src/VERSION`
    - Add release notes entry

## Notes

- All tasks are backend-only — no frontend changes, no installations, no pip/npm
- The web app continues to work without modification (new fields are ignored by existing frontend code)
- The web app will eventually get a "Manage Devices" UI in settings, but that's a separate task (not part of this spec)
- The web app will eventually show the conflict notification banner in the editor, but that's also separate
- Tests are optional per project conventions
- The sync push endpoint is the most complex piece — take extra care with the conflict resolution logic and ensure the audit entries contain enough information for the future cherry-pick UI
