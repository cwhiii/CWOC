package com.cwoc.app.ui.screens.editor

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cwoc.app.data.local.dao.ChitDao
import com.cwoc.app.data.local.entity.ChitEntity
import com.cwoc.app.data.mapper.ChitFormState
import com.cwoc.app.data.mapper.detectChangedFields
import com.cwoc.app.data.mapper.toEntity
import com.cwoc.app.data.mapper.toFormState
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
 * ViewModel for the Chit Editor screen.
 *
 * Handles both creating new chits and editing existing ones.
 * Accepts a `chitId` via SavedStateHandle:
 *   - null or "new" → creation mode (generates a UUID)
 *   - any other value → edit mode (loads existing entity from Room)
 *
 * Validates: Requirements 1.1, 1.2, 1.4, 1.5, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4
 */
@HiltViewModel
class ChitEditorViewModel @Inject constructor(
    private val chitDao: ChitDao,
    private val dirtyTracker: DirtyTracker,
    private val syncPushEngine: SyncPushEngine,
    private val connectivityMonitor: ConnectivityMonitor,
    savedStateHandle: SavedStateHandle
) : ViewModel() {

    companion object {
        const val NEW_CHIT_ID = "new"
    }

    private val chitId: String? = savedStateHandle.get<String>("chitId")
    private val isNew: Boolean = chitId == null || chitId == NEW_CHIT_ID

    /** The original entity loaded from Room (null for new chits). */
    private var originalEntity: ChitEntity? = null

    private val _formState = MutableStateFlow(
        ChitFormState(
            id = if (isNew) UUID.randomUUID().toString() else chitId!!,
            isNew = isNew
        )
    )
    /** Current form state exposed to the UI. */
    val formState: StateFlow<ChitFormState> = _formState.asStateFlow()

    private val _isLoading = MutableStateFlow(!isNew)
    /** True while loading an existing chit from Room. */
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _isSaved = MutableStateFlow(false)
    /** Set to true after save or discard to trigger navigation back. */
    val isSaved: StateFlow<Boolean> = _isSaved.asStateFlow()

    init {
        if (!isNew) {
            loadExistingChit()
        }
    }

    /**
     * Loads an existing chit from Room and populates the form state.
     * Sets isLoading to false when complete.
     */
    private fun loadExistingChit() {
        viewModelScope.launch {
            val entity = chitDao.getById(chitId!!)
            if (entity != null) {
                originalEntity = entity
                _formState.value = entity.toFormState()
            }
            _isLoading.value = false
        }
    }

    /**
     * Updates the form state. Called by the UI when any field changes.
     */
    fun updateForm(newState: ChitFormState) {
        _formState.value = newState
    }

    /**
     * Persists the current form state to Room, marks dirty, and optimistically
     * pushes to the server if online.
     *
     * Steps:
     * 1. Detect changed fields via detectChangedFields(originalEntity, currentFormState)
     * 2. Convert form to entity via toEntity(originalEntity, now, createdDatetime)
     * 3. Upsert to Room via chitDao.upsert(entity)
     * 4. Mark dirty via dirtyTracker.markDirty(chitId, changedFields)
     * 5. If online, optimistic push via syncPushEngine.pushSingle(chitId)
     * 6. Set isSaved = true to trigger navigation
     */
    fun save() {
        viewModelScope.launch {
            val form = _formState.value
            val now = Instant.now().toString()

            // Detect which fields changed
            val changedFields = detectChangedFields(originalEntity, form)

            // If editing an existing chit with no changes, just navigate back
            if (changedFields.isEmpty() && !isNew) {
                _isSaved.value = true
                return@launch
            }

            // Convert form state to entity for persistence
            val entity = form.toEntity(
                originalEntity = originalEntity,
                modifiedDatetime = now,
                createdDatetime = if (isNew) now else originalEntity?.createdDatetime
            )

            // Persist to Room
            chitDao.upsert(entity)

            // Mark dirty with changed fields
            dirtyTracker.markDirty(entity.id, changedFields)

            // Optimistic push if online (fire-and-forget, non-blocking)
            if (connectivityMonitor.isOnline.value) {
                viewModelScope.launch {
                    syncPushEngine.pushSingle(entity.id)
                }
            }

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
