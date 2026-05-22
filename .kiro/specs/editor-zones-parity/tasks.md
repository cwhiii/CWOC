# Implementation Plan: Editor Zones Parity

## Overview

Implement full Android parity for Web Function Index items W73–W99: People zone expand modal, user-defined custom zones in the editor with typed input fields, health indicator enhancements (conditional display, metric units, range highlighting), and recurrence series info & actions (series summary, complete series, break off instance, auto-archive).

## Tasks

- [x] 1. People Zone Expand Modal
  - [x] 1.1 Extract PeopleZoneContent shared composable
    - In `ChitEditorScreen.kt`: extract the body content of the existing `PeopleZone` (people list, sharing controls, search input, stealth toggle, assigned-to picker) into a new `PeopleZoneContent` internal composable that accepts all the same parameters. Replace the inline `PeopleZone` body with a call to `PeopleZoneContent`. This enables reuse in both the inline zone and the expand modal.
    - _Requirements: 1.4_
  - [x] 1.2 Add expand button to PeopleZone header
    - In `ChitEditorScreen.kt`: add an `IconButton` with `Icons.Default.OpenInFull` to the `EditorZoneHeader` trailing content for the People zone. On tap, set a `showPeopleExpandModal` state to true in the composable scope.
    - _Requirements: 1.1_
  - [x] 1.3 Implement PeopleExpandModal composable
    - In `ChitEditorScreen.kt`: create a `PeopleExpandModal` composable that renders as a full-screen `Dialog(properties = DialogProperties(usePlatformDefaultWidth = false))`. Inside, render `PeopleZoneContent` with the same callbacks and state as the inline zone (same `formState` — no separate sync). Add a close button in the top bar. Support dismiss via close button, back gesture, and swipe down. Wrap content in a scrollable container for overflow.
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Custom Zones API and ViewModel State
  - [x] 2.1 Add CustomZoneResponse model and API endpoint
    - In `CwocApiService.kt`: add `data class CustomZoneResponse(val zone_id: String, val name: String, val sort_order: Int = 0, val object_count: Int = 0)` and `@GET("/api/custom-zones") suspend fun getCustomZones(): Response<List<CustomZoneResponse>>`. Verify that the existing `getCustomObjectsForZone(zoneId: String)` endpoint returns `List<IndicatorObject>` with all needed fields (`id`, `name`, `value_type`, `units`, `metric_units`, `range_min`, `range_max`, `conditional_display`, `type`, `sub_type`, `zone_sort_order`).
    - _Requirements: 2.1_
  - [x] 2.2 Add CustomZoneState and loadCustomZones to ChitEditorViewModel
    - In `ChitEditorViewModel.kt`: add `data class CustomZoneState(val zoneId: String, val name: String, val sortOrder: Int, val objects: List<IndicatorObject>)`. Add `private val _customZones = MutableStateFlow<List<CustomZoneState>>(emptyList())` and `val customZones: StateFlow<List<CustomZoneState>>`. Implement `loadCustomZones()`: fetch zones from API, for each zone fetch objects sorted by `zone_sort_order` (null as 0), skip zones whose object fetch fails, sort final list by `sortOrder`. On any top-level error, log and continue with empty list. Call `loadCustomZones()` from the init block after existing indicator loading.
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 3. Conditional Display and Unit Label Utilities
  - [x] 3.1 Implement evaluateConditionalDisplay utility function
    - In `ChitEditorScreen.kt` (or a new utility file if preferred): implement `evaluateConditionalDisplay(rule: Map<String, String>?, settings: SettingsEntity?): Boolean`. Returns true if rule is null/empty. Otherwise extracts `setting` and `equals` keys, looks up the setting value via a `getSettingValue(settings, key)` helper that maps known keys (e.g., "sex" → `settings.sex`, "unit_system" → `settings.unitSystem`). Returns true only on strict equality. Returns false if the setting key doesn't exist in settings.
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  - [x] 3.2 Implement resolveUnitLabel utility function
    - Implement `resolveUnitLabel(obj: IndicatorObject, settings: SettingsEntity?): String`. Returns empty string for boolean/string value_types. If `unitSystem == "metric"` and `metric_units` is non-null/non-blank, returns `metric_units`. Otherwise returns `units` (or empty string if null).
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.6_
  - [x] 3.3 Implement rangeHighlightColor utility function
    - Implement `rangeHighlightColor(value: String, rangeMin: Double?, rangeMax: Double?): Color?`. Returns null if both bounds are null, or if value is empty/non-numeric. Returns orange/red tint `Color(0xFFFFE0CC)` if value > rangeMax. Returns blue tint `Color(0xFFCCE5FF)` if value < rangeMin. Returns null if within bounds (inclusive). Handles one-sided ranges (only min or only max defined).
    - _Requirements: 7.1, 7.2, 7.3, 7.5, 7.6, 7.7, 7.8_

- [x] 4. Render Custom Zone Panels
  - [x] 4.1 Implement CustomZonePanel composable
    - In `ChitEditorScreen.kt`: create `CustomZonePanel` composable. Parameters: `zone: CustomZoneState`, `healthData: String?`, `settings: SettingsEntity?`, `onHealthDataChange: (String?) -> Unit`. Logic: (1) Filter objects by `evaluateConditionalDisplay`. (2) If no visible objects, return without rendering. (3) Group visible objects by `sub_type ?: type ?: "Other"`, sort groups alphabetically. (4) Within each group, sort by `zone_sort_order ?: 0` ascending. (5) Render as collapsible section with zone name header via `EditorZoneHeader`. Initially expanded if any object UUID has a stored value in healthData. (6) Render sub-groups as collapsible sub-sections.
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 5.5_
  - [x] 4.2 Implement typed input fields for custom objects
    - Within `CustomZonePanel`: render each object as the appropriate input type based on `value_type`: `OutlinedTextField` with `KeyboardType.Number` for integer, `OutlinedTextField` with `KeyboardType.Decimal` for decimal, `Checkbox` for boolean, `OutlinedTextField` with `KeyboardType.Text` for string. Display unit label via `resolveUnitLabel()`. Apply range highlighting via `rangeHighlightColor()` as background modifier on numeric fields. Update highlight in real-time as user types.
    - _Requirements: 3.2, 6.6, 7.4, 7.8_
  - [x] 4.3 Wire CustomZonePanels into ChitEditorScreen
    - In `ChitEditorScreen.kt`: collect `viewModel.customZones` state. For each zone in the list, render a `CustomZonePanel` passing the current `formState.healthData`, settings, and an `onHealthDataChange` callback that updates `formState`. Place custom zone panels after the existing health indicators zone, ordered by `sortOrder`.
    - _Requirements: 2.2, 3.1_

- [x] 5. Custom Zone Data Persistence
  - [x] 5.1 Implement health_data load and save logic for custom zones
    - In `ChitEditorViewModel.kt`: when loading a chit, parse `health_data` JSON into a `Map<String, Any?>` and populate custom zone field values by matching object UUIDs as keys. On save: merge custom zone field values (excluding null/empty-string) with indicator zone values into a single UUID-keyed JSON map. Ensure saving does not overwrite indicator zone entries that aren't being edited. Mark chit as unsaved (`isDirty = true`) when any custom zone field changes. On save failure, retain unsaved state and show error toast.
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 6. Health Indicators Zone Enhancements
  - [x] 6.1 Add conditional display filtering to HealthIndicatorsZone
    - In the existing `HealthIndicatorsZone` composable: before rendering each indicator object, call `evaluateConditionalDisplay(obj.conditional_display, settings)`. If it returns false, skip rendering that field entirely (no placeholder or empty space). This filters out indicators whose conditional_display rule doesn't match the user's settings.
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  - [x] 6.2 Add unit label display with metric support to HealthIndicatorsZone
    - In `HealthIndicatorsZone`: for each numeric indicator field (integer/decimal), display the resolved unit label from `resolveUnitLabel(obj, settings)` as a trailing label or suffix. Do not display unit labels for boolean or string fields. The label is display-only and does not transform stored values.
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  - [x] 6.3 Add range highlighting to HealthIndicatorsZone
    - In `HealthIndicatorsZone`: for each numeric field, apply `rangeHighlightColor(currentValue, obj.range_min, obj.range_max)` as a background tint on the input field. Update in real-time as the user types. No highlight for empty/non-numeric values or when both bounds are null.
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

- [x] 7. Checkpoint
  - Ensure all custom zones and health indicator enhancements compile and work together. Verify that custom zone panels render with correct input types, conditional display hides appropriate fields, unit labels switch based on settings, and range highlighting applies correctly. Ask the user if questions arise.

- [x] 8. Recurrence Series Info Computation
  - [x] 8.1 Add SeriesInfo data class and computeSeriesInfo to RecurrenceEngine
    - In `RecurrenceEngine.kt`: add `data class SeriesInfo(val instanceNumber: Int, val totalPast: Int, val completedPast: Int, val successRate: Int)`. Implement `computeSeriesInfo(rule: RecurrenceRule, startDate: LocalDate, exceptions: List<RecurrenceException>, targetDate: LocalDate = LocalDate.now()): SeriesInfo?`. Returns null if `rule.freq` is blank. Walks the recurrence rule from start date, advancing by freq/interval, counting instances up to today. Excludes dates with `broken_off=true` from instance count. Counts dates with `completed=true` as completedPast. Calculates `successRate = round((completedPast / totalPast) * 100)`, 0 when totalPast is 0. Limits iteration to 730 dates max.
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_
  - [x] 8.2 Wire computeSeriesInfo into ChitEditorViewModel
    - In `ChitEditorViewModel.kt`: add `val seriesInfo: StateFlow<SeriesInfo?>`. When a recurring chit is loaded (has `recurrenceRule`), compute series info using `RecurrenceEngine.computeSeriesInfo()` and expose via state flow. Also compute when opened in QuickEditSheet context.
    - _Requirements: 8.1_

- [x] 9. Series Summary UI
  - [x] 9.1 Add InstanceStatus enum and instance generation logic
    - In `RecurrenceEngine.kt` (or a new file): add `enum class InstanceStatus { COMPLETED, MISSED, BROKEN_OFF, UPCOMING }` and `data class SeriesInstanceDisplay(val date: LocalDate, val status: InstanceStatus)`. Implement `generateSeriesInstances(rule, startDate, exceptions): List<SeriesInstanceDisplay>` that generates instances from start date up to 30 days in the future, max 50 instances. Classify each: COMPLETED if date has exception with completed=true, BROKEN_OFF if broken_off=true, MISSED if date < today with no exception, UPCOMING if date >= today.
    - _Requirements: 9.1, 9.2, 9.3, 9.5_
  - [x] 9.2 Implement SeriesSummaryUI composable
    - Create `SeriesSummaryUI` composable (in `ChitEditorScreen.kt` or extracted to a zones file). Parameters: `rule: RecurrenceRule`, `startDate: LocalDate`, `exceptions: List<RecurrenceException>`. Renders a scrollable `LazyColumn` with each row showing: status emoji (✅ ❌ ✂️ ⬜), date formatted as "Mon, Jan 15", abbreviated day-of-week. Instances listed in chronological order (oldest first). Don't render if no start date or rule is missing.
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_
  - [x] 9.3 Wire SeriesSummaryUI into ChitEditor and QuickEditSheet
    - In `ChitEditorScreen.kt`: when the loaded chit has a `recurrenceRule`, render `SeriesSummaryUI` in the appropriate zone area. In `QuickEditSheet`: also render `SeriesSummaryUI` for recurring chits. Display series info stats (instance number, success rate) alongside the summary.
    - _Requirements: 9.1, 8.1_

- [x] 10. Complete Series Action
  - [x] 10.1 Implement completeSeries in ChitEditorViewModel
    - In `ChitEditorViewModel.kt`: add `fun completeSeries(chitId: String, onSuccess: () -> Unit, onError: (String) -> Unit)`. Sets parent chit's status to "Complete" and `completedDatetime` to current UTC ISO 8601 timestamp. Persists via Room upsert, marks dirty, triggers sync push if online. On failure: calls `onError` with message, leaves status unchanged.
    - _Requirements: 10.2, 10.3, 10.4_
  - [x] 10.2 Add Complete Series UI with confirmation dialog
    - In `ChitEditorScreen.kt` (or QuickEditSheet): add a "Complete Series" action button visible for recurring chits. On tap, show an `AlertDialog` confirmation prompt. On confirm, call `viewModel.completeSeries()`. On success, show success toast. On error, show error toast.
    - _Requirements: 10.1, 10.4_

- [x] 11. Break Off Instance Action
  - [x] 11.1 Implement breakOffInstance in ChitEditorViewModel
    - In `ChitEditorViewModel.kt`: add `fun breakOffInstance(parentChitId: String, instanceDate: String, instanceStart: String?, instanceEnd: String?, onSuccess: (newChitId: String) -> Unit, onError: (String) -> Unit)`. Algorithm: (1) Load parent from Room. (2) Generate new UUID. (3) Copy parent fields to new entity with instance-specific dates, set recurrence/recurrenceRule/recurrenceExceptions/recurrenceId to null. (4) Insert new entity. (5) Append `{"date": instanceDate, "broken_off": true}` to parent's recurrence_exceptions. (6) Update parent. (7) Mark both dirty, trigger sync. (8) Call `checkAutoArchive(parentChitId)`. (9) Return new chit ID via onSuccess. On failure at any step: roll back (delete new chit if inserted, restore parent exceptions), call onError. No orphaned standalone chit without corresponding parent exception.
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_
  - [x] 11.2 Add Break Off UI trigger
    - In `ChitEditorScreen.kt` or `QuickEditSheet`: for virtual recurring instances, add a "Break Off" action button. On tap, call `viewModel.breakOffInstance()` with the instance's date and start/end datetimes. On success, navigate to the new standalone chit in the editor. On error, show error toast and stay on current view.
    - _Requirements: 11.4, 11.5_

- [x] 12. Auto-Archive Recurring Chit
  - [x] 12.1 Implement shouldAutoArchive in RecurrenceEngine
    - In `RecurrenceEngine.kt`: add `fun shouldAutoArchive(rule: RecurrenceRule, startDate: LocalDate, exceptions: List<RecurrenceException>, isArchived: Boolean): Boolean`. Returns false if: already archived, no end date (rule.until is null), end date is in the future. Otherwise generates all instances from start to until (max 730 iterations), checks that every instance date has a corresponding exception with completed=true or broken_off=true. Returns true only if all are covered.
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_
  - [x] 12.2 Implement checkAutoArchive in ChitEditorViewModel
    - In `ChitEditorViewModel.kt`: add `private fun checkAutoArchive(chitId: String)`. Loads chit from Room, parses rule and exceptions, calls `shouldAutoArchive()`. If true: sets `archived = true` and `status = "Complete"`, upserts, marks dirty, triggers sync. Called after any completion or break-off action (from `completeSeries` and `breakOffInstance`). Failures are silently logged (non-critical background operation).
    - _Requirements: 12.1, 12.5_

- [x] 13. Final Checkpoint
  - Ensure all recurrence features compile and integrate correctly. Verify series info computation, series summary rendering, complete series action with confirmation, break-off with rollback safety, and auto-archive evaluation. Ask the user if questions arise.

## Notes

- The design reuses the existing `IndicatorObject` model for custom zone objects since it already contains all needed fields (`id`, `name`, `value_type`, `units`, `metric_units`, `range_min`, `range_max`, `conditional_display`, `type`, `sub_type`, `zone_sort_order`). No new model needed for zone members.
- Custom zones and health indicators share the same `health_data` JSON map on the chit — both use UUID keys. The save logic must merge without overwriting.
- The `PeopleExpandModal` operates on the same in-memory `formState` as the inline zone — no separate sync step. All callbacks are passed through directly.
- `RecurrenceEngine` already exists with date expansion logic. Tasks 8 and 12 add new functions to it (`computeSeriesInfo`, `shouldAutoArchive`).
- The break-off action must be transactional: if adding the exception to the parent fails after the new chit is created, the new chit must be deleted to prevent orphaned state.
- Range highlight colors: `Color(0xFFFFE0CC)` for high (orange/red tint), `Color(0xFFCCE5FF)` for low (blue tint). These match the web implementation.
- The `evaluateConditionalDisplay` function is used by both the Health Indicators Zone and Custom Zone Panels — implement once, call from both.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1", "3.1", "3.2", "3.3"] },
    { "id": 1, "tasks": ["1.2", "2.2", "8.1"] },
    { "id": 2, "tasks": ["1.3", "4.1", "4.2", "6.1", "6.2", "6.3", "8.2", "9.1"] },
    { "id": 3, "tasks": ["4.3", "5.1", "9.2", "12.1"] },
    { "id": 4, "tasks": ["9.3", "10.1", "11.1", "12.2"] },
    { "id": 5, "tasks": ["10.2", "11.2"] }
  ]
}
```
