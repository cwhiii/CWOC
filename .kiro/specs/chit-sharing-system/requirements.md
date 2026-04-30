# Requirements Document

## Introduction

This is the second of two projects for the CWOC multi-user system. The first project (Multi-User System) has been completed and established:
- User accounts (`users` table with `id`, `username`, `display_name`, `email`, `password_hash`, `is_admin`, `is_active`, `profile_image_url`, timestamps)
- Session-based authentication (`sessions` table, `cwoc_session` cookie, 24h lifetime + 24h inactivity timeout)
- Per-user data isolation (`owner_id` column on `chits`, `contacts`, `standalone_alerts`, `alert_state` tables)
- Auth middleware (`middleware.py`) that injects `request.state.user_id` and `request.state.username` on every authenticated request
- Admin user management (`/api/users` endpoints for create, deactivate, reactivate, reset password, update)
- Frontend auth guard (`shared-auth.js` with `getCurrentUser()`, `isAdmin()`, `waitForAuth()`)
- User switcher modal in the shared page header and dashboard top bar
- Profile page with display name, email, password change, and profile image upload

This project builds on that foundation to add chit-level and tag-level sharing with role-based access control (Owner / Manager / Viewer), a permission resolution engine, stealth chits, chit assignment with an "Assigned to Me" view, shared calendars, a tag editor overhaul for managing sharing, and a multi-owner wall station view.

**Prerequisite:** The Multi-User System (Project 1) is complete.

## Glossary

- **CWOC**: C.W.'s Omni Chits — the application under development
- **Chit_Service**: The backend route modules (`routes/chits.py` and related) responsible for chit CRUD operations, extended with sharing logic
- **Sharing_Engine**: New backend logic (can live in a new `routes/sharing.py` or extend existing routes) that evaluates sharing rules (chit-level roles, tag-level roles, and assignment) to determine cross-user access and resolve the effective permission level
- **Stealth_Flag**: A boolean column (`stealth`) on the `chits` table that hides a chit from all users except the owner, overriding all sharing rules
- **Assigned_User**: A user UUID stored in the `assigned_to` column on the `chits` table indicating who the chit is assigned to (distinct from the owner)
- **Wall_Station_View**: A dashboard mode that displays chits from multiple selected users, intended for shared screens or common areas
- **Owner**: The user whose `id` matches the chit's `owner_id` — has full control (edit, delete, manage sharing)
- **Manager**: A sharing role that grants a user edit access to a chit but not delete or sharing-management rights
- **Viewer**: A sharing role that grants a user read-only access to a chit
- **request.state.user_id**: The authenticated user's UUID, injected by `AuthMiddleware` on every request
- **owner_id**: The existing column on `chits`, `contacts`, `standalone_alerts`, and `alert_state` tables that identifies the record owner

## Requirements

### Requirement 1: Chit-Level Sharing with Roles

**User Story:** As a user, I want to share individual chits with specific users and control what they can do, so that I can collaborate on specific items with the right level of access.

#### Acceptance Criteria

1. THE Chit_Service SHALL store a `shares` JSON column on the `chits` table as a JSON array of objects, each containing a `user_id` (UUID from the `users` table) and a `role` field where role is one of `manager` or `viewer`
2. WHEN a chit owner adds a user to the chit's `shares` list with the `viewer` role, THE Sharing_Engine SHALL make that chit visible to the specified user in read-only mode
3. WHEN a chit owner adds a user to the chit's `shares` list with the `manager` role, THE Sharing_Engine SHALL make that chit visible to the specified user and allow the specified user to edit the chit's content
4. THE Sharing_Engine SHALL restrict delete and sharing-management operations to the chit owner (where `owner_id = request.state.user_id`) regardless of other users' roles
5. WHEN a chit owner removes a user from the chit's `shares` list, THE Sharing_Engine SHALL revoke that user's access to the chit
6. THE Chit_Service SHALL provide a sharing panel in the chit editor where the owner can add users (selected from the `users` table via `/api/users` or a new lightweight endpoint), assign roles, and remove users from the chit's `shares` list

### Requirement 2: Tag-Based Sharing with Roles

**User Story:** As a user, I want to share all chits under a specific tag with selected users and control their access level, so that I can grant structured access to a category of chits like a shared calendar.

#### Acceptance Criteria

1. THE Sharing_Engine SHALL support a `shared_tags` JSON column on the `settings` table, where the value is a JSON array of objects each containing a `tag` name and a `shares` list of objects with `user_id` and `role` (one of `manager` or `viewer`)
2. WHEN a user configures a tag in their `shared_tags` list with a user assigned the `viewer` role, THE Sharing_Engine SHALL make all of the owning user's chits carrying that tag visible to the specified user in read-only mode
3. WHEN a user configures a tag in their `shared_tags` list with a user assigned the `manager` role, THE Sharing_Engine SHALL make all of the owning user's chits carrying that tag visible to the specified user and allow the specified user to edit those chits
4. WHEN a user removes a tag from their `shared_tags` list, THE Sharing_Engine SHALL revoke access to all chits under that tag for all previously shared users
5. WHEN a user removes a specific user from a tag's share list, THE Sharing_Engine SHALL revoke that user's tag-based access to chits under that tag
6. THE Sharing_Engine SHALL restrict delete operations on tag-shared chits to the chit owner (where `owner_id` matches) regardless of the shared user's role
7. THE Chit_Service SHALL provide a tag sharing interface in the settings page where the user can select from their existing tags (stored in `settings.tags` as a JSON array of `{name, color, fontColor, favorite}` objects), add users, and assign roles

### Requirement 3: Tag Editor Overhaul for Sharing

**User Story:** As a user, I want the tag management interface in settings to support sharing configuration, so that I can manage who has access to each tag's chits and at what level.

#### Acceptance Criteria

1. THE Chit_Service SHALL extend the existing tag editor in the settings page (currently in `src/frontend/js/pages/settings.js`) to display sharing status for each tag
2. WHEN a user selects a tag in the tag editor, THE Chit_Service SHALL show a sharing configuration panel listing current share recipients (fetched from the user list via `/api/users` or `/api/auth/switchable-users`) with their roles
3. THE Chit_Service SHALL provide controls in the tag sharing panel to add a user, select a role (manager or viewer), and save the share configuration
4. THE Chit_Service SHALL provide controls to remove a user from a tag's share list
5. THE Chit_Service SHALL display a visual indicator on tags that have active sharing configurations so the user can see at a glance which tags are shared

### Requirement 4: Shared Calendars via Tag-Based Sharing

**User Story:** As a user, I want to see shared chits on my calendar view, so that I can coordinate schedules with other users on the instance.

#### Acceptance Criteria

1. WHEN the calendar view renders, THE Chit_Service SHALL include chits shared with the authenticated user (via tag-based sharing or chit-level sharing) that have date fields (`start_datetime`, `end_datetime`, or `due_datetime`)
2. THE Chit_Service SHALL visually distinguish shared calendar events from the user's own events by displaying the `owner_display_name` (already stored on each chit) on the event
3. WHEN a user clicks a shared calendar event where the user has the `viewer` role, THE Chit_Service SHALL open the chit in read-only mode
4. WHEN a user clicks a shared calendar event where the user has the `manager` role, THE Chit_Service SHALL open the chit in edit mode

### Requirement 5: Permission Resolution

**User Story:** As a user with access to a chit through multiple sharing paths, I want the system to grant me the highest level of access available, so that I do not lose editing ability due to a lower-priority sharing rule.

#### Acceptance Criteria

1. WHEN a user has access to a chit through multiple paths (chit-level sharing, tag-based sharing, or assignment), THE Sharing_Engine SHALL grant the user the highest role across all paths
2. THE Sharing_Engine SHALL evaluate roles in the following precedence order from highest to lowest: owner, manager, viewer
3. WHEN `request.state.user_id` matches the chit's `owner_id`, THE Sharing_Engine SHALL grant full control regardless of any other sharing rules
4. WHEN a chit's `stealth` column is true, THE Sharing_Engine SHALL override all sharing rules and hide the chit from all non-owner users

### Requirement 6: Stealth Chits

**User Story:** As a user, I want to mark a chit as stealth so that it is hidden from all other users, even if it would otherwise be shared via tag or chit-level sharing.

#### Acceptance Criteria

1. THE Chit_Service SHALL add a `stealth` boolean column to the `chits` table (via a new migration in `migrations.py`), defaulting to 0 (false)
2. WHEN a chit's `stealth` column is set to true (1), THE Sharing_Engine SHALL exclude that chit from all other users' query results regardless of the chit's `shares` list or tag-based sharing rules
3. WHEN the owner queries their own chits (via `GET /api/chits` where `owner_id = request.state.user_id`), THE Chit_Service SHALL include stealth chits in the results
4. THE Chit_Service SHALL provide a toggle in the chit editor to set or clear the stealth flag
5. THE Chit_Service SHALL display a visual indicator on stealth chits in the owner's dashboard view so the owner knows which chits are hidden from others

### Requirement 7: Chit Assignment

**User Story:** As a user, I want to assign a chit to another user, so that I can delegate tasks and track who is responsible.

#### Acceptance Criteria

1. THE Chit_Service SHALL add an `assigned_to` column to the `chits` table (via a new migration in `migrations.py`) storing the Assigned_User's UUID (referencing `users.id`)
2. WHEN a chit is assigned to a user, THE Chit_Service SHALL make that chit visible to the Assigned_User in addition to normal sharing rules (the assignment grants at minimum `viewer` access, or `manager` if the owner configures it)
3. THE Chit_Service SHALL provide a "Chits Assigned to Me" filtered view on the dashboard that shows all chits where `assigned_to = request.state.user_id`
4. WHEN a chit is assigned to a user, THE Chit_Service SHALL display the assignee's display name on the chit card (fetched from the `users` table)
5. THE Chit_Service SHALL allow the chit owner to change or remove the assignment at any time via the chit editor

### Requirement 8: Multi-Owner Wall Station View

**User Story:** As a household or team, I want a wall station mode that shows chits from multiple selected users on a shared screen, so that common-area displays show a combined view.

#### Acceptance Criteria

1. THE Wall_Station_View SHALL accept a list of user UUIDs as a configuration parameter and display chits owned by or shared with any of those users
2. THE Wall_Station_View SHALL combine calendar events from all selected users into a single calendar view with `owner_display_name` attribution
3. THE Wall_Station_View SHALL combine task lists from all selected users into a single task view with `owner_display_name` attribution
4. THE Wall_Station_View SHALL operate without requiring authentication — its URL path must be added to the `_is_excluded()` list in `middleware.py` so that a shared screen can display the view without a logged-in session
5. THE Wall_Station_View SHALL refresh its data on the same sync interval as the standard dashboard (polling fallback or WebSocket if implemented)

### Requirement 9: Data Migration for Sharing

**User Story:** As an instance administrator, I want the sharing columns added to the database cleanly, so that the sharing system works on top of the existing multi-user foundation.

#### Acceptance Criteria

1. WHEN the sharing migration runs, THE Chit_Service SHALL add `shares` (TEXT, default NULL), `stealth` (BOOLEAN, default 0), and `assigned_to` (TEXT, default NULL) columns to the `chits` table if they do not exist
2. WHEN the sharing migration runs, THE Chit_Service SHALL add a `shared_tags` (TEXT, default NULL) column to the `settings` table if it does not exist
3. THE migration SHALL follow the existing inline migration pattern in `migrations.py` with column-existence checks (`PRAGMA table_info` + check if column name is in the set) so that it is safe to run multiple times
4. THE migration SHALL not modify any existing data — new columns SHALL default to empty/NULL or false (0)
5. THE migration SHALL be registered in `main.py`'s startup migration sequence after `migrate_add_multi_user()` and the subsequent user-related migrations (`migrate_add_user_profile_image`, `migrate_add_alerts_owner_id`, `migrate_add_login_message`, `migrate_add_instance_name`)

