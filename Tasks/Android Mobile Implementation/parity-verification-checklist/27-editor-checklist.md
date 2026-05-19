# Checklist Zone

**Category:** Editor Zones
**Item #:** 27
**Code Verified:** ✅
**User Verified:** ⬜

## Source File
`src/frontend/js/editor/editor_checklists.js`

## Class: Checklist

### Constructor & State

- [ ] `constructor(container, initialItems, onChangeCallback)` — Initialize checklist with container, items, and change callback
- [ ] `this.items` — Array of checklist item objects {id, text, level, checked, parent}
- [ ] `this.draggedItem` — Currently dragged item reference
- [ ] `this.draggedSubtree` — Array of items being dragged (item + descendants)
- [ ] `this.dragOverItem` — Item being dragged over
- [ ] `this.dragOverPosition` — Position relative to drag target (above/below/on)
- [ ] `this.editingItem` — Currently editing item reference
- [ ] `this.onChangeCallback` — Callback fired on data change
- [ ] `this._pendingUndo` — Pending undo state
- [ ] `this._undoStack` — Array of JSON snapshots for undo (max 50)
- [ ] `this._redoStack` — Array of JSON snapshots for redo
- [ ] `this._maxUndoSize` — Maximum undo stack size (50)
- [ ] `this._selectedIds` — Set of selected item IDs (multi-select)
- [ ] `this._multiSelectMode` — Boolean: multi-select mode active
- [ ] `MAX_INDENT_LEVEL` — Constant: maximum nesting depth (4)

### Initialization

- [ ] `init()` — Create count display, input, render, init multi-select ESC handler
- [ ] `_initMultiSelectEsc()` — ESC clears multi-select (capture phase handler)
- [ ] `_createCountDisplay()` — Create header elements: count, undo/redo buttons, Data menu

### Header Controls

- [ ] Count display span — Shows "(checked / total)" in zone header
- [ ] Undo button (↺) — Undo last action (Cmd+Z)
- [ ] Redo button (↻) — Redo last undone action (Cmd+Shift+Z)
- [ ] Data menu button (⋮ Data) — Opens dropdown with data actions
- [ ] Data menu dropdown — Contains all data action buttons

### Data Menu Items

- [ ] "Paste as list items" button — Paste clipboard text as checklist items
- [ ] "Copy incomplete to clipboard" button — Copy unchecked items as markdown
- [ ] "Delete checked items" button — Remove all checked items (with confirm)
- [ ] "Delete unchecked items" button — Remove all unchecked items (with confirm)
- [ ] "Clean up empty items" button — Remove items with empty/whitespace text
- [ ] "Move to note" button — Convert checklist to markdown in note field
- [ ] "Send to another chit" button — Open send content modal
- [ ] "Print checklist" button — Print the checklist
- [ ] "Auto-save: On/Off" button — Toggle per-chit autosave override

### Input & Item Creation

- [ ] `createInput()` — Create the "Add new item" text input at top of container
- [ ] Add item input (`type="text"`) — Placeholder "Add new item (Enter to add)"
- [ ] Enter key in input — Adds new item, clears input, flashes arrow indicator
- [ ] Escape key in input — Calls cancelOrExit()
- [ ] Cmd/Ctrl+Z in input — Undo
- [ ] Cmd/Ctrl+Shift+Z in input — Redo
- [ ] Cmd/Ctrl+B/I/U in input — Markdown formatting (bold/italic/underline)
- [ ] `addNewItem(text, level, checked, id)` — Create and append a new item
- [ ] `generateId()` — Generate random item ID ("item-" + random string)

### Data Management

- [ ] `loadItems(itemsArray)` — Load items from array, reset undo/redo, render
- [ ] `getChecklistData()` — Return items as array of {id, text, level, checked, parent}
- [ ] `hasPendingContent()` — Check if input has text or item is being edited
- [ ] `commitPendingContent()` — Commit input text and active editing before exit

### Rendering

- [ ] `render()` — Full re-render: unchecked items, then completed section
- [ ] `_updateCount()` — Update count display and show/hide "Delete checked" menu item
- [ ] `createItemElement(item, isCompleted, isGhost)` — Create DOM element for a single item
- [ ] Completed section container — Collapsible section for checked items
- [ ] Completed section header — Click to expand/collapse, shows count
- [ ] Completed toggle icon (▶/▼) — Visual collapse state
- [ ] Ghost parent items — Show unchecked parents in completed section for context

### Item Element Controls

- [ ] Drag handle (⠿) — 6-dot indicator for drag-to-reorder
- [ ] Checkbox input — Toggle checked state
- [ ] Text span — Displays item text with markdown rendering
- [ ] Text wrapper — Click to edit (including empty space)
- [ ] Send icon (📤) — Send item to another chit (visible on hover)
- [ ] Trash icon (✕) — Delete item (visible on hover)
- [ ] Multi-select strip — Right-edge clickable strip for selection
- [ ] Hover show/hide — Trash and send icons visible on mouseenter, hidden on mouseleave

### Inline Editing

- [ ] `startEditing(item, textSpan, clickEvent)` — Start inline editing with textarea
- [ ] Textarea (multi-line via Shift+Enter) — Auto-sizing, per-keystroke auto-save
- [ ] Click positioning — Cursor placed at click location using canvas measurement
- [ ] Enter key — Split item at cursor, create new item below, focus new item
- [ ] Shift+Enter — Insert newline (default textarea behavior)
- [ ] Escape key — Cancel editing (finishEditing with save=false)
- [ ] Tab key — Indent item (single item only)
- [ ] Shift+Tab — Unindent item (single item only)
- [ ] Cmd/Ctrl+] — Indent item (single item only)
- [ ] Cmd/Ctrl+[ — Unindent item (single item only)
- [ ] Cmd/Ctrl+Shift+) — Indent item + all descendants
- [ ] Cmd/Ctrl+Shift+( — Unindent item + all descendants
- [ ] ArrowUp at start — Navigate to previous item
- [ ] ArrowDown at end — Navigate to next item
- [ ] Cmd/Ctrl+Z — Undo (browser-level first, then checklist-level)
- [ ] Cmd/Ctrl+Shift+Z — Redo
- [ ] Cmd/Ctrl+B/I/U — Markdown formatting hotkeys
- [ ] Blur event — Finish editing with save=true
- [ ] Per-keystroke auto-save — `_notifyChangeQuiet()` on every input event
- [ ] Draggable disabled during edit — Re-enabled on finish

### Check / Delete

- [ ] `toggleCheck(item, checked)` — Toggle item + subtree checked state with animation
- [ ] Check animation — checkmark → strikethrough → fade → move to completed
- [ ] `updateCheckedStateForSubtree(item, checked)` — Recursively set checked on children
- [ ] `deleteItem(item, element)` — Delete item + descendants with animation (300ms)
- [ ] Delete animation — "deleting" CSS class applied before removal
- [ ] `clearCheckedItems()` — Delete all checked items (with cwocConfirm)
- [ ] `deleteUncheckedItems()` — Delete all unchecked items (with cwocConfirm)
- [ ] `cleanUpEmptyItems()` — Remove items with empty/whitespace text

### Tree Operations

- [ ] `getParent(item)` — Find parent item by parent ID
- [ ] `getChildren(item)` — Find direct children of item
- [ ] `getSubtree(item)` — Get item + all descendants recursively
- [ ] `_getDescendants(item)` — Get all descendants (children, grandchildren, etc.)
- [ ] `_reassignFollowingSiblings(item, oldParentId)` — After unindent, reassign following siblings

### Drag & Drop (Desktop)

- [ ] `onDragStart(e, item)` — Set dragged item, subtree, data transfer
- [ ] `onDragOver(e, item)` — Show drop indicator (above/below/on based on Y position)
- [ ] `onDragLeave()` — Clear drop indicator
- [ ] `onDrop(e, item)` — Execute drop: reposition items, update levels/parents
- [ ] `clearDropIndicator()` — Remove all drag-over CSS classes
- [ ] `_updateSubLevels(sub, newRootLevel)` — Adjust levels of subtree preserving hierarchy
- [ ] `_isDesc(item, ancestor)` — Check if item is descendant of ancestor
- [ ] Drop position "on" — Make dragged item a child of target
- [ ] Drop position "above" — Insert before target at same level
- [ ] Drop position "below" — Insert after target (and its children) at same level
- [ ] Cross-zone drag — Update checked state when moving between active/completed

### Touch Drag (Mobile)

- [ ] `enableTouchDrag` integration — Touch-based reorder for mobile
- [ ] Touch swipe right — Indent item (threshold: 40px horizontal, 2:1 ratio)
- [ ] Touch swipe left — Unindent item
- [ ] Touch vertical drag — Reorder with drop indicator (above/below/on)
- [ ] `_touchStartX`, `_touchStartY` — Track touch start position
- [ ] `_touchSwipeHandled` — Prevent double-handling of swipe vs drag

### Undo / Redo

- [ ] `_pushUndoState()` — Snapshot current items to undo stack (dedup identical states)
- [ ] `undo()` — Restore previous state from undo stack, push current to redo
- [ ] `redo()` — Restore next state from redo stack, push current to undo
- [ ] `_updateUndoRedoButtons()` — Enable/disable undo/redo buttons based on stack state

### Change Notification

- [ ] `_notifyChange()` — Push undo state, update count, fire callback, check auto-complete
- [ ] `_notifyChangeQuiet()` — Update count and fire callback without pushing undo state

### Multi-Select

- [ ] `_toggleSelectItem(itemId)` — Toggle single item selection (Ctrl/Cmd+click)
- [ ] `_rangeSelectTo(itemId)` — Shift+click range select from anchor to target
- [ ] `_clearSelection()` — Clear all selections, exit multi-select mode
- [ ] `_selectAll()` — Select all unchecked items
- [ ] `_updateSelectVisuals()` — Update CSS classes and draggable attributes for selection state
- [ ] `_updateMultiSelectToolbar()` — Show/hide/update the multi-select toolbar
- [ ] `_startMultiDrag(e, triggerItem)` — Start dragging all selected items as a unit
- [ ] Multi-select toolbar — Shows count, All/Clear/Check/Uncheck/Delete/Send buttons
- [ ] Ctrl/Cmd+click anywhere on row — Toggle item selection
- [ ] Shift+click — Range select from last selected to clicked item
- [ ] Select strip (right edge) — Always clickable for selection
- [ ] ESC in multi-select mode — Clear selection (capture phase)
- [ ] Checkbox blocked in multi-select — Prevents accidental single-item toggle
- [ ] Only selected items draggable in multi-select mode

## Standalone Functions (outside class)

- [ ] `_copyNoteToChecklist(checklist)` — Move note content to checklist items (with undo toast)
- [ ] `_copyChecklistToNote(checklist)` — Move checklist items to note as markdown (with undo toast)
- [ ] `_pasteClipboardAsChecklistItems(checklist)` — Read clipboard, create items from each line
- [ ] `_copyIncompleteToClipboard(checklist)` — Copy unchecked items to clipboard as markdown
- [ ] `_checklistAutoComplete` — Boolean: auto-complete enabled
- [ ] `_checklistAutoArchive` — Boolean: auto-archive enabled
- [ ] `_toggleChecklistAutoComplete(e)` — Cycle: Off → Auto-Complete → Auto-Complete+Archive → Off
- [ ] `_checkAutoCompleteChecklist(checklist)` — If all checked and auto-complete on, set status=Complete
- [ ] `renderChecklistItemMarkdown(span, text)` — Render markdown in checklist item text (external)
- [ ] `_flashChecklistAddArrow()` — Flash visual indicator when item added (external)
- [ ] `_openSendContentModal(e, 'checklist')` — Open send content modal (external)
- [ ] `_openSendItemPopup(e, item, checklist)` — Open send single item popup (external)
- [ ] `_toggleChecklistAutosaveChit(e)` — Toggle per-chit autosave (external)
- [ ] `_printChecklist(checklist)` — Print the checklist (external)
