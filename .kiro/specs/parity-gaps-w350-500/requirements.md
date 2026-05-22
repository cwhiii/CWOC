# Requirements Document

## Introduction

Resolve all Android parity gaps identified in the W350–W500 range of the Web Function Index. This spec covers five gaps: one fully missing feature (recurring event drag-to-reschedule in the time grid), one missing rendering capability (checklist inline markdown), two partially wired features (project child chit picker and creator), and one partial settings enforcement (enabled periods filtering in the time period dropdown).

## Glossary

- **Calendar_Time_Grid**: The Android composable (`CalendarTimeGrid.kt`) that renders the hour-by-hour grid for Day, Week, Work, and X-Day calendar views, displaying timed events as positioned blocks.
- **Recurring_Edit_Dialog**: The existing Android dialog (`RecurringEditDialog.kt`) that presents scope options (This Instance / All Events / This and Following) when editing a recurring event.
- **Time_Period_Dropdown**: The Android composable (`TimePeriodDropdown` in `SidebarContent.kt`) that shows the list of calendar period options (Itinerary, Day, Work, Week, X Days, Month, Year).
- **Checklist_Renderer**: The Android UI component(s) responsible for displaying checklist item text in the editor and dashboard views.
- **Projects_Zone**: The Android composable (`ProjectsZone` in `ChitEditorScreen.kt`) that manages project master status, child chit display, and child chit management actions.
- **Chit_Picker_Sheet**: A bottom sheet or dialog that displays a searchable, filterable list of existing chits for selection.
- **Settings_Entity**: The Room entity (`SettingsEntity`) that stores user settings including `enabledPeriods` as a comma-separated string.

## Requirements

### Requirement 1: Recurring Event Drag-to-Reschedule in Time Grid (W368)

**User Story:** As a user, I want to drag a recurring calendar event to new times in the week/day time grid, so that I can reschedule recurring instances by choosing whether to edit just this instance, all instances, or this and following instances.

#### Acceptance Criteria

1. WHEN a user long-presses (300ms threshold) and drags a recurring event block in the Calendar_Time_Grid to a new time slot, THE Calendar_Time_Grid SHALL initiate a drag-to-reschedule interaction that snaps the event position to the nearest multiple of the user's configured `calendar_snap` setting (default 15 minutes, minimum 1 minute if set to 0).
2. WHEN a recurring event drag completes at a new position (the event was moved at least 1 pixel from its origin), THE Calendar_Time_Grid SHALL display the Recurring_Edit_Dialog with exactly four options: "This instance only", "All in series", "All following", and "Cancel".
3. WHEN the user selects "This instance only", THE Calendar_Time_Grid SHALL create a standalone copy of the virtual instance at the new times with no recurrence_rule, and add a `broken_off` exception (keyed by the virtual instance's original date) to the parent chit's recurrence exceptions.
4. WHEN the user selects "All in series", THE Calendar_Time_Grid SHALL shift the parent chit's start/end/due datetimes by the computed time difference between the virtual instance's original position and the new position, and IF the recurrence rule has `freq=WEEKLY` with a `byDay` list and the event was dragged to a different day of the week, THEN THE Calendar_Time_Grid SHALL replace the original day abbreviation with the target day abbreviation in the `byDay` array.
5. WHEN the user selects "All following", THE Calendar_Time_Grid SHALL split the recurrence at the dragged instance: the parent chit retains instances before the source date (via an `until` or exception cutoff), and a new chit is created starting from the source date onward with datetimes shifted to the target times and the same recurrence rule (with `byDay` updated if the day of week changed for weekly recurrences).
6. WHEN the user selects "Cancel" or dismisses the Recurring_Edit_Dialog (via back gesture, tap outside, or ESC equivalent), THE Calendar_Time_Grid SHALL restore the event to its original position by re-rendering the calendar with no data changes persisted.
7. WHILE a drag is in progress, THE Calendar_Time_Grid SHALL reduce the dragged event block's opacity (to 0.6) and display it at the target snap position in real time, along with a snap grid overlay showing lines at each snap interval.
8. WHEN a user long-presses and drags a non-recurring timed event block in the Calendar_Time_Grid to a new time slot, THE Calendar_Time_Grid SHALL directly shift its start/end (or due, or point_in_time) datetimes to the new snapped position without showing the Recurring_Edit_Dialog, preserving the original event duration for move operations.
9. IF the drag target position is outside the valid time range (before 00:00 or after 23:59), THEN THE Calendar_Time_Grid SHALL clamp the event position to the nearest valid boundary (0 minutes minimum, 1425 minutes maximum for a 15-minute event).

### Requirement 2: Enabled Periods Filtering in Time Period Dropdown (W395)

**User Story:** As a user, I want the time period dropdown to only show periods I have enabled in settings, so that I am not presented with period options I have disabled.

#### Acceptance Criteria

1. WHEN the Time_Period_Dropdown renders its options list, THE Time_Period_Dropdown SHALL read the `enabledPeriods` value from the Settings_Entity, parse it as a comma-separated list of period identifiers (valid values: "Itinerary", "Day", "Work", "Week", "SevenDay", "Month", "Year"), and exclude from the displayed options any period whose identifier is not present in that list.
2. WHEN the user changes their enabled periods in settings and returns to the main screen, THE Time_Period_Dropdown SHALL reflect the updated enabled periods list without requiring an app restart (the dropdown re-reads the current Settings_Entity value each time it renders).
3. IF the currently selected period is removed from the enabled periods list by a settings change, THEN THE Time_Period_Dropdown SHALL automatically switch the selection to the first period in display order ("Itinerary", "Day", "Work", "Week", "SevenDay", "Month", "Year") that remains enabled.
4. IF the `enabledPeriods` value in Settings_Entity is null, empty, or contains no recognized period identifiers, THEN THE Time_Period_Dropdown SHALL fall back to displaying "Day" as the sole available period option.
5. WHEN the Time_Period_Dropdown displays the "SevenDay" period option, THE Time_Period_Dropdown SHALL render its label as the user's configured `customDaysCount` value followed by " Days" (e.g., "7 Days") rather than the raw identifier "SevenDay".

### Requirement 3: Inline Markdown Rendering in Checklist Items (W405)

**User Story:** As a user, I want checklist item text to render inline markdown (bold, italic, links, code), so that I can use rich formatting in my checklist items just like on the web.

#### Acceptance Criteria

1. THE Checklist_Renderer SHALL parse and render inline markdown formatting within checklist item text, supporting: bold (`**text**`), italic (`*text*`), inline code (`` `code` ``), and links (`[text](url)`), including nested combinations of these elements (e.g., bold text inside a link).
2. WHEN a checklist item contains a markdown link, THE Checklist_Renderer SHALL render it as a tappable link that is visually distinguishable from surrounding text and opens the URL in the device browser.
3. WHEN a checklist item contains no markdown syntax, THE Checklist_Renderer SHALL display the text as plain unstyled text without applying markdown parsing.
4. THE Checklist_Renderer SHALL strip any GFM task list checkbox syntax (`- [x]`, `- [ ]`) from rendered output, since checkboxes are handled by the checklist UI itself.
5. THE Checklist_Renderer SHALL apply inline markdown rendering in all locations where checklist items are displayed: the chit editor checklist zone, the Checklists dashboard view, the Omni view checklist section, and the Notebook view.
6. WHEN rendering multi-line checklist item text, THE Checklist_Renderer SHALL preserve line breaks while still applying inline markdown to each line.
7. THE Checklist_Renderer SHALL render only inline-level markdown elements and SHALL NOT render block-level markdown (headings, blockquotes, horizontal rules, bullet lists) within checklist item text, displaying any block-level syntax as literal text.
8. IF a checklist item contains malformed or unclosed markdown syntax (e.g., `**unclosed bold`), THEN THE Checklist_Renderer SHALL display the raw text as-is rather than producing garbled or partial formatting.

### Requirement 4: Project Child Chit Picker (W429)

**User Story:** As a user, I want to pick an existing chit from a searchable list to add as a child of my project, so that I can organize existing chits under projects without manually entering IDs.

#### Acceptance Criteria

1. WHEN the user taps the "Pick Chit" button in the Projects_Zone, THE Projects_Zone SHALL open the Chit_Picker_Sheet displaying all non-project-master chits (excluding the current project chit itself) sorted alphabetically by title, with email chits excluded by default.
2. THE Chit_Picker_Sheet SHALL provide a text search field that filters chits in real-time as the user types, matching against title, note content, checklist item text, people, location, priority, severity, status, and tags (with `#` prefix triggering tag-only search).
3. THE Chit_Picker_Sheet SHALL provide filter controls for status (All, ToDo, In Progress, Blocked, Complete), priority (All, Low, Medium, High, Critical), and an "Email" toggle that includes or excludes email-sourced chits.
4. THE Chit_Picker_Sheet SHALL display each chit row with its title, user tags (non-system) as small badges, due date (if any) formatted as YYYY-MM-DD, and current status.
5. THE Chit_Picker_Sheet SHALL support multi-select: the user can check multiple chits via checkbox or row tap, view a selection count, and add them all at once via an "Add Selected" button that is disabled when no chits are selected.
6. WHEN the user confirms their selection by tapping "Add Selected", THE Projects_Zone SHALL add all selected chit IDs to the project's `child_chits` list, re-render the child chit display, and close the Chit_Picker_Sheet.
7. THE Chit_Picker_Sheet SHALL display chits that are already children of the current project as dimmed, non-selectable rows with a checkmark indicator, so the user can see which chits are already assigned without being able to re-add them.
8. IF no chits match the current search/filter criteria, THEN THE Chit_Picker_Sheet SHALL display an empty state message indicating no results were found.
9. IF the chit data fails to load from the repository, THEN THE Chit_Picker_Sheet SHALL display an error toast indicating the failure and close the sheet.
10. THE Chit_Picker_Sheet SHALL display a header showing the count of currently visible chits (e.g., "Add Child Chits (42 shown)") that updates as filters are applied.
11. WHEN the user taps the search field's clear action or presses the back/dismiss gesture with an active search term, THE Chit_Picker_Sheet SHALL clear the search text and reset the list before closing, requiring a second dismiss gesture to close the sheet entirely.

### Requirement 5: Create New Child Chit from Project (W431)

**User Story:** As a user, I want to create a brand new chit and immediately add it as a child of my current project, so that I can quickly add new tasks to a project without leaving the editor.

#### Acceptance Criteria

1. WHEN the user taps the "Create New" button in the Projects_Zone, THE Projects_Zone SHALL display a prompt dialog asking for the new chit's title.
2. WHEN the user confirms the title with a non-empty string of at most 200 characters (leading and trailing whitespace trimmed), THE Projects_Zone SHALL create a new chit with the entered title and a default status of "ToDo", and persist it to the data store.
3. WHEN the new chit is successfully created, THE Projects_Zone SHALL immediately add the new chit's ID to the project's `child_chits` list.
4. WHEN the new chit is added, THE Projects_Zone SHALL refresh the child chit summaries to show the new child in the ToDo status group.
5. WHEN the new chit is added, THE Projects_Zone SHALL display a success toast confirming the creation (e.g., "Created 'Title' and added to project.").
6. IF the chit creation fails (network error, API error, or data persistence failure), THEN THE Projects_Zone SHALL display an error toast indicating the failure reason and leave the project's child list unchanged.
7. IF the user cancels the title prompt, THEN THE Projects_Zone SHALL take no action and dismiss the prompt.
8. IF the user confirms the title prompt with an empty or whitespace-only string, THEN THE Projects_Zone SHALL keep the prompt open or re-display it and not create a chit.
