# CWOC — Tasks & Roadmap

*Completed items are in `done.md`.*

---

## Bugs

### Calendar
- `[X]` Week view starts on Monday, not Sunday — make configurable
- `[ ]` In month & week & 7 day view, dragging chits should let me change their start date

### Editor
- `[X]` Missing favicon on editor page
- `[ ]` Weather bar transparent background persists when color removed
- `[ ]` Can't save health indicators
- `[ ]` Enable button greyed out on disabled alarms row
- `[ ]` Tags in active zone expand to fill space — should wrap to minimum
- `[ ]` Active Tags area overflows the Tags zone
- `[ ]` Alarm looping pings continuously instead of once per cycle

### Views
- `[X]` Tasks list: sort-by dropdown overflows sidebar
- `[ ]` Projects not loading correctly in some cases
- `[ ]` Projects filter doesn't do anything when clicked
- `[ ]` Indicators tab: tabbing bugs, symptom tracker multi-select, cycle show/hide
- `[ ]` Projects view: ckanbad mode or List Mode

---

## Decisions Needed

- `[ ]` Demo/hosting environment — Digital Ocean or other?
- `[ ]` Server configurator script for deployment
- `[ ]` Support file attachments on chits?
- `[ ]` Event by quantity of TIME vs chronological (snooze slides the event until started)
- `[ ]` Chit groups (like Google calendars) — just use tags?

---

## In Progress — Nested Tags (remaining)

- `[ ]` Migration for existing flat tag data
- `[ ]` Settings: create nested tags (parent dropdown or drag-to-nest)
- `[X]` Settings: display tags as expandable tree
- `[X]` Settings: toggle favorite (star icon) per tag
- `[X]` Settings: child tag auto-prefixes with parent path
- `[X]` Settings: color inheritance (child inherits parent unless overridden)
- `[ ]` Shared `createTagInline()` for editor and settings
- `[ ]` System tags as sub-tags: CWOC_System/Calendar, CWOC_System/Indicators, etc.

---

## Feature: Recurrence / Repeating Chits ✅

All three phases complete. See `done.md` for details.

---

## Features — Calendar & Scheduling

- `[ ]` Calendar: X Days view (custom number, text input, days wrap if narrow)
- `[ ]` Show alarms/notifications/timers on calendar view
- `[X]` Notify at start time (checkbox)
- `[X]` Notify at due time (checkbox)
- `[ ]` Snoozable notifications (1, 3, 5, 10 min options)
- `[ ]` Jitter for reminders (±X minutes, configurable globally and per-chit)
- `[ ]` Alarm: chained variable-length intervals (5 min, then 4, then 4...)
- `[ ]` Alarm: "Delete After Dismissal" checkbox
- `[ ]` Busy/Free/Unspecified status for calendar events
- `[ ]` Declined events view
- `[ ]` Time zones support on chits with dates
- `[ ]` Weather flag for heavy winds (like precipitation)
- `[ ]` Visual indicator on calendar if chit is a sub-chit (show/hide toggle)
- `[X]` Scroll to 30 min before current time on calendar load (default 05:30)

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
- `[ ]` Tasks view: status images matching editor icons
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

- `[X]` Tags: starred/favorite always at top
- `[X]` Hide/show tags toggle on all views
- `[X]` Search all visible fields with "Search All Fields" toggle
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

- `[X]` Soft delete → trash view with purge and individual restore/nuke
- `[X]` Export: Markdown, iCal, CSV
- `[X]` Import from CSV
- `[ ]` Auto-generated QR codes per chit
- `[X]` Chit URL (direct link by ID)
- `[ ]` Audit logs
- `[ ]` Universally unique installation instance ID
- `[ ]` Server configurator script
- `[ ]` E2E encryption
- `[ ]` HTTPS for geolocation access

---

## Features — UI & Layout

- `[ ]` Mobile friendly / responsive layout
- `[X]` Help, About, & "Buy me a coffee" menu (with helptexts for all features)
- `[ ]` Wall/kiosk view for persistent displays
- `[ ]` Rolling circular chits view (next task in project, repeat when done)
- `[ ]` Context switching (hide chits by time schedule + tags)
- `[X]` Random/shuffle sort order (for recipes, etc.)
- `[ ]` Upcoming tasks view
- `[ ]` Show events by map
- `[ ]` Working days/hours configuration
- `[ ]` Schedule appointment hours and days
- `[ ]` Hotkey: create chit with submenu for each type (K→X for views, K→R for raw)
- `[ ]` Find a place for a clock in views

---

## Non-Functional UI Elements (buttons/settings present but not wired up)

### Editor — Broken/Missing Functions
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
- `[ ]` **Weather bar** — shows placeholder text, actual weather fetch only works sometimes

### Settings — Not Applied Anywhere
- `[ ]` **Visual Indicators** (Alarm/Notification/Weather/People/Indicators: Always/Never/When Space) — saved to DB but never read or applied in any view
- `[ ]` **Chit Options: "Delete Past Alarm Chits"** — saved but never applied
- `[ ]` **Alarms: Active/Inactive clock drag-drop ordering** — UI works for reordering but the order isn't used anywhere in the dashboard alarm display

### Editor — Partially Working
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
