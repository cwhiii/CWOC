# Design Document: Restic Backup Integration

## Overview

This feature integrates restic as a fully GUI-managed backup system for CWOC, controlled entirely from the Settings page (Admin tab, Dependent Apps section). The system wraps restic commands via Python `subprocess`, provides scheduling via Python asyncio (matching the existing weather scheduler pattern), encrypts credentials using the existing Fernet key, and exposes all configuration and operations through the Settings UI.

The design follows established CWOC patterns:
- **Scheduler**: asyncio background task started at app startup (like `start_weather_schedulers()`)
- **Credential encryption**: Fernet via `_encrypt_password` / `_decrypt_password` from `routes/email.py`
- **UI pattern**: Dependent Apps toggle-button + collapsible config body (like Tailscale/Ntfy)
- **Binary installation**: Configurator non-fatal install (like ntfy/tailscale)
- **Notifications**: Via existing `send_ntfy_notification()` from `routes/ntfy.py`

Platform: Web only (server-side feature with web settings UI).

## Architecture

```mermaid
graph TD
    subgraph "Frontend (Settings Page)"
        UI[Backup Section UI]
        UI -->|POST/GET| API
    end

    subgraph "Backend (FastAPI)"
        API["/api/backup/*" Routes]
        API --> BM[Backup Manager]
        BM --> Sched[Backup Scheduler]
        BM --> Crypto[Fernet Encrypt/Decrypt]
        BM --> Ntfy[Ntfy Notification Sender]
        BM --> Sub[subprocess.run - restic]
    end

    subgraph "External"
        Sub --> Restic[restic binary]
        Restic --> Repo[Backup Repository]
    end

    subgraph "Data"
        BM --> DB[(SQLite - backup_config table)]
        BM --> PreCopy[/tmp/cwoc-pre-backup.db]
        Restic --> Files[Backup Paths on Disk]
    end
```

The backup system is a single new route module (`src/backend/routes/backup.py`) that:
1. Manages configuration in a dedicated `backup_config` table
2. Runs an asyncio scheduler loop for automated backups
3. Executes restic commands via subprocess with credentials in environment variables
4. Sends notifications via the existing ntfy system
5. Exposes REST endpoints for all operations (backup, restore, prune, status, snapshots)

## Components and Interfaces

### Backend Components

#### 1. Route Module: `src/backend/routes/backup.py`

The primary module containing all backup logic. Registered in `main.py` like other route modules.

**API Endpoints:**

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/backup/config` | Get current backup configuration | Admin |
| POST | `/api/backup/config` | Save/update backup configuration | Admin |
| POST | `/api/backup/run` | Trigger immediate backup | Admin |
| GET | `/api/backup/snapshots` | List all snapshots | Admin |
| GET | `/api/backup/status` | Repository health check | Admin |
| GET | `/api/backup/info` | Current status info (last backup, next scheduled, etc.) | Admin |
| POST | `/api/backup/restore` | Restore from a snapshot | Admin |
| POST | `/api/backup/prune` | Run forget + prune with retention policy | Admin |

#### 2. Scheduler: `_backup_scheduler_loop()`

An asyncio background task registered in `start_weather_schedulers()` (or a new `start_backup_scheduler()` called from `on_startup()`). Follows the same pattern as `_weather_hourly_loop()`:

```python
async def _backup_scheduler_loop():
    """Background task: run scheduled backups at configured intervals."""
    await asyncio.sleep(30)  # Let server fully start
    while True:
        try:
            config = _load_backup_config()
            if config and config.get("enabled") and config.get("schedule_frequency") != "manual":
                next_run = _calculate_next_run(config)
                if next_run and datetime.utcnow() >= next_run:
                    await _run_backup(config)
        except Exception as e:
            logger.error(f"Backup scheduler error: {e}")
        await asyncio.sleep(60)  # Check every minute
```

#### 3. Restic Command Executor

A helper function that wraps all restic subprocess calls:

```python
async def _run_restic_command(args: list, config: dict, timeout: int = 3600) -> dict:
    """Execute a restic command with proper credential handling.
    
    Args:
        args: Command arguments (e.g., ["backup", "--files-from", "/tmp/backup-paths.txt"])
        config: Backup configuration dict (contains repo URL, encrypted credentials)
        timeout: Subprocess timeout in seconds (default 1 hour)
    
    Returns:
        {"success": bool, "stdout": str, "stderr": str, "exit_code": int, "duration": float}
    """
```

Credentials are passed exclusively via environment variables:
- `RESTIC_REPOSITORY` — repository URL
- `RESTIC_PASSWORD` — decrypted repository password
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` — for S3
- `B2_ACCOUNT_ID`, `B2_ACCOUNT_KEY` — for Backblaze B2
- `AZURE_ACCOUNT_NAME`, `AZURE_ACCOUNT_KEY` — for Azure
- `GOOGLE_APPLICATION_CREDENTIALS` — for GCS

#### 4. Pre-Backup Database Copy

Before each backup, creates a consistent SQLite snapshot:

```python
async def _create_pre_backup_copy() -> bool:
    """Create a consistent database copy via sqlite3 .backup command.
    Returns True on success, False on failure."""
    cmd = ['sqlite3', '/app/data/app.db', '.backup /tmp/cwoc-pre-backup.db']
    result = await asyncio.get_event_loop().run_in_executor(
        None, lambda: subprocess.run(cmd, capture_output=True, timeout=60)
    )
    return result.returncode == 0
```

### Frontend Components

#### Settings UI: Backup Section

Located in `settings.html` within the Admin tab → Dependent Apps section, after the existing Ntfy block. Follows the identical pattern:

1. **Toggle button** — `Restic Backup` with status icon (⚪/🟢/🔴)
2. **Help icon** — `?` that toggles explanatory text
3. **Collapsible config body** — shown when enabled, containing:
   - Status panel (last backup, next scheduled, repo size, snapshot count)
   - Repository type dropdown
   - Repository URL/path field
   - Repository password field (masked)
   - Dynamic backend credential fields
   - Backup paths checklist (grouped by priority)
   - Schedule frequency dropdown + time picker
   - Retention policy fields
   - Notification preferences
   - Action buttons (Save Config, Backup Now, List Snapshots, Check Status, Restore, Prune)

### Configurator Addition

New function in `install/configurinator.sh`:

```bash
install_restic() {
    log_step "Installing restic backup tool..."
    if command -v restic &>/dev/null; then
        log_ok "Restic already installed — skipping."
        return 0
    fi
    local arch=$(uname -m)
    case "$arch" in
        x86_64)  arch="amd64" ;;
        aarch64) arch="arm64" ;;
        *) log_warn "Unsupported arch for restic: $arch"; return 0 ;;
    esac
    # Download and install from GitHub releases
    # ... (non-fatal, matching ntfy/tailscale pattern)
}
```

## Data Models

### Database Table: `backup_config`

Created via migration in `migrations.py`:

```sql
CREATE TABLE IF NOT EXISTS backup_config (
    id INTEGER PRIMARY KEY DEFAULT 1,
    enabled INTEGER DEFAULT 0,
    repo_type TEXT DEFAULT 'local',
    repo_url TEXT,
    repo_password_encrypted TEXT,
    backend_credentials_encrypted TEXT,  -- JSON object, encrypted
    backup_paths TEXT,                   -- JSON array of selected paths
    schedule_frequency TEXT DEFAULT 'daily',
    schedule_time TEXT DEFAULT '02:00',
    retention_policy TEXT,               -- JSON: {keep_last, keep_daily, keep_weekly, keep_monthly, keep_yearly}
    notification_recipients TEXT,        -- JSON: {admins: ["all"|user_ids], trigger: "both"|"success"|"failure"}
    notification_transfer INTEGER DEFAULT 1,
    notification_maintenance INTEGER DEFAULT 1,
    last_backup_time TEXT,
    last_backup_result TEXT,             -- JSON: {success: bool, message: str, snapshot_id: str, duration: float}
    next_backup_time TEXT,
    last_check_time TEXT,
    backup_history TEXT,                 -- JSON array of last 10 results
    retry_count INTEGER DEFAULT 0,
    created_at TEXT,
    updated_at TEXT
);
```

### Repository Type Configuration

Each backend type maps to specific credential fields and URL format:

| Type | URL Format | Credential Fields |
|------|-----------|-------------------|
| local | `/path/to/repo` | (none) |
| sftp | `sftp:user@host:/path` | SSH key path |
| s3 | `s3:endpoint/bucket` | Access Key ID, Secret Access Key, Region |
| b2 | `b2:bucket:/path` | Account ID, Application Key |
| azure | `azure:container:/path` | Account Name, Account Key |
| gcs | `gs:bucket:/path` | Project ID, Credentials JSON path |
| rest | `rest:http://host:port/` | Username, Password (optional) |
| rclone | `rclone:remote:path` | rclone config name |

### Backup Paths Model

```json
{
  "critical": [
    {"path": "/tmp/cwoc-pre-backup.db", "label": "Database (pre-backup copy)", "default": true},
    {"path": "/app/data/email.key", "label": "Encryption key", "default": true},
    {"path": "/app/data/contacts/profile_pictures/", "label": "Contact profile pictures", "default": true},
    {"path": "/app/data/users/profile_pictures/", "label": "User profile pictures", "default": true},
    {"path": "/app/data/attachments/", "label": "Attachments", "default": true},
    {"path": "/app/data/contacts/", "label": "Contact vCards (*.vcf)", "default": true}
  ],
  "important": [
    {"path": "/etc/ssl/cwoc/", "label": "SSL certificates", "default": true},
    {"path": "/etc/systemd/system/cwoc.service", "label": "Systemd service file", "default": true},
    {"path": "/etc/nginx/sites-available/cwoc", "label": "Nginx config", "default": true}
  ],
  "nice_to_have": [
    {"path": "/app/data/client-log.txt", "label": "Client log", "default": false},
    {"path": "/app/data/update.log", "label": "Update log", "default": false}
  ]
}
```

### API Response Models

**Config Response (`GET /api/backup/config`):**
```json
{
  "enabled": true,
  "repo_type": "sftp",
  "repo_url": "sftp:user@host:/backups/cwoc",
  "backend_credentials": {"ssh_key_path": "/root/.ssh/id_rsa"},
  "backup_paths": ["/tmp/cwoc-pre-backup.db", "/app/data/email.key", "..."],
  "schedule_frequency": "daily",
  "schedule_time": "02:00",
  "retention_policy": {"keep_last": 5, "keep_daily": 7, "keep_weekly": 4, "keep_monthly": 6, "keep_yearly": 2},
  "notification_recipients": {"admins": "all", "trigger": "both"},
  "notification_transfer": true,
  "notification_maintenance": true
}
```

**Info Response (`GET /api/backup/info`):**
```json
{
  "configured": true,
  "enabled": true,
  "last_backup_time": "2025-01-15T02:00:00Z",
  "last_backup_result": {"success": true, "message": "Backup completed", "snapshot_id": "a1b2c3d4", "duration": 45.2},
  "next_backup_time": "2025-01-16T02:00:00Z",
  "repo_size": "1.2 GB",
  "snapshot_count": 12
}
```

**Snapshot Response (`GET /api/backup/snapshots`):**
```json
{
  "snapshots": [
    {"id": "a1b2c3d4", "short_id": "a1b2c3d4", "time": "2025-01-15T02:00:00Z", "hostname": "cwoc-server", "paths": ["/tmp/cwoc-pre-backup.db", "..."]}
  ]
}
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Credential encryption round-trip

*For any* valid credential string (repository password or backend credential), encrypting it with the Fernet key and then decrypting the result should produce the original string.

**Validates: Requirements 1.3**

### Property 2: Repository type determines correct credential fields

*For any* valid repository type selection, the set of credential fields displayed/required should exactly match the expected field set for that backend type (e.g., S3 requires access_key_id and secret_access_key; SFTP requires ssh_key_path).

**Validates: Requirements 2.2**

### Property 3: Repository URL construction

*For any* valid repository type and associated user inputs (host, path, bucket, etc.), the constructed restic repository URL should match the correct format pattern for that backend type.

**Validates: Requirements 2.3**

### Property 4: Backup includes only selected paths

*For any* subset of available backup paths that the admin selects, the restic backup command should include exactly those paths and no others.

**Validates: Requirements 3.5**

### Property 5: Schedule triggers backup at correct time

*For any* valid schedule configuration (frequency + time) and a current time that satisfies the schedule, the backup scheduler should trigger a backup operation.

**Validates: Requirements 5.4**

### Property 6: Schedule recalculation on config change

*For any* valid schedule configuration change, the next_backup_time should be recalculated to reflect the new schedule without requiring a restart.

**Validates: Requirements 5.6**

### Property 7: Concurrent backup mutual exclusion

*For any* two concurrent backup requests (manual or scheduled), at most one should execute at a time; the other should be rejected with an appropriate error.

**Validates: Requirements 5.7, 6.5**

### Property 8: Retention policy produces correct restic flags

*For any* valid retention policy configuration (keep_last, keep_daily, keep_weekly, keep_monthly, keep_yearly), the constructed restic forget command should include the corresponding `--keep-*` flags with correct values.

**Validates: Requirements 10.3**

### Property 9: Credentials never appear in commands or logs

*For any* restic command execution, credential values (repository password, access keys, account keys) should never appear in the command-line arguments array or in any log output — only in subprocess environment variables.

**Validates: Requirements 14.1, 14.5**

### Property 10: Backup history is bounded

*For any* sequence of backup operations, the stored history should contain at most 10 entries, and they should be the 10 most recent operations in chronological order.

**Validates: Requirements 16.4**

### Property 11: Retry logic respects maximum attempts

*For any* sequence of consecutive scheduled backup failures, the retry count should increment by 1 after each failure, a retry should be scheduled 15 minutes later, and no further retries should occur after 3 consecutive failures.

**Validates: Requirements 16.5**

### Property 12: Notification formatting contains required details

*For any* backup/restore/prune operation result (success or failure), the notification message should contain the operation type, the result status, and relevant details (duration, snapshot ID on success; error message on failure).

**Validates: Requirements 12.3, 12.4, 12.6**

## Error Handling

### Error Categories

| Category | Detection | Response | Notification |
|----------|-----------|----------|--------------|
| Restic binary missing | `shutil.which('restic')` returns None | Return error suggesting configurator re-run | No (config issue) |
| Repository unreachable | restic exit code + stderr parsing | Return specific connectivity error | Yes (if scheduled) |
| Wrong password | restic stderr contains "wrong password" | Return authentication error (distinct from connectivity) | Yes (if scheduled) |
| Storage full | restic stderr contains "no space" | Return storage-full error | Yes |
| Subprocess timeout | `subprocess.TimeoutExpired` exception | Kill process, return timeout error | Yes |
| Pre-backup copy fails | sqlite3 exit code != 0 | Abort backup, return error | Yes |
| Concurrent backup | asyncio lock already held | Return "backup already in progress" | No |
| Init failure | restic init exit code != 0 | Don't persist config, return error with stderr | No |

### Retry Strategy (Scheduled Backups Only)

```
On failure:
  1. Send failure notification
  2. Increment retry_count
  3. If retry_count < 3: schedule retry in 15 minutes
  4. If retry_count >= 3: stop retrying, wait for next scheduled run
  
On success:
  1. Reset retry_count to 0
  2. Send success notification (if configured)
```

### Error Response Format

All error responses follow a consistent structure:

```json
{
  "success": false,
  "error": "human_readable_error_type",
  "message": "Detailed error message for the admin",
  "details": "Raw restic stderr output (if applicable)"
}
```

## Testing Strategy

### Unit Tests (Example-Based)

Unit tests cover specific scenarios, edge cases, and error conditions:

- First-time save triggers `restic init`; subsequent saves do not
- Disabled state prevents scheduled backups
- Pre-backup copy is created before backup and deleted after
- Backup aborts if pre-backup copy fails
- Concurrent backup requests are rejected
- Empty retention policy prevents pruning
- Each error condition returns the correct error type and message
- Repository type dropdown shows all 8 options
- Time picker visibility toggles based on schedule frequency

### Property-Based Tests

Property-based tests verify universal properties across generated inputs. Using `hypothesis` (Python PBT library).

**Configuration:** Minimum 100 iterations per property test.

Each property test references its design document property:
- **Feature: restic-backup-integration, Property 1**: Credential encryption round-trip
- **Feature: restic-backup-integration, Property 2**: Repository type credential field mapping
- **Feature: restic-backup-integration, Property 3**: Repository URL construction
- **Feature: restic-backup-integration, Property 4**: Backup path selection filtering
- **Feature: restic-backup-integration, Property 5**: Schedule trigger correctness
- **Feature: restic-backup-integration, Property 6**: Schedule recalculation
- **Feature: restic-backup-integration, Property 7**: Concurrent backup mutual exclusion
- **Feature: restic-backup-integration, Property 8**: Retention policy flag construction
- **Feature: restic-backup-integration, Property 9**: Credential security (no leaks)
- **Feature: restic-backup-integration, Property 10**: History bounded to 10
- **Feature: restic-backup-integration, Property 11**: Retry logic max 3 attempts
- **Feature: restic-backup-integration, Property 12**: Notification content completeness

### Integration Tests

Integration tests verify the wiring between components:

- Restic subprocess receives correct environment variables for each backend type
- `sqlite3 .backup` is called before restic backup
- Ntfy notifications are sent on backup completion (when configured)
- Scheduler starts at application startup
- Admin-only endpoints reject non-admin requests

### Test Approach Notes

- **Subprocess calls are mocked** — tests do not require restic to be installed
- **Fernet encryption uses the real key** — tests verify actual encrypt/decrypt behavior
- **Scheduler tests use time mocking** — no real waiting for scheduled times
- **Notification tests mock the ntfy sender** — verify correct payloads without network calls
