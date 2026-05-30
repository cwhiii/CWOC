# Requirements: Android App — Restic Backup Integration

## Introduction

The CWOC web/mobile frontend already has a fully functional Restic Backup management UI in the Settings page (Admin tab → Dependent Apps → Restic Backup). This feature provides a complete GUI for managing multiple backup targets, triggering backups, viewing snapshots, restoring, pruning, and monitoring status — all via the existing `/api/backup/*` server endpoints.

The Android app currently has NO implementation of this feature (only a text reference mentioning "Restic Backup below" in the Admin settings tab). This spec implements the Restic Backup section in the Android app **exactly matching the web/mobile implementation** — same functionality, same operations, same UI flow — adapted only where the Android platform requires it (Jetpack Compose instead of HTML/JS, Material 3 theming instead of parchment CSS).

**Platform scope:** App only (Android).

**Key principle:** The Android app is a CLIENT. It does NOT run restic. It calls the same server API endpoints (`/api/backup/*`) that the web UI calls. All backup logic (encryption, scheduling, subprocess execution) lives on the server. The app just provides the management UI.

## Glossary

- **BackupTarget**: A single backup destination configuration (repo type, URL, credentials, schedule, retention). The server supports multiple targets.
- **BackupTargetModal**: The full-screen detail view for creating or editing a backup target (equivalent to the web's `#backup-target-modal`).
- **BackupSection**: The collapsible section in the Admin settings tab under Dependent Apps (equivalent to the web's Restic Backup toggle + body).
- **SettingsViewModel**: The existing Android ViewModel that manages settings state and API calls.

## Requirements

### Requirement 1: Backup Section in Admin Settings Tab

**User Story:** As an admin using the Android app, I want to see and manage the Restic Backup section in Settings → Admin → Dependent Apps, matching the web UI exactly.

#### Acceptance Criteria

1. THE BackupSection SHALL appear in the Admin settings tab under Dependent Apps, after the Home Assistant section, following the same collapsible toggle-button pattern used by Tailscale, Ntfy, and Home Assistant sections.
2. THE BackupSection header SHALL be a zone-button labeled "Restic Backup" with a status icon (⚪ not configured, 🟡 configured but no successful backup, 🟢 active and working, 🔴 last backup failed) — matching the web's `_backupUpdateHeaderIcon()` logic exactly.
3. THE BackupSection header SHALL include a help icon (❓) that toggles explanatory text about restic and the backup system — matching the web's `#backup-help` content.
4. WHEN the section is expanded, THE BackupSection SHALL display an aggregate status panel showing: target count, last backup time (formatted per user's time format preference), and next scheduled time — matching the web's `#backup-status-panel`.
5. WHEN the section is expanded, THE BackupSection SHALL load targets from `GET /api/backup/targets` and render the target list — matching the web's `_renderBackupTargetList()`.
6. THE BackupSection SHALL display action buttons: "➕ Add Target" and "▶️ Backup All Now" — matching the web's layout.
7. THE "▶️ Backup All Now" button SHALL call `POST /api/backup/run` (no target_id) to run all enabled targets, showing a loading state during the operation.
8. THE BackupSection SHALL also detect and display orphaned local repos (from the `orphans` array in the targets response) with a "💀 Delete" button — matching the web's orphan rendering.
9. THE status icon logic SHALL include the "local_only" state (half-green/half-yellow gradient) when all targets are local type — matching the web's `_backupUpdateHeaderIcon('local_only')`.

### Requirement 2: Backup Target List

**User Story:** As an admin, I want to see all configured backup targets in a list with their status, so I can quickly assess backup health and tap to edit.

#### Acceptance Criteria

1. EACH target in the list SHALL display: status icon (🟢/🔴/⚪), target name, repo type label, last backup time, and repo size (for local targets) — matching the web's `_renderBackupTargetList()` output.
2. TAPPING a target SHALL open the BackupTargetModal in edit mode for that target — matching the web's `_openBackupTargetModal(targetId)`.
3. IF no targets are configured, THE list SHALL show "No backup targets configured yet." — matching the web's empty state.
4. ORPHANED repos SHALL display with a 👻 icon, the path, size, and a "💀 Delete" button that calls `DELETE /api/backup/orphan?path=X` after confirmation — matching the web's orphan UI.

### Requirement 3: Backup Target Modal — Create Mode

**User Story:** As an admin, I want to add a new backup target with all configuration options, matching the web's add-target modal exactly.

#### Acceptance Criteria

1. TAPPING "➕ Add Target" SHALL open the BackupTargetModal with title "Add Backup Target" and all fields reset to defaults — matching the web's `_openBackupTargetModal(null)`.
2. THE modal SHALL contain the following sections (collapsible, matching the web's toggle pattern):
   - **Name** field (required, text input)
   - **Repository** section (expanded by default): Type dropdown, URL/Path field (conditional), Password field (with show/hide toggle), backend-specific credential fields (dynamic based on type)
   - **Data to Backup** section (collapsed by default): Checkbox list grouped into Critical, Important, Nice to Have — same paths and defaults as web
   - **Schedule** section (expanded by default): Frequency dropdown, Time picker (shown for Daily/Weekly only)
   - **Retention Policy** section (collapsed by default): keep-last, keep-daily, keep-weekly, keep-monthly, keep-yearly number fields with same defaults (5, 7, 4, 6, 2)
   - **Notifications** section (collapsed by default): Notify dropdown, Trigger dropdown, Transfer checkbox, Maintenance checkbox
3. THE Repository Type dropdown SHALL contain: Local, SFTP, Amazon S3 / S3-Compatible, Backblaze B2, Microsoft Azure Blob Storage, Google Cloud Storage, REST Server, rclone — matching the web's options exactly.
4. WHEN the type changes, THE modal SHALL show/hide the appropriate credential fields — matching the web's `onBackupRepoTypeChange()` logic exactly:
   - Local: hide URL row, set URL to `/app/data/backups/restic`
   - SFTP: hide URL row, show SFTP fields (user, host, port, path, auth method radio: password/SSH key)
   - Others: show URL row with type-specific label and placeholder
5. THE "Local" option SHALL be disabled if a local target already exists — matching the web's `_backupCheckLocalExists()`.
6. THE Schedule Frequency dropdown SHALL contain: Hourly, Every 6 Hours, Daily (default), Weekly, Manual Only — matching the web.
7. THE Time picker SHALL only be visible when frequency is Daily or Weekly — matching the web's `onBackupScheduleChange()`.
8. IN create mode, the "▶️ Backup Now" button SHALL be disabled with tooltip "Save this configuration first" — matching the web.
9. THE "🔌 Remove" and "💀 Remove & Delete" buttons SHALL be hidden in create mode — matching the web.

### Requirement 4: Backup Target Modal — Edit Mode

**User Story:** As an admin, I want to edit an existing backup target and perform operations on it, matching the web's edit-target modal exactly.

#### Acceptance Criteria

1. TAPPING a target in the list SHALL open the BackupTargetModal with title "Edit: {target name}" and all fields populated from `GET /api/backup/config?target_id=X` — matching the web's `_openBackupTargetModal(targetId)`.
2. PASSWORDS SHALL be displayed as masked (`••••••••`) when loaded from the server — matching the web's `_PASSWORD_MASK` behavior.
3. THE modal SHALL show all operation buttons (enabled): 🩺 Status, 📋 Snapshots, ▶️ Backup Now, ♻️ Restore, ⬇️ Download, 🗑️ Manual Prune, 🔌 Remove, 💀 Remove & Delete — matching the web's button grid.
4. THE "🔌 Remove" and "💀 Remove & Delete" buttons SHALL be visible in edit mode — matching the web.

### Requirement 5: Save Configuration

**User Story:** As an admin, I want to save backup target configuration, with the server initializing the repository on first save.

#### Acceptance Criteria

1. THE "✓ Done" button SHALL validate required fields (Name always required; Password required on new targets; Host required for SFTP; URL required for non-local/non-SFTP types) — matching the web's `_backupValidateRequired()`.
2. INVALID fields SHALL be highlighted with red border and a red asterisk (*) — matching the web's `_backupMarkFieldError()`.
3. IF validation fails, THE modal SHALL show inline feedback "Please fill in the required fields" — matching the web's `_backupFeedback()`.
4. ON save, THE modal SHALL call `POST /api/backup/config` with the gathered config — matching the web's `saveBackupConfig()`.
5. IF the server returns success, THE modal SHALL show a toast "Backup target saved" and refresh the target list — matching the web.
6. IF the server returns an error (e.g., init_failed, duplicate_repo), THE modal SHALL show inline error feedback with the server's message — matching the web.
7. THE "✗ Cancel" button SHALL close the modal without saving — matching the web's `_cancelBackupTargetModal()`.

### Requirement 6: Backup Operations

**User Story:** As an admin, I want to trigger backup operations from the target modal, matching the web's operation buttons exactly.

#### Acceptance Criteria

1. **▶️ Backup Now** SHALL call `POST /api/backup/run?target_id=X`, show loading state ("⏳ Backing up..."), and display success/failure feedback with details (snapshot ID, duration) — matching the web's `backupNow()`.
2. **🩺 Status** SHALL call `GET /api/backup/status?target_id=X` and display inline feedback: "Repository is healthy and reachable. ✓" on success, or the error message on failure — matching the web's `checkBackupStatus()`.
3. **📋 Snapshots** SHALL call `GET /api/backup/snapshots?target_id=X` and display a scrollable list of snapshots (ID, timestamp, relative time, size) with Download (⬇️) and Delete (🗑️) buttons per snapshot — matching the web's `listBackupSnapshots()`.
4. **♻️ Restore** SHALL call `GET /api/backup/snapshots?target_id=X` to show a selectable snapshot list, then on selection show a destructive confirmation dialog (matching the web's `_backupDoRestore()` warning text exactly), then call `POST /api/backup/restore` — matching the web's full restore flow.
5. **⬇️ Download** SHALL call `GET /api/backup/snapshots?target_id=X`, get the most recent snapshot, and trigger a download of `/api/backup/snapshots/{id}/download?target_id=X` — matching the web's `backupDownloadList()`. On Android, this opens the URL in the browser or uses DownloadManager.
6. **🗑️ Manual Prune** SHALL show a destructive confirmation dialog, then call `POST /api/backup/prune?target_id=X`, and display results (snapshots removed, space reclaimed) — matching the web's `backupPrune()`.
7. **🔌 Remove** SHALL show a confirmation dialog (matching the web's text about preserving data on disk and needing the password to reconnect), then call `DELETE /api/backup/config/{target_id}` — matching the web's `_removeBackupConfig()`.
8. **💀 Remove & Delete** SHALL show a destructive confirmation dialog (matching the web's warning about permanent data loss), then call `DELETE /api/backup/config/{target_id}/destroy` — matching the web's `_deleteBackupTarget()`.

### Requirement 7: Snapshot Management

**User Story:** As an admin, I want to view, download, and delete individual snapshots from the app.

#### Acceptance Criteria

1. THE snapshot list SHALL display each snapshot with: short ID (monospace, bold), relative time ("2h ago"), formatted timestamp, and size — matching the web's snapshot rendering.
2. THE Download button (⬇️) per snapshot SHALL trigger download of `/api/backup/snapshots/{id}/download?target_id=X` — matching the web's `_backupDownloadSnapshot()`.
3. THE Delete button (🗑️) per snapshot SHALL show a destructive confirmation ("Permanently delete snapshot {id}? This cannot be undone."), then call `DELETE /api/backup/snapshots/{id}?target_id=X`, then refresh the list — matching the web's `_backupDeleteSnapshot()`.

### Requirement 8: Inline Feedback

**User Story:** As an admin, I want to see operation results inline in the modal, matching the web's feedback pattern.

#### Acceptance Criteria

1. THE modal SHALL have an inline feedback area that displays messages with colored backgrounds: success (green), error (red), warning (yellow), info (neutral) — matching the web's `_backupFeedback()` color scheme.
2. THE feedback area SHALL be dismissible by tapping — matching the web's `onclick="this.style.display='none'"`.
3. OPERATION results (snapshots list, restore snapshot picker) SHALL display in a scrollable results area below the feedback — matching the web's `#backup-results`.

### Requirement 9: Date/Time Formatting

**User Story:** As an admin, I want all backup timestamps formatted according to my time format preference (12h/24h).

#### Acceptance Criteria

1. ALL timestamps in the backup section SHALL respect the user's time format setting (12-hour or 24-hour) — matching the web's `_backupFmtDateTime()` and `_backupFmtTime()`.
2. THE schedule time picker SHALL display in the user's preferred format — matching the web's `_backupFormatScheduleTime()`.
3. RELATIVE times ("2h ago", "3d ago") SHALL be computed the same way as the web's `_backupRelativeTime()`.

### Requirement 10: API Integration

**User Story:** As a developer, I want the Android app to call all backup API endpoints correctly.

#### Acceptance Criteria

1. THE app SHALL call the following endpoints (all require admin auth, handled by existing AuthInterceptor):
   - `GET /api/backup/targets` — list all targets + orphans
   - `GET /api/backup/config?target_id=X` — get single target config (masked passwords)
   - `POST /api/backup/config` — create/update target
   - `DELETE /api/backup/config/{target_id}` — remove config only
   - `DELETE /api/backup/config/{target_id}/destroy` — remove config + delete data
   - `DELETE /api/backup/orphan?path=X` — delete orphaned repo
   - `POST /api/backup/run` — trigger backup (all enabled) or `POST /api/backup/run?target_id=X` (single)
   - `GET /api/backup/snapshots?target_id=X` — list snapshots
   - `GET /api/backup/snapshots/{id}/download?target_id=X` — download snapshot archive
   - `DELETE /api/backup/snapshots/{id}?target_id=X` — delete single snapshot
   - `POST /api/backup/restore` — restore from snapshot (body: snapshot_id, target, target_id)
   - `POST /api/backup/prune?target_id=X` — apply retention policy
   - `GET /api/backup/status?target_id=X` — repository health check
   - `GET /api/backup/info?target_id=X` — quick status summary
2. ALL API calls SHALL use the existing `CwocApiService` / OkHttpClient with auth interceptor — no new HTTP client.
3. ERROR responses SHALL be parsed and displayed as inline feedback — matching the web's error handling pattern.

### Requirement 11: State Management

**User Story:** As a developer, I want backup state managed cleanly in the ViewModel layer.

#### Acceptance Criteria

1. BACKUP state SHALL be managed in `SettingsViewModel` (or a dedicated `BackupViewModel` if the file is too large) using StateFlow — matching the pattern used by `ntfyState`.
2. THE state SHALL include: targets list, loading state, current modal target config, operation-in-progress flags, feedback messages, snapshot list.
3. STATE SHALL be refreshed when the section is expanded (lazy load) — matching the Ntfy section's `initialized` pattern.
