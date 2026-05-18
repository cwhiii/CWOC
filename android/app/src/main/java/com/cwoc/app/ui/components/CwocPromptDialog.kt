package com.cwoc.app.ui.components

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

/**
 * BB3: Reusable text input prompt dialog.
 * Equivalent to the web's `cwocPromptModal(title, placeholder, onConfirm)`.
 *
 * Shows a dialog with a title, text input field, and Cancel/Confirm buttons.
 *
 * @param title Dialog title
 * @param placeholder Placeholder text for the input field
 * @param initialValue Initial value for the input field
 * @param onConfirm Callback with the entered text when Confirm is pressed
 * @param onDismiss Callback when Cancel is pressed or dialog is dismissed
 * @param confirmLabel Label for the confirm button (default "Confirm")
 * @param cancelLabel Label for the cancel button (default "Cancel")
 */
@Composable
fun CwocPromptDialog(
    title: String,
    placeholder: String = "",
    initialValue: String = "",
    onConfirm: (String) -> Unit,
    onDismiss: () -> Unit,
    confirmLabel: String = "Confirm",
    cancelLabel: String = "Cancel"
) {
    var inputValue by remember { mutableStateOf(initialValue) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = {
            Column {
                OutlinedTextField(
                    value = inputValue,
                    onValueChange = { inputValue = it },
                    modifier = Modifier.fillMaxWidth(),
                    placeholder = { Text(placeholder) },
                    singleLine = true,
                    colors = cwocTextFieldColors()
                )
                Spacer(modifier = Modifier.height(4.dp))
            }
        },
        confirmButton = {
            TextButton(
                onClick = { onConfirm(inputValue) },
                enabled = inputValue.isNotBlank()
            ) {
                Text(confirmLabel)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(cancelLabel)
            }
        },
        containerColor = MaterialTheme.colorScheme.surface
    )
}
