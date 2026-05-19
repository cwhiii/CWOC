package com.cwoc.app.ui.components

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Archive
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.PushPin
import androidx.compose.material.icons.filled.Snooze
import androidx.compose.material.icons.filled.Unarchive
import androidx.compose.material.icons.outlined.PushPin
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.cwoc.app.data.local.entity.ChitEntity

/**
 * Long-press context menu for chit actions.
 *
 * Displays a dropdown with Pin/Unpin, Archive/Unarchive, Snooze, Edit, and Delete actions.
 * Labels adapt based on the current chit state (e.g., "Unpin" if already pinned).
 *
 * @param expanded Whether the menu is currently visible.
 * @param chit The chit entity to determine current state for label text.
 * @param onDismiss Callback when the menu is dismissed.
 * @param onPin Callback for pin/unpin action.
 * @param onArchive Callback for archive/unarchive action.
 * @param onSnooze Callback for snooze action.
 * @param onEdit Callback for edit action.
 * @param onDelete Callback for delete action.
 */
@Composable
fun ChitActionMenu(
    expanded: Boolean,
    chit: ChitEntity,
    onDismiss: () -> Unit,
    onPin: () -> Unit,
    onArchive: () -> Unit,
    onSnooze: () -> Unit,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
    onCreateChildChit: (() -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    DropdownMenu(
        expanded = expanded,
        onDismissRequest = onDismiss,
        modifier = modifier
    ) {
        // Create Child Chit (only for project masters — Task 35.2)
        if (chit.isProjectMaster && onCreateChildChit != null) {
            DropdownMenuItem(
                text = { Text("Create Child Chit") },
                onClick = {
                    onCreateChildChit()
                    onDismiss()
                },
                leadingIcon = {
                    Icon(
                        imageVector = Icons.Filled.Add,
                        contentDescription = "Create Child Chit"
                    )
                }
            )
        }

        // Pin / Unpin
        DropdownMenuItem(
            text = { Text(if (chit.pinned) "Unpin" else "Pin") },
            onClick = {
                onPin()
                onDismiss()
            },
            leadingIcon = {
                Icon(
                    imageVector = if (chit.pinned) Icons.Outlined.PushPin else Icons.Filled.PushPin,
                    contentDescription = if (chit.pinned) "Unpin" else "Pin"
                )
            }
        )

        // Archive / Unarchive
        DropdownMenuItem(
            text = { Text(if (chit.archived) "Unarchive" else "Archive") },
            onClick = {
                onArchive()
                onDismiss()
            },
            leadingIcon = {
                Icon(
                    imageVector = if (chit.archived) Icons.Filled.Unarchive else Icons.Filled.Archive,
                    contentDescription = if (chit.archived) "Unarchive" else "Archive"
                )
            }
        )

        // Snooze / Unsnooze
        val isSnoozed = !chit.snoozedUntil.isNullOrBlank()
        DropdownMenuItem(
            text = { Text(if (isSnoozed) "Unsnooze" else "Snooze") },
            onClick = {
                onSnooze()
                onDismiss()
            },
            leadingIcon = {
                Icon(
                    imageVector = Icons.Filled.Snooze,
                    contentDescription = if (isSnoozed) "Unsnooze" else "Snooze"
                )
            }
        )

        // Edit
        DropdownMenuItem(
            text = { Text("Edit") },
            onClick = {
                onEdit()
                onDismiss()
            },
            leadingIcon = {
                Icon(
                    imageVector = Icons.Filled.Edit,
                    contentDescription = "Edit"
                )
            }
        )

        // Delete
        DropdownMenuItem(
            text = { Text("Delete") },
            onClick = {
                onDelete()
                onDismiss()
            },
            leadingIcon = {
                Icon(
                    imageVector = Icons.Filled.Delete,
                    contentDescription = "Delete"
                )
            }
        )
    }
}
