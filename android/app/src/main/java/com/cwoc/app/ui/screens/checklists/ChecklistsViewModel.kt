package com.cwoc.app.ui.screens.checklists

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cwoc.app.data.local.dao.ChitDao
import com.cwoc.app.data.local.entity.ChitEntity
import com.cwoc.app.data.repository.ChitRepository
import com.cwoc.app.domain.checklist.ChecklistItem
import com.cwoc.app.domain.checklist.ChecklistOperations
import com.cwoc.app.domain.sort.ChitReorderHelper
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.time.Instant
import javax.inject.Inject

/**
 * ViewModel for the Checklists view.
 * Provides checklist chits and handles toggle/reorder operations with dirty tracking.
 */
@HiltViewModel
class ChecklistsViewModel @Inject constructor(
    private val chitRepository: ChitRepository,
    private val chitDao: ChitDao,
    private val chitReorderHelper: ChitReorderHelper
) : ViewModel() {

    val checklistChits: StateFlow<List<ChitEntity>> = chitRepository.getChecklistChits()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    /**
     * Toggle a checklist item's checked state and persist with dirty tracking.
     */
    fun toggleItem(chitId: String, itemIndex: Int) {
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
     * Reorder a checklist item and persist with dirty tracking.
     */
    fun reorderItem(chitId: String, fromIndex: Int, toIndex: Int) {
        viewModelScope.launch {
            val chit = chitDao.getById(chitId) ?: return@launch
            val items = ChecklistOperations.parseChecklist(chit.checklist)
            val updated = ChecklistOperations.reorderChecklistItem(items, fromIndex, toIndex)
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
     * Reorder checklist cards in the staggered grid.
     * Persists the new order both locally (SharedPreferences) and remotely (API).
     * Called from the ReorderableStaggeredGrid onReorder callback.
     *
     * @param currentChits The current ordered list of chits displayed in the grid
     * @param fromIndex The index of the card being moved
     * @param toIndex The target index for the card
     *
     * Validates: Requirements 9.3
     */
    fun reorderChecklists(currentChits: List<ChitEntity>, fromIndex: Int, toIndex: Int) {
        viewModelScope.launch {
            val chitIds = currentChits.map { it.id }
            chitReorderHelper.persistReorder(
                tab = "Checklists",
                currentIds = chitIds,
                fromIndex = fromIndex,
                toIndex = toIndex
            )
        }
    }
}
