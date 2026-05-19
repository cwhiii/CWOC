package com.cwoc.app.ui.viewmodel

import android.content.SharedPreferences
import androidx.lifecycle.ViewModel
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.temporal.WeekFields
import java.util.Locale
import javax.inject.Inject

/**
 * Sidebar state data class holding all sidebar-controlled values
 * that need to be shared between the sidebar UI and content screens.
 */
data class SidebarState(
    // Date navigation
    val currentDate: LocalDate = LocalDate.now(),
    val currentPeriod: String = "Week", // Itinerary|Day|Work|Week|SevenDay|Month|Year
    val dateRangeDisplay: String = "",
    val yearDisplay: String = "",

    // View modes (tab-specific)
    val projectsViewMode: String = "list", // list|kanban
    val alarmsViewMode: String = "list", // list|independent|notifications|reminders
    val tasksViewMode: String = "tasks", // tasks|habits|assigned

    // Calendar options
    val monthMode: String = "compress", // compress|scroll

    // Habits sub-options (visible in Tasks tab, Habits mode)
    val habitsSuccessWindow: Int = 30, // 7|30|90|-1(all)
    val habitsIncludeRules: Boolean = false,

    // Indicators controls
    val indicatorsRange: String = "day", // day|week|month|year|all
    val indicatorsCustomStart: String? = null,
    val indicatorsCustomEnd: String? = null,
    val indicatorsVisibleGraphs: Set<String> = emptySet(),

    // Search
    val searchText: String = "",
    val savedSearches: List<String> = emptyList(),

    // Email folder
    val emailFolder: String = "inbox"
)

/**
 * Shared ViewModel holding sidebar state that bridges the sidebar UI
 * and the content screens. Scoped to the activity.
 *
 * Persists view modes, period, and habits options to SharedPreferences.
 * Date always starts at today on launch (not persisted).
 * Search text and saved searches are managed here.
 */
@HiltViewModel
class SidebarStateViewModel @Inject constructor(
    private val prefs: SharedPreferences
) : ViewModel() {

    private val _state = MutableStateFlow(SidebarState())
    val state: StateFlow<SidebarState> = _state.asStateFlow()

    init {
        restoreFromPrefs()
        updateDateDisplay()
    }

    // ── Date Navigation ──────────────────────────────────────────────────

    fun goToToday() {
        _state.update { it.copy(currentDate = LocalDate.now()) }
        updateDateDisplay()
    }

    fun previousPeriod() {
        _state.update { state ->
            val newDate = when (state.currentPeriod) {
                "Day", "Work" -> state.currentDate.minusDays(1)
                "Week" -> state.currentDate.minusWeeks(1)
                "SevenDay" -> state.currentDate.minusDays(7)
                "Month" -> state.currentDate.minusMonths(1)
                "Year" -> state.currentDate.minusYears(1)
                else -> state.currentDate.minusDays(1) // Itinerary
            }
            state.copy(currentDate = newDate)
        }
        updateDateDisplay()
    }

    fun nextPeriod() {
        _state.update { state ->
            val newDate = when (state.currentPeriod) {
                "Day", "Work" -> state.currentDate.plusDays(1)
                "Week" -> state.currentDate.plusWeeks(1)
                "SevenDay" -> state.currentDate.plusDays(7)
                "Month" -> state.currentDate.plusMonths(1)
                "Year" -> state.currentDate.plusYears(1)
                else -> state.currentDate.plusDays(1) // Itinerary
            }
            state.copy(currentDate = newDate)
        }
        updateDateDisplay()
    }

    fun setPeriod(period: String) {
        _state.update { it.copy(currentPeriod = period) }
        prefs.edit().putString("sidebar_period", period).apply()
        updateDateDisplay()
    }

    private fun updateDateDisplay() {
        _state.update { state ->
            val date = state.currentDate
            val year = date.year.toString()
            val range = when (state.currentPeriod) {
                "Day", "Work", "Itinerary" -> {
                    date.format(DateTimeFormatter.ofPattern("MMM d"))
                }
                "Week", "SevenDay" -> {
                    val weekStart = date.with(WeekFields.of(Locale.getDefault()).dayOfWeek(), 1)
                    val weekEnd = weekStart.plusDays(6)
                    val fmt = DateTimeFormatter.ofPattern("MMM d")
                    "${weekStart.format(fmt)} – ${weekEnd.format(fmt)}"
                }
                "Month" -> {
                    date.format(DateTimeFormatter.ofPattern("MMMM yyyy"))
                }
                "Year" -> {
                    date.year.toString()
                }
                else -> ""
            }
            state.copy(yearDisplay = year, dateRangeDisplay = range)
        }
    }

    // ── View Modes ───────────────────────────────────────────────────────

    fun setProjectsViewMode(mode: String) {
        _state.update { it.copy(projectsViewMode = mode) }
        prefs.edit().putString("sidebar_projects_mode", mode).apply()
    }

    fun setAlarmsViewMode(mode: String) {
        _state.update { it.copy(alarmsViewMode = mode) }
        prefs.edit().putString("sidebar_alarms_mode", mode).apply()
    }

    fun setTasksViewMode(mode: String) {
        _state.update { it.copy(tasksViewMode = mode) }
        prefs.edit().putString("sidebar_tasks_mode", mode).apply()
    }

    // ── Email Folder ─────────────────────────────────────────────────────

    fun setEmailFolder(folder: String) {
        _state.update { it.copy(emailFolder = folder) }
    }

    // ── Calendar Options ─────────────────────────────────────────────────

    fun setMonthMode(mode: String) {
        _state.update { it.copy(monthMode = mode) }
        prefs.edit().putString("sidebar_month_mode", mode).apply()
    }

    // ── Habits Sub-Options ───────────────────────────────────────────────

    fun setHabitsSuccessWindow(window: Int) {
        _state.update { it.copy(habitsSuccessWindow = window) }
        prefs.edit().putInt("sidebar_habits_window", window).apply()
    }

    fun setHabitsIncludeRules(include: Boolean) {
        _state.update { it.copy(habitsIncludeRules = include) }
        prefs.edit().putBoolean("sidebar_habits_rules", include).apply()
    }

    // ── Indicators ───────────────────────────────────────────────────────

    fun setIndicatorsRange(range: String) {
        _state.update { it.copy(indicatorsRange = range) }
    }

    fun setIndicatorsCustomRange(start: String?, end: String?) {
        _state.update { it.copy(indicatorsCustomStart = start, indicatorsCustomEnd = end) }
    }

    fun setIndicatorsVisibleGraphs(graphs: Set<String>) {
        _state.update { it.copy(indicatorsVisibleGraphs = graphs) }
    }

    // ── Search ───────────────────────────────────────────────────────────

    fun setSearchText(text: String) {
        _state.update { it.copy(searchText = text) }
    }

    fun saveSearch(text: String) {
        if (text.isBlank()) return
        _state.update { state ->
            val updated = (state.savedSearches + text).distinct()
            state.copy(savedSearches = updated)
        }
        persistSavedSearches()
    }

    fun deleteSearch(text: String) {
        _state.update { state ->
            state.copy(savedSearches = state.savedSearches - text)
        }
        persistSavedSearches()
    }

    private fun persistSavedSearches() {
        val json = org.json.JSONArray(_state.value.savedSearches).toString()
        prefs.edit().putString("sidebar_saved_searches", json).apply()
    }

    // ── Persistence ──────────────────────────────────────────────────────

    private fun restoreFromPrefs() {
        val period = prefs.getString("sidebar_period", "Week") ?: "Week"
        val projectsMode = prefs.getString("sidebar_projects_mode", "list") ?: "list"
        val alarmsMode = prefs.getString("sidebar_alarms_mode", "list") ?: "list"
        val tasksMode = prefs.getString("sidebar_tasks_mode", "tasks") ?: "tasks"
        val monthMode = prefs.getString("sidebar_month_mode", "compress") ?: "compress"
        val habitsWindow = prefs.getInt("sidebar_habits_window", 30)
        val habitsRules = prefs.getBoolean("sidebar_habits_rules", false)
        val savedSearchesJson = prefs.getString("sidebar_saved_searches", "[]") ?: "[]"

        val savedSearches = try {
            val arr = org.json.JSONArray(savedSearchesJson)
            (0 until arr.length()).map { arr.getString(it) }
        } catch (_: Exception) { emptyList() }

        _state.update {
            it.copy(
                currentPeriod = period,
                projectsViewMode = projectsMode,
                alarmsViewMode = alarmsMode,
                tasksViewMode = tasksMode,
                monthMode = monthMode,
                habitsSuccessWindow = habitsWindow,
                habitsIncludeRules = habitsRules,
                savedSearches = savedSearches
            )
        }
    }
}
