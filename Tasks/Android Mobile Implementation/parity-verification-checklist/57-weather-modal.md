# Weather Modal

**Category:** Modals & Overlays
**Item #:** 57
**Code Verified:** ✅
**User Verified:** ⬜

## Functions, Buttons, Controls & Inputs

### Core Functions (main-modals.js)
- [ ] _openWeatherModal — Opens the weather modal (toggle: if already open, closes it); loads saved locations, shows location selector + weather data
- [ ] _closeWeatherModal — Removes the weather modal overlay
- [ ] _fetchWeatherForModal — Fetches weather for a given address/label; shows cached data while refreshing; renders icon, temps, precip, wind, temp bar
- [ ] _buildWeatherModalHTML — Wraps content in the modal structure with "Full Forecast" button and close hint
- [ ] _buildLocationSelectorHTML — Builds the location dropdown with saved locations + "Type a location…" option
- [ ] _onWeatherModalLocChange — Handles dropdown change: shows manual input row for custom, or fetches weather for selected location
- [ ] _onWeatherModalManualGo — Fetches weather for manually typed address

### Weather Display Helpers
- [ ] _getWeatherIcon — Returns emoji icon for a WMO weather code (delegates to _cwocGetWeatherIcon)
- [ ] _buildTempBarGradient — Returns CSS gradient string for the temperature bar
- [ ] _buildTempBarHTML — Builds the full temperature bar with masks, callouts, tick marks (low/high markers)
- [ ] _isWeatherStale — Returns true if weather data is older than 24 hours

### Chit Weather Indicators (background)
- [ ] _queueChitWeatherFetch — Queues a weather fetch for a chit's location indicator span
- [ ] _processChitWxQueue — Processes the queue: groups by location, fetches sequentially with 300ms rate-limit delay
- [ ] _fetchAndApplyChitWeather — Geocodes address, fetches Open-Meteo forecast, updates spans with icon + tooltip, caches in localStorage (1hr TTL)
- [ ] _prefetchChitWeather — Pre-fetches weather for all chits with locations (deduplicates)
- [ ] _fetchWeatherForCache — Background pre-fetch for a single location into localStorage cache

### Controls & Interactions
- [ ] Location dropdown (select) — Saved locations list + "Type a location…" option
- [ ] Manual location input — Text input for typing a custom address
- [ ] "Go" button — Triggers weather fetch for manually entered address
- [ ] "📊 Full Forecast" button — Closes modal and navigates to /frontend/html/weather.html
- [ ] ESC key — First ESC blurs focused dropdown/input; second ESC closes modal
- [ ] Click outside (overlay click) — Closes the modal
- [ ] Close hint text — "ESC or click outside to close" (clickable)

### Weather Data Displayed
- [ ] Weather icon (emoji) — Based on WMO weather code
- [ ] Weather description text — Full description of conditions
- [ ] Temperature range — Low/High with unit (°F or °C based on settings)
- [ ] Temperature bar — Visual gradient bar with low/high markers and tick marks every 10°
- [ ] Precipitation — Amount with type label (rain/snow/mixed), alt text with metric/imperial conversion
- [ ] Wind speed — Shown if above threshold (32 km/h metric or 20 mph imperial), with alt text

### Caching
- [ ] localStorage cache per location — Key: "cwoc_weather_cache_" + address.toLowerCase().trim()
- [ ] Cache stores rendered HTML + timestamp
- [ ] Shows cached data immediately while refreshing in background

### Error States
- [ ] "No saved locations configured" — When no default location and no saved locations
- [ ] "Could not find location" — Geocoding failure
- [ ] "No address provided" — Empty address
- [ ] "Could not reach location service" — Network error on geocoding
- [ ] "Could not reach weather service" — Network error on Open-Meteo
- [ ] "Weather data unavailable" — Empty response from weather API

### State Variables
- [ ] _chitWxQueue — Array of pending weather fetch requests
- [ ] _chitWxFetching — Boolean flag for queue processing state
- [ ] _chitWxGeoCache — In-memory geocode cache (location → {lat, lon})
