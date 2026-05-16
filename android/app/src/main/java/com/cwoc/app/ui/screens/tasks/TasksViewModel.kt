package com.cwoc.app.ui.screens.tasks

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cwoc.app.data.local.dao.ChitDao
import com.cwoc.app.data.local.entity.ChitEntity
import com.cwoc.app.data.repository.ChitRepository
import com.cwoc.app.data.sync.ConnectivityMonitor
import com.cwoc.app.data.sync.DirtyTracker
import com.cwoc.app.data.sync.SyncPushEngine
import com.cwoc.app.data.sync.SyncState
import com.cwoc.app.data.sync.SyncStateManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.Instant
import javax.inject.Inject

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
    private val syncStateManager: SyncStateManager
) : ViewModel() {

    private val _uiState = MutableStateFlow(TasksUiState())
    val uiState: StateFlow<TasksUiState> = _uiState.asStateFlow()

    /** Exposes the aggregated sync state for the UI indicator. */
    val syncState: StateFlow<SyncState> = syncStateManager.syncState

    init {
        viewModelScope.launch {
            chitRepository.getTaskChits().collect { tasks ->
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        tasks = tasks
                    )
                }
            }
        }
    }

    /**
     * Soft-deletes a chit by marking it as deleted in Room, tracking the dirty field,
     * and optimistically pushing to the server if online.
     *
     * Validates: Requirements 4.1, 4.2, 4.3, 4.4
     */
    fun softDelete(chitId: String) {
        viewModelScope.launch {
            val now = Instant.now().toString()

            // 1. Mark deleted in Room (sets deleted=true, modifiedDatetime=now)
            chitDao.markDeleted(chitId, now)

            // 2. Mark dirty with "deleted" field
            dirtyTracker.markDirty(chitId, setOf("deleted"))

            // 3. Optimistic push if online
            if (connectivityMonitor.isOnline.value) {
                launch {
                    syncPushEngine.pushSingle(chitId)
                }
            }
        }
    }
}
