package com.cwoc.app.domain.chart

import java.time.LocalDate
import java.time.temporal.ChronoUnit

/**
 * Time range options for chart filtering.
 */
enum class TimeRange(val days: Long?) {
    ONE_DAY(1),
    SEVEN_DAYS(7),
    THIRTY_DAYS(30),
    NINETY_DAYS(90),
    THREE_SIXTY_FIVE_DAYS(365),
    ALL(null)
}

/**
 * A single data point for chart rendering.
 */
data class ChartDataPoint(
    val date: LocalDate,
    val value: Float,
    val label: String? = null,
    val chitId: String? = null,
    val chitTitle: String? = null
)

/**
 * A data point mapped to pixel coordinates for Canvas rendering.
 */
data class MappedPoint(
    val x: Float,
    val y: Float,
    val dataPoint: ChartDataPoint
)

/**
 * Transforms raw health indicator data into chart-ready coordinates.
 *
 * Pure functions — no side effects, no state.
 */
object ChartDataTransformer {

    /**
     * Filter data points by a time range relative to today.
     */
    fun filterByRange(
        points: List<ChartDataPoint>,
        range: TimeRange,
        referenceDate: LocalDate = LocalDate.now()
    ): List<ChartDataPoint> {
        val filtered = if (range.days != null) {
            val cutoff = referenceDate.minusDays(range.days)
            points.filter { !it.date.isBefore(cutoff) && !it.date.isAfter(referenceDate) }
        } else {
            points.filter { !it.date.isAfter(referenceDate) }
        }
        return filtered.sortedBy { it.date }
    }

    /**
     * Map data points to pixel coordinates within a canvas area.
     *
     * X-axis: dates mapped linearly across canvas width
     * Y-axis: values mapped linearly across canvas height (inverted — 0 at bottom)
     */
    fun mapToPixels(
        points: List<ChartDataPoint>,
        canvasWidth: Float,
        canvasHeight: Float,
        padding: Float = 32f
    ): List<MappedPoint> {
        if (points.isEmpty()) return emptyList()

        val drawWidth = canvasWidth - (padding * 2)
        val drawHeight = canvasHeight - (padding * 2)

        val minVal = points.minOf { it.value }
        val maxVal = points.maxOf { it.value }
        val valueRange = if (maxVal == minVal) 1f else maxVal - minVal

        val minDate = points.first().date
        val maxDate = points.last().date
        val dateRange = ChronoUnit.DAYS.between(minDate, maxDate).toFloat()

        return points.map { point ->
            val xRatio = if (dateRange == 0f) 0.5f
            else ChronoUnit.DAYS.between(minDate, point.date).toFloat() / dateRange

            val yRatio = (point.value - minVal) / valueRange

            MappedPoint(
                x = padding + (xRatio * drawWidth),
                y = padding + ((1f - yRatio) * drawHeight),
                dataPoint = point
            )
        }
    }

    /**
     * Find the nearest data point to a tap coordinate.
     */
    fun hitTest(
        mappedPoints: List<MappedPoint>,
        tapX: Float,
        tapY: Float,
        maxDistance: Float = 48f
    ): MappedPoint? {
        if (mappedPoints.isEmpty()) return null

        var nearest: MappedPoint? = null
        var nearestDist = Float.MAX_VALUE

        for (point in mappedPoints) {
            val dx = point.x - tapX
            val dy = point.y - tapY
            val dist = kotlin.math.sqrt(dx * dx + dy * dy)
            if (dist < nearestDist) {
                nearestDist = dist
                nearest = point
            }
        }

        return if (nearestDist <= maxDistance) nearest else null
    }

    /**
     * Parse health_data JSON from a chit into ChartDataPoints.
     *
     * The actual format stored is a flat dict mapping UUID/legacy keys to values:
     *   {"uuid-1": 72, "uuid-2": 175.5, "heart_rate": 72}
     *
     * The date comes from the chit's own datetime fields (passed in separately).
     *
     * @param json The healthData JSON string from ChitEntity
     * @param chitDate The date to assign to all readings (from chit's start/due/created datetime)
     * @param chitId The chit's ID (for navigation)
     * @param chitTitle The chit's title (for display)
     * @return List of ChartDataPoints, one per reading key
     */
    fun parseHealthDataDict(
        json: String?,
        chitDate: LocalDate,
        chitId: String? = null,
        chitTitle: String? = null
    ): List<ChartDataPoint> {
        if (json.isNullOrBlank() || json == "{}" || json == "null" || json == "[]") return emptyList()

        return try {
            val gson = com.google.gson.Gson()
            val type = object : com.google.gson.reflect.TypeToken<Map<String, Any?>>() {}.type
            val dict: Map<String, Any?> = gson.fromJson(json, type)

            dict.mapNotNull { (key, rawValue) ->
                val value = when (rawValue) {
                    is Number -> rawValue.toFloat()
                    is Boolean -> if (rawValue) 1f else 0f
                    is String -> rawValue.toFloatOrNull()
                    else -> null
                } ?: return@mapNotNull null

                ChartDataPoint(
                    date = chitDate,
                    value = value,
                    label = key,
                    chitId = chitId,
                    chitTitle = chitTitle
                )
            }
        } catch (_: Exception) {
            emptyList()
        }
    }

    /**
     * Extract the best date from a ChitEntity's datetime fields.
     * Priority: startDatetime > dueDatetime > createdDatetime
     * Returns null if no valid date can be parsed.
     */
    fun extractDate(startDatetime: String?, dueDatetime: String?, createdDatetime: String?): LocalDate? {
        val dateStr = startDatetime ?: dueDatetime ?: createdDatetime ?: return null
        return try {
            // Take first 10 chars (YYYY-MM-DD) from ISO datetime string
            LocalDate.parse(dateStr.take(10))
        } catch (_: Exception) {
            null
        }
    }

    // ── Legacy methods (kept for test compatibility) ─────────────────────────

    /**
     * Legacy parser for the old array format: [{"type": "weight", "value": 185.5, "date": "2025-01-15"}, ...]
     * Kept for backward compatibility with existing tests.
     * The actual production code uses parseHealthDataDict() instead.
     */
    fun parseHealthData(json: String?): List<ChartDataPoint> {
        if (json.isNullOrBlank() || json == "[]" || json == "null" || json == "{}") return emptyList()

        return try {
            val gson = com.google.gson.Gson()

            // Try array format first (test format)
            try {
                val type = object : com.google.gson.reflect.TypeToken<List<Map<String, Any>>>() {}.type
                val rawItems: List<Map<String, Any>> = gson.fromJson(json, type)
                return rawItems.mapNotNull { raw ->
                    val value = (raw["value"] as? Double)?.toFloat() ?: return@mapNotNull null
                    val dateStr = raw["date"] as? String ?: return@mapNotNull null
                    val date = try {
                        LocalDate.parse(dateStr)
                    } catch (_: Exception) {
                        return@mapNotNull null
                    }
                    val label = raw["type"] as? String
                    ChartDataPoint(date = date, value = value, label = label)
                }
            } catch (_: Exception) {
                // Not array format — try dict format with today's date as fallback
                parseHealthDataDict(json, LocalDate.now())
            }
        } catch (_: Exception) {
            emptyList()
        }
    }

    /**
     * Group health data points by indicator type (label field).
     * Kept for backward compatibility with existing tests.
     */
    fun groupByType(points: List<ChartDataPoint>): Map<String, List<ChartDataPoint>> {
        return points.groupBy { it.label ?: "unknown" }
    }
}
