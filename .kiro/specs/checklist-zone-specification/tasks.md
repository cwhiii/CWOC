# Implementation Plan: Checklist Zone Specification

## Overview

This plan implements the complete Checklist Zone feature from scratch, covering both the Editor context (full `Checklist` class with nested items, drag-drop, undo/redo, multi-select, inline editing) and the Dashboard context (inline interactive cards with cross-chit drag). Tasks are ordered by dependency: shared utilities first, then core class, then progressive feature layers, then dashboard, then CSS and integration.

## Tasks

- [x] 1. Shared utilities and data model foundation
  - [x] 1.1 Implement `renderChecklistItemMarkdown` in `shared-checklist.js`
    - Parse text through `marked.parse(text, { breaks: true })`
    - Strip outer `<p>` wrapper for single-line items via regex
    - Remove GFM-generated `<input>` elements via regex
    - Set `tabindex="-1"` on all rendered `<a>` elements
    - Fall back to `el.textContent = text` when marked.js unavailable
    - Handle empty/falsy text with `el.textContent = ''`
    - _Requirements: 32.1, 32.2, 32.3, 32.4, 32.5, 32.6_

  - [x] 1.2 Implement `enableTouchDrag` in `shared-touch.js`
    - Translate `touchstart`/`touchmove`/`touchend` into callback interface
    - Provide `onStart(e)`, `onMove(e)`, `onEnd(e)` with clientX/clientY
    - Detect horizontal swipe (|dx| > 40 && |dx| > |dy| * 2) vs vertical drag
    - _Requirements: 11.1, 11.2_

  - [x] 1.3 Define the Checklist Item data model and constants
    - Define `MAX_INDENT_LEVEL = 4`
    - Item structure: `{ id, text, level, checked, parent }`
    - ID format: "item-" + 9 random alphanumeric chars via `Math.random().toString(36).substr(2, 9)`
    - Level constrained to 0–4, parent is string ID or null
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.8_

- [x] 2. Checklist class core — constructor, init, render, input
  - [x] 2.1 Implement `Checklist` class constructor and `init()` method
    - Accept `container`, `initialItems`, `onChangeCallback` parameters
    - Initialize state: `items`, `draggedItem`, `editingItem`, `_undoStack`, `_redoStack`, `_selectedIds`, `_multiSelectMode`
    - Call `init()`: create count display, header buttons, input field, render, init ESC handler
    - _Requirements: 40.1, 40.2, 40.3, 40.4_

  - [x] 2.2 Implement `loadItems`, `getChecklistData`, `generateId`
    - `loadItems`: map items to internal format, cap levels at MAX_INDENT_LEVEL, reset undo/redo, render, update count, invoke callback
    - `getChecklistData`: serialize items array (id, text, level, checked, parent)
    - `generateId`: produce "item-" + 9 random alphanumeric chars
    - _Requirements: 1.1, 1.2, 1.3, 40.3_

  - [x] 2.3 Implement input field creation and behavior
    - Create text input with class `checklist-input`, placeholder "Add new item (Enter to add)"
    - Enter with non-empty text: create item at level 0, clear input, flash animation
    - Enter with empty/whitespace: no action
    - Escape: invoke `cancelOrExit` page exit flow
    - Cmd+Z / Cmd+Shift+Z: undo/redo
    - Cmd+B/I: markdown formatting via `_emailFormatBtn`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [x] 2.4 Implement `render()` method and item DOM structure
    - Render unchecked items with class `checklist-item`, `draggable="true"`, `data-id`
    - Left container with `padding-left: level * 20px`
    - Drag handle (⠿), checkbox, text wrapper with `checklist-text` span
    - Send icon (📤) and delete icon (✕) visible on hover
    - Multi-select strip on right edge
    - Render text through `renderChecklistItemMarkdown`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10_

  - [x] 2.5 Implement completed section rendering
    - Render `completed-checklist-container` below unchecked items
    - Show only when checked items exist
    - Header with "Completed" title, count "(N)", toggle arrow
    - Start collapsed (body hidden, arrow "▶")
    - Toggle on header click (expand/collapse body, switch arrow)
    - Render completed items with `completed-checklist-item` class
    - Render ghost parent items (unchecked ancestors) with `ghost-checklist-item` class
    - Ghost items non-interactive (faded, no editing)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10_

  - [x] 2.6 Implement zone header structure (title, count, actions)
    - Zone container with id `checklistSection`, class `zone-container`
    - Zone header with collapse/expand toggle
    - Title "✅ Checklist" as h2 with count display "(checked / total)"
    - Action buttons: Data menu | spacer | Undo | Redo | toggle icon
    - Hide count when zero items
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 39.1, 39.5_

  - [x] 2.7 Implement tree helper functions
    - `getSubtree(item)`: recursive item + all descendants
    - `getChildren(item)`: filter items where parent === item.id
    - `getParent(item)`: find item where id === item.parent
    - `_updateSubLevels(subtree, newRootLevel)`: apply level delta preserving relative hierarchy
    - `_reassignFollowingSiblings(item, oldParentId)`: fix parent refs after unindent
    - _Requirements: 36.7, 36.8, 36.9, 36.3, 36.4_

  - [x] 2.8 Implement change notification system
    - `_notifyChange()`: push undo state, update count, invoke callback, evaluate auto-complete
    - `_notifyChangeQuiet()`: update count, invoke callback (no undo push)
    - `_pushUndoState()`: JSON.stringify items, push to stack, clear redo
    - Prevent duplicate consecutive states via JSON string comparison
    - _Requirements: 37.1, 37.2, 37.3, 37.4, 15.8_

  - [x] 2.9 Implement `hasPendingContent` and `commitPendingContent`
    - `hasPendingContent()`: true if input has text OR item being edited
    - `commitPendingContent()`: commit input text as new item, commit editing textarea to item text
    - Return true if content was committed, false otherwise
    - _Requirements: 33.1, 33.2, 33.3, 33.4_

- [x] 3. Checkpoint — Core class renders and accepts input
  - Ensure all core rendering works, items can be added via input, tree helpers function correctly, ask the user if questions arise.

- [x] 4. Inline editing with keyboard shortcuts
  - [x] 4.1 Implement `startEditing` and `finishEditing`
    - Click on `.checklist-text` or text wrapper opens textarea
    - Set `draggable="false"` on item during edit
    - Auto-size textarea height on every input event
    - Update item text per-keystroke via `_notifyChangeQuiet`
    - Position cursor at click location using canvas 2d text measurement
    - Block editing when multi-select active (early return)
    - `finishEditing(save)`: restore draggable, remove textarea, restore text span, re-render markdown
    - Escape cancels (revert text), blur saves
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.9, 6.10, 6.11, 6.12, 6.13_

  - [x] 4.2 Implement Enter to split item at cursor
    - Text before cursor stays in current item
    - Text after cursor becomes new item inserted after subtree at same level/parent
    - New item auto-focuses with cursor at position 0
    - Shift+Enter allows default newline behavior
    - _Requirements: 6.7, 6.8_

  - [x] 4.3 Implement editing keyboard shortcuts (indent/unindent)
    - Tab: indent item (constraints: not first item, level < MAX, level <= previous item's level)
    - Shift+Tab: unindent item (level > 0)
    - Cmd+]: indent single item only
    - Cmd+[: unindent single item only
    - Cmd+Shift+): indent item + subtree
    - Cmd+Shift+(: unindent item + subtree
    - After indent/unindent: finish editing, re-render, notify change, re-open editing via setTimeout(0)
    - Reassign parent on indent, call `_reassignFollowingSiblings` on unindent
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.13, 7.14, 7.15, 36.1, 36.2, 36.3, 36.4_

  - [x] 4.4 Implement editing keyboard shortcuts (navigation, undo, formatting)
    - ArrowUp at position 0: navigate to previous unchecked item, cursor at end
    - ArrowDown at end: navigate to next unchecked item, cursor at position 0
    - Cmd+Z: attempt browser undo first, fall back to checklist undo if unchanged
    - Cmd+Shift+Z: browser redo
    - Cmd+B/I: markdown formatting via `_emailFormatBtn`
    - `e.stopPropagation()` on all keydown events in textarea
    - _Requirements: 7.7, 7.8, 7.9, 7.10, 7.11, 7.12, 35.2_

- [x] 5. Check/uncheck with animations and subtree propagation
  - [x] 5.1 Implement `toggleCheck` for checking items
    - Push undo state, set item checked=true, recursively set all descendants checked=true
    - Animate: add `checklist-checking` class, wait 100ms, add `checklist-checking-fade`, wait 150ms, re-render
    - Update count, invoke onChange callback
    - Block toggle when multi-select active (revert checkbox state)
    - _Requirements: 8.1, 8.2, 8.7, 8.8_

  - [x] 5.2 Implement `toggleCheck` for unchecking items
    - Push undo state, set item checked=false, recursively set all descendants checked=false
    - Re-render immediately (no animation)
    - Update count, invoke onChange callback
    - _Requirements: 8.3, 8.8_

- [x] 6. Item deletion with animation
  - [x] 6.1 Implement `deleteItem`
    - Add "deleting" class to element (CSS animation), wait 300ms
    - Push undo state, remove item + all descendants from items array
    - Clear editing state if item was being edited
    - Use `mousedown` with `e.preventDefault()` on delete icon
    - Re-render, update count, invoke onChange, update undo/redo buttons
    - No confirmation dialog for single-item deletion
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 7. Desktop drag-and-drop reordering
  - [x] 7.1 Implement `onDragStart`, `onDragOver`, `onDragLeave`, `onDrop`
    - `dragstart`: set opacity 0.5 ("dragging" class), store item + subtree, set effectAllowed "move"
    - `dragover`: divide target into vertical thirds, show indicators (above/on/below)
    - `dragleave`: clear all indicators
    - `drop`: execute move based on position, push undo state, re-render
    - _Requirements: 10.1, 10.2, 10.3, 10.11_

  - [x] 7.2 Implement drop position logic (above/on/below)
    - "above": insert subtree before target at same level/parent
    - "below": insert subtree after target's subtree at same level/parent
    - "on": make dragged item child of target (level = target.level + 1, parent = target.id)
    - Update all subtree levels via `_updateSubLevels` preserving relative hierarchy
    - Prevent drop onto own descendants
    - Update checked state when moving between active/completed zones
    - _Requirements: 10.4, 10.5, 10.6, 10.7, 10.8, 10.9, 10.10_

- [x] 8. Touch/mobile drag-and-drop with swipe indent/unindent
  - [x] 8.1 Implement touch drag handlers using `enableTouchDrag`
    - Attach touch handlers to each item element
    - Horizontal swipe (>40px, |dx| > |dy| * 2): indent/unindent gesture
    - Right swipe: indent item + subtree (same constraints as Tab)
    - Left swipe: unindent item + subtree (if level > 0)
    - Vertical drag: same reorder logic as desktop (find element, divide thirds, show indicators)
    - Flag `_touchSwipeHandled` to prevent drop on swipe
    - Push undo state before any touch operation
    - Add/remove "dragging" class on touch start/end
    - Clear drag indicators during move and on end
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9_

- [x] 9. Checkpoint — Editing, check/uncheck, delete, and drag all functional
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Undo/redo system
  - [x] 10.1 Implement `undo()` and `redo()` methods
    - `undo()`: save current to redo stack, pop from undo stack, restore items, re-render, update count, invoke callback, update button states
    - `redo()`: save current to undo stack, pop from redo stack, restore items, re-render, update count, invoke callback, update button states
    - Cap undo stack at 50 (shift oldest on overflow)
    - Clear redo stack on new action
    - Reset both stacks on `loadItems`
    - Undo/redo buttons disabled when respective stacks empty
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.9, 15.10_

  - [x] 10.2 Wire undo state pushes to all destructive operations
    - Push before: delete, check/uncheck, drag-drop, indent/unindent, paste, bulk delete, multi-select batch ops
    - Prevent duplicate consecutive states (JSON comparison)
    - _Requirements: 15.7, 15.8_

- [x] 11. Multi-select system
  - [x] 11.1 Implement multi-select activation and visual state
    - Ctrl/Cmd+click on item row: toggle selection, set anchor
    - Click select strip: toggle selection
    - Shift+click: range select from anchor to target (additive)
    - Enter multi-select mode: add `checklist-multiselect-active` class, disable text editing, block checkbox toggles, restrict draggable to selected items only
    - Escape (capture phase): clear all selections, exit mode, stopPropagation + preventDefault
    - Visual: `checklist-multi-selected` class on items, `selected` class on strip
    - Use `mousedown` with `e.preventDefault()` on select strip
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 12.9_

  - [x] 11.2 Implement multi-select toolbar
    - Display toolbar (class `checklist-multiselect-toolbar`) after input when selection exists
    - Elements: count "[N] selected", "All", "Check", "Delete", "Move", "Indent", "Outdent", "✕" clear
    - "All": select all unchecked items
    - "Check": push undo, check selected + subtrees, clear selection, re-render
    - "Delete": cwocConfirm dialog, push undo, remove selected, clear selection, re-render
    - "Move": open send-to-chit modal for batch transfer
    - "Indent"/"Outdent": push undo, indent/outdent each selected item, re-render
    - "✕": clear selections, remove toolbar
    - Remove toolbar when selection count reaches zero
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9, 13.10_

  - [x] 11.3 Implement multi-select drag (group drag)
    - Drag selected item: collect all selected items in list order as "subtree", mark all with "dragging" class
    - Drag unselected item while in multi-select: prevent drag (e.preventDefault)
    - Drop "above"/"below": keep original relative levels, reposition as group
    - Drop "on": calculate level delta from first selected to target.level+1, apply to all, cap at MAX
    - Restore multi-select visuals after re-render
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

- [x] 12. Checkpoint — Multi-select and undo/redo complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Data menu operations
  - [x] 13.1 Implement Data menu dropdown structure
    - Button with ellipsis icon + "Data" label in zone header
    - Toggle dropdown (class `zone-more-menu`) on click
    - Close on outside click (one-time document listener via setTimeout(0))
    - Menu items in order: Paste, Copy incomplete, Delete checked, Delete unchecked, Clean empty, Move to note, Send to chit, Print, Auto-save toggle
    - Hide "Delete checked" when no checked items exist
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6_

  - [x] 13.2 Implement "Paste as list items"
    - Read clipboard via `navigator.clipboard.readText()`
    - Handle denied access (toast "⚠️ Clipboard access denied")
    - Split by newlines, detect indent (4 spaces/tab = 1 level, 2 spaces = 1 level)
    - Detect markdown checkbox `[-*]\s+\[([ xX])\]\s*`, strip list markers, detect legacy checkbox
    - Skip empty lines after stripping, cap levels at MAX
    - Assign parent IDs by scanning backward for nearest item at level-1
    - Snapshot for undo, append items, re-render, notify, show undo toast "📋 Pasted N item(s)"
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7, 17.8, 17.9, 17.10, 17.11, 17.12_

  - [x] 13.3 Implement "Copy incomplete to clipboard"
    - Filter unchecked items, show toast if none exist
    - Format as markdown: 2-space indent per level + `- [ ] ` + text
    - Write to clipboard, show toast "📋 Copied N item(s)"
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5_

  - [x] 13.4 Implement "Delete checked items" and "Delete unchecked items"
    - Delete checked: count checked, cwocConfirm dialog, push undo, remove all checked, re-render
    - Delete unchecked: count unchecked, cwocConfirm dialog, push undo, remove all unchecked, re-render
    - Hide delete-checked button when no checked items
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 20.1, 20.2, 20.3, 20.4, 20.5_

  - [x] 13.5 Implement "Clean up empty items"
    - Count items with empty/whitespace-only text
    - No action if zero empty items
    - Push undo, remove empty items, re-render, notify change
    - No confirmation dialog
    - _Requirements: 21.1, 21.2, 21.3, 21.4_

  - [x] 13.6 Implement "Move to note" (checklist → note conversion)
    - Convert all items to markdown: 2-space indent per level, `- [x] ` or `- [ ] ` + text
    - Append to note field (with blank line separator if existing content)
    - Clear checklist, re-render, notify change
    - Trigger `autoGrowNote`, mark save unsaved, update rendered notes view
    - Show undo toast with callback restoring both note and checklist
    - _Requirements: 22.1, 22.2, 22.3, 22.4, 22.5, 22.6, 22.7, 22.8_

  - [x] 13.7 Implement "Move from note" (note → checklist conversion)
    - Read note textarea, skip if empty
    - Parse lines: detect indent, markdown checkbox, list markers, legacy checkbox
    - Assign parent IDs, append to checklist, re-render, notify
    - Clear note field, trigger autoGrowNote, mark save unsaved
    - Show undo toast with callback restoring both
    - _Requirements: 23.1, 23.2, 23.3, 23.4, 23.5, 23.6, 23.7_

  - [x] 13.8 Implement "Send to another chit" (per-item and bulk)
    - Per-item send icon (📤): commit active edit, open `_openSendItemPopup`, move item + subtree
    - Bulk send from Data menu: open `_openSendContentModal` with content type "checklist"
    - Multi-select "Move" button: open send modal for batch transfer
    - _Requirements: 24.1, 24.2, 24.3, 24.4, 25.1, 25.2_

  - [x] 13.9 Implement "Print checklist"
    - Open print modal via `_printChecklist`
    - Checkbox option "Include completed items" (default unchecked)
    - "Print" button opens browser native print dialog with formatted checklist
    - "Cancel" button closes modal
    - _Requirements: 26.1, 26.2, 26.3, 26.4_

- [x] 14. Auto-save system
  - [x] 14.1 Implement auto-save with debounce
    - Respect global setting (`checklist_autosave` in user settings, default enabled)
    - Respect per-chit override (`checklist_autosave` field: null=global, true=on, false=off)
    - Debounce 2 seconds after last change, then PATCH to server with checklist data
    - Show `debounce-pending` class on input during pending timer
    - Force immediate save (flush) on page exit
    - _Requirements: 27.1, 27.2, 27.3, 27.4, 27.5_

  - [x] 14.2 Implement auto-save toggle in Data menu
    - Cycle per-chit override: global default → force on → force off → global default
    - Display current state in button text: "Auto-save: On", "Auto-save: On (chit)", "Auto-save: Off", "Auto-save: Off (chit)"
    - _Requirements: 27.6, 27.7_

- [x] 15. Auto-complete system
  - [x] 15.1 Implement auto-complete evaluation and status change
    - Check `auto_complete_checklist` field (default true)
    - When all non-empty items checked: set status select to "Complete", invoke `onStatusChange`
    - When auto-archive also enabled: set archived=true, update archive button visual
    - Evaluate after every check operation
    - _Requirements: 28.1, 28.2, 28.3, 28.6_

  - [x] 15.2 Implement auto-complete toggle (`_toggleChecklistAutoComplete`)
    - Cycle through: Off → Auto-Complete → Auto-Complete + Archive → Off
    - Mark save button as unsaved after state change
    - _Requirements: 28.4, 28.5_

- [x] 16. Checkpoint — All editor features complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 17. Dashboard Checklists view
  - [x] 17.1 Implement card rendering in `main-views.js`
    - Display only chits with non-empty checklist items
    - Sort: pinned first, then by checked ratio (least complete first)
    - Card header: chit title (linked to editor), progress count "(checked/total)" or "(checked/total ✓)"
    - Render only unchecked items inline
    - Each item: padding-left (level*18+4px), drag handle, checkbox, markdown text
    - Set `draggable="true"` with `data-idx` and `data-chit-id`
    - Masonry/column layout, manual sort order persistence
    - Count only non-empty items for progress
    - _Requirements: 29.1, 29.2, 29.3, 29.4, 29.5, 29.6, 29.7, 29.8, 29.9, 39.2, 39.4_

  - [x] 17.2 Implement dashboard inline interactions
    - Checkbox toggle: call `toggleChecklistItem` (PATCH), hide item, update progress count
    - All items checked: add `checklist-all-done` class (title strikethrough)
    - Item unchecked: remove `checklist-all-done` class
    - Auto-complete enabled: refresh dashboard after 300ms delay
    - Viewer-role shared chits: render read-only (no checkboxes, no drag handles)
    - Uncheck reverts status to "ToDo" on dashboard
    - _Requirements: 30.1, 30.2, 30.3, 30.4, 30.5, 8.6_

  - [x] 17.3 Implement dashboard drag-and-drop (within-chit and cross-chit)
    - Within-chit drag: call `moveChecklistItem` (reorder + PUT)
    - Cross-chit drag: call `moveChecklistItemCrossChit` (remove from source, insert in target, PUT both)
    - Drag data type `application/x-checklist-item` with JSON {chitId, idx}
    - Brown border-top indicator on target during dragover
    - Support drop on list container (append to end)
    - Touch drag via `enableTouchDrag` with same behavior
    - Identify target chit from `data-chit-id` attribute
    - Opacity 0.4 during drag, restore on end
    - Invoke `onUpdate` callback after successful move
    - _Requirements: 31.1, 31.2, 31.3, 31.4, 31.5, 31.6, 31.7, 31.8, 31.9_

  - [x] 17.4 Implement dashboard API integration functions
    - `toggleChecklistItem`: GET chit, update checked state, evaluate auto-complete, PUT chit
    - `moveChecklistItem`: GET chit, splice item, PUT chit
    - `moveChecklistItemCrossChit`: GET both chits in parallel, move item, PUT both in parallel
    - Same-chit cross-move delegates to within-chit function
    - All errors handled with try/catch + console.error
    - Update progress count span immediately after toggle
    - _Requirements: 38.1, 38.2, 38.3, 38.4, 38.5, 39.3_

- [x] 18. CSS styling
  - [x] 18.1 Implement editor checklist zone CSS
    - `.checklist-input`: full width, 8px padding, border transitions, parchment theme font
    - `.checklist-item`: flex, align-items flex-start, position relative
    - `.checklist-drag-handle`: opacity 0.5, cursor grab, 1.1em, opacity 1.0 on hover
    - `.checklist-text`: white-space pre-wrap, word-break break-word
    - `.checklist-edit-input`: full width, same font, auto-height, teal focus border
    - Drag indicators: blue border-top/bottom, white background for "on"
    - "deleting" animation class
    - Check animations: `checklist-checking` (strikethrough + green), `checklist-checking-fade` (fade + translateX)
    - Multi-select teal accent throughout
    - Mobile responsive: compact padding, always-visible drag handles, larger touch targets
    - _Requirements: 34.1, 34.2, 34.3, 34.4, 34.5, 34.6, 34.7, 34.8, 34.9, 34.10_

  - [x] 18.2 Implement dashboard checklist card CSS
    - Card layout matching masonry/column pattern
    - Inline item styling: padding-left, flex, gap 6px, font-size 0.95em, line-height 1.4, min-height 1.8em
    - `checklist-all-done` class: title strikethrough
    - `checklist-progress-count` styling
    - Drag indicator: brown border-top (2px solid #8b5a2b)
    - Drag opacity 0.4
    - _Requirements: 29.5, 29.8, 30.2, 31.4, 31.8_

- [x] 19. Integration and wiring
  - [x] 19.1 Wire editor save system (`editor-save.js`)
    - Connect `onChangeCallback` to auto-save debounce system
    - 2-second debounce → PATCH /api/chits/:id with checklist data
    - `commitPendingContent()` called during page exit to flush
    - _Requirements: 27.3, 27.5, 33.2_

  - [x] 19.2 Wire dashboard refresh after interactions
    - After checkbox toggles or drag moves, call `fetchChits()` or `displayChits()`
    - 300ms delay for auto-complete chits to allow server-side status changes
    - _Requirements: 30.4, 38.1_

  - [x] 19.3 Wire notes zone integration (bidirectional conversion)
    - Checklist → Note: `_copyChecklistToNote` formats as markdown, appends to note field
    - Note → Checklist: `_copyNoteToChecklist` parses markdown into items
    - Both show undo toasts restoring previous state of both zones
    - _Requirements: 22.1, 22.8, 23.1, 23.7_

  - [x] 19.4 Wire send-to-chit system
    - Per-item: `_openSendItemPopup` for individual/subtree sends
    - Bulk: `_openSendContentModal` for entire checklist or multi-select batch
    - _Requirements: 24.3, 24.4, 25.1, 25.2_

  - [x] 19.5 Wire keyboard shortcuts to zone-level handlers
    - Input field: Enter, Escape, Cmd+Z, Cmd+Shift+Z, Cmd+B/I
    - Multi-select Escape in capture phase
    - Ctrl modifier on non-Mac platforms
    - _Requirements: 35.1, 35.3, 35.4_

- [x] 20. Final checkpoint — Full feature integration complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ]* 21. Property-based tests
  - [ ]* 21.1 Write property test for data model serialization invariant
    - **Property 1: Data Model Serialization Invariant**
    - For any items loaded via `loadItems`, `getChecklistData()` returns items with exactly 5 fields of correct types
    - **Validates: Requirements 1.1, 1.3**

  - [ ]* 21.2 Write property test for ID generation format
    - **Property 2: ID Generation Format**
    - For any call to `generateId()`, result matches `/^item-[a-z0-9]{9}$/`
    - **Validates: Requirements 1.2**

  - [ ]* 21.3 Write property test for non-empty input adds item
    - **Property 3: Non-Empty Input Adds Item**
    - For any non-empty, non-whitespace string, Enter increases items length by 1 with correct text
    - **Validates: Requirements 3.3**

  - [ ]* 21.4 Write property test for whitespace input rejected
    - **Property 4: Whitespace Input Rejected**
    - For any whitespace-only string, Enter leaves items unchanged
    - **Validates: Requirements 3.4**

  - [ ]* 21.5 Write property test for check/uncheck subtree propagation
    - **Property 5: Check/Uncheck Subtree Propagation**
    - Toggling checked state propagates to all recursive descendants
    - **Validates: Requirements 8.1, 8.3**

  - [ ]* 21.6 Write property test for delete removes exactly the subtree
    - **Property 6: Delete Removes Exactly the Subtree**
    - Deleting an item removes it and all descendants, leaves others unchanged
    - **Validates: Requirements 9.1**

  - [ ]* 21.7 Write property test for tree structure integrity
    - **Property 7: Tree Structure Integrity**
    - After any sequence of operations, tree invariants hold (levels, parents, MAX_INDENT)
    - **Validates: Requirements 36.1–36.9, 7.14, 7.15**

  - [ ]* 21.8 Write property test for level delta preserves relative hierarchy
    - **Property 8: Level Delta Preserves Relative Hierarchy**
    - `_updateSubLevels` preserves relative level differences between all subtree items
    - **Validates: Requirements 10.7**

  - [ ]* 21.9 Write property test for undo/redo round-trip
    - **Property 9: Undo/Redo Round-Trip**
    - After action changes state S→S', undo restores S, redo restores S'
    - **Validates: Requirements 15.3, 15.4**

  - [ ]* 21.10 Write property test for undo stack bounded
    - **Property 10: Undo Stack Bounded**
    - For any sequence of N>50 actions, undo stack never exceeds 50
    - **Validates: Requirements 15.1**

  - [ ]* 21.11 Write property test for checklist ↔ markdown round-trip
    - **Property 11: Checklist ↔ Markdown Round-Trip**
    - Converting to markdown and back preserves text content and checked state
    - **Validates: Requirements 17.5, 17.6, 18.3, 22.1, 23.3**

  - [ ]* 21.12 Write property test for bulk delete preserves complement
    - **Property 12: Bulk Delete Preserves Complement**
    - Delete checked removes only checked; delete unchecked removes only unchecked; clean empty removes only empty
    - **Validates: Requirements 19.4, 20.4, 21.3**

  - [ ]* 21.13 Write property test for split item preserves text
    - **Property 13: Split Item Preserves Text**
    - Splitting at any cursor position produces two items accounting for all original characters
    - **Validates: Requirements 6.7**

  - [ ]* 21.14 Write property test for range select covers contiguous items
    - **Property 14: Range Select Covers Contiguous Items**
    - Range selecting from A to T includes all items at indices min(A,T) through max(A,T)
    - **Validates: Requirements 12.3**

  - [ ]* 21.15 Write property test for auto-complete triggers correctly
    - **Property 15: Auto-Complete Triggers Correctly**
    - When all non-empty items are checked and auto-complete enabled, status changes to "Complete"
    - **Validates: Requirements 28.2**

  - [ ]* 21.16 Write property test for progress count excludes empty items
    - **Property 16: Progress Count Excludes Empty Items**
    - Progress count reports checked/total counting only non-whitespace items
    - **Validates: Requirements 39.4**

- [x] 22. Final checkpoint — All implementation and tests complete
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- The design uses vanilla JavaScript (no framework, no build step) — all code is plain JS served directly
- Shared utilities (`shared-checklist.js`, `shared-touch.js`) are used by both editor and dashboard contexts
- The `Checklist` class in `editor_checklists.js` is the primary stateful component
- Dashboard functions in `main-views.js` and `shared-checklist.js` are stateless API-driven

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["2.1", "2.6", "2.7"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.8"] },
    { "id": 3, "tasks": ["2.4", "2.5", "2.9"] },
    { "id": 4, "tasks": ["4.1", "4.2"] },
    { "id": 5, "tasks": ["4.3", "4.4", "5.1", "5.2"] },
    { "id": 6, "tasks": ["6.1", "7.1"] },
    { "id": 7, "tasks": ["7.2", "8.1"] },
    { "id": 8, "tasks": ["10.1", "10.2"] },
    { "id": 9, "tasks": ["11.1", "13.1"] },
    { "id": 10, "tasks": ["11.2", "11.3", "13.2", "13.3"] },
    { "id": 11, "tasks": ["13.4", "13.5", "13.6", "13.7"] },
    { "id": 12, "tasks": ["13.8", "13.9", "14.1"] },
    { "id": 13, "tasks": ["14.2", "15.1", "15.2"] },
    { "id": 14, "tasks": ["17.1", "18.1"] },
    { "id": 15, "tasks": ["17.2", "17.3", "17.4", "18.2"] },
    { "id": 16, "tasks": ["19.1", "19.2", "19.3", "19.4", "19.5"] },
    { "id": 17, "tasks": ["21.1", "21.2", "21.3", "21.4", "21.5", "21.6", "21.7", "21.8", "21.9", "21.10", "21.11", "21.12", "21.13", "21.14", "21.15", "21.16"] }
  ]
}
```
