# W208-209: Add to Bundle Modal

## What the web functions do
- `_showAddToBundleModal(chit)` — Opens a modal allowing the user to assign an email chit to a bundle (or move it between bundles). Shows a list of available bundles with the current assignment highlighted.
- `_executeAddToBundle(chit, overlay)` — Executes the bundle assignment: updates the chit's tags to include the bundle tag, removes old bundle tag if moving, saves the chit.

## What exists on Android
- Bundle assignment exists in the ChitEditorScreen (dropdown to select bundle)
- BundleViewModel has createBundle/updateBundle
- No quick "Add to Bundle" action from the email list view without opening the editor

## What's missing
1. No "Add to Bundle" quick action from the email list (must open editor to change bundle)
2. No modal/sheet for quick bundle assignment from EmailScreen card actions
3. Web allows bundle assignment directly from the email card's action menu; Android requires navigating to the full editor
