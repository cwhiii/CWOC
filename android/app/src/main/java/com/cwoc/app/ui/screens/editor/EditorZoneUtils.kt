package com.cwoc.app.ui.screens.editor

import androidx.compose.ui.graphics.Color
import com.cwoc.app.data.local.entity.SettingsEntity
import com.cwoc.app.data.remote.IndicatorObject

/**
 * Determines the background highlight color for a numeric field based on range bounds.
 *
 * Returns null (no highlight) when:
 * - Both rangeMin and rangeMax are null
 * - The value is empty or non-numeric
 * - The value is within [rangeMin, rangeMax] inclusive
 *
 * Returns Color(0xFFFFE0CC) (orange/red tint) when value > rangeMax.
 * Returns Color(0xFFCCE5FF) (blue tint) when value < rangeMin.
 * Handles one-sided ranges (only min or only max defined).
 */
fun rangeHighlightColor(value: String, rangeMin: Double?, rangeMax: Double?): Color? {
    if (rangeMin == null && rangeMax == null) return null
    if (value.isBlank()) return null
    val numericValue = value.toDoubleOrNull() ?: return null

    return when {
        rangeMax != null && numericValue > rangeMax -> Color(0xFFFFE0CC) // High — orange/red tint
        rangeMin != null && numericValue < rangeMin -> Color(0xFFCCE5FF) // Low — blue tint
        else -> null // Within bounds (inclusive)
    }
}

/**
 * Evaluates a conditional display rule against user settings.
 * Returns true if the object should be displayed.
 *
 * Used by both HealthIndicatorsZone and CustomZonePanels to filter
 * objects based on rules like {"setting": "sex", "equals": "male"}.
 *
 * @param rule The conditional_display map, e.g., {"setting": "sex", "equals": "male"}
 * @param settings The current user's SettingsEntity
 * @return true if no rule exists or rule matches; false if rule doesn't match or setting key is unknown
 */
fun evaluateConditionalDisplay(
    rule: Map<String, String>?,
    settings: SettingsEntity?
): Boolean {
    if (rule == null || rule.isEmpty()) return true
    val settingKey = rule["setting"] ?: return true
    val expectedValue = rule["equals"] ?: return true
    val actualValue = getSettingValue(settings, settingKey)
    return actualValue == expectedValue
}

/**
 * Retrieves a setting value by key name from SettingsEntity.
 * Maps known string keys to their corresponding entity fields.
 *
 * @param settings The user's settings entity (null returns null)
 * @param key The setting key name (e.g., "sex", "unit_system")
 * @return The setting value as a String, or null if the key is unknown or settings is null
 */
fun getSettingValue(settings: SettingsEntity?, key: String): String? {
    if (settings == null) return null
    return when (key) {
        "sex" -> settings.sex
        "unit_system" -> settings.unitSystem
        "time_format" -> settings.timeFormat
        "week_start_day" -> settings.weekStartDay
        "default_view" -> settings.defaultView
        "calendar_snap" -> settings.calendarSnap
        "snooze_length" -> settings.snoozeLength
        else -> null
    }
}

/**
 * Resolves the display unit label based on user's unit system preference.
 *
 * - Returns empty string for boolean/string value_types (no unit label for non-numeric fields)
 * - If metric and metric_units is non-null/non-empty → use metric_units
 * - Otherwise → use units (or empty string if null)
 *
 * @param obj The indicator/custom object with units and metric_units fields
 * @param settings The current user's SettingsEntity (for unitSystem)
 * @return The resolved unit label string
 */
fun resolveUnitLabel(obj: IndicatorObject, settings: SettingsEntity?): String {
    if (obj.value_type == "boolean" || obj.value_type == "string") return ""
    val isMetric = settings?.unitSystem == "metric"
    return if (isMetric && !obj.metric_units.isNullOrBlank()) {
        obj.metric_units
    } else {
        obj.units ?: ""
    }
}
