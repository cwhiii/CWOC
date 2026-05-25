package com.cwoc.app.notification

import android.Manifest
import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.cwoc.app.MainActivity
import com.cwoc.app.R
import android.graphics.BitmapFactory

private const val TAG = "CWOC_ALARM_RECV"

/**
 * BroadcastReceiver that fires when an AlarmManager alarm triggers.
 * Creates and displays the appropriate notification based on alert type.
 *
 * Also handles Snooze and Dismiss actions from notification buttons.
 *
 * Routes to the correct notification channel (alarms, reminders, timers),
 * builds the notification with chit title and appropriate priority/sound,
 * and creates a PendingIntent to open the ChitEditor on tap.
 */
class AlarmReceiver : BroadcastReceiver() {

    companion object {
        const val ACTION_SNOOZE = "com.cwoc.app.SNOOZE_ALERT"
        const val ACTION_DISMISS = "com.cwoc.app.DISMISS_ALERT"
        private const val DEFAULT_SNOOZE_MINUTES = 5L
    }

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action

        when (action) {
            ACTION_SNOOZE -> handleSnooze(context, intent)
            ACTION_DISMISS -> handleDismiss(context, intent)
            else -> handleAlarmTrigger(context, intent)
        }
    }

    /**
     * Handles the main alarm trigger — builds and shows the notification.
     */
    private fun handleAlarmTrigger(context: Context, intent: Intent) {
        val chitId = intent.getStringExtra(NotificationSchedulerImpl.EXTRA_CHIT_ID) ?: return
        val chitTitle = intent.getStringExtra(NotificationSchedulerImpl.EXTRA_CHIT_TITLE) ?: "CWOC Alert"
        val alertTypeStr = intent.getStringExtra(NotificationSchedulerImpl.EXTRA_ALERT_TYPE) ?: "REMINDER"
        val alertIndex = intent.getIntExtra(NotificationSchedulerImpl.EXTRA_ALERT_INDEX, 0)

        Log.d(TAG, "Alarm triggered: chitId=$chitId, title=$chitTitle, type=$alertTypeStr, index=$alertIndex")

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
        val tapIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("navigate_to", "editor/$chitId")
        }

        val notificationId = getRequestCode(chitId, alertIndex)

        val tapPendingIntent = PendingIntent.getActivity(
            context,
            notificationId,
            tapIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Build notification
        val notification = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(R.drawable.ic_stat_cwoc)
            .setLargeIcon(BitmapFactory.decodeResource(context.resources, R.drawable.cwoc_logo))
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

                // Snooze action
                val snoozeIntent = Intent(context, AlarmReceiver::class.java).apply {
                    action = ACTION_SNOOZE
                    putExtra(NotificationSchedulerImpl.EXTRA_CHIT_ID, chitId)
                    putExtra(NotificationSchedulerImpl.EXTRA_CHIT_TITLE, chitTitle)
                    putExtra(NotificationSchedulerImpl.EXTRA_ALERT_TYPE, alertTypeStr)
                    putExtra(NotificationSchedulerImpl.EXTRA_ALERT_INDEX, alertIndex)
                }
                val snoozePendingIntent = PendingIntent.getBroadcast(
                    context,
                    (notificationId + 1000),
                    snoozeIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                addAction(0, "Snooze", snoozePendingIntent)

                // Dismiss action
                val dismissIntent = Intent(context, AlarmReceiver::class.java).apply {
                    action = ACTION_DISMISS
                    putExtra(NotificationSchedulerImpl.EXTRA_CHIT_ID, chitId)
                    putExtra(NotificationSchedulerImpl.EXTRA_ALERT_INDEX, alertIndex)
                }
                val dismissPendingIntent = PendingIntent.getBroadcast(
                    context,
                    (notificationId + 2000),
                    dismissIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                addAction(0, "Dismiss", dismissPendingIntent)
            }
            .build()

        // Check POST_NOTIFICATIONS permission (API 33+) before calling notify()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(
                    context,
                    Manifest.permission.POST_NOTIFICATIONS
                ) != PackageManager.PERMISSION_GRANTED
            ) {
                Log.w(TAG, "POST_NOTIFICATIONS permission not granted — cannot show notification")
                return
            }
        }

        NotificationManagerCompat.from(context).notify(notificationId, notification)
        Log.d(TAG, "Notification posted: id=$notificationId")
    }

    /**
     * Handles the Snooze action: dismisses the current notification and schedules
     * a new alarm 5 minutes from now with the same parameters.
     */
    private fun handleSnooze(context: Context, intent: Intent) {
        val chitId = intent.getStringExtra(NotificationSchedulerImpl.EXTRA_CHIT_ID) ?: return
        val chitTitle = intent.getStringExtra(NotificationSchedulerImpl.EXTRA_CHIT_TITLE) ?: "CWOC Alert"
        val alertTypeStr = intent.getStringExtra(NotificationSchedulerImpl.EXTRA_ALERT_TYPE) ?: "REMINDER"
        val alertIndex = intent.getIntExtra(NotificationSchedulerImpl.EXTRA_ALERT_INDEX, 0)

        Log.d(TAG, "Snooze: chitId=$chitId, rescheduling in $DEFAULT_SNOOZE_MINUTES minutes")

        // Dismiss the current notification
        val notificationId = getRequestCode(chitId, alertIndex)
        NotificationManagerCompat.from(context).cancel(notificationId)

        // Schedule a new alarm DEFAULT_SNOOZE_MINUTES from now
        val snoozeMillis = System.currentTimeMillis() + (DEFAULT_SNOOZE_MINUTES * 60_000L)

        val alarmIntent = Intent(context, AlarmReceiver::class.java).apply {
            action = NotificationSchedulerImpl.ACTION_ALARM_TRIGGER
            putExtra(NotificationSchedulerImpl.EXTRA_CHIT_ID, chitId)
            putExtra(NotificationSchedulerImpl.EXTRA_CHIT_TITLE, chitTitle)
            putExtra(NotificationSchedulerImpl.EXTRA_ALERT_TYPE, alertTypeStr)
            putExtra(NotificationSchedulerImpl.EXTRA_ALERT_INDEX, alertIndex)
        }

        val requestCode = getRequestCode(chitId, alertIndex)
        val pendingIntent = PendingIntent.getBroadcast(
            context, requestCode, alarmIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && alarmManager.canScheduleExactAlarms()) {
            alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, snoozeMillis, pendingIntent)
        } else if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, snoozeMillis, pendingIntent)
        } else {
            alarmManager.set(AlarmManager.RTC_WAKEUP, snoozeMillis, pendingIntent)
        }

        Log.d(TAG, "Snoozed alarm rescheduled for ${java.time.Instant.ofEpochMilli(snoozeMillis)}")
    }

    /**
     * Handles the Dismiss action: cancels the notification.
     */
    private fun handleDismiss(context: Context, intent: Intent) {
        val chitId = intent.getStringExtra(NotificationSchedulerImpl.EXTRA_CHIT_ID) ?: return
        val alertIndex = intent.getIntExtra(NotificationSchedulerImpl.EXTRA_ALERT_INDEX, 0)

        Log.d(TAG, "Dismiss: chitId=$chitId, alertIndex=$alertIndex")

        // Cancel the notification
        val notificationId = getRequestCode(chitId, alertIndex)
        NotificationManagerCompat.from(context).cancel(notificationId)
    }

    /**
     * Deterministic request code from "chitId:alertIndex" hash.
     * Matches the same algorithm used in NotificationSchedulerImpl.
     */
    private fun getRequestCode(chitId: String, alertIndex: Int): Int {
        return "$chitId:$alertIndex".hashCode() and Int.MAX_VALUE
    }
}
