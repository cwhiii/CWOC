# Implementation Plan: Data Management

## Overview

Replace the existing CSV export/import with a unified JSON-based data management system. Add four new backend API endpoints (two export, two import), a new "📦 Data Management" settings box on the frontend, remove the legacy CSV code, and update help documentation. All work is in `backend/main.py`, `frontend/settings.html`, `frontend/settings.js`, and `frontend/help.html`. No installs required — Python stdlib and vanilla JS only.

allow edxporting any pice of segragated data, or evertyhign (all chits, all contacts, all audit logs) use checkboxes, and default to everyting.

## Tasks

- [x] 1. Add backend export endpoints and data models
  - [x] 1.1 Add `ImportRequest` Pydantic model and Export Envelope builder helper in `backend/main.py`
    - Add `ImportRequest(BaseModel)` with `mode: str` and `data: dict`
    - Add helper function `_build_export_envelope(data_type, data)` that reads VERSION file, calls `get_or_create_instance_id()`, and returns the envelope dict with `type`, `version`, `exported_at`, `instance_id`, `data`
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 9.1, 9.2_

  - [x] 1.2 Implement `GET /api/export/chits` endpoint
    - Query all records from `chits` table (including soft-deleted)
    - Deserialize JSON-serialized fields: tags, checklist, people, child_chits, alerts, recurrence_rule, recurrence_exceptions
    - Wrap in Export Envelope with `type: "chits"` using the helper
    - Return with `json.dumps(indent=2)` for human-readable formatting
    - _Requirements: 2.2, 2.4, 2.5, 9.1, 9.3_

  - [x] 1.3 Implement `GET /api/export/userdata` endpoint
    - Query all records from `settings` and `contacts` tables
    - Deserialize JSON-serialized fields in settings (tags, default_filters, custom_colors, visual_indicators, chit_options, active_clocks, saved_locations) and contacts (phones, emails, addresses, call_signs, x_handles, websites, tags)
    - Wrap in Export Envelope with `type: "userdata"`, `data: { settings: [...], contacts: [...] }`
    - Return with `json.dumps(indent=2)` for human-readable formatting
    - _Requirements: 3.2, 3.4, 3.5, 3.6, 9.2, 9.4_

  - [x] 1.4 Write property test: Chit export completeness and correctness
    - **Property 1: Chit export completeness and correctness**
    - Generate random chit records with varied field combinations (null/populated JSON fields), insert into test DB, call export endpoint, verify envelope structure and all records present with deserialized fields
    - Use stdlib only (random, string, uuid, unittest), minimum 100 iterations
    - **Validates: Requirements 2.2, 2.4, 2.5, 9.3**

  - [x] 1.5 Write property test: User data export completeness and correctness
    - **Property 2: User data export completeness and correctness**
    - Generate random settings and contact records, insert into test DB, call export endpoint, verify envelope structure with both `settings` and `contacts` arrays, all JSON fields deserialized
    - Use stdlib only, minimum 100 iterations
    - **Validates: Requirements 3.2, 3.4, 3.5, 3.6, 9.4**

- [x] 2. Add backend import endpoints
  - [x] 2.1 Implement `POST /api/import/chits` endpoint
    - Validate `mode` is "add" or "replace" → HTTP 400 if not
    - Validate `data.type` is "chits" → HTTP 400 if not
    - Validate envelope has required fields (type, version, exported_at, data) → HTTP 400 if missing
    - **Add mode**: Generate new UUID for each chit, insert with all fields preserved, serialize JSON fields for DB storage
    - **Replace mode**: Within a single transaction, DELETE all from `chits`, then insert all records with new UUIDs
    - Return `{ "summary": { "imported": N } }`
    - _Requirements: 4.4, 5.3, 10.1, 10.3, 10.4, 10.5_

  - [x] 2.2 Implement `POST /api/import/userdata` endpoint
    - Validate `mode` is "add" or "replace" → HTTP 400 if not
    - Validate `data.type` is "userdata" → HTTP 400 if not
    - Validate envelope has required fields → HTTP 400 if missing
    - **Add mode (settings)**: Merge array fields (tags, custom_colors, saved_locations) with existing values, deduplicating; scalar fields not overwritten
    - **Add mode (contacts)**: Insert each contact with new UUID, skip contacts where `display_name` AND `given_name` match existing
    - **Replace mode**: Within a single transaction, DELETE all from `settings` and `contacts`, then insert all records from envelope
    - Return appropriate summary response with counts
    - _Requirements: 6.4, 6.5, 7.3, 10.2, 10.3, 10.4, 10.5_

  - [x] 2.3 Write property test: Import validation rejects invalid requests
    - **Property 3: Import validation rejects invalid requests**
    - Generate random invalid modes and mismatched envelope types, call import endpoints, verify HTTP 400 and no DB changes
    - Use stdlib only, minimum 100 iterations
    - **Validates: Requirements 4.6, 6.7, 10.3, 10.4**

  - [x] 2.4 Write property test: Add mode chit import preserves fields with new IDs
    - **Property 4: Add mode chit import preserves fields with new IDs**
    - Generate random chit envelopes, import in add mode, verify each inserted chit has a new UUID different from original and all other fields match
    - Use stdlib only, minimum 100 iterations
    - **Validates: Requirements 4.4**

  - [x] 2.5 Write property test: Add mode settings merge deduplicates array fields
    - **Property 5: Add mode settings merge deduplicates array fields**
    - Generate random existing settings and imported settings with overlapping array fields, import in add mode, verify result is deduplicated union with no items removed
    - Use stdlib only, minimum 100 iterations
    - **Validates: Requirements 6.4**

  - [x] 2.6 Write property test: Add mode contact import skips duplicates
    - **Property 6: Add mode contact import skips duplicates**
    - Generate random existing and imported contacts with some matching display_name+given_name pairs, import in add mode, verify duplicates skipped and non-matching inserted with new UUIDs
    - Use stdlib only, minimum 100 iterations
    - **Validates: Requirements 6.5**

- [x] 3. Checkpoint — Backend endpoints complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Add frontend Data Management box and export/import logic
  - [x] 4.1 Add the "📦 Data Management" setting-group box in `frontend/settings.html`
    - Add a new `.setting-group` box in the `.settings-grid` with heading "📦 Data Management"
    - Create two subsections: "Chit Data" with Export and Import buttons, "User Data" with Export and Import buttons
    - Add hidden file input elements for JSON import (accept `.json`)
    - Add import mode dialog modal (Add / Replace choice)
    - Add replace confirmation dialog modal styled after existing delete chit modal pattern
    - Follow existing parchment/1940s theme using `shared-page.css` styles
    - _Requirements: 1.1, 1.2, 1.4, 4.1, 4.2, 6.1, 6.2_

  - [x] 4.2 Remove legacy CSV export/import from Chit Options
    - Remove the "📤 Export / Import" subsection (`<h3>`, buttons, file input) from the "Chit Options" `.setting-group` in `settings.html`
    - Remove `exportCSV`, `importCSV`, and `_parseCSVLine` functions from `settings.js`
    - _Requirements: 11.1, 11.2, 11.3_

  - [x] 4.3 Implement export JS functions in `frontend/settings.js`
    - Add `_triggerJsonDownload(data, filename)` helper — create Blob, trigger `<a>` download
    - Add `exportChitData()` — fetch from `/api/export/chits`, trigger download as `cwoc-chits-YYYY-MM-DD.json`
    - Add `exportUserData()` — fetch from `/api/export/userdata`, trigger download as `cwoc-userdata-YYYY-MM-DD.json`
    - Handle network errors with alert messages
    - _Requirements: 2.1, 2.3, 3.1, 3.3_

  - [x] 4.4 Implement import JS functions in `frontend/settings.js`
    - Add `_showImportModeDialog(type, fileData)` — show modal with Add/Replace buttons
    - Add `_showReplaceConfirmDialog(type, onConfirm)` — show confirmation modal with appropriate warning text
    - Add `importChitData()` — open file picker, read JSON, validate envelope type is "chits", show mode dialog, POST to `/api/import/chits`, display summary
    - Add `importUserData()` — open file picker, read JSON, validate envelope type is "userdata", show mode dialog, POST to `/api/import/userdata`, display summary
    - On replace mode for user data, reload settings from backend after import completes
    - Handle file parse errors, wrong envelope type errors, and network errors with appropriate alert messages
    - _Requirements: 4.2, 4.3, 4.5, 4.6, 5.1, 5.2, 5.4, 5.5, 6.2, 6.3, 6.6, 6.7, 7.1, 7.2, 7.4, 7.5, 7.6_

- [x] 5. Checkpoint — Frontend complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Update help documentation and version
  - [x] 6.1 Update `frontend/help.html` with Data Management section
    - Add "Data Management" entry to the table of contents
    - Add a new `<h3 id="data-management">Data Management</h3>` section describing export/import functionality
    - Document the two data categories (Chit Data and User Data) and what each contains
    - Document the two import modes (Add and Replace) and their behavior
    - Update the Settings section list item to reference "Data Management" instead of "Export / Import — CSV export and import"
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

  - [x] 6.2 Update VERSION file
    - Run `date "+%Y%m%d.%H%M"` and update the VERSION file with the current timestamp
    - _Requirements: (workspace versioning rule)_

- [x] 7. Write round-trip property test
  - [x] 7.1 Write property test: Export-import round trip
    - **Property 7: Export-import round trip**
    - Generate random datasets (chits, settings+contacts), export, import in replace mode, export again, verify datasets are equivalent (same field values, ignoring generated IDs and export metadata)
    - Use stdlib only, minimum 100 iterations
    - **Validates: Requirements 8.5, 5.3, 7.3**

- [x] 8. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- All property-based tests use Python stdlib only (random, string, uuid, unittest) — no hypothesis, no pip installs
- No installs of any kind (no pip, no npm)
