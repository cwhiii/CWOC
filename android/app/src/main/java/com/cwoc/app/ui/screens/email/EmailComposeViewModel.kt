package com.cwoc.app.ui.screens.email

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cwoc.app.data.local.dao.ChitDao
import com.cwoc.app.data.local.dao.ContactDao
import com.cwoc.app.data.local.entity.ChitEntity
import com.cwoc.app.data.local.entity.ContactEntity
import com.cwoc.app.data.repository.EmailRepository
import com.cwoc.app.data.repository.SettingsRepository
import com.cwoc.app.data.sync.ConnectivityMonitor
import com.cwoc.app.data.sync.DirtyTracker
import com.cwoc.app.data.sync.SyncPushEngine
import com.cwoc.app.domain.email.AutocompleteSearch
import com.cwoc.app.domain.email.DraftDetector
import com.cwoc.app.domain.email.MarkdownFormatter
import com.cwoc.app.domain.email.PgpManager
import com.cwoc.app.domain.email.TextSelection
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.Instant
import javax.inject.Inject

/**
 * Represents a recipient in the To/CC/BCC fields.
 */
data class RecipientChip(
    val email: String,
    val displayName: String?,
    val contactId: String? = null,
    val imageUrl: String? = null,
    val color: String? = null,
    val hasPgpKey: Boolean = false
)

/**
 * Represents the pending undo-send state.
 */
data class PendingSend(
    val chitId: String,
    val archiveOriginalMessageId: String? = null,
    val durationMs: Long = 5000L,
    val startTimeMs: Long = System.currentTimeMillis()
)

/**
 * Represents a scheduled send state.
 */
data class ScheduledSendInfo(
    val chitId: String,
    val sendAt: String
)

/**
 * UI state for the email compose screen.
 */
data class ComposeUiState(
    // Recipients
    val toRecipients: List<RecipientChip> = emptyList(),
    val ccRecipients: List<RecipientChip> = emptyList(),
    val bccRecipients: List<RecipientChip> = emptyList(),

    // Autocomplete
    val autocompleteQuery: String = "",
    val autocompleteResults: List<ContactEntity> = emptyList(),
    val activeRecipientField: RecipientField = RecipientField.TO,

    // Subject / Title sync (Property 13)
    val subject: String = "",
    val title: String = "",
    val previousTitle: String = "",

    // Body
    val body: String = "",

    // PGP state
    val pgpEnabled: Boolean = false,
    val pgpToggleVisible: Boolean = false,
    val pgpDecryptionBannerVisible: Boolean = false,
    val pgpDecryptedBody: String? = null,

    // Formatting
    val showFormattingToolbar: Boolean = true,

    // Undo-send
    val pendingSend: PendingSend? = null,
    val sendInProgress: Boolean = false,

    // Scheduled send
    val scheduledSend: ScheduledSendInfo? = null,

    // Draft detection
    val existingDraftId: String? = null,

    // Signature
    val signatureApplied: Boolean = false,

    // Send button visibility
    val canSend: Boolean = false,
    val isReply: Boolean = false,

    // Read receipt
    val requestReadReceipt: Boolean = false,

    // Error/status
    val error: String? = null,
    val statusMessage: String? = null
)

enum class RecipientField { TO, CC, BCC }

/**
 * Formatting operations available in the compose toolbar.
 * Maps to keyboard shortcuts (Requirements 39.1-39.8).
 */
enum class FormattingOperation {
    BOLD,            // Ctrl+B
    ITALIC,          // Ctrl+I
    STRIKETHROUGH,   // Ctrl+Shift+X
    LINK,            // Ctrl+K
    INLINE_CODE,     // Ctrl+E
    BLOCKQUOTE,      // Ctrl+Shift+.
    HORIZONTAL_RULE,
    BULLET_LIST,     // Ctrl+Shift+8
    NUMBERED_LIST,   // Ctrl+Shift+7
    HEADING_1,
    HEADING_2,
    HEADING_3
}

/**
 * ViewModel for the email compose zone.
 *
 * Handles autocomplete, PGP encryption/decryption, markdown formatting,
 * undo-send flow, send-and-archive, send-later, draft detection,
 * subject/title sync, and signature auto-apply.
 *
 * Validates: Requirements 36.1-36.8, 37.1-37.6, 38.1-38.12, 39.1-39.8,
 *            42.1-42.3, 43.1-43.3, 44.1-44.6, 45.1-45.3, 46.1-46.6,
 *            47.1-47.3, 48.1-48.7, 49.1-49.7, 52.1-52.3, 57.1-57.5, 58.1-58.4
 */
@HiltViewModel
class EmailComposeViewModel @Inject constructor(
    private val emailRepository: EmailRepository,
    private val settingsRepository: SettingsRepository,
    private val chitDao: ChitDao,
    private val contactDao: ContactDao,
    private val dirtyTracker: DirtyTracker,
    private val syncPushEngine: SyncPushEngine,
    private val connectivityMonitor: ConnectivityMonitor
) : ViewModel() {

    private val _uiState = MutableStateFlow(ComposeUiState())
    val uiState: StateFlow<ComposeUiState> = _uiState.asStateFlow()

    /** All contacts for autocomplete search. */
    private var allContacts: List<ContactEntity> = emptyList()

    /** The current chit being composed/edited. */
    private var currentChitId: String? = null

    /** Undo-send countdown job. */
    private var undoSendJob: Job? = null

    /** Email signature from settings. */
    private var emailSignature: String? = null

    /** Undo send delay from settings (ms). */
    private var undoSendDelayMs: Long = 5000L

    init {
        // Observe contacts for autocomplete
        viewModelScope.launch {
            contactDao.getAllActive().collect { contacts ->
                allContacts = contacts
            }
        }

        // Observe settings for signature and undo delay
        viewModelScope.launch {
            settingsRepository.settings.collect { settings ->
                emailSignature = settings.emailSignature
                undoSendDelayMs = try {
                    (settings.emailUndoSendDelay?.toLongOrNull() ?: 5L) * 1000L
                } catch (_: Exception) {
                    5000L
                }
            }
        }
    }

    // ─── Initialization ──────────────────────────────────────────────────────

    /**
     * Initializes the compose state for a given chit.
     * Loads existing draft data, applies signature for new drafts,
     * and sets up subject/title sync.
     */
    fun initializeForChit(chitId: String) {
        currentChitId = chitId
        viewModelScope.launch {
            val chit = chitDao.getById(chitId) ?: return@launch

            val toChips = parseRecipientsToChips(chit.emailTo)
            val ccChips = parseRecipientsToChips(chit.emailCc)
            val bccChips = parseRecipientsToChips(chit.emailBcc)

            val isReply = chit.emailInReplyTo != null
            val subject = chit.emailSubject ?: chit.title ?: ""
            val body = chit.emailBodyText ?: chit.note ?: ""
            val scheduledSend = chit.emailSendAt?.let {
                ScheduledSendInfo(chitId = chitId, sendAt = it)
            }

            // Check if PGP toggle should be visible (any recipient has a PGP key)
            val pgpToggleVisible = (toChips + ccChips + bccChips).any { it.hasPgpKey }

            // Check if this is a PGP-encrypted received message
            val pgpDecryptionBanner = chit.emailStatus != "draft" &&
                (chit.emailBodyText?.startsWith("-----BEGIN PGP MESSAGE-----") == true)

            _uiState.update {
                it.copy(
                    toRecipients = toChips,
                    ccRecipients = ccChips,
                    bccRecipients = bccChips,
                    subject = subject,
                    title = chit.title ?: subject,
                    previousTitle = chit.title ?: subject,
                    body = body,
                    isReply = isReply,
                    pgpToggleVisible = pgpToggleVisible,
                    pgpDecryptionBannerVisible = pgpDecryptionBanner,
                    scheduledSend = scheduledSend,
                    requestReadReceipt = chit.emailRequestReadReceipt ?: false,
                    canSend = canSendEmail(toChips, subject, body)
                )
            }

            // Auto-apply signature on new empty drafts (Requirement 42.1)
            if (chit.emailStatus == "draft" && body.isBlank() && !emailSignature.isNullOrBlank()) {
                val signatureBody = "\n\n${emailSignature}"
                _uiState.update {
                    it.copy(body = signatureBody, signatureApplied = true)
                }
            }
        }
    }

    // ─── Autocomplete (Requirements 36.1-36.8) ──────────────────────────────

    /**
     * Updates the autocomplete query and computes results.
     * Triggers search when query is 2+ characters.
     */
    fun updateAutocompleteQuery(query: String, field: RecipientField) {
        _uiState.update { it.copy(autocompleteQuery = query, activeRecipientField = field) }

        if (query.length < 2) {
            _uiState.update { it.copy(autocompleteResults = emptyList()) }
            return
        }

        val existingChips = getExistingChipEmails()
        val results = AutocompleteSearch.search(query, allContacts, existingChips)
        _uiState.update { it.copy(autocompleteResults = results) }
    }

    /**
     * Adds a recipient from autocomplete selection.
     * Requirement 36.7: tapping a result adds it as a chip.
     */
    fun addRecipient(contact: ContactEntity, field: RecipientField) {
        val chip = contactToChip(contact)
        addChipToField(chip, field)
        // Clear autocomplete
        _uiState.update { it.copy(autocompleteQuery = "", autocompleteResults = emptyList()) }
        validatePgpState()
    }

    /**
     * Removes a recipient chip from the specified field.
     */
    fun removeRecipient(email: String, field: RecipientField) {
        _uiState.update { state ->
            when (field) {
                RecipientField.TO -> state.copy(
                    toRecipients = state.toRecipients.filter { it.email != email }
                )
                RecipientField.CC -> state.copy(
                    ccRecipients = state.ccRecipients.filter { it.email != email }
                )
                RecipientField.BCC -> state.copy(
                    bccRecipients = state.bccRecipients.filter { it.email != email }
                )
            }
        }
        updateCanSend()
        validatePgpState()
    }

    /**
     * Chipifies raw text input (on Enter, comma, or blur).
     * Requirement 36.8: pressing Enter or comma chipifies current text.
     */
    fun chipify(rawText: String, field: RecipientField) {
        val email = rawText.trim().trimEnd(',')
        if (email.isBlank()) return

        // Try to find a matching contact
        val matchingContact = allContacts.firstOrNull { contact ->
            extractEmailsFromContact(contact).any { it.equals(email, ignoreCase = true) }
        }

        val chip = if (matchingContact != null) {
            contactToChip(matchingContact)
        } else {
            RecipientChip(
                email = email,
                displayName = null,
                contactId = null,
                imageUrl = null,
                color = null,
                hasPgpKey = false
            )
        }

        addChipToField(chip, field)
        _uiState.update { it.copy(autocompleteQuery = "", autocompleteResults = emptyList()) }
        validatePgpState()
    }

    // ─── PGP State (Requirements 48.1-48.7, 49.1-49.7) ─────────────────────

    /**
     * Toggles PGP encryption on/off.
     * Requirement 48.2: validates all recipients have PGP keys before enabling.
     * Requirement 48.3: shows error if a recipient lacks a key.
     */
    fun togglePgp() {
        val state = _uiState.value
        if (state.pgpEnabled) {
            // Disable PGP
            _uiState.update { it.copy(pgpEnabled = false) }
        } else {
            // Validate all recipients have PGP keys
            val allRecipients = state.toRecipients + state.ccRecipients + state.bccRecipients
            val missingKey = allRecipients.firstOrNull { !it.hasPgpKey }
            if (missingKey != null) {
                _uiState.update {
                    it.copy(error = "Cannot enable PGP: ${missingKey.displayName ?: missingKey.email} has no PGP key on file.")
                }
                return
            }
            _uiState.update { it.copy(pgpEnabled = true) }
        }
    }

    /**
     * Validates PGP state after recipient changes.
     * Requirement 48.6: auto-disable PGP if a recipient without a key is added.
     */
    private fun validatePgpState() {
        val state = _uiState.value
        val allRecipients = state.toRecipients + state.ccRecipients + state.bccRecipients

        // Update PGP toggle visibility (any recipient has a key)
        val pgpVisible = allRecipients.any { it.hasPgpKey }

        // Auto-disable PGP if enabled and a recipient lacks a key
        val shouldDisable = state.pgpEnabled && allRecipients.any { !it.hasPgpKey }

        _uiState.update {
            it.copy(
                pgpToggleVisible = pgpVisible,
                pgpEnabled = if (shouldDisable) false else it.pgpEnabled,
                error = if (shouldDisable) "PGP disabled: not all recipients have PGP keys." else it.error
            )
        }
    }

    /**
     * Validates that all recipients have PGP public keys.
     * Returns true if all recipients have keys, false otherwise.
     * Requirement 48.2.
     */
    fun validateRecipientKeys(): Boolean {
        val state = _uiState.value
        val allRecipients = state.toRecipients + state.ccRecipients + state.bccRecipients
        return allRecipients.all { it.hasPgpKey }
    }

    /**
     * Encrypts the email body using PGP for all recipients.
     * Requirement 48.7: encrypt body using all recipients' public keys before saving.
     */
    private suspend fun encryptBody(body: String): String? {
        val state = _uiState.value
        val allRecipients = state.toRecipients + state.ccRecipients + state.bccRecipients
        val publicKeys = allRecipients.mapNotNull { chip ->
            chip.contactId?.let { contactId ->
                contactDao.getById(contactId)?.pgpKey
            }
        }

        if (publicKeys.isEmpty()) return null

        return try {
            PgpManager.encrypt(body, publicKeys)
        } catch (e: Exception) {
            _uiState.update { it.copy(error = "PGP encryption failed: ${e.message}") }
            null
        }
    }

    /**
     * Decrypts a PGP-encrypted email body.
     * Requirement 49.2-49.5: prompts for password, fetches private key, decrypts in-place.
     */
    fun decryptBody(password: String) {
        viewModelScope.launch {
            val state = _uiState.value
            val ciphertext = state.body

            val keyResult = emailRepository.getPrivatePgpKey(password)
            keyResult.fold(
                onSuccess = { privateKey ->
                    try {
                        val decrypted = PgpManager.decrypt(ciphertext, privateKey, password)
                        _uiState.update {
                            it.copy(
                                pgpDecryptedBody = decrypted,
                                pgpDecryptionBannerVisible = false,
                                statusMessage = "Message decrypted (view only — not saved)."
                            )
                        }
                    } catch (e: Exception) {
                        _uiState.update { it.copy(error = "Decryption failed: ${e.message}") }
                    }
                },
                onFailure = { e ->
                    _uiState.update { it.copy(error = "Failed to retrieve private key: ${e.message}") }
                }
            )
        }
    }

    /**
     * Clears decrypted body state when navigating away.
     * Requirement 49.7: return to encrypted state on navigation.
     */
    fun clearDecryptedState() {
        _uiState.update { it.copy(pgpDecryptedBody = null, pgpDecryptionBannerVisible = true) }
    }

    // ─── Formatting (Requirements 38.1-38.12, 39.1-39.8) ────────────────────

    /**
     * Applies a markdown formatting operation to the current body text.
     * Delegates to MarkdownFormatter.
     */
    fun applyFormatting(operation: FormattingOperation, selection: TextSelection) {
        val state = _uiState.value
        val newBody = when (operation) {
            FormattingOperation.BOLD -> MarkdownFormatter.applyBold(state.body, selection)
            FormattingOperation.ITALIC -> MarkdownFormatter.applyItalic(state.body, selection)
            FormattingOperation.STRIKETHROUGH -> MarkdownFormatter.applyStrikethrough(state.body, selection)
            FormattingOperation.INLINE_CODE -> MarkdownFormatter.applyInlineCode(state.body, selection)
            FormattingOperation.BLOCKQUOTE -> MarkdownFormatter.applyBlockquote(state.body, selection)
            FormattingOperation.HORIZONTAL_RULE -> MarkdownFormatter.applyHorizontalRule(state.body, selection.start)
            FormattingOperation.BULLET_LIST -> MarkdownFormatter.applyBulletList(state.body, selection.start)
            FormattingOperation.NUMBERED_LIST -> MarkdownFormatter.applyNumberedList(state.body, selection.start)
            FormattingOperation.HEADING_1 -> MarkdownFormatter.applyHeading(state.body, selection.start, 1)
            FormattingOperation.HEADING_2 -> MarkdownFormatter.applyHeading(state.body, selection.start, 2)
            FormattingOperation.HEADING_3 -> MarkdownFormatter.applyHeading(state.body, selection.start, 3)
            FormattingOperation.LINK -> state.body // Link requires URL — handled by applyLink()
        }
        _uiState.update { it.copy(body = newBody) }
        updateCanSend()
    }

    /**
     * Applies link formatting with a URL.
     * Requirement 38.6: wraps selection as [text](url).
     */
    fun applyLink(selection: TextSelection, url: String) {
        val state = _uiState.value
        val newBody = MarkdownFormatter.applyLink(state.body, selection, url)
        _uiState.update { it.copy(body = newBody) }
        updateCanSend()
    }

    // ─── Subject/Title Sync (Property 13, Requirements 43.1-43.3) ───────────

    /**
     * Updates the subject field and syncs to title.
     * Requirement 43.1: editing subject updates title to match.
     */
    fun updateSubject(newSubject: String) {
        _uiState.update { state ->
            state.copy(
                subject = newSubject,
                title = newSubject,
                previousTitle = state.title
            )
        }
        updateCanSend()
    }

    /**
     * Updates the title field and conditionally syncs to subject.
     * Requirement 43.2: editing title updates subject when subject is empty
     * or matches the previous title.
     */
    fun updateTitle(newTitle: String) {
        _uiState.update { state ->
            val shouldSyncSubject = state.subject.isBlank() ||
                state.subject == state.previousTitle
            state.copy(
                title = newTitle,
                subject = if (shouldSyncSubject) newTitle else state.subject,
                previousTitle = state.title
            )
        }
        updateCanSend()
    }

    /**
     * Updates the body text.
     */
    fun updateBody(newBody: String) {
        _uiState.update { it.copy(body = newBody) }
        updateCanSend()
    }

    // ─── Undo-Send Flow (Requirements 44.1-44.6) ────────────────────────────

    /**
     * Initiates the send flow: saves draft, starts undo countdown.
     * Requirement 44.1: tapping Send saves draft and navigates to list.
     * Requirement 44.6: encrypts body if PGP is enabled before saving.
     */
    fun initiateSend(onNavigateToList: () -> Unit) {
        viewModelScope.launch {
            val chitId = currentChitId ?: return@launch
            val state = _uiState.value

            _uiState.update { it.copy(sendInProgress = true) }

            // Encrypt body if PGP is enabled (Requirement 44.6)
            val bodyToSave = if (state.pgpEnabled) {
                encryptBody(state.body) ?: run {
                    _uiState.update { it.copy(sendInProgress = false) }
                    return@launch
                }
            } else {
                state.body
            }

            // Save the draft with current state
            saveDraftInternal(chitId, bodyToSave)

            // Set up pending send for undo countdown
            _uiState.update {
                it.copy(
                    pendingSend = PendingSend(
                        chitId = chitId,
                        durationMs = undoSendDelayMs
                    ),
                    sendInProgress = false
                )
            }

            // Start countdown
            startSendCountdown(chitId, archiveOriginalMessageId = null)

            // Navigate to list view
            onNavigateToList()
        }
    }

    /**
     * Starts the undo-send countdown timer.
     * Requirement 44.2: displays countdown toast.
     * Requirement 44.3: executes send when countdown expires.
     */
    private fun startSendCountdown(chitId: String, archiveOriginalMessageId: String?) {
        undoSendJob?.cancel()
        undoSendJob = viewModelScope.launch {
            delay(undoSendDelayMs)
            executeSend(chitId, archiveOriginalMessageId)
        }
    }

    /**
     * Cancels the pending send (user tapped Undo).
     * Requirement 44.5: cancels send and shows "Send cancelled." toast.
     */
    fun cancelSend() {
        undoSendJob?.cancel()
        undoSendJob = null
        _uiState.update {
            it.copy(
                pendingSend = null,
                statusMessage = "Send cancelled."
            )
        }
    }

    /**
     * Executes the actual email send after countdown expires.
     * Requirement 44.3: calls POST /api/email/send/{chitId}.
     * Requirement 44.4: shows success toast on completion.
     */
    private suspend fun executeSend(chitId: String, archiveOriginalMessageId: String?) {
        val result = emailRepository.sendEmail(chitId)
        result.fold(
            onSuccess = {
                _uiState.update {
                    it.copy(
                        pendingSend = null,
                        statusMessage = "Email sent successfully."
                    )
                }
                // Archive original if this was a send-and-archive (Requirement 45.3)
                if (archiveOriginalMessageId != null) {
                    emailRepository.archiveOriginal(archiveOriginalMessageId)
                }
            },
            onFailure = { e ->
                _uiState.update {
                    it.copy(
                        pendingSend = null,
                        error = "Send failed: ${e.message}"
                    )
                }
            }
        )
    }

    // ─── Send and Archive (Requirements 45.1-45.3) ──────────────────────────

    /**
     * Initiates send-and-archive flow for replies.
     * Requirement 45.2: executes undo-send flow.
     * Requirement 45.3: archives original after send completes.
     */
    fun sendAndArchive(onNavigateToList: () -> Unit) {
        viewModelScope.launch {
            val chitId = currentChitId ?: return@launch
            val state = _uiState.value

            _uiState.update { it.copy(sendInProgress = true) }

            // Encrypt body if PGP is enabled
            val bodyToSave = if (state.pgpEnabled) {
                encryptBody(state.body) ?: run {
                    _uiState.update { it.copy(sendInProgress = false) }
                    return@launch
                }
            } else {
                state.body
            }

            // Save the draft
            saveDraftInternal(chitId, bodyToSave)

            // Get the in-reply-to message ID for archiving the original
            val chit = chitDao.getById(chitId)
            val archiveMessageId = chit?.emailInReplyTo

            // Set up pending send with archive info
            _uiState.update {
                it.copy(
                    pendingSend = PendingSend(
                        chitId = chitId,
                        archiveOriginalMessageId = archiveMessageId,
                        durationMs = undoSendDelayMs
                    ),
                    sendInProgress = false
                )
            }

            // Start countdown with archive
            startSendCountdown(chitId, archiveMessageId)

            onNavigateToList()
        }
    }

    // ─── Send Later (Requirements 46.1-46.6) ────────────────────────────────

    /**
     * Schedules an email for later delivery.
     * Requirement 46.4: saves chit and calls schedule API.
     * Requirement 46.5: navigates to Scheduled folder on success.
     */
    fun scheduleSend(sendAt: String, onNavigateToScheduled: () -> Unit) {
        viewModelScope.launch {
            val chitId = currentChitId ?: return@launch
            val state = _uiState.value

            // Save draft first
            saveDraftInternal(chitId, state.body)

            // Call schedule API
            val result = emailRepository.scheduleEmail(chitId, sendAt)
            result.fold(
                onSuccess = {
                    // Update local chit with sendAt
                    val chit = chitDao.getById(chitId) ?: return@fold
                    val now = Instant.now().toString()
                    chitDao.upsert(chit.copy(emailSendAt = sendAt, modifiedDatetime = now))
                    dirtyTracker.markDirty(chitId, setOf("email_send_at"))
                    triggerPushIfOnline(chitId)

                    _uiState.update {
                        it.copy(
                            scheduledSend = ScheduledSendInfo(chitId = chitId, sendAt = sendAt),
                            statusMessage = "Email scheduled for $sendAt"
                        )
                    }
                    onNavigateToScheduled()
                },
                onFailure = { e ->
                    _uiState.update { it.copy(error = "Failed to schedule: ${e.message}") }
                }
            )
        }
    }

    /**
     * Cancels a previously scheduled send.
     * Requirement 47.3: cancels via API and removes indicator.
     */
    fun cancelSchedule() {
        viewModelScope.launch {
            val chitId = currentChitId ?: return@launch

            val result = emailRepository.cancelSchedule(chitId)
            result.fold(
                onSuccess = {
                    // Clear sendAt locally
                    val chit = chitDao.getById(chitId) ?: return@fold
                    val now = Instant.now().toString()
                    chitDao.upsert(chit.copy(emailSendAt = null, modifiedDatetime = now))
                    dirtyTracker.markDirty(chitId, setOf("email_send_at"))
                    triggerPushIfOnline(chitId)

                    _uiState.update {
                        it.copy(
                            scheduledSend = null,
                            statusMessage = "Scheduled send cancelled."
                        )
                    }
                },
                onFailure = { e ->
                    _uiState.update { it.copy(error = "Failed to cancel schedule: ${e.message}") }
                }
            )
        }
    }

    // ─── Draft Detection (Requirements 58.1-58.4) ───────────────────────────

    /**
     * Checks for an existing reply or forward draft.
     * Requirement 58.1-58.2: checks for reply draft by emailInReplyTo.
     * Requirement 58.3-58.4: checks for forward draft by normalized subject.
     *
     * @param originalMessageId The Message-ID of the original message (for replies).
     * @param originalSubject The subject of the original message (for forwards).
     * @param isForward True if checking for a forward draft, false for reply.
     * @param onResult Callback with the existing draft's chit ID if found, null otherwise.
     */
    fun checkExistingDraft(
        originalMessageId: String?,
        originalSubject: String?,
        isForward: Boolean,
        onResult: (String?) -> Unit
    ) {
        viewModelScope.launch {
            // Get all draft chits
            val allChits = chitDao.getAllNonDeleted().first()
            val drafts = allChits.filter { it.emailStatus == "draft" }

            val existingDraft = if (isForward) {
                DraftDetector.findExistingForward(drafts, originalSubject)
            } else {
                DraftDetector.findExistingReply(drafts, originalMessageId)
            }

            _uiState.update { it.copy(existingDraftId = existingDraft?.id) }
            onResult(existingDraft?.id)
        }
    }

    // ─── Read Receipt (Requirements 52.1-52.3) ──────────────────────────────

    /**
     * Toggles the read receipt request flag.
     * Requirement 52.2: sets email_request_read_receipt on the chit.
     */
    fun toggleReadReceipt() {
        _uiState.update { it.copy(requestReadReceipt = !it.requestReadReceipt) }
    }

    // ─── Save Draft (Requirement 57.5) ──────────────────────────────────────

    /**
     * Saves the current compose state as a draft.
     * Requirement 57.5: saves chit without sending.
     */
    fun saveDraft(onSaved: () -> Unit = {}) {
        viewModelScope.launch {
            val chitId = currentChitId ?: return@launch
            saveDraftInternal(chitId, _uiState.value.body)
            _uiState.update { it.copy(statusMessage = "Draft saved.") }
            onSaved()
        }
    }

    // ─── Error/Status Clearing ──────────────────────────────────────────────

    /** Clears the current error message. */
    fun clearError() {
        _uiState.update { it.copy(error = null) }
    }

    /** Clears the current status message. */
    fun clearStatusMessage() {
        _uiState.update { it.copy(statusMessage = null) }
    }

    // ─── Private Helpers ─────────────────────────────────────────────────────

    /**
     * Saves the draft to the local database with current compose state.
     */
    private suspend fun saveDraftInternal(chitId: String, body: String) {
        val state = _uiState.value
        val chit = chitDao.getById(chitId) ?: return
        val now = Instant.now().toString()

        val toEmails = state.toRecipients.joinToString(", ") { it.email }
        val ccEmails = state.ccRecipients.joinToString(", ") { it.email }
        val bccEmails = state.bccRecipients.joinToString(", ") { it.email }

        val updatedChit = chit.copy(
            title = state.title,
            emailSubject = state.subject,
            emailBodyText = body,
            note = body,
            emailTo = toEmails.ifBlank { null },
            emailCc = ccEmails.ifBlank { null },
            emailBcc = bccEmails.ifBlank { null },
            emailStatus = "draft",
            emailRequestReadReceipt = state.requestReadReceipt,
            modifiedDatetime = now
        )

        chitDao.upsert(updatedChit)
        dirtyTracker.markDirty(chitId, setOf(
            "title", "email_subject", "email_body_text", "note",
            "email_to", "email_cc", "email_bcc", "email_status",
            "email_request_read_receipt"
        ))
        triggerPushIfOnline(chitId)
    }

    /**
     * Parses a comma-separated recipient string into RecipientChip objects.
     * Looks up contacts to enrich chips with display name, image, color, and PGP key info.
     */
    private fun parseRecipientsToChips(recipientString: String?): List<RecipientChip> {
        if (recipientString.isNullOrBlank()) return emptyList()

        return recipientString.split(",")
            .map { it.trim() }
            .filter { it.isNotBlank() }
            .map { email ->
                val contact = findContactByEmail(email)
                if (contact != null) {
                    contactToChip(contact)
                } else {
                    RecipientChip(
                        email = email,
                        displayName = null,
                        contactId = null,
                        imageUrl = null,
                        color = null,
                        hasPgpKey = false
                    )
                }
            }
    }

    /**
     * Finds a contact by email address from the cached contacts list.
     */
    private fun findContactByEmail(email: String): ContactEntity? {
        val lowerEmail = email.lowercase()
        return allContacts.firstOrNull { contact ->
            extractEmailsFromContact(contact).any { it.lowercase() == lowerEmail }
        }
    }

    /**
     * Converts a ContactEntity to a RecipientChip.
     */
    private fun contactToChip(contact: ContactEntity): RecipientChip {
        val email = extractEmailsFromContact(contact).firstOrNull() ?: ""
        return RecipientChip(
            email = email,
            displayName = contact.displayName ?: "${contact.givenName} ${contact.surname ?: ""}".trim(),
            contactId = contact.id,
            imageUrl = contact.imageUrl,
            color = contact.color,
            hasPgpKey = !contact.pgpKey.isNullOrBlank()
        )
    }

    /**
     * Extracts email addresses from a contact's emails JSON field.
     */
    private fun extractEmailsFromContact(contact: ContactEntity): List<String> {
        val emailsJson = contact.emails
        if (emailsJson.isNullOrBlank() || emailsJson == "[]" || emailsJson == "null") {
            return emptyList()
        }
        return try {
            val gson = com.google.gson.Gson()
            val type = object : com.google.gson.reflect.TypeToken<List<Map<String, Any?>>>() {}.type
            val list: List<Map<String, Any?>> = gson.fromJson(emailsJson, type) ?: emptyList()
            list.mapNotNull { (it["value"] as? String)?.takeIf { v -> v.isNotBlank() } }
        } catch (_: Exception) {
            listOf(emailsJson)
        }
    }

    /**
     * Adds a chip to the specified recipient field.
     */
    private fun addChipToField(chip: RecipientChip, field: RecipientField) {
        _uiState.update { state ->
            when (field) {
                RecipientField.TO -> state.copy(
                    toRecipients = state.toRecipients + chip
                )
                RecipientField.CC -> state.copy(
                    ccRecipients = state.ccRecipients + chip
                )
                RecipientField.BCC -> state.copy(
                    bccRecipients = state.bccRecipients + chip
                )
            }
        }
        updateCanSend()
    }

    /**
     * Gets all existing chip email addresses across all fields.
     */
    private fun getExistingChipEmails(): List<String> {
        val state = _uiState.value
        return (state.toRecipients + state.ccRecipients + state.bccRecipients)
            .map { it.email }
    }

    /**
     * Updates the canSend flag based on current state.
     * Requirement 57.3: Send button visible only when To, Subject, and Body all have content.
     */
    private fun updateCanSend() {
        _uiState.update { state ->
            state.copy(
                canSend = canSendEmail(state.toRecipients, state.subject, state.body)
            )
        }
    }

    /**
     * Triggers an immediate push if the device is currently online.
     */
    private fun triggerPushIfOnline(chitId: String) {
        if (connectivityMonitor.isOnline.value) {
            viewModelScope.launch {
                syncPushEngine.pushSingle(chitId)
            }
        }
    }

    override fun onCleared() {
        super.onCleared()
        undoSendJob?.cancel()
    }

    companion object {
        /**
         * Determines if the email can be sent based on recipients, subject, and body.
         * Pure function for testability.
         *
         * Requirement 57.3: Send visible only when To, Subject, and Body all have content.
         */
        fun canSendEmail(
            toRecipients: List<RecipientChip>,
            subject: String,
            body: String
        ): Boolean {
            return toRecipients.isNotEmpty() &&
                subject.isNotBlank() &&
                body.isNotBlank()
        }
    }
}
