# Checklists

**Category:** Dashboard Views
**Item #:** 9
**Code Verified:** ⬜
**User Verified:** ⬜

## Functions, Buttons, Controls & Inputs

### View Rendering (main-views.js — `displayChecklistView`)

- [ ] displayChecklistView(chitsToDisplay) — Main function that renders the entire Checklists tab view
- [ ] Filter chits to only those with non-empty checklist items (`c.checklist.some(i => i && i.text && i.text.trim())`)
- [ ] Default sort: pinned first, then by last_edited/created_datetime/start_datetime descending (when no global sort active)
- [ ] Respect `currentSortField` — skip default sort when global sort is active
- [ ] Empty state rendering via `_emptyState("No checklists found.")` with "+ Create Chit" button
- [ ] Card creation: `div.chit-card` with `data-chit-id` attribute
- [ ] `applyChitColors(chitElement, chitColor(chit))` — Apply chit color to card background
- [ ] `archived-chit` CSS class added when `chit.archived` is true
- [ ] `declined-chit` CSS class added when `_isDeclinedByCurrentUser(chit)` returns true
- [ ] `_buildChitHeader()` call with `{ checklistCount: true, skipMapIcon: true }` options
- [ ] Title rendered as link: `<a href="/editor?id=${chit.id}">${chit.title || '(Untitled)'}</a>`
- [ ] Strike-through detection: `checklist-all-done` CSS class when all non-empty items are checked
- [ ] Viewer-role check: `_isViewerRole(chit)` — disables interactive checklist for viewer-only shared chits
- [ ] Read-only checklist display for viewers (☐ prefix + markdown-rendered text, only unchecked items)
- [ ] Interactive checklist via `renderInlineChecklist(chitElement, chit, () => fetchChits())` for non-viewers
- [ ] Map thumbnail: `_buildMapThumbnail(chit)` appended for non-default locations
- [ ] Masonry layout via `applyNotesLayout(checklistView)` with triple-pass timing (50ms, 200ms, 500ms)
- [ ] Saved column assignments restored from `getManualOrder('Checklists')` localStorage
- [ ] Column assignment applied via `card.dataset.col = colMap[id]`
- [ ] Window resize handler: re-applies `applyNotesLayout` when `currentTab === 'Checklists'`
- [ ] Mobile mode detection: `window.innerWidth <= 480`
- [ ] Mobile: flat drag via `enableDragToReorder(checklistView, 'Checklists', displayChits, longPressMap)`
- [ ] Mobile: long-press map for quick-edit modal per chit (non-viewer only)
- [ ] Desktop: masonry-aware drag via `enableNotesDragReorder(checklistView, 'Checklists', displayChits)`

### Chit Header Builder (main-views.js — `_buildChitHeader`)

- [ ] _buildChitHeader(chit, titleHtml, settings, opts) — Builds the header row for each checklist card
- [ ] Pinned icon: `fas fa-bookmark` with title "Pinned"
- [ ] Archived icon: 📦 emoji with title "Archived"
- [ ] Snoozed icon: 😴 emoji with title showing snooze-until datetime
- [ ] Timezone warning: ⚠️ emoji for unresolved timezone on anchored chit
- [ ] Stealth indicator: 🥷 emoji (visible only to owner)
- [ ] Sub-chit indicator: `fas fa-project-diagram` icon for child chits of projects
- [ ] Visual indicators via `_getAllIndicators(chit, settings, 'card')` (alerts, weather, people, recurrence)
- [ ] Weather indicator: weather icon with high/low tooltip, stale indicator (⏳), precipitation info
- [ ] Map pin icon: `_buildMapIcon(chit)` for non-default locations (skipped in checklists via `skipMapIcon: true`)
- [ ] Title span with `chit-header-title` class
- [ ] Checklist progress count: `(X/Y)` or `(X/Y ✓)` span with `checklist-progress-count` class and `data-chit-id`
- [ ] Status display with sort indicator (▲/▼) when sorted by status
- [ ] Blocked status: colored background with configurable `blocked_border_color`, chain emoji for incomplete prereqs
- [ ] Priority display
- [ ] Due date display: "Past Due: YYYY-Mon-DD" with configurable `overdue_border_color` background when overdue
- [ ] Start datetime display
- [ ] Point-in-time display (📌 prefix)
- [ ] Modified datetime display
- [ ] Created datetime display
- [ ] Tag chips: colored spans with tag background/font colors from `_getTagColor`/`_getTagFontColor`
- [ ] RSVP status indicators: ✓ (accepted), ✗ (declined), ⏳ (invited) per shared user
- [ ] RSVP action buttons: Accept (✓) and Decline (✗) buttons for shared users (PATCH `/api/chits/{id}/rsvp`)
- [ ] Shared icon: 🔗 with tooltip showing owner, shared users with roles, current user's role
- [ ] Assignee badge: 📌 + display name with tooltip

### Inline Checklist Interactions (shared-checklist.js)

- [ ] renderInlineChecklist(container, chit, onUpdate) — Renders interactive checklist items inside a card
- [ ] Only renders unchecked items (checked items hidden, counted in header progress)
- [ ] Indentation: `padding-left: (item.level * 18 + 4)px` for nested items
- [ ] 6-dot drag handle: `⠿` character with `checklist-drag-handle` class and "Drag to reorder" title
- [ ] Checkbox input: `type="checkbox"` with change event handler
- [ ] Text span: markdown-rendered via `renderChecklistItemMarkdown()`
- [ ] toggleChecklistItem(chitId, itemIndex, newChecked) — Toggles checked state and PUTs to API
- [ ] Auto-complete logic: evaluates all items, reverts status to 'ToDo' if unchecking makes it incomplete
- [ ] Item hide on check: `li.style.display = 'none'` when checked off
- [ ] Progress count update: `_updateChecklistProgressCount(container, chit)` after toggle
- [ ] All-done detection: adds `checklist-all-done` class to card when all items checked
- [ ] Auto-complete refresh: `setTimeout(() => fetchChits(), 300)` when `chit.auto_complete_checklist` enabled
- [ ] moveChecklistItem(chitId, fromIndex, toIndex) — Reorders item within same chit via API PUT
- [ ] moveChecklistItemCrossChit(fromChitId, fromIndex, toChitId, toIndex) — Moves item between chits via dual API PUT
- [ ] _updateChecklistProgressCount(container, chit) — Updates the `(X/Y)` progress display after changes
- [ ] renderChecklistItemMarkdown(el, text) — Renders markdown in checklist item text (bold, italic, links, code, lists, blockquotes)
- [ ] Strips outer `<p>` wrapper for single-line items
- [ ] Removes GFM `<input>` checkboxes from rendered markdown
- [ ] Sets `tabindex="-1"` on rendered links to prevent focus

### Drag & Drop — Mouse (shared-checklist.js)

- [ ] `li.draggable = true` — Each checklist item is draggable
- [ ] dragstart: sets `application/x-checklist-item` data with `{chitId, idx}`, opacity 0.4
- [ ] dragend: restores opacity to 1, calls `_markDragJustEnded()`
- [ ] dragover on item: shows `borderTop: 2px solid #8b5a2b` drop indicator
- [ ] dragleave on item: clears border indicator
- [ ] drop on item: parses transfer data, calls `moveChecklistItemCrossChit()`, triggers `onUpdate`
- [ ] dragover on list (UL): shows `borderBottom: 2px solid #8b5a2b` (append-to-end indicator)
- [ ] dragleave on list: clears border indicator
- [ ] drop on list: appends item to end of target chit's checklist via `moveChecklistItemCrossChit()`
- [ ] Cross-chit drag: items can be dragged between different chit cards

### Drag & Drop — Touch (shared-checklist.js via shared-touch.js)

- [ ] enableTouchDrag(li, callbacks) — Touch drag support for each checklist item
- [ ] onStart: stores `{chitId, idx}` in `li._touchDragData`, sets opacity 0.4
- [ ] onMove: clears all highlights, finds element under touch point via `document.elementFromPoint`
- [ ] onMove: highlights target `li` with `borderTop: 2px solid #8b5a2b`
- [ ] onMove: highlights list with `borderBottom` if touch is over list but not a specific item
- [ ] onEnd: restores opacity, clears all highlights
- [ ] onEnd: finds drop target via `document.elementFromPoint`
- [ ] onEnd: calls `moveChecklistItemCrossChit()` for item-to-item drops
- [ ] onEnd: appends to end of list for list-level drops (uses `chit.checklist.length` as toIndex)

### Card-Level Event Handlers (main-views.js — `displayChecklistView`)

- [ ] dblclick on card: navigates to `/editor?id=${chit.id}` (with `storePreviousState()`)
- [ ] dblclick on map thumbnail: navigates to `/maps?focus=chit&address=...` instead
- [ ] Shift+click on card: opens `showQuickEditModal(chit, displayChits)` (non-viewer only)
- [ ] Right-click (contextmenu) on card: opens `_showChitContextMenu(e, chit, displayChits)` (non-viewer only)
- [ ] Long-press on mobile: opens `showQuickEditModal(chit, displayChits)` via `enableDragToReorder` longPressMap

### Card Drag Reorder (shared-sort.js / shared.js)

- [ ] enableDragToReorder(container, 'Checklists', onReorder, longPressMap) — Mobile flat drag reorder
- [ ] enableNotesDragReorder(container, 'Checklists', onReorder) — Desktop masonry-aware drag reorder
- [ ] getManualOrder('Checklists') — Retrieves saved card order/column from localStorage
- [ ] applyManualOrder — Persists card order to localStorage after reorder
- [ ] applyNotesLayout(checklistView) — Column-persistent masonry layout (assigns cards to shortest column)

### Tab Navigation & Switching

- [ ] Tab button: `<div class="tab" onclick="filterChits('Checklists')" title="Checklists">` in index.html
- [ ] Tab icon: `<img src="/static/checklists.png" />`
- [ ] Tab label: `<span class="tab-label"> <u>C</u>hecklists</span>`
- [ ] Hotkey 'H': switches to Checklists tab via `_cwocHotkeyTabMap` → `_resolveHotkeyTab` → `_cwocSwitchTab`
- [ ] Notebook mode: when Notebook tab is active, 'H' key goes to Notebook instead of Checklists
- [ ] filterChits('Checklists') — Main tab switch function (sets currentTab, updates UI, calls displayChits)
- [ ] URL hash: `#checklists` set via `_updateUrlHash()` when switching to Checklists tab
- [ ] Favicon update: `/static/checklists.png` via `_updateFavicon('Checklists')`
- [ ] Sort preference restore: `getSortPreference('Checklists')` on tab entry
- [ ] Mobile Views button label update via `_updateMobileViewsLabel()`
- [ ] Active tab highlight: `.tab.active` CSS class on the Checklists tab button

### Sidebar Controls (main-sidebar.js — apply to all views including Checklists)

- [ ] Sort select dropdown (`#sort-select`) — Changes sort field
- [ ] Sort direction button (`#sort-dir-btn`) — Toggles ascending/descending (▲/▼)
- [ ] Search input (`#search`) — Text filter applied to chit titles/content
- [ ] Status filter multi-select (`#status-multi`) — Filter by ToDo/In Progress/Blocked/Complete
- [ ] Priority filter multi-select (`#priority-multi`) — Filter by priority level
- [ ] Tag/Label filter (`#label-multi`) — Filter by tags (virtual options panel)
- [ ] People filter (`#people-multi`) — Filter by associated people/contacts
- [ ] Project filter dropdown (`#project-filter-select`) — Filter by parent project
- [ ] Show Pinned toggle (`#show-pinned`) — Include/exclude pinned chits
- [ ] Show Archived toggle (`#show-archived`) — Include/exclude archived chits
- [ ] Show Snoozed toggle (`#show-snoozed`) — Include/exclude snoozed chits
- [ ] Show Unmarked toggle (`#show-unmarked`) — Include/exclude unmarked chits
- [ ] Show Past Due toggle (`#show-past-due`) — Include/exclude past-due chits
- [ ] Show Complete toggle (`#show-complete`) — Include/exclude completed chits
- [ ] Show Declined toggle (`#show-declined`) — Include/exclude declined shared chits
- [ ] Show Habits toggle (`#show-habits`) — Include/exclude habit chits
- [ ] Show Email Received toggle (`#show-email-received`) — Include/exclude received emails
- [ ] Show Email Sent toggle (`#show-email-sent`) — Include/exclude sent emails
- [ ] Shared With Me filter (`#filter-shared-with-me`) — Show only chits shared with current user
- [ ] Shared By Me filter (`#filter-shared-by-me`) — Show only chits shared by current user
- [ ] Highlight Overdue toggle (`#highlight-overdue`) — Visual highlight for overdue items
- [ ] Highlight Blocked toggle (`#highlight-blocked`) — Visual highlight for blocked items
- [ ] Clear All Filters button (`#reset-defaults-btn`) — Resets to custom view defaults or system defaults
- [ ] Tag filter search input — Filters tag list in sidebar
- [ ] People filter search input — Filters people chips in sidebar

### Sidebar Functions Used by Checklists View

- [ ] onFilterChange() — Triggers displayChits() + updates clear button visibility
- [ ] onFilterAnyToggle(anyCb) — Unchecks specific options when "Any" is checked
- [ ] onFilterSpecificToggle(filterType) — Unchecks "Any" when specific option checked
- [ ] clearFilterGroup(containerId) — Clears all checkboxes in a filter group
- [ ] _clearAllFilters() — Resets all filters to defaults
- [ ] _applyCustomViewFilters(tab) — Applies saved custom filter state for Checklists tab
- [ ] _applyFilterStateToSidebar(state) — Applies a complete filter state object to sidebar UI
- [ ] _applySystemDefaults() — Resets all sidebar filters to hardcoded baseline
- [ ] _updateClearFiltersButton() — Shows/hides the reset defaults button
- [ ] _loadLabelFilters() — Loads tag filter options from API
- [ ] _buildTagFilterPanel() — Builds the tag filter panel with search, favorites, colors
- [ ] _syncSidebarTagCheckboxes() — Syncs hidden checkboxes with tag selection state
- [ ] _buildPeopleFilterPanel() — Fetches contacts/users and renders people filter
- [ ] _renderPeopleFilterPanel(contacts) — Renders people chips into sidebar
- [ ] _populateProjectFilter() — Populates project filter dropdown with project masters
- [ ] onSortSelectChange() — Handles sort field change, persists preference
- [ ] toggleSortDir() — Toggles sort direction, persists preference
- [ ] _updateSortUI() — Updates sort direction button display
- [ ] _getSelectedStatuses() — Returns array of checked status values
- [ ] _getSelectedLabels() — Returns array of selected tag names
- [ ] _getSelectedPriorities() — Returns array of checked priority values
- [ ] _getSelectedProjectId() — Returns selected project filter ID

### Helper Functions Used by Checklists View

- [ ] _isViewerRole(chit) — Returns true if chit is shared with viewer-only access
- [ ] _isSharedChit(chit) — Returns true if chit has an effective_role from sharing
- [ ] _isDeclinedByCurrentUser(chit) — Returns true if current user declined this shared chit
- [ ] _getUserRsvpStatus(chit) — Returns current user's RSVP status from shares array
- [ ] _emptyState(message) — Builds styled empty-state HTML with "+ Create Chit" button
- [ ] _getTagColor(tagName) — Gets tag background color from cached settings
- [ ] _getTagFontColor(tagName) — Gets tag font color from cached settings
- [ ] _buildMapThumbnail(chit) — Builds OSM map tile thumbnail for chit location
- [ ] _buildMapIcon(chit) — Builds simple map pin icon for compact views
- [ ] _hasNonDefaultLocation(chit) — Checks if chit location differs from user's default
- [ ] _renderMapTile(container, lat, lon) — Renders OSM tile image with pin overlay
- [ ] _buildNotePreview(chit, extraStyle) — Builds expandable note preview (not used in checklists view directly)
- [ ] chitColor(chit) — Returns display color for a chit (transparent → pale cream)
- [ ] applyChitColors(el, bgColor) — Sets background color + contrast text color
- [ ] storePreviousState() — Saves current tab/view state for back-navigation
- [ ] fetchChits() — Fetches all chits from API and triggers displayChits()
- [ ] displayChits() — Main dispatcher that filters, sorts, and routes to view-specific renderer
- [ ] _markDragJustEnded() — Sets flag to prevent post-drag click from triggering navigation

### Progress Indicators

- [ ] Checklist progress count in header: `(checked/total)` or `(checked/total ✓)` when all done
- [ ] `checklist-all-done` CSS class: strikes through title when all items complete
- [ ] Individual item hide: checked items hidden from inline list (only unchecked shown)
- [ ] Progress count live update after each toggle via `_updateChecklistProgressCount()`

### Layout & Responsive

- [ ] `.checklist-view` container class for the masonry grid
- [ ] Column-persistent masonry layout (cards assigned to columns, positions calculated)
- [ ] Window resize listener: re-applies masonry layout
- [ ] Mobile (≤480px): single-column flat layout with drag-to-reorder
- [ ] Desktop: multi-column masonry with drag-between-columns support
- [ ] Triple-pass layout timing: 50ms initial, 200ms settle, 500ms final

### Keyboard Shortcuts (Reference Panel in index.html)

- [ ] 'H' key — Switch to Checklists view (shown in reference panel as `<span class="ref-key">H</span> Checklists`)
