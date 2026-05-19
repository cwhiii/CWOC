# Calendar — Itinerary

**Category:** Dashboard Views
**Item #:** 7
**Code Verified:** ✅
**User Verified:** ⬜

## Functions, Controls & Inputs

### Navigation & Period Controls
- [ ] `changePeriod()` — Period selector dropdown changes view mode; resets `_weekViewDayOffset`, sets `currentWeekStart` to today for Itinerary
- [ ] `goToToday()` — "Today" button resets `currentWeekStart` to today
- [ ] `previousPeriod()` — Left arrow navigates back 7 days in Itinerary mode
- [ ] `nextPeriod()` — Right arrow navigates forward 7 days in Itinerary mode
- [ ] `updateDateRange()` — Updates header with year/month and week range for Itinerary
- [ ] `_pickPeriod('Itinerary')` — Hotkey panel handler; sets view, updates dropdown, calls displayChits
- [ ] `_applyEnabledPeriods()` — Hides/disables periods not in `_enabledPeriods` array
- [ ] `_updateUrlHash()` — Persists current view/tab in URL hash
- [ ] `storePreviousState()` — Saves current tab/view before navigating to editor
- [ ] Button: "Today" (`#sidebar-today-btn`) — Navigates to today's date
- [ ] Button: "◄" (`#sidebar-prev-btn`) — Previous period (7 days back)
- [ ] Button: "►" (`#sidebar-next-btn`) — Next period (7 days forward)
- [ ] Control: Period select dropdown (`#period-select`) — User selects "Itinerary" option
- [ ] Control: Hotkey panel option — `onclick="_pickPeriod('Itinerary')"` with key "I"
- [ ] Start from today — `currentWeekStart = new Date()` when Itinerary selected

### Hotkey / Keyboard Shortcuts
- [ ] Hotkey: `.` then `I` — Opens period panel, selects Itinerary
- [ ] Hotkey: `Shift+M` then `I` — Mode submenu, selects Itinerary (Calendar tab)
- [ ] Hotkey panel (`#panel-period`) — Shows all period options with key labels
- [ ] Reference overlay — Shows "I" → Itinerary in the Period submenu

### Mobile Swipe Navigation
- [ ] Swipe left on `#chit-list` — Calls `nextPeriod()` (forward 7 days)
- [ ] Swipe right on `#chit-list` — Calls `previousPeriod()` (back 7 days)
- [ ] Swipe threshold — 60px minimum horizontal, must exceed vertical distance
- [ ] Edge zone exclusion — Swipes starting within 30px of left edge ignored
- [ ] Sidebar check — Swipe disabled when sidebar is open
- [ ] Calendar tab check — Swipe only active when `currentTab === 'Calendar'`
- [ ] Slide animation — Content slides out/in with CSS transform transition
- [ ] Header swipe left/right — Cycles through tabs (Calendar, Checklists, etc.)

### Date Display
- [ ] `formatDate(day)` — Day abbreviation + date number (e.g., "Mon 15")
- [ ] `formatWeekRange(start, end)` — Two-span HTML with start/end dates
- [ ] Year + month display (`#year-display`) — "2024 · Jan" format
- [ ] Week range display (`#week-range`) — Shows start and end date of 7-day window

### Itinerary Layout & Rendering
- [ ] `displayItineraryView(chitsToDisplay)` — Main itinerary render function
- [ ] Container element: `div.itinerary-view` — Scrollable, parchment background
- [ ] Parchment background — `url('/static/parchment.jpg') center/cover` + `#fdf6e3` fallback
- [ ] Day header — Large centered date (1.6em, bold, `#5a3618` brown, 12px top padding)
- [ ] Empty state — "Nothing on your plate today. 🎉" message (`.cwoc-empty` class)
- [ ] `_applyChitDisplayOptions()` — Post-render: fades past events, highlights overdue/blocked

### Three-Section Structure
- [ ] **On Deck** section (🔜) — All-day events today + tasks due today (no time) + habits due today
- [ ] **Chrono Anchored** section (⏰) — Timed events today that haven't ended yet
- [ ] **Soon** section (🗓️) — Tasks/habits due this week (not today)
- [ ] Section labels — 1.3em, bold, centered, flex with gap:6px, emoji + text
- [ ] Section icon class — `.habit-section-icon` span wrapping emoji
- [ ] Chrono section background tint — `rgba(140,90,30,0.2)` with border-radius:6px
- [ ] Chrono/Soon section top border — `4px solid #5a3618`
- [ ] On Deck section — No background tint, no top border
- [ ] All sections — `padding:8px; margin:12px 0; padding-bottom:16px`

### On Deck Section Logic
- [ ] All-day events today — `isAllDay && hasStart` where start ≤ todayEnd && end ≥ today
- [ ] Tasks due today (no specific time) — Due date is today, hour=0 and minute=0
- [ ] Habits due today — `daysLeft <= 1` in current recurrence cycle
- [ ] Habit card rendering — `_buildItineraryHabitCard(item, _viSettings, windowDays)`

### Chrono Anchored Section Logic
- [ ] Timed events today — Start ≤ todayEnd AND end ≥ today, not all-day
- [ ] Due-today with specific time — `dueHour > 0 || dueMin > 0`, due within today
- [ ] Sorted chronologically — `timedItems.sort(function(a, b) { return a.start - b.start; })`
- [ ] Past non-task events excluded — Events ended before `now` AND not a task → skipped
- [ ] Past tasks shown — Tasks past due still display with `isPast: true` flag
- [ ] `isPast` flag — Passed to `_buildItineraryEvent` for overdue styling

### Soon Section Logic
- [ ] Tasks due this week (not today) — Due between `todayEnd` and `weekEnd` (7 days)
- [ ] Habits due this week (not today) — `daysLeft > 1` in current cycle
- [ ] Sorted by due date — `soonItems.sort` by `dueDate` ascending
- [ ] Due date badge — "Due: Mon 15" span appended to `.details-column`
- [ ] Badge styling — `font-size:0.8em; color:#6b4e31; opacity:0.8; margin-left:8px`

### Event Card Rendering
- [ ] `_buildItineraryEvent(chit, _viSettings, opts)` — Builds individual event card
- [ ] Card element: `div.itinerary-event` — Flex row, 8px/10px padding, 5px border-radius, 4px/20px margin
- [ ] `applyChitColors(chitElement, bgColor)` — Sets background + contrast text color
- [ ] Default background — `#fdf6e3` if no color or transparent
- [ ] Overdue border — `2px solid` + `overdue_border_color` setting (default `#b22222`) for past tasks
- [ ] Type icon (leftmost span) — ☑️ for tasks, 🗓️ for events, 🎂/💍/🗓️ for birthdays
- [ ] Icon styling — `font-size:1em; flex-shrink:0; margin-right:6px`

### Status Dropdown (Tasks Only)
- [ ] `<select>` element — 5 options: ToDo, In Progress, Blocked, Complete, Rejected
- [ ] Select styling — `font-size:0.8em; width:90px; border:1px solid #c4a97d; background:#fffaf0`
- [ ] Status change handler — `PATCH /api/chits/{id}/fields` with `{ status: newStatus }`
- [ ] Virtual instance handling — Uses `chit._parentId` for virtual recurring instances
- [ ] Complete animation — Sets `opacity:0.4`, then calls `displayChits()` after 600ms timeout
- [ ] `e.stopPropagation()` — Prevents click from bubbling to card event handlers
- [ ] Non-task spacer — 90px inline-block spacer when no status dropdown (alignment)

### Time Column
- [ ] Time column element — `div.time-column`, 90px width, 0.85em font-size, flex-shrink:0
- [ ] All-day events — Empty time column (no text)
- [ ] Start/end events — "HH:MM - HH:MM" format using `formatTime()`
- [ ] Due-only events — "HH:MM" (just the due time)
- [ ] Point-in-time events — "📌 HH:MM"
- [ ] `formatTime(date)` — Respects 12h/24h setting (`_globalTimeFormat`)

### Title/Details Column
- [ ] Details column element — `div.details-column`, flex:1, bold 1.05em title
- [ ] Text overflow — `overflow:hidden; text-overflow:ellipsis; white-space:nowrap`
- [ ] Birthday rendering (non-Omni) — Uses `calendarEventTitle()` with person chip format
- [ ] Normal title — Bold span with `chit.title || '(Untitled)'`

### Extra Info Indicators
- [ ] Recurrence indicator (🔁) — Far right span, 0.8em, opacity:0.6, padding-left:8px
- [ ] Only shown when `chit.recurrence_rule.freq` exists
- [ ] `margin-left:auto` — Pushes to far right of flex row

### Habit Card Rendering
- [ ] `_buildItineraryHabitCard(item, _viSettings, windowDays)` — Builds habit card for itinerary
- [ ] Reuses `_renderHabitCards()` — Renders into temp container, extracts `.habit-card`
- [ ] Goal/success display — Progress toward habit goal
- [ ] Success rate calculation — `metCount / windowEntries.length * 100`
- [ ] Streak calculation — Consecutive periods meeting goal (counting backward)
- [ ] Window period — `habits_success_window` setting (default 30 days, or 'all')
- [ ] Habit icon (🎯) — Prepended to `.habit-header` as first child
- [ ] Urgency badge for Soon items — "(X days left)" span appended to header
- [ ] Urgency badge styling — `font-size:0.75em; color:#6b4e31; opacity:0.8; margin-left:8px`
- [ ] Fallback — If `_renderHabitCards` unavailable, falls back to `_buildItineraryEvent()`
- [ ] Virtual instance cleanup — Strips `_isVirtual`, `_parentId`, `_virtualDate`, `_isCompleted`, `_instanceNum`

### Habit Processing (Pre-render)
- [ ] `_evaluateHabitRollover(chit)` — Checks if habit period has rolled over
- [ ] `_persistHabitRollover(chit)` — Persists rollover state via API (background, non-blocking)
- [ ] `getCurrentPeriodDate(chit)` — Gets current period start date (YYYY-MM-DD)
- [ ] Cycle calculation — DAILY=1×interval, WEEKLY=7×interval, MONTHLY=30×interval, YEARLY=365×interval
- [ ] Skip completed habits — `success >= goal` excluded
- [ ] Skip future habits — `elapsed < 0` (period hasn't started yet) excluded
- [ ] `habits_success_window` setting — Controls window for success rate

### Chit Filtering Logic
- [ ] Skip completed chits — `status === 'Complete'` excluded from main processing
- [ ] Skip point-in-time-only chits — Has PIT but no start/due → excluded
- [ ] Skip email chits — `email_message_id` or `email_status` present → excluded
- [ ] Virtual instance handling — Only today's virtual instances (`_virtualDate === todayStr`) included
- [ ] Non-recurring past events skipped — Events entirely before today excluded
- [ ] Deduplication — `_seenChitIds` Set prevents duplicates (uses `_parentId + '_' + _virtualDate` for virtuals)
- [ ] Habit pre-seeding — Habit IDs added to `_seenChitIds` before main loop to prevent double-processing
- [ ] `_originalChits` source — Uses global `chits` array (pre-expansion) for habit processing

### Event Interactions
- [ ] `attachCalendarChitEvents(el, chit)` — Attaches all interaction handlers to event cards
- [ ] Double-click → `openChitForEdit(chit)` — Opens chit in editor page
- [ ] Cmd/Ctrl+double-click — Opens editor in new tab (`window.open`)
- [ ] Shift+click → `showQuickEditModal(chit, callback)` — Opens quick-edit modal
- [ ] Right-click → `_showChitContextMenu(e, chit, callback)` — Context menu
- [ ] `_isViewerRole(chit)` check — Blocks quick-edit and context menu for viewer-role shared chits
- [ ] `window._dragJustEnded` check — Suppresses click/dblclick after drag operations
- [ ] `openChitForEdit(chit)` — Navigates to `/editor?id={id}` (uses `_parentId` for virtuals)
- [ ] Birthday click → contact editor — Navigates to `/frontend/html/contact-editor.html?id={contact_id}`

### Current Time Bar
- [ ] `renderTimeBar("Itinerary")` — Renders horizontal "Now" line
- [ ] Bar element: `div.current-time-bar` — Full width, 2px height, `#4a2c2a` background
- [ ] "▶ Now (HH:MM)" label — Absolute positioned, 0.75em, bold, `#4a2c2a`
- [ ] Positioning logic — Inserted before first future `.day-separator` element
- [ ] Fallback — Appended to end if no future separator found
- [ ] Auto-update — Refreshes every 60 seconds via `setInterval`
- [ ] Initial delay — `setTimeout` of 60ms for layout computation, then syncs to minute boundary

### Omni View Integration
- [ ] `_omniViewActive` flag — Changes card layout order when in Omni View
- [ ] Omni View order: [icon][time][title][status]
- [ ] Default order: [icon][status/spacer][time][title]
- [ ] Birthday title cleanup in Omni — Strips 🎂/💍/🗓️ emoji from title text
- [ ] `.omni-contact-date` class — Applied to birthday events in Omni mode (instead of `.birthday-event`)

### API Interactions
- [ ] `PATCH /api/chits/{id}/fields` — Updates task status from dropdown
- [ ] `fetchChits()` — Full data refresh after status change
- [ ] `displayChits()` — Re-render after status change (fallback)

### Visual State & CSS Classes
- [ ] `.itinerary-event` — Base class for event cards
- [ ] `.completed-task` — Applied when `status === "Complete"`
- [ ] `.declined-chit` — Applied when `_isDeclinedByCurrentUser()` returns true
- [ ] `.point-in-time` — Applied when chit has only `point_in_time` date
- [ ] `.birthday-event` — Applied to birthday/anniversary entries (non-Omni)
- [ ] `.cwoc-empty` — Empty state container class
- [ ] `.itinerary-view` — Main view container class
- [ ] Past task overdue border — Configurable via `overdue_border_color` setting
- [ ] No drag & drop — Itinerary is a read-only agenda view (no `enableCalendarDrag`)
- [ ] No pinch-to-zoom — Not a time-grid view (no `enableCalendarPinchZoom`)
- [ ] No resize handles — Not applicable to list-style view

### Settings Dependencies
- [ ] `_enabledPeriods` array — Controls whether Itinerary appears in period dropdown
- [ ] `visual_indicators` settings — Passed to event title/card builders
- [ ] `overdue_border_color` setting — Color for past-due task borders
- [ ] `habits_success_window` setting — Window for habit success rate calculation
- [ ] `_globalTimeFormat` — 12h/24h time display format
- [ ] `_weekStartDay` — Not directly used by Itinerary (always starts from today)
