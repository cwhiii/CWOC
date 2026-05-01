# Implementation Plan: Sharing Overhaul

## Overview

Comprehensive overhaul of the CWOC chit sharing system. Replaces the generic share action with two explicit paths (Invite and Assign), expands manager permissions, introduces a notification system with inbox UI, enhances tag sharing with sub-tag propagation and per-user view/manage toggles, adds dashboard sharing filters, and adds a People zone expand modal. All changes are additive — existing data structures are extended, not replaced.

Implementation proceeds backend-first (permission engine → migrations → routes → notifications), then frontend (editor changes → dashboard inbox → sidebar filters → tag settings → people modal), finishing with integration wiring, INDEX/VERSION updates, and release notes.

## Tasks

- [x] 1. Backend permission engine changes (`sharing.py`)
  - [x] 1.1 Update `resolve_effective_role()` assignment floor from "viewer" to "manager"
    - Change step 5 in `resolve_effective_role()`: `_higher_role(best_role, "manager")` instead of `"viewer"`
    - _Requirements: 10.1, 10.4_
  - [x] 1.2 Update `can_delete_chit()` to allow managers to soft-delete
    - Add `owner_settings` parameter, resolve effective role, return true for managers
    - _Requirements: 3.4, 9.3_
  - [ ]* 1.3 Write property test: Assignment grants manager floor role (Property 17)
    - **Property 17: Assignment grants manager floor role**
    - **Validates: Requirements 10.1, 10.4**
    - Test in `src/backend/test_sharing_overhaul.py` using `unittest` with manual random generation, 120 iterations
  - [ ]* 1.4 Write property test: Manager can soft-delete (Property 6)
    - **Property 6: Manager can soft-delete**
    - **Validates: Requirements 3.4, 9.3**
    - Test the updated `can_delete_chit()` returns true for managers, false for viewers
  - [ ]* 1.5 Write property test: Stealth is preserved for non-owners (Property 5)
    - **Property 5: Stealth is preserved for non-owners**
    - **Validates: Requirements 3.3, 9.2**
    - Test that stealth value is never modifiable by non-owners (pure logic test)

- [x] 2. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Database migration and notification model
  - [x] 3.1 Add `notifications` table migration in `migrations.py`
    - Create `migrate_add_notifications()` function with existence check
    - Table: `id TEXT PRIMARY KEY, user_id TEXT NOT NULL, chit_id TEXT NOT NULL, chit_title TEXT, owner_display_name TEXT, notification_type TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', created_datetime TEXT NOT NULL`
    - Add index: `idx_notifications_user_id` on `user_id`
    - Register migration call in `main.py`
    - _Requirements: 4.5_
  - [x] 3.2 Add `Notification` Pydantic model in `models.py`
    - Fields: `id, user_id, chit_id, chit_title, owner_display_name, notification_type, status, created_datetime`
    - _Requirements: 4.5_

- [x] 4. Notification API routes (`routes/notifications.py`)
  - [x] 4.1 Create `routes/notifications.py` with `notifications_router`
    - GET `/api/notifications` — list notifications for authenticated user, ordered by `created_datetime` DESC
    - PATCH `/api/notifications/{id}` — update status (accept/decline), sync RSVP on the chit's shares entry
    - DELETE `/api/notifications/{id}` — dismiss a notification
    - Register router in `main.py`
    - _Requirements: 4.2, 4.3, 4.6_
  - [x] 4.2 Add notification creation helper `_create_share_notifications()`
    - Compare old shares to new shares, insert notification for each new user_id
    - Determine `notification_type` ("assigned" vs "invited") based on `assigned_to`
    - Place in `routes/notifications.py` or a shared helper, callable from `routes/chits.py` and `routes/sharing.py`
    - _Requirements: 1.5, 2.4, 4.1_
  - [x] 4.3 Wire notification creation into `update_chit()` in `routes/chits.py`
    - After saving shares, call `_create_share_notifications()` with old/new shares diff
    - _Requirements: 1.5, 2.4, 4.1_
  - [x] 4.4 Wire notification creation into `set_chit_shares()` in `routes/sharing.py`
    - After saving shares, call `_create_share_notifications()` with old/new shares diff
    - _Requirements: 1.5, 4.1_
  - [ ]* 4.5 Write property test: Notification creation completeness (Property 3)
    - **Property 3: Notification creation completeness**
    - **Validates: Requirements 1.5, 2.4, 4.1**
    - Test that for any old/new shares diff, exactly one notification is created per new user_id with all required fields
  - [ ]* 4.6 Write property test: Notifications ordered by creation time descending (Property 8)
    - **Property 8: Notifications are ordered by creation time descending**
    - **Validates: Requirements 4.2**
    - Test that GET endpoint returns notifications newest-first
  - [ ]* 4.7 Write property test: Notification and RSVP status stay in sync (Property 9)
    - **Property 9: Notification and RSVP status stay in sync**
    - **Validates: Requirements 4.3, 4.4**
    - Test that accepting/declining a notification updates the chit's RSVP, and vice versa

- [x] 5. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Backend chit route permission fixes (`routes/chits.py`)
  - [x] 6.1 Update `update_chit()` to allow managers to persist shares and assigned_to
    - Remove the silent preservation of shares/assigned_to for non-owner managers
    - Keep stealth preservation for non-owners only (stealth is owner-only)
    - _Requirements: 3.1, 3.2, 3.3, 3.6, 9.1, 9.2, 9.4_
  - [x] 6.2 Update `delete_chit()` to allow managers to soft-delete
    - Use updated `can_delete_chit()` which now returns true for managers
    - Load owner_settings for role resolution if needed
    - _Requirements: 3.4, 9.3_
  - [x] 6.3 Add RSVP cross-user protection validation
    - Verify the existing RSVP endpoint already restricts updates to the requesting user's own entry
    - Add explicit 403 if a manager attempts to update another user's RSVP
    - _Requirements: 3.5_
  - [x] 6.4 Sync RSVP updates with notification status
    - When RSVP is updated via the editor endpoint, find and update the corresponding notification status
    - _Requirements: 4.4_
  - [ ]* 6.5 Write property test: Manager can persist sharing fields (Property 4)
    - **Property 4: Manager can persist sharing fields**
    - **Validates: Requirements 3.1, 3.2, 3.6, 9.1, 9.4**
  - [ ]* 6.6 Write property test: RSVP updates are self-only (Property 7)
    - **Property 7: RSVP updates are self-only**
    - **Validates: Requirements 3.5**

- [x] 7. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Frontend: Invite and Assign actions (`editor-people.js`, `editor-sharing.js`)
  - [x] 8.1 Update invite action to add user with viewer role and invited status
    - Ensure `_addShare()` sets `role: "viewer"` and `rsvp_status: "invited"` on click
    - Prevent self-invite (skip if user_id matches current user)
    - _Requirements: 1.1, 1.2, 1.6_
  - [x] 8.2 Update assigned-to dropdown to populate with all system users
    - Change dropdown population from "owner + shared users" to "owner + all system users"
    - _Requirements: 2.5_
  - [x] 8.3 Implement assign auto-add-to-shares logic
    - On assigned-to change: if user not in `_currentShares`, add with `role: "manager"`, `rsvp_status: "invited"`
    - If user already in shares with `role: "viewer"`, upgrade to `"manager"`
    - If already `"manager"`, no change
    - Re-render shares list in right column
    - _Requirements: 2.1, 2.2, 2.3, 10.2, 10.3_
  - [x] 8.4 Update `getSharingData()` in `editor-sharing.js` to reflect assign logic
    - Ensure the assign auto-add logic is applied before building the save payload
    - _Requirements: 2.2, 2.3_
  - [ ]* 8.5 Write property test: Invite adds user with viewer role and invited status (Property 1)
    - **Property 1: Invite adds user with viewer role and invited status**
    - **Validates: Requirements 1.1**
  - [ ]* 8.6 Write property test: Assign ensures user is manager in shares (Property 2)
    - **Property 2: Assign ensures user is manager in shares**
    - **Validates: Requirements 2.2, 2.3, 10.2, 10.3**

- [x] 9. Frontend: Notification Inbox UI (`main-sidebar.js`, `styles-sidebar.css`)
  - [x] 9.1 Add notification inbox component to sidebar
    - Position between Contacts/Clock/Weather section and Settings button
    - Collapsed state: 🔔 icon + count badge for pending notifications
    - Expanded state: list of notifications with chit title, owner name, Accept/Decline buttons
    - _Requirements: 5.1, 5.2, 5.3_
  - [x] 9.2 Implement notification fetch on dashboard load
    - Fetch GET `/api/notifications` on init, display count badge
    - On error: show inbox button without badge, log error to console
    - _Requirements: 5.2, 5.7_
  - [x] 9.3 Implement notification Accept/Decline actions
    - Accept: PATCH notification status to "accepted", remove from list, update badge count
    - Decline: PATCH notification status to "declined", remove from list, update badge count
    - _Requirements: 5.5, 5.6_
  - [x] 9.4 Implement notification chit title click navigation
    - Click chit title → navigate to editor page for that chit
    - _Requirements: 5.4_
  - [x] 9.5 Add notification inbox CSS styles in `styles-sidebar.css`
    - Style the inbox button, badge, expanded list, notification cards, and Accept/Decline buttons
    - Match existing sidebar visual patterns (parchment theme, Lora font)
    - _Requirements: 5.1_
  - [ ]* 9.6 Write property test: Pending notification count accuracy (Property 10)
    - **Property 10: Pending notification count accuracy**
    - **Validates: Requirements 5.2**

- [x] 10. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Frontend: Dashboard sharing filters (`main-sidebar.js`, `main-views.js`)
  - [x] 11.1 Add "Shared with me" and "Shared by me" filter toggles to sidebar
    - Add two new checkbox toggles in the filters section
    - _Requirements: 7.1_
  - [x] 11.2 Implement sharing filter logic in view rendering
    - "Shared with me" active: show only chits where `_shared === true` and user is not owner
    - "Shared by me" active: show only chits owned by current user with at least one share entry
    - Both inactive: no sharing-based filtering (identity function)
    - Apply in `_applyMultiSelectFilters()` or equivalent filter pipeline
    - _Requirements: 7.2, 7.3, 7.4_
  - [x] 11.3 Wire sharing filters into "Clear All" reset
    - Deactivate both sharing filters when "Clear All" is clicked
    - _Requirements: 7.5_
  - [ ]* 11.4 Write property test: Shared-with-me filter correctness (Property 14)
    - **Property 14: Shared-with-me filter correctness**
    - **Validates: Requirements 7.2**
  - [ ]* 11.5 Write property test: Shared-by-me filter correctness (Property 15)
    - **Property 15: Shared-by-me filter correctness**
    - **Validates: Requirements 7.3**
  - [ ]* 11.6 Write property test: No sharing filter is identity (Property 16)
    - **Property 16: No sharing filter is identity**
    - **Validates: Requirements 7.4**

- [x] 12. Frontend: Tag sharing enhancements (`settings.js`)
  - [x] 12.1 Move tag sharing section above coloring section in tag edit modal
    - Reorder DOM rendering so sharing section appears before color section
    - _Requirements: 6.4_
  - [x] 12.2 Implement sub-tag propagation on parent tag share save
    - When parent tag sharing config is saved, iterate all sub-tags and apply same config
    - When sub-tag added to shared parent, copy parent's sharing config
    - When sub-tag removed, remove its sharing config entry
    - _Requirements: 6.1, 6.2, 6.3_
  - [x] 12.3 Add per-user `tag_permission` toggle (view/manage) in tag sharing section
    - Add "view"/"manage" toggle column next to existing role selector
    - Store as `tag_permission` field in share entry; default to "view" if missing
    - _Requirements: 6.5_
  - [x] 12.4 Enforce tag permission on Settings page
    - "view" users: prevent rename, recolor, delete of shared tags
    - "manage" users: allow full tag management including sub-tags
    - _Requirements: 6.6, 6.7_
  - [x] 12.5 Update tag tree shared icon tooltip
    - 🔗 icon on shared tags; hover tooltip lists users the tag is shared with
    - _Requirements: 6.8_
  - [ ]* 12.6 Write property test: Tag sharing hierarchy invariant (Property 11)
    - **Property 11: Tag sharing hierarchy invariant**
    - **Validates: Requirements 6.1, 6.2, 6.3**
  - [ ]* 12.7 Write property test: Tag permission enforcement (Property 12)
    - **Property 12: Tag permission enforcement**
    - **Validates: Requirements 6.6, 6.7**
  - [ ]* 12.8 Write property test: Tag-level shares have no RSVP flow (Property 13)
    - **Property 13: Tag-level shares have no RSVP flow**
    - **Validates: Requirements 6.9**

- [x] 13. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Frontend: People zone expand modal (`editor-people.js`, `editor.css`)
  - [x] 14.1 Add expand button to People zone header
    - Match existing Notes zone expand button pattern (⤢ icon)
    - _Requirements: 8.1_
  - [x] 14.2 Implement People expand modal
    - Nearly full-screen modal with alphabetical list of all people (contacts + system users)
    - Each entry labeled: "Contact" for contacts, or sharing capacity ("Viewer", "Manager", "Assigned") for system users
    - Shrink button (⤡) to close
    - _Requirements: 8.2, 8.3, 8.4_
  - [x] 14.3 Add ESC handling for People expand modal
    - ESC closes the modal before any other ESC action (added to ESC priority chain)
    - _Requirements: 8.5, 8.6_
  - [x] 14.4 Add People expand modal CSS styles in `editor.css`
    - Style the modal overlay, alphabetical list, person entries, type labels, shrink button
    - Match existing parchment theme
    - _Requirements: 8.2_
  - [ ]* 14.5 Write property test: People modal entries are alphabetically ordered and correctly labeled (Property 18)
    - **Property 18: People modal entries are alphabetically ordered and correctly labeled**
    - **Validates: Requirements 8.3, 8.4**

- [x] 15. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 16. Integration wiring and final updates
  - [x] 16.1 Update `src/INDEX.md` with all new and changed functions
    - Add entries for `routes/notifications.py`, updated `sharing.py` functions, new frontend functions
    - Add entries for new CSS sections and new test file
    - _Requirements: all_
  - [x] 16.2 Update `src/VERSION` with current timestamp
    - Run `date "+%Y%m%d.%H%M"` and write result to `src/VERSION`
    - _Requirements: all_
  - [x] 16.3 Create release notes
    - Write `documents/release_notes/cwoc_release_[version].md` with brief summary of the sharing overhaul
    - _Requirements: all_

- [x] 17. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests use Python `unittest` with manual random generation (120 iterations, matching existing `test_rsvp.py` pattern) — no external PBT libraries, no installs
- All property tests go in `src/backend/test_sharing_overhaul.py`
- No installs (no pip, no npm, no hypothesis)
- No running the server — all validation via automated tests
- Frontend is vanilla JS — no frameworks, no build step
- SQLite with inline migrations in `migrations.py`
