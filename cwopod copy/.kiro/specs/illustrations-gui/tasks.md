# Implementation Plan: 
Illustrations GUI

## Overview

This plan implements the Illustrations wizard step for CWOPOD — a three-pool image management system (Shared, Available, In Book) with drag-and-drop placement, double-page spread preview, two-phase reflow (client-side instant + backend Typst authoritative), and lock-gated full reflow. Tasks are ordered by dependency: data model → service layer → API endpoints → frontend components → integration.

## Tasks

- [x] 1. Backend data model and database migration
  - [x] 1.1 Create the Illustration SQLAlchemy model
    - Create `backend/app/models/illustration.py` with the `Illustration` class
    - Include all columns from the design: id, project_id, user_id, image_uuid, label, pool (Enum: shared/available/in_book), source (Enum: extracted/uploaded), file_ext, original_width_px, original_height_px, placement_mode, page_number, position_x, position_y, height, layout, side, lock_state, sort_order
    - Use `Base`, `TimestampMixin`, `UserScopedMixin` from `app.models.base`
    - Add composite index on `(project_id, pool)` for pool queries
    - Add unique index on `image_uuid`
    - Register the model in `backend/app/models/__init__.py`
    - Add verbose logging for model instantiation at DEBUG level
    - _Requirements: 16.2, 16.5, 18.1_

  - [x] 1.2 Create Alembic migration for the illustrations table
    - Generate migration with `alembic revision --autogenerate`
    - Verify the migration creates the `illustrations` table with all columns, enums, and indexes
    - Ensure the migration is reversible (downgrade drops table and enums)
    - _Requirements: 18.1_

- [x] 2. Backend illustrations service layer
  - [x] 2.1 Create the illustrations service module structure
    - Create `backend/app/services/illustrations/__init__.py`
    - Create `backend/app/services/illustrations/service.py` with `IllustrationsService` class
    - Implement `get_all(project_id, user_id)` — returns all illustrations for a project plus user's shared pool
    - Implement `upload_image(project_id, user_id, file, pool)` — validates format, reads dimensions, stores file, creates DB record, returns DTO
    - Implement `update_illustration(image_uuid, user_id, updates)` — patches placement, label, lock_state, etc.
    - Implement `delete_illustration(image_uuid, user_id)` — removes DB record and file
    - Implement `save_all(project_id, user_id, illustrations)` — atomic bulk save of all pool/placement state
    - Add exhaustive logging on every method entry/exit with parameters and results
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.7, 16.1, 16.3, 16.4_

  - [x] 2.2 Implement pool management logic
    - Implement `copy_to_available(image_uuid, project_id, user_id)` — copies shared image to project's available pool (new row, copied file)
    - Implement `move_to_in_book(image_uuid, project_id, user_id)` — transitions image from available to in_book pool
    - Implement `return_to_available(image_uuid, project_id, user_id)` — moves image from in_book back to available, clears placement
    - Implement `auto_populate_available(project_id, user_id)` — scans project's `images/` directory for extracted images not yet in DB, creates records
    - Log all pool transitions with before/after state
    - _Requirements: 1.3, 2.5, 3.1, 3.6_

  - [x] 2.3 Implement lock cascade and reflow dispatch logic
    - Implement `lock_image(image_uuid, user_id)` — sets lock_state=True, dispatches full reflow task, returns task_id
    - Implement `unlock_image(image_uuid, user_id)` — cascade unlocks all images on pages > N, returns count of affected images
    - Implement `lock_all(project_id, user_id)` — locks all unlocked placed images, dispatches single reflow, returns task_id and count
    - Implement `should_trigger_reflow(old_state, new_state)` — returns True only when transitioning from unlocked to locked
    - Log lock state transitions and cascade operations with affected image counts
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

  - [x] 2.4 Implement DPI calculation and resolution warning logic
    - Create `backend/app/services/illustrations/dpi_calculator.py`
    - Implement `calculate_effective_dpi(original_width_px, original_height_px, display_width_inches, display_height_inches)` — returns effective DPI
    - Implement `has_resolution_warning(original_width_px, original_height_px, display_width_inches, display_height_inches)` — returns True if DPI < 300
    - Implement `compute_display_inches(height, placement_mode, page_width_inches, page_height_inches, aspect_ratio)` — converts height setting to physical inches
    - Log DPI calculations at DEBUG level
    - _Requirements: 4.3, 17.1, 17.2_

  - [x] 2.5 Write property tests for DPI calculation (Property 5)
    - **Property 5: DPI threshold warning**
    - **Validates: Requirements 4.3, 17.1, 17.2**
    - Use Hypothesis to generate random image dimensions and display sizes
    - Verify warning is active iff `min(width_px/display_w_in, height_px/display_h_in) < 300`

  - [x] 2.6 Write property tests for lock cascade logic (Property 9, Property 10)
    - **Property 9: Cascade unlock affects all images after page N**
    - **Property 10: Reflow triggers only on lock state transition**
    - **Validates: Requirements 12.1, 12.2, 12.6**
    - Generate random sets of locked images on various pages, verify cascade correctness
    - Verify no reflow dispatch for operations that don't change lock state from unlocked→locked

  - [x] 2.5a Implement typeset gate validation logic
    - Implement `validate_typeset_gate(project_id, user_id)` — returns `{allowed: bool, blocking_count: int}`
    - Gate blocks if any in_book image lacks placement OR lock_state
    - Gate allows if in_book pool is empty
    - Log gate evaluation result
    - _Requirements: 15.1, 15.2, 15.3, 15.4_

  - [x] 2.7 Write property test for typeset gate validation (Property 11)
    - **Property 11: Typeset gate validation**
    - **Validates: Requirements 15.1, 15.2, 15.3, 15.4**
    - Generate random image sets with mixed placement/lock states, verify gate logic

- [x] 3. Checkpoint — Backend service layer
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Backend Typst template renderer extension
  - [x] 4.1 Extend TemplateRenderer to emit illustration Typst markup
    - Modify `backend/app/services/typeset/template_renderer.py`
    - Add method `_render_illustrations(illustrations, storage_dir)` that generates Typst markup for all locked illustrations
    - For full_page: emit `#pagebreak()` + `#page[#image("images/{uuid}.{ext}", ...)]`
    - For plate: emit a new sheet (image page + blank page) with correct side
    - For inline: emit `#image(...)` at the correct position in text flow with configured height
    - All image paths must be relative to the project storage directory
    - Integrate illustration rendering into `render_full()` method
    - Add parameter for illustrations list to `render_full()` and `_render_body()`
    - Log each illustration emission at DEBUG level
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5_

  - [x] 4.2 Write property tests for Typst emission (Properties 15, 16, 17, 18)
    - **Property 15: Full-page Typst emission**
    - **Property 16: Plate Typst emission**
    - **Property 17: Inline Typst emission**
    - **Property 18: Typst image paths are relative**
    - **Validates: Requirements 19.1, 19.2, 19.3, 19.4, 19.5**
    - Generate random illustration configs, verify Typst output structure and relative paths

- [x] 5. Backend API endpoints — Illustrations router
  - [x] 5.1 Create the illustrations router with GET and upload endpoints
    - Create `backend/app/routers/illustrations.py`
    - Implement `GET /api/projects/{project_id}/illustrations` — returns all illustration data (pools, placements, locks, labels)
    - Implement `POST /api/projects/{project_id}/illustrations/upload` — accepts multipart image upload, validates format (PNG/JPG/WEBP), reads dimensions, returns UUID
    - Add auth dependency, project ownership validation
    - Register router in `backend/app/main.py` with `prefix="/api/projects"` and `tags=["illustrations"]`
    - Log all endpoint entry/exit with request params and response summaries
    - _Requirements: 18.1, 18.2, 16.1, 16.2, 16.3_

  - [x] 5.2 Implement PATCH, DELETE, save, and reflow endpoints
    - Implement `PATCH /api/projects/{project_id}/illustrations/{image_uuid}` — updates placement, position, size, lock_state, or label
    - Implement `DELETE /api/projects/{project_id}/illustrations/{image_uuid}` — removes image
    - Implement `POST /api/projects/{project_id}/illustrations/save` — atomic bulk save
    - Implement `POST /api/projects/{project_id}/illustrations/reflow` — triggers full reflow Celery task, returns task_id
    - Implement `POST /api/projects/{project_id}/illustrations/render-preview` — renders single spread via Typst for debounced preview
    - Log all operations with user_id, project_id, image_uuid
    - _Requirements: 18.3, 18.4, 18.5, 18.7, 13.3, 13.4_

  - [x] 5.3 Create the shared images router
    - Create `backend/app/routers/shared_images.py`
    - Implement `GET /api/user/shared-images` — returns all shared images for current user
    - Implement `POST /api/user/shared-images/upload` — upload image to shared pool
    - Implement `DELETE /api/user/shared-images/{image_uuid}` — remove from shared pool
    - Register router in `backend/app/main.py` with `prefix="/api/user"` and `tags=["shared-images"]`
    - Log all operations
    - _Requirements: 18.8, 18.9, 2.1, 2.3_

  - [x] 5.4 Implement reflow Celery task and status polling
    - Create `backend/app/services/illustrations/reflow_task.py`
    - Implement Celery task `illustrations.full_reflow` that re-typesets the entire book with locked illustrations
    - Report real progress stages: "loading_illustrations", "rendering_typst", "compiling_pdf", "updating_pages"
    - Implement `GET /api/tasks/{task_id}/status` endpoint (or extend existing) for polling reflow progress
    - Log task lifecycle: start, each stage, completion/failure
    - _Requirements: 18.5, 18.6, 12.4, 12.5, 13.2_

  - [x] 5.5 Write unit tests for illustrations API endpoints
    - Test upload: valid formats accepted, invalid rejected
    - Test PATCH: placement updates, label rename, lock state change
    - Test DELETE: image removed from DB and disk
    - Test save: atomic bulk operation
    - Test reflow: task dispatched on lock transition
    - _Requirements: 18.1–18.9_

- [x] 6. Checkpoint — Backend API complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Backend storage path and file management
  - [x] 7.1 Implement file storage utilities for illustrations
    - Create `backend/app/services/illustrations/storage.py`
    - Implement `get_project_image_path(storage_path, project_id, image_uuid, ext)` → `{storage_path}/{project_id}/images/{uuid}.{ext}`
    - Implement `get_shared_image_path(storage_path, user_id, image_uuid, ext)` → `{storage_path}/shared/{user_id}/images/{uuid}.{ext}`
    - Implement `ensure_image_directory(path)` — creates directory if not exists
    - Implement `copy_image_to_project(shared_path, project_path)` — copies file for shared→available transition
    - Log all file operations with full paths
    - _Requirements: 16.3, 16.4_

  - [x] 7.2 Write property tests for storage path construction (Property 12)
    - **Property 12: Storage path construction**
    - **Validates: Requirements 16.3, 16.4**
    - Generate random project_ids, user_ids, UUIDs, and extensions
    - Verify paths match expected format

- [x] 8. Frontend — Illustrations step module (main orchestrator)
  - [x] 8.1 Create the illustrations step page module
    - Create `frontend/js/pages/project-illustrations.js` with `render($container, params)` export
    - Implement two-column layout: left column (pools), right column (spread preview + toolbar)
    - Load illustration data via `GET /api/projects/{id}/illustrations`
    - Auto-populate available pool on first visit (call backend)
    - Wire up Save button that calls `POST /api/projects/{id}/illustrations/save`
    - Add Undo/Redo buttons (in-memory action stack, cleared on reload)
    - Log all user actions and state changes to console
    - _Requirements: 1.5, 14.1, 14.2, 14.3, 14.4, 14.5_

  - [x] 8.2 Integrate illustrations step into the project wizard
    - Modify `frontend/js/pages/project.js` to add "Illustrations" step between Typo Check and Typeset in the STEPS array
    - Mark step as optional in the step indicator
    - Add route handler that loads `project-illustrations.js` module
    - Implement typeset gate: block Typeset step if in_book images lack placement/lock, show count message
    - Allow skipping directly to Typeset if illustrations step not visited or in_book pool empty
    - Log step navigation and gate evaluation
    - _Requirements: 1.1, 1.2, 1.4, 15.1, 15.2, 15.3, 15.4_

- [x] 9. Frontend — Pool manager components
  - [x] 9.1 Implement the Shared Pool UI component
    - Render shared pool section with distinct background style
    - Display image thumbnails with labels beneath
    - Implement inline label rename (click-to-edit, saves on blur/enter)
    - Implement upload button accepting PNG/JPG/WEBP via `POST /api/user/shared-images/upload`
    - Show upload progress via XHR progress events
    - Log all pool interactions
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.6_

  - [x] 9.2 Implement the Available Pool UI component
    - Render available pool section with distinct background for extracted vs uploaded images
    - Display image thumbnails with labels beneath
    - Implement inline label rename
    - Implement upload button accepting PNG/JPG/WEBP via `POST /api/projects/{id}/illustrations/upload`
    - Show confirmation dialog before deleting extracted images
    - Log all pool interactions
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 9.3 Implement the In Book Pool UI component
    - Render in_book pool section with thumbnails showing: label, page number, placement mode badge, lock icon (🔒/🔓)
    - Display resolution warning icon (⚠️) when DPI < 300
    - Implement "Lock All" button with confirmation dialog showing count of unlocked images
    - Allow images without configured placement (pending state with warning border)
    - Log all state changes
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 12.3_

- [x] 10. Frontend — Spread preview and navigation
  - [x] 10.1 Implement the spread preview renderer
    - Create canvas-based double-page spread display in the right column
    - Render current spread showing text and all placed images
    - Highlight selected image with distinct visual indicator
    - Display bleed zone as grey overlay for full_page/plate modes with "Push to edges"
    - Log render operations and selected image changes
    - _Requirements: 5.1, 5.2, 5.3, 5.8_

  - [x] 10.2 Implement spread navigation controls
    - Add previous/next spread buttons (advance by 2 pages)
    - Add previous/next chapter buttons (jump to first spread of adjacent chapter)
    - Add page number input field (navigate to spread containing entered page)
    - Add chapter name/number input field (navigate to first spread of entered chapter)
    - Log all navigation events with source/destination pages
    - _Requirements: 5.4, 5.5, 5.6, 5.7_

  - [x] 10.3 Write property test for spread navigation arithmetic (Property 19)
    - **Property 19: Spread navigation arithmetic**
    - **Validates: Requirements 5.4**
    - Generate random page numbers and book lengths, verify next/prev spread logic

- [x] 11. Frontend — Toolbar controls
  - [x] 11.1 Implement the illustration toolbar
    - Add numeric height input (lines for inline, percentage for full_page/plate)
    - Real-time update on type/arrow keys with local reflow
    - Add Lock/Unlock button for selected image
    - Show spinner overlay during full reflow, disable editing controls
    - Add "Replace with..." button opening picker modal (shows Available + Shared pool images)
    - Add layout mode selector: "Stay in margins" / "Push to edges" (for full_page/plate)
    - Add left/right side selector (for plate mode)
    - Log all toolbar interactions
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 7.2, 8.3_

- [x] 12. Frontend — Drag and drop interactions
  - [x] 12.1 Implement drag-and-drop handler
    - Pool-to-spread: place image at drop position, auto-resize to fit margins, infer full_page mode on drop side
    - Pool-to-in_book (not spread): show warning border + "Click to configure placement" tooltip
    - Shared↔Available: copy (shared→available) or move semantics
    - On-spread repositioning: reposition image + local reflow
    - On-spread edge-drag: resize with aspect ratio locked + local reflow
    - Snap back to original position on invalid drop target
    - Log all drag start/end/drop events with source/target
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [x] 13. Frontend — Context menus
  - [x] 13.1 Implement context menus for image thumbnails
    - Unplaced images (Available/Shared): "Insert as Full Page (Left/Right)", "Insert as Plate (Left/Right)", "Insert Inline (Left/Right)", "Delete"
    - Placed images (In Book): "Move to page...", "Lock"/"Unlock", "Delete", "Remove from book"
    - "Move to page..." shows page number input dialog
    - "Delete" on extracted images shows confirmation dialog
    - Log all context menu selections
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

- [x] 14. Frontend — Local reflow engine
  - [x] 14.1 Implement client-side local reflow engine
    - Approximate text displacement for inline images on current spread
    - Calculate page displacement for full_page/plate insertions
    - Snap inline height to nearest line boundary (positive integer multiple of line height)
    - Compute inline width from aspect ratio: `height_in_points × (W / H)`
    - Trigger on place, move, resize operations — current spread only
    - Debounce 500ms then request authoritative backend Typst render
    - Replace client approximation with backend render when it arrives
    - Log reflow calculations at DEBUG level in console
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 13.1, 13.3, 13.4_

  - [x] 14.2 Write property tests for inline height snapping and width calculation (Properties 7, 8)
    - **Property 7: Inline height snaps to line boundary**
    - **Property 8: Inline width derived from aspect ratio**
    - **Validates: Requirements 9.3, 9.4**
    - Generate random float heights, verify snap to integer multiple of line height
    - Generate random aspect ratios and heights, verify width formula

  - [x] 14.3 Write property test for aspect ratio preservation (Property 6)
    - **Property 6: Aspect ratio preservation during scaling**
    - **Validates: Requirements 7.4, 7.7, 8.4, 10.5**
    - Generate random dimensions and scale factors, verify ratio invariant within epsilon

- [x] 15. Checkpoint — Frontend core complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 16. Frontend — Full page and plate placement modes
  - [x] 16.1 Implement full page placement mode behavior
    - "Stay in margins": center image within text area
    - "Push to edges": bleed to trim line, show grey overlay on bleed zone, show note about edges being cut
    - Allow scaling with aspect ratio locked
    - Allow dragging to reposition within page
    - Allow edge-drag resize with aspect ratio locked
    - Trigger local reflow on placement (text pushed to next page)
    - Log mode changes and layout option selections
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [x] 16.2 Implement plate placement mode behavior
    - Insert new sheet: image page + blank page
    - Left/right side selector determines image page position
    - Same layout options as full page ("Stay in margins" / "Push to edges")
    - Same scaling, repositioning, and edge-drag behavior as full page
    - Show bleed zone overlay when "Push to edges" selected
    - Log plate insertions with side selection
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 17. Frontend — Lock system and reflow integration
  - [x] 17.1 Implement lock/unlock UI flow with cascade and reflow polling
    - Lock button: call PATCH to set lock_state=true, show spinner, poll task status, refresh spread on complete
    - Unlock: show warning with count of images on later pages, on confirm cascade unlock via backend
    - "Lock All": show warning with count, on confirm lock all + single reflow + poll
    - During reflow: spinner overlay on spread, disable editing controls
    - On reflow complete: refresh spread with new page numbers
    - On reflow failure: show error, re-enable controls
    - Poll using real backend progress (percent, stage, status) — no fake progress
    - Log all lock/unlock operations and reflow lifecycle
    - _Requirements: 6.4, 6.5, 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

- [x] 18. Frontend — Settings page shared pool management
  - [x] 18.1 Add shared pool management section to Settings page
    - Add "Shared Images" section to `frontend/js/pages/settings.js`
    - Display shared pool thumbnails with labels
    - Implement upload and delete for shared images
    - Reuse shared images API endpoints
    - Log all settings page interactions
    - _Requirements: 2.4_

- [x] 19. Integration — Wire PDF generation with illustrations
  - [x] 19.1 Update PDF generation task to include locked illustrations
    - Modify `backend/app/services/typeset/pdf_generator.py` `_generate_pdf_async` to load locked illustrations from DB
    - Pass illustrations list to `TemplateRenderer.render_full()`
    - Ensure image files are accessible relative to the Typst source file
    - Log illustration count and details during PDF generation
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5_

- [x] 20. Integration — Resolution warning and AI upscale
  - [x] 20.1 Implement resolution warning recalculation on resize
    - Recalculate DPI on every height/size change in frontend
    - Update ⚠️ indicator on in_book pool thumbnails in real-time
    - Add "AI Upscale" option when warning is active (calls backend endpoint)
    - Backend upscale endpoint processes image and replaces stored file
    - Recalculate warning after upscale completes
    - Log DPI calculations and upscale operations
    - _Requirements: 17.1, 17.2, 17.3, 17.4_

- [x] 21. Final checkpoint — Full integration
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- All code must include exhaustive logging per project conventions
- No software installation — all dependencies are assumed already available
- Progress bars must use real backend progress data (no fake progress)
- Frontend uses vanilla JS + jQuery 3.7.1 (no frameworks)
- Backend uses Python FastAPI + SQLAlchemy async + Celery

## Fast-Follow

### Inset with Text Wrap (Future Enhancement)

**Not included in current implementation scope.**

The "Inset with text wrap" placement mode would allow images to float left or right within the text area, with prose flowing beside the image (similar to CSS `float: left/right` or magazine-style layouts). This is a significant addition because:

1. **Typst complexity**: Typst's current text-wrap-around-image support requires careful column/grid manipulation. The markup is non-trivial and may need Typst version upgrades.
2. **Local reflow complexity**: Client-side approximation of text wrapping beside an image is substantially harder than above/below flow, requiring line-by-line width calculations.
3. **Interaction design**: Users would need controls for wrap margin, minimum text width beside image, and behavior when text is too short to fill beside the image.

**Planned behavior:**
- New placement mode: "Inset" with sub-options "Float Left" and "Float Right"
- Image anchored to a paragraph position, text flows beside it
- Height in lines, width auto-calculated from aspect ratio (capped at 50% of text width)
- Configurable wrap margin (space between image edge and text)
- Falls back to inline behavior if remaining text width < minimum threshold

**Prerequisites before building:**
- Verify Typst `wrap` or `place` with `float` support is stable
- Design the local reflow algorithm for beside-text flow
- User research on whether this mode is needed for the target audience (literary fiction vs. technical/illustrated books)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["2.1", "2.4", "7.1"] },
    { "id": 3, "tasks": ["2.2", "2.3", "2.5a", "2.5", "7.2"] },
    { "id": 4, "tasks": ["2.6", "2.7", "4.1"] },
    { "id": 5, "tasks": ["4.2", "5.1", "5.3"] },
    { "id": 6, "tasks": ["5.2", "5.4"] },
    { "id": 7, "tasks": ["5.5"] },
    { "id": 8, "tasks": ["8.1", "8.2"] },
    { "id": 9, "tasks": ["9.1", "9.2", "9.3", "10.1"] },
    { "id": 10, "tasks": ["10.2", "10.3", "11.1"] },
    { "id": 11, "tasks": ["12.1", "13.1", "14.1"] },
    { "id": 12, "tasks": ["14.2", "14.3", "16.1", "16.2"] },
    { "id": 13, "tasks": ["17.1", "18.1"] },
    { "id": 14, "tasks": ["19.1", "20.1"] }
  ]
}
```
