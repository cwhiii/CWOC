# Requirements Document

## Introduction

This spec covers Android parity implementation for 20 web functions (W176-179, W183, W186, W779, W767, W768, W773, W165-167, W253-255, W791, W921) related to Maps, Weather, and Location features. The goal is to make the Android app produce the same user-facing outcomes as the web app for all map thumbnails, inline map previews, location utilities, weather navigation, weather visual enhancements, and map filtering capabilities.

## Glossary

- **Chit_Card**: A card UI element in list/calendar views representing a single chit record
- **LocationZone**: The location section within the chit editor that displays and manages a chit's geographic location
- **MapScreen**: The internal CWOC maps page/screen showing chits and contacts on an interactive map
- **WeatherScreen**: The Android screen displaying weather forecasts for saved locations
- **WeatherModal**: The modal dialog for viewing weather forecasts (accessible from dashboard)
- **GeocodingUtil**: The Android utility class responsible for converting addresses to latitude/longitude coordinates
- **MapViewModel**: The ViewModel managing state and logic for the MapScreen
- **Static_Map_Tile**: A pre-rendered map image from OpenStreetMap tiles showing a location without interactivity
- **Highlight_Marker**: A temporary visual indicator (gold pulsing circle) placed on the map to draw attention to a focused location
- **Temperature_Bar**: A colored gradient bar (blue→green→yellow→orange→red) showing where a day's temperature range falls within the overall scale
- **People_Filter_Panel**: A UI panel on the maps page allowing filtering of displayed contacts by favorites, tags, and text search
- **Progressive_Fallback_Geocoding**: A geocoding strategy that tries multiple address variants (stripped zip, normalized periods, comma-split, city/state extraction) sequentially until one succeeds

## Requirements

### Requirement 1: Map Thumbnails on Chit Cards (W176-179)

**User Story:** As a user, I want to see inline map thumbnail previews on chit cards that have a location, so that I can get visual geographic context without opening the editor.

#### Acceptance Criteria

1. WHEN a Chit_Card has a location that differs from the user's default saved location AND the showMapThumbnails setting is enabled, THE Chit_Card SHALL display a Static_Map_Tile showing the chit's location as a 120×80 pixel tile on desktop and 90×60 pixel tile on viewports at or below 600px width
2. WHEN the showMapThumbnails setting is disabled, THE Chit_Card SHALL hide the map thumbnail and display location as text only
3. THE Static_Map_Tile SHALL render using OpenStreetMap tile data centered on the chit's latitude and longitude at zoom level 14, with a pin overlay centered on the tile
4. WHEN a Chit_Card does not have a location set OR the location matches the user's default saved location, THE Chit_Card SHALL not display any map thumbnail area
5. IF geocoding for the chit's location has not yet resolved, THEN THE Chit_Card SHALL display a map-marker placeholder icon in the thumbnail area until coordinates are available
6. IF geocoding for the chit's location fails, THEN THE Chit_Card SHALL retain the placeholder icon without displaying an error

### Requirement 2: Inline Map Preview in Editor (W183)

**User Story:** As a user, I want to see an inline map preview in the editor's location zone after geocoding, so that I can visually confirm the correct location without leaving the editor.

#### Acceptance Criteria

1. WHEN the LocationZone has successfully geocoded an address, THE LocationZone SHALL display an inline OpenStreetMap embed with a marker centered on the geocoded coordinates, rendered at 100% of the LocationZone width and a fixed height of 200px
2. THE inline map preview SHALL be rendered within the LocationZone, inserted directly below the location input field, without requiring navigation to another screen
3. WHEN the location field is cleared, THE LocationZone SHALL remove the inline map preview and any associated map container element
4. IF geocoding fails for the entered address, THEN THE LocationZone SHALL not display a map preview and SHALL display a toast notification indicating the location could not be found

### Requirement 3: One-Tap Default Location (W186)

**User Story:** As a user, I want a one-tap button to instantly populate the location field from my default saved location, so that I can quickly set a common location without browsing a dropdown.

#### Acceptance Criteria

1. WHEN the location field is empty, THE LocationZone SHALL display a one-tap default location button labeled with a plus icon and "Location" text
2. WHEN the user taps the default location button AND a default saved location exists, THE LocationZone SHALL populate the location field with the default saved location's address field value (not the name/label)
3. WHEN the user taps the default location button AND no default saved location is configured, THE LocationZone SHALL display a toast error message indicating no default location is set and directing the user to configure one in Settings
4. WHEN a saved location is selected (from dropdown or default button), THE LocationZone SHALL use the location's address field value rather than the name/label field
5. WHEN the location field is populated AND a date is set on the chit, THE LocationZone SHALL trigger geocoding and weather fetch for the populated address within 2 seconds of population
6. WHEN the location field is populated, THE LocationZone SHALL replace the default location button with a clear button labeled with a times icon and "Clear" text
7. IF geocoding fails for the populated address, THEN THE LocationZone SHALL display a toast error message indicating the location could not be found and SHALL retain the entered address text in the location field
8. WHEN the location field is populated AND no date is set on the chit, THE LocationZone SHALL trigger geocoding and map display but SHALL NOT attempt weather fetch

### Requirement 4: View Location in Context (W779)

**User Story:** As a user, I want a "View in Context" button in the editor's location zone that navigates to the internal MapScreen centered on the chit's location, so that I can see the chit in its geographic context within CWOC.

#### Acceptance Criteria

1. WHEN the location input field contains a non-empty address string, THE LocationZone SHALL display a "View in Context" button; WHEN the location input field is empty, THE LocationZone SHALL hide the "View in Context" button
2. WHEN the user taps the "View in Context" button and the editor has no unsaved changes, THE LocationZone SHALL navigate to the MapScreen with query parameters `focus=chit` and `address` set to the URL-encoded location input value
3. IF the editor has unsaved changes when "View in Context" is tapped, THEN THE LocationZone SHALL display a confirmation prompt asking whether to leave without saving, with a "Leave" action and a "Cancel" action
4. IF the user confirms "Leave" on the unsaved changes prompt, THEN THE LocationZone SHALL navigate to the MapScreen with the same parameters as criterion 2; IF the user selects "Cancel", THEN THE LocationZone SHALL dismiss the prompt and remain on the editor
5. WHEN the MapScreen receives `focus=chit` and `address` query parameters, THE MapScreen SHALL geocode the address, center the map on the resulting coordinates, and display a visually distinct marker at that location
6. IF the MapScreen receives a focus address that cannot be geocoded, THEN THE MapScreen SHALL display an error indication to the user and remain on the default map view

### Requirement 5: People Filters on Map (W767)

**User Story:** As a user, I want to filter contacts displayed on the map by favorites, tags, and text search, so that I can focus on specific people without visual clutter.

#### Acceptance Criteria

1. WHILE the MapScreen is in People or Both display mode, THE MapScreen SHALL display a People_Filter_Panel containing a text search input, a favorites-only toggle, a tag filter using filter chips, and a "Clear Filters" button
2. WHEN the favorites-only toggle is activated, THE MapScreen SHALL display only contacts whose `favorite` field is true
3. WHEN one or more tag filters are selected, THE MapScreen SHALL display only contacts that have at least one tag matching any of the selected filter tags (OR logic within the tag filter)
4. WHEN text is entered in the people search filter, THE MapScreen SHALL apply a case-insensitive substring match after a 300-millisecond debounce delay, searching across contact fields: display_name, given_name, surname, middle_names, nickname, organization, social_context, notes, emails, phones, addresses, call_signs, x_handles, websites, and tags
5. THE MapScreen SHALL combine all active people filters (favorites, tags, and text search) using AND logic such that a contact must satisfy every active filter to be displayed
6. WHEN the user taps "Clear Filters", THE MapScreen SHALL reset the text search input to empty, deactivate the favorites-only toggle, deselect all tag filter chips, and re-render the unfiltered contact markers on the map
7. IF the "All People" toggle is enabled, THEN THE MapScreen SHALL bypass all people filters and display every contact with a geocodable address regardless of favorites, tags, or text search state

### Requirement 6: Focus Address Handling (W768)

**User Story:** As a user, I want the map to properly handle focus navigation by switching modes, overriding the time period, and showing a temporary highlight marker, so that I can reliably find and see a focused location.

#### Acceptance Criteria

1. WHEN the MapScreen receives a focus address via query parameters (focus and address) with focusType "contact", THE MapScreen SHALL switch to People display mode
2. WHEN the MapScreen receives a focus address via query parameters (focus and address) with focusType other than "contact", THE MapScreen SHALL switch to Chits display mode
3. WHEN the MapScreen is in focus mode, THE MapScreen SHALL override the time period filter to "All Time" and reset the period offset to 0 to ensure the focused item is visible regardless of its date
4. WHEN the MapScreen geocodes a focus address successfully, THE MapScreen SHALL center the map at zoom level 15 and display a temporary Highlight_Marker as a circle marker at the geocoded coordinates with a popup displaying the address text
5. THE Highlight_Marker SHALL automatically remove itself after 8 seconds
6. WHILE the MapScreen is in focus mode, THE MapScreen SHALL prevent auto-zoom (fitBounds) from overriding the centered view by skipping bounds recalculation when markers are loaded
7. IF the MapScreen fails to geocode the focus address, THEN THE MapScreen SHALL fall back to normal mode behavior without displaying a Highlight_Marker or centering the map

### Requirement 7: Progressive Fallback Geocoding (W773)

**User Story:** As a user, I want geocoding to try multiple address variants when the initial attempt fails, so that more addresses resolve successfully.

#### Acceptance Criteria

1. WHEN the initial geocoding attempt for an address returns zero results from the geocode API, THE GeocodingUtil SHALL attempt Progressive_Fallback_Geocoding by generating and trying address variants in the following order: (a) address with trailing zip code stripped, (b) address with period-space sequences normalized to comma-space, (c) all parts after the first comma from the normalized form, (d) last two comma-separated parts from the normalized form, (e) city and state extracted via state-abbreviation pattern with zip, (f) city and state without zip
2. THE GeocodingUtil SHALL try each variant sequentially in the defined order until one returns at least one result or all variants have been attempted, up to a maximum of 7 unique variants per address
3. WHEN a variant succeeds, THE GeocodingUtil SHALL cache the result (latitude, longitude, and country code) in localStorage under the original address as the cache key (lowercased and trimmed) and return the coordinates
4. IF all generated variants return zero results or fail with network errors, THEN THE GeocodingUtil SHALL throw an error indicating the location was not found
5. THE GeocodingUtil SHALL deduplicate generated variants using case-insensitive trimmed comparison before attempting them, preserving the original generation order

### Requirement 8: Weather to Calendar Navigation (W165-167)

**User Story:** As a user, I want to tap a weather day block to navigate to the Calendar Day view for that date, so that I can quickly see my schedule for a day with notable weather.

#### Acceptance Criteria

1. WHEN the user taps a weather day block on the WeatherScreen, THE WeatherScreen SHALL navigate to the Calendar Day view for the tapped date, passing both the selected date (in YYYY-MM-DD format) and the associated location name as navigation parameters
2. WHEN the Calendar Day view receives the weather navigation parameters, THE Calendar SHALL display the Day view for the specified date and visually highlight any chits whose location matches the passed location name
3. IF a weather day block does not have a valid date attribute, THEN THE WeatherScreen SHALL not perform navigation

### Requirement 9: Extreme Weather Highlighting (W253)

**User Story:** As a user, I want extreme weather conditions to be visually highlighted on the weather forecast, so that I can quickly identify days with severe weather.

#### Acceptance Criteria

1. WHEN a forecast day has a high temperature at or above 35°C, THE WeatherScreen SHALL apply a visually distinct highlight to that day block, producing a border color intensity distinguishable from non-extreme day blocks
2. WHEN a forecast day has a low temperature at or below -18°C, THE WeatherScreen SHALL apply a visually distinct highlight to that day block, producing a border color intensity distinguishable from non-extreme day blocks
3. WHEN a forecast day has a WMO weather code of 95, 96, or 99 (thunderstorm codes), THE WeatherScreen SHALL apply a visually distinct highlight to that day block, producing a border color intensity distinguishable from non-extreme day blocks
4. IF a forecast day meets more than one extreme condition simultaneously, THEN THE WeatherScreen SHALL apply a single extreme highlight (no stacking or duplication of the visual indicator)

### Requirement 10: Weather Day Block Click Handlers (W254)

**User Story:** As a user, I want weather day blocks to be tappable for navigation, so that I can interact with the forecast display.

#### Acceptance Criteria

1. THE WeatherScreen SHALL register a tap handler on each weather day block composable
2. WHEN a day block is tapped, THE WeatherScreen SHALL read the block's date (format YYYY-MM-DD) and location, and navigate to the Calendar Day view for that date (as specified in Requirement 8)
3. IF a tapped day block has no valid date, THEN THE WeatherScreen SHALL take no navigation action
4. THE WeatherScreen SHALL apply visual affordance (e.g., ripple effect) to each weather day block to indicate it is tappable

### Requirement 11: Weather Location Row Reordering (W255)

**User Story:** As a user, I want to drag-and-drop reorder weather location rows, so that I can prioritize which locations appear first in my forecast view.

#### Acceptance Criteria

1. THE WeatherScreen SHALL display a drag handle on each weather location row and allow reordering via touch long-press (500ms hold) followed by vertical movement
2. WHEN the user completes a drag-and-drop reorder, THE WeatherScreen SHALL persist the new row order immediately
3. WHEN the WeatherScreen is next displayed, THE WeatherScreen SHALL display location rows in the persisted order, with any newly added locations not present in the saved order appended at the end
4. WHILE a drag operation is in progress, THE WeatherScreen SHALL provide visual feedback by reducing the dragged row's opacity and highlighting the current drop target row

### Requirement 12: Weather Modal Custom Location Input (W791)

**User Story:** As a user, I want to type an arbitrary location in the weather modal to check weather for any address, so that I am not limited to only my saved locations.

#### Acceptance Criteria

1. THE WeatherModal SHALL include a "Type a location" option as the last entry in the location selector dropdown, below all saved locations
2. WHEN the user selects the "Type a location" option, THE WeatherModal SHALL display a text input field with placeholder text and a "Go" button, and focus the text input field
3. WHEN the user enters a non-empty address and taps "Go", THE WeatherModal SHALL display a loading indicator, geocode the entered address, and display the weather results for that location
4. IF the user taps "Go" while the text input is empty or contains only whitespace, THEN THE WeatherModal SHALL take no action
5. IF the entered address cannot be geocoded, THEN THE WeatherModal SHALL display an error message indicating the location could not be found, including the entered address text
6. IF the geocoding or weather service is unreachable, THEN THE WeatherModal SHALL display an error message indicating the service could not be reached

### Requirement 13: Temperature Bar Visualization (W921)

**User Story:** As a user, I want to see colored gradient temperature bars showing the day's temperature range, so that I can quickly understand relative temperatures at a glance.

#### Acceptance Criteria

1. THE WeatherScreen SHALL display a Temperature_Bar for each forecast day showing the day's low-to-high temperature range within the overall bar scale
2. THE Temperature_Bar SHALL use a color gradient from blue (cold) through green, yellow, orange to red (hot), with color stops evenly distributed across the bar's temperature range
3. THE Temperature_Bar SHALL render the full gradient at reduced opacity and overlay the segment between the day's low and high temperatures at full opacity, so the active range is visually distinct from the inactive range
4. IF the unit system is metric, THEN THE Temperature_Bar SHALL use a scale of -10°C to 40°C
5. IF the unit system is imperial, THEN THE Temperature_Bar SHALL use a scale of 14°F to 104°F
6. IF a day's low or high temperature falls outside the bar's scale bounds, THEN THE Temperature_Bar SHALL clamp the highlighted segment to the nearest edge of the bar
