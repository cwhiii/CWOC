# W684: _showDeleteSubMenu (Recurrence Instance Options)

## What the web function does
When deleting a chit that is a recurring instance, shows a submenu with options:
- "Delete this instance only" (adds a broken_off exception for this date)
- "Delete this and all future" (adds exceptions for this date onwards, or sets until date)
- "Delete entire series" (deletes the parent recurring chit)

For non-recurring chits, shows a simple delete confirmation.

## What exists on Android
- Simple delete exists (soft-delete the chit)
- UndoToast for delete reversal
- No recurrence-aware delete options

## What's missing
1. No "Delete this instance only" option for recurring chit instances
2. No "Delete this and all future" option
3. No "Delete entire series" option
4. Deleting a recurring instance deletes the whole series rather than just one occurrence
5. Related to W095 (recurrence series editing) — same gap file covers the broader recurrence action system
