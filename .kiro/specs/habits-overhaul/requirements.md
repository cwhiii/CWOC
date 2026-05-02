# Requirements Document

## Introduction

This is a complete redesign of the Habits feature in CWOC (C.W.'s Omni Chits). The current implementation infers habits from any recurring chit, which causes confusion — every recurring chit appears in the Habits view whether the user intends it as a habit or not. The new design replaces this with an explicit opt-in model: a `habit` boolean flag on chits, paired with `habit_goal` and `habit_success` fields for goal/progress tracking. This overhaul also introduces charts, retroactive editing via a Habit Log zone, per-habit calendar visibility, and removes the now-unnecessary `hide_when_instance_done` field and "Show completed" toggle.

CWOC's core philosophy is preserved: one flexible record (the "chit") that morphs based on which fields you fill in. The habit capability is just another opt-in dimension — the "Track as habit" checkbox is always visible in the editor, and checking it auto-enables Repeat if not already on.

## Glossary

- **Chit**: The universal record in CWOC — a single flexible data model that can serve as a task, note, calendar event, alarm, checklist, project, or habit depending on which fields are populated
- **Habits_View**: The view mode within the Tasks tab that displays only chits explicitly marked with `habit=true`, rendered as habit cards with goal progress, streaks, success rates, and status
- **Habit_Card**: A single card in the Habits_View representing one habit-flagged chit, showing title, progress (X/Y), frequency, streak, success rate, and status
- **Habit_Flag**: The `habit` boolean field on a chit — opt-in flag that is always visible in the editor; checking it auto-enables Repeat if not already on
- **Habit_Goal**: The `habit_goal` integer field on a chit — how many times per period the user aims to complete the habit (defaults to 1, required when `habit=true`)
- **Habit_Success**: The `habit_success` integer field on a chit — the current period's completion count, reset to 0 on period rollover
- **Current_Period**: The time window that defines the active occurrence for a habit, determined by its recurrence frequency (e.g., today for daily, this week for weekly, this month for monthly)
- **Period_Rollover**: The process that occurs when a habit's current period ends: snapshot the current `habit_success`/`habit_goal` into a recurrence exception, reset `habit_success` to 0, and clear status back from Complete
- **Success_Rate**: The percentage of past periods where `habit_success >= habit_goal`, calculated within a configurable window
- **Streak**: The count of consecutive periods where `habit_success >= habit_goal`, walking backward from the most recent past period; broken-off instances are neutral (skipped)
- **Success_Window**: A user-configurable setting controlling the rolling time window for success rate calculation, stored as `habits_success_window` in settings (values: "7", "30", "90", "all")
- **Habit_Log**: A zone in the chit editor that displays past period history with editable completion counts and charts
- **Auto_Tag**: System-managed tags automatically applied when `habit=true`: `Habits` and `Habits/[chit title]`
- **Show_On_Calendar**: A per-habit boolean toggle controlling whether the habit appears on calendar views
- **Default_Show_Habits_On_Calendar**: A global setting controlling the default value of `show_on_calendar` for newly created habits
- **Editor**: The chit editor page (`editor.html` + editor JS files) where individual chit properties are configured
- **Settings_Page**: The settings page (`settings.html` + `settings.js`) where global application preferences are configured
- **Recurrence_Exceptions**: The existing `recurrence_exceptions` array on a chit, extended to store per-period habit snapshots (`habit_success`, `habit_goal`)
- **View_Mode_Toggle**: The set of buttons in the Tasks tab sidebar allowing the user to switch between Tasks, Habits, and Assigned modes

## Requirements

### Requirement 1: Habit Opt-In Flag on Chits

**User Story:** As a user, I want to mark any chit as a habit with a single checkbox that's always visible, so that habit tracking is easy to discover and doesn't require me to set up recurrence first.

#### Acceptance Criteria

1. THE Editor SHALL always display a "Track as habit" checkbox in the Dates zone, regardless of whether Repeat is currently enabled
2. WHEN the user checks "Track as habit" AND the chit does not have a recurrence rule enabled, THE Editor SHALL auto-enable Repeat with a default frequency of Daily and an interval of 1
3. WHEN the user checks "Track as habit", THE Editor SHALL set the `habit` field to `true` on the chit and reveal the Goal field, current progress count, and "Show on calendar" toggle
4. WHEN the user unchecks "Track as habit", THE Editor SHALL set the `habit` field to `false` on the chit and hide the Goal field, progress count, and "Show on calendar" toggle
5. WHILE `habit` is `true`, THE Editor SHALL lock the Repeat checkbox to checked (disabled, with a tooltip "Habits require repeat") — the user must uncheck "Track as habit" first to disable Repeat
6. THE `habit` field SHALL default to `false` for all chits

### Requirement 2: Habit Goal and Success Fields

**User Story:** As a user, I want to set a goal for how many times I complete a habit per period and track my progress, so that I can measure my consistency against a target.

#### Acceptance Criteria

1. WHEN `habit` is `true`, THE Editor SHALL display a "Goal" numeric input field with a minimum value of 1 and a default value of 1
2. THE Chit model SHALL include a `habit_goal` integer field that stores how many completions per period the user targets
3. THE Chit model SHALL include a `habit_success` integer field that stores the current period's completion count
4. WHEN `habit` is `true`, THE Editor SHALL display the current progress as "X / Y" where X is `habit_success` and Y is `habit_goal`
5. WHEN `habit_success` reaches `habit_goal`, THE System SHALL auto-set the chit's status to "Complete"
6. WHEN the chit's status is changed back from "Complete" (to any other status or cleared), THE System SHALL reset `habit_success` to 0
7. THE `habit_goal` SHALL default to 1 when `habit` is first set to `true`
8. THE `habit_success` SHALL default to 0

### Requirement 3: Auto-Tagging for Habits

**User Story:** As a user, I want habits to be automatically tagged so that I can filter, search, and group them across the app without manual tag management.

#### Acceptance Criteria

1. WHEN `habit` is set to `true` on a chit, THE System SHALL auto-add the tags `Habits` and `Habits/[chit title]` to the chit's tag list
2. WHEN `habit` is set to `false` on a chit, THE System SHALL remove the `Habits` and `Habits/[chit title]` tags from the chit's tag list
3. WHEN a habit chit's title changes, THE System SHALL update the `Habits/[old title]` tag to `Habits/[new title]`
4. THE auto-tags SHALL be system-managed, following the same pattern as existing CWOC system tags (e.g., `CWOC_System/*`)
5. THE auto-tags SHALL be visible in the tag filter sidebar and Global Search results

### Requirement 4: Habits View Rendering

**User Story:** As a user, I want the Habits view to show only chits I have explicitly marked as habits, with progress, frequency, streak, success rate, and status on each card, so that I can track all my habits at a glance.

#### Acceptance Criteria

1. THE Habits_View SHALL display only chits where `habit` is `true`, not all recurring chits
2. EACH Habit_Card SHALL display: progress as "X / Y" (where X is `habit_success` and Y is `habit_goal`), frequency label, streak with a flame icon (🔥), success rate as a percentage, and status when set
3. WHEN `habit_goal` is 1, THE Habit_Card SHALL display a checkbox interaction — tap to toggle complete for the period
4. WHEN `habit_goal` is greater than 1, THE Habit_Card SHALL display a counter interaction — tap "+" to increment `habit_success`, tap "−" to decrement (minimum 0)
5. THE Habits_View SHALL sort incomplete habits at the top and completed habits at the bottom, with completed habits visually dimmed
6. THE Habit_Card SHALL support double-click navigation to the editor and long-press to open the quick edit modal, matching existing interaction patterns
7. WHEN no chits are marked as habits, THE Habits_View SHALL display an empty state message guiding the user to mark a recurring chit as a habit

### Requirement 5: Goal and Status Synchronization

**User Story:** As a user, I want my habit's status to automatically reflect my progress toward the goal, so that completion tracking is seamless.

#### Acceptance Criteria

1. WHEN `habit_success` reaches `habit_goal` via the Habits_View counter or checkbox, THE System SHALL auto-set the chit's status to "Complete"
2. WHEN the chit's status is manually changed back from "Complete" while `habit` is `true`, THE System SHALL reset `habit_success` to 0
3. WHEN `habit_success` is incremented beyond `habit_goal`, THE System SHALL cap `habit_success` at `habit_goal`
4. WHEN `habit_success` is decremented below `habit_goal` after the habit was auto-completed, THE System SHALL clear the "Complete" status

### Requirement 6: Period Rollover

**User Story:** As a user, I want my habit progress to reset at the start of each new period with the previous period's results saved, so that I start fresh each period without losing history.

#### Acceptance Criteria

1. THE System SHALL evaluate period rollover lazily — on view load or editor load, not via a background process
2. WHEN the current period has changed since the last recorded period, THE System SHALL snapshot the current `habit_success` and `habit_goal` values into a recurrence exception for the ended period
3. WHEN period rollover occurs, THE System SHALL reset `habit_success` to 0
4. WHEN period rollover occurs AND the chit's status is "Complete", THE System SHALL clear the status back from "Complete"
5. EACH habit SHALL run on its own schedule based on its recurrence rule — rollover is per-habit, not global
6. THE recurrence exception snapshot SHALL store `habit_success` and `habit_goal` values so that historical data is preserved for charts and retroactive editing

### Requirement 7: Per-Habit Calendar Visibility

**User Story:** As a user, I want to control whether individual habits appear on the calendar, so that I can keep my calendar uncluttered while still tracking habits.

#### Acceptance Criteria

1. WHEN `habit` is `true`, THE Editor SHALL display a "Show on calendar" toggle
2. THE `show_on_calendar` field SHALL default to the value of the global `default_show_habits_on_calendar` setting when a chit is first marked as a habit
3. WHEN `show_on_calendar` is `false`, THE Calendar views SHALL exclude the habit chit from rendering
4. WHEN `show_on_calendar` is `true`, THE Calendar views SHALL include the habit chit in rendering as normal
5. THE Settings_Page SHALL include a "Default: show habits on calendar" toggle in the Habits settings section

### Requirement 8: Success Rate Calculation

**User Story:** As a user, I want to see what percentage of past periods I met my goal, within a configurable time window, so that I can gauge my long-term consistency.

#### Acceptance Criteria

1. THE Success_Rate SHALL be calculated as `(periods where habit_success >= habit_goal) / (total periods)` within the configured Success_Window, rounded to the nearest integer
2. WHEN the Success_Window is set to "7", THE Success_Rate SHALL consider only periods within the last 7 days
3. WHEN the Success_Window is set to "30", THE Success_Rate SHALL consider only periods within the last 30 days
4. WHEN the Success_Window is set to "90", THE Success_Rate SHALL consider only periods within the last 90 days
5. WHEN the Success_Window is set to "all", THE Success_Rate SHALL consider all periods from when tracking started (the date `habit` was first set to `true`, not necessarily the chit creation date)
6. THE Success_Rate SHALL exclude broken-off instances from both numerator and denominator
7. IF no past periods exist within the Success_Window, THEN THE Success_Rate SHALL display "0%"

### Requirement 9: Streak Calculation

**User Story:** As a user, I want to see how many consecutive periods I have met my goal, so that I can stay motivated by my consistency.

#### Acceptance Criteria

1. THE Streak SHALL count consecutive periods where `habit_success >= habit_goal`, walking backward from the most recent past period
2. THE Streak SHALL treat broken-off (skipped) instances as neutral — broken-off periods SHALL NOT break the streak and SHALL NOT count toward the streak
3. WHEN a genuinely missed period is encountered (habit_success < habit_goal and not broken off), THE Streak SHALL stop counting
4. THE Streak SHALL only count periods from when habit tracking started, not from the chit's original creation date if earlier
5. IF no consecutive completed periods exist, THEN THE Streak SHALL display 0
6. THE Streak SHALL display with a flame icon (e.g., "🔥 5")

### Requirement 10: Habit Charts

**User Story:** As a user, I want to see visual charts of my habit performance over time, so that I can identify trends and stay motivated.

#### Acceptance Criteria

1. THE Habit_Log zone in the Editor SHALL display charts in a 2-column grid layout, expandable to full-width on click
2. THE charts SHALL include: completion over time (bar or line chart showing habit_success vs habit_goal per period), success rate trend (rolling success rate percentage over time), and streak history (visual timeline of streaks)
3. THE chart time range SHALL match the Success_Window setting (7, 30, 90 days, or all time)
4. THE charts SHALL be rendered using vanilla JS and HTML/CSS (canvas or SVG), with no external charting libraries
5. THE charts SHALL follow CWOC's visual theme (parchment aesthetic, brown tones, Lora font)
6. THE charts SHALL update when the user edits past period counts in the Habit Log

### Requirement 11: Retroactive Editing via Habit Log

**User Story:** As a user, I want to edit past periods' completion counts, so that I can correct mistakes or fill in data I forgot to record.

#### Acceptance Criteria

1. THE Habit_Log zone in the Editor SHALL display a list of past periods with their completion counts (habit_success / habit_goal)
2. THE Habit_Log SHALL allow the user to edit any past period's `habit_success` count by clicking on the count value
3. WHEN a past period's count is edited, THE System SHALL update the corresponding recurrence exception's `habit_success` value
4. WHEN a past period's count is edited, THE System SHALL recalculate the streak, success rate, and charts to reflect the change
5. THE Habit_Log SHALL display periods in reverse chronological order (most recent first)
6. THE Habit_Log SHALL only show periods from when habit tracking started

### Requirement 12: Editor Integration

**User Story:** As a user, I want the chit editor to surface all habit controls in a logical layout, so that I can configure and monitor my habits from one place.

#### Acceptance Criteria

1. THE Editor SHALL always display the "Track as habit" checkbox in the Dates zone, regardless of whether Repeat is enabled
2. WHEN "Track as habit" is checked, THE Editor SHALL reveal: a Goal numeric input, the current progress count (habit_success / habit_goal), and a "Show on calendar" toggle, all within the Dates zone
3. WHEN "Track as habit" is checked AND Repeat is not enabled, THE Editor SHALL auto-enable Repeat with a default of Daily
4. THE Editor SHALL include a "Habit Log" collapsible zone that displays past period history, editable counts, and charts
5. THE Habit_Log zone SHALL only be visible when `habit` is `true`
6. THE Habit_Log zone SHALL use the existing collapsible zone pattern (Alt+hotkey toggle, zone header with expand/collapse)

### Requirement 13: Data Model Changes

**User Story:** As a developer, I want the data model to support the new habit fields, so that habit data persists correctly across sessions.

#### Acceptance Criteria

1. THE Chit model SHALL include a `habit` field of type boolean with a default value of `false`
2. THE Chit model SHALL include a `habit_goal` field of type integer with a default value of 1
3. THE Chit model SHALL include a `habit_success` field of type integer with a default value of 0
4. THE Chit model SHALL include a `show_on_calendar` field of type boolean with a default value of `true`
5. THE Chit model SHALL remove the `hide_when_instance_done` field
6. THE Settings model SHALL include a `default_show_habits_on_calendar` field of type string with a default value of "1" (enabled)
7. WHEN the backend starts, THE migration function SHALL add the `habit`, `habit_goal`, `habit_success`, and `show_on_calendar` columns to the `chits` table if they do not already exist, using `ALTER TABLE` statements with column-existence checks
8. WHEN the backend starts, THE migration function SHALL add the `default_show_habits_on_calendar` column to the `settings` table if it does not already exist
9. WHEN the backend starts, THE migration function SHALL drop the `hide_when_instance_done` column from the `chits` table (SQLite requires table rebuild for column removal — use the standard copy-to-temp, recreate, copy-back pattern)
10. THE backend SHALL serialize and deserialize the new habit fields as part of standard chit CRUD operations
11. THE recurrence_exceptions entries SHALL support `habit_success` and `habit_goal` fields for period snapshots

### Requirement 14: Removal of Legacy Habits Behavior

**User Story:** As a developer, I want to remove the old habits implementation that inferred habits from all recurring chits, so that the codebase is clean and only the new explicit opt-in model exists.

#### Acceptance Criteria

1. THE Habits_View SHALL no longer filter chits by `recurrence_rule` presence — it SHALL filter by `habit === true` only
2. THE Editor SHALL remove the "Hide from Habits when done" checkbox and all references to `hide_when_instance_done`
3. THE Habits_View SHALL remove the "Show completed" toggle that was used with `hide_when_instance_done`
4. THE frontend SHALL remove all logic that treats recurring chits as habits by default
5. THE backend SHALL remove the `hide_when_instance_done` field from the Chit Pydantic model
6. THE migration SHALL handle the transition cleanly — existing chits with `hide_when_instance_done=true` do not need migration to the new model since the field is simply removed

### Requirement 15: Settings Page — Habits Configuration

**User Story:** As a user, I want to configure habit-related global settings from the Settings page, so that I can customize the habits experience to my preferences.

#### Acceptance Criteria

1. THE Settings_Page SHALL display a "Habits" section containing: a "Success rate window" dropdown and a "Default: show habits on calendar" toggle
2. THE "Success rate window" dropdown SHALL offer four options: "Last 7 days" (value "7"), "Last 30 days" (value "30"), "Last 90 days" (value "90"), and "All time" (value "all")
3. THE "Default: show habits on calendar" toggle SHALL control the default value of `show_on_calendar` for newly created habits
4. WHEN the Settings_Page loads, THE controls SHALL reflect the current values from the user's settings
5. WHEN the user saves settings, THE Settings_Page SHALL persist the new values via the existing settings save mechanism

### Requirement 16: Tasks Tab View Mode Toggle Update

**User Story:** As a user, I want the Tasks tab to offer Tasks, Habits, and Assigned view modes, so that I can switch between different perspectives within the same tab.

#### Acceptance Criteria

1. WHEN the Tasks tab is active, THE View_Mode_Toggle SHALL display three buttons: "📋 Tasks", "🔁 Habits", and "📌 Assigned"
2. THE View_Mode_Toggle SHALL persist the selected mode to `localStorage` under the key `cwoc_tasksViewMode`
3. WHEN the user selects "Habits" mode, THE Habits_View SHALL render only chits where `habit` is `true`
4. WHEN the view mode changes, THE System SHALL re-render the chit list by calling `displayChits()`
5. THE View_Mode_Toggle SHALL default to "Tasks" mode when no persisted preference exists
6. WHEN in Habits mode, THE sidebar SHALL display the "Success Window" dropdown for configuring the success rate calculation window

