# Checklist Zone — Mobile Browser Complete Specification

This document describes the **exact** behavior, visuals, and interactions of the Checklist Zone in the CWOC chit editor as rendered in the mobile browser. This spec is authoritative — an implementation matching this spec would be visually and behaviorally identical to the web version.

---

## 1. Zone Structure & Layout

### 1.1 Zone Container
- The checklist zone is a `zone-container` div with id `checklistSection`
- It has a **zone header** and a **zone body** (`#checklistContent`)

### 1.2 Zone Header
- Contains the zone title: `✅ Checklist` (emoji + text)
- Title includes an inline count display: `(checked / total)` e.g. `(3 / 7)` — appears after the title text in smaller font (0.85em), 80% opacity
- Contains a `.zone-actions` area with these controls (left to right):
  1. **Data menu button** — ellipsis icon (`fa-ellipsis-v`) + "Data" label (label hidden on narrow screens via `.hideWhenNarrow`)
  2. **Spacer** — pushes remaining items to the right
  3. **Undo button** — `↺` character, class `zone-button notes-undo-redo`, disabled when undo stack is empty
  4. **Redo button** — `↻` character, class `zone-button notes-undo-redo`, disabled when redo stack is empty
  5. **Zone toggle icon** — `🔽` emoji (collapse/expand indicator)

### 1.3 Mobile Zone Mode Behavior
- On mobile (≤768px), the editor enters "mobile zone mode"
- In this mode, zones are **NOT collapsible** — tapping the zone header does nothing
- Each zone fills the full screen height; user swipes left/right between zones
- The zone header becomes a sticky navigation bar at the top showing the current zone name
- A zone list overlay (tap zone name) lets the user jump to any zone
- Zones that are empty appear greyed out in the zone list

### 1.4 Zone Body
- Contains the `#checklist-container` div where all checklist items render
- The container uses full available width with no artificial height constraints
- No collapse controls exist within the zone body itself

---

## 2. Add New Item Input

### 2.1 Input Field
- A text `<input>` at the **top** of the checklist container (before all items)
- Placeholder text: `"Add new item (Enter to add)"`
- Class: `checklist-input`
- Full width, 8px padding, 16px font size, inherits font family (Lora)
- Border: 1px solid `var(--border-color, #8b4513)`, border-radius 4px
- Background: `var(--input-bg, #fdf5e6)`
- Text color: `var(--text-color, #4a2c2a)`

### 2.2 Focus State
- On focus: border-color changes to `var(--accent-teal, #008080)`, box-shadow `0 0 0 1px rgba(0, 128, 128, 0.25)`
- When debounce is pending: additional class `debounce-pending` adds `box-shadow: 0 0 0 2px rgba(0, 128, 128, 0.15)`

### 2.3 Input Behavior
- **Enter key**: If input has non-empty text, creates a new item at the bottom of the unchecked list, clears the input, and flashes a `↓` arrow animation at the right edge of the input
- **Escape key**: Triggers the editor's cancel/exit flow (same as pressing the back button)
- **Cmd/Ctrl+Z**: Triggers checklist-level undo
- **Cmd/Ctrl+Shift+Z**: Triggers checklist-level redo
- **Markdown formatting hotkeys** (Cmd+B, Cmd+I, etc.): Apply formatting to selected text in the input

### 2.4 Flash Arrow Animation
- When an item is added, a `↓` arrow appears at the right edge of the input
- Positioned absolutely: `right: 10px`, vertically centered
- Color: `var(--accent-teal, #008080)`, font-size 1.2em, bold
- Animates: fades in (opacity 0→1) with slight downward translate, then fades out after a brief moment

---

## 3. Checklist Items (Unchecked)

### 3.1 Item Structure
Each unchecked item is a `div.checklist-item` with this internal structure:
```
┌─────────────────────────────────────────────────────────────────┐
│ ⠿  ☐  Item text content here                    📤  ✕  │ ⋮ │
│ (drag)  (cb)  (text-wrapper)                   (send)(del) (strip)│
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Drag Handle
- Character: `⠿` (6-dot braille pattern)
- Class: `checklist-drag-handle`
- Flex: `0 0 auto`, cursor: grab (grabbing when active)
- Color: `var(--aged-brown-light, #a0522d)`, font-size 1.2em, line-height 1.4
- Opacity: 0.6 normally, 1.0 on hover (color darkens to `var(--aged-brown-dark, #4a2c2a)`)
- On mobile: opacity 0.8, font-size 1.3em, padding 0 6px 0 0 (always visible for touch)
- `touch-action: none` to prevent scroll interference

### 3.3 Checkbox
- Standard HTML checkbox input
- Flex: `0 0 auto`, no padding, auto width
- Margin: `3px 0 0 0` (aligns with first line of text)
- Tapping toggles the item's checked state (triggers check animation, see §6)

### 3.4 Text Wrapper & Text Display
- `.text-wrapper`: flex 1, min-width 0, margin-left 6px, cursor text
- `.checklist-text`: display block, white-space pre-wrap, word-break break-word, cursor text
- Text is rendered as **markdown** via `marked.js`:
  - Single-line items: outer `<p>` wrapper is stripped for compactness
  - Multi-line items: full block-level rendering (headers, lists, blockquotes)
  - Links get `tabindex="-1"` to prevent focus interference
  - Inline styles: bold, italic, strikethrough, code, images (max-height 1.4em)
  - Code blocks get subtle brown-tinted background
  - Links colored `var(--accent-teal, #008080)` with underline
- Tapping anywhere on the text or text-wrapper starts inline editing

### 3.5 Send Icon
- Character: `📤`
- Class: `checklist-send-icon`
- Font-size 0.85em, opacity 0.7, padding 2px 4px, border-radius 3px
- **Desktop**: hidden by default, visible on item hover
- **Mobile (pointer: coarse)**: always visible
- On hover: opacity 1, background `rgba(139, 90, 43, 0.1)`
- Tapping opens the "Send to another chit" search modal

### 3.6 Delete Icon (Trash)
- Character: `✕`
- Class: `trash-icon`
- Font-size 14px, color #999, cursor pointer, padding 0 4px
- **Desktop**: hidden by default, visible on item hover
- **Mobile (pointer: coarse)**: always visible
- On hover: color changes to `#a33`
- Tapping triggers delete animation (see §7)

### 3.7 Multi-Select Strip
- A thin vertical strip on the **right edge** of every item
- Class: `checklist-select-strip`
- Position absolute, right 0, top 0, bottom 0, width 18px
- Background: `rgba(0, 128, 128, 0.04)`, border-left: `2px solid rgba(0, 128, 128, 0.2)`
- Contains a `⋮` pseudo-element (::after) in teal at 40% opacity
- On hover: background intensifies, border-left darkens
- When selected: background becomes solid teal, shows `✓` in white instead of `⋮`
- Tapping the strip toggles that item's selection (enters multi-select mode)
- Shift+tap on strip: range-selects from last anchor to this item

### 3.8 Indentation
- Items can be nested up to **4 levels deep** (MAX_INDENT_LEVEL = 4)
- Each level adds `20px` of left padding to the `.left-container`
- Parent-child relationships are tracked via `parent` field (ID reference)
- Visual indentation is purely via padding — no tree lines or connectors

### 3.9 Item Positioning
- Items are rendered in list order (array index order)
- Unchecked items appear between the input and the completed section
- Each item has `position: relative` and `padding-right: 20px` (space for select strip)
- Item padding: `4px 0` (mobile: `4px 2px`)
- Display: flex, align-items: flex-start

---

## 4. Inline Editing

### 4.1 Activation
- Tap on the `.checklist-text` span or anywhere in the `.text-wrapper`
- Also activates when tapping empty space in the `.left-container`
- Does NOT activate when in multi-select mode

### 4.2 Textarea Behavior
- The text span is hidden (`display: none`) and a `<textarea>` is inserted in its place
- Class: `checklist-edit-input`
- Styling: display block, width 100%, box-sizing border-box, no padding/margin
- Border: `1px solid var(--accent-teal, #008080)`, border-radius 3px
- Background transparent, inherits font size/family/line-height/color
- Auto-resizes height to content (min-height 1.6em)
- The item's `draggable` attribute is set to `false` during editing

### 4.3 Cursor Positioning
- When activated by a click/tap, the cursor is positioned at the character closest to the click X coordinate
- Uses canvas text measurement to determine character position
- When activated programmatically (e.g., after Enter splits an item), cursor goes to position 0 or end as appropriate

### 4.4 Per-Keystroke Auto-Save
- Every `input` event on the textarea updates `item.text` immediately
- Calls `_notifyChangeQuiet()` which updates the count and fires the onChange callback
- This does NOT push to the undo stack (that happens on blur/finish)

### 4.5 Keyboard Shortcuts During Editing

| Key | Action |
|-----|--------|
| **Enter** | Splits the item at cursor position: text before cursor stays in current item, text after cursor becomes a new item inserted below. New item inherits same level and parent. Editing immediately starts on the new item with cursor at position 0. |
| **Shift+Enter** | Inserts a literal newline in the textarea (multi-line item) |
| **Escape** | Cancels editing without saving changes (reverts to pre-edit text) |
| **Tab** | Indents the current item one level (if valid — must have a preceding item at same or higher level, and not exceed MAX_INDENT_LEVEL) |
| **Shift+Tab** | Outdents the current item one level (if level > 0) |
| **Cmd/Ctrl+[** | Outdents single item (same as Shift+Tab) |
| **Cmd/Ctrl+]** | Indents single item (same as Tab) |
| **Cmd/Ctrl+Shift+(** | Outdents item AND all its descendants (entire subtree) |
| **Cmd/Ctrl+Shift+)** | Indents item AND all its descendants (entire subtree) |
| **Cmd/Ctrl+Z** | First tries browser-level undo in the textarea; if nothing to undo, performs checklist-level undo |
| **Cmd/Ctrl+Shift+Z** | Browser-level redo in the textarea |
| **Arrow Up** | If cursor is at position 0, navigates to the previous unchecked item (cursor at end) |
| **Arrow Down** | If cursor is at end of text, navigates to the next unchecked item (cursor at position 0) |
| **Cmd+B, Cmd+I, etc.** | Markdown formatting hotkeys (bold, italic, etc.) applied to selected text |

### 4.6 Finish Editing
- Triggered by `blur` event on the textarea (tap elsewhere, tab away)
- Saves the current textarea value as the item's text
- Re-enables `draggable` on the item element
- Removes the textarea, shows the text span again
- Re-renders the markdown in the text span
- Empty items are NOT auto-removed (use "Clean up empty items" from Data menu)

---

## 5. Drag & Drop Reordering

### 5.1 Mouse Drag (Desktop)
- Each item has `draggable="true"`
- Dragging starts on `dragstart` — item gets `opacity: 0.5` class
- Drop zones are indicated by CSS classes on the target item:
  - **Top third** of target: `drag-over-above` — blue `border-top: 2px solid blue`
  - **Bottom third** of target: `drag-over-below` — blue `border-bottom: 2px solid blue`
  - **Middle third** of target: `drag-over-on` — white background (nesting: dropped item becomes child of target)
- On drop:
  - "above": item moves to same level as target, inserted before target
  - "below": item moves to same level as target, inserted after target (and after target's children)
  - "on": item becomes a child of target (level = target.level + 1), inserted after target's last descendant
- The entire subtree (item + all descendants) moves together
- If dropped item crosses between unchecked/checked zones, its checked state updates to match

### 5.2 Touch Drag (Mobile)
- Uses `enableTouchDrag()` from `shared-touch.js`
- Touch on the drag handle initiates drag
- **Horizontal swipe detection** (threshold: 40px horizontal, must be >2x vertical movement):
  - **Swipe right**: Indents item + subtree one level (if valid)
  - **Swipe left**: Outdents item + subtree one level (if level > 0)
  - Once a swipe is detected, vertical drag is cancelled
- **Vertical drag** (if no swipe detected):
  - Uses `document.elementFromPoint()` to find the item under the touch point
  - Same drop indicator logic as mouse drag (above/below/on)
  - On touch end, performs the same drop logic as mouse drag

### 5.3 Multi-Drag
- When in multi-select mode and dragging a selected item:
  - ALL selected items move as a unit
  - All selected items get `dragging` class (opacity 0.5)
  - Items maintain their relative order and levels
  - Drop positions: "above" inserts all before target, "below" inserts all after target+children, "on" adjusts all levels relative to target

---

## 6. Check Animation

When an item is checked:
1. Item gets class `checklist-checking`:
   - Text gets `text-decoration: line-through`, color fades to `var(--aged-brown-medium, #8b5a2b)`
   - Item background briefly flashes `rgba(0, 128, 0, 0.06)` (subtle green)
2. After 100ms, item gets class `checklist-checking-fade`:
   - Opacity transitions to 0, translateX(10px) — slides right and fades
   - Transition duration: 150ms ease
3. After another 150ms, the item is moved to the Completed section and re-rendered

When an item is unchecked (from the completed section):
- Item immediately moves back to the unchecked list (no reverse animation)
- If the item had children, they all become unchecked too

---

## 7. Delete Animation

When the trash icon is tapped:
1. Item element gets class `deleting`:
   - Background transitions to red (`background-color: red !important`)
   - Opacity transitions to 0 (`opacity: 0 !important`)
   - Transition duration: 500ms ease
2. After 300ms, the item and ALL its descendants are removed from the items array
3. The checklist re-renders
4. An undo state is pushed before deletion (so Ctrl+Z can restore)

---

## 8. Completed Section

### 8.1 Structure
- A separate container below all unchecked items
- Only visible when there are checked items (hidden via `display: none` otherwise)
- Has a collapsible header with:
  - "Completed" title (h3, font-size 0.95em)
  - Count in parentheses: `(N)` where N = number of checked items
  - A spacer (flex: 1)
  - Toggle icon: `▶` when collapsed, `▼` when expanded
- Border-top: `1px solid var(--aged-brown-light, #a0522d)`, margin-top 6px, padding-top 6px
- **Starts collapsed** — user must tap header to expand

### 8.2 Completed Items
- Rendered as `div.completed-checklist-item` (same structure as unchecked items)
- Checkbox is checked
- All the same controls (drag handle, send icon, trash icon, select strip)
- Can be dragged back to the unchecked zone (checked state flips)

### 8.3 Ghost Parents
- When a checked item has an unchecked parent (or grandparent, etc.), those ancestors appear as "ghost" items in the completed section
- Rendered as `div.ghost-checklist-item` — provides structural context
- Ghost items are NOT interactive (no checkbox toggle, no editing)
- They show the parent's text at the correct indent level so the user understands the hierarchy

---

## 9. Multi-Select Mode

### 9.1 Entering Multi-Select
- **Ctrl/Cmd+Click** on any item row: toggles that item's selection
- **Tap the select strip** (right edge ⋮): toggles that item's selection
- **Shift+Click** (or Shift+tap strip): range-selects from the last anchor to the clicked item
- Once any item is selected, multi-select mode is active

### 9.2 Visual Indicators
- Selected items get class `checklist-multi-selected`:
  - Background: `rgba(0, 128, 128, 0.06)`
  - Border-radius: 4px
  - Outline: `1px solid rgba(0, 128, 128, 0.2)`
- The select strip on selected items: solid teal background, white `✓` instead of `⋮`
- Container gets class `checklist-multiselect-active`:
  - All item text gets `pointer-events: none` (no editing)
  - `user-select: none` on all items
  - Only selected items are `draggable="true"`; unselected items are `draggable="false"`
  - Drag handles on selected items: `pointer-events: auto`, cursor grab, opacity 1, teal color

### 9.3 Multi-Select Toolbar
- Appears below the add-item input when items are selected
- Class: `checklist-multiselect-toolbar`
- Styling: flex, align-items center, gap 6px, padding 6px 10px, margin 6px 0
- Background: `rgba(0, 128, 128, 0.08)`, border: `1px solid rgba(0, 128, 128, 0.3)`, border-radius 6px
- Wraps on narrow screens (`flex-wrap: wrap`)

**Toolbar buttons (left to right):**

| Button | Icon/Text | Action |
|--------|-----------|--------|
| Count | "N selected" | Display only (teal, bold, 0.85em) |
| All | "All" | Selects all unchecked items |
| Check | `fa-check` + "Check" | Marks all selected items as checked (moves to completed) |
| Delete | `fa-trash` + "Delete" | Confirms via `cwocConfirm`, then deletes all selected items |
| Move | `fa-paper-plane` + "Move" | Opens send-to-chit modal for batch move |
| Indent | `fa-indent` | Indents all selected items one level (where valid) |
| Outdent | `fa-outdent` | Outdents all selected items one level (where valid) |
| Clear | "✕" | Clears selection, exits multi-select mode |

All buttons use class `zone-button` with font-size 0.8em, padding 3px 8px.

### 9.4 Exiting Multi-Select
- Press **Escape**: clears all selections, exits multi-select mode (captured in capture phase, stops propagation)
- Tap the **✕** button in the toolbar
- After performing a bulk action (Check, Delete, Move): selection is cleared automatically

---

## 10. Undo / Redo

### 10.1 Stack
- Maximum 50 undo states
- Each state is a JSON snapshot of all items: `[{id, text, level, checked, parent}, ...]`
- Duplicate consecutive states are not pushed
- Redo stack is cleared whenever a new action pushes to undo

### 10.2 When States Are Pushed
- Before any structural change: add item, delete item, check/uncheck, drag-drop, indent/outdent, clear checked, multi-select actions
- NOT pushed on per-keystroke text edits (those are quiet notifications)
- Pushed on blur/finish of inline editing (captures the final text state)

### 10.3 Undo/Redo Buttons
- In the zone header (right side of zone-actions)
- Undo: `↺`, Redo: `↻`
- Class: `zone-button notes-undo-redo`
- Disabled (greyed out) when respective stack is empty
- Click triggers undo/redo: restores the snapshot, re-renders, updates count

### 10.4 Keyboard Undo During Editing
- **Cmd/Ctrl+Z** in the textarea: first tries browser-level undo (within the textarea)
- If browser has nothing to undo (textarea value unchanged after `document.execCommand('undo')`), falls back to checklist-level undo
- **Cmd/Ctrl+Shift+Z** in the textarea: browser-level redo only

---

## 11. Data Menu (More Menu)

### 11.1 Trigger
- The "Data" button (ellipsis icon) in the zone header
- Clicking opens a dropdown menu; clicking again or clicking outside closes it

### 11.2 Menu Styling
- Class: `zone-more-menu`
- Position: absolute, below the button (top: 100%, right: 0)
- Background: `var(--parchment-light, #fdf5e6)`
- Border: `2px solid var(--aged-brown-medium, #8b5a2b)`, border-radius 6px
- Box-shadow: `0 4px 12px rgba(0, 0, 0, 0.2)`
- Padding: 6px 0, min-width 200px
- Buttons: full width, flex row, gap 8px, padding 8px 14px, Lora font 0.9em
- Button hover: `background: rgba(139, 90, 43, 0.1)`
- Icons: 18px wide, centered, flex-shrink 0

### 11.3 Mobile Menu Styling
- On mobile (in `mobile-zone-mode`): menu becomes a **bottom sheet**
- Position: fixed, bottom 0, left 0, right 0, width 100%
- Border-radius: `12px 12px 0 0` (rounded top corners)
- Box-shadow: `0 -4px 16px rgba(0, 0, 0, 0.25)`
- z-index: 2000
- Padding: 12px 0
- Buttons: padding 12px 16px, min-height 44px, font-size 1em
- A backdrop overlay (`.mobile-menu-backdrop`) covers the rest of the screen with `rgba(0, 0, 0, 0.3)`

### 11.4 Menu Items (in order)

| Icon | Label | Action |
|------|-------|--------|
| `fa-paste` | Paste as list items | Reads clipboard text, parses each line as a checklist item (respects markdown checkbox format, indentation, list markers). Shows undo toast. |
| `fa-clipboard` | Copy incomplete to clipboard | Copies all unchecked items as markdown checklist lines (`- [ ] text` with 2-space indent per level) to clipboard. Shows count toast. |
| `fa-check-square` | Delete checked items | Only visible when checked items exist. Confirms via `cwocConfirm` ("Delete N checked items?"), then removes all checked items. |
| `fa-square` | Delete unchecked items | Confirms via `cwocConfirm` ("Delete N unchecked items?"), then removes all unchecked items. |
| `fa-broom` | Clean up empty items | Removes all items with empty/whitespace-only text. No confirmation needed. |
| `fa-arrow-right` | Move to note | Converts all checklist items to markdown task list format (`- [ ] text` / `- [x] text` with indentation) and appends to the Notes field. Clears the checklist. Shows undo toast. |
| `fa-paper-plane` | Send to another chit | Opens the send-content modal to move the entire checklist to another chit. |
| `fa-print` | Print checklist | Opens a print-friendly view of the checklist items. |
| `fa-bolt` | Auto-save: On/Off | Toggles per-chit checklist autosave override. Cycles: use global → force opposite of global → back to global. |

---

## 12. Checklist Auto-Save

### 12.1 Behavior
- When enabled (global setting + per-chit override), checklist changes are auto-saved via `PATCH /api/chits/{id}/checklist` after a **2-second debounce**
- Only works for existing chits (not new unsaved chits)
- On change: immediately shows "changes pending" indicator (yellow text, 0.75em, color `#b8860b`)
- On successful save: hides pending indicator, shows "✓ saved" indicator (teal text, 0.75em, color `#008080`) that fades out after 2 seconds
- On failure: falls back to marking the save button as unsaved (manual save required)

### 12.2 Auto-Save Toggle (in Data Menu)
- Shows current state: "Auto-save: On" or "Auto-save: Off" with "(chit)" suffix when overridden
- Icon: `fa-bolt` when on, `fa-ban` when off
- Opacity: full when on, 0.6 when off

---

## 13. Auto-Complete Checklist

### 13.1 Button Location
- The Auto-Complete button lives in the **Task zone header** (NOT the Checklist zone header)
- ID: `autoCompleteChecklistBtn`
- Class: `zone-button zone-button-conditional`
- Always visible (not restricted to project children)

### 13.2 States
- **Off**: icon `fa-check-double` + "Auto-Complete", opacity 0.6, no active class
- **On**: icon `fa-check-double` + "Auto-Complete: On", full opacity, class `zone-button-active`
- Clicking toggles between on/off
- Per-chit setting saved with the chit data (`auto_complete_checklist` field)

### 13.3 Behavior When Enabled
- Every time a checklist item is checked/unchecked, evaluates:
  - If ALL non-blank items are checked AND all prerequisites are complete → sets status to "Complete"
  - If any item becomes unchecked or a new unchecked item is added → reverts status to "ToDo"
- Also checks prerequisite chits (if any) — won't auto-complete if prereqs aren't done

---

## 14. Send to Another Chit

### 14.1 Per-Item Send
- Tap the `📤` icon on any item
- Opens a search modal where user can search for a target chit
- The item (and its entire subtree of children) is moved to the target chit's checklist
- After sending, the item is removed from the current checklist

### 14.2 Multi-Select Send (Move)
- From the multi-select toolbar, tap "Move"
- Opens the same search modal
- All selected items are moved as a batch to the target chit

### 14.3 Bulk Send (Data Menu → Send to another chit)
- Opens a content-send modal for the entire checklist
- Moves ALL checklist items to the target chit

---

## 15. Note ↔ Checklist Conversion

### 15.1 Note → Checklist (from Notes zone header)
- Button in the Notes zone header triggers `_noteToChecklistFromHeader()`
- Each non-empty line of the note becomes a checklist item
- Parsing rules:
  - `- [ ] text` or `- [x] text` → recognized as markdown checklist (preserves checked state)
  - `- text` or `* text` → list marker stripped, becomes unchecked item
  - `1. text` or `1) text` → numbered list marker stripped
  - Indentation detected: 4 spaces or 1 tab = 1 level, 2 spaces = 1 level
  - Parent assignment based on levels
- Note field is cleared after conversion
- Shows undo toast: "📋 Moved notes to checklist" with Undo button

### 15.2 Checklist → Note (Data Menu → Move to note)
- Each item becomes a markdown task list line: `- [ ] text` or `- [x] text`
- Indentation: 2 spaces per level
- Appended to existing note content (with blank line separator)
- Checklist is cleared after conversion
- Shows undo toast: "📝 Moved checklist to notes" with Undo button

---

## 16. Clipboard Operations

### 16.1 Paste as List Items (Data Menu)
- Reads clipboard text via `navigator.clipboard.readText()`
- Same parsing logic as Note → Checklist (markdown checkboxes, list markers, indentation)
- Items are appended to the end of the existing checklist
- Shows undo toast: "📋 Pasted N items"
- If clipboard access is denied: shows warning toast "⚠️ Clipboard access denied"

### 16.2 Copy Incomplete to Clipboard (Data Menu)
- Copies all unchecked items as markdown checklist lines
- Format: `  - [ ] text` (2 spaces per indent level)
- Shows toast: "📋 Copied N items"
- If no incomplete items: shows "⚠️ No incomplete items to copy"

---

## 17. Print Checklist

- Triggered from Data Menu → Print checklist
- Opens a print-friendly view (via `_printChecklist()` in `shared.js`)
- Shows all items with their hierarchy, checked/unchecked state
- If no items exist: shows info toast "No checklist items to print."

---

## 18. Pending Content Detection

### 18.1 `hasPendingContent()`
- Returns `true` if:
  - The add-item input has non-empty text, OR
  - An item is currently being inline-edited
- Used by the editor's exit/save flow to warn about uncommitted content

### 18.2 `commitPendingContent()`
- If the input has text: creates a new item from it, clears the input
- If an item is being edited: saves the textarea value as the item's text
- Returns `true` if anything was committed
- Called before save/exit to ensure nothing is lost

---

## 19. CSS Variables & Theme

The checklist zone uses these CSS variables (defined in editor.css / shared-editor.css):

| Variable | Default | Usage |
|----------|---------|-------|
| `--border-color` | `#8b4513` | Input border, container border |
| `--zone-body-bg` | (parchment tone) | Container background |
| `--input-bg` | `#fdf5e6` | Input field background |
| `--text-color` | `#4a2c2a` | Input text color |
| `--accent-teal` | `#008080` | Focus rings, selection highlights, multi-select |
| `--aged-brown-light` | `#a0522d` | Drag handle color, completed section border |
| `--aged-brown-medium` | `#8b5a2b` | Checked text color, menu border |
| `--aged-brown-dark` | `#4a2c2a` | Drag handle hover, section title |
| `--parchment-light` | `#fdf5e6` | Menu background |
| `--danger-red` | (red tone) | Delete button background |

---

## 20. Data Model

### 20.1 Item Object
```json
{
  "id": "item-abc123def",
  "text": "Item text content (supports markdown)",
  "level": 0,
  "checked": false,
  "parent": null
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique ID, format `item-` + 9 random alphanumeric chars |
| `text` | string | Item content, can contain markdown, newlines (Shift+Enter) |
| `level` | integer | Indent level, 0-4 (MAX_INDENT_LEVEL = 4) |
| `checked` | boolean | Whether the item is completed |
| `parent` | string\|null | ID of the parent item (for hierarchy), null if top-level |

### 20.2 Hierarchy Rules
- `level` determines visual indentation (level × 20px padding)
- `parent` tracks the logical parent for subtree operations
- When indenting: parent is set to the nearest preceding item at `level - 1`
- When outdenting: parent is updated, and following former siblings may be reassigned
- Children inherit checked state when parent is checked/unchecked
- Deleting an item deletes its entire subtree (all descendants)
- Dragging an item moves its entire subtree

### 20.3 API
- Full save: `PUT /api/chits/{id}` with `checklist` field as JSON array
- Auto-save: `PATCH /api/chits/{id}/checklist` with `{checklist: [...]}` body
- The checklist array is stored as a JSON string in SQLite

---

## 21. Interaction Summary Table

| Gesture/Action | Mobile Browser Behavior |
|----------------|------------------------|
| Tap item text | Start inline editing |
| Tap checkbox | Toggle checked (with animation) |
| Tap drag handle + drag vertically | Reorder item (touch drag) |
| Swipe item right (>40px) | Indent item + subtree |
| Swipe item left (>40px) | Outdent item + subtree |
| Tap select strip (⋮) | Toggle item selection |
| Shift+tap strip | Range select |
| Ctrl/Cmd+tap item | Toggle item selection |
| Tap ✕ icon | Delete item + subtree (with animation) |
| Tap 📤 icon | Send item to another chit |
| Type in input + Enter | Add new item at bottom |
| Tap ↺ button | Undo last action |
| Tap ↻ button | Redo last undone action |
| Tap Data button | Open data menu (bottom sheet on mobile) |
| Tap completed header | Expand/collapse completed section |
| ESC (keyboard) | Clear multi-select if active; otherwise exit editor |

---

## 22. Key Differences from Android App (Current State)

The Android app currently has:
- ❌ Swipe to erase (should be swipe to indent/outdent)
- ❌ Up/down arrows to reorder (should be drag handle with touch drag)
- ❌ No multi-select mode at all
- ❌ No undo/redo
- ❌ No Data menu (paste, copy, clean, move to note, send, print, autosave)
- ❌ No inline editing with Enter-to-split, Tab indent, markdown formatting
- ❌ No completed section with collapse/expand
- ❌ No ghost parents in completed section
- ❌ No send-to-chit functionality
- ❌ No auto-save with visual indicators
- ❌ No markdown rendering in item text
- ❌ No check animation (strikethrough → fade → move)
- ❌ No delete animation (red fade)
- ❌ No flash arrow on add
- ❌ Zone is collapsible (should not be on mobile)
- ❌ Uses only half the available vertical space (should fill available space)
- ❌ Auto-save button on main screen (should be in Data menu)

The Android app should match this spec exactly in behavior and visual presentation.
