# Technical Design: Android Notes Zone Parity

## Overview

This design brings the Android app's Notes zone in the chit editor to exact visual and behavioral parity with the mobile browser implementation. The existing `NotesZone()` composable (currently inline in `ChitEditorScreen.kt`) will be extracted into a dedicated file and completely rewritten to match the mobile browser's layout, styling, and behavior pixel-for-pixel.

The Notes zone is the 4th zone (index 3) in the editor's zone-at-a-time navigation system. It provides a full markdown editing experience with format toolbar, render toggle, chit link autocomplete, list continuation, and data actions (copy, download, send, move-to-checklist).

## Architecture

The Notes zone follows the existing zone-at-a-time editor pattern established by `DateZone.kt` and `ChecklistZoneV2.kt`. It is a standalone Compose file in the `zones/` directory, rendered by the `when (zoneState.currentZone.id)` dispatch in `ChitEditorScreen.kt`.

**Layer structure:**
- **UI Layer:** `NotesZone.kt` (main), `NotesFormatToolbar.kt`, `NotesMoreMenu.kt`, `ChitLinkAutocomplete.kt`
- **Logic Layer:** `NotesFormatActions.kt` (pure text transforms), `NotesListContinuation.kt` (Enter key handling)
- **Rendering Layer:** Enhanced `MarkdownRenderer.kt` (GFM breaks + highlight extension)
- **Data Layer:** Existing `ChitFormState.note` ↔ `ChitEntity.note` (no changes needed)

The zone communicates with the editor via callbacks (`onNoteChange`, `onMarkDirty`, `onMoveToChecklist`) and reads state from `ChitFormState`. All internal UI state (render mode, menu visibility, autocomplete) is managed locally via `remember` / `mutableStateOf`.

## Components and Interfaces

### NotesZone (Main Composable)

**File:** `android/app/src/main/java/com/cwoc/app/ui/screens/editor/zones/NotesZone.kt`

```kotlin
@Composable
fun NotesZone(
    note: String,
    onNoteChange: (String) -> Unit,
    chitTitle: String,
    chitId: String,
    onMoveToChecklist: ((List<ChecklistItem>) -> Unit)?,
    onMarkDirty: () -> Unit,
    modifier: Modifier = Modifier
)
```

Top-level composable that fills all available vertical space. Column layout: header → toolbar → textarea/rendered. Manages internal `NotesZoneState`. Does NOT collapse/expand (always expanded in mobile zone mode).

### NotesFormatToolbar

**File:** `android/app/src/main/java/com/cwoc/app/ui/screens/editor/zones/NotesFormatToolbar.kt`

```kotlin
@Composable
fun NotesFormatToolbar(
    textFieldValue: TextFieldValue,
    onValueChange: (TextFieldValue) -> Unit,
    onUndo: () -> Unit,
    onRedo: () -> Unit,
    undoEnabled: Boolean,
    redoEnabled: Boolean
)
```

FlowRow layout with 12 buttons matching the web's flex-wrap toolbar. Always visible in edit mode, hidden in render mode.

### NotesMoreMenu

**File:** `android/app/src/main/java/com/cwoc/app/ui/screens/editor/zones/NotesMoreMenu.kt`

```kotlin
@Composable
fun NotesMoreMenu(
    expanded: Boolean,
    onDismiss: () -> Unit,
    onCopy: () -> Unit,
    onDownload: () -> Unit,
    onSend: () -> Unit,
    onMoveToChecklist: () -> Unit
)
```

DropdownMenu positioned below the Data button with 4 action items.

### ChitLinkAutocomplete

**File:** `android/app/src/main/java/com/cwoc/app/ui/screens/editor/zones/ChitLinkAutocomplete.kt`

```kotlin
@Composable
fun ChitLinkAutocomplete(
    query: String,
    chitId: String,
    onSelect: (String) -> Unit,
    onDismiss: () -> Unit
)
```

Popup overlay showing matching chit titles for `[[` link insertion.

### NotesFormatActions

**File:** `android/app/src/main/java/com/cwoc/app/ui/screens/editor/zones/NotesFormatActions.kt`

```kotlin
object NotesFormatActions {
    fun applyBold(value: TextFieldValue): TextFieldValue
    fun applyItalic(value: TextFieldValue): TextFieldValue
    fun applyStrikethrough(value: TextFieldValue): TextFieldValue
    fun applyLink(value: TextFieldValue): TextFieldValue
    fun applyHeading(value: TextFieldValue, level: Int): TextFieldValue
    fun applyBulletList(value: TextFieldValue): TextFieldValue
    fun applyNumberedList(value: TextFieldValue): TextFieldValue
    fun applyBlockquote(value: TextFieldValue): TextFieldValue
    fun applyCode(value: TextFieldValue): TextFieldValue
    fun applyHorizontalRule(value: TextFieldValue): TextFieldValue
}
```

Pure functions that transform `TextFieldValue` with selection-aware markdown insertion.

### NotesListContinuation

**File:** `android/app/src/main/java/com/cwoc/app/ui/screens/editor/zones/NotesListContinuation.kt`

```kotlin
object NotesListContinuation {
    fun processEnterKey(value: TextFieldValue): TextFieldValue?
    fun renumberOrderedList(text: String, fromLineIndex: Int): String
}
```

Enter key handler for auto-continuing list items with break-out behavior.

## Data Models

### NotesZoneState (Internal UI State)

```kotlin
data class NotesZoneState(
    val isRenderMode: Boolean = false,
    val showMoreMenu: Boolean = false,
    val showHeadingDropdown: Boolean = false,
    val chitLinkQuery: String? = null,
    val chitLinkMatches: List<ChitLinkMatch> = emptyList(),
    val chitLinkHighlightIndex: Int = 0
)

data class ChitLinkMatch(
    val id: String,
    val title: String
)
```

### ChecklistItem (for Move-to-Checklist)

```kotlin
data class ChecklistItem(
    val id: String,
    val text: String,
    val level: Int,
    val checked: Boolean,
    val parent: String?
)
```

### Data Flow

```
ChitFormState.note ←→ NotesZone(note, onNoteChange)
                         ↓
                    TextFieldValue (internal, selection-aware)
                         ↓
                    Format actions / list continuation modify TextFieldValue
                         ↓
                    onNoteChange(newText) → updates ChitFormState
                         ↓
                    onMarkDirty() → marks editor unsaved
```

The `note` field is a plain String stored in `ChitEntity.note` and mapped through `ChitFormState.note`. No schema changes needed.

## Error Handling

- **Clipboard failure:** If clipboard write fails, show error toast "Copy failed" and log the exception
- **File download failure:** If file save fails, show error toast with exception message
- **Chit link fetch failure:** If API/DB query fails, silently dismiss the autocomplete dropdown (no error shown to user)
- **Markdown render failure:** If rendering throws, fall back to displaying raw text in a preformatted style
- **Format action on empty selection:** Actions requiring selection (bold, italic, strikethrough, code, blockquote) do nothing when no text is selected — matching web behavior

## Testing Strategy

- Manual visual comparison with mobile browser side-by-side
- Verify each format action produces correct markdown output
- Verify list continuation for all prefix types (bullets, numbers, checkboxes, blockquotes)
- Verify list break-out when Enter pressed on empty prefix line
- Verify auto-render on blur and on load
- Verify back key chain priority (menus → render → exit)
- Verify chit link autocomplete triggers on `[[` and dismisses correctly
- Verify all theme colors match the web spec values
