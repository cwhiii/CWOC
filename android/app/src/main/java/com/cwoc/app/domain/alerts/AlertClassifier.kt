package com.cwoc.app.domain.alerts

import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

/**
 * Alert section classification.
 */
enum class AlertSection {
    UPCOMING,
    PAST
}

/**
 * A classified alert with its section assignment and display data.
 */
data class ClassifiedAlert(
    val chitId: String,
    val chitTitle: String?,
    val alertType: String,          // "notification", "alarm", "timer", "stopwatch"
    val scheduledTime: LocalDateTime,
    val section: AlertSection,
    // R6: Fields for filtering
    val chitStatus: String? = null,
    val chitTags: List<String>? = null,
    // Chit color for card background (matching web's applyChitColors)
    val chitColor: String? = null
)

/**
 * Raw alert data as stored in the chit's alerts JSON field.
 */
data class RawAlert(
    val type: String?,              // "alarm", "reminder", "timer"
    val datetime: String?,          // ISO datetime string
    val offset: Int? = null,        // minutes before event
    val label: String? = null
)

/**
 * Classifies alerts into UPCOMING and PAST sections based on a reference time.
 *
 * - UPCOMING: alerts whose scheduled time is in the future (>= referenceTime)
 * - PAST: alerts whose scheduled time has already passed (< referenceTime)
 *
 * Within each section, alerts are sorted ascending by scheduled time.
 */
object AlertClassifier {

    /**
     * Classify a list of raw alerts from a chit into sections.
     *
     * @param chitId The chit's ID
     * @param chitTitle The chit's title for display
     * @param alerts List of raw alert data
     * @param referenceTime The current time to partition against (defaults to now)
     * @return List of ClassifiedAlerts sorted by section (UPCOMING first) then time ascending
     */
    fun classifyAlerts(
        chitId: String,
        chitTitle: String?,
        alerts: List<RawAlert>,
        referenceTime: LocalDateTime = LocalDateTime.now(),
        chitStatus: String? = null,
        chitTags: List<String>? = null,
        chitColor: String? = null
    ): List<ClassifiedAlert> {
        return alerts.mapNotNull { alert ->
            val scheduledTime = parseAlertTime(alert.datetime) ?: return@mapNotNull null
            val section = if (scheduledTime.isBefore(referenceTime)) {
                AlertSection.PAST
            } else {
                AlertSection.UPCOMING
            }

            ClassifiedAlert(
                chitId = chitId,
                chitTitle = chitTitle,
                alertType = alert.type ?: "notification",
                scheduledTime = scheduledTime,
                section = section,
                chitStatus = chitStatus,
                chitTags = chitTags,
                chitColor = chitColor
            )
        }.sortedWith(
            compareBy<ClassifiedAlert> { it.section.ordinal } // UPCOMING (0) before PAST (1)
                .thenBy { it.scheduledTime }
        )
    }

    /**
     * Parse an alert JSON string into a list of RawAlerts.
     */
    fun parseAlerts(json: String?): List<RawAlert> {
        if (json.isNullOrBlank() || json == "[]" || json == "null") return emptyList()

        return try {
            val gson = com.google.gson.Gson()
            val type = object : com.google.gson.reflect.TypeToken<List<Map<String, Any>>>() {}.type
            val rawItems: List<Map<String, Any>> = gson.fromJson(json, type)

            rawItems.map { raw ->
                RawAlert(
                    type = raw["type"] as? String,
                    datetime = raw["datetime"] as? String,
                    offset = (raw["offset"] as? Double)?.toInt(),
                    label = raw["label"] as? String
                )
            }
        } catch (_: Exception) {
            emptyList()
        }
    }

    private fun parseAlertTime(datetime: String?): LocalDateTime? {
        if (datetime.isNullOrBlank()) return null
        return try {
            LocalDateTime.parse(datetime, DateTimeFormatter.ISO_LOCAL_DATE_TIME)
        } catch (_: Exception) {
            try {
                // Try without seconds
                LocalDateTime.parse(datetime, DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm"))
            } catch (_: Exception) {
                null
            }
        }
    }
}
