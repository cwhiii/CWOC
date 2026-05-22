# W429, W431: Project Child Chit Picker & Create

## What the web functions do
- `openAddChitModal()` (W429) — Opens a searchable chit picker modal to add an existing chit as a child of the current project. User can search by title, see results, and click to add.
- `createNewChildChit(event)` (W431) — Creates a brand new chit pre-configured as a child of the current project (sets parent project ID, adds to child_chits list, navigates to editor for the new chit).

## What exists on Android
- ProjectsZone has a "Pick Chit" button but `onPickChit` callback is not wired
- ProjectsZone has a "Create New" button but `onCreateNewChild` callback is not wired
- Manual ID text field works (user can type a chit ID to add)
- ChitPickerSheet composable exists but isn't connected to ProjectsZone

## What's missing
1. "Pick Chit" button doesn't open the ChitPickerSheet (callback not wired)
2. "Create New" button doesn't create a new child chit (callback not wired)
3. Users can only add children by manually typing chit IDs — no search/browse
4. The UI elements exist but the functionality behind them is not connected
