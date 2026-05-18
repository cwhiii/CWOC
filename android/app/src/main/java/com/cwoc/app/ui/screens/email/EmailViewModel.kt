package com.cwoc.app.ui.screens.email

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cwoc.app.data.local.dao.ChitDao
import com.cwoc.app.data.local.entity.ChitEntity
import com.cwoc.app.data.repository.ChitRepository
import com.cwoc.app.data.sync.ConnectivityMonitor
import com.cwoc.app.data.sync.DirtyTracker
import com.cwoc.app.data.sync.SyncPushEngine
import dagger.hilt.android.lifecycle.HiltViewModel
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
    val latestDate: String?
)

data class EmailUiState(
    val currentFolder: String = "inbox",
    val activeBundle: String? = null,
    val accountFilter: List<String> = emptyList(),
    val threads: List<EmailThread> = emptyList(),
    val unreadCount: Int = 0,
    val isLoading: Boolean = true
)

@HiltViewModel
class EmailViewModel @Inject constructor(
    private val chitRepository: ChitRepository,
    private val chitDao: ChitDao,
    private val dirtyTracker: DirtyTracker,
    private val syncPushEngine: SyncPushEngine,
    private val connectivityMonitor: ConnectivityMonitor
) : ViewModel() {

    private val _uiState = MutableStateFlow(EmailUiState())
    val uiState: StateFlow<EmailUiState> = _uiState.asStateFlow()

    /** All email chits from the database (unfiltered). */
    private var allEmailChits: List<ChitEntity> = emptyList()

    init {
        viewModelScope.launch {
            chitRepository.getAllNonDeleted().collect { allChits ->
                // Filter to only email chits
                allEmailChits = allChits.filter { chit ->
                    chit.emailMessageId != null || chit.emailStatus != null
                }
                recomputeState()
            }
        }
    }

    // --- Public functions ---

    /** Changes the current folder and re-filters the email list. */
    fun setFolder(folder: String) {
        _uiState.update { it.copy(currentFolder = folder) }
        recomputeState()
    }

    /** Changes the active bundle filter (null = show all inbox). */
    fun setBundle(bundle: String?) {
        _uiState.update { it.copy(activeBundle = bundle) }
        recomputeState()
    }

    /** Changes the account filter (empty = show all accounts). */
    fun setAccountFilter(accounts: List<String>) {
        _uiState.update { it.copy(accountFilter = accounts) }
        recomputeState()
    }

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
            // Add "Trash" tag, remove "Inbox" tag
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

    // --- Private helpers ---

    /**
     * Recomputes the filtered and threaded email list based on current folder,
     * bundle, and account filter settings.
     */
    private fun recomputeState() {
        val folder = _uiState.value.currentFolder
        val bundle = _uiState.value.activeBundle
        val accountFilter = _uiState.value.accountFilter

        // Step 1: Filter by folder
        val folderFiltered = filterByFolder(allEmailChits, folder)

        // Step 2: Apply account filter (if any accounts selected)
        val accountFiltered = if (accountFilter.isEmpty()) {
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

        // Step 5: Compute unread count (always based on inbox, ignoring filters)
        val inboxChits = filterByFolder(allEmailChits, "inbox")
        val unreadCount = inboxChits.count { it.emailRead != true }

        _uiState.update {
            it.copy(
                threads = threads,
                unreadCount = unreadCount,
                isLoading = false
            )
        }
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
                // Find an existing thread with the same normalized subject
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
     * Strips: "Re:", "RE:", "Fwd:", "FW:", "Fw:" (case-insensitive, repeated).
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
     * Creates a reply draft chit from an original email message.
     * Sets emailInReplyTo, prefixes subject with "Re:", quotes the original body.
     * Returns the new chit ID for navigation to the editor.
     */
    fun createReply(originalChitId: String, onCreated: (String) -> Unit) {
        viewModelScope.launch {
            val original = chitDao.getById(originalChitId) ?: return@launch
            val now = Instant.now().toString()
            val newId = java.util.UUID.randomUUID().toString()

            // Build quoted body
            val originalBody = original.emailBodyText ?: original.note ?: ""
            val quotedBody = "\n\n--- Original Message ---\nFrom: ${original.emailFrom ?: "Unknown"}\nDate: ${original.emailDate ?: ""}\n\n$originalBody"

            // Prefix subject with "Re:" if not already
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
     * Prefixes subject with "Fwd:", includes the original body as quoted text.
     * Returns the new chit ID for navigation to the editor.
     */
    fun createForward(originalChitId: String, onCreated: (String) -> Unit) {
        viewModelScope.launch {
            val original = chitDao.getById(originalChitId) ?: return@launch
            val now = Instant.now().toString()
            val newId = java.util.UUID.randomUUID().toString()

            // Build forwarded body
            val originalBody = original.emailBodyText ?: original.note ?: ""
            val forwardedBody = "\n\n--- Forwarded Message ---\nFrom: ${original.emailFrom ?: "Unknown"}\nTo: ${original.emailTo ?: ""}\nDate: ${original.emailDate ?: ""}\nSubject: ${original.emailSubject ?: ""}\n\n$originalBody"

            // Prefix subject with "Fwd:" if not already
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
}
