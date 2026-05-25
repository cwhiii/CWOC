package com.cwoc.app.notification

import android.Manifest
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.BitmapFactory
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.cwoc.app.MainActivity
import com.cwoc.app.R
import com.cwoc.app.data.local.entity.ChitEntity
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

private const val TAG = "CWOC_EMAIL_NOTIF"

/**
 * Shows Android notifications when new emails arrive via sync.
 *
 * Called by SyncEngine when it detects newly-synced chits that are emails
 * (emailMessageId is non-null) and weren't previously in the local DB.
 */
@Singleton
class EmailNotificationHelper @Inject constructor(
    @ApplicationContext private val context: Context
) {

    companion object {
        /** Base notification ID for email notifications. Uses chit ID hash for uniqueness. */
        private const val EMAIL_NOTIFICATION_BASE = 20_000
    }

    /**
     * Show a notification for a newly arrived email chit.
     *
     * @param chit The email ChitEntity that was just synced from the server.
     */
    fun showEmailNotification(chit: ChitEntity) {
        val sender = chit.emailFrom ?: "Unknown"
        val subject = chit.emailSubject ?: chit.title ?: "No subject"

        Log.d(TAG, "Showing email notification: from=$sender, subject=$subject, chitId=${chit.id}")

        // Check POST_NOTIFICATIONS permission (API 33+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(
                    context,
                    Manifest.permission.POST_NOTIFICATIONS
                ) != PackageManager.PERMISSION_GRANTED
            ) {
                Log.w(TAG, "POST_NOTIFICATIONS permission not granted — cannot show email notification")
                return
            }
        }

        // Create PendingIntent to open the chit in email expanded editor on tap
        val tapIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("navigate_to", "editor/${chit.id}?sourceTab=Email")
        }

        val notificationId = getNotificationId(chit.id)

        val tapPendingIntent = PendingIntent.getActivity(
            context,
            notificationId,
            tapIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Extract just the sender name (strip email address if present)
        val senderDisplay = extractSenderName(sender)

        val notification = NotificationCompat.Builder(context, NotificationChannelManager.CHANNEL_ID_EMAIL)
            .setSmallIcon(R.drawable.ic_stat_cwoc)
            .setLargeIcon(BitmapFactory.decodeResource(context.resources, R.drawable.cwoc_logo))
            .setContentTitle("📬 $senderDisplay")
            .setContentText(subject)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true)
            .setContentIntent(tapPendingIntent)
            .setGroup("cwoc_email_group")
            .apply {
                // Trash action
                val deleteIntent = Intent(context, EmailNotificationActionReceiver::class.java).apply {
                    action = EmailNotificationActionReceiver.ACTION_EMAIL_DELETE
                    putExtra(EmailNotificationActionReceiver.EXTRA_CHIT_ID, chit.id)
                    putExtra(EmailNotificationActionReceiver.EXTRA_NOTIFICATION_ID, notificationId)
                }
                val deletePendingIntent = PendingIntent.getBroadcast(
                    context,
                    notificationId + 1000,
                    deleteIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                addAction(0, "Trash", deletePendingIntent)

                // Archive action
                val archiveIntent = Intent(context, EmailNotificationActionReceiver::class.java).apply {
                    action = EmailNotificationActionReceiver.ACTION_EMAIL_ARCHIVE
                    putExtra(EmailNotificationActionReceiver.EXTRA_CHIT_ID, chit.id)
                    putExtra(EmailNotificationActionReceiver.EXTRA_NOTIFICATION_ID, notificationId)
                }
                val archivePendingIntent = PendingIntent.getBroadcast(
                    context,
                    notificationId + 2000,
                    archiveIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                addAction(0, "Archive", archivePendingIntent)

                // Mark Read action
                val markReadIntent = Intent(context, EmailNotificationActionReceiver::class.java).apply {
                    action = EmailNotificationActionReceiver.ACTION_EMAIL_MARK_READ
                    putExtra(EmailNotificationActionReceiver.EXTRA_CHIT_ID, chit.id)
                    putExtra(EmailNotificationActionReceiver.EXTRA_NOTIFICATION_ID, notificationId)
                }
                val markReadPendingIntent = PendingIntent.getBroadcast(
                    context,
                    notificationId + 4000,
                    markReadIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                addAction(0, "Mark Read", markReadPendingIntent)

                // Snooze action
                val snoozeIntent = Intent(context, EmailNotificationActionReceiver::class.java).apply {
                    action = EmailNotificationActionReceiver.ACTION_EMAIL_SNOOZE
                    putExtra(EmailNotificationActionReceiver.EXTRA_CHIT_ID, chit.id)
                    putExtra(EmailNotificationActionReceiver.EXTRA_NOTIFICATION_ID, notificationId)
                }
                val snoozePendingIntent = PendingIntent.getBroadcast(
                    context,
                    notificationId + 3000,
                    snoozeIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                addAction(0, "Snooze", snoozePendingIntent)
            }
            .build()

        NotificationManagerCompat.from(context).notify(notificationId, notification)
        Log.d(TAG, "Email notification posted: id=$notificationId")
    }

    /**
     * Show a summary notification when multiple emails arrive at once.
     *
     * @param count Number of new emails.
     */
    fun showEmailSummaryNotification(count: Int) {
        if (count <= 1) return

        Log.d(TAG, "Showing email summary notification: $count new emails")

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

        val summaryNotification = NotificationCompat.Builder(context, NotificationChannelManager.CHANNEL_ID_EMAIL)
            .setSmallIcon(R.drawable.ic_stat_cwoc)
            .setLargeIcon(BitmapFactory.decodeResource(context.resources, R.drawable.cwoc_logo))
            .setContentTitle("📬 New Email")
            .setContentText("$count new emails")
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true)
            .setGroup("cwoc_email_group")
            .setGroupSummary(true)
            .build()

        NotificationManagerCompat.from(context).notify(EMAIL_NOTIFICATION_BASE, summaryNotification)
    }

    /**
     * Extracts a display name from an email "From" field.
     * e.g. "John Doe <john@example.com>" → "John Doe"
     * e.g. "john@example.com" → "john@example.com"
     */
    private fun extractSenderName(from: String): String {
        val angleStart = from.indexOf('<')
        if (angleStart > 0) {
            return from.substring(0, angleStart).trim().trim('"')
        }
        return from.trim()
    }

    /**
     * Deterministic notification ID from chit ID hash.
     */
    private fun getNotificationId(chitId: String): Int {
        return (chitId.hashCode() and Int.MAX_VALUE) % 10_000 + EMAIL_NOTIFICATION_BASE
    }
}
