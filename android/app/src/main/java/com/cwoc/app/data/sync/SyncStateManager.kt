package com.cwoc.app.data.sync

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Aggregated sync state for the UI indicator.
 * Green dot = ONLINE_IDLE, orange dot = SYNCING, red dot = OFFLINE.
 */
enum class SyncState {
    ONLINE_IDLE,
    SYNCING,
    OFFLINE
}

/**
 * Interface for managing the aggregated sync state.
 * Combines connectivity, WebSocket, and active sync status into a single observable.
 *
 * Validates: Requirements 11.1, 11.2, 11.3, 11.4
 */
interface SyncStateManager {
    val syncState: StateFlow<SyncState>
    fun setSyncing()
    fun setIdle()
}

/**
 * Implementation of [SyncStateManager] that combines connectivity state from
 * [ConnectivityMonitor] with an internal syncing flag to derive the aggregated [SyncState].
 *
 * State derivation logic:
 * - If offline → OFFLINE (regardless of syncing flag)
 * - If online and syncing → SYNCING
 * - If online and idle → ONLINE_IDLE
 *
 * Listens to [ConnectivityMonitor.isOnline] changes to automatically update state
 * (e.g., going offline immediately sets OFFLINE).
 *
 * Validates: Requirements 11.1, 11.2, 11.3, 11.4
 */
class SyncStateManagerImpl @Inject constructor(
    private val connectivityMonitor: ConnectivityMonitor
) : SyncStateManager {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    private val _isSyncing = MutableStateFlow(false)

    private val _syncState = MutableStateFlow(deriveState(connectivityMonitor.isOnline.value, false))
    override val syncState: StateFlow<SyncState> = _syncState.asStateFlow()

    init {
        // Listen to connectivity changes and re-derive state automatically
        scope.launch {
            connectivityMonitor.isOnline.collect { isOnline ->
                _syncState.value = deriveState(isOnline, _isSyncing.value)
            }
        }
    }

    override fun setSyncing() {
        _isSyncing.value = true
        _syncState.value = deriveState(connectivityMonitor.isOnline.value, true)
    }

    override fun setIdle() {
        _isSyncing.value = false
        _syncState.value = deriveState(connectivityMonitor.isOnline.value, false)
    }

    /**
     * Derives the aggregated [SyncState] from connectivity and syncing inputs.
     */
    private fun deriveState(isOnline: Boolean, isSyncing: Boolean): SyncState {
        return when {
            !isOnline -> SyncState.OFFLINE
            isSyncing -> SyncState.SYNCING
            else -> SyncState.ONLINE_IDLE
        }
    }
}
