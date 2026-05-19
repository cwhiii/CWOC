package com.cwoc.app.ui.screens.notes

import android.content.SharedPreferences
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
    private val syncStateManager: SyncStateManager,
    private val prefs: SharedPreferences
) : ViewModel() {

    private val _uiState = MutableStateFlow(NotesUiState())
    val uiState: StateFlow<NotesUiState> = _uiState.asStateFlow()

    /** Aggregated sync state for the UI indicator (green/orange/red dot). */
    val syncState: StateFlow<SyncState> = syncStateManager.syncState

    /** Current user ID for stealth/owner comparisons. */
    val currentUserId: String get() = prefs.getString("user_id", "") ?: ""

    /** The chit ID currently pending deletion (undo window active). Null means no pending delete. */
    private val _pendingDeleteChitId = MutableStateFlow<String?>(null)
    val pendingDeleteChitId: StateFlow<String?> = _pendingDeleteChitId.asStateFlow()

    /** The title of the chit pending deletion, for display in the undo toast. */
    private val _pendingDeleteTitle = MutableStateFlow<String?>(null)
    val pendingDeleteTitle: StateFlow<String?> = _pendingDeleteTitle.asStateFlow()

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
}
