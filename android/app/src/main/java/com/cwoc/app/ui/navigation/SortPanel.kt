package com.cwoc.app.ui.navigation

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDownward
import androidx.compose.material.icons.filled.ArrowUpward
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.cwoc.app.domain.sort.SortDirection
import com.cwoc.app.domain.sort.SortField
import com.cwoc.app.domain.sort.SortState

/**
 * Human-readable labels for each sort field.
 * Matches the web sidebar's sort dropdown options exactly.
 */
private fun SortField.displayLabel(): String = when (this) {
    SortField.NONE -> "— None —"
    SortField.TITLE -> "Title"
    SortField.START_DATE -> "Start Date"
    SortField.DUE_DATE -> "Due Date"
    SortField.MODIFIED_DATE -> "Updated"
    SortField.CREATED_DATE -> "Created"
    SortField.STATUS -> "Status"
    SortField.MANUAL -> "Manual"
    SortField.RANDOM -> "Random / Shuffle"
    SortField.UPCOMING -> "Upcoming (Due Soon)"
    SortField.PRIORITY -> "Priority"
}

/**
 * Sort panel composable embedded in the SidebarContent.
 * Provides a dropdown for sort field selection and an ASC/DESC toggle button.
 * Section title is "Order" (matching web).
 * Direction button is hidden for NONE, MANUAL, RANDOM, and UPCOMING.
 * When sort field changes, direction resets to ASC.
 *
 * @param sortState The current sort state (field + direction).
 * @param onSortStateChanged Callback invoked when the user changes the sort field or direction.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SortPanel(
    sortState: SortState,
    onSortStateChanged: (SortState) -> Unit,
    modifier: Modifier = Modifier
) {
    var expanded by remember { mutableStateOf(false) }

    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp)
    ) {
        Text(
            text = "Order",
            style = MaterialTheme.typography.titleSmall,
            modifier = Modifier.padding(bottom = 8.dp)
        )

        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.fillMaxWidth()
        ) {
            // Sort field dropdown
            ExposedDropdownMenuBox(
                expanded = expanded,
                onExpandedChange = { expanded = it },
                modifier = Modifier.weight(1f)
            ) {
                TextField(
                    value = sortState.field.displayLabel(),
                    onValueChange = {},
                    readOnly = true,
                    singleLine = true,
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
                    colors = ExposedDropdownMenuDefaults.textFieldColors(),
                    modifier = Modifier
                        .menuAnchor()
                        .fillMaxWidth()
                )

                ExposedDropdownMenu(
                    expanded = expanded,
                    onDismissRequest = { expanded = false }
                ) {
                    SortField.entries.forEach { field ->
                        DropdownMenuItem(
                            text = { Text(field.displayLabel()) },
                            onClick = {
                                // Reset direction to ASC when changing field (matches web)
                                onSortStateChanged(SortState(field = field, direction = SortDirection.ASC))
                                expanded = false
                            },
                            contentPadding = ExposedDropdownMenuDefaults.ItemContentPadding
                        )
                    }
                }
            }

            // ASC/DESC toggle button — hidden for NONE, MANUAL, RANDOM, UPCOMING
            if (sortState.showDirectionToggle) {
                Spacer(modifier = Modifier.width(8.dp))

                IconButton(
                    onClick = {
                        val newDirection = when (sortState.direction) {
                            SortDirection.ASC -> SortDirection.DESC
                            SortDirection.DESC -> SortDirection.ASC
                        }
                        onSortStateChanged(sortState.copy(direction = newDirection))
                    }
                ) {
                    Icon(
                        imageVector = when (sortState.direction) {
                            SortDirection.ASC -> Icons.Default.ArrowUpward
                            SortDirection.DESC -> Icons.Default.ArrowDownward
                        },
                        contentDescription = when (sortState.direction) {
                            SortDirection.ASC -> "Ascending (tap to switch to descending)"
                            SortDirection.DESC -> "Descending (tap to switch to ascending)"
                        }
                    )
                }
            }
        }
    }
}
