# Calendar — Day

**Category:** Dashboard Views
**Item #:** 1
**Code Verified:** ✅
**User Verified:** ⬜

## Functions, Buttons, Controls & Inputs

### Core Day View Rendering

- [ ] `displayDayView(chitsToDisplay, opts)` — Main function that renders the entire Day view (header, all-day row, scrollable time grid with events)
- [ ] `chitMatchesDay(chit, day)` — Determines if a chit should appear on the given day (overlap check between event span and day boundaries)
- [ ] `getCalendarDateInfo(chit)` — Normalizes a chit's date info for calendar display (returns start, end, isAllDay, isDueOnly, isPointInTime, hasDate)
- [ ] `chitColor(chit)` — Returns the display color for a chit (transparent/null → pale cream `#fdf6e3`)
- [ ] `calendarEventTitle(chit, isDueOnly, info, settings, context)` — Builds the title HTML for a calendar event (icons, indicators, weather, owner badge, birthday chips, recurrence, pinned)
- [ ] `calendarEventTooltip(chit, info)` — Builds a tooltip string for a calendar event (title, recurrence info, time range, owner attribution)
- [ ] `formatDate(date)` — Dashboard-specific date formatter including day-of-week for calendar headers (e.g., "Mon 15")
- [ ] `formatTime(date)` — Formats a Date object to locale time string (respects 12h/24h setting)
- [ ] `applyChitColors(el, bgColor)` — Applies background color and auto-contrasting text color to an element
- [ ] `renderTimeBar("Day")` — Renders and maintains a "current time" red bar in the day view (updates every minute, only shows if viewing today)
- [ ] `scrollToSixAM()` — Scrolls the time-based view to the configured "scroll to" hour (default 5am via `_dayScrollToHour`)

### Day View Layout Structure

- [ ] Day header row — Shows formatted date with "today" highlight class
- [ ] All-day events row — Renders all-day chits in a horizontal bar with parchment background (`#e8dcc8`)
- [ ] Scrollable time grid — Flex container with hour column (80px) + events container (flex:1)
- [ ] Hour column — Renders hour labels from `hourStart` to `hourEnd` (default 0–24), each at 60px intervals
- [ ] Events container — Absolutely-positioned timed events with overlap calculation (position, width percentage)
- [ ] Overlap calculation — Time-slot-based algorithm that determines horizontal position and width for overlapping events

### Navigation Controls

- [ ] Button: "Today" (`#sidebar-today-btn`) — Navigates to today's date via `goToToday()`
- [ ] Button: "◄" (`#sidebar-prev-btn`) — Navigates to previous day via `previousPeriod()`
- [ ] Button: "►" (`#sidebar-next-btn`) — Navigates to next day via `nextPeriod()`
- [ ] `goToToday()` — Sets `currentWeekStart` to today and re-renders
- [ ] `previousPeriod()` — Decrements `currentWeekStart` by 1 day (for Day view) and re-renders
- [ ] `nextPeriod()` — Increments `currentWeekStart` by 1 day (for Day view) and re-renders
- [ ] `updateDateRange()` — Updates the year/month display and date range text in the sidebar header (Day view shows: "YYYY · Mon" + "Day DD")
- [ ] `changePeriod()` — Reads the period-select dropdown value and switches to the selected view
- [ ] `_updateUrlHash()` — Persists current tab/view/mode in the URL hash for bookmarking/back-button

### Period Select Dropdown

- [ ] Control: Period select dropdown (`#period-select`) — User selects "Day" to enter day view
- [ ] Options: Itinerary, Day, Work Hours, Week, X Days, Month, Year
- [ ] `_applyEnabledPeriods()` — Shows/hides period options based on settings (`_enabledPeriods` array)

### Date Display

- [ ] Display: Year + Month (`#year-display`) — Shows "YYYY · Mon" for the current day
- [ ] Display: Date range (`#week-range`) — Shows formatted day (e.g., "Mon 15") for Day view

### Drag Interactions — Move (Timed Events)

- [ ] `enableCalendarDrag(scrollContainer, dayColumns, days, chitsMap, longPressMap)` — Master function that wires up drag-move and drag-resize for all timed events
- [ ] Mouse drag-move — `mousedown` on event body (not resize handle) starts move; `mousemove` updates position; `mouseup` saves
- [ ] Touch drag-move — Uses `enableTouchGesture()` (when longPressMap exists) or `enableTouchDrag()` for coordinated drag + long-press
- [ ] `_onCalDragMove(e)` — Handles real-time position update during drag (snaps to grid, clamps to bounds)
- [ ] `_onCalDragEnd(e)` — Finalizes drag: calculates new time from pixel position, PUTs updated chit to API
- [ ] `_calDragState` — State object tracking: el, chit, mode, startY, startX, origTop, origHeight, origColIdx, dayColumns, days, hasMoved
- [ ] `_snapToGrid(minutes)` — Snaps a minute value to the nearest grid interval (`_calSnapMinutes`)
- [ ] `_loadCalSnapSetting()` — Loads the snap interval from user settings (`calendar_snap`)
- [ ] `_showSnapGrid(container)` — Shows a visual snap grid overlay during drag (lines at each snap interval + time labels)
- [ ] `_hideSnapGrid()` — Removes the snap grid overlay
- [ ] `_markDragJustEnded()` — Sets `window._dragJustEnded = true` to suppress post-drag click/dblclick events
- [ ] Opacity feedback — Event becomes 60% opacity during drag, z-index raised to 50
- [ ] Duration preservation on move — When moving (not resizing), the original duration is preserved

### Drag Interactions — Resize (Timed Events)

- [ ] Resize handle — A 6px-tall `div.cal-resize-handle` appended to the bottom of each start/end event (not due-only or point-in-time)
- [ ] Mouse resize — `mousedown` on handle starts resize; `mousemove` adjusts height; `mouseup` saves new end time
- [ ] Touch resize — Uses `enableTouchDrag()` with `immediate: true` on the resize handle
- [ ] Minimum height — Resize enforces minimum 15px (15 minutes) height
- [ ] End-time-only update — Resize only changes `end_datetime`, not start

### Drag Interactions — Recurring Events

- [ ] `_showRecurringDragModal(parentId, dateStr, newTimes, virtualChit)` — Modal shown after dragging a recurring instance
- [ ] Button: "✂️ This instance only" — Breaks off the instance: creates standalone copy at new time, adds exception to parent
- [ ] Button: "🔁 All in series" — Shifts the entire series (updates parent's dates, handles byDay for weekly recurrence)
- [ ] Button: "➡️🔁 All following" — Shifts all future instances (same logic as "All in series" but scoped)
- [ ] Button: "Cancel" — Dismisses modal, reverts visual position by re-fetching chits
- [ ] `_recurrenceAddException(parentId, exception)` — API call to add a recurrence exception via PATCH
- [ ] ESC key handler — Closes the recurring drag modal
- [ ] Click-outside handler — Closes the recurring drag modal

### Event Interactions

- [ ] `attachCalendarChitEvents(el, chit)` — Attaches dblclick, shift+click, and contextmenu handlers to each event element
- [ ] Double-click on event — Opens chit in editor via `openChitForEdit(chit)` (Cmd/Ctrl+dblclick opens in new tab)
- [ ] Shift+click on event — Opens quick-edit modal via `showQuickEditModal(chit, callback)` (disabled for viewer-role)
- [ ] Right-click (contextmenu) on event — Opens context menu via `_showChitContextMenu(e, chit, callback)` (disabled for viewer-role)
- [ ] Long-press on event (touch) — Opens quick-edit modal (coordinated with drag via `longPressMap`)
- [ ] `openChitForEdit(chit)` — Navigates to `/editor?id=...` (for virtual recurring instances, opens parent; for birthday entries, opens contact editor)
- [ ] `_isViewerRole(chit)` — Check that prevents drag/resize/quick-edit for viewer-role shared chits
- [ ] `_isDeclinedByCurrentUser(chit)` — Adds "declined-chit" CSS class for declined shared events

### Empty Slot Interactions

- [ ] `attachEmptySlotCreate(col, day, defaultDurationMin)` — Attaches dblclick handler to the events container for creating new chits
- [ ] Double-click on empty space — Creates a new chit at the clicked time (snaps to grid, navigates to editor with pre-filled start/end)

### Pinch-to-Zoom

- [ ] `enableCalendarPinchZoom(scrollContainer)` — Enables 2-finger pinch gesture for vertical zoom on touch devices
- [ ] `_calZoomScale` — Current zoom level (default 1.0, range 0.4–3.0)
- [ ] `_applyZoom(scale)` — Applies CSS `scaleY()` transform to hour column + day columns; counter-scales hour labels and event text for readability
- [ ] `touchstart` (2 fingers) — Records initial pinch distance and scale
- [ ] `touchmove` (2 fingers) — Calculates ratio and applies zoom in real-time
- [ ] `touchend` — Ends pinch state when fewer than 2 fingers remain
- [ ] Zoom persistence — Current zoom level persists across re-renders within the session

### Visual Indicators & Styling

- [ ] Today highlight — Day header gets `.today` class when viewing today
- [ ] Completed task styling — Events with `status === "Complete"` get `.completed-task` class
- [ ] Declined chit styling — Declined shared events get `.declined-chit` class
- [ ] Point-in-time styling — PIT events get `.point-in-time` class + 📌 prefix in time label
- [ ] Due-only indicator — Due-date events show ⌚ icon and "Due: HH:MM" time label
- [ ] Birthday chip rendering — Birthday/anniversary entries render as person chips with thumbnail, emoji, and label
- [ ] Recurrence icon — Shows 🔁 (or 🎯 for habits) for recurring events
- [ ] Pinned icon — Shows bookmark icon for pinned chits
- [ ] Weather icon — Shows cached weather icon for chits with location
- [ ] Owner badge — Shows "👤 Name" for shared calendar events from other users
- [ ] Timezone warning — Shows ⚠️ for chits with unresolved timezone
- [ ] `_applyChitDisplayOptions()` — Post-render: applies fade for past events, highlight for overdue/blocked
- [ ] Time label format — Shows "HH:MM - HH:MM" for start/end events, "Due: HH:MM" for due-only, "📌 HH:MM" for point-in-time

### Settings That Affect Day View

- [ ] `_calSnapMinutes` — Snap grid interval (from `calendar_snap` setting, default 15)
- [ ] `_dayScrollToHour` — Hour to scroll to on load (default 5)
- [ ] `_allViewStartHour` — First visible hour (default 0)
- [ ] `_allViewEndHour` — Last visible hour (default 24)
- [ ] `_globalTimeFormat` — Time display format: '24hour', '12hour', or '12houranalog'
- [ ] `visual_indicators` settings — Controls which indicator icons appear on events

### State Management

- [ ] `currentView` — Global: current calendar period ("Day")
- [ ] `currentWeekStart` — Global: the date being viewed (for Day view, this IS the day)
- [ ] `currentTab` — Global: must be "Calendar" for day view to render
- [ ] `storePreviousState()` — Saves current tab/view before navigating away (for back-navigation)
- [ ] `fetchChits()` — Fetches all chits from API and triggers `displayChits()`
- [ ] `displayChits()` — Master render dispatcher that calls `displayDayView()` when `currentView === "Day"`

### Weather Navigation Intent

- [ ] `_checkWeatherNavIntent()` — Checks sessionStorage for weather page → day view navigation intent
- [ ] `_executeWeatherFlash()` — After rendering, flashes chits at a specific location (from weather page deep-link)
- [ ] `_flashChitsAtLocation(location)` — Visually flashes (gold highlight) chits matching a location string

### Keyboard Shortcuts (from main-hotkeys.js)

- [ ] Hotkey: `D` (in Shift+M mode) — Switches to Day view
- [ ] Hotkey: `←` / `→` — Previous/next period (previous/next day in Day view)
- [ ] Hotkey: `T` — Go to today
- [ ] Hotkey: `Shift+Click` on event — Quick edit modal
- [ ] Hotkey: `Ctrl/Cmd+DblClick` on event — Open in new tab

### Tab Control

- [ ] Tab: Calendar (`filterChits('Calendar')`) — Activates the Calendar tab which enables period views including Day
- [ ] Tab icon: calendar.png with label "Calendar" (underlined C for hotkey hint)
