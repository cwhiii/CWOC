# Notebook (Combined Notes + Checklists)

**Category:** Dashboard Views
**Item #:** 11
**Code Verified:** ✅
**User Verified:** ⬜

## Source Files
- `src/frontend/js/dashboard/main-views-notes.js` — Notes masonry view
- `src/frontend/js/dashboard/main-views.js` — Checklists view (`displayChecklistView`)
- `src/frontend/html/index.html` — Dashboard HTML (tab bar, containers)

---

## Notes View — Functions

- [ ] `displayNotesView(chitsToDisplay)` — Main render function for Notes masonry layout
- [ ] Filters chits to only those with non-empty `note` field
- [ ] Default sort: pinned first, then by `modified_datetime` descending (most recent first)
- [ ] Respects `currentSortField` override when global sort is active
- [ ] Renders each chit as a card in masonry layout

## Notes View — Card Rendering

- [ ] Card element with class `chit-card`, `dataset.chitId`
- [ ] `applyChitColors()` — applies chit color to card background
- [ ] `archived-chit` class applied when `chit.archived` is true
- [ ] `declined-chit` class applied when current user has declined the shared chit

### Title Row (per card)
- [ ] Pinned icon — `fas fa-bookmark` when `chit.pinned`
- [ ] Archived icon — 📦 emoji when `chit.archived`
- [ ] Snoozed icon — 😴 emoji when `chit.snoozed_until` is in the future
- [ ] Stealth indicator — 🥷 emoji (visible only to owner when `chit.stealth`)
- [ ] Alert indicators — via `_getAllIndicators(chit, settings, 'card')`
- [ ] Weather indicator — weather icon with tooltip (high/low temps, precipitation)
  - [ ] Prefers stored `weather_data` from backend
  - [ ] Falls back to localStorage cache
  - [ ] Falls back to live fetch via `_queueChitWeatherFetch`
  - [ ] Shows ⏳ prefix when weather data is stale
- [ ] Map location icon — `fas fa-map-marker-alt` (clickable, opens Maps page)
  - [ ] Only shown for non-default locations
  - [ ] Respects `show_map_thumbnails` setting
  - [ ] Click navigates to `/maps?focus=chit&address=...`
- [ ] Title text — `chit.title` or "(Untitled)"
- [ ] Owner badge — `👤 ownerName` (shown only when owner differs from current user)
- [ ] Assignee badge — `📌 assigneeName` (when `chit.assigned_to_display_name` exists)

### Note Content
- [ ] Rendered as markdown via `marked.parse()` with `{ breaks: true }`
- [ ] `resolveChitLinks()` applied to resolve internal chit links
- [ ] Falls back to plain text with `white-space: pre-wrap` if marked.js unavailable
- [ ] `note-content` class with `overflow-y: auto`

## Notes View — Interactions & Event Handlers

### Double-click on card
- [ ] Calls `storePreviousState()`
- [ ] Navigates to `/editor?id=${chit.id}`

### Single click on note text (inline editing)
- [ ] Blocked if `e.shiftKey` (shift+click handled separately)
- [ ] Blocked for viewer-role shared chits (`_isViewerRole(chit)`)
- [ ] Sets `contentEditable = 'true'` on note element
- [ ] Shows outline: `2px solid #8b4513`
- [ ] Switches to plain text mode (shows raw markdown source)
- [ ] Disables card dragging during edit
- [ ] Calls `applyNotesLayout()` to re-layout masonry after expansion
- [ ] On blur: saves via `PUT /api/chits/${chit.id}` if content changed
- [ ] On blur: re-renders markdown if content unchanged
- [ ] On ESC keydown: triggers blur (exits edit mode)
- [ ] On input: debounced re-layout (150ms) as card height changes

### Shift+click on card
- [ ] Opens quick-edit modal via `showQuickEditModal(chit, callback)`
- [ ] Blocked for viewer-role shared chits

### Right-click (contextmenu) on card
- [ ] Opens context menu via `_showChitContextMenu(e, chit, callback)`
- [ ] Blocked for viewer-role shared chits

### Long-press on mobile
- [ ] Opens quick-edit modal (same as shift+click on desktop)
- [ ] Handled via `enableDragToReorder` long-press map (mobile mode)

## Notes View — Layout & Reorder

- [ ] Masonry layout via `applyNotesLayout(notesView)`
- [ ] Triple-pass layout: 50ms, 200ms, 500ms delays (ensures markdown/images render)
- [ ] Window resize handler re-applies layout when `currentTab === 'Notes'`
- [ ] Saved column assignments restored from localStorage via `getManualOrder('Notes')`
- [ ] Column assignment format: `[{id, col}, ...]`
- [ ] Ignores saved order if all items are in col 0 (buggy save detection)

### Mobile (≤480px)
- [ ] Uses flat drag system via `enableDragToReorder(notesView, 'Notes', callback, longPressMap)`
- [ ] Long-press map: each chit ID → quick-edit modal function

### Desktop (>480px)
- [ ] Uses masonry-aware drag via `enableNotesDragReorder(notesView, 'Notes', callback)`

---

## Checklists View — Functions

- [ ] `displayChecklistView(chitsToDisplay)` — Main render function for Checklists masonry layout
- [ ] Filters chits to only those with non-empty checklist items (`i.text.trim()`)
- [ ] Default sort: pinned first, then by `last_edited` descending
- [ ] Respects `currentSortField` override when global sort is active

## Checklists View — Card Rendering

- [ ] Card element with class `chit-card`, `dataset.chitId`
- [ ] `applyChitColors()` — applies chit color to card background
- [ ] `archived-chit` class applied when `chit.archived`
- [ ] `declined-chit` class applied when current user has declined
- [ ] `checklist-all-done` class applied when ALL non-empty items are checked

### Header (per card)
- [ ] Uses `_buildChitHeader()` with `{ checklistCount: true, skipMapIcon: true }`
- [ ] Title as link: `<a href="/editor?id=${chit.id}">${chit.title}</a>`
- [ ] Checklist progress count: `(checked/total)` with ✓ suffix when all done
- [ ] All standard header indicators (pinned, archived, snoozed, stealth, weather, etc.)

### Checklist Content
- [ ] Interactive checklist via `renderInlineChecklist(chitElement, chit, callback)` (for non-viewer users)
- [ ] Read-only checklist for viewer-role users (shows only unchecked items with ☐ prefix)
- [ ] Checklist item text rendered as markdown via `renderChecklistItemMarkdown()`

### Map Thumbnail
- [ ] `_buildMapThumbnail(chit)` — shows OSM tile for non-default locations
- [ ] Respects `show_map_thumbnails` setting

## Checklists View — Interactions & Event Handlers

### Double-click on card
- [ ] If target is `.chit-map-thumbnail`: navigates to Maps page with chit location
- [ ] Otherwise: calls `storePreviousState()` and navigates to `/editor?id=${chit.id}`

### Shift+click on card
- [ ] Opens quick-edit modal via `showQuickEditModal(chit, callback)`
- [ ] Blocked for viewer-role shared chits

### Right-click (contextmenu) on card
- [ ] Opens context menu via `_showChitContextMenu(e, chit, callback)`
- [ ] Blocked for viewer-role shared chits

## Checklists View — Layout & Reorder

- [ ] Masonry layout via `applyNotesLayout(checklistView)` (same as Notes)
- [ ] Triple-pass layout: 50ms, 200ms, 500ms delays
- [ ] Window resize handler re-applies layout when `currentTab === 'Checklists'`
- [ ] Saved column assignments restored from localStorage via `getManualOrder('Checklists')`

### Mobile (≤480px)
- [ ] Uses flat drag system via `enableDragToReorder(checklistView, 'Checklists', callback, longPressMap)`
- [ ] Long-press map: each chit ID → quick-edit modal function

### Desktop (>480px)
- [ ] Uses masonry-aware drag via `enableNotesDragReorder(checklistView, 'Checklists', callback)`

---

## Shared Helpers Used by Both Views

- [ ] `_isViewerRole(chit)` — checks if chit is shared with viewer-only access
- [ ] `_isDeclinedByCurrentUser(chit)` — checks if current user declined the shared chit
- [ ] `_buildChitHeader(chit, titleHtml, settings, opts)` — builds standard header row
- [ ] `_buildNotePreview(chit, extraStyle)` — expandable note preview with show more/less toggle
- [ ] `_buildMapThumbnail(chit)` — OSM map tile thumbnail
- [ ] `_buildMapIcon(chit)` — simple map pin icon for compact views
- [ ] `_emptyState(message)` — styled empty state with "+ Create Chit" button
- [ ] `_getTagColor(tagName)` — tag background color from settings
- [ ] `_getTagFontColor(tagName)` — tag text color from settings
- [ ] `chitColor(chit)` — resolve chit's display color
- [ ] `applyChitColors(element, color)` — apply color to card element
- [ ] `storePreviousState()` — save navigation state before leaving
- [ ] `fetchChits()` — re-fetch all chits from API
- [ ] `displayChits()` — re-render current view

---

## Tab Switching (filterChits)

- [ ] `filterChits('Notes')` / `filterChits('Checklists')` — switches to the respective tab
- [ ] Updates favicon to match active view
- [ ] Updates URL hash (`#notes` / `#checklists`)
- [ ] Restores saved sort preference for the tab
- [ ] Updates mobile Views button label
- [ ] Shows/hides sidebar sections (period, kanban, alarms mode, etc.)
- [ ] Applies custom view filters from settings
- [ ] Calls `displayChits()` to render
