# Requirements Document

## Introduction

The Maps View Overhaul redesigns the existing Maps page (`/maps`) to maximize map visibility, improve filter ergonomics, and add new marker behaviors and user settings. The overhaul moves filters into a collapsible left sidebar (reusing the `CwocSidebarFilter` pattern from the dashboard's `main-sidebar.js` and `styles-sidebar.css`), relocates the People/Chits mode toggle into the page header, makes people marker bubbles semi-transparent, introduces mixed-type cluster markers, adds browser-native fullscreen mode, and provides new map start settings (default center, zoom level, auto-zoom, reset button) in the Settings page. All changes maintain the existing 1940s parchment/magic aesthetic and are mobile-friendly from the start.

## Glossary

- **Maps_Page**: The existing CWOC page served at `/maps` from `maps.html`, displaying an interactive Leaflet map with chit and contact markers
- **Maps_Sidebar**: A new collapsible left sidebar on the Maps_Page that contains all filter controls, reusing the `CwocSidebarFilter` class and sidebar CSS patterns from the dashboard
- **Mode_Toggle**: The existing Chits/People toggle control, relocated from the filter area into the Maps_Page header bar
- **Chits_Filter_Panel**: The filter controls for Chits mode (status, tags, priority, people, text search, date range), now rendered inside the Maps_Sidebar
- **People_Filter_Panel**: The filter controls for People mode (text search, favorites toggle, tag chips), now rendered inside the Maps_Sidebar
- **Map_Container**: The Leaflet.js map instance rendered on the Maps_Page, expanded to fill all available viewport space
- **Contact_Marker**: A Leaflet divIcon marker representing a single contact, rendered as a semi-transparent square with the contact's color
- **Chit_Marker**: A Leaflet circleMarker representing a single chit, rendered as a semi-transparent circle colored by status
- **Cluster_Marker**: A Leaflet.markercluster icon that aggregates nearby markers into a single numbered icon when zoomed out
- **Mixed_Cluster_Marker**: A Cluster_Marker that contains both Chit_Markers and Contact_Markers, displayed as a square with a circle inscribed inside it
- **Fullscreen_Button**: A map control button that activates the browser Fullscreen API to display the Maps_Page in true browser fullscreen
- **Map_Settings**: A new section in the Settings page for configuring the map's default center point, zoom level, and auto-zoom behavior
- **Settings_Model**: The Pydantic `Settings` model in `models.py` that defines all user settings fields
- **Settings_Migration**: A new migration function in `migrations.py` that adds map settings columns to the SQLite settings table
- **Default_View_Button**: A button overlaid on the map that resets the map to the user's configured default center and zoom level

## Requirements

### Requirement 1: Collapsible Sidebar Filters

**User Story:** As a user, I want the map filters in a collapsible left sidebar, so that I can access filters without losing map visibility.

#### Acceptance Criteria

1. THE Maps_Page SHALL display a Maps_Sidebar on the left side of the page containing all filter controls for the active mode
2. THE Maps_Sidebar SHALL reuse the `CwocSidebarFilter` class from `main-sidebar.js` and the sidebar CSS patterns from `styles-sidebar.css` for rendering filter panels
3. THE Maps_Sidebar SHALL include a toggle button that collapses and expands the sidebar
4. WHEN the Maps_Sidebar is collapsed, THE Maps_Page SHALL display only the toggle button and the Map_Container SHALL expand to fill the freed horizontal space
5. WHEN the Maps_Sidebar is expanded, THE Maps_Sidebar SHALL display the filter controls for the currently active mode (Chits_Filter_Panel or People_Filter_Panel)
6. THE Maps_Sidebar SHALL persist its collapsed or expanded state in localStorage so that the user's preference is restored on subsequent page loads
7. WHILE Chits mode is active, THE Maps_Sidebar SHALL display the Chits_Filter_Panel and hide the People_Filter_Panel
8. WHILE People mode is active, THE Maps_Sidebar SHALL display the People_Filter_Panel and hide the Chits_Filter_Panel

### Requirement 2: Maximized Map Area

**User Story:** As a user, I want the map to fill all available viewport space without scrolling, so that I can see as much of the map as possible.

#### Acceptance Criteria

1. THE Map_Container SHALL fill the remaining viewport width after accounting for the Maps_Sidebar (when expanded) or the full viewport width (when the sidebar is collapsed)
2. THE Map_Container SHALL fill the remaining viewport height after accounting for the page header, with no vertical scrollbar on the page body
3. THE Maps_Page body SHALL use `overflow: hidden` to prevent page-level scrolling, ensuring the map is the only scrollable element
4. THE Map_Container SHALL use CSS `height: calc(100vh - <header_height>)` or equivalent flexbox layout to fill available vertical space
5. WHEN the Maps_Sidebar is toggled, THE Map_Container SHALL resize to fill the available space and THE Leaflet map SHALL call `invalidateSize()` to recalculate its dimensions

### Requirement 3: People/Chits Toggle in Header

**User Story:** As a user, I want the People/Chits mode toggle in the page header, so that it is always visible regardless of sidebar state.

#### Acceptance Criteria

1. THE Mode_Toggle SHALL be positioned in the Maps_Page header bar, alongside the page title and navigation controls
2. THE Mode_Toggle SHALL remain visible and accessible regardless of whether the Maps_Sidebar is collapsed or expanded
3. WHEN the user switches modes via the Mode_Toggle, THE Maps_Sidebar SHALL swap its displayed filter panel to match the selected mode
4. THE Mode_Toggle SHALL maintain the same visual style (pill-toggle buttons) and behavior as the current implementation

### Requirement 4: Semi-Transparent People Markers

**User Story:** As a user, I want people marker bubbles to be semi-transparent like chit markers, so that overlapping markers remain partially visible.

#### Acceptance Criteria

1. THE Contact_Marker SHALL render with a semi-transparent fill (opacity between 0.5 and 0.7) matching the contact's assigned color
2. THE Contact_Marker SHALL maintain a visible border with full opacity so that the marker shape remains distinguishable
3. THE Chit_Marker SHALL continue to render with its existing semi-transparent fill (fillOpacity of 0.85 or similar)

### Requirement 5: Collapsed Cluster Markers

**User Story:** As a user, I want cluster markers to show a count and use distinct shapes for mixed clusters, so that I can identify cluster contents at a glance.

#### Acceptance Criteria

1. WHEN multiple Chit_Markers collapse into a Cluster_Marker, THE Cluster_Marker SHALL display as a square-shaped icon with a count of the contained markers
2. WHEN multiple Contact_Markers collapse into a Cluster_Marker, THE Cluster_Marker SHALL display as a square-shaped icon with a count of the contained markers
3. WHEN a Cluster_Marker contains both Chit_Markers and Contact_Markers, THE Cluster_Marker SHALL display as a Mixed_Cluster_Marker: a square icon with a circle inscribed inside it, filling the square
4. THE Mixed_Cluster_Marker SHALL display the total count of all contained markers (both chits and contacts)
5. THE Cluster_Marker SHALL use distinct color schemes for chit-only clusters, people-only clusters, and mixed clusters so that the user can distinguish cluster types

### Requirement 6: Fullscreen Mode

**User Story:** As a user, I want a fullscreen button on the map, so that I can view the map in true browser fullscreen for maximum visibility.

#### Acceptance Criteria

1. THE Maps_Page SHALL display a Fullscreen_Button as a Leaflet map control (positioned in a map corner)
2. WHEN the user clicks the Fullscreen_Button, THE Maps_Page SHALL request browser fullscreen mode using the Fullscreen API (`document.documentElement.requestFullscreen()`)
3. WHILE the browser is in fullscreen mode, THE Fullscreen_Button icon SHALL change to indicate an "exit fullscreen" action
4. WHEN the user clicks the Fullscreen_Button while in fullscreen mode, THE Maps_Page SHALL exit fullscreen using `document.exitFullscreen()`
5. WHEN the user exits fullscreen via the browser's native mechanism (e.g., pressing Escape), THE Fullscreen_Button icon SHALL revert to the "enter fullscreen" state
6. IF the browser does not support the Fullscreen API, THEN THE Fullscreen_Button SHALL be hidden

### Requirement 7: Map Start Settings

**User Story:** As a user, I want to configure default map center and zoom settings, so that the map opens to my preferred view each time.

#### Acceptance Criteria

1. THE Settings page SHALL include a new Map_Settings section with controls for configuring the default map center latitude, default map center longitude, and default zoom level
2. THE Map_Settings section SHALL include a checkbox or toggle for enabling auto-zoom on load (fitting all markers into view)
3. WHEN auto-zoom is enabled, THE Maps_Page SHALL fit the map bounds to encompass all visible markers on load (existing behavior)
4. WHEN auto-zoom is disabled and a default center and zoom are configured, THE Maps_Page SHALL initialize the map at the configured center point and zoom level instead of fitting to markers
5. WHEN no custom center or zoom is configured and auto-zoom is disabled, THE Maps_Page SHALL default to a view showing the continental United States (approximately center 39.8283°N, 98.5795°W at zoom level 4)
6. THE Settings_Model SHALL include new optional fields: `map_default_lat` (string), `map_default_lon` (string), `map_default_zoom` (string), and `map_auto_zoom` (string, default "1" for enabled)
7. THE Settings_Migration SHALL add `map_default_lat`, `map_default_lon`, `map_default_zoom`, and `map_auto_zoom` columns to the settings table with appropriate defaults
8. THE save_settings route SHALL persist the new map settings fields alongside existing settings

### Requirement 8: Default View Reset Button

**User Story:** As a user, I want a button on the map to reset back to my default view, so that I can quickly return to my preferred starting position after panning or zooming.

#### Acceptance Criteria

1. THE Maps_Page SHALL display a Default_View_Button as a Leaflet map control (positioned in a map corner, separate from the Fullscreen_Button)
2. WHEN the user clicks the Default_View_Button and auto-zoom is enabled, THE Map_Container SHALL fit bounds to all visible markers
3. WHEN the user clicks the Default_View_Button and auto-zoom is disabled, THE Map_Container SHALL pan and zoom to the user's configured default center and zoom level
4. WHEN the user clicks the Default_View_Button and no custom settings are configured and auto-zoom is disabled, THE Map_Container SHALL pan and zoom to the default USA view (center 39.8283°N, 98.5795°W, zoom 4)

### Requirement 9: Responsive Layout

**User Story:** As a user on a mobile device, I want the maps overhaul to be usable on smaller screens, so that I can use all features from my phone.

#### Acceptance Criteria

1. WHILE the viewport width is 768px or less, THE Maps_Sidebar SHALL default to collapsed and overlay the map when expanded (rather than pushing the map aside)
2. WHILE the viewport width is 768px or less, THE Maps_Sidebar SHALL include a backdrop overlay that closes the sidebar when tapped
3. WHILE the viewport width is 768px or less, THE Mode_Toggle SHALL display as a compact toggle that does not consume excessive vertical space in the header
4. THE Fullscreen_Button and Default_View_Button SHALL be touch-friendly with a minimum tap target of 44×44px
5. THE Map_Container SHALL fill the full viewport width on mobile devices

### Requirement 10: Help Documentation

**User Story:** As a user, I want to find documentation about the maps overhaul changes in the help page, so that I can learn how to use the new features.

#### Acceptance Criteria

1. WHEN the Maps View Overhaul feature is complete, THE Help page SHALL update the existing Maps View section to document the collapsible sidebar, fullscreen mode, default view button, map start settings, and mixed cluster markers

### Requirement 11: Index and Version Updates

**User Story:** As a developer, I want the code index and version to reflect the Maps View Overhaul changes, so that the project documentation stays current.

#### Acceptance Criteria

1. WHEN the Maps View Overhaul feature is complete, THE `src/INDEX.md` file SHALL be updated to include all new and modified functions added for this feature
2. WHEN the Maps View Overhaul feature is complete, THE `src/VERSION` file SHALL be updated with the current timestamp using the `date "+%Y%m%d.%H%M"` format
3. WHEN the Maps View Overhaul feature is complete, a release notes file SHALL be created in `documents/release_notes/` documenting the Maps View Overhaul feature
