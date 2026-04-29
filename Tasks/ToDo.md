# CWOC — Tasks & Roadmap

*Completed items are in `done.md`. Deferred items in `parking_lot.md`. Declined in `path_not_traveled.md`.*

---

## Known Bugs

### Editor
- this is done: notifications have a checkbox: "before due/start" which seems redundant & confusing. Change to a dropdown of before/after start/due.
- add a "loop notification until acknowledged" functionality. Basically a snooze for notifications — reuse what "notify at start" alert is doing.
- clean up behavior of all notifications to be consistent.
- get rid of the filter button on notification zone.
- change the add order for alerts: notifications, alarms, timers, stopwatches
- `[ ]` Can't save health indicators
- single click/tap shouldn't show the jump snaps until dragging starts. 
- there's a double footer on settings 
---

## Easy Fixes / Low-Hanging Fruit
- Weather modsl: half-size drop down, move button for full up next to it, and make it a wordless with hover. 
Make reference more clear which are lists of options, and which are submenues. Do it like a tree. 
Make reference links (mention setting page, it should be a clickable link). On mobile the text is too small. 
- PNT? Actual android notifications for alerts
- `[ ]` Hide Completes (not past-due) sidebar toggle button — persist state across sessions
- `[ ]` Screenshot and video walkthrough of the app
- even if the page isn't reloaded, refresh the forecast every 4 hours

---

## UI Audit — Non-Functional Elements

*Elements that exist in the UI but have no working functionality. Each needs a decision: build it, or remove it.*

Use consistent system for modals. So they Re all styled the same, and have the same in/out functions, etc. 

### Editor — Health Indicators Zone (entire zone is non-functional)
- `renderHealthIndicator()` is an empty stub — called for all 7 indicators but renders nothing
- `unitToggle` checkbox (Imperial/Metric) — no onchange handler, never read
- `sexToggle` checkbox (Female/Male) — no onchange handler, never read
- All health input divs (`weightEntry`, `distanceEntry`, `heartRateEntry`, `bpEntry`, `spo2Entry`, `glucoseEntry`, `temperatureEntry`) — present in HTML but never populated
- Reproduction section — incomplete HTML, no JS
- **Decision needed**: Build the full health indicators feature, or hide/remove the zone until ready

### Editor — Stopwatch Modal
- `closeStopwatchModal()` — completely empty function, modal Close button does nothing
- `saveStopwatchDetails()` — completely empty function, modal Save button does nothing
- **Decision needed**: Implement the modal functions, or remove the modal and use inline-only stopwatch UI

### Editor — Project Kanban Delete Button
- Delete button on child chit cards in the Kanban board shows `alert("not implemented")`
- **Decision needed**: Wire up actual delete (with confirmation), or remove the button. wire it. 

---

## Medium Features

### Calendar Import (.ics)
- `[ ]` Import calendar data from Google, Apple, and Windows/Outlook via .ics files
- All three platforms export iCalendar (.ics / RFC 5545) — one parser covers all three
- **Parsing:** Follow the `vcard_parse()` pattern — line-by-line text parsing with unfolding. No external library needed.
- **Field mapping:** SUMMARY→title, DESCRIPTION→note, DTSTART/DTEND→start/end_datetime, DUE (VTODO)→due_datetime, LOCATION→location, CATEGORIES→tags, PRIORITY (1–9)→High/Medium/Low, all-day detection→all_day
- **Recurrence:** Map common RRULE patterns (daily, weekly, monthly, yearly) to existing `recurrence_rule` format. Skip/warn on exotic patterns (e.g., "every 2nd Tuesday of the month").
- **Timezones:** Need a strategy — convert to local time on import, or store as-is. Design decision.
- **VTODO support:** Apple Reminders and Outlook Tasks export as VTODO, not VEVENT. Map to Tasks view.
- **VALARM → alerts:** Optional v2 — iCal alarm components could map to the alerts system, but data models differ enough to defer.
- **Duplicate detection:** Match on title + start_datetime to avoid re-importing.
- **Estimate:** ~400–600 lines backend (parser + endpoint + mapping), ~50–100 lines frontend (reuse Data Management UI pattern). No new dependencies.
- **Backend:** `POST /api/import/calendar` endpoint, clone contacts import pattern
- **Frontend:** File upload + import modal in Settings → Data Management, reuse existing UI

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

Real World Use
- Establish external access path.   
   - home assistant? 
   - just secured? Mobile platform? 
   - existing tool to do external access safelt from home network? 
- Security audit 


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
