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
 */
private fun SortField.displayLabel(): String = when (this) {
    SortField.TITLE -> "Title"
    SortField.DUE_DATE -> "Due Date"
    SortField.START_DATE -> "Start Date"
    SortField.CREATED_DATE -> "Created Date"
    SortField.MODIFIED_DATE -> "Modified Date"
    SortField.PRIORITY -> "Priority"
    SortField.STATUS -> "Status"
    SortField.MANUAL -> "Manual"
}

/**
 * Sort panel composable embedded in the SidebarContent.
 * Provides a dropdown for sort field selection and an ASC/DESC toggle button.
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
            text = "Sort",
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
                                onSortStateChanged(sortState.copy(field = field))
                                expanded = false
                            },
                            contentPadding = ExposedDropdownMenuDefaults.ItemContentPadding
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.width(8.dp))

            // ASC/DESC toggle button
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
