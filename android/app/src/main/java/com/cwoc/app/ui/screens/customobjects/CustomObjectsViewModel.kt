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

data class ZoneAssignment(
    val zone_id: String,
    val sort_order: Int = 0,
    val config: Map<String, Any?>? = null
)

data class CustomObject(
    val id: String,
    val name: String,
    val type: String,
    val sub_type: String? = null,
    val value_type: String = "boolean",  // "boolean", "integer", "decimal", "string"
    val units: String? = null,
    val metric_units: String? = null,
    val range_min: Double? = null,
    val range_max: Double? = null,
    val active: Boolean = true,
    val deleted: Boolean = false,
    val is_standard: Boolean = false,
    val zone_assignments: List<ZoneAssignment>? = null,
    val conditional_display: Map<String, Any?>? = null
)

data class CustomZone(
    val zone_id: String,
    val name: String,
    val sort_order: Int = 0,
    val object_count: Int = 0
)

data class ZoneObject(
    val id: String,
    val name: String,
    val type: String,
    val sub_type: String? = null,
    val value_type: String = "boolean",
    val units: String? = null,
    val metric_units: String? = null,
    val range_min: Double? = null,
    val range_max: Double? = null,
    val zone_sort_order: Int? = null,
    val zone_config: Map<String, Any?>? = null
)

// ─── ViewModel ──────────────────────────────────────────────────────────────────

/**
 * ViewModel for the Custom Objects Editor screen.
 * Matches the web implementation: flat object model with type/sub_type grouping,
 * active toggle, zone assignments, custom zones CRUD, and indicators zone management.
 */
@HiltViewModel
class CustomObjectsViewModel @Inject constructor(
    private val okHttpClient: OkHttpClient,
    private val prefs: SharedPreferences,
    private val gson: Gson
) : ViewModel() {

    // ─── UI State ───────────────────────────────────────────────────────────

    private val _allObjects = MutableStateFlow<List<CustomObject>>(emptyList())
    val allObjects: StateFlow<List<CustomObject>> = _allObjects.asStateFlow()

    private val _filteredObjects = MutableStateFlow<List<CustomObject>>(emptyList())
    val filteredObjects: StateFlow<List<CustomObject>> = _filteredObjects.asStateFlow()

    private val _customZones = MutableStateFlow<List<CustomZone>>(emptyList())
    val customZones: StateFlow<List<CustomZone>> = _customZones.asStateFlow()

    private val _indicatorObjects = MutableStateFlow<List<ZoneObject>>(emptyList())
    val indicatorObjects: StateFlow<List<ZoneObject>> = _indicatorObjects.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    // ─── Filter State ───────────────────────────────────────────────────────

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    private val _typeFilter = MutableStateFlow("")
    val typeFilter: StateFlow<String> = _typeFilter.asStateFlow()

    // ─── Zone Editor State ──────────────────────────────────────────────────

    private val _zoneEditorObjects = MutableStateFlow<List<ZoneObject>>(emptyList())
    val zoneEditorObjects: StateFlow<List<ZoneObject>> = _zoneEditorObjects.asStateFlow()

    init {
        loadAll()
    }

    // ─── Public API ─────────────────────────────────────────────────────────

    fun loadAll() {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            try {
                fetchObjects()
                fetchZones()
                fetchIndicators()
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun setSearchQuery(query: String) {
        _searchQuery.value = query
        applyFilters()
    }

    fun setTypeFilter(type: String) {
        _typeFilter.value = type
        applyFilters()
    }

    /**
     * Get unique types from all objects for the filter dropdown.
     */
    fun getAvailableTypes(): List<String> {
        return _allObjects.value
            .mapNotNull { it.type.ifBlank { null } }
            .distinct()
            .sorted()
    }

    /**
     * Toggle active state for an object.
     */
    fun toggleActive(objectId: String, newActive: Boolean) {
        viewModelScope.launch {
            try {
                val baseUrl = getBaseUrl() ?: return@launch
                val url = "$baseUrl/api/custom-objects/${objectId}"
                val payload = mapOf("active" to newActive)
                val json = gson.toJson(payload)
                val requestBody = json.toRequestBody("application/json".toMediaType())

                val request = Request.Builder().url(url).put(requestBody).build()
                val response = withContext(Dispatchers.IO) {
                    okHttpClient.newCall(request).execute()
                }

                if (response.isSuccessful) {
                    // Update local state
                    _allObjects.value = _allObjects.value.map {
                        if (it.id == objectId) it.copy(active = newActive) else it
                    }
                    applyFilters()
                }
            } catch (e: Exception) {
                _error.value = "Failed to update status: ${e.message}"
            }
        }
    }

    /**
     * Create a new custom object.
     */
    fun createObject(
        name: String,
        type: String,
        subType: String?,
        valueType: String,
        units: String?,
        metricUnits: String?,
        rangeMin: Double?,
        rangeMax: Double?,
        conditionalDisplay: Map<String, Any?>?
    ) {
        viewModelScope.launch {
            _isLoading.value = true
            try {
                val baseUrl = getBaseUrl() ?: return@launch
                val url = "$baseUrl/api/custom-objects"

                val payload = mutableMapOf<String, Any?>(
                    "name" to name,
                    "type" to type,
                    "value_type" to valueType
                )
                if (!subType.isNullOrBlank()) payload["sub_type"] = subType
                if (valueType == "integer" || valueType == "decimal") {
                    if (!units.isNullOrBlank()) payload["units"] = units
                    if (!metricUnits.isNullOrBlank()) payload["metric_units"] = metricUnits
                    if (rangeMin != null) payload["range_min"] = rangeMin
                    if (rangeMax != null) payload["range_max"] = rangeMax
                }
                if (conditionalDisplay != null) payload["conditional_display"] = conditionalDisplay

                val json = gson.toJson(payload)
                val requestBody = json.toRequestBody("application/json".toMediaType())
                val request = Request.Builder().url(url).post(requestBody).build()

                val response = withContext(Dispatchers.IO) {
                    okHttpClient.newCall(request).execute()
                }

                if (!response.isSuccessful) {
                    _error.value = "Failed to create object (${response.code})"
                } else {
                    fetchObjects()
                }
            } catch (e: Exception) {
                _error.value = "Network error: ${e.message}"
            } finally {
                _isLoading.value = false
            }
        }
    }

    /**
     * Update an existing custom object.
     */
    fun updateObject(
        id: String,
        name: String,
        type: String,
        subType: String?,
        valueType: String,
        units: String?,
        metricUnits: String?,
        rangeMin: Double?,
        rangeMax: Double?,
        conditionalDisplay: Map<String, Any?>?
    ) {
        viewModelScope.launch {
            _isLoading.value = true
            try {
                val baseUrl = getBaseUrl() ?: return@launch
                val url = "$baseUrl/api/custom-objects/$id"

                val payload = mutableMapOf<String, Any?>(
                    "name" to name,
                    "type" to type,
                    "value_type" to valueType
                )
                if (!subType.isNullOrBlank()) payload["sub_type"] = subType
                if (valueType == "integer" || valueType == "decimal") {
                    if (!units.isNullOrBlank()) payload["units"] = units
                    if (!metricUnits.isNullOrBlank()) payload["metric_units"] = metricUnits
                    if (rangeMin != null) payload["range_min"] = rangeMin
                    if (rangeMax != null) payload["range_max"] = rangeMax
                }
                if (conditionalDisplay != null) payload["conditional_display"] = conditionalDisplay

                val json = gson.toJson(payload)
                val requestBody = json.toRequestBody("application/json".toMediaType())
                val request = Request.Builder().url(url).put(requestBody).build()

                val response = withContext(Dispatchers.IO) {
                    okHttpClient.newCall(request).execute()
                }

                if (!response.isSuccessful) {
                    _error.value = "Failed to update object (${response.code})"
                } else {
                    fetchObjects()
                }
            } catch (e: Exception) {
                _error.value = "Network error: ${e.message}"
            } finally {
                _isLoading.value = false
            }
        }
    }

    /**
     * Soft-delete a custom object.
     */
    fun deleteObject(id: String) {
        viewModelScope.launch {
            try {
                val baseUrl = getBaseUrl() ?: return@launch
                val url = "$baseUrl/api/custom-objects/$id"
                val request = Request.Builder().url(url).delete().build()

                val response = withContext(Dispatchers.IO) {
                    okHttpClient.newCall(request).execute()
                }

                if (response.isSuccessful) {
                    fetchObjects()
                } else {
                    _error.value = "Failed to delete object (${response.code})"
                }
            } catch (e: Exception) {
                _error.value = "Network error: ${e.message}"
            }
        }
    }

    /**
     * Restore a soft-deleted standard object.
     */
    fun restoreObject(id: String) {
        viewModelScope.launch {
            try {
                val baseUrl = getBaseUrl() ?: return@launch
                val url = "$baseUrl/api/custom-objects/$id/restore"
                val request = Request.Builder().url(url).post(
                    "".toRequestBody("application/json".toMediaType())
                ).build()

                val response = withContext(Dispatchers.IO) {
                    okHttpClient.newCall(request).execute()
                }

                if (response.isSuccessful) {
                    fetchObjects()
                } else {
                    _error.value = "Failed to restore object (${response.code})"
                }
            } catch (e: Exception) {
                _error.value = "Network error: ${e.message}"
            }
        }
    }

    // ─── Custom Zones ───────────────────────────────────────────────────────

    fun createZone(name: String, onSuccess: (CustomZone) -> Unit = {}) {
        viewModelScope.launch {
            try {
                val baseUrl = getBaseUrl() ?: return@launch
                val url = "$baseUrl/api/custom-zones"
                val payload = mapOf("name" to name)
                val json = gson.toJson(payload)
                val requestBody = json.toRequestBody("application/json".toMediaType())
                val request = Request.Builder().url(url).post(requestBody).build()

                val response = withContext(Dispatchers.IO) {
                    okHttpClient.newCall(request).execute()
                }

                if (response.isSuccessful) {
                    val body = response.body?.string()
                    if (body != null) {
                        val zone = gson.fromJson(body, CustomZone::class.java)
                        fetchZones()
                        onSuccess(zone)
                    }
                } else if (response.code == 409) {
                    _error.value = "A zone with this name already exists"
                } else {
                    _error.value = "Failed to create zone (${response.code})"
                }
            } catch (e: Exception) {
                _error.value = "Network error: ${e.message}"
            }
        }
    }

    fun deleteZone(zoneId: String) {
        viewModelScope.launch {
            try {
                val baseUrl = getBaseUrl() ?: return@launch
                val url = "$baseUrl/api/custom-zones/$zoneId"
                val request = Request.Builder().url(url).delete().build()

                val response = withContext(Dispatchers.IO) {
                    okHttpClient.newCall(request).execute()
                }

                if (response.isSuccessful) {
                    fetchZones()
                } else {
                    _error.value = "Failed to delete zone (${response.code})"
                }
            } catch (e: Exception) {
                _error.value = "Network error: ${e.message}"
            }
        }
    }

    fun renameZone(zoneId: String, newName: String) {
        viewModelScope.launch {
            try {
                val baseUrl = getBaseUrl() ?: return@launch
                val url = "$baseUrl/api/custom-zones/$zoneId"
                val payload = mapOf("name" to newName)
                val json = gson.toJson(payload)
                val requestBody = json.toRequestBody("application/json".toMediaType())
                val request = Request.Builder().url(url).put(requestBody).build()

                val response = withContext(Dispatchers.IO) {
                    okHttpClient.newCall(request).execute()
                }

                if (response.isSuccessful) {
                    fetchZones()
                } else {
                    _error.value = "Failed to rename zone (${response.code})"
                }
            } catch (e: Exception) {
                _error.value = "Network error: ${e.message}"
            }
        }
    }

    fun reorderZones(orderedZoneIds: List<String>) {
        viewModelScope.launch {
            try {
                val baseUrl = getBaseUrl() ?: return@launch
                orderedZoneIds.forEachIndexed { idx, zoneId ->
                    val url = "$baseUrl/api/custom-zones/$zoneId"
                    val payload = mapOf("sort_order" to idx + 1)
                    val json = gson.toJson(payload)
                    val requestBody = json.toRequestBody("application/json".toMediaType())
                    val request = Request.Builder().url(url).put(requestBody).build()
                    withContext(Dispatchers.IO) {
                        okHttpClient.newCall(request).execute()
                    }
                }
                fetchZones()
            } catch (e: Exception) {
                _error.value = "Failed to reorder zones: ${e.message}"
            }
        }
    }

    // ─── Zone Editor ────────────────────────────────────────────────────────

    fun loadZoneObjects(zoneId: String) {
        viewModelScope.launch {
            try {
                val baseUrl = getBaseUrl() ?: return@launch
                val url = "$baseUrl/api/custom-objects/zone/$zoneId"
                val request = Request.Builder().url(url).get().build()

                val response = withContext(Dispatchers.IO) {
                    okHttpClient.newCall(request).execute()
                }

                if (response.isSuccessful) {
                    val body = response.body?.string()
                    if (body != null) {
                        val listType = object : TypeToken<List<ZoneObject>>() {}.type
                        val objects: List<ZoneObject> = gson.fromJson(body, listType)
                        _zoneEditorObjects.value = objects
                    }
                }
            } catch (e: Exception) {
                _error.value = "Failed to load zone objects: ${e.message}"
            }
        }
    }

    fun addObjectToZone(objectId: String, zoneId: String, sortOrder: Int = 0) {
        viewModelScope.launch {
            try {
                val baseUrl = getBaseUrl() ?: return@launch
                val url = "$baseUrl/api/custom-objects/$objectId/assign"
                val payload = mapOf("zone_id" to zoneId, "sort_order" to sortOrder)
                val json = gson.toJson(payload)
                val requestBody = json.toRequestBody("application/json".toMediaType())
                val request = Request.Builder().url(url).post(requestBody).build()

                val response = withContext(Dispatchers.IO) {
                    okHttpClient.newCall(request).execute()
                }

                if (response.isSuccessful) {
                    loadZoneObjects(zoneId)
                } else {
                    _error.value = "Failed to add object to zone (${response.code})"
                }
            } catch (e: Exception) {
                _error.value = "Network error: ${e.message}"
            }
        }
    }

    fun removeObjectFromZone(objectId: String, zoneId: String) {
        viewModelScope.launch {
            try {
                val baseUrl = getBaseUrl() ?: return@launch
                val url = "$baseUrl/api/custom-objects/$objectId/assign/$zoneId"
                val request = Request.Builder().url(url).delete().build()

                val response = withContext(Dispatchers.IO) {
                    okHttpClient.newCall(request).execute()
                }

                if (response.isSuccessful) {
                    loadZoneObjects(zoneId)
                } else {
                    _error.value = "Failed to remove object from zone (${response.code})"
                }
            } catch (e: Exception) {
                _error.value = "Network error: ${e.message}"
            }
        }
    }

    fun reorderZoneObjects(zoneId: String, orderedObjectIds: List<String>) {
        viewModelScope.launch {
            try {
                val baseUrl = getBaseUrl() ?: return@launch
                val url = "$baseUrl/api/custom-objects/zone/$zoneId/reorder"
                val payload = mapOf("object_ids" to orderedObjectIds)
                val json = gson.toJson(payload)
                val requestBody = json.toRequestBody("application/json".toMediaType())
                val request = Request.Builder().url(url).put(requestBody).build()

                val response = withContext(Dispatchers.IO) {
                    okHttpClient.newCall(request).execute()
                }

                if (response.isSuccessful) {
                    loadZoneObjects(zoneId)
                }
            } catch (e: Exception) {
                _error.value = "Failed to reorder objects: ${e.message}"
            }
        }
    }

    /**
     * Get available objects for adding to a zone (active, not deleted, not already assigned).
     */
    fun getAvailableObjectsForZone(zoneId: String): List<CustomObject> {
        val assignedIds = _zoneEditorObjects.value.map { it.id }.toSet()
        return _allObjects.value.filter { obj ->
            obj.active && !obj.deleted && obj.id !in assignedIds
        }
    }

    // ─── Indicators Zone ────────────────────────────────────────────────────

    fun reorderIndicators(orderedObjectIds: List<String>) {
        viewModelScope.launch {
            try {
                val baseUrl = getBaseUrl() ?: return@launch
                val url = "$baseUrl/api/custom-objects/zone/indicators_zone/reorder"
                val payload = mapOf("object_ids" to orderedObjectIds)
                val json = gson.toJson(payload)
                val requestBody = json.toRequestBody("application/json".toMediaType())
                val request = Request.Builder().url(url).put(requestBody).build()

                val response = withContext(Dispatchers.IO) {
                    okHttpClient.newCall(request).execute()
                }

                if (response.isSuccessful) {
                    fetchIndicators()
                }
            } catch (e: Exception) {
                _error.value = "Failed to reorder indicators: ${e.message}"
            }
        }
    }

    fun clearError() {
        _error.value = null
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

    private fun applyFilters() {
        val typeVal = _typeFilter.value
        val searchVal = _searchQuery.value.trim().lowercase()

        _filteredObjects.value = _allObjects.value.filter { obj ->
            if (typeVal.isNotBlank() && obj.type != typeVal) return@filter false
            if (searchVal.isNotBlank() && !obj.name.lowercase().contains(searchVal)) return@filter false
            true
        }
    }

    private suspend fun fetchObjects() {
        withContext(Dispatchers.IO) {
            try {
                val baseUrl = getBaseUrl() ?: return@withContext
                val url = "$baseUrl/api/custom-objects"
                val request = Request.Builder().url(url).get().build()
                val response = okHttpClient.newCall(request).execute()

                if (response.isSuccessful) {
                    val body = response.body?.string()
                    if (body != null) {
                        val listType = object : TypeToken<List<CustomObject>>() {}.type
                        val objects: List<CustomObject> = gson.fromJson(body, listType)
                        _allObjects.value = objects
                        applyFilters()
                    }
                } else {
                    _error.value = "Unable to load custom objects (${response.code})"
                }
            } catch (e: Exception) {
                _error.value = "Network error: ${e.message ?: "Unable to reach server"}"
            }
        }
    }

    private suspend fun fetchZones() {
        withContext(Dispatchers.IO) {
            try {
                val baseUrl = getBaseUrl() ?: return@withContext
                val url = "$baseUrl/api/custom-zones"
                val request = Request.Builder().url(url).get().build()
                val response = okHttpClient.newCall(request).execute()

                if (response.isSuccessful) {
                    val body = response.body?.string()
                    if (body != null) {
                        val listType = object : TypeToken<List<CustomZone>>() {}.type
                        val zones: List<CustomZone> = gson.fromJson(body, listType)
                        _customZones.value = zones
                    }
                }
            } catch (e: Exception) {
                // Non-critical — zones section just won't show
            }
        }
    }

    private suspend fun fetchIndicators() {
        withContext(Dispatchers.IO) {
            try {
                val baseUrl = getBaseUrl() ?: return@withContext
                val url = "$baseUrl/api/custom-objects/zone/indicators_zone"
                val request = Request.Builder().url(url).get().build()
                val response = okHttpClient.newCall(request).execute()

                if (response.isSuccessful) {
                    val body = response.body?.string()
                    if (body != null) {
                        val listType = object : TypeToken<List<ZoneObject>>() {}.type
                        val objects: List<ZoneObject> = gson.fromJson(body, listType)
                        _indicatorObjects.value = objects
                    }
                }
            } catch (e: Exception) {
                // Non-critical — indicators section just won't show
            }
        }
    }
}
