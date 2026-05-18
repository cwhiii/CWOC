package com.cwoc.app.ui.screens.contacts

import android.content.Context
import android.content.SharedPreferences
import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cwoc.app.data.local.entity.ContactEntity
import com.cwoc.app.data.remote.ImportResultDto
import com.cwoc.app.data.remote.SwitchableUserDto
import com.cwoc.app.data.repository.ContactRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.io.File
import javax.inject.Inject

// ─── UI State ───────────────────────────────────────────────────────────────────

data class PeopleUiState(
    val isGrouped: Boolean = true,
    val searchQuery: String = "",
    val favorites: List<ContactEntity> = emptyList(),
    val users: List<SwitchableUserDto> = emptyList(),
    val allContacts: List<ContactEntity> = emptyList(),
    val vaultContacts: List<ContactEntity> = emptyList(),
    val flatList: List<ContactEntity> = emptyList(),
    val collapsedSections: Set<String> = emptySet(),
    val isImporting: Boolean = false,
    val importResult: ImportResultDto? = null,
    val errorMessage: String? = null,
    val exportSuccess: String? = null
)

// ─── ViewModel ──────────────────────────────────────────────────────────────────

@OptIn(FlowPreview::class)
@HiltViewModel
class ContactListViewModel @Inject constructor(
    private val contactRepository: ContactRepository,
    private val prefs: SharedPreferences,
    @ApplicationContext private val appContext: Context
) : ViewModel() {

    companion object {
        private const val PREF_KEY_GROUPED = "contacts_grouped_mode"
        private const val PREF_KEY_COLLAPSED = "contacts_collapsed_sections"
        private const val PREF_KEY_USER_FAV_PREFIX = "user_fav_"
    }

    private val _uiState = MutableStateFlow(PeopleUiState(
        isGrouped = prefs.getBoolean(PREF_KEY_GROUPED, true),
        collapsedSections = loadCollapsedSections()
    ))
    val uiState: StateFlow<PeopleUiState> = _uiState.asStateFlow()

    // Search query drives the contact list
    private val _searchQuery = MutableStateFlow("")

    // Contacts flow based on search
    val contacts: StateFlow<List<ContactEntity>> = _searchQuery
        .debounce(150)
        .flatMapLatest { query ->
            if (query.isBlank()) {
                contactRepository.allContacts
            } else {
                contactRepository.searchContacts(query)
            }
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    init {
        loadSwitchableUsers()
        observeContacts()
    }

    // ─── Public API ─────────────────────────────────────────────────────────

    fun updateSearchQuery(query: String) {
        _searchQuery.value = query
        _uiState.value = _uiState.value.copy(searchQuery = query)
    }

    fun toggleGroupedMode() {
        val newValue = !_uiState.value.isGrouped
        _uiState.value = _uiState.value.copy(isGrouped = newValue)
        prefs.edit().putBoolean(PREF_KEY_GROUPED, newValue).apply()
    }

    fun toggleSection(sectionId: String) {
        val current = _uiState.value.collapsedSections.toMutableSet()
        if (sectionId in current) current.remove(sectionId) else current.add(sectionId)
        _uiState.value = _uiState.value.copy(collapsedSections = current)
        saveCollapsedSections(current)
    }

    fun isSectionCollapsed(sectionId: String): Boolean =
        sectionId in _uiState.value.collapsedSections

    fun toggleFavorite(contactId: String) {
        viewModelScope.launch {
            contactRepository.toggleFavorite(contactId)
        }
    }

    fun isUserFavorite(userId: String): Boolean =
        prefs.getBoolean("$PREF_KEY_USER_FAV_PREFIX$userId", false)

    fun toggleUserFavorite(userId: String) {
        val key = "$PREF_KEY_USER_FAV_PREFIX$userId"
        val current = prefs.getBoolean(key, false)
        prefs.edit().putBoolean(key, !current).apply()
        // Refresh grouped data
        updateGroupedState(contacts.value)
    }

    fun importFile(uri: Uri) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isImporting = true, importResult = null)
            try {
                val filename = getFilenameFromUri(uri) ?: "contacts.vcf"
                val result = contactRepository.importFile(appContext, uri, filename)
                _uiState.value = _uiState.value.copy(
                    isImporting = false,
                    importResult = result
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isImporting = false,
                    errorMessage = "Import failed: ${e.message}"
                )
            }
        }
    }

    fun exportContacts(format: String) {
        viewModelScope.launch {
            try {
                val file = contactRepository.exportAll(appContext, format)
                if (file != null) {
                    _uiState.value = _uiState.value.copy(
                        exportSuccess = "Exported to ${file.name}"
                    )
                } else {
                    _uiState.value = _uiState.value.copy(
                        errorMessage = "Export failed"
                    )
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    errorMessage = "Export failed: ${e.message}"
                )
            }
        }
    }

    fun clearImportResult() {
        _uiState.value = _uiState.value.copy(importResult = null)
    }

    fun clearError() {
        _uiState.value = _uiState.value.copy(errorMessage = null)
    }

    fun clearExportSuccess() {
        _uiState.value = _uiState.value.copy(exportSuccess = null)
    }

    // ─── Private ────────────────────────────────────────────────────────────

    private fun observeContacts() {
        viewModelScope.launch {
            contacts.collect { contactList ->
                updateGroupedState(contactList)
            }
        }
    }

    private fun updateGroupedState(contactList: List<ContactEntity>) {
        val currentUserId = prefs.getString("user_id", "") ?: ""
        val users = _uiState.value.users

        val favorites = contactList.filter { it.favorite }
        val vault = contactList.filter { it.sharedToVault && it.ownerId != currentUserId }
        val regular = contactList.filter { !it.favorite && !(it.sharedToVault && it.ownerId != currentUserId) }

        // Separate favorited users
        val favUsers = users.filter { isUserFavorite(it.id) }
        val nonFavUsers = users.filter { !isUserFavorite(it.id) }

        _uiState.value = _uiState.value.copy(
            favorites = favorites,
            allContacts = regular,
            vaultContacts = vault,
            flatList = contactList,
            users = users
        )
    }

    private fun loadSwitchableUsers() {
        viewModelScope.launch {
            val users = contactRepository.getSwitchableUsers()
            _uiState.value = _uiState.value.copy(users = users)
        }
    }

    private fun loadCollapsedSections(): Set<String> {
        val stored = prefs.getStringSet(PREF_KEY_COLLAPSED, null)
        return stored ?: emptySet()
    }

    private fun saveCollapsedSections(sections: Set<String>) {
        prefs.edit().putStringSet(PREF_KEY_COLLAPSED, sections).apply()
    }

    private fun getFilenameFromUri(uri: Uri): String? {
        return try {
            val cursor = appContext.contentResolver.query(uri, null, null, null, null)
            cursor?.use {
                if (it.moveToFirst()) {
                    val nameIndex = it.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME)
                    if (nameIndex >= 0) it.getString(nameIndex) else null
                } else null
            }
        } catch (_: Exception) {
            null
        }
    }
}
