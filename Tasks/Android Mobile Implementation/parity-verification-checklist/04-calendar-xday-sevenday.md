# Calendar — X-Day / SevenDay

**Category:** Dashboard Views
**Item #:** 4
**Code Verified:** ✅
**User Verified:** ⬜

## Functions, Controls & Inputs

### Navigation & Period Controls
- [ ] `changePeriod()` — Period selector dropdown changes view mode; sets `currentWeekStart = new Date()` for SevenDay
- [ ] `goToToday()` — "Today" button sets start to today (not week-aligned)
- [ ] `previousPeriod()` — Left arrow navigates back by `_customDaysCount` days
- [ ] `nextPeriod()` — Right arrow navigates forward by `_customDaysCount` days
- [ ] `updateDateRange()` — Updates header with year, month, and date range for SevenDay
- [ ] `_pickPeriod('SevenDay')` — Hotkey handler: sets view, resets offset, starts from today
- [ ] `_applyEnabledPeriods()` — Enables/disables period options in dropdown and panels; renames "SevenDay" to "X Days" label
- [ ] `_openModePanel()` — Shift+M mode panel with Calendar period options (key X → SevenDay)
- [ ] `_updateUrlHash()` — Persists current view in URL hash
- [ ] `storePreviousState()` — Saves tab/view state before navigation

### Settings That Control X-Day View
- [ ] `_customDaysCount` — Configurable number of days to show (default: 7, loaded from `settings.custom_days_count`)
- [ ] `_enabledPeriods` — Array of enabled period names (controls visibility in dropdown/panels)
- [ ] `_allViewStartHour` — Start hour for time grid (default: 0, from `settings.all_view_start_hour`)
- [ ] `_allViewEndHour` — End hour for time grid (default: 24, from `settings.all_view_end_hour`)
- [ ] `_dayScrollToHour` — Hour to auto-scroll to on render (default: 5, from settings)
- [ ] `_calSnapMinutes` — Snap grid interval for drag (from `settings.calendar_snap`)
- [ ] `_calZoomScale` — Current pinch-zoom level (persists across re-renders)

### Key Difference from Week View
- [ ] Starts from current date (not week-aligned) — `currentWeekStart = new Date()` on selection
- [ ] Configurable day count — Shows `_customDaysCount` days (not fixed 7)
- [ ] Navigation steps by `_customDaysCount` — Not always 7

### Sidebar Controls (Dynamically Generated in shared-sidebar.js)
- [ ] Button: "Today" (`#sidebar-today-btn`) — Calls `goToToday()`
- [ ] Button: "◄" (`#sidebar-prev-btn`) — Calls `previousPeriod()`
- [ ] Button: "►" (`#sidebar-next-btn`) — Calls `nextPeriod()`
- [ ] Display: Year + Month (`#year-display`) — "2024 · Jan" format
- [ ] Display: Week range (`#week-range`) — Start/end date span
- [ ] Select: Period dropdown (`#period-select`) — Option value "SevenDay", label "X Days"

### Hotkey Panel (in index.html)
- [ ] Panel: `#panel-period` — Period selection hotkey panel
- [ ] Hotkey option: Key "X" → `_pickPeriod('SevenDay')` — Label shows `_customDaysCount + ' Days'`
- [ ] Keyboard shortcut: Shift+M then X — Selects SevenDay view

### Date Display
- [ ] `formatDate(day)` — Day abbreviation + date number for each column header
- [ ] `formatWeekRange(start, end)` — Range display in header (start span + end span)
- [ ] Year + month display (`#year-display`) — "2024 · Jan" format
- [ ] Week range display (`#week-range`) — Start/end date span

### Day Headers Row
- [ ] Header row (flex layout) — Shows N day headers
- [ ] Header spacer (60px) — Aligns with hour column
- [ ] Day header elements (`.day-header`) — One per visible day
- [ ] Today highlight (`.today` class) — Current day header gets special styling
- [ ] Responsive day paging — Prev/Next buttons when viewport shows fewer than total days
- [ ] `_getResponsiveDayCount()` — Returns visible column count (currently always 7)
- [ ] `_weekViewDayOffset` — Tracks visible subset offset for paging
- [ ] Button: Prev day(s) (`◀`, `.cal-day-nav-btn`) — Decrements offset, calls `displayChits()`
- [ ] Button: Next day(s) (`▶`, `.cal-day-nav-btn`) — Increments offset, calls `displayChits()`

### All-Day Events Section
- [ ] All-day container — Collapsible section with border-bottom
- [ ] `renderAllDayEventsInCells(dayData, allDayEventsRow, settings, context)` — Multi-day spanning grid render
- [ ] CSS Grid layout — `grid-template-columns: repeat(N, 1fr)` for spanning events
- [ ] Multi-day event spanning — `gridColumn: startCol+1 / endCol+2`
- [ ] Row packing algorithm — Finds first row where columns are free
- [ ] Row visibility limit (MAX_VISIBLE = 6) — Hides overflow rows
- [ ] Button: "▼ N more" expand — Shows hidden all-day events
- [ ] Button: "▲ Show less" shrink — Re-hides overflow events
- [ ] Button: Hide/Show toggle ("☀ Hide" / "▲ Show") — Collapses entire all-day section
- [ ] `_addAllDayHeightCap(eventsRow, container)` — 80px max-height cap with expand/collapse toggle
- [ ] Button: "▼ all" / "▲ less" — Height cap toggle within all-day row
- [ ] `enableAllDayDrag(allDayEventsRow, days)` — HTML5 drag between day cells
- [ ] All-day event drag (HTML5 draggable) — Move between days
- [ ] Birthday events non-draggable (`ev.draggable = false`)
- [ ] Viewer-role drag prevention (`_isViewerRole` check)
- [ ] All-day event elements (`.all-day-event`) — Styled with chit color
- [ ] `getCalendarDateInfo(chit)` — Date normalization (due/start/point-in-time logic)
- [ ] `chitMatchesDay(chit, day)` — Day filtering for event placement
- [ ] `calendarEventTitle(chit, isDueOnly, info, settings, context)` — Title HTML with icons
- [ ] `calendarEventTooltip(chit, info)` — Tooltip with time/recurrence info
- [ ] `chitColor(chit)` — Display color (transparent → pale cream fallback)
- [ ] `applyChitColors(el, color)` — Background + contrast text color
- [ ] Birthday/anniversary chip rendering (image + name + emoji + label)
- [ ] Point-in-time styling (`.point-in-time` class)
- [ ] Completed task styling (`.completed-task` class)
- [ ] Declined chit styling (`.declined-chit` class)

### Scrollable Time Grid
- [ ] `displaySevenDayView(chitsToDisplay, opts)` — Main render function for X-day view
- [ ] Wrapper div — Flex column, full height/width
- [ ] Scroll container (`.week-view`) — Flex layout, overflow-y auto
- [ ] Hour column (`.hour-column`) — Width 60px, height = totalMinutes px
- [ ] Hour blocks (`.hour-block`) — Positioned at `(hour - hourStart) * 60` px
- [ ] Hour labels — "0:00" through "23:00" (or configured range)
- [ ] N day columns (`.day-column`) — `flex:1`, min-height = totalMinutes px
- [ ] Today column highlight (`.today` class)
- [ ] Column borders (`border-left: 1px solid #d3d3d3`)
- [ ] `scrollToSixAM()` — Auto-scrolls to `_dayScrollToHour` (default 5am) after 50ms delay

### Timed Events Rendering
- [ ] Timed event elements (`.timed-event`) — Absolutely positioned by time
- [ ] Top position — `(startHour*60 + startMin) - rangeStartMin` px
- [ ] Height — `endMin - startMin` px (minimum 30px)
- [ ] Overlap calculation per day — Time-slot occupancy tracking
- [ ] Per-event local overlap width — `95% / maxConcurrent`
- [ ] Position offset — `left: pos * widthPct%`
- [ ] Width — `widthPct - 1%` with `box-sizing: border-box`
- [ ] Time label display — "HH:MM - HH:MM" / "Due: HH:MM" / "📌 HH:MM"
- [ ] `formatTime(date)` — Respects 12h/24h format setting
- [ ] Due-only icon (⌚) — In title for due-datetime-only chits
- [ ] Recurrence icon (🔁 or 🎯) — For recurring/habit chits
- [ ] Pinned icon (bookmark) — For pinned chits
- [ ] Weather indicator icon — Cached weather for location chits
- [ ] Owner badge (👤) — For shared calendar events from other users
- [ ] Timezone warning (⚠️) — For unresolved timezone chits
- [ ] Visual indicators (`_getAllIndicators`) — From settings
- [ ] `_viSettings` — Visual indicators settings from `window._cwocSettings`

### Current Time Bar
- [ ] `renderTimeBar("SevenDay")` — Renders "now" line in today's column
- [ ] Time bar element (`.time-now-bar`) — Positioned at current minute-of-day
- [ ] Auto-update interval — Updates every 60 seconds
- [ ] Only in today's column — Finds `.day-column.today`
- [ ] Initial placement after 60ms delay
- [ ] `_timeBarInterval` — Cleared on re-render

### Event Interactions
- [ ] `attachCalendarChitEvents(el, chit)` — Attaches all interaction handlers to event elements
- [ ] Double-click → `openChitForEdit(chit)` — Opens editor
- [ ] Cmd/Ctrl+double-click — Opens in new tab (`window.open`)
- [ ] Shift+click → `showQuickEditModal(chit, callback)` — Quick-edit modal
- [ ] Right-click → `_showChitContextMenu(e, chit, callback)` — Context menu
- [ ] Long-press (touch) → Quick-edit via `longPressMap` — Coordinated with drag system
- [ ] `enableTouchGesture(el, callbacks)` — Unified touch: drag + long-press coordination
- [ ] Viewer-role protection — `_isViewerRole(chit)` blocks quick-edit and context menu
- [ ] Birthday click → contact editor (`/frontend/html/contact-editor.html?id=`)
- [ ] `_dragJustEnded` check — Suppresses click/dblclick after drag
- [ ] `openChitForEdit(chit)` — Navigates to editor; uses `_parentId` for virtual instances

### Empty Slot Interaction
- [ ] `attachEmptySlotCreate(col, day, defaultDurationMin)` — Double-click on empty column space
- [ ] Snap-to-grid for new event — Uses `_calSnapMinutes`
- [ ] Default 60-minute duration
- [ ] Navigate to editor with pre-filled start/end times (`/editor?start=...&end=...`)
- [ ] Only triggers when `e.target === col` (not on events)

### Drag & Drop (Move)
- [ ] `enableCalendarDrag(scrollContainer, dayColumns, days, chitsMap, longPressMap)` — Enables drag system
- [ ] Mouse drag vertical — Changes event time (top position)
- [ ] Mouse drag horizontal — Changes day column (re-parents element)
- [ ] Touch drag — Via `enableTouchGesture` with `onDragStart/onDragMove/onDragEnd`
- [ ] `enableTouchDrag(el, callbacks)` — Fallback touch drag (no long-press)
- [ ] `_calDragState` — Tracks drag state (el, chit, mode, startY, startX, origTop, etc.)
- [ ] `_onCalDragMove(e)` — Updates position during drag
- [ ] `_onCalDragEnd(e)` — Saves via PUT API call
- [ ] Horizontal column detection — `Math.round(dx / colWidth)` for column shift
- [ ] Column re-parenting — `dayColumns[newColIdx].appendChild(el)`
- [ ] `_snapToGrid(minutes)` — Rounds to nearest snap interval
- [ ] `_calSnapMinutes` — From settings (default 15)
- [ ] `_loadCalSnapSetting()` — Async load from `/api/settings/default_user`
- [ ] `_showSnapGrid(container)` — Visual grid overlay during drag
- [ ] `_hideSnapGrid()` — Removes grid overlay
- [ ] Opacity change (0.6) — Visual feedback during drag
- [ ] Z-index elevation (50) — Brings dragged element to front
- [ ] Duration preservation on move — End = start + original duration
- [ ] `_markDragJustEnded()` — Suppresses post-drag click events (300ms flag)
- [ ] Minimum top (0px) / maximum top (1440 - 15 px) — Bounds checking
- [ ] Modifier key check — Shift/Meta/Ctrl blocks drag start

### Drag & Drop (Resize)
- [ ] Resize handle (`.cal-resize-handle`) — 6px bottom edge, `cursor: ns-resize`
- [ ] Mouse resize — `mousedown` on handle starts resize mode
- [ ] Touch resize — `enableTouchDrag` on handle with `immediate: true`
- [ ] Minimum height (15px) — Floor during resize
- [ ] Resize only for start/end chits — Skipped for `isDueOnly` and `isPointInTime`
- [ ] Only changes end time — Start time preserved during resize
- [ ] Viewer-role protection — Skips drag/resize for viewer-role shared chits

### Recurring Event Drag
- [ ] `_showRecurringDragModal(parentId, dateStr, newTimes, virtualChit)` — Modal after dragging virtual instance
- [ ] Button: "This instance only" (✂️) — Breaks off: creates standalone copy + adds exception
- [ ] Button: "All in series" (🔁) — Shifts parent dates by computed time delta
- [ ] Button: "All following" (➡️🔁) — Shifts parent dates for future instances
- [ ] Button: "Cancel" — Dismisses modal, refreshes view
- [ ] ESC to dismiss — `keydown` listener
- [ ] Click-outside to dismiss — Overlay click handler
- [ ] Weekly byDay adjustment — Replaces dragged day with target day in `recurrence_rule.byDay`
- [ ] Toast feedback — "Series moved: Monday → Wednesday" or "Series shifted +2 days"
- [ ] `_recurrenceAddException(parentId, exception)` — PATCH API to add exception
- [ ] `expandRecurrence(chit, rangeStart, rangeEnd)` — Generates virtual instances for display

### Pinch-to-Zoom
- [ ] `enableCalendarPinchZoom(scrollGrid)` — Vertical pinch zoom on scroll container
- [ ] `_calZoomScale` — Current scale (persists across re-renders, default 1.0)
- [ ] `_calZoomMin` (0.4) / `_calZoomMax` (3.0) — Zoom bounds
- [ ] Two-finger vertical pinch — `touchstart`/`touchmove`/`touchend` with 2 touches
- [ ] Vertical distance only — `Math.abs(t2.clientY - t1.clientY)`
- [ ] Hour column + day columns scale — `transform: scaleY(scale)`
- [ ] Hour block counter-scale — `scaleY(1/scale)` to keep text readable
- [ ] Event counter-scale — `scaleY(1/scale)` to keep text readable
- [ ] `transformOrigin: 'top left'` — Scales from top

### Mobile Swipe Navigation
- [ ] Swipe left on `#chit-list` → `nextPeriod()` — Advances by `_customDaysCount` days
- [ ] Swipe right on `#chit-list` → `previousPeriod()` — Goes back by `_customDaysCount` days
- [ ] Minimum swipe distance (60px) — Threshold for activation
- [ ] Horizontal > vertical check — Only triggers for horizontal swipes
- [ ] Edge zone exclusion (30px) — Ignores swipes starting at screen edge
- [ ] Sidebar-open check — Ignores swipes when sidebar is active
- [ ] Calendar-tab check — Only active when `currentTab === 'Calendar'`
- [ ] Slide-out animation (0.2s) — `translateX(-100%/100%)` transition
- [ ] Slide-in animation (0.25s) — New content slides in from opposite side
- [ ] Scroll position preservation — Saves/restores `scrollTop`

### API Interactions
- [ ] `GET /api/chit/{id}` — Fetch full chit before drag save
- [ ] `PUT /api/chits/{id}` — Save updated times after drag/resize
- [ ] `POST /api/chits` — Create standalone copy from recurring instance
- [ ] `PATCH /api/chits/{id}/recurrence-exceptions` — Add exception to recurring chit
- [ ] `GET /api/settings/default_user` — Load calendar settings (snap, days count, hours)
- [ ] JSON field serialization — `health_data`, `weather_data` stringified before PUT

### Visual State & Display Options
- [ ] `_applyChitDisplayOptions()` — Post-render: fade past events, highlight overdue/blocked
- [ ] Completed task opacity — Via `.completed-task` class
- [ ] Declined chit styling — Via `.declined-chit` class
- [ ] Point-in-time styling — Via `.point-in-time` class (hexagonal clip-path)
- [ ] Viewer-role drag prevention — `_isViewerRole(chit)` check
- [ ] `_isDeclinedByCurrentUser(chit)` — Checks if current user declined shared event
- [ ] `contrastColorForBg(color)` — Calculates readable text color for background

### Shared Dependencies (from shared-calendar.js)
- [ ] `getCalendarDateInfo(chit)` — Normalizes due/start/point-in-time into {start, end, isAllDay, isDueOnly, isPointInTime}
- [ ] `chitMatchesDay(chit, day)` — Checks if event overlaps a given day
- [ ] `calendarEventTitle(chit, isDueOnly, info, settings, context)` — Builds title HTML with all icons
- [ ] `calendarEventTooltip(chit, info)` — Builds tooltip string with time/recurrence info
- [ ] `enableCalendarDrag(...)` — Full drag system setup
- [ ] `enableAllDayDrag(allDayEventsRow, days)` — All-day event drag
- [ ] `renderAllDayEventsInCells(dayData, allDayEventsRow, settings, context)` — Grid-based all-day render
- [ ] `enableCalendarPinchZoom(scrollContainer)` — Pinch zoom setup
- [ ] `_loadCalSnapSetting()` — Loads snap interval from API
- [ ] `_snapToGrid(minutes)` — Snap calculation
- [ ] `_showSnapGrid(container)` / `_hideSnapGrid()` — Visual snap grid
- [ ] `_onCalDragMove(e)` / `_onCalDragEnd(e)` — Drag handlers
- [ ] `_showRecurringDragModal(...)` — Recurring drag confirmation modal
