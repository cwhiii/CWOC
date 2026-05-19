package com.cwoc.app.ui.screens.email

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Archive
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Mail
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier

/**
 * Context menu displayed on long-press of an email card (when not in multi-select mode).
 * Provides quick actions: Archive, Delete, and Mark Unread/Read.
 *
 * Each action triggers the undo toast flow via the provided callbacks, which should
 * be connected to EmailViewModel's archiveWithUndo/deleteWithUndo/toggleReadState.
 *
 * Validates: Requirements 9.1, 9.2, 9.3, 9.4
 */
@Composable
fun EmailContextMenu(
    expanded: Boolean,
    onDismiss: () -> Unit,
    isRead: Boolean,
    onArchive: () -> Unit,
    onDelete: () -> Unit,
    onToggleRead: () -> Unit,
    modifier: Modifier = Modifier
) {
    DropdownMenu(
        expanded = expanded,
        onDismissRequest = onDismiss,
        modifier = modifier
    ) {
        // Archive action — triggers undo toast flow (Requirement 9.2)
        DropdownMenuItem(
            text = { Text("Archive") },
            onClick = {
                onDismiss()
                onArchive()
            },
            leadingIcon = {
                Icon(
                    imageVector = Icons.Default.Archive,
                    contentDescription = "Archive"
                )
            }
        )

        // Delete action — triggers undo toast flow (Requirement 9.3)
        DropdownMenuItem(
            text = {
                Text(
                    text = "Delete",
                    color = MaterialTheme.colorScheme.error
                )
            },
            onClick = {
                onDismiss()
                onDelete()
            },
            leadingIcon = {
                Icon(
                    imageVector = Icons.Default.Delete,
                    contentDescription = "Delete",
                    tint = MaterialTheme.colorScheme.error
                )
            }
        )

        // Mark Unread/Read toggle — toggles read state (Requirement 9.4)
        DropdownMenuItem(
            text = { Text(if (isRead) "Mark Unread" else "Mark Read") },
            onClick = {
                onDismiss()
                onToggleRead()
            },
            leadingIcon = {
                Icon(
                    imageVector = Icons.Default.Mail,
                    contentDescription = if (isRead) "Mark Unread" else "Mark Read"
                )
            }
        )
    }
}
