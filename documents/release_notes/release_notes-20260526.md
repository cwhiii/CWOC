- Added backup system with restic integration (local and remote targets, scheduling, restore, prune)
- Improved backup error reporting with detailed UI feedback

## cwoc_server-20260527_0625

Updated Remove button confirmation to clarify that data stays on disk and reconnecting to the same path will reuse existing data. When a local backup config is removed, the orphaned repo now appears in the target list as "👻 Orphaned Local Repo" with its path, size, and a "💀 Delete" button (with full danger confirmation). Backend scans /app/data/backups/ for restic repos not referenced by any config.

## cwoc_server-20260527_0619

Snapshots list now shows per-snapshot delete (🗑️) and download (⬇️) buttons on each row. Reorganized modal buttons: Delete All + Backup Now + Done on the last row (all same size, no spanning). Remove and Delete All are adjacent for clarity.

## cwoc_server-20260527_0617

Added "Download" button to backup modal that shows a list of all snapshots with per-snapshot download (⬇️) and delete (🗑️) buttons. Download streams a tar.gz archive of the snapshot. Delete uses `restic forget` to permanently remove a single snapshot (with confirmation). Also added backend DELETE endpoint for individual snapshots. Repository section now starts expanded by default.

## cwoc_server-20260527_0612

Backup modal UI overhaul: all buttons now in a uniform 3-column grid with fixed 38px height (all same size). Replaced "Save" + "Close" with a single "Done" button that auto-saves and closes. ESC now correctly closes confirm/prompt modals first before closing the backup modal. Renamed "Prune" to "Manual Prune". Updated retention hint to "Old snapshots are automatically pruned to this policy after each backup."

## cwoc_server-20260527_0609

Added "Log Limits" section in Settings → Data Management (below Audit Log Limits). Controls pruning for client log and update log with Max Age (days) and Max Size (MB) settings. Defaults: 30 days, 5 MB. Pruning runs automatically on each log write and when settings are saved. Same UI pattern as audit log limits (enable/disable checkbox, two numeric inputs).

## cwoc_server-20260527_0601

Backup modal improvements: all sections (Repository, Data, Schedule, Retention, Notifications) are now collapsible — all start collapsed except Schedule. Fixed show-password button not working after modal reopen (type wasn't being reset). Added auto-prune: after every successful backup, old snapshots are automatically removed based on the retention policy (no more manual prune needed for routine cleanup).

## cwoc_server-20260527_0557

Restore now shows a scrollable list of existing snapshots with timestamps and relative age — click one to restore from it. Reorganized all modal action buttons into a clean grid layout (equal-width buttons in logical rows: primary actions, info/restore, destructive actions).

## cwoc_server-20260527_0555

Split backup delete into two actions: "Remove Config" (removes configuration only, leaves repository data intact) and "Delete All" (permanently destroys configuration AND all repository data). Each has a clear warning explaining what will happen. Also added repo size display in the backup target list for local targets.

## cwoc_server-20260527_0552

Prevent duplicate backup targets pointing at the same repository. When adding a new target, the server now checks all existing targets and rejects the save if another target already uses the same repo URL.

## cwoc_server-20260527_0547

Fixed "datatype mismatch" error when saving backup targets. The backup_config table was originally created with `id INTEGER PRIMARY KEY` which rejects UUID strings. The migration now detects this and recreates the table with `TEXT PRIMARY KEY`, preserving any existing data.

## cwoc_server-20260527_0534

Fixed backup target save failing when the restic repository already exists (e.g. re-adding a previously configured local target). The code now detects "config file already exists" and reuses the existing repo instead of failing. Also renamed the repo type dropdown from "Local Path" to "Local".

## cwoc_server-20260526_2103

Improved backup error reporting: all backup operations (save, run, status check, restore, prune) now surface the actual error details from restic or the database in the UI feedback area, instead of showing generic failure messages. Also logs full error context to the browser console for debugging.

## cwoc_server-20260526_1700 / cwoc_app-20260526_1700

Added markdown format toolbar to the Checklist zone across all platforms. When editing a checklist item or typing in the "Add new item" input, a toolbar appears with buttons for Bold, Italic, Strikethrough, Link, Heading (H1/H2/H3), Bullet List, Numbered List, Blockquote, Code, and Horizontal Rule. Desktop shows an inline toolbar; mobile web shows a bottom-pinned toolbar above the keyboard; Android app shows a compact row below the editing field.

## cwoc_server-20260526_1643

Reorganized Data Management section in Settings: replaced inline export/import buttons with two separate "Export Data" and "Import Data" buttons that each open a clean modal with all options organized by category. Added reference to Restic Backup for automated backups. Updated Android app to match with new export/import dialogs.

## cwoc_server-20260526_1647 / cwoc_app-20260526_1647

Added "Upload file as list items" to the Checklist zone Data menu and "Upload file as note" to the Notes zone Data menu — on all platforms (web desktop, mobile web, Android app). Supports any text-based file; each line becomes a checklist item (with markdown/bullet/indent parsing) or note content (with append/replace choice if notes aren't empty).

## cwoc_server-20260526_1634

Added "Upload file as note" option to the Notes zone Data menu in the chit editor. Supports any text-based file (.md, .txt, .csv, .json, code files, etc.). If notes are empty, content loads directly; if notes already have content, prompts to Append (with separator) or Replace. Also available in the fullscreen notes modal and mobile toolbar.

## cwoc_app-20260526_1620

Added .ics calendar file import support to the Android app. When you open a .ics file on your phone (from email, downloads, file manager, etc.), CWOC now appears in the "Open with" chooser. Selecting it reads the file and sends it to the server for import, showing a result screen with imported/skipped counts.

## cwoc_server-20260526_1619

Fixed color swatches in the editor overflowing instead of wrapping. Added flex-wrap to both the color picker container and color rows so swatches wrap naturally at all viewport widths.

## cwoc_server-20260526_1611

Fixed prerequisite status dropdown text being invisible on chits with dark background colors. The contrast color function was setting the select text to white/cream, which became unreadable against the dropdown's white background when opened. The select now always uses dark text with a more opaque white background, independent of the parent item's color scheme.

## cwoc_server-20260526_1610

Fixed mobile web notes zone toolbar buttons not responding to taps. On iOS Safari, calling preventDefault() on touchstart suppresses the synthetic click event, so buttons appeared tappable but did nothing. Now fires actions on touchend directly with a guard to prevent double-firing on Android.

## cwoc_app-20260526_1608

Fixed checklist checkbox contrast across all zones. The editor's checklist zone (ChecklistZoneV2) was using default Material3 purple checkboxes which clashed with the parchment theme. Now uses brown (#8B5A2B) checked, saddlebrown (#8B4513) unchecked, with parchment checkmark. Also improved checkbox contrast in Tasks and Notebook screens.

## cwoc_server-20260526_1607

Added touch/mobile drag & drop support to all Settings drag areas. The Omni View Layout configurator and Clock Format grid now work on mobile browsers (previously only used HTML5 drag events which don't fire on touch devices). Also improved mobile CSS: Omni Layout modal is now scrollable and properly sized on small screens, Arrange Views grid wraps items instead of overflowing, and clock format grid uses a 2-column layout on mobile.

## cwoc_server-20260526_1601

Fixed mobile web notes zone toolbar not responding to taps. The bottom toolbar (Data, Preview, Undo, Redo, formatting) was only appearing when the keyboard was open. Now it's always visible when the notes zone is active, sitting at the bottom of the screen and repositioning above the keyboard when the textarea is focused.

## cwoc_app-20260526_1525

Fixed critical bug: Android app was storing display names instead of user UUIDs in the `assigned_to` and `shares` fields, causing assignee edit permissions to never resolve correctly. The assignee dropdown and "Share With" feature now properly store user IDs, matching the web frontend behavior. Also fixed the calendar day view's viewer-role check to use proper per-user role resolution via SharingUtils instead of a naive string check.

## cwoc_server-20260526_0828

Added deep-link hashes (#backup, #restic-backup, #restic) for the Restic Backup section in Settings. Navigating to settings.html#backup now switches to the Admin tab and scrolls to the backup section. Also fixed the heading selector to include div.setting-subheader elements so Dependent Apps sub-sections (Home Assistant, Backup) are properly scrollable via deep-links.
