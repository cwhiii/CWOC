# Implementation Plan: Type Rename and Grouping

## Overview

Add a rename-type endpoint and modal to the Custom Objects Editor, then implement collapsible type-group headers in both the chit editor's Indicators Zone and the dashboard's Indicators view (charts, log, calendar modes). All styling follows the existing parchment theme.

## Tasks

- [ ] 1. Backend: Rename Type Endpoint
  - [ ] 1.1 Add RenameTypeRequest model to models.py
    - Add Pydantic model with `old_type: str` and `new_type: str` fields
    - _Requirements: 2.1_
  - [ ] 1.2 Add PUT /api/custom-objects/rename-type endpoint to routes
    - Add the endpoint to the appropriate routes file (likely `routes/health.py` or a new custom objects route file, matching existing patterns)
    - Validate non-empty old_type/new_type (return 422 if invalid)
    - If old_type == new_type, return `{"updated_count": 0}` without DB write
    - Execute UPDATE on custom_objects table scoped to owner_id
    - Return `{"updated_count": N}`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 1.4, 1.8_

- [ ] 2. Custom Objects Editor: Rename Icon and Modal
  - [ ] 2.1 Add rename icon button to type group header in custom-objects-editor.js
    - Insert a `<button class="co-type-rename-btn">` with Font Awesome pen-to-square icon inside the existing `co-type-group-header` element
    - _Requirements: 1.1_
  - [ ] 2.2 Implement rename modal (_coOpenRenameModal, _coCloseRenameModal, _coSubmitRename)
    - Build modal following existing parchment modal pattern (no browser prompts)
    - Pre-populate input with current type name
    - Validate non-empty on submit (inline error if empty)
    - Close on Cancel or ESC (ESC must not propagate)
    - On confirm: PUT to rename-type endpoint, refresh list on success, show toast
    - _Requirements: 1.2, 1.3, 1.5, 1.6, 1.7_
  - [ ] 2.3 Add CSS for .co-type-rename-btn
    - Add rename button styles to the Custom Objects Editor CSS section
    - _Requirements: 1.1_

- [ ] 3. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Chit Editor: Indicators Zone Type Grouping
  - [ ] 4.1 Add _groupByType helper function to editor-health.js
    - Pure function that groups objects by `type` field, preserving relative order
    - Objects with no type default to "Other"
    - _Requirements: 3.1_
  - [ ] 4.2 Refactor _loadHealthData to render type group headers and collapsible bodies
    - After sorting by zone_sort_order, call _groupByType
    - For each group: render collapsible header + body wrapper
    - Skip group entirely if all indicators hidden by conditional display
    - All groups expanded by default, click header to toggle
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  - [ ] 4.3 Add indicator type group CSS to editor.css
    - Add `.indicator-type-group-header`, `.indicator-type-group-body`, `.indicator-type-caret` styles
    - Parchment theme: brown tones, Lora font, touch-friendly min-height
    - `.collapsed` class hides body via `display: none`
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [ ] 5. Dashboard: Indicators View Type Grouping
  - [ ] 5.1 Add _indRenderTypeGroupHeader helper and _groupByType to main-views-indicators.js
    - Shared header rendering function for all three modes
    - Reuse same grouping logic pattern as editor-health.js
    - _Requirements: 4.1, 4.2, 4.3_
  - [ ] 5.2 Add type grouping to charts mode
    - Group charts by source indicator's type field
    - Render collapsible type group header before each group
    - Wrap each group's charts in a `.ind-type-group-body` div
    - _Requirements: 4.1, 4.4, 4.5, 4.6_
  - [ ] 5.3 Add type grouping to log mode
    - Group log entries by indicator type
    - Render collapsible type group header before each group
    - _Requirements: 4.2, 4.4, 4.5, 4.6_
  - [ ] 5.4 Add type grouping to calendar mode
    - Group calendar displays by indicator type
    - Render collapsible type group header before each group
    - _Requirements: 4.3, 4.4, 4.5, 4.6_
  - [ ] 5.5 Add dashboard indicator type group CSS
    - Add `.ind-type-group-header`, `.ind-type-group-body`, `.ind-type-caret` styles to dashboard CSS
    - Parchment theme consistent with editor styles, touch-friendly
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [ ] 6. Final Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [ ]* 7. Optional: Property-Based Tests
  - [ ]* 7.1 Write property test for rename endpoint correctness
    - **Property 1: Rename updates all matching objects and returns correct count**
    - **Validates: Requirements 1.4, 2.2, 2.3**
  - [ ]* 7.2 Write property test for rename validation
    - **Property 2: Rename validation rejects invalid input**
    - **Validates: Requirements 2.4**
  - [ ]* 7.3 Write property test for _groupByType correctness
    - **Property 3: Grouping by type produces correct partitions**
    - **Validates: Requirements 3.1, 4.1, 4.2, 4.3, 5.1**
  - [ ]* 7.4 Write property test for empty group hiding
    - **Property 4: Empty type groups are hidden when all indicators filtered**
    - **Validates: Requirements 3.5**

## Notes

- Tasks marked with `*` are optional and can be skipped
- No installs required — all code is vanilla JS/Python using existing dependencies
- The rename modal must follow the existing parchment modal pattern (no browser prompts/alerts)
- ESC in the modal must close it without propagating to page-level handlers
- All type group headers start expanded; state is not persisted between page loads
- CSS uses existing parchment theme variables (brown tones, Lora font, appropriate contrast)
- Update src/INDEX.md and src/VERSION at the end of implementation

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "4.1", "5.1"] },
    { "id": 1, "tasks": ["1.2", "4.2", "4.3", "5.5"] },
    { "id": 2, "tasks": ["2.1", "5.2", "5.3", "5.4"] },
    { "id": 3, "tasks": ["2.2", "2.3"] },
    { "id": 4, "tasks": ["7.1", "7.2", "7.3", "7.4"] }
  ]
}
```
