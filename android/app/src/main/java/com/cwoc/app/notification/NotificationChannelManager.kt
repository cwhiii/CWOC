package com.cwoc.app.notification

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.media.AudioAttributes
import android.media.RingtoneManager
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Creates and registers CWOC notification channels at app startup.
 * Safe to call multiple times — Android ignores duplicate channel creation.
 */
@Singleton
class NotificationChannelManager @Inject constructor(
    @ApplicationContext private val context: Context
) {

    companion object {
        const val CHANNEL_ID_ALARMS = "cwoc_alarms"
        const val CHANNEL_ID_REMINDERS = "cwoc_reminders"
        const val CHANNEL_ID_TIMERS = "cwoc_timers"
    }

    /**
     * Creates the three CWOC notification channels.
     * Idempotent — calling this multiple times has no effect after the first creation.
     * Android's NotificationManager.createNotificationChannel() is a no-op if the channel
     * already exists (it will not modify user-changed settings).
     */
    fun createChannels() {
        val notificationManager =
            context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        val defaultAlarmSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
        val alarmAudioAttributes = AudioAttributes.Builder()
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .setUsage(AudioAttributes.USAGE_ALARM)
            .build()

        // Alarms channel — high importance, sound + vibration
        val alarmsChannel = NotificationChannel(
            CHANNEL_ID_ALARMS,
            "Alarms",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "High-priority alarm notifications with sound and vibration"
            enableVibration(true)
            setSound(defaultAlarmSound, alarmAudioAttributes)
        }

        // Reminders channel — default importance, no sound
        val remindersChannel = NotificationChannel(
            CHANNEL_ID_REMINDERS,
            "Reminders",
            NotificationManager.IMPORTANCE_DEFAULT
        ).apply {
            description = "Reminder notifications without sound"
            enableVibration(false)
            setSound(null, null)
        }

        // Timers channel — high importance, sound + vibration
        val timersChannel = NotificationChannel(
            CHANNEL_ID_TIMERS,
            "Timers",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Timer notifications with sound and vibration"
            enableVibration(true)
            setSound(defaultAlarmSound, alarmAudioAttributes)
        }

        notificationManager.createNotificationChannels(
            listOf(alarmsChannel, remindersChannel, timersChannel)
        )
    }
}
