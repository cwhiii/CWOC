package com.cwoc.app.ui.navigation.filter

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Data class for project items in the filter dropdown.
 */
data class ProjectItem(
    val id: String,
    val title: String
)

/**
 * Project filter dropdown matching the web sidebar's Project filter group.
 * Static options: "—" (null), "Any (has a project)" ("__any__"), "None (no project)" ("__none__").
 * Dynamic options: project master titles sorted alphabetically.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProjectFilterDropdown(
    projects: List<ProjectItem>,
    selectedProjectId: String?,
    onSelectionChanged: (String?) -> Unit,
    onClear: () -> Unit,
    modifier: Modifier = Modifier
) {
    var expanded by remember { mutableStateOf(false) }

    // Build the display label for the current selection
    val displayLabel = when (selectedProjectId) {
        null -> "—"
        "__any__" -> "Any (has a project)"
        "__none__" -> "None (no project)"
        else -> projects.firstOrNull { it.id == selectedProjectId }?.title ?: "—"
    }

    Column(modifier = modifier.fillMaxWidth()) {
        ExposedDropdownMenuBox(
            expanded = expanded,
            onExpandedChange = { expanded = it }
        ) {
            OutlinedTextField(
                value = displayLabel,
                onValueChange = {},
                readOnly = true,
                singleLine = true,
                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
                modifier = Modifier
                    .menuAnchor()
                    .fillMaxWidth(),
                textStyle = androidx.compose.ui.text.TextStyle(
                    fontSize = 13.sp,
                    color = FilterBrownText
                ),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = FilterBrownBorder,
                    unfocusedBorderColor = FilterBrownBorder.copy(alpha = 0.6f),
                    focusedContainerColor = FilterParchmentBg,
                    unfocusedContainerColor = FilterParchmentBg
                ),
                shape = RoundedCornerShape(3.dp)
            )

            ExposedDropdownMenu(
                expanded = expanded,
                onDismissRequest = { expanded = false }
            ) {
                // Static options
                DropdownMenuItem(
                    text = { Text("—", fontSize = 13.sp, color = FilterBrownText) },
                    onClick = { onSelectionChanged(null); expanded = false },
                    contentPadding = ExposedDropdownMenuDefaults.ItemContentPadding
                )
                DropdownMenuItem(
                    text = { Text("Any (has a project)", fontSize = 13.sp, color = FilterBrownText) },
                    onClick = { onSelectionChanged("__any__"); expanded = false },
                    contentPadding = ExposedDropdownMenuDefaults.ItemContentPadding
                )
                DropdownMenuItem(
                    text = { Text("None (no project)", fontSize = 13.sp, color = FilterBrownText) },
                    onClick = { onSelectionChanged("__none__"); expanded = false },
                    contentPadding = ExposedDropdownMenuDefaults.ItemContentPadding
                )

                // Dynamic project options
                projects.forEach { project ->
                    DropdownMenuItem(
                        text = { Text(project.title, fontSize = 13.sp, color = FilterBrownText) },
                        onClick = { onSelectionChanged(project.id); expanded = false },
                        contentPadding = ExposedDropdownMenuDefaults.ItemContentPadding
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(4.dp))

        FilterClearButton(
            onClick = onClear,
            modifier = Modifier.padding(start = 8.dp)
        )
    }
}
