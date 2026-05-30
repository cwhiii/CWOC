# Implementation Plan: Android App — Restic Backup Integration

## Overview

Implement the Restic Backup management UI in the Android app, matching the web/mobile implementation exactly. The app is a pure client — it calls the existing `/api/backup/*` server endpoints. No backup logic runs on the device. No Room migrations or local storage needed.

The implementation follows the same pattern as the existing Ntfy section in `AdminSettingsTab.kt`: zone-button header with status icon, collapsible body, ViewModel state management via StateFlow, and API calls through `CwocApiService`.

## Tasks

- [x] 1. Data layer — DTOs and API service
  - [x] 1.1 Create `BackupDto.kt` with all backup data transfer objects
    - Create file at `android/app/src/main/java/com/cwoc/app/data/remote/dto/BackupDto.kt`
    - Add all DTOs: `BackupTargetDto`, `BackupTargetsResponseDto`, `OrphanRepoDto`, `RetentionPolicyDto`, `NotificationRecipientsDto`, `BackupResultDto`, `BackupSnapshotDto`, `SnapshotSummaryDto`, `BackupSnapshotsResponseDto`, `BackupOperationResponseDto`, `BackupStatusResponseDto`, `BackupConfigSaveRequestDto`, `BackupRestoreRequestDto`
    - All fields nullable where the server may omit them; use `@SerializedName` annotations matching the server's JSON field names exactly
    - _Requirements: 10.1_

  - [x] 1.2 Add backup API endpoints to `CwocApiService.kt`
    - Add all 14 endpoint declarations matching the server's `/api/backup/*` routes:
      - `GET backup/targets`
      - `GET backup/config` (with `target_id` query param)
      - `POST backup/config` (body: `BackupConfigSaveRequestDto`)
      - `DELETE backup/config/{targetId}`
      - `DELETE backup/config/{targetId}/destroy`
      - `DELETE backup/orphan` (with `path` query param)
      - `POST backup/run` (with optional `target_id` query param)
      - `GET backup/snapshots` (with `target_id` query param)
      - `DELETE backup/snapshots/{snapshotId}` (with `target_id` query param)
      - `POST backup/restore` (body: `BackupRestoreRequestDto`)
      - `POST backup/prune` (with `target_id` query param)
      - `GET backup/status` (with `target_id` query param)
      - `GET backup/info` (with `target_id` query param)
      - `GET backup/snapshots/{snapshotId}/download` (with `target_id` query param) — returns URL for DownloadManager
    - _Requirements: 10.1, 10.2_

- [x] 2. ViewModel layer — State and operations
  - [x] 2.1 Add backup state classes to `SettingsViewModel.kt`
    - Add `BackupState` data class (targets, orphans, isLoading, headerStatus, lastBackupTime, nextBackupTime, targetCount)
    - Add `BackupModalState` data class (isOpen, isEditMode, targetId, config, operation flags, feedback, snapshots)
    - Add `_backupState` MutableStateFlow and public `backupState` StateFlow
    - Add `_backupModalState` MutableStateFlow and public `backupModalState` StateFlow
    - _Requirements: 11.1, 11.2_

  - [x] 2.2 Implement backup ViewModel operations — target management
    - `loadBackupTargets()` — calls `GET /api/backup/targets`, updates `backupState` with targets, orphans, computes headerStatus (matching web's icon logic: inactive/incomplete/ok/local_only/error), extracts lastBackupTime and nextBackupTime
    - `openBackupTargetModal(targetId: String?)` — if targetId is null, opens in create mode with defaults; if non-null, calls `GET /api/backup/config?target_id=X` and opens in edit mode with populated fields
    - `closeBackupTargetModal()` — resets modal state, refreshes target list
    - `saveBackupConfig(config: BackupConfigSaveRequestDto)` — calls `POST /api/backup/config`, handles success (toast + refresh) and error (inline feedback)
    - `deleteBackupConfig(targetId: String)` — calls `DELETE /api/backup/config/{targetId}`, closes modal, refreshes list
    - `deleteBackupConfigAndData(targetId: String)` — calls `DELETE /api/backup/config/{targetId}/destroy`, closes modal, refreshes list
    - `deleteOrphanRepo(path: String)` — calls `DELETE /api/backup/orphan?path=X`, refreshes list
    - _Requirements: 1.5, 2.1, 2.2, 3.1, 4.1, 5.4, 5.5, 5.6, 6.7, 6.8, 10.3, 11.3_

  - [x] 2.3 Implement backup ViewModel operations — backup/restore/prune
    - `runBackupAll()` — calls `POST /api/backup/run` (no target_id), shows loading, toasts result, refreshes list
    - `runBackupTarget(targetId: String)` — calls `POST /api/backup/run?target_id=X`, shows loading in modal, displays inline feedback with snapshot_id and duration on success
    - `checkBackupStatus(targetId: String)` — calls `GET /api/backup/status?target_id=X`, displays inline feedback (healthy/error)
    - `loadBackupSnapshots(targetId: String)` — calls `GET /api/backup/snapshots?target_id=X`, populates modal snapshots list
    - `deleteBackupSnapshot(snapshotId: String, targetId: String)` — calls `DELETE /api/backup/snapshots/{id}?target_id=X`, refreshes snapshot list
    - `restoreBackupSnapshot(snapshotId: String, targetId: String)` — calls `POST /api/backup/restore`, displays result feedback
    - `downloadBackupSnapshot(snapshotId: String, targetId: String)` — constructs download URL, triggers via DownloadManager or browser intent
    - `pruneBackupSnapshots(targetId: String)` — calls `POST /api/backup/prune?target_id=X`, displays result (snapshots_removed, space_reclaimed)
    - _Requirements: 1.7, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 7.1, 7.2, 7.3, 8.1_

  - [x] 2.4 Implement backup date/time formatting helpers
    - `formatBackupDateTime(isoString: String?): String` — formats ISO timestamp respecting user's 12h/24h preference from settings state, returns "—" for null/invalid
    - `formatBackupTime(time24: String?): String` — formats "HH:MM" to user's preferred format
    - `formatBackupRelativeTime(isoString: String?): String` — returns "just now", "Xm ago", "Xh ago", "Xd ago", "Xw ago" — matching web's `_backupRelativeTime()` exactly
    - `formatBackupBytes(bytes: Long?): String` — returns "X B/KB/MB/GB/TB" — matching web's `_backupFormatBytes()`
    - _Requirements: 9.1, 9.2, 9.3_

- [x] 3. UI layer — BackupSection composable
  - [x] 3.1 Implement BackupSection header and status panel
    - Add `BackupSection` composable in `AdminSettingsTab.kt` (after HomeAssistantSection in DependentAppsSection)
    - Zone-button header: "Restic Backup  {statusIcon}" using `CwocButtonDefaults.outsetColors()` — matching Ntfy pattern
    - Help icon (❓) that toggles help text card — matching Ntfy pattern
    - Help text content: "Restic is an encrypted, deduplicated backup tool. Configure multiple backup targets to protect your CWOC data across local or remote storage." + link mention to help guide
    - AnimatedVisibility for collapsible body
    - Lazy-load targets when section first expands (matching Ntfy's `initialized` pattern)
    - Status panel: Row with "Targets: {count}", "Last backup: {time}", "Next scheduled: {time}" — matching web's `#backup-status-panel`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.9, 11.3_

  - [x] 3.2 Implement backup target list rendering
    - Render each target as a clickable Card: status icon (🟢/🔴/⚪) + name (bold) + subtitle (repo type · last time · size) + chevron (›)
    - On click → `openBackupTargetModal(target.id)`
    - Empty state: "No backup targets configured yet." (centered, dimmed)
    - Orphan rendering: 👻 icon, "Orphaned Local Backup", path + size, "💀 Delete" button with confirmation dialog
    - _Requirements: 1.5, 1.8, 2.1, 2.2, 2.3, 2.4_

  - [x] 3.3 Implement action buttons row
    - Row with two buttons: "➕ Add Target" (onClick → `openBackupTargetModal(null)`) and "▶️ Backup All Now" (onClick → `runBackupAll()`, shows loading state)
    - Buttons use `OutlinedButton` or `Button` with CWOC styling, `Modifier.weight(1f)` for equal width
    - _Requirements: 1.6, 1.7_

- [x] 4. UI layer — BackupTargetModal
  - [x] 4.1 Implement modal shell and navigation
    - Full-screen `AlertDialog` or `Dialog(onDismissRequest = { close })` with scrollable content
    - Title: "Add Backup Target" (create) or "Edit: {name}" (edit)
    - Hidden target ID state
    - Cancel button → close without saving
    - Done button → validate + save + close
    - Back/dismiss → same as cancel
    - _Requirements: 3.1, 4.1, 5.7_

  - [x] 4.2 Implement Repository section (collapsible, expanded by default)
    - Collapsible header "Repository ▾/▸" with toggle
    - Name field: `OutlinedTextField` (required, placeholder "e.g. Local Backup, NAS Nightly")
    - Type dropdown: `ExposedDropdownMenuBox` with all 8 options (Local, SFTP, S3, B2, Azure, GCS, REST, rclone)
    - URL/Path field: conditional visibility based on type (hidden for local/sftp, shown for others with type-specific label and placeholder)
    - Password field: `OutlinedTextField` with `PasswordVisualTransformation` toggle (👁️ button)
    - Dynamic credential fields per type:
      - SFTP: Username, Host (required), Port (default 22), Remote Path, Auth method radio (Password/SSH Key), conditional password or key path field
      - S3: Access Key ID, Secret Access Key, Region
      - B2: Account ID, Application Key
      - Azure: Account Name, Account Key
      - GCS: Project ID, Credentials JSON Path
      - REST: Username, Password
      - rclone: Config Name
    - "Local" option disabled if local target already exists (check from targets list state)
    - _Requirements: 3.2, 3.3, 3.4, 3.5_

  - [x] 4.3 Implement Data to Backup section (collapsible, collapsed by default)
    - Collapsible header "Data to Backup ▸/▾"
    - Three groups with bold labels: "Critical", "Important", "Nice to Have"
    - Checkbox list with same paths and default checked states as web:
      - Critical (checked): Database pre-backup copy, Encryption key, Contact profile pictures, User profile pictures, Attachments, Contact vCards
      - Important (checked): SSL certificates, Systemd service file, Nginx config
      - Nice to Have (unchecked): Client log, Update log
    - _Requirements: 3.2_

  - [x] 4.4 Implement Schedule section (collapsible, expanded by default)
    - Collapsible header "Schedule ▾/▸"
    - Frequency dropdown: Hourly, Every 6 Hours, Daily (default), Weekly, Manual Only
    - Time picker: visible only for Daily/Weekly, shows formatted time, opens TimePickerDialog on tap
    - _Requirements: 3.6, 3.7_

  - [x] 4.5 Implement Retention Policy section (collapsible, collapsed by default)
    - Collapsible header "Retention Policy ▸/▾"
    - Hint text: "How many snapshots to keep. Old snapshots are automatically pruned to this policy after each backup."
    - Number fields: Keep last (5), Keep daily (7), Keep weekly (4), Keep monthly (6), Keep yearly (2)
    - _Requirements: 3.2_

  - [x] 4.6 Implement Notifications section (collapsible, collapsed by default)
    - Collapsible header "Notifications ▸/▾"
    - Notify dropdown: "All Admins" (only option for now)
    - Trigger dropdown: "Both (Success & Failures)" (default), "Success Only", "Failures Only"
    - Checkboxes: "Transfer notifications (backup/restore)" (checked), "Maintenance notifications (prune)" (checked)
    - _Requirements: 3.2_

  - [x] 4.7 Implement inline feedback and results area
    - Feedback composable: colored Card (green/red/yellow/neutral background) with icon + message text, dismissible on tap
    - Results area: scrollable Column below feedback for snapshot lists and restore picker
    - _Requirements: 8.1, 8.2, 8.3_

  - [x] 4.8 Implement operation buttons grid
    - 3-column grid layout matching web:
      - Row 1: 🩺 Status, 📋 Snapshots, (empty/spacer)
      - Row 2: ▶️ Backup Now, ♻️ Restore, ⬇️ Download
      - Row 3: 🗑️ Manual Prune, 🔌 Remove, 💀 Remove & Delete
    - Each button shows loading state when its operation is in progress
    - "▶️ Backup Now" disabled in create mode (before first save)
    - "🔌 Remove" and "💀 Remove & Delete" hidden in create mode, visible in edit mode
    - Remove/Delete buttons use red/danger text color
    - _Requirements: 3.8, 3.9, 4.3, 4.4_

  - [x] 4.9 Implement snapshot list display
    - Triggered by "📋 Snapshots" button
    - Shows count header: "{N} Snapshot(s)"
    - Each snapshot row: short_id (monospace, bold) + relative time (dimmed) on first line, formatted timestamp + size on second line, Download (⬇️) and Delete (🗑️) buttons
    - Delete button shows confirmation dialog before calling API
    - Download button triggers browser/DownloadManager
    - _Requirements: 6.3, 7.1, 7.2, 7.3_

  - [x] 4.10 Implement restore flow
    - Triggered by "♻️ Restore" button
    - Loads snapshot list (same API call as 📋 Snapshots)
    - Displays selectable list: "Select a snapshot to restore:" header, each snapshot clickable
    - On snapshot tap: shows destructive confirmation dialog with EXACT same warning text as web:
      - "⚠️ THIS WILL PERMANENTLY DESTROY ALL EXISTING DATA"
      - Shows backup target name, snapshot ID + date, current date
      - "All current data, settings, and configurations for all users will be permanently and irrevocably lost. There is no undo."
      - "💡 Consider clicking Backup Now and Download first..."
      - Confirm button: "Restore — Delete All Current Data" (danger styled)
    - On confirm: calls `POST /api/backup/restore`, shows result feedback
    - _Requirements: 6.4_

  - [x] 4.11 Implement validation and save logic
    - Validate on Done tap:
      - Name always required
      - Password required if creating new target (not editing existing)
      - Host required for SFTP type
      - URL required for non-local, non-SFTP types
    - Highlight invalid fields (red border via `isError = true` on OutlinedTextField)
    - Show feedback "Please fill in the required fields" on validation failure
    - Gather all form fields into `BackupConfigSaveRequestDto` (matching web's `_gatherBackupConfig()` logic exactly, including building repo_url for SFTP from user+host+port+path)
    - Call `saveBackupConfig()` on ViewModel
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [x] 4.12 Implement prune flow
    - Triggered by "🗑️ Manual Prune" button
    - Shows confirmation dialog: "Pruning will permanently remove old snapshots based on your retention policy. This cannot be undone." with "Prune" danger button
    - On confirm: calls `POST /api/backup/prune?target_id=X`
    - Shows result feedback: "Prune completed. Removed: X snapshot(s). Reclaimed: Y."
    - _Requirements: 6.6_

  - [x] 4.13 Implement Remove and Delete flows
    - "🔌 Remove" button:
      - Confirmation dialog matching web text: "This removes the backup configuration from CWOC but leaves all repository data and snapshots on disk..." + warning about needing password to reconnect
      - On confirm: calls `DELETE /api/backup/config/{targetId}`, toasts "Configuration removed (data preserved on disk)", closes modal, refreshes list
    - "💀 Remove & Delete" button:
      - Destructive confirmation matching web text: "⚠️ This will PERMANENTLY DELETE the backup configuration AND all repository data including every snapshot..."
      - On confirm: calls `DELETE /api/backup/config/{targetId}/destroy`, toasts result, closes modal, refreshes list
    - _Requirements: 6.7, 6.8_

- [x] 5. Integration and wiring
  - [x] 5.1 Wire BackupSection into DependentAppsSection
    - Add `BackupSection` call in `DependentAppsSection` composable after the Home Assistant section
    - Pass `settingsState`, `onUpdateSetting`, and `settingsViewModel` parameters
    - Ensure the section only renders when `settingsViewModel != null` (matching Ntfy/Tailscale pattern)
    - _Requirements: 1.1_

  - [x] 5.2 Wire download functionality
    - Implement `downloadBackupSnapshot()` in ViewModel:
      - Construct URL: `{baseUrl}/api/backup/snapshots/{snapshotId}/download?target_id={targetId}`
      - Use Android `DownloadManager` to enqueue the download with proper auth headers, OR open the URL in the browser (simpler, auth cookie may work)
      - If DownloadManager approach: set notification visibility, destination to Downloads folder, add auth header from token
    - _Requirements: 6.5, 7.2_

## Notes

- **No Room migration needed.** All backup state is server-side. The app fetches it fresh each time.
- **No new dependencies.** Uses existing OkHttp/Retrofit, Compose, Material 3.
- **No software installation.** This is pure Kotlin/Compose code.
- **Pattern reference:** The Ntfy section in `AdminSettingsTab.kt` (lines 1549+) is the closest existing pattern. Follow its structure for state management, API calls, and UI composition.
- **The web implementation is the spec.** Every function, every button, every flow in the web's `settings-integrations.js` (backup section, lines 929-2359) must have an equivalent in the Android implementation. If something exists in the web and isn't mentioned here, it still needs to be implemented.
- **Confirmation dialogs:** Use `AlertDialog` with CWOC theming (`CwocDialogDefaults`). Destructive actions use red/danger button colors.
- **Error handling:** All API calls wrapped in try/catch. Errors displayed as inline feedback in the modal (matching web's `_backupFeedback()` pattern). Network errors show "Network error {operation}."

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["2.1", "2.4"] },
    { "id": 3, "tasks": ["2.2", "2.3"] },
    { "id": 4, "tasks": ["3.1", "3.2", "3.3"] },
    { "id": 5, "tasks": ["4.1", "4.2", "4.3", "4.4", "4.5", "4.6"] },
    { "id": 6, "tasks": ["4.7", "4.8", "4.9", "4.10", "4.11", "4.12", "4.13"] },
    { "id": 7, "tasks": ["5.1", "5.2"] }
  ]
}
```
