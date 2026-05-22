# Tasks

## Task 1: Nest Thread Picker Sheet

### Subtask 1.1: Add DAO query for email chits
- [x] Add `getEmailChitsForNestPicker()` query to `ChitDao.kt` — returns all chits where `emailMessageId IS NOT NULL OR emailStatus IS NOT NULL` and `deleted = 0`, ordered by `emailDate DESC`

### Subtask 1.2: Add ViewModel methods for nest management
- [x] Add `loadEmailChitsForNestPicker()` to `ChitEditorViewModel` that exposes the DAO query as a StateFlow
- [x] Add `setNestThreadId(threadId: String)` that updates `formState.nestThreadId` and marks dirty
- [x] Add `clearNestThreadId()` that sets `formState.nestThreadId = null` and marks dirty
- [x] Add `getNestThreadSubject(): String?` that fetches the referenced chit's `emailSubject` or `title` from Room

### Subtask 1.3: Create NestThreadPickerSheet composable
- [x] Create `ui/screens/editor/NestThreadPickerSheet.kt` as a `ModalBottomSheet`
- [x] Include a search `OutlinedTextField` at the top that filters by subject and sender
- [x] Display a `LazyColumn` of email chits showing: subject (bold), from (secondary text), date (tertiary)
- [x] Single-tap a row calls `onSelect(chitId, subject)` callback and dismisses the sheet
- [x] Show empty state when no emails match the search or no email chits exist
- [x] Handle loading state while email chits are being fetched

### Subtask 1.4: Integrate picker into ChitEditorScreen
- [x] Add `showNestPicker` state variable to `ChitEditorScreen`
- [x] In `TitleMetadataRow`: when `nestThreadId` is null AND chit is not an email chit, show a "🪺" icon button that sets `showNestPicker = true`
- [x] In `TitleMetadataRow`: when `nestThreadId` is set, show an `AssistChip` with the thread subject text (fetched via ViewModel) — tap shows `cwocConfirm`-style AlertDialog asking "Remove nest from this thread?"
- [x] On confirm removal: call `viewModel.clearNestThreadId()`
- [x] Wire `NestThreadPickerSheet` — on select: call `viewModel.setNestThreadId(selectedId)`, dismiss sheet
- [x] Hide the Nest button entirely for email chits (where `emailMessageId != null || emailStatus != null`)

### Subtask 1.5: Verify save flow includes nestThreadId
- [x] Confirm that `ChitMapper.getChangedFields()` already includes `nest_thread_id` when `nestThreadId` changes (it does — verify no regression)
- [x] Confirm that saving a chit with changed `nestThreadId` syncs correctly to the server

## Task 2: Wire Export Data Buttons

### Subtask 2.1: Verify FileProvider configuration
- [x] Check `res/xml/file_paths.xml` for a `<cache-path>` entry that covers the exports subdirectory
- [x] If missing, add `<cache-path name="exports" path="exports/" />` to `file_paths.xml`

### Subtask 2.2: Implement export helper function
- [x] In `AdminSettingsTab.kt` (or a nearby utility), implement a `suspend fun exportData(context: Context, apiService: CwocApiService, type: String)` function that:
  - Calls the appropriate API endpoint based on type ("chits", "userdata", "all")
  - Writes the streaming response body to `context.cacheDir/exports/cwoc-{type}-export-{YYYYMMDD}.json`
  - Creates a `FileProvider` URI for the file
  - Launches a share intent (`ACTION_SEND`, type `application/json`) via `Intent.createChooser`
- [x] Handle errors by throwing exceptions that the caller can catch and display as toasts

### Subtask 2.3: Wire export buttons in AdminSettingsTab
- [x] Add local state: `isExporting: Boolean`, `exportError: String?`
- [x] Wire "Chit Data" export button onClick to launch coroutine calling `exportData(context, apiService, "chits")`
- [x] Wire "User Data" export button onClick to launch coroutine calling `exportData(context, apiService, "userdata")`
- [x] Add an "All Data" export button (if not already present) and wire it to `exportData(context, apiService, "all")`
- [x] While `isExporting` is true: show `CircularProgressIndicator` on the active button, disable all export buttons
- [x] On success: show toast "Export ready — choose where to save"
- [x] On failure: show error toast with reason, re-enable buttons
- [x] After share sheet dismisses: delete the temp file from cache

### Subtask 2.4: Ensure CwocApiService is accessible in AdminSettingsTab
- [x] Verify that `AdminSettingsTab` has access to `CwocApiService` (either via the SettingsViewModel or passed as a parameter)
- [x] If not directly available, add it as a parameter from the parent composable or inject via Hilt

## Task 3: Update Web Function Index

### Subtask 3.1: Mark already-implemented functions as complete
- [x] Update W140–W147 (Bundle Reorder) in Web Function Index to `✅` with references to `BundleToolbar.kt`, `BundleViewModel.reorderBundles()`
- [x] Update W208–W209 (Add to Bundle Modal) to `✅` with references to `EmailContextMenu.kt`, `BundlePickerDialog.kt`, `AddToBundleSheet`, `EmailViewModel.addEmailToBundle()`
- [x] Update W230–W232 (Password Management) to `✅` with references to `PasswordChangeZone()` in `ContactEditorScreen.kt`
- [x] Update W221–W222 (Badge Custom Modal) to `✅` with references to `CustomDetectorsSection`, `CustomDetectorDialog` in `BadgesSettingsTab.kt`

### Subtask 3.2: Mark newly-implemented functions as complete (after Tasks 1-2)
- [x] Update W135–W137 (Email Nesting) to `✅` with references to `NestThreadPickerSheet.kt`, `EmailThreadView.kt`, `ChitEditorViewModel`
- [x] Update W126–W128 (Export Data) to `✅` with references to `AdminSettingsTab.kt` export wiring


