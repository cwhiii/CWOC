# Kiosk

**Category:** Standalone Pages
**Item #:** 53
**Code Verified:** ⬜
**User Verified:** ⬜

## Functions, Buttons, Controls & Inputs

### State Variables
- [ ] REFRESH_INTERVAL_MS — 60000ms auto-refresh interval
- [ ] _refreshTimer — setInterval timer reference
- [ ] _allChits — all chits fetched from kiosk API
- [ ] _currentPeriod — 'day' / 'week' / 'month' (default: 'week')
- [ ] _periodAnchor — anchor date for period navigation
- [ ] _weekStartDay — 0=Sun, 1=Mon, etc. (loaded from settings)
- [ ] _activeTags — tags to filter kiosk content

### Period Selector Bar (#wall-period-bar)
- [ ] Day button — sets period to 'day' (onclick → _setPeriod('day'))
- [ ] Week button — sets period to 'week' (onclick → _setPeriod('week'))
- [ ] Month button — sets period to 'month' (onclick → _setPeriod('month'))
- [ ] 📍 Today button — resets anchor to today (onclick → _goToday)
- [ ] ◄ Previous button — navigates back one period (onclick → _navPeriod(-1))
- [ ] Period label — displays current period range
- [ ] ► Next button — navigates forward one period (onclick → _navPeriod(1))

### Content Layout
- [ ] Two-column grid (.wall-columns) — Calendar left, Tasks right
- [ ] Calendar section header (📅 Calendar)
- [ ] Tasks section header (📋 Tasks)
- [ ] Single column on mobile (<768px)

### Calendar Section
- [ ] Day groups with date labels
- [ ] Today highlighting (📌 Today prefix, gold border)
- [ ] Event cards with:
  - [ ] Time display (12-hour format)
  - [ ] Title
  - [ ] Owner name (👤)
  - [ ] Color-coded background from chit color
  - [ ] Click → navigates to editor with kiosk return URL

### Tasks Section
- [ ] Active tasks (excludes Complete and Rejected)
- [ ] Sorted by: In Progress → Blocked → ToDo, then by due date
- [ ] Task cards with:
  - [ ] Status icon (⭕ ToDo, 🔄 In Progress, 🚫 Blocked, ✅ Complete, ✖️ Rejected)
  - [ ] Title
  - [ ] Due date (📅)
  - [ ] Owner name (👤)
  - [ ] Color-coded background from chit color
  - [ ] Click → navigates to editor with kiosk return URL

### Tag Legend (#wall-tag-legend)
- [ ] Displays active filter tags as chips (🏷️ prefix)
- [ ] Hidden when no tags

### Footer
- [ ] Last updated timestamp (#wall-last-updated)
- [ ] Version display (#cwoc-footer-version)
- [ ] Copyright with link

### Functions — Query Params
- [ ] _getTags() — reads ?tags= URL parameter, splits by comma

### Functions — Helpers
- [ ] _esc(str) — HTML entity escaping
- [ ] _fmtDate(d) — formats as "Day, Mon DD"
- [ ] _fmtTime(dateStr) — formats as "H:MM AM/PM"
- [ ] _dateKey(d) — formats as "YYYY-MM-DD"
- [ ] _todayKey() — today's date key
- [ ] _chitDate(c) — returns start_datetime or due_datetime or end_datetime
- [ ] _isCalendarEvent(c) — checks if chit has a date
- [ ] _isTask(c) — checks if chit has a task status
- [ ] _statusIcon(status) — returns Font Awesome icon HTML for status

### Functions — Color
- [ ] _chitColor(chit) — returns chit color or default
- [ ] _isLight(hex) — determines if color is light (for text contrast)
- [ ] _colorStyle(chit) — returns inline style string with background + text color

### Functions — Period Navigation
- [ ] _getPeriodRange() — computes start/end dates for current period + anchor
- [ ] _getPeriodLabel() — formats period range as human-readable string
- [ ] _navPeriod(dir) — moves anchor forward/back by one period unit
- [ ] _setPeriod(p) — changes period type, re-renders
- [ ] _goToday() — resets anchor to today, re-renders

### Functions — Rendering
- [ ] _buildPeriodBar() — builds period selector buttons and navigation
- [ ] _renderCalendar(chits) — renders calendar events grouped by day within period range
- [ ] _renderTasks(chits) — renders active tasks sorted by status priority
- [ ] _renderTagLegend(tags) — renders tag chips at bottom
- [ ] _wireClickHandlers() — attaches click handlers to chit cards for navigation
- [ ] _renderView() — orchestrates full view render from cached chits

### Functions — Data Fetching
- [ ] _fetchAndRender() — fetches /api/kiosk?tags=..., stores chits, renders view, updates timestamp

### Functions — Initialization
- [ ] _init() — fetches version, fetches /api/kiosk/config for week_start_day and fallback tags, starts auto-refresh timer

### Auto-Refresh
- [ ] 60-second interval auto-refresh of kiosk data
- [ ] "Last updated" timestamp display

### URL Parameters
- [ ] ?tags=tag1,tag2 — filters kiosk to specific tags
- [ ] Falls back to saved kiosk config tags if no URL tags
- [ ] Updates URL via history.replaceState when using config tags

### Navigation
- [ ] Clicking any event/task card → opens editor with ?from= parameter for return navigation
- [ ] Logo link → dashboard
