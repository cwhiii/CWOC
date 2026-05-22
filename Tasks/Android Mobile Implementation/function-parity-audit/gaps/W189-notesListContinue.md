# W189: _notesListContinue(textarea)

## What the web function does
When the user presses Enter in the notes textarea while on a list line (starting with `- `, `* `, or `1. `), automatically continues the list on the next line. If the current list item is empty (just the bullet), it removes the bullet instead (ending the list). This provides a smooth markdown list editing experience.

## What exists on Android
- NotesZone has a multiline text field for notes
- No automatic list continuation on Enter
- User must manually type `- ` or `* ` for each new list item

## What's missing
1. No auto-continuation of markdown lists (unordered `- ` / `* ` or ordered `1. `)
2. No auto-removal of empty list bullets on Enter (to end a list)
3. Users must manually format every list item, making list editing tedious
