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
    val sync_version: Int = 0,

    // Audit settings
    val audit_log_max_days: Int?,
    val audit_log_max_mb: Double?,

    // Notification defaults
    val default_notifications: Any?,

    // Shared/kiosk
    val shared_tags: Any?,
    val kiosk_users: Any?,

    // Map settings
    val map_default_lat: String?,
    val map_default_lon: String?,
    val map_default_zoom: String?,
    val map_auto_zoom: String?,

    // Email settings
    val email_account: Any?,
    val email_accounts: Any?,

    // Attachment limits
    val attachment_max_size_mb: String?,
    val attachment_max_storage_mb: String?,

    // Sharing
    val default_share_contacts: String?,

    // Autosave
    val checklist_autosave: String?,
    val autosave_desktop: String?,
    val autosave_mobile: String?,

    // Tags
    val recent_tags: Any?,

    // Email pagination
    val paginate_email: String?,

    // Bundles
    val bundles_multi_placement: Any? = null,
    val bundles_enabled: Any? = null,
    val bundles_show_count: String? = null,

    // Map thumbnails
    val show_map_thumbnails: String?,

    // Session
    val session_lifetime: String?,

    // Omni view
    val omni_layout: Any?,
    val omni_locked_filters: Any?,
    val omni_hst_clock_mode: String?,
    val omni_email_count: String?,
    val omni_normalize_colors: String?,

    // Smart actions
    val smart_actions_config: Any?,

    // Custom view filters
    val custom_view_filters: Any?,

    // Email privacy
    val email_block_tracking_pixels: String?,
    val email_external_content: String?,
    val email_read_receipts: String?,
    val email_undo_send_delay: String?,
    val email_group_by: String?,

    // Timezone override
    val timezone_override: String?,

    // === Migration 7→8 fields (previously missing from DTO) ===

    // General tab
    val clock_orientation: String? = null,
    val hidden_views: Any? = null,
    val combine_alerts: String? = null,

    // Views tab
    val projects_show_child_count: String? = null,
    val projects_show_checklist_count: String? = null,

    // Email tab
    val email_check_interval: String? = null,
    val email_max_pull: String? = null,
    val email_signature: String? = null,
    val email_bundles_count_display: String? = null,

    // Admin tab
    val instance_name: String? = null,
    val welcome_message: String? = null,
    val audit_log_pruning_enabled: String? = null,
    val tailscale_enabled: String? = null,
    val tailscale_auth_key: String? = null,
    val ntfy_enabled: String? = null,
    val ha_enabled: String? = null,
    val ha_poll_interval: String? = null,
    val kiosk_selected_tags: Any? = null
)
