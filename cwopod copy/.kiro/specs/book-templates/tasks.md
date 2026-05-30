# Implementation Plan: Book Templates

## Overview

This plan implements the Book Templates feature in incremental steps: shared validation constants, database model + migration, backend CRUD router, sample text manager, preview generation Celery task, apply-template endpoint on the projects router, and finally the three frontend components (Templates tab, Template Builder wizard, Apply Template picker). Each step builds on the previous and ends with wiring into the existing app.

## Tasks

- [ ] 1. Extract shared validation constants
  - [ ] 1.1 Create `backend/app/services/template_validation.py` with shared constants
    - Define `VALID_TRIM_SIZES`, `VALID_PAPER_TYPES`, `VALID_COVER_FINISHES`, `VALID_BINDING_TYPES`, `VALID_FONT_SIZES` sets
    - Define `SYSTEM_DEFAULTS` dict with fallback values for all six Print_Settings fields
    - Add a `validate_print_settings(data: dict) -> list[str]` helper that returns a list of validation error messages for any invalid field values
    - Add verbose logging on validation calls
    - _Requirements: 1.6, 7.8, 7.10_

  - [ ] 1.2 Refactor `backend/app/routers/projects.py` to use shared constants
    - Replace inline `valid_sizes`, `valid_papers`, `valid_finishes`, `valid_bindings`, `valid_font_sizes` sets in `update_print_options` with imports from `template_validation.py`
    - Verify existing behavior is unchanged
    - _Requirements: 7.8_

- [ ] 2. Create Template model and database migration
  - [ ] 2.1 Create `backend/app/models/template.py` with the Template SQLAlchemy model
    - Use `Base`, `TimestampMixin`, `UserScopedMixin` from `app.models.base`
    - Define columns: id (UUID PK), name (String 100, non-null), trim_size (String 20, non-null), paper_type (String 20, non-null), color_interior (Boolean, non-null), cover_finish (String 20, non-null), binding_type (String 20, non-null), font_size (String 10, non-null), preview_pdf_path (Text, nullable)
    - Add index on user_id
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [ ] 2.2 Register Template model in `backend/app/models/__init__.py`
    - Import Template so Alembic auto-detects it
    - _Requirements: 1.1_

  - [ ] 2.3 Create Alembic migration for the `templates` table
    - Run `alembic revision --autogenerate -m "add_templates_table"` to generate migration
    - Verify the migration creates the table with all columns and the user_id index
    - _Requirements: 1.1, 1.4_

  - [ ]* 2.4 Write property test for Print_Settings validation (Property 1)
    - **Property 1: Print_Settings validation rejects invalid values**
    - Use Hypothesis to generate arbitrary strings not in allowed sets and verify `validate_print_settings` returns errors
    - **Validates: Requirements 1.6, 7.8, 7.10**

  - [ ]* 2.5 Write property test for name validation (Property 9)
    - **Property 9: Name validation — trim, length, and non-empty**
    - Use Hypothesis `text()` strategy to verify trimming, rejection of empty/whitespace-only, and length enforcement
    - **Validates: Requirements 9.1, 9.2, 9.3**

- [ ] 3. Implement Templates CRUD router
  - [ ] 3.1 Create `backend/app/routers/templates.py` with CRUD endpoints
    - Implement `GET /api/templates` — list user's templates ordered by updated_at desc, max 50
    - Implement `POST /api/templates` — create with name + Print_Settings, validate all fields using shared constants, trim name, enforce 1–100 char length
    - Implement `GET /api/templates/{template_id}` — get single template with ownership check
    - Implement `PATCH /api/templates/{template_id}` — partial update with ownership check and validation
    - Implement `DELETE /api/templates/{template_id}` — delete with ownership check
    - Define Pydantic schemas: `TemplateCreate`, `TemplateUpdate`, `TemplateResponse`
    - Add verbose logging on all endpoints
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.8, 7.9, 7.10, 9.1, 9.2, 9.3, 9.4_

  - [ ] 3.2 Register templates router in `backend/app/main.py`
    - Import templates router and mount at `/api/templates` with tag "templates"
    - _Requirements: 7.1_

  - [ ]* 3.3 Write property test for create round-trip (Property 10)
    - **Property 10: Create with valid inputs round-trips correctly**
    - Use Hypothesis to generate valid names and Print_Settings combinations, create a template, retrieve it, and verify all fields match
    - **Validates: Requirements 1.1, 7.2**

  - [ ]* 3.4 Write property test for partial update (Property 7)
    - **Property 7: Partial update applies only specified fields**
    - Use Hypothesis to generate random subsets of fields, PATCH, and verify only those fields changed
    - **Validates: Requirements 7.4**

  - [ ]* 3.5 Write property test for list ordering (Property 6)
    - **Property 6: Template list is ordered by updated_at descending**
    - Create multiple templates, verify list response ordering invariant
    - **Validates: Requirements 7.1**

  - [ ]* 3.6 Write property test for ownership enforcement (Property 8)
    - **Property 8: Ownership enforcement returns 404 for non-owned resources**
    - Use Hypothesis to generate template operations from a different user and verify 404
    - **Validates: Requirements 1.2, 7.9**

- [ ] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Implement from-book endpoint and apply-template endpoint
  - [ ] 5.1 Add `POST /api/templates/from-book` endpoint to templates router
    - Accept `project_id` and `name`, verify ownership of the project
    - Read book's Print_Settings, resolve nulls via user preference → system default cascade
    - Create and return the new template with all six fields populated
    - Add verbose logging
    - _Requirements: 4.3, 4.4, 7.7_

  - [ ] 5.2 Add `POST /api/projects/{project_id}/apply-template` endpoint to projects router
    - Accept `template_id` and optional `force` boolean
    - Verify ownership of both template and project
    - If template's trim_size or font_size differs from book's AND book has interior_pdf_path: return `{"needs_confirmation": true, "reason": "..."}` unless `force=true`
    - When applying (no conflict or force=true): overwrite all six Print_Settings on the project
    - If force=true and conflict existed: also clear interior_pdf_path, page_count, reset status to DRAFT
    - Add verbose logging
    - _Requirements: 5.4, 5.5, 5.6, 5.7, 5.8, 7.6, 7.9_

  - [ ]* 5.3 Write property test for from-book null resolution (Property 3)
    - **Property 3: From-book null resolution produces fully-populated template**
    - Use Hypothesis to generate books with random null/non-null field combinations and user preferences, verify all six fields are non-null in the resulting template
    - **Validates: Requirements 4.3, 4.4, 7.7**

  - [ ]* 5.4 Write property test for apply-template overwrites (Property 2)
    - **Property 2: Template apply overwrites all six Print_Settings**
    - Use Hypothesis to generate templates and projects, apply, and verify all six fields match
    - **Validates: Requirements 5.4, 7.6**

  - [ ]* 5.5 Write property test for invalidation warning (Property 4)
    - **Property 4: Invalidation warning triggers when trim_size or font_size differs on typeset book**
    - Use Hypothesis to generate templates and projects with/without interior_pdf_path, verify needs_confirmation logic
    - **Validates: Requirements 5.5**

  - [ ]* 5.6 Write property test for confirmed invalidation clears state (Property 5)
    - **Property 5: Confirmed invalidation clears PDF state**
    - Use Hypothesis to generate projects with interior_pdf_path and page_count, apply with force=true, verify cleared state
    - **Validates: Requirements 5.8**

- [ ] 6. Implement Sample Text Manager
  - [ ] 6.1 Create `backend/app/services/typeset/sample_text.py`
    - Implement `SampleTextManager` class with `GUTENBERG_ID = "3536"` and `CACHE_PATH = "_shared/sample_text/enchanted_castle.html"`
    - Implement `ensure_cached()` method that returns the path to cached sample text, downloading if not present
    - Use the existing Gutenberg provider to download and the Pandoc pipeline to normalize
    - Store at `{storage_path}/_shared/sample_text/enchanted_castle.html`
    - Add verbose logging for cache hit/miss, download attempts, and errors
    - _Requirements: 6.1, 6.2, 6.4_

  - [ ]* 6.2 Write unit tests for SampleTextManager
    - Test cache hit path (file exists, no download)
    - Test cache miss path (file doesn't exist, triggers download)
    - Test download failure handling (raises appropriate error)
    - _Requirements: 6.2, 6.3, 6.4_

- [ ] 7. Implement Template Preview Celery task
  - [ ] 7.1 Create `backend/app/services/typeset/template_preview.py`
    - Implement `generate_template_preview` Celery task
    - Task flow: ensure sample text cached → read cached HTML → run chapter detection → render Typst source using template's Print_Settings → compile PDF via `compile_typst` → store at `{storage_path}/templates/{user_id}/{template_id}/preview.pdf` → update template's `preview_pdf_path`
    - Report progress stages via Celery meta updates (same pattern as `generate_pdf_task`)
    - Handle concurrent task detection (return 409 if already in progress)
    - Add verbose logging at each stage
    - _Requirements: 8.1, 8.2, 8.4_

  - [ ] 7.2 Add preview endpoints to templates router
    - `POST /api/templates/{id}/generate-preview` — trigger the Celery task, return task_id
    - `GET /api/templates/{id}/preview-status` — poll task status (same pattern as typeset status endpoint)
    - `GET /api/templates/{id}/preview-pdf` — serve the generated PDF file
    - Check for concurrent task (409 if already running)
    - Add verbose logging
    - _Requirements: 8.1, 8.3, 8.6, 8.7_

  - [ ]* 7.3 Write unit tests for template preview task
    - Test successful preview generation flow
    - Test sample text download failure returns 503
    - Test concurrent task detection returns 409
    - _Requirements: 8.1, 8.6, 8.7_

- [ ] 8. Checkpoint - Ensure all backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Implement Templates Tab on Bookshelf page
  - [ ] 9.1 Modify `frontend/js/pages/bookshelf.js` to add tab switching
    - Add "Books" and "Templates" tabs to the bookshelf page header
    - "Books" tab active by default, shows existing bookshelf content
    - "Templates" tab shows template list with name, trim_size, binding_type for each
    - Add "New Template" button that navigates to `/template-builder`
    - Add "Create from Book..." button that opens a book picker modal
    - Add delete action per template with confirmation dialog
    - Show empty state message when no templates exist
    - Disable "Create from Book..." when user has no projects
    - Log all user actions and API calls
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 4.1, 4.2_

  - [ ] 9.2 Add template list API calls to `frontend/js/api.js` (or inline in bookshelf)
    - Add functions for: list templates, delete template, list projects for picker
    - Log all API requests and responses
    - _Requirements: 7.1, 7.5_

- [ ] 10. Implement Template Builder wizard page
  - [ ] 10.1 Create `frontend/js/pages/template-builder.js`
    - Implement 3-step wizard: Print Size → Print Options → Typeset
    - Step 1 (Print Size): trim size selector (reuse same UI pattern as project wizard)
    - Step 2 (Print Options): paper type, color interior, cover finish, binding type, font size selectors
    - Step 3 (Typeset): trigger preview generation, poll for status, display PDF when ready
    - "Save Template" button enabled only after preview PDF generated successfully
    - Prompt for template name on save (new) or use existing name (edit)
    - Pre-populate fields when editing an existing template
    - Handle preview generation failure with error message and "Retry" button
    - Regenerate preview if user changes settings and returns to Typeset step
    - Log all user actions, API calls, and state changes
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 8.1, 8.3, 8.5, 8.6_

  - [ ] 10.2 Register template-builder route in `frontend/js/router.js`
    - Add route for `/template-builder` and `/template-builder/:id` (edit mode)
    - _Requirements: 3.1_

- [ ] 11. Implement Apply Template picker on Project page
  - [ ] 11.1 Modify `frontend/js/pages/project.js` to add Apply Template functionality
    - Add "Apply Template" button in the Print Options section (Print Size step)
    - On click: fetch user's templates, display picker modal with names and Print_Settings summaries
    - Show empty state if no templates exist
    - On template selection: call `POST /api/projects/{id}/apply-template`
    - Handle `needs_confirmation` response: show Invalidation_Warning dialog
    - On confirm: re-send with `force: true`, update UI with new settings
    - On cancel: close dialog, no changes
    - Log all user actions, API calls, and state changes
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_

- [ ] 12. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The backend is Python 3.11 / FastAPI with SQLAlchemy async ORM, Celery+Redis, PostgreSQL 16
- The frontend is vanilla JavaScript (ES6+) + jQuery
- All code must include verbose logging per project steering rules
- No software installation commands should be run — inform user if dependencies are needed

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4", "2.5"] },
    { "id": 3, "tasks": ["3.1", "6.1"] },
    { "id": 4, "tasks": ["3.2", "3.3", "3.4", "3.5", "3.6", "6.2"] },
    { "id": 5, "tasks": ["5.1", "5.2", "7.1"] },
    { "id": 6, "tasks": ["5.3", "5.4", "5.5", "5.6", "7.2"] },
    { "id": 7, "tasks": ["7.3"] },
    { "id": 8, "tasks": ["9.1", "9.2"] },
    { "id": 9, "tasks": ["10.1"] },
    { "id": 10, "tasks": ["10.2", "11.1"] }
  ]
}
```
