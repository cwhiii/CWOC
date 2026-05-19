package com.cwoc.app.ui.screens.email

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AttachFile
import androidx.compose.material.icons.filled.AudioFile
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.InsertDriveFile
import androidx.compose.material.icons.filled.PictureAsPdf
import androidx.compose.material.icons.filled.VideoFile
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken

/**
 * Attachment bar composable for the email compose/view zone.
 *
 * Displays a horizontally scrollable row of attachment chips. Each chip shows:
 * - Image attachments: actual thumbnail preview
 * - Non-image attachments: file type icon
 * - Filename (truncated)
 * - File size (formatted as KB/MB)
 *
 * Interactions:
 * - Tap: opens a preview modal (image preview or file info)
 * - Long-press: shows a context menu with "View" and "Download" options
 *
 * Validates: Requirements 56.1-56.6
 */
@Composable
fun AttachmentBar(
    attachmentsJson: String?,
    serverUrl: String,
    modifier: Modifier = Modifier
) {
    val attachments = remember(attachmentsJson) {
        parseAttachmentBarItems(attachmentsJson)
    }

    if (attachments.isEmpty()) return

    val context = LocalContext.current
    var previewAttachment by remember { mutableStateOf<AttachmentBarItem?>(null) }

    Column(modifier = modifier.fillMaxWidth()) {
        Text(
            text = "${attachments.size} attachment${if (attachments.size != 1) "s" else ""}",
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(bottom = 4.dp)
        )

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            attachments.forEach { attachment ->
                AttachmentChip(
                    attachment = attachment,
                    serverUrl = serverUrl,
                    onTap = { previewAttachment = attachment },
                    onView = {
                        val url = buildAttachmentUrl(attachment.url, serverUrl)
                        if (url != null) {
                            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                            context.startActivity(intent)
                        }
                    },
                    onDownload = {
                        val url = buildAttachmentUrl(attachment.url, serverUrl)
                        if (url != null) {
                            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                            context.startActivity(intent)
                        }
                    }
                )
            }
        }
    }

    // Preview modal
    if (previewAttachment != null) {
        AttachmentPreviewDialog(
            attachment = previewAttachment!!,
            serverUrl = serverUrl,
            onDismiss = { previewAttachment = null }
        )
    }
}

/**
 * A single attachment chip displaying icon/thumbnail, filename, and file size.
 * Tap opens preview; long-press shows context menu.
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun AttachmentChip(
    attachment: AttachmentBarItem,
    serverUrl: String,
    onTap: () -> Unit,
    onView: () -> Unit,
    onDownload: () -> Unit
) {
    var showContextMenu by remember { mutableStateOf(false) }

    Box {
        Surface(
            shape = RoundedCornerShape(8.dp),
            tonalElevation = 1.dp,
            modifier = Modifier
                .combinedClickable(
                    onClick = onTap,
                    onLongClick = { showContextMenu = true }
                )
        ) {
            Row(
                modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                // Icon or thumbnail
                if (attachment.isImage) {
                    val imageUrl = buildAttachmentUrl(attachment.url, serverUrl)
                    AsyncImage(
                        model = ImageRequest.Builder(LocalContext.current)
                            .data(imageUrl)
                            .crossfade(true)
                            .size(40)
                            .build(),
                        contentDescription = attachment.filename,
                        modifier = Modifier
                            .size(36.dp)
                            .clip(RoundedCornerShape(4.dp)),
                        contentScale = ContentScale.Crop
                    )
                } else {
                    Icon(
                        imageVector = fileTypeIcon(attachment.contentType, attachment.filename),
                        contentDescription = attachment.contentType ?: "File",
                        modifier = Modifier.size(28.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                // Filename and size
                Column {
                    Text(
                        text = attachment.filename,
                        style = MaterialTheme.typography.bodySmall,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.width(120.dp)
                    )
                    if (attachment.size != null && attachment.size > 0) {
                        Text(
                            text = formatFileSize(attachment.size),
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        }

        // Context menu (View / Download)
        DropdownMenu(
            expanded = showContextMenu,
            onDismissRequest = { showContextMenu = false }
        ) {
            DropdownMenuItem(
                text = { Text("View") },
                onClick = {
                    showContextMenu = false
                    onView()
                }
            )
            DropdownMenuItem(
                text = { Text("Download") },
                onClick = {
                    showContextMenu = false
                    onDownload()
                }
            )
        }
    }
}

/**
 * Preview dialog for an attachment.
 * Image attachments show the full image; non-image show file info.
 */
@Composable
private fun AttachmentPreviewDialog(
    attachment: AttachmentBarItem,
    serverUrl: String,
    onDismiss: () -> Unit
) {
    val context = LocalContext.current

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Surface(
            shape = RoundedCornerShape(16.dp),
            tonalElevation = 6.dp,
            modifier = Modifier
                .fillMaxWidth(0.9f)
                .padding(16.dp)
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                // Title
                Text(
                    text = attachment.filename,
                    style = MaterialTheme.typography.titleMedium,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )

                Spacer(modifier = Modifier.height(12.dp))

                if (attachment.isImage) {
                    // Show full image preview
                    val imageUrl = buildAttachmentUrl(attachment.url, serverUrl)
                    AsyncImage(
                        model = ImageRequest.Builder(context)
                            .data(imageUrl)
                            .crossfade(true)
                            .build(),
                        contentDescription = attachment.filename,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(300.dp)
                            .clip(RoundedCornerShape(8.dp)),
                        contentScale = ContentScale.Fit
                    )
                } else {
                    // Show file info for non-image
                    Icon(
                        imageVector = fileTypeIcon(attachment.contentType, attachment.filename),
                        contentDescription = null,
                        modifier = Modifier.size(64.dp),
                        tint = MaterialTheme.colorScheme.primary
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    if (attachment.contentType != null) {
                        Text(
                            text = "Type: ${attachment.contentType}",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }

                if (attachment.size != null && attachment.size > 0) {
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "Size: ${formatFileSize(attachment.size)}",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Action buttons
                Row(
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Surface(
                        onClick = {
                            val url = buildAttachmentUrl(attachment.url, serverUrl)
                            if (url != null) {
                                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                                context.startActivity(intent)
                            }
                            onDismiss()
                        },
                        shape = RoundedCornerShape(8.dp),
                        color = MaterialTheme.colorScheme.primary
                    ) {
                        Text(
                            text = "Open",
                            modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                            color = MaterialTheme.colorScheme.onPrimary
                        )
                    }

                    Surface(
                        onClick = onDismiss,
                        shape = RoundedCornerShape(8.dp),
                        color = MaterialTheme.colorScheme.surfaceVariant
                    ) {
                        Text(
                            text = "Close",
                            modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        }
    }
}

// ─── Helper Functions ────────────────────────────────────────────────────────────

/**
 * Data class representing a parsed attachment item.
 */
data class AttachmentBarItem(
    val filename: String,
    val contentType: String?,
    val size: Long?,
    val url: String?
) {
    val isImage: Boolean
        get() = contentType?.startsWith("image/") == true ||
            filename.lowercase().let {
                it.endsWith(".jpg") || it.endsWith(".jpeg") || it.endsWith(".png") ||
                    it.endsWith(".gif") || it.endsWith(".webp") || it.endsWith(".bmp")
            }
}

/**
 * Parses the attachments JSON field into a list of AttachmentBarItem objects.
 * The attachments field is a JSON array of objects with filename, content_type, size, url.
 */
private fun parseAttachmentBarItems(attachmentsJson: String?): List<AttachmentBarItem> {
    if (attachmentsJson.isNullOrBlank() || attachmentsJson == "[]" || attachmentsJson == "null") {
        return emptyList()
    }
    return try {
        val gson = Gson()
        val type = object : TypeToken<List<Map<String, Any?>>>() {}.type
        val parsed: List<Map<String, Any?>> = gson.fromJson(attachmentsJson, type)
        parsed.mapNotNull { map ->
            val filename = (map["filename"] as? String)
                ?: (map["name"] as? String)
                ?: return@mapNotNull null
            AttachmentBarItem(
                filename = filename,
                contentType = map["content_type"] as? String ?: map["contentType"] as? String,
                size = (map["size"] as? Number)?.toLong(),
                url = map["url"] as? String
            )
        }
    } catch (_: Exception) {
        emptyList()
    }
}

/**
 * Builds the full URL for an attachment, prepending the server URL if needed.
 */
private fun buildAttachmentUrl(url: String?, serverUrl: String): String? {
    if (url.isNullOrBlank()) return null
    return if (url.startsWith("http://") || url.startsWith("https://")) {
        url
    } else {
        "$serverUrl$url"
    }
}

/**
 * Returns the appropriate Material icon for a given file type.
 */
private fun fileTypeIcon(contentType: String?, filename: String): ImageVector {
    // Check content type first
    if (contentType != null) {
        return when {
            contentType.startsWith("image/") -> Icons.Filled.Image
            contentType.startsWith("video/") -> Icons.Filled.VideoFile
            contentType.startsWith("audio/") -> Icons.Filled.AudioFile
            contentType == "application/pdf" -> Icons.Filled.PictureAsPdf
            contentType.contains("document") || contentType.contains("text") -> Icons.Filled.Description
            contentType.contains("spreadsheet") || contentType.contains("excel") -> Icons.Filled.Description
            contentType.contains("presentation") || contentType.contains("powerpoint") -> Icons.Filled.Description
            else -> Icons.Filled.InsertDriveFile
        }
    }

    // Fallback to file extension
    val ext = filename.substringAfterLast('.', "").lowercase()
    return when (ext) {
        "pdf" -> Icons.Filled.PictureAsPdf
        "jpg", "jpeg", "png", "gif", "webp", "bmp", "svg" -> Icons.Filled.Image
        "mp4", "avi", "mov", "mkv", "webm" -> Icons.Filled.VideoFile
        "mp3", "wav", "ogg", "flac", "aac" -> Icons.Filled.AudioFile
        "doc", "docx", "txt", "rtf", "odt" -> Icons.Filled.Description
        "xls", "xlsx", "csv", "ods" -> Icons.Filled.Description
        "ppt", "pptx", "odp" -> Icons.Filled.Description
        "zip", "rar", "7z", "tar", "gz" -> Icons.Filled.AttachFile
        else -> Icons.Filled.InsertDriveFile
    }
}

/**
 * Formats a file size in bytes to a human-readable string.
 * Examples: "1.2 MB", "450 KB", "128 B"
 */
private fun formatFileSize(bytes: Long): String {
    return when {
        bytes >= 1_048_576 -> String.format("%.1f MB", bytes / 1_048_576.0)
        bytes >= 1_024 -> String.format("%.0f KB", bytes / 1_024.0)
        else -> "$bytes B"
    }
}
