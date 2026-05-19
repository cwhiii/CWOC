# Audit Log

**Category:** Standalone Pages
**Item #:** 46
**Code Verified:** ⬜
**User Verified:** ⬜

## Functions, Buttons, Controls & Inputs

### State Variables
- [ ] auditEntries — array holding fetched audit log entries
- [ ] auditTotal — total count of entries matching current filters
- [ ] currentOffset — pagination offset for load-more
- [ ] sortBy — current sort column (default: 'timestamp')
- [ ] sortOrder — current sort direction (default: 'desc')
- [ ] pruneCount — count of entries to be deleted in nuke modal
- [ ] columns — mutable array of column definitions for drag reorder
- [ ] _dragColIdx — index of column being dragged
- [ ] _revertChitId — chit ID pending revert
- [ ] _revertAuditEntry — audit entry pending revert

### Filter Controls (Sidebar)
- [ ] Entity Type radio buttons — All / Chits / Contacts / Ind. Alerts / Settings / System (onchange → applyFilters)
- [ ] Sort By dropdown (#filter-sort) — Time ▼/▲, Entity ▼/▲, Actor ▼/▲, Action ▼/▲, Type ▼/▲ (onchange → _onSortDropdownChange)
- [ ] Actor dropdown (#filter-actor) — dynamically populated from existing entries (onchange → applyFilters)
- [ ] Start date input (#filter-since) — date picker (onchange → applyFilters)
- [ ] End date input (#filter-until) — date picker (onchange → applyFilters)
- [ ] Page Size dropdown (#filter-page-size) — 25/50/100/500 (onchange → applyFilters)

### Toolbar Buttons
- [ ] Filters button (#audit-filter-toggle-btn) — mobile only, toggles sidebar slide-in (onclick → _toggleAuditFilters)
- [ ] CSV button — download CSV export (onclick → downloadCSV)
- [ ] Delete button (🗑️ Delete) — opens delete modal (onclick → openDeleteModal)

### Functions — Data Loading
- [ ] getEntityType() — reads checked entity_type radio value
- [ ] getActor() — reads filter-actor select value
- [ ] getSince() — reads filter-since date value
- [ ] getUntil() — reads filter-until date value
- [ ] getPageSize() — reads filter-page-size select value
- [ ] buildQueryParams(offset, limit) — constructs URL query string from all filters
- [ ] fetchEntries(offset, limit) — async fetch from /api/audit-log with query params
- [ ] populateActors() — async fetch actors from API + settings, populates actor dropdown
- [ ] applyFilters() — resets offset, clears entries, calls loadEntries
- [ ] loadEntries() — async fetches first page of entries, renders table
- [ ] loadMore() — async fetches next page, appends to entries, re-renders
- [ ] updateLoadMore() — shows/hides load-more button and total count display

### Functions — Sorting
- [ ] toggleSort(column) — toggles sort direction or changes sort column, syncs dropdown
- [ ] _onSortDropdownChange() — reads sort dropdown value, applies filters
- [ ] _syncSortDropdown() — syncs dropdown value to current sortBy/sortOrder state

### Functions — Rendering
- [ ] buildEntityLink(entry) — creates clickable link to chit/contact/settings based on entity type
- [ ] renderTable() — builds full HTML table with sortable headers, detail rows, drag-drop columns
- [ ] renderChanges(changes, entry, entryIdx) — renders field changes sub-table with old/new values + revert button
- [ ] formatChangeValue(val) — formats a change value for display (null → "(none)", object → JSON)
- [ ] toggleDetail(idx) — expands/collapses detail row for entry at index

### Functions — Formatting
- [ ] formatTimestamp(iso) — formats ISO timestamp to "YYYY-Mon-DD HH:MM:SS"
- [ ] escHtml(str) — escapes HTML entities

### Functions — CSV Export
- [ ] downloadCSV() — triggers browser download of /api/audit-log/export with current filters

### Functions — Delete Modal
- [ ] _startOfPeriodCutoff(key) — computes cutoff date for prune period (1h/1d/1w/1m/1y)
- [ ] _fmtShortDate(d) — formats date as "Mon DD, YYYY"
- [ ] _populatePruneDropdown() — builds prune period options with cutoff dates
- [ ] openDeleteModal() — opens delete modal, resets state, populates dropdown
- [ ] closeDeleteModal() — hides delete modal
- [ ] onPruneSelectChange() — async fetches count of entries to delete, updates UI
- [ ] confirmNuke() — opens second confirmation modal with count
- [ ] closeNukeConfirm() — closes nuke confirm, re-opens delete modal
- [ ] executeDelete() — async performs DELETE API call, optionally downloads CSV first

### Functions — Revert
- [ ] openRevertConfirm(chitId, auditIdx, entitySummary) — opens revert confirmation modal
- [ ] closeRevertConfirm() — closes revert modal, clears state
- [ ] executeRevert() — async fetches chit, applies old values from audit entry, saves via PUT with revert=1

### Functions — Column Drag Reorder
- [ ] Column header dragstart handler — sets _dragColIdx, adds dragging class
- [ ] Column header dragend handler — removes dragging class
- [ ] Column header dragover handler — prevents default, adds drag-over class
- [ ] Column header dragleave handler — removes drag-over class
- [ ] Column header drop handler — swaps columns array, re-renders table

### Functions — Mobile
- [ ] _initMobileFilterPanel() — creates backdrop, adds close button to sidebar, shows filter toggle on mobile
- [ ] _toggleAuditFilters() — toggles sidebar active state
- [ ] _closeAuditFilters() — removes active class from sidebar and backdrop

### Functions — URL Deep-linking
- [ ] readUrlParams() — reads entity_type and entity_id from URL params, sets filters
- [ ] buildQueryParams override — adds entity_id to query if set via URL

### Functions — ESC Key Handler
- [ ] ESC keydown listener — closes revert modal → nuke confirm → delete modal → filter panel → default

### Functions — Initialization
- [ ] initAuditLog() — reads URL params, populates actors, loads entries, inits mobile panel

### Modals
- [ ] Delete Audit Logs Modal (#delete-modal) — prune dropdown, count display, download checkbox, NUKE button, cancel
- [ ] Final Nuke Confirmation Modal (#nuke-confirm-modal) — count message, cancel, NUKE THEM button
- [ ] Revert Confirmation Modal (#revert-confirm-modal) — message, cancel, revert button

### Table Features
- [ ] Sortable column headers (click to sort)
- [ ] Draggable column headers (drag to reorder)
- [ ] Expandable detail rows (▶/▼ toggle)
- [ ] Action badges (created/updated/deleted/reverted with color coding)
- [ ] Entity links (click to navigate to chit/contact/settings)
- [ ] Revert button in detail rows (for chit update entries with revertible fields)
- [ ] Load More button with entry count display
