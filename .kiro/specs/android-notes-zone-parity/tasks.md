# Implementation Plan: Android Notes Zone Parity

## Overview

This plan implements the Notes zone in the Android chit editor to exact parity with the mobile browser. Work is divided into 13 tasks progressing from utilities → components → integration → polish.

## Tasks

- [ ] 1. Add theme color constants and create NotesFormatActions utility
  - Add `CwocAccentTeal = Color(0xFF008080)` to `theme/Color.kt`
  - Create `zones/NotesFormatActions.kt` with all markdown format insertion functions
  - Implement `applyBold(value: TextFieldValue): TextFieldValue` — wraps selection in `**...**`
  - Implement `applyItalic(value: TextFieldValue): TextFieldValue` — wraps selection in `_..._`
  - Implement `applyStrikethrough(value: TextFieldValue): TextFieldValue` — wraps selection in `~~...~~`
  - Implement `applyLink(value: TextFieldValue): TextFieldValue` — smart URL detection
  - Implement `applyHeading(value: TextFieldValue, level: Int): TextFieldValue` — prefix current line with `#` × level, strip existing
  - Implement `applyBulletList(value: TextFieldValue): TextFieldValue` — prefix selected/current lines with `- `
  - Implement `applyNumberedList(value: TextFieldValue): TextFieldValue` — prefix with sequential numbers
  - Implement `applyBlockquote(value: TextFieldValue): TextFieldValue` — prefix selected lines with `> `
  - Implement `applyCode(value: TextFieldValue): TextFieldValue` — wraps selection in backticks
  - Implement `applyHorizontalRule(value: TextFieldValue): TextFieldValue` — inserts `\n---\n` at cursor
  - Requirements: 6.1–6.14

- [ ] 2. Create NotesListContinuation utility
  - Create `zones/NotesListContinuation.kt`
  - Implement `processEnterKey(value: TextFieldValue): TextFieldValue?` — returns modified value if handled, null otherwise
  - Detect list prefixes via regex: `^(\s*)([-*+]\s\[[ xX]\]\s|[-*+]\s|\d+[.)]\s|>\s?)`
  - If content after prefix → insert newline + continuation prefix (checkbox always unchecked, numbers increment)
  - If empty after prefix → remove prefix from current line (break out)
  - Preserve leading whitespace on continuation
  - Implement `renumberOrderedList(text: String, fromLineIndex: Int): String`
  - Handle Shift+Enter bypass (return null)
  - Requirements: 10.1–10.10

- [ ] 3. Enhance MarkdownRenderer for GFM breaks and highlight extension
  - Modify `components/MarkdownRenderer.kt` paragraph parsing to treat single `\n` as line break
  - Add `==text==` highlight extension in inline formatting parser
  - Render highlight with yellow background `Color(0xFFFFE033)`, dark text, padding 1dp 3dp, radius 2dp
  - Add basic GFM table support (detect `|` delimited rows, render as grid)
  - Verify existing features still work (headings, bold, italic, links, lists, code, blockquotes, HR)
  - Requirements: 8.1–8.8

- [ ] 4. Create NotesFormatToolbar composable
  - Create `zones/NotesFormatToolbar.kt`
  - FlowRow layout: gap 2dp, padding 4dp, bg rgba(139,90,43,0.06), border 1dp rgba(139,90,43,0.15), radius 4dp
  - 12 buttons in order: Bold(B), Italic(I), Strikethrough(S), Link(🔗), separator, HeadingDropdown(H▾), BulletList(• List), NumberedList(1. List), Blockquote(❝ Quote), Code(⟨⟩), HR(―), spacer, Undo(↺), Redo(↻)
  - Normal buttons: bg `#D4C5A9`, border rgba(139,90,43,0.3), radius 3dp, padding 6dp 8dp, min-width 32dp
  - Undo/Redo: bg `#008080`, color white, border rgba(0,100,100,0.5)
  - Separator: 1dp wide, 20dp tall, brown line
  - HeadingDropdown: DropdownMenu with H1/H2/H3, bg `#FFF8E1`, border, shadow
  - Requirements: 4.1–4.7, 5.1–5.7

- [ ] 5. Create NotesMoreMenu composable
  - Create `zones/NotesMoreMenu.kt`
  - DropdownMenu: bg `#FDF5E6`, border 2dp `#8B5A2B`, radius 6dp, shadow, min-width 200dp
  - 4 items: Copy to clipboard (clipboard icon), Download as file (download icon), Send to another chit (paper-plane icon), Move to checklist (arrow-right icon)
  - Each item: icon 18dp + text, full-width, padding 8dp 14dp, font Lora, color `#1A1208`
  - Pressed state: bg rgba(139,90,43,0.1)
  - Dismiss on outside tap and back press
  - Requirements: 3.1–3.9

- [ ] 6. Create ChitLinkAutocomplete composable
  - Create `zones/ChitLinkAutocomplete.kt`
  - Fetch chits from local Room DB, filter by title containing query (case-insensitive), exclude current chit, limit 8
  - Popup: bg `#FFF8E1`, border 2dp `#8B4513`, radius 6dp, max-height 200dp, shadow, min-width 200dp
  - Items: padding 6dp 10dp, border-bottom 1dp `#E0D4B5`, first highlighted `#F0E6D0`
  - On tap → insert `[[title]]`, position cursor after `]]`
  - Dismiss when query empty, `]]` typed, or back pressed
  - Detection logic: scan text before cursor for unclosed `[[`
  - Requirements: 11.1–11.10

- [ ] 7. Create main NotesZone composable with zone header
  - Create `zones/NotesZone.kt`
  - Zone header: "📝 Notes" title + Full Editor button (no-op) + Data button + spacer + Render toggle
  - Full Editor: expand icon + "Full Editor", zone-button style, tap does nothing
  - Data button: ellipsis-v icon + "Data", toggles NotesMoreMenu
  - Render toggle: eye+"Render" in edit mode, edit+"Edit" in render mode
  - Header layout: flex-start, title shrink 0, actions flex 1 margin-start 16dp
  - Toggle icon "🔼" at end (non-functional)
  - All button labels visible
  - Zone body: Column filling remaining space
  - Zone background: `#FFF8DC`
  - Requirements: 1.1–1.8, 2.1–2.8

- [ ] 8. Implement textarea with full-height layout and key handling
  - BasicTextField with TextFieldValue for selection-aware editing
  - Layout: Modifier.weight(1f).fillMaxWidth(), min-height screen-180dp
  - Font: Lora 16sp, color `#1A1208`, bg `#FDF5E6`, border 1dp `#8B4513`
  - Scrollable when content exceeds viewport
  - Wire onValueChange: detect `[[` for autocomplete, call onNoteChange + onMarkDirty
  - Wire key events: Enter → list continuation, Ctrl+shortcuts → format actions
  - Auto-render on focus loss (if content exists and target ≠ render button)
  - On load: render mode if content exists, edit mode if empty
  - Requirements: 7.1–7.7, 9.3–9.5, 21.1–21.6

- [ ] 9. Implement render toggle and rendered output
  - Render mode: hide textarea + toolbar, show MarkdownRenderer
  - MarkdownRenderer fills space, min-height 4em, padding 0.5em
  - Double-tap rendered output → switch to edit mode
  - Toggle button updates icon/label on state change
  - Auto-render on load with LaunchedEffect
  - Requirements: 9.1–9.7, 8.4–8.6, 20.1–20.4

- [ ] 10. Implement data actions (Copy, Download, Send, Move to Checklist)
  - Copy: ClipboardManager, show "✅" toast for 1200ms
  - Download: filename from chitTitle (non-alphanumeric → `_`, lowercase, `.md`), save via share intent or MediaStore
  - Send: open chit search dialog, append note to target chit via API
  - Move to checklist: parse lines (markdown checkboxes, bullets, numbers, indentation), convert to ChecklistItem list, call onMoveToChecklist, clear note, show undo Snackbar
  - All actions close more menu first
  - Requirements: 13.1–13.5, 14.1–14.4, 15.1–15.5, 16.1–16.7

- [ ] 11. Implement keyboard shortcuts and back key behavior
  - onKeyEvent: detect Ctrl+B/I/K/E, Ctrl+Shift+X/7/8/./1/2/3/- → trigger format actions
  - Consume key event when shortcut detected
  - BackHandler with priority chain: more menu → heading dropdown → chit link dropdown → edit-to-render → allow back
  - Requirements: 17.1–17.11, 18.1–18.6

- [ ] 12. Integrate NotesZone into ChitEditorScreen
  - Remove existing inline `NotesZone()` from `ChitEditorScreen.kt`
  - Import new `NotesZone` from `zones/NotesZone.kt`
  - Wire in `when (zoneState.currentZone.id)` block for `"notesSection"`
  - Wire onMoveToChecklist to update formState.checklist
  - Wire onMarkDirty to editor's unsaved state
  - Verify zone empty detection, zone navigation, starting zone from Notes tab
  - Requirements: 22.1–22.3, 23.1–23.6

- [ ] 13. Visual polish and parchment theme verification
  - Verify all colors match spec values
  - Verify Lora font throughout
  - Verify touch targets (32dp toolbar, 44dp general)
  - Verify toolbar wraps on narrow viewports
  - Verify rendered markdown readability (dark text on parchment)
  - Compare side-by-side with mobile browser, fix discrepancies
  - Requirements: 19.1–19.8

## Task Dependency Graph

```json
{
  "waves": [
    {"tasks": ["1", "2", "3", "5", "6"]},
    {"tasks": ["4"]},
    {"tasks": ["7"]},
    {"tasks": ["8", "9", "10", "11"]},
    {"tasks": ["12"]},
    {"tasks": ["13"]}
  ]
}
```

Tasks 1–3, 5, 6 can be done in parallel (wave 1). Task 4 (Toolbar) depends on Task 1 (FormatActions). Task 7 (NotesZone) depends on Tasks 4, 5. Tasks 8–11 depend on Task 7. Task 12 (Integration) depends on 8–11. Task 13 (Polish) depends on 12.

## Notes

- No new external libraries needed — uses existing MarkdownRenderer (enhanced) and Compose primitives
- No Room schema changes — `note` field already exists in ChitEntity
- The fullscreen modal is intentionally blocked on mobile (zone fills screen)
- Live Preview mode (side-by-side) is desktop-only and not implemented here
