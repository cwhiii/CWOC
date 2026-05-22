# W44-W53: Send Content Feature (editor-send-content.js)

## What the web feature does
Allows copying or moving notes content or checklist items from the current chit to another chit:
- Opens a chit picker modal with search/filter
- User selects a target chit (radio-select, single target)
- Two actions: "Copy" (duplicates content to target) or "Move" (removes from source, adds to target)
- For notes: appends note text to target chit's note field
- For checklist: appends checklist items to target chit's checklist
- Shows undo bar after operation
- Undo reverses the operation (removes from target, restores to source)

Functions: _openSendContentModal, _closeSendContentModal, _sendContentRenderChits, _sendContentHighlight, _sendContentUpdateButtons, _sendContentApplyFilters, _sendContentMatchesSearch, _executeSendContent, _showSendContentUndoBar, _undoSendContent

## What exists on Android
Nothing. No send-content feature exists.

## What's missing
The entire "Send Content" feature — ability to copy/move notes or checklist content between chits from the editor.

## Fix needed
Implement a "Send to..." action in the Notes zone and Checklist zone that opens ChitPickerSheet, then executes the copy/move via ChitRepository.
