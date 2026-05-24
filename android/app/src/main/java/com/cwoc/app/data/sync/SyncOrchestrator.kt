package com.cwoc.app.data.sync

import android.content.Context
import android.util.Log
import com.cwoc.app.data.local.dao.SyncMetadataDao
import com.cwoc.app.data.repository.SyncResult
import com.cwoc.app.widget.refresh.WidgetUpdateWorker
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
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

    companion object {
        /** Message types that trigger a sync pull from the server. */
        val SYNC_TRIGGER_TYPES = setOf(
            "chits_changed",
            "settings_changed",
            "contacts_changed",
            "change",
            "changes_available"
        )
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    // Sync coalescing state — ensures at most one sync runs at a time with one queued follow-up
    private val syncMutex = Mutex()
    private var syncInProgress = false
    private var syncQueued = false

    // Retry state — single retry after 5 seconds on sync failure
    private var retryJob: Job? = null

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

        // Collect WebSocket connection state — trigger catch-up sync on reconnection (false→true)
        scope.launch {
            var wasConnected = false
            webSocketClient.isConnected.collect { connected ->
                if (!wasConnected && connected) {
                    Log.d(TAG, "WebSocket reconnected — triggering catch-up sync")
                    triggerCatchUpSync()
                }
                wasConnected = connected
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
     * Called after successful login to establish the WebSocket connection.
     * At startup, credentials aren't available yet so the initial connect fails.
     * This ensures the WebSocket connects once credentials are stored.
     */
    fun connectAfterLogin() {
        Log.d(TAG, "Post-login — connecting WebSocket")
        webSocketClient.connect()
    }

    /**
     * Stop the orchestrator. Cancels any pending retry job.
     * Called when the service stops.
     */
    fun stop() {
        Log.d(TAG, "SyncOrchestrator stopping — cancelling retry job")
        retryJob?.cancel()
        retryJob = null
    }

    /**
     * Handle incoming WebSocket messages.
     * Recognized message types trigger an incremental pull with coalescing:
     * - If no sync is in progress, start one immediately
     * - If a sync is already running, queue a single follow-up (coalescing multiple messages)
     * - After the current sync completes, execute the queued follow-up if present
     * Unrecognized types are logged at debug level and ignored.
     */
    private suspend fun handleWebSocketMessage(message: WebSocketMessage) {
        Log.d(TAG, "WebSocket message received: type=${message.type}, entity=${message.entity}, id=${message.id}")

        if (message.type !in SYNC_TRIGGER_TYPES) {
            Log.d(TAG, "Unrecognized WebSocket message type: ${message.type} — ignoring")
            return
        }

        syncMutex.withLock {
            if (syncInProgress) {
                Log.d(TAG, "Sync already in progress — queuing follow-up sync")
                syncQueued = true
                return
            }
            syncInProgress = true
        }

        Log.d(TAG, "Change notification — triggering incremental pull")
        performSyncAndHandleQueue()
    }

    /**
     * Performs a sync, then checks if another sync was queued during execution.
     * If queued, resets the flag and performs one more sync.
     * After all syncs complete, sets syncInProgress = false.
     * If a sync fails, schedules a single retry after 5 seconds.
     */
    private suspend fun performSyncAndHandleQueue() {
        try {
            val result = executeSyncPull()

            // If sync failed, schedule a single retry after 5 seconds
            if (result !is SyncResult.Success) {
                Log.d(TAG, "Sync failed — scheduling single retry in 5 seconds")
                scheduleRetry()
            }

            // Check if a follow-up sync was queued while we were syncing
            val shouldRunFollowUp = syncMutex.withLock {
                if (syncQueued) {
                    syncQueued = false
                    true
                } else {
                    false
                }
            }

            if (shouldRunFollowUp) {
                Log.d(TAG, "Executing queued follow-up sync")
                val followUpResult = executeSyncPull()
                if (followUpResult !is SyncResult.Success) {
                    Log.d(TAG, "Follow-up sync failed — scheduling single retry in 5 seconds")
                    scheduleRetry()
                }
            }
        } finally {
            syncMutex.withLock {
                syncInProgress = false
            }
        }
    }

    /**
     * Schedules a single retry of executeSyncPull() after 5 seconds.
     * If the retry also fails, does nothing further (waits for next message).
     * Cancels any previously scheduled retry before scheduling a new one.
     */
    private fun scheduleRetry() {
        retryJob?.cancel()
        retryJob = scope.launch {
            delay(5_000L)
            Log.d(TAG, "Executing retry sync after 5-second delay")
            val retryResult = executeSyncPull()
            if (retryResult !is SyncResult.Success) {
                Log.d(TAG, "Retry sync also failed — waiting for next message")
            } else {
                Log.d(TAG, "Retry sync succeeded")
            }
        }
    }

    /**
     * Triggers an immediate catch-up sync when the WebSocket reconnects (false→true transition).
     * Uses the same coalescing logic to avoid concurrent syncs.
     */
    private fun triggerCatchUpSync() {
        scope.launch {
            syncMutex.withLock {
                if (syncInProgress) {
                    Log.d(TAG, "Catch-up sync: sync already in progress — queuing follow-up")
                    syncQueued = true
                    return@launch
                }
                syncInProgress = true
            }

            Log.d(TAG, "Catch-up sync — triggering incremental pull after reconnection")
            performSyncAndHandleQueue()
        }
    }

    /**
     * Executes a single sync pull using the current high water mark.
     * Returns the SyncResult to allow callers to handle failure.
     */
    private suspend fun executeSyncPull(): SyncResult {
        val metadata = syncMetadataDao.getMetadata()
        val since = metadata?.highWaterMark ?: 0
        val result = syncEngine.performSync(since)
        if (result is SyncResult.Success) {
            Log.d(TAG, "Sync pull complete — refreshing widgets")
            WidgetUpdateWorker.refreshNow(context)
        }
        return result
    }
}
