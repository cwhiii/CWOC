# Technical Design: Calendar Drag, Prerequisites, Send-Content/Send-Item Parity

## Overview

This design covers Android parity for Web Function Index items 27–62 across three feature blocks. The implementation leverages existing patterns: Compose gesture detection for drag, `ChitRepository` for persistence, `ChitPickerSheet` for selection (enhanced with server-side search), and `cwocUndoToast`-style feedback via Snackbar/Toast.

## Architecture

### Block 1: Calendar Drag & Snap

#### Month View Drag (CalendarMonthView.kt)

The web uses HTML5 drag/drop. Android uses `detectDragGesturesAfterLongPress` (same pattern as `WeekEventChip` in `CalendarTimeGrid.kt`).

**New composable: `DraggableMonthEventChip`**
- Wraps existing month event text with `pointerInput` using `detectDragGesturesAfterLongPress`
- Tracks `dragOffset: Offset` state
- On drag start: sets opacity to 0.4, notifies parent of drag state
- On drag move: updates offset, parent calculates which day cell is under finger
- On drag end: parent computes target date from finger position, calls `onMonthDragEnd(chitId, targetDate)`
- Blocks drag for viewer-role chits and birthday events

**CalendarViewModel additions:**
- `fun updateChitDateTimesForMonthDrag(chitId: String, sourceDayStr: String, targetDate: LocalDate)` — computes day diff, shifts dates, handles recurring via `RecurringEditDialog`
- Recurring check: if chit has `recurrenceRule != null`, show `RecurringEditDialog` before persisting

**Recurring modal integration:**
- `RecurringEditDialog` already exists in `ui/components/` but is never wired
- Add state `showRecurringDragDialog: MutableStateFlow<RecurringDragContext?>` to CalendarViewModel
- `RecurringDragContext(chitId, sourceDateStr, targetDate, isMonthDrag: Boolean)`
- On THIS_INSTANCE_ONLY: create exception + standalone copy at new date
- On ALL_EVENTS: shift parent dates by day diff (same as web)
- On THIS_AND_FOLLOWING: split recurrence at the dragged instance date

#### All-Day Row Drag (CalendarTimeGrid.kt)

The all-day row already renders events but has no drag. Add `detectDragGesturesAfterLongPress` to all-day event chips.

**Approach:** Same pattern as `WeekEventChip` but horizontal-only (no vertical time component). Track `dragOffsetX`, compute target day column from offset / column width.

#### Snap Grid Overlay (CalendarTimeGrid.kt)

The existing code already draws a snap grid when `isAnyEventDragging` is true (dashed lines via Canvas). However, it doesn't show time labels. Enhancement:

- When `isAnyEventDragging && snapMinutes > 1`: draw `drawLine` at each snap interval
- Add `drawText` (via `drawIntoCanvas` + `nativeCanvas.drawText`) at hour marks or at snap intervals if snap >= 30
- Color: `Color(0x268B5A2B)` (rgba 139,90,43,0.15 equivalent)
- Label color: `Color(0x598B5A2B)` (rgba 139,90,43,0.35 equivalent)

### Block 2: Editor Prerequisites

#### PrerequisitesZone Rewrite (ChitEditorScreen.kt)

Replace the current raw-ID InputChip implementation with a rich list.

**New state in ChitEditorViewModel:**
- `val prereqChitCache: StateFlow<Map<String, ChitEntity>>` — fetched chit data for each prerequisite ID
- `val prereqAutoBlocked: MutableStateFlow<Boolean>` — tracks auto-block state
- `fun loadPrereqChitData(ids: List<String>)` — fetches via `chitDao.getChitsByIds(ids)`
- `fun updatePrereqStatus(prereqId: String, newStatus: String)` — PATCH via `apiService.patchChitFields(prereqId, mapOf("status" to newStatus))`
- `fun checkPrereqAutoBlock()` — evaluates all prereqs, sets status if needed
- `fun checkPrereqStatusOverride(newStatus: String): Boolean` — returns whether override dialog should show

**UI composable: `PrerequisiteItem`**
- Background: chit color (or `#e8dcc8` default)
- Text color: computed via luminance formula (same as web's `_prereqContrastColor`)
- Content: title text, status dropdown (ExposedDropdownMenu), remove IconButton
- Double-tap: navigate to that chit's editor (with unsaved check)

**Chit Picker for Prerequisites:**
- Enhance `ChitPickerSheet` or create `PrerequisitePickerSheet` that:
  - Uses multi-select (checkboxes instead of single-tap)
  - Excludes current chit and project masters
  - Shows already-selected as disabled
  - Performs circular dependency check via `POST /api/chits/check-prerequisites`
  - Warns about no-status chits on confirm

**Auto-Block Logic:**
- After any prereq add/remove/status-change: call `checkPrereqAutoBlock()`
- If any prereq not Complete and status != Blocked → set Blocked + toast
- If all Complete and auto-blocked → set ToDo + toast
- If all removed and auto-blocked → set ToDo + toast
- Track via `prereqAutoBlocked` flag

**Override Warning:**
- When user changes status away from Blocked with incomplete prereqs → show AlertDialog
- Confirm → set `prereqAutoBlocked = false`
- Cancel → revert status

### Block 3: Send-Content & Send-Item

#### Send-Content Modal

**New file: `ui/screens/editor/zones/SendContentSheet.kt`**

A `ModalBottomSheet` composable with:
- Search input with debounced server-side search via `GET /api/chits/search?q={term}`
- Results list with radio-select (single target)
- Footer: Cancel, Copy, Move buttons
- Content type parameter: `notes` or `checklist`

**ChitEditorViewModel additions:**
- `fun executeSendContent(mode: SendMode, targetChitId: String, contentType: ContentType)` — fetches target, appends content, saves via PUT, returns undo data
- `fun undoSendContent(undoData: SendContentUndoData)` — restores original state

**API integration:**
- Search: `apiService.searchChits(query)` → `GET /api/chits/search?q={query}`
- Save target: `chitRepository.updateChecklist(chitId, newChecklist)` or `chitRepository.updateNote(chitId, newNote)` — new convenience methods
- Actually: use existing pattern — fetch entity, modify, upsert, mark dirty, push

**Undo mechanism:**
- Store `SendContentUndoData(targetId, originalNote/originalChecklist, sourceOriginal, mode, contentType)`
- Show `cwocUndoToast`-equivalent (Snackbar with countdown) — use existing `CwocSnackbarHost` if available, or a custom composable with 8s timer

#### Send-Item Quick Popup

**New file: `ui/screens/editor/zones/SendItemPopup.kt`**

A `Popup` or `DropdownMenu` composable anchored near the tapped item:
- "New Chit" row (expandable to show Move/Copy)
- 3 most recent chits (sorted by `modifiedDatetime` desc)
- "Search..." button

**State management:**
- `sendItemRecentChits: StateFlow<List<ChitEntity>>` in ChecklistZoneViewModel or a shared state holder
- Pre-fetch on editor load with 2-min cache TTL
- `sendItemTarget: MutableStateFlow<ChecklistItemV2?>` — the item being sent

**Send-Item execution:**
- `fun executeSendItem(mode: SendMode, targetChitId: String, item: ChecklistItemV2, allItems: List<ChecklistItemV2>)` — gets subtree, demotes levels, generates new IDs, appends to target, removes from source if move
- Undo for move: `cwocUndoToast` with restore callback

#### Spawn New Chit

- Store items in a navigation argument (via `SavedStateHandle` or shared ViewModel)
- Navigate to editor with `prefill=checklist` parameter
- Editor's `init` block checks for prefill data and populates checklist
- Before navigating: check `isDirty` → show unsaved dialog if needed

## Data Flow

### Calendar Drag Flow
```
User long-press → detectDragGesturesAfterLongPress → onDragStart (opacity 0.4)
→ onDrag (update offset, highlight target) → onDragEnd
→ if recurring: show RecurringEditDialog → on option selected:
    → THIS_INSTANCE: createException + createStandalone
    → ALL_EVENTS: shift parent dates
    → THIS_AND_FOLLOWING: split recurrence
→ if non-recurring: chitRepository.updateDateTimes()
→ refresh calendar events
```

### Prerequisites Flow
```
Editor loads → loadPrereqChitData(ids) → fetch from Room
→ render PrerequisiteItem list with colors/titles/statuses
→ "Add" → PrerequisitePickerSheet → circular check → add IDs → checkPrereqAutoBlock()
→ Status change → PATCH /api/chits/{id}/fields → update cache → checkPrereqAutoBlock()
→ Remove → filter IDs → checkPrereqAutoBlock()
```

### Send-Content Flow
```
User taps "Send to..." → validate content exists → open SendContentSheet
→ search/select target → tap Copy/Move
→ fetch target entity → append content → save target → show undo bar
→ if move: clear source content
→ if undo tapped: restore target original + restore source if move
```

### Send-Item Flow
```
User taps send icon → open SendItemPopup (3 recents + New + Search)
→ tap Copy/Move on a target → getSubtree(item) → demote levels → new IDs
→ fetch target → append items → save target
→ if move: remove from source + show undo toast
→ if "New Chit": store items → navigate to editor with prefill
```

## Files to Create/Modify

### New Files
- `android/app/src/main/java/com/cwoc/app/ui/screens/editor/zones/SendContentSheet.kt`
- `android/app/src/main/java/com/cwoc/app/ui/screens/editor/zones/SendItemPopup.kt`

### Modified Files
- `android/app/src/main/java/com/cwoc/app/ui/screens/calendar/CalendarMonthView.kt` — add drag gesture
- `android/app/src/main/java/com/cwoc/app/ui/screens/calendar/CalendarTimeGrid.kt` — all-day drag, snap grid labels
- `android/app/src/main/java/com/cwoc/app/ui/screens/calendar/CalendarViewModel.kt` — recurring drag modal state, month drag handler
- `android/app/src/main/java/com/cwoc/app/ui/screens/calendar/CalendarScreen.kt` — wire recurring dialog, month drag callback
- `android/app/src/main/java/com/cwoc/app/ui/screens/editor/ChitEditorScreen.kt` — rewrite PrerequisitesZone
- `android/app/src/main/java/com/cwoc/app/ui/screens/editor/ChitEditorViewModel.kt` — prereq cache, auto-block, send-content, send-item
- `android/app/src/main/java/com/cwoc/app/ui/screens/editor/zones/ChecklistZoneV2.kt` — send-item popup trigger, copy mode
- `android/app/src/main/java/com/cwoc/app/ui/components/ChitPickerSheet.kt` — add multi-select mode, server-side search option
- `android/app/src/main/java/com/cwoc/app/data/repository/ChitRepository.kt` — updateNote, updateChecklist convenience methods
- `android/app/src/main/java/com/cwoc/app/data/remote/CwocApiService.kt` — searchChits, patchChitFields, checkPrerequisites endpoints

## Components and Interfaces

### New Components
- **`SendContentSheet`** — `ModalBottomSheet` composable for selecting a target chit to send notes/checklist content to. Parameters: `contentType`, `currentChitId`, `apiService`, `onExecute`, `onDismiss`.
- **`SendItemPopup`** — `Popup` composable anchored near a checklist item showing 3 recent chits + New Chit + Search. Parameters: `item`, `recentChits`, `onCopy`, `onMove`, `onNewChit`, `onSearch`, `onDismiss`.
- **`PrerequisiteItem`** — Row composable rendering a single prerequisite with color background, title, status dropdown, remove button.
- **`UndoCountdownBar`** — Shared composable showing message + Undo button + animated progress bar (8s countdown). Parameters: `message`, `onUndo`, `duration`, `onExpire`.

### Modified Interfaces
- **`ChitPickerSheet`** — Add optional `multiSelect`, `serverSearch`, `apiService`, `disabledIds`, `beforeSelect`, `onMultiConfirm` parameters.
- **`CalendarMonthView`** — Add `onMonthEventDragEnd: (String, LocalDate, LocalDate) -> Unit` callback.
- **`CalendarTimeGrid`** — Add `onAllDayDragEnd: (String, LocalDate) -> Unit` callback.
- **`CalendarViewModel`** — Add `handleMonthDrag()`, `handleAllDayDrag()`, `showRecurringDragDialog` state.
- **`ChitEditorViewModel`** — Add `prereqChitCache`, `prereqAutoBlocked`, `loadPrereqChitData()`, `updatePrereqStatus()`, `checkPrereqAutoBlock()`, `checkPrereqStatusOverride()`, `executeSendContent()`, `executeSendItem()`.
- **`CwocApiService`** — Add `searchChits()`, `patchChitFields()`, `checkPrerequisites()` endpoints.

## Data Models

### RecurringDragContext
```kotlin
data class RecurringDragContext(
    val chitId: String,
    val sourceDate: LocalDate,
    val targetDate: LocalDate,
    val isVirtual: Boolean = false,
    val parentId: String? = null,
    val virtualDateStr: String? = null
)
```

### SendContentUndoData
```kotlin
data class SendContentUndoData(
    val targetChitId: String,
    val targetOriginalNote: String?,
    val targetOriginalChecklist: String?,
    val sourceOriginalNote: String?,
    val sourceOriginalChecklist: String?,
    val mode: String, // "copy" or "move"
    val contentType: String // "notes" or "checklist"
)
```

### SendItemUndoData
```kotlin
data class SendItemUndoData(
    val targetChitId: String,
    val addedItemIds: List<String>,
    val removedItems: List<ChecklistItemV2>,
    val originalIndex: Int
)
```

### ChitSearchResult (API response)
```kotlin
data class ChitSearchResult(
    val chit: ChitEntity? = null,
    val id: String = "",
    val title: String = "",
    val status: String? = null,
    val due_datetime: String? = null
)
```

## Error Handling

- **Calendar drag save failure**: If `chitRepository.updateDateTimes()` fails (Room exception), log error and show toast "Failed to reschedule event." The drag offset resets visually regardless (drag end always resets offset to 0).
- **Prerequisite fetch failure**: If `chitDao.getChitsByIds()` returns fewer results than expected, show found chits normally and mark missing ones as "(deleted)".
- **Prerequisite status PATCH failure**: Show error toast "Failed to update prerequisite status." Do NOT revert the dropdown (matches web behavior — web also doesn't revert on failure in current implementation).
- **Circular dependency check failure** (network error): Show error toast "Cannot verify — check your connection." Allow the selection anyway (fail-open for UX, server will reject on save if truly circular).
- **Send-content target save failure**: Show error toast "Failed to send content: {error}." If move mode and source was already cleared, restore source from undo data.
- **Send-item target save failure**: Show error toast "Failed to send item: {error}." If move mode and items were already removed, restore items from undo data at original position.
- **Spawn new chit navigation failure** (unsaved dialog cancel): Remove prefill data from SavedStateHandle, restore items to source if move mode.

## Key Design Decisions

1. **Reuse `detectDragGesturesAfterLongPress`** for month drag (same as week view) — consistent UX, proven pattern.
2. **Enhance existing `ChitPickerSheet`** with optional multi-select and server-side search rather than creating a new component — DRY principle.
3. **Store send-item prefill in `SavedStateHandle`** navigation args rather than sessionStorage (Android equivalent) — survives process death.
4. **Use `ChitRepository.updateDateTimes()`** for all drag persistence — single source of truth for date mutations with dirty tracking and sync push.
5. **Wire `RecurringEditDialog`** (already exists, never used) into both month drag and all-day drag flows — no new UI component needed.
6. **Undo mechanism**: Use `cwocUndoToast` pattern via a custom composable with 8s countdown + Undo button, matching the web's behavior. Not a Snackbar (too limited for countdown progress bar).
