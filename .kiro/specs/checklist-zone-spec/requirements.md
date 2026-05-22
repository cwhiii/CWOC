# Requirements Document: Checklist Zone — Complete Reproduction Specification

## Introduction

This document specifies the COMPLETE behavior, structure, and functionality of the Checklist Zone as it exists in the CWOC (C.W.'s Omni Chits) web application. The purpose is to enable 100% faithful reproduction on another system such that a user could not distinguish between the original and the reproduction. Every visual state, interaction, animation, keyboard shortcut, data flow, and edge case is documented as a formal requirement.

The Checklist Zone is one of the editor zones within the Chit Editor. It provides a nested, drag-and-drop, multi-select, undo/redo-capable checklist with inline editing, markdown rendering, and cross-chit item transfer capabilities. It also has a compact inline representation on dashboard chit cards.

## Glossary

- **Checklist_Zone**: The complete checklist UI component within the Chit Editor, encompassing the zone header, input field, item list, completed section, and all interactive behaviors
- **Checklist_Item**: A single entry in the checklist, represented as an object with id, text, level, checked, and parent fields
- **Zone_Header**: The clickable header bar of the Checklist Zone containing the title, count display, Data menu, and undo/redo buttons
- **Data_Menu**: The dropdown menu accessed via the ellipsis button in the zone header, containing bulk operations
- **Input_Field**: The text input at the top of the checklist container for adding new items
- **Completed_Section**: The collapsible container below unchecked items that holds checked items and ghost parents
- **Ghost_Item**: An unchecked parent item rendered in the Completed Section as context for its checked descendants
- **Multi_Select_Mode**: A state where multiple items are selected for bulk operations
- **Multi_Select_Toolbar**: The toolbar that appears when items are selected, providing bulk action buttons
- **Select_Strip**: The 18px-wide clickable region on the right edge of each item for toggling selection
- **Inline_Checklist**: The compact checklist rendering on dashboard chit cards showing only unchecked items
- **Undo_Stack**: A stack of up to 50 serialized checklist states for reverting changes
- **Subtree**: An item plus all of its descendants (children, grandchildren, etc.)
- **Indent_Level**: The nesting depth of an item (0 to 4), visually represented as 20px left padding per level
- **Drag_Zone**: One of three vertical regions (top third, middle third, bottom third) of a target item that determines drop behavior
- **Auto_Complete**: A per-chit setting that automatically marks the chit as "Complete" when all checklist items are checked
- **Chit**: The parent data record that contains the checklist array along with other fields (title, notes, tags, etc.)
- **marked.js**: The markdown parsing library used to render item text as HTML
- **Parchment_Theme**: The 1940s-inspired visual theme using brown tones, Lora serif font, and parchment backgrounds

## Requirements

### Requirement 1: Data Model

**User Story:** As a developer reproducing this system, I want to know the exact data structure of checklist items, so that I can store and manipulate them identically.

#### Acceptance Criteria

1. THE Checklist_Zone SHALL store items as a JSON array in the chit's `checklist` field
2. WHEN a Checklist_Item is created, THE Checklist_Zone SHALL assign it an object with exactly five fields: `id` (string), `text` (string), `level` (number 0-4), `checked` (boolean), and `parent` (string or null)
3. WHEN generating an item ID, THE Checklist_Zone SHALL produce a string in the format "item-XXXXXXXXX" where X is 9 random characters from base-36 encoding (digits 0-9 and letters a-z)
4. THE Checklist_Zone SHALL enforce a maximum indent level of 4 (constant MAX_INDENT_LEVEL)
5. WHEN an item's level exceeds MAX_INDENT_LEVEL during any operation, THE Checklist_Zone SHALL clamp the level to 4
6. THE Checklist_Zone SHALL set the `parent` field to the ID of the nearest preceding item at level-1, or null for root-level items (level 0)

### Requirement 2: Zone Container Structure

**User Story:** As a developer reproducing this system, I want to know the exact HTML structure of the zone, so that I can build an identical DOM hierarchy.

#### Acceptance Criteria

1. THE Checklist_Zone SHALL render inside a container element with ID `checklistSection` and class `zone-container`
2. THE Zone_Header SHALL be clickable to collapse or expand the zone body
3. THE Zone_Header SHALL contain a title reading "✅ Checklist" followed by a count display span
4. WHEN items exist, THE Checklist_Zone SHALL display the count as "(checked / total)" appended to the title in a span with class `checklist-count-display`, font-size 0.85em, opacity 0.8, margin-left 0.5em, and normal font-weight
5. WHEN no items exist, THE Checklist_Zone SHALL display an empty string in the count display
6. THE Zone_Header SHALL contain a zone-actions area with buttons in this exact left-to-right order: Data Menu button, spacer element (class `location-actions-spacer`), Undo button, Redo button
7. THE Checklist_Zone body SHALL have ID `checklistContent` containing a child element with ID `checklist-container`

### Requirement 3: Data Menu Button and Dropdown

**User Story:** As a developer reproducing this system, I want to know the exact menu structure and behavior, so that I can replicate the Data menu identically.

#### Acceptance Criteria

1. THE Data_Menu button SHALL display a Font Awesome ellipsis-v icon (`fa-ellipsis-v`) followed by the text "Data" (text hidden when narrow via class `hideWhenNarrow`)
2. THE Data_Menu button SHALL have class `zone-button` and title "Data actions"
3. WHEN the Data_Menu button is clicked, THE Checklist_Zone SHALL toggle the dropdown menu visibility between `display:flex` and `display:none`
4. WHEN the dropdown is opened, THE Checklist_Zone SHALL register a one-time document click listener that closes the menu on the next click anywhere
5. THE Data_Menu dropdown SHALL have class `zone-more-menu` and contain exactly 9 menu items in this order:
   - "Paste as list items" with `fa-paste` icon
   - "Copy incomplete to clipboard" with `fa-clipboard` icon
   - "Delete checked items" with `fa-check-square` icon
   - "Delete unchecked items" with `fa-square` icon
   - "Clean up empty items" with `fa-broom` icon
   - "Move to note" with `fa-arrow-right` icon
   - "Send to another chit" with `fa-paper-plane` icon
   - "Print checklist" with `fa-print` icon
   - "Auto-save: On" (or Off) with `fa-bolt` (or `fa-ban`) icon
6. WHEN any menu item is clicked, THE Data_Menu SHALL close (set display to none) before executing the action
7. THE "Delete checked items" menu item SHALL be hidden (display:none) when no checked items exist

### Requirement 4: Undo and Redo Buttons

**User Story:** As a developer reproducing this system, I want to know the exact undo/redo button behavior, so that I can replicate the state management UI.

#### Acceptance Criteria

1. THE Undo button SHALL display the character "↺", have class `zone-button notes-undo-redo`, and title "Undo (Cmd+Z)"
2. THE Redo button SHALL display the character "↻", have class `zone-button notes-undo-redo`, and title "Redo (Cmd+Shift+Z)"
3. WHEN the undo stack is empty, THE Undo button SHALL be disabled (disabled attribute set to true)
4. WHEN the redo stack is empty, THE Redo button SHALL be disabled (disabled attribute set to true)
5. WHEN the undo stack has entries, THE Undo button SHALL be enabled
6. WHEN the redo stack has entries, THE Redo button SHALL be enabled
7. WHEN the Undo button is clicked, THE Checklist_Zone SHALL call stopPropagation and preventDefault on the event, then execute the undo operation
8. WHEN the Redo button is clicked, THE Checklist_Zone SHALL call stopPropagation and preventDefault on the event, then execute the redo operation

### Requirement 5: Undo/Redo State Management

**User Story:** As a developer reproducing this system, I want to know the exact undo/redo stack mechanics, so that I can replicate state history identically.

#### Acceptance Criteria

1. THE Checklist_Zone SHALL maintain an undo stack with a maximum size of 50 entries
2. THE Checklist_Zone SHALL maintain a separate redo stack with no explicit size limit
3. WHEN pushing an undo state, THE Checklist_Zone SHALL serialize the complete items array as JSON (all fields: id, text, level, checked, parent for every item)
4. WHEN pushing an undo state, THE Checklist_Zone SHALL NOT push if the serialized state is identical to the last entry on the undo stack (deduplication)
5. WHEN pushing an undo state, THE Checklist_Zone SHALL clear the redo stack entirely
6. WHEN the undo stack exceeds 50 entries after a push, THE Checklist_Zone SHALL remove the oldest entry (shift from front)
7. WHEN undo is triggered, THE Checklist_Zone SHALL push the current state onto the redo stack, pop the last undo state, deserialize it, and re-render
8. WHEN redo is triggered, THE Checklist_Zone SHALL push the current state onto the undo stack, pop the last redo state, deserialize it, and re-render
9. WHEN items are loaded fresh (loadItems called), THE Checklist_Zone SHALL reset both undo and redo stacks to empty and update button states
10. THE following actions SHALL push an undo state before executing: delete item, check/uncheck toggle, indent/unindent, drag-drop reorder, clear checked items, delete unchecked items, clean up empty items, paste as list items, move to note

### Requirement 6: Input Field

**User Story:** As a developer reproducing this system, I want to know the exact input field behavior, so that I can replicate item creation identically.

#### Acceptance Criteria

1. THE Input_Field SHALL be an `<input type="text">` element with class `checklist-input` and placeholder "Add new item (Enter to add)"
2. THE Input_Field SHALL be positioned at the TOP of the checklist container, before all item elements
3. THE Input_Field SHALL have these CSS properties: width 100%, padding 8px, box-sizing border-box, font-size 16px, font-family inherit, border 1px solid var(--border-color, #8b4513), border-radius 4px, background var(--input-bg, #fdf5e6), color var(--text-color, #4a2c2a), transition on border-color and box-shadow 0.3s
4. WHEN the Input_Field receives focus, THE Checklist_Zone SHALL apply: outline none, border-color var(--accent-teal, #008080), box-shadow 0 0 0 1px rgba(0, 128, 128, 0.25)
5. WHEN Enter is pressed with non-empty trimmed text, THE Checklist_Zone SHALL add a new item with that text at the end of the items array, clear the input, and flash an arrow indicator (via `_flashChecklistAddArrow`)
6. WHEN Enter is pressed with empty or whitespace-only text, THE Checklist_Zone SHALL do nothing
7. WHEN Escape is pressed, THE Checklist_Zone SHALL call `cancelOrExit` (which exits the editor with a save check)
8. WHEN Cmd+Z (or Ctrl+Z) is pressed without Shift, THE Checklist_Zone SHALL prevent default and trigger undo
9. WHEN Cmd+Shift+Z (or Ctrl+Shift+Z) is pressed, THE Checklist_Zone SHALL prevent default and trigger redo
10. WHEN Cmd+B, Cmd+I, or Cmd+U is pressed, THE Checklist_Zone SHALL apply markdown formatting (bold, italic, underline) to the input text via `_getEmailFormatAction`

### Requirement 7: Item Rendering — Two-Section Layout

**User Story:** As a developer reproducing this system, I want to know how items are split into sections, so that I can replicate the visual layout.

#### Acceptance Criteria

1. THE Checklist_Zone SHALL split items into two rendered sections: unchecked items (directly after the input) and checked items (in the Completed Section)
2. THE Checklist_Zone SHALL render unchecked items in their array order, each inserted after the previous element (starting after the input field)
3. THE Completed_Section SHALL be a container with class `completed-checklist-container`, margin-top 20px, border-top 1px solid #ccc, padding-top 10px
4. THE Completed_Section SHALL be hidden (display:none) when no checked items exist
5. THE Completed_Section header SHALL display "Completed" as an h3 (margin 0, font-size 0.95em), followed by a count span showing "(N)" where N is the number of checked items, a flex spacer, and a toggle icon
6. THE Completed_Section toggle icon SHALL show "▶" when collapsed and "▼" when expanded, with font-size 0.8em and padding 0 4px
7. THE Completed_Section body SHALL start collapsed (display:none) and toggle visibility when the header is clicked
8. WHEN the Completed_Section header is clicked on a button element, THE Checklist_Zone SHALL NOT toggle the section (early return)
9. THE Completed_Section body SHALL render checked items AND ghost parent items in their original array order
10. WHEN a checked item has an unchecked ancestor, THE Checklist_Zone SHALL render that ancestor as a Ghost_Item in the Completed Section for context
11. THE Checklist_Zone SHALL traverse the full ancestor chain of each checked item to find ALL unchecked ancestors for ghost rendering

### Requirement 8: Individual Item Element Structure

**User Story:** As a developer reproducing this system, I want to know the exact DOM structure of each item, so that I can build identical elements.

#### Acceptance Criteria

1. WHEN rendering a normal unchecked item, THE Checklist_Zone SHALL create a div with class `checklist-item`, attribute `draggable="true"`, and `data-id` set to the item's ID
2. WHEN rendering a checked item, THE Checklist_Zone SHALL create a div with class `completed-checklist-item`
3. WHEN rendering a ghost item, THE Checklist_Zone SHALL create a div with class `ghost-checklist-item`
4. THE item element SHALL contain these children in order: div.left-container, span.checklist-send-icon, span.trash-icon, div.checklist-select-strip
5. THE left-container SHALL have class `left-container`, display flex, align-items flex-start, flex 1, min-width 0, and paddingLeft set to `(item.level * 20)px`
6. THE left-container SHALL contain in order: span.checklist-drag-handle, input[type=checkbox], div.text-wrapper
7. THE drag handle SHALL be a span with class `checklist-drag-handle`, text content "⠿", title "Drag to reorder", flex 0 0 auto, cursor grab, color var(--aged-brown-light, #a0522d), font-size 1.2em, line-height 1.4, padding 0 4px 0 0, user-select none, opacity 0.6, touch-action none
8. THE checkbox SHALL be an input[type=checkbox] with flex 0 0 auto, padding 0, width auto, margin 3px 0 0 0, and its checked state matching the item's checked field
9. THE text-wrapper SHALL be a div with class `text-wrapper`, flex 1, min-width 0, margin-left 6px, cursor text
10. THE text-wrapper SHALL contain a span with class `checklist-text`, display block, white-space pre-wrap, word-break break-word, cursor text

### Requirement 9: Item Hover and Icon Visibility

**User Story:** As a developer reproducing this system, I want to know the exact hover behavior for action icons, so that I can replicate the interaction feedback.

#### Acceptance Criteria

1. THE send icon (📤) SHALL have class `checklist-send-icon`, text content "📤", title "Send to another chit", font-size 0.85em, and initial visibility hidden
2. THE trash icon SHALL have class `trash-icon`, text content "✕", title "Delete item", font-size 14px, color #999, font-weight 300, padding 0 4px, cursor pointer, user-select none, and initial visibility hidden
3. WHEN the mouse enters an item element, THE Checklist_Zone SHALL set both the trash icon and send icon visibility to "visible"
4. WHEN the mouse leaves an item element, THE Checklist_Zone SHALL set both the trash icon and send icon visibility to "hidden"
5. WHEN the trash icon is hovered, THE Checklist_Zone SHALL change its color to #a33
6. WHEN the trash icon OR send icon is hovered, THE Checklist_Zone SHALL apply a subtle brown background (rgba(107, 78, 49, 0.04)) and border-radius 4px to the parent item row (via CSS `:has()` selector)
7. WHEN the device has `pointer: coarse` (touch devices), THE Checklist_Zone SHALL always show both trash and send icons (visibility visible) without requiring hover

### Requirement 10: Markdown Rendering of Item Text

**User Story:** As a developer reproducing this system, I want to know exactly how item text is rendered as markdown, so that I can replicate the display.

#### Acceptance Criteria

1. THE Checklist_Zone SHALL render item text using marked.js `marked.parse()` with the option `{ breaks: true }`
2. WHEN the item text is a single line (contains no newline characters), THE Checklist_Zone SHALL strip the outer `<p>...</p>` wrapper from the parsed HTML using regex `/^<p>(.*)<\/p>\s*$/s`
3. THE Checklist_Zone SHALL remove any `<input>` elements from the parsed HTML (GFM task list checkboxes) using regex `/<input[^>]*>/gi`
4. THE Checklist_Zone SHALL set the resulting HTML as innerHTML of the text span
5. THE Checklist_Zone SHALL set tabindex="-1" on all rendered `<a>` elements to prevent tab focus
6. IF marked.js is not available, THE Checklist_Zone SHALL fall back to setting textContent (plain text, no HTML)
7. IF the item text is empty or falsy, THE Checklist_Zone SHALL set the element's textContent to empty string
8. THE Checklist_Zone SHALL apply these CSS rules to rendered markdown content inside `.checklist-text`:
   - All child elements: margin 0, padding 0, line-height inherit
   - `code`: background rgba(107, 78, 49, 0.1), border-radius 3px, font-size 0.9em
   - `a`: color var(--accent-teal, #008080), text-decoration underline
   - `strong`: font-weight 700
   - `em`: font-style italic
   - `del`: text-decoration line-through, opacity 0.7
   - `img`: max-height 1.4em, vertical-align middle
   - `h1-h6`: font-weight 700, display inline (h1: 1.2em, h2: 1.1em, h3: 1.05em)
   - `ul, ol`: padding-left 1.4em
   - `blockquote`: padding-left 0.8em, border-left 3px solid rgba(107, 78, 49, 0.3), opacity 0.85
   - `pre`: background rgba(107, 78, 49, 0.08), border-radius 4px, overflow-x auto, font-size 0.9em

### Requirement 11: Inline Editing — Activation and Textarea

**User Story:** As a developer reproducing this system, I want to know exactly how inline editing starts and the textarea behaves, so that I can replicate the editing experience.

#### Acceptance Criteria

1. WHEN the user clicks on the text span (`.checklist-text`), THE Checklist_Zone SHALL start inline editing for that item
2. WHEN the user clicks on the text-wrapper div (empty space around text), THE Checklist_Zone SHALL start inline editing for that item (or focus existing textarea at end if already editing)
3. WHEN the user clicks on empty space in the left-container, THE Checklist_Zone SHALL start inline editing for that item (or focus existing textarea at end if already editing)
4. WHEN inline editing starts, THE Checklist_Zone SHALL hide the text span (display:none), create a `<textarea>` with class `checklist-edit-input`, set its value to the item's current text, and insert it in the text-wrapper
5. THE editing textarea SHALL have these CSS properties: display block, width 100%, box-sizing border-box, padding 0, margin 0, border 1px solid var(--accent-teal, #008080), border-radius 3px, background transparent, font-size inherit, font-family inherit, line-height inherit (1.4), color inherit, outline none, resize none, overflow hidden, min-height 1.6em
6. WHEN the textarea is created, THE Checklist_Zone SHALL auto-size its height to fit the content
7. WHEN the textarea is created, THE Checklist_Zone SHALL position the cursor at the click location by measuring text width using a canvas context (font metrics)
8. WHEN inline editing starts, THE Checklist_Zone SHALL set the item element's `draggable` attribute to false (disabling drag during editing)
9. THE Checklist_Zone SHALL store a reference to the currently editing item in `this.editingItem`
10. WHEN the textarea receives input (every keystroke), THE Checklist_Zone SHALL update the item's text property immediately (per-keystroke auto-save with quiet notification, no undo push)

### Requirement 12: Inline Editing — Keyboard Shortcuts

**User Story:** As a developer reproducing this system, I want to know every keyboard shortcut during editing, so that I can replicate the full editing interaction model.

#### Acceptance Criteria

1. WHEN Enter is pressed without Shift during editing, THE Checklist_Zone SHALL split the item at the cursor position: text before cursor stays in current item, text after cursor becomes a new item inserted immediately after the current item with the same level and parent, and focus moves to the new item at cursor position 0
2. WHEN Shift+Enter is pressed during editing, THE Checklist_Zone SHALL insert a literal newline character (multi-line items supported)
3. WHEN Escape is pressed during editing, THE Checklist_Zone SHALL cancel editing and revert the item text to its pre-edit value
4. WHEN Tab is pressed during editing, THE Checklist_Zone SHALL indent the single item one level (same rules as Cmd+])
5. WHEN Shift+Tab is pressed during editing, THE Checklist_Zone SHALL unindent the single item one level (same rules as Cmd+[)
6. WHEN Cmd+[ is pressed during editing, THE Checklist_Zone SHALL unindent the single item: decrease level by 1 (minimum 0), reassign following siblings to the promoted item
7. WHEN Cmd+] is pressed during editing, THE Checklist_Zone SHALL indent the single item: increase level by 1 (maximum 4), only if there exists a preceding item at the same or higher level (cannot indent first item or beyond neighbor)
8. WHEN Cmd+Shift+( or Cmd+Shift+9 is pressed during editing, THE Checklist_Zone SHALL unindent the item AND all its descendants by 1 level
9. WHEN Cmd+Shift+) or Cmd+Shift+0 is pressed during editing, THE Checklist_Zone SHALL indent the item AND all its descendants by 1 level
10. WHEN Cmd+Z is pressed during editing, THE Checklist_Zone SHALL first allow browser-level undo; if nothing to undo at browser level, trigger checklist-level undo
11. WHEN Cmd+Shift+Z is pressed during editing, THE Checklist_Zone SHALL trigger browser-level redo
12. WHEN Cmd+B, Cmd+I, or Cmd+U is pressed during editing, THE Checklist_Zone SHALL apply markdown formatting (bold/italic/underline) via `_getEmailFormatAction`
13. WHEN ArrowUp is pressed with cursor at position 0, THE Checklist_Zone SHALL navigate focus to the previous unchecked item's textarea (or start editing the previous item)
14. WHEN ArrowDown is pressed with cursor at the end of text, THE Checklist_Zone SHALL navigate focus to the next unchecked item's textarea (or start editing the next item)
15. WHEN the textarea loses focus (blur event), THE Checklist_Zone SHALL finish editing with save=true (commit the current text)

### Requirement 13: Indent and Unindent Rules

**User Story:** As a developer reproducing this system, I want to know the exact indentation constraints, so that I can enforce identical nesting rules.

#### Acceptance Criteria

1. THE Checklist_Zone SHALL enforce a maximum indent level of 4 for all items
2. THE Checklist_Zone SHALL NOT allow indenting an item that is already at level 4
3. THE Checklist_Zone SHALL NOT allow indenting an item if there is no preceding item at the same or higher level (cannot indent the first item in the list)
4. THE Checklist_Zone SHALL enforce that an item's level must be at most 1 greater than the preceding item's level (cannot skip indent levels)
5. WHEN indenting a single item, THE Checklist_Zone SHALL set its parent to the nearest preceding item at (new level - 1)
6. WHEN indenting a single item, THE Checklist_Zone SHALL reassign the item's direct children to maintain correct parent references
7. WHEN unindenting a single item, THE Checklist_Zone SHALL decrease its level by 1 (minimum 0) and set its parent to the nearest preceding item at (new level - 1), or null if new level is 0
8. WHEN unindenting a single item, THE Checklist_Zone SHALL reassign following siblings (items that were at the same level with the same parent, appearing after the unindented item) to become children of the unindented item
9. WHEN indenting/unindenting with descendants (Cmd+Shift+parentheses), THE Checklist_Zone SHALL apply the same level delta to ALL items in the subtree
10. THE Checklist_Zone SHALL push an undo state before any indent/unindent operation

### Requirement 14: Checkbox Toggle Behavior

**User Story:** As a developer reproducing this system, I want to know the exact checkbox toggle behavior including cascading and animations, so that I can replicate the check/uncheck experience.

#### Acceptance Criteria

1. WHEN a checkbox is clicked, THE Checklist_Zone SHALL toggle the item's checked state
2. WHILE Multi_Select_Mode is active, THE Checklist_Zone SHALL block checkbox toggles by reverting the checkbox to its previous state immediately
3. WHEN an item is checked, THE Checklist_Zone SHALL also check ALL descendants (children, grandchildren, etc.) recursively
4. WHEN an item is unchecked, THE Checklist_Zone SHALL also uncheck ALL descendants recursively
5. WHEN an item is checked, THE Checklist_Zone SHALL apply a checking animation: add class `checklist-checking` (strikethrough + green tint), then after a delay add class `checklist-checking-fade` (opacity 0, translateX(10px)), then re-render the list (item moves to Completed Section)
6. WHEN an item is unchecked (in Completed Section), THE Checklist_Zone SHALL immediately re-render (item moves back to unchecked section, no fade animation)
7. THE Checklist_Zone SHALL push an undo state before toggling checked state
8. AFTER toggling checked state, THE Checklist_Zone SHALL call `_checkAutoCompleteChecklist` to evaluate auto-complete logic

### Requirement 15: Drag and Drop — Desktop

**User Story:** As a developer reproducing this system, I want to know the exact drag-and-drop mechanics on desktop, so that I can replicate reordering and nesting via drag.

#### Acceptance Criteria

1. THE Checklist_Zone SHALL set `draggable="true"` on every non-ghost item element
2. THE drag handle ("⠿") SHALL have cursor:grab normally and cursor:grabbing when active
3. WHEN drag starts, THE Checklist_Zone SHALL store the dragged item and compute its full subtree (all descendants), then add class `dragging` (opacity 0.5) to the element
4. WHEN dragging over a target item, THE Checklist_Zone SHALL determine the drop zone based on vertical mouse position within the target's bounding rect:
   - Top 1/3 of height: position "above" — apply class `drag-over-above` (blue 2px top border, white background)
   - Middle 1/3 of height: position "on" — apply class `drag-over-on` (white background, item becomes child)
   - Bottom 1/3 of height: position "below" — apply class `drag-over-below` (blue 2px bottom border, white background)
5. THE Checklist_Zone SHALL NOT allow dropping on self or any of the dragged item's descendants
6. WHEN the drag leaves a target, THE Checklist_Zone SHALL remove all drag-over classes from that target
7. WHEN dropping with position "on", THE Checklist_Zone SHALL make the dragged item (and subtree) a child of the target: set dragged item's level to target.level + 1, adjust all subtree levels by the same delta, set dragged item's parent to target's ID, insert after target's existing subtree
8. WHEN dropping with position "above", THE Checklist_Zone SHALL place the dragged item at the same level as the target with the same parent, inserted before the target in the array
9. WHEN dropping with position "below", THE Checklist_Zone SHALL place the dragged item at the same level as the target with the same parent, inserted after the target's full subtree in the array
10. WHEN an item is dragged between the unchecked and completed zones, THE Checklist_Zone SHALL update the item's checked state to match the target zone (dragging to completed = checked, dragging to unchecked = unchecked)
11. THE Checklist_Zone SHALL move the entire subtree with the dragged item (all descendants follow)
12. THE Checklist_Zone SHALL push an undo state before executing the drop
13. AFTER the drop, THE Checklist_Zone SHALL re-render and notify of the change

### Requirement 16: Drag and Drop — Touch/Mobile

**User Story:** As a developer reproducing this system, I want to know the exact touch drag behavior, so that I can replicate mobile reordering and swipe-to-indent.

#### Acceptance Criteria

1. THE Checklist_Zone SHALL use `enableTouchDrag` from shared-touch.js for touch interaction on each item element
2. WHEN a touch drag starts, THE Checklist_Zone SHALL store the dragged item, compute its subtree, record the start X/Y coordinates, set `_touchSwipeHandled` to false, and add class `dragging` to the element
3. WHEN horizontal movement exceeds 40px AND horizontal distance exceeds vertical distance by a 2:1 ratio, THE Checklist_Zone SHALL treat the gesture as a swipe (not a drag):
   - Swipe right (dx > 0): indent the item + entire subtree by 1 level (same indent rules apply)
   - Swipe left (dx < 0): unindent the item + entire subtree by 1 level (same unindent rules apply)
4. WHEN a swipe is detected, THE Checklist_Zone SHALL set `_touchSwipeHandled` to true, remove the `dragging` class, clear drop indicators, push undo state, perform the indent/unindent, re-render, and notify change
5. WHILE `_touchSwipeHandled` is true during onMove, THE Checklist_Zone SHALL skip all vertical drag logic
6. WHEN vertical drag is detected (swipe not triggered), THE Checklist_Zone SHALL use `document.elementFromPoint` to find the target element under the touch point and apply the same above/on/below zone logic as desktop drag
7. WHEN the touch ends without a swipe, THE Checklist_Zone SHALL execute the same drop logic as desktop (push undo, remove from array, insert at target position, adjust levels)
8. WHEN the touch ends after a swipe was handled, THE Checklist_Zone SHALL clean up state without performing drop logic

### Requirement 17: Multi-Select — Activation and Selection Logic

**User Story:** As a developer reproducing this system, I want to know exactly how multi-select is activated and items are selected, so that I can replicate the selection model.

#### Acceptance Criteria

1. WHEN Ctrl/Cmd+Click is performed anywhere on an item row (except checkbox, trash, send, or select strip), THE Checklist_Zone SHALL toggle that item's selection state
2. WHEN the Select_Strip (right edge) is clicked, THE Checklist_Zone SHALL toggle that item's selection state
3. WHEN Shift+Click is performed with an existing selection anchor (`_lastSelectedId`), THE Checklist_Zone SHALL range-select all items between the anchor and the clicked item (additive — does not clear existing selections)
4. WHEN Shift+Click is performed on the Select_Strip with an existing anchor, THE Checklist_Zone SHALL perform the same range selection
5. WHEN the first item is selected, THE Checklist_Zone SHALL enter Multi_Select_Mode (set `_multiSelectMode` to true)
6. WHEN all items are deselected, THE Checklist_Zone SHALL exit Multi_Select_Mode (set `_multiSelectMode` to false)
7. THE Checklist_Zone SHALL maintain a Set (`_selectedIds`) containing the IDs of all currently selected items
8. THE Checklist_Zone SHALL store `_lastSelectedId` as the anchor point for range selections (updated on each toggle)
9. WHILE Multi_Select_Mode is active, THE Checklist_Zone SHALL add class `checklist-multiselect-active` to the container, which disables text selection (user-select:none) and pointer events on text elements
10. WHILE Multi_Select_Mode is active, clicking on an item row (without Ctrl/Cmd) SHALL be blocked (stopPropagation + preventDefault) — no editing allowed
11. WHILE Multi_Select_Mode is active, clicking the drag handle of a SELECTED item SHALL be allowed (to initiate multi-drag)

### Requirement 18: Multi-Select — Visual Indicators

**User Story:** As a developer reproducing this system, I want to know the exact visual treatment of selected items, so that I can replicate the selection appearance.

#### Acceptance Criteria

1. THE Select_Strip SHALL be a div with class `checklist-select-strip`, positioned absolute on the right edge of each item, 18px wide
2. THE Select_Strip SHALL normally display "⋮" (vertical ellipsis) as content indicator
3. WHEN an item is selected, THE Select_Strip SHALL add class `selected`, display a teal background, and show "✓" in white
4. WHEN an item is selected, THE item element SHALL have a teal-tinted background and 1px teal outline
5. THE Multi_Select_Toolbar SHALL appear below the Input_Field when one or more items are selected
6. THE Multi_Select_Toolbar SHALL have a teal border and background, 6px padding, and flex-wrap behavior

### Requirement 19: Multi-Select — Toolbar Actions

**User Story:** As a developer reproducing this system, I want to know every toolbar button and its behavior, so that I can replicate the bulk operations.

#### Acceptance Criteria

1. THE Multi_Select_Toolbar SHALL contain these elements in left-to-right order: count label, All button, Check button, Delete button, Move button, Indent button, Outdent button, Close (✕) button
2. THE count label SHALL display "N selected" in teal color, where N is the number of selected items
3. WHEN the "All" button is clicked, THE Checklist_Zone SHALL select all unchecked items
4. WHEN the "Check" button (✓ icon) is clicked, THE Checklist_Zone SHALL mark all selected items as checked (and their descendants), push undo state, re-render, and clear selection
5. WHEN the "Delete" button (trash icon) is clicked, THE Checklist_Zone SHALL show a confirmation dialog ("Delete N items?"), and if confirmed, delete all selected items (and their descendants), push undo state, re-render, and clear selection
6. WHEN the "Move" button (paper-plane icon) is clicked, THE Checklist_Zone SHALL open the send-content modal to transfer selected items to another chit
7. WHEN the "Indent" button (indent icon) is clicked, THE Checklist_Zone SHALL indent all selected items by one level (respecting indent rules for each)
8. WHEN the "Outdent" button (outdent icon) is clicked, THE Checklist_Zone SHALL unindent all selected items by one level (respecting unindent rules for each)
9. WHEN the "✕" button is clicked, THE Checklist_Zone SHALL clear all selections and exit Multi_Select_Mode

### Requirement 20: Multi-Select — Drag Behavior

**User Story:** As a developer reproducing this system, I want to know how multi-drag works, so that I can replicate bulk reordering.

#### Acceptance Criteria

1. WHILE Multi_Select_Mode is active, THE Checklist_Zone SHALL set `draggable=false` on all NON-selected items (only selected items are draggable)
2. WHEN a selected item's drag starts in Multi_Select_Mode, THE Checklist_Zone SHALL initiate a multi-drag of ALL selected items as a unit
3. WHEN multi-dragging, THE Checklist_Zone SHALL add class `dragging` to ALL selected item elements
4. WHEN multi-drag drops with position "above" or "below", THE Checklist_Zone SHALL keep all selected items at their original relative indent levels (no level adjustment)
5. WHEN multi-drag drops with position "on", THE Checklist_Zone SHALL adjust all selected items' levels by a delta to make them children of the target (root selected item gets target.level + 1, others adjust by same delta)
6. WHEN a non-selected item's drag is attempted in Multi_Select_Mode, THE Checklist_Zone SHALL prevent the drag (call preventDefault on dragstart)

### Requirement 21: Multi-Select — ESC Behavior

**User Story:** As a developer reproducing this system, I want to know how ESC interacts with multi-select, so that I can replicate the keyboard dismissal.

#### Acceptance Criteria

1. WHEN ESC is pressed while Multi_Select_Mode is active, THE Checklist_Zone SHALL clear all selections and exit Multi_Select_Mode
2. THE ESC handler for multi-select SHALL be registered in the capture phase (third argument `true` to addEventListener) so it fires BEFORE other ESC handlers
3. WHEN ESC clears multi-select, THE Checklist_Zone SHALL call stopPropagation() and preventDefault() to prevent the event from reaching page-level ESC handlers (no page exit)
4. WHEN Multi_Select_Mode is NOT active, THE ESC key SHALL pass through to other handlers normally

### Requirement 22: Delete Item

**User Story:** As a developer reproducing this system, I want to know the exact delete behavior and animation, so that I can replicate item removal.

#### Acceptance Criteria

1. WHEN the trash icon (✕) is clicked, THE Checklist_Zone SHALL use mousedown (not click) to prevent textarea blur
2. WHEN deleting an item, THE Checklist_Zone SHALL also delete ALL descendants of that item
3. WHEN deleting, THE Checklist_Zone SHALL push an undo state before removal
4. IF the item being deleted is currently being edited, THE Checklist_Zone SHALL clear the editing state (set editingItem to null, remove textarea, restore text span display)
5. THE Checklist_Zone SHALL apply the delete animation: add class `deleting` to the element, which triggers CSS transition — background-color changes to red, opacity transitions to 0 over 0.5s
6. AFTER the animation completes (approximately 300ms timeout), THE Checklist_Zone SHALL remove the items from the data array, re-render, and notify change

### Requirement 23: Send Item to Another Chit

**User Story:** As a developer reproducing this system, I want to know the send-item behavior, so that I can replicate cross-chit item transfer.

#### Acceptance Criteria

1. WHEN the send icon (📤) is clicked (via mousedown to prevent blur), THE Checklist_Zone SHALL first commit any active edit text for that item
2. IF the item is currently being edited, THE Checklist_Zone SHALL save the textarea value as the item's text, clear editingItem, remove the textarea, and restore the text span before opening the send popup
3. THE Checklist_Zone SHALL call `_openSendItemPopup` with the event, item, and checklist instance
4. THE send popup SHALL show recent chits and provide search functionality
5. THE send popup SHALL support sending the item (with its full subtree) to another chit in either move or copy mode
6. THE send popup SHALL support spawning a new chit from the item

### Requirement 24: Data Menu — Paste as List Items

**User Story:** As a developer reproducing this system, I want to know the exact paste parsing logic, so that I can replicate clipboard-to-checklist conversion.

#### Acceptance Criteria

1. WHEN "Paste as list items" is selected, THE Checklist_Zone SHALL read the clipboard via `navigator.clipboard.readText()`
2. THE Checklist_Zone SHALL split the clipboard text into lines and process each non-empty line as a potential item
3. THE Checklist_Zone SHALL detect indent level from leading whitespace: 4 spaces OR 1 tab = 1 level; 2 spaces = 1 level
4. THE Checklist_Zone SHALL detect markdown checkbox syntax and set checked state accordingly:
   - `- [x]` or `* [x]`: checked = true
   - `- [ ]` or `* [ ]`: checked = false
5. THE Checklist_Zone SHALL strip list markers from the beginning of lines: `- `, `* `, `• `, `1. `, `1) ` (numbered lists with any number)
6. THE Checklist_Zone SHALL detect legacy checkbox format: `[x]` = checked, `[ ]` = unchecked
7. THE Checklist_Zone SHALL assign parent IDs based on computed levels (each item's parent is the nearest preceding item at level-1)
8. THE Checklist_Zone SHALL push an undo state before adding pasted items
9. AFTER pasting, THE Checklist_Zone SHALL show an undo toast: "📋 Pasted N items"

### Requirement 25: Data Menu — Copy Incomplete to Clipboard

**User Story:** As a developer reproducing this system, I want to know the exact copy format, so that I can replicate clipboard export.

#### Acceptance Criteria

1. WHEN "Copy incomplete to clipboard" is selected, THE Checklist_Zone SHALL collect all unchecked items
2. THE Checklist_Zone SHALL format each unchecked item as markdown: 2-space indent per level, followed by `- [ ] ` and the item text (e.g., `    - [ ] nested item` for level 2)
3. THE Checklist_Zone SHALL write the formatted text to the clipboard via `navigator.clipboard.writeText()`
4. AFTER copying, THE Checklist_Zone SHALL show a toast: "📋 Copied N items"
5. IF no incomplete items exist, THE Checklist_Zone SHALL show a warning toast instead of copying

### Requirement 26: Data Menu — Delete Checked Items

**User Story:** As a developer reproducing this system, I want to know the exact delete-checked flow, so that I can replicate the bulk deletion with confirmation.

#### Acceptance Criteria

1. WHEN "Delete checked items" is selected, THE Checklist_Zone SHALL count all items where checked=true
2. IF the count is 0, THE Checklist_Zone SHALL return immediately (no action)
3. THE Checklist_Zone SHALL show a confirmation dialog via `cwocConfirm` with message "Delete N checked item(s)?", title "Clear Checked", danger styling, and confirm label "Delete"
4. IF the user confirms, THE Checklist_Zone SHALL push an undo state, remove all items where checked=true from the array, re-render, and notify change
5. IF the user cancels, THE Checklist_Zone SHALL take no action

### Requirement 27: Data Menu — Delete Unchecked Items

**User Story:** As a developer reproducing this system, I want to know the exact delete-unchecked flow, so that I can replicate this bulk operation.

#### Acceptance Criteria

1. WHEN "Delete unchecked items" is selected, THE Checklist_Zone SHALL count all items where checked=false
2. IF the count is 0, THE Checklist_Zone SHALL return immediately (no action)
3. THE Checklist_Zone SHALL show a confirmation dialog via `cwocConfirm` with message "Delete N unchecked item(s)?", title "Delete Unchecked", danger styling, and confirm label "Delete"
4. IF the user confirms, THE Checklist_Zone SHALL push an undo state, remove all items where checked=false from the array (keeping only checked items), re-render, and notify change
5. IF the user cancels, THE Checklist_Zone SHALL take no action

### Requirement 28: Data Menu — Clean Up Empty Items

**User Story:** As a developer reproducing this system, I want to know the clean-up behavior, so that I can replicate empty item removal.

#### Acceptance Criteria

1. WHEN "Clean up empty items" is selected, THE Checklist_Zone SHALL count items with empty or whitespace-only text
2. IF the count is 0, THE Checklist_Zone SHALL return immediately (no action)
3. THE Checklist_Zone SHALL NOT show a confirmation dialog (immediate action)
4. THE Checklist_Zone SHALL push an undo state, remove all items where text is empty or whitespace-only, re-render, and notify change

### Requirement 29: Data Menu — Move to Note

**User Story:** As a developer reproducing this system, I want to know the checklist-to-note conversion, so that I can replicate cross-zone data transfer.

#### Acceptance Criteria

1. WHEN "Move to note" is selected, THE Checklist_Zone SHALL convert ALL checklist items (both checked and unchecked) to markdown format
2. THE conversion format SHALL be: 2-space indent per level, followed by `- [x] text` for checked items or `- [ ] text` for unchecked items
3. THE Checklist_Zone SHALL append the converted markdown to the existing note content, separated by a blank line
4. THE Checklist_Zone SHALL clear the checklist (remove all items) after moving
5. THE Checklist_Zone SHALL show an undo toast: "📝 Moved checklist to notes"
6. WHEN undo is triggered from the toast, THE Checklist_Zone SHALL restore BOTH the note content and the checklist items to their pre-move state

### Requirement 30: Data Menu — Note to Checklist (Reverse)

**User Story:** As a developer reproducing this system, I want to know the note-to-checklist conversion, so that I can replicate the reverse transfer.

#### Acceptance Criteria

1. WHEN "Note to Checklist" is triggered from the Notes zone header, THE Checklist_Zone SHALL convert note lines to checklist items
2. THE parsing logic SHALL be identical to "Paste as list items" (markdown checkboxes, list markers, indent detection)
3. THE Checklist_Zone SHALL clear the note content after moving
4. THE Checklist_Zone SHALL show an undo toast: "📋 Moved notes to checklist"
5. WHEN undo is triggered from the toast, THE Checklist_Zone SHALL restore BOTH the note content and the checklist items to their pre-move state

### Requirement 31: Data Menu — Send to Another Chit

**User Story:** As a developer reproducing this system, I want to know the send-content behavior, so that I can replicate bulk transfer.

#### Acceptance Criteria

1. WHEN "Send to another chit" is selected, THE Checklist_Zone SHALL call `_openSendContentModal` with the event and content type 'checklist'
2. THE send-content modal SHALL allow the user to select a target chit and transfer the entire checklist

### Requirement 32: Data Menu — Print Checklist

**User Story:** As a developer reproducing this system, I want to know the print behavior, so that I can replicate the print modal.

#### Acceptance Criteria

1. WHEN "Print checklist" is selected, THE Checklist_Zone SHALL open a print modal
2. THE print modal SHALL contain a checkbox option "Include completed items" (default: unchecked)
3. THE print modal SHALL contain a "Print" button and a "Cancel" button
4. WHEN ESC is pressed while the print modal is open, THE Checklist_Zone SHALL close the modal
5. WHEN "Print" is clicked, THE Checklist_Zone SHALL generate a printable view of the checklist (including or excluding completed items based on the checkbox) and trigger the browser print dialog

### Requirement 33: Data Menu — Auto-save Toggle

**User Story:** As a developer reproducing this system, I want to know the auto-save toggle behavior, so that I can replicate the per-chit override.

#### Acceptance Criteria

1. THE auto-save toggle SHALL cycle through three states: null (use global setting) → true (force on) → false (force off) → null (repeat)
2. WHEN auto-save is on (true or null with global on), THE menu item SHALL display "Auto-save: On" with `fa-bolt` icon
3. WHEN auto-save is off (false or null with global off), THE menu item SHALL display "Auto-save: Off" with `fa-ban` icon
4. WHEN the per-chit override is active (not null), THE menu item SHALL append "(chit)" suffix to indicate it's a per-chit override
5. WHEN auto-save is off, THE menu item SHALL have opacity 0.6
6. THE auto-save toggle button SHALL have ID `checklistAutosaveBtn`

### Requirement 34: Auto-Complete Checklist

**User Story:** As a developer reproducing this system, I want to know the auto-complete logic, so that I can replicate automatic chit status changes.

#### Acceptance Criteria

1. THE auto-complete feature SHALL be controlled by a per-chit field `auto_complete_checklist` (default: true)
2. WHEN auto-complete is enabled AND all non-empty checklist items become checked, THE Checklist_Zone SHALL set the chit's status to "Complete"
3. WHEN auto-complete is enabled AND auto-archive is also enabled, THE Checklist_Zone SHALL additionally set the chit's `archived` field to true
4. THE auto-complete setting SHALL cycle through three states: Off → Auto-Complete → Auto-Complete + Archive → Off
5. THE auto-complete state SHALL be displayed as a button in the Data menu showing the current mode

### Requirement 35: Inline Checklist (Dashboard View)

**User Story:** As a developer reproducing this system, I want to know the exact dashboard inline checklist behavior, so that I can replicate the compact card view.

#### Acceptance Criteria

1. THE Inline_Checklist SHALL be rendered by `renderInlineChecklist()` in shared-checklist.js
2. THE Inline_Checklist SHALL show ONLY unchecked items (checked items are hidden, counted in the header progress)
3. EACH inline item SHALL be an `<li>` element with: paddingLeft = (level * 18 + 4)px, paddingTop/Bottom 4px, display flex, align-items center, gap 6px, cursor grab, font-size 0.95em, line-height 1.4, min-height 1.8em
4. EACH inline item SHALL contain in order: drag handle ("⠿"), checkbox (unchecked), text span (markdown-rendered)
5. THE inline item list SHALL be a `<ul>` with margin 0.25em 0 0 0, padding 0, list-style none, and `data-chit-id` attribute
6. WHEN a checkbox is checked in the Inline_Checklist, THE system SHALL:
   - Call `toggleChecklistItem` API to persist the change
   - Hide the item element (display:none)
   - Update the progress count display
   - Evaluate if all items are now done
7. WHEN all items are checked, THE Inline_Checklist SHALL add class `checklist-all-done` to the chit card (which strikes through the card title)
8. THE progress count SHALL display as "(checked/total)" with a "✓" suffix when all items are done
9. WHEN auto-complete is enabled on the chit, THE Inline_Checklist SHALL trigger a dashboard refresh after 300ms delay to reflect server-side status changes

### Requirement 36: Inline Checklist — Drag and Drop (Within Chit)

**User Story:** As a developer reproducing this system, I want to know the inline drag-reorder behavior, so that I can replicate dashboard-level reordering.

#### Acceptance Criteria

1. EACH inline item SHALL have `draggable=true` and `li.dataset.idx` set to its array index
2. WHEN drag starts on an inline item, THE Inline_Checklist SHALL set dataTransfer data type `application/x-checklist-item` with JSON payload `{chitId, idx}`, effectAllowed "move", and opacity 0.4
3. WHEN dragging over another inline item, THE Inline_Checklist SHALL show a brown 2px top border indicator (`border-top: 2px solid #8b5a2b`)
4. WHEN drag leaves an item, THE Inline_Checklist SHALL remove the border indicator
5. WHEN an item is dropped on another item, THE Inline_Checklist SHALL call `moveChecklistItemCrossChit` with source and target info, then trigger onUpdate callback
6. WHEN drag ends, THE Inline_Checklist SHALL restore opacity to 1 and call `_markDragJustEnded`

### Requirement 37: Inline Checklist — Cross-Chit Drag and Drop

**User Story:** As a developer reproducing this system, I want to know cross-chit drag behavior, so that I can replicate moving items between chit cards.

#### Acceptance Criteria

1. THE Inline_Checklist SHALL support dragging items from one chit card's list to another chit card's list
2. WHEN an item is dropped on a different chit's list item, THE Inline_Checklist SHALL call `moveChecklistItemCrossChit(fromChitId, fromIdx, toChitId, toIdx)` which fetches both chits, removes the item from source, inserts into target, and saves both via PUT API
3. WHEN an item is dropped on the list container itself (not on a specific item), THE Inline_Checklist SHALL append the item to the end of the target chit's checklist
4. THE list container SHALL accept drops (dragover with `application/x-checklist-item` type) and show a brown 2px bottom border indicator
5. THE Inline_Checklist SHALL support touch drag for cross-chit moves using `enableTouchDrag` with the same logic (elementFromPoint to find target)

### Requirement 38: Pending Content Handling

**User Story:** As a developer reproducing this system, I want to know how pending content is detected and committed, so that I can prevent data loss on exit.

#### Acceptance Criteria

1. THE `hasPendingContent()` method SHALL return true if the Input_Field has non-empty trimmed text OR if an item is currently being edited (editingItem is not null)
2. THE `commitPendingContent()` method SHALL:
   - If the Input_Field has non-empty trimmed text: add it as a new item and clear the input
   - If an item is being edited: save the textarea value as the item's text, clear editingItem, remove the textarea
   - Notify change if anything was committed
   - Return true if something was committed, false otherwise
3. THE Checklist_Zone SHALL call `commitPendingContent` before page exit to prevent data loss

### Requirement 39: Change Notification

**User Story:** As a developer reproducing this system, I want to know how changes are propagated, so that I can replicate the save/sync mechanism.

#### Acceptance Criteria

1. THE Checklist_Zone SHALL accept an `onChangeCallback` function in its constructor
2. WHEN any change occurs (add, delete, edit, reorder, check/uncheck, indent, paste, clear), THE Checklist_Zone SHALL call `onChangeCallback` with the full serialized checklist data (array of {id, text, level, checked, parent} objects)
3. THE `getChecklistData()` method SHALL return a clean copy of all items with only the five canonical fields (id, text, level, checked, parent)
4. WHEN items are loaded fresh via `loadItems()`, THE Checklist_Zone SHALL also call onChangeCallback after rendering

### Requirement 40: CSS Visual States and Animations

**User Story:** As a developer reproducing this system, I want to know every CSS visual state and animation, so that I can replicate the exact look and feel.

#### Acceptance Criteria

1. THE `.checklist-item`, `.completed-checklist-item`, and `.ghost-checklist-item` classes SHALL all share: display flex, align-items flex-start, padding 4px 0, font-family inherit
2. THE `.dragging` class SHALL set opacity to 0.5
3. THE `.deleting` class SHALL apply: transition on opacity 0.5s ease and background-color 0.5s ease, background-color red (!important), opacity 0 (!important)
4. THE `.drag-over-above` class SHALL apply: border-top 2px solid blue, background-color #ffffff
5. THE `.drag-over-below` class SHALL apply: border-bottom 2px solid blue, background-color #ffffff
6. THE `.drag-over-on` class SHALL apply: background-color #ffffff
7. THE `.checklist-checking` class SHALL apply: text-decoration strikethrough, green-tinted background
8. THE `.checklist-checking-fade` class SHALL apply: opacity 0, transform translateX(10px), with transition
9. THE `.highlight-row` class SHALL apply: background-color rgba(255, 0, 0, 0.1)
10. THE drag handle SHALL transition opacity over 0.15s: 0.6 normally, 1.0 on hover, with color changing from var(--aged-brown-light) to var(--aged-brown-dark) on hover

### Requirement 41: Responsive and Mobile CSS

**User Story:** As a developer reproducing this system, I want to know the responsive behavior, so that I can replicate the mobile layout.

#### Acceptance Criteria

1. WHEN the device has `pointer: coarse` (touch), THE Checklist_Zone SHALL always show trash and send icons (no hover required)
2. WHEN the viewport width is 600px or less, THE Checklist_Zone SHALL apply compact padding and larger drag handles for touch targets
3. THE drag handle SHALL have `touch-action: none` to prevent browser scroll interference during touch drag
4. THE Checklist_Zone SHALL support the full touch drag interaction model (swipe indent/unindent + vertical reorder) on mobile devices

### Requirement 42: Initialization and Constructor

**User Story:** As a developer reproducing this system, I want to know the exact initialization sequence, so that I can replicate the startup behavior.

#### Acceptance Criteria

1. THE Checklist class constructor SHALL accept three parameters: container (DOM element), initialItems (array, default []), onChangeCallback (function, default null)
2. THE constructor SHALL initialize these state properties: items=[], draggedItem=null, draggedSubtree=[], dragOverItem=null, dragOverPosition=null, editingItem=null, _pendingUndo=null, _undoStack=[], _redoStack=[], _maxUndoSize=50, _selectedIds=new Set(), _multiSelectMode=false
3. THE `init()` method SHALL execute in this order: _createCountDisplay(), createInput(), render(), _initMultiSelectEsc()
4. IF initialItems is provided and is an array, THE constructor SHALL call loadItems() after init()
5. THE `loadItems()` method SHALL map each item to the canonical format (clamping level to MAX_INDENT_LEVEL, defaulting missing fields), reset undo/redo stacks, render, update count, and call onChangeCallback

### Requirement 43: Item Addition Mechanics

**User Story:** As a developer reproducing this system, I want to know the exact item creation logic, so that I can replicate how new items are added.

#### Acceptance Criteria

1. THE `addNewItem(text, level=0, checked=false, id=null)` method SHALL create a new item object with: id (provided or generated), text, level (clamped to MAX_INDENT_LEVEL), checked, parent (null initially)
2. IF the new item has level > 0 AND items already exist, THE Checklist_Zone SHALL search backwards through the items array to find the nearest item at (level - 1) and set that as the parent
3. THE new item SHALL be appended to the END of the items array (push)
4. AFTER adding, THE Checklist_Zone SHALL re-render and notify change
5. THE `generateId()` method SHALL return "item-" + Math.random().toString(36).substr(2, 9)

### Requirement 44: Subtree and Parent Utilities

**User Story:** As a developer reproducing this system, I want to know the tree traversal logic, so that I can replicate parent/child relationships.

#### Acceptance Criteria

1. THE `getSubtree(item)` method SHALL return an array containing the item itself plus ALL descendants (items whose ancestor chain includes this item), in array order
2. THE `getChildren(item)` method SHALL return all items whose `parent` field equals the given item's ID
3. THE `getParent(item)` method SHALL return the item in the array whose ID matches the given item's `parent` field, or null if parent is null or not found
4. THE `_isDesc(item, ancestor)` method SHALL return true if the item is a descendant of the ancestor (by traversing the parent chain)
5. THE `_reassignFollowingSiblings(item, oldParentId)` method SHALL find items that appear after the given item in the array, have the same level, and had the old parent — and reassign them to be children of the given item

### Requirement 45: Keyboard Shortcuts — Global (Input Field and Zone Level)

**User Story:** As a developer reproducing this system, I want a complete keyboard shortcut reference, so that I can replicate every hotkey.

#### Acceptance Criteria

1. THE following keyboard shortcuts SHALL work from the Input_Field:
   - Enter: add item (if text non-empty)
   - Escape: exit editor (cancelOrExit)
   - Cmd+Z: undo
   - Cmd+Shift+Z: redo
   - Cmd+B: bold formatting
   - Cmd+I: italic formatting
   - Cmd+U: underline formatting
2. THE following keyboard shortcuts SHALL work during inline editing:
   - Enter: split item at cursor
   - Shift+Enter: insert newline
   - Escape: cancel edit (revert text)
   - Tab: indent item
   - Shift+Tab: unindent item
   - Cmd+[: unindent item
   - Cmd+]: indent item
   - Cmd+Shift+(: unindent item + descendants
   - Cmd+Shift+): indent item + descendants
   - Cmd+Shift+9: unindent item + descendants (alternate)
   - Cmd+Shift+0: indent item + descendants (alternate)
   - Cmd+Z: browser undo, then checklist undo
   - Cmd+Shift+Z: browser redo
   - Cmd+B/I/U: markdown formatting
   - ArrowUp (at position 0): navigate to previous item
   - ArrowDown (at end): navigate to next item
3. THE following keyboard shortcut SHALL work at the document level:
   - Escape (in capture phase): clear multi-select if active (blocks propagation)

### Requirement 46: API Integration — Inline Checklist

**User Story:** As a developer reproducing this system, I want to know the exact API calls for inline checklist operations, so that I can replicate the persistence layer.

#### Acceptance Criteria

1. WHEN toggling a checkbox in the Inline_Checklist, THE system SHALL fetch the full chit via `GET /api/chit/{chitId}`, update the checklist item's checked state in the array, and save via `PUT /api/chits/{chitId}` with the full chit JSON body
2. WHEN moving an item within a chit, THE system SHALL fetch the chit, splice the item from its old index, splice it into the new index, and PUT the updated chit
3. WHEN moving an item between chits, THE system SHALL fetch BOTH chits in parallel, remove the item from the source chit's checklist array, insert it into the target chit's checklist array at the specified index, and PUT both chits in parallel
4. IF auto_complete_checklist is enabled on the chit AND all non-blank items are now checked, THE system SHALL update the chit status (server-side handles prerequisite checks)
5. IF auto_complete_checklist is enabled AND an item is unchecked AND the chit status was "Complete", THE system SHALL set the status back to "ToDo" before saving

### Requirement 47: Editor-Level Checklist Persistence

**User Story:** As a developer reproducing this system, I want to know how the editor saves checklist changes, so that I can replicate the save flow.

#### Acceptance Criteria

1. THE Checklist class in the editor SHALL receive an `onChangeCallback` that triggers the editor's save mechanism
2. WHEN the callback fires, THE editor SHALL serialize the checklist data and include it in the chit's JSON payload for the next save (auto-save or manual save)
3. THE editor SHALL call `hasPendingContent()` before exit to check for uncommitted checklist input
4. THE editor SHALL call `commitPendingContent()` as part of the save-before-exit flow

### Requirement 48: CSS Theme Variables and Colors

**User Story:** As a developer reproducing this system, I want to know every CSS variable and color value used, so that I can replicate the exact visual theme.

#### Acceptance Criteria

1. THE Checklist_Zone SHALL use these CSS custom properties with fallback values:
   - `--border-color` (fallback: #8b4513) — input border
   - `--input-bg` (fallback: #fdf5e6) — input background (parchment)
   - `--text-color` (fallback: #4a2c2a) — input text color
   - `--accent-teal` (fallback: #008080) — focus ring, edit border, multi-select tint, links
   - `--aged-brown-light` (fallback: #a0522d) — drag handle color, completed section border
   - `--aged-brown-dark` (fallback: #4a2c2a) — drag handle hover color
2. THE Checklist_Zone SHALL use these hardcoded color values:
   - #999: trash icon default color
   - #a33: trash icon hover color
   - rgba(107, 78, 49, 0.04): row highlight on icon hover
   - rgba(107, 78, 49, 0.1): inline code background
   - rgba(107, 78, 49, 0.3): blockquote border
   - rgba(107, 78, 49, 0.08): pre/code block background
   - rgba(0, 128, 128, 0.25): input focus box-shadow
   - blue: drag-over border indicators
   - #ffffff: drag-over-on background
   - red: deleting animation background
   - #ccc: completed section border-top
   - #8b5a2b: inline checklist drag indicator (brown)

### Requirement 49: Edge Cases and Boundary Conditions

**User Story:** As a developer reproducing this system, I want to know every edge case, so that I can handle all boundary conditions identically.

#### Acceptance Criteria

1. WHEN the checklist is empty (no items), THE Checklist_Zone SHALL show only the Input_Field with no completed section visible
2. WHEN all items are checked, THE Checklist_Zone SHALL show an empty unchecked area with only the Input_Field, and the Completed Section containing all items
3. WHEN an item's text is empty and Enter is pressed during editing (split), THE Checklist_Zone SHALL create a new empty item below (split still works on empty text)
4. WHEN the first item in the list is attempted to be indented, THE Checklist_Zone SHALL refuse (no preceding item to be child of)
5. WHEN an item at level 0 is attempted to be unindented, THE Checklist_Zone SHALL refuse (already at minimum)
6. WHEN pasting clipboard content that is empty or contains only whitespace lines, THE Checklist_Zone SHALL not create any items
7. WHEN a ghost parent item is rendered in the Completed Section, THE Checklist_Zone SHALL NOT make it draggable or editable (it's display-only context)
8. WHEN the same item appears as both a ghost parent and a checked item (impossible by definition — ghost items are unchecked parents), THE Checklist_Zone SHALL only render it once as a ghost
9. WHEN multiple items are selected and the "Check" action is performed, THE Checklist_Zone SHALL check each selected item AND all their descendants (cascading)
10. WHEN dragging an item that has descendants, THE Checklist_Zone SHALL prevent dropping onto any of those descendants (would create circular reference)
11. WHEN the undo stack is at maximum (50) and a new state is pushed, THE Checklist_Zone SHALL remove the OLDEST state (shift from front of array)
12. WHEN commitPendingContent is called with both input text AND an active edit, THE Checklist_Zone SHALL commit BOTH (input text as new item, edit text saved to item)

### Requirement 50: Flash Arrow Indicator

**User Story:** As a developer reproducing this system, I want to know the add-item visual feedback, so that I can replicate the arrow flash.

#### Acceptance Criteria

1. WHEN a new item is added via the Input_Field (Enter key), THE Checklist_Zone SHALL call `_flashChecklistAddArrow()` to provide visual feedback
2. THE arrow indicator SHALL briefly flash to show the user where the new item was added (at the bottom of the unchecked list)

### Requirement 51: Debounce Pending Visual State

**User Story:** As a developer reproducing this system, I want to know the debounce visual indicator, so that I can replicate the save-pending feedback.

#### Acceptance Criteria

1. WHEN the Input_Field has a pending debounce (class `debounce-pending`), THE Checklist_Zone SHALL apply: border-color var(--accent-teal, #008080), box-shadow 0 0 0 2px rgba(0, 128, 128, 0.15)
2. THE debounce-pending state SHALL indicate that a save is queued but not yet executed

### Requirement 52: Item Count Display Update Logic

**User Story:** As a developer reproducing this system, I want to know when and how the count updates, so that I can replicate the header count behavior.

#### Acceptance Criteria

1. THE `_updateCount()` method SHALL be called after every render
2. THE count display SHALL show "(checked / total)" when total > 0, or empty string when total = 0
3. THE "Delete checked items" menu item visibility SHALL be updated in `_updateCount()`: shown when any checked items exist, hidden otherwise
