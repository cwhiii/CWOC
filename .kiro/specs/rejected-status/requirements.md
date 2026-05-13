# Requirements Document

## Introduction

This feature adds "Rejected" as a new terminal status for chits in CWOC. Currently the status flow is ToDo → In Progress → Blocked → Complete, where "Complete" is the only terminal state. But "Complete" implies the work was accomplished. Many chits end without being accomplished — a feature idea evaluated and declined, a task that became unnecessary, something superseded by a different approach, or a weekly repeating task that was deliberately skipped.

"Rejected" fills this gap as a second terminal state meaning "this was considered and deliberately not done." It's semantically distinct from Complete: Complete = done successfully, Rejected = deliberately not done.

In the Projects view, Rejected chits appear in the same vertical space as Complete (below it), sharing the "finished" column. In the editor's project zone, Rejected gets its own drop target section below Complete. The status is available everywhere statuses are used — editor dropdown, Tasks view inline dropdown, sidebar filters, and Projects Kanban.

## Glossary

- **Terminal_Status**: A status indicating no further action is needed. Currently only "Complete"; after this feature, both "Complete" and "Rejected" are terminal statuses.
- **Active_Status**: A status indicating work is still pending or in progress. Includes "ToDo", "In Progress", and "Blocked".
- **Rejected**: The new terminal status meaning "this chit was considered and deliberately declined/skipped/cancelled."
- **Projects_Kanban**: The Kanban-style board in the editor's Projects zone that groups child chits by status into collapsible sections.
- **Status_Dropdown**: The `<select>` element used in both the editor and the Tasks view inline cards to change a chit's status.
- **Hide_Complete_Filter**: The existing sidebar checkbox that hides completed chits; will be extended to also hide rejected chits.

## Requirements

### Requirement 1: Rejected Status Value

**User Story:** As a user, I want "Rejected" available as a status option everywhere I can set a status, so that I can mark chits as deliberately declined.

#### Acceptance Criteria

1. THE Status_Dropdown in the editor (`editor.html`) SHALL include "Rejected" as an option after "Complete"
2. THE Status_Dropdown in the Tasks view inline cards (`main-views-tasks.js`) SHALL include "Rejected" as an option after "Complete"
3. THE status filter in the sidebar (`shared-sidebar.js`) SHALL include a "Rejected" checkbox
4. THE `_STATUS_ICONS` map in `shared-indicators.js` SHALL include an entry for "Rejected" using a visually distinct icon (e.g., `fa-times-circle` in a muted/grey color)
5. THE Chit model SHALL accept "Rejected" as a valid value for the `status` field (no backend validation change needed since status is an unvalidated `Optional[str]`)

### Requirement 2: Terminal Status Behavior

**User Story:** As a user, I want Rejected chits to behave like finished items — faded in lists, hidden by the "Hide Complete" filter, and sorted to the bottom — so that they don't clutter my active work.

#### Acceptance Criteria

1. THE Tasks view sort order SHALL place "Rejected" after "Complete" (sort value 6, after Complete's 5)
2. THE "Hide Complete" filter checkbox SHALL also hide chits with status "Rejected" (the label may optionally be updated to "Hide Finished" to reflect both terminal states)
3. THE Tasks view SHALL apply the `completed-task` CSS class (opacity fade) to chits with status "Rejected"
4. THE overdue date coloring logic SHALL NOT mark Rejected chits as overdue (same exemption as Complete)
5. WHEN a chit's status is set to "Rejected", THE System SHALL NOT cascade prerequisite unblocking (unlike Complete, rejecting a prerequisite does not unblock dependents)

### Requirement 3: Projects View Integration

**User Story:** As a user, I want Rejected chits to appear in the Projects Kanban below the Complete section, sharing the "finished" vertical space, so that I can see all terminal chits together.

#### Acceptance Criteria

1. THE Projects Kanban in `editor_projects.js` SHALL include "Rejected" as a status column rendered after "Complete"
2. THE "Rejected" column SHALL be collapsed by default (same behavior as "Complete")
3. THE "Rejected" column SHALL support drag-and-drop — users can drag chits into and out of the Rejected section
4. THE status normalization map SHALL include `"rejected": "Rejected"` for case-insensitive matching
5. CHITS dragged into the "Rejected" section SHALL have their status updated to "Rejected" via the existing drag-drop save mechanism

### Requirement 4: Visual Treatment

**User Story:** As a user, I want Rejected chits to be visually distinct from Complete chits — clearly marked as "deliberately not done" rather than "accomplished" — so I can tell them apart at a glance.

#### Acceptance Criteria

1. THE `_STATUS_ICONS` entry for "Rejected" SHALL use a Font Awesome icon that conveys "declined" (e.g., `fa-times-circle`) in a muted grey color (`#9E9E9E`)
2. THE Tasks view `_styleStatusDropdown()` function SHALL apply a muted/grey style to the dropdown when value is "Rejected" (similar to Complete's opacity treatment)
3. THE map marker color for "Rejected" status (in help docs and map rendering) SHALL be grey (`#9E9E9E`)
4. THE chit card for a Rejected chit SHALL have the same `completed-task` opacity fade as Complete chits

### Requirement 5: Filter and Search Integration

**User Story:** As a user, I want to filter and search for Rejected chits the same way I can for other statuses, so that I can find them when needed.

#### Acceptance Criteria

1. THE sidebar status filter SHALL include a "Rejected" checkbox option
2. THE `status:` search prefix in Global Search SHALL match "Rejected" as a valid status value
3. THE "Hide Complete" filter SHALL hide both Complete and Rejected chits (since both are terminal)
4. THE map view status filter (if applicable) SHALL include "Rejected" as a filterable status

### Requirement 6: Help & Documentation

**User Story:** As a user, I want the help page to document the Rejected status so I understand what it means and how to use it.

#### Acceptance Criteria

1. THE help page SHALL list "Rejected" in all status reference sections (map colors, search prefixes, status descriptions)
2. THE help page SHALL describe "Rejected" as a terminal status meaning "deliberately declined or skipped"
3. THE status color legend SHALL include Rejected with its grey color indicator
