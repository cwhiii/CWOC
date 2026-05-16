package com.cwoc.app.data.remote.dto

/**
 * DTO matching the server's settings JSON response shape.
 * Fields use snake_case to match server field names.
 * Complex nested JSON objects use Any? since we store them as raw JSON strings in Room.
 */
data class SettingsDto(
    val user_id: String?,
    val time_format: String?,
    val sex: String?,
    val snooze_length: String?,
    val default_filters: Any?,
    val alarm_orientation: String?,
    val active_clocks: Any?,
    val saved_locations: Any?,
    val tags: Any?,
    val custom_colors: Any?,
    val visual_indicators: Any?,
    val chit_options: Any?,
    val calendar_snap: String?,
    val week_start_day: String?,
    val work_start_hour: String?,
    val work_end_hour: String?,
    val work_days: String?,
    val enabled_periods: String?,
    val custom_days_count: String?,
    val all_view_start_hour: String?,
    val all_view_end_hour: String?,
    val day_scroll_to_hour: String?,
    val username: String?,
    val unit_system: String?,
    val habits_success_window: String?,
    val overdue_border_color: String?,
    val blocked_border_color: String?,
    val hide_declined: String?,
    val default_show_habits_on_calendar: String?,
    val default_timezone: String?,
    val default_view: String?,
    val view_order: Any?,
    val sync_version: Int
)
