# CWOC — Tasks & Roadmap

*Completed items are in `done.md`. Deferred items in `parking_lot.md`. Declined in `path_not_traveled.md`.*

---

## Top Priorities

- [ ] OAuth2 support
- [ ] New message arrival toast notifications
- [ ] Data Management Overhaul — update to handle new email fields, then execute

---

## Known Bugs

- [ ] Habits mode: completion value changes don't animate (just instant-swaps, hard to follow)
- [ ] Newest emails not showing at the top of the page
- [ ] Email account nickname not showing on cards or sidebar

---

## Email

- [X] On the email view, add a badge indicating the message has been responded to
- [X] Add hover-only action buttons (archive, delete, mark unread) on the right side of each message
- [ ] Make the currently-hovered email much more visually obvious
- [ ] Explore attaching zones (or entire chit data) as files to outgoing emails.
- when I hit the send and save button on the email zone, expanded, or small, the save exit buttons don't update to reflect the fact that I have just saved it.

---

## Editor & Markdown

- [ ] Find all editors that accept markdown and add hotkey support (bold, italic, links, etc.)
- [ ] Multi-line checklist items
- [ ] Dependencies (chits that must be completed first)
- [ ] Add a note in the README and Help that markdown is supported throughout the app
- Ensure that you use double*for bold, and_for italics. Exclusively. Don't ever add or care about single *or double _
- obsidian like markdwon live preview. 

---

## Exporting & Import

- [ ] Update and implement .ics export
- [ ] Export chit as markdown with frontmatter (per chit from editor + data export tool)
- [ ] Export chit as .ics calendar file (per chit from editor + data export tool)
- [ ] Per-user or all-users option for exports
- [ ] Import calendar data from Google, Apple, Outlook via .ics (RFC 5545)
  - SUMMARY→title, DESCRIPTION→note, DTSTART/DTEND→dates, LOCATION→location, CATEGORIES→tags, PRIORITY→High/Medium/Low
  - Map common RRULE patterns to existing `recurrence_rule` format
  - VTODO support for Apple Reminders and Outlook Tasks
  - Duplicate detection on title + start_datetime
  - Estimate: ~400–600 lines backend, ~50–100 lines frontend

---

## Calendar & Scheduling

- [ ] Show alarms/notifications/timers on calendar view
- [ ] Jitter for reminders (±X minutes, configurable globally and per-chit)
- [ ] Alarm: chained variable-length intervals (5 min, then 4, then 4…)
- [ ] Declined events view
- [ ] Time zones support on chits with dates

---

## People & Contacts

- [ ] Birthday/anniversary dates on contacts should generate annual calendar entries
  - Checkbox per date (default on) to show on calendar
  - Display the person's chip on the all-day section for that date each year
  - Searches should find them correctly across years

---

## Notes

- [ ] Notes links: auto-fill dropdown using name of other chit
- [ ] Side-by-side notes view (2 chits for copy/paste/reference)
- [ ] Auto import/export notes as Markdown to sync with Obsidian
- [ ] Note-to-markdown export option, per chit or all

---

## Notifications & Alerts

- [ ] On a notification, add a "bump" button with unit options (tomorrow, next week, next month) to push start/due time out
- [ ] Proximity-based notifications (your location, someone else's)

---

## Templates

- [ ] Save a chit as a template, auto-populate new chits from it
- [ ] New editor mode: Shift+click on new chit button, "Make this a template" in editor, Shift+K hotkey

---

## UI & Interaction

- [ ] Use consistent system for modals (same styling, same in/out animation)
- [ ] Right-click everywhere Shift+click is supported
- [ ] Rolling circular chits view (next task in project, repeat when done)
- [ ] Automatic context switching (hide chits by time schedule + tags) via rules
- [ ] Rules engine: "new from X" make green

---

## Health Indicators (Enhancements)

- [ ] Symptom tracker (multi-select) with custom symptom list in settings
- [ ] Cycle tracking (show/hide based on gender setting)

---

## Large / Complex

### HST Time Format (Global)
- [ ] When "HST" is selected, ALL times display in HST throughout the tool
- [ ] Calendar hour columns, event times, tooltips, quick edit, editor — all use HST
- [ ] HST displays as plain number (e.g. "42.5 sd") — no progress bar except Clock modal
- [ ] Views show 100 HST hours instead of normal hours
- [ ] Span options become 1, 2, 3, 4, 5, 10 HST hours

### Data & Infrastructure
- [ ] E2E encryption
- [ ] Local desktop storage (cookies?) with server sync
- [ ] Phone app with offline store + sync

### Real World Use
- [ ] Establish external access path (Home Assistant? Secured reverse proxy? Mobile platform?)
- [ ] Security audit

---

## Long-term / Dream

- [-] Email integration (prototype exists) — MVP in progress via spec
- [ ] Home Assistant integration
- [ ] Obsidian sync (auto-export notes as Markdown)
- [ ] Object & Inventory Tracking zone
- [ ] Reports system
- [ ] Automations (if this, then that)
- [ ] Appointments (from other people)
- [ ] Notification based on start time + location + drive time
- [ ] Biometric triggers (steps, heart rate, cycle state)
- [ ] Auto backup & export to other machine

---

## Decisions Needed

- [ ] Event by quantity of TIME vs chronological (snooze slides the event until started)
- [ ] Chit groups (like Google calendars) — just use tags? Maybe a checkbox to "use as group"?
- [ ] Attaching zone data as email attachments — entire chit or individual zones?

---

## Manual Tasks

- [ ] Screenshot and video walkthrough of the app
