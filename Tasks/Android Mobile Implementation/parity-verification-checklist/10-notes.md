# Notes

**Category:** Dashboard Views
**Item #:** 10
**Code Verified:** ⬜
**User Verified:** ⬜

## Functions, Buttons, Controls & Inputs

### Tab Navigation

- [ ] Notes tab button in tab bar — `<div class="tab" onclick="filterChits('Notes')">` with notes.png icon
- [ ] Keyboard shortcut "N" to switch to Notes tab (via main-hotkeys.js)
- [ ] filterChits('Notes') — switches to Notes tab, updates URL hash to #notes
- [ ] _updateUrlHash() — sets URL hash to `#notes` when Notes tab active
- [ ] _parseUrlHash() — parses `#notes` from URL to restore Notes tab on load
- [ ] _updateFavicon('Notes') — sets favicon to `/static/notes.png`
- [ ] _updateMobileViewsLabel() — updates mobile Views button label to "Notes"

### View Rendering (main-views-notes.js)

- [ ] displayNotesView(chitsToDisplay) — main render function for Notes masonry view
- [ ] Filters chits to only those with non-empty `chit.note` field
- [ ] Default sort: pinned first, then by `modified_datetime` descending
- [ ] Respects global `currentSortField` when active (skips default sort)
- [ ] Empty state via `_emptyState("No notes found.")` — shows message + "+ Create Chit" button
- [ ] Creates `notes-view` container div with class `notes-view`
- [ ] Appends to `#chit-list` container

### Card Rendering (per chit)

- [ ] Creates `chit-card` div with `data-chit-id` attribute
- [ ] applyChitColors(chitElement, chitColor(chit)) — applies custom background color + contrast text
- [ ] chitColor(chit) — returns chit's color or fallback `#fdf6e3`
- [ ] `archived-chit` class added when `chit.archived` is true
- [ ] `declined-chit` class added when `_isDeclinedByCurrentUser(chit)` returns true

### Title Row (compact custom layout, NOT _buildChitHeader)

- [ ] Title row div with flex layout, gap 0.3em, font-weight bold
- [ ] Pinned icon — `<i class="fas fa-bookmark">` with title "Pinned"
- [ ] Archived icon — `<span>📦</span>` with title "Archived"
- [ ] Snoozed icon — `<span>😴</span>` with tooltip showing snooze-until datetime
- [ ] Stealth indicator — `<span>🥷</span>` visible only to owner (checks `getCurrentUser()`)
- [ ] Alert indicators — `_getAllIndicators(chit, _viSettings, 'card')` in `alert-indicators` span
- [ ] Weather indicator — `chit-weather-indicator` span:
  - [ ] Prefers stored `weather_data` from backend (parsed JSON)
  - [ ] Shows weather icon via `_getWeatherIcon(weather_code)`
  - [ ] Temperature tooltip: `_convertTemp(high)°/_convertTemp(low)°`
  - [ ] Precipitation text via `_cwocFormatPrecip(precipitation, weather_code)`
  - [ ] Stale indicator (⏳) via `_isWeatherStale(updated_time)`
  - [ ] Fallback: checks localStorage cache (`cwoc_wx_` + location key)
  - [ ] Fallback: shows ⏳ "Loading weather…" and queues `_queueChitWeatherFetch(location, span)`
- [ ] Map location icon — `<i class="fas fa-map-marker-alt chit-location-icon">`:
  - [ ] Only shown when `chit.location` is non-empty
  - [ ] Respects `show_map_thumbnails` user setting (hidden when `false` or `'0'`)
  - [ ] Click handler: navigates to `/maps?focus=chit&address=` + encoded location
  - [ ] `e.stopPropagation()` and `e.preventDefault()` to prevent card click
- [ ] Title text span — `chit.title || '(Untitled)'`
- [ ] Owner badge — `<span class="cwoc-owner-badge">👤 name</span>`:
  - [ ] Only shown when `chit.owner_display_name` differs from current user
- [ ] Assignee badge — `<span class="cwoc-assignee-badge">📌 name</span>`:
  - [ ] Only shown when `chit.assigned_to_display_name` is set

### Note Content Rendering

- [ ] `note-content` div with `overflow-y:auto` style
- [ ] Markdown rendering via `marked.parse(chit.note, { breaks: true })` when marked.js available
- [ ] resolveChitLinks(html, chits) — converts `[[title]]` references to clickable `<a>` links
- [ ] Fallback: plain text with `white-space: pre-wrap` when marked.js unavailable
- [ ] Truncation: none (full note content rendered in masonry card)

### Inline Editing (click on note-content)

- [ ] Single click on `noteEl` triggers inline edit mode
- [ ] Skipped if `e.shiftKey` is true (shift+click handled separately)
- [ ] Skipped if `_isViewerRole(chit)` returns true (viewer-only shared chits)
- [ ] Skipped if already in edit mode (`noteEl.contentEditable === 'true'`)
- [ ] Sets `contentEditable = 'true'` on note element
- [ ] Visual: `outline: 2px solid #8b4513`, `border-radius: 4px`, `padding: 6px`
- [ ] Sets `white-space: pre-wrap`, `max-height: none`, `overflow: visible`
- [ ] Sets `user-select: text` on both noteEl and chitElement
- [ ] Sets `cursor: auto` on chitElement
- [ ] Sets `draggable = 'false'` on chitElement (disables drag during edit)
- [ ] Replaces rendered HTML with raw markdown: `noteEl.textContent = chit.note || ''`
- [ ] Calls `noteEl.focus()` to place cursor
- [ ] Calls `applyNotesLayout(container)` after 10ms to re-layout (cards push down)
- [ ] `input` event handler: re-layouts on typing with 150ms debounce
- [ ] `blur` event → `saveEdit()`:
  - [ ] Resets `contentEditable = 'false'`
  - [ ] Removes outline, padding, max-height, overflow, user-select styles
  - [ ] Restores `cursor: grab` on chitElement
  - [ ] Removes `draggable` attribute
  - [ ] If note changed: `PUT /api/chits/:id` with full chit + new note, then `fetchChits()`
  - [ ] If note unchanged: re-renders markdown via `marked.parse` + `resolveChitLinks`
  - [ ] Calls `applyNotesLayout(container)` after 10ms to re-layout
  - [ ] Removes `input` event handler on blur
- [ ] `keydown` Escape → `noteEl.blur()` (triggers save via blur handler)

### Card Event Handlers

- [ ] Double-click on card → `storePreviousState()` then navigate to `/editor?id=${chit.id}`
- [ ] Shift+click on card → `showQuickEditModal(chit, displayChits)`:
  - [ ] Only if `e.shiftKey` is true
  - [ ] Disabled for viewer-role chits (`_isViewerRole(chit)`)
- [ ] Right-click (contextmenu) on card → `_showChitContextMenu(e, chit, displayChits)`:
  - [ ] `e.preventDefault()` to suppress browser context menu
  - [ ] Disabled for viewer-role chits
- [ ] Long-press on mobile → opens Quick Edit modal (via `enableNotesDragReorder` touch gesture or `enableDragToReorder` long-press map)

### Context Menu Options (_showChitContextMenu)

- [ ] Open in Editor — navigates to `/editor?id=` + chitId
- [ ] Quick Edit — opens `showQuickEditModal(chit, onRefresh)`
- [ ] Pin / Unpin — `PATCH /api/chits/:id/fields` with `{ pinned: !isPinned }`
- [ ] Archive / Unarchive — `PATCH /api/chits/:id/fields` with `{ archived: newArchived }` + undo toast
- [ ] Snooze (H/D/W/F/M circular buttons) — `POST /api/chits/:id/snooze` with `{ minutes }` + undo toast
- [ ] Unsnooze (when already snoozed) — `POST /api/chits/:id/snooze` with `{ until: null }`
- [ ] Print Note — `_printNoteWithChoice(chit.note, chit.title)` (only if chit has notes)
- [ ] Delete — `cwocConfirm` then `DELETE /api/chits/:id` + undo toast with restore

### Masonry Layout (shared.js)

- [ ] NOTES_CARD_WIDTH = 336 — base card width constant
- [ ] NOTES_GAP = 10 — gap between cards constant
- [ ] _notesColMetrics(container) — calculates column count and actual card width:
  - [ ] ≤480px viewport → 1 column
  - [ ] 481–768px viewport → 2 columns
  - [ ] >768px → fit as many columns as container allows
  - [ ] Computes `actualCardWidth` from available content width
- [ ] _notesColLeft(colIdx, actualCardWidth) — returns left px offset for a column
- [ ] _assignMissingCols(cards, colCount) — assigns data-col to unassigned cards:
  - [ ] If ALL cards unassigned: round-robin distribution across columns
  - [ ] If only some unassigned: assigns to column 0
- [ ] _buildNoteColumns(cards, colCount) — groups cards by data-col into column arrays
- [ ] _stackColumn(colCards, colIdx, actualCardWidth, skipCard) — positions cards top-to-bottom in a column:
  - [ ] Sets `position: absolute`, `width`, `left`, `top` on each card
  - [ ] Returns total column height
- [ ] applyNotesLayout(container) — main layout orchestrator:
  - [ ] Gets column metrics
  - [ ] Retries via `requestAnimationFrame` if container has no width
  - [ ] Clamps out-of-range columns (from window resize)
  - [ ] Calls `_assignMissingCols` for unassigned cards
  - [ ] Builds columns via `_buildNoteColumns`
  - [ ] Stacks each column via `_stackColumn`
  - [ ] Creates/updates `.notes-height-spacer` div for scrollable height
- [ ] Triple-pass layout timing: 50ms, 200ms, 500ms delays (for markdown/image rendering)
- [ ] Window resize handler: re-applies `applyNotesLayout` when Notes tab active
- [ ] Removes previous resize handler before adding new one (`window._notesResizeHandler`)

### Drag & Reorder — Desktop (enableNotesDragReorder in shared.js)

- [ ] enableNotesDragReorder(container, tab, onReorder) — sets up masonry-aware drag
- [ ] Sets `cursor: grab` on all `.chit-card` elements
- [ ] mousedown handler:
  - [ ] Skips if target is input/textarea/select/button/a/ul/li/contenteditable
  - [ ] Skips if target is inside `.note-content`
  - [ ] Skips if card has `[contenteditable="true"]` element
  - [ ] Skips if not left mouse button
  - [ ] Snapshots all cards' column/row positions for cancel restore
  - [ ] Initializes `_notesDragState` with card, container, metrics, offsets
  - [ ] Sets card z-index:100, opacity:0.85, box-shadow, cursor:grabbing, transition:none
  - [ ] Adds document-level mousemove, mouseup, keydown listeners
- [ ] Touch gesture via `enableTouchGesture(card, callbacks)`:
  - [ ] `onDragStart` — same initialization as mousedown
  - [ ] `onDragMove` — calls `_onNotesDragMoveXY(clientX, clientY)`
  - [ ] `onDragEnd` — calls `_onNotesDragEnd()`
  - [ ] `onLongPress` — enters inline edit mode (same as click on note-content):
    - [ ] Sets contentEditable, outline, padding, pre-wrap
    - [ ] Shows raw text, focuses
    - [ ] Blur saves edit via PUT API
- [ ] _onNotesDragMove(e) — wrapper calling `_onNotesDragMoveXY(e.clientX, e.clientY)`
- [ ] _onNotesDragMoveXY(clientX, clientY) — shared drag-move logic:
  - [ ] Floats dragged card under cursor (absolute positioning)
  - [ ] Hides card from hit testing (`pointerEvents: 'none'`)
  - [ ] Determines target column from cursor X position
  - [ ] Determines vertical insert position within target column
  - [ ] Live preview: re-stacks ALL columns with gap at insert position
  - [ ] Animated transitions on other cards (`top 0.15s ease`)
  - [ ] Shows drop indicator line (3px brown bar at insert position)
  - [ ] Updates `_notesDragState.targetCol` and `targetInsertIdx`
- [ ] _onNotesDragEnd() — finalizes drag:
  - [ ] Removes document-level listeners
  - [ ] Calls `_markDragJustEnded()` to suppress post-drag click
  - [ ] Cleans up indicator and card styles
  - [ ] If cancelled: restores original column assignments from snapshot
  - [ ] If completed:
    - [ ] Updates dragged card's `data-col` to target column
    - [ ] Rebuilds columns and inserts card at correct position
    - [ ] Re-stacks affected columns
    - [ ] Updates container height spacer
    - [ ] Saves order as `[{id, col}, ...]` via `saveManualOrder(tab, orderData)`
    - [ ] Sets `currentSortField = 'manual'`
    - [ ] Updates sort select dropdown and UI
    - [ ] Calls `saveSortPreference(tab, 'manual', 'asc')`
- [ ] _onNotesDragKey(e) — Escape key cancels drag (`_notesDragState.cancelled = true`)

### Drag & Reorder — Mobile (≤480px)

- [ ] Detects mobile mode: `window.innerWidth <= 480`
- [ ] Uses `enableDragToReorder(notesView, 'Notes', displayChits, _notesLpMap)` (flat list drag)
- [ ] Builds long-press map: `_notesLpMap[chit.id]` → opens Quick Edit modal
- [ ] Long-press disabled for viewer-role chits

### Order Persistence

- [ ] getManualOrder('Notes') — retrieves saved order from localStorage
- [ ] saveManualOrder('Notes', orderData) — persists order to localStorage + server
- [ ] Saved format: `[{id, col}, ...]` pairs preserving within-column order
- [ ] On render: restores saved column assignments from localStorage to `card.dataset.col`
- [ ] Detects and ignores buggy saves where all items are in col 0

### Sidebar Controls (via filterChits)

- [ ] Sort select dropdown (`#sort-select`) — applies global sort to notes
- [ ] Sort direction button (`#sort-dir-btn`) — toggles asc/desc
- [ ] Search input (`#search`) — filters notes by text match
- [ ] Show Archived checkbox — toggles archived chit visibility
- [ ] Show Snoozed checkbox (`#show-snoozed`) — toggles snoozed chit visibility
- [ ] Show Past Due checkbox (`#show-past-due`) — toggles past-due chit visibility
- [ ] Show Complete checkbox (`#show-complete`) — toggles complete chit visibility
- [ ] Show Declined checkbox (`#show-declined`) — toggles declined shared chit visibility
- [ ] Show Habits checkbox (`#show-habits`) — toggles habit chit visibility
- [ ] Show Email Received/Sent checkboxes — filters email chits
- [ ] Multi-select filters (status, label, priority) — via `_applyMultiSelectFilters`
- [ ] Label/tag filter chips — via `_loadLabelFilters`
- [ ] Custom view filters — via `_applyCustomViewFilters('Notes')`
- [ ] Clear Filters button — via `_updateClearFiltersButton`

### Shared Helper Functions Used

- [ ] _isViewerRole(chit) — checks if chit is shared with viewer-only access
- [ ] _isSharedChit(chit) — checks if chit has effective_role from sharing
- [ ] _isDeclinedByCurrentUser(chit) — checks if current user declined shared chit
- [ ] getCurrentUser() — returns current authenticated user object
- [ ] applyChitColors(el, bgColor) — sets background + contrast text color
- [ ] contrastColorForBg(bgColor) — computes readable text color for background
- [ ] chitColor(chit) — returns chit's display color
- [ ] resolveChitLinks(html, chits) — resolves `[[title]]` to `<a>` links
- [ ] _getAllIndicators(chit, settings, 'card') — builds indicator string
- [ ] _shouldShow(mode, 'card') — checks if weather indicator should display
- [ ] _getWeatherIcon(code) — returns weather emoji for WMO code
- [ ] _convertTemp(celsius) — converts to user's preferred unit
- [ ] _isWeatherStale(updatedTime) — checks if weather data is >24h old
- [ ] _cwocFormatPrecip(precipMm, weatherCode) — formats precipitation string
- [ ] _queueChitWeatherFetch(location, span) — queues async weather fetch
- [ ] storePreviousState() — saves current tab/view state for back navigation
- [ ] fetchChits() — re-fetches all chits from server and re-renders
- [ ] displayChits() — re-renders current view with current filters
- [ ] showQuickEditModal(chit, onRefresh) — opens quick-edit modal
- [ ] _showChitContextMenu(e, chit, onRefresh) — opens right-click context menu
- [ ] _showDeleteUndoToast(chitId, title, onExpire, onUndo) — shows delete undo countdown
- [ ] _showArchiveUndoToast(title, archived, onUndo) — shows archive undo countdown
- [ ] _showSnoozeUndoToast(chitId, title, mins, onUndo) — shows snooze undo countdown
- [ ] _printNoteWithChoice(text, title) — opens print dialog with format choice
- [ ] cwocConfirm(message, opts) — shows confirmation modal
- [ ] cwocToast(message, type) — shows brief notification
- [ ] getManualOrder(tab) — retrieves saved manual order
- [ ] saveManualOrder(tab, ids) — persists manual order
- [ ] saveSortPreference(tab, field, dir) — persists sort preference
- [ ] _updateSortUI() — updates sort direction button display
- [ ] _markDragJustEnded() — suppresses post-drag click events
- [ ] enableTouchGesture(element, callbacks) — unified touch gesture handler
- [ ] enableDragToReorder(container, tab, onReorder, longPressMap) — flat list drag system
- [ ] _emptyState(message) — builds styled empty-state with Create Chit button

### Hotkeys Reference (index.html)

- [ ] "Mouse · Notes View" section in hotkeys reference overlay:
  - [ ] Double-click → Open in editor
  - [ ] Shift+click → Edit in place
