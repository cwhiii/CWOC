# Implementation Plan: Calendar Drag, Prerequisites, Send-Content/Send-Item Parity

## Overview

Implement full Android parity for Web Function Index items 27–62: month view drag-to-reschedule, all-day drag, snap grid time labels, prerequisites zone rewrite (rich display, chit picker, inline status, auto-block), send-content modal (copy/move notes/checklist), and send-item popup (quick recent chits, copy mode, spawn new chit).

## Tasks

- [x] 1. Add month view drag-to-reschedule
  - [x] 1.1 Add drag gesture to month event chips
    - Modify `CalendarMonthView.kt`: wrap each month event chip in a composable that uses `detectDragGesturesAfterLongPress`. On drag start: set opacity 0.4, notify parent. On drag move: parent calculates target day cell from finger position (divide Y by row height for week, X by cell width for column). On drag end: compute target `LocalDate`, call new `onMonthEventDragEnd(chitId: String, sourceDate: LocalDate, targetDate: LocalDate)` callback. Block drag for viewer-role chits (check `shares` contains `"role":"viewer"`) and birthday events (check `tags` contains `Birthday`).
    - _Requirements: 1_
  - [x] 1.2 Add handleMonthDrag to CalendarViewModel
    - In `CalendarViewModel.kt`: add `handleMonthDrag(chitId, sourceDate, targetDate)` — if chit has `recurrenceRule != null`, set `showRecurringDragDialog` state; otherwise call `chitRepository.updateDateTimes()` with shifted dates (preserve time-of-day, shift by day diff). Add `RecurringDragContext` data class and `showRecurringDragDialog: MutableStateFlow<RecurringDragContext?>`.
    - _Requirements: 1_
  - [x] 1.3 Wire recurring dialog in CalendarScreen
    - In `CalendarScreen.kt`: observe `showRecurringDragDialog` and show `RecurringEditDialog` when non-null. Handle each option: THIS_INSTANCE_ONLY (add exception via API + create standalone copy), ALL_EVENTS (shift parent dates), THIS_AND_FOLLOWING (split recurrence), CANCEL (dismiss). Wire `onMonthEventDragEnd` callback to `CalendarViewModel.handleMonthDrag()`.
    - _Requirements: 1_

- [x] 2. Add all-day event drag between days
  - [x] 2.1 Add drag gesture to all-day event chips
    - Modify `CalendarTimeGrid.kt`: in the all-day events section, wrap each all-day event chip with `detectDragGesturesAfterLongPress`. Track `dragOffsetX` only (horizontal). On drag end: compute `dayDelta = (dragOffsetX / columnWidthPx).roundToInt()`, determine target day index, call `onAllDayDragEnd(chitId, targetDate)`. Block drag for viewer-role and birthday events.
    - _Requirements: 2_
  - [x] 2.2 Wire all-day drag callback to ViewModel
    - Wire callback through `CalendarScreen.kt` to `CalendarViewModel.handleAllDayDrag()` — same logic as month drag (check recurring, shift dates by day diff). Reuse the same `RecurringDragContext` and dialog flow from Task 1.
    - _Requirements: 2_

- [x] 3. Add snap grid time labels during drag
  - [x] 3.1 Add time labels to snap grid Canvas
    - Modify `CalendarTimeGrid.kt`: in the existing Canvas that draws snap lines when `isAnyEventDragging`, add time label text. Use `drawIntoCanvas { canvas -> canvas.nativeCanvas.drawText(...) }` to render labels at each hour mark (or at each snap interval if `snapMinutes >= 30`). Label format: respect `timeFormat` setting (12h vs 24h). Label style: font size ~9sp, color `Color(0x598B5A2B)`. Line color: `Color(0x268B5A2B)`. Only show grid when `snapMinutes > 1`.
    - _Requirements: 3_

- [x] 4. Rewrite PrerequisitesZone with rich display and chit picker
  - [x] 4.1 Add prereq state to ChitEditorViewModel
    - In `ChitEditorViewModel.kt`: add `val prereqChitCache: MutableStateFlow<Map<String, ChitEntity>>` and `fun loadPrereqChitData(ids: List<String>)` that calls `chitDao.getChitsByIds(ids)`. Add `val prereqAutoBlocked = MutableStateFlow(false)`.
    - _Requirements: 4_
  - [x] 4.2 Rewrite PrerequisitesZone composable
    - In `ChitEditorScreen.kt`: replace InputChips with a `Column` of `PrerequisiteItem` composables. Each `PrerequisiteItem`: full-width row with background = chit color (or `Color(0xFFE8DCC8)` default), text color computed via luminance formula `(0.299*R + 0.587*G + 0.114*B)/255 > 0.55 → dark else light`, shows title (or "(deleted)"), inline status dropdown (`ExposedDropdownMenuBox` with options: —, ToDo, In Progress, Blocked, Complete), and remove IconButton. "Add Prerequisite" button opens enhanced `ChitPickerSheet`. On load: call `loadPrereqChitData()`. Double-tap a prerequisite item: navigate to that chit's editor (check `isDirty` first, show unsaved dialog if needed).
    - _Requirements: 4_

- [x] 5. Enhance ChitPickerSheet with multi-select and server-side search
  - [x] 5.1 Add optional parameters to ChitPickerSheet
    - Modify `ChitPickerSheet.kt`: add optional parameters `multiSelect: Boolean = false`, `serverSearch: Boolean = false`, `apiService: CwocApiService? = null`, `disabledIds: Set<String> = emptySet()`, `filterPredicate: ((String, String) -> Boolean)? = null`, `onMultiConfirm: ((List<Pair<String, String>>) -> Unit)? = null`. When `multiSelect = true`: show checkboxes instead of single-tap selection, add "Confirm" button in footer. When `serverSearch = true`: on search input change (debounced 300ms), call `apiService.searchChits(query)` instead of client-side filter. Show disabled items (in `disabledIds`) as grayed-out and non-selectable.
    - _Requirements: 5_
  - [x] 5.2 Add circular dependency check and API endpoints
    - For prerequisites: add `beforeSelect: suspend (String) -> Boolean` callback for circular dependency check via `POST /api/chits/check-prerequisites`. In `CwocApiService.kt`: add `@GET("api/chits/search") suspend fun searchChits(@Query("q") query: String): Response<List<ChitSearchResult>>` and `@POST("api/chits/check-prerequisites") suspend fun checkPrerequisites(@Body body: Map<String, String>): Response<Map<String, Boolean>>`.
    - _Requirements: 5_

- [x] 6. Add prerequisite inline status change
  - [x] 6.1 Add updatePrereqStatus and API endpoint
    - In `ChitEditorViewModel.kt`: add `fun updatePrereqStatus(prereqId: String, newStatus: String?)` that calls `apiService.patchChitFields(prereqId, mapOf("status" to (newStatus ?: "")))`. On success: update `prereqChitCache` with new status, call `checkPrereqAutoBlock()`. On failure: show error toast. In `CwocApiService.kt`: add `@PATCH("api/chits/{id}/fields") suspend fun patchChitFields(@Path("id") id: String, @Body fields: Map<String, String>): Response<Unit>`. Wire the status dropdown in `PrerequisiteItem` (from Task 4) to call `updatePrereqStatus()` on selection change.
    - _Requirements: 6_

- [x] 7. Implement prerequisite auto-block logic
  - [x] 7.1 Add checkPrereqAutoBlock logic
    - In `ChitEditorViewModel.kt`: add `fun checkPrereqAutoBlock()`. Logic: if `prerequisites` is empty and status is Blocked due to auto-block → set status to ToDo + toast "Prerequisites cleared — status set to To Do". If any prereq not Complete and status != Blocked → set status to Blocked + toast "Status set to Blocked — prerequisites incomplete" + set `prereqAutoBlocked = true`. If all prereqs Complete and status is Blocked and `prereqAutoBlocked` → set status to ToDo + toast "All prerequisites complete — status set to To Do" + set `prereqAutoBlocked = false`. Call `checkPrereqAutoBlock()` after: adding prerequisites, removing prerequisites, and inline status change (Task 6).
    - _Requirements: 7_
  - [x] 7.2 Add override warning dialog
    - Add `fun checkPrereqStatusOverride(newStatus: String): Boolean` — returns true if override dialog should show (prereqs exist, any incomplete, changing away from Blocked). In `ChitEditorScreen.kt`: when status dropdown changes, call `checkPrereqStatusOverride()` first. If true: show AlertDialog "This chit has incomplete prerequisites. Changing status away from 'Blocked' may cause inconsistency. Proceed anyway?" with Override/Cancel. Override → set `prereqAutoBlocked = false`, allow change. Cancel → revert dropdown.
    - _Requirements: 8_

- [x] 8. Implement send-content modal for notes and checklist
  - [x] 8.1 Create SendContentSheet composable
    - Create `android/app/src/main/java/com/cwoc/app/ui/screens/editor/zones/SendContentSheet.kt`: a `ModalBottomSheet` composable. Parameters: `contentType: String` ("notes" or "checklist"), `currentChitId: String`, `apiService: CwocApiService`, `onExecute: (mode: String, targetChitId: String) -> Unit`, `onDismiss: () -> Unit`. UI: search input (debounced 300ms → `apiService.searchChits(query)`), results list with radio-select (title, due date, status columns), footer with selected name + Cancel + Copy (📋) + Move (📤) buttons (disabled until selection). ESC/back: if search has text → clear; else → dismiss.
    - _Requirements: 9, 10_
  - [x] 8.2 Add executeSendContent to ChitEditorViewModel
    - Add `fun executeSendContent(mode: String, targetChitId: String, contentType: String)`. For notes: fetch target entity, append source note with `\n\n` separator, save target via upsert + dirty + push. If move: clear source note in formState. For checklist: parse source checklist JSON, generate new IDs (UUID), normalize levels (subtract min level), remap parent IDs, append to target's checklist JSON, save target. If move: clear source checklist in formState. Store undo data.
    - _Requirements: 9, 10_
  - [x] 8.3 Wire send-content triggers and undo bar
    - In `ChitEditorScreen.kt`: add "Send to..." button in Notes zone header. In `ChecklistZoneV2.kt`: add "Send to Chit" option in the zone menu. Both open `SendContentSheet`. Show undo composable (8s countdown bar with Undo button) after execution.
    - _Requirements: 11_

- [x] 9. Implement send-item quick popup with recent chits
  - [x] 9.1 Create SendItemPopup composable
    - Create `android/app/src/main/java/com/cwoc/app/ui/screens/editor/zones/SendItemPopup.kt`: a `Popup` composable anchored near the tapped item. Shows: "New Chit" row (tap to reveal Move/Copy buttons), 3 most recent chits (titles truncated to 30 chars, each with Copy 📋 and Move 📤 buttons), "Search..." button.
    - _Requirements: 12_
  - [x] 9.2 Add send icon and popup trigger
    - In `ChecklistZoneV2.kt`: add a send icon (📤) to each checklist item row. On tap: show `SendItemPopup`. Pre-fetch chit list on editor load (background coroutine, 2-min cache in ViewModel). Recent chits: sort all non-deleted chits by `modifiedDatetime` desc, exclude current chit, take first 3.
    - _Requirements: 12_
  - [x] 9.3 Add executeSendItem to ChitEditorViewModel
    - Add `fun executeSendItem(mode: String, targetChitId: String, item: ChecklistItemV2, allItems: List<ChecklistItemV2>)` — gets subtree via `ChecklistOperationsV2.getSubtree()`, demotes levels (subtract item.level), generates new IDs, remaps parents, fetches target, appends to target checklist, saves target. If move: removes subtree from source items. Undo for move: `cwocUndoToast` with 8s countdown, restore items at original index on undo. "Search..." button: close popup, open `SendContentSheet` in single-item mode.
    - _Requirements: 14, 15_

- [x] 10. Implement spawn-new-chit from checklist item
  - [x] 10.1 Add spawn-new-chit flow
    - In `SendItemPopup.kt`: "New Chit" row tap reveals Move and Copy buttons. On Move/Copy tap: get subtree, demote levels, generate new IDs. Store prepared items as JSON in navigation argument (via `SavedStateHandle` key `"prefill_checklist"`). If move: remove items from source checklist first. Before navigating: check `isDirty` — if dirty, show unsaved dialog (Save & Go / Discard & Go / Cancel). Save & Go: save current chit, then navigate. Discard & Go: discard, then navigate. Cancel: stay, don't remove items (if move, restore them). Navigate to editor with `chitId=new&prefill=checklist`. In `ChitEditorViewModel.kt` init block: check `savedStateHandle.get<String>("prefill")` — if "checklist", read `savedStateHandle.get<String>("prefill_checklist")`, parse JSON to `List<ChecklistItemV2>`, set as initial checklist in formState.
    - _Requirements: 13_

- [x] 11. Update Web Function Index with Resolved By references
  - [x] 11.1 Edit Web Function Index
    - Edit `Tasks/Android Mobile Implementation/function-parity-audit/Web Function Index.md`: add "Resolved By" entries for items 27, 28, 32, 33, 36, 38, 39, 40, 42, 43, 44–53, 54–62 pointing to `.kiro/specs/calendar-prereqs-send/tasks.md` with the specific task numbers. Item 27 → Task 1. Item 28 → Task 2. Items 32-33 → Task 3. Items 36, 38, 39 → Task 4. Item 40 → Task 6. Items 42-43 → Task 7. Items 44-53 → Task 8. Items 54-62 → Tasks 9, 10.

## Notes

- The existing `RecurringEditDialog` in `ui/components/RecurringEditDialog.kt` is fully implemented but never wired anywhere. Tasks 1 and 2 will be the first to use it.
- The existing `ChitPickerSheet` does client-side search only. Task 5 adds optional server-side search via `/api/chits/search` — this is needed for send-content (large chit counts make client-side impractical) and prerequisites (circular dependency check requires server round-trip anyway).
- `ChecklistOperationsV2.getSubtree(items, itemId)` already exists and returns the item + all descendants. Reuse it for send-item (Tasks 9, 10).
- The existing `onSendItemsToChit` in `ChecklistZoneV2` only supports move (removes from source). Tasks 9 and 10 add copy mode (keep in source) and spawn-new-chit. The existing move flow should be preserved and extended, not replaced.
- For the undo mechanism: the web uses a custom countdown bar in the zone header (send-content) and `cwocUndoToast` (send-item). On Android, implement a similar composable: a `Row` with message + Undo button + animated progress bar that auto-dismisses after 8 seconds. This can be a shared `UndoCountdownBar` composable reusable across both features.
- `CwocApiService` needs 3 new endpoints: `searchChits`, `patchChitFields`, `checkPrerequisites`. These all hit existing server endpoints that are already implemented — no backend changes needed.
