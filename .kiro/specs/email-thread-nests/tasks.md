# Implementation Plan: Email Thread Nests

## Overview

This plan implements the ability to attach any non-email chit to an existing email thread via a `nest_thread_id` field. The implementation proceeds from backend data model changes through API endpoints to frontend UI components, with property-based tests validating correctness properties throughout.

## Tasks

- [ ] 1. Add nest_thread_id column and model update
  - [ ] 1.1 Add migration function `migrate_add_nest_thread_id()` in `src/backend/migrations.py`
    - Follow existing column-existence-check pattern
    - Add `nest_thread_id TEXT DEFAULT NULL` to chits table
    - Register the migration call in `src/backend/main.py` startup sequence
    - _Requirements: 1.1, 1.2_

  - [ ] 1.2 Add `nest_thread_id` field to Chit model in `src/backend/models.py`
    - Add `nest_thread_id: Optional[str] = None` to the Chit class
    - _Requirements: 1.3_

  - [ ] 1.3 Write property test for nest reference validation (Property 1)
    - **Property 1: Nest Reference Validation**
    - For any chit saved with a non-null nest_thread_id, the save succeeds iff the referenced ID corresponds to an existing email chit
    - Test in `src/backend/test_email_nests.py`
    - **Validates: Requirements 1.4**

  - [ ] 1.4 Write property test for subject label truncation (Property 3)
    - **Property 3: Subject Label Truncation**
    - For any string, the displayed text is the first 15 characters if length > 15, or the full string otherwise; result never exceeds 15 characters
    - Test in `src/backend/test_email_nests.py`
    - **Validates: Requirements 2.5, 2.6**

- [ ] 2. Implement nest validation and cascade cleanup in chit CRUD
  - [ ] 2.1 Add nest_thread_id validation to PUT/POST in `src/backend/routes/chits.py`
    - On save, if nest_thread_id is non-null: query referenced chit, verify it exists and is an email chit (email_message_id IS NOT NULL OR email_status IS NOT NULL)
    - If invalid, return 422 with descriptive error message
    - Reject nest_thread_id on email chits themselves (return 422)
    - _Requirements: 1.4, 7.2_

  - [ ] 2.2 Add cascade cleanup on email chit permanent deletion in `src/backend/routes/trash.py`
    - When an email chit is permanently deleted, execute: `UPDATE chits SET nest_thread_id = NULL WHERE nest_thread_id = ?`
    - _Requirements: 1.5_

  - [ ] 2.3 Write property test for cascade cleanup on delete (Property 2)
    - **Property 2: Cascade Cleanup on Delete**
    - For any email chit permanently deleted, all chits referencing it have nest_thread_id set to NULL; no other chits affected
    - Test in `src/backend/test_email_nests.py`
    - **Validates: Requirements 1.5**

  - [ ] 2.4 Write property test for API round-trip (Property 10)
    - **Property 10: Nest Thread ID API Round-Trip**
    - Saving a valid nest_thread_id and retrieving the chit returns the same value; setting to null results in null on retrieval
    - Test in `src/backend/test_email_nests.py`
    - **Validates: Requirements 7.1, 7.2**

- [ ] 3. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Implement recent threads endpoint and extend thread endpoint
  - [ ] 4.1 Add `GET /api/email/threads/recent` endpoint in `src/backend/routes/email.py`
    - Return 20 most recent email threads (subject, latest_date, message_count, thread_id)
    - Use existing `_strip_email_prefixes()` normalization to group by subject
    - Accept optional `q` query parameter for case-insensitive substring filter on subject
    - Sort by latest email_date descending
    - _Requirements: 7.4, 7.5_

  - [ ] 4.2 Extend `GET /api/email/thread/{chit_id}` to include nested chits
    - After finding thread members, query chits where nest_thread_id IN (thread_member_ids) AND (deleted = 0 OR deleted IS NULL)
    - Add `is_nest: true` flag to each nested chit in response
    - Include id, title, note (first 100 chars), status, due_datetime, start_datetime, is_nest
    - _Requirements: 7.3_

  - [ ] 4.3 Write property test for thread search filtering (Property 5)
    - **Property 5: Thread Search Filtering**
    - Filtered results contain exactly those threads whose subject contains the query as a case-insensitive substring
    - Test in `src/backend/test_email_nests.py`
    - **Validates: Requirements 3.3, 7.5**

  - [ ] 4.4 Write property test for thread endpoint includes nests (Property 11)
    - **Property 11: Thread Endpoint Includes Nests**
    - Response includes all non-deleted chits whose nest_thread_id references any chit in the thread, each with is_nest=true
    - Test in `src/backend/test_email_nests.py`
    - **Validates: Requirements 7.3**

- [ ] 5. Implement nest button and thread picker frontend
  - [ ] 5.1 Create `src/frontend/js/editor/editor-nest.js` with nest button logic
    - Implement `initNestButton(chit)` — set up button state based on chit.nest_thread_id
    - Implement `_nestButtonClick()` — toggle: if active remove nest, if inactive open picker
    - Implement `_nestOpenPicker()` — fetch GET /api/email/threads/recent, render modal
    - Implement `_nestSelectThread(threadId, subject)` — set nest_thread_id, update button, mark dirty
    - Implement `_nestRemove()` — clear nest_thread_id, update button, mark dirty
    - Implement `_nestTruncateSubject(subject)` — return first 15 chars or full if shorter
    - Implement `_nestIsEmailChit(chit)` — return true if chit has email_message_id or email_status
    - Implement `getNestData()` — return current nest_thread_id for save
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 3.1, 4.1, 4.2, 4.3_

  - [ ] 5.2 Add nest button HTML and thread picker template to `src/frontend/html/editor.html`
    - Add nest button in `pinned-archived-group` div after owner chip, before email button
    - Add hidden input for nestThreadId
    - Add `<template id="tmpl-nest-thread-picker">` with modal structure (search input, scrollable list, cancel button)
    - Add `<script>` tag for editor-nest.js in correct load order
    - _Requirements: 2.1, 3.1, 3.2, 3.4, 3.6, 3.7_

  - [ ] 5.3 Integrate nest button with editor save flow in `src/frontend/js/editor/editor-save.js`
    - Include `getNestData()` result in the save payload
    - Ensure nest_thread_id is sent on PUT /api/chits/{id}
    - _Requirements: 4.3, 7.2_

  - [ ] 5.4 Write property test for nest button visibility (Property 4)
    - **Property 4: Nest Button Visibility**
    - Button hidden iff chit has non-null email_message_id or email_status; visible for all other chits
    - Test in `src/backend/test_email_nests.py`
    - **Validates: Requirements 2.7**

- [ ] 6. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Implement nest injection in email thread view
  - [ ] 7.1 Add nest injection logic to `src/frontend/js/dashboard/main-email.js`
    - Implement `_emailInjectNests(threads)` — filter chits with non-null nest_thread_id, inject into matching threads
    - Call after `_emailGroupByThread()` completes
    - Sort nested chits within thread: due_date ascending → start_datetime ascending → position after top email
    - Mark injected chits with `_isNest = true` flag
    - Ensure nested chits never appear as topmost card of collapsed thread
    - Ensure nested chits never appear independently in email inbox list
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [ ] 7.2 Implement `_buildNestedChitCard(chit)` in `src/frontend/js/dashboard/main-email.js`
    - Render card with nest icon, chit title, content preview (first line of note or checklist summary or status)
    - Use same card structure as email cards but with nest-specific indicators
    - Click navigates to editor
    - Include nest icon (fa-dove or similar) to distinguish from email cards
    - _Requirements: 5.5, 5.6, 5.7, 5.8_

  - [ ] 7.3 Modify `_buildThreadedEmailCard()` and `_toggleThreadExpand()` in `main-email.js`
    - Thread count badge includes nested chits in total
    - Top card selection always picks an email chit (never a nested chit)
    - When rendering expanded thread, check `_isNest` flag and use `_buildNestedChitCard()` for nested items
    - _Requirements: 5.3, 5.9_

  - [ ] 7.4 Write property test for nested chit thread membership (Property 6)
    - **Property 6: Nested Chit Thread Membership**
    - Expanded view includes exactly those non-email chits whose nest_thread_id matches any chit in the thread
    - Test in `src/backend/test_email_nests.py`
    - **Validates: Requirements 5.1, 6.1**

  - [ ] 7.5 Write property test for nested chit sort order (Property 7)
    - **Property 7: Nested Chit Sort Order**
    - Chits with due_date sort by due_date ascending, then start_datetime ascending, then after top email; stable within groups
    - Test in `src/backend/test_email_nests.py`
    - **Validates: Requirements 5.2**

  - [ ] 7.6 Write property test for top card invariant (Property 8)
    - **Property 8: Top Card Invariant**
    - Topmost visible card of collapsed thread is always an email chit; nested chit never selected as top card
    - Test in `src/backend/test_email_nests.py`
    - **Validates: Requirements 5.3**

  - [ ] 7.7 Write property test for inbox exclusion invariant (Property 9)
    - **Property 9: Inbox Exclusion Invariant**
    - No chit with non-null nest_thread_id appears as independent entry in email inbox list
    - Test in `src/backend/test_email_nests.py`
    - **Validates: Requirements 5.4**

- [ ] 8. Implement nest injection in editor thread display
  - [ ] 8.1 Update editor email zone thread display to render nested chits
    - The backend endpoint already returns nested chits with `is_nest: true`
    - Render items with `is_nest: true` using nested chit card pattern (nest icon, title, preview)
    - Click navigates to that chit's editor page
    - _Requirements: 6.1, 6.2, 6.3_

- [ ] 9. Add CSS for nest button, picker modal, and nested chit cards
  - [ ] 9.1 Create `src/frontend/css/editor/editor-nest.css`
    - Style `.nest-button-label` — smaller font, ellipsis overflow, max-width
    - Style `.nest-button-active` — blue color matching pinned button active state
    - Style `.nest-thread-picker-modal` — parchment modal (background #fffaf0, border #6b4e31, Lora font)
    - Style `.nest-picker-search` — search input styling
    - Style `.nest-picker-list` — scrollable list with max-height
    - Style `.nest-picker-item` — individual thread entry (44px min height for touch targets)
    - Style `.email-nest-card` — nested chit card in thread view (subtle left border tint)
    - Style `.email-nest-icon` — nest icon styling
    - Ensure mobile-friendly with 44px minimum tap targets
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [ ] 9.2 Link `editor-nest.css` in `src/frontend/html/editor.html`
    - Add `<link>` tag for the new stylesheet
    - _Requirements: 8.1_

- [ ] 10. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Update INDEX.md, VERSION, and release notes
  - [ ] 11.1 Update `src/INDEX.md` with all new functions, endpoints, and files
    - Add migration function, new endpoint, modified endpoints
    - Add new frontend files (editor-nest.js, editor-nest.css)
    - Add new functions in main-email.js
    - Document template additions in editor.html

  - [ ] 11.2 Update `src/VERSION` with current timestamp
    - Run `date "+%Y%m%d.%H%M"` and use the returned value

  - [ ] 11.3 Create release notes file
    - Create `documents/release_notes/cwoc_release_[version].md`
    - Brief summary of the email thread nests feature

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- DO NOT install any software (no pip, no npm) — only write code
- Tests use hypothesis but do not require installing it
- VERSION update happens only once at the very end
