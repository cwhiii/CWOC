# Implementation Plan: Chit Sharing System

## Overview

This plan implements chit-level and tag-level sharing with role-based access control (Owner / Manager / Viewer), a permission resolution engine, stealth chits, chit assignment, shared calendars, a tag editor overhaul for sharing management, and a multi-owner wall station view. Tasks are ordered: migration first, then backend core logic, then API routes, then frontend, then tests, then final wiring.

## Tasks

- [ ] 1. Database migration for sharing columns
  - [ ] 1.1 Add `migrate_add_sharing()` function to `src/backend/migrations.py`
    - Add `shares` (TEXT, default NULL), `stealth` (BOOLEAN, default 0), and `assigned_to` (TEXT, default NULL) columns to the `chits` table if they do not exist
    - Add `shared_tags` (TEXT, default NULL) column to the `settings` table if it does not exist
    - Follow the existing migration pattern: `PRAGMA table_info` + column-existence check, `ALTER TABLE ADD COLUMN`
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [ ] 1.2 Register the migration in `src/backend/main.py`
    - Import `migrate_add_sharing` from `src/backend/migrations.py`
    - Call it in the startup migration sequence after `migrate_add_instance_name()`
    - _Requirements: 9.5_

- [ ] 2. Backend core: Permission resolution engine
  - [ ] 2.1 Create `src/backend/sharing.py` with permission resolution functions
    - Implement `resolve_effective_role(chit_row, user_id, owner_settings)` returning `'owner'`, `'manager'`, `'viewer'`, or `None`
    - Resolution order: owner_id match → 'owner'; stealth=True and not owner → None; chit-level shares → role; tag-level shares → role; assigned_to match → 'viewer'; else None
    - Implement `can_edit_chit(chit_row, user_id, owner_settings)` — True if role is owner or manager
    - Implement `can_delete_chit(chit_row, user_id)` — True only if user is owner
    - Implement `can_manage_sharing(chit_row, user_id)` — True only if user is owner
    - Implement `get_shared_chits_for_user(user_id)` — query all non-deleted, non-stealth chits shared with user via chit-level shares, tag-level shares, or assignment; annotate each with `effective_role` and `share_source`
    - Use `deserialize_json_field` from `src/backend/db.py` for parsing JSON columns
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 2.2, 2.3, 2.4, 2.5, 2.6, 5.1, 5.2, 5.3, 5.4, 6.2, 7.2_

  - [ ]* 2.2 Write property test: Viewer access is read-only
    - **Property 1: Viewer access is read-only**
    - **Validates: Requirements 1.2, 2.2**
    - Create `src/backend/test_sharing.py` with lightweight custom generators (matching `test_audit.py` / `test_auth.py` pattern, no hypothesis)
    - Generate random chits with viewer shares, verify `resolve_effective_role` returns `'viewer'` and `can_edit_chit` returns `False`
    - Minimum 120 iterations

  - [ ]* 2.3 Write property test: Manager access allows editing
    - **Property 2: Manager access allows editing**
    - **Validates: Requirements 1.3, 2.3**
    - Generate random chits with manager shares, verify `resolve_effective_role` returns at least `'manager'` and `can_edit_chit` returns `True`
    - Minimum 120 iterations

  - [ ]* 2.4 Write property test: Only owner can delete and manage sharing
    - **Property 3: Only owner can delete and manage sharing**
    - **Validates: Requirements 1.4, 2.6**
    - Generate random chits with various roles for non-owner users, verify `can_delete_chit` and `can_manage_sharing` return `False`; verify both return `True` when user_id == owner_id
    - Minimum 120 iterations

  - [ ]* 2.5 Write property test: Removing a share revokes access
    - **Property 4: Removing a share revokes access**
    - **Validates: Requirements 1.5, 2.4, 2.5**
    - Generate random chits where user is not in shares, not in tag shares, and not assigned_to; verify `resolve_effective_role` returns `None`
    - Minimum 120 iterations

  - [ ]* 2.6 Write property test: Multiple sharing paths resolve to highest role
    - **Property 5: Multiple sharing paths resolve to highest role**
    - **Validates: Requirements 5.1, 5.2**
    - Generate random chits with multiple sharing paths (chit-level, tag-level, assignment), verify highest role wins (owner > manager > viewer)
    - Minimum 120 iterations

  - [ ]* 2.7 Write property test: Owner always has full control
    - **Property 6: Owner always has full control**
    - **Validates: Requirements 5.3, 6.3**
    - Generate random chits (including stealth) where user_id == owner_id, verify full control regardless of shares/stealth/assigned_to
    - Minimum 120 iterations

  - [ ]* 2.8 Write property test: Stealth overrides all sharing for non-owners
    - **Property 7: Stealth overrides all sharing for non-owners**
    - **Validates: Requirements 5.4, 6.2**
    - Generate random stealth chits with shares, verify non-owners get `None` from `resolve_effective_role`
    - Minimum 120 iterations

  - [ ]* 2.9 Write property test: Assignment grants at least viewer access
    - **Property 8: Assignment grants at least viewer access**
    - **Validates: Requirements 7.2**
    - Generate random non-stealth chits with assigned_to set, verify at least `'viewer'` access; verify higher role from other paths takes precedence
    - Minimum 120 iterations

  - [ ]* 2.10 Write property test: Migration is idempotent and preserves data
    - **Property 9: Migration is idempotent and preserves data**
    - **Validates: Requirements 9.1, 9.2, 9.4**
    - Create temp database, run `migrate_add_sharing()` multiple times, verify no errors, columns exist, pre-existing data unchanged
    - Minimum 120 iterations

- [ ] 3. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Backend: Pydantic models and serialization updates
  - [ ] 4.1 Add sharing-related Pydantic models to `src/backend/models.py`
    - Add `ShareEntry(BaseModel)` with `user_id: str` and `role: str`
    - Add `SharedTagEntry(BaseModel)` with `tag: str` and `shares: List[ShareEntry]`
    - Extend `Chit` model with `shares: Optional[List[Any]] = None`, `stealth: Optional[bool] = False`, `assigned_to: Optional[str] = None`
    - Extend `Settings` model with `shared_tags: Optional[Any] = None`
    - _Requirements: 1.1, 2.1, 6.1, 7.1_

  - [ ] 4.2 Update chit serialization/deserialization in `src/backend/routes/chits.py`
    - Add `shares`, `stealth`, `assigned_to` to all chit read paths (deserialize `shares` as JSON, `stealth` as bool, `assigned_to` as string)
    - Add `shares`, `stealth`, `assigned_to` to chit create and update SQL statements
    - _Requirements: 1.1, 6.1, 7.1_

  - [ ] 4.3 Update settings serialization/deserialization in `src/backend/routes/settings.py`
    - Add `shared_tags` to settings read path (deserialize as JSON)
    - Add `shared_tags` to settings save SQL statement (serialize as JSON)
    - _Requirements: 2.1_

- [ ] 5. Backend: Sharing management API routes
  - [ ] 5.1 Create `src/backend/routes/sharing.py` with sharing management endpoints
    - `GET /api/chits/{chit_id}/shares` — return shares list with display names (owner only, verified via `can_manage_sharing`)
    - `PUT /api/chits/{chit_id}/shares` — set entire shares list (owner only); validate role values are `'manager'` or `'viewer'`, validate user_ids exist in `users` table, reject sharing with self
    - `DELETE /api/chits/{chit_id}/shares/{user_id}` — remove a specific user from shares (owner only)
    - `GET /api/shared-chits` — return all chits shared with authenticated user, annotated with `effective_role`, `share_source`, and `owner_display_name`
    - `GET /api/settings/shared-tags` — return authenticated user's `shared_tags` configuration
    - `PUT /api/settings/shared-tags` — set authenticated user's `shared_tags` configuration; validate role values and user_ids
    - Include audit logging for all sharing changes
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [ ] 5.2 Register sharing routes in `src/backend/main.py`
    - Import the sharing router from `src/backend/routes/sharing.py`
    - Add `app.include_router(sharing_router)` after the existing route registrations
    - _Requirements: 1.6, 2.7_

- [ ] 6. Backend: Extend existing chit routes with permission checks
  - [ ] 6.1 Update `GET /api/chit/{chit_id}` in `src/backend/routes/chits.py` to allow access for shared users
    - Instead of only checking `owner_id`, also check if user has any role via `resolve_effective_role`
    - Include `effective_role` in the response so the frontend knows whether to show read-only or edit mode
    - _Requirements: 4.3, 4.4_

  - [ ] 6.2 Update `PUT /api/chits/{chit_id}` in `src/backend/routes/chits.py` to check `can_edit_chit`
    - Allow managers to edit chit content but prevent them from changing `shares`, `stealth`, or `assigned_to` fields
    - Return 403 with `"You have read-only access to this chit"` for viewers
    - _Requirements: 1.3, 2.3, 5.1_

  - [ ] 6.3 Update `DELETE /api/chits/{chit_id}` in `src/backend/routes/chits.py` to check `can_delete_chit`
    - Only owner can delete; non-owners get 404 (same as current behavior to avoid revealing chit existence)
    - _Requirements: 1.4, 2.6_

- [ ] 7. Backend: Wall station API
  - [ ] 7.1 Add wall station endpoint and page route to `src/backend/routes/health.py`
    - `GET /api/wall-station` — accept `user_ids` query param (comma-separated UUIDs), return combined non-deleted, non-stealth chits from those users with `owner_display_name` attribution; also return user display names
    - `GET /wall-station` — serve `wall-station.html` page
    - Validate user_ids against the `users` table; return 400 for invalid IDs
    - _Requirements: 8.1, 8.2, 8.3_

  - [ ] 7.2 Add wall station paths to `_is_excluded()` in `src/backend/middleware.py`
    - Add `/wall-station` (GET) and `/api/wall-station` (GET) to the exclusion list so they work without authentication
    - _Requirements: 8.4_

- [ ] 8. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Frontend: Sharing panel in chit editor
  - [ ] 9.1 Create `src/frontend/js/editor/editor-sharing.js` with sharing panel logic
    - Build a new editor zone "🔗 Sharing" visible only to the chit owner
    - User picker dropdown populated from `/api/auth/switchable-users` or `/api/users`
    - Role selector (Manager / Viewer) and Add/Remove share buttons
    - Current shares list with role badges and remove buttons
    - Stealth toggle checkbox with 🥷 icon
    - Assigned-to user picker dropdown
    - Save shares via `PUT /api/chits/{chit_id}/shares`
    - _Requirements: 1.6, 6.4, 7.5_

  - [ ] 9.2 Add sharing zone HTML to `src/frontend/html/editor.html`
    - Add the sharing zone container (`sharingSection` / `sharingContent`) in column-two after the existing zones
    - Add `<script>` tag for `editor-sharing.js` in the correct load order (before `editor-init.js`)
    - _Requirements: 1.6, 6.4_

  - [ ] 9.3 Implement read-only mode for viewer-role chits in the editor
    - When `effective_role === 'viewer'`, disable all form fields and show a "Read-only — shared by {owner_display_name}" banner at the top
    - Hide save buttons, delete button, and sharing zone for viewers
    - _Requirements: 4.3_

  - [ ] 9.4 Add stealth visual indicator to dashboard chit cards
    - When a chit has `stealth === true`, show a 🥷 icon on the chit card header (visible only to the owner)
    - _Requirements: 6.5_

  - [ ] 9.5 Add assignee display name to chit cards
    - When a chit has `assigned_to` set, fetch and display the assignee's display name on the chit card
    - _Requirements: 7.4_

- [ ] 10. Frontend: Dashboard extensions for shared chits
  - [ ] 10.1 Merge shared chits into dashboard views in `src/frontend/js/dashboard/main-views.js`
    - Fetch `/api/shared-chits` alongside `/api/chits` on dashboard load
    - Merge shared chits into all tab views (Calendar, Tasks, Notes, Checklists, Projects, Alarms)
    - Display owner badge (`👤 {owner_display_name}`) and role indicator on shared chit cards
    - Respect `effective_role` for interaction (viewer = no inline edits, manager = full inline edits)
    - _Requirements: 4.1, 4.2_

  - [ ] 10.2 Add "Assigned to Me" sub-view under the Tasks tab
    - Add a new view mode toggle button in the Tasks sidebar section (alongside Tasks and Habits)
    - Filter to show only chits where `assigned_to` matches the current user's ID
    - _Requirements: 7.3_

  - [ ] 10.3 Merge shared calendar events in `src/frontend/js/dashboard/main-calendar.js`
    - Include shared chits with date fields in all calendar views (Week, Day, Month, Itinerary, Year, Work, SevenDay)
    - Visually distinguish shared events with owner badge
    - Open viewer-role events in read-only mode, manager-role events in edit mode
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ] 11. Frontend: Tag editor overhaul for sharing in settings
  - [ ] 11.1 Extend the tag editor in `src/frontend/js/pages/settings.js` with sharing configuration
    - Add a sharing configuration panel per tag showing current share recipients with roles
    - Add user picker + role selector + add button to share a tag
    - Add remove button per shared user
    - Save tag sharing via `PUT /api/settings/shared-tags`
    - Load tag sharing via `GET /api/settings/shared-tags`
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [ ] 11.2 Add visual indicator on tags with active sharing
    - Display a 🔗 icon on tags in the settings tag editor that have active sharing configurations
    - _Requirements: 3.5_

- [ ] 12. Frontend: Wall station page
  - [ ] 12.1 Create `src/frontend/html/wall-station.html`
    - Standalone page that reads `users` query parameter from the URL
    - Fetches combined data from `/api/wall-station?user_ids=...`
    - Renders a combined calendar view and task list with `owner_display_name` attribution
    - Auto-refreshes on the same sync interval as the dashboard (polling fallback)
    - Does not require authentication — no `shared-auth.js` dependency
    - Style with the existing parchment theme (`shared-page.css`)
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ] 13. Frontend: CSS for sharing UI
  - [ ] 13.1 Add sharing panel styles to `src/frontend/css/editor/editor.css`
    - Styles for the sharing zone: user picker, role badges, share list, stealth toggle, assigned-to picker
    - Read-only banner styles for viewer mode
    - _Requirements: 1.6, 6.4_

  - [ ] 13.2 Add shared chit styles to `src/frontend/css/shared/shared-page.css`
    - Owner badge styles for shared chit cards
    - Role indicator styles (viewer/manager badges)
    - Stealth indicator styles
    - Assignee display name styles
    - _Requirements: 4.2, 6.5, 7.4_

- [ ] 14. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 15. Final wiring and documentation
  - [ ] 15.1 Update `src/INDEX.md` with all new files, functions, routes, and CSS sections
    - Add entries for `src/backend/sharing.py`, `src/backend/routes/sharing.py`, `src/backend/test_sharing.py`
    - Add entries for `src/frontend/js/editor/editor-sharing.js`, `src/frontend/html/wall-station.html`
    - Update entries for modified files: `migrations.py`, `main.py`, `models.py`, `routes/chits.py`, `routes/settings.py`, `routes/health.py`, `middleware.py`, `main-views.js`, `main-calendar.js`, `settings.js`, `editor.html`, `editor.css`, `shared-page.css`
    - _Requirements: all_

  - [ ] 15.2 Update `src/VERSION` with current timestamp
    - Run `date "+%Y%m%d.%H%M"` and write the result to `src/VERSION`
    - This must be the very last step
    - _Requirements: all_

- [ ] 16. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document using the lightweight custom generator pattern (matching `test_audit.py` and `test_auth.py`), NOT hypothesis
- Unit tests validate specific examples and edge cases
- No tasks install software — all dependencies are already available
- No tasks require running the server — use automated tests only
- All JS is vanilla — no modules, no imports, no build step
- SQLite3 via Python stdlib, no ORM; Pydantic v1 models
- VERSION update is the very last step only
