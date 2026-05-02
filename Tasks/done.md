# CWOC — Completed Items
### UI & Layout
- `[X]` Wall/kiosk view for persistent displays
### Event Invitations
- `[X]` Accept/reject invitations
- `[X]` Invitation status visible to inviter
- `[X]` Accepted invitations appear on invitee's calendar
- `[X]` Declined events toggle



- DO NOTHING. ONLY TALK! I need to understand habits better, it's doing something strange I don't get. Update the help about it to make all the parts crystal clear: how it works, and how to interact with it and the `[ ]` Goals system (completion %, grading, success/failure/abandoned)???

The user profile is also supposed to include all information found in the contact profile. All the same fields. Such as social site and all that kind of thing.  Both contact and user profiles should also include an indicator to show whether they are a user or a contact. Who's the same icon you use in the chits editor to indicate users. 




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



also The background for the favorites header in the expanded people thing in the chat editor is supposed to be darker to make the gold stand out better



In the chit, editor of the expanded people model, when I click on the hitters, it should sort, ascending, then on next click,  descending.



Also, any chat, editor, expanded people model, the label for contact is still brown. I wanted to have a nice color, make it the blue color that users are now, and then make the users, a gold backgound and almost black text (all re: the chip that says which they are)

### Multi-User System
1. ~~User management project - COMPLETE~~
2. Sharing chits project - requirements updated, ready for design & implementation.

- `[ ]` Server configurator script for deployment


### External Access
- I'll be using theis with potentilaly severla different extra-LAN accessmethods. 1st is tailscale. Udpdat ehe installer to get that configured, and add whatever's needd to the settings page to the "🔄 Version & Updates" block of settings. Also, rename it ot " Updates & access" (with applicable good logo.) DO NOT export any passwords for this in the full data export, but DO export all other configs & settigns needed for it. 

- for the invitee, on a chit editor, the invite control (accept & reject)  should be in a banner like teh one for "uour a read only invitee" , and should go away once 


users: 
- the username inoput in settgins, remove it. and only use the one in the user admin page. 
- add a button in teh settigns page to Manage Users. Grey it out whith hover for non-admin users. 
- user switcher isn't functional? It switches, but doesn;ta ask for atuthentication, and then doesn' switch back.
- the switchert button should be the very top right item in the top bar, and should be the user's proifile image.  clicking openes the change user tool, but as a modal.

- **New spec-driven feature.** need to have a new admin block in settings "Network Access**. in it is a A tailscale connection block. Also, need to build whatver is needed in the backend to configure & install it as part of the upgrade script. There will likely be other otion fo rnetwork hole punching/external access, so ensure theat you're naking the set up in such asway that this is not harder later.  But don't set up that other stuff yet.

- Fix the invitee system for acept & reject. 
- teh exxpand button in peeople zone in chit editoor shouldbe not just for CIEWING, but for MANAGING the people invited, etc, jsut liek the small view, but with more space to breath, for better organization, & finding, etc. 

---

## Fixed Bugs

### BUG-001 — `chitExists()` Defined Twice ✅
**FIXED 2026-04-17** — First duplicate removed.

### BUG-002 — `loadChitData` Skips All Fields for Project Master Chits ✅
**FIXED** — `loadChitData` now populates all standard fields for project masters, then calls `initializeProjectZone()` at the end.

### BUG-003 — Projects Tab on Dashboard Not Implemented ✅
**FIXED** — `displayProjectsView()` implemented as a tree view with project master cards and nested child chits.

### BUG-004 — Alarms Tab Not Implemented ✅
**FIXED** — `displayAlarmsView()` implemented. Shows all chits with alarms, notifications, timers, or stopwatches.

### BUG-005 — `isValidMediaSource()` Defined Twice ✅
**FIXED 2026-04-17** — First (less complete) duplicate removed.

### BUG-006 — `markEditorSaved()` Disables Save Button on Load ✅
**FIXED 2026-04-17** — Second `DOMContentLoaded` listener removed. Merged into single init listener.

### BUG-007 — `get_all_chits` Closes DB Connection in `finally` Even on Error ✅
**FIXED 2026-04-17** — All endpoints now initialize `conn = None` before try block.

### BUG-008 — `update_chit` Fetches Row But Checks After Building Tags ✅
**FIXED 2026-04-17** — `cursor.fetchone()` now called immediately after SELECT.

### BUG-009 — `loadChitData` Condition Is Always True for New Chits ✅
**FIXED** — Replaced with `window.isNewChit` flag set during `initializeChitId()`.

### BUG-010 — `allDay` Field Mismatch Between Save and Load ✅
**FIXED 2026-04-17** — Full backend+frontend fix: `all_day` column, migration, Pydantic model, save/load.

### BUG-011 — Tags Not Loaded/Restored When Editing Existing Chit ✅
**FIXED 2026-04-17** — `loadChitData` now calls `renderTags(tags, chit.tags || [])`.

### BUG-012 — Location and People Not Loaded in `loadChitData` ✅
**FIXED 2026-04-17** — Both fields now restored in `loadChitData`.

### BUG-013 — Color Not Restored When Editing Existing Chit ✅
**FIXED 2026-04-17** — `loadChitData` now calls `setColor(chit.color, name)`.

### BUG-014 — Pinned/Archived State Not Restored ✅
**FIXED 2026-04-17** — Both hidden inputs and icon button classes now restored.

### BUG-015 — `displayChecklistView` Checks `item.done` But Schema Uses `item.checked` ✅
**FIXED** — Now checks both `item.checked === true || item.done === true`.

### BUG-017 — `setSaveButtonSaved` and `markEditorSaved` Are Redundant ✅
**FIXED** — `markEditorSaved`/`markEditorUnsaved` are now thin wrappers delegating to single source of truth.

### BUG-018 — Header Row Changes Color When Chit Color Is Picked ✅
**FIXED 2026-04-17** — `headerRow.style.backgroundColor` line removed from `setColor()`.

### BUG-019 — Notes Saving to a Single Line / Rendering as Plaintext ✅
**FIXED** — Notes view now uses `marked.parse(chit.note)` for markdown rendering.

### BUG-020 — Health Indicators Zone Buttons Collapse the Whole Zone ✅
**FIXED** — `toggleZone()` checks for buttons/inputs and returns early.

### BUG-022 — DB_PATH Pointed at Wrong File ✅
**FIXED 2026-04-17** — `DB_PATH` corrected to `/app/data/app.db`.

---

## Fixed Design Doc Issues

- ✅ Notes rendering as plaintext → now uses `marked.parse()`
- ✅ Health Indicators zone buttons collapsing the whole zone → `toggleZone()` ignores interactive elements
- ✅ Tasks tab sort dropdown doesn't revert on tab switch → saves/restores original HTML
- ✅ Zones can't be collapsed or expanded → `toggleZone()` works correctly
- ✅ All zones should start collapsed except Dates and Notes → `applyZoneStates()` on load

---

## Completed Features (from Refactor Log)

### Session 2 — 2026-04-17
- Duplicate function removals (chitExists, isValidMediaSource)
- DOMContentLoaded listeners merged
- conn = None guards on all backend endpoints
- update_chit fetchone fix
- allDay field full implementation (backend + frontend)
- Tags pre-checked on load
- Location and people restored on load
- Color restored on load
- Pinned/archived state restored on load
- Header row color fix
- DB_PATH corrected

### Session 11 — 2026-04-18
- Projects vanishing on save (child_chits preserved via `window._loadedChildChits`)
- Notes view renders markdown (`marked.parse()`)
- Notes card height capped (`max-height: calc(100vh - 120px)`)
- marked.js CDN added to index.html

### Session 12 — 2026-04-18
- Global alert system on dashboard (alarms fire from any view)
- Browser notification support
- Alarm/timer audio playback with autoplay unlock
- Toast notifications with Dismiss/Snooze

### Session 13 — 2026-04-18
- Projects zone save button fix (`saveCurrentChit()` defined and wired up)

### Session 14 — 2026-04-18
- Alerts view shows all alert types (alarms, timers, stopwatches, notifications)
- Sound autoplay fix (pre-unlock on first user interaction)
- Toast button shows chit title
- All project zone changes mark editor unsaved

### Session 15 — 2026-04-18
- Checklist view chit colors and indentation
- ESC on checklist input calls `cancelOrExit()`
- Tab/Shift+Tab indent/unindent in checklists
- Weather placeholder (shows message when no location/date)

### Other Completed Features
- 7-day view (`displaySevenDayView()`)
- Scroll to 6am on time-based views
- Now-bar (red line at current time, updates every minute)
- Keyboard shortcuts (1-6 for tabs, I/D/W/M/Y/S for calendar views)
- Tags saving/loading fix (Pydantic serialization)
- Custom colors loading in editor
- Save button restructure (Save & Stay, Save & Exit, Exit/Cancel)
- ESC hotkey in editor
- Zone collapse on load (`applyZoneStates()`)
- Alerts zone full implementation (alarms, timers, stopwatches, notifications)
- Notes zone full implementation (markdown toggle, copy, download, modal)
- Projects view on dashboard (tree view)
- Alarms view on dashboard (all alert types)
- Pinned/Archived toggle buttons working
- Tag rendering rewrite (tree + active tags panel)
- Custom colors in editor on load
- Settings ESC key handling
- Default chit color changed to transparent
- Default location removed

---

## Completed Design Doc Features (✅ from doc)

- Weather zone ✅ 2025-06-16
- Location zone (OpenStreetMap) ✅ 2025-06-16
- Checklists (most functions) ✅ 2025-06-30
- Fix cancel check ✅ 2025-06-18
- Pinned & Archived inline with Title as icon buttons ✅ 2025-05-24
- All Day checkbox hides start/end times ✅ 2025-05-24
- Dates in collapsible Zone ✅ 2025-05-24
- Tags zone: search, expandable tree, prime tags, active tags ✅ 2025-05-24
- People types defined ✅ 2025-05-28
- Project status sections collapsible ✅ 2025-05-26
- Alarm view options in Settings ✅ 2025-05-16
- Medical Indicators section ✅ 2025-05-18
- Create menu for creating and coloring labels ✅ 2025-05-15

---

## Refactor Log (Detailed) — Sessions 2–16

### Session 2 — 2026-04-17
- Duplicate function removals, DOMContentLoaded merge, conn guards, fetchone fix, allDay full implementation, tags/location/people/color/pinned/archived restore on load, header row color fix, DB_PATH corrected

### Session 11 — 2026-04-18
- Projects vanishing on save (`window._loadedChildChits` preserves child_chits)
- Notes view markdown rendering (`marked.parse`)
- Notes card height capped, marked.js CDN added
- Editor alarm/timer/notification system (full checker, sounds, browser notifications)
- Notes zone duplicate stubs removed, height consistency
- Alerts zone rewritten as inline widgets
- Collapsed zones 55% opacity
- editor_projects.js: removed alert() calls

### Session 11 (continued)
- `chitColor(chit)` helper for all view renderers
- Projects view rewritten as tree
- Timer/stopwatch inline widgets with live displays
- Backend: alerts column, migration, Pydantic model
- Alerts zone full CRUD implementation
- Notes zone full implementation (markdown toggle, copy, download, modal)
- Project data round-trip fix (all fields populated for project masters)
- Projects tab and Alarms tab on dashboard implemented
- Alert zone buttons wired up
- Scroll to 6am fix, now-bar position fix
- Pinned/Archived toggle functions implemented
- Zone header buttons no longer trigger collapse
- Settings ESC on confirm modal fix

### Session 11 (defaults)
- Default chit color → transparent, default location removed
- Settings ESC key handling
- 7-day view added, scroll to 6am, now-bar, keyboard shortcuts
- Tags Pydantic serialization fix
- Custom colors display fix, tags save/load fix
- Settings HTML hardcoded tags removed, gatherSettings selector fix
- Tag modal fixes (hex→name, save close, confirmDelete, closeDuplicateTagModal)
- renderTags rewrite for editor HTML structure
- Custom colors loading on page load
- Save button restructure (Save & Stay, Save & Exit)
- ESC hotkey in editor
- Zone collapse on load (`applyZoneStates`)

### Session 16 — 2026-04-18
- Sidebar sort buttons (Title, Start, Due) with ▲/▼ toggle
- Archive/pinned cycle button (All → Pinned → Archived → Normal)
- `_applySort` and `_applyArchiveFilter` in displayChits pipeline


---

## Hotkey-Driven UI Overhaul ✅ (2026-04-25)

Fully implemented. Ported from `Prototypes/CWOC UI/UI.html`:
- Top-level hotkeys: C/H/A/P/T/N (tabs), K (create), S (settings), . (period), F (filter), O (order), R (reference), ESC (exit)
- Period submenu (. → I/D/W/S/M/Y)
- Filter submenu (F → S/T/P/A/I/W) with multi-select status, tags, priority
- Order submenu (O → T/S/D/U/C/X/M) with ↑↓ for asc/desc
- Full-screen overlay dimming with floating panels for submenus
- Reference overlay (R) with all hotkeys
- Sidebar reorganized: Create → Order → Period → Filters → Settings
- Multi-select filters (status, tags, priority, archived, pinned)
- Expanded sort options (title, start, due, updated, created, status, manual)
- Manual drag-to-reorder with per-view localStorage persistence
- Shift+ESC clears all filters in active panel
- Clear All Filters button
- Today button in calendar sidebar

## Calendar Drag & Editor Date Overhaul ✅ (2026-04-25)

### Phase 1: Editor Date Fields ✅
- Radio buttons: None / Due / Start&End (mutually exclusive)
- Single-row layouts: Start/End with "to" separator, Due with time
- All Day checkbox inline, Repeat inline
- Time picker dropdown with snap increments from settings
- Greyed-out inactive fields (opacity 0.3, pointer-events none)
- Auto-colon mask for HH:MM time inputs

### Phase 2: Calendar Snapping Setting ✅
- Settings page: Calendar Snapping dropdown (None, 5, 10, 15, 20, 25, 30, 60 min)
- Backend: `calendar_snap` field in Settings model, DB schema, migration
- Loaded in editor and dashboard

### Phase 3: Calendar Display ✅
- Due-date-only chits on calendar (all-day or timed with ⌚ icon)
- Due date takes priority over start/end when both exist
- All-day section restructured: header → all-day row → scrollable time grid
- Collapse/expand toggle for all-day bar (☀️/▲)
- Tooltips on all calendar events with settings-aware time format
- Today's date highlighted in all calendar views

### Phase 4: Calendar Drag ✅
- Drag to move (Day/Week/7-Day): vertical=time, horizontal=day, snap to grid
- Drag bottom edge to resize (start/end chits only, not due-only)
- Snap grid lines appear during drag only
- Month view drag between day cells
- All-day events draggable between days
- Save on mouse release (PUT to API)
- No drag in Year or Itinerary views
- Current time indicator bar (dark brown #4a2c2a)

## Nested Tags — Completed Items ✅ (2026-04-25)

### Data Model
- Tags stored as full paths with `/` separator
- `favorite` boolean added to Tag Pydantic model
- Backward compatible with flat tags

### Editor Tag Zone
- Expandable/collapsible tag tree hierarchy
- Favorites row (⭐ tags at top)
- Recent row (3 most recently used in session)
- "Top" row removed
- Active tags panel shows full paths, excludes system tags

### Sidebar Tag Filter
- Always-visible scrollbar on tag list
- Descendant matching (filtering "Work" matches "Work/Projects/CWOC")
- Indented tree display with checkboxes and colors
- Tag search box for filtering

### Shared Code
- `buildTagTree()`, `flattenTagTree()`, `matchesTagFilter()`, `renderTagTree()`
- `trackRecentTag()`, `getRecentTags()`
- `isSystemTag()` — filters out Calendar/Checklists/Alarms/Projects/Tasks/Notes
- System tags hidden from sidebar filters, editor active tags, and chit header meta

## Other Completed Items (2026-04-25)

- Calendar view: jump to today button
- Hide Period option on non-calendar views
- View → Period rename throughout
- Drag-drop on calendar for rescheduling events
- Checklist item check-off from views (interactive checkboxes)
- Cross-chit checklist item drag
- Inline checklist rendering in Checklist view
- UI state preserved across editor visits (localStorage)
- Archived chits hidden by default, semi-transparent when shown
- Consistent chit card styling across all views
- Notes view masonry layout
- Font Awesome bookmark for pinned, 📦 emoji for archived
- Archive button in editor header (grey, next to Delete)
- Manage Tags button in editor
- Note auto-renders on blur


---

## Completed — Session 2026-04-26

### Recurrence — All 3 Phases Complete ✅
- Phase R1: Basic recurrence — editor picker, expandRecurrence(), calendar display, 🔁 icon
- Phase R2: Instance editing — complete/edit/break-off/skip/delete per instance, quick edit modal, PATCH endpoint
- Phase R3: Series management — Part #X indicator, end date on all types, success rate, auto-archive, series summary (Audit Log zone in editor)

### Calendar & Views
- End time before start time validation in editor
- "Apr 22 Wed" date format shortened to "Apr-22 Mon"
- Month view: prev/next month days shown (grey/white overlays)
- Month view: removed redundant month/year header (now in sidebar)
- Month view: double-click empty day creates all-day chit
- Multi-day timed events span across day columns (clamped per day)
- Multi-day all-day events span via CSS Grid in all-day bar
- Calendar empty slot double-click creates new chit at that time
- Week start day configurable in settings (Sun-Sat)
- Sidebar shows "2026 · Apr" format for all calendar periods
- Fade past chits (events that ended) — 45% opacity
- Highlight overdue chits (due date passed, not complete) — red border all sides
- Overdue due dates shown in red + bold in all views
- Pinned indicator (bookmark icon) on calendar events
- Calendar drag: modifier keys (shift/cmd/ctrl) don't start drag
- Calendar drag: click-without-move doesn't trigger save
- Calendar drag: recurring instance "this only" breaks off as standalone

### Quick Edit Modal (Shift+click)
- Works for ALL chits (not just recurring)
- Editable dropdowns for Priority/Severity/Status with per-field "All" checkbox for recurring
- Pin/Archive/Delete action row
- Delete sub-menu for recurring: this instance / this and following / all
- Recurrence buttons: icon-only row (✏️🔁, ✏️1️⃣, ✏️✂️)
- Series info: instance number, success rate
- All actions call fetchChits() for proper refresh

### Editor
- "Weight" zone renamed to "Task"
- Task zone reordered: Status → Priority → Severity
- Complete checkbox on Due date line (syncs with Status dropdown)
- Date validation: require date + time (or All Day) when date mode active
- All Day checkbox moved to zone header
- All Day hides ALL time inputs (start, end, due), keeps "to" separator
- Repeat: checkbox-based toggle reveals options (Daily/Weekly/Monthly/Yearly/Custom)
- Custom recurrence: Every N [minutes/hours/days/weeks/months/years] + day checkboxes for weeks
- "Ends never" checkbox with date picker
- Instance editing banner when editing single recurrence instance
- Audit Log zone for recurring chits (series summary, always collapsed)
- Pre-populate start/end from URL params (calendar empty slot click)
- Tag buttons wired up: Expand All, Collapse All, Create New, Clear Search, Add Searched Tag
- Tags zone layout: tree + active tags side by side, favs/recent row above
- Tag tree: left-aligned checkboxes (fixed global input flex:1 override)

### Tags
- Favorite toggle in settings (★/☆ gold star)
- Tag colors as background everywhere (editor, sidebar, views, filter modal)
- Tags alphabetically sorted in tree
- Tag tree expand/collapse fixed (data attributes on child containers)
- Settings page: tags displayed as tree view (shared renderTagTree)
- Tag filter modal: proper names, favorites first, colored, searchable, max 9

### Sidebar & Filters
- Collapsible filter sub-sections (Search, Status, Priority, Tags, Show)
- Auto-expand filter groups on hotkey activation
- Auto-expand active filter groups on state restore
- "Any" option on Status and Priority (auto-deselects when specific checked)
- Clear button per filter group
- Backspace hotkey clears active filter / all filters
- Tag filter modal with search box
- Split "Clear All" + "Reset Defaults" buttons
- Default filters per tab (saved as {tab: "text"} in settings)
- Persistent scrollbar on sidebar and tag panels
- Sidebar bottom padding for Help button visibility
- Reference + Help buttons side by side
- Help page (help.html) with full feature documentation

### Settings
- Save & Stay / Save & Exit / Cancel buttons
- Week start day setting (Sunday-Saturday)
- Calendar snap setting
- Tag favorite toggle (★/☆)
- Tags displayed as tree view

### Notes View
- Column-persistent layout (data-col attribute)
- Scrolling fixed (spacer div for absolute-positioned cards)
- Column count recalculates on sidebar toggle
- Markdown headers in note cards: transparent background, proper sizing

### State Management
- Full UI state saved/restored: tab, view, weekStart, sort, filters, archive/pinned
- Settings navigation saves state (sidebar button + S hotkey)
- Filter groups auto-expand on restore

### Tasks View
- Default sort by status (ToDo → In Progress → Blocked → Complete)
- Note preview with rendered markdown (right of status dropdown)
- Scrollable container
- Unabbreviated meta labels (Updated, Created)
- Date format: MMM-DD Day

### Data
- PATCH endpoint for recurrence exceptions
- Backend: week_start_day setting field
- Backend: default_filters accepts object format


## Completed — Tier 2 Batch

### Trash View (Settings Page)
- Backend: GET /api/trash (deleted chits sorted by modified_datetime DESC)
- Backend: POST /api/trash/{id}/restore (sets deleted=0)
- Backend: DELETE /api/trash/{id}/purge (permanent delete from DB)
- Settings page: Trash section with table view (Title, Status, Due, Tags, Deleted date)
- Restore button (↩) on left edge, Purge button (🗑️) on right
- Delete now sets modified_datetime for accurate "deleted date"

### Overlapping Calendar Events Side-by-Side
- Week view: time slot overlap detection, events positioned with left% and width%
- 7-Day view: same overlap logic
- Day view: already had overlap logic (unchanged)

### Notify at Start/Due Time
- Global notification checker now fires browser notifications + toast when:
  - A chit's start_datetime matches current time (within 60s)
  - A chit's due_datetime matches current time (within 60s, not complete)
- Uses existing toast + browser notification infrastructure


## Completed — Session 2026-04-26 (continued)

### Trash View — Full Implementation ✅
- Standalone trash page (`frontend/trash.html`) with editor-matching button styles
- Buttons match editor CSS: `--danger-red` delete, `--aged-brown-light` restore, `2px outset` borders
- Restore and Delete buttons side by side in each row
- Checkboxes on each row for multi-select
- "Select All" checkbox in table header
- Bulk "Restore Selected" and "Delete Selected" buttons (appear when rows selected)
- Selected count indicator
- Settings page: Trash section merged into Chit Options block (same `setting-group`)

### Editor — Repeat Row Visibility ✅
- Repeat checkbox row starts hidden in HTML (`display:none`)
- Only shown when a date mode is active (Start & End or Due)
- Prevents flash of repeat controls on page load

### Notify at Start/Due — Per-Chit Flags ✅
- Checkboxes in Alerts zone: "Notify at start" / "Notify at due" (default checked)
- Stored as `_notify_flags` entry in alerts JSON
- Checkboxes only visible when relevant date mode is active
- Global notification checker respects per-chit flags


## Completed — Tier 1 & 2 Batch (2026-04-25)

### Editor Favicon ✅
- Copied `editor.png` from Prototypes to `static/editor.png`
- Editor page now shows proper favicon

### Chit URL (Direct Link by ID) ✅
- Already working via `editor.html?id=UUID` — marked done

### Scroll to 6am on Calendar Load ✅
- Already implemented via `scrollToSixAM()` — marked done

### Random / Shuffle Sort ✅
- Added `random` option to sort select dropdown
- Fisher-Yates shuffle in `_applySort`
- Hotkey: O → R for random sort
- Sort direction button hidden for random (like manual)
- Added to reference overlay

### Tag Color Inheritance ✅
- Child tags with no color now inherit from parent in `buildTagTree()`
- `inheritColors()` walk after tree construction, before sort
- Applies everywhere tags are rendered (editor, sidebar, settings, views)

### Child Tag Auto-Prefix in Settings ✅
- "+" button added next to each tag in settings tag tree
- Clicking "+" pre-fills the tag input with `parentPath/` and focuses it
- Uses depth-based matching to find correct full path

### Search All Fields ✅
- Search already covered title, note, tags, status, people, location
- Added priority and severity to search filter
- No toggle needed — always searches all fields

### Hide/Show Tags Toggle ✅
- User declined this feature — marked done per user request

### CSV Export ✅
- Button in Settings → Chit Options block
- Exports all chits as CSV with columns: id, title, status, priority, severity, dates, tags, note, location, color, pinned, archived, recurrence, timestamps
- Tags joined with "; " separator
- Proper CSV escaping (quotes, commas, newlines)
- Downloads as `cwoc-export-YYYY-MM-DD.csv`

### CSV Import ✅
- Button in Settings → Chit Options block
- File picker for .csv files
- Parses CSV with proper quote handling
- Requires "title" column header
- Creates new chits (ignores imported IDs)
- Tags split on ";" separator
- Boolean fields (pinned, archived, all_day) parsed from "true"/"false"


## Completed — Tier 1 & 2 Batch #2 (2026-04-25)

### Middle-click Create Chit ✅
- `onauxclick` handler opens editor in new tab

### Delete Past Alarm Chits — Wired Up ✅
- Setting now auto-archives alarm-only chits whose time has passed
- Only affects chits with no dates/notes (pure alarm chits)

### Notes Auto-Link [[title]] ✅
- `resolveChitLinks()` in shared.js replaces `[[title]]` with clickable links to matching chits
- Applied in Notes view and Tasks view note previews (after `marked.parse`)
- Editor: typing `[[` in the Notes textarea triggers autocomplete dropdown
- Dropdown shows matching chit titles, navigable with arrow keys, Enter to select
- Fetches chit list on first `[[` use, caches for session

### Universally Unique Installation Instance ID ✅
- `instance_meta` table in DB stores a UUID generated on first run
- `GET /api/instance-id` endpoint returns it

### Clock Modal ✅
- 🕐 button in sidebar (next to Reference & Help)
- Hotkey: L opens/closes clock modal
- Shows live 24h, 12h, and metric time with date
- Updates every second, ESC or click-outside to close

### Snoozable Notifications ✅
- Snooze registry (`_snoozeRegistry`) tracks snoozed alarms with expiry timestamps
- Snooze button on alarm toasts adds chit to registry for configured snooze duration
- Snooze duration read from settings (`snooze_length`)
- Alarm checker skips snoozed items until expiry

### Primary Tag Auto-Colors Chit ✅
- When selecting a tag in the editor, if chit color is "transparent", auto-applies the tag's color
- Only triggers on first tag selection, doesn't override manually set colors

### Editor Zone Hotkeys ✅
- Alt+1 through Alt+0 jump to and expand editor zones
- 1=Dates, 2=Task, 3=Tags, 4=Notes, 5=Checklist, 6=Alerts, 7=Location, 8=People, 9=Color, 0=Projects
- Smooth scroll to zone, auto-expands if collapsed

### Saved Searches ✅
- 💾 button next to search input saves current search text
- Saved searches appear as clickable chips below the search box
- ✕ button on each chip to remove
- Stored in localStorage (`cwoc_saved_searches`)

### Working Hours Period View ✅
- New calendar period "Work Hours" — only shows configured working hours (hides all other hours)
- Settings: "Working Hours" start/end dropdowns in General Settings
- Backend: `work_start_hour` and `work_end_hour` fields on Settings model + DB migration
- Hotkey: . → W for Work Hours (Week moved to . → K)
- Events outside working hours are hidden, events spanning boundaries are clamped

### Upcoming Sort Option ✅
- New sort option "Upcoming (Due Soon)" in Order dropdown
- Sorts by due date (or start date), completed chits always at bottom
- Hotkey: O → G
- Direction button hidden (always ascending)

### Help & Reference Updated ✅
- Reference overlay updated with all new hotkeys (L, K for Week, W for Work, G for Upcoming)
- Help page updated with new periods, sort options, editor hotkeys, and [[link]] syntax


## Completed — Fixes & Polish (2026-04-26)

### Work Hours View — Fixed ✅
- Rewrote as thin wrapper: `displayWorkView` calls `displayWeekView` with `{ hourStart, hourEnd, filterDays }` opts
- `displayWeekView` now accepts optional hour range and day filter — defaults to 0-24 / all 7 days
- Hour column, day column heights, and event positions all parameterized by `hourStart`/`hourEnd`
- Events outside the hour range are clamped/hidden, events outside working days are excluded
- Same overlap detection, same drag support, same rendering as Week view

### All-Day Events Row Packing ✅
- Fixed `renderAllDayEventsInCells` — events now pack into rows using column-span collision detection
- `rowOccupancy[]` tracks which columns are used per row
- Each event finds the first row where its column span is free, or creates a new row
- Multi-day events sharing non-overlapping columns now share the same row

### Period Enable/Disable in Settings ✅
- "Enabled Periods" checkboxes in Period Options settings block
- Disabled periods hidden from dropdown, greyed in hotkey panel + reference overlay
- Greyed items show `cursor: not-allowed` and title tooltip "This period is disabled in Settings"
- Hotkeys for disabled periods blocked via `_pickPeriod` guard
- `enabled_periods` field on backend Settings model + DB migration

### Working Days Setting ✅
- Day-of-week checkboxes (Sun-Sat) in Period Options settings block
- Defaults to Mon-Fri checked
- `work_days` CSV field on backend + migration
- Work Hours view filters to only show checked days

### Sidebar Button Layout Fix ✅
- Save Search button moved from search input to bottom 2×2 grid
- Clock, Save Search, Reference, Help all half-width in a flex-wrap grid

### Hide Past-Due Filter ✅
- "🚫 Hide Past-Due" checkbox in Show filter group
- Filters out chits with past due dates (keeps completed visible)
- Wired into state save/restore, clear filters, auto-expand logic

### Hotkey Swaps ✅
- Week: . → W, Work Hours: . → K
- Updated in panel, reference overlay, hotkey map, help page


## Completed — Tier 1-3 Batch (2026-04-26)

### Alarm Looping Fix ✅
- Changed from `loop = true` (infinite) to play 3 times then stop
- `onended` handler counts plays, stops after 3
- Dismiss/Snooze buttons still stop immediately

### Weather Bar Background Fix ✅
- Added `!important` to `#compactWeatherSection` background-color
- Prevents chit color from bleeding through to weather section

### Move to Project Dropdown — Populated from Data ✅
- Removed hardcoded "Project Alpha/Beta" options
- On editor load, fetches all chits and populates dropdown with actual project masters
- Excludes the current chit from the list

### Calendar: X Days View ✅
- `displaySevenDayView` now uses `_customDaysCount` instead of hardcoded 7
- Settings: "X Days Count" number input (2-30) in Period Options block
- `custom_days_count` field on backend Settings model + DB migration
- Dropdown, panel, and reference labels dynamically show actual count (e.g. "10 Days")

### "Only if Undone" Checkbox on Notifications ✅
- Checkbox in notification modal (default checked)
- `only_if_undone` field saved on notification alert objects
- Notification checker skips firing if chit status is "Complete" and flag is true

### Notification Custom Message ✅
- Text input in notification modal for optional appended text
- `message` field saved on notification alert objects
- Toast and browser notification show "title — message" when message exists

### QR Codes per Chit ✅
- 📱 QR button in editor header (next to Archive)
- Uses qrcode-generator CDN library
- Click shows modal with QR code image + chit URL
- Click outside to close

### Quick In-Place Edits in Notes View ✅
- Double-click a note card to edit in-place (contenteditable)
- Shows raw text for editing, saves on blur via PUT
- ESC cancels editing
- Shift+double-click still opens full editor
- Re-renders markdown after save

### Declined Items (user doesn't want)
- Label/tag-based view filtering (Google Calendar style) — existing tag filter is sufficient
- Additional/custom statuses — not needed
- Hotkey create submenu (K→X) — not needed


---

## Completed — Codebase Refactor (2026-04-26)

### Phase 1: CSS Variable Consolidation ✅
- Documented `shared-page.css` as canonical source of truth for CSS variables
- Added canonical source comments to `styles.css` and `shared-editor.css`
- Synced all shared variable values across the three `:root` blocks
- Removed unused CSS variables
- Extracted repeated inline styles from `editor.html`, `settings.html`, `index.html` into CSS classes

### Phase 2: JS Utility Consolidation ✅
- Moved `generateUniqueId()` to `shared.js`, removed from `editor.js` and `editor_projects.js`
- Moved `formatTime()` to `shared.js`, removed from `editor.js` and `main.js`
- Moved `setSaveButtonUnsaved()` to `shared.js`, removed from `editor.js` and `settings.js`
- Clarified `formatDate` variants (shared.js canonical, main.js dashboard-specific)

### Phase 3: Backend Reorganization ✅
- Added 12 `═══` section headers to `backend/main.py` (Imports, Constants, Models, DB Helpers, vCard/CSV, DB Init, Page Routes, Chit Routes, Trash Routes, Settings Routes, Contact Routes, Health)
- Moved inline `import csv` and `import io` to top imports section
- Grouped all route handlers by resource type
- Standardized `conn = None; try/finally` connection pattern across all handlers

### Phase 4: Code Quality Pass ✅
- Removed dead checklist stubs from `editor.js`
- Removed triple-duplicated comment blocks from `editor_projects.js`
- Removed debug `console.log('live test')` from `contact-editor.js` and `people.js`
- Cleaned up redundant "what" comments across all files
- Extracted repeated inline styles into CSS classes

### Phase 5: Performance Audit ✅
- Added `DocumentFragment` batching in 6+ calendar rendering spots in `main.js`
- Added `getCachedSettings()` / `_invalidateSettingsCache()` to `shared.js` for deduplicating settings API calls
- Audited and fixed event listener duplication in editor and dashboard
- Standardized database connection patterns in backend

### Previously Completed Items Moved from Tasks.md
- Week view starts on Monday, not Sunday — make configurable ✅
- Missing favicon on editor page ✅
- Weather bar transparent background persists when color removed ✅
- Alarm looping pings continuously instead of once per cycle ✅
- Tasks list: sort-by dropdown overflows sidebar ✅
- Settings: display tags as expandable tree ✅
- Settings: toggle favorite (star icon) per tag ✅
- Settings: child tag auto-prefixes with parent path ✅
- Settings: color inheritance (child inherits parent unless overridden) ✅
- Calendar: X Days view ✅
- Notify at start time / due time ✅
- Snoozable notifications ✅
- Scroll to 30 min before current time on calendar load ✅
- Primary tag auto-colors the chit ✅
- Hotkeys to jump to and expand each zone ✅
- Middle-click Create Chit to open in new tab ✅
- Tags: starred/favorite always at top ✅
- Hide/show tags toggle on all views ✅
- Search all visible fields ✅
- Sidebar: save a search as a one-click button ✅
- Label/tag-based view filtering ✅
- Additional/custom statuses ✅
- Quick in-place edits in Notes view ✅
- Notes with links to other chits ✅
- Soft delete → trash view with purge and restore ✅
- Export: Markdown, iCal, CSV ✅
- Import from CSV ✅
- Auto-generated QR codes per chit ✅
- Chit URL (direct link by ID) ✅
- Universally unique installation instance ID ✅
- Help, About, & "Buy me a coffee" menu ✅
- Random/shuffle sort order ✅
- Upcoming tasks view ✅
- Working days/hours configuration ✅
- Hotkey: create chit with submenu ✅
- Find a place for a clock in views ✅
- "Only if undone" checkbox ✅
- Notification message = chit title + optional appended text ✅
- Projects: "Move to Project" dropdown — populated from data ✅
- Chit Options: "Delete Past Alarm Chits" — wired up ✅
- Recurrence / Repeating Chits — all 3 phases ✅


---

## Completed — Bug Fix & Feature Batch (2026-04-27/28)

### Mobile UI Overhaul
- Sidebar swipe gestures: swipe right from left edge to open, swipe left to close
- Mobile hamburger ☰ button in dashboard header (left of logo, pushes title right)
- Mobile ☰ Actions modal for editor/settings/contacts — shared `initMobileActionsModal()` in shared.js
- Settings page now loads shared-editor.css + shared-editor.js for consistent header/button behavior
- All 3 editor pages (chit, contact, settings) share identical mobile save/cancel pattern
- Views panel slides in from right edge with swipe support (swipe left from right edge to open, swipe right to close)
- Views button in header pushed to right edge via `margin-left: auto`
- Reference overlay: `max-width: 100vw`, `overflow-x: hidden` to prevent wider-than-screen
- Tab buttons shrink on tablet (`flex-shrink:1`, smaller padding/font)

### QR Codes — Unified
- Single `showQRModal()` function in shared.js for ALL QR display
- Responsive sizing (calculates cell size from viewport), max-width 360px, 12px padding
- Full-width close button (44px min-height touch target), ESC to close, backdrop click to close
- Replaced ~150 lines of duplicated QR code across editor.js, shared.js (quick edit), and contact-qr.js
- Removed old static `#qr-modal` HTML from people.html and contact-editor.html
- Removed old closeQrModal handlers from people.js and contact-editor.js

### Chit Editor Fixes
- Cancel button fixed: added `.modal` + `.modal-content` CSS to shared-editor.css (was missing — unsaved-changes modal rendered invisibly)
- Loading guard flag (`_cwocEditorLoading`) suppresses false unsaved marking during initial data load
- Delayed `markEditorSaved()` calls (200ms, 500ms) catch late-firing Flatpickr/autoGrow events
- ESC chain: fullscreen notes modal → inline note render → blur input → exit editor
- Notes fullscreen "all red" text fixed (`color: red` → `color: var(--text-color)`)
- Render button race condition fixed (blur handler skips when Render button is click target)
- Expanded notes modal buttons: "Discard"/"Save & Close" → "✕ Cancel"/"✓ Done" with FA icons
- New chit collapses all zones except the one matching the source view tab
- "Manage Tags" and "Manage Colors" jump-to-settings buttons removed
- "Normal" severity level added to editor dropdown and quick edit modal
- Repeat row: dropdown + "Ends never" now inline with Repeat checkbox (same table row)
- Repeat labels: dynamic context — "Weekly on Monday", "Monthly on the 12th", "Yearly on June 12th"
- Custom recurrence details only shown when "Custom…" selected
- Zone collapse/expand rewritten: uses `display:none` on content + toggle icon text update

### Tag Editor (Settings)
- Modal buttons: Done + Cancel side-by-side on left, Delete on right (normal size, one row)
- Favorite star moved to top row, inline with tag name input
- Font color picker added (swatches + color input)
- Background color swatches: 15-color parchment-themed palette + all existing tag colors
- Live preview shows tag name with both bg and font color
- Tag name input: `box-sizing: border-box` fixes right-edge overflow
- `fontColor` field added to Tag model (backend + frontend), flows through all rendering

### Contacts
- Suffix dropdown reordered: text suffixes (Jr., Sr., Esq., Ph.D., M.D.) before numeric (I–X)
- Markdown notes field added (Notes zone in contact editor)
- Tags field added (Tags zone, auto-prefixed with "Contact/")
- Backend: `notes` and `tags` columns added to contacts table with migration
- Contact editor hotkeys updated (Alt+7 Notes, Alt+8 Tags)

### Dashboard Views
- Alerts view: notify-at-start/due flags no longer count as alerts for view filtering
- Projects view: ID deduplication prevents duplicate "new project" entries
- Kanban mode: full implementation with List/Kanban toggle in sidebar
- Kanban: cards draggable between status columns (updates status via API)
- Kanban: grandchildren as sub-items within cards, draggable between parents
- Kanban text readability: card font 1em, column headers 0.9em, grandchild 0.95em
- Project child items: increased padding and min-height in list view
- Chit card readability: `line-height: 1.5`, explicit `color: #2b1e0f`
- Inline checklist items: larger padding, gap, min-height
- Calendar column headers: removed month name (just "28 Mon"), month shown in sidebar range
- Week range format includes month: "Apr 28 Mon — May 04 Sun"

### Weather
- Editor: cached weather shown immediately with ⏳ stale badge while refreshing in background
- Dashboard: weather pre-loaded for default location on page load
- Dashboard weather modal: shows cached data with ⏳ while refreshing

### Shared Infrastructure
- `showQRModal()` — single QR display function for entire app
- `_openMobileActionsModal()` — executes onclick attributes directly via `new Function()` (fixes hidden-button click issue)
- `cwocToggleZone()` — rewritten with `display:none` + icon text toggle
- `_updateRecurrenceLabels()` — dynamic repeat dropdown labels based on current date
- `_collapseAllZonesForNewChit()` — reads `cwoc_source_tab` from localStorage
- `storePreviousState()` — now also writes `cwoc_source_tab` for editor zone collapse
- Create Chit button and K hotkey now call `storePreviousState()` before navigating
- Orphaned CSS fragment in styles.css fixed (stray properties without selector)
- `shared-editor.css` form field styles scoped to `.editor` to prevent settings page bleed

### Help & Documentation
- Task zone documented (Status, Priority, Severity including Normal)
- New chit zone collapse behavior documented
- Contact Editor section added (notes, tags, suffix ordering)


## Declined — Low-Hanging Fruit (2026-04-27)

- **Notes view: card resize handle** — not wanted
- **Quick edit modal: add/remove tags** — not wanted
- **Checklist: percentage complete bar** — not wanted
- **Settings: reset to defaults button** — not wanted
- **Double-click chit title in editor to select all** — not wanted
- **Sidebar filter: color dots next to tag names** — not wanted


## Completed — Low-Hanging Fruit Batch (2026-04-27)

### Keyboard shortcut: Ctrl+Shift+S to save & stay in editor ✅
- Ctrl+Shift+S triggers `saveChitAndStay()` from the editor keydown handler

### Auto-focus title field on new chit ✅
- Title input receives focus 350ms after new chit initialization (after loading guard clears)

### Contact editor: auto-focus given name on new contact ✅
- Given name field receives focus 100ms after DOMContentLoaded when no contact ID

### Confirm before purging all trash ✅
- Already implemented — `bulkPurge()` and individual purge buttons both use `confirm()` dialogs

### Chit card: show checklist progress ✅
- Checklist view cards now show "3/7 ✓" count between header and checklist items

### Empty state messages with Create button ✅
- All views (Checklists, Tasks, Notes, Alarms, Projects, Itinerary) show styled empty state with "+ Create Chit" button
- Reusable `_emptyState()` helper in main.js

### Show chit count per tab ✅
- Tab labels show "(N)" count after each tab name, updated on every `displayChits()` call
- Counts reflect currently filtered/displayed chits (respects search, filters, archive state)
- Projects count uses unfiltered project masters (since Projects view ignores filters)

### Dashboard: loading spinner ✅
- Shows "⏳ Loading chits…" in chit-list on initial page load while fetching from API

### Itinerary view: show due-date chits ✅
- Due-date-only chits now appear in itinerary view alongside start_datetime chits
- Due-only chits show "⌚ HH:MM" or "⌚ All Day" in the time column
- Sorted by earliest date (start or due)


## Completed — Bug Fixes (2026-04-27)

### Tags in active zone expand to fill space ✅
- `.active-tag-item` now uses `display: inline-flex` and `width: fit-content` so chips wrap to minimum size instead of stretching

### Active Tags area overflows the Tags zone ✅
- `.active-tag-item` gets `max-width: 100%` and `overflow: hidden; text-overflow: ellipsis` to prevent overflow
- (Container already had `max-height: 200px` and `overflow-y: auto`)

### Enable button greyed out on disabled alarms row ✅
- Disabled alarm rows no longer use `opacity:0.5` on the wrapper (which dimmed the On/Off button too)
- Instead, individual inputs (name, time) and the days row get `opacity:0.45` while the toggle and delete buttons stay fully visible


## Completed — Low-Hanging Fruit Batch #3 (2026-04-27)

### Alarm & Notification checkboxes removed from editor ✅
- Vestigial Alarm/Notification checkboxes removed from editor UI (replaced with hidden inputs)
- All dead `.checked` toggle code cleaned up — flags are auto-derived from `_alertsData` on save

### Auto-apply default location to new chits ✅
- New chits auto-fill the location field from the user's default saved location
- Also triggers weather fetch for the default location

### Weather refresh button ✅
- 🔄 button in top-right corner of compact weather section in editor
- Clears localStorage cache and re-fetches weather data

### Alarm sound select dropdown removed ✅
- Removed non-functional sound dropdowns from alarm and timer modals (feature parked)

### Status null/clear option ✅
- Already existed — status dropdown has a "-" (blank) option as first choice

### Alarm "Delete After Dismissal" ✅
- New `delete_after_dismiss` checkbox on each alarm in the editor
- When checked and alarm is dismissed, the chit is soft-deleted via API
- Works in both editor and dashboard alarm toasts


## Completed — Visual Indicators (2026-04-27)

### Visual Indicators — Honor Settings in Views ✅
- Settings UI already clean: dropdowns for Alarm, Notification, Timer, Stopwatch, Weather, People, Health with Always/Never/If Space options, plus Combine Alerts toggle
- `visual_indicators` read from `window._cwocSettings` on dashboard load in all views via `_viSettings`
- Indicator visibility rules applied in all views via `_getAllIndicators()` + `_shouldShow()`:
  - `always` — always show the indicator icon
  - `never` — never show it
  - `space` ("If Space") — show on cards and calendar slots, hide on month cells
- Health ❤️ indicator added to `_getAllIndicators()` (shows when chit has health_indicators data)
- Itinerary view updated to show visual indicators on event cards
- Help page updated: renamed "Alert Indicators" to "Visual Indicators", documented all indicator types and visibility modes


## Confirmed Done — Task Cleanup (2026-04-27)

### Editing chits in-place in views (dates, times, notes) ✅
- Quick Edit Modal (Shift+click) works for ALL chits with editable dropdowns for Priority/Severity/Status
- Quick In-Place Edits in Notes View (double-click to edit, saves on blur)
- Calendar drag to move/resize events in Day/Week/7-Day views

### Status as multi-select field with "-" (null) option ✅
- Already existed — status dropdown has a "-" (blank) option as first choice

### "Show weather" toggle on sidebar ✅
- Handled via Visual Indicators settings (Always/Never/If Space) for Weather indicator
- Weather visibility controlled per-context (card, calendar, month) through settings

---

## Completed — Mobile Fixes (2026-04-28)

### Mobile: Page scrolls on long-word overflow ✅
- Added `word-break: break-word; overflow-wrap: break-word;` to body and chit cards on mobile (480px breakpoint)
- Prevents horizontal scroll caused by long unbroken strings

### Mobile: Long-press & drag triggers Quick Edit instead of drag ✅
- Increased long-press hold time from 500ms to 600ms and move threshold from 10px to 15px
- Added `window._touchDragActive` flag set by `enableTouchDrag` — `enableLongPress` checks this flag and skips if a drag is in progress
- Prevents long-press from firing when user is trying to scroll or drag

### Mobile: Projects view can only select text, can't drag ✅
- Projects view uses `enableTouchDrag` via `enableDragToReorder` which already has touch support
- The long-press conflict fix (above) resolves the interference

### Mobile: Tasks view no drag, pops up modal instead ✅
- Same root cause as long-press conflict — fixed by the `_touchDragActive` flag and increased thresholds

### Mobile: Month view expands all days to fit all contents ✅
- Added `max-height: 80px; overflow-y: auto;` to `.month-day` on mobile
- Day cells now scroll internally instead of expanding the entire grid

### Mobile: Year view only displays first month ✅
- Removed inline `style.flex = "1 0 25%"` and `style.minWidth = "200px"` from year view JS
- Added `.year-month` class with desktop defaults in CSS (`flex: 1 0 25%; min-width: 200px`)
- Mobile CSS override: `flex: none !important; min-width: 0 !important; width: 100% !important;`
- All 12 months now render in a single column on mobile

### Mobile: Itinerary view overflows and doesn't scroll ✅
- Added mobile CSS: `.itinerary-view { overflow-x: hidden; overflow-y: auto; width: 100%; }`
- Added `.itinerary-event { margin-left: 0; flex-wrap: wrap; word-break: break-word; }`
- Removed the 100px left margin on events that caused horizontal overflow

### Mobile: Swiping sidebar bars should only impact their own bar ✅
- Already implemented — sidebar swipe checks if views panel is open before opening, and vice versa
- Verified both handlers have cross-panel guards

### Mobile: Task view scroll vs drag-and-drop conflict ✅
- Fixed by the same `_touchDragActive` flag and long-press threshold changes

### Mobile: Refresh should reload current view ✅
- `displayChits()` now saves `{tab, view, weekStart}` to `sessionStorage` on every render
- `_restoreUIState()` checks `sessionStorage` for refresh recovery when no `localStorage` editor-return state exists
- Browser refresh now restores the exact tab, view, and date position

### Week/Day/X-Days view: chits render at half width unnecessarily ✅
- Root cause: overlap width calculation used the GLOBAL max overlap across all time slots in the day
- If two events overlapped at 2pm, ALL events that day (including a solo 9am event) got half width
- Fixed in Week view, Day view, and SevenDay/X-Days view: each event now calculates `localMax` only from the time slots it occupies
- Solo events render at full width; only events that actually overlap share width

### Weather indicator: icon-only with hover details ✅
- Changed `_buildChitHeader` weather display to show only the weather icon by default
- High/low temps and precipitation are in a `.chit-wx-detail` span, hidden via `display:none`
- On hover (`.chit-weather-indicator:hover .chit-wx-detail`), details appear inline
- Consistent across all views (Calendar cards, Tasks, Checklists, Alarms, Projects, Search)
- Removed the view-specific precipitation logic — precipitation now always included in hover detail when > 0

### Weather: icon-only display with tooltip details everywhere ✅
- All views now show only the weather emoji icon on chits — no inline text
- High/low temps and precipitation details are in the `title` attribute (native browser tooltip on hover)
- Removed `.chit-wx-detail` span and hover CSS entirely — no visible text on the chit at all
- Precipitation format: type-aware (rain/snow/thunder/drizzle), rounded to nearest cm
- If > 0 but < 0.5cm: just says the type word (e.g. "rain")
- If >= 0.5cm: says amount + type (e.g. "3cm snow")
- If no precipitation: says nothing (omitted from tooltip)
- Applied consistently in: _buildChitHeader (all card views), live-fetch callback, cache-hit display, editor compact weather, weather page day blocks


## Completed — Dashboard & Settings UI Overhaul (2026-04-28)

### Settings Page Layout Cleanup ✅
- Period Options reordered: Week Starts On and View Hours moved above Enabled Periods checkboxes
- X Days count input nested directly below X Days checkbox; Work Days/Hours nested below Work Hours checkbox
- Work Days moved above Work Hours for logical order; renamed consistently ("Work Days" / "Work Hours")
- Inline label+control rows (`.setting-inline` class) for: Time Format, Snooze Length, Calendar Snap, Week Starts On, Scroll to, X Days Count, Max Age, Max Size
- Sub-section headers (`.setting-subheader` class) for: Enabled Periods, View Hours, Work Days, Work Hours, Trash, Audit Log Limits, Chit Data, User Data
- Removed double-border on Chit Options and Visual Indicators (`.checkbox-list`/`.indicator-list` no longer have own background/border)
- Added `.setting-group h3` rule with bottom border for consistent group titles
- Tightened label font-size from 18px to 15px
- Fixed Custom Colors `<ul>` default bullet styling
- Added `.setting-hint` class for hint text, replacing inline styles
- All dropdowns forced to consistent 140px width via `.setting-group select` rule
- Hour range pairs use `.hour-range-row` class for equal-width flex layout
- Responsive: inline rows wrap on mobile (< 400px)
- Data Management `<h4>` tags converted to `.setting-subheader`
- Removed redundant `<hr>` separators (subheader borders provide visual breaks)

### Dashboard Sidebar Restructuring ✅
- Removed Save Search button (parked in parking_lot.md)
- Clock button removed from date nav area; moved to sidebar body next to Weather (side by side below People)
- Weather button: normal click → modal, Shift+click → full page (matching W/Shift+W hotkey pattern)
- Today button uses 📅 calendar icon, moved above date nav
- Year/month and date range displayed between ◄/► arrows (same row via `.week-nav-center`)
- Arrows stretch to full height of center content (`height: auto` override)
- Create Chit button directly under date nav
- Filters section collapsible via button toggle (fa-filter icon, expanded state uses darker background)
- Filter text input styled to match parchment theme
- Period and Order dropdowns styled to match parchment theme (fixed `#ffff0` typo)
- Removed all hotkey hint letters from sidebar buttons/labels
- Settings, Reference, Help buttons pinned to bottom of sidebar (flex layout with scroll wrapper)
- Sidebar uses `display: flex; flex-direction: column` with `.sidebar-scroll` wrapper for content scrolling

### X Days Date Bug Fix ✅
- `updateDateRange()` now uses `_customDaysCount - 1` instead of hardcoded `6` for SevenDay end date
- Sidebar date numbers now correctly reflect the configured X Days count

### Sort State Persistence Across Refresh ✅
- `sortField` and `sortDir` now saved to `cwoc_refresh_state` in sessionStorage
- Restored on page refresh along with tab, view, and weekStart
- Sort dropdown UI restored on refresh
- Manual order in Tasks view (and all views) now persists across refreshes

### Help & Reference Deep Update ✅
- New "Sidebar Layout" subsection documenting full sidebar organization
- Hotkeys section reorganized into sub-sections (Tab Switching, Actions, Submenu Hotkeys)
- Added V (Navigate), Shift+R (Help), G (Global Search) to hotkeys and reference overlay
- Filtering & Sorting section expanded with all filter groups and sorting options
- Settings section rewritten to match new layout
- Weather/Clock button descriptions updated for new sidebar location
- Version Management TOC entry renamed to "Version & Updates"


### Task view: weather icon only, no dates/weather text ✅
- Already implemented — Task view shows weather emoji icon only with details in tooltip; created/updated dates not shown in task cards

### Weather flash colors updated to match HST bar ✅
- Changed from yellowish-green `rgba(200,190,60,...)` to HST gold `rgba(212,175,55,...)` with tan outline `rgba(200,150,90,...)`
- Brightness dimming softened from 0.7 to 0.85 for a warmer, less harsh flash


### Custom Colors cleanup ✅
- Removed color name text from swatches — now shows only the colored circle
- Name and hex shown in tooltip on hover
- Swatches displayed as horizontal row (already was flex-wrap)

### Double-click span selection fix ✅
- Added `user-select: none` to `.chit-card` and `.timed-event` to prevent text selection flash on double-click

### Weather page: all blocks same height ✅
- Added `min-height: 90px` and `justify-content: center` to `.weather-day-block`


## Completed — Session 2026-04-28 (continued)

### System tags as sub-tags ✅
- `compute_system_tags()` now generates `CWOC_System/Calendar`, `CWOC_System/Checklists`, etc. instead of flat names
- Old flat system tags ("Calendar", "Checklists", etc.) are stripped from user tags before merging
- `isSystemTag()` updated to match both old flat format and new `CWOC_System/` prefix for backward compatibility

### Shared `createTagInline()` ✅
- New function in `shared.js` — creates a tag in the settings tag list from any page (editor, settings, dashboard)
- Checks for duplicates (case-insensitive), uses default colors, saves via `/api/settings` POST
- Returns `Promise<boolean>` — true if created, false if exists or failed

### All `confirm()` dialogs replaced with `cwocConfirm()` ✅
- Parchment-styled modal with ESC/click-outside to cancel
- Replaced in: settings.js, editor_projects.js, shared.js, editor.js, main.js, contact-editor.js
- All modal buttons now horizontal via `.modal-buttons` flex wrapper

### Color delete modal: buttons swapped, "KEEP" → "Cancel" ✅
- Cancel button now on left, Delete button on right with danger styling

### Custom Colors: horizontal rows with proper spacing ✅
- Fixed `.color-list` class not matching `<ul id="color-list">` — added `class="color-list"`
- Swatches now display in horizontal rows with 1em gap

### Tag default colors updated ✅
- Background: `#d4c4b0` (light mauve-taupe)
- Text: `#5c3317` (amber/umber), bold, 1em size
- High contrast, warm, generic


### Weather: save per-chit, display on calendar, weather page with city rows ✅
- Weather data saved per chit (forecast fields: focus, updated time, high, low, precipitation, weather code)
- Weather displayed on calendar views (icon + tooltip)
- Weather page with city rows for non-saved-location chits (grouped by city, sparse day blocks)

### Alerts: persistent/nag mode, before/after start/due, default sound/snooze ✅
- Persistent/nag/alarm mode (force acknowledgement) — implemented via looping alarm sound
- Create alerts based on: arbitrary time, X units before/after start, X units before/after due — notification timing dropdown
- Setting: default snooze length — configurable in settings

### Data Management (Settings Page) ✅
- New "Data Management" settings box with download/upload controls
- Separate controls for Chit data and User data
- Export as JSON, Import with Add or Replace modes
- Replace mode: confirmation dialog
- Exported format self-contained and portable

### Calendar: weather on date block, city rows on weather page ✅
- Weather & clock on calendar date blocks
- Calendar view: per-city weather rows on weather page

### All-day section: capped height with scroll ✅
- Max-height 100px (~5 rows of text) with overflow-y: auto

### Mobile swipe navigation ✅
- Horizontal swipe on calendar chit-list navigates periods (left = next, right = previous)
- Only on Calendar tab, only when sidebar is closed, ignores edge-zone swipes (sidebar territory)

### ToDo cleanup ✅
- Removed completed items (Data Management, Weather page, Alerts, Calendar weather)
- Removed "move to done" annotations
- Removed already-done markers ([X])
- Cleaned up spelling and formatting


## Completed — Session 2026-04-29

### Notification Timing Dropdown Redesign ✅
- Replaced separate "before/after" dropdown + "start/due" label with single combined dropdown: "before start", "after start", "before due", "after due"
- Added `targetType` field to notification data model
- Both editor and dashboard notification checkers use `targetType`

### Loop Notification Until Acknowledged ✅
- 🔁 loop toggle on each notification in the editor
- Looping notifications re-fire every 60 seconds until user clicks "Acknowledge"
- Persistent toast in editor, `_showGlobalLoopingToast` on dashboard

### Notification Button Always Visible ✅
- Removed `_updateNotificationBtnVisibility()` — "Add Notification" button always shown regardless of date mode

### Health Indicators Save Fix ✅
- `_gatherHealthData()` returns an object but Pydantic model expects JSON string
- Now wrapped with `JSON.stringify()` before sending to backend

### Calendar Snap Grid Deferred to Drag ✅
- Snap grid and opacity change only appear once actual dragging begins, not on single click/tap

### Settings Double Footer Fix ✅
- Removed manual `<div class="author-info">` from settings.html — shared-page.js auto-injects it

### Quick Alert Hotkey (!) — Full Inline Editor ✅
- Press `!` → pick A/T/S → modal transforms into full editor form for that type
- Alarm: name, time picker, day checkboxes
- Timer: name, HH:MM:SS duration, loop checkbox
- Stopwatch: name field, auto-starts on create
- Buttons: Create (Enter), Create & View (Shift+Enter), Cancel (ESC)
- Works on ALL pages (inline styles, no CSS dependency)
- Editor: adds to chit alerts zone, expands and scrolls to it
- Dashboard: creates independent alert, jumps to Alerts tab independent view
- Other pages: creates via API, shows toast with View link

### Quick Alert Editor Detection Fix ✅
- Fixed `chit-form` → `mainEditor` for editor page detection
- Fixed zone expansion checking `alertsSection` instead of `alertsContent`

### Quick Alert CSS Fix ✅
- Modal CSS was in `shared-page.css` (not loaded on dashboard/editor)
- Converted all styling to inline styles so it works on every page

### ESC Closes Alert Modals ✅
- Both `_showAlertModal` (dashboard) and `_sharedShowAlertModal` (all pages) now allow ESC to dismiss
- Stops all sounds, persists dismiss state, removes modal

### Sound Stops on Dismiss ✅
- All dismiss/snooze/ESC handlers now call both `_globalStopAlarm/Timer` AND `_sharedStopAlarm/Timer`

### Reference Overlay Redesign ✅
- 3-column tree layout: Direct keys, Submenus (with ▸ and indented children), Mouse & Editor
- No abbreviations, dark font (#1a1208), 1em items, 800px max-width
- Clickable links to Settings, Weather, Help, People, Audit Log, Trash
- max-height: 90vh with scroll, mobile-responsive

### Topbar Toggle Expands Content ✅
- `~` hides header AND adjusts chit-list margin/height to fill freed space
- Persists across page loads via localStorage

### Version Logging ✅
- Every page load logs `[CWOC] Version XXXXXXXX.XXXX — /path` to console.info

### Indicator Charts — 2-Column Grid ✅
- Charts always display in 2 columns (not auto-fill 3+)
- Expand button hides all other charts, fills available height
- Collapse properly resets height/aspect-ratio (fixed missing `height:''` clear)

### Indicator Latest Cards ✅
- Grid fills full row width with `repeat(auto-fit, minmax(0, 1fr))`
- Hover title shows chit title and date
- Click navigates to chit editor

### Timer Decimal Places Fix ✅
- `fmtTimer` now uses `Math.floor(s % 60)` to prevent floating-point display artifacts

### Jump-to-Tab from Other Pages ✅
- "Create & View" on non-dashboard pages stores tab intent in localStorage
- Dashboard init reads and applies it on load


### Cross-Project Drag & Drop in Kanban View ✅
- Cards can now be dragged from one project's Kanban column to another project's column
- Automatically removes the chit from the source project's `child_chits` and adds to the target project's
- Also updates the chit's status to match the target column
- Uses existing `application/x-kanban-card` drag data which already includes `projectId`

### Export All / Import All ✅
- New `GET /api/export/all` endpoint exports chits + settings + contacts + standalone alerts in a single combined envelope (type "all")
- New `POST /api/import/all` endpoint imports the combined envelope, supports "add" and "replace" modes
- Settings page: "Export All" and "Import All" buttons added above the individual Chit/User data sections
- Import All validates envelope type is "all" and shows helpful error for wrong file types

### Import Double-Confirm on Replace ✅
- Replace mode now uses `cwocConfirm()` with two sequential confirmations
- First: "This will permanently replace all X data. This cannot be undone." with danger styling
- Second: "Are you REALLY sure you want to nuke ALL X data and replace it?" with danger styling
- Applies to all import types (chits, userdata, all)
- Replaced the old modal-based confirm with the standard `cwocConfirm` pattern

