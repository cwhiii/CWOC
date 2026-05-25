package com.cwoc.app.ui.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AudioFile
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.InsertDriveFile
import androidx.compose.material.icons.filled.PictureAsPdf
import androidx.compose.material.icons.filled.VideoFile
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.cwoc.app.ui.screens.editor.zones.AttachmentInfo
import com.cwoc.app.ui.theme.CwocDialogDefaults

/**
 * Dialog for selecting which attachment to print when a chit has multiple attachments.
 * If there's only one attachment, the caller should skip this dialog and print directly.
 */
@Composable
fun AttachmentPrintPickerDialog(
    attachments: List<AttachmentInfo>,
    onSelect: (AttachmentInfo) -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        modifier = CwocDialogDefaults.borderModifier,
        containerColor = CwocDialogDefaults.containerColor,
        title = { Text("Print Attachment", style = CwocDialogDefaults.titleStyle) },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Text(
                    text = "Select an attachment to print:",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(bottom = 8.dp)
                )
                attachments.forEach { attachment ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onSelect(attachment) }
                            .padding(vertical = 10.dp, horizontal = 4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = getAttachmentIcon(attachment.mimeType),
                            contentDescription = null,
                            modifier = Modifier.size(24.dp),
                            tint = MaterialTheme.colorScheme.primary
                        )
                        Spacer(modifier = Modifier.width(12.dp))
                        Text(
                            text = attachment.filename,
                            style = MaterialTheme.typography.bodyMedium,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }
            }
        },
        confirmButton = {},
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}

private fun getAttachmentIcon(mimeType: String?): ImageVector {
    val mime = mimeType?.lowercase() ?: ""
    return when {
        mime.startsWith("image/") -> Icons.Default.Image
        mime == "application/pdf" -> Icons.Default.PictureAsPdf
        mime.startsWith("video/") -> Icons.Default.VideoFile
        mime.startsWith("audio/") -> Icons.Default.AudioFile
        mime.startsWith("text/") || mime.contains("document") -> Icons.Default.Description
        else -> Icons.Default.InsertDriveFile
    }
}
