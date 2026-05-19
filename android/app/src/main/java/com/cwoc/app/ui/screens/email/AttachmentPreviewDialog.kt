package com.cwoc.app.ui.screens.email

import android.graphics.Bitmap
import android.graphics.pdf.PdfRenderer
import android.os.ParcelFileDescriptor
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.NavigateBefore
import androidx.compose.material.icons.filled.NavigateNext
import androidx.compose.material.icons.filled.OpenInNew
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import coil.compose.AsyncImage
import coil.request.ImageRequest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File

// ─── Attachment Preview Dialog ────────────────────────────────────────────────

/**
 * Full-featured attachment preview dialog with MIME-type-based content rendering.
 *
 * Supports:
 * - image (all types) → Coil AsyncImage with pinch-to-zoom and pan gestures
 * - text/plain → Scrollable monospace text display
 * - application/pdf → Android PdfRenderer with page-by-page navigation
 * - Other types → "Cannot preview" message with "Open with external app" button
 *
 * Header displays: filename, formatted size, MIME type badge.
 *
 * Validates: Requirements 14.1, 14.2, 14.3, 14.4
 */
@Composable
fun AttachmentPreviewDialog(
    attachment: AttachmentBarItem,
    serverUrl: String,
    authToken: String,
    onDismiss: () -> Unit,
    onOpenExternal: () -> Unit
) {
    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(
            usePlatformDefaultWidth = false,
            dismissOnBackPress = true,
            dismissOnClickOutside = true
        )
    ) {
        Surface(
            shape = RoundedCornerShape(16.dp),
            tonalElevation = 6.dp,
            modifier = Modifier
                .fillMaxWidth(0.95f)
                .padding(16.dp)
        ) {
            Column(
                modifier = Modifier.padding(16.dp)
            ) {
                // ─── Header: filename, size, MIME type badge ──────────────────
                AttachmentPreviewHeader(
                    attachment = attachment,
                    onDismiss = onDismiss
                )

                Spacer(modifier = Modifier.height(12.dp))

                // ─── Content: MIME-type-based preview ─────────────────────────
                AttachmentPreviewContent(
                    attachment = attachment,
                    serverUrl = serverUrl,
                    authToken = authToken,
                    onOpenExternal = onOpenExternal
                )
            }
        }
    }
}

// ─── Header ───────────────────────────────────────────────────────────────────

@Composable
private fun AttachmentPreviewHeader(
    attachment: AttachmentBarItem,
    onDismiss: () -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        // Filename and metadata
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = attachment.filename,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )

            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                // Size
                if (attachment.size != null && attachment.size > 0) {
                    Text(
                        text = formatAttachmentSize(attachment.size),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                // MIME type badge
                if (attachment.contentType != null) {
                    Surface(
                        shape = RoundedCornerShape(4.dp),
                        color = MaterialTheme.colorScheme.secondaryContainer,
                        modifier = Modifier.padding(vertical = 2.dp)
                    ) {
                        Text(
                            text = attachment.contentType,
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSecondaryContainer,
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                        )
                    }
                }
            }
        }

        // Close button
        IconButton(onClick = onDismiss) {
            Icon(
                imageVector = Icons.Default.Close,
                contentDescription = "Close preview"
            )
        }
    }
}

// ─── Content Router ───────────────────────────────────────────────────────────

@Composable
private fun AttachmentPreviewContent(
    attachment: AttachmentBarItem,
    serverUrl: String,
    authToken: String,
    onOpenExternal: () -> Unit
) {
    val contentType = attachment.contentType?.lowercase() ?: ""

    when {
        contentType.startsWith("image/") -> {
            ImagePreviewContent(
                attachment = attachment,
                serverUrl = serverUrl,
                authToken = authToken
            )
        }
        contentType == "text/plain" -> {
            TextPreviewContent(
                attachment = attachment,
                serverUrl = serverUrl,
                authToken = authToken
            )
        }
        contentType == "application/pdf" -> {
            PdfPreviewContent(
                attachment = attachment,
                serverUrl = serverUrl,
                authToken = authToken
            )
        }
        else -> {
            UnsupportedPreviewContent(
                attachment = attachment,
                onOpenExternal = onOpenExternal
            )
        }
    }
}

// ─── Image Preview (zoom/pan) ─────────────────────────────────────────────────

@Composable
private fun ImagePreviewContent(
    attachment: AttachmentBarItem,
    serverUrl: String,
    authToken: String
) {
    var scale by remember { mutableFloatStateOf(1f) }
    var offset by remember { mutableStateOf(Offset.Zero) }

    val imageUrl = buildFullAttachmentUrl(attachment.url, serverUrl)

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 200.dp, max = 400.dp)
            .clip(RoundedCornerShape(8.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f))
            .pointerInput(Unit) {
                detectTransformGestures { _, pan, zoom, _ ->
                    scale = (scale * zoom).coerceIn(0.5f, 5f)
                    offset = Offset(
                        x = offset.x + pan.x,
                        y = offset.y + pan.y
                    )
                }
            },
        contentAlignment = Alignment.Center
    ) {
        AsyncImage(
            model = ImageRequest.Builder(LocalContext.current)
                .data(imageUrl)
                .addHeader("Authorization", "Bearer $authToken")
                .crossfade(true)
                .build(),
            contentDescription = attachment.filename,
            modifier = Modifier
                .fillMaxSize()
                .graphicsLayer(
                    scaleX = scale,
                    scaleY = scale,
                    translationX = offset.x,
                    translationY = offset.y
                ),
            contentScale = ContentScale.Fit
        )
    }

    // Reset zoom hint
    if (scale != 1f) {
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = "Pinch to zoom • Double-tap to reset",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

// ─── Text Preview (monospace, scrollable) ─────────────────────────────────────

@Composable
private fun TextPreviewContent(
    attachment: AttachmentBarItem,
    serverUrl: String,
    authToken: String
) {
    var textContent by remember { mutableStateOf<String?>(null) }
    var isLoading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }

    // Fetch text content
    LaunchedEffect(attachment.url) {
        isLoading = true
        error = null
        try {
            val url = buildFullAttachmentUrl(attachment.url, serverUrl) ?: run {
                error = "No URL available"
                isLoading = false
                return@LaunchedEffect
            }
            textContent = withContext(Dispatchers.IO) {
                val client = OkHttpClient()
                val request = Request.Builder()
                    .url(url)
                    .addHeader("Authorization", "Bearer $authToken")
                    .get()
                    .build()
                val response = client.newCall(request).execute()
                if (response.isSuccessful) {
                    response.body?.string()
                } else {
                    throw Exception("HTTP ${response.code}")
                }
            }
            isLoading = false
        } catch (e: Exception) {
            error = "Failed to load: ${e.message}"
            isLoading = false
        }
    }

    when {
        isLoading -> {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(200.dp),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(modifier = Modifier.size(32.dp))
            }
        }
        error != null -> {
            Text(
                text = error!!,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.error
            )
        }
        textContent != null -> {
            Surface(
                shape = RoundedCornerShape(8.dp),
                color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f),
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    text = textContent!!,
                    style = MaterialTheme.typography.bodySmall.copy(
                        fontFamily = FontFamily.Monospace,
                        fontSize = 12.sp,
                        lineHeight = 18.sp
                    ),
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(max = 350.dp)
                        .verticalScroll(rememberScrollState())
                        .padding(12.dp)
                )
            }
        }
    }
}

// ─── PDF Preview (PdfRenderer, page-by-page) ──────────────────────────────────

@Composable
private fun PdfPreviewContent(
    attachment: AttachmentBarItem,
    serverUrl: String,
    authToken: String
) {
    val context = LocalContext.current
    var pdfBitmap by remember { mutableStateOf<Bitmap?>(null) }
    var currentPage by remember { mutableIntStateOf(0) }
    var totalPages by remember { mutableIntStateOf(0) }
    var isLoading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var pdfFile by remember { mutableStateOf<File?>(null) }
    var renderer by remember { mutableStateOf<PdfRenderer?>(null) }

    // Download PDF and initialize renderer
    LaunchedEffect(attachment.url) {
        isLoading = true
        error = null
        try {
            val url = buildFullAttachmentUrl(attachment.url, serverUrl) ?: run {
                error = "No URL available"
                isLoading = false
                return@LaunchedEffect
            }
            val file = withContext(Dispatchers.IO) {
                val client = OkHttpClient()
                val request = Request.Builder()
                    .url(url)
                    .addHeader("Authorization", "Bearer $authToken")
                    .get()
                    .build()
                val response = client.newCall(request).execute()
                if (!response.isSuccessful) {
                    throw Exception("HTTP ${response.code}")
                }
                val tempFile = File.createTempFile("pdf_preview_", ".pdf", context.cacheDir)
                tempFile.outputStream().use { output ->
                    response.body?.byteStream()?.copyTo(output)
                }
                tempFile
            }
            pdfFile = file
            val fd = ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY)
            val pdfRenderer = PdfRenderer(fd)
            renderer = pdfRenderer
            totalPages = pdfRenderer.pageCount
            currentPage = 0
            // Render first page
            pdfBitmap = renderPdfPage(pdfRenderer, 0)
            isLoading = false
        } catch (e: Exception) {
            error = "Failed to load PDF: ${e.message}"
            isLoading = false
        }
    }

    // Clean up renderer and temp file on dispose
    DisposableEffect(Unit) {
        onDispose {
            renderer?.close()
            pdfFile?.delete()
        }
    }

    when {
        isLoading -> {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(300.dp),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    CircularProgressIndicator(modifier = Modifier.size(32.dp))
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "Loading PDF…",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
        error != null -> {
            Text(
                text = error!!,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.error
            )
        }
        pdfBitmap != null -> {
            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                // PDF page rendered as Canvas
                Canvas(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(min = 200.dp, max = 400.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .background(Color.White)
                ) {
                    val bitmap = pdfBitmap!!
                    val imageBitmap = bitmap.asImageBitmap()
                    val scale = minOf(
                        size.width / bitmap.width.toFloat(),
                        size.height / bitmap.height.toFloat()
                    )
                    val offsetX = (size.width - bitmap.width * scale) / 2f
                    val offsetY = (size.height - bitmap.height * scale) / 2f

                    drawImage(
                        image = imageBitmap,
                        dstOffset = androidx.compose.ui.unit.IntOffset(
                            offsetX.toInt(),
                            offsetY.toInt()
                        ),
                        dstSize = androidx.compose.ui.unit.IntSize(
                            (bitmap.width * scale).toInt(),
                            (bitmap.height * scale).toInt()
                        )
                    )
                }

                Spacer(modifier = Modifier.height(8.dp))

                // Page navigation controls
                if (totalPages > 1) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.Center
                    ) {
                        IconButton(
                            onClick = {
                                if (currentPage > 0) {
                                    currentPage--
                                    renderer?.let { pdfBitmap = renderPdfPage(it, currentPage) }
                                }
                            },
                            enabled = currentPage > 0
                        ) {
                            Icon(
                                imageVector = Icons.Default.NavigateBefore,
                                contentDescription = "Previous page"
                            )
                        }

                        Text(
                            text = "Page ${currentPage + 1} of $totalPages",
                            style = MaterialTheme.typography.bodySmall,
                            fontWeight = FontWeight.Medium
                        )

                        IconButton(
                            onClick = {
                                if (currentPage < totalPages - 1) {
                                    currentPage++
                                    renderer?.let { pdfBitmap = renderPdfPage(it, currentPage) }
                                }
                            },
                            enabled = currentPage < totalPages - 1
                        ) {
                            Icon(
                                imageVector = Icons.Default.NavigateNext,
                                contentDescription = "Next page"
                            )
                        }
                    }
                }
            }
        }
    }
}

/**
 * Renders a single page from a PdfRenderer to a Bitmap.
 */
private fun renderPdfPage(renderer: PdfRenderer, pageIndex: Int): Bitmap {
    val page = renderer.openPage(pageIndex)
    // Render at 2x for readability on high-DPI screens
    val scale = 2
    val bitmap = Bitmap.createBitmap(
        page.width * scale,
        page.height * scale,
        Bitmap.Config.ARGB_8888
    )
    page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
    page.close()
    return bitmap
}

// ─── Unsupported Type Preview ─────────────────────────────────────────────────

@Composable
private fun UnsupportedPreviewContent(
    attachment: AttachmentBarItem,
    onOpenExternal: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Icon(
            imageVector = Icons.Default.OpenInNew,
            contentDescription = null,
            modifier = Modifier.size(48.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Text(
            text = "Cannot preview this file type.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Text(
            text = "Open with external app?",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Button(onClick = onOpenExternal) {
            Icon(
                imageVector = Icons.Default.OpenInNew,
                contentDescription = null,
                modifier = Modifier.size(18.dp)
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text("Open with external app")
        }
    }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Builds the full URL for an attachment, prepending the server URL if needed.
 */
private fun buildFullAttachmentUrl(url: String?, serverUrl: String): String? {
    if (url.isNullOrBlank()) return null
    return if (url.startsWith("http://") || url.startsWith("https://")) {
        url
    } else {
        "$serverUrl$url"
    }
}

/**
 * Formats a file size in bytes to a human-readable string.
 */
private fun formatAttachmentSize(bytes: Long): String {
    return when {
        bytes >= 1_048_576 -> String.format("%.1f MB", bytes / 1_048_576.0)
        bytes >= 1_024 -> String.format("%.0f KB", bytes / 1_024.0)
        else -> "$bytes B"
    }
}
