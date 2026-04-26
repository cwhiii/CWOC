# Requirements Document

## Introduction

This feature fixes broken weather loading in the chit editor, introduces a saved locations system managed through Settings, adds a dashboard weather hotkey modal, and enhances the editor's Location zone with saved-location selection and management controls. Currently, weather fails to load even when a chit has both an address and a date set. The `defaultAddress` constant is hardcoded as an empty string, and the weather fetch logic has control-flow issues that prevent display on both mobile and desktop. This feature resolves those bugs and builds a full saved-locations subsystem on top of the fix.

## Glossary

- **Editor**: The chit editor page (`editor.html` + `editor.js`) where users create and edit individual chits.
- **Dashboard**: The main landing page (`index.html` + `main.js`) showing the C CAPTN tab views.
- **Settings_Page**: The settings page (`settings.html` + `settings.js`) where users configure application preferences.
- **Weather_Service**: The subsystem that geocodes addresses via OpenStreetMap Nominatim and fetches forecast data from the Open-Meteo API.
- **Saved_Location**: A user-defined address entry stored in settings, consisting of a label and an address string.
- **Default_Location**: The single Saved_Location marked by the user as the default, used for the dashboard weather modal and as the quick-add location in the editor.
- **Locations_Section**: The new section on the Settings_Page for managing Saved_Locations.
- **Location_Zone**: The collapsible zone in the Editor for setting a chit's address, map, and weather.
- **Weather_Modal**: A modal dialog on the Dashboard that displays weather for the Default_Location.
- **Compact_Weather_Section**: The inline weather display area within the Editor's Location_Zone (`compactWeatherSection` element).

## Requirements

### Requirement 1: Fix Weather Loading in the Editor

**User Story:** As a user, I want weather to load correctly when I open a chit that has an address and a date, so that I can see the forecast without manual intervention.

#### Acceptance Criteria

1. WHEN a chit with a non-empty `location` field and at least one date field (`start_datetime` or `due_datetime`) is loaded, THE Weather_Service SHALL geocode the address and fetch forecast data, and THE Editor SHALL display the result in the Compact_Weather_Section.
2. WHEN the `searchLocationMap` function is invoked with a valid address and a date is present on the chit, THE Weather_Service SHALL fetch and display weather data in the Compact_Weather_Section.
3. IF the Weather_Service fails to geocode an address or fetch forecast data, THEN THE Editor SHALL display a descriptive error message in the Compact_Weather_Section instead of leaving it in a loading state.
4. WHEN a chit has a location but no date, THE Editor SHALL display a placeholder message in the Compact_Weather_Section indicating that a date is needed for weather.
5. WHEN a chit has a date but no location, THE Editor SHALL display a placeholder message in the Compact_Weather_Section indicating that a location is needed for weather.
6. THE Weather_Service SHALL function identically on mobile and desktop viewports with no layout or fetch differences.

### Requirement 2: Saved Locations in Settings

**User Story:** As a user, I want to manage a list of saved locations in Settings, so that I can quickly reuse addresses across chits and the dashboard.

#### Acceptance Criteria

1. THE Locations_Section SHALL appear on the Settings_Page as a distinct section.
2. WHEN the Locations_Section is first displayed and no Saved_Locations exist, THE Settings_Page SHALL show one empty address input slot.
3. WHEN a Saved_Location address input contains a non-empty value, THE Settings_Page SHALL display a "+" button to add another empty Saved_Location row.
4. THE Settings_Page SHALL provide an editable label text input for each Saved_Location.
5. THE Settings_Page SHALL provide a radio button for each Saved_Location to designate it as the Default_Location.
6. WHEN only one Saved_Location exists and has a non-empty address, THE Settings_Page SHALL automatically select that Saved_Location as the Default_Location.
7. WHEN the user saves settings, THE Settings_Page SHALL persist all Saved_Locations (labels, addresses, and default selection) to the backend via the `/api/settings/default_user` endpoint.
8. IF the user removes all text from a Saved_Location address and it is not the only remaining row, THEN THE Settings_Page SHALL remove that empty row on save, keeping at least one row visible.

### Requirement 3: Backend Storage for Saved Locations

**User Story:** As a developer, I want saved locations stored in the settings table, so that the frontend can retrieve them on any page.

#### Acceptance Criteria

1. THE Backend SHALL add a `saved_locations` column to the `settings` table as a JSON-serialized text field.
2. THE Backend SHALL include `saved_locations` in the `Settings` Pydantic model as an optional JSON-serializable field.
3. WHEN the `/api/settings/{user_id}` endpoint is called, THE Backend SHALL deserialize and return the `saved_locations` field.
4. WHEN the `/api/settings` POST endpoint is called, THE Backend SHALL serialize and persist the `saved_locations` field.
5. THE Backend SHALL run an inline migration at startup that adds the `saved_locations` column if it does not already exist.

### Requirement 4: Dashboard Weather Hotkey and Modal

**User Story:** As a user, I want to press "W" on the dashboard to see the weather at my default location, so that I can quickly check the forecast without opening a chit.

#### Acceptance Criteria

1. WHEN the user presses the "W" key on the Dashboard and no text input is focused, THE Dashboard SHALL open the Weather_Modal.
2. WHEN the Weather_Modal opens, THE Weather_Service SHALL fetch and display the current forecast for the Default_Location.
3. IF no Default_Location is configured, THEN THE Weather_Modal SHALL display a message directing the user to configure a location in Settings.
4. WHEN the user presses Escape or clicks outside the Weather_Modal, THE Dashboard SHALL close the Weather_Modal.
5. THE Weather_Modal SHALL display the location label, address, weather icon, high/low temperatures in Fahrenheit, and precipitation information.
6. THE Weather_Modal SHALL match the existing parchment/brown visual theme of the Dashboard.

### Requirement 5: Editor Location Zone — Default and Saved Location Controls

**User Story:** As a user, I want to quickly populate a chit's location from my saved locations, so that I do not have to retype addresses.

#### Acceptance Criteria

1. WHEN a new chit is created, THE Editor SHALL leave the location address field empty by default.
2. THE Location_Zone header SHALL include a "+Location" button.
3. WHEN the user clicks the "+Location" button, THE Editor SHALL populate the location address field with the Default_Location address.
4. IF no Default_Location is configured and the user clicks "+Location", THEN THE Editor SHALL display a message indicating no default location is set.
5. THE Location_Zone SHALL include a dropdown that lists all Saved_Locations displayed with their labels.
6. THE Location_Zone dropdown SHALL include a null/empty option to clear the selection.
7. WHEN the user selects a Saved_Location from the dropdown, THE Editor SHALL populate the location address field with the selected Saved_Location's address.
8. WHEN the user selects the null option from the dropdown, THE Editor SHALL clear the location address field.
9. THE Location_Zone SHALL include a button to remove/clear the current location from the chit.
10. WHEN the user clicks the remove/clear location button, THE Editor SHALL clear the location address field, the map display, and the Compact_Weather_Section.
11. THE Editor SHALL enforce that a chit can have at most one location at any time.

### Requirement 6: Editor Saved Locations Dropdown Button

**User Story:** As a user, I want a compact dropdown button in the editor that shows my saved locations, so that I can quickly pick a location without scrolling to the Location zone.

#### Acceptance Criteria

1. THE Editor SHALL display a button-sized dropdown element that, when clicked, shows the list of Saved_Locations with their labels.
2. WHEN the user selects a Saved_Location from the dropdown button, THE Editor SHALL populate the location address field with the selected address and trigger weather and map loading.
3. WHEN the Saved_Locations list is empty, THE dropdown button SHALL display a message indicating no saved locations are configured.
