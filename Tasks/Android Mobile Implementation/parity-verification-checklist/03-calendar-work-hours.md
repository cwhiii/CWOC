# Calendar — Work Hours

**Category:** Dashboard Views
**Item #:** 3
**Code Verified:** ✅
**User Verified:** ⬜

## Functions, Buttons, Controls & Inputs

### Core Rendering Function
- [ ] `displayWorkView(chitsToDisplay)` — Entry point; delegates to `displayWeekView` with work-hour options
- [ ] `displayWeekView(chitsToDisplay, opts)` — Shared week/work renderer with `opts.hourStart`, `opts.hourEnd`, `opts.filterDays`, `opts.isWorkView`

### Navigation & Period Controls
- [ ] `changePeriod()` — Period selector dropdown changes view mode; sets `currentView = 'Work'`
- [ ] `goToToday()` — "Today" button navigates to current week (uses `getWeekStart(now)`)
- [ ] `previousPeriod()` — Left arrow navigates back 7 days (for Work view)
- [ ] `nextPeriod()` — Right arrow navigates forward 7 days (for Work view)
- [ ] `updateDateRange()` — Updates header with year · month and week range display
- [ ] `getWeekStart(date)` — Calculates week start based on `_weekStartDay` setting
- [ ] `_pickPeriod('Work')` — Hotkey handler to switch to Work Hours view
- [ ] `_applyEnabledPeriods()` — Hides/disables Work option if not in `_enabledPeriods`
- [ ] `_updateUrlHash()` — Persists current view in URL fragment
- [ ] Button: "Today" (`#sidebar-today-btn`) — Navigates to current week
- [ ] Button: "◄" (`#sidebar-prev-btn`) — Previous week
- [ ] Button: "►" (`#sidebar-next-btn`) — Next week
- [ ] Control: Period select dropdown (`#period-select`) — Option value "Work" labeled "Work Hours"
- [ ] Control: Hotkey panel option — `_pickPeriod('Work')` via key "K"

### Work Hours Configuration (Settings-Driven)
- [ ] `_workStartHour` — Start hour for work view (default: 8, loaded from `settings.work_start_hour`)
- [ ] `_workEndHour` — End hour for work view (default: 17, loaded from `settings.work_end_hour`)
- [ ] `_workDays` — Array of work day numbers (default: [1,2,3,4,5] = Mon–Fri, loaded from `settings.work_days`)
- [ ] `_enabledPeriods` — Array of enabled period names (loaded from `settings.enabled_periods`)
- [ ] Hour range filtering — Only shows hours between `_workStartHour` and `_workEndHour`
- [ ] Day filtering — Only shows columns for days in `_workDays` array
- [ ] `totalMinutes = (hourEnd - hourStart) * 60` — Grid height based on work hours only
- [ ] Empty state message — "No working days this week. Check Period Options in Settings."

### Date Display
- [ ] `formatDate(day)` — Renders day abbreviation + date number (e.g., "Mon 5")
- [ ] `formatWeekRange(start, end)` — Renders week range as two `<span>` elements
- [ ] `year-display` element (`#year-display`) — Shows "2024 · Jan" format
- [ ] `week-range` element (`#week-range`) — Shows start/end date span
- [ ] `year-week-container` (`#year-week-container`) — Container for date nav section

### Day Headers Row
- [ ] Header row (flex layout) — Shows only work-day headers (filtered by `_workDays`)
- [ ] Header spacer (60px) — Aligns with hour column; contains all-day toggle button
- [ ] Today highlight (`.day-header.today`) — Current day header gets special styling
- [ ] Responsive day paging — Prev/Next buttons when `_getResponsiveDayCount() < totalDays`
- [ ] `_weekViewDayOffset` — Tracks visible day subset offset
- [ ] `_getResponsiveDayCount()` — Returns number of days to show (always 7 currently)
- [ ] Button: "◀" (`.cal-day-nav-btn`) — Previous day(s) in responsive paging
- [ ] Button: "▶" (`.cal-day-nav-btn`) — Next day(s) in responsive paging

### All-Day Events Section
- [ ] All-day container — Collapsible section with border-bottom
- [ ] `renderAllDayEventsInCells(dayData, allDayEventsRow, settings, context)` — Multi-day spanning grid
- [ ] CSS Grid layout — `grid-template-columns: repeat(numDays, 1fr)` for work-day columns
- [ ] Multi-day event spanning — `gridColumn: startCol+1 / endCol+2`
- [ ] Row packing algorithm — Finds first row where columns are free
- [ ] Row visibility limit (MAX_VISIBLE = 6) — Hides excess rows
- [ ] "▼ N more" expand button (`.all-day-expand-btn`) — Shows hidden events
- [ ] "▲ Show less" shrink button — Collapses back
- [ ] Hide/Show toggle button ("☀ Hide" / "▲ Show") — In header spacer
- [ ] `_addAllDayHeightCap(eventsRow, container)` — 80px max-height cap with "▼ all" / "▲ less" toggle
- [ ] `enableAllDayDrag(allDayEventsRow, days)` — HTML5 drag between work-day cells
- [ ] All-day event drag (`draggable=true`) — dragstart, dragend, dragover, drop
- [ ] Birthday events non-draggable (`draggable=false`)
- [ ] Viewer-role drag prevention — `_isViewerRole(chit)` check on dragstart
- [ ] `getCalendarDateInfo(chit)` — Date normalization (due vs start/end vs point-in-time)
- [ ] `chitMatchesDay(chit, day)` — Determines if chit overlaps a given day
- [ ] `calendarEventTitle(chit, isDueOnly, info, settings, context)` — Title HTML with icons
- [ ] `calendarEventTooltip(chit, info)` — Tooltip string with time/recurrence info
- [ ] `chitColor(chit)` — Returns display color (default: `#fdf6e3`)
- [ ] `applyChitColors(el, color)` — Sets background + contrast text color
- [ ] Birthday/anniversary chip rendering — Person chip with image, emoji, label
- [ ] Point-in-time styling (`.point-in-time`) — Hexagonal clip-path
- [ ] Completed task styling (`.completed-task`) — Reduced opacity
- [ ] Declined chit styling (`.declined-chit`) — Visual distinction
- [ ] `attachCalendarChitEvents(ev, chit)` — Attaches interaction handlers to all-day events

### Scrollable Time Grid (Restricted Hours)
- [ ] Scroll container (`.week-view`) — `display:flex; flex:1; overflow-y:auto`
- [ ] Hour column (`.hour-column`) — 60px wide, shows only work hours (e.g., 8:00–16:00)
- [ ] Hour blocks (`.hour-block`) — Positioned at `(hour - hourStart) * 60` px
- [ ] Work-day columns only (`.day-column`) — Filtered by `_workDays` array
- [ ] Today column highlight (`.day-column.today`)
- [ ] Column borders — `border-left: 1px solid #d3d3d3`
- [ ] No auto-scroll to 6am — Work view skips `scrollToSixAM()` (isWorkView: true)

### Timed Events Rendering
- [ ] Timed event elements (`.timed-event`) — Absolutely positioned within day columns
- [ ] Hour range clamping — Events outside work hours are clipped/hidden
- [ ] `_rangeStartMin = hourStart * 60` — Visible range start
- [ ] `_rangeEndMin = hourEnd * 60` — Visible range end
- [ ] Events fully outside range skipped — `if (_absBottom <= _rangeStartMin || _absTop >= _rangeEndMin) return`
- [ ] Events partially in range clamped — `Math.max(_absTop, _rangeStartMin)` / `Math.min(_absBottom, _rangeEndMin)`
- [ ] Position calculation — `top = _absTop - _rangeStartMin`
- [ ] Minimum height enforcement — `if (_height < 30) _height = 30`
- [ ] Overlap calculation per day — Time slot occupancy tracking
- [ ] Per-event local overlap width — `95 / _localMax` percent
- [ ] Horizontal positioning — `left: pos * widthPct%`
- [ ] Time label display — "HH:MM - HH:MM" or "Due: HH:MM" or "📌 HH:MM"
- [ ] `formatTime(date)` — Respects 12h/24h setting (`_globalTimeFormat`)
- [ ] Due-only icon (⌚) — Prepended to title
- [ ] Recurrence icon (🔁 or 🎯) — For recurring/habit chits
- [ ] Pinned icon (bookmark) — For pinned chits
- [ ] Weather indicator icon — From localStorage cache
- [ ] Owner badge (👤) — For shared calendar events
- [ ] Timezone warning (⚠️) — For unresolved timezones
- [ ] Visual indicators — `_getAllIndicators(chit, settings, 'calendar-slot')`
- [ ] `dataset.chitId` — Stored on each event element

### Current Time Bar
- [ ] `renderTimeBar("Week")` — Renders red line at current time in today's column
- [ ] Time bar element (`.time-now-bar`) — Positioned at `minuteOfDay` px
- [ ] Auto-update interval — Updates every 60 seconds
- [ ] Only in today's column — Finds `.day-column.today`
- [ ] `_timeBarInterval` — Cleared and re-created on each render
- [ ] Initial delay (60ms) — Waits for layout before placing

### Event Interactions (via `attachCalendarChitEvents`)
- [ ] Double-click → `openChitForEdit(chit)` — Opens editor
- [ ] Cmd/Ctrl+double-click — Opens in new tab (`window.open`)
- [ ] Shift+click → `showQuickEditModal(chit, callback)` — Quick-edit modal
- [ ] Right-click (contextmenu) → `_showChitContextMenu(e, chit, callback)` — Context menu
- [ ] Long-press (touch) → Quick-edit via `longPressMap` + `enableTouchGesture`
- [ ] `_dragJustEnded` guard — Prevents click/dblclick after drag
- [ ] Viewer-role protection — Blocks quick-edit and context menu for viewer-role chits
- [ ] Birthday click → contact editor (`/frontend/html/contact-editor.html?id=`)
- [ ] `openChitForEdit(chit)` — Resolves virtual instance to parent ID
- [ ] `storePreviousState()` — Saves state before navigation

### Empty Slot Interaction
- [ ] `attachEmptySlotCreate(col, day, defaultDurationMin)` — Double-click on empty column space
- [ ] Snap-to-grid for new event — Uses `_calSnapMinutes`
- [ ] Default 60-minute duration
- [ ] Navigate to editor with pre-filled start/end times

### Drag & Drop (Move)
- [ ] `enableCalendarDrag(scrollContainer, dayColumns, days, chitsMap, longPressMap)` — Enables drag system
- [ ] Mouse drag (mousedown → mousemove → mouseup) — Vertical time change
- [ ] Mouse drag horizontal — Day column change (based on column width)
- [ ] Touch drag — Via `enableTouchGesture` (coordinated with long-press)
- [ ] Touch drag fallback — Via `enableTouchDrag` (when no long-press callback)
- [ ] `_calDragState` — Tracks drag state (el, chit, mode, startY, startX, origTop, etc.)
- [ ] `_onCalDragMove(e)` — Updates element position during drag
- [ ] `_onCalDragEnd(e)` — Saves changes via API
- [ ] Horizontal column detection — `Math.round(dx / colWidth)`
- [ ] Column re-parenting — `dayColumns[newColIdx].appendChild(el)`
- [ ] `_snapToGrid(minutes)` — Rounds to nearest snap interval
- [ ] `_calSnapMinutes` — Loaded from settings (default: 15)
- [ ] `_loadCalSnapSetting()` — Async load from `/api/settings/default_user`
- [ ] `_showSnapGrid(container)` — Visual grid overlay during drag
- [ ] `_hideSnapGrid()` — Removes grid overlay
- [ ] Opacity change (0.6) — Visual feedback during drag
- [ ] Z-index elevation (50) — Brings dragged element to front
- [ ] Duration preservation on move — End time shifts with start time
- [ ] `_markDragJustEnded()` — Sets `window._dragJustEnded = true` for 300ms
- [ ] Modifier key guard — Shift/Meta/Ctrl clicks don't start drag
- [ ] Viewer-role drag prevention — Skips drag setup for viewer-role chits
- [ ] Minimum top constraint — `if (newTop < 0) newTop = 0`
- [ ] Maximum top constraint — `if (newTop > 1440 - 15) newTop = 1440 - 15`

### Drag & Drop (Resize)
- [ ] Resize handle (`.cal-resize-handle`) — 6px div at bottom of event, `cursor: ns-resize`
- [ ] Mouse resize (mousedown on handle → mousemove → mouseup)
- [ ] Touch resize — Via `enableTouchDrag` with `immediate: true`
- [ ] Minimum height (15px) — `if (newHeight < 15) newHeight = 15`
- [ ] Resize only for start/end chits — Skipped for `isDueOnly` and `isPointInTime`
- [ ] Only changes end time — Start time preserved during resize
- [ ] Snap grid shown during resize

### Recurring Event Drag Modal
- [ ] `_showRecurringDragModal(parentId, dateStr, newTimes, virtualChit)` — Modal after dragging virtual instance
- [ ] Button: "✂️ This instance only" — Breaks off instance, adds exception
- [ ] Button: "🔁 All in series" — Shifts parent dates, adjusts byDay for weekly
- [ ] Button: "➡️🔁 All following" — Shifts parent dates for future instances
- [ ] Button: "Cancel" — Dismisses modal, refreshes view
- [ ] ESC key to dismiss — `document.addEventListener('keydown', onKey)`
- [ ] Click-outside to dismiss — `overlay.addEventListener('click', ...)`
- [ ] Weekly byDay adjustment — Replaces dragged day with target day in `recurrence_rule.byDay`
- [ ] Toast feedback — "Series moved: Monday → Wednesday" or "Series shifted +2 days"
- [ ] `_recurrenceAddException(parentId, exception)` — PATCH to add exception
- [ ] New standalone chit creation — `POST /api/chits` for "This instance only"
- [ ] `crypto.randomUUID()` — Generates ID for broken-off instance

### Pinch-to-Zoom
- [ ] `enableCalendarPinchZoom(scrollGrid)` — Enables vertical pinch zoom on touch
- [ ] `_calZoomScale` — Current zoom level (persists across re-renders)
- [ ] `_calZoomMin = 0.4` — Minimum zoom
- [ ] `_calZoomMax = 3.0` — Maximum zoom
- [ ] Two-finger vertical pinch detection — `touchstart` (2 touches), `touchmove`, `touchend`
- [ ] Vertical distance only — `Math.abs(t2.clientY - t1.clientY)`
- [ ] CSS `transform: scaleY()` on hour-column and day-columns
- [ ] Hour block counter-scale — `scaleY(1 / _calZoomScale)` keeps text readable
- [ ] Event counter-scale — `scaleY(1 / _calZoomScale)` keeps events readable
- [ ] `e.preventDefault()` on touchmove — Prevents scroll during pinch

### API Interactions
- [ ] `GET /api/chit/{id}` — Fetch full chit before drag save
- [ ] `PUT /api/chits/{id}` — Save updated date/time fields after drag
- [ ] `POST /api/chits` — Create standalone chit from recurring break-off
- [ ] `PATCH /api/chits/{id}/recurrence-exceptions` — Add exception for recurring
- [ ] `GET /api/settings/default_user` — Load work hours, snap, and period settings
- [ ] JSON field serialization — `health_data`, `weather_data` stringified before PUT

### Visual State & Styling
- [ ] `_applyChitDisplayOptions()` — Re-applies past-event fade after drag
- [ ] Completed task opacity (`.completed-task`)
- [ ] Declined chit styling (`.declined-chit`)
- [ ] Point-in-time hexagonal shape (`.point-in-time`)
- [ ] Viewer-role drag prevention — Skips drag/resize setup
- [ ] `_isViewerRole(chit)` — Checks `chit._shared && chit.effective_role === 'viewer'`
- [ ] `_isDeclinedByCurrentUser(chit)` — Checks RSVP decline status

### Hotkey Integration
- [ ] Key "K" in period panel — Switches to Work Hours view
- [ ] Shift+M → K — Mode submenu → Work Hours
- [ ] "." → K — Period submenu → Work Hours
- [ ] Period panel (`.hotkey-panel#panel-period`) — Shows Work Hours option
- [ ] Reference overlay — Documents "K" = Work Hours
