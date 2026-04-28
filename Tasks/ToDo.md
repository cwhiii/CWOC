# CWOC — Tasks & Roadmap

*Completed items are in `done.md`. Deferred items in `parking_lot.md`. Declined in `path_not_traveled.md`.*

---

## Known Bugs
- `[ ]` X Days view doesn't show X days. only does show a few days.

### Editor
- notifications have a checkbox: "before due/start" wihch seems redundant & confusing. change to a drop down of before/after start / due. 
- add a "loop notificaiton until acknoledged" functionality. this basically a snooze for notifications. it should reuse what the "notify at start" alert is doing. 
- clean up behavior of all notifications to be consistant.
- get rid of the filter button on notificationtion zone.
- change the add order for alerts: notifications, alarms, timeers, stopwatcvhes

- `[ ]` Can't save health indicators


---

## Easy Fixes / Low-Hanging Fruit

- on settgins page, move week starts & views hours above the checkboxes for enabled periods. generally clean upo the order, and put options for each one below that one. so X days count should be direcly below rthe checkbox to enable X day checkbox, etc. 
- `[ ]` Remove the Save Search button for now (park it in parking_lot.md)
- `[ ]` Move the Clock button back to its original position; move Weather button to where Clock was (shift-click → full page, normal click → modal)
- `[ ]` Better footer styling
- `[ ]` Hide Completes (not past-due) sidebar toggle button — persist state across sessions
- `[ ]` Box/group all sidebar filters with a tap/click to collapse each group — persist collapsed/expanded state across sessions
- `[ ]` Style the Period dropdown in the sidebar
- `[ ]` Task view: don't show created/updated dates or weather text — only show the weather icon
- `[ ]` Update the weather flash colors to match the HST bar colors
- `[ ]` Screenshot and video walkthrough of the app
- `[ ]` **Custom Colors cleanup** — clean up the color name labels (make user-settable, or just don't display them). Use horizontal rows for the color swatches so the block is shorter.
- `[ ]` **Settings blocks collapsible** — make each settings block collapsible like zones in the chit editor
- `[ ]` **Settings layout reorganization** — collect blocks that grow/scroll into their own row. balance this with Arrange short blocks side-by-side with other short blocks, long blocks with long blocks (fixed layout, not dynamic reflow). Order by most-frequently-accessed near the top.
- when double ckilking a chit in the views it starts showinfg all the span lines befoer the doubleclick compltes. 

---

## Medium Features

### Imports 
- ability to import calendar data from googe & apple & windows

### Repeating task management. 
- better handling for visualization of which are ocmpleted, which need doing, which are every day, which are "hide when done, but show on my list toehrwise," etc.


### Templates
- a tool for making a chit, saving it as a template, and having the ability to auto-populate a new chit with the values/variables in it. probaly requires a new chit editor Mode, etc. And a SHIFT+click on new chit button, ot a button to "Make this a template"  in the editor itself, along with a SHIFT+K hotlkey 

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
- `[ ]` Jitter for reminders (±X minutes, configurable globally and per-chit, including to disable fo this chit, and to use a different value for this chit.)
- `[ ]` Alarm: chained variable-length intervals (5 min, then 4, then 4...)
- `[ ]` Busy/Free/Unspecified status for calendar events
- `[ ]` Declined events view
- `[ ]` Time zones support on chits with dates
- `[ ]` Weather & clock on the sides of the current date block? Show the HST bar as part of that block (without numbers)?
- `[ ]` Calendar view: for all days with weather, show each location/city on its own row

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
- even if the page isntre relaoded, refresh the forcast every 4 hours. 
- `[ ]` Weather  page . Available via SHIFT+W, from views, or a button on the weather modal. also, add a  row for every specific day that has weather (location & date), for non-saved locations. generalize to per city. so if there's events in non-saved locations in address1 address2, in city1, address3 and address4 in city2, and address5 in cty3, it should add 3 rows, one for each CITY. then only load/display the weather for days that have an invent in that coity on that day.

### Self-Audit
- are there UI elements that do not have functonality associatetd with them?
- Make a list to clearn them but, BUT DO NOT START YET.
- For each will need to know if it can be cut, or if I want to build the functionality. 

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
- ALl users on the system are automctiaclly gnereated as Contacts for all other users, and their contact info is synced with any changes in the user's profile. ? Decisions to be made here.
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
- `[X]` Fragments to GitHub
- `[ ]` Notification based on start time + location + drive time
- `[ ]` Biometric triggers (steps, heart rate, cycle state)
- `[X]` Workgroup chat link
- auto backup & export to other machine.

---

## Decisions Needed

- `[X]` Demo/hosting environment — Digital Ocean or other?
- `[ ]` Support file attachments on chits?
- `[ ]` Event by quantity of TIME vs chronological (snooze slides the event until started)
- `[ ]` Chit groups (like Google calendars) — just use tags? maybe a chckbox to "use as group"?
