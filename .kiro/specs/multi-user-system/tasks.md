# Implementation Plan: Multi-User System

## Overview

Transform CWOC from a single-user application into a multi-user system with authentication, per-user data isolation, session management, user administration, and audit log attribution. The implementation follows a bottom-up approach: database migration and auth utilities first, then middleware and API routes, then frontend pages and components, and finally wiring everything together.

All backend code uses Python 3 stdlib only (no pip installs). All frontend code is vanilla JS/HTML/CSS (no npm installs). Password hashing uses `hashlib.pbkdf2_hmac` with `os.urandom` salts. Property-based tests use `unittest` + `random` (no Hypothesis).

## Tasks

- [x] 1. Database migration and auth utilities
  - [x] 1.1 Create `src/backend/auth_utils.py` with password hashing utilities
    - Implement `hash_password(password: str) -> str` using `hashlib.pbkdf2_hmac('sha256', ...)` with `os.urandom(32)` salt, 600,000 iterations, returning `'salt_hex$hash_hex'`
    - Implement `verify_password(password: str, stored_hash: str) -> bool` that splits the stored hash, re-derives, and compares
    - _Requirements: 1.4_

  - [x] 1.2 Write property test for password hash round-trip
    - **Property 1: Password hash round-trip**
    - Test file: `src/backend/test_auth.py`
    - For 100+ random password strings, verify `verify_password(pw, hash_password(pw))` returns True and the stored hash does not contain the plaintext password
    - Use `unittest` + `random` for input generation (no Hypothesis)
    - **Validates: Requirements 1.4**

  - [x] 1.3 Create `migrate_add_multi_user()` in `src/backend/migrations.py`
    - Create `users` table with columns: `id` (TEXT PK), `username` (TEXT NOT NULL UNIQUE), `display_name` (TEXT NOT NULL), `email` (TEXT), `password_hash` (TEXT NOT NULL), `is_admin` (BOOLEAN DEFAULT 0), `is_active` (BOOLEAN DEFAULT 1), `created_datetime` (TEXT NOT NULL), `modified_datetime` (TEXT NOT NULL)
    - Create `sessions` table with columns: `token` (TEXT PK), `user_id` (TEXT NOT NULL), `created_datetime` (TEXT NOT NULL), `expires_datetime` (TEXT NOT NULL), `last_active_datetime` (TEXT NOT NULL), plus indexes on `user_id` and `expires_datetime`
    - Create default admin user: UUID v4 id, username `"admin"`, display_name from existing `settings.username` for `default_user` or `"Admin"`, password `"cwoc"` (hashed via `hash_password`), `is_admin=True`, `is_active=True`
    - Add `owner_id`, `owner_display_name`, `owner_username` columns to `chits` table if they don't exist
    - Set all existing chits' `owner_id` to admin UUID, populate `owner_display_name` and `owner_username` from admin account
    - Add `owner_id` column to `contacts` table if it doesn't exist, set all existing contacts' `owner_id` to admin UUID
    - Update `settings` table: change `user_id = 'default_user'` to the admin user's UUID
    - All steps use column/table existence checks for idempotency (follow existing migration pattern)
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 4.1, 4.2, 4.6, 5.1, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_

  - [x] 1.4 Register `migrate_add_multi_user()` in `src/backend/main.py`
    - Import and call the migration function in the startup migration sequence, after existing migrations but before `seed_version_info()`
    - _Requirements: 9.7_

  - [x] 1.5 Write property test for migration idempotency
    - **Property 12: Migration idempotency**
    - Test file: `src/backend/test_migration.py`
    - Run `migrate_add_multi_user()` multiple times and verify no errors, same result each time
    - Use `unittest` + `random` (no Hypothesis)
    - **Validates: Requirements 9.7**

- [x] 2. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Pydantic models and auth route module
  - [x] 3.1 Add multi-user Pydantic models to `src/backend/models.py`
    - Add `UserCreate(BaseModel)`: username (str), display_name (str), password (str), email (Optional[str]), is_admin (Optional[bool] = False)
    - Add `UserResponse(BaseModel)`: id, username, display_name, email, is_admin, is_active, created_datetime
    - Add `LoginRequest(BaseModel)`: username (str), password (str)
    - Add `ProfileUpdate(BaseModel)`: display_name (Optional[str]), email (Optional[str])
    - Add `PasswordChange(BaseModel)`: current_password (str), new_password (str)
    - _Requirements: 1.1, 2.1, 7.2, 7.3_

  - [x] 3.2 Create `src/backend/routes/auth.py` with authentication routes
    - Implement `POST /api/auth/login`: validate credentials, check rate limit (10 attempts / 15 min window using in-memory dict), check `is_active`, create session in `sessions` table, return `Set-Cookie: cwoc_session=<token>; HttpOnly; Path=/; SameSite=Lax` with user info JSON
    - Implement `POST /api/auth/logout`: read session token from cookie, delete session row, clear cookie
    - Implement `GET /api/auth/me`: read `request.state.user_id`, return user profile info
    - Implement `PUT /api/auth/profile`: update display_name and/or email for authenticated user
    - Implement `PUT /api/auth/password`: require current_password verification, hash new_password, update user record. Return 403 if current password is wrong
    - Implement `POST /api/auth/switch`: validate target user credentials, invalidate current session, create new session for target user, set new cookie
    - Rate limiting: in-memory `_login_attempts` dict keyed by username, list of failed timestamps, max 10 per 900 seconds. Return 429 when exceeded
    - All error messages for invalid credentials must be generic ("Invalid username or password") — never reveal whether username or password was wrong
    - _Requirements: 2.1, 2.2, 2.4, 2.5, 2.6, 3.1, 3.2, 3.5, 7.2, 7.3, 7.4, 8.3, 8.4_

  - [x] 3.3 Write property tests for auth (login/logout lifecycle, invalid credentials, password change)
    - **Property 4: Login and logout session lifecycle**
    - **Property 5: Invalid credentials return generic 401**
    - **Property 10: Password change requires correct current password**
    - **Property 11: User switch invalidates old session**
    - Test file: `src/backend/test_auth.py`
    - Use `unittest` + `random` for input generation (no Hypothesis), 100+ iterations per property
    - **Validates: Requirements 2.1, 2.2, 2.4, 7.3, 7.4, 8.4**

- [x] 4. User admin route module
  - [x] 4.1 Create `src/backend/routes/users.py` with admin-only user management routes
    - Implement `GET /api/users`: list all users (admin only), return UserResponse list
    - Implement `POST /api/users`: create new user (admin only), require username + display_name + password, hash password, generate UUID, enforce username uniqueness (return 409 on duplicate)
    - Implement `PUT /api/users/{user_id}/deactivate`: set `is_active=False` (admin only), invalidate all sessions for that user, prevent deactivation of last admin (return 400)
    - Implement `PUT /api/users/{user_id}/reactivate`: set `is_active=True` (admin only)
    - Implement `PUT /api/users/{user_id}/reset-password`: hash new password and update (admin only)
    - All endpoints check `request.state.user_id` is an admin, return 403 if not
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

  - [x] 4.2 Write property tests for user management
    - **Property 2: User creation persists all required fields**
    - **Property 3: Username uniqueness**
    - **Property 13: Deactivation and reactivation lifecycle**
    - **Property 14: Last admin protection**
    - **Property 15: Multiple concurrent sessions per user**
    - Test file: `src/backend/test_users.py`
    - Use `unittest` + `random` for input generation (no Hypothesis), 100+ iterations per property
    - **Validates: Requirements 1.1, 1.2, 1.3, 3.5, 12.4, 12.5, 12.6**

- [x] 5. Auth middleware and route registration
  - [x] 5.1 Create `src/backend/middleware.py` with `AuthMiddleware`
    - Subclass `BaseHTTPMiddleware` from Starlette
    - On each request, read `cwoc_session` cookie, look up in `sessions` table
    - If valid and not expired (check `expires_datetime` and 24h inactivity via `last_active_datetime`): update `last_active_datetime`, set `request.state.user_id` and `request.state.username`, proceed
    - If invalid/missing/expired: return 401 JSON for `/api/` paths (except `/api/auth/login`), redirect to `/login` for page paths
    - Skip auth for: `POST /api/auth/login`, `GET /login`, `GET /health`, paths starting with `/static/`, `/frontend/`, `/data/`
    - Clean up expired sessions periodically (on each request or via a lightweight check)
    - _Requirements: 2.3, 3.2, 3.3, 3.4, 6.5, 10.1, 10.2, 10.3, 10.4_

  - [x] 5.2 Write property test for unauthenticated API request rejection
    - **Property 6: Unauthenticated API requests return 401**
    - Test file: `src/backend/test_auth.py`
    - For random API paths not in the excluded set, verify requests without a valid session return 401
    - Use `unittest` + `random` (no Hypothesis), 100+ iterations
    - **Validates: Requirements 2.3, 10.1, 10.3**

  - [x] 5.3 Register auth middleware and new route modules in `src/backend/main.py`
    - Add `AuthMiddleware` to the FastAPI app (before `NoCacheStaticMiddleware`)
    - Import and include `auth_router` from `src/backend/routes/auth.py`
    - Import and include `users_router` from `src/backend/routes/users.py`
    - _Requirements: 10.1_

- [x] 6. Per-user data scoping in existing routes
  - [x] 6.1 Update `src/backend/routes/chits.py` to scope by owner
    - In `get_all_chits()`: filter by `owner_id = request.state.user_id`
    - In `search_chits()`: filter by `owner_id = request.state.user_id`
    - In `create_chit()`: set `owner_id`, `owner_display_name`, `owner_username` from `request.state`
    - In `get_chit()`: verify `owner_id` matches authenticated user (return 404 if not)
    - In `update_chit()`: verify ownership before update
    - In `delete_chit()`: verify ownership before soft-delete
    - In `patch_recurrence_exceptions()`: verify ownership
    - In export endpoints: scope to authenticated user's data
    - Accept `request: Request` parameter in route handlers to access `request.state.user_id`
    - _Requirements: 4.1, 4.3, 5.1, 5.2, 5.3_

  - [x] 6.2 Update `src/backend/routes/contacts.py` to scope by owner
    - In `get_contacts()`: filter by `owner_id = request.state.user_id`
    - In `create_contact()`: set `owner_id` from `request.state.user_id`
    - In `get_contact()`: verify `owner_id` matches authenticated user
    - In `update_contact()`: verify ownership before update
    - In `delete_contact()`: verify ownership before delete
    - In export endpoints: scope to authenticated user's data
    - _Requirements: 4.2, 4.4_

  - [x] 6.3 Update `src/backend/routes/settings.py` to scope by user
    - In `get_settings()`: use `request.state.user_id` instead of path parameter (or validate path param matches authenticated user)
    - In `save_settings()`: ensure `user_id` matches authenticated user
    - Scope standalone alerts and alert state by user if applicable
    - _Requirements: 4.5_

  - [x] 6.4 Update `src/backend/routes/audit.py` for multi-user actor attribution
    - Replace `get_current_actor()` implementation: instead of reading from settings, read `request.state.user_id` and `request.state.username` from the request context
    - Create a new `get_actor_from_request(request)` function that returns `{"user_id": str, "username": str}`
    - Update all callers of `get_current_actor()` across route modules to pass the request or use the new function
    - When displaying audit log entries, include the actor's display name
    - _Requirements: 11.1, 11.2, 11.3_

  - [x] 6.5 Write property tests for data isolation and owner record
    - **Property 7: Per-user data isolation**
    - **Property 8: Chit owner record populated from authenticated user**
    - **Property 9: Profile update round-trip**
    - **Property 16: Audit log records correct actor**
    - Test file: `src/backend/test_isolation.py`
    - Use `unittest` + `random` for input generation (no Hypothesis), 100+ iterations per property
    - **Validates: Requirements 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 7.2, 11.1**

- [x] 7. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Login page (frontend)
  - [x] 8.1 Create `src/frontend/html/login.html`
    - Standalone page (no `data-page-title` — no shared header injection since user isn't authenticated)
    - Use CWOC parchment visual theme: `background-image: url("/static/parchment.jpg")`, Lora font, brown tones
    - Centered form with CWOC logo, username input, password input, and submit button
    - On submit: `POST /api/auth/login` with JSON body `{ username, password }`
    - On success (200): redirect to `/` (dashboard)
    - On error (401): display generic error message below form ("Invalid username or password")
    - On error (429): display rate limit message ("Too many login attempts. Please wait before retrying.")
    - Clear error message on next submission attempt
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 8.2 Add login page route to `src/backend/routes/health.py`
    - Add `GET /login` route that serves `login.html` via `FileResponse`
    - This route must be excluded from auth middleware
    - _Requirements: 6.1, 10.4_

- [x] 9. Frontend auth guard and settings cache update
  - [x] 9.1 Create `src/frontend/js/shared/shared-auth.js`
    - On page load, call `GET /api/auth/me`
    - If 401 response: store current URL in `localStorage` as `cwoc_auth_return`, redirect to `/login`
    - Export `getCurrentUser()` function that returns the cached user object `{ user_id, username, display_name, email, is_admin }`
    - Export `isAdmin()` helper that returns boolean
    - _Requirements: 6.5, 10.2_

  - [x] 9.2 Update `src/frontend/js/shared/shared-utils.js` settings cache
    - Change `getCachedSettings()` to fetch from `/api/settings/{user_id}` using the authenticated user's ID (from `getCurrentUser()`) instead of hardcoded `'default_user'`
    - _Requirements: 4.5_

  - [x] 9.3 Add `shared-auth.js` to all HTML page script loads
    - Add `<script src="/frontend/js/shared/shared-auth.js"></script>` to `_template.html`, `index.html`, `editor.html`, `settings.html`, `people.html`, `contact-editor.html`, `weather.html`, `trash.html`, `audit-log.html`, `help.html`
    - Load it BEFORE `shared-utils.js` in the script order (it must run first to check auth)
    - Do NOT add it to `login.html` (login page doesn't need auth guard)
    - _Requirements: 6.5_

- [x] 10. Profile page (frontend)
  - [x] 10.1 Create `src/frontend/html/profile.html`
    - Use `shared-page.css`, `shared-page.js` with `data-page-title="Profile"` and `data-page-icon="👤"`
    - Display username (read-only input), display name (editable input), email (editable input)
    - Use `CwocSaveSystem` for save/cancel buttons (follow existing pattern from settings.html)
    - On save: `PUT /api/auth/profile` with `{ display_name, email }`
    - Password change section: current password input, new password input, confirm new password input, change password button
    - On password change: `PUT /api/auth/password` with `{ current_password, new_password }`
    - Show success/error messages inline
    - If 403 on password change: display "Current password is incorrect"
    - Load shared scripts in correct order, including `shared-auth.js`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [x] 10.2 Create `src/frontend/js/pages/profile.js`
    - Fetch user data from `GET /api/auth/me` on load
    - Populate form fields
    - Wire up save system and password change logic
    - _Requirements: 7.1, 7.2_

  - [x] 10.3 Add profile page route to `src/backend/routes/health.py`
    - Add `GET /profile` route that serves `profile.html` via `FileResponse`
    - _Requirements: 7.6_

- [x] 11. User admin page (frontend)
  - [x] 11.1 Create `src/frontend/html/user-admin.html`
    - Use `shared-page.css`, `shared-page.js` with `data-page-title="User Admin"` and `data-page-icon="👥"`
    - Display a `cwoc-table` listing all users: username, display name, email, active status, admin status
    - "Create User" button opens a modal with username, display name, password, email, is_admin fields
    - Each user row has action buttons: Deactivate/Reactivate, Reset Password
    - Admin-only page: check `isAdmin()` on load, redirect to `/` if not admin
    - Load shared scripts in correct order, including `shared-auth.js`
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

  - [x] 11.2 Create `src/frontend/js/pages/user-admin.js`
    - Fetch users from `GET /api/users` on load
    - Implement create user: `POST /api/users`
    - Implement deactivate: `PUT /api/users/{id}/deactivate`
    - Implement reactivate: `PUT /api/users/{id}/reactivate`
    - Implement reset password: `PUT /api/users/{id}/reset-password`
    - Show inline error messages (e.g., "Cannot deactivate the last admin account", "Username already exists")
    - _Requirements: 12.2, 12.3, 12.4, 12.5, 12.6_

  - [x] 11.3 Add user admin page route to `src/backend/routes/health.py`
    - Add `GET /user-admin` route that serves `user-admin.html` via `FileResponse`
    - _Requirements: 12.2_

- [x] 12. User switcher (frontend header component)
  - [x] 12.1 Add user switcher to `src/frontend/js/pages/shared-page.js` header injection
    - In the auto-header injection IIFE, add a user switcher element to the header
    - Display current user's display name (from `getCurrentUser()`)
    - On click: fetch `GET /api/users` to get all active users, show dropdown
    - When a different user is selected: show password prompt modal (parchment-styled)
    - On valid password: `POST /api/auth/switch` with `{ username, password }`
    - On success: reload the page to reflect new user's data
    - On error: show inline error in the password prompt
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [x] 12.2 Add user switcher to dashboard sidebar in `src/frontend/html/index.html`
    - Add a user display/switcher element in the sidebar (near the bottom, above Settings)
    - Reuse the same switcher logic from shared-page.js or call a shared function
    - _Requirements: 8.1, 8.2_

  - [x] 12.3 Add user switcher CSS to `src/frontend/css/shared/shared-page.css`
    - Style the user switcher dropdown, password prompt modal, and current user display
    - Follow CWOC parchment theme (brown tones, Lora font, parchment backgrounds)
    - _Requirements: 8.1_

- [x] 13. Chit owner display in frontend
  - [x] 13.1 Update dashboard chit card rendering to show owner display name
    - In `src/frontend/js/dashboard/main-views.js` (or applicable view rendering files): if `owner_display_name` is present on a chit, display it on the card
    - In `src/frontend/js/editor/editor-init.js` (or applicable editor file): display owner info in the editor view
    - Only show owner name when it differs from the current user (to avoid clutter in single-user scenarios)
    - _Requirements: 5.4_

- [x] 14. Navigation updates
  - [x] 14.1 Add Profile and User Admin to navigation
    - Update `src/frontend/js/pages/shared-page.js` navigate panel (`_navPages` array) to include Profile page
    - Add User Admin page to navigate panel (conditionally shown only for admin users)
    - Add a "Profile" link/button in the shared page header (near the user switcher)
    - Update `src/frontend/html/index.html` navigate panel to include Profile and User Admin entries
    - Add logout button to the shared page header and dashboard sidebar
    - On logout click: `POST /api/auth/logout`, then redirect to `/login`
    - _Requirements: 7.6, 8.1_

- [x] 15. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 16. Update `src/INDEX.md`
  - Add entries for all new files: `auth_utils.py`, `middleware.py`, `routes/auth.py`, `routes/users.py`, `shared-auth.js`, `profile.js`, `user-admin.js`
  - Add entries for new routes: `/api/auth/*`, `/api/users/*`, `/login`, `/profile`, `/user-admin`
  - Add entries for new Pydantic models: `UserCreate`, `UserResponse`, `LoginRequest`, `ProfileUpdate`, `PasswordChange`
  - Add entries for new frontend pages: `login.html`, `profile.html`, `user-admin.html`
  - Add entries for new migration: `migrate_add_multi_user()`
  - Update entries for modified files: `chits.py`, `contacts.py`, `settings.py`, `audit.py`, `health.py`, `main.py`, `models.py`, `shared-page.js`, `shared-utils.js`, `index.html`
  - _Requirements: all_

- [x] 17. Update version in `src/VERSION`
  - Run `date "+%Y%m%d.%H%M"` and write the returned value to `src/VERSION`
  - This is the ONLY version update for the entire feature — do it once at the very end

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties using Python stdlib only (`unittest` + `random`, NOT Hypothesis)
- Unit tests validate specific examples and edge cases
- NO pip installs, NO npm installs — only build the code
- All database migrations use inline column-existence checks in `migrations.py`
- Password hashing uses Python stdlib `hashlib` (PBKDF2-HMAC-SHA256)
- Version update happens ONCE at the very end (task 17)
- INDEX.md update is the second-to-last task (task 16)
