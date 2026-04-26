# Requirements Document

## Introduction

Make the entire CWOC (C.W.'s Omni Chits) web application mobile-friendly and responsive. Currently, the dashboard (`styles.css`) and shared secondary pages (`shared-page.css`) have no media queries or responsive breakpoints. The editor has minimal responsive support only at very narrow widths (≤400px). This feature will add proper responsive layouts across all pages so the app is fully usable on phones, tablets, and desktops while preserving the 1940s parchment/magic aesthetic.

## Glossary

- **Dashboard**: The main page (`index.html` + `main.js` + `styles.css`) containing the C CAPTN tab views (Calendar, Checklists, Alarms, Projects, Tasks, Notes), the sidebar, and the header with tab bar.
- **Secondary_Pages**: All non-dashboard pages that share `shared-page.css` and `shared-page.js` — includes Settings, Help, Trash, People, and Contact Editor.
- **Editor**: The chit editor page (`editor.html` + `editor.js` + `editor.css` + `shared-editor.css`) with collapsible zones in a two-column grid layout.
- **Sidebar**: The fixed-position left sidebar on the Dashboard containing navigation, period selector, filters, sort controls, and action buttons.
- **Tab_Bar**: The horizontal row of six C CAPTN tabs (Calendar, Checklists, Alerts, Projects, Tasks, Notes) in the Dashboard header.
- **Calendar_View**: The calendar rendering modes within the Dashboard — Week, Day, Month, Year, Itinerary, Work Hours, and X Days views.
- **Notes_View**: The multi-column masonry layout for note chits on the Dashboard.
- **Chit_Card**: The reusable card component (`.chit-card`) used to display chits in list and grid views.
- **Quick_Edit_Modal**: The shift-click modal overlay for quick editing chit properties on the Dashboard.
- **Viewport_Breakpoint**: A CSS media query width threshold that triggers layout changes — mobile (≤480px), tablet (481px–768px), and desktop (>768px).
- **Responsive_Layout_System**: The collection of CSS media queries, flexible units, and layout adjustments that adapt the UI to different screen sizes.

## Requirements

### Requirement 1: Viewport Meta and Base Responsive Foundation

**User Story:** As a mobile user, I want the app to render at the correct scale on my device, so that text and controls are legible without manual zooming.

#### Acceptance Criteria

1. THE Responsive_Layout_System SHALL define three Viewport_Breakpoints: mobile (max-width: 480px), tablet (max-width: 768px), and desktop (min-width: 769px).
2. WHEN the viewport width is at or below 480px, THE Responsive_Layout_System SHALL apply mobile-specific layout rules across all pages.
3. WHEN the viewport width is between 481px and 768px, THE Responsive_Layout_System SHALL apply tablet-specific layout rules across all pages.
4. THE Dashboard SHALL include a viewport meta tag with `width=device-width, initial-scale=1.0` (already present in `index.html`).
5. THE Responsive_Layout_System SHALL use CSS media queries in existing stylesheets (`styles.css`, `shared-page.css`, `editor.css`, `shared-editor.css`) without introducing any build tools, preprocessors, or new CSS frameworks.

### Requirement 2: Dashboard Header and Tab Bar Responsiveness

**User Story:** As a mobile user, I want the header and tab bar to adapt to my screen size, so that I can access all six C CAPTN tabs without horizontal scrolling.

#### Acceptance Criteria

1. WHEN the viewport width is at or below 768px, THE Tab_Bar SHALL wrap tabs onto multiple rows or allow horizontal scrolling so that all six C CAPTN tabs remain accessible; tab labels may be abbreviated but all tabs SHALL remain visible and tappable.
2. WHEN the viewport width is at or below 480px, THE Dashboard header SHALL reduce the logo size and title font size to fit within the mobile viewport width.
3. THE Tab_Bar SHALL remain accessible via touch targets that are at least 44x44 CSS pixels on mobile viewports.
4. WHEN the viewport width is at or below 480px, THE Dashboard header SHALL stack vertically (logo and title above the tab bar) instead of displaying in a single horizontal row.
5. IF the Tab_Bar content exceeds the viewport width after responsive adjustments, THEN THE Tab_Bar SHALL allow horizontal scrolling with visible scroll affordance rather than overflowing off-screen.

### Requirement 3: Sidebar Mobile Behavior

**User Story:** As a mobile user, I want the sidebar to work as a full-screen overlay, so that it does not consume permanent screen space on small devices.

#### Acceptance Criteria

1. WHEN the viewport width is at or below 768px, THE Sidebar SHALL default to a hidden (closed) state on page load.
2. WHEN the viewport width is at or below 768px AND the Sidebar is opened, THE Sidebar SHALL display as a full-width overlay covering the main content area with a semi-transparent backdrop.
3. WHEN the user taps outside the Sidebar overlay on a mobile viewport, THE Sidebar SHALL close automatically.
4. THE Sidebar toggle (logo click) SHALL remain functional and accessible at all viewport sizes.
5. WHEN the viewport width is at or below 768px, THE Sidebar SHALL have a width of 100% (or at least 280px) instead of the fixed 200px desktop width.

### Requirement 4: Calendar View Responsiveness

**User Story:** As a mobile user, I want the calendar views to adapt to narrow screens, so that I can view and interact with my scheduled chits on a phone.

#### Acceptance Criteria

1. WHEN the viewport width is at or below 480px AND the Calendar_View is in Week mode, THE Calendar_View SHALL display a single-day column with swipe or button navigation between days instead of the 7-column grid.
2. WHEN the viewport width is between 481px and 768px AND the Calendar_View is in Week mode, THE Calendar_View SHALL reduce the 7-column grid to show 3 days at a time with navigation controls.
3. WHEN the viewport width is at or below 480px AND the Calendar_View is in Month mode, THE Calendar_View SHALL reduce the month grid cell size and use abbreviated day names (single letter) to fit within the viewport.
4. THE Calendar_View timed events SHALL remain tappable with touch targets of at least 44px height on mobile viewports.
5. WHEN the viewport width is at or below 768px, THE Calendar_View drag-to-move and drag-to-resize interactions SHALL remain functional with touch events (touchstart, touchmove, touchend).
6. THE Calendar_View SHALL support all seven period modes (Itinerary, Day, Week, Work Hours, X Days, Month, Year) at all viewport sizes — no calendar mode SHALL be disabled or removed on mobile or tablet viewports.
7. WHEN the viewport width is at or below 480px AND the Calendar_View is in Year mode, THE Calendar_View SHALL reflow the 12-month grid to fit within the viewport width (e.g., 1–2 months per row instead of 3–4).

### Requirement 5: List Views Responsiveness (Tasks, Checklists, Alerts, Projects)

**User Story:** As a mobile user, I want the list-based views to display chit cards in a single-column layout, so that I can read and interact with chits comfortably on a narrow screen.

#### Acceptance Criteria

1. WHEN the viewport width is at or below 768px, THE Chit_Card header row SHALL wrap its metadata to a second line below the title instead of displaying in a single row.
2. WHEN the viewport width is at or below 480px, THE Chit_Card SHALL use full viewport width with appropriate padding (8px–12px) for comfortable reading.
3. THE Chit_Card interactive elements (links, status icons, action buttons) SHALL have touch targets of at least 44x44 CSS pixels on mobile viewports.
4. WHEN the viewport width is at or below 480px, THE Projects view Kanban-style board SHALL stack status columns vertically instead of displaying side by side.

### Requirement 6: Notes View Responsiveness

**User Story:** As a mobile user, I want the notes masonry layout to adapt to my screen width, so that I can read note cards without horizontal scrolling.

#### Acceptance Criteria

1. WHEN the viewport width is at or below 480px, THE Notes_View SHALL display note cards in a single-column layout at full viewport width.
2. WHEN the viewport width is between 481px and 768px, THE Notes_View SHALL display note cards in a two-column layout.
3. WHEN the viewport width is above 768px, THE Notes_View SHALL maintain the current multi-column masonry layout.
4. THE Notes_View note card content (rendered markdown) SHALL constrain images and preformatted blocks to the card width using `max-width: 100%` and `overflow-x: auto`.

### Requirement 7: Editor Page Responsiveness

**User Story:** As a mobile user, I want the chit editor to be usable on a phone screen, so that I can create and edit chits on the go.

#### Acceptance Criteria

1. WHEN the viewport width is at or below 768px, THE Editor two-column zone grid (`.main-zones-grid`) SHALL collapse to a single-column layout.
2. WHEN the viewport width is at or below 480px, THE Editor header row SHALL stack the title, save buttons, and action buttons vertically.
3. WHEN the viewport width is at or below 480px, THE Editor title-weather container (`#titleWeatherContainer`) SHALL stack the title field above the weather section vertically instead of side by side.
4. WHEN the viewport width is at or below 768px, THE Editor zone action buttons (Expand, Render, Copy, Download) SHALL use a compact display (icon-only or abbreviated labels) while remaining fully functional and tappable.
5. THE Editor date picker inputs (Flatpickr) SHALL open in a touch-friendly mode on mobile viewports, using the full available width.
6. WHEN the viewport width is at or below 480px, THE Editor tag tree and active tags containers (`.verticalBox`) SHALL stack vertically instead of side by side.

### Requirement 8: Secondary Pages Responsiveness

**User Story:** As a mobile user, I want the Settings, Help, Trash, and People pages to be readable and usable on my phone, so that I can manage my app configuration from any device.

#### Acceptance Criteria

1. WHEN the viewport width is at or below 768px, THE Secondary_Pages settings grid (`.settings-grid`) SHALL collapse to a single-column layout.
2. WHEN the viewport width is at or below 480px, THE Secondary_Pages header bar (`.header-and-buttons`) SHALL stack the title and navigation buttons vertically.
3. WHEN the viewport width is at or below 480px, THE Trash page table (`.cwoc-table`) SHALL adapt to the narrow viewport by either allowing horizontal scrolling or hiding low-priority columns behind a toggle/expand control so that all data remains accessible.
4. WHEN the viewport width is at or below 480px, THE Help page table of contents (`.index ul`) SHALL switch from a two-column to a single-column layout.
5. THE Secondary_Pages `.settings-panel` SHALL use `max-width: 100%` and appropriate padding on mobile viewports to prevent horizontal overflow.

### Requirement 9: Touch Interaction Support

**User Story:** As a mobile user, I want touch gestures to work for drag-and-drop and interactive elements, so that I can use the app without a mouse.

#### Acceptance Criteria

1. THE Dashboard calendar drag-to-move functionality SHALL respond to touch events (touchstart, touchmove, touchend) in addition to mouse events.
2. THE Dashboard calendar drag-to-resize functionality SHALL respond to touch events in addition to mouse events.
3. THE Editor checklist drag-to-reorder functionality SHALL respond to touch events in addition to mouse events.
4. THE Dashboard chit card drag-to-reorder (manual sort) functionality SHALL respond to touch events in addition to mouse events.
5. IF a touch drag operation is in progress, THEN THE Responsive_Layout_System SHALL prevent the default browser scroll behavior to avoid conflicting with the drag gesture.

### Requirement 10: Modal and Overlay Responsiveness

**User Story:** As a mobile user, I want modals and overlays to fit my screen, so that I can interact with modal content without scrolling past the viewport edges.

#### Acceptance Criteria

1. WHEN the viewport width is at or below 480px, THE Quick_Edit_Modal SHALL display at full viewport width with 8px margin on each side.
2. WHEN the viewport width is at or below 480px, THE hotkey panel overlays (`.hotkey-panel`) SHALL display at full viewport width with centered positioning.
3. WHEN the viewport width is at or below 480px, THE reference overlay (`.reference-content`) SHALL switch its multi-column layout (`.ref-columns`) to a single-column stack.
4. THE delete confirmation modal (`#deleteChitModal`) SHALL constrain its width to `max-width: 90%` on all viewport sizes (already implemented).
5. WHEN the viewport width is at or below 480px, THE clock modal SHALL display at full viewport width with appropriate padding.

### Requirement 11: Full Feature Parity Across Viewports

**User Story:** As a mobile user, I want access to every feature available on desktop, so that I am not limited by my device choice.

#### Acceptance Criteria

1. THE Responsive_Layout_System SHALL preserve all Dashboard functionality — all six C CAPTN tabs, all seven calendar periods, all sidebar controls (filters, sort, period, search, saved searches), and all hotkey/keyboard shortcuts — at every viewport size.
2. THE Responsive_Layout_System SHALL preserve all Editor functionality — all collapsible zones (Dates, Task, Location, Tags, People, Notes, Checklist, Alerts, Health Indicators, Color, Projects, Audit Log), QR code generation, and all save/delete/archive actions — at every viewport size.
3. THE Responsive_Layout_System SHALL preserve all Secondary_Pages functionality — all Settings sections, full Trash table with restore/delete actions, full Help content, full People/Contact management — at every viewport size.
4. THE Quick_Edit_Modal SHALL provide all fields and actions (title edit, Priority, Severity, Status, Pin, Archive, Delete, QR, recurrence options) at every viewport size.
5. THE Responsive_Layout_System SHALL NOT remove or disable any interactive control or data at any viewport size; elements MAY be hidden behind toggles, menus, drawers, or expandable sections as long as a visible control exists to reveal them.

### Requirement 12: Typography and Spacing Scaling

**User Story:** As a mobile user, I want text and spacing to scale appropriately on small screens, so that the interface remains readable without excessive scrolling.

#### Acceptance Criteria

1. WHEN the viewport width is at or below 480px, THE Dashboard heading (`h1`) font size SHALL reduce to a maximum of 1.5em (from the desktop 2.5em).
2. WHEN the viewport width is at or below 480px, THE Responsive_Layout_System SHALL reduce general padding and margins by approximately 40% compared to desktop values.
3. THE Responsive_Layout_System SHALL use relative units (em, rem, %, vw) for font sizes and spacing where fixed pixel values currently cause overflow on mobile viewports.
4. THE Responsive_Layout_System SHALL preserve the Courier New font family and 1940s parchment aesthetic at all viewport sizes.
