# Settings — General Tab

**Category:** Standalone Pages
**Item #:** 34
**Code Verified:** ✅
**User Verified:** ⬜

## Functions, Buttons, Controls & Inputs

### Tab Navigation
- [ ] _switchSettingsTab('general') — switches to General tab, updates active button and content visibility
- [ ] _SETTINGS_TAB_KEY localStorage persistence — remembers last active tab across sessions
- [ ] Settings tab bar (5 buttons: General, Views, Collections, Email, Administration)

### Save/Cancel System (CwocSaveSystem)
- [ ] save-single-btn — disabled "Saved" indicator button (shows current save state)
- [ ] save-stay-btn — "Save & Stay" button (saves without navigating away)
- [ ] save-exit-btn — "Save & Exit" button (saves and returns to previous page)
- [ ] cancel-settings button — "Exit" button (checks for unsaved changes, navigates away)
- [ ] saveSettings() — saves all settings and navigates to return URL
- [ ] saveSettingsAndStay() — saves all settings, stays on page
- [ ] cancelSettings() — triggers CwocSaveSystem cancelOrExit flow
- [ ] setSaveButtonUnsaved() — marks save state as dirty (shows Save & Stay / Save & Exit)
- [ ] setSaveButtonSaved() — marks save state as clean (shows disabled "Saved" button)
- [ ] monitorChanges() — attaches change/input listeners to all form elements + MutationObservers

### General Settings Section
- [ ] gender-toggle (hidden input) — stores "Man" or "Woman"
- [ ] sex-pill (cwoc-2val-toggle) — pill toggle for Sex (♂ Man / ♀ Woman)
- [ ] _initPillToggle('sex-pill', 'gender-toggle') — wires click handler for sex toggle
- [ ] _updatePillToggle(pillId, activeVal) — updates visual active state of pill toggle
- [ ] unit-system-toggle (hidden input) — stores "imperial" or "metric"
- [ ] unit-pill (cwoc-2val-toggle) — pill toggle for Units (Imperial / Metric)
- [ ] _initPillToggle('unit-pill', 'unit-system-toggle') — wires click handler for unit toggle
- [ ] snooze-length (select) — Snooze Length dropdown (1 min, 3 min, 5 min, 10 min)
- [ ] calendar-snap (select) — Calendar Snap dropdown (None, 5–60 min)

### Contact Vault Section
- [ ] default-share-contacts (checkbox) — "Default share new contacts" toggle
- [ ] Setting hint text — explains vault sharing behavior

### Clocks Section
- [ ] time-format (select) — Time Format dropdown (24 Hour, 12 Hour, HST)
- [ ] toggleOrientation() button — "🔄 Orientation" button to switch clock layout
- [ ] time-format-grid — active clocks drag-and-drop grid (up to 4 slots)
- [ ] inactive-zone — inactive clocks zone (drag items here to deactivate)
- [ ] updateGrid(preserveOrder) — rebuilds the clock grid UI
- [ ] updateInactiveZone() — rebuilds the inactive clocks zone
- [ ] setupDragListeners() — attaches drag event handlers to all clock items/slots
- [ ] handleDragStart(e) — sets drag data and opacity on drag start
- [ ] handleDragEnd(e) — restores opacity on drag end
- [ ] handleDragOver(e) — prevents default to allow drop
- [ ] handleDropOnGrid(e) — handles drop onto active grid (reorder or activate)
- [ ] handleDropOnInactive(e) — handles drop onto inactive zone (deactivate clock)
- [ ] addFirstClock() — adds first clock from inactive zone when grid is empty
- [ ] formats array — clock format definitions (24hour, hst, 12hour, 12houranalog)

### Timezone Section
- [ ] default-timezone (text input with datalist) — Default Timezone input
- [ ] timezone-override (text input with datalist) — Current Override input
- [ ] tz-list-default (datalist) — IANA timezone autocomplete for default
- [ ] tz-list-override (datalist) — IANA timezone autocomplete for override
- [ ] clear-tz-override-btn — "✕ Clear Override" button
- [ ] _populateTimezoneDatalist() — populates datalists with Intl.supportedValuesOf('timeZone')
- [ ] _clearTimezoneOverride() — clears override field and marks unsaved
- [ ] _isValidTimezone(value) — validates timezone against IANA list
- [ ] _validateTimezoneSettings() — validates both timezone fields before save (shows error toast)

### Display Options Section
- [ ] default-view-select (select) — Landing view dropdown (Omni, Calendar, Checklists, Alerts, Projects, Tasks, Notes, Email, Indicators)
- [ ] _openArrangeViewsModal() button — "📋 Arrange Views" button
- [ ] _resetSortOrders() button — "🔄 Reset All Sort Orders" button (with cwocConfirm)

### Chit Options (Checkboxes)
- [ ] checklist-autosave-toggle — ⚡ Checklist Auto-Save
- [ ] autosave-desktop-toggle — 💾 Auto-save on Desktop
- [ ] autosave-mobile-toggle — 💾 Auto-save on Mobile
- [ ] fade-past — 📜 Fade Past Chits
- [ ] highlight-overdue — 🚨 Highlight Overdue (onchange: _onHighlightToggle)
- [ ] highlight-blocked — 🚧 Highlight Blocked (onchange: _onHighlightToggle)
- [ ] delete-past — 🗑️ Delete Past Alarms
- [ ] show-tab-counts — 🔢 Show Tab Counts
- [ ] prefer-google-maps — 🗺️ Prefer Google for Maps
- [ ] show-map-thumbnails — 📍 Show Map Thumbnails
- [ ] hide-declined-toggle — 🚫 Hide declined chits

### Visual Indicators Section
- [ ] combine-alerts-toggle (checkbox) — Combine Alerts (onchange: _toggleCombineAlerts)
- [ ] _toggleCombineAlerts() — shows/hides individual vs combined alert rows
- [ ] alarm_indicator (select) — 🔔 Alarm indicator (Always/Never/If Space)
- [ ] notification_indicator (select) — 📢 Notification indicator
- [ ] timer_indicator (select) — ⏱️ Timer indicator
- [ ] stopwatch_indicator (select) — ⏲️ Stopwatch indicator
- [ ] weather_indicator (select) — 🌤️ Weather indicator
- [ ] people_indicator (select) — 👥 People indicator
- [ ] indicators_indicator (select) — 📊 Indicators indicator
- [ ] custom_data_indicator (select) — 📋 Custom Data indicator
- [ ] combined_alert_indicator (select) — 🔔 Combined Alert indicator (shown when Combine Alerts checked)

### ESC Key Handler
- [ ] Escape key listener — layered ESC handling (close modals first, then exit page)
- [ ] Checks: omni-layout-modal → arrange-views-modal → update-modal → release-notes-modal → email-accounts-modal → QR overlay → tag modal → unsaved modal → blur input → cancelSettings

### SettingsService Class
- [ ] SettingsService.loadAll() — fetches settings from getCachedSettings()
- [ ] SettingsService.saveAll(settings) — POSTs settings to /api/settings (with 401 retry)

### SettingsManager Class
- [ ] constructor() → initialize() — loads settings, updates form, sets up listeners
- [ ] updateForm() — populates all form fields from loaded settings data
- [ ] gatherSettings() — collects all form values into a settings object for saving
- [ ] save() — validates, gathers, saves, reloads, marks saved
- [ ] setupEventListeners() — (empty, reserved for future use)

### Collapsible Section Headers
- [ ] .setting-group > h3 — clickable to collapse/expand setting groups
- [ ] .setting-subheader — clickable sub-section headers with collapse toggle

### DOMContentLoaded Init
- [ ] initMobileActionsModal() — initializes mobile actions modal if available
- [ ] _populateTimezoneDatalist() — populates timezone datalists
- [ ] CwocSaveSystem instantiation — creates save system with button IDs
- [ ] SettingsManager instantiation — loads and renders all settings
- [ ] loadVersionInfo() — loads version display
- [ ] refreshDiskUsage() — loads disk usage display
- [ ] loadImportBatches() — loads import batch history
- [ ] loadIcsImportOwnerPicker() — populates ICS import user picker
- [ ] _loadTagSharingData() — loads tag sharing configuration
- [ ] waitForAuth() — waits for auth, then loads admin-only features
- [ ] Hash-based deep linking — switches to correct tab and scrolls to section based on URL hash
