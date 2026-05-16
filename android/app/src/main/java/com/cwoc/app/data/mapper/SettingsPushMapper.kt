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
    }

    return SettingsPushDto(
        last_known_sync_version = syncVersion,
        settings = settingsMap
    )
}
