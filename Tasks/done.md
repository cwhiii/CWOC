# CWOC — Completed Items

*Active tasks in `ToDo.md`. Deferred items in `parking_lot.md`. Declined in `path_not_traveled.md`.*

---

## Bug Fixes

### Editor
- BUG-001: `chitExists()` defined twice — first duplicate removed
- BUG-002: `loadChitData` skipped fields for project master chits — now populates all fields
- BUG-005: `isValidMediaSource()` defined twice — first duplicate removed
- BUG-006: `markEditorSaved()` disabled save button on load — merged into single init listener
- BUG-009: `loadChitData` condition always true for new chits — replaced with `window.isNewChit` flag
- BUG-010: `allDay` field mismatch between save and load — full backend+frontend fix
- BUG-011: Tags not loaded when editing existing chit — `loadChitData` now calls `renderTags()`
- BUG-012: Location and people not loaded — both fields now restored
- BUG-013: Color not restored — `loadChitData` now calls `setColor()`
- BUG-014: Pinned/archived state not restored — hidden inputs and icon classes restored
- BUG-015: `displayChecklistView` checks wrong field — now checks both `item.checked` and `item.done`
- BUG-017: `setSaveButtonSaved` and `markEditorSaved` redundant — thin wrappers delegating to single source
- BUG-018: Header row changes color when chit color picked — `headerRow.style.backgroundColor` removed
- BUG-019: Notes saving to single line / rendering as plaintext — uses `marked.parse()`
- BUG-020: Health Indicators zone buttons collapse the whole zone — `toggleZone()` checks for buttons/inputs
- BUG-022: DB_PATH pointed at wrong file — corrected to `/app/data/app.db`
- BUG-008: `update_chit` fetches row but checks after building tags — `fetchone()` called immediately after SELECT
- BUG-007: `get_all_chits` closes DB connection in `finally` even on error — all endpoints now init `conn = None`
- Cancel button invisible: added `.modal` + `.modal-content` CSS to shared-editor.css
- Loading guard flag suppresses false unsaved marking during initial data load
- Notes fullscreen "all red" text fixed
- Render button race condition fixed (blur handler skips when Render button is click target)
- Repeat row: dropdown + "Ends never" now inline with Repeat checkbox
- Zone collapse/expand rewritten: uses `display:none` on content + toggle icon text update
- Tags in active zone expand to fill space — uses `inline-flex` and `width: fit-content`
- Active tags area overflow — `max-width: 100%` with `overflow: hidden; text-overflow: ellipsis`
- Enable button greyed out on disabled alarms row — individual inputs dimmed, toggle stays visible
- Health indicators save fix — `JSON.stringify()` before sending to backend
- Calendar snap grid deferred to drag (not on single click/tap)
- Settings double footer fix — removed manual `<div class="author-info">`
- Quick alert editor detection fix (`chit-form` → `mainEditor`)
- Quick alert CSS fix — converted to inline styles for all pages
- Timer decimal places fix — `Math.floor(s % 60)` prevents floating-point artifacts
- Habits mode notification fix — habit cycle reminders now fire from any page
- Habit charts HiDPI fix — canvas backing store scaled by `devicePixelRatio`
- Admin password reset fix — invalidates all target user sessions
- X Days date bug — uses `_customDaysCount - 1` instead of hardcoded `6`
- Week/Day/X-Days view: chits render at half width unnecessarily — fixed overlap calculation to use local max
- Double-click span selection fix — `user-select: none` on chit cards
- Weather bar background fix — `!important` on `#compactWeatherSection`
- Alarm looping fix — plays 3 times then stops instead of infinite loop
- Orphaned CSS fragment in styles.css fixed

### Backend
- All endpoints: `conn = None` guards with try/finally pattern
- `update_chit` fetchone fix
- DB_PATH corrected

### Mobile
- Page scrolls on long-word overflow — `word-break: break-word` on mobile
- Long-press & drag triggers Quick Edit instead of drag — increased thresholds + `_touchDragActive` flag
- Projects view can only select text, can't drag — fixed by touch drag flag
- Tasks view no drag, pops up modal instead — same root cause fix
- Month view expands all days to fit all contents — `max-height: 80px; overflow-y: auto`
- Year view only displays first month — CSS override for single-column mobile layout
- Itinerary view overflows and doesn't scroll — removed 100px left margin, added overflow rules
- Task view scroll vs drag-and-drop conflict — same touch drag flag fix
- Refresh should reload current view — `sessionStorage` state save/restore
- Swiping sidebar bars only impact their own bar — cross-panel guards verified

---

## Codebase Refactor (2026-04-26)

### CSS Variable Consolidation
- Documented `shared-page.css` as canonical source of truth
- Synced all shared variable values across `:root` blocks
- Removed unused CSS variables
- Extracted repeated inline styles into CSS classes

### JS Utility Consolidation
- Moved `generateUniqueId()`, `formatTime()`, `setSaveButtonUnsaved()` to `shared.js`
- Removed duplicates from `editor.js`, `editor_projects.js`, `main.js`, `settings.js`

### Backend Reorganization
- Added section headers to `backend/main.py`
- Moved inline imports to top
- Grouped route handlers by resource type
- Standardized connection patterns

### Code Quality Pass
- Removed dead checklist stubs, triple-duplicated comments, debug console.logs
- Cleaned up redundant comments
- Extracted repeated inline styles into CSS classes

### Performance Audit
- `DocumentFragment` batching in 6+ calendar rendering spots
- `getCachedSettings()` / `_invalidateSettingsCache()` for deduplicating settings API calls
- Fixed event listener duplication in editor and dashboard

---

## Hotkey-Driven UI Overhaul (2026-04-25)

- Top-level hotkeys: C/H/A/P/T/N (tabs), K (create), S (settings), . (period), F (filter), O (order), R (reference), ESC (exit)
- Period submenu (. → I/D/W/K/X/M/Y)
- Filter submenu (F → S/T/P/A/I/W) with multi-select status, tags, priority
- Order submenu (O → T/S/D/U/C/X/M/R/G) with ↑↓ for asc/desc
- Full-screen overlay dimming with floating panels for submenus
- Reference overlay (R) with all hotkeys
- Sidebar reorganized: Create → Order → Period → Filters → Settings
- Multi-select filters (status, tags, priority, archived, pinned)
- Expanded sort options (title, start, due, updated, created, status, manual, random, upcoming)
- Manual drag-to-reorder with per-view localStorage persistence
- Shift+ESC clears all filters in active panel
- Clear All Filters button
- Today button in calendar sidebar
- Editor zone hotkeys: Alt+1 through Alt+0
- Saved searches (💾 button, chips below search box)
- Jump-to-tab from other pages via localStorage
- V (Navigate) submenu, Shift+R (Help page), G (Global Search)
- Quick Alert hotkey (!) with full inline editor for Alarm/Timer/Stopwatch

---

## Calendar & Scheduling

### Calendar Drag & Editor Date Overhaul (2026-04-25)
- Radio buttons: None / Due / Start&End (mutually exclusive)
- Single-row layouts with time picker dropdown and snap increments
- All Day checkbox inline, Repeat inline
- Auto-colon mask for HH:MM time inputs
- Calendar snapping setting (None, 5, 10, 15, 20, 25, 30, 60 min)
- Due-date-only chits on calendar (all-day or timed with ⌚ icon)
- Collapse/expand toggle for all-day bar
- Tooltips on all calendar events
- Today's date highlighted in all views
- Drag to move (Day/Week/7-Day): vertical=time, horizontal=day, snap to grid
- Drag bottom edge to resize (start/end chits only)
- Month view drag between day cells
- All-day events draggable between days
- Save on mouse release (PUT to API)
- Multi-day timed events span across day columns
- Multi-day all-day events span via CSS Grid
- Calendar empty slot double-click creates new chit at that time
- Overlapping events side-by-side (Week, 7-Day, Day views)
- All-day events row packing with column-span collision detection

### Recurrence — All 3 Phases (2026-04-26)
- Phase R1: Basic recurrence — editor picker, expandRecurrence(), calendar display, 🔁 icon
- Phase R2: Instance editing — complete/edit/break-off/skip/delete per instance, quick edit modal, PATCH endpoint
- Phase R3: Series management — Part #X indicator, end date, success rate, auto-archive, series summary

### Calendar Views & Periods
- 7-day / X-day view (configurable 2-30 days)
- Working Hours period view (only shows configured hours)
- Week start day configurable (Sun-Sat)
- Enabled periods setting (hide/disable unwanted periods)
- Working days setting (day-of-week checkboxes)
- Scroll to 6am / 30 min before current time on load
- Now-bar (red line at current time, updates every minute)
- Month view: prev/next month days shown, double-click empty day creates chit
- Fade past chits (45% opacity), highlight overdue (red border)
- Pinned indicator (bookmark icon) on calendar events
- Calendar drag: modifier keys don't start drag, click-without-move doesn't save
- Mobile swipe navigation for calendar periods

### Notifications & Alerts
- Notify at start/due time (browser notifications + toast)
- Per-chit notify flags (checkboxes in Alerts zone)
- Snoozable notifications (snooze registry, configurable duration)
- Notification timing dropdown: before/after start/due combined
- Loop notification until acknowledged (🔁 toggle, re-fires every 60s)
- Notification button always visible regardless of date mode
- "Only if undone" checkbox on notifications
- Notification custom message (appended text)
- Persistent/nag mode (force acknowledgement)
- Alarm "Delete After Dismissal" option
- ESC closes alert modals, stops all sounds
- Quick Alert (!) — full inline editor for Alarm/Timer/Stopwatch on all pages

---

## Tags & Filters

### Nested Tags (2026-04-25)
- Tags stored as full paths with `/` separator
- Expandable/collapsible tag tree hierarchy
- Favorites row (⭐ tags at top), Recent row (3 most recently used)
- Active tags panel shows full paths, excludes system tags
- Descendant matching in sidebar filter
- Tag search box, indented tree display with checkboxes and colors
- Shared code: `buildTagTree()`, `flattenTagTree()`, `matchesTagFilter()`, `renderTagTree()`, `isSystemTag()`
- System tags as sub-tags (`CWOC_System/Calendar`, etc.)
- Tag color inheritance (child inherits parent unless overridden)
- Child tag auto-prefix in settings ("+" button)
- Tag font color picker added (swatches + color input)
- Tag default colors updated (light mauve-taupe bg, amber/umber text)
- Primary tag auto-colors chit (when color is "transparent")
- Shared `createTagInline()` for creating tags from any page

### Sidebar & Filters
- Collapsible filter sub-sections (Search, Status, Priority, Tags, Show)
- Auto-expand filter groups on hotkey activation and state restore
- "Any" option on Status and Priority
- Clear button per filter group, Backspace hotkey clears filters
- Tag filter modal with search box
- Default filters per tab (saved in settings)
- Hide Past-Due filter checkbox
- Persistent scrollbar on sidebar and tag panels
- Full UI state saved/restored: tab, view, weekStart, sort, filters, archive/pinned
- Sort state persistence across refresh (sessionStorage)

---

## Editor Features

### Quick Edit Modal (Shift+click)
- Works for ALL chits (not just recurring)
- Editable dropdowns for Priority/Severity/Status with per-field "All" checkbox for recurring
- Pin/Archive/Delete action row
- Delete sub-menu for recurring: this instance / this and following / all
- Recurrence buttons: icon-only row
- Series info: instance number, success rate

### Editor Improvements
- "Weight" zone renamed to "Task" (Status → Priority → Severity)
- Complete checkbox on Due date line (syncs with Status dropdown)
- Date validation: require date + time (or All Day) when date mode active
- Repeat: checkbox-based toggle with dynamic context labels
- Instance editing banner for single recurrence instance
- Audit Log zone for recurring chits
- Pre-populate start/end from URL params (calendar empty slot click)
- Tag buttons wired up: Expand All, Collapse All, Create New, Clear Search, Add Searched Tag
- Auto-focus title field on new chit (350ms delay)
- New chit collapses all zones except the one matching source view tab
- "Normal" severity level added
- Expanded notes modal buttons: "✕ Cancel" / "✓ Done" with FA icons
- Ctrl+Shift+S to save & stay
- Checklist auto-complete / auto-archive (🏁 button cycles modes)
- Checklist ↔ Note conversion (additive, preserves indentation)
- Busy/Free/"-" availability field in Task zone

### Attachments Zone
- Full attachment infrastructure: backend routes (upload, download, delete)
- Frontend zone with drag-drop, file list, thumbnails, size limits

---

## Views & Dashboard

### Notes View
- Masonry layout with column-persistent cards
- Markdown rendering with `marked.parse()`
- Quick in-place edits (double-click to edit, saves on blur)
- Notes auto-link `[[title]]` with autocomplete dropdown
- Column count recalculates on sidebar toggle
- Markdown headers: transparent background, proper sizing

### Tasks View
- Default sort by status (ToDo → In Progress → Blocked → Complete)
- Note preview with rendered markdown
- Scrollable container, unabbreviated meta labels
- Habits mode, Assigned mode

### Projects View
- Tree view with project master cards and nested child chits
- Kanban mode with List/Kanban toggle
- Kanban: cards draggable between status columns
- Kanban: grandchildren as sub-items, draggable between parents
- Cross-project drag & drop in Kanban view
- Move to Project dropdown populated from data

### Alerts View
- Shows all chits with alarms, notifications, timers, or stopwatches
- Timer/stopwatch inline widgets with live displays
- Notify-at-start/due flags no longer count as alerts for view filtering
- Independent alerts board

### Other Views
- Itinerary view: shows due-date chits alongside start_datetime chits
- Chit card: show checklist progress ("3/7 ✓")
- Empty state messages with Create button for all views
- Tab count indicators (updated on every `displayChits()` call)
- Dashboard loading spinner
- Visual indicators honor settings (Always/Never/If Space) in all views
- Weather icon-only display with tooltip details everywhere
- Indicator charts: 2-column grid, expand/collapse, latest cards

---

## People & Contacts

- Contact editor: auto-focus given name on new contact
- Suffix dropdown reordered (text suffixes before numeric)
- Markdown notes field added (Notes zone)
- Tags field added (Tags zone, auto-prefixed with "Contact/")
- Contact editor hotkeys (Alt+7 Notes, Alt+8 Tags)
- Users in rolodex: view user like a contact, favorite them
- User profile includes all contact fields + user/contact indicator
- Expanded people modal in chit editor for managing invitations
- Favorites header darker background in expanded people modal
- Sortable headers in expanded people modal (ascending/descending)
- Contact/user chip color distinction (blue for contacts, gold for users)

---

## Multi-User & Sharing

- User management system complete
- Sharing chits project — requirements updated
- Event invitations: accept/reject, status visible to inviter, appears on invitee's calendar
- Declined events toggle
- Invite control banner for invitees
- User switcher as modal (profile image in top-right)
- Username input removed from settings (admin-only in user admin page)
- Manage Users button in settings (greyed for non-admin)
- Stealth mode greys out sharing & assignment options
- Admin password reset invalidates sessions
- Admin username update working

---

## Settings & Configuration

### Settings Page Layout
- Period Options: Week Starts On, View Hours, Enabled Periods, X Days, Work Days/Hours
- Inline label+control rows, sub-section headers
- Tightened styling, consistent dropdown widths
- Data Management section with download/upload controls
- Custom Colors: horizontal rows, tooltip-only names, no bullet styling
- All `confirm()` dialogs replaced with `cwocConfirm()` (parchment-styled modal)
- Color delete modal: buttons swapped, "KEEP" → "Cancel"
- Save & Stay / Save & Exit / Cancel buttons

### Dashboard Sidebar Restructuring
- Clock button moved to sidebar body next to Weather
- Weather button: normal click → modal, Shift+click → full page
- Today button with 📅 icon above date nav
- Year/month and date range between ◄/► arrows
- Filters section collapsible via button toggle
- Settings, Reference, Help pinned to bottom
- Sidebar uses flex layout with scroll wrapper
- Removed all hotkey hint letters from sidebar buttons

---

## Weather & Location

- Weather zone in editor with cached data + stale badge while refreshing
- Dashboard weather pre-loaded for default location
- Dashboard weather modal with cached data
- Weather page with city rows for non-saved-location chits
- Weather on calendar date blocks
- Weather icon-only with tooltip details (all views)
- Weather flash colors updated to match HST bar
- Weather page: all blocks same height
- Auto-apply default location to new chits
- Weather refresh button (🔄) in editor

---

## Data & Export/Import

- CSV export (all chits with proper escaping)
- CSV import (file picker, proper quote handling, requires "title" column)
- Export All / Import All (combined envelope: chits + settings + contacts + alerts)
- Import double-confirm on Replace mode
- Export-all safety: sensitive fields stripped (email accounts, encrypted passwords)
- Data Management overhaul: separate Chit/User data controls, Add/Replace modes
- Universally unique installation instance ID

---

## Infrastructure & Security

- Crypto hardening: Tailscale auth keys encrypted at rest (Fernet)
- Password hashing: PBKDF2-HMAC-SHA256 with 600k iterations
- Pruning enabled by default for new users (1096 days, 1 MB)
- Network Access settings block (Tailscale connection)
- Configurator script for deployment
- Version logging on every page load

---

## UI & Interaction

### Mobile UI Overhaul
- Sidebar swipe gestures (right edge open, left to close)
- Mobile hamburger ☰ button in dashboard header
- Mobile ☰ Actions modal for editor/settings/contacts
- Views panel slides in from right edge with swipe support
- Tab buttons shrink on tablet
- Reference overlay: responsive, no wider-than-screen

### QR Codes
- Single `showQRModal()` function for all QR display (editor, quick edit, contacts)
- Responsive sizing, full-width close button, ESC/backdrop to close
- Removed ~150 lines of duplicated QR code

### Other UI
- Clock modal (L hotkey, live 24h/12h/metric time)
- Topbar toggle expands content (`~` key, persists via localStorage)
- All-day section: capped height with scroll (100px max)
- Right-click everywhere Shift+click is supported
- Wall/kiosk view for persistent displays
- Calculator popover (F4 hotkey, "insert result" value)

---

## Help & Documentation

- Help page with full feature documentation
- Reference overlay: 3-column tree layout with clickable links
- Updated for all new hotkeys, periods, sort options, editor hotkeys, `[[link]]` syntax
- Sidebar layout subsection, filtering & sorting expanded
- Settings section rewritten to match new layout
- Task zone documented, contact editor section added
- Visual indicators section renamed and expanded

---

## Declined Features (2026-04-27)

- Notes view: card resize handle
- Quick edit modal: add/remove tags
- Checklist: percentage complete bar
- Settings: reset to defaults button
- Double-click chit title in editor to select all
- Sidebar filter: color dots next to tag names
- Label/tag-based view filtering (Google Calendar style) — existing tag filter sufficient
- Additional/custom statuses — not needed
- Hotkey create submenu (K→X) — not needed
