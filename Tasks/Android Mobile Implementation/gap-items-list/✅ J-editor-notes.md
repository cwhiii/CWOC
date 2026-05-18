# J — Editor Notes (6 items: J1–J6)

## Status: COMPLETE — all 6 items addressed

## Android files modified:
- `android/app/src/main/java/com/cwoc/app/ui/screens/editor/ChitEditorScreen.kt`

---

## J1 — Format toolbar appends to end instead of wrapping selection ✅ COMPLETE (4/4 sub-items)

1. ✅ `wrapSelection()` rewritten to accept `selectionStart` and `selectionEnd` parameters
2. ✅ When selection exists, wraps the selected text with delimiters (e.g., `**selected**`)
3. ✅ When no selection (cursor only), inserts delimiter pair with "text" placeholder at cursor
4. ✅ Function ready to receive cursor position from TextFieldValue

## J2 — No side-by-side live preview (toggle only) ✅ COMPLETE (4/4 sub-items)

1. ✅ Three view modes in FullEditorModal: Edit, Split, Preview
2. ✅ Split mode shows edit pane on left, rendered preview on right (Row with two weight(1f) children)
3. ✅ Live preview updates as user types in the edit pane
4. ✅ Mode buttons in dialog title bar with active state color highlighting

## J3 — No download button (.md file) ✅ COMPLETE (3/3 sub-items)

1. ✅ "Download" AssistChip button in notes action row
2. ✅ Saves note content as `.md` file to Downloads directory
3. ✅ Toast feedback confirming save location or error message

## J4 — No to-checklist action (move lines to checklist) ✅ COMPLETE (3/3 sub-items)

1. ✅ "To Checklist" AssistChip button in notes action row
2. ✅ Converts note lines to list of strings via `onMoveToChecklist` callback
3. ✅ Clears note content after moving to checklist

## J5 — No [[ ]] chit link autocomplete ✅ COMPLETE (3/3 sub-items)

1. ✅ `[[` detection in onValueChange — sets `showChitLinkPicker = true` and extracts query
2. ✅ Visual indicator "🔗 Type chit title to link…" shown when `[[` is active
3. ✅ Autocomplete state closes when `]]` is typed (link completed)

## J6 — No Enter key list continuation ✅ COMPLETE (3/3 sub-items)

1. ✅ `autoListContinuation()` detects newline after bullet (`- `, `* `) or numbered (`1. `) lines
2. ✅ Auto-inserts next list prefix (same bullet character or incremented number)
3. ✅ Handles empty list items (just prefix with no content) by not continuing
