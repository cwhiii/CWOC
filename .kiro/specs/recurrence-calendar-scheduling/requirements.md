# Requirements Document

## Introduction

This spec covers Android parity implementation for 26 web functions grouped into 11 feature areas related to recurrence management, calendar view enhancements, scheduling utilities, and miscellaneous editor/settings gaps. The goal is to bring the Android app to full feature parity with the web implementation for these functions.

The Android app already has foundational infrastructure (RecurrenceEngine, ChitRepository, CalendarViewModel, ChitEditorViewModel, SettingsEntity) but lacks the higher-level actions, UI components, and wiring that the web app provides.

## Glossary

- **Chit**: The core data record in CWOC — a flexible entity that can serve as a task, note, calendar event, alarm, checklist, or project.
- **RecurrenceEngine**: Android class that expands recurrence rules into virtual instances for display.
- **Virtual_Instance**: A computed occurrence of a recurring chit that does not have its own database record until broken off or modified.
- **Recurrence_Exception**: A stored modification or exclusion for a specific date in a recurring series (e.g., broken_off, rescheduled, completed).
- **Series_Parent**: The original recurring chit entity that defines the recurrence rule and from which virtual instances are generated.
- **ChitRepository**: Android data layer class that handles CRUD operations for chits, including recurrence exception management.
- **CalendarViewModel**: Android ViewModel managing calendar view state (mode, visible date range, events).
- **ChitEditorViewModel**: Android ViewModel managing the chit editor state (fields, zones, save logic).
- **DateZone**: The date/time editing section within the chit editor UI.
- **AlertsZone**: The notifications/alerts editing section within the chit editor UI.
- **ProjectsZone**: The project children management section within the chit editor UI.
- **QuickEditSheet**: A bottom sheet modal for quick actions on a chit without opening the full editor.
- **RecurringEditDialog**: Existing Android dialog that asks scope (this/all/following) when editing a recurring instance.
- **TimePeriodDropdown**: Android composable that shows period filter options (Day, Week, Month, Quarter, Year, All).
- **ChitPickerSheet**: Existing Android composable providing a searchable chit selection bottom sheet.
- **RuleEditorScreen**: Android screen for editing automation rules (triggers, conditions, actions).
- **FAB**: Floating Action Button — the primary action button in Android Material Design.
- **Bottom_Sheet**: A Material Design panel that slides up from the bottom of the screen.
- **Cron_Expression**: A string using cron syntax (minute hour day-of-month month day-of-week) to define scheduled triggers.
- **SettingsEntity**: Android Room entity storing user settings as key-value pairs.
- **Perpetual_Mode**: A date mode indicating an ongoing activity with a start date but no end date.
- **All_Day_Section**: The area at the top of calendar day/week views that displays events spanning entire days.
- **X_Day_View**: A configurable calendar view showing between 1 and 7 days (not limited to just Day or Week).

## Requirements

### Requirement 1: Recurrence Series Info Computation

**User Story:** As a user viewing a recurring chit instance, I want to see series statistics (instance number, total count, completion rate), so that I understand my progress within the series.

#### Acceptance Criteria

1. WHEN a virtual instance of a recurring chit is displayed, THE RecurrenceEngine SHALL compute the instance number (position in series up to and including the virtual date), total past instances count (up to and including the current date), completed instances count, and success rate as an integer percentage from 0 to 100 rounded to the nearest whole number.
2. WHEN the recurrence rule has a defined end date, THE RecurrenceEngine SHALL compute the total number of instances in the series, stopping expansion at the end date.
3. WHEN the recurrence rule has no end date (infinite), THE RecurrenceEngine SHALL compute only past instances up to the current date, iterating a maximum of 730 occurrences before stopping.
4. THE RecurrenceEngine SHALL exclude broken-off exceptions from all instance counts and include completed exceptions in the completed count when computing series statistics.
5. IF the chit has no valid recurrence_rule (missing or no freq field) or no calendar start date, THEN THE RecurrenceEngine SHALL return null instead of series statistics.
6. WHEN the recurrence rule specifies byDay constraints with WEEKLY frequency, THE RecurrenceEngine SHALL count only instances whose day-of-week matches the specified days.

### Requirement 2: Series Summary UI

**User Story:** As a user, I want to see a visual summary of all instances in a recurring series with their completion status, so that I can review the full history at a glance.

#### Acceptance Criteria

1. WHEN the user opens the QuickEditSheet or Chit_Editor for a recurring chit instance, THE System SHALL display a Series_Summary section showing all instances listed in chronological order (oldest first) with their completion status.
2. THE Series_Summary SHALL display each instance as a row containing a status icon and the instance date formatted as abbreviated day-of-week and month-day (e.g., "Mon, Jan 15"), where status icons are: ✅ for completed (date has a recurrence_exception with completed=true), ❌ for missed (instance date is before today and not completed or broken off), ✂️ for broken off (date has a recurrence_exception with broken_off=true), ⬜ for upcoming (instance date is today or in the future).
3. THE Series_Summary SHALL show instances from the series start date up to 30 days in the future, with a maximum of 50 instances displayed, within a scrollable container with a fixed height of 300dp.
4. THE Series_Summary SHALL visually distinguish the currently-viewed instance from other instances in the list using a highlighted background color or bold text styling.
5. IF the recurring chit has no start date or the recurrence_rule is missing or has no freq value, THEN THE Series_Summary SHALL not render.

### Requirement 3: Complete Series Action

**User Story:** As a user, I want to mark an entire recurring series as Complete in one action, so that I do not have to complete each instance individually.

#### Acceptance Criteria

1. WHEN the user selects "Complete Series" from the recurrence action modal, THE System SHALL prompt the user for confirmation before proceeding.
2. WHEN the user confirms the "Complete Series" action, THE ChitRepository SHALL set the Series_Parent status to "Complete" and record the completed_datetime as the current UTC timestamp in ISO 8601 format.
3. WHEN a series is marked Complete, THE RecurrenceEngine SHALL exclude that series from virtual instance generation, so no future instances appear in any view.
4. IF the API call to save the Series_Parent status fails, THEN THE System SHALL display an error toast indicating the series could not be completed and leave the chit status unchanged.
5. WHEN the "Complete Series" action succeeds, THE System SHALL display a confirmation toast within 1 second of the status change being persisted.

### Requirement 4: Break Off Instance Action

**User Story:** As a user, I want to break off a single recurring instance into a standalone chit, so that I can manage it independently from the series.

#### Acceptance Criteria

1. WHEN the user selects "Break Off Instance" from the recurrence action modal, THE ChitRepository SHALL create a new standalone chit that copies all content properties from the Series_Parent (title, notes, tags, checklist, people, location, alerts, status, color, and all other non-recurrence fields) with the virtual instance's specific start_datetime, end_datetime, and due_datetime, and with recurrence_rule, recurrence_exceptions, recurrence, and recurrence_id set to null.
2. WHEN a new standalone chit is created from break-off, THE ChitRepository SHALL add a broken_off exception (with the instance's date and broken_off set to true) to the Series_Parent's recurrence_exceptions list for that instance's date.
3. WHEN the break-off action completes successfully, THE System SHALL navigate to the editor for the newly created standalone chit.
4. IF the parent chit fetch or standalone chit creation fails during break-off, THEN THE System SHALL display an error toast indicating the failure and SHALL NOT add an exception to the Series_Parent.

### Requirement 5: Recurrence Auto-Archive

**User Story:** As a user, I want recurring chits to auto-archive when all instances up to the end date are completed or broken off, so that finished series do not clutter my active views.

#### Acceptance Criteria

1. WHEN every occurrence of a recurring chit from its start date through its `recurrence_rule.until` date has a corresponding entry in `recurrence_exceptions` with `completed: true` or `broken_off: true`, THE System SHALL set the recurring chit's `archived` field to `true` within 2 seconds of the triggering action.
2. WHEN a completion or break-off action is performed on any instance of a recurring chit, THE System SHALL evaluate whether all occurrences up to the `recurrence_rule.until` date now have a `completed` or `broken_off` exception entry.
3. IF the recurring chit's `recurrence_rule` does not contain an `until` value, THEN THE System SHALL not auto-archive the chit regardless of how many instances have been completed or broken off.
4. IF any occurrence date between the start date and the `until` date has no corresponding `recurrence_exceptions` entry, THEN THE System SHALL treat that instance as pending and SHALL NOT archive the recurring chit.

### Requirement 6: Instance Banner

**User Story:** As a user viewing a recurring instance, I want to see a banner showing "Instance X of Y", so that I know which occurrence I am looking at.

#### Acceptance Criteria

1. WHEN the user views a recurring chit instance in the editor, THE ChitEditorViewModel SHALL display a banner showing "Instance X of Y" where X is the 1-based chronological position of the current instance within the series and Y is the total number of instances generated by the recurrence rule.
2. WHEN the series has no end date (infinite recurrence), THE banner SHALL display "Instance X" without a total count, where X is the 1-based chronological position of the current instance.
3. WHILE a recurring chit instance is displayed in the editor, THE instance banner SHALL appear at the top of the editor content area, above all editable fields.
4. IF the chit is not a recurring instance, THEN THE ChitEditorViewModel SHALL NOT display the instance banner.

### Requirement 7: Save Instance Exception

**User Story:** As a user, I want to save changes to a single recurring instance without affecting the rest of the series, so that I can customize individual occurrences.

#### Acceptance Criteria

1. WHEN the user edits a recurring instance and saves, THE RecurringEditDialog SHALL offer the option to save changes to "This instance only."
2. WHEN "This instance only" is selected, THE ChitRepository SHALL store the modifications as a recurrence exception keyed by that instance's date (YYYY-MM-DD), replacing any previously stored exception for the same date.
3. THE saved exception SHALL preserve the following modified fields for that instance only: title, start_datetime, end_datetime, due_datetime, note, location, and completion status.
4. THE remaining instances in the series SHALL remain unaffected by the exception.
5. IF the save operation fails (network error or server error), THEN THE System SHALL display an error toast indicating the instance changes were not saved, and SHALL retain the user's edits in the editor without navigating away.

### Requirement 8: Recurring Drag Modal

**User Story:** As a user, I want to be asked about scope when I drag a recurring event to a new time on the calendar, so that I can choose whether to move just this instance, all instances, or all following instances.

#### Acceptance Criteria

1. WHEN the user completes a drag of a recurring event instance to a different time slot or day cell on the calendar, THE System SHALL display a modal with the title "Edit recurring event" presenting four options: "This instance only," "All in series," "All following," and "Cancel."
2. WHILE the recurring drag modal is displayed, THE System SHALL NOT persist any time changes to the backend until the user selects a scope option.
3. WHEN "This instance only" is selected, THE System SHALL create a new standalone chit at the target time (with no recurrence_rule) and add a recurrence exception with `broken_off: true` for that date to the Series_Parent's recurrence_exceptions list.
4. WHEN "All in series" is selected, THE System SHALL shift the Series_Parent's start_datetime, end_datetime, and due_datetime by the computed time delta between the dragged instance's original time and the drop target time, and for weekly recurrences with byDay rules, replace the original day-of-week with the target day-of-week in the byDay array.
5. WHEN "All following" is selected, THE System SHALL shift the Series_Parent's start_datetime, end_datetime, and due_datetime forward by the computed time delta, and for weekly recurrences with byDay rules, replace the original day-of-week with the target day-of-week in the byDay array.
6. IF the user dismisses the modal by pressing Escape, clicking outside the modal overlay, or selecting "Cancel," THEN THE System SHALL discard the pending time change, close the modal, and re-render the calendar at its pre-drag state.
7. WHEN any scope option completes successfully, THE System SHALL close the modal and refresh the calendar view to reflect the updated event positions within 1 second of the API response.

### Requirement 9: Recurrence Action Modal

**User Story:** As a user, I want a dedicated modal showing all available actions for a recurring chit (complete series, break off, view summary), so that I can manage the series efficiently.

#### Acceptance Criteria

1. WHEN the user triggers the recurrence action modal for a recurring chit (a Virtual_Instance with a valid Series_Parent), THE System SHALL display a Bottom_Sheet with exactly three action buttons: "Complete Series," "Break Off Instance," and "View Series Summary."
2. IF the chit is not a recurring instance (no recurrence rule or not a Virtual_Instance), THEN THE System SHALL not display recurrence action buttons in the Bottom_Sheet.
3. WHEN an action is selected from the modal, THE System SHALL dismiss the Bottom_Sheet and then execute the corresponding action (Complete Series as defined in Requirement 3, Break Off Instance as defined in Requirement 4, View Series Summary as defined in Requirement 2).
4. IF an action fails to execute (network error or server error), THEN THE System SHALL display an error toast indicating which action failed and preserve the chit's previous state.
5. THE recurrence action modal SHALL be accessible via a dedicated recurrence actions row in the QuickEditSheet, and via a recurrence actions button in the chit editor's instance banner when editing a recurring instance.

### Requirement 10: Recurrence-Aware Delete

**User Story:** As a user, I want recurrence-aware delete options when deleting a recurring instance, so that I can choose to delete just one occurrence, future occurrences, or the entire series.

#### Acceptance Criteria

1. WHEN the user deletes a chit that is a recurring instance, THE System SHALL display an inline submenu with three options: "Delete this instance," "Delete this and following," and "Delete all (entire series)."
2. WHEN "Delete this instance" is selected, THE ChitRepository SHALL add a broken_off exception (with `broken_off: true`) for that instance's date to the parent chit's `recurrence_exceptions` list.
3. WHEN "Delete this and following" is selected, THE ChitRepository SHALL set the parent chit's `recurrence_rule.until` field to the day before the selected instance's date, ending the series at that point.
4. WHEN "Delete all (entire series)" is selected, THE System SHALL first display a danger confirmation dialog requiring explicit user approval before proceeding.
5. IF the user confirms "Delete all (entire series)," THEN THE ChitRepository SHALL soft-delete the Series_Parent chit by setting its `deleted` flag to true.
6. WHEN any delete action completes successfully, THE System SHALL refresh the chit list to reflect the removal and display an undo toast for 5 seconds allowing the user to reverse the action.
7. WHEN the user deletes a non-recurring chit, THE System SHALL display a simple danger confirmation dialog without recurrence options, and upon confirmation soft-delete the chit.

### Requirement 11: All-Day Events Height Cap

**User Story:** As a user viewing the calendar, I want the all-day events section to have a maximum height with overflow handling, so that many all-day events do not consume the entire viewport on mobile.

#### Acceptance Criteria

1. THE CalendarViewModel SHALL cap the All_Day_Section in week and day views to display a maximum of 3 event rows in its collapsed state, clipping any additional events beyond that limit.
2. THE All_Day_Section SHALL default to the collapsed (capped) state each time the calendar view is loaded or the displayed date range changes.
3. WHEN the number of all-day events exceeds 3, THE calendar view SHALL display a "show more" toggle that indicates the count of additional hidden events.
4. WHEN the "show more" toggle is activated, THE All_Day_Section SHALL expand to reveal all event rows with no height restriction.
5. WHEN the expanded section is collapsed via the toggle, THE All_Day_Section SHALL return to displaying a maximum of 3 event rows.

### Requirement 12: X-Day Configurable Calendar View

**User Story:** As a user, I want to configure the calendar to show any number of days between 1 and 7, so that I can use intermediate views like 3-day or 5-day.

#### Acceptance Criteria

1. THE CalendarViewModel SHALL store a configurable day count as an integer in the range 1 through 7 inclusive, defaulting to 7 when no user selection has been made.
2. WHEN the user selects an X-day view count, THE calendar SHALL display exactly that number of consecutive days starting from the current day-offset anchor date.
3. THE CalendarViewModel SHALL track a day offset as an integer representing the number of days forward or backward from today, with an initial value of 0 (meaning the view starts on today).
4. WHEN the user navigates forward in an X-day view, THE calendar SHALL shift the day offset forward by the configured day count. WHEN the user navigates backward in an X-day view, THE calendar SHALL shift the day offset backward by the configured day count.
5. IF the user attempts to set a day count outside the range 1 through 7, THEN THE CalendarViewModel SHALL reject the value and retain the previously configured day count.
6. WHEN the user changes the configured day count while a view is already displayed, THE calendar SHALL re-render the view using the new day count starting from the same anchor date (current day offset).

### Requirement 13: Perpetual Mode Toggle

**User Story:** As a user, I want to set a chit to "Perpetual" date mode in the editor, so that I can track ongoing activities with a start date and no end date.

#### Acceptance Criteria

1. THE DateZone SHALL include "Perpetual" as a selectable date mode radio option alongside Start/End, Due, Point in Time, and None modes.
2. THE DateZone SHALL display the Perpetual date mode option only when the chit has the habit toggle enabled.
3. WHEN the user selects Perpetual mode and the start date field is empty, THE ChitEditorViewModel SHALL set the start date to today's date and clear the end date and end time fields.
4. WHEN the user selects Perpetual mode and the start date field already contains a value, THE ChitEditorViewModel SHALL preserve the existing start date and clear the end date and end time fields.
5. WHILE Perpetual mode is active, THE DateZone SHALL display the date in "Since [Month Day, Year]" format (e.g., "Since January 15, 2024").
6. WHEN the user switches from Perpetual mode to another date mode, THE ChitEditorViewModel SHALL clear the perpetual flag and set the newly selected date mode as active.
7. IF the user deactivates the habit toggle while Perpetual mode is active, THEN THE ChitEditorViewModel SHALL switch the date mode to Start/End and clear the perpetual flag.

### Requirement 14: Apply Default Notifications

**User Story:** As a user, I want my configured default notifications to auto-populate when I first assign a date mode to a new chit, so that I do not have to manually add the same alerts every time.

#### Acceptance Criteria

1. WHEN a new chit first receives a date mode assignment of "startend", THE ChitEditorViewModel SHALL read the `start` array from the default_notifications setting and populate the AlertsZone with those notification entries.
2. WHEN a new chit first receives a date mode assignment of "due", THE ChitEditorViewModel SHALL read the `due` array from the default_notifications setting and populate the AlertsZone with those notification entries.
3. THE default_notifications setting SHALL be a JSON object with `start` and `due` arrays, where each array element contains at minimum a `value` (numeric) and `unit` (string, defaulting to "minutes"), and optionally an `afterTarget` boolean (defaulting to false).
4. THE auto-population SHALL only occur when the chit has zero existing notifications in its alerts data at the time the date mode is activated.
5. THE system SHALL track which date modes have already had defaults applied per editor session, so that switching away from a mode and back does not re-add defaults a second time.
6. IF the default_notifications setting is null, empty, or the relevant array (start or due) for the activated mode contains zero entries, THEN THE ChitEditorViewModel SHALL leave the AlertsZone unchanged.
7. WHEN default notifications are successfully added, THE ChitEditorViewModel SHALL expand the AlertsZone (if collapsed) so the user can see the auto-populated notifications.

### Requirement 15: Cron Expression Describer

**User Story:** As a user configuring a rule trigger, I want to see a human-readable description of a cron expression, so that I can verify the schedule is correct.

#### Acceptance Criteria

1. WHEN a cron expression is entered or assembled in the RuleEditorScreen, THE System SHALL display a plain-English description of the schedule (e.g., "At 9:00 AM, Monday through Friday") within 500ms of the input change.
2. THE cron describer SHALL produce a description segment for each standard cron field: minute, hour, day-of-month, month, and day-of-week, using day names (e.g., "Monday"), month names (e.g., "January"), and the user's configured time format (12-hour or 24-hour).
3. THE cron describer SHALL correctly interpret and describe the special characters: asterisk (every), comma (list), hyphen (range), and slash (step) within any field.
4. IF the cron expression is incomplete or contains invalid syntax, THEN THE System SHALL display an error indication in place of the description stating that the expression is invalid, and SHALL NOT attempt to describe a partial or malformed expression.

### Requirement 16: Cron Expression Assembler

**User Story:** As a user, I want to build a cron expression from UI inputs (dropdowns/fields for minute, hour, day-of-month, month, day-of-week), so that I do not have to write raw cron syntax.

#### Acceptance Criteria

1. THE RuleEditorScreen SHALL provide a text input field for each of the five standard cron fields: minute (valid range: 0–59), hour (valid range: 0–23), day-of-month (valid range: 1–31), month (valid range: 1–12 or JAN–DEC), and day-of-week (valid range: 0–6 or SUN–SAT), each defaulting to `*` when empty.
2. WHEN the user modifies any cron field input, THE System SHALL assemble a 5-field cron expression string by concatenating the values of minute, hour, day-of-month, month, and day-of-week separated by spaces, substituting `*` for any empty field.
3. WHEN the user modifies any cron field input, THE System SHALL display the assembled cron expression alongside a human-readable description generated by translating the expression into natural language (e.g., "Every day at 6:00 AM", "Every weekday at 9:00 AM").
4. IF the user attempts to save a rule with an invalid cron expression (a field containing characters other than digits, `*`, `-`, `/`, commas, or day/month name abbreviations, or the expression not having exactly 5 space-separated fields), THEN THE System SHALL display an error message indicating the cron expression is invalid and prevent the save.
5. THE RuleEditorScreen SHALL provide preset buttons that populate all five cron fields with predefined common expressions (e.g., every hour, every day at a specific time, weekdays only) and update the preview immediately upon selection.

### Requirement 17: Cron Expression Validator

**User Story:** As a user, I want cron expressions to be validated for correctness before saving, so that I do not create rules with invalid schedules.

#### Acceptance Criteria

1. WHEN a cron expression is entered or assembled, THE System SHALL validate it for correctness before allowing save.
2. THE validator SHALL check: correct field count (5 fields), valid ranges per field (0-59 minutes, 0-23 hours, 1-31 day-of-month, 1-12 month, 0-6 day-of-week), and valid special characters (asterisk `*`, comma `,` for lists, hyphen `-` for ranges, slash `/` for steps).
3. IF a cron expression is invalid, THEN THE System SHALL display an error message indicating which field is incorrect and why, and SHALL disable the save action until the expression is corrected.
4. IF a cron field contains a step value (e.g., `*/5`, `1-10/2`), THEN THE System SHALL validate that the step divisor is a positive integer within the valid range for that field.

### Requirement 18: Quick Alert Modal

**User Story:** As a user, I want to quickly create alarms, timers, stopwatches, or reminders from any screen without navigating to the full editor, so that I can capture time-sensitive items immediately.

#### Acceptance Criteria

1. THE System SHALL provide a Quick Alert Bottom_Sheet accessible from the FAB or a dedicated button on any screen.
2. THE Quick Alert Bottom_Sheet SHALL offer type selection for exactly four types: Reminder, Alarm, Timer, and Stopwatch.
3. WHEN Reminder is selected, THE Bottom_Sheet SHALL display an editor with a required title text field (maximum 200 characters), a date picker defaulting to today, and a time picker defaulting to 15 minutes from now.
4. WHEN Alarm is selected, THE Bottom_Sheet SHALL display an editor with an optional name text field (maximum 200 characters), a time picker defaulting to 1 minute from now, and day-of-week checkboxes (Sun–Sat) defaulting to the current day checked.
5. WHEN Timer is selected, THE Bottom_Sheet SHALL display an editor with an optional name text field (maximum 200 characters), hours/minutes/seconds numeric inputs defaulting to 0h 5m 0s, and a loop toggle.
6. WHEN Stopwatch is selected, THE Bottom_Sheet SHALL display an editor with an optional name text field (maximum 200 characters) and an indication that the stopwatch will start automatically upon creation.
7. WHEN the user saves a Reminder, THE System SHALL create a chit with the specified date/time as point_in_time and a notification alert, then display a confirmation toast.
8. WHEN the user saves an Alarm, Timer, or Stopwatch, THE System SHALL create an independent standalone alert and display a confirmation toast.
9. IF the user attempts to save a Reminder with an empty title, THEN THE System SHALL highlight the title field and prevent saving until a title is provided.
10. IF the user attempts to save a Timer with a total duration of zero seconds, THEN THE System SHALL prevent saving.
11. THE Quick Alert Bottom_Sheet SHALL include a "Create & View" option that saves the alert and navigates to the Alarms tab.
12. WHEN the user cancels or dismisses the Bottom_Sheet, THE System SHALL discard any unsaved input without confirmation.

### Requirement 19: Toggle Combine Alerts Setting

**User Story:** As a user, I want to toggle the "Combine Alerts" setting from the Android app, so that I can control whether alert types show as individual icons or a single combined icon on chit cards.

#### Acceptance Criteria

1. THE Settings screen (Visual Indicators section) SHALL include a "Combine Alerts" toggle with a default value of disabled (false).
2. WHEN the user enables the "Combine Alerts" toggle, THE System SHALL store the combine_alerts setting as true, display all alert types as a single 🛎️ icon on chit cards, and hide the individual alert-type display mode rows (alarm, notification, timer, stopwatch) while showing the combined alert display mode row.
3. WHEN the user disables the "Combine Alerts" toggle, THE System SHALL store the combine_alerts setting as false, display individual icons per alert type on chit cards (🔔 for alarm, 📢 for notification, ⏱️ for timer, ⏲️ for stopwatch), and show the individual alert-type display mode rows while hiding the combined alert display mode row.
4. WHEN the combine_alerts setting is changed, THE System SHALL sync the updated value to the server within the next sync cycle.

### Requirement 20: Apply Enabled Periods Filter

**User Story:** As a user, I want the period dropdown to only show periods I have enabled in settings, so that disabled periods do not clutter the selector.

#### Acceptance Criteria

1. WHEN the TimePeriodDropdown is rendered, THE System SHALL read the `enabled_periods` setting (a comma-separated list drawn from the values: Itinerary, Day, Week, Work, SevenDay, Month, Year) and display only the period options whose values are present in that list.
2. IF the currently selected period is not present in the `enabled_periods` list, THEN THE System SHALL automatically switch the selection to the first period in the enabled list.
3. IF the `enabled_periods` setting is empty or not configured, THEN THE TimePeriodDropdown SHALL display all seven periods (Itinerary, Day, Week, Work, SevenDay, Month, Year) as the default.
4. WHEN the `enabled_periods` setting is updated while the TimePeriodDropdown is already rendered, THE System SHALL immediately re-apply the filter so that newly disabled periods are hidden and newly enabled periods are shown without requiring a page reload.

### Requirement 21: Project Child Chit Picker

**User Story:** As a user managing a project, I want to pick an existing chit to add as a child of the project using a searchable picker, so that I do not have to manually type chit IDs.

#### Acceptance Criteria

1. WHEN the user taps "Pick Chit" in the ProjectsZone, THE System SHALL open the ProjectChitPickerSheet displaying all non-deleted chits except the current chit and chits marked as project masters.
2. THE ProjectChitPickerSheet SHALL allow filtering chits by title text, by tag prefix (# character), by status (ToDo, In Progress, Blocked, Complete), and by priority (Low, Medium, High, Critical).
3. THE ProjectChitPickerSheet SHALL display chits already assigned as children of the current project as dimmed and non-selectable, while allowing the user to multi-select from the remaining chits via checkboxes and an "Add Selected" confirmation button.
4. WHEN the user confirms the selection, THE ChitEditorViewModel SHALL add only chit IDs not already present in the project's child_chits list, persist the updated list, and refresh the child summaries in the UI immediately.
5. IF no chits match the current search query and filters, THEN THE ProjectChitPickerSheet SHALL display an empty-state message indicating no chits match the current filters.

### Requirement 22: Project Create New Child Chit

**User Story:** As a user managing a project, I want to create a new child chit pre-configured with the parent project ID, so that I can quickly add new items to a project.

#### Acceptance Criteria

1. WHEN the user taps "Create New" in the ProjectsZone, THE System SHALL display a title prompt requesting the user to enter a chit title.
2. WHEN the user confirms the title prompt with a non-empty title, THE System SHALL create a new chit via the API with the provided title and a default status of "ToDo".
3. WHEN the new chit is successfully created, THE System SHALL add the new chit's ID to the parent project's child_chits list, save the parent project, re-render the Kanban board, and display a success toast indicating the chit was created and added to the project.
4. IF the user cancels the title prompt or submits an empty title, THEN THE System SHALL take no action and remain on the current project editor.
5. IF the API call to create the new chit fails, THEN THE System SHALL display an error toast indicating the failure and SHALL NOT modify the parent project's child_chits list.
6. IF no parent project is currently loaded when "Create New" is tapped, THEN THE System SHALL display an error toast indicating no project is loaded and SHALL NOT attempt chit creation.
