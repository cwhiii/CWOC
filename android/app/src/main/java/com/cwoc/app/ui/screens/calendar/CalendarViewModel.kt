package com.cwoc.app.ui.screens.calendar

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cwoc.app.data.local.entity.ChitEntity
import com.cwoc.app.data.repository.ChitRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.temporal.TemporalAdjusters
import javax.inject.Inject

enum class CalendarViewMode {
    DAY, WEEK
}

data class CalendarUiState(
    val viewMode: CalendarViewMode = CalendarViewMode.DAY,
    val selectedDate: LocalDate = LocalDate.now(),
    val events: List<ChitEntity> = emptyList(),
    val isLoading: Boolean = true,
    val error: String? = null
) {
    /** Display title for the current date/period. */
    val headerTitle: String
        get() = when (viewMode) {
            CalendarViewMode.DAY -> selectedDate.format(DateTimeFormatter.ofPattern("EEEE, MMM d, yyyy"))
            CalendarViewMode.WEEK -> {
                val weekStart = selectedDate.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
                val weekEnd = weekStart.plusDays(6)
                val startFmt = weekStart.format(DateTimeFormatter.ofPattern("MMM d"))
                val endFmt = weekEnd.format(DateTimeFormatter.ofPattern("MMM d, yyyy"))
                "$startFmt – $endFmt"
            }
        }
}

@HiltViewModel
class CalendarViewModel @Inject constructor(
    private val chitRepository: ChitRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(CalendarUiState())
    val uiState: StateFlow<CalendarUiState> = _uiState.asStateFlow()

    init {
        loadEvents()
    }

    fun setViewMode(mode: CalendarViewMode) {
        _uiState.update { it.copy(viewMode = mode) }
        loadEvents()
    }

    fun previousPeriod() {
        _uiState.update { state ->
            val newDate = when (state.viewMode) {
                CalendarViewMode.DAY -> state.selectedDate.minusDays(1)
                CalendarViewMode.WEEK -> state.selectedDate.minusWeeks(1)
            }
            state.copy(selectedDate = newDate)
        }
        loadEvents()
    }

    fun nextPeriod() {
        _uiState.update { state ->
            val newDate = when (state.viewMode) {
                CalendarViewMode.DAY -> state.selectedDate.plusDays(1)
                CalendarViewMode.WEEK -> state.selectedDate.plusWeeks(1)
            }
            state.copy(selectedDate = newDate)
        }
        loadEvents()
    }

    fun goToToday() {
        _uiState.update { it.copy(selectedDate = LocalDate.now()) }
        loadEvents()
    }

    private fun loadEvents() {
        viewModelScope.launch {
            val state = _uiState.value
            val (dayStart, dayEnd) = getDateRange(state.selectedDate, state.viewMode)

            chitRepository.getChitsForDay(dayStart, dayEnd).collect { events ->
                _uiState.update {
                    it.copy(isLoading = false, events = events)
                }
            }
        }
    }

    private fun getDateRange(date: LocalDate, mode: CalendarViewMode): Pair<String, String> {
        return when (mode) {
            CalendarViewMode.DAY -> {
                val start = date.atStartOfDay().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)
                val end = date.plusDays(1).atStartOfDay().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)
                start to end
            }
            CalendarViewMode.WEEK -> {
                val weekStart = date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
                val start = weekStart.atStartOfDay().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)
                val end = weekStart.plusDays(7).atStartOfDay().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)
                start to end
            }
        }
    }
}
