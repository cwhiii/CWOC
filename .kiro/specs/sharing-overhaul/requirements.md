# Requirements Document: Sharing Overhaul

## Introduction

A comprehensive overhaul of the CWOC chit sharing system. The existing sharing model is replaced with two explicit user-interaction paths (Invite and Assign), expanded manager permissions, a new notification inbox, enhanced tag-level sharing with sub-tag propagation and per-user management toggles, new dashboard sidebar sharing filters, and a People zone expand modal. Contacts remain informational-only and unchanged.

## Glossary

- **Chit**: The core data unit in CWOC — a flexible record that can serve as a task, note, calendar event, alarm, checklist, or project.
- **Editor**: The chit editor page (`editor.html`) where users view and modify a single chit's fields.
- **Dashboard**: The main page (`index.html`) showing all chit views (Calendar, Checklists, Alarms, Projects, Tasks, Notes).
- **Sidebar**: The left-hand navigation panel on the Dashboard containing filters, actions, and navigation buttons.
- **People_Zone**: The collapsible zone in the Editor that displays contacts, system users, sharing controls, stealth toggle, and assigned-to dropdown.
- **Sharing_Engine**: The backend permission resolution module (`sharing.py`) that determines a user's effective role on a chit across all sharing paths.
- **Notification_System**: A new backend and frontend subsystem that creates, stores, and displays notifications when chits are shared with users.
- **Notification_Inbox**: A new UI component in the Dashboard sidebar that displays pending notifications for the current user.
- **Tag_Management_Modal**: The modal dialog in the Settings page used to edit a tag's name, color, and sharing configuration.
- **Owner**: The user who created a chit. Has full control over all fields including stealth.
- **Manager**: A user with edit access to a chit via invite (with manager role), assignment, or tag-level sharing. Can edit all fields except stealth.
- **Viewer**: A user with read-only access to a chit via invite (with viewer role) or tag-level sharing.
- **Invite**: The action of adding a system user to a chit with a viewer or manager role, triggering RSVP flow and notification.
- **Assign**: The action of designating a single system user as the responsible party for a chit, which automatically adds them to shares as a manager.
- **Contact**: An informational-only person record from the Rolodex, stored in `chit.people` as display name strings. No permissions or cross-user effects.
- **RSVP**: The accept/decline flow for chit-level invitations. Declined chits appear faded (ghost mode) or hidden based on user settings.
- **Stealth**: An owner-only flag that hides a chit from all non-owner users, overriding all sharing paths.
- **Tag_Creator**: The user who originally created a tag and configured its sharing. Tag sharing configuration is stored in the Tag_Creator's settings.
- **People_Expand_Modal**: A new nearly full-screen modal accessible from the People_Zone that shows all people associated with a chit in an alphabetical list.

## Requirements

### Requirement 1: Invite Action

**User Story:** As a chit owner or manager, I want to invite a system user to a chit with a specific role, so that the invitee gains access and receives a notification.

#### Acceptance Criteria

1. WHEN an Owner or Manager clicks a system user chip in the People_Zone left column, THE Editor SHALL add that user to the chit's shares array with role "viewer" and rsvp_status "invited".
2. WHEN an Owner or Manager clicks a system user chip in the People_Zone left column, THE Editor SHALL display the invited user in the right column with an RSVP badge, a Viewer/Manager pill toggle, and a remove button.
3. WHEN an Owner or Manager toggles the role pill from Viewer to Manager for an invited user, THE Editor SHALL update that user's role in the shares array to "manager".
4. WHEN an Owner or Manager toggles the role pill from Manager to Viewer for an invited user, THE Editor SHALL update that user's role in the shares array to "viewer".
5. WHEN a chit with new share entries is saved, THE Notification_System SHALL create a notification for each newly invited user.
6. THE Editor SHALL prevent a user from inviting themselves to a chit.

### Requirement 2: Assign Action

**User Story:** As a chit owner or manager, I want to assign a system user to a chit, so that the assignee automatically becomes a manager and receives a notification.

#### Acceptance Criteria

1. WHEN an Owner or Manager selects a user from the assigned-to dropdown, THE Editor SHALL set the chit's `assigned_to` field to that user's ID.
2. WHEN an Owner or Manager selects a user from the assigned-to dropdown who is not already in the shares array, THE Editor SHALL automatically add that user to the shares array with role "manager" and rsvp_status "invited".
3. WHEN an Owner or Manager selects a user from the assigned-to dropdown who is already in the shares array with role "viewer", THE Editor SHALL upgrade that user's role to "manager" in the shares array.
4. WHEN a chit is saved with a newly assigned user, THE Notification_System SHALL create a notification for the assigned user.
5. THE Editor SHALL populate the assigned-to dropdown with the chit owner and all system users (not limited to current shares), so that assigning a user who is not yet shared automatically adds them.

### Requirement 3: Manager Permission Expansion

**User Story:** As a manager on a shared chit, I want to be able to edit shares, assigned_to, and delete the chit, so that I have meaningful management capability.

#### Acceptance Criteria

1. WHEN a Manager saves a chit with modified shares, THE Sharing_Engine SHALL persist the updated shares array (the backend no longer silently preserves the original shares for managers).
2. WHEN a Manager saves a chit with a modified assigned_to value, THE Sharing_Engine SHALL persist the updated assigned_to value (the backend no longer silently preserves the original assigned_to for managers).
3. WHEN a Manager attempts to change the stealth flag, THE Sharing_Engine SHALL silently preserve the existing stealth value (stealth remains owner-only).
4. WHEN a Manager sends a DELETE request for a chit, THE Sharing_Engine SHALL soft-delete the chit (managers can now delete chits).
5. WHEN a Manager updates their own RSVP status, THE Sharing_Engine SHALL persist the change. WHEN a Manager attempts to update another user's RSVP status, THE Sharing_Engine SHALL reject the request with a 403 error.
6. THE Sharing_Engine SHALL resolve `can_manage_sharing()` to true for managers, and the `update_chit()` backend handler SHALL allow managers to modify shares and assigned_to fields, resolving the existing inconsistency.

### Requirement 4: Notification System

**User Story:** As a user, I want to receive notifications when chits are shared with me, so that I am aware of new invitations and assignments without having to discover them manually.

#### Acceptance Criteria

1. WHEN a chit is shared with a user (via invite or assign), THE Notification_System SHALL create a notification record containing the chit title, chit ID, owner display name, notification type (invited or assigned), and a created timestamp.
2. THE Notification_System SHALL provide a GET endpoint that returns all notifications for the authenticated user, ordered by creation time descending.
3. WHEN a user accepts or declines a notification, THE Notification_System SHALL update the notification status to "accepted" or "declined" and update the corresponding RSVP status on the chit's shares entry.
4. WHEN a user accepts or declines from the chit Editor RSVP controls, THE Notification_System SHALL update the corresponding notification status to match.
5. THE Notification_System SHALL store notifications in a new `notifications` table with columns: id, user_id, chit_id, chit_title, owner_display_name, notification_type, status, created_datetime.
6. THE Notification_System SHALL provide a DELETE endpoint to dismiss a notification by ID.

### Requirement 5: Notification Inbox UI

**User Story:** As a user, I want a notification inbox in the dashboard sidebar, so that I can see and act on sharing notifications without leaving the dashboard.

#### Acceptance Criteria

1. THE Dashboard SHALL display a Notification_Inbox component in the sidebar, positioned between the Contacts/Clock/Weather section and the bottom-pinned Settings button.
2. WHEN the Dashboard loads, THE Notification_Inbox SHALL fetch notifications from the Notification_System API and display a count badge showing the number of unread (status = "pending") notifications.
3. WHEN the user clicks the Notification_Inbox button, THE Notification_Inbox SHALL expand to show a list of pending notifications, each displaying the chit title, owner display name, and Accept/Decline buttons.
4. WHEN the user clicks a notification's chit title, THE Dashboard SHALL navigate to the Editor page for that chit.
5. WHEN the user clicks Accept on a notification, THE Notification_Inbox SHALL call the Notification_System API to accept, update the RSVP status, and remove the notification from the list.
6. WHEN the user clicks Decline on a notification, THE Notification_Inbox SHALL call the Notification_System API to decline, update the RSVP status, and remove the notification from the list.
7. IF the Notification_System API returns an error when fetching notifications, THEN THE Notification_Inbox SHALL display the inbox button without a count badge and log the error to the console.

### Requirement 6: Tag Sharing Enhancements

**User Story:** As a tag creator, I want enhanced tag sharing with sub-tag propagation and per-user management toggles, so that I can share entire tag hierarchies and control what shared users can do with my tags.

#### Acceptance Criteria

1. WHEN a Tag_Creator shares a parent tag with a user, THE Tag_Management_Modal SHALL automatically include all sub-tags of that parent in the sharing configuration.
2. WHEN a sub-tag is added to a shared parent tag in the future, THE Sharing_Engine SHALL automatically propagate the parent's sharing configuration to the new sub-tag.
3. WHEN a sub-tag is removed from a shared parent tag, THE Sharing_Engine SHALL remove the sharing configuration for that sub-tag.
4. THE Tag_Management_Modal SHALL display the sharing section above the coloring section within the modal.
5. THE Tag_Management_Modal SHALL provide a per-user permission toggle with two levels: "view" (see the tag and its chits, read-only on tag structure) and "manage" (full tag management including rename, recolor, delete).
6. WHEN a tag is shared with a user at "view" level, THE Dashboard SHALL display the tag and its chits in the shared user's tag tree, but THE Settings page SHALL prevent the shared user from renaming, recoloring, or deleting that tag.
7. WHEN a tag is shared with a user at "manage" level, THE Settings page SHALL allow the shared user to rename, recolor, and delete the tag and all its sub-tags.
8. THE Dashboard SHALL display a 🔗 icon on shared tags in the tag tree, and WHEN the user hovers over the icon, THE Dashboard SHALL show a tooltip listing the users the tag is shared with.
9. THE Sharing_Engine SHALL continue to auto-accept tag-shared chits (no RSVP flow for tag-level sharing).

### Requirement 7: Dashboard Sharing Filters

**User Story:** As a user, I want sidebar filters to see only chits shared with me or shared by me, so that I can quickly focus on collaborative chits.

#### Acceptance Criteria

1. THE Dashboard sidebar SHALL display two new filter toggles in the filters section: "Shared with me" and "Shared by me".
2. WHEN the "Shared with me" filter is active, THE Dashboard SHALL display only chits where the current user is a shared recipient (has an effective_role of viewer or manager and is not the owner).
3. WHEN the "Shared by me" filter is active, THE Dashboard SHALL display only chits owned by the current user that have at least one entry in the shares array.
4. WHEN both sharing filters are inactive, THE Dashboard SHALL display all chits as normal (no sharing-based filtering).
5. WHEN the user clicks "Clear All" filters, THE Dashboard SHALL deactivate both sharing filters along with all other filters.

### Requirement 8: People Zone Expand Modal

**User Story:** As a user, I want an expand button on the People zone that opens a full-screen modal, so that I can see all people associated with a chit in a clear, organized view.

#### Acceptance Criteria

1. THE People_Zone SHALL display an expand button (matching the existing Notes zone expand button pattern).
2. WHEN the user clicks the expand button, THE Editor SHALL open a nearly full-screen People_Expand_Modal with a shrink button to close it.
3. THE People_Expand_Modal SHALL display an alphabetical list of all people associated with the chit (both contacts and system users).
4. THE People_Expand_Modal SHALL clearly indicate each person's type: "Contact" for informational contacts, or the user's sharing capacity (Invited/Viewer, Invited/Manager, Assigned) for system users.
5. WHEN the user clicks the shrink button or presses Escape, THE People_Expand_Modal SHALL close and return focus to the People_Zone.
6. THE People_Expand_Modal SHALL follow the existing ESC priority chain — closing the modal before any other ESC action.

### Requirement 9: Backend Permission Bug Fixes

**User Story:** As a developer, I want the backend permission logic to be consistent with the intended manager capabilities, so that the UI and backend agree on what managers can do.

#### Acceptance Criteria

1. WHEN a Manager saves a chit via PUT `/api/chits/{chit_id}`, THE `update_chit()` handler SHALL allow the Manager's shares and assigned_to values to be persisted (removing the silent preservation of original values for non-owner managers).
2. WHEN a Manager saves a chit via PUT `/api/chits/{chit_id}`, THE `update_chit()` handler SHALL silently preserve the existing stealth value if the requesting user is not the owner.
3. WHEN a Manager sends a DELETE request to `/api/chits/{chit_id}`, THE `delete_chit()` handler SHALL soft-delete the chit (updating `can_delete_chit()` to return true for managers).
4. THE `can_manage_sharing()` function SHALL continue to return true for managers, and the backend behavior SHALL match this return value by allowing managers to modify sharing fields.

### Requirement 10: Assignment Model Change

**User Story:** As a user, I want assignment to automatically grant manager access, so that assigned users have the editing capability they need to complete their work.

#### Acceptance Criteria

1. WHEN a user is assigned to a chit, THE Sharing_Engine SHALL resolve the assigned user's effective role as "manager" (not "viewer" as currently implemented).
2. WHEN a user is assigned to a chit and is not already in the shares array, THE Editor SHALL add the user to the shares array with role "manager" before saving.
3. WHEN a user is assigned to a chit and is already in the shares array with role "viewer", THE Editor SHALL upgrade the user's role to "manager" in the shares array before saving.
4. THE `resolve_effective_role()` function SHALL grant "manager" as the floor role for assignment (replacing the current "viewer" floor).
