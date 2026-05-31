# Implementation Plan: Quality Controller Module

## Overview

This plan implements the Quality Controller module which provides optional LLM-based typo detection with user review. The module scans book text for typographical errors only (misspellings, transposed characters, repeated words), presents them for user review, and applies accepted corrections to a working copy.

Technology: Python/FastAPI backend, Celery for background scanning, PostgreSQL for correction storage, AI Engine integration for LLM calls.

## Tasks

- [x] 1. Implement TypoScanner with text chunking strategy
  - [x] 1.1 Create the text chunking utility
    - Create `backend/app/services/quality_controller/__init__.py`
    - Create `backend/app/services/quality_controller/scanner.py`
    - Implement `chunk_text(text, chunk_size=2000, overlap=100)` function
    - Split text on word boundaries into ~2000-word chunks
    - Track character start/end positions for each chunk
    - Overlap 100 words between consecutive chunks to catch boundary typos
    - Return list of `{"text": str, "start_position": int, "end_position": int, "word_offset": int}`
    - _Requirements: 1.1, 1.3_

  - [x] 1.2 Implement AI response parsing and deduplication
    - Implement `parse_ai_response(response, chunk_start_position)` in scanner.py
    - Parse JSON array from AI Engine response
    - Convert `position_in_chunk` to absolute character position using chunk_start_position
    - Handle malformed JSON gracefully (return empty list, log warning)
    - Implement `deduplicate_corrections(corrections)` to merge duplicates from overlapping regions
    - Two corrections are duplicates if same original text and positions within overlap distance
    - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Write the typo detection system prompt (strict constraints)
  - [x] 2.1 Create the system prompt constant
    - Create `backend/app/services/quality_controller/prompts.py`
    - Define `TYPO_DETECTION_SYSTEM_PROMPT` with explicit IS/IS-NOT typo categories
    - IS a typo: misspellings, transposed characters, repeated words, missing/extra spaces within words
    - IS NOT a typo: archaic spellings, regional variants, dialect, grammar, style, word choice, punctuation style, proper nouns
    - Include concrete examples for each category
    - Specify JSON response format with original, suggested, context, position_in_chunk fields
    - Include rule: "When in doubt, DO NOT report it"
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 2.2 Implement the build_system_prompt helper
    - Implement `build_system_prompt()` function that returns the system prompt
    - Implement `build_user_prompt(chunk_text)` that wraps the chunk with scanning instructions
    - User prompt should instruct: "Scan the following text for typos only. Return JSON array."
    - _Requirements: 2.5_

- [x] 3. Implement scan-typos Celery task
  - [x] 3.1 Implement the scan_typos_task Celery task
    - Register task as `quality_controller.scan_typos` in Celery
    - Load project from database, verify ownership and original_text_path exists
    - Read the full text from original_text_path
    - Chunk the text using chunk_text()
    - For each chunk: call AI Engine with system prompt + user prompt containing chunk text
    - Parse each AI response with parse_ai_response()
    - Report progress via `self.update_state(state='PROGRESS', meta={...})`
    - After all chunks: deduplicate corrections
    - Store all corrections in database with status=PENDING
    - Return `{"corrections_found": int, "chunks_processed": int}`
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 3.2 Add retry logic and error handling for AI Engine calls
    - Retry each chunk up to 2 times on AI Engine timeout or error
    - If a chunk fails after retries, log warning and skip (don't fail entire scan)
    - If all chunks fail, mark task as FAILURE with error details
    - Handle AI Engine returning empty results (valid — means no typos in chunk)
    - Set task soft_time_limit to 300s and hard_time_limit to 600s
    - _Requirements: 1.4, 1.5_

- [x] 4. Implement corrections list endpoint
  - [x] 4.1 Create the CorrectionReview service
    - Create `backend/app/services/quality_controller/review.py`
    - Implement `CorrectionReviewService.list_corrections(project_id, user_id, status=None)`
    - Query corrections table filtered by project_id, optionally by status
    - Verify project belongs to user (join with book_projects on user_id)
    - Order results by position ascending
    - _Requirements: 3.1, 3.5_

  - [x] 4.2 Create the GET /corrections API endpoint
    - Create `backend/app/routers/quality_controller.py` with router prefix `/api/projects/{project_id}`
    - Implement `GET /corrections` endpoint with optional `status` query parameter
    - Return list of CorrectionOut schema objects
    - Register router in main FastAPI app
    - _Requirements: 3.1, 3.5_

- [x] 5. Implement accept/reject endpoint (individual + bulk)
  - [x] 5.1 Implement individual correction status updates
    - Add `update_correction(correction_id, user_id, status)` to CorrectionReviewService
    - Validate correction exists and belongs to user's project
    - Update status to ACCEPTED or REJECTED
    - _Requirements: 3.1, 3.4_

  - [x] 5.2 Implement bulk accept-all and reject-all
    - Add `bulk_update(project_id, user_id, status)` to CorrectionReviewService
    - Update all PENDING corrections for the project to the given status
    - Return count of updated corrections
    - _Requirements: 3.2, 3.3_

  - [x] 5.3 Create the PATCH /corrections API endpoint
    - Implement `PATCH /corrections` endpoint accepting CorrectionUpdateRequest body
    - Support individual updates: `{"corrections": [{"id": ..., "status": ...}]}`
    - Support bulk actions: `{"bulk_action": "accept_all" | "reject_all"}`
    - Validate request has either corrections list or bulk_action (not both, not neither)
    - Return `{"updated": int}`
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 6. Implement apply corrections endpoint (creates working_text_path)
  - [x] 6.1 Create the CorrectionApplier service
    - Create `backend/app/services/quality_controller/applier.py`
    - Implement `apply_corrections(project_id, user_id)`
    - Load original text from project.original_text_path
    - Fetch all ACCEPTED corrections ordered by position DESC (reverse order)
    - Apply each correction: validate text at position matches original, then replace
    - If position mismatch: skip correction, increment skipped count, log warning
    - Write result to working_text_path (new file path based on project_id)
    - Update project.working_text_path in database
    - If no accepted corrections exist: set working_text_path = original_text_path
    - Return `{"applied": int, "skipped": int, "working_text_path": str}`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 4.1, 4.2_

  - [x] 6.2 Create the POST /corrections/apply API endpoint
    - Implement `POST /corrections/apply` endpoint
    - Call CorrectionApplierService.apply_corrections()
    - Return ApplyResponse schema
    - Handle file I/O errors with appropriate error responses
    - _Requirements: 5.1, 5.2_

- [x] 7. Add skip logic for high-quality sources
  - [x] 7.1 Implement source quality detection
    - Add utility function `should_skip_typo_scan(project: BookProject) -> bool`
    - Return True if project.source_type == SourceType.STANDARD_EBOOKS
    - This is used by the frontend/workflow to determine default state of the typo step
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 7.2 Add skip-check to scan endpoint
    - In the POST /scan-typos endpoint, include a response field `skip_recommended: bool`
    - The endpoint still allows scanning even if skip is recommended (user override)
    - Add GET `/api/projects/{project_id}/typo-scan-status` endpoint that returns scan recommendation and current state
    - _Requirements: 6.1, 6.2, 7.1, 7.2_

- [x] 8. Write unit tests for chunking and correction application
  - [x] 8.1 Write unit tests for chunk_text
    - Create `backend/tests/test_quality_controller/test_scanner.py`
    - Test: short text (< chunk_size) produces single chunk
    - Test: long text produces multiple chunks with correct overlap
    - Test: chunk positions cover entire text without gaps
    - Test: chunk boundaries fall on word boundaries (no split words)
    - Test: empty text returns empty list
    - Test: text with only whitespace handled gracefully
    - _Requirements: 1.1, 1.3_

  - [x] 8.2 Write unit tests for parse_ai_response and deduplication
    - Create tests for parse_ai_response:
      - Valid JSON array with corrections
      - Empty JSON array (no typos)
      - Malformed JSON returns empty list
      - Position offset correctly applied
    - Create tests for deduplicate_corrections:
      - No duplicates: all corrections preserved
      - Exact duplicates removed
      - Near-position duplicates (within overlap) merged
      - Different original text at same position: both kept
    - _Requirements: 1.1, 1.2_

  - [x] 8.3 Write unit tests for CorrectionApplier
    - Create `backend/tests/test_quality_controller/test_applier.py`
    - Test: single correction applied correctly
    - Test: multiple corrections applied in reverse order
    - Test: position mismatch skips correction without failing
    - Test: no accepted corrections sets working_text_path to original
    - Test: original file is never modified (read original after apply, verify unchanged)
    - Test: idempotent — applying twice produces same result
    - _Requirements: 5.1, 5.3, 5.4, 4.1, 4.2_

- [x] 9. Write integration tests for the full scan → review → apply flow
  - [x] 9.1 Write integration test for scan flow
    - Create `backend/tests/test_quality_controller/test_integration.py`
    - Test: POST /scan-typos returns 202 with task_id
    - Test: scan task creates corrections in database
    - Test: GET /corrections returns all created corrections
    - Test: re-scan clears old corrections and creates new ones
    - Mock AI Engine to return predictable typo responses
    - _Requirements: 1.1, 1.2, 1.4, 4.4_

  - [x] 9.2 Write integration test for review flow
    - Test: PATCH with individual corrections updates their status
    - Test: PATCH with bulk_action "accept_all" updates all pending to accepted
    - Test: PATCH with bulk_action "reject_all" updates all pending to rejected
    - Test: GET /corrections?status=accepted returns only accepted
    - Test: cannot update corrections for another user's project (403)
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 9.3 Write integration test for apply flow
    - Test: POST /corrections/apply creates working_text_path with corrections applied
    - Test: original_text_path file unchanged after apply
    - Test: applied corrections match expected text modifications
    - Test: skipped corrections (position mismatch) reported in response
    - Test: apply with no accepted corrections sets working_text_path = original_text_path
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 4.1, 4.2, 4.3_

  - [x] 9.4 Write integration test for skip logic
    - Test: project with source_type=STANDARD_EBOOKS returns skip_recommended=true
    - Test: project with source_type=GUTENBERG returns skip_recommended=false
    - Test: scan still works for high-quality sources when user overrides
    - _Requirements: 6.1, 6.2, 6.3, 7.1, 7.2_

## Notes

- The AI Engine integration uses the existing AIRouter service from the ai-engine module
- The Correction model already exists in `backend/app/models/correction.py`
- All endpoints require authentication via the existing auth middleware
- The working_text_path file is stored alongside the original in the project's storage directory
- Celery task autodiscovery is already configured to find tasks in `app.services`

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1"] },
    { "id": 1, "tasks": ["1.2", "2.2"] },
    { "id": 2, "tasks": ["3.1"] },
    { "id": 3, "tasks": ["3.2", "4.1"] },
    { "id": 4, "tasks": ["4.2", "5.1"] },
    { "id": 5, "tasks": ["5.2", "5.3"] },
    { "id": 6, "tasks": ["6.1"] },
    { "id": 7, "tasks": ["6.2", "7.1"] },
    { "id": 8, "tasks": ["7.2"] },
    { "id": 9, "tasks": ["8.1", "8.2", "8.3"] },
    { "id": 10, "tasks": ["9.1", "9.2", "9.3", "9.4"] }
  ]
}
```
