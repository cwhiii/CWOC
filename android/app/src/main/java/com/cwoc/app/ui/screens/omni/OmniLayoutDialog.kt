package com.cwoc.app.ui.screens.omni

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

/**
 * Bottom sheet dialog for configuring the Omni View layout.
 * Allows reordering sections (move up/down), toggling visibility,
 * and setting hideWhenEmpty per section.
 *
 * Changes are applied immediately on Save and persisted to settings.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OmniLayoutDialog(
    sections: List<OmniSection>,
    onDismiss: () -> Unit,
    onSave: (List<OmniSection>) -> Unit
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    // Mutable working copy of sections for editing
    val editableSections = remember {
        mutableStateListOf(*sections.sortedBy { it.order }.toTypedArray())
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp)
        ) {
            // Header
            Text(
                text = "Configure Omni Layout",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = "Reorder, show/hide, and configure sections",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.height(12.dp))

            // Section list
            LazyColumn(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f, fill = false),
                verticalArrangement = Arrangement.spacedBy(2.dp)
            ) {
                itemsIndexed(
                    editableSections,
                    key = { _, section -> section.type.name }
                ) { index, section ->
                    OmniLayoutSectionRow(
                        section = section,
                        index = index,
                        totalCount = editableSections.size,
                        onMoveUp = {
                            if (index > 0) {
                                val item = editableSections.removeAt(index)
                                editableSections.add(index - 1, item)
                            }
                        },
                        onMoveDown = {
                            if (index < editableSections.size - 1) {
                                val item = editableSections.removeAt(index)
                                editableSections.add(index + 1, item)
                            }
                        },
                        onToggleVisible = {
                            editableSections[index] = section.copy(visible = !section.visible)
                        },
                        onToggleHideWhenEmpty = {
                            editableSections[index] = section.copy(hideWhenEmpty = !section.hideWhenEmpty)
                        }
                    )
                    if (index < editableSections.size - 1) {
                        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Action buttons
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End
            ) {
                OutlinedButton(onClick = onDismiss) {
                    Text("Cancel")
                }
                Spacer(modifier = Modifier.width(8.dp))
                Button(
                    onClick = {
                        // Rebuild with updated order indices
                        val result = editableSections.mapIndexed { idx, section ->
                            section.copy(order = idx)
                        }
                        onSave(result)
                    }
                ) {
                    Text("Save")
                }
            }

            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}

/**
 * A single row in the layout configuration list.
 * Shows section name, visibility checkbox, hideWhenEmpty checkbox, and move up/down buttons.
 */
@Composable
private fun OmniLayoutSectionRow(
    section: OmniSection,
    index: Int,
    totalCount: Int,
    onMoveUp: () -> Unit,
    onMoveDown: () -> Unit,
    onToggleVisible: () -> Unit,
    onToggleHideWhenEmpty: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Move up/down buttons
        Column {
            IconButton(
                onClick = onMoveUp,
                enabled = index > 0
            ) {
                Icon(
                    imageVector = Icons.Default.KeyboardArrowUp,
                    contentDescription = "Move up",
                    tint = if (index > 0) MaterialTheme.colorScheme.onSurface
                        else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.3f)
                )
            }
            IconButton(
                onClick = onMoveDown,
                enabled = index < totalCount - 1
            ) {
                Icon(
                    imageVector = Icons.Default.KeyboardArrowDown,
                    contentDescription = "Move down",
                    tint = if (index < totalCount - 1) MaterialTheme.colorScheme.onSurface
                        else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.3f)
                )
            }
        }

        // Section name
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = OmniViewViewModel.sectionDisplayName(section.type),
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.Medium,
                color = if (section.visible) MaterialTheme.colorScheme.onSurface
                    else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
            )
        }

        // Visible toggle
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = "Show",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Checkbox(
                checked = section.visible,
                onCheckedChange = { onToggleVisible() }
            )
        }

        Spacer(modifier = Modifier.width(4.dp))

        // Hide when empty toggle
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = "Auto-hide",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Checkbox(
                checked = section.hideWhenEmpty,
                onCheckedChange = { onToggleHideWhenEmpty() }
            )
        }
    }
}
