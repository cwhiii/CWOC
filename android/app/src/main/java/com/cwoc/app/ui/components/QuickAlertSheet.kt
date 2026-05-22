package com.cwoc.app.ui.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.BottomSheetDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.LocalTime
import java.time.format.TextStyle
import java.util.Locale
import com.cwoc.app.ui.theme.CwocDialogDefaults
import com.cwoc.app.ui.theme.CwocPrimary
import com.cwoc.app.ui.theme.CwocInputDefaults

// ─── Theme Colors ───────────────────────────────────────────────────────────────

private val ParchmentBrown = Color(0xFF6B4E31)

// ─── Alert Types ────────────────────────────────────────────────────────────────

private enum class QuickAlertType(val label: String) {
    REMINDER("Reminder"),
    ALARM("Alarm"),
    TIMER("Timer"),
    STOPWATCH("Stopwatch")
}

// ─── Data Classes for Save Results ──────────────────────────────────────────────

/**
 * Data needed to create a Reminder (chit with point_in_time + notification alert).
 */
data class ReminderData(
    val title: String,
    val date: String,   // YYYY-MM-DD
    val time: String    // HH:mm
)

/**
 * Data needed to create an Alarm (standalone alert).
 */
data class AlarmData(
    val name: String,
    val time: String,           // HH:mm
    val days: List<String>      // e.g. ["Mon", "Tue"]
)

/**
 * Data needed to create a Timer (standalone alert).
 */
data class TimerData(
    val name: String,
    val hours: Int,
    val minutes: Int,
    val seconds: Int,
    val loop: Boolean
)

/**
 * Data needed to create a Stopwatch (standalone alert).
 */
data class StopwatchData(
    val name: String
)

/**
 * Quick Alert bottom sheet for creating alarms, timers, stopwatches, or reminders
 * from any screen without navigating to the full editor.
 *
 * Validates: Requirement 18
 *
 * @param onDismiss Callback when the sheet is dismissed/cancelled
 * @param onSaveReminder Callback to create a reminder chit (title, date, time)
 * @param onSaveAlarm Callback to create a standalone alarm
 * @param onSaveTimer Callback to create a standalone timer
 * @param onSaveStopwatch Callback to create a standalone stopwatch
 * @param onCreateAndView Callback to save and navigate to Alarms tab
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun QuickAlertSheet(
    onDismiss: () -> Unit,
    onSaveReminder: (ReminderData) -> Unit,
    onSaveAlarm: (AlarmData) -> Unit,
    onSaveTimer: (TimerData) -> Unit,
    onSaveStopwatch: (StopwatchData) -> Unit,
    onCreateAndView: () -> Unit,
    is24Hour: Boolean = true,
    calendarSnap: Int = 5
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    // ─── State ──────────────────────────────────────────────────────────────
    var selectedType by remember { mutableStateOf(QuickAlertType.REMINDER) }

    // Reminder state
    var reminderTitle by remember { mutableStateOf("") }
    val defaultDate = remember { LocalDate.now().toString() }
    var reminderDate by remember { mutableStateOf(defaultDate) }
    val defaultTime = remember {
        val t = LocalTime.now().plusMinutes(15)
        "%02d:%02d".format(t.hour, t.minute)
    }
    var reminderTime by remember { mutableStateOf(defaultTime) }

    // Alarm state
    var alarmName by remember { mutableStateOf("") }
    val defaultAlarmTime = remember {
        val t = LocalTime.now().plusMinutes(1)
        "%02d:%02d".format(t.hour, t.minute)
    }
    var alarmTime by remember { mutableStateOf(defaultAlarmTime) }
    val todayDow = remember {
        LocalDate.now().dayOfWeek.getDisplayName(TextStyle.SHORT, Locale.ENGLISH)
    }
    var alarmDays by remember { mutableStateOf(setOf(todayDow)) }

    // Timer state
    var timerName by remember { mutableStateOf("") }
    var timerHours by remember { mutableStateOf("0") }
    var timerMinutes by remember { mutableStateOf("5") }
    var timerSeconds by remember { mutableStateOf("0") }
    var timerLoop by remember { mutableStateOf(false) }

    // Stopwatch state
    var stopwatchName by remember { mutableStateOf("") }

    // Validation
    var showTitleError by remember { mutableStateOf(false) }
    var showDurationError by remember { mutableStateOf(false) }

    // ─── Validation Logic ───────────────────────────────────────────────────
    fun validate(): Boolean {
        when (selectedType) {
            QuickAlertType.REMINDER -> {
                if (reminderTitle.isBlank()) {
                    showTitleError = true
                    return false
                }
            }
            QuickAlertType.TIMER -> {
                val h = timerHours.toIntOrNull() ?: 0
                val m = timerMinutes.toIntOrNull() ?: 0
                val s = timerSeconds.toIntOrNull() ?: 0
                if (h * 3600 + m * 60 + s <= 0) {
                    showDurationError = true
                    return false
                }
            }
            else -> { /* No validation needed */ }
        }
        return true
    }

    // ─── Save Logic ─────────────────────────────────────────────────────────
    fun performSave(andView: Boolean) {
        if (!validate()) return

        when (selectedType) {
            QuickAlertType.REMINDER -> {
                onSaveReminder(ReminderData(
                    title = reminderTitle.trim(),
                    date = reminderDate,
                    time = reminderTime
                ))
            }
            QuickAlertType.ALARM -> {
                onSaveAlarm(AlarmData(
                    name = alarmName.trim(),
                    time = alarmTime,
                    days = alarmDays.toList()
                ))
            }
            QuickAlertType.TIMER -> {
                onSaveTimer(TimerData(
                    name = timerName.trim(),
                    hours = timerHours.toIntOrNull() ?: 0,
                    minutes = timerMinutes.toIntOrNull() ?: 0,
                    seconds = timerSeconds.toIntOrNull() ?: 0,
                    loop = timerLoop
                ))
            }
            QuickAlertType.STOPWATCH -> {
                onSaveStopwatch(StopwatchData(name = stopwatchName.trim()))
            }
        }

        if (andView) {
            onCreateAndView()
        } else {
            onDismiss()
        }
    }

    // ─── UI ─────────────────────────────────────────────────────────────────
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = CwocDialogDefaults.containerColor,
        dragHandle = { BottomSheetDefaults.DragHandle(color = CwocPrimary) }
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp)
        ) {
            // Header
            Text(
                text = "Quick Alert",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = ParchmentBrown
            )

            Spacer(modifier = Modifier.height(12.dp))

            // ─── Type Selector Row ──────────────────────────────────────────
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                QuickAlertType.entries.forEach { type ->
                    FilterChip(
                        selected = selectedType == type,
                        onClick = {
                            selectedType = type
                            showTitleError = false
                            showDurationError = false
                        },
                        label = { Text(type.label) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = ParchmentBrown,
                            selectedLabelColor = Color.White
                        )
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // ─── Type-Specific Editor ───────────────────────────────────────
            when (selectedType) {
                QuickAlertType.REMINDER -> ReminderEditor(
                    title = reminderTitle,
                    onTitleChange = {
                        reminderTitle = it.take(200)
                        showTitleError = false
                    },
                    date = reminderDate,
                    onDateChange = { reminderDate = it },
                    time = reminderTime,
                    onTimeChange = { reminderTime = it },
                    showTitleError = showTitleError,
                    is24Hour = is24Hour,
                    calendarSnap = calendarSnap
                )
                QuickAlertType.ALARM -> AlarmEditor(
                    name = alarmName,
                    onNameChange = { alarmName = it.take(200) },
                    time = alarmTime,
                    onTimeChange = { alarmTime = it },
                    selectedDays = alarmDays,
                    onDaysChange = { alarmDays = it },
                    is24Hour = is24Hour,
                    calendarSnap = calendarSnap
                )
                QuickAlertType.TIMER -> TimerEditor(
                    name = timerName,
                    onNameChange = { timerName = it.take(200) },
                    hours = timerHours,
                    onHoursChange = {
                        timerHours = it.filter { c -> c.isDigit() }
                        showDurationError = false
                    },
                    minutes = timerMinutes,
                    onMinutesChange = {
                        timerMinutes = it.filter { c -> c.isDigit() }
                        showDurationError = false
                    },
                    seconds = timerSeconds,
                    onSecondsChange = {
                        timerSeconds = it.filter { c -> c.isDigit() }
                        showDurationError = false
                    },
                    loop = timerLoop,
                    onLoopChange = { timerLoop = it },
                    showDurationError = showDurationError
                )
                QuickAlertType.STOPWATCH -> StopwatchEditor(
                    name = stopwatchName,
                    onNameChange = { stopwatchName = it.take(200) }
                )
            }

            Spacer(modifier = Modifier.height(20.dp))

            // ─── Action Buttons ─────────────────────────────────────────────
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedButton(
                    onClick = onDismiss,
                    modifier = Modifier.weight(1f)
                ) {
                    Text("Cancel")
                }
                Button(
                    onClick = { performSave(andView = false) },
                    modifier = Modifier.weight(1f),
                    colors = ButtonDefaults.buttonColors(containerColor = ParchmentBrown)
                ) {
                    Text("Save")
                }
                Button(
                    onClick = { performSave(andView = true) },
                    modifier = Modifier.weight(1.2f),
                    colors = ButtonDefaults.buttonColors(containerColor = ParchmentBrown)
                ) {
                    Text("Create & View", fontSize = 12.sp)
                }
            }

            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}

// ─── Reminder Editor ────────────────────────────────────────────────────────────

@Composable
private fun ReminderEditor(
    title: String,
    onTitleChange: (String) -> Unit,
    date: String,
    onDateChange: (String) -> Unit,
    time: String,
    onTimeChange: (String) -> Unit,
    showTitleError: Boolean,
    is24Hour: Boolean = true,
    calendarSnap: Int = 5
) {
    var showDatePicker by remember { mutableStateOf(false) }
    var showTimePicker by remember { mutableStateOf(false) }

    // Parse time for picker initial values
    val timeParts = remember(time) { time.split(":") }
    val initialHour = remember(timeParts) { timeParts.getOrNull(0)?.toIntOrNull() ?: 12 }
    val initialMinute = remember(timeParts) { timeParts.getOrNull(1)?.toIntOrNull() ?: 0 }

    // Format date for display (YYYY-MM-DD → YYYY-Mon-DD for picker, display as-is)
    val dateDisplay = if (date.isBlank()) "Select date" else date
    val timeDisplay = if (time.isBlank()) "Select time" else time

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        // Title (required)
        OutlinedTextField(
            value = title,
            onValueChange = onTitleChange,
            label = { Text("Title *") },
            singleLine = true,
            isError = showTitleError,
            supportingText = if (showTitleError) {
                { Text("Title is required", color = MaterialTheme.colorScheme.error) }
            } else null,
            modifier = Modifier.fillMaxWidth(),
            colors = CwocInputDefaults.outlinedColors()
        )

        // Date — tap to open FlatpickrCalendarPicker
        OutlinedTextField(
            value = dateDisplay,
            onValueChange = {},
            readOnly = true,
            label = { Text("Date") },
            singleLine = true,
            modifier = Modifier
                .fillMaxWidth()
                .clickable { showDatePicker = true },
            colors = CwocInputDefaults.outlinedColors(),
            enabled = false
        )
        // Invisible clickable overlay (since enabled=false blocks clicks)
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(0.dp)
                .clickable { showDatePicker = true }
        )

        // Time — tap to open DrumRollerTimePicker
        OutlinedTextField(
            value = timeDisplay,
            onValueChange = {},
            readOnly = true,
            label = { Text("Time") },
            singleLine = true,
            modifier = Modifier
                .fillMaxWidth()
                .clickable { showTimePicker = true },
            colors = CwocInputDefaults.outlinedColors(),
            enabled = false
        )
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(0.dp)
                .clickable { showTimePicker = true }
        )
    }

    // Date picker dialog
    if (showDatePicker) {
        // Convert YYYY-MM-DD to YYYY-Mon-DD for FlatpickrCalendarPicker
        val initialDateStr = remember(date) {
            try {
                val ld = java.time.LocalDate.parse(date)
                formatYMDDate(ld)
            } catch (_: Exception) { null }
        }
        FlatpickrCalendarPicker(
            isOpen = true,
            initialDate = initialDateStr,
            onDateSelected = { ymdDate ->
                // Convert YYYY-Mon-DD back to YYYY-MM-DD
                val parsed = parseYMDDate(ymdDate)
                if (parsed != null) {
                    onDateChange(parsed.toString())
                }
                showDatePicker = false
            },
            onDismiss = { showDatePicker = false }
        )
    }

    // Time picker dialog
    if (showTimePicker) {
        DrumRollerTimePicker(
            initialHour = initialHour,
            initialMinute = initialMinute,
            is24Hour = is24Hour,
            minuteStep = calendarSnap,
            onDismiss = { showTimePicker = false },
            onTimeSelected = { hour, minute ->
                onTimeChange("%02d:%02d".format(hour, minute))
                showTimePicker = false
            }
        )
    }
}

// ─── Alarm Editor ───────────────────────────────────────────────────────────────

@Composable
private fun AlarmEditor(
    name: String,
    onNameChange: (String) -> Unit,
    time: String,
    onTimeChange: (String) -> Unit,
    selectedDays: Set<String>,
    onDaysChange: (Set<String>) -> Unit,
    is24Hour: Boolean = true,
    calendarSnap: Int = 5
) {
    val dayAbbreviations = remember {
        DayOfWeek.entries.map { it.getDisplayName(TextStyle.SHORT, Locale.ENGLISH) }
    }

    var showTimePicker by remember { mutableStateOf(false) }
    val timeParts = remember(time) { time.split(":") }
    val initialHour = remember(timeParts) { timeParts.getOrNull(0)?.toIntOrNull() ?: 12 }
    val initialMinute = remember(timeParts) { timeParts.getOrNull(1)?.toIntOrNull() ?: 0 }
    val timeDisplay = if (time.isBlank()) "Select time" else time

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        // Name (optional)
        OutlinedTextField(
            value = name,
            onValueChange = onNameChange,
            label = { Text("Name (optional)") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
            colors = CwocInputDefaults.outlinedColors()
        )

        // Time — tap to open DrumRollerTimePicker
        OutlinedTextField(
            value = timeDisplay,
            onValueChange = {},
            readOnly = true,
            label = { Text("Time") },
            singleLine = true,
            modifier = Modifier
                .fillMaxWidth()
                .clickable { showTimePicker = true },
            colors = CwocInputDefaults.outlinedColors(),
            enabled = false
        )
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(0.dp)
                .clickable { showTimePicker = true }
        )

        // Day-of-week checkboxes
        Text(
            text = "Repeat on:",
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.Medium,
            color = MaterialTheme.colorScheme.onSurface
        )
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceEvenly
        ) {
            dayAbbreviations.forEach { day ->
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = day.take(2),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Checkbox(
                        checked = selectedDays.contains(day),
                        onCheckedChange = { checked ->
                            onDaysChange(
                                if (checked) selectedDays + day
                                else selectedDays - day
                            )
                        },
                        colors = CheckboxDefaults.colors(
                            checkedColor = ParchmentBrown
                        )
                    )
                }
            }
        }
    }

    // Time picker dialog
    if (showTimePicker) {
        DrumRollerTimePicker(
            initialHour = initialHour,
            initialMinute = initialMinute,
            is24Hour = is24Hour,
            minuteStep = calendarSnap,
            onDismiss = { showTimePicker = false },
            onTimeSelected = { hour, minute ->
                onTimeChange("%02d:%02d".format(hour, minute))
                showTimePicker = false
            }
        )
    }
}

// ─── Timer Editor ───────────────────────────────────────────────────────────────

@Composable
private fun TimerEditor(
    name: String,
    onNameChange: (String) -> Unit,
    hours: String,
    onHoursChange: (String) -> Unit,
    minutes: String,
    onMinutesChange: (String) -> Unit,
    seconds: String,
    onSecondsChange: (String) -> Unit,
    loop: Boolean,
    onLoopChange: (Boolean) -> Unit,
    showDurationError: Boolean
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        // Name (optional)
        OutlinedTextField(
            value = name,
            onValueChange = onNameChange,
            label = { Text("Name (optional)") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
            colors = CwocInputDefaults.outlinedColors()
        )

        // H:M:S inputs
        Text(
            text = "Duration:",
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.Medium,
            color = MaterialTheme.colorScheme.onSurface
        )
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            OutlinedTextField(
                value = hours,
                onValueChange = onHoursChange,
                label = { Text("H") },
                singleLine = true,
                modifier = Modifier.weight(1f),
                colors = CwocInputDefaults.outlinedColors(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                isError = showDurationError
            )
            Text(":", fontWeight = FontWeight.Bold, fontSize = 18.sp)
            OutlinedTextField(
                value = minutes,
                onValueChange = onMinutesChange,
                label = { Text("M") },
                singleLine = true,
                modifier = Modifier.weight(1f),
                colors = CwocInputDefaults.outlinedColors(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                isError = showDurationError
            )
            Text(":", fontWeight = FontWeight.Bold, fontSize = 18.sp)
            OutlinedTextField(
                value = seconds,
                onValueChange = onSecondsChange,
                label = { Text("S") },
                singleLine = true,
                modifier = Modifier.weight(1f),
                colors = CwocInputDefaults.outlinedColors(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                isError = showDurationError
            )
        }
        if (showDurationError) {
            Text(
                text = "Duration must be greater than 0",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.error
            )
        }

        // Loop toggle
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = "Loop",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurface
            )
            Switch(
                checked = loop,
                onCheckedChange = onLoopChange,
                colors = SwitchDefaults.colors(
                    checkedThumbColor = Color.White,
                    checkedTrackColor = ParchmentBrown
                )
            )
        }
    }
}

// ─── Stopwatch Editor ───────────────────────────────────────────────────────────

@Composable
private fun StopwatchEditor(
    name: String,
    onNameChange: (String) -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        // Name (optional)
        OutlinedTextField(
            value = name,
            onValueChange = onNameChange,
            label = { Text("Name (optional)") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
            colors = CwocInputDefaults.outlinedColors()
        )

        // Auto-start indicator
        Text(
            text = "⏱️ Starts automatically upon creation",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(vertical = 8.dp)
        )
    }
}
