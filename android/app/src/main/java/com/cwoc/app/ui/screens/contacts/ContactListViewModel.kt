package com.cwoc.app.ui.screens.contacts

import android.content.Context
import android.content.SharedPreferences
import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cwoc.app.data.local.dao.ContactDao
import com.cwoc.app.data.local.entity.ContactEntity
import com.google.gson.Gson
import com.google.gson.annotations.SerializedName
import com.google.gson.reflect.TypeToken
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import javax.inject.Inject

// ─── Data Models ────────────────────────────────────────────────────────────────

/**
 * Represents a switchable user from the API.
 */
data class SwitchableUser(
    val id: String,
    val username: String,
    @SerializedName("display_name") val displayName: String?,
    val email: String?,
    @SerializedName("profile_image_url") val profileImageUrl: String?
)

/**
 * Grouped sections for the contact list.
 */
data class GroupedContacts(
    val favorites: List<ContactEntity> = emptyList(),
    val users: List<SwitchableUser> = emptyList(),
    val allContacts: List<ContactEntity> = emptyList(),
    val vaultContacts: List<ContactEntity> = emptyList()
)

// ─── ViewModel ──────────────────────────────────────────────────────────────────

/**
 * ViewModel for the Contact List screen.
 * Provides contacts with search filtering, alphabetical section index,
 * and grouped mode with collapsible sections.
 */
@OptIn(FlowPreview::class)
@HiltViewModel
class ContactListViewModel @Inject constructor(
    private val contactDao: ContactDao,
    private val okHttpClient: OkHttpClient,
    private val prefs: SharedPreferences,
    private val gson: Gson,
    @ApplicationContext private val appContext: Context
) : ViewModel() {

    companion object {
        private const val PREF_KEY_GROUPED = "contacts_grouped_mode"
    }

    // ─── Search State ───────────────────────────────────────────────────────

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    val contacts: StateFlow<List<ContactEntity>> = _searchQuery
        .debounce(300)
        .flatMapLatest { query ->
            if (query.isBlank()) {
                contactDao.getAllActive()
            } else {
                contactDao.search(query)
            }
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    // ─── Grouped Mode State ─────────────────────────────────────────────────

    private val _isGrouped = MutableStateFlow(
        prefs.getBoolean(PREF_KEY_GROUPED, true)
    )
    val isGrouped: StateFlow<Boolean> = _isGrouped.asStateFlow()

    private val _groupedContacts = MutableStateFlow(GroupedContacts())
    val groupedContacts: StateFlow<GroupedContacts> = _groupedContacts.asStateFlow()

    private val _switchableUsers = MutableStateFlow<List<SwitchableUser>>(emptyList())
    val switchableUsers: StateFlow<List<SwitchableUser>> = _switchableUsers.asStateFlow()

    // ─── Import/Export State ────────────────────────────────────────────────

    private val _actionMessage = MutableStateFlow<String?>(null)
    val actionMessage: StateFlow<String?> = _actionMessage.asStateFlow()

    private val _isImporting = MutableStateFlow(false)
    val isImporting: StateFlow<Boolean> = _isImporting.asStateFlow()

    init {
        if (_isGrouped.value) {
            loadGroupedData()
        }
    }

    // ─── Public API ─────────────────────────────────────────────────────────

    fun updateSearchQuery(query: String) {
        _searchQuery.value = query
    }

    fun toggleGroupedMode() {
        val newValue = !_isGrouped.value
        _isGrouped.value = newValue
        prefs.edit().putBoolean(PREF_KEY_GROUPED, newValue).apply()
        if (newValue) {
            loadGroupedData()
        }
    }

    fun clearActionMessage() {
        _actionMessage.value = null
    }

    /**
     * Compute the alphabetical section index from the current contacts list.
     * Returns a map of letter -> index of first contact starting with that letter.
     */
    fun computeSectionIndex(contacts: List<ContactEntity>): Map<Char, Int> {
        val index = mutableMapOf<Char, Int>()
        contacts.forEachIndexed { i, contact ->
            val letter = (contact.givenName.firstOrNull() ?: contact.surname?.firstOrNull() ?: '#')
                .uppercaseChar()
            if (letter !in index) {
                index[letter] = i
            }
        }
        return index
    }

    // ─── Grouped Mode Loading ───────────────────────────────────────────────

    private fun loadGroupedData() {
        viewModelScope.launch {
            // Load users from API
            fetchSwitchableUsers()
        }

        // Observe contacts and group them
        viewModelScope.launch {
            contacts.collect { allContacts ->
                val favorites = allContacts.filter { it.favorite }
                val vault = allContacts.filter { it.sharedToVault }
                val regular = allContacts.filter { !it.sharedToVault }

                _groupedContacts.value = GroupedContacts(
                    favorites = favorites,
                    users = _switchableUsers.value,
                    allContacts = regular,
                    vaultContacts = vault
                )
            }
        }
    }

    private suspend fun fetchSwitchableUsers() {
        withContext(Dispatchers.IO) {
            try {
                val serverUrl = prefs.getString("server_url", null)
                if (serverUrl.isNullOrBlank()) return@withContext

                val url = serverUrl.trimEnd('/') + "/api/auth/switchable-users"
                val request = Request.Builder().url(url).get().build()
                val response = okHttpClient.newCall(request).execute()

                if (response.isSuccessful) {
                    val body = response.body?.string()
                    if (body != null) {
                        val listType = object : TypeToken<List<SwitchableUser>>() {}.type
                        val users: List<SwitchableUser> = gson.fromJson(body, listType) ?: emptyList()
                        _switchableUsers.value = users
                        // Update grouped contacts with users
                        _groupedContacts.value = _groupedContacts.value.copy(users = users)
                    }
                }
            } catch (e: Exception) {
                android.util.Log.e("CWOC_CONTACTS", "Failed to fetch switchable users: ${e.message}")
            }
        }
    }

    // ─── Import/Export ───────────────────────────────────────────────────────

    /**
     * Import a vCard file from the given URI.
     */
    fun importVcard(uri: Uri) {
        viewModelScope.launch {
            _isImporting.value = true
            try {
                val bytes = readUriBytes(uri)
                if (bytes != null) {
                    val success = uploadFile("/api/contacts/import/vcard", bytes, "file", "contacts.vcf", "text/vcard")
                    _actionMessage.value = if (success) "vCard imported successfully" else "Failed to import vCard"
                } else {
                    _actionMessage.value = "Failed to read file"
                }
            } catch (e: Exception) {
                _actionMessage.value = "Import failed: ${e.message}"
            } finally {
                _isImporting.value = false
            }
        }
    }

    /**
     * Import a CSV file from the given URI.
     */
    fun importCsv(uri: Uri) {
        viewModelScope.launch {
            _isImporting.value = true
            try {
                val bytes = readUriBytes(uri)
                if (bytes != null) {
                    val success = uploadFile("/api/contacts/import/csv", bytes, "file", "contacts.csv", "text/csv")
                    _actionMessage.value = if (success) "CSV imported successfully" else "Failed to import CSV"
                } else {
                    _actionMessage.value = "Failed to read file"
                }
            } catch (e: Exception) {
                _actionMessage.value = "Import failed: ${e.message}"
            } finally {
                _isImporting.value = false
            }
        }
    }

    /**
     * Export contacts as vCard. Returns the file content as a ByteArray for sharing.
     */
    fun exportVcard(onResult: (ByteArray?) -> Unit) {
        viewModelScope.launch {
            val data = downloadFile("/api/contacts/export/vcard")
            onResult(data)
            if (data != null) {
                _actionMessage.value = "vCard exported"
            } else {
                _actionMessage.value = "Failed to export vCard"
            }
        }
    }

    /**
     * Export contacts as CSV. Returns the file content as a ByteArray for sharing.
     */
    fun exportCsv(onResult: (ByteArray?) -> Unit) {
        viewModelScope.launch {
            val data = downloadFile("/api/contacts/export/csv")
            onResult(data)
            if (data != null) {
                _actionMessage.value = "CSV exported"
            } else {
                _actionMessage.value = "Failed to export CSV"
            }
        }
    }

    // ─── Private Network Helpers ────────────────────────────────────────────

    private fun readUriBytes(uri: Uri): ByteArray? {
        return try {
            appContext.contentResolver.openInputStream(uri)?.use { it.readBytes() }
        } catch (_: Exception) {
            null
        }
    }

    private suspend fun uploadFile(
        path: String,
        fileBytes: ByteArray,
        fieldName: String,
        fileName: String,
        mimeType: String
    ): Boolean {
        return withContext(Dispatchers.IO) {
            try {
                val serverUrl = prefs.getString("server_url", null)
                if (serverUrl.isNullOrBlank()) return@withContext false

                val url = serverUrl.trimEnd('/') + path
                val requestBody = MultipartBody.Builder()
                    .setType(MultipartBody.FORM)
                    .addFormDataPart(
                        fieldName,
                        fileName,
                        fileBytes.toRequestBody(mimeType.toMediaType())
                    )
                    .build()

                val request = Request.Builder().url(url).post(requestBody).build()
                val response = okHttpClient.newCall(request).execute()
                response.isSuccessful
            } catch (_: Exception) {
                false
            }
        }
    }

    private suspend fun downloadFile(path: String): ByteArray? {
        return withContext(Dispatchers.IO) {
            try {
                val serverUrl = prefs.getString("server_url", null)
                if (serverUrl.isNullOrBlank()) return@withContext null

                val url = serverUrl.trimEnd('/') + path
                val request = Request.Builder().url(url).get().build()
                val response = okHttpClient.newCall(request).execute()

                if (response.isSuccessful) {
                    response.body?.bytes()
                } else {
                    null
                }
            } catch (_: Exception) {
                null
            }
        }
    }
}
