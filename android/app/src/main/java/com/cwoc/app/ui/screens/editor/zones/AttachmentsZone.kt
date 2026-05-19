package com.cwoc.app.ui.screens.editor.zones

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.Toast
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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.AudioFile
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.FolderZip
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.InsertDriveFile
import androidx.compose.material.icons.filled.PictureAsPdf
import androidx.compose.material.icons.filled.Slideshow
import androidx.compose.material.icons.filled.TableChart
import androidx.compose.material.icons.filled.VideoFile
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import com.google.gson.Gson
import com.google.gson.annotations.SerializedName
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File

/**
 * Functional Attachments Zone for the chit editor.
 *
 * Matches web behavior:
 * - Uploads go to server immediately but are tracked as "pending"
 * - If user exits without saving, pending uploads are rolled back (deleted from server)
 * - Deletes are staged locally until save — server file stays until commit
 * - Pending uploads that are deleted are removed from server immediately
 * - "Save first" guard for new unsaved chits
 * - Delete confirmation dialog
 * - Multi-file upload support
 * - Auto-expand zone after upload
 * - 413-specific error messages
 * - Download via cache file + FileProvider (handles auth)
 */
@Composable
fun AttachmentsZone(
    chitId: String,
    attachmentsJson: String?,
    onAttachmentsChange: (String?) -> Unit,
    serverUrl: String,
    authToken: String,
    isNewChit: Boolean = false,
    onCommitAttachments: ((suspend () -> Unit)?) -> Unit = {},
    onRollbackAttachments: ((suspend () -> Unit)?) -> Unit = {},
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    var isExpanded by remember { mutableStateOf(!attachmentsJson.isNullOrBlank()) }
    var isUploading by remember { mutableStateOf(false) }
    var uploadProgress by remember { mutableStateOf(0f) }
    var deleteConfirmAttachment by remember { mutableStateOf<AttachmentInfo?>(null) }

    // Staged operations — matching web's _pendingUploads and _pendingDeletes
    val pendingUploads = remember { mutableStateListOf<String>() }
    val pendingDeletes = remember { mutableStateListOf<String>() }

    val attachments = remember(attachmentsJson) {
        parseAttachments(attachmentsJson)
    }

    // Shared OkHttpClient (reused across calls)
    val httpClient = remember { OkHttpClient() }

    // Register commit/rollback callbacks with the parent editor
    // Commit: delete pending-delete files from server
    onCommitAttachments {
        for (id in pendingDeletes.toList()) {
            try {
                val request = Request.Builder()
                    .url("$serverUrl/api/chits/$chitId/attachments/$id")
                    .addHeader("Authorization", "Bearer $authToken")
                    .delete()
                    .build()
                withContext(Dispatchers.IO) { httpClient.newCall(request).execute() }
            } catch (_: Exception) { /* best effort */ }
        }
        pendingUploads.clear()
        pendingDeletes.clear()
    }

    // Rollback: delete pending-upload files from server (they were never "saved")
    onRollbackAttachments {
        for (id in pendingUploads.toList()) {
            try {
                val request = Request.Builder()
                    .url("$serverUrl/api/chits/$chitId/attachments/$id")
                    .addHeader("Authorization", "Bearer $authToken")
                    .delete()
                    .build()
                withContext(Dispatchers.IO) { httpClient.newCall(request).execute() }
            } catch (_: Exception) { /* best effort */ }
        }
        pendingUploads.clear()
        pendingDeletes.clear()
    }

    // Multi-file picker launcher
    val filePickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.OpenMultipleDocuments()
    ) { uris: List<Uri> ->
        if (uris.isNotEmpty()) {
            if (chitId.isBlank() || isNewChit) {
                Toast.makeText(context, "Save the chit first before uploading attachments.", Toast.LENGTH_LONG).show()
                return@rememberLauncherForActivityResult
            }
            isUploading = true
            uploadProgress = 0f
            coroutineScope.launch {
                var successCount = 0
                var currentList = attachments.toMutableList()
                for ((index, uri) in uris.withIndex()) {
                    uploadProgress = (index.toFloat() / uris.size) * 0.9f
                    val result = uploadAttachment(
                        context = context,
                        uri = uri,
                        chitId = chitId,
                        serverUrl = serverUrl,
                        authToken = authToken,
                        httpClient = httpClient,
                        onProgress = { /* individual progress not shown for batch */ }
                    )
                    if (result != null) {
                        currentList.add(result)
                        pendingUploads.add(result.id)
                        successCount++
                    }
                }
                uploadProgress = 1f
                if (successCount > 0) {
                    onAttachmentsChange(Gson().toJson(currentList))
                    Toast.makeText(context, "$successCount file(s) uploaded", Toast.LENGTH_SHORT).show()
                    // Auto-expand zone after upload
                    isExpanded = true
                }
                isUploading = false
            }
        }
    }

    // Delete confirmation dialog
    deleteConfirmAttachment?.let { att ->
        AlertDialog(
            onDismissRequest = { deleteConfirmAttachment = null },
            title = { Text("Delete Attachment") },
            text = { Text("Delete attachment \"${att.filename}\"?") },
            confirmButton = {
                Button(
                    onClick = {
                        deleteConfirmAttachment = null
                        // Staged delete logic matching web:
                        val wasPendingUpload = att.id in pendingUploads
                        if (wasPendingUpload) {
                            // Pending upload — delete from server immediately (never part of saved state)
                            pendingUploads.remove(att.id)
                            coroutineScope.launch {
                                withContext(Dispatchers.IO) {
                                    try {
                                        val request = Request.Builder()
                                            .url("$serverUrl/api/chits/$chitId/attachments/${att.id}")
                                            .addHeader("Authorization", "Bearer $authToken")
                                            .delete()
                                            .build()
                                        httpClient.newCall(request).execute()
                                    } catch (_: Exception) { /* best effort */ }
                                }
                            }
                        } else {
                            // Pre-existing attachment — stage for deletion on save
                            pendingDeletes.add(att.id)
                        }
                        // Remove from local display
                        val updatedList = attachments.filter { it.id != att.id }
                        onAttachmentsChange(
                            if (updatedList.isEmpty()) null else Gson().toJson(updatedList)
                        )
                        Toast.makeText(context, "Attachment removed", Toast.LENGTH_SHORT).show()
                    },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.error
                    )
                ) {
                    Text("🗑️ Delete")
                }
            },
            dismissButton = {
                TextButton(onClick = { deleteConfirmAttachment = null }) {
                    Text("Cancel")
                }
            }
        )
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
            if (attachments.isEmpty() && !isUploading) {
                Text(
                    text = "No attachments yet.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f),
                    modifier = Modifier.padding(vertical = 4.dp)
                )
            }

            attachments.forEach { attachment ->
                AttachmentRow(
                    attachment = attachment,
                    onTap = {
                        // Download and open with system viewer (handles auth)
                        coroutineScope.launch {
                            openAttachmentWithAuth(context, attachment, chitId, serverUrl, authToken, httpClient)
                        }
                    },
                    onDelete = {
                        deleteConfirmAttachment = attachment
                    }
                )
            }

            // Add Attachment button
            Button(
                onClick = {
                    if (chitId.isBlank() || isNewChit) {
                        Toast.makeText(context, "Save the chit first before uploading attachments.", Toast.LENGTH_LONG).show()
                    } else {
                        filePickerLauncher.launch(arrayOf("*/*"))
                    }
                },
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
    @SerializedName("mime_type")
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
        lower.contains("video") || lower.endsWith(".mp4") || lower.endsWith(".mov") ||
            lower.endsWith(".avi") || lower.endsWith(".mkv") ->
            Icons.Default.VideoFile
        lower.contains("audio") || lower.endsWith(".mp3") || lower.endsWith(".wav") ||
            lower.endsWith(".ogg") || lower.endsWith(".flac") ->
            Icons.Default.AudioFile
        lower.contains("zip") || lower.contains("compressed") || lower.contains("archive") ||
            lower.endsWith(".gz") || lower.endsWith(".tar") || lower.endsWith(".rar") ||
            lower.endsWith(".7z") ->
            Icons.Default.FolderZip
        lower.contains("spreadsheet") || lower.contains("excel") || lower.contains("csv") ||
            lower.endsWith(".xlsx") || lower.endsWith(".xls") || lower.endsWith(".csv") ->
            Icons.Default.TableChart
        lower.contains("presentation") || lower.contains("powerpoint") ||
            lower.endsWith(".pptx") || lower.endsWith(".ppt") ->
            Icons.Default.Slideshow
        lower.contains("document") || lower.contains("word") ||
            lower.endsWith(".docx") || lower.endsWith(".doc") ->
            Icons.Default.Description
        lower.contains("text") || lower.endsWith(".txt") || lower.endsWith(".md") ->
            Icons.Default.Description
        else -> Icons.Default.InsertDriveFile
    }
}

private fun formatFileSize(bytes: Long): String {
    return when {
        bytes < 1024 -> "$bytes B"
        bytes < 1024 * 1024 -> String.format("%.1f KB", bytes / 1024.0)
        bytes < 1024 * 1024 * 1024 -> String.format("%.1f MB", bytes / (1024.0 * 1024.0))
        else -> String.format("%.1f GB", bytes / (1024.0 * 1024.0 * 1024.0))
    }
}

private suspend fun uploadAttachment(
    context: Context,
    uri: Uri,
    chitId: String,
    serverUrl: String,
    authToken: String,
    httpClient: OkHttpClient,
    onProgress: (Float) -> Unit
): AttachmentInfo? = withContext(Dispatchers.IO) {
    try {
        val contentResolver = context.contentResolver
        val mimeType = contentResolver.getType(uri) ?: "application/octet-stream"
        val filename = getFilenameFromUri(context, uri) ?: "attachment"
        val inputStream = contentResolver.openInputStream(uri) ?: return@withContext null
        val bytes = inputStream.readBytes()
        inputStream.close()

        // Guard: empty file
        if (bytes.isEmpty()) {
            withContext(Dispatchers.Main) {
                Toast.makeText(context, "File appears empty: $filename", Toast.LENGTH_LONG).show()
            }
            return@withContext null
        }

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

        val response = httpClient.newCall(request).execute()

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
            val errBody = response.body?.string()
            val fileSizeMB = String.format("%.1f", bytes.size / (1024.0 * 1024.0))
            val errMsg = if (response.code == 413) {
                // 413-specific message matching web
                "📎 \"$filename\" is too large ($fileSizeMB MB). Reduce the file size or increase the limit in Settings."
            } else {
                val detail = try {
                    val obj = Gson().fromJson(errBody, Map::class.java)
                    obj?.get("detail")?.toString()
                } catch (_: Exception) { null }
                "📎 Could not upload \"$filename\" ($fileSizeMB MB) — ${detail ?: "HTTP ${response.code}"}"
            }
            withContext(Dispatchers.Main) {
                Toast.makeText(context, errMsg, Toast.LENGTH_LONG).show()
            }
            null
        }
    } catch (e: Exception) {
        onProgress(0f)
        withContext(Dispatchers.Main) {
            Toast.makeText(context, "Upload error: ${e.message}", Toast.LENGTH_LONG).show()
        }
        null
    }
}

/**
 * Download an attachment with auth and open with system viewer.
 * Downloads to a cache file, then uses FileProvider to share with external apps.
 */
private suspend fun openAttachmentWithAuth(
    context: Context,
    attachment: AttachmentInfo,
    chitId: String,
    serverUrl: String,
    authToken: String,
    httpClient: OkHttpClient
) {
    withContext(Dispatchers.Main) {
        Toast.makeText(context, "Opening ${attachment.filename}…", Toast.LENGTH_SHORT).show()
    }

    withContext(Dispatchers.IO) {
        try {
            val request = Request.Builder()
                .url("$serverUrl/api/chits/$chitId/attachments/${attachment.id}")
                .addHeader("Authorization", "Bearer $authToken")
                .get()
                .build()

            val response = httpClient.newCall(request).execute()
            if (!response.isSuccessful) {
                withContext(Dispatchers.Main) {
                    Toast.makeText(context, "Download failed (HTTP ${response.code})", Toast.LENGTH_SHORT).show()
                }
                return@withContext
            }

            val bytes = response.body?.bytes() ?: return@withContext

            // Write to cache directory
            val cacheDir = File(context.cacheDir, "attachments")
            cacheDir.mkdirs()
            val file = File(cacheDir, attachment.filename)
            file.writeBytes(bytes)

            // Open with FileProvider
            val uri = FileProvider.getUriForFile(
                context,
                "${context.packageName}.fileprovider",
                file
            )

            val mimeType = attachment.mimeType ?: "application/octet-stream"
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, mimeType)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }

            withContext(Dispatchers.Main) {
                try {
                    context.startActivity(intent)
                } catch (_: Exception) {
                    Toast.makeText(context, "No app available to open this file type", Toast.LENGTH_SHORT).show()
                }
            }
        } catch (e: Exception) {
            withContext(Dispatchers.Main) {
                Toast.makeText(context, "Failed to open: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }
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
