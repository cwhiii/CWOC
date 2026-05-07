# Implementation Plan: Email Bundles

## Overview

This plan implements Google Inbox-style bundle categorization for CWOC's Email tab. The implementation proceeds in layers: database migration → Pydantic models → API routes → classification engine → frontend toolbar/tabs → modal/context menu → settings → tests → final wiring and version update.

## Tasks

- [ ] 1. Database migration and Pydantic models
  - [-] 1.1 Add `migrate_create_bundles_tables()` to `src/backend/migrations.py`
    - Create `bundles` table with columns: id, owner_id, name, description, display_order, is_default, removable, created_datetime, modified_datetime
    - Create `bundle_rules` junction table with columns: id, bundle_id, rule_id, owner_id, created_datetime
    - Add `bundles_multi_placement` BOOLEAN DEFAULT 0 column to `settings` table (with column-existence check)
    - Follow existing migration pattern: `CREATE TABLE IF NOT EXISTS`, `PRAGMA table_info` checks
    - _Requirements: 1.1, 1.2, 1.4, 1.5, 12.4_

  - [~] 1.2 Register migration call in `src/backend/main.py`
    - Import and call `migrate_create_bundles_tables()` alongside existing migration calls at startup
    - _Requirements: 1.2_

  - [~] 1.3 Add Pydantic models to `src/backend/models.py`
    - Add `BundleCreate(BaseModel)` with fields: name (str), description (Optional[str])
    - Add `BundleUpdate(BaseModel)` with fields: name (Optional[str]), description (Optional[str])
    - Add `BundleReorder(BaseModel)` with field: bundle_ids (List[str])
    - Add `BundleRuleAssociate(BaseModel)` with field: rule_id (str)
    - _Requirements: 8.2, 8.3, 8.5, 8.6_

- [ ] 2. Bundle CRUD API routes
  - [~] 2.1 Create `src/backend/routes/bundles.py` with GET `/api/bundles` endpoint
    - Authenticate via `get_actor_from_request(request)`
    - Query all bundles for owner_id sorted by display_order ASC
    - Include associated rule_ids for each bundle in the response
    - Include `bundles_multi_placement` setting in response
    - If no bundles exist, call `_initialize_default_bundles(owner_id)` before returning
    - _Requirements: 8.1, 2.1, 12.7_

  - [~] 2.2 Add POST `/api/bundles` endpoint for bundle creation
    - Validate name is non-empty and not a duplicate (case-insensitive) for the owner
    - Generate UUID, set owner_id from auth, set timestamps
    - Return 400 for duplicate name, 422 for empty name
    - _Requirements: 8.2, 6.4_

  - [~] 2.3 Add PUT `/api/bundles/{bundle_id}` endpoint for bundle update
    - Verify bundle exists and is owned by authenticated user (404 if not)
    - If name is changed, call `_rename_bundle_tags()` to migrate tags on all affected chits
    - Update the associated rule's action params to use the new tag name
    - _Requirements: 8.3, 3.6, 7.7_

  - [~] 2.4 Add DELETE `/api/bundles/{bundle_id}` endpoint for bundle deletion
    - Return 404 if bundle not found or not owned by user
    - Return 403 if bundle has `removable=false`
    - Remove `CWOC_System/Bundle/{name}` tag from all chits
    - Delete associated `bundle_rules` records and the rules themselves
    - Delete the bundle record
    - _Requirements: 8.4, 8.8, 8.9, 3.7, 7.5_

  - [~] 2.5 Add PUT `/api/bundles/reorder` endpoint
    - Accept ordered list of bundle IDs
    - Validate all IDs belong to the authenticated user (400 if any invalid)
    - Update display_order: first ID gets 0, second gets 1, etc.
    - _Requirements: 8.5, 7.6_

  - [~] 2.6 Add POST `/api/bundles/{bundle_id}/rules` and DELETE `/api/bundles/{bundle_id}/rules/{rule_id}` endpoints
    - POST: Associate an existing rule with a bundle (verify both exist and are owned by user)
    - DELETE: Remove a rule association from a bundle
    - _Requirements: 8.6, 8.7_

  - [~] 2.7 Implement `_initialize_default_bundles(owner_id)` helper
    - Create "From Contacts" bundle (display_order=0, is_default=True, removable=True, description="Emails from people in your contacts list")
    - Create "Everything Else" bundle (display_order=1, is_default=True, removable=False, description="Emails not matched by any other bundle")
    - Create the "From Contacts" rule with trigger_type "email_received", condition `contains_contact_email`, action `add_tag` with tag `CWOC_System/Bundle/From Contacts`
    - Associate the rule with the "From Contacts" bundle in `bundle_rules`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [~] 2.8 Register bundles router in `src/backend/main.py`
    - Import `bundles_router` from `src.backend.routes.bundles`
    - Call `app.include_router(bundles_router)`
    - _Requirements: 8.1_

- [ ] 3. Bundle classification engine
  - [~] 3.1 Implement `classify_email_into_bundle()` (single-placement) in `src/backend/routes/bundles.py`
    - Load bundles sorted by display_order ASC
    - For each bundle (skip "Everything Else"), load its rules via `bundle_rules`
    - Evaluate each enabled rule's condition tree against the email chit
    - On first match: add `CWOC_System/Bundle/{name}` tag to chit and return (stop evaluating)
    - If no match: email falls into "Everything Else" (no tag needed)
    - _Requirements: 3.1, 3.4, 12.2_

  - [~] 3.2 Implement `classify_email_into_bundles()` (multi-placement) in `src/backend/routes/bundles.py`
    - Load bundles sorted by display_order ASC
    - For each bundle (skip "Everything Else"), load its rules
    - Evaluate rules — on first match within a bundle, add that bundle's tag and move to next bundle
    - Continue evaluating ALL bundles (don't stop at first match)
    - _Requirements: 3.3, 12.3_

  - [~] 3.3 Integrate classification into email sync flow in `src/backend/routes/email.py`
    - After creating a new email chit during sync, read `bundles_multi_placement` setting
    - Call `classify_email_into_bundle()` or `classify_email_into_bundles()` based on setting
    - Ensure non-bundle "email_received" rules still fire via normal dispatch
    - _Requirements: 3.1, 12.2, 12.3, 12.6_

- [ ] 4. Checkpoint
  - Ensure all backend tests pass, ask the user if questions arise.

- [ ] 5. Frontend — Bundle toolbar and tab rendering
  - [~] 5.1 Create `src/frontend/css/dashboard/styles-email-bundles.css`
    - Style the permanent two-row toolbar (Row 1: bulk actions, Row 2: bundle tabs)
    - Use CSS variables from `styles-variables.css` for colors, borders, shadows
    - Style greyed-out vs active bulk action controls (muted brown → darker brown)
    - Style bundle tabs: tab-bar with active tab darker parchment + bottom border accent
    - Style "+" button as subtle circular button matching tab height
    - Style unread count badges as small circular indicators
    - Add subtle bottom border/shadow separating toolbar from email list
    - Add mobile-responsive rules (horizontal scroll for tabs, wrapping for controls)
    - Style dimmed state (opacity 0.4) for tabs when sub-filter is not "inbox"
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 4.6, 4.7, 5.7_

  - [~] 5.2 Create `src/frontend/js/dashboard/main-email-bundles.js`
    - Implement `_renderBundleToolbar()` to build the permanent two-row toolbar
    - Row 1: Select All checkbox, Archive button, Tag button, Mark Read/Unread button, selected count
    - Row 2: Bundle tabs from API data, "+" button at end
    - Implement `_renderBundleTabs(bundles, emailChits)` for tab rendering with unread counts
    - Implement `_filterByBundle(chits, activeBundle)` — filter by bundle tag or "Everything Else" (no bundle tag)
    - Implement `_getBundleUnreadCount(bundleName, emailChits)` for badge counts
    - Store active bundle in `_emailActiveBundle`, persist to `localStorage` key `cwoc_email_active_bundle`
    - Reset active bundle to null when sub-filter changes away from "inbox"
    - Dim tabs (non-interactive) when sub-filter is not "inbox"
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 5.4, 5.5, 5.7, 5.8, 9.1, 9.2, 9.3, 9.4, 9.5_

  - [~] 5.3 Integrate bundle toolbar into `src/frontend/js/dashboard/main-email.js`
    - Replace the current dynamic `#emailBulkBar` with the permanent bundle toolbar
    - Call `_renderBundleToolbar()` in `displayEmailView()`
    - Apply `_filterByBundle()` after existing sub-filter logic
    - Fetch bundles from `GET /api/bundles` on Email tab load
    - Load CSS file in `index.html`
    - Load `main-email-bundles.js` script in `index.html` after `main-email.js`
    - _Requirements: 4.1, 5.1, 9.1_

- [ ] 6. Frontend — Bundle creation modal
  - [~] 6.1 Implement bundle modal in `src/frontend/js/dashboard/main-email-bundles.js`
    - Add `<template id="tmpl-bundle-modal">` to `index.html` with name input, description textarea, Cancel and Define Rule buttons
    - Implement `_openBundleModal(editBundle)` — opens modal, pre-populates if editing
    - Validate name is non-empty and not duplicate before allowing creation
    - On "Define Rule" click: POST to `/api/bundles`, then navigate to Rule Editor with `?trigger=email_received&bundle_id={id}&return=/frontend/html/index.html#Email`
    - Implement ESC key handling following CWOC ESC priority chain (modal closes before page-level)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.7_

- [ ] 7. Frontend — Context menu for bundle management
  - [~] 7.1 Implement bundle context menu in `src/frontend/js/dashboard/main-email-bundles.js`
    - Show context menu on right-click (desktop) or long-press (mobile) on a bundle tab
    - Menu options: Edit, Reorder, Delete
    - "Everything Else" tab: show only Edit (for description), no Delete option
    - Edit: open bundle modal pre-populated with current name/description
    - Delete: show confirmation via `cwocConfirm()`, then call `DELETE /api/bundles/{id}`
    - Reorder: enable drag-and-drop on bundle tabs (using `shared-sort.js` pattern), persist via PUT `/api/bundles/reorder`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [~] 7.2 Add bundle modal and context menu CSS to `styles-email-bundles.css`
    - Style context menu (parchment background, brown border, Lora font)
    - Style modal following CWOC modal pattern (centered overlay, `#fffaf0` background, `#6b4e31` border)
    - _Requirements: 6.1, 11.1_

- [ ] 8. Settings page — Multi-placement toggle
  - [~] 8.1 Add multi-placement toggle to settings page
    - Add HTML toggle in the Email section of `src/frontend/html/settings.html`
    - Label: "Allow Multi-Placement" with checkbox input `#bundlesMultiPlacement`
    - Add hint text: "When enabled, emails can appear in multiple bundles. When disabled, each email goes to the first matching bundle (left to right)."
    - Wire into existing `CwocSaveSystem` dirty-state tracking in `src/frontend/js/pages/settings.js`
    - Load value from `GET /api/settings/default_user` on page init
    - Save value via existing `POST /api/settings` flow
    - _Requirements: 12.1, 12.4, 12.5_

  - [~] 8.2 Ensure `bundles_multi_placement` is included in settings API responses
    - Verify `GET /api/settings/default_user` returns the new field
    - Verify `POST /api/settings` accepts and persists the new field
    - _Requirements: 12.4, 12.7_

- [ ] 9. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Property-based tests
  - [~] 10.1 Write property test for Bundle CRUD Round-Trip
    - **Property 1: Bundle CRUD Round-Trip**
    - Create bundle → read back → verify same name, description, owner_id, valid UUID
    - Update name/description → read back → verify updated values
    - **Validates: Requirements 1.1, 8.2, 8.3**

  - [~] 10.2 Write property test for Owner Scoping Isolation
    - **Property 2: Owner Scoping Isolation**
    - Two distinct users, bundle owned by user B never returned for user A queries
    - Read/update/delete of user B's bundle by user A returns 404
    - **Validates: Requirements 1.3, 8.8**

  - [~] 10.3 Write property test for Bundle Rename Tag Migration
    - **Property 3: Bundle Rename Tag Migration**
    - Rename bundle N→M, all chits with old tag get new tag, none retain old tag
    - Count of chits with new tag equals count that previously had old tag
    - **Validates: Requirements 3.5, 7.7**

  - [~] 10.4 Write property test for Bundle Delete Tag Cleanup
    - **Property 4: Bundle Delete Tag Cleanup**
    - Delete bundle, zero chits carry that tag, bundle_rules deleted, associated rules deleted
    - **Validates: Requirements 3.6, 7.5**

  - [~] 10.5 Write property test for Bundle List Sort Order
    - **Property 5: Bundle List Sort Order**
    - GET /api/bundles returns bundles sorted by display_order ascending
    - **Validates: Requirements 5.1, 8.1**

  - [~] 10.6 Write property test for Bundle Filtering Correctness
    - **Property 6: Bundle Filtering Correctness**
    - Named bundle filter returns exactly chits with that bundle tag
    - "Everything Else" returns exactly chits with no CWOC_System/Bundle/ prefix tag
    - Union of all bundle views equals complete inbox set (multi-placement); disjoint sets (single-placement)
    - **Validates: Requirements 5.2, 5.3, 9.1, 9.2**

  - [~] 10.7 Write property test for Unread Count Computation
    - **Property 7: Unread Count Computation**
    - Unread count for bundle B = chits in bundle B with email_read=false
    - Single-placement: sum of all unread counts = total unread inbox emails
    - Multi-placement: sum may exceed total (one email counted in multiple bundles)
    - **Validates: Requirements 5.8, 9.6**

  - [~] 10.8 Write property test for Bundle Name Validation
    - **Property 8: Bundle Name Validation**
    - Empty/whitespace-only strings rejected
    - Duplicate names (case-insensitive) for same owner rejected
    - Non-empty, non-duplicate strings accepted
    - **Validates: Requirements 6.4**

  - [~] 10.9 Write property test for Bundle Reorder Persistence
    - **Property 9: Bundle Reorder Persistence**
    - Submit ordered list of IDs → display_order reflects submitted order (0, 1, 2, ...)
    - Subsequent GET returns bundles in new order
    - **Validates: Requirements 7.6, 8.5**

  - [~] 10.10 Write property test for Bundle Filter Composes with Sub-Filter
    - **Property 10: Bundle Filter Composes with Sub-Filter**
    - Non-inbox sub-filter: bundle filter has no effect, all matching emails returned
    - Bundle filtering only applies when sub-filter is "inbox"
    - **Validates: Requirements 9.3**

  - [~] 10.11 Write property test for Single-Placement Priority Ordering
    - **Property 11: Single-Placement Priority Ordering**
    - Email matches bundles at positions P1 and P2 (P1 < P2), single-placement assigns only P1's tag
    - Email does NOT receive P2's tag or any lower-priority bundle tag
    - **Validates: Requirements 12.2**

  - [~] 10.12 Write property test for Multi-Placement Completeness
    - **Property 12: Multi-Placement Completeness**
    - Email matches bundles B1..Bn, multi-placement assigns tags for ALL matching bundles
    - Number of bundle tags on email equals number of matching bundles
    - **Validates: Requirements 12.3**

- [ ] 11. Unit tests for bundle API and classification
  - [~] 11.1 Write unit tests in `src/backend/test_email_bundles.py`
    - Test default bundle initialization (two bundles with correct properties)
    - Test "From Contacts" rule structure (correct trigger_type, condition, action)
    - Test delete non-removable bundle returns 403
    - Test bundle rule association and removal (POST/DELETE on bundle_rules)
    - Test migration is idempotent (running twice doesn't fail)
    - Test bundle name validation (empty, duplicate, valid)
    - Test single-placement classification (first match wins)
    - Test multi-placement classification (all matches assigned)
    - Test rename tag migration on chits
    - Test delete tag cleanup on chits
    - _Requirements: 2.1–2.6, 3.1–3.7, 8.6, 8.7, 8.9_

- [ ] 12. Final wiring and version update
  - [~] 12.1 Update `src/INDEX.md` with all new functions, routes, files, and CSS sections
    - Add entries for `routes/bundles.py` (all endpoints and helpers)
    - Add entries for `main-email-bundles.js` (all functions)
    - Add entries for `styles-email-bundles.css` (all sections)
    - Add entries for new Pydantic models in `models.py`
    - Add entry for `migrate_create_bundles_tables()` in `migrations.py`

  - [~] 12.2 Update `src/VERSION` with current timestamp
    - Run `date "+%Y%m%d.%H%M"` and use the returned value
    - Only do this once at the very end

  - [~] 12.3 Create release notes file
    - Create `documents/release_notes/cwoc_release_{version}.md`
    - Brief summary of the Email Bundles feature addition

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- DO NOT install any software (no pip, no npm, no venv) — only write code
- Tests use hypothesis but do not require installing it (already available in test environment)
- Version update happens only once at the very end (task 12.2)
