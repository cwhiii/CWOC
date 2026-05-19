# Settings — Administration Tab

**Category:** Standalone Pages
**Item #:** 38
**Code Verified:** ✅
**User Verified:** ⬜

## Functions, Buttons, Controls & Inputs

### Tab Visibility
- [ ] admin-tab-btn — hidden by default, shown only for admin users after auth check
- [ ] waitForAuth() → isAdmin() check — reveals admin tab button for admin users

### Kiosk Section
- [ ] kiosk-tag-list container — scrollable list of tags for kiosk display selection
- [ ] _gatherKioskTags() — collects selected kiosk tags for saving
- [ ] "📺 Open Kiosk →" button — _openKiosk() navigates to kiosk view

### Data Management Section

#### All Data
- [ ] "📄 Export All" button — exportAllData()
- [ ] "📥 Import All" button — importAllData()
- [ ] importAllFile (hidden file input) — accepts .json files

#### Chit Data
- [ ] "📄 Export" button — exportChitData()
- [ ] "📥 Import" button — importChitData()
- [ ] importChitFile (hidden file input) — accepts .json files

#### User Data
- [ ] "📄 Export" button — exportUserData()
- [ ] "📥 Import" button — importUserData()
- [ ] importUserFile (hidden file input) — accepts .json files

#### Calendar Import
- [ ] ics-import-owner (select) — "Import as user" dropdown
- [ ] loadIcsImportOwnerPicker() — populates user picker from API
- [ ] "📅 Import Calendar (.ics)" button — triggerIcsImport()
- [ ] icsImportFile (hidden file input) — accepts .ics files
- [ ] "✅ Import Google Tasks (.json)" button — triggerGoogleTasksImport()
- [ ] googleTasksImportFile (hidden file input) — accepts .json files
- [ ] "📝 Import Google Keep (.json)" button — triggerGoogleKeepImport()
- [ ] googleKeepImportFile (hidden file input) — accepts .json, multiple files
- [ ] "How to export →" link — showCalendarExportHelp()

#### Import Batches
- [ ] import-batches-section — shown when batches exist
- [ ] import-batches-list container — lists previous import batches
- [ ] loadImportBatches() — fetches and renders import batch history
- [ ] _deleteImportBatch(batch) — deletes a batch (sends chits to trash)

#### Data Management Functions
- [ ] exportAllData() — exports all data as JSON download
- [ ] exportChitData() — exports chit data as JSON download
- [ ] exportUserData() — exports user data as JSON download
- [ ] importAllData() — triggers file picker for all-data import
- [ ] importChitData() — triggers file picker for chit import
- [ ] importUserData() — triggers file picker for user data import
- [ ] _triggerJsonDownload(data, filename) — creates and triggers JSON file download
- [ ] _showImportModeDialog(type, fileData) — shows Add/Replace choice modal
- [ ] _showReplaceConfirmDialog(type, onConfirm) — shows replace confirmation
- [ ] _doImport(type, mode, fileData) — performs the actual import API call
- [ ] triggerIcsImport() — handles .ics file selection and upload
- [ ] triggerGoogleTasksImport() — handles Google Tasks JSON import
- [ ] triggerGoogleKeepImport() — handles Google Keep JSON import
- [ ] _sendKeepImport(notes, btn, originalText) — sends Keep notes to API

### Import Mode Modal
- [ ] import-mode-modal — modal for choosing Add/Replace
- [ ] import-mode-add-btn — "➕ Add to existing data"
- [ ] import-mode-replace-btn — "🔄 Replace all data"
- [ ] import-mode-cancel-btn — "Cancel"

### Replace Confirmation Modal
- [ ] replace-confirm-modal — confirmation dialog for replace operations
- [ ] replace-confirm-btn — "🔄 Replace" button
- [ ] replace-cancel-btn — "Cancel" button

### Calendar Export Help Modal
- [ ] calendar-export-help-modal — help modal with platform-specific instructions
- [ ] showCalendarExportHelp() — opens the modal
- [ ] closeCalendarExportHelp() — closes the modal
- [ ] switchCalExportTab(tab) — switches between Google/Apple/Outlook tabs
- [ ] cal-export-tabs (3 buttons: Google, Apple, Outlook)

### Audit Log Section
- [ ] "📋 Audit Log →" button — navigates to audit-log.html
- [ ] "🗑️ Trash →" button — navigates to trash.html
- [ ] "🧩 Custom Objects →" button — navigates to custom-objects-editor.html
- [ ] audit-prune-enabled (checkbox) — Enable Pruning (onchange: toggleAuditPruneInputs)
- [ ] audit-max-days (number input) — Max Age in days
- [ ] audit-max-mb (number input) — Max Size in MB
- [ ] toggleAuditPruneInputs() — enables/disables prune inputs based on checkbox

### Attachment Limits Section
- [ ] attachmentMaxSizeMb (select) — Max File Size (5/10/25/50 MB)
- [ ] attachmentMaxStorageMb (select) — Max Storage Per User (100MB–5GB/Unlimited)

### Dependent Apps Section (Network Access)

#### Tailscale
- [ ] tailscale-enable-btn — "Tailscale" toggle button (expands/collapses config)
- [ ] toggleTailscaleEnabled() — toggles Tailscale section visibility
- [ ] tailscale-header-icon — status indicator (⚪/🟢/🔴)
- [ ] tailscale-help (collapsible) — setup instructions
- [ ] tailscale-enabled (hidden checkbox) — stores enabled state
- [ ] tailscale-status-badge — status text display
- [ ] tailscale-refresh-btn — "🔄 Check Status" button
- [ ] refreshTailscaleStatus() — checks Tailscale connection status
- [ ] tailscale-ip — displays Tailscale IP
- [ ] tailscale-hostname — displays Tailscale hostname
- [ ] tailscale-auth-key (password input) — Auth Key field
- [ ] tailscale-key-toggle — "👁️" show/hide key button
- [ ] toggleAuthKeyVisibility() — toggles password visibility
- [ ] "🔑 Get Key" link — opens Tailscale admin console
- [ ] tailscale-save-btn — "💾 Save Config" button
- [ ] saveTailscaleConfig() — saves Tailscale configuration
- [ ] tailscale-up-btn — "▶️ Connect" button
- [ ] tailscaleUp() — connects Tailscale
- [ ] tailscale-down-btn — "⏹️ Disconnect" button
- [ ] tailscaleDown() — disconnects Tailscale
- [ ] "📱 Open App" button — openTailscaleApp()
- [ ] _tsFeedback(message, type) — shows inline feedback message
- [ ] _tsUpdateHeaderIcon(status) — updates header status icon
- [ ] _tsQuickStatusForIcon() — quick status check for icon
- [ ] _tsApplyEnabledState() — applies enabled/disabled visual state
- [ ] _tsUpdateSaveButton() — enables/disables save button
- [ ] _tsUpdateConnectionButtons(status) — enables/disables connect/disconnect
- [ ] loadTailscaleConfig() — loads saved Tailscale config from API

#### Ntfy Push Notifications
- [ ] ntfy-enable-btn — "Ntfy" toggle button (expands/collapses config)
- [ ] toggleNtfySection() — toggles Ntfy section visibility
- [ ] ntfy-header-icon — status indicator (⚪/🟢/🔴)
- [ ] ntfy-help (collapsible) — setup instructions
- [ ] ntfy-status-badge — status text display
- [ ] ntfy-refresh-btn — "🔄 Check Status" button
- [ ] checkNtfyStatus() — checks Ntfy service status
- [ ] ntfy-server-url-local — displays local server URL
- [ ] ntfy-server-url-ts — displays Tailscale server URL (when active)
- [ ] ntfy-topic-display — displays topic name
- [ ] Copy buttons (📋) for server URLs and topic — copyNtfyField(elementId, btn)
- [ ] ntfy-test-btn — "🔔 Test" button
- [ ] testNtfyNotification() — sends test notification
- [ ] "📱 Open App" button — openNtfyApp()
- [ ] ntfy-disable-btn — "⏹️ Disable" button
- [ ] disableNtfyService() — disables Ntfy service
- [ ] enableNtfyService() — enables Ntfy service
- [ ] _ntfyFeedback(message, type) — shows inline feedback
- [ ] _ntfyUpdateHeaderIcon(status) — updates header icon
- [ ] _ntfyQuickStatusForIcon() — quick status check
- [ ] _ntfyUpdateDisableButton(isEnabled) — updates disable button state
- [ ] displayNtfyTopic() — displays topic in UI
- [ ] displayNtfyServerUrl() — displays server URLs
- [ ] loadNtfyConfig() — loads Ntfy configuration

#### Home Assistant
- [ ] ha-enable-btn — "Home Assistant" toggle button
- [ ] _haToggleSection() — toggles HA section visibility
- [ ] ha-header-icon — status indicator
- [ ] ha-help (collapsible) — setup instructions
- [ ] ha-base-url (text input) — HA Base URL
- [ ] ha-access-token (password input) — Long-Lived Access Token
- [ ] "👁️" button — _haToggleTokenVisibility()
- [ ] ha-poll-interval (number input) — Poll Interval in seconds (5–3600)
- [ ] "🔌 Test Connection" button — _haTestConnection()
- [ ] "💾 Save HA Config" button — _haSaveConfig()
- [ ] ha-connection-status — connection test result display
- [ ] ha-webhook-url (readonly text input) — Webhook URL display
- [ ] "📋 Copy" button — _haCopyWebhookUrl()
- [ ] "🔄 Regenerate Webhook Secret" button — _haRegenerateWebhookSecret()
- [ ] _haLoadConfig() — loads HA configuration from API
- [ ] _haUpdateHeaderIcon(status) — updates header icon
- [ ] _initHASettings() — initializes HA settings on page load

### Version & Updates Section
- [ ] version-display — shows current version string
- [ ] version-date — shows last update date
- [ ] disk-usage-display — shows disk usage
- [ ] cwoc-storage-display — shows CWOC data size
- [ ] disk-refresh-btn — "🔄" refresh disk usage button
- [ ] refreshDiskUsage() — fetches and displays disk usage
- [ ] loadVersionInfo() — fetches and displays version info
- [ ] upgrade-btn — "⬆️ Upgrade" button
- [ ] startUpgrade() — initiates upgrade process
- [ ] upgrade-reopen-btn — "🔄 Upgrade in progress" (shown during upgrade)
- [ ] update-log-btn — "📄 Show Log" button
- [ ] loadLastLog() — loads and displays last upgrade log
- [ ] release-notes-btn — "📋 Release Notes" button
- [ ] showReleaseNotes() — opens release notes modal
- [ ] restart-btn — "🔁 Restart CWOC" button (hidden by default)
- [ ] restartCwoc() — restarts the CWOC service

### Update Modal
- [ ] update-modal — modal for showing upgrade progress
- [ ] update-log (pre element) — terminal-style log output
- [ ] update-start-btn — "▶️ Start" button
- [ ] runUpgrade() — runs the upgrade process
- [ ] update-close-btn — "Close" button
- [ ] _closeUpdateModal() — closes the update modal
- [ ] update-copy-btn — "📋 Copy" button
- [ ] copyUpdateLog() — copies log to clipboard

### Release Notes Modal
- [ ] release-notes-modal — modal for viewing release notes
- [ ] release-notes-date — displays current note date
- [ ] release-notes-content — rendered markdown content
- [ ] release-notes-prev — "◀ Older" button
- [ ] releaseNotesPrev() — navigates to older notes
- [ ] release-notes-next — "Newer ▶" button
- [ ] releaseNotesNext() — navigates to newer notes
- [ ] release-notes-counter — page counter display
- [ ] closeReleaseNotesModal() — closes the modal

### Session & Login (Admin)
- [ ] session-lifetime-select (select) — Session lifetime setting
- [ ] login-message-input (textarea) — Login page message (markdown)
- [ ] login-message-preview — live markdown preview
- [ ] instance-name-input (text input) — Instance name
- [ ] _loadLoginMessage() — loads current login message from API
- [ ] _saveLoginMessage() — saves login message via API

### PWA Install Section
- [ ] _initPwaInstallSection() — initializes PWA install UI
- [ ] _openInChromeForInstall() — opens page in Chrome for PWA install
- [ ] _downloadSslCert() — downloads SSL certificate for local trust
- [ ] _testNtfyFromInstallSection() — tests Ntfy from install section
