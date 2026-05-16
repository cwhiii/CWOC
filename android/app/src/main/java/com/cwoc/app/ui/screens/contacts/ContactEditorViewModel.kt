package com.cwoc.app.ui.screens.contacts

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cwoc.app.data.local.entity.ContactEntity
import com.cwoc.app.data.mapper.ContactFormState
import com.cwoc.app.data.mapper.detectContactChangedFields
import com.cwoc.app.data.mapper.toContactEntity
import com.cwoc.app.data.mapper.toContactFormState
import com.cwoc.app.data.repository.ContactRepository
import com.cwoc.app.data.sync.ConnectivityMonitor
import com.cwoc.app.data.sync.DirtyTracker
import com.cwoc.app.data.sync.SyncPushEngine
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Instant
import java.util.UUID
import javax.inject.Inject

/**
 * ViewModel for the Contact Editor screen.
 *
 * Handles both creating new contacts and editing existing ones.
 * Accepts a `contactId` via SavedStateHandle:
 *   - null or "new" → creation mode (generates a UUID)
 *   - any other value → edit mode (loads existing entity from Room)
 *
 * On save:
 *   - Detects changed fields via detectContactChangedFields()
 *   - Converts form to entity, persists via ContactRepository
 *   - Marks dirty via DirtyTracker.markContactDirty()
 *   - Triggers immediate push if online
 *
 * On delete:
 *   - Soft-deletes via ContactRepository.delete()
 *
 * Validates: Requirements 4.1, 4.2, 4.3
 */
@HiltViewModel
class ContactEditorViewModel @Inject constructor(
    private val contactRepository: ContactRepository,
    private val dirtyTracker: DirtyTracker,
    private val syncPushEngine: SyncPushEngine,
    private val connectivityMonitor: ConnectivityMonitor,
    savedStateHandle: SavedStateHandle
) : ViewModel() {

    companion object {
        const val NEW_CONTACT_ID = "new"
    }

    private val contactId: String? = savedStateHandle.get<String>("contactId")
    private val isNew: Boolean = contactId == null || contactId == NEW_CONTACT_ID

    /** The original entity loaded from Room (null for new contacts). */
    private var originalEntity: ContactEntity? = null

    private val _formState = MutableStateFlow(
        ContactFormState(
            id = if (isNew) UUID.randomUUID().toString() else contactId!!,
            isNew = isNew
        )
    )
    /** Current form state exposed to the UI. */
    val formState: StateFlow<ContactFormState> = _formState.asStateFlow()

    private val _isLoading = MutableStateFlow(!isNew)
    /** True while loading an existing contact from Room. */
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _isSaved = MutableStateFlow(false)
    /** Set to true after save, delete, or discard to trigger navigation back. */
    val isSaved: StateFlow<Boolean> = _isSaved.asStateFlow()

    init {
        if (!isNew) {
            loadExistingContact()
        }
    }

    /**
     * Loads an existing contact from Room and populates the form state.
     * Sets isLoading to false when complete.
     */
    private fun loadExistingContact() {
        viewModelScope.launch {
            val entity = contactRepository.getById(contactId!!)
            if (entity != null) {
                originalEntity = entity
                _formState.value = entity.toContactFormState()
            }
            _isLoading.value = false
        }
    }

    /**
     * Updates the form state. Called by the UI when any field changes.
     */
    fun updateForm(newState: ContactFormState) {
        _formState.value = newState
    }

    /**
     * Convenience method for updating a single field via a lambda.
     * Example: `viewModel.updateField { it.copy(givenName = "John") }`
     */
    fun updateField(updater: (ContactFormState) -> ContactFormState) {
        _formState.value = updater(_formState.value)
    }

    /**
     * Persists the current form state via ContactRepository, marks dirty, and
     * optimistically pushes to the server if online.
     *
     * Steps:
     * 1. Detect changed fields via detectContactChangedFields(originalEntity, currentFormState)
     * 2. If editing with no changes, just navigate back
     * 3. Convert form to entity via toContactEntity(originalEntity, now, createdDatetime)
     * 4. Create or update via ContactRepository (which handles upsert + dirty tracking + push)
     * 5. Set isSaved = true to trigger navigation
     *
     * Validates: Requirements 4.1, 4.2, 4.4
     */
    fun save() {
        viewModelScope.launch {
            val form = _formState.value
            val now = Instant.now().toString()

            // Detect which fields changed
            val changedFields = detectContactChangedFields(originalEntity, form)

            // If editing an existing contact with no changes, just navigate back
            if (changedFields.isEmpty() && !isNew) {
                _isSaved.value = true
                return@launch
            }

            // Convert form state to entity for persistence
            val entity = form.toContactEntity(
                originalEntity = originalEntity,
                modifiedDatetime = now,
                createdDatetime = if (isNew) now else originalEntity?.createdDatetime
            )

            if (isNew) {
                contactRepository.create(entity)
            } else {
                contactRepository.update(entity, changedFields)
            }

            // Signal navigation back
            _isSaved.value = true
        }
    }

    /**
     * Soft-deletes the contact via ContactRepository.
     * The repository handles marking deleted=true, dirty tracking, and push.
     *
     * Validates: Requirements 4.3
     */
    fun delete() {
        viewModelScope.launch {
            val id = _formState.value.id
            contactRepository.delete(id)

            // Signal navigation back
            _isSaved.value = true
        }
    }

    /**
     * Discards changes and navigates back without any DB writes.
     */
    fun discard() {
        _isSaved.value = true
    }
}
