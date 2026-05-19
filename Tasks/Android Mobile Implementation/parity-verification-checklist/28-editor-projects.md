# Projects Zone

**Category:** Editor Zones
**Item #:** 28
**Code Verified:** ✅
**User Verified:** ⬜

## Source File
`src/frontend/js/editor/editor_projects.js`

## Global State

- [ ] `projectState.projectChit` — Current project chit object
- [ ] `projectState.childChits` — Map of child chit ID → chit object
- [ ] `projectState.projectMasters` — List of all project master chits (for move dropdown)
- [ ] `projectState._dirtyChildIds` — Set of child chit IDs modified this session

## Functions

### Initialization & Data Loading

- [ ] `initializeProjectZone(projectChitId)` — Main init: fetch masters, load project data, render, update buttons
- [ ] `clearProjectsContent()` — Clear container, reset state, show "No project data" message
- [ ] `updateHeaderButtonsVisibility()` — Show/hide Add/Create/Filter buttons based on is_project_master
- [ ] `loadProjectData(projectChitId)` — Fetch project chit + all child chits from API, auto-prune stale refs
- [ ] `fetchProjectMasters()` — Fetch all chits, filter to is_project_master === true
- [ ] `chitExists(chitId)` — Check if a chit exists via API (GET /api/chit/:id)

### Rendering

- [ ] `renderChildChitsByStatus()` — Render Kanban board: group children by status, create sections
- [ ] `createChildChitCard(chit)` — Create a single child chit card element with all controls

### Status Columns (Kanban)

- [ ] "ToDo" column — Section with collapsible header, drag-drop target
- [ ] "In Progress" column — Section with collapsible header, drag-drop target
- [ ] "Blocked" column — Section with collapsible header, drag-drop target
- [ ] "Complete" column — Section with collapsible header (collapsed by default), drag-drop target
- [ ] "Rejected" sub-section — Nested under Complete, dashed border, collapsed by default

### Column Headers

- [ ] Status title (h3) — Column name
- [ ] Count span — Shows "(N)" or "(N + M rejected)"
- [ ] Toggle icon (▼/▶) — Click to collapse/expand column
- [ ] Collapse/expand click handler — Toggle list display

### Child Chit Card Controls

- [ ] Drag handle (≡) — Far left, for reorder
- [ ] Status dropdown (select) — Options: ToDo, In Progress, Blocked, Complete, Rejected
- [ ] Title div (contentEditable) — Inline editable title, overflow ellipsis
- [ ] Checklist progress count — Shows "(checked/total ✓)" if chit has checklist items
- [ ] Due date input (`type="date"`) — Set/change due date
- [ ] Open chit button (external link icon) — Opens chit in new tab (/editor?id=...)
- [ ] Move to project button (folder icon) — Dropdown to move to another project
- [ ] Move project dropdown — Lists all other project masters
- [ ] Remove from project button (✕) — Unlink chit from project (with cwocConfirm)
- [ ] Delete button (trash icon) — Permanently delete child chit (with cwocConfirm, danger)

### Drag & Drop (Desktop)

- [ ] Card draggable attribute — All cards are draggable
- [ ] dragstart event — Set data transfer, add "dragging" class, hide card after capture
- [ ] dragend event — Restore card display, remove "dragging" class
- [ ] Section dragover — Show "drag-over" class, show placeholder for within-section reorder
- [ ] Section dragleave — Remove "drag-over" class, remove placeholder
- [ ] Section drop — Change status if different section, reorder if same section
- [ ] Drop placeholder — Dashed border div showing insertion point
- [ ] Within-section reorder — Rebuild child_chits order array based on drop position
- [ ] Cross-section drop — Update chit status to target section's status
- [ ] Rejected sub-section drop — Separate drag-drop zone for Rejected status

### Touch Drag (Mobile)

- [ ] `enableTouchGesture` integration — Touch-based drag for mobile
- [ ] onDragStart — Create placeholder, float card (fixed position, z-index 10000)
- [ ] onDragMove — Move floating card, find target section, position placeholder
- [ ] onDragEnd — Determine target section, change status or reorder, restore card styles
- [ ] Floating card style — opacity 0.9, box-shadow, pointer-events none
- [ ] Placeholder style — Dashed border, semi-transparent background
- [ ] overscrollBehavior: contain — Prevent page scroll during drag

### Status & Data Changes

- [ ] `updateChitStatus(chitId, newStatus)` — Update child chit status, mark dirty, re-render
- [ ] `handleStatusChange(childChitId, newStatus)` — Update status in childChits map, mark dirty
- [ ] `handleDueDateChange(childChitId, newDueDate)` — Update due_datetime, mark dirty
- [ ] `saveCurrentChit()` — Delegate to setSaveButtonUnsaved() to mark editor dirty

### Project Operations

- [ ] `moveChildChitToProject(childChitId, targetProjectId)` — Move child to another project
- [ ] `addChildChit(chit)` — Add a chit to childChits map and child_chits array, re-render
- [ ] `addProjectItem()` — Alias for openAddChitModal()
- [ ] `createNewChildChit(event)` — Create brand new chit via API, add as child (cwocPromptModal for title)
- [ ] `toggleProjectMaster()` — Toggle is_project_master with confirmation if children exist

### Save

- [ ] `saveProjectChanges()` — Save all dirty child chits to backend (PUT existing, POST new)

### Add Chit Modal

- [ ] `openAddChitModal()` — Open modal to select existing chits as children
- [ ] Modal overlay — Full-screen flex overlay
- [ ] Modal header — "Add Child Chits (N available)"
- [ ] Status filter dropdown — All Statuses, ToDo, In Progress, Blocked, Complete
- [ ] Priority filter dropdown — All Priorities, Low, Medium, High, Critical
- [ ] Email checkbox — Include/exclude email chits (excluded by default)
- [ ] Search input — Filter chits by text (searches title, note, checklist, people, location, tags, status)
- [ ] Chit table — Columns: checkbox, Title+Tags, Due, Status
- [ ] Checkbox per row — Multi-select chits to add
- [ ] Already-child indicator (✓) — Greyed out rows for chits already in project
- [ ] Selection count span — "N selected"
- [ ] "Add Selected" button — Add all selected chits, close modal
- [ ] "Cancel" button — Close modal without adding
- [ ] Click overlay to close — Clicking outside modal content closes it
- [ ] ESC key (layered) — First ESC clears search, second ESC closes modal
- [ ] Row click — Toggle checkbox
- [ ] Row double-click — Add immediately
- [ ] Search highlight — Matched text highlighted with `<mark>`
- [ ] Tag badges — Non-system tags shown as small badges
- [ ] Match field indicator — Shows which field matched when not in title
- [ ] `_applyModalFilters()` — Combined filter: text + status + priority + email toggle
- [ ] `chitMatchesSearch(chit, searchTerm)` — Search across all chit fields (external)

### Header Buttons (in editor HTML)

- [ ] "Add Existing" button (`#addNewChitButton`) — Opens add chit modal
- [ ] "Create New" button (`#createNewChildButton`) — Creates new child chit
- [ ] "Filter" button (`#filterProjectItemsBtn`) — Filter project items

### Document-Level Listeners

- [ ] Click anywhere closes move-project dropdowns — Single document listener
