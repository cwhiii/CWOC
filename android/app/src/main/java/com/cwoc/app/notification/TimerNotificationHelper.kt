package com.cwoc.app.notification

import android.Manifest
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.cwoc.app.MainActivity
import com.cwoc.app.R
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Fires an immediate local notification when a standalone timer completes.
 *
 * Unlike NotificationScheduler (which schedules future alarms via AlarmManager),
 * this helper posts a notification directly and immediately — used by the
 * AlertsViewModel when a TimerRuntime's countdown reaches zero.
 *
 * Uses the existing CHANNEL_ID_TIMERS channel (high importance, sound + vibration).
 *
 * Requirements: 7.3
 */
@Singleton
class TimerNotificationHelper @Inject constructor(
    @ApplicationContext private val context: Context
) {

    /**
     * Posts an immediate notification indicating a timer has completed.
     *
     * @param alertId The standalone alert ID (used for unique notification ID)
     * @param timerName The timer's display name (shown in notification content)
     */
    fun fireTimerCompleteNotification(alertId: String, timerName: String?) {
        val displayName = if (timerName.isNullOrBlank()) "Timer" else timerName

        // Create PendingIntent to open the app on tap (navigates to alerts view)
        val tapIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("navigate_to", "alerts")
        }

        val notificationId = "timer_done:$alertId".hashCode() and Int.MAX_VALUE

        val tapPendingIntent = PendingIntent.getActivity(
            context,
            notificationId,
            tapIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(context, NotificationChannelManager.CHANNEL_ID_TIMERS)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("Timer Complete")
            .setContentText("$displayName has finished")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(tapPendingIntent)
            .setDefaults(NotificationCompat.DEFAULT_SOUND or NotificationCompat.DEFAULT_VIBRATE)
            .build()

        // Check POST_NOTIFICATIONS permission (API 33+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(
                    context,
                    Manifest.permission.POST_NOTIFICATIONS
                ) != PackageManager.PERMISSION_GRANTED
            ) {
                return
            }
        }

        NotificationManagerCompat.from(context).notify(notificationId, notification)
    }
}
