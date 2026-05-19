# Admin Chits (Chit Manager)

**Category:** Standalone Pages
**Item #:** 52
**Code Verified:** ⬜
**User Verified:** ⬜

## Functions, Buttons, Controls & Inputs

### State Variables
- [ ] _allResults — array of search results from API
- [ ] _selectedIds — Set of selected chit IDs
- [ ] _users — array of all users (for owner display/filter)

### Toolbar Controls
- [ ] Search input (#searchInput) — text search with same syntax as global search (text, #tags, &&, ||, !)
- [ ] Owner filter dropdown (#ownerFilter) — All Owners / ⚠️ No Owner / dynamically populated users
- [ ] Status filter dropdown (#statusFilter) — All Statuses / ⚠️ No Status / ToDo / In Progress / Blocked / Complete
- [ ] Show Deleted checkbox (#showDeleted) — toggles display of soft-deleted chits
- [ ] Search button (🔍) — onclick → doSearch

### Table
- [ ] Select All checkbox (#selectAll) — toggles all row selections
- [ ] Table columns: Checkbox, ID, Title (linked), Status, Owner, Assignee, Attachments (📎), Deleted, Modified
- [ ] Row checkboxes (.row-cb) — toggle individual selection
- [ ] Selected rows get .selected class
- [ ] Deleted rows get .deleted-row class (opacity 0.5)
- [ ] Title links open editor in new tab (/editor?id={id})
- [ ] Owner shows ⚠️ NONE badge for ownerless chits
- [ ] Attachments column shows 📎 icon with count

### Bulk Action Bar (#bulkBar)
- [ ] Selected count display (#selectedCount)
- [ ] Bulk Action dropdown (#bulkAction) — Set Owner / Set Status / Set Priority / Mark Deleted / Undelete
- [ ] Bulk Owner dropdown (#bulkOwner) — shown when action = set_owner
- [ ] Bulk Status dropdown (#bulkStatus) — shown when action = set_status (ToDo/In Progress/Blocked/Complete)
- [ ] Bulk Priority dropdown (#bulkPriority) — shown when action = set_priority (Low/Medium/High/Critical)
- [ ] Apply button (⚡) — onclick → executeBulk

### Functions — Initialization
- [ ] init() — loads users for dropdowns, wires Enter key on search, wires selectAll, wires bulkAction change, auto-searches
- [ ] waitForAuth integration (if available)

### Functions — Messages
- [ ] showMessage(text, type) — shows inline success/error message with 5s auto-dismiss

### Functions — Search
- [ ] doSearch() — async GET /api/admin/chits with query params (q, no_owner, owner_id, limit), applies client-side filters (deleted, status), renders table

### Functions — Rendering
- [ ] renderTable(results) — builds table rows with all columns, checkboxes, links, badges
- [ ] updateBulkBar() — shows/hides bulk bar based on selection count

### Functions — Bulk Operations
- [ ] executeBulk() — validates action/selection, confirms with user, async POST /api/admin/chits/bulk-update with chit_ids and updates object

### Event Handlers
- [ ] Search input Enter key → doSearch
- [ ] Select All checkbox change → toggles all selections
- [ ] Row checkbox change → adds/removes from _selectedIds, toggles .selected class
- [ ] Bulk Action dropdown change → shows/hides relevant sub-select (owner/status/priority)

### Inline Message Area
- [ ] #admin-message — success (green) or error (red) messages

### Results Info
- [ ] #resultsInfo — shows "N results (M filtered out)" text

### Mobile Responsive
- [ ] Card-style table layout on mobile
- [ ] data-label attributes for mobile labels
- [ ] Full-width search input on mobile
