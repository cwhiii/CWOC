# Calendar — Month

**Category:** Dashboard Views
**Item #:** 5
**Code Verified:** ✅
**User Verified:** ⬜

## Functions, Buttons, Controls & Inputs

### Rendering & Layout (main-calendar.js)

- [ ] displayMonthView(chitsToDisplay) — Main entry point; renders the entire month grid with day cells, events, and drag support
- [ ] _buildDayEvents(dayDate, monthDay, isDraggable) — Inner helper that populates a single day cell with its chit events (compress or scroll mode)
- [ ] _applyMonthCompressOverflow(monthGrid) — Post-layout pass that hides overflow events in compress mode and adds "...More..." links
- [ ] _showMonthDayOverflow(e, dayChits, dayDate) — Shows a popup overlay with all chits for a day when "...More..." is clicked
- [ ] getMonthStart(date) — Returns the first day of the month for a given date
- [ ] chitColor(chit) — Returns the display color for a chit (transparent → pale cream fallback)
- [ ] formatDate(date) — Formats a date as "Mon 5" style for day headers

### Month Mode Toggle (main-calendar.js)

- [ ] _initMonthModePill() — Initializes the Compress/Scroll pill toggle click handler
- [ ] _updateMonthModeToggle() — Updates the pill toggle UI to reflect the current mode (active class)
- [ ] _restoreMonthScrollToggle() — Restores the toggle state from localStorage on view render
- [ ] Variable: _monthViewMode — Stores current mode ('compress' or 'scroll'), persisted in localStorage key `cwoc_month_view_mode`

### Navigation (main-calendar.js)

- [ ] changePeriod() — Handles period-select dropdown change; shows/hides cal-options section for Month view
- [ ] goToToday() — Navigates to current month (sets currentWeekStart to getMonthStart(now))
- [ ] previousPeriod() — Moves back one month (currentWeekStart.setMonth - 1)
- [ ] nextPeriod() — Moves forward one month (currentWeekStart.setMonth + 1)
- [ ] updateDateRange() — Updates the year-display and week-range elements with "YYYY · Mon" for month view

### Date Helpers (shared-calendar.js)

- [ ] getCalendarDateInfo(chit) — Normalizes a chit's date info (start/end/allDay/isDueOnly/isPointInTime) for calendar display
- [ ] chitMatchesDay(chit, day) — Checks if a chit should appear on a given day (overlap test)

### Event Title & Tooltip (shared-calendar.js)

- [ ] calendarEventTitle(chit, isDueOnly, info, settings, context) — Builds the HTML title for a month event (icons, indicators, weather, owner badge, birthday chips)
- [ ] calendarEventTooltip(chit, info) — Builds the tooltip string with title, recurrence info, time, and owner attribution

### Month Drag — Move Between Days (shared-calendar.js)

- [ ] enableMonthDrag(monthGrid, onDrop) — Enables HTML5 drag-and-drop for moving chits between day cells in the month grid
- [ ] dragstart handler — Sets dragged chit ID, finds source day cell, identifies virtual recurring instances, sets opacity
- [ ] dragend handler — Resets opacity, clears drag state, calls _markDragJustEnded()
- [ ] dragover handler — Prevents default to allow drop, sets dropEffect to 'move'
- [ ] drop handler — Determines target day cell, handles recurring vs non-recurring chits, computes day diff, updates dates via PUT /api/chits/:id

### Recurring Event Drag Modal (shared-calendar.js)

- [ ] _showRecurringDragModal(parentId, dateStr, newTimes, virtualChit) — Shows modal after dragging a recurring instance with options: This instance / All in series / All following / Cancel
- [ ] "This instance only" button — Breaks off instance: creates standalone copy at new time, adds exception to parent
- [ ] "All in series" button — Shifts all instances by computing time delta, updates byDay for weekly recurrences
- [ ] "All following" button — Shifts parent dates and updates byDay for future instances
- [ ] "Cancel" button — Closes modal, refreshes display
- [ ] ESC key handler — Closes the recurring drag modal
- [ ] Overlay click-outside — Closes the modal

### Event Interaction (main-calendar.js)

- [ ] attachCalendarChitEvents(el, chit) — Attaches dblclick (edit), shift+click (quick edit), and contextmenu (right-click menu) to each month event
- [ ] openChitForEdit(chit) — Opens the chit editor; for virtual recurring instances opens the parent; for birthday entries opens contact editor
- [ ] Double-click on event — Opens chit in editor (Cmd/Ctrl+dblclick opens in new tab)
- [ ] Shift+click on event — Opens quick edit modal (disabled for viewer-role shared chits)
- [ ] Right-click / contextmenu on event — Shows chit context menu (_showChitContextMenu)
- [ ] Double-click on empty day cell — Creates a new all-day chit for that date (navigates to editor with start/end/allday=1 params)

### Shared Utility Functions Used by Month View

- [ ] applyChitColors(el, bgColor) — Sets background color and contrasting text color on an event element
- [ ] _markDragJustEnded() — Sets window._dragJustEnded flag to suppress post-drag click events
- [ ] storePreviousState() — Saves current tab/view state before navigating to editor
- [ ] _updateUrlHash() — Updates browser URL hash with current tab/view state
- [ ] showQuickEditModal(chit, onRefresh) — Shows the quick-edit modal for inline field editing
- [ ] _showChitContextMenu(e, chit, onRefresh) — Shows the right-click context menu for a chit
- [ ] _isViewerRole(chit) — Checks if a shared chit has viewer-only access (disables drag/edit)
- [ ] _isDeclinedByCurrentUser(chit) — Checks if current user declined a shared event (adds declined-chit class)
- [ ] expandRecurrence(chit, rangeStart, rangeEnd, currentTz) — Expands recurring chits into virtual instances for the visible date range
- [ ] _recurrenceAddException(parentId, exception) — Adds a recurrence exception via PATCH when breaking off an instance
- [ ] displayChits() — Master display function that routes to displayMonthView when currentView === 'Month'
- [ ] filterChits('Calendar') — Activates the Calendar tab (which then renders month view if period is Month)
- [ ] fetchChits() — Fetches all chits from API and triggers re-render

### Buttons & Controls (Sidebar — shared-sidebar.js)

- [ ] Button: "Today" (sidebar-today-btn) — Navigates to current month via goToToday()
- [ ] Button: "◄" (sidebar-prev-btn) — Goes to previous month via previousPeriod()
- [ ] Button: "►" (sidebar-next-btn) — Goes to next month via nextPeriod()
- [ ] Select: "Time Period" (period-select) — Dropdown with Month option; triggers changePeriod()
- [ ] Display: Year + Month label (year-display) — Shows "YYYY · Mon" for current month
- [ ] Display: Week range (week-range) — Empty/hidden in month view

### Controls (Calendar Options Section — sidebar)

- [ ] Section: "Options" (section-cal-options) — Collapsible sidebar section, visible only when Calendar tab + Month view
- [ ] Label/Toggle: "Options" header — Click to expand/collapse the options body (filter-arrow ▶/▼)
- [ ] Control: Month Mode Pill Toggle (month-mode-pill) — 2-value pill toggle: "Compress" / "Scroll"
- [ ] Input: Hidden input (month-mode-toggle) — Stores current mode value ('compress' or 'scroll')

### Hotkey Panel (index.html + main-hotkeys.js)

- [ ] Hotkey: "." then "M" — Opens period panel, selects Month view via _pickPeriod('Month')
- [ ] Hotkey: "Shift+M" then "M" — Mode submenu shortcut for Month period
- [ ] Panel option: "M — Month" in period panel — Clickable option that calls _pickPeriod('Month')

### Tab Control (index.html)

- [ ] Tab: Calendar tab — onclick="filterChits('Calendar')" with calendar.png icon and "Calendar" label

### Visual States & CSS Classes

- [ ] .month-view — Container class for the month view
- [ ] .month-compress — Added to month-view container when in compress mode
- [ ] .month-grid — CSS Grid container (7 columns) for the day cells
- [ ] .month-day-header — Day-of-week header cells (Sun, Mon, Tue, etc.) respecting _weekStartDay
- [ ] .month-day — Individual day cell with data-date attribute (YYYY-MM-DD)
- [ ] .month-day.today — Highlights today's cell
- [ ] .month-day.other-month — Faded style for prev/next month trailing/leading days
- [ ] .month-day.prev-month — Previous month's trailing days
- [ ] .month-day.next-month — Next month's leading days
- [ ] .day-number — The date number displayed in each cell
- [ ] .day-events — Container for events within a day cell
- [ ] .month-event — Individual event element in the month grid
- [ ] .month-event-compressed — Added in compress mode for single-line event display
- [ ] .month-event[draggable="true"] — Events in current month are draggable
- [ ] .month-event.point-in-time — Point-in-time event styling
- [ ] .month-event.completed-task — Completed task styling (opacity/strikethrough)
- [ ] .month-event.birthday-event — Birthday/anniversary entry styling (not draggable)
- [ ] .month-event.declined-chit — Declined shared event styling
- [ ] .month-more-link — The "...N more..." overflow link in compress mode
- [ ] .cwoc-month-overflow-overlay — Fixed overlay for the day overflow popup
- [ ] .cwoc-month-overflow-popup — The popup showing all events for a day

### Settings That Affect Month View

- [ ] _weekStartDay — Which day the week starts on (0=Sun, 1=Mon, etc.); controls grid column alignment
- [ ] visual_indicators settings — Controls which indicator icons appear on events (via _getAllIndicators)
- [ ] calendar_snap — Snap grid minutes (used in drag operations)
- [ ] _enabledPeriods — Array of enabled period options; Month must be included to appear in dropdown

### Data Flow

- [ ] Chits filtered by chitMatchesDay() for each day cell in the visible month range
- [ ] Recurring chits expanded via expandRecurrence() before being passed to displayMonthView
- [ ] Previous month trailing days and next month leading days also show matching chits
- [ ] Virtual recurring instances identified by _isVirtual flag and _parentId for drag handling
- [ ] Birthday/anniversary entries identified by _isBirthday flag with special chip rendering
- [ ] Shared calendar events show owner badge when from a different user
