package com.cwoc.app.ui.components

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

/**
 * D3: Quick-edit bottom sheet for notes.
 * Opens as a modal bottom sheet with the note title and content editable inline.
 * Equivalent to the web's shift+click quick-edit modal.
 *
 * @param title Current note title
 * @param content Current note content (markdown)
 * @param onSave Callback with (newTitle, newContent) when user saves
 * @param onDismiss Callback when sheet is dismissed without saving
 * @param onOpenFullEditor Callback to navigate to the full editor
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun QuickEditSheet(
    title: String,
    content: String,
    onSave: (String, String) -> Unit,
    onDismiss: () -> Unit,
    onOpenFullEditor: () -> Unit
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var editTitle by remember { mutableStateOf(title) }
    var editContent by remember { mutableStateOf(content) }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = MaterialTheme.colorScheme.surface
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp)
        ) {
            // Title field
            OutlinedTextField(
                value = editTitle,
                onValueChange = { editTitle = it },
                label = { Text("Title") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
                textStyle = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                colors = cwocTextFieldColors()
            )

            Spacer(modifier = Modifier.height(8.dp))

            // Content field (expandable)
            OutlinedTextField(
                value = editContent,
                onValueChange = { editContent = it },
                label = { Text("Notes (markdown)") },
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = 150.dp, max = 400.dp),
                textStyle = MaterialTheme.typography.bodyMedium,
                colors = cwocTextFieldColors()
            )

            Spacer(modifier = Modifier.height(12.dp))

            // Action buttons
            androidx.compose.foundation.layout.Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = androidx.compose.foundation.layout.Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                TextButton(onClick = onOpenFullEditor) {
                    Text("Open Full Editor")
                }
                androidx.compose.foundation.layout.Row {
                    TextButton(onClick = onDismiss) {
                        Text("Cancel")
                    }
                    CwocPrimaryButton(onClick = {
                        onSave(editTitle, editContent)
                    }) {
                        Text("Save")
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}
