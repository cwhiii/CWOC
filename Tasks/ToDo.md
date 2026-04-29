# CWOC — Tasks & Roadmap

*Completed items are in `done.md`. Deferred items in `parking_lot.md`. Declined in `path_not_traveled.md`.*

---

## Known Bugs

### Editor
- notifications have a checkbox: "before due/start" which seems redundant & confusing. Change to a dropdown of before/after start/due.
- add a "loop notification until acknowledged" functionality. Basically a snooze for notifications — reuse what "notify at start" alert is doing.
- clean up behavior of all notifications to be consistent.
- get rid of the filter button on notification zone.
- change the add order for alerts: notifications, alarms, timers, stopwatches

- `[ ]` Can't save health indicators

---

## Easy Fixes / Low-Hanging Fruit

- `[ ]` Hide Completes (not past-due) sidebar toggle button — persist state across sessions
- `[ ]` Screenshot and video walkthrough of the app
- even if the page isn't reloaded, refresh the forecast every 4 hours

---

## Medium Features

### Imports
- ability to import calendar data from Google & Apple & Windows

### Repeating Task Management
- better handling for visualization of which are completed, which need doing, which are every day, which are "hide when done, but show on my list otherwise," etc.

### Templates
- a tool for making a chit, saving it as a template, and having the ability to auto-populate a new chit with the values/variables in it. Probably requires a new chit editor Mode, etc. And a SHIFT+click on new chit button, or a button to "Make this a template" in the editor itself, along with a SHIFT+K hotkey

### Calendar & Scheduling
- `[ ]` Show alarms/notifications/timers on calendar view
- `[ ]` Jitter for reminders (±X minutes, configurable globally and per-chit)
- `[ ]` Alarm: chained variable-length intervals (5 min, then 4, then 4...)
- `[ ]` Busy/Free/Unspecified status for calendar events
- `[ ]` Declined events view
- `[ ]` Time zones support on chits with dates

### Alerts & Notifications
- `[ ]` Proximity-based notifications (your location, someone else's)

### Editor & Chit Management
- `[ ]` People zone: modal with autocomplete + multi-select roles (ONLY AFTER USERS)
- `[ ]` Multi-line checklist items
- `[ ]` Linked chits (bidirectional)
- `[ ]` Dependencies (chits that must be completed first)
- `[ ]` Visibility (Private/Shared/Public) (ONLY AFTER USERS)
- `[ ]` Move checklist into note / note into checklist

### Notes
- `[ ]` Side-by-side notes view (2 chits for copy/paste/reference)
- `[ ]` Auto import/export notes as Markdown to sync with Obsidian

### Self-Audit
- are there UI elements that do not have functionality associated with them?
- Make a list to clean them up, BUT DO NOT START YET.
- For each will need to know if it can be cut, or if I want to build the functionality.

---

## Major Features / Overhauls

### HST Time Format (Global)
- `[ ]` When "HST" is selected as time format in settings, ALL times throughout the tool should display in HST
- `[ ]` Calendar hour columns, event times, tooltips, quick edit modal, editor time fields — all use HST
- `[ ]` HST displays as a plain number (e.g. "42.5 sd") — no progress bar except in the Clock modal
- the views that use time (such as week & day) update to show 100 HST hours instead of normal hours
- span options become 1,2,3,4,5,10 HST hours
- `[ ]` Clock modal keeps the bar-style HST display as-is

### Multi-User System
- `[ ]` Full user accounts with login/authentication
- `[ ]` Each user has their own chits, contacts, and settings
- `[ ]` User switcher
- all users get a "Profile" page, with all the info as in a contact. Plus password
- `[ ]` **Sharing by chit** — share a chit so all users on the instance can access it
- `[ ]` **Sharing by tag** — anything tagged XYZ for user A, user B also gets access (or a clone)
- `[ ]` Shared calendars between users via tag-based sharing
- `[ ]` Multi-owner view for wall stations/common areas
- `[ ]` "Chits Assigned to Me" view
- `[ ]` Option to hide/stealth a chit from all other users
- `[ ]` Chit owner field (UUID + friendly name + username)

### Event Invitations
- `[ ]` Invite another user to a chit/event
- `[ ]` Invited user can see, accept, or reject the invitation
- `[ ]` Invitation status visible to the inviter (pending/accepted/rejected)
- `[ ]` Accepted invitations appear on the invitee's calendar
- `[ ]` Declined events view (per user)

### Health Indicators
- `[ ]` Build health indicators zone (BP, weight, glucose, caffeine, temperature, SpO2, heart rate, distance, cycle)
- `[ ]` Symptom tracker (multi-select)
- `[ ]` Cycle tracking (show/hide based on gender setting)
- `[ ]` Trend charts in Indicators view
- `[ ]` Settings: show/hide indicator icons

### Data & Infrastructure
- `[ ]` E2E encryption
- `[ ]` Server configurator script for deployment
- `[ ]` Local desktop storage (cookies?) with server sync
- `[ ]` Phone app with offline store + sync

### UI & Layout
- `[ ]` Wall/kiosk view for persistent displays
- `[ ]` Rolling circular chits view (next task in project, repeat when done)
- `[ ]` Context switching (hide chits by time schedule + tags)
- `[ ]` Show events by map
- `[ ]` Schedule appointment hours and days

---

## Long-term / Dream

- `[ ]` Object & Inventory Tracking zone
- `[ ]` Home Assistant integration
- `[ ]` Obsidian sync (auto-export notes as Markdown)
- `[ ]` Email integration (prototype exists)
- `[ ]` Goals system (completion %, grading, success/failure/abandoned)
- `[ ]` Reports system
- `[ ]` Automations (if this, then that)
- `[ ]` Appointments (from other people)
- `[ ]` Notification based on start time + location + drive time
- `[ ]` Biometric triggers (steps, heart rate, cycle state)
- auto backup & export to other machine

---

## Decisions Needed

- `[ ]` Support file attachments on chits?
- `[ ]` Event by quantity of TIME vs chronological (snooze slides the event until started)
- `[ ]` Chit groups (like Google calendars) — just use tags? maybe a checkbox to "use as group"?
