package com.cwoc.app.data.remote

import android.content.SharedPreferences
import okhttp3.Authenticator
import okhttp3.Request
import okhttp3.Response
import okhttp3.Route
import java.util.concurrent.atomic.AtomicBoolean

/**
 * OkHttp Authenticator that handles 401 responses globally.
 *
 * On receiving a 401, it clears the stored device token from SharedPreferences
 * and invokes the onTokenRevoked callback to signal the app (e.g., navigate to login).
 * Returns null to indicate that the request should NOT be retried.
 *
 * Guards:
 * - Only triggers if the request actually had an Authorization header (token was sent)
 * - Uses AtomicBoolean to prevent multiple simultaneous logout triggers
 */
class TokenAuthenticator(
    private val prefs: SharedPreferences,
    private val onTokenRevoked: () -> Unit
) : Authenticator {

    private val logoutTriggered = AtomicBoolean(false)

    override fun authenticate(route: Route?, response: Response): Request? {
        // Only trigger logout if the request actually had an auth header
        // (i.e., the token was sent and the server explicitly rejected it)
        val hadAuthHeader = response.request.header("Authorization") != null
        val requestUrl = response.request.url.toString()
        android.util.Log.e("CWOC_AUTH", "TokenAuthenticator: 401 on $requestUrl, hadAuth=$hadAuthHeader")

        if (!hadAuthHeader) {
            android.util.Log.w("CWOC_AUTH", "TokenAuthenticator: Ignoring 401 — no auth header was sent")
            return null
        }

        // Prevent multiple simultaneous logout triggers from concurrent 401 responses
        if (!logoutTriggered.compareAndSet(false, true)) {
            android.util.Log.w("CWOC_AUTH", "TokenAuthenticator: Logout already triggered, skipping duplicate")
            return null
        }

        // Token was rejected — clear it and signal the app
        android.util.Log.e("CWOC_AUTH", "TokenAuthenticator: Token rejected! Clearing token and triggering logout.")
        prefs.edit().remove("device_token").apply()
        onTokenRevoked()
        return null // Don't retry — redirect to login
    }

    /** Reset the logout guard (called after successful re-login). */
    fun reset() {
        logoutTriggered.set(false)
    }
}
