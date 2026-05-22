# Design Document

## Components and Interfaces

### New Components
- **CronUtils** (`domain/rules/CronUtils.kt`) — Pure utility class with `describe()`, `validate()`, and `assemble()` static methods for cron expression handling.
- **QuickAlertSheet** (`ui/components/QuickAlertSheet.kt`) — ModalBottomSheet composable for quick alert creation from any screen.
- **RecurrenceDeleteSheet** (`ui/components/RecurrenceDeleteSheet.kt`) — ModalBottomSheet composable for recurrence-aware delete options.
- **RecurrenceActionSheet** (`ui/components/RecurrenceActionSheet.kt`) — ModalBottomSheet composable for recurring chit series actions.

### Modified Interfaces
- **ChitEditorViewModel** — New methods: `completeSeries()`, `breakOffInstance(dateStr)`, `checkAutoArchive(chitId)`, `createNewChildChit(title)`. New state: `seriesInfo`, `instanceBannerText`.
- **CalendarViewModel** — New state: `allDayExpanded`. New method: `toggleAllDayExpanded()`.
- **RuleEditorViewModel** — New state: `cronDescription`, `cronValidationError`, `cronMinute`, `cronHour`, `cronDom`, `cronMonth`, `cronDow`. New method: `assembleCronFromFields()`.

## Data Models

### CronValidationResult
```kotlin
data class CronValidationResult(
    val isValid: Boolean,
    val errors: List<CronFieldError>
)

data class CronFieldError(
    val field: String,  // "minute", "hour", "dayOfMonth", "month", "dayOfWeek"
    val message: String
)
```

### Existing Models (No Changes)
- `RecurrenceRule`, `RecurrenceException`, `SeriesInfo`, `SeriesInstanceDisplay`, `InstanceStatus` — all already defined in `RecurrenceEngine.kt`
- `ChitEntity` — already has all required fields (recurrenceRule, recurrenceExceptions, perpetual, alerts, etc.)
- `SettingsEntity` — already has `combineAlerts`, `enabledPeriods`, `defaultNotifications`, `customDaysCount`

## Overview

This design covers the implementation of 26 missing/partial web functions for Android parity, grouped into 11 feature areas: recurrence series management, calendar view enhancements, scheduling utilities, and miscellaneous editor/settings gaps.

The existing Android infrastructure already provides strong foundations: `RecurrenceEngine` with `computeSeriesInfo()`, `generateSeriesInstances()`, and `shouldAutoArchive()`; `CalendarViewModel` with `RecurringDragContext` and `handleRecurringDragOption()`; `ChitEditorViewModel` with default notification application; `DateZone` with perpetual mode support; `QuickEditSheet` with series summary and action buttons; `TimePeriodDropdown` with `PeriodFilterUtil`; and `ChitPickerSheet`/`ProjectChitPickerSheet`.

Many of these features are partially implemented — the data models and some UI exist but callbacks aren't wired, settings are stored but not applied, or actions are available but missing recurrence-aware variants.

## Architecture

### Component Interaction Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         UI Layer (Compose)                           │
├─────────────────────────────────────────────────────────────────────┤
│ ChitEditorScreen                                                     │
│   ├── InstanceBanner (Req 6)                                        │
│   ├── DateZone (Req 13 - Perpetual, Req 14 - Default Notifs)       │
│   ├── AlertsZone (Req 14 - auto-expand)                            │
│   ├── ProjectsZone (Req 21, 22 - wire callbacks)                   │
│   └── RecurrenceActionButton → RecurrenceActionSheet (Req 9)        │
│                                                                      │
│ CalendarScreen                                                       │
│   ├── AllDaySection (Req 11 - height cap)                           │
│   ├── XDayView (Req 12 - configurable days)                        │
│   └── RecurringDragModal (Req 8 - already implemented)              │
│                                                                      │
│ QuickEditSheet (Req 2, 3, 4, 9 - series summary + actions)         │
│ RecurrenceDeleteSheet (Req 10 - recurrence-aware delete)            │
│ QuickAlertSheet (Req 18 - new bottom sheet)                         │
│                                                                      │
│ SettingsScreen                                                       │
│   └── Visual Indicators section (Req 19 - Combine Alerts toggle)    │
│                                                                      │
│ RuleEditorScreen (Req 15, 16, 17 - cron builder/validator)          │
│ SidebarContent → TimePeriodDropdown (Req 20 - already implemented)  │
├─────────────────────────────────────────────────────────────────────┤
│                       ViewModel Layer                                 │
├─────────────────────────────────────────────────────────────────────┤
│ ChitEditorViewModel                                                  │
│   ├── seriesInfo: StateFlow<SeriesInfo?>                            │
│   ├── instanceBannerText: StateFlow<String?>                        │
│   ├── onDateModeChanged() (Req 14 - default notifs)                 │
│   ├── breakOffInstance() (Req 4)                                    │
│   ├── completeSeries() (Req 3)                                     │
│   ├── pickChildChit() / createNewChild() (Req 21, 22)              │
│   └── checkAutoArchive() (Req 5)                                   │
│                                                                      │
│ CalendarViewModel                                                    │
│   ├── allDayExpanded: StateFlow<Boolean> (Req 11)                   │
│   ├── xDayCount / weekViewDayOffset (Req 12 - already exists)      │
│   └── handleRecurringDragOption() (Req 8 - already implemented)     │
│                                                                      │
│ RuleEditorViewModel                                                  │
│   ├── cronDescription: StateFlow<String> (Req 15)                   │
│   ├── cronValidationError: StateFlow<String?> (Req 17)              │
│   └── assembleCron() (Req 16)                                       │
│                                                                      │
│ SettingsViewModel (Req 19 - combineAlerts toggle)                   │
├─────────────────────────────────────────────────────────────────────┤
│                       Domain Layer                                    │
├─────────────────────────────────────────────────────────────────────┤
│ RecurrenceEngine (already has computeSeriesInfo,                     │
│   generateSeriesInstances, shouldAutoArchive, expand, formatRule)    │
│                                                                      │
│ CronUtils (NEW - Req 15, 16, 17)                                    │
│   ├── describe(expr): String                                        │
│   ├── validate(expr): CronValidationResult                          │
│   └── assemble(min, hr, dom, mon, dow): String                      │
├─────────────────────────────────────────────────────────────────────┤
│                       Data Layer                                      │
├─────────────────────────────────────────────────────────────────────┤
│ ChitRepository                                                       │
│   ├── upsertAndSync() (used for break-off, complete series)         │
│   ├── archive() (used for auto-archive)                             │
│   └── softDelete() (used for delete-entire-series)                  │
│                                                                      │
│ SettingsRepository (reads combine_alerts, enabled_periods, etc.)     │
│ ChitDao (getById, upsert, getAllNonDeletedSnapshot)                  │
└─────────────────────────────────────────────────────────────────────┘
```

## Design Details

### Feature Group A: Recurrence Series Actions (Requirements 1–9)

**What already exists:**
- `RecurrenceEngine.computeSeriesInfo()` — computes instance number, total past, completed, success rate
- `RecurrenceEngine.generateSeriesInstances()` — generates `SeriesInstanceDisplay` list for summary UI
- `RecurrenceEngine.shouldAutoArchive()` — evaluates whether all instances are covered
- `QuickEditSheet` — already renders series summary and has "Complete Series" / "Break Off" buttons
- `CalendarViewModel.handleRecurringDragOption()` — handles THIS_INSTANCE_ONLY, ALL_EVENTS, THIS_AND_FOLLOWING for drag operations
- `RecurringEditDialog` — existing scope selection dialog
- `ChitEditorViewModel` — has formState with recurrenceRule/recurrenceExceptions

**What needs to be wired/added:**

1. **Instance Banner (Req 6):** Add a composable banner at the top of `ChitEditorScreen` that reads `seriesInfo` from the ViewModel. The ViewModel computes this on load when the chit has a recurrence rule. Display "Instance X of Y" or "Instance X" (infinite).

2. **Complete Series (Req 3):** The `QuickEditSheet` already has the button. Wire `onCompleteSeries` callback in the calling screen to call `ChitEditorViewModel.completeSeries()` which sets status="Complete", completedDatetime=now, then calls `checkAutoArchive()`.

3. **Break Off Instance (Req 4):** The `QuickEditSheet` already has the button. Wire `onBreakOffInstance` to call a new `ChitEditorViewModel.breakOffInstance(dateStr)` method that: creates a standalone copy via API, adds broken_off exception to parent, navigates to new chit editor.

4. **Auto-Archive (Req 5):** After any complete-series or break-off action, call `RecurrenceEngine.shouldAutoArchive()`. If true, call `ChitRepository.archive()`.

5. **Recurrence Action Modal (Req 9):** Create a `RecurrenceActionSheet` composable (ModalBottomSheet) with three buttons. Accessible from QuickEditSheet (already has buttons) and from the instance banner in the editor.

6. **Recurrence-Aware Delete (Req 10):** Create a `RecurrenceDeleteSheet` composable shown when deleting a recurring instance. Three options: delete-this (add broken_off exception), delete-following (set until date), delete-all (soft-delete parent with confirmation).

7. **Save Instance Exception (Req 7):** The `RecurringEditDialog` already offers "This instance only." Wire the save flow in `ChitEditorViewModel` to store modifications as a recurrence exception when this option is selected.

8. **Recurring Drag Modal (Req 8):** Already fully implemented in `CalendarViewModel`. No additional work needed.

### Feature Group B: Calendar View Enhancements (Requirements 11–12)

**What already exists:**
- `CalendarViewModel` has `CalendarViewMode.X_DAY` with `xDayCount` state
- `CalendarUiState` has `xDayCount: Int = 7`
- Navigation (previousPeriod/nextPeriod) already handles X_DAY mode
- `weekViewDayOffset` StateFlow exists

**What needs to be added:**

1. **All-Day Height Cap (Req 11):** In the calendar week/day view composables, add state `allDayExpanded: Boolean` (default false). When collapsed, show max 3 all-day event rows with a "+N more" toggle. When expanded, show all. Reset to collapsed on date navigation.

2. **X-Day View UI (Req 12):** The ViewModel logic exists. Add a UI control (dropdown or stepper) in the calendar header/settings to let users select 1–7 days. The `customDaysCount` setting from `SettingsEntity` should be the default value.

### Feature Group C: Editor Enhancements (Requirements 13–14)

**What already exists:**
- `DateZone` already has `DateMode.PERPETUAL` in the enum
- `DateZone` already handles perpetual mode activation (sets start date, clears end date)
- `DateZone` already has `applyDefaultNotifications()` function
- `ChitEditorViewModel` has `defaultNotifsAppliedStart`/`defaultNotifsAppliedDue` tracking
- `AlertsZone` has `forceExpanded` prop for auto-expansion

**What needs to be verified/fixed:**

1. **Perpetual Mode (Req 13):** Already implemented in DateZone. Verify: perpetual radio option shows when habit is active, "Since [date]" format displays correctly, deactivation clears flag. The code already handles all of this — mark as complete after verification.

2. **Default Notifications (Req 14):** Already implemented via `applyDefaultNotifications()` in DateZone and `onDateModeChanged` callback. Verify: defaults apply only on first activation, AlertsZone expands, tracking prevents re-application. The code already handles this — mark as complete after verification.

### Feature Group D: Cron Expression Functions (Requirements 15–17)

**What already exists:**
- `RuleEditorScreen` has a cron expression text field
- `RuleEditorViewModel` has `cronExpression` state

**What needs to be added:**

1. **CronUtils class** (new file: `com.cwoc.app.domain.rules.CronUtils`):
   - `describe(expr: String, timeFormat: String): String` — converts cron to human-readable
   - `validate(expr: String): CronValidationResult` — returns field-specific errors
   - `assemble(minute: String, hour: String, dom: String, month: String, dow: String): String`

2. **RuleEditorScreen enhancements:**
   - Below the cron text field, show the human-readable description (live-updating)
   - Add 5 individual field inputs (minute, hour, day-of-month, month, day-of-week) that assemble into the expression
   - Show validation errors inline per field
   - Add preset buttons (Every hour, Daily at 9am, Weekdays at 9am, etc.)

3. **RuleEditorViewModel additions:**
   - `cronDescription: StateFlow<String>` — computed from cronExpression
   - `cronValidationError: StateFlow<String?>` — computed from cronExpression
   - Individual field states for the assembler UI

### Feature Group E: Quick Alert Modal (Requirement 18)

**What already exists:**
- `AlertsZone` has the full alert creation form (all 4 types)
- Independent alerts are created via API
- FAB exists on the main screen

**What needs to be added:**

1. **QuickAlertSheet composable** (new file: `com.cwoc.app.ui.components.QuickAlertSheet`):
   - ModalBottomSheet with type selector (Reminder, Alarm, Timer, Stopwatch)
   - Minimal per-type editor (reuse patterns from AlertsZone's AddAlertForm)
   - Save creates either a chit (reminder) or independent alert (alarm/timer/stopwatch)
   - "Create & View" option navigates to Alarms tab
   - Accessible from FAB menu or a dedicated button

2. **Integration:** Add "Quick Alert" option to the FAB's action menu in `MainScreen`.

### Feature Group F: Settings & Sidebar (Requirements 19–20)

**What already exists:**
- `TimePeriodDropdown` already uses `PeriodFilterUtil.filterEnabledPeriods()` and auto-switches
- `SettingsEntity` has `combineAlerts` field
- `SettingsViewModel` has `combineAlerts` in form state
- `ChitCardEnhancements` reads visual indicator settings

**What needs to be verified/added:**

1. **Enabled Periods (Req 20):** Already implemented via `PeriodFilterUtil`. The `TimePeriodDropdown` already filters based on `enabledPeriods` setting. Mark as complete after verification.

2. **Combine Alerts Toggle (Req 19):** Add a toggle in the Settings screen's Visual Indicators section. Wire it to update `combineAlerts` in the form state and sync to server. The setting is already stored and read by card rendering — just needs the UI toggle.

### Feature Group G: Project Child Chit Actions (Requirements 21–22)

**What already exists:**
- `ProjectsZone` has `onPickChit` and `onCreateNewChild` callback parameters
- `ProjectChitPickerSheet` composable is fully implemented
- `ChitEditorScreen` renders ProjectsZone with these callbacks

**What needs to be wired:**

1. **Pick Chit (Req 21):** In `ChitEditorScreen`, wire `onPickChit` to show `ProjectChitPickerSheet`. On selection, update `childChits` in form state.

2. **Create New Child (Req 22):** In `ChitEditorScreen`, wire `onCreateNewChild` to show a title prompt, create a new chit via API with parent project ID, add to `childChits`, and navigate to the new chit's editor.

## File Changes Summary

### New Files
| File | Purpose |
|------|---------|
| `domain/rules/CronUtils.kt` | Cron describe/validate/assemble utility |
| `ui/components/QuickAlertSheet.kt` | Quick alert creation bottom sheet |
| `ui/components/RecurrenceDeleteSheet.kt` | Recurrence-aware delete options sheet |
| `ui/components/RecurrenceActionSheet.kt` | Recurrence series actions bottom sheet |

### Modified Files
| File | Changes |
|------|---------|
| `ui/screens/editor/ChitEditorScreen.kt` | Add instance banner, wire ProjectsZone callbacks, wire recurrence action button |
| `ui/screens/editor/ChitEditorViewModel.kt` | Add completeSeries(), breakOffInstance(), checkAutoArchive(), createNewChildChit() |
| `ui/screens/calendar/CalendarScreen.kt` | Add all-day height cap with show-more toggle |
| `ui/screens/calendar/CalendarViewModel.kt` | Add allDayExpanded state, toggle function |
| `ui/screens/rules/RuleEditorScreen.kt` | Add cron builder UI, description display, validation errors, presets |
| `ui/screens/rules/RuleEditorViewModel.kt` | Add cronDescription, cronValidationError, field states, assembleCron() |
| `ui/screens/settings/SettingsScreen.kt` | Add Combine Alerts toggle in Visual Indicators section |
| `ui/components/QuickEditSheet.kt` | Verify series actions are properly wired (may already be complete) |
| `ui/navigation/MainScreen.kt` | Add Quick Alert option to FAB menu |

### No Changes Needed (Already Implemented)
| File | Feature |
|------|---------|
| `domain/recurrence/RecurrenceEngine.kt` | Series info, series summary, auto-archive logic |
| `ui/screens/editor/zones/DateZone.kt` | Perpetual mode, default notifications |
| `ui/navigation/SidebarContent.kt` | TimePeriodDropdown with enabled_periods filtering |
| `ui/components/ChitPickerSheet.kt` | ProjectChitPickerSheet with full filtering |
| `ui/components/RecurringEditDialog.kt` | Scope selection for recurring edits |

## Implementation Priority

1. **Wire existing code** (Req 13, 14, 20, 21, 22) — These are mostly callback wiring and verification. Lowest effort, immediate parity gains.
2. **Recurrence actions** (Req 3, 4, 5, 6, 9, 10) — Core recurrence management. Medium effort, high value.
3. **Calendar enhancements** (Req 11, 12) — UI-only changes in calendar composables.
4. **Cron utilities** (Req 15, 16, 17) — New domain class + UI enhancements to RuleEditorScreen.
5. **Quick Alert** (Req 18) — New bottom sheet composable + FAB integration.
6. **Settings toggle** (Req 19) — Single toggle addition.
