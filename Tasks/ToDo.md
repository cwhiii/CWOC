# CWOC — Tasks & Roadmap

*Completed items are in `done.md`. Deferred items in `parking_lot.md`. Declined in `path_not_traveled.md`.*


## Manual Tasks
- `[ ]` Screenshot and video walkthrough of the app

---

## Top Priorities


fix habit notifications:



The how it charts are pre-rendering the text. So they're grainy and terrible. Use actual text instead of rendered text from an image for those charts.

## Exporting
- Export chit as markdwon with frontmatter.
- Export chit as calendar file. (.ics)
- Export all chits in either of the above, per user, or all users.

---

## Known Bugs

- `[ ]` The reset on the admin tool for users doesn't actually change the password
- `[ ]` The admin should be able to update usernames for existing users
- `[ ]` Ensure the export-all exports everything (is this safe? Are passwords hashed? What about the key for Tailscale?)
- `[ ]` Pruning should be enabled by default
- habits mode: Animation — Ditched the FLIP approach entirely. still doesnt animate after the cahnged compltion values, it jsut instnatly swaps, wihch is hard to follow)

---

## Easy / Quick

- `[ ]` Add a new button on the checklist zone header: mark complete when last item checked off
- `[ ]` Use consistent system for modals (same styling, same in/out function)
- `[ ]` Note-to-markdown export option, per chit or all
- `[ ]` Full-chit-to-markdown export, per chit or all
- on a notification, had a bump a [unit options] . It will push the start times or due time out by whatever the selected unit is. Tomorrow to next week to next month.
---

## Medium

### Calculator
- `[ ]` Calculator popover/movable modal — steal from Pipeulator & add "insert result" value (or Ctrl+I if in an input field). Leave the calculator wired to value? (persist checkbox)?

### Notes
- `[ ]` Notes links: auto-fill dropdown using name of other chit
- `[ ]` Side-by-side notes view (2 chits for copy/paste/reference)
- `[ ]` Auto import/export notes as Markdown to sync with Obsidian

### Calendar & Scheduling
- `[ ]` Show alarms/notifications/timers on calendar view
- `[ ]` Jitter for reminders (±X minutes, configurable globally and per-chit)
- `[ ]` Alarm: chained variable-length intervals (5 min, then 4, then 4…)
- `[ ]` Busy/Free/Unspecified status for calendar events
- `[ ]` Declined events view
- `[ ]` Time zones support on chits with dates

### Editor & Chit Management
- `[ ]` Multi-line checklist items
- `[ ]` Dependencies (chits that must be completed first)
- `[ ]` Move checklist into note / note into checklist

### Templates
- `[ ]` Save a chit as a template, auto-populate new chits from it
- `[ ]` New editor mode, Shift+click on new chit button, "Make this a template" in editor, Shift+K hotkey

### Calendar Import (.ics)
- `[ ]` Import calendar data from Google, Apple, and Windows/Outlook via .ics files
- One parser covers all three (iCalendar / RFC 5545)
- Field mapping: SUMMARY→title, DESCRIPTION→note, DTSTART/DTEND→dates, LOCATION→location, CATEGORIES→tags, PRIORITY→High/Medium/Low
- Recurrence: map common RRULE patterns to existing `recurrence_rule` format
- VTODO support for Apple Reminders and Outlook Tasks
- Duplicate detection on title + start_datetime
- Estimate: ~400–600 lines backend, ~50–100 lines frontend

### Location
- `[ ]` Proximity-based notifications (your location, someone else's)

---

## Large / Complex

### Real World Use
- `[ ]` Establish external access path (Home Assistant? Secured reverse proxy? Mobile platform?)
- `[ ]` Security audit

### HST Time Format (Global)
- `[ ]` When "HST" is selected, ALL times display in HST throughout the tool
- `[ ]` Calendar hour columns, event times, tooltips, quick edit, editor — all use HST
- `[ ]` HST displays as plain number (e.g. "42.5 sd") — no progress bar except Clock modal
- `[ ]` Views show 100 HST hours instead of normal hours
- `[ ]` Span options become 1,2,3,4,5,10 HST hours

### Health Indicators (Enhancements)
- `[ ]` Symptom tracker (multi-select), with the ability to create your own list of symptoms in settings
- `[ ]` Cycle tracking (show/hide based on gender setting)

### Data & Infrastructure
- `[ ]` E2E encryption
- `[ ]` Local desktop storage (cookies?) with server sync
- `[ ]` Phone app with offline store + sync

### UI & Layout
- `[ ]` Rolling circular chits view (next task in project, repeat when done)
- `[ ]` Automatic Context switching (hide chits by time schedule + tags) via rule
- `[ ]` Show events by map
- `[ ]` Schedule appointment hours and days

---

## Long-term / Dream

- `[ ]` Email integration (prototype exists)
- `[ ]` Home Assistant integration
- `[ ]` Obsidian sync (auto-export notes as Markdown)
- `[ ]` Object & Inventory Tracking zone
- `[ ]` Reports system
- `[ ]` Automations (if this, then that)
- `[ ]` Appointments (from other people)
- `[ ]` Notification based on start time + location + drive time
- `[ ]` Biometric triggers (steps, heart rate, cycle state)
- `[ ]` Auto backup & export to other machine

---

## Decisions Needed

- `[ ]` Support file attachments on chits?
- `[ ]` Event by quantity of TIME vs chronological (snooze slides the event until started)
- `[ ]` Chit groups (like Google calendars) — just use tags? Maybe a checkbox to "use as group"?
