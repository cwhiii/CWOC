package com.cwoc.app.ui.screens.auditlog

import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import androidx.core.content.FileProvider
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.gson.Gson
import com.google.gson.annotations.SerializedName
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import javax.inject.Inject

// ─── Data Models ────────────────────────────────────────────────────────────────

/**
 * A single field-level change within an audit entry.
 */
data class AuditChange(
    val field: String,
    @SerializedName("old") val oldValue: String?,
    @SerializedName("new") val newValue: String?
)

/**
 * A single audit log entry from the server.
 */
data class AuditEntry(
    val id: String,
    val timestamp: String,
    val actor: String?,
    @SerializedName("actor_display_name") val actorDisplayName: String?,
    val action: String,
    @SerializedName("entity_type") val entityType: String,
    @SerializedName("entity_id") val entityId: String?,
    @SerializedName("entity_summary") val entityTitle: String?,
    val changes: List<AuditChange>?
)

/**
 * Server response shape for GET /api/audit-log.
 */
private data class AuditLogResponse(
    val entries: List<AuditEntry>,
    val total: Int
)

// ─── ViewModel ──────────────────────────────────────────────────────────────────

/**
 * ViewModel for the Audit Log screen.
 * Fetches audit entries from the server's /api/audit-log endpoint using OkHttp
 * with the existing auth interceptor. Supports filtering by entity type, actor,
 * date range, and pagination.
 */
@HiltViewModel
class AuditLogViewModel @Inject constructor(
    private val okHttpClient: OkHttpClient,
    private val prefs: SharedPreferences,
    private val gson: Gson,
    @ApplicationContext private val appContext: Context
) : ViewModel() {

    // ─── UI State ───────────────────────────────────────────────────────────

    private val _entries = MutableStateFlow<List<AuditEntry>>(emptyList())
    val entries: StateFlow<List<AuditEntry>> = _entries.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    // ─── Filter State ───────────────────────────────────────────────────────

    private val _entityTypeFilter = MutableStateFlow("")
    val entityTypeFilter: StateFlow<String> = _entityTypeFilter.asStateFlow()

    private val _actorFilter = MutableStateFlow("")
    val actorFilter: StateFlow<String> = _actorFilter.asStateFlow()

    private val _sinceFilter = MutableStateFlow<String?>(null)
    val sinceFilter: StateFlow<String?> = _sinceFilter.asStateFlow()

    private val _untilFilter = MutableStateFlow<String?>(null)
    val untilFilter: StateFlow<String?> = _untilFilter.asStateFlow()

    // ─── Pagination State ───────────────────────────────────────────────────

    private val _offset = MutableStateFlow(0)
    val offset: StateFlow<Int> = _offset.asStateFlow()

    private val _limit = MutableStateFlow(50)
    val limit: StateFlow<Int> = _limit.asStateFlow()

    private val _total = MutableStateFlow(0)
    val total: StateFlow<Int> = _total.asStateFlow()

    // ─── Sort State ─────────────────────────────────────────────────────────

    private val _sortBy = MutableStateFlow("timestamp")
    val sortBy: StateFlow<String> = _sortBy.asStateFlow()

    private val _sortOrder = MutableStateFlow("desc")
    val sortOrder: StateFlow<String> = _sortOrder.asStateFlow()

    // ─── Export State ───────────────────────────────────────────────────────

    private val _isExporting = MutableStateFlow(false)
    val isExporting: StateFlow<Boolean> = _isExporting.asStateFlow()

    // ─── Unique Actors (derived from loaded entries) ────────────────────────

    private val _uniqueActors = MutableStateFlow<List<String>>(emptyList())
    val uniqueActors: StateFlow<List<String>> = _uniqueActors.asStateFlow()

    init {
        loadEntries()
    }

    // ─── Public API ─────────────────────────────────────────────────────────

    /**
     * Fetch audit log entries from the server with current filters and pagination.
     */
    fun loadEntries() {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            try {
                fetchEntries()
            } finally {
                _isLoading.value = false
            }
        }
    }

    /**
     * Set the entity type filter and reload entries from the beginning.
     * Pass empty string for "all" types.
     */
    fun setEntityTypeFilter(type: String) {
        _entityTypeFilter.value = type
        _offset.value = 0
        loadEntries()
    }

    /**
     * Set the actor filter and reload entries from the beginning.
     * Pass empty string for "all" actors.
     */
    fun setActorFilter(actor: String) {
        _actorFilter.value = actor
        _offset.value = 0
        loadEntries()
    }

    /**
     * Set the date range filter and reload entries from the beginning.
     * Pass null for either param to leave that bound open.
     */
    fun setDateRange(since: String?, until: String?) {
        _sinceFilter.value = since
        _untilFilter.value = until
        _offset.value = 0
        loadEntries()
    }

    /**
     * Set sort parameters and reload.
     */
    fun setSort(sortBy: String, sortOrder: String) {
        _sortBy.value = sortBy
        _sortOrder.value = sortOrder
        _offset.value = 0
        loadEntries()
    }

    /**
     * Set page size (limit) and reload from the beginning.
     */
    fun setPageSize(size: Int) {
        _limit.value = size
        _offset.value = 0
        loadEntries()
    }

    /**
     * Navigate to the next page of results.
     */
    fun nextPage() {
        val newOffset = _offset.value + _limit.value
        if (newOffset < _total.value) {
            _offset.value = newOffset
            loadEntries()
        }
    }

    /**
     * Navigate to the previous page of results.
     */
    fun previousPage() {
        val newOffset = (_offset.value - _limit.value).coerceAtLeast(0)
        if (newOffset != _offset.value) {
            _offset.value = newOffset
            loadEntries()
        }
    }

    /**
     * Export audit log as CSV with current filters applied.
     * Downloads the CSV from the server and opens the Android share sheet.
     */
    fun exportCsv() {
        viewModelScope.launch {
            _isExporting.value = true
            try {
                withContext(Dispatchers.IO) {
                    val serverUrl = prefs.getString("server_url", null)
                    if (serverUrl.isNullOrBlank()) return@withContext

                    val baseUrl = serverUrl.trimEnd('/') + "/api/audit-log"
                    val urlBuilder = baseUrl.toHttpUrlOrNull()?.newBuilder() ?: return@withContext

                    // Add current filters
                    if (_entityTypeFilter.value.isNotBlank()) {
                        urlBuilder.addQueryParameter("entity_type", _entityTypeFilter.value)
                    }
                    if (_actorFilter.value.isNotBlank()) {
                        urlBuilder.addQueryParameter("actor", _actorFilter.value)
                    }
                    _sinceFilter.value?.let { urlBuilder.addQueryParameter("since", it) }
                    _untilFilter.value?.let { urlBuilder.addQueryParameter("until", it) }
                    urlBuilder.addQueryParameter("sort_by", _sortBy.value)
                    urlBuilder.addQueryParameter("sort_order", _sortOrder.value)
                    urlBuilder.addQueryParameter("format", "csv")

                    val request = Request.Builder()
                        .url(urlBuilder.build())
                        .get()
                        .build()

                    val response = okHttpClient.newCall(request).execute()

                    if (response.isSuccessful) {
                        val body = response.body?.bytes() ?: return@withContext

                        // Write to cache dir for sharing
                        val shareDir = File(appContext.cacheDir, "shared")
                        shareDir.mkdirs()
                        val csvFile = File(shareDir, "audit-log.csv")
                        csvFile.writeBytes(body)

                        // Create share intent via FileProvider
                        val uri = FileProvider.getUriForFile(
                            appContext,
                            "${appContext.packageName}.fileprovider",
                            csvFile
                        )

                        val shareIntent = Intent(Intent.ACTION_SEND).apply {
                            type = "text/csv"
                            putExtra(Intent.EXTRA_STREAM, uri)
                            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        }

                        appContext.startActivity(
                            Intent.createChooser(shareIntent, "Share Audit Log CSV")
                                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        )
                    }
                }
            } finally {
                _isExporting.value = false
            }
        }
    }

    // ─── Private ────────────────────────────────────────────────────────────

    /**
     * Performs the actual HTTP request to GET /api/audit-log with query parameters.
     * Uses the injected OkHttpClient which already has the AuthInterceptor attached.
     */
    private suspend fun fetchEntries() {
        withContext(Dispatchers.IO) {
            try {
                val serverUrl = prefs.getString("server_url", null)
                if (serverUrl.isNullOrBlank()) {
                    _error.value = "No server URL configured"
                    return@withContext
                }

                val baseUrl = serverUrl.trimEnd('/') + "/api/audit-log"
                val urlBuilder = baseUrl.toHttpUrlOrNull()?.newBuilder()
                if (urlBuilder == null) {
                    _error.value = "Invalid server URL"
                    return@withContext
                }

                // Add query parameters
                if (_entityTypeFilter.value.isNotBlank()) {
                    urlBuilder.addQueryParameter("entity_type", _entityTypeFilter.value)
                }
                if (_actorFilter.value.isNotBlank()) {
                    urlBuilder.addQueryParameter("actor", _actorFilter.value)
                }
                _sinceFilter.value?.let { urlBuilder.addQueryParameter("since", it) }
                _untilFilter.value?.let { urlBuilder.addQueryParameter("until", it) }
                urlBuilder.addQueryParameter("offset", _offset.value.toString())
                urlBuilder.addQueryParameter("limit", _limit.value.toString())
                urlBuilder.addQueryParameter("sort_by", _sortBy.value)
                urlBuilder.addQueryParameter("sort_order", _sortOrder.value)

                val request = Request.Builder()
                    .url(urlBuilder.build())
                    .get()
                    .build()

                val response = okHttpClient.newCall(request).execute()

                if (response.isSuccessful) {
                    val body = response.body?.string()
                    if (body != null) {
                        val auditResponse = gson.fromJson(body, AuditLogResponse::class.java)
                        _entries.value = auditResponse.entries
                        _total.value = auditResponse.total

                        // Extract unique actors for the filter dropdown
                        val actors = auditResponse.entries
                            .mapNotNull { it.actorDisplayName ?: it.actor }
                            .distinct()
                            .sorted()
                        // Merge with existing actors to accumulate across pages
                        val merged = (_uniqueActors.value + actors).distinct().sorted()
                        _uniqueActors.value = merged
                    } else {
                        _error.value = "Empty response from server"
                    }
                } else {
                    _error.value = "Unable to load audit log (${response.code})"
                }
            } catch (e: Exception) {
                _error.value = "Network error: ${e.message ?: "Unable to reach server"}"
            }
        }
    }
}
