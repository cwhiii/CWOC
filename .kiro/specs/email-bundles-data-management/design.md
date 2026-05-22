# Design Document

## Overview

This design covers the implementation of the two remaining gaps in Spec 4 (Email, Bundles & Data Management): the Nest Thread Picker editor UI and the Export Data button wiring.

The existing Android infrastructure provides strong foundations:
- **Email nesting rendering** is complete: `EmailThreadView.kt` renders nested chits, `EmailViewModel.findNestedChits()` queries them, and `ChitEntity.nestThreadId` is fully synced. The `TitleMetadataRow` in `ChitEditorScreen.kt` already shows a "Thread" chip when `nestThreadId` is set, but the click handler is empty.
- **Export API endpoints** are defined in `CwocApiService.kt` (`exportChits()`, `exportUsers()`, `exportAll()`) with `@Streaming` annotation. Buttons exist in `AdminSettingsTab.kt` but have TODO onClick handlers.

The implementation is focused and surgical: add a thread picker sheet and wire the export buttons.

## Architecture

### Component Interaction Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         UI Layer (Compose)                           │
├─────────────────────────────────────────────────────────────────────┤
│ ChitEditorScreen                                                     │
│   ├── TitleMetadataRow (existing — enhance nest chip click)         │
│   └── NestThreadPickerSheet (NEW — bottom sheet with email list)    │
│                                                                      │
│ AdminSettingsTab                                                     │
│   └── Export buttons (existing — wire onClick handlers)             │
├─────────────────────────────────────────────────────────────────────┤
│                       ViewModel Layer                                 │
├─────────────────────────────────────────────────────────────────────┤
│ ChitEditorViewModel                                                  │
│   ├── loadEmailChitsForNestPicker() — NEW                           │
│   ├── setNestThreadId(threadId, subject) — NEW                      │
│   └── clearNestThreadId() — NEW                                     │
│                                                                      │
│ SettingsViewModel (or AdminSettingsTab local scope)                  │
│   └── exportData(type: ExportType) — NEW                            │
├─────────────────────────────────────────────────────────────────────┤
│                       Data Layer                                      │
├─────────────────────────────────────────────────────────────────────┤
│ ChitDao — existing query for email chits                             │
│ CwocApiService — existing export endpoints (already @Streaming)     │
│ ExportRepository (or inline in ViewModel) — file save + share       │
└─────────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### New Components

- **NestThreadPickerSheet** (`ui/screens/editor/NestThreadPickerSheet.kt`) — A `ModalBottomSheet` composable that displays a searchable list of email chits. Shows subject, sender, and date for each email. Single-tap selects the email as the nest target.

### Modified Components

- **ChitEditorScreen.kt** — Add state for showing the nest picker sheet. Enhance `TitleMetadataRow` to:
  - Show a "🪺 Nest" button (or icon) for non-email chits when no nest is set → opens picker
  - Make the existing "Thread" chip clickable → shows remove confirmation dialog
  - Display the thread subject text in the chip (fetched from the referenced chit)

- **ChitEditorViewModel.kt** — Add methods:
  - `loadEmailChitsForNestPicker(): Flow<List<ChitEntity>>` — queries Room for all chits where `emailMessageId != null OR emailStatus != null` and `deleted = 0`, sorted by `emailDate DESC`
  - `setNestThreadId(threadId: String)` — updates `formState.nestThreadId`, marks dirty
  - `clearNestThreadId()` — sets `formState.nestThreadId = null`, marks dirty
  - `getNestThreadSubject(): String?` — fetches the title/emailSubject of the chit referenced by current `nestThreadId`

- **AdminSettingsTab.kt** — Wire the existing export button onClick handlers to:
  1. Call the appropriate `CwocApiService` export endpoint
  2. Write the response body to a temp file in `context.cacheDir`
  3. Create a share intent with `FileProvider` URI
  4. Launch the share sheet via `context.startActivity()`

- **ChitDao.kt** — Add query (if not already present):
  ```kotlin
  @Query("SELECT * FROM chits WHERE (emailMessageId IS NOT NULL OR emailStatus IS NOT NULL) AND deleted = 0 ORDER BY emailDate DESC")
  fun getEmailChitsForNestPicker(): Flow<List<ChitEntity>>
  ```

## Data Models

### No New Entities Required

All data models already exist:
- `ChitEntity.nestThreadId` — already defined, synced, and included in dirty field tracking
- `ChitFormState.nestThreadId` — already in the form state used by the editor
- `CwocApiService.exportChits/exportUsers/exportAll` — already defined with `@Streaming`

### Export File Naming

```
cwoc-chits-export-{YYYYMMDD}.json
cwoc-userdata-export-{YYYYMMDD}.json
cwoc-all-export-{YYYYMMDD}.json
```

Files are written to `context.cacheDir/exports/` and shared via `FileProvider`.

## Detailed Design: Nest Thread Picker

### UI Flow

1. User opens editor for a non-email chit
2. In the metadata row, a "🪺 Nest" icon/button appears (only for non-email chits)
3. If `nestThreadId` is already set: show thread subject as a chip → tap shows "Remove nest?" confirmation
4. If `nestThreadId` is null: tap the Nest button → opens `NestThreadPickerSheet`
5. Sheet shows:
   - Search field at top (filters by subject and sender)
   - Scrollable list of email chits with: Subject (bold), From (secondary), Date (tertiary)
   - Empty state if no emails found
6. User taps an email → `nestThreadId` is set, sheet closes, chip appears with subject text
7. Save persists the change normally through existing save flow

### Thread Subject Resolution

When loading a chit that already has `nestThreadId` set, the ViewModel fetches the referenced chit from Room to get its `emailSubject` or `title` for display. This is a one-time lookup on load (not reactive).

## Detailed Design: Export Data Wiring

### UI Flow

1. User navigates to Settings → Admin → Data Management
2. Taps "📤 Export" button next to "Chit Data", "User Data", or (new) "All Data"
3. Button shows loading spinner, other export buttons become disabled
4. API call completes → response body written to temp file
5. Share sheet opens with the file
6. On share sheet dismiss → temp file deleted, buttons re-enabled

### Implementation Approach

Since the export logic is straightforward and only used in one place, implement it directly in `AdminSettingsTab.kt` using a `rememberCoroutineScope` and local state for loading/error. No separate ViewModel needed — the API service can be accessed via the existing settings ViewModel or passed directly.

```kotlin
// Pseudocode for export flow
suspend fun exportData(context: Context, apiService: CwocApiService, type: String) {
    val response = when (type) {
        "chits" -> apiService.exportChits()
        "userdata" -> apiService.exportUsers()
        "all" -> apiService.exportAll()
        else -> return
    }
    if (!response.isSuccessful) throw Exception("Export failed: ${response.code()}")
    
    val dateStr = SimpleDateFormat("yyyyMMdd", Locale.US).format(Date())
    val fileName = "cwoc-${type}-export-${dateStr}.json"
    val exportDir = File(context.cacheDir, "exports").apply { mkdirs() }
    val file = File(exportDir, fileName)
    
    response.body()?.byteStream()?.use { input ->
        file.outputStream().use { output -> input.copyTo(output) }
    }
    
    val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
    val shareIntent = Intent(Intent.ACTION_SEND).apply {
        this.type = "application/json"
        putExtra(Intent.EXTRA_STREAM, uri)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
    context.startActivity(Intent.createChooser(shareIntent, "Export $type"))
}
```

### FileProvider Configuration

Verify that `file_paths.xml` includes the cache directory. If not, add:
```xml
<cache-path name="exports" path="exports/" />
```

## Error Handling

- **Nest picker — no email chits found:** Show empty state text "No email chits found. Emails must be synced first."
- **Nest picker — Room query fails:** Show error text in the sheet, allow retry.
- **Nest thread subject lookup fails:** Show "Thread" as fallback text in the chip (already the current behavior).
- **Export — network failure:** Toast "Export failed: network error", re-enable buttons.
- **Export — server error (4xx/5xx):** Toast "Export failed: server returned {code}", re-enable buttons.
- **Export — file write failure:** Toast "Export failed: could not save file", re-enable buttons.
- **Export — share sheet cancelled:** Clean up temp file silently, no error shown.

## Testing Strategy

Tests are optional per project rules. Manual verification:
1. Open editor for a non-email chit → verify Nest button appears
2. Tap Nest button → verify picker opens with email list
3. Search in picker → verify filtering works
4. Select an email → verify chip appears with subject, editor marked dirty
5. Save → verify `nestThreadId` persists and chit appears in email thread view
6. Tap chip → verify remove confirmation appears
7. Confirm removal → verify chip disappears, editor marked dirty
8. Open editor for an email chit → verify Nest button is hidden
9. Tap Export Chits → verify share sheet opens with JSON file
10. Tap Export User Data → verify share sheet opens with JSON file
11. Verify loading state during export
12. Disconnect network → tap export → verify error toast

## Already-Implemented Functions (No Work Needed)

For completeness, these Spec 4 functions are already fully implemented on Android and require NO changes — only updating the Web Function Index status:

| W# | Function | Android Implementation |
|----|----------|----------------------|
| W140–W147 | Bundle tab drag reorder | `BundleToolbar.kt` drag gestures + `BundleViewModel.reorderBundles()` |
| W208–W209 | Add to Bundle modal | `EmailContextMenu.kt` → `BundlePickerDialog.kt` / `AddToBundleSheet` |
| W230–W232 | Password management | `PasswordChangeZone()` in `ContactEditorScreen.kt` |
| W221–W222 | Badge custom detector modal | `CustomDetectorsSection` + `CustomDetectorDialog` in `BadgesSettingsTab.kt` |


