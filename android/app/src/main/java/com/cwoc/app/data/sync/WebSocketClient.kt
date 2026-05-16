package com.cwoc.app.data.sync

import android.content.SharedPreferences
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject
import javax.inject.Inject

private const val TAG = "CWOC_WS"

/**
 * Message received from the WebSocket server.
 * The server sends JSON like: {"type": "change", "entity": "chit", "id": "..."}
 */
data class WebSocketMessage(
    val type: String,
    val entity: String? = null,
    val id: String? = null,
    val serverVersion: Int? = null
)

/**
 * Interface for the WebSocket client that maintains a connection to /ws/sync
 * for receiving real-time change notifications from the server.
 *
 * Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5
 */
interface WebSocketClient {
    /** Stream of messages received from the WebSocket server. */
    val messages: Flow<WebSocketMessage>

    /** Current connection state as a hot observable. */
    val isConnected: StateFlow<Boolean>

    /** Establish a WebSocket connection to /ws/sync. */
    fun connect()

    /** Gracefully disconnect the WebSocket (close code 1000). */
    fun disconnect()
}

/**
 * Implementation of [WebSocketClient] using OkHttp's WebSocket API.
 *
 * Features:
 * - Exponential backoff reconnect on connection failure (2s, 4s, 8s, 16s, 32s, 60s cap)
 * - Resets backoff on successful connection
 * - Graceful disconnect with close code 1000
 * - Auto-reconnect on unexpected close (unless explicitly disconnected)
 * - Emits parsed WebSocketMessage objects on the messages Flow
 *
 * Takes OkHttpClient and SharedPreferences as constructor parameters for Hilt injection.
 */
class WebSocketClientImpl @Inject constructor(
    private val okHttpClient: OkHttpClient,
    private val prefs: SharedPreferences
) : WebSocketClient {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private val _isConnected = MutableStateFlow(false)
    override val isConnected: StateFlow<Boolean> = _isConnected.asStateFlow()

    private val _messages = MutableSharedFlow<WebSocketMessage>(extraBufferCapacity = 64)
    override val messages: Flow<WebSocketMessage> = _messages.asSharedFlow()

    /** Whether the user has explicitly called disconnect(). Prevents auto-reconnect. */
    private var intentionalDisconnect = false

    /** Current WebSocket instance, if connected. */
    private var webSocket: WebSocket? = null

    /** Current backoff delay in milliseconds. Resets on successful connection. */
    private var currentBackoffMs: Long = INITIAL_BACKOFF_MS

    /** Whether a reconnect attempt is currently scheduled/in-progress. */
    private var reconnecting = false

    companion object {
        private const val INITIAL_BACKOFF_MS = 2_000L
        private const val MAX_BACKOFF_MS = 60_000L
        private const val NORMAL_CLOSE_CODE = 1000
        private const val NORMAL_CLOSE_REASON = "Client disconnect"
    }

    override fun connect() {
        intentionalDisconnect = false
        currentBackoffMs = INITIAL_BACKOFF_MS
        reconnecting = false
        establishConnection()
    }

    override fun disconnect() {
        intentionalDisconnect = true
        reconnecting = false
        webSocket?.close(NORMAL_CLOSE_CODE, NORMAL_CLOSE_REASON)
        webSocket = null
        _isConnected.value = false
        Log.d(TAG, "Disconnected gracefully (code $NORMAL_CLOSE_CODE)")
    }

    /**
     * Builds the WebSocket URL from the stored server URL.
     * Converts http:// to ws:// and https:// to wss://, then appends /ws/sync.
     */
    private fun buildWebSocketUrl(): String? {
        val serverUrl = prefs.getString("server_url", null)
        if (serverUrl.isNullOrBlank()) {
            Log.e(TAG, "Cannot connect WebSocket: no server_url configured")
            return null
        }

        val wsUrl = serverUrl.trimEnd('/')
            .replace("^http://".toRegex(), "ws://")
            .replace("^https://".toRegex(), "wss://")

        return "$wsUrl/ws/sync"
    }

    /**
     * Creates the OkHttp WebSocket connection with the auth token header.
     */
    private fun establishConnection() {
        val url = buildWebSocketUrl() ?: return
        val token = prefs.getString("device_token", null)

        val requestBuilder = Request.Builder().url(url)
        if (!token.isNullOrBlank()) {
            requestBuilder.header("Authorization", "Bearer $token")
        }

        Log.d(TAG, "Connecting to WebSocket: $url")

        webSocket = okHttpClient.newWebSocket(requestBuilder.build(), object : WebSocketListener() {

            override fun onOpen(webSocket: WebSocket, response: Response) {
                Log.d(TAG, "WebSocket connected to $url")
                _isConnected.value = true
                currentBackoffMs = INITIAL_BACKOFF_MS // Reset backoff on success
                reconnecting = false
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                Log.d(TAG, "WebSocket message received: $text")
                val message = parseMessage(text)
                if (message != null) {
                    _messages.tryEmit(message)
                }
            }

            override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                Log.d(TAG, "WebSocket closing: code=$code, reason=$reason")
                webSocket.close(code, reason)
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                Log.d(TAG, "WebSocket closed: code=$code, reason=$reason")
                _isConnected.value = false
                this@WebSocketClientImpl.webSocket = null

                // Auto-reconnect on unexpected close (unless user explicitly disconnected)
                if (!intentionalDisconnect) {
                    scheduleReconnect()
                }
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                Log.e(TAG, "WebSocket failure: ${t.message}", t)
                _isConnected.value = false
                this@WebSocketClientImpl.webSocket = null

                // Auto-reconnect on failure (unless user explicitly disconnected)
                if (!intentionalDisconnect) {
                    scheduleReconnect()
                }
            }
        })
    }

    /**
     * Schedules a reconnect attempt with exponential backoff.
     * Backoff sequence: 2s, 4s, 8s, 16s, 32s, 60s (capped).
     */
    private fun scheduleReconnect() {
        if (reconnecting || intentionalDisconnect) return
        reconnecting = true

        val delayMs = currentBackoffMs
        Log.d(TAG, "Scheduling reconnect in ${delayMs}ms")

        scope.launch {
            delay(delayMs)

            // Double the backoff for next attempt, capped at MAX_BACKOFF_MS
            currentBackoffMs = (currentBackoffMs * 2).coerceAtMost(MAX_BACKOFF_MS)

            if (!intentionalDisconnect) {
                reconnecting = false
                establishConnection()
            } else {
                reconnecting = false
            }
        }
    }

    /**
     * Parses a JSON message from the WebSocket server into a [WebSocketMessage].
     * Expected format: {"type": "change", "entity": "chit", "id": "..."}
     * Returns null if parsing fails.
     */
    private fun parseMessage(text: String): WebSocketMessage? {
        return try {
            val json = JSONObject(text)
            WebSocketMessage(
                type = json.optString("type", "unknown"),
                entity = json.optString("entity", null),
                id = json.optString("id", null),
                serverVersion = if (json.has("server_version")) json.optInt("server_version") else null
            )
        } catch (e: Exception) {
            Log.w(TAG, "Failed to parse WebSocket message: $text", e)
            null
        }
    }
}
