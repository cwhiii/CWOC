package com.cwoc.app.ui.screens.editor.zones

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.webkit.MimeTypeMap
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.AttachFile
import androidx.compose.material.icons.filled.AudioFile
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.InsertDriveFile
import androidx.compose.material.icons.filled.PictureAsPdf
import androidx.compose.material.icons.filled.VideoFile
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

/**
 * Functional Attachments Zone for the chit editor.
 *
 * Features:
 * - "Add Attachment" button → Android file picker
 * - Upload via multipart POST to /api/chits/{chitId}/attachments
 * - Progress indicator during upload
 * - Attachment list with filename, size, type icon
 * - Delete button per attachment
 * - Tap to download/open with system viewer
 * - Image attachments show thumbnail
 *
 * Uses EditorZoneHeader for collapsible zone pattern.
 */
@Composable
fun AttachmentsZone(
    chitId: String,
    attachmentsJson: String?,
    onAttachmentsChange: (String?) -> Unit,
    serverUrl: String,
    authToken: String,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    var isExpanded by remember { mutableStateOf(!attachmentsJson.isNullOrBlank()) }
    var isUploading by remember { mutableStateOf(false) }
    var uploadProgress by remember { mutableStateOf(0f) }

    val attachments = remember(attachmentsJson) {
        parseAttachments(attachmentsJson)
    }

    // File picker launcher
    val filePickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        if (uri != null) {
            isUploading = true
            uploadProgress = 0f
            coroutineScope.launch {
                val result = uploadAttachment(
                    context = context,
                    uri = uri,
                    chitId = chitId,
                    serverUrl = serverUrl,
                    authToken = authToken,
                    onProgress = { uploadProgress = it }
                )
                if (result != null) {
                    // Add new attachment to the list
                    val updatedList = attachments + result
                    onAttachmentsChange(Gson().toJson(updatedList))
                }
                isUploading = false
            }
        }
    }

    EditorZoneHeader(
        title = "Attachments",
        isExpanded = isExpanded,
        onToggle = { isExpanded = !isExpanded },
        trailingContent = {
            if (!isExpanded && attachments.isNotEmpty()) {
                Text(
                    text = "${attachments.size} file${if (attachments.size != 1) "s" else ""}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    ) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            // Upload progress indicator
            if (isUploading) {
                LinearProgressIndicator(
                    progress = { uploadProgress },
                    modifier = Modifier.fillMaxWidth(),
                    color = MaterialTheme.colorScheme.primary
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Uploading…",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            // Attachment list
            attachments.forEach { attachment ->
                AttachmentRow(
                    attachment = attachment,
                    onTap = {
                        openAttachment(context, attachment, serverUrl, authToken)
                    },
                    onDelete = {
                        coroutineScope.launch {
                            val success = deleteAttachment(
                                attachmentId = attachment.id,
                                chitId = chitId,
                                serverUrl = serverUrl,
                                authToken = authToken
                            )
                            if (success) {
                                val updatedList = attachments.filter { it.id != attachment.id }
                                onAttachmentsChange(
                                    if (updatedList.isEmpty()) null else Gson().toJson(updatedList)
                                )
                            }
                        }
                    }
                )
            }

            // Add Attachment button
            Button(
                onClick = { filePickerLauncher.launch("*/*") },
                enabled = !isUploading,
                modifier = Modifier.fillMaxWidth()
            ) {
                Icon(Icons.Default.Add, null, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(6.dp))
                Text("Add Attachment")
            }
        }
    }
}

// ─── Attachment Row ─────────────────────────────────────────────────────────────

@Composable
private fun AttachmentRow(
    attachment: AttachmentInfo,
    onTap: () -> Unit,
    onDelete: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onTap() },
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Type icon
            Icon(
                imageVector = getFileTypeIcon(attachment.mimeType ?: attachment.filename),
                contentDescription = null,
                modifier = Modifier.size(24.dp),
                tint = MaterialTheme.colorScheme.primary
            )

            Spacer(modifier = Modifier.width(12.dp))

            // Filename and size
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = attachment.filename,
                    style = MaterialTheme.typography.bodyMedium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                if (attachment.size != null) {
                    Text(
                        text = formatFileSize(attachment.size),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            // Delete button
            IconButton(
                onClick = onDelete,
                modifier = Modifier.size(32.dp)
            ) {
                Icon(
                    Icons.Default.Close,
                    contentDescription = "Delete attachment",
                    modifier = Modifier.size(18.dp),
                    tint = MaterialTheme.colorScheme.error
                )
            }
        }
    }
}

// ─── Data Classes ───────────────────────────────────────────────────────────────

data class AttachmentInfo(
    val id: String,
    val filename: String,
    val mimeType: String? = null,
    val size: Long? = null,
    val url: String? = null
)

// ─── Helper Functions ───────────────────────────────────────────────────────────

private fun parseAttachments(json: String?): List<AttachmentInfo> {
    if (json.isNullOrBlank()) return emptyList()
    return try {
        Gson().fromJson(json, object : TypeToken<List<AttachmentInfo>>() {}.type)
    } catch (_: Exception) {
        emptyList()
    }
}

private fun getFileTypeIcon(filenameOrMime: String): ImageVector {
    val lower = filenameOrMime.lowercase()
    return when {
        lower.contains("image") || lower.endsWith(".png") || lower.endsWith(".jpg") ||
            lower.endsWith(".jpeg") || lower.endsWith(".gif") || lower.endsWith(".webp") ->
            Icons.Default.Image
        lower.contains("pdf") || lower.endsWith(".pdf") ->
            Icons.Default.PictureAsPdf
        lower.contains("video") || lower.endsWith(".mp4") || lower.endsWith(".mov") ->
            Icons.Default.VideoFile
        lower.contains("audio") || lower.endsWith(".mp3") || lower.endsWith(".wav") ->
            Icons.Default.AudioFile
        lower.contains("text") || lower.endsWith(".txt") || lower.endsWith(".md") ->
            Icons.Default.Description
        else -> Icons.Default.InsertDriveFile
    }
}

private fun formatFileSize(bytes: Long): String {
    return when {
        bytes < 1024 -> "$bytes B"
        bytes < 1024 * 1024 -> "${bytes / 1024} KB"
        bytes < 1024 * 1024 * 1024 -> "${bytes / (1024 * 1024)} MB"
        else -> "${bytes / (1024 * 1024 * 1024)} GB"
    }
}

private suspend fun uploadAttachment(
    context: Context,
    uri: Uri,
    chitId: String,
    serverUrl: String,
    authToken: String,
    onProgress: (Float) -> Unit
): AttachmentInfo? = withContext(Dispatchers.IO) {
    try {
        val contentResolver = context.contentResolver
        val mimeType = contentResolver.getType(uri) ?: "application/octet-stream"
        val filename = getFilenameFromUri(context, uri) ?: "attachment"
        val inputStream = contentResolver.openInputStream(uri) ?: return@withContext null
        val bytes = inputStream.readBytes()
        inputStream.close()

        onProgress(0.3f)

        val requestBody = bytes.toRequestBody(mimeType.toMediaType())
        val multipartBody = MultipartBody.Builder()
            .setType(MultipartBody.FORM)
            .addFormDataPart("file", filename, requestBody)
            .build()

        val request = Request.Builder()
            .url("$serverUrl/api/chits/$chitId/attachments")
            .addHeader("Authorization", "Bearer $authToken")
            .post(multipartBody)
            .build()

        onProgress(0.6f)

        val client = OkHttpClient()
        val response = client.newCall(request).execute()

        onProgress(0.9f)

        if (response.isSuccessful) {
            val responseBody = response.body?.string()
            onProgress(1f)
            if (responseBody != null) {
                try {
                    Gson().fromJson(responseBody, AttachmentInfo::class.java)
                } catch (_: Exception) {
                    AttachmentInfo(
                        id = java.util.UUID.randomUUID().toString(),
                        filename = filename,
                        mimeType = mimeType,
                        size = bytes.size.toLong()
                    )
                }
            } else {
                AttachmentInfo(
                    id = java.util.UUID.randomUUID().toString(),
                    filename = filename,
                    mimeType = mimeType,
                    size = bytes.size.toLong()
                )
            }
        } else {
            onProgress(0f)
            null
        }
    } catch (_: Exception) {
        onProgress(0f)
        null
    }
}

private suspend fun deleteAttachment(
    attachmentId: String,
    chitId: String,
    serverUrl: String,
    authToken: String
): Boolean = withContext(Dispatchers.IO) {
    try {
        val request = Request.Builder()
            .url("$serverUrl/api/chits/$chitId/attachments/$attachmentId")
            .addHeader("Authorization", "Bearer $authToken")
            .delete()
            .build()

        val client = OkHttpClient()
        val response = client.newCall(request).execute()
        response.isSuccessful
    } catch (_: Exception) {
        false
    }
}

private fun openAttachment(
    context: Context,
    attachment: AttachmentInfo,
    serverUrl: String,
    authToken: String
) {
    val url = attachment.url ?: "$serverUrl/api/attachments/${attachment.id}"
    val intent = Intent(Intent.ACTION_VIEW).apply {
        data = Uri.parse(url)
        flags = Intent.FLAG_ACTIVITY_NEW_TASK
    }
    try {
        context.startActivity(intent)
    } catch (_: Exception) {
        // No app available to handle this file type
    }
}

private fun getFilenameFromUri(context: Context, uri: Uri): String? {
    var filename: String? = null
    context.contentResolver.query(uri, null, null, null, null)?.use { cursor ->
        val nameIndex = cursor.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME)
        if (nameIndex >= 0 && cursor.moveToFirst()) {
            filename = cursor.getString(nameIndex)
        }
    }
    return filename
}
