# Implementation Plan: Sharing UI Overhaul

## Overview

This plan implements the sharing UI overhaul for CWOC, building on the completed chit-sharing-system spec. Tasks are ordered: backend permission change first, then HTML structure changes, then frontend JS logic (merged people zone, assigned-to in task zone, owner chip, dashboard icon), then CSS, then tests, then final wiring. Each task builds on the previous ones so there is no orphaned code.

## Tasks

- [x] 1. Backend: Update permission check for managers
  - [x] 1.1 Update `can_manage_sharing()` in `src/backend/sharing.py`
    - Change `can_manage_sharing()` to return `True` when the user's effective role is `owner` or `manager` (currently returns `True` only for owner)
    - Call `resolve_effective_role()` internally and check for `role in ("owner", "manager")`
    - _Requirements: 2.1_

  - [x] 1.2 Update the manager guard in `PUT /api/chits/{chit_id}` in `src/backend/routes/chits.py`
    - Replace the `if not is_owner:` guard that preserves `shares`, `stealth`, and `assigned_to` with a `can_manage_sharing()` check
    - Import `can_manage_sharing` from `src/backend/sharing` if not already imported
    - The existing block `if not is_owner: chit.shares = ...; chit.stealth = ...; chit.assigned_to = ...` becomes `if not can_manage_sharing(existing_dict_check, user_id, owner_settings): ...`
    - _Requirements: 2.1, 2.3, 2.4_

  - [x] 1.3 Write property test: Managers can manage sharing
    - **Property 7: Managers can manage sharing**
    - **Validates: Requirements 2.1, 2.3, 2.4**
    - Add a new test class to `src/backend/test_sharing.py` using the existing lightweight custom generator pattern (no hypothesis)
    - Update the inlined `can_manage_sharing()` at the top of the test file to match the new production logic
    - Generate random chits with various sharing configurations (owner, manager, viewer, no access); verify `can_manage_sharing()` returns `True` for owner and manager, `False` for viewer and `None`
    - Minimum 120 iterations

- [x] 2. Checkpoint — Ensure all backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Editor HTML: Restructure zones for merged People zone and assigned-to in Task zone
  - [x] 3.1 Remove the `sharingSection` zone from `src/frontend/html/editor.html`
    - Remove the entire `sharingSection` / `sharingContent` zone container and its contents
    - Remove the `<script>` tag for `editor-sharing.js` (the file will be repurposed as a data-layer module loaded by `editor-people.js`)
    - _Requirements: 1.1_

  - [x] 3.2 Add the assigned-to dropdown to the Task zone in `src/frontend/html/editor.html`
    - Add a `<div class="sharing-assigned-row" id="sharingAssignedRow" style="display:none;">` inside `#taskContent`, after the `priority-status-group` div
    - Inside it, add a `<label>` and `<select id="sharingAssignedTo">` with a default `<option value="">— None —</option>`
    - _Requirements: 3.1, 3.2_

  - [x] 3.3 Add the owner chip container to the title zone in `src/frontend/html/editor.html`
    - Add a `<span id="cwoc-owner-chip-container"></span>` inside the title label area, inline with "Title" and the pinned icon (inside the `<label for="title">` element)
    - _Requirements: 5.2_

- [x] 4. Frontend JS: Repurpose `editor-sharing.js` as a thin data-layer module
  - [x] 4.1 Refactor `src/frontend/js/editor/editor-sharing.js` to remove UI rendering
    - Remove all UI rendering functions (`initSharingZone`, `initSharingZoneForNewChit`, `_populateUserPicker`, `_populateAssignedToPicker`, `_renderSharesList`, `addShare`, `_removeShare`, `onStealthToggle`, `onAssignedToChange`)
    - Keep `_loadSharingUserList()` (fetches `/api/auth/switchable-users` and caches in `_sharingUserList`)
    - Keep `getSharingData()` — update it to read `_currentShares` from `editor-people.js` globals, stealth checkbox, and assigned-to dropdown
    - Keep `hasSharingData()` for `applyZoneStates`
    - Keep `_getUserDisplayName()` for looking up display names from the cached user list
    - Export `_sharingUserList` as a global so `editor-people.js` can access it
    - _Requirements: 1.1_

- [x] 5. Frontend JS: Merge system users into People zone (`editor-people.js`)
  - [x] 5.1 Add system user fetching and caching to `src/frontend/js/editor/editor-people.js`
    - Add `_allUsersCache` array variable (system users from `/api/auth/switchable-users`)
    - Add `_currentShares` array variable (moved from `editor-sharing.js`)
    - Add `_sharingInitialized` boolean variable
    - Add `_loadAllUsersForTree()` async function that fetches `/api/auth/switchable-users`, caches in `_allUsersCache`, and calls `_renderPeopleTree()`
    - Call `_loadAllUsersForTree()` from `_initPeopleAutocomplete()` alongside the existing `_loadAllContactsForTree()`
    - _Requirements: 1.2_

  - [x] 5.2 Extend `_renderPeopleTree()` to include system users with pill toggles
    - After grouping contacts by first letter, also group system users by first letter of `display_name`
    - Merge both groups into the same alphabetical tree
    - Contacts render as plain chips (existing behavior, no pill toggle)
    - System users render as chips with an inline `cwoc-pill-toggle` after the chip, containing two `<span data-val>` options: `👁️ Viewer` and `✏️ Manager`
    - Follow the same `cwoc-pill-toggle` pattern from `settings.js` (highlighted active option, dimmed inactive option)
    - Exclude the currently authenticated user (owner) from the system user list
    - Shared users appear with their pill toggle set to the current role
    - Unshared users appear with a dimmed pill toggle
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.10_

  - [x] 5.3 Implement pill toggle click behavior and share management
    - Clicking an unshared system user chip adds them to `_currentShares` with `viewer` role and calls `setSaveButtonUnsaved()`
    - Clicking the pill toggle on a shared user flips between `viewer` and `manager` in `_currentShares` and calls `setSaveButtonUnsaved()`
    - Clicking the ✕ button on a shared user removes them from `_currentShares` and calls `setSaveButtonUnsaved()`
    - All mutations also call `_syncAssignedToDropdown()` to keep the Task zone dropdown in sync
    - _Requirements: 1.7, 1.8, 1.9_

  - [x] 5.4 Add stealth toggle at the bottom of the People zone
    - Render a stealth toggle checkbox at the very bottom of `#peopleContent`, below the tree and chips areas
    - Use the same `🥷 Stealth — hide from all other users` label
    - `onchange` calls `setSaveButtonUnsaved()`
    - Hidden for viewers, visible for owners and managers
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 5.5 Add sharing initialization function for existing and new chits
    - Add `initPeopleSharingControls(chit)` function called from `loadChitData()` in `editor-init.js`
    - Loads `_currentShares` from `chit.shares`, sets stealth toggle state, determines effective role
    - For viewers: hide pill toggles and stealth toggle (read-only mode)
    - For managers and owners: show full sharing controls
    - Add `initPeopleSharingForNewChit()` function for new chits (empty shares, stealth off)
    - _Requirements: 2.2, 2.5_

  - [x] 5.6 Update `getSharingData()` to read from the merged People zone state
    - Update the `getSharingData()` function (in `editor-sharing.js` or `editor-people.js`) to read `_currentShares`, stealth checkbox in people zone, and assigned-to dropdown in task zone
    - Ensure `buildChitObject()` in `editor-save.js` continues to call `getSharingData()` correctly
    - _Requirements: 1.6, 1.8, 1.9_

- [x] 6. Frontend JS: Assigned-to dropdown in Task zone
  - [x] 6.1 Implement `_syncAssignedToDropdown()` in `src/frontend/js/editor/editor-people.js`
    - Show/hide the `#sharingAssignedRow` based on `_currentShares.length > 0`
    - Populate `#sharingAssignedTo` options with only users present in `_currentShares` (plus a "None" option)
    - If the currently assigned user is removed from shares, clear the assigned-to value and call `setSaveButtonUnsaved()`
    - Called on every shares mutation (add, remove, role change)
    - _Requirements: 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 7. Frontend JS: Owner chip in title zone
  - [x] 7.1 Render the owner chip in `loadChitData()` in `src/frontend/js/editor/editor-init.js`
    - Remove the old `cwoc-editor-owner-info` div creation below the title
    - Create an owner chip element inside `#cwoc-owner-chip-container` using the same structure as people chips: `<span class="people-chip cwoc-owner-chip">` with background color, `<span class="chip-thumb">` with `<img>` (if `profile_image_url` exists) or `?` placeholder, and `<span>` with the owner's display name
    - Always display the owner chip, even when the current user is the owner
    - For new chits, show the current user's own chip
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [x] 8. Frontend JS: Dashboard shared icon with tooltip
  - [x] 8.1 Update `_buildChitHeader()` in `src/frontend/js/dashboard/main-views.js`
    - Replace the owner badge block for shared chits: instead of `👤 Owner Name` text badge, render a `<span class="cwoc-shared-icon">🔗</span>`
    - Build a tooltip string containing: owner display name, list of shared users with roles (from `chit.shares`), and the current user's effective role
    - Set the tooltip as the `title` attribute on the `🔗` span
    - For non-shared chits (no `effective_role`): no icon, no badge
    - Remove the separate `cwoc-role-badge` span since the tooltip now contains this information
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 9. Frontend JS: Update `editor-init.js` wiring
  - [x] 9.1 Update `loadChitData()` to call the new People zone sharing initialization
    - Replace the `initSharingZone(chit)` call with `initPeopleSharingControls(chit)`
    - _Requirements: 1.2, 2.2, 2.5_

  - [x] 9.2 Update `resetEditorForNewChit()` to call the new People zone sharing initialization
    - Replace the `initSharingZoneForNewChit()` call with `initPeopleSharingForNewChit()`
    - _Requirements: 1.2_

  - [x] 9.3 Update `applyZoneStates()` to remove the `sharingSection` entry
    - Remove the `["sharingSection", "sharingContent", ...]` entry from the zones array
    - Update the `peopleSection` entry to also check for sharing data (shares, stealth) when deciding whether to expand
    - _Requirements: 1.1_

  - [x] 9.4 Update `_collapseAllZonesForNewChit()` to remove the `sharingSection` entry
    - Remove `['sharingSection', 'sharingContent']` from the `allZones` array
    - _Requirements: 1.1_

- [x] 10. Frontend CSS: Styles for the overhaul
  - [x] 10.1 Add pill toggle styles for system user chips in `src/frontend/css/editor/editor.css`
    - Style the `cwoc-pill-toggle` on user chips: inline display, two `data-val` spans, highlighted active option, dimmed inactive option
    - Match the visual pattern from the settings page sex selector
    - _Requirements: 1.4, 1.5_

  - [x] 10.2 Add owner chip styles in `src/frontend/css/editor/editor.css`
    - Style `cwoc-owner-chip` in the title zone: inline with "Title" label and pin icon, matching people chip visual style (background color, thumbnail, display name)
    - Style `#cwoc-owner-chip-container` for proper inline layout
    - _Requirements: 5.2, 5.3_

  - [x] 10.3 Add assigned-to row styles in `src/frontend/css/editor/editor.css`
    - Style `.sharing-assigned-row` inside the task zone: label + dropdown layout matching the existing Status/Priority/Severity pattern
    - _Requirements: 3.2_

  - [x] 10.4 Add stealth toggle styles in `src/frontend/css/editor/editor.css`
    - Style the stealth toggle at the bottom of the people zone: checkbox + label with 🥷 icon, matching the existing stealth toggle visual style
    - _Requirements: 6.1, 6.2_

  - [x] 10.5 Add shared icon styles to `src/frontend/css/dashboard/styles-cards.css`
    - Style `.cwoc-shared-icon` for the 🔗 icon on dashboard chit cards: compact, inline, with cursor pointer for hover tooltip
    - _Requirements: 4.1_

- [x] 11. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Property-based tests for the overhaul
  - [x] 12.1 Write property test: Managers can manage sharing (updated `can_manage_sharing`)
    - **Property 7: Managers can manage sharing**
    - **Validates: Requirements 2.1, 2.3, 2.4**
    - Add test class `TestProperty7ManagersCanManageSharing` to `src/backend/test_sharing.py`
    - Update the inlined `can_manage_sharing()` at the top of the test file to use `resolve_effective_role()` and check for `role in ("owner", "manager")`
    - Generate random chits with owner, manager, viewer, and no-access users; verify `can_manage_sharing()` returns `True` for owner and manager, `False` for viewer and `None`
    - Use the existing custom generator pattern (`_random_chit`, `_random_shares`, `_random_uuid`, etc.) — no hypothesis
    - Minimum 120 iterations
    - Tag: `Feature: sharing-ui-overhaul, Property 7: Managers can manage sharing`

- [x] 13. Final wiring and documentation
  - [x] 13.1 Update `src/INDEX.md` with all changed files and new functions
    - Update entries for `src/backend/sharing.py` (`can_manage_sharing` signature change)
    - Update entries for `src/backend/routes/chits.py` (manager guard change)
    - Update entries for `src/frontend/js/editor/editor-people.js` (new functions: `_loadAllUsersForTree`, `_syncAssignedToDropdown`, `initPeopleSharingControls`, `initPeopleSharingForNewChit`, new variables: `_allUsersCache`, `_currentShares`, `_sharingInitialized`)
    - Update entries for `src/frontend/js/editor/editor-sharing.js` (removed UI functions, kept data-layer functions)
    - Update entries for `src/frontend/js/editor/editor-init.js` (owner chip rendering, updated wiring)
    - Update entries for `src/frontend/js/dashboard/main-views.js` (🔗 icon with tooltip replacing owner badge)
    - Update entries for modified HTML and CSS files
    - _Requirements: all_

  - [x] 13.2 Update help & reference documentation if applicable
    - Update any help page content that references the separate Sharing zone or the old owner badge
    - _Requirements: all_

  - [x] 13.3 Write release notes to `release_notes.md`
    - Brief summary of the sharing UI overhaul changes
    - _Requirements: all_

  - [x] 13.4 Update `src/VERSION` with current timestamp
    - Run `date "+%Y%m%d.%H%M"` and write the result to `src/VERSION`
    - This must be the very last step
    - _Requirements: all_

- [x] 14. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests use the existing lightweight custom generator pattern in `test_sharing.py` (random chit dicts, 120+ iterations per property) — NOT hypothesis
- No tasks install software — all dependencies are already available
- No tasks require running the server — use automated tests only
- All JS is vanilla — no modules, no imports, no build step
- SQLite3 via Python stdlib, no ORM; Pydantic v1 models
- VERSION update is the very last step only
- The `editor-sharing.js` file is repurposed (not deleted) to preserve the data-layer functions (`getSharingData`, `_loadSharingUserList`, `hasSharingData`) that other files depend on
