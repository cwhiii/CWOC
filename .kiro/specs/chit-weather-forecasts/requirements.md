# Requirements Document

## Introduction

This feature extends the existing weather infrastructure (Open-Meteo API, Nominatim geocoding, saved locations, weather modal) to persist weather forecasts per chit, display weather on calendar views, automatically refresh forecasts on a schedule, and provide a dedicated full-page weather view. Currently, weather data is fetched live and cached only in localStorage — it is not stored in the chit record itself. This spec adds a `weather_data` JSON field to each chit, background update logic with two tiers (hourly for 7-day window, daily for 16-day window), calendar view weather display, and a full weather page accessible via Shift+W.

## Glossary

- **Chit**: A single flexible record in the CWOC system that can serve as a task, note, calendar event, alarm, checklist, or project.
- **Weather_Data**: A JSON object stored on a chit containing forecast fields: `focus_date`, `updated_time`, `high`, `low`, `precipitation`, `weather_code`.
- **Weather_Service**: The subsystem that geocodes addresses via OpenStreetMap Nominatim and fetches forecast data from the Open-Meteo API.
- **Calendar_View**: Any of the dashboard period views that display chits on a time-based layout (Day, Week, Work Hours, X Days, Month, Year, Itinerary).
- **Weather_Page**: A dedicated full-page view (like Settings) that displays all saved locations' full forecasts in a table layout.
- **Saved_Location**: A user-defined address entry stored in settings, consisting of a label and an address string (implemented in the saved-locations-weather spec).
- **Backend**: The FastAPI application in `backend/main.py`.
- **Dashboard**: The main landing page (`index.html` + `main.js`) showing the C CAPTN tab views.
- **Editor**: The chit editor page (`editor.html` + `editor.js`) where users create and edit individual chits.
- **Weather_Update_Service**: The backend subsystem responsible for periodically fetching and storing weather forecasts for chits that have locations and dates within the update windows.
- **Compact_Weather_Section**: The inline weather display area within the Editor's Location zone.

## Requirements

### Requirement 1: Persist Weather Forecast Data Per Chit

**User Story:** As a user, I want weather forecast data saved on each chit that has a location and date, so that I can see the expected weather without waiting for a live fetch every time.

#### Acceptance Criteria

1. THE Backend SHALL store a `weather_data` field on each chit as a JSON-serialized text column in the `chits` table.
2. THE `weather_data` JSON object SHALL contain the fields: `focus_date` (the date the forecast is for), `updated_time` (ISO timestamp of when the forecast was last fetched), `high` (high temperature in Celsius), `low` (low temperature in Celsius), `precipitation` (precipitation sum in mm), and `weather_code` (WMO weather code integer).
3. THE Backend SHALL include `weather_data` in the Chit Pydantic model as an optional JSON-serializable field.
4. WHEN the `/api/chits` GET endpoint is called, THE Backend SHALL deserialize and return the `weather_data` field for each chit.
5. WHEN the `/api/chits/{chit_id}` GET endpoint is called, THE Backend SHALL deserialize and return the `weather_data` field.
6. WHEN the `/api/chits` POST or `/api/chits/{chit_id}` PUT endpoint is called with a `weather_data` value, THE Backend SHALL serialize and persist the `weather_data` field.
7. THE Backend SHALL run an inline migration at startup that adds the `weather_data` column to the `chits` table if the column does not already exist.

### Requirement 2: Display Weather on Calendar Views

**User Story:** As a user, I want to see the saved weather forecast on calendar event cards, so that I can plan my day based on expected conditions.

#### Acceptance Criteria

1. WHEN a chit has a non-empty `weather_data` field, THE Calendar_View SHALL display the weather icon (derived from `weather_code`), high temperature, and low temperature on the chit's calendar event card.
2. WHEN a chit has a non-empty `weather_data` field and the Calendar_View is Day, Week, Work Hours, or X Days, THE Calendar_View SHALL display the precipitation value on the chit's calendar event card.
3. WHEN a chit has no `weather_data` field but has a location, THE Calendar_View SHALL fall back to the existing live-fetch weather indicator behavior.
4. THE Calendar_View SHALL display temperatures in Fahrenheit, converting from the stored Celsius values.
5. WHEN a chit's `weather_data` field has an `updated_time` older than 24 hours, THE Calendar_View SHALL display a stale indicator icon next to the weather data.

### Requirement 3: Automatic Weather Updates — Hourly for 7-Day Window

**User Story:** As a user, I want weather forecasts for chits in the next 7 days to update every hour, so that I have near-real-time forecast accuracy for upcoming events.

#### Acceptance Criteria

1. THE Weather_Update_Service SHALL identify all non-deleted chits that have a non-empty `location` field and at least one date field (`start_datetime` or `due_datetime`) falling within the next 7 calendar days from the current time.
2. THE Weather_Update_Service SHALL fetch updated forecast data from the Open-Meteo API for each identified chit using the chit's `location` field for geocoding.
3. WHEN the Weather_Update_Service successfully fetches forecast data for a chit, THE Weather_Update_Service SHALL update the chit's `weather_data` field with the new forecast values and set `updated_time` to the current ISO timestamp.
4. THE Weather_Update_Service SHALL execute the hourly update cycle once every 60 minutes.
5. IF the Weather_Update_Service fails to geocode a chit's location or fetch forecast data, THEN THE Weather_Update_Service SHALL log the error and skip that chit without affecting other chits in the batch.
6. THE Weather_Update_Service SHALL respect Nominatim rate limits by inserting a minimum 1-second delay between geocoding requests.

### Requirement 4: Automatic Weather Updates — Daily for 16-Day Window

**User Story:** As a user, I want weather forecasts for chits in the next 16 days to update once daily, so that I have a general forecast for events further out.

#### Acceptance Criteria

1. THE Weather_Update_Service SHALL identify all non-deleted chits that have a non-empty `location` field and at least one date field (`start_datetime` or `due_datetime`) falling within the next 8 to 16 calendar days from the current time (chits already covered by the 7-day hourly window are excluded).
2. THE Weather_Update_Service SHALL fetch updated forecast data from the Open-Meteo API for each identified chit in the 8-to-16-day window.
3. WHEN the Weather_Update_Service successfully fetches forecast data for a chit in the daily window, THE Weather_Update_Service SHALL update the chit's `weather_data` field with the new forecast values and set `updated_time` to the current ISO timestamp.
4. THE Weather_Update_Service SHALL execute the daily update cycle once every 24 hours.
5. IF the Weather_Update_Service fails to geocode a chit's location or fetch forecast data for a chit in the daily window, THEN THE Weather_Update_Service SHALL log the error and skip that chit without affecting other chits in the batch.

### Requirement 5: Backend Weather Update API Endpoint

**User Story:** As a developer, I want a backend endpoint that triggers weather updates for eligible chits, so that the update process can be invoked by a scheduled task or manual trigger.

#### Acceptance Criteria

1. THE Backend SHALL expose a POST `/api/weather/update` endpoint that triggers the weather update process for all eligible chits.
2. WHEN the `/api/weather/update` endpoint is called, THE Backend SHALL geocode each unique location once and reuse coordinates for all chits sharing that location.
3. WHEN the `/api/weather/update` endpoint is called, THE Backend SHALL fetch multi-day forecasts from Open-Meteo (up to 16 days) and match each chit's focus date to the correct day in the forecast response.
4. THE `/api/weather/update` endpoint SHALL return a summary object containing the count of chits updated, the count of chits skipped due to errors, and the total execution time.
5. THE Backend SHALL run the weather update automatically on a background schedule: the hourly cycle for the 7-day window and the daily cycle for the 8-to-16-day window.

### Requirement 6: Editor Weather Data Display and Persistence

**User Story:** As a user, I want the editor to show and save the weather forecast stored on a chit, so that I can see the persisted forecast and it stays up to date.

#### Acceptance Criteria

1. WHEN a chit with a non-empty `weather_data` field is loaded in the Editor, THE Editor SHALL display the stored forecast data in the Compact_Weather_Section immediately, before any live fetch.
2. WHEN the Editor fetches live weather data for a chit (via user action or on load), THE Editor SHALL update the chit's `weather_data` field in memory with the new forecast values.
3. WHEN the user saves a chit in the Editor, THE Editor SHALL include the current `weather_data` value in the save payload sent to the Backend.

### Requirement 7: Full Weather Page

**User Story:** As a user, I want a dedicated weather page that shows all my saved locations' full forecasts in a table layout, so that I can see a comprehensive weather overview at a glance.

#### Acceptance Criteria

1. THE Weather_Page SHALL be accessible via the keyboard shortcut Shift+W from the Dashboard when no text input is focused.
2. THE Weather_Page SHALL be accessible via a navigation button on the Weather Modal (the existing "W" hotkey modal).
3. THE Weather_Page SHALL be accessible via a button or link from any Calendar_View.
4. THE Weather_Page SHALL display one row per Saved_Location, with the location label and address shown in the row header.
5. THE Weather_Page SHALL display each forecast day as a separate block within the row, with the date displayed above each block.
6. EACH forecast day block on the Weather_Page SHALL display the weather icon (derived from weather code), high temperature in Fahrenheit, low temperature in Fahrenheit, and precipitation.
7. THE Weather_Page SHALL fetch up to 16 days of forecast data from the Open-Meteo API for each Saved_Location.
8. THE Weather_Page SHALL use the shared-page template (`_template.html` pattern) with `shared-page.css` and `shared-page.js` for consistent styling and header/footer injection.
9. IF no Saved_Locations are configured, THEN THE Weather_Page SHALL display a message directing the user to configure locations in Settings.
10. THE Weather_Page SHALL match the existing parchment/brown visual theme.
11. WHEN the user presses Escape on the Weather_Page and no modals are open, THE Weather_Page SHALL navigate back to the previous page.

### Requirement 8: Weather Data Round-Trip Integrity

**User Story:** As a developer, I want to verify that weather data stored on a chit survives a full save-and-load cycle without data loss, so that forecast persistence is reliable.

#### Acceptance Criteria

1. FOR ALL valid `weather_data` JSON objects (containing `focus_date`, `updated_time`, `high`, `low`, `precipitation`, and `weather_code` fields), saving a chit with that `weather_data` via the POST or PUT endpoint and then loading the chit via the GET endpoint SHALL return an equivalent `weather_data` object (round-trip property).
2. FOR ALL chits with a `weather_data` field, THE Backend SHALL preserve the exact numeric precision of `high`, `low`, and `precipitation` values through the save-and-load cycle.
