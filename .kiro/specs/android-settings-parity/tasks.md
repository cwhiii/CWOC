# Implementation Plan: Android Settings Parity

## Overview

This plan implements complete feature parity between the CWOC Android app's Settings screen and the web Settings page. Work is ordered by dependency: data layer and shared components first, then the save mechanism and tab structure, then tab-by-tab field implementation, and finally integration wiring.

## Tasks

- [x] 1. Data layer expansion — Room Migration 7→8 and SettingsEntity
  - [x] 1.1 Add new columns to SettingsEntity and create Migration7To8
    - Add all new `@ColumnInfo` fields to `SettingsEntity` as specified in the design (General, Views, Email, Admin columns)
    - Create `Migration7To8` class with `ALTER TABLE settings ADD COLUMN` statements wrapped in try/catch for idempotency
    - Register the migration in `AppModule.provideCwocDatabase()` via `.addMigrations(...)`
    - Bump `@Database(version = 8)` on the Room database class
    - _Requirements: 31.1, 31.2_

  - [x] 1.2 Expand SettingsFormState data class to ~120+ fields
    - Add all new fields grouped by tab (General, Views, Email, Admin) as specified in the design
    - Ensure all fields have appropriate default values matching web client defaults
    - _Requirements: 31.2, 31.3_

  - [x] 1.3 Update SettingsRepository mapping functions
    - Update `mapEntityToFormState()` to map all new Entity columns to FormState fields
    - Update `mapFormStateToEntity()` to map all new FormState fields back to Entity columns
    - _Requirements: 31.1, 31.2_

  - [x] 1.4 Implement API payload mapping with unsupported field preservation
    - Create `mapFormStateToPayload()` producing JSON with identical key names to web client (per API Payload Mapping table in design)
    - Create `mapPayloadToFormState()` for parsing API responses into FormState
    - Store raw server JSON as `_rawServerSettings: Map<String, Any?>` on load
    - On save, merge managed fields over `_rawServerSettings` to preserve unrecognized fields
    - _Requirements: 31.1, 31.4, 31.5, 31.6_

  - [x] 1.5 Add new API endpoint interfaces to CwocApiService
    - Add Retrofit interface methods for all endpoints listed in the design (ntfy, tailscale, HA, disk-usage, version, update/run SSE, update/log, restart, release-notes, export, import, bundles)
    - _Requirements: 25, 26, 27, 28, 24_

- [x] 2. Shared composable components
  - [x] 2.1 Implement CollapsibleSection composable
    - Create `CollapsibleSection` composable with title, sectionId, defaultExpanded parameters
    - Render header row with title text and animated chevron icon (▼ expanded, ▶ collapsed)
    - Toggle content visibility on header/chevron tap
    - Persist expanded/collapsed state to SharedPreferences keyed as `"settings_section_$sectionId"`
    - Default to expanded on first use
    - _Requirements: 32.1, 32.2, 32.3, 32.4, 32.5_

  - [x] 2.2 Implement DragGrid composable
    - Create `DragGrid` composable with items list, onReorder callback, columns, and orientation parameters
    - Create `DragItem` data class (id, label, zone: ACTIVE/INACTIVE) and `DragGridOrientation` enum
    - Support long-press to initiate drag
    - Allow dragging items between Active and Inactive zones
    - Allow reordering within the Active zone
    - Call `onReorder` with new item list after each drag completes
    - _Requirements: 4.3, 4.4, 4.5, 4.6_

  - [x] 2.3 Implement CustomFilterModal composable
    - Create full-screen dialog with viewName, currentFilter, availableTags, availableContacts, availableProjects, onDone, onCancel parameters
    - Create `CustomViewFilter` data class with all fields (filterText, sortField, sortDirection, statuses, priorities, tags, people, project, displayToggles)
    - Implement collapsible filter groups: Filter Text, Sort (field + direction), Status (multi-select), Priority (multi-select), Tags (multi-select), People (multi-select), Project (single-select), Display (toggle checkboxes)
    - Implement Done, Cancel, and Reset to Defaults buttons
    - If filter matches system defaults on Done, remove the entry rather than storing redundant defaults
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

  - [x] 2.4 Implement OmniLayoutModal composable
    - Create full-screen dialog with currentLayout, onDone, onCancel parameters
    - Create `OmniLayout` data class (fullWidth, leftColumn, rightColumn, unused lists)
    - Display all Omni View sections as draggable cards movable between Full Width, Left Column, Right Column, and Unused zones
    - _Requirements: 10.2, 10.3_

  - [x] 2.5 Implement SignatureEditorModal composable
    - Create dialog with currentSignature, onConfirm, onDismiss parameters
    - Text editor area with markdown content
    - Live-rendered preview below using existing `MarkdownRenderer`
    - Bold/Italic/Link toolbar buttons that wrap selected text
    - Confirm saves, Dismiss discards
    - _Requirements: 19.4, 19.5, 19.6, 19.7_

  - [x] 2.6 Implement UpgradeModal composable
    - Create dialog with mode (UPGRADE or VIEW_LOG), onDismiss parameters
    - Terminal-style scrollable log area (monospace font, dark background)
    - Start button connects to `/api/update/run` via SSE and streams log lines
    - Auto-scrolls as new lines arrive
    - Copy button copies log text to clipboard
    - Disable Start and Close during active upgrade, re-enable on completion/error
    - VIEW_LOG mode: hide Start, fetch from `/api/update/log`, display in terminal area
    - _Requirements: 28.4, 28.5, 28.6_

  - [x] 2.7 Implement ReleaseNotesDialog composable
    - Fetch daily release notes from `/api/release-notes`
    - Render most recent day's content as markdown with formatted date header
    - Provide Older/Newer navigation buttons with "{current} / {total}" counter
    - _Requirements: 28.8_

- [x] 3. Save mechanism and dirty tracking
  - [x] 3.1 Implement dirty tracking in SettingsViewModel
    - Add `_savedSnapshot` StateFlow holding last-saved SettingsFormState
    - Derive `isDirty` StateFlow by comparing current `_settings` to `_savedSnapshot`
    - On successful save, update `_savedSnapshot` to current state
    - On discard, revert `_settings` to `_savedSnapshot`
    - _Requirements: 1.1, 1.2, 1.7_

  - [x] 3.2 Replace FAB with Save & Stay / Save & Exit / Discard button group
    - Remove existing FAB save button
    - Add TopAppBar actions row with: "Saved ✓" (disabled, shown when not dirty), "Save & Stay" (shown when dirty), "Save & Exit" (shown when dirty)
    - Add Exit/Discard button in navigation icon area (label changes based on dirty state)
    - Implement `saveAndStay()`: persist, update snapshot, stay on screen
    - Implement `saveAndExit()`: persist, update snapshot, signal navigation
    - Implement `discardChanges()`: revert to savedSnapshot
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.7_

  - [x] 3.3 Implement unsaved changes confirmation dialog
    - Show confirmation dialog on back navigation (system back, back gesture, toolbar back) when dirty
    - Three options: Save (persist then navigate), Discard (revert then navigate), Cancel (dismiss dialog)
    - _Requirements: 1.6_

- [x] 4. Tab structure and navigation
  - [x] 4.1 Restructure SettingsScreen tab layout
    - Remove "Badges" as a separate tab
    - Set tab order: General (0), Views (1), Collections (2), Email (3), Administration (4)
    - Hide Administration tab for non-admin users (check `settingsViewModel.isAdmin`)
    - _Requirements: 29.1, 29.2, 29.3_

  - [x] 4.2 Implement deep-link navigation support
    - Accept `deepLinkTab` and `deepLinkSection` parameters in SettingsScreen
    - On load, if `deepLinkTab` is provided, select that tab
    - If `deepLinkSection` is provided, scroll to that section within 500ms
    - If deep-link targets Admin tab and user is not admin, navigate to General tab
    - _Requirements: 29.4, 29.5_

- [x] 5. Checkpoint — Ensure foundational components compile and wire correctly
  - Ensure all data layer, shared components, save mechanism, and tab structure changes compile without errors, ask the user if questions arise.

- [x] 6. General Tab — General Section corrections
  - [x] 6.1 Correct Sex setting to pill toggle with "♂ Man" / "♀ Woman"
    - Replace current "Male"/"Female" labels with 2-value pill toggle using "man"/"woman" values
    - _Requirements: 2.1_

  - [x] 6.2 Correct Snooze Length dropdown options
    - Replace current 5/10/15/30/60 min options with exactly: 1 min, 3 min, 5 min, 10 min
    - Implement nearest-valid-option fallback for previously-saved values that don't match new options
    - _Requirements: 2.2, 2.4_

  - [x] 6.3 Correct Calendar Snap dropdown options
    - Replace current options with exactly: None (0), 5 min, 10 min, 15 min, 20 min, 25 min, 30 min, 60 min
    - Implement nearest-valid-option fallback for previously-saved values
    - _Requirements: 2.3, 2.4_

- [x] 7. General Tab — Contact Vault Section
  - [x] 7.1 Implement Contact Vault section
    - Add "🏛️ Contact Vault" collapsible section
    - Display "Default share new contacts" label with toggle switch
    - Display hint text below toggle
    - Map to `default_share_contacts` field ("1"/"0")
    - Mark form dirty on toggle change
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 8. General Tab — Clocks Section
  - [x] 8.1 Implement Time Format dropdown with HST option
    - Display dropdown with three options: "24 Hour" (24hour), "12 Hour" (12hour), "HST" (metric)
    - _Requirements: 4.1_

  - [x] 8.2 Implement clock orientation toggle and DragGrid for active/inactive clocks
    - Add "Orientation" button toggling between horizontal and vertical layout
    - Integrate DragGrid composable showing Active Clocks grid (up to 4 types: "24 Hour", "HST", "12 Hour", "12 Hour Analog")
    - Display Inactive Clocks zone with disabled clock types
    - Allow drag between zones and reorder within Active zone
    - Show "Add Clock" button when Active grid is empty
    - Mark form dirty on any clock change
    - _Requirements: 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

- [x] 9. General Tab — Timezone Section
  - [x] 9.1 Implement Current Override timezone field
    - Add "Current Override" text input with IANA timezone autocomplete suggestions
    - Position below existing Default Timezone field
    - Add "✕ Clear Override" button that clears the field and marks dirty
    - Add hint text explaining override behavior
    - Validate on save: reject non-empty values that aren't valid IANA timezone names with error toast
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 10. General Tab — Display Options Section
  - [x] 10.1 Implement Landing View dropdown with all 9 options
    - Display dropdown with: Omni, Calendar, Checklists, Alerts, Projects, Tasks, Notes, Email, Indicators
    - Add hint text about fresh app open behavior
    - _Requirements: 6.1_

  - [x] 10.2 Implement Arrange Views modal with hidden zone
    - "Arrange Views" button opens modal with visible tabs zone (drag-to-reorder), Hidden zone (drag to hide)
    - Omni fixed as non-draggable first item
    - Hidden zone shows placeholder "Drag tabs here to hide them" when empty
    - Cancel, Reset to Default, and Done buttons
    - _Requirements: 6.2, 6.3_

  - [x] 10.3 Implement Reset All Sort Orders with danger confirmation
    - "Reset All Sort Orders" button shows danger confirmation dialog
    - On confirm, POST to reset endpoint, clear all sort preferences, show success notification
    - _Requirements: 6.4, 6.5_

- [x] 11. General Tab — Chit Options Section
  - [x] 11.1 Implement all 11 chit option checkboxes
    - Display collapsible "Chit Options" section with 11 checkboxes in exact order: Checklist Auto-Save, Auto-save on Desktop, Auto-save on Mobile, Fade Past Chits, Highlight Overdue, Highlight Blocked, Delete Past Alarms, Show Tab Counts, Prefer Google for Maps, Show Map Thumbnails, Hide declined chits
    - Set correct defaults (Fade Past, Highlight Overdue, Highlight Blocked = checked; rest = unchecked)
    - Restore from saved state on load
    - Mark dirty on any toggle
    - Persist as chit_options object + top-level fields per requirement 7.5
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 12. General Tab — Visual Indicators Section
  - [x] 12.1 Implement Visual Indicators configuration
    - Display collapsible "Visual Indicators" subsection
    - "Combine Alerts" checkbox (unchecked by default)
    - Indicator rows: Alarm, Notification, Timer, Stopwatch, Combined Alerts, Weather, People, Indicators, Custom Data
    - Each row has icon + label + three-option selector (Always/Never/If Space, default Always)
    - When Combine Alerts checked: hide individual Alarm/Notification/Timer/Stopwatch rows, show Combined Alerts row
    - When unchecked: show individual rows, hide Combined Alerts row
    - Persist all values to visual_indicators settings object
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 13. General Tab — Custom Filters Section
  - [x] 13.1 Implement Custom Filters & Sorting section with per-view buttons
    - Display collapsible "Custom Filters & Sorting" section
    - Show button for each of 9 views: Omni, Calendar, Checklists, Tasks, Projects, Notes, Email, Indicators, Alarms
    - Each button opens CustomFilterModal for that view
    - Display status indicator next to each button: "Custom" with check icon when filter saved, "Default" with neutral icon when not
    - On Done from modal, mark settings dirty
    - _Requirements: 9.1, 9.5, 9.6_

- [x] 14. Checkpoint — Ensure General Tab compiles and renders correctly
  - Ensure all General Tab sections compile without errors and render in the correct order, ask the user if questions arise.

- [x] 15. Views Tab — Omni View Section
  - [x] 15.1 Implement Omni View configuration
    - Display collapsible "Omni View" section
    - "HST Bar Clock" selector: "Both (System + HST)", "HST Only", "System Time Only"
    - "Arrange Omni Layout" button opening OmniLayoutModal
    - "Bundle Omni View Toggles" checkbox list populated from server bundles
    - "Emails to show" dropdown: 3, 5, 10, 15, 20
    - "Color mode" selector: Colored, Normalized, Mono
    - "Locked Filter Defaults" text summary (or "None"), with "Clear Defaults" button (disabled when none)
    - "Reset Omni View to Defaults" button with confirmation dialog
    - Mark dirty on any change
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9, 10.10, 10.11_

- [x] 16. Views Tab — Calendar Section corrections
  - [x] 16.1 Implement full Calendar configuration
    - "Week Starts On" dropdown with all 7 days: Sun, Mon, Tue, Wed, Thu, Fri, Sat
    - "View Hours" start/end dropdowns (00:00–23:00, 1-hour increments)
    - Validation: prevent save if start >= end, show error
    - "Scroll to" hour dropdown (00:00–12:00, 1-hour increments)
    - "X Days Count" number input (2–30) shown when X Days period enabled
    - "Work Hours" checkbox enabling work day checkboxes (Sun–Sat) and work hour start/end dropdowns
    - Validation: prevent save if work start >= work end, show error
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8_

- [x] 17. Views Tab — Habits Section
  - [x] 17.1 Implement Habits configuration
    - "Success rate window" dropdown: Last 7 days (7), Last 30 days (30), Last 90 days (90), All time (all) — default "Last 30 days"
    - "Default: show habits on calendar" checkbox (default checked)
    - Hint text below checkbox
    - Persist as `habits_success_window` and `default_show_habits_on_calendar` ("1"/"0")
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

- [x] 18. Views Tab — Projects Section
  - [x] 18.1 Implement Projects configuration
    - "Show child chit count on project masters" checkbox (default unchecked, maps to `projects_show_child_count`)
    - "Show aggregate checklist progress on project masters" checkbox (default unchecked, maps to `projects_show_checklist_count`)
    - Hint text below checkboxes
    - Mark dirty on toggle, persist via settings sync
    - _Requirements: 13.1, 13.2, 13.3, 13.4_

- [x] 19. Views Tab — Maps Section
  - [x] 19.1 Implement Maps configuration
    - "Auto-zoom to markers on load" checkbox (default checked)
    - "Default Latitude" number input (-90 to 90)
    - "Default Longitude" number input (-180 to 180)
    - "Default Zoom (1-18)" number input (1 to 18)
    - When auto-zoom enabled: show coordinate/zoom inputs in disabled state (reduced opacity)
    - When auto-zoom disabled: show inputs in enabled state
    - On save: clear invalid coordinate/zoom values to empty (silent correction)
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7_

- [x] 20. Collections Tab — Tag Editor Enhancements
  - [x] 20.1 Implement hierarchical tag display and enhanced tag editor
    - Display tags in hierarchical tree structure (/ delimiter = parent-child), with expand/collapse per parent
    - Tag edit dialog: favorite star toggle (☆/★) pinning to top of lists
    - Tag edit dialog: "Sharing" section with user picker, role selector (Viewer/Manager), Share button, current shares list with remove buttons
    - Tag edit dialog: "Font Color" picker with preset swatches matching background set, default #5c3317
    - Tag edit dialog: preview chip showing tag with selected background + font color, updating within 100ms
    - Tag edit dialog: free-form hex color input for both background and font colors with validation
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7_

- [x] 21. Collections Tab — Custom Colors Enhancements
  - [x] 21.1 Implement overdue/blocked border color assignment
    - On color swatch tap: show popup with "Overdue Border", "Blocked Border", "Cancel" (visibility conditional on highlight settings)
    - Display ring outline (min 2dp) around assigned swatch with "Overdue" or "Blocked" label
    - Support double ring if same swatch assigned to both
    - Remove ring from previously assigned swatch when reassigning
    - Mark dirty on assignment
    - Persist as `overdue_border_color` / `blocked_border_color` in settings payload
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6_

- [x] 22. Checkpoint — Ensure Views and Collections Tabs compile correctly
  - Ensure all Views Tab and Collections Tab sections compile without errors, ask the user if questions arise.

- [x] 23. Email Tab — Account Test Connection
  - [x] 23.1 Implement Test Connection button
    - Add "Test Connection" button below SMTP configuration fields
    - On tap: POST current form values to `/api/email/test-connection`, show "Testing..." inline
    - Display IMAP and SMTP results independently ("IMAP OK", "SMTP OK")
    - On error: display failure reason inline below button
    - Disable button while request in progress
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5_

- [x] 24. Email Tab — Syncing Section corrections
  - [x] 24.1 Implement corrected syncing options
    - "Max Pull" as free-form number input (1–1000), pre-populated from server
    - Validation: reject <1, >1000, non-numeric, empty with inline error
    - "Check Mail" interval dropdown: Manual only, Every 5 min, Every 15 min, Every 30 min, Every 1 hour
    - "Backfill" action button (not toggle) triggering one-time backfill with progress indicator
    - _Requirements: 18.1, 18.2, 18.3, 18.4_

- [x] 25. Email Tab — Privacy & Sending corrections
  - [x] 25.1 Implement corrected privacy and sending options
    - "External Content" dropdown: Allow all (allow), Block all (block), Allow from contacts (known_senders) — default "Allow all"
    - "Read Receipts" dropdown: Never send (never), Always send (always), Ask each time (ask), Contacts only (contacts_only) — default "Never send"
    - Signature inline preview rendering stored markdown (or "No signature set" placeholder)
    - "Edit Signature" button opening SignatureEditorModal
    - On confirm: update stored signature, refresh preview
    - On cancel: discard edits, preserve previous signature
    - "Attachments" hint text about Administration → Data Management
    - "View All Attachments" button navigating to attachments page
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 19.7, 19.8, 19.9_

- [x] 26. Email Tab — Display & Bundles corrections
  - [x] 26.1 Implement corrected display and bundle options
    - "Group Emails By" dropdown: Date (date), None (none)
    - "Bundle Count Display" dropdown: Unread / Total (both), Unread only (unread), Total only (total), Hidden (none)
    - "Auto-Bundles" checkbox list populated from server bundles (non-removable, excluding "Everything Else")
    - Placeholder message when no auto-bundles exist
    - On disable toggle: call bundle disable endpoint
    - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5_

- [x] 27. Email Tab — Badges Section (merged from separate tab)
  - [x] 27.1 Implement Badges as collapsible section within Email Tab
    - Move existing Badges content into Email Tab as a CollapsibleSection
    - Implement full custom badge detector editor with all fields:
      - Name text input with placeholder
      - Category dropdown: Custom, Package, Flight, Hotel, Rental, Event, Restaurant, Transit, Order (default Custom)
      - Keywords text input (comma-separated, may be empty)
      - Regex Pattern text input (monospace, with placeholder and hint about capture group)
      - URL Template text input (monospace, with placeholder and hint about {code})
      - Button Label dropdown: View, Track, Manage, Order, Tickets, Flight, Open (default View)
    - Validation on save: reject empty Name, empty Regex, invalid Regex syntax, empty URL Template, URL Template missing "{code}" — show inline error
    - _Requirements: 21.1, 21.2, 21.3, 21.4, 21.5, 21.6, 21.7, 29.1_

- [x] 28. Checkpoint — Ensure Email Tab compiles correctly
  - Ensure all Email Tab sections compile without errors, ask the user if questions arise.

- [x] 29. Admin Tab — Administration Section
  - [x] 29.1 Implement Administration section
    - "Manage Users" button navigating to user administration screen
    - "Instance Name" text input (max 100 chars), pre-populated from server
    - "Welcome Message" textarea (markdown, max 5000 chars), pre-populated from server
    - Rendered markdown preview below textarea, updating within 500ms of last keystroke
    - "Session Lifetime" dropdown: 1 hour, 12 hours, 24 hours, 1 week, 1 month, Never — pre-selected to current value
    - Persist on save, show error on failure retaining unsaved input
    - _Requirements: 22.1, 22.2, 22.3, 22.4, 22.5, 22.6, 22.7_

- [x] 30. Admin Tab — Tools Section (Kiosk)
  - [x] 30.1 Implement Kiosk configuration
    - "Kiosk" collapsible section with hint about parent/child tag behavior
    - Scrollable tag selection list (max 200px height) showing user-created tags as checkboxes in hierarchical tree, excluding system tags
    - Checking parent does NOT auto-check children (kiosk display handles inclusion)
    - "Open Kiosk" button navigating to kiosk view with selected tags as parameters
    - Error toast if no tags selected on Open Kiosk
    - Persist kiosk tag selection on settings save
    - _Requirements: 23.1, 23.2, 23.3, 23.4, 23.5_

- [x] 31. Admin Tab — Data Management Section
  - [x] 31.1 Implement Data Management section
    - Separate "Chit Data" export and import buttons
    - Separate "User Data" export and import buttons
    - "Calendar Import (.ics)" button with user-selection dropdown
    - "Import Google Tasks (.json)" button
    - "Import Google Keep (.json)" button
    - "Import Batches" section listing previous batches (max 100, most recent first) with delete button per batch
    - "Audit Log" navigation button
    - "Trash" navigation button
    - "Custom Objects" navigation button
    - "Audit Log Limits": Enable Pruning checkbox, Max Age (days) input (1–9999), Max Size (MB) input (1–99999)
    - "Attachment Limits": Max File Size dropdown (5/10/25/50 MB), Max Storage Per User dropdown (100 MB/250 MB/500 MB/1 GB/2 GB/5 GB/Unlimited)
    - Import Mode dialog (Add to existing / Replace all) before file selection
    - Confirmation dialog for "Replace all data"
    - Export buttons invoke Android system share sheet / file-save picker
    - Error handling for invalid file format or server error on import
    - "Purge All Data" button with two-step confirmation
    - _Requirements: 24.1, 24.2, 24.3, 24.4, 24.5, 24.6, 24.7, 24.8, 24.9, 24.10, 24.11, 24.12, 24.13, 24.14, 24.15, 24.16_

- [x] 32. Admin Tab — Dependent Apps (Tailscale)
  - [x] 32.1 Implement Tailscale configuration section
    - "Tailscale" toggle button with status icon (⚪/🟡/🟢/🔴) expanding/collapsing config section (default collapsed)
    - Help icon toggling setup instructions visibility
    - Fetch and display connection status: "⚪ Not Installed", "🟡 Inactive", "🟢 Connected", "🔴 Error"
    - When Connected: display Tailscale IP and hostname
    - "Auth Key" password input with show/hide toggle and "Get Key" link opening Tailscale admin console
    - "Save Config" button (disabled until auth key or enabled state differs from saved), saves independently of main settings save
    - Connect/Disconnect buttons with correct enabled/disabled states based on status
    - Auto-refresh status after Connect, Disconnect, or Save Config
    - "Check Status" button for manual refresh
    - Inline error messages on operation failure
    - _Requirements: 25.1, 25.2, 25.3, 25.4, 25.5, 25.6, 25.7, 25.8, 25.9, 25.10_

- [x] 33. Admin Tab — Dependent Apps (Ntfy)
  - [x] 33.1 Implement Ntfy configuration section
    - "Ntfy" zone-button expanding/collapsing config section with status icon (🟢/⚫/🔴/⚪)
    - Help icon toggling setup instructions with numbered steps and help guide link
    - Fetch and display status: "🟢 Active", "⚫ Disabled", "🔴 Unreachable", "⚪ Not Configured"
    - Display local server URL (http://{host}:2586) as read-only monospace with copy button
    - Display Tailscale server URL when Tailscale active, with hint about avoiding duplicates
    - Display Ntfy topic (cwoc- + first 12 alphanum chars of user ID) as read-only monospace with copy button
    - "🔔 Test" button: POST to /api/network-access/ntfy/test, inline feedback (success with topic name, or failure reason)
    - "📱 Open App" button launching ntfy:// URI scheme
    - Enable/Disable toggle: call enable/disable endpoints, update status icon and button label
    - "🔄 Check Status" button re-fetching status
    - Inline error messages on any failure
    - _Requirements: 26.1, 26.2, 26.3, 26.4, 26.5, 26.6, 26.7, 26.8, 26.9, 26.10, 26.11, 26.12_

  - [x] 33.2 Implement Test Phone Notification button within Ntfy section
    - "Test Phone Notification" button within Ntfy subsection
    - Disabled when ntfy not configured (server URL or topic empty)
    - On tap: POST to `/api/network-access/ntfy/test`, show inline feedback (success or failure within 10s)
    - Disable button and show loading indicator while request in progress
    - _Requirements: 30.1, 30.2, 30.3, 30.4_

- [x] 34. Admin Tab — Dependent Apps (Home Assistant)
  - [x] 34.1 Implement Home Assistant configuration section
    - "Home Assistant" toggle button with colored circle indicator (green enabled, red/grey disabled) expanding/collapsing section
    - Help icon toggling setup instructions (enter URL, generate token, paste/save, test, use webhook)
    - "HA Base URL" text input with placeholder "http://192.168.1.100:8123"
    - "Access Token" password-masked input with show/hide toggle
    - "Poll Interval (sec)" number input (min 5, max 3600, default 30)
    - "Test Connection" button: verify connectivity, display success or error within 10s
    - "Save HA Config" button: persist URL, token, poll interval independently of global save, show success/failure
    - Webhook URL as read-only text field with "Copy" button and clipboard confirmation
    - "Regenerate Webhook Secret" button with confirmation warning about breaking existing automations
    - _Requirements: 27.1, 27.2, 27.3, 27.4, 27.5, 27.6, 27.7, 27.8, 27.9_

- [x] 35. Admin Tab — Version & Updates Section
  - [x] 35.1 Implement Version & Updates section
    - Display current server version string and "Updated" date (formatted per user's time format setting) from `/api/version`
    - Disk usage: "{used} / {total} ({percent}% used)" with refresh button (disable during fetch), warning color at ≥75%, critical color at ≥90%
    - "CWOC Data" storage size: "{size} ({percent}% of disk)" from `/api/disk-usage`
    - "Upgrade" button opening UpgradeModal in UPGRADE mode
    - "Show Log" button opening UpgradeModal in VIEW_LOG mode
    - "Restart CWOC" button (admin only): confirmation dialog warning about brief unavailability, POST to `/api/restart` on confirm
    - "Release Notes" button opening ReleaseNotesDialog
    - _Requirements: 28.1, 28.2, 28.3, 28.4, 28.5, 28.6, 28.7, 28.8_

- [x] 36. Checkpoint — Ensure Admin Tab compiles correctly
  - Ensure all Admin Tab sections compile without errors, ask the user if questions arise.

- [x] 37. Integration wiring and final validation
  - [x] 37.1 Wire all ViewModel update functions to UI controls
    - Ensure every field change in every tab calls `updateSetting(key, value)` on the ViewModel
    - Ensure dirty tracking fires correctly for all 120+ fields
    - Ensure save payload includes all fields from all tabs
    - _Requirements: 1.2, 1.7, 31.1_

  - [x] 37.2 Wire all navigation callbacks in SettingsScreen
    - Connect `onNavigateToAdminChits`, `onNavigateToUserAdmin`, `onNavigateToAuditLog`, `onNavigateToTrash`, `onNavigateToCustomObjects`, `onNavigateToAttachments`, `onNavigateToKiosk` to actual navigation actions
    - Ensure deep-link parameters are passed from the navigation graph
    - _Requirements: 29.4, 29.5, 22.1, 24.7, 24.8, 24.9_

  - [x] 37.3 Implement error handling for save and load operations
    - Save failure: error toast, retain form values, keep save buttons in dirty state
    - Load failure: error toast, show last-cached settings from Room (or defaults if no cache)
    - Test connection failures (email, HA, ntfy): inline error below button with failure reason, re-enable button
    - Upgrade SSE failure: "Connection lost" in terminal area, re-enable Start and Close
    - _Requirements: 1.5, 31.7, 17.4, 27.6, 26.12_

  - [x] 37.4 Implement validation rules preventing save
    - Invalid timezone: error toast, prevent save, highlight field
    - Invalid hour range (view hours, work hours): inline error, prevent save
    - Invalid map coordinates: clear invalid field to empty before saving (silent correction)
    - Invalid email max pull: inline error "Valid range: 1–1000", prevent save
    - Invalid badge detector: inline error with specific failure, prevent save of that detector
    - _Requirements: 5.4, 11.3, 11.8, 14.7, 18.2, 21.7_

- [x] 38. Final checkpoint — Ensure all settings compile, wire correctly, and match web behavior
  - Ensure all tasks compile without errors, all tabs render, dirty tracking works, save/load round-trips correctly, ask the user if questions arise.

## Notes

- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at logical boundaries
- Tasks are ordered by dependency: data layer → shared components → save mechanism → tab structure → tab content → integration
- The design uses Kotlin/Jetpack Compose — all implementation is in that stack
- No test-writing tasks are included per project steering rules (tests are optional)
- No software installation tasks are included per project steering rules

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "1.4", "1.5"] },
    { "id": 2, "tasks": ["2.1", "2.2", "2.3", "2.4", "2.5", "2.6", "2.7"] },
    { "id": 3, "tasks": ["3.1", "3.2", "3.3"] },
    { "id": 4, "tasks": ["4.1", "4.2"] },
    { "id": 5, "tasks": ["6.1", "6.2", "6.3", "7.1", "8.1", "8.2", "9.1"] },
    { "id": 6, "tasks": ["10.1", "10.2", "10.3", "11.1", "12.1", "13.1"] },
    { "id": 7, "tasks": ["15.1", "16.1", "17.1", "18.1", "19.1"] },
    { "id": 8, "tasks": ["20.1", "21.1"] },
    { "id": 9, "tasks": ["23.1", "24.1", "25.1", "26.1", "27.1"] },
    { "id": 10, "tasks": ["29.1", "30.1", "31.1"] },
    { "id": 11, "tasks": ["32.1", "33.1", "33.2", "34.1", "35.1"] },
    { "id": 12, "tasks": ["37.1", "37.2", "37.3", "37.4"] }
  ]
}
```
