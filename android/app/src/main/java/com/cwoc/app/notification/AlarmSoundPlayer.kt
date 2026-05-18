package com.cwoc.app.notification

import android.content.Context
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.net.Uri

/**
 * L7: In-app alarm sound player.
 * Plays the device's default alarm sound when an alarm fires within the app.
 * Falls back to the default notification sound if no alarm sound is configured.
 *
 * Usage:
 *   AlarmSoundPlayer.play(context)  // Play alarm sound
 *   AlarmSoundPlayer.stop()         // Stop playing
 */
object AlarmSoundPlayer {

    private var mediaPlayer: MediaPlayer? = null

    /**
     * Play the default alarm sound.
     * If no alarm sound is available, falls back to notification sound.
     */
    fun play(context: Context) {
        stop() // Stop any currently playing sound

        val alarmUri: Uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
            ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
            ?: return

        try {
            mediaPlayer = MediaPlayer().apply {
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                )
                setDataSource(context, alarmUri)
                isLooping = false
                prepare()
                start()
            }
        } catch (e: Exception) {
            android.util.Log.e("CWOC_ALARM", "Failed to play alarm sound: ${e.message}")
        }
    }

    /**
     * Play alarm sound with looping (for alarms that should keep ringing until dismissed).
     */
    fun playLooping(context: Context) {
        stop()

        val alarmUri: Uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
            ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
            ?: return

        try {
            mediaPlayer = MediaPlayer().apply {
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                )
                setDataSource(context, alarmUri)
                isLooping = true
                prepare()
                start()
            }
        } catch (e: Exception) {
            android.util.Log.e("CWOC_ALARM", "Failed to play alarm sound: ${e.message}")
        }
    }

    /**
     * Stop the currently playing alarm sound.
     */
    fun stop() {
        mediaPlayer?.let {
            try {
                if (it.isPlaying) it.stop()
                it.release()
            } catch (_: Exception) {}
        }
        mediaPlayer = null
    }

    /**
     * Check if an alarm sound is currently playing.
     */
    fun isPlaying(): Boolean {
        return mediaPlayer?.isPlaying == true
    }
}
