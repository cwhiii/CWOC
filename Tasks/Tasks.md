# CWOC — Tasks & Roadmap

*Completed items are in `done.md`.*

---

## Bugs

### Calendar
- `[x]` Events can have end time before start time — validate and prevent
- `[ ]` Week view starts on Monday, not Sunday — make configurable
- [ ] in month & week & 7 day view, dragging chits should let me change thair start date .

### Editor
- `[ ]` Missing favicon on editor page
- `[ ]` Weather bar transparent background persists when color removed
- `[ ]` Can't save health indicators
- `[ ]` Enable button greyed out on disabled alarms row
- `[ ]` Tags in active zone expand to fill space — should wrap to minimum
- `[ ]` Active Tags area overflows the Tags zone
- `[ ]` Alarm looping pings continuously instead of once per cycle

### Views
- `[ ]` Tasks list: sort-by dropdown overflows sidebar
- `[ ]` Projects not loading correctly in some cases
- `[ ]` Projects filter doesn't do anything when clicked
- `[ ]` Indicators tab: tabbing bugs, symptom tracker multi-select, cycle show/hide

---

## Decisions Needed

- `[ ]` Overlapping calendar events — side by side? Click to top? Stack indicator? Shrink to fit?
- `[ ]` Demo/hosting environment — Digital Ocean or other?
- `[ ]` Server configurator script for deployment
- `[ ]` Support file attachments on chits?
- `[ ]` Event by quantity of TIME vs chronological (snooze slides the event until started)
- `[ ]` Chit groups (like Google calendars) — just use tags?

---

## In Progress — Nested Tags (remaining)

- `[ ]` Migration for existing flat tag data
- `[ ]` Settings: create nested tags (parent dropdown or drag-to-nest)
- `[ ]` Settings: display tags as expandable tree
- `[ ]` Settings: toggle favorite (star icon) per tag
- `[ ]` Settings: child tag auto-prefixes with parent path
- `[ ]` Settings: color inheritance (child inherits parent unless overridden)
- `[ ]` Shared `createTagInline()` for editor and settings
- `[ ]` System tags as sub-tags: System/Calendar, System/Indicators, etc.

---

## Feature: Recurrence / Repeating Chits

### Architecture
- ONE chit stored in DB with a recurrence rule (e.g., "Weekly on Mon,Wed,Fri")
- Frontend expands into virtual instances for the visible calendar date range
- Exceptions stored as JSON array on the parent chit: `recurrence_exceptions`
- Each exception: `{ date, title?, start_datetime?, end_datetime?, completed?, broken_off? }`
- "Break off" creates a new standalone chit and adds that date to exceptions
- "Complete series" marks the parent chit complete (stops all future instances)
- 🔁 icon shown near the pinned indicator on recurring chits (editor + views)

### Phase R1: Basic Recurrence — Editor + Calendar Display
**Files:** `backend/main.py`, `frontend/editor.html`, `frontend/editor.js`, `frontend/main.js`, `frontend/shared.js`

- `[x]` Backend: add `recurrence_rule` JSON field to chits table
- `[x]` Backend: add `recurrence_exceptions` JSON field to chits table
- `[x]` Editor: Google Calendar-style recurrence picker
- `[x]` Editor: show 🔁 icon near pinned indicator when recurrence is set
- `[x]` shared.js: `expandRecurrence(chit, startDate, endDate)`
- `[x]` main.js: in `displayChits()`, expand recurring chits for Calendar tab
- `[x]` Calendar views: virtual instances display with 🔁 icon and recurrence tooltip
- `[x]` Non-calendar views: show parent chit only, with recurrence info in metadata

### Phase R2: Instance Editing + Completion
**Files:** `frontend/editor.js`, `frontend/main.js`, `frontend/shared.js`, `backend/main.py`

- `[x]` When opening a recurring chit from calendar, show prompt:
  - "Complete this instance" / "Complete entire series"
  - "Edit this instance" / "Edit all instances" / "Break off from series"
- `[x]` "Complete this instance" — add `{ date, completed: true }` to exceptions
- `[x]` "Complete entire series" — set parent chit status to Complete
- `[x]` "Edit this instance" — add exception with modified fields for that date
- `[x]` "Edit all instances" — open parent chit in editor normally
- `[x]` "Break off" — create new standalone chit with this instance's data, add date to exceptions as broken_off
- `[x]` Delete: "Skip this instance" vs "Delete entire series"

### Phase R3: Series Management + Reporting
**Files:** `frontend/main.js`, `frontend/editor.js`, `frontend/shared.js`

- `[x]` "Part X of series" indicator (count occurrences up to this date) — shown in tooltips and quick edit modal
- `[x]` End date for recurrence (in the recurrence picker) — available on all types, not just Custom
- `[x]` Success rate: % of past instances marked completed vs total — shown in quick edit modal
- `[x]` Auto-archive: when all instances in range are complete, archive parent
- `[x]` Series summary view: list all instances with their completion status

---

## Features — Calendar & Scheduling

- `[ ]` Calendar: X Days view (custom number, text input, days wrap if narrow)
- `[ ]` Show alarms/notifications/timers on calendar view
- `[ ]` Notify at start time (checkbox)
- `[ ]` Notify at due time (checkbox)
- `[ ]` Snoozable notifications (1, 3, 5, 10 min options)
- `[ ]` Jitter for reminders (±X minutes, configurable globally and per-chit)
- `[ ]` Alarm: chained variable-length intervals (5 min, then 4, then 4...)
- `[ ]` Alarm: "Delete After Dismissal" checkbox
- `[ ]` Busy/Free/Unspecified status for calendar events
- `[ ]` Declined events view
- `[ ]` Time zones support on chits with dates
- `[ ]` Weather flag for heavy winds (like precipitation)
- `[ ]` Visual indicator on calendar if chit is a sub-chit (show/hide toggle)
- `[ ]` Scroll to 30 min before current time on calendar load (default 05:30)

---

## Features — Alerts & Notifications

- `[ ]` Persistent/nag/alarm mode (force acknowledgement)
- `[ ]` Customizable alarm sounds
- `[ ]` Create alerts based on: arbitrary time, X units before/after start, X units before/after due
- `[ ]` "Only if undone" checkbox (default on)
- `[ ]` Setting: default sound/snooze length per priority
- `[ ]` Notification message = chit title + optional appended text
- `[ ]` Android, Linux, Windows, iOS system notifications
- `[ ]` Proximity-based notifications (your location, someone else's)
- `[ ]` Biometric triggers (steps, heart rate, cycle state)

---

## Features — Editor & Chit Management

- `[ ]` Primary tag auto-colors the chit (make obvious in UI)
- `[ ]` People zone: modal with autocomplete + multi-select roles (Owners, Stakeholders, Editors, Assignees, Guests, Followers)
- `[ ]` Multi-line checklist items
- `[ ]` Hotkeys to jump to and expand each zone
- `[ ]` When creating chit from a view, hide irrelevant zones, pre-populate relevant ones
- `[ ]` Middle-click Create Chit to open in new tab
- `[ ]` Editing chits in-place in views (dates, times, notes)
- `[ ]` Status as multi-select field with "-" (null) option
- `[ ]` Show note content in Tasks view
- `[ ]` Tasks view: status images matching editor icons
- `[ ]` Tasks view: default sort by status, completed to bottom
- `[ ]` Chit owner field (UUID + friendly name + username)
- `[ ]` Adding people: mention, tag, contributor (see chit, edit chit)
- `[ ]` Checkbox to show/hide fields by category
- `[ ]` Move checklist into note / note into checklist (or draggable)
- `[ ]` Option to hide/stealth a chit from all other users
- `[ ]` Linked chits (bidirectional)
- `[ ]` Dependencies (chits that must be completed first)
- `[ ]` Progress % field
- `[ ]` Time estimate field
- `[ ]` Duration field
- `[ ]` Visibility (Private/Shared/Public)

---

## Features — Tags & Filtering

- `[ ]` Tags: starred/favorite always at top
- `[ ]` Hide/show tags toggle on all views
- `[ ]` Search all visible fields with "Search All Fields" toggle
- `[ ]` Sidebar: save a search as a one-click button
- `[ ]` Label/tag-based view filtering (like Google Calendar show/hide)
- `[ ]` Additional/custom statuses

---

## Features — Weather

- `[ ]` Setting: default location (home)
- `[ ]` Setting: work & other saved locations (click & pick)
- `[ ]` Setting: auto-apply default location to new chits
- `[ ]` Save expected weather per chit (forecast fields: focus, updated time, high, low, precipitation, weather code)
- `[ ]` Display weather on calendar views
- `[ ]` Hourly weather update for chits in next 7 days
- `[ ]` Daily weather update for chits in next 16 days
- `[ ]` Refresh button/icon with weather modal
- `[ ]` "Show weather" toggle on sidebar
- `[ ]` Weather as full view (like week mode)

---

## Features — Notes

- `[ ]` Side-by-side notes view (2 chits for copy/paste/reference)
- `[ ]` Quick in-place edits in Notes view
- `[ ]` Notes with links to other chits (each chit has a URL by ID)
- `[ ]` Auto import/export notes as Markdown to sync with Obsidian

---

## Features — Health Indicators

- `[ ]` Build health indicators zone (BP, weight, glucose, caffeine, temperature, SpO2, heart rate, distance, cycle)
- `[ ]` Symptom tracker (multi-select)
- `[ ]` Cycle tracking (show/hide based on gender setting)
- `[ ]` Trend charts in Indicators view
- `[ ]` Settings: show/hide indicator icons

---

## Features — Projects

- `[ ]` Toggle in project view: view as Kanban board
- `[ ]` Project Master checkbox makes chit show in sidebar Kanban
- `[ ]` Sub-chits drag & drop changes status
- `[ ]` Chits with sub-chits: show/hide projects filter in Tasks view

---

## Features — Data & Infrastructure

- `[ ]` Soft delete → trash view with purge and individual restore/nuke
- `[ ]` Export: Markdown, iCal, CSV
- `[ ]` Import from CSV
- `[ ]` Auto-generated QR codes per chit
- `[ ]` Chit URL (direct link by ID)
- `[ ]` Audit logs
- `[ ]` Universally unique installation instance ID
- `[ ]` Server configurator script
- `[ ]` E2E encryption
- `[ ]` HTTPS for geolocation access

---

## Features — UI & Layout

- `[ ]` Mobile friendly / responsive layout
- `[ ]` Help, About, & "Buy me a coffee" menu (with helptexts for all features)
- `[ ]` Wall/kiosk view for persistent displays
- `[ ]` Rolling circular chits view (next task in project, repeat when done)
- `[ ]` Context switching (hide chits by time schedule + tags)
- `[ ]` Random/shuffle sort order (for recipes, etc.)
- `[ ]` Upcoming tasks view
- `[ ]` Show events by map
- `[ ]` Working days/hours configuration
- `[ ]` Schedule appointment hours and days
- `[ ]` Hotkey: create chit with submenu for each type (K→X for views, K→R for raw)
- `[ ]` Find a place for a clock in views

---

## Non-Functional UI Elements (buttons/settings present but not wired up)

### Editor — Broken/Missing Functions
- `[x]` **Tags: "Expand All" button** — `toggleAllTags()` implemented
- `[x]` **Tags: "Collapse All" button** — `toggleAllTags()` implemented
- `[x]` **Tags: "Create New" button** — `createTag()` navigates to settings
- `[x]` **Tags: search input + clear button** — `clearTagSearch()` and `addSearchedTag()` implemented
- `[ ]` **People: "Filter" button** — calls `toggleRoleFilterDropdown()` which doesn't exist (code is in Prototypes only)
- `[ ]` **People: "Add Person" button** — calls `addPersonItem()` which doesn't exist (code is in Prototypes only)
- `[ ]` **People zone** — only a plain text input, no roles/modal/autocomplete
- `[ ]` **Health Indicators zone** — `renderHealthIndicator()` is defined twice and both are empty stubs; all health input divs are empty
- `[ ]` **Health: Unit toggle** (Imperial/Metric) — checkbox present, not wired to anything
- `[ ]` **Health: Sex toggle** (Female/Male) — checkbox present, not wired to anything
- `[ ]` **Alerts: "Filter" button** — `toggleAlertFilterDropdown()` exists but only toggles container visibility, no actual filter logic
- `[ ]` **Alerts: Alarm sound select** — dropdown present in modal but sounds aren't loaded/played
- `[ ]` **Projects: "Filter" button** — calls `toggleStatusFilterDropdown()` which doesn't exist in editor.js
- `[ ]` **Projects: "Move to Project" dropdown** — hardcoded options ("Project Alpha", "Project Beta"), not populated from data
- `[ ]` **Color: "Manage Colors" button** — navigates to settings but doesn't return to the right place
- `[ ]` **Weather bar** — shows placeholder text, actual weather fetch only works sometimes

### Settings — Not Applied Anywhere
- `[ ]` **Visual Indicators** (Alarm/Notification/Weather/People/Indicators: Always/Never/When Space) — saved to DB but never read or applied in any view
- `[x]` **Chit Options: "Fade Past Chits"** — now applied: past chits faded to 50% opacity
- `[x]` **Chit Options: "Highlight Overdue Chits"** — now applied: red left border on overdue chits
- `[ ]` **Chit Options: "Delete Past Alarm Chits"** — saved but never applied
- `[ ]` **Default Filters (Word Search per tab)** — UI exists for Calendar/Checklists/Alarms/Projects/Tasks/Indicators/Notes but values are never used as default search filters when switching tabs
- `[ ]` **Alarms: Active/Inactive clock drag-drop ordering** — UI works for reordering but the order isn't used anywhere in the dashboard alarm display

### Editor — Partially Working
- `[ ]` **Recurrence** — Phase R1 done (display + basic editing), Phase R2 done (instance editing), Phase R3 not started (series management, success rate)
- `[ ]` **Projects zone** — Kanban works for project masters, but "Add Chit" creates blank children, "Move to Project" is hardcoded

---

## Features — Long-term / Dream

- `[ ]` User management (login, user switcher, multi-user)
- `[ ]` Multi-owner view for wall stations/common areas
- `[ ]` Shared chit view / "Chits Assigned to Me"
- `[ ]` Object & Inventory Tracking zone (price, quantity, location, expiration, durable/consumable)
- `[ ]` Home Assistant integration (HACS fragment, external access)
- `[ ]` Local device storage with server sync
- `[ ]` Phone app with offline store + sync
- `[ ]` Obsidian sync (auto-export notes as Markdown)
- `[ ]` Email integration (prototype exists)
- `[ ]` Goals system (completion %, grading, success/failure/abandoned)
- `[ ]` Reports system
- `[ ]` Automations (if this, then that)
- `[ ]` Appointments (from other people)
- `[ ]` Fragments to GitHub
- `[ ]` Notification based on start time + location + drive time
- `[ ]` Mapping service setting
- `[ ]` Workgroup chat link
