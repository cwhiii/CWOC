package com.cwoc.app.ui.screens.settings.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.FormatBold
import androidx.compose.material.icons.filled.FormatItalic
import androidx.compose.material.icons.filled.Link
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.unit.dp
import com.cwoc.app.ui.components.MarkdownRenderer
import com.cwoc.app.ui.components.cwocTextFieldColors

/**
 * Modal dialog for editing the email signature with markdown support.
 *
 * Features:
 * - Text editor area with markdown content
 * - Live-rendered preview below using MarkdownRenderer
 * - Bold/Italic/Link toolbar buttons that wrap selected text
 * - Confirm saves, Dismiss discards
 *
 * Requirements: 19.4, 19.5, 19.6, 19.7
 */
@Composable
fun SignatureEditorModal(
    currentSignature: String,
    onConfirm: (String) -> Unit,
    onDismiss: () -> Unit
) {
    var textFieldValue by remember {
        mutableStateOf(TextFieldValue(text = currentSignature))
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Edit Signature") },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth()
            ) {
                // Formatting toolbar
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(
                            MaterialTheme.colorScheme.surfaceVariant,
                            RoundedCornerShape(topStart = 4.dp, topEnd = 4.dp)
                        )
                        .padding(horizontal = 4.dp),
                    horizontalArrangement = Arrangement.Start,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    IconButton(
                        onClick = {
                            textFieldValue = wrapSelection(textFieldValue, "**", "**")
                        },
                        modifier = Modifier.size(36.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.FormatBold,
                            contentDescription = "Bold",
                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }

                    IconButton(
                        onClick = {
                            textFieldValue = wrapSelection(textFieldValue, "*", "*")
                        },
                        modifier = Modifier.size(36.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.FormatItalic,
                            contentDescription = "Italic",
                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }

                    IconButton(
                        onClick = {
                            textFieldValue = wrapSelection(textFieldValue, "[", "](url)")
                        },
                        modifier = Modifier.size(36.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Link,
                            contentDescription = "Link",
                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }

                // Text editor area
                OutlinedTextField(
                    value = textFieldValue,
                    onValueChange = { textFieldValue = it },
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(min = 120.dp, max = 200.dp),
                    placeholder = { Text("Enter your email signature (markdown supported)") },
                    colors = cwocTextFieldColors(),
                    textStyle = MaterialTheme.typography.bodyMedium,
                    shape = RoundedCornerShape(bottomStart = 4.dp, bottomEnd = 4.dp)
                )

                Spacer(modifier = Modifier.height(12.dp))

                // Preview label
                Text(
                    text = "Preview",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                Spacer(modifier = Modifier.height(4.dp))

                // Live-rendered preview
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(min = 60.dp, max = 150.dp)
                        .border(
                            width = 1.dp,
                            color = MaterialTheme.colorScheme.outline,
                            shape = RoundedCornerShape(4.dp)
                        )
                        .padding(8.dp)
                        .verticalScroll(rememberScrollState())
                ) {
                    if (textFieldValue.text.isBlank()) {
                        Text(
                            text = "No signature set",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f)
                        )
                    } else {
                        MarkdownRenderer(
                            markdown = textFieldValue.text,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = { onConfirm(textFieldValue.text) }) {
                Text("Confirm")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        },
        containerColor = MaterialTheme.colorScheme.surface
    )
}

/**
 * Wraps the currently selected text in the TextFieldValue with the given prefix and suffix.
 * If no text is selected (cursor position), inserts prefix+suffix at cursor and places
 * the cursor between them.
 */
private fun wrapSelection(
    textFieldValue: TextFieldValue,
    prefix: String,
    suffix: String
): TextFieldValue {
    val text = textFieldValue.text
    val selection = textFieldValue.selection

    return if (selection.collapsed) {
        // No selection — insert prefix+suffix at cursor, place cursor between them
        val cursorPos = selection.start
        val newText = text.substring(0, cursorPos) + prefix + suffix + text.substring(cursorPos)
        val newCursorPos = cursorPos + prefix.length
        TextFieldValue(
            text = newText,
            selection = TextRange(newCursorPos, newCursorPos)
        )
    } else {
        // Wrap selected text
        val selectedText = text.substring(selection.start, selection.end)
        val newText = text.substring(0, selection.start) +
                prefix + selectedText + suffix +
                text.substring(selection.end)
        // Place cursor at end of wrapped text
        val newCursorEnd = selection.start + prefix.length + selectedText.length + suffix.length
        TextFieldValue(
            text = newText,
            selection = TextRange(selection.start + prefix.length, newCursorEnd - suffix.length)
        )
    }
}
