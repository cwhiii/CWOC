# CWOC — Tasks & Roadmap

*Completed items are in `done.md`. Deferred items in `parking_lot.md`. Declined in `path_not_traveled.md`.*

---
## Manual Tasks
- `[ ]` Screenshot and video walkthrough of the app

---

- usesrs in roladex: i should be able to view a user like a contact, and view theri values. Should be able to favorite tehem, jsut like a contact. 
- if stealth is enabled or a chit, all sahring & assiement options should be crewyed out. 
- I should be able to drag & drop an all-day chit to a different all-day day.
- change hotkry fir x days from ".-->s" to ".-->x" update help & ref. 
- make the profile picrures in the rop right corner of each page teh same height as the buttons its next to.
- in tasks view, the passed-due items getspecial coloring on them, good! Update the text fo rhe psased-due items to have the label: Passed Due: [due date]. Including the year, in format YYYY-MMM-DD. 
- in the indicators, on the graphs the date overlaps if they are close together,  have it use smarter, shorter lables, or oly day of the month or somehting better to previent this. 
- in indicators vierw, use a plain red heart fo rhear rate chart & filter. 
- in indicators view, let me drag & drop the charts to reorganize them just like is impliments in the notes view. 
- Combine alerts should be honored on all views, it's not in tasks.
- On mobile, swiping the top bar should cycle through views.
- on mobile, scrinking and expanding the sieze of the day veiw doen't adjust the size of the events, so they overflow oddly. fix. 
- on the suer switchter, put th econteol bittons on teh same line. 



## Top Priorities


- undersgtand habit sbetter, it's doing somethign strange I don't get. 
- `[ ]` Goals system (completion %, grading, success/failure/abandoned)


## Known Bugs

- the reset on teh admin tool for users doesnt actualy cahnge the password.
- the admin shoul dbe ableo tto update usernsames for existing users.
- ensure the export all exports everything. (is this safe? are passwords harshed ? what about the key for tailscale?)
- pruning shiuld be enabled by default. 


---

## Easy Fixes / Low-Hanging Fruit







## Medium Features
## Calculator
- CalcUlator popver/movable modal. Steal from pipeulator & add "insert result S value. Or CRTL+I if in a input field.
¿Leave the calculator with wire to value? (persist checkbox)?

- note to markdown export option, per chit, or all.
- full-chit to markdown epoort, per chit, or all.  


### MISC
- `[ ]` Use consistent system for modals (same styling, same in/out function


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

### Location-based functionality
- `[ ]` Proximity-based notifications (your location, someone else's)

### Editor & Chit Management
- `[ ]` Multi-line checklist items
- `[ ]` Dependencies (chits that must be completed first)
- `[ ]` Move checklist into note / note into checklist

### Notes
- `[ ]` Side-by-side notes view (2 chits for copy/paste/reference)
- `[ ]` Auto import/export notes as Markdown to sync with Obsidian





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

### Event Invitations
- `[ ]` Accept/reject invitations
- `[ ]` Invitation status visible to inviter
- `[ ]` Accepted invitations appear on invitee's calendar
- `[ ]` Declined events toggle 

### Health Indicators (Enhancements)
- `[ ]` Symptom tracker (multi-select), wirth the ability to creqte your own list of symptoms in settings.
- `[ ]` Cycle tracking (show/hide based on gender setting)

### Data & Infrastructure
- `[ ]` E2E encryption
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
