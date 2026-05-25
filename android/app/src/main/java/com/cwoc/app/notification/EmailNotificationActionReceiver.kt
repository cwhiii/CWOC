package com.cwoc.app.notification

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.core.app.NotificationManagerCompat
import com.cwoc.app.data.repository.ChitRepository
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.android.EntryPointAccessors
import dagger.hilt.components.SingletonComponent
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.temporal.ChronoUnit

private const val TAG = "CWOC_EMAIL_ACTION"

/**
 * BroadcastReceiver that handles email notification action buttons:
 * - Trash (move to email trash folder)
 * - Archive (mark as archived)
 * - Mark Read (mark email as read)
 * - Snooze (snooze for 1 hour)
 *
 * Uses Hilt EntryPoint to access ChitRepository since BroadcastReceivers
 * cannot use constructor injection.
 */
class EmailNotificationActionReceiver : BroadcastReceiver() {

    companion object {
        const val ACTION_EMAIL_DELETE = "com.cwoc.app.EMAIL_DELETE"
        const val ACTION_EMAIL_ARCHIVE = "com.cwoc.app.EMAIL_ARCHIVE"
        const val ACTION_EMAIL_SNOOZE = "com.cwoc.app.EMAIL_SNOOZE"
        const val ACTION_EMAIL_MARK_READ = "com.cwoc.app.EMAIL_MARK_READ"

        const val EXTRA_CHIT_ID = "chit_id"
        const val EXTRA_NOTIFICATION_ID = "notification_id"

        private const val SNOOZE_HOURS = 1L
    }

    @EntryPoint
    @InstallIn(SingletonComponent::class)
    interface EmailActionEntryPoint {
        fun chitRepository(): ChitRepository
    }

    override fun onReceive(context: Context, intent: Intent) {
        val chitId = intent.getStringExtra(EXTRA_CHIT_ID) ?: return
        val notificationId = intent.getIntExtra(EXTRA_NOTIFICATION_ID, -1)

        Log.d(TAG, "Email action received: action=${intent.action}, chitId=$chitId, notifId=$notificationId")

        // Dismiss the notification immediately
        if (notificationId >= 0) {
            NotificationManagerCompat.from(context).cancel(notificationId)
        }

        val entryPoint = EntryPointAccessors.fromApplication(
            context.applicationContext,
            EmailActionEntryPoint::class.java
        )
        val chitRepository = entryPoint.chitRepository()

        val pendingResult = goAsync()

        CoroutineScope(Dispatchers.IO).launch {
            try {
                when (intent.action) {
                    ACTION_EMAIL_DELETE -> {
                        Log.d(TAG, "Deleting email chit: $chitId")
                        chitRepository.moveEmailToTrash(chitId)
                    }
                    ACTION_EMAIL_ARCHIVE -> {
                        Log.d(TAG, "Archiving email chit: $chitId")
                        chitRepository.archive(chitId)
                    }
                    ACTION_EMAIL_SNOOZE -> {
                        val until = Instant.now().plus(SNOOZE_HOURS, ChronoUnit.HOURS).toString()
                        Log.d(TAG, "Snoozing email chit: $chitId until $until")
                        chitRepository.snooze(chitId, until)
                    }
                    ACTION_EMAIL_MARK_READ -> {
                        Log.d(TAG, "Marking email chit as read: $chitId")
                        chitRepository.markEmailAsRead(chitId)
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to handle email action: ${e.message}", e)
            } finally {
                pendingResult.finish()
            }
        }
    }
}
