package com.cwoc.app.ui.screens.checklists

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cwoc.app.data.local.dao.ChitDao
import com.cwoc.app.data.local.entity.ChitEntity
import com.cwoc.app.data.repository.ChitRepository
import com.cwoc.app.domain.checklist.ChecklistItem
import com.cwoc.app.domain.checklist.ChecklistOperations
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
    private val chitDao: ChitDao
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
}
