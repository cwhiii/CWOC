# Implementation Plan: Map, Weather & Tasks Mobile Parity

## Overview

This plan implements pixel-perfect functional parity between the CWOC mobile web and the Android app for three views: Map (people filter wiring, marker clustering, custom markers, popups, tooltips, period/tag/people filters, home button, focus mode), Weather (complete rewrite to horizontal scrollable table), and Timeline (entirely new dependency graph view). All implementation is in Kotlin/Jetpack Compose, extending existing ViewModels and screens.

## Tasks

- [x] 1. Map Enhancements — Filters, Markers & Interactions
  - [x] 1.1 Wire PeopleFilterPanel callbacks to MapViewModel marker filtering
    - In `MapScreen.kt`, display `PeopleFilterPanel` when `mapMode` is PEOPLE or BOTH
    - Connect `onSearchTextChanged`, `onFavoritesToggled`, `onTagToggled` callbacks to `MapViewModel` methods
    - In `MapViewModel.kt`, add `peopleSearchText`, `peopleFavoritesOnly`, `peopleSelectedTags` StateFlows
    - Filter contact markers in `updateVisibleMarkers()` using these people filter states
    - When "All People" checkbox is checked, bypass people filter panel filters
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [x] 1.2 Add missing MapPeriod enum values and period filter logic
    - Add `NEXT_HOUR`, `DAY`, `NEXT_X_DAYS`, `QUARTER` to `MapPeriod` enum in `MapViewModel.kt`
    - Implement date range computation for each new period type in `applyChitFilters()`
    - For `NEXT_X_DAYS`, read the custom days count from settings
    - Update `updatePeriodLabel()` to format labels for all new period types
    - Update `MapFilters` composable to display all period options
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [x] 1.3 Implement tag filter UI for map chits
    - In `MapScreen.kt`, add a tag filter chip row below the period/status filters (visible in Chits or Both mode)
    - Fetch available tags from settings repository in `MapViewModel`
    - Wire tag chip selection to `MapViewModel.toggleTagFilter()` (already exists)
    - Ensure `applyChitFilters()` applies tag filtering (already partially implemented — verify completeness)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 1.4 Implement people filter UI for map chits
    - In `MapScreen.kt`, add a people filter chip row (visible in Chits or Both mode)
    - Fetch available people from contacts and system users in `MapViewModel`
    - Wire people chip selection to `MapViewModel.togglePeopleFilter()` (already exists)
    - Ensure `applyChitFilters()` applies people filtering (already partially implemented — verify completeness)
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [x] 1.5 Implement custom marker visual styling with osmdroid
    - Create a custom `MarkerRenderer` that draws chit markers as colored rounded-square icons
    - Draw contact markers as colored circle icons using the contact's color property
    - Draw saved location markers as gold star icons
    - Apply overdue visual indicator (red border/glow) to overdue chit markers
    - Size markers consistently with Mobile_Web dimensions
    - Replace the current plain `Marker` creation in `MapScreen.kt` `update` block with styled markers
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 1.6 Implement marker clustering with RadiusMarkerClusterer
    - Add osmdroid's `RadiusMarkerClusterer` overlay to the map in `MapScreen.kt`
    - Configure cluster icons: rounded-square shape for chit clusters, circle for people clusters, combined shape for mixed clusters
    - On cluster tap, zoom the map to reveal individual markers
    - Match Mobile_Web cluster icon colors and shapes
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 1.7 Implement marker popups with rich content
    - Create `MarkerPopupOverlay` composable that displays over the map when a marker is tapped
    - For chit markers: show title, formatted date, status icon, indicator badges, "Open in Editor" button
    - For contact markers: show display name, address, "Open Contact" button
    - Dismiss popup on tap outside
    - Style popup to match Mobile_Web appearance
    - Replace current direct-navigation-on-tap with popup display first
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 1.8 Implement marker tooltips (permanent title labels)
    - Configure osmdroid markers with permanent title labels using custom `InfoWindow`
    - Show chit title or contact name as a small label above each marker
    - Hide tooltip when popup is open for that marker; restore on popup close
    - Style tooltips to match Mobile_Web appearance (font, size, background)
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [x] 1.9 Implement Home/Reset View button
    - Add a "Home" FAB or icon button to `MapScreen.kt`
    - On tap, animate map to user's configured default lat/lon/zoom from settings
    - Position consistently with Mobile_Web's default view control placement
    - _Requirements: 8.1, 8.2, 8.3_

  - [x] 1.10 Implement focus mode with highlight marker
    - When `MapScreen` receives a focus address via navigation arguments, geocode it and animate to zoom 14
    - Display a distinct highlight marker at the focused location (different from standard markers)
    - Skip auto-zoom-to-fit-all behavior when in focus mode
    - _Requirements: 10.1, 10.2, 10.3_

- [x] 2. Checkpoint — Map enhancements complete
  - Ensure all map features work correctly, ask the user if questions arise.

- [x] 3. Weather — Complete Rewrite to Horizontal Table
  - [x] 3.1 Create WeatherUtils object with pure conversion/formatting functions
    - Create `WeatherUtils.kt` in the weather package
    - Implement `convertTemp(celsius, toFahrenheit)` returning formatted Int
    - Implement `getTempBorderColor(celsius)` returning Color with temperature-to-color gradient mapping
    - Implement `isExtreme(highC, lowC, weatherCode)` matching web's `_wxIsExtreme` logic
    - Implement `formatPrecip(precip, weatherCode, unit)` with snow/rain icon distinction and em-dash for zero
    - Implement `isWeekStart(dateStr, weekStartDay)` for week boundary detection
    - Implement `computePeriodRange(period, offset, customDays)` returning start/end LocalDate pair
    - Implement `buildLocDateMap(chits, locations)` for event-location matching
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 19.1, 19.2, 19.3, 19.4, 20.1, 20.2, 21.1, 21.2, 17.1, 17.2, 13.1, 13.2, 13.3, 13.4_

  - [x] 3.2 Extend WeatherViewModel with period, settings, and chit state
    - Add `WeatherPeriod` enum with all options (1 Hour, Day, Work Hours, Week, X Days, Month, Year, Forecast Max)
    - Add `period: MutableStateFlow<WeatherPeriod>` and `periodOffset: MutableStateFlow<Int>`
    - Add `tempUnit: StateFlow<String>` and `precipUnit: StateFlow<String>` from settings
    - Add `weekStartDay: StateFlow<Int>` from settings
    - Add `rowOrder: MutableStateFlow<List<String>>` persisted to SharedPreferences
    - Add `chits: StateFlow<List<ChitEntity>>` for event highlighting (observe from ChitRepository)
    - Add methods: `setPeriod()`, `nextPeriod()`, `prevPeriod()`, `reorderRows()`, `saveRowOrder()`
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 15.3, 15.4_

  - [x] 3.3 Implement WeatherDayBlock composable
    - Create `WeatherDayBlock.kt` composable showing weather icon, high/low temps, precipitation
    - Apply temperature-based gradient border (bottom=low color, top=high color) using `WeatherUtils.getTempBorderColor()`
    - Apply "today" highlight styling when `isToday` is true
    - Apply "has-event" indicator (yellow dot/border) when `hasEvent` is true
    - Apply "extreme" visual indicator when `isExtreme` is true
    - Draw week separator line on left edge when `isWeekStart` is true
    - Handle tap to invoke `onDayClick` callback
    - Format temps using `WeatherUtils.convertTemp()` with user's unit preference
    - Format precip using `WeatherUtils.formatPrecip()` with snow/rain distinction
    - _Requirements: 11.4, 16.1, 17.1, 18.4, 19.1, 19.2, 19.3, 20.1, 20.2, 20.3, 21.1_

  - [x] 3.4 Implement WeatherHorizontalTable composable
    - Create `WeatherHorizontalTable.kt` with horizontally scrollable Row layout
    - Render date column headers (day-of-week abbreviation + month/day)
    - Render location row headers with label, address, and drag handle
    - For each location row, render `WeatherDayBlock` for each visible day
    - Filter visible days based on current period and offset using `WeatherUtils.computePeriodRange()`
    - Highlight today's column with distinct styling
    - Support horizontal scrolling for all 16 forecast days
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 12.2, 12.4_

  - [x] 3.5 Implement drag-to-reorder for weather location rows
    - Add long-press drag gesture to location row headers
    - On drag, allow reordering by moving the row to the drop position
    - On reorder complete, call `WeatherViewModel.reorderRows()` to persist new order
    - Apply saved row order when rendering the table
    - _Requirements: 15.1, 15.2, 15.3, 15.4_

  - [x] 3.6 Implement city rows for non-saved locations
    - In `WeatherViewModel`, identify chit locations that don't match any saved location
    - Geocode non-saved locations and fetch their weather forecasts
    - Add city rows below saved location rows with distinct styling
    - _Requirements: 14.1, 14.2, 14.3, 14.4_

  - [x] 3.7 Implement day block click navigation
    - When user taps a `WeatherDayBlock`, navigate to the dashboard/calendar view for that date
    - Pass the tapped date as a navigation parameter
    - _Requirements: 16.1, 16.2_

  - [x] 3.8 Implement period filter UI and prev/next navigation
    - Add period filter chip row to the weather screen header
    - Wire chip selection to `WeatherViewModel.setPeriod()`
    - Add prev/next buttons that call `WeatherViewModel.prevPeriod()` / `nextPeriod()`
    - Display current period date range label
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

  - [x] 3.9 Implement chit event highlighting in weather table
    - Use `WeatherUtils.buildLocDateMap()` to compute which location/date pairs have events
    - Pass `hasEvent` flag to each `WeatherDayBlock`
    - Match chit locations to saved locations case-insensitively (label and address)
    - Consider start_datetime, end_datetime, due_datetime; expand multi-day ranges
    - _Requirements: 13.1, 13.2, 13.3, 13.4_

  - [x] 3.10 Rewrite WeatherScreen to use new horizontal table layout
    - Replace the current vertical `LazyColumn` of cards in `WeatherScreen.kt` with `WeatherHorizontalTable`
    - Wire all ViewModel state (forecasts, period, tempUnit, precipUnit, weekStartDay, rowOrder, chits) to the table
    - Maintain existing loading/error/empty states and pull-to-refresh
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

- [x] 4. Checkpoint — Weather rewrite complete
  - Ensure all weather features work correctly, ask the user if questions arise.

- [x] 5. Timeline View — New Dependency Graph
  - [x] 5.1 Create TimelineAlgorithms pure Kotlin object
    - Create `TimelineAlgorithms.kt` in the tasks package
    - Implement `buildGraph(chits)` returning `DependencyGraph` (forward + reverse adjacency maps)
    - Implement `computeDepths(chits)` returning depth map for dependency-based layout
    - Implement `wouldCycle(fromId, toId, graph)` using DFS/BFS reachability check
    - Implement `criticalPath(chits)` returning the longest dependency chain node set
    - Implement `layoutByDate(chits, canvasWidth)` positioning nodes by date with dated/undated lanes
    - Implement `layoutByDependency(chits, canvasWidth)` positioning by dependency depth
    - Implement `connectedNodes(nodeId, graph)` returning immediate neighbors (prereqs + dependents)
    - Define `DependencyGraph`, `NodePosition`, `DependencyChange`, `ChangeType`, `TimelineOrderMode` data classes
    - _Requirements: 22.3, 24.1, 25.5, 28.2, 28.3, 29.2_

  - [x] 5.2 Extend TasksViewModel with timeline state and dependency operations
    - Add `timelineZoom: MutableStateFlow<Float>` (range 0.25f to 3.0f, default 1.0f)
    - Add `timelineOffset: MutableStateFlow<Offset>` for pan position
    - Add `timelineOrderMode: MutableStateFlow<TimelineOrderMode>` (BY_DATE default)
    - Add `highlightedNodes: MutableStateFlow<Set<String>>` for tap highlighting
    - Add `linkMode: MutableStateFlow<Boolean>` and `linkSource: MutableStateFlow<String?>`
    - Add `criticalPathActive: MutableStateFlow<Boolean>`
    - Add `undoStack: MutableStateFlow<List<DependencyChange>>` and `redoStack`
    - Add `greyOutCompleted: MutableStateFlow<Boolean>`
    - Implement `addDependency(prereqId, dependentId)` with cycle check via `TimelineAlgorithms.wouldCycle()`
    - Implement `removeDependency(prereqId, dependentId)`
    - Implement `undo()` and `redo()` methods operating on the stacks
    - Implement `highlightNode(nodeId)` using `TimelineAlgorithms.connectedNodes()`
    - Implement `clearHighlight()`
    - Persist timeline order mode and grey-out toggle to SharedPreferences
    - _Requirements: 22.5, 23.1, 23.2, 24.1, 24.3, 25.1, 25.5, 27.1, 28.1, 29.1, 30.1, 30.2, 30.3_

  - [x] 5.3 Create TimelineNode composable
    - Create `TimelineNode.kt` composable rendering a single task node
    - Color node using chit's custom color property with status-based border
    - Apply grey-out styling (grayscale + reduced opacity) when completed and toggle active
    - Apply highlight styling (increased opacity, distinct border) when highlighted
    - Apply critical path styling when on critical path
    - Apply link-source indicator when node is selected as link source
    - Handle gesture disambiguation: single tap (highlight), double tap (open editor), long press (context menu or drag start)
    - Display chit title truncated within the node
    - _Requirements: 22.4, 22.5, 24.1, 24.4, 25.1, 29.3, 31.1, 31.2_

  - [x] 5.4 Create TimelineCanvas with zoom/pan and dependency lines
    - Create `TimelineCanvas.kt` composable wrapping content in `graphicsLayer` with scale/translation
    - Implement pinch-zoom via `detectTransformGestures` (range 0.25x to 3.0x)
    - Implement pan via `detectDragGestures` on empty canvas space
    - Draw dependency lines on Canvas connecting prerequisite nodes to dependent nodes
    - Highlight connected lines when a node is highlighted
    - Style critical path lines distinctly when critical path mode is active
    - Draw drag-to-link preview line from source node to current touch position during drag
    - _Requirements: 22.3, 23.1, 23.2, 24.2, 25.2, 29.3_

  - [x] 5.5 Create TimelineZoomControls composable
    - Create zoom in, zoom out, and recenter buttons positioned at bottom-right
    - Zoom in/out adjusts `timelineZoom` by 0.25 increments
    - Recenter resets zoom to 1.0x and scrolls to show all nodes
    - _Requirements: 23.3, 23.4_

  - [x] 5.6 Implement drag-to-link dependency creation
    - On long-press + drag from a node, start link creation mode
    - Display visual line from source node to current touch position
    - On drop on valid target node, call `TasksViewModel.addDependency()`
    - On drop on empty space, cancel without creating dependency
    - If cycle detected, show error toast "Cannot create circular dependency"
    - _Requirements: 25.1, 25.2, 25.3, 25.4, 25.5_

  - [x] 5.7 Implement timeline context menu
    - On long-press without drag, show context menu with: "Add Dependency", "Remove Dependency", "Open in Editor"
    - "Add Dependency" enters Link Mode (next tapped node becomes dependent)
    - "Remove Dependency" shows list of current dependencies for removal
    - "Open in Editor" navigates to chit editor
    - _Requirements: 26.1, 26.2, 26.3, 26.4_

  - [x] 5.8 Implement Link Mode toggle and interaction
    - Add "Link Mode" toggle button to timeline controls bar
    - When active, visually indicate state (button highlighted)
    - First tap records source node (highlight it)
    - Second tap creates dependency (first=prerequisite, second=dependent) and exits Link Mode
    - Back press or re-tap toggle cancels Link Mode
    - _Requirements: 27.1, 27.2, 27.3, 27.4, 27.5_

  - [x] 5.9 Implement order toggle (By Date / By Dependency)
    - Add "By Date" / "By Dependency" toggle to timeline controls
    - "By Date" uses `TimelineAlgorithms.layoutByDate()` with dated/undated lanes
    - "By Dependency" uses `TimelineAlgorithms.layoutByDependency()` in single lane
    - On mode change, re-render timeline layout and lines
    - _Requirements: 28.1, 28.2, 28.3, 28.4_

  - [x] 5.10 Implement critical path highlighting
    - Add "Critical Path" toggle button to timeline controls
    - On activate, compute longest dependency chain via `TimelineAlgorithms.criticalPath()`
    - Highlight all nodes and lines on the critical path with distinct styling
    - On deactivate, remove critical path highlighting
    - _Requirements: 29.1, 29.2, 29.3, 29.4_

  - [x] 5.11 Implement undo/redo controls for dependency changes
    - Add undo/redo buttons to timeline controls bar
    - On undo, reverse last dependency change and push to redo stack
    - On redo, re-apply last undone change
    - Limit undo stack to 50 entries
    - _Requirements: 30.1, 30.2, 30.3, 30.4_

  - [x] 5.12 Assemble TimelineView composable and wire to TasksScreen
    - Create `TimelineView.kt` composable combining TimelineCanvas, TimelineNodes, TimelineZoomControls, and controls bar
    - Compute node positions using selected order mode algorithm
    - Wire all interactions (tap, double-tap, long-press, drag) to ViewModel methods
    - _Requirements: 22.1, 22.2, 22.3, 22.4, 22.5_

  - [x] 5.13 Add Timeline mode to tasks view mode selector
    - Update `SidebarStateViewModel` to include "timeline" as a valid `tasksViewMode`
    - Add 🔗 Timeline button to the mode selector UI (alongside List, Assigned, Habits)
    - Persist selected mode to local storage and restore on next visit
    - Default to Timeline mode for new users
    - In `TasksScreen.kt`, add `"timeline"` branch in the `when(tasksMode)` block that renders `TimelineView`
    - _Requirements: 32.1, 32.2, 32.3, 32.4_

  - [x] 5.14 Implement double-tap to open editor on timeline nodes
    - Detect double-tap gesture on timeline nodes (distinct from single-tap highlight and long-press)
    - On double-tap, navigate to chit editor for that node's chit
    - _Requirements: 31.1, 31.2_

- [x] 6. Final Checkpoint — All features complete
  - Ensure all map, weather, and timeline features work correctly, ask the user if questions arise.

## Notes

- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation between major feature groups
- No test-writing tasks are included per project conventions
- No software installation steps are included
- All implementation is Kotlin/Jetpack Compose extending existing ViewModels
- The design specifies extending existing ViewModels (MapViewModel, WeatherViewModel, TasksViewModel) rather than creating new ones

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "3.1", "5.1"] },
    { "id": 1, "tasks": ["1.3", "1.4", "1.5", "3.2", "5.2"] },
    { "id": 2, "tasks": ["1.6", "1.9", "1.10", "3.3", "5.3"] },
    { "id": 3, "tasks": ["1.7", "1.8", "3.4", "3.5", "5.4", "5.5"] },
    { "id": 4, "tasks": ["3.6", "3.7", "3.8", "5.6", "5.7", "5.8"] },
    { "id": 5, "tasks": ["3.9", "3.10", "5.9", "5.10", "5.11"] },
    { "id": 6, "tasks": ["5.12", "5.13", "5.14"] }
  ]
}
```
