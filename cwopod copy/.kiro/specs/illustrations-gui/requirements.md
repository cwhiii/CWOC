# Requirements Document

## Introduction

This feature adds an "Illustrations" wizard step to the CWOPOD project workflow, positioned between Typo Check and Typeset. It provides a GUI for managing, placing, and sizing images within a book's interior before typesetting. Users can organize images across three pools (Shared, Available, In Book), place them as full-page, plate, or inline illustrations, preview them on a double-page spread, and lock placements to trigger a full book reflow. The Typeset step is gated until all placed images are locked.

## Glossary

- **Illustrations_Step**: The wizard step in the Project_Wizard between Typo Check and Typeset that provides the image management and placement GUI
- **Shared_Pool**: A user-level image collection that persists across all book projects, manageable from the Illustrations step or the Settings page
- **Available_Pool**: A project-level collection of unplaced images, auto-populated from images extracted during source import (EPUB/upload)
- **In_Book_Pool**: The collection of images that have been inserted into the current book with a configured placement
- **Spread_Preview**: The right-column panel displaying a double-page spread of the book as currently rendered, with navigation and editing controls
- **Placement_Mode**: The method by which an image is inserted into the book: Full_Page, Plate, or Inline
- **Full_Page_Mode**: A placement mode where the image replaces text on an existing page, pushing displaced text to the next page
- **Plate_Mode**: A placement mode where a new sheet is inserted into the book with the image on one side and a blank page on the other
- **Inline_Mode**: A placement mode where the image is inserted at a position on the page with text flowing above and below
- **Lock_State**: A per-image boolean indicating whether the image's placement has been finalized; locking triggers a full book reflow
- **Local_Reflow**: An immediate client-side text reflow affecting only the current spread, providing instant visual feedback during placement and resizing
- **Full_Reflow**: A backend Celery task that re-typesets the entire book, recalculating all page numbers and chapter starts, triggered only when an image is locked
- **Bleed_Zone**: The area beyond the trim line where ink extends to ensure no white edges after cutting; shown as a grey overlay in the Spread_Preview
- **Trim_Line**: The boundary where the printed page will be cut; content beyond this line will be removed during finishing
- **Resolution_Warning**: A visual indicator (⚠️) displayed on an image thumbnail when the image would appear fuzzy at its current display size given the print DPI
- **Typeset_Gate**: The validation rule that blocks the Typeset step until all images in the In_Book_Pool have both a configured placement and a locked state
- **Image_UUID**: The internal unique identifier used to reference images throughout the system, independent of filename

## Requirements

### Requirement 1: Illustrations Wizard Step Integration

**User Story:** As a user, I want an Illustrations step in my project wizard between Typo Check and Typeset, so that I can manage images before generating the interior PDF.

#### Acceptance Criteria

1. THE Illustrations_Step SHALL appear in the Project_Wizard step indicator between Typo Check and Typeset, labeled "Illustrations" with the description "Place images"
2. THE Illustrations_Step SHALL be marked as optional in the step indicator
3. WHEN the user navigates to the Illustrations_Step for the first time on a project, THE Available_Pool SHALL be auto-populated with all images previously extracted during source import from the project's `images/` storage directory
4. WHEN the user has not visited the Illustrations_Step, THE Project_Wizard SHALL allow proceeding directly to the Typeset step
5. WHEN the Illustrations_Step is active, THE Frontend SHALL render a two-column layout with image pools in the left column and the Spread_Preview with toolbar in the right column

### Requirement 2: Shared Pool Management

**User Story:** As a user, I want a shared image pool that persists across all my books, so that I can reuse images like logos or decorative elements without re-uploading.

#### Acceptance Criteria

1. THE Shared_Pool SHALL persist at the user level across all book projects
2. THE Shared_Pool SHALL display image thumbnails with a visually distinct background style differentiating it from the Available_Pool
3. WHEN the user uploads an image to the Shared_Pool, THE System SHALL accept PNG, JPG, and WEBP file formats and store the image with a generated Image_UUID
4. THE Shared_Pool SHALL be accessible and manageable from both the Illustrations_Step and the Settings page
5. WHEN the user drags an image from the Shared_Pool to the Available_Pool, THE System SHALL copy the image reference into the project's Available_Pool while retaining the original in the Shared_Pool
6. THE Shared_Pool SHALL display a user-facing label beneath each thumbnail that the user can rename without affecting the stored filename

### Requirement 3: Available Pool Management

**User Story:** As a user, I want to see all unplaced images for my current book in one pool, so that I can choose which ones to insert.

#### Acceptance Criteria

1. THE Available_Pool SHALL display all project-level images that have not been placed into the book
2. THE Available_Pool SHALL display images extracted during import with a visually distinct background style differentiating them from user-uploaded images
3. WHEN the user attempts to delete an image that was extracted during import, THE System SHALL display a confirmation dialog before removing it
4. WHEN the user uploads an image to the Available_Pool, THE System SHALL accept PNG, JPG, and WEBP file formats and store the image with a generated Image_UUID in the project's storage directory
5. THE Available_Pool SHALL display a user-facing label beneath each thumbnail that the user can rename without affecting the stored filename
6. THE Available_Pool SHALL impose no limit on the number of images it contains

### Requirement 4: In Book Pool Display

**User Story:** As a user, I want to see all placed images with their placement details at a glance, so that I can track what's in my book.

#### Acceptance Criteria

1. THE In_Book_Pool SHALL display each placed image as a thumbnail with the following information: user-facing label, page number, Placement_Mode indicator (Full Page, Plate, or Inline), and Lock_State icon
2. THE In_Book_Pool SHALL display the Lock_State icon (🔒 for locked, 🔓 for unlocked) in the top-right corner of each thumbnail
3. WHEN an image would appear fuzzy at its current display size for print DPI, THE In_Book_Pool SHALL display a Resolution_Warning icon (⚠️) in the bottom-left corner of that image's thumbnail
4. THE In_Book_Pool SHALL allow images to be saved without a configured placement, storing them in a pending state
5. THE In_Book_Pool SHALL provide a "Lock All" button that locks all unlocked images simultaneously

### Requirement 5: Spread Preview and Navigation

**User Story:** As a user, I want to see a double-page spread of my book with navigation controls, so that I can preview how images look in context.

#### Acceptance Criteria

1. THE Spread_Preview SHALL display a double-page spread showing the book as currently rendered, including all text and images on the visible pages
2. THE Spread_Preview SHALL highlight the currently selected image on the spread with a distinct visual indicator
3. THE Spread_Preview SHALL display ALL images present on the current spread, not only the selected one
4. THE Spread_Preview SHALL provide previous/next page navigation buttons that advance by one spread (two pages) at a time
5. THE Spread_Preview SHALL provide previous/next chapter navigation buttons that jump to the first spread of the adjacent chapter
6. THE Spread_Preview SHALL provide a page number input field that navigates to the spread containing the entered page number when the value is submitted
7. THE Spread_Preview SHALL provide a chapter name/number input field that navigates to the first spread of the entered chapter when the value is submitted
8. WHEN an image is placed in Full_Page_Mode or Plate_Mode, THE Spread_Preview SHALL display the Bleed_Zone as a grey overlay indicating content that will be cut off after printing

### Requirement 6: Image Height Control and Locking

**User Story:** As a user, I want to set an image's height numerically and lock it in place, so that I have precise control over sizing and can finalize my layout.

#### Acceptance Criteria

1. THE Spread_Preview toolbar SHALL provide a numeric height input field (in lines for Inline_Mode, in percentage of page height for Full_Page_Mode and Plate_Mode) that updates the selected image's height
2. WHEN the user types a number or uses up/down arrow keys in the height input, THE Spread_Preview SHALL update the image size in real-time using Local_Reflow
3. THE Spread_Preview toolbar SHALL provide a Lock button for the currently selected image
4. WHEN the Lock button is clicked, THE System SHALL trigger a Full_Reflow via a Celery background task and display a spinner until the reflow completes
5. WHEN the Full_Reflow completes, THE Spread_Preview SHALL refresh to show the updated page layout with recalculated page numbers
6. THE Spread_Preview toolbar SHALL provide a "Replace with..." button that opens a picker showing images from the Available_Pool and Shared_Pool
7. WHEN an image is replaced via "Replace with...", THE System SHALL retain the original image's position, size, and Lock_State, substituting only the image content

### Requirement 7: Full Page Placement Mode

**User Story:** As a user, I want to place an image as a full-page illustration that replaces text on that page, so that I can create dramatic visual breaks in my book.

#### Acceptance Criteria

1. WHEN an image is placed in Full_Page_Mode, THE System SHALL remove text from that page and push the displaced text to the next page
2. THE Full_Page_Mode SHALL provide two layout options: "Stay in margins" (image centered within the text area) and "Push to edges" (image bleeds to the trim line)
3. WHEN "Push to edges" is selected, THE System SHALL display a note to the user indicating that edges will be cut off during printing
4. THE Full_Page_Mode SHALL allow scaling the image while maintaining its aspect ratio locked
5. WHEN the image is scaled beyond the margin boundaries, THE Spread_Preview SHALL display a grey overlay on the portions that extend into the Bleed_Zone
6. THE Full_Page_Mode SHALL allow dragging the image to reposition it within the page
7. THE Full_Page_Mode SHALL allow edge-dragging to resize the image with the aspect ratio locked

### Requirement 8: Plate Placement Mode

**User Story:** As a user, I want to insert an image as a plate on a brand new sheet, so that I can add illustrations without displacing existing text.

#### Acceptance Criteria

1. WHEN an image is placed in Plate_Mode, THE System SHALL insert a new sheet into the book consisting of one image page and one blank page
2. THE Plate_Mode SHALL allow the user to choose whether the image appears on the left or right side of the inserted sheet
3. THE Plate_Mode SHALL provide the same two layout options as Full_Page_Mode: "Stay in margins" and "Push to edges"
4. THE Plate_Mode SHALL allow scaling, repositioning, and edge-drag resizing with the same behavior as Full_Page_Mode
5. WHEN "Push to edges" is selected in Plate_Mode, THE Spread_Preview SHALL display the same grey overlay and user note as in Full_Page_Mode

### Requirement 9: Inline Placement Mode

**User Story:** As a user, I want to insert an image inline within the text flow, so that I can place smaller illustrations alongside my prose.

#### Acceptance Criteria

1. WHEN an image is placed in Inline_Mode, THE System SHALL insert the image at the specified position on the page with text flowing above and below
2. THE Inline_Mode SHALL default to a height of 8 text lines
3. THE Inline_Mode SHALL determine the image width automatically based on the image's aspect ratio and the specified height
4. WHEN the user adjusts the height of an inline image, THE System SHALL snap the height to the nearest line boundary
5. THE Inline_Mode SHALL allow repositioning the image by dragging it to a new location on the spread
6. WHEN an inline image is moved or resized, THE System SHALL perform a Local_Reflow on the current spread to show updated text flow immediately

### Requirement 10: Drag and Drop Interactions

**User Story:** As a user, I want to drag images between pools and onto the spread, so that placing illustrations feels natural and direct.

#### Acceptance Criteria

1. WHEN the user drags an image from the Available_Pool or Shared_Pool onto the Spread_Preview, THE System SHALL place the image with its top-left corner at the drop position, auto-resize it to not overflow the margins, and infer Full_Page_Mode on the side of the spread where it was dropped
2. WHEN the user drags an image from the Available_Pool directly into the In_Book_Pool (not onto the spread), THE System SHALL display a warning border and tooltip reading "Click to configure placement" on the dropped image
3. WHEN the user drags an image between the Shared_Pool and Available_Pool in either direction, THE System SHALL move or copy the image reference accordingly
4. WHEN the user drags a placed image on the Spread_Preview, THE System SHALL reposition the image and perform a Local_Reflow on the current spread
5. WHEN the user edge-drags a placed image on the Spread_Preview, THE System SHALL resize the image with the aspect ratio locked and perform a Local_Reflow on the current spread

### Requirement 11: Context Menu Interactions

**User Story:** As a user, I want right-click context menus on image thumbnails, so that I can quickly access placement and management actions.

#### Acceptance Criteria

1. WHEN the user clicks an unplaced image thumbnail in the Available_Pool or Shared_Pool, THE System SHALL display a context menu with options: "Insert as Full Page (Left)", "Insert as Full Page (Right)", "Insert as Plate (Left)", "Insert as Plate (Right)", "Insert Inline (Left)", "Insert Inline (Right)", and "Delete"
2. WHEN the user clicks a placed image thumbnail in the In_Book_Pool, THE System SHALL display a context menu with options: "Move to page...", "Lock" or "Unlock" (based on current state), "Delete" (remove from book and project), and "Remove from book" (return to Available_Pool)
3. WHEN "Move to page..." is selected, THE System SHALL display a page number input and move the image to the specified page upon confirmation
4. WHEN "Delete" is selected for an image extracted during import, THE System SHALL display a confirmation dialog before permanently removing it

### Requirement 12: Lock System and Cascade Behavior

**User Story:** As a user, I want a lock system that finalizes image placements and triggers a full reflow, so that my page numbers are accurate before typesetting.

#### Acceptance Criteria

1. WHEN the user unlocks an image on page N, THE System SHALL display a warning: "This will unlock X images on later pages. Proceed/Cancel?" where X is the count of locked images on pages after N
2. WHEN the user confirms the unlock warning, THE System SHALL unlock the specified image and all locked images on pages after page N
3. WHEN the "Lock All" button in the In_Book_Pool is clicked, THE System SHALL display a warning: "You have X images you haven't manually locked. This will lock them all and trigger a full reflow. Proceed/Cancel?" where X is the count of currently unlocked placed images
4. WHEN the user confirms "Lock All", THE System SHALL lock all unlocked placed images and trigger a single Full_Reflow via a Celery background task
5. WHILE a Full_Reflow is in progress, THE System SHALL display a spinner overlay on the Spread_Preview and disable placement editing controls
6. THE System SHALL trigger a Full_Reflow ONLY when one or more images transition from unlocked to locked state

### Requirement 13: Two-Phase Reflow System

**User Story:** As a user, I want instant visual feedback when placing images and accurate page numbers when I lock them, so that the workflow feels responsive without sacrificing correctness.

#### Acceptance Criteria

1. WHEN the user places, moves, or resizes an image on the Spread_Preview, THE System SHALL perform a Local_Reflow that reflows text on the current spread only, providing immediate client-side visual feedback
2. WHEN the user locks an image, THE System SHALL trigger a Full_Reflow that re-typesets the entire book via a Celery background task, recalculating all page numbers and chapter starts
3. THE System SHALL use a hybrid rendering approach: client-side instant feedback during drag and resize operations, followed by a backend Typst render confirmation after a 500ms debounce period
4. WHEN the backend Typst render confirmation completes, THE Spread_Preview SHALL update to reflect the authoritative rendered result

### Requirement 14: Save, Undo, and Redo

**User Story:** As a user, I want to save my work and undo/redo placement actions, so that I can experiment freely without losing progress.

#### Acceptance Criteria

1. THE Illustrations_Step SHALL provide a Save button that persists the current state of all three pools and all placement configurations to the backend
2. THE Save button SHALL allow saving images in the In_Book_Pool that do not yet have a configured placement
3. THE Illustrations_Step SHALL provide Undo and Redo buttons that reverse or replay placement, move, rename, and resize actions
4. THE Undo/Redo history SHALL be stored in-memory only and scoped to the current browser session
5. THE Undo/Redo history SHALL NOT persist across page reloads or session changes
6. WHEN the user performs an Undo action, THE Spread_Preview SHALL update to reflect the previous state including any Local_Reflow changes

### Requirement 15: Typeset Gate Validation

**User Story:** As a user, I want to be prevented from typesetting until all placed images are properly configured and locked, so that the final PDF is accurate.

#### Acceptance Criteria

1. IF any images exist in the In_Book_Pool without both a configured placement AND a locked state, THEN THE Project_Wizard SHALL block navigation to the Typeset step
2. WHEN the Typeset step is blocked, THE Project_Wizard SHALL display a message: "X illustrations need placement/locking before typesetting" where X is the count of non-compliant images
3. WHEN all images in the In_Book_Pool have a configured placement and are locked, THE Project_Wizard SHALL allow navigation to the Typeset step
4. IF the In_Book_Pool is empty (no images placed), THE Project_Wizard SHALL allow navigation to the Typeset step without restriction

### Requirement 16: Image Upload and Storage

**User Story:** As a user, I want to upload images in common formats and have them tracked by UUID, so that renaming display labels never breaks internal references.

#### Acceptance Criteria

1. THE System SHALL accept image uploads in PNG, JPG, and WEBP formats
2. THE System SHALL assign a unique Image_UUID to each uploaded image and use this UUID for all internal references
3. THE System SHALL store uploaded project images at `{storage_path}/{project_id}/images/{uuid}.{ext}`
4. THE System SHALL store shared pool images at `{storage_path}/shared/{user_id}/images/{uuid}.{ext}`
5. WHEN the user renames an image's display label, THE System SHALL update only the user-facing label metadata without modifying the stored filename or Image_UUID
6. THE System SHALL impose no limit on the number of images per project or in the Shared_Pool

### Requirement 17: Resolution Warning System

**User Story:** As a user, I want to be warned when an image would look fuzzy at its current size in print, so that I can upscale or resize before finalizing.

#### Acceptance Criteria

1. WHEN an image's effective print resolution at its current display size falls below 300 DPI, THE System SHALL display a Resolution_Warning icon (⚠️) on the image's thumbnail in the In_Book_Pool
2. WHEN the user resizes an image, THE System SHALL recalculate the effective print resolution and update the Resolution_Warning indicator accordingly
3. WHEN a Resolution_Warning is active on an image, THE System SHALL provide an "AI Upscale" option that processes the image to increase its resolution
4. WHEN the AI Upscale completes successfully, THE System SHALL replace the stored image with the upscaled version and recalculate the Resolution_Warning

### Requirement 18: Backend API for Illustrations

**User Story:** As a developer, I want REST API endpoints for illustration management, so that the frontend can persist and retrieve image placement data.

#### Acceptance Criteria

1. THE Backend SHALL provide `GET /api/projects/{id}/illustrations` that returns all image placement data for a project including pool membership, placement configuration, Lock_State, and display labels
2. THE Backend SHALL provide `POST /api/projects/{id}/illustrations/upload` that accepts multipart image uploads and returns the assigned Image_UUID
3. THE Backend SHALL provide `PATCH /api/projects/{id}/illustrations/{image_uuid}` that updates placement configuration, position, size, Lock_State, or display label for a single image
4. THE Backend SHALL provide `DELETE /api/projects/{id}/illustrations/{image_uuid}` that removes an image from the project
5. THE Backend SHALL provide `POST /api/projects/{id}/illustrations/reflow` that triggers a Full_Reflow Celery task and returns a task_id for status polling
6. THE Backend SHALL provide `GET /api/tasks/{task_id}/status` that returns the current progress of a reflow task including percent complete and stage label
7. THE Backend SHALL provide `POST /api/projects/{id}/illustrations/save` that persists the complete current state of all pools and placements in a single atomic operation
8. THE Backend SHALL provide `GET /api/user/shared-images` and `POST /api/user/shared-images/upload` for managing the Shared_Pool at the user level
9. THE Backend SHALL provide `DELETE /api/user/shared-images/{image_uuid}` for removing images from the Shared_Pool

### Requirement 19: Typst Integration for Illustrations

**User Story:** As a developer, I want the Typst template renderer to incorporate placed and locked illustrations, so that the final PDF includes all images at their specified positions and sizes.

#### Acceptance Criteria

1. WHEN the Typeset step generates the interior PDF, THE Template_Renderer SHALL include all locked illustrations from the In_Book_Pool at their configured positions and sizes in the Typst source
2. FOR each Full_Page_Mode image, THE Template_Renderer SHALL emit a Typst page containing only the image, displacing text to the following page
3. FOR each Plate_Mode image, THE Template_Renderer SHALL emit a new sheet with the image on the specified side (left or right) and a blank page on the opposite side
4. FOR each Inline_Mode image, THE Template_Renderer SHALL emit the image at the specified position with the configured height, allowing Typst to flow text above and below
5. THE Template_Renderer SHALL reference images by their file path relative to the project storage directory

### Requirement 20: Fast-Follow Tracking (Not Building Now)

**User Story:** As a developer, I want planned future enhancements documented, so that they can be prioritized and built later.

#### Acceptance Criteria

1. THE task list SHALL include a "Fast-Follow" section documenting the planned "Inset with text wrap" feature (float left/right with text flowing beside the image) as a future enhancement not included in the current implementation scope
