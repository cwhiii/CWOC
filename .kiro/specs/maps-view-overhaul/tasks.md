# Implementation Plan: Maps View Overhaul

## Overview

This plan converts the Maps View Overhaul design into incremental coding tasks. The overhaul redesigns `/maps` to maximize map visibility via a collapsible sidebar, relocates the mode toggle to the header, adds semi-transparent people markers, mixed cluster icons, fullscreen mode, map start settings (backend + frontend), a default view reset button, and responsive mobile layout. Each task builds on the previous, ending with help docs, INDEX.md, release notes, and a single version bump.

## Tasks

- [x] 1. Backend: Add map settings fields and migration
  - [x] 1.1 Add map settings fields to the Settings Pydantic model in `src/backend/models.py`
    - Add `map_default_lat: Optional[str] = None`, `map_default_lon: Optional[str] = None`, `map_default_zoom: Optional[str] = None`, `map_auto_zoom: Optional[str] = "1"` to the `Settings` class
    - _Requirements: 7.6_

  - [x] 1.2 Add `migrate_add_map_settings()` migration function in `src/backend/migrations.py`
    - Add four `ALTER TABLE settings ADD COLUMN` statements with existence checks for `map_default_lat`, `map_default_lon`, `map_default_zoom`, `map_auto_zoom`
    - Follow the existing idempotent migration pattern (check `PRAGMA table_info` before altering)
    - _Requirements: 7.7_

  - [x] 1.3 Register the new migration in `src/backend/main.py` startup sequence
    - Call `migrate_add_map_settings()` in the migration sequence at startup
    - _Requirements: 7.7_

  - [x] 1.4 Update `save_settings` and `get_settings` in `src/backend/routes/settings.py` to persist and return the four new map settings fields
    - Add the new fields to the INSERT OR REPLACE column list and parameter tuple in `save_settings`
    - Add the new fields to the returned dict in `get_settings`
    - _Requirements: 7.8_

  - [ ]* 1.5 Write property test for map settings API round-trip (`src/backend/test_map_settings.py`)
    - **Property 5: Map settings API round-trip**
    - Generate random valid lat (−90 to 90), lon (−180 to 180), zoom (1–18), auto_zoom ("0"/"1") values across 120 iterations
    - POST to `/api/settings`, GET back via `/api/settings/{user_id}`, verify equality
    - Use Python's built-in `random` module and `unittest` (matching `test_audit.py` pattern)
    - **Validates: Requirements 7.8**

- [x] 2. Checkpoint — Ensure backend changes are correct
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Frontend: Restructure maps.html layout for sidebar + maximized map
  - [x] 3.1 Replace the `.settings-panel` wrapper in `maps.html` with the new `.maps-page-layout` flexbox structure
    - Add `.maps-header` bar containing the sidebar toggle button, page title, mode toggle, and header-right area
    - Add `.maps-page-layout` flex container with `<aside id="maps-sidebar">` and `<main class="maps-main">`
    - Move existing filter panels (`maps-chits-filter-panel`, `maps-people-filter-panel`) inside the sidebar's `.maps-sidebar-scroll` div
    - Move `#maps-container` inside `.maps-main`
    - Keep legends below the map inside `.maps-main`
    - Remove the old `.maps-mode-toggle` from the filter area (it's now in the header)
    - Remove the old mobile filter collapse toggle buttons (sidebar handles collapse now)
    - _Requirements: 1.1, 1.5, 2.1, 2.2, 2.3, 3.1, 3.2_

  - [x] 3.2 Add sidebar and maximized map CSS to `src/frontend/css/shared/shared-page.css`
    - Add `.maps-header` styles (flex row, page title, mode toggle centered, nav buttons right)
    - Add `.maps-page-layout` (flex row, `height: calc(100vh - var(--maps-header-height, 56px))`, `overflow: hidden`)
    - Add `.maps-sidebar` (width 240px, flex-shrink 0, scrollable, collapsible)
    - Add `.maps-sidebar.collapsed` (width ~40px, content hidden)
    - Add `.maps-sidebar-toggle-btn` (parchment-themed hamburger button)
    - Add `.maps-sidebar-scroll` (overflow-y auto, flex 1)
    - Add `.maps-sidebar-panel` (container for filter controls)
    - Add `.maps-main` (flex 1, min-width 0, position relative)
    - Override `body[data-page-title="Maps View"]` to set `padding: 0; overflow: hidden; height: 100vh;`
    - Update `#maps-container` to `width: 100%; height: 100%;` (remove old min-height and border)
    - _Requirements: 1.1, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4_

  - [x] 3.3 Add sidebar JS functions in `src/frontend/js/pages/maps.js`
    - Implement `_initMapsSidebar()` — restore state from localStorage, wire toggle button, set up resize handling
    - Implement `_toggleMapsSidebar()` — toggle collapsed/expanded class, persist to localStorage (`cwoc_maps_sidebar`), call `_mapsLeafletMap.invalidateSize()` after transition
    - Implement `_restoreMapsSidebarState()` — read `cwoc_maps_sidebar` from localStorage, apply class
    - Update `_mapsSetMode()` to swap sidebar panel visibility (show chits panel or people panel)
    - Update `_mapsInit()` to call `_initMapsSidebar()` during initialization
    - _Requirements: 1.3, 1.5, 1.6, 1.7, 1.8, 2.5_

- [x] 4. Frontend: Semi-transparent people markers and chit cluster styling
  - [x] 4.1 Add `_hexToRgba(hex, alpha)` helper function in `maps.js`
    - Converts hex color string to `rgba(r, g, b, alpha)` for semi-transparent fills
    - _Requirements: 4.1_

  - [x] 4.2 Update contact marker rendering in `maps.js` to use semi-transparent fills
    - Modify `_placeContactMarkers()` (or equivalent) to use `_hexToRgba(color, 0.6)` for the marker fill background
    - Keep border at full opacity (`opacity: 1.0`)
    - _Requirements: 4.1, 4.2_

  - [x] 4.3 Update chit cluster `iconCreateFunction` to use square-shaped icons with distinct styling
    - Customize `_mapsClusterGroup` iconCreateFunction to render square cluster icons with amber/brown color scheme
    - Add `.maps-chit-cluster` and size variant CSS classes to `shared-page.css`
    - _Requirements: 5.1, 5.5_

  - [x] 4.4 Add mixed cluster marker infrastructure
    - Set `_cwocMarkerType` property on each marker ('chit' or 'contact') when creating markers
    - Update cluster `iconCreateFunction` to detect mixed composition and render the mixed icon (square with inscribed circle)
    - Add `.maps-mixed-cluster` CSS class to `shared-page.css` with purple gradient styling
    - _Requirements: 5.3, 5.4, 5.5_

  - [x] 4.5 Update people cluster styling to use square icons
    - Update `_mapsPeopleClusterGroup` iconCreateFunction to render square cluster icons (matching chit cluster shape but with teal color scheme)
    - Add `.maps-people-cluster` size variant CSS classes if not already present
    - _Requirements: 5.2, 5.5_

- [x] 5. Frontend: Fullscreen control and Default View button
  - [x] 5.1 Implement the Fullscreen Leaflet control in `maps.js`
    - Create `L.Control.Fullscreen` extending `L.Control` with `position: 'topright'`
    - Implement `_toggleFullscreen()` using `document.documentElement.requestFullscreen()` and `document.exitFullscreen()`
    - Listen for `fullscreenchange` event to update button icon (expand ↔ compress)
    - Check `document.fullscreenEnabled` and hide the control if unsupported
    - Add the control to the map in `_initLeafletMap()`
    - Add `.maps-fullscreen-control` and `.maps-fullscreen-btn` CSS to `shared-page.css` with 44×44px minimum tap target
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [x] 5.2 Implement the Default View Leaflet control in `maps.js`
    - Create `L.Control.DefaultView` extending `L.Control` with `position: 'topright'`
    - Implement `_resetView()` that reads cached settings: if auto-zoom enabled → fitBounds to visible markers; if auto-zoom disabled with custom center/zoom → setView; otherwise → default US view (39.8283, -98.5795, zoom 4)
    - Add the control to the map in `_initLeafletMap()`
    - Add `.maps-default-view-control` and `.maps-default-view-btn` CSS to `shared-page.css` with 44×44px minimum tap target
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 5.3 Update `_mapsInit()` to use map settings for initial view
    - Read `map_auto_zoom`, `map_default_lat`, `map_default_lon`, `map_default_zoom` from cached settings
    - If auto-zoom enabled: proceed with existing fitBounds behavior
    - If auto-zoom disabled with valid lat/lon/zoom: call `setView(lat, lon, zoom)` instead of fitBounds
    - If auto-zoom disabled with no custom settings: default to US view (39.8283, -98.5795, zoom 4)
    - _Requirements: 7.3, 7.4, 7.5_

- [x] 6. Checkpoint — Ensure frontend map changes work correctly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Settings page: Map Settings UI
  - [x] 7.1 Add Map Settings section to `src/frontend/html/settings.html`
    - Add a new `setting-group` div with heading "🗺️ Map Settings"
    - Add auto-zoom checkbox (`#map-auto-zoom`)
    - Add lat/lon/zoom number inputs (`#map-default-lat`, `#map-default-lon`, `#map-default-zoom`) inside a `#map-custom-view-settings` container
    - Inputs should be disabled/dimmed when auto-zoom is checked
    - _Requirements: 7.1, 7.2_

  - [x] 7.2 Add Map Settings JS logic in `src/frontend/js/pages/settings.js`
    - Implement `_toggleMapAutoZoom()` — enable/disable lat/lon/zoom inputs based on auto-zoom checkbox state
    - Implement `_loadMapSettings(settings)` — populate the map settings UI from the settings object on page load
    - Implement `_collectMapSettings()` — read map settings UI values for inclusion in the save payload
    - Wire auto-zoom checkbox change event to `_toggleMapAutoZoom()` and `setSaveButtonUnsaved()`
    - Wire lat/lon/zoom input changes to `setSaveButtonUnsaved()`
    - Add frontend validation: lat must be −90 to 90, lon must be −180 to 180, zoom must be 1 to 18
    - Integrate `_loadMapSettings()` into the existing settings load flow
    - Integrate `_collectMapSettings()` into the existing settings save flow
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 8. Frontend: Responsive mobile layout
  - [x] 8.1 Add mobile sidebar overlay behavior
    - At viewport ≤768px, sidebar defaults to collapsed
    - When expanded on mobile, sidebar overlays the map (position absolute/fixed) instead of pushing it
    - Add `.maps-sidebar-backdrop` overlay that closes the sidebar when tapped
    - Implement `_showMobileSidebarBackdrop()` and `_hideMobileSidebarBackdrop()` in `maps.js`
    - _Requirements: 9.1, 9.2_

  - [x] 8.2 Add responsive CSS rules to `shared-page.css`
    - At ≤768px: sidebar overlays with `position: fixed`, backdrop shows
    - At ≤768px: mode toggle compact styling (smaller padding, font)
    - At ≤768px: map container fills full viewport width
    - Fullscreen and Default View buttons have 44×44px minimum tap targets (already set in task 5.1/5.2)
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 9. Checkpoint — Ensure responsive layout and settings UI work
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Documentation and finalization
  - [x] 10.1 Update the Maps View section in `src/frontend/html/help.html`
    - Document the collapsible sidebar (toggle button, filter panels inside sidebar)
    - Document fullscreen mode (button location, enter/exit behavior)
    - Document the default view button (reset behavior based on settings)
    - Document map start settings (auto-zoom, custom center/zoom, where to configure in Settings)
    - Document mixed cluster markers (square with inscribed circle for mixed chit+contact clusters)
    - Document semi-transparent people markers
    - _Requirements: 10.1_

  - [x] 10.2 Update `src/INDEX.md` with all new and modified functions
    - Add new JS functions: `_initMapsSidebar`, `_toggleMapsSidebar`, `_restoreMapsSidebarState`, `_showMobileSidebarBackdrop`, `_hideMobileSidebarBackdrop`, `_hexToRgba`, `L.Control.Fullscreen`, `L.Control.DefaultView`, `_toggleMapAutoZoom`, `_loadMapSettings`, `_collectMapSettings`
    - Add new Python function: `migrate_add_map_settings`
    - Add new Settings model fields: `map_default_lat`, `map_default_lon`, `map_default_zoom`, `map_auto_zoom`
    - Add new CSS classes: `.maps-page-layout`, `.maps-sidebar`, `.maps-header`, `.maps-chit-cluster`, `.maps-mixed-cluster`, `.maps-fullscreen-control`, `.maps-default-view-control`
    - Note modified functions: `_mapsInit`, `_mapsSetMode`, `_initLeafletMap`, `_placeContactMarkers`, `save_settings`, `get_settings`
    - _Requirements: 11.1_

  - [x] 10.3 Create release notes file in `documents/release_notes/`
    - Create `documents/release_notes/cwoc_release_<VERSION>.md` with a brief summary of the Maps View Overhaul feature
    - _Requirements: 11.3_

  - [x] 10.4 Update `src/VERSION` with current timestamp
    - Run `date "+%Y%m%d.%H%M"` and write the result to `src/VERSION`
    - This is done ONCE at the very end
    - _Requirements: 11.2_

- [x] 11. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties using Python's built-in `random` module (matching existing `test_audit.py` pattern)
- No software installations required — all code uses existing project dependencies
- Version update happens ONCE at the very end (task 10.4)
- All JS is vanilla with script tags, no modules/imports
- SQLite migrations use inline ALTER TABLE with existence checks
- The project uses Pydantic v1 models
