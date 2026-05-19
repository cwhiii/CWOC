# Location

**Category:** Editor Zones
**Item #:** 22
**Code Verified:** ✅
**User Verified:** ⬜

## Functions, Buttons, Controls & Inputs

### Location Zone Structure (editor.html)

- [ ] `<div id="locationSection" class="zone-container">` — Location zone container
- [ ] `<div id="locationContent" class="zone-body">` — Location zone body (collapsible)
- [ ] Zone header with `toggleZone(event, 'locationSection', 'locationContent')` — Expand/collapse

### Location Zone Header Buttons (editor.html)

- [ ] `<button id="locationAddClearBtn" onclick="_locationAddClearToggle(event)">` — +Location / ✕ Clear toggle button
- [ ] `<button id="locationSearchBtn" onclick="searchLocationMap()">` — Search/geocode button (hidden when no location)
- [ ] `<button id="locationMapBtn" onclick="openLocationInNewTab(event)">` — Open in Maps button (hidden when no location)
- [ ] `<button id="locationDirectionsBtn" onclick="openLocationDirections(event)">` — Directions button (hidden when no location)
- [ ] `<button id="viewInContextBtn" onclick="_viewLocationInContext(event)">` — View in Context (Maps page) button

### Location Input (editor.html + editor-location.js)

- [ ] `<input type="text" id="location">` — Location/address text input
- [ ] Location value loaded from `chit.location` in `loadChitData()`
- [ ] `_updateViewInContextBtn()` — Shows/hides action buttons based on whether location has value

### Saved Locations Dropdown (editor-location.js)

- [ ] `<select id="saved-locations-dropdown">` — Saved locations dropdown in zone body
- [ ] `loadSavedLocationsDropdown()` — Populates dropdown from cached saved locations
- [ ] `onSavedLocationSelect()` — Handles selection, populates location input, triggers weather/map
- [ ] First option is null/placeholder

### Compact Location Dropdown (editor-location.js)

- [ ] `<select id="compact-location-dropdown">` — Compact saved locations dropdown (title/weather area)
- [ ] `loadCompactLocationDropdown()` — Populates compact dropdown from saved locations
- [ ] `onCompactLocationSelect()` — Handles selection, syncs with zone dropdown, triggers weather/map
- [ ] Resets to label option after selection

### Geocoding (editor-location.js)

- [ ] `_getCoordinates(address)` — Delegates to shared `_geocodeAddress` for geocoding
- [ ] `searchLocationMap(event)` — Master search handler: geocodes, fetches weather, displays map
- [ ] Geocoding uses OpenStreetMap Nominatim via shared function

### Weather Display (editor-location.js)

- [ ] `<div id="compactWeatherSection">` — Compact weather section (in title/weather area)
- [ ] `_fetchWeatherData(address)` — Fetches weather for location (with date context)
- [ ] `_displayWeatherInCompactSection(weatherData, address)` — Renders weather bar with:
  - [ ] Weather icon (from WMO code)
  - [ ] Description text (with precipitation amount merged in)
  - [ ] Temperature track (gradient bar with low/high callouts)
  - [ ] Temperature scale lines and labels
  - [ ] Refresh button (🔄) — clears cache and re-fetches
- [ ] `_editorFormatPrecipAmount(precipMm)` — Formats precipitation amount for display
- [ ] Weather caching in localStorage (`cwoc_weather_editor_` prefix)
- [ ] Stale badge (⏳) shown while refreshing cached data
- [ ] Placeholder states: "Date & location needed for weather", "Add a date for weather", "Add a location for weather"
- [ ] `_refreshWeatherOnDateChange()` — Re-fetches weather when date fields change
- [ ] `window._currentChitWeatherData` — Stored weather data for save payload

### Map Display (editor-location.js)

- [ ] `_displayMapInUI(lat, lon, address)` — Renders OpenStreetMap iframe embed
- [ ] `<div id="map-display">` — Dynamic map container (created on demand)
- [ ] Map iframe: OpenStreetMap export embed with marker
- [ ] "View Larger Map" link below iframe

### Location Actions (editor-location.js)

- [ ] `openLocationInNewTab(event)` — Opens location in OpenStreetMap or Google Maps (based on settings)
- [ ] `openLocationDirections(event)` — Opens directions (uses geolocation for origin if available)
- [ ] `_viewLocationInContext(event)` — Navigates to Maps page with focus on chit's location
- [ ] `_locationAddClearToggle(event)` — Toggles between +Location (populate default) and ✕ Clear

### Default Location (editor-location.js)

- [ ] `onAddDefaultLocation(event)` — Populates from default saved location (from settings)
- [ ] `getDefaultLocation()` — Gets default location from settings (shared function)
- [ ] Toast error if no default location configured

### Clear Location (editor-location.js)

- [ ] `onClearLocation(event)` — Clears location input, map display, weather section, dropdowns
- [ ] Resets compact weather to placeholder state
- [ ] Resets both zone and compact dropdowns

### Location-Based Timezone Detection (editor-location.js)

- [ ] `_checkLocationTimezone(lat, lon, countryCode)` — Checks if geocoded location's timezone differs from user's
- [ ] Shows timezone suggestion prompt if different (delegates to `_showTimezoneSuggestion` in editor-dates.js)
- [ ] Does not show if chit already has explicit timezone

### State Variables (editor-location.js / editor.js)

- [ ] `var currentWeatherLat` — Latitude from last geocode
- [ ] `var currentWeatherLon` — Longitude from last geocode
- [ ] `var currentWeatherData` — Last fetched weather data object
- [ ] `var weatherIcons` — WMO weather code to emoji icon map (from shared)
- [ ] `const weatherDescriptions` — WMO weather code to description text map
