# W54-W62: Send Item Feature (editor-send-item.js)

## What the web feature does
Per-item send with a quick popup showing recent chits:
- W54: `_openSendItemPopup` — opens a small popup near the item showing 5 recent chits
- W55: `_closeSendItemPopup` — closes popup
- W56: `_fetchRecentChitsForItem` — fetches recently-modified chits for quick selection
- W57: `_renderSendItemPopup` — renders the popup with recent chit buttons
- W58: `_openSendItemSearchModal` — opens full search modal if target not in recents
- W59: `_closeSendItemSearchModal` — closes search modal
- W60: `_executeSendItem(mode, targetChit)` — executes copy or move of the item
- W61: `_sendItemSpawnNewChit(mode)` — creates a brand new chit from the item
- W62: `_flashChecklistAddArrow` — visual feedback (arrow flash) when item is added

## What exists on Android
`ChecklistZoneV2.kt` has `onSendItemsToChit` with `ChitPickerSheet`:
- Opens a chit picker (full list with search)
- Supports single-item or multi-select send
- Moves items to target chit (removes from source)
- Uses `ChitPickerSheet` (same component as prerequisites picker)

## What's different
1. **No quick popup with recent chits** — Android goes straight to full picker, web shows a small popup with 5 recent chits first (faster for common targets)
2. **No "Spawn New Chit" option** — web can create a brand new chit from the item; Android only sends to existing chits
3. **No copy mode** — Android only moves (removes from source); web supports both copy and move
4. **No visual flash feedback** — web flashes an arrow on the target; Android has no equivalent animation

## Fix needed
- Add "Create New Chit" option to the picker
- Add copy mode (keep item in source while also adding to target)
- Consider adding a "recent chits" quick-select before the full picker
