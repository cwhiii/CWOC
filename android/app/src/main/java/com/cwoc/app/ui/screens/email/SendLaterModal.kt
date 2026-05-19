package com.cwoc.app.ui.screens.email

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SelectableDates
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TimePicker
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.material3.rememberTimePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import java.text.SimpleDateFormat
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.Date
import java.util.Locale
import java.util.TimeZone

// ─── Theme Colors ───────────────────────────────────────────────────────────────

private val ParchmentBrown = Color(0xFF6B4E31)

// ─── Send Later Modal ───────────────────────────────────────────────────────────

/**
 * Modal dialog for scheduling email delivery at a future date/time.
 *
 * Displays a two-step flow:
 * 1. Date picker (minimum selectable date: today)
 * 2. Time picker (default: current time + 1 hour)
 *
 * On "Schedule": returns an ISO 8601 datetime string (e.g., "2024-01-15T14:30:00Z")
 * On "Cancel": dismisses without action.
 *
 * Validates: Requirements 46.1-46.6
 *
 * @param onDismiss Called when the user cancels or taps outside the dialog
 * @param onSchedule Called with the selected ISO 8601 datetime string when the user
 *        taps "Schedule". The caller should save the chit and call the schedule API.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SendLaterModal(
    onDismiss: () -> Unit,
    onSchedule: (isoDatetime: String) -> Unit
) {
    // Default time: now + 1 hour (Requirement 46.3)
    val defaultTime = LocalTime.now().plusHours(1)

    // State for the selected date (millis) and time
    var selectedDateMillis by remember { mutableStateOf<Long?>(null) }
    var selectedHour by remember { mutableStateOf(defaultTime.hour) }
    var selectedMinute by remember { mutableStateOf(defaultTime.minute) }

    // Sub-dialog visibility
    var showDatePicker by remember { mutableStateOf(false) }
    var showTimePicker by remember { mutableStateOf(false) }

    // Format selected date for display
    val dateDisplayText = selectedDateMillis?.let { millis ->
        val sdf = SimpleDateFormat("EEE, MMM d, yyyy", Locale.getDefault())
        sdf.timeZone = TimeZone.getTimeZone("UTC")
        sdf.format(Date(millis))
    } ?: "Select date"

    // Format selected time for display
    val timeDisplayText = String.format(Locale.US, "%02d:%02d", selectedHour, selectedMinute)

    // Main dialog container
    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                text = "Schedule Send",
                fontWeight = FontWeight.Bold
            )
        },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Text(
                    text = "Choose when to send this email:",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                // Date selection row
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(
                        text = "Date",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    TextButton(onClick = { showDatePicker = true }) {
                        Text(
                            text = dateDisplayText,
                            style = MaterialTheme.typography.bodyLarge,
                            color = ParchmentBrown
                        )
                    }
                }

                // Time selection row
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(
                        text = "Time",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    TextButton(onClick = { showTimePicker = true }) {
                        Text(
                            text = timeDisplayText,
                            style = MaterialTheme.typography.bodyLarge,
                            color = ParchmentBrown
                        )
                    }
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    // Build ISO 8601 datetime string from selected date + time
                    val dateMillis = selectedDateMillis
                    if (dateMillis != null) {
                        val selectedDate = Instant.ofEpochMilli(dateMillis)
                            .atZone(ZoneOffset.UTC)
                            .toLocalDate()
                        val selectedTime = LocalTime.of(selectedHour, selectedMinute)
                        val localDateTime = LocalDateTime.of(selectedDate, selectedTime)
                        // Convert to UTC ISO string
                        val utcInstant = localDateTime
                            .atZone(ZoneId.systemDefault())
                            .toInstant()
                        val isoString = DateTimeFormatter.ISO_INSTANT.format(utcInstant)
                        onSchedule(isoString)
                    }
                },
                enabled = selectedDateMillis != null
            ) {
                Text("Schedule", color = if (selectedDateMillis != null) ParchmentBrown else Color.Gray)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel", color = ParchmentBrown)
            }
        }
    )

    // ─── Date Picker Dialog ─────────────────────────────────────────────────────

    if (showDatePicker) {
        // Requirement 46.2: minimum date is today
        val todayMillis = LocalDate.now()
            .atStartOfDay(ZoneOffset.UTC)
            .toInstant()
            .toEpochMilli()

        val datePickerState = rememberDatePickerState(
            initialSelectedDateMillis = selectedDateMillis ?: todayMillis,
            selectableDates = object : SelectableDates {
                override fun isSelectableDate(utcTimeMillis: Long): Boolean {
                    return utcTimeMillis >= todayMillis
                }

                override fun isSelectableYear(year: Int): Boolean {
                    return year >= LocalDate.now().year
                }
            }
        )

        DatePickerDialog(
            onDismissRequest = { showDatePicker = false },
            confirmButton = {
                TextButton(
                    onClick = {
                        datePickerState.selectedDateMillis?.let { millis ->
                            selectedDateMillis = millis
                        }
                        showDatePicker = false
                    }
                ) {
                    Text("OK", color = ParchmentBrown)
                }
            },
            dismissButton = {
                TextButton(onClick = { showDatePicker = false }) {
                    Text("Cancel", color = ParchmentBrown)
                }
            }
        ) {
            Column {
                Text(
                    text = "Select Date",
                    style = MaterialTheme.typography.titleMedium,
                    modifier = Modifier.padding(start = 24.dp, top = 16.dp)
                )
                DatePicker(state = datePickerState)
            }
        }
    }

    // ─── Time Picker Dialog ─────────────────────────────────────────────────────

    if (showTimePicker) {
        val timePickerState = rememberTimePickerState(
            initialHour = selectedHour,
            initialMinute = selectedMinute,
            is24Hour = true
        )

        AlertDialog(
            onDismissRequest = { showTimePicker = false },
            confirmButton = {
                TextButton(
                    onClick = {
                        selectedHour = timePickerState.hour
                        selectedMinute = timePickerState.minute
                        showTimePicker = false
                    }
                ) {
                    Text("OK", color = ParchmentBrown)
                }
            },
            dismissButton = {
                TextButton(onClick = { showTimePicker = false }) {
                    Text("Cancel", color = ParchmentBrown)
                }
            },
            title = { Text("Select Time") },
            text = { TimePicker(state = timePickerState) }
        )
    }
}
