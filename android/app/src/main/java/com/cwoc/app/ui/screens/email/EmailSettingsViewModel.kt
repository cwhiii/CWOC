package com.cwoc.app.ui.screens.email

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cwoc.app.data.remote.BundleDto
import com.cwoc.app.data.repository.BundleRepository
import com.cwoc.app.data.repository.EmailRepository
import com.cwoc.app.data.repository.SettingsRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

// ─── Data Classes ────────────────────────────────────────────────────────────

/**
 * Represents a single email account configuration.
 * Parsed from the JSON-serialized emailAccounts field in settings.
 */
data class EmailAccountConfig(
    val nickname: String = "",
    val email: String = "",
    val displayName: String = "",
    val username: String = "",
    val password: String = "",
    val imapHost: String = "",
    val imapPort: String = "993",
    val imapSecurity: String = "SSL/TLS",
    val smtpHost: String = "",
    val smtpPort: String = "587",
    val smtpSecurity: String = "STARTTLS"
)

/**
 * Privacy-related email settings.
 * Validates: Requirements 62.1-62.5
 */
data class EmailPrivacySettings(
    /** Whether to block tracking pixels (default: true). Req 62.1 */
    val blockTrackingPixels: Boolean = true,
    /** External content policy: "allow", "block", "known_senders". Req 62.2 */
    val externalContent: String = "block",
    /** Read receipt policy: "never", "always", "ask", "contacts_only". Req 62.3 */
    val readReceipts: String = "never",
    /** Undo send delay in seconds (default: 5). Req 62.4 */
    val undoSendDelay: Int = 5
)

/**
 * Display-related email settings.
 * Validates: Requirements 63.1-63.3
 */
data class EmailDisplaySettings(
    /** Group by mode: "date" or "none". Req 63.1 */
    val groupBy: String = "date",
    /** Whether to paginate email list (50 per page). Req 63.2 */
    val paginateEmail: Boolean = false
)

/**
 * Bundle-related email settings.
 * Validates: Requirements 64.1-64.5
 */
data class EmailBundleSettings(
    /** Whether bundle tabs are enabled. Req 64.1 */
    val bundlesEnabled: Boolean = true,
    /** Whether emails can appear in multiple bundles. Req 64.2 */
    val multiPlacement: Boolean = false,
    /** Count display mode: "both", "unread", "total", "none". Req 64.3 */
    val showCount: String = "both",
    /** List of auto-bundles with their enabled state. Req 64.4 */
    val autoBundles: List<BundleDto> = emptyList()
)

/**
 * Result state for test connection operations.
 */
data class TestConnectionState(
    val isTesting: Boolean = false,
    val imapResult: String? = null,
    val smtpResult: String? = null,
    val isSuccess: Boolean = false,
    val errorMessage: String? = null
)

/**
 * Result state for backfill operations.
 */
data class BackfillState(
    val isInProgress: Boolean = false,
    val estimateMessage: String? = null,
    val resultMessage: String? = null
)

/**
 * Complete UI state for the Email Settings screen.
 */
data class EmailSettingsUiState(
    /** List of configured email accounts. Req 59.1-59.8 */
    val accounts: List<EmailAccountConfig> = emptyList(),
    /** Privacy settings. Req 62.1-62.5 */
    val privacySettings: EmailPrivacySettings = EmailPrivacySettings(),
    /** Display settings. Req 63.1-63.3 */
    val displaySettings: EmailDisplaySettings = EmailDisplaySettings(),
    /** Bundle settings. Req 64.1-64.5 */
    val bundleSettings: EmailBundleSettings = EmailBundleSettings(),
    /** Current email signature (markdown). Req 61.1-61.7 */
    val currentSignature: String = "",
    /** Check interval setting. */
    val checkInterval: String = "15",
    /** Max pull setting. */
    val maxPull: String = "100",
    /** Test connection state. Req 60.1-60.4 */
    val testConnectionState: TestConnectionState = TestConnectionState(),
    /** Backfill state. Req 65.1-65.6 */
    val backfillState: BackfillState = BackfillState(),
    /** Whether settings are currently loading. */
    val isLoading: Boolean = false,
    /** Error message from the last failed operation. */
    val error: String? = null
)

/**
 * ViewModel for the Email Settings screen.
 *
 * Manages all email settings state including accounts, privacy, display, bundles,
 * signature, and backfill operations. Settings are persisted via [SettingsRepository]
 * which handles dirty tracking and sync.
 *
 * Validates: Requirements 59.1-59.8, 60.1-60.4, 61.1-61.7, 62.1-62.5,
 *            63.1-63.3, 64.1-64.5, 65.1-65.6
 */
@HiltViewModel
class EmailSettingsViewModel @Inject constructor(
    private val settingsRepository: SettingsRepository,
    private val emailRepository: EmailRepository,
    private val bundleRepository: BundleRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(EmailSettingsUiState())
    val uiState: StateFlow<EmailSettingsUiState> = _uiState.asStateFlow()

    init {
        loadSettings()
        observeBundles()
    }

    // ─── Settings Loading ────────────────────────────────────────────────────────

    /**
     * Loads all email settings from the SettingsRepository and populates the UI state.
     * Called on init and can be called to refresh after external changes.
     *
     * Validates: Requirements 59.1, 62.1-62.5, 63.1-63.3, 64.1-64.5
     */
    fun loadSettings() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            try {
                settingsRepository.settings.collect { settings ->
                    val accounts = parseAccountsJson(settings.emailAccounts)
                    val privacy = EmailPrivacySettings(
                        blockTrackingPixels = settings.emailBlockTrackingPixels != "false",
                        externalContent = settings.emailExternalContent ?: "block",
                        readReceipts = settings.emailReadReceipts ?: "never",
                        undoSendDelay = settings.emailUndoSendDelay?.toIntOrNull() ?: 5
                    )
                    val display = EmailDisplaySettings(
                        groupBy = settings.emailGroupBy ?: "date",
                        paginateEmail = settings.paginateEmail == "true"
                    )
                    val bundle = EmailBundleSettings(
                        bundlesEnabled = settings.bundlesEnabled != false,
                        multiPlacement = settings.bundlesMultiPlacement == true,
                        showCount = settings.bundlesShowCount
                            ?: settings.emailBundlesCountDisplay
                            ?: "both"
                    )
                    _uiState.update { current ->
                        current.copy(
                            accounts = accounts,
                            privacySettings = privacy,
                            displaySettings = display,
                            bundleSettings = current.bundleSettings.copy(
                                bundlesEnabled = bundle.bundlesEnabled,
                                multiPlacement = bundle.multiPlacement,
                                showCount = bundle.showCount
                            ),
                            currentSignature = settings.emailSignature ?: "",
                            checkInterval = settings.emailCheckInterval ?: "15",
                            maxPull = settings.emailMaxPull ?: "100",
                            isLoading = false
                        )
                    }
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, error = e.message) }
            }
        }
    }

    /** Observe bundles from BundleRepository for auto-bundle toggles. */
    private fun observeBundles() {
        viewModelScope.launch {
            bundleRepository.bundles.collect { bundles ->
                _uiState.update { current ->
                    current.copy(
                        bundleSettings = current.bundleSettings.copy(autoBundles = bundles)
                    )
                }
            }
        }
    }

    // ─── Settings Persistence ────────────────────────────────────────────────────

    /**
     * Saves all current email settings to the SettingsRepository.
     * Marks the settings as dirty and triggers sync if online.
     *
     * Validates: Requirements 62.5, 63.3
     */
    fun saveSettings() {
        viewModelScope.launch {
            try {
                val currentSettings = settingsRepository.get() ?: return@launch
                val state = _uiState.value
                val updatedSettings = currentSettings.copy(
                    emailAccounts = serializeAccountsJson(state.accounts),
                    emailBlockTrackingPixels = if (state.privacySettings.blockTrackingPixels) "true" else "false",
                    emailExternalContent = state.privacySettings.externalContent,
                    emailReadReceipts = state.privacySettings.readReceipts,
                    emailUndoSendDelay = state.privacySettings.undoSendDelay.toString(),
                    emailGroupBy = state.displaySettings.groupBy,
                    paginateEmail = if (state.displaySettings.paginateEmail) "true" else "false",
                    bundlesEnabled = state.bundleSettings.bundlesEnabled,
                    bundlesMultiPlacement = state.bundleSettings.multiPlacement,
                    bundlesShowCount = state.bundleSettings.showCount,
                    emailCheckInterval = state.checkInterval,
                    emailMaxPull = state.maxPull,
                    emailSignature = state.currentSignature
                )
                settingsRepository.update(updatedSettings)
            } catch (e: Exception) {
                _uiState.update { it.copy(error = e.message) }
            }
        }
    }

    // ─── Test Connection ─────────────────────────────────────────────────────────

    /**
     * Tests IMAP and SMTP connectivity for the given account configuration.
     * Updates the testConnectionState in the UI state with results.
     *
     * Validates: Requirements 60.1-60.4
     */
    fun testConnection(account: EmailAccountConfig) {
        viewModelScope.launch {
            _uiState.update { it.copy(testConnectionState = TestConnectionState(isTesting = true)) }
            try {
                val config = mapOf<String, Any?>(
                    "email" to account.email,
                    "imap_host" to account.imapHost,
                    "imap_port" to account.imapPort,
                    "imap_security" to account.imapSecurity,
                    "smtp_host" to account.smtpHost,
                    "smtp_port" to account.smtpPort,
                    "smtp_security" to account.smtpSecurity,
                    "username" to account.username,
                    "password" to account.password
                )
                val result = emailRepository.testConnection(config)
                result.fold(
                    onSuccess = { response ->
                        val imapStatus = if (response.imap?.success == true) "IMAP OK"
                        else "IMAP Failed: ${response.imap?.message ?: "Unknown error"}"
                        val smtpStatus = if (response.smtp?.success == true) "SMTP OK"
                        else "SMTP Failed: ${response.smtp?.message ?: "Unknown error"}"
                        val allSuccess = response.imap?.success == true && response.smtp?.success == true
                        _uiState.update {
                            it.copy(
                                testConnectionState = TestConnectionState(
                                    isTesting = false,
                                    imapResult = imapStatus,
                                    smtpResult = smtpStatus,
                                    isSuccess = allSuccess
                                )
                            )
                        }
                    },
                    onFailure = { e ->
                        _uiState.update {
                            it.copy(
                                testConnectionState = TestConnectionState(
                                    isTesting = false,
                                    errorMessage = e.message ?: "Network error"
                                )
                            )
                        }
                    }
                )
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        testConnectionState = TestConnectionState(
                            isTesting = false,
                            errorMessage = e.message ?: "Network error"
                        )
                    )
                }
            }
        }
    }

    /** Resets the test connection state (e.g., when navigating away from account edit). */
    fun clearTestConnectionState() {
        _uiState.update { it.copy(testConnectionState = TestConnectionState()) }
    }

    // ─── Backfill ────────────────────────────────────────────────────────────────

    /**
     * Fetches the backfill estimate (message count and size) from the server.
     * Updates the backfillState with the estimate message for user confirmation.
     *
     * Validates: Requirements 65.1, 65.2
     */
    fun backfillEstimate() {
        viewModelScope.launch {
            _uiState.update {
                it.copy(backfillState = BackfillState(isInProgress = true, estimateMessage = "Estimating..."))
            }
            try {
                val result = emailRepository.backfillEstimate()
                result.fold(
                    onSuccess = { response ->
                        val count = response.messageCount ?: 0
                        val sizeMb = response.estimatedMb ?: 0.0
                        val estimate = "~$count messages (~${"%.1f".format(sizeMb)} MB)"
                        _uiState.update {
                            it.copy(
                                backfillState = BackfillState(
                                    isInProgress = false,
                                    estimateMessage = estimate
                                )
                            )
                        }
                    },
                    onFailure = { e ->
                        _uiState.update {
                            it.copy(
                                backfillState = BackfillState(
                                    isInProgress = false,
                                    resultMessage = "❌ ${e.message ?: "Estimation failed"}"
                                )
                            )
                        }
                    }
                )
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        backfillState = BackfillState(
                            isInProgress = false,
                            resultMessage = "❌ ${e.message ?: "Network error"}"
                        )
                    )
                }
            }
        }
    }

    /**
     * Triggers the actual backfill sync operation after user confirmation.
     * Calls POST /api/email/sync with backfill=true.
     *
     * Validates: Requirements 65.3, 65.4, 65.5
     */
    fun triggerBackfill() {
        viewModelScope.launch {
            _uiState.update {
                it.copy(backfillState = BackfillState(isInProgress = true, estimateMessage = "Syncing..."))
            }
            try {
                val result = emailRepository.syncEmail(backfill = true)
                result.fold(
                    onSuccess = { response ->
                        val newCount = response.newCount ?: 0
                        val delCount = response.deletedCount ?: 0
                        val parts = mutableListOf<String>()
                        if (newCount > 0) parts.add("$newCount imported")
                        if (delCount > 0) parts.add("$delCount removed")
                        val msg = if (parts.isNotEmpty()) parts.joinToString(", ") else "No new emails"
                        _uiState.update {
                            it.copy(
                                backfillState = BackfillState(
                                    isInProgress = false,
                                    resultMessage = "✅ $msg"
                                )
                            )
                        }
                    },
                    onFailure = { e ->
                        _uiState.update {
                            it.copy(
                                backfillState = BackfillState(
                                    isInProgress = false,
                                    resultMessage = "❌ ${e.message ?: "Sync failed"}"
                                )
                            )
                        }
                    }
                )
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        backfillState = BackfillState(
                            isInProgress = false,
                            resultMessage = "❌ ${e.message ?: "Network error"}"
                        )
                    )
                }
            }
        }
    }

    /** Clears the backfill state (e.g., after user dismisses the result). */
    fun clearBackfillState() {
        _uiState.update { it.copy(backfillState = BackfillState()) }
    }

    // ─── Signature ───────────────────────────────────────────────────────────────

    /**
     * Updates the current signature in local state.
     * Call [saveSignature] to persist.
     *
     * Validates: Requirements 61.1-61.7
     */
    fun updateSignature(signature: String) {
        _uiState.update { it.copy(currentSignature = signature) }
    }

    /**
     * Saves the current signature to settings and persists to server.
     *
     * Validates: Requirements 61.6
     */
    fun saveSignature() {
        viewModelScope.launch {
            try {
                val currentSettings = settingsRepository.get() ?: return@launch
                val updatedSettings = currentSettings.copy(
                    emailSignature = _uiState.value.currentSignature
                )
                settingsRepository.update(updatedSettings)
            } catch (e: Exception) {
                _uiState.update { it.copy(error = e.message) }
            }
        }
    }

    // ─── Account CRUD ────────────────────────────────────────────────────────────

    /**
     * Adds a new email account to the accounts list and persists.
     *
     * Validates: Requirements 59.5, 59.6
     */
    fun addAccount(account: EmailAccountConfig) {
        viewModelScope.launch {
            val updatedAccounts = _uiState.value.accounts + account
            _uiState.update { it.copy(accounts = updatedAccounts) }
            persistAccounts(updatedAccounts)
        }
    }

    /**
     * Updates an existing email account at the given index and persists.
     *
     * Validates: Requirements 59.4, 59.6
     */
    fun editAccount(index: Int, account: EmailAccountConfig) {
        viewModelScope.launch {
            val currentAccounts = _uiState.value.accounts.toMutableList()
            if (index in currentAccounts.indices) {
                currentAccounts[index] = account
                _uiState.update { it.copy(accounts = currentAccounts) }
                persistAccounts(currentAccounts)
            }
        }
    }

    /**
     * Deletes an email account at the given index and persists.
     *
     * Validates: Requirements 59.8
     */
    fun deleteAccount(index: Int) {
        viewModelScope.launch {
            val currentAccounts = _uiState.value.accounts.toMutableList()
            if (index in currentAccounts.indices) {
                currentAccounts.removeAt(index)
                _uiState.update { it.copy(accounts = currentAccounts) }
                persistAccounts(currentAccounts)
            }
        }
    }

    // ─── Privacy Settings Updates ────────────────────────────────────────────────

    /**
     * Updates a privacy setting and auto-saves.
     * Validates: Requirements 62.1-62.5
     */
    fun updatePrivacySetting(update: (EmailPrivacySettings) -> EmailPrivacySettings) {
        _uiState.update { current ->
            current.copy(privacySettings = update(current.privacySettings))
        }
        saveSettings()
    }

    // ─── Display Settings Updates ────────────────────────────────────────────────

    /**
     * Updates a display setting and auto-saves.
     * Validates: Requirements 63.1-63.3
     */
    fun updateDisplaySetting(update: (EmailDisplaySettings) -> EmailDisplaySettings) {
        _uiState.update { current ->
            current.copy(displaySettings = update(current.displaySettings))
        }
        saveSettings()
    }

    // ─── Bundle Settings Updates ─────────────────────────────────────────────────

    /**
     * Updates a bundle setting and auto-saves.
     * Validates: Requirements 64.1-64.3
     */
    fun updateBundleSetting(update: (EmailBundleSettings) -> EmailBundleSettings) {
        _uiState.update { current ->
            current.copy(bundleSettings = update(current.bundleSettings))
        }
        saveSettings()
    }

    /**
     * Toggles an auto-bundle on or off via the BundleRepository.
     * Validates: Requirements 64.4, 64.5
     */
    fun toggleAutoBundle(bundleId: String, enable: Boolean) {
        viewModelScope.launch {
            val result = if (enable) {
                bundleRepository.enableBundle(bundleId)
            } else {
                bundleRepository.disableBundle(bundleId)
            }
            if (result.isFailure) {
                _uiState.update { it.copy(error = result.exceptionOrNull()?.message) }
            }
        }
    }

    // ─── Check Interval & Max Pull ───────────────────────────────────────────────

    /**
     * Updates the check interval setting and auto-saves.
     */
    fun updateCheckInterval(interval: String) {
        _uiState.update { it.copy(checkInterval = interval) }
        saveSettings()
    }

    /**
     * Updates the max pull setting and auto-saves.
     */
    fun updateMaxPull(maxPull: String) {
        _uiState.update { it.copy(maxPull = maxPull) }
        saveSettings()
    }

    // ─── Error Handling ──────────────────────────────────────────────────────────

    /** Clears any displayed error. */
    fun clearError() {
        _uiState.update { it.copy(error = null) }
    }

    // ─── Private Helpers ─────────────────────────────────────────────────────────

    /**
     * Persists the accounts list to settings.
     * Serializes to JSON and saves via SettingsRepository.
     */
    private suspend fun persistAccounts(accounts: List<EmailAccountConfig>) {
        try {
            val currentSettings = settingsRepository.get() ?: return
            val updatedSettings = currentSettings.copy(
                emailAccounts = serializeAccountsJson(accounts)
            )
            settingsRepository.update(updatedSettings)
        } catch (e: Exception) {
            _uiState.update { it.copy(error = e.message) }
        }
    }

    companion object {
        /**
         * Parses the JSON-serialized email accounts string into a list of [EmailAccountConfig].
         * The JSON format is an array of objects with keys matching the account fields.
         */
        fun parseAccountsJson(json: String?): List<EmailAccountConfig> {
            if (json.isNullOrBlank() || json == "[]" || json == "null") return emptyList()
            return try {
                val array = org.json.JSONArray(json)
                (0 until array.length()).map { i ->
                    val obj = array.getJSONObject(i)
                    EmailAccountConfig(
                        nickname = obj.optString("nickname", ""),
                        email = obj.optString("email", ""),
                        displayName = obj.optString("display_name", ""),
                        username = obj.optString("username", ""),
                        password = obj.optString("password", ""),
                        imapHost = obj.optString("imap_host", ""),
                        imapPort = obj.optString("imap_port", "993"),
                        imapSecurity = obj.optString("imap_security", "SSL/TLS"),
                        smtpHost = obj.optString("smtp_host", ""),
                        smtpPort = obj.optString("smtp_port", "587"),
                        smtpSecurity = obj.optString("smtp_security", "STARTTLS")
                    )
                }
            } catch (e: Exception) {
                emptyList()
            }
        }

        /**
         * Serializes a list of [EmailAccountConfig] to a JSON array string.
         */
        fun serializeAccountsJson(accounts: List<EmailAccountConfig>): String {
            val array = org.json.JSONArray()
            accounts.forEach { account ->
                val obj = org.json.JSONObject().apply {
                    put("nickname", account.nickname)
                    put("email", account.email)
                    put("display_name", account.displayName)
                    put("username", account.username)
                    put("password", account.password)
                    put("imap_host", account.imapHost)
                    put("imap_port", account.imapPort)
                    put("imap_security", account.imapSecurity)
                    put("smtp_host", account.smtpHost)
                    put("smtp_port", account.smtpPort)
                    put("smtp_security", account.smtpSecurity)
                }
                array.put(obj)
            }
            return array.toString()
        }
    }
}
