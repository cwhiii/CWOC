# Requirements Document

## Introduction

The Habits view is a new view mode within the Tasks tab of CWOC that surfaces recurring chits as trackable habits. Unlike the Calendar view which expands recurring tasks into individual instances, the Habits view shows one card per recurring chit and provides at-a-glance completion tracking, streak counting, and success rate metrics. Users can toggle the current period's occurrence as complete, see their consistency over a configurable rolling window, and optionally hide habits once the current period is done.

## Glossary

- **Habits_View**: The new view mode within the Tasks tab that displays only chits with a `recurrence_rule`, rendered as habit cards with completion tracking
- **Habit_Card**: A single card in the Habits view representing one recurring chit, showing title, frequency, completion toggle, success rate, and streak
- **Current_Period**: The time window that defines the "current occurrence" for a recurring chit, determined by its frequency (e.g., today for daily, this week for weekly)
- **Success_Rate_Badge**: A visual indicator on each habit card showing the percentage of past occurrences completed within the configured rolling window
- **Streak_Indicator**: A visual indicator showing the count of consecutive completed periods, where only genuinely missed occurrences break the streak (broken-off/skipped days do not)
- **Success_Window**: A user-configurable setting controlling the rolling time window used to calculate success rates, stored as `habits_success_window` in the settings table
- **View_Mode_Toggle**: A pair of buttons in the Tasks tab sidebar allowing the user to switch between the standard Tasks list and the Habits view
- **Show_Completed_Toggle**: A toggle at the top of the Habits view that reveals habit cards hidden by the `hide_when_instance_done` flag
- **Editor**: The chit editor page (`editor.html` + `editor.js`) where individual chit properties are configured
- **Settings_Page**: The settings page (`settings.html` + `settings.js`) where global application preferences are configured
- **Recurrence_Exceptions**: The existing `recurrence_exceptions` array on a chit, used to mark individual occurrences as completed or broken off

## Requirements

### Requirement 1: Tasks Tab View Mode Toggle

**User Story:** As a user, I want to switch between a standard Tasks list and a Habits view within the Tasks tab, so that I can track my recurring tasks as habits without leaving the Tasks tab.

#### Acceptance Criteria

1. WHEN the Tasks tab is active, THE View_Mode_Toggle SHALL display two buttons labeled "Tasks" and "Habits" in the sidebar, following the same pattern used by the Projects tab (List/Kanban) and Alarms tab (List/Independent) toggles
2. THE View_Mode_Toggle SHALL persist the selected mode to `localStorage` under the key `cwoc_tasksViewMode`
3. WHEN the user selects "Tasks" mode, THE Habits_View SHALL render the existing `displayTasksView` output unchanged
4. WHEN the user selects "Habits" mode, THE Habits_View SHALL render only chits that have a non-empty `recurrence_rule` with a valid `freq` property
5. THE View_Mode_Toggle SHALL default to "Tasks" mode when no persisted preference exists
6. WHEN the view mode changes, THE Habits_View SHALL re-render the chit list by calling `displayChits()`

### Requirement 2: Habit Card Rendering

**User Story:** As a user, I want each recurring task displayed as a habit card showing its title, frequency, completion state, success rate, and streak, so that I can see my habit tracking status at a glance.

#### Acceptance Criteria

1. THE Habit_Card SHALL display the chit title as a clickable link to the editor, followed by a frequency label formatted by the existing `formatRecurrenceRule()` function, separated by a middle dot (·)
2. THE Habit_Card SHALL display a checkbox representing the current period's completion state, determined by whether a completed `recurrence_exception` exists for the current period's date
3. WHEN the user checks the completion checkbox, THE Habits_View SHALL call the existing `PATCH /api/chits/{chit_id}/recurrence-exceptions` endpoint with `{ "exception": { "date": "<current_period_date>", "completed": true } }`
4. WHEN the user unchecks the completion checkbox, THE Habits_View SHALL call the existing `PATCH /api/chits/{chit_id}/recurrence-exceptions` endpoint with `{ "exception": { "date": "<current_period_date>", "completed": false } }`
5. THE Habit_Card SHALL display a Success_Rate_Badge showing the percentage of completed occurrences within the configured Success_Window
6. THE Habit_Card SHALL display a Streak_Indicator showing the count of consecutive completed periods ending at the most recent past occurrence
7. WHEN the current period's occurrence is completed, THE Habit_Card SHALL apply a faded/strikethrough visual style and sort to the bottom of the list
8. WHEN the current period's occurrence is not completed, THE Habit_Card SHALL appear with prominent styling and sort above completed cards
9. THE Habit_Card SHALL support double-click navigation to the editor and long-press to open the quick edit modal, matching the interaction patterns of the existing Tasks view cards

### Requirement 3: Current Period Calculation

**User Story:** As a user, I want the system to correctly determine which occurrence is "current" based on each habit's frequency, so that I can mark the right occurrence as done.

#### Acceptance Criteria

1. WHEN a chit has a DAILY frequency, THE Habits_View SHALL treat today (midnight to midnight local time) as the current period
2. WHEN a chit has a WEEKLY frequency without specific `byDay` values, THE Habits_View SHALL treat the current week as the current period, using the `week_start_day` setting to determine the week boundary
3. WHEN a chit has a MONTHLY frequency, THE Habits_View SHALL treat the current calendar month (1st to last day) as the current period
4. WHEN a chit has a YEARLY frequency, THE Habits_View SHALL treat the current calendar year (Jan 1 to Dec 31) as the current period
5. WHEN a chit has a custom interval (e.g., every 3 days), THE Habits_View SHALL calculate the current period as the span from the last scheduled occurrence date to the next scheduled occurrence date
6. WHEN a chit has a WEEKLY frequency with specific `byDay` values (e.g., Mon/Wed/Fri), THE Habits_View SHALL treat each scheduled day as its own occurrence and identify the most recent scheduled day that is today or earlier as the current period date
7. THE Habits_View SHALL derive the current period date as a `YYYY-MM-DD` string suitable for use in the `recurrence_exceptions` array

### Requirement 4: Success Rate Calculation

**User Story:** As a user, I want to see what percentage of past occurrences I have completed within a configurable time window, so that I can gauge my consistency.

#### Acceptance Criteria

1. THE Success_Rate_Badge SHALL calculate the success rate as `(completed occurrences / total scheduled occurrences) × 100` within the configured Success_Window, rounded to the nearest integer
2. WHEN the Success_Window is set to "7", THE Success_Rate_Badge SHALL consider only occurrences scheduled within the last 7 days
3. WHEN the Success_Window is set to "30", THE Success_Rate_Badge SHALL consider only occurrences scheduled within the last 30 days
4. WHEN the Success_Window is set to "90", THE Success_Rate_Badge SHALL consider only occurrences scheduled within the last 90 days
5. WHEN the Success_Window is set to "all", THE Success_Rate_Badge SHALL consider all occurrences from the chit's start date to today
6. THE Success_Rate_Badge SHALL exclude broken-off occurrences from both the numerator and denominator of the success rate calculation
7. IF no past occurrences exist within the Success_Window, THEN THE Success_Rate_Badge SHALL display "0%"

### Requirement 5: Streak Calculation

**User Story:** As a user, I want to see how many consecutive periods I have completed a habit, so that I can stay motivated by my consistency.

#### Acceptance Criteria

1. THE Streak_Indicator SHALL count consecutive completed periods working backward from the most recent past occurrence
2. THE Streak_Indicator SHALL treat broken-off (skipped) occurrences as neutral — broken-off dates SHALL NOT break the streak
3. WHEN a genuinely missed occurrence is encountered (not completed and not broken off), THE Streak_Indicator SHALL stop counting and display the streak up to that point
4. IF no consecutive completed occurrences exist, THEN THE Streak_Indicator SHALL display a streak of 0
5. THE Streak_Indicator SHALL display the streak count with a flame or equivalent icon (e.g., "🔥 5")

### Requirement 6: Hide When Instance Done

**User Story:** As a user, I want to optionally hide a habit card from the Habits view once I have completed the current period's occurrence, so that I can focus on habits that still need attention.

#### Acceptance Criteria

1. THE Editor SHALL display a "Hide from Habits when done" checkbox in the recurrence section of the editor, visible only when the chit has a `recurrence_rule`
2. WHEN the user enables "Hide from Habits when done", THE Editor SHALL set the `hide_when_instance_done` field to `true` on the chit
3. WHEN `hide_when_instance_done` is `true` AND the current period's occurrence is completed, THE Habits_View SHALL hide the Habit_Card from the default view
4. WHEN the Show_Completed_Toggle is enabled, THE Habits_View SHALL display all habit cards including those hidden by `hide_when_instance_done`
5. THE Show_Completed_Toggle SHALL appear at the top of the Habits view as a labeled checkbox
6. THE `hide_when_instance_done` field SHALL default to `false` for all chits

### Requirement 7: Data Model Changes

**User Story:** As a developer, I want the data model to support the new habits feature fields, so that habit preferences persist across sessions.

#### Acceptance Criteria

1. THE Chit model SHALL include a `hide_when_instance_done` field of type boolean with a default value of `false`
2. THE Settings model SHALL include a `habits_success_window` field of type string with a default value of "30"
3. WHEN the backend starts, THE migration function SHALL add the `hide_when_instance_done` column to the `chits` table if the column does not already exist, using an `ALTER TABLE` statement with a column-existence check
4. WHEN the backend starts, THE migration function SHALL add the `habits_success_window` column to the `settings` table if the column does not already exist, using an `ALTER TABLE` statement with a column-existence check
5. THE backend SHALL serialize and deserialize the `hide_when_instance_done` field as part of the standard chit CRUD operations
6. THE backend SHALL include `habits_success_window` in the `get_settings` and `save_settings` functions

### Requirement 8: Settings Page — Success Window Configuration

**User Story:** As a user, I want to configure the time window used for success rate calculations from the Settings page, so that I can choose the period that is most meaningful to me.

#### Acceptance Criteria

1. THE Settings_Page SHALL display a "Habits" section containing a dropdown labeled "Success rate window"
2. THE dropdown SHALL offer four options: "Last 7 days", "Last 30 days", "Last 90 days", and "All time"
3. THE dropdown SHALL map the selected option to the stored values "7", "30", "90", and "all" respectively
4. WHEN the Settings_Page loads, THE dropdown SHALL reflect the current value of `habits_success_window` from the user's settings
5. WHEN the user changes the dropdown and saves settings, THE Settings_Page SHALL persist the new value via the existing settings save mechanism
6. THE dropdown SHALL default to "Last 30 days" when no value has been previously saved

### Requirement 9: Habits View Sorting

**User Story:** As a user, I want habits sorted so that incomplete ones appear first and completed ones are pushed to the bottom, so that I can focus on what still needs doing.

#### Acceptance Criteria

1. THE Habits_View SHALL sort habit cards with not-completed current-period habits above completed current-period habits
2. WITHIN each group (completed and not-completed), THE Habits_View SHALL maintain the order provided by the existing sort and filter pipeline in `displayChits()`
3. WHEN the existing sort controls are used, THE Habits_View SHALL apply the user's chosen sort within each completion group
