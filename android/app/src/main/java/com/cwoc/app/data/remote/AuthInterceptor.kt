package com.cwoc.app.data.remote

import android.content.SharedPreferences
import okhttp3.Interceptor
import okhttp3.Response

/**
 * OkHttp Interceptor that adds an Authorization Bearer token header
 * to all outgoing requests except the login endpoint.
 *
 * The token is read from EncryptedSharedPreferences under the key "device_token".
 */
class AuthInterceptor(
    private val prefs: SharedPreferences
) : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()

        // Don't add auth header to the login endpoint
        if (request.url.encodedPath.contains("/api/auth/device-token")) {
            return chain.proceed(request)
        }

        val token = prefs.getString("device_token", null)
        if (token != null) {
            val authenticatedRequest = request.newBuilder()
                .header("Authorization", "Bearer $token")
                .build()
            return chain.proceed(authenticatedRequest)
        }

        return chain.proceed(request)
    }
}
