package com.cwoc.app.ui.screens.tasks

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AddLink
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.LinkOff
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.cwoc.app.data.local.entity.ChitEntity
import com.cwoc.app.ui.theme.CwocDialogDefaults
import com.cwoc.app.ui.theme.CwocOutline

// ─── TimelineContextMenu ────────────────────────────────────────────────────────

/**
 * Context menu displayed on long-press of a timeline node (without drag).
 * Provides three actions:
 * - "Add Dependency" — enters Link Mode (next tapped node becomes dependent)
 * - "Remove Dependency" — shows sub-dialog listing current dependencies for removal
 * - "Open in Editor" — navigates to the chit editor
 *
 * Validates: Requirements 26.1, 26.2, 26.3, 26.4
 */
@Composable
fun TimelineContextMenu(
    expanded: Boolean,
    onDismiss: () -> Unit,
    chit: ChitEntity,
    allTasks: List<ChitEntity>,
    onAddDependency: () -> Unit,
    onRemoveDependency: (prereqId: String, dependentId: String) -> Unit,
    onOpenInEditor: () -> Unit
) {
    var showRemoveDependencyDialog by remember { mutableStateOf(false) }

    DropdownMenu(
        expanded = expanded,
        onDismissRequest = onDismiss,
        modifier = Modifier
            .background(CwocDialogDefaults.containerColor)
            .border(1.dp, CwocOutline, RoundedCornerShape(4.dp))
    ) {
        // Add Dependency — enters Link Mode
        DropdownMenuItem(
            text = { Text("Add Dependency") },
            onClick = {
                onDismiss()
                onAddDependency()
            },
            leadingIcon = {
                Icon(
                    imageVector = Icons.Default.AddLink,
                    contentDescription = "Add Dependency"
                )
            }
        )

        // Remove Dependency — shows sub-dialog with current dependencies
        DropdownMenuItem(
            text = { Text("Remove Dependency") },
            onClick = {
                onDismiss()
                showRemoveDependencyDialog = true
            },
            leadingIcon = {
                Icon(
                    imageVector = Icons.Default.LinkOff,
                    contentDescription = "Remove Dependency"
                )
            }
        )

        // Open in Editor — navigates to chit editor
        DropdownMenuItem(
            text = { Text("Open in Editor") },
            onClick = {
                onDismiss()
                onOpenInEditor()
            },
            leadingIcon = {
                Icon(
                    imageVector = Icons.Default.Edit,
                    contentDescription = "Open in Editor"
                )
            }
        )
    }

    // Remove Dependency sub-dialog
    if (showRemoveDependencyDialog) {
        RemoveDependencyDialog(
            chit = chit,
            allTasks = allTasks,
            onRemove = { prereqId, dependentId ->
                onRemoveDependency(prereqId, dependentId)
            },
            onDismiss = { showRemoveDependencyDialog = false }
        )
    }
}

// ─── RemoveDependencyDialog ─────────────────────────────────────────────────────

/**
 * Dialog listing all current dependencies (prerequisites and dependents) for a node.
 * The user can tap any dependency to remove it.
 *
 * Shows two sections:
 * - "Prerequisites" — tasks that this node depends on (this node is the dependent)
 * - "Dependents" — tasks that depend on this node (this node is the prerequisite)
 */
@Composable
private fun RemoveDependencyDialog(
    chit: ChitEntity,
    allTasks: List<ChitEntity>,
    onRemove: (prereqId: String, dependentId: String) -> Unit,
    onDismiss: () -> Unit
) {
    // Build lookup map for task titles
    val taskMap = remember(allTasks) {
        allTasks.associateBy { it.id }
    }

    // Prerequisites: tasks that this chit depends on
    val prerequisites = remember(chit, taskMap) {
        (chit.prerequisites ?: emptyList()).mapNotNull { prereqId ->
            taskMap[prereqId]?.let { prereqId to (it.title ?: "Untitled") }
        }
    }

    // Dependents: tasks that depend on this chit (this chit is in their prerequisites)
    val dependents = remember(chit, allTasks) {
        allTasks.filter { task ->
            task.prerequisites?.contains(chit.id) == true
        }.map { it.id to (it.title ?: "Untitled") }
    }

    val hasDependencies = prerequisites.isNotEmpty() || dependents.isNotEmpty()

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = CwocDialogDefaults.containerColor,
        title = {
            Text(
                text = "Remove Dependency",
                fontWeight = FontWeight.SemiBold
            )
        },
        text = {
            if (!hasDependencies) {
                Text(
                    text = "This task has no dependencies.",
                    style = MaterialTheme.typography.bodyMedium
                )
            } else {
                Column {
                    // Prerequisites section
                    if (prerequisites.isNotEmpty()) {
                        Text(
                            text = "Prerequisites (this task depends on):",
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.padding(bottom = 4.dp)
                        )
                        prerequisites.forEach { (prereqId, title) ->
                            DependencyRemoveItem(
                                title = title,
                                onClick = {
                                    // Remove: prereqId is prerequisite, chit.id is dependent
                                    onRemove(prereqId, chit.id)
                                    onDismiss()
                                }
                            )
                        }
                    }

                    // Spacer between sections
                    if (prerequisites.isNotEmpty() && dependents.isNotEmpty()) {
                        Spacer(modifier = Modifier.height(12.dp))
                    }

                    // Dependents section
                    if (dependents.isNotEmpty()) {
                        Text(
                            text = "Dependents (depend on this task):",
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.padding(bottom = 4.dp)
                        )
                        dependents.forEach { (dependentId, title) ->
                            DependencyRemoveItem(
                                title = title,
                                onClick = {
                                    // Remove: chit.id is prerequisite, dependentId is dependent
                                    onRemove(chit.id, dependentId)
                                    onDismiss()
                                }
                            )
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text("Close")
            }
        }
    )
}

// ─── DependencyRemoveItem ───────────────────────────────────────────────────────

/**
 * A single removable dependency item in the Remove Dependency dialog.
 * Displays the task title with a remove button.
 */
@Composable
private fun DependencyRemoveItem(
    title: String,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = Icons.Default.LinkOff,
            contentDescription = "Remove",
            modifier = Modifier.padding(end = 8.dp),
            tint = MaterialTheme.colorScheme.error
        )
        Text(
            text = title,
            style = MaterialTheme.typography.bodyMedium,
            modifier = Modifier.weight(1f)
        )
        TextButton(onClick = onClick) {
            Text(
                text = "Remove",
                color = MaterialTheme.colorScheme.error,
                fontSize = 12.sp
            )
        }
    }
}
