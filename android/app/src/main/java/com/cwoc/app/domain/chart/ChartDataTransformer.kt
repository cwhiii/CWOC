package com.cwoc.app.domain.chart

import java.time.LocalDate
import java.time.temporal.ChronoUnit
import kotlin.math.abs

/**
 * Time range options for chart filtering.
 */
enum class TimeRange(val days: Long?) {
    SEVEN_DAYS(7),
    THIRTY_DAYS(30),
    NINETY_DAYS(90),
    ALL(null)
}

/**
 * Chart type options.
 */
enum class ChartType {
    LINE,
    BAR,
    SPARKLINE
}

/**
 * A single data point for chart rendering.
 */
data class ChartDataPoint(
    val date: LocalDate,
    val value: Float,
    val label: String? = null
)

/**
 * Chart configuration for rendering.
 */
data class ChartConfig(
    val indicatorType: String,
    val chartType: ChartType = ChartType.LINE,
    val timeRange: TimeRange = TimeRange.THIRTY_DAYS,
    val minValue: Float = 0f,
    val maxValue: Float = 100f
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
     *
     * @param points All available data points
     * @param range The time range to filter by
     * @param referenceDate The reference date (defaults to today)
     * @return Filtered and sorted data points within the range
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
     *
     * @param points Sorted data points to map
     * @param canvasWidth Available width in pixels
     * @param canvasHeight Available height in pixels
     * @param padding Padding from edges in pixels
     * @return List of MappedPoints with x,y coordinates
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

        // Compute value range
        val minVal = points.minOf { it.value }
        val maxVal = points.maxOf { it.value }
        val valueRange = if (maxVal == minVal) 1f else maxVal - minVal

        // Compute date range
        val minDate = points.first().date
        val maxDate = points.last().date
        val dateRange = ChronoUnit.DAYS.between(minDate, maxDate).toFloat()

        return points.map { point ->
            val xRatio = if (dateRange == 0f) 0.5f
            else ChronoUnit.DAYS.between(minDate, point.date).toFloat() / dateRange

            val yRatio = (point.value - minVal) / valueRange

            MappedPoint(
                x = padding + (xRatio * drawWidth),
                y = padding + ((1f - yRatio) * drawHeight), // invert Y (0 at bottom)
                dataPoint = point
            )
        }
    }

    /**
     * Find the nearest data point to a tap coordinate.
     *
     * @param mappedPoints The mapped points with pixel coordinates
     * @param tapX The X coordinate of the tap
     * @param tapY The Y coordinate of the tap
     * @param maxDistance Maximum distance in pixels to consider a hit (default 48dp)
     * @return The nearest MappedPoint, or null if none within maxDistance
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
     * Parse health data JSON from a chit into ChartDataPoints.
     *
     * Expected JSON format: [{"type": "weight", "value": 185.5, "date": "2025-01-15"}, ...]
     */
    fun parseHealthData(json: String?): List<ChartDataPoint> {
        if (json.isNullOrBlank() || json == "[]" || json == "null") return emptyList()

        return try {
            val gson = com.google.gson.Gson()
            val type = object : com.google.gson.reflect.TypeToken<List<Map<String, Any>>>() {}.type
            val rawItems: List<Map<String, Any>> = gson.fromJson(json, type)

            rawItems.mapNotNull { raw ->
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
            emptyList()
        }
    }

    /**
     * Group health data points by indicator type.
     */
    fun groupByType(points: List<ChartDataPoint>): Map<String, List<ChartDataPoint>> {
        return points.groupBy { it.label ?: "unknown" }
    }
}
