package com.cwoc.app.ui.screens.editor.zones

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Alarm
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Timer
import androidx.compose.material3.Button
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TimePicker
import androidx.compose.material3.rememberTimePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import java.util.Locale
import java.util.UUID

// ─── Data Model ─────────────────────────────────────────────────────────────────

/**
 * Represents a single alert/alarm/reminder attached to a chit.
 *
 * Matches the web's alert data model:
 * - Notifications: {_type:"notification", value, unit, atTarget, afterTarget, targetType}
 * - Alarms: {_type:"alarm", time, days, enabled, name, delete_after_dismiss}
 * - Timers: {_type:"timer", duration, name, loop}
 * - Stopwatches: {_type:"stopwatch", name}
 *
 * @param id Unique identifier for this alert
 * @param type Alert type: "notification", "alarm", "timer", or "stopwatch"
 * @param offsetMinutes Relative offset in minutes before start/due (for relative alerts)
 * @param absoluteTime Absolute time string in HH:mm format (for absolute time alerts)
 * @param label Optional user-provided label for the alert
 * @param daysOfWeek Days of week for repeating alarms: e.g., "Mon,Tue,Wed"
 * @param durationSeconds Duration in seconds for timers
 * @param loop Whether the timer should loop/repeat
 * @param enabled Whether the alarm is active (alarms only)
 * @param atTarget True if notification fires exactly at the target time
 * @param afterTarget True if notification fires after the target time (false = before)
 * @param targetType Which date field to reference: "start", "end", "due", "point"
 * @param unit Time unit for notifications: "minutes", "hours", "days", "weeks"
 * @param value Numeric value for the offset (used with unit)
 * @param deleteAfterDismiss Whether to delete the chit after the alarm is dismissed
 * @param weatherCondition Weather condition type for weather notifications
 * @param weatherThreshold Numeric threshold for weather condition (stored in canonical units: °C, km/h, mm)
 */
data class AlertItem(
    val id: String = UUID.randomUUID().toString(),
    val type: String = "notification",
    val offsetMinutes: Int? = null,
    val absoluteTime: String? = null,
    val label: String? = null,
    val daysOfWeek: String? = null,
    val durationSeconds: Int? = null,
    val loop: Boolean = false,
    val enabled: Boolean = true,
    val atTarget: Boolean = false,
    val afterTarget: Boolean = false,
    val targetType: String? = null,
    val unit: String? = null,
    val value: Int? = null,
    val deleteAfterDismiss: Boolean = false,
    val weatherCondition: String? = null,
    val weatherThreshold: Double? = null
)

// ─── AlertsZone Composable ──────────────────────────────────────────────────────

/**
 * AlertsZone composable for the chit editor.
 *
 * Provides a collapsible zone with:
 * - List of existing alerts with type icon, time/offset text, and delete button
 * - "Add Alert" button that shows an inline creation form
 * - Type selector (alarm/timer/reminder)
 * - Offset picker (relative minutes) or absolute time picker
 * - Optional label field
 * - Serializes back to JSON on every add/remove
 *
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5
 *
 * @param alertsJson JSON string representing the list of alerts (nullable)
 * @param onAlertsChanged Callback with updated JSON string when alerts change
 * @param timeFormat "12h" or "24h" from user settings
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AlertsZone(
    alertsJson: String?,
    onAlertsChanged: (String?) -> Unit,
    timeFormat: String = "12h"
) {
    var isExpanded by remember { mutableStateOf(false) }
    var showAddForm by remember { mutableStateOf(false) }

    // Parse alerts from JSON
    val alerts = remember(alertsJson) {
        parseAlertsJson(alertsJson)
    }

    EditorZoneHeader(
        title = "Alerts",
        isExpanded = isExpanded,
        onToggle = { isExpanded = !isExpanded },
        trailingContent = {
            if (!isExpanded && alerts.isNotEmpty()) {
                Text(
                    text = "${alerts.size} alert${if (alerts.size != 1) "s" else ""}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    ) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            // --- Existing alerts list ---
            if (alerts.isEmpty() && !showAddForm) {
                Text(
                    text = "No alerts configured",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            alerts.forEach { alert ->
                AlertRow(
                    alert = alert,
                    timeFormat = timeFormat,
                    onDelete = {
                        val updated = alerts.filter { it.id != alert.id }
                        onAlertsChanged(serializeAlerts(updated))
                    },
                    onToggleEnabled = if (alert.type == "alarm") {
                        {
                            val updated = alerts.map {
                                if (it.id == alert.id) it.copy(enabled = !it.enabled) else it
                            }
                            onAlertsChanged(serializeAlerts(updated))
                        }
                    } else null
                )
            }

            // --- Add Alert button / form ---
            if (showAddForm) {
                HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
                AddAlertForm(
                    timeFormat = timeFormat,
                    onAdd = { newAlert ->
                        val updated = alerts + newAlert
                        onAlertsChanged(serializeAlerts(updated))
                        showAddForm = false
                    },
                    onCancel = { showAddForm = false }
                )
            } else {
                Spacer(modifier = Modifier.height(4.dp))
                Button(
                    onClick = { showAddForm = true },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("Add Alert")
                }
            }
        }
    }
}

// ─── Alert Row ──────────────────────────────────────────────────────────────────

/**
 * Displays a single alert as a row with type icon, description text, enable toggle, and delete button.
 */
@Composable
private fun AlertRow(
    alert: AlertItem,
    timeFormat: String,
    onDelete: () -> Unit,
    onToggleEnabled: (() -> Unit)? = null
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Type icon
        Icon(
            imageVector = alertTypeIcon(alert.type),
            contentDescription = alert.type,
            tint = if (alert.enabled) MaterialTheme.colorScheme.primary
                else MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.4f)
        )

        Spacer(modifier = Modifier.width(12.dp))

        // Description text
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = formatAlertDescription(alert, timeFormat),
                style = MaterialTheme.typography.bodyMedium,
                color = if (alert.enabled) MaterialTheme.colorScheme.onSurface
                    else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.4f)
            )
            if (!alert.label.isNullOrBlank()) {
                Text(
                    text = alert.label,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        // Enable/disable toggle for alarms
        if (alert.type == "alarm" && onToggleEnabled != null) {
            androidx.compose.material3.Switch(
                checked = alert.enabled,
                onCheckedChange = { onToggleEnabled() },
                modifier = Modifier.padding(end = 4.dp)
            )
        }

        // Delete button
        IconButton(onClick = onDelete) {
            Icon(
                imageVector = Icons.Default.Delete,
                contentDescription = "Delete alert",
                tint = MaterialTheme.colorScheme.error
            )
        }
    }
}

// ─── Add Alert Form ─────────────────────────────────────────────────────────────

/**
 * Inline form for creating a new alert.
 * Shows type selector, offset/time picker, and optional label.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AddAlertForm(
    timeFormat: String,
    onAdd: (AlertItem) -> Unit,
    onCancel: () -> Unit
) {
    var selectedType by remember { mutableStateOf("notification") }
    var selectedOffsetMinutes by remember { mutableStateOf<Int?>(15) }
    var absoluteTime by remember { mutableStateOf<String?>(null) }
    var label by remember { mutableStateOf("") }
    var useAbsoluteTime by remember { mutableStateOf(false) }
    var showTimePicker by remember { mutableStateOf(false) }
    // L3: Days of week for repeating alarms
    var daysOfWeek by remember { mutableStateOf("") }
    // L4: Duration for timers (hours, minutes, seconds)
    var durationHours by remember { mutableStateOf("0") }
    var durationMinutes by remember { mutableStateOf("5") }
    var durationSeconds by remember { mutableStateOf("0") }
    // L5: Loop toggle for timers
    var loopTimer by remember { mutableStateOf(false) }
    // Direction and target type for notifications (matching web)
    var direction by remember { mutableStateOf("before") } // "before", "after", "at", "weather"
    var targetType by remember { mutableStateOf("start") } // "start", "end", "due", "point"
    var notifUnit by remember { mutableStateOf("minutes") } // "minutes", "hours", "days", "weeks"
    var notifValue by remember { mutableStateOf<Int?>(15) }
    // Delete after dismiss for alarms
    var deleteAfterDismiss by remember { mutableStateOf(false) }
    // Weather notification state
    var weatherCondition by remember { mutableStateOf("high_above") }
    var weatherThreshold by remember { mutableStateOf("") }

    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text(
            text = "New Alert",
            style = MaterialTheme.typography.titleSmall,
            color = MaterialTheme.colorScheme.primary
        )

        // --- Type selector ---
        AlertTypeSelector(
            selectedType = selectedType,
            onTypeSelected = { selectedType = it }
        )

        // --- Notification direction & target type (Before/After/At + Start/End/Due) ---
        if (selectedType == "notification") {
            // Direction row
            Text("Direction", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                listOf("before" to "Before", "after" to "After", "at" to "At", "weather" to "Weather").forEach { (value, label2) ->
                    androidx.compose.material3.FilterChip(
                        selected = direction == value,
                        onClick = { direction = value },
                        label = { Text(label2, style = MaterialTheme.typography.labelSmall) },
                        modifier = Modifier.weight(1f)
                    )
                }
            }

            if (direction == "weather") {
                // Weather condition selector
                Text("Condition", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                var condExpanded by remember { mutableStateOf(false) }
                ExposedDropdownMenuBox(
                    expanded = condExpanded,
                    onExpandedChange = { condExpanded = it }
                ) {
                    OutlinedTextField(
                        value = weatherConditionLabel(weatherCondition),
                        onValueChange = {},
                        readOnly = true,
                        modifier = Modifier.fillMaxWidth().menuAnchor(),
                        label = { Text("Weather Condition") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = condExpanded) },
                        singleLine = true
                    )
                    ExposedDropdownMenu(
                        expanded = condExpanded,
                        onDismissRequest = { condExpanded = false }
                    ) {
                        WEATHER_CONDITIONS.forEach { (value, label2) ->
                            DropdownMenuItem(
                                text = { Text(label2) },
                                onClick = {
                                    weatherCondition = value
                                    condExpanded = false
                                }
                            )
                        }
                    }
                }

                // Threshold input (for conditions that need a number)
                if (weatherCondition in listOf("high_above", "high_below", "low_above", "low_below", "wind_above")) {
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = weatherThreshold,
                        onValueChange = { weatherThreshold = it },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        label = { Text("Threshold") },
                        placeholder = { Text(if (weatherCondition.contains("wind")) "km/h" else "°C") },
                        keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(
                            keyboardType = androidx.compose.ui.text.input.KeyboardType.Number
                        )
                    )
                }
            } else {
                // Target type row (not shown for weather)
                Text("Relative to", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    listOf("start" to "Start", "end" to "End", "due" to "Due", "point" to "Point").forEach { (value, label2) ->
                        androidx.compose.material3.FilterChip(
                            selected = targetType == value,
                            onClick = { targetType = value },
                            label = { Text(label2, style = MaterialTheme.typography.labelSmall) },
                            modifier = Modifier.weight(1f)
                        )
                    }
                }

                // Value + Unit row (hidden when direction is "at")
                if (direction != "at") {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        OutlinedTextField(
                            value = (notifValue ?: 15).toString(),
                            onValueChange = { notifValue = it.toIntOrNull() },
                            modifier = Modifier.width(80.dp),
                            singleLine = true,
                            label = { Text("#") },
                            keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(
                                keyboardType = androidx.compose.ui.text.input.KeyboardType.Number
                            )
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            listOf("minutes" to "Min", "hours" to "Hr", "days" to "Day", "weeks" to "Wk").forEach { (value, label2) ->
                                androidx.compose.material3.FilterChip(
                                    selected = notifUnit == value,
                                    onClick = { notifUnit = value },
                                    label = { Text(label2, style = MaterialTheme.typography.labelSmall) }
                                )
                            }
                        }
                    }
                }
            }
        }

        // --- Offset or Absolute Time picker (for alarms) ---
        if (selectedType == "alarm") {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                TextButton(
                    onClick = { useAbsoluteTime = false }
                ) {
                Text(
                    text = "Relative",
                    color = if (!useAbsoluteTime) MaterialTheme.colorScheme.primary
                    else MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            TextButton(
                onClick = { useAbsoluteTime = true }
            ) {
                Text(
                    text = "Absolute",
                    color = if (useAbsoluteTime) MaterialTheme.colorScheme.primary
                    else MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        if (useAbsoluteTime) {
            // Absolute time picker
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedTextField(
                    value = absoluteTime?.let { formatTimeForDisplay(it, timeFormat) } ?: "",
                    onValueChange = {},
                    readOnly = true,
                    modifier = Modifier.weight(1f),
                    label = { Text("Time") },
                    placeholder = { Text("Tap to set time") },
                    singleLine = true
                )
                Spacer(modifier = Modifier.width(8.dp))
                Button(onClick = { showTimePicker = true }) {
                    Text("Pick")
                }
            }
        } else {
            // Relative offset dropdown
            OffsetPicker(
                selectedOffset = selectedOffsetMinutes,
                onOffsetSelected = { selectedOffsetMinutes = it }
            )
        }
        } // end if (selectedType == "alarm")

        // --- Optional label ---
        OutlinedTextField(
            value = label,
            onValueChange = { label = it },
            modifier = Modifier.fillMaxWidth(),
            label = { Text("Label (optional)") },
            singleLine = true
        )

        // L3: Days of week selection (shown for alarm type)
        if (selectedType == "alarm") {
            Text(
                text = "Repeat on days:",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                val days = listOf("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")
                val selectedDays = daysOfWeek.split(",").filter { it.isNotBlank() }
                days.forEach { day ->
                    val isSelected = selectedDays.contains(day.lowercase())
                    androidx.compose.material3.FilterChip(
                        selected = isSelected,
                        onClick = {
                            val current = daysOfWeek.split(",").filter { it.isNotBlank() }.toMutableList()
                            val dayLower = day.lowercase()
                            if (isSelected) current.remove(dayLower) else current.add(dayLower)
                            daysOfWeek = current.joinToString(",")
                        },
                        label = { Text(day.take(2), style = MaterialTheme.typography.labelSmall) },
                        modifier = Modifier.weight(1f)
                    )
                }
            }

            // Delete after dismiss toggle
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text("Delete chit after dismiss", style = MaterialTheme.typography.bodySmall)
                androidx.compose.material3.Switch(
                    checked = deleteAfterDismiss,
                    onCheckedChange = { deleteAfterDismiss = it }
                )
            }
        }

        // L4: Duration input for timers (HH:MM:SS)
        if (selectedType == "timer") {
            Text(
                text = "Duration:",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedTextField(
                    value = durationHours,
                    onValueChange = { durationHours = it.filter { c -> c.isDigit() }.take(2) },
                    label = { Text("H") },
                    singleLine = true,
                    modifier = Modifier.weight(1f),
                    keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = androidx.compose.ui.text.input.KeyboardType.Number)
                )
                Text(":")
                OutlinedTextField(
                    value = durationMinutes,
                    onValueChange = { durationMinutes = it.filter { c -> c.isDigit() }.take(2) },
                    label = { Text("M") },
                    singleLine = true,
                    modifier = Modifier.weight(1f),
                    keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = androidx.compose.ui.text.input.KeyboardType.Number)
                )
                Text(":")
                OutlinedTextField(
                    value = durationSeconds,
                    onValueChange = { durationSeconds = it.filter { c -> c.isDigit() }.take(2) },
                    label = { Text("S") },
                    singleLine = true,
                    modifier = Modifier.weight(1f),
                    keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = androidx.compose.ui.text.input.KeyboardType.Number)
                )
            }

            // L5: Loop toggle for timers
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text("Loop Timer", style = MaterialTheme.typography.bodyMedium)
                androidx.compose.material3.Switch(
                    checked = loopTimer,
                    onCheckedChange = { loopTimer = it }
                )
            }
        }

        // --- Action buttons ---
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.End
        ) {
            TextButton(onClick = onCancel) {
                Text("Cancel")
            }
            Spacer(modifier = Modifier.width(8.dp))
            Button(
                onClick = {
                    val totalDurationSec = (durationHours.toIntOrNull() ?: 0) * 3600 +
                        (durationMinutes.toIntOrNull() ?: 0) * 60 +
                        (durationSeconds.toIntOrNull() ?: 0)
                    val newAlert = AlertItem(
                        type = selectedType,
                        offsetMinutes = if (selectedType == "notification" && !useAbsoluteTime && direction != "weather") selectedOffsetMinutes else null,
                        absoluteTime = if (selectedType == "alarm" || useAbsoluteTime) absoluteTime else null,
                        label = label.ifBlank { null },
                        daysOfWeek = if (selectedType == "alarm" && daysOfWeek.isNotBlank()) daysOfWeek else null,
                        durationSeconds = if (selectedType == "timer" && totalDurationSec > 0) totalDurationSec else null,
                        loop = if (selectedType == "timer") loopTimer else false,
                        enabled = true,
                        atTarget = if (selectedType == "notification" && direction != "weather") direction == "at" else false,
                        afterTarget = if (selectedType == "notification" && direction != "weather") direction == "after" else false,
                        targetType = if (selectedType == "notification" && direction != "weather") targetType else null,
                        unit = if (selectedType == "notification" && direction == "weather") "weather"
                            else if (selectedType == "notification" && !useAbsoluteTime) notifUnit else null,
                        value = if (selectedType == "notification" && !useAbsoluteTime && direction != "weather") notifValue else null,
                        deleteAfterDismiss = if (selectedType == "alarm") deleteAfterDismiss else false,
                        weatherCondition = if (selectedType == "notification" && direction == "weather") weatherCondition else null,
                        weatherThreshold = if (selectedType == "notification" && direction == "weather") weatherThreshold.toDoubleOrNull() else null
                    )
                    onAdd(newAlert)
                },
                enabled = when (selectedType) {
                    "notification" -> direction != "unset"
                    "alarm" -> absoluteTime != null
                    "timer" -> true
                    else -> true
                }
            ) {
                Text("Add")
            }
        }
    }

    // --- Time Picker Dialog ---
    if (showTimePicker) {
        val initialTime = absoluteTime?.let { parseTimeString(it) } ?: LocalTime.NOON
        val timePickerState = rememberTimePickerState(
            initialHour = initialTime.hour,
            initialMinute = initialTime.minute,
            is24Hour = (timeFormat == "24h")
        )

        androidx.compose.material3.AlertDialog(
            onDismissRequest = { showTimePicker = false },
            confirmButton = {
                TextButton(onClick = {
                    val time = LocalTime.of(timePickerState.hour, timePickerState.minute)
                    absoluteTime = time.format(DateTimeFormatter.ofPattern("HH:mm"))
                    showTimePicker = false
                }) {
                    Text("OK")
                }
            },
            dismissButton = {
                TextButton(onClick = { showTimePicker = false }) {
                    Text("Cancel")
                }
            },
            title = { Text("Select Alert Time") },
            text = { TimePicker(state = timePickerState) }
        )
    }
}

// ─── Alert Type Selector ────────────────────────────────────────────────────────

/**
 * Dropdown selector for alert type (alarm, timer, reminder).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AlertTypeSelector(
    selectedType: String,
    onTypeSelected: (String) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }

    ExposedDropdownMenuBox(
        expanded = expanded,
        onExpandedChange = { expanded = !expanded }
    ) {
        OutlinedTextField(
            value = alertTypeLabel(selectedType),
            onValueChange = {},
            readOnly = true,
            modifier = Modifier
                .fillMaxWidth()
                .menuAnchor(),
            label = { Text("Type") },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
            singleLine = true
        )
        ExposedDropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false }
        ) {
            ALERT_TYPES.forEach { type ->
                DropdownMenuItem(
                    text = {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = alertTypeIcon(type),
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.primary
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(alertTypeLabel(type))
                        }
                    },
                    onClick = {
                        onTypeSelected(type)
                        expanded = false
                    }
                )
            }
        }
    }
}

// ─── Offset Picker ──────────────────────────────────────────────────────────────

/**
 * Dropdown for selecting a relative offset in minutes.
 * Common values: 5, 10, 15, 30, 60, 120, 1440 minutes.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun OffsetPicker(
    selectedOffset: Int?,
    onOffsetSelected: (Int) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }

    ExposedDropdownMenuBox(
        expanded = expanded,
        onExpandedChange = { expanded = !expanded }
    ) {
        OutlinedTextField(
            value = selectedOffset?.let { formatOffsetMinutes(it) } ?: "",
            onValueChange = {},
            readOnly = true,
            modifier = Modifier
                .fillMaxWidth()
                .menuAnchor(),
            label = { Text("Offset before event") },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
            singleLine = true
        )
        ExposedDropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false }
        ) {
            OFFSET_OPTIONS.forEach { minutes ->
                DropdownMenuItem(
                    text = { Text(formatOffsetMinutes(minutes)) },
                    onClick = {
                        onOffsetSelected(minutes)
                        expanded = false
                    }
                )
            }
        }
    }
}

// ─── Utility Functions ──────────────────────────────────────────────────────────

/** Available alert types (L1: matches web's 4 types) */
private val ALERT_TYPES = listOf("notification", "alarm", "timer", "stopwatch")

/** Weather condition options matching the web's notification weather selector */
private val WEATHER_CONDITIONS = listOf(
    "high_above" to "High temp above",
    "high_below" to "High temp below",
    "low_above" to "Low temp above",
    "low_below" to "Low temp below",
    "precipitation" to "Any precipitation",
    "rain" to "Rain in forecast",
    "snow" to "Snow in forecast",
    "hail" to "Hail in forecast",
    "wind_above" to "Wind speed above"
)

/** Returns a human-readable label for a weather condition code */
private fun weatherConditionLabel(condition: String): String {
    return WEATHER_CONDITIONS.firstOrNull { it.first == condition }?.second ?: condition
}

/** Common offset values in minutes */
private val OFFSET_OPTIONS = listOf(5, 10, 15, 30, 60, 120, 1440)

/** Gson instance for JSON serialization */
private val gson = Gson()

/**
 * Parses a JSON string into a list of AlertItem objects.
 * Returns an empty list if the JSON is null, blank, or invalid.
 */
internal fun parseAlertsJson(json: String?): List<AlertItem> {
    if (json.isNullOrBlank()) return emptyList()
    return try {
        val type = object : TypeToken<List<AlertItem>>() {}.type
        gson.fromJson<List<AlertItem>>(json, type) ?: emptyList()
    } catch (_: Exception) {
        emptyList()
    }
}

/**
 * Serializes a list of AlertItem objects to a JSON string.
 * Returns null if the list is empty.
 */
internal fun serializeAlerts(alerts: List<AlertItem>): String? {
    if (alerts.isEmpty()) return null
    return gson.toJson(alerts)
}

/**
 * Returns the appropriate icon for an alert type.
 */
private fun alertTypeIcon(type: String): ImageVector {
    return when (type) {
        "notification" -> Icons.Default.Notifications
        "alarm" -> Icons.Default.Alarm
        "timer" -> Icons.Default.Timer
        "stopwatch" -> Icons.Default.Timer // Using Timer icon for stopwatch (closest available)
        else -> Icons.Default.Notifications
    }
}

/**
 * Returns a human-readable label for an alert type.
 */
private fun alertTypeLabel(type: String): String {
    return when (type) {
        "notification" -> "Notification"
        "alarm" -> "Alarm"
        "timer" -> "Timer"
        "stopwatch" -> "Stopwatch"
        else -> type.replaceFirstChar { it.uppercase() }
    }
}

/**
 * Formats an alert's time/offset for display in the alert row.
 */
private fun formatAlertDescription(alert: AlertItem, timeFormat: String): String {
    return when (alert.type) {
        "notification" -> {
            if (alert.unit == "weather" || alert.weatherCondition != null) {
                // Weather notification
                val condLabel = alert.weatherCondition?.let { weatherConditionLabel(it) } ?: "Weather"
                val threshold = alert.weatherThreshold?.let { " ${it.toInt()}" } ?: ""
                "🌤️ $condLabel$threshold"
            } else {
                val direction = when {
                    alert.atTarget -> "At"
                    alert.afterTarget -> "After"
                    else -> "Before"
                }
                val target = alert.targetType ?: "start"
                if (alert.atTarget) {
                    "At $target"
                } else {
                    val value = alert.value ?: alert.offsetMinutes ?: 0
                    val unit = alert.unit ?: "minutes"
                    "$value $unit $direction $target"
                }
            }
        }
        "alarm" -> {
            val timeStr = alert.absoluteTime?.let { formatTimeForDisplay(it, timeFormat) } ?: "No time set"
            val daysStr = if (!alert.daysOfWeek.isNullOrBlank()) " (${alert.daysOfWeek})" else ""
            "🔔 $timeStr$daysStr"
        }
        "timer" -> {
            val dur = alert.durationSeconds ?: 0
            val h = dur / 3600
            val m = (dur % 3600) / 60
            val s = dur % 60
            val timeStr = if (h > 0) "${h}h ${m}m ${s}s" else if (m > 0) "${m}m ${s}s" else "${s}s"
            "⏱️ $timeStr${if (alert.loop) " (loop)" else ""}"
        }
        "stopwatch" -> "⏱️ Stopwatch"
        else -> alert.type
    }
}

/**
 * Formats an offset in minutes into a human-readable string.
 * Examples: "5 minutes before", "1 hour before", "1 day before"
 */
internal fun formatOffsetMinutes(minutes: Int): String {
    return when {
        minutes < 60 -> "$minutes minute${if (minutes != 1) "s" else ""} before"
        minutes < 1440 -> {
            val hours = minutes / 60
            "$hours hour${if (hours != 1) "s" else ""} before"
        }
        else -> {
            val days = minutes / 1440
            "$days day${if (days != 1) "s" else ""} before"
        }
    }
}

/**
 * Formats a time string (HH:mm) for display based on user's time format preference.
 */
private fun formatTimeForDisplay(timeStr: String, timeFormat: String): String {
    val time = parseTimeString(timeStr) ?: return timeStr
    val pattern = if (timeFormat == "24h") "HH:mm" else "h:mm a"
    return time.format(DateTimeFormatter.ofPattern(pattern, Locale.getDefault()))
}

/**
 * Parses a time string in HH:mm format into a LocalTime.
 * Returns null if parsing fails.
 */
private fun parseTimeString(timeStr: String): LocalTime? {
    return try {
        LocalTime.parse(timeStr, DateTimeFormatter.ofPattern("HH:mm"))
    } catch (_: Exception) {
        null
    }
}
