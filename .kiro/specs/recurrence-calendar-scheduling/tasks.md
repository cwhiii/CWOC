# Implementation Plan

## Overview

This plan implements 26 missing/partial web functions for Android parity across recurrence management, calendar enhancements, scheduling utilities, and editor/settings gaps. Tasks are ordered by dependency and implementation priority.

## Task Dependency Graph

```
Task 3 depends on Task 2
Task 9 depends on Task 8
Task 4 depends on Task 3
```

## Tasks

- [x] 1. Wire ProjectsZone Callbacks (Pick Chit + Create New Child) <!-- dep: none -->
  - [x] 1.1. In `ChitEditorScreen.kt`, locate the `ProjectsZone` composable call and wire `onPickChit` to show `ProjectChitPickerSheet` with the current project's existing child IDs as `alreadyAssignedIds`
  - [x] 1.2. Wire `onConfirmSelection` from `ProjectChitPickerSheet` to update `formState.childChits` with the newly selected IDs appended
  - [x] 1.3. Wire `onCreateNewChild` to show a title prompt (using an AlertDialog with OutlinedTextField), then on confirm: create a new chit via `apiService.createChit()` with the entered title, status="ToDo", and add the new chit's ID to `formState.childChits`
  - [x] 1.4. After creating a new child chit, navigate to the editor for the new chit using the navigation callback
  - [x] 1.5. Verify: tapping "Pick Chit" opens the picker, selecting chits adds them to the Kanban board; tapping "Create New" prompts for title, creates the chit, adds it to the board
  - Requirements: 21, 22

- [x] 2. Add Instance Banner to Chit Editor <!-- dep: none -->
  - [x] 2.1. In `ChitEditorViewModel`, add a `seriesInfo: StateFlow<SeriesInfo?>` that computes series info when the loaded chit has a non-null recurrenceRule, using `RecurrenceEngine().computeSeriesInfo()`
  - [x] 2.2. Add a `instanceBannerText: StateFlow<String?>` derived from seriesInfo: "Instance X of Y" when rule has until date, "Instance X" when infinite, null when not recurring
  - [x] 2.3. In `ChitEditorScreen.kt`, add a banner composable at the top of the editor content (above all zones) that displays `instanceBannerText` when non-null, styled with parchment theme (background color, Lora font, centered text)
  - [x] 2.4. Add a "Series Actions" button/icon in the banner that triggers the RecurrenceActionSheet (Task 4)
  - [x] 2.5. Verify: opening a recurring chit instance shows "Instance X of Y" banner; non-recurring chits show no banner
  - Requirements: 1, 6

- [x] 3. Implement Complete Series and Break Off Instance Actions <!-- dep: 2 -->
  - [x] 3.1. In `ChitEditorViewModel`, add `completeSeries()` method: fetches the parent chit by ID, sets status="Complete" and completedDatetime=now (ISO 8601 UTC), calls `upsertAndSync()`, then calls `checkAutoArchive()`
  - [x] 3.2. Add `breakOffInstance(dateStr: String)` method: fetches parent chit, creates a new standalone chit copying all content fields (title, note, tags, checklist, people, location, alerts, status, color) with the instance's specific dates and recurrence fields set to null, adds broken_off exception to parent's recurrenceExceptions, calls `upsertAndSync()` for both, navigates to new chit editor
  - [x] 3.3. Add `checkAutoArchive(chitId: String)` method: loads the chit, parses rule and exceptions, calls `RecurrenceEngine().shouldAutoArchive()`, if true calls `ChitRepository.archive()`
  - [x] 3.4. Wire `onCompleteSeries` in `QuickEditSheet` caller to invoke `completeSeries()` with a confirmation dialog first
  - [x] 3.5. Wire `onBreakOffInstance` in `QuickEditSheet` caller to invoke `breakOffInstance()` with the current instance date
  - [x] 3.6. Show success/error toasts for both actions
  - Requirements: 3, 4, 5

- [x] 4. Create RecurrenceActionSheet and RecurrenceDeleteSheet <!-- dep: 3 -->
  - [x] 4.1. Create `ui/components/RecurrenceActionSheet.kt`: a ModalBottomSheet with three action rows — "✅ Complete Series", "✂️ Break Off Instance", "📊 View Series Summary" — each with an icon and label
  - [x] 4.2. Wire each action to dismiss the sheet and execute the corresponding action (completeSeries, breakOffInstance, or scroll to/expand the series summary section)
  - [x] 4.3. Create `ui/components/RecurrenceDeleteSheet.kt`: a ModalBottomSheet shown when deleting a recurring instance, with three options — "Delete this instance", "Delete this and following", "Delete entire series"
  - [x] 4.4. "Delete this instance": add broken_off exception to parent's recurrenceExceptions, call upsertAndSync, show undo toast
  - [x] 4.5. "Delete this and following": set parent's recurrenceRule.until to the day before the selected instance, call upsertAndSync, show undo toast
  - [x] 4.6. "Delete entire series": show danger confirmation dialog, on confirm soft-delete the parent chit, show undo toast
  - [x] 4.7. Integrate RecurrenceDeleteSheet into the existing delete flow: when user triggers delete on a chit that has recurrenceRule, show RecurrenceDeleteSheet instead of simple delete confirmation
  - Requirements: 7, 8, 9, 10

- [x] 5. All-Day Events Height Cap in Calendar Views <!-- dep: none -->
  - [x] 5.1. In `CalendarViewModel`, add `_allDayExpanded: MutableStateFlow<Boolean>(false)` and expose as `allDayExpanded: StateFlow<Boolean>`
  - [x] 5.2. Add `toggleAllDayExpanded()` method that flips the value
  - [x] 5.3. In `loadEvents()` or date navigation methods, reset `_allDayExpanded` to false when the date range changes
  - [x] 5.4. In the calendar week/day view composables, filter all-day events: when collapsed, show max 3 rows; when expanded, show all
  - [x] 5.5. When collapsed and more than 3 all-day events exist, show a "+N more" text button that calls `toggleAllDayExpanded()`
  - [x] 5.6. When expanded, show a "Show less" text button that calls `toggleAllDayExpanded()`
  - [x] 5.7. Verify: with 5+ all-day events, only 3 show initially with "+2 more" toggle; tapping expands; navigating to another day resets to collapsed
  - Requirements: 11

- [x] 6. X-Day View UI Control <!-- dep: none -->
  - [x] 6.1. In the calendar header area (or view mode selector), add a UI control that allows selecting the number of days (1–7) when in X_DAY mode
  - [x] 6.2. Read the initial value from `SettingsEntity.customDaysCount` (already loaded into `CalendarUiState.xDayCount`)
  - [x] 6.3. When the user changes the day count, update `CalendarUiState.xDayCount` and re-render the view
  - [x] 6.4. Ensure the view mode selector includes "X-Day" as an option (it already has `CalendarViewMode.X_DAY`)
  - [x] 6.5. Verify: selecting X-Day mode shows a day count picker; changing from 3 to 5 days re-renders with 5 columns; forward/back navigation shifts by the configured count
  - Requirements: 12

- [x] 7. Verify Perpetual Mode and Default Notifications <!-- dep: none -->
  - [x] 7.1. Read `DateZone.kt` and verify that `DateMode.PERPETUAL` radio option appears when `habitActive` is true
  - [x] 7.2. Verify that selecting Perpetual sets start date to today if empty, clears end date, and displays "Since [date]" format
  - [x] 7.3. Verify that deactivating habit while in Perpetual mode switches to Start/End and clears perpetual flag
  - [x] 7.4. Read `applyDefaultNotifications()` in DateZone and verify it reads the `default_notifications` setting, applies only on first activation, and tracks applied modes
  - [x] 7.5. Verify that `AlertsZone` expands via `forceExpanded` prop when defaults are added
  - [x] 7.6. If any behavior is missing or broken, fix it; otherwise mark requirements as verified
  - Requirements: 13, 14

- [x] 8. Create CronUtils Domain Class <!-- dep: none -->
  - [x] 8.1. Create `android/app/src/main/java/com/cwoc/app/domain/rules/CronUtils.kt`
  - [x] 8.2. Implement `describe(expr: String, timeFormat: String = "12hour"): String` — parses 5-field cron expression and returns human-readable description (e.g., "At 9:00 AM, Monday through Friday")
  - [x] 8.3. Handle special characters: `*` (every), `,` (list), `-` (range), `/` (step) in all fields
  - [x] 8.4. Use day names (Monday, Tuesday...) and month names (January, February...) in descriptions
  - [x] 8.5. Respect timeFormat parameter for hour display (12-hour with AM/PM vs 24-hour)
  - [x] 8.6. Implement `validate(expr: String): CronValidationResult` data class with `isValid: Boolean`, `errors: List<CronFieldError>` where each error has `field: String` and `message: String`
  - [x] 8.7. Validate: exactly 5 space-separated fields, minute 0–59, hour 0–23, day-of-month 1–31, month 1–12, day-of-week 0–6, valid special chars only, step divisors are positive integers
  - [x] 8.8. Implement `assemble(minute: String, hour: String, dom: String, month: String, dow: String): String` — concatenates with spaces, substitutes `*` for empty fields
  - Requirements: 15, 16, 17

- [x] 9. Enhance RuleEditorScreen with Cron Builder UI <!-- dep: 8 -->
  - [x] 9.1. In `RuleEditorViewModel`, add `cronDescription: StateFlow<String>` computed from `cronExpression` using `CronUtils.describe()`
  - [x] 9.2. Add `cronValidationError: StateFlow<String?>` computed from `cronExpression` using `CronUtils.validate()`
  - [x] 9.3. Add individual field states: `cronMinute`, `cronHour`, `cronDom`, `cronMonth`, `cronDow` as MutableStateFlows defaulting to `*`
  - [x] 9.4. Add `assembleCronFromFields()` that calls `CronUtils.assemble()` and updates `cronExpression`
  - [x] 9.5. In `RuleEditorScreen`, below the existing cron text field, add: a human-readable description text (or error text in red if invalid)
  - [x] 9.6. Add 5 individual OutlinedTextField inputs (Minute, Hour, Day of Month, Month, Day of Week) that update the field states and trigger assembly
  - [x] 9.7. Add preset buttons row: "Every hour" (`0 * * * *`), "Daily 9am" (`0 9 * * *`), "Weekdays 9am" (`0 9 * * 1-5`), "Monthly 1st" (`0 0 1 * *`)
  - [x] 9.8. Disable the Save button when `cronValidationError` is non-null and trigger type is "cron"
  - Requirements: 15, 16, 17

- [x] 10. Create QuickAlertSheet <!-- dep: none -->
  - [x] 10.1. Create `android/app/src/main/java/com/cwoc/app/ui/components/QuickAlertSheet.kt`
  - [x] 10.2. Implement as a ModalBottomSheet with type selector row: Reminder, Alarm, Timer, Stopwatch (as FilterChips)
  - [x] 10.3. Reminder editor: required title field (max 200 chars), date picker (default today), time picker (default 15 min from now)
  - [x] 10.4. Alarm editor: optional name field, time picker (default 1 min from now), day-of-week checkboxes (default current day)
  - [x] 10.5. Timer editor: optional name field, H:M:S numeric inputs (default 0:5:0), loop toggle
  - [x] 10.6. Stopwatch editor: optional name field, "Starts automatically" indicator text
  - [x] 10.7. Save button: for Reminder, create a chit via API with point_in_time and a notification alert; for Alarm/Timer/Stopwatch, create an independent alert via API
  - [x] 10.8. "Create & View" button: saves and navigates to Alarms tab
  - [x] 10.9. Validation: Reminder requires non-empty title; Timer requires duration > 0
  - [x] 10.10. Cancel/dismiss discards input without confirmation
  - [x] 10.11. In `MainScreen.kt` (or wherever the FAB is), add "Quick Alert" as an option in the FAB action menu that shows this sheet
  - Requirements: 18

- [x] 11. Add Combine Alerts Toggle to Settings <!-- dep: none -->
  - [x] 11.1. In the Settings screen's Visual Indicators section, add a "Combine Alerts" toggle (Switch composable)
  - [x] 11.2. Read initial value from `SettingsFormState.combineAlerts` (stored as "0" or "1")
  - [x] 11.3. On toggle change, update the form state and mark settings as dirty for sync
  - [x] 11.4. Verify that `ChitCardEnhancements` already reads this setting and conditionally shows single 🛎️ icon vs individual icons — if not, wire that logic
  - [x] 11.5. Verify the setting syncs to server on next sync cycle
  - Requirements: 19

- [x] 12. Verify TimePeriodDropdown Enabled Periods Filtering <!-- dep: none -->
  - [x] 12.1. Read `SidebarContent.kt` and verify that `TimePeriodDropdown` receives `enabledPeriods` from settings
  - [x] 12.2. Verify that `PeriodFilterUtil.filterEnabledPeriods()` correctly filters the period list
  - [x] 12.3. Verify that auto-switch logic works when the current selection is not in the enabled list
  - [x] 12.4. Verify that an empty/null `enabledPeriods` shows all periods as default
  - [x] 12.5. If any behavior is missing, fix it; otherwise mark as verified
  - Requirements: 20

## Notes

- Tasks 7 and 12 are verification-only — the code already exists and just needs confirmation that it works correctly.
- The recurring drag modal (Req 8) is already fully implemented in CalendarViewModel — no task needed.
- No external dependencies are added. All implementations use existing Kotlin stdlib, Jetpack Compose, and project utilities.
- No tests are included per project conventions (tests are optional).
