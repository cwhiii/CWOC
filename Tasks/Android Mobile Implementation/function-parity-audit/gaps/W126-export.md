# W126-W128: Export Data Functions

## What the web functions do
- W126 `exportChitData()`: downloads all chits as JSON file
- W127 `exportUserData()`: downloads user data (settings + contacts) as JSON
- W128 `exportAllData()`: downloads everything as JSON

These are buttons in the Settings → Admin → Data Management section.

## What exists on Android
- `CwocApiService.kt` has the API endpoints defined: `exportChits()`, `exportUsers()`, `exportAll()`
- Contact export works (vcf/csv) via `ContactListViewModel.exportContacts()`
- But NO UI buttons for chit/user/all export in the Settings screen

## What's missing
Export buttons in the Admin settings tab. The API calls are defined but not wired to any UI action.

## Fix needed
Add "Export Chits", "Export User Data", "Export All" buttons to `AdminSettingsTab.kt` that call the API endpoints, save the response to a file, and open the Android share sheet.
