package com.cwoc.app.ui.screens.notes

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

data class NotesUiState(
    val isLoading: Boolean = true,
    val notes: List<ChitEntity> = emptyList(),
    val error: String? = null
)

@HiltViewModel
class NotesViewModel @Inject constructor(
    private val chitRepository: ChitRepository,
    private val chitDao: ChitDao,
    private val dirtyTracker: DirtyTracker,
    private val syncPushEngine: SyncPushEngine,
    private val connectivityMonitor: ConnectivityMonitor,
    private val syncStateManager: SyncStateManager
) : ViewModel() {

    private val _uiState = MutableStateFlow(NotesUiState())
    val uiState: StateFlow<NotesUiState> = _uiState.asStateFlow()

    /** Aggregated sync state for the UI indicator (green/orange/red dot). */
    val syncState: StateFlow<SyncState> = syncStateManager.syncState

    init {
        viewModelScope.launch {
            chitRepository.getNoteChits().collect { notes ->
                _uiState.update {
                    it.copy(isLoading = false, notes = notes)
                }
            }
        }
    }

    /**
     * Soft-deletes a chit by marking it as deleted in Room, marking it dirty,
     * and optimistically pushing the change if online.
     *
     * Validates: Requirements 4.1, 4.2, 4.3, 4.4
     */
    fun softDelete(chitId: String) {
        viewModelScope.launch {
            val now = Instant.now().toString()
            chitDao.markDeleted(chitId, now)
            dirtyTracker.markDirty(chitId, setOf("deleted", "modified_datetime"))

            // Optimistic push if online
            if (connectivityMonitor.isOnline.value) {
                launch { syncPushEngine.pushSingle(chitId) }
            }
        }
    }
}
