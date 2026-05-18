package com.cwoc.app.ui.screens.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cwoc.app.data.local.entity.SettingsEntity
import com.cwoc.app.data.repository.SettingsRepository
import com.cwoc.app.data.repository.SyncRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Form state holding all editable settings fields as strings.
 * Maps to the SettingsEntity fields for persistence.
 */
data class SettingsFormState(
    val timeFormat: String = "12h",
    val weekStartDay: String = "sunday",
    val calendarSnapInterval: String = "15",
    val snoozeLength: String = "10",
    val defaultTimezone: String = "America/New_York",
    val unitSystem: String = "imperial",
    val defaultView: String = "Tasks",
    val enabledPeriods: String = "Day,Week,Month",
    val viewOrder: String = "Calendar,Checklists,Alarms,Projects,Tasks,Notes",
    // W1: Additional fields
    val sex: String = "male",
    // Collections tab fields
    val sharedTags: String = "[]",
    val customColors: String = "[]",
    val savedLocations: String = "[]",
    val defaultNotifications: String = "{\"start_notifications\":[],\"due_notifications\":[]}",
    // Email tab fields
    val emailAccounts: String = "[]",
    val emailSyncInterval: String = "15",
    val emailMaxPullCount: String = "100",
    val emailBackfill: String = "false",
    val emailBlockTracking: String = "true",
    val emailExternalContent: String = "ask",
    val emailReadReceipts: String = "false",
    val emailUndoSendDelay: String = "10",
    val emailSignature: String = "",
    val emailMaxAttachmentSize: String = "25",
    val emailGroupBy: String = "thread",
    val emailPaginate: String = "true",
    val emailPageSize: String = "50",
    val emailBundlesEnabled: String = "true",
    val emailMultiPlacement: String = "false",
    val emailShowCount: String = "true",
    val emailAutoBundles: String = "[]",
    // Badges tab fields
    val badgeMaxPerEmail: String = "3",
    val badgeDetectors: String = "[]",
    // Admin tab fields
    val serverUrl: String = "http://192.168.1.111:3333",
    val ntfyServerUrl: String = "",
    val ntfyTopic: String = "",
    val haUrl: String = "",
    val haToken: String = ""
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
    private val syncRepository: SyncRepository
) : ViewModel() {

    private val _settings = MutableStateFlow(SettingsFormState())
    val settings: StateFlow<SettingsFormState> = _settings.asStateFlow()

    private val _isSaving = MutableStateFlow(false)
    val isSaving: StateFlow<Boolean> = _isSaving.asStateFlow()

    private val _saveError = MutableStateFlow<String?>(null)
    val saveError: StateFlow<String?> = _saveError.asStateFlow()

    /** Cached userId from the loaded entity, needed for saving back. */
    private var userId: String = "default_user"

    /** Cached entity for fields we don't expose in the form state. */
    private var cachedEntity: SettingsEntity? = null

    init {
        loadSettings()
    }

    /**
     * Loads settings from the repository and maps them into SettingsFormState.
     */
    private fun loadSettings() {
        viewModelScope.launch {
            val entity = settingsRepository.get()
            if (entity != null) {
                cachedEntity = entity
                userId = entity.userId
                _settings.value = mapEntityToFormState(entity)
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
                "time_format" -> current.copy(timeFormat = value)
                "week_start_day" -> current.copy(weekStartDay = value)
                "calendar_snap_interval" -> current.copy(calendarSnapInterval = value)
                "snooze_length" -> current.copy(snoozeLength = value)
                "default_timezone" -> current.copy(defaultTimezone = value)
                "unit_system" -> current.copy(unitSystem = value)
                "default_view" -> current.copy(defaultView = value)
                "enabled_periods" -> current.copy(enabledPeriods = value)
                "view_order" -> current.copy(viewOrder = value)
                "shared_tags" -> current.copy(sharedTags = value)
                "custom_colors" -> current.copy(customColors = value)
                "saved_locations" -> current.copy(savedLocations = value)
                "default_notifications" -> current.copy(defaultNotifications = value)
                // Email settings
                "email_accounts" -> current.copy(emailAccounts = value)
                "email_sync_interval" -> current.copy(emailSyncInterval = value)
                "email_max_pull_count" -> current.copy(emailMaxPullCount = value)
                "email_backfill" -> current.copy(emailBackfill = value)
                "email_block_tracking" -> current.copy(emailBlockTracking = value)
                "email_external_content" -> current.copy(emailExternalContent = value)
                "email_read_receipts" -> current.copy(emailReadReceipts = value)
                "email_undo_send_delay" -> current.copy(emailUndoSendDelay = value)
                "email_signature" -> current.copy(emailSignature = value)
                "email_max_attachment_size" -> current.copy(emailMaxAttachmentSize = value)
                "email_group_by" -> current.copy(emailGroupBy = value)
                "email_paginate" -> current.copy(emailPaginate = value)
                "email_page_size" -> current.copy(emailPageSize = value)
                "email_bundles_enabled" -> current.copy(emailBundlesEnabled = value)
                "email_multi_placement" -> current.copy(emailMultiPlacement = value)
                "email_show_count" -> current.copy(emailShowCount = value)
                "email_auto_bundles" -> current.copy(emailAutoBundles = value)
                // Badge settings
                "badge_max_per_email" -> current.copy(badgeMaxPerEmail = value)
                "badge_detectors" -> current.copy(badgeDetectors = value)
                // Admin settings
                "server_url" -> current.copy(serverUrl = value)
                "ntfy_server_url" -> current.copy(ntfyServerUrl = value)
                "ntfy_topic" -> current.copy(ntfyTopic = value)
                "ha_url" -> current.copy(haUrl = value)
                "ha_token" -> current.copy(haToken = value)
                else -> current
            }
        }
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
                val formState = _settings.value
                val updatedEntity = mapFormStateToEntity(formState)
                // SettingsRepository.update() handles dirty marking and sync push
                settingsRepository.update(updatedEntity)
            } catch (e: Exception) {
                _saveError.value = e.message ?: "Failed to save settings"
            } finally {
                _isSaving.value = false
            }
        }
    }

    /**
     * Maps a SettingsEntity from Room into the SettingsFormState for the UI.
     */
    private fun mapEntityToFormState(entity: SettingsEntity): SettingsFormState {
        return SettingsFormState(
            timeFormat = entity.timeFormat ?: "12h",
            weekStartDay = entity.weekStartDay ?: "sunday",
            calendarSnapInterval = entity.calendarSnap ?: "15",
            snoozeLength = entity.snoozeLength ?: "10",
            defaultTimezone = entity.defaultTimezone ?: "America/New_York",
            unitSystem = entity.unitSystem ?: "imperial",
            defaultView = entity.defaultView ?: "Tasks",
            enabledPeriods = entity.enabledPeriods ?: "Day,Week,Month",
            viewOrder = entity.viewOrder ?: "Calendar,Checklists,Alarms,Projects,Tasks,Notes",
            sex = entity.sex ?: "male",
            sharedTags = entity.sharedTags ?: "[]",
            customColors = entity.customColors ?: "[]",
            savedLocations = entity.savedLocations ?: "[]",
            defaultNotifications = entity.defaultNotifications ?: "{\"start_notifications\":[],\"due_notifications\":[]}",
            // Email settings
            emailAccounts = entity.emailAccounts ?: "[]",
            emailBlockTracking = entity.emailBlockTrackingPixels ?: "true",
            emailExternalContent = entity.emailExternalContent ?: "ask",
            emailReadReceipts = entity.emailReadReceipts ?: "false",
            emailUndoSendDelay = entity.emailUndoSendDelay ?: "10",
            emailGroupBy = entity.emailGroupBy ?: "thread",
            emailPaginate = entity.paginateEmail ?: "true",
            emailBundlesEnabled = if (entity.bundlesEnabled == true) "true" else "false",
            emailMultiPlacement = if (entity.bundlesMultiPlacement == true) "true" else "false",
            emailShowCount = entity.bundlesShowCount ?: "true",
            emailMaxAttachmentSize = entity.attachmentMaxSizeMb ?: "25"
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
            timeFormat = formState.timeFormat,
            weekStartDay = formState.weekStartDay,
            calendarSnap = formState.calendarSnapInterval,
            snoozeLength = formState.snoozeLength,
            defaultTimezone = formState.defaultTimezone,
            unitSystem = formState.unitSystem,
            defaultView = formState.defaultView,
            enabledPeriods = formState.enabledPeriods,
            viewOrder = formState.viewOrder,
            sharedTags = formState.sharedTags,
            customColors = formState.customColors,
            savedLocations = formState.savedLocations,
            defaultNotifications = formState.defaultNotifications,
            // Email settings
            emailAccounts = formState.emailAccounts,
            emailBlockTrackingPixels = formState.emailBlockTracking,
            emailExternalContent = formState.emailExternalContent,
            emailReadReceipts = formState.emailReadReceipts,
            emailUndoSendDelay = formState.emailUndoSendDelay,
            emailGroupBy = formState.emailGroupBy,
            paginateEmail = formState.emailPaginate,
            bundlesEnabled = formState.emailBundlesEnabled == "true",
            bundlesMultiPlacement = formState.emailMultiPlacement == "true",
            bundlesShowCount = formState.emailShowCount,
            attachmentMaxSizeMb = formState.emailMaxAttachmentSize
        )
    }
}
