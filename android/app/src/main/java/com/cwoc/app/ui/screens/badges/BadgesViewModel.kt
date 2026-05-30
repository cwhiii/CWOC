package com.cwoc.app.ui.screens.badges

import android.content.SharedPreferences
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cwoc.app.data.local.dao.BadgeDao
import com.cwoc.app.data.local.entity.BadgeEntity
import com.cwoc.app.data.repository.SettingsRepository
import com.cwoc.app.data.sync.ConnectivityEvent
import com.cwoc.app.data.sync.ConnectivityMonitor
import com.google.gson.Gson
import com.google.gson.annotations.SerializedName
import com.google.gson.reflect.TypeToken
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.time.Instant
import javax.inject.Inject

// ─── API Response DTOs ──────────────────────────────────────────────────────────

/**
 * Server response from GET /api/badges.
 */
data class BadgesResponse(
    val badges: List<BadgeDto> = emptyList(),
    val counts: BadgeCounts? = null
)

data class BadgeCounts(
    val active: Int = 0,
    val completed: Int = 0
)

/**
 * A single badge from the server API response.
 */
data class BadgeDto(
    val id: String,
    @SerializedName("chit_id") val chitId: String,
    val category: String,
    @SerializedName("provider_name") val providerName: String,
    val code: String,
    val url: String,
    val icon: String?,
    val label: String,
    val status: String,
    @SerializedName("detected_at") val detectedAt: String,
    @SerializedName("last_updated_at") val lastUpdatedAt: String,
    @SerializedName("completed_at") val completedAt: String?,
    @SerializedName("last_email_subject") val lastEmailSubject: String?
)

// ─── ViewModel ──────────────────────────────────────────────────────────────────

/**
 * ViewModel for the Badges screen.
 *
 * Exposes cached badges from Room as a reactive StateFlow. On init, if online,
 * fetches fresh data from GET /api/badges and updates the local cache.
 * Supports offline dismiss (optimistic local update + queued API call),
 * pull-to-refresh, and reads settings for completed_window and time format.
 */
@HiltViewModel
class BadgesViewModel @Inject constructor(
    private val badgeDao: BadgeDao,
    private val settingsRepository: SettingsRepository,
    private val connectivityMonitor: ConnectivityMonitor,
    private val prefs: SharedPreferences,
    private val gson: Gson,
    private val okHttpClient: OkHttpClient
) : ViewModel() {

    companion object {
        private const val TAG = "BadgesVM"
        private const val PREF_KEY_QUEUED_DISMISSALS = "badges_queued_dismissals"
    }

    // ─── UI State ───────────────────────────────────────────────────────────

    private val _badges = MutableStateFlow<List<BadgeEntity>>(emptyList())
    val badges: StateFlow<List<BadgeEntity>> = _badges.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _isRefreshing = MutableStateFlow(false)
    val isRefreshing: StateFlow<Boolean> = _isRefreshing.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    // ─── Connectivity State ─────────────────────────────────────────────────

    /** Whether the device is currently offline. UI shows offline banner when true. */
    val isOffline: StateFlow<Boolean> = connectivityMonitor.isOnline
        .map { online -> !online }
        .stateIn(viewModelScope, SharingStarted.Eagerly, !connectivityMonitor.isOnline.value)

    // ─── Settings-Derived State ─────────────────────────────────────────────

    /** The configured completed window (days or "all"). Default: "3". */
    val completedWindow: StateFlow<String> = settingsRepository.settings
        .map { it.badgesCompletedWindow ?: "3" }
        .stateIn(viewModelScope, SharingStarted.Eagerly, "3")

    /** Whether the user prefers 24-hour time format. */
    val use24HourTime: StateFlow<Boolean> = settingsRepository.settings
        .map { (it.timeFormat ?: "12h") == "24h" }
        .stateIn(viewModelScope, SharingStarted.Eagerly, false)

    // ─── Initialization ─────────────────────────────────────────────────────

    init {
        observeLocalCache()
        loadFromCacheThenRefresh()
        observeConnectivityForAutoRefresh()
    }

    /**
     * Observe the Room badges table reactively.
     * Any local changes (from refresh or optimistic dismiss) immediately update the UI.
     */
    private fun observeLocalCache() {
        viewModelScope.launch {
            badgeDao.getAll().collect { entities ->
                _badges.value = entities
            }
        }
    }

    /**
     * Initial load: show cached data immediately, then refresh from server if online.
     */
    private fun loadFromCacheThenRefresh() {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null

            if (connectivityMonitor.isOnline.value) {
                fetchBadgesFromServer()
                sendQueuedDismissals()
            }

            _isLoading.value = false
        }
    }

    /**
     * When connectivity returns, automatically refresh badges and send queued dismissals.
     */
    private fun observeConnectivityForAutoRefresh() {
        viewModelScope.launch {
            connectivityMonitor.events.collect { event ->
                if (event is ConnectivityEvent.Online) {
                    Log.d(TAG, "Connectivity restored — refreshing badges and sending queued dismissals")
                    sendQueuedDismissals()
                    fetchBadgesFromServer()
                }
            }
        }
    }

    // ─── Public API ─────────────────────────────────────────────────────────

    /**
     * Pull-to-refresh: triggers email check, re-fetches badges, updates cache.
     */
    fun refresh() {
        viewModelScope.launch {
            _isRefreshing.value = true
            _error.value = null
            try {
                // Step 1: Trigger email check to detect new badges
                triggerEmailCheck()
                // Step 2: Re-fetch badges from server
                fetchBadgesFromServer()
                // Step 3: Send any queued dismissals
                sendQueuedDismissals()
            } finally {
                _isRefreshing.value = false
            }
        }
    }

    /**
     * Dismiss a badge: update Room immediately (optimistic), queue API POST.
     * If online, sends the API call right away. If offline, queues for later.
     */
    fun dismiss(badgeId: String) {
        val now = Instant.now().toString()

        // Optimistic local update
        viewModelScope.launch {
            badgeDao.updateStatus(badgeId, "dismissed", now)
            Log.d(TAG, "Badge $badgeId dismissed locally (optimistic)")

            // Attempt API call or queue
            if (connectivityMonitor.isOnline.value) {
                val success = postDismissToServer(badgeId)
                if (!success) {
                    // API failed but local is already updated — queue for retry
                    queueDismissal(badgeId)
                }
            } else {
                queueDismissal(badgeId)
            }
        }
    }

    // ─── Private: Server Communication ──────────────────────────────────────

    /**
     * Fetch badges from GET /api/badges?completed_window=X and update Room cache.
     */
    private suspend fun fetchBadgesFromServer() {
        withContext(Dispatchers.IO) {
            try {
                val serverUrl = prefs.getString("server_url", null)
                if (serverUrl.isNullOrBlank()) {
                    _error.value = "No server URL configured"
                    return@withContext
                }

                val window = completedWindow.value
                val url = serverUrl.trimEnd('/') + "/api/badges?completed_window=$window"
                val request = Request.Builder().url(url).get().build()
                val response = okHttpClient.newCall(request).execute()

                if (response.isSuccessful) {
                    val body = response.body?.string()
                    if (body != null) {
                        val badgesResponse = gson.fromJson(body, BadgesResponse::class.java)
                        val now = Instant.now().toString()
                        val entities = badgesResponse.badges.map { dto ->
                            BadgeEntity(
                                id = dto.id,
                                chitId = dto.chitId,
                                category = dto.category,
                                providerName = dto.providerName,
                                code = dto.code,
                                url = dto.url,
                                icon = dto.icon,
                                label = dto.label,
                                status = dto.status,
                                detectedAt = dto.detectedAt,
                                lastUpdatedAt = dto.lastUpdatedAt,
                                completedAt = dto.completedAt,
                                lastEmailSubject = dto.lastEmailSubject,
                                cachedAt = now
                            )
                        }
                        // Replace all cached badges with fresh server data
                        badgeDao.deleteAll()
                        badgeDao.upsertAll(entities)
                        _error.value = null
                        Log.d(TAG, "Fetched ${entities.size} badges from server")
                    }
                } else {
                    Log.w(TAG, "GET /api/badges failed: ${response.code}")
                    if (_badges.value.isEmpty()) {
                        _error.value = "Unable to load badges (${response.code})"
                    }
                }
            } catch (e: Exception) {
                Log.w(TAG, "Badge fetch failed: ${e.message}")
                if (_badges.value.isEmpty()) {
                    _error.value = "Network error: ${e.message ?: "Unable to reach server"}"
                }
            }
        }
    }

    /**
     * POST /api/badges/{id}/dismiss to the server.
     * Returns true if successful, false otherwise.
     */
    private suspend fun postDismissToServer(badgeId: String): Boolean {
        return withContext(Dispatchers.IO) {
            try {
                val serverUrl = prefs.getString("server_url", null) ?: return@withContext false
                val url = serverUrl.trimEnd('/') + "/api/badges/$badgeId/dismiss"
                val emptyBody = "".toRequestBody("application/json".toMediaType())
                val request = Request.Builder().url(url).post(emptyBody).build()
                val response = okHttpClient.newCall(request).execute()

                if (response.isSuccessful) {
                    Log.d(TAG, "Badge $badgeId dismissed on server")
                    true
                } else {
                    Log.w(TAG, "POST /api/badges/$badgeId/dismiss failed: ${response.code}")
                    false
                }
            } catch (e: Exception) {
                Log.w(TAG, "Dismiss API call failed for $badgeId: ${e.message}")
                false
            }
        }
    }

    /**
     * Trigger email check via POST /api/email/check to detect new badges from recent emails.
     */
    private suspend fun triggerEmailCheck() {
        withContext(Dispatchers.IO) {
            try {
                val serverUrl = prefs.getString("server_url", null) ?: return@withContext
                val url = serverUrl.trimEnd('/') + "/api/email/check"
                val emptyBody = "".toRequestBody("application/json".toMediaType())
                val request = Request.Builder().url(url).post(emptyBody).build()
                val response = okHttpClient.newCall(request).execute()

                if (response.isSuccessful) {
                    Log.d(TAG, "Email check triggered successfully")
                } else {
                    Log.w(TAG, "POST /api/email/check failed: ${response.code}")
                }
            } catch (e: Exception) {
                Log.w(TAG, "Email check failed: ${e.message}")
            }
        }
    }

    // ─── Private: Dismissal Queue (Offline Support) ─────────────────────────

    /**
     * Queue a badge dismissal for later when connectivity returns.
     * Stores badge IDs in SharedPreferences as a JSON array.
     */
    private fun queueDismissal(badgeId: String) {
        val queued = getQueuedDismissals().toMutableSet()
        queued.add(badgeId)
        prefs.edit().putString(PREF_KEY_QUEUED_DISMISSALS, gson.toJson(queued.toList())).apply()
        Log.d(TAG, "Queued dismissal for badge $badgeId (total queued: ${queued.size})")
    }

    /**
     * Get the list of badge IDs queued for dismissal.
     */
    private fun getQueuedDismissals(): List<String> {
        val json = prefs.getString(PREF_KEY_QUEUED_DISMISSALS, null) ?: return emptyList()
        return try {
            val type = object : TypeToken<List<String>>() {}.type
            gson.fromJson<List<String>>(json, type) ?: emptyList()
        } catch (_: Exception) {
            emptyList()
        }
    }

    /**
     * Send all queued dismissals to the server.
     * Removes successfully sent items from the queue.
     */
    private suspend fun sendQueuedDismissals() {
        val queued = getQueuedDismissals()
        if (queued.isEmpty()) return

        Log.d(TAG, "Sending ${queued.size} queued dismissals")
        val remaining = mutableListOf<String>()

        for (badgeId in queued) {
            val success = postDismissToServer(badgeId)
            if (!success) {
                remaining.add(badgeId)
            }
        }

        // Update the queue with any that failed
        if (remaining.isEmpty()) {
            prefs.edit().remove(PREF_KEY_QUEUED_DISMISSALS).apply()
        } else {
            prefs.edit().putString(PREF_KEY_QUEUED_DISMISSALS, gson.toJson(remaining)).apply()
        }

        Log.d(TAG, "Queued dismissals sent. Remaining: ${remaining.size}")
    }
}
