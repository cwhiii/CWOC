# Implementation Plan: Cover Service Module

## Overview

This plan covers the implementation of the Cover Service module, which provides AI-powered cover art generation, an interactive Fabric.js cover builder, back cover synopsis generation, and print-ready PDF assembly with CMYK color space and proper bleed margins. The module integrates with the AI Engine for text analysis and image generation, and uses PyCairo for PDF production.

Technology: Python/FastAPI backend (PyCairo, python-qrcode, Pillow), SvelteKit frontend (Fabric.js), AI Engine integration via AIRouter.

## Tasks

- [x] 1. Implement PromptGenerator (text analysis + prompt creation)
  - [x] 1.1 Create PromptGenerator service class
    - Create `backend/app/services/cover/__init__.py`
    - Create `backend/app/services/cover/prompt_generator.py` with `PromptGenerator` class
    - Implement `generate_prompts(book_text, title, author) -> list[str]` method
    - Build system prompt enforcing spoiler-free, visual-only, exactly-10-prompts constraints
    - Extract representative text excerpt (first 10,000 tokens) from book text for context window management
    - Parse AI response to extract numbered prompts (handle malformed responses gracefully)
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 1.2 Add timeout handling and error reporting for prompt generation
    - Enforce 120-second timeout via AI Engine's image generation timeout
    - Catch AIProviderError and wrap in CoverServiceError with user-friendly message
    - Handle partial results (fewer than 10 prompts) by returning available prompts with warning
    - Create `backend/app/services/cover/exceptions.py` with CoverServiceError, RegenerationLimitError, CoverValidationError
    - _Requirements: 1.4, 1.5_

- [x] 2. Implement ImageGenerator (AI Engine integration)
  - [x] 2.1 Create ImageGenerator service class
    - Create `backend/app/services/cover/image_generator.py` with `ImageGenerator` class
    - Implement `generate_images(prompts, project_id) -> list[GeneratedImage]` that calls AI Engine's `generate_image()` for each prompt at 1600×2400px
    - Store generated images to project storage path (PNG format)
    - Create CoverPrompt records in database linking prompts to generated image paths
    - _Requirements: 2.1, 2.2_

  - [x] 2.2 Implement image regeneration with session tracking
    - Implement `regenerate_image(prompt_id, new_prompt_text, session) -> GeneratedImage`
    - Load or create CoverSession for the project, increment regeneration_count
    - Reject regeneration if count >= 20 with RegenerationLimitError
    - Update CoverPrompt record with new prompt text and new image path
    - Return regeneration count and remaining in response
    - _Requirements: 2.3, 2.4, 2.5, 2.6_

  - [x] 2.3 Implement user image upload validation
    - Implement `validate_upload(file_data, filename) -> UploadValidation`
    - Check format: accept only PNG (.png) and JPEG (.jpg, .jpeg) via magic bytes and extension
    - Check file size: reject if > 25 MB
    - Check resolution: use Pillow to read dimensions, reject if < 1600×2400px
    - Return specific error messages for each failed validation criterion
    - On success, store image and return path with metadata
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 3. Implement BlurbGenerator (synopsis generation)
  - [x] 3.1 Create BlurbGenerator service class
    - Create `backend/app/services/cover/blurb_generator.py` with `BlurbGenerator` class
    - Implement `generate_blurb(book_text, title, author) -> str`
    - Build system prompt enforcing spoiler-free, 100-250 word, compelling synopsis constraints
    - Extract representative text excerpt for context
    - Validate generated blurb word count (100-250 words); if outside range, retry once or return with warning
    - _Requirements: 7.1, 7.2_

  - [x] 3.2 Add blurb editing validation and error handling
    - Implement `validate_blurb_length(text) -> bool` enforcing 500-word maximum for user-edited content
    - Handle 30-second timeout from AI Engine text generation
    - On failure, return error with can_retry=true and option for manual entry
    - _Requirements: 7.3, 7.4, 7.5_

- [x] 4. Create cover template data model and 5 default templates
  - [x] 4.1 Define CoverTemplate schema and template storage
    - Create `backend/app/services/cover/templates.py`
    - Define CoverTemplate Pydantic model with: id, name, description, thumbnail path, title_position, title_style, author_position, author_style, spine_style
    - Define TextEffects model with shadow (color, offset_x, offset_y, blur), outline (color, width), opacity
    - _Requirements: 4.3_

  - [x] 4.2 Create 5 default cover templates
    - Implement "Classic" template: centered title top (y=0.15), author bottom (y=0.85), Garamond serif, white text with shadow
    - Implement "Modern" template: left-aligned title center (y=0.5), author bottom-left, sans-serif (Helvetica), subtle shadow
    - Implement "Bold" template: large centered title (96pt) with black outline, author small at bottom
    - Implement "Elegant" template: right-aligned title upper-third, author lower-third, italic serif (Palatino), opacity overlay
    - Implement "Minimal" template: small title bottom-left (24pt), author below title, clean sans-serif (Inter), high contrast
    - Create template thumbnail images for the frontend selector
    - _Requirements: 4.3, 4.4_

  - [x] 4.3 Add CoverSession model to database
    - Create `CoverSession` SQLAlchemy model in `backend/app/models/cover.py` with: id, project_id, regeneration_count (default 0), max_regenerations (default 20), is_active (default True)
    - Create Alembic migration for the cover_sessions table
    - _Requirements: 2.4, 2.5_

- [x] 5. Implement CoverAssembler backend (PyCairo CMYK PDF)
  - [x] 5.1 Create CoverAssembler service class with PDF generation
    - Create `backend/app/services/cover/assembler.py` with `CoverAssembler` class
    - Implement PyCairo PDF surface creation at calculated dimensions (front + spine + back + bleed)
    - Implement RGB to CMYK color conversion using ICC profile (sRGB → FOGRA39 or similar)
    - Implement front cover rendering: place image scaled to panel size, overlay title and author text with configured styles
    - Implement spine rendering: rotated title and author text within spine width
    - Implement back cover rendering: synopsis text, QR code, link in top-to-bottom order
    - Set PDF resolution to 300 DPI minimum
    - Apply 3mm bleed extension on all edges
    - _Requirements: 5.1, 5.2, 5.3, 5.5, 8.4_

  - [x] 5.2 Implement layout validation before assembly
    - Implement `_validate_layout(layout) -> list[str]` checking for: front_cover image, title text, author text
    - Return all missing elements (not just first found)
    - Implement `_validate_image_resolution(image_path) -> bool` checking 300 DPI at target print size
    - Raise CoverValidationError with missing elements list if validation fails
    - Warn (but allow with confirmation) if image is below 300 DPI
    - _Requirements: 5.6, 5.7_

  - [x] 5.3 Implement QR code generation for back cover
    - Use python-qrcode library to generate QR code encoding the C.W.'s O-POD application URL
    - Render QR code at minimum 2cm×2cm (approximately 227×227 pixels at 300 DPI)
    - Position QR code in the back cover panel below synopsis, above link text
    - Include printed URL text below QR code
    - _Requirements: 8.1, 8.2, 8.3_

- [x] 6. Implement spine width calculation
  - [x] 6.1 Create spine width calculation utility
    - Implement `calculate_spine_width(page_count, paper_stock) -> float` in CoverAssembler
    - Define paper thickness constants: standard_white=0.1mm, cream=0.11mm, premium_white=0.12mm, heavy=0.14mm
    - Define cover board thickness constant: 0.6mm (both sides combined)
    - Formula: spine_width_mm = (page_count × paper_thickness) + cover_board_thickness
    - Validate page_count > 0, return minimum spine width for very thin books
    - Expose spine width calculation via API for frontend preview use
    - _Requirements: 5.4, 6.2_

- [x] 7. Build CoverBuilder frontend (Fabric.js canvas, drag-and-drop, text overlays)
  - [x] 7.1 Create CoverBuilder Svelte component with Fabric.js canvas
    - Create `frontend/src/routes/projects/[id]/cover/+page.svelte`
    - Initialize Fabric.js canvas at print-proportional dimensions (scaled for screen)
    - Implement three-panel layout: back cover (left), spine (center), front cover (right)
    - Calculate panel widths from page count and paper stock (fetch spine width from API)
    - Add canvas background showing panel boundaries and bleed guides
    - _Requirements: 4.1, 6.1, 6.3_

  - [x] 7.2 Implement template selector and text overlay system
    - Create template selector UI showing 5 template thumbnails with names
    - On template selection, apply default title and author positions/styles to canvas
    - Implement title text as Fabric.js IText object (editable, draggable)
    - Implement author text as Fabric.js IText object (editable, draggable)
    - Enforce character limits: title ≤ 100 chars, author ≤ 60 chars (prevent input beyond limit, show counter)
    - _Requirements: 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

  - [x] 7.3 Implement text customization controls
    - Create sidebar panel with text property controls
    - Implement font selector (dropdown with available fonts)
    - Implement font size slider/input (8pt to 200pt range)
    - Implement color picker for text color
    - Implement drop shadow toggle with color, offset, and blur controls
    - Implement outline toggle with color and width controls
    - Implement opacity slider (0-100%)
    - Apply changes to selected text object in real-time on canvas
    - _Requirements: 4.5_

  - [x] 7.4 Implement image placement and drag-and-drop
    - Implement image selection from generated/uploaded images (thumbnail gallery)
    - On image selection, place as Fabric.js Image object on front cover panel
    - Support drag to reposition, scale handles to resize
    - Validate image resolution on placement (warn if < 300 DPI at print size)
    - Support drag-and-drop file upload directly onto canvas (validate format/size/resolution)
    - _Requirements: 4.1, 4.2, 5.7_

  - [x] 7.5 Implement cover preview mode
    - Create preview toggle that shows the assembled cover as it will appear in print
    - Display front cover, spine, and back cover in a continuous spread view
    - Show spine width label with calculated measurement
    - Update preview in real-time as user makes changes
    - Show back cover with synopsis text, QR code placeholder, and link
    - _Requirements: 6.1, 6.2, 6.3_

- [x] 8. Create cover API endpoints (prompts, images, blurb, upload, assemble)
  - [x] 8.1 Create cover router with prompt and image generation endpoints
    - Create `backend/app/routers/cover.py` with FastAPI router
    - Implement POST `/api/projects/{project_id}/cover/generate-prompts`: load book text from project, call PromptGenerator, store CoverPrompt records, return prompts with IDs
    - Implement POST `/api/projects/{project_id}/cover/generate-images`: accept prompt_ids, call ImageGenerator for each, return image URLs with metadata
    - Implement POST `/api/projects/{project_id}/cover/regenerate-image`: accept prompt_id + new_prompt_text, call ImageGenerator.regenerate_image, return new image + regeneration count
    - Require authentication and verify project ownership
    - _Requirements: 1.1, 2.1, 2.3, 2.4_

  - [x] 8.2 Create blurb generation and upload endpoints
    - Implement POST `/api/projects/{project_id}/cover/generate-blurb`: load book text, call BlurbGenerator, return blurb with word count
    - Implement POST `/api/projects/{project_id}/cover/upload-image`: accept multipart file upload, call ImageGenerator.validate_upload, store valid image, return URL and metadata
    - Implement PATCH `/api/projects/{project_id}/cover/blurb`: accept edited blurb text, validate ≤ 500 words, update layout
    - Return appropriate error responses (422 for validation, 500 for AI failures)
    - _Requirements: 3.1, 7.1, 7.3, 7.4_

  - [x] 8.3 Create cover assembly and PDF download endpoints
    - Implement POST `/api/projects/{project_id}/cover/assemble`: accept layout_id + paper_stock, call CoverAssembler.assemble_cover, store PDF, return URL + dimensions
    - Implement GET `/api/projects/{project_id}/cover/pdf`: stream the assembled PDF file with Content-Type application/pdf
    - Implement GET `/api/projects/{project_id}/cover/spine-width`: accept page_count + paper_stock query params, return calculated spine width (for frontend preview)
    - Validate required elements before assembly (return 422 with missing elements list)
    - _Requirements: 5.1, 5.4, 5.6_

  - [x] 8.4 Register cover router in FastAPI app
    - Add the cover router to the FastAPI application in `backend/app/main.py`
    - Ensure all endpoints are protected by auth middleware
    - Ensure project ownership is verified (user can only access their own projects' covers)
    - _Requirements: 1.1, 2.1_

- [x] 9. Write unit tests (prompt generation, spine calc, PDF dimensions)
  - [x] 9.1 Write PromptGenerator unit tests
    - Test: system prompt includes spoiler-free constraints
    - Test: parse_prompts extracts exactly 10 prompts from well-formed response
    - Test: parse_prompts handles fewer than 10 prompts gracefully
    - Test: parse_prompts handles empty/malformed AI response
    - Test: book text is truncated to 10,000 tokens for context management
    - Test: CoverServiceError raised on AI timeout
    - Use MockTextProvider from AI Engine module
    - _Requirements: 1.1, 1.2, 1.4, 1.5_

  - [x] 9.2 Write ImageGenerator unit tests
    - Test: images requested at 1600×2400px dimensions
    - Test: regeneration counter increments on each regeneration
    - Test: RegenerationLimitError raised at count 20
    - Test: regeneration with count 19 succeeds, count 20 fails
    - Test: upload validation rejects BMP format (unsupported)
    - Test: upload validation rejects file > 25 MB
    - Test: upload validation rejects image < 1600×2400px
    - Test: upload validation accepts valid 1600×2400 PNG
    - Test: upload validation accepts valid 2000×3000 JPEG
    - _Requirements: 2.1, 2.4, 2.5, 3.2, 3.3, 3.4_

  - [x] 9.3 Write spine width calculation unit tests
    - Test: 200 pages × standard_white (0.1mm) + 0.6mm = 20.6mm
    - Test: 100 pages × cream (0.11mm) + 0.6mm = 11.6mm
    - Test: 300 pages × premium_white (0.12mm) + 0.6mm = 36.6mm
    - Test: 500 pages × heavy (0.14mm) + 0.6mm = 70.6mm
    - Test: 1 page produces minimum valid spine width
    - Test: unknown paper stock defaults to standard_white thickness
    - _Requirements: 5.4_

  - [x] 9.4 Write CoverAssembler unit tests
    - Test: PDF dimensions include 3mm bleed on all edges
    - Test: total spread width = back_cover_width + spine_width + front_cover_width + (6 × bleed)
    - Test: validation catches missing front cover image
    - Test: validation catches missing title text
    - Test: validation catches missing author text
    - Test: validation returns all missing elements (not just first)
    - Test: QR code generated at minimum 2cm×2cm
    - Test: back cover layout order is synopsis → QR → link (top to bottom)
    - _Requirements: 5.1, 5.5, 5.6, 8.1, 8.3_

  - [x] 9.5 Write BlurbGenerator unit tests
    - Test: system prompt includes spoiler-free and word count constraints
    - Test: generated blurb within 100-250 words is accepted
    - Test: user-edited blurb at exactly 500 words is accepted
    - Test: user-edited blurb at 501 words is rejected
    - Test: CoverServiceError raised on AI timeout (30s)
    - _Requirements: 7.1, 7.2, 7.4, 7.5_

- [x] 10. Write integration tests (full cover generation flow)
  - [x] 10.1 Write end-to-end cover generation integration tests
    - Test: generate prompts → generate images → select image → apply template → set title/author → assemble PDF (happy path)
    - Test: assembled PDF has correct total dimensions for given page count and paper stock
    - Test: assembled PDF contains CMYK color space markers
    - Test: upload image → place on cover → assemble PDF (user upload flow)
    - Test: regenerate image 20 times → verify 21st attempt returns 429
    - Test: generate blurb → edit blurb → verify in assembled PDF back cover
    - Require authentication for all endpoints
    - Verify project ownership (user A cannot generate covers for user B's project)
    - _Requirements: 1.1, 2.1, 2.4, 3.1, 5.1, 5.2, 7.1_

  - [x] 10.2 Write cover builder frontend integration tests
    - Test: template selection applies correct default text positions
    - Test: character limit enforcement on title input (100 chars)
    - Test: character limit enforcement on author input (60 chars)
    - Test: font size slider respects 8-200pt range
    - Test: image placement on canvas triggers resolution validation
    - Test: preview mode shows three panels (front, spine, back)
    - Test: spine width updates when page count changes
    - Use Vitest + Testing Library for component tests
    - _Requirements: 4.3, 4.5, 4.6, 6.1, 6.2_

## Notes

- All AI Engine calls use the AIRouter from the AI Engine module — never call providers directly
- PyCairo is used for PDF generation because it supports CMYK color space natively (unlike ReportLab's free tier)
- The existing `CoverPrompt` and `CoverLayout` models in `backend/app/models/cover.py` are reused; only `CoverSession` is new
- Image storage uses the project's storage directory: `storage/projects/{project_id}/covers/`
- Frontend Fabric.js canvas works at a scaled resolution for screen display but stores coordinates in normalized (0-1) space for resolution independence
- Templates are stored as Python data structures (not database records) since they are system-defined and rarely change
- The spine width calculation endpoint is separate from assembly to allow the frontend to update the preview without triggering full PDF generation
- Character limits are enforced both frontend (UX) and backend (validation before PDF generation) for defense in depth

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1", "2.2", "2.3", "3.1", "3.2"] },
    { "id": 2, "tasks": ["4.1", "4.2", "4.3"] },
    { "id": 3, "tasks": ["5.1", "5.2", "5.3", "6.1"] },
    { "id": 4, "tasks": ["7.1", "7.2", "7.3", "7.4", "7.5"] },
    { "id": 5, "tasks": ["8.1", "8.2", "8.3", "8.4"] },
    { "id": 6, "tasks": ["9.1", "9.2", "9.3", "9.4", "9.5"] },
    { "id": 7, "tasks": ["10.1", "10.2"] }
  ]
}
```
