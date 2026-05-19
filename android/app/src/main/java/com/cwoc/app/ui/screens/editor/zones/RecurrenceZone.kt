package com.cwoc.app.ui.screens.editor.zones

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.cwoc.app.domain.recurrence.RecurrenceEngine
import com.cwoc.app.domain.recurrence.RecurrenceRule
import com.cwoc.app.ui.components.FlatpickrCalendarPicker
import com.cwoc.app.ui.components.formatYMDDate
import com.cwoc.app.ui.components.parseYMDDate
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * Recurrence presets that map to standard RRULE JSON strings.
 */
private enum class RecurrencePreset(val label: String, val ruleJson: String?) {
    NONE("None", null),
    DAILY("Daily", """{"freq":"DAILY","interval":1}"""),
    WEEKLY("Weekly", """{"freq":"WEEKLY","interval":1}"""),
    MONTHLY("Monthly", """{"freq":"MONTHLY","interval":1}"""),
    YEARLY("Yearly", """{"freq":"YEARLY","interval":1}"""),
    CUSTOM("Custom", null)
}

/**
 * Frequency options for the custom recurrence builder.
 */
private enum class RecurrenceFrequency(val label: String, val value: String) {
    DAILY("Daily", "DAILY"),
    WEEKLY("Weekly", "WEEKLY"),
    MONTHLY("Monthly", "MONTHLY"),
    YEARLY("Yearly", "YEARLY")
}

/**
 * Day-of-week options for the by-day checkboxes.
 */
private enum class DayOption(val label: String, val code: String) {
    MON("Mon", "MO"),
    TUE("Tue", "TU"),
    WED("Wed", "WE"),
    THU("Thu", "TH"),
    FRI("Fri", "FR"),
    SAT("Sat", "SA"),
    SUN("Sun", "SU")
}

/**
 * RecurrenceZone composable for the chit editor.
 *
 * @deprecated This zone is deprecated as of Task 12 (android-dates-zone-parity spec).
 * All recurrence functionality is now inline within DateZone.kt as InlineRecurrenceRow.
 * This file is kept for backward compatibility with any existing references but should
 * not be used for new code. The inline recurrence row in DateZone provides:
 * - Checkbox labeled "🔁 Repeat"
 * - Contextual frequency dropdown (Daily, Weekly on [day], Monthly on the [date]th, etc.)
 * - "Ends never" checkbox + conditional until-date input
 * - Custom recurrence block with interval, unit, and by-day checkboxes
 * - Proper greyed-out state when date mode is None or Point in Time
 * - Habit-mode simplified labels
 *
 * Provides a collapsible zone with:
 * - Preset selector: None, Daily, Weekly, Monthly, Yearly, Custom
 * - Custom builder (shown when "Custom" selected): frequency dropdown,
 *   interval number input, by-day checkboxes (Mon–Sun for weekly),
 *   until date picker or count input
 * - Human-readable summary text (e.g., "Every Monday and Wednesday")
 * - "Clear" button to remove recurrence
 * - Recurrence exceptions display (read-only list of excluded dates)
 * - Uses existing RecurrenceEngine for rule generation/parsing
 *
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5
 *
 * @param recurrenceRule JSON string of the recurrence rule (nullable)
 * @param recurrenceExceptions JSON string of recurrence exceptions (nullable)
 * @param onRecurrenceRuleChanged Callback when the recurrence rule changes
 */
@Deprecated(
    message = "RecurrenceZone is deprecated. Use InlineRecurrenceRow in DateZone.kt instead.",
    level = DeprecationLevel.WARNING
)
@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun RecurrenceZone(
    recurrenceRule: String?,
    recurrenceExceptions: String?,
    onRecurrenceRuleChanged: (String?) -> Unit
) {
    var isExpanded by remember { mutableStateOf(recurrenceRule != null) }

    val gson = remember { Gson() }
    val recurrenceEngine = remember { RecurrenceEngine() }

    // Parse the current rule
    val parsedRule = remember(recurrenceRule) {
        parseRecurrenceRule(recurrenceRule, gson)
    }

    // Determine which preset is active
    val activePreset = remember(recurrenceRule, parsedRule) {
        determinePreset(parsedRule)
    }

    // Generate human-readable summary
    val summary = remember(parsedRule) {
        if (parsedRule != null) {
            recurrenceEngine.formatRule(parsedRule)
        } else {
            "None"
        }
    }

    // Parse exceptions for display
    val exceptions = remember(recurrenceExceptions) {
        parseExceptions(recurrenceExceptions, gson)
    }

    EditorZoneHeader(
        title = "Recurrence",
        isExpanded = isExpanded,
        onToggle = { isExpanded = !isExpanded },
        trailingContent = {
            if (!isExpanded && parsedRule != null) {
                Text(
                    text = summary,
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
            // --- Preset Selector ---
            PresetSelector(
                activePreset = activePreset,
                onPresetSelected = { preset ->
                    when (preset) {
                        RecurrencePreset.NONE -> onRecurrenceRuleChanged(null)
                        RecurrencePreset.CUSTOM -> {
                            // Initialize custom with current rule or default to daily
                            if (parsedRule == null) {
                                onRecurrenceRuleChanged("""{"freq":"DAILY","interval":1}""")
                            }
                            // If already has a rule, keep it (just switch to custom view)
                        }
                        else -> onRecurrenceRuleChanged(preset.ruleJson)
                    }
                }
            )

            // --- Human-readable summary ---
            if (parsedRule != null) {
                Text(
                    text = summary,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurface,
                    modifier = Modifier.padding(vertical = 4.dp)
                )
            }

            // --- Custom Builder (shown when Custom is selected) ---
            if (activePreset == RecurrencePreset.CUSTOM && parsedRule != null) {
                HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
                CustomRecurrenceBuilder(
                    rule = parsedRule,
                    gson = gson,
                    onRuleChanged = onRecurrenceRuleChanged
                )
            }

            // --- Clear Button ---
            if (parsedRule != null) {
                HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
                TextButton(onClick = { onRecurrenceRuleChanged(null) }) {
                    Text("Clear Recurrence")
                }
            }

            // --- Recurrence Exceptions (read-only) ---
            if (exceptions.isNotEmpty()) {
                HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
                RecurrenceExceptionsDisplay(exceptions = exceptions)
            }
        }
    }
}

// ─── Preset Selector ────────────────────────────────────────────────────────────

/**
 * Row of filter chips for selecting recurrence presets.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun PresetSelector(
    activePreset: RecurrencePreset,
    onPresetSelected: (RecurrencePreset) -> Unit
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Text(
            text = "Repeat",
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(modifier = Modifier.height(4.dp))
        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            RecurrencePreset.entries.forEach { preset ->
                FilterChip(
                    selected = (preset == activePreset),
                    onClick = { onPresetSelected(preset) },
                    label = { Text(preset.label) }
                )
            }
        }
    }
}

// ─── Custom Recurrence Builder ──────────────────────────────────────────────────

/**
 * Custom recurrence builder with frequency dropdown, interval input,
 * by-day checkboxes (for weekly), and until/count options.
 */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
private fun CustomRecurrenceBuilder(
    rule: RecurrenceRule,
    gson: Gson,
    onRuleChanged: (String?) -> Unit
) {
    var showUntilDatePicker by remember { mutableStateOf(false) }
    var frequencyExpanded by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // --- Frequency Dropdown ---
        ExposedDropdownMenuBox(
            expanded = frequencyExpanded,
            onExpandedChange = { frequencyExpanded = it }
        ) {
            OutlinedTextField(
                value = RecurrenceFrequency.entries
                    .find { it.value == rule.freq.uppercase() }?.label ?: rule.freq,
                onValueChange = {},
                readOnly = true,
                label = { Text("Frequency") },
                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = frequencyExpanded) },
                modifier = Modifier
                    .fillMaxWidth()
                    .menuAnchor()
            )
            ExposedDropdownMenu(
                expanded = frequencyExpanded,
                onDismissRequest = { frequencyExpanded = false }
            ) {
                RecurrenceFrequency.entries.forEach { freq ->
                    DropdownMenuItem(
                        text = { Text(freq.label) },
                        onClick = {
                            frequencyExpanded = false
                            val updatedRule = rule.copy(
                                freq = freq.value,
                                // Clear byDay if switching away from weekly
                                byDay = if (freq.value == "WEEKLY") rule.byDay else null
                            )
                            onRuleChanged(gson.toJson(updatedRule))
                        }
                    )
                }
            }
        }

        // --- Interval Input ---
        OutlinedTextField(
            value = rule.interval.toString(),
            onValueChange = { newValue ->
                val interval = newValue.toIntOrNull()?.coerceAtLeast(1) ?: 1
                val updatedRule = rule.copy(interval = interval)
                onRuleChanged(gson.toJson(updatedRule))
            },
            label = { Text("Every") },
            suffix = {
                Text(
                    when (rule.freq.uppercase()) {
                        "DAILY" -> if (rule.interval == 1) "day" else "days"
                        "WEEKLY" -> if (rule.interval == 1) "week" else "weeks"
                        "MONTHLY" -> if (rule.interval == 1) "month" else "months"
                        "YEARLY" -> if (rule.interval == 1) "year" else "years"
                        else -> ""
                    }
                )
            },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )

        // --- By-Day Checkboxes (shown for weekly frequency) ---
        if (rule.freq.uppercase() == "WEEKLY") {
            Text(
                text = "On days",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(4.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                val selectedDays = rule.byDay?.map { it.uppercase() }?.toSet() ?: emptySet()
                DayOption.entries.forEach { day ->
                    FilterChip(
                        selected = day.code in selectedDays,
                        onClick = {
                            val newDays = if (day.code in selectedDays) {
                                selectedDays - day.code
                            } else {
                                selectedDays + day.code
                            }
                            val updatedRule = rule.copy(
                                byDay = if (newDays.isEmpty()) null else newDays.toList()
                            )
                            onRuleChanged(gson.toJson(updatedRule))
                        },
                        label = { Text(day.label) }
                    )
                }
            }
        }

        // --- Until / Count ---
        HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
        Text(
            text = "Ends",
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        // Until date
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Until:",
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.width(60.dp)
            )
            TextButton(onClick = { showUntilDatePicker = true }) {
                Text(
                    text = rule.until?.let { formatUntilDate(it) } ?: "Set date"
                )
            }
            if (rule.until != null) {
                TextButton(onClick = {
                    val updatedRule = rule.copy(until = null)
                    onRuleChanged(gson.toJson(updatedRule))
                }) {
                    Text("Clear")
                }
            }
        }

        // Count
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "After:",
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.width(60.dp)
            )
            OutlinedTextField(
                value = rule.count?.toString() ?: "",
                onValueChange = { newValue ->
                    val count = newValue.toIntOrNull()?.coerceAtLeast(1)
                    val updatedRule = rule.copy(
                        count = count,
                        // Clear until if setting count
                        until = if (count != null) null else rule.until
                    )
                    onRuleChanged(gson.toJson(updatedRule))
                },
                label = { Text("occurrences") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                singleLine = true,
                modifier = Modifier.weight(1f)
            )
        }
    }

    // --- Until Date Picker (FlatpickrCalendarPicker — replaces native DatePickerDialog) ---
    if (showUntilDatePicker) {
        val initialDateStr = rule.until?.let { dateStr ->
            try {
                val localDate = LocalDate.parse(dateStr.substringBefore('T'))
                formatYMDDate(localDate)
            } catch (_: Exception) {
                null
            }
        }

        FlatpickrCalendarPicker(
            isOpen = true,
            initialDate = initialDateStr,
            onDateSelected = { ymdDate ->
                val selectedDate = parseYMDDate(ymdDate)
                if (selectedDate != null) {
                    val updatedRule = rule.copy(
                        until = selectedDate.format(DateTimeFormatter.ISO_LOCAL_DATE),
                        // Clear count if setting until
                        count = null
                    )
                    onRuleChanged(gson.toJson(updatedRule))
                }
                showUntilDatePicker = false
            },
            onDismiss = { showUntilDatePicker = false }
        )
    }
}

// ─── Recurrence Exceptions Display ──────────────────────────────────────────────

/**
 * Read-only display of recurrence exception dates.
 */
@Composable
private fun RecurrenceExceptionsDisplay(exceptions: List<String>) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Text(
            text = "Excluded Dates",
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(modifier = Modifier.height(4.dp))
        exceptions.forEach { dateStr ->
            Text(
                text = formatExceptionDate(dateStr),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurface,
                modifier = Modifier.padding(vertical = 2.dp)
            )
        }
    }
}

// ─── Utility Functions ──────────────────────────────────────────────────────────

/**
 * Parses a JSON recurrence rule string into a RecurrenceRule object.
 * Returns null if the string is null, blank, or unparseable.
 */
private fun parseRecurrenceRule(ruleJson: String?, gson: Gson): RecurrenceRule? {
    if (ruleJson.isNullOrBlank()) return null
    return try {
        gson.fromJson(ruleJson, RecurrenceRule::class.java)
    } catch (_: Exception) {
        null
    }
}

/**
 * Parses the recurrence exceptions JSON string into a list of date strings.
 * Supports both simple string arrays ["2025-06-05"] and object arrays with date fields.
 */
private fun parseExceptions(exceptionsJson: String?, gson: Gson): List<String> {
    if (exceptionsJson.isNullOrBlank()) return emptyList()
    return try {
        // Try parsing as a list of strings first
        val listType = object : TypeToken<List<Any>>() {}.type
        val parsed: List<Any> = gson.fromJson(exceptionsJson, listType)
        parsed.mapNotNull { item ->
            when (item) {
                is String -> item
                is Map<*, *> -> item["date"] as? String
                else -> item.toString()
            }
        }
    } catch (_: Exception) {
        emptyList()
    }
}

/**
 * Determines which preset matches the current rule, or CUSTOM if none match.
 */
private fun determinePreset(rule: RecurrenceRule?): RecurrencePreset {
    if (rule == null) return RecurrencePreset.NONE

    val freq = rule.freq.uppercase()
    val interval = rule.interval
    val hasByDay = !rule.byDay.isNullOrEmpty()
    val hasUntil = rule.until != null
    val hasCount = rule.count != null
    val hasByMonthDay = rule.byMonthDay != null
    val hasBySetPos = rule.bySetPos != null

    // Simple presets: interval=1, no byDay, no until/count, no byMonthDay/bySetPos
    if (interval == 1 && !hasByDay && !hasUntil && !hasCount && !hasByMonthDay && !hasBySetPos) {
        return when (freq) {
            "DAILY" -> RecurrencePreset.DAILY
            "WEEKLY" -> RecurrencePreset.WEEKLY
            "MONTHLY" -> RecurrencePreset.MONTHLY
            "YEARLY" -> RecurrencePreset.YEARLY
            else -> RecurrencePreset.CUSTOM
        }
    }

    return RecurrencePreset.CUSTOM
}

/**
 * Formats an until date string for display.
 */
private fun formatUntilDate(dateStr: String): String {
    return try {
        val date = LocalDate.parse(dateStr.substringBefore('T'))
        date.format(DateTimeFormatter.ofPattern("MMM d, yyyy", Locale.getDefault()))
    } catch (_: Exception) {
        dateStr
    }
}

/**
 * Formats an exception date string for display.
 */
private fun formatExceptionDate(dateStr: String): String {
    return try {
        val date = LocalDate.parse(dateStr.substringBefore('T'))
        date.format(DateTimeFormatter.ofPattern("EEE, MMM d, yyyy", Locale.getDefault()))
    } catch (_: Exception) {
        dateStr
    }
}
