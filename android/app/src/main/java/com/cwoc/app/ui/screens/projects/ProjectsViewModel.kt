package com.cwoc.app.ui.screens.projects

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cwoc.app.data.local.dao.ChitDao
import com.cwoc.app.data.local.entity.ChitEntity
import com.cwoc.app.data.repository.ChitRepository
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
    private val chitDao: ChitDao
) : ViewModel() {

    private val _projects = MutableStateFlow<List<ProjectWithChildren>>(emptyList())
    val projects: StateFlow<List<ProjectWithChildren>> = _projects.asStateFlow()

    private val _expandedProjects = MutableStateFlow<Set<String>>(emptySet())
    val expandedProjects: StateFlow<Set<String>> = _expandedProjects.asStateFlow()

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
            }
        }
    }

    fun toggleExpanded(projectId: String) {
        _expandedProjects.value = _expandedProjects.value.let { current ->
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
}
