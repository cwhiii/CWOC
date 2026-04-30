# CWOC — Tasks & Roadmap

*Completed items are in `done.md`. Deferred items in `parking_lot.md`. Declined in `path_not_traveled.md`.*

---

---
## Manual Tasks
- `[ ]` Screenshot and video walkthrough of the app

## Known Bugs
---

## Easy Fixes / Low-Hanging Fruit

- in the indicators, on the graphs the date overlaps if they are close together,  have it use smarter, shorter lables, or oly day of the month or somehting better to previent this. 
- in indicators vierw, use a plain red heart fo rhear rate chart & filter. 
- in indicators view, let me drag & drop the charts to reorganize them just like is impliments in the notes view. 



## Medium Features
### External Access
- I'll be using theis with potentilaly severla different extra-LAN accessmethods. 1st is tailscale. Udpdat ehe installer to get that configured, and add whatever's needd to the settings page to the "🔄 Version & Updates" block of settings. Also, rename it ot " Updates & access" (with applicable good logo.) DO NOT export any passwords for this in the full data export, but DO export all other configs & settigns needed for it. 

### MISC
- `[ ]` Use consistent system for modals (same styling, same in/out function



### Shared Task Assignment
- Dependency: Users feature
- Have chits assigned to a certain person

### Calendar Import (.ics)
- `[ ]` Import calendar data from Google, Apple, and Windows/Outlook via .ics files
- One parser covers all three (iCalendar / RFC 5545)
- Field mapping: SUMMARY→title, DESCRIPTION→note, DTSTART/DTEND→dates, LOCATION→location, CATEGORIES→tags, PRIORITY→High/Medium/Low
- Recurrence: map common RRULE patterns to existing `recurrence_rule` format
- VTODO support for Apple Reminders and Outlook Tasks
- Duplicate detection on title + start_datetime
- Estimate: ~400–600 lines backend, ~50–100 lines frontend


### Templates
- Save a chit as a template, auto-populate new chits from it
- New editor mode, Shift+click on new chit button, "Make this a template" in editor, Shift+K hotkey

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
- `[ ]` People zone: modal with autocomplete + multi-select roles (after Users)
- `[ ]` Multi-line checklist items
- `[ ]` Linked chits (bidirectional)
- `[ ]` Dependencies (chits that must be completed first)
- `[ ]` Visibility (Private/Shared/Public) (after Users)
- `[ ]` Move checklist into note / note into checklist

### Notes
- `[ ]` Side-by-side notes view (2 chits for copy/paste/reference)
- `[ ]` Auto import/export notes as Markdown to sync with Obsidian

### Self-Audit
- `[ ]` Identify UI elements without associated functionality
- `[ ]` Make a list to clean up — decide build or cut for each

---

## Major Features / Overhauls

### Real World Use
- `[ ]` Establish external access path (Home Assistant? Secured reverse proxy? Mobile platform?)
- `[ ]` Security audit

### HST Time Format (Global)
- `[ ]` When "HST" is selected, ALL times display in HST throughout the tool
- `[ ]` Calendar hour columns, event times, tooltips, quick edit, editor — all use HST
- `[ ]` HST displays as plain number (e.g. "42.5 sd") — no progress bar except Clock modal
- `[ ]` Views show 100 HST hours instead of normal hours
- `[ ]` Span options become 1,2,3,4,5,10 HST hours

### Multi-User System
- `[ ]` Full user accounts with login/authentication
- `[ ]` Each user has own chits, contacts, and settings
- `[ ]` User switcher
- `[ ]` Profile page with contact info + password
- `[ ]` Sharing by chit — all users on instance can access
- `[ ]` Sharing by tag — tag-based cross-user access
- `[ ]` Shared calendars via tag-based sharing
- `[ ]` Multi-owner view for wall stations/common areas
- `[ ]` "Chits Assigned to Me" view
- `[ ]` Option to hide/stealth a chit from all other users
- `[ ]` Chit owner field (UUID + friendly name + username)

### Event Invitations
- `[ ]` Invite another user to a chit/event
- `[ ]` Accept/reject invitations
- `[ ]` Invitation status visible to inviter
- `[ ]` Accepted invitations appear on invitee's calendar
- `[ ]` Declined events view (per user)

### Health Indicators (Enhancements)
- `[ ]` Symptom tracker (multi-select)
- `[ ]` Cycle tracking (show/hide based on gender setting)

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
- `[ ]` Auto backup & export to other machine

---

## Decisions Needed

- `[ ]` Support file attachments on chits?
- `[ ]` Event by quantity of TIME vs chronological (snooze slides the event until started)
- `[ ]` Chit groups (like Google calendars) — just use tags? Maybe a checkbox to "use as group"?
