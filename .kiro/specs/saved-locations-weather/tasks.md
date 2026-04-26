# Implementation Plan: Saved Locations & Weather

## Overview

This plan implements saved locations management, fixes broken weather loading in the editor, adds a dashboard weather modal, and enhances the editor's Location zone with saved-location controls. Work proceeds backend-first (schema + API), then shared utilities, then each frontend page in turn, finishing with integration wiring.

## Tasks

- [x] 1. Backend: Add saved_locations to Settings model and database
  - [x] 1.1 Add `saved_locations` field to the `Settings` Pydantic model in `backend/main.py`
    - Add `saved_locations: Optional[str] = None` to the Settings class (JSON string, same pattern as `active_clocks`)
    - _Requirements: 3.1, 3.2_

  - [x] 1.2 Add migration function `migrate_add_saved_locations()` in `backend/main.py`
    - Check if `saved_locations` column exists on the `settings` table; if not, `ALTER TABLE settings ADD COLUMN saved_locations TEXT`
    - Call the migration at startup alongside the other migration calls
    - _Requirements: 3.5_

  - [x] 1.3 Update GET `/api/settings/{user_id}` to deserialize `saved_locations`
    - Use `deserialize_json_field()` on the `saved_locations` column before returning
    - _Requirements: 3.3_

  - [x] 1.4 Update POST `/api/settings` to serialize and persist `saved_locations`
    - Include `saved_locations` in the INSERT OR REPLACE column list
    - Use `serialize_json_field()` before writing
    - _Requirements: 3.4_

  - [x] 1.5 Write property test for saved locations API round-trip
    - **Property 1: Saved locations API round-trip**
    - Generate random saved_locations arrays with varying labels, addresses, and is_default flags. POST then GET and verify equality.
    - **Validates: Requirements 3.3, 3.4**

- [x] 2. Checkpoint — Ensure backend changes work
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Shared utility: `loadSavedLocations()` and `getDefaultLocation()` in `shared.js`
  - Add async function `loadSavedLocations()` that fetches `/api/settings/default_user`, extracts `saved_locations` array (or empty array), and caches in `window._savedLocations`
  - Add function `getDefaultLocation()` that returns the location object where `is_default === true`, or `null`
  - _Requirements: 2.7, 4.2, 5.3, 5.5_

- [x] 4. Fix weather loading bugs in the editor
  - [x] 4.1 Fix `editor.js` weather fetch logic
    - Remove or neutralize the hardcoded `const defaultAddress = ""`
    - Fix `loadChitData()` to check `chit.location` directly for weather fetch (not `chit.location || defaultAddress`)
    - Add error handling in `fetchWeatherData()` to display error messages in the compact weather section instead of silently failing
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 4.2 Add placeholder messages for missing date or location
    - When a chit has a location but no date, display "📅 Add a date for weather" in the Compact_Weather_Section
    - When a chit has a date but no location, display "📍 Add a location for weather" in the Compact_Weather_Section
    - _Requirements: 1.4, 1.5_

- [x] 5. Settings page: Saved Locations management section
  - [x] 5.1 Add Locations Section UI to `settings.html`
    - Add a new `<div class="setting-group">` with header "📍 Saved Locations"
    - Add container `<div id="locations-list">` for dynamic location rows
    - Each row: radio button (default) + label input + address input + remove button
    - Add "+" button to add a new empty row
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 5.2 Add locations logic to `settings.js`
    - Implement `renderLocationsSection(locations)` to render saved location rows from data
    - Implement `collectLocationsData()` to read DOM rows and return the array for saving
    - Auto-select logic: if only one location has a non-empty address, auto-check its radio
    - Empty row cleanup on save: remove rows with empty addresses (keep at least one)
    - Integrate with existing `SettingsManager.save()` flow to include `saved_locations` in the save payload
    - Load saved locations from settings on page init and call `renderLocationsSection()`
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

- [x] 6. Checkpoint — Ensure settings save/load works
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Editor: Location zone enhancements
  - [x] 7.1 Add saved-locations dropdown and buttons to `editor.html`
    - Add "+Location" button in the Location zone header (next to existing Search/Map/Directions buttons)
    - Add `<select id="saved-locations-dropdown">` inside the location zone body, above the address input
    - Add a "✕ Clear" button to clear the current location
    - _Requirements: 5.1, 5.2, 5.5, 5.6, 5.9_

  - [x] 7.2 Add location selection logic to `editor.js`
    - Implement `loadSavedLocationsDropdown()` — populates the dropdown from cached saved locations (via `loadSavedLocations()` from shared.js)
    - Implement `onSavedLocationSelect()` — when a dropdown option is selected, populate the location input and trigger weather/map fetch
    - Implement `onAddDefaultLocation()` — "+Location" button handler: populate from default location or show message if none configured
    - Implement `onClearLocation()` — clear location input, map display, and weather section
    - Call `loadSavedLocationsDropdown()` during editor init
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10, 5.11_

  - [x] 7.3 Write property test for saved locations dropdown completeness
    - **Property 3: Saved locations dropdown completeness**
    - Generate random lists of saved locations (1–20 entries). Render the dropdown and verify option count equals locations + 1 (null option) and each label appears.
    - **Validates: Requirements 5.5, 5.6**

- [x] 8. Editor: Compact dropdown button for quick location access
  - Add a button-sized dropdown element in the title/weather area of the editor
  - When clicked, show the list of saved locations with their labels
  - When a location is selected, populate the address field and trigger weather/map loading
  - When no saved locations exist, display a message indicating none are configured
  - _Requirements: 6.1, 6.2, 6.3_

- [x] 9. Dashboard: Weather hotkey modal
  - [x] 9.1 Add weather modal markup and styles to `index.html` / `styles.css`
    - Create modal overlay structure (dynamically appended, same pattern as existing clock modal)
    - Style with parchment/brown theme matching existing modals
    - Display: location label, address, weather icon, high/low °F, precipitation, temperature bar
    - _Requirements: 4.5, 4.6_

  - [x] 9.2 Add weather modal logic to `main.js`
    - Implement `_openWeatherModal()` — fetch default location via `getDefaultLocation()`, call Weather Service (Nominatim + Open-Meteo), render modal
    - Implement `_closeWeatherModal()` — remove modal from DOM
    - Add "W" case to the existing keydown handler (when no input focused and no hotkey mode active)
    - Handle Escape key and click-outside to close
    - Handle error states: no default location, geocoding failure, weather fetch failure
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 9.3 Write property test for weather modal rendering
    - **Property 2: Weather modal renders all required fields**
    - Generate random weather data objects and location objects. Render the modal HTML and verify all required fields are present (location label, address, weather icon, high temp, low temp, precipitation).
    - **Validates: Requirements 4.5**

- [x] 10. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- The backend is a single `main.py` — all schema/migration/route changes go there
- Frontend is vanilla JS with no build step — all changes are direct file edits
- `shared.js` is loaded before both `main.js` and `editor.js`, so shared utilities go there
