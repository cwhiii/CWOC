# Requirements Document

## Introduction

This feature achieves full behavioral parity between the CWOC Android app and the mobile browser version for the Habits System (Web Function Index items 1–25). After implementation, an end user should not be able to distinguish between using the Android app and the mobile browser — identical calculations, identical data flow, identical visual output, identical sort order, identical edge-case handling.

The scope covers the incomplete items from the Web Function Index (items 1–25):
- Item 1: `displayHabitsView` — missing client-side rollover, wrong urgency score, missing period labels, missing "next cycle starts" text
- Item 5: `_habitUrgencyScore` — Android uses wrong inputs (resetPeriod/lastActionDate instead of recurrence freq + getCurrentPeriodDate)
- Item 9: `_onHabitsWindowChange` — not synced to server
- Item 14: `getCurrentPeriodDate` — entirely missing
- Item 15: `_getPreviousPeriodDate` — entirely missing
- Item 16: `_evaluateHabitRollover` — entirely missing
- Item 17: `_persistHabitRollover` — entirely missing
- Item 18: `getHabitSuccessRate` — uses wrong algorithm (Android counts only existing snapshots but doesn't match the web's inline calculation either — window is treated as days instead of entry count)
- Item 19: `getHabitStreak` — returns 0 or 1 only (web walks backward through all snapshots)

**Critical finding:** The web's `displayHabitsView` uses an INLINE success rate and streak calculation that differs from the `getHabitSuccessRate`/`getHabitStreak` functions in `shared-habits.js`. Those functions walk the full recurrence but are NEVER called from the habits view. The actual user-visible behavior uses the simpler inline calculation. This spec matches the ACTUAL mobile browser behavior, not the unused utility functions.

## Glossary

- **Habit_Period_Calculator**: A shared domain utility class responsible for computing recurrence period dates, walking recurrence occurrences, and determining period boundaries for habit chits.
- **Rollover_Engine**: The component that detects when a habit's current period has advanced past the last recorded period, snapshots progress, and resets the counter.
- **Recurrence_Rule**: A JSON object on a chit containing `freq` (DAILY/WEEKLY/MONTHLY/YEARLY), `interval`, `byDay`, `until`, and other RFC 5545-derived fields.
- **Recurrence_Exceptions**: A JSON array on a chit containing period snapshot entries with fields: `date`, `habit_success`, `habit_goal`, `completed`, `broken_off`.
- **Period_Date**: A YYYY-MM-DD string representing the start date of a recurrence period.
- **Success_Window**: A user setting ("7", "30", "90", or "all") controlling how many recent period entries are included in success rate calculations. NOTE: This is a COUNT of entries, not a number of days.
- **Settings_Sync**: The mechanism by which user preference changes are persisted to the server via the `/api/settings` endpoint so they sync across all devices.
- **Week_Start_Day**: A user setting (0=Sunday through 6=Saturday) defining which day begins the week for weekly recurrence calculations.

## Requirements

### Requirement 1: Compute Current Period Date

**User Story:** As a user with recurring habits, I want the Android app to correctly identify which recurrence period today falls into, so that rollover detection, urgency scoring, and period labels all work correctly.

#### Acceptance Criteria

1. WHEN a habit chit has a DAILY recurrence with interval equal to 1, THE Habit_Period_Calculator SHALL return today's date as the current period date in `YYYY-MM-DD` format.
2. WHEN a habit chit has a DAILY recurrence with interval greater than 1, THE Habit_Period_Calculator SHALL walk forward from start_datetime by interval-day steps and return the most recent step date that is less than or equal to today in `YYYY-MM-DD` format.
3. WHEN a habit chit has a WEEKLY recurrence with byDay specified and interval equal to 1, THE Habit_Period_Calculator SHALL return the most recent scheduled day (matching byDay) that is less than or equal to today and on or after start_datetime.
4. WHEN a habit chit has a WEEKLY recurrence with byDay specified and interval greater than 1, THE Habit_Period_Calculator SHALL walk from start_datetime advancing day-by-day, skipping (interval-1) weeks when wrapping to the first byDay of a new cycle, and return the most recent matching day less than or equal to today.
5. WHEN a habit chit has a WEEKLY recurrence without byDay and interval equal to 1, THE Habit_Period_Calculator SHALL return the start of the current week according to the Week_Start_Day setting (0=Sunday through 6=Saturday, defaulting to 0 if the setting is unavailable), clamped to not precede start_datetime.
6. WHEN a habit chit has a WEEKLY recurrence without byDay and interval greater than 1, THE Habit_Period_Calculator SHALL align start_datetime to the Week_Start_Day (0=Sunday through 6=Saturday, defaulting to 0 if the setting is unavailable), walk forward by interval-week steps, and return the most recent step date less than or equal to today.
7. WHEN a habit chit has a MONTHLY recurrence with interval equal to 1, THE Habit_Period_Calculator SHALL return the first day of the current month.
8. WHEN a habit chit has a MONTHLY recurrence with interval greater than 1, THE Habit_Period_Calculator SHALL walk from the first of the start month by interval-month steps and return the most recent step date less than or equal to today.
9. WHEN a habit chit has a YEARLY recurrence with interval equal to 1, THE Habit_Period_Calculator SHALL return January 1 of the current year.
10. WHEN a habit chit has a YEARLY recurrence with interval greater than 1, THE Habit_Period_Calculator SHALL walk from the start year by interval-year steps and return January 1 of the most recent step year less than or equal to today.
11. WHEN a habit chit has a start_datetime strictly after today (comparing date portions only), THE Habit_Period_Calculator SHALL return the date portion of start_datetime as the current period date.
12. WHEN a habit chit has no start_datetime, THE Habit_Period_Calculator SHALL return today's date.
13. WHEN a habit chit has no recurrence_rule or no freq field, THE Habit_Period_Calculator SHALL return today's date.
14. IF the recurrence_rule contains a freq value other than DAILY, WEEKLY, MONTHLY, or YEARLY, THEN THE Habit_Period_Calculator SHALL return today's date.
15. THE Habit_Period_Calculator SHALL return all period dates as strings in `YYYY-MM-DD` format representing local calendar dates.

### Requirement 2: Compute Previous Period Date

**User Story:** As a user with recurring habits, I want the Android app to correctly determine the period immediately before the current one, so that rollover detection can identify whether a period boundary has been crossed.

#### Acceptance Criteria

1. WHEN the recurrence frequency is DAILY, THE Habit_Period_Calculator SHALL return the current period date minus (interval) days as the previous period date.
2. WHEN the recurrence frequency is WEEKLY, THE Habit_Period_Calculator SHALL return the current period date minus (interval × 7) days as the previous period date.
3. WHEN the recurrence frequency is MONTHLY, THE Habit_Period_Calculator SHALL return the current period date minus (interval) months as the previous period date, clamping to the last valid day of the resulting month when the original day exceeds the target month's length.
4. WHEN the recurrence frequency is YEARLY, THE Habit_Period_Calculator SHALL return the current period date minus (interval) years as the previous period date, clamping to February 28 when the original date is February 29 and the target year is not a leap year.
5. IF the recurrence_rule has no freq field, THEN THE Habit_Period_Calculator SHALL return null.
6. IF the recurrence_rule has no interval field, THEN THE Habit_Period_Calculator SHALL treat the interval as 1.
7. IF the recurrence frequency is a value other than DAILY, WEEKLY, MONTHLY, or YEARLY, THEN THE Habit_Period_Calculator SHALL return null.

### Requirement 3: Client-Side Habit Rollover Detection

**User Story:** As a user opening the Android app, I want stale habit data to be automatically rolled over to the correct period even if the server scheduler hasn't run yet, so that I always see accurate current-period progress.

#### Acceptance Criteria

1. WHEN the Habits View loads, THE Rollover_Engine SHALL evaluate rollover for each chit where `habit` is true and `recurrence_rule` contains a non-null `freq` value, completing evaluation before the habit list is displayed to the user.
2. WHEN the chit editor loads a habit chit, THE Rollover_Engine SHALL evaluate rollover for that chit before displaying it.
3. WHEN a habit chit has no previous snapshots in recurrence_exceptions (no entries with a `habit_success` field defined), THE Rollover_Engine SHALL not perform rollover and SHALL treat the current habit_success as belonging to the current period.
4. WHEN the most recent snapshot date in recurrence_exceptions is greater than or equal to the previous period date, THE Rollover_Engine SHALL not perform rollover.
5. WHEN the most recent snapshot date in recurrence_exceptions is older than the previous period date, THE Rollover_Engine SHALL create a new exception entry with `date` equal to the previous period date, `habit_success` equal to the current habit_success value, `habit_goal` equal to the current habit_goal value, and `completed` equal to whether habit_success is greater than or equal to habit_goal.
6. WHEN rollover occurs, THE Rollover_Engine SHALL reset the chit's habit_success to 0 and SHALL preserve the existing habit_goal value unchanged.
7. WHEN rollover occurs and the chit's status is "Complete", THE Rollover_Engine SHALL clear the status to an empty string.
8. IF an exception entry already exists for the previous period date but lacks a `habit_success` field, THEN THE Rollover_Engine SHALL add `habit_success`, `habit_goal`, and `completed` fields to that existing entry rather than creating a duplicate.
9. IF an exception entry already exists for the previous period date and already has a `habit_success` field, THEN THE Rollover_Engine SHALL not perform rollover.
10. WHEN rollover modifies a chit, THE Rollover_Engine SHALL persist the updated `habit_success`, `status`, and `recurrence_exceptions` fields to the backend asynchronously without blocking the UI from rendering the rolled-over state.
11. IF persistence of rollover changes fails due to a network or server error, THEN THE Rollover_Engine SHALL retain the rolled-over state in local memory for the current session and SHALL log the failure without displaying an error to the user.

### Requirement 4: Persist Habit Rollover to Server

**User Story:** As a user whose habit has been rolled over client-side, I want the rollover changes to be saved to the server, so that the data is consistent across all my devices.

#### Acceptance Criteria

1. WHEN rollover occurs for a habit chit, THE Rollover_Engine SHALL persist the updated habit_success, recurrence_exceptions, and status fields to the server via PATCH to `/api/chits/{id}/fields`.
2. THE Rollover_Engine SHALL invoke the persistence call asynchronously (fire-and-forget) so that habit view rendering proceeds without waiting for the server response.
3. IF the PATCH request fails due to a network error or returns an HTTP status of 500 or above, THEN THE Rollover_Engine SHALL log the failure and mark the chit as dirty for retry on the next sync cycle.
4. IF the PATCH request returns HTTP 404, THEN THE Rollover_Engine SHALL discard the rollover persistence attempt without retry, as the chit no longer exists on the server.

### Requirement 5: Success Rate Calculation (Snapshot-Based)

**User Story:** As a user viewing my habit success rate, I want the Android app to calculate it identically to the web's habits view, so that the percentage shown matches exactly.

**IMPORTANT:** The web's `displayHabitsView` uses an inline calculation that counts only EXISTING snapshot entries in `recurrence_exceptions`. It does NOT walk the full recurrence. The `getHabitSuccessRate` function in `shared-habits.js` exists but is NEVER called from the habits view. This requirement matches the ACTUAL user-visible behavior.

#### Acceptance Criteria

1. THE success rate calculation SHALL collect all entries from `recurrence_exceptions` that have both `habit_success` and `habit_goal` fields defined AND do not have `broken_off` set to true AND have a non-empty `date` field.
2. IF the habit's current period is complete (habit_success >= habit_goal), THE calculation SHALL add a synthetic entry representing the current period to the collected entries.
3. THE calculation SHALL apply the Success_Window as a COUNT of most recent entries: if the window is "all", use all entries; otherwise parse the window value as an integer and take the last N entries (e.g., window "30" means the 30 most recent entries, NOT the last 30 days).
4. FOR each entry in the windowed set, THE calculation SHALL count it as "met" if its `habit_success` >= its `habit_goal`.
5. THE calculation SHALL return `Math.round((metCount / totalEntries) * 100)` as an integer 0–100, or 0 when totalEntries is 0.
6. THE calculation SHALL NOT walk the recurrence to find "expected" periods. Only entries that actually exist in `recurrence_exceptions` (plus the current period if complete) are counted.

### Requirement 6: Streak Calculation (Snapshot-Based)

**User Story:** As a user viewing my habit streak, I want the Android app to show the actual consecutive-period streak count matching the web's habits view exactly.

**IMPORTANT:** The web's `displayHabitsView` uses an inline streak calculation that walks backward through the collected `periodEntries` array (existing snapshots + current if complete). It does NOT walk the full recurrence. This requirement matches the ACTUAL user-visible behavior.

#### Acceptance Criteria

1. THE streak calculation SHALL use the same collected entries as the success rate calculation: all entries from `recurrence_exceptions` with `habit_success` and `habit_goal` fields, excluding `broken_off` entries, plus the current period if complete.
2. THE streak calculation SHALL walk backward from the LAST entry in the collected array, counting consecutive entries where `habit_success >= habit_goal`.
3. THE streak calculation SHALL stop counting at the first entry where `habit_success < habit_goal`.
4. THE streak calculation SHALL return the count as an integer >= 0.
5. IF there are no collected entries, THE streak calculation SHALL return 0.

### Requirement 7: Urgency Score Uses getCurrentPeriodDate

**User Story:** As a user viewing the habits list, I want habits sorted by urgency identically to the web, so that the most time-critical habits appear at the top.

**IMPORTANT:** The web's `_habitUrgencyScore` uses `getCurrentPeriodDate(chit)` and the recurrence frequency to determine days left in the cycle. The Android currently uses `habitLastActionDate` and `habitResetPeriod` — a completely different approach that produces different sort orders.

#### Acceptance Criteria

1. THE urgency score SHALL be calculated as: `daysLeft / remaining`, where `remaining = goal - success`.
2. IF remaining <= 0 (habit is complete), THE urgency score SHALL return 9999 (least urgent).
3. THE urgency score SHALL determine `daysInCycle` from the recurrence_rule frequency: DAILY=1, WEEKLY=7, MONTHLY=30, YEARLY=365.
4. THE urgency score SHALL call `getCurrentPeriodDate(chit)` to get the current period start date.
5. IF getCurrentPeriodDate returns a valid date, THE urgency score SHALL compute `elapsed = floor((today - periodStart) / 86400000)` and `daysLeft = max(1, daysInCycle - elapsed)`.
6. IF getCurrentPeriodDate is unavailable or returns null, THE urgency score SHALL use `daysInCycle` as `daysLeft`.
7. THE urgency score SHALL return `daysLeft / remaining` as a float (lower = more urgent).
8. THE habits list SHALL sort the "On Deck" section by urgency score ascending (most urgent first).

### Requirement 8: Period Label on Habit Cards

**User Story:** As a user viewing habit cards, I want to see the current period label (e.g., "Week of Apr 28", "May 2026") matching the web exactly.

#### Acceptance Criteria

1. EACH habit card SHALL display a period label derived from `getCurrentPeriodDate(chit)` and the recurrence frequency.
2. WHEN the frequency is WEEKLY, THE period label SHALL be formatted as "Week of {Mon} {day}" (e.g., "Week of Apr 28").
3. WHEN the frequency is MONTHLY, THE period label SHALL be formatted as "{Mon} {year}" (e.g., "May 2026").
4. WHEN the frequency is YEARLY, THE period label SHALL be formatted as "{year}" (e.g., "2026").
5. WHEN the frequency is DAILY, THE period label SHALL be formatted as "{Mon} {day}, {year}" (e.g., "May 19, 2026").
6. THE period label SHALL appear after the habit title, separated by " · ".
7. IF getCurrentPeriodDate returns null or an unparseable value, THE period label SHALL be omitted.

### Requirement 9: "Next Cycle Starts" on Completed Habits

**User Story:** As a user viewing a completed habit, I want to see when the next cycle starts, matching the web's display.

#### Acceptance Criteria

1. WHEN a habit is in the "Accomplished" section (success >= goal), THE card SHALL display "✅ Complete for this cycle. (Next cycle starts {date}.)" where {date} is the start of the next period.
2. THE next period date SHALL be computed by advancing the current period date by one interval: DAILY += interval days, WEEKLY += interval*7 days, MONTHLY += interval months, YEARLY += interval years.
3. THE next period date SHALL be formatted as "{Mon} {day}" (e.g., "Apr 28").
4. IF the next period date cannot be computed (no recurrence rule or no getCurrentPeriodDate), THE card SHALL display "✅ Complete for this cycle" without the parenthetical.

### Requirement 10: Habits Success Window Server Sync

**User Story:** As a user changing my habits success window on the Android app, I want that preference to sync to the server, so that the same window setting appears on all my devices.

#### Acceptance Criteria

1. WHEN the user changes the habits success window value, THE Settings_Sync SHALL update the SettingsEntity.habitsSuccessWindow field in the local Room database to the selected value, which must be one of "7", "30", "90", or "all".
2. WHEN the user changes the habits success window value, THE Settings_Sync SHALL mark the settings as dirty for sync push to the server.
3. WHEN connectivity is available and settings are marked dirty, THE Settings_Sync SHALL push the updated habits_success_window to the server via the settings sync mechanism.
4. IF the sync push fails due to network error or server error response, THEN THE Settings_Sync SHALL preserve the isDirty flag so that the push is retried on the next sync cycle.
5. WHEN the local update completes, THE Settings_Sync SHALL re-render the habits view with the new window value.

### Requirement 11: Combined Success Rate Matches Web

**User Story:** As a user viewing the aggregate success rate bar, I want it to use the same snapshot-based calculation for each chit habit that the individual cards use.

#### Acceptance Criteria

1. THE TasksViewModel SHALL compute each chit habit's met count and total periods using the snapshot-based success rate calculation (Requirement 5): collecting existing exception entries with habit_success/habit_goal fields, adding current period if complete, applying the window as an entry count.
2. THE TasksViewModel SHALL incorporate each rule habit's success rate using the formula: round(successRate × 100) added to totalMet and 100 added to totalPeriods, skipping any rule habit whose successRate is null.
3. THE TasksViewModel SHALL compute the combined rate as round((totalMet / totalPeriods) × 100), yielding an integer from 0 to 100.
4. IF totalPeriods is 0, THEN THE TasksViewModel SHALL emit null (no aggregate bar displayed).

### Requirement 12: Rollover Triggers in All Habit Display Contexts

**User Story:** As a user viewing habits in any context (dashboard, calendar, omni view), I want rollover to be evaluated consistently.

#### Acceptance Criteria

1. WHEN the habits view renders in the Tasks tab, THE Rollover_Engine SHALL evaluate rollover for each habit before computing metrics.
2. WHEN the chit editor opens a habit chit, THE Rollover_Engine SHALL evaluate rollover before populating the form.
3. WHEN the calendar view renders habit chits (itinerary or other views that show habit progress), THE Rollover_Engine SHALL evaluate rollover for those chits.
4. WHEN the omni view renders habit sections, THE Rollover_Engine SHALL evaluate rollover for habit chits before display.
5. THE Rollover_Engine SHALL be idempotent: calling it multiple times on the same chit in the same session SHALL not create duplicate snapshots or reset habit_success more than once.
