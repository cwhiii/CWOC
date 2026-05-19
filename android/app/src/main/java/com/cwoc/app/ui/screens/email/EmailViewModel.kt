package com.cwoc.app.ui.screens.email

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cwoc.app.data.local.dao.ChitDao
import com.cwoc.app.data.local.entity.ChitEntity
import com.cwoc.app.data.repository.ChitRepository
import com.cwoc.app.data.repository.EmailRepository
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
    private val settingsRepository: SettingsRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(EmailUiState())
    val uiState: StateFlow<EmailUiState> = _uiState.asStateFlow()

    /** All email chits from the database (unfiltered). */
    private var allEmailChits: List<ChitEntity> = emptyList()

    /** All chits (for nested chit lookup). */
    private var allChits: List<ChitEntity> = emptyList()

    /** Auto-check mail timer job. */
    private var autoCheckJob: Job? = null

    /** Undo countdown job. */
    private var undoCountdownJob: Job? = null

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
                val use24Hour = settings.timeFormat == "24"
                val checkInterval = settings.emailCheckInterval ?: "manual"
                val paginateEnabled = settings.paginateEmail == "true"
                val groupByDate = settings.emailGroupBy != "none"
                val accounts = parseAccountsFromSettings(settings.emailAccounts)

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

    /** Select all visible threads. */
    fun selectAll() {
        _uiState.update { state ->
            val allIds = state.threads.map { it.id }.toSet()
            state.copy(
                isMultiSelectMode = true,
                selectedIds = allIds
            )
        }
    }

    /** Deselect all and exit multi-select mode. */
    fun exitMultiSelect() {
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
    fun archiveWithUndo(chitId: String, subject: String) {
        val undoAction = UndoAction(
            type = UndoType.ARCHIVE,
            chitId = chitId,
            subject = subject
        )
        _uiState.update { it.copy(undoAction = undoAction) }
        startUndoCountdown(undoAction)
    }

    /** Delete an email with undo support. */
    fun deleteWithUndo(chitId: String, subject: String) {
        val undoAction = UndoAction(
            type = UndoType.DELETE,
            chitId = chitId,
            subject = subject
        )
        _uiState.update { it.copy(undoAction = undoAction) }
        startUndoCountdown(undoAction)
    }

    /** Execute the pending undo action (called when countdown expires). */
    private fun executeUndoAction(action: UndoAction) {
        viewModelScope.launch {
            when (action.type) {
                UndoType.ARCHIVE -> archive(action.chitId)
                UndoType.DELETE -> moveToTrash(action.chitId)
            }
            _uiState.update { it.copy(undoAction = null) }
        }
    }

    /** Cancel the pending undo action (user tapped Undo). */
    fun cancelUndo() {
        undoCountdownJob?.cancel()
        undoCountdownJob = null
        _uiState.update { it.copy(undoAction = null) }
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

    /** Moves an email chit to trash (adds "Trash" tag, removes from inbox). */
    fun moveToTrash(chitId: String) {
        viewModelScope.launch {
            val entity = chitDao.getById(chitId) ?: return@launch
            val now = Instant.now().toString()
            val currentTags = entity.tags.orEmpty().toMutableList()
            if (!currentTags.contains("Trash")) {
                currentTags.add("Trash")
            }
            currentTags.remove("Inbox")
            chitDao.upsert(
                entity.copy(
                    tags = currentTags,
                    modifiedDatetime = now
                )
            )
            dirtyTracker.markDirty(chitId, setOf("tags"))
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
     */
    private fun recomputeState() {
        val state = _uiState.value
        val folder = state.currentFolder
        val bundle = state.activeBundle
        val accountFilter = state.accountFilter
        val use24Hour = state.use24Hour

        // Step 1: Filter by folder
        val folderFiltered = filterByFolder(allEmailChits, folder)

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

        // Step 5: Enrich threads with domain layer data
        val enrichedThreads = threads.map { thread ->
            enrichThread(thread, use24Hour)
        }

        // Step 6: Sort threads (pinned first, then unread-at-top if enabled)
        val sortedThreads = sortThreads(enrichedThreads, state.unreadAtTop)

        // Step 7: Compute total count and apply pagination
        val totalCount = sortedThreads.size
        val displayedThreads = if (state.paginateEnabled) {
            val limit = (state.currentPage + 1) * state.pageSize
            sortedThreads.take(limit)
        } else {
            sortedThreads
        }

        // Step 8: Compute unread count (always based on inbox, ignoring filters)
        val inboxChits = filterByFolder(allEmailChits, "inbox")
        val unreadCount = inboxChits.count { it.emailRead != true }

        _uiState.update {
            it.copy(
                threads = displayedThreads,
                totalThreadCount = totalCount,
                unreadCount = unreadCount,
                isLoading = false
            )
        }
    }

    /**
     * Enriches a thread with domain-layer computed data:
     * body preview, smart links, date formatting, date group, nested chits, reply indicator.
     */
    private fun enrichThread(thread: EmailThread, use24Hour: Boolean): EmailThread {
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

        // Reply indicator: check if any message in the thread has a reply
        val hasReply = hasReplyIndicator(thread)

        // Nested chits: non-email chits with nestThreadId matching this thread
        val nestedChits = findNestedChits(thread)

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
     * Checks if a thread has a reply indicator.
     * A reply exists if any chit in allEmailChits has emailInReplyTo matching
     * a message in this thread, with status "sent" or "draft".
     */
    private fun hasReplyIndicator(thread: EmailThread): Boolean {
        val messageIds = thread.messages.mapNotNull { it.emailMessageId }.toSet()
        if (messageIds.isEmpty()) return false
        return allEmailChits.any { chit ->
            chit.emailInReplyTo != null &&
                chit.emailInReplyTo in messageIds &&
                (chit.emailStatus == "sent" || chit.emailStatus == "draft")
        }
    }

    /**
     * Finds nested chits (non-email chits) that belong to this thread.
     * Sorted by due_date ascending, then start_datetime ascending.
     */
    private fun findNestedChits(thread: EmailThread): List<ChitEntity> {
        val threadMessageIds = thread.messages.mapNotNull { it.emailMessageId }.toSet()
        if (threadMessageIds.isEmpty()) return emptyList()

        return allChits.filter { chit ->
            chit.nestThreadId != null &&
                chit.nestThreadId in threadMessageIds &&
                chit.emailMessageId == null &&
                chit.emailStatus == null
        }.sortedWith(
            compareBy<ChitEntity> { it.dueDatetime ?: "\uFFFF" }
                .thenBy { it.startDatetime ?: "\uFFFF" }
        )
    }

    /**
     * Filters email chits by folder logic:
     * - Inbox: has tag "Inbox" AND not archived AND not deleted
     * - Sent: has tag "Sent" AND not archived
     * - Drafts: emailStatus = "draft" AND not archived AND emailSendAt is null
     * - Scheduled: emailStatus = "draft" AND emailSendAt is not null AND not archived
     * - Trash: has tag "Trash"
     * - Archived: archived = true
     */
    private fun filterByFolder(chits: List<ChitEntity>, folder: String): List<ChitEntity> {
        return when (folder) {
            "inbox" -> chits.filter { chit ->
                chit.tags.orEmpty().contains("Inbox") &&
                    !chit.archived &&
                    !chit.deleted
            }
            "sent" -> chits.filter { chit ->
                chit.tags.orEmpty().contains("Sent") &&
                    !chit.archived
            }
            "drafts" -> chits.filter { chit ->
                chit.emailStatus == "draft" &&
                    !chit.archived &&
                    chit.emailSendAt == null
            }
            "scheduled" -> chits.filter { chit ->
                chit.emailStatus == "draft" &&
                    chit.emailSendAt != null &&
                    !chit.archived
            }
            "trash" -> chits.filter { chit ->
                chit.tags.orEmpty().contains("Trash")
            }
            "archived" -> chits.filter { chit ->
                chit.archived
            }
            else -> emptyList()
        }
    }

    /**
     * Groups email chits into threads using two strategies:
     * 1. Explicit threading via emailInReplyTo / emailReferences chain
     * 2. Fallback: normalized subject matching (strip Re:/Fwd:/FW:/RE: prefixes)
     *
     * Each thread is sorted chronologically, with the latest message surfaced.
     */
    private fun groupIntoThreads(chits: List<ChitEntity>): List<EmailThread> {
        if (chits.isEmpty()) return emptyList()

        // Build a map of messageId -> chit for reference lookups
        val messageIdMap = mutableMapOf<String, ChitEntity>()
        for (chit in chits) {
            chit.emailMessageId?.let { messageIdMap[it] = chit }
        }

        // Union-Find approach: group chits that share references or normalized subjects
        val threadGroups = mutableMapOf<String, MutableList<ChitEntity>>()
        val chitToThreadId = mutableMapOf<String, String>()

        for (chit in chits) {
            var threadId: String? = null

            // Strategy 1: Check if this chit replies to something in our set
            val inReplyTo = chit.emailInReplyTo
            if (inReplyTo != null && messageIdMap.containsKey(inReplyTo)) {
                threadId = chitToThreadId[messageIdMap[inReplyTo]!!.id]
            }

            // Strategy 2: Check references chain
            if (threadId == null && chit.emailReferences != null) {
                val refs = chit.emailReferences.split("\\s+".toRegex())
                for (ref in refs) {
                    val refChit = messageIdMap[ref.trim()]
                    if (refChit != null) {
                        threadId = chitToThreadId[refChit.id]
                        if (threadId != null) break
                    }
                }
            }

            // Strategy 3: Fallback to normalized subject matching
            if (threadId == null) {
                val normalizedSubject = normalizeSubject(chit.emailSubject)
                threadId = threadGroups.entries.firstOrNull { (_, members) ->
                    normalizeSubject(members.first().emailSubject) == normalizedSubject
                }?.key
            }

            // If no existing thread found, create a new one
            if (threadId == null) {
                threadId = chit.emailMessageId ?: chit.id
            }

            // Add chit to thread group
            threadGroups.getOrPut(threadId) { mutableListOf() }.add(chit)
            chitToThreadId[chit.id] = threadId
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

    /**
     * Normalizes an email subject by stripping common reply/forward prefixes.
     */
    private fun normalizeSubject(subject: String?): String {
        if (subject == null) return ""
        return subject
            .replace(Regex("^(\\s*(Re|RE|Fwd|FW|Fw):\\s*)+", RegexOption.IGNORE_CASE), "")
            .trim()
            .lowercase()
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
