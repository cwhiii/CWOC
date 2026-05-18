package com.cwoc.app.ui.screens.contacts

import android.content.SharedPreferences
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.gson.Gson
import com.google.gson.annotations.SerializedName
import com.google.gson.reflect.TypeToken
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.MediaType.Companion.toMediaType
import javax.inject.Inject

// ─── Data Models ────────────────────────────────────────────────────────────────

data class DeletedContact(
    val id: String,
    @SerializedName("first_name") val firstName: String?,
    @SerializedName("last_name") val lastName: String?,
    @SerializedName("display_name") val displayName: String?,
    @SerializedName("deleted_datetime") val deletedDatetime: String?
)

// ─── ViewModel ──────────────────────────────────────────────────────────────────

@HiltViewModel
class ContactTrashViewModel @Inject constructor(
    private val okHttpClient: OkHttpClient,
    private val prefs: SharedPreferences,
    private val gson: Gson
) : ViewModel() {

    // ─── UI State ───────────────────────────────────────────────────────────

    private val _contacts = MutableStateFlow<List<DeletedContact>>(emptyList())
    val contacts: StateFlow<List<DeletedContact>> = _contacts.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    private val _actionMessage = MutableStateFlow<String?>(null)
    val actionMessage: StateFlow<String?> = _actionMessage.asStateFlow()

    init {
        loadDeletedContacts()
    }

    // ─── Public API ─────────────────────────────────────────────────────────

    fun loadDeletedContacts() {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            try {
                fetchDeletedContacts()
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun restoreContact(contactId: String) {
        viewModelScope.launch {
            _error.value = null
            try {
                val success = postRestoreContact(contactId)
                if (success) {
                    _actionMessage.value = "Contact restored"
                    loadDeletedContacts()
                }
            } catch (e: Exception) {
                _error.value = "Failed to restore contact: ${e.message}"
            }
        }
    }

    fun purgeContact(contactId: String) {
        viewModelScope.launch {
            _error.value = null
            try {
                val success = deletePurgeContact(contactId)
                if (success) {
                    _actionMessage.value = "Contact permanently deleted"
                    loadDeletedContacts()
                }
            } catch (e: Exception) {
                _error.value = "Failed to purge contact: ${e.message}"
            }
        }
    }

    fun restoreAll() {
        viewModelScope.launch {
            _error.value = null
            try {
                val currentContacts = _contacts.value
                var successCount = 0
                for (contact in currentContacts) {
                    val success = postRestoreContact(contact.id)
                    if (success) successCount++
                }
                _actionMessage.value = "Restored $successCount contact(s)"
                loadDeletedContacts()
            } catch (e: Exception) {
                _error.value = "Failed to restore all: ${e.message}"
            }
        }
    }

    fun purgeAll() {
        viewModelScope.launch {
            _error.value = null
            try {
                val currentContacts = _contacts.value
                var successCount = 0
                for (contact in currentContacts) {
                    val success = deletePurgeContact(contact.id)
                    if (success) successCount++
                }
                _actionMessage.value = "Permanently deleted $successCount contact(s)"
                loadDeletedContacts()
            } catch (e: Exception) {
                _error.value = "Failed to purge all: ${e.message}"
            }
        }
    }

    fun clearActionMessage() {
        _actionMessage.value = null
    }

    // ─── Private Network Calls ──────────────────────────────────────────────

    private suspend fun fetchDeletedContacts() {
        withContext(Dispatchers.IO) {
            try {
                val serverUrl = prefs.getString("server_url", null)
                if (serverUrl.isNullOrBlank()) {
                    _error.value = "No server URL configured"
                    return@withContext
                }

                val url = serverUrl.trimEnd('/') + "/api/trash/contacts"
                val request = Request.Builder().url(url).get().build()
                val response = okHttpClient.newCall(request).execute()

                if (response.isSuccessful) {
                    val body = response.body?.string()
                    if (body != null) {
                        val listType = object : TypeToken<List<DeletedContact>>() {}.type
                        val contactList: List<DeletedContact> = gson.fromJson(body, listType)
                        _contacts.value = contactList
                    } else {
                        _error.value = "Empty response from server"
                    }
                } else {
                    _error.value = "Unable to load deleted contacts (${response.code})"
                }
            } catch (e: Exception) {
                _error.value = "Network error: ${e.message ?: "Unable to reach server"}"
            }
        }
    }

    private suspend fun postRestoreContact(contactId: String): Boolean {
        return withContext(Dispatchers.IO) {
            val serverUrl = prefs.getString("server_url", null)
            if (serverUrl.isNullOrBlank()) {
                _error.value = "No server URL configured"
                return@withContext false
            }

            val url = serverUrl.trimEnd('/') + "/api/trash/contacts/$contactId/restore"
            val requestBody = "".toRequestBody("application/json".toMediaType())
            val request = Request.Builder().url(url).post(requestBody).build()
            val response = okHttpClient.newCall(request).execute()

            if (!response.isSuccessful) {
                _error.value = "Failed to restore contact (${response.code})"
                return@withContext false
            }
            true
        }
    }

    private suspend fun deletePurgeContact(contactId: String): Boolean {
        return withContext(Dispatchers.IO) {
            val serverUrl = prefs.getString("server_url", null)
            if (serverUrl.isNullOrBlank()) {
                _error.value = "No server URL configured"
                return@withContext false
            }

            val url = serverUrl.trimEnd('/') + "/api/trash/contacts/$contactId/purge"
            val request = Request.Builder().url(url).delete().build()
            val response = okHttpClient.newCall(request).execute()

            if (!response.isSuccessful) {
                _error.value = "Failed to purge contact (${response.code})"
                return@withContext false
            }
            true
        }
    }
}
