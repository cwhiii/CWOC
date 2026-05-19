package com.cwoc.app.ui.screens.attachments

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.AudioFile
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.InsertDriveFile
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.VideoFile
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage

// ─── Theme Colors ───────────────────────────────────────────────────────────────

private val ParchmentBrown = Color(0xFF6B4E31)
private val ParchmentText = Color(0xFF4A3520)

// ─── Main Screen ────────────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class, ExperimentalFoundationApi::class)
@Composable
fun AttachmentsScreen(
    onNavigateBack: () -> Unit,
    viewModel: AttachmentsViewModel = hiltViewModel()
) {
    val attachments by viewModel.attachments.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val error by viewModel.error.collectAsState()
    val searchQuery by viewModel.searchQuery.collectAsState()
    val typeFilter by viewModel.typeFilter.collectAsState()
    val sortOrder by viewModel.sortOrder.collectAsState()
    val selectedIds by viewModel.selectedIds.collectAsState()
    val isMultiSelectMode by viewModel.isMultiSelectMode.collectAsState()
    val actionMessage by viewModel.actionMessage.collectAsState()

    val snackbarHostState = remember { SnackbarHostState() }
    var previewAttachment by remember { mutableStateOf<AttachmentItem?>(null) }
    var showDeleteConfirm by remember { mutableStateOf(false) }

    val filteredAttachments = viewModel.getFilteredAttachments()

    // Show snackbar for action messages
    LaunchedEffect(actionMessage) {
        actionMessage?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearActionMessage()
        }
    }

    Scaffold(
        topBar = {
            if (isMultiSelectMode) {
                TopAppBar(
                    title = { Text("${selectedIds.size} selected") },
                    navigationIcon = {
                        IconButton(onClick = { viewModel.exitMultiSelectMode() }) {
                            Icon(Icons.Default.Close, contentDescription = "Cancel selection")
                        }
                    },
                    actions = {
                        IconButton(
                            onClick = { showDeleteConfirm = true },
                            enabled = selectedIds.isNotEmpty()
                        ) {
                            Icon(
                                Icons.Default.Delete,
                                contentDescription = "Delete selected",
                                tint = if (selectedIds.isNotEmpty()) Color(0xFFC62828) else Color.Gray
                            )
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = MaterialTheme.colorScheme.surface
                    )
                )
            } else {
                TopAppBar(
                    title = { Text("Attachments") },
                    navigationIcon = {
                        IconButton(onClick = onNavigateBack) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                                contentDescription = "Back"
                            )
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = MaterialTheme.colorScheme.surface
                    )
                )
            }
        },
        snackbarHost = { SnackbarHost(hostState = snackbarHostState) }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            // Filter bar
            FilterBar(
                searchQuery = searchQuery,
                onSearchChange = { viewModel.setSearchQuery(it) },
                typeFilter = typeFilter,
                onTypeFilterChange = { viewModel.setTypeFilter(it) },
                sortOrder = sortOrder,
                onSortChange = { viewModel.setSortOrder(it) },
                sizeMinMb = viewModel.sizeMinMb.collectAsState().value,
                sizeMaxMb = viewModel.sizeMaxMb.collectAsState().value,
                onSizeMinChange = { viewModel.setSizeMin(it) },
                onSizeMaxChange = { viewModel.setSizeMax(it) }
            )

            when {
                isLoading -> LoadingState()
                error != null -> ErrorState(
                    message = error!!,
                    onRetry = { viewModel.loadAttachments() }
                )
                filteredAttachments.isEmpty() -> EmptyState()
                else -> {
                    LazyVerticalGrid(
                        columns = GridCells.Fixed(2),
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(12.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(
                            filteredAttachments,
                            key = { it.attachmentId }
                        ) { attachment ->
                            AttachmentCard(
                                attachment = attachment,
                                serverUrl = viewModel.getServerUrl(),
                                isSelected = selectedIds.contains(attachment.attachmentId),
                                isMultiSelectMode = isMultiSelectMode,
                                onClick = {
                                    if (isMultiSelectMode) {
                                        viewModel.toggleSelection(attachment.attachmentId)
                                    } else {
                                        previewAttachment = attachment
                                    }
                                },
                                onLongClick = {
                                    if (!isMultiSelectMode) {
                                        viewModel.enterMultiSelectMode(attachment.attachmentId)
                                    }
                                }
                            )
                        }
                    }
                }
            }
        }
    }

    // Preview dialog
    previewAttachment?.let { attachment ->
        PreviewDialog(
            attachment = attachment,
            serverUrl = viewModel.getServerUrl(),
            onDismiss = { previewAttachment = null }
        )
    }

    // Bulk delete confirmation
    if (showDeleteConfirm) {
        AlertDialog(
            onDismissRequest = { showDeleteConfirm = false },
            title = { Text("Delete Attachments", color = ParchmentText) },
            text = {
                Text("Are you sure you want to delete ${selectedIds.size} attachment(s)? This cannot be undone.")
            },
            confirmButton = {
                Button(
                    onClick = {
                        viewModel.bulkDelete()
                        showDeleteConfirm = false
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFC62828))
                ) {
                    Text("Delete")
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteConfirm = false }) {
                    Text("Cancel", color = ParchmentBrown)
                }
            }
        )
    }
}

// ─── Filter Bar ─────────────────────────────────────────────────────────────────

@Composable
private fun FilterBar(
    searchQuery: String,
    onSearchChange: (String) -> Unit,
    typeFilter: AttachmentTypeFilter,
    onTypeFilterChange: (AttachmentTypeFilter) -> Unit,
    sortOrder: AttachmentSort,
    onSortChange: (AttachmentSort) -> Unit,
    sizeMinMb: Float?,
    sizeMaxMb: Float?,
    onSizeMinChange: (Float?) -> Unit,
    onSizeMaxChange: (Float?) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 8.dp)
    ) {
        // Search field
        OutlinedTextField(
            value = searchQuery,
            onValueChange = onSearchChange,
            placeholder = { Text("Search attachments...") },
            leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
            trailingIcon = {
                if (searchQuery.isNotEmpty()) {
                    IconButton(onClick = { onSearchChange("") }) {
                        Icon(Icons.Default.Close, contentDescription = "Clear search")
                    }
                }
            },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(8.dp))

        // Type filter + Sort dropdowns
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            // Type filter dropdown
            Box(modifier = Modifier.weight(1f)) {
                var expanded by remember { mutableStateOf(false) }
                OutlinedButton(
                    onClick = { expanded = true },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = typeFilter.label,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
                DropdownMenu(
                    expanded = expanded,
                    onDismissRequest = { expanded = false }
                ) {
                    AttachmentTypeFilter.entries.forEach { filter ->
                        DropdownMenuItem(
                            text = { Text(filter.label) },
                            onClick = {
                                onTypeFilterChange(filter)
                                expanded = false
                            }
                        )
                    }
                }
            }

            // Sort dropdown
            Box(modifier = Modifier.weight(1f)) {
                var expanded by remember { mutableStateOf(false) }
                OutlinedButton(
                    onClick = { expanded = true },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = sortOrder.label,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
                DropdownMenu(
                    expanded = expanded,
                    onDismissRequest = { expanded = false }
                ) {
                    AttachmentSort.entries.forEach { sort ->
                        DropdownMenuItem(
                            text = { Text(sort.label) },
                            onClick = {
                                onSortChange(sort)
                                expanded = false
                            }
                        )
                    }
                }
            }
        }

        // Size range filter (min/max MB)
        Spacer(modifier = Modifier.height(8.dp))
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text("Size:", style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(end = 4.dp))
            OutlinedTextField(
                value = sizeMinMb?.toString() ?: "",
                onValueChange = { text ->
                    onSizeMinChange(text.toFloatOrNull())
                },
                placeholder = { Text("Min MB") },
                singleLine = true,
                modifier = Modifier.weight(1f),
                textStyle = MaterialTheme.typography.bodySmall
            )
            Text("—", style = MaterialTheme.typography.bodySmall)
            OutlinedTextField(
                value = sizeMaxMb?.toString() ?: "",
                onValueChange = { text ->
                    onSizeMaxChange(text.toFloatOrNull())
                },
                placeholder = { Text("Max MB") },
                singleLine = true,
                modifier = Modifier.weight(1f),
                textStyle = MaterialTheme.typography.bodySmall
            )
        }
    }
}

// ─── Attachment Card ────────────────────────────────────────────────────────────

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun AttachmentCard(
    attachment: AttachmentItem,
    serverUrl: String,
    isSelected: Boolean,
    isMultiSelectMode: Boolean,
    onClick: () -> Unit,
    onLongClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .combinedClickable(
                onClick = onClick,
                onLongClick = onLongClick
            ),
        colors = CardDefaults.cardColors(
            containerColor = if (isSelected)
                ParchmentBrown.copy(alpha = 0.1f)
            else
                MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        shape = RoundedCornerShape(8.dp)
    ) {
        Column {
            // Thumbnail area
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .aspectRatio(1f)
                    .clip(RoundedCornerShape(topStart = 8.dp, topEnd = 8.dp)),
                contentAlignment = Alignment.Center
            ) {
                if (attachment.contentType.startsWith("image/")) {
                    val imageUrl = if (attachment.url.startsWith("http")) {
                        attachment.url
                    } else {
                        "$serverUrl${attachment.url}"
                    }
                    AsyncImage(
                        model = imageUrl,
                        contentDescription = attachment.filename,
                        modifier = Modifier.fillMaxSize(),
                        contentScale = ContentScale.Crop
                    )
                } else {
                    Icon(
                        imageVector = getTypeIcon(attachment.contentType),
                        contentDescription = null,
                        modifier = Modifier.size(48.dp),
                        tint = ParchmentBrown
                    )
                }

                // Checkbox overlay in multi-select mode
                if (isMultiSelectMode) {
                    Box(
                        modifier = Modifier
                            .align(Alignment.TopEnd)
                            .padding(4.dp)
                    ) {
                        Checkbox(
                            checked = isSelected,
                            onCheckedChange = { onClick() },
                            colors = CheckboxDefaults.colors(
                                checkedColor = ParchmentBrown,
                                checkmarkColor = Color.White
                            )
                        )
                    }
                }
            }

            // Info area
            Column(
                modifier = Modifier.padding(8.dp)
            ) {
                Text(
                    text = attachment.filename,
                    style = MaterialTheme.typography.bodySmall,
                    fontWeight = FontWeight.Medium,
                    color = ParchmentText,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
                Spacer(modifier = Modifier.height(2.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = formatFileSize(attachment.size),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        text = formatDate(attachment.createdDatetime),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}

// ─── Preview Dialog ─────────────────────────────────────────────────────────────

@Composable
private fun PreviewDialog(
    attachment: AttachmentItem,
    serverUrl: String,
    onDismiss: () -> Unit
) {
    val context = LocalContext.current

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                text = attachment.filename,
                color = ParchmentText,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )
        },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                if (attachment.contentType.startsWith("image/")) {
                    // Full image preview
                    val imageUrl = if (attachment.url.startsWith("http")) {
                        attachment.url
                    } else {
                        "$serverUrl${attachment.url}"
                    }
                    AsyncImage(
                        model = imageUrl,
                        contentDescription = attachment.filename,
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(8.dp)),
                        contentScale = ContentScale.FillWidth
                    )
                } else {
                    // Non-image: show type icon + info
                    Icon(
                        imageVector = getTypeIcon(attachment.contentType),
                        contentDescription = null,
                        modifier = Modifier.size(64.dp),
                        tint = ParchmentBrown
                    )
                }

                Spacer(modifier = Modifier.height(12.dp))

                // File info
                Text(
                    text = "Type: ${attachment.contentType}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    text = "Size: ${formatFileSize(attachment.size)}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    text = "Date: ${formatDate(attachment.createdDatetime)}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    // Open with system viewer
                    val fileUrl = if (attachment.url.startsWith("http")) {
                        attachment.url
                    } else {
                        "$serverUrl${attachment.url}"
                    }
                    val intent = Intent(Intent.ACTION_VIEW).apply {
                        setDataAndType(Uri.parse(fileUrl), attachment.contentType)
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    }
                    try {
                        context.startActivity(intent)
                    } catch (e: Exception) {
                        // Fallback: open in browser
                        val browserIntent = Intent(Intent.ACTION_VIEW, Uri.parse(fileUrl))
                        context.startActivity(browserIntent)
                    }
                },
                colors = ButtonDefaults.buttonColors(containerColor = ParchmentBrown)
            ) {
                Text("Open")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Close", color = ParchmentBrown)
            }
        }
    )
}

// ─── State Composables ──────────────────────────────────────────────────────────

@Composable
private fun LoadingState() {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        CircularProgressIndicator(color = ParchmentBrown)
    }
}

@Composable
private fun ErrorState(message: String, onRetry: () -> Unit) {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = message,
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.error,
                textAlign = TextAlign.Center
            )
            Spacer(modifier = Modifier.height(16.dp))
            Button(
                onClick = onRetry,
                colors = ButtonDefaults.buttonColors(containerColor = ParchmentBrown)
            ) {
                Text("Retry")
            }
        }
    }
}

@Composable
private fun EmptyState() {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(
                imageVector = Icons.Default.InsertDriveFile,
                contentDescription = null,
                modifier = Modifier.size(64.dp),
                tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
            )
            Spacer(modifier = Modifier.height(12.dp))
            Text(
                text = "No attachments found",
                style = MaterialTheme.typography.headlineSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "Attachments from your chits will appear here",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

// ─── Utility Functions ──────────────────────────────────────────────────────────

private fun getTypeIcon(contentType: String): ImageVector {
    return when {
        contentType.startsWith("image/") -> Icons.Default.Image
        contentType.startsWith("video/") -> Icons.Default.VideoFile
        contentType.startsWith("audio/") -> Icons.Default.AudioFile
        contentType.startsWith("application/pdf") -> Icons.Default.Description
        contentType.startsWith("text/") -> Icons.Default.Description
        else -> Icons.Default.InsertDriveFile
    }
}

private fun formatFileSize(bytes: Long): String {
    return when {
        bytes < 1024 -> "$bytes B"
        bytes < 1024 * 1024 -> "${bytes / 1024} KB"
        bytes < 1024 * 1024 * 1024 -> String.format("%.1f MB", bytes / (1024.0 * 1024.0))
        else -> String.format("%.1f GB", bytes / (1024.0 * 1024.0 * 1024.0))
    }
}

private fun formatDate(dateStr: String): String {
    return try {
        val inputFormat = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", java.util.Locale.US)
        inputFormat.timeZone = java.util.TimeZone.getTimeZone("UTC")
        val date = inputFormat.parse(dateStr)
            ?: java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS", java.util.Locale.US).apply {
                timeZone = java.util.TimeZone.getTimeZone("UTC")
            }.parse(dateStr)
            ?: return dateStr

        val outputFormat = java.text.SimpleDateFormat("MMM d", java.util.Locale.US)
        outputFormat.timeZone = java.util.TimeZone.getDefault()
        outputFormat.format(date)
    } catch (e: Exception) {
        dateStr
    }
}
