# Implementation Plan: Android Checklist Zone Parity

## Overview

Replace the current Android checklist zone (swipe-to-delete, up/down arrows, collapsible, fixed-height) with a complete rewrite matching the mobile browser's behavior exactly. 19 tasks covering data model, state management, UI composables, gestures, animations, and integration.

## Tasks

- [ ] 1. Create ChecklistItemV2 data model and ChecklistOperationsV2 with all pure domain functions (parse, serialize, getSubtree, getChildren, getParent, indent, indentSubtree, outdent, outdentSubtree, toggleCheck, deleteWithSubtree, splitItem, moveAbove, moveBelow, moveOnto, parseClipboardText, itemsToMarkdown). Constants: MAX_INDENT_LEVEL=4, INDENT_DP_PER_LEVEL=20. Requirements: 19.1-19.6, 5.1-5.7, 6.1-6.7
- [ ] 2. Create ChecklistZoneViewModel with undo/redo stacks (max 50 snapshots), multi-select state (selectedIds, lastSelectedId, toggleSelectItem, rangeSelectTo, selectAll, clearSelection), inline editing tracking (editingItemId), auto-save state machine (IDLE/PENDING/SAVING/SAVED/FAILED with 2s debounce), loadItems, applyChange (pushes undo), applyChangeQuiet (no undo for keystrokes). Requirements: 13.1-13.8, 11.1-11.6, 15.1-15.5
- [ ] 3. Create ChecklistZoneV2 main composable with non-collapsible zone header (title "✅ Checklist" + count, Data button, spacer, Undo ↺, Redo ↻, indicator 🔽), auto-save indicators, AddItemInput, MultiSelectToolbar, unchecked items list, CompletedSection. Zone fills all available space. Requirements: 1.1-1.4, 2.1-2.5, 13.1-13.5, 15.1-15.3
- [ ] 4. Create AddItemInput composable with flash arrow animation — full-width input, placeholder "Add new item (Enter to add)", parchment styling (Lora 16sp, brown border, teal focus), IME Done creates item + flash ↓ arrow (teal, fade in/out with translateY). Requirements: 2.1-2.5, 3.1-3.3
- [ ] 5. Create ChecklistItemRow composable with all controls — drag handle ⠿ (0.8 opacity, 1.3em), checkbox, MarkdownRenderer text (tap to edit), send icon 📤 (always visible), delete icon ✕ (always visible), select strip ⋮ (18dp right edge, teal when selected). Level*20dp left padding. Ghost variant for completed section. Requirements: 4.1-4.6, 11.4-11.5
- [ ] 6. Implement touch drag reordering with swipe indent/outdent — pointerInput on drag handle, horizontal swipe >40dp = indent/outdent subtree, vertical drag = reorder with drop indicators (top/middle/bottom third → above/on/below), multi-drag moves all selected items as unit. Requirements: 5.1-5.7, 6.1-6.7, 20.1-20.4
- [ ] 7. Implement inline editing with keyboard shortcuts — BasicTextField replaces text on tap, auto-resize height, teal border, Enter splits item, Shift+Enter newline, Tab indent, Shift+Tab outdent, Escape cancel, blur saves, per-keystroke model update (no undo push), ArrowUp/Down navigate items. Block multi-select while editing. Requirements: 7.1-7.13
- [ ] 8. Implement check animation (strikethrough + green flash 100ms → fade + slideX 150ms → move to completed) and delete animation (red bg + fade 500ms, remove after 300ms). Check cascades to children. Uncheck is immediate (no reverse animation). Push undo before delete. Requirements: 8.1-8.5, 9.1-9.3
- [ ] 9. Implement completed section with ghost parents — collapsible section below unchecked items, header "Completed (N)" + ▶/▼ toggle, starts collapsed, ghost parents (non-interactive ancestors at correct indent), checked items with full controls, hidden when no checked items. Requirements: 10.1-10.6
- [ ] 10. Implement multi-select toolbar — appears when selectedIds non-empty, teal-tinted background, buttons: count display, All, ✓Check, 🗑Delete (with confirm), 📤Move, →Indent, ←Outdent, ✕Clear. Bulk actions clear selection on completion. Requirements: 12.1-12.9
- [ ] 11. Implement Data Menu bottom sheet — ModalBottomSheet with 9 items: Paste as list items, Copy incomplete, Delete checked (conditional), Delete unchecked, Clean empty, Move to note, Send to chit, Print, Auto-save toggle. Full width, 12dp top corners, 44dp min item height, backdrop dismiss. Requirements: 14.1-14.11
- [ ] 12. Implement send-to-chit functionality — search modal (reuse chit picker pattern), per-item send (📤 tap moves item+subtree), multi-select send (Move button), bulk send (Data menu), API: fetch target chit, append items, PUT back, remove from current. Requirements: 16.1-16.4
- [ ] 13. Implement note ↔ checklist conversion — Move to note: itemsToMarkdown, append to noteText, clear checklist, undo toast. Note-to-checklist: parseClipboardText(noteText), append to checklist, clear note, undo toast. Both directions support undo via toast button. Requirements: 17.1-17.3
- [ ] 14. Implement clipboard operations — Paste as list items: ClipboardManager read, parseClipboardText, append, undo toast "📋 Pasted N items". Copy incomplete: filter unchecked, format markdown, write clipboard, toast "📋 Copied N items". Handle denied/empty cases with warning toasts. Requirements: 18.1-18.4
- [ ] 15. Implement auto-save with PATCH endpoint — add patchChecklist to ApiService, 2s debounce in ViewModel, visual indicators (PENDING=yellow "changes pending", SAVED=teal "✓ saved" fades after 2s, FAILED=mark unsaved). Per-chit override toggle. Only for existing chits. Requirements: 15.1-15.5
- [ ] 16. Implement auto-complete checklist integration — after every check/uncheck/add, evaluate: all non-blank checked → onStatusChange("Complete"), any unchecked while Complete → onStatusChange("ToDo"). Only when auto-complete enabled. Button stays in Task zone. Requirements: 21.1-21.3
- [ ] 17. Implement pending content detection — expose hasPendingContent() (input has text OR editing active) and commitPendingContent() (create item from input, save edit). Wire into editor exit/save flow. Requirements: 22.1-22.2
- [ ] 18. Integrate ChecklistZoneV2 into ChitEditorScreen — replace ChecklistZone call with ChecklistZoneV2, pass all params (checklistJson, chitId, isNewChit, autoSaveEnabled, onChecklistChange, onStatusChange, noteText, onNoteChange), remove auto-save toggle from main screen, mark old ChecklistZone @Deprecated. Requirements: 1.1-1.4, 23.1-23.5
- [ ] 19. Remove all legacy Android-specific behaviors — remove SwipeToDismissBox, remove ArrowUpward/ArrowDownward buttons, remove indent/outdent icon buttons, remove EditorZoneHeader collapse toggle, remove fixed-height LazyColumn constraint, remove old add-item pattern with + button. Verify nothing legacy remains. Requirements: 23.1-23.5

## Task Dependency Graph

```json
{
  "waves": [
    {"tasks": [1]},
    {"tasks": [2]},
    {"tasks": [3, 4, 5]},
    {"tasks": [6, 7, 8, 9, 10, 11, 15, 16, 17]},
    {"tasks": [12, 13, 14]},
    {"tasks": [18]},
    {"tasks": [19]}
  ]
}
```

## Notes

- Tasks 4-9 can be parallelized after Tasks 1-3 are complete
- Tasks 10-17 can be parallelized after Task 2 is complete
- Task 18 (integration) should be done after all feature tasks are complete
- Task 19 (remove legacy) is the final cleanup step
- The existing `ChecklistItem` and `ChecklistOperations` are kept for the Checklists list view (ChecklistsScreen.kt) — only the editor zone is replaced
- No Room migration needed — checklist is stored as a JSON string field
