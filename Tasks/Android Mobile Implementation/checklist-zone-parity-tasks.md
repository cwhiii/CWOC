# Android Checklist Zone Parity — Task List

**Goal:** Replace the current Android checklist zone (swipe-to-delete, up/down arrows, collapsible, fixed-height) with a complete rewrite that is visually and behaviorally identical to the mobile browser version. The user should not be able to tell if they're on the app or the mobile browser.

**Reference:** `Tasks/Android Mobile Implementation/checklist-zone-mobile-browser-spec.md`

**Spec:** `.kiro/specs/android-checklist-zone-parity/`

---

## Wave 1: Data Model & Domain Operations

### Task 1: Create ChecklistItemV2 and ChecklistOperationsV2

**Files to create:**
- `android/app/src/main/java/com/cwoc/app/domain/checklist/ChecklistItemV2.kt`
- `android/app/src/main/java/com/cwoc/app/domain/checklist/ChecklistOperationsV2.kt`

**ChecklistItemV2 data class:**
```kotlin
data class ChecklistItemV2(
    val id: String,           // UUID string, always present
    val text: String,         // Supports markdown
    val level: Int = 0,       // 0–4 (MAX_INDENT_LEVEL)
    val checked: Boolean = false,
    val parent: String? = null // ID of parent item, null = top-level
)
```

**Constants:**
- `MAX_INDENT_LEVEL = 4`
- `INDENT_DP_PER_LEVEL = 20`

**Pure functions to implement in ChecklistOperationsV2:**

| Function | Description |
|----------|-------------|
| `parse(json: String?): List<ChecklistItemV2>` | Parse JSON, handle both `indent`/`level` and `parent` fields, generate UUID for missing IDs, cap level at 4 |
| `serialize(items: List<ChecklistItemV2>): String` | Output `{id, text, level, checked, parent}` JSON matching web format |
| `getSubtree(items, itemId): List<ChecklistItemV2>` | Item + all descendants via parent chain |
| `getChildren(items, itemId): List<ChecklistItemV2>` | Direct children (parent == itemId) |
| `getParent(items, item): ChecklistItemV2?` | Find parent by item.parent field |
| `indent(items, itemId): List<ChecklistItemV2>` | +1 level (if < MAX and valid), set parent to nearest preceding at level-1 |
| `indentSubtree(items, itemId): List<ChecklistItemV2>` | Indent item + all descendants |
| `outdent(items, itemId): List<ChecklistItemV2>` | -1 level (if > 0), reassign following siblings |
| `outdentSubtree(items, itemId): List<ChecklistItemV2>` | Outdent item + all descendants |
| `toggleCheck(items, itemId): List<ChecklistItemV2>` | Flip checked, cascade to all descendants |
| `deleteWithSubtree(items, itemId): List<ChecklistItemV2>` | Remove item + all descendants |
| `splitItem(items, itemId, cursorPos): Pair<List<ChecklistItemV2>, String>` | Split text at cursor, new item below with same level/parent, return (newItems, newItemId) |
| `moveAbove(items, draggedId, targetId): List<ChecklistItemV2>` | Move subtree before target at target's level |
| `moveBelow(items, draggedId, targetId): List<ChecklistItemV2>` | Move subtree after target+children at target's level |
| `moveOnto(items, draggedId, targetId): List<ChecklistItemV2>` | Move subtree as child of target (level = target.level + 1) |
| `parseClipboardText(text: String): List<ChecklistItemV2>` | Parse lines: `- [ ]`/`- [x]`, list markers, indentation (4 spaces/tab = 1 level) |
| `itemsToMarkdown(items: List<ChecklistItemV2>): String` | Convert to markdown task list: `"  ".repeat(level) + "- [ ] " + text` |

---

## Wave 2: State Management

### Task 2: Create ChecklistZoneViewModel

**File:** `android/app/src/main/java/com/cwoc/app/ui/screens/editor/zones/ChecklistZoneViewModel.kt`

**State:**
- `items: MutableState<List<ChecklistItemV2>>` — core item list
- `undoStack: MutableList<String>` — JSON snapshots, max 50
- `redoStack: MutableList<String>` — JSON snapshots
- `canUndo: Boolean` / `canRedo: Boolean` — derived
- `selectedIds: MutableState<Set<String>>` — multi-select
- `isMultiSelectActive: Boolean` — derived (selectedIds non-empty)
- `lastSelectedId: String?` — anchor for range-select
- `editingItemId: MutableState<String?>` — inline editing
- `autoSaveState: MutableState<AutoSaveState>` — enum: IDLE, PENDING, SAVING, SAVED, FAILED
- `autoSaveEnabled: Boolean` + `autoSaveChitOverride: Boolean?`

**Operations:**
- `loadItems(json: String?)` — parse, reset undo/redo
- `pushUndoState()` — snapshot to undo, clear redo, enforce max 50
- `undo()` — pop undo → current, push current → redo
- `redo()` — pop redo → current, push current → undo
- `applyChange(newItems)` — push undo, update items, trigger auto-save, serialize + notify parent
- `applyChangeQuiet(newItems)` — update items without undo push (per-keystroke edits)
- `toggleSelectItem(itemId)` — add/remove from selectedIds, update anchor
- `rangeSelectTo(itemId)` — select all unchecked between anchor and target
- `selectAll()` — select all unchecked
- `clearSelection()` — clear selectedIds, reset anchor
- `hasPendingContent(): Boolean` — input has text OR editing active
- `commitPendingContent()` — create item from input, save edit

**Auto-save flow:**
1. Any change → `autoSaveState = PENDING`, show "changes pending"
2. Cancel previous debounce job, start new 2-second delay coroutine
3. After 2s → `autoSaveState = SAVING`, call `PATCH /api/chits/{id}/checklist`
4. Success → `autoSaveState = SAVED`, after 2s → IDLE
5. Failure → `autoSaveState = FAILED`, mark editor unsaved

---

## Wave 3: Core UI Composables

### Task 3: Create ChecklistZoneV2 main composable

**File:** `android/app/src/main/java/com/cwoc/app/ui/screens/editor/zones/ChecklistZoneV2.kt`

**Signature:**
```kotlin
@Composable
fun ChecklistZoneV2(
    checklistJson: String?,
    chitId: String?,
    isNewChit: Boolean,
    autoSaveEnabled: Boolean,
    onChecklistChange: (String?) -> Unit,
    onStatusChange: (String) -> Unit,
    noteText: String?,
    onNoteChange: (String?) -> Unit
)
```

**Layout (top to bottom):**
1. Zone header (non-collapsible):
   - Title: "✅ Checklist" + inline count "(3 / 7)"
   - Data button: `⋮ Data` → opens DataMenuBottomSheet
   - Auto-save indicator: "changes pending" (yellow #b8860b) or "✓ saved" (teal #008080, fades)
   - Spacer
   - Undo button: ↺ (disabled when empty)
   - Redo button: ↻ (disabled when empty)
   - Zone indicator: 🔽 (decorative only)
2. AddItemInput
3. MultiSelectToolbar (when items selected)
4. Unchecked items (Column, no fixed height)
5. CompletedSection

**Key behaviors:**
- Zone header tap does NOTHING (not collapsible)
- Zone fills all available vertical space
- LaunchedEffect loads items from checklistJson on composition

### Task 4: Create AddItemInput composable

**File:** Part of `ChecklistZoneV2.kt` or separate `ChecklistAddItemInput.kt`

**Visual:**
```
┌─────────────────────────────────────────────────────────────┐
│ Add new item (Enter to add)                              ↓  │
└─────────────────────────────────────────────────────────────┘
```

**Styling:**
- Full width, 8dp padding, 16sp font size, Lora font
- Border: 1dp solid Color(0xFF8B4513), corner radius 4dp
- Background: Color(0xFFFDF5E6)
- Text color: Color(0xFF4A2C2A)
- Focus: border → Color(0xFF008080), add 1dp teal shadow

**Behavior:**
- IME Done (Enter): if non-empty → add item at bottom of unchecked, clear input, show flash arrow
- Flash arrow: "↓" at right edge, teal Color(0xFF008080), bold, 1.2em
- Animation: fade in (alpha 0→1) + translateY(0→4dp) over 200ms, hold, fade out over 300ms

### Task 5: Create ChecklistItemRow composable

**File:** `android/app/src/main/java/com/cwoc/app/ui/screens/editor/zones/ChecklistItemRow.kt`

**Layout:**
```
[level*20dp padding] ⠿  ☐  [Markdown text]  📤  ✕  │⋮│
```

**Elements:**
- **Drag handle:** Text("⠿"), opacity 0.8f, ~20sp, padding end 6dp, touch-action none
- **Checkbox:** standard, aligned to first line of text
- **Text:** MarkdownRenderer composable (existing), tap → start inline editing
- **Send icon:** Text("📤"), always visible, ~14sp, tap → send-to-chit
- **Delete icon:** Text("✕"), always visible, color Color(0xFF999999), tap → delete animation
- **Select strip:** 18dp wide Box at end, background Color(0xFF008080).copy(alpha=0.04f), border-start 2dp Color(0xFF008080).copy(alpha=0.2f), contains Text("⋮") at 0.4f alpha

**States:**
- Selected: strip bg solid teal, "✓" white, item bg Color(0xFF008080).copy(alpha=0.06f), 1dp teal outline
- Ghost (completed section): non-interactive, greyed text, no checkbox/drag/send/delete
- Multi-select active: text non-clickable, unselected items not draggable

---

## Wave 4: Feature Composables (parallelizable)

### Task 6: Touch drag reordering + swipe indent/outdent

**File:** `android/app/src/main/java/com/cwoc/app/ui/screens/editor/zones/ChecklistDragHandler.kt`

**Gesture detection on drag handle via `Modifier.pointerInput`:**

```kotlin
detectDragGestures(
    onDragStart = { /* record start position */ },
    onDrag = { change, dragAmount ->
        totalDragX += dragAmount.x
        totalDragY += dragAmount.y
        
        if (!swipeHandled && abs(totalDragX) > 40.dp.toPx() && abs(totalDragX) > abs(totalDragY) * 2) {
            swipeHandled = true
            if (totalDragX > 0) indentSubtree() else outdentSubtree()
        } else if (!swipeHandled) {
            // Vertical drag → find target, show drop indicator
        }
    },
    onDragEnd = {
        if (!swipeHandled && hasTarget) performDrop()
        resetState()
    }
)
```

**Drop position detection:**
- Top third of target → "above" (blue top border indicator)
- Middle third → "on" (nest as child, white bg indicator)
- Bottom third → "below" (blue bottom border indicator)

**Multi-drag:** When multi-select active and dragging selected item → move ALL selected as unit, all show opacity 0.5

**Swipe rules:**
- Swipe right → indent subtree (if level < 4 and valid predecessor exists)
- Swipe left → outdent subtree (if level > 0)
- NO swipe-to-erase. NO swipe-to-delete. Swiping is ONLY for indent/outdent.

### Task 7: Inline editing with keyboard shortcuts

**File:** `android/app/src/main/java/com/cwoc/app/ui/screens/editor/zones/ChecklistInlineEditor.kt`

**Activation:** Tap on item text → replace text span with BasicTextField

**TextField styling:**
- Auto-resize height to content (min ~24dp)
- Border: 1dp Color(0xFF008080)
- Background: transparent
- Inherit font (Lora)

**Keyboard handling (via `onKeyEvent` or `KeyboardActions`):**

| Key | Action |
|-----|--------|
| Enter | Split item at cursor: text before stays, text after → new item below (same level/parent), start editing new item at pos 0 |
| Shift+Enter | Insert literal newline |
| Tab | Indent current item one level |
| Shift+Tab | Outdent current item one level |
| Escape | Cancel editing, revert to pre-edit text |
| Arrow Up (at pos 0) | Navigate to previous unchecked item (cursor at end) |
| Arrow Down (at end) | Navigate to next unchecked item (cursor at pos 0) |

**Per-keystroke:** Every text change → `applyChangeQuiet` (updates model, no undo push)
**On blur:** Save text, exit editing, re-render markdown
**Block multi-select** while editing is active

### Task 8: Check and delete animations

**File:** `android/app/src/main/java/com/cwoc/app/ui/screens/editor/zones/ChecklistAnimations.kt`

**Check animation (3 phases):**
1. 0–100ms: strikethrough text + green flash background `Color(0x0F008000)`
2. 100–250ms: fade alpha → 0 + translateX → 10dp
3. After 250ms: move item to completed section, re-render

```kotlin
// Compose animation approach:
var isChecking by remember { mutableStateOf(false) }
val bgColor by animateColorAsState(if (isChecking) Color(0x0F008000) else Color.Transparent, tween(100))
val alpha by animateFloatAsState(if (isFading) 0f else 1f, tween(150))
val offsetX by animateDpAsState(if (isFading) 10.dp else 0.dp, tween(150))
LaunchedEffect(isChecking) { delay(100); isFading = true; delay(150); moveToCompleted() }
```

**Uncheck:** Immediate move back (no animation)
**Check cascades:** Parent checked → all descendants checked

**Delete animation:**
1. 0–500ms: background → red, alpha → 0
2. After 300ms: remove item + subtree, re-render
3. Push undo state BEFORE animation starts

### Task 9: Completed section with ghost parents

**File:** `android/app/src/main/java/com/cwoc/app/ui/screens/editor/zones/ChecklistCompletedSection.kt`

**Structure:**
```
┌─────────────────────────────────────────────────────────────┐
│ Completed (5)                                          ▶/▼  │
├─────────────────────────────────────────────────────────────┤
│ (ghost parent — greyed, non-interactive)                    │
│   ☑ checked item (full controls)                            │
│   ☑ checked item (full controls)                            │
└─────────────────────────────────────────────────────────────┘
```

**Behavior:**
- Only visible when checked items exist
- Header: "Completed (N)" + toggle (▶ collapsed / ▼ expanded)
- Starts COLLAPSED — user must tap to expand
- Border-top: 1dp Color(0xFFA0522D), margin-top 6dp
- Ghost parents: for each checked item, walk up parent chain; render unchecked ancestors as ghost items (non-interactive, greyed, correct indent)
- Checked items: full controls (drag, send, delete, strip, checked checkbox)
- Dragging between zones flips checked state

### Task 10: Multi-select toolbar

**File:** `android/app/src/main/java/com/cwoc/app/ui/screens/editor/zones/ChecklistMultiSelectToolbar.kt`

**Appears when:** `selectedIds.isNotEmpty()`
**Position:** Below AddItemInput, above items list

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│ 3 selected │ All │ ✓Check │ 🗑Delete │ 📤Move │ → │ ← │ ✕ │
└─────────────────────────────────────────────────────────────┘
```

**Styling:**
- Background: Color(0xFF008080).copy(alpha = 0.08f)
- Border: 1dp Color(0xFF008080).copy(alpha = 0.3f), corner radius 6dp
- FlowRow layout (wraps on narrow), gap 6dp, padding 6dp/10dp

**Buttons:**
| Button | Action |
|--------|--------|
| "N selected" | Display only (teal, bold) |
| All | Select all unchecked items |
| ✓ Check | Mark all selected as checked → clear selection |
| 🗑 Delete | Confirm dialog → delete all selected → clear selection |
| 📤 Move | Open send-to-chit modal → move selected → clear selection |
| → Indent | Indent all selected one level (where valid) |
| ← Outdent | Outdent all selected one level (where valid) |
| ✕ | Clear selection |

### Task 11: Data Menu bottom sheet

**File:** `android/app/src/main/java/com/cwoc/app/ui/screens/editor/zones/ChecklistDataMenu.kt`

**Uses:** `ModalBottomSheet` (Material3)

**Styling:**
- Full width, rounded top corners 12dp
- Scrim/backdrop overlay (30% black)
- Each item: Row (icon + label), min height 44dp, Lora font, full width clickable

**Menu items (in order):**

| Icon | Label | Action |
|------|-------|--------|
| 📋 | Paste as list items | Read clipboard → parseClipboardText → append → undo toast "📋 Pasted N items" |
| 📋 | Copy incomplete to clipboard | Filter unchecked → markdown format → write clipboard → toast "📋 Copied N items" |
| ☑️ | Delete checked items | (only if checked exist) Confirm → remove all checked |
| ☐ | Delete unchecked items | Confirm → remove all unchecked |
| 🧹 | Clean up empty items | Remove blank items (no confirm) |
| → | Move to note | itemsToMarkdown → append to note → clear checklist → undo toast |
| 📤 | Send to another chit | Open chit picker → move all items to target |
| 🖨️ | Print checklist | Share intent with formatted text |
| ⚡ | Auto-save: On/Off | Toggle per-chit override (null → !global → null) |

**Dismiss:** Backdrop tap or item selection

### Task 12: Send-to-chit functionality

**Reuse:** Existing chit search/picker pattern (from Projects zone child chit picker)

**Three entry points:**
1. Per-item send (📤 icon tap): move item + subtree to target
2. Multi-select send (Move button): move all selected to target
3. Bulk send (Data menu → Send to another chit): move entire checklist to target

**Flow:**
1. Open search modal (text input + matching chits list)
2. User picks target chit
3. API: fetch target chit → append items to its checklist → PUT back
4. Remove sent items from current checklist
5. Show confirmation toast
6. On failure: show error toast, don't remove items

### Task 13: Note ↔ checklist conversion

**Move to note (Data menu):**
1. `ChecklistOperationsV2.itemsToMarkdown(items)` → markdown string
2. Append to noteText (with blank line separator if note non-empty)
3. Clear checklist items
4. Show undo toast "📝 Moved checklist to notes"
5. Undo: restore previous items + previous note

**Note to checklist (triggered from Notes zone):**
1. `ChecklistOperationsV2.parseClipboardText(noteText)` → items
2. Append to checklist
3. Clear note
4. Show undo toast "📋 Moved notes to checklist"
5. Undo: restore previous note + previous checklist

**Expose:** `moveNoteToChecklist(noteText: String)` on ViewModel for Notes zone to call

### Task 14: Clipboard operations

**Paste as list items:**
1. `context.getSystemService(ClipboardManager)` → get text
2. If denied: toast "⚠️ Clipboard access denied"
3. `parseClipboardText(text)` → items
4. Append to checklist, push undo
5. Toast "📋 Pasted N items"

**Copy incomplete to clipboard:**
1. Filter unchecked items
2. Format: `"  ".repeat(level) + "- [ ] " + text` per item, joined by newlines
3. Write to clipboard
4. Toast "📋 Copied N items"
5. If no unchecked: toast "⚠️ No incomplete items to copy"

### Task 15: Auto-save with PATCH endpoint

**API addition:**
```kotlin
// In ApiService.kt
@PATCH("api/chits/{id}/checklist")
suspend fun patchChecklist(
    @Path("id") chitId: String,
    @Body body: PatchChecklistRequest
): Response<Unit>

data class PatchChecklistRequest(val checklist: String)
```

**ViewModel auto-save logic:**
```kotlin
private var autoSaveJob: Job? = null

fun triggerAutoSave() {
    if (!isAutoSaveActive() || chitId == null || isNewChit) return
    autoSaveState = AutoSaveState.PENDING
    autoSaveJob?.cancel()
    autoSaveJob = viewModelScope.launch {
        delay(2000)
        autoSaveState = AutoSaveState.SAVING
        val result = repository.patchChecklist(chitId, serialize(items))
        if (result.isSuccess) {
            autoSaveState = AutoSaveState.SAVED
            delay(2000)
            autoSaveState = AutoSaveState.IDLE
        } else {
            autoSaveState = AutoSaveState.FAILED
            onMarkUnsaved()
        }
    }
}
```

**Visual indicators in zone header:**
- PENDING: Text("changes pending", color = Color(0xFFB8860B), fontSize = 12sp)
- SAVED: Text("✓ saved", color = Color(0xFF008080), fontSize = 12sp) with fade-out animation after 2s

### Task 16: Auto-complete checklist integration

**Logic in ViewModel (runs after every check/uncheck/add):**
```kotlin
fun evaluateAutoComplete() {
    if (!autoCompleteEnabled) return
    val nonBlank = items.filter { it.text.isNotBlank() }
    if (nonBlank.isEmpty()) return
    
    val allChecked = nonBlank.all { it.checked }
    if (allChecked && currentStatus != "Complete") {
        onStatusChange("Complete")
    } else if (!allChecked && currentStatus == "Complete") {
        onStatusChange("ToDo")
    }
}
```

- Auto-Complete button stays in Task zone header (no UI change in checklist zone)
- `autoCompleteEnabled` passed as parameter from editor
- `onStatusChange` callback updates the form state

### Task 17: Pending content detection

**In ViewModel:**
```kotlin
fun hasPendingContent(): Boolean {
    return addItemInputText.isNotBlank() || editingItemId != null
}

fun commitPendingContent() {
    if (addItemInputText.isNotBlank()) {
        addItem(addItemInputText.trim())
        addItemInputText = ""
    }
    if (editingItemId != null) {
        // Save current editing text (already in model via applyChangeQuiet)
        editingItemId = null
    }
}
```

**Wire into ChitEditorScreen:**
- Before save: call `commitPendingContent()`
- Before exit: check `hasPendingContent()` → show unsaved changes dialog

---

## Wave 5: Integration Composables (depend on Wave 4)

Tasks 12, 13, 14 are listed above in Wave 4 but depend on the Data Menu (Task 11) being complete.

---

## Wave 6: Integration

### Task 18: Integrate ChecklistZoneV2 into ChitEditorScreen

**In `ChitEditorScreen.kt`:**

Replace:
```kotlin
"checklistSection" -> {
    ChecklistZone(
        checklistJson = formState.checklist,
        onChecklistChange = { viewModel.updateForm(formState.copy(checklist = it)) },
        onUndo = {}
    )
}
```

With:
```kotlin
"checklistSection" -> {
    ChecklistZoneV2(
        checklistJson = formState.checklist,
        chitId = chitId,
        isNewChit = isNewChit,
        autoSaveEnabled = editorSettings.checklistAutosave,
        onChecklistChange = { viewModel.updateForm(formState.copy(checklist = it)) },
        onStatusChange = { viewModel.updateForm(formState.copy(status = it)) },
        noteText = formState.note,
        onNoteChange = { viewModel.updateForm(formState.copy(note = it)) }
    )
}
```

**Also:**
- Remove the "Checklist Auto-Save" toggle from the main editor screen (now in Data menu)
- Remove any collapse/expand logic for checklistSection in mobile zone mode
- Ensure zone fills available space (no height constraints)
- Wire pending content detection into exit/save flow
- Mark old `ChecklistZone.kt` as `@Deprecated("Use ChecklistZoneV2")`

---

## Wave 7: Cleanup

### Task 19: Remove all legacy Android-specific behaviors

**Remove from old ChecklistZone.kt (or verify not present in V2):**
- ❌ `SwipeToDismissBox` — no swipe-to-delete
- ❌ `Icons.Default.ArrowUpward` / `Icons.Default.ArrowDownward` — no move buttons
- ❌ `Icons.Default.FormatIndentIncrease` / `Icons.Default.FormatIndentDecrease` — no indent buttons (swipe only)
- ❌ `EditorZoneHeader` with `onToggle` — no collapse
- ❌ `.height((items.size * 64).coerceAtMost(400).dp)` — no fixed height
- ❌ `IconButton` with `Icons.Default.Add` for adding items — replaced by full-width input
- ❌ Any auto-save toggle on the main editor screen

**Verify in V2:**
- ✅ Drag handle ⠿ for reordering (touch drag)
- ✅ Swipe right/left for indent/outdent only
- ✅ Non-collapsible zone
- ✅ Full available height
- ✅ Auto-save toggle in Data menu only
- ✅ No up/down arrows anywhere

---

## Summary

| Wave | Tasks | Description |
|------|-------|-------------|
| 1 | 1 | Data model + domain operations |
| 2 | 2 | ViewModel (state, undo, multi-select, auto-save) |
| 3 | 3, 4, 5 | Core UI (main composable, input, item row) |
| 4 | 6–17 | All features (parallelizable after wave 3) |
| 5 | — | (12, 13, 14 depend on 11 from wave 4) |
| 6 | 18 | Integration into editor |
| 7 | 19 | Remove legacy |

**Total: 19 tasks across 7 waves.**
