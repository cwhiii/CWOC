# Calendar — Week

**Category:** Dashboard Views
**Item #:** 2
**Code Verified:** ✅
**User Verified:** ⬜

## Functions, Buttons, Controls & Inputs

### Core Week View Rendering

- [ ] displayWeekView(chitsToDisplay, opts) — Main week view renderer; builds header row, all-day row, and scrollable time grid with 7 day columns
- [ ] displayWorkView(chitsToDisplay) — Work Hours variant; calls displayWeekView with hourStart/hourEnd/filterDays from settings
- [ ] displaySevenDayView(chitsToDisplay, opts) — X-Day variant; same layout as week but starts from currentWeekStart with configurable day count

### Date Navigation & Helpers

- [ ] getWeekStart(date) — Calculates the start of the week based on _weekStartDay setting
- [ ] formatDate(date) — Formats date as "Mon 5" style for day column headers
- [ ] formatWeekRange(start, end) — Formats the week range display (e.g., "Jan Mon 5" to "Jan Sun 11")
- [ ] updateDateRange() — Updates the #year-display and #week-range elements with current period info
- [ ] goToToday() — Resets currentWeekStart to the current week and re-renders
- [ ] previousPeriod() — Moves currentWeekStart back 7 days for Week/Work views
- [ ] nextPeriod() — Moves currentWeekStart forward 7 days for Week/Work views
- [ ] changePeriod() — Handles period dropdown change; resets _weekViewDayOffset, updates URL hash, re-renders
- [ ] _updateUrlHash() — Updates browser URL hash with current tab/view state
- [ ] _getResponsiveDayCount() — Returns number of days to show (always 7 for week view)

### Calendar Date Info & Matching

- [ ] getCalendarDateInfo(chit) — Normalizes chit date info for calendar display (start, end, isAllDay, isDueOnly, isPointInTime)
- [ ] chitMatchesDay(chit, day) — Determines if a chit should appear on a given day (overlap check)
- [ ] chitColor(chit) — Returns display color for a chit (defaults to pale cream if transparent/null)

### Event Title & Tooltip Rendering

- [ ] calendarEventTitle(chit, isDueOnly, info, settings, context) — Builds HTML title for calendar events with icons (due ⌚, recurrence 🔁, habit 🎯, pinned 📌, weather, owner badge, birthday chip, timezone warning)
- [ ] calendarEventTooltip(chit, info) — Builds tooltip string with title, recurrence info, time range, and owner attribution

### Timed Event Rendering (within day columns)

- [ ] Overlap calculation — Calculates horizontal position/width for overlapping timed events using time-slot collision detection
- [ ] Time label rendering — Shows "HH:MM - HH:MM" or "Due: HH:MM" or "📌 HH:MM" below event title
- [ ] Event element creation — Creates .timed-event divs with absolute positioning (top=minutes, height=duration)
- [ ] applyChitColors(el, bgColor) — Applies background color and auto-contrasting text color to event elements
- [ ] Completed task styling — Adds .completed-task class for completed chits
- [ ] Declined chit styling — Adds .declined-chit class via _isDeclinedByCurrentUser()
- [ ] Point-in-time styling — Adds .point-in-time class for point-in-time events
- [ ] Viewer role check — _isViewerRole(chit) prevents drag/edit for viewer-role shared chits

### All-Day Events Row

- [ ] renderAllDayEventsInCells(dayData, allDayEventsRow, settings, context) — Renders all-day events in a CSS Grid spanning multiple day columns for multi-day events
- [ ] Row packing algorithm — Packs all-day events into rows to minimize vertical space (no overlapping spans)
- [ ] Multi-day event spanning — Events span grid columns from startCol to endCol
- [ ] Expand/shrink toggle (▼ N more / ▲ Show less) — Limits visible all-day rows to MAX_VISIBLE=6, shows expand button for overflow
- [ ] _addAllDayHeightCap(eventsRow, container) — Caps all-day section height at 80px with ▼ all / ▲ less toggle button
- [ ] All-day section collapse toggle (☀ Hide / ▲ Show) — Button in header spacer to hide/show entire all-day section

### Hour Column & Time Grid

- [ ] Hour column rendering — Creates .hour-column with hour labels (0:00–23:00 or custom range)
- [ ] Day column creation — Creates .day-column elements with flex:1 layout, today highlighting
- [ ] Total minutes calculation — (hourEnd - hourStart) * 60 determines grid height
- [ ] Today column highlighting — Adds .today class to current day's column

### Drag & Drop — Move Events

- [ ] enableCalendarDrag(scrollContainer, dayColumns, days, chitsMap, longPressMap) — Master function that wires up move and resize for all timed events
- [ ] Mouse move drag — mousedown on event (not on handle) initiates move; tracks startY, startX, origTop, origColIdx
- [ ] Touch move drag — enableTouchGesture or enableTouchDrag for mobile move support
- [ ] _onCalDragMove(e) — Handles mousemove during drag; updates top position (vertical) and column (horizontal)
- [ ] Horizontal column change detection — Calculates column shift from dx/colWidth during move
- [ ] Vertical position clamping — Clamps newTop between 0 and 1440-15
- [ ] _onCalDragEnd(e) — Handles mouseup; calculates new start/end times, saves via PUT /api/chits/:id
- [ ] Duration preservation on move — Maintains original duration when moving (only start changes)
- [ ] Day change on move — Detects when event is dragged to a different day column
- [ ] _markDragJustEnded() — Sets window._dragJustEnded flag to suppress click/dblclick after drag

### Drag & Drop — Resize Events

- [ ] Resize handle creation — Appends .cal-resize-handle div (6px tall, cursor:ns-resize) to bottom of non-due-only events
- [ ] Mouse resize — mousedown on handle initiates resize mode
- [ ] Touch resize — enableTouchDrag on handle with immediate:true option
- [ ] Resize height calculation — newHeight = origHeight + dy, snapped to grid, minimum 15px
- [ ] End time update on resize — Only changes end_datetime (start preserved)

### Drag — Snap Grid

- [ ] _loadCalSnapSetting() — Loads calendar_snap setting from API (default 15 min)
- [ ] _snapToGrid(minutes) — Rounds minutes to nearest _calSnapMinutes interval
- [ ] _showSnapGrid(container) — Shows visual snap grid overlay with time labels
- [ ] _hideSnapGrid() — Removes snap grid overlay
- [ ] _calSnapMinutes — Global snap interval (default 15, 0=1min resolution)

### Drag — Recurring Event Modal

- [ ] _showRecurringDragModal(parentId, dateStr, newTimes, virtualChit) — Modal for recurring instance drag with 4 options
- [ ] "This instance only" button (✂️) — Breaks off instance: creates standalone copy, adds exception to parent
- [ ] "All in series" button (🔁) — Shifts all instances by computing time delta; handles byDay replacement for WEEKLY
- [ ] "All following" button (➡️🔁) — Shifts parent dates for this and future instances (same logic as "All in series")
- [ ] "Cancel" button — Dismisses modal, re-fetches chits
- [ ] ESC key handler — Closes recurring drag modal
- [ ] Overlay click-outside — Closes recurring drag modal
- [ ] _recurrenceAddException(parentId, exception) — Adds exception to recurring chit via PATCH API

### Drag — All-Day Events

- [ ] enableAllDayDrag(allDayEventsRow, days) — Enables HTML5 drag-and-drop for all-day events between day cells
- [ ] dragstart handler — Sets opacity, stores chitId, prevents drag for viewer-role and birthday events
- [ ] dragend handler — Restores opacity, calls _markDragJustEnded
- [ ] dragover handler — Prevents default to allow drop
- [ ] drop handler — Calculates target day from mouse position, updates chit dates via PUT, handles recurring instances

### Pinch-to-Zoom

- [ ] enableCalendarPinchZoom(scrollContainer) — Enables vertical pinch-to-zoom on touch devices
- [ ] _calZoomScale — Current zoom level (default 1.0, range 0.4–3.0)
- [ ] touchstart handler — Detects 2-finger pinch start, records initial distance
- [ ] touchmove handler — Calculates zoom ratio from finger distance change, applies scaleY transform
- [ ] touchend handler — Ends pinch state when fingers lift
- [ ] _applyZoom(scale) — Applies CSS scaleY to hour-column and day-columns; counter-scales hour-blocks and timed-events for readability
- [ ] Zoom persistence — Maintains _calZoomScale across re-renders

### Event Interaction Handlers

- [ ] attachCalendarChitEvents(el, chit) — Attaches dblclick, shift+click, and contextmenu handlers to event elements
- [ ] Double-click → openChitForEdit(chit) — Opens chit in editor (navigates to /editor?id=...)
- [ ] Cmd/Ctrl+double-click — Opens chit in new tab (window.open)
- [ ] Shift+click → showQuickEditModal(chit, callback) — Opens quick-edit modal for inline field changes
- [ ] Right-click / contextmenu → _showChitContextMenu(e, chit, callback) — Shows context menu with actions
- [ ] Long-press (touch) → showQuickEditModal — Coordinated through longPressMap in enableCalendarDrag via enableTouchGesture
- [ ] Viewer role guard — Prevents quick-edit and context menu for viewer-role shared chits
- [ ] _dragJustEnded guard — Suppresses click/dblclick immediately after a drag operation

### Empty Slot Interaction

- [ ] attachEmptySlotCreate(col, day, defaultDurationMin) — Attaches dblclick on empty day column space
- [ ] Double-click on empty space — Creates new chit at clicked time (snapped); navigates to /editor?start=...&end=...
- [ ] Snap calculation for new event — Rounds clicked Y position to nearest _calSnapMinutes

### Time Bar (Current Time Indicator)

- [ ] renderTimeBar("Week") — Renders and maintains a red "now" line in today's column
- [ ] placeBar() — Positions .time-now-bar at current minute-of-day in .day-column.today
- [ ] Auto-update interval — Updates bar position every 60 seconds
- [ ] msUntilNextMinute calculation — Syncs updates to the start of each minute

### Scroll Position

- [ ] scrollToSixAM() — Scrolls time grid to configured _dayScrollToHour (default 5am) after render

### Display Options

- [ ] _applyChitDisplayOptions() — Re-applies fade for past events after drag position changes

### Hotkey Navigation

- [ ] _pickPeriod('Week') — Hotkey 'W' selects Week view from period panel
- [ ] _pickPeriod('Work') — Hotkey 'K' selects Work Hours view from period panel
- [ ] _applyEnabledPeriods() — Hides/disables period options not in _enabledPeriods setting

### Settings That Affect Week View

- [ ] _workStartHour — Work view start hour (default 8)
- [ ] _workEndHour — Work view end hour (default 17)
- [ ] _workDays — Array of day numbers for work view (default [1,2,3,4,5])
- [ ] _enabledPeriods — Array of enabled period names (controls which views are available)
- [ ] _customDaysCount — Number of days for X-Day view (default 7)
- [ ] _allViewStartHour — Start hour for all time views (default 0)
- [ ] _allViewEndHour — End hour for all time views (default 24)
- [ ] _dayScrollToHour — Hour to scroll to on view load (default 5)
- [ ] _weekStartDay — First day of week (0=Sun, 1=Mon, etc.)
- [ ] _calSnapMinutes — Snap grid interval for drag operations (default 15)
- [ ] _globalTimeFormat — Time display format ('24hour' or '12hour')
- [ ] visual_indicators settings — Controls which indicator icons appear on events

## Sidebar Controls (Calendar Tab)

- [ ] Button: "Today" (#sidebar-today-btn) — Jumps to current week
- [ ] Button: "◄" (#sidebar-prev-btn) — Navigate to previous week
- [ ] Button: "►" (#sidebar-next-btn) — Navigate to next week
- [ ] Select: "Time Period" (#period-select) — Dropdown with Itinerary/Day/Work Hours/Week/SevenDay/Month/Year options
- [ ] Display: Year & Month (#year-display) — Shows "2025 · Jan" style year/month label
- [ ] Display: Week Range (#week-range) — Shows "Jan Mon 5" to "Jan Sun 11" date range

## Hotkey Panel Controls

- [ ] Hotkey Panel: "📅 Period" (#panel-period) — Submenu with period selection options
- [ ] Hotkey: 'W' — Selects Week view
- [ ] Hotkey: 'K' — Selects Work Hours view
- [ ] Hotkey: 'X' — Selects X Days view
- [ ] Hotkey: '.' — Opens period submenu panel

## Responsive Day Navigation (when viewport shows fewer than 7 days)

- [ ] Button: "◀" (.cal-day-nav-btn prev) — Shows previous day(s) within the week
- [ ] Button: "▶" (.cal-day-nav-btn next) — Shows next day(s) within the week
- [ ] _weekViewDayOffset — Tracks which slice of days is currently visible

## Touch Gestures

- [ ] enableTouchDrag — Touch adapter for drag interactions (move and resize)
- [ ] enableTouchGesture — Unified gesture handler coordinating drag + long-press without conflicts
- [ ] Drag hold threshold — Distinguishes tap from drag intent
- [ ] Long-press threshold — Triggers quick-edit modal on sustained touch without movement
