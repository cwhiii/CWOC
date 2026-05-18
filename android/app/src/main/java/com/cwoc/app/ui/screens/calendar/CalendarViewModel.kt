package com.cwoc.app.ui.screens.calendar

import android.content.SharedPreferences
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cwoc.app.data.local.entity.ChitEntity
import com.cwoc.app.data.repository.ChitRepository
import com.cwoc.app.data.repository.SettingsRepository
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
    DAY, WEEK, MONTH, YEAR, ITINERARY, X_DAY, WORK_HOURS
}

data class CalendarUiState(
    val viewMode: CalendarViewMode = CalendarViewMode.DAY,
    val selectedDate: LocalDate = LocalDate.now(),
    val events: List<ChitEntity> = emptyList(),
    val isLoading: Boolean = true,
    val error: String? = null,
    val xDayCount: Int = 7,
    val monthMode: String = "compress" // "compress" or "scroll"
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
            CalendarViewMode.MONTH -> selectedDate.format(DateTimeFormatter.ofPattern("MMMM yyyy"))
            CalendarViewMode.YEAR -> selectedDate.format(DateTimeFormatter.ofPattern("yyyy"))
            CalendarViewMode.ITINERARY -> {
                val endDate = LocalDate.now().plusDays(30)
                val startFmt = LocalDate.now().format(DateTimeFormatter.ofPattern("MMM d"))
                val endFmt = endDate.format(DateTimeFormatter.ofPattern("MMM d, yyyy"))
                "Itinerary: $startFmt – $endFmt"
            }
            CalendarViewMode.X_DAY -> {
                val endDate = selectedDate.plusDays(xDayCount.toLong() - 1)
                val startFmt = selectedDate.format(DateTimeFormatter.ofPattern("MMM d"))
                val endFmt = endDate.format(DateTimeFormatter.ofPattern("MMM d, yyyy"))
                "$xDayCount Days: $startFmt – $endFmt"
            }
            CalendarViewMode.WORK_HOURS -> "Work Hours: ${selectedDate.format(DateTimeFormatter.ofPattern("EEEE, MMM d"))}"
        }
}

@HiltViewModel
class CalendarViewModel @Inject constructor(
    private val chitRepository: ChitRepository,
    private val settingsRepository: SettingsRepository,
    private val sharedPreferences: SharedPreferences
) : ViewModel() {

    private val _uiState = MutableStateFlow(CalendarUiState())
    val uiState: StateFlow<CalendarUiState> = _uiState.asStateFlow()

    companion object {
        private const val PREF_KEY_VIEW_MODE = "calendar_view_mode"
        private const val DEFAULT_X_DAY_COUNT = 7
    }

    init {
        // Restore last-used view mode from SharedPreferences
        val savedMode = sharedPreferences.getString(PREF_KEY_VIEW_MODE, null)
        val restoredMode = savedMode?.let {
            try { CalendarViewMode.valueOf(it) } catch (_: IllegalArgumentException) { null }
        } ?: CalendarViewMode.DAY

        _uiState.update { it.copy(viewMode = restoredMode) }

        // Load xDayCount from settings, then load events
        viewModelScope.launch {
            val xDayCount = loadXDayCount()
            _uiState.update { it.copy(xDayCount = xDayCount) }
            loadEvents()
        }
    }

    fun setViewMode(mode: CalendarViewMode) {
        _uiState.update { it.copy(viewMode = mode) }
        persistViewMode(mode)
        loadEvents()
    }

    fun setMonthMode(mode: String) {
        _uiState.update { it.copy(monthMode = mode) }
    }

    fun previousPeriod() {
        _uiState.update { state ->
            val newDate = when (state.viewMode) {
                CalendarViewMode.DAY -> state.selectedDate.minusDays(1)
                CalendarViewMode.WEEK -> state.selectedDate.minusWeeks(1)
                CalendarViewMode.MONTH -> state.selectedDate.minusMonths(1)
                CalendarViewMode.YEAR -> state.selectedDate.minusYears(1)
                CalendarViewMode.ITINERARY -> state.selectedDate.minusDays(30)
                CalendarViewMode.X_DAY -> state.selectedDate.minusDays(state.xDayCount.toLong())
                CalendarViewMode.WORK_HOURS -> state.selectedDate.minusDays(1)
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
                CalendarViewMode.MONTH -> state.selectedDate.plusMonths(1)
                CalendarViewMode.YEAR -> state.selectedDate.plusYears(1)
                CalendarViewMode.ITINERARY -> state.selectedDate.plusDays(30)
                CalendarViewMode.X_DAY -> state.selectedDate.plusDays(state.xDayCount.toLong())
                CalendarViewMode.WORK_HOURS -> state.selectedDate.plusDays(1)
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
            val (dayStart, dayEnd) = getDateRange(state.selectedDate, state.viewMode, state.xDayCount)

            chitRepository.getChitsForDay(dayStart, dayEnd).collect { events ->
                _uiState.update {
                    it.copy(isLoading = false, events = events)
                }
            }
        }
    }

    private fun getDateRange(date: LocalDate, mode: CalendarViewMode, xDayCount: Int): Pair<String, String> {
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
            CalendarViewMode.MONTH -> {
                val monthStart = date.withDayOfMonth(1)
                val monthEnd = date.with(TemporalAdjusters.lastDayOfMonth())
                val start = monthStart.atStartOfDay().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)
                val end = monthEnd.plusDays(1).atStartOfDay().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)
                start to end
            }
            CalendarViewMode.YEAR -> {
                val yearStart = LocalDate.of(date.year, 1, 1)
                val yearEnd = LocalDate.of(date.year, 12, 31)
                val start = yearStart.atStartOfDay().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)
                val end = yearEnd.plusDays(1).atStartOfDay().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)
                start to end
            }
            CalendarViewMode.ITINERARY -> {
                val today = LocalDate.now()
                val start = today.atStartOfDay().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)
                val end = today.plusDays(31).atStartOfDay().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)
                start to end
            }
            CalendarViewMode.X_DAY -> {
                val start = date.atStartOfDay().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)
                val end = date.plusDays(xDayCount.toLong()).atStartOfDay().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)
                start to end
            }
            CalendarViewMode.WORK_HOURS -> {
                // Same as DAY — shows one day's events
                val start = date.atStartOfDay().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)
                val end = date.plusDays(1).atStartOfDay().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)
                start to end
            }
        }
    }

    /**
     * Persists the selected view mode to SharedPreferences.
     */
    private fun persistViewMode(mode: CalendarViewMode) {
        sharedPreferences.edit()
            .putString(PREF_KEY_VIEW_MODE, mode.name)
            .apply()
    }

    /**
     * Loads the X-Day count from settings (customDaysCount field).
     * Falls back to DEFAULT_X_DAY_COUNT (7) if not configured.
     */
    private suspend fun loadXDayCount(): Int {
        return try {
            val settings = settingsRepository.get()
            settings?.customDaysCount?.toIntOrNull() ?: DEFAULT_X_DAY_COUNT
        } catch (_: Exception) {
            DEFAULT_X_DAY_COUNT
        }
    }
}
