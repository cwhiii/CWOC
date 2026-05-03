# Implementation Plan: Data Management Overhaul

## Overview

Replace the flat export/import buttons in CWOC Settings with a modal-driven, two-tier data management system. The per-user tier provides category selection and tag-based filtering scoped to the current user's data. The admin tier adds cross-user exports with owner/tag filters, raw SQLite backup, and full database restore. Implementation order: Pydantic models → backend route module → route registration → frontend JS modal logic → settings.html updates → CSS → property tests → help docs → legacy cleanup → INDEX.md + VERSION + release notes.

## Tasks

- [ ] 1. Add new Pydantic models to `models.py`
  - Add `ExportRequest` model with fields: `categories` (List[str]), `filters` (Optional[Dict[str, Any]]), `scope` (str, default "user")
  - Add `ImportRequestV2` model with fields: `category` (str), `mode` (str), `scope` (str, default "user"), `data` (dict)
  - Place both models after the existing `ImportRequest` class
  - _Requirements: 13.1, 14.1_

- [ ] 2. Create backend route module `src/backend/routes/data_management.py`
  - [ ] 2.1 Create the file with FastAPI router and implement internal helpers
    - Create `router = APIRouter()` with the data management endpoints
    - Implement `_require_admin(request)` helper that checks `request.state.is_admin` and raises HTTP 403 with "Admin access required" if not admin, returns `user_id`
    - Implement `_build_new_export_envelope(categories, filters_applied, data)` that extends the existing `_build_export_envelope` pattern from `db.py` with `categories` and `filters_applied` fields
    - Implement `_validate_sqlite_file(file_path)` that checks SQLite magic bytes (`b"SQLite format 3\x00"`) and runs `PRAGMA integrity_check`
    - _Requirements: 13.5, 16.1, 12.8_

  - [ ] 2.2 Implement export helper functions
    - Implement `_export_chits(cursor, owner_ids, tag_filter)` — query chits with optional `owner_id IN (...)` and Python-side tag filtering using `deserialize_json_field`, deserialize all JSON fields (tags, checklist, people, child_chits, alerts, recurrence_rule, recurrence_exceptions, shares, weather_data, health_data)
    - Implement `_export_contacts(cursor, owner_ids, tag_filter)` — query contacts with optional owner filtering and Python-side tag filtering, deserialize JSON fields (phones, emails, addresses, call_signs, x_handles, websites, dates, tags)
    - Implement `_export_settings(cursor, owner_ids)` — query settings with optional owner filtering, deserialize JSON fields (tags, custom_colors, visual_indicators, chit_options, default_filters, default_notifications, shared_tags, kiosk_users)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 13.6_

  - [ ] 2.3 Implement import helper functions
    - Implement `_import_chits(cursor, records, user_id, mode, scope)` — in "replace" mode, delete existing chits for the user (or all if admin scope) then insert; in "add" mode, insert with new UUIDs; set `owner_id` to the authenticated user for user-scope imports
    - Implement `_import_contacts(cursor, records, user_id, mode, scope)` — same add/replace logic for contacts
    - Implement `_import_settings(cursor, records, user_id, mode, scope)` — same add/replace logic for settings
    - _Requirements: 5.4, 5.5, 14.2, 14.3_

  - [ ] 2.4 Implement `POST /api/export` endpoint
    - Accept `ExportRequest` body, validate categories are in ["chits", "people", "settings"], validate scope is "user" or "admin"
    - If scope is "user": restrict to authenticated user's data only (ignore any `owners` filter)
    - If scope is "admin": verify admin privileges via `_require_admin`, apply owner and tag filters with OR logic (union, deduplicated by ID)
    - When Settings category is selected, skip tag filtering (settings are not tagged)
    - Build and return the new export envelope with `categories`, `filters_applied`, and `data` keyed by category name
    - Return proper error responses for invalid categories (400), invalid scope (400), non-admin requesting admin scope (403)
    - _Requirements: 3.7, 4.1, 4.2, 4.3, 8.7, 9.1, 9.2, 9.3, 9.4, 13.1, 13.2, 13.3, 13.4, 13.5, 13.6_

  - [ ] 2.5 Implement `POST /api/import` endpoint
    - Accept `ImportRequestV2` body, validate category is one of ["chits", "people", "settings"], validate mode is "add" or "replace", validate scope
    - Validate the `data` field contains a valid export envelope with required fields
    - If scope is "user": import scoped to authenticated user only
    - If scope is "admin": verify admin privileges, import across users as contained in the export file
    - Return summary with counts of records processed
    - Return proper error responses for invalid mode (400), invalid category (400), invalid envelope (400), category mismatch (400), non-admin requesting admin scope (403)
    - _Requirements: 5.6, 5.7, 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7_

  - [ ] 2.6 Implement `GET /api/admin/backup` endpoint
    - Verify admin privileges via `_require_admin`
    - Read the SQLite database file from `DB_PATH` and return as `StreamingResponse` with `application/octet-stream` content type
    - Set `Content-Disposition` header with filename `cwoc-backup-YYYY-MM-DD.db`
    - Return 403 for non-admin, 500 if database file not found
    - _Requirements: 11.2, 11.3, 11.4, 11.5, 13.7_

  - [ ] 2.7 Implement `POST /api/admin/restore` endpoint
    - Verify admin privileges via `_require_admin`
    - Accept multipart file upload (`.db` file)
    - Write uploaded file to a temp location, validate with `_validate_sqlite_file`
    - If valid, use `shutil.copy2` to replace the database at `DB_PATH`
    - Clean up temp file
    - Return 400 for invalid SQLite file, 403 for non-admin, 500 for file replace failure
    - _Requirements: 12.5, 12.7, 12.8, 13.8_

  - [ ] 2.8 Implement `GET /api/admin/users` and `GET /api/admin/tags` endpoints
    - `GET /api/admin/users`: verify admin, query users table, return list of `{id, display_name, username}` for all users
    - `GET /api/admin/tags`: verify admin, query settings table joined with users, return tags grouped by user with `{id, display_name, tags}` per entry
    - Return 403 for non-admin on both endpoints
    - _Requirements: 15.1, 15.2, 15.3_

- [ ] 3. Register the new router in `main.py`
  - Add `from src.backend.routes.data_management import router as data_mgmt_router` to the imports section
  - Add `app.include_router(data_mgmt_router)` in the route registration section
  - _Requirements: 13.1_

- [ ] 4. Checkpoint — Ensure backend compiles and all existing tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Create frontend modal JS file `src/frontend/js/pages/settings-data-mgmt.js`
  - [ ] 5.1 Implement modal infrastructure and export flow
    - Create the file with `openExportModal(scope)` function that clones the `tmpl-data-mgmt-modal` template and manages the multi-step wizard
    - Implement `_renderCategoryStep(modal, scope)` — render checkboxes for Chits, People, Settings (multi-select for export)
    - Implement `_renderFilterStep(modal, scope, categories)` — render filter options: "All" and "By Tag" for user scope; "All", "By Owner", "By Tag" for admin scope; skip filter step if only Settings is selected
    - Implement `_renderTagPicker(container, scope)` — for user scope: read tags from cached settings; for admin scope: fetch `GET /api/admin/tags` and render as a tree grouped by user display name
    - Implement `_renderOwnerPicker(container)` — fetch `GET /api/admin/users` and render multi-select checkboxes
    - Implement `_executeExport(scope, categories, filters)` — POST to `/api/export`, receive JSON, trigger browser download as `.json` file with `cwoc-export-YYYY-MM-DD.json` filename
    - Wire Next/Back/Cancel/Export buttons with step navigation and validation (Next enabled only when at least one category selected)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 7.1, 7.2, 7.3, 7.4, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9_

  - [ ] 5.2 Implement import flow
    - Implement `openImportModal(scope)` — single-select category (radio buttons), file picker for `.json`, Add/Replace mode selection
    - Implement `_validateExportEnvelope(data, expectedCategory)` — client-side validation that the uploaded JSON has the correct envelope structure and contains the selected category
    - Implement `_executeImport(scope, category, mode, fileData)` — POST to `/api/import`, display summary with record counts
    - Show confirmation dialog when "Replace" mode is selected, warning about permanent data replacement (admin scope warns about all users' data)
    - Display error messages for file type mismatch, invalid envelope, and API errors in the modal body
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

  - [ ] 5.3 Implement backup and restore functions
    - Implement `_triggerBackup()` — fetch `GET /api/admin/backup`, trigger `.db` file download with filename `cwoc-backup-YYYY-MM-DD.db`
    - Implement `_triggerRestore()` — open file picker for `.db` files, show confirmation dialog with prominent warning text, require typing "RESTORE" to confirm, POST multipart to `/api/admin/restore`, show success message and prompt to reload
    - Display errors via `alert()` for backup failures, in-dialog for restore failures
    - _Requirements: 11.1, 11.2, 11.3, 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

- [ ] 6. Update `settings.html` — replace old data management section and add admin section
  - [ ] 6.1 Replace the per-user Data Management section
    - Replace the existing "📦 Data Management" setting-group content (remove All Data, Chit Data, User Data export/import buttons and their hidden file inputs)
    - Add new Export and Import buttons that call `openExportModal('user')` and `openImportModal('user')`
    - Retain the existing Calendar Import (.ics) button and its functionality unchanged
    - Retain the Audit Log, Trash, and Audit Log Limits sub-sections unchanged
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 17.1, 17.2_

  - [ ] 6.2 Add the Admin Data Management section
    - Add a new `setting-group` inside the existing `admin-section` div with heading "📦 Admin Data Management"
    - Add Export button (`openExportModal('admin')`), Import button (`openImportModal('admin')`), Backup button (`_triggerBackup()`), and Restore button (`_triggerRestore()`)
    - Section is automatically hidden for non-admin users (inherits from `admin-section` display logic)
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ] 6.3 Add the modal template and script tag
    - Add `<template id="tmpl-data-mgmt-modal">` at the bottom of settings.html before `</body>`, containing the modal overlay, header, body, footer with Back/Cancel/Next buttons
    - Add `<script src="/frontend/js/pages/settings-data-mgmt.js"></script>` after the existing `settings.js` script tag
    - _Requirements: 2.1, 2.5_

- [ ] 7. Add CSS for the data management modal to `shared-page.css`
  - Add `.data-mgmt-modal` styles: max-width 520px, parchment background (`#fffaf0`), border-radius, box-shadow, matching existing CWOC modal patterns
  - Add `.data-mgmt-header`, `.data-mgmt-body` (scrollable, max-height), `.data-mgmt-footer` (flex row with Back/Cancel/Next)
  - Add `.data-mgmt-category-list` for checkbox/radio list items
  - Add `.data-mgmt-filter-section` for filter option containers
  - Add `.data-mgmt-tag-tree` for admin tag tree with collapsible user nodes
  - Add `.data-mgmt-owner-list` for owner picker checkboxes
  - Add responsive rule: full-width modal on screens < 600px
  - Use existing CWOC color variables and parchment theme conventions
  - _Requirements: 1.5, 2.5, 5.8_

- [ ] 8. Checkpoint — Ensure frontend and backend work together
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Write property-based tests in `src/backend/test_data_management.py`
  - [ ]* 9.1 Write property test for per-user export scoping
    - **Property 1: Per-User Export Scoping and Tag Filtering**
    - Generate random chits/contacts across multiple users with random tags; verify per-user export returns only records owned by the authenticated user AND matching selected tags (or all if no tag filter); verify no other user's records appear even if user is admin
    - Use Python stdlib `unittest` with random generators (same pattern as `test_audit.py`), minimum 100 iterations
    - Inline minimal production logic to avoid importing FastAPI
    - **Validates: Requirements 3.2, 3.4, 4.1, 4.2, 4.3, 13.2**

  - [ ]* 9.2 Write property test for admin export filtering with OR logic
    - **Property 2: Admin Export Filtering with OR Logic**
    - Generate random records across users with random tags/owners; verify admin export with owner filter returns records matching any selected owner; verify tag filter returns records matching any selected tag; verify combined owner+tag returns the union (no duplicates); verify "All" returns everything
    - **Validates: Requirements 8.3, 8.5, 8.6, 9.1, 9.2, 9.3, 9.4, 13.3**

  - [ ]* 9.3 Write property test for admin access control
    - **Property 3: Admin-Only Endpoint Access Control**
    - For randomly generated non-admin user contexts, verify that all admin-scoped operations (export with admin scope, import with admin scope, backup, restore, admin/users, admin/tags) return 403 with "Admin access required"
    - **Validates: Requirements 11.4, 11.5, 12.7, 13.4, 14.7, 15.3**

  - [ ]* 9.4 Write property test for export envelope completeness
    - **Property 4: Export Envelope Completeness**
    - For random combinations of categories and filters, verify the export response contains all required fields: `type`, `version`, `exported_at` (valid ISO 8601), `instance_id`, `categories` (matching requested), `filters_applied`, and `data` (object keyed by category with array values)
    - **Validates: Requirements 13.5, 16.1**

  - [ ]* 9.5 Write property test for JSON field deserialization
    - **Property 5: JSON Field Deserialization in Exports**
    - Generate chits/contacts with JSON-serialized fields stored as strings in SQLite; verify exported records contain those fields as native Python objects (lists/dicts), not JSON strings
    - **Validates: Requirements 13.6**

  - [ ]* 9.6 Write property test for invalid database file rejection
    - **Property 6: Invalid Database File Rejection on Restore**
    - Generate random byte sequences that are not valid SQLite files; verify `_validate_sqlite_file` returns False for each; verify the restore logic would return 400 and leave the database unchanged
    - **Validates: Requirements 12.8**

  - [ ]* 9.7 Write property test for export/import round-trip
    - **Property 7: Export/Import Round-Trip**
    - Generate random chits, contacts, and settings; export all categories with "All" filter; import in "replace" mode; re-export and verify the data is equivalent to the original export (all fields preserved including tags, checklists, people, alerts, recurrence rules, contact multi-value fields)
    - **Validates: Requirements 16.4**

- [ ] 10. Update help page documentation
  - Update the `<h3 id="data-management">Data Management</h3>` section in `help.html`
  - Document the per-user export flow: category selection (Chits, People, Settings), filter options (All, By Tag), tag picker behavior, OR logic for multiple tags
  - Document the per-user import flow: category selection, file upload, Add/Replace mode, confirmation for Replace
  - Document the admin export flow: category selection, filter options (All, By Owner, By Tag), owner picker, admin tag tree grouped by user, OR logic
  - Document the admin import flow: same as per-user but cross-user scope
  - Document admin Backup: downloads raw `.db` file
  - Document admin Restore: uploads `.db` file, requires typing "RESTORE" to confirm, full system wipe warning
  - Document that Settings category skips tag filter (settings are not tagged)
  - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5_

- [ ] 11. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. Update INDEX.md, VERSION, and release notes
  - [ ] 12.1 Update `src/INDEX.md` with new files and functions
    - Add entry for `src/backend/routes/data_management.py` with all endpoints and helper functions
    - Add entry for `src/frontend/js/pages/settings-data-mgmt.js` with all exported functions
    - Add entries for new Pydantic models (`ExportRequest`, `ImportRequestV2`) in models.py section
    - Add entry for `src/backend/test_data_management.py`
    - Update the `settings.html` section to reflect the new data management layout
    - Update the `shared-page.css` section to note the new modal styles

  - [ ] 12.2 Update VERSION and create release notes
    - Run `date "+%Y%m%d.%H%M"` and write the result to `src/VERSION`
    - Create `documents/release_notes/cwoc_release_[VERSION].md` with a brief summary of the Data Management Overhaul feature

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- NO software installation required — uses Python stdlib `unittest` with custom random generators for property tests (same pattern as existing `test_audit.py`)
- Legacy export/import endpoints (`GET /api/export/chits`, `GET /api/export/userdata`, etc.) remain functional for backward compatibility but are no longer referenced by the UI
- The `settings-data-mgmt.js` file is loaded after `settings.js` via a `<script>` tag in `settings.html`
