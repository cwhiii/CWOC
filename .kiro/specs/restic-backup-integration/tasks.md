# Implementation Plan: Restic Backup Integration

## Overview

Implement a fully GUI-managed restic backup system for CWOC, controlled from the Settings page (Admin tab, Dependent Apps). The implementation adds a new backend route module (`src/backend/routes/backup.py`), a database migration for the `backup_config` table, an asyncio scheduler for automated backups, and a Settings UI section following the existing Tailscale/Ntfy pattern. All restic commands are executed via subprocess with credentials in environment variables, and the existing Fernet encryption and ntfy notification systems are reused.

## Tasks

- [x] 1. Database migration and core data layer
  - [x] 1.1 Add `backup_config` table migration in `migrations.py`
    - Add `migrate_backup_config()` function that creates the `backup_config` table with all columns: id, enabled, repo_type, repo_url, repo_password_encrypted, backend_credentials_encrypted, backup_paths, schedule_frequency, schedule_time, retention_policy, notification_recipients, notification_transfer, notification_maintenance, last_backup_time, last_backup_result, next_backup_time, last_check_time, backup_history, retry_count, created_at, updated_at
    - Use `CREATE TABLE IF NOT EXISTS` pattern matching existing migrations
    - Call the migration function from the startup migration sequence in `main.py`
    - _Requirements: 1.1_

- [x] 2. Backend route module — configuration and credential handling
  - [x] 2.1 Create `src/backend/routes/backup.py` with module structure and helpers
    - Create the route module with FastAPI `APIRouter` (prefix `/api/backup`)
    - Implement `_encrypt_credential(value)` and `_decrypt_credential(value)` using the existing Fernet key at `/app/data/email.key` (reuse pattern from `routes/email.py`)
    - Implement `_load_backup_config()` helper that reads from `backup_config` table and decrypts credentials
    - Implement `_save_backup_config(config)` helper that encrypts credentials and persists to database
    - Implement `_build_repo_url(config)` that constructs the correct restic repository URL format for each backend type
    - Implement `_get_credential_env_vars(config)` that maps backend type to the correct environment variables (RESTIC_PASSWORD, AWS_ACCESS_KEY_ID, etc.)
    - _Requirements: 1.1, 1.3, 1.4, 2.3, 2.4_

  - [x] 2.2 Implement restic command executor `_run_restic_command()`
    - Async function that wraps `subprocess.run()` via `run_in_executor`
    - Pass credentials exclusively via environment variables (never as CLI args)
    - Capture stdout and stderr
    - Apply configurable timeout (default 3600s for backup/restore, 300s for status/list)
    - Return dict with success, stdout, stderr, exit_code, duration
    - Handle `subprocess.TimeoutExpired` by killing the process and returning timeout error
    - Log start/completion of each operation (command type, duration, exit code) without logging credential values
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

  - [x] 2.3 Implement `GET /api/backup/config` and `POST /api/backup/config` endpoints
    - GET returns current config (with passwords masked in response)
    - POST saves/updates config; on first save when repo doesn't exist, run `restic init`
    - If `restic init` fails, return error with restic output and don't persist config
    - On subsequent saves, persist without re-running init
    - Both endpoints require admin access
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.6_

  - [x] 2.4 Implement pre-backup database copy `_create_pre_backup_copy()`
    - Execute `sqlite3 /app/data/app.db ".backup /tmp/cwoc-pre-backup.db"` via subprocess
    - Return success/failure boolean
    - On failure, abort backup and report error
    - _Requirements: 4.1, 4.4_

  - [x] 2.5 Implement `_run_backup(config)` core backup orchestration
    - Create pre-backup database copy
    - Build file list from selected paths in config
    - Execute `restic backup` with selected paths
    - Delete `/tmp/cwoc-pre-backup.db` after completion (success or failure)
    - Use asyncio lock to prevent concurrent backups
    - Update last_backup_time, last_backup_result, and backup_history in database
    - Maintain bounded history (max 10 entries, most recent)
    - Send notification via ntfy on completion (respecting notification preferences)
    - _Requirements: 3.5, 4.1, 4.2, 4.3, 4.4, 5.7, 11.2, 12.3, 16.4_

  - [x] 2.6 Implement `POST /api/backup/run` endpoint (manual backup trigger)
    - Trigger immediate backup via `_run_backup()`
    - Return error if backup already in progress (lock held)
    - Require admin access
    - _Requirements: 6.1, 6.4, 6.5_

  - [x] 2.7 Implement `GET /api/backup/snapshots` endpoint
    - Run `restic snapshots --json` and parse results
    - Return snapshot list with id, short_id, time, hostname, paths
    - Return error with descriptive message if repo unreachable or password incorrect
    - Require admin access
    - _Requirements: 7.2, 7.3, 7.4_

  - [x] 2.8 Implement `GET /api/backup/status` endpoint (repository health check)
    - Run `restic check` against configured repository
    - Return reachability, last check timestamp, and any error messages
    - Return `"not_configured"` status if no backup config exists
    - Require admin access
    - _Requirements: 8.2, 8.3, 8.4, 8.5_

  - [x] 2.9 Implement `GET /api/backup/info` endpoint (status display)
    - Return current status: configured, enabled, last_backup_time, last_backup_result, next_backup_time, repo_size, snapshot_count
    - Require admin access
    - _Requirements: 11.1, 11.2, 11.3_

  - [x] 2.10 Implement `POST /api/backup/restore` endpoint
    - Accept snapshot_id and target path
    - Run `restic restore {snapshot_id} --target /`
    - Notify admin that server restart may be required
    - Return error with restic output on failure
    - Require admin access
    - _Requirements: 9.3, 9.4, 9.5, 9.6_

  - [x] 2.11 Implement `POST /api/backup/prune` endpoint
    - Run `restic forget --prune` with configured retention flags (--keep-last, --keep-daily, --keep-weekly, --keep-monthly, --keep-yearly)
    - Refuse to prune if no retention policy values are configured
    - Return number of snapshots removed and space reclaimed
    - Require admin access
    - _Requirements: 10.3, 10.4, 10.5, 10.6_

- [x] 3. Checkpoint — Backend routes complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Backup scheduler
  - [x] 4.1 Implement `_backup_scheduler_loop()` asyncio background task
    - Follow the pattern from `schedulers.py` (like `_weather_hourly_loop`)
    - Sleep 30s on startup to let server fully start
    - Check every 60 seconds if a scheduled backup is due
    - Skip if backup is disabled or schedule is "manual"
    - Implement `_calculate_next_run(config)` for hourly, every_6_hours, daily, weekly frequencies
    - Recalculate next_backup_time when config changes (no restart required)
    - _Requirements: 5.1, 5.3, 5.4, 5.5, 5.6_

  - [x] 4.2 Implement retry logic for scheduled backup failures
    - On failure: send notification, increment retry_count, schedule retry in 15 minutes
    - Stop retrying after 3 consecutive failures; wait for next scheduled run
    - On success: reset retry_count to 0
    - _Requirements: 16.5_

  - [x] 4.3 Register backup scheduler in application startup
    - Add `start_backup_scheduler()` function called from `on_startup()` in `main.py`
    - Register the backup route module in `main.py` (like other route modules)
    - _Requirements: 5.3_

- [x] 5. Error handling and edge cases
  - [x] 5.1 Implement error detection and categorization
    - Check for restic binary with `shutil.which('restic')` — return clear error if missing
    - Parse restic stderr for "wrong password" → return authentication error (distinct from connectivity)
    - Parse restic stderr for "no space" → return storage-full error
    - Handle subprocess timeout → kill process, return timeout error
    - Handle concurrent backup rejection → return "backup already in progress"
    - Handle init failure → don't persist config, return error with stderr
    - _Requirements: 16.1, 16.2, 16.3, 16.5_

  - [x] 5.2 Implement notification integration
    - Import and use existing `send_ntfy_notification()` from `routes/ntfy.py`
    - Format notifications with title "CWOC Backup" and body containing operation type, result, and details
    - Respect notification preferences: notify on success only, failures only, or both
    - Categorize notifications as transfer (backup/restore) or maintenance (prune)
    - Skip notification sends without error if ntfy is disabled/not configured
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

- [x] 6. Checkpoint — Backend fully complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Settings UI — Backup section
  - [x] 7.1 Add Restic Backup section to `settings.html` (Admin tab, Dependent Apps)
    - Add toggle button following Tailscale/Ntfy pattern with status icon (⚪/🟢/🔴)
    - Add help icon `?` that toggles explanatory text about restic and the backup system
    - Add collapsible config body shown when enabled
    - Add status panel: last backup timestamp, last backup result, next scheduled time, repo size, snapshot count
    - _Requirements: 13.1, 13.2, 13.3, 13.6, 11.1, 11.4_

  - [x] 7.2 Add configuration form fields to backup section
    - Repository type dropdown (Local Path, SFTP, S3, B2, Azure, GCS, REST Server, rclone)
    - Repository URL/path field
    - Repository password field (masked)
    - Dynamic backend-specific credential fields that change based on selected type
    - Backup paths checklist grouped by priority (Critical, Important, Nice to Have) with appropriate defaults
    - Schedule frequency dropdown (Hourly, Every 6 Hours, Daily, Weekly, Manual Only)
    - Time-of-day picker (shown only for Daily/Weekly)
    - Retention policy fields (keep-last, keep-daily, keep-weekly, keep-monthly, keep-yearly)
    - Notification preferences (admin picklist, trigger selector: success/failures/both, transfer/maintenance toggles)
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3, 3.4, 5.1, 5.2, 10.1, 12.1, 12.2, 13.4_

  - [x] 7.3 Add action buttons and their handlers
    - Save Config button — calls `POST /api/backup/config`
    - Backup Now button — calls `POST /api/backup/run`, disables during operation, shows progress indicator, displays success/failure with details
    - List Snapshots button — calls `GET /api/backup/snapshots`, displays snapshot table (ID, timestamp, hostname, paths)
    - Check Status button — calls `GET /api/backup/status`, displays health result
    - Restore button — opens snapshot selection, shows confirmation dialog warning about overwrite, calls `POST /api/backup/restore`
    - Prune button — calls `POST /api/backup/prune`, displays results (snapshots removed, space reclaimed)
    - _Requirements: 6.1, 6.2, 6.3, 7.1, 7.2, 8.1, 9.1, 9.2, 10.2, 13.5_

  - [x] 7.4 Add deep-link hash for backup section in settings
    - Add `#backup` or `#restic-backup` hash to the settings deep-linking system (tabMap/headingMap in settings.js)
    - Ensure the section is reachable via direct URL
    - _Requirements: 13.1_

- [x] 8. Checkpoint — UI complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Configurator script update
  - [x] 9.1 Add `install_restic()` function to `install/configurinator.sh`
    - Follow the exact pattern of `install_ntfy()` (non-fatal, architecture detection, skip if already installed)
    - Download restic binary from official GitHub releases for detected architecture (amd64, arm64)
    - Install to `/usr/bin/restic`
    - Verify installation by running `restic version`
    - Log warning and continue if download/install fails (non-fatal)
    - Call `install_restic` from both fresh install and upgrade paths
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6_

- [x] 10. Documentation and wiring
  - [x] 10.1 Update help documentation
    - Create or update help file in `src/help/` covering the backup system: what it does, how to configure, how to trigger manual backups, how to restore, retention policy explanation
    - Include deep-links to Settings → Backup section
    - _Requirements: 13.3_

  - [x] 10.2 Update `src/INDEX.md` with new backup module
    - Add all new functions, routes, and endpoints from `routes/backup.py`
    - Add the `install_restic()` function entry for the configurator
    - Add the backup_config table to the database section
    - _Requirements: (project convention)_

- [x] 11. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- The design uses Python throughout — no language selection needed
- Subprocess calls to restic should be mocked in any tests (restic binary not required for testing)
- The Fernet encryption reuses the existing key at `/app/data/email.key` and the pattern from `routes/email.py`
- The scheduler follows the exact pattern from `schedulers.py` (`_weather_hourly_loop`)
- The UI follows the existing Dependent Apps toggle-button + collapsible body pattern (Tailscale/Ntfy)
- The configurator follows the non-fatal install pattern (ntfy/tailscale)
- Per project rules: no software installation steps, no pip/npm, no running the server

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "2.4"] },
    { "id": 3, "tasks": ["2.3", "2.5"] },
    { "id": 4, "tasks": ["2.6", "2.7", "2.8", "2.9", "2.10", "2.11"] },
    { "id": 5, "tasks": ["4.1", "5.1", "5.2"] },
    { "id": 6, "tasks": ["4.2", "4.3"] },
    { "id": 7, "tasks": ["7.1", "9.1"] },
    { "id": 8, "tasks": ["7.2"] },
    { "id": 9, "tasks": ["7.3", "7.4"] },
    { "id": 10, "tasks": ["10.1", "10.2"] }
  ]
}
```
