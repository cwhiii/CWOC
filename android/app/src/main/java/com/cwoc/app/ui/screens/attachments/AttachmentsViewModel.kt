package com.cwoc.app.ui.screens.attachments

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
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import javax.inject.Inject

// ─── Data Models ────────────────────────────────────────────────────────────────

data class AttachmentItem(
    @SerializedName("chit_id") val chitId: String,
    @SerializedName("attachment_id") val attachmentId: String,
    val filename: String,
    @SerializedName("content_type") val contentType: String,
    val size: Long,
    @SerializedName("created_datetime") val createdDatetime: String,
    val url: String
)

enum class AttachmentTypeFilter(val label: String) {
    All("All"),
    Images("Images"),
    Documents("Documents"),
    Audio("Audio"),
    Video("Video")
}

enum class AttachmentSort(val label: String) {
    DateNewest("Date (newest)"),
    DateOldest("Date (oldest)"),
    NameAZ("Name A-Z"),
    NameZA("Name Z-A"),
    SizeLargest("Size (largest)"),
    SizeSmallest("Size (smallest)")
}

// ─── ViewModel ──────────────────────────────────────────────────────────────────

@HiltViewModel
class AttachmentsViewModel @Inject constructor(
    private val okHttpClient: OkHttpClient,
    private val prefs: SharedPreferences,
    private val gson: Gson
) : ViewModel() {

    // ─── UI State ───────────────────────────────────────────────────────────

    private val _attachments = MutableStateFlow<List<AttachmentItem>>(emptyList())
    val attachments: StateFlow<List<AttachmentItem>> = _attachments.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    private val _typeFilter = MutableStateFlow(AttachmentTypeFilter.All)
    val typeFilter: StateFlow<AttachmentTypeFilter> = _typeFilter.asStateFlow()

    private val _sortOrder = MutableStateFlow(AttachmentSort.DateNewest)
    val sortOrder: StateFlow<AttachmentSort> = _sortOrder.asStateFlow()

    private val _sizeMinMb = MutableStateFlow<Float?>(null)
    val sizeMinMb: StateFlow<Float?> = _sizeMinMb.asStateFlow()

    private val _sizeMaxMb = MutableStateFlow<Float?>(null)
    val sizeMaxMb: StateFlow<Float?> = _sizeMaxMb.asStateFlow()

    private val _selectedIds = MutableStateFlow<Set<String>>(emptySet())
    val selectedIds: StateFlow<Set<String>> = _selectedIds.asStateFlow()

    private val _isMultiSelectMode = MutableStateFlow(false)
    val isMultiSelectMode: StateFlow<Boolean> = _isMultiSelectMode.asStateFlow()

    private val _actionMessage = MutableStateFlow<String?>(null)
    val actionMessage: StateFlow<String?> = _actionMessage.asStateFlow()

    init {
        loadAttachments()
    }

    // ─── Filtered & Sorted List ─────────────────────────────────────────────

    fun getFilteredAttachments(): List<AttachmentItem> {
        var list = _attachments.value

        // Apply type filter
        list = when (_typeFilter.value) {
            AttachmentTypeFilter.All -> list
            AttachmentTypeFilter.Images -> list.filter { it.contentType.startsWith("image/") }
            AttachmentTypeFilter.Documents -> list.filter {
                it.contentType.startsWith("application/") || it.contentType.startsWith("text/")
            }
            AttachmentTypeFilter.Audio -> list.filter { it.contentType.startsWith("audio/") }
            AttachmentTypeFilter.Video -> list.filter { it.contentType.startsWith("video/") }
        }

        // Apply search
        val query = _searchQuery.value.trim().lowercase()
        if (query.isNotEmpty()) {
            list = list.filter { it.filename.lowercase().contains(query) }
        }

        // Apply size range filter
        val minBytes = _sizeMinMb.value?.let { (it * 1048576).toLong() }
        val maxBytes = _sizeMaxMb.value?.let { (it * 1048576).toLong() }
        if (minBytes != null) {
            list = list.filter { it.size >= minBytes }
        }
        if (maxBytes != null) {
            list = list.filter { it.size <= maxBytes }
        }

        // Apply sort
        list = when (_sortOrder.value) {
            AttachmentSort.DateNewest -> list.sortedByDescending { it.createdDatetime }
            AttachmentSort.DateOldest -> list.sortedBy { it.createdDatetime }
            AttachmentSort.NameAZ -> list.sortedBy { it.filename.lowercase() }
            AttachmentSort.NameZA -> list.sortedByDescending { it.filename.lowercase() }
            AttachmentSort.SizeLargest -> list.sortedByDescending { it.size }
            AttachmentSort.SizeSmallest -> list.sortedBy { it.size }
        }

        return list
    }

    // ─── Public API ─────────────────────────────────────────────────────────

    fun loadAttachments() {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            try {
                fetchAttachments()
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun setSearchQuery(query: String) {
        _searchQuery.value = query
    }

    fun setTypeFilter(filter: AttachmentTypeFilter) {
        _typeFilter.value = filter
    }

    fun setSortOrder(sort: AttachmentSort) {
        _sortOrder.value = sort
    }

    fun setSizeMin(mb: Float?) {
        _sizeMinMb.value = mb
    }

    fun setSizeMax(mb: Float?) {
        _sizeMaxMb.value = mb
    }

    /**
     * Returns the download URL for an attachment (for opening in browser or share intent).
     */
    fun getDownloadUrl(attachment: AttachmentItem): String {
        val serverUrl = getServerUrl()
        return "$serverUrl/api/chits/${attachment.chitId}/attachments/${attachment.attachmentId}"
    }

    fun toggleSelection(attachmentId: String) {
        val current = _selectedIds.value.toMutableSet()
        if (current.contains(attachmentId)) {
            current.remove(attachmentId)
        } else {
            current.add(attachmentId)
        }
        _selectedIds.value = current
        if (current.isEmpty()) {
            _isMultiSelectMode.value = false
        }
    }

    fun enterMultiSelectMode(attachmentId: String) {
        _isMultiSelectMode.value = true
        _selectedIds.value = setOf(attachmentId)
    }

    fun exitMultiSelectMode() {
        _isMultiSelectMode.value = false
        _selectedIds.value = emptySet()
    }

    fun bulkDelete() {
        viewModelScope.launch {
            _error.value = null
            try {
                val selectedAttachments = _attachments.value.filter {
                    _selectedIds.value.contains(it.attachmentId)
                }
                val success = performBulkDelete(selectedAttachments)
                if (success) {
                    _actionMessage.value = "Deleted ${selectedAttachments.size} attachment(s)"
                    exitMultiSelectMode()
                    loadAttachments()
                }
            } catch (e: Exception) {
                _error.value = "Failed to delete: ${e.message}"
            }
        }
    }

    fun clearActionMessage() {
        _actionMessage.value = null
    }

    fun getServerUrl(): String {
        return prefs.getString("server_url", null)?.trimEnd('/') ?: ""
    }

    // ─── Private Network Calls ──────────────────────────────────────────────

    private suspend fun fetchAttachments() {
        withContext(Dispatchers.IO) {
            try {
                val serverUrl = prefs.getString("server_url", null)
                if (serverUrl.isNullOrBlank()) {
                    _error.value = "No server URL configured"
                    return@withContext
                }

                val url = serverUrl.trimEnd('/') + "/api/attachments"
                val request = Request.Builder().url(url).get().build()
                val response = okHttpClient.newCall(request).execute()

                if (response.isSuccessful) {
                    val body = response.body?.string()
                    if (body != null) {
                        val listType = object : TypeToken<List<AttachmentItem>>() {}.type
                        val attachmentList: List<AttachmentItem> = gson.fromJson(body, listType)
                        _attachments.value = attachmentList
                    } else {
                        _error.value = "Empty response from server"
                    }
                } else {
                    _error.value = "Unable to load attachments (${response.code})"
                }
            } catch (e: Exception) {
                _error.value = "Network error: ${e.message ?: "Unable to reach server"}"
            }
        }
    }

    private suspend fun performBulkDelete(attachments: List<AttachmentItem>): Boolean {
        return withContext(Dispatchers.IO) {
            val serverUrl = prefs.getString("server_url", null)
            if (serverUrl.isNullOrBlank()) {
                _error.value = "No server URL configured"
                return@withContext false
            }

            val payload = attachments.map { mapOf("chit_id" to it.chitId, "attachment_id" to it.attachmentId) }
            val json = gson.toJson(payload)

            val url = serverUrl.trimEnd('/') + "/api/attachments/bulk"
            val requestBody = json.toRequestBody("application/json".toMediaType())
            val request = Request.Builder().url(url).delete(requestBody).build()
            val response = okHttpClient.newCall(request).execute()

            if (!response.isSuccessful) {
                _error.value = "Failed to delete attachments (${response.code})"
                return@withContext false
            }
            true
        }
    }
}
