package com.cwoc.app.data.sync

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Observes app-level lifecycle via ProcessLifecycleOwner.
 *
 * On foreground (ON_START): ensures SyncForegroundService is running
 * (in case Android killed it while the app was in the background).
 *
 * On background (ON_STOP): does nothing — the foreground service keeps
 * the WebSocket alive independently of the app UI lifecycle.
 *
 * Does NOT call connect/disconnect — that's the service's job.
 * Does NOT interact with WorkManager or SyncWorker.
 */
@Singleton
class AppLifecycleObserver @Inject constructor(
    @ApplicationContext private val context: Context,
    private val prefs: SharedPreferences
) : DefaultLifecycleObserver {

    companion object {
        private const val TAG = "AppLifecycleObserver"
    }

    override fun onStart(owner: LifecycleOwner) {
        // Ensure the foreground service is running (in case Android killed it)
        if (hasDeviceToken()) {
            Log.d(TAG, "App foregrounded — ensuring SyncForegroundService is running")
            try {
                SyncForegroundService.start(context)
            } catch (e: Exception) {
                // On some Android versions, starting a foreground service can fail
                // (e.g., ForegroundServiceStartNotAllowedException on Android 12+).
                // Don't crash the app — the service will start on next opportunity.
                Log.e(TAG, "Failed to start SyncForegroundService: ${e.message}", e)
            }
        } else {
            Log.d(TAG, "App foregrounded — no device_token, skipping service start")
        }
    }

    override fun onStop(owner: LifecycleOwner) {
        // Do nothing — service stays alive in background
        Log.d(TAG, "App backgrounded — service continues running independently")
    }

    private fun hasDeviceToken(): Boolean =
        prefs.getString("device_token", null)?.isNotBlank() == true
}
