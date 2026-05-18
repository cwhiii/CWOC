package com.cwoc.app.ui.components

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

/**
 * Options for editing a recurring event.
 */
enum class RecurringEditOption {
    THIS_INSTANCE_ONLY,
    ALL_EVENTS,
    THIS_AND_FOLLOWING,
    CANCEL
}

/**
 * Dialog shown when editing a recurring chit.
 * Asks the user how the edit should be applied:
 * - "This instance only" — adds an exception date
 * - "All events" — modifies the recurrence rule
 * - "This and all following" — splits the recurrence
 * - "Cancel" — dismisses without action
 *
 * @param onOptionSelected Callback with the selected RecurringEditOption
 * @param onDismiss Callback when dialog is dismissed (equivalent to Cancel)
 */
@Composable
fun RecurringEditDialog(
    onOptionSelected: (RecurringEditOption) -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Edit Recurring Event") },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 8.dp)
            ) {
                Text(
                    text = "How would you like to apply this change?",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        },
        confirmButton = {
            Column {
                TextButton(
                    onClick = { onOptionSelected(RecurringEditOption.THIS_INSTANCE_ONLY) },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("This instance only")
                }
                TextButton(
                    onClick = { onOptionSelected(RecurringEditOption.ALL_EVENTS) },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("All events")
                }
                TextButton(
                    onClick = { onOptionSelected(RecurringEditOption.THIS_AND_FOLLOWING) },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("This and all following")
                }
            }
        },
        dismissButton = {
            TextButton(onClick = {
                onOptionSelected(RecurringEditOption.CANCEL)
                onDismiss()
            }) {
                Text("Cancel")
            }
        },
        containerColor = MaterialTheme.colorScheme.surface
    )
}
