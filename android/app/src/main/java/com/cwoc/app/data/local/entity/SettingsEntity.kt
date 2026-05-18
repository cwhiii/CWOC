package com.cwoc.app.data.local.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "settings")
data class SettingsEntity(
    @PrimaryKey val userId: String,
    val timeFormat: String?,
    val sex: String?,
    val snoozeLength: String?,
    val defaultFilters: String?,
    val alarmOrientation: String?,
    val activeClocks: String?,
    val savedLocations: String?,
    val tags: String?,
    val customColors: String?,
    val visualIndicators: String?,
    val chitOptions: String?,
    val calendarSnap: String?,
    val weekStartDay: String?,
    val workStartHour: String?,
    val workEndHour: String?,
    val workDays: String?,
    val enabledPeriods: String?,
    val customDaysCount: String?,
    val allViewStartHour: String?,
    val allViewEndHour: String?,
    val dayScrollToHour: String?,
    val username: String?,
    val unitSystem: String?,
    val habitsSuccessWindow: String?,
    val overdueBorderColor: String?,
    val blockedBorderColor: String?,
    val hidDeclined: String?,
    val defaultShowHabitsOnCalendar: String?,
    val defaultTimezone: String?,
    val defaultView: String?,
    val viewOrder: String?,
    val syncVersion: Int = 0,
    val lastSyncedAt: String?,

    // Audit settings
    val auditLogMaxDays: Int? = null,
    val auditLogMaxMb: Double? = null,

    // Notification defaults
    val defaultNotifications: String? = null,

    // Shared/kiosk
    val sharedTags: String? = null,
    val kioskUsers: String? = null,

    // Map settings
    val mapDefaultLat: String? = null,
    val mapDefaultLon: String? = null,
    val mapDefaultZoom: String? = null,
    val mapAutoZoom: String? = null,

    // Email settings
    val emailAccount: String? = null,
    val emailAccounts: String? = null,

    // Attachment limits
    val attachmentMaxSizeMb: String? = null,
    val attachmentMaxStorageMb: String? = null,

    // Sharing
    val defaultShareContacts: String? = null,

    // Autosave
    val checklistAutosave: String? = null,
    val autosaveDesktop: String? = null,
    val autosaveMobile: String? = null,

    // Tags
    val recentTags: String? = null,

    // Email pagination
    val paginateEmail: String? = null,

    // Bundles
    val bundlesMultiPlacement: Boolean? = null,
    val bundlesEnabled: Boolean? = null,
    val bundlesShowCount: String? = null,

    // Map thumbnails
    val showMapThumbnails: String? = null,

    // Session
    val sessionLifetime: String? = null,

    // Omni view
    val omniLayout: String? = null,
    val omniLockedFilters: String? = null,
    val omniHstClockMode: String? = null,
    val omniEmailCount: String? = null,
    val omniNormalizeColors: String? = null,

    // Smart actions
    val smartActionsConfig: String? = null,

    // Custom view filters
    val customViewFilters: String? = null,

    // Email privacy
    val emailBlockTrackingPixels: String? = null,
    val emailExternalContent: String? = null,
    val emailReadReceipts: String? = null,
    val emailUndoSendDelay: String? = null,
    val emailGroupBy: String? = null,

    // Timezone override
    val timezoneOverride: String? = null,

    // === Migration 7→8 columns ===

    // General tab
    @ColumnInfo(name = "clock_orientation") val clockOrientation: String? = null,
    @ColumnInfo(name = "landing_view") val landingView: String? = null,
    @ColumnInfo(name = "hidden_views") val hiddenViews: String? = null,
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

    // Phase 3 — dirty tracking for sync
    @ColumnInfo(defaultValue = "0")
    val isDirty: Boolean = false,
    val lastModified: String? = null
)
