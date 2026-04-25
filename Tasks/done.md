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
