package com.cwoc.app.ui.screens.email

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cwoc.app.data.local.dao.ChitDao
import com.cwoc.app.data.local.entity.ChitEntity
import com.cwoc.app.data.repository.ChitRepository
import com.cwoc.app.data.repository.ContactRepository
import com.cwoc.app.data.repository.EmailRepository
import com.cwoc.app.data.repository.BundleRepository
import com.cwoc.app.data.repository.SettingsRepository
import com.cwoc.app.data.sync.ConnectivityMonitor
import com.cwoc.app.data.sync.DirtyTracker
import com.cwoc.app.data.sync.SyncPushEngine
import com.cwoc.app.domain.email.BodyPreviewStripper
import com.cwoc.app.domain.email.DateGroup
import com.cwoc.app.domain.email.DateGrouper
import com.cwoc.app.domain.email.DraftDetector
import com.cwoc.app.domain.email.EmailDateFormatter
import com.cwoc.app.domain.email.SmartLink
import com.cwoc.app.domain.email.SmartLinkDetector
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.Instant
import javax.inject.Inject

/**
 * Represents a threaded group of email messages.
 * Emails are grouped by normalized subject + in-reply-to/references chain.
 */
data class EmailThread(
    val id: String,
    val subject: String,
    val latestMessage: ChitEntity,
    val messages: List<ChitEntity>,
    val unreadCount: Int,
    val latestDate: String?,
    val nestedChits: List<ChitEntity> = emptyList(),
    val isPinned: Boolean = false,
    val hasReplyIndicator: Boolean = false,
    val bodyPreview: String = "",
    val smartLinks: List<SmartLink> = emptyList(),
    val dateGroup: DateGroup = DateGroup.OLDER,
    val formattedDate: String = ""
)

/**
 * Account info for display in account filter pills.
 */
data class EmailAccountInfo(
    val id: String,
    val nickname: String,
    val email: String,
    val isActive: Boolean = true,
    val syncState: SyncState = SyncState.IDLE,
    val lastSyncTime: String? = null,
    val error: String? = null
)

enum class SyncState { IDLE, SYNCING, SUCCESS, ERROR }

/**
 * Represents a pending undo action (archive or delete).
 */
data class UndoAction(
    val type: UndoType,
    val chitId: String,
    val threadId: String,
    val subject: String,
    val durationMs: Long = 5000L
)

enum class UndoType { ARCHIVE, DELETE }

data class EmailUiState(
    // Existing
    val currentFolder: String = "inbox",
    val activeBundle: String? = null,
    val accountFilter: List<String> = emptyList(),
    val threads: List<EmailThread> = emptyList(),
    val unreadCount: Int = 0,
    val isLoading: Boolean = true,

    // Multi-select
    val isMultiSelectMode: Boolean = false,
    val selectedIds: Set<String> = emptySet(),

    // Sorting
    val unreadAtTop: Boolean = false,
    val groupByDate: Boolean = true,

    // Pagination
    val paginateEnabled: Boolean = false,
    val currentPage: Int = 0,
    val totalThreadCount: Int = 0,
    val pageSize: Int = 50,

    // Undo state
    val undoAction: UndoAction? = null,

    // Threads pending dismissal (hidden immediately, removed on undo expiry)
    val pendingDismissThreadIds: Set<String> = emptySet(),

    // Sync state
    val accounts: List<EmailAccountInfo> = emptyList(),
    val syncingAccounts: Set<String> = emptySet(),
    val accountErrors: Map<String, String> = emptyMap(),

    // Settings
    val use24Hour: Boolean = false,
    val checkInterval: String = "manual"
)

@HiltViewModel
class EmailViewModel @Inject constructor(
    private val chitRepository: ChitRepository,
    private val chitDao: ChitDao,
    private val dirtyTracker: DirtyTracker,
    private val syncPushEngine: SyncPushEngine,
    private val connectivityMonitor: ConnectivityMonitor,
    private val emailRepository: EmailRepository,
    private val settingsRepository: SettingsRepository,
    private val contactRepository: ContactRepository,
    private val bundleRepository: BundleRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(EmailUiState())
    val uiState: StateFlow<EmailUiState> = _uiState.asStateFlow()

    /** Tag tree for the bulk tag picker modal. */
    private val _tagTree = MutableStateFlow<List<com.cwoc.app.domain.tags.TagNode>>(emptyList())
    val tagTree: StateFlow<List<com.cwoc.app.domain.tags.TagNode>> = _tagTree.asStateFlow()

    /** All email chits from the database (unfiltered). */
    private var allEmailChits: List<ChitEntity> = emptyList()

    /** All chits (for nested chit lookup). */
    private var allChits: List<ChitEntity> = emptyList()

    /** Auto-check mail timer job. */
    private var autoCheckJob: Job? = null

    /** Undo countdown job. */
    private var undoCountdownJob: Job? = null

    /** Cached sender email → image URL mappings for email card avatars. */
    private val _senderImageUrls = MutableStateFlow<Map<String, String?>>(emptyMap())
    val senderImageUrls: StateFlow<Map<String, String?>> = _senderImageUrls.asStateFlow()

    init {
        // Observe all chits for email filtering and nested chit lookup
        viewModelScope.launch {
            chitRepository.getAllNonDeleted().collect { chits ->
                allChits = chits
                allEmailChits = chits.filter { chit ->
                    chit.emailMessageId != null || chit.emailStatus != null
                }
                recomputeState()
            }
        }

        // Observe settings for email display preferences
        viewModelScope.launch {
            settingsRepository.settings.collect { settings ->
                val use24Hour = settings.timeFormat == "24hour"
                val checkInterval = settings.emailCheckInterval ?: "manual"
                val paginateEnabled = settings.paginateEmail == "1" || settings.paginateEmail == "true"
                val groupByDate = settings.emailGroupBy != "none"
                val accounts = parseAccountsFromSettings(settings.emailAccounts)

                // Load tag tree for bulk tag picker
                _tagTree.value = com.cwoc.app.domain.tags.TagTreeParser.parseTagTree(settings.tags)

                _uiState.update {
                    it.copy(
                        use24Hour = use24Hour,
                        checkInterval = checkInterval,
                        paginateEnabled = paginateEnabled,
                        groupByDate = groupByDate,
                        accounts = accounts
                    )
                }

                // Restart auto-check timer when interval changes
                setupAutoCheckTimer(checkInterval)
                recomputeState()
            }
        }
    }

    // ─── Multi-Select ────────────────────────────────────────────────────────

    /** Enter multi-select mode and select the given chit. */
    fun enterMultiSelect(chitId: String) {
        _uiState.update {
            it.copy(
                isMultiSelectMode = true,
                selectedIds = setOf(chitId)
            )
        }
    }

    /** Toggle selection of a chit in multi-select mode. */
    fun toggleSelection(chitId: String) {
        _uiState.update { state ->
            val newSelected = if (chitId in state.selectedIds) {
                state.selectedIds - chitId
            } else {
                state.selectedIds + chitId
            }
            // Exit multi-select if nothing is selected
            if (newSelected.isEmpty()) {
                state.copy(isMultiSelectMode = false, selectedIds = emptySet())
            } else {
                state.copy(selectedIds = newSelected)
            }
        }
    }

    /** Cycle through select modes: All → None → Read → Unread → All → ... */
    private var _selectCycleIndex = 0
    private val _selectModes = listOf("all", "none", "read", "unread")

    /** The current select mode label (exposed for UI indicator) */
    private val _selectModeLabel = MutableStateFlow<String?>(null)
    val selectModeLabel: StateFlow<String?> = _selectModeLabel.asStateFlow()

    fun cycleSelectMode() {
        _selectCycleIndex = (_selectCycleIndex + 1) % _selectModes.size
        val mode = _selectModes[_selectCycleIndex]

        _uiState.update { state ->
            val selectedIds = when (mode) {
                "all" -> state.threads.map { it.id }.toSet()
                "none" -> emptySet()
                "read" -> state.threads.filter { it.unreadCount == 0 }.map { it.id }.toSet()
                "unread" -> state.threads.filter { it.unreadCount > 0 }.map { it.id }.toSet()
                else -> emptySet()
            }
            state.copy(
                isMultiSelectMode = selectedIds.isNotEmpty(),
                selectedIds = selectedIds
            )
        }

        // Show mode label briefly
        _selectModeLabel.value = when (mode) {
            "all" -> "All"
            "none" -> "None"
            "read" -> "Read"
            "unread" -> "Unread"
            else -> null
        }

        // Clear label after 2 seconds
        viewModelScope.launch {
            kotlinx.coroutines.delay(2000)
            _selectModeLabel.value = null
        }
    }

    /** Reset cycle index when selection is manually changed */
    private fun resetSelectCycle() {
        _selectCycleIndex = 0
    }

    /** Select all visible threads. */
    fun selectAll() {
        _selectCycleIndex = 0 // reset so next cycle goes to "all" → "none"
        cycleSelectMode()
    }

    /** Deselect all and exit multi-select mode. */
    fun exitMultiSelect() {
        _selectCycleIndex = 0
        _uiState.update {
            it.copy(isMultiSelectMode = false, selectedIds = emptySet())
        }
    }

    // ─── Sorting ─────────────────────────────────────────────────────────────

    /** Toggle the unread-at-top sorting preference. */
    fun toggleUnreadAtTop() {
        _uiState.update { it.copy(unreadAtTop = !it.unreadAtTop) }
        recomputeState()
    }

    // ─── Pagination ──────────────────────────────────────────────────────────

    /** Load the next page of threads. */
    fun loadMore() {
        _uiState.update { it.copy(currentPage = it.currentPage + 1) }
        recomputeState()
    }

    // ─── Folder / Bundle / Account Filter ────────────────────────────────────

    /** Changes the current folder and re-filters the email list. */
    fun setFolder(folder: String) {
        _uiState.update { it.copy(currentFolder = folder, currentPage = 0) }
        recomputeState()
    }

    /** Changes the active bundle filter (null = show all inbox). */
    fun setBundle(bundle: String?) {
        _uiState.update { it.copy(activeBundle = bundle, currentPage = 0) }
        recomputeState()
    }

    /** Changes the account filter (empty = show all accounts). */
    fun setAccountFilter(accounts: List<String>) {
        _uiState.update { it.copy(accountFilter = accounts, currentPage = 0) }
        recomputeState()
    }

    /** Toggle a single account's active state in the filter. */
    fun toggleAccountFilter(accountId: String) {
        _uiState.update { state ->
            val currentAccounts = state.accounts
            val updatedAccounts = currentAccounts.map { account ->
                if (account.id == accountId) account.copy(isActive = !account.isActive)
                else account
            }
            val activeIds = updatedAccounts.filter { it.isActive }.map { it.id }
            state.copy(
                accounts = updatedAccounts,
                accountFilter = activeIds,
                currentPage = 0
            )
        }
        recomputeState()
    }

    // ─── Undo Actions ────────────────────────────────────────────────────────

    /** Archive an email with undo support. */
    fun archiveWithUndo(chitId: String, threadId: String, subject: String) {
        val undoAction = UndoAction(
            type = UndoType.ARCHIVE,
            chitId = chitId,
            threadId = threadId,
            subject = subject
        )
        _uiState.update { it.copy(
            undoAction = undoAction,
            pendingDismissThreadIds = it.pendingDismissThreadIds + threadId
        ) }
        startUndoCountdown(undoAction)
    }

    /** Delete an email with undo support. */
    fun deleteWithUndo(chitId: String, threadId: String, subject: String) {
        val undoAction = UndoAction(
            type = UndoType.DELETE,
            chitId = chitId,
            threadId = threadId,
            subject = subject
        )
        _uiState.update { it.copy(
            undoAction = undoAction,
            pendingDismissThreadIds = it.pendingDismissThreadIds + threadId
        ) }
        startUndoCountdown(undoAction)
    }

    /** Execute the pending undo action (called when countdown expires). */
    private fun executeUndoAction(action: UndoAction) {
        viewModelScope.launch {
            when (action.type) {
                UndoType.ARCHIVE -> archive(action.chitId)
                UndoType.DELETE -> moveToTrash(action.chitId)
            }
            _uiState.update { it.copy(
                undoAction = null,
                pendingDismissThreadIds = it.pendingDismissThreadIds - action.threadId
            ) }
        }
    }

    /** Cancel the pending undo action (user tapped Undo). */
    fun cancelUndo() {
        undoCountdownJob?.cancel()
        undoCountdownJob = null
        val action = _uiState.value.undoAction
        _uiState.update { it.copy(
            undoAction = null,
            pendingDismissThreadIds = if (action != null) it.pendingDismissThreadIds - action.threadId else it.pendingDismissThreadIds
        ) }
    }

    /** Start the undo countdown timer. */
    private fun startUndoCountdown(action: UndoAction) {
        undoCountdownJob?.cancel()
        undoCountdownJob = viewModelScope.launch {
            delay(action.durationMs)
            executeUndoAction(action)
        }
    }

    // ─── Sync / Check Mail ───────────────────────────────────────────────────

    /** Trigger email sync across all configured accounts. */
    fun triggerSync() {
        val accounts = _uiState.value.accounts
        if (accounts.isEmpty()) return

        // Mark all accounts as syncing
        val accountIds = accounts.map { it.id }.toSet()
        _uiState.update { state ->
            state.copy(
                syncingAccounts = accountIds,
                accounts = state.accounts.map { it.copy(syncState = SyncState.SYNCING) }
            )
        }

        viewModelScope.launch {
            val result = emailRepository.syncEmail()
            result.fold(
                onSuccess = { response ->
                    _uiState.update { state ->
                        state.copy(
                            syncingAccounts = emptySet(),
                            accountErrors = emptyMap(),
                            accounts = state.accounts.map {
                                it.copy(
                                    syncState = SyncState.SUCCESS,
                                    lastSyncTime = Instant.now().toString(),
                                    error = null
                                )
                            }
                        )
                    }
                },
                onFailure = { error ->
                    val errorMsg = error.message ?: "Unknown sync error"
                    _uiState.update { state ->
                        state.copy(
                            syncingAccounts = emptySet(),
                            accountErrors = accounts.associate { it.id to errorMsg },
                            accounts = state.accounts.map {
                                it.copy(
                                    syncState = SyncState.ERROR,
                                    error = errorMsg
                                )
                            }
                        )
                    }
                }
            )
        }
    }

    /** Set up the auto-check mail timer based on the check_interval setting. */
    private fun setupAutoCheckTimer(interval: String) {
        autoCheckJob?.cancel()
        autoCheckJob = null

        val intervalMs = when (interval) {
            "5" -> 5L * 60 * 1000
            "15" -> 15L * 60 * 1000
            "30" -> 30L * 60 * 1000
            "60" -> 60L * 60 * 1000
            else -> return  // "manual" or unknown — no auto-check
        }

        autoCheckJob = viewModelScope.launch {
            // Initial delay of 3 seconds before first auto-check
            delay(3000L)
            while (true) {
                triggerSync()
                delay(intervalMs)
            }
        }
    }

    // ─── Existing Actions ────────────────────────────────────────────────────

    /** Marks an email chit as read. */
    fun markAsRead(chitId: String) {
        viewModelScope.launch {
            val entity = chitDao.getById(chitId) ?: return@launch
            val now = Instant.now().toString()
            chitDao.upsert(entity.copy(emailRead = true, modifiedDatetime = now))
            dirtyTracker.markDirty(chitId, setOf("emailRead"))
            triggerPushIfOnline(chitId)
        }
    }

    /** Marks an email chit as unread. */
    fun markAsUnread(chitId: String) {
        viewModelScope.launch {
            val entity = chitDao.getById(chitId) ?: return@launch
            val now = Instant.now().toString()
            chitDao.upsert(entity.copy(emailRead = false, modifiedDatetime = now))
            dirtyTracker.markDirty(chitId, setOf("emailRead"))
            triggerPushIfOnline(chitId)
        }
    }

    /** Toggles the read state of an email. */
    fun toggleReadState(chitId: String) {
        viewModelScope.launch {
            val entity = chitDao.getById(chitId) ?: return@launch
            val newRead = !(entity.emailRead ?: false)
            val now = Instant.now().toString()
            chitDao.upsert(entity.copy(emailRead = newRead, modifiedDatetime = now))
            dirtyTracker.markDirty(chitId, setOf("emailRead"))
            triggerPushIfOnline(chitId)
        }
    }

    /** Archives an email chit. */
    fun archive(chitId: String) {
        viewModelScope.launch {
            chitRepository.archive(chitId)
        }
    }

    /** Moves an email chit to trash (sets email_folder to trash, removes inbox tag). */
    fun moveToTrash(chitId: String) {
        viewModelScope.launch {
            val entity = chitDao.getById(chitId) ?: return@launch
            val now = Instant.now().toString()
            val currentTags = entity.tags.orEmpty().toMutableList()
            // Add system trash tag if not present
            if (!currentTags.contains("CWOC_System/Email/Trash")) {
                currentTags.add("CWOC_System/Email/Trash")
            }
            // Remove inbox system tag
            currentTags.remove("CWOC_System/Email/Inbox")
            chitDao.upsert(
                entity.copy(
                    tags = currentTags,
                    emailFolder = "trash",
                    modifiedDatetime = now
                )
            )
            dirtyTracker.markDirty(chitId, setOf("tags", "email_folder"))
            triggerPushIfOnline(chitId)
        }
    }

    /** Toggles the pinned state of an email chit. */
    fun togglePin(chitId: String) {
        viewModelScope.launch {
            val entity = chitDao.getById(chitId) ?: return@launch
            val now = Instant.now().toString()
            chitDao.upsert(entity.copy(pinned = !entity.pinned, modifiedDatetime = now))
            dirtyTracker.markDirty(chitId, setOf("pinned"))
            triggerPushIfOnline(chitId)
            recomputeState()
        }
    }

    /**
     * Adds an email to a bundle by updating its tags to include the bundle's tag
     * and calling the add-rule API to create a matching rule for future emails.
     *
     * The bundle tag format is "CWOC_System/Bundle/{BundleName}".
     * Existing bundle tags are stripped first (single-placement mode).
     *
     * Validates: Requirements 15.3, 15.4
     */
    fun addEmailToBundle(chitId: String, bundleId: String, bundleName: String) {
        viewModelScope.launch {
            val entity = chitDao.getById(chitId) ?: return@launch
            val now = Instant.now().toString()

            // Strip existing bundle tags and add the new one (optimistic local update)
            val currentTags = entity.tags.orEmpty().toMutableList()
            currentTags.removeAll { it.startsWith("CWOC_System/Bundle/") || it.startsWith("CWOC_System/BundleID/") }
            currentTags.add("CWOC_System/BundleID/$bundleId")

            chitDao.upsert(entity.copy(tags = currentTags, modifiedDatetime = now))
            dirtyTracker.markDirty(chitId, setOf("tags"))
            triggerPushIfOnline(chitId)

            recomputeState()
        }
    }

    /**
     * Unified drop-email: move an email to a bundle with optional rule creation.
     * Uses the /api/bundles/{bundleId}/drop-email endpoint.
     */
    fun dropEmailToBundle(
        chitId: String,
        bundleId: String,
        mode: String,
        matchValue: String,
        applyRetroactively: Boolean
    ) {
        viewModelScope.launch {
            // Optimistic local update: move the email tag immediately
            val entity = chitDao.getById(chitId) ?: return@launch
            val now = Instant.now().toString()
            val currentTags = entity.tags.orEmpty().toMutableList()
            currentTags.removeAll { it.startsWith("CWOC_System/Bundle/") || it.startsWith("CWOC_System/BundleID/") }
            currentTags.add("CWOC_System/BundleID/$bundleId")
            chitDao.upsert(entity.copy(tags = currentTags, modifiedDatetime = now))

            // Call the server endpoint
            emailRepository.dropEmailToBundle(
                bundleId = bundleId,
                chitId = chitId,
                mode = mode,
                matchValue = matchValue,
                applyRetroactively = applyRetroactively
            )

            recomputeState()
        }
    }

    /**
     * Create a new bundle, then drop the email into it.
     */
    fun createBundleAndDropEmail(
        bundleName: String,
        chitId: String,
        mode: String,
        matchValue: String,
        applyRetroactively: Boolean
    ) {
        viewModelScope.launch {
            val result = bundleRepository.createBundle(
                name = bundleName,
                description = null,
                color = null,
                showInOmni = false
            )
            result.onSuccess { newBundle ->
                dropEmailToBundle(chitId, newBundle.id, mode, matchValue, applyRetroactively)
            }
        }
    }

    /**
     * Returns the current bundle ID for an email, if any.
     * Looks at the email's tags for a "CWOC_System/Bundle/{name}" tag and matches
     * it against the known bundles list.
     */
    fun getCurrentBundleId(chitId: String, bundles: List<com.cwoc.app.data.remote.BundleDto>): String? {
        val entity = allEmailChits.find { it.id == chitId } ?: return null
        val bundleTags = entity.tags.orEmpty().filter { it.startsWith("CWOC_System/Bundle/") }
        if (bundleTags.isEmpty()) return null

        val bundleName = bundleTags.first().removePrefix("CWOC_System/Bundle/")
        return bundles.find { it.name == bundleName }?.id
    }

    /**
     * Get email metadata for the Add to Bundle sheet.
     * Returns (senderEmail, subject, recipientEmail) or null if chit not found.
     */
    fun getEmailMetadataForBundle(chitId: String): Triple<String, String, String>? {
        val entity = allEmailChits.find { it.id == chitId } ?: return null
        val senderEmail = entity.emailFrom?.let { extractSenderEmail(it) } ?: ""
        val subject = entity.emailSubject ?: entity.title ?: ""
        val recipientEmail = entity.emailTo?.let { extractSenderEmail(it) } ?: ""
        return Triple(senderEmail, subject, recipientEmail)
    }

    // ─── Bulk Actions ────────────────────────────────────────────────────────

    /** Bulk archive all selected emails. */
    fun bulkArchive(onResult: (Int, Int) -> Unit = { _, _ -> }) {
        viewModelScope.launch {
            val ids = _uiState.value.selectedIds.toList()
            var success = 0
            var failed = 0
            for (id in ids) {
                try {
                    chitRepository.archive(id)
                    success++
                } catch (_: Exception) {
                    failed++
                }
            }
            exitMultiSelect()
            onResult(success, failed)
        }
    }

    /** Bulk toggle read state for all selected emails. */
    fun bulkToggleRead() {
        viewModelScope.launch {
            val ids = _uiState.value.selectedIds.toList()
            for (id in ids) {
                toggleReadState(id)
            }
            exitMultiSelect()
        }
    }

    /** Bulk delete all selected emails. */
    fun bulkDelete(onResult: (Int, Int) -> Unit = { _, _ -> }) {
        viewModelScope.launch {
            val ids = _uiState.value.selectedIds.toList()
            var success = 0
            var failed = 0
            for (id in ids) {
                try {
                    moveToTrash(id)
                    success++
                } catch (_: Exception) {
                    failed++
                }
            }
            exitMultiSelect()
            onResult(success, failed)
        }
    }

    /** Bulk apply tags to all selected emails. */
    fun bulkApplyTags(tags: List<String>) {
        viewModelScope.launch {
            val ids = _uiState.value.selectedIds.toList()
            for (id in ids) {
                try {
                    val chit = chitDao.getById(id) ?: continue
                    val existingTags = chit.tags ?: emptyList()
                    val mergedTags = (existingTags + tags).distinct()
                    val now = java.time.Instant.now().toString()
                    chitDao.upsert(chit.copy(tags = mergedTags, modifiedDatetime = now, isDirty = true))
                    chitRepository.markDirty(id, "tags")
                } catch (_: Exception) {}
            }
            exitMultiSelect()
        }
    }

    // ─── Reply / Forward ─────────────────────────────────────────────────────

    /**
     * Creates a reply draft chit from an original email message.
     * Checks for existing drafts first via DraftDetector.
     */
    fun createReply(originalChitId: String, onCreated: (String) -> Unit) {
        viewModelScope.launch {
            val original = chitDao.getById(originalChitId) ?: return@launch

            // Check for existing reply draft
            val drafts = allEmailChits.filter { it.emailStatus == "draft" }
            val existingDraft = DraftDetector.findExistingReply(drafts, original.emailMessageId)
            if (existingDraft != null) {
                onCreated(existingDraft.id)
                return@launch
            }

            val now = Instant.now().toString()
            val newId = java.util.UUID.randomUUID().toString()

            val originalBody = original.emailBodyText ?: original.note ?: ""
            val quotedBody = "\n\n--- Original Message ---\nFrom: ${original.emailFrom ?: "Unknown"}\nDate: ${original.emailDate ?: ""}\n\n$originalBody"

            val originalSubject = original.emailSubject ?: original.title ?: ""
            val replySubject = if (originalSubject.startsWith("Re:", ignoreCase = true)) {
                originalSubject
            } else {
                "Re: $originalSubject"
            }

            val replyEntity = ChitEntity(
                id = newId,
                title = replySubject,
                note = quotedBody,
                tags = listOf("Drafts"),
                startDatetime = null,
                endDatetime = null,
                dueDatetime = null,
                pointInTime = null,
                completedDatetime = null,
                status = null,
                priority = null,
                severity = null,
                checklist = null,
                alarm = null,
                notification = null,
                recurrence = null,
                recurrenceId = null,
                recurrenceRule = null,
                recurrenceExceptions = null,
                location = null,
                color = null,
                people = null,
                pinned = false,
                archived = false,
                deleted = false,
                createdDatetime = now,
                modifiedDatetime = now,
                isProjectMaster = false,
                childChits = null,
                allDay = false,
                timezone = null,
                alerts = null,
                progressPercent = null,
                timeEstimate = null,
                weatherData = null,
                healthData = null,
                habit = false,
                habitGoal = null,
                habitSuccess = null,
                showOnCalendar = null,
                habitResetPeriod = null,
                habitLastActionDate = null,
                habitHideOverall = null,
                perpetual = false,
                shares = null,
                stealth = null,
                assignedTo = null,
                ownerId = null,
                hasUnviewedConflict = false,
                availability = null,
                snoozedUntil = null,
                prerequisites = null,
                syncVersion = 0,
                lastSyncedAt = null,
                emailStatus = "draft",
                emailSubject = replySubject,
                emailBodyText = quotedBody,
                emailTo = original.emailFrom,
                emailInReplyTo = original.emailMessageId,
                emailReferences = buildString {
                    if (original.emailReferences != null) {
                        append(original.emailReferences)
                        append(" ")
                    }
                    if (original.emailMessageId != null) {
                        append(original.emailMessageId)
                    }
                }.ifBlank { null },
                emailAccountId = original.emailAccountId,
                // Inherit thread_id so the reply stays in the same thread
                threadId = original.threadId ?: original.emailMessageId,
                locations = null,
                isDirty = true,
                dirtyFields = "[]"
            )

            chitDao.upsert(replyEntity)
            dirtyTracker.markDirty(newId, setOf(
                "title", "note", "email_status", "email_subject", "email_body_text",
                "email_to", "email_in_reply_to", "email_references", "email_account_id", "tags"
            ))
            triggerPushIfOnline(newId)
            onCreated(newId)
        }
    }

    /**
     * Creates a forward draft chit from an original email message.
     * Checks for existing drafts first via DraftDetector.
     */
    fun createForward(originalChitId: String, onCreated: (String) -> Unit) {
        viewModelScope.launch {
            val original = chitDao.getById(originalChitId) ?: return@launch

            // Check for existing forward draft
            val drafts = allEmailChits.filter { it.emailStatus == "draft" }
            val existingDraft = DraftDetector.findExistingForward(drafts, original.emailSubject)
            if (existingDraft != null) {
                onCreated(existingDraft.id)
                return@launch
            }

            val now = Instant.now().toString()
            val newId = java.util.UUID.randomUUID().toString()

            val originalBody = original.emailBodyText ?: original.note ?: ""
            val forwardedBody = "\n\n--- Forwarded Message ---\nFrom: ${original.emailFrom ?: "Unknown"}\nTo: ${original.emailTo ?: ""}\nDate: ${original.emailDate ?: ""}\nSubject: ${original.emailSubject ?: ""}\n\n$originalBody"

            val originalSubject = original.emailSubject ?: original.title ?: ""
            val fwdSubject = if (originalSubject.startsWith("Fwd:", ignoreCase = true) ||
                originalSubject.startsWith("FW:", ignoreCase = true)) {
                originalSubject
            } else {
                "Fwd: $originalSubject"
            }

            val forwardEntity = ChitEntity(
                id = newId,
                title = fwdSubject,
                note = forwardedBody,
                tags = listOf("Drafts"),
                startDatetime = null,
                endDatetime = null,
                dueDatetime = null,
                pointInTime = null,
                completedDatetime = null,
                status = null,
                priority = null,
                severity = null,
                checklist = null,
                alarm = null,
                notification = null,
                recurrence = null,
                recurrenceId = null,
                recurrenceRule = null,
                recurrenceExceptions = null,
                location = null,
                color = null,
                people = null,
                pinned = false,
                archived = false,
                deleted = false,
                createdDatetime = now,
                modifiedDatetime = now,
                isProjectMaster = false,
                childChits = null,
                allDay = false,
                timezone = null,
                alerts = null,
                progressPercent = null,
                timeEstimate = null,
                weatherData = null,
                healthData = null,
                habit = false,
                habitGoal = null,
                habitSuccess = null,
                showOnCalendar = null,
                habitResetPeriod = null,
                habitLastActionDate = null,
                habitHideOverall = null,
                perpetual = false,
                shares = null,
                stealth = null,
                assignedTo = null,
                ownerId = null,
                hasUnviewedConflict = false,
                availability = null,
                snoozedUntil = null,
                prerequisites = null,
                syncVersion = 0,
                lastSyncedAt = null,
                emailStatus = "draft",
                emailSubject = fwdSubject,
                emailBodyText = forwardedBody,
                emailInReplyTo = original.emailMessageId,
                emailAccountId = original.emailAccountId,
                // Forwards start a new thread (different from replies)
                threadId = null,
                locations = null,
                isDirty = true,
                dirtyFields = "[]"
            )

            chitDao.upsert(forwardEntity)
            dirtyTracker.markDirty(newId, setOf(
                "title", "note", "email_status", "email_subject", "email_body_text",
                "email_in_reply_to", "email_account_id", "tags"
            ))
            triggerPushIfOnline(newId)
            onCreated(newId)
        }
    }

    // ─── Private Helpers ─────────────────────────────────────────────────────

    /**
     * Recomputes the filtered, sorted, and paginated email list based on
     * current folder, bundle, account filter, sorting, and pagination settings.
     * Runs heavy computation on Dispatchers.Default to avoid blocking the UI thread.
     */
    private fun recomputeState() {
        recomputeJob?.cancel()
        recomputeJob = viewModelScope.launch(kotlinx.coroutines.Dispatchers.Default) {
            val state = _uiState.value
            val folder = state.currentFolder
            val bundle = state.activeBundle
            val accountFilter = state.accountFilter
            val use24Hour = state.use24Hour

            // Capture references to avoid race conditions
            val emailChits = allEmailChits
            val allChitsSnapshot = allChits

            // Step 1: Filter by folder
            val folderFiltered = filterByFolder(emailChits, folder)

            // Step 2: Apply account filter (if any accounts are deselected)
            val accountFiltered = if (accountFilter.isEmpty() ||
                accountFilter.size == state.accounts.size) {
                folderFiltered
            } else {
                folderFiltered.filter { chit ->
                    chit.emailAccountId != null && accountFilter.contains(chit.emailAccountId)
                }
            }

            // Step 3: Apply bundle filter (only for inbox)
            val bundleFiltered = if (folder == "inbox" && bundle != null) {
                accountFiltered.filter { chit ->
                    chit.tags.orEmpty().contains(bundle)
                }
            } else {
                accountFiltered
            }

            // Step 4: Group into threads
            val threads = groupIntoThreads(bundleFiltered)

            // Step 5: Pre-build indexes for O(1) lookups during enrichment
            // Reply indicator index: set of messageIds that have replies
            val repliedToMessageIds = buildRepliedToIndex(emailChits)
            // Nested chits index: map of threadId -> list of nested chits
            val nestedChitsIndex = buildNestedChitsIndex(allChitsSnapshot)

            // Step 6: Enrich threads with domain layer data (using pre-built indexes)
            val enrichedThreads = threads.map { thread ->
                enrichThread(thread, use24Hour, repliedToMessageIds, nestedChitsIndex)
            }

            // Step 7: Sort threads (pinned first, then unread-at-top if enabled)
            val sortedThreads = sortThreads(enrichedThreads, state.unreadAtTop)

            // Step 8: Compute total count and apply pagination
            val totalCount = sortedThreads.size
            val displayedThreads = if (state.paginateEnabled) {
                val limit = (state.currentPage + 1) * state.pageSize
                sortedThreads.take(limit)
            } else {
                sortedThreads
            }

            // Step 9: Compute unread count (always based on inbox, ignoring filters)
            val inboxChits = filterByFolder(emailChits, "inbox")
            val unreadCount = inboxChits.count { it.emailRead != true }

            // Switch back to Main to update state
            _uiState.update {
                it.copy(
                    threads = displayedThreads,
                    totalThreadCount = totalCount,
                    unreadCount = unreadCount,
                    isLoading = false
                )
            }

            // Resolve sender image URLs for visible threads (already launches its own coroutine)
            resolveSenderImages(displayedThreads)
        }
    }

    /** Job for the current recomputeState coroutine — cancelled on re-entry to avoid stacking. */
    private var recomputeJob: Job? = null

    /**
     * Resolves sender email addresses to contact image URLs for the visible threads.
     * Uses ContactRepository's cached lookup to avoid repeated DB queries.
     */
    private fun resolveSenderImages(threads: List<EmailThread>) {
        viewModelScope.launch {
            val newMappings = mutableMapOf<String, String?>()
            for (thread in threads) {
                val emailFrom = thread.latestMessage.emailFrom ?: continue
                val senderEmail = extractSenderEmail(emailFrom)
                if (senderEmail.isNotBlank() && senderEmail !in _senderImageUrls.value) {
                    val imageUrl = contactRepository.getImageUrlForEmail(senderEmail)
                    newMappings[senderEmail] = imageUrl
                }
            }
            if (newMappings.isNotEmpty()) {
                _senderImageUrls.update { it + newMappings }
            }
        }
    }

    /**
     * Enriches a thread with domain-layer computed data:
     * body preview, smart links, date formatting, date group, nested chits, reply indicator.
     * Uses pre-built indexes for O(1) lookups instead of scanning all chits per thread.
     */
    private fun enrichThread(
        thread: EmailThread,
        use24Hour: Boolean,
        repliedToMessageIds: Set<String>,
        nestedChitsIndex: Map<String, List<ChitEntity>>
    ): EmailThread {
        val latest = thread.latestMessage

        // Body preview via BodyPreviewStripper
        val bodyPreview = BodyPreviewStripper.strip(
            latest.emailBodyText ?: latest.note
        )

        // Smart links via SmartLinkDetector
        val smartLinks = SmartLinkDetector.detect(
            latest.emailBodyText ?: latest.note ?: ""
        )

        // Date formatting via EmailDateFormatter
        val formattedDate = EmailDateFormatter.format(thread.latestDate, use24Hour)

        // Date group via DateGrouper
        val dateGroup = DateGrouper.assign(thread.latestDate)

        // Pinned state (thread is pinned if latest message is pinned)
        val isPinned = latest.pinned

        // Reply indicator: O(1) lookup using pre-built index
        val hasReply = thread.messages.any { msg ->
            msg.emailMessageId != null && msg.emailMessageId in repliedToMessageIds
        }

        // Nested chits: O(1) lookup using pre-built index
        val nestedChits = thread.messages.flatMap { msg ->
            msg.emailMessageId?.let { nestedChitsIndex[it] } ?: emptyList()
        }.sortedWith(
            compareBy<ChitEntity> { it.dueDatetime ?: "\uFFFF" }
                .thenBy { it.startDatetime ?: "\uFFFF" }
        )

        return thread.copy(
            bodyPreview = bodyPreview,
            smartLinks = smartLinks,
            formattedDate = formattedDate,
            dateGroup = dateGroup,
            isPinned = isPinned,
            hasReplyIndicator = hasReply,
            nestedChits = nestedChits
        )
    }

    /**
     * Builds a set of message IDs that have been replied to (sent or draft replies exist).
     * Used for O(1) reply indicator lookups during thread enrichment.
     */
    private fun buildRepliedToIndex(emailChits: List<ChitEntity>): Set<String> {
        val repliedTo = mutableSetOf<String>()
        for (chit in emailChits) {
            if (chit.emailInReplyTo != null &&
                (chit.emailStatus == "sent" || chit.emailStatus == "draft")) {
                repliedTo.add(chit.emailInReplyTo)
            }
        }
        return repliedTo
    }

    /**
     * Builds an index of nestThreadId -> list of non-email chits.
     * Used for O(1) nested chit lookups during thread enrichment.
     */
    private fun buildNestedChitsIndex(allChits: List<ChitEntity>): Map<String, List<ChitEntity>> {
        return allChits.filter { chit ->
            chit.nestThreadId != null &&
                chit.emailMessageId == null &&
                chit.emailStatus == null
        }.groupBy { it.nestThreadId!! }
    }

    /**
     * Sorts threads: pinned first (Property 7), then optionally unread-at-top
     * within each date group (Property 8), then by newest date.
     */
    private fun sortThreads(threads: List<EmailThread>, unreadAtTop: Boolean): List<EmailThread> {
        return threads.sortedWith(
            compareByDescending<EmailThread> { it.isPinned }
                .then(
                    if (unreadAtTop) {
                        compareByDescending<EmailThread> { it.unreadCount > 0 }
                    } else {
                        compareBy { 0 } // no-op comparator
                    }
                )
                .thenByDescending { it.latestDate ?: "" }
        )
    }

    /**
     * Filters email chits by folder logic, matching the web frontend's approach:
     * - Primary check: look for "CWOC_System/Email/{Folder}" tag
     * - Fallback: check emailFolder field directly
     * - Inbox: has system tag OR emailFolder == "inbox", AND not archived AND not deleted
     * - Sent: has system tag OR emailFolder == "sent", AND not archived
     * - Drafts: emailStatus = "draft" AND not archived AND emailSendAt is null
     * - Scheduled: emailStatus = "draft" AND emailSendAt is not null AND not archived
     * - Trash: has system tag OR emailFolder == "trash"
     * - Archived: archived = true
     */
    private fun filterByFolder(chits: List<ChitEntity>, folder: String): List<ChitEntity> {
        return when (folder) {
            "inbox" -> chits.filter { chit ->
                (chitHasEmailTag(chit, "Inbox") || chit.emailFolder == "inbox") &&
                    !chit.archived &&
                    !chit.deleted
            }
            "sent" -> chits.filter { chit ->
                (chitHasEmailTag(chit, "Sent") || chit.emailFolder == "sent") &&
                    !chit.archived
            }
            "drafts" -> chits.filter { chit ->
                (chitHasEmailTag(chit, "Drafts") || chit.emailStatus == "draft") &&
                    !chit.archived &&
                    chit.emailSendAt == null
            }
            "scheduled" -> chits.filter { chit ->
                chit.emailStatus == "draft" &&
                    chit.emailSendAt != null &&
                    !chit.archived
            }
            "trash" -> chits.filter { chit ->
                chitHasEmailTag(chit, "Trash") || chit.emailFolder == "trash"
            }
            "archived" -> chits.filter { chit ->
                chit.archived
            }
            else -> emptyList()
        }
    }

    /**
     * Checks if a chit has the system email folder tag "CWOC_System/Email/{suffix}".
     * Matches the web frontend's _chitHasTag() logic.
     */
    private fun chitHasEmailTag(chit: ChitEntity, tagSuffix: String): Boolean {
        val target = "CWOC_System/Email/$tagSuffix"
        return chit.tags.orEmpty().contains(target)
    }

    /**
     * Groups email chits into threads using the server-computed threadId field.
     * Falls back to client-side subject matching only for chits without a threadId
     * (e.g., locally-created drafts before sync).
     *
     * This is O(n) — a simple groupBy on the threadId field.
     */
    private fun groupIntoThreads(chits: List<ChitEntity>): List<EmailThread> {
        if (chits.isEmpty()) return emptyList()

        // Group by server-provided threadId (fast path — O(n))
        val threadGroups = mutableMapOf<String, MutableList<ChitEntity>>()

        for (chit in chits) {
            // Use server-computed threadId if available
            val threadKey = chit.threadId
                // Fallback for chits without threadId (local drafts, pre-migration emails)
                ?: chit.emailInReplyTo
                ?: chit.emailMessageId
                ?: chit.id

            threadGroups.getOrPut(threadKey) { mutableListOf() }.add(chit)
        }

        // Convert groups to EmailThread objects
        return threadGroups.map { (threadId, messages) ->
            val sorted = messages.sortedBy { it.emailDate ?: it.createdDatetime ?: "" }
            val latest = sorted.last()
            val unread = messages.count { it.emailRead != true }

            EmailThread(
                id = threadId,
                subject = latest.emailSubject ?: "(No Subject)",
                latestMessage = latest,
                messages = sorted,
                unreadCount = unread,
                latestDate = latest.emailDate ?: latest.createdDatetime
            )
        }.sortedByDescending { it.latestDate ?: "" }
    }

    companion object {
        /** Pre-compiled regex for stripping Re:/Fwd:/FW: prefixes from subjects. */
        private val SUBJECT_PREFIX_REGEX = Regex("^(\\s*(Re|RE|Fwd|FW|Fw):\\s*)+", RegexOption.IGNORE_CASE)
    }

    /** Triggers an immediate push if the device is currently online. */
    private fun triggerPushIfOnline(chitId: String) {
        if (connectivityMonitor.isOnline.value) {
            viewModelScope.launch {
                syncPushEngine.pushSingle(chitId)
            }
        }
    }

    /**
     * Extracts the email address from a "From" field.
     * Handles formats like "John Doe <john@example.com>" → "john@example.com"
     * or plain "john@example.com" → "john@example.com"
     */
    private fun extractSenderEmail(emailFrom: String): String {
        val angleBracketStart = emailFrom.indexOf('<')
        val angleBracketEnd = emailFrom.indexOf('>')
        return if (angleBracketStart >= 0 && angleBracketEnd > angleBracketStart) {
            emailFrom.substring(angleBracketStart + 1, angleBracketEnd).trim()
        } else {
            emailFrom.trim()
        }
    }

    /**
     * Parses account info from the settings JSON string.
     * The emailAccounts field is a JSON array of account objects.
     */
    private fun parseAccountsFromSettings(accountsJson: String?): List<EmailAccountInfo> {
        if (accountsJson.isNullOrBlank()) return emptyList()
        return try {
            // Parse JSON array of accounts
            val accounts = mutableListOf<EmailAccountInfo>()
            // Simple JSON parsing — accounts are stored as JSON array
            val trimmed = accountsJson.trim()
            if (!trimmed.startsWith("[")) return emptyList()

            // Use a basic approach: split by account objects
            val gson = com.google.gson.Gson()
            val type = object : com.google.gson.reflect.TypeToken<List<Map<String, Any?>>>() {}.type
            val parsed: List<Map<String, Any?>> = gson.fromJson(trimmed, type)

            for (accountMap in parsed) {
                val id = (accountMap["id"] as? String)
                    ?: (accountMap["email"] as? String)
                    ?: continue
                val nickname = (accountMap["nickname"] as? String)
                    ?: (accountMap["display_name"] as? String)
                    ?: id
                val email = (accountMap["email"] as? String) ?: id

                accounts.add(
                    EmailAccountInfo(
                        id = id,
                        nickname = nickname,
                        email = email,
                        isActive = true
                    )
                )
            }
            accounts
        } catch (_: Exception) {
            emptyList()
        }
    }

    override fun onCleared() {
        super.onCleared()
        autoCheckJob?.cancel()
        undoCountdownJob?.cancel()
    }
}
