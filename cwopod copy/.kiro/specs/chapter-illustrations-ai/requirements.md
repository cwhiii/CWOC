# Requirements Document

## Introduction

This feature adds AI-generated chapter illustrations to the CWOPOD book typesetting workflow. It extends the existing Illustrations step by providing a "Generate" action that analyzes chapter text and produces images suitable for print placement. Generated images land in the project's Available Pool, where the existing placement, sizing, lock, and reflow pipeline handles them like any other image. The feature reuses the existing AI engine infrastructure (ComfyUI, OpenAI DALL-E, Replicate Flux), the prompt generator pattern from cover art, and the Celery task + polling architecture. Users can generate one illustration per chapter, customize prompts before generation, enforce a consistent visual style across all chapters via a project-level style prefix, and choose output dimensions appropriate for their intended placement mode (full-page portrait, plate, or inline landscape). Resolution is handled by generating at the largest practical size and relying on the existing AI Upscale flow when needed.

## Glossary

- **Chapter_Illustration**: An AI-generated image intended for placement within or adjacent to a specific chapter in the book interior
- **Style_Prefix**: A project-level text string prepended to every chapter illustration prompt to enforce visual consistency across all generated images (e.g., "dark ink wash illustration, high contrast, no text")
- **Illustration_Prompt**: The full text sent to the image generation provider, composed of the Style_Prefix + the chapter-specific prompt describing the scene
- **Chapter_Prompt**: The chapter-specific portion of the Illustration_Prompt, either auto-generated from chapter text analysis or manually written/edited by the user
- **Generation_Panel**: The UI panel within the Illustrations step that provides controls for generating chapter illustrations (style prefix, per-chapter prompts, dimensions, generate button)
- **Aspect_Preset**: A predefined output dimension configuration corresponding to a placement mode: Portrait (for full-page/plate, matching trim size aspect ratio), Square (1:1), or Landscape (for inline/header illustrations)
- **Prompt_Analysis**: The AI-driven process of reading chapter text and producing a spoiler-free, visually descriptive Chapter_Prompt suitable for image generation
- **Batch_Generate**: The action of generating illustrations for multiple chapters in sequence within a single operation, with per-chapter progress reporting
- **Generation_History**: The record of previously generated images for a chapter, allowing the user to browse past results and select a preferred version without re-generating

## Requirements

### Requirement 1: Generation Panel in Illustrations Step

**User Story:** As a user, I want a generation panel within the Illustrations step, so that I can produce AI illustrations for my chapters without leaving the image placement workflow.

#### Acceptance Criteria

1. THE Illustrations_Step SHALL include a "Generate" tab or expandable section in the left column alongside the existing pool sections (Shared, Available, In Book)
2. THE Generation_Panel SHALL display a list of all chapters in the current book, each showing: chapter number, chapter title, and generation status (not generated, generating, generated)
3. WHEN a chapter has a previously generated illustration, THE Generation_Panel SHALL display a small thumbnail of the most recent generation next to that chapter's entry
4. THE Generation_Panel SHALL provide a "Generate All" button that triggers Batch_Generate for all chapters that do not yet have a generated illustration
5. THE Generation_Panel SHALL provide a per-chapter "Generate" button that triggers generation for a single chapter
6. WHEN generation is in progress for any chapter, THE Generation_Panel SHALL display real progress from the backend task (percent, stage label) and disable the Generate button for that chapter
7. THE Generation_Panel SHALL be accessible only when the project has at least one chapter detected by the chapter detector

### Requirement 2: Style Prefix Configuration

**User Story:** As a user, I want to set a visual style that applies to all my chapter illustrations, so that the images look like they belong in the same book.

#### Acceptance Criteria

1. THE Generation_Panel SHALL provide a Style_Prefix text area at the top of the panel, persisted per project
2. THE Style_Prefix SHALL default to an empty string for new projects
3. THE System SHALL provide a set of preset style suggestions the user can click to populate the Style_Prefix, including at minimum: "black and white ink illustration", "watercolor painting", "woodcut engraving", "pencil sketch", and "digital art, muted tones"
4. WHEN the user modifies the Style_Prefix, THE System SHALL persist the change to the project record via the backend API within 1 second of the field losing focus
5. THE Style_Prefix SHALL be prepended to every Chapter_Prompt when constructing the final Illustration_Prompt sent to the image provider, separated by a comma and space
6. IF the Style_Prefix is empty, THE System SHALL use only the Chapter_Prompt as the Illustration_Prompt without any prefix
7. THE Style_Prefix SHALL have a maximum length of 500 characters

### Requirement 3: Chapter Prompt Generation and Editing

**User Story:** As a user, I want the system to auto-generate image prompts from my chapter text, and I want to edit them before generating the image, so that I have control over what the illustration depicts.

#### Acceptance Criteria

1. WHEN the user clicks "Generate" for a chapter that has no Chapter_Prompt, THE System SHALL first perform a Prompt_Analysis on that chapter's text to produce a Chapter_Prompt, then display it in an editable text field for the user to review and modify before image generation begins
2. WHEN the user clicks "Generate All", THE System SHALL perform Prompt_Analysis for all chapters lacking a Chapter_Prompt, then present the full list of prompts for review before starting image generation
3. THE Prompt_Analysis SHALL reuse the existing AI text generation infrastructure (AIRouter.generate_text) with a system prompt tailored for interior illustrations rather than cover art
4. THE Prompt_Analysis system prompt SHALL instruct the AI to produce prompts that are: spoiler-free, visually descriptive, suitable for the book's genre, and focused on a single scene or symbolic image rather than multiple competing elements
5. THE user SHALL be able to edit any Chapter_Prompt at any time, and the edited prompt SHALL be persisted to the project record
6. THE user SHALL be able to manually write a Chapter_Prompt from scratch without triggering Prompt_Analysis
7. EACH Chapter_Prompt SHALL have a maximum length of 1000 characters
8. WHEN Prompt_Analysis fails for a chapter (AI error or timeout), THE System SHALL display an error message for that chapter and allow the user to retry or write a prompt manually

### Requirement 4: Aspect Preset and Output Dimensions

**User Story:** As a user, I want to choose the shape of my generated illustrations based on how I plan to place them, so that the images fit naturally without excessive cropping.

#### Acceptance Criteria

1. THE Generation_Panel SHALL provide an Aspect_Preset selector with options: "Portrait" (for full-page or plate placement), "Square" (1:1), and "Landscape" (for inline or chapter header placement)
2. THE Aspect_Preset SHALL be configurable per-chapter, defaulting to the project-level default Aspect_Preset
3. THE Generation_Panel SHALL provide a project-level default Aspect_Preset selector that applies to all chapters unless overridden
4. WHEN "Portrait" is selected, THE System SHALL request image generation at dimensions matching the project's trim size aspect ratio (e.g., 1024×1536 for a 6×9 book) at the maximum resolution the provider supports
5. WHEN "Square" is selected, THE System SHALL request image generation at 1024×1024 (or the provider's maximum square resolution)
6. WHEN "Landscape" is selected, THE System SHALL request image generation at a 3:2 landscape ratio (e.g., 1536×1024) at the maximum resolution the provider supports
7. THE System SHALL store the generated image's actual pixel dimensions in the illustration record so the existing DPI calculation and Resolution_Warning system works correctly

### Requirement 5: Image Generation Execution

**User Story:** As a user, I want the system to generate my chapter illustrations using the configured AI provider, with real progress feedback, so that I know what's happening and can continue working while it runs.

#### Acceptance Criteria

1. WHEN the user confirms prompts and clicks "Generate" (single or batch), THE System SHALL dispatch a Celery background task for each chapter's image generation
2. THE generation task SHALL construct the final Illustration_Prompt by concatenating: Style_Prefix + ", " + Chapter_Prompt (or just Chapter_Prompt if Style_Prefix is empty)
3. THE generation task SHALL use the existing AIRouter.generate_image infrastructure, routing to the user's configured image provider (ComfyUI, OpenAI, or Replicate)
4. THE generation task SHALL report real progress via the existing task status polling pattern, including: percent complete, current stage label, and preview URL when available (ComfyUI only)
5. WHEN generation completes successfully, THE System SHALL store the generated image in the project's images directory at `{storage_path}/{project_id}/images/{uuid}.{ext}` and create an illustration record in the Available_Pool with source="generated", the chapter association, and the actual pixel dimensions
6. WHEN generation fails, THE System SHALL report the error via the task status endpoint and allow the user to retry
7. WHEN Batch_Generate is active, THE System SHALL process chapters sequentially (one at a time) to avoid overwhelming the image provider, reporting per-chapter progress (e.g., "Generating chapter 3 of 12")
8. THE user SHALL be able to continue using other parts of the Illustrations step (placing existing images, navigating the spread) while generation runs in the background

### Requirement 6: Generation History and Re-generation

**User Story:** As a user, I want to re-generate an illustration if I don't like the result, and browse previous generations, so that I can pick the best version without losing earlier attempts.

#### Acceptance Criteria

1. WHEN a chapter already has a generated illustration, THE "Generate" button for that chapter SHALL change to "Regenerate"
2. WHEN the user clicks "Regenerate", THE System SHALL generate a new image using the current Chapter_Prompt and Style_Prefix, without deleting the previous generation
3. THE System SHALL retain up to 5 previously generated images per chapter in the Generation_History
4. THE Generation_Panel SHALL provide a way to browse the Generation_History for a chapter (e.g., a thumbnail strip or gallery modal) and select any previous generation as the active illustration
5. WHEN the user selects a different image from the Generation_History, THE System SHALL update the illustration record in the Available_Pool (or In_Book_Pool if already placed) to reference the newly selected image, preserving any existing placement configuration
6. WHEN the Generation_History reaches 5 images for a chapter, THE System SHALL delete the oldest generation (file and record) when a new one is created
7. IF a generated image is currently placed in the book (In_Book_Pool) and the user regenerates, THE new image SHALL NOT automatically replace the placed image; the user must explicitly select it from the history

### Requirement 7: Print Resolution Considerations

**User Story:** As a user, I want generated illustrations to be as high-resolution as possible for print, and I want clear guidance when they need upscaling.

#### Acceptance Criteria

1. THE System SHALL request the maximum resolution supported by the configured provider for the selected Aspect_Preset (e.g., DALL-E 3 supports 1024×1792 portrait, Flux supports up to 1440×1440)
2. WHEN a generated image's effective DPI at its intended display size falls below 300, THE System SHALL display the existing Resolution_Warning (⚠️) on the image thumbnail
3. THE Generation_Panel SHALL display a note below the Aspect_Preset selector indicating the expected output resolution and the maximum print size at 300 DPI (e.g., "Output: 1024×1536px — prints up to 3.4×5.1 inches at 300 DPI")
4. WHEN a Resolution_Warning is active on a generated illustration, THE System SHALL offer the existing "AI Upscale" action to increase the image's pixel dimensions
5. THE System SHALL NOT automatically upscale generated images; upscaling is always user-initiated

### Requirement 8: Chapter Association and Metadata

**User Story:** As a user, I want generated illustrations to be linked to their source chapter, so that I can see which image goes with which chapter and the system can suggest placement near that chapter.

#### Acceptance Criteria

1. THE illustration record for a generated image SHALL store the associated chapter number and chapter title
2. WHEN the user drags a chapter-associated illustration onto the Spread_Preview, THE System SHALL default the drop position to the first page of the associated chapter (if the drop target is ambiguous)
3. THE In_Book_Pool SHALL display the associated chapter name on generated illustration thumbnails
4. WHEN chapters are reordered or renumbered (e.g., after source re-import), THE System SHALL update the chapter association on generated illustrations to match the new chapter numbering by matching on chapter title
5. IF a chapter is deleted during re-import and a generated illustration was associated with it, THE System SHALL clear the chapter association but retain the image in the Available_Pool

### Requirement 9: Backend API for Chapter Illustration Generation

**User Story:** As a developer, I want REST API endpoints for chapter illustration generation, so that the frontend can trigger and monitor the generation workflow.

#### Acceptance Criteria

1. THE Backend SHALL provide `POST /api/projects/{id}/illustrations/generate` that accepts a JSON body with: chapter_number, chapter_prompt (optional, triggers Prompt_Analysis if absent), aspect_preset, and triggers a Celery generation task, returning a task_id
2. THE Backend SHALL provide `POST /api/projects/{id}/illustrations/generate-batch` that accepts a JSON body with: chapter_numbers (array), and triggers sequential generation for each chapter, returning a batch_task_id
3. THE Backend SHALL provide `POST /api/projects/{id}/illustrations/analyze-prompts` that accepts chapter_numbers (array) and returns auto-generated Chapter_Prompts for each chapter without triggering image generation
4. THE Backend SHALL provide `GET /api/projects/{id}/illustrations/generation-history/{chapter_number}` that returns the Generation_History for a chapter (up to 5 entries with image URLs and timestamps)
5. THE Backend SHALL provide `PATCH /api/projects/{id}/illustrations/chapter-prompt/{chapter_number}` that persists a user-edited Chapter_Prompt
6. THE Backend SHALL provide `PATCH /api/projects/{id}/print-options` (extend existing) to accept and persist the style_prefix and default_aspect_preset fields
7. THE Backend SHALL reuse the existing `GET /api/tasks/{task_id}/status` endpoint for polling generation progress
8. IF the configured AI provider does not support image generation (e.g., Ollama, Anthropic), THEN THE Backend SHALL return HTTP 422 with a message indicating which providers support image generation and how to configure one

### Requirement 10: Data Model Extensions

**User Story:** As a developer, I want the database schema extended to store generation prompts, style configuration, and chapter associations, so that the feature state persists across sessions.

#### Acceptance Criteria

1. THE BookProject model SHALL be extended with fields: illustration_style_prefix (text, nullable, max 500 chars, default null) and illustration_default_aspect (enum: portrait/square/landscape, default portrait)
2. THE System SHALL create a `chapter_illustration_prompts` table storing: id (UUID PK), project_id (UUID FK to book_projects), user_id (UUID FK to users), chapter_number (integer, not null), chapter_title (string, max 500), prompt_text (text, max 1000 chars, not null), aspect_preset (enum: portrait/square/landscape, not null), created_at (timestamp), updated_at (timestamp), with a unique constraint on (project_id, chapter_number)
3. THE System SHALL create a `chapter_illustration_history` table storing: id (UUID PK), project_id (UUID FK), chapter_number (integer, not null), image_uuid (UUID, not null), prompt_used (text, not null), style_prefix_used (text, nullable), aspect_preset (enum), is_active (boolean, default true), generated_at (timestamp), with an index on (project_id, chapter_number, generated_at)
4. THE existing `illustrations` table SHALL be extended with a nullable `chapter_number` column (integer) and a nullable `generation_history_id` column (UUID FK to chapter_illustration_history) to link placed illustrations back to their generation source
5. WHEN a project is deleted, THE System SHALL cascade-delete all associated chapter_illustration_prompts and chapter_illustration_history records and their image files

### Requirement 11: Black and White Mode

**User Story:** As a user printing a B&W interior, I want to generate illustrations that are explicitly black and white, so that they reproduce well without color and don't accidentally force a color interior printing cost.

#### Acceptance Criteria

1. THE Generation_Panel SHALL display a "Black & White" toggle, defaulting to the inverse of the project's color_interior setting (B&W toggle ON when color_interior is false)
2. WHEN the "Black & White" toggle is ON, THE System SHALL append ", black and white, grayscale, no color" to the Illustration_Prompt before sending it to the image provider
3. WHEN the "Black & White" toggle is ON and a generated image is received, THE System SHALL convert the image to grayscale before storing it, ensuring no color data remains regardless of what the AI provider returned
4. WHEN the "Black & White" toggle is OFF and the project's color_interior is false, THE System SHALL display a warning: "Generating color illustrations will require color interior printing, which increases cost significantly"
5. THE "Black & White" toggle state SHALL be persisted per project alongside the style_prefix

