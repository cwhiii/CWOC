package com.cwoc.app.data.sync

import android.content.Context
import android.util.Log
import com.cwoc.app.data.local.dao.SyncMetadataDao
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Singleton

private const val TAG = "CWOC_ORCHESTRATOR"

/**
 * Orchestrates sync behavior in response to connectivity changes.
 *
 * Responsibilities:
 * - Listens to ConnectivityMonitor events
 * - On Online: enqueues PushSyncWorker to flush dirty queue, then connects WebSocket
 * - On Offline: disconnects WebSocket gracefully
 * - Listens to WebSocket messages and triggers incremental pull on "change" notifications
 *
 * Called at app startup via start().
 *
 * Validates: Requirements 8.1, 9.4, 9.5, 10.2, 10.3
 */
@Singleton
class SyncOrchestrator @Inject constructor(
    @ApplicationContext private val context: Context,
    private val connectivityMonitor: ConnectivityMonitor,
    private val webSocketClient: WebSocketClient,
    private val syncEngine: SyncEngine,
    private val syncMetadataDao: SyncMetadataDao
) {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    /**
     * Start the orchestrator. Should be called once at app startup.
     * Begins collecting connectivity events and WebSocket messages.
     */
    fun start() {
        Log.d(TAG, "SyncOrchestrator started")

        // Collect connectivity events and react accordingly
        scope.launch {
            connectivityMonitor.events.collect { event ->
                when (event) {
                    is ConnectivityEvent.Online -> handleOnline()
                    is ConnectivityEvent.Offline -> handleOffline()
                }
            }
        }

        // Collect WebSocket messages and trigger incremental pull on change notifications
        scope.launch {
            webSocketClient.messages.collect { message ->
                handleWebSocketMessage(message)
            }
        }

        // If already online at startup, kick off sync + WebSocket
        if (connectivityMonitor.isOnline.value) {
            scope.launch {
                handleOnline()
            }
        }
    }

    /**
     * Handle transition to online state:
     * 1. Enqueue PushSyncWorker to flush any dirty records
     * 2. Connect WebSocket for real-time notifications
     */
    private fun handleOnline() {
        Log.d(TAG, "Online detected — enqueuing PushSyncWorker and connecting WebSocket")

        // Enqueue the push worker to flush dirty queue
        PushSyncWorker.enqueueOnce(context)

        // Connect WebSocket for real-time change notifications
        webSocketClient.connect()
    }

    /**
     * Handle transition to offline state:
     * 1. Disconnect WebSocket gracefully
     */
    private fun handleOffline() {
        Log.d(TAG, "Offline detected — disconnecting WebSocket")
        webSocketClient.disconnect()
    }

    /**
     * Handle incoming WebSocket messages.
     * On "change" type messages, trigger an incremental pull to fetch server updates.
     */
    private suspend fun handleWebSocketMessage(message: WebSocketMessage) {
        Log.d(TAG, "WebSocket message received: type=${message.type}, entity=${message.entity}, id=${message.id}")

        when (message.type) {
            "change", "changes_available" -> {
                Log.d(TAG, "Change notification — triggering incremental pull")
                val metadata = syncMetadataDao.getMetadata()
                val since = metadata?.highWaterMark ?: 0
                syncEngine.performSync(since)
            }
            else -> {
                Log.d(TAG, "Ignoring WebSocket message of type: ${message.type}")
            }
        }
    }
}
