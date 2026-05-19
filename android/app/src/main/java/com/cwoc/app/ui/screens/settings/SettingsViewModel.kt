package com.cwoc.app.ui.screens.settings

import android.content.SharedPreferences
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cwoc.app.data.local.entity.SettingsEntity
import com.cwoc.app.data.mapper.SettingsPayloadMapper
import com.cwoc.app.data.remote.BundleDto
import com.cwoc.app.data.remote.CwocApiService
import com.cwoc.app.data.repository.SettingsRepository
import com.cwoc.app.data.repository.SyncRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Form state holding all editable settings fields as strings.
 * Maps to the SettingsEntity fields for persistence.
 * Expanded to ~120+ fields covering every setting for full web parity.
 */
data class SettingsFormState(
    // ═══════════════════════════════════════════════════════════════════
    // GENERAL TAB
    // ═══════════════════════════════════════════════════════════════════

    // --- General Section ---
    val timeFormat: String = "12hour",
    val sex: String = "man",
    val snoozeLength: String = "5",
    val calendarSnapInterval: String = "15",
    val defaultTimezone: String = "America/New_York",
    val unitSystem: String = "imperial",
    val defaultShareContacts: String = "0",

    // --- Clocks Section ---
    val timeFormatDisplay: String = "12hour",
    val clockOrientation: String = "horizontal",
    val activeClocks: String = "[\"12 Hour\"]",
    val timezoneOverride: String = "",

    // --- Display Options Section ---
    val landingView: String = "Calendar",
    val viewOrder: String = "[\"Calendar\",\"Checklists\",\"Alarms\",\"Projects\",\"Tasks\",\"Notes\",\"Email\",\"Indicators\"]",
    val hiddenViews: String = "[]",
    val enabledPeriods: String = "Day,Week,Month",

    // --- Chit Options Section ---
    val chitOptions: String = "{\"checklist_autosave\":false,\"auto_save_desktop\":false,\"auto_save_mobile\":false,\"fade_past_chits\":true,\"highlight_overdue_chits\":true,\"highlight_blocked_chits\":true,\"delete_past_alarm_chits\":false,\"show_tab_counts\":false,\"prefer_google_maps\":false,\"show_map_thumbnails\":false,\"hide_declined\":false}",

    // --- Visual Indicators Section ---
    val visualIndicators: String = "{\"alarm\":\"always\",\"notification\":\"always\",\"timer\":\"always\",\"stopwatch\":\"always\",\"combined_alert\":\"always\",\"weather\":\"always\",\"people\":\"always\",\"indicators\":\"always\",\"custom_data\":\"always\",\"combine_alerts\":false}",
    val combineAlerts: String = "0",

    // --- Custom Filters Section ---
    val customViewFilters: String = "{}",

    // ═══════════════════════════════════════════════════════════════════
    // VIEWS TAB
    // ═══════════════════════════════════════════════════════════════════

    // --- Omni View Section ---
    val omniHstClockMode: String = "both",
    val omniLayout: String = "{}",
    val omniBundleToggles: String = "{}",
    val omniEmailCount: String = "3",
    val omniNormalizeColors: String = "colored",
    val omniLockedFilters: String = "[]",

    // --- Calendar Section ---
    val weekStartDay: String = "sun",
    val allViewStartHour: String = "0",
    val allViewEndHour: String = "23",
    val dayScrollToHour: String = "8",
    val customDaysCount: String = "7",
    val workHoursEnabled: String = "0",
    val workStartHour: String = "9",
    val workEndHour: String = "17",
    val workDays: String = "mon,tue,wed,thu,fri",

    // --- Habits Section ---
    val habitsSuccessWindow: String = "30",
    val defaultShowHabitsOnCalendar: String = "1",

    // --- Projects Section ---
    val projectsShowChildCount: String = "0",
    val projectsShowChecklistCount: String = "0",

    // --- Maps Section ---
    val mapAutoZoom: String = "1",
    val mapDefaultLat: String = "",
    val mapDefaultLon: String = "",
    val mapDefaultZoom: String = "",

    // ═══════════════════════════════════════════════════════════════════
    // COLLECTIONS TAB
    // ═══════════════════════════════════════════════════════════════════
    val sharedTags: String = "[]",
    val customColors: String = "[]",
    val savedLocations: String = "[]",
    val defaultNotifications: String = "{\"start_notifications\":[],\"due_notifications\":[]}",
    val overdueBorderColor: String = "",
    val blockedBorderColor: String = "",

    // ═══════════════════════════════════════════════════════════════════
    // EMAIL TAB
    // ═══════════════════════════════════════════════════════════════════

    // --- Account & Syncing ---
    val emailAccounts: String = "[]",
    val emailSyncInterval: String = "15",
    val emailCheckInterval: String = "15",
    val emailMaxPull: String = "100",
    val emailBackfill: String = "false",

    // --- Privacy & Sending ---
    val emailBlockTracking: String = "true",
    val emailExternalContent: String = "allow",
    val emailReadReceipts: String = "never",
    val emailUndoSendDelay: String = "10",
    val emailSignature: String = "",

    // --- Display ---
    val emailMaxAttachmentSize: String = "25",
    val emailGroupBy: String = "date",
    val emailPaginate: String = "true",
    val emailPageSize: String = "50",

    // --- Bundles ---
    val emailBundlesEnabled: String = "true",
    val emailMultiPlacement: String = "false",
    val bundlesShowCount: String = "both",
    val emailAutoBundles: String = "[]",

    // --- Badges (merged into Email tab) ---
    val badgeMaxPerEmail: String = "3",
    val badgeDetectors: String = "[]",

    // ═══════════════════════════════════════════════════════════════════
    // ADMIN TAB
    // ═══════════════════════════════════════════════════════════════════

    // --- Administration Section ---
    val instanceName: String = "",
    val welcomeMessage: String = "",
    val sessionLifetime: String = "24",

    // --- Tools (Kiosk) ---
    val kioskSelectedTags: String = "[]",

    // --- Data Management ---
    val auditLogPruningEnabled: String = "0",
    val auditLogMaxDays: String = "365",
    val auditLogMaxMb: String = "100",
    val attachmentMaxSizeMb: String = "25",
    val attachmentMaxStorageMb: String = "1024",

    // --- Dependent Apps (Tailscale) ---
    val tailscaleEnabled: String = "0",
    val tailscaleAuthKey: String = "",

    // --- Dependent Apps (Ntfy) ---
    val ntfyEnabled: String = "0",
    val ntfyServerUrl: String = "",
    val ntfyTopic: String = "",

    // --- Dependent Apps (Home Assistant) ---
    val haEnabled: String = "0",
    val haUrl: String = "",
    val haToken: String = "",
    val haPollInterval: String = "30",

    // --- Server / Legacy ---
    val serverUrl: String = "http://192.168.1.111:3333",

    // --- Deprecated fields kept for backward compat during migration ---
    val defaultView: String = "Calendar",
    val emailMaxPullCount: String = "100",
    val emailShowCount: String = "true"
)

/**
 * UI state for the email test connection operation.
 * Validates: Requirements 17.2, 17.3, 17.4, 17.5
 */
data class EmailTestConnectionUiState(
    val isTesting: Boolean = false,
    val imapResult: String? = null,
    val smtpResult: String? = null,
    val isSuccess: Boolean = false,
    val errorMessage: String? = null
)

/**
 * ViewModel for the Settings screen.
 * Loads settings from SettingsRepository into a SettingsFormState StateFlow on init.
 * Provides updateSetting() to modify local state and save() to persist, mark dirty, and sync.
 *
 * Validates: Requirements 2.6, 2.7
 */
@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val settingsRepository: SettingsRepository,
    private val syncRepository: SyncRepository,
    private val prefs: SharedPreferences,
    private val apiService: CwocApiService
) : ViewModel() {

    /** Exposed for composables that need direct API access (e.g., UpgradeModal, Version section). */
    val api: CwocApiService get() = apiService

    /** Auth token from SharedPreferences for API calls that need it directly. */
    val authToken: String get() = prefs.getString("auth_token", "") ?: ""

    private val _settings = MutableStateFlow(SettingsFormState())
    val settings: StateFlow<SettingsFormState> = _settings.asStateFlow()

    /** Snapshot of last-saved state for dirty comparison. */
    private val _savedSnapshot = MutableStateFlow(SettingsFormState())
    val savedSnapshot: StateFlow<SettingsFormState> = _savedSnapshot.asStateFlow()

    /**
     * Whether the current user is an admin. Used to conditionally show the Administration tab.
     * Reads from SharedPreferences "is_admin" key (stored during sync/auth).
     * Defaults to true if not set (preserves existing behavior where Admin tab is always shown).
     *
     * Validates: Requirements 29.3
     */
    private val _isAdmin = MutableStateFlow(prefs.getBoolean("is_admin", true))
    val isAdmin: StateFlow<Boolean> = _isAdmin.asStateFlow()

    /**
     * Derived dirty flag: true when current form state differs from the saved snapshot.
     * Validates: Requirements 1.1, 1.2, 1.7
     */
    val isDirty: StateFlow<Boolean> = combine(_settings, _savedSnapshot) { current, snapshot ->
        current != snapshot
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), false)

    /** One-shot navigation event emitted after saveAndExit() succeeds. */
    private val _navigateBack = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
    val navigateBack: SharedFlow<Unit> = _navigateBack.asSharedFlow()

    private val _isSaving = MutableStateFlow(false)
    val isSaving: StateFlow<Boolean> = _isSaving.asStateFlow()

    private val _saveError = MutableStateFlow<String?>(null)
    val saveError: StateFlow<String?> = _saveError.asStateFlow()

    /** Error message from settings load failure. Observed by UI to show error toast. */
    private val _loadError = MutableStateFlow<String?>(null)
    val loadError: StateFlow<String?> = _loadError.asStateFlow()

    /** Email bundles fetched from the server for Omni View bundle toggles. */
    private val _bundles = MutableStateFlow<List<BundleDto>>(emptyList())
    val bundles: StateFlow<List<BundleDto>> = _bundles.asStateFlow()

    /** Cached userId from the loaded entity, needed for saving back. */
    private var userId: String = "default_user"

    /** Public accessor for the user ID (needed for Ntfy topic derivation). */
    val currentUserId: String get() = userId

    /** Cached entity for fields we don't expose in the form state. */
    private var cachedEntity: SettingsEntity? = null

    /**
     * Raw server JSON stored on load. Used for unsupported field preservation:
     * on save, managed fields are merged over this map so web-only fields are never lost.
     *
     * Validates: Requirements 31.4, 31.5, 31.6
     */
    private var _rawServerSettings: Map<String, Any?> = emptyMap()

    /** Public read access to the raw server settings for external consumers (e.g., SyncPushEngine). */
    val rawServerSettings: Map<String, Any?> get() = _rawServerSettings

    /**
     * Stores the raw server JSON response on settings load.
     * Called by the sync engine or repository when settings are fetched from the API.
     */
    fun setRawServerSettings(raw: Map<String, Any?>) {
        _rawServerSettings = raw
    }

    /**
     * Produces the merged payload for saving to the server.
     * Overlays managed fields from the current form state over the raw server settings,
     * preserving any unrecognized/unsupported fields.
     *
     * Validates: Requirements 31.1, 31.4
     */
    fun buildSavePayload(): Map<String, Any?> {
        return SettingsPayloadMapper.mergePayload(_rawServerSettings, _settings.value)
    }

    init {
        loadSettings()
        loadBundles()
    }

    /**
     * Fetches email bundles from the server for Omni View bundle toggles and auto-bundles list.
     * Excludes "Everything Else" bundle per requirements 10.4, 20.3.
     */
    private fun loadBundles() {
        viewModelScope.launch {
            try {
                val response = apiService.getBundles()
                if (response.isSuccessful) {
                    val allBundles = response.body()?.bundles ?: emptyList()
                    // Exclude "Everything Else" bundle
                    _bundles.value = allBundles.filter {
                        it.name?.lowercase() != "everything else"
                    }
                }
            } catch (_: Exception) {
                // Silently fail — bundles list will remain empty
            }
        }
    }

    /**
     * Toggles an auto-bundle's enabled/disabled state via the server API.
     * On disable: calls POST /api/bundles/{id}/disable
     * On enable: calls POST /api/bundles/{id}/enable
     * Refreshes the bundles list after toggling.
     *
     * Validates: Requirement 20.5
     */
    fun toggleBundle(bundleId: String, enable: Boolean) {
        viewModelScope.launch {
            try {
                val response = if (enable) {
                    apiService.enableBundle(bundleId)
                } else {
                    apiService.disableBundle(bundleId)
                }
                if (response.isSuccessful) {
                    // Refresh bundles list to reflect the new state
                    loadBundles()
                }
            } catch (_: Exception) {
                // Silently fail — user can retry
            }
        }
    }

    /**
     * Loads settings from the repository and maps them into SettingsFormState.
     * On failure, shows error via _loadError and falls back to defaults (last-cached Room data
     * or SettingsFormState defaults if no cached data exists).
     *
     * Validates: Requirements 1.5 (load failure handling)
     */
    private fun loadSettings() {
        viewModelScope.launch {
            try {
                val entity = settingsRepository.get()
                if (entity != null) {
                    cachedEntity = entity
                    userId = entity.userId
                    val formState = mapEntityToFormState(entity)
                    _settings.value = formState
                    _savedSnapshot.value = formState
                }
                // If entity is null, form stays at defaults — this is the "no cached data" fallback
            } catch (e: Exception) {
                _loadError.value = e.message ?: "Failed to load settings"
                // Form remains at SettingsFormState defaults — acceptable fallback
            }
        }
    }

    /**
     * Updates a single setting field in the local form state by key.
     * Does NOT persist — call save() to write to Room and trigger sync.
     */
    fun updateSetting(key: String, value: String) {
        _settings.update { current ->
            when (key) {
                // --- General Tab: General Section ---
                "time_format" -> current.copy(timeFormat = value)
                "sex" -> current.copy(sex = value)
                "snooze_length" -> current.copy(snoozeLength = value)
                "calendar_snap_interval", "calendar_snap" -> current.copy(calendarSnapInterval = value)
                "default_timezone" -> current.copy(defaultTimezone = value)
                "unit_system" -> current.copy(unitSystem = value)
                "default_share_contacts" -> current.copy(defaultShareContacts = value)

                // --- General Tab: Clocks Section ---
                "time_format_display" -> current.copy(timeFormatDisplay = value)
                "clock_orientation", "alarm_orientation" -> current.copy(clockOrientation = value)
                "active_clocks" -> current.copy(activeClocks = value)
                "timezone_override" -> current.copy(timezoneOverride = value)

                // --- General Tab: Display Options ---
                "landing_view", "default_view" -> current.copy(landingView = value, defaultView = value)
                "view_order" -> current.copy(viewOrder = value)
                "hidden_views" -> current.copy(hiddenViews = value)
                "enabled_periods" -> current.copy(enabledPeriods = value)

                // --- General Tab: Chit Options ---
                "chit_options" -> current.copy(chitOptions = value)

                // --- General Tab: Visual Indicators ---
                "visual_indicators" -> current.copy(visualIndicators = value)
                "combine_alerts" -> current.copy(combineAlerts = value)

                // --- General Tab: Custom Filters ---
                "custom_view_filters" -> current.copy(customViewFilters = value)

                // --- Views Tab: Omni View ---
                "omni_hst_clock_mode" -> current.copy(omniHstClockMode = value)
                "omni_layout" -> current.copy(omniLayout = value)
                "omni_bundle_toggles" -> current.copy(omniBundleToggles = value)
                "omni_email_count" -> current.copy(omniEmailCount = value)
                "omni_normalize_colors" -> current.copy(omniNormalizeColors = value)
                "omni_locked_filters" -> current.copy(omniLockedFilters = value)

                // --- Views Tab: Calendar ---
                "week_start_day" -> current.copy(weekStartDay = value)
                "all_view_start_hour" -> current.copy(allViewStartHour = value)
                "all_view_end_hour" -> current.copy(allViewEndHour = value)
                "day_scroll_to_hour" -> current.copy(dayScrollToHour = value)
                "custom_days_count" -> current.copy(customDaysCount = value)
                "work_hours_enabled" -> current.copy(workHoursEnabled = value)
                "work_start_hour" -> current.copy(workStartHour = value)
                "work_end_hour" -> current.copy(workEndHour = value)
                "work_days" -> current.copy(workDays = value)

                // --- Views Tab: Habits ---
                "habits_success_window" -> current.copy(habitsSuccessWindow = value)
                "default_show_habits_on_calendar" -> current.copy(defaultShowHabitsOnCalendar = value)

                // --- Views Tab: Projects ---
                "projects_show_child_count" -> current.copy(projectsShowChildCount = value)
                "projects_show_checklist_count" -> current.copy(projectsShowChecklistCount = value)

                // --- Views Tab: Maps ---
                "map_auto_zoom" -> current.copy(mapAutoZoom = value)
                "map_default_lat" -> current.copy(mapDefaultLat = value)
                "map_default_lon" -> current.copy(mapDefaultLon = value)
                "map_default_zoom" -> current.copy(mapDefaultZoom = value)

                // --- Collections Tab ---
                "shared_tags" -> current.copy(sharedTags = value)
                "custom_colors" -> current.copy(customColors = value)
                "saved_locations" -> current.copy(savedLocations = value)
                "default_notifications" -> current.copy(defaultNotifications = value)
                "overdue_border_color" -> current.copy(overdueBorderColor = value)
                "blocked_border_color" -> current.copy(blockedBorderColor = value)

                // --- Email Tab: Account & Syncing ---
                "email_accounts" -> current.copy(emailAccounts = value)
                "email_sync_interval" -> current.copy(emailSyncInterval = value)
                "email_check_interval" -> current.copy(emailCheckInterval = value)
                "email_max_pull" -> current.copy(emailMaxPull = value)
                "email_max_pull_count" -> current.copy(emailMaxPullCount = value, emailMaxPull = value)
                "email_backfill" -> current.copy(emailBackfill = value)

                // --- Email Tab: Privacy & Sending ---
                "email_block_tracking" -> current.copy(emailBlockTracking = value)
                "email_external_content" -> current.copy(emailExternalContent = value)
                "email_read_receipts" -> current.copy(emailReadReceipts = value)
                "email_undo_send_delay" -> current.copy(emailUndoSendDelay = value)
                "email_signature" -> current.copy(emailSignature = value)

                // --- Email Tab: Display ---
                "email_max_attachment_size" -> current.copy(emailMaxAttachmentSize = value)
                "email_group_by" -> current.copy(emailGroupBy = value)
                "email_paginate" -> current.copy(emailPaginate = value)
                "email_page_size" -> current.copy(emailPageSize = value)

                // --- Email Tab: Bundles ---
                "email_bundles_enabled" -> current.copy(emailBundlesEnabled = value)
                "email_multi_placement" -> current.copy(emailMultiPlacement = value)
                "bundles_show_count" -> current.copy(bundlesShowCount = value)
                "email_show_count" -> current.copy(emailShowCount = value)
                "email_auto_bundles" -> current.copy(emailAutoBundles = value)

                // --- Email Tab: Badges ---
                "badge_max_per_email" -> current.copy(badgeMaxPerEmail = value)
                "badge_detectors" -> current.copy(badgeDetectors = value)

                // --- Admin Tab: Administration ---
                "instance_name" -> current.copy(instanceName = value)
                "welcome_message" -> current.copy(welcomeMessage = value)
                "session_lifetime" -> current.copy(sessionLifetime = value)

                // --- Admin Tab: Tools (Kiosk) ---
                "kiosk_selected_tags" -> current.copy(kioskSelectedTags = value)

                // --- Admin Tab: Data Management ---
                "audit_log_pruning_enabled" -> current.copy(auditLogPruningEnabled = value)
                "audit_log_max_days" -> current.copy(auditLogMaxDays = value)
                "audit_log_max_mb" -> current.copy(auditLogMaxMb = value)
                "attachment_max_size_mb" -> current.copy(attachmentMaxSizeMb = value)
                "attachment_max_storage_mb" -> current.copy(attachmentMaxStorageMb = value)

                // --- Admin Tab: Dependent Apps (Tailscale) ---
                "tailscale_enabled" -> current.copy(tailscaleEnabled = value)
                "tailscale_auth_key" -> current.copy(tailscaleAuthKey = value)

                // --- Admin Tab: Dependent Apps (Ntfy) ---
                "ntfy_enabled" -> current.copy(ntfyEnabled = value)
                "ntfy_server_url" -> current.copy(ntfyServerUrl = value)
                "ntfy_topic" -> current.copy(ntfyTopic = value)

                // --- Admin Tab: Dependent Apps (Home Assistant) ---
                "ha_enabled" -> current.copy(haEnabled = value)
                "ha_url" -> current.copy(haUrl = value)
                "ha_token" -> current.copy(haToken = value)
                "ha_poll_interval" -> current.copy(haPollInterval = value)

                // --- Server / Legacy ---
                "server_url" -> current.copy(serverUrl = value)

                else -> current
            }
        }
    }

    /**
     * Validates the current form state before saving.
     * Returns null if valid, or an error message string if validation fails.
     *
     * Validation rules:
     * - Timezone override: non-empty value must be a valid IANA timezone (Requirement 5.4)
     * - View hours: start must be less than end (Requirement 11.3)
     * - Work hours: start must be less than end when work hours enabled (Requirement 11.8)
     * - Email max pull: must be an integer in [1, 1000] (Requirement 18.2)
     * - Badge detectors: custom detectors must have non-empty name, non-empty regex,
     *   valid regex syntax, non-empty URL template, and URL template containing "{code}" (Requirement 21.7)
     *
     * Validates: Requirements 5.4, 11.3, 11.8, 18.2, 21.7
     */
    private fun validateSettings(formState: SettingsFormState): String? {
        // --- Timezone validation ---
        if (formState.timezoneOverride.isNotEmpty()) {
            val validTimezones = java.util.TimeZone.getAvailableIDs().toSet()
            if (formState.timezoneOverride !in validTimezones) {
                return "Invalid timezone: '${formState.timezoneOverride}' is not recognized"
            }
        }

        // --- View hours validation ---
        val viewStart = formState.allViewStartHour.toIntOrNull() ?: 0
        val viewEnd = formState.allViewEndHour.toIntOrNull() ?: 23
        if (viewStart >= viewEnd) {
            return "View Hours: start hour must be earlier than end hour"
        }

        // --- Work hours validation (only when work hours enabled) ---
        if (formState.workHoursEnabled == "1") {
            val workStart = formState.workStartHour.toIntOrNull() ?: 9
            val workEnd = formState.workEndHour.toIntOrNull() ?: 17
            if (workStart >= workEnd) {
                return "Work Hours: start hour must be earlier than end hour"
            }
        }

        // --- Email max pull validation ---
        val maxPull = formState.emailMaxPull.trim()
        if (maxPull.isEmpty()) {
            return "Email Max Pull: valid range is 1–1000"
        }
        val maxPullInt = maxPull.toIntOrNull()
        if (maxPullInt == null || maxPullInt < 1 || maxPullInt > 1000) {
            return "Email Max Pull: valid range is 1–1000"
        }

        // --- Badge detector validation ---
        val detectorError = validateBadgeDetectors(formState.badgeDetectors)
        if (detectorError != null) {
            return detectorError
        }

        return null
    }

    /**
     * Validates custom badge detectors JSON.
     * Returns null if valid, or an error message if any custom detector is invalid.
     *
     * Checks for each custom (non-built-in) detector:
     * - Name must not be empty
     * - Regex pattern must not be empty
     * - Regex pattern must be valid syntax
     * - URL template must not be empty (if the field exists)
     * - URL template must contain "{code}" (if the field exists)
     *
     * Validates: Requirement 21.7
     */
    private fun validateBadgeDetectors(detectorsJson: String): String? {
        if (detectorsJson.isEmpty() || detectorsJson == "[]") return null

        try {
            val array = org.json.JSONArray(detectorsJson)
            for (i in 0 until array.length()) {
                val obj = array.getJSONObject(i)
                val isBuiltIn = obj.optBoolean("built_in", false)
                if (isBuiltIn) continue  // Skip built-in detectors

                val name = obj.optString("name", "")
                val pattern = obj.optString("pattern", "")
                val urlTemplate = obj.optString("url_template", "")

                if (name.isBlank()) {
                    return "Badge Detector: name cannot be empty"
                }

                if (pattern.isBlank()) {
                    return "Badge Detector '$name': regex pattern cannot be empty"
                }

                // Validate regex syntax
                try {
                    Regex(pattern)
                } catch (e: Exception) {
                    return "Badge Detector '$name': invalid regex pattern — ${e.message}"
                }

                // URL template validation (only if the field is present in the JSON)
                if (obj.has("url_template")) {
                    if (urlTemplate.isBlank()) {
                        return "Badge Detector '$name': URL template cannot be empty"
                    }
                    if (!urlTemplate.contains("{code}")) {
                        return "Badge Detector '$name': URL template must contain \"{code}\""
                    }
                }
            }
        } catch (e: Exception) {
            // If JSON is malformed, allow save (the data will be treated as empty)
            return null
        }

        return null
    }

    /**
     * Persists the current form state to Room, marks the entity dirty,
     * and triggers a sync push via the repository.
     */
    fun save() {
        viewModelScope.launch {
            _isSaving.value = true
            _saveError.value = null
            try {
                val formState = sanitizeMapFields(_settings.value)
                // Run validation before saving
                val validationError = validateSettings(formState)
                if (validationError != null) {
                    _saveError.value = validationError
                    _isSaving.value = false
                    return@launch
                }
                _settings.value = formState
                val updatedEntity = mapFormStateToEntity(formState)
                // SettingsRepository.update() handles dirty marking and sync push
                settingsRepository.update(updatedEntity)
                // Update snapshot on successful save
                _savedSnapshot.value = formState
            } catch (e: Exception) {
                _saveError.value = e.message ?: "Failed to save settings"
            } finally {
                _isSaving.value = false
            }
        }
    }

    /**
     * Persists settings and stays on the screen.
     * On success, updates the saved snapshot so isDirty becomes false.
     * Validates: Requirements 1.3
     */
    fun saveAndStay() {
        viewModelScope.launch {
            _isSaving.value = true
            _saveError.value = null
            try {
                val formState = sanitizeMapFields(_settings.value)
                // Run validation before saving
                val validationError = validateSettings(formState)
                if (validationError != null) {
                    _saveError.value = validationError
                    _isSaving.value = false
                    return@launch
                }
                _settings.value = formState
                val updatedEntity = mapFormStateToEntity(formState)
                settingsRepository.update(updatedEntity)
                _savedSnapshot.value = formState
            } catch (e: Exception) {
                _saveError.value = e.message ?: "Failed to save settings"
            } finally {
                _isSaving.value = false
            }
        }
    }

    /**
     * Persists settings and signals navigation back to the previous screen.
     * On success, updates the saved snapshot and emits a navigateBack event.
     * Validates: Requirements 1.4
     */
    fun saveAndExit() {
        viewModelScope.launch {
            _isSaving.value = true
            _saveError.value = null
            try {
                val formState = sanitizeMapFields(_settings.value)
                // Run validation before saving
                val validationError = validateSettings(formState)
                if (validationError != null) {
                    _saveError.value = validationError
                    _isSaving.value = false
                    return@launch
                }
                _settings.value = formState
                val updatedEntity = mapFormStateToEntity(formState)
                settingsRepository.update(updatedEntity)
                _savedSnapshot.value = formState
                _navigateBack.tryEmit(Unit)
            } catch (e: Exception) {
                _saveError.value = e.message ?: "Failed to save settings"
            } finally {
                _isSaving.value = false
            }
        }
    }

    /**
     * Reverts the current form state to the last-saved snapshot.
     * isDirty becomes false immediately since settings == savedSnapshot.
     * Validates: Requirements 1.6, 1.7
     */
    fun discardChanges() {
        _settings.value = _savedSnapshot.value
    }

    /** Clears the save error after it has been shown to the user. */
    fun clearSaveError() {
        _saveError.value = null
    }

    /** Clears the load error after it has been shown to the user. */
    fun clearLoadError() {
        _loadError.value = null
    }

    /**
     * Sanitizes map coordinate/zoom fields before saving.
     * Clears invalid values to empty (silent correction per Requirement 14.7):
     * - Latitude must be a decimal in [-90, 90]
     * - Longitude must be a decimal in [-180, 180]
     * - Zoom must be an integer in [1, 18]
     *
     * Validates: Requirements 14.2, 14.3, 14.4, 14.7
     */
    private fun sanitizeMapFields(formState: SettingsFormState): SettingsFormState {
        val sanitizedLat = if (formState.mapDefaultLat.isNotEmpty()) {
            val lat = formState.mapDefaultLat.toDoubleOrNull()
            if (lat == null || lat < -90.0 || lat > 90.0) "" else formState.mapDefaultLat
        } else {
            formState.mapDefaultLat
        }

        val sanitizedLon = if (formState.mapDefaultLon.isNotEmpty()) {
            val lon = formState.mapDefaultLon.toDoubleOrNull()
            if (lon == null || lon < -180.0 || lon > 180.0) "" else formState.mapDefaultLon
        } else {
            formState.mapDefaultLon
        }

        val sanitizedZoom = if (formState.mapDefaultZoom.isNotEmpty()) {
            val zoom = formState.mapDefaultZoom.toIntOrNull()
            if (zoom == null || zoom < 1 || zoom > 18) "" else formState.mapDefaultZoom
        } else {
            formState.mapDefaultZoom
        }

        return formState.copy(
            mapDefaultLat = sanitizedLat,
            mapDefaultLon = sanitizedLon,
            mapDefaultZoom = sanitizedZoom
        )
    }

    // ─── Email Test Connection ──────────────────────────────────────────────────

    /**
     * Tests email IMAP/SMTP connectivity with the provided account credentials.
     * Returns the result via the callback with IMAP and SMTP status independently.
     *
     * Validates: Requirements 17.1, 17.2, 17.3, 17.4, 17.5
     */
    fun testEmailConnection(
        email: String,
        imapHost: String,
        imapPort: String,
        smtpHost: String,
        smtpPort: String,
        username: String,
        password: String,
        onResult: (EmailTestConnectionUiState) -> Unit
    ) {
        viewModelScope.launch {
            onResult(EmailTestConnectionUiState(isTesting = true))
            try {
                val config = mapOf<String, Any?>(
                    "email" to email,
                    "imap_host" to imapHost,
                    "imap_port" to imapPort,
                    "smtp_host" to smtpHost,
                    "smtp_port" to smtpPort,
                    "username" to username,
                    "password" to password
                )
                val response = apiService.testEmailConnection(config)
                if (response.isSuccessful) {
                    val body = response.body()
                    if (body != null) {
                        val imapStatus = if (body.imap?.success == true) "IMAP OK"
                            else "IMAP Failed: ${body.imap?.message ?: "Unknown error"}"
                        val smtpStatus = if (body.smtp?.success == true) "SMTP OK"
                            else "SMTP Failed: ${body.smtp?.message ?: "Unknown error"}"
                        val allSuccess = body.imap?.success == true && body.smtp?.success == true
                        onResult(EmailTestConnectionUiState(
                            isTesting = false,
                            imapResult = imapStatus,
                            smtpResult = smtpStatus,
                            isSuccess = allSuccess
                        ))
                    } else {
                        onResult(EmailTestConnectionUiState(
                            isTesting = false,
                            errorMessage = "Empty response from server"
                        ))
                    }
                } else {
                    val errorMsg = response.errorBody()?.string() ?: "Server error (${response.code()})"
                    onResult(EmailTestConnectionUiState(
                        isTesting = false,
                        errorMessage = errorMsg
                    ))
                }
            } catch (e: Exception) {
                onResult(EmailTestConnectionUiState(
                    isTesting = false,
                    errorMessage = e.message ?: "Network error"
                ))
            }
        }
    }

    // ─── Email Backfill ─────────────────────────────────────────────────────────

    private val _isBackfillInProgress = MutableStateFlow(false)
    val isBackfillInProgress: StateFlow<Boolean> = _isBackfillInProgress.asStateFlow()

    private val _backfillResultMessage = MutableStateFlow<String?>(null)
    val backfillResultMessage: StateFlow<String?> = _backfillResultMessage.asStateFlow()

    /**
     * Trigger a one-time email backfill: estimate first, then sync with backfill=true.
     * Shows progress indicator during the operation and result message on completion.
     */
    fun triggerBackfill() {
        viewModelScope.launch {
            _isBackfillInProgress.value = true
            _backfillResultMessage.value = "⏳ Estimating..."
            try {
                // Step 1: Estimate
                val estResponse = apiService.emailBackfillEstimate()
                if (!estResponse.isSuccessful) {
                    val errMsg = estResponse.errorBody()?.string() ?: "Estimation failed"
                    _backfillResultMessage.value = "❌ $errMsg"
                    _isBackfillInProgress.value = false
                    return@launch
                }

                // Step 2: Sync with backfill flag
                _backfillResultMessage.value = "⏳ Syncing..."
                val syncBody = mapOf<String, Any?>("backfill" to true)
                val syncResponse = apiService.emailSync(syncBody)
                if (syncResponse.isSuccessful) {
                    val body = syncResponse.body()
                    val newCount = body?.newCount ?: 0
                    val delCount = body?.deletedCount ?: 0
                    val parts = mutableListOf<String>()
                    if (newCount > 0) parts.add("$newCount imported")
                    if (delCount > 0) parts.add("$delCount removed")
                    val msg = if (parts.isNotEmpty()) parts.joinToString(", ") else "No new emails"
                    _backfillResultMessage.value = "✅ $msg"
                } else {
                    val errMsg = syncResponse.errorBody()?.string() ?: "Sync failed"
                    _backfillResultMessage.value = "❌ $errMsg"
                }
            } catch (e: Exception) {
                _backfillResultMessage.value = "❌ ${e.message ?: "Network error"}"
            } finally {
                _isBackfillInProgress.value = false
            }
        }
    }

    // ─── Tailscale Operations ────────────────────────────────────────────────────

    data class TailscaleUiState(
        val status: String = "unknown",  // "not_installed", "installed_inactive", "active", "error", "unknown"
        val ip: String = "",
        val hostname: String = "",
        val errorMessage: String? = null,
        val isLoading: Boolean = false,
        val feedbackMessage: String? = null,
        val feedbackType: String = "info",  // "success", "error", "warning", "info"
        val savedAuthKey: String = "",
        val savedEnabled: Boolean = false
    )

    private val _tailscaleState = MutableStateFlow(TailscaleUiState())
    val tailscaleState: StateFlow<TailscaleUiState> = _tailscaleState.asStateFlow()

    /**
     * Fetch and display the current Tailscale connection status.
     * Validates: Requirements 25.3, 25.4, 25.9
     */
    fun refreshTailscaleStatus() {
        viewModelScope.launch {
            _tailscaleState.update { it.copy(isLoading = true, feedbackMessage = "Checking Tailscale status...", feedbackType = "info") }
            try {
                val response = apiService.getTailscaleStatus()
                if (response.isSuccessful) {
                    val data = response.body()
                    val status = data?.status ?: "unknown"
                    _tailscaleState.update {
                        it.copy(
                            status = status,
                            ip = if (status == "active") (data?.ip ?: "") else "",
                            hostname = if (status == "active") (data?.hostname ?: "") else "",
                            errorMessage = if (status == "error" || status == "installed_inactive") data?.message else null,
                            isLoading = false,
                            feedbackMessage = when (status) {
                                "not_installed" -> "Tailscale is not installed on this server."
                                "installed_inactive" -> "Tailscale installed but not connected."
                                "active" -> "Connected — IP: ${data?.ip ?: "—"}"
                                "error" -> "Error: ${data?.message ?: "Unknown"}"
                                else -> null
                            },
                            feedbackType = when (status) {
                                "active" -> "success"
                                "error" -> "error"
                                else -> "info"
                            }
                        )
                    }
                } else {
                    _tailscaleState.update {
                        it.copy(
                            status = "error",
                            isLoading = false,
                            feedbackMessage = "Unable to check status.",
                            feedbackType = "error"
                        )
                    }
                }
            } catch (e: Exception) {
                _tailscaleState.update {
                    it.copy(
                        status = "error",
                        isLoading = false,
                        feedbackMessage = "Unable to check status: ${e.message}",
                        feedbackType = "error"
                    )
                }
            }
        }
    }

    /**
     * Save Tailscale configuration (auth key + enabled state) independently of main settings save.
     * Validates: Requirements 25.6, 25.8
     */
    fun saveTailscaleConfig(authKey: String, enabled: Boolean) {
        viewModelScope.launch {
            _tailscaleState.update { it.copy(isLoading = true) }
            try {
                val config = mapOf<String, Any?>(
                    "enabled" to enabled,
                    "config" to mapOf("auth_key" to authKey)
                )
                val response = apiService.saveTailscaleConfig(config)
                if (response.isSuccessful) {
                    _tailscaleState.update {
                        it.copy(
                            savedAuthKey = authKey,
                            savedEnabled = enabled,
                            isLoading = false
                        )
                    }
                    // Auto-refresh status after save
                    refreshTailscaleStatus()
                } else {
                    val errorMsg = response.errorBody()?.string() ?: "Save failed"
                    _tailscaleState.update {
                        it.copy(
                            isLoading = false,
                            feedbackMessage = "Failed to save config: $errorMsg",
                            feedbackType = "error"
                        )
                    }
                }
            } catch (e: Exception) {
                _tailscaleState.update {
                    it.copy(
                        isLoading = false,
                        feedbackMessage = "Failed to save config: ${e.message}",
                        feedbackType = "error"
                    )
                }
            }
        }
    }

    /**
     * Connect (bring up) Tailscale.
     * Validates: Requirements 25.7, 25.8
     */
    fun connectTailscale() {
        viewModelScope.launch {
            _tailscaleState.update { it.copy(isLoading = true) }
            try {
                val response = apiService.connectTailscale()
                if (response.isSuccessful) {
                    val data = response.body()
                    _tailscaleState.update {
                        it.copy(
                            isLoading = false,
                            feedbackMessage = data?.message ?: "Tailscale connected.",
                            feedbackType = "success"
                        )
                    }
                    // Auto-refresh status after connect
                    refreshTailscaleStatus()
                } else {
                    val errorBody = response.errorBody()?.string() ?: "Unknown error"
                    _tailscaleState.update {
                        it.copy(
                            isLoading = false,
                            feedbackMessage = "Connect failed: $errorBody",
                            feedbackType = "error"
                        )
                    }
                }
            } catch (e: Exception) {
                _tailscaleState.update {
                    it.copy(
                        isLoading = false,
                        feedbackMessage = "Connect failed: ${e.message}",
                        feedbackType = "error"
                    )
                }
            }
        }
    }

    /**
     * Disconnect (bring down) Tailscale.
     * Validates: Requirements 25.7, 25.8
     */
    fun disconnectTailscale() {
        viewModelScope.launch {
            _tailscaleState.update { it.copy(isLoading = true) }
            try {
                val response = apiService.disconnectTailscale()
                if (response.isSuccessful) {
                    val data = response.body()
                    _tailscaleState.update {
                        it.copy(
                            isLoading = false,
                            feedbackMessage = data?.message ?: "Tailscale disconnected.",
                            feedbackType = "warning"
                        )
                    }
                    // Auto-refresh status after disconnect
                    refreshTailscaleStatus()
                } else {
                    val errorBody = response.errorBody()?.string() ?: "Unknown error"
                    _tailscaleState.update {
                        it.copy(
                            isLoading = false,
                            feedbackMessage = "Disconnect failed: $errorBody",
                            feedbackType = "error"
                        )
                    }
                }
            } catch (e: Exception) {
                _tailscaleState.update {
                    it.copy(
                        isLoading = false,
                        feedbackMessage = "Disconnect failed: ${e.message}",
                        feedbackType = "error"
                    )
                }
            }
        }
    }

    /**
     * Initialize Tailscale saved state from the current form state.
     * Called when the Tailscale section is first expanded.
     */
    fun initTailscaleSavedState() {
        val current = _settings.value
        _tailscaleState.update {
            it.copy(
                savedAuthKey = current.tailscaleAuthKey,
                savedEnabled = current.tailscaleEnabled == "1"
            )
        }
    }

    // ─── Ntfy Configuration & Test ──────────────────────────────────────────────

    data class NtfyTestUiState(
        val isTesting: Boolean = false,
        val resultMessage: String? = null,
        val isSuccess: Boolean? = null  // null = no result yet, true = success, false = failure
    )

    data class NtfyUiState(
        val status: String = "unknown",  // "active", "disabled", "unreachable", "not_configured", "unknown"
        val isLoading: Boolean = false,
        val feedbackMessage: String? = null,
        val feedbackType: String = "info",  // "success", "error", "info"
        val isEnabling: Boolean = false,
        val isDisabling: Boolean = false,
        val tailscaleIp: String? = null  // Tailscale IP for secondary server URL
    )

    private val _ntfyTestState = MutableStateFlow(NtfyTestUiState())
    val ntfyTestState: StateFlow<NtfyTestUiState> = _ntfyTestState.asStateFlow()

    private val _ntfyState = MutableStateFlow(NtfyUiState())
    val ntfyState: StateFlow<NtfyUiState> = _ntfyState.asStateFlow()

    /**
     * Fetch the current Ntfy service status from the server.
     * Also checks Tailscale status for the secondary server URL.
     *
     * Validates: Requirements 26.3, 26.5, 26.11
     */
    fun refreshNtfyStatus() {
        viewModelScope.launch {
            _ntfyState.update { it.copy(isLoading = true, feedbackMessage = "Checking Ntfy status...", feedbackType = "info") }
            try {
                val response = apiService.getNtfyStatus()
                if (response.isSuccessful) {
                    val data = response.body()
                    val status = data?.status ?: "unknown"
                    _ntfyState.update {
                        it.copy(
                            status = status,
                            isLoading = false,
                            feedbackMessage = when (status) {
                                "active" -> "Ntfy service is running."
                                "disabled" -> "Ntfy notifications are disabled."
                                "unreachable" -> "Ntfy service unreachable: ${data?.message ?: "Connection failed"}"
                                "not_configured" -> "Ntfy is not configured yet."
                                else -> null
                            },
                            feedbackType = when (status) {
                                "active" -> "success"
                                "unreachable" -> "error"
                                else -> "info"
                            }
                        )
                    }
                } else {
                    _ntfyState.update {
                        it.copy(
                            status = "unknown",
                            isLoading = false,
                            feedbackMessage = "Unable to check status.",
                            feedbackType = "error"
                        )
                    }
                }
            } catch (e: Exception) {
                _ntfyState.update {
                    it.copy(
                        status = "unknown",
                        isLoading = false,
                        feedbackMessage = "Unable to check status: ${e.message ?: "Network error"}",
                        feedbackType = "error"
                    )
                }
            }

            // Also check Tailscale status for the secondary server URL
            try {
                val tsResponse = apiService.getTailscaleStatus()
                if (tsResponse.isSuccessful) {
                    val tsData = tsResponse.body()
                    if (tsData?.status == "active" && !tsData.ip.isNullOrEmpty()) {
                        _ntfyState.update { it.copy(tailscaleIp = tsData.ip) }
                    } else {
                        _ntfyState.update { it.copy(tailscaleIp = null) }
                    }
                }
            } catch (_: Exception) {
                // Tailscale not available — ignore
            }
        }
    }

    /**
     * Enable the Ntfy service.
     * Validates: Requirements 26.10
     */
    fun enableNtfy() {
        viewModelScope.launch {
            _ntfyState.update { it.copy(isEnabling = true, feedbackMessage = "Enabling Ntfy...", feedbackType = "info") }
            try {
                val response = apiService.enableNtfy()
                if (response.isSuccessful) {
                    val data = response.body()
                    if (data?.success == true) {
                        _ntfyState.update {
                            it.copy(
                                isEnabling = false,
                                feedbackMessage = "Ntfy notifications enabled.",
                                feedbackType = "success"
                            )
                        }
                        // Refresh status after enabling
                        refreshNtfyStatus()
                    } else {
                        _ntfyState.update {
                            it.copy(
                                isEnabling = false,
                                feedbackMessage = "Failed to enable: ${data?.message ?: "Unknown error"}",
                                feedbackType = "error"
                            )
                        }
                    }
                } else {
                    val errorMsg = response.errorBody()?.string() ?: "Server error"
                    _ntfyState.update {
                        it.copy(
                            isEnabling = false,
                            feedbackMessage = "Failed to enable: $errorMsg",
                            feedbackType = "error"
                        )
                    }
                }
            } catch (e: Exception) {
                _ntfyState.update {
                    it.copy(
                        isEnabling = false,
                        feedbackMessage = "Failed to enable: ${e.message ?: "Network error"}",
                        feedbackType = "error"
                    )
                }
            }
        }
    }

    /**
     * Disable the Ntfy service.
     * Validates: Requirements 26.9
     */
    fun disableNtfy() {
        viewModelScope.launch {
            _ntfyState.update { it.copy(isDisabling = true, feedbackMessage = "Disabling Ntfy...", feedbackType = "info") }
            try {
                val response = apiService.disableNtfy()
                if (response.isSuccessful) {
                    val data = response.body()
                    if (data?.success == true) {
                        _ntfyState.update {
                            it.copy(
                                isDisabling = false,
                                feedbackMessage = "Ntfy notifications disabled.",
                                feedbackType = "success"
                            )
                        }
                        // Refresh status after disabling
                        refreshNtfyStatus()
                    } else {
                        _ntfyState.update {
                            it.copy(
                                isDisabling = false,
                                feedbackMessage = "Failed to disable: ${data?.message ?: "Unknown error"}",
                                feedbackType = "error"
                            )
                        }
                    }
                } else {
                    val errorMsg = response.errorBody()?.string() ?: "Server error"
                    _ntfyState.update {
                        it.copy(
                            isDisabling = false,
                            feedbackMessage = "Failed to disable: $errorMsg",
                            feedbackType = "error"
                        )
                    }
                }
            } catch (e: Exception) {
                _ntfyState.update {
                    it.copy(
                        isDisabling = false,
                        feedbackMessage = "Failed to disable: ${e.message ?: "Network error"}",
                        feedbackType = "error"
                    )
                }
            }
        }
    }

    /**
     * Send a test push notification via ntfy.
     * POSTs to /api/network-access/ntfy/test and shows inline feedback.
     *
     * Validates: Requirements 26.7, 30.1, 30.2, 30.3, 30.4
     */
    fun testNtfyNotification() {
        viewModelScope.launch {
            _ntfyTestState.value = NtfyTestUiState(isTesting = true)
            try {
                val response = apiService.testNtfy()
                if (response.isSuccessful) {
                    val body = response.body()
                    if (body?.success == true) {
                        val topic = body.topic
                        val msg = if (topic != null) "✅ Notification sent to topic: $topic"
                            else "✅ Notification sent successfully"
                        _ntfyTestState.value = NtfyTestUiState(
                            isTesting = false,
                            resultMessage = msg,
                            isSuccess = true
                        )
                    } else {
                        val reason = body?.message ?: "Unknown error"
                        _ntfyTestState.value = NtfyTestUiState(
                            isTesting = false,
                            resultMessage = "❌ $reason",
                            isSuccess = false
                        )
                    }
                } else {
                    val errorMsg = response.errorBody()?.string() ?: "Server error (${response.code()})"
                    _ntfyTestState.value = NtfyTestUiState(
                        isTesting = false,
                        resultMessage = "❌ $errorMsg",
                        isSuccess = false
                    )
                }
            } catch (e: Exception) {
                _ntfyTestState.value = NtfyTestUiState(
                    isTesting = false,
                    resultMessage = "❌ ${e.message ?: "Network error"}",
                    isSuccess = false
                )
            }
        }
    }

    // ─── Home Assistant ────────────────────────────────────────────────────────

    data class HaUiState(
        val isLoading: Boolean = false,
        val haBaseUrl: String = "",
        val haAccessToken: String = "",
        val haPollInterval: String = "30",
        val webhookUrl: String = "",
        val feedbackMessage: String? = null,
        val feedbackType: String = "info",  // "success", "error", "info"
        val isTestingConnection: Boolean = false,
        val testResult: String? = null,
        val testSuccess: Boolean? = null,
        val isSaving: Boolean = false,
        val isRegenerating: Boolean = false
    )

    private val _haState = MutableStateFlow(HaUiState())
    val haState: StateFlow<HaUiState> = _haState.asStateFlow()

    /**
     * Fetch the current HA configuration from the server.
     * Called when the HA section is first expanded.
     * Validates: Requirements 27.3, 27.4, 27.5, 27.8
     */
    fun loadHaConfig() {
        viewModelScope.launch {
            _haState.update { it.copy(isLoading = true) }
            try {
                val response = apiService.getHaConfig()
                if (response.isSuccessful) {
                    val data = response.body()
                    val baseUrl = data?.haBaseUrl ?: ""
                    val pollInterval = data?.haPollInterval?.toString() ?: "30"
                    val webhookSecret = data?.haWebhookSecret ?: ""
                    // Build webhook URL from server URL + secret
                    val serverUrl = _settings.value.serverUrl.ifEmpty { "http://192.168.1.111:3333" }
                    val webhookUrl = if (webhookSecret.isNotEmpty()) {
                        "$serverUrl/api/ha/webhook/$webhookSecret"
                    } else ""

                    _haState.update {
                        it.copy(
                            isLoading = false,
                            haBaseUrl = baseUrl,
                            haAccessToken = "", // Token is masked from server, user must re-enter
                            haPollInterval = pollInterval,
                            webhookUrl = webhookUrl,
                            feedbackMessage = null
                        )
                    }
                } else {
                    _haState.update {
                        it.copy(
                            isLoading = false,
                            feedbackMessage = "Failed to load HA config.",
                            feedbackType = "error"
                        )
                    }
                }
            } catch (e: Exception) {
                _haState.update {
                    it.copy(
                        isLoading = false,
                        feedbackMessage = "Failed to load HA config: ${e.message}",
                        feedbackType = "error"
                    )
                }
            }
        }
    }

    /**
     * Test the Home Assistant connection.
     * POSTs to /api/ha/config/test and displays success or error within 10s.
     * Validates: Requirements 27.6
     */
    fun testHaConnection() {
        viewModelScope.launch {
            _haState.update { it.copy(isTestingConnection = true, testResult = null, testSuccess = null) }
            try {
                val response = apiService.testHaConnection()
                if (response.isSuccessful) {
                    val body = response.body()
                    if (body?.success == true) {
                        _haState.update {
                            it.copy(
                                isTestingConnection = false,
                                testResult = "✅ ${body.message ?: "Connection successful"}",
                                testSuccess = true
                            )
                        }
                    } else {
                        _haState.update {
                            it.copy(
                                isTestingConnection = false,
                                testResult = "❌ ${body?.message ?: "Connection failed"}",
                                testSuccess = false
                            )
                        }
                    }
                } else {
                    val errorMsg = response.errorBody()?.string() ?: "Server error (${response.code()})"
                    _haState.update {
                        it.copy(
                            isTestingConnection = false,
                            testResult = "❌ $errorMsg",
                            testSuccess = false
                        )
                    }
                }
            } catch (e: Exception) {
                _haState.update {
                    it.copy(
                        isTestingConnection = false,
                        testResult = "❌ ${e.message ?: "Network error"}",
                        testSuccess = false
                    )
                }
            }
        }
    }

    /**
     * Save HA configuration (URL, token, poll interval) independently of global save.
     * POSTs to /api/ha/config.
     * Validates: Requirements 27.7
     */
    fun saveHaConfig(baseUrl: String, accessToken: String, pollInterval: Int) {
        viewModelScope.launch {
            _haState.update { it.copy(isSaving = true, feedbackMessage = null) }
            try {
                val request = com.cwoc.app.data.remote.HaConfigRequest(
                    haBaseUrl = baseUrl,
                    haAccessToken = accessToken.ifEmpty { null },
                    haPollInterval = pollInterval
                )
                val response = apiService.saveHaConfig(request)
                if (response.isSuccessful) {
                    _haState.update {
                        it.copy(
                            isSaving = false,
                            haBaseUrl = baseUrl,
                            haPollInterval = pollInterval.toString(),
                            feedbackMessage = "✅ HA config saved successfully.",
                            feedbackType = "success"
                        )
                    }
                    // Also update the form state so dirty tracking stays in sync
                    updateSetting("ha_url", baseUrl)
                    updateSetting("ha_poll_interval", pollInterval.toString())
                } else {
                    val errorMsg = response.errorBody()?.string() ?: "Save failed"
                    _haState.update {
                        it.copy(
                            isSaving = false,
                            feedbackMessage = "❌ $errorMsg",
                            feedbackType = "error"
                        )
                    }
                }
            } catch (e: Exception) {
                _haState.update {
                    it.copy(
                        isSaving = false,
                        feedbackMessage = "❌ ${e.message ?: "Network error"}",
                        feedbackType = "error"
                    )
                }
            }
        }
    }

    /**
     * Regenerate the HA webhook secret.
     * POSTs to /api/ha/config/regenerate-webhook.
     * Validates: Requirements 27.9
     */
    fun regenerateHaWebhook() {
        viewModelScope.launch {
            _haState.update { it.copy(isRegenerating = true, feedbackMessage = null) }
            try {
                val response = apiService.regenerateHaWebhook()
                if (response.isSuccessful) {
                    val body = response.body()
                    val newSecret = body?.webhookSecret ?: ""
                    val serverUrl = _settings.value.serverUrl.ifEmpty { "http://192.168.1.111:3333" }
                    val newWebhookUrl = if (newSecret.isNotEmpty()) {
                        "$serverUrl/api/ha/webhook/$newSecret"
                    } else ""

                    _haState.update {
                        it.copy(
                            isRegenerating = false,
                            webhookUrl = newWebhookUrl,
                            feedbackMessage = "✅ Webhook secret regenerated.",
                            feedbackType = "success"
                        )
                    }
                } else {
                    val errorMsg = response.errorBody()?.string() ?: "Regeneration failed"
                    _haState.update {
                        it.copy(
                            isRegenerating = false,
                            feedbackMessage = "❌ $errorMsg",
                            feedbackType = "error"
                        )
                    }
                }
            } catch (e: Exception) {
                _haState.update {
                    it.copy(
                        isRegenerating = false,
                        feedbackMessage = "❌ ${e.message ?: "Network error"}",
                        feedbackType = "error"
                    )
                }
            }
        }
    }

    // ─── Sort Order Reset ───────────────────────────────────────────────────────

    private val _isResettingSortOrders = MutableStateFlow(false)
    val isResettingSortOrders: StateFlow<Boolean> = _isResettingSortOrders.asStateFlow()

    private val _sortOrderResetResult = MutableSharedFlow<Result<String>>(extraBufferCapacity = 1)
    val sortOrderResetResult: SharedFlow<Result<String>> = _sortOrderResetResult.asSharedFlow()

    /**
     * Resets all sort orders and manual item ordering for every view.
     * POSTs to /api/settings/reset-sort-orders, then clears local sort preferences.
     *
     * Validates: Requirements 6.4, 6.5
     */
    fun resetSortOrders() {
        viewModelScope.launch {
            _isResettingSortOrders.value = true
            try {
                val response = apiService.resetSortOrders()
                if (response.isSuccessful) {
                    // Clear any locally cached sort preferences from SharedPreferences
                    val editor = prefs.edit()
                    prefs.all.keys
                        .filter { it.startsWith("sort_") || it.startsWith("manual_order_") }
                        .forEach { editor.remove(it) }
                    editor.apply()
                    _sortOrderResetResult.tryEmit(Result.success("All sort orders have been reset"))
                } else {
                    val errorMsg = response.errorBody()?.string() ?: "Failed to reset sort orders"
                    _sortOrderResetResult.tryEmit(Result.failure(Exception(errorMsg)))
                }
            } catch (e: Exception) {
                _sortOrderResetResult.tryEmit(Result.failure(e))
            } finally {
                _isResettingSortOrders.value = false
            }
        }
    }

    /**
     * Maps a SettingsEntity from Room into the SettingsFormState for the UI.
     */
    private fun mapEntityToFormState(entity: SettingsEntity): SettingsFormState {
        return SettingsFormState(
            // --- General Tab: General Section ---
            timeFormat = entity.timeFormat ?: "12hour",
            sex = entity.sex ?: "man",
            snoozeLength = entity.snoozeLength ?: "5",
            calendarSnapInterval = entity.calendarSnap ?: "15",
            defaultTimezone = entity.defaultTimezone ?: "America/New_York",
            unitSystem = entity.unitSystem ?: "imperial",
            defaultShareContacts = entity.defaultShareContacts ?: "0",

            // --- General Tab: Clocks Section ---
            timeFormatDisplay = entity.timeFormat ?: "12hour",
            clockOrientation = entity.clockOrientation ?: entity.alarmOrientation ?: "horizontal",
            activeClocks = entity.activeClocks ?: "[\"12 Hour\"]",
            timezoneOverride = entity.timezoneOverride ?: "",

            // --- General Tab: Display Options ---
            landingView = entity.landingView ?: entity.defaultView ?: "Calendar",
            viewOrder = entity.viewOrder ?: "[\"Calendar\",\"Checklists\",\"Alarms\",\"Projects\",\"Tasks\",\"Notes\",\"Email\",\"Indicators\"]",
            hiddenViews = entity.hiddenViews ?: "[]",
            enabledPeriods = entity.enabledPeriods ?: "Day,Week,Month",

            // --- General Tab: Chit Options ---
            chitOptions = entity.chitOptions ?: "{\"checklist_autosave\":false,\"auto_save_desktop\":false,\"auto_save_mobile\":false,\"fade_past_chits\":true,\"highlight_overdue_chits\":true,\"highlight_blocked_chits\":true,\"delete_past_alarm_chits\":false,\"show_tab_counts\":false,\"prefer_google_maps\":false,\"show_map_thumbnails\":false,\"hide_declined\":false}",

            // --- General Tab: Visual Indicators ---
            visualIndicators = entity.visualIndicators ?: "{\"alarm\":\"always\",\"notification\":\"always\",\"timer\":\"always\",\"stopwatch\":\"always\",\"combined_alert\":\"always\",\"weather\":\"always\",\"people\":\"always\",\"indicators\":\"always\",\"custom_data\":\"always\",\"combine_alerts\":false}",
            combineAlerts = entity.combineAlerts ?: "0",

            // --- General Tab: Custom Filters ---
            customViewFilters = entity.customViewFilters ?: "{}",

            // --- Views Tab: Omni View ---
            omniHstClockMode = entity.omniHstClockMode ?: "both",
            omniLayout = entity.omniLayout ?: "{}",
            omniBundleToggles = "{}",  // Not stored in entity; derived from bundles API
            omniEmailCount = entity.omniEmailCount ?: "3",
            omniNormalizeColors = entity.omniNormalizeColors ?: "colored",
            omniLockedFilters = entity.omniLockedFilters ?: "[]",

            // --- Views Tab: Calendar ---
            weekStartDay = entity.weekStartDay ?: "sun",
            allViewStartHour = entity.allViewStartHour ?: "0",
            allViewEndHour = entity.allViewEndHour ?: "23",
            dayScrollToHour = entity.dayScrollToHour ?: "8",
            customDaysCount = entity.customDaysCount ?: "7",
            workHoursEnabled = if (entity.workStartHour != null && entity.workEndHour != null) "1" else "0",
            workStartHour = entity.workStartHour ?: "9",
            workEndHour = entity.workEndHour ?: "17",
            workDays = entity.workDays ?: "mon,tue,wed,thu,fri",

            // --- Views Tab: Habits ---
            habitsSuccessWindow = entity.habitsSuccessWindow ?: "30",
            defaultShowHabitsOnCalendar = entity.defaultShowHabitsOnCalendar ?: "1",

            // --- Views Tab: Projects ---
            projectsShowChildCount = entity.projectsShowChildCount ?: "0",
            projectsShowChecklistCount = entity.projectsShowChecklistCount ?: "0",

            // --- Views Tab: Maps ---
            mapAutoZoom = entity.mapAutoZoom ?: "1",
            mapDefaultLat = entity.mapDefaultLat ?: "",
            mapDefaultLon = entity.mapDefaultLon ?: "",
            mapDefaultZoom = entity.mapDefaultZoom ?: "",

            // --- Collections Tab ---
            sharedTags = entity.tags ?: "[]",
            customColors = entity.customColors ?: "[]",
            savedLocations = entity.savedLocations ?: "[]",
            defaultNotifications = entity.defaultNotifications ?: "{\"start_notifications\":[],\"due_notifications\":[]}",
            overdueBorderColor = entity.overdueBorderColor ?: "",
            blockedBorderColor = entity.blockedBorderColor ?: "",

            // --- Email Tab: Account & Syncing ---
            emailAccounts = entity.emailAccounts ?: "[]",
            emailSyncInterval = "15",
            emailCheckInterval = entity.emailCheckInterval ?: "15",
            emailMaxPull = entity.emailMaxPull ?: "100",
            emailBackfill = "false",

            // --- Email Tab: Privacy & Sending ---
            emailBlockTracking = entity.emailBlockTrackingPixels ?: "true",
            emailExternalContent = entity.emailExternalContent ?: "allow",
            emailReadReceipts = entity.emailReadReceipts ?: "never",
            emailUndoSendDelay = entity.emailUndoSendDelay ?: "10",
            emailSignature = entity.emailSignature ?: "",

            // --- Email Tab: Display ---
            emailMaxAttachmentSize = entity.attachmentMaxSizeMb ?: "25",
            emailGroupBy = entity.emailGroupBy ?: "date",
            emailPaginate = entity.paginateEmail ?: "true",
            emailPageSize = "50",

            // --- Email Tab: Bundles ---
            emailBundlesEnabled = if (entity.bundlesEnabled == true) "true" else "false",
            emailMultiPlacement = if (entity.bundlesMultiPlacement == true) "true" else "false",
            bundlesShowCount = entity.bundlesShowCount ?: entity.emailBundlesCountDisplay ?: "both",
            emailAutoBundles = "[]",

            // --- Email Tab: Badges ---
            badgeMaxPerEmail = "3",
            badgeDetectors = "[]",

            // --- Admin Tab: Administration ---
            instanceName = entity.instanceName ?: "",
            welcomeMessage = entity.welcomeMessage ?: "",
            sessionLifetime = entity.sessionLifetime ?: "24",

            // --- Admin Tab: Tools (Kiosk) ---
            kioskSelectedTags = entity.kioskSelectedTags ?: "[]",

            // --- Admin Tab: Data Management ---
            auditLogPruningEnabled = entity.auditLogPruningEnabled ?: "0",
            auditLogMaxDays = entity.auditLogMaxDays?.toString() ?: "365",
            auditLogMaxMb = entity.auditLogMaxMb?.toInt()?.toString() ?: "100",
            attachmentMaxSizeMb = entity.attachmentMaxSizeMb ?: "25",
            attachmentMaxStorageMb = entity.attachmentMaxStorageMb ?: "1024",

            // --- Admin Tab: Dependent Apps (Tailscale) ---
            tailscaleEnabled = entity.tailscaleEnabled ?: "0",
            tailscaleAuthKey = entity.tailscaleAuthKey ?: "",

            // --- Admin Tab: Dependent Apps (Ntfy) ---
            ntfyEnabled = entity.ntfyEnabled ?: "0",
            ntfyServerUrl = "",
            ntfyTopic = "",

            // --- Admin Tab: Dependent Apps (Home Assistant) ---
            haEnabled = entity.haEnabled ?: "0",
            haUrl = "",
            haToken = "",
            haPollInterval = entity.haPollInterval ?: "30",

            // --- Server / Legacy ---
            serverUrl = "http://192.168.1.111:3333",
            defaultView = entity.defaultView ?: "Calendar",
            emailMaxPullCount = entity.emailMaxPull ?: "100",
            emailShowCount = entity.bundlesShowCount ?: "true"
        )
    }

    /**
     * Maps the SettingsFormState back to a SettingsEntity for persistence.
     * Preserves fields not exposed in the form state from the cached entity.
     */
    private fun mapFormStateToEntity(formState: SettingsFormState): SettingsEntity {
        val base = cachedEntity ?: SettingsEntity(
            userId = userId,
            timeFormat = null,
            sex = null,
            snoozeLength = null,
            defaultFilters = null,
            alarmOrientation = null,
            activeClocks = null,
            savedLocations = null,
            tags = null,
            customColors = null,
            visualIndicators = null,
            chitOptions = null,
            calendarSnap = null,
            weekStartDay = null,
            workStartHour = null,
            workEndHour = null,
            workDays = null,
            enabledPeriods = null,
            customDaysCount = null,
            allViewStartHour = null,
            allViewEndHour = null,
            dayScrollToHour = null,
            username = null,
            unitSystem = null,
            habitsSuccessWindow = null,
            overdueBorderColor = null,
            blockedBorderColor = null,
            hidDeclined = null,
            defaultShowHabitsOnCalendar = null,
            defaultTimezone = null,
            defaultView = null,
            viewOrder = null,
            syncVersion = 0,
            lastSyncedAt = null,
            isDirty = false,
            lastModified = null
        )

        return base.copy(
            // --- General Tab ---
            timeFormat = formState.timeFormat,
            sex = formState.sex,
            snoozeLength = formState.snoozeLength,
            calendarSnap = formState.calendarSnapInterval,
            defaultTimezone = formState.defaultTimezone,
            unitSystem = formState.unitSystem,
            defaultShareContacts = formState.defaultShareContacts,
            clockOrientation = formState.clockOrientation,
            alarmOrientation = formState.clockOrientation,
            activeClocks = formState.activeClocks,
            timezoneOverride = formState.timezoneOverride,
            landingView = formState.landingView,
            defaultView = formState.landingView,
            viewOrder = formState.viewOrder,
            hiddenViews = formState.hiddenViews,
            enabledPeriods = formState.enabledPeriods,
            chitOptions = formState.chitOptions,
            visualIndicators = formState.visualIndicators,
            combineAlerts = formState.combineAlerts,
            customViewFilters = formState.customViewFilters,

            // --- Views Tab ---
            omniHstClockMode = formState.omniHstClockMode,
            omniLayout = formState.omniLayout,
            omniEmailCount = formState.omniEmailCount,
            omniNormalizeColors = formState.omniNormalizeColors,
            omniLockedFilters = formState.omniLockedFilters,
            weekStartDay = formState.weekStartDay,
            allViewStartHour = formState.allViewStartHour,
            allViewEndHour = formState.allViewEndHour,
            dayScrollToHour = formState.dayScrollToHour,
            customDaysCount = formState.customDaysCount,
            workStartHour = if (formState.workHoursEnabled == "1") formState.workStartHour else null,
            workEndHour = if (formState.workHoursEnabled == "1") formState.workEndHour else null,
            workDays = if (formState.workHoursEnabled == "1") formState.workDays else null,
            habitsSuccessWindow = formState.habitsSuccessWindow,
            defaultShowHabitsOnCalendar = formState.defaultShowHabitsOnCalendar,
            projectsShowChildCount = formState.projectsShowChildCount,
            projectsShowChecklistCount = formState.projectsShowChecklistCount,
            mapAutoZoom = formState.mapAutoZoom,
            mapDefaultLat = formState.mapDefaultLat.ifEmpty { null },
            mapDefaultLon = formState.mapDefaultLon.ifEmpty { null },
            mapDefaultZoom = formState.mapDefaultZoom.ifEmpty { null },

            // --- Collections Tab ---
            tags = formState.sharedTags,
            customColors = formState.customColors,
            savedLocations = formState.savedLocations,
            defaultNotifications = formState.defaultNotifications,
            overdueBorderColor = formState.overdueBorderColor.ifEmpty { null },
            blockedBorderColor = formState.blockedBorderColor.ifEmpty { null },

            // --- Email Tab ---
            emailAccounts = formState.emailAccounts,
            emailCheckInterval = formState.emailCheckInterval,
            emailMaxPull = formState.emailMaxPull,
            emailBlockTrackingPixels = formState.emailBlockTracking,
            emailExternalContent = formState.emailExternalContent,
            emailReadReceipts = formState.emailReadReceipts,
            emailUndoSendDelay = formState.emailUndoSendDelay,
            emailSignature = formState.emailSignature,
            emailGroupBy = formState.emailGroupBy,
            paginateEmail = formState.emailPaginate,
            bundlesEnabled = formState.emailBundlesEnabled == "true",
            bundlesMultiPlacement = formState.emailMultiPlacement == "true",
            bundlesShowCount = formState.bundlesShowCount,
            emailBundlesCountDisplay = formState.bundlesShowCount,
            attachmentMaxSizeMb = formState.attachmentMaxSizeMb,
            attachmentMaxStorageMb = formState.attachmentMaxStorageMb,

            // --- Admin Tab ---
            instanceName = formState.instanceName.ifEmpty { null },
            welcomeMessage = formState.welcomeMessage.ifEmpty { null },
            sessionLifetime = formState.sessionLifetime,
            kioskSelectedTags = formState.kioskSelectedTags,
            auditLogPruningEnabled = formState.auditLogPruningEnabled,
            auditLogMaxDays = formState.auditLogMaxDays.toIntOrNull(),
            auditLogMaxMb = formState.auditLogMaxMb.toDoubleOrNull(),
            tailscaleEnabled = formState.tailscaleEnabled,
            tailscaleAuthKey = formState.tailscaleAuthKey.ifEmpty { null },
            ntfyEnabled = formState.ntfyEnabled,
            haEnabled = formState.haEnabled,
            haPollInterval = formState.haPollInterval
        )
    }
}
