package com.cwoc.app.notification

import android.Manifest
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.cwoc.app.MainActivity
import com.cwoc.app.R

/**
 * BroadcastReceiver that fires when an AlarmManager alarm triggers.
 * Creates and displays the appropriate notification based on alert type.
 *
 * Routes to the correct notification channel (alarms, reminders, timers),
 * builds the notification with chit title and appropriate priority/sound,
 * and creates a PendingIntent to open the ChitEditor on tap.
 */
class AlarmReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        // Extract extras from the intent (defined in NotificationScheduler companion)
        val chitId = intent.getStringExtra(NotificationSchedulerImpl.EXTRA_CHIT_ID) ?: return
        val chitTitle = intent.getStringExtra(NotificationSchedulerImpl.EXTRA_CHIT_TITLE) ?: "CWOC Alert"
        val alertTypeStr = intent.getStringExtra(NotificationSchedulerImpl.EXTRA_ALERT_TYPE) ?: "REMINDER"
        val alertIndex = intent.getIntExtra(NotificationSchedulerImpl.EXTRA_ALERT_INDEX, 0)

        // Parse alert type
        val alertType = try {
            AlertType.valueOf(alertTypeStr)
        } catch (e: IllegalArgumentException) {
            AlertType.REMINDER
        }

        // Route to correct notification channel based on AlertType
        val channelId = when (alertType) {
            AlertType.ALARM -> NotificationChannelManager.CHANNEL_ID_ALARMS
            AlertType.REMINDER -> NotificationChannelManager.CHANNEL_ID_REMINDERS
            AlertType.TIMER -> NotificationChannelManager.CHANNEL_ID_TIMERS
        }

        // Determine content text based on type
        val contentText = when (alertType) {
            AlertType.ALARM -> "CWOC Alarm"
            AlertType.REMINDER -> "CWOC Reminder"
            AlertType.TIMER -> "CWOC Timer"
        }

        // Determine priority based on type (HIGH for alarms/timers, DEFAULT for reminders)
        val priority = when (alertType) {
            AlertType.ALARM -> NotificationCompat.PRIORITY_HIGH
            AlertType.REMINDER -> NotificationCompat.PRIORITY_DEFAULT
            AlertType.TIMER -> NotificationCompat.PRIORITY_HIGH
        }

        // Create PendingIntent to open ChitEditor on tap
        // Uses deep link navigation route: "editor/{chitId}"
        val tapIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("navigate_to", "editor/$chitId")
        }

        val tapPendingIntent = PendingIntent.getActivity(
            context,
            getRequestCode(chitId, alertIndex),
            tapIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Build notification
        val notification = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(chitTitle)
            .setContentText(contentText)
            .setPriority(priority)
            .setAutoCancel(true)
            .setContentIntent(tapPendingIntent)
            .apply {
                // Add sound and vibration for alarms and timers
                if (alertType == AlertType.ALARM || alertType == AlertType.TIMER) {
                    setDefaults(NotificationCompat.DEFAULT_SOUND or NotificationCompat.DEFAULT_VIBRATE)
                }
            }
            .build()

        // Check POST_NOTIFICATIONS permission (API 33+) before calling notify()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(
                    context,
                    Manifest.permission.POST_NOTIFICATIONS
                ) != PackageManager.PERMISSION_GRANTED
            ) {
                // Permission not granted — cannot show notification
                return
            }
        }

        // Use the same request code hash as the scheduler (chitId:alertIndex) for notification ID
        val notificationId = getRequestCode(chitId, alertIndex)
        NotificationManagerCompat.from(context).notify(notificationId, notification)
    }

    /**
     * Deterministic request code from "chitId:alertIndex" hash.
     * Matches the same algorithm used in NotificationSchedulerImpl.
     */
    private fun getRequestCode(chitId: String, alertIndex: Int): Int {
        return "$chitId:$alertIndex".hashCode() and Int.MAX_VALUE
    }
}
