package com.cwoc.app.ui.screens.email

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.cwoc.app.data.remote.BundleDto

/**
 * Context menu displayed on long-press (500ms) of a bundle tab.
 *
 * Shows contextual actions based on the bundle type:
 * - "Edit" — always shown, opens the Edit Bundle modal.
 * - "Disable" — shown only for auto-bundles (removable == false).
 * - "Delete" — shown only for user-created bundles (removable == true)
 *   AND the bundle is not "Everything Else".
 *
 * Validates: Requirements 22.1-22.7
 *
 * @param expanded Whether the context menu is currently visible.
 * @param bundle The bundle for which the context menu is shown.
 * @param onDismiss Callback when the menu is dismissed (tap outside or action taken).
 * @param onEdit Callback when the user selects "Edit" — opens Edit Bundle modal.
 * @param onDisable Callback when the user selects "Disable" — hides the auto-bundle
 *   and strips its tags from classified emails.
 * @param onDelete Callback when the user selects "Delete" — confirms then deletes
 *   the user-created bundle via DELETE /api/bundles/{id}.
 * @param modifier Optional modifier for the DropdownMenu.
 */
@Composable
fun BundleContextMenu(
    expanded: Boolean,
    bundle: BundleDto,
    onDismiss: () -> Unit,
    onEdit: () -> Unit,
    onDisable: () -> Unit,
    onDelete: () -> Unit,
    modifier: Modifier = Modifier
) {
    val isAutoBundle = bundle.removable == false
    val isUserCreated = bundle.removable == true
    val isEverythingElse = bundle.name.equals("Everything Else", ignoreCase = true)

    DropdownMenu(
        expanded = expanded,
        onDismissRequest = onDismiss,
        modifier = modifier
    ) {
        // Edit — always shown (Req 22.2)
        DropdownMenuItem(
            text = { Text("Edit") },
            onClick = {
                onEdit()
                onDismiss()
            },
            leadingIcon = {
                Icon(
                    imageVector = Icons.Filled.Edit,
                    contentDescription = "Edit bundle"
                )
            }
        )

        // Disable — shown only for auto-bundles (Req 22.3, 22.4)
        if (isAutoBundle) {
            DropdownMenuItem(
                text = { Text("Disable") },
                onClick = {
                    onDisable()
                    onDismiss()
                },
                leadingIcon = {
                    Icon(
                        imageVector = Icons.Filled.VisibilityOff,
                        contentDescription = "Disable bundle"
                    )
                }
            )
        }

        // Delete — shown only for user-created bundles, not "Everything Else" (Req 22.5, 22.6, 22.7)
        if (isUserCreated && !isEverythingElse) {
            DropdownMenuItem(
                text = { Text("Delete") },
                onClick = {
                    onDelete()
                    onDismiss()
                },
                leadingIcon = {
                    Icon(
                        imageVector = Icons.Filled.Delete,
                        contentDescription = "Delete bundle"
                    )
                }
            )
        }
    }
}
