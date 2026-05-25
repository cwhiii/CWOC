# Implementation Plan: Unified User-Contacts

## Overview

Eliminate the separate `users` table by merging user data into the `contacts` table. The migration adds auth columns to contacts, copies all user records into contacts, updates all references, and renames `users` to `users_deprecated`. Then all backend routes, frontend pages, and Android entities are updated to query/modify the unified `contacts` table.

## Tasks

- [x] 1. Database migration and schema changes
  - [x] 1.1 Add auth columns to contacts table and write the idempotent migration function
    - In `migrations.py`, create `migrate_unify_users_contacts()` that:
    - Adds columns to `contacts`: `username` (TEXT UNIQUE), `password_hash` (TEXT), `is_admin` (BOOLEAN DEFAULT 0), `is_active` (BOOLEAN DEFAULT 1), `private_pgp_key_encrypted` (TEXT) — each wrapped in try/except for idempotency
    - Creates partial unique index: `CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_username ON contacts(username) WHERE username IS NOT NULL`
    - For each row in `users`: INSERT into contacts (preserving the same UUID as `id`) or UPDATE existing contact with auth fields, mapping `email` → emails JSON entry with label "System", `profile_image_url` → `image_url`, and copying all profile fields (given_name, surname, phones, emails_json→emails, addresses, etc.)
    - Sets `shared_to_vault = 1` on all migrated user-contacts
    - Renames `users` table to `users_deprecated` (with existence check for idempotency)
    - _Requirements: REQ-1.1, REQ-1.2, REQ-1.3, REQ-1.4, REQ-2.1, REQ-2.2, REQ-2.3, REQ-2.4, REQ-2.5, REQ-11.1, REQ-11.2_

  - [x] 1.2 Register the migration in `main.py` startup
    - Call `migrate_unify_users_contacts()` at startup in `main.py` alongside existing migration calls
    - Must run AFTER the existing user/session migrations (depends on users table existing first)
    - _Requirements: REQ-11.1_

- [x] 2. Backend core: db.py and middleware.py
  - [x] 2.1 Update `require_admin()` in `db.py` to query contacts table
    - Change `SELECT is_admin FROM users WHERE id = ?` to `SELECT is_admin FROM contacts WHERE id = ? AND username IS NOT NULL`
    - _Requirements: REQ-4.1, REQ-1.2_

  - [x] 2.2 Update `middleware.py` session validation to join against contacts
    - Change the session validation query from `JOIN users u ON s.user_id = u.id` to `JOIN contacts c ON s.user_id = c.id AND c.username IS NOT NULL`
    - Update column references (`u.username` → `c.username`, `u.is_active` → `c.is_active`)
    - Update the Bearer token validation query similarly (device_tokens JOIN contacts)
    - _Requirements: REQ-3.2, REQ-1.4_

- [x] 3. Backend: auth routes (`routes/auth.py`)
  - [x] 3.1 Update login endpoint to query contacts
    - Change `SELECT ... FROM users WHERE LOWER(username) = ?` to `SELECT ... FROM contacts WHERE LOWER(username) = ? AND username IS NOT NULL AND is_active = 1`
    - _Requirements: REQ-3.1_

  - [x] 3.2 Update `/api/auth/me` to read from contacts table
    - Change `SELECT * FROM users WHERE id = ?` to `SELECT * FROM contacts WHERE id = ?`
    - Strip `password_hash` and `private_pgp_key_encrypted` from response
    - Add `is_user: true` flag to response
    - _Requirements: REQ-5.2, REQ-10.1_

  - [x] 3.3 Update `/api/auth/profile` to write to contacts table
    - Change all `UPDATE users SET ...` to `UPDATE contacts SET ...`
    - Enforce System email protection for non-admin self-edits
    - Bump `sync_version` on the contact record so mobile clients pick up the change
    - _Requirements: REQ-5.1, REQ-5.3, REQ-6.1_

  - [x] 3.4 Update password change, PGP key, switch, switchable-users, profile-image endpoints
    - Change all `FROM users` / `UPDATE users` references to `FROM contacts` / `UPDATE contacts` (with `WHERE username IS NOT NULL` where appropriate)
    - `switchable-users` queries `contacts WHERE username IS NOT NULL AND is_active = 1`
    - Profile image upload/delete updates `contacts.image_url` instead of `users.profile_image_url`
    - _Requirements: REQ-3.1, REQ-3.3, REQ-7.1_

  - [x] 3.5 Update `_user_profile_dict` helper and login-message admin check
    - Adapt the helper to work with contact row shape (e.g., `image_url` instead of `profile_image_url`)
    - Update admin check in `save_login_message` to query contacts
    - _Requirements: REQ-5.2_

- [x] 4. Backend: user admin routes (`routes/users.py`)
  - [x] 4.1 Update all user admin endpoints to query/modify contacts
    - `GET /api/users` → `SELECT ... FROM contacts WHERE username IS NOT NULL`
    - `POST /api/users` → INSERT into contacts with auth fields + `shared_to_vault = 1`, store email in `emails` JSON array with label "System"
    - `PUT /api/users/{id}` → UPDATE contacts, enforce username uniqueness against contacts table
    - Deactivate/reactivate → UPDATE contacts SET is_active
    - Reset password → UPDATE contacts SET password_hash
    - Bump `sync_version` on all writes so mobile clients sync the changes
    - _Requirements: REQ-4.1, REQ-4.2, REQ-4.3, REQ-4.4, REQ-4.5, REQ-6.3_

- [x] 5. Backend: contacts routes (`routes/contacts.py`)
  - [x] 5.1 Strip auth fields from contact API responses
    - Update `_row_to_contact()` to remove `password_hash` and `private_pgp_key_encrypted` from the returned dict
    - Add `is_user: true` flag when `username IS NOT NULL` on the contact
    - Include `username` and `is_admin` in response (for UI badge display) but NEVER `password_hash` or `private_pgp_key_encrypted`
    - _Requirements: REQ-10.1, REQ-10.2, REQ-7.2_

  - [x] 5.2 Add System email protection to contact update endpoint
    - In `PUT /api/contacts/{id}`, before saving: if the contact is a user-contact (username IS NOT NULL) and the requester is not admin, enforce System email preservation using `_enforce_system_email_protection()` logic from the design
    - _Requirements: REQ-6.1, REQ-6.2, REQ-6.3_

  - [x] 5.3 Prevent deletion of user-contacts
    - In `DELETE /api/contacts/{id}`, if the contact has `username IS NOT NULL`, reject with 400 ("Cannot delete a user-contact. Deactivate via user admin instead.")
    - _Requirements: REQ-4.4_

- [x] 6. Backend: sync routes (`routes/sync.py`)
  - [x] 6.1 Strip auth fields from sync contact responses
    - Update `_deserialize_contact_for_sync()` to remove `password_hash` and `private_pgp_key_encrypted` from the dict before returning
    - Add `is_user` boolean flag (True when username is not None)
    - Include `username`, `is_admin`, `is_active` for display purposes on mobile
    - _Requirements: REQ-10.3, REQ-9.2_

- [x] 7. Checkpoint
  - Ensure all backend changes are consistent and the server starts without errors. Ask the user if questions arise.

- [x] 8. Frontend: People page (`people.js`)
  - [x] 8.1 Remove separate user-fetching logic and unify with contacts
    - Remove any call to `/api/auth/switchable-users` for populating the People list
    - All entries come from `/api/contacts` (which now includes user-contacts)
    - Add visual indicator (user icon badge via Font Awesome `fa-user-shield` or similar) on contacts where `is_user === true`
    - _Requirements: REQ-7.1, REQ-7.2, REQ-7.3_

- [x] 9. Frontend: Contact editor (`contact-editor.js`)
  - [x] 9.1 Update profile mode to read/write contact record directly
    - Profile mode should use the same `/api/contacts/{id}` endpoint (or `/api/auth/profile` which now writes to contacts)
    - Render the System email field as read-only for non-admin users (check `is_admin` from `/api/auth/me`)
    - Allow non-admins to add additional email entries with non-System labels
    - _Requirements: REQ-5.1, REQ-6.1, REQ-6.2_

- [x] 10. Frontend: User admin page (`user-admin.js`)
  - [x] 10.1 Update user admin page to work with unified contacts
    - The admin page still calls `/api/users` endpoints (which now query contacts internally)
    - Ensure the "create user" form sends email that gets stored as System email
    - No major frontend changes needed here since the API shape stays the same — verify it still works
    - _Requirements: REQ-4.2, REQ-4.3_

- [x] 11. Checkpoint
  - Ensure all frontend changes work correctly with the updated backend. Ask the user if questions arise.

- [x] 12. Android: Room entity and DAO updates
  - [x] 12.1 Add new columns to ContactEntity
    - Add fields: `username: String? = null`, `isAdmin: Boolean = false`, `isActive: Boolean = true`
    - Do NOT add `password_hash` or `private_pgp_key_encrypted` — these are never synced
    - _Requirements: REQ-9.1_

  - [x] 12.2 Create Room migration for the new contact columns
    - Create a new migration (e.g., `MIGRATION_N_N+1`) that adds `username`, `is_admin`, `is_active` columns to the contacts table
    - Wrap each `ALTER TABLE ADD COLUMN` in try/catch for idempotency
    - Register the migration in `AppModule.provideCwocDatabase()`
    - _Requirements: REQ-9.1_

  - [x] 12.3 Update Android People screen to show user badges
    - Remove any separate "Users" section if it exists
    - User-contacts appear naturally in the contact list
    - Add a visual indicator (icon/badge) on contacts where `username != null`
    - _Requirements: REQ-9.3_

- [x] 13. Final checkpoint
  - Ensure all changes across backend, frontend, and Android are consistent. All existing sessions remain valid. Ask the user if questions arise.

## Notes

- No test-writing tasks are included per project rules (tests are optional and not explicitly requested).
- The migration must be called at startup in `main.py` and must be fully idempotent (safe to run multiple times).
- `password_hash` and `private_pgp_key_encrypted` are NEVER sent to any client — web or mobile.
- The `users` table is renamed to `users_deprecated` (not dropped) as a safety net.
- All existing sessions continue to work because the user UUID becomes the contact UUID.
- Deployment will require: Server push + mobile: clean build → uninstall + reinstall (Room schema version bump + fresh sync needed).

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1", "2.2"] },
    { "id": 2, "tasks": ["3.1", "3.2", "3.3", "3.4", "3.5", "4.1"] },
    { "id": 3, "tasks": ["5.1", "5.2", "5.3", "6.1"] },
    { "id": 4, "tasks": ["8.1", "9.1", "10.1"] },
    { "id": 5, "tasks": ["12.1", "12.2"] },
    { "id": 6, "tasks": ["12.3"] }
  ]
}
```
