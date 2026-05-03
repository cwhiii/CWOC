# Implementation Plan: Shared Sidebar

## Overview

Extract the CWOC dashboard sidebar into a shared component driven by `shared-sidebar.js`. The sidebar HTML is built dynamically and injected via a `data-sidebar` attribute on `<body>`, following the existing `shared-page.js` auto-injection pattern. Each page registers a Page_Context with callbacks for page-specific behavior. The dashboard's `main-sidebar.js` becomes a thin wrapper, and the maps page replaces its custom sidebar with the shared one.

## Tasks

- [x] 1. Create shared-sidebar.js with injection and initialization
  - [x] 1.1 Create `src/frontend/js/shared/shared-sidebar.js` with the `_cwocInjectSidebar()` IIFE
    - Build the complete sidebar DOM structure matching the current inline sidebar in `index.html`
    - Include all sections: Create Chit, Date Nav (Today, prev/next, year/week display), Order, Period, tab-specific sections (Kanban, Alarms, Tasks, Indicators — hidden by default), Filters (collapsible with Status, Priority, Tags, People, Display, Sharing sub-groups), Clear Filters + Show/Hide row, Navigation buttons (Contacts, Clock/Weather, Maps/Kiosk, Calculator), Notifications inbox, sidebar-bottom (Settings, Reference/Help, version footer)
    - Use identical element IDs and CSS classes as the current `index.html` sidebar so `styles-sidebar.css` applies without changes
    - Guard on `document.body.dataset.sidebar` — return early if attribute is absent
    - Insert sidebar as first child of `<body>`
    - _Requirements: 1.1, 1.2, 1.3, 10.1_

  - [x] 1.2 Implement `_cwocInitSidebar(context)` in `shared-sidebar.js`
    - Accept a Page_Context object and store it globally as `_cwocSidebarContext`
    - Wire all button onclick handlers using context callbacks with sensible defaults (per design Default Callbacks table)
    - Initialize sidebar toggle with `localStorage` persistence under `sidebarState` key
    - Initialize mobile backdrop (viewport ≤768px: force closed, show backdrop on open)
    - Initialize filter section collapse/expand (`_toggleFiltersSection`, `toggleFilterGroup`, `toggleSidebarSection`)
    - Populate period dropdown from `context.periodOptions` if provided
    - Call `context.loadTagFilters` and `context.loadPeopleFilters` if provided
    - Fetch and render notifications (`_fetchNotifications`, `_updateNotifBadge`, `_renderNotifInbox`, `_toggleNotifInbox`)
    - Move notification accept/decline logic (`_respondNotification`) into shared-sidebar.js
    - Dispatch `resize` event after toggle transitions
    - Fetch version from `/api/version` and populate the sidebar footer
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 8.1, 8.2, 8.3, 8.4, 8.5, 9.1, 9.3_

  - [x] 1.3 Implement Clear Filters + Show/Hide half-width button layout
    - Render the Clear All Filters button and the Filters Show/Hide toggle button in a single row using `sidebar-compact-btn` CSS class, each at half width
    - Clear All invokes `context.onClearFilters` callback
    - Show/Hide toggles the filters body visibility matching `_toggleFiltersSection()` behavior
    - _Requirements: 7.1, 7.2, 7.3_

- [x] 2. Update index.html to use data-sidebar and remove inline sidebar HTML
  - [x] 2.1 Add `data-sidebar="true"` to the `<body>` tag in `index.html`
    - _Requirements: 1.1, 1.4_

  - [x] 2.2 Remove the entire inline sidebar HTML block from `index.html` (the `<div class="sidebar" id="sidebar">` through its closing `</div>`, approximately 300 lines)
    - Keep all hotkey overlay panels and other non-sidebar markup intact
    - _Requirements: 1.1, 1.4_

  - [x] 2.3 Add the `<script>` tag for `shared-sidebar.js` in `index.html`
    - Place it after `shared-sidebar-filter.js` and before `shared-page.js` in the script load order
    - _Requirements: 1.1_

- [x] 3. Refactor main-sidebar.js to thin dashboard wrapper
  - [x] 3.1 Create `_initDashboardSidebar()` function in `main-sidebar.js`
    - Call `_cwocInitSidebar()` with the dashboard Page_Context object containing all dashboard-specific callbacks (onCreateChit, onToday, onPeriodChange, onPreviousPeriod, onNextPeriod, onFilterChange, onClearFilters, onSortChange, onSortDirToggle, onContactsClick, onClockClick, onWeatherClick, onCalculatorClick, onReferenceClick, onHelpClick, periodOptions, loadTagFilters, loadPeopleFilters)
    - _Requirements: 2.1, 2.2, 3.1_

  - [x] 3.2 Remove functions from `main-sidebar.js` that are now in `shared-sidebar.js`
    - Remove: `toggleSidebar`, `restoreSidebarState`, `toggleSidebarSection`, `expandSidebarSection`, `_toggleFiltersSection`, `_expandFiltersSection`, `toggleFilterGroup`, `expandFilterGroup`, `_toggleNotifInbox`, `_fetchNotifications`, `_updateNotifBadge`, `_renderNotifInbox`, `_respondNotification`, `_toggleTopbar`, `_restoreTopbarState`
    - Keep dashboard-specific functions: `onSortSelectChange`, `toggleSortDir`, `_updateSortUI`, `onFilterChange`, `onFilterAnyToggle`, `onFilterSpecificToggle`, `clearFilterGroup`, `_filterTagCheckboxes`, `_clearAllFilters`, `_resetDefaultFilters`, `_updateClearFiltersButton`, `_getSelectedStatuses`, `_getSelectedLabels`, `_getSelectedPriorities`, `_toggleFilterArchived`, `_toggleFilterPinned`, `_filterFocusSearch`, `_pickSort`, `_buildTagFilterPanel`, `_syncSidebarTagCheckboxes`, `_buildPeopleFilterPanel`, `_renderPeopleFilterPanel`, `_renderPeopleChipFilter`, `_isPeopleColorLight`, `clearPeopleFilter`, `_loadLabelFilters`
    - _Requirements: 3.1, 3.2, 3.4, 11.1, 11.2_

  - [x] 3.3 Wire `_initDashboardSidebar()` into the dashboard initialization flow
    - Call it from `main-init.js` (or wherever the dashboard currently initializes sidebar state) so it runs after shared-sidebar.js has injected the DOM
    - _Requirements: 3.1, 3.3_

- [x] 4. Checkpoint — Verify dashboard still works
  - Ensure all tests pass, ask the user if questions arise.
  - Verify: sidebar toggle, filter expand/collapse, tag filter search, people filter chips, status/priority checkboxes, clear all filters, sort controls, period dropdown, notification inbox, all navigation buttons, hotkey-driven sidebar interactions
  - _Requirements: 11.1, 11.2, 11.3_

- [x] 5. Update maps.html to use data-sidebar and remove custom sidebar
  - [x] 5.1 Add `data-sidebar="true"` to the `<body>` tag in `maps.html` (alongside existing `data-page-title`)
    - _Requirements: 1.1, 1.5_

  - [x] 5.2 Remove the custom maps sidebar HTML from `maps.html`
    - Remove the `<aside id="maps-sidebar" class="maps-sidebar">` block and all its contents (chits filter panel, people filter panel)
    - Keep the main map area, status bar, legends, and Google Maps warning intact
    - _Requirements: 1.5, 4.1_

  - [x] 5.3 Add the `<script>` tag for `shared-sidebar.js` in `maps.html`
    - Place it after `shared-sidebar-filter.js` and before `shared-page.js` in the script load order
    - Add `styles-sidebar.css` link if not already present (it is already present)
    - _Requirements: 1.5, 10.2_

  - [x] 5.4 Add any maps-specific sidebar CSS overrides needed
    - If the shared sidebar needs layout adjustments on the maps page (e.g., sidebar positioning relative to the map container), add overrides in the maps page `<style>` block — not in `styles-sidebar.css`
    - _Requirements: 10.3_

- [x] 6. Add maps-specific sidebar wrapper in maps.js
  - [x] 6.1 Create `_initMapsSidebarShared()` function in `maps.js`
    - Call `_cwocInitSidebar()` with maps-specific Page_Context: onCreateChit opens editor, onToday resets period filter, onPeriodChange calls `_onChitsFilterChange()`, onFilterChange calls `_onChitsFilterChange()`, onClearFilters calls `_clearChitsFilters()`, onMapsClick is no-op (already on maps), periodOptions with maps-specific values (This Week, This Month, This Quarter, This Year, All Time), loadTagFilters calls `_loadChitsFilterData()`, loadPeopleFilters handled by `_loadChitsFilterData()`
    - _Requirements: 4.1, 4.2, 4.4_

  - [x] 6.2 Hide the Author_Info_Footer on the maps page when shared sidebar is present
    - In `_initMapsSidebarShared()`, hide `.author-info` element since the sidebar footer already displays branding
    - _Requirements: 4.5, 9.2_

  - [x] 6.3 Visually indicate Maps as the current page in the sidebar
    - Pass `currentPage: 'maps'` in the Page_Context so the Maps navigation button is highlighted or disabled
    - _Requirements: 4.3_

  - [x] 6.4 Remove or refactor the old maps sidebar initialization code
    - Remove `_initMapsSidebar()`, `_toggleMapsSidebar()`, `_restoreMapsSidebarState()`, `_showMobileSidebarBackdrop()`, `_hideMobileSidebarBackdrop()` from `maps.js` since the shared sidebar handles toggle, state persistence, and mobile backdrop
    - Update `_mapsInit()` to call `_initMapsSidebarShared()` instead of `_initMapsSidebar()`
    - Rewire the sidebar toggle button injection (`_injectModeToggle`) to work with the shared sidebar's toggle button instead of the old `maps-sidebar-toggle`
    - _Requirements: 4.1, 5.1, 5.4_

  - [x] 6.5 Rewire maps filter panels to use shared sidebar filter containers
    - Update `_initChitsFilters()` and `_loadChitsFilterData()` to target the shared sidebar's filter container IDs (e.g., `label-multi`, `people-multi`, `status-multi`, `priority-multi`) instead of the old maps-specific IDs (`maps-chits-tags-filter`, `maps-chits-people-filter`, etc.)
    - Ensure CwocSidebarFilter calls use the shared sidebar's container elements
    - _Requirements: 4.4_

- [x] 7. Checkpoint — Verify maps page works
  - Ensure all tests pass, ask the user if questions arise.
  - Verify: shared sidebar renders on maps page, maps-specific period options appear, filters update map markers, Maps button is highlighted, sidebar toggle works, mobile backdrop works, Author_Info_Footer is hidden, notifications work
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.4, 8.1, 9.2_

- [x] 8. Cross-page state and final integration
  - [x] 8.1 Verify cross-page sidebar state persistence
    - Confirm that toggling sidebar closed on dashboard, then navigating to maps, keeps sidebar closed (and vice versa) via the shared `sidebarState` localStorage key
    - _Requirements: 5.1, 5.2_

  - [x] 8.2 Verify dashboard hotkeys still work through the shared sidebar
    - Confirm backtick (sidebar toggle), F (filter), O (order), V (navigate), and all filter sub-panel hotkeys work correctly with the shared sidebar DOM
    - Ensure `main-hotkeys.js` doesn't need changes since element IDs are preserved
    - _Requirements: 11.2_

- [x] 9. Documentation and finalization
  - [x] 9.1 Update `src/INDEX.md` with new shared-sidebar.js functions and any changes to main-sidebar.js and maps.js
    - _Requirements: N/A (project convention)_

  - [x] 9.2 Update version number in `src/VERSION`
    - Run `date "+%Y%m%d.%H%M"` and use the returned value
    - _Requirements: N/A (project convention)_

  - [x] 9.3 Create release notes file
    - Brief summary of the shared sidebar extraction
    - _Requirements: N/A (project convention)_

- [x] 10. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.
  - Full regression check: dashboard sidebar, maps sidebar, cross-page state, hotkeys, notifications, filters, mobile behavior

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP — no tasks in this plan are marked optional since all are core implementation
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- No software installations required — all code is vanilla JS with script tags
- The design has Correctness Properties but property-based tests are omitted because the project has no PBT library available and the rules prohibit installing software
- The existing `styles-sidebar.css` should work without modification since the shared sidebar uses identical IDs and classes
