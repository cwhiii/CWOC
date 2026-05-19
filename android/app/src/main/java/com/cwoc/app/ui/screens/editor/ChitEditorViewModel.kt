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
import com.cwoc.app.data.remote.CwocApiService
import com.cwoc.app.data.repository.SettingsRepository
import com.cwoc.app.data.sync.ConnectivityMonitor
import com.cwoc.app.data.sync.DirtyTracker
import com.cwoc.app.data.sync.SyncPushEngine
import com.cwoc.app.domain.tags.TagNode
import com.cwoc.app.domain.tags.TagTreeParser
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
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
 * Phase 3 additions: conflict banner display and dismiss logic.
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4
 */
@HiltViewModel
class ChitEditorViewModel @Inject constructor(
    private val chitDao: ChitDao,
    private val contactDao: com.cwoc.app.data.local.dao.ContactDao,
    private val dirtyTracker: DirtyTracker,
    private val syncPushEngine: SyncPushEngine,
    private val connectivityMonitor: ConnectivityMonitor,
    private val apiService: CwocApiService,
    private val settingsRepository: SettingsRepository,
    savedStateHandle: SavedStateHandle
) : ViewModel() {

    companion object {
        const val NEW_CHIT_ID = "new"
    }

    private val chitId: String? = savedStateHandle.get<String>("chitId")
    private val isNew: Boolean = chitId == null || chitId == NEW_CHIT_ID

    // Task 33: Calendar pre-fill params
    private val prefillStart: String? = savedStateHandle.get<String>("start")
    private val prefillEnd: String? = savedStateHandle.get<String>("end")

    /** The original entity loaded from Room (null for new chits). */
    private var originalEntity: ChitEntity? = null

    private val _formState = MutableStateFlow(
        ChitFormState(
            id = if (isNew) UUID.randomUUID().toString() else chitId!!,
            isNew = isNew,
            // Task 33: Pre-fill start/end from calendar navigation
            startDatetime = if (isNew) prefillStart else null,
            endDatetime = if (isNew) prefillEnd else null
        )
    )
    /** Current form state exposed to the UI. */
    val formState: StateFlow<ChitFormState> = _formState.asStateFlow()

    /**
     * Snapshot of the form state at load time (for existing chits) or after a successful save.
     * Used to compute isDirty by comparing against the current formState.
     */
    private val _savedState = MutableStateFlow(
        ChitFormState(
            id = if (isNew) _formState.value.id else chitId!!,
            isNew = isNew
        )
    )

    /**
     * True when the current formState differs from the savedState snapshot.
     * Compares all editable fields (excludes `id` and `isNew` which are identity fields).
     *
     * Validates: Requirements 12.1
     */
    val isDirty: StateFlow<Boolean> = combine(_formState, _savedState) { current, saved ->
        current.title != saved.title ||
            current.note != saved.note ||
            current.startDatetime != saved.startDatetime ||
            current.endDatetime != saved.endDatetime ||
            current.dueDatetime != saved.dueDatetime ||
            current.pointInTime != saved.pointInTime ||
            current.status != saved.status ||
            current.priority != saved.priority ||
            current.severity != saved.severity ||
            current.tags != saved.tags ||
            current.checklist != saved.checklist ||
            current.people != saved.people ||
            current.location != saved.location ||
            current.color != saved.color ||
            current.alerts != saved.alerts ||
            current.recurrence != saved.recurrence ||
            current.recurrenceRule != saved.recurrenceRule ||
            current.recurrenceExceptions != saved.recurrenceExceptions ||
            current.allDay != saved.allDay ||
            current.timezone != saved.timezone ||
            current.availability != saved.availability ||
            current.perpetual != saved.perpetual ||
            current.habit != saved.habit ||
            current.habitGoal != saved.habitGoal ||
            current.habitSuccess != saved.habitSuccess ||
            current.habitResetPeriod != saved.habitResetPeriod ||
            current.habitLastActionDate != saved.habitLastActionDate ||
            current.habitHideOverall != saved.habitHideOverall ||
            current.showOnCalendar != saved.showOnCalendar ||
            current.isProjectMaster != saved.isProjectMaster ||
            current.childChits != saved.childChits ||
            current.assignedTo != saved.assignedTo ||
            current.prerequisites != saved.prerequisites ||
            current.stealth != saved.stealth ||
            current.autoCompleteChecklist != saved.autoCompleteChecklist ||
            current.checklistAutosave != saved.checklistAutosave ||
            current.healthData != saved.healthData ||
            current.attachments != saved.attachments ||
            current.nestThreadId != saved.nestThreadId ||
            current.emailFrom != saved.emailFrom ||
            current.emailTo != saved.emailTo ||
            current.emailCc != saved.emailCc ||
            current.emailBcc != saved.emailBcc ||
            current.emailSubject != saved.emailSubject ||
            current.emailBodyText != saved.emailBodyText ||
            current.emailBodyHtml != saved.emailBodyHtml ||
            current.emailStatus != saved.emailStatus ||
            current.emailSendAt != saved.emailSendAt ||
            current.emailRequestReadReceipt != saved.emailRequestReadReceipt
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), false)

    /** Controls visibility of the unsaved changes confirmation dialog. */
    private val _showUnsavedDialog = MutableStateFlow(false)
    val showUnsavedDialog: StateFlow<Boolean> = _showUnsavedDialog.asStateFlow()

    private val _isLoading = MutableStateFlow(!isNew)
    /** True while loading an existing chit from Room. */
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _isSaved = MutableStateFlow(false)
    /** Set to true after save or discard to trigger navigation back. */
    val isSaved: StateFlow<Boolean> = _isSaved.asStateFlow()

    // Phase 3 — Conflict banner state
    private val _showConflictBanner = MutableStateFlow(false)
    /** True when the chit has an unviewed conflict that should display a banner. */
    val showConflictBanner: StateFlow<Boolean> = _showConflictBanner.asStateFlow()

    private val _conflictFields = MutableStateFlow<List<String>>(emptyList())
    /** List of field names that had conflicts during the last server merge. */
    val conflictFields: StateFlow<List<String>> = _conflictFields.asStateFlow()

    /**
     * Editor settings loaded from SettingsRepository.
     * Contains timeFormat, calendarSnap, defaultTimezone, and customColors
     * needed by the editor zone composables.
     */
    data class EditorSettings(
        val timeFormat: String = "12h",
        val calendarSnap: Int = 15,
        val defaultTimezone: String = "America/New_York",
        val customColors: List<String> = emptyList(),
        val sharedUsers: List<String> = emptyList(),
        val savedLocations: List<String> = emptyList(),
        // L6: Default notifications to auto-populate on new chits
        val defaultNotifications: String? = null
    )

    private val _editorSettings = MutableStateFlow(EditorSettings())
    /** Settings relevant to the editor zones (time format, snap, timezone, custom colors). */
    val editorSettings: StateFlow<EditorSettings> = _editorSettings.asStateFlow()

    /** Tag tree parsed from SettingsEntity.tags JSON. Used by the TagsPickerSheet. */
    private val _tagTree = MutableStateFlow<List<TagNode>>(emptyList())
    val tagTree: StateFlow<List<TagNode>> = _tagTree.asStateFlow()

    /** All active contact display names for the People zone autocomplete. */
    private val _contactNames = MutableStateFlow<List<String>>(emptyList())
    val contactNames: StateFlow<List<String>> = _contactNames.asStateFlow()

    /** Map of contact display name → color hex for chip colorization. */
    private val _contactColors = MutableStateFlow<Map<String, String>>(emptyMap())
    val contactColors: StateFlow<Map<String, String>> = _contactColors.asStateFlow()

    init {
        if (!isNew) {
            loadExistingChit()
        }
        loadEditorSettings()
        loadTagTree()
        loadContactNames()
    }

    /**
     * Loads an existing chit from Room and populates the form state.
     * Also loads conflict state for the conflict banner.
     * Sets savedState snapshot for dirty tracking.
     * Sets isLoading to false when complete.
     */
    private fun loadExistingChit() {
        viewModelScope.launch {
            val entity = chitDao.getById(chitId!!)
            if (entity != null) {
                originalEntity = entity
                val loadedFormState = entity.toFormState()
                _formState.value = loadedFormState
                _savedState.value = loadedFormState

                // Phase 3: Load conflict state for banner display
                _showConflictBanner.value = entity.hasUnviewedConflict
                _conflictFields.value = parseConflictFields(entity.conflictFields)
            }
            _isLoading.value = false
        }
    }

    /**
     * Loads editor-relevant settings from SettingsRepository.
     * Extracts timeFormat, calendarSnap, defaultTimezone, and customColors.
     */
    private fun loadEditorSettings() {
        viewModelScope.launch {
            val settings = settingsRepository.get()
            if (settings != null) {
                val customColorsList = try {
                    settings.customColors?.let { json ->
                        Gson().fromJson<List<String>>(json, object : TypeToken<List<String>>() {}.type)
                    } ?: emptyList()
                } catch (_: Exception) {
                    emptyList()
                }

                val savedLocationsList = try {
                    settings.savedLocations?.let { json ->
                        val rawList: List<Map<String, Any?>> = Gson().fromJson(json, object : TypeToken<List<Map<String, Any?>>>() {}.type)
                        rawList.mapNotNull { it["name"] as? String }
                    } ?: emptyList()
                } catch (_: Exception) {
                    emptyList()
                }

                _editorSettings.value = EditorSettings(
                    timeFormat = settings.timeFormat ?: "12h",
                    calendarSnap = settings.calendarSnap?.toIntOrNull() ?: 15,
                    defaultTimezone = settings.defaultTimezone ?: "America/New_York",
                    customColors = customColorsList,
                    savedLocations = savedLocationsList,
                    // F1: Parse shared users from kioskUsers JSON array
                    sharedUsers = try {
                        if (!settings.kioskUsers.isNullOrBlank()) {
                            com.google.gson.Gson().fromJson(
                                settings.kioskUsers,
                                object : com.google.gson.reflect.TypeToken<List<String>>() {}.type
                            ) ?: emptyList()
                        } else emptyList()
                    } catch (e: Exception) { emptyList() },
                    // L6: Default notifications from settings
                    defaultNotifications = settings.defaultNotifications
                )
            }
        }
    }

    /**
     * Loads the tag tree from SettingsRepository and parses it via TagTreeParser.
     */
    private fun loadTagTree() {
        viewModelScope.launch {
            val settings = settingsRepository.get()
            if (settings != null) {
                _tagTree.value = TagTreeParser.parseTagTree(settings.tags)
            }
        }
    }

    /**
     * Loads all active contact display names and colors for the People zone.
     */
    private fun loadContactNames() {
        viewModelScope.launch {
            contactDao.getAllActive().collect { contacts ->
                _contactNames.value = contacts.mapNotNull { contact ->
                    contact.displayName
                        ?: listOfNotNull(contact.givenName, contact.surname).joinToString(" ").ifBlank { null }
                }
                // Build color map: display name → color hex
                val colorMap = mutableMapOf<String, String>()
                contacts.forEach { contact ->
                    val name = contact.displayName
                        ?: listOfNotNull(contact.givenName, contact.surname).joinToString(" ").ifBlank { null }
                    if (name != null && !contact.color.isNullOrBlank()) {
                        colorMap[name] = contact.color
                    }
                }
                _contactColors.value = colorMap
            }
        }
    }

    /**
     * Handles inline tag creation from the TagsPickerSheet.
     * Adds the new tag to the local settings tags JSON list and marks settings dirty.
     * Also refreshes the local tagTree state.
     *
     * Validates: Requirements 4.4
     */
    fun onTagCreated(tagName: String) {
        viewModelScope.launch {
            val settings = settingsRepository.get() ?: return@launch

            // Parse existing tags JSON
            val existingTags: MutableList<Map<String, Any?>> = try {
                settings.tags?.let { json ->
                    Gson().fromJson(json, object : TypeToken<MutableList<Map<String, Any?>>>() {}.type)
                } ?: mutableListOf()
            } catch (_: Exception) {
                mutableListOf()
            }

            // Check if tag already exists
            val alreadyExists = existingTags.any { (it["name"] as? String) == tagName }
            if (alreadyExists) return@launch

            // Add new tag entry
            val newTag = mapOf<String, Any?>(
                "name" to tagName,
                "color" to null,
                "fontColor" to null,
                "favorite" to false
            )
            existingTags.add(newTag)

            // Update settings with new tags JSON
            val updatedSettings = settings.copy(tags = Gson().toJson(existingTags))
            settingsRepository.update(updatedSettings)

            // Refresh the tag tree
            _tagTree.value = TagTreeParser.parseTagTree(updatedSettings.tags)
        }
    }

    /**
     * Dismisses the conflict banner for the current chit.
     *
     * Flow:
     * 1. Hide the banner immediately (optimistic UI)
     * 2. Clear the local conflict flag in Room
     * 3. Attempt to notify the server via POST /api/chit/{id}/dismiss-conflict
     * 4. If the server call fails (network error or non-2xx), that's acceptable —
     *    the server will clear the flag on the next successful sync cycle.
     *
     * Validates: Requirements 1.3, 1.4, 1.5
     */
    fun dismissConflict() {
        val id = chitId ?: return

        viewModelScope.launch {
            // Immediately hide the banner
            _showConflictBanner.value = false
            _conflictFields.value = emptyList()

            // Clear local conflict state in Room
            chitDao.clearConflictFlag(id)

            // Attempt server dismiss (best-effort, fire-and-forget)
            try {
                apiService.dismissConflict(id)
                // Success or failure doesn't affect local state — banner is already hidden
            } catch (_: Exception) {
                // Network failure is fine — server will clear on next sync
            }
        }
    }

    /**
     * Parses the JSON conflict fields string into a list of field names.
     * Returns an empty list if the input is null, blank, or invalid JSON.
     */
    private fun parseConflictFields(json: String?): List<String> {
        if (json.isNullOrBlank()) return emptyList()
        return try {
            Gson().fromJson(json, object : TypeToken<List<String>>() {}.type)
        } catch (_: Exception) {
            emptyList()
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
     * 6. Update savedState snapshot (so isDirty resets to false)
     * 7. Set isSaved = true to trigger navigation
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

            // Update savedState so isDirty resets to false after save
            _savedState.value = form
            // Update originalEntity so subsequent saves detect changes correctly
            originalEntity = entity

            // Signal navigation back
            _isSaved.value = true
        }
    }

    /**
     * Saves the current form state without exiting the editor (Save & Stay).
     * Same as save() but does not set isSaved=true, so no navigation occurs.
     * Updates the autosave indicator state.
     */
    private val _lastSavedAt = MutableStateFlow<String?>(null)
    /** Timestamp of the last successful save (for autosave indicator). */
    val lastSavedAt: StateFlow<String?> = _lastSavedAt.asStateFlow()

    fun saveAndStay() {
        viewModelScope.launch {
            val form = _formState.value
            val now = Instant.now().toString()

            val changedFields = detectChangedFields(originalEntity, form)

            if (changedFields.isEmpty() && !isNew) {
                _lastSavedAt.value = now
                return@launch
            }

            val entity = form.toEntity(
                originalEntity = originalEntity,
                modifiedDatetime = now,
                createdDatetime = if (isNew) now else originalEntity?.createdDatetime
            )

            chitDao.upsert(entity)
            dirtyTracker.markDirty(entity.id, changedFields)

            if (connectivityMonitor.isOnline.value) {
                viewModelScope.launch {
                    syncPushEngine.pushSingle(entity.id)
                }
            }

            _savedState.value = form
            originalEntity = entity
            _lastSavedAt.value = now

            // If this was a new chit, update the form state to reflect it's no longer new
            if (isNew) {
                _formState.value = form.copy(isNew = false)
            }
        }
    }

    /**
     * Deletes the current chit (soft delete) and navigates back.
     */
    fun deleteChit() {
        viewModelScope.launch {
            val id = _formState.value.id
            if (isNew) {
                _isSaved.value = true
                return@launch
            }
            val entity = chitDao.getById(id) ?: return@launch
            val deletedEntity = entity.copy(
                deleted = true,
                modifiedDatetime = Instant.now().toString()
            )
            chitDao.upsert(deletedEntity)
            dirtyTracker.markDirty(id, setOf("deleted"))
            if (connectivityMonitor.isOnline.value) {
                viewModelScope.launch {
                    syncPushEngine.pushSingle(id)
                }
            }
            _isSaved.value = true
        }
    }

    /**
     * Duplicates the current chit with a new ID and navigates back.
     * Returns the new chit ID for potential navigation.
     */
    private val _duplicatedChitId = MutableStateFlow<String?>(null)
    val duplicatedChitId: StateFlow<String?> = _duplicatedChitId.asStateFlow()

    fun duplicateChit() {
        viewModelScope.launch {
            val form = _formState.value
            val now = Instant.now().toString()
            val newId = UUID.randomUUID().toString()

            val duplicateForm = form.copy(
                id = newId,
                isNew = true
            )

            val entity = duplicateForm.toEntity(
                originalEntity = null,
                modifiedDatetime = now,
                createdDatetime = now
            )

            chitDao.upsert(entity)
            dirtyTracker.markDirty(newId, detectChangedFields(null, duplicateForm))

            if (connectivityMonitor.isOnline.value) {
                viewModelScope.launch {
                    syncPushEngine.pushSingle(newId)
                }
            }

            _duplicatedChitId.value = newId
            _isSaved.value = true
        }
    }

    /**
     * Sends the current email draft.
     * Flow: save chit → call POST /api/email/send/{chitId} → navigate back.
     * The server handles SMTP delivery and moves the chit to Sent folder.
     */
    fun sendEmail() {
        viewModelScope.launch {
            val form = _formState.value
            val now = Instant.now().toString()

            // Step 1: Save the chit first
            val changedFields = detectChangedFields(originalEntity, form)
            val entity = form.toEntity(
                originalEntity = originalEntity,
                modifiedDatetime = now,
                createdDatetime = if (isNew) now else originalEntity?.createdDatetime
            )
            chitDao.upsert(entity)
            if (changedFields.isNotEmpty() || isNew) {
                dirtyTracker.markDirty(entity.id, changedFields)
            }

            // Step 2: Push to server so the chit is available for sending
            if (connectivityMonitor.isOnline.value) {
                syncPushEngine.pushSingle(entity.id)
            }

            // Step 3: Call the send API
            try {
                if (connectivityMonitor.isOnline.value) {
                    val response = apiService.sendEmail(entity.id)
                    if (response.isSuccessful) {
                        // Update local state to reflect sent status
                        val sentEntity = entity.copy(
                            emailStatus = "sent",
                            modifiedDatetime = Instant.now().toString()
                        )
                        chitDao.upsert(sentEntity)
                    }
                }
            } catch (_: Exception) {
                // If send fails, the chit remains as draft — user can retry
            }

            // Step 4: Navigate back
            _savedState.value = form
            originalEntity = entity
            _isSaved.value = true
        }
    }

    /**
     * Discards the email draft by clearing email status and navigating back.
     * Removes the draft status so the chit reverts to a normal chit.
     */
    fun discardEmailDraft() {
        viewModelScope.launch {
            val form = _formState.value
            val now = Instant.now().toString()

            // Clear email draft fields
            val clearedForm = form.copy(
                emailStatus = null,
                emailFrom = null,
                emailTo = null,
                emailCc = null,
                emailBcc = null,
                emailSubject = null,
                emailBodyText = null,
                emailBodyHtml = null
            )

            val entity = clearedForm.toEntity(
                originalEntity = originalEntity,
                modifiedDatetime = now,
                createdDatetime = if (isNew) now else originalEntity?.createdDatetime
            )

            chitDao.upsert(entity)
            val changedFields = detectChangedFields(originalEntity, clearedForm)
            if (changedFields.isNotEmpty()) {
                dirtyTracker.markDirty(entity.id, changedFields)
            }

            if (connectivityMonitor.isOnline.value) {
                viewModelScope.launch {
                    syncPushEngine.pushSingle(entity.id)
                }
            }

            _savedState.value = clearedForm
            originalEntity = entity
            _isSaved.value = true
        }
    }

    /**
     * Discards changes and navigates back without any DB writes.
     */
    fun discard() {
        _isSaved.value = true
    }

    /**
     * Handles back-press from the editor.
     * If the form has unsaved changes, shows the unsaved changes dialog.
     * Otherwise, navigates back immediately.
     *
     * Validates: Requirements 12.2
     */
    fun onBackPressed() {
        if (isDirty.value) {
            _showUnsavedDialog.value = true
        } else {
            _isSaved.value = true
        }
    }

    /**
     * Saves the current form state and then exits the editor.
     * Called when the user chooses "Save" in the unsaved changes dialog.
     *
     * Validates: Requirements 12.3
     */
    fun saveAndExit() {
        _showUnsavedDialog.value = false
        save()
    }

    /**
     * Discards unsaved changes and exits the editor without saving.
     * Called when the user chooses "Discard" in the unsaved changes dialog.
     *
     * Validates: Requirements 12.4
     */
    fun discardAndExit() {
        _showUnsavedDialog.value = false
        _isSaved.value = true
    }

    /**
     * Dismisses the unsaved changes dialog and returns to the editor.
     * Called when the user chooses "Cancel" in the unsaved changes dialog.
     *
     * Validates: Requirements 12.5
     */
    fun cancelBack() {
        _showUnsavedDialog.value = false
    }
}
