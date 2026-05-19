# Contact Trash

**Category:** Standalone Pages
**Item #:** 41
**Code Verified:** ✅
**User Verified:** ⬜

## Functions, Buttons, Controls & Inputs

### Toolbar
- [ ] trash-count — displays "N deleted contact(s)" count
- [ ] selected-count — displays "N selected" when items checked
- [ ] bulk-actions container (shown when items selected):
  - [ ] "Restore Selected" button — bulkRestore()
  - [ ] "Delete Selected" button — bulkPurge()

### Table Display
- [ ] trash-table-wrap container — holds the rendered table
- [ ] renderTable(wrap, contacts) — builds and renders the contacts table
- [ ] cwoc-table — styled table with columns:
  - [ ] Checkbox column (col-check) — per-row selection
  - [ ] Name column (col-name) — display_name with vault badge (🏛️)
  - [ ] Organization column (col-org)
  - [ ] Email column (col-email) — first email from parsed JSON
  - [ ] Phone column (col-phone) — first phone from parsed JSON
  - [ ] Deleted column — formatted deleted_datetime
  - [ ] Actions column (col-actions) — Restore + Delete buttons

### Selection System
- [ ] select-all checkbox (in thead) — toggleSelectAll()
- [ ] .row-check checkboxes — per-row selection
- [ ] selectedIds Set — tracks selected contact IDs
- [ ] toggleSelectAll() — selects/deselects all rows
- [ ] toggleRow(id) — toggles individual row selection
- [ ] updateSelectionUI() — updates bulk actions visibility, count text, select-all state (checked/indeterminate)

### Actions
- [ ] bulkRestore() — restores all selected contacts via POST /api/trash/contacts/:id/restore
- [ ] bulkPurge() — permanently deletes selected contacts via DELETE /api/trash/contacts/:id/purge (with cwocConfirm)
- [ ] Per-row "Restore" button — POST /api/trash/contacts/:id/restore, reloads list
- [ ] Per-row "Delete" button — DELETE /api/trash/contacts/:id/purge (with cwocConfirm), reloads list

### Data Loading
- [ ] loadTrash() — fetches from GET /api/trash/contacts, renders table
- [ ] waitForAuth() — waits for authentication before loading
- [ ] Empty state — "No deleted contacts." message when list is empty
- [ ] Error state — error message on fetch failure

### Helper Functions
- [ ] fmtDateTime(iso) — formats ISO date to "Mon-DD HH:MM" format
- [ ] getFirstEmail(contact) — extracts first email from JSON field
- [ ] getFirstPhone(contact) — extracts first phone from JSON field

### Data Variables
- [ ] trashData array — full list of deleted contacts from API
- [ ] MONTHS array — month abbreviations for date formatting
