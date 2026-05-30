package com.cwoc.app.ui.screens.tasks

import androidx.compose.ui.geometry.Offset
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
import com.cwoc.app.data.sync.SyncEngine
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
    private val syncEngine: SyncEngine,
    private val prefs: android.content.SharedPreferences
) : ViewModel() {

    private val vmCreatedAt = System.nanoTime()

    private val _uiState = MutableStateFlow(TasksUiState())
    val uiState: StateFlow<TasksUiState> = _uiState.asStateFlow()

    /** Current user ID for stealth/owner comparisons. */
    val currentUserId: String get() = prefs.getString("user_id", "") ?: ""

    /** Exposes the aggregated sync state for the UI indicator. */
    val syncState: StateFlow<SyncState> = syncStateManager.syncState

    /** Current username from settings, used for Assigned mode filtering. */
    private val _currentUsername = MutableStateFlow<String?>(null)
    val currentUsername: StateFlow<String?> = _currentUsername.asStateFlow()

    /** Time format from settings ("12hour" or "24hour"). */
    private val _timeFormat = MutableStateFlow("12hour")
    val timeFormat: StateFlow<String> = _timeFormat.asStateFlow()

    /** Calendar snap interval from settings. */
    private val _calendarSnap = MutableStateFlow(5)
    val calendarSnap: StateFlow<Int> = _calendarSnap.asStateFlow()

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

    // ── Timeline State ───────────────────────────────────────────────────

    /** Timeline zoom level (0.25x to 3.0x, default 1.0x). */
    val timelineZoom = MutableStateFlow(1.0f)

    /** Timeline pan offset for viewport positioning. */
    val timelineOffset = MutableStateFlow(Offset.Zero)

    /** Timeline layout order mode (BY_DATE or BY_DEPENDENCY). Persisted to SharedPreferences. */
    val timelineOrderMode = MutableStateFlow(
        try {
            TimelineOrderMode.valueOf(prefs.getString("timeline_order_mode", null) ?: "BY_DATE")
        } catch (_: Exception) { TimelineOrderMode.BY_DATE }
    )

    /** Set of node IDs currently highlighted (tapped node + its connected neighbors). */
    val highlightedNodes = MutableStateFlow<Set<String>>(emptySet())

    /** Whether Link Mode is active (tap source then target to create dependency). */
    val linkMode = MutableStateFlow(false)

    /** The source node ID selected in Link Mode (first tap). */
    val linkSource = MutableStateFlow<String?>(null)

    /** Whether critical path highlighting is active. */
    val criticalPathActive = MutableStateFlow(false)

    /**
     * Computed set of node IDs on the critical path.
     * Empty when criticalPathActive is false; computed via TimelineAlgorithms.criticalPath() when true.
     * Validates: Requirements 29.1, 29.2, 29.3, 29.4
     */
    val criticalPathNodes: StateFlow<Set<String>> = combine(criticalPathActive, _uiState) { active, state ->
        if (active && state.tasks.isNotEmpty()) {
            TimelineAlgorithms.criticalPath(state.tasks)
        } else {
            emptySet()
        }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptySet())

    /** Undo stack for dependency changes (max 50 entries). */
    val undoStack = MutableStateFlow<List<DependencyChange>>(emptyList())

    /** Redo stack for dependency changes. */
    val redoStack = MutableStateFlow<List<DependencyChange>>(emptyList())

    /** Whether completed tasks are greyed out in the timeline. Persisted to SharedPreferences. */
    val greyOutCompleted = MutableStateFlow(
        prefs.getBoolean("timeline_grey_out_completed", false)
    )

    /** Current drag-to-link state. Non-null when user is dragging from a node to create a dependency. */
    val dragLinkState = MutableStateFlow<DragLinkState?>(null)

    // ── Drag-to-Link Operations ──────────────────────────────────────────

    /**
     * Start a drag-to-link operation from the given source node.
     * Called when the user long-presses and begins dragging from a timeline node.
     */
    fun startDragLink(sourceNodeId: String, sourcePosition: Offset) {
        dragLinkState.value = DragLinkState(
            sourceNodeId = sourceNodeId,
            sourcePosition = sourcePosition,
            currentTouchPosition = sourcePosition
        )
    }

    /**
     * Update the current touch position during a drag-to-link operation.
     * Called continuously as the user drags their finger.
     */
    fun updateDragLinkPosition(touchPosition: Offset) {
        dragLinkState.update { current ->
            current?.copy(currentTouchPosition = touchPosition)
        }
    }

    /**
     * Cancel the current drag-to-link operation without creating a dependency.
     * Called when the user drops on empty space or the gesture is cancelled.
     */
    fun cancelDragLink() {
        dragLinkState.value = null
    }

    /**
     * Complete a drag-to-link operation by attempting to create a dependency.
     * The source node becomes a prerequisite of the target node.
     * Clears the drag state regardless of outcome.
     *
     * @param targetNodeId The ID of the node the user dropped on.
     * @param onResult Callback with the result (SUCCESS or CYCLE_DETECTED).
     */
    fun completeDragLink(targetNodeId: String, onResult: ((AddDependencyResult) -> Unit)? = null) {
        val state = dragLinkState.value ?: return
        dragLinkState.value = null

        // Source becomes prerequisite of target
        addDependency(state.sourceNodeId, targetNodeId, onResult)
    }

    // ── Timeline Operations ──────────────────────────────────────────────

    /**
     * Set the timeline order mode and persist to SharedPreferences.
     */
    fun setTimelineOrderMode(mode: TimelineOrderMode) {
        timelineOrderMode.value = mode
        prefs.edit().putString("timeline_order_mode", mode.name).apply()
    }

    /**
     * Set the grey-out-completed toggle and persist to SharedPreferences.
     */
    fun setGreyOutCompleted(enabled: Boolean) {
        greyOutCompleted.value = enabled
        prefs.edit().putBoolean("timeline_grey_out_completed", enabled).apply()
    }

    /**
     * Result of an addDependency operation.
     */
    enum class AddDependencyResult {
        SUCCESS,
        CYCLE_DETECTED,
        ALREADY_EXISTS,
        NOT_FOUND
    }

    /**
     * Add a dependency relationship (prereqId becomes a prerequisite of dependentId).
     * Performs cycle detection before adding. Returns the result via callback.
     * On success, pushes the change to the undo stack and clears the redo stack.
     *
     * @param onResult Callback invoked with the result of the operation (on main thread).
     */
    fun addDependency(prereqId: String, dependentId: String, onResult: ((AddDependencyResult) -> Unit)? = null) {
        viewModelScope.launch {
            val tasks = _uiState.value.tasks
            val graph = TimelineAlgorithms.buildGraph(tasks)

            // Check for cycle: adding prereqId → dependentId means dependentId depends on prereqId
            // wouldCycle checks if prereqId can be reached from dependentId via forward edges
            if (TimelineAlgorithms.wouldCycle(prereqId, dependentId, graph)) {
                // Cycle detected — caller should show error toast
                onResult?.invoke(AddDependencyResult.CYCLE_DETECTED)
                return@launch
            }

            // Update the dependent chit's prerequisites list
            val dependentChit = chitDao.getById(dependentId)
            if (dependentChit == null) {
                onResult?.invoke(AddDependencyResult.NOT_FOUND)
                return@launch
            }
            val currentPrereqs = dependentChit.prerequisites?.toMutableList() ?: mutableListOf()
            if (prereqId in currentPrereqs) {
                onResult?.invoke(AddDependencyResult.ALREADY_EXISTS)
                return@launch
            }

            currentPrereqs.add(prereqId)
            val now = Instant.now().toString()
            val updated = dependentChit.copy(prerequisites = currentPrereqs, modifiedDatetime = now)
            chitDao.upsert(updated)
            dirtyTracker.markDirty(dependentId, setOf("prerequisites"))
            if (connectivityMonitor.isOnline.value) {
                launch { syncPushEngine.pushSingle(dependentId) }
            }

            // Push to undo stack (limit 50)
            val change = DependencyChange(
                type = ChangeType.ADD,
                prereqId = prereqId,
                dependentId = dependentId
            )
            undoStack.update { stack ->
                (stack + change).takeLast(50)
            }
            // Clear redo stack on new action
            redoStack.value = emptyList()

            onResult?.invoke(AddDependencyResult.SUCCESS)
        }
    }

    /**
     * Remove a dependency relationship (prereqId is removed from dependentId's prerequisites).
     * Pushes the change to the undo stack and clears the redo stack.
     */
    fun removeDependency(prereqId: String, dependentId: String) {
        viewModelScope.launch {
            val dependentChit = chitDao.getById(dependentId) ?: return@launch
            val currentPrereqs = dependentChit.prerequisites?.toMutableList() ?: return@launch
            if (prereqId !in currentPrereqs) return@launch // Not present

            currentPrereqs.remove(prereqId)
            val now = Instant.now().toString()
            val updated = dependentChit.copy(
                prerequisites = if (currentPrereqs.isEmpty()) null else currentPrereqs,
                modifiedDatetime = now
            )
            chitDao.upsert(updated)
            dirtyTracker.markDirty(dependentId, setOf("prerequisites"))
            if (connectivityMonitor.isOnline.value) {
                launch { syncPushEngine.pushSingle(dependentId) }
            }

            // Push to undo stack (limit 50)
            val change = DependencyChange(
                type = ChangeType.REMOVE,
                prereqId = prereqId,
                dependentId = dependentId
            )
            undoStack.update { stack ->
                (stack + change).takeLast(50)
            }
            // Clear redo stack on new action
            redoStack.value = emptyList()
        }
    }

    /**
     * Undo the last dependency change. Reverses the operation and pushes it to the redo stack.
     */
    fun undo() {
        val stack = undoStack.value
        if (stack.isEmpty()) return

        val lastChange = stack.last()
        undoStack.value = stack.dropLast(1)

        viewModelScope.launch {
            when (lastChange.type) {
                ChangeType.ADD -> {
                    // Undo an ADD = remove the dependency
                    val dependentChit = chitDao.getById(lastChange.dependentId) ?: return@launch
                    val currentPrereqs = dependentChit.prerequisites?.toMutableList() ?: return@launch
                    currentPrereqs.remove(lastChange.prereqId)
                    val now = Instant.now().toString()
                    val updated = dependentChit.copy(
                        prerequisites = if (currentPrereqs.isEmpty()) null else currentPrereqs,
                        modifiedDatetime = now
                    )
                    chitDao.upsert(updated)
                    dirtyTracker.markDirty(lastChange.dependentId, setOf("prerequisites"))
                    if (connectivityMonitor.isOnline.value) {
                        launch { syncPushEngine.pushSingle(lastChange.dependentId) }
                    }
                }
                ChangeType.REMOVE -> {
                    // Undo a REMOVE = re-add the dependency
                    val dependentChit = chitDao.getById(lastChange.dependentId) ?: return@launch
                    val currentPrereqs = dependentChit.prerequisites?.toMutableList() ?: mutableListOf()
                    if (lastChange.prereqId !in currentPrereqs) {
                        currentPrereqs.add(lastChange.prereqId)
                    }
                    val now = Instant.now().toString()
                    val updated = dependentChit.copy(prerequisites = currentPrereqs, modifiedDatetime = now)
                    chitDao.upsert(updated)
                    dirtyTracker.markDirty(lastChange.dependentId, setOf("prerequisites"))
                    if (connectivityMonitor.isOnline.value) {
                        launch { syncPushEngine.pushSingle(lastChange.dependentId) }
                    }
                }
            }

            // Push to redo stack
            redoStack.update { it + lastChange }
        }
    }

    /**
     * Redo the last undone dependency change. Re-applies the operation and pushes it back to the undo stack.
     */
    fun redo() {
        val stack = redoStack.value
        if (stack.isEmpty()) return

        val lastChange = stack.last()
        redoStack.value = stack.dropLast(1)

        viewModelScope.launch {
            when (lastChange.type) {
                ChangeType.ADD -> {
                    // Redo an ADD = re-add the dependency
                    val dependentChit = chitDao.getById(lastChange.dependentId) ?: return@launch
                    val currentPrereqs = dependentChit.prerequisites?.toMutableList() ?: mutableListOf()
                    if (lastChange.prereqId !in currentPrereqs) {
                        currentPrereqs.add(lastChange.prereqId)
                    }
                    val now = Instant.now().toString()
                    val updated = dependentChit.copy(prerequisites = currentPrereqs, modifiedDatetime = now)
                    chitDao.upsert(updated)
                    dirtyTracker.markDirty(lastChange.dependentId, setOf("prerequisites"))
                    if (connectivityMonitor.isOnline.value) {
                        launch { syncPushEngine.pushSingle(lastChange.dependentId) }
                    }
                }
                ChangeType.REMOVE -> {
                    // Redo a REMOVE = remove the dependency again
                    val dependentChit = chitDao.getById(lastChange.dependentId) ?: return@launch
                    val currentPrereqs = dependentChit.prerequisites?.toMutableList() ?: return@launch
                    currentPrereqs.remove(lastChange.prereqId)
                    val now = Instant.now().toString()
                    val updated = dependentChit.copy(
                        prerequisites = if (currentPrereqs.isEmpty()) null else currentPrereqs,
                        modifiedDatetime = now
                    )
                    chitDao.upsert(updated)
                    dirtyTracker.markDirty(lastChange.dependentId, setOf("prerequisites"))
                    if (connectivityMonitor.isOnline.value) {
                        launch { syncPushEngine.pushSingle(lastChange.dependentId) }
                    }
                }
            }

            // Push back to undo stack (limit 50)
            undoStack.update { stack ->
                (stack + lastChange).takeLast(50)
            }
        }
    }

    /**
     * Highlight a node and all its directly connected neighbors (prerequisites + dependents).
     * Uses TimelineAlgorithms.connectedNodes() to find the connected set.
     */
    fun highlightNode(nodeId: String) {
        val tasks = _uiState.value.tasks
        val graph = TimelineAlgorithms.buildGraph(tasks)
        val connected = TimelineAlgorithms.connectedNodes(nodeId, graph)
        highlightedNodes.value = connected + nodeId
    }

    /**
     * Clear all node highlighting.
     */
    fun clearHighlight() {
        highlightedNodes.value = emptySet()
    }

    init {
        val initStart = System.nanoTime()
        val sinceCreation = (initStart - vmCreatedAt) / 1_000_000
        android.util.Log.d("PERF", "[TasksVM] init START (${sinceCreation}ms after constructor)")
        viewModelScope.launch {
            val flowSubStart = System.nanoTime()
            android.util.Log.d("PERF", "[TasksVM] subscribing to getTaskChits() Flow")
            chitRepository.getTaskChits().collect { tasks ->
                val emitTime = System.nanoTime()
                val waitForEmit = (emitTime - flowSubStart) / 1_000_000
                val sinceVmCreated = (emitTime - vmCreatedAt) / 1_000_000
                android.util.Log.d("PERF", "[TasksVM] *** Flow EMITTED ${tasks.size} tasks — ${waitForEmit}ms since subscribe, ${sinceVmCreated}ms since VM created ***")
                
                val collectStart = System.currentTimeMillis()
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
                val elapsed = System.currentTimeMillis() - collectStart
                android.util.Log.d("PERF", "[TasksVM] Flow processing took ${elapsed}ms, isLoading now FALSE")
                launch { syncEngine.reportLog("[PERF] TasksVM: Flow emitted ${tasks.size} tasks after ${waitForEmit}ms wait (${sinceVmCreated}ms since VM created), processing=${elapsed}ms", "info") }
            }
        }
        viewModelScope.launch {
            settingsRepository.settings.collect { settings ->
                _currentUsername.value = settings.username
                _timeFormat.value = settings.timeFormat ?: "12hour"
                _calendarSnap.value = settings.calendarSnap?.toIntOrNull() ?: 5
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
