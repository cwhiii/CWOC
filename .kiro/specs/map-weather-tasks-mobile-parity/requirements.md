# Requirements Document

## Introduction

This spec ensures pixel-perfect functional parity between the CWOC mobile web browser experience (≤768px viewport) and the Android app for three views: Map, Weather, and Tasks (all modes). The mobile web is the reference implementation. Any visible difference in layout, design, visuals, or behavior between the mobile web and the app constitutes a failure. Every interactive function available on mobile web must have a fully-implemented equivalent in the Android app.

## Glossary

- **App**: The Android native application (Kotlin/Compose under `android/`)
- **Mobile_Web**: The CWOC frontend rendered in a phone browser at ≤768px width
- **MapScreen**: The Android Compose screen displaying map markers via osmdroid
- **WeatherScreen**: The Android Compose screen displaying weather forecasts
- **TasksScreen**: The Android Compose screen displaying task list, habits, assigned, and timeline modes
- **PeopleFilterPanel**: The Android Compose composable for filtering contacts on the map
- **MarkerCluster**: A visual grouping of multiple nearby markers into a single aggregate icon
- **Timeline_View**: The visual dependency graph mode for tasks showing nodes connected by SVG lines
- **Period_Filter**: A dropdown/chip selector that constrains visible data to a date range
- **Chit**: A single flexible record in CWOC (task, note, event, alarm, checklist, or project)
- **Saved_Location**: A user-configured location stored in settings with label, address, and coordinates

## Requirements

### Requirement 1: People Filter Panel Integration in MapScreen

**User Story:** As a user, I want to filter contacts on the map by text search, favorites-only toggle, and tag chips, so that I can find specific people without scrolling through all markers.

#### Acceptance Criteria

1. WHILE the MapScreen is in People or Both mode, THE App SHALL display the PeopleFilterPanel composable above the map content.
2. WHEN the user types in the PeopleFilterPanel text search field, THE App SHALL filter visible contact markers to only those whose display name contains the search text (case-insensitive, 300ms debounce).
3. WHEN the user activates the favorites-only toggle, THE App SHALL filter visible contact markers to only those marked as favorites.
4. WHEN the user selects one or more tag chips, THE App SHALL filter visible contact markers to only those contacts having at least one of the selected tags.
5. WHEN the "All People" checkbox is unchecked, THE App SHALL apply the PeopleFilterPanel filters (text, favorites, tags) to determine which contacts are visible.
6. WHEN the "All People" checkbox is checked, THE App SHALL show all contacts regardless of PeopleFilterPanel filter state, matching the Mobile_Web behavior.

---

### Requirement 2: Marker Popups with Rich Content

**User Story:** As a user, I want to see detailed information about a marker when I tap it, so that I can decide whether to open the full editor without navigating away from the map.

#### Acceptance Criteria

1. WHEN the user taps a chit marker, THE App SHALL display a popup overlay containing the chit title, date (formatted), status icon, indicator badges, and an "Open in Editor" action button.
2. WHEN the user taps a contact marker, THE App SHALL display a popup overlay containing the contact display name, address, and an "Open Contact" action button.
3. WHEN the user taps the "Open in Editor" button in a chit popup, THE App SHALL navigate to the editor screen for that chit.
4. WHEN the user taps the "Open Contact" button in a contact popup, THE App SHALL navigate to the contact editor screen for that contact.
5. WHEN the user taps outside an open popup, THE App SHALL dismiss the popup without navigating.
6. THE App SHALL style marker popups to match the Mobile_Web popup appearance (title, date, status icon, indicators, action link).

---

### Requirement 3: Marker Clustering

**User Story:** As a user, I want nearby markers to cluster together at low zoom levels, so that the map remains readable when many markers are in close proximity.

#### Acceptance Criteria

1. WHEN multiple markers are within a proximity threshold at the current zoom level, THE App SHALL group them into a single cluster marker displaying the count of contained markers.
2. WHEN the user taps a cluster marker, THE App SHALL zoom the map to reveal the individual markers within that cluster.
3. WHILE in Chits mode, THE App SHALL render cluster icons using a rounded-square shape.
4. WHILE in People mode, THE App SHALL render cluster icons using a circle shape.
5. WHILE in Both mode, THE App SHALL render mixed clusters (containing both chits and contacts) using a distinct combined shape.
6. THE App SHALL match the Mobile_Web cluster icon shapes and color scheme for each cluster type.

---

### Requirement 4: Custom Marker Visual Styling

**User Story:** As a user, I want chit markers to display as colored rounded squares and contact markers as colored circles, so that I can visually distinguish marker types at a glance.

#### Acceptance Criteria

1. THE App SHALL render chit markers as colored rounded-square icons using the chit's own color property (or status-based color if no custom color is set).
2. THE App SHALL render contact markers as colored circle icons using the contact's color property (or default blue if no color is set).
3. THE App SHALL render saved location markers as gold-colored star icons matching the Mobile_Web appearance.
4. THE App SHALL size markers consistently with the Mobile_Web marker dimensions at equivalent zoom levels.
5. WHEN a chit is overdue, THE App SHALL apply a visual overdue indicator to its marker matching the Mobile_Web overdue marker styling.

---

### Requirement 5: Complete Period Filter Options for Map

**User Story:** As a user, I want all the same time period filter options available on mobile web, so that I can filter map markers by any date range.

#### Acceptance Criteria

1. THE App SHALL provide the following period filter options: Next Hour, Today, Day, Week, Next X Days, Month, Quarter, Year, All Time.
2. WHEN the user selects "Next Hour," THE App SHALL filter chit markers to only those with dates falling within the current hour.
3. WHEN the user selects "Day," THE App SHALL filter chit markers to only those with dates on the offset day, and SHALL support prev/next navigation to adjacent days.
4. WHEN the user selects "Next X Days," THE App SHALL filter chit markers to those within the user's configured custom days count (from settings).
5. WHEN the user selects "Quarter," THE App SHALL filter chit markers to those within the current calendar quarter, and SHALL support prev/next navigation.
6. THE App SHALL display the current date range label matching the Mobile_Web format for each period selection.

---

### Requirement 6: Tag Filter UI for Map Chits

**User Story:** As a user, I want to filter map chit markers by tags, so that I can see only chits with specific tags on the map.

#### Acceptance Criteria

1. WHILE the MapScreen is in Chits or Both mode, THE App SHALL display a tag filter section with selectable tag chips.
2. THE App SHALL populate the tag filter chips from the user's configured tags (fetched from settings).
3. WHEN the user selects one or more tag chips, THE App SHALL filter visible chit markers to only those having at least one of the selected tags.
4. WHEN the user deselects all tag chips, THE App SHALL show all chit markers (subject to other active filters).
5. THE App SHALL visually indicate which tag chips are currently selected using the same highlight style as other filter chips.

---

### Requirement 7: People Filter UI for Map Chits

**User Story:** As a user, I want to filter map chit markers by associated people, so that I can see only chits involving specific contacts.

#### Acceptance Criteria

1. WHILE the MapScreen is in Chits or Both mode, THE App SHALL display a people filter section with selectable people chips.
2. THE App SHALL populate the people filter chips from the user's contacts and system users.
3. WHEN the user selects one or more people chips, THE App SHALL filter visible chit markers to only those having at least one of the selected people in their people field.
4. WHEN the user deselects all people chips, THE App SHALL show all chit markers (subject to other active filters).

---

### Requirement 8: Default View / Home Button for Map

**User Story:** As a user, I want a button to reset the map to its default view (configured center and zoom), so that I can quickly return to my home location after panning.

#### Acceptance Criteria

1. THE App SHALL display a "Home" or "Reset View" button on the MapScreen.
2. WHEN the user taps the Home button, THE App SHALL animate the map to the user's configured default latitude, longitude, and zoom level (from settings).
3. THE App SHALL position the Home button consistently with the Mobile_Web's default view control placement.

---

### Requirement 9: Marker Tooltips

**User Story:** As a user, I want to see marker titles as permanent labels above markers, so that I can identify markers without tapping each one.

#### Acceptance Criteria

1. THE App SHALL display a permanent title tooltip label above each marker showing the chit title or contact name.
2. WHEN a marker popup is opened, THE App SHALL hide the tooltip for that marker to avoid visual overlap.
3. WHEN the marker popup is closed, THE App SHALL restore the tooltip visibility.
4. THE App SHALL style tooltips to match the Mobile_Web tooltip appearance (font, size, background, positioning).

---

### Requirement 10: Focus Mode with Highlight Marker

**User Story:** As a user, I want the map to auto-zoom and highlight a specific location when navigating from another screen with a focus address, so that I can immediately see the relevant marker.

#### Acceptance Criteria

1. WHEN the MapScreen receives a focus address via navigation arguments, THE App SHALL geocode the address and animate the map to center on it at zoom level 14.
2. WHEN in focus mode, THE App SHALL display a distinct highlight marker at the focused location that visually differs from standard markers (matching Mobile_Web's highlight marker style).
3. WHEN in focus mode, THE App SHALL skip auto-zoom-to-fit-all-markers behavior and maintain focus on the target location.

---

### Requirement 11: Weather Horizontal Table Layout

**User Story:** As a user, I want the weather view to display as a horizontal scrollable table with dates as columns and locations as rows, so that the app matches the mobile web layout exactly.

#### Acceptance Criteria

1. THE App SHALL render the weather forecast as a horizontal scrollable table with date columns and location rows, matching the Mobile_Web layout.
2. THE App SHALL display date column headers showing day-of-week abbreviation and month/day label.
3. THE App SHALL display location row headers showing the location label, address, and a drag handle for reordering.
4. EACH day block SHALL display the weather icon, high/low temperatures, and precipitation amount.
5. THE App SHALL highlight today's column with distinct styling matching the Mobile_Web "today" class.
6. THE App SHALL support horizontal scrolling to view all 16 forecast days.

---

### Requirement 12: Weather Period/Date Filtering

**User Story:** As a user, I want to filter which forecast days are visible by selecting a time period, so that I can focus on the relevant date range.

#### Acceptance Criteria

1. THE App SHALL provide a period filter with options: 1 Hour, Day, Work Hours, Week, X Days, Month, Year, Forecast Max (16 day).
2. WHEN the user selects a period, THE App SHALL show only the day columns falling within that period's date range.
3. WHEN the user navigates prev/next within a period, THE App SHALL shift the visible date range by one period unit and update the date range label.
4. WHEN the user selects "Forecast Max," THE App SHALL show all available forecast days (up to 16).
5. THE App SHALL display the current period's date range label matching the Mobile_Web format.

---

### Requirement 13: Weather Chit Event Highlighting

**User Story:** As a user, I want forecast days that have chits at a location to be visually highlighted, so that I can see weather conditions for days I have events planned.

#### Acceptance Criteria

1. WHEN a forecast day has one or more chits at the corresponding location, THE App SHALL apply a "has-event" visual indicator to that day block (matching Mobile_Web's yellow dot/border styling).
2. THE App SHALL match chit locations to saved locations using case-insensitive comparison of address and label fields.
3. THE App SHALL consider chit start_datetime, end_datetime, and due_datetime fields when determining which dates have events.
4. WHEN a chit spans multiple days (start to end), THE App SHALL highlight all days in that range.

---

### Requirement 14: Weather City Rows for Non-Saved Locations

**User Story:** As a user, I want the weather view to show additional rows for cities where I have chits but haven't saved as locations, so that I can see weather for all my event locations.

#### Acceptance Criteria

1. WHEN chits exist with locations that do not match any saved location, THE App SHALL add additional city rows to the weather table for those locations.
2. THE App SHALL geocode non-saved chit locations and fetch their weather forecasts.
3. THE App SHALL visually distinguish city rows from saved location rows (matching Mobile_Web's `.weather-city-row` styling).
4. THE App SHALL display city rows below the saved location rows.

---

### Requirement 15: Weather Drag-to-Reorder Location Rows

**User Story:** As a user, I want to drag location rows to reorder them, so that I can arrange my weather locations in my preferred order.

#### Acceptance Criteria

1. THE App SHALL display a drag handle on each location row header.
2. WHEN the user long-presses and drags a location row, THE App SHALL allow reordering by moving the row to the drop position.
3. WHEN the user completes a reorder, THE App SHALL persist the new row order so it survives app restarts.
4. THE App SHALL apply the saved row order when rendering the weather table on subsequent visits.

---

### Requirement 16: Weather Day Block Click Navigation

**User Story:** As a user, I want to tap a day block to navigate to that day's dashboard view, so that I can quickly see my schedule for a specific forecast day.

#### Acceptance Criteria

1. WHEN the user taps a weather day block, THE App SHALL navigate to the dashboard/calendar view for that specific date.
2. THE App SHALL pass the tapped date as a navigation parameter so the destination view shows that day.

---

### Requirement 17: Weather Week Separator Lines

**User Story:** As a user, I want vertical lines at week boundaries in the weather table, so that I can visually distinguish week groupings.

#### Acceptance Criteria

1. THE App SHALL draw a vertical separator line before each day block that falls on the user's configured week start day (excluding the first day block).
2. THE App SHALL style the week separator to match the Mobile_Web's week boundary line appearance.

---

### Requirement 18: Weather Temperature Unit Conversion

**User Story:** As a user, I want temperatures displayed in my preferred unit (°F or °C), so that the weather data is meaningful to me.

#### Acceptance Criteria

1. THE App SHALL read the user's temperature unit preference from settings.
2. WHEN the unit preference is Fahrenheit, THE App SHALL convert all temperatures from Celsius (API source) to Fahrenheit before display.
3. WHEN the unit preference is Celsius, THE App SHALL display temperatures in Celsius as received from the API.
4. THE App SHALL format temperatures as integers followed by the degree symbol (e.g., "72°" or "22°").

---

### Requirement 19: Weather Precipitation Formatting

**User Story:** As a user, I want precipitation displayed with snow/rain distinction and proper unit formatting, so that I can understand the forecast conditions.

#### Acceptance Criteria

1. WHEN the weather code indicates snow (codes 71, 73, 75, 77, 85, 86), THE App SHALL display precipitation with a snow icon (❄️) and format as snow accumulation.
2. WHEN the weather code indicates rain, THE App SHALL display precipitation with a rain icon (💧) and format as rainfall.
3. WHEN precipitation is zero, THE App SHALL display an em-dash (—) instead of "0 mm."
4. THE App SHALL respect the user's unit system preference for precipitation display (mm vs inches).

---

### Requirement 20: Weather Temperature-Based Border Colors

**User Story:** As a user, I want day block borders colored based on temperature (gradient from low to high), so that I can visually scan temperature trends across the forecast.

#### Acceptance Criteria

1. THE App SHALL apply a gradient border to each day block where the bottom color represents the low temperature and the top color represents the high temperature.
2. THE App SHALL use the same temperature-to-color mapping function as the Mobile_Web (`_getTempBorderColor`).
3. THE App SHALL render the gradient using `border-image: linear-gradient(to top, lowColor, highColor)` equivalent styling.

---

### Requirement 21: Weather Extreme Conditions Highlighting

**User Story:** As a user, I want extreme weather conditions visually highlighted, so that I can quickly identify days requiring attention.

#### Acceptance Criteria

1. WHEN a day's weather conditions meet the extreme threshold (matching Mobile_Web's `_wxIsExtreme` logic), THE App SHALL apply an "extreme" visual indicator to that day block.
2. THE App SHALL style the extreme indicator to match the Mobile_Web's `wx-extreme` class appearance.

---

### Requirement 22: Timeline View Mode for Tasks

**User Story:** As a user, I want a visual dependency graph (Timeline mode) for tasks showing nodes connected by lines, so that I can visualize task dependencies and scheduling.

#### Acceptance Criteria

1. THE App SHALL provide a Timeline mode button in the tasks view mode selector alongside List, Habits, and Assigned.
2. WHEN the user selects Timeline mode, THE App SHALL render task nodes positioned in two lanes: dated tasks (positioned by date) and undated tasks.
3. THE App SHALL draw SVG/Canvas dependency lines connecting prerequisite tasks to their dependent tasks.
4. THE App SHALL color each task node using the chit's custom color property, with status-based border styling.
5. THE App SHALL apply grey-out styling (grayscale + reduced opacity) to completed task nodes when the "Grey out completed" toggle is active.
6. THE App SHALL persist the Timeline mode selection so it is restored on next visit.

---

### Requirement 23: Timeline Zoom and Pan

**User Story:** As a user, I want to zoom and pan the timeline view, so that I can navigate large dependency graphs.

#### Acceptance Criteria

1. WHEN the user pinch-zooms on the timeline, THE App SHALL scale the canvas between 0.25x and 3.0x zoom levels.
2. WHEN the user drags on the timeline canvas (not on a node), THE App SHALL pan the viewport.
3. THE App SHALL display zoom control buttons (zoom in, zoom out, recenter) matching the Mobile_Web's bottom-right zoom controls.
4. WHEN the user taps the recenter button, THE App SHALL reset zoom to 1.0x and scroll to show all nodes.

---

### Requirement 24: Timeline Hover/Focus Highlighting

**User Story:** As a user, I want tapping a node to highlight it and all connected nodes/lines, so that I can trace dependency chains.

#### Acceptance Criteria

1. WHEN the user taps a timeline node, THE App SHALL highlight that node and all nodes directly connected to it (prerequisites and dependents).
2. WHEN a node is highlighted, THE App SHALL also highlight all dependency lines connected to that node.
3. WHEN the user taps on empty canvas space, THE App SHALL clear all highlighting.
4. THE App SHALL style highlighted nodes and lines to match the Mobile_Web's highlight appearance (increased opacity, distinct border).

---

### Requirement 25: Timeline Drag-to-Link Dependencies

**User Story:** As a user, I want to drag from one node to another to create a dependency link, so that I can build dependency relationships visually.

#### Acceptance Criteria

1. WHEN the user long-presses and drags from one timeline node to another, THE App SHALL create a dependency relationship (source becomes prerequisite of target).
2. WHILE dragging, THE App SHALL display a visual line from the source node to the current touch position.
3. WHEN the drag ends on a valid target node, THE App SHALL save the new dependency and re-render the timeline with the new line.
4. WHEN the drag ends on empty space (not a node), THE App SHALL cancel the operation without creating a dependency.
5. IF creating the dependency would create a circular reference, THEN THE App SHALL reject the operation and display an error toast.

---

### Requirement 26: Timeline Context Menu

**User Story:** As a user, I want a context menu on timeline nodes with options to add/remove dependencies and open the editor, so that I can manage dependencies without leaving the timeline.

#### Acceptance Criteria

1. WHEN the user long-presses a timeline node (without dragging), THE App SHALL display a context menu with options: "Add Dependency," "Remove Dependency," "Open in Editor."
2. WHEN the user selects "Add Dependency," THE App SHALL enter Link Mode where the next tapped node becomes the dependent.
3. WHEN the user selects "Remove Dependency," THE App SHALL display a list of current dependencies for that node and allow removal.
4. WHEN the user selects "Open in Editor," THE App SHALL navigate to the chit editor for that node's chit.

---

### Requirement 27: Timeline Link Mode

**User Story:** As a user, I want a Link Mode where I tap source then target to create dependencies, so that I have an alternative to drag-to-link for precise connections.

#### Acceptance Criteria

1. THE App SHALL provide a "Link Mode" toggle button in the timeline controls.
2. WHEN Link Mode is active, THE App SHALL visually indicate the active state (button highlighted, cursor/touch feedback changed).
3. WHEN the user taps a node in Link Mode, THE App SHALL record it as the source and visually highlight it.
4. WHEN the user taps a second node in Link Mode, THE App SHALL create a dependency (first tap = prerequisite, second tap = dependent) and exit Link Mode.
5. WHEN the user presses back or taps the Link Mode button again, THE App SHALL cancel Link Mode without creating a dependency.

---

### Requirement 28: Timeline Order Toggle

**User Story:** As a user, I want to switch between "By Date" and "By Dependency" layout modes, so that I can view the timeline organized by either time or dependency depth.

#### Acceptance Criteria

1. THE App SHALL provide a "By Date" / "By Dependency" toggle in the timeline controls.
2. WHEN "By Date" is selected, THE App SHALL position nodes horizontally by their effective date, with dated and undated lanes visible.
3. WHEN "By Dependency" is selected, THE App SHALL position nodes by dependency depth (prerequisites left, dependents right) in a single lane.
4. WHEN the order mode changes, THE App SHALL re-render the timeline layout and dependency lines.

---

### Requirement 29: Timeline Critical Path Highlighting

**User Story:** As a user, I want to highlight the critical path (longest dependency chain), so that I can identify bottleneck tasks.

#### Acceptance Criteria

1. THE App SHALL provide a "Critical Path" toggle button in the timeline controls.
2. WHEN the user activates Critical Path mode, THE App SHALL compute the longest dependency chain and highlight all nodes and lines on that path.
3. THE App SHALL style critical path nodes and lines distinctly from regular highlighting (matching Mobile_Web's critical path appearance).
4. WHEN the user deactivates Critical Path mode, THE App SHALL remove the critical path highlighting.

---

### Requirement 30: Timeline Undo/Redo for Dependency Changes

**User Story:** As a user, I want to undo and redo dependency changes made in the timeline, so that I can recover from mistakes.

#### Acceptance Criteria

1. WHEN the user creates or removes a dependency in the timeline, THE App SHALL push the change onto an undo stack.
2. WHEN the user triggers undo (via button or gesture), THE App SHALL reverse the last dependency change and push it onto the redo stack.
3. WHEN the user triggers redo, THE App SHALL re-apply the last undone change.
4. THE App SHALL provide visible undo/redo controls in the timeline interface.

---

### Requirement 31: Timeline Double-Tap to Open Editor

**User Story:** As a user, I want to double-tap a timeline node to open its editor, so that I can quickly edit a task from the timeline.

#### Acceptance Criteria

1. WHEN the user double-taps a timeline node, THE App SHALL navigate to the chit editor for that node's chit.
2. THE App SHALL distinguish double-tap from single-tap (highlight) and long-press (context menu/drag) gestures.

---

### Requirement 32: Tasks View Mode Selector with Timeline

**User Story:** As a user, I want four mode buttons in the tasks sidebar (Timeline, List, Assigned, Habits), so that the app matches the mobile web's task mode options.

#### Acceptance Criteria

1. THE App SHALL display four task view mode buttons: 🔗 Timeline, 📋 List, 📌 Assigned, 🎯 Habits.
2. THE App SHALL persist the selected mode to local storage and restore it on next visit.
3. WHEN the user selects a mode, THE App SHALL immediately switch the tasks content to the corresponding view.
4. THE App SHALL default to Timeline mode for new users (matching Mobile_Web's default `_tasksViewMode = 'timeline'`).
