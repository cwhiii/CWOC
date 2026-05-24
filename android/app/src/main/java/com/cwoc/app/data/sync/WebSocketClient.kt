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
 * Connection state for the WebSocket, observed by SyncForegroundService for notification updates.
 */
enum class WebSocketConnectionState {
    CONNECTED,
    RECONNECTING,
    DISCONNECTED
}

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

    /** Connection state for notification updates (CONNECTED, RECONNECTING, DISCONNECTED). */
    val connectionState: StateFlow<WebSocketConnectionState>

    /** Establish a WebSocket connection to /ws/sync. */
    fun connect()

    /** Gracefully disconnect the WebSocket (close code 1000). */
    fun disconnect()

    /** Reset backoff delay, reconnect attempts, and reconnecting flag. Called on connectivity restore. */
    fun resetBackoff()
}

/**
 * Implementation of [WebSocketClient] using OkHttp's WebSocket API.
 *
 * Features:
 * - Exponential backoff reconnect on connection failure (1s, 2s, 4s, 8s, 16s, 30s cap)
 * - Maximum 10 consecutive reconnection attempts before stopping
 * - Resets backoff on successful connection
 * - Graceful disconnect with close code 1000
 * - Auto-reconnect on unexpected close (unless explicitly disconnected or permanently disabled)
 * - Detects 401 auth failure and permanently disables reconnection
 * - Emits parsed WebSocketMessage objects on the messages Flow
 * - Emits WebSocketConnectionState for notification updates
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

    private val _connectionState = MutableStateFlow(WebSocketConnectionState.DISCONNECTED)
    override val connectionState: StateFlow<WebSocketConnectionState> = _connectionState.asStateFlow()

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

    /** Number of consecutive reconnection attempts. Resets on successful connection. */
    private var reconnectAttempts: Int = 0

    /** Set to true on 401 auth failure — permanently stops reconnection. */
    private var permanentlyDisabled: Boolean = false

    companion object {
        private const val INITIAL_BACKOFF_MS = 1_000L
        private const val MAX_BACKOFF_MS = 30_000L
        private const val MAX_RECONNECT_ATTEMPTS = 10
        private const val NORMAL_CLOSE_CODE = 1000
        private const val NORMAL_CLOSE_REASON = "Client disconnect"
    }

    override fun connect() {
        val token = prefs.getString("device_token", null)
        if (token.isNullOrBlank()) {
            Log.w(TAG, "Cannot connect WebSocket: no device_token configured")
            return
        }

        // If already connected or a connection attempt is in progress, skip
        if (webSocket != null) {
            Log.d(TAG, "WebSocket already active (connected or connecting) — skipping duplicate connect()")
            return
        }
        intentionalDisconnect = false
        currentBackoffMs = INITIAL_BACKOFF_MS
        reconnecting = false
        reconnectAttempts = 0
        permanentlyDisabled = false
        establishConnection()
    }

    override fun disconnect() {
        intentionalDisconnect = true
        reconnecting = false
        webSocket?.close(NORMAL_CLOSE_CODE, NORMAL_CLOSE_REASON)
        webSocket = null
        _isConnected.value = false
        _connectionState.value = WebSocketConnectionState.DISCONNECTED
        Log.d(TAG, "Disconnected gracefully (code $NORMAL_CLOSE_CODE)")
    }

    override fun resetBackoff() {
        currentBackoffMs = INITIAL_BACKOFF_MS
        reconnectAttempts = 0
        reconnecting = false
        Log.d(TAG, "Backoff reset: delay=${INITIAL_BACKOFF_MS}ms, attempts=0")
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
                _connectionState.value = WebSocketConnectionState.CONNECTED
                currentBackoffMs = INITIAL_BACKOFF_MS // Reset backoff on success
                reconnectAttempts = 0
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
                } else {
                    _connectionState.value = WebSocketConnectionState.DISCONNECTED
                }
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                Log.e(TAG, "WebSocket failure: ${t.message}", t)
                _isConnected.value = false
                this@WebSocketClientImpl.webSocket = null

                // Detect 401 auth failure — permanently disable reconnection
                if (response?.code == 401) {
                    Log.e(TAG, "WebSocket 401 authentication failure — permanently disabling reconnection")
                    permanentlyDisabled = true
                    _connectionState.value = WebSocketConnectionState.DISCONNECTED
                    return
                }

                // Auto-reconnect on failure (unless user explicitly disconnected)
                if (!intentionalDisconnect) {
                    scheduleReconnect()
                } else {
                    _connectionState.value = WebSocketConnectionState.DISCONNECTED
                }
            }
        })
    }

    /**
     * Schedules a reconnect attempt with exponential backoff.
     * Backoff sequence: 1s, 2s, 4s, 8s, 16s, 30s (capped).
     * Stops after MAX_RECONNECT_ATTEMPTS (10) consecutive failures or if permanently disabled.
     */
    private fun scheduleReconnect() {
        if (reconnecting || intentionalDisconnect || permanentlyDisabled) return

        reconnectAttempts++
        if (reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
            Log.w(TAG, "Max reconnect attempts ($MAX_RECONNECT_ATTEMPTS) reached — stopping automatic reconnection")
            _connectionState.value = WebSocketConnectionState.DISCONNECTED
            return
        }

        reconnecting = true
        _connectionState.value = WebSocketConnectionState.RECONNECTING

        val delayMs = currentBackoffMs
        Log.d(TAG, "Scheduling reconnect in ${delayMs}ms (attempt $reconnectAttempts/$MAX_RECONNECT_ATTEMPTS)")

        scope.launch {
            delay(delayMs)

            // Double the backoff for next attempt, capped at MAX_BACKOFF_MS
            currentBackoffMs = (currentBackoffMs * 2).coerceAtMost(MAX_BACKOFF_MS)

            if (!intentionalDisconnect && !permanentlyDisabled) {
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
