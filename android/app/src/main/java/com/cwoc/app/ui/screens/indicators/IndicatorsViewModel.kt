package com.cwoc.app.ui.screens.indicators

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cwoc.app.data.remote.CwocApiService
import com.cwoc.app.data.remote.IndicatorObject
import com.cwoc.app.data.repository.ChitRepository
import com.cwoc.app.domain.chart.ChartDataPoint
import com.cwoc.app.domain.chart.ChartDataTransformer
import com.cwoc.app.domain.chart.TimeRange
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.LocalDate
import javax.inject.Inject

/**
 * Data class representing a single indicator chart with its data.
 */
data class IndicatorChart(
    val type: String,
    val displayName: String = "",
    val unit: String = "",
    val points: List<ChartDataPoint>
)

/**
 * A single health data entry for calendar/log views.
 */
data class HealthEntry(
    val date: LocalDate,
    val indicatorType: String,
    val value: Float,
    val chitTitle: String?,
    val chitId: String? = null,
    val objectId: String? = null
)

/**
 * ViewModel for the Indicators/Health Charts view.
 *
 * Loads health data from local Room chits, parses the health_data dict format,
 * and uses Custom Objects from the "graphs" and "indicators_zone" zones to
 * determine which charts to show and how to classify readings.
 */
@HiltViewModel
class IndicatorsViewModel @Inject constructor(
    private val chitRepository: ChitRepository,
    private val apiService: CwocApiService
) : ViewModel() {

    private val _charts = MutableStateFlow<List<IndicatorChart>>(emptyList())
    val charts: StateFlow<List<IndicatorChart>> = _charts.asStateFlow()

    private val _selectedRange = MutableStateFlow(TimeRange.THIRTY_DAYS)
    val selectedRange: StateFlow<TimeRange> = _selectedRange.asStateFlow()

    /** Custom Objects from indicators_zone — for range classification in Calendar view. */
    private val _indicatorObjects = MutableStateFlow<List<IndicatorObject>>(emptyList())
    val indicatorObjects: StateFlow<List<IndicatorObject>> = _indicatorObjects.asStateFlow()

    /** Custom Objects from graphs zone — determines which charts to show. */
    private val _graphObjects = MutableStateFlow<List<IndicatorObject>>(emptyList())

    /** All health entries for calendar and log views. */
    private val _healthEntries = MutableStateFlow<List<HealthEntry>>(emptyList())
    val healthEntries: StateFlow<List<HealthEntry>> = _healthEntries.asStateFlow()

    /** All parsed data points (unfiltered by time range). */
    private var allDataPoints: List<ChartDataPoint> = emptyList()

    /** Map of object ID → IndicatorObject for name/unit resolution. */
    private var objectLookup: Map<String, IndicatorObject> = emptyMap()

    init {
        viewModelScope.launch {
            // Fetch both zone objects FIRST, then process chit data
            val indicatorsDef = async { fetchZoneObjects("indicators_zone") }
            val graphsDef = async { fetchZoneObjects("graphs") }

            val indicatorObjs = indicatorsDef.await()
            val graphObjs = graphsDef.await()

            _indicatorObjects.value = indicatorObjs
            _graphObjects.value = graphObjs
            objectLookup = (indicatorObjs + graphObjs).associateBy { it.id }

            // Now collect chit data (this is a Flow, so it will re-emit on changes)
            chitRepository.getIndicatorChits().collect { chits ->
                processChitData(chits)
            }
        }
    }

    private suspend fun fetchZoneObjects(zoneId: String): List<IndicatorObject> {
        return try {
            val response = apiService.getCustomObjectsForZone(zoneId)
            if (response.isSuccessful) response.body() ?: emptyList() else emptyList()
        } catch (_: Exception) {
            emptyList()
        }
    }

    private fun processChitData(chits: List<com.cwoc.app.data.local.entity.ChitEntity>) {
        // Parse all health data from chits using the correct dict format
        allDataPoints = chits.flatMap { chit ->
            val date = ChartDataTransformer.extractDate(
                chit.startDatetime, chit.dueDatetime, chit.createdDatetime
            ) ?: return@flatMap emptyList()

            ChartDataTransformer.parseHealthDataDict(
                json = chit.healthData,
                chitDate = date,
                chitId = chit.id,
                chitTitle = chit.title
            )
        }

        // Build health entries for calendar/log modes — only include indicator-zone objects
        val indicatorIds = _indicatorObjects.value.map { it.id }.toSet()
        _healthEntries.value = allDataPoints
            .filter { point -> point.label in indicatorIds }
            .map { point ->
                val obj = objectLookup[point.label]
                HealthEntry(
                    date = point.date,
                    indicatorType = obj?.name ?: point.label ?: "Unknown",
                    value = point.value,
                    chitTitle = point.chitTitle,
                    chitId = point.chitId,
                    objectId = point.label
                )
            }

        // Build charts (filtered by time range)
        rebuildCharts()
    }

    fun setTimeRange(range: TimeRange) {
        _selectedRange.value = range
        rebuildCharts()
    }

    private fun rebuildCharts() {
        val range = _selectedRange.value
        val graphObjs = _graphObjects.value
        val indicatorObjs = _indicatorObjects.value

        // Group all data points by their key (UUID or legacy key)
        val grouped = allDataPoints.groupBy { it.label ?: "unknown" }

        // Determine which keys to chart:
        // Use graphs zone objects if available, otherwise fall back to indicators_zone objects.
        // Never show ALL keys — only objects explicitly assigned to a zone.
        val chartKeys: List<String> = if (graphObjs.isNotEmpty()) {
            graphObjs
                .filter { it.value_type != "boolean" && it.value_type != "string" }
                .map { it.id }
                .filter { grouped.containsKey(it) }
        } else if (indicatorObjs.isNotEmpty()) {
            indicatorObjs
                .filter { it.value_type != "boolean" && it.value_type != "string" }
                .map { it.id }
                .filter { grouped.containsKey(it) }
        } else {
            emptyList()
        }

        _charts.value = chartKeys.map { key ->
            val points = grouped[key] ?: emptyList()
            val filtered = ChartDataTransformer.filterByRange(points, range)
            val obj = objectLookup[key]
            IndicatorChart(
                type = key,
                displayName = obj?.name ?: formatLegacyKey(key),
                unit = obj?.units ?: "",
                points = filtered
            )
        }.filter { it.points.isNotEmpty() }
    }

    /**
     * Format a legacy key like "heart_rate" into "Heart Rate" for display.
     */
    private fun formatLegacyKey(key: String): String {
        return key.replace("_", " ").split(" ").joinToString(" ") { word ->
            word.replaceFirstChar { it.uppercase() }
        }
    }
}
