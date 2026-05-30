- Added Tailscale network fallback for the Android app
- Added Restic backup infrastructure (download, toast events, operation buttons)

## cwoc_app-20260527_1925

Tailscale Network Fallback — the app now automatically falls back to the Tailscale IP when the primary server URL is unreachable, and vice versa. Includes an OkHttp interceptor that retries on the alternate URL, WebSocket fallback with 60s periodic primary reconnect, a "Connected via Tailscale/LAN" banner, toast notifications on transitions, lifecycle-aware reachability checks (30s polling, 2-consecutive-success threshold), and URL caching at login and from the Tailscale status endpoint.

## cwoc_app-20260527_1923

SyncEngine now logs which URL (primary or fallback/Tailscale) was used for each successful sync cycle via reportLog(), enabling remote diagnostics of network fallback behavior.

## cwoc_app-20260527_1918

Updated WebSocketClientImpl with network fallback support — tries primary URL first on connect, falls back to alternate URL on failure, adds 60s periodic primary reconnect timer while connected via fallback, resets backoff on any successful connection.

## cwoc_app-20260527_1903

Wired download and toast event observation in BackupSection — LaunchedEffects collect from `backupDownloadEvent` (opens URL via Intent.ACTION_VIEW in browser) and `backupToastEvent` (shows Toast messages for backup operation results).

## cwoc_app-20260527_1857

Added `BackupOperationButtons` composable for the backup target modal — 3-column grid with Status, Snapshots, Backup Now, Restore, Download, Manual Prune, Remove, and Remove & Delete buttons. Each shows loading spinner when its operation is in progress. Row 3 (destructive actions) only visible in edit mode with error-colored text.

## cwoc_app-20260527_1856

Added `BackupFeedbackArea` and `BackupResultsArea` composables for the backup target modal — feedback area shows colored Card (green/red/yellow/gray) with icon and message text, dismissible on tap; results area provides a scrollable Column with 300dp max height for snapshot lists and restore picker.

## cwoc_app-20260527_1854

Added `BackupRepositorySection` composable for the backup target modal — collapsible section (expanded by default) with Name field, Type dropdown (8 options with Local disabled if already exists), conditional URL/Path field, Password field with show/hide toggle, and dynamic credential fields per type (SFTP with auth method radio, S3, B2, Azure, GCS, REST, rclone).

## cwoc_app-20260527_1851

Added `BackupTargetModal` composable — full-screen Dialog with Scaffold, TopAppBar (title + Cancel/Done buttons), scrollable Column body, loading state, and create/edit mode title logic. Shell ready for form sections (tasks 4.2-4.6).

## cwoc_server-20260527_1851

Fixed drag & drop of child chits in the Projects Kanban view. Root cause: the project box had `draggable=true` wrapping the child cards (also `draggable=true`), creating a nested draggable conflict where the outer element's dragstart handler could cancel the inner card's drag. Moved `draggable` to the header only, removed the `display:none` trick during drag (which can fail in Safari), and added `draggable=false` to links/images inside note previews to prevent them from intercepting card drag.

## cwoc_app-20260527_1846

Added `BackupSection` composable to AdminSettingsTab — zone-button header with status icon, help text toggle, AnimatedVisibility collapsible body, lazy-load initialization, and status panel showing target count, last backup time, and next scheduled time.

## cwoc_app-20260527_1838

Added backup date/time formatting helpers to SettingsViewModel: `formatBackupDateTime`, `formatBackupTime`, `formatBackupRelativeTime`, and `formatBackupBytes` — matching the web's backup formatting logic exactly, with 12h/24h preference support.

## cwoc_app-20260527_1636

Fixed HTML email rendering in the Android app. Emails with HTML content now properly render in a WebView instead of showing raw HTML code. Fixed `isPreviewMode` state initialization race condition, switched WebView to base64 encoding for robust HTML loading, and added HTML-stripping fallback for the plain text view mode.

## cwoc_server-20260527_1730

Fixed tag modal UUID display — simplified the flow so the tree passes the name directly (from node.fullPath) and the tag ID separately (from node.id) to the modal. Removed the unnecessary reverse-lookup logic.

## cwoc_server-20260527_1727

Fixed tag modal showing UUID — the settings page now looks up the tag by ID and passes the actual name to the modal, instead of passing the raw tree path which could be a UUID.

## cwoc_server-20260527_1654

Fixed tag modal showing UUID instead of tag name — added guard that resolves UUIDs via the tag registry. Added "Default" / "Custom" section labels to the tag modal's background color swatches and the rule editor's color picker. All color pickers across the app now clearly delineate which colors are defaults vs custom.

## cwoc_server-20260527_1652

Removed the non-functional checkboxes from the tag tree on the settings page — the bulk-select checkboxes handle selection now, and clicking a tag row opens the edit modal directly.

## cwoc_server-20260527_1639

Tag editor bulk actions: added Select All / Select None buttons and bulk Share / Delete actions for multi-selecting tags in settings. Color picker now shows clear "Default" and "Custom" section labels with visual separation everywhere it's used (editor, contacts, bundles, settings).

## cwoc_server-20260527_1627 / cwoc_app-20260527_1627

Trimmed the default color palette back to the original 6 editor colors (Dusty Rose, Burnt Sienna, Golden Ochre, Mossy Sage, Slate Teal, Muted Lilac). Added a one-time server migration that seeds the remaining 21 colors from the various old palettes into each user's custom_colors so they remain available everywhere via the unified picker.

## cwoc_server-20260527_1614 / cwoc_app-20260527_1614

Unified color picker across all platforms. Every color picker (chit editor, contact editor, settings, email bundles, tags, rule editor, Android app) now pulls from a single shared 27-color default palette plus user custom colors. Eliminated 5 separate hardcoded palettes that were out of sync.

## cwoc_app-20260527_1606

Fixed notification deep linking — tapping a notification now navigates to the specific chit instead of just opening the app. Added `singleTop` launch mode and `onNewIntent` handling so the app correctly processes notification intents whether it's already running or cold-started.

## cwoc_server-20260527_1549

Fixed settings page always showing "unsaved changes" — added a suppression flag to prevent async DOM mutations (tag tree re-render, tag sharing load) from falsely marking the form dirty during initialization and after save.

## cwoc_server-20260527_1322

Tag ID System — Integration verification complete. All 9 backend Python files pass syntax checks, all cross-file imports are consistent, all 6 design properties verified in code (ID immutability, referential integrity, rename atomicity, migration idempotency, system tag isolation, display transparency). INDEX.md updated with new tag ID functions.

## cwoc_app-20260527_1057

Added TimelineZoomControls composable for the timeline dependency graph view — three small FABs (zoom in, zoom out, recenter) in a vertical column with parchment brown styling. Zoom adjusts by 0.25 increments (range 0.25x–3.0x), recenter resets to 1.0x and Offset.Zero.

## cwoc_app-20260527_1050

Added Home/Reset View FAB to the Map screen. Tapping it animates the map back to the user's configured default latitude, longitude, and zoom level. Positioned above the existing My Location FAB at bottom-end.

## cwoc_server-20260527_1050

Fixed mobile notes toolbar dropdown menus (H1/H2/H3 headings, block formats) appearing as unstyled buttons at the bottom of the editor page on desktop. The CSS hide rule was scoped to `body.mobile-zone-mode` only — added a base `display: none` rule so they're hidden on all viewports by default.

## cwoc_server-20260527_0917

Fixed ESC key not closing Import/Export modals on the Settings page — ESC now properly dismisses the topmost open modal. Also cleaned up the modal button layout with proper icon/title/description separation instead of crammed inline text, and added click-outside-to-close for all data management modals.

## cwoc_server-20260527_0916

Disk usage display in Settings now breaks down CWOC storage into "App" (DB, attachments, contacts) vs "Backups" so you can see how much space backups are consuming separately.

## cwoc_server-20260527_0850

Fixed tag creation via the expanded modal on the settings page — the Done button now properly creates the tag. Root causes: stale settings cache during duplicate check, and silent failure when the backend POST didn't succeed. Also wired the Add button to support Shift+Click for the expanded modal, and switched the input from deprecated `keypress` to `keydown` for better cross-browser/mobile reliability.

## cwoc_server-20260527_0551

Added copy button to checklist items (📋 icon, visible on hover / always on touch) that copies the item's text to clipboard. Also added a "Copy" button to the multi-select toolbar that copies all selected items as markdown checklist lines. Available on web, mobile web, and Android app.

## cwoc_server-20260527_0547

Fixed WebSocket sync instability causing repeated connect/disconnect cycles that prevented real-time change propagation between machines. Server-side: reduced ping interval to 25s and increased receive timeout to 65s (2× ping + pong buffer) for better tolerance of network jitter. Client-side: increased max retries from 3 to 5 with exponential backoff (2s→32s), and added periodic WebSocket upgrade attempts every 60s while in HTTP polling fallback so the connection auto-recovers after server restarts.
