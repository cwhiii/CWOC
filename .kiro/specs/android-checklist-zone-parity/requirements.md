# Requirements Document

## Introduction

This specification defines the requirements for making the Android app's checklist zone in the chit editor functionally and visually identical to the mobile browser version. The authoritative reference is `Tasks/Android Mobile Implementation/checklist-zone-mobile-browser-spec.md`. The current Android implementation must be completely replaced — swipe-to-erase, up/down arrows, collapsible zone behavior, and all other non-conforming behaviors are removed and replaced with the mobile browser's behavior.

The goal is pixel-perfect behavioral parity: a user must not be able to distinguish whether they are using the mobile browser or the Android app.

## Glossary

- **Checklist_Zone**: The checklist editing area within the Android chit editor, containing the add-item input, unchecked items, completed section, and zone header controls
- **Item**: A single checklist entry with id, text, level, checked state, and parent reference
- **Drag_Handle**: The ⠿ (6-dot braille) touch target on each item used to initiate vertical drag reordering or horizontal swipe indent/outdent
- **Select_Strip**: The thin vertical strip on the right edge of each item (showing ⋮) used to toggle multi-select
- **Multi_Select_Toolbar**: The toolbar that appears when items are selected, providing bulk actions (Check, Delete, Move, Indent, Outdent, Clear, Select All)
- **Data_Menu**: The bottom sheet menu triggered by the Data button in the zone header, providing clipboard, cleanup, conversion, send, print, and auto-save operations
- **Completed_Section**: The collapsible section below unchecked items that displays checked items with ghost parent context
- **Ghost_Parent**: A non-interactive ancestor item rendered in the completed section to provide hierarchy context for checked child items
- **Inline_Editing**: The mode where tapping item text replaces the text span with a textarea for direct editing with keyboard shortcuts
- **Undo_Stack**: A stack of up to 50 JSON snapshots of all items, used for undo/redo operations
- **Auto_Save**: The debounced (2-second) automatic PATCH to persist checklist changes with visual status indicators
- **Send_To_Chit**: The operation of moving one or more checklist items (with subtrees) to another chit's checklist
- **Subtree**: An item and all its descendants (children, grandchildren, etc.) which move, delete, and check as a unit
- **MAX_INDENT_LEVEL**: The maximum nesting depth for items, fixed at 4 levels (0–4)
- **Check_Animation**: The visual sequence when an item is checked: strikethrough + green flash → fade + slide right → move to completed section
- **Delete_Animation**: The visual sequence when an item is deleted: red background + fade to zero opacity → removal
- **Flash_Arrow**: The ↓ arrow animation that appears at the right edge of the add-item input when a new item is created

## Requirements

### Requirement 1: Zone Layout and Non-Collapsible Behavior

**User Story:** As a user, I want the checklist zone to fill available space and not be collapsible on mobile, so that I have maximum editing area and consistent behavior with the mobile browser.

#### Acceptance Criteria

1. WHILE the chit editor is open on the Android app, THE Checklist_Zone SHALL fill the full available vertical space below the zone header
2. WHEN the user taps the zone header on the Android app, THE Checklist_Zone SHALL NOT collapse or expand — the tap has no effect on zone visibility
3. THE Checklist_Zone SHALL display a zone header containing: the title "✅ Checklist" with an inline count "(checked / total)", a Data_Menu button, a spacer, an Undo button (↺), a Redo button (↻), and a zone indicator icon (🔽)
4. THE Checklist_Zone SHALL render the add-item input at the top of the zone body, followed by unchecked items, followed by the Completed_Section

### Requirement 2: Add New Item Input

**User Story:** As a user, I want to add new checklist items by typing in an input field and pressing Enter, so that item creation is fast and matches the browser experience.

#### Acceptance Criteria

1. THE Checklist_Zone SHALL display a text input at the top of the checklist container with placeholder text "Add new item (Enter to add)"
2. WHEN the user types text and presses Enter, THE Checklist_Zone SHALL create a new unchecked Item at the bottom of the unchecked list, clear the input, and display the Flash_Arrow animation
3. WHEN the user presses Escape in the add-item input, THE Checklist_Zone SHALL trigger the editor's cancel/exit flow
4. THE Checklist_Zone SHALL style the add-item input with full width, 8px padding, 16px font size, Lora font, 1px solid border (--border-color), 4px border-radius, parchment background, and brown text color
5. WHEN the add-item input receives focus, THE Checklist_Zone SHALL change the border color to teal (--accent-teal) and add a 1px teal box-shadow

### Requirement 3: Flash Arrow Animation

**User Story:** As a user, I want visual feedback when I add an item, so that I can confirm the action succeeded.

#### Acceptance Criteria

1. WHEN a new item is added via the input field, THE Checklist_Zone SHALL display a "↓" arrow at the right edge of the input (right: 10px, vertically centered)
2. THE Checklist_Zone SHALL animate the arrow by fading in (opacity 0→1) with a slight downward translate, then fading out after a brief moment
3. THE Checklist_Zone SHALL style the arrow in teal color (--accent-teal), font-size 1.2em, bold weight

### Requirement 4: Checklist Item Rendering

**User Story:** As a user, I want checklist items to display with a drag handle, checkbox, markdown-rendered text, send icon, delete icon, and select strip, so that all interaction affordances are visible and match the browser.

#### Acceptance Criteria

1. THE Checklist_Zone SHALL render each unchecked Item as a row containing (left to right): Drag_Handle (⠿), checkbox, text wrapper with markdown-rendered text, send icon (📤), delete icon (✕), and Select_Strip (⋮)
2. THE Checklist_Zone SHALL render the Drag_Handle at opacity 0.8, font-size 1.3em, with padding 0 6px 0 0, and touch-action: none
3. THE Checklist_Zone SHALL render the send icon (📤) and delete icon (✕) as always visible on mobile (pointer: coarse)
4. THE Checklist_Zone SHALL render the Select_Strip as a vertical strip on the right edge (width 18px, absolute positioned) with a ⋮ indicator at 40% opacity
5. THE Checklist_Zone SHALL apply left padding of (level × 20px) to each item to represent nesting depth, supporting levels 0 through 4 (MAX_INDENT_LEVEL)
6. THE Checklist_Zone SHALL render item text as markdown using marked.js, supporting bold, italic, strikethrough, code, links (teal colored), images (max-height 1.4em), blockquotes, and lists

### Requirement 5: Touch Drag Reordering

**User Story:** As a user, I want to reorder checklist items by touching the drag handle and dragging vertically, so that I can organize items without the old up/down arrow buttons.

#### Acceptance Criteria

1. WHEN the user touches the Drag_Handle and drags vertically, THE Checklist_Zone SHALL initiate a touch drag operation that moves the item (and its Subtree) to the drop position
2. WHILE dragging vertically, THE Checklist_Zone SHALL display drop indicators on the target item: blue border-top when over the top third (insert above), blue border-bottom when over the bottom third (insert below), white background when over the middle third (nest as child)
3. WHEN the item is dropped in the "above" position, THE Checklist_Zone SHALL insert the item before the target at the same level as the target
4. WHEN the item is dropped in the "below" position, THE Checklist_Zone SHALL insert the item after the target and all of the target's children, at the same level as the target
5. WHEN the item is dropped in the "on" position (middle third), THE Checklist_Zone SHALL make the item a child of the target (level = target.level + 1), inserted after the target's last descendant
6. THE Checklist_Zone SHALL move the entire Subtree (item and all descendants) together during drag operations
7. THE Checklist_Zone SHALL NOT use up/down arrow buttons for reordering — only touch drag via the Drag_Handle is supported

### Requirement 6: Swipe to Indent/Outdent

**User Story:** As a user, I want to swipe right to indent and swipe left to outdent items, so that I can adjust hierarchy with natural touch gestures matching the browser.

#### Acceptance Criteria

1. WHEN the user swipes right on the Drag_Handle with horizontal movement exceeding 40px (and horizontal > 2× vertical), THE Checklist_Zone SHALL indent the item and its Subtree one level
2. WHEN the user swipes left on the Drag_Handle with horizontal movement exceeding 40px (and horizontal > 2× vertical), THE Checklist_Zone SHALL outdent the item and its Subtree one level
3. IF the item is already at MAX_INDENT_LEVEL (4), THEN THE Checklist_Zone SHALL ignore the swipe-right gesture
4. IF the item is already at level 0, THEN THE Checklist_Zone SHALL ignore the swipe-left gesture
5. WHEN a horizontal swipe is detected, THE Checklist_Zone SHALL cancel any vertical drag operation in progress
6. THE Checklist_Zone SHALL NOT implement swipe-to-erase or swipe-to-delete on items — swiping is exclusively for indent/outdent
7. WHEN indenting, THE Checklist_Zone SHALL set the item's parent to the nearest preceding item at (new level - 1)

### Requirement 7: Inline Editing

**User Story:** As a user, I want to tap item text to edit it inline with full keyboard shortcuts (Enter to split, Tab to indent, markdown formatting), so that editing matches the browser experience.

#### Acceptance Criteria

1. WHEN the user taps on item text or the text wrapper, THE Checklist_Zone SHALL replace the text span with a textarea for inline editing
2. WHILE inline editing is active, THE Checklist_Zone SHALL auto-resize the textarea height to fit content (min-height 1.6em)
3. WHEN the user presses Enter during inline editing, THE Checklist_Zone SHALL split the item at the cursor position: text before cursor stays, text after cursor becomes a new item below inheriting the same level and parent, and editing starts on the new item at position 0
4. WHEN the user presses Shift+Enter during inline editing, THE Checklist_Zone SHALL insert a literal newline in the textarea
5. WHEN the user presses Tab during inline editing, THE Checklist_Zone SHALL indent the current item one level (if valid)
6. WHEN the user presses Shift+Tab during inline editing, THE Checklist_Zone SHALL outdent the current item one level (if level > 0)
7. WHEN the user presses Escape during inline editing, THE Checklist_Zone SHALL cancel editing and revert to the pre-edit text
8. WHEN the textarea loses focus (blur), THE Checklist_Zone SHALL save the current text, remove the textarea, restore the text span, and re-render markdown
9. THE Checklist_Zone SHALL update item text on every keystroke (per-keystroke save to model) without pushing to the Undo_Stack
10. WHEN the user presses Arrow Up at position 0, THE Checklist_Zone SHALL navigate to the previous item (cursor at end)
11. WHEN the user presses Arrow Down at end of text, THE Checklist_Zone SHALL navigate to the next item (cursor at position 0)
12. WHEN the user presses Cmd+B, Cmd+I, or other markdown formatting hotkeys during inline editing, THE Checklist_Zone SHALL apply the formatting to selected text
13. WHILE inline editing is active, THE Checklist_Zone SHALL NOT allow multi-select mode activation

### Requirement 8: Check Animation

**User Story:** As a user, I want a smooth animation when checking items (strikethrough → fade → move to completed), so that the visual feedback matches the browser.

#### Acceptance Criteria

1. WHEN the user taps a checkbox to check an item, THE Checklist_Zone SHALL apply strikethrough text decoration and a subtle green background flash (rgba(0, 128, 0, 0.06))
2. WHEN the check animation begins, THE Checklist_Zone SHALL after 100ms fade the item to opacity 0 with a translateX(10px) slide over 150ms
3. WHEN the fade animation completes (250ms total from check), THE Checklist_Zone SHALL move the item to the Completed_Section and re-render
4. WHEN the user unchecks an item from the Completed_Section, THE Checklist_Zone SHALL immediately move it back to the unchecked list without reverse animation
5. WHEN a parent item is checked, THE Checklist_Zone SHALL also check all of its descendant items

### Requirement 9: Delete Animation

**User Story:** As a user, I want a red fade-out animation when deleting items, so that deletion has clear visual feedback matching the browser.

#### Acceptance Criteria

1. WHEN the user taps the delete icon (✕), THE Checklist_Zone SHALL animate the item with a red background and fade to opacity 0 over 500ms
2. WHEN 300ms have elapsed after delete initiation, THE Checklist_Zone SHALL remove the item and all its descendants from the items array and re-render
3. THE Checklist_Zone SHALL push an undo state before deletion so the action can be reversed via undo

### Requirement 10: Completed Section with Ghost Parents

**User Story:** As a user, I want a collapsible completed section that shows checked items with ghost parent context, so that I can review completed work with hierarchy preserved.

#### Acceptance Criteria

1. WHEN checked items exist, THE Checklist_Zone SHALL display a Completed_Section below all unchecked items with a header showing "Completed (N)" and a collapse/expand toggle (▶ collapsed, ▼ expanded)
2. THE Checklist_Zone SHALL start the Completed_Section in collapsed state — the user must tap the header to expand
3. WHEN a checked item has an unchecked ancestor, THE Checklist_Zone SHALL render that ancestor as a Ghost_Parent in the Completed_Section at the correct indent level
4. THE Checklist_Zone SHALL render Ghost_Parent items as non-interactive (no checkbox toggle, no editing, no drag)
5. THE Checklist_Zone SHALL render completed items with the same controls as unchecked items (drag handle, send icon, delete icon, select strip) and a checked checkbox
6. WHEN no checked items exist, THE Checklist_Zone SHALL hide the Completed_Section entirely (display: none)

### Requirement 11: Multi-Select Mode

**User Story:** As a user, I want to select multiple items via the select strip, Ctrl+tap, or Shift+tap for range selection, so that I can perform bulk operations matching the browser.

#### Acceptance Criteria

1. WHEN the user taps the Select_Strip (⋮) on any item, THE Checklist_Zone SHALL toggle that item's selection and enter multi-select mode
2. WHEN the user performs Ctrl/Cmd+tap on any item row, THE Checklist_Zone SHALL toggle that item's selection
3. WHEN the user performs Shift+tap on a Select_Strip, THE Checklist_Zone SHALL range-select all items from the last selection anchor to the tapped item
4. WHILE multi-select mode is active, THE Checklist_Zone SHALL highlight selected items with a teal background (rgba(0, 128, 128, 0.06)), 1px teal outline, and show ✓ in white on the select strip
5. WHILE multi-select mode is active, THE Checklist_Zone SHALL disable inline editing (pointer-events: none on text) and disable dragging on unselected items
6. WHEN the user presses Escape during multi-select mode, THE Checklist_Zone SHALL clear all selections and exit multi-select mode

### Requirement 12: Multi-Select Toolbar

**User Story:** As a user, I want a toolbar with bulk actions (Select All, Check, Delete, Move, Indent, Outdent, Clear) when items are selected, so that I can operate on multiple items efficiently.

#### Acceptance Criteria

1. WHEN one or more items are selected, THE Multi_Select_Toolbar SHALL appear below the add-item input showing "N selected" count and action buttons
2. THE Multi_Select_Toolbar SHALL provide a "All" button that selects all unchecked items
3. THE Multi_Select_Toolbar SHALL provide a "Check" button that marks all selected items as checked and moves them to the Completed_Section
4. THE Multi_Select_Toolbar SHALL provide a "Delete" button that confirms via cwocConfirm then deletes all selected items
5. THE Multi_Select_Toolbar SHALL provide a "Move" button that opens the send-to-chit search modal for batch move
6. THE Multi_Select_Toolbar SHALL provide an "Indent" button that indents all selected items one level (where valid)
7. THE Multi_Select_Toolbar SHALL provide an "Outdent" button that outdents all selected items one level (where valid)
8. THE Multi_Select_Toolbar SHALL provide a "✕" (Clear) button that clears selection and exits multi-select mode
9. WHEN a bulk action (Check, Delete, Move) completes, THE Checklist_Zone SHALL automatically clear selection and exit multi-select mode

### Requirement 13: Undo and Redo

**User Story:** As a user, I want undo/redo buttons in the zone header and keyboard shortcuts, so that I can reverse mistakes matching the browser behavior.

#### Acceptance Criteria

1. THE Checklist_Zone SHALL maintain an Undo_Stack of up to 50 JSON snapshots of all items
2. WHEN the user taps the Undo button (↺) in the zone header, THE Checklist_Zone SHALL restore the previous snapshot and re-render
3. WHEN the user taps the Redo button (↻) in the zone header, THE Checklist_Zone SHALL restore the next snapshot from the redo stack and re-render
4. WHILE the undo stack is empty, THE Checklist_Zone SHALL display the Undo button in a disabled (greyed out) state
5. WHILE the redo stack is empty, THE Checklist_Zone SHALL display the Redo button in a disabled (greyed out) state
6. THE Checklist_Zone SHALL push an undo state before any structural change: add item, delete item, check/uncheck, drag-drop, indent/outdent, clear checked, multi-select actions, and on blur/finish of inline editing
7. THE Checklist_Zone SHALL NOT push undo states on per-keystroke text edits during inline editing
8. WHEN a new action pushes to the undo stack, THE Checklist_Zone SHALL clear the redo stack

### Requirement 14: Data Menu (Bottom Sheet)

**User Story:** As a user, I want a Data menu that opens as a bottom sheet on mobile with clipboard, cleanup, conversion, send, print, and auto-save options, so that I have full feature parity with the browser.

#### Acceptance Criteria

1. WHEN the user taps the Data button in the zone header, THE Data_Menu SHALL open as a bottom sheet (fixed to bottom, full width, rounded top corners 12px, shadow, z-index 2000) with a backdrop overlay
2. THE Data_Menu SHALL provide "Paste as list items" which reads clipboard text, parses each line as a checklist item (respecting markdown checkbox format, indentation, list markers), appends to the checklist, and shows an undo toast
3. THE Data_Menu SHALL provide "Copy incomplete to clipboard" which copies all unchecked items as markdown checklist lines (- [ ] text with 2-space indent per level) and shows a count toast
4. THE Data_Menu SHALL provide "Delete checked items" (visible only when checked items exist) which confirms via cwocConfirm then removes all checked items
5. THE Data_Menu SHALL provide "Delete unchecked items" which confirms via cwocConfirm then removes all unchecked items
6. THE Data_Menu SHALL provide "Clean up empty items" which removes all items with empty/whitespace-only text without confirmation
7. THE Data_Menu SHALL provide "Move to note" which converts all items to markdown task list format, appends to the Notes field, clears the checklist, and shows an undo toast
8. THE Data_Menu SHALL provide "Send to another chit" which opens the send-content modal to move the entire checklist to another chit
9. THE Data_Menu SHALL provide "Print checklist" which opens a print-friendly view of all items with hierarchy
10. THE Data_Menu SHALL provide "Auto-save: On/Off" toggle which cycles the per-chit auto-save override (use global → force opposite → back to global)
11. WHEN the user taps outside the Data_Menu or taps the backdrop, THE Data_Menu SHALL close

### Requirement 15: Auto-Save with Visual Indicators

**User Story:** As a user, I want auto-save with "changes pending" and "✓ saved" indicators, so that I know my changes are being persisted without manual action.

#### Acceptance Criteria

1. WHEN auto-save is enabled and a change occurs, THE Checklist_Zone SHALL display a "changes pending" indicator (yellow text, color #b8860b, 0.75em) immediately
2. WHEN auto-save is enabled, THE Checklist_Zone SHALL debounce changes for 2 seconds then PATCH the checklist to the server
3. WHEN the auto-save PATCH succeeds, THE Checklist_Zone SHALL hide the pending indicator and display "✓ saved" (teal text, color #008080, 0.75em) that fades out after 2 seconds
4. IF the auto-save PATCH fails, THEN THE Checklist_Zone SHALL fall back to marking the save button as unsaved (manual save required)
5. WHILE inline editing is active, THE Checklist_Zone SHALL perform per-keystroke auto-save (updating the model immediately on each input event, with the 2-second debounce for server persistence)

### Requirement 16: Send to Chit Functionality

**User Story:** As a user, I want to send individual items, multi-selected items, or the entire checklist to another chit, so that I can reorganize work across chits.

#### Acceptance Criteria

1. WHEN the user taps the send icon (📤) on an item, THE Checklist_Zone SHALL open a search modal where the user can search for a target chit, then move the item and its Subtree to the target chit's checklist
2. WHEN the user taps "Move" in the Multi_Select_Toolbar, THE Checklist_Zone SHALL open the same search modal and move all selected items as a batch to the target chit
3. WHEN the user selects "Send to another chit" from the Data_Menu, THE Checklist_Zone SHALL open the send-content modal to move the entire checklist to the target chit
4. WHEN items are sent to another chit, THE Checklist_Zone SHALL remove those items from the current checklist after successful transfer

### Requirement 17: Note to Checklist and Checklist to Note Conversion

**User Story:** As a user, I want to convert between notes and checklist items with undo toasts, so that I can restructure content flexibly.

#### Acceptance Criteria

1. WHEN "Move to note" is selected from the Data_Menu, THE Checklist_Zone SHALL convert each item to markdown task list format (- [ ] text or - [x] text with 2-space indent per level), append to the Notes field, clear the checklist, and show an undo toast "📝 Moved checklist to notes"
2. WHEN Note-to-Checklist conversion is triggered from the Notes zone, THE Checklist_Zone SHALL parse each non-empty line of the note into items (recognizing markdown checkboxes, list markers, and indentation), clear the note, and show an undo toast "📋 Moved notes to checklist"
3. THE Checklist_Zone SHALL support undo on both conversion directions via the undo toast's Undo button

### Requirement 18: Clipboard Operations

**User Story:** As a user, I want to paste text as checklist items and copy incomplete items to clipboard, so that I can move data in and out of the checklist.

#### Acceptance Criteria

1. WHEN "Paste as list items" is selected from the Data_Menu, THE Checklist_Zone SHALL read clipboard text, parse each line as a checklist item (respecting markdown checkbox format `- [ ]`/`- [x]`, list markers `- `, `* `, `1. `, and indentation), append items to the checklist, and show an undo toast "📋 Pasted N items"
2. IF clipboard access is denied, THEN THE Checklist_Zone SHALL show a warning toast "⚠️ Clipboard access denied"
3. WHEN "Copy incomplete to clipboard" is selected from the Data_Menu, THE Checklist_Zone SHALL copy all unchecked items as markdown checklist lines (- [ ] text with 2-space indent per level) and show a toast "📋 Copied N items"
4. IF no incomplete items exist when copying, THEN THE Checklist_Zone SHALL show a toast "⚠️ No incomplete items to copy"

### Requirement 19: Nested Items and Hierarchy

**User Story:** As a user, I want items nested up to 4 levels deep with 20px indent per level and proper parent-child relationships, so that I can organize items hierarchically.

#### Acceptance Criteria

1. THE Checklist_Zone SHALL support item nesting from level 0 to level 4 (MAX_INDENT_LEVEL = 4)
2. THE Checklist_Zone SHALL apply 20px of left padding per indent level to visually represent hierarchy
3. WHEN an item is indented, THE Checklist_Zone SHALL set its parent to the nearest preceding item at (new level - 1)
4. WHEN an item is deleted, THE Checklist_Zone SHALL delete its entire Subtree (all descendants)
5. WHEN an item is dragged, THE Checklist_Zone SHALL move its entire Subtree together maintaining relative levels
6. WHEN a parent item is checked, THE Checklist_Zone SHALL also check all descendant items

### Requirement 20: Multi-Drag in Multi-Select Mode

**User Story:** As a user, I want to drag multiple selected items as a unit, so that I can reorder groups of items together.

#### Acceptance Criteria

1. WHILE multi-select mode is active and the user drags a selected item, THE Checklist_Zone SHALL move ALL selected items as a unit
2. WHILE multi-dragging, THE Checklist_Zone SHALL apply opacity 0.5 to all selected items
3. THE Checklist_Zone SHALL maintain the relative order and levels of all selected items during multi-drag
4. WHILE multi-select mode is active, THE Checklist_Zone SHALL only allow dragging on selected items (unselected items have draggable=false)

### Requirement 21: Auto-Complete Checklist Button

**User Story:** As a user, I want the Auto-Complete button in the Task zone header (not the checklist zone), so that task status can auto-update based on checklist completion.

#### Acceptance Criteria

1. THE Checklist_Zone SHALL NOT contain an Auto-Complete button — the button lives in the Task zone header
2. WHEN Auto-Complete is enabled and all non-blank checklist items are checked (and all prerequisites are complete), THE Checklist_Zone SHALL trigger the chit status to change to "Complete"
3. WHEN Auto-Complete is enabled and any item becomes unchecked or a new unchecked item is added, THE Checklist_Zone SHALL trigger the chit status to revert to "ToDo"

### Requirement 22: Pending Content Detection

**User Story:** As a user, I want the editor to detect uncommitted content (text in the input or active inline editing) before exit, so that I never lose work.

#### Acceptance Criteria

1. WHEN the editor's exit/save flow is triggered, THE Checklist_Zone SHALL report pending content if the add-item input has non-empty text or an item is being inline-edited
2. WHEN pending content is detected and the user confirms save, THE Checklist_Zone SHALL commit the pending content (create item from input text, save inline edit) before saving

### Requirement 23: Removal of Non-Conforming Android Behaviors

**User Story:** As a user, I want all legacy Android-specific checklist behaviors removed, so that the experience is identical to the mobile browser.

#### Acceptance Criteria

1. THE Checklist_Zone SHALL NOT implement swipe-to-erase or swipe-to-delete gestures on items
2. THE Checklist_Zone SHALL NOT display up/down arrow buttons for reordering
3. THE Checklist_Zone SHALL NOT be collapsible on mobile — tapping the zone header has no effect on zone visibility
4. THE Checklist_Zone SHALL NOT restrict vertical space usage — the zone fills all available space
5. THE Checklist_Zone SHALL NOT display an auto-save button on the main editor screen — auto-save toggle lives exclusively in the Data_Menu
