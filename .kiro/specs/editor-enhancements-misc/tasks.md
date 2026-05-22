# Implementation Plan

## Overview

This plan implements 19 missing/partial web functions for Android parity across editor enhancements and miscellaneous features. Tasks are ordered by dependency — verification tasks first (may require no code), then domain utilities, then ViewModel integration, then UI changes.

## Task Dependency Graph

```json
{
  "waves": [
    {
      "name": "Wave 1: Verification & Independent Domain Utilities",
      "tasks": [1, 2, 3, 4, 5, 6, 7],
      "description": "Re-verify already-implemented features (1, 2), create pure domain utilities (3, 4, 5, 6), and RSVP utility (7) — all independent"
    },
    {
      "name": "Wave 2: ViewModel Integration",
      "tasks": [8, 9, 10, 11, 12, 13],
      "description": "Wire domain utilities into ViewModels — checklist clipboard (8), indicator reorder (9), project move (10), contact save-and-stay (11), attachment chit title (12), RSVP filtering (13)"
    },
    {
      "name": "Wave 3: UI Layer",
      "tasks": [14, 15, 16, 17, 18, 19],
      "description": "Final UI composables — checklist menu actions (14), inline markdown display (15), notes list continuation (16), indicator drag UI (17), project context menu (18), contact editor buttons (19)"
    }
  ]
}
```

## Tasks

- [x] 1. Verify Custom Objects Zone Management <!-- dep: none -->
  - [x] 1.1. Read `CustomObjectsViewModel.kt` and verify it has working implementations of: `createZone()`, `renameZone()`, `deleteZone()`, `addObjectToZone()`, `removeObjectFromZone()`, `reorderZoneObjects()`
  - [x] 1.2. Read `CustomObjectsScreen.kt` and verify the UI exposes: add zone button, zone rename/delete (long-press or menu), drag-to-assign objects to zones, drag-to-reorder within zones
  - [x] 1.3. If ALL functions are fully implemented with working UI, update the Web Function Index entries W223–W227 to ✅ with the relevant Android function references
  - [x] 1.4. If any function is missing or incomplete, document what's missing and implement it (create zone dialog, rename dialog, delete confirmation, drag assignment, reorder persistence)
  - Requirements: 1

- [x] 2. Verify Attachment Multi-Select and Bulk Delete <!-- dep: none -->
  - [x] 2.1. Read `AttachmentsViewModel.kt` and verify it has working implementations of: `enterMultiSelectMode()`, `toggleSelection()`, `exitMultiSelectMode()`, `bulkDelete()`
  - [x] 2.2. Read `AttachmentsScreen.kt` and verify the UI exposes: long-press to enter multi-select, tap to toggle, toolbar with selection count and delete action, confirmation dialog
  - [x] 2.3. If ALL functions are fully implemented with working UI, update the Web Function Index entries W228–W229 to ✅ with the relevant Android function references
  - [x] 2.4. If any function is missing or incomplete, document what's missing and implement it
  - Requirements: 2

- [x] 3. Create ChecklistClipboardParser Utility <!-- dep: none -->
  - [x] 3.1. Create `android/app/src/main/java/com/cwoc/app/domain/checklist/ChecklistClipboardParser.kt`
  - [x] 3.2. Implement `fun parseClipboardText(text: String): List<ChecklistItem>` that:
    - Splits text by `\n`
    - For each non-blank line: detects indent level (4 spaces or 1 tab = 1 level, 2 spaces = 1 level if no 4-space found)
    - Strips markdown checklist markers (`- [x] `, `- [ ] `, `* [x] `, `* [ ] `) and sets checked state accordingly
    - Strips plain list markers (`- `, `* `, `• `, `1. `, `2) `, etc.) if no checkbox marker found
    - Strips legacy standalone checkbox markers (`[x] `, `[ ] `) at line start
    - Generates unique IDs for each item
    - Caps indent level at 3 (MAX_INDENT_LEVEL)
  - [x] 3.3. Implement parent assignment: iterate items, for each item at level > 0, walk backwards to find the nearest preceding item at level - 1 and set as parent
  - [x] 3.4. Return empty list if input is null, blank, or produces no valid items
  - Requirements: 3

- [x] 4. Create InlineMarkdownText Composable <!-- dep: none -->
  - [x] 4.1. Create `android/app/src/main/java/com/cwoc/app/ui/components/InlineMarkdownText.kt`
  - [x] 4.2. Implement a `@Composable fun InlineMarkdownText(text: String, modifier: Modifier, style: TextStyle, onLinkClick: ((String) -> Unit)?)` that renders inline markdown using `buildAnnotatedString`
  - [x] 4.3. Support: `**bold**` / `__bold__` → `FontWeight.Bold`, `*italic*` / `_italic_` → `FontStyle.Italic`, `~~strikethrough~~` → `TextDecoration.LineThrough`, `` `code` `` → monospace font with subtle background, `[text](url)` → steel-blue color with underline + URL annotation
  - [x] 4.4. Process patterns in priority order: code spans first (to prevent inner formatting), then links, then bold, then italic, then strikethrough
  - [x] 4.5. For links: push `UrlAnnotation` or string annotation with tag `"URL"` so `ClickableText` can handle taps
  - [x] 4.6. If text contains no markdown syntax, render as plain text (fast path — no parsing overhead)
  - [x] 4.7. Do NOT process block-level markdown (headers, code blocks, blockquotes, HRs, lists)
  - Requirements: 4

- [x] 5. Create NotesListContinuation Utility <!-- dep: none -->
  - [x] 5.1. Create `android/app/src/main/java/com/cwoc/app/domain/editor/NotesListContinuation.kt`
  - [x] 5.2. Define `data class ListContinuationResult(val action: ListAction, val prefix: String, val prefixLength: Int)` and `enum class ListAction { CONTINUE, REMOVE_PREFIX }`
  - [x] 5.3. Implement `fun getListContinuation(currentLineText: String): ListContinuationResult?`
    - Match line against patterns (in order): `^\s*[-*+]\s\[[ xX]\]\s` (checkbox), `^\s*[-*+]\s` (unordered), `^\s*\d+[.)]\s` (ordered), `^\s*>\s?` (blockquote)
    - If no match, return null (not a list line — normal Enter behavior)
    - Extract: indent (leading whitespace), marker, content (text after marker)
    - If content is empty (just the prefix): return `REMOVE_PREFIX` action with the prefix length
    - If content is non-empty: return `CONTINUE` action with the appropriate next prefix:
      - Checkbox → same bullet + `[ ] ` (always unchecked)
      - Ordered → increment number, keep delimiter style
      - Unordered/blockquote → same marker
  - [x] 5.4. Preserve leading whitespace (indent) in the continuation prefix
  - Requirements: 5

- [x] 6. Create RsvpStatusUtil <!-- dep: none -->
  - [x] 6.1. Create `android/app/src/main/java/com/cwoc/app/domain/sharing/RsvpStatusUtil.kt`
  - [x] 6.2. Implement `fun getUserRsvpStatus(sharesJson: String?, currentUserId: String): String?`
    - Parse `sharesJson` as a JSON array of objects
    - Find the entry where `user_id` matches `currentUserId`
    - Return `rsvp_status` value (default to "invited" if field is null/empty)
    - Return null if user not found in shares or shares is null/empty/malformed
  - [x] 6.3. Implement `fun isDeclinedByCurrentUser(sharesJson: String?, ownerId: String?, currentUserId: String): Boolean`
    - If `ownerId == currentUserId`, return false (owners don't have RSVP)
    - Return `getUserRsvpStatus(sharesJson, currentUserId) == "declined"`
  - [x] 6.4. Handle malformed JSON gracefully (try/catch, return null on parse failure, log error)
  - Requirements: 7

- [x] 7. Implement Indicator Chart Order Persistence <!-- dep: none -->
  - [x] 7.1. In `IndicatorsViewModel.kt`, add `private val _chartOrder = MutableStateFlow<List<String>>(emptyList())` and expose as `val chartOrder: StateFlow<List<String>>`
  - [x] 7.2. Add `private fun loadChartOrder()` — reads `cwoc_indicators_chart_order` from SharedPreferences, parses JSON array, updates `_chartOrder`
  - [x] 7.3. Add `fun reorderChart(fromIndex: Int, toIndex: Int)` — reorders the list, updates `_chartOrder`, calls `saveChartOrder()`
  - [x] 7.4. Add `private fun saveChartOrder()` — serializes `_chartOrder.value` as JSON array, writes to SharedPreferences key `cwoc_indicators_chart_order`
  - [x] 7.5. Call `loadChartOrder()` in the ViewModel's `init` block
  - [x] 7.6. Modify the chart rendering logic to sort/reorder charts based on `_chartOrder` (charts not in the saved order appear at the end in default order)
  - Requirements: 6

- [x] 8. Integrate Clipboard Operations into ChecklistZoneViewModel <!-- dep: 3 -->
  - [x] 8.1. In `ChecklistZoneViewModel.kt`, add `fun pasteFromClipboard(clipboardText: String): Int`
    - Call `ChecklistClipboardParser.parseClipboardText(clipboardText)`
    - If result is empty, return 0
    - Push current items to undo stack
    - Append parsed items to `items` list
    - Trigger re-render and auto-save
    - Return count of pasted items
  - [x] 8.2. Add `fun copyIncompleteToClipboard(): String?`
    - Filter items where `checked == false`
    - If none, return null (caller shows "no incomplete items" toast)
    - Format each as `"  ".repeat(level) + "- [ ] " + text`
    - Join with `\n` and return the string (caller writes to clipboard)
  - [x] 8.3. Add `fun getIncompleteCount(): Int` — returns count of unchecked items (for UI feedback)
  - Requirements: 3

- [x] 9. Wire Indicator Reorder into IndicatorsScreen <!-- dep: 7 -->
  - [x] 9.1. In `IndicatorsScreen.kt`, collect `viewModel.chartOrder` as state
  - [x] 9.2. Apply the chart order to the displayed list of indicator charts (sort by position in `chartOrder`, unordered charts at end)
  - [x] 9.3. Add drag-to-reorder gesture support using Compose's `detectDragGesturesAfterLongPress` or a reorderable list library pattern (manual implementation with `pointerInput` + `graphicsLayer` offset)
  - [x] 9.4. On drag completion (drop), call `viewModel.reorderChart(fromIndex, toIndex)`
  - [x] 9.5. During drag: show visual feedback (elevated card, placeholder gap at drop position)
  - [x] 9.6. Ensure drag handles work with touch (long-press initiates, move reorders, release drops)
  - Requirements: 6

- [x] 10. Implement Move Child to Project in ProjectsViewModel <!-- dep: none -->
  - [x] 10.1. In `ProjectsViewModel.kt` (or the relevant projects ViewModel), add `fun moveChildToProject(childChitId: String, sourceProjectId: String, targetProjectId: String)`
  - [x] 10.2. Implementation:
    - Load source project's `child_chits` JSON array, remove `childChitId`
    - Load target project's `child_chits` JSON array, add `childChitId` (if not already present)
    - Save both projects to server via `PUT /api/chits/{id}` (or `PATCH /api/chits/{id}/fields`)
    - On success: refresh the projects list / Kanban display
    - On failure: revert local changes, show error toast
  - [x] 10.3. Add `fun getAvailableProjectsForMove(excludeProjectId: String): List<ChitEntity>` — returns all project masters except the specified one
  - Requirements: 8

- [x] 11. Implement Save-and-Stay in ContactEditorViewModel <!-- dep: none -->
  - [x] 11.1. In `ContactEditorViewModel.kt`, add `fun saveAndStay()` that:
    - Calls the same save/API logic as the existing `save()` method
    - On success: emits a success event/state (for toast display), resets dirty tracking, but does NOT set `_isSaved = true` (so navigation is not triggered)
    - On failure: emits an error event/state (for error toast display)
  - [x] 11.2. Add a `sealed class SaveEvent` or similar mechanism to communicate save results to the UI without triggering navigation: `SaveEvent.Success`, `SaveEvent.StaySuccess`, `SaveEvent.Error(message)`
  - [x] 11.3. Modify the existing `save()` to emit `SaveEvent.Success` (which triggers navigation) vs `saveAndStay()` emitting `SaveEvent.StaySuccess` (which shows toast only)
  - Requirements: 9

- [x] 12. Add Chit Title to Attachment Items <!-- dep: none -->
  - [x] 12.1. In the `AttachmentItem` data class (or equivalent), add `chitId: String?` and `chitTitle: String?` fields
  - [x] 12.2. Modify the attachment fetching logic in `AttachmentsViewModel` to include chit title:
    - Option A: If the `/api/attachments` endpoint already returns `chit_id` and `chit_title`, map them to the new fields
    - Option B: If not, after fetching attachments, look up each attachment's parent chit from the local Room database and populate `chitTitle`
  - [x] 12.3. If the API doesn't return chit title, check the backend `/api/attachments` endpoint and add `chit_title` to the response (server-side change)
  - Requirements: 10

- [x] 13. Integrate RSVP Filtering into View Logic <!-- dep: 6 -->
  - [x] 13.1. In the filter/sort logic (likely `FilterSortViewModel` or individual screen ViewModels), add a check using `RsvpStatusUtil.isDeclinedByCurrentUser()` when the "Show Declined" toggle is OFF
  - [x] 13.2. When filtering chits for any view (Calendar, Tasks, Notes, Checklists, Projects, Omni), exclude chits where `isDeclinedByCurrentUser` returns true (unless the show-declined filter is ON)
  - [x] 13.3. When rendering chit cards for declined chits (filter is ON), apply `alpha(0.5f)` modifier to visually distinguish them
  - [x] 13.4. Verify the "Show Declined" toggle exists in the sidebar filter panel (it should already exist from prior filter work — if not, add it)
  - Requirements: 7

- [x] 14. Add Clipboard Menu Actions to ChecklistZoneV2 UI <!-- dep: 8 -->
  - [x] 14.1. In `ChecklistZoneV2.kt`, locate the overflow/more menu (the `...` or kebab menu on the zone header)
  - [x] 14.2. Add a "Paste as Items" menu item that:
    - Reads clipboard text via `clipboardManager.getText()?.text`
    - Calls `viewModel.pasteFromClipboard(text)`
    - Shows toast: "📋 Pasted N items" on success, "Clipboard access denied" on failure, nothing if clipboard is empty
    - Shows undo toast with countdown (reuse existing undo pattern from ChecklistZoneViewModel)
  - [x] 14.3. Add a "Copy Incomplete" menu item that:
    - Calls `viewModel.copyIncompleteToClipboard()`
    - If result is non-null: writes to clipboard via `clipboardManager.setText(AnnotatedString(result))`, shows toast "📋 Copied N items"
    - If result is null: shows toast "No incomplete items to copy"
  - [x] 14.4. Ensure both menu items are accessible from the checklist zone header menu (alongside existing actions like "Check All", "Uncheck All", etc.)
  - Requirements: 3

- [x] 15. Replace Plain Text with InlineMarkdownText in Checklist Items <!-- dep: 4 -->
  - [x] 15.1. In `ChecklistZoneV2.kt`, find where checklist item text is displayed in non-editing mode (the `Text(item.text, ...)` composable)
  - [x] 15.2. Replace `Text(item.text)` with `InlineMarkdownText(text = item.text, style = currentTextStyle, onLinkClick = { url -> uriHandler.openUri(url) })`
  - [x] 15.3. Ensure that when the item enters edit mode (tap to edit), the raw text is shown in the TextField (not rendered markdown)
  - [x] 15.4. Apply the same `InlineMarkdownText` replacement in other locations where checklist items are displayed:
    - Dashboard checklist cards (if checklist items are shown inline)
    - Omni View checklist previews
    - Notebook view checklist rows
  - [x] 15.5. Verify that checked items still show strikethrough styling (the checked-item strikethrough should combine with any markdown strikethrough)
  - Requirements: 4

- [x] 16. Implement Notes List Continuation in Editor <!-- dep: 5 -->
  - [x] 16.1. In the notes editing composable (NotesZone or the relevant TextField in ChitEditorScreen), intercept the Enter key or detect newline insertion in `onValueChange`
  - [x] 16.2. When a newline is inserted (new text has one more `\n` than old text at the cursor position):
    - Extract the line text before the cursor (from the last `\n` before cursor to cursor position)
    - Call `NotesListContinuation.getListContinuation(lineText)`
    - If result is null: allow normal newline insertion (no list context)
    - If result is `CONTINUE`: insert `\n` + result.prefix at cursor position, update TextField value and cursor position
    - If result is `REMOVE_PREFIX`: remove the prefix from the current line (delete `prefixLength` characters before cursor), do NOT insert newline
  - [x] 16.3. Handle cursor positioning correctly after insertion/removal (set `TextFieldValue` with updated `selection`)
  - [x] 16.4. Ensure this doesn't interfere with normal typing, paste, or undo operations
  - Requirements: 5

- [x] 17. Add Drag-to-Reorder UI for Indicator Charts <!-- dep: 9 -->
  - [x] 17.1. In `IndicatorsScreen.kt`, wrap the chart list in a reorderable container that supports long-press-to-drag
  - [x] 17.2. Implement drag gesture detection: `pointerInput` with `detectDragGesturesAfterLongPress` on each chart card
  - [x] 17.3. During drag: offset the dragged item visually (translate Y), show a placeholder/gap at the current drop position, apply elevation to the dragged card
  - [x] 17.4. On drag end: determine the final position based on Y offset, call `viewModel.reorderChart(fromIndex, toIndex)`
  - [x] 17.5. Add a subtle drag handle icon (⋮⋮ or grip dots) on each chart card to hint at reorderability
  - [x] 17.6. Ensure the drag interaction doesn't conflict with chart expand/collapse or chart tap interactions
  - Requirements: 6

- [x] 18. Add Project Context Menu and Move-to-Project UI <!-- dep: 10 -->
  - [x] 18.1. In the Projects screen composable, add a long-press gesture on project cards that shows a `DropdownMenu` (ProjectContextMenu)
  - [x] 18.2. ProjectContextMenu items: "Create New Child Chit" (navigates to editor with parent pre-set), "Open in Editor" (navigates to editor for project), "Quick Edit" (opens quick edit sheet), "Pin/Unpin", "Archive/Unarchive", snooze options (H/D/W/F/M circular buttons or dropdown)
  - [x] 18.3. On child chit cards within the Kanban board, add a long-press context menu that includes "Move to Project"
  - [x] 18.4. "Move to Project" opens `MoveToProjectDialog`: an AlertDialog with a scrollable list of project masters (excluding current parent), each showing project title
  - [x] 18.5. On project selection in the dialog: call `viewModel.moveChildToProject(childId, currentProjectId, selectedProjectId)`, dismiss dialog, show toast "Moved to [project title]" on success or error toast on failure
  - [x] 18.6. After successful move, refresh the Kanban board to reflect the removed child
  - Requirements: 8

- [x] 19. Add Save-and-Stay Button to Contact Editor UI <!-- dep: 11 -->
  - [x] 19.1. In `ContactEditorScreen.kt`, modify the top app bar actions to include two save buttons:
    - "Save" (floppy disk icon or similar) → calls `viewModel.saveAndStay()`
    - "Save & Exit" (floppy disk + arrow icon or checkmark) → calls existing `viewModel.save()`
  - [x] 19.2. Collect `SaveEvent` from the ViewModel:
    - On `SaveEvent.StaySuccess`: show toast "Contact saved", do NOT navigate
    - On `SaveEvent.Success`: navigate back (existing behavior)
    - On `SaveEvent.Error`: show error toast with message
  - [x] 19.3. Ensure both buttons are disabled while a save operation is in progress (prevent double-tap)
  - [x] 19.4. After `saveAndStay()` succeeds, reset the dirty/unsaved state so the back-press unsaved-changes dialog is not triggered
  - Requirements: 9

- [x] 20. Add Chit Title to Attachment Cards UI <!-- dep: 12 -->
  - [x] 20.1. In `AttachmentsScreen.kt` / `AttachmentCard` composable, add a row below filename/size showing the chit title
  - [x] 20.2. Style the chit title as secondary text: smaller font size, steel-blue color (#4682B4), with underline or clickable appearance
  - [x] 20.3. On tap of the chit title: navigate to the chit editor for that `chitId`
  - [x] 20.4. If `chitTitle` is null: display "Unknown chit" in muted gray, disable tap
  - [x] 20.5. If the parent chit is soft-deleted: display title with strikethrough and reduced opacity, disable tap navigation
  - Requirements: 10

## Notes

- Requirements 1 and 2 (Tasks 1–2) are verification-only — the gap files indicate these may already be fully implemented. If verification confirms they're complete, those tasks are just index updates with no code changes.
- The `InlineMarkdownText` composable (Task 4) should be lightweight — it only handles inline formatting, not full markdown. Check if the existing `MarkdownRenderer` already has an inline-only mode that could be reused instead of creating a new component.
- For notes list continuation (Task 16), the key challenge on Android is intercepting the Enter key in a Compose `TextField`. The approach is to compare old and new `TextFieldValue` in `onValueChange` and detect newline insertion, then modify the value before it's committed to state.
- The indicator drag-to-reorder (Tasks 7, 9, 17) can use Compose's built-in gesture detection. No external library needed — implement with `pointerInput` + `detectDragGesturesAfterLongPress` + `graphicsLayer` for visual offset during drag.
- For the attachment chit title (Task 12), check the backend `/api/attachments` endpoint first. If it already returns `chit_id`, the title can be looked up locally. If not, a server-side change may be needed to include `chit_title` in the response.
- Room database version does NOT need to be incremented for this spec — no new entities or table changes are required.
