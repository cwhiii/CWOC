package com.cwoc.app.ui.screens.email

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Archive
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Folder
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
 * Provides quick actions: Archive, Delete, Mark Unread/Read, and Add to Bundle.
 *
 * Each action triggers the undo toast flow via the provided callbacks, which should
 * be connected to EmailViewModel's archiveWithUndo/deleteWithUndo/toggleReadState.
 *
 * Validates: Requirements 9.1, 9.2, 9.3, 9.4, 15.1
 */
@Composable
fun EmailContextMenu(
    expanded: Boolean,
    onDismiss: () -> Unit,
    isRead: Boolean,
    onArchive: () -> Unit,
    onDelete: () -> Unit,
    onToggleRead: () -> Unit,
    onPin: (() -> Unit)? = null,
    isPinned: Boolean = false,
    onOpenInEditor: (() -> Unit)? = null,
    onAddToBundle: (() -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    DropdownMenu(
        expanded = expanded,
        onDismissRequest = onDismiss,
        modifier = modifier
    ) {
        // Open in Editor (matching web's context menu)
        if (onOpenInEditor != null) {
            DropdownMenuItem(
                text = { Text("Open in Editor") },
                onClick = {
                    onDismiss()
                    onOpenInEditor()
                },
                leadingIcon = {
                    Icon(
                        imageVector = Icons.Default.Mail,
                        contentDescription = "Open in Editor"
                    )
                }
            )
        }

        // Pin/Unpin toggle (matching web's context menu)
        if (onPin != null) {
            DropdownMenuItem(
                text = { Text(if (isPinned) "Unpin" else "Pin") },
                onClick = {
                    onDismiss()
                    onPin()
                },
                leadingIcon = {
                    Icon(
                        imageVector = if (isPinned) Icons.Default.Bookmark else Icons.Default.Bookmark,
                        contentDescription = if (isPinned) "Unpin" else "Pin"
                    )
                }
            )
        }

        // Add to Bundle action (Requirement 15.1)
        if (onAddToBundle != null) {
            DropdownMenuItem(
                text = { Text("Add to Bundle") },
                onClick = {
                    onDismiss()
                    onAddToBundle()
                },
                leadingIcon = {
                    Icon(
                        imageVector = Icons.Default.Folder,
                        contentDescription = "Add to Bundle"
                    )
                }
            )
        }

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
