package com.cwoc.app.ui.screens.customobjects

import android.content.SharedPreferences
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.gson.Gson
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

data class CustomObjectField(
    val name: String,
    val value_type: String,  // "number", "text", "boolean", "select"
    val units: String? = null,
    val metric_units: String? = null,
    val min: Double? = null,
    val max: Double? = null,
    val options: List<String>? = null  // for "select" type
)

data class CustomObjectType(
    val id: String,
    val name: String,
    val fields: List<CustomObjectField>,
    val zone: String? = null,  // "indicators_zone", "graphs", etc.
    val sub_type: String? = null
)

// ─── ViewModel ──────────────────────────────────────────────────────────────────

/**
 * ViewModel for the Custom Objects Editor screen.
 * Fetches custom object type definitions from the server's /api/custom-objects endpoint
 * and provides CRUD operations. Uses OkHttp with the existing auth interceptor.
 */
@HiltViewModel
class CustomObjectsViewModel @Inject constructor(
    private val okHttpClient: OkHttpClient,
    private val prefs: SharedPreferences,
    private val gson: Gson
) : ViewModel() {

    // ─── UI State ───────────────────────────────────────────────────────────

    private val _objectTypes = MutableStateFlow<List<CustomObjectType>>(emptyList())
    val objectTypes: StateFlow<List<CustomObjectType>> = _objectTypes.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    // ─── Edit State ─────────────────────────────────────────────────────────

    private val _editingType = MutableStateFlow<CustomObjectType?>(null)
    val editingType: StateFlow<CustomObjectType?> = _editingType.asStateFlow()

    init {
        loadTypes()
    }

    // ─── Public API ─────────────────────────────────────────────────────────

    /**
     * Fetch all custom object types from the server.
     */
    fun loadTypes() {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            try {
                fetchTypes()
            } finally {
                _isLoading.value = false
            }
        }
    }

    /**
     * Create a new custom object type with the given name and fields.
     */
    fun createType(name: String, fields: List<CustomObjectField>) {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            try {
                postType(name, fields)
                fetchTypes()
            } finally {
                _isLoading.value = false
            }
        }
    }

    /**
     * Update an existing custom object type.
     */
    fun updateType(type: CustomObjectType) {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            try {
                putType(type)
                fetchTypes()
            } finally {
                _isLoading.value = false
            }
        }
    }

    /**
     * Delete a custom object type by ID.
     */
    fun deleteType(id: String) {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            try {
                deleteTypeById(id)
                fetchTypes()
            } finally {
                _isLoading.value = false
            }
        }
    }

    /**
     * Set the type currently being edited.
     */
    fun setEditing(type: CustomObjectType?) {
        _editingType.value = type
    }

    /**
     * Clear the editing state.
     */
    fun clearEditing() {
        _editingType.value = null
    }

    // ─── Private ────────────────────────────────────────────────────────────

    private fun getBaseUrl(): String? {
        val serverUrl = prefs.getString("server_url", null)
        if (serverUrl.isNullOrBlank()) {
            _error.value = "No server URL configured"
            return null
        }
        return serverUrl.trimEnd('/')
    }

    /**
     * GET /api/custom-objects — fetch all custom object types.
     */
    private suspend fun fetchTypes() {
        withContext(Dispatchers.IO) {
            try {
                val baseUrl = getBaseUrl() ?: return@withContext
                val url = "$baseUrl/api/custom-objects"

                val request = Request.Builder()
                    .url(url)
                    .get()
                    .build()

                val response = okHttpClient.newCall(request).execute()

                if (response.isSuccessful) {
                    val body = response.body?.string()
                    if (body != null) {
                        val listType = object : TypeToken<List<CustomObjectType>>() {}.type
                        val types: List<CustomObjectType> = gson.fromJson(body, listType)
                        _objectTypes.value = types
                    } else {
                        _error.value = "Empty response from server"
                    }
                } else {
                    _error.value = "Unable to load custom objects (${response.code})"
                }
            } catch (e: Exception) {
                _error.value = "Network error: ${e.message ?: "Unable to reach server"}"
            }
        }
    }

    /**
     * POST /api/custom-objects — create a new custom object type.
     */
    private suspend fun postType(name: String, fields: List<CustomObjectField>) {
        withContext(Dispatchers.IO) {
            try {
                val baseUrl = getBaseUrl() ?: return@withContext
                val url = "$baseUrl/api/custom-objects"

                val payload = mapOf("name" to name, "fields" to fields)
                val json = gson.toJson(payload)
                val requestBody = json.toRequestBody("application/json".toMediaType())

                val request = Request.Builder()
                    .url(url)
                    .post(requestBody)
                    .build()

                val response = okHttpClient.newCall(request).execute()

                if (!response.isSuccessful) {
                    _error.value = "Unable to create custom object (${response.code})"
                }
            } catch (e: Exception) {
                _error.value = "Network error: ${e.message ?: "Unable to reach server"}"
            }
        }
    }

    /**
     * PUT /api/custom-objects/{id} — update an existing custom object type.
     */
    private suspend fun putType(type: CustomObjectType) {
        withContext(Dispatchers.IO) {
            try {
                val baseUrl = getBaseUrl() ?: return@withContext
                val url = "$baseUrl/api/custom-objects/${type.id}"

                val json = gson.toJson(type)
                val requestBody = json.toRequestBody("application/json".toMediaType())

                val request = Request.Builder()
                    .url(url)
                    .put(requestBody)
                    .build()

                val response = okHttpClient.newCall(request).execute()

                if (!response.isSuccessful) {
                    _error.value = "Unable to update custom object (${response.code})"
                }
            } catch (e: Exception) {
                _error.value = "Network error: ${e.message ?: "Unable to reach server"}"
            }
        }
    }

    /**
     * DELETE /api/custom-objects/{id} — delete a custom object type.
     */
    private suspend fun deleteTypeById(id: String) {
        withContext(Dispatchers.IO) {
            try {
                val baseUrl = getBaseUrl() ?: return@withContext
                val url = "$baseUrl/api/custom-objects/$id"

                val request = Request.Builder()
                    .url(url)
                    .delete()
                    .build()

                val response = okHttpClient.newCall(request).execute()

                if (!response.isSuccessful) {
                    _error.value = "Unable to delete custom object (${response.code})"
                }
            } catch (e: Exception) {
                _error.value = "Network error: ${e.message ?: "Unable to reach server"}"
            }
        }
    }
}
