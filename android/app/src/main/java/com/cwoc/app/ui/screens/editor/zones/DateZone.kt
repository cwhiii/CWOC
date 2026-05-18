package com.cwoc.app.ui.screens.editor.zones

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarToday
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TimePicker
import androidx.compose.material3.Checkbox
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.material3.rememberTimePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeParseException
import java.util.Locale

/**
 * Date mode options for the chit editor, matching the web app's radio buttons.
 */
enum class DateMode(val label: String) {
    START_END("Start / End"),
    DUE_ONLY("Due Only"),
    PERPETUAL("Perpetual"),
    POINT_IN_TIME("Point in Time"),
    NONE("None")
}

/**
 * DateZone composable for the chit editor.
 *
 * Provides a collapsible zone with:
 * - Date mode selector (radio buttons): Start/End, Due Only, Perpetual, Point-in-Time, None
 * - Show/hide date fields based on selected mode
 * - Material 3 DatePickerDialog for date selection
 * - Material 3 TimePickerDialog for time selection with snap interval
 * - All-Day toggle that hides time pickers
 * - Timezone field with searchable dropdown of IANA timezones
 * - Dates displayed in user's configured format (12h/24h)
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 *
 * @param startDatetime ISO datetime string for start (nullable)
 * @param endDatetime ISO datetime string for end (nullable)
 * @param dueDatetime ISO datetime string for due date (nullable)
 * @param pointInTime ISO datetime string for point-in-time (nullable)
 * @param perpetual Whether the chit is perpetual (no end date)
 * @param allDay Whether this is an all-day event (hides time pickers)
 * @param timezone IANA timezone ID (nullable, uses default if null)
 * @param onStartDatetimeChange Callback when start datetime changes
 * @param onEndDatetimeChange Callback when end datetime changes
 * @param onDueDatetimeChange Callback when due datetime changes
 * @param onPointInTimeChange Callback when point-in-time changes
 * @param onPerpetualChange Callback when perpetual flag changes
 * @param onAllDayChange Callback when all-day toggle changes
 * @param onTimezoneChange Callback when timezone changes
 * @param timeFormat "12h" or "24h" from user settings
 * @param calendarSnap Snap interval in minutes for time picker (e.g., 15)
 * @param defaultTimezone Default timezone from settings (used when timezone is null)
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DateZone(
    startDatetime: String?,
    endDatetime: String?,
    dueDatetime: String?,
    pointInTime: String?,
    perpetual: Boolean,
    allDay: Boolean,
    timezone: String?,
    onStartDatetimeChange: (String?) -> Unit,
    onEndDatetimeChange: (String?) -> Unit,
    onDueDatetimeChange: (String?) -> Unit,
    onPointInTimeChange: (String?) -> Unit,
    onPerpetualChange: (Boolean) -> Unit,
    onAllDayChange: (Boolean) -> Unit,
    onTimezoneChange: (String?) -> Unit,
    // E1: Status for "Complete" checkbox in Due mode
    status: String? = null,
    onStatusChange: ((String) -> Unit)? = null,
    // E4: Repeat toggle in Dates zone (shows recurrence is active)
    recurrenceRule: String? = null,
    onRecurrenceToggle: ((Boolean) -> Unit)? = null,
    // E6: Suggested timezone from geocoded location
    suggestedTimezone: String? = null,
    timeFormat: String = "12h",
    calendarSnap: Int = 15,
    defaultTimezone: String = "America/New_York"
) {
    var isExpanded by remember { mutableStateOf(true) }

    // Derive current date mode from the field values
    val currentMode = remember(startDatetime, endDatetime, dueDatetime, pointInTime, perpetual) {
        deriveDateMode(startDatetime, endDatetime, dueDatetime, pointInTime, perpetual)
    }

    EditorZoneHeader(
        title = "Dates",
        isExpanded = isExpanded,
        onToggle = { isExpanded = !isExpanded },
        trailingContent = {
            // E3: All Day toggle in zone header for quick access
            if (currentMode != DateMode.PERPETUAL && currentMode != DateMode.NONE) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = "All Day",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Switch(
                        checked = allDay,
                        onCheckedChange = onAllDayChange,
                        modifier = Modifier.height(24.dp)
                    )
                }
            }
            // Show a brief summary when collapsed
            if (!isExpanded) {
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = currentMode.label,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    ) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // --- Date Mode Selector (radio buttons) ---
            DateModeSelector(
                selectedMode = currentMode,
                onModeSelected = { mode ->
                    applyDateMode(
                        mode = mode,
                        onStartDatetimeChange = onStartDatetimeChange,
                        onEndDatetimeChange = onEndDatetimeChange,
                        onDueDatetimeChange = onDueDatetimeChange,
                        onPointInTimeChange = onPointInTimeChange,
                        onPerpetualChange = onPerpetualChange
                    )
                }
            )

            // --- Date/Time fields based on mode ---
            // E5: Compute timezone abbreviation for display
            val tzAbbr = remember(timezone, defaultTimezone) {
                try {
                    val zoneId = java.time.ZoneId.of(timezone ?: defaultTimezone)
                    zoneId.rules.getOffset(java.time.Instant.now())
                        .let { offset ->
                            val tz = java.util.TimeZone.getTimeZone(zoneId)
                            tz.getDisplayName(tz.inDaylightTime(java.util.Date()), java.util.TimeZone.SHORT)
                        }
                } catch (e: Exception) { null }
            }

            when (currentMode) {
                DateMode.START_END -> {
                    DateTimeField(
                        label = "Start",
                        datetimeValue = startDatetime,
                        onDatetimeChange = onStartDatetimeChange,
                        allDay = allDay,
                        timeFormat = timeFormat,
                        calendarSnap = calendarSnap,
                        timezoneAbbr = tzAbbr
                    )
                    DateTimeField(
                        label = "End",
                        datetimeValue = endDatetime,
                        onDatetimeChange = onEndDatetimeChange,
                        allDay = allDay,
                        timeFormat = timeFormat,
                        calendarSnap = calendarSnap,
                        timezoneAbbr = tzAbbr
                    )
                }

                DateMode.DUE_ONLY -> {
                    DateTimeField(
                        label = "Due",
                        datetimeValue = dueDatetime,
                        onDatetimeChange = onDueDatetimeChange,
                        allDay = allDay,
                        timeFormat = timeFormat,
                        calendarSnap = calendarSnap,
                        timezoneAbbr = tzAbbr
                    )
                    // E1: "Complete" checkbox — marks the task as complete
                    if (onStatusChange != null) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(top = 8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Checkbox(
                                checked = status == "Complete",
                                onCheckedChange = { checked ->
                                    onStatusChange(if (checked) "Complete" else "ToDo")
                                }
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = "Complete",
                                style = MaterialTheme.typography.bodyMedium
                            )
                        }
                    }
                }

                DateMode.POINT_IN_TIME -> {
                    DateTimeField(
                        label = "Date/Time",
                        datetimeValue = pointInTime,
                        onDatetimeChange = onPointInTimeChange,
                        allDay = allDay,
                        timeFormat = timeFormat,
                        calendarSnap = calendarSnap,
                        timezoneAbbr = tzAbbr
                    )
                    // E2: "Now" button — sets point-in-time to current date/time
                    TextButton(
                        onClick = {
                            val now = LocalDateTime.now()
                            val isoStr = now.format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)
                            onPointInTimeChange(isoStr)
                        }
                    ) {
                        Text("⏱ Now")
                    }
                }

                DateMode.PERPETUAL, DateMode.NONE -> {
                    // No date fields shown
                }
            }

            // --- All-Day toggle (shown for modes that have date fields) ---
            if (currentMode != DateMode.PERPETUAL && currentMode != DateMode.NONE) {
                HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "All Day",
                        style = MaterialTheme.typography.bodyLarge
                    )
                    Switch(
                        checked = allDay,
                        onCheckedChange = onAllDayChange
                    )
                }
            }

            // --- Timezone (shown for modes that have date fields) ---
            if (currentMode != DateMode.PERPETUAL && currentMode != DateMode.NONE) {
                HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
                TimezoneSelector(
                    selectedTimezone = timezone ?: defaultTimezone,
                    onTimezoneSelected = onTimezoneChange
                )
                // E6: Suggested timezone from geocoded location
                if (!suggestedTimezone.isNullOrBlank() && suggestedTimezone != (timezone ?: defaultTimezone)) {
                    TextButton(
                        onClick = { onTimezoneChange(suggestedTimezone) }
                    ) {
                        Text(
                            text = "📍 Use $suggestedTimezone (from location)",
                            style = MaterialTheme.typography.labelSmall
                        )
                    }
                }

                // E4: Repeat toggle inline in Dates zone
                if (onRecurrenceToggle != null) {
                    HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "🔁 Repeat",
                            style = MaterialTheme.typography.bodyLarge
                        )
                        Switch(
                            checked = !recurrenceRule.isNullOrBlank(),
                            onCheckedChange = { checked -> onRecurrenceToggle(checked) }
                        )
                    }
                    if (!recurrenceRule.isNullOrBlank()) {
                        Text(
                            text = recurrenceRule ?: "",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(start = 8.dp, top = 2.dp)
                        )
                    }
                }
            }
        }
    }
}

// ─── Date Mode Selector ─────────────────────────────────────────────────────────

/**
 * Radio button group for selecting the date mode.
 */
@Composable
private fun DateModeSelector(
    selectedMode: DateMode,
    onModeSelected: (DateMode) -> Unit
) {
    Column(modifier = Modifier.selectableGroup()) {
        DateMode.entries.forEach { mode ->
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .selectable(
                        selected = (mode == selectedMode),
                        onClick = { onModeSelected(mode) },
                        role = Role.RadioButton
                    )
                    .padding(vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                RadioButton(
                    selected = (mode == selectedMode),
                    onClick = null // handled by row's selectable
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = mode.label,
                    style = MaterialTheme.typography.bodyMedium
                )
            }
        }
    }
}

// ─── Date/Time Field ────────────────────────────────────────────────────────────

/**
 * A combined date + time field with picker dialogs.
 * Shows a read-only text field with calendar and clock icons that open pickers.
 * When allDay is true, the time picker icon is hidden.
 *
 * @param label Field label (e.g., "Start", "End", "Due")
 * @param datetimeValue ISO datetime string (nullable)
 * @param onDatetimeChange Callback with updated ISO datetime string
 * @param allDay Whether to hide the time picker
 * @param timeFormat "12h" or "24h"
 * @param calendarSnap Snap interval in minutes for time picker
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DateTimeField(
    label: String,
    datetimeValue: String?,
    onDatetimeChange: (String?) -> Unit,
    allDay: Boolean,
    timeFormat: String,
    calendarSnap: Int,
    // E5: Timezone abbreviation to display next to the field
    timezoneAbbr: String? = null
) {
    var showDatePicker by remember { mutableStateOf(false) }
    var showTimePicker by remember { mutableStateOf(false) }

    // Parse the current datetime value
    val parsedDateTime = remember(datetimeValue) {
        parseIsoDatetime(datetimeValue)
    }

    // Format for display
    val displayText = remember(datetimeValue, allDay, timeFormat) {
        formatDatetimeForDisplay(datetimeValue, allDay, timeFormat)
    }

    Column(modifier = Modifier.fillMaxWidth()) {
        // E5: Label with timezone abbreviation
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = label,
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            if (!timezoneAbbr.isNullOrBlank()) {
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = timezoneAbbr,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.primary
                )
            }
        }
        Spacer(modifier = Modifier.height(4.dp))
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Display field (read-only, shows formatted date/time)
            OutlinedTextField(
                value = displayText,
                onValueChange = {},
                readOnly = true,
                modifier = Modifier.weight(1f),
                singleLine = true,
                placeholder = { Text("Tap to set $label date") }
            )

            // Date picker button
            IconButton(onClick = { showDatePicker = true }) {
                Icon(
                    imageVector = Icons.Default.CalendarToday,
                    contentDescription = "Pick $label date"
                )
            }

            // Time picker button (hidden when all-day)
            if (!allDay) {
                IconButton(onClick = { showTimePicker = true }) {
                    Icon(
                        imageVector = Icons.Default.Schedule,
                        contentDescription = "Pick $label time"
                    )
                }
            }
        }
    }

    // --- Date Picker Dialog ---
    if (showDatePicker) {
        val initialMillis = parsedDateTime?.toLocalDate()
            ?.atStartOfDay(ZoneOffset.UTC)
            ?.toInstant()
            ?.toEpochMilli()

        val datePickerState = rememberDatePickerState(
            initialSelectedDateMillis = initialMillis
        )

        DatePickerDialog(
            onDismissRequest = { showDatePicker = false },
            confirmButton = {
                TextButton(onClick = {
                    val selectedMillis = datePickerState.selectedDateMillis
                    if (selectedMillis != null) {
                        val selectedDate = Instant.ofEpochMilli(selectedMillis)
                            .atZone(ZoneOffset.UTC)
                            .toLocalDate()
                        val existingTime = parsedDateTime?.toLocalTime() ?: LocalTime.NOON
                        val newDateTime = LocalDateTime.of(selectedDate, existingTime)
                        onDatetimeChange(newDateTime.format(ISO_LOCAL_DATETIME_FORMATTER))
                    }
                    showDatePicker = false
                }) {
                    Text("OK")
                }
            },
            dismissButton = {
                TextButton(onClick = { showDatePicker = false }) {
                    Text("Cancel")
                }
            }
        ) {
            DatePicker(state = datePickerState)
        }
    }

    // --- Time Picker Dialog ---
    if (showTimePicker) {
        val currentTime = parsedDateTime?.toLocalTime() ?: LocalTime.NOON
        val snappedTime = snapTime(currentTime, calendarSnap)

        val timePickerState = rememberTimePickerState(
            initialHour = snappedTime.hour,
            initialMinute = snappedTime.minute,
            is24Hour = (timeFormat == "24h")
        )

        TimePickerDialog(
            onDismiss = { showTimePicker = false },
            onConfirm = {
                val selectedHour = timePickerState.hour
                val selectedMinute = snapMinute(timePickerState.minute, calendarSnap)
                val currentDate = parsedDateTime?.toLocalDate() ?: LocalDate.now()
                val newDateTime = LocalDateTime.of(
                    currentDate,
                    LocalTime.of(selectedHour, selectedMinute)
                )
                onDatetimeChange(newDateTime.format(ISO_LOCAL_DATETIME_FORMATTER))
                showTimePicker = false
            }
        ) {
            TimePicker(state = timePickerState)
        }
    }
}

// ─── Time Picker Dialog Wrapper ─────────────────────────────────────────────────

/**
 * Wrapper composable for Material 3 TimePickerDialog since it's not a built-in
 * composable in all M3 versions. Uses AlertDialog pattern.
 */
@Composable
private fun TimePickerDialog(
    onDismiss: () -> Unit,
    onConfirm: () -> Unit,
    content: @Composable () -> Unit
) {
    androidx.compose.material3.AlertDialog(
        onDismissRequest = onDismiss,
        confirmButton = {
            TextButton(onClick = onConfirm) {
                Text("OK")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        },
        title = { Text("Select Time") },
        text = { content() }
    )
}

// ─── Timezone Selector ──────────────────────────────────────────────────────────

/**
 * Searchable timezone dropdown using IANA timezone IDs.
 * Shows a text field that filters the timezone list as the user types.
 */
@Composable
private fun TimezoneSelector(
    selectedTimezone: String,
    onTimezoneSelected: (String?) -> Unit
) {
    var searchQuery by remember { mutableStateOf("") }
    var isSearching by remember { mutableStateOf(false) }

    val filteredTimezones = remember(searchQuery) {
        if (searchQuery.isBlank()) {
            COMMON_TIMEZONES
        } else {
            COMMON_TIMEZONES.filter { tz ->
                tz.contains(searchQuery, ignoreCase = true)
            }
        }
    }

    Column(modifier = Modifier.fillMaxWidth()) {
        Text(
            text = "Timezone",
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(modifier = Modifier.height(4.dp))

        if (isSearching) {
            // Search mode: show text field + filtered list
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { searchQuery = it },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                placeholder = { Text("Search timezones...") }
            )
            Spacer(modifier = Modifier.height(4.dp))
            LazyColumn(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(max = 200.dp)
            ) {
                items(filteredTimezones) { tz ->
                    Text(
                        text = tz,
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                onTimezoneSelected(tz)
                                isSearching = false
                                searchQuery = ""
                            }
                            .padding(vertical = 8.dp, horizontal = 4.dp),
                        style = MaterialTheme.typography.bodyMedium,
                        color = if (tz == selectedTimezone)
                            MaterialTheme.colorScheme.primary
                        else
                            MaterialTheme.colorScheme.onSurface
                    )
                }
            }
            TextButton(onClick = {
                isSearching = false
                searchQuery = ""
            }) {
                Text("Cancel")
            }
        } else {
            // Display mode: show selected timezone, tap to search
            OutlinedTextField(
                value = selectedTimezone,
                onValueChange = {},
                readOnly = true,
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { isSearching = true },
                singleLine = true
            )
        }
    }
}

// ─── Utility Functions ──────────────────────────────────────────────────────────

/**
 * Derives the current DateMode from the field values.
 */
private fun deriveDateMode(
    startDatetime: String?,
    endDatetime: String?,
    dueDatetime: String?,
    pointInTime: String?,
    perpetual: Boolean
): DateMode {
    return when {
        perpetual -> DateMode.PERPETUAL
        pointInTime != null -> DateMode.POINT_IN_TIME
        startDatetime != null || endDatetime != null -> DateMode.START_END
        dueDatetime != null -> DateMode.DUE_ONLY
        else -> DateMode.NONE
    }
}

/**
 * Applies a date mode change by clearing irrelevant fields and setting flags.
 */
private fun applyDateMode(
    mode: DateMode,
    onStartDatetimeChange: (String?) -> Unit,
    onEndDatetimeChange: (String?) -> Unit,
    onDueDatetimeChange: (String?) -> Unit,
    onPointInTimeChange: (String?) -> Unit,
    onPerpetualChange: (Boolean) -> Unit
) {
    when (mode) {
        DateMode.START_END -> {
            onDueDatetimeChange(null)
            onPointInTimeChange(null)
            onPerpetualChange(false)
            // Keep start/end as-is (user will set them via pickers)
        }

        DateMode.DUE_ONLY -> {
            onStartDatetimeChange(null)
            onEndDatetimeChange(null)
            onPointInTimeChange(null)
            onPerpetualChange(false)
        }

        DateMode.PERPETUAL -> {
            onStartDatetimeChange(null)
            onEndDatetimeChange(null)
            onDueDatetimeChange(null)
            onPointInTimeChange(null)
            onPerpetualChange(true)
        }

        DateMode.POINT_IN_TIME -> {
            onStartDatetimeChange(null)
            onEndDatetimeChange(null)
            onDueDatetimeChange(null)
            onPerpetualChange(false)
            // Keep pointInTime as-is (user will set via picker)
        }

        DateMode.NONE -> {
            onStartDatetimeChange(null)
            onEndDatetimeChange(null)
            onDueDatetimeChange(null)
            onPointInTimeChange(null)
            onPerpetualChange(false)
        }
    }
}

/**
 * Parses an ISO datetime string into a LocalDateTime.
 * Handles both full ISO-8601 (with timezone) and local datetime formats.
 * Returns null if parsing fails or input is null/blank.
 */
private fun parseIsoDatetime(value: String?): LocalDateTime? {
    if (value.isNullOrBlank()) return null
    return try {
        // Try parsing as ISO instant first (e.g., "2024-01-15T10:30:00Z")
        val instant = Instant.parse(value)
        LocalDateTime.ofInstant(instant, ZoneId.systemDefault())
    } catch (_: DateTimeParseException) {
        try {
            // Try as local datetime (e.g., "2024-01-15T10:30:00" or "2024-01-15T10:30")
            LocalDateTime.parse(value)
        } catch (_: DateTimeParseException) {
            try {
                // Try as date only (e.g., "2024-01-15")
                LocalDate.parse(value).atStartOfDay()
            } catch (_: DateTimeParseException) {
                null
            }
        }
    }
}

/**
 * Formats a datetime value for display based on the user's time format preference.
 *
 * @param value ISO datetime string
 * @param allDay If true, only shows the date portion
 * @param timeFormat "12h" or "24h"
 * @return Formatted display string, or empty string if value is null
 */
internal fun formatDatetimeForDisplay(value: String?, allDay: Boolean, timeFormat: String): String {
    if (value.isNullOrBlank()) return ""
    val dateTime = parseIsoDatetime(value) ?: return value

    return if (allDay) {
        dateTime.format(DATE_DISPLAY_FORMATTER)
    } else {
        val timePattern = if (timeFormat == "24h") "HH:mm" else "h:mm a"
        val formatter = DateTimeFormatter.ofPattern(
            "MMM d, yyyy  $timePattern",
            Locale.getDefault()
        )
        dateTime.format(formatter)
    }
}

/**
 * Snaps a time to the nearest interval that is <= the original time.
 * The snapped minutes will be evenly divisible by the interval.
 *
 * @param time The original time
 * @param snapMinutes The snap interval in minutes (e.g., 15)
 * @return Time with minutes snapped down to the nearest interval
 */
internal fun snapTime(time: LocalTime, snapMinutes: Int): LocalTime {
    if (snapMinutes <= 0 || snapMinutes > 60) return time
    val snappedMinute = (time.minute / snapMinutes) * snapMinutes
    return LocalTime.of(time.hour, snappedMinute)
}

/**
 * Snaps a minute value to the nearest interval that is <= the original.
 *
 * @param minute The minute value (0-59)
 * @param snapMinutes The snap interval
 * @return Snapped minute value
 */
internal fun snapMinute(minute: Int, snapMinutes: Int): Int {
    if (snapMinutes <= 0 || snapMinutes > 60) return minute
    return (minute / snapMinutes) * snapMinutes
}

// ─── Formatters ─────────────────────────────────────────────────────────────────

private val ISO_LOCAL_DATETIME_FORMATTER: DateTimeFormatter =
    DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss")

private val DATE_DISPLAY_FORMATTER: DateTimeFormatter =
    DateTimeFormatter.ofPattern("MMM d, yyyy", Locale.getDefault())

// ─── Common IANA Timezones ──────────────────────────────────────────────────────

/**
 * List of common IANA timezone IDs for the searchable dropdown.
 * Covers major cities across all UTC offsets.
 */
internal val COMMON_TIMEZONES: List<String> = listOf(
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "America/Anchorage",
    "America/Phoenix",
    "America/Toronto",
    "America/Vancouver",
    "America/Mexico_City",
    "America/Bogota",
    "America/Lima",
    "America/Sao_Paulo",
    "America/Buenos_Aires",
    "America/Santiago",
    "America/Halifax",
    "America/St_Johns",
    "Pacific/Honolulu",
    "Pacific/Auckland",
    "Pacific/Fiji",
    "Pacific/Guam",
    "Europe/London",
    "Europe/Paris",
    "Europe/Berlin",
    "Europe/Madrid",
    "Europe/Rome",
    "Europe/Amsterdam",
    "Europe/Brussels",
    "Europe/Zurich",
    "Europe/Vienna",
    "Europe/Stockholm",
    "Europe/Oslo",
    "Europe/Helsinki",
    "Europe/Warsaw",
    "Europe/Prague",
    "Europe/Budapest",
    "Europe/Bucharest",
    "Europe/Athens",
    "Europe/Istanbul",
    "Europe/Moscow",
    "Europe/Kiev",
    "Asia/Dubai",
    "Asia/Karachi",
    "Asia/Kolkata",
    "Asia/Dhaka",
    "Asia/Bangkok",
    "Asia/Singapore",
    "Asia/Hong_Kong",
    "Asia/Shanghai",
    "Asia/Taipei",
    "Asia/Seoul",
    "Asia/Tokyo",
    "Asia/Jakarta",
    "Asia/Manila",
    "Asia/Riyadh",
    "Asia/Tehran",
    "Asia/Kabul",
    "Asia/Kathmandu",
    "Asia/Yangon",
    "Asia/Vladivostok",
    "Africa/Cairo",
    "Africa/Lagos",
    "Africa/Nairobi",
    "Africa/Johannesburg",
    "Africa/Casablanca",
    "Australia/Sydney",
    "Australia/Melbourne",
    "Australia/Brisbane",
    "Australia/Perth",
    "Australia/Adelaide",
    "Australia/Darwin",
    "Indian/Maldives",
    "Atlantic/Reykjavik"
)
