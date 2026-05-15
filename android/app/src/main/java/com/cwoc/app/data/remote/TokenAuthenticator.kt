package com.cwoc.app.data.remote

import android.content.SharedPreferences
import okhttp3.Authenticator
import okhttp3.Request
import okhttp3.Response
import okhttp3.Route

/**
 * OkHttp Authenticator that handles 401 responses globally.
 *
 * On receiving a 401, it clears the stored device token from SharedPreferences
 * and invokes the onTokenRevoked callback to signal the app (e.g., navigate to login).
 * Returns null to indicate that the request should NOT be retried.
 */
class TokenAuthenticator(
    private val prefs: SharedPreferences,
    private val onTokenRevoked: () -> Unit
) : Authenticator {

    override fun authenticate(route: Route?, response: Response): Request? {
        // Token was rejected — clear it and signal the app
        prefs.edit().remove("device_token").apply()
        onTokenRevoked()
        return null // Don't retry — redirect to login
    }
}
