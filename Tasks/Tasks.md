# CWOC — Tasks & Roadmap

*Completed items are in `done.md`. Deferred items in `parking_lot.md`. Declined in `path_not_traveled.md`.*

---

## Known Bugs

### Editor
- `[ ]` Can't save health indicators

---

## Easy Fixes / Low-Hanging Fruit

*All items from this batch completed — see done.md*
- `[ ]` **Progress % field** on chits
- `[ ]` **Time estimate field** on chits


---

## Medium Features

### Data Management (Settings Page)
- `[ ]` New "Data Management" settings box with download/upload controls
- `[ ]` Separate controls for **Chit data** and **User data** (settings, tags, colors, locations, contacts)
- `[ ]` **Export**: download as JSON file that can be re-imported into another CWOC instance
- `[ ]` **Import**: option to **Add to** existing data or **Replace** existing data
- `[ ]` **Replace** mode: confirmation dialog ("This will override and replace all [chit/user] data. Are you sure?") (use coling & wording from the delete chit process)
- `[ ]` Exported format must be self-contained and portable between instances

### Nested Tags (remaining)
- `[ ]` Migration for existing flat tag data
- `[ ]` Settings: create nested tags (parent dropdown or drag-to-nest)
- `[ ]` Shared `createTagInline()` for editor and settings
- `[ ]` System tags as sub-tags: CWOC_System/Calendar, CWOC_System/Indicators, etc.

### Audit Log
- `[ ]` Full audit log of changes made to chits, settings, and contacts
- `[ ]` Track: who made the change (username from settings), what changed, when, created/deleted
- `[ ]` Requires username field in settings (see Easy Fixes)
- `[ ]` Viewable audit history per chit, per contact, and globally

### Calendar & Scheduling
- `[ ]` Show alarms/notifications/timers on calendar view
- `[ ]` Jitter for reminders (±X minutes, configurable globally and per-chit)
- `[ ]` Alarm: chained variable-length intervals (5 min, then 4, then 4...)
- `[ ]` Busy/Free/Unspecified status for calendar events
- `[ ]` Declined events view
- `[ ]` Time zones support on chits with dates

### Alerts & Notifications
- `[ ]` Persistent/nag/alarm mode (force acknowledgement)
- `[ ]` Create alerts based on: arbitrary time, X units before/after start, X units before/after due
- `[ ]` Setting: default sound/snooze length per priority
- `[ ]` Proximity-based notifications (your location, someone else's)

### Editor & Chit Management
- `[ ]` People zone: modal with autocomplete + multi-select roles (Owners, Stakeholders, Editors, Assignees, Guests, Followers) (ONLY AFTER USERS HAVE BEEN IMPLIMENTS.)
- `[ ]` Multi-line checklist items
- `[ ]` Linked chits (bidirectional)
- `[ ]` Dependencies (chits that must be completed first)
- `[ ]` Visibility (Private/Shared/Public)  (ONLY AFTER USERS HAVE BEEN IMPLIMENTS.)
- `[ ]` Move checklist into note / note into checklist 

### Notes
- `[ ]` Side-by-side notes view (2 chits for copy/paste/reference)
- `[ ]` Auto import/export notes as Markdown to sync with Obsidian. do this via a "import note" button in the note zone header. acceot .md & .txt files.

### Weather
- `[ ]` Save expected weather per chit (forecast fields: focus, updated time, high, low, precipitation, weather code)
- `[ ]` Display weather on calendar views
- `[ ]` Hourly weather update for chits in next 7 days
- `[ ]` Daily weather update for chits in next 16 days
- `[ ]` Weather as full page like settings. Available via SHIFT+W, from views, or a button on the weather modal. Shows all saved weather's full corcast, 1 location per row, with each day as a separatte block, with the dates above, basically a large table

---

## Major Features / Overhauls

### HST Time Format (Global)
- `[ ]` When "HST" is selected as time format in settings, ALL times throughout the tool should display in HST
- `[ ]` Calendar hour columns, event times, tooltips, quick edit modal, editor time fields — all use HST
- `[ ]` HST displays as a plain number (e.g. "42.5 sd") — no progress bar except in the Clock modal. 
- the other clock modal options are not impacted by this. 
- the views that use time (such as week & day) update to show 100 HST hours instead of normal hours. 
- span options become 1,2,3,4,5,10 HST hours.
- `[ ]` Clock modal keeps the bar-style HST display as-is

### Multi-User System
- `[ ]` Full user accounts with login/authentication
- `[ ]` Each user has their own chits, contacts, and settings
- `[ ]` User switcher
- all users get a "Profile" page, with all the info as in a contact. Plus password
- ALl users on the system are automctiaclly gnereated ass Contacts for all other users, and their contact info is syncted with any changes in the user's profile. 
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
- `[ ]` Local device storage with server sync
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
- `[ ]` Fragments to GitHub
- `[ ]` Notification based on start time + location + drive time
- `[ ]` Biometric triggers (steps, heart rate, cycle state)
- `[ ]` Workgroup chat link

---

## Decisions Needed

- `[ ]` Demo/hosting environment — Digital Ocean or other?
- `[ ]` Support file attachments on chits?
- `[ ]` Event by quantity of TIME vs chronological (snooze slides the event until started)
- `[ ]` Chit groups (like Google calendars) — just use tags?
