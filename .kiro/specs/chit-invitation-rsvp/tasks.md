# Implementation Plan: Chit Invitation RSVP

## Overview

Add an invitation/RSVP system to the existing chit sharing mechanism. Each share entry gains an `rsvp_status` field (`invited`, `accepted`, `declined`). A new PATCH endpoint lets shared users update their own RSVP status. Declined chits get faded visual treatment, and a per-user `hide_declined` setting can hide them entirely. Implementation follows: migration → backend API → frontend dashboard → frontend editor → settings → tests → version bump.

## Tasks

- [x] 1. Database migration and model updates
  - [x] 1.1 Add `migrate_add_hide_declined()` to `src/backend/migrations.py`
    - Add a new migration function that adds `hide_declined` column (TEXT DEFAULT '0') to the `settings` table
    - Use the existing idempotent pattern: check column existence via `PRAGMA table_info(settings)` before `ALTER TABLE`
    - _Requirements: 5.5_
  - [x] 1.2 Register the migration in `src/backend/main.py`
    - Import `migrate_add_hide_declined` from `src.backend.migrations`
    - Call it after `migrate_add_kiosk_users()` in the migration sequence
    - _Requirements: 5.5_
  - [x] 1.3 Add `hide_declined` field to the `Settings` Pydantic model in `src/backend/models.py`
    - Add `hide_declined: Optional[str] = "0"` to the `Settings` class
    - _Requirements: 5.5_
  - [x] 1.4 Add `hide_declined` to the settings route in `src/backend/routes/settings.py`
    - Add `hide_declined` to the `get_settings` response deserialization (it's a plain TEXT, no JSON parse needed)
    - Add `hide_declined` to the `save_settings` INSERT OR REPLACE query — both the column list and the VALUES tuple
    - Add `hide_declined` to the `new_settings_dict` used for audit diffing
    - _Requirements: 5.5, 5.6_

- [x] 2. Backend RSVP endpoint and share normalization
  - [x] 2.1 Add RSVP normalization to `src/backend/sharing.py`
    - In `_deserialize_chit_fields()`, after deserializing `shares`, normalize each share entry: if `rsvp_status` is missing, set it to `"invited"`
    - In `get_shared_chits_for_user()`, ensure the same normalization applies to share entries returned in the API response
    - _Requirements: 1.3, 1.4_
  - [x] 2.2 Add `rsvp_status` to `getSharingData()` clean shares in `src/frontend/js/editor/editor-sharing.js`
    - Update the `cleanShares` mapping in `getSharingData()` to include `rsvp_status` alongside `user_id` and `role`, so RSVP status is preserved through chit saves
    - _Requirements: 1.4_
  - [x] 2.3 Add `PATCH /api/chits/{chit_id}/rsvp` endpoint to `src/backend/routes/chits.py`
    - Validate `rsvp_status` is one of `invited`, `accepted`, `declined` — return 400 if invalid
    - Load the chit from the database
    - Verify the requesting user is NOT the owner — return 403 if owner
    - Verify the requesting user IS in the shares list — return 404 if not found
    - Update the user's `rsvp_status` in the shares JSON array
    - Save the updated shares back to the database with `modified_datetime`
    - Log an audit entry for the RSVP change
    - Return `{ "message": "RSVP status updated", "rsvp_status": "<value>" }`
    - _Requirements: 2.2, 2.3, 2.6, 2.7, 2.8_
  - [x] 2.4 Add `rsvp_status` default to new share entries in `src/frontend/js/editor/editor-people.js`
    - In `_addShare()`, include `rsvp_status: 'invited'` in the share entry pushed to `_currentShares`
    - _Requirements: 1.1, 1.2_

- [x] 3. Checkpoint — Ensure backend works
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Dashboard frontend — RSVP controls and visual treatment
  - [x] 4.1 Add `_isDeclinedByCurrentUser()` helper to `src/frontend/js/dashboard/main-views.js`
    - Implement a function that checks if the current user's `rsvp_status` is `declined` on a shared chit
    - Uses `getCurrentUser()` to get the current user ID, then scans the chit's `shares` array
    - Returns `false` for owned chits (no RSVP for owners)
    - _Requirements: 4.1, 5.2_
  - [x] 4.2 Add `_getUserRsvpStatus()` helper to `src/frontend/js/dashboard/main-views.js`
    - Returns the current user's `rsvp_status` from a chit's shares array, or `null` if not a shared user
    - _Requirements: 2.1, 3.1_
  - [x] 4.3 Add RSVP action controls to `_buildChitHeader()` in `src/frontend/js/dashboard/main-views.js`
    - For shared chits where the current user is in the shares list (not the owner), render accept (✓) and decline (✗) buttons in the header meta area
    - Buttons call `PATCH /api/chits/{id}/rsvp` with the appropriate status
    - Active button is highlighted (green tint for accepted, red tint for declined)
    - On success, refresh the chit list via `fetchChits()`
    - On error, log to console and revert button state
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  - [x] 4.4 Add RSVP status indicators to `_buildChitHeader()` in `src/frontend/js/dashboard/main-views.js`
    - For chits with shares, display small RSVP status indicators in the header meta area
    - `invited`: ⏳ neutral style, `accepted`: ✓ green-tinted, `declined`: ✗ muted style
    - Each indicator shows the shared user's display name on hover (tooltip)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  - [x] 4.5 Add declined chit CSS class to `src/frontend/css/dashboard/styles-cards.css`
    - Add `.chit-card.declined-chit` with `opacity: 0.35`
    - Add `.chit-card.declined-chit:hover` with `opacity: 0.7`
    - _Requirements: 4.1, 4.2, 4.3_
  - [x] 4.6 Apply declined class in all six dashboard views
    - In `displayChecklistView`, `displayTasksView`, `displayNotesView`, `displayProjectsView`, `displayAlarmsView`, and calendar views: after creating a chit card element, check `_isDeclinedByCurrentUser(chit)` and add the `declined-chit` class if true
    - For calendar events (timed-event, month-event, all-day-event, itinerary-event), apply the same faded treatment
    - _Requirements: 4.1, 7.1_
  - [x] 4.7 Add hide-declined filtering to `displayChits()` in `src/frontend/js/dashboard/main-init.js`
    - After the existing `hideComplete` filter, add a `hide_declined` filter
    - Read the `hide_declined` setting from `window._cwocSettings`
    - If enabled (`"1"`), filter out chits where `_isDeclinedByCurrentUser(chit)` returns true
    - _Requirements: 5.2, 7.2_

- [x] 5. Quick-edit modal RSVP controls
  - [x] 5.1 Add RSVP row to `showQuickEditModal()` in `src/frontend/js/shared/shared.js`
    - For shared chits (where `chit._shared` is true and the current user is in the shares list), add an RSVP row with accept/decline buttons
    - Buttons call `PATCH /api/chits/{id}/rsvp` and refresh on success
    - Consistent styling with the chit card RSVP controls
    - _Requirements: 2.5_
    
- [x] 7. Editor frontend — RSVP status display
  - [x] 7.1 Add RSVP status badges to shared user chips in `src/frontend/js/editor/editor-people.js`
    - In `_renderPeopleChips()`, for each shared user row, add a small colored badge showing the user's `rsvp_status`
    - Use consistent visual indicators: `invited` = ⏳, `accepted` = ✓ green, `declined` = ✗ muted
    - _Requirements: 6.1, 6.2_
  - [x] 7.2 Add accept/decline controls for the current user in the editor
    - In `_renderPeopleChips()`, if the current user is a shared user (not the owner), show accept/decline buttons next to their RSVP badge
    - Buttons call `PATCH /api/chits/{id}/rsvp` and update the local `_currentShares` state on success
    - Owner and manager roles cannot change another user's RSVP status — only the user themselves
    - _Requirements: 6.3, 6.4_

- [x] 8. Settings page — Hide declined toggle
  - [x] 8.1 Add "Hide declined chits" checkbox to `src/frontend/html/settings.html`
    - Add a checkbox in the General Settings group with label "Hide declined chits"
    - Use `id="hide-declined-toggle"` and existing `setting-inline` / `cwoc-checkbox-label` classes
    - _Requirements: 5.1, 5.4_
  - [x] 8.2 Wire the toggle into settings load/save in `src/frontend/js/pages/settings.js`
    - In the settings load flow, read `hide_declined` from the API response and set the checkbox state
    - In the settings save flow, include `hide_declined` in the settings object sent to `POST /api/settings`
    - Call `setSaveButtonUnsaved()` on checkbox change
    - _Requirements: 5.1, 5.3, 5.6_


- [x] 10. Backend tests
  - [x] 10.1 Write property test for RSVP status validation (Property 1)
    - Create `src/backend/test_rsvp.py` using `unittest` + `random` (no external libraries)
    - **Property 1: RSVP status is always valid** — Generate random share entries with random `rsvp_status` values (valid and invalid). Verify that after normalization, all entries have `rsvp_status` in `{"invited", "accepted", "declined"}`. Minimum 100 iterations.
    - **Validates: Requirements 1.1, 1.2**
  - [x] 10.2 Write property test for missing rsvp_status normalization (Property 2)
    - **Property 2: Missing rsvp_status normalized to invited** — Generate random share entries without `rsvp_status`. Pass through normalization logic. Assert all entries have `rsvp_status == "invited"`. Minimum 100 iterations.
    - **Validates: Requirements 1.3**
  - [x] 10.3 Write property test for RSVP round-trip preservation (Property 3)
    - **Property 3: RSVP status round-trip preservation** — Generate random share entries with valid `rsvp_status` values. Serialize to JSON, deserialize, normalize. Assert `rsvp_status` values are identical. Minimum 100 iterations.
    - **Validates: Requirements 1.4**
  - [x] 10.4 Write property test for RSVP update authorization (Property 4)
    - **Property 4: RSVP update authorization** — Generate random user IDs, owner IDs, and shares lists. Verify that RSVP update succeeds only when: (a) user is in shares, (b) user is not owner, (c) status is valid. All other combinations are rejected. Minimum 100 iterations.
    - **Validates: Requirements 2.4, 2.6, 2.7, 2.8, 6.4**
  - [x] 10.5 Write property test for owner exclusion from RSVP (Property 5)
    - **Property 5: Owner exclusion from RSVP** — Generate random chits with shares. Verify the owner never appears in shares with an `rsvp_status` field, and RSVP update requests from the owner are rejected. Minimum 100 iterations.
    - **Validates: Requirements 2.8**
  - [x] 10.6 Write property test for hide-declined filtering (Property 6)
    - **Property 6: Hide declined filtering correctness** — Generate random sets of chits with various RSVP statuses. Apply hide-declined filter. Assert zero declined chits remain and all non-declined chits are preserved. Minimum 100 iterations.
    - **Validates: Requirements 5.2, 7.2**
  - [x] 10.7 Write property test for hide-declined setting round-trip (Property 7)
    - **Property 7: Hide declined setting round-trip** — Generate random boolean values, convert to "0"/"1" strings, simulate save and load. Assert the loaded value matches the saved value. Minimum 100 iterations.
    - **Validates: Requirements 5.5**

- [x] 11. Final updates
  - [x] 11.1 Update `src/INDEX.md` with new functions, routes, and CSS sections
    - Add the `PATCH /api/chits/{chit_id}/rsvp` endpoint to section 1.19
    - Add `migrate_add_hide_declined()` to section 1.5
    - Add `hide_declined` to the Settings model in section 1.3
    - Add new frontend functions (`_isDeclinedByCurrentUser`, `_getUserRsvpStatus`, RSVP controls) to the appropriate JS sections
    - Add `.declined-chit` CSS class to the styles-cards.css section
    - Add test file `test_rsvp.py` to the backend test sections
    - _Requirements: all_
  - [x] 11.2 Update release notes and version
    - Run `date "+%Y%m%d.%H%M"` and write the result to `src/VERSION`
    - Create/update `documents/release_notes/cwoc_release_<version>.md` with a brief summary of the RSVP feature
    - _Requirements: all_

- [x] 12. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests use Python's built-in `random` and `unittest` modules (no external PBT libraries)
- All JS is vanilla — no modules, no imports, just script tags
- No software installation tasks — no pip, no npm, no hypothesis
- The backend uses Python with FastAPI; the frontend uses vanilla JS/HTML/CSS
- RSVP normalization is backward-compatible — existing share entries without `rsvp_status` are treated as `invited`
