# Requirements Document — Phase 5a: Core Usability

## Introduction

Phase 5a closes the most critical functional gaps between the CWOC Android app and the web app. The Android app currently has basic C CAPTN views, a minimal editor, and sync infrastructure — but is missing the sidebar/menu navigation, search, filters, sort, proper editor UIs (checklist, color picker, date picker, alerts, recurrence), settings page, trash management, and unsaved changes detection. This phase brings the app to daily-driver usability.

## Glossary

- **Sidebar**: The left-swipe panel containing filters, sort, navigation links, and quick actions
- **C_CAPTN_Panel**: The right-swipe panel containing the six view tabs
- **Dirty_Tracking**: System that detects unsaved changes by comparing current field values to last-saved state
- **Tag_Tree**: Hierarchical tag display with parent/child nesting (e.g., "Work/Projects/Alpha")
- **Undo_Toast**: Bottom-center countdown bar with Undo button for reversible actions
- **Zone**: A collapsible section in the chit editor (Dates, Tags, People, Location, Notes, Alerts, Color, Health, etc.)

## Requirements

### Requirement 1: Sidebar/Menu Panel

**User Story:** As a user, I want a sidebar/menu panel for accessing navigation, filters, sort, and quick actions, so that I have the same access patterns as the mobile web app.

#### Acceptance Criteria

1. THE App SHALL provide a left-swipe panel (or hamburger menu) containing: navigation links, filter controls, sort controls, and quick action buttons.
2. THE sidebar SHALL contain navigation links to: Settings, People/Contacts, Trash, Help, Weather, Map.
3. THE sidebar SHALL contain a "New Chit" button that opens the editor in create mode.
4. THE sidebar SHALL contain the filter controls (Requirement 7).
5. THE sidebar SHALL contain the sort controls (Requirement 8).
6. THE sidebar SHALL be dismissible by tapping outside or swiping back.
7. THE sidebar SHALL also be openable via a hamburger menu button in the header.

### Requirement 2: Settings Page

**User Story:** As a user, I want to view and edit my settings on the Android app, so that I can configure preferences without needing the web browser.

#### Acceptance Criteria

1. THE App SHALL provide a Settings screen accessible from the sidebar/menu navigation.
2. THE Settings screen SHALL display settings organized into tabs matching the web app: General, Views, Admin.
3. THE App SHALL allow editing of General settings: time format (12h/24h), week start day, calendar snap interval, snooze length, default timezone, unit system.
4. THE App SHALL allow editing of Views settings: default view, enabled periods, view order.
5. THE App SHALL allow editing of tag colors and favorites.
6. THE App SHALL sync settings changes to the server via the existing sync push mechanism.
7. THE App SHALL reflect settings changes immediately in the local UI after saving.
8. THE Admin tab SHALL include a "Diagnostics" section containing all functionality currently in the Debug screen: sync controls (Sync Now, Full Resync), database stats (total chits, tasks, notes, calendar counts), sync status (status, high-water mark, last synced time), sample chits display, and Copy All to Clipboard.
9. THE standalone Debug screen and its bottom nav tab SHALL be removed once the Diagnostics section is in place.

### Requirement 3: Proper Date/Time Picker in Editor

**User Story:** As a user, I want a proper date and time picker in the chit editor, so that I can set dates without typing ISO strings manually.

#### Acceptance Criteria

1. THE Editor SHALL provide a calendar-based date picker for Start, End, and Due date fields.
2. THE Editor SHALL provide a time picker with configurable snap interval (from settings: calendar_snap).
3. THE Editor SHALL support a date mode selector: Start/End, Due Only, Perpetual, Point-in-Time, None — matching the web app's radio buttons.
4. THE Editor SHALL display selected dates in the user's configured format (12h/24h).
5. THE Editor SHALL support the All-Day toggle which hides time pickers when enabled.
6. THE Editor SHALL support timezone selection with a searchable list of IANA timezones.

### Requirement 4: Proper Checklist UI in Editor

**User Story:** As a user, I want a proper checklist interface in the editor, so that I can add, remove, reorder, and nest checklist items visually.

#### Acceptance Criteria

1. THE Editor SHALL render checklist items as interactive rows with checkboxes, text, and drag handles.
2. THE Editor SHALL allow adding new checklist items via a text input at the bottom.
3. THE Editor SHALL allow removing checklist items via swipe-to-delete or a delete button.
4. THE Editor SHALL allow reordering checklist items via drag-and-drop.
5. THE Editor SHALL allow nesting/indenting items (indent on right-swipe, outdent on left-swipe or via buttons).
6. THE Editor SHALL display a progress count (e.g., "3/7 complete") at the top of the checklist zone.
7. THE Editor SHALL support undo for checklist operations (toggle, reorder, delete).

### Requirement 5: Proper Color Picker in Editor

**User Story:** As a user, I want a visual color picker in the editor, so that I can select chit colors without typing hex codes.

#### Acceptance Criteria

1. THE Editor SHALL display a grid of color swatches matching the web app's default palette.
2. THE Editor SHALL display any custom colors defined in the user's settings.
3. THE Editor SHALL show a visual preview of the selected color (background tint on the editor header or a color indicator).
4. THE Editor SHALL allow clearing the color selection (set to none/default).
5. WHEN a color is selected, THE Editor SHALL immediately update the visual preview.

### Requirement 6: Proper Alerts/Alarms UI in Editor

**User Story:** As a user, I want a proper alerts interface in the editor, so that I can create and manage alarms, timers, and reminders visually.

#### Acceptance Criteria

1. THE Editor SHALL display existing alerts as a list with type icon, time/offset, and delete button.
2. THE Editor SHALL allow adding new alerts via a creation form with: type (alarm/timer/reminder), offset or absolute time, and optional label.
3. THE Editor SHALL allow removing alerts individually.
4. THE Editor SHALL support alert types matching the web: time-based alarms (relative offset from start/due), absolute time alerts.
5. THE Editor SHALL display alert times in the user's configured format.

### Requirement 7: Proper Recurrence UI in Editor

**User Story:** As a user, I want a proper recurrence interface in the editor, so that I can set up repeating events without typing RRULE strings.

#### Acceptance Criteria

1. THE Editor SHALL provide preset recurrence options: None, Daily, Weekly, Monthly, Yearly.
2. THE Editor SHALL provide a custom recurrence builder with: frequency, interval, by-day selection (for weekly), until date or count.
3. THE Editor SHALL display a human-readable summary of the current recurrence rule (e.g., "Every Monday and Wednesday").
4. THE Editor SHALL allow clearing recurrence (set to none).
5. THE Editor SHALL support recurrence exceptions display (dates excluded from the pattern).

### Requirement 8: Global Search

**User Story:** As a user, I want to search across all my chits from any screen, so that I can quickly find what I need.

#### Acceptance Criteria

1. THE App SHALL provide a search input accessible from the main screen header or sidebar.
2. THE search SHALL support full-text search across title, note, tags, checklist text, and people fields.
3. THE search SHALL support boolean operators: AND (&&), OR (||), NOT (! or -prefix).
4. THE search SHALL support field-specific search with `field::value` syntax.
5. THE search SHALL support tag search with `#tagname` syntax.
6. THE search SHALL highlight matching terms in results.
7. THE search SHALL display results as chit cards with the same layout as list views.
8. THE search SHALL filter results in real-time with a 300ms debounce.

### Requirement 9: Filters on List Views

**User Story:** As a user, I want to filter chits by status, priority, tags, and other criteria, so that I can focus on relevant items.

#### Acceptance Criteria

1. THE App SHALL provide filter controls accessible from the sidebar/menu panel.
2. THE App SHALL support filtering by status (ToDo, In Progress, Blocked, Complete, any combination).
3. THE App SHALL support filtering by priority (Critical, High, Medium, Low, any combination).
4. THE App SHALL support filtering by tag (hierarchical tag tree with checkboxes, match-any or match-all mode).
5. THE App SHALL support filtering by people (chip-based selection from contacts).
6. THE App SHALL support archive/pinned/snoozed toggles.
7. THE App SHALL support a "past due" toggle to show/hide overdue items.
8. THE App SHALL persist filter state within a session when switching between views.
9. THE App SHALL provide a "Clear All Filters" button that resets all filters to defaults.

### Requirement 10: Sort on List Views

**User Story:** As a user, I want to sort chits by various fields, so that I can organize my view.

#### Acceptance Criteria

1. THE App SHALL provide sort controls accessible from the sidebar/menu panel.
2. THE App SHALL support sorting by: title, due date, start date, created date, modified date, priority, status, manual order.
3. THE App SHALL support ascending and descending sort direction toggle.
4. THE App SHALL persist sort preference per view tab.
5. THE App SHALL support manual drag-to-reorder when sort is set to "manual."

### Requirement 11: Trash Management

**User Story:** As a user, I want to view and restore deleted chits on the Android app, so that I can recover accidentally deleted items.

#### Acceptance Criteria

1. THE App SHALL provide a Trash screen accessible from the sidebar/menu navigation.
2. THE Trash screen SHALL display all soft-deleted chits with title, deletion date, and type indicators.
3. THE App SHALL allow restoring individual chits from trash (moves back to active).
4. THE App SHALL allow permanently purging individual chits from trash.
5. THE App SHALL show a confirmation dialog before purging.
6. THE App SHALL sync trash operations (restore/purge) to the server.

### Requirement 12: Unsaved Changes Detection in Editor

**User Story:** As a user, I want to be warned before losing unsaved changes in the editor, so that I don't accidentally discard work.

#### Acceptance Criteria

1. THE Editor SHALL track dirty state by comparing current field values to their last-saved state.
2. WHEN the user presses back with unsaved changes, THE Editor SHALL display a Save/Discard/Cancel modal.
3. THE Save option SHALL save changes and navigate back.
4. THE Discard option SHALL discard changes and navigate back.
5. THE Cancel option SHALL return to the editor without navigating.
6. THE back button priority chain SHALL close any open modal before triggering the unsaved changes check.

### Requirement 13: Undo on Delete

**User Story:** As a user, I want an undo option after deleting a chit, so that I can recover from accidental deletions.

#### Acceptance Criteria

1. WHEN a chit is soft-deleted (via swipe or button), THE App SHALL display an undo toast at the bottom of the screen.
2. THE undo toast SHALL show a 5-second countdown bar and an "Undo" button.
3. WHEN the user taps Undo before the countdown expires, THE App SHALL restore the chit immediately.
4. WHEN the countdown expires without Undo, THE App SHALL finalize the deletion and sync it.
