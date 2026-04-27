# CWOC — Completed Items

*Extracted from AI Notes and Bugs.md. Items confirmed fixed in the codebase.*

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
