package com.cwoc.app.ui.screens.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.Reorder
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.cwoc.app.data.remote.BundleDto
import com.cwoc.app.ui.components.ArrangeViewsDialog
import com.cwoc.app.ui.components.CwocZoneButton
import com.cwoc.app.ui.screens.settings.components.CollapsibleSection
import com.cwoc.app.ui.screens.settings.components.OmniLayout
import com.cwoc.app.ui.screens.settings.components.OmniLayoutModal
import com.cwoc.app.ui.screens.settings.components.getDefaultOmniLayout
import org.json.JSONArray
import org.json.JSONObject

/**
 * Views settings tab composable.
 * Sections: Omni View, Default View, Enabled Periods, View Order.
 *
 * Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9, 10.10, 10.11
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ViewsSettingsTab(
    settingsState: SettingsFormState,
    onUpdateSetting: (key: String, value: String) -> Unit,
    bundles: List<BundleDto> = emptyList()
) {
    val scrollState = rememberScrollState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(scrollState)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(24.dp)
    ) {
        // --- Omni View Section ---
        OmniViewSection(
            settingsState = settingsState,
            onUpdateSetting = onUpdateSetting,
            bundles = bundles
        )

        HorizontalDivider()

        // --- Default View Dropdown ---
        DefaultViewDropdown(
            selectedView = settingsState.defaultView,
            onViewSelected = { onUpdateSetting("default_view", it) }
        )

        HorizontalDivider()

        // --- Enabled Periods Checkboxes ---
        EnabledPeriodsSection(
            enabledPeriods = settingsState.enabledPeriods,
            onPeriodsChanged = { onUpdateSetting("enabled_periods", it) }
        )

        HorizontalDivider()

        // --- View Order with Arrange Views Button ---
        ViewOrderSection(
            viewOrder = settingsState.viewOrder,
            onViewOrderChanged = { onUpdateSetting("view_order", it) }
        )

        HorizontalDivider()

        // --- Calendar Section ---
        // Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8
        CalendarSection(
            settingsState = settingsState,
            onUpdateSetting = onUpdateSetting
        )

        HorizontalDivider()

        // --- Habits Section ---
        // Validates: Requirements 12.1, 12.2, 12.3, 12.4
        HabitsSection(
            habitsSuccessWindow = settingsState.habitsSuccessWindow,
            defaultShowHabitsOnCalendar = settingsState.defaultShowHabitsOnCalendar,
            onUpdateSetting = onUpdateSetting
        )

        HorizontalDivider()

        // --- Projects Section ---
        // Validates: Requirements 13.1, 13.2, 13.3, 13.4
        ProjectsSection(
            projectsShowChildCount = settingsState.projectsShowChildCount,
            projectsShowChecklistCount = settingsState.projectsShowChecklistCount,
            onUpdateSetting = onUpdateSetting
        )

        HorizontalDivider()

        // --- Maps Section ---
        // Validates: Requirements 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7
        MapsSection(
            mapAutoZoom = settingsState.mapAutoZoom,
            mapDefaultLat = settingsState.mapDefaultLat,
            mapDefaultLon = settingsState.mapDefaultLon,
            mapDefaultZoom = settingsState.mapDefaultZoom,
            onUpdateSetting = onUpdateSetting
        )
    }
}


// ============================================================
// Omni View Section
// ============================================================

/**
 * Omni View configuration section with:
 * - HST Bar Clock selector
 * - Arrange Omni Layout button
 * - Bundle Omni View Toggles checkbox list
 * - Emails to show dropdown
 * - Color mode selector
 * - Locked Filter Defaults summary with Clear button
 * - Reset Omni View to Defaults button
 *
 * Validates: Requirements 10.1–10.11
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun OmniViewSection(
    settingsState: SettingsFormState,
    onUpdateSetting: (key: String, value: String) -> Unit,
    bundles: List<BundleDto>
) {
    var showLayoutModal by remember { mutableStateOf(false) }
    var showResetConfirmDialog by remember { mutableStateOf(false) }

    CollapsibleSection(
        title = "\uD83D\uDD2E Omni View",
        sectionId = "omni_view"
    ) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // --- HST Bar Clock selector ---
            HstBarClockSelector(
                selectedMode = settingsState.omniHstClockMode,
                onModeSelected = { onUpdateSetting("omni_hst_clock_mode", it) }
            )

            // --- Arrange Omni Layout button ---
            CwocZoneButton(onClick = { showLayoutModal = true }) {
                Icon(
                    imageVector = Icons.Default.Reorder,
                    contentDescription = null,
                    modifier = Modifier.padding(end = 4.dp)
                )
                Text("Arrange Omni Layout")
            }

            // --- Bundle Omni View Toggles ---
            BundleOmniToggles(
                bundles = bundles,
                togglesJson = settingsState.omniBundleToggles,
                onTogglesChanged = { onUpdateSetting("omni_bundle_toggles", it) }
            )

            // --- Emails to show dropdown ---
            EmailsToShowDropdown(
                selectedCount = settingsState.omniEmailCount,
                onCountSelected = { onUpdateSetting("omni_email_count", it) }
            )

            // --- Color mode selector ---
            ColorModeSelector(
                selectedMode = settingsState.omniNormalizeColors,
                onModeSelected = { onUpdateSetting("omni_normalize_colors", it) }
            )

            // --- Locked Filter Defaults ---
            LockedFilterDefaults(
                lockedFiltersJson = settingsState.omniLockedFilters,
                onClearDefaults = { onUpdateSetting("omni_locked_filters", "[]") }
            )

            // --- Reset Omni View to Defaults ---
            OutlinedButton(
                onClick = { showResetConfirmDialog = true },
                colors = ButtonDefaults.outlinedButtonColors(
                    contentColor = Color(0xFFB71C1C)
                )
            ) {
                Text("Reset Omni View to Defaults")
            }
        }
    }

    // --- OmniLayoutModal ---
    if (showLayoutModal) {
        val currentLayout = remember(settingsState.omniLayout) {
            parseOmniLayout(settingsState.omniLayout)
        }
        OmniLayoutModal(
            currentLayout = currentLayout,
            onDone = { newLayout ->
                onUpdateSetting("omni_layout", serializeOmniLayout(newLayout))
                showLayoutModal = false
            },
            onCancel = { showLayoutModal = false }
        )
    }

    // --- Reset Confirmation Dialog ---
    if (showResetConfirmDialog) {
        AlertDialog(
            onDismissRequest = { showResetConfirmDialog = false },
            title = { Text("Reset Omni View?") },
            text = {
                Text("This will restore all Omni View settings (layout, color mode, HST clock mode, bundle toggles, emails-to-show count, and locked filters) to their default values.")
            },
            confirmButton = {
                TextButton(onClick = {
                    showResetConfirmDialog = false
                    onUpdateSetting("omni_hst_clock_mode", "both")
                    onUpdateSetting("omni_layout", serializeOmniLayout(getDefaultOmniLayout()))
                    onUpdateSetting("omni_bundle_toggles", "{}")
                    onUpdateSetting("omni_email_count", "3")
                    onUpdateSetting("omni_normalize_colors", "colored")
                    onUpdateSetting("omni_locked_filters", "[]")
                }) {
                    Text("Reset", color = Color(0xFFB71C1C))
                }
            },
            dismissButton = {
                TextButton(onClick = { showResetConfirmDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }
}

/**
 * HST Bar Clock selector with 3 options.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun HstBarClockSelector(
    selectedMode: String,
    onModeSelected: (String) -> Unit
) {
    val options = listOf(
        "both" to "Both (System + HST)",
        "hst" to "HST Only",
        "system" to "System Time Only"
    )
    val selectedIndex = options.indexOfFirst { it.first == selectedMode }.coerceAtLeast(0)

    Column {
        Text(
            text = "HST Bar Clock",
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.SemiBold
        )
        Spacer(modifier = Modifier.height(8.dp))
        SingleChoiceSegmentedButtonRow(modifier = Modifier.fillMaxWidth()) {
            options.forEachIndexed { index, (value, label) ->
                SegmentedButton(
                    selected = index == selectedIndex,
                    onClick = { onModeSelected(value) },
                    shape = SegmentedButtonDefaults.itemShape(
                        index = index,
                        count = options.size
                    )
                ) {
                    Text(label, maxLines = 1)
                }
            }
        }
    }
}

/**
 * Bundle Omni View Toggles: checkbox list populated from server bundles.
 */
@Composable
private fun BundleOmniToggles(
    bundles: List<BundleDto>,
    togglesJson: String,
    onTogglesChanged: (String) -> Unit
) {
    val toggles = remember(togglesJson) {
        try {
            val obj = JSONObject(togglesJson)
            val map = mutableMapOf<String, Boolean>()
            obj.keys().forEach { key ->
                map[key] = obj.optBoolean(key, true)
            }
            map
        } catch (_: Exception) {
            mutableMapOf()
        }
    }

    Column {
        Text(
            text = "Bundle Omni View Toggles",
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.SemiBold
        )
        Spacer(modifier = Modifier.height(4.dp))

        if (bundles.isEmpty()) {
            Text(
                text = "No email bundles configured.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        } else {
            bundles.forEach { bundle ->
                val bundleId = bundle.id
                val bundleName = bundle.name ?: bundleId
                val isChecked = toggles[bundleId] ?: true

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Checkbox(
                        checked = isChecked,
                        onCheckedChange = { checked ->
                            val newToggles = toggles.toMutableMap()
                            newToggles[bundleId] = checked
                            val jsonObj = JSONObject()
                            newToggles.forEach { (k, v) -> jsonObj.put(k, v) }
                            onTogglesChanged(jsonObj.toString())
                        }
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = bundleName,
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
            }
        }
    }
}

/**
 * Emails to show dropdown: 3, 5, 10, 15, 20.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun EmailsToShowDropdown(
    selectedCount: String,
    onCountSelected: (String) -> Unit
) {
    val options = listOf("3", "5", "10", "15", "20")
    var expanded by remember { mutableStateOf(false) }

    Column {
        Text(
            text = "Emails to show",
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.SemiBold
        )
        Spacer(modifier = Modifier.height(8.dp))

        ExposedDropdownMenuBox(
            expanded = expanded,
            onExpandedChange = { expanded = !expanded }
        ) {
            OutlinedTextField(
                value = selectedCount,
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
                            onCountSelected(option)
                            expanded = false
                        }
                    )
                }
            }
        }
    }
}

/**
 * Color mode selector: Colored, Normalized, Mono.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ColorModeSelector(
    selectedMode: String,
    onModeSelected: (String) -> Unit
) {
    val options = listOf(
        "colored" to "Colored",
        "normalized" to "Normalized",
        "mono" to "Mono"
    )
    val selectedIndex = options.indexOfFirst { it.first == selectedMode }.coerceAtLeast(0)

    Column {
        Text(
            text = "Color mode",
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.SemiBold
        )
        Spacer(modifier = Modifier.height(8.dp))
        SingleChoiceSegmentedButtonRow(modifier = Modifier.fillMaxWidth()) {
            options.forEachIndexed { index, (value, label) ->
                SegmentedButton(
                    selected = index == selectedIndex,
                    onClick = { onModeSelected(value) },
                    shape = SegmentedButtonDefaults.itemShape(
                        index = index,
                        count = options.size
                    )
                ) {
                    Text(label)
                }
            }
        }
    }
}

/**
 * Locked Filter Defaults: displays a text summary or "None", with Clear button.
 */
@Composable
private fun LockedFilterDefaults(
    lockedFiltersJson: String,
    onClearDefaults: () -> Unit
) {
    val filterNames = remember(lockedFiltersJson) {
        try {
            val arr = JSONArray(lockedFiltersJson)
            val names = mutableListOf<String>()
            for (i in 0 until arr.length()) {
                val item = arr.optString(i, "")
                if (item.isNotEmpty()) names.add(item)
            }
            names
        } catch (_: Exception) {
            emptyList()
        }
    }

    val hasFilters = filterNames.isNotEmpty()
    val summaryText = if (hasFilters) filterNames.joinToString(", ") else "None"

    Column {
        Text(
            text = "Locked Filter Defaults",
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.SemiBold
        )
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = summaryText,
            style = MaterialTheme.typography.bodySmall,
            color = if (hasFilters) MaterialTheme.colorScheme.onSurface
            else MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(modifier = Modifier.height(8.dp))
        OutlinedButton(
            onClick = onClearDefaults,
            enabled = hasFilters
        ) {
            Text("Clear Defaults")
        }
    }
}

// ============================================================
// Helper functions for OmniLayout serialization
// ============================================================

private fun parseOmniLayout(json: String): OmniLayout {
    return try {
        val obj = JSONObject(json)
        OmniLayout(
            fullWidth = jsonArrayToStringList(obj.optJSONArray("fullWidth")),
            leftColumn = jsonArrayToStringList(obj.optJSONArray("leftColumn")),
            rightColumn = jsonArrayToStringList(obj.optJSONArray("rightColumn")),
            unused = jsonArrayToStringList(obj.optJSONArray("unused"))
        )
    } catch (_: Exception) {
        getDefaultOmniLayout()
    }
}

private fun serializeOmniLayout(layout: OmniLayout): String {
    val obj = JSONObject()
    obj.put("fullWidth", JSONArray(layout.fullWidth))
    obj.put("leftColumn", JSONArray(layout.leftColumn))
    obj.put("rightColumn", JSONArray(layout.rightColumn))
    obj.put("unused", JSONArray(layout.unused))
    return obj.toString()
}

private fun jsonArrayToStringList(arr: JSONArray?): List<String> {
    if (arr == null) return emptyList()
    val list = mutableListOf<String>()
    for (i in 0 until arr.length()) {
        list.add(arr.optString(i, ""))
    }
    return list.filter { it.isNotEmpty() }
}


// ============================================================
// Existing sections (Default View, Enabled Periods, View Order)
// ============================================================

/**
 * Dropdown for selecting the default C CAPTN view.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DefaultViewDropdown(
    selectedView: String,
    onViewSelected: (String) -> Unit
) {
    val viewOptions = listOf("Calendar", "Checklists", "Alarms", "Projects", "Tasks", "Notes")
    var expanded by remember { mutableStateOf(false) }

    Column {
        Text(
            text = "Default View",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "The view that opens when you launch the app",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(modifier = Modifier.height(8.dp))

        ExposedDropdownMenuBox(
            expanded = expanded,
            onExpandedChange = { expanded = !expanded }
        ) {
            OutlinedTextField(
                value = selectedView,
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
                viewOptions.forEach { option ->
                    DropdownMenuItem(
                        text = { Text(option) },
                        onClick = {
                            onViewSelected(option)
                            expanded = false
                        }
                    )
                }
            }
        }
    }
}

/**
 * Checkboxes for enabling/disabling calendar period views.
 */
@Composable
private fun EnabledPeriodsSection(
    enabledPeriods: String,
    onPeriodsChanged: (String) -> Unit
) {
    val allPeriods = listOf("Day", "Week", "Month", "Year", "Itinerary", "X-Day")
    val enabledSet = remember(enabledPeriods) {
        enabledPeriods.split(",").map { it.trim() }.filter { it.isNotEmpty() }.toSet()
    }

    Column {
        Text(
            text = "Enabled Periods",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "Choose which calendar period views are available",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(modifier = Modifier.height(8.dp))

        allPeriods.forEach { period ->
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth()
            ) {
                Checkbox(
                    checked = period in enabledSet,
                    onCheckedChange = { checked ->
                        val newSet = if (checked) {
                            enabledSet + period
                        } else {
                            enabledSet - period
                        }
                        // Preserve the order from allPeriods
                        val ordered = allPeriods.filter { it in newSet }
                        onPeriodsChanged(ordered.joinToString(","))
                    }
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = period,
                    style = MaterialTheme.typography.bodyLarge
                )
            }
        }
    }
}

/**
 * Reorderable list of C CAPTN views with up/down buttons and an "Arrange Views" button
 * that opens the full ArrangeViewsDialog bottom sheet.
 * View order is stored as a comma-separated string or JSON array.
 */
@Composable
private fun ViewOrderSection(
    viewOrder: String,
    onViewOrderChanged: (String) -> Unit
) {
    val views = remember(viewOrder) {
        viewOrder.split(",").map { it.trim() }.filter { it.isNotEmpty() }
    }
    var showArrangeDialog by remember { mutableStateOf(false) }

    Column {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Column {
                Text(
                    text = "View Order",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Arrange the order of C CAPTN view tabs",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            CwocZoneButton(onClick = { showArrangeDialog = true }) {
                Icon(
                    imageVector = Icons.Default.Reorder,
                    contentDescription = null,
                    modifier = Modifier.padding(end = 4.dp)
                )
                Text("Arrange Views")
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        views.forEachIndexed { index, view ->
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 4.dp)
            ) {
                Text(
                    text = view,
                    style = MaterialTheme.typography.bodyLarge,
                    modifier = Modifier.weight(1f)
                )

                // Move up button (disabled for first item)
                IconButton(
                    onClick = {
                        if (index > 0) {
                            val mutableList = views.toMutableList()
                            val item = mutableList.removeAt(index)
                            mutableList.add(index - 1, item)
                            onViewOrderChanged(mutableList.joinToString(","))
                        }
                    },
                    enabled = index > 0
                ) {
                    Icon(
                        imageVector = Icons.Default.KeyboardArrowUp,
                        contentDescription = "Move $view up"
                    )
                }

                // Move down button (disabled for last item)
                IconButton(
                    onClick = {
                        if (index < views.size - 1) {
                            val mutableList = views.toMutableList()
                            val item = mutableList.removeAt(index)
                            mutableList.add(index + 1, item)
                            onViewOrderChanged(mutableList.joinToString(","))
                        }
                    },
                    enabled = index < views.size - 1
                ) {
                    Icon(
                        imageVector = Icons.Default.KeyboardArrowDown,
                        contentDescription = "Move $view down"
                    )
                }
            }

            if (index < views.size - 1) {
                HorizontalDivider(
                    modifier = Modifier.padding(start = 16.dp),
                    color = MaterialTheme.colorScheme.outlineVariant
                )
            }
        }
    }

    // Arrange Views Dialog
    if (showArrangeDialog) {
        ArrangeViewsDialog(
            currentViewOrder = viewOrder,
            onSave = { newOrder -> onViewOrderChanged(newOrder) },
            onDismiss = { showArrangeDialog = false }
        )
    }
}


// ============================================================
// Calendar Section
// Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8
// ============================================================

/**
 * Calendar configuration section.
 * Includes: Week Starts On, View Hours (start/end with validation),
 * Scroll to hour, X Days Count (conditional), Work Hours with day checkboxes
 * and work hour start/end (with validation).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CalendarSection(
    settingsState: SettingsFormState,
    onUpdateSetting: (key: String, value: String) -> Unit
) {
    // Check if X Days period is enabled
    val enabledPeriodsSet = remember(settingsState.enabledPeriods) {
        settingsState.enabledPeriods.split(",").map { it.trim() }.filter { it.isNotEmpty() }.toSet()
    }
    val xDaysEnabled = "X-Day" in enabledPeriodsSet || "SevenDay" in enabledPeriodsSet

    // Validation states
    val viewHoursStartInt = settingsState.allViewStartHour.toIntOrNull() ?: 0
    val viewHoursEndInt = settingsState.allViewEndHour.toIntOrNull() ?: 23
    val viewHoursError = viewHoursStartInt >= viewHoursEndInt

    val workHoursEnabled = settingsState.workHoursEnabled == "1"
    val workStartInt = settingsState.workStartHour.toIntOrNull() ?: 9
    val workEndInt = settingsState.workEndHour.toIntOrNull() ?: 17
    val workHoursError = workHoursEnabled && workStartInt >= workEndInt

    CollapsibleSection(
        title = "\uD83D\uDCC5 Calendar",
        sectionId = "calendar"
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
            // --- Week Starts On dropdown ---
            WeekStartDayDropdown(
                selectedDay = settingsState.weekStartDay,
                onDaySelected = { onUpdateSetting("week_start_day", it) }
            )

            // --- View Hours start/end dropdowns ---
            ViewHoursSection(
                startHour = settingsState.allViewStartHour,
                endHour = settingsState.allViewEndHour,
                hasError = viewHoursError,
                onStartHourChanged = { onUpdateSetting("all_view_start_hour", it) },
                onEndHourChanged = { onUpdateSetting("all_view_end_hour", it) }
            )

            // --- Scroll to hour dropdown ---
            ScrollToHourDropdown(
                selectedHour = settingsState.dayScrollToHour,
                onHourSelected = { onUpdateSetting("day_scroll_to_hour", it) }
            )

            // --- X Days Count (shown only when X Days period enabled) ---
            if (xDaysEnabled) {
                XDaysCountInput(
                    currentCount = settingsState.customDaysCount,
                    onCountChanged = { onUpdateSetting("custom_days_count", it) }
                )
            }

            // --- Work Hours checkbox + configuration ---
            WorkHoursSection(
                workHoursEnabled = workHoursEnabled,
                workDays = settingsState.workDays,
                workStartHour = settingsState.workStartHour,
                workEndHour = settingsState.workEndHour,
                workHoursError = workHoursError,
                onWorkHoursEnabledChanged = { enabled ->
                    onUpdateSetting("work_hours_enabled", if (enabled) "1" else "0")
                },
                onWorkDaysChanged = { onUpdateSetting("work_days", it) },
                onWorkStartHourChanged = { onUpdateSetting("work_start_hour", it) },
                onWorkEndHourChanged = { onUpdateSetting("work_end_hour", it) }
            )
        }
    }
}

/**
 * Week Starts On dropdown with all 7 days: Sun, Mon, Tue, Wed, Thu, Fri, Sat.
 * Validates: Requirement 11.1
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun WeekStartDayDropdown(
    selectedDay: String,
    onDaySelected: (String) -> Unit
) {
    val dayOptions = listOf(
        "sun" to "Sun",
        "mon" to "Mon",
        "tue" to "Tue",
        "wed" to "Wed",
        "thu" to "Thu",
        "fri" to "Fri",
        "sat" to "Sat"
    )
    var expanded by remember { mutableStateOf(false) }
    val selectedLabel = dayOptions.firstOrNull { it.first == selectedDay }?.second ?: "Sun"

    Column {
        Text(
            text = "Week Starts On",
            style = MaterialTheme.typography.bodyLarge,
            fontWeight = FontWeight.Bold
        )
        Spacer(modifier = Modifier.height(8.dp))

        ExposedDropdownMenuBox(
            expanded = expanded,
            onExpandedChange = { expanded = !expanded }
        ) {
            OutlinedTextField(
                value = selectedLabel,
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
                dayOptions.forEach { (value, label) ->
                    DropdownMenuItem(
                        text = { Text(label) },
                        onClick = {
                            onDaySelected(value)
                            expanded = false
                        }
                    )
                }
            }
        }
    }
}

/**
 * View Hours start/end dropdowns (00:00–23:00, 1-hour increments).
 * Shows error when start >= end.
 * Validates: Requirements 11.2, 11.3
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ViewHoursSection(
    startHour: String,
    endHour: String,
    hasError: Boolean,
    onStartHourChanged: (String) -> Unit,
    onEndHourChanged: (String) -> Unit
) {
    val hourOptions = (0..23).map { it.toString() to String.format("%02d:00", it) }

    Column {
        Text(
            text = "\uD83D\uDD50 View Hours",
            style = MaterialTheme.typography.bodyLarge,
            fontWeight = FontWeight.Bold
        )
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = "For Day, Week, X Days views.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(modifier = Modifier.height(8.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            // Start hour dropdown
            HourDropdown(
                selectedHour = startHour,
                hourOptions = hourOptions,
                onHourSelected = onStartHourChanged,
                modifier = Modifier.weight(1f),
                isError = hasError
            )

            Text(
                text = "to",
                style = MaterialTheme.typography.bodyMedium
            )

            // End hour dropdown
            HourDropdown(
                selectedHour = endHour,
                hourOptions = hourOptions,
                onHourSelected = onEndHourChanged,
                modifier = Modifier.weight(1f),
                isError = hasError
            )
        }

        // Error message
        if (hasError) {
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = "Start hour must be earlier than end hour",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.error
            )
        }
    }
}

/**
 * Scroll to hour dropdown (00:00–12:00, 1-hour increments).
 * Validates: Requirement 11.4
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ScrollToHourDropdown(
    selectedHour: String,
    onHourSelected: (String) -> Unit
) {
    val hourOptions = (0..12).map { it.toString() to String.format("%02d:00", it) }
    var expanded by remember { mutableStateOf(false) }
    val selectedLabel = hourOptions.firstOrNull { it.first == selectedHour }?.second
        ?: String.format("%02d:00", selectedHour.toIntOrNull() ?: 8)

    Column {
        Text(
            text = "\uD83D\uDCCD Scroll to",
            style = MaterialTheme.typography.bodyLarge,
            fontWeight = FontWeight.Bold
        )
        Spacer(modifier = Modifier.height(8.dp))

        ExposedDropdownMenuBox(
            expanded = expanded,
            onExpandedChange = { expanded = !expanded }
        ) {
            OutlinedTextField(
                value = selectedLabel,
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
                hourOptions.forEach { (value, label) ->
                    DropdownMenuItem(
                        text = { Text(label) },
                        onClick = {
                            onHourSelected(value)
                            expanded = false
                        }
                    )
                }
            }
        }
    }
}

/**
 * X Days Count number input (2–30), shown when X Days period is enabled.
 * Validates: Requirement 11.5
 */
@Composable
private fun XDaysCountInput(
    currentCount: String,
    onCountChanged: (String) -> Unit
) {
    val countInt = currentCount.toIntOrNull()
    val hasError = countInt != null && (countInt < 2 || countInt > 30)

    Column {
        Text(
            text = "X Days Count",
            style = MaterialTheme.typography.bodyLarge,
            fontWeight = FontWeight.Bold
        )
        Spacer(modifier = Modifier.height(8.dp))

        OutlinedTextField(
            value = currentCount,
            onValueChange = { newValue ->
                // Allow only numeric input
                val filtered = newValue.filter { it.isDigit() }
                if (filtered.isEmpty()) {
                    onCountChanged("")
                } else {
                    val intVal = filtered.toIntOrNull()
                    if (intVal != null && intVal <= 99) {
                        onCountChanged(filtered)
                    }
                }
            },
            label = { Text("Days (2–30)") },
            isError = hasError,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )

        // Validation hint
        if (hasError) {
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = "Value must be between 2 and 30",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.error
            )
        }
    }
}

/**
 * Work Hours section with enable checkbox, work day checkboxes, and work hour start/end dropdowns.
 * Validates: Requirements 11.6, 11.7, 11.8
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun WorkHoursSection(
    workHoursEnabled: Boolean,
    workDays: String,
    workStartHour: String,
    workEndHour: String,
    workHoursError: Boolean,
    onWorkHoursEnabledChanged: (Boolean) -> Unit,
    onWorkDaysChanged: (String) -> Unit,
    onWorkStartHourChanged: (String) -> Unit,
    onWorkEndHourChanged: (String) -> Unit
) {
    val hourOptions = (0..23).map { it.toString() to String.format("%02d:00", it) }

    Column {
        // Work Hours enable checkbox
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.fillMaxWidth()
        ) {
            Checkbox(
                checked = workHoursEnabled,
                onCheckedChange = { onWorkHoursEnabledChanged(it) }
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = "Work Hours",
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.Bold
            )
        }

        // Work Hours configuration (shown only when enabled)
        if (workHoursEnabled) {
            Spacer(modifier = Modifier.height(8.dp))

            // Work Days checkboxes
            WorkDaysCheckboxes(
                workDays = workDays,
                onWorkDaysChanged = onWorkDaysChanged
            )

            Spacer(modifier = Modifier.height(12.dp))

            // Work Hours start/end dropdowns
            Text(
                text = "\uD83C\uDFE2 Work Hours",
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(8.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                HourDropdown(
                    selectedHour = workStartHour,
                    hourOptions = hourOptions,
                    onHourSelected = onWorkStartHourChanged,
                    modifier = Modifier.weight(1f),
                    isError = workHoursError
                )

                Text(
                    text = "to",
                    style = MaterialTheme.typography.bodyMedium
                )

                HourDropdown(
                    selectedHour = workEndHour,
                    hourOptions = hourOptions,
                    onHourSelected = onWorkEndHourChanged,
                    modifier = Modifier.weight(1f),
                    isError = workHoursError
                )
            }

            // Error message
            if (workHoursError) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Work start hour must be earlier than work end hour",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error
                )
            }
        }
    }
}

/**
 * Work Days checkboxes (Sun through Sat).
 */
@Composable
private fun WorkDaysCheckboxes(
    workDays: String,
    onWorkDaysChanged: (String) -> Unit
) {
    val allDays = listOf(
        "sun" to "Sun",
        "mon" to "Mon",
        "tue" to "Tue",
        "wed" to "Wed",
        "thu" to "Thu",
        "fri" to "Fri",
        "sat" to "Sat"
    )
    val enabledDays = remember(workDays) {
        workDays.split(",").map { it.trim().lowercase() }.filter { it.isNotEmpty() }.toSet()
    }

    Column {
        Text(
            text = "\uD83D\uDCC6 Work Days",
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.Bold
        )
        Spacer(modifier = Modifier.height(4.dp))

        // Display days in rows
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(0.dp)
        ) {
            allDays.forEach { (value, label) ->
                Row(
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Checkbox(
                        checked = value in enabledDays,
                        onCheckedChange = { checked ->
                            val newSet = if (checked) {
                                enabledDays + value
                            } else {
                                enabledDays - value
                            }
                            // Preserve order from allDays
                            val ordered = allDays.map { it.first }.filter { it in newSet }
                            onWorkDaysChanged(ordered.joinToString(","))
                        }
                    )
                    Text(
                        text = label,
                        style = MaterialTheme.typography.bodySmall
                    )
                }
            }
        }
    }
}

/**
 * Reusable hour dropdown composable used by View Hours and Work Hours sections.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun HourDropdown(
    selectedHour: String,
    hourOptions: List<Pair<String, String>>,
    onHourSelected: (String) -> Unit,
    modifier: Modifier = Modifier,
    isError: Boolean = false
) {
    var expanded by remember { mutableStateOf(false) }
    val selectedLabel = hourOptions.firstOrNull { it.first == selectedHour }?.second
        ?: String.format("%02d:00", selectedHour.toIntOrNull() ?: 0)

    ExposedDropdownMenuBox(
        expanded = expanded,
        onExpandedChange = { expanded = !expanded },
        modifier = modifier
    ) {
        OutlinedTextField(
            value = selectedLabel,
            onValueChange = {},
            readOnly = true,
            isError = isError,
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
            modifier = Modifier
                .menuAnchor()
                .fillMaxWidth()
        )
        ExposedDropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false }
        ) {
            hourOptions.forEach { (value, label) ->
                DropdownMenuItem(
                    text = { Text(label) },
                    onClick = {
                        onHourSelected(value)
                        expanded = false
                    }
                )
            }
        }
    }
}

// ============================================================
// Maps Section
// ============================================================

/**
 * Maps configuration section.
 * - "Auto-zoom to markers on load" checkbox (default checked, maps to map_auto_zoom "1"/"0")
 * - "Default Latitude" number input (-90 to 90)
 * - "Default Longitude" number input (-180 to 180)
 * - "Default Zoom (1-18)" number input (1 to 18)
 * - Inputs disabled (alpha 0.5) when auto-zoom is enabled
 * - Validation on save handled by ViewModel (clear invalid values to empty)
 *
 * Validates: Requirements 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7
 */
@Composable
private fun MapsSection(
    mapAutoZoom: String,
    mapDefaultLat: String,
    mapDefaultLon: String,
    mapDefaultZoom: String,
    onUpdateSetting: (key: String, value: String) -> Unit
) {
    val autoZoomEnabled = mapAutoZoom == "1"
    // When auto-zoom is enabled, inputs are visually disabled (reduced opacity, non-interactive)
    val inputAlpha = if (autoZoomEnabled) 0.5f else 1.0f

    CollapsibleSection(
        title = "\uD83D\uDDFA\uFE0F Maps",
        sectionId = "maps"
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            // --- Auto-zoom checkbox ---
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth()
            ) {
                Checkbox(
                    checked = autoZoomEnabled,
                    onCheckedChange = { checked ->
                        onUpdateSetting("map_auto_zoom", if (checked) "1" else "0")
                    }
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "Auto-zoom to markers on load",
                    style = MaterialTheme.typography.bodyLarge
                )
            }

            // --- Default Latitude input ---
            OutlinedTextField(
                value = mapDefaultLat,
                onValueChange = { value ->
                    onUpdateSetting("map_default_lat", value)
                },
                label = { Text("Default Latitude") },
                placeholder = { Text("-90 to 90") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                singleLine = true,
                enabled = !autoZoomEnabled,
                modifier = Modifier
                    .fillMaxWidth()
                    .alpha(inputAlpha)
            )

            // --- Default Longitude input ---
            OutlinedTextField(
                value = mapDefaultLon,
                onValueChange = { value ->
                    onUpdateSetting("map_default_lon", value)
                },
                label = { Text("Default Longitude") },
                placeholder = { Text("-180 to 180") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                singleLine = true,
                enabled = !autoZoomEnabled,
                modifier = Modifier
                    .fillMaxWidth()
                    .alpha(inputAlpha)
            )

            // --- Default Zoom input ---
            OutlinedTextField(
                value = mapDefaultZoom,
                onValueChange = { value ->
                    onUpdateSetting("map_default_zoom", value)
                },
                label = { Text("Default Zoom (1-18)") },
                placeholder = { Text("1 to 18") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                singleLine = true,
                enabled = !autoZoomEnabled,
                modifier = Modifier
                    .fillMaxWidth()
                    .alpha(inputAlpha)
            )

            // Hint text when auto-zoom is enabled
            if (autoZoomEnabled) {
                Text(
                    text = "Coordinate and zoom inputs are disabled while auto-zoom is active. They serve as fallback when no markers exist.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(start = 12.dp)
                )
            }
        }
    }
}


// ============================================================
// Habits Section
// ============================================================

/**
 * Habits configuration section.
 * - Success rate window dropdown
 * - Default: show habits on calendar checkbox
 *
 * Validates: Requirements 12.1, 12.2, 12.3, 12.4
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun HabitsSection(
    habitsSuccessWindow: String,
    defaultShowHabitsOnCalendar: String,
    onUpdateSetting: (key: String, value: String) -> Unit
) {
    CollapsibleSection(
        title = "Habits",
        sectionId = "views_habits"
    ) {
        Column(
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // --- Success rate window dropdown ---
            val windowOptions = listOf(
                "Last 7 days" to "7",
                "Last 30 days" to "30",
                "Last 90 days" to "90",
                "All time" to "all"
            )
            val currentLabel = windowOptions.find { it.second == habitsSuccessWindow }?.first ?: "Last 30 days"
            var expanded by remember { mutableStateOf(false) }

            Text(
                text = "Success rate window",
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Medium
            )

            ExposedDropdownMenuBox(
                expanded = expanded,
                onExpandedChange = { expanded = it }
            ) {
                OutlinedTextField(
                    value = currentLabel,
                    onValueChange = {},
                    readOnly = true,
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .menuAnchor()
                )
                ExposedDropdownMenu(
                    expanded = expanded,
                    onDismissRequest = { expanded = false }
                ) {
                    windowOptions.forEach { (label, value) ->
                        DropdownMenuItem(
                            text = { Text(label) },
                            onClick = {
                                onUpdateSetting("habits_success_window", value)
                                expanded = false
                            }
                        )
                    }
                }
            }

            // --- Default: show habits on calendar checkbox ---
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth()
            ) {
                Checkbox(
                    checked = defaultShowHabitsOnCalendar == "1",
                    onCheckedChange = { checked ->
                        onUpdateSetting("default_show_habits_on_calendar", if (checked) "1" else "0")
                    }
                )
                Text(
                    text = "Default: show habits on calendar",
                    style = MaterialTheme.typography.bodyMedium
                )
            }

            Text(
                text = "When checked, new habits will appear on the calendar by default. Each habit can override this in its editor.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(start = 12.dp)
            )
        }
    }
}


// ============================================================
// Projects Section
// ============================================================

/**
 * Projects configuration section.
 * - Show child chit count on project masters checkbox
 * - Show aggregate checklist progress on project masters checkbox
 *
 * Validates: Requirements 13.1, 13.2, 13.3, 13.4
 */
@Composable
private fun ProjectsSection(
    projectsShowChildCount: String,
    projectsShowChecklistCount: String,
    onUpdateSetting: (key: String, value: String) -> Unit
) {
    CollapsibleSection(
        title = "Projects",
        sectionId = "views_projects"
    ) {
        Column(
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            // --- Show child chit count checkbox ---
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth()
            ) {
                Checkbox(
                    checked = projectsShowChildCount == "1",
                    onCheckedChange = { checked ->
                        onUpdateSetting("projects_show_child_count", if (checked) "1" else "0")
                    }
                )
                Text(
                    text = "Show child chit count on project masters",
                    style = MaterialTheme.typography.bodyMedium
                )
            }

            // --- Show aggregate checklist progress checkbox ---
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth()
            ) {
                Checkbox(
                    checked = projectsShowChecklistCount == "1",
                    onCheckedChange = { checked ->
                        onUpdateSetting("projects_show_checklist_count", if (checked) "1" else "0")
                    }
                )
                Text(
                    text = "Show aggregate checklist progress on project masters",
                    style = MaterialTheme.typography.bodyMedium
                )
            }

            Text(
                text = "These options control the progress counters displayed on project master headers in the dashboard.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(start = 12.dp)
            )
        }
    }
}
