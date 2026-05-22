package com.cwoc.app.widget.refresh

/**
 * Data models for home screen widgets.
 * Each data class corresponds to a specific widget type and contains
 * the pre-processed fields needed for RemoteViews rendering.
 */

// ─── Omni View Widget ────────────────────────────────────────────────────────

/**
 * A single chit card for the Omni View widget's scrollable list.
 */
data class WidgetOmniItem(
    val id: String,
    val title: String?,
    val categoryColor: Int,       // resolved color int for left border
    val statusIcon: String?,      // status indicator type
    val dueDate: String?,         // formatted due date badge
    val priority: String?         // priority marker
)

// ─── Checklist Widget ────────────────────────────────────────────────────────

/**
 * A single checklist item for the Checklist widget's interactive list.
 */
data class WidgetChecklistItem(
    val index: Int,               // position in checklist JSON array
    val text: String,
    val checked: Boolean,
    val depth: Int                // nesting level (0-2)
)

/**
 * Summary info for a checklist chit, used in the config activity's selection list.
 */
data class WidgetChecklistSummary(
    val chitId: String,
    val title: String?
)

// ─── Upcoming Alarms Widget ──────────────────────────────────────────────────

/**
 * A single alarm entry for the Upcoming Alarms widget.
 */
data class WidgetAlarmItem(
    val chitId: String,
    val title: String?,           // truncated to 30 chars
    val triggerTime: Long,        // epoch millis
    val countdownText: String     // formatted: "Xd Yh", "Xh Ym", or "Xm"
)

// ─── Project Progress Widget ─────────────────────────────────────────────────

/**
 * Progress data for the Project Progress widget's bar and count display.
 */
data class WidgetProjectProgress(
    val projectId: String,
    val title: String?,
    val completedCount: Int,
    val totalCount: Int,
    val progressPercent: Float,   // 0.0 to 1.0
    val hstColor: Int?            // resolved color from HST hue/sat/tone, null = use default
)

/**
 * Summary info for a project chit, used in the config activity's selection list.
 */
data class WidgetProjectSummary(
    val chitId: String,
    val title: String?
)

// ─── Weather Widget ──────────────────────────────────────────────────────────

/**
 * Weather data for the Weather widget's condition display.
 */
data class WidgetWeatherData(
    val temperature: String,      // formatted with unit (e.g., "72°F" or "22°C")
    val conditionText: String,    // max 20 chars, truncated with ellipsis
    val weatherIcon: Int,         // drawable resource ID mapped from WMO code
    val lastUpdated: Long,        // epoch millis of last successful fetch
    val isStale: Boolean          // true if data is older than 30 min
)

// ─── Weekly Overview Widget ──────────────────────────────────────────────────

/**
 * A single day cell for the Weekly Overview widget's 7-day strip.
 */
data class WidgetDayCount(
    val date: String,             // ISO date string
    val dayAbbrev: String,        // "Mon", "Tue", etc.
    val dayNumber: Int,           // day of month
    val chitCount: Int,
    val isToday: Boolean
)
