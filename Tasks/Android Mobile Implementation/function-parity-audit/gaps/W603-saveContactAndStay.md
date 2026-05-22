# W603: saveContactAndStay()

## What the web function does
Saves the current contact without navigating away from the editor. The user stays on the contact editor page after saving, allowing them to continue editing. This is the "Save" button (as opposed to "Save & Exit").

## What exists on Android
- ContactEditorViewModel.save() saves the contact AND sets `_isSaved = true`
- When `_isSaved` becomes true, the LaunchedEffect navigates back
- There is no "save and stay" option — every save navigates away

## What's missing
1. No "Save & Stay" action in the contact editor
2. Every save forces navigation back to the contacts list
3. Users who want to save progress and continue editing must re-open the contact
4. Need a `saveAndStay()` function that persists without setting `_isSaved = true`
