package com.cwoc.app.ui.screens.adminchits

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

data class AdminChitItem(
    val id: String,
    val title: String?,
    @SerializedName("owner_id") val ownerId: String?,
    @SerializedName("owner_username") val ownerUsername: String?,
    @SerializedName("assigned_to") val assignedTo: String?,
    @SerializedName("assigned_to_username") val assignedToUsername: String?,
    val status: String?,
    val deleted: Boolean = false,
    val attachments: Any? = null,
    @SerializedName("modified_datetime") val modifiedDatetime: String?,
    @SerializedName("created_datetime") val createdDatetime: String?,
    val tags: List<String>?
)

data class AdminChitsUiState(
    val chits: List<AdminChitItem> = emptyList(),
    val isLoading: Boolean = false,
    val error: String? = null,
    val actionMessage: String? = null,
    val ownerFilter: String = "",
    val statusFilter: String = "",
    val searchQuery: String = "",
    val showDeleted: Boolean = false,
    val owners: List<String> = emptyList(),
    val offset: Int = 0,
    val limit: Int = 25,
    val hasMore: Boolean = false,
    val selectedIds: Set<String> = emptySet(),
    val isSelectionMode: Boolean = false
)

// ─── ViewModel ──────────────────────────────────────────────────────────────────

@HiltViewModel
class AdminChitsViewModel @Inject constructor(
    private val okHttpClient: OkHttpClient,
    private val prefs: SharedPreferences,
    private val gson: Gson
) : ViewModel() {

    private val _uiState = MutableStateFlow(AdminChitsUiState())
    val uiState: StateFlow<AdminChitsUiState> = _uiState.asStateFlow()

    init {
        loadChits()
    }

    // ─── Public API ─────────────────────────────────────────────────────────

    fun loadChits() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            try {
                fetchChits()
            } finally {
                _uiState.value = _uiState.value.copy(isLoading = false)
            }
        }
    }

    fun setOwnerFilter(owner: String) {
        _uiState.value = _uiState.value.copy(ownerFilter = owner, offset = 0)
        loadChits()
    }

    fun setSearchQuery(query: String) {
        _uiState.value = _uiState.value.copy(searchQuery = query, offset = 0)
        loadChits()
    }

    fun setStatusFilter(status: String) {
        _uiState.value = _uiState.value.copy(statusFilter = status, offset = 0)
        loadChits()
    }

    fun setShowDeleted(show: Boolean) {
        _uiState.value = _uiState.value.copy(showDeleted = show, offset = 0)
        loadChits()
    }

    fun nextPage() {
        val state = _uiState.value
        if (state.hasMore) {
            _uiState.value = state.copy(offset = state.offset + state.limit)
            loadChits()
        }
    }

    fun previousPage() {
        val state = _uiState.value
        if (state.offset > 0) {
            _uiState.value = state.copy(offset = maxOf(0, state.offset - state.limit))
            loadChits()
        }
    }

    fun toggleSelection(chitId: String) {
        val state = _uiState.value
        val newSelected = if (chitId in state.selectedIds) {
            state.selectedIds - chitId
        } else {
            state.selectedIds + chitId
        }
        _uiState.value = state.copy(
            selectedIds = newSelected,
            isSelectionMode = newSelected.isNotEmpty()
        )
    }

    fun enterSelectionMode(chitId: String) {
        _uiState.value = _uiState.value.copy(
            isSelectionMode = true,
            selectedIds = setOf(chitId)
        )
    }

    fun clearSelection() {
        _uiState.value = _uiState.value.copy(
            isSelectionMode = false,
            selectedIds = emptySet()
        )
    }

    fun bulkDelete() {
        val ids = _uiState.value.selectedIds.toList()
        if (ids.isEmpty()) return
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(error = null)
            try {
                val success = executeBulkAction(ids, "delete", null)
                if (success) {
                    _uiState.value = _uiState.value.copy(
                        actionMessage = "Deleted ${ids.size} chit(s)",
                        isSelectionMode = false,
                        selectedIds = emptySet()
                    )
                    loadChits()
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(error = "Failed to delete: ${e.message}")
            }
        }
    }

    fun bulkChangeOwner(newOwner: String) {
        val ids = _uiState.value.selectedIds.toList()
        if (ids.isEmpty()) return
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(error = null)
            try {
                val success = executeBulkAction(ids, "change_owner", newOwner)
                if (success) {
                    _uiState.value = _uiState.value.copy(
                        actionMessage = "Changed owner for ${ids.size} chit(s)",
                        isSelectionMode = false,
                        selectedIds = emptySet()
                    )
                    loadChits()
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(error = "Failed to change owner: ${e.message}")
            }
        }
    }

    fun bulkChangeStatus(newStatus: String) {
        val ids = _uiState.value.selectedIds.toList()
        if (ids.isEmpty()) return
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(error = null)
            try {
                val success = executeBulkAction(ids, "change_status", newStatus)
                if (success) {
                    _uiState.value = _uiState.value.copy(
                        actionMessage = "Changed status for ${ids.size} chit(s)",
                        isSelectionMode = false,
                        selectedIds = emptySet()
                    )
                    loadChits()
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(error = "Failed to change status: ${e.message}")
            }
        }
    }

    fun bulkChangePriority(newPriority: String) {
        val ids = _uiState.value.selectedIds.toList()
        if (ids.isEmpty()) return
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(error = null)
            try {
                val success = executeBulkAction(ids, "change_priority", newPriority)
                if (success) {
                    _uiState.value = _uiState.value.copy(
                        actionMessage = "Changed priority for ${ids.size} chit(s)",
                        isSelectionMode = false,
                        selectedIds = emptySet()
                    )
                    loadChits()
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(error = "Failed to change priority: ${e.message}")
            }
        }
    }

    fun bulkUndelete() {
        val ids = _uiState.value.selectedIds.toList()
        if (ids.isEmpty()) return
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(error = null)
            try {
                val success = executeBulkAction(ids, "undelete", null)
                if (success) {
                    _uiState.value = _uiState.value.copy(
                        actionMessage = "Restored ${ids.size} chit(s)",
                        isSelectionMode = false,
                        selectedIds = emptySet()
                    )
                    loadChits()
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(error = "Failed to restore: ${e.message}")
            }
        }
    }

    fun clearActionMessage() {
        _uiState.value = _uiState.value.copy(actionMessage = null)
    }

    // ─── Private Network Calls ──────────────────────────────────────────────

    private suspend fun fetchChits() {
        withContext(Dispatchers.IO) {
            try {
                val serverUrl = prefs.getString("server_url", null)
                if (serverUrl.isNullOrBlank()) {
                    _uiState.value = _uiState.value.copy(error = "No server URL configured")
                    return@withContext
                }

                val state = _uiState.value
                val urlBuilder = StringBuilder(serverUrl.trimEnd('/') + "/api/admin/chits")
                val params = mutableListOf<String>()
                if (state.searchQuery.isNotBlank()) {
                    params.add("q=${state.searchQuery}")
                }
                if (state.ownerFilter.isNotBlank()) {
                    params.add("owner_id=${state.ownerFilter}")
                }
                params.add("limit=1000")
                if (params.isNotEmpty()) {
                    urlBuilder.append("?${params.joinToString("&")}")
                }

                val request = Request.Builder().url(urlBuilder.toString()).get().build()
                val response = okHttpClient.newCall(request).execute()

                if (response.isSuccessful) {
                    val body = response.body?.string()
                    if (body != null) {
                        val listType = object : TypeToken<List<AdminChitItem>>() {}.type
                        val chitList: List<AdminChitItem> = gson.fromJson(body, listType)

                        // Client-side filters (matching web behavior)
                        var display = chitList.toList()
                        if (!state.showDeleted) {
                            display = display.filter { !it.deleted }
                        }
                        if (state.statusFilter.isNotBlank()) {
                            display = display.filter { it.status == state.statusFilter }
                        }

                        // Extract unique owners for filter dropdown
                        val allOwners = chitList.mapNotNull { it.ownerUsername }.distinct().sorted()
                        val currentOwners = if (_uiState.value.owners.isEmpty()) allOwners else _uiState.value.owners
                        _uiState.value = _uiState.value.copy(
                            chits = display,
                            owners = if (state.ownerFilter.isBlank()) allOwners else currentOwners,
                            hasMore = display.size >= state.limit
                        )
                    } else {
                        _uiState.value = _uiState.value.copy(error = "Empty response from server")
                    }
                } else {
                    _uiState.value = _uiState.value.copy(
                        error = "Unable to load chits (${response.code})"
                    )
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    error = "Network error: ${e.message ?: "Unable to reach server"}"
                )
            }
        }
    }

    private suspend fun executeBulkAction(
        chitIds: List<String>,
        action: String,
        value: String?
    ): Boolean {
        return withContext(Dispatchers.IO) {
            val serverUrl = prefs.getString("server_url", null)
            if (serverUrl.isNullOrBlank()) {
                _uiState.value = _uiState.value.copy(error = "No server URL configured")
                return@withContext false
            }

            // Build the updates map matching the server's BulkUpdateRequest format:
            // POST /api/admin/chits/bulk-update with { chit_ids: [...], updates: { field: value } }
            val updates = mutableMapOf<String, Any?>()
            when (action) {
                "delete" -> updates["deleted"] = true
                "undelete" -> updates["deleted"] = false
                "change_owner" -> updates["owner_id"] = value
                "change_status" -> updates["status"] = value
                "change_priority" -> updates["priority"] = value
            }

            val bodyMap = mapOf(
                "chit_ids" to chitIds,
                "updates" to updates
            )

            val json = gson.toJson(bodyMap)
            val url = serverUrl.trimEnd('/') + "/api/admin/chits/bulk-update"
            val requestBody = json.toRequestBody("application/json".toMediaType())
            val request = Request.Builder().url(url).post(requestBody).build()
            val response = okHttpClient.newCall(request).execute()

            if (!response.isSuccessful) {
                _uiState.value = _uiState.value.copy(
                    error = "Bulk action failed (${response.code})"
                )
                return@withContext false
            }
            true
        }
    }
}
