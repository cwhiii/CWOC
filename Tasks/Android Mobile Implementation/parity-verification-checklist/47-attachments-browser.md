# Attachments Browser

**Category:** Standalone Pages
**Item #:** 47
**Code Verified:** ⬜
**User Verified:** ⬜

## Functions, Buttons, Controls & Inputs

### State Variables
- [ ] _allAttachments — raw data array from API
- [ ] _filtered — filtered/sorted indices into _allAttachments
- [ ] _selectedSet — Set of selected filtered indices
- [ ] _lastClickedIndex — last clicked index for shift-range selection

### Filter/Sort Controls
- [ ] Type filter dropdown (#att-filter-type) — All / Images / Documents / Audio / Video / Archives / Other (onchange → applyFilters)
- [ ] Size Min input (#att-filter-size-min) — number input for minimum MB (oninput → applyFilters)
- [ ] Size Max input (#att-filter-size-max) — number input for maximum MB (oninput → applyFilters)
- [ ] Sort dropdown (#att-sort) — Newest First / Oldest First / Name A–Z / Name Z–A / Largest First / Smallest First (onchange → applyFilters)
- [ ] Search input (#att-search) — text search for filename (oninput → applyFilters)

### Toolbar
- [ ] Attachment count display (#att-count) — shows total count
- [ ] Selected count display (#selected-count) — shows selection count
- [ ] Delete Selected button (#bulk-delete-btn) — bulk delete with confirmation (onclick → bulkDelete)

### Functions — Initialization
- [ ] init() — wires event listeners for bulk delete and filter controls, calls loadAttachments
- [ ] waitForAuth integration — waits for auth before init

### Functions — Data Loading
- [ ] loadAttachments() — async fetches /api/attachments, populates _allAttachments, calls applyFilters

### Functions — Filtering & Sorting
- [ ] applyFilters() — reads all filter/sort controls, filters _allAttachments, sorts results, resets selection, renders grid
- [ ] getTypeCategory(mimeType) — categorizes MIME type into image/video/audio/document/archive/other

### Functions — Rendering
- [ ] renderGrid(wrap) — builds grid of .att-card elements with thumbnails, filenames, sizes, chit links, checkboxes

### Functions — Preview Modal
- [ ] openPreviewModal(att) — creates and shows full preview modal overlay with:
  - [ ] Image preview (for image/* MIME types)
  - [ ] Video player (for video/* MIME types)
  - [ ] Audio player (for audio/* MIME types)
  - [ ] File icon (for other types)
  - [ ] Details section (filename, size, type, uploaded date, chit name)
  - [ ] Download button (links to attachment API endpoint)
  - [ ] Open Chit button (links to editor)
  - [ ] Close button (×)
  - [ ] Click-outside-to-close behavior
  - [ ] ESC key to close (capture phase, stopImmediatePropagation)
- [ ] addDetail(dl, label, value) — adds dt/dd pair to details list

### Functions — Selection Logic
- [ ] handleSelect(filteredIdx, e, fromCheckbox) — handles shift-range, ctrl/cmd-toggle, and single-select
- [ ] syncSelectionDOM() — syncs .selected class and checkbox state across all cards
- [ ] updateSelectionUI() — shows/hides bulk actions bar and selected count

### Functions — Bulk Delete
- [ ] bulkDelete() — async confirms via cwocConfirm, sends DELETE /api/attachments/bulk, shows toast, reloads

### Functions — Helpers
- [ ] getFileIcon(mimeType) — returns emoji icon based on MIME type
- [ ] formatFileSize(bytes) — formats bytes to human-readable (B/KB/MB/GB)
- [ ] formatDate(iso) — formats ISO date to "Mon DD, YYYY HH:MM"

### Card Interactions
- [ ] Plain click → opens preview modal
- [ ] Ctrl/Cmd+click → toggles selection
- [ ] Shift+click → range selection from last clicked
- [ ] Checkbox click → toggles individual selection
- [ ] Chit link click → navigates to editor (stopPropagation)

### Grid Card Elements
- [ ] Selection checkbox (.att-check) — appears on hover/selected
- [ ] Thumbnail (.att-thumb) — image preview or file type icon
- [ ] Filename (.att-filename) — truncated with ellipsis
- [ ] File size (.att-size) — formatted size
- [ ] Chit name link (.att-chit) — links to parent chit editor
