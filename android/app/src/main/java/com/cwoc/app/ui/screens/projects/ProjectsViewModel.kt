package com.cwoc.app.ui.screens.projects

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cwoc.app.data.local.dao.ChitDao
import com.cwoc.app.data.local.entity.ChitEntity
import com.cwoc.app.data.repository.ChitRepository
import com.cwoc.app.data.repository.SettingsRepository
import com.cwoc.app.data.sync.SyncState
import com.cwoc.app.data.sync.SyncStateManager
import com.cwoc.app.domain.sort.ChitReorderHelper
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.time.Instant
import javax.inject.Inject

/**
 * Data class representing a project with its child chits grouped by Kanban status.
 */
data class ProjectWithChildren(
    val project: ChitEntity,
    val children: Map<KanbanStatus, List<ChitEntity>>
)

/**
 * ViewModel for the Projects/Kanban view.
 * Loads project master chits and their children, grouped by status columns.
 */
@HiltViewModel
class ProjectsViewModel @Inject constructor(
    private val chitRepository: ChitRepository,
    private val chitDao: ChitDao,
    private val chitReorderHelper: ChitReorderHelper,
    private val settingsRepository: SettingsRepository,
    private val syncStateManager: SyncStateManager
) : ViewModel() {

    /** Aggregated sync state for the UI indicator. */
    val syncState: StateFlow<SyncState> = syncStateManager.syncState

    private val _projects = MutableStateFlow<List<ProjectWithChildren>>(emptyList())
    val projects: StateFlow<List<ProjectWithChildren>> = _projects.asStateFlow()

    private val _expandedProjects = MutableStateFlow<Set<String>?>(null)
    val expandedProjects: StateFlow<Set<String>?> = _expandedProjects.asStateFlow()

    /** Time format from settings ("12hour" or "24hour"). */
    private val _timeFormat = MutableStateFlow("12hour")
    val timeFormat: StateFlow<String> = _timeFormat.asStateFlow()

    /** Calendar snap interval from settings. */
    private val _calendarSnap = MutableStateFlow(5)
    val calendarSnap: StateFlow<Int> = _calendarSnap.asStateFlow()

    /** Whether to show child chit count on project headers. */
    private val _showChildCount = MutableStateFlow(false)
    val showChildCount: StateFlow<Boolean> = _showChildCount.asStateFlow()

    /** Whether to show aggregate checklist count on project headers. */
    private val _showChecklistCount = MutableStateFlow(false)
    val showChecklistCount: StateFlow<Boolean> = _showChecklistCount.asStateFlow()

    init {
        viewModelScope.launch {
            chitRepository.getProjectMasterChits().collect { masterChits ->
                val projectsWithChildren = masterChits.map { master ->
                    val childIds = master.childChits ?: emptyList()
                    val children = if (childIds.isNotEmpty()) {
                        chitRepository.getChitsByIds(childIds)
                    } else {
                        emptyList()
                    }
                    ProjectWithChildren(
                        project = master,
                        children = groupByKanbanStatus(children)
                    )
                }
                _projects.value = projectsWithChildren
                // On first load, expand all projects by default
                if (_expandedProjects.value == null) {
                    _expandedProjects.value = projectsWithChildren.map { it.project.id }.toSet()
                }
            }
        }
        viewModelScope.launch {
            settingsRepository.settings.collect { settings ->
                _timeFormat.value = settings.timeFormat ?: "12hour"
                _calendarSnap.value = settings.calendarSnap?.toIntOrNull() ?: 5
                _showChildCount.value = settings.projectsShowChildCount == "1"
                _showChecklistCount.value = settings.projectsShowChecklistCount == "1"
            }
        }
    }

    fun toggleExpanded(projectId: String) {
        _expandedProjects.value = (_expandedProjects.value ?: emptySet()).let { current ->
            if (projectId in current) current - projectId else current + projectId
        }
    }

    /**
     * Move a child chit to a new Kanban column (status).
     */
    fun moveToColumn(chitId: String, newStatus: KanbanStatus) {
        viewModelScope.launch {
            val chit = chitDao.getById(chitId) ?: return@launch
            val now = Instant.now().toString()
            chitDao.upsert(
                chit.copy(
                    status = newStatus.displayName,
                    modifiedDatetime = now,
                    isDirty = true
                )
            )
            chitRepository.markDirty(chitId, "status")
        }
    }

    /**
     * Create a new child chit with the given title and add it to the project's child_chits.
     * The new chit gets status "ToDo" and is immediately synced.
     */
    fun createChildChit(projectId: String, title: String) {
        viewModelScope.launch {
            val now = Instant.now().toString()
            val newId = java.util.UUID.randomUUID().toString()

            // Create the new child chit
            val newChit = ChitEntity(
                id = newId,
                title = title,
                note = null,
                tags = null,
                startDatetime = null,
                endDatetime = null,
                dueDatetime = null,
                pointInTime = null,
                completedDatetime = null,
                status = "ToDo",
                priority = null,
                severity = null,
                checklist = null,
                alarm = null,
                notification = null,
                recurrence = null,
                recurrenceId = null,
                recurrenceRule = null,
                recurrenceExceptions = null,
                location = null,
                color = null,
                people = null,
                pinned = false,
                archived = false,
                deleted = false,
                createdDatetime = now,
                modifiedDatetime = now,
                isProjectMaster = false,
                childChits = null,
                allDay = false,
                timezone = null,
                alerts = null,
                progressPercent = null,
                timeEstimate = null,
                weatherData = null,
                healthData = null,
                habit = false,
                habitGoal = null,
                habitSuccess = null,
                showOnCalendar = null,
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
                isDirty = true,
                dirtyFields = "[\"title\",\"status\",\"createdDatetime\",\"modifiedDatetime\"]"
            )
            chitDao.upsert(newChit)

            // Update the parent project's childChits list
            val project = chitDao.getById(projectId) ?: return@launch
            val updatedChildren = (project.childChits ?: emptyList()) + newId
            chitDao.upsert(
                project.copy(
                    childChits = updatedChildren,
                    modifiedDatetime = now,
                    isDirty = true
                )
            )

            // Mark both as dirty and push
            chitRepository.markDirty(newId, "title")
            chitRepository.markDirty(projectId, "childChits")
        }
    }

    /**
     * Get the saved manual order for the Projects tab.
     * Reads directly from ChitReorderHelper's local cache (which is synced from server on app init).
     */
    fun getManualOrder(): List<String> {
        return chitReorderHelper.getLocalOrder("Projects")
    }

    /**
     * Reorder project cards in the list.
     * Persists the new order both locally (SharedPreferences) and remotely (API).
     * Called from the ReorderableStaggeredGrid onReorder callback.
     *
     * @param currentProjects The current ordered list of ProjectWithChildren displayed
     * @param fromIndex The index of the card being moved
     * @param toIndex The target index for the card
     *
     * Validates: Requirements 11.3
     */
    fun reorderProjects(currentProjects: List<ProjectWithChildren>, fromIndex: Int, toIndex: Int) {
        viewModelScope.launch {
            val chitIds = currentProjects.map { it.project.id }
            chitReorderHelper.persistReorder(
                tab = "Projects",
                currentIds = chitIds,
                fromIndex = fromIndex,
                toIndex = toIndex
            )
        }
    }
}
