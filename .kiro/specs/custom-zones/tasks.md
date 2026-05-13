# Implementation Plan: Custom Zones

## Overview

This plan implements Custom Zones — user-defined named collections of Custom Objects that render as collapsible zones in the chit editor. The implementation follows the existing Custom Objects infrastructure patterns: migrations.py for DB changes, routes/ for API endpoints, pages/ for CO Editor frontend, and editor/ for chit editor modules. All rendering reuses the pure functions in `editor-health.js`.

## Tasks

- [x] 1. Backend — Database and API foundation
  - [x] 1.1 Add `custom_zones` table migration and Pydantic models
    - Add `migrate_create_custom_zones_table()` to `src/backend/migrations.py` using `CREATE TABLE IF NOT EXISTS` with columns: id (TEXT PK), zone_id (TEXT), name (TEXT), sort_order (INTEGER DEFAULT 0), owner_id (TEXT), created_datetime (TEXT), with UNIQUE constraint on (zone_id, owner_id)
    - Add `CustomZoneCreate`, `CustomZoneUpdate`, and `BulkReorderRequest` Pydantic models to `src/backend/models.py`
    - Register the migration call in `src/backend/main.py` alongside existing migrations
    - _Requirements: 13.1_

  - [x] 1.2 Create `src/backend/routes/custom_zones.py` with CRUD endpoints
    - `GET /api/custom-zones` — list all zones for authenticated user, ordered by sort_order, include object_count via COUNT on zone_assignments
    - `POST /api/custom-zones` — create zone (accepts name, generates zone_id via slugification: lowercase, replace non-alphanumeric with `_`, collapse consecutive, strip leading/trailing, prefix `cz_`), validate non-empty name, check uniqueness
    - `PUT /api/custom-zones/{zone_id}` — update name and/or sort_order
    - `DELETE /api/custom-zones/{zone_id}` — delete zone record AND cascade delete all zone_assignments for that zone
    - Register router in `src/backend/main.py`
    - _Requirements: 13.2, 13.3, 13.4, 13.5, 2.3, 2.4, 2.5, 10.2, 11.2, 11.3_

  - [x] 1.3 Add bulk reorder endpoint to `src/backend/routes/custom_objects.py`
    - `PUT /api/custom-objects/zone/{zone_id}/reorder` — accepts `{"object_ids": [...]}`, updates sort_order sequentially (1, 2, 3, ...) for each ID that has an existing zone_assignment, skips missing
    - Validate non-empty object_ids list (return 400 if empty)
    - _Requirements: 14.1, 14.2, 14.3_

  - [x]* 1.4 Write property tests for zone_id slugification (Property 1)
    - **Property 1: Zone_id Slugification**
    - **Validates: Requirements 2.3, 13.3**

  - [x]* 1.5 Write property tests for bulk reorder sequential assignment (Property 11)
    - **Property 11: Bulk Reorder Sequential Assignment**
    - **Validates: Requirements 14.1, 14.2, 14.3**

- [x] 2. Checkpoint — Backend API complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. CO Editor — Zone listing and CRUD UI
  - [x] 3.1 Add Custom Zones section to CO Editor page
    - Add a "Custom Zones" section above the filter bar in `custom-objects-editor.html` with a list container and "Create Custom Zone" button
    - In `custom-objects-editor.js`, fetch `GET /api/custom-zones` on page load and render each zone with name, object count, edit/delete buttons
    - Display empty state message when no zones exist
    - Display zones in sort_order
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 3.2 Implement zone creation modal
    - Add modal template to `custom-objects-editor.html` with text input for zone name and Cancel/Create buttons
    - Wire "Create Custom Zone" button to open modal
    - On submit: validate non-empty name, POST to `/api/custom-zones`, handle 409 duplicate error, on success immediately open zone editor
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 3.3 Implement zone deletion with confirmation
    - Add delete confirmation modal (reuse existing confirm pattern)
    - On confirm: DELETE `/api/custom-zones/{zone_id}`, refresh zone list
    - _Requirements: 10.1, 10.2, 10.3_

  - [x] 3.4 Implement drag-to-reorder for zone listing
    - Reuse `shared-touch.js` pattern for drag-to-reorder zones in the listing
    - On reorder complete: PUT `/api/custom-zones/{zone_id}` with new sort_order values for each zone
    - Support both desktop drag (HTML5) and mobile drag (touch hold + move)
    - _Requirements: 12.1, 12.2, 12.3_

- [x] 4. CO Editor — Zone editor modal (object assignment and reorder)
  - [x] 4.1 Implement zone editor modal with assigned objects display
    - Add zone editor modal template to `custom-objects-editor.html`
    - Display editable zone name field at top
    - Show assigned objects in 3-column grid (1 column on mobile), grouped by sub_type, sorted by sort_order
    - Include remove button (×) on each assigned object
    - On remove: DELETE `/api/custom-objects/{id}/assign/{zone_id}`, refresh list
    - _Requirements: 3.1, 3.4, 3.5, 11.1, 11.2, 11.3_

  - [x] 4.2 Implement Multi-Select Picker for adding objects to zone
    - Reuse the grouped/searchable picker pattern from `_showAddIndicatorPicker` in `editor-health.js`
    - Filter by name, type, sub_type with checkboxes for multi-select
    - On "Add Selected": POST `/api/custom-objects/{id}/assign` for each selected object with zone_id and incremental sort_order
    - _Requirements: 3.2, 3.3_

  - [x] 4.3 Implement drag-to-reorder within zone editor
    - Reuse `shared-touch.js` pattern for drag-to-reorder assigned objects
    - Maintain sub_type grouping during reorder (items reorder within their group)
    - On reorder complete: PUT `/api/custom-objects/zone/{zone_id}/reorder` with new order
    - Support both desktop and mobile drag
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 4.4 Add drag-to-reorder for indicators zone in CO Editor
    - Apply the same drag-to-reorder pattern to the existing indicators_zone section
    - On reorder complete: PUT `/api/custom-objects/zone/indicators_zone/reorder`
    - Support both desktop and mobile drag
    - _Requirements: 5.1, 5.2, 5.3_

- [x] 5. CO Editor — Zone preview
  - [x] 5.1 Implement zone preview panel
    - Add "Preview" button to zone editor modal
    - On click: render a preview using the same collapsible Zone_Panel layout, 3-column field grid, and input types as the chit editor
    - Group fields by sub_type with appropriate input types (numeric for integer/decimal, checkbox for boolean, text for string)
    - Apply range highlighting (red/blue borders) and unit labels matching user's unit_system setting
    - Reuse `_getRangeHighlightClass`, `_getUnitLabel`, `_evaluateConditionalDisplay` from `editor-health.js`
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x]* 5.2 Write property tests for value_type to input type mapping (Property 4)
    - **Property 4: Value_type to Input Type Mapping**
    - **Validates: Requirements 6.3, 7.5**

  - [x]* 5.3 Write property tests for range highlighting (Property 5)
    - **Property 5: Range Highlighting**
    - **Validates: Requirements 6.4, 7.7**

  - [x]* 5.4 Write property tests for conditional display evaluation (Property 6)
    - **Property 6: Conditional Display Evaluation**
    - **Validates: Requirements 7.6**

  - [x]* 5.5 Write property tests for unit label selection (Property 7)
    - **Property 7: Unit Label Selection**
    - **Validates: Requirements 7.8**

- [x] 6. Checkpoint — CO Editor complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Chit Editor — Dynamic zone rendering
  - [x] 7.1 Create `src/frontend/js/editor/editor-custom-zones.js` module
    - On chit load: fetch `GET /api/custom-zones` to discover user's zones
    - For each zone: fetch `GET /api/custom-objects/zone/{zone_id}` to get assigned objects
    - Filter out zones with zero visible objects (after conditional_display evaluation)
    - Render each zone as a collapsible Zone_Panel in the `.main-zones-grid`
    - Use same 3-column grid layout for fields (1 column on mobile)
    - Group fields by sub_type within each zone, sorted alphabetically
    - Render input fields based on value_type (numeric for integer/decimal, checkbox for boolean, text for string)
    - Evaluate conditional_display rules against user settings
    - Apply range highlighting on numeric fields
    - Display unit labels based on user's unit_system
    - Render zone panels in sort_order from custom_zones table
    - Reuse `_evaluateConditionalDisplay`, `_getUnitLabel`, `_getRangeHighlightClass`, `_renderIndicatorField` from `editor-health.js`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10_

  - [x] 7.2 Implement grid placement for custom zone panels
    - Render custom zone panels as single-column grid items (no `grid-column: span 2`) so CSS grid auto-placement alternates left/right
    - On mobile (≤768px), zones stack vertically via existing responsive CSS
    - _Requirements: 8.1, 8.2, 8.3_

  - [x] 7.3 Integrate custom zones with chit save flow
    - Expose `_gatherCustomZoneData()` function that collects UUID-keyed values from all custom zone fields
    - In `editor-save.js`, merge custom zone data with `window._healthData` into the final `health_data` payload on save
    - On chit load, populate custom zone fields from existing `health_data` values
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [x] 7.4 Add script tag for `editor-custom-zones.js` in `editor.html`
    - Load after `editor-health.js`, before `editor-init.js`
    - _Requirements: 7.1_

  - [x]* 7.5 Write property tests for health data round-trip (Property 8)
    - **Property 8: Health Data Round-Trip**
    - **Validates: Requirements 9.1, 9.2, 9.4**

  - [x]* 7.6 Write property tests for zone ordering (Property 2)
    - **Property 2: Zone Ordering**
    - **Validates: Requirements 1.4, 7.10, 12.3, 13.2**

  - [x]* 7.7 Write property tests for object grouping and ordering (Property 3)
    - **Property 3: Object Grouping and Ordering Within Zones**
    - **Validates: Requirements 3.1, 7.4**

  - [x]* 7.8 Write property tests for cascading zone deletion (Property 9)
    - **Property 9: Cascading Zone Deletion**
    - **Validates: Requirements 10.2, 10.4, 13.5**

  - [x]* 7.9 Write property tests for rename preserves zone_id (Property 10)
    - **Property 10: Rename Preserves Zone_id**
    - **Validates: Requirements 11.3**

- [x] 8. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- All frontend code is vanilla JS with no build step — loaded via `<script>` tags
- The backend follows the existing pattern: migrations.py for schema, routes/ for API, models.py for Pydantic validation
- Rendering functions from `editor-health.js` are reused directly (they are already global/window-scoped)
- No software installation required — all code uses existing dependencies
- Zone deletion preserves health_data on chits (Requirement 10.4) — data is never purged

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["1.4", "1.5", "3.1"] },
    { "id": 3, "tasks": ["3.2", "3.3", "3.4"] },
    { "id": 4, "tasks": ["4.1", "4.4"] },
    { "id": 5, "tasks": ["4.2", "4.3"] },
    { "id": 6, "tasks": ["5.1"] },
    { "id": 7, "tasks": ["5.2", "5.3", "5.4", "5.5", "7.1"] },
    { "id": 8, "tasks": ["7.2", "7.3", "7.4"] },
    { "id": 9, "tasks": ["7.5", "7.6", "7.7", "7.8", "7.9"] }
  ]
}
```
