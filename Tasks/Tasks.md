# CWOC — Tasks & Roadmap

*Completed items are in `done.md`.*

---

## Known Bugs

### Calendar
- `[ ]` In month & week & 7 day view, dragging chits should let me change their start date

### Editor
- `[ ]` Can't save health indicators

### Views
- `[ ]` Indicators tab: tabbing bugs, symptom tracker multi-select, cycle show/hide

---

## Low-Hanging Fruit

*Quick wins that would improve the experience with minimal effort.*

- `[ ]` **Calendar: color-code by tag** option (vs chit color)


---

## Upcoming Features

### Data Management (Settings Page)
- `[ ]` New "Data Management" settings box with download/upload controls
- `[ ]` Separate controls for **Chit data** and **User data** (settings, tags, colors, locations, contacts)
- `[ ]` **Export**: download as JSON file that can be re-imported into another CWOC instance
- `[ ]` **Import**: option to **Add to** existing data or **Replace** existing data
- `[ ]` **Replace** mode: confirmation dialog ("This will override and replace all [chit/user] data. Are you sure?")
- `[ ]` Exported format must be self-contained and portable between instances

### HST Time Format (Global)
- `[ ]` When "HST" is selected as time format in settings, ALL times throughout the tool should display in HST
- `[ ]` Calendar hour columns, event times, tooltips, quick edit modal, editor time fields — all use HST
- `[ ]` HST displays as a plain number (e.g. "42.5 sd") — no progress bar except in the Clock modal
- `[ ]` Clock modal keeps the bar-style HST display as-is

### Visual Indicators — Honor Settings in Views
- `[ ]` Clean up the Visual Indicators settings UI (currently saved but never applied)
- `[ ]` Read `visual_indicators` from settings on dashboard load
- `[ ]` Apply indicator visibility rules to chit cards in all views:
  - `always` — always show the indicator icon
  - `never` — never show it
  - `space` ("If Space") — show only when the card has room (hide on narrow/mobile)
- `[ ]` Indicators affected: Alarm 🔔, Notification 📢, Weather 🌤️, People 👥, Health ❤️

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
- `[ ]` Busy/Free/Unspecified status for calendar events
- `[ ]` Declined events view
- `[ ]` Time zones support on chits with dates
- `[ ]` Weather flag for heavy winds (like precipitation)
- `[ ]` Visual indicator on calendar if chit is a sub-chit (show/hide toggle)

---

## Features — Alerts & Notifications

- `[ ]` Persistent/nag/alarm mode (force acknowledgement)
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

- `[ ]` Save expected weather per chit (forecast fields: focus, updated time, high, low, precipitation, weather code)
- `[ ]` Display weather on calendar views
- `[ ]` Hourly weather update for chits in next 7 days
- `[ ]` Daily weather update for chits in next 16 days
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
