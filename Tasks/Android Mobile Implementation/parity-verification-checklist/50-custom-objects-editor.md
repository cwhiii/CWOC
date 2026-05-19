# Custom Objects Editor

**Category:** Standalone Pages
**Item #:** 50
**Code Verified:** ⬜
**User Verified:** ⬜

## Functions, Buttons, Controls & Inputs

### State Variables
- [ ] _coAllObjects — full list of custom objects from API
- [ ] _coFilteredObjects — after type/search filter
- [ ] _coEditingId — null for create, string for edit mode
- [ ] _coDeleteTargetId — object pending deletion
- [ ] _coAllZones — custom zones from API
- [ ] _coZoneModalObjectId — object being managed in zone modal
- [ ] _coZoneEditorZone — zone being edited in zone editor

### Toolbar Controls
- [ ] Type filter dropdown (#coTypeFilter) — dynamically populated from object types (onchange → _coApplyFilters)
- [ ] Search input (#coSearchInput) — text search by name (oninput → _coApplyFilters)
- [ ] Create button (#coCreateBtn) — opens create modal (onclick → _coOpenEditModal(null))

### Custom Zones Section
- [ ] Zones header with "➕ Create Zone" button (#coZonesCreateBtn)
- [ ] Zones list (#coZonesList) — displays all custom zones
- [ ] Each zone row contains:
  - [ ] Drag handle (☰) — for reorder
  - [ ] Zone name
  - [ ] Object count badge
  - [ ] Edit button — opens zone editor
  - [ ] Delete button — confirms and deletes zone

### Object List
- [ ] Objects grouped by type → sub_type (two-level hierarchy)
- [ ] Type group headers with count
- [ ] Sub-type sub-headers (when present)
- [ ] Each object row contains:
  - [ ] Object name (with .inactive styling if deactivated)
  - [ ] Zone badges (showing assigned zones)
  - [ ] Active toggle (checkbox switch)
  - [ ] Edit button (✏️)
  - [ ] Zone management button (layer icon)
  - [ ] Delete button (🗑️)
  - [ ] Restore button (for deleted standard objects)

### Functions — Initialization
- [ ] DOMContentLoaded listener — clones templates, caches DOM refs, wires controls, loads data
- [ ] _coCloneTemplates() — clones 5 template elements into body

### Functions — Data Fetching
- [ ] _coFetchAll() — async GET /api/custom-objects, populates type filter, applies filters
- [ ] _coFetchZones() — async GET /api/custom-zones, renders zones list
- [ ] _coFetchIndicators() — fetches indicator data

### Functions — Filtering
- [ ] _coPopulateTypeFilter() — rebuilds type dropdown from unique object types
- [ ] _coApplyFilters() — filters by type and search text, renders list

### Functions — List Rendering
- [ ] _coRenderList() — groups objects by type/sub_type, renders grouped list
- [ ] _coCreateRow(obj) — creates single object row with name, badges, action buttons

### Functions — Edit Modal
- [ ] _coInitEditModal() — wires cancel/save buttons
- [ ] _coOpenEditModal(obj) — opens modal in create or edit mode, populates fields
- [ ] _coCloseEditModal() — closes edit modal
- [ ] _coToggleNumericFields() — shows/hides units/range fields based on value_type
- [ ] _coPopulateDatalist(datalistId, field) — populates autocomplete datalist from existing values
- [ ] _coSaveObject() — async validates, POST (create) or PUT (update) to /api/custom-objects

### Edit Modal Fields
- [ ] Name input (#coEditName) — required
- [ ] Type input (#coEditType) — with datalist autocomplete
- [ ] Category/Sub-type input (#coEditCategory) — with datalist autocomplete
- [ ] Value Type dropdown (#coEditValueType) — boolean/integer/decimal/text
- [ ] Units input (#coEditUnits) — shown for numeric types
- [ ] Metric Units input (#coEditMetricUnits) — shown for numeric types
- [ ] Range Min input (#coEditRangeMin) — shown for numeric types
- [ ] Range Max input (#coEditRangeMax) — shown for numeric types
- [ ] Advanced section toggle (#coAdvancedToggle) — expandable
- [ ] Conditional Display textarea (#coEditConditionalDisplay) — JSON editor

### Functions — Active Toggle
- [ ] _coToggleActive(objectId, newActive) — async PUT to update active status

### Functions — Delete Modal
- [ ] _coInitDeleteModal() — wires cancel/confirm buttons
- [ ] _coOpenDeleteModal(obj) — opens delete confirmation with object name
- [ ] _coCloseDeleteModal() — closes delete modal
- [ ] _coConfirmDelete() — async DELETE /api/custom-objects/{id}

### Functions — Restore
- [ ] _coRestoreObject(objectId) — async POST /api/custom-objects/{id}/restore

### Functions — Zone Assignment Modal
- [ ] _coOpenZoneModal(obj) — opens zone assignment modal for object
- [ ] _coGetAllKnownZones() — gathers all unique zone IDs from all objects
- [ ] _coRenderZoneList(obj) — renders zone list with toggle/sort/config for each zone
- [ ] _coCreateZoneItem(objectId, zoneId, isAssigned, za) — creates zone item with toggle, sort order, config editor
- [ ] _coAssignZone(objectId, zoneId) — async POST /api/custom-objects/{id}/assign
- [ ] _coUnassignZone(objectId, zoneId) — async DELETE /api/custom-objects/{id}/assign/{zone_id}
- [ ] _coUpdateZoneAssignment(objectId, zoneId, config, sortOrder) — async PUT zone assignment
- [ ] _coRefreshAfterZoneChange(objectId) — refreshes data and re-renders zone modal

### Functions — Create Zone Modal
- [ ] _coInitCreateZoneModal() — wires cancel/submit buttons and Enter key
- [ ] _coOpenCreateZoneModal() — opens create zone modal, clears input
- [ ] _coCloseCreateZoneModal() — closes create zone modal
- [ ] _coSubmitCreateZone() — async POST /api/custom-zones with name

### Functions — Zone Editor Modal (Full-screen)
- [ ] _coInitZoneEditorModal() — wires close button, name blur, add button
- [ ] _coOpenZoneEditor(zone) — opens full-screen zone editor with object grid
- [ ] _coCloseZoneEditor() — closes zone editor modal
- [ ] Zone editor features:
  - [ ] Zone name input (editable, saves on blur)
  - [ ] Add Objects button — opens multi-select picker
  - [ ] Object cards with drag handles for reorder
  - [ ] Remove button (×) per object card
  - [ ] Preview panel showing zone as it would appear in editor

### Functions — Zone Drag Reorder
- [ ] _coInitZoneDragReorder() — attaches HTML5 drag + touch drag handlers
- [ ] _coZoneOnDragStart(e) — HTML5 drag start
- [ ] _coZoneOnDragOver(e) — HTML5 drag over with placeholder
- [ ] _coZoneOnDragEnd() — HTML5 drag end cleanup
- [ ] _coZoneOnDrop(e) — HTML5 drop, persists new order
- [ ] _coZoneOnTouchStart(row, data) — touch drag start
- [ ] _coZoneOnTouchMove(row, data) — touch drag move with placeholder
- [ ] _coZoneOnTouchEnd(row, data) — touch drag end, persists order
- [ ] _coZonePersistOrder(orderedZoneIds) — async saves zone order

### Functions — Zone Deletion
- [ ] _coDeleteZone(zone) — async confirms via cwocConfirm, DELETE /api/custom-zones/{zone_id}

### Functions — ESC Key Handler
- [ ] _coHandleEsc(e) — closes zone editor → create zone → delete → zone assignment → edit modal (layered)

### Functions — Zone Preview
- [ ] Zone preview panel rendering — shows how zone will look in chit editor
- [ ] Indicator sections with collapsible headers
- [ ] Grid layout for indicator fields (3-column)
- [ ] Input types: text, number, checkbox based on value_type

### Multi-Select Picker (Add Objects to Zone)
- [ ] Picker overlay with search input
- [ ] Objects grouped by type/sub_type with collapsible headers
- [ ] Checkbox per object for multi-select
- [ ] Confirm/Cancel buttons
