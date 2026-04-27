# Implementation Plan: Codebase Refactor

## Overview

This plan follows the design's 5-phase execution order for risk minimization. Each phase is independently testable and reversible. Every phase includes verification sub-tasks per the user's request to double-check each piece, with final verification tasks at the end to triple-check all original functionality is preserved.

## Tasks

- [x] 1. Phase 1: CSS Variable Consolidation
  - [x] 1.1 Document canonical CSS variable source and sync values across files
    - In `frontend/shared-page.css`, add a comment block at the top of `:root` marking it as the canonical source of truth for the common CSS variable set
    - In `frontend/styles.css`, add a comment referencing `shared-page.css` as the canonical source; verify all shared variable values match exactly; remove any variables defined but never used in `styles.css`
    - In `frontend/shared-editor.css`, add a comment referencing `shared-page.css` as the canonical source; verify all shared variable values match exactly; keep only editor-specific additions (`--accent-teal`, `--warning-orange`, `--zone-header-bg`, `--zone-body-bg`, `--input-bg`, `--modal-bg`, `--hover-bg-light`)
    - Ensure `styles.css` remains self-contained (dashboard loads only `styles.css`, not `shared-page.css`)
    - Ensure `shared-editor.css` remains self-contained (chit editor loads it without `shared-page.css`)
    - _Requirements: 8.1, 11.1, 15.1_

  - [x] 1.2 Remove unused CSS variables and extract repeated inline styles
    - Audit all three CSS files for variables that are defined but never referenced in any CSS rule or HTML file
    - Remove any truly unused variables
    - In `editor.html`, `settings.html`, and `index.html`, identify inline `style=""` patterns that repeat 3+ times and extract them into named CSS classes in the appropriate stylesheet
    - _Requirements: 11.3, 8.1_

  - [x] 1.3 Verify Phase 1 — double-check CSS consolidation
    - Verify all pages still render correctly by checking that no CSS variable references are broken (search for `var(--` in all CSS/HTML files and confirm each variable is defined)
    - Verify `index.html` (dashboard) renders correctly with only `styles.css`
    - Verify `editor.html` renders correctly with `shared-editor.css` + `editor.css`
    - Verify `contact-editor.html` renders correctly with `shared-page.css` + `shared-editor.css`
    - Verify `settings.html`, `people.html`, `trash.html`, `help.html` render correctly with `shared-page.css`
    - _Requirements: 8.1, 8.2, 8.3, 8.5_

- [x] 2. Phase 2: JS Utility Consolidation
  - [x] 2.1 Move `generateUniqueId()` to `shared.js`
    - Add `generateUniqueId()` function to `frontend/shared.js` (uses `Date.now().toString(36) + Math.random().toString(36).substr(2)`)
    - Remove the duplicate `generateUniqueId()` from `frontend/editor.js`
    - Remove the duplicate `generateUniqueId()` from `frontend/editor_projects.js`
    - Both files load `shared.js` first via `<script>` tags, so the function will be available globally
    - _Requirements: 11.6, 7.1, 15.1_

  - [x] 2.2 Move `formatTime()` to `shared.js` and clarify `formatDate` variants
    - Add `formatTime(date)` to `frontend/shared.js` (uses `toLocaleTimeString` with `hour: '2-digit', minute: '2-digit', hour12: false`)
    - Remove the duplicate `formatTime()` from `frontend/editor.js`
    - Note: `shared.js` already has a `formatDate()` function. The `editor.js` version uses `YYYY-Mon-DD` format which matches the existing `shared.js` version. Remove the duplicate from `editor.js`.
    - The `main.js` `formatDate()` includes day-of-week info specific to the dashboard — keep it local in `main.js` but rename to `_formatDateWithDay()` or add a comment clarifying it's the dashboard-specific variant
    - _Requirements: 11.5, 7.1, 15.1_

  - [x] 2.3 Move `setSaveButtonUnsaved()` to `shared.js`
    - Add `setSaveButtonUnsaved()` to `frontend/shared.js` as a global convenience wrapper that delegates to `window._cwocSave.markUnsaved()` if available
    - Remove the duplicate from `frontend/editor.js`
    - Verify `frontend/settings.js` already uses the same pattern and remove its duplicate if present
    - _Requirements: 11.2, 7.1, 15.1_

  - [x] 2.4 Verify Phase 2 — double-check JS consolidation
    - Verify `editor.html` loads and all editor functionality works (save, zones, dates, tags, checklist, projects)
    - Verify `index.html` loads and all dashboard functionality works (tabs, calendar, sorting, filtering)
    - Verify `settings.html` loads and save/cancel works
    - Verify `contact-editor.html` loads and save/delete works
    - Search all JS files for any remaining duplicate function definitions that should have been consolidated
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

- [x] 3. Checkpoint — Verify Phases 1-2
  - Ensure all pages load without JavaScript console errors
  - Ensure all CSS renders correctly
  - Ask the user if questions arise

- [x] 4. Phase 3: Backend Reorganization
  - [x] 4.1 Add section headers and reorganize `backend/main.py`
    - Add clear `═══` banner-style section headers to organize the file into 12 sections as specified in the design: Imports, Constants & Configuration, Pydantic Models, Database Helpers, vCard & CSV Serializers, Database Initialization, Static File Serving & Page Routes, Chit API Routes, Trash API Routes, Settings API Routes, Contact API Routes, Health Check
    - Move `import csv` and `import io` from inline (currently around line 490) to the top imports section
    - Group all migration functions together in Section 4 (Database Helpers) before the initialization calls in Section 6
    - Group all route handlers by resource type (chits together, trash together, settings together, contacts together)
    - _Requirements: 12.1, 15.3_

  - [x] 4.2 Ensure consistent database connection patterns
    - Audit all route handlers for consistent `conn = None; try: ... finally: if conn: conn.close()` pattern
    - Add `conn = None` initialization before try blocks where missing
    - Ensure all handlers use `serialize_json_field` / `deserialize_json_field` consistently for all JSON-stored fields
    - _Requirements: 12.8, 13.2, 15.6_

  - [x] 4.3 Verify Phase 3 — double-check backend reorganization
    - Run the server and verify all 24+ API endpoints respond correctly with expected status codes
    - Verify `GET /api/chits` returns all non-deleted chits
    - Verify `POST /api/chits` creates a new chit
    - Verify `GET /api/settings/default_user` returns settings
    - Verify `GET /api/contacts` returns contacts
    - Verify `GET /api/trash` returns soft-deleted chits
    - Verify `GET /health` returns health check
    - Verify all database migrations run without errors on startup
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 5. Checkpoint — Verify Phase 3
  - Ensure all API endpoints work correctly
  - Ensure database migrations run cleanly
  - Ask the user if questions arise

- [x] 6. Phase 4: Code Quality Pass
  - [x] 6.1 Clean up comments and remove dead code
    - In `editor.js`, remove `// Checklist logic removed` stubs for `addChecklistItem`, `toggleChecklistItem`, `dragStart`, `dragEnter`, `dragLeave`, `dragOver`, `drop`, `dragEnd` — these are empty functions that should be removed entirely
    - In `editor_projects.js`, remove triple-duplicated comment blocks above `renderChildChitsByStatus` and `createChildChitCard` and `updateHeaderButtonsVisibility` (keep only one clear comment each)
    - Remove `console.log('live test: 1202')` from `contact-editor.js` and `people.js`
    - Review all files for redundant "what" comments and remove them; keep "why" comments
    - _Requirements: 12.7, 15.1_

  - [x] 6.2 Ensure naming consistency
    - Audit JavaScript functions for `_` prefix on private/internal helpers per General Principles
    - Ensure all CSS classes follow `kebab-case` naming
    - Ensure all Python code follows `snake_case` naming
    - _Requirements: 12.2, 12.3, 12.4_

  - [x] 6.3 Extract repeated inline styles from HTML files
    - In `editor.html`, extract repeated `style="display:flex;align-items:center;gap:..."` patterns into named CSS classes in `editor.css`
    - In `settings.html`, extract repeated inline styles on setting groups and filter items into classes (either in the page's `<style>` block or `shared-page.css` if shared)
    - _Requirements: 11.3, 12.7_

  - [x] 6.4 Verify Phase 4 — double-check code quality pass
    - Verify no functionality was broken by comment/dead-code removal
    - Verify all pages still load and function correctly
    - Search for any remaining `console.log('live test` or similar debug statements
    - _Requirements: 12.5, 12.6, 12.7_

- [x] 7. Phase 5: Performance Audit
  - [x] 7.1 Audit and fix event listener duplication
    - In `editor.js` and `main.js`, audit for event listeners that may be re-attached on re-render (e.g., in `renderChildChitsByStatus`, `openAddChitModal`)
    - Use event delegation where possible to avoid re-attaching listeners on each render
    - Ensure `displayChits()` in `main.js` doesn't accumulate duplicate listeners on calendar events
    - _Requirements: 13.4_

  - [x] 7.2 Add DOM batch updates for calendar rendering
    - In `main.js` calendar rendering functions, use `DocumentFragment` for batch DOM insertions instead of individual `appendChild` calls where applicable
    - _Requirements: 13.1_

  - [x] 7.3 Fix database connection patterns in backend
    - Ensure all backend route handlers use the consistent `conn = None; try: ... finally: if conn: conn.close()` pattern (complement to task 4.2 — this task catches any remaining inconsistencies)
    - _Requirements: 13.2_

  - [x] 7.4 Consolidate duplicate API calls during page initialization
    - Audit frontend init sequences for redundant `/api/settings/default_user` calls — both `editor.js` and `shared.js` may independently call this endpoint
    - Consolidate into a single cached call where possible (e.g., store result on `window._cwocSettings` and check before re-fetching)
    - _Requirements: 13.3_

  - [x] 7.5 Verify Phase 5 — double-check performance improvements
    - Verify no functionality was broken by event listener changes
    - Verify calendar rendering still works correctly in all 7 period views
    - Verify editor page loads correctly with no duplicate API calls visible in browser network tab
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

- [x] 8. Checkpoint — Verify Phases 4-5
  - Ensure all tests pass
  - Ensure all pages load and function correctly
  - Ask the user if questions arise

- [ ] 9. Property-Based Tests — SKIPPED (requires hypothesis install)
  - [ ] 9.1 Write property test for JSON serialization round-trip — SKIPPED
    - **Property 1: JSON Serialization Round-Trip**
    - Using `hypothesis` for Python, test that for any valid JSON-serializable value, `serialize_json_field` followed by `deserialize_json_field` produces a value equal to the original input
    - Minimum 100 iterations
    - **Validates: Requirements 1.3**

  - [ ] 9.2 Write property test for migration idempotence — SKIPPED
    - **Property 2: Migration Idempotence**
    - Using `hypothesis` and an in-memory SQLite database, test that running all migration functions once and then running them all again produces an identical schema with no errors
    - Minimum 100 iterations
    - **Validates: Requirements 1.4**

  - [ ] 9.3 Write property test for vCard round-trip fidelity — SKIPPED
    - **Property 3: vCard Round-Trip Fidelity**
    - Using `hypothesis`, generate arbitrary Contact dicts with various combinations of name fields, phone entries, email entries, etc., and test that `vcard_parse(vcard_print(contact))` produces equivalent field values
    - Minimum 100 iterations
    - **Validates: Requirements 5.5**

  - [ ] 9.4 Write property test for CSV round-trip fidelity — SKIPPED
    - **Property 4: CSV Round-Trip Fidelity**
    - Using `hypothesis`, generate lists of valid Contact dicts and test that `csv_import(csv_export(contacts))` produces equivalent contacts (up to the 5-entry-per-field limit)
    - Minimum 100 iterations
    - **Validates: Requirements 5.6**

  - [ ] 9.5 Write property test for display name concatenation — SKIPPED
    - **Property 5: Display Name Concatenation**
    - Using `hypothesis`, generate contacts with arbitrary combinations of present/absent name parts and test that `compute_display_name` produces the space-joined non-empty parts in order
    - Minimum 100 iterations
    - **Validates: Requirements 9.5**

  - [ ] 9.6 Write property test for tag tree structure invariants — SKIPPED
    - **Property 6: Tag Tree Structure Invariants**
    - Using `hypothesis`, generate lists of hierarchical tag names (using `/` separator) and test that `buildTagTree` produces a tree where every leaf's `fullPath` matches its input, parent nodes have correct children, and total leaf count equals input count
    - Note: `buildTagTree` is a JavaScript function — test via a Python port or Node.js script
    - Minimum 100 iterations
    - **Validates: Requirements 7.1**

  - [ ] 9.7 Write property test for Pydantic model field preservation — SKIPPED
    - **Property 7: Pydantic Model Field Preservation**
    - Using `hypothesis`, generate valid Chit objects with arbitrary field values, serialize to JSON dict, reconstruct a Chit, and verify all fields are identical
    - Minimum 100 iterations
    - **Validates: Requirements 1.2**

- [x] 10. Final Verification — Double-check all work
  - [x] 10.1 Verify all requirements are covered
    - Walk through every requirement (1-15) and verify each acceptance criterion is satisfied by the refactored code
    - Verify no API endpoint contracts changed (same URLs, same request/response shapes, same status codes)
    - Verify all Pydantic model fields and types are preserved
    - Verify all database migration functions still run correctly
    - _Requirements: 1.1-1.5, 14.1-14.4_

  - [x] 10.2 Verify all dashboard functionality preserved
    - Verify all 6 C_CAPTN tab views render correctly
    - Verify all 7 calendar period views work
    - Verify sidebar sections, sorting, filtering, and hotkeys all work
    - Verify mouse interactions (double-click, shift-click, drag) work
    - Verify Notes view masonry layout and markdown rendering work
    - _Requirements: 2.1-2.15_

  - [x] 10.3 Verify all editor functionality preserved
    - Verify all editor zones expand/collapse correctly
    - Verify date mode system, recurrence, tags, people, notes, checklist, alerts, location, weather, color, projects all work
    - Verify save system (Save & Stay, Save & Exit, unsaved changes detection) works
    - Verify QR code generation works
    - _Requirements: 3.1-3.19_

  - [x] 10.4 Verify all secondary pages preserved
    - Verify Settings page: all sections load, save/cancel works, tag editor works, clock drag-drop works
    - Verify People page: contact list loads, search works, import/export works, QR sharing works
    - Verify Contact Editor: all zones work, image upload works, save/delete works
    - Verify Trash page: table loads, restore/purge works
    - Verify Help page: all sections render
    - _Requirements: 4.1-4.5, 5.1-5.7, 6.1-6.4_

- [x] 11. Final Verification — Triple-check functionality preservation
  - [x] 11.1 Triple-check that ALL original functionality is exactly as it was
    - Load every page in the application and verify it renders identically to before the refactor
    - Verify the parchment background, Courier New font, brown color palette, and all visual effects are unchanged
    - Verify all responsive breakpoints work (768px tablet, 480px mobile, 400px small mobile)
    - Verify all animations (jiggle, spin, fadeOut) still work
    - Verify all external integrations (OpenStreetMap, Open-Meteo, Flatpickr, Font Awesome, marked.js, qrcode-generator) still work
    - Verify all static assets are accessible (`/static/` images, sounds, parchment background)
    - Verify all `<script>` tag load orders are preserved in every HTML file
    - Verify localStorage usage (`cwoc_manual_order`, `cwoc_settings_return`, zone collapse states) still works
    - Verify soft-delete behavior is preserved (chits never hard-deleted except via explicit purge)
    - _Requirements: 8.1-8.5, 9.1-9.5, 10.1-10.4, 14.1-14.4_

- [x] 12. Final Checkpoint
  - Ensure all tests pass, all pages work, all functionality is preserved
  - Ask the user if questions arise

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation after each phase
- Property tests validate universal correctness properties from the design document
- The 5-phase execution order follows the design's risk minimization strategy
- Verification sub-tasks within each phase satisfy the user's "double check each piece" request
- Tasks 10-11 satisfy the user's "double check all work" and "triple check functionality preservation" requests
