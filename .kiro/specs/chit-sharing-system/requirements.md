# Requirements Document

## Introduction

This is the second of two projects for the CWOC multi-user system. The first project (Multi-User System) established user accounts, authentication, sessions, per-user data isolation, and the ownership model. This project builds on that foundation to add chit-level and tag-level sharing with role-based access control (Owner / Manager / Viewer), a permission resolution engine, stealth chits, chit assignment with an "Assigned to Me" view, shared calendars, a tag editor overhaul for managing sharing, and a multi-owner wall station view.

**Prerequisite:** The Multi-User System (Project 1) must be completed before this project begins.

## Glossary

- **CWOC**: C.W.'s Omni Chits — the application under development
- **Chit_Service**: The backend module responsible for chit CRUD operations, extended with sharing logic
- **Sharing_Engine**: The backend module that evaluates sharing rules (chit-level roles, tag-level roles, and assignment) to determine cross-user access and resolve the effective permission level
- **Stealth_Flag**: A boolean attribute on a chit that hides it from all users except the owner, overriding all sharing rules
- **Assigned_User**: A user UUID stored on a chit indicating who the chit is assigned to (distinct from the owner)
- **Wall_Station_View**: A dashboard mode that displays chits from multiple selected users, intended for shared screens or common areas
- **Owner**: The user who created a chit — has full control (edit, delete, manage sharing)
- **Manager**: A sharing role that grants a user edit access to a chit but not delete or sharing-management rights
- **Viewer**: A sharing role that grants a user read-only access to a chit

## Requirements

### Requirement 1: Chit-Level Sharing with Roles

**User Story:** As a user, I want to share individual chits with specific users and control what they can do, so that I can collaborate on specific items with the right level of access.

#### Acceptance Criteria

1. THE Chit_Service SHALL store a `shares` list on each chit as a JSON array of objects, each containing a `user_id` and a `role` field where role is one of `manager` or `viewer`
2. WHEN a chit owner adds a user to the chit's `shares` list with the `viewer` role, THE Sharing_Engine SHALL make that chit visible to the specified user in read-only mode
3. WHEN a chit owner adds a user to the chit's `shares` list with the `manager` role, THE Sharing_Engine SHALL make that chit visible to the specified user and allow the specified user to edit the chit's content
4. THE Sharing_Engine SHALL restrict delete and sharing-management operations to the chit owner regardless of other users' roles
5. WHEN a chit owner removes a user from the chit's `shares` list, THE Sharing_Engine SHALL revoke that user's access to the chit
6. THE Chit_Service SHALL provide a sharing panel in the chit editor where the owner can add users, assign roles, and remove users from the chit's `shares` list

### Requirement 2: Tag-Based Sharing with Roles

**User Story:** As a user, I want to share all chits under a specific tag with selected users and control their access level, so that I can grant structured access to a category of chits like a shared calendar.

#### Acceptance Criteria

1. THE Sharing_Engine SHALL support a `shared_tags` list on each user's settings record, where each entry contains a tag name and a list of share objects with `user_id` and `role` (one of `manager` or `viewer`)
2. WHEN a user configures a tag in their `shared_tags` list with a user assigned the `viewer` role, THE Sharing_Engine SHALL make all of the owning user's chits carrying that tag visible to the specified user in read-only mode
3. WHEN a user configures a tag in their `shared_tags` list with a user assigned the `manager` role, THE Sharing_Engine SHALL make all of the owning user's chits carrying that tag visible to the specified user and allow the specified user to edit those chits
4. WHEN a user removes a tag from their `shared_tags` list, THE Sharing_Engine SHALL revoke access to all chits under that tag for all previously shared users
5. WHEN a user removes a specific user from a tag's share list, THE Sharing_Engine SHALL revoke that user's tag-based access to chits under that tag
6. THE Sharing_Engine SHALL restrict delete operations on tag-shared chits to the chit owner regardless of the shared user's role
7. THE Chit_Service SHALL provide a tag sharing interface in the settings page where the user can select tags, add users, and assign roles

### Requirement 3: Tag Editor Overhaul for Sharing

**User Story:** As a user, I want the tag management interface in settings to support sharing configuration, so that I can manage who has access to each tag's chits and at what level.

#### Acceptance Criteria

1. THE Chit_Service SHALL extend the existing tag editor in the settings page to display sharing status for each tag
2. WHEN a user selects a tag in the tag editor, THE Chit_Service SHALL show a sharing configuration panel listing current share recipients with their roles
3. THE Chit_Service SHALL provide controls in the tag sharing panel to add a user, select a role (manager or viewer), and save the share configuration
4. THE Chit_Service SHALL provide controls to remove a user from a tag's share list
5. THE Chit_Service SHALL display a visual indicator on tags that have active sharing configurations so the user can see at a glance which tags are shared

### Requirement 4: Shared Calendars via Tag-Based Sharing

**User Story:** As a user, I want to see shared chits on my calendar view, so that I can coordinate schedules with other users on the instance.

#### Acceptance Criteria

1. WHEN the calendar view renders, THE Chit_Service SHALL include chits shared with the authenticated user via tag-based sharing that have date fields (`start_datetime`, `end_datetime`, or `due_datetime`)
2. THE Chit_Service SHALL visually distinguish shared calendar events from the user's own events by displaying the owner's display name on the event
3. WHEN a user clicks a shared calendar event where the user has the `viewer` role, THE Chit_Service SHALL open the chit in read-only mode
4. WHEN a user clicks a shared calendar event where the user has the `manager` role, THE Chit_Service SHALL open the chit in edit mode

### Requirement 5: Permission Resolution

**User Story:** As a user with access to a chit through multiple sharing paths, I want the system to grant me the highest level of access available, so that I do not lose editing ability due to a lower-priority sharing rule.

#### Acceptance Criteria

1. WHEN a user has access to a chit through multiple paths (chit-level sharing, tag-based sharing, or assignment), THE Sharing_Engine SHALL grant the user the highest role across all paths
2. THE Sharing_Engine SHALL evaluate roles in the following precedence order from highest to lowest: owner, manager, viewer
3. WHEN a user is the chit owner, THE Sharing_Engine SHALL grant full control regardless of any other sharing rules
4. WHEN a chit's Stealth_Flag is true, THE Sharing_Engine SHALL override all sharing rules and hide the chit from all non-owner users

### Requirement 6: Stealth Chits

**User Story:** As a user, I want to mark a chit as stealth so that it is hidden from all other users, even if it would otherwise be shared via tag or chit-level sharing.

#### Acceptance Criteria

1. THE Chit_Service SHALL add a `stealth` boolean column to the `chits` table, defaulting to false
2. WHEN a chit's Stealth_Flag is set to true, THE Sharing_Engine SHALL exclude that chit from all other users' query results regardless of the chit's `shares` list or tag-based sharing rules
3. WHEN the owner queries their own chits, THE Chit_Service SHALL include stealth chits in the results
4. THE Chit_Service SHALL provide a toggle in the chit editor to set or clear the Stealth_Flag
5. THE Chit_Service SHALL display a visual indicator on stealth chits in the owner's dashboard view so the owner knows which chits are hidden from others

### Requirement 7: Chit Assignment

**User Story:** As a user, I want to assign a chit to another user, so that I can delegate tasks and track who is responsible.

#### Acceptance Criteria

1. THE Chit_Service SHALL add an `assigned_to` column to the `chits` table storing the Assigned_User's UUID
2. WHEN a chit is assigned to a user, THE Chit_Service SHALL make that chit visible to the Assigned_User in addition to normal sharing rules
3. THE Chit_Service SHALL provide a "Chits Assigned to Me" filtered view on the dashboard that shows all chits where the authenticated user is the Assigned_User
4. WHEN a chit is assigned to a user, THE Chit_Service SHALL display the assignee's display name on the chit card
5. THE Chit_Service SHALL allow the chit owner to change or remove the assignment at any time

### Requirement 8: Multi-Owner Wall Station View

**User Story:** As a household or team, I want a wall station mode that shows chits from multiple selected users on a shared screen, so that common-area displays show a combined view.

#### Acceptance Criteria

1. THE Wall_Station_View SHALL accept a list of user UUIDs as a configuration parameter and display chits owned by or shared with any of those users
2. THE Wall_Station_View SHALL combine calendar events from all selected users into a single calendar view with owner attribution
3. THE Wall_Station_View SHALL combine task lists from all selected users into a single task view with owner attribution
4. THE Wall_Station_View SHALL operate without requiring authentication so that a shared screen can display the view without a logged-in session
5. THE Wall_Station_View SHALL refresh its data on the same sync interval as the standard dashboard (WebSocket or polling fallback)

### Requirement 9: Data Migration for Sharing

**User Story:** As an instance administrator, I want the sharing columns added to the database cleanly, so that the sharing system works on top of the existing multi-user foundation.

#### Acceptance Criteria

1. WHEN the sharing migration runs, THE Chit_Service SHALL add `shares`, `stealth`, and `assigned_to` columns to the `chits` table if they do not exist
2. WHEN the sharing migration runs, THE Chit_Service SHALL add a `shared_tags` column to the `settings` table if it does not exist
3. THE migration SHALL follow the existing inline migration pattern in `migrations.py` with column-existence checks so that it is safe to run multiple times
4. THE migration SHALL not modify any existing data — new columns SHALL default to empty or false
