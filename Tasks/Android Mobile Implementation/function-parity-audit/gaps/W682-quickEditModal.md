# W682: showQuickEditModal(chit, onRefresh)

## What the web function does
Opens a quick-edit modal on a chit card (long-press or right-click). The modal shows:
- Pin/Unpin toggle
- Archive/Unarchive toggle
- Snooze submenu (preset durations + custom)
- Delete (with recurrence instance options)
- **Inline status dropdown** (change status without opening editor)
- **Inline priority dropdown** (change priority without opening editor)

## What exists on Android
- `ChitActionMenu` composable has: pin, archive, snooze, delete actions
- No inline status dropdown in the action menu
- No inline priority dropdown in the action menu
- Users must open the full editor to change status or priority

## What's missing
1. No inline status dropdown in ChitActionMenu (must open editor to change status)
2. No inline priority dropdown in ChitActionMenu (must open editor to change priority)
3. Web allows quick status/priority changes from any card; Android requires full editor navigation
