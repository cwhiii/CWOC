package com.cwoc.app.notification

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKeys
import com.cwoc.app.data.sync.SyncForegroundService
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.android.EntryPointAccessors
import dagger.hilt.components.SingletonComponent
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/**
 * BroadcastReceiver that fires on BOOT_COMPLETED to:
 * 1. Start SyncForegroundService if the user is authenticated (device_token present)
 * 2. Re-register all AlarmManager alarms that were lost when the device rebooted
 *
 * Uses Hilt EntryPoint (since BroadcastReceivers can't use constructor injection)
 * and goAsync() + coroutine to perform the suspend call to rescheduleAll().
 */
class BootReceiver : BroadcastReceiver() {

    @EntryPoint
    @InstallIn(SingletonComponent::class)
    interface BootReceiverEntryPoint {
        fun notificationScheduler(): NotificationScheduler
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return

        // Start SyncForegroundService if authenticated
        if (hasDeviceToken(context)) {
            try {
                SyncForegroundService.start(context)
            } catch (e: Exception) {
                android.util.Log.e("CWOC_BOOT", "Failed to start SyncForegroundService on boot: ${e.message}", e)
            }
        }

        // Existing alarm rescheduling logic
        val pendingResult = goAsync()

        val entryPoint = EntryPointAccessors.fromApplication(
            context.applicationContext,
            BootReceiverEntryPoint::class.java
        )
        val scheduler = entryPoint.notificationScheduler()

        CoroutineScope(Dispatchers.IO).launch {
            try {
                scheduler.rescheduleAll()
            } finally {
                pendingResult.finish()
            }
        }
    }

    /**
     * Checks EncryptedSharedPreferences for a valid device_token.
     * Returns true if a non-blank token is present, false otherwise.
     */
    private fun hasDeviceToken(context: Context): Boolean {
        return try {
            val masterKeyAlias = MasterKeys.getOrCreate(MasterKeys.AES256_GCM_SPEC)
            val prefs = EncryptedSharedPreferences.create(
                "cwoc_secure_prefs",
                masterKeyAlias,
                context.applicationContext,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            )
            !prefs.getString("device_token", null).isNullOrBlank()
        } catch (_: Exception) {
            false
        }
    }
}
