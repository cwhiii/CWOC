# Implementation Plan: Maps People Mode

## Overview

Extend the existing Maps View page (`maps.html` + `maps.js`) to support two display modes — Chits (existing behavior) and People (contacts on the map). Add a mode toggle with localStorage persistence, mode-specific filter panels, contact markers with distinct styling, contact popups, separate cluster groups, mode-specific legends, and responsive layout. All changes go into existing files (`maps.html`, `maps.js`, `shared-page.css`). No new files, no installs.

## Tasks

- [x] 1. Add mode toggle and People mode CSS
  - [x] 1.1 Add Maps People Mode CSS to shared-page.css
    - Add a `/* ── Maps People Mode ──── */` section at the end of `src/frontend/css/shared/shared-page.css`
    - Define classes for: `.maps-mode-toggle` (toggle container), `.maps-mode-btn` (toggle buttons with active state), `.maps-chits-filter-panel`, `.maps-people-filter-panel`, `.maps-people-legend`
    - Style contact markers: `.maps-contact-marker` (28×28px square with rounded corners, 2px dark brown border, contact-colored background)
    - Style people cluster icons: `.maps-people-cluster` (teal color scheme, distinct from default blue chit clusters)
    - Style filter panel controls: status checkboxes, tag chips, priority checkboxes, people chips, text search input, favorites toggle — reuse existing CWOC patterns (`.cwoc-btn`, `.cwoc-tag-chip`, etc.)
    - Style clear-filters button for both panels
    - Add responsive rules for ≤768px: compact toggle, collapsible filter panels that stack vertically
    - Add smooth transition for filter panel swap on mode switch
    - _Requirements: 1.1, 5.1, 5.2, 5.3, 7.1, 7.2, 7.3, 9.1, 9.2, 9.3, 12.1, 12.2, 12.3_

  - [x] 1.2 Add mode toggle HTML and filter panel markup to maps.html
    - Add mode toggle control between the Google Maps warning and the date filter: two buttons ("Chits" and "People") in a `.maps-mode-toggle` container
    - Add Chits filter panel (`#maps-chits-filter-panel`) containing: status checkboxes (ToDo, In Progress, Blocked, Complete), tag filter area, priority checkboxes, people filter area, text search input, and wrap the existing date range filter inside it
    - Add People filter panel (`#maps-people-filter-panel`, hidden by default) containing: text search input, favorites-only toggle, tag filter chip area, and clear-filters button
    - Add People mode legend (`#maps-people-legend`, hidden by default) with a generic "Contact color" indicator
    - Add `<style>` block additions for any maps-page-specific styles (contact marker, filter panel layout) that don't belong in shared-page.css
    - _Requirements: 1.1, 2.1, 4.1, 8.1, 8.2, 8.3, 9.1, 9.2_

- [x] 2. Implement mode toggle logic and state management in maps.js
  - [x] 2.1 Add module-level state variables and mode management functions
    - Add state variables: `_mapsCurrentMode`, `_mapsAllContacts`, `_mapsPeopleClusterGroup`, `_mapsContactGeocodeCache`, chit filter state vars, people filter state vars, `MAPS_MODE_KEY`
    - Implement `_mapsGetMode()` — returns current mode from module state
    - Implement `_mapsSetMode(mode)` — sets mode, persists to localStorage, calls `_switchToChitsMode()` or `_switchToPeopleMode()`
    - Implement `_mapsRestoreMode()` — reads from localStorage, defaults to "chits"
    - Implement `_onModeToggleChange()` — click handler for toggle buttons
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 2.2 Implement mode switching functions
    - Implement `_switchToChitsMode()` — clears people cluster group, shows chits filter panel and chits legend, hides people filter panel and people legend, calls `_fetchAndDisplayChits()`
    - Implement `_switchToPeopleMode()` — clears chit cluster group, shows people filter panel and people legend, hides chits filter panel and chits legend, calls `_fetchAndDisplayContacts()`
    - _Requirements: 1.3, 1.4, 9.1, 9.2, 9.3_

  - [x] 2.3 Update `_mapsInit()` to initialize mode toggle
    - After Google Maps preference guard check, call `_mapsRestoreMode()` to set initial mode
    - Initialize both cluster groups (chits and people) with distinct icon styles
    - Wire up mode toggle button click handlers
    - Hide mode toggle and both filter panels when Google Maps warning is active
    - Load the appropriate mode on init
    - _Requirements: 1.2, 1.5, 10.1, 10.2_

- [x] 3. Checkpoint — Mode toggle works
  - Ensure mode toggle switches between Chits and People modes, persists to localStorage, and Google Maps guard hides the toggle. Ask the user if questions arise.

- [x] 4. Implement Chits filter panel logic
  - [x] 4.1 Implement `_initChitsFilters()` and `_loadChitsFilterData()`
    - Build status checkboxes (ToDo, In Progress, Blocked, Complete) with "Any" default behavior
    - Fetch user tags from settings cache and build tag filter chips
    - Build priority checkboxes
    - Fetch contacts and system users for people filter chips
    - Wire up text search input with debounced filtering
    - Move existing date range filter into the chits filter panel
    - Add "Clear Filters" button that calls `_clearChitsFilters()`
    - _Requirements: 2.1, 2.2, 2.4, 2.6_

  - [x] 4.2 Implement `_applyChitsFilters(chits)` and `_matchesChitTextSearch(chit, query)`
    - Filter by status: if any statuses selected, include only matching chits
    - Filter by tags: if any tags selected, include only chits with at least one matching tag
    - Filter by priority: if any priorities selected, include only matching chits
    - Filter by people: if any people selected, include only chits with at least one matching person
    - Filter by text search: case-insensitive match against title, note, location, and tags
    - Filter by date range: reuse existing `_filterChitsByDateRange()` logic
    - All filters are AND-combined
    - _Requirements: 2.2, 2.3, 2.5_

  - [x] 4.3 Implement `_clearChitsFilters()` and `_onChitsFilterChange()`
    - `_clearChitsFilters()` resets all filter state to defaults and updates UI
    - `_onChitsFilterChange()` re-applies filters and re-renders chit markers
    - _Requirements: 2.3, 2.6_

  - [x] 4.4 Update `_fetchAndDisplayChits()` to use the new filter pipeline
    - After fetching chits, pass through `_applyChitsFilters()` before geocoding and placing markers
    - Show empty state message when no chits match filters
    - _Requirements: 2.3, 11.1_

  - [ ]* 4.5 Write property test for chit filter correctness
    - **Property 2: Chit filter correctness**
    - Create test in `src/frontend/js/pages/test-maps-properties.js`
    - Generate random arrays of chit objects with varying status, tags, priority, people, title, note, location fields
    - Generate random filter criteria combinations
    - Apply `_applyChitsFilters`, verify every returned chit matches ALL active criteria and no excluded chit matches all criteria
    - Minimum 100 iterations using fast-check
    - **Validates: Requirements 2.2, 2.3, 2.5**

- [x] 5. Implement People mode: fetch, geocode, and display contacts
  - [x] 5.1 Implement `_fetchAndDisplayContacts()`
    - Fetch all contacts from `/api/contacts`
    - Apply people filters via `_applyPeopleFilters()`
    - Call `_geocodeContacts()` on filtered contacts
    - Call `_placeContactMarkers()` with geocoded results
    - Show appropriate empty state messages (no contacts with addresses, no matches)
    - Handle fetch errors gracefully with console.error and info message
    - _Requirements: 3.1, 3.4, 3.5, 11.2, 11.3_

  - [x] 5.2 Implement `_geocodeContacts(contacts)` with deduplication cache
    - For each contact, iterate over their `addresses` array
    - Skip contacts with no addresses (no error)
    - For each address, check `_mapsContactGeocodeCache` first (keyed by lowercase trimmed address)
    - If not cached, call `_geocodeAddress()` from shared-geocoding.js
    - Cache successful results; log warning and skip on failure
    - Return array of `{contact, address, lat, lon}` objects
    - _Requirements: 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 5.3 Implement `_placeContactMarkers(geocodedContacts)` and `_getContactMarkerColor(contact)`
    - `_getContactMarkerColor()` returns contact's color if non-null/non-empty, else default teal (#008080)
    - Create `L.marker` with `L.divIcon` for each geocoded contact (28×28px square, contact-colored, dark brown border)
    - If contact has `image_url`, include small thumbnail in the divIcon
    - Bind popup via `_buildContactPopupContent()`
    - Add all markers to `_mapsPeopleClusterGroup`
    - Fit map bounds to markers
    - _Requirements: 3.2, 3.3, 5.1, 5.2, 5.3, 5.4, 7.1_

  - [x] 5.4 Implement `_buildContactPopupContent(contact, address)`
    - Include contact display name (bold)
    - Include the specific address for this marker
    - Include organization if present
    - Include primary phone if present
    - Include primary email if present
    - Include profile image thumbnail if `image_url` is set
    - Include clickable link to `/frontend/html/contact-editor.html?id={contact_id}`
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ]* 5.5 Write property test for contact marker count and placement
    - **Property 3: Contact marker count and placement**
    - Generate random contacts with 0–5 addresses each
    - Mock geocoder to return known coordinates
    - Verify number of geocode calls equals total non-empty addresses, and each success produces a marker
    - Minimum 100 iterations using fast-check
    - **Validates: Requirements 3.2, 3.3, 3.4**

  - [ ]* 5.6 Write property test for contact address geocode deduplication
    - **Property 4: Contact address geocode deduplication**
    - Generate random contacts where some share identical addresses (case-insensitive)
    - Mock geocoder, verify it is called exactly once per unique address string
    - Minimum 100 iterations using fast-check
    - **Validates: Requirements 3.6**

  - [ ]* 5.7 Write property test for contact marker color mapping
    - **Property 6: Contact marker color mapping**
    - Generate random contacts with color values (null, empty string, valid hex colors)
    - Verify `_getContactMarkerColor` returns contact's color when non-null/non-empty, #008080 otherwise
    - Minimum 100 iterations using fast-check
    - **Validates: Requirements 5.1, 5.2**

  - [ ]* 5.8 Write property test for contact popup content completeness
    - **Property 7: Contact popup content completeness**
    - Generate random contacts with varying fields (some with org, phones, emails, image_url; some without)
    - Generate random address strings
    - Verify `_buildContactPopupContent` output contains display_name, address, and editor link
    - Verify conditional fields appear only when present
    - Minimum 100 iterations using fast-check
    - **Validates: Requirements 6.1, 6.2, 6.3**

- [x] 6. Checkpoint — People mode displays contacts on map
  - Ensure contacts are fetched, geocoded, and displayed as distinct markers with popups. Ask the user if questions arise.

- [x] 7. Implement People filter panel logic
  - [x] 7.1 Implement `_initPeopleFilters()`
    - Build text search input with debounced filtering
    - Build favorites-only toggle button/checkbox
    - Build tag filter chips from contact tags (collect unique tags across all contacts)
    - Add "Clear Filters" button that calls `_clearPeopleFilters()`
    - _Requirements: 4.1_

  - [x] 7.2 Implement `_applyPeopleFilters(contacts)` and `_mapsContactMatchesFilter(contact, query)`
    - `_mapsContactMatchesFilter()` replicates `_contactMatchesFilter` logic from editor-people.js: search across display_name, given_name, surname, nickname, organization, social_context, emails, phones, addresses, call_signs, x_handles, websites, notes, and tags (case-insensitive)
    - Filter by favorites: if toggle active, include only contacts with `favorite === true`
    - Filter by tags: if any tags selected, include only contacts with at least one matching tag
    - Filter by text: if search text present, include only contacts matching `_mapsContactMatchesFilter`
    - All filters are AND-combined
    - _Requirements: 4.2, 4.3, 4.4, 4.5_

  - [x] 7.3 Implement `_clearPeopleFilters()` and `_onPeopleFilterChange()`
    - `_clearPeopleFilters()` resets all people filter state to defaults and updates UI
    - `_onPeopleFilterChange()` re-applies filters and re-renders contact markers
    - _Requirements: 4.5, 4.6_

  - [ ]* 7.4 Write property test for people filter correctness
    - **Property 5: People filter correctness**
    - Generate random arrays of contact objects with varying display_name, tags, favorite status, and other searchable fields
    - Generate random filter criteria (text, favorites toggle, tag selection)
    - Apply `_applyPeopleFilters`, verify every returned contact matches ALL active criteria
    - Minimum 100 iterations using fast-check
    - **Validates: Requirements 4.2, 4.3, 4.4, 4.5**

  - [ ]* 7.5 Write property test for mode persistence round-trip
    - **Property 1: Mode persistence round-trip**
    - Generate random mode values from {"chits", "people"}
    - Persist to a mock localStorage, restore, verify equality
    - Minimum 100 iterations using fast-check
    - **Validates: Requirements 1.5**

- [x] 8. Implement legends and cluster group styling
  - [x] 8.1 Implement `_showChitsLegend()` and `_showPeopleLegend()`
    - `_showChitsLegend()` shows the existing status-color legend, hides people legend
    - `_showPeopleLegend()` shows the people legend (contact-color indicator), hides chits legend
    - Wire legend switching into `_switchToChitsMode()` and `_switchToPeopleMode()`
    - _Requirements: 8.1, 8.2, 8.3_

  - [x] 8.2 Configure separate MarkerClusterGroups with distinct styling
    - Chits cluster group: existing default blue styling
    - People cluster group: teal (#008080) color scheme using `iconCreateFunction` to apply `.maps-people-cluster` class
    - Both groups added to the map, only the active mode's group is visible
    - _Requirements: 7.1, 7.2, 7.3_

- [x] 9. Checkpoint — Filters, legends, and clusters all working
  - Ensure chit filters, people filters, legends, and cluster groups all function correctly per mode. Ask the user if questions arise.

- [x] 10. Implement empty state messages and Google Maps guard updates
  - Update `_showInfoMessage()` and `_hideInfoMessage()` to support mode-specific messages
  - Show "No chits match the current filters." when chit filters yield no results
  - Show "No contacts with addresses were found." when no contacts have geocodable addresses
  - Show "No contacts match the current filters." when people filters yield no results
  - Ensure Google Maps warning hides mode toggle and both filter panels
  - _Requirements: 10.1, 10.2, 11.1, 11.2, 11.3_

- [x] 11. Implement responsive layout for mobile
  - Ensure mode toggle displays as compact toggle on viewports ≤768px
  - Make both filter panels collapse into expandable/collapsible sections on mobile (tap to expand/collapse)
  - Stack filter controls vertically on narrow viewports
  - Add responsive CSS rules in the maps.html `<style>` block or shared-page.css as appropriate
  - _Requirements: 12.1, 12.2, 12.3_

- [x] 12. Checkpoint — Full feature integration test
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Update help documentation
  - Update the Maps View section in `src/frontend/html/help.html` to document:
    - Mode toggle between Chits and People modes
    - People mode: how contacts are displayed on the map by address
    - Contact markers and popups (click to see details, link to editor)
    - Chits filter panel controls (status, tags, priority, people, text search, date range)
    - People filter panel controls (text search, favorites toggle, tag chips)
    - Mode persistence across page loads
  - _Requirements: 13.1_

- [x] 14. Update INDEX.md, VERSION, and release notes
  - Update `src/INDEX.md` with all new and modified functions added to `maps.js` (mode management, chit filters, people mode, people filters, legend, etc.)
  - Update any shared-page.css section references in INDEX.md
  - Create release notes file in `documents/release_notes/` documenting the Maps People Mode feature
  - Update `src/VERSION` using `date "+%Y%m%d.%H%M"` (run once at the very end)
  - _Requirements: 14.1, 14.2, 14.3_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- No software installation required — all tests are self-contained vanilla JS files runnable in the browser using fast-check
- All implementation is vanilla JavaScript — no frameworks, no build step, no npm/pip
- All changes go into existing files (maps.html, maps.js, shared-page.css) — no new page files needed
- The `_contactMatchesFilter` logic from editor-people.js is replicated (not imported) in maps.js to maintain the vanilla JS no-module pattern
