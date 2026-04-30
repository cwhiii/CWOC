# Requirements Document

## Introduction

CWOC (C.W.'s Omni Chits) is currently a single-user application deployed on a Proxmox LXC container. This feature introduces the multi-user foundation: user accounts with authentication, per-user data isolation, session management, a login page, a user profile page, a user switcher, user administration, and proper audit log attribution. All chits, contacts, and settings become scoped to individual users, with existing data migrated to a default admin account.

This is the first of two projects. The second project (Chit Sharing System) will build on this foundation to add chit-level and tag-level sharing with roles, stealth chits, chit assignment, shared calendars, and wall station views.

## Glossary

- **CWOC**: C.W.'s Omni Chits — the application under development
- **Auth_Service**: The backend authentication module responsible for login, session management, and password hashing
- **User_Store**: The database layer that persists user account records (the `users` table)
- **Session_Manager**: The component that creates, validates, and expires session tokens stored as HTTP-only cookies
- **Chit_Service**: The backend module responsible for chit CRUD operations, now extended with ownership logic
- **Profile_Page**: The frontend page where a user views and edits their own contact info and password
- **User_Switcher**: The frontend UI component that allows switching between user accounts without a full page reload
- **Owner_Record**: A composite field on each chit containing the owner's UUID, friendly display name, and username

## Requirements

### Requirement 1: User Account Storage

**User Story:** As an instance administrator, I want user accounts stored in the database, so that each person on the CWOC instance has a distinct identity.

#### Acceptance Criteria

1. THE User_Store SHALL persist each user account with a UUID primary key, a unique username, a display name, an email address, a hashed password, a created datetime, a modified datetime, and an active flag
2. THE User_Store SHALL enforce uniqueness on the username column so that no two accounts share the same username
3. WHEN a new user account is created, THE User_Store SHALL generate a UUID v4 as the account identifier
4. THE User_Store SHALL store passwords using a one-way hash with a per-user salt so that plaintext passwords are never persisted
5. WHEN the CWOC instance starts for the first time with the multi-user migration, THE User_Store SHALL create a default admin account seeded from the existing `default_user` settings record

### Requirement 2: User Authentication

**User Story:** As a user, I want to log in with my username and password, so that I can access my own chits, contacts, and settings.

#### Acceptance Criteria

1. WHEN a user submits valid credentials to the login endpoint, THE Auth_Service SHALL return a session token as an HTTP-only cookie
2. WHEN a user submits invalid credentials, THE Auth_Service SHALL return a 401 status with a generic error message that does not reveal whether the username or password was incorrect
3. WHEN a user sends a request with an expired or missing session token, THE Auth_Service SHALL return a 401 status and redirect the frontend to the login page
4. WHEN a user calls the logout endpoint, THE Session_Manager SHALL invalidate the session token so that it cannot be reused
5. THE Auth_Service SHALL rate-limit login attempts to a maximum of 10 failed attempts per username within a 15-minute window
6. IF a login attempt exceeds the rate limit, THEN THE Auth_Service SHALL return a 429 status with a message indicating the user should wait before retrying

### Requirement 3: Session Management

**User Story:** As a user, I want my login session to persist across page reloads, so that I do not have to re-authenticate on every navigation.

#### Acceptance Criteria

1. THE Session_Manager SHALL store sessions in a `sessions` database table with a session token, user UUID, created datetime, expires datetime, and last-active datetime
2. WHEN a session token is validated, THE Session_Manager SHALL update the last-active datetime to the current time
3. THE Session_Manager SHALL expire sessions that have been inactive for more than 24 hours
4. WHEN a session expires, THE Session_Manager SHALL remove the session record from the database
5. THE Session_Manager SHALL allow a single user to have multiple concurrent sessions so that the same account can be used on multiple devices

### Requirement 4: Per-User Data Isolation

**User Story:** As a user, I want my chits, contacts, and settings to be private by default, so that other users on the instance cannot see my data unless I share it.

#### Acceptance Criteria

1. THE Chit_Service SHALL add an `owner_id` column to the `chits` table referencing the owning user's UUID
2. THE Chit_Service SHALL add an `owner_id` column to the `contacts` table referencing the owning user's UUID
3. WHEN a user queries chits via the API, THE Chit_Service SHALL return only chits owned by the authenticated user
4. WHEN a user queries contacts via the API, THE Chit_Service SHALL return only contacts owned by the authenticated user
5. THE Chit_Service SHALL scope the `settings` table rows by `user_id` so that each user has an independent settings record
6. WHEN the multi-user migration runs, THE Chit_Service SHALL assign all existing chits, contacts, and settings to the default admin account

### Requirement 5: Chit Ownership Field

**User Story:** As a user, I want each chit to display who owns it, so that I can identify the creator when the sharing system is added later.

#### Acceptance Criteria

1. THE Chit_Service SHALL store an Owner_Record on each chit containing the owner's UUID, display name, and username
2. WHEN a chit is created, THE Chit_Service SHALL populate the Owner_Record from the authenticated user's account
3. WHEN a chit's Owner_Record is returned via the API, THE Chit_Service SHALL include the `owner_id`, `owner_display_name`, and `owner_username` fields in the JSON response
4. THE Chit_Service SHALL display the owner's display name on chit cards in the dashboard and editor views

### Requirement 6: Login Page

**User Story:** As an unauthenticated user, I want a login page, so that I can enter my credentials and access the application.

#### Acceptance Criteria

1. THE Auth_Service SHALL serve a login page at the `/login` route that follows the CWOC parchment visual theme
2. THE Auth_Service SHALL present username and password input fields and a submit button on the login page
3. WHEN valid credentials are submitted, THE Auth_Service SHALL redirect the user to the main dashboard
4. WHEN invalid credentials are submitted, THE Auth_Service SHALL display an error message on the login page without revealing which field was incorrect
5. WHILE no valid session exists, THE Auth_Service SHALL redirect all page requests (except the login page and health check) to the login page

### Requirement 7: User Profile Page

**User Story:** As a user, I want a profile page where I can update my display name, email, and password, so that I can manage my account information.

#### Acceptance Criteria

1. THE Profile_Page SHALL display the authenticated user's username (read-only), display name (editable), and email address (editable)
2. WHEN a user submits updated profile fields, THE Auth_Service SHALL validate and persist the changes to the User_Store
3. WHEN a user submits a password change, THE Auth_Service SHALL require the current password for verification before accepting the new password
4. IF the current password verification fails during a password change, THEN THE Auth_Service SHALL return a 403 status and not update the password
5. THE Profile_Page SHALL use the existing `CwocSaveSystem` pattern for save and cancel buttons
6. THE Profile_Page SHALL follow the shared page system (`shared-page.css`, `shared-page.js`) with a `data-page-title` attribute for consistent header and footer injection

### Requirement 8: User Switcher

**User Story:** As a user on a shared device, I want to switch to a different user account without navigating to a separate login page, so that account switching is fast and convenient.

#### Acceptance Criteria

1. THE User_Switcher SHALL appear as the rightmost element in the top bar, displaying the current user's profile image (or a default avatar if no image is set)
2. WHEN a user hovers over the User_Switcher, THE User_Switcher SHALL display the current user's username as a tooltip
3. WHEN a user clicks the User_Switcher, THE User_Switcher SHALL open a modal listing all active user accounts on the instance, each showing their profile image (or default avatar) and display name
4. WHEN a user selects a different account from the modal, THE User_Switcher SHALL require that account's password before switching — the switch SHALL NOT proceed without valid authentication
5. WHEN valid credentials are provided, THE Session_Manager SHALL create a new session for the selected account and invalidate the previous session
6. AFTER a successful switch, THE User_Switcher SHALL reload the page to reflect the new user's data
7. THE User_Switcher SHALL allow switching back to any other active account using the same password-prompt flow

### Requirement 9: Data Migration for Multi-User

**User Story:** As an instance administrator upgrading from single-user to multi-user, I want existing data migrated cleanly, so that no chits, contacts, or settings are lost.

#### Acceptance Criteria

1. WHEN the multi-user migration runs, THE User_Store SHALL create a `users` table if it does not exist
2. WHEN the multi-user migration runs, THE User_Store SHALL create a default admin user account with a configurable initial password
3. WHEN the multi-user migration runs, THE Chit_Service SHALL add an `owner_id` column to the `chits` table if it does not exist
4. WHEN the multi-user migration runs, THE Chit_Service SHALL set the `owner_id` of all existing chits to the default admin user's UUID
5. WHEN the multi-user migration runs, THE Chit_Service SHALL add an `owner_id` column to the `contacts` table and set all existing contacts to the default admin user's UUID
6. WHEN the multi-user migration runs, THE Session_Manager SHALL create a `sessions` table if it does not exist
7. THE migration SHALL follow the existing inline migration pattern in `migrations.py` with column-existence checks so that it is safe to run multiple times

### Requirement 10: API Authentication Middleware

**User Story:** As a developer, I want all API endpoints protected by authentication middleware, so that unauthenticated requests cannot access user data.

#### Acceptance Criteria

1. THE Auth_Service SHALL apply authentication middleware to all `/api/` routes except the login endpoint and health check
2. WHEN an authenticated request is processed, THE Auth_Service SHALL inject the authenticated user's UUID into the request context so that route handlers can scope queries by user
3. IF a request lacks a valid session token, THEN THE Auth_Service SHALL return a 401 status with a JSON error body
4. THE Auth_Service SHALL not require authentication for the `/health` endpoint, the login page, or static file serving

### Requirement 11: Audit Log Multi-User Attribution

**User Story:** As an instance administrator, I want audit log entries to record which user performed each action, so that changes are traceable to individual accounts.

#### Acceptance Criteria

1. WHEN an auditable action occurs, THE Chit_Service SHALL record the authenticated user's UUID and username as the actor in the audit log entry
2. THE Chit_Service SHALL replace the current `get_current_actor()` function (which reads from settings) with a function that reads the authenticated user from the request context
3. WHEN viewing the audit log, THE Chit_Service SHALL display the actor's display name alongside each entry

### Requirement 12: Settings Username Deprecation

**User Story:** As a user, I want the settings page to no longer show a username field, so that my identity is managed through my user account rather than a free-text settings field.

#### Acceptance Criteria

1. THE Chit_Service SHALL remove the `username` field from the settings page UI
2. THE migration SHALL preserve the existing `username` value from settings by using it as the default admin account's `display_name` during migration
3. THE Chit_Service SHALL retain the `username` column in the `settings` database table for backward compatibility but SHALL NOT display it in the settings UI
4. THE settings page SHALL include a "Manage Users" button that navigates to the User Admin page
5. WHEN a non-admin user views the settings page, THE "Manage Users" button SHALL be greyed out (disabled) with a hover tooltip indicating admin access is required

### Requirement 13: User Administration

**User Story:** As an instance administrator, I want to create, deactivate, and manage user accounts, so that I can control who has access to the CWOC instance.

#### Acceptance Criteria

1. THE User_Store SHALL support an `is_admin` boolean flag on user accounts to distinguish administrators from regular users
2. WHEN an admin user accesses the user administration interface, THE User_Store SHALL list all user accounts with their username, display name, email, active status, and admin status
3. WHEN an admin creates a new user account, THE User_Store SHALL require a username, display name, and initial password
4. WHEN an admin deactivates a user account, THE Session_Manager SHALL invalidate all active sessions for that user and THE Auth_Service SHALL reject future login attempts for that account
5. WHEN an admin reactivates a user account, THE Auth_Service SHALL allow login attempts for that account again
6. THE User_Store SHALL prevent deactivation of the last remaining admin account so that the instance always has at least one administrator
