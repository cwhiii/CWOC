# Requirements Document

## Introduction

This document specifies the complete behavior of the Checklist Zone feature in CWOC (C.W.'s Omni Chits). The Checklist Zone exists in two contexts: the **Editor** (chit editor page with full editing capabilities) and the **Dashboard** (Checklists tab with inline interactive cards). This specification is exhaustive — a developer can reproduce the feature with 100% fidelity using only this document.

## Glossary

- **Checklist_Zone**: The collapsible section in the chit editor (`#checklistSection`) that contains the input field, unchecked items, and completed section
- **Checklist_Item**: A single entry in a checklist, containing id, text, level, checked state, and parent reference
- **Editor**: The chit editor page (`editor.html`) where chits are created and modified
- **Dashboard_Checklists_View**: The Checklists tab on the main dashboard showing chit cards with inline interactive checklists
- **Checklist_Class**: The JavaScript class (`Checklist`) that manages all editor checklist behavior
- **Item_ID**: A string identifier in format "item-" followed by 9 random alphanumeric characters
- **Nesting_Level**: An integer 0–4 representing indentation depth (MAX_INDENT_LEVEL = 4)
- **Parent_Reference**: A string Item_ID or null, establishing tree hierarchy
- **Subtree**: An item plus all its recursive descendants (children, grandchildren, etc.)
- **Ghost_Item**: An unchecked parent item displayed faded in the Completed section for context
- **Undo_Stack**: A LIFO stack of JSON snapshots (max 50) representing previous checklist states
- **Redo_Stack**: A LIFO stack of JSON snapshots representing undone states, cleared on new actions
- **Multi_Select_Mode**: A state where multiple items are selected for batch operations
- **Select_Strip**: A thin vertical bar on the right edge of each item used for selection
- **Data_Menu**: The dropdown menu (⋮ "Data" button) in the zone header providing bulk operations
- **Auto_Save**: A debounced (2-second) automatic PATCH to the server after checklist changes
- **Auto_Complete**: Automatic status change to "Complete" when all checklist items are checked
- **Drag_Position**: One of three zones (above/on/below) determined by cursor position within a target item
- **Inline_Editing**: A textarea that replaces item text for direct modification
- **Markdown_Rendering**: Processing item text through marked.js to support formatting (bold, italic, links, code, strikethrough, headers, lists, blockquotes)
- **cwocConfirm**: The shared confirmation modal function returning a Promise<boolean>
- **cwocUndoToast**: The shared undo toast function with countdown and undo callback
- **Send_To_Chit**: Moving items from one chit's checklist to another chit's checklist
- **Cross_Chit_Move**: Dragging a checklist item from one chit card to another on the dashboard
- **Parchment_Theme**: The 1940s aesthetic with brown tones, Lora serif font, and parchment textures

## Requirements

### Requirement 1: Checklist Data Model

**User Story:** As a developer, I want a precisely defined data model for checklist items, so that data can be stored, serialized, and deserialized with perfect fidelity.

#### Acceptance Criteria

1. THE Checklist_Zone SHALL store each Checklist_Item as a JSON object with exactly five fields: `id` (string), `text` (string), `level` (integer), `checked` (boolean), and `parent` (string or null)
2. WHEN generating a new Item_ID, THE Checklist_Class SHALL produce a string in the format "item-" concatenated with 9 random alphanumeric characters generated via `Math.random().toString(36).substr(2, 9)`
3. THE Checklist_Zone SHALL constrain the `level` field to integer values between 0 and 4 inclusive (MAX_INDENT_LEVEL = 4)
4. THE Checklist_Zone SHALL store the `parent` field as the Item_ID of the parent item for nested items, or null for top-level items
5. THE Checklist_Zone SHALL store the complete checklist as a JSON array in the chit's `checklist` field
6. THE Checklist_Zone SHALL recognize the chit field `auto_complete_checklist` (boolean, default true) controlling automatic status completion
7. THE Checklist_Zone SHALL recognize the chit field `checklist_autosave` (boolean or null) as a per-chit override for the global auto-save setting, where null means "use global setting"
8. THE Checklist_Item SHALL support markdown content in the `text` field including bold, italic, links, inline code, strikethrough, headers, lists, and blockquotes

### Requirement 2: Editor Zone Structure and Layout

**User Story:** As a user, I want the checklist zone to have a consistent, collapsible structure with header controls, so that I can manage my checklist efficiently.

#### Acceptance Criteria

1. THE Checklist_Zone SHALL render inside a container element with id `checklistSection` and class `zone-container`
2. THE Checklist_Zone SHALL have a zone header (class `zone-header`) that collapses/expands the zone body when clicked
3. THE Checklist_Zone SHALL display the title "✅ Checklist" in the zone header as an h2 element with class `zone-title`
4. THE Checklist_Zone SHALL display a count in the zone title formatted as "(checked / total)" showing the number of checked items and total items
5. WHEN the checklist has zero items, THE Checklist_Zone SHALL display no count text
6. THE Checklist_Zone SHALL display zone action buttons in the header in this exact order from left to right: Data menu (⋮ icon + "Data" label) | spacer element (class `location-actions-spacer`) | Undo button (↺) | Redo button (↻) | zone toggle icon (🔽)
7. THE Checklist_Zone SHALL have a zone body (id `checklistContent`, class `zone-body`) containing: the text input at top, unchecked items below the input, and the completed section at the bottom
8. WHEN the zone toggle icon is clicked, THE Checklist_Zone SHALL collapse or expand the zone body

### Requirement 3: Input Field Behavior

**User Story:** As a user, I want a text input field at the top of the checklist zone, so that I can quickly add new items.

#### Acceptance Criteria

1. THE Checklist_Zone SHALL render a text input element (type "text") with class `checklist-input` as the first child of the checklist container
2. THE Checklist_Zone SHALL display placeholder text "Add new item (Enter to add)" in the input field
3. WHEN the user presses Enter with non-empty text in the input, THE Checklist_Zone SHALL create a new Checklist_Item with that text at level 0, append it to the items array, clear the input field, and trigger a green arrow flash animation (via `_flashChecklistAddArrow`)
4. WHEN the user presses Enter with empty or whitespace-only text in the input, THE Checklist_Zone SHALL take no action
5. WHEN the user presses Escape in the input field, THE Checklist_Zone SHALL invoke the `cancelOrExit` function (triggering the page exit flow with unsaved-changes check)
6. WHEN the user presses Cmd+Z (or Ctrl+Z) in the input field, THE Checklist_Zone SHALL invoke the undo operation
7. WHEN the user presses Cmd+Shift+Z in the input field, THE Checklist_Zone SHALL invoke the redo operation
8. WHEN the user presses a markdown formatting hotkey (Cmd+B for bold, Cmd+I for italic) in the input field, THE Checklist_Zone SHALL apply the corresponding markdown formatting to the selected text via `_emailFormatBtn`

### Requirement 4: Unchecked Item Rendering

**User Story:** As a user, I want each unchecked checklist item to display with a drag handle, checkbox, formatted text, and action icons, so that I can interact with items in multiple ways.

#### Acceptance Criteria

1. THE Checklist_Zone SHALL render each unchecked item as a div element with class `checklist-item`, attribute `draggable="true"`, and `data-id` set to the item's ID
2. THE Checklist_Item SHALL contain a left container div (class `left-container`) with `padding-left` equal to `level * 20` pixels
3. THE Checklist_Item SHALL display a 6-dot drag handle (⠿) as the first element in the left container, with class `checklist-drag-handle`, title "Drag to reorder", cursor grab, opacity 0.5 normally and 1.0 on hover
4. THE Checklist_Item SHALL display an unchecked checkbox input (type "checkbox") after the drag handle
5. THE Checklist_Item SHALL display a text wrapper div (class `text-wrapper`) containing a text span (class `checklist-text`) with `white-space: pre-wrap`
6. THE Checklist_Zone SHALL render the item's text content through marked.js full parse with `breaks: true`, stripping the outer `<p>` wrapper for single-line items, removing any `<input>` checkboxes generated by GFM task list syntax, and setting `tabindex="-1"` on all rendered links
7. WHEN marked.js is not available, THE Checklist_Zone SHALL fall back to setting `textContent` directly
8. THE Checklist_Item SHALL display a send icon (📤) with class `checklist-send-icon`, title "Send to another chit", visible only on hover (visibility: hidden → visible on mouseenter)
9. THE Checklist_Item SHALL display a delete icon (✕) with class `trash-icon`, title "Delete item", visible only on hover (visibility: hidden → visible on mouseenter)
10. THE Checklist_Item SHALL display a multi-select strip div (class `checklist-select-strip`) on the right edge, always present in the DOM, showing ⋮ in muted color normally and ✓ with teal background when selected

### Requirement 5: Completed Section

**User Story:** As a user, I want completed items grouped in a collapsible section below unchecked items, so that I can focus on remaining work while still accessing completed items.

#### Acceptance Criteria

1. THE Checklist_Zone SHALL render a completed section container (class `completed-checklist-container`) below all unchecked items
2. THE Checklist_Zone SHALL display the completed section only when at least one checked item exists (display: none when zero checked items)
3. THE Checklist_Zone SHALL render a completed section header containing: an h3 "Completed" title, a count span showing "(N)" where N is the number of checked items, a flex spacer, and a toggle arrow icon
4. THE Checklist_Zone SHALL start the completed section in collapsed state (body display: none, toggle arrow showing "▶")
5. WHEN the completed section header is clicked (excluding button clicks), THE Checklist_Zone SHALL toggle the body visibility and switch the arrow between "▶" (collapsed) and "▼" (expanded)
6. THE Checklist_Zone SHALL render completed items with class `completed-checklist-item` inside the completed section body
7. THE Checklist_Zone SHALL render ghost parent items (unchecked parents of checked items) with class `ghost-checklist-item` in the completed section for hierarchical context
8. THE Checklist_Zone SHALL render ghost items as non-interactive (faded appearance, no editing capability)
9. THE Checklist_Zone SHALL display a border-top separator (1px solid, aged-brown-light color) with 6px margin-top on the completed section header
10. THE Checklist_Zone SHALL determine ghost parents by walking up the parent chain of each checked item and including any unchecked ancestors not already in the checked set

### Requirement 6: Inline Editing

**User Story:** As a user, I want to click on item text to edit it inline with a textarea, so that I can modify items without leaving the checklist context.

#### Acceptance Criteria

1. WHEN the user clicks on item text (`.checklist-text` span) or the text wrapper div, THE Checklist_Zone SHALL open an inline textarea (class `checklist-edit-input`) replacing the text display
2. WHEN inline editing starts, THE Checklist_Zone SHALL set the parent item element's `draggable` attribute to "false" to prevent drag interference
3. THE Checklist_Zone SHALL auto-size the textarea height to match content on every input event (set height to "auto" then to scrollHeight + "px")
4. THE Checklist_Zone SHALL update the item's text on every input event (per-keystroke auto-save via `_notifyChangeQuiet`) without pushing to the undo stack
5. WHEN a click event provides coordinates, THE Checklist_Zone SHALL position the cursor at the click location by measuring text width character-by-character using a canvas 2d context with the textarea's computed font
6. WHEN no click coordinates are available, THE Checklist_Zone SHALL position the cursor at the end of the text
7. WHEN the user presses Enter (without Shift), THE Checklist_Zone SHALL split the item at the cursor position: text before cursor stays in current item, text after cursor becomes a new item inserted after the current item's subtree at the same level with the same parent, and the new item auto-focuses with cursor at position 0
8. WHEN the user presses Shift+Enter, THE Checklist_Zone SHALL allow the default textarea behavior (inserting a newline for multi-line items)
9. WHEN the user presses Escape during editing, THE Checklist_Zone SHALL cancel the edit (revert to pre-edit text via `finishEditing(false)`)
10. WHEN the textarea loses focus (blur event), THE Checklist_Zone SHALL save the edit (invoke `finishEditing(true)`)
11. THE Checklist_Zone SHALL NOT auto-remove empty items on blur — empty items persist until explicitly removed via "Clean up empty items" from the Data menu
12. WHEN editing is active and Multi_Select_Mode is active, THE Checklist_Zone SHALL prevent editing from starting (early return in `startEditing`)
13. WHEN editing finishes, THE Checklist_Zone SHALL re-enable `draggable="true"` on the item element, remove the textarea, restore the text span display, re-render markdown, and clear the `editingItem` reference

### Requirement 7: Inline Editing Keyboard Shortcuts

**User Story:** As a user, I want comprehensive keyboard shortcuts while editing an item, so that I can efficiently navigate, indent, and format without using the mouse.

#### Acceptance Criteria

1. WHEN the user presses Tab during editing, THE Checklist_Zone SHALL indent the item by one level if: the item is not the first item (idx > 0), the item's level is less than MAX_INDENT_LEVEL (4), and the item's current level is less than or equal to the previous item's level
2. WHEN the user presses Shift+Tab during editing, THE Checklist_Zone SHALL unindent the item by one level if the item's level is greater than 0
3. WHEN the user presses Cmd+] during editing, THE Checklist_Zone SHALL indent the single item only (not descendants), subject to the same constraints as Tab
4. WHEN the user presses Cmd+[ during editing, THE Checklist_Zone SHALL unindent the single item only (not descendants), if level > 0
5. WHEN the user presses Cmd+Shift+) during editing, THE Checklist_Zone SHALL indent the item and all its descendants by one level, subject to MAX_INDENT_LEVEL constraint
6. WHEN the user presses Cmd+Shift+( during editing, THE Checklist_Zone SHALL unindent the item and all its descendants by one level, if level > 0
7. WHEN the user presses ArrowUp with cursor at position 0, THE Checklist_Zone SHALL navigate to the previous unchecked item (searching backward), saving current text, finishing editing, and starting editing on the target with cursor at end
8. WHEN the user presses ArrowDown with cursor at the end of text, THE Checklist_Zone SHALL navigate to the next unchecked item (searching forward), saving current text, finishing editing, and starting editing on the target with cursor at position 0
9. WHEN the user presses Cmd+Z during editing, THE Checklist_Zone SHALL first attempt browser-level undo (`document.execCommand('undo')`); if the textarea value is unchanged after that attempt, THE Checklist_Zone SHALL invoke checklist-level undo (finishing editing without save, then calling `undo()`)
10. WHEN the user presses Cmd+Shift+Z during editing, THE Checklist_Zone SHALL invoke browser-level redo (`document.execCommand('redo')`)
11. WHEN the user presses a markdown formatting hotkey (Cmd+B, Cmd+I, etc.) during editing, THE Checklist_Zone SHALL apply the formatting via `_emailFormatBtn` and trigger textarea auto-size
12. THE Checklist_Zone SHALL call `e.stopPropagation()` on all keydown events within the editing textarea to prevent parent handlers from intercepting
13. WHEN indent or outdent is performed during editing, THE Checklist_Zone SHALL finish editing with save, re-render, notify change, and then re-open editing on the same item after a setTimeout(0)
14. WHEN indent is performed, THE Checklist_Zone SHALL reassign the item's parent to the nearest preceding item at level-1
15. WHEN unindent is performed on a single item, THE Checklist_Zone SHALL call `_reassignFollowingSiblings` to reassign former siblings that follow the promoted item to become children of the promoted item

### Requirement 8: Checking and Unchecking Items

**User Story:** As a user, I want to check and uncheck items with visual animations and automatic subtree updates, so that I get satisfying feedback and hierarchical consistency.

#### Acceptance Criteria

1. WHEN the user checks an item's checkbox, THE Checklist_Zone SHALL push an undo state, set the item's `checked` to true, and recursively set all descendants' `checked` to true
2. WHEN an item is checked, THE Checklist_Zone SHALL animate the transition: first add class `checklist-checking` (strikethrough + green background), wait 100ms, then add class `checklist-checking-fade` (fade + translateX(10px)), wait 150ms, then re-render (moving item to completed section)
3. WHEN the user unchecks an item's checkbox, THE Checklist_Zone SHALL push an undo state, set the item's `checked` to false, recursively set all descendants' `checked` to false, and re-render immediately (no animation)
4. WHEN `auto_complete_checklist` is true and all non-empty items become checked, THE Checklist_Zone SHALL set the chit's status to "Complete" (via the status select element)
5. WHEN `auto_complete_checklist` is true, auto-archive is enabled, and all items are checked, THE Checklist_Zone SHALL also set the archived flag to true and update the archive button visual
6. WHEN any item is unchecked and the chit status was "Complete" (on the dashboard), THE Dashboard_Checklists_View SHALL revert the status to "ToDo"
7. WHEN Multi_Select_Mode is active and a checkbox is clicked, THE Checklist_Zone SHALL block the toggle (revert checkbox to previous state) and take no action
8. THE Checklist_Zone SHALL update the count display and invoke the onChange callback after every check/uncheck operation

### Requirement 9: Item Deletion

**User Story:** As a user, I want to delete items with a visual animation and automatic subtree removal, so that deletion feels responsive and complete.

#### Acceptance Criteria

1. WHEN the user clicks the delete icon (✕) on an item, THE Checklist_Zone SHALL add the class "deleting" to the item element (triggering a CSS animation), wait 300ms, then push an undo state and remove the item plus all its descendants from the items array
2. THE Checklist_Zone SHALL NOT display a confirmation dialog for single-item deletion
3. WHEN the delete icon is clicked while the item is being edited, THE Checklist_Zone SHALL clear the editing state (set `editingItem` to null, remove textarea, restore text span) before proceeding with deletion
4. THE Checklist_Zone SHALL use `mousedown` (not `click`) on the delete icon with `e.preventDefault()` to prevent textarea blur from firing before the delete handler
5. THE Checklist_Zone SHALL re-render, update the count, invoke the onChange callback, and update undo/redo buttons after deletion completes

### Requirement 10: Desktop Drag and Drop

**User Story:** As a user, I want to drag items to reorder them and nest them under other items, so that I can organize my checklist hierarchically.

#### Acceptance Criteria

1. THE Checklist_Zone SHALL set `draggable="true"` on all item elements (unchecked, completed, and ghost)
2. WHEN drag starts, THE Checklist_Zone SHALL set the dragged element's opacity to 0.5 (via "dragging" class), store the dragged item and its complete subtree, set `effectAllowed` to "move", and set data transfer with the item ID
3. WHEN dragging over a target item, THE Checklist_Zone SHALL divide the target into vertical thirds: top third shows "above" indicator (class `drag-over-above`, blue border-top), middle third shows "on" indicator (class `drag-over-on`, white background), bottom third shows "below" indicator (class `drag-over-below`, blue border-bottom)
4. WHEN an item is dropped in the "above" position, THE Checklist_Zone SHALL insert the dragged subtree at the same level as the target with the same parent, positioned immediately before the target in the array
5. WHEN an item is dropped in the "below" position, THE Checklist_Zone SHALL insert the dragged subtree at the same level as the target with the same parent, positioned after the target's entire subtree in the array
6. WHEN an item is dropped in the "on" position, THE Checklist_Zone SHALL make the dragged item a child of the target (level = target.level + 1), set parent to target's ID, and insert after the target's existing children
7. WHEN an item is dropped, THE Checklist_Zone SHALL update all subtree items' levels using `_updateSubLevels` which calculates the delta from the current root level to the new root level and applies it uniformly to preserve relative hierarchy
8. THE Checklist_Zone SHALL prevent dropping an item onto its own descendants (check if target is in draggedSubtree)
9. WHEN an item is moved between the active zone and completed zone, THE Checklist_Zone SHALL update the `checked` state of the entire dragged subtree to match the target zone
10. THE Checklist_Zone SHALL push an undo state before executing any drop operation
11. THE Checklist_Zone SHALL clear all drag indicators on dragLeave and after drop

### Requirement 11: Touch/Mobile Drag and Drop

**User Story:** As a mobile user, I want to reorder items by vertical drag and indent/unindent by horizontal swipe, so that I can organize my checklist on touch devices.

#### Acceptance Criteria

1. THE Checklist_Zone SHALL use the `enableTouchDrag` utility to attach touch event handlers to each item element
2. WHEN a horizontal swipe is detected (>40px horizontal movement AND horizontal distance exceeds vertical distance by 2x ratio), THE Checklist_Zone SHALL treat it as an indent/unindent gesture rather than a reorder
3. WHEN a rightward swipe is detected, THE Checklist_Zone SHALL indent the item and its entire subtree by one level, subject to the same constraints as Tab indent (must have preceding item at same or higher level, max level 4)
4. WHEN a leftward swipe is detected, THE Checklist_Zone SHALL unindent the item and its entire subtree by one level, if level > 0
5. WHEN vertical drag dominates (no swipe threshold met), THE Checklist_Zone SHALL use the same reorder logic as desktop: find the element under the touch point, divide it into thirds, show the same drag-over indicators, and execute the same drop behavior
6. WHEN a swipe has been handled, THE Checklist_Zone SHALL NOT execute drop logic on touch end (flag `_touchSwipeHandled`)
7. THE Checklist_Zone SHALL push an undo state before any touch-initiated indent/unindent or reorder operation
8. THE Checklist_Zone SHALL add class "dragging" to the item on touch start and remove it on touch end
9. THE Checklist_Zone SHALL clear all drag indicators from sibling items during touch move and on touch end

### Requirement 12: Multi-Select Activation and Visual State

**User Story:** As a user, I want to select multiple items for batch operations using Ctrl/Cmd+click, Shift+click, or the select strip, so that I can efficiently manage groups of items.

#### Acceptance Criteria

1. WHEN the user Ctrl/Cmd+clicks anywhere on an item row (excluding checkbox, trash, send icon, and select strip), THE Checklist_Zone SHALL toggle that item's selection state and set it as the anchor for future Shift+clicks
2. WHEN the user clicks the select strip (right edge) of an item, THE Checklist_Zone SHALL toggle that item's selection state
3. WHEN the user Shift+clicks an item (and an anchor exists from a previous selection), THE Checklist_Zone SHALL add all items in the range from anchor to clicked item to the current selection (additive, does not clear existing selection)
4. WHEN at least one item is selected, THE Checklist_Zone SHALL enter Multi_Select_Mode: add class `checklist-multiselect-active` to the container, disable text editing (pointer-events: none on text), block checkbox toggles, and make only selected items draggable
5. WHEN Multi_Select_Mode is active and the user presses Escape, THE Checklist_Zone SHALL clear all selections and exit Multi_Select_Mode (handler registered in capture phase with `stopPropagation` and `preventDefault` to prevent other ESC handlers from firing)
6. THE Checklist_Zone SHALL visually indicate selected items by adding class `checklist-multi-selected` to the item element and class `selected` to the select strip
7. THE Checklist_Zone SHALL set `draggable="false"` on unselected items and `draggable="true"` on selected items when in Multi_Select_Mode
8. WHEN the select strip is hovered, THE Checklist_Zone SHALL show a teal background highlight
9. THE Checklist_Zone SHALL use `mousedown` (not `click`) on the select strip with `e.preventDefault()` to prevent textarea blur interference

### Requirement 13: Multi-Select Toolbar

**User Story:** As a user, I want a toolbar with batch actions when items are selected, so that I can check, delete, move, indent, or outdent multiple items at once.

#### Acceptance Criteria

1. WHEN at least one item is selected, THE Checklist_Zone SHALL display a multi-select toolbar (class `checklist-multiselect-toolbar`) inserted immediately after the input field
2. THE Checklist_Zone SHALL display the toolbar with these elements in order: count span ("[N] selected"), "All" button, "Check" button (with checkmark icon), "Delete" button (with trash icon), "Move" button (with paper-plane icon), "Indent" button (with indent icon), "Outdent" button (with outdent icon), "✕" clear button
3. WHEN the "All" button is clicked, THE Checklist_Zone SHALL select all unchecked items
4. WHEN the "Check" button is clicked, THE Checklist_Zone SHALL push an undo state, mark all selected items and their subtrees as checked, clear the selection, re-render, and notify change
5. WHEN the "Delete" button is clicked, THE Checklist_Zone SHALL show a cwocConfirm dialog ("Delete N selected item(s)?", title "Delete Selected", danger: true, confirmLabel: "Delete"), and if confirmed, push an undo state, remove all selected items, clear selection, re-render, and notify change
6. WHEN the "Move" button is clicked, THE Checklist_Zone SHALL open the send-to-chit search modal for batch transfer of all selected items
7. WHEN the "Indent" button is clicked, THE Checklist_Zone SHALL push an undo state and indent each selected item individually (respecting constraints: must have preceding item at same or higher level, max level 4), then re-render and update selection visuals
8. WHEN the "Outdent" button is clicked, THE Checklist_Zone SHALL push an undo state and outdent each selected item individually (if level > 0), then re-render and update selection visuals
9. WHEN the "✕" button is clicked, THE Checklist_Zone SHALL clear all selections and remove the toolbar
10. WHEN selection count reaches zero, THE Checklist_Zone SHALL remove the toolbar from the DOM

### Requirement 14: Multi-Select Drag

**User Story:** As a user, I want to drag all selected items as a unit when in multi-select mode, so that I can reposition groups of items together.

#### Acceptance Criteria

1. WHEN Multi_Select_Mode is active and the user starts dragging a selected item, THE Checklist_Zone SHALL initiate a multi-drag: collect all selected items in their current list order as the "subtree", set effectAllowed to "move", and mark all selected items with class "dragging"
2. WHEN Multi_Select_Mode is active and the user starts dragging an unselected item, THE Checklist_Zone SHALL prevent the drag (call `e.preventDefault()`)
3. WHEN a multi-drag drop occurs in "above" or "below" position, THE Checklist_Zone SHALL keep items at their original relative levels and reposition them as a group
4. WHEN a multi-drag drop occurs in "on" position, THE Checklist_Zone SHALL calculate a level delta from the first selected item's level to (target.level + 1) and apply it to all selected items, capping at MAX_INDENT_LEVEL
5. THE Checklist_Zone SHALL restore multi-select visuals (selection highlighting and toolbar) after re-render following a multi-drag drop

### Requirement 15: Undo and Redo System

**User Story:** As a user, I want a robust undo/redo system that captures all destructive operations, so that I can safely experiment with my checklist organization.

#### Acceptance Criteria

1. THE Checklist_Zone SHALL maintain an undo stack with a maximum of 50 JSON snapshot states, where each state is a serialized array of all items (id, text, level, checked, parent)
2. THE Checklist_Zone SHALL maintain a redo stack that is cleared whenever a new action pushes to the undo stack
3. WHEN undo is invoked, THE Checklist_Zone SHALL save the current state to the redo stack, pop the last state from the undo stack, restore items from that state, re-render, update count, invoke onChange callback, and update button states
4. WHEN redo is invoked, THE Checklist_Zone SHALL save the current state to the undo stack, pop the last state from the redo stack, restore items from that state, re-render, update count, invoke onChange callback, and update button states
5. THE Checklist_Zone SHALL display the undo button (↺, title "Undo (Cmd+Z)") in the zone header with class `zone-button notes-undo-redo`, disabled when the undo stack is empty
6. THE Checklist_Zone SHALL display the redo button (↻, title "Redo (Cmd+Shift+Z)") in the zone header with class `zone-button notes-undo-redo`, disabled when the redo stack is empty
7. THE Checklist_Zone SHALL push an undo state before these operations: delete, check/uncheck, drag-drop, indent/outdent, clear checked items, delete unchecked items, clean empty items, paste items, note-to-checklist conversion, and all multi-select batch operations
8. THE Checklist_Zone SHALL NOT push a duplicate state if the current state is identical to the last state on the undo stack (JSON string comparison)
9. WHEN the undo stack exceeds 50 entries, THE Checklist_Zone SHALL remove the oldest entry (shift from front)
10. WHEN items are loaded fresh (via `loadItems`), THE Checklist_Zone SHALL reset both undo and redo stacks to empty

### Requirement 16: Data Menu

**User Story:** As a user, I want a Data menu with bulk operations for clipboard, cleanup, conversion, and printing, so that I can manage my checklist data efficiently.

#### Acceptance Criteria

1. THE Checklist_Zone SHALL display a Data menu button in the zone header with a vertical ellipsis icon (fas fa-ellipsis-v) and label "Data" (hidden when narrow via class `hideWhenNarrow`), wrapped in a relative-positioned container
2. WHEN the Data menu button is clicked, THE Checklist_Zone SHALL toggle a dropdown menu (class `zone-more-menu`) between display "flex" and display "none"
3. WHEN the Data menu is open and the user clicks anywhere outside it, THE Checklist_Zone SHALL close the menu (via a one-time document click listener registered after a setTimeout(0))
4. THE Checklist_Zone SHALL display menu items in this exact order: (1) Paste as list items, (2) Copy incomplete to clipboard, (3) Delete checked items, (4) Delete unchecked items, (5) Clean up empty items, (6) Move to note, (7) Send to another chit, (8) Print checklist, (9) Auto-save toggle
5. THE Checklist_Zone SHALL display each menu item as a button with a Font Awesome icon and text label
6. THE Checklist_Zone SHALL hide the "Delete checked items" button when no checked items exist (display: none)

### Requirement 17: Paste as List Items

**User Story:** As a user, I want to paste clipboard text as individual checklist items with intelligent parsing of markdown checkboxes, list markers, and indentation, so that I can quickly import structured content.

#### Acceptance Criteria

1. WHEN "Paste as list items" is selected from the Data menu, THE Checklist_Zone SHALL read text from the clipboard via `navigator.clipboard.readText()`
2. IF clipboard access is denied, THE Checklist_Zone SHALL show a toast "⚠️ Clipboard access denied" and take no further action
3. IF clipboard text is empty or whitespace-only, THE Checklist_Zone SHALL take no action
4. THE Checklist_Zone SHALL split clipboard text by newlines and process each non-empty line
5. FOR EACH line, THE Checklist_Zone SHALL detect indent level: 4 spaces or 1 tab = 1 level, 2 spaces = 1 level (applied iteratively from the start of the line)
6. FOR EACH line, THE Checklist_Zone SHALL detect markdown checkbox format matching pattern `^[-*]\s+\[([ xX])\]\s*` and extract checked state (x/X = checked, space = unchecked)
7. IF no markdown checkbox is detected, THE Checklist_Zone SHALL strip list markers matching patterns: `^[-*•]\s+` (bullet markers) and `^\d+[.)]\s+` (numbered markers)
8. IF no markdown checkbox is detected, THE Checklist_Zone SHALL check for legacy checkbox format matching pattern `^\[([ xX])\]\s*` at the start of the stripped text
9. THE Checklist_Zone SHALL skip lines that are empty after stripping markers and whitespace
10. THE Checklist_Zone SHALL cap indent levels at MAX_INDENT_LEVEL (4)
11. THE Checklist_Zone SHALL assign parent IDs by scanning backward from each item to find the nearest preceding item at level-1
12. THE Checklist_Zone SHALL snapshot the current items before pasting (for undo), append new items to the existing items array, re-render, notify change, and show an undo toast "📋 Pasted N item(s)"

### Requirement 18: Copy Incomplete to Clipboard

**User Story:** As a user, I want to copy all unchecked items to the clipboard in markdown checklist format, so that I can share or transfer my remaining tasks.

#### Acceptance Criteria

1. WHEN "Copy incomplete to clipboard" is selected from the Data menu, THE Checklist_Zone SHALL filter all items where `checked` is false
2. IF no unchecked items exist, THE Checklist_Zone SHALL show a toast "⚠️ No incomplete items to copy" and take no further action
3. THE Checklist_Zone SHALL format each unchecked item as a markdown checklist line: 2-space indent repeated per level, followed by `- [ ] `, followed by the item text
4. THE Checklist_Zone SHALL join all formatted lines with newline characters and write to clipboard via `navigator.clipboard.writeText()`
5. THE Checklist_Zone SHALL show a toast "📋 Copied N item(s)" on successful clipboard write

### Requirement 19: Delete Checked Items

**User Story:** As a user, I want to permanently remove all checked items after confirmation, so that I can clean up completed work.

#### Acceptance Criteria

1. WHEN "Delete checked items" is selected from the Data menu, THE Checklist_Zone SHALL count checked items
2. IF zero checked items exist, THE Checklist_Zone SHALL take no action
3. THE Checklist_Zone SHALL show a cwocConfirm dialog with message "Delete N checked item(s)?", title "Clear Checked", danger: true, confirmLabel: "Delete"
4. IF the user confirms, THE Checklist_Zone SHALL push an undo state, remove all items where `checked` is true, re-render, and notify change
5. IF the user cancels, THE Checklist_Zone SHALL take no action

### Requirement 20: Delete Unchecked Items

**User Story:** As a user, I want to permanently remove all unchecked items after confirmation, so that I can start fresh or clear irrelevant tasks.

#### Acceptance Criteria

1. WHEN "Delete unchecked items" is selected from the Data menu, THE Checklist_Zone SHALL count unchecked items
2. IF zero unchecked items exist, THE Checklist_Zone SHALL take no action
3. THE Checklist_Zone SHALL show a cwocConfirm dialog with message "Delete N unchecked item(s)?", title "Delete Unchecked", danger: true, confirmLabel: "Delete"
4. IF the user confirms, THE Checklist_Zone SHALL push an undo state, remove all items where `checked` is false (keeping only checked items), re-render, and notify change
5. IF the user cancels, THE Checklist_Zone SHALL take no action

### Requirement 21: Clean Up Empty Items

**User Story:** As a user, I want to remove all items with empty or whitespace-only text without confirmation, so that I can quickly tidy my checklist.

#### Acceptance Criteria

1. WHEN "Clean up empty items" is selected from the Data menu, THE Checklist_Zone SHALL count items where `text` is falsy or `text.trim()` is empty
2. IF zero empty items exist, THE Checklist_Zone SHALL take no action
3. THE Checklist_Zone SHALL push an undo state, remove all items with empty/whitespace-only text, re-render, and notify change
4. THE Checklist_Zone SHALL NOT show a confirmation dialog for this operation

### Requirement 22: Move to Note (Checklist → Note Conversion)

**User Story:** As a user, I want to convert my entire checklist into markdown text in the notes field, so that I can switch between structured and freeform representations.

#### Acceptance Criteria

1. WHEN "Move to note" is selected from the Data menu, THE Checklist_Zone SHALL convert all items to markdown format: 2-space indent per level, `- [x] ` for checked items, `- [ ] ` for unchecked items, followed by item text
2. THE Checklist_Zone SHALL join all lines with newline characters
3. IF the note field already has content, THE Checklist_Zone SHALL append the checklist text after the existing content with a blank line separator (trimEnd existing + "\n\n" + new text)
4. IF the note field is empty, THE Checklist_Zone SHALL set the note field value to the checklist text directly
5. THE Checklist_Zone SHALL clear the checklist (set items to empty array), re-render, and notify change
6. THE Checklist_Zone SHALL trigger `autoGrowNote` on the note textarea and mark the save button as unsaved
7. THE Checklist_Zone SHALL update the rendered notes view if it is currently visible
8. THE Checklist_Zone SHALL show an undo toast "📝 Moved checklist to notes" with an undo callback that restores both the previous note content and previous checklist items

### Requirement 23: Move from Note (Note → Checklist Conversion)

**User Story:** As a user, I want to convert note text into checklist items recognizing markdown checkboxes and list formatting, so that I can structure freeform notes into actionable items.

#### Acceptance Criteria

1. WHEN the "Move from note" button in the Notes zone header is clicked, THE Checklist_Zone SHALL read the note textarea value
2. IF the note is empty or whitespace-only, THE Checklist_Zone SHALL take no action
3. THE Checklist_Zone SHALL split the note by newlines and process each non-empty line using the same parsing logic as "Paste as list items": detect indent (4 spaces/tab = 1 level, 2 spaces = 1 level), detect markdown checkbox format (`[-*]\s+\[([ xX])\]\s*`), strip list markers (`[-*•]\s+`, `\d+[.)]\s+`), detect legacy checkbox format (`\[([ xX])\]\s*`)
4. THE Checklist_Zone SHALL assign parent IDs by scanning backward from each item to find the nearest preceding item at level-1
5. THE Checklist_Zone SHALL append new items to the existing checklist items, re-render, and notify change
6. THE Checklist_Zone SHALL clear the note field, trigger autoGrowNote, mark save as unsaved, and clear the rendered notes view
7. THE Checklist_Zone SHALL show an undo toast "📋 Moved notes to checklist" with an undo callback that restores both the previous note content and previous checklist items

### Requirement 24: Send to Another Chit (Per-Item)

**User Story:** As a user, I want to send individual items (with their subtrees) to another chit's checklist, so that I can redistribute tasks between chits.

#### Acceptance Criteria

1. WHEN the send icon (📤) on an item is hovered, THE Checklist_Zone SHALL make it visible (visibility: visible)
2. WHEN the send icon is clicked (via mousedown with preventDefault), THE Checklist_Zone SHALL first commit any active edit text for that item (if the item is currently being edited, read textarea value into item.text, clear editingItem, remove textarea, restore text span)
3. THE Checklist_Zone SHALL then open the send-to-chit search modal (via `_openSendItemPopup`) passing the item and checklist instance
4. THE Checklist_Zone SHALL move the item and its entire subtree to the target chit's checklist when a target is selected

### Requirement 25: Send Entire Checklist to Another Chit

**User Story:** As a user, I want to send my entire checklist to another chit, so that I can transfer all items in bulk.

#### Acceptance Criteria

1. WHEN "Send to another chit" is selected from the Data menu, THE Checklist_Zone SHALL open the send-content modal (via `_openSendContentModal`) with content type "checklist"
2. THE Checklist_Zone SHALL transfer all checklist items to the selected target chit

### Requirement 26: Print Checklist

**User Story:** As a user, I want to print my checklist with an option to include or exclude completed items, so that I can produce a physical reference.

#### Acceptance Criteria

1. WHEN "Print checklist" is selected from the Data menu, THE Checklist_Zone SHALL open a print modal (via `_printChecklist`)
2. THE Checklist_Zone SHALL display a checkbox option "Include completed items" (default: unchecked)
3. THE Checklist_Zone SHALL display a "Print" button that opens the browser's native print dialog with a formatted checklist
4. THE Checklist_Zone SHALL display a "Cancel" button that closes the modal

### Requirement 27: Auto-Save System

**User Story:** As a user, I want my checklist changes to be automatically saved to the server after a brief delay, so that I don't lose work without manual save actions.

#### Acceptance Criteria

1. THE Checklist_Zone SHALL respect a global auto-save setting (`checklist_autosave` in user settings, default "1" = enabled)
2. THE Checklist_Zone SHALL respect a per-chit auto-save override (`checklist_autosave` field on the chit: null = use global, true = force on, false = force off)
3. WHEN auto-save is active and a change occurs, THE Checklist_Zone SHALL debounce for 2 seconds after the last change, then issue a PATCH request to the server with just the checklist data
4. WHILE a debounce timer is pending, THE Checklist_Zone SHALL display a visual indicator on the input field (class `debounce-pending`)
5. WHEN the page exit flow is triggered while a debounce timer is pending, THE Checklist_Zone SHALL force an immediate save (flush the pending timer)
6. WHEN "Auto-save" is selected from the Data menu, THE Checklist_Zone SHALL cycle the per-chit override through states: global default → force on → force off → global default
7. THE Checklist_Zone SHALL display the current auto-save state in the menu button text: "Auto-save: On" (global on), "Auto-save: On (chit)" (per-chit forced on), "Auto-save: Off" (global off), "Auto-save: Off (chit)" (per-chit forced off)

### Requirement 28: Auto-Complete System

**User Story:** As a user, I want my chit to automatically change status to "Complete" when all checklist items are checked, so that task completion is tracked without manual status changes.

#### Acceptance Criteria

1. THE Checklist_Zone SHALL check the `auto_complete_checklist` field on the chit (default true) to determine if auto-complete is enabled
2. WHEN auto-complete is enabled and all non-empty items (items with non-whitespace text) become checked, THE Checklist_Zone SHALL set the chit's status select element to "Complete" and invoke `onStatusChange`
3. WHEN auto-complete is enabled, auto-archive is also enabled, and all items are checked, THE Checklist_Zone SHALL set the archived hidden input to "true" and update the archive button to show "📦 Archived" with class `archived-active`
4. THE Checklist_Zone SHALL provide a toggle (via `_toggleChecklistAutoComplete`) that cycles through three states: Off → Auto-Complete → Auto-Complete + Archive → Off
5. THE Checklist_Zone SHALL mark the save button as unsaved after any auto-complete state change
6. THE Checklist_Zone SHALL evaluate auto-complete after every check operation (called from `toggleCheck` and `_notifyChange`)

### Requirement 29: Dashboard Checklists View — Card Rendering

**User Story:** As a user, I want to see my chits with checklists displayed as interactive cards on the dashboard, so that I can quickly check off items without opening the editor.

#### Acceptance Criteria

1. THE Dashboard_Checklists_View SHALL display only chits that have non-empty checklist items (at least one item with non-whitespace text)
2. THE Dashboard_Checklists_View SHALL sort cards by default: pinned chits first, then by checked ratio (least complete first — fewest checked items relative to total)
3. THE Dashboard_Checklists_View SHALL display each card header with: the chit title (linked to the editor page) and a progress count span (class `checklist-progress-count`, data-chit-id attribute) showing "(checked/total)" or "(checked/total ✓)" when all items are done
4. THE Dashboard_Checklists_View SHALL render only UNCHECKED items inline on each card (checked items are hidden, counted in the header progress)
5. THE Dashboard_Checklists_View SHALL render each inline item as an `<li>` element with: padding-left based on level (level * 18 + 4 px), flex display, align-items center, gap 6px, cursor grab, font-size 0.95em, line-height 1.4, min-height 1.8em
6. THE Dashboard_Checklists_View SHALL render each inline item containing: a 6-dot drag handle (⠿, class `checklist-drag-handle`), a checkbox input, and a text span with markdown rendering (via `renderChecklistItemMarkdown`)
7. THE Dashboard_Checklists_View SHALL set `draggable="true"` on each inline item with `data-idx` (array index) and `data-chit-id` attributes
8. THE Dashboard_Checklists_View SHALL use a masonry/column layout (same as Notes view)
9. THE Dashboard_Checklists_View SHALL support manual sort order persistence (drag cards to reorder)

### Requirement 30: Dashboard Checklists View — Inline Interactions

**User Story:** As a user, I want to check off items directly on dashboard cards and see immediate visual feedback, so that I can manage tasks without opening the editor.

#### Acceptance Criteria

1. WHEN a checkbox is checked on a dashboard card, THE Dashboard_Checklists_View SHALL call `toggleChecklistItem` (PATCH to server), set the item's checked state to true, hide the `<li>` element (display: none), and update the progress count
2. WHEN all items on a card become checked, THE Dashboard_Checklists_View SHALL add class `checklist-all-done` to the card (causing title strikethrough)
3. WHEN any item is unchecked (and not all are done), THE Dashboard_Checklists_View SHALL remove class `checklist-all-done` from the card
4. WHEN auto-complete is enabled on the chit and a checkbox is toggled, THE Dashboard_Checklists_View SHALL trigger a dashboard refresh after a 300ms delay (via `fetchChits` or `displayChits`) to reflect server-side status changes
5. WHEN viewer-role shared chits are displayed, THE Dashboard_Checklists_View SHALL render them as read-only (no checkboxes, no drag handles, no interaction)

### Requirement 31: Dashboard Checklists View — Drag and Drop

**User Story:** As a user, I want to drag items to reorder within a card and between cards on the dashboard, so that I can reorganize without opening the editor.

#### Acceptance Criteria

1. WHEN an item is dragged within the same chit card, THE Dashboard_Checklists_View SHALL call `moveChecklistItem` (reorder within the chit's checklist array and PUT to server)
2. WHEN an item is dragged from one chit card to another, THE Dashboard_Checklists_View SHALL call `moveChecklistItemCrossChit` (remove from source chit, insert into target chit, PUT both to server)
3. THE Dashboard_Checklists_View SHALL use drag data type `application/x-checklist-item` with JSON payload containing `chitId` and `idx`
4. THE Dashboard_Checklists_View SHALL show a brown border-top indicator (2px solid #8b5a2b) on the target item during dragover
5. THE Dashboard_Checklists_View SHALL support dropping onto the list container itself (not on a specific item) to append to the end of the chit's checklist
6. THE Dashboard_Checklists_View SHALL support touch drag via `enableTouchDrag` with the same reorder and cross-chit move behavior
7. WHEN a touch drag ends over a target item in a different chit, THE Dashboard_Checklists_View SHALL identify the target chit from the `data-chit-id` attribute on the target `<li>` or parent `<ul>`
8. THE Dashboard_Checklists_View SHALL set opacity 0.4 on the dragged item during drag and restore to 1 on drag end
9. THE Dashboard_Checklists_View SHALL invoke the `onUpdate` callback after any successful move to trigger a view refresh

### Requirement 32: Markdown Rendering

**User Story:** As a user, I want my checklist item text to support rich markdown formatting, so that I can include formatted content like bold text, links, and code snippets.

#### Acceptance Criteria

1. THE Checklist_Zone SHALL render item text using `marked.parse(text, { breaks: true })` for full markdown support including block-level elements (headers, lists, numbered lists, blockquotes) and inline formatting (bold, italic, links, code, strikethrough)
2. WHEN the item text is single-line (does not contain "\n"), THE Checklist_Zone SHALL strip the outer `<p>...</p>` wrapper from the parsed HTML using regex `^<p>(.*)<\/p>\s*$` with dotAll flag
3. THE Checklist_Zone SHALL remove any `<input>` elements from the parsed HTML (generated by GFM task list syntax) using regex `<input[^>]*>`
4. THE Checklist_Zone SHALL set `tabindex="-1"` on all rendered `<a>` elements to prevent them from participating in tab order
5. WHEN marked.js is not available (typeof marked === 'undefined'), THE Checklist_Zone SHALL fall back to setting `el.textContent = text`
6. WHEN text is empty or falsy, THE Checklist_Zone SHALL set `el.textContent = ''`

### Requirement 33: Pending Content Detection and Commit

**User Story:** As a developer, I want the checklist to report and commit pending content before page exit, so that no user input is lost.

#### Acceptance Criteria

1. THE Checklist_Class SHALL provide a `hasPendingContent()` method that returns true if the input field has non-empty text OR if an item is currently being edited
2. THE Checklist_Class SHALL provide a `commitPendingContent()` method that: (a) if the input has non-empty text, creates a new item with that text and clears the input; (b) if an item is being edited, reads the textarea value into the item's text and clears editing state
3. WHEN `commitPendingContent` commits any content, THE Checklist_Class SHALL invoke `_notifyChange` and return true
4. WHEN `commitPendingContent` has nothing to commit, THE Checklist_Class SHALL return false

### Requirement 34: CSS Styling — Editor Checklist Zone

**User Story:** As a user, I want the checklist zone to have consistent parchment-themed styling with proper spacing, colors, and interactive states, so that it matches the CWOC aesthetic.

#### Acceptance Criteria

1. THE Checklist_Zone SHALL style `.checklist-input` with: full width, 8px padding, border transitions on focus (teal accent color), matching the parchment theme font (Lora serif)
2. THE Checklist_Zone SHALL style `.checklist-item` with: flex display, align-items flex-start, position relative
3. THE Checklist_Zone SHALL style `.checklist-drag-handle` with: opacity 0.5, cursor grab, font-size 1.1em, color aged-brown, opacity 1.0 on hover
4. THE Checklist_Zone SHALL style `.checklist-text` with: white-space pre-wrap, word-break break-word, supporting all markdown-rendered elements
5. THE Checklist_Zone SHALL style `.checklist-edit-input` (textarea) with: full width, same font as text display, auto-height behavior, teal focus border
6. THE Checklist_Zone SHALL style drag indicators: `drag-over-above` with blue border-top, `drag-over-below` with blue border-bottom, `drag-over-on` with white background
7. THE Checklist_Zone SHALL style the "deleting" class with a CSS animation for item removal
8. THE Checklist_Zone SHALL style check animations: `checklist-checking` class adds strikethrough + green tint, `checklist-checking-fade` class adds fade + translateX(10px)
9. THE Checklist_Zone SHALL style multi-select elements with teal accent color throughout (select strip hover, selected state, toolbar)
10. THE Checklist_Zone SHALL be mobile responsive: compact padding, always-visible drag handles on touch devices, larger touch targets

### Requirement 35: Keyboard Shortcuts Summary

**User Story:** As a user, I want a complete set of keyboard shortcuts for efficient checklist management, so that I can work quickly without reaching for the mouse.

#### Acceptance Criteria

1. WHILE the input field is focused, THE Checklist_Zone SHALL respond to: Enter (add item), Escape (exit flow), Cmd+Z (undo), Cmd+Shift+Z (redo), Cmd+B/I/etc (markdown formatting)
2. WHILE inline editing is active, THE Checklist_Zone SHALL respond to: Enter (split item), Shift+Enter (newline), Escape (cancel edit), Tab (indent), Shift+Tab (unindent), Cmd+[ (unindent single), Cmd+] (indent single), Cmd+Shift+( (unindent subtree), Cmd+Shift+) (indent subtree), ArrowUp at pos 0 (navigate previous), ArrowDown at end (navigate next), Cmd+Z (undo), Cmd+Shift+Z (redo), Cmd+B/I/etc (markdown formatting)
3. WHILE Multi_Select_Mode is active, THE Checklist_Zone SHALL respond to: Escape in capture phase (clear selection, highest priority, stops propagation)
4. THE Checklist_Zone SHALL use Ctrl as the modifier key on non-Mac platforms (where Cmd is not available)

### Requirement 36: Tree Structure Integrity

**User Story:** As a developer, I want the tree structure (parent references and levels) to remain consistent after all operations, so that the hierarchy is always valid.

#### Acceptance Criteria

1. WHEN an item is indented, THE Checklist_Zone SHALL set its parent to the nearest preceding item at (new level - 1), found by scanning backward through the items array
2. WHEN an item is unindented, THE Checklist_Zone SHALL set its parent to the nearest preceding item at (new level - 1), or null if level becomes 0
3. WHEN an item with subtree is indented/unindented, THE Checklist_Zone SHALL update all subtree items' levels by the same delta and reassign direct children's parent to the root item's ID
4. WHEN a single item is unindented, THE Checklist_Zone SHALL call `_reassignFollowingSiblings` to reassign any following items that still point to the old parent (and are at level = promoted item's level + 1) to point to the promoted item instead
5. WHEN items are loaded via `loadItems`, THE Checklist_Zone SHALL cap all levels at MAX_INDENT_LEVEL (4) using `Math.min(item.level || 0, MAX_INDENT_LEVEL)`
6. WHEN a new item is added at level > 0, THE Checklist_Zone SHALL scan backward to find and assign the appropriate parent
7. THE Checklist_Zone SHALL use `getSubtree(item)` (recursive: item + all children's subtrees) for all operations that move or delete items with descendants
8. THE Checklist_Zone SHALL use `getChildren(item)` (filter items where parent === item.id) for direct child lookups
9. THE Checklist_Zone SHALL use `getParent(item)` (find item where id === item.parent) for parent lookups

### Requirement 37: Change Notification System

**User Story:** As a developer, I want a consistent change notification system that distinguishes between undo-worthy changes and quiet per-keystroke updates, so that the save system and undo stack stay in sync.

#### Acceptance Criteria

1. THE Checklist_Class SHALL provide `_notifyChange()` which: pushes an undo state, updates the count display, invokes the `onChangeCallback` with current checklist data, and evaluates auto-complete
2. THE Checklist_Class SHALL provide `_notifyChangeQuiet()` which: updates the count display and invokes the `onChangeCallback` with current checklist data, WITHOUT pushing to the undo stack (used for per-keystroke editing updates)
3. THE Checklist_Class SHALL accept an `onChangeCallback` function in the constructor that receives the serialized checklist data (array of {id, text, level, checked, parent} objects) on every change
4. THE Checklist_Class SHALL invoke the callback from: `_notifyChange`, `_notifyChangeQuiet`, `loadItems`, `undo`, `redo`, `toggleCheck`, and `deleteItem`

### Requirement 38: Dashboard API Integration

**User Story:** As a developer, I want the dashboard checklist interactions to use proper API calls for persistence, so that changes are saved to the server immediately.

#### Acceptance Criteria

1. WHEN a checkbox is toggled on the dashboard, THE Dashboard_Checklists_View SHALL fetch the full chit via `GET /api/chit/{chitId}`, update the checklist item's checked state in memory, evaluate auto-complete logic (if enabled, check if all non-blank items are checked and revert status to "ToDo" if not all checked and status was "Complete"), then PUT the full chit back via `PUT /api/chits/{chitId}`
2. WHEN an item is reordered within a chit on the dashboard, THE Dashboard_Checklists_View SHALL fetch the full chit, splice the item from its old position and insert at the new position, then PUT the full chit back
3. WHEN an item is moved between chits on the dashboard, THE Dashboard_Checklists_View SHALL fetch both chits in parallel, remove the item from the source chit's checklist, insert it into the target chit's checklist at the specified index, then PUT both chits back in parallel
4. IF the source and target chit are the same for a cross-chit move, THE Dashboard_Checklists_View SHALL delegate to the within-chit `moveChecklistItem` function instead
5. THE Dashboard_Checklists_View SHALL handle all API errors with try/catch and log to `console.error`

### Requirement 39: Progress Count Display

**User Story:** As a user, I want to see accurate progress counts that update in real-time as I check items, so that I always know my completion status.

#### Acceptance Criteria

1. THE Checklist_Zone (editor) SHALL display the count in the zone title as "(checked / total)" where total is all items and checked is items with `checked: true`
2. THE Dashboard_Checklists_View SHALL display the count in the card header as "(checked/total)" for incomplete chits or "(checked/total ✓)" when all non-empty items are checked
3. WHEN a checkbox is toggled on the dashboard, THE Dashboard_Checklists_View SHALL immediately update the progress count span (class `checklist-progress-count` with matching `data-chit-id`) by recalculating from the in-memory chit data
4. THE Dashboard_Checklists_View SHALL count only non-empty items (items with non-whitespace text) for the progress calculation
5. WHEN the editor count has zero total items, THE Checklist_Zone SHALL display empty string (no count shown)

### Requirement 40: Initialization and Loading

**User Story:** As a developer, I want the Checklist class to initialize correctly with proper DOM setup and data loading, so that the zone is ready for interaction immediately.

#### Acceptance Criteria

1. THE Checklist_Class SHALL accept three constructor parameters: `container` (DOM element), `initialItems` (array, default []), and `onChangeCallback` (function, default null)
2. THE Checklist_Class SHALL call `init()` in the constructor which: creates the count display and header buttons (`_createCountDisplay`), creates the input field (`createInput`), renders the initial state (`render`), and initializes the multi-select ESC handler (`_initMultiSelectEsc`)
3. WHEN `initialItems` is provided and is a non-empty array, THE Checklist_Class SHALL call `loadItems` which maps each item to the internal format (capping level at MAX_INDENT_LEVEL, defaulting missing fields), resets undo/redo stacks, renders, updates count, and invokes the onChange callback
4. THE Checklist_Class SHALL store items internally with the structure: `{ id, text, level, checked, parent }` where id defaults to a generated ID, text defaults to "", level defaults to 0 (capped at 4), checked defaults to false, parent defaults to null
5. THE Checklist_Class SHALL expose `getChecklistData()` which returns a clean array of `{ id, text, level, checked, parent }` objects (no internal state leakage)
6. THE Checklist_Class SHALL be assigned to `window.Checklist` for global access (no module system)
7. THE Checklist_Class SHALL store the active instance as `window.checklist` for cross-module access (e.g., from Notes zone header button)
