# W247-248: Checklist Clipboard Operations

## What the web functions do
- `_pasteClipboardAsChecklistItems(checklist)` — Reads clipboard text, splits by newlines, and adds each line as a new checklist item. Allows bulk-adding items by pasting a list.
- `_copyIncompleteToClipboard(checklist)` — Copies all incomplete (unchecked) checklist items to the clipboard as plain text (one per line). Useful for sharing remaining tasks.

## What exists on Android
- ChecklistZone renders checklist items with add/remove/reorder
- No clipboard integration for bulk paste or copy operations

## What's missing
1. No "Paste as Items" action to bulk-add checklist items from clipboard
2. No "Copy Incomplete" action to copy remaining items to clipboard
3. Users must add checklist items one at a time; no bulk operations
