package com.cwoc.app.data.sync

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject

/**
 * Connectivity events emitted when network state transitions occur.
 */
sealed class ConnectivityEvent {
    object Online : ConnectivityEvent()
    object Offline : ConnectivityEvent()
}

/**
 * Interface for observing network connectivity state.
 * Uses Android's ConnectivityManager NetworkCallback under the hood.
 *
 * Validates: Requirements 10.1, 10.2, 10.3, 10.4
 */
interface ConnectivityMonitor {
    /** Current connectivity state as a hot observable. Always has a value. */
    val isOnline: StateFlow<Boolean>

    /** Stream of connectivity change events (Online/Offline transitions). */
    val events: Flow<ConnectivityEvent>
}

/**
 * Implementation of [ConnectivityMonitor] using Android's ConnectivityManager
 * and NetworkCallback API. Registers a callback at construction time to observe
 * network availability changes.
 *
 * Takes [Context] as a constructor parameter for Hilt injection with @ApplicationContext.
 */
class ConnectivityMonitorImpl @Inject constructor(
    @ApplicationContext private val context: Context
) : ConnectivityMonitor {

    private val connectivityManager =
        context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager

    private val _isOnline = MutableStateFlow(checkCurrentConnectivity())
    override val isOnline: StateFlow<Boolean> = _isOnline.asStateFlow()

    private val _events = MutableSharedFlow<ConnectivityEvent>(extraBufferCapacity = 16)
    override val events: Flow<ConnectivityEvent> = _events.asSharedFlow()

    private val networkCallback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) {
            if (!_isOnline.value) {
                _isOnline.value = true
                _events.tryEmit(ConnectivityEvent.Online)
            }
        }

        override fun onLost(network: Network) {
            // Only emit offline if there are no other active networks
            if (!hasActiveNetwork()) {
                _isOnline.value = false
                _events.tryEmit(ConnectivityEvent.Offline)
            }
        }

        override fun onCapabilitiesChanged(
            network: Network,
            networkCapabilities: NetworkCapabilities
        ) {
            val hasInternet = networkCapabilities.hasCapability(
                NetworkCapabilities.NET_CAPABILITY_INTERNET
            ) && networkCapabilities.hasCapability(
                NetworkCapabilities.NET_CAPABILITY_VALIDATED
            )

            if (hasInternet && !_isOnline.value) {
                _isOnline.value = true
                _events.tryEmit(ConnectivityEvent.Online)
            } else if (!hasInternet && _isOnline.value && !hasActiveNetwork()) {
                _isOnline.value = false
                _events.tryEmit(ConnectivityEvent.Offline)
            }
        }
    }

    init {
        val request = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build()
        connectivityManager.registerNetworkCallback(request, networkCallback)
    }

    /**
     * Checks the current connectivity state synchronously.
     * Used to initialize the StateFlow with the correct value.
     */
    private fun checkCurrentConnectivity(): Boolean {
        val activeNetwork = connectivityManager.activeNetwork ?: return false
        val capabilities = connectivityManager.getNetworkCapabilities(activeNetwork) ?: return false
        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
                capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
    }

    /**
     * Checks if there is any active network with internet capability.
     * Used to avoid false offline events when one network drops but another is available.
     */
    private fun hasActiveNetwork(): Boolean {
        val activeNetwork = connectivityManager.activeNetwork ?: return false
        val capabilities = connectivityManager.getNetworkCapabilities(activeNetwork) ?: return false
        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }
}
