package com.cwoc.app.data.sync

import android.content.SharedPreferences
import android.util.Log
import com.cwoc.app.data.remote.TrustedHttpClient
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.net.URI
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Centralized state holder for network fallback.
 * Tracks the current active URL (primary or fallback), whether the app is operating
 * on the fallback URL, and provides URL resolution logic.
 *
 * All network components (interceptor, WebSocket, UI) read from this single source of truth.
 *
 * Validates: Requirements 5.4
 */
@Singleton
class NetworkFallbackState @Inject constructor(
    private val prefs: SharedPreferences
) {
    companion object {
        private const val TAG = "CWOC_FALLBACK"
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var reachabilityJob: Job? = null
    private var consecutiveSuccesses: Int = 0

    /** Current active URL (primary or fallback). */
    private val _activeUrl = MutableStateFlow<String?>(prefs.getString("server_url", null))
    val activeUrl: StateFlow<String?> = _activeUrl.asStateFlow()

    /** Whether currently operating on the fallback URL. */
    private val _isFallback = MutableStateFlow(false)
    val isFallback: StateFlow<Boolean> = _isFallback.asStateFlow()

    /** Label for the active connection — "LAN" or "Tailscale". */
    private val _activeLabel = MutableStateFlow("LAN")
    val activeLabel: StateFlow<String> = _activeLabel.asStateFlow()

    /**
     * The primary URL, read directly from SharedPreferences (server_url key).
     */
    val primaryUrl: String?
        get() = prefs.getString("server_url", null)

    /**
     * The fallback URL — the alternate URL to use when the primary is unreachable.
     * If primary matches tailscale_server_url, fallback is lan_server_url, and vice versa.
     */
    val fallbackUrl: String?
        get() {
            val primary = primaryUrl ?: return null
            val tailscaleUrl = prefs.getString("tailscale_server_url", null)
            val lanUrl = prefs.getString("lan_server_url", null)
            return when {
                tailscaleUrl != null && isSameHost(primary, tailscaleUrl) -> lanUrl
                lanUrl != null && isSameHost(primary, lanUrl) -> tailscaleUrl
                tailscaleUrl != null -> tailscaleUrl // primary is unknown, try tailscale
                else -> null // no fallback available
            }
        }

    /**
     * Whether a fallback URL is available.
     */
    fun hasFallback(): Boolean = fallbackUrl != null

    /**
     * Switch to the fallback URL. Sets isFallback=true, updates activeUrl to the fallback,
     * and sets activeLabel to "Tailscale" or "LAN" as appropriate.
     */
    fun switchToFallback() {
        val fallback = fallbackUrl ?: return
        _isFallback.value = true
        _activeUrl.value = fallback
        _activeLabel.value = determineLabelForUrl(fallback)
        startReachabilityChecks()
    }

    /**
     * Switch back to the primary URL. Sets isFallback=false, updates activeUrl to primary,
     * and resets activeLabel.
     */
    fun switchToPrimary() {
        stopReachabilityChecks()
        _isFallback.value = false
        _activeUrl.value = primaryUrl
        _activeLabel.value = determineLabelForUrl(primaryUrl)
    }

    /**
     * Returns the currently active URL based on fallback state.
     * If in fallback mode, returns the fallback URL; otherwise returns the primary URL.
     */
    fun resolveActiveUrl(): String? {
        return if (_isFallback.value) fallbackUrl else primaryUrl
    }

    /**
     * Determines the display label for a given URL.
     * Returns "Tailscale" if the URL matches the cached tailscale_server_url, "LAN" otherwise.
     */
    private fun determineLabelForUrl(url: String?): String {
        if (url == null) return "LAN"
        val tailscaleUrl = prefs.getString("tailscale_server_url", null)
        return if (tailscaleUrl != null && isSameHost(url, tailscaleUrl)) "Tailscale" else "LAN"
    }

    /**
     * Starts periodic reachability checks against the primary URL.
     * Polls GET /api/health every 30s with a 5s timeout.
     * Requires 2 consecutive 2xx responses before switching back to primary.
     */
    fun startReachabilityChecks() {
        reachabilityJob?.cancel()
        consecutiveSuccesses = 0
        reachabilityJob = scope.launch {
            while (isActive && _isFallback.value) {
                delay(30_000)
                if (checkPrimaryReachable()) {
                    consecutiveSuccesses++
                    Log.d(TAG, "Primary reachable ($consecutiveSuccesses/2 consecutive)")
                    if (consecutiveSuccesses >= 2) {
                        switchToPrimary()
                        break
                    }
                } else {
                    consecutiveSuccesses = 0
                    Log.d(TAG, "Primary still unreachable")
                }
            }
        }
    }

    /**
     * Stops the reachability check coroutine and resets state.
     */
    fun stopReachabilityChecks() {
        reachabilityJob?.cancel()
        reachabilityJob = null
        consecutiveSuccesses = 0
    }

    /**
     * Checks if the primary URL is reachable by hitting GET /api/health with a 5s timeout.
     * Returns true if the response is a 2xx status code.
     */
    private suspend fun checkPrimaryReachable(): Boolean {
        val url = primaryUrl ?: return false
        return try {
            val request = okhttp3.Request.Builder()
                .url("${url.trimEnd('/')}/api/health")
                .build()
            val client = TrustedHttpClient.instance.newBuilder()
                .connectTimeout(5, TimeUnit.SECONDS)
                .readTimeout(5, TimeUnit.SECONDS)
                .build()
            val response = client.newCall(request).execute()
            response.isSuccessful.also { response.close() }
        } catch (e: Exception) {
            false
        }
    }

    /**
     * Compares the host portions of two URLs.
     * Returns true if both URLs have the same host (ignoring port, scheme, and path).
     */
    fun isSameHost(url1: String, url2: String): Boolean {
        return try {
            val host1 = URI(url1).host?.lowercase()
            val host2 = URI(url2).host?.lowercase()
            host1 != null && host1 == host2
        } catch (e: Exception) {
            false
        }
    }
}
