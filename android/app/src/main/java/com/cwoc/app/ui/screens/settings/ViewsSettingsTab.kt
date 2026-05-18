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
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.Reorder
import androidx.compose.material3.Checkbox
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
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.cwoc.app.ui.components.ArrangeViewsDialog
import com.cwoc.app.ui.components.CwocZoneButton

/**
 * Views settings tab composable.
 * Fields: default view dropdown, enabled periods checkboxes, view order reorderable list.
 *
 * Validates: Requirements 2.4
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ViewsSettingsTab(
    settingsState: SettingsFormState,
    onUpdateSetting: (key: String, value: String) -> Unit
) {
    val scrollState = rememberScrollState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(scrollState)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(24.dp)
    ) {
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
    }
}

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
