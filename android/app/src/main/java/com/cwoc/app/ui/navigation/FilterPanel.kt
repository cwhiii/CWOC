package com.cwoc.app.ui.navigation

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
import androidx.compose.material3.Checkbox
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.cwoc.app.domain.filter.FilterState
import com.cwoc.app.domain.filter.TagMatchMode

/**
 * Filter panel embedded in the SidebarContent.
 * Provides multi-select chips for status/priority, tag checkboxes with match mode,
 * people chip selection, boolean toggles, and a "Clear All Filters" button.
 *
 * Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.9
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun FilterPanel(
    filterState: FilterState,
    onFilterStateChanged: (FilterState) -> Unit,
    availableTags: List<String>,
    availablePeople: List<String>,
    onClearAll: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp)
    ) {
        Text(
            text = "Filters",
            style = MaterialTheme.typography.titleSmall,
            modifier = Modifier.padding(bottom = 8.dp)
        )

        // --- Status multi-select chips ---
        Text(
            text = "Status",
            style = MaterialTheme.typography.labelMedium,
            modifier = Modifier.padding(bottom = 4.dp)
        )
        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            // V1: Include "Rejected" in status options
            val statusOptions = listOf("ToDo", "In Progress", "Blocked", "Complete", "Rejected")
            statusOptions.forEach { status ->
                val selected = status in filterState.statuses
                FilterChip(
                    selected = selected,
                    onClick = {
                        val newStatuses = if (selected) {
                            filterState.statuses - status
                        } else {
                            filterState.statuses + status
                        }
                        onFilterStateChanged(filterState.copy(statuses = newStatuses))
                    },
                    label = { Text(status) }
                )
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        // --- Priority multi-select chips ---
        Text(
            text = "Priority",
            style = MaterialTheme.typography.labelMedium,
            modifier = Modifier.padding(bottom = 4.dp)
        )
        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            val priorityOptions = listOf("Critical", "High", "Medium", "Low")
            priorityOptions.forEach { priority ->
                val selected = priority in filterState.priorities
                FilterChip(
                    selected = selected,
                    onClick = {
                        val newPriorities = if (selected) {
                            filterState.priorities - priority
                        } else {
                            filterState.priorities + priority
                        }
                        onFilterStateChanged(filterState.copy(priorities = newPriorities))
                    },
                    label = { Text(priority) }
                )
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        // --- Tags with checkboxes + match mode toggle ---
        if (availableTags.isNotEmpty()) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    text = "Tags",
                    style = MaterialTheme.typography.labelMedium
                )
                Spacer(modifier = Modifier.weight(1f))
                // Match mode toggle (ANY / ALL)
                TextButton(
                    onClick = {
                        val newMode = if (filterState.tagMatchMode == TagMatchMode.ANY) {
                            TagMatchMode.ALL
                        } else {
                            TagMatchMode.ANY
                        }
                        onFilterStateChanged(filterState.copy(tagMatchMode = newMode))
                    }
                ) {
                    Text(
                        text = if (filterState.tagMatchMode == TagMatchMode.ANY) "ANY" else "ALL",
                        style = MaterialTheme.typography.labelSmall
                    )
                }
            }

            availableTags.forEach { tag ->
                val checked = tag in filterState.tags
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(start = 4.dp)
                ) {
                    Checkbox(
                        checked = checked,
                        onCheckedChange = { isChecked ->
                            val newTags = if (isChecked) {
                                filterState.tags + tag
                            } else {
                                filterState.tags - tag
                            }
                            onFilterStateChanged(filterState.copy(tags = newTags))
                        }
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = tag,
                        style = MaterialTheme.typography.bodySmall
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))
        }

        // --- People chip selection ---
        if (availablePeople.isNotEmpty()) {
            Text(
                text = "People",
                style = MaterialTheme.typography.labelMedium,
                modifier = Modifier.padding(bottom = 4.dp)
            )
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                availablePeople.forEach { person ->
                    val selected = person in filterState.people
                    FilterChip(
                        selected = selected,
                        onClick = {
                            val newPeople = if (selected) {
                                filterState.people - person
                            } else {
                                filterState.people + person
                            }
                            onFilterStateChanged(filterState.copy(people = newPeople))
                        },
                        label = { Text(person) }
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))
        }

        // --- Boolean toggles ---
        Text(
            text = "Show",
            style = MaterialTheme.typography.labelMedium,
            modifier = Modifier.padding(bottom = 4.dp)
        )

        FilterToggleRow(
            label = "Archived",
            checked = filterState.showArchived,
            onCheckedChange = {
                onFilterStateChanged(filterState.copy(showArchived = it))
            }
        )
        FilterToggleRow(
            label = "Pinned",
            checked = filterState.showPinned,
            onCheckedChange = {
                onFilterStateChanged(filterState.copy(showPinned = it))
            }
        )
        FilterToggleRow(
            label = "Snoozed",
            checked = filterState.showSnoozed,
            onCheckedChange = {
                onFilterStateChanged(filterState.copy(showSnoozed = it))
            }
        )
        FilterToggleRow(
            label = "Past Due",
            checked = filterState.showPastDue,
            onCheckedChange = {
                onFilterStateChanged(filterState.copy(showPastDue = it))
            }
        )
        // V2: Show Declined toggle
        FilterToggleRow(
            label = "Show Declined",
            checked = filterState.showDeclined,
            onCheckedChange = {
                onFilterStateChanged(filterState.copy(showDeclined = it))
            }
        )

        Spacer(modifier = Modifier.height(12.dp))

        // V3: Color filter chips
        Text(
            text = "Color",
            style = MaterialTheme.typography.labelMedium,
            modifier = Modifier.padding(bottom = 4.dp)
        )
        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            val colorOptions = listOf(
                "#C66B6B" to "Red",
                "#D68A59" to "Orange",
                "#E3B23C" to "Yellow",
                "#8A9A5B" to "Green",
                "#6B8299" to "Blue",
                "#8B6B99" to "Purple"
            )
            colorOptions.forEach { (color, label) ->
                val selected = color in filterState.colors
                FilterChip(
                    selected = selected,
                    onClick = {
                        val newColors = if (selected) filterState.colors - color
                        else filterState.colors + color
                        onFilterStateChanged(filterState.copy(colors = newColors))
                    },
                    label = { Text(label) }
                )
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        // V4: Date range filter
        Text(
            text = "Date Range",
            style = MaterialTheme.typography.labelMedium,
            modifier = Modifier.padding(bottom = 4.dp)
        )
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            androidx.compose.material3.OutlinedTextField(
                value = filterState.dateRangeStart ?: "",
                onValueChange = {
                    onFilterStateChanged(filterState.copy(dateRangeStart = it.ifBlank { null }))
                },
                label = { Text("From") },
                placeholder = { Text("YYYY-MM-DD") },
                singleLine = true,
                modifier = Modifier.weight(1f)
            )
            androidx.compose.material3.OutlinedTextField(
                value = filterState.dateRangeEnd ?: "",
                onValueChange = {
                    onFilterStateChanged(filterState.copy(dateRangeEnd = it.ifBlank { null }))
                },
                label = { Text("To") },
                placeholder = { Text("YYYY-MM-DD") },
                singleLine = true,
                modifier = Modifier.weight(1f)
            )
        }

        Spacer(modifier = Modifier.height(16.dp))

        // --- Clear All Filters button ---
        TextButton(
            onClick = onClearAll,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Clear All Filters")
        }
    }
}

/**
 * A single row with a label and a Switch toggle for boolean filter options.
 */
@Composable
private fun FilterToggleRow(
    label: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 2.dp)
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodySmall,
            modifier = Modifier.weight(1f)
        )
        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange
        )
    }
}
