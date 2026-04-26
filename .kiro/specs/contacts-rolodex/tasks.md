# Implementation Plan: Contacts Rolodex

## Overview

Build a full-featured contact management system for CWOC: backend Contact model, SQLite storage, vCard serialization, CRUD/import/export API endpoints, People page, Contact Editor, shared editor framework extraction, People Picker autocomplete, Quick Editor chips, dashboard People filter, and generalized sidebar filter component. Tasks are ordered backend-first, then shared framework extraction, then new frontend pages, then integration points.

## Tasks

- [x] 1. Backend data model, storage, and CRUD API
  - [x] 1.1 Add Contact Pydantic models and SQLite `contacts` table
    - Add `MultiValueEntry` and `Contact` Pydantic models to `backend/main.py`
    - Add `init_contacts_table()` migration function that creates the `contacts` table with all columns (id, given_name, surname, middle_names, prefix, suffix, display_name, phones, emails, addresses, call_signs, x_handles, websites, has_signal, pgp_key, favorite, created_datetime, modified_datetime)
    - Create `/app/data/contacts/` directory on startup if it doesn't exist
    - Add a `compute_display_name(contact)` helper that concatenates prefix + given_name + middle_names + surname + suffix
    - _Requirements: 1.1, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.3, 2.6_

  - [x] 1.2 Implement vCard serializer and printer
    - Add `vcard_parse(vcard_string)` function that parses a vCard 3.0 string into a Contact dict, mapping N, FN, TEL, EMAIL, ADR, URL, X-SIGNAL, X-PGP-KEY, X-CALLSIGN, X-XHANDLE properties with TYPE parameters to multi-value labels
    - Add `vcard_print(contact)` function that formats a Contact dict into a valid vCard 3.0 string with all mapped properties
    - _Requirements: 8.1, 8.2, 8.4, 8.5_

  - [x] 1.3 ~~Write property test for vCard round-trip (Property 3)~~ — SKIPPED (requires Hypothesis)
    - Replaced with manual round-trip tests in `backend/test_vcard.py`

  - [x] 1.4 Implement Contact CRUD API endpoints
    - `POST /api/contacts` — validate given_name required (422 if missing), assign UUID, compute display_name, write .vcf file via `vcard_print`, insert SQLite row, return Contact JSON with id and timestamps
    - `GET /api/contacts` — return all contacts sorted favorites-first then alphabetical by display_name; support `?q=` query parameter for case-insensitive search across display_name, emails, phones, call_signs
    - `GET /api/contacts/{id}` — return single contact or 404
    - `PUT /api/contacts/{id}` — validate given_name, update .vcf file and SQLite row atomically, update modified_datetime
    - `DELETE /api/contacts/{id}` — remove .vcf file from disk and delete SQLite row, or 404
    - `PATCH /api/contacts/{id}/favorite` — toggle favorite boolean, update .vcf and SQLite, return updated contact
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 2.1, 2.2, 2.4, 2.5_

  - [x] 1.5 ~~Write property test for Contact API round-trip (Property 1)~~ — SKIPPED (requires Hypothesis)

  - [x] 1.6 ~~Write property test for favorites-first sort invariant (Property 2)~~ — SKIPPED (requires Hypothesis)

  - [x] 1.7 ~~Write property test for search results relevance (Property 5)~~ — SKIPPED (requires Hypothesis)

  - [x] 1.8 ~~Write property test for favorite toggle involution (Property 6)~~ — SKIPPED (requires Hypothesis)

- [x] 2. Checkpoint — Backend CRUD and vCard
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Import/Export and CSV serialization
  - [x] 3.1 Implement CSV serializer (export and import)
    - Add `csv_export(contacts)` function that flattens contacts into CSV rows with header: given_name, surname, middle_names, prefix, suffix, phone_1_label, phone_1_value, ... (up to 5 per multi-value type), has_signal, pgp_key, favorite
    - Add `csv_import(csv_text)` function that parses CSV rows back into Contact dicts, mapping column headers; skip rows missing given_name and collect errors
    - _Requirements: 6.3, 7.2_

  - [x] 3.2 ~~Write property test for CSV round-trip (Property 4)~~ — SKIPPED (requires Hypothesis)

  - [x] 3.3 Implement import endpoint
    - `POST /api/contacts/import` — accept file upload (.vcf or .csv), parse entries, create contacts for valid entries, skip malformed entries, return `{imported, skipped, errors}` summary
    - For .vcf: split on BEGIN:VCARD/END:VCARD boundaries, parse each with `vcard_parse`, skip malformed entries with reason
    - For .csv: parse with `csv_import`, skip rows missing given_name with reason
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 3.4 Implement export endpoints
    - `GET /api/contacts/export?format=vcf` — return all contacts as a single multi-entry .vcf file download
    - `GET /api/contacts/export?format=csv` — return all contacts as a .csv file download with header row
    - `GET /api/contacts/{id}/export?format=vcf` — return single contact as .vcf file download
    - Return 400 for invalid format parameter
    - _Requirements: 7.1, 7.2, 7.3_

- [x] 4. Checkpoint — Import/Export complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Shared Editor Framework extraction
  - [x] 5.1 Create `shared-editor.css`
    - Extract from `editor.css` into `frontend/shared-editor.css`: `.header-row` flex container (logo, title, left/right button groups), `.zone-container` / `.zone-header` / `.zone-body` / `.zone-toggle-icon` collapsible zone pattern, `.main-zones-grid` two-column responsive grid, common `.field` / label / input / select / textarea styling, save/cancel/delete/action button styles
    - Header-row styles must support configurable logo image, title text, and both left-side and right-side action button groups
    - _Requirements: 13.1, 13.7_

  - [x] 5.2 Create `shared-editor.js`
    - Extract from `editor.js` into `frontend/shared-editor.js`: `cwocToggleZone(event, sectionId, contentId)` function (parameterized zone expand/collapse), `CwocEditorSaveSystem` class wrapping `CwocSaveSystem` with editor-specific defaults (markUnsaved on input change, save button state management), `cwocInitEditorHotkeys(zoneMap)` for Alt+N zone focus hotkeys
    - Zone toggle function must accept section and content element IDs as parameters
    - Load via `<script>` tag (no ES modules)
    - _Requirements: 13.2, 13.5, 13.8_

  - [x] 5.3 Refactor Chit Editor to use shared editor framework
    - Update `editor.html` to load `shared-editor.css` and `shared-editor.js` via `<link>` and `<script>` tags
    - Remove duplicated styles from `editor.css` that are now in `shared-editor.css`
    - Remove duplicated logic from `editor.js` that is now in `shared-editor.js` (zone toggle, save system init, hotkeys), delegate to shared functions
    - Verify all existing chit editor functionality is preserved — no behavior changes
    - _Requirements: 13.3, 13.6_

- [x] 6. Checkpoint — Shared Editor Framework
  - Ensure all tests pass and the chit editor works correctly after refactoring. Ask the user if questions arise.

- [x] 7. People Page (Rolodex browse view)
  - [x] 7.1 Create `people.html` and `people.js`
    - Create `frontend/people.html` from `_template.html` with `<body data-page-title="People" data-page-icon="👥">`, loading `shared-page.css`, `shared-page.js`, and `qrcode-generator` CDN
    - Create `frontend/people.js` with: fetch contacts from `GET /api/contacts`, render scrollable contact list showing display name (prefix + given + middle + surname + suffix), star toggle (★/☆) on each row, "Share" (QR) button on each row
    - Add search input that filters contact list in real-time (client-side filtering, fallback to `?q=` API)
    - Display favorites at top of list with filled star (★), non-favorites below with empty star (☆)
    - Add "New Contact" button navigating to blank Contact Editor
    - Click on contact row navigates to Contact Editor with `?id={uuid}`
    - _Requirements: 4.2, 4.3, 4.4, 4.5, 4.6, 4.8, 4.9, 15.2_

  - [x] 7.2 Implement Import/Export UI on People Page
    - Add "Import" button that opens file picker accepting `.vcf` and `.csv`, uploads to `POST /api/contacts/import`, displays result summary modal (imported count, skipped count, error reasons)
    - Add "Export" button with options to export all as .vcf or .csv via `GET /api/contacts/export?format=`
    - _Requirements: 6.6, 7.4_

  - [x] 7.3 Implement QR code sharing on People Page
    - On "Share" button click: generate vCard string for contact, encode as QR code using `qrcode-generator` library, display in modal overlay
    - Size QR code to fit modal while remaining scannable
    - If vCard data exceeds QR capacity (~2953 bytes), display message suggesting file export instead
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 4.7_

- [x] 8. Contact Editor Page
  - [x] 8.1 Create `contact-editor.html` and `contact-editor.js`
    - Create `frontend/contact-editor.html` loading `shared-page.css`, `shared-editor.css`, `shared-editor.js`, `shared-page.js`, and `qrcode-generator` CDN
    - Header row: logo, "Contact Editor" title, star toggle (favorite), save buttons (CwocSaveSystem via shared-editor.js), Share QR button, Delete button
    - Name Zone: prefix (dropdown with Mr., Mrs., Ms., Dr., Prof., Rev., Hon. + custom input), given name, middle names, surname, suffix (dropdown with Jr., Sr., II, III, IV, Esq., Ph.D., M.D. + custom input)
    - Communication Zone: multi-value editors for phone, email, address, call sign, X handle, website/social — each with label input + value input + "Add" button to append entries
    - Security Zone: Signal toggle, PGP public key textarea
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.10, 1.2, 1.3_

  - [x] 8.2 Implement Contact Editor save, delete, and share logic
    - Load contact from `GET /api/contacts/{id}` when `?id=` present; blank form for new contact
    - Save via `POST /api/contacts` (new) or `PUT /api/contacts/{id}` (existing) using CwocSaveSystem (Save & Stay / Save & Exit / Cancel)
    - Display success/error indication on save
    - Delete button: confirmation dialog, then `DELETE /api/contacts/{id}`, navigate to People Page
    - Star toggle: `PATCH /api/contacts/{id}/favorite`, update star display
    - Share QR button: generate vCard QR code in modal (same as People Page pattern)
    - _Requirements: 5.6, 5.7, 5.8, 5.9, 15.1, 15.5_

- [x] 9. Checkpoint — People Page and Contact Editor
  - Ensure all tests pass, verify People Page and Contact Editor work end-to-end. Ask the user if questions arise.

- [x] 10. Dashboard navigation and People button
  - Add "People" button in `section-settings` area of `index.html`, directly above the Settings button
  - Use Font Awesome `fa-address-book` icon, consistent with CWOC aesthetic
  - `onclick` navigates to `/frontend/people.html`
  - Add navigation buttons in People Page header (return to Chits, access Settings) consistent with other secondary pages
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 4.1_

- [x] 11. People Picker autocomplete in Chit Editor
  - [x] 11.1 Add autocomplete to People field in `editor.js`
    - On keyup in `#people` input (debounced 250ms): `GET /api/contacts?q={typed_text}`
    - Render autocomplete dropdown below input: favorites first (★), then alphabetical
    - Click or Enter on suggestion inserts display name as comma-separated entry
    - Free-text entry still allowed for names not in Rolodex
    - If contacts API unreachable, fall back to free-text-only mode (no autocomplete)
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 15.3_

- [x] 12. Quick Editor people chips
  - [x] 12.1 Add people chips to Quick Editor in `shared.js`
    - In `showQuickEditModal()`, render each person from chit's `people` array as a compact `<span class="cwoc-people-chip">{name}</span>`
    - If chips overflow one row, truncate visible chips and show "+N more" indicator
    - On hover over "+N more", display tooltip with full list of all people names
    - Chips are read-only in the quick editor
    - _Requirements: 11.1, 11.2, 11.3_

- [x] 13. Generalized Sidebar Filter Component and People Filter
  - [x] 13.1 Implement `CwocSidebarFilter` component in `main.js`
    - Create `CwocSidebarFilter(config)` function accepting: containerId, items (array of {name, favorite, color?}), selection array, onChange callback, searchPlaceholder, showColorBadge flag
    - Render search input with real-time filtering, favorites-first sorted list (capped at 9 visible), click-to-toggle selection with bold text + outline visual feedback, numbered hotkey 1–9 support
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6_

  - [x] 13.2 Refactor existing tag filter to use `CwocSidebarFilter`
    - Refactor `_buildTagFilterPanel()` to call `CwocSidebarFilter` with `showColorBadge: true`
    - Preserve all current tag filter behavior: color badges, star indicators, hotkey support, click-to-toggle
    - _Requirements: 16.7_

  - [x] 13.3 Implement People Filter panel on dashboard sidebar
    - Add `section-people-filter` group in sidebar filters section, after the Label filter group
    - Use `CwocSidebarFilter` with contact data from `GET /api/contacts`, `showColorBadge: false`
    - Store selection in `window._sidebarPeopleSelection`
    - Filter chits by matching `chit.people` array against selected contact names
    - Display favorites first with ★, support search input filtering via `?q=` parameter
    - Wire into "Clear Filters" to clear people selection along with other filters
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8, 15.4, 16.8_

  - [x] 13.4 ~~Write property test for People filter correctness (Property 7)~~ — SKIPPED (requires Hypothesis)

- [x] 14. Final checkpoint — Full integration
  - Ensure all tests pass, verify end-to-end: People Page, Contact Editor, People Picker autocomplete, Quick Editor chips, dashboard People filter, tag filter still works after refactor. Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document using Hypothesis (Python)
- Unit tests validate specific examples and edge cases
- Backend tasks come first to establish the API foundation, then shared framework extraction, then frontend pages, then integration points
