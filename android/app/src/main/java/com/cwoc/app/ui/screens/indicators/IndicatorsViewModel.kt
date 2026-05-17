package com.cwoc.app.ui.screens.indicators

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cwoc.app.data.repository.ChitRepository
import com.cwoc.app.domain.chart.ChartDataPoint
import com.cwoc.app.domain.chart.ChartDataTransformer
import com.cwoc.app.domain.chart.TimeRange
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Data class representing a single indicator chart with its data.
 */
data class IndicatorChart(
    val type: String,
    val points: List<ChartDataPoint>
)

/**
 * ViewModel for the Indicators/Health Charts view.
 * Loads health data from chits and groups by indicator type.
 */
@HiltViewModel
class IndicatorsViewModel @Inject constructor(
    private val chitRepository: ChitRepository
) : ViewModel() {

    private val _charts = MutableStateFlow<List<IndicatorChart>>(emptyList())
    val charts: StateFlow<List<IndicatorChart>> = _charts.asStateFlow()

    private val _selectedRange = MutableStateFlow(TimeRange.THIRTY_DAYS)
    val selectedRange: StateFlow<TimeRange> = _selectedRange.asStateFlow()

    init {
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
