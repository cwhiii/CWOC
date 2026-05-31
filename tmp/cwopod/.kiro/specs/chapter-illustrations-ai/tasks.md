!# Implementation Plan: AI Chapter Illustrations

## Overview

This plan implements AI-generated chapter illustrations for CWOPOD. Generated images land in the existing Available Pool and use the existing placement/reflow pipeline. Tasks are ordered by dependency: data model → service layer → API endpoints → frontend components → integration. This feature depends on the Illustrations GUI spec being implemented first (it extends that system).

## Tasks

- [ ] 1. Data model and migration
  - [ ] 1.1 Extend BookProject model with illustration generation fields
    - Add `illustration_style_prefix` (Text, nullable, max 500) to BookProject
    - Add `illustration_default_aspect` (Enum: portrait/square/landscape, default 'portrait') to BookProject
    - Add `illustration_bw_mode` (Boolean, default true) to BookProject
    - Add verbose logging for field access
    - _Requirements: 2.1, 2.4, 4.3, 10.1, 11.1_

  - [ ] 1.2 Create ChapterIllustrationPrompt model
    - Create `backend/app/models/chapter_illustration_prompt.py`
    - Include: id, project_id, user_id, chapter_number, chapter_title, prompt_text, aspect_preset, created_at, updated_at
    - Add unique constraint on (project_id, chapter_number)
    - Register in `backend/app/models/__init__.py`
    - Add verbose logging
    - _Requirements: 3.5, 10.2_

  - [ ] 1.3 Create ChapterIllustrationHistory model
    - Create `backend/app/models/chapter_illustration_history.py`
    - Include: id, project_id, user_id, chapter_number, image_uuid, file_ext, width_px, height_px, prompt_used, style_prefix_used, aspect_preset, provider_used, is_active, generated_at
    - Add composite index on (project_id, chapter_number, generated_at DESC)
    - Register in `backend/app/models/__init__.py`
    - Add verbose logging
    - _Requirements: 6.3, 10.3_

  - [ ] 1.4 Extend illustrations table with chapter association columns
    - Add `chapter_number` (Integer, nullable) to Illustration model
    - Add `generation_history_id` (UUID FK → chapter_illustration_history.id, nullable) to Illustration model
    - _Requirements: 8.1, 10.4_

  - [ ] 1.5 Create Alembic migration
    - Generate migration with `alembic revision --autogenerate`
    - Verify migration creates new tables, adds columns to book_projects and illustrations
    - Ensure migration is reversible
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [ ] 2. Backend prompt analysis service
  - [ ] 2.1 Create prompt analysis service
    - Create `backend/app/services/illustrations/prompt_analysis.py`
    - Implement `analyze_chapter(chapter_text, chapter_title, book_title, author)` — calls AIRouter.generate_text with interior-illustration-focused system prompt
    - Implement `analyze_chapters_batch(chapters, book_title, author, on_progress)` — sequential analysis with progress callback
    - System prompt focuses on: single concrete scene, drawable composition, spoiler-free, 1-2 sentences
    - Truncate chapter text to 4000 chars for analysis (keep inference fast)
    - Add exhaustive logging on entry/exit with parameters and results
    - _Requirements: 3.1, 3.3, 3.4, 3.8_

  - [ ] 2.2 Implement prompt construction logic
    - Create `backend/app/services/illustrations/prompt_builder.py`
    - Implement `build_illustration_prompt(style_prefix, chapter_prompt, bw_mode)` — concatenates prefix + prompt + B&W suffix
    - Implement `get_output_dimensions(aspect_preset, trim_size, provider_name)` — resolves to pixel dimensions using the dimension table
    - Log all prompt construction with final prompt text
    - _Requirements: 2.5, 4.4, 4.5, 4.6, 5.2, 11.2_

- [ ] 3. Backend generation service
  - [ ] 3.1 Create generation service core
    - Create `backend/app/services/illustrations/generation.py`
    - Implement `generate_single(project_id, user_id, chapter_number, prompt, aspect_preset)`:
      - Build final prompt (style_prefix + chapter_prompt + B&W suffix)
      - Resolve output dimensions for configured provider
      - Call AIRouter.generate_image
      - Convert to grayscale if B&W mode
      - Store image file in project images directory
      - Create illustration record in Available Pool with source="generated" and chapter_number
      - Create history record
      - Enforce history cap (delete oldest if > 5)
      - Return image_uuid and metadata
    - Add exhaustive logging at every step
    - _Requirements: 5.1, 5.2, 5.3, 5.5, 5.6, 6.2, 6.6, 11.3_

  - [ ] 3.2 Implement batch generation logic
    - Implement `generate_batch(project_id, user_id, chapter_numbers)`:
      - Process chapters sequentially
      - Report per-chapter progress
      - Continue on individual chapter failure (log error, skip to next)
      - Return list of results (success/failure per chapter)
    - Log batch start, per-chapter progress, batch completion
    - _Requirements: 5.7, 5.8_

  - [ ] 3.3 Implement generation history management
    - Implement `get_generation_history(project_id, chapter_number)` — returns up to 5 entries ordered by generated_at DESC
    - Implement `select_from_history(project_id, user_id, chapter_number, history_id)`:
      - Set all history entries for this chapter to is_active=False
      - Set selected entry to is_active=True
      - Update the illustration record in Available/In_Book pool to reference the selected image
      - Preserve placement config if image is already placed
    - Implement `_enforce_history_cap(project_id, chapter_number)` — delete oldest entry (file + record) if count > 5
    - Log all history operations
    - _Requirements: 6.1, 6.3, 6.4, 6.5, 6.6, 6.7_

  - [ ] 3.4 Implement grayscale conversion
    - Implement `_convert_to_grayscale(image_bytes)` — uses Pillow to convert to grayscale mode, returns PNG bytes
    - Log conversion with before/after sizes
    - _Requirements: 11.3_

- [ ] 4. Backend Celery tasks
  - [ ] 4.1 Create generation Celery tasks
    - Create `backend/app/services/illustrations/generation_tasks.py`
    - Implement `illustrations.generate_single` task:
      - Progress stages: building_prompt (0-5%), sending_to_provider (5-10%), generating_image (10-90%), processing_image (90-95%), saving (95-100%)
      - For ComfyUI: use generate_image_with_progress for step-level progress
      - For cloud providers: report indeterminate progress during generation phase
      - Report real progress via task.update_state
    - Implement `illustrations.generate_batch` task:
      - Sequential chapter processing
      - Overall progress: percent = (chapters_completed / total_chapters) * 100
      - Stage label: "Generating chapter {N} of {total}: {title}"
      - Continue on individual failure
    - Log task lifecycle: start, each stage, completion/failure with full tracebacks
    - _Requirements: 5.1, 5.4, 5.6, 5.7_

- [ ] 5. Backend API endpoints
  - [ ] 5.1 Add generation endpoints to illustrations router
    - Extend `backend/app/routers/illustrations.py`
    - Implement `POST /api/projects/{id}/illustrations/generate` — validates chapter exists, dispatches single generation task, returns task_id
    - Implement `POST /api/projects/{id}/illustrations/generate-batch` — validates chapters, dispatches batch task, returns task_id
    - Implement `POST /api/projects/{id}/illustrations/analyze-prompts` — runs prompt analysis, returns chapter prompts (synchronous for small chapter counts, async task for > 5 chapters)
    - Add auth dependency, project ownership validation
    - Log all endpoint entry/exit
    - _Requirements: 9.1, 9.2, 9.3, 9.8_

  - [ ] 5.2 Add history and prompt management endpoints
    - Implement `GET /api/projects/{id}/illustrations/generation-history/{chapter_number}` — returns history entries
    - Implement `PATCH /api/projects/{id}/illustrations/chapter-prompt/{chapter_number}` — upserts chapter prompt
    - Implement `POST /api/projects/{id}/illustrations/select-history/{history_id}` — selects from history
    - Extend `PATCH /api/projects/{id}/print-options` to accept style_prefix, default_aspect_preset, bw_mode
    - Log all operations
    - _Requirements: 9.4, 9.5, 9.6, 9.7_

- [ ] 6. Checkpoint — Backend complete
  - Ensure all backend code compiles and services are wired correctly.

- [ ] 7. Frontend — Generation Panel
  - [ ] 7.1 Create the Generation Panel component
    - Create `frontend/js/components/generation-panel.js`
    - Render as a collapsible section in the Illustrations step left column
    - Include: Style Prefix textarea with preset buttons, B&W toggle, Default Aspect selector
    - Load project generation settings on mount via existing print-options endpoint
    - Save style_prefix on blur (debounced 1s)
    - Display cost warning when B&W is off and color_interior is false
    - Log all user interactions and state changes to console
    - _Requirements: 1.1, 1.7, 2.1, 2.2, 2.3, 2.4, 2.7, 11.1, 11.4_

  - [ ] 7.2 Implement chapter list with generation controls
    - Render scrollable chapter list within Generation Panel
    - Each row: chapter number, title, thumbnail (or placeholder), aspect override dropdown, Generate/Regenerate button, edit prompt icon, history icon with count badge
    - Show generation status per chapter (not generated / generating / generated)
    - Show real progress (percent + stage) during generation via task polling
    - "Generate All" button at top of list
    - Log all button clicks and status changes
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 4.1, 4.2, 5.4, 5.8, 6.1_

  - [ ] 7.3 Implement Prompt Editor modal
    - Create `frontend/js/components/prompt-editor.js`
    - Modal with: chapter title header, editable prompt textarea (max 1000 chars, char counter), "Auto-generate" button, style prefix preview (read-only), full prompt preview, Save/Cancel
    - "Auto-generate" calls analyze-prompts endpoint for single chapter
    - Save calls PATCH chapter-prompt endpoint
    - Log all interactions
    - _Requirements: 3.1, 3.2, 3.5, 3.6, 3.7_

  - [ ] 7.4 Implement History Browser modal
    - Create `frontend/js/components/history-browser.js`
    - Modal with thumbnail grid (~200px each), showing: timestamp, prompt used (truncated), aspect
    - "Use this" button per thumbnail
    - Currently active image highlighted
    - Calls select-history endpoint on selection
    - Refreshes Available/In_Book pool display after selection
    - Log all interactions
    - _Requirements: 6.3, 6.4, 6.5_

  - [ ] 7.5 Implement Batch Review modal
    - Create `frontend/js/components/batch-review.js`
    - Modal shown before batch generation: scrollable list of chapters with editable prompts
    - Chapters without prompts show "Will auto-generate" placeholder
    - "Generate All" confirmation button dispatches batch task
    - Per-chapter aspect override visible
    - Log all interactions
    - _Requirements: 3.2, 5.7_

- [ ] 8. Frontend — Integration with Illustrations step
  - [ ] 8.1 Wire Generation Panel into Illustrations step
    - Modify `frontend/js/pages/project-illustrations.js` to include Generation Panel
    - Show Generation Panel only when project has detected chapters
    - After generation completes, refresh Available Pool to show new image
    - Generated images in pools show chapter association label
    - Log integration events
    - _Requirements: 1.7, 5.5, 8.2, 8.3_

  - [ ] 8.2 Implement resolution info display
    - Show output resolution note below Aspect Preset selector
    - Calculate and display max print size at 300 DPI for selected preset + provider
    - Update dynamically when aspect or provider changes
    - Log calculations
    - _Requirements: 7.1, 7.2, 7.3_

- [ ] 9. Backend — Chapter association management
  - [ ] 9.1 Implement chapter renumber/delete handling
    - When source is re-imported and chapters change:
      - Match existing prompts/history to new chapters by title
      - Update chapter_number on matched records
      - Clear chapter_number on illustration records for deleted chapters (keep image in Available Pool)
    - Hook into existing source import completion flow
    - Log all association updates
    - _Requirements: 8.4, 8.5_

- [ ] 10. Final checkpoint
  - Verify full flow: style config → prompt analysis → prompt edit → generate → image appears in Available Pool → place in book → lock → reflow → PDF includes generated illustration.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3", "1.4"] },
    { "id": 1, "tasks": ["1.5"] },
    { "id": 2, "tasks": ["2.1", "2.2"] },
    { "id": 3, "tasks": ["3.1", "3.2", "3.3", "3.4"] },
    { "id": 4, "tasks": ["4.1"] },
    { "id": 5, "tasks": ["5.1", "5.2"] },
    { "id": 6, "tasks": ["7.1", "7.2"] },
    { "id": 7, "tasks": ["7.3", "7.4", "7.5"] },
    { "id": 8, "tasks": ["8.1", "8.2"] },
    { "id": 9, "tasks": ["9.1"] }
  ]
}
```

## Notes

- This feature depends on the Illustrations GUI spec being implemented first (pools, placement, reflow, Typst emission all exist).
- The AI engine infrastructure (AIRouter, providers, Celery patterns) already exists from cover generation.
- The prompt analysis service is adapted from `backend/app/services/cover/prompt_generator.py` but with a different system prompt focused on interior illustrations (concrete scenes vs. symbolic cover art).
- Generated images use the same storage path as uploaded illustrations — no separate directory.
- The existing Resolution_Warning and AI Upscale features from the illustrations spec apply to generated images without modification.
- All code must include exhaustive logging per project conventions.
- No software installation — all dependencies (Pillow, Celery, etc.) are assumed already available.
- Progress reporting uses real backend task progress — no fake progress bars.
- Frontend uses vanilla JS + jQuery 3.7.1 (no frameworks).
