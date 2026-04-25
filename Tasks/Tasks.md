# CWOC — Open Bugs & Planned Features

*Active tasks, bugs, and feature requests. Completed items are in `done.md`.*

---

## Hotkey-Driven UI Overhaul (from UI Prototype)

This is the next major feature. Port the hotkey-driven interaction model from `Prototypes/CWOC UI/UI.html` into the working dashboard. All hotkeys work only when not typing in an input/textarea/select. All existing click interactions continue to work alongside the new hotkeys.

### Hotkey Map — Top Level

| Key | Action |
|---|---|
| C | Switch to Calendar tab |
| H | Switch to Checklists tab |
| A | Switch to Alerts tab |
| P | Switch to Projects tab |
| T | Switch to Tasks tab |
| N | Switch to Notes tab |
| K | Create new chit (navigate to editor) |
| S | Settings |
| . | Enter Period submenu (calendar view selector) |
| F | Enter Filter submenu |
| O | Enter Order submenu |
| R | Toggle Reference overlay (floating modal) |
| ESC | Exit any active submenu, return to normal |

### Hotkey Map — Period Submenu (after `.`)

Only active when in Calendar tab. Pressing `.` highlights the period selector in the sidebar and dims everything else.

| Key | Action |
|---|---|
| I | Itinerary |
| D | Day |
| W | Week |
| M | Month |
| Y | Year |
| S | 7-Day (Seven Days) |
| ESC | Exit period submenu |

### Hotkey Map — Filter Submenu (after `F`)

Pressing `F` highlights the filter section in the sidebar and dims everything else. Sub-keys open the relevant filter control.

| Key | Action |
|---|---|
| S | Open Status multi-select |
| T | Open Tags multi-select |
| P | Open Priority multi-select |
| A | Toggle Archived filter |
| I | Toggle Pinned filter |
| W | Focus search/words filter |
| ESC | Exit filter submenu |

Inside Status, Label, and Priority multi-selects: use number keys (1, 2, 3...) to toggle individual options, Enter or the same letter key to confirm and close.

### Hotkey Map — Order Submenu (after `O`)

Pressing `O` highlights the sort section in the sidebar and dims everything else.

| Key | Action |
|---|---|
| T | Sort by Title |
| S | Sort by Start date |
| D | Sort by Due date |
| U | Sort by Updated (modified_datetime) |
| C | Sort by Created (created_datetime) |
| M | Manual order |
| ↑ / ↓ | Toggle Asc / Desc |
| ESC | Exit order submenu |

Pressing the same sort key again while already selected does nothing (use arrows for direction). Pressing a different key switches to that sort field.

### Submenu Dimming Behavior

When a submenu is active (F, O, or .):
- All sidebar sections NOT relevant to the submenu get a semi-transparent gray overlay (CSS overlay or opacity + grayscale filter) — visually dulled but still visible
- The relevant section stays at full opacity/color and is fully interactive
- The relevant section auto-expands if collapsed
- As sub-options are picked within the submenu, dimming spreads — e.g., after `F` then `S`, only the Status multi-select is fully bright, the rest of the filter section also dims
- Clicking anywhere outside the active section, or pressing ESC, exits the submenu and removes all dimming
- Implementation: likely a CSS class `.sidebar-dimmed` on non-active sections with `opacity: 0.3; filter: grayscale(50%); pointer-events: none;` and the active section gets `.sidebar-active` with full opacity and pointer-events restored

### Reference Overlay (R)

- Floating modal over the main content area (not in the sidebar)
- Shows all available hotkeys organized by category (tabs, period, filters, order, general)
- Toggle on/off with `R` key
- ESC also closes it
- Keep this up to date as hotkeys change
- Styled to match the 1940s parchment aesthetic (like the prototype)

### Sidebar Reorganization

Current sidebar order stays at the top (year/week display, nav arrows). Below that, reorder to:

1. **Create** — Create Chit button (hotkey: K)
2. **Order** — Sort field selector + Asc/Desc (hotkey: O then sub-key + arrows). Includes Title, Start, Due, Updated, Created, Status.
3. **Period** — Itinerary / Day / Week / Month / Year / 7-Day (hotkey: `.` then sub-key). Only visible when Calendar tab is active. Date nav arrows also Calendar-only.
4. **Filters** — Status (multi-select), Label/Tag (multi-select), Priority (multi-select), Archived (toggle), Pinned (toggle), Search/Words (text input). Hotkey: `F` then sub-key.
5. **Settings** — (hotkey: S)

### Multi-Select Filters (new)

Replace the current single-select status dropdown with multi-select controls:

- **Status filter**: multi-select checkboxes for `-` (none), ToDo, In Progress, Blocked, Complete. Multiple can be active. Shows active selections as comma-separated text.
- **Label/Tag filter**: multi-select from user-defined tags (loaded from settings API). Same toggle behavior.
- **Priority filter**: multi-select for Low, Medium, High.
- **Archived toggle**: on/off
- **Pinned toggle**: on/off

All filters applied in `displayChits()` pipeline after search, before sort. When no options selected in a multi-select, show all (no filtering on that dimension).

### Sort Options (expanded)

Add to existing sort options (Title, Start, Due):
- **Updated** — sort by `modified_datetime`
- **Created** — sort by `created_datetime`
- **Manual** — manual drag-to-reorder (future; placeholder for now)

All sort options support Asc/Desc via ↑/↓ arrows (except Manual).

### Files to Change

- `frontend/index.html` — sidebar HTML restructure, add filter controls, rename View→Period
- `frontend/main.js` — hotkey state machine, submenu modes, dimming logic, multi-select filter functions, expanded sort, reference overlay
- `frontend/styles.css` — dimming classes, reference overlay styles, multi-select filter styles

---

## Calendar Drag & Editor Date Overhaul

Major feature: draggable calendar events, editor date field restructure, snap-to-grid, due-date calendar display.

### Phase 1: Editor Date Fields Overhaul
**Files:** `frontend/editor.html`, `frontend/editor.js`, `frontend/editor.css`

- `[x]` Add radio buttons for date mode: None / Due / Start&End
- `[x]` Restructure Start/End row: single row layout
- `[x]` Restructure Due row: single row layout
- `[x]` None row: just `(○ None)` radio, no fields
- `[x]` Move All Day checkbox from zone header to inline with Start/End row
- `[x]` Time picker: click to type in existing box, dropdown shows 5 snap-increment times
- `[x]` Time inputs preload existing values when clicked/focused
- `[x]` Greyed-out fields: visible but `opacity: 0.3`, `pointer-events: none`

### Phase 2: Calendar Snapping Setting
**Files:** `frontend/settings.html`, `frontend/settings.js`, `backend/main.py`

- `[x]` Add "Calendar Snapping" option to settings page
- `[x]` Add `calendar_snap` field to settings DB schema + Pydantic model
- `[x]` Add migration for existing DBs
- `[x]` Load snap setting in editor (for time picker dropdown) and dashboard (for drag)

### Phase 3: Calendar Display — Due Date Chits & All-Day Fix
**Files:** `frontend/main.js`, `frontend/styles.css`

- `[x]` Due-date-only chits appear on calendar:
  - All-day due date → all-day event strip
  - Timed due date → 10px tall timed event at due time, with ⌚ icon before title
- `[x]` If chit has both due AND start/end, use due date (ignore start/end) per editor rules
- `[x]` Fix all-day section layout in Day/Week/7-Day views:
  - Structure: Date header → All-day events (block, not floating) → Scrollable hourly grid
  - All-day section is above the time grid, not overlapping it
- `[x]` ⌚ icon on due-date-only chits (no start/end) in calendar views

### Phase 4: Calendar Drag — Move, Resize, Snap Grid
**Files:** `frontend/main.js`, `frontend/shared.js`, `frontend/styles.css`

- `[ ]` Drag to move (Day/Week/7-Day views):
  - Vertical: change time, snap to configured interval
  - Horizontal: change day (Week/7-Day only)
  - For start/end chits: update start_datetime, shift end_datetime to preserve duration
  - For due-date-only chits: update due_datetime
  - Save on mouse release (PUT to API)
- `[ ]` Drag bottom edge to resize (Day/Week/7-Day views):
  - Changes end time, snaps to configured interval
  - For due-date-only chits: not applicable (no end time)
  - Save on mouse release
- `[ ]` Snap grid lines (Day/Week/7-Day views):
  - Appear only during active drag
  - Light grey horizontal lines at each snap interval
  - Time labels in light grey between lines
  - Appear in all day columns, not just the one being dragged
- `[ ]` Month view drag:
  - Drag chit from one day cell to another
  - Shifts start/end/due dates by the day difference, preserving times
  - Save on release
- `[ ]` No drag in Year or Itinerary views
- `[ ]` All-day events: draggable between days (horizontal only), not vertically

---

## Open Bugs

### BUG-016 — Week View Start Day Is Monday, Not Sunday
**File:** `frontend/main.js` — `getWeekStart()`  
**Severity:** Low / UX  
`getWeekStart()` uses `(day + 1) % 7` which makes the week start on **Monday**. May be unexpected for US users. Worth documenting as a design choice or making configurable.

---

## Known Issues (from Design Doc)

- `[ ]` Projects filter doesn't do anything when clicked
- `[ ]` Tags in the active zone expand to fill space — should be minimum size to wrap text only
- `[ ]` Active Tags area overflows the Tags zone
- `[ ]` Weather bar transparent background shouldn't apply when color is removed
- `[ ]` Can't save health indicators
- `[ ]` The unarchived icon is unavailable — use a different icon
- `[ ]` Month view: fill in pre- and post-month days so the full grid square is filled
- `[ ]` Calendar/Day view doesn't work
- `[ ]` Enable button is greyed out with the rest of the row on disabled alarms

---

## Incomplete Features

| Feature | Status | Notes |
|---|---|---|
| Recurrence | ❌ Field only | `recurrence` and `recurrence_id` stored but no logic |
| Health indicators | ❌ Stub | `renderHealthIndicator()` is empty; 9 indicator IDs referenced |
| Email integration | ❌ Prototype only | Full Python Flask email client in `_Waiting for Home Base/CWOC Email/` |
| Visual indicators | ⚠️ Settings UI only | Saved to DB but not rendered anywhere in main views |
| Drag-drop on calendar | ❌ Not started | No drag-drop for rescheduling events on calendar |
| Chit options (fade past, highlight overdue) | ⚠️ Settings only | Saved but not applied in view rendering |
| People zone | ⚠️ Basic | Comma-separated input; no contact lookup or management |

---

## Planned Features — Near-term

- `[ ]` Primary Tag that auto-colors the chit (first colored tag sets the color)
- `[ ]` Status: add `"-"` / N/A option
- `[ ]` Notification based on start time + location + total drive time
- `[ ]` Hide end date unless explicitly needed
- `[ ]` Hotkeys to jump to and expand each Zone (editor)
- `[ ]` Setting for home/default address (for weather)
- `[ ]` Extract tag/color creation code from Settings and reuse in Chit Editor
- `[ ]` People zone: use a modal for adding people (with autocomplete dropdown + multi-select role list)
- `[ ]` Fix filters in People, Alerts, and Projects zones (multi-select dropdown touching the button)
- `[ ]` Tags: add Starred/Favorite status so they always appear at top
- `[ ]` Jitter for reminders (±X minutes, configurable globally and per-chit)
- `[ ]` Alarm: chained variable-length intervals (5 min, then 4 min, then 4 again...)
- `[ ]` Alarm: snooze options (1, 3, 5, 10 minutes)
- `[ ]` Alarm: "Delete After Dismissal" checkbox
- `[ ]` Alarm: fix looping ping (should ping once per cycle, not continuously)
- `[ ]` Calendar: X Days view (custom number of days, text input)
- `[ ]` Month view: fill in pre/post days for full grid
- `[ ]` Sidebar: save a search as a one-click button
- `[ ]` When creating a chit from any view, hide all zones other than the matching one, focus in that zone's 1st input
- `[ ]` Drag & drop in calendar view to change start time (15-min snap, preserve duration). Also drag lower edge to extend end-time. Not in month or year view.
- `[ ]` After editing checklists from the view, drag & drop checklist items (and sub-items) from one chit to another

---

## Planned Features — Medium-term

- `[ ]` Recurrence: full implementation (daily/weekly/monthly/yearly + sub-chit numbering + success rate reporting)
- `[ ]` Auto-archive recurring events on completion
- `[ ]` Busy/Free/Unspecified status for chits (especially calendar events)
- `[ ]` Declined events view
- `[ ]` Rolling circular chits view (show only next task in project, repeat when done)
- `[ ]` Wall/kiosk view for persistent displays
- `[ ]` Side-by-side notes view (2 chits for copy/paste/reference)
- `[ ]` Quick in-place edits in Notes view
- `[ ]` Export: download/copy as Markdown (notes, checklists)
- `[ ]` Export: chit to iCal event
- `[ ]` Import/export CSV
- `[ ]` Auto-generated QR codes per chit
- `[ ]` Chit URL (direct link by ID)
- `[ ]` Universally unique installation instance ID
- `[ ]` Audit logs
- `[ ]` Working days/hours configuration
- `[ ]` Context switching: hide chits based on time schedule and tags
- `[ ]` Random sort order (for recipes, etc.)
- `[ ]` Upcoming tasks view
- `[ ]` Show events by map

---

## Planned Features — Long-term / Dream

- `[ ]` User management (login, user switcher, multi-user)
- `[ ]` Multi-owner view for wall stations/common areas
- `[ ]` Shared chit view / "Chits Assigned to Me"
- `[ ]` Object & Inventory Tracking zone in chits
- `[ ]` Biometric notification triggers (e.g., after 10k steps, add to shopping list)
- `[ ]` Proximity-based notifications (your location, someone else's location)
- `[ ]` Home Assistant integration (HACS fragment)
- `[ ]` Local device storage with server sync
- `[ ]` Phone app with offline store + sync
- `[ ]` Obsidian sync (auto-export notes as Markdown to a folder)
- `[ ]` Email integration (prototype exists at `_Waiting for Home Base/CWOC Email/`)
- `[ ]` Goals system (completion % targets, grading, success/failure/abandoned)
- `[ ]` Reports system
- `[ ]` Automations (if this, then that) — the "A" in C CAPTN
- `[ ]` Appointments (from other people) — also "A"
- `[ ]` Fragments to GitHub
