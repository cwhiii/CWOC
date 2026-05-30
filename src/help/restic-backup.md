# Restic Backup

- [What Is Restic Backup?](#what-is-restic-backup)
- [Configuration](#configuration)
- [Scheduling](#scheduling)
- [Manual Backup](#manual-backup)
- [Viewing Snapshots](#viewing-snapshots)
- [Restoring from a Snapshot](#restoring-from-a-snapshot)
- [Retention Policy & Pruning](#retention-policy--pruning)
- [Notifications](#notifications)
- [Troubleshooting](#troubleshooting)


CWOC integrates [restic](https://restic.net/) as a fully GUI-managed backup system. Restic is a fast, encrypted, deduplicated backup program that protects your data — chits, contacts, settings, attachments, encryption keys — by creating point-in-time snapshots stored in a repository you control. Everything is configured and operated from [Settings → Backup](/frontend/html/settings.html#backup) with no command-line interaction required.

## What Is Restic Backup?

Restic creates encrypted, deduplicated backups of your CWOC data. Each backup produces a **snapshot** — a complete point-in-time copy of your selected files. Snapshots are stored in a **repository** that can live on local disk, a remote server (SFTP), or cloud storage (S3, Backblaze B2, Azure, Google Cloud, and more).

Key benefits:

- **Encrypted** — All data is encrypted before leaving the server. Only someone with the repository password can read your backups.
- **Deduplicated** — Only changed data is stored in each new snapshot, keeping storage usage low even with frequent backups.
- **Automated** — Schedule backups to run hourly, daily, or weekly without manual intervention.
- **Database-safe** — CWOC creates a consistent SQLite copy before each backup, so your database is never backed up mid-write.

## Configuration

Go to **[Settings → Backup](/frontend/html/settings.html#backup)** (Admin tab, under Dependent Apps). The Restic Backup section follows the same toggle-button pattern as Tailscale and Ntfy.

### Enable the Backup System

Click the **Restic Backup** toggle to enable the feature. The status icon shows:
- ⚪ Not configured
- 🟢 Healthy (last backup succeeded)
- 🔴 Error (last backup failed or repository unreachable)

### Repository Settings

- **Repository Type** — Choose where your backups are stored:
  - **Local Path** — A directory on the server (e.g., `/mnt/backups/cwoc`)
  - **SFTP** — A remote server via SSH (e.g., `user@host:/backups/cwoc`)
  - **Amazon S3 / S3-Compatible** — AWS S3 or any S3-compatible service (MinIO, Wasabi, etc.)
  - **Backblaze B2** — Backblaze B2 cloud storage
  - **Microsoft Azure Blob Storage** — Azure blob containers
  - **Google Cloud Storage** — GCS buckets
  - **REST Server** — A restic REST server
  - **rclone** — Any storage backend supported by rclone

- **Repository URL/Path** — The location of your backup repository. The format depends on the type selected (the UI shows a placeholder example for each type).

- **Repository Password** — The encryption passphrase for your repository. This password is required to read or restore from your backups. **Store it somewhere safe** — if you lose it, your backups are unrecoverable. The password is stored encrypted in the CWOC database.

- **Backend Credentials** — Additional credentials specific to your chosen backend (e.g., AWS access key and secret key for S3, account ID and application key for B2). These are also stored encrypted.

### Backup Paths

Select which files and directories to include in backups. Paths are organized into three priority groups:

- **Critical** (checked by default) — Database, encryption key, contact photos, user photos, attachments, contact vCards
- **Important** (checked by default) — SSL certificates, systemd service file, Nginx config
- **Nice to Have** (unchecked by default) — Client log, update log

The database is always backed up as a consistent pre-backup copy (not the live file), so there's no risk of corruption from concurrent writes.

### Save Configuration

Click **💾 Save Config** to persist your settings. On first save, CWOC automatically initializes the restic repository (runs `restic init`). If initialization fails (wrong credentials, unreachable storage), you'll see an error and the config won't be saved until the issue is resolved.

## Scheduling

Configure automatic backups so your data is protected without manual intervention.

- **Schedule Frequency** — Choose how often backups run:
  - **Hourly** — Every hour
  - **Every 6 Hours** — Four times per day
  - **Daily** — Once per day at your chosen time
  - **Weekly** — Once per week at your chosen time
  - **Manual Only** — No automatic backups; use the Backup Now button

- **Time of Day** — When frequency is Daily or Weekly, pick the preferred time for the backup to run (e.g., 02:00 for overnight backups when the server is idle).

The next scheduled backup time is displayed in the status panel at the top of the backup section. Schedule changes take effect immediately — no server restart needed.

If a scheduled backup fails, CWOC retries up to 3 times (15 minutes apart) before giving up and waiting for the next scheduled run.

## Manual Backup

Click the **▶️ Backup Now** button to trigger an immediate backup at any time. This is useful before making risky changes (database edits, server upgrades, etc.).

The button disables while the backup is running and shows a progress indicator. When complete, you'll see either a success message (with duration and snapshot ID) or a failure message with error details.

Only one backup can run at a time — if a scheduled backup is already in progress, the manual trigger will let you know.

## Viewing Snapshots

Click **📋 List Snapshots** to see all existing backup snapshots in your repository. Each snapshot shows:

- **ID** — Short hash identifying the snapshot
- **Timestamp** — When the backup was taken
- **Hostname** — The server that created the snapshot
- **Paths** — Which files/directories were included

Use this to verify backups are running on schedule and to choose a snapshot for restoration.

## Restoring from a Snapshot

Click **♻️ Restore** to recover data from a previous backup:

1. A snapshot list appears — select the snapshot you want to restore from
2. A confirmation dialog warns that restoring will overwrite current data
3. Confirm to begin the restore operation
4. When complete, you'll be notified that a **server restart may be required** for database changes to take effect

**Important:** Restoring overwrites files on disk with the versions from the selected snapshot. This includes the database, encryption keys, and any other backed-up files. Make sure you're restoring the right snapshot.

## Retention Policy & Pruning

Over time, your repository accumulates snapshots. The retention policy controls which snapshots are kept and which are removed during pruning.

### Retention Fields

- **Keep Last** — Always keep the N most recent snapshots (e.g., 5)
- **Keep Daily** — Keep one snapshot per day for the last N days (e.g., 7)
- **Keep Weekly** — Keep one snapshot per week for the last N weeks (e.g., 4)
- **Keep Monthly** — Keep one snapshot per month for the last N months (e.g., 6)
- **Keep Yearly** — Keep one snapshot per year for the last N years (e.g., 2)

These rules overlap — a snapshot that satisfies any rule is kept. For example, with keep-last=5 and keep-daily=7, you'll always have at least your 5 most recent snapshots plus one per day for the past week.

### Pruning

Click **🧹 Prune** to apply the retention policy. This removes snapshots that don't match any retention rule and reclaims the storage space. After pruning, you'll see how many snapshots were removed and how much space was freed.

**Note:** You must configure at least one retention value before pruning is allowed. This prevents accidentally deleting all your snapshots.

## Notifications

CWOC sends push notifications (via [Ntfy](/frontend/html/help.html#ntfy-notifications)) about backup events so you don't have to check the Settings page manually.

### Notification Settings

- **Recipients** — Choose which admin users receive backup notifications, or select "All Admins"
- **Trigger** — When to notify:
  - **Both** — Notify on success and failure
  - **Failures only** — Only notify when something goes wrong
  - **Success only** — Only notify on successful completion
- **Transfer notifications** — Toggle notifications for backup and restore operations
- **Maintenance notifications** — Toggle notifications for prune operations

Notifications include the operation type, result, and relevant details (e.g., "Backup completed successfully — 3 files, 42 MB" or "Backup failed: repository unreachable").

If Ntfy is not configured or disabled, notification sends are silently skipped — the backup system works fine without them.

## Troubleshooting

- **Status shows "restic not installed"** — The restic binary is not available on the server. Re-run the configurator script (`install/configurinator.sh`) to install it. Restic is installed automatically during provisioning but the install is non-fatal — if it failed initially, re-running the configurator will retry.

- **"Wrong password" or authentication error** — The repository password saved in CWOC doesn't match the one used to initialize the repository. Double-check the password in [Settings → Backup](/frontend/html/settings.html#backup). If you've lost the password, the repository is unrecoverable — you'll need to initialize a new one.

- **"Storage full" or "no space left"** — The backup destination has run out of disk space. Free up space on the target storage, or run **🧹 Prune** to remove old snapshots and reclaim space. Consider adjusting your retention policy to keep fewer snapshots.

- **Repository unreachable** — The backup destination can't be reached. Check network connectivity, SSH keys (for SFTP), or cloud credentials (for S3/B2/Azure/GCS). Use **🔍 Check Status** to get detailed error output.

- **Backup takes too long or times out** — Large backup paths (especially attachments) can take time on slow connections. The default timeout is 1 hour. If your backups consistently time out, consider reducing the number of paths or using a faster storage backend.

- **Scheduled backup didn't run** — Verify the backup system is enabled and the schedule isn't set to "Manual Only." Check the status panel for the next scheduled time. If the server was restarted, the scheduler resumes automatically.

- **Concurrent backup rejected** — Only one backup can run at a time. If you see "backup already in progress," wait for the current operation to finish before triggering another.

---

**See also:** [Dependent Apps](/frontend/html/help.html#dependent-apps) · [Ntfy Notifications](/frontend/html/help.html#ntfy-notifications) · [Data Management](/frontend/html/help.html#data-management) · [Settings](/frontend/html/settings.html)
