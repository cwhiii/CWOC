package com.cwoc.app.ui.screens.email

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cwoc.app.data.remote.BundleDto
import com.cwoc.app.data.repository.BundleRepository
import com.cwoc.app.data.repository.SettingsRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * UI state for the bundle toolbar and management.
 */
data class BundleUiState(
    /** All active bundles from the API. */
    val bundles: List<BundleDto> = emptyList(),
    /** Currently selected bundle ID (null = "All" tab). */
    val selectedBundleId: String? = null,
    /** Bundle ID for which the context menu is currently showing (null = no menu). */
    val contextMenuBundleId: String? = null,
    /** Whether the user is currently dragging to reorder bundles. */
    val isReordering: Boolean = false,
    /** The bundle count display mode from settings: "both", "unread", "total", "none". */
    val countDisplayMode: String = "both",
    /** Whether bundles are loading from the API. */
    val isLoading: Boolean = false,
    /** Error message from the last failed operation, if any. */
    val error: String? = null
)

/**
 * ViewModel for bundle tab management in the email screen.
 *
 * Handles bundle CRUD, reordering, context menu state, and count badge formatting.
 * Bundles are fetched from the API via [BundleRepository] and are not part of the
 * local sync system.
 *
 * Validates: Requirements 19.1-19.5, 20.1-20.5, 21.1-21.2, 22.1-22.7,
 *            23.1-23.4, 24.1-24.7, 25.1-25.6, 26.1-26.2, 64.1-64.5
 */
@HiltViewModel
class BundleViewModel @Inject constructor(
    private val bundleRepository: BundleRepository,
    private val settingsRepository: SettingsRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(BundleUiState())
    val uiState: StateFlow<BundleUiState> = _uiState.asStateFlow()

    init {
        // Observe bundles from the repository's reactive StateFlow
        viewModelScope.launch {
            bundleRepository.bundles.collect { bundles ->
                _uiState.update { it.copy(bundles = bundles) }
            }
        }

        // Load the count display mode from settings
        viewModelScope.launch {
            settingsRepository.settings.collect { settings ->
                val mode = settings.bundlesShowCount
                    ?: settings.emailBundlesCountDisplay
                    ?: "both"
                _uiState.update { it.copy(countDisplayMode = mode) }
            }
        }

        // Initial fetch
        fetchBundles()
    }

    // --- Public functions ---

    /**
     * Fetches bundles from the API and updates the local state.
     * Called on init and can be called to refresh after external changes.
     */
    fun fetchBundles() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            val result = bundleRepository.fetchBundles()
            result.fold(
                onSuccess = {
                    _uiState.update { it.copy(isLoading = false) }
                },
                onFailure = { e ->
                    _uiState.update { it.copy(isLoading = false, error = e.message) }
                }
            )
        }
    }

    /**
     * Selects a bundle tab. Pass null to select the "All" tab.
     * Requirement 19.4: tapping a bundle tab filters to that bundle.
     * Requirement 19.5: "All" tab shows all inbox emails.
     */
    fun selectBundle(bundleId: String?) {
        _uiState.update { it.copy(selectedBundleId = bundleId) }
    }

    /**
     * Creates a new bundle via the API.
     * Requirements 24.1-24.7: Create Bundle modal fields.
     */
    fun createBundle(
        name: String,
        description: String? = null,
        color: String? = null,
        showInOmni: Boolean = false,
        onResult: (Result<BundleDto>) -> Unit = {}
    ) {
        viewModelScope.launch {
            val result = bundleRepository.createBundle(name, description, color, showInOmni)
            onResult(result)
            if (result.isFailure) {
                _uiState.update { it.copy(error = result.exceptionOrNull()?.message) }
            }
        }
    }

    /**
     * Updates an existing bundle via the API.
     * Requirements 25.1-25.6: Edit Bundle modal fields.
     */
    fun updateBundle(
        id: String,
        name: String? = null,
        description: String? = null,
        color: String? = null,
        showInOmni: Boolean? = null,
        onResult: (Result<BundleDto>) -> Unit = {}
    ) {
        viewModelScope.launch {
            val result = bundleRepository.updateBundle(id, name, description, color, showInOmni)
            onResult(result)
            if (result.isFailure) {
                _uiState.update { it.copy(error = result.exceptionOrNull()?.message) }
            }
        }
    }

    /**
     * Deletes a bundle via the API.
     * Requirement 22.5-22.6: Delete from context menu with confirmation.
     * Requirement 22.7: Cannot delete the "Everything Else" bundle.
     */
    fun deleteBundle(id: String, onResult: (Result<Unit>) -> Unit = {}) {
        viewModelScope.launch {
            val result = bundleRepository.deleteBundle(id)
            onResult(result)
            if (result.isSuccess) {
                // If the deleted bundle was selected, reset to "All"
                if (_uiState.value.selectedBundleId == id) {
                    _uiState.update { it.copy(selectedBundleId = null) }
                }
            } else {
                _uiState.update { it.copy(error = result.exceptionOrNull()?.message) }
            }
        }
    }

    /**
     * Disables an auto-bundle (hides it and strips tags from classified emails).
     * Requirement 22.3-22.4: Disable option for auto-bundles.
     */
    fun disableBundle(id: String, onResult: (Result<Unit>) -> Unit = {}) {
        viewModelScope.launch {
            val result = bundleRepository.disableBundle(id)
            onResult(result)
            if (result.isSuccess) {
                // If the disabled bundle was selected, reset to "All"
                if (_uiState.value.selectedBundleId == id) {
                    _uiState.update { it.copy(selectedBundleId = null) }
                }
            } else {
                _uiState.update { it.copy(error = result.exceptionOrNull()?.message) }
            }
        }
    }

    /**
     * Reorders bundles by providing the new ordered list of IDs.
     * Requirements 23.1-23.4: Drag-to-reorder with API persistence.
     */
    fun reorderBundles(orderedIds: List<String>, onResult: (Result<Unit>) -> Unit = {}) {
        viewModelScope.launch {
            val result = bundleRepository.reorderBundles(orderedIds)
            onResult(result)
            if (result.isFailure) {
                _uiState.update { it.copy(error = result.exceptionOrNull()?.message) }
            }
        }
    }

    // --- Context menu state ---

    /**
     * Shows the context menu for a bundle tab (long-press).
     * Requirement 22.1: Long-press (500ms) shows context menu.
     */
    fun showContextMenu(bundleId: String) {
        _uiState.update { it.copy(contextMenuBundleId = bundleId) }
    }

    /** Dismisses the bundle context menu. */
    fun dismissContextMenu() {
        _uiState.update { it.copy(contextMenuBundleId = null) }
    }

    // --- Drag-to-reorder state ---

    /**
     * Enters reorder mode when the user starts dragging a bundle tab.
     * Requirement 23.1: Long-press and drag enters reorder mode.
     */
    fun startReordering() {
        _uiState.update { it.copy(isReordering = true) }
    }

    /**
     * Exits reorder mode when the user finishes dragging.
     */
    fun stopReordering() {
        _uiState.update { it.copy(isReordering = false) }
    }

    // --- Count badge formatting ---

    /**
     * Formats the count badge text for a bundle based on the current display mode setting.
     *
     * Property 15: Bundle Count Badge Formatting
     * - "both" → "U/T" (e.g., "3/12")
     * - "unread" → "U" (e.g., "3")
     * - "total" → "T" (e.g., "12")
     * - "none" → "" (empty string)
     *
     * Validates: Requirements 20.1, 20.2, 20.3, 20.4
     */
    fun formatBundleCount(unreadCount: Int, totalCount: Int): String {
        return formatBundleCount(unreadCount, totalCount, _uiState.value.countDisplayMode)
    }

    /** Clears any displayed error. */
    fun clearError() {
        _uiState.update { it.copy(error = null) }
    }

    companion object {
        /**
         * Pure function for bundle count formatting.
         * Exposed as a companion for testability (Property 15).
         *
         * @param unreadCount The number of unread emails in the bundle.
         * @param totalCount The total number of emails in the bundle.
         * @param displayMode The display mode setting: "both", "unread", "total", or "none".
         * @return Formatted count string.
         */
        fun formatBundleCount(unreadCount: Int, totalCount: Int, displayMode: String): String {
            return when (displayMode) {
                "both" -> "$unreadCount/$totalCount"
                "unread" -> "$unreadCount"
                "total" -> "$totalCount"
                "none" -> ""
                else -> ""
            }
        }
    }
}
