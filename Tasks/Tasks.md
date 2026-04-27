# CWOC — Tasks & Roadmap

*Completed items are in `done.md`.*

---

## Known Bugs

### Calendar
- `[ ]` In month & week & 7 day view, dragging chits should let me change their start date

### Editor
- `[ ]` Can't save health indicators
- `[ ]` Enable button greyed out on disabled alarms row
- `[ ]` Tags in active zone expand to fill space — should wrap to minimum
- `[ ]` Active Tags area overflows the Tags zone

### Views
- `[ ]` Indicators tab: tabbing bugs, symptom tracker multi-select, cycle show/hide

---

## Low-Hanging Fruit

*Quick wins that would improve the experience with minimal effort.*

- `[ ]` **Chit card: show checklist progress** — "3/7 ✓" count on checklist view cards
- `[ ]` **Double-click chit title in editor** to select all text (for quick rename)
- `[ ]` **Confirm before purging all trash** — bulk delete has no "are you sure?"
- `[ ]` **Empty state messages** — "No tasks found" / "No notes" etc. with a Create Chit button
- `[ ]` **Color picker in editor** — show existing tag colors as quick-pick swatches (like settings tag modal)
- `[ ]` **Keyboard shortcut: Ctrl+S** to save chit in editor
- `[ ]` **Auto-focus title field** when creating a new chit
- `[ ]` **Show chit count per tab** — "Tasks (12)" in tab/view labels
- `[ ]` **Sidebar: show current view name** — "Calendar · Week" label when sidebar is collapsed
- `[ ]` **Settings: reset to defaults button** per section
- `[ ]` **Contact editor: auto-focus given name** on new contact
- `[ ]` **Dashboard: loading spinner** while fetching chits (instead of blank screen)
- `[ ]` **Itinerary view: show due-date chits** (currently only shows start_datetime chits)
- `[ ]` **Month view: limit events per cell** with "+N more" expand (like all-day row)
- `[ ]` **Checklist: percentage complete bar** on chit cards
- `[ ]` **Notes view: card resize handle** (drag bottom edge to set preferred height)
- `[ ]` **Quick edit modal: add/remove tags** inline
- `[ ]` **Calendar: color-code by tag** option (vs chit color)
- `[ ]` **Sidebar filter: color dots** next to tag names in the filter panel

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
- `[ ]` Shared `createTagInline()` for editor and settings
- `[ ]` System tags as sub-tags: CWOC_System/Calendar, CWOC_System/Indicators, etc.

---

## Features — Calendar & Scheduling

- `[ ]` Show alarms/notifications/timers on calendar view
- `[ ]` Jitter for reminders (±X minutes, configurable globally and per-chit)
- `[ ]` Alarm: chained variable-length intervals (5 min, then 4, then 4...)
- `[ ]` Alarm: "Delete After Dismissal" checkbox
- `[ ]` Busy/Free/Unspecified status for calendar events
- `[ ]` Declined events view
- `[ ]` Time zones support on chits with dates
- `[ ]` Weather flag for heavy winds (like precipitation)
- `[ ]` Visual indicator on calendar if chit is a sub-chit (show/hide toggle)

---

## Features — Alerts & Notifications

- `[ ]` Persistent/nag/alarm mode (force acknowledgement)
- `[ ]` Customizable alarm sounds
- `[ ]` Create alerts based on: arbitrary time, X units before/after start, X units before/after due
- `[ ]` Setting: default sound/snooze length per priority
- `[ ]` Android, Linux, Windows, iOS system notifications
- `[ ]` Proximity-based notifications (your location, someone else's)
- `[ ]` Biometric triggers (steps, heart rate, cycle state)

---

## Features — Editor & Chit Management

- `[ ]` People zone: modal with autocomplete + multi-select roles (Owners, Stakeholders, Editors, Assignees, Guests, Followers)
- `[ ]` Multi-line checklist items
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

## Features — Weather

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
- `[ ]` Auto import/export notes as Markdown to sync with Obsidian

---

## Features — Health Indicators

- `[ ]` Build health indicators zone (BP, weight, glucose, caffeine, temperature, SpO2, heart rate, distance, cycle)
- `[ ]` Symptom tracker (multi-select)
- `[ ]` Cycle tracking (show/hide based on gender setting)
- `[ ]` Trend charts in Indicators view
- `[ ]` Settings: show/hide indicator icons

---

## Features — Data & Infrastructure

- `[ ]` Audit logs
- `[ ]` Server configurator script
- `[ ]` E2E encryption
- `[ ]` HTTPS for geolocation access

---

## Features — UI & Layout

- `[ ]` Wall/kiosk view for persistent displays
- `[ ]` Rolling circular chits view (next task in project, repeat when done)
- `[ ]` Context switching (hide chits by time schedule + tags)
- `[ ]` Show events by map
- `[ ]` Schedule appointment hours and days

---

## Non-Functional UI Elements (buttons/settings present but not wired up)

### Editor — Broken/Missing Functions
- `[ ]` **Health Indicators zone** — `renderHealthIndicator()` is defined twice and both are empty stubs
- `[ ]` **Health: Unit toggle** (Imperial/Metric) — checkbox present, not wired
- `[ ]` **Health: Sex toggle** (Female/Male) — checkbox present, not wired
- `[ ]` **Alerts: Alarm sound select** — dropdown present but sounds aren't loaded/played

### Settings — Not Applied Anywhere
- `[ ]` **Visual Indicators** — saved to DB but never read or applied in any view

---

## Features — Long-term / Dream

- `[ ]` User management (login, user switcher, multi-user)
- `[ ]` Multi-owner view for wall stations/common areas
- `[ ]` Shared chit view / "Chits Assigned to Me"
- `[ ]` Object & Inventory Tracking zone
- `[ ]` Home Assistant integration
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
