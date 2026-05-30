package com.cwoc.app.data.repository

import android.content.SharedPreferences
import android.os.Build
import com.cwoc.app.data.remote.CwocApiService
import com.cwoc.app.data.remote.dto.DeviceTokenRequest
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Sealed class representing the result of a login attempt.
 */
sealed class AuthResult {
    data object Success : AuthResult()
    data object InvalidCredentials : AuthResult()
    data object RateLimited : AuthResult()
    data object NetworkError : AuthResult()
    data class Error(val message: String) : AuthResult()
}

/**
 * Sealed class representing authentication events broadcast to the app.
 */
sealed class AuthEvent {
    data object TokenRevoked : AuthEvent()
}

/**
 * Repository managing authentication state, token storage, and auth events.
 *
 * Stores the device token in EncryptedSharedPreferences and persists the
 * server URL for pre-populating the login screen on subsequent launches.
 *
 * Implements [AuthEventEmitter] so that TokenAuthenticator can signal token
 * revocation without a direct dependency on this repository.
 */
@Singleton
class AuthRepository @Inject constructor(
    private val prefs: SharedPreferences,
    private val apiService: CwocApiService
) : AuthEventEmitter {

    private val _authEvents = MutableSharedFlow<AuthEvent>(extraBufferCapacity = 1)

    /** SharedFlow emitting auth events (e.g., token revocation) for UI observation. */
    val authEvents: SharedFlow<AuthEvent> = _authEvents.asSharedFlow()

    /** Reactive display name for the current user. */
    private val _displayName = MutableStateFlow<String?>(prefs.getString("user_display_name", null))
    val displayName: StateFlow<String?> = _displayName.asStateFlow()

    /** Reactive username for the current user. */
    private val _username = MutableStateFlow<String?>(prefs.getString("user_username", null))
    val username: StateFlow<String?> = _username.asStateFlow()

    /** Reactive user ID for the current user. */
    private val _userId = MutableStateFlow<String?>(prefs.getString("user_id", null))
    val userId: StateFlow<String?> = _userId.asStateFlow()

    /** Reactive profile image URL for the current user. */
    private val _profileImageUrl = MutableStateFlow<String?>(prefs.getString("user_profile_image_url", null))
    val profileImageUrl: StateFlow<String?> = _profileImageUrl.asStateFlow()

    /**
     * Re-read profile fields from SharedPreferences into the StateFlows.
     * Called after sync updates prefs from a background thread.
     */
    fun refreshProfileFromPrefs() {
        _displayName.value = prefs.getString("user_display_name", null)
        _username.value = prefs.getString("user_username", null)
        _userId.value = prefs.getString("user_id", null)
        _profileImageUrl.value = prefs.getString("user_profile_image_url", null)
    }

    /**
     * Attempt to log in with the given credentials.
     *
     * Persists the server URL, calls the device-token endpoint, and stores
     * the returned token on success.
     *
     * @param serverUrl The base URL of the CWOC server
     * @param username The user's username
     * @param password The user's password
     * @return [AuthResult] indicating success or the type of failure
     */
    suspend fun login(serverUrl: String, username: String, password: String): AuthResult {
        // Persist the server URL for future use (dynamic URL interceptor reads this)
        val urlSaved = prefs.edit().putString("server_url", serverUrl).commit()
        android.util.Log.d("CWOC_LOGIN", "server_url commit result: $urlSaved")

        // Cache LAN URL: if login URL is not a Tailscale address, store as lan_server_url
        val tailscaleUrl = prefs.getString("tailscale_server_url", null)
        val isTailscaleLogin = if (tailscaleUrl != null) {
            try {
                java.net.URI(serverUrl).host?.lowercase() == java.net.URI(tailscaleUrl).host?.lowercase()
            } catch (_: Exception) { false }
        } else false

        if (!isTailscaleLogin) {
            prefs.edit().putString("lan_server_url", serverUrl).apply()
            android.util.Log.d("CWOC_LOGIN", "Cached lan_server_url: $serverUrl")
        } else {
            android.util.Log.d("CWOC_LOGIN", "Login via Tailscale — not overwriting lan_server_url")
        }

        return try {
            val deviceName = "${Build.MANUFACTURER} ${Build.MODEL}"
            val request = DeviceTokenRequest(
                username = username,
                password = password,
                device_name = deviceName
            )

            // Use the Hilt-injected apiService directly.
            // AuthInterceptor already skips adding Bearer token for /api/auth/device-token.
            // Dynamic URL interceptor reads server_url from prefs (persisted above).
            android.util.Log.d("CWOC_LOGIN", "Attempting login to: ${serverUrl.trimEnd('/')}/api/auth/device-token")
            android.util.Log.d("CWOC_LOGIN", "Username: $username, Device: $deviceName")
            val response = apiService.authenticate(request)
            android.util.Log.d("CWOC_LOGIN", "Response code: ${response.code()}")

            when {
                response.isSuccessful -> {
                    val body = response.body()
                    if (body != null) {
                        val tokenSaved = prefs.edit()
                            .putString("device_token", body.token)
                            .putString("user_username", username)
                            .commit()
                        android.util.Log.d("CWOC_LOGIN", "token+username commit result: $tokenSaved")
                        // Verify the write by reading back
                        val readBack = prefs.getString("device_token", null)
                        android.util.Log.d("CWOC_LOGIN", "Read-back device_token: ${if (readBack != null) "${readBack.take(8)}...(${readBack.length})" else "NULL"}")
                        _username.value = username
                        AuthResult.Success
                    } else {
                        AuthResult.Error("Empty response from server")
                    }
                }
                response.code() == 401 || response.code() == 403 -> {
                    AuthResult.InvalidCredentials
                }
                response.code() == 429 -> {
                    AuthResult.RateLimited
                }
                else -> {
                    AuthResult.Error("Server error: ${response.code()} ${response.message()}")
                }
            }
        } catch (e: java.net.UnknownHostException) {
            android.util.Log.e("CWOC_LOGIN", "UnknownHostException: ${e.message}", e)
            AuthResult.Error("DNS lookup failed: ${e.message}")
        } catch (e: java.net.ConnectException) {
            android.util.Log.e("CWOC_LOGIN", "ConnectException: ${e.message}", e)
            AuthResult.Error("Connection refused: ${e.message}")
        } catch (e: java.net.SocketTimeoutException) {
            android.util.Log.e("CWOC_LOGIN", "SocketTimeoutException: ${e.message}", e)
            AuthResult.Error("Connection timed out: ${e.message}")
        } catch (e: java.io.IOException) {
            android.util.Log.e("CWOC_LOGIN", "IOException: ${e.message}", e)
            AuthResult.Error("Network error: ${e.message}")
        } catch (e: Exception) {
            android.util.Log.e("CWOC_LOGIN", "Exception: ${e.javaClass.simpleName}: ${e.message}", e)
            AuthResult.Error("${e.javaClass.simpleName}: ${e.message}")
        }
    }

    /**
     * Check whether a device token is currently stored.
     */
    fun isAuthenticated(): Boolean {
        return prefs.getString("device_token", null) != null
    }

    /**
     * Retrieve the current device token, or null if not stored.
     * Used for authenticated image loading (Coil) where the OkHttp interceptor isn't available.
     */
    fun getToken(): String? {
        return prefs.getString("device_token", null)
    }

    /**
     * Retrieve the last successfully used server URL, or null if none stored.
     */
    fun getLastServerUrl(): String? {
        return prefs.getString("server_url", null)
    }

    /**
     * Clear the stored device token (used during logout or token revocation).
     */
    fun clearToken() {
        prefs.edit()
            .remove("device_token")
            .remove("user_display_name")
            .remove("user_username")
            .remove("user_id")
            .remove("user_profile_image_url")
            .apply()
        _displayName.value = null
        _username.value = null
        _userId.value = null
        _profileImageUrl.value = null
    }

    /**
     * Fetch the current user's profile from /api/auth/me and cache display name + user ID.
     * Called after login and on app startup when authenticated.
     *
     * Uses the Hilt-injected apiService — the dynamic URL interceptor reads server_url
     * from SharedPreferences and rewrites the request host/port/scheme automatically.
     * AuthInterceptor adds the Bearer token.
     */
    suspend fun fetchUserProfile() {
        try {
            val serverUrl = prefs.getString("server_url", null)
            val token = prefs.getString("device_token", null)

            if (serverUrl.isNullOrBlank() || token.isNullOrBlank()) {
                android.util.Log.e("CWOC_AUTH", "fetchUserProfile: no server_url or token in prefs")
                return
            }

            val response = apiService.getMe()

            if (response.isSuccessful) {
                val profile = response.body()
                if (profile != null) {
                    prefs.edit()
                        .putString("user_display_name", profile.displayName)
                        .putString("user_username", profile.username)
                        .putString("user_id", profile.userId)
                        .putString("user_profile_image_url", profile.profileImageUrl)
                        .apply()
                    _displayName.value = profile.displayName
                    _username.value = profile.username
                    _userId.value = profile.userId
                    _profileImageUrl.value = profile.profileImageUrl
                }
            } else {
                android.util.Log.e("CWOC_AUTH", "fetchUserProfile failed: HTTP ${response.code()} ${response.message()}")
            }
        } catch (e: Exception) {
            android.util.Log.e("CWOC_AUTH", "Failed to fetch user profile: ${e.message}", e)
        }
    }

    /**
     * Emit a token revocation event (suspend version).
     * Called from coroutine contexts when a 401 is detected.
     */
    suspend fun emitTokenRevoked() {
        _authEvents.emit(AuthEvent.TokenRevoked)
    }

    /**
     * Emit a token revocation event synchronously.
     * Called by TokenAuthenticator on OkHttp's thread when a 401 is received.
     * Uses tryEmit since SharedFlow with extraBufferCapacity > 0 supports it.
     */
    override fun emitTokenRevokedSync() {
        _authEvents.tryEmit(AuthEvent.TokenRevoked)
    }
}
