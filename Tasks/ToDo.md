# CWOC — Tasks & Roadmap

*Completed items are in `done.md`. Deferred items in `parking_lot.md`. Declined in `path_not_traveled.md`.*

- update & impliment the .ics export.




 - on the email view, add a badge to indicate that the message has been responded to. Also add a button to : archive, delete, mark unread.  These buttons should only be visible when I am hovering over the particular message. It should appear on the right hand side somewhere.
 - Also, whichever email I'm pointing it should be much more visually obvious.


I want a new feature. to have a shared contact vault. It's a check box in the people, editor. When checked, this contact is made available to all users on the server. All users should get a setting in the settings page for default to share or not share contacts to the vault




- go through the base to find everywhere where there is an editor that accepts marked in. Have it also support the hot keys that we just set up for bold and attack and links. Also support: 
- bold
- italic
- links (as we just did)
- numbered lists (including mult-row=multi-items, and sub-lists) : cmd+shft+8
- bullet list (including mult-row=multi-items, and sub-lists) : cmd+shft+8
- Strikeout. = cmd+sft+x
Also make a note in the read me and help that this tool supports markdown just about everywhere. 






- Here values for things like birthdays and anniversaries. These dates should appear on a special birthday chit. These are automatically generated on the anniversary date of the dates in people. But there should be a check box by each one that defaults to turned on or show anual repitition  (or aniversary sor romthieng). If enabled, and there's a valid date, show the person as a value on the all day section of calendars. And searches should find them correctly. So if I have somebody born in 1987, I'm January 14, and I'm viewing the month of January, if I have show on calendar enable, that person's chip (no chit, THIER person tag) should show up on the calendar for January 14. Even if I'm looking at January for 2029.

- Rules engineL new from x make greeen.

## Manual Tasks
- `[ ]` Screenshot and video walkthrough of the app

right click everywhere shift lcick is supposerted. 


---

## Top Priorities




# Implementation Plan: Data Management Overhaul
- update to handle new email fields
- execute


- add an item to the todo: see where the new crypto-package could be used to futher secure passwords, and update the system to take advantage of it. 

- Attachemtns: have an attachemnts zone. Be able to add or remove files forom a chit. (keep in mind that this will be a male client in the near future, so they should be able to work with the attachments coming and going through email. So if there's anything special with that, we want to support that out of the gate.)

- on map & waether pages:  Add 3 more time periods to the drop-down. The next hour, and today, and next X days which uses the X days setting form th esettings. 
- on teh map page, cange teh date filter to just "Day" instead of "this day", etc, for all then values in that ONE dropdown.    


fix habit notifications:

The how it charts are pre-rendering the text. So they're grainy and terrible. Use actual text instead of rendered text from an image for those charts.


## Exporting
- Export chit as markdwon with frontmatter. (per chit form the chit editor, and from teh data export tool)
- Export chit as calendar file. (.ics)  (per chit form the chit editor, and from teh data export tool)
- in either of the above, per user, or all users.




### Health Indicators (Enhancements)

- `[ ]` Symptom tracker (multi-select), with the ability to create your own list of symptoms in settings

- `[ ]` Cycle tracking (show/hide based on gender setting)
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

---

## Long-term / Dream

- `[-]` Email integration (prototype exists) — **MVP in progress via spec**
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
