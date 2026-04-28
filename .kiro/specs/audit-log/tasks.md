# Implementation Plan: Audit Log

## Overview

Implement comprehensive change tracking for CWOC. All create, update, and delete operations on chits, contacts, and settings are recorded in an `audit_log` SQLite table. A dedicated audit log page, per-entity audit panels in the editor and contact editor, and log management tools (clear, trim, CSV export) provide full visibility into change history. Backend helpers (`compute_audit_diff`, `get_current_actor`, `insert_audit_entry`) are called explicitly from each CRUD endpoint.

## Tasks

- [x] 1. Create audit log database table and backend helpers
  - [x] 1.1 Add `migrate_add_audit_log()` migration function in `backend/main.py`
    - Create `audit_log` table with columns: `id` (TEXT PK), `entity_type` (TEXT NOT NULL), `entity_id` (TEXT NOT NULL), `action` (TEXT NOT NULL), `actor` (TEXT NOT NULL), `timestamp` (TEXT NOT NULL), `changes` (TEXT), `entity_summary` (TEXT)
    - Create index `idx_audit_entity` on `(entity_type, entity_id)`
    - Create index `idx_audit_timestamp` on `(timestamp)`
    - Use existing column-existence-check pattern; call from startup alongside other migrations
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 1.2 Implement `get_current_actor()` helper function
    - Read `username` from settings table for `default_user`
    - Return `"Unknown Gremlin"` if no username is configured or on any error
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 1.3 Implement `compute_audit_diff(old_dict, new_dict, exclude_fields)` helper function
    - Compare two dictionaries field-by-field
    - Return list of `{"field": str, "old": any, "new": any}` for each differing field
    - Deserialize JSON-serialized fields (tags, checklist, people, alerts, etc.) before comparison
    - Exclude `modified_datetime` and `created_datetime` by default
    - Handle null-to-value and value-to-null transitions
    - Return empty list for non-dict input with a logged warning
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_

  - [x] 1.4 Implement `insert_audit_entry(conn, entity_type, entity_id, action, actor, changes, entity_summary)` helper function
    - Insert a single row with UUID primary key and ISO 8601 timestamp
    - JSON-serialize the `changes` list before storing
    - Wrap in try/except so audit failures never break the parent operation (best-effort)
    - _Requirements: 1.2, 11.2_

- [x] 2. Instrument chit CRUD endpoints with audit logging
  - [x] 2.1 Add audit logging to `PUT /api/chits/{chit_id}` (create path)
    - After inserting a new chit, call `insert_audit_entry` with action `"created"`, entity_type `"chit"`, chit title as entity_summary
    - _Requirements: 3.1_

  - [x] 2.2 Add audit logging to `PUT /api/chits/{chit_id}` (update path)
    - Before updating, fetch the old chit state as a dict
    - After updating, compute diff using `compute_audit_diff` (excluding `modified_datetime`)
    - If diff is non-empty, call `insert_audit_entry` with action `"updated"` and the change details
    - _Requirements: 3.2, 3.4_

  - [x] 2.3 Add audit logging to `DELETE /api/chits/{chit_id}`
    - Before soft-deleting, fetch the chit title
    - Call `insert_audit_entry` with action `"deleted"`, chit title as entity_summary
    - _Requirements: 3.3_

- [x] 3. Instrument contact CRUD endpoints with audit logging
  - [x] 3.1 Add audit logging to `POST /api/contacts` (create)
    - After inserting, call `insert_audit_entry` with action `"created"`, entity_type `"contact"`, display_name as entity_summary
    - _Requirements: 4.1_

  - [x] 3.2 Add audit logging to `PUT /api/contacts/{contact_id}` (update)
    - Fetch old contact state before update, compute diff excluding `modified_datetime`
    - If diff is non-empty, insert audit entry with action `"updated"`
    - _Requirements: 4.2, 4.4_

  - [x] 3.3 Add audit logging to `DELETE /api/contacts/{contact_id}`
    - Fetch display_name before deleting, insert audit entry with action `"deleted"`
    - _Requirements: 4.3_

- [x] 4. Instrument settings endpoint and upgrade tracking with audit logging
  - [x] 4.1 Add audit logging to `POST /api/settings`
    - Fetch current settings before saving, compute diff excluding bookkeeping fields
    - Only insert audit entry if at least one field changed (action `"updated"`, entity_type `"settings"`, entity_id = user_id)
    - Skip audit entry when no fields differ
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 4.2 Add upgrade tracking to `seed_version_info()` and `run_update()`
    - In `seed_version_info()`: if version changed from stored value, insert audit entry with entity_type `"system"`, entity_id `"version"`, action `"updated"`, changes recording old/new version
    - In `run_update()`: after successful update, insert similar audit entry
    - _Requirements: Design — Upgrade Tracking_

- [x] 5. Checkpoint — Ensure backend audit logging works
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement audit log API endpoints
  - [x] 6.1 Implement `GET /api/audit-log` endpoint
    - Accept query params: `entity_type`, `entity_id`, `actor`, `since`, `until`, `limit` (default 50), `offset` (default 0), `sort_by` (default `"timestamp"`), `sort_order` (default `"desc"`)
    - Build SQL query with optional WHERE clauses for each filter
    - Return JSON `{"entries": [...], "total": N}` with `changes` deserialized from JSON
    - Validate `sort_by` against allowed columns, default to `"timestamp"` if invalid
    - Clamp negative limit/offset to 0
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 6.2 Implement `DELETE /api/audit-log` endpoint (clear all)
    - Delete all rows from `audit_log` table
    - Return `{"message": "Audit log cleared", "deleted_count": N}`
    - _Requirements: 11.1 (no update/delete of individual entries — only bulk clear)_

  - [x] 6.3 Implement `DELETE /api/audit-log/trim` endpoint
    - Accept `older_than` query param (values: `"1h"`, `"1d"`, `"1w"`, `"1m"`, `"1y"`)
    - Compute cutoff timestamp, delete entries older than cutoff
    - Return `{"message": "Trimmed entries older than ...", "deleted_count": N}`
    - _Requirements: Design — Log Management_

  - [x] 6.4 Implement `GET /api/audit-log/export` endpoint (CSV download)
    - Accept same filter params as GET (entity_type, actor, since, until) but no limit/offset — export all matching
    - Return CSV file with columns: timestamp, actor, action, entity_type, entity_id, entity_summary, changes
    - Return header-only CSV when no entries match
    - _Requirements: Design — CSV Export_

- [x] 7. Write property-based tests for audit diff helpers
  - [x] 7.1 Write property test: identical dictionaries produce empty diff
    - **Property 1: Identical dictionaries produce empty diff (no false positives)**
    - Generate random dicts with varied field types (str, int, float, bool, None, list, dict), verify `compute_audit_diff(d, d)` returns `[]`
    - Use Python stdlib only (`unittest` + `random`), 100 iterations minimum
    - Test file: `backend/test_audit.py`
    - **Validates: Requirements 5.3, 10.6**

  - [x] 7.2 Write property test: differing dictionaries produce non-empty diff
    - **Property 2: Differing dictionaries produce non-empty diff (no false negatives)**
    - Generate two dicts that differ in at least one tracked field, verify `compute_audit_diff` returns non-empty list with at least one entry for a field that actually differs
    - 100 iterations minimum, stdlib only
    - **Validates: Requirements 10.1, 10.7**

  - [x] 7.3 Write property test: diff excludes bookkeeping fields
    - **Property 3: Diff excludes bookkeeping fields**
    - Generate dicts where `modified_datetime` and `created_datetime` differ, verify those fields never appear in the returned change entries
    - 100 iterations minimum, stdlib only
    - **Validates: Requirements 3.4, 4.4, 10.3**

  - [x] 7.4 Write property test: changes JSON round-trip
    - **Property 4: Changes JSON round-trip**
    - Generate random lists of change detail objects (`{field, old, new}` with varied value types), verify `json.loads(json.dumps(changes))` equals the original
    - 100 iterations minimum, stdlib only
    - **Validates: Requirements 6.5**

- [x] 8. Checkpoint — Ensure all backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Create the global Audit Log frontend page
  - [x] 9.1 Create `frontend/audit-log.html` with sidebar filter panel and sortable table
    - Start from `_template.html` pattern, use `shared-page.css` and `shared-page.js`
    - Sidebar with filters: entity type (All / Chits / Contacts / Settings / System), actor dropdown, date range (since/until), page size selector (25 / 50 / 100 / 500)
    - Sortable table with columns: timestamp, actor, action, entity type, entity summary
    - Clickable column headers toggle asc/desc sort
    - Each row has expandable details toggle showing Change_Detail diff (field, old → new)
    - Toolbar above table: "Download CSV" button, trim dropdown (Past Hour / Day / Week / Month / Year), "Clear All" danger button
    - Trim and Clear use confirmation modals matching chit editor delete confirmation pattern
    - "Load More" pagination button at bottom respecting selected page size
    - Follow 1940s parchment/magic aesthetic with brown tones and Courier New font
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 11.3_

  - [x] 9.2 Add Audit Log navigation link to the shared page header
    - Add an "Audit Log" entry to the navigation buttons in `shared-page.js` so it appears in the header of all secondary pages
    - _Requirements: 7.7_

- [x] 10. Add per-entity audit panels to editor and contact editor
  - [x] 10.1 Add Audit Panel to `frontend/editor.html`
    - Add a collapsible zone section (matching existing zone pattern) for audit history
    - Collapsed by default
    - On chit load, fetch `GET /api/audit-log?entity_type=chit&entity_id={chit_id}` and render entries
    - Each entry shows timestamp, actor, action as a compact row with expandable Change_Detail
    - Show "No audit history for this chit" when empty
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [x] 10.2 Add Audit Panel to `frontend/contact-editor.html`
    - Same pattern as chit editor audit panel but for contacts
    - Fetch `GET /api/audit-log?entity_type=contact&entity_id={contact_id}`
    - Show "No audit history for this contact" when empty
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [x] 11. Add System block to settings page and update help documentation
  - [x] 11.1 Add "System" setting-group block to `frontend/settings.html`
    - Add a new `setting-group` block titled "System" with a link/button to the Audit Log page
    - _Requirements: Design — Settings Page System Block_

  - [x] 11.2 Update `frontend/help.html` with Audit Log documentation
    - Add "Audit Log" section to the help content and table of contents
    - Document what actions are tracked (create, update, delete) and for which entities (chits, contacts, settings, system upgrades)
    - Document how to access the global audit log page and per-entity audit panels
    - Document that the actor field reflects the username configured in settings (defaults to "Unknown Gremlin")
    - Document log management features (clear, trim, CSV export)
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

- [x] 12. Update VERSION file
  - Run `date "+%Y%m%d.%H%M"` and update the `VERSION` file with the current timestamp
  - _Requirements: Steering rule — Versioning.md_

- [x] 13. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document using Python stdlib only (unittest + random) — NO hypothesis or external test frameworks
- All backend code goes in `backend/main.py`; all tests in `backend/test_audit.py`
- No pip installs, no npm installs — stdlib only throughout
