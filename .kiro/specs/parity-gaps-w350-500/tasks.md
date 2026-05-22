# Implementation Plan: Parity Gaps W350–500

## Overview
Resolve five Android parity gaps: recurring event drag-to-reschedule in the calendar time grid (W368), enabled periods filtering in the time period dropdown (W395), inline markdown rendering in checklist items (W405), project child chit picker (W429), and create new child chit from project (W431). All changes are Android Kotlin/Jetpack Compose — no server changes required.

## Tasks

- [x] 1. Implement drag-to-reschedule domain utilities (W368)
  - [x] 1.1 Create DragRescheduleCalculator.kt with pure utility functions
    - Create `android/app/src/main/java/com/cwoc/app/domain/calendar/DragRescheduleCalculator.kt`
    - Implement `snapToGrid(rawMinutes: Int, snapInterval: Int): Int` — rounds to nearest multiple of snapInterval
    - Implement `clampToValidRange(minutes: Int, eventDurationMinutes: Int, dayStartMinute: Int, dayEndMinute: Int): Int` — clamps to [dayStart, dayEnd - duration]
    - Implement `computeTimeDelta(sourceMinute: Int, targetMinute: Int): Long` — returns delta in minutes
    - Implement `shiftDateTimes(start: String?, end: String?, due: String?, pit: String?, deltaMinutes: Long): ShiftedDateTimes` — shifts all datetime fields by delta, preserving nulls
    - Implement `updateByDayForWeekly(recurrenceRule: String, sourceDate: LocalDate, targetDate: LocalDate): String` — replaces source day abbreviation with target day in byDay list for WEEKLY rules
    - Define `data class ShiftedDateTimes(val start: String?, val end: String?, val due: String?, val pointInTime: String?)`
    - _Requirements: 1.1, 1.4, 1.8, 1.9_
  - [x] 1.2 Update CalendarTimeGrid.kt for long-press drag gesture
    - Change `DayEventCard` from `detectDragGestures` to `detectDragGesturesAfterLongPress` (300ms threshold)
    - During drag: reduce dragged event opacity to 0.6, display at target snap position in real time
    - On drag end: if event moved at least 1 pixel from origin, emit drag context to ViewModel; otherwise treat as no-op
    - Use `DragRescheduleCalculator.snapToGrid()` for snap positioning and `clampToValidRange()` for boundary enforcement
    - Short taps still open the event (not hijacked by drag)
    - _Requirements: 1.1, 1.7, 1.9_
  - [x] 1.3 Add time-grid drag handling to CalendarViewModel
    - Add `handleTimeGridDrag(chitId: String, sourceMinute: Int, targetMinute: Int, date: LocalDate)` function
    - Detect recurring vs non-recurring: if non-recurring, directly shift start/end/due/pit using `DragRescheduleCalculator.shiftDateTimes()` and persist
    - If recurring, set `pendingRecurringDragContext` with sourceMinute, targetMinute, deltaMinutes and show RecurringEditDialog
    - Extend existing `RecurringDragContext` data class with `sourceMinute: Int?`, `targetMinute: Int?`, `deltaMinutes: Long?` fields
    - _Requirements: 1.2, 1.8_
  - [x] 1.4 Implement recurring scope handlers for time-grid drag
    - "This instance only": create standalone copy with `recurrenceRule = null`, datetimes shifted by delta, add `broken_off` exception keyed by original instance date to parent's recurrenceExceptions
    - "All in series": shift parent chit's start/end/due/pit by deltaMinutes using `shiftDateTimes()`; if WEEKLY with byDay and day changed, call `updateByDayForWeekly()`
    - "All following": split recurrence at dragged instance — parent gets `until` cutoff before source date, new chit created from source date onward with shifted datetimes and same recurrence rule (byDay updated if day changed)
    - "Cancel": clear `pendingRecurringDragContext`, re-render calendar with no data changes
    - Reuse existing `handleRecurringThisInstanceOnly`, `handleRecurringAllEvents`, `handleRecurringThisAndFollowing` with time-based deltas
    - _Requirements: 1.3, 1.4, 1.5, 1.6_

- [x] 2. Checkpoint — Ensure W368 drag-to-reschedule compiles and integrates correctly
  - Ensure all code compiles, ask the user if questions arise.

- [x] 3. Implement enabled periods filtering (W395)
  - [x] 3.1 Create PeriodFilterUtil.kt with pure filtering functions
    - Create `android/app/src/main/java/com/cwoc/app/domain/settings/PeriodFilterUtil.kt`
    - Implement `filterEnabledPeriods(allPeriods: List<String>, enabledPeriodsRaw: String?): List<String>` — parses comma-separated string, returns intersection with valid periods in display order (Itinerary, Day, Work, Week, SevenDay, Month, Year), falls back to `["Day"]` if null/empty/invalid
    - Implement `resolveSelectedPeriod(currentSelection: String, enabledPeriods: List<String>, displayOrder: List<String>): String` — if current selection not in enabled list, returns first enabled period in display order
    - Implement `formatPeriodLabel(periodId: String, customDaysCount: Int): String` — returns "X Days" for SevenDay (using customDaysCount), standard labels for others
    - _Requirements: 2.1, 2.3, 2.4, 2.5_
  - [x] 3.2 Update SidebarContent.kt TimePeriodDropdown to filter periods
    - Add `enabledPeriods: String?` and `customDaysCount: Int` parameters to `TimePeriodDropdown`
    - Filter displayed options using `PeriodFilterUtil.filterEnabledPeriods()` before rendering
    - Format "SevenDay" label using `PeriodFilterUtil.formatPeriodLabel()` with customDaysCount
    - If currently selected period is not in filtered list, auto-switch using `PeriodFilterUtil.resolveSelectedPeriod()`
    - Read enabledPeriods reactively from SettingsEntity (via StateFlow/collectAsState) so changes reflect without restart
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 4. Implement inline markdown rendering in checklist items (W405)
  - [x] 4.1 Create InlineMarkdownRenderer.kt
    - Create `android/app/src/main/java/com/cwoc/app/ui/util/InlineMarkdownRenderer.kt`
    - Implement `render(text: String): AnnotatedString` — pure function parsing inline markdown
    - Support: bold (`**text**`) → `SpanStyle(fontWeight = Bold)`, italic (`*text*`) → `SpanStyle(fontStyle = Italic)`, inline code (`` `code` ``) → `SpanStyle(fontFamily = Monospace)`, links (`[text](url)`) → URL annotation + `SpanStyle(color = linkColor, textDecoration = Underline)`
    - Support nested combinations (e.g., bold inside a link, italic inside bold)
    - Strip GFM checkbox prefixes (`- [x] `, `- [ ] `) from output
    - Preserve line breaks in multi-line input
    - Block-level syntax (headings, blockquotes, horizontal rules, bullet lists) displayed as literal text
    - Malformed/unclosed syntax displayed as raw text (graceful degradation)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.6, 3.7, 3.8_
  - [x] 4.2 Update ChecklistZoneV2.kt to use InlineMarkdownRenderer
    - Replace `Text(text = item.text, ...)` in display mode with `ClickableText(text = InlineMarkdownRenderer.render(item.text), ...)`
    - Handle URL click via `onClick` offset lookup — find URL annotation at tap position, open in device browser
    - Keep raw markdown text in editing mode (no rendering while editing)
    - _Requirements: 3.1, 3.2, 3.5_
  - [x] 4.3 Update ChecklistsScreen.kt to use InlineMarkdownRenderer
    - Replace plain Text with ClickableText + InlineMarkdownRenderer.render() for checklist item text in the dashboard Checklists view
    - Handle URL taps same as in ChecklistZoneV2
    - _Requirements: 3.5_
  - [x] 4.4 Update OmniViewScreen.kt checklist section to use InlineMarkdownRenderer
    - Replace plain Text with ClickableText + InlineMarkdownRenderer.render() for checklist items in the Omni view
    - Handle URL taps
    - _Requirements: 3.5_
  - [x] 4.5 Update NotebookScreen.kt to use InlineMarkdownRenderer (if checklist items appear)
    - Check if checklist items are rendered in NotebookScreen; if so, apply same ClickableText + InlineMarkdownRenderer pattern
    - Handle URL taps
    - _Requirements: 3.5_

- [x] 5. Checkpoint — Ensure W395 and W405 compile and integrate correctly
  - Ensure all code compiles, ask the user if questions arise.

- [x] 6. Implement project child chit picker (W429)
  - [x] 6.1 Create ChitPickerFilter.kt with pure filtering/search functions
    - Create `android/app/src/main/java/com/cwoc/app/domain/picker/ChitPickerFilter.kt`
    - Implement `filterChits(allChits: List<ChitEntity>, excludeIds: Set<String>, excludeProjectMasters: Boolean, excludeEmails: Boolean): List<ChitEntity>` — excludes project masters, current chit, and optionally emails; sorts alphabetically by title
    - Implement `searchChits(chits: List<ChitEntity>, query: String): List<ChitEntity>` — case-insensitive substring match against title, notes, checklist text, people, location, priority, severity, status, tags; `#` prefix triggers tag-only search
    - Implement `applyStatusFilter(chits: List<ChitEntity>, status: String?): List<ChitEntity>` — filters by status (null = All)
    - Implement `applyPriorityFilter(chits: List<ChitEntity>, priority: String?): List<ChitEntity>` — filters by priority (null = All)
    - _Requirements: 4.1, 4.2, 4.3_
  - [x] 6.2 Create ChitPickerSheet.kt composable
    - Create `android/app/src/main/java/com/cwoc/app/ui/components/ChitPickerSheet.kt`
    - ModalBottomSheet with header showing count ("Add Child Chits (N shown)")
    - Search text field with clear action (two-step dismiss: clear search first, then close)
    - Filter row: Status dropdown (All, ToDo, In Progress, Blocked, Complete), Priority dropdown (All, Low, Medium, High, Critical), Email toggle
    - LazyColumn of chit rows: checkbox + title + user tags as small badges + due date (YYYY-MM-DD) + status
    - Already-assigned rows shown dimmed with checkmark indicator, non-selectable
    - Bottom bar: selection count + "Add Selected" button (disabled when count = 0)
    - Empty state message when no chits match filters
    - Error handling: show error toast and close sheet if data fails to load
    - Multi-select via `Set<String>` of selected IDs in local state
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 4.11_
  - [x] 6.3 Add picker support to ChitEditorViewModel and wire in ChitEditorScreen
    - Add `loadPickerChits()` to ChitEditorViewModel — loads all non-deleted chits from ChitRepository
    - Add `addChildChits(selectedIds: List<String>)` — adds IDs to current chit's `child_chits` list (no duplicates), refreshes child summaries
    - Wire `onPickChit` callback in ChitEditorScreen's ProjectsZone to show ChitPickerSheet
    - Pass current project's existing child_chits to ChitPickerSheet for dimming already-assigned rows
    - _Requirements: 4.5, 4.6, 4.7_

- [x] 7. Implement create new child chit from project (W431)
  - [x] 7.1 Add createChildChit to ChitEditorViewModel
    - Implement `createChildChit(title: String)`: trim title, validate non-empty and ≤ 200 chars, create new ChitEntity with UUID + title + status "ToDo" + timestamps, persist via `chitRepository.upsertAndSync()`, add new ID to current chit's `child_chits`, refresh child summaries, return success/failure
    - On failure: return error result (caller shows error toast, child_chits unchanged)
    - _Requirements: 5.2, 5.3, 5.4, 5.6, 5.8_
  - [x] 7.2 Wire create-new-child UI in ChitEditorScreen
    - Add "Create New" button in ProjectsZone
    - On tap: show AlertDialog with OutlinedTextField for title, Cancel and Create buttons
    - On confirm with non-empty trimmed title: call `viewModel.createChildChit(title)`, show success toast ("Created 'Title' and added to project.")
    - On confirm with empty/whitespace title: keep dialog open, do not create
    - On cancel: dismiss dialog, no action
    - On failure: show error toast with failure reason
    - _Requirements: 5.1, 5.2, 5.5, 5.6, 5.7, 5.8_

- [x] 8. Final checkpoint — Ensure all W350–500 changes compile and integrate correctly
  - Ensure all code compiles, ask the user if questions arise.

## Notes
- All tasks are Android-only (Kotlin/Jetpack Compose). No server changes required.
- No new Room entities or migrations needed — all data flows through existing ChitEntity and SettingsEntity.
- No software installation required — pure Kotlin/Compose implementation.
- No tests required per project rules.
- The RecurringEditDialog already exists with the four scope options — no changes needed there.
- The snap grid overlay already exists and is triggered by `isAnyEventDragging` — no changes needed for the overlay.
- DragRescheduleCalculator extracts existing inline snap logic into a testable utility.
- InlineMarkdownRenderer is separate from the existing MarkdownRenderer because checklist items need inline-only parsing, GFM checkbox stripping, and URL annotations.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "3.1", "4.1", "6.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "3.2", "4.2", "4.3", "4.4", "4.5", "6.2", "7.1"] },
    { "id": 2, "tasks": ["1.4", "6.3", "7.2"] }
  ]
}
```
