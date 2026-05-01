# Requirements Document

## Introduction

This feature adds an invitation/RSVP system to the existing CWOC chit sharing mechanism. Currently, when a chit is shared with a user, they immediately see it in their dashboard with no ability to accept or decline. This feature introduces three RSVP states — invited, accepted, and declined — so that shared users can respond to chit invitations. Declined chits receive faded visual treatment on all views, and a new per-user setting allows hiding declined chits entirely.

## Glossary

- **Chit**: A flexible record in CWOC that can serve as a task, note, calendar event, alarm, checklist, or project.
- **RSVP_Status**: The invitation response state for a shared user on a chit. One of: `invited`, `accepted`, or `declined`.
- **Shares_List**: The JSON array stored on each chit containing sharing entries with `user_id`, `role`, and `rsvp_status` fields.
- **Dashboard**: The main CWOC page (`index.html`) that displays chits across six views (Calendar, Checklists, Alarms, Projects, Tasks, Notes).
- **Chit_Card**: The visual card element representing a chit on the Dashboard views.
- **Editor**: The chit editor page (`editor.html`) where users create and modify chits.
- **Sharing_Zone**: The section within the People zone of the Editor where sharing controls (user list, roles, stealth, assignment) are managed.
- **Settings_Page**: The settings page (`settings.html`) where per-user preferences are configured.
- **Owner**: The user who created a chit and has full control over it.
- **Shared_User**: A user who has been granted access to a chit via the Shares_List (with role `viewer` or `manager`).
- **Hide_Declined_Setting**: A per-user boolean setting that controls whether declined chits are completely hidden from all views.

## Requirements

### Requirement 1: RSVP Status Data Model

**User Story:** As a chit owner, I want each shared user's invitation to carry an RSVP status, so that I can see who has accepted, declined, or not yet responded.

#### Acceptance Criteria

1. THE Shares_List SHALL store an `rsvp_status` field on each share entry with a value of `invited`, `accepted`, or `declined`.
2. WHEN a new share entry is added to a chit, THE Editor SHALL set the `rsvp_status` field to `invited` by default.
3. WHEN an existing chit with share entries that lack an `rsvp_status` field is loaded, THE Backend SHALL treat the missing field as `invited` for backward compatibility.
4. THE Backend SHALL preserve the `rsvp_status` field through chit save and load round-trips without data loss.

### Requirement 2: RSVP Response Actions

**User Story:** As a shared user, I want to accept or decline a chit invitation, so that I can indicate my participation.

#### Acceptance Criteria

1. WHEN a Shared_User views a chit with any RSVP_Status, THE Dashboard SHALL display RSVP action controls on the Chit_Card that allow the user to set their status to `accepted` or `declined`.
2. WHEN a Shared_User clicks the accept control, THE Dashboard SHALL send a request to the Backend to update the RSVP_Status to `accepted` for that user.
3. WHEN a Shared_User clicks the decline control, THE Dashboard SHALL send a request to the Backend to update the RSVP_Status to `declined` for that user.
4. WHEN a Shared_User has already accepted or declined, THE Dashboard SHALL allow the Shared_User to change their RSVP_Status at any time by providing controls to switch between `accepted` and `declined`.
5. WHEN a Shared_User opens the quick-edit modal for a shared chit, THE quick-edit modal SHALL include RSVP action controls consistent with the Chit_Card controls, without introducing a new modal.
6. THE Backend SHALL provide an API endpoint that allows a Shared_User to update their own RSVP_Status on a chit without requiring owner or manager role.
7. THE Backend SHALL reject RSVP_Status update requests from users who are not in the Shares_List for the specified chit.
8. THE Owner SHALL NOT have an RSVP_Status because the Owner is always implicitly participating.

### Requirement 3: RSVP Status Display on Chit Cards

**User Story:** As a user viewing a shared chit, I want to see the RSVP status of each shared user, so that I can understand who has accepted, declined, or not yet responded.

#### Acceptance Criteria

1. WHEN a chit has share entries with RSVP_Status values, THE Chit_Card SHALL display each Shared_User with a visual indicator of their RSVP_Status.
2. THE Chit_Card SHALL use distinct visual treatments for each RSVP_Status: a pending/neutral style for `invited`, a positive/confirmed style for `accepted`, and a muted/crossed style for `declined`.
3. WHEN a chit is displayed as an invitation (RSVP_Status is `invited` for the current user), THE Chit_Card SHALL include a visual cue that distinguishes it from accepted chits.
4. THE Chit_Card RSVP indicators SHALL display the Shared_User display name alongside the status indicator.
5. THE Chit_Card SHALL display RSVP indicators in the header meta area, consistent with existing shared icon and role badge placement.

### Requirement 4: Declined Chit Visual Treatment

**User Story:** As a shared user who has declined a chit, I want declined chits to appear faded on my views, so that I can visually distinguish them from active chits.

#### Acceptance Criteria

1. WHEN a Shared_User has RSVP_Status of `declined` on a chit, THE Dashboard SHALL render that Chit_Card with reduced opacity across all six views (Calendar, Checklists, Alarms, Projects, Tasks, Notes).
2. THE declined Chit_Card opacity SHALL be visually distinct from the existing archived chit opacity (0.45) and completed task opacity (0.5), using a value that makes the chit clearly faded but still readable.
3. WHEN a Shared_User hovers over a declined Chit_Card, THE Dashboard SHALL increase the opacity to improve readability, consistent with the existing archived chit hover behavior.

### Requirement 5: Hide Declined Chits Setting

**User Story:** As a user, I want a setting to completely hide declined chits from all my views, so that I can keep my dashboard uncluttered.

#### Acceptance Criteria

1. THE Settings_Page SHALL include a toggle labeled "Hide declined chits" in a relevant settings group.
2. WHEN the Hide_Declined_Setting is enabled, THE Dashboard SHALL exclude all chits where the current user's RSVP_Status is `declined` from all six views.
3. WHEN the Hide_Declined_Setting is disabled, THE Dashboard SHALL display declined chits with the faded visual treatment described in Requirement 4.
4. THE Hide_Declined_Setting SHALL default to `false` (show declined chits with faded treatment).
5. THE Backend SHALL store the Hide_Declined_Setting as a per-user field in the settings table.
6. WHEN the Hide_Declined_Setting is changed, THE Settings_Page SHALL persist the value through the existing settings save mechanism.

### Requirement 6: RSVP Status in the Chit Editor

**User Story:** As a chit owner or manager, I want to see the RSVP status of each shared user in the editor, so that I can manage invitations effectively.

#### Acceptance Criteria

1. WHEN a chit with share entries is opened in the Editor, THE Sharing_Zone SHALL display the RSVP_Status next to each Shared_User in the shares list.
2. THE Sharing_Zone SHALL use the same visual indicators for RSVP_Status as the Chit_Card (consistent styling for `invited`, `accepted`, `declined`).
3. WHEN a Shared_User opens a chit they are invited to in the Editor, THE Editor SHALL display accept and decline controls for that user to respond.
4. THE Owner and Manager roles SHALL NOT be able to change another user's RSVP_Status through the Editor.

### Requirement 7: RSVP Status in Calendar View

**User Story:** As a user viewing the calendar, I want declined chits to be visually distinct on the calendar, so that I can focus on accepted events.

#### Acceptance Criteria

1. WHEN a chit with RSVP_Status of `declined` for the current user is displayed on the Calendar view, THE Calendar SHALL render the event with the same faded opacity treatment as other views.
2. WHEN the Hide_Declined_Setting is enabled, THE Calendar SHALL exclude declined chits from all calendar period views (Itinerary, Day, Week, Work, X Days, Month, Year).
