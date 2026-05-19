# Technical Design: Android Checklist Zone Parity

## Components and Interfaces

See Architecture section below for full component diagram and interfaces.

## Data Models

See Data Model section below for `ChecklistItemV2` and state management models.

## Overview

This design replaces the current Android checklist zone implementation (swipe-to-delete, up/down arrows, collapsible zone, fixed-height LazyColumn) with a complete rewrite that matches the mobile browser's checklist zone pixel-for-pixel in behavior and visuals.

**Reference:** `Tasks/Android Mobile Implementation/checklist-zone-mobile-browser-spec.md`

**Current state to replace:**
- `ChecklistZone.kt` — collapsible zone with SwipeToDismissBox, ArrowUpward/ArrowDownward buttons, indent/outdent icon buttons, fixed-height LazyColumn
- `ChecklistOperations.kt` — basic toggle/reorder/parse/serialize with 24dp indent and no parent tracking
- `ChecklistsViewModel.kt` — simple toggle/reorder persistence

**New architecture:** A complete `ChecklistZoneV2` composable backed by a `ChecklistZoneViewModel` that manages undo/redo, multi-select, auto-save, and all operations as described in the requirements.

---

## Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ChitEditorScreen                              │
│  (zone navigation — renders ChecklistZoneV2 for "checklistSection") │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       ChecklistZoneV2                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ ZoneHeader   │  │ AddItemInput │  │ ChecklistItemsList        │  │
│  │ (Data,Undo,  │  │ (Enter→add,  │  │ (unchecked items +       │  │
│  │  Redo,Count) │  │  flash arrow)│  │  completed section)      │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘  │
│  ┌──────────────────────────┐  ┌────────────────────────────────┐  │
│  │ MultiSelectToolbar       │  │ DataMenuBottomSheet             │  │
│  │ (All,Check,Delete,Move,  │  │ (Paste,Copy,Delete,Clean,      │  │
│  │  Indent,Outdent,Clear)   │  │  MoveToNote,Send,Print,Auto)   │  │
│  └──────────────────────────┘  └────────────────────────────────┘  │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    ChecklistZoneViewModel                            │
│  - items: List<ChecklistItemV2>                                     │
│  - undoStack / redoStack                                            │
│  - selectedIds: Set<String>                                         │
│  - editingItemId: String?                                           │
│  - autoSaveState: AutoSaveState                                     │
│  - Operations: add, delete, check, indent, outdent, drag, split...  │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    ChecklistOperationsV2                             │
│  Pure domain functions (immutable transforms):                      │
│  - getSubtree, getChildren, getParent                               │
│  - indent/outdent (with parent reassignment)                        │
│  - reorder (above/below/on with subtree)                            │
│  - toggleCheck (cascades to children)                               │
│  - parseMarkdownToItems, itemsToMarkdown                            │
│  - parseClipboardText                                               │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Data Model

### ChecklistItemV2

Replaces the current `ChecklistItem` data class. Adds `parent` field for hierarchy tracking and renames `indent` to `level` to match the web model.

```kotlin
data class ChecklistItemV2(
    val id: String,           // UUID string, always present
    val text: String,         // Item content (supports markdown)
    val level: Int = 0,       // Nesting depth 0–4 (MAX_INDENT_LEVEL)
    val checked: Boolean = false,
    val parent: String? = null // ID of parent item (null = top-level)
)
```

**Constants:**
```kotlin
const val MAX_INDENT_LEVEL = 4
const val INDENT_PX_PER_LEVEL = 20  // dp per level (matches web's 20px)
```

### Migration from ChecklistItem

The existing `ChecklistOperations.parseChecklist()` already handles both `indent`/`level` field names. The V2 parser will:
1. Read `level` or `indent` from JSON
2. Read `parent` from JSON (new field — null if absent for backward compat)
3. Always generate an `id` if missing (UUID)
4. Cap level at MAX_INDENT_LEVEL (4)

Serialization outputs: `{id, text, level, checked, parent}` — matching the web's format exactly.

---

## State Management

### ChecklistZoneViewModel

A Compose-scoped ViewModel (not Hilt — scoped to the zone's lifecycle within the editor) that manages all checklist state:

```kotlin
class ChecklistZoneViewModel {
    // Core state
    var items by mutableStateOf<List<ChecklistItemV2>>(emptyList())
    
    // Undo/Redo (max 50 snapshots)
    private val undoStack = mutableListOf<String>()  // JSON snapshots
    private val redoStack = mutableListOf<String>()
    val canUndo: Boolean get() = undoStack.isNotEmpty()
    val canRedo: Boolean get() = redoStack.isNotEmpty()
    
    // Multi-select
    var selectedIds by mutableStateOf<Set<String>>(emptySet())
    val isMultiSelectActive: Boolean get() = selectedIds.isNotEmpty()
    var lastSelectedId: String? = null  // anchor for shift-select
    
    // Inline editing
    var editingItemId by mutableStateOf<String?>(null)
    
    // Auto-save
    var autoSaveState by mutableStateOf(AutoSaveState.IDLE)
    private var autoSaveJob: Job? = null
    
    // Counts
    val checkedCount: Int get() = items.count { it.checked }
    val totalCount: Int get() = items.size
}
```

### AutoSaveState

```kotlin
enum class AutoSaveState {
    IDLE,           // No pending changes
    PENDING,        // Changes made, waiting for debounce
    SAVING,         // PATCH in flight
    SAVED,          // Just saved (shows ✓ briefly)
    FAILED          // Save failed, fall back to manual
}
```

---

## UI Components

### 1. ChecklistZoneHeader

Replaces the current `EditorZoneHeader` usage. Non-collapsible on mobile.

```
┌─────────────────────────────────────────────────────────────────┐
│ ✅ Checklist (3/7)  │ [⋮ Data] ─── spacer ─── [↺] [↻] [🔽] │
└─────────────────────────────────────────────────────────────────┘
```

- Title: "✅ Checklist" + inline count "(checked / total)"
- Data button: opens DataMenuBottomSheet
- Undo/Redo buttons: disabled when stack empty
- Zone indicator: 🔽 (decorative only — no collapse action)
- Auto-save indicators: "changes pending" (yellow) / "✓ saved" (teal) appear between Data and Undo

### 2. AddItemInput

Full-width text field at the top of the zone body.

- Placeholder: "Add new item (Enter to add)"
- IME action: Done → creates item, clears input, triggers flash arrow
- Styling: Lora font, 16sp, parchment background, brown border, teal focus ring
- Flash arrow: Animated ↓ at right edge (teal, 1.2em, fade in/out with translate)

### 3. ChecklistItemRow

Each item rendered as a Row composable:

```
┌─────────────────────────────────────────────────────────────────┐
│ [paddingLeft = level*20dp]                                       │
│ ⠿  ☐  [Markdown rendered text]              📤  ✕  │ ⋮ │      │
│ (drag)  (cb)  (text — tap to edit)         (send)(del) (strip)  │
└─────────────────────────────────────────────────────────────────┘
```

- Drag handle: "⠿" text, 0.8 opacity, 1.3em, touch-action none
- Checkbox: standard, aligned to first line
- Text: MarkdownRenderer composable (existing `MarkdownRenderer` component)
- Send icon: "📤" always visible on mobile
- Delete icon: "✕" always visible on mobile
- Select strip: 18dp wide absolute-positioned right edge with "⋮"

### 4. InlineEditingOverlay

When editing is active, the text span is replaced with a `BasicTextField`:
- Auto-sizing height (min 1.6em equivalent)
- Teal border (1dp)
- Transparent background
- Keyboard shortcuts via `onKeyEvent`:
  - Enter → split item
  - Shift+Enter → newline
  - Tab → indent
  - Shift+Tab → outdent
  - Escape → cancel
  - Arrow Up/Down → navigate items

### 5. CompletedSection

Collapsible section below unchecked items:

```
┌─────────────────────────────────────────────────────────────────┐
│ Completed (5)                                              ▶/▼  │
├─────────────────────────────────────────────────────────────────┤
│ (ghost parent at level 0)                                       │
│   (checked item at level 1)                                     │
│   (checked item at level 1)                                     │
└─────────────────────────────────────────────────────────────────┘
```

- Header: "Completed (N)" + toggle icon (▶ collapsed, ▼ expanded)
- Starts collapsed
- Ghost parents: non-interactive, greyed text, correct indent
- Checked items: full controls (drag, send, delete, strip)

### 6. MultiSelectToolbar

Appears below AddItemInput when items are selected:

```
┌─────────────────────────────────────────────────────────────────┐
│ 3 selected │ [All] [✓Check] [🗑Delete] [📤Move] [→] [←] [✕]  │
└─────────────────────────────────────────────────────────────────┘
```

- Teal-tinted background with border
- Wraps on narrow screens
- All buttons use zone-button styling (small, compact)

### 7. DataMenuBottomSheet

Modal bottom sheet with 9 menu items:

```
┌─────────────────────────────────────────────────────────────────┐
│ 📋 Paste as list items                                          │
│ 📋 Copy incomplete to clipboard                                 │
│ ☑️ Delete checked items          (hidden if no checked items)   │
│ ☐ Delete unchecked items                                        │
│ 🧹 Clean up empty items                                         │
│ → Move to note                                                  │
│ 📤 Send to another chit                                         │
│ 🖨️ Print checklist                                              │
│ ⚡ Auto-save: On/Off                                            │
└─────────────────────────────────────────────────────────────────┘
```

- Full-width, fixed to bottom, rounded top corners (12dp)
- Backdrop overlay (30% black)
- Each item: icon + label, 44dp min height, Lora font
- Dismiss on backdrop tap or item selection

---

## Touch Gesture System

### Drag Handle Touch Detection

Uses Compose's `pointerInput` with `detectDragGestures`:

```kotlin
Modifier.pointerInput(item.id) {
    detectDragGestures(
        onDragStart = { offset -> /* record start position */ },
        onDrag = { change, dragAmount ->
            val dx = totalDragX
            val dy = totalDragY
            
            if (!swipeHandled && abs(dx) > 40.dp.toPx() && abs(dx) > abs(dy) * 2) {
                // Horizontal swipe detected → indent/outdent
                swipeHandled = true
                if (dx > 0) indent() else outdent()
            } else if (!swipeHandled) {
                // Vertical drag → reorder
                updateDropIndicator(currentY)
            }
        },
        onDragEnd = {
            if (!swipeHandled) performDrop()
            resetDragState()
        }
    )
}
```

### Drop Position Detection

During vertical drag, determine drop zone by touch Y relative to target item bounds:
- Top third → "above" (blue top border)
- Middle third → "on" (nest as child)
- Bottom third → "below" (blue bottom border)

---

## Animations

### Check Animation (Requirement 8)

```kotlin
// Phase 1: Strikethrough + green flash (0-100ms)
val bgColor by animateColorAsState(
    targetValue = if (isChecking) Color(0x0F008000) else Color.Transparent,
    animationSpec = tween(100)
)
val textDecoration = if (isChecking) TextDecoration.LineThrough else TextDecoration.None

// Phase 2: Fade + slide right (100-250ms)  
val alpha by animateFloatAsState(
    targetValue = if (isFading) 0f else 1f,
    animationSpec = tween(150)
)
val offsetX by animateDpAsState(
    targetValue = if (isFading) 10.dp else 0.dp,
    animationSpec = tween(150)
)

// Phase 3: After 250ms total, move to completed section
LaunchedEffect(isChecking) {
    delay(250)
    moveToCompleted()
}
```

### Delete Animation (Requirement 9)

```kotlin
val bgColor by animateColorAsState(
    targetValue = if (isDeleting) Color.Red else Color.Transparent,
    animationSpec = tween(500)
)
val alpha by animateFloatAsState(
    targetValue = if (isDeleting) 0f else 1f,
    animationSpec = tween(500)
)

LaunchedEffect(isDeleting) {
    delay(300)
    removeItemAndSubtree()
}
```

### Flash Arrow Animation (Requirement 3)

```kotlin
val arrowAlpha by animateFloatAsState(
    targetValue = if (showFlash) 1f else 0f,
    animationSpec = tween(200)
)
val arrowOffsetY by animateDpAsState(
    targetValue = if (showFlash) 4.dp else 0.dp,
    animationSpec = tween(300)
)

LaunchedEffect(showFlash) {
    if (showFlash) {
        delay(600)
        showFlash = false
    }
}
```

---

## Auto-Save System

### Flow

1. Any change → set `autoSaveState = PENDING`, show "changes pending" indicator
2. Start/reset 2-second debounce timer
3. After 2s → set `autoSaveState = SAVING`, call `PATCH /api/chits/{id}/checklist`
4. On success → set `autoSaveState = SAVED`, show "✓ saved" for 2s, then → `IDLE`
5. On failure → set `autoSaveState = FAILED`, mark editor as having unsaved changes

### API Call

```kotlin
suspend fun patchChecklist(chitId: String, items: List<ChecklistItemV2>): Result<Unit> {
    val json = ChecklistOperationsV2.serialize(items)
    val response = apiService.patchChecklist(chitId, PatchChecklistRequest(checklist = json))
    return if (response.isSuccessful) Result.success(Unit) else Result.failure(...)
}
```

---

## Operations (ChecklistOperationsV2)

All operations are pure functions returning new lists:

| Operation | Description |
|-----------|-------------|
| `getSubtree(items, item)` | Returns item + all descendants |
| `getChildren(items, item)` | Returns direct children |
| `getParent(items, item)` | Returns parent item or null |
| `indent(items, item)` | Increases level, sets parent to nearest preceding at level-1 |
| `indentSubtree(items, item)` | Indents item + all descendants |
| `outdent(items, item)` | Decreases level, reassigns following siblings |
| `outdentSubtree(items, item)` | Outdents item + all descendants |
| `toggleCheck(items, item)` | Flips checked, cascades to children |
| `deleteWithSubtree(items, item)` | Removes item + all descendants |
| `splitItem(items, item, cursorPos)` | Splits text at cursor, creates new item below |
| `moveAbove(items, dragged, target)` | Moves subtree before target at target's level |
| `moveBelow(items, dragged, target)` | Moves subtree after target+children at target's level |
| `moveOnto(items, dragged, target)` | Moves subtree as child of target |
| `parseClipboardText(text)` | Parses lines into items (markdown checkboxes, indentation) |
| `itemsToMarkdown(items)` | Converts items to markdown task list format |
| `serialize(items)` | JSON serialization matching web format |
| `parse(json)` | JSON parsing with backward compat |

---

## File Structure

New/modified files:

```
android/app/src/main/java/com/cwoc/app/
├── domain/checklist/
│   ├── ChecklistItem.kt              (existing — kept for backward compat)
│   ├── ChecklistItemV2.kt            (NEW — new data model with parent)
│   ├── ChecklistOperations.kt        (existing — kept for list view)
│   └── ChecklistOperationsV2.kt      (NEW — full operations with hierarchy)
├── ui/screens/editor/
│   ├── ChitEditorScreen.kt           (MODIFIED — use ChecklistZoneV2)
│   └── zones/
│       ├── ChecklistZone.kt          (existing — DEPRECATED, kept temporarily)
│       ├── ChecklistZoneV2.kt        (NEW — main zone composable)
│       ├── ChecklistZoneViewModel.kt (NEW — state management)
│       ├── ChecklistItemRow.kt       (NEW — single item composable)
│       ├── ChecklistInlineEditor.kt  (NEW — inline editing composable)
│       ├── ChecklistCompletedSection.kt (NEW — completed section)
│       ├── ChecklistMultiSelectToolbar.kt (NEW — toolbar)
│       ├── ChecklistDataMenu.kt      (NEW — bottom sheet menu)
│       ├── ChecklistDragHandler.kt   (NEW — touch drag/swipe logic)
│       └── ChecklistAnimations.kt    (NEW — check/delete/flash animations)
└── data/remote/
    └── ApiService.kt                 (MODIFIED — add patchChecklist endpoint)
```

---

## Styling / Theme

All colors and dimensions match the web's CSS variables:

| Web Variable | Android Value | Usage |
|---|---|---|
| `--border-color` (#8b4513) | `Color(0xFF8B4513)` | Input border |
| `--accent-teal` (#008080) | `Color(0xFF008080)` | Focus ring, selection, indicators |
| `--aged-brown-light` (#a0522d) | `Color(0xFFA0522D)` | Drag handle, completed border |
| `--aged-brown-medium` (#8b5a2b) | `Color(0xFF8B5A2B)` | Checked text, menu border |
| `--parchment-light` (#fdf5e6) | `Color(0xFFFDF5E6)` | Input/menu background |
| `--text-color` (#4a2c2a) | `Color(0xFF4A2C2A)` | Input text |
| Indent per level | 20.dp | Item left padding |
| Drag handle opacity | 0.8f | Always visible on mobile |
| Select strip width | 18.dp | Right edge strip |
| Max indent level | 4 | Level cap |
| Undo stack size | 50 | Max snapshots |
| Auto-save debounce | 2000ms | Delay before PATCH |

Font: Lora (already loaded in the app's theme as the primary serif font).

---

## Integration Points

### ChitEditorScreen Changes

Replace the current `ChecklistZone(...)` call with `ChecklistZoneV2(...)`:

```kotlin
"checklistSection" -> {
    ChecklistZoneV2(
        checklistJson = formState.checklist,
        chitId = chitId,
        isNewChit = isNewChit,
        autoSaveEnabled = editorSettings.checklistAutosave,
        onChecklistChange = { json ->
            viewModel.updateForm(formState.copy(checklist = json))
        },
        onStatusChange = { newStatus ->
            viewModel.updateForm(formState.copy(status = newStatus))
        },
        noteText = formState.note,
        onNoteChange = { note ->
            viewModel.updateForm(formState.copy(note = note))
        }
    )
}
```

### Auto-Complete Integration

The Auto-Complete button stays in the Task zone header. The checklist zone exposes a callback `onStatusChange` that the editor uses to update status when auto-complete conditions are met.

### Send-to-Chit Integration

Uses the existing chit search/picker infrastructure (same as used by the Projects zone for adding child chits). Opens a search modal, user picks a target chit, items are moved via API.

---

## Backward Compatibility

- The existing `ChecklistItem` and `ChecklistOperations` are kept for the Checklists list view (`ChecklistsScreen.kt`) which doesn't need the full editor functionality
- The JSON format is backward-compatible: V2 adds `parent` field but reads fine without it
- The server already stores and returns the `parent` field (it's part of the web's data model)
- No Room migration needed — checklist is stored as a JSON string field, not individual columns
