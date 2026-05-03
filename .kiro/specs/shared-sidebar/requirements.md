# Requirements Document

## Introduction

Extract the CWOC dashboard sidebar into a shared component that renders identically on both the dashboard and maps pages. The sidebar HTML structure is currently defined inline in `index.html` and the sidebar JS logic lives in `main-sidebar.js`. This feature extracts both into shared files so both pages get the same sidebar (Create Chit, Today, Period/Date nav, Filters, Contacts, Clock, Weather, Maps, Kiosk, Calculator, Notifications, Settings, Reference, Help, footer) with page-specific behavior driven by a callback/configuration system.

## Glossary

- **Shared_Sidebar**: The extracted sidebar component consisting of shared HTML template injection and shared JS logic, used on both the dashboard and maps pages.
- **Page_Context**: A configuration object registered by each page that provides page-specific callback functions for sidebar button actions (e.g., what "Today" does on the dashboard vs. the maps page).
- **Sidebar_Injector**: The portion of `shared-page.js` (or a new shared JS file) responsible for injecting the sidebar HTML into pages that opt in via a data attribute.
- **Shared_Sidebar_JS**: The new shared JavaScript file (`shared-sidebar.js`) containing sidebar toggle, collapse/expand, filter panel, notification inbox, and button-wiring logic extracted from `main-sidebar.js`.
- **Dashboard_Sidebar_Wrapper**: The thin dashboard-specific file (remaining `main-sidebar.js`) that registers dashboard-specific callbacks with the Shared_Sidebar_JS.
- **Maps_Sidebar_Wrapper**: The maps-specific code (in `maps.js` or a new file) that registers maps-specific callbacks with the Shared_Sidebar_JS.
- **CwocSidebarFilter**: The existing reusable filter panel component in `shared-sidebar-filter.js`, used for tag and people filters.
- **Sidebar_Footer**: The "C.W.'s Omni Chits" branding text pinned at the bottom of the sidebar on both pages.
- **Author_Info_Footer**: The auto-injected `.author-info` footer created by `shared-page.js` on secondary pages.

## Requirements

### Requirement 1: Shared Sidebar HTML Injection

**User Story:** As a developer, I want the sidebar HTML structure defined once and injected into any page that opts in, so that both the dashboard and maps pages render the same sidebar without duplicating markup.

#### Acceptance Criteria

1. WHEN a page includes a `data-sidebar` attribute on the `<body>` element, THE Sidebar_Injector SHALL inject the full sidebar HTML structure into that page's DOM before page-specific scripts initialize.
2. THE Sidebar_Injector SHALL produce a sidebar containing all standard sections: Create Chit button, Today button, date navigation (week range, prev/next arrows), Period dropdown, Filters section (collapsible, with Status, Tags, Priority, People sub-filters), Clear All / Show-Hide filter buttons, Contacts button, Clock and Weather buttons (half-width row), Maps and Kiosk buttons (half-width row), Calculator button, Notifications inbox, Settings button, Reference and Help buttons (half-width row), and the Sidebar_Footer.
3. THE Sidebar_Injector SHALL assign the same element IDs and CSS classes used by the current dashboard sidebar so that `styles-sidebar.css` applies without modification.
4. WHEN the dashboard page (`index.html`) loads, THE Shared_Sidebar SHALL render identically to the current inline sidebar markup.
5. WHEN the maps page (`maps.html`) loads, THE Shared_Sidebar SHALL replace the existing maps-specific sidebar (`maps-sidebar`) with the full shared sidebar.

### Requirement 2: Page-Context Callback System

**User Story:** As a developer, I want each page to register its own handlers for sidebar buttons, so that the same sidebar structure drives different behavior depending on which page is active.

#### Acceptance Criteria

1. THE Shared_Sidebar_JS SHALL expose a registration function (e.g., `registerSidebarContext`) that accepts a Page_Context object containing callback functions for sidebar actions.
2. WHEN a page registers a Page_Context, THE Shared_Sidebar_JS SHALL use the provided callbacks for button click handlers instead of hardcoded behavior.
3. THE Page_Context object SHALL support callbacks for: `onCreateChit`, `onToday`, `onPeriodChange`, `onFilterChange`, `onClearFilters`, `onContactsClick`, `onClockClick`, `onWeatherClick`, `onMapsClick`, `onKioskClick`, `onCalculatorClick`, `onSettingsClick`, `onReferenceClick`, `onHelpClick`, and `onNotificationToggle`.
4. IF a page does not provide a callback for a specific action, THEN THE Shared_Sidebar_JS SHALL use a sensible default (e.g., navigate to the relevant page).

### Requirement 3: Dashboard-Specific Sidebar Behavior

**User Story:** As a dashboard user, I want the sidebar to behave exactly as it does today after the extraction, so that no existing functionality is lost.

#### Acceptance Criteria

1. WHEN the dashboard registers its Page_Context, THE Dashboard_Sidebar_Wrapper SHALL provide callbacks that replicate all current `main-sidebar.js` behavior: Create Chit opens the editor, Today calls `goToToday()`, Period dropdown calls `changePeriod()`, filters call `displayChits()`, and navigation buttons go to their respective pages or open modals.
2. THE Dashboard_Sidebar_Wrapper SHALL continue to support dashboard-only sidebar sections (Order controls, Kanban toggle, Alarms mode, Tasks mode, Indicators range) by showing or hiding them based on the active tab.
3. WHILE the dashboard is loaded, THE Shared_Sidebar SHALL display the date navigation section (year display, week range, prev/next arrows) with the dashboard's calendar navigation functions bound.
4. THE Dashboard_Sidebar_Wrapper SHALL continue to load tag filters via `_loadLabelFilters()` and people filters via `_buildPeopleFilterPanel()` using the existing CwocSidebarFilter component.

### Requirement 4: Maps-Specific Sidebar Behavior

**User Story:** As a maps page user, I want the full shared sidebar with maps-appropriate behavior, so that I have the same navigation and filter capabilities as the dashboard.

#### Acceptance Criteria

1. WHEN the maps page registers its Page_Context, THE Maps_Sidebar_Wrapper SHALL provide callbacks where: Create Chit opens the editor, Today resets the map period filter to the current period, Period dropdown changes the date filter for chits on the map, and filters update which chits and contacts appear on the map.
2. WHILE the maps page is loaded, THE Shared_Sidebar SHALL display the Period dropdown with maps-specific options (This Week, This Month, This Quarter, This Year, All Time).
3. WHEN the user clicks the Maps button while on the maps page, THE Shared_Sidebar SHALL visually indicate that Maps is the current page (e.g., highlight or disable the button).
4. THE Maps_Sidebar_Wrapper SHALL use CwocSidebarFilter for tag and people filters, wired to the maps page's filter state and re-render functions.
5. WHEN the maps page loads with the shared sidebar, THE maps page SHALL hide the auto-injected Author_Info_Footer since the Sidebar_Footer already displays the branding.

### Requirement 5: Sidebar Toggle and State Persistence

**User Story:** As a user, I want the sidebar to remember whether I left it open or closed, and for that preference to work on both pages, so that my layout preference persists across page loads.

#### Acceptance Criteria

1. WHEN the user toggles the sidebar open or closed, THE Shared_Sidebar_JS SHALL persist the state to `localStorage` under a consistent key.
2. WHEN a page loads, THE Shared_Sidebar_JS SHALL restore the sidebar to its previously persisted open or closed state.
3. WHILE the viewport width is 768 pixels or less, THE Shared_Sidebar_JS SHALL default the sidebar to closed regardless of the persisted state.
4. WHEN the sidebar is toggled on a mobile viewport (768px or less), THE Shared_Sidebar_JS SHALL display a backdrop overlay behind the sidebar and close the sidebar when the backdrop is tapped.
5. THE Shared_Sidebar_JS SHALL dispatch a `resize` event after toggling so that page content (calendar, map) can adjust its layout.

### Requirement 6: Sidebar Section Collapse and Expand

**User Story:** As a user, I want to collapse and expand sidebar sections (Filters, sub-filter groups) on both pages, so that I can manage sidebar space the same way everywhere.

#### Acceptance Criteria

1. WHEN the user clicks the Filters toggle button, THE Shared_Sidebar_JS SHALL toggle the filters body between visible and hidden.
2. WHEN the user clicks a filter sub-group label (Status, Tags, Priority, People, Display, Sharing), THE Shared_Sidebar_JS SHALL toggle that sub-group's body between visible and hidden.
3. THE Shared_Sidebar_JS SHALL update the section toggle arrow indicator (▶ for collapsed, ▼ for expanded) when a section is toggled.

### Requirement 7: Clear Filters and Show/Hide Toggle Layout

**User Story:** As a user, I want the Clear Filters button and a Show/Hide filters toggle button displayed side by side at half width, so that I can quickly manage filter visibility and reset.

#### Acceptance Criteria

1. THE Shared_Sidebar SHALL render the Clear All Filters button and the Filters Show/Hide toggle button in a single row, each at half width, using the existing `sidebar-compact-btn` CSS class.
2. WHEN the user clicks Clear All Filters, THE Shared_Sidebar_JS SHALL invoke the page's `onClearFilters` callback to reset all filter selections.
3. WHEN the user clicks the Show/Hide toggle, THE Shared_Sidebar_JS SHALL toggle the filters body visibility, matching the behavior of the existing `_toggleFiltersSection()` function.

### Requirement 8: Notification Inbox in Shared Sidebar

**User Story:** As a user, I want the notification inbox to appear in the sidebar on both pages, so that I can see and respond to sharing notifications from any page.

#### Acceptance Criteria

1. THE Shared_Sidebar SHALL include the Notifications section with the inbox button and badge.
2. WHEN the shared sidebar initializes, THE Shared_Sidebar_JS SHALL fetch pending notifications from `/api/notifications` and update the badge count.
3. WHEN the user clicks the Notifications button, THE Shared_Sidebar_JS SHALL toggle the notification inbox list between visible and hidden.
4. WHEN the notification inbox is expanded, THE Shared_Sidebar_JS SHALL render notification cards with Accept and Decline action buttons.
5. WHEN the user clicks Accept or Decline on a notification, THE Shared_Sidebar_JS SHALL send the appropriate API request and refresh the notification list.

### Requirement 9: Sidebar Footer Branding

**User Story:** As a user, I want to see the "C.W.'s Omni Chits" branding at the bottom of the sidebar on every page that has the sidebar, so that the app identity is consistently displayed.

#### Acceptance Criteria

1. THE Shared_Sidebar SHALL render the Sidebar_Footer text "C.W.'s Omni Chits" as a link at the bottom of the sidebar, pinned below the scrollable content area.
2. WHEN the shared sidebar is present on the maps page, THE maps page SHALL hide the Author_Info_Footer to avoid duplicate branding.
3. THE Sidebar_Footer SHALL include the version number, fetched from `/api/version`, displayed as a tooltip or inline text matching the current dashboard behavior.

### Requirement 10: Shared Sidebar CSS Compatibility

**User Story:** As a developer, I want the existing `styles-sidebar.css` to work for the shared sidebar on both pages without duplication, so that sidebar styling is maintained from a single source.

#### Acceptance Criteria

1. THE Shared_Sidebar SHALL use the same CSS class names and structure as the current dashboard sidebar so that `styles-sidebar.css` applies identically.
2. WHEN the maps page loads the shared sidebar, THE maps page SHALL include `styles-sidebar.css` via a `<link>` tag (already present in `maps.html`).
3. IF page-specific sidebar styling adjustments are needed for the maps page, THEN THE maps page SHALL define those overrides in a page-specific `<style>` block or CSS file, not by modifying `styles-sidebar.css`.

### Requirement 11: Extraction Preserves Dashboard Functionality

**User Story:** As a dashboard user, I want zero regressions after the sidebar extraction, so that all existing sidebar features continue to work exactly as before.

#### Acceptance Criteria

1. WHEN the extraction is complete, THE dashboard SHALL pass all existing manual test scenarios: sidebar toggle, filter expand/collapse, tag filter search, people filter chips, status/priority checkboxes, clear all filters, sort controls, period dropdown, notification inbox, and all navigation buttons.
2. THE dashboard SHALL continue to support hotkey-driven sidebar interactions (filter focus, sort pick, archive toggle, pinned toggle) without modification to `main-hotkeys.js`.
3. THE dashboard SHALL continue to support the topbar hide/show toggle and its localStorage persistence.
