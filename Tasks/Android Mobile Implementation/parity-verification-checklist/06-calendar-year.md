# Calendar — Year

**Category:** Dashboard Views
**Item #:** 6
**Code Verified:** ✅
**User Verified:** ⬜

## Functions, Buttons, Controls & Inputs

### Core Rendering

- [ ] displayYearView(chitsToDisplay) — Renders the full year view with 12 month mini-calendars in a flex-wrap grid layout
- [ ] Year view layout — Flex-wrap container (`year-view` class) with `#fff5e6` background, 12 month blocks each 25% min-width
- [ ] Month block rendering — Each month gets a header ("Jan 2025"), a 7-column CSS grid of day cells, and leading empty cells for day-of-week alignment
- [ ] Day cell chit counting — Filters chitsToDisplay for each day using `start_datetime_obj` and `_due_datetime_obj` matching
- [ ] Day cell heat-map coloring — 0 chits: `#fff5e6`, 1 chit: `#e6d5b8`, 2+ chits: `#D68A59`
- [ ] Today highlighting — Day cell gets `.today` class (dark brown background `#4a2c2a`, light text `#fdf5e6`, bold, rounded)

### Navigation Functions (shared across all calendar periods, including Year)

- [ ] getYearStart(date) — Returns January 1 of the given date's year (sets month=0, day=1, time=00:00:00)
- [ ] previousPeriod() — When currentView === "Year", decrements year by 1 via `setFullYear(getFullYear() - 1)`
- [ ] nextPeriod() — When currentView === "Year", increments year by 1 via `setFullYear(getFullYear() + 1)`
- [ ] goToToday() — When currentView === "Year", sets `currentWeekStart = getYearStart(now)`
- [ ] updateDateRange() — When currentView === "Year", sets `year-display` to just the year number, clears `week-range`
- [ ] changePeriod() — Reads `period-select` dropdown value, sets `currentView`, calls `updateDateRange()` + `displayChits()`
- [ ] _updateUrlHash() — Sets URL hash to `#calendar/year` when Year view is active (enables bookmarking/deep-linking)
- [ ] _parseUrlHash() — Restores Year view from `#calendar/year` URL hash on page load

### Hotkey / Keyboard Navigation

- [ ] _pickPeriod('Year') — Switches to Year view via hotkey panel; sets `currentView = 'Year'`, updates period-select dropdown, calls `updateDateRange()` + `displayChits()` + `_exitHotkeyMode()`
- [ ] Hotkey: `.` then `Y` — Opens period panel then selects Year (keyboard shortcut sequence)
- [ ] _applyEnabledPeriods() — Shows/hides "Year" option in period dropdown and hotkey panel based on `enabled_periods` setting

### Buttons & Controls

- [ ] Button: "Today" (`#sidebar-today-btn`) — Navigates to current year (calls `goToToday()`)
- [ ] Button: "◄" Previous (`#sidebar-prev-btn`) — Goes to previous year (calls `previousPeriod()`)
- [ ] Button: "►" Next (`#sidebar-next-btn`) — Goes to next year (calls `nextPeriod()`)
- [ ] Control: Period Select dropdown (`#period-select`) — `<select>` with `<option value="Year">Year</option>`; triggers `changePeriod()` on change
- [ ] Control: Hotkey panel option — `_pickPeriod('Year')` in `#panel-period` div (onclick)
- [ ] Control: Reference overlay entry — Shows `Y → Year` in keyboard reference overlay

### Event Handlers

- [ ] Day cell click handler — On click of any day cell: sets `currentView = "Day"`, sets `currentWeekStart = dayDate`, updates period-select to "Day", calls `_updateUrlHash()` + `updateDateRange()` + `displayChits()` (drills down to Day view)
- [ ] Mobile swipe left on chit-list — Calls `nextPeriod()` (advances to next year) when `currentTab === 'Calendar'`
- [ ] Mobile swipe right on chit-list — Calls `previousPeriod()` (goes to previous year) when `currentTab === 'Calendar'`
- [ ] Mobile swipe on header bar — Cycles between tabs (Calendar, Checklists, Alarms, etc.) — not year-specific but affects navigation to/from year view

### Display Elements

- [ ] `#year-display` element — Shows the year number (e.g., "2025") in the sidebar nav center
- [ ] `#week-range` element — Cleared (empty string) when in Year view
- [ ] `#chit-list` container — Receives the year-view DOM tree
- [ ] Month header text — Shows abbreviated month + year (e.g., "Jan 2025") in bold
- [ ] Day number text — Shows day-of-month number (1–31) centered in each cell with 5px padding

### Settings That Affect Year View

- [ ] `enabled_periods` setting — Controls whether "Year" appears in the period dropdown (loaded from `/api/settings/default_user`)
- [ ] `_enabledPeriods` array — Default includes 'Year'; if removed from settings, Year option is hidden/disabled

### Responsive Behavior

- [ ] Mobile responsive layout — Year view months reflow to single column (`flex-direction: column`) on narrow viewports (via `styles-responsive.css`)
- [ ] `.year-month` responsive — `flex: none`, `min-width: 0`, `width: 100%` on mobile breakpoint

### Data Flow

- [ ] Chit filtering for year view — Uses `chitsToDisplay` (already filtered by tags, search, archive status from `displayChits()` pipeline in `main-init.js`)
- [ ] Date matching logic — Checks `chit.start_datetime_obj.toDateString() === dayDate.toDateString()` OR `chit._due_datetime_obj.toDateString() === dayDate.toDateString()`
- [ ] Recurrence expansion — Virtual recurring instances are included in `chitsToDisplay` (expanded upstream by `expandRecurrence()` before reaching `displayYearView`)

### Post-Render Processing

- [ ] _applyChitDisplayOptions() — Called after render; does NOT specifically target year-view cells (only targets `.timed-event`, `.all-day-event`, `.month-event` classes — year view uses `.day` class cells with heat-map coloring instead)

### State Management

- [ ] `currentView` global — Set to `"Year"` when year view is active
- [ ] `currentWeekStart` global — Holds a Date representing January 1 of the displayed year
- [ ] `_weekViewDayOffset` — Reset to 0 when switching to Year view (via `changePeriod()` or `_pickPeriod()`)
- [ ] URL hash state — `#calendar/year` persisted in browser URL for bookmarking/refresh
