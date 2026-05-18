package com.cwoc.app.ui.screens.alerts

import android.content.Context
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Alarm
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Snooze
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.cwoc.app.ui.theme.CwocTheme
import com.cwoc.app.ui.theme.CwocZoneHeaderBrown
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

/**
 * Full-screen Activity that shows when an alarm fires.
 * Displays over the lock screen with alarm details and snooze/dismiss options.
 * This is a standalone Activity, NOT part of Navigation Compose.
 *
 * Task 38.2: AlarmFiredActivity (full-screen alarm).
 *
 * Intent extras:
 * - "alarm_title" (String): The alarm/chit title
 * - "alarm_description" (String): Optional description
 * - "alarm_time" (String): The alarm time string
 * - "chit_id" (String): The chit ID for snooze operations
 */
class AlarmFiredActivity : ComponentActivity() {

    private var ringtone: android.media.Ringtone? = null
    private var vibrator: Vibrator? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Show over lock screen
        setShowWhenLocked(true)
        setTurnScreenOn(true)

        // Extract intent extras
        val alarmTitle = intent.getStringExtra("alarm_title") ?: "Alarm"
        val alarmDescription = intent.getStringExtra("alarm_description") ?: ""
        val alarmTime = intent.getStringExtra("alarm_time") ?: getCurrentTimeFormatted()
        val chitId = intent.getStringExtra("chit_id") ?: ""

        // Start alarm sound
        startAlarmSound()

        // Start vibration
        startVibration()

        setContent {
            CwocTheme {
                AlarmFiredScreen(
                    title = alarmTitle,
                    description = alarmDescription,
                    time = alarmTime,
                    onDismiss = {
                        stopAlarm()
                        finish()
                    },
                    onSnooze = { minutes ->
                        stopAlarm()
                        scheduleSnooze(chitId, alarmTitle, minutes)
                        finish()
                    }
                )
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        stopAlarm()
    }

    private fun startAlarmSound() {
        try {
            val alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
            ringtone = RingtoneManager.getRingtone(this, alarmUri)
            ringtone?.audioAttributes = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()
            ringtone?.play()
        } catch (_: Exception) {
            // Silently fail if alarm sound can't play
        }
    }

    private fun startVibration() {
        try {
            vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vibratorManager = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
                vibratorManager.defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
            }

            // Vibrate pattern: wait 0ms, vibrate 500ms, pause 500ms, repeat
            val pattern = longArrayOf(0, 500, 500, 500, 500, 500)
            vibrator?.vibrate(VibrationEffect.createWaveform(pattern, 0))
        } catch (_: Exception) {
            // Silently fail if vibration can't start
        }
    }

    private fun stopAlarm() {
        ringtone?.stop()
        ringtone = null
        vibrator?.cancel()
        vibrator = null
    }

    private fun scheduleSnooze(chitId: String, title: String, minutes: Int) {
        // Schedule a new alarm for `minutes` from now
        // This would integrate with the app's AlarmManager scheduling
        // For now, broadcast an intent that the alarm receiver can pick up
        val snoozeIntent = android.content.Intent("com.cwoc.app.SNOOZE_ALARM").apply {
            putExtra("chit_id", chitId)
            putExtra("alarm_title", title)
            putExtra("snooze_minutes", minutes)
            setPackage(packageName)
        }
        sendBroadcast(snoozeIntent)
    }

    private fun getCurrentTimeFormatted(): String {
        return try {
            LocalDateTime.now().format(DateTimeFormatter.ofPattern("h:mm a"))
        } catch (_: Exception) {
            ""
        }
    }
}

/**
 * Full-screen alarm UI composable.
 * Shows alarm title, time, description, and Dismiss/Snooze buttons.
 */
@Composable
private fun AlarmFiredScreen(
    title: String,
    description: String,
    time: String,
    onDismiss: () -> Unit,
    onSnooze: (Int) -> Unit
) {
    var showSnoozeMenu by remember { mutableStateOf(false) }

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            // Alarm icon
            Icon(
                imageVector = Icons.Default.Alarm,
                contentDescription = "Alarm",
                modifier = Modifier.size(80.dp),
                tint = CwocZoneHeaderBrown
            )

            Spacer(modifier = Modifier.height(24.dp))

            // Time
            Text(
                text = time,
                style = MaterialTheme.typography.displayMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onBackground,
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Title
            Text(
                text = title,
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Medium,
                color = CwocZoneHeaderBrown,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth()
            )

            // Description
            if (description.isNotBlank()) {
                Spacer(modifier = Modifier.height(12.dp))
                Text(
                    text = description,
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth()
                )
            }

            Spacer(modifier = Modifier.height(48.dp))

            // Action buttons
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterHorizontally)
            ) {
                // Dismiss button
                Button(
                    onClick = onDismiss,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.error,
                        contentColor = Color.White
                    ),
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = null,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Dismiss", fontSize = 16.sp)
                }

                // Snooze button with dropdown
                Column(modifier = Modifier.weight(1f)) {
                    OutlinedButton(
                        onClick = { showSnoozeMenu = true },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Icon(
                            imageVector = Icons.Default.Snooze,
                            contentDescription = null,
                            modifier = Modifier.size(20.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Snooze", fontSize = 16.sp)
                    }

                    DropdownMenu(
                        expanded = showSnoozeMenu,
                        onDismissRequest = { showSnoozeMenu = false }
                    ) {
                        DropdownMenuItem(
                            text = { Text("5 minutes") },
                            onClick = {
                                showSnoozeMenu = false
                                onSnooze(5)
                            }
                        )
                        DropdownMenuItem(
                            text = { Text("10 minutes") },
                            onClick = {
                                showSnoozeMenu = false
                                onSnooze(10)
                            }
                        )
                        DropdownMenuItem(
                            text = { Text("15 minutes") },
                            onClick = {
                                showSnoozeMenu = false
                                onSnooze(15)
                            }
                        )
                        DropdownMenuItem(
                            text = { Text("30 minutes") },
                            onClick = {
                                showSnoozeMenu = false
                                onSnooze(30)
                            }
                        )
                        DropdownMenuItem(
                            text = { Text("1 hour") },
                            onClick = {
                                showSnoozeMenu = false
                                onSnooze(60)
                            }
                        )
                    }
                }
            }
        }
    }
}
