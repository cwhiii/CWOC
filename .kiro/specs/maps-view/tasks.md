# Tasks

## Task 1: Create Maps Page HTML and Backend Route

- [x] 1.1 Create `src/frontend/html/maps.html` following the `_template.html` pattern with `data-page-title="Maps View"` and `data-page-icon="🗺️"`, including Leaflet.js and Leaflet.markercluster CDN links (CSS and JS), date range filter inputs, map container div, legend element, Google Maps warning element, and the standard shared script load order plus `maps.js`
- [x] 1.2 Add the `/maps` route to `src/backend/routes/health.py` serving `maps.html` via FileResponse, following the existing page-serving pattern

## Task 2: Create Maps Page JavaScript Logic

- [x] 2.1 Create `src/frontend/js/pages/maps.js` with the `_mapsInit()` entry point that checks `window._cwocSettings.chit_options.prefer_google_maps` and either shows the Google Maps warning or calls `_initLeafletMap()`
- [x] 2.2 Implement `_initLeafletMap()` to create a Leaflet map instance with OpenStreetMap tile layer in the map container div
- [x] 2.3 Implement `_fetchAndDisplayChits()` to fetch from `/api/chits`, call `_filterChitsByDateRange()`, then `_geocodeChits()`, then `_placeMarkers()`
- [x] 2.4 Implement `_filterChitsByDateRange(chits, startDate, endDate)` to return only chits with non-empty `location` and at least one date field (start_datetime, due_datetime, or created_datetime) within the range
- [x] 2.5 Implement `_geocodeChits(chits)` using `_geocodeAddress()` from shared-geocoding.js with an in-memory cache (`_mapsGeocodeCache`) to deduplicate geocoding calls for identical addresses
- [x] 2.6 Implement `_getMarkerColor(status)` returning distinct colors for ToDo, In Progress, Blocked, Complete, and no-status
- [x] 2.7 Implement `_buildPopupContent(chit)` returning HTML with chit title, relevant date, status, and a link to `/editor?id={chit_id}`
- [x] 2.8 Implement `_placeMarkers(geocodedChits)` to create colored circle markers, add them to a MarkerClusterGroup, bind popups, add to map, and call `fitBounds()` (or show default world view with info message if no markers)
- [x] 2.9 Implement `_onDateFilterChange()` handler for date input changes that re-filters and re-renders markers, and wire up the date inputs with default values (±30 days)
- [x] 2.10 Implement the status color legend display on the map

## Task 3: Navigation Integration

- [x] 3.1 Add Maps entry to the `_navPages` array in `src/frontend/js/pages/shared-page.js` with appropriate key, icon (🗺️), label ("Maps"), and href ("/maps"), positioned between existing entries per the requirement
- [x] 3.2 Add `/maps` to the `_navTargets` array in `src/frontend/js/dashboard/main-hotkeys.js` and update the dashboard navigate panel HTML to include the Maps option

## Task 4: Responsive CSS

- [x] 4.1 Add page-specific styles in `maps.html` for the map container (full width, min-height 400px, flex to fill vertical space), date range filter layout, legend styling, and Google Maps warning styling
- [x] 4.2 Add a media query for viewports ≤768px that stacks the date filter inputs vertically

## Task 5: Help Documentation

- [x] 5.1 Add a Maps View section to `src/frontend/html/help.html` documenting the feature: date range filter usage, marker popups, clustering behavior, color-coded status markers, and the Google Maps preference warning

## Task 6: Index, Version, and Release Notes

- [x] 6.1 Update `src/INDEX.md` to include the new files (`maps.html`, `maps.js`), the new route (`/maps`), and all new functions
- [x] 6.2 Create a release notes file in `documents/release_notes/` documenting the Maps View feature
- [x] 6.3 Update `src/VERSION` with the current timestamp using `date "+%Y%m%d.%H%M"` (run this command at the very end)
