# Requirements Document

## Introduction

CWOC stores all user data (chits, contacts, settings, email metadata, attachments, encryption keys) in a single SQLite database and associated files on disk. Currently there is no built-in backup mechanism — data protection depends entirely on the server operator manually configuring external tools. This feature integrates restic as a fully GUI-managed backup system, controlled entirely from the Settings page (Admin tab, under Dependent Apps), with zero command-line interaction needed after initial setup.

Restic is a fast, encrypted, deduplicated backup program that supports multiple storage backends (local, SFTP, S3, B2, Azure, GCS, REST server, rclone). The CWOC integration wraps restic commands via Python `subprocess`, provides a scheduling system using Python asyncio (matching the existing weather scheduler pattern), and exposes all configuration and operations through the Settings UI. The configurator script handles binary installation (same non-fatal pattern as ntfy/tailscale).

## Glossary

- **Backup_Manager**: The Python module (`src/backend/routes/backup.py`) responsible for orchestrating all restic operations, scheduling, and configuration management.
- **Restic_Binary**: The restic executable installed at `/usr/bin/restic` by the Configurator.
- **Backup_Repository**: The restic repository where encrypted backup snapshots are stored. Identified by a repository URL/path and protected by a repository password.
- **Repository_Password**: The encryption passphrase for the Backup_Repository. Stored encrypted in the database using the existing Fernet key (`/app/data/email.key`).
- **Backup_Scheduler**: The Python asyncio background task that triggers automated backups at configured intervals (matching the weather scheduler pattern in `schedulers.py`).
- **Snapshot**: A point-in-time backup stored in the Backup_Repository. Each snapshot contains the selected backup paths and is identified by a unique ID, timestamp, and hostname.
- **Retention_Policy**: The set of rules (keep-last, keep-daily, keep-weekly, keep-monthly, keep-yearly) that determine which snapshots are preserved during pruning.
- **Pre_Backup_Copy**: A consistent SQLite backup created via `sqlite3 .backup` command before each restic run, stored at `/tmp/cwoc-pre-backup.db`, ensuring the backed-up database is not corrupted by concurrent writes.
- **Backup_Config_Table**: The database table storing all backup configuration (repository type, URL, encrypted password, credentials, paths, schedule, retention policy, notification preferences).
- **Settings_UI**: The Backup section in the Settings page Admin tab under Dependent Apps, following the existing collapsible toggle-button pattern.
- **Configurator**: The server provisioning script (`install/configurinator.sh`) that installs system dependencies.
- **Ntfy_Sender**: The existing notification module used to send push notifications to admins about backup events.

## Requirements

### Requirement 1: Backup Configuration Storage

**User Story:** As an admin, I want to store all backup configuration in the database, so that the backup system can be fully managed from the Settings UI without editing config files.

#### Acceptance Criteria

1. THE Backup_Manager SHALL store configuration in a dedicated Backup_Config_Table with columns for: repository type, repository URL/path, encrypted repository password, backend-specific credentials (encrypted JSON), backup paths (JSON array), schedule frequency, schedule time, retention policy (JSON object), notification preferences (JSON object), and enabled state.
2. WHEN an admin saves backup configuration for the first time and the Backup_Repository does not yet exist, THE Backup_Manager SHALL automatically run `restic init` to initialize the repository before confirming the save.
3. THE Backup_Manager SHALL encrypt the Repository_Password and backend-specific credentials using the existing Fernet key at `/app/data/email.key` before storing them in the database.
4. THE Backup_Manager SHALL decrypt credentials at runtime when executing restic commands, passing them via environment variables to the subprocess.
5. IF `restic init` fails during first-time configuration save, THEN THE Backup_Manager SHALL return an error response with the restic error output and not persist the configuration.
6. WHEN configuration is updated after initial setup, THE Backup_Manager SHALL persist changes without re-running `restic init`.

### Requirement 2: Supported Repository Backends

**User Story:** As an admin, I want to choose from all major restic-supported storage backends, so that I can back up to whatever storage I have available.

#### Acceptance Criteria

1. THE Settings_UI SHALL provide a repository type dropdown with the following options: Local Path, SFTP, Amazon S3 / S3-Compatible, Backblaze B2, Microsoft Azure Blob Storage, Google Cloud Storage, REST Server, and rclone.
2. WHEN the admin selects a repository type, THE Settings_UI SHALL display the appropriate credential fields for that backend type (e.g., SSH key path for SFTP, access key and secret key for S3, account ID and application key for B2).
3. THE Backup_Manager SHALL construct the correct restic repository URL format for each backend type (e.g., `/path/to/repo` for local, `sftp:user@host:/path` for SFTP, `s3:endpoint/bucket` for S3).
4. THE Backup_Manager SHALL pass backend-specific credentials as environment variables to the restic subprocess (e.g., `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `B2_ACCOUNT_ID`, `B2_ACCOUNT_KEY`).

### Requirement 3: Backup Path Selection

**User Story:** As an admin, I want to select which paths to include in backups, so that I can ensure all critical data is protected while excluding unnecessary files.

#### Acceptance Criteria

1. THE Settings_UI SHALL display a checklist of backup paths organized into three priority groups: Critical (pre-checked by default), Important (pre-checked by default), and Nice to Have (unchecked by default).
2. THE Critical group SHALL include: the Pre_Backup_Copy database path (`/tmp/cwoc-pre-backup.db`), `/app/data/email.key`, `/app/data/contacts/profile_pictures/`, `/app/data/users/profile_pictures/`, `/app/data/attachments/`, and `/app/data/contacts/*.vcf`.
3. THE Important group SHALL include: `/etc/ssl/cwoc/`, `/etc/systemd/system/cwoc.service`, and `/etc/nginx/sites-available/cwoc`.
4. THE Nice to Have group SHALL include: `/app/data/client-log.txt` and `/app/data/update.log`.
5. THE Backup_Manager SHALL pass only the selected paths to the restic `backup` command via the `--files-from` flag or as positional arguments.

### Requirement 4: Pre-Backup Database Safety

**User Story:** As an admin, I want the database to be backed up in a consistent state, so that restoring from a backup produces a usable database without corruption.

#### Acceptance Criteria

1. WHEN a backup operation begins, THE Backup_Manager SHALL execute `sqlite3 /app/data/app.db ".backup /tmp/cwoc-pre-backup.db"` to create a consistent point-in-time copy of the database before invoking restic.
2. THE Backup_Manager SHALL include `/tmp/cwoc-pre-backup.db` in the restic backup paths instead of the live `/app/data/app.db` file.
3. WHEN the restic backup completes (success or failure), THE Backup_Manager SHALL delete `/tmp/cwoc-pre-backup.db` to avoid stale copies consuming disk space.
4. IF the `sqlite3 .backup` command fails, THEN THE Backup_Manager SHALL abort the backup operation, log the error, and report the failure via the notification system.

### Requirement 5: Backup Scheduling

**User Story:** As an admin, I want to schedule automatic backups at regular intervals, so that my data is protected without manual intervention.

#### Acceptance Criteria

1. THE Settings_UI SHALL provide a schedule frequency dropdown with options: Hourly, Every 6 Hours, Daily, Weekly, and Manual Only.
2. WHEN the schedule frequency is Daily or Weekly, THE Settings_UI SHALL display a time-of-day picker for the preferred backup time.
3. THE Backup_Scheduler SHALL run as a Python asyncio background task started at application startup, matching the pattern used by the weather scheduler in `schedulers.py`.
4. WHEN the scheduled time arrives, THE Backup_Scheduler SHALL trigger a full backup operation (pre-backup copy, restic backup, cleanup).
5. WHILE the backup feature is disabled (enabled = false), THE Backup_Scheduler SHALL skip all scheduled backup operations.
6. WHEN backup configuration changes, THE Backup_Scheduler SHALL recalculate the next scheduled backup time without requiring a server restart.
7. THE Backup_Manager SHALL prevent concurrent backup operations by using an asyncio lock, queuing or rejecting new requests while a backup is in progress.

### Requirement 6: Manual Backup Trigger

**User Story:** As an admin, I want to trigger an immediate backup from the Settings UI, so that I can create a snapshot before making risky changes.

#### Acceptance Criteria

1. THE Settings_UI SHALL provide a "Backup Now" button that triggers an immediate backup operation.
2. WHEN the "Backup Now" button is clicked, THE Settings_UI SHALL disable the button and display a progress indicator until the operation completes.
3. WHEN the manual backup completes, THE Settings_UI SHALL display a success or failure message with relevant details (duration, snapshot ID on success; error message on failure).
4. THE Backup_Manager SHALL expose a `POST /api/backup/run` endpoint that triggers an immediate backup, requiring admin access.
5. IF a backup is already in progress, THEN THE Backup_Manager SHALL return an error indicating a backup is already running.

### Requirement 7: Snapshot Listing

**User Story:** As an admin, I want to view all existing backup snapshots with their dates and sizes, so that I can verify backups are running and choose a snapshot to restore from.

#### Acceptance Criteria

1. THE Settings_UI SHALL provide a "List Snapshots" button that retrieves and displays all snapshots in the Backup_Repository.
2. WHEN snapshots are listed, THE Settings_UI SHALL display each snapshot's ID (short hash), timestamp, hostname, and paths included.
3. THE Backup_Manager SHALL expose a `GET /api/backup/snapshots` endpoint that runs `restic snapshots --json` and returns the parsed results, requiring admin access.
4. IF the repository is unreachable or the password is incorrect, THEN THE Backup_Manager SHALL return an error with a descriptive message.

### Requirement 8: Repository Health Check

**User Story:** As an admin, I want to verify that the backup repository is reachable and healthy, so that I can catch connectivity or corruption issues before they cause backup failures.

#### Acceptance Criteria

1. THE Settings_UI SHALL provide a "Check Status" button that verifies repository connectivity and integrity.
2. WHEN the status check is triggered, THE Backup_Manager SHALL run `restic check` against the configured repository and return the result.
3. THE Backup_Manager SHALL expose a `GET /api/backup/status` endpoint that returns repository health information, requiring admin access.
4. THE status response SHALL include: repository reachability (boolean), last check timestamp, and any error messages from restic.
5. IF no backup configuration exists, THEN THE status endpoint SHALL return a `"not_configured"` status.

### Requirement 9: Snapshot Restore

**User Story:** As an admin, I want to restore from a specific backup snapshot through the UI, so that I can recover data without using the command line.

#### Acceptance Criteria

1. THE Settings_UI SHALL provide a "Restore" button that opens a snapshot selection interface.
2. WHEN the admin selects a snapshot and confirms the restore, THE Settings_UI SHALL display a confirmation dialog warning that the restore will overwrite current data.
3. THE Backup_Manager SHALL expose a `POST /api/backup/restore` endpoint that accepts a snapshot ID and target path, requiring admin access.
4. WHEN a restore is initiated, THE Backup_Manager SHALL run `restic restore {snapshot_id} --target /` to restore files to their original locations.
5. WHEN a restore completes successfully, THE Backup_Manager SHALL notify the admin that a server restart may be required for database changes to take effect.
6. IF the restore fails, THEN THE Backup_Manager SHALL return the restic error output and not leave partially restored files in an inconsistent state.

### Requirement 10: Retention Policy and Pruning

**User Story:** As an admin, I want to configure how many snapshots to keep and prune old ones, so that backup storage does not grow unbounded.

#### Acceptance Criteria

1. THE Settings_UI SHALL provide retention policy fields: keep-last (number), keep-daily (number), keep-weekly (number), keep-monthly (number), and keep-yearly (number).
2. THE Settings_UI SHALL provide a "Prune" button that runs the forget and prune operation with the configured retention policy.
3. WHEN the "Prune" button is clicked, THE Backup_Manager SHALL run `restic forget --prune` with the configured retention flags (e.g., `--keep-last 5 --keep-daily 7 --keep-weekly 4 --keep-monthly 6 --keep-yearly 2`).
4. THE Backup_Manager SHALL expose a `POST /api/backup/prune` endpoint that executes the prune operation, requiring admin access.
5. WHEN pruning completes, THE Backup_Manager SHALL return the number of snapshots removed and the space reclaimed.
6. IF no retention policy values are configured, THEN THE Backup_Manager SHALL refuse to prune and return an error indicating retention policy must be set first.

### Requirement 11: Status Display

**User Story:** As an admin, I want to see the current backup status at a glance, so that I can quickly verify the system is working without running manual checks.

#### Acceptance Criteria

1. THE Settings_UI SHALL display the following status information in the backup section: last backup timestamp, last backup result (success or failure with error summary), next scheduled backup time, total repository size, and snapshot count.
2. THE Backup_Manager SHALL persist the last backup timestamp and result in the Backup_Config_Table after each backup operation (scheduled or manual).
3. THE Backup_Manager SHALL expose a `GET /api/backup/info` endpoint that returns the current status information, requiring admin access.
4. WHEN the backup section is expanded in the Settings UI, THE Settings_UI SHALL fetch and display the current status information.

### Requirement 12: Notification System Integration

**User Story:** As an admin, I want to receive push notifications about backup events, so that I am alerted to failures without having to check the Settings page.

#### Acceptance Criteria

1. THE Settings_UI SHALL provide notification configuration with: a picklist of admin users to notify (or "all admins" option), and separate toggles for transfer notifications (backup/restore) and maintenance notifications (prune).
2. THE Settings_UI SHALL provide a notification trigger selector with options: notify on success only, failures only, or both.
3. WHEN a backup completes, THE Backup_Manager SHALL send a notification via the existing Ntfy_Sender to the configured admin recipients, respecting the notification trigger setting.
4. WHEN a restore or prune operation completes, THE Backup_Manager SHALL send a notification to the configured admin recipients, categorized as transfer or maintenance respectively.
5. WHILE the Ntfy notification system is disabled or not configured, THE Backup_Manager SHALL skip notification sends without error.
6. THE Backup_Manager SHALL format backup notifications with the title "CWOC Backup" and body containing the operation type, result, and relevant details (e.g., "Backup completed successfully — 3 files, 42 MB" or "Backup failed: repository unreachable").

### Requirement 13: Settings UI — Backup Section Layout

**User Story:** As an admin, I want the backup configuration to follow the existing Dependent Apps UI pattern, so that it is consistent with Tailscale and Ntfy sections.

#### Acceptance Criteria

1. THE Settings_UI SHALL display a "Restic Backup" section in the Admin tab under Dependent Apps, following the existing collapsible toggle-button pattern used by Tailscale and Ntfy.
2. THE Settings_UI SHALL provide a toggle button to enable or disable the backup system.
3. THE Settings_UI SHALL provide expandable help text (hidden by default) explaining what restic is and how the backup system works.
4. WHEN the section is expanded, THE Settings_UI SHALL display the configuration form with: repository type dropdown, repository URL/path field, repository password field (masked), backend-specific credential fields (dynamic based on type), backup paths checklist, schedule frequency dropdown, time-of-day picker (conditional), and retention policy fields.
5. THE Settings_UI SHALL display action buttons: Save Config, Backup Now, List Snapshots, Check Status, Restore, and Prune.
6. THE Settings_UI SHALL display the status panel (last backup, next backup, repo size, snapshot count) above the action buttons.

### Requirement 14: Restic Command Execution

**User Story:** As a backend service, I want all restic commands executed securely via subprocess with proper credential handling, so that sensitive data is not leaked to logs or process listings.

#### Acceptance Criteria

1. THE Backup_Manager SHALL execute all restic commands via Python `subprocess.run()` with credentials passed exclusively through environment variables (e.g., `RESTIC_PASSWORD`, `AWS_ACCESS_KEY_ID`), never as command-line arguments.
2. THE Backup_Manager SHALL capture both stdout and stderr from restic commands for logging and error reporting.
3. THE Backup_Manager SHALL set a timeout on all restic subprocess calls (configurable, default 1 hour for backup/restore, 5 minutes for status/list operations).
4. IF a restic command times out, THEN THE Backup_Manager SHALL terminate the subprocess and report a timeout error.
5. THE Backup_Manager SHALL log the start and completion of each restic operation (command type, duration, exit code) without logging credential values.

### Requirement 15: Configurator — Restic Binary Installation

**User Story:** As a server operator, I want the configurator script to install the restic binary, so that the backup system is ready to use after provisioning.

#### Acceptance Criteria

1. THE Configurator SHALL download the restic binary from the official GitHub releases and install it to `/usr/bin/restic`.
2. THE Configurator SHALL detect the system architecture (amd64, arm64) and download the appropriate binary.
3. IF the restic binary is already installed at `/usr/bin/restic`, THEN THE Configurator SHALL skip the download and log that restic is already present.
4. THE Configurator SHALL verify the restic binary is executable after installation by running `restic version`.
5. IF the restic download or installation fails, THEN THE Configurator SHALL log a warning and continue without aborting provisioning (non-fatal, matching the ntfy/tailscale pattern).
6. THE Configurator SHALL install restic during both fresh install and upgrade paths.

### Requirement 16: Error Handling and Recovery

**User Story:** As an admin, I want the backup system to handle errors gracefully and provide clear feedback, so that I can diagnose and fix issues without SSH access.

#### Acceptance Criteria

1. IF the Restic_Binary is not installed on the server, THEN THE Backup_Manager SHALL return a clear error message indicating restic is not available and suggesting the configurator be re-run.
2. IF the repository password is incorrect, THEN THE Backup_Manager SHALL return a specific error message indicating authentication failure (distinct from connectivity errors).
3. IF the backup target storage is full, THEN THE Backup_Manager SHALL report the storage-full condition in the error response.
4. THE Backup_Manager SHALL store the last 10 backup operation results (timestamp, operation type, success/failure, duration, error message if any) in the database for troubleshooting history.
5. WHEN an error occurs during a scheduled backup, THE Backup_Manager SHALL send a failure notification and schedule a retry after 15 minutes (maximum 3 retries per scheduled run).

