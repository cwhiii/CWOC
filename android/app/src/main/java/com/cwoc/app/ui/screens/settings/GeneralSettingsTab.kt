package com.cwoc.app.ui.screens.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.outlined.FilterList
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.cwoc.app.ui.screens.settings.components.CollapsibleSection
import com.cwoc.app.ui.screens.settings.components.ContactItem
import com.cwoc.app.ui.screens.settings.components.CustomFilterModal
import com.cwoc.app.ui.screens.settings.components.CustomViewFilter
import com.cwoc.app.ui.screens.settings.components.DragGrid
import com.cwoc.app.ui.screens.settings.components.DragGridOrientation
import com.cwoc.app.ui.screens.settings.components.DragItem
import com.cwoc.app.ui.screens.settings.components.DragZone
import com.cwoc.app.ui.screens.settings.components.ProjectItem
import com.cwoc.app.ui.screens.settings.components.TagItem
import com.cwoc.app.ui.components.ArrangeViewsDialog
import com.cwoc.app.ui.components.CwocZoneButton
import org.json.JSONArray
import org.json.JSONObject
import java.util.TimeZone

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
 * Returns the nearest valid option that is <= the given value.
 * If no valid option is <= the value, returns the first valid option.
 * Valid options must be parseable as integers.
 */
fun nearestValidOption(value: String, validOptions: List<String>): String {
    val intValue = value.toIntOrNull() ?: return validOptions.first()
    val intOptions = validOptions.mapNotNull { it.toIntOrNull() }.sorted()
    if (intOptions.isEmpty()) return validOptions.first()
    // Find the largest valid option <= intValue
    val result = intOptions.lastOrNull { it <= intValue }
    return result?.toString() ?: validOptions.first()
}

/**
 * Valid Calendar Snap interval values (stored as strings).
 * "0" = None, others are minute intervals.
 */
private val CALENDAR_SNAP_OPTIONS = listOf("0", "5", "10", "15", "20", "25", "30", "60")

/**
 * Display label for a Calendar Snap value.
 */
private fun calendarSnapDisplayLabel(value: String): String {
    return if (value == "0") "None" else "$value min"
}

/**
 * General settings tab composable.
 * Fields: time format (12h/24h toggle), week start day dropdown,
 * calendar snap interval dropdown, snooze length dropdown,
 * default timezone (searchable), unit system toggle.
 *
 * Validates: Requirements 2.3, 2.4
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GeneralSettingsTab(
    formState: SettingsFormState,
    onUpdateSetting: (key: String, value: String) -> Unit,
    onResetSortOrders: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .verticalScroll(rememberScrollState())
            .padding(16.dp)
    ) {
        // --- Time Format Dropdown (24 Hour / 12 Hour / HST) ---
        Text(
            text = "Time Format",
            style = MaterialTheme.typography.labelLarge,
            modifier = Modifier.padding(bottom = 8.dp)
        )
        SettingsDropdown(
            selectedValue = when (formState.timeFormat) {
                "24hour" -> "24 Hour"
                "metric" -> "HST"
                else -> "12 Hour"
            },
            options = listOf("24 Hour", "12 Hour", "HST"),
            onOptionSelected = { selected ->
                val value = when (selected) {
                    "24 Hour" -> "24hour"
                    "HST" -> "metric"
                    else -> "12hour"
                }
                onUpdateSetting("time_format", value)
            }
        )

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
        // Apply nearest-valid-option fallback if stored value isn't in the valid set
        val effectiveCalendarSnap = if (formState.calendarSnapInterval in CALENDAR_SNAP_OPTIONS) {
            formState.calendarSnapInterval
        } else {
            nearestValidOption(formState.calendarSnapInterval, CALENDAR_SNAP_OPTIONS)
        }
        // If stored value doesn't match a valid option, update form state to nearest valid
        LaunchedEffect(formState.calendarSnapInterval) {
            if (formState.calendarSnapInterval !in CALENDAR_SNAP_OPTIONS) {
                val resolved = nearestValidOption(formState.calendarSnapInterval, CALENDAR_SNAP_OPTIONS)
                onUpdateSetting("calendar_snap_interval", resolved)
            }
        }
        SettingsDropdown(
            selectedValue = calendarSnapDisplayLabel(effectiveCalendarSnap),
            options = CALENDAR_SNAP_OPTIONS.map { calendarSnapDisplayLabel(it) },
            onOptionSelected = { selected ->
                val value = when (selected) {
                    "None" -> "0"
                    else -> selected.replace(" min", "")
                }
                onUpdateSetting("calendar_snap_interval", value)
            }
        )

        Spacer(modifier = Modifier.height(24.dp))

        // --- Snooze Length Dropdown ---
        Text(
            text = "Snooze Length",
            style = MaterialTheme.typography.labelLarge,
            modifier = Modifier.padding(bottom = 8.dp)
        )
        val snoozeValidOptions = listOf("1", "3", "5", "10")
        // Apply nearest-valid-option fallback if stored value isn't in the valid set
        val effectiveSnooze = if (formState.snoozeLength in snoozeValidOptions) {
            formState.snoozeLength
        } else {
            nearestValidOption(formState.snoozeLength, snoozeValidOptions)
        }
        // If stored value doesn't match a valid option, update form state to nearest valid
        LaunchedEffect(formState.snoozeLength) {
            if (formState.snoozeLength !in snoozeValidOptions) {
                val resolved = nearestValidOption(formState.snoozeLength, snoozeValidOptions)
                onUpdateSetting("snooze_length", resolved)
            }
        }
        SettingsDropdown(
            selectedValue = "$effectiveSnooze min",
            options = listOf("1 min", "3 min", "5 min", "10 min"),
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

        Spacer(modifier = Modifier.height(16.dp))

        // --- Current Override Timezone ---
        Text(
            text = "Current Override",
            style = MaterialTheme.typography.labelLarge,
            modifier = Modifier.padding(bottom = 8.dp)
        )
        TimezoneOverrideField(
            currentOverride = formState.timezoneOverride,
            onOverrideSelected = { onUpdateSetting("timezone_override", it) }
        )
        Text(
            text = "Overrides the auto-detected timezone. Leave empty to use device detection.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(top = 4.dp)
        )
        Spacer(modifier = Modifier.height(8.dp))
        TextButton(
            onClick = { onUpdateSetting("timezone_override", "") },
            colors = ButtonDefaults.textButtonColors(
                contentColor = MaterialTheme.colorScheme.error
            )
        ) {
            Text("✕ Clear Override")
        }

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

        // --- Sex Pill Toggle (♂ Man / ♀ Woman) ---
        Text(
            text = "Sex",
            style = MaterialTheme.typography.labelLarge,
            modifier = Modifier.padding(bottom = 8.dp)
        )
        SingleChoiceSegmentedButtonRow(modifier = Modifier.fillMaxWidth()) {
            val sexOptions = listOf("Man" to "♂ Man", "Woman" to "♀ Woman")
            sexOptions.forEachIndexed { index, (value, label) ->
                SegmentedButton(
                    selected = formState.sex.equals(value, ignoreCase = true),
                    onClick = { onUpdateSetting("sex", value) },
                    shape = SegmentedButtonDefaults.itemShape(
                        index = index,
                        count = sexOptions.size
                    )
                ) {
                    Text(label)
                }
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        // --- Contact Vault Section ---
        CollapsibleSection(
            title = "🏛️ Contact Vault",
            sectionId = "contact_vault"
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 8.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Default share new contacts",
                    style = MaterialTheme.typography.bodyLarge
                )
                Switch(
                    checked = formState.defaultShareContacts == "1",
                    onCheckedChange = { checked ->
                        onUpdateSetting("default_share_contacts", if (checked) "1" else "0")
                    }
                )
            }
            Text(
                text = "When enabled, new contacts will be shared to the vault by default (visible to all users).",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 4.dp)
            )
        }

        Spacer(modifier = Modifier.height(24.dp))

        // --- Display Options Section ---
        // Validates: Requirements 6.4, 6.5
        CollapsibleSection(
            title = "🖥️ Display Options",
            sectionId = "display_options"
        ) {
            // --- Reset All Sort Orders ---
            var showResetSortDialog by remember { mutableStateOf(false) }

            Spacer(modifier = Modifier.height(8.dp))

            Button(
                onClick = { showResetSortDialog = true },
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.error
                ),
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Reset All Sort Orders")
            }
            Text(
                text = "Clears all saved sort preferences and manual item ordering for every view.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 4.dp)
            )

            // Danger confirmation dialog
            if (showResetSortDialog) {
                AlertDialog(
                    onDismissRequest = { showResetSortDialog = false },
                    title = {
                        Text(
                            text = "Reset All Sort Orders",
                            color = MaterialTheme.colorScheme.error
                        )
                    },
                    text = {
                        Text("This will clear all saved sort preferences and manual item ordering for every view. This cannot be undone.")
                    },
                    confirmButton = {
                        Button(
                            onClick = {
                                showResetSortDialog = false
                                onResetSortOrders()
                            },
                            colors = ButtonDefaults.buttonColors(
                                containerColor = MaterialTheme.colorScheme.error
                            )
                        ) {
                            Text("Reset", color = Color.White)
                        }
                    },
                    dismissButton = {
                        TextButton(onClick = { showResetSortDialog = false }) {
                            Text("Cancel")
                        }
                    }
                )
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

        // --- Visual Indicators Configuration ---
        CollapsibleSection(
            title = "Visual Indicators",
            sectionId = "visual_indicators"
        ) {
            // Parse the visual indicators JSON
            val viJson = remember(formState.visualIndicators) {
                try {
                    JSONObject(formState.visualIndicators)
                } catch (e: Exception) {
                    JSONObject().apply {
                        put("alarm", "always")
                        put("notification", "always")
                        put("timer", "always")
                        put("stopwatch", "always")
                        put("combined_alert", "always")
                        put("weather", "always")
                        put("people", "always")
                        put("indicators", "always")
                        put("custom_data", "always")
                        put("combine_alerts", false)
                    }
                }
            }

            val combineAlerts = viJson.optBoolean("combine_alerts", false)

            // Helper to update a single indicator value in the JSON
            fun updateIndicator(key: String, value: String) {
                val updated = JSONObject(formState.visualIndicators)
                updated.put(key, value)
                onUpdateSetting("visual_indicators", updated.toString())
            }

            fun updateCombineAlerts(checked: Boolean) {
                val updated = JSONObject(formState.visualIndicators)
                updated.put("combine_alerts", checked)
                onUpdateSetting("visual_indicators", updated.toString())
            }

            // Combine Alerts checkbox
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Checkbox(
                    checked = combineAlerts,
                    onCheckedChange = { checked -> updateCombineAlerts(checked) }
                )
                Text(
                    text = "Combine Alerts",
                    style = MaterialTheme.typography.bodyLarge
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Individual alert rows (shown when combine_alerts is unchecked)
            if (!combineAlerts) {
                VisualIndicatorRow(
                    icon = "🔔",
                    label = "Alarm",
                    value = viJson.optString("alarm", "always"),
                    onValueChange = { updateIndicator("alarm", it) }
                )
                VisualIndicatorRow(
                    icon = "📢",
                    label = "Notification",
                    value = viJson.optString("notification", "always"),
                    onValueChange = { updateIndicator("notification", it) }
                )
                VisualIndicatorRow(
                    icon = "⏱️",
                    label = "Timer",
                    value = viJson.optString("timer", "always"),
                    onValueChange = { updateIndicator("timer", it) }
                )
                VisualIndicatorRow(
                    icon = "⏲️",
                    label = "Stopwatch",
                    value = viJson.optString("stopwatch", "always"),
                    onValueChange = { updateIndicator("stopwatch", it) }
                )
            }

            // Combined Alerts row (shown when combine_alerts is checked)
            if (combineAlerts) {
                VisualIndicatorRow(
                    icon = "🛎️",
                    label = "Combined Alerts",
                    value = viJson.optString("combined_alert", "always"),
                    onValueChange = { updateIndicator("combined_alert", it) }
                )
            }

            // Always-visible indicator rows
            VisualIndicatorRow(
                icon = "🌤️",
                label = "Weather",
                value = viJson.optString("weather", "always"),
                onValueChange = { updateIndicator("weather", it) }
            )
            VisualIndicatorRow(
                icon = "👥",
                label = "People",
                value = viJson.optString("people", "always"),
                onValueChange = { updateIndicator("people", it) }
            )
            VisualIndicatorRow(
                icon = "❤️",
                label = "Indicators",
                value = viJson.optString("indicators", "always"),
                onValueChange = { updateIndicator("indicators", it) }
            )
            VisualIndicatorRow(
                icon = "📊",
                label = "Custom Data",
                value = viJson.optString("custom_data", "always"),
                onValueChange = { updateIndicator("custom_data", it) }
            )
        }

        Spacer(modifier = Modifier.height(24.dp))

        // --- W1: Clocks / World Clocks ---
        Text(
            text = "Clocks",
            style = MaterialTheme.typography.titleSmall,
            modifier = Modifier.padding(bottom = 8.dp)
        )

        // --- Orientation Toggle ---
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Orientation",
                style = MaterialTheme.typography.labelLarge
            )
            Spacer(modifier = Modifier.weight(1f))
            OutlinedButton(
                onClick = {
                    val newOrientation = if (formState.clockOrientation == "horizontal") "vertical" else "horizontal"
                    onUpdateSetting("clock_orientation", newOrientation)
                }
            ) {
                Text(
                    text = if (formState.clockOrientation == "horizontal") "Horizontal" else "Vertical"
                )
            }
        }

        // --- Active/Inactive Clocks DragGrid ---
        val allClockTypes = listOf("24 Hour", "HST", "12 Hour", "12 Hour Analog")

        // Parse active clocks from JSON array
        val activeClocksFromState = remember(formState.activeClocks) {
            try {
                val jsonArray = JSONArray(formState.activeClocks)
                (0 until jsonArray.length()).map { jsonArray.getString(it) }
            } catch (e: Exception) {
                emptyList()
            }
        }

        // Build DragItem list: active clocks in order, then inactive ones
        val dragItems = remember(activeClocksFromState) {
            val activeItems = activeClocksFromState.map { clockType ->
                DragItem(id = clockType, label = clockType, zone = DragZone.ACTIVE)
            }
            val inactiveItems = allClockTypes
                .filter { it !in activeClocksFromState }
                .map { clockType ->
                    DragItem(id = clockType, label = clockType, zone = DragZone.INACTIVE)
                }
            activeItems + inactiveItems
        }

        // Determine orientation for DragGrid
        val gridOrientation = if (formState.clockOrientation == "vertical") {
            DragGridOrientation.VERTICAL
        } else {
            DragGridOrientation.HORIZONTAL
        }

        // Show "Add Clock" button when Active zone is empty
        if (activeClocksFromState.isEmpty()) {
            Button(
                onClick = {
                    // Move the first available inactive clock to active
                    val firstInactive = allClockTypes.firstOrNull { it !in activeClocksFromState }
                    if (firstInactive != null) {
                        val newActive = JSONArray()
                        newActive.put(firstInactive)
                        onUpdateSetting("active_clocks", newActive.toString())
                    }
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 12.dp)
            ) {
                Text("Add Clock")
            }
        }

        DragGrid(
            items = dragItems,
            onReorder = { newItems ->
                // Extract active items in their new order
                val newActiveClocks = newItems
                    .filter { it.zone == DragZone.ACTIVE }
                    .map { it.id }
                val newJsonArray = JSONArray()
                newActiveClocks.forEach { newJsonArray.put(it) }
                onUpdateSetting("active_clocks", newJsonArray.toString())
            },
            columns = 2,
            orientation = gridOrientation
        )

        Spacer(modifier = Modifier.height(24.dp))

        // --- Display Options Section ---
        CollapsibleSection(
            title = "Display Options",
            sectionId = "display_options_views"
        ) {
            // Landing View dropdown
            Text(
                text = "Landing View",
                style = MaterialTheme.typography.labelLarge,
                modifier = Modifier.padding(bottom = 8.dp)
            )
            SettingsDropdown(
                selectedValue = formState.landingView,
                options = listOf(
                    "Omni",
                    "Calendar",
                    "Checklists",
                    "Alerts",
                    "Projects",
                    "Tasks",
                    "Notes",
                    "Email",
                    "Indicators"
                ),
                onOptionSelected = { selected ->
                    onUpdateSetting("landing_view", selected)
                }
            )
            Text(
                text = "Applies only on fresh app open, not when returning from the editor or other pages.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 4.dp)
            )

            Spacer(modifier = Modifier.height(16.dp))

            // --- Arrange Views Button ---
            var showArrangeViewsDialog by remember { mutableStateOf(false) }

            Text(
                text = "View Order",
                style = MaterialTheme.typography.labelLarge,
                modifier = Modifier.padding(bottom = 8.dp)
            )
            CwocZoneButton(
                onClick = { showArrangeViewsDialog = true }
            ) {
                Text("Arrange Views")
            }
            Text(
                text = "Reorder or hide dashboard tabs. Omni is always first.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 4.dp)
            )

            // Arrange Views Dialog
            if (showArrangeViewsDialog) {
                ArrangeViewsDialog(
                    currentViewOrder = formState.viewOrder,
                    onSave = { newOrder ->
                        onUpdateSetting("view_order", newOrder)
                    },
                    onDismiss = { showArrangeViewsDialog = false }
                )
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        // --- Chit Options Section ---
        CollapsibleSection(
            title = "Chit Options",
            sectionId = "chit_options"
        ) {
            // Parse the chit_options JSON to get individual checkbox states
            val chitOptionsJson = remember(formState.chitOptions) {
                try {
                    JSONObject(formState.chitOptions)
                } catch (e: Exception) {
                    // Default JSON with correct defaults
                    JSONObject().apply {
                        put("checklist_autosave", false)
                        put("auto_save_desktop", false)
                        put("auto_save_mobile", false)
                        put("fade_past_chits", true)
                        put("highlight_overdue_chits", true)
                        put("highlight_blocked_chits", true)
                        put("delete_past_alarm_chits", false)
                        put("show_tab_counts", false)
                        put("prefer_google_maps", false)
                        put("show_map_thumbnails", false)
                        put("hide_declined", false)
                    }
                }
            }

            // Define the 11 checkboxes in exact order with their JSON keys and labels
            val chitCheckboxes = listOf(
                "checklist_autosave" to "Checklist Auto-Save",
                "auto_save_desktop" to "Auto-save on Desktop",
                "auto_save_mobile" to "Auto-save on Mobile",
                "fade_past_chits" to "Fade Past Chits",
                "highlight_overdue_chits" to "Highlight Overdue",
                "highlight_blocked_chits" to "Highlight Blocked",
                "delete_past_alarm_chits" to "Delete Past Alarms",
                "show_tab_counts" to "Show Tab Counts",
                "prefer_google_maps" to "Prefer Google for Maps",
                "show_map_thumbnails" to "Show Map Thumbnails",
                "hide_declined" to "Hide declined chits"
            )

            chitCheckboxes.forEach { (key, label) ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Checkbox(
                        checked = chitOptionsJson.optBoolean(key, when (key) {
                            "fade_past_chits", "highlight_overdue_chits", "highlight_blocked_chits" -> true
                            else -> false
                        }),
                        onCheckedChange = { checked ->
                            // Rebuild the JSON with the updated value
                            val updatedJson = try {
                                JSONObject(formState.chitOptions)
                            } catch (e: Exception) {
                                JSONObject()
                            }
                            updatedJson.put(key, checked)
                            onUpdateSetting("chit_options", updatedJson.toString())
                        }
                    )
                    Text(
                        text = label,
                        style = MaterialTheme.typography.bodyLarge,
                        modifier = Modifier.padding(start = 8.dp)
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        // --- Custom Filters & Sorting Section ---
        CustomFiltersSection(
            formState = formState,
            onUpdateSetting = onUpdateSetting
        )

        Spacer(modifier = Modifier.height(24.dp))
    }
}

/**
 * Custom Filters & Sorting section.
 * Shows a button for each of 9 views. Each button opens the CustomFilterModal for that view.
 * Displays a status indicator: "Custom ✓" when a filter is saved, "Default" when not.
 *
 * Validates: Requirements 9.1, 9.5, 9.6
 */
@Composable
private fun CustomFiltersSection(
    formState: SettingsFormState,
    onUpdateSetting: (key: String, value: String) -> Unit
) {
    // The 9 views that can have custom filters
    val viewNames = listOf(
        "Omni", "Calendar", "Checklists", "Tasks", "Projects",
        "Notes", "Email", "Indicators", "Alarms"
    )

    // Track which view's modal is currently open (null = none)
    var activeModalView by remember { mutableStateOf<String?>(null) }

    // Parse the customViewFilters JSON to determine which views have custom filters
    val filtersJson = remember(formState.customViewFilters) {
        try {
            JSONObject(formState.customViewFilters)
        } catch (e: Exception) {
            JSONObject()
        }
    }

    // Parse available tags from formState.sharedTags for the filter modal
    val availableTags = remember(formState.sharedTags) {
        try {
            val arr = JSONArray(formState.sharedTags)
            (0 until arr.length()).mapNotNull { i ->
                val obj = arr.optJSONObject(i)
                val name = obj?.optString("name")?.takeIf { it.isNotBlank() } ?: return@mapNotNull null
                TagItem(id = name, name = name)
            }
        } catch (_: Exception) { emptyList() }
    }

    CollapsibleSection(
        title = "Custom Filters & Sorting",
        sectionId = "custom_filters"
    ) {
        Column(modifier = Modifier.fillMaxWidth()) {
            viewNames.forEach { viewName ->
                val hasCustomFilter = filtersJson.has(viewName) && filtersJson.optJSONObject(viewName) != null

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 6.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // View name and status indicator
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.weight(1f)
                    ) {
                        Text(
                            text = viewName,
                            style = MaterialTheme.typography.bodyLarge
                        )
                        Spacer(modifier = Modifier.padding(start = 8.dp))
                        if (hasCustomFilter) {
                            Icon(
                                imageVector = Icons.Default.Check,
                                contentDescription = "Custom filter active",
                                modifier = Modifier.size(16.dp),
                                tint = MaterialTheme.colorScheme.primary
                            )
                            Text(
                                text = "Custom",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.padding(start = 4.dp)
                            )
                        } else {
                            Icon(
                                imageVector = Icons.Outlined.FilterList,
                                contentDescription = "Default filter",
                                modifier = Modifier.size(16.dp),
                                tint = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Text(
                                text = "Default",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.padding(start = 4.dp)
                            )
                        }
                    }

                    // Configure button
                    OutlinedButton(
                        onClick = { activeModalView = viewName }
                    ) {
                        Text("Configure")
                    }
                }
            }
        }
    }

    // Show CustomFilterModal when a view is selected
    activeModalView?.let { viewName ->
        // Parse the current filter for this view from the JSON
        val currentFilter = remember(formState.customViewFilters, viewName) {
            try {
                val json = JSONObject(formState.customViewFilters)
                val viewJson = json.optJSONObject(viewName)
                if (viewJson != null) {
                    CustomViewFilter(
                        filterText = viewJson.optString("filterText", ""),
                        sortField = viewJson.optString("sortField", "").ifEmpty { null },
                        sortDirection = viewJson.optString("sortDirection", "asc"),
                        statuses = viewJson.optJSONArray("statuses")?.let { arr ->
                            (0 until arr.length()).map { arr.getString(it) }
                        } ?: emptyList(),
                        priorities = viewJson.optJSONArray("priorities")?.let { arr ->
                            (0 until arr.length()).map { arr.getString(it) }
                        } ?: emptyList(),
                        tags = viewJson.optJSONArray("tags")?.let { arr ->
                            (0 until arr.length()).map { arr.getString(it) }
                        } ?: emptyList(),
                        people = viewJson.optJSONArray("people")?.let { arr ->
                            (0 until arr.length()).map { arr.getString(it) }
                        } ?: emptyList(),
                        project = viewJson.optString("project", "").ifEmpty { null },
                        displayToggles = viewJson.optJSONObject("displayToggles")?.let { obj ->
                            val map = mutableMapOf<String, Boolean>()
                            obj.keys().forEach { key -> map[key] = obj.optBoolean(key, false) }
                            map
                        } ?: emptyMap()
                    )
                } else {
                    null
                }
            } catch (e: Exception) {
                null
            }
        }

        CustomFilterModal(
            viewName = viewName,
            currentFilter = currentFilter,
            availableTags = availableTags,
            availableContacts = emptyList(),
            availableProjects = emptyList(),
            onDone = { filter ->
                // Update the customViewFilters JSON
                val updatedJson = try {
                    JSONObject(formState.customViewFilters)
                } catch (e: Exception) {
                    JSONObject()
                }

                if (filter != null) {
                    // Store the filter for this view
                    val filterJson = JSONObject().apply {
                        put("filterText", filter.filterText)
                        put("sortField", filter.sortField ?: "")
                        put("sortDirection", filter.sortDirection)
                        put("statuses", JSONArray(filter.statuses))
                        put("priorities", JSONArray(filter.priorities))
                        put("tags", JSONArray(filter.tags))
                        put("people", JSONArray(filter.people))
                        put("project", filter.project ?: "")
                        put("displayToggles", JSONObject(filter.displayToggles))
                    }
                    updatedJson.put(viewName, filterJson)
                } else {
                    // Reset to defaults — remove this view's key
                    updatedJson.remove(viewName)
                }

                onUpdateSetting("custom_view_filters", updatedJson.toString())
                activeModalView = null
            },
            onCancel = {
                activeModalView = null
            }
        )
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

/**
 * Searchable timezone override field with autocomplete from the full IANA timezone list.
 * Uses java.util.TimeZone.getAvailableIDs() for comprehensive timezone suggestions.
 * Allows empty value (meaning no override).
 *
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TimezoneOverrideField(
    currentOverride: String,
    onOverrideSelected: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    var expanded by remember { mutableStateOf(false) }
    var searchText by remember(currentOverride) { mutableStateOf(currentOverride) }

    // Full IANA timezone list from java.util.TimeZone
    val allTimezones = remember {
        TimeZone.getAvailableIDs().sorted()
    }

    // Validate: non-empty value must be a valid IANA timezone (Requirement 5.4)
    val allTimezonesSet = remember { TimeZone.getAvailableIDs().toSet() }
    val isInvalidTimezone = searchText.isNotBlank() && searchText !in allTimezonesSet

    val filteredTimezones = remember(searchText) {
        if (searchText.isBlank()) {
            // Show common timezones when field is empty
            COMMON_TIMEZONES
        } else {
            allTimezones.filter {
                it.contains(searchText, ignoreCase = true)
            }.take(20) // Limit suggestions for performance
        }
    }

    Column(modifier = modifier.fillMaxWidth()) {
        ExposedDropdownMenuBox(
            expanded = expanded,
            onExpandedChange = { expanded = it },
            modifier = Modifier.fillMaxWidth()
        ) {
            OutlinedTextField(
                value = searchText,
                onValueChange = { newText ->
                    searchText = newText
                    expanded = true
                    // Update the setting as the user types (allows clearing)
                    onOverrideSelected(newText)
                },
                placeholder = { Text("e.g. America/New_York") },
                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
                singleLine = true,
                isError = isInvalidTimezone,
                modifier = Modifier
                    .menuAnchor()
                    .fillMaxWidth()
            )
            if (filteredTimezones.isNotEmpty() && searchText.isNotBlank()) {
                ExposedDropdownMenu(
                    expanded = expanded,
                    onDismissRequest = { expanded = false }
                ) {
                    filteredTimezones.forEach { timezone ->
                        DropdownMenuItem(
                            text = { Text(timezone) },
                            onClick = {
                                searchText = timezone
                                onOverrideSelected(timezone)
                                expanded = false
                            },
                            contentPadding = ExposedDropdownMenuDefaults.ItemContentPadding
                        )
                    }
                }
            }
        }

        // Inline error hint when timezone is invalid
        if (isInvalidTimezone) {
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = "Not a recognized timezone — will prevent save",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.error
            )
        }
    }
}

/**
 * A single visual indicator row with icon, label, and a three-option selector
 * (Always / Never / If Space).
 *
 * Validates: Requirements 8.1, 8.2
 */
@Composable
private fun VisualIndicatorRow(
    icon: String,
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = "$icon $label",
            style = MaterialTheme.typography.bodyLarge,
            modifier = Modifier.weight(1f)
        )
        SingleChoiceSegmentedButtonRow {
            val options = listOf("always" to "Always", "never" to "Never", "space" to "If Space")
            options.forEachIndexed { index, (optValue, optLabel) ->
                SegmentedButton(
                    selected = value == optValue,
                    onClick = { onValueChange(optValue) },
                    shape = SegmentedButtonDefaults.itemShape(
                        index = index,
                        count = options.size
                    )
                ) {
                    Text(
                        text = optLabel,
                        style = MaterialTheme.typography.labelSmall
                    )
                }
            }
        }
    }
}
