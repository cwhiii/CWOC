# Implementation Plan: Typeset Service Module

## Overview

This plan implements the Typeset Service module which converts book text into print-ready interior PDFs. The module detects chapter structure, renders parameterized Typst templates with proper front/back matter, generates QR codes for Info_Page and Attribution_Page, and compiles the final PDF as a Celery background task. Output conforms to the selected print provider's trim, margin, and bleed specifications.

Technology: Python/FastAPI backend, Celery for background PDF generation, Typst for typesetting, python-qrcode + Pillow for QR codes, PostgreSQL for project state.

## Tasks

- [x] 1. Implement ChapterDetector (regex patterns + EPUB nav parsing)
  - [x] 1.1 Create the ChapterDetector with regex pattern matching
    - Create `backend/app/services/typeset/__init__.py`
    - Create `backend/app/services/typeset/chapter_detector.py`
    - Define the `Chapter` dataclass with fields: number, title, heading, content, start_position
    - Define `CHAPTER_PATTERNS` list with regex patterns for:
      - "CHAPTER I — Title" / "CHAPTER 1 — Title" (with separator variants: —, -, :, .)
      - "CHAPTER I" / "CHAPTER 1" (no title, case-insensitive CHAPTER/Chapter)
      - "Chapter One" / "CHAPTER ONE" (word numbers up to ninety-nine)
      - Standalone roman numerals: "I.", "II.", "III." on their own line
      - Standalone arabic numerals: "1.", "2.", "3." on their own line
    - Implement `_detect_from_patterns(text)` method:
      - Try each pattern in order of specificity
      - Use the first pattern that produces ≥ 2 matches (avoids false positives)
      - Split text at match positions into Chapter objects
      - Extract chapter titles from match groups
    - Implement `_roman_to_int(roman)` helper for roman numeral conversion
    - Implement fallback: if no pattern matches, return single Chapter with all text
    - _Requirements: 3.1, 3.3, 3.4, 3.5_

  - [x] 1.2 Implement EPUB navigation parsing for chapter detection
    - Implement `_detect_from_epub_nav(text, nav_entries)` method
    - Accept nav_entries as list of `{"title": str, "href": str, "position": int}`
    - Split text at the character positions specified by nav entries
    - Use nav entry titles as chapter titles
    - Implement `detect(text, epub_nav=None)` main method:
      - If epub_nav is provided and non-empty, use `_detect_from_epub_nav`
      - Otherwise, fall back to `_detect_from_patterns`
    - _Requirements: 3.2, 3.3, 3.5_

- [x] 2. Create Typst template system (parameterized templates for front/body/back matter)
  - [x] 2.1 Implement provider specs configuration
    - Create `backend/app/services/typeset/provider_specs.py`
    - Define `ProviderSpec` frozen dataclass with fields: name, trim_width, trim_height, margin_top, margin_bottom, margin_outer, gutter, bleed, min_page_count, max_page_count
    - Define `PROVIDER_SPECS` dict with entries for "lulu", "bookvault", "kdp":
      - Lulu: 5.5" × 8.5", margins 0.75", gutter 0.875", bleed 0.125", pages 32-800
      - BookVault: 5.06" × 7.81", margins 0.7", gutter 0.8", bleed 0.118" (3mm), pages 24-600
      - KDP: 5.5" × 8.5", margins 0.75", gutter 0.875", bleed 0.125", pages 24-828
    - Implement `get_provider_spec(provider)` with validation
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 2.2 Implement TemplateRenderer document setup and front matter
    - Create `backend/app/services/typeset/template_renderer.py`
    - Define `BookMetadata` dataclass with: title, author, source_name, source_url, original_publisher, publication_year, edition, license_text, app_url
    - Define `TypesetAssets` dataclass with: info_qr_path, attribution_qr_path, image_paths
    - Implement `_render_document_setup(provider_spec)`:
      - Set page dimensions from provider_spec (width, height)
      - Set margins (top, bottom, outside=margin_outer, inside=gutter)
      - Set base font (Libertinus Serif, 11pt) and paragraph justification
    - Implement `_render_front_matter(metadata, assets)`:
      - Half-title page: title centered vertically
      - Blank verso page
      - Title page: title + author centered
      - Copyright page (verso)
      - Info_Page (recto): app URL text + QR code image
      - Set page numbering to roman numerals for front matter
      - Suppress running headers on all front matter pages
    - Implement `_escape_typst(text)` for special character escaping
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 2.3 Implement TemplateRenderer body and back matter
    - Implement `_render_body(chapters, metadata)`:
      - Reset page counter to arabic 1
      - Configure running headers: book title on verso, chapter title on recto
      - Configure page numbers in footer (centered)
      - For each chapter:
        - Insert `#pagebreak(to: "odd")` to start on recto
        - Render chapter heading (large, bold)
        - Suppress running header on chapter opening page
        - Render chapter content with paragraph formatting
        - Handle inline images at approximate original positions
    - Implement `_render_back_matter(metadata, assets)`:
      - Attribution_Page starting on new page
      - Display available metadata fields (skip None values)
      - Include attribution QR code image
      - Include license text on same or following page if present
    - Implement `render_full(chapters, metadata, provider_spec, assets)`:
      - Concatenate: document_setup + front_matter + body + back_matter
    - Implement `_render_image(image_path, caption)` helper
    - _Requirements: 4.1, 4.2, 4.3, 6.1, 6.2, 6.3, 6.4, 7.1, 7.2, 7.3, 7.4, 8.1_

- [x] 3. Implement QRGenerator (python-qrcode + Pillow)
  - [x] 3.1 Create the QRGenerator component
    - Create `backend/app/services/typeset/qr_generator.py`
    - Implement `_generate_qr(url, output_path)`:
      - Use qrcode library with error_correction=ERROR_CORRECT_H (30% recovery)
      - Set box_size=10, border=4 for print legibility
      - Generate as PNG with white background
      - Verify output is at minimum 236×236 pixels (2cm at 300 DPI)
      - If smaller, resize up to 236×236 using Pillow
    - Implement `generate_info_page_qr(app_url, output_dir)`:
      - Generate QR encoding app_url
      - Save to output_dir/info_page_qr.png
      - Return path to generated image
    - Implement `generate_attribution_qr(source_url, output_dir)`:
      - Generate QR encoding source_url
      - Save to output_dir/attribution_qr.png
      - Return path to generated image
    - _Requirements: 5.3, 5.4, 7.2, 7.5_

- [x] 4. Implement PDFGenerator Celery task (Typst compilation)
  - [x] 4.1 Implement the generate_pdf_task Celery task
    - Create `backend/app/services/typeset/pdf_generator.py`
    - Register task as `typeset.generate_pdf` in Celery
    - Implement the full pipeline:
      1. Load project from database, verify ownership and text path exists
      2. Read text from working_text_path (fallback to original_text_path)
      3. Load EPUB nav data if available on project
      4. Report progress: stage="detecting_chapters"
      5. Detect chapters using ChapterDetector
      6. Report progress: stage="generating_qr_codes"
      7. Generate QR codes using QRGenerator (info page + attribution)
      8. Collect image assets from project
      9. Build BookMetadata from project fields
      10. Get ProviderSpec for selected provider
      11. Report progress: stage="rendering_template"
      12. Render Typst source using TemplateRenderer
      13. Write Typst source to temp directory
      14. Report progress: stage="compiling_pdf"
      15. Compile Typst to PDF using compile_typst()
      16. Move PDF to project storage directory
      17. Update project.interior_pdf_path and project.page_count
      18. Return {"pdf_path": str, "page_count": int, "chapters_detected": int}
    - Set soft_time_limit=300, hard_time_limit=600
    - _Requirements: 1.1, 1.3, 1.4, 1.5_

  - [x] 4.2 Implement Typst compilation wrapper
    - Implement `compile_typst(source_path, output_path, font_paths=None)`:
      - Build command: `typst compile {source_path} {output_path}`
      - Add `--font-path` arguments if font_paths provided
      - Run via subprocess with timeout of 120 seconds
      - Capture stdout and stderr
      - If exit code != 0, raise TypesetCompilationError with stderr
      - Parse page count from PDF (using pikepdf or similar)
      - Return page count
    - Define `TypesetCompilationError` exception class with message and stderr fields
    - _Requirements: 1.1, 9.3_

  - [x] 4.3 Add error handling and validation to the task
    - Validate text file exists and is non-empty before processing
    - Validate provider key is recognized
    - Handle file I/O errors with descriptive messages
    - Handle Typst not installed (FileNotFoundError on subprocess)
    - Handle QR generation failures
    - Ensure source text is never modified (read-only access)
    - Log warnings for images below 300 DPI (include but don't fail)
    - Check if page count exceeds provider max_page_count (warn but don't fail)
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 8.3_

- [x] 5. Create typeset API endpoint (POST /api/projects/{id}/typeset)
  - [x] 5.1 Create the typeset router and POST endpoint
    - Create `backend/app/routers/typeset.py`
    - Create `backend/app/schemas/typeset.py` with TypesetRequest, TypesetResponse, TypesetStatusResponse
    - Implement `POST /api/projects/{project_id}/typeset`:
      - Validate project exists and belongs to authenticated user
      - Validate project has text (working_text_path or original_text_path)
      - Validate provider is one of: "lulu", "bookvault", "kdp"
      - Check no active typeset task for this project (query Celery or project state)
      - Dispatch generate_pdf_task to Celery
      - Return 202 with {"task_id": str, "status": "generating"}
    - Implement `GET /api/projects/{project_id}/typeset/status`:
      - Query Celery task state for the project's active task
      - Return current status, progress stage, error details, or completion info
    - Register router in main FastAPI app
    - _Requirements: 10.1, 10.3, 10.5_

- [x] 6. Create interior PDF download endpoint (GET /api/projects/{id}/interior-pdf)
  - [x] 6.1 Implement the PDF download endpoint
    - Implement `GET /api/projects/{project_id}/interior-pdf`:
      - Validate project exists and belongs to authenticated user
      - Check project.interior_pdf_path is set
      - Verify the PDF file exists on disk
      - Return FileResponse with content_type="application/pdf"
      - Set Content-Disposition header with filename: "{title}_interior.pdf"
      - Return 404 if PDF not yet generated
      - Return 500 if PDF path set but file missing (suggest regeneration)
    - _Requirements: 10.2, 10.4_

- [x] 7. Write unit tests (chapter detection, template rendering, QR generation)
  - [x] 7.1 Write unit tests for ChapterDetector
    - Create `backend/tests/test_typeset/__init__.py`
    - Create `backend/tests/test_typeset/test_chapter_detector.py`
    - Test regex patterns:
      - "CHAPTER I" / "CHAPTER 1" → detected with correct number
      - "CHAPTER I — The Beginning" → detected with title "The Beginning"
      - "Chapter One" / "Chapter Twenty-Three" → detected with word numbers
      - "I." / "II." / "III." → standalone roman numerals detected
      - "1." / "2." / "3." → standalone arabic numerals detected
      - Mixed case: "chapter" not detected (must be "Chapter" or "CHAPTER")
    - Test EPUB nav parsing:
      - Valid nav entries split text correctly
      - Nav entry titles used as chapter titles
      - Empty nav entries fall back to pattern matching
    - Test edge cases:
      - No chapters detected → single chapter returned
      - Single chapter heading → single chapter (pattern needs ≥ 2 matches)
      - Very short text → handled gracefully
      - Text with "Chapter" in body (not as heading) → not falsely detected
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 7.2 Write unit tests for TemplateRenderer
    - Create `backend/tests/test_typeset/test_template_renderer.py`
    - Test document setup:
      - Correct page dimensions for each provider
      - Correct margins and gutter values
      - Font and paragraph settings present
    - Test front matter:
      - Half-title page contains title only
      - Title page contains title and author
      - Copyright page present
      - Info_Page contains QR code reference and URL
      - Roman numeral page numbering set
    - Test body:
      - Page counter reset to arabic 1
      - Each chapter has pagebreak(to: "odd")
      - Running headers configured correctly
      - Chapter headings rendered
    - Test back matter:
      - Attribution_Page includes available metadata
      - Missing metadata fields omitted (no empty placeholders)
      - QR code reference present
      - License text included when provided
    - Test Typst escaping:
      - Special characters (#, @, $, etc.) properly escaped
    - _Requirements: 2.1, 4.1, 5.1, 5.2, 6.1, 6.2, 7.1, 7.2, 7.3_

  - [x] 7.3 Write unit tests for QRGenerator
    - Create `backend/tests/test_typeset/test_qr_generator.py`
    - Test info page QR:
      - Generated file exists at expected path
      - Image is valid PNG
      - Image dimensions ≥ 236×236 pixels
      - QR code decodes to the correct URL
    - Test attribution QR:
      - Generated file exists at expected path
      - Image dimensions ≥ 236×236 pixels
      - QR code decodes to the correct source URL
    - Test edge cases:
      - Very long URL still generates valid QR
      - URL with special characters encoded correctly
      - Output directory created if it doesn't exist
    - _Requirements: 5.3, 5.4, 7.2, 7.5_

  - [x] 7.4 Write unit tests for provider specs
    - Create `backend/tests/test_typeset/test_provider_specs.py`
    - Test all providers have valid positive dimensions
    - Test all providers have min_page_count < max_page_count
    - Test get_provider_spec returns correct spec for each key
    - Test get_provider_spec raises ValueError for unknown provider
    - _Requirements: 2.1, 2.4_

- [x] 8. Write integration tests (full typeset flow)
  - [x] 8.1 Write integration test for the full typeset pipeline
    - Create `backend/tests/test_typeset/test_integration.py`
    - Test: POST /typeset returns 202 with task_id
    - Test: task progresses through stages (detecting → rendering → compiling)
    - Test: task completes with valid PDF path and page count
    - Test: GET /interior-pdf returns the generated PDF file
    - Test: PDF file is valid (can be opened, has pages)
    - Use a short sample text with 2-3 chapters for fast test execution
    - _Requirements: 1.1, 1.3, 1.4, 10.1, 10.2, 10.3_

  - [x] 8.2 Write integration test for provider switching and re-generation
    - Test: Generate PDF with provider "lulu"
    - Test: Change provider to "bookvault", regenerate
    - Test: New PDF has different dimensions (verify page size)
    - Test: Old PDF is replaced
    - Test: page_count may differ between providers (different trim = different pagination)
    - _Requirements: 1.5, 2.1, 2.5_

  - [x] 8.3 Write integration test for error scenarios
    - Test: POST /typeset with no text path → 400 error
    - Test: POST /typeset with unknown provider → 400 error
    - Test: POST /typeset while task running → 409 error
    - Test: GET /interior-pdf before generation → 404 error
    - Test: Invalid Typst source (simulate) → task fails with compilation error
    - Test: Project not owned by user → 404 error
    - _Requirements: 9.1, 9.3, 10.4, 10.5_

  - [x] 8.4 Write integration test for chapter detection in full pipeline
    - Test: Text with "CHAPTER I" / "CHAPTER II" headings → chapters detected and formatted
    - Test: EPUB with nav entries → chapters split correctly
    - Test: Text with no chapter markers → single chapter, no errors
    - Test: Running headers contain correct book title and chapter titles
    - _Requirements: 3.1, 3.2, 3.4, 6.1, 6.2_

## Notes

- The Typst CLI must be installed in the Docker container (add to Dockerfile)
- Font files (Libertinus Serif) should be bundled in the container or available via font path
- The module reads from working_text_path (set by Quality Controller) or falls back to original_text_path
- The interior_pdf_path and page_count fields on BookProject are set by this module
- The page_count is used downstream by the Cover Service for spine width calculation
- Celery task autodiscovery is already configured to find tasks in `app.services`
- All endpoints require authentication via the existing auth middleware
- Generated PDFs and QR images are stored in the project's storage directory

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1"] },
    { "id": 1, "tasks": ["1.2", "2.2"] },
    { "id": 2, "tasks": ["2.3", "3.1"] },
    { "id": 3, "tasks": ["4.1"] },
    { "id": 4, "tasks": ["4.2", "4.3"] },
    { "id": 5, "tasks": ["5.1"] },
    { "id": 6, "tasks": ["6.1"] },
    { "id": 7, "tasks": ["7.1", "7.2", "7.3", "7.4"] },
    { "id": 8, "tasks": ["8.1", "8.2", "8.3", "8.4"] }
  ]
}
```
