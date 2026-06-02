package com.cwoc.app.ui.screens.calendar

import android.content.SharedPreferences
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cwoc.app.data.local.entity.ChitEntity
import com.cwoc.app.data.repository.ChitRepository
import com.cwoc.app.data.repository.SettingsRepository
import com.cwoc.app.data.sync.SyncState
import com.cwoc.app.data.sync.SyncStateManager
import com.cwoc.app.domain.recurrence.RecurrenceEngine
import com.cwoc.app.domain.recurrence.RecurrenceException
import com.cwoc.app.domain.recurrence.RecurrenceRule
import com.cwoc.app.domain.settings.PeriodFilterUtil
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.LocalDateTime
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
    val monthMode: String = "compress", // "compress" or "scroll"
    val timeFormat: String = "12hour", // "12hour" or "24hour"
    val dayScrollToHour: Int = 6, // hour to auto-scroll to on load
    val calendarSnap: Int = 15, // snap grid minutes for drag
    val workStartHour: Int = 8,
    val workEndHour: Int = 18,
    val weekStartDay: String = "0", // 0=Sunday, 1=Monday, etc.
    val allViewStartHour: Int = 0, // hour range start for non-work views
    val allViewEndHour: Int = 24, // hour range end for non-work views
    val workDays: List<Int> = listOf(1, 2, 3, 4, 5), // day numbers (0=Sun, 1=Mon, ...)
    val enabledPeriods: List<String> = listOf("Itinerary", "Day", "Work", "Week", "SevenDay", "Month", "Year")
) {
    /** Display title for the current date/period. */
    val headerTitle: String
        get() = when (viewMode) {
            CalendarViewMode.DAY -> selectedDate.format(DateTimeFormatter.ofPattern("EEEE, MMM d, yyyy"))
            CalendarViewMode.WEEK -> {
                val startDow = calendarParseWeekStartDay(weekStartDay)
                val weekStart = selectedDate.with(TemporalAdjusters.previousOrSame(startDow))
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
    private val sharedPreferences: SharedPreferences,
    private val apiService: com.cwoc.app.data.remote.CwocApiService,
    private val syncStateManager: SyncStateManager,
    private val syncEngine: com.cwoc.app.data.sync.SyncEngine
) : ViewModel() {

    private val vmCreatedAt = System.nanoTime()

    /** Aggregated sync state for the UI indicator. */
    val syncState: StateFlow<SyncState> = syncStateManager.syncState

    private val _uiState = MutableStateFlow(CalendarUiState())
    val uiState: StateFlow<CalendarUiState> = _uiState.asStateFlow()

    /** Active loadEvents coroutine — cancelled before each new load to prevent stacking. */
    private var loadEventsJob: Job? = null

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

        // Load settings (xDayCount, timeFormat, scrollToHour, snap, work hours, week start, etc.), then load events
        viewModelScope.launch {
            val xDayCount = loadXDayCount()
            val settings = settingsRepository.get()
            val timeFormat = settings?.timeFormat ?: "12hour"
            val scrollToHour = settings?.dayScrollToHour?.toIntOrNull() ?: 6
            val snap = settings?.calendarSnap?.toIntOrNull() ?: 15
            val workStart = settings?.workStartHour?.toIntOrNull() ?: 8
            val workEnd = settings?.workEndHour?.toIntOrNull() ?: 18
            val weekStart = settings?.weekStartDay ?: "0"
            val allStart = settings?.allViewStartHour?.toIntOrNull() ?: 0
            val allEnd = settings?.allViewEndHour?.toIntOrNull() ?: 24
            val workDays = settings?.workDays?.split(",")?.mapNotNull { it.trim().toIntOrNull() } ?: listOf(1, 2, 3, 4, 5)
            val enabledPeriods = PeriodFilterUtil.filterEnabledPeriods(PeriodFilterUtil.DISPLAY_ORDER, settings?.enabledPeriods)
            _uiState.update {
                it.copy(
                    xDayCount = xDayCount,
                    timeFormat = timeFormat,
                    dayScrollToHour = scrollToHour,
                    calendarSnap = snap,
                    workStartHour = workStart,
                    workEndHour = workEnd,
                    weekStartDay = weekStart,
                    allViewStartHour = allStart,
                    allViewEndHour = allEnd,
                    workDays = workDays,
                    enabledPeriods = enabledPeriods
                )
            }
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

    fun setDate(date: LocalDate) {
        _uiState.update { it.copy(selectedDate = date) }
        loadEvents()
    }

    private fun loadEvents() {
        loadEventsJob?.cancel()
        loadEventsJob = viewModelScope.launch {
            val loadStart = System.nanoTime()
            val sinceVmCreated = (loadStart - vmCreatedAt) / 1_000_000
            android.util.Log.d("PERF", "[CalendarVM] loadEvents START (${sinceVmCreated}ms since VM created)")
            val state = _uiState.value
            val (dayStart, dayEnd) = getDateRange(state.selectedDate, state.viewMode, state.xDayCount)

            // Combine non-recurring events in range with expanded recurring events
            combine(
                chitRepository.getChitsForDay(dayStart, dayEnd),
                chitRepository.getRecurringChits()
            ) { rangeEvents, recurringChits ->
                // Filter out chits hidden from calendar (matches web's show_on_calendar filter)
                val visibleRangeEvents = rangeEvents.filter { it.showOnCalendar != false }
                val visibleRecurringChits = recurringChits.filter { it.showOnCalendar != false }

                // Parse the date range for recurrence expansion
                // Use the actual visible range start (no buffer before) to avoid generating
                // instances that would need to be filtered out by the rendering layer.
                // The buffer is only needed for multi-day events that START before the range
                // but EXTEND into it — those are already handled by getChitsForDay.
                val rangeStartDate = when (state.viewMode) {
                    CalendarViewMode.DAY, CalendarViewMode.WORK_HOURS -> state.selectedDate
                    CalendarViewMode.WEEK -> {
                        val startDow = calendarParseWeekStartDay(state.weekStartDay)
                        state.selectedDate.with(TemporalAdjusters.previousOrSame(startDow))
                    }
                    CalendarViewMode.MONTH -> state.selectedDate.withDayOfMonth(1)
                    CalendarViewMode.YEAR -> LocalDate.of(state.selectedDate.year, 1, 1)
                    CalendarViewMode.ITINERARY -> state.selectedDate
                    CalendarViewMode.X_DAY -> state.selectedDate
                }
                val rangeEndDate = when (state.viewMode) {
                    CalendarViewMode.DAY, CalendarViewMode.WORK_HOURS -> state.selectedDate.plusDays(1)
                    CalendarViewMode.WEEK -> {
                        val startDow = calendarParseWeekStartDay(state.weekStartDay)
                        state.selectedDate.with(TemporalAdjusters.previousOrSame(startDow)).plusDays(7)
                    }
                    CalendarViewMode.MONTH -> state.selectedDate.plusMonths(1).plusDays(7)
                    CalendarViewMode.YEAR -> state.selectedDate.plusYears(1)
                    CalendarViewMode.ITINERARY -> state.selectedDate.plusDays(31)
                    CalendarViewMode.X_DAY -> state.selectedDate.plusDays(state.xDayCount.toLong())
                }

                // Expand recurring chits into virtual instances
                val engine = RecurrenceEngine()
                val expandedInstances = mutableListOf<ChitEntity>()
                val recurringIds = mutableSetOf<String>()

                visibleRecurringChits.forEach { chit ->
                    recurringIds.add(chit.id)
                    val rule = parseRecurrenceRule(chit.recurrenceRule) ?: return@forEach
                    val baseStart = parseLocalDateTime(chit.startDatetime ?: chit.dueDatetime ?: chit.pointInTime) ?: return@forEach
                    val baseEnd = chit.endDatetime?.let { parseLocalDateTime(it) }
                    val exceptions = parseRecurrenceExceptions(chit.recurrenceExceptions)

                    val instances = engine.expand(
                        rule = rule,
                        baseStart = baseStart,
                        baseEnd = baseEnd,
                        rangeStart = rangeStartDate,
                        rangeEnd = rangeEndDate,
                        exceptions = exceptions,
                        timezone = chit.timezone ?: "UTC"
                    )

                    instances.forEach { instance ->
                        // Create a virtual copy of the chit with the instance's dates.
                        // Clear dueDatetime and pointInTime so getCalendarDateInfoForEvent
                        // uses startDatetime (the expanded date) instead of the original
                        // due/pit date — otherwise ALL instances pile up on the original date.
                        val virtualChit = chit.copy(
                            id = "${chit.id}_v_${instance.date}",
                            startDatetime = instance.startDatetime?.format(java.time.format.DateTimeFormatter.ISO_LOCAL_DATE_TIME),
                            endDatetime = instance.endDatetime?.format(java.time.format.DateTimeFormatter.ISO_LOCAL_DATE_TIME),
                            dueDatetime = null,
                            pointInTime = null,
                            // Clear recurrence on virtual instances so they don't get re-expanded
                            recurrenceRule = null
                        )
                        expandedInstances.add(virtualChit)
                    }
                }

                // Merge: non-recurring events from range + expanded instances + birthdays
                // Exclude the base recurring chits from rangeEvents (they're replaced by instances)
                val nonRecurring = visibleRangeEvents.filter { it.id !in recurringIds }
                val birthdayChits = loadBirthdayChits()
                // Expand birthday recurrences too (they repeat yearly)
                val expandedBirthdays = mutableListOf<ChitEntity>()
                birthdayChits.forEach { bChit ->
                    val bRule = parseRecurrenceRule(bChit.recurrenceRule)
                    if (bRule != null) {
                        val bStart = parseLocalDateTime(bChit.startDatetime) ?: return@forEach
                        val bInstances = engine.expand(bRule, bStart, null, rangeStartDate, rangeEndDate)
                        bInstances.forEach { inst ->
                            expandedBirthdays.add(bChit.copy(
                                id = "${bChit.id}_b_${inst.date}",
                                startDatetime = inst.startDatetime?.format(java.time.format.DateTimeFormatter.ISO_LOCAL_DATE_TIME),
                                endDatetime = inst.endDatetime?.format(java.time.format.DateTimeFormatter.ISO_LOCAL_DATE_TIME),
                                dueDatetime = null,
                                pointInTime = null,
                                recurrenceRule = null
                            ))
                        }
                    } else {
                        // Non-recurring birthday — include if in range
                        val bDate = parseLocalDateTime(bChit.startDatetime)?.toLocalDate()
                        if (bDate != null && !bDate.isBefore(rangeStartDate) && !bDate.isAfter(rangeEndDate)) {
                            expandedBirthdays.add(bChit)
                        }
                    }
                }
                nonRecurring + expandedInstances + expandedBirthdays
            }.collect { mergedEvents ->
                _uiState.update {
                    it.copy(isLoading = false, events = mergedEvents.distinctBy { e -> e.id })
                }
                val elapsed = (System.nanoTime() - loadStart) / 1_000_000
                android.util.Log.d("PERF", "[CalendarVM] *** loadEvents COMPLETE — ${elapsed}ms, ${mergedEvents.size} events ***")
                viewModelScope.launch { syncEngine.reportLog("[PERF] CalendarVM: loadEvents took ${elapsed}ms, ${mergedEvents.size} events", "info") }
            }
        }
    }

    // ── Recurrence parsing helpers ───────────────────────────────────────────

    /** Cached birthday chits — fetched once and reused across date navigations. */
    private var _birthdayChits: List<ChitEntity>? = null

    private suspend fun loadBirthdayChits(): List<ChitEntity> {
        _birthdayChits?.let { return it }
        return try {
            val response = apiService.getContactBirthdays()
            if (!response.isSuccessful) return emptyList()
            val rawList = response.body() ?: return emptyList()
            val chits = rawList.mapNotNull { map ->
                try {
                    ChitEntity(
                        id = (map["id"] as? String) ?: return@mapNotNull null,
                        title = map["title"] as? String,
                        note = null,
                        tags = null,
                        startDatetime = map["start_datetime"] as? String,
                        endDatetime = map["end_datetime"] as? String,
                        dueDatetime = map["due_datetime"] as? String,
                        pointInTime = map["point_in_time"] as? String,
                        completedDatetime = null,
                        status = null,
                        priority = null,
                        severity = null,
                        checklist = null,
                        alarm = null,
                        notification = null,
                        recurrence = null,
                        recurrenceId = null,
                        recurrenceRule = map["recurrence_rule"]?.let { Gson().toJson(it) },
                        recurrenceExceptions = null,
                        location = null,
                        color = map["color"] as? String,
                        people = (map["people"] as? List<*>)?.filterIsInstance<String>(),
                        pinned = false,
                        archived = false,
                        deleted = false,
                        createdDatetime = null,
                        modifiedDatetime = null,
                        isProjectMaster = false,
                        childChits = null,
                        allDay = (map["all_day"] as? Boolean) ?: true,
                        timezone = null,
                        alerts = null,
                        progressPercent = null,
                        timeEstimate = null,
                        weatherData = null,
                        healthData = null,
                        habit = false,
                        habitGoal = null,
                        habitSuccess = null,
                        showOnCalendar = true,
                        habitResetPeriod = null,
                        habitLastActionDate = null,
                        habitHideOverall = null,
                        perpetual = false,
                        shares = null,
                        stealth = null,
                        assignedTo = null,
                        ownerId = null,
                        hasUnviewedConflict = false,
                        availability = null,
                        snoozedUntil = null,
                        prerequisites = null,
                        syncVersion = 0,
                        lastSyncedAt = null,
                        locations = null
                    )
                } catch (_: Exception) { null }
            }
            _birthdayChits = chits
            chits
        } catch (_: Exception) { emptyList() }
    }

    private fun parseRecurrenceRule(json: String?): RecurrenceRule? {
        if (json.isNullOrBlank() || json == "null") return null
        return try {
            val gson = Gson()
            gson.fromJson(json, RecurrenceRule::class.java)
        } catch (_: Exception) { null }
    }

    private fun parseRecurrenceExceptions(json: String?): List<RecurrenceException> {
        if (json.isNullOrBlank() || json == "null" || json == "[]") return emptyList()
        return try {
            val gson = Gson()
            val type = object : TypeToken<List<RecurrenceException>>() {}.type
            gson.fromJson(json, type) ?: emptyList()
        } catch (_: Exception) { emptyList() }
    }

    private fun parseLocalDateTime(dateStr: String?): LocalDateTime? {
        if (dateStr.isNullOrBlank()) return null
        return try {
            val cleaned = dateStr.replace("Z", "")
            if (cleaned.contains("T")) {
                LocalDateTime.parse(cleaned, java.time.format.DateTimeFormatter.ISO_LOCAL_DATE_TIME)
            } else {
                LocalDate.parse(cleaned).atStartOfDay()
            }
        } catch (_: Exception) { null }
    }

    private fun getDateRange(date: LocalDate, mode: CalendarViewMode, xDayCount: Int): Pair<String, String> {
        return when (mode) {
            CalendarViewMode.DAY -> {
                val start = date.atStartOfDay().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)
                val end = date.plusDays(1).atStartOfDay().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)
                start to end
            }
            CalendarViewMode.WEEK -> {
                val startDow = calendarParseWeekStartDay(_uiState.value.weekStartDay)
                val weekStart = date.with(TemporalAdjusters.previousOrSame(startDow))
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
     * Update a chit's date/time after a drag-move or resize operation.
     * Persists to local DB and triggers sync push.
     */
    fun updateChitDateTimes(
        chitId: String,
        startDatetime: String? = null,
        endDatetime: String? = null,
        dueDatetime: String? = null,
        pointInTime: String? = null
    ) {
        viewModelScope.launch {
            chitRepository.updateDateTimes(chitId, startDatetime, endDatetime, dueDatetime, pointInTime)
        }
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

/**
 * Parses the week_start_day setting ("0"=Sun, "1"=Mon, ..., "6"=Sat) into a DayOfWeek.
 * Top-level so it can be used from both CalendarUiState (data class) and CalendarViewModel.
 * Defaults to Sunday if unrecognized.
 */
private fun calendarParseWeekStartDay(weekStartDay: String): DayOfWeek {
    val numeric = weekStartDay.trim().toIntOrNull()
    if (numeric != null && numeric in 0..6) {
        return when (numeric) {
            0 -> DayOfWeek.SUNDAY
            1 -> DayOfWeek.MONDAY
            2 -> DayOfWeek.TUESDAY
            3 -> DayOfWeek.WEDNESDAY
            4 -> DayOfWeek.THURSDAY
            5 -> DayOfWeek.FRIDAY
            6 -> DayOfWeek.SATURDAY
            else -> DayOfWeek.SUNDAY
        }
    }
    return when (weekStartDay.lowercase()) {
        "mon", "monday" -> DayOfWeek.MONDAY
        "tue", "tuesday" -> DayOfWeek.TUESDAY
        "wed", "wednesday" -> DayOfWeek.WEDNESDAY
        "thu", "thursday" -> DayOfWeek.THURSDAY
        "fri", "friday" -> DayOfWeek.FRIDAY
        "sat", "saturday" -> DayOfWeek.SATURDAY
        else -> DayOfWeek.SUNDAY
    }
}
