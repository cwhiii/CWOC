package com.cwoc.app.ui.screens.notebook

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
import com.cwoc.app.domain.checklist.ChecklistOperations
import com.cwoc.app.domain.sort.ChitReorderHelper
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.Instant
import javax.inject.Inject

data class NotebookUiState(
    val isLoading: Boolean = true,
    val chits: List<ChitEntity> = emptyList(),
    val error: String? = null
)

/**
 * ViewModel for the Notebook screen (combined Notes + Checklists).
 * Collects chits that have either a non-empty note OR non-empty checklist items.
 */
@HiltViewModel
class NotebookViewModel @Inject constructor(
    private val chitRepository: ChitRepository,
    private val chitDao: ChitDao,
    private val dirtyTracker: DirtyTracker,
    private val syncPushEngine: SyncPushEngine,
    private val connectivityMonitor: ConnectivityMonitor,
    private val syncStateManager: SyncStateManager,
    private val prefs: SharedPreferences,
    private val chitReorderHelper: ChitReorderHelper
) : ViewModel() {

    private val _uiState = MutableStateFlow(NotebookUiState())
    val uiState: StateFlow<NotebookUiState> = _uiState.asStateFlow()

    val syncState: StateFlow<SyncState> = syncStateManager.syncState

    /** Current user ID for stealth/owner comparisons. */
    val currentUserId: String get() = prefs.getString("user_id", "") ?: ""

    private val _pendingDeleteChitId = MutableStateFlow<String?>(null)
    val pendingDeleteChitId: StateFlow<String?> = _pendingDeleteChitId.asStateFlow()

    private val _pendingDeleteTitle = MutableStateFlow<String?>(null)
    val pendingDeleteTitle: StateFlow<String?> = _pendingDeleteTitle.asStateFlow()

    init {
        viewModelScope.launch {
            // Combine notes and checklists flows
            combine(
                chitRepository.getNoteChits(),
                chitRepository.getChecklistChits()
            ) { notes, checklists ->
                // Merge and deduplicate (a chit can have both note and checklist)
                val combined = (notes + checklists)
                    .distinctBy { it.id }
                    .sortedByDescending { it.modifiedDatetime ?: it.createdDatetime ?: "" }
                combined
            }.collect { combined ->
                _uiState.update { it.copy(isLoading = false, chits = combined) }
            }
        }
    }

    /**
     * Toggle a checklist item's checked state and persist with dirty tracking.
     */
    fun toggleChecklistItem(chitId: String, itemIndex: Int) {
        viewModelScope.launch {
            val chit = chitDao.getById(chitId) ?: return@launch
            val items = ChecklistOperations.parseChecklist(chit.checklist)
            val updated = ChecklistOperations.toggleChecklistItem(items, itemIndex)
            val json = ChecklistOperations.serializeChecklist(updated)

            val now = Instant.now().toString()
            chitDao.upsert(
                chit.copy(
                    checklist = json,
                    modifiedDatetime = now,
                    isDirty = true
                )
            )
            chitRepository.markDirty(chitId, "checklist")
        }
    }

    /**
     * Reorder notebook cards in the staggered grid.
     * Persists the new order both locally (SharedPreferences) and remotely (API).
     * Called from the ReorderableStaggeredGrid onReorder callback.
     *
     * Uses ChitReorderHelper (same pattern as Checklists and Projects).
     *
     * @param currentChits The current ordered list of chits displayed in the grid
     * @param fromIndex The index of the card being moved
     * @param toIndex The target index for the card
     *
     * Validates: Requirements 10.3
     */
    fun reorderNotebook(currentChits: List<ChitEntity>, fromIndex: Int, toIndex: Int) {
        viewModelScope.launch {
            val chitIds = currentChits.map { it.id }
            chitReorderHelper.persistReorder(
                tab = "Notebook",
                currentIds = chitIds,
                fromIndex = fromIndex,
                toIndex = toIndex
            )
        }
    }

    fun softDelete(chitId: String) {
        viewModelScope.launch {
            _pendingDeleteChitId.value?.let { previousId ->
                finalizeDelete(previousId)
            }
            val chit = chitDao.getById(chitId)
            _pendingDeleteTitle.value = chit?.title ?: "Chit"
            val now = Instant.now().toString()
            chitDao.markDeleted(chitId, now)
            _pendingDeleteChitId.value = chitId
        }
    }

    fun undoDelete() {
        val chitId = _pendingDeleteChitId.value ?: return
        viewModelScope.launch {
            val now = Instant.now().toString()
            chitDao.restoreDeleted(chitId, now)
            _pendingDeleteChitId.value = null
            _pendingDeleteTitle.value = null
        }
    }

    fun finalizeDelete(chitId: String? = null) {
        val id = chitId ?: _pendingDeleteChitId.value ?: return
        viewModelScope.launch {
            dirtyTracker.markDirty(id, setOf("deleted"))
            if (connectivityMonitor.isOnline.value) {
                launch { syncPushEngine.pushSingle(id) }
            }
            if (_pendingDeleteChitId.value == id) {
                _pendingDeleteChitId.value = null
                _pendingDeleteTitle.value = null
            }
        }
    }
}
