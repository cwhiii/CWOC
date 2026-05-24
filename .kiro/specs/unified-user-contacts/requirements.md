# Requirements: Unified User-Contacts

## Overview
Eliminate the separate `users` table. A user IS a contact — the `contacts` table gets additional auth columns (`username`, `password_hash`, `is_admin`, `is_active`). A contact with `username` set is a login user. A contact without it is just a regular contact. One table, no linking, no separate systems.

## Platform Scope
All platforms: Web (desktop), Mobile (mobile browser), App (Android).

## Requirements

### 1. Schema Unification
- REQ-1.1: Add columns to the `contacts` table: `username` (TEXT UNIQUE), `password_hash` (TEXT), `is_admin` (BOOLEAN DEFAULT 0), `is_active` (BOOLEAN DEFAULT 1), `private_pgp_key_encrypted` (TEXT).
- REQ-1.2: A contact row with `username IS NOT NULL` is a user (can log in). A contact row with `username IS NULL` is a regular contact.
- REQ-1.3: The `users` table is dropped after migration. All references to it are replaced with queries against `contacts`.
- REQ-1.4: The `sessions` table's `user_id` column now references `contacts.id` (the contact ID of the user).

### 2. Data Migration
- REQ-2.1: For each existing user in the `users` table, create or merge into a contact record in the `contacts` table with all their profile data (display_name, given_name, surname, phones, emails_json→emails, addresses, etc.) plus the auth fields (username, password_hash, is_admin, is_active).
- REQ-2.2: The user's `email` field from the `users` table becomes an entry in the contact's `emails` JSON array with label "System".
- REQ-2.3: The user's `profile_image_url` maps to the contact's `image_url`.
- REQ-2.4: All existing `owner_id` references in `chits`, `settings`, `sessions`, `device_tokens`, `standalone_alerts`, `alert_state`, `rules`, `push_subscriptions`, etc. are updated to point to the new contact ID (which should be the same UUID since we're migrating the user's ID into the contact record).
- REQ-2.5: User-contacts are automatically `shared_to_vault = 1` (visible to all users) so their emails appear in contact searches for everyone.

### 3. Authentication
- REQ-3.1: Login (`/api/auth/login`) queries `contacts` table where `username IS NOT NULL AND is_active = 1` instead of the `users` table.
- REQ-3.2: Session validation in middleware queries `contacts` table for user info.
- REQ-3.3: Password hashing, rate limiting, and session management remain unchanged in behavior.

### 4. User Admin Page (Admin Only)
- REQ-4.1: The user admin page (`/api/users` endpoints) now queries/modifies `contacts` where `username IS NOT NULL`.
- REQ-4.2: Creating a user creates a contact record with auth fields set, `shared_to_vault = 1`, and the provided email stored in the `emails` JSON array.
- REQ-4.3: Editing a user (username, display_name, email, is_admin) updates the corresponding contact record.
- REQ-4.4: Deactivate/reactivate sets `is_active` on the contact record.
- REQ-4.5: Reset password updates `password_hash` on the contact record.

### 5. Profile Editing
- REQ-5.1: "Profile mode" in the contact editor now reads/writes directly to the contact record (same as editing any contact), not a separate `/api/auth/profile` endpoint.
- REQ-5.2: The `/api/auth/me` endpoint returns data from the contact record (the authenticated user's contact row).
- REQ-5.3: The `/api/auth/profile` endpoint updates the contact record directly.

### 6. System Email Field Protection
- REQ-6.1: The email entry with label "System" in a user-contact's `emails` array is read-only for non-admin users. Non-admins can see it but cannot edit or delete it.
- REQ-6.2: Non-admins CAN add additional email entries (with other labels) to a user-contact.
- REQ-6.3: Only admins can modify the "System" email (via the user admin page).

### 7. People Page
- REQ-7.1: The People page no longer fetches users from a separate `/api/auth/switchable-users` endpoint. All people (users and contacts) come from `/api/contacts`.
- REQ-7.2: User-contacts are visually distinguished (e.g., a badge or icon) in the People list so you can tell who is a login user vs. a regular contact.
- REQ-7.3: Clicking a user-contact opens the contact editor normally (not a special "profile mode" for other users). Profile mode is only for editing your OWN record.

### 8. Rules Engine / Contact Autocomplete
- REQ-8.1: Since users are now contacts, the existing `/api/contacts?q=` search automatically includes user emails. No special handling needed — the original problem is solved by the unification itself.

### 9. Android App
- REQ-9.1: The Android Room entity for contacts gains the new columns (`username`, `password_hash`, `is_admin`, `is_active`, `private_pgp_key_encrypted`).
- REQ-9.2: Sync pulls the unified contact records (with auth fields stripped for non-admin users — `password_hash` and `private_pgp_key_encrypted` are NEVER sent to clients).
- REQ-9.3: The Android People screen no longer needs a separate "Users" section — user-contacts appear naturally in the contact list with a visual indicator.

### 10. Security
- REQ-10.1: `password_hash` and `private_pgp_key_encrypted` are NEVER included in API responses to any client (web or mobile). They are server-internal only.
- REQ-10.2: The `/api/contacts` endpoint strips auth fields from responses.
- REQ-10.3: The sync endpoint strips auth fields from contact records before sending to devices.

### 11. Backward Compatibility
- REQ-11.1: The migration is fully idempotent — safe to run multiple times.
- REQ-11.2: After migration, the `users` table is renamed to `users_deprecated` (not dropped immediately) as a safety net. It can be dropped in a future release.
- REQ-11.3: All existing sessions remain valid after migration (session tokens still reference the same user IDs).
