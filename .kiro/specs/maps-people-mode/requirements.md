# Requirements Document

## Introduction

The Maps People Mode feature extends the existing Maps View page (`/maps`) to support two distinct display modes: "Chits" mode (the current behavior showing chits on the map) and "People" mode (showing contacts/people on the map using their addresses). A toggle switch on the maps page allows the user to switch between modes. Each mode has its own filter system: Chits mode uses the same status/tag/priority/people filters found in the dashboard sidebar, while People mode uses the same search and filter patterns found in the editor's expanded people zone (Rolodex).

## Glossary

- **Maps_Page**: The existing CWOC page served at `/maps` from `maps.html`, displaying an interactive Leaflet map
- **Mode_Toggle**: A UI control on the Maps_Page that switches between Chits mode and People mode
- **Chits_Mode**: The map display mode showing geocoded chit locations as color-coded markers (existing behavior)
- **People_Mode**: The map display mode showing geocoded contact addresses as markers on the map
- **Chits_Filter_Panel**: A filter panel displayed in Chits mode, providing status, tag, priority, people, and text search filters matching the dashboard sidebar filter system
- **People_Filter_Panel**: A filter panel displayed in People mode, providing search and filter controls matching the editor people zone (Rolodex) patterns — text search across all contact fields, favorites filtering, and tag filtering
- **Contact_Marker**: A Leaflet map marker representing a single contact, placed at the geocoded coordinates of one of the contact's addresses
- **Contact_Popup**: A Leaflet popup attached to a Contact_Marker, displaying the contact's name, address, and a link to the contact editor
- **Contacts_API**: The existing `/api/contacts` endpoint that returns all contacts for the authenticated user
- **Chit_API**: The existing `/api/chits` endpoint that returns all non-deleted chits for the authenticated user
- **Geocoder**: The existing `_geocodeAddress()` function from `shared-geocoding.js` that converts a text address to `{lat, lon}` coordinates

## Requirements

### Requirement 1: Mode Toggle

**User Story:** As a user, I want to switch between Chits and People modes on the Maps page, so that I can view either my chits or my contacts on the map.

#### Acceptance Criteria

1. THE Maps_Page SHALL display a Mode_Toggle control above the map that allows switching between "Chits" and "People" modes
2. WHEN the Maps_Page loads, THE Mode_Toggle SHALL default to Chits mode (preserving existing behavior)
3. WHEN the user selects People mode via the Mode_Toggle, THE Maps_Page SHALL clear the current chit markers and display contact markers instead
4. WHEN the user selects Chits mode via the Mode_Toggle, THE Maps_Page SHALL clear the current contact markers and display chit markers instead
5. THE Maps_Page SHALL persist the selected mode in localStorage so that the user's preference is restored on subsequent page loads

### Requirement 2: Chits Mode Filters

**User Story:** As a user, I want to filter chits on the map using the same filters available in the dashboard, so that I can focus on specific chits by status, tag, priority, or associated people.

#### Acceptance Criteria

1. WHILE Chits mode is active, THE Maps_Page SHALL display a Chits_Filter_Panel containing status checkboxes (ToDo, In Progress, Blocked, Complete), tag filter chips, priority checkboxes, people filter chips, and a text search input
2. THE Chits_Filter_Panel SHALL use the same filter logic as the dashboard sidebar: status multi-select with "Any" default, tag selection from user's configured tags, priority selection, and people chip selection from contacts and system users
3. WHEN the user changes any filter in the Chits_Filter_Panel, THE Maps_Page SHALL re-filter the displayed chit markers to show only chits matching all active filter criteria
4. THE Chits_Filter_Panel SHALL include the existing date range filter (start date and end date inputs) that is already present on the Maps_Page
5. WHEN a text search is entered, THE Maps_Page SHALL filter chit markers to only those whose title, note, location, or tags contain the search text (case-insensitive)
6. THE Chits_Filter_Panel SHALL include a "Clear Filters" button that resets all filters to their default state

### Requirement 3: People Mode Display

**User Story:** As a user, I want to see my contacts displayed on the map at their addresses, so that I can visualize where my contacts are located geographically.

#### Acceptance Criteria

1. WHEN People mode is active, THE Maps_Page SHALL fetch all contacts from the Contacts_API
2. THE Maps_Page SHALL geocode each contact's address fields and place a Contact_Marker at the resulting coordinates
3. WHEN a contact has multiple addresses, THE Maps_Page SHALL place a separate Contact_Marker for each address
4. IF a contact has no addresses, THEN THE Maps_Page SHALL skip that contact without displaying an error
5. IF a contact's address cannot be geocoded, THEN THE Maps_Page SHALL skip that address and log a warning to the browser console
6. THE Maps_Page SHALL cache geocoded contact addresses in memory so that duplicate addresses are only geocoded once per page load

### Requirement 4: People Mode Filters

**User Story:** As a user, I want to filter contacts on the map using the same search and filter patterns from the Rolodex, so that I can find specific contacts on the map.

#### Acceptance Criteria

1. WHILE People mode is active, THE Maps_Page SHALL display a People_Filter_Panel containing a text search input, a favorites-only toggle, and tag filter chips
2. THE People_Filter_Panel text search SHALL filter contacts across all fields: display_name, given_name, surname, nickname, organization, social_context, emails, phones, addresses, call_signs, x_handles, websites, notes, and tags (matching the `_contactMatchesFilter` logic in editor-people.js)
3. WHEN the favorites-only toggle is active, THE Maps_Page SHALL display Contact_Markers only for contacts marked as favorites
4. WHEN tag filters are selected, THE Maps_Page SHALL display Contact_Markers only for contacts that have at least one of the selected tags
5. WHEN the user changes any filter in the People_Filter_Panel, THE Maps_Page SHALL re-filter the displayed Contact_Markers to show only contacts matching all active filter criteria
6. THE People_Filter_Panel SHALL include a "Clear Filters" button that resets all filters to their default state

### Requirement 5: Contact Marker Appearance

**User Story:** As a user, I want contact markers to be visually distinct from chit markers and reflect the contact's color, so that I can identify contacts on the map.

#### Acceptance Criteria

1. THE Maps_Page SHALL render each Contact_Marker using the contact's assigned color as the marker fill color
2. IF a contact has no assigned color, THEN THE Maps_Page SHALL use a default teal color (#008080) for the Contact_Marker
3. THE Contact_Marker style SHALL be visually distinct from chit markers (using a different marker shape or border style)
4. WHEN a contact has a profile image, THE Maps_Page SHALL display the image as part of the Contact_Marker or its popup

### Requirement 6: Contact Marker Popups

**User Story:** As a user, I want to click a contact marker and see details about the contact, so that I can identify which contact is at that location.

#### Acceptance Criteria

1. WHEN the user clicks a Contact_Marker, THE Contact_Marker SHALL display a Contact_Popup containing the contact's display name, the specific address for that marker, the contact's organization (if present), and the contact's primary phone and email (if present)
2. THE Contact_Popup SHALL include a clickable link that navigates the user to the contact editor page at `/frontend/html/contact-editor.html?id={contact_id}`
3. IF the contact has a profile image, THEN THE Contact_Popup SHALL display a small thumbnail of the image

### Requirement 7: Contact Marker Clustering

**User Story:** As a user, I want contact markers to cluster together when zoomed out, so that the map remains readable when many contacts are displayed.

#### Acceptance Criteria

1. THE Maps_Page SHALL group all Contact_Markers into a marker cluster layer using the Leaflet.markercluster plugin
2. WHEN the user zooms out, THE marker cluster SHALL aggregate nearby Contact_Markers into numbered cluster icons
3. THE People mode cluster icons SHALL be visually distinct from Chits mode cluster icons (using a different color scheme)

### Requirement 8: People Mode Legend

**User Story:** As a user, I want to see a legend explaining the contact marker colors, so that I can understand what the markers represent.

#### Acceptance Criteria

1. WHILE People mode is active, THE Maps_Page SHALL display a legend indicating that markers are colored by contact color
2. THE People mode legend SHALL replace the Chits mode status-color legend when People mode is active
3. WHEN the user switches back to Chits mode, THE Maps_Page SHALL restore the original status-color legend

### Requirement 9: Filter Panel Visibility

**User Story:** As a user, I want only the relevant filter panel to be visible for the active mode, so that the interface is not cluttered with irrelevant controls.

#### Acceptance Criteria

1. WHILE Chits mode is active, THE Maps_Page SHALL display the Chits_Filter_Panel and hide the People_Filter_Panel
2. WHILE People mode is active, THE Maps_Page SHALL display the People_Filter_Panel and hide the Chits_Filter_Panel
3. WHEN the user switches modes via the Mode_Toggle, THE Maps_Page SHALL animate or transition the filter panel swap smoothly

### Requirement 10: Google Maps Preference Guard

**User Story:** As a user with the "Prefer Google for Maps" setting enabled, I want the warning to still apply regardless of mode, so that the behavior is consistent.

#### Acceptance Criteria

1. WHEN the Maps_Page loads and `Settings_Cache.chit_options.prefer_google_maps` is true, THE Maps_Page SHALL display the Google_Maps_Warning and hide both the Mode_Toggle and all filter panels
2. THE Google_Maps_Warning behavior SHALL remain unchanged from the existing maps-view implementation

### Requirement 11: Empty State Messages

**User Story:** As a user, I want to see helpful messages when no markers can be displayed, so that I understand why the map is empty.

#### Acceptance Criteria

1. IF no chits match the active filters in Chits mode, THEN THE Maps_Page SHALL display an informational message indicating no chits match the current filters
2. IF no contacts have geocodable addresses in People mode, THEN THE Maps_Page SHALL display an informational message indicating no contacts with addresses were found
3. IF no contacts match the active filters in People mode, THEN THE Maps_Page SHALL display an informational message indicating no contacts match the current filters

### Requirement 12: Responsive Layout

**User Story:** As a user on a mobile device, I want the mode toggle and filter panels to be usable on smaller screens, so that I can use the feature from my phone.

#### Acceptance Criteria

1. WHILE the viewport width is 768px or less, THE Mode_Toggle SHALL display as a compact toggle that does not consume excessive vertical space
2. WHILE the viewport width is 768px or less, THE Chits_Filter_Panel and People_Filter_Panel SHALL collapse into an expandable/collapsible section to preserve map visibility
3. THE filter panels SHALL stack their controls vertically on narrow viewports

### Requirement 13: Help Documentation

**User Story:** As a user, I want to find documentation about the Maps People Mode in the help page, so that I can learn how to use the feature.

#### Acceptance Criteria

1. WHEN the Maps People Mode feature is added, THE Help page SHALL update the existing Maps View section to document the mode toggle, People mode, contact markers, and the filter systems for both modes

### Requirement 14: Index and Version Updates

**User Story:** As a developer, I want the code index and version to reflect the Maps People Mode changes, so that the project documentation stays current.

#### Acceptance Criteria

1. WHEN the Maps People Mode feature is complete, THE `src/INDEX.md` file SHALL be updated to include all new and modified functions added for this feature
2. WHEN the Maps People Mode feature is complete, THE `src/VERSION` file SHALL be updated with the current timestamp using the `date "+%Y%m%d.%H%M"` format
3. WHEN the Maps People Mode feature is complete, a release notes file SHALL be created in `documents/release_notes/` documenting the new Maps People Mode feature
