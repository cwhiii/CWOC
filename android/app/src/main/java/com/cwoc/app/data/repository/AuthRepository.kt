package com.cwoc.app.data.repository

import android.content.SharedPreferences
import android.os.Build
import com.cwoc.app.data.remote.CwocApiService
import com.cwoc.app.data.remote.dto.DeviceTokenRequest
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Sealed class representing the result of a login attempt.
 */
sealed class AuthResult {
    data object Success : AuthResult()
    data object InvalidCredentials : AuthResult()
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
        // Persist the server URL for future use
        prefs.edit().putString("server_url", serverUrl).apply()

        return try {
            val deviceName = "${Build.MANUFACTURER} ${Build.MODEL}"
            val request = DeviceTokenRequest(
                username = username,
                password = password,
                device_name = deviceName
            )

            // Build a one-off Retrofit instance with the user-provided URL
            // (the singleton Retrofit was created at app startup with the old/default URL)
            val trustAllCerts = arrayOf<javax.net.ssl.TrustManager>(object : javax.net.ssl.X509TrustManager {
                override fun checkClientTrusted(chain: Array<out java.security.cert.X509Certificate>?, authType: String?) {}
                override fun checkServerTrusted(chain: Array<out java.security.cert.X509Certificate>?, authType: String?) {}
                override fun getAcceptedIssuers(): Array<java.security.cert.X509Certificate> = arrayOf()
            })
            val sslContext = javax.net.ssl.SSLContext.getInstance("TLS")
            sslContext.init(null, trustAllCerts, java.security.SecureRandom())

            val loginClient = okhttp3.OkHttpClient.Builder()
                .sslSocketFactory(sslContext.socketFactory, trustAllCerts[0] as javax.net.ssl.X509TrustManager)
                .hostnameVerifier { _, _ -> true }
                .connectTimeout(15, java.util.concurrent.TimeUnit.SECONDS)
                .readTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
                .build()

            val loginRetrofit = retrofit2.Retrofit.Builder()
                .baseUrl(serverUrl.trimEnd('/') + "/")
                .client(loginClient)
                .addConverterFactory(retrofit2.converter.gson.GsonConverterFactory.create())
                .build()

            val loginApi = loginRetrofit.create(com.cwoc.app.data.remote.CwocApiService::class.java)
            android.util.Log.d("CWOC_LOGIN", "Attempting login to: ${serverUrl.trimEnd('/')}/api/auth/device-token")
            android.util.Log.d("CWOC_LOGIN", "Username: $username, Device: $deviceName")
            val response = loginApi.authenticate(request)
            android.util.Log.d("CWOC_LOGIN", "Response code: ${response.code()}")

            when {
                response.isSuccessful -> {
                    val body = response.body()
                    if (body != null) {
                        prefs.edit().putString("device_token", body.token).apply()
                        AuthResult.Success
                    } else {
                        AuthResult.Error("Empty response from server")
                    }
                }
                response.code() == 401 || response.code() == 403 -> {
                    AuthResult.InvalidCredentials
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
     * Retrieve the last successfully used server URL, or null if none stored.
     */
    fun getLastServerUrl(): String? {
        return prefs.getString("server_url", null)
    }

    /**
     * Clear the stored device token (used during logout or token revocation).
     */
    fun clearToken() {
        prefs.edit().remove("device_token").apply()
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
