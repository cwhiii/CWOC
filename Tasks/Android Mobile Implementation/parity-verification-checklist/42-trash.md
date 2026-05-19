# Trash (Chit Trash)

**Category:** Standalone Pages
**Item #:** 42
**Code Verified:** ✅
**User Verified:** ⬜

## Functions, Buttons, Controls & Inputs

### Toolbar
- [ ] trash-count — displays "N deleted chit(s)" or "N deleted email(s)" count
- [ ] selected-count — displays "N selected" when items checked
- [ ] bulk-actions container (shown when items selected):
  - [ ] "Restore Selected" button — bulkRestore()
  - [ ] "Delete Selected" button — bulkPurge()

### Table Display
- [ ] trash-table-wrap container — holds the rendered table
- [ ] renderTable(wrap, trash) — builds and renders the chits table
- [ ] cwoc-table — styled table with columns:
  - [ ] Checkbox column (col-check) — per-row selection
  - [ ] Title column (col-title) — chit title (truncated)
  - [ ] Owner column (admin only) — owner display name/username
  - [ ] Status column — chit status
  - [ ] Priority column — chit priority
  - [ ] Due/Start column — formatted date
  - [ ] Tags column (col-tags) — tag chips (system tags filtered out)
  - [ ] Note column (col-note) — first 80 chars of note
  - [ ] Deleted column — formatted deleted datetime
  - [ ] Actions column (col-actions) — Restore + Delete buttons

### Selection System
- [ ] select-all checkbox (in thead) — toggleSelectAll()
- [ ] .row-check checkboxes — per-row selection
- [ ] selectedIds Set — tracks selected chit IDs
- [ ] toggleSelectAll() — selects/deselects all rows
- [ ] toggleRow(id) — toggles individual row selection
- [ ] updateSelectionUI() — updates bulk actions visibility, count text, select-all state

### Actions
- [ ] bulkRestore() — restores all selected chits via POST /api/trash/:id/restore
- [ ] bulkPurge() — permanently deletes selected chits via DELETE /api/trash/:id/purge (with confirm)
- [ ] Per-row "Restore" button — POST /api/trash/:id/restore, reloads list
- [ ] Per-row "Delete" button — DELETE /api/trash/:id/purge (with confirm), reloads list

### Data Loading
- [ ] loadTrash() — fetches from GET /api/trash, applies filter, renders table
- [ ] waitForAuth() — waits for authentication before loading
- [ ] _trashIsAdmin flag — detected via isAdmin(), shows Owner column when true
- [ ] Empty state — "Trash is empty." message
- [ ] Error state — error message on fetch failure

### URL Filter Support
- [ ] ?filter=email query param — filters to only email chits (email_message_id or email_status)
- [ ] Updates page title to "Email Trash" when email filter active
- [ ] Updates count text to "N deleted email(s)"

### Helper Functions
- [ ] fmtDate(iso) — formats ISO date to "Mon-DD Dow" format
- [ ] fmtDateTime(iso) — formats ISO date to "Mon-DD HH:MM" format

### Data Variables
- [ ] trashData array — full list of deleted chits from API
- [ ] MONTHS array — month abbreviations
- [ ] DAYS array — day-of-week abbreviations
- [ ] SYS array — system tag names to filter from display (Calendar, Checklists, Alarms, Projects, Tasks, Notes)
