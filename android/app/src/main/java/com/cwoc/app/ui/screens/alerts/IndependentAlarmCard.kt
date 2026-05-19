package com.cwoc.app.ui.screens.alerts

import android.app.TimePickerDialog
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.cwoc.app.data.local.entity.StandaloneAlertEntity
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken

// ─── Theme Colors ───────────────────────────────────────────────────────────────

private val ParchmentBrown = Color(0xFF6B4E31)
private val ParchmentCardBg = Color(0xFFFFF8F0)
private val EnabledGreen = Color(0xFF2E7D32)
private val DisabledGray = Color(0xFF9E9E9E)
private val DimmedAlpha = 0.4f

// ─── Day abbreviations in canonical order (Sunday=0 through Saturday=6) ─────────

private val ALL_DAYS = listOf("Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat")

/**
 * IndependentAlarmCard — displays an editable alarm with name, time picker,
 * day-of-week checkboxes, on/off toggle, and delete button.
 *
 * Parses the alert's `data` JSON to extract: time (String "HH:MM"),
 * days (List<String>), enabled (Boolean).
 *
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.10, 4.11, 12.1, 12.2
 */
@Composable
fun IndependentAlarmCard(
    alert: StandaloneAlertEntity,
    viewModel: AlertsViewModel,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val gson = remember { Gson() }

    // Parse the data JSON
    val alarmData = remember(alert.data) {
        try {
            val type = object : TypeToken<Map<String, Any>>() {}.type
            gson.fromJson<Map<String, Any>>(alert.data, type)
        } catch (_: Exception) {
            emptyMap()
        }
    }

    // Extract fields from parsed data
    val time = (alarmData["time"] as? String) ?: "00:00"
    val days = remember(alarmData) {
        @Suppress("UNCHECKED_CAST")
        (alarmData["days"] as? List<String>) ?: emptyList()
    }
    val enabled = (alarmData["enabled"] as? Boolean) ?: true

    // Settings from ViewModel
    val timeFormat by viewModel.timeFormat.collectAsState()
    val weekStartDay by viewModel.weekStartDay.collectAsState()

    // Local state for name editing
    var nameText by remember(alert.name) { mutableStateOf(alert.name ?: "") }
    var hadFocus by remember { mutableStateOf(false) }

    // Compute ordered days based on week_start_day setting
    val orderedDays = remember(weekStartDay) {
        val startIndex = weekStartDay.coerceIn(0, 6)
        (0 until 7).map { i -> ALL_DAYS[(startIndex + i) % 7] }
    }

    // Format time for display based on time_format setting
    val displayTime = remember(time, timeFormat) {
        formatAlarmTime(time, timeFormat)
    }

    // Content opacity based on enabled state
    val contentAlpha = if (enabled) 1f else DimmedAlpha

    Card(
        modifier = modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        colors = CardDefaults.cardColors(containerColor = ParchmentCardBg),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        shape = RoundedCornerShape(8.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp)
        ) {
            // ─── Row 1: Name field + Delete button ──────────────────────────
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                TextField(
                    value = nameText,
                    onValueChange = { nameText = it },
                    placeholder = { Text("Alarm name", color = Color(0xFF8B7355)) },
                    modifier = Modifier
                        .weight(1f)
                        .alpha(contentAlpha)
                        .onFocusChanged { focusState ->
                            if (hadFocus && !focusState.isFocused) {
                                // Save on focus loss
                                if (nameText != (alert.name ?: "")) {
                                    saveAlarm(
                                        viewModel = viewModel,
                                        alertId = alert.id,
                                        name = nameText,
                                        time = time,
                                        days = days,
                                        enabled = enabled
                                    )
                                }
                            }
                            hadFocus = focusState.isFocused
                        },
                    singleLine = true,
                    textStyle = MaterialTheme.typography.bodyMedium.copy(
                        color = ParchmentBrown
                    ),
                    colors = TextFieldDefaults.colors(
                        focusedContainerColor = Color.Transparent,
                        unfocusedContainerColor = Color.Transparent,
                        focusedIndicatorColor = ParchmentBrown,
                        unfocusedIndicatorColor = Color(0xFFD4C4A8)
                    )
                )

                // Delete button
                TextButton(
                    onClick = { viewModel.deleteStandaloneAlert(alert.id) },
                    modifier = Modifier.size(40.dp)
                ) {
                    Text("❌", fontSize = 16.sp)
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // ─── Row 2: Time display (tappable) ─────────────────────────────
            Text(
                text = displayTime,
                style = MaterialTheme.typography.headlineMedium.copy(
                    fontWeight = FontWeight.Bold,
                    color = ParchmentBrown
                ),
                modifier = Modifier
                    .alpha(contentAlpha)
                    .clickable {
                        // Open TimePickerDialog pre-populated with current time
                        val parts = time.split(":")
                        val hour = parts.getOrNull(0)?.toIntOrNull() ?: 0
                        val minute = parts.getOrNull(1)?.toIntOrNull() ?: 0

                        TimePickerDialog(
                            context,
                            { _, selectedHour, selectedMinute ->
                                val newTime = "%02d:%02d".format(selectedHour, selectedMinute)
                                // Auto-select today's day if no days selected
                                val updatedDays = if (days.isEmpty()) {
                                    val today = java.time.LocalDateTime
                                        .now()
                                        .dayOfWeek
                                        .getDisplayName(
                                            java.time.format.TextStyle.SHORT,
                                            java.util.Locale.ENGLISH
                                        )
                                    listOf(today)
                                } else {
                                    days
                                }
                                saveAlarm(
                                    viewModel = viewModel,
                                    alertId = alert.id,
                                    name = nameText,
                                    time = newTime,
                                    days = updatedDays,
                                    enabled = enabled
                                )
                            },
                            hour,
                            minute,
                            timeFormat == "24" // Use 24h view if setting is "24"
                        ).show()
                    }
            )

            Spacer(modifier = Modifier.height(8.dp))

            // ─── Row 3: Day-of-week checkboxes ──────────────────────────────
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .alpha(contentAlpha),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                orderedDays.forEach { day ->
                    val isSelected = days.contains(day)
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            text = day.take(1), // Single letter: S, M, T, W, T, F, S
                            style = MaterialTheme.typography.labelSmall,
                            color = if (isSelected) ParchmentBrown else DisabledGray,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                        )
                        Checkbox(
                            checked = isSelected,
                            onCheckedChange = { checked ->
                                val updatedDays = if (checked) {
                                    days + day
                                } else {
                                    days - day
                                }
                                saveAlarm(
                                    viewModel = viewModel,
                                    alertId = alert.id,
                                    name = nameText,
                                    time = time,
                                    days = updatedDays,
                                    enabled = enabled
                                )
                            },
                            modifier = Modifier.size(32.dp),
                            colors = CheckboxDefaults.colors(
                                checkedColor = ParchmentBrown,
                                uncheckedColor = DisabledGray
                            )
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // ─── Row 4: On/Off toggle ───────────────────────────────────────
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.End
            ) {
                TextButton(
                    onClick = {
                        val newEnabled = !enabled
                        saveAlarm(
                            viewModel = viewModel,
                            alertId = alert.id,
                            name = nameText,
                            time = time,
                            days = days,
                            enabled = newEnabled
                        )
                    },
                    modifier = Modifier
                        .background(
                            color = if (enabled) EnabledGreen.copy(alpha = 0.15f)
                            else DisabledGray.copy(alpha = 0.15f),
                            shape = RoundedCornerShape(16.dp)
                        )
                ) {
                    Text(
                        text = if (enabled) "On" else "Off",
                        color = if (enabled) EnabledGreen else DisabledGray,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }
    }
}

// ─── Helper: Format alarm time based on time_format setting ─────────────────────

/**
 * Formats "HH:MM" time string according to the time format setting.
 * "12" → "h:MM AM/PM", "24" → "HH:MM"
 */
private fun formatAlarmTime(time: String, timeFormat: String): String {
    val parts = time.split(":")
    val hour = parts.getOrNull(0)?.toIntOrNull() ?: 0
    val minute = parts.getOrNull(1)?.toIntOrNull() ?: 0

    return if (timeFormat == "24") {
        "%02d:%02d".format(hour, minute)
    } else {
        val period = if (hour < 12) "AM" else "PM"
        val displayHour = when {
            hour == 0 -> 12
            hour > 12 -> hour - 12
            else -> hour
        }
        "%d:%02d %s".format(displayHour, minute, period)
    }
}

// ─── Helper: Save alarm data via ViewModel ──────────────────────────────────────

/**
 * Constructs the update body and calls viewModel.updateStandaloneAlert.
 */
private fun saveAlarm(
    viewModel: AlertsViewModel,
    alertId: String,
    name: String,
    time: String,
    days: List<String>,
    enabled: Boolean
) {
    val body = mapOf<String, Any?>(
        "name" to name,
        "data" to mapOf(
            "time" to time,
            "days" to days,
            "enabled" to enabled
        )
    )
    viewModel.updateStandaloneAlert(alertId, body)
}
