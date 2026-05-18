package com.cwoc.app.data.mapper

import com.cwoc.app.ui.screens.settings.SettingsFormState
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken

/**
 * API payload mapper for Settings.
 *
 * Provides bidirectional mapping between SettingsFormState and the API JSON payload,
 * using IDENTICAL key names to the web client. Also provides unsupported field
 * preservation: on load, the raw server JSON is stored; on save, managed fields are
 * overlaid on top of the raw JSON so that web-only fields are never lost.
 *
 * Validates: Requirements 31.1, 31.4, 31.5, 31.6
 */
object SettingsPayloadMapper {

    private val gson = Gson()

    /**
     * The set of JSON keys that the Android client actively manages.
     * Any key NOT in this set is considered "unsupported" and will be preserved
     * verbatim from the raw server response on save.
     */
    val MANAGED_KEYS: Set<String> = setOf(
        "time_format",
        "sex",
        "snooze_length",
        "calendar_snap",
        "default_timezone",
        "timezone_override",
        "unit_system",
        "default_share_contacts",
        "active_clocks",
        "alarm_orientation",
        "default_view",
        "view_order",
        "hidden_views",
        "enabled_periods",
        "chit_options",
        "visual_indicators",
        "combine_alerts",
        "custom_view_filters",
        "week_start_day",
        "all_view_start_hour",
        "all_view_end_hour",
        "day_scroll_to_hour",
        "custom_days_count",
        "work_start_hour",
        "work_end_hour",
        "work_days",
        "habits_success_window",
        "default_show_habits_on_calendar",
        "projects_show_child_count",
        "projects_show_checklist_count",
        "map_auto_zoom",
        "map_default_lat",
        "map_default_lon",
        "map_default_zoom",
        "omni_hst_clock_mode",
        "omni_layout",
        "omni_bundle_toggles",
        "omni_email_count",
        "omni_normalize_colors",
        "omni_locked_filters",
        "email_external_content",
        "email_read_receipts",
        "email_signature",
        "email_check_interval",
        "email_max_pull",
        "email_group_by",
        "bundles_show_count",
        "badge_detectors",
        "tags",
        "custom_colors",
        "saved_locations",
        "default_notifications",
        "instance_name",
        "welcome_message",
        "session_lifetime",
        "kiosk_selected_tags",
        "audit_log_pruning_enabled",
        "audit_log_max_days",
        "audit_log_max_mb",
        "attachment_max_size_mb",
        "attachment_max_storage_mb",
        "overdue_border_color",
        "blocked_border_color"
    )

    /**
     * Converts a SettingsFormState into a flat Map<String, Any?> using the exact
     * JSON key names the web client uses for the POST /api/settings payload.
     *
     * JSON-string fields (arrays, objects) are deserialized to structured objects
     * so that Gson serializes them as proper JSON in the final payload.
     */
    fun mapFormStateToPayload(formState: SettingsFormState): Map<String, Any?> {
        return buildMap {
            put("time_format", formState.timeFormat)
            put("sex", formState.sex)
            put("snooze_length", formState.snoozeLength)
            put("calendar_snap", formState.calendarSnapInterval)
            put("default_timezone", formState.defaultTimezone)
            put("timezone_override", formState.timezoneOverride)
            put("unit_system", formState.unitSystem)
            put("default_share_contacts", formState.defaultShareContacts)
            put("active_clocks", parseJsonOrRaw(formState.activeClocks))
            put("alarm_orientation", formState.clockOrientation)
            put("default_view", formState.landingView)
            put("view_order", parseJsonOrRaw(formState.viewOrder))
            put("hidden_views", parseJsonOrRaw(formState.hiddenViews))
            put("enabled_periods", formState.enabledPeriods)
            put("chit_options", parseJsonOrRaw(formState.chitOptions))
            put("visual_indicators", parseJsonOrRaw(formState.visualIndicators))
            put("combine_alerts", formState.combineAlerts)
            put("custom_view_filters", parseJsonOrRaw(formState.customViewFilters))
            put("week_start_day", formState.weekStartDay)
            put("all_view_start_hour", formState.allViewStartHour)
            put("all_view_end_hour", formState.allViewEndHour)
            put("day_scroll_to_hour", formState.dayScrollToHour)
            put("custom_days_count", formState.customDaysCount)
            put("work_start_hour", formState.workStartHour)
            put("work_end_hour", formState.workEndHour)
            put("work_days", formState.workDays)
            put("habits_success_window", formState.habitsSuccessWindow)
            put("default_show_habits_on_calendar", formState.defaultShowHabitsOnCalendar)
            put("projects_show_child_count", formState.projectsShowChildCount)
            put("projects_show_checklist_count", formState.projectsShowChecklistCount)
            put("map_auto_zoom", formState.mapAutoZoom)
            put("map_default_lat", formState.mapDefaultLat.ifEmpty { null })
            put("map_default_lon", formState.mapDefaultLon.ifEmpty { null })
            put("map_default_zoom", formState.mapDefaultZoom.ifEmpty { null })
            put("omni_hst_clock_mode", formState.omniHstClockMode)
            put("omni_layout", parseJsonOrRaw(formState.omniLayout))
            put("omni_bundle_toggles", parseJsonOrRaw(formState.omniBundleToggles))
            put("omni_email_count", formState.omniEmailCount)
            put("omni_normalize_colors", formState.omniNormalizeColors)
            put("omni_locked_filters", parseJsonOrRaw(formState.omniLockedFilters))
            put("email_external_content", formState.emailExternalContent)
            put("email_read_receipts", formState.emailReadReceipts)
            put("email_signature", formState.emailSignature)
            put("email_check_interval", formState.emailCheckInterval)
            put("email_max_pull", formState.emailMaxPull)
            put("email_group_by", formState.emailGroupBy)
            put("bundles_show_count", formState.bundlesShowCount)
            put("badge_detectors", parseJsonOrRaw(formState.badgeDetectors))
            put("tags", parseJsonOrRaw(formState.sharedTags))
            put("custom_colors", parseJsonOrRaw(formState.customColors))
            put("saved_locations", parseJsonOrRaw(formState.savedLocations))
            put("default_notifications", parseJsonOrRaw(formState.defaultNotifications))
            put("instance_name", formState.instanceName)
            put("welcome_message", formState.welcomeMessage)
            put("session_lifetime", formState.sessionLifetime)
            put("kiosk_selected_tags", parseJsonOrRaw(formState.kioskSelectedTags))
            put("audit_log_pruning_enabled", formState.auditLogPruningEnabled)
            put("audit_log_max_days", formState.auditLogMaxDays)
            put("audit_log_max_mb", formState.auditLogMaxMb)
            put("attachment_max_size_mb", formState.attachmentMaxSizeMb)
            put("attachment_max_storage_mb", formState.attachmentMaxStorageMb)
            put("overdue_border_color", formState.overdueBorderColor.ifEmpty { null })
            put("blocked_border_color", formState.blockedBorderColor.ifEmpty { null })
        }
    }

    /**
     * Parses a raw API JSON response (as a Map<String, Any?>) into a SettingsFormState.
     * Missing or null fields use the SettingsFormState defaults.
     *
     * This is the inverse of [mapFormStateToPayload].
     */
    fun mapPayloadToFormState(payload: Map<String, Any?>): SettingsFormState {
        return SettingsFormState(
            timeFormat = payload.getString("time_format") ?: "12hour",
            sex = payload.getString("sex") ?: "man",
            snoozeLength = payload.getString("snooze_length") ?: "5",
            calendarSnapInterval = payload.getString("calendar_snap") ?: "15",
            defaultTimezone = payload.getString("default_timezone") ?: "America/New_York",
            timezoneOverride = payload.getString("timezone_override") ?: "",
            defaultShareContacts = payload.getString("default_share_contacts") ?: "0",
            activeClocks = payload.toJsonString("active_clocks") ?: "[\"12 Hour\"]",
            clockOrientation = payload.getString("alarm_orientation") ?: "horizontal",
            landingView = payload.getString("default_view") ?: "Calendar",
            viewOrder = payload.toJsonString("view_order")
                ?: "[\"Calendar\",\"Checklists\",\"Alarms\",\"Projects\",\"Tasks\",\"Notes\",\"Email\",\"Indicators\"]",
            chitOptions = payload.toJsonString("chit_options")
                ?: "{\"checklist_autosave\":false,\"auto_save_desktop\":false,\"auto_save_mobile\":false,\"fade_past_chits\":true,\"highlight_overdue_chits\":true,\"highlight_blocked_chits\":true,\"delete_past_alarm_chits\":false,\"show_tab_counts\":false,\"prefer_google_maps\":false,\"show_map_thumbnails\":false,\"hide_declined\":false}",
            visualIndicators = payload.toJsonString("visual_indicators")
                ?: "{\"alarm\":\"always\",\"notification\":\"always\",\"timer\":\"always\",\"stopwatch\":\"always\",\"combined_alert\":\"always\",\"weather\":\"always\",\"people\":\"always\",\"indicators\":\"always\",\"custom_data\":\"always\",\"combine_alerts\":false}",
            customViewFilters = payload.toJsonString("custom_view_filters") ?: "{}",
            weekStartDay = payload.getString("week_start_day") ?: "sun",
            allViewStartHour = payload.getString("all_view_start_hour") ?: "0",
            allViewEndHour = payload.getString("all_view_end_hour") ?: "23",
            dayScrollToHour = payload.getString("day_scroll_to_hour") ?: "8",
            customDaysCount = payload.getString("custom_days_count") ?: "7",
            workStartHour = payload.getString("work_start_hour") ?: "9",
            workEndHour = payload.getString("work_end_hour") ?: "17",
            workDays = payload.getString("work_days") ?: "mon,tue,wed,thu,fri",
            habitsSuccessWindow = payload.getString("habits_success_window") ?: "30",
            defaultShowHabitsOnCalendar = payload.getString("default_show_habits_on_calendar") ?: "1",
            projectsShowChildCount = payload.getString("projects_show_child_count") ?: "0",
            projectsShowChecklistCount = payload.getString("projects_show_checklist_count") ?: "0",
            mapAutoZoom = payload.getString("map_auto_zoom") ?: "1",
            mapDefaultLat = payload.getString("map_default_lat") ?: "",
            mapDefaultLon = payload.getString("map_default_lon") ?: "",
            mapDefaultZoom = payload.getString("map_default_zoom") ?: "",
            omniHstClockMode = payload.getString("omni_hst_clock_mode") ?: "both",
            omniLayout = payload.toJsonString("omni_layout") ?: "{}",
            omniEmailCount = payload.getString("omni_email_count") ?: "3",
            omniNormalizeColors = payload.getString("omni_normalize_colors") ?: "colored",
            omniLockedFilters = payload.toJsonString("omni_locked_filters") ?: "[]",
            emailExternalContent = payload.getString("email_external_content") ?: "allow",
            emailReadReceipts = payload.getString("email_read_receipts") ?: "never",
            emailSignature = payload.getString("email_signature") ?: "",
            emailCheckInterval = payload.getString("email_check_interval") ?: "15",
            emailMaxPull = payload.getString("email_max_pull") ?: "100",
            emailGroupBy = payload.getString("email_group_by") ?: "date",
            bundlesShowCount = payload.getString("bundles_show_count") ?: "both",
            badgeDetectors = payload.toJsonString("badge_detectors") ?: "[]",
            sharedTags = payload.toJsonString("tags") ?: "[]",
            customColors = payload.toJsonString("custom_colors") ?: "[]",
            savedLocations = payload.toJsonString("saved_locations") ?: "[]",
            defaultNotifications = payload.toJsonString("default_notifications") ?: "{\"start_notifications\":[],\"due_notifications\":[]}",
            instanceName = payload.getString("instance_name") ?: "",
            welcomeMessage = payload.getString("welcome_message") ?: "",
            sessionLifetime = payload.getString("session_lifetime") ?: "24",
            kioskSelectedTags = payload.toJsonString("kiosk_selected_tags") ?: "[]",
            auditLogPruningEnabled = payload.getString("audit_log_pruning_enabled") ?: "0",
            auditLogMaxDays = payload.getString("audit_log_max_days") ?: "365",
            auditLogMaxMb = payload.getString("audit_log_max_mb") ?: "100",
            attachmentMaxSizeMb = payload.getString("attachment_max_size_mb") ?: "25",
            attachmentMaxStorageMb = payload.getString("attachment_max_storage_mb") ?: "1024",
            overdueBorderColor = payload.getString("overdue_border_color") ?: "",
            blockedBorderColor = payload.getString("blocked_border_color") ?: "",
            unitSystem = payload.getString("unit_system") ?: "imperial",
            hiddenViews = payload.toJsonString("hidden_views") ?: "[]",
            enabledPeriods = payload.getString("enabled_periods") ?: "Day,Week,Month",
            combineAlerts = payload.getString("combine_alerts") ?: "0",
            omniBundleToggles = payload.toJsonString("omni_bundle_toggles") ?: "{}"
        )
    }

    /**
     * Merges managed fields from the current SettingsFormState over the raw server
     * settings, preserving any unrecognized/unsupported fields from the server.
     *
     * This is the key function for unsupported field preservation (Requirement 31.4):
     * 1. Start with the raw server JSON (all fields the server sent)
     * 2. Overlay only the fields the Android client manages
     * 3. The result can be POSTed without losing web-only fields
     *
     * @param rawServerSettings The raw JSON map stored on load from the server
     * @param formState The current form state with user edits
     * @return A merged map ready to POST to the server
     */
    fun mergePayload(
        rawServerSettings: Map<String, Any?>,
        formState: SettingsFormState
    ): Map<String, Any?> {
        val managedFields = mapFormStateToPayload(formState)
        return buildMap {
            // Start with all raw server fields (preserves unsupported ones)
            putAll(rawServerSettings)
            // Overlay managed fields (Android's current values take precedence)
            putAll(managedFields)
        }
    }

    // ─── Private helpers ────────────────────────────────────────────────────────

    /**
     * Attempts to parse a JSON string into a structured object (List or Map).
     * If parsing fails or the input is not valid JSON, returns the raw string.
     */
    private fun parseJsonOrRaw(jsonString: String): Any? {
        if (jsonString.isBlank()) return null
        return try {
            val trimmed = jsonString.trim()
            when {
                trimmed.startsWith("[") -> {
                    val type = object : TypeToken<List<Any?>>() {}.type
                    gson.fromJson<List<Any?>>(trimmed, type)
                }
                trimmed.startsWith("{") -> {
                    val type = object : TypeToken<Map<String, Any?>>() {}.type
                    gson.fromJson<Map<String, Any?>>(trimmed, type)
                }
                else -> jsonString
            }
        } catch (_: Exception) {
            jsonString
        }
    }

    /**
     * Extracts a string value from the payload map.
     * Handles cases where the server may return numbers or other types.
     */
    private fun Map<String, Any?>.getString(key: String): String? {
        val value = this[key] ?: return null
        return when (value) {
            is String -> value.ifEmpty { null }
            is Number -> value.toString().removeSuffix(".0")
            is Boolean -> if (value) "1" else "0"
            else -> value.toString()
        }
    }

    /**
     * Extracts a value from the payload map and serializes it to a JSON string.
     * Used for fields that are stored as JSON strings in FormState (arrays, objects).
     */
    private fun Map<String, Any?>.toJsonString(key: String): String? {
        val value = this[key] ?: return null
        return when (value) {
            is String -> value.ifEmpty { null }
            else -> gson.toJson(value)
        }
    }
}
