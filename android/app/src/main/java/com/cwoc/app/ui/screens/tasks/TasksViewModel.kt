package com.cwoc.app.ui.screens.tasks

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cwoc.app.data.local.dao.ChitDao
import com.cwoc.app.data.local.entity.ChitEntity
import com.cwoc.app.data.remote.CwocApiService
import com.cwoc.app.data.remote.dto.RuleHabitDto
import com.cwoc.app.data.repository.ChitRepository
import com.cwoc.app.data.repository.ContactRepository
import com.cwoc.app.data.repository.SettingsRepository
import com.cwoc.app.data.sync.ConnectivityMonitor
import com.cwoc.app.data.sync.DirtyTracker
import com.cwoc.app.data.sync.SyncPushEngine
import com.cwoc.app.data.sync.SyncState
import com.cwoc.app.data.sync.SyncStateManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.LocalDate
import javax.inject.Inject
import kotlin.math.roundToInt

data class TasksUiState(
    val isLoading: Boolean = true,
    val tasks: List<ChitEntity> = emptyList(),
    val error: String? = null
) {
    val groupedTasks: Map<String, List<ChitEntity>>
        get() = tasks.groupBy { it.status ?: "Unknown" }
}

@HiltViewModel
class TasksViewModel @Inject constructor(
    private val chitRepository: ChitRepository,
    private val chitDao: ChitDao,
    private val dirtyTracker: DirtyTracker,
    private val syncPushEngine: SyncPushEngine,
    private val connectivityMonitor: ConnectivityMonitor,
    private val syncStateManager: SyncStateManager,
    private val settingsRepository: SettingsRepository,
    private val apiService: CwocApiService,
    private val contactRepository: ContactRepository,
    private val prefs: android.content.SharedPreferences
) : ViewModel() {

    private val _uiState = MutableStateFlow(TasksUiState())
    val uiState: StateFlow<TasksUiState> = _uiState.asStateFlow()

    /** Current user ID for stealth/owner comparisons. */
    val currentUserId: String get() = prefs.getString("user_id", "") ?: ""

    /** Exposes the aggregated sync state for the UI indicator. */
    val syncState: StateFlow<SyncState> = syncStateManager.syncState

    /** Current username from settings, used for Assigned mode filtering. */
    private val _currentUsername = MutableStateFlow<String?>(null)
    val currentUsername: StateFlow<String?> = _currentUsername.asStateFlow()

    /** Whether to show map thumbnails on cards (from chit_options.show_map_thumbnails). */
    private val _showMapThumbnails = MutableStateFlow(false)
    val showMapThumbnails: StateFlow<Boolean> = _showMapThumbnails.asStateFlow()

    /** Set of chit IDs that are children of project masters (sub-chits). */
    private val _subChitIds = MutableStateFlow<Set<String>>(emptySet())
    val subChitIds: StateFlow<Set<String>> = _subChitIds.asStateFlow()

    /** The chit ID currently pending deletion (undo window active). Null means no pending delete. */
    private val _pendingDeleteChitId = MutableStateFlow<String?>(null)
    val pendingDeleteChitId: StateFlow<String?> = _pendingDeleteChitId.asStateFlow()

    /** The title of the chit pending deletion, for display in the undo toast. */
    private val _pendingDeleteTitle = MutableStateFlow<String?>(null)
    val pendingDeleteTitle: StateFlow<String?> = _pendingDeleteTitle.asStateFlow()

    /** Rule habits fetched from the API when habits mode activates. */
    private val _ruleHabits = MutableStateFlow<List<RuleHabitDto>>(emptyList())
    val ruleHabits: StateFlow<List<RuleHabitDto>> = _ruleHabits.asStateFlow()

    /** Map of contact display names to their profile image URLs, for people chips. */
    private val _contactImages = MutableStateFlow<Map<String, String?>>(emptyMap())
    val contactImages: StateFlow<Map<String, String?>> = _contactImages.asStateFlow()

    /**
     * Habits success window from user settings: number of days to evaluate habit success rates.
     * Values: 7, 30, 90, or -1 (all time). Defaults to 30 if not set.
     * Read from SettingsEntity.habitsSuccessWindow (persisted user preference).
     */
    private val _habitsSuccessWindow = MutableStateFlow(30)
    val habitsSuccessWindow: StateFlow<Int> = _habitsSuccessWindow.asStateFlow()

    /** Server URL for loading contact images. */
    val serverUrl: String get() = prefs.getString("server_url", "")?.trimEnd('/') ?: ""

    /** Auth token for authenticated image requests. */
    val authToken: String get() = prefs.getString("auth_token", "") ?: ""

    /**
     * Combined success rate (0–100) aggregating chit habit rates and rule habit rates.
     * Matches web's _renderAggregateSuccessRate logic:
     * - Chit habits contribute their metCount/totalPeriods from recurrence_exceptions
     * - Rule habits contribute round(successRate * 100) met out of 100 periods each
     * - Final rate = (totalMet / totalPeriods) * 100, rounded
     * Emits null when there are no habits to calculate from.
     */
    val combinedSuccessRate: StateFlow<Int?> = combine(_uiState, _ruleHabits, _habitsSuccessWindow) { uiState, rules, window ->
        calculateCombinedSuccessRate(uiState.tasks, rules, window)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    init {
        viewModelScope.launch {
            chitRepository.getTaskChits().collect { tasks ->
                // Compute sub-chit IDs (chits that are children of project masters)
                val subChitIds = mutableSetOf<String>()
                tasks.filter { it.isProjectMaster }.forEach { project ->
                    project.childChits?.forEach { childId -> subChitIds.add(childId) }
                }
                _subChitIds.value = subChitIds

                _uiState.update {
                    it.copy(
                        isLoading = false,
                        tasks = tasks
                    )
                }
            }
        }
        viewModelScope.launch {
            settingsRepository.settings.collect { settings ->
                _currentUsername.value = settings.username
                // Parse show_map_thumbnails from chitOptions JSON
                _showMapThumbnails.value = try {
                    val json = org.json.JSONObject(settings.chitOptions ?: "{}")
                    json.optBoolean("show_map_thumbnails", false)
                } catch (_: Exception) { false }
                // Read habits_success_window (7, 30, 90, or -1 for all time)
                _habitsSuccessWindow.value = settings.habitsSuccessWindow?.toIntOrNull() ?: 30
            }
        }
        // Build contact name → imageUrl map for people chips profile images
        viewModelScope.launch {
            contactRepository.allContacts.collect { contacts ->
                val imageMap = mutableMapOf<String, String?>()
                contacts.forEach { contact ->
                    val name = contact.displayName
                    if (!name.isNullOrBlank() && contact.imageUrl != null) {
                        imageMap[name] = contact.imageUrl
                    }
                }
                _contactImages.value = imageMap
            }
        }
    }

    /**
     * Initiates a soft-delete with undo support. Marks the chit as deleted locally
     * but does NOT sync yet. The sync is deferred until [finalizeDelete] is called
     * when the undo countdown expires.
     *
     * Validates: Requirements 13.1, 13.3, 13.4
     */
    fun softDelete(chitId: String) {
        viewModelScope.launch {
            // If there's already a pending delete, finalize it first
            _pendingDeleteChitId.value?.let { previousId ->
                finalizeDelete(previousId)
            }

            // Get the chit title for the toast message
            val chit = chitDao.getById(chitId)
            _pendingDeleteTitle.value = chit?.title ?: "Chit"

            val now = Instant.now().toString()

            // Mark deleted locally (removes from active list views)
            chitDao.markDeleted(chitId, now)

            // Set as pending — do NOT sync yet
            _pendingDeleteChitId.value = chitId
        }
    }

    /**
     * Restores a pending-delete chit immediately. Called when the user taps "Undo".
     *
     * Validates: Requirements 13.3
     */
    fun undoDelete() {
        val chitId = _pendingDeleteChitId.value ?: return
        viewModelScope.launch {
            val now = Instant.now().toString()
            chitDao.restoreDeleted(chitId, now)
            _pendingDeleteChitId.value = null
            _pendingDeleteTitle.value = null
        }
    }

    /**
     * Finalizes the deletion by marking dirty and syncing to the server.
     * Called when the undo countdown expires.
     *
     * Validates: Requirements 13.4
     */
    fun finalizeDelete(chitId: String? = null) {
        val id = chitId ?: _pendingDeleteChitId.value ?: return
        viewModelScope.launch {
            // Mark dirty for sync
            dirtyTracker.markDirty(id, setOf("deleted"))

            // Optimistic push if online
            if (connectivityMonitor.isOnline.value) {
                launch { syncPushEngine.pushSingle(id) }
            }

            // Clear pending state only if this is the current pending item
            if (_pendingDeleteChitId.value == id) {
                _pendingDeleteChitId.value = null
                _pendingDeleteTitle.value = null
            }
        }
    }

    /**
     * Update RSVP status for a shared chit (accept/decline from card).
     * Sends PATCH to server and triggers a refresh.
     */
    fun updateRsvp(chitId: String, rsvpStatus: String) {
        viewModelScope.launch {
            chitRepository.updateRsvp(chitId, rsvpStatus)
        }
    }

    /**
     * Fetch rule habits from the API. Called when habits mode activates.
     * Results are cached in [ruleHabits] StateFlow until next fetch.
     */
    fun fetchRuleHabits() {
        viewModelScope.launch {
            try {
                val response = apiService.getHabitRules(habit = true)
                if (response.isSuccessful) {
                    _ruleHabits.value = response.body() ?: emptyList()
                }
            } catch (_: Exception) {
                // Silently fail — rule habits are supplementary data
            }
        }
    }

    /**
     * Calculate the combined success rate across all chit habits and rule habits.
     * Matches web's _renderAggregateSuccessRate logic:
     * - For each chit habit: parse recurrence_exceptions to count periods where
     *   habit_success >= habit_goal (same as calculateHistoricalSuccessRate in TasksScreen)
     * - For each rule habit: treat success_rate (0.0–1.0) as round(rate*100) met out of 100 periods
     * - Aggregate: totalMet / totalPeriods * 100, rounded to nearest integer
     * - Respects the habits_success_window setting: filters entries to last N periods
     *
     * Returns null if there are no periods to calculate from.
     */
    private fun calculateCombinedSuccessRate(tasks: List<ChitEntity>, ruleHabits: List<RuleHabitDto>, windowDays: Int): Int? {
        val habits = tasks.filter { it.habit }
        var totalMet = 0
        var totalPeriods = 0

        // Calculate the cutoff date for window filtering
        // windowDays: 7, 30, 90 = last N days; -1 = all time
        val cutoffDate: LocalDate? = if (windowDays > 0) {
            LocalDate.now().minusDays(windowDays.toLong())
        } else null // null means include all entries (all time)

        // Accumulate chit habit met/total counts from recurrence_exceptions
        for (chit in habits) {
            val goal = chit.habitGoal ?: 1
            val success = chit.habitSuccess ?: 0
            val isComplete = success >= goal

            // Parse recurrence_exceptions JSON for period snapshots
            val exceptions = try {
                if (!chit.recurrenceExceptions.isNullOrBlank()) {
                    com.google.gson.Gson().fromJson<List<Map<String, Any?>>>(
                        chit.recurrenceExceptions,
                        object : com.google.gson.reflect.TypeToken<List<Map<String, Any?>>>() {}.type
                    ) ?: emptyList()
                } else emptyList()
            } catch (_: Exception) { emptyList() }

            // Filter to only entries with habit-specific fields (rollover snapshots)
            // and apply date window filter
            val periodEntries = exceptions.filter { ex ->
                ex.containsKey("habit_success") && ex.containsKey("habit_goal") && ex["broken_off"] != true &&
                    (cutoffDate == null || isEntryWithinWindow(ex, cutoffDate))
            }

            // Add current period only if goal is met
            val allEntries = if (isComplete) {
                periodEntries + mapOf("habit_success" to success.toDouble(), "habit_goal" to goal.toDouble())
            } else periodEntries

            // Count met periods for this chit
            for (entry in allEntries) {
                val entrySuccess = (entry["habit_success"] as? Number)?.toInt() ?: 0
                val entryGoal = (entry["habit_goal"] as? Number)?.toInt() ?: 1
                totalPeriods++
                if (entrySuccess >= entryGoal) totalMet++
            }
        }

        // Add rule habit success rates (each rule contributes as 100 periods)
        for (rule in ruleHabits) {
            val ruleRate = rule.habitSummary?.successRate
            if (ruleRate != null) {
                totalMet += (ruleRate * 100).roundToInt()
                totalPeriods += 100
            }
        }

        if (totalPeriods == 0) return null

        return ((totalMet.toDouble() / totalPeriods.toDouble()) * 100).roundToInt()
    }

    /**
     * Check if a recurrence_exceptions entry's date falls within the window (on or after cutoffDate).
     * Entries have a "date" field in "YYYY-MM-DD" format.
     */
    private fun isEntryWithinWindow(entry: Map<String, Any?>, cutoffDate: LocalDate): Boolean {
        val dateStr = entry["date"] as? String ?: return true // If no date field, include by default
        return try {
            val entryDate = LocalDate.parse(dateStr)
            !entryDate.isBefore(cutoffDate)
        } catch (_: Exception) {
            true // If date can't be parsed, include by default
        }
    }
}
