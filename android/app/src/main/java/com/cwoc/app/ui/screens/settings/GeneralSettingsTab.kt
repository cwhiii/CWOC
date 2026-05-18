package com.cwoc.app.ui.screens.settings

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.MaterialTheme

import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

/**
 * Common IANA timezones for the searchable timezone dropdown.
 */
private val COMMON_TIMEZONES = listOf(
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "America/Anchorage",
    "America/Phoenix",
    "America/Toronto",
    "America/Vancouver",
    "America/Mexico_City",
    "America/Sao_Paulo",
    "America/Argentina/Buenos_Aires",
    "America/Bogota",
    "America/Lima",
    "Europe/London",
    "Europe/Paris",
    "Europe/Berlin",
    "Europe/Madrid",
    "Europe/Rome",
    "Europe/Amsterdam",
    "Europe/Moscow",
    "Europe/Istanbul",
    "Europe/Athens",
    "Asia/Tokyo",
    "Asia/Shanghai",
    "Asia/Hong_Kong",
    "Asia/Singapore",
    "Asia/Seoul",
    "Asia/Kolkata",
    "Asia/Dubai",
    "Asia/Bangkok",
    "Asia/Jakarta",
    "Asia/Taipei",
    "Asia/Manila",
    "Australia/Sydney",
    "Australia/Melbourne",
    "Australia/Perth",
    "Australia/Brisbane",
    "Pacific/Auckland",
    "Pacific/Honolulu",
    "Pacific/Fiji",
    "Africa/Cairo",
    "Africa/Johannesburg",
    "Africa/Lagos",
    "Africa/Nairobi",
    "UTC"
)

/**
 * General settings tab composable.
 * Fields: time format (12h/24h toggle), week start day dropdown,
 * calendar snap interval dropdown, snooze length dropdown,
 * default timezone (searchable), unit system toggle.
 *
 * Validates: Requirements 2.3
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GeneralSettingsTab(
    formState: SettingsFormState,
    onUpdateSetting: (key: String, value: String) -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .verticalScroll(rememberScrollState())
            .padding(16.dp)
    ) {
        // --- Time Format Toggle (12h / 24h) ---
        Text(
            text = "Time Format",
            style = MaterialTheme.typography.labelLarge,
            modifier = Modifier.padding(bottom = 8.dp)
        )
        SingleChoiceSegmentedButtonRow(modifier = Modifier.fillMaxWidth()) {
            val timeOptions = listOf("12h", "24h")
            timeOptions.forEachIndexed { index, option ->
                SegmentedButton(
                    selected = formState.timeFormat == option,
                    onClick = { onUpdateSetting("time_format", option) },
                    shape = SegmentedButtonDefaults.itemShape(
                        index = index,
                        count = timeOptions.size
                    )
                ) {
                    Text(option)
                }
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        // --- Week Start Day Dropdown ---
        Text(
            text = "Week Start Day",
            style = MaterialTheme.typography.labelLarge,
            modifier = Modifier.padding(bottom = 8.dp)
        )
        SettingsDropdown(
            selectedValue = formState.weekStartDay.replaceFirstChar { it.uppercase() },
            options = listOf("Sunday", "Monday", "Saturday"),
            onOptionSelected = { onUpdateSetting("week_start_day", it.lowercase()) }
        )

        Spacer(modifier = Modifier.height(24.dp))

        // --- Calendar Snap Interval Dropdown ---
        Text(
            text = "Calendar Snap Interval",
            style = MaterialTheme.typography.labelLarge,
            modifier = Modifier.padding(bottom = 8.dp)
        )
        SettingsDropdown(
            selectedValue = "${formState.calendarSnapInterval} min",
            options = listOf("5 min", "10 min", "15 min", "30 min", "60 min"),
            onOptionSelected = { selected ->
                val minutes = selected.replace(" min", "")
                onUpdateSetting("calendar_snap_interval", minutes)
            }
        )

        Spacer(modifier = Modifier.height(24.dp))

        // --- Snooze Length Dropdown ---
        Text(
            text = "Snooze Length",
            style = MaterialTheme.typography.labelLarge,
            modifier = Modifier.padding(bottom = 8.dp)
        )
        SettingsDropdown(
            selectedValue = "${formState.snoozeLength} min",
            options = listOf("5 min", "10 min", "15 min", "30 min", "60 min"),
            onOptionSelected = { selected ->
                val minutes = selected.replace(" min", "")
                onUpdateSetting("snooze_length", minutes)
            }
        )

        Spacer(modifier = Modifier.height(24.dp))

        // --- Default Timezone (Searchable) ---
        Text(
            text = "Default Timezone",
            style = MaterialTheme.typography.labelLarge,
            modifier = Modifier.padding(bottom = 8.dp)
        )
        TimezoneSearchField(
            selectedTimezone = formState.defaultTimezone,
            onTimezoneSelected = { onUpdateSetting("default_timezone", it) }
        )

        Spacer(modifier = Modifier.height(24.dp))

        // --- Unit System Toggle (imperial / metric) ---
        Text(
            text = "Unit System",
            style = MaterialTheme.typography.labelLarge,
            modifier = Modifier.padding(bottom = 8.dp)
        )
        SingleChoiceSegmentedButtonRow(modifier = Modifier.fillMaxWidth()) {
            val unitOptions = listOf("imperial", "metric")
            unitOptions.forEachIndexed { index, option ->
                SegmentedButton(
                    selected = formState.unitSystem == option,
                    onClick = { onUpdateSetting("unit_system", option) },
                    shape = SegmentedButtonDefaults.itemShape(
                        index = index,
                        count = unitOptions.size
                    )
                ) {
                    Text(option.replaceFirstChar { it.uppercase() })
                }
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        // --- W1: Sex/Gender Toggle ---
        Text(
            text = "Sex",
            style = MaterialTheme.typography.labelLarge,
            modifier = Modifier.padding(bottom = 8.dp)
        )
        SingleChoiceSegmentedButtonRow(modifier = Modifier.fillMaxWidth()) {
            val sexOptions = listOf("male", "female")
            sexOptions.forEachIndexed { index, option ->
                SegmentedButton(
                    selected = formState.sex == option,
                    onClick = { onUpdateSetting("sex", option) },
                    shape = SegmentedButtonDefaults.itemShape(
                        index = index,
                        count = sexOptions.size
                    )
                ) {
                    Text(option.replaceFirstChar { it.uppercase() })
                }
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        // --- W1: Saved Locations Section ---
        Text(
            text = "Saved Locations",
            style = MaterialTheme.typography.titleSmall,
            modifier = Modifier.padding(bottom = 8.dp)
        )
        Text(
            text = "Manage saved locations for quick access in the Location zone.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        // TODO: Add/edit/delete saved locations list

        Spacer(modifier = Modifier.height(24.dp))

        // --- W1: Tags Management Section ---
        Text(
            text = "Tags",
            style = MaterialTheme.typography.titleSmall,
            modifier = Modifier.padding(bottom = 8.dp)
        )
        Text(
            text = "Create, edit, and organize tags. Set colors and favorites.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        // TODO: Tag tree management UI

        Spacer(modifier = Modifier.height(24.dp))

        // --- W1: Habits Configuration ---
        Text(
            text = "Habits",
            style = MaterialTheme.typography.titleSmall,
            modifier = Modifier.padding(bottom = 8.dp)
        )
        Text(
            text = "Default goal, frequency, and success window for habit tracking.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Spacer(modifier = Modifier.height(24.dp))

        // --- W1: Visual Indicators Configuration ---
        Text(
            text = "Visual Indicators",
            style = MaterialTheme.typography.titleSmall,
            modifier = Modifier.padding(bottom = 8.dp)
        )
        Text(
            text = "Define custom indicator types, units, and ranges for health tracking.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Spacer(modifier = Modifier.height(24.dp))

        // --- W1: Clocks / World Clocks ---
        Text(
            text = "World Clocks",
            style = MaterialTheme.typography.titleSmall,
            modifier = Modifier.padding(bottom = 8.dp)
        )
        Text(
            text = "Add timezone clocks for quick reference.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Spacer(modifier = Modifier.height(24.dp))
    }
}

/**
 * Reusable dropdown composable using ExposedDropdownMenuBox.
 * Displays the selected value and a list of options.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SettingsDropdown(
    selectedValue: String,
    options: List<String>,
    onOptionSelected: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    var expanded by remember { mutableStateOf(false) }

    ExposedDropdownMenuBox(
        expanded = expanded,
        onExpandedChange = { expanded = it },
        modifier = modifier.fillMaxWidth()
    ) {
        OutlinedTextField(
            value = selectedValue,
            onValueChange = {},
            readOnly = true,
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
            modifier = Modifier
                .menuAnchor()
                .fillMaxWidth()
        )
        ExposedDropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false }
        ) {
            options.forEach { option ->
                DropdownMenuItem(
                    text = { Text(option) },
                    onClick = {
                        onOptionSelected(option)
                        expanded = false
                    },
                    contentPadding = ExposedDropdownMenuDefaults.ItemContentPadding
                )
            }
        }
    }
}

/**
 * Searchable timezone field with filtered dropdown of common IANA timezones.
 * User can type to filter the list, and select from matching results.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TimezoneSearchField(
    selectedTimezone: String,
    onTimezoneSelected: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    var expanded by remember { mutableStateOf(false) }
    var searchText by remember(selectedTimezone) { mutableStateOf(selectedTimezone) }

    val filteredTimezones = remember(searchText) {
        if (searchText.isBlank()) {
            COMMON_TIMEZONES
        } else {
            COMMON_TIMEZONES.filter {
                it.contains(searchText, ignoreCase = true)
            }
        }
    }

    ExposedDropdownMenuBox(
        expanded = expanded,
        onExpandedChange = { expanded = it },
        modifier = modifier.fillMaxWidth()
    ) {
        OutlinedTextField(
            value = searchText,
            onValueChange = { newText ->
                searchText = newText
                expanded = true
            },
            placeholder = { Text("Search timezones...") },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
            singleLine = true,
            modifier = Modifier
                .menuAnchor()
                .fillMaxWidth()
        )
        if (filteredTimezones.isNotEmpty()) {
            ExposedDropdownMenu(
                expanded = expanded,
                onDismissRequest = { expanded = false }
            ) {
                filteredTimezones.forEach { timezone ->
                    DropdownMenuItem(
                        text = { Text(timezone) },
                        onClick = {
                            searchText = timezone
                            onTimezoneSelected(timezone)
                            expanded = false
                        },
                        contentPadding = ExposedDropdownMenuDefaults.ItemContentPadding
                    )
                }
            }
        }
    }
}
