package com.cwoc.app.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TimePicker
import androidx.compose.material3.TimePickerState
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.material3.rememberTimePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import java.time.DayOfWeek
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.time.temporal.TemporalAdjusters

/**
 * A dialog that lets the user pick a snooze time from presets or a custom date/time.
 *
 * Preset options:
 * - "15 min" — now + 15 minutes
 * - "1 hour" — now + 1 hour
 * - "3 hours" — now + 3 hours
 * - "Tomorrow 9am" — next day at 09:00 local time
 * - "Next Monday 9am" — next Monday at 09:00 local time
 * - "Custom" — opens Material 3 DatePickerDialog then TimePickerDialog
 *
 * Returns the selected time as an ISO datetime string (e.g., "2025-01-15T09:00:00Z")
 * via the [onSnoozeSelected] callback.
 *
 * @param onSnoozeSelected Callback with the selected ISO datetime string
 * @param onDismiss Callback when the dialog is dismissed/cancelled
 *
 * Validates: Requirements 6.3
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SnoozePickerDialog(
    onSnoozeSelected: (String) -> Unit,
    onDismiss: () -> Unit
) {
    var showDatePicker by remember { mutableStateOf(false) }
    var showTimePicker by remember { mutableStateOf(false) }
    var selectedDateMillis by remember { mutableStateOf<Long?>(null) }

    val datePickerState = rememberDatePickerState()
    val timePickerState = rememberTimePickerState(
        initialHour = 9,
        initialMinute = 0
    )

    // Main snooze preset dialog
    if (!showDatePicker && !showTimePicker) {
        AlertDialog(
            onDismissRequest = onDismiss,
            title = {
                Text(
                    text = "Snooze Until",
                    style = MaterialTheme.typography.titleLarge
                )
            },
            text = {
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    // Row 1: 15 min, 1 hour
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        OutlinedButton(
                            onClick = {
                                val snoozeTime = Instant.now().plusSeconds(15 * 60)
                                onSnoozeSelected(formatInstantToIso(snoozeTime))
                            },
                            modifier = Modifier.weight(1f)
                        ) {
                            Text("15 min")
                        }
                        OutlinedButton(
                            onClick = {
                                val snoozeTime = Instant.now().plusSeconds(60 * 60)
                                onSnoozeSelected(formatInstantToIso(snoozeTime))
                            },
                            modifier = Modifier.weight(1f)
                        ) {
                            Text("1 hour")
                        }
                    }

                    // Row 2: 3 hours, Tomorrow 9am
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        OutlinedButton(
                            onClick = {
                                val snoozeTime = Instant.now().plusSeconds(3 * 60 * 60)
                                onSnoozeSelected(formatInstantToIso(snoozeTime))
                            },
                            modifier = Modifier.weight(1f)
                        ) {
                            Text("3 hours")
                        }
                        OutlinedButton(
                            onClick = {
                                val snoozeTime = calculateTomorrow9am()
                                onSnoozeSelected(formatInstantToIso(snoozeTime))
                            },
                            modifier = Modifier.weight(1f)
                        ) {
                            Text("Tomorrow 9am")
                        }
                    }

                    // Row 3: Next Monday 9am, Custom
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        OutlinedButton(
                            onClick = {
                                val snoozeTime = calculateNextMonday9am()
                                onSnoozeSelected(formatInstantToIso(snoozeTime))
                            },
                            modifier = Modifier.weight(1f)
                        ) {
                            Text("Next Monday 9am")
                        }
                        OutlinedButton(
                            onClick = { showDatePicker = true },
                            modifier = Modifier.weight(1f)
                        ) {
                            Text("Custom")
                        }
                    }
                }
            },
            confirmButton = {},
            dismissButton = {
                TextButton(onClick = onDismiss) {
                    Text("Cancel")
                }
            }
        )
    }

    // Custom date picker
    if (showDatePicker) {
        DatePickerDialog(
            onDismissRequest = {
                showDatePicker = false
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        selectedDateMillis = datePickerState.selectedDateMillis
                        showDatePicker = false
                        showTimePicker = true
                    }
                ) {
                    Text("Next")
                }
            },
            dismissButton = {
                TextButton(
                    onClick = {
                        showDatePicker = false
                    }
                ) {
                    Text("Cancel")
                }
            }
        ) {
            DatePicker(state = datePickerState)
        }
    }

    // Custom time picker
    if (showTimePicker) {
        AlertDialog(
            onDismissRequest = {
                showTimePicker = false
            },
            title = {
                Text(
                    text = "Select Time",
                    style = MaterialTheme.typography.titleLarge
                )
            },
            text = {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 8.dp),
                    horizontalAlignment = androidx.compose.ui.Alignment.CenterHorizontally
                ) {
                    TimePicker(state = timePickerState)
                }
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        val snoozeTime = buildCustomSnoozeTime(
                            selectedDateMillis,
                            timePickerState
                        )
                        if (snoozeTime != null) {
                            onSnoozeSelected(formatInstantToIso(snoozeTime))
                        }
                        showTimePicker = false
                    }
                ) {
                    Text("Confirm")
                }
            },
            dismissButton = {
                TextButton(
                    onClick = {
                        showTimePicker = false
                    }
                ) {
                    Text("Cancel")
                }
            }
        )
    }
}

/**
 * Calculates tomorrow at 09:00 local time as an Instant.
 */
private fun calculateTomorrow9am(): Instant {
    val tomorrow = LocalDate.now().plusDays(1)
    val tomorrowAt9 = LocalDateTime.of(tomorrow, LocalTime.of(9, 0))
    return tomorrowAt9.atZone(ZoneId.systemDefault()).toInstant()
}

/**
 * Calculates next Monday at 09:00 local time as an Instant.
 * If today is Monday, returns the following Monday.
 */
private fun calculateNextMonday9am(): Instant {
    val nextMonday = LocalDate.now().with(TemporalAdjusters.next(DayOfWeek.MONDAY))
    val nextMondayAt9 = LocalDateTime.of(nextMonday, LocalTime.of(9, 0))
    return nextMondayAt9.atZone(ZoneId.systemDefault()).toInstant()
}

/**
 * Builds an Instant from the selected date millis and time picker state.
 */
@OptIn(ExperimentalMaterial3Api::class)
private fun buildCustomSnoozeTime(
    dateMillis: Long?,
    timePickerState: TimePickerState
): Instant? {
    if (dateMillis == null) return null
    val selectedDate = Instant.ofEpochMilli(dateMillis)
        .atZone(ZoneOffset.UTC)
        .toLocalDate()
    val selectedTime = LocalTime.of(timePickerState.hour, timePickerState.minute)
    val dateTime = LocalDateTime.of(selectedDate, selectedTime)
    return dateTime.atZone(ZoneId.systemDefault()).toInstant()
}

/**
 * Formats an Instant to ISO 8601 UTC string (e.g., "2025-01-15T09:00:00Z").
 */
private fun formatInstantToIso(instant: Instant): String {
    return DateTimeFormatter.ISO_INSTANT.format(instant)
}
