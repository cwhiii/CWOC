# Projects (Kanban + List Sub-Modes)

**Category:** Dashboard Views
**Item #:** 12
**Code Verified:** ✅
**User Verified:** ⬜

## Source Files
- `src/frontend/js/dashboard/main-views-projects.js` — Projects list + Kanban views
- `src/frontend/js/dashboard/main-views.js` — Shared helpers, `_restoreViewModeButtons`

---

## Mode Toggle

- [ ] `_projectsViewMode` — state variable: `'kanban'` (default) or `'list'`
- [ ] `_setProjectsMode(mode)` — switches between list/kanban
  - [ ] Persists to `localStorage('cwoc_projectsViewMode')`
  - [ ] Updates URL hash via `_updateUrlHash()`
  - [ ] Updates button highlight styles (ivory background for active)
  - [ ] Calls `displayChits()` to re-render
- [ ] `_restoreViewModeButtons()` — restores button highlight on re-render
  - [ ] `#projects-mode-list` button
  - [ ] `#projects-mode-kanban` button

---

## Projects View Entry Point

- [ ] `displayProjectsView(chitsToDisplay)` — routes to Kanban or List based on `_projectsViewMode`

---

## List View — `displayProjectsView` (when mode = 'list')

### Project Discovery
- [ ] Filters from ALL chits (not just filtered) for `is_project_master && !deleted && !archived`
- [ ] Deduplicates by ID using `Set`
- [ ] Applies manual sort order via `applyManualOrder('Projects', projects)`
- [ ] Shows empty state if no projects found

### Missing Children Pre-fetch
- [ ] Collects child IDs not in `chitMap`
- [ ] Skips IDs in `window._projectChildNotFound` (prevents infinite re-fetch)
- [ ] Fetches missing children via `GET /api/chit/${id}`
- [ ] Adds fetched children to global `chits` array
- [ ] Marks unfetchable IDs in `_projectChildNotFound` Set
- [ ] Re-calls `displayProjectsView()` after fetch completes

### Project Box Rendering (per project)
- [ ] Outer box with project color background, `2px solid #8b5a2b` border
- [ ] `dataset.chitId` and `draggable = true`

### Project Header
- [ ] Drag grip handle — "≡" character, `cursor: grab`
- [ ] Standard `_buildChitHeader()` with `{ checklistCount: true }`
- [ ] Child chit progress count (when settings enabled):
  - [ ] `projects_show_child_count === '1'` — shows `completed/total` with ✓
  - [ ] `projects_show_checklist_count === '1'` — shows aggregate checklist `checked/total` with ☑
- [ ] Inline note snippet — first line of project note, truncated to 80 chars
- [ ] "+" button (`cwoc-project-add-btn`) — creates new child chit via `_projectQuickCreateChild`
  - [ ] Hidden for viewer-role users

### Project Header Interactions
- [ ] Double-click: navigates to `/editor?id=${project.id}`
- [ ] Shift+click: opens `_showProjectQuickMenu(e, project)`
- [ ] Right-click: opens `_showProjectQuickMenu(e, project)`
- [ ] HTML5 dragstart: sets `application/x-list-project-reorder` data

### Child Chits Tree (per project)
- [ ] `<ul>` with class `projects-child-list`, `dataset.projectId`
- [ ] Each child as `<li>` with class `chit-card projects-child-item`
- [ ] Child background color via `chitColor(child)`
- [ ] `draggable = true`, `cursor: grab`

### Child Item Rendering
- [ ] Drag grip handle — "≡" character
- [ ] Bullet — "▸" character
- [ ] Title text (with ⛓️ prefix if `_hasIncompletePrereqs`)
- [ ] Checklist progress count: `(checked/total)` with ✓ suffix
- [ ] Visual indicators via `_getAllIndicators(child, settings, 'card')`
- [ ] Meta row: Status · Priority · Severity · Due date
- [ ] Note preview via `_buildNotePreview(child)` (expandable on mobile)

### Child Item Interactions
- [ ] Double-click: navigates to `/editor?id=${child.id}`
- [ ] Shift+click: opens quick-edit modal
- [ ] Right-click: suppressed (no context menu)
- [ ] HTML5 dragstart: sets `application/x-project-child-reorder` data

### Child Reorder (HTML5 Drag)
- [ ] Dragover: shows border indicator (top/bottom based on cursor position)
- [ ] Drop: reorders `child_chits` array and saves via `PUT /api/chits/${project.id}`
- [ ] Calls `_kanbanFetchAndPreserveScroll()` after save

### Child Reorder (Touch/Mobile)
- [ ] `enableTouchGesture` on each child item
- [ ] `onDragMove`: shows border indicators on target items
- [ ] `onDragEnd`: reorders and saves to backend
- [ ] `onLongPress`: opens quick-edit modal

### Project-Level Reorder (HTML5 Drag)
- [ ] Dragover on view container: positions placeholder
- [ ] Drop: reorders project IDs, saves via `saveManualOrder('Projects', ids)`
- [ ] Sets `currentSortField = 'manual'`
- [ ] Updates sort UI and persists sort preference
- [ ] Preserves scroll position across re-render

### Project-Level Reorder (Touch/Mobile)
- [ ] `enableTouchGesture` on each project box
- [ ] `onDragMove`: positions placeholder, auto-scrolls near edges
- [ ] `onDragEnd`: saves new order, re-renders with scroll preservation
- [ ] `onLongPress`: opens quick-edit modal for the project

---

## Kanban View — `_displayProjectsKanban`

### Project Discovery (same as List)
- [ ] Filters `is_project_master && !deleted && !archived`, deduplicates
- [ ] Applies manual sort order
- [ ] Missing children pre-fetch (same logic as List view)
- [ ] Auto-prunes stale child references from `_projectChildNotFound`

### Kanban Board Rendering — `_renderKanbanBoard`
- [ ] Status columns: `["ToDo", "In Progress", "Blocked", "Complete"]`
- [ ] Wrapper with class `projects-view`

### Project Box (per project)
- [ ] Class `kanban-project-box`, `dataset.chitId`, `draggable = true`
- [ ] Project color background and font color

### Kanban Project Header
- [ ] Drag grip — "≡" character, `cursor: grab`
- [ ] Title text (with checklist progress count if project has checklist)
- [ ] Child chit progress count (same settings as List view)
- [ ] Inline note snippet — first line, truncated to 60 chars
- [ ] "+" button — creates new child chit
- [ ] Double-click: navigates to editor
- [ ] Shift+click: opens project quick menu
- [ ] Right-click: opens project quick menu

### Kanban Project Drag (reorder projects)
- [ ] Dragstart only from header area (not from child cards)
- [ ] Sets `application/x-project-reorder` data
- [ ] `_kanbanProjectDragActive` flag prevents child drag interference

### Kanban Columns Row
- [ ] `display: flex` row of 4 status columns
- [ ] Each column: `kanban-column` class, `dataset.status`, `dataset.projectId`
- [ ] Column header: bold status name, centered, with bottom border

### Kanban Child Cards (per child chit)
- [ ] Class `chit-card`, `draggable = true`
- [ ] `dataset.chitId`, `dataset.projectId`
- [ ] Child color background and font color
- [ ] `completed-task` class for Complete/Rejected status
- [ ] `declined-chit` class for declined shared chits

### Kanban Card Content
- [ ] Title (with ⛓️ prefix for incomplete prereqs)
- [ ] Title strikethrough for Complete/Rejected
- [ ] Checklist progress count inline with title
- [ ] Visual indicators inline with title
- [ ] Stealth indicator 🥷 (owner only)
- [ ] Meta row: Priority · Severity
- [ ] Due date row
- [ ] Note preview via `_buildNotePreview()` (expandable on mobile)
- [ ] Owner badge (when owner differs from current user)
- [ ] Assignee badge

### Grandchildren (children of children)
- [ ] Rendered as `<ul>` sub-list within the card
- [ ] Each grandchild as `<li>` with `draggable = true`
- [ ] Bullet: "✓" for Complete/Rejected, "▸" otherwise
- [ ] Title text (strikethrough for Complete/Rejected)
- [ ] Opacity 0.5 for Complete/Rejected grandchildren

---

## Project Quick Menu — `_showProjectQuickMenu`

- [ ] Full-screen overlay with positioned menu
- [ ] Menu items:
  - [ ] 📄 Create New Child Chit → `_projectQuickCreateChild(project)`
  - [ ] ✏️ Open in Editor → navigates to `/editor?id=${project.id}`
  - [ ] ⚙️ Quick Edit → `showQuickEditModal(project, callback)`
  - [ ] 📌 Pin / Unpin → `PATCH /api/chits/${id}/fields`
  - [ ] 📦 Archive / Unarchive → `PATCH /api/chits/${id}/fields`
  - [ ] 😴 Snooze (H/D/W/F/M circular buttons) or Unsnooze
    - [ ] Shows undo toast via `_showSnoozeUndoToast`
    - [ ] Persists via `POST /api/chits/${id}/snooze`
  - [ ] 🗑️ Delete → confirmation via `cwocConfirm`, then `DELETE /api/chits/${id}`
    - [ ] Shows undo toast via `_showDeleteUndoToast`
- [ ] Click overlay to close
- [ ] ESC to close (with `stopImmediatePropagation`)

---

## Project Quick Create Child — `_projectQuickCreateChild`

- [ ] `cwocPromptModal("Create New Child Chit", "Enter chit title…", callback)`
- [ ] Creates chit via `POST /api/chits` with `{ title, status: "ToDo" }`
- [ ] Fetches project via `GET /api/chit/${project.id}`
- [ ] Appends new chit ID to `child_chits` array
- [ ] Saves project via `PUT /api/chits/${project.id}`
- [ ] Shows success toast
- [ ] Calls `fetchChits()` to refresh

---

## Scroll Preservation — `_kanbanFetchAndPreserveScroll`

- [ ] Saves `.projects-view` scrollTop before fetch
- [ ] Wraps `displayChits` to restore scroll after re-render
- [ ] Uses `requestAnimationFrame` for reliable scroll restoration

---

## URL Hash Routing

- [ ] Projects tab hash: `#projects` (default kanban) or `#projects/list`
- [ ] `_hashTabModes.projects` returns mode if not 'kanban'
- [ ] `_hashDefaultModes.projects = 'kanban'`
