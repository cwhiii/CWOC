package com.cwoc.app.ui.screens.trash

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cwoc.app.data.local.dao.ChitDao
import com.cwoc.app.data.local.entity.ChitEntity
import com.cwoc.app.data.sync.ConnectivityMonitor
import com.cwoc.app.data.sync.DirtyTracker
import com.cwoc.app.data.sync.SyncPushEngine
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.time.Instant
import javax.inject.Inject

/**
 * ViewModel for the Trash screen.
 * Queries all soft-deleted chits and provides restore/purge operations.
 * Supports bulk selection, restore, and purge matching the web implementation.
 *
 * Validates: Requirements 11.3, 11.4, 11.6
 */
@HiltViewModel
class TrashViewModel @Inject constructor(
    private val chitDao: ChitDao,
    private val dirtyTracker: DirtyTracker,
    private val syncPushEngine: SyncPushEngine,
    private val connectivityMonitor: ConnectivityMonitor
) : ViewModel() {

    /** All chits where deleted == true, as a reactive StateFlow. */
    val trashedChits: StateFlow<List<ChitEntity>> = chitDao.getDeletedChits()
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = emptyList()
        )

    /** Selected chit IDs for bulk operations. */
    private val _selectedIds = kotlinx.coroutines.flow.MutableStateFlow<Set<String>>(emptySet())
    val selectedIds: StateFlow<Set<String>> = _selectedIds

    fun toggleSelection(chitId: String) {
        val current = _selectedIds.value.toMutableSet()
        if (chitId in current) current.remove(chitId) else current.add(chitId)
        _selectedIds.value = current
    }

    fun selectAll(chits: List<ChitEntity>) {
        _selectedIds.value = chits.map { it.id }.toSet()
    }

    fun deselectAll() {
        _selectedIds.value = emptySet()
    }

    fun isSelected(chitId: String): Boolean = chitId in _selectedIds.value

    fun isAllSelected(chits: List<ChitEntity>): Boolean =
        chits.isNotEmpty() && _selectedIds.value.size == chits.size

    fun toggleSelectAll(chits: List<ChitEntity>) {
        if (isAllSelected(chits)) deselectAll() else selectAll(chits)
    }

    /**
     * Restores a chit from trash by setting deleted=false,
     * marking it dirty with the "deleted" field, and pushing if online.
     *
     * Validates: Requirement 11.3
     */
    fun restore(chitId: String) {
        viewModelScope.launch {
            val now = Instant.now().toString()

            // 1. Set deleted=false in Room
            chitDao.restoreDeleted(chitId, now)

            // 2. Mark dirty with "deleted" field for sync
            dirtyTracker.markDirty(chitId, setOf("deleted"))

            // 3. Optimistic push if online
            if (connectivityMonitor.isOnline.value) {
                launch {
                    syncPushEngine.pushSingle(chitId)
                }
            }

            // Remove from selection
            _selectedIds.value = _selectedIds.value - chitId
        }
    }

    /**
     * Permanently purges a chit by hard-deleting it from Room
     * and syncing the deletion to the server.
     *
     * Validates: Requirement 11.4, 11.6
     */
    fun purge(chitId: String) {
        viewModelScope.launch {
            // 1. Push the deletion to the server first (if online),
            //    so the server knows to hard-delete as well.
            //    Mark dirty with "purged" field before push so the server
            //    receives the delete intent.
            dirtyTracker.markDirty(chitId, setOf("purged"))

            if (connectivityMonitor.isOnline.value) {
                syncPushEngine.pushSingle(chitId)
            }

            // 2. Hard-delete from Room (actual DELETE, not soft-delete)
            chitDao.hardDelete(chitId)

            // Remove from selection
            _selectedIds.value = _selectedIds.value - chitId
        }
    }

    /** Bulk restore all selected chits. */
    fun bulkRestore() {
        viewModelScope.launch {
            val ids = _selectedIds.value.toList()
            ids.forEach { restore(it) }
            _selectedIds.value = emptySet()
        }
    }

    /** Bulk purge all selected chits. */
    fun bulkPurge() {
        viewModelScope.launch {
            val ids = _selectedIds.value.toList()
            ids.forEach { purge(it) }
            _selectedIds.value = emptySet()
        }
    }
}
