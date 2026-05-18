package com.cwoc.app.ui.screens.contacts

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cwoc.app.data.local.entity.ContactEntity
import com.cwoc.app.data.repository.ContactRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

data class TrashUiState(
    val selectedIds: Set<String> = emptySet(),
    val isProcessing: Boolean = false,
    val message: String? = null
)

@HiltViewModel
class ContactTrashViewModel @Inject constructor(
    private val contactRepository: ContactRepository
) : ViewModel() {

    val trashContacts: StateFlow<List<ContactEntity>> = contactRepository.getTrashContacts()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    private val _uiState = MutableStateFlow(TrashUiState())
    val uiState: StateFlow<TrashUiState> = _uiState.asStateFlow()

    fun toggleSelection(contactId: String) {
        val current = _uiState.value.selectedIds.toMutableSet()
        if (contactId in current) current.remove(contactId) else current.add(contactId)
        _uiState.value = _uiState.value.copy(selectedIds = current)
    }

    fun selectAll(contacts: List<ContactEntity>) {
        _uiState.value = _uiState.value.copy(selectedIds = contacts.map { it.id }.toSet())
    }

    fun deselectAll() {
        _uiState.value = _uiState.value.copy(selectedIds = emptySet())
    }

    fun isSelected(contactId: String): Boolean = contactId in _uiState.value.selectedIds

    fun isAllSelected(contacts: List<ContactEntity>): Boolean =
        contacts.isNotEmpty() && _uiState.value.selectedIds.size == contacts.size

    fun toggleSelectAll(contacts: List<ContactEntity>) {
        if (isAllSelected(contacts)) deselectAll() else selectAll(contacts)
    }

    fun restoreContact(contactId: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isProcessing = true)
            contactRepository.restoreFromTrash(contactId)
            val newSelected = _uiState.value.selectedIds - contactId
            _uiState.value = _uiState.value.copy(
                isProcessing = false,
                selectedIds = newSelected,
                message = "Contact restored"
            )
        }
    }

    fun purgeContact(contactId: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isProcessing = true)
            contactRepository.purgeFromTrash(contactId)
            val newSelected = _uiState.value.selectedIds - contactId
            _uiState.value = _uiState.value.copy(
                isProcessing = false,
                selectedIds = newSelected,
                message = "Contact permanently deleted"
            )
        }
    }

    fun bulkRestore() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isProcessing = true)
            val ids = _uiState.value.selectedIds.toList()
            ids.forEach { contactRepository.restoreFromTrash(it) }
            _uiState.value = _uiState.value.copy(
                isProcessing = false,
                selectedIds = emptySet(),
                message = "${ids.size} contact(s) restored"
            )
        }
    }

    fun bulkPurge() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isProcessing = true)
            val ids = _uiState.value.selectedIds.toList()
            ids.forEach { contactRepository.purgeFromTrash(it) }
            _uiState.value = _uiState.value.copy(
                isProcessing = false,
                selectedIds = emptySet(),
                message = "${ids.size} contact(s) permanently deleted"
            )
        }
    }

    fun clearMessage() {
        _uiState.value = _uiState.value.copy(message = null)
    }
}
