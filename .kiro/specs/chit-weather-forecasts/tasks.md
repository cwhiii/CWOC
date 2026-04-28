# Implementation Plan: Chit Weather Forecasts

## Overview

This plan adds weather forecast persistence to chits, calendar view weather display, a backend weather update service with hourly/daily schedules, editor integration, and a full-page weather view. Work proceeds backend-first (schema + model + CRUD), then the update service, then frontend calendar/editor changes, and finally the weather page.

## Tasks

- [x] 1. Backend: Add weather_data field to Chit model and database
  - [x] 1.1 Add `weather_data` field to the `Chit` Pydantic model in `backend/main.py`
    - Add `weather_data: Optional[str] = None` to the Chit class (JSON string, same pattern as `alerts`)
    - _Requirements: 1.3_

  - [x] 1.2 Add migration function `migrate_add_weather_data()` in `backend/main.py`
    - Check if `weather_data` column exists on the `chits` table; if not, `ALTER TABLE chits ADD COLUMN weather_data TEXT`
    - Call the migration at startup alongside the other migration calls
    - _Requirements: 1.1, 1.7_

  - [x] 1.3 Update `create_chit()` to include `weather_data` in INSERT
    - Add `weather_data` to the INSERT column list and values tuple
    - Serialize via `serialize_json_field(chit.weather_data)` — but since weather_data is already a JSON string on the model, use `serialize_json_field()` only if it's a dict/list, otherwise store directly. Follow the same pattern as `alerts`.
    - _Requirements: 1.6_

  - [x] 1.4 Update `update_chit()` to include `weather_data` in UPDATE and INSERT
    - Add `weather_data` to the UPDATE SET clause and the fallback INSERT
    - Serialize via `serialize_json_field()`
    - _Requirements: 1.6_

  - [x] 1.5 Update `get_chit()`, `get_all_chits()`, and `search_chits()` to deserialize `weather_data`
    - Add `chit["weather_data"] = deserialize_json_field(chit.get("weather_data"))` in each function
    - _Requirements: 1.4, 1.5_

  - [x] 1.6 Write property test for weather_data round-trip
    - **Property 1: Weather data round-trip**
    - Generate random weather_data objects with random floats for high/low/precipitation, random int 0–99 for weather_code, random ISO date for focus_date, random ISO timestamp for updated_time. POST a chit, GET it back, verify weather_data equivalence with exact numeric precision.
    - Use Python stdlib only (random, string, uuid, unittest). Minimum 100 iterations.
    - **Validates: Requirements 1.2, 1.4, 1.5, 1.6, 8.1, 8.2**

- [x] 2. Checkpoint — Verify backend weather_data CRUD works
  - Run property test from 1.6. Verify migration is idempotent. Ask user if questions arise.

- [x] 3. Backend: Weather update service and endpoint
  - [x] 3.1 Add helper function `_get_chit_focus_date(chit)` in `backend/main.py`
    - Given a chit dict, return the earliest date from `start_datetime` or `due_datetime` as an ISO date string (YYYY-MM-DD)
    - Return None if neither field has a value
    - _Requirements: 3.1, 4.1_

  - [x] 3.2 Add helper function `_partition_eligible_chits(chits, now)` in `backend/main.py`
    - Takes a list of chit dicts and current datetime
    - Returns two lists: `hourly_chits` (focus_date within 0–7 days) and `daily_chits` (focus_date within 8–16 days)
    - Filters: non-deleted, non-empty location, has a focus_date in range
    - _Requirements: 3.1, 4.1_

  - [x] 3.3 Write property test for chit eligibility partitioning
    - **Property 2: Chit eligibility partitioning by date window**
    - Generate random chit sets with varying locations, dates, deleted flags. Run `_partition_eligible_chits()`, verify correct partitioning with no overlaps.
    - Use Python stdlib only. Minimum 100 iterations.
    - **Validates: Requirements 3.1, 4.1**

  - [x] 3.4 Add helper function `_extract_weather_for_date(forecast_daily, focus_date)` in `backend/main.py`
    - Takes an Open-Meteo `daily` response object and a focus_date string
    - Finds the index where `daily.time[i] == focus_date`
    - Returns a weather_data dict: `{ focus_date, updated_time, high, low, precipitation, weather_code }`
    - Returns None if focus_date not found in the response
    - _Requirements: 3.3, 4.3, 5.3_

  - [x] 3.5 Write property test for forecast-to-weather_data mapping
    - **Property 3: Forecast-to-weather_data mapping**
    - Generate random Open-Meteo-shaped responses and random focus dates from within the response. Verify mapping produces correct field values at the matching index.
    - Use Python stdlib only. Minimum 100 iterations.
    - **Validates: Requirements 3.3, 4.3, 5.3**

  - [x] 3.6 Add `_sync_weather_fetch(url)` helper and `_fetch_weather_for_location(lat, lon, days)` async function
    - `_sync_weather_fetch(url)` — uses `urllib.request.urlopen()` to fetch Open-Meteo data (same pattern as `_sync_geocode_fetch`)
    - `_fetch_weather_for_location(lat, lon, days)` — builds the Open-Meteo URL with `forecast_days={days}`, calls via `run_in_executor`, returns parsed JSON
    - _Requirements: 3.2, 4.2_

  - [x] 3.7 Add `POST /api/weather/update` endpoint
    - Query all non-deleted chits with non-empty location and date fields
    - Call `_partition_eligible_chits()` to split into hourly and daily buckets
    - Group chits by unique location string
    - Geocode each unique location once (reuse `_geocode_address()` with its cache)
    - Fetch 16-day forecast per unique location via `_fetch_weather_for_location()`
    - For each chit, call `_extract_weather_for_date()` to get weather_data
    - Update each chit's weather_data in the database
    - Return `{ "updated": int, "skipped": int, "elapsed_seconds": float }`
    - Respect Nominatim rate limits (1-second delay between geocoding, already handled by `_geocode_address`)
    - Use `_update_lock` to prevent concurrent runs
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 3.2, 3.3, 3.5, 3.6, 4.2, 4.3, 4.5_

  - [x] 3.8 Write property test for geocode deduplication
    - **Property 6: Geocode deduplication**
    - Generate random chit sets with overlapping locations. Mock the geocoder. Run the grouping logic, verify unique location count equals expected.
    - Use Python stdlib only. Minimum 100 iterations.
    - **Validates: Requirements 5.2**

  - [x] 3.9 Add background scheduler tasks for hourly and daily weather updates
    - Add `_weather_hourly_loop()` async function: runs every 60 minutes, calls update logic for 7-day window chits
    - Add `_weather_daily_loop()` async function: runs every 24 hours, calls update logic for 8–16 day window chits
    - Register both as `asyncio.create_task()` on app startup (use `@app.on_event("startup")` or add to existing startup logic)
    - Both use `_update_lock` to prevent concurrent runs
    - _Requirements: 3.4, 4.4, 5.5_

- [x] 4. Checkpoint — Verify weather update service works
  - Run all property tests (1.6, 3.3, 3.5, 3.8). Test the endpoint manually if possible. Ask user if questions arise.

- [x] 5. Frontend: Calendar view weather display
  - [x] 5.1 Add `_celsiusToFahrenheit(c)` utility function in `main.js`
    - Returns `Math.round(c * 9 / 5 + 32)`
    - Used by calendar cards and weather page
    - _Requirements: 2.4_

  - [x] 5.2 Add `_isWeatherStale(updatedTime)` utility function in `main.js`
    - Takes an ISO timestamp string, returns true if older than 24 hours from now
    - _Requirements: 2.5_

  - [x] 5.3 Update chit card rendering in `main.js` to display stored weather_data
    - In the card rendering function, check if `chit.weather_data` exists
    - If present: render weather icon (via `_getWeatherIcon(weather_data.weather_code)`), high °F, low °F
    - For Day/Week/Work/X-Days views: also show precipitation
    - If `updated_time` is stale (>24h): show ⏳ indicator
    - If `weather_data` is absent but `chit.location` exists: fall back to existing `_queueChitWeatherFetch` behavior
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 5.4 Add Shift+W hotkey to navigate to weather page
    - Add `Shift+W` case to the existing keydown handler in main.js
    - Navigate to `/frontend/weather.html`
    - Only when no input is focused and no modal is open
    - _Requirements: 7.1_

  - [x] 5.5 Add "Full Forecast" button to the weather modal
    - Add a button/link in the weather modal that navigates to `/frontend/weather.html`
    - _Requirements: 7.2_

  - [x] 5.6 Add weather page navigation button to calendar views
    - Add a 🌤️ button in the calendar view header area that navigates to `/frontend/weather.html`
    - _Requirements: 7.3_

- [x] 6. Frontend: Editor weather_data integration
  - [x] 6.1 Display stored weather_data immediately on chit load
    - In `loadChitData()`, after fetching the chit, check if `chit.weather_data` exists
    - If present: call `_displayWeatherInCompactSection()` with the stored data immediately (before live fetch)
    - Build a weather API-shaped object from weather_data fields so the existing display function can render it
    - _Requirements: 6.1_

  - [x] 6.2 Update weather_data in memory after live fetch
    - After `_fetchWeatherData()` succeeds, build a weather_data object from the Open-Meteo response
    - Store it on the in-memory chit object (e.g., `window._currentChitWeatherData = { focus_date, updated_time, high, low, precipitation, weather_code }`)
    - _Requirements: 6.2_

  - [x] 6.3 Include weather_data in save payload
    - In the editor save function, include `weather_data` (as a JSON string) in the payload sent to `PUT /api/chits/{chit_id}`
    - If `window._currentChitWeatherData` exists, serialize it; otherwise send null
    - _Requirements: 6.3_

- [x] 7. Checkpoint — Verify calendar and editor weather integration
  - Verify calendar cards show stored weather data. Verify editor displays stored data on load and includes it in save. Ask user if questions arise.

- [x] 8. Frontend: Weather page
  - [x] 8.1 Create `frontend/weather.html` from `_template.html`
    - Set `data-page-title="Weather Forecast"` and `data-page-icon="🌤️"` on `<body>`
    - Include `shared-page.css`, `shared-page.js`, `shared.js`
    - Add `<div id="weather-content">` for the forecast table
    - Add page-specific styles for the weather table layout (horizontal scroll, day blocks, row headers)
    - Include `<script src="/frontend/weather.js"></script>`
    - Match parchment/brown visual theme
    - _Requirements: 7.8, 7.10_

  - [x] 8.2 Create `frontend/weather.js` with page logic
    - On page load: call `loadSavedLocations()` from shared.js
    - If no saved locations: show "No saved locations configured. Add locations in ⚙️ Settings." message
    - For each saved location: geocode via `_geocodeAddress()` from shared.js, fetch 16-day forecast from Open-Meteo
    - Render the forecast table: one row per location, one block per day
    - Each block: weather icon, high °F, low °F, precipitation
    - Date headers above each day column
    - Handle errors per-location (show error message in that row, continue with others)
    - _Requirements: 7.4, 7.5, 7.6, 7.7, 7.9_

  - [x] 8.3 Add ESC navigation handling
    - ESC is handled by shared-page.js automatically (navigates back when no modals open)
    - Verify no custom ESC override is needed
    - _Requirements: 7.11_

- [x] 9. Frontend: Weather page styles
  - Add page-specific CSS in `weather.html` `<style>` block for:
    - Weather table layout (`.weather-table`, `.weather-row`, `.weather-day-block`)
    - Horizontal scrolling container
    - Row headers with location label/address
    - Day block styling (icon, temps, precipitation)
    - Date header row
    - Empty state message styling
    - Responsive adjustments for mobile
    - Parchment/brown theme consistency
  - _Requirements: 7.10_

- [x] 10. Update help page documentation
  - Add documentation for:
    - Weather data on chits (automatic updates, what the fields mean)
    - Calendar view weather display (icon, temps, precipitation, stale indicator)
    - Weather page (Shift+W access, what it shows, navigation)
    - Weather update schedule (hourly for 7 days, daily for 16 days)
  - _Requirements: All_

- [x] 11. Final checkpoint — Run all tests and verify
  - Run all property tests (1.6, 3.3, 3.5, 3.8)
  - Verify weather update endpoint works
  - Verify calendar display, editor integration, and weather page
  - Ask user if questions arise

## Notes

- All property-based tests use Python stdlib only (random, string, uuid, unittest) — no Hypothesis, no pip installs
- The backend is a single `main.py` — all schema/migration/route/scheduler changes go there
- Frontend is vanilla JS with no build step — all changes are direct file edits
- `shared.js` is loaded before page-specific scripts; shared utilities like `loadSavedLocations()`, `getDefaultLocation()`, `_geocodeAddress()` are already available
- The existing `_geocode_address()` in main.py already handles caching and rate limiting — reuse it for the update service
- The existing `_update_lock` in main.py prevents concurrent weather update runs
- Weather data is stored in Celsius (API-native) and converted to Fahrenheit in the display layer
- The weather page follows the `_template.html` pattern with `shared-page.css` and `shared-page.js`
