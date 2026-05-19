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
    val points: List<ChartDataPoint>
)

/**
 * A single health data entry for calendar/log views, including the source chit title.
 */
data class HealthEntry(
    val date: LocalDate,
    val indicatorType: String,
    val value: Float,
    val chitTitle: String?,
    val objectId: String? = null
)

/**
 * ViewModel for the Indicators/Health Charts view.
 * Loads health data from chits and groups by indicator type.
 * Fetches Custom Objects for range classification in Calendar view.
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

    /** Custom Objects for range classification. */
    private val _indicatorObjects = MutableStateFlow<List<IndicatorObject>>(emptyList())
    val indicatorObjects: StateFlow<List<IndicatorObject>> = _indicatorObjects.asStateFlow()

    /** All health entries for calendar and log views. */
    private val _healthEntries = MutableStateFlow<List<HealthEntry>>(emptyList())
    val healthEntries: StateFlow<List<HealthEntry>> = _healthEntries.asStateFlow()

    init {
        // Fetch Custom Objects for range classification
        viewModelScope.launch {
            try {
                val response = apiService.getCustomObjectsForZone("indicators_zone")
                if (response.isSuccessful) {
                    _indicatorObjects.value = response.body() ?: emptyList()
                }
            } catch (_: Exception) {}
        }

        viewModelScope.launch {
            chitRepository.getIndicatorChits().collect { chits ->
                val allPoints = chits.flatMap { chit ->
                    ChartDataTransformer.parseHealthData(chit.healthData)
                }
                val grouped = ChartDataTransformer.groupByType(allPoints)
                _charts.value = grouped.map { (type, points) ->
                    val filtered = ChartDataTransformer.filterByRange(points, _selectedRange.value)
                    IndicatorChart(type = type, points = filtered)
                }

                // Build health entries for calendar/log modes
                _healthEntries.value = chits.flatMap { chit ->
                    ChartDataTransformer.parseHealthData(chit.healthData).map { point ->
                        HealthEntry(
                            date = point.date,
                            indicatorType = point.label ?: "unknown",
                            value = point.value,
                            chitTitle = chit.title
                        )
                    }
                }
            }
        }
    }

    fun setTimeRange(range: TimeRange) {
        _selectedRange.value = range
        // Re-filter existing data
        viewModelScope.launch {
            chitRepository.getIndicatorChits().collect { chits ->
                val allPoints = chits.flatMap { chit ->
                    ChartDataTransformer.parseHealthData(chit.healthData)
                }
                val grouped = ChartDataTransformer.groupByType(allPoints)
                _charts.value = grouped.map { (type, points) ->
                    val filtered = ChartDataTransformer.filterByRange(points, range)
                    IndicatorChart(type = type, points = filtered)
                }
            }
        }
    }
}
