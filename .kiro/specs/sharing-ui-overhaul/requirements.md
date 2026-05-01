# Requirements Document

## Introduction

This project overhauls the sharing UI in the CWOC chit editor and dashboard. It builds on the completed chit-sharing-system spec, which established the backend permission model (`sharing.py`), sharing API routes (`routes/sharing.py`), the separate `🔗 Sharing` zone in the editor (`editor-sharing.js`), and shared chit rendering on the dashboard (`main-views.js`).

The overhaul consolidates sharing controls into the People zone, grants managers the same sharing-management permissions as owners, relocates the assigned-to picker to the Task zone, replaces the dashboard owner badge with a compact shared icon and tooltip, repositions the owner label in the editor title area, and retains the stealth toggle at the bottom of the merged People zone.

**Prerequisite:** The Chit Sharing System (chit-sharing-system spec) is complete.

## Glossary

- **CWOC**: C.W.'s Omni Chits — the application under development
- **Editor**: The chit editor page (`editor.html` + `editor-*.js` scripts)
- **Dashboard**: The main dashboard page (`index.html` + `main-*.js` scripts)
- **People_Zone**: The `👥 People` zone in the chit editor, managed by `editor-people.js`, which displays contacts as chips in a grouped alphabetical tree
- **Sharing_Zone**: The current `🔗 Sharing` zone in the chit editor, managed by `editor-sharing.js`, which provides user picker, role selector, stealth toggle, and assigned-to picker — to be removed as a separate zone
- **Task_Zone**: The `📋 Task` zone in the chit editor, containing Status, Priority, and Severity dropdowns
- **Title_Zone**: The title area at the top of the editor (`#titleWeatherContainer`), containing the title input, pinned icon, and weather display
- **Pill_Toggle**: A two-option toggle control using the `cwoc-pill-toggle` pattern from the settings page (e.g., the Man/Woman sex selector), where one option is highlighted and the other is dimmed
- **System_User**: A user account in the `users` table with `id`, `username`, `display_name`, and `profile_image_url`
- **Contact**: A contact record in the `contacts` table with `display_name`, `color`, and `image_url`
- **Sharing_Engine**: The backend permission resolution module (`src/backend/sharing.py`) containing `can_manage_sharing()`, `resolve_effective_role()`, and related functions
- **Chit_Card**: A rendered chit element on the dashboard, built by `_buildChitHeader()` in `main-views.js`
- **Owner_Chip**: A contact/user chip displaying the chit owner's display name with color and thumbnail, matching the visual style of people chips in the People_Zone
- **request.state.user_id**: The authenticated user's UUID, injected by `AuthMiddleware` on every request

## Requirements

### Requirement 1: Merge Sharing Zone into People Zone

**User Story:** As a user, I want sharing controls integrated into the People zone instead of a separate Sharing zone, so that all person-related information and sharing configuration is in one place.

#### Acceptance Criteria

1. THE Editor SHALL remove the separate `🔗 Sharing` zone (`sharingSection`) from the editor layout
2. THE People_Zone SHALL display all System_Users from the `users` table alongside all Contacts from the `contacts` table in the grouped alphabetical tree
3. WHEN a Contact appears in the People_Zone tree, THE People_Zone SHALL render the Contact as a chip without a sharing role toggle (matching the current contact chip behavior)
4. WHEN a System_User appears in the People_Zone tree, THE People_Zone SHALL render the System_User as a chip with a Pill_Toggle after the chip displaying two options: `👁️ Viewer` and `✏️ Manager`
5. THE Pill_Toggle for System_Users SHALL follow the same visual pattern as the Man/Woman sex selector on the settings page (`cwoc-pill-toggle` with `data-val` spans, highlighted active option, dimmed inactive option)
6. WHEN a System_User is added to the chit's shares list, THE People_Zone SHALL display the System_User chip in the active people area with the Pill_Toggle set to the user's current role
7. WHEN a user clicks a System_User chip that is not yet shared, THE People_Zone SHALL add the System_User to the chit's shares list with the default role of `viewer`
8. WHEN a user toggles the Pill_Toggle on a shared System_User chip between `👁️ Viewer` and `✏️ Manager`, THE People_Zone SHALL update the user's role in the chit's shares list and mark the editor as unsaved
9. WHEN a user removes a shared System_User chip (via the ✕ button), THE People_Zone SHALL remove the System_User from the chit's shares list and mark the editor as unsaved
10. THE People_Zone SHALL not display the currently authenticated user (the owner) in the System_User list (owners cannot share with themselves)

### Requirement 2: Managers Can Manage Sharing

**User Story:** As a manager of a shared chit, I want the same sharing-management permissions as the owner, so that I can add and remove shared users, change roles, and toggle stealth without needing the owner to do it.

#### Acceptance Criteria

1. THE Sharing_Engine SHALL update `can_manage_sharing()` in `src/backend/sharing.py` to return `True` when the user's effective role is `owner` or `manager` (currently returns `True` only for owner)
2. WHEN a user with the `manager` role opens a shared chit in the Editor, THE People_Zone SHALL display the sharing controls (System_User chips with Pill_Toggles, stealth toggle) the same way it does for the owner
3. WHEN a user with the `manager` role adds, removes, or changes the role of a shared System_User, THE Sharing_Engine SHALL accept the operation (the sharing API endpoints SHALL check `can_manage_sharing()` instead of owner-only)
4. WHEN a user with the `manager` role toggles the stealth flag, THE Sharing_Engine SHALL accept the operation
5. WHEN a user with the `viewer` role opens a shared chit in the Editor, THE People_Zone SHALL hide the sharing controls (no Pill_Toggles on System_User chips, no stealth toggle) and display the zone in read-only mode

### Requirement 3: Move Assigned-To Picker to Task Zone

**User Story:** As a user, I want the assigned-to picker in the Task zone instead of the People zone, so that task assignment is grouped with other task-related fields like status and priority.

#### Acceptance Criteria

1. THE Editor SHALL remove the assigned-to picker (`sharingAssignedTo`) from the People_Zone (formerly in the Sharing_Zone)
2. THE Task_Zone SHALL contain the assigned-to dropdown after the existing Status, Priority, and Severity fields
3. WHEN the chit has zero shared System_Users, THE Task_Zone SHALL hide the assigned-to dropdown
4. WHEN the chit has one or more shared System_Users, THE Task_Zone SHALL display the assigned-to dropdown
5. THE assigned-to dropdown SHALL only list System_Users that the chit is currently shared with (not all System_Users in the system)
6. WHEN a user adds or removes a shared System_User in the People_Zone, THE Task_Zone SHALL update the assigned-to dropdown options to reflect the current shares list
7. IF the currently assigned user is removed from the shares list, THEN THE Task_Zone SHALL clear the assigned-to value and mark the editor as unsaved

### Requirement 4: Dashboard Shared Icon with Tooltip

**User Story:** As a user viewing the dashboard, I want a compact shared icon on chit cards instead of the full owner name badge, so that the card layout is cleaner while still providing sharing details on hover.

#### Acceptance Criteria

1. WHEN a chit is shared (has an `effective_role` from the sharing system), THE Chit_Card SHALL display a `🔗` icon instead of the current `👤 Owner Name` text badge
2. WHEN a user hovers over the `🔗` icon on a Chit_Card, THE Dashboard SHALL display a tooltip containing: the owner's display name, a list of shared users with their roles (Viewer or Manager), and the current user's effective role
3. THE Chit_Card SHALL not display the `👤 Owner Name` text badge for shared chits (the `🔗` icon replaces it)
4. WHEN a chit is not shared (owned by the current user with no shares), THE Chit_Card SHALL not display the `🔗` icon

### Requirement 5: Editor Owner Label Repositioning

**User Story:** As a user editing a chit, I want the owner's name displayed as a chip in the title zone header area, so that ownership is visible at a glance without taking up vertical space below the title.

#### Acceptance Criteria

1. THE Editor SHALL remove the owner display name from its current position below the title input
2. THE Title_Zone SHALL display the owner's display name as an Owner_Chip inline with the "Title" label and the pinned icon in the title zone header area
3. THE Owner_Chip SHALL use the same visual style as people chips in the People_Zone (background color, thumbnail image or placeholder, display name text)
4. WHEN the chit owner has a `profile_image_url`, THE Owner_Chip SHALL display the profile image as the chip thumbnail
5. WHEN the chit owner does not have a `profile_image_url`, THE Owner_Chip SHALL display the `?` placeholder thumbnail (matching the People_Zone chip pattern)
6. WHEN the chit is owned by the current user, THE Owner_Chip SHALL still be displayed (showing the current user's own chip)

### Requirement 6: Stealth Toggle in People Zone

**User Story:** As a user, I want the stealth toggle at the bottom of the merged People zone, so that I can quickly hide a chit from all other users from the same zone where I manage sharing.

#### Acceptance Criteria

1. THE People_Zone SHALL display the stealth toggle checkbox at the very bottom of the zone body, below the contact/user tree and active chips areas
2. THE stealth toggle SHALL use the same visual style as the current stealth toggle (🥷 icon, "Stealth — hide from all other users" label)
3. WHEN the stealth toggle is checked, THE People_Zone SHALL mark the editor as unsaved
4. WHEN a user with the `viewer` role opens a shared chit, THE People_Zone SHALL hide the stealth toggle
5. WHEN a user with the `manager` or `owner` role opens a chit, THE People_Zone SHALL display the stealth toggle
