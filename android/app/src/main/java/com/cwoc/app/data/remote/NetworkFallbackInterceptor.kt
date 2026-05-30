package com.cwoc.app.data.remote

import android.util.Log
import com.cwoc.app.data.sync.NetworkFallbackState
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.Interceptor
import okhttp3.Request
import okhttp3.Response
import java.net.ConnectException
import java.net.SocketTimeoutException
import java.net.UnknownHostException
import java.util.concurrent.TimeUnit

/**
 * OkHttp Interceptor that provides automatic network fallback.
 *
 * Replaces the previous inline dynamicUrlInterceptor in NetworkModule.
 * Rewrites requests to the currently active URL (primary or fallback),
 * and on connection-level failures, retries the request on the fallback URL.
 *
 * Only connection failures trigger fallback — HTTP error responses (4xx, 5xx)
 * are returned as-is since they indicate the server IS reachable.
 *
 * Validates: Requirements 2.1–2.7
 */
class NetworkFallbackInterceptor(
    private val fallbackState: NetworkFallbackState
) : Interceptor {

    companion object {
        private const val TAG = "CWOC_FALLBACK"
    }

    override fun intercept(chain: Interceptor.Chain): Response {
        val originalRequest = chain.request()

        // Resolve the currently active URL (primary or fallback depending on state)
        val activeUrl = fallbackState.resolveActiveUrl()
        if (activeUrl == null) {
            Log.d(TAG, "No active URL configured, proceeding with original request")
            return chain.proceed(originalRequest)
        }

        // Rewrite the request URL to the active server
        val request = rewriteUrl(originalRequest, activeUrl)
        Log.d(TAG, "Attempting request to active URL: $activeUrl (path: ${originalRequest.url.encodedPath})")

        return try {
            // Use 5s connect timeout for the primary attempt
            val response = chain.withConnectTimeout(5, TimeUnit.SECONDS).proceed(request)
            Log.d(TAG, "Request succeeded on active URL: $activeUrl (status: ${response.code})")
            response
        } catch (e: Exception) {
            // Only retry on connection-level failures
            if (!isConnectionFailure(e)) {
                Log.d(TAG, "Non-connection failure, rethrowing: ${e.javaClass.simpleName} - ${e.message}")
                throw e
            }

            Log.w(TAG, "Connection failure on active URL ($activeUrl): ${e.javaClass.simpleName} - ${e.message}")

            // Check if fallback is available
            if (!fallbackState.hasFallback()) {
                Log.w(TAG, "No fallback URL available, rethrowing original exception")
                throw e
            }

            // Get the fallback URL
            val fallbackUrl = fallbackState.fallbackUrl
                ?: throw e // Shouldn't happen after hasFallback() check, but be safe

            Log.d(TAG, "Retrying request on fallback URL: $fallbackUrl (path: ${originalRequest.url.encodedPath})")

            // Rewrite original request to fallback URL
            val fallbackRequest = rewriteUrl(originalRequest, fallbackUrl)

            try {
                // Use 5s connect timeout for the fallback attempt
                val response = chain.withConnectTimeout(5, TimeUnit.SECONDS).proceed(fallbackRequest)
                Log.d(TAG, "Fallback request succeeded on: $fallbackUrl (status: ${response.code})")

                // Fallback succeeded — update state
                fallbackState.switchToFallback()
                Log.i(TAG, "Switched to fallback URL: $fallbackUrl")

                response
            } catch (fallbackEx: Exception) {
                // Both URLs failed — throw the fallback exception
                Log.e(TAG, "Fallback also failed ($fallbackUrl): ${fallbackEx.javaClass.simpleName} - ${fallbackEx.message}")
                throw fallbackEx
            }
        }
    }

    /**
     * Rewrites the request URL's scheme, host, and port to match the target URL.
     * Preserves the original path, query parameters, headers, method, and body.
     */
    private fun rewriteUrl(originalRequest: Request, targetUrl: String): Request {
        val parsedUrl = targetUrl.trimEnd('/').toHttpUrlOrNull() ?: return originalRequest
        val newUrl = originalRequest.url.newBuilder()
            .scheme(parsedUrl.scheme)
            .host(parsedUrl.host)
            .port(parsedUrl.port)
            .build()
        return originalRequest.newBuilder().url(newUrl).build()
    }

    /**
     * Determines if an exception represents a connection-level failure
     * (server unreachable) vs. other types of errors.
     *
     * Only these exceptions trigger fallback — HTTP errors (4xx, 5xx) do NOT.
     */
    private fun isConnectionFailure(e: Exception): Boolean {
        return e is ConnectException ||
               e is SocketTimeoutException ||
               e is UnknownHostException
    }
}
