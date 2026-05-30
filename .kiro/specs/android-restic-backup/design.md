# Design: Android App — Restic Backup Integration

## Architecture Overview

The Android Restic Backup feature is a pure **client-side UI** that manages backup targets via the existing server API. No backup logic runs on the device. The architecture follows the same pattern as the existing Ntfy and Tailscale integrations in the Android app:

```
┌─────────────────────────────────────────────────────────┐
│  UI Layer (Compose)                                      │
│  AdminSettingsTab.kt → BackupSection composable          │
│  BackupTargetModal (full-screen dialog)                  │
└──────────────────────┬──────────────────────────────────┘
                       │ StateFlow
┌──────────────────────▼──────────────────────────────────┐
│  ViewModel Layer                                         │
│  SettingsViewModel (backup state + operations)           │
└──────────────────────┬──────────────────────────────────┘
                       │ suspend functions
┌──────────────────────▼──────────────────────────────────┐
│  Data Layer                                              │
│  CwocApiService (Retrofit/OkHttp)                        │
│  → GET/POST/DELETE /api/backup/*                         │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP
┌──────────────────────▼──────────────────────────────────┐
│  Server (Python/FastAPI)                                  │
│  routes/backup.py — all restic logic lives here          │
└─────────────────────────────────────────────────────────┘
```

## Data Models (DTOs)

All data models live in `com.cwoc.app.data.remote.dto` as Kotlin data classes for JSON serialization.

### BackupTargetDto
```kotlin
data class BackupTargetDto(
    val id: String?,
    val name: String?,
    val configured: Boolean?,
    val enabled: Boolean?,
    val repo_type: String?,
    val repo_url: String?,
    val repo_password: String?,
    val backend_credentials: Map<String, String>?,
    val backup_paths: List<String>?,
    val schedule_frequency: String?,
    val schedule_time: String?,
    val retention_policy: RetentionPolicyDto?,
    val notification_recipients: NotificationRecipientsDto?,
    val notification_transfer: Boolean?,
    val notification_maintenance: Boolean?,
    val last_backup_time: String?,
    val last_backup_result: BackupResultDto?,
    val next_backup_time: String?,
    val repo_size: String?
)
```

### BackupTargetsResponseDto
```kotlin
data class BackupTargetsResponseDto(
    val targets: List<BackupTargetDto>,
    val orphans: List<OrphanRepoDto>?
)
```

### OrphanRepoDto
```kotlin
data class OrphanRepoDto(
    val path: String,
    val repo_size: String?
)
```

### RetentionPolicyDto
```kotlin
data class RetentionPolicyDto(
    val keep_last: Int?,
    val keep_daily: Int?,
    val keep_weekly: Int?,
    val keep_monthly: Int?,
    val keep_yearly: Int?
)
```

### NotificationRecipientsDto
```kotlin
data class NotificationRecipientsDto(
    val admins: String?,
    val trigger: String?
)
```

### BackupResultDto
```kotlin
data class BackupResultDto(
    val success: Boolean?,
    val message: String?,
    val snapshot_id: String?,
    val duration: Double?
)
```

### BackupSnapshotDto
```kotlin
data class BackupSnapshotDto(
    val id: String,
    val short_id: String?,
    val time: String?,
    val hostname: String?,
    val paths: List<String>?,
    val summary: SnapshotSummaryDto?
)

data class SnapshotSummaryDto(
    val total_size: Long?
)
```

### BackupSnapshotsResponseDto
```kotlin
data class BackupSnapshotsResponseDto(
    val success: Boolean?,
    val snapshots: List<BackupSnapshotDto>?,
    val error: String?,
    val message: String?
)
```

### BackupOperationResponseDto
```kotlin
data class BackupOperationResponseDto(
    val success: Boolean?,
    val message: String?,
    val snapshot_id: String?,
    val duration: Double?,
    val error: String?,
    val details: String?,
    val snapshots_removed: Int?,
    val space_reclaimed: String?,
    val results: List<BackupOperationResponseDto>?,
    val id: String?,
    val data_deleted: Boolean?
)
```

### BackupStatusResponseDto
```kotlin
data class BackupStatusResponseDto(
    val status: String?,
    val reachable: Boolean?,
    val last_check: String?,
    val message: String?
)
```

### BackupConfigSaveRequestDto
```kotlin
data class BackupConfigSaveRequestDto(
    val id: String?,
    val name: String,
    val enabled: Boolean,
    val repo_type: String,
    val repo_url: String,
    val repo_password: String,
    val backend_credentials: Map<String, String>,
    val backup_paths: List<String>,
    val schedule_frequency: String,
    val schedule_time: String,
    val retention_policy: RetentionPolicyDto,
    val notification_recipients: NotificationRecipientsDto,
    val notification_transfer: Boolean,
    val notification_maintenance: Boolean
)
```

### BackupRestoreRequestDto
```kotlin
data class BackupRestoreRequestDto(
    val snapshot_id: String,
    val target: String = "/",
    val target_id: String? = null
)
```

## API Service Extensions

Add to `CwocApiService.kt`:

```kotlin
// Backup endpoints
@GET("backup/targets")
suspend fun getBackupTargets(): Response<BackupTargetsResponseDto>

@GET("backup/config")
suspend fun getBackupConfig(@Query("target_id") targetId: String?): Response<BackupTargetDto>

@POST("backup/config")
suspend fun saveBackupConfig(@Body config: BackupConfigSaveRequestDto): Response<BackupOperationResponseDto>

@DELETE("backup/config/{targetId}")
suspend fun deleteBackupConfig(@Path("targetId") targetId: String): Response<BackupOperationResponseDto>

@DELETE("backup/config/{targetId}/destroy")
suspend fun deleteBackupConfigAndData(@Path("targetId") targetId: String): Response<BackupOperationResponseDto>

@DELETE("backup/orphan")
suspend fun deleteOrphanRepo(@Query("path") path: String): Response<BackupOperationResponseDto>

@POST("backup/run")
suspend fun runBackup(@Query("target_id") targetId: String? = null): Response<BackupOperationResponseDto>

@GET("backup/snapshots")
suspend fun getBackupSnapshots(@Query("target_id") targetId: String?): Response<BackupSnapshotsResponseDto>

@DELETE("backup/snapshots/{snapshotId}")
suspend fun deleteBackupSnapshot(
    @Path("snapshotId") snapshotId: String,
    @Query("target_id") targetId: String?
): Response<BackupOperationResponseDto>

@POST("backup/restore")
suspend fun restoreBackupSnapshot(@Body request: BackupRestoreRequestDto): Response<BackupOperationResponseDto>

@POST("backup/prune")
suspend fun pruneBackupSnapshots(@Query("target_id") targetId: String?): Response<BackupOperationResponseDto>

@GET("backup/status")
suspend fun getBackupStatus(@Query("target_id") targetId: String?): Response<BackupStatusResponseDto>

@GET("backup/info")
suspend fun getBackupInfo(@Query("target_id") targetId: String?): Response<BackupOperationResponseDto>
```

## ViewModel State

Add to `SettingsViewModel.kt`:

```kotlin
data class BackupState(
    val targets: List<BackupTargetDto> = emptyList(),
    val orphans: List<OrphanRepoDto> = emptyList(),
    val isLoading: Boolean = false,
    val headerStatus: String = "inactive", // inactive, incomplete, ok, local_only, error
    val lastBackupTime: String? = null,
    val nextBackupTime: String? = null,
    val targetCount: Int = 0
)

data class BackupModalState(
    val isOpen: Boolean = false,
    val isEditMode: Boolean = false,
    val targetId: String? = null,
    val config: BackupTargetDto? = null,
    val isLoading: Boolean = false,
    val isSaving: Boolean = false,
    val isRunningBackup: Boolean = false,
    val isCheckingStatus: Boolean = false,
    val isLoadingSnapshots: Boolean = false,
    val isRestoring: Boolean = false,
    val isPruning: Boolean = false,
    val feedbackMessage: String? = null,
    val feedbackType: String? = null, // success, error, warning, info
    val snapshots: List<BackupSnapshotDto>? = null,
    val showSnapshots: Boolean = false,
    val showRestoreList: Boolean = false
)
```

## UI Components

### BackupSection (in AdminSettingsTab.kt)
- Zone-button header with status icon + help icon
- AnimatedVisibility for collapsible body
- Status panel (target count, last backup, next scheduled)
- Target list (LazyColumn or Column of clickable cards)
- Orphan list (dashed border cards with delete button)
- Action buttons row (Add Target, Backup All Now)

### BackupTargetModal (new file or inline)
- Full-screen dialog (matching the web's fixed overlay pattern)
- Scrollable content with collapsible sections
- Form fields matching web exactly
- Operation buttons grid (3-column grid matching web layout)
- Cancel/Done buttons at bottom
- Inline feedback area
- Results area (snapshots list, restore picker)

## Platform Differences (Android vs Web)

| Aspect | Web | Android |
|--------|-----|---------|
| UI framework | Vanilla HTML/JS/CSS | Jetpack Compose + Material 3 |
| Styling | Parchment theme, inline styles | CWOC Material theme (CwocButtonDefaults, etc.) |
| Modal | Fixed overlay div | AlertDialog or full-screen Dialog composable |
| Collapsible sections | `display:none` toggle | `AnimatedVisibility` |
| Dropdowns | `<select>` | `ExposedDropdownMenuBox` |
| Checkboxes | `<input type="checkbox">` | `Checkbox` composable |
| Password toggle | Input type swap | `PasswordVisualTransformation` toggle |
| Time picker | `cwocTimePicker.open()` | Android TimePickerDialog or Material TimePicker |
| Toast | `cwocToast()` | Android `Toast` or Snackbar |
| Confirm dialog | `cwocConfirm()` | `AlertDialog` with CWOC theming |
| Download | Hidden `<a>` link click | `DownloadManager` or open URL in browser |
| HTTP client | `fetch()` | OkHttp/Retrofit via `CwocApiService` |

## File Organization

```
android/app/src/main/java/com/cwoc/app/
  data/remote/
    dto/
      BackupDto.kt          ← All backup DTOs (new file)
    CwocApiService.kt       ← Add backup endpoint declarations
  ui/screens/settings/
    AdminSettingsTab.kt     ← Add BackupSection composable + BackupTargetModal
  (SettingsViewModel.kt     ← Add backup state + operations)
```

## No Room/Local Storage Required

The backup feature is entirely server-managed. No local database tables, entities, or migrations are needed. All state comes from the server API on each load. This means:
- No Room migration needed
- No local entity needed
- No DAO needed
- No sync needed

The ViewModel holds transient UI state only (loaded from server, not persisted locally).
