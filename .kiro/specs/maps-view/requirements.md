# Requirements Document

## Introduction

The Maps View feature adds a new page to CWOC at `/maps` that displays chits with location data as markers on an interactive map. The map uses Leaflet.js with OpenStreetMap tiles, loaded via CDN (no npm/pip installs). Users can filter chits by date range, see color-coded markers by chit status, click markers for chit details, and navigate to the chit editor from marker popups. When the user has the "Prefer Google for Maps" setting enabled, the page displays a warning message instead of the map, since Google Maps is not supported for this feature.

## Glossary

- **Maps_Page**: The new CWOC page served at `/maps` from `maps.html`, displaying an interactive Leaflet map of chits with locations
- **Map_Container**: The Leaflet.js map instance rendered inside the Maps_Page, using OpenStreetMap tile layers
- **Marker**: A Leaflet map marker representing a single geocoded chit, placed at the chit's latitude/longitude coordinates
- **Marker_Cluster**: A Leaflet.markercluster group that aggregates nearby Markers into numbered cluster icons when the map is zoomed out
- **Popup**: A Leaflet popup attached to a Marker, displaying the chit's title, date, and status with a link to the chit editor
- **Date_Range_Filter**: A pair of date inputs (start date and end date) that restrict which chits appear on the map based on their start, due, or created datetime
- **Geocoder**: The existing `_geocodeAddress()` function from `shared-geocoding.js` that converts a text address to `{lat, lon}` coordinates via the backend `/api/geocode` proxy
- **Google_Maps_Warning**: A centered message displayed on the Maps_Page when the `prefer_google_maps` setting is enabled, informing the user that Google Maps is not supported for this feature
- **Chit_API**: The existing `/api/chits` endpoint that returns all non-deleted chits for the authenticated user
- **Settings_Cache**: The `window._cwocSettings` object populated by `shared-utils.js` from `/api/settings/{user_id}`, containing user preferences including `chit_options.prefer_google_maps`

## Requirements

### Requirement 1: Page Serving

**User Story:** As a user, I want to access the Maps View at a dedicated URL, so that I can view my chits on a map.

#### Acceptance Criteria

1. WHEN a user navigates to `/maps`, THE Maps_Page SHALL serve the `maps.html` file via a FastAPI FileResponse route
2. THE Maps_Page SHALL follow the existing CWOC page template pattern, using `shared-page.css`, `shared-page.js` for header/footer injection, and the standard shared script load order
3. THE Maps_Page SHALL load Leaflet.js and Leaflet.markercluster CSS and JavaScript files from a public CDN via `<link>` and `<script>` tags

### Requirement 2: Navigation Integration

**User Story:** As a user, I want to find the Maps View in the navigation menu bewtwwn the indicators & sears buttons, so that I can easily access it from any page.

#### Acceptance Criteria

1. THE Maps_Page SHALL appear as an entry in the shared navigation panel (`shared-page.js` navigate panel) with the label "Maps" and a map icon
2. THE Maps_Page SHALL also appear in the dashboard navigation panel (`main-hotkeys.js`) with a corresponding hotkey number

### Requirement 3: Google Maps Preference Guard

**User Story:** As a user with the "Prefer Google for Maps" setting enabled, I want to see a clear message explaining that Google Maps is not supported for this feature, so that I understand why the map is not displayed.

#### Acceptance Criteria

1. WHEN the Maps_Page loads and `Settings_Cache.chit_options.prefer_google_maps` is true, THE Maps_Page SHALL display the Google_Maps_Warning centered on the page instead of the Map_Container
2. THE Google_Maps_Warning SHALL display the text "Google Maps does not support this feature at this time due to billing restrictions."
3. WHILE the Google_Maps_Warning is displayed, THE Maps_Page SHALL NOT load the Leaflet map, fetch chits, or perform geocoding

### Requirement 4: Chit Fetching and Filtering

**User Story:** As a user, I want to filter which chits appear on the map by date range, so that I can focus on chits relevant to a specific time period.

#### Acceptance Criteria

1. WHEN the Maps_Page loads and the Google Maps preference is not enabled, THE Maps_Page SHALL fetch all chits from the Chit_API
2. THE Maps_Page SHALL display a Date_Range_Filter with start and end date inputs above the Map_Container
3. THE Date_Range_Filter SHALL default the start date to 30 days in the past and the end date to 30 days in the future
4. WHEN the user changes either date in the Date_Range_Filter, THE Maps_Page SHALL re-filter the displayed Markers to show only chits whose start_datetime, due_datetime, or created_datetime falls within the selected range
5. THE Maps_Page SHALL only process chits that have a non-empty `location` field

### Requirement 5: Geocoding and Marker Placement

**User Story:** As a user, I want my chits with locations to appear as markers on the map, so that I can see where my activities are geographically.

#### Acceptance Criteria

1. WHEN chits with locations are loaded, THE Maps_Page SHALL geocode each unique location address using the Geocoder
2. THE Maps_Page SHALL cache geocoded coordinates in memory so that duplicate addresses are only geocoded once per page load
3. WHEN a chit's location is successfully geocoded, THE Maps_Page SHALL place a Marker on the Map_Container at the returned latitude and longitude
4. IF a chit's location cannot be geocoded, THEN THE Maps_Page SHALL skip that chit without displaying an error to the user and log a warning to the browser console

### Requirement 6: Marker Clustering

**User Story:** As a user, I want markers to cluster together when zoomed out, so that the map remains readable when many chits are displayed.

#### Acceptance Criteria

1. THE Maps_Page SHALL group all Markers into a Marker_Cluster layer using the Leaflet.markercluster plugin
2. WHEN the user zooms out, THE Marker_Cluster SHALL aggregate nearby Markers into numbered cluster icons
3. WHEN the user zooms in or clicks a cluster icon, THE Marker_Cluster SHALL expand to reveal individual Markers

### Requirement 7: Marker Popups

**User Story:** As a user, I want to click a map marker and see details about the chit, so that I can identify which chit is at that location.

#### Acceptance Criteria

1. WHEN the user clicks a Marker, THE Marker SHALL display a Popup containing the chit's title, the chit's relevant date (start_datetime or due_datetime or created_datetime), and the chit's status
2. THE Popup SHALL include a clickable link that navigates the user to the chit editor page at `/editor?id={chit_id}`

### Requirement 8: Color-Coded Markers by Status

**User Story:** As a user, I want markers to be color-coded by chit status, so that I can visually distinguish between different types of chits on the map.

#### Acceptance Criteria

1. THE Maps_Page SHALL assign a distinct marker color to each chit status: ToDo, In Progress, Blocked, Complete, and no-status
2. THE Maps_Page SHALL render each Marker using the color corresponding to its chit's status
3. THE Maps_Page SHALL display a legend on the map showing the color-to-status mapping

### Requirement 9: Map Initialization and Bounds

**User Story:** As a user, I want the map to automatically zoom to show all my markers, so that I can see all relevant chits without manual panning.

#### Acceptance Criteria

1. WHEN Markers are placed on the Map_Container, THE Map_Container SHALL auto-fit its view bounds to encompass all visible Markers with appropriate padding
2. IF no chits have geocodable locations, THEN THE Maps_Page SHALL display the Map_Container centered on a default world view and show an informational message indicating no chits with locations were found in the selected date range

### Requirement 10: Help Documentation

**User Story:** As a user, I want to find documentation about the Maps View in the help page, so that I can learn how to use the feature.

#### Acceptance Criteria

1. WHEN the Maps View feature is added, THE Help page SHALL include a new section documenting the Maps View, its date range filter, marker popups, clustering behavior, color-coded status markers, and the Google Maps preference warning

### Requirement 11: Index and Version Updates

**User Story:** As a developer, I want the code index and version to reflect the new Maps View files, so that the project documentation stays current.

#### Acceptance Criteria

1. WHEN the Maps View feature is complete, THE `src/INDEX.md` file SHALL be updated to include all new files, routes, and functions added for the Maps View
2. WHEN the Maps View feature is complete, THE `src/VERSION` file SHALL be updated with the current timestamp using the `date "+%Y%m%d.%H%M"` format
3. WHEN the Maps View feature is complete, a release notes file SHALL be created in `documents/release_notes/` documenting the new Maps View feature

### Requirement 12: Responsive Layout

**User Story:** As a user on a mobile device, I want the Maps View to be usable on smaller screens, so that I can view chits on the map from my phone or tablet.

#### Acceptance Criteria

1. THE Maps_Page SHALL render the Map_Container at full available width below the Date_Range_Filter
2. WHILE the viewport width is 768px or less, THE Date_Range_Filter SHALL stack its inputs vertically
3. THE Map_Container SHALL have a minimum height of 400px and scale to fill available vertical space
