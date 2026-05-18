# Design Document: Android Settings Parity

## Overview

This design specifies the complete technical approach for achieving 100% feature parity between the CWOC Android app's Settings screen and the web Settings page. The web implementation (`settings.html` + `settings.js`) is the authoritative reference.

The current Android settings implementation covers approximately 22% of functionality — it has a basic tab structure (General, Views, Collections, Email, Badges, Admin), a FAB-based save button, and partial field coverage. This design addresses every gap: the save mechanism must be replaced with Save & Stay / Save & Exit / dirty tracking, the tab structure must be corrected (Badges moves into Email tab, Admin is conditionally hidden), and every missing field, modal, validation rule, and behavioral detail must be implemented.

**Key architectural decisions:**
- Extend `SettingsFormState` to hold all 100+ settings fields (currently ~40)
- Add new columns to `SettingsEntity` via Room migration 7→8 for fields not yet in the schema
- Replace the FAB save button with a top-bar button group (Saved / Save & Stay / Save & Exit / Discard)
- Add dirty tracking by comparing current form state against a snapshot taken at load time
- Implement collapsible sections with SharedPreferences-persisted state
- Add deep-link navigation support via Intent extras
- Reuse existing shared components (`CwocZoneButton`, `CwocPromptDialog`, `ArrangeViewsDialog`, `MarkdownRenderer`)

## Architecture

```mermaid
graph TD
    subgraph UI Layer
        SS[SettingsScreen] --> GT[GeneralSettingsTab]
        SS --> VT[ViewsSettingsTab]
        SS --> CT[CollectionsSettingsTab]
        SS --> ET[EmailSettingsTab]
        SS --> AT[AdminSettingsTab]
    end

    subgraph ViewModel Layer
        SVM[SettingsViewModel] --> |dirty tracking| DT[DirtyTracker]
        SVM --> |form state| SFS[SettingsFormState]
        SVM --> |save/load| SR[SettingsRepository]
    end

    subgraph Data Layer
        SR --> SD[SettingsDao]
        SR --> SPE[SyncPushEngine]
        SD --> DB[(Room DB v8)]
        SPE --> API[/api/settings POST]
    end

    subgraph Shared Components
        SS --> CSB[CollapsibleSection]
        GT --> DG[DragGrid]
        GT --> CFM[CustomFilterModal]
        VT --> OLM[OmniLayoutModal]
        AT --> UGM[UpgradeModal]
        AT --> RND[ReleaseNotesDialog]
    end

    SS --> SVM
```

**Data flow:**
1. `SettingsScreen` loads → `SettingsViewModel.loadSettings()` fetches from `SettingsRepository` (Room)
2. User edits a field → `onUpdateSetting(key, value)` updates `SettingsFormState` in the ViewModel
3. ViewModel compares current state to `savedSnapshot` → derives `isDirty` flag
4. User taps Save & Stay → ViewModel calls `SettingsRepository.update()` → marks dirty → `SyncPushEngine.pushAll()` → POST to `/api/settings`
5. On success → ViewModel updates `savedSnapshot` to current state → `isDirty` becomes false

## Components and Interfaces

### SettingsScreen (Revised)

The top-level composable is restructured:

```kotlin
@Composable
fun SettingsScreen(
    onNavigateBack: () -> Unit,
    onNavigateToAdminChits: () -> Unit = {},
    onNavigateToUserAdmin: () -> Unit = {},
    onNavigateToAuditLog: () -> Unit = {},
    onNavigateToTrash: () -> Unit = {},
    onNavigateToCustomObjects: () -> Unit = {},
    onNavigateToAttachments: () -> Unit = {},
    onNavigateToKiosk: (selectedTags: List<String>) -> Unit = {},
    deepLinkTab: String? = null,
    deepLinkSection: String? = null,
    settingsViewModel: SettingsViewModel = hiltViewModel()
)
```

**Tab structure changes:**
- Remove "Badges" as a separate tab — merge into Email tab as a collapsible section
- Tab order: General (0), Views (1), Collections (2), Email (3), Administration (4)
- Administration tab hidden for non-admin users (check `settingsViewModel.isAdmin`)
- Deep-link support: if `deepLinkTab` is provided, select that tab on load; if `deepLinkSection` is provided, scroll to that section

**Save mechanism replacement:**
- Remove the FAB
- Add a `TopAppBar` actions row with:
  - "Saved ✓" (disabled, shown when not dirty)
  - "Save & Stay" button (shown when dirty)
  - "Save & Exit" button (shown when dirty)
  - Exit/Discard button in navigation icon area

### SettingsViewModel (Revised)

```kotlin
@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val settingsRepository: SettingsRepository,
    private val syncRepository: SyncRepository,
    private val authRepository: AuthRepository,
    private val apiService: CwocApiService
) : ViewModel() {

    // Full form state
    private val _settings = MutableStateFlow(SettingsFormState())
    val settings: StateFlow<SettingsFormState>

    // Snapshot of last-saved state for dirty comparison
    private val _savedSnapshot = MutableStateFlow(SettingsFormState())

    // Derived dirty flag
    val isDirty: StateFlow<Boolean>  // settings != savedSnapshot

    // Save state
    val isSaving: StateFlow<Boolean>
    val saveError: StateFlow<String?>

    // Admin check
    val isAdmin: StateFlow<Boolean>

    fun updateSetting(key: String, value: String)
    fun saveAndStay()   // persist, update snapshot, stay on screen
    fun saveAndExit()   // persist, update snapshot, signal navigation
    fun discardChanges() // revert to savedSnapshot
    fun resetSortOrders() // POST to /api/settings/reset-sort-orders
}
```

### SettingsFormState (Expanded)

The form state data class expands from ~40 fields to ~120+ fields covering every setting. Key additions grouped by section:

**General Tab additions:**
- `sex: String` — corrected to use "man"/"woman" values
- `defaultShareContacts: String` — "1"/"0"
- `timeFormatDisplay: String` — "24hour"/"12hour"/"metric"
- `clockOrientation: String` — "horizontal"/"vertical"
- `activeClocks: String` — JSON array of enabled clock types in order
- `timezoneOverride: String` — IANA timezone or empty
- `landingView: String` — one of the 9 view names
- `viewOrder: String` — JSON array of visible tab order
- `hiddenViews: String` — JSON array of hidden tabs
- `chitOptions: String` — JSON object with all 11 checkbox states
- `visualIndicators: String` — JSON object with indicator configs
- `combineAlerts: String` — "1"/"0"
- `customViewFilters: String` — JSON object keyed by view name

**Views Tab additions:**
- `omniHstClockMode: String` — "both"/"hst"/"system"
- `omniLayout: String` — JSON layout configuration
- `omniBundleToggles: String` — JSON object of bundle visibility
- `omniEmailCount: String` — "3"/"5"/"10"/"15"/"20"
- `omniNormalizeColors: String` — "colored"/"normalized"/"mono"
- `omniLockedFilters: String` — JSON array
- `weekStartDay: String` — full 7-day support
- `allViewStartHour: String` / `allViewEndHour: String`
- `dayScrollToHour: String`
- `customDaysCount: String`
- `workHoursEnabled: String` — "1"/"0"
- `workStartHour: String` / `workEndHour: String` / `workDays: String`
- `habitsSuccessWindow: String` — "7"/"30"/"90"/"all"
- `defaultShowHabitsOnCalendar: String` — "1"/"0"
- `projectsShowChildCount: String` — "1"/"0"
- `projectsShowChecklistCount: String` — "1"/"0"
- `mapAutoZoom: String` — "1"/"0"
- `mapDefaultLat: String` / `mapDefaultLon: String` / `mapDefaultZoom: String`

**Email Tab additions:**
- `emailExternalContent: String` — "allow"/"block"/"known_senders"
- `emailReadReceipts: String` — "never"/"always"/"ask"/"contacts_only"
- `emailSignature: String` — markdown content
- `emailCheckInterval: String` — "manual"/"5"/"15"/"30"/"60"
- `emailMaxPull: String` — 1-1000
- `emailGroupBy: String` — "date"/"none"
- `bundlesShowCount: String` — "both"/"unread"/"total"/"none"
- `badgeDetectors: String` — JSON array of custom detector objects

**Admin Tab additions:**
- `instanceName: String`
- `welcomeMessage: String`
- `sessionLifetime: String` — "1"/"12"/"24"/"168"/"720"/"never"
- `kioskSelectedTags: String` — JSON array
- `auditLogPruningEnabled: String` — "1"/"0"
- `auditLogMaxDays: String`
- `auditLogMaxMb: String`
- `attachmentMaxSizeMb: String` — "5"/"10"/"25"/"50"
- `attachmentMaxStorageMb: String` — "100"/"250"/"500"/"1024"/"2048"/"5120"/"0" (unlimited)
- `tailscaleEnabled: String` / `tailscaleAuthKey: String`
- `ntfyEnabled: String`
- `haEnabled: String` / `haUrl: String` / `haToken: String` / `haPollInterval: String`

### CollapsibleSection Composable

A new reusable composable for collapsible settings sections:

```kotlin
@Composable
fun CollapsibleSection(
    title: String,
    sectionId: String,  // unique key for SharedPreferences persistence
    defaultExpanded: Boolean = true,
    content: @Composable () -> Unit
)
```

- Renders a header row with title text and a chevron icon (▼ expanded, ▶ collapsed)
- Tapping header or chevron toggles visibility of `content`
- Persists state to SharedPreferences keyed as `"settings_section_$sectionId"`
- Defaults to expanded on first use

### DragGrid Composable

A new composable for the clocks drag-reorder grid and Omni layout configurator:

```kotlin
@Composable
fun DragGrid(
    items: List<DragItem>,
    onReorder: (List<DragItem>) -> Unit,
    columns: Int = 2,
    orientation: DragGridOrientation = DragGridOrientation.HORIZONTAL
)

data class DragItem(
    val id: String,
    val label: String,
    val zone: DragZone  // ACTIVE or INACTIVE
)

enum class DragGridOrientation { HORIZONTAL, VERTICAL }
```

- Supports long-press to initiate drag
- Items can be dragged between Active and Inactive zones
- Items can be reordered within the Active zone
- Calls `onReorder` with the new item list after each drag completes

### CustomFilterModal

A full-screen dialog for per-view custom filter configuration:

```kotlin
@Composable
fun CustomFilterModal(
    viewName: String,
    currentFilter: CustomViewFilter?,
    availableTags: List<TagItem>,
    availableContacts: List<ContactItem>,
    availableProjects: List<ProjectItem>,
    onDone: (CustomViewFilter?) -> Unit,  // null means reset to defaults
    onCancel: () -> Unit
)

data class CustomViewFilter(
    val filterText: String = "",
    val sortField: String? = null,
    val sortDirection: String = "asc",
    val statuses: List<String> = emptyList(),
    val priorities: List<String> = emptyList(),
    val tags: List<String> = emptyList(),
    val people: List<String> = emptyList(),
    val project: String? = null,
    val displayToggles: Map<String, Boolean> = emptyMap()
)
```

### OmniLayoutModal

A full-screen dialog for arranging Omni View sections:

```kotlin
@Composable
fun OmniLayoutModal(
    currentLayout: OmniLayout,
    onDone: (OmniLayout) -> Unit,
    onCancel: () -> Unit
)

data class OmniLayout(
    val fullWidth: List<String> = emptyList(),
    val leftColumn: List<String> = emptyList(),
    val rightColumn: List<String> = emptyList(),
    val unused: List<String> = emptyList()
)
```

### SignatureEditorModal

A dialog for editing the email signature with markdown support:

```kotlin
@Composable
fun SignatureEditorModal(
    currentSignature: String,
    onConfirm: (String) -> Unit,
    onDismiss: () -> Unit
)
```

- Text editor area with markdown content
- Live-rendered preview below using `MarkdownRenderer`
- Bold/Italic/Link toolbar buttons that wrap selected text
- Confirm saves, Dismiss discards

### UpgradeModal

A dialog for the server upgrade process with SSE log streaming:

```kotlin
@Composable
fun UpgradeModal(
    mode: UpgradeModalMode,  // UPGRADE or VIEW_LOG
    onDismiss: () -> Unit
)

enum class UpgradeModalMode { UPGRADE, VIEW_LOG }
```

- Terminal-style scrollable log area (monospace font, dark background)
- Start button connects to `/api/update/run` via SSE
- Auto-scrolls as new lines arrive
- Copy button copies log text to clipboard

### API Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/settings/{user_id}` | GET | Load all settings |
| `/api/settings` | POST | Save settings (partial update) |
| `/api/email/test-connection` | POST | Test email IMAP/SMTP |
| `/api/network-access/ntfy/test` | POST | Test ntfy notification |
| `/api/network-access/ntfy/enable` | POST | Enable ntfy |
| `/api/network-access/ntfy/disable` | POST | Disable ntfy |
| `/api/network-access/ntfy/status` | GET | Get ntfy status |
| `/api/network-access/tailscale/status` | GET | Get Tailscale status |
| `/api/network-access/tailscale/connect` | POST | Connect Tailscale |
| `/api/network-access/tailscale/disconnect` | POST | Disconnect Tailscale |
| `/api/network-access/tailscale/config` | POST | Save Tailscale config |
| `/api/network-access/ha/config` | POST | Save HA config |
| `/api/network-access/ha/test` | POST | Test HA connection |
| `/api/network-access/ha/webhook-regenerate` | POST | Regenerate webhook |
| `/api/disk-usage` | GET | Get disk usage stats |
| `/api/version` | GET | Get server version |
| `/api/update/run` | GET (SSE) | Stream upgrade logs |
| `/api/update/log` | GET | Get last upgrade log |
| `/api/restart` | POST | Restart CWOC service |
| `/api/release-notes` | GET | Get release notes |
| `/api/export/chits` | GET | Export chit data |
| `/api/export/users` | GET | Export user data |
| `/api/export/all` | GET | Export all data |
| `/api/import` | POST | Import data |
| `/api/bundles` | GET | List email bundles |
| `/api/bundles/{id}/disable` | POST | Disable a bundle |
| `/api/bundles/{id}/enable` | POST | Enable a bundle |

## Data Models

### SettingsEntity (Room) — Migration 7→8

New columns to add via `Migration7To8`:

```kotlin
// General tab
@ColumnInfo(name = "default_share_contacts") val defaultShareContacts: String? = null,
@ColumnInfo(name = "clock_orientation") val clockOrientation: String? = null,
@ColumnInfo(name = "landing_view") val landingView: String? = null,
@ColumnInfo(name = "hidden_views") val hiddenViews: String? = null,
@ColumnInfo(name = "checklist_autosave") val checklistAutosave: String? = null,
@ColumnInfo(name = "autosave_desktop") val autosaveDesktop: String? = null,
@ColumnInfo(name = "autosave_mobile") val autosaveMobile: String? = null,
@ColumnInfo(name = "show_map_thumbnails") val showMapThumbnails: String? = null,
@ColumnInfo(name = "prefer_google_maps") val preferGoogleMaps: String? = null,
@ColumnInfo(name = "show_tab_counts") val showTabCounts: String? = null,
@ColumnInfo(name = "combine_alerts") val combineAlerts: String? = null,

// Views tab
@ColumnInfo(name = "projects_show_child_count") val projectsShowChildCount: String? = null,
@ColumnInfo(name = "projects_show_checklist_count") val projectsShowChecklistCount: String? = null,

// Email tab
@ColumnInfo(name = "email_check_interval") val emailCheckInterval: String? = null,
@ColumnInfo(name = "email_max_pull") val emailMaxPull: String? = null,
@ColumnInfo(name = "email_signature") val emailSignature: String? = null,
@ColumnInfo(name = "email_bundles_count_display") val emailBundlesCountDisplay: String? = null,

// Admin tab
@ColumnInfo(name = "instance_name") val instanceName: String? = null,
@ColumnInfo(name = "welcome_message") val welcomeMessage: String? = null,
@ColumnInfo(name = "audit_log_pruning_enabled") val auditLogPruningEnabled: String? = null,
@ColumnInfo(name = "tailscale_enabled") val tailscaleEnabled: String? = null,
@ColumnInfo(name = "tailscale_auth_key") val tailscaleAuthKey: String? = null,
@ColumnInfo(name = "ntfy_enabled") val ntfyEnabled: String? = null,
@ColumnInfo(name = "ha_enabled") val haEnabled: String? = null,
@ColumnInfo(name = "ha_poll_interval") val haPollInterval: String? = null,
@ColumnInfo(name = "kiosk_selected_tags") val kioskSelectedTags: String? = null,
```

The migration SQL uses `ALTER TABLE settings ADD COLUMN ... TEXT DEFAULT NULL` wrapped in try/catch for idempotency.

### API Payload Mapping

The Android client must produce JSON payloads with **identical key names** to the web client. Key mappings:

| Android FormState field | API JSON key | Type |
|------------------------|--------------|------|
| `timeFormat` | `time_format` | string: "24hour"/"12hour"/"metric" |
| `sex` | `sex` | string: "man"/"woman" |
| `snoozeLength` | `snooze_length` | string: "1"/"3"/"5"/"10" |
| `calendarSnapInterval` | `calendar_snap` | string: "0"/"5"/"10"/"15"/"20"/"25"/"30"/"60" |
| `defaultTimezone` | `default_timezone` | string: IANA timezone |
| `timezoneOverride` | `timezone_override` | string: IANA timezone or "" |
| `defaultShareContacts` | `default_share_contacts` | string: "1"/"0" |
| `activeClocks` | `active_clocks` | JSON array of clock type strings |
| `clockOrientation` | `alarm_orientation` | string: "horizontal"/"vertical" |
| `landingView` | `default_view` | string: view name |
| `viewOrder` | `view_order` | JSON array of view names |
| `chitOptions` | `chit_options` | JSON object |
| `visualIndicators` | `visual_indicators` | JSON object |
| `customViewFilters` | `custom_view_filters` | JSON object keyed by view |
| `weekStartDay` | `week_start_day` | string: "sun"/"mon"/..."sat" |
| `allViewStartHour` | `all_view_start_hour` | string: "0"-"23" |
| `allViewEndHour` | `all_view_end_hour` | string: "0"-"23" |
| `dayScrollToHour` | `day_scroll_to_hour` | string: "0"-"12" |
| `customDaysCount` | `custom_days_count` | string: "2"-"30" |
| `workStartHour` | `work_start_hour` | string: "0"-"23" |
| `workEndHour` | `work_end_hour` | string: "0"-"23" |
| `workDays` | `work_days` | string: comma-separated day abbreviations |
| `habitsSuccessWindow` | `habits_success_window` | string: "7"/"30"/"90"/"all" |
| `defaultShowHabitsOnCalendar` | `default_show_habits_on_calendar` | string: "1"/"0" |
| `projectsShowChildCount` | `projects_show_child_count` | string: "1"/"0" |
| `projectsShowChecklistCount` | `projects_show_checklist_count` | string: "1"/"0" |
| `mapAutoZoom` | `map_auto_zoom` | string: "1"/"0" |
| `mapDefaultLat` | `map_default_lat` | string: decimal |
| `mapDefaultLon` | `map_default_lon` | string: decimal |
| `mapDefaultZoom` | `map_default_zoom` | string: "1"-"18" |
| `omniHstClockMode` | `omni_hst_clock_mode` | string: "both"/"hst"/"system" |
| `omniLayout` | `omni_layout` | JSON object |
| `omniEmailCount` | `omni_email_count` | string: "3"/"5"/"10"/"15"/"20" |
| `omniNormalizeColors` | `omni_normalize_colors` | string: "colored"/"normalized"/"mono" |
| `omniLockedFilters` | `omni_locked_filters` | JSON array |
| `emailExternalContent` | `email_external_content` | string: "allow"/"block"/"known_senders" |
| `emailReadReceipts` | `email_read_receipts` | string: "never"/"always"/"ask"/"contacts_only" |
| `emailSignature` | `email_signature` | string: markdown |
| `emailCheckInterval` | `email_check_interval` | string: "manual"/"5"/"15"/"30"/"60" |
| `emailMaxPull` | `email_max_pull` | string: "1"-"1000" |
| `emailGroupBy` | `email_group_by` | string: "date"/"none" |
| `bundlesShowCount` | `bundles_show_count` | string: "both"/"unread"/"total"/"none" |
| `instanceName` | `instance_name` | string |
| `welcomeMessage` | `welcome_message` | string: markdown |
| `sessionLifetime` | `session_lifetime` | string: "1"/"12"/"24"/"168"/"720"/"never" |
| `auditLogPruningEnabled` | `audit_log_pruning_enabled` | string: "1"/"0" |
| `auditLogMaxDays` | `audit_log_max_days` | string: "1"-"9999" |
| `auditLogMaxMb` | `audit_log_max_mb` | string: "1"-"99999" |
| `attachmentMaxSizeMb` | `attachment_max_size_mb` | string: "5"/"10"/"25"/"50" |
| `attachmentMaxStorageMb` | `attachment_max_storage_mb` | string: "100"/"250"/"500"/"1024"/"2048"/"5120"/"0" |
| `tags` | `tags` | JSON array of tag objects |
| `overdueBorderColor` | `overdue_border_color` | string: hex color |
| `blockedBorderColor` | `blocked_border_color` | string: hex color |

### Unsupported Field Preservation

Per Requirement 31.4, when saving, the Android client must preserve any fields from the server response that it doesn't understand. Implementation:

1. On load, store the raw JSON response as `_rawServerSettings: Map<String, Any?>`
2. On save, start with `_rawServerSettings`, overlay only the fields the Android client manages
3. POST the merged payload — this ensures web-only fields are never lost

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Dirty state derivation is consistent

*For any* two `SettingsFormState` instances (current and saved snapshot), the `isDirty` flag SHALL be `true` if and only if at least one field in the current state differs from the corresponding field in the saved snapshot.

**Validates: Requirements 1.1, 1.2, 1.7**

### Property 2: Settings serialization round-trip

*For any* valid `SettingsFormState`, converting it to the API JSON payload via `mapFormStateToPayload()` and then parsing that payload back via `mapPayloadToFormState()` SHALL produce a `SettingsFormState` that is equal to the original (no data loss or type coercion differences).

**Validates: Requirements 31.1, 31.2, 31.5, 31.6**

### Property 3: Nearest valid option mapping

*For any* integer value, the `nearestValidOption(value, validOptions)` function SHALL return the largest valid option that is less than or equal to the input value, or the first valid option if no valid option is less than or equal to the input.

**Validates: Requirements 2.4**

### Property 4: Hour range validation

*For any* pair of hour values (start, end) where both are integers in 0-23, the `validateHourRange(start, end)` function SHALL return an error if and only if start >= end.

**Validates: Requirements 11.3, 11.8**

### Property 5: Map coordinate validation

*For any* numeric value, the latitude validator SHALL reject values outside [-90, 90], the longitude validator SHALL reject values outside [-180, 180], and the zoom validator SHALL reject values outside [1, 18].

**Validates: Requirements 14.2, 14.3, 14.4, 14.7**

### Property 6: Visual indicator visibility derivation

*For any* visual indicators state and combine_alerts flag, when combine_alerts is true the visible rows SHALL be exactly {Combined Alerts, Weather, People, Indicators, Custom Data}, and when combine_alerts is false the visible rows SHALL be exactly {Alarm, Notification, Timer, Stopwatch, Weather, People, Indicators, Custom Data}.

**Validates: Requirements 8.3, 8.4**

### Property 7: Custom filter serialization round-trip

*For any* valid `CustomViewFilter` object, serializing it to JSON and deserializing back SHALL produce an equivalent `CustomViewFilter` object.

**Validates: Requirements 9.2, 9.3**

### Property 8: Email max pull validation

*For any* string input, the max pull validator SHALL accept the input if and only if it parses to an integer in the range [1, 1000].

**Validates: Requirements 18.1, 18.2**

### Property 9: Badge detector validation

*For any* combination of detector field values (name, category, keywords, regex, urlTemplate, buttonLabel), the validator SHALL reject the input if name is empty, regex is empty, regex has invalid syntax, urlTemplate is empty, or urlTemplate does not contain the literal text "{code}".

**Validates: Requirements 21.7**

### Property 10: Unsupported field preservation

*For any* raw server settings JSON containing fields not managed by the Android client, after a save operation the resulting POST payload SHALL contain all those unmanaged fields with their original values unchanged.

**Validates: Requirements 31.4**

## Error Handling

### Network Errors

- **Save failure:** Display error toast with message from server or "Network error — changes not saved". Retain all form values. Keep save buttons in enabled/dirty state. Do not revert fields.
- **Load failure:** Display error toast. Show last-cached settings from Room if available. If no cached settings exist, show empty form with defaults.
- **Test connection failure (email, HA, ntfy):** Display inline error message below the test button with the failure reason. Re-enable the test button.
- **Upgrade SSE failure:** Display "Connection lost" in the terminal area. Re-enable Start and Close buttons.

### Validation Errors

- **Invalid timezone:** Display error toast "Invalid timezone: '{value}' is not recognized" and prevent save. Highlight the field.
- **Invalid hour range:** Display inline error below the field "Start hour must be earlier than end hour". Prevent save.
- **Invalid map coordinates:** Clear the invalid field to empty before saving (silent correction per Requirement 14.7).
- **Invalid email max pull:** Display inline error "Valid range: 1–1000". Prevent save.
- **Invalid badge detector:** Display inline error indicating the specific validation failure. Prevent save of that detector.

### State Recovery

- **Back navigation with dirty state:** Show confirmation dialog (Save / Discard / Cancel). Save persists then navigates. Discard reverts to snapshot then navigates. Cancel dismisses dialog.
- **Process death:** Room persists the last-saved state. On recreation, form loads from Room (not from unsaved edits). This is acceptable — unsaved edits are lost on process death, matching web behavior (browser refresh loses unsaved changes).

## Testing Strategy

**Unit tests (example-based):**
- Verify each dropdown has the correct option set and order
- Verify default values match web defaults
- Verify UI state derivation (button visibility based on dirty flag)
- Verify field mapping between FormState, Entity, and API payload
- Verify validation functions for edge cases (empty strings, boundary values)

**Integration tests:**
- Verify save/load round-trip through SettingsRepository
- Verify API payload matches web client format
- Verify deep-link navigation selects correct tab and scrolls to section
- Verify dependent app operations (mock API responses)

**Property-based tests (using kotlin-test + kotest-property):**
- Minimum 100 iterations per property
- Tag format: **Feature: android-settings-parity, Property {N}: {title}**
- Properties 1-10 as defined in Correctness Properties section above
- Focus on serialization round-trips, validation functions, and state derivation logic

**Manual verification:**
- Compare field-for-field against web settings page
- Verify drag-and-drop interactions (clocks, Omni layout, arrange views)
- Verify collapsible section state persists across app restarts
- Verify unsupported field preservation (save on Android, verify on web)
