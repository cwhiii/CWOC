package com.cwoc.app.data.mapper

import com.cwoc.app.data.local.entity.SettingsEntity
import com.cwoc.app.data.remote.dto.SettingsPushDto
import com.google.gson.Gson

/**
 * Converts a SettingsEntity to a SettingsPushDto for the POST /api/sync/push request.
 * Serializes all settings fields into a flat Map<String, Any?> using snake_case keys,
 * matching the server's expected settings object format.
 *
 * JSON-stored fields (defaultFilters, activeClocks, savedLocations, tags, customColors,
 * visualIndicators, chitOptions, viewOrder) are deserialized from their JSON string
 * representation back to structured objects for the push payload.
 */
fun SettingsEntity.toPushDto(): SettingsPushDto {
    val gson = Gson()
    val settingsMap = buildMap<String, Any?> {
        put("user_id", userId)
        put("time_format", timeFormat)
        put("sex", sex)
        put("snooze_length", snoozeLength)
        put("default_filters", defaultFilters?.let { gson.fromJson(it, Any::class.java) })
        put("alarm_orientation", alarmOrientation)
        put("active_clocks", activeClocks?.let { gson.fromJson(it, Any::class.java) })
        put("saved_locations", savedLocations?.let { gson.fromJson(it, Any::class.java) })
        put("tags", tags?.let { gson.fromJson(it, Any::class.java) })
        put("custom_colors", customColors?.let { gson.fromJson(it, Any::class.java) })
        put("visual_indicators", visualIndicators?.let { gson.fromJson(it, Any::class.java) })
        put("chit_options", chitOptions?.let { gson.fromJson(it, Any::class.java) })
        put("calendar_snap", calendarSnap)
        put("week_start_day", weekStartDay)
        put("work_start_hour", workStartHour)
        put("work_end_hour", workEndHour)
        put("work_days", workDays)
        put("enabled_periods", enabledPeriods)
        put("custom_days_count", customDaysCount)
        put("all_view_start_hour", allViewStartHour)
        put("all_view_end_hour", allViewEndHour)
        put("day_scroll_to_hour", dayScrollToHour)
        put("username", username)
        put("unit_system", unitSystem)
        put("habits_success_window", habitsSuccessWindow)
        put("overdue_border_color", overdueBorderColor)
        put("blocked_border_color", blockedBorderColor)
        put("hide_declined", hidDeclined)
        put("default_show_habits_on_calendar", defaultShowHabitsOnCalendar)
        put("default_timezone", defaultTimezone)
        put("default_view", defaultView)
        put("view_order", viewOrder?.let { gson.fromJson(it, Any::class.java) })
        // Audit settings
        put("audit_log_max_days", auditLogMaxDays)
        put("audit_log_max_mb", auditLogMaxMb)
        // Notification defaults
        put("default_notifications", defaultNotifications?.let { gson.fromJson(it, Any::class.java) })
        // Shared/kiosk
        put("shared_tags", sharedTags?.let { gson.fromJson(it, Any::class.java) })
        put("kiosk_users", kioskUsers?.let { gson.fromJson(it, Any::class.java) })
        // Map settings
        put("map_default_lat", mapDefaultLat)
        put("map_default_lon", mapDefaultLon)
        put("map_default_zoom", mapDefaultZoom)
        put("map_auto_zoom", mapAutoZoom)
        // Email settings
        put("email_account", emailAccount?.let { gson.fromJson(it, Any::class.java) })
        put("email_accounts", emailAccounts?.let { gson.fromJson(it, Any::class.java) })
        // Attachment limits
        put("attachment_max_size_mb", attachmentMaxSizeMb)
        put("attachment_max_storage_mb", attachmentMaxStorageMb)
        // Sharing
        put("default_share_contacts", defaultShareContacts)
        // Autosave
        put("checklist_autosave", checklistAutosave)
        put("autosave_desktop", autosaveDesktop)
        put("autosave_mobile", autosaveMobile)
        // Tags
        put("recent_tags", recentTags?.let { gson.fromJson(it, Any::class.java) })
        // Email pagination
        put("paginate_email", paginateEmail)
        // Bundles
        put("bundles_multi_placement", bundlesMultiPlacement)
        put("bundles_enabled", bundlesEnabled)
        put("bundles_show_count", bundlesShowCount)
        // Map thumbnails
        put("show_map_thumbnails", showMapThumbnails)
        // Session
        put("session_lifetime", sessionLifetime)
        // Omni view
        put("omni_layout", omniLayout?.let { gson.fromJson(it, Any::class.java) })
        put("omni_locked_filters", omniLockedFilters?.let { gson.fromJson(it, Any::class.java) })
        put("omni_hst_clock_mode", omniHstClockMode)
        put("omni_email_count", omniEmailCount)
        put("omni_normalize_colors", omniNormalizeColors)
        // Smart actions
        put("smart_actions_config", smartActionsConfig?.let { gson.fromJson(it, Any::class.java) })
        // Custom view filters
        put("custom_view_filters", customViewFilters?.let { gson.fromJson(it, Any::class.java) })
        // Email privacy
        put("email_block_tracking_pixels", emailBlockTrackingPixels)
        put("email_external_content", emailExternalContent)
        put("email_read_receipts", emailReadReceipts)
        put("email_undo_send_delay", emailUndoSendDelay)
        put("email_group_by", emailGroupBy)
        // Timezone override
        put("timezone_override", timezoneOverride)

        // === Migration 7→8 fields ===
        // General tab
        put("clock_orientation", clockOrientation)
        put("hidden_views", hiddenViews?.let { gson.fromJson(it, Any::class.java) })
        put("combine_alerts", combineAlerts)
        // Views tab
        put("projects_show_child_count", projectsShowChildCount)
        put("projects_show_checklist_count", projectsShowChecklistCount)
        // Email tab
        put("email_check_interval", emailCheckInterval)
        put("email_max_pull", emailMaxPull)
        put("email_signature", emailSignature)
        // Admin tab
        put("instance_name", instanceName)
        put("welcome_message", welcomeMessage)
        put("audit_log_pruning_enabled", auditLogPruningEnabled)
        put("tailscale_enabled", tailscaleEnabled)
        put("tailscale_auth_key", tailscaleAuthKey)
        put("ntfy_enabled", ntfyEnabled)
        put("ha_enabled", haEnabled)
        put("ha_poll_interval", haPollInterval)
        put("kiosk_selected_tags", kioskSelectedTags?.let { gson.fromJson(it, Any::class.java) })
    }

    return SettingsPushDto(
        last_known_sync_version = syncVersion,
        settings = settingsMap
    )
}
