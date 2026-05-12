# Implementation Plan: Auto-Save

## Overview

Implement an auto-save feature for the chit editor that automatically persists edits after a 2-second debounce period. The feature is controlled by per-platform (mobile/desktop) toggles in user settings, uses the existing `saveChitAndStay()` function for persistence, and provides visual feedback via a save status indicator. The implementation spans backend (migration + settings model + API), frontend settings UI (toggles), and frontend editor logic (auto-save system with debounce, validation, status indicator, and exit handling).

## Tasks

- [x] 1. Add database migration for auto-save settings columns
  - [x] 1.1 Add migration function `migrate_add_autosave_settings` in `src/backend/migrations.py`
    - Check if `autosave_desktop` column exists on `settings` table; if not, add it as `TEXT DEFAULT '0'`
    - Check if `autosave_mobile` column exists on `settings` table; if not, add it as `TEXT DEFAULT '0'`
    - Follow the existing migration pattern (connect, PRAGMA table_info, ALTER TABLE, commit, close)
    - _Requirements: 8.1, 8.2, 8.3_
  - [x] 1.2 Register the migration in `src/backend/main.py` startup sequence
    - Import `migrate_add_autosave_settings` from `src.backend.migrations`
    - Call it in the migration sequence alongside existing migrations
    - _Requirements: 8.1, 8.2_

- [x] 2. Update backend Settings model and API to support auto-save fields
  - [x] 2.1 Add `autosave_desktop` and `autosave_mobile` fields to the `Settings` Pydantic model in `src/backend/models.py`
    - Both fields: `Optional[str] = "0"` (matching the `"1"`/`"0"` string pattern used by `checklist_autosave`, `hide_declined`, etc.)
    - _Requirements: 1.1, 1.2_
  - [x] 2.2 Update `get_settings` in `src/backend/routes/settings.py` to return the new fields
    - Add `settings["autosave_desktop"] = settings.get("autosave_desktop", "0")` and same for mobile
    - _Requirements: 1.3_
  - [x] 2.3 Update `save_settings` in `src/backend/routes/settings.py` to persist the new fields
    - Add `autosave_desktop` and `autosave_mobile` to `new_settings_dict`, the INSERT OR REPLACE column list, and the values tuple
    - _Requirements: 1.4_

- [x] 3. Checkpoint - Ensure backend changes are consistent
  - Ensure all backend changes compile cleanly and the migration, model, and route changes are wired together. Ask the user if questions arise.

- [x] 4. Add auto-save toggles to the Settings page UI
  - [x] 4.1 Add HTML toggle checkboxes in `src/frontend/html/settings.html`
    - Add two checkboxes in the "Chit Options" section (near the existing `checklist-autosave-toggle`): "Auto-save on Desktop" (`id="autosave-desktop-toggle"`) and "Auto-save on Mobile" (`id="autosave-mobile-toggle"`)
    - _Requirements: 2.1, 2.2_
  - [x] 4.2 Update settings load logic in `src/frontend/js/pages/settings.js` to populate the toggles
    - When settings are fetched, set `checked` state of `autosave-desktop-toggle` based on `settings.autosave_desktop === "1"` and same for mobile
    - _Requirements: 2.3_
  - [x] 4.3 Update settings save logic in `src/frontend/js/pages/settings.js` to include the new fields
    - When building the settings payload for POST, include `autosave_desktop: document.getElementById('autosave-desktop-toggle').checked ? "1" : "0"` and same for mobile
    - _Requirements: 2.4_

- [x] 5. Implement the auto-save system in the editor
  - [x] 5.1 Create `src/frontend/js/editor/editor-autosave.js` with the `CwocAutoSave` class
    - Platform detection: use `window.innerWidth <= 768` for mobile (matching `_isMobileOverlay()` threshold)
    - Read the appropriate setting (`autosave_mobile` or `autosave_desktop`) from the settings object loaded at editor init
    - Debounce timer: 2000ms after last change, reset on each new change
    - Trigger: call existing `saveChitAndStay()` when debounce expires
    - Validation gate: before saving, call `buildChitObject()` — if it returns null, skip save silently
    - In-flight guard: do not trigger a new save while `_isSaving` is true; schedule retry after current save completes
    - Resize listener: re-evaluate platform setting when viewport crosses 768px boundary
    - Expose methods: `enable()`, `disable()`, `scheduleAutoSave()`, `cancelPending()`, `isEnabled()`, `getState()` (returns 'saved'|'pending'|'saving'|'error')
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 7.1, 7.2, 7.3, 7.4_
  - [x] 5.2 Add the `<script>` tag for `editor-autosave.js` in `src/frontend/html/editor.html`
    - Load after `editor-save.js` and before `editor-init.js` (since it depends on `saveChitAndStay` and `buildChitObject`)
    - _Requirements: 3.1_
  - [x] 5.3 Initialize auto-save in `src/frontend/js/editor/editor-init.js`
    - After settings are loaded and the editor is populated, instantiate `CwocAutoSave` with the settings object
    - Hook into the existing `setSaveButtonUnsaved()` function to call `autoSave.scheduleAutoSave()` when changes are detected
    - Hook into `setSaveButtonSaved()` to notify auto-save that a save completed (for state tracking)
    - _Requirements: 3.1, 4.1_

- [x] 6. Implement the save status indicator UI
  - [x] 6.1 Add save indicator HTML element in `src/frontend/html/editor.html`
    - Add a `<span id="autosave-indicator">` in the header buttons area (visible only when auto-save is enabled)
    - States: "✅ Saved", "⏳ Saving soon...", "💾 Saving...", "⚠️ Save failed"
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  - [x] 6.2 Add indicator state management in `editor-autosave.js`
    - Update indicator text/class based on current state (saved/pending/saving/error)
    - When auto-save is enabled: hide "Save & Stay" and "Save & Exit" buttons, show only indicator + "Exit" button
    - When auto-save is disabled: leave existing button behavior unchanged
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  - [x] 6.3 Add CSS styles for the auto-save indicator in `src/frontend/css/editor/editor.css`
    - Style the indicator states (saved=green, pending=amber, saving=blue, error=red) using the parchment theme colors
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 7. Implement auto-save exit behavior
  - [x] 7.1 Update `cancelOrExit()` in `editor-save.js` (or `editor-autosave.js`) to handle auto-save exit
    - If auto-save enabled and changes pending: trigger immediate save, then navigate on success
    - If auto-save enabled and save in progress: wait for completion, then navigate
    - If auto-save enabled and all saved: navigate immediately without prompt
    - If immediate save fails: show Discard/Retry modal
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 8. Checkpoint - Ensure all auto-save functionality works end-to-end
  - Ensure all changes compile cleanly and the auto-save system integrates with the existing editor save flow. Ask the user if questions arise.

- [ ]* 9. Write unit tests for auto-save backend settings
  - Test that GET `/api/settings/{user_id}` returns `autosave_desktop` and `autosave_mobile` with correct defaults
  - Test that POST `/api/settings` persists the new fields
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ]* 10. Write unit tests for auto-save frontend logic
  - Test debounce timer reset behavior
  - Test platform detection at various viewport widths
  - Test validation gate (skip save when buildChitObject returns null)
  - Test in-flight guard (no double-saves)
  - _Requirements: 3.1, 3.2, 3.3, 7.1, 7.3_

- [x] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- The auto-save system reuses the existing `saveChitAndStay()` function rather than implementing a separate save path
- Platform detection reuses the same 768px threshold as `_isMobileOverlay()`
- Settings follow the existing `"1"`/`"0"` string pattern used by `checklist_autosave`, `hide_declined`, etc.
