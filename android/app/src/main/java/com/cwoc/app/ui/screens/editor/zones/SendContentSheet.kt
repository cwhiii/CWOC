package com.cwoc.app.ui.screens.editor.zones

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import com.cwoc.app.ui.theme.CwocButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.BottomSheetDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.cwoc.app.data.remote.CwocApiService
import com.cwoc.app.data.remote.dto.ChitSearchResult
import com.cwoc.app.ui.theme.CwocDialogDefaults
import com.cwoc.app.ui.theme.CwocPrimary
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import com.cwoc.app.ui.theme.CwocInputDefaults

/**
 * SendContentSheet — ModalBottomSheet for selecting a target chit to send notes or checklist content to.
 *
 * Features:
 * - Search input with debounced 300ms server-side search via apiService.searchChits()
 * - Results list with radio-select (title, due date, status columns)
 * - Footer with selected chit name + Cancel + Copy (📋) + Move (📤) buttons
 * - Copy/Move buttons disabled until a chit is selected
 * - Back/ESC: if search has text → clear; else → dismiss
 *
 * @param contentType "notes" or "checklist" — determines the action label
 * @param currentChitId The current chit's ID (excluded from search results)
 * @param apiService The API service for server-side search
 * @param onExecute Callback with (mode: "copy"|"move", targetChitId: String)
 * @param onDismiss Callback when the sheet is dismissed
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SendContentSheet(
    contentType: String,
    currentChitId: String,
    apiService: CwocApiService,
    onExecute: (mode: String, targetChitId: String) -> Unit,
    onDismiss: () -> Unit
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val coroutineScope = rememberCoroutineScope()

    var searchQuery by remember { mutableStateOf("") }
    var searchResults by remember { mutableStateOf<List<ChitSearchResult>>(emptyList()) }
    var isSearching by remember { mutableStateOf(false) }
    var selectedChitId by remember { mutableStateOf<String?>(null) }
    var selectedChitTitle by remember { mutableStateOf<String?>(null) }
    var searchJob by remember { mutableStateOf<Job?>(null) }

    // Debounced server-side search
    LaunchedEffect(searchQuery) {
        searchJob?.cancel()
        if (searchQuery.isBlank()) {
            searchResults = emptyList()
            isSearching = false
        } else {
            isSearching = true
            searchJob = coroutineScope.launch {
                delay(300L)
                try {
                    val response = apiService.searchChits(searchQuery)
                    if (response.isSuccessful) {
                        val results = response.body() ?: emptyList()
                        // Filter out current chit and deleted chits
                        searchResults = results.filter { result ->
                            val id = result.id.ifBlank { result.chit?.id ?: "" }
                            id.isNotBlank() && id != currentChitId
                        }
                    } else {
                        searchResults = emptyList()
                    }
                } catch (_: Exception) {
                    searchResults = emptyList()
                }
                isSearching = false
            }
        }
    }

    ModalBottomSheet(
        onDismissRequest = {
            if (searchQuery.isNotBlank()) {
                searchQuery = ""
                selectedChitId = null
                selectedChitTitle = null
            } else {
                onDismiss()
            }
        },
        sheetState = sheetState,
        containerColor = CwocDialogDefaults.containerColor,
        dragHandle = { BottomSheetDefaults.DragHandle(color = CwocPrimary) }
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp)
        ) {
            // Header
            Text(
                text = when (contentType) {
                    "notes" -> "Send Notes to..."
                    "checklist" -> "Send Checklist to..."
                    else -> "Send Item to..."
                },
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary
            )

            Spacer(modifier = Modifier.height(12.dp))

            // Search input
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { searchQuery = it },
                modifier = Modifier.fillMaxWidth(),
                placeholder = { Text("Search chits...") },
                singleLine = true,
                leadingIcon = {
                    Icon(Icons.Default.Search, contentDescription = "Search")
                },
                trailingIcon = {
                    if (searchQuery.isNotBlank()) {
                        TextButton(onClick = {
                            searchQuery = ""
                            selectedChitId = null
                            selectedChitTitle = null
                        }) {
                            Text("✕")
                        }
                    }
                },
                colors = CwocInputDefaults.outlinedColors()
            )

            // Operator help text
            Text(
                text = "Operators: && (and), || (or), ! (not), () (group), #tag",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(start = 4.dp, top = 4.dp)
            )

            Spacer(modifier = Modifier.height(8.dp))

            // Loading indicator
            if (isSearching) {
                Text(
                    text = "Searching…",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(horizontal = 4.dp, vertical = 4.dp)
                )
            }

            // Results list with radio-select
            LazyColumn(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(280.dp)
            ) {
                items(searchResults) { result ->
                    val chitId = result.id.ifBlank { result.chit?.id ?: "" }
                    val chitTitle = result.title.ifBlank { result.chit?.title ?: "(untitled)" }
                    val chitStatus = result.status ?: result.chit?.status
                    val chitDue = result.due_datetime ?: result.chit?.due_datetime

                    val isSelected = chitId == selectedChitId

                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                selectedChitId = chitId
                                selectedChitTitle = chitTitle
                            }
                            .background(
                                if (isSelected) MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f)
                                else Color.Transparent
                            )
                            .padding(vertical = 8.dp, horizontal = 4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        RadioButton(
                            selected = isSelected,
                            onClick = {
                                selectedChitId = chitId
                                selectedChitTitle = chitTitle
                            }
                        )

                        Spacer(modifier = Modifier.width(8.dp))

                        // Title column
                        Text(
                            text = chitTitle,
                            style = MaterialTheme.typography.bodyMedium,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.weight(1f)
                        )

                        // Due date column
                        if (!chitDue.isNullOrBlank()) {
                            Text(
                                text = formatDueDate(chitDue),
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.padding(horizontal = 4.dp)
                            )
                        }

                        // Status column
                        if (!chitStatus.isNullOrBlank()) {
                            Text(
                                text = chitStatus,
                                style = MaterialTheme.typography.labelSmall,
                                color = when (chitStatus) {
                                    "Complete" -> Color(0xFF2E7D32)
                                    "Blocked" -> Color(0xFFD32F2F)
                                    "In Progress" -> Color(0xFF1565C0)
                                    else -> MaterialTheme.colorScheme.onSurfaceVariant
                                },
                                modifier = Modifier.padding(start = 4.dp)
                            )
                        }
                    }
                    HorizontalDivider(color = Color(0xFF8B5A2B), thickness = 1.dp)
                }

                if (searchResults.isEmpty() && !isSearching && searchQuery.isNotBlank()) {
                    item {
                        Text(
                            text = "No matches found",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(16.dp)
                        )
                    }
                }

                if (searchQuery.isBlank()) {
                    item {
                        Text(
                            text = "Type to search for a target chit",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(16.dp)
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Footer: selected name + Cancel + Copy + Move
            Column(modifier = Modifier.fillMaxWidth()) {
                // Selected chit name
                if (selectedChitTitle != null) {
                    Text(
                        text = "→ $selectedChitTitle",
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.primary,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.padding(bottom = 8.dp)
                    )
                }

                // Action buttons
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Cancel
                    OutlinedButton(
                        onClick = onDismiss,
                        modifier = Modifier.weight(1f),
                        colors = CwocButtonDefaults.outsetColors(),
                        border = CwocButtonDefaults.outsetBorder,
                        shape = CwocButtonDefaults.outsetShape
                    ) {
                        Text("Cancel")
                    }

                    // Copy button (📋)
                    Button(
                        onClick = {
                            selectedChitId?.let { targetId ->
                                onExecute("copy", targetId)
                            }
                        },
                        enabled = selectedChitId != null,
                        modifier = Modifier.weight(1f),
                        colors = CwocButtonDefaults.outsetColors(),
                        border = CwocButtonDefaults.outsetBorder,
                        shape = CwocButtonDefaults.outsetShape
                    ) {
                        Text("📋 Copy")
                    }

                    // Move button (📤)
                    Button(
                        onClick = {
                            selectedChitId?.let { targetId ->
                                onExecute("move", targetId)
                            }
                        },
                        enabled = selectedChitId != null,
                        modifier = Modifier.weight(1f),
                        colors = CwocButtonDefaults.outsetColors(),
                        border = CwocButtonDefaults.outsetBorder,
                        shape = CwocButtonDefaults.outsetShape
                    ) {
                        Text("📤 Move")
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}

/**
 * UndoCountdownBar — Shared composable showing message + Undo button + animated progress bar.
 * Auto-dismisses after the specified duration (default 8 seconds).
 *
 * @param message The action label (e.g., "📤 Copied notes → Target Title")
 * @param onUndo Callback when Undo is tapped
 * @param durationMs Duration in milliseconds before auto-dismiss (default 8000)
 * @param onExpire Callback when the countdown expires without undo
 */
@Composable
fun UndoCountdownBar(
    message: String,
    onUndo: () -> Unit,
    durationMs: Long = 8000L,
    onExpire: () -> Unit = {}
) {
    var progress by remember { mutableStateOf(1f) }
    var isVisible by remember { mutableStateOf(true) }

    // Animate progress from 1.0 to 0.0 over durationMs
    val animatedProgress by animateFloatAsState(
        targetValue = progress,
        animationSpec = tween(durationMillis = durationMs.toInt()),
        label = "undo_progress"
    )

    // Start countdown
    LaunchedEffect(Unit) {
        progress = 0f
        delay(durationMs)
        if (isVisible) {
            isVisible = false
            onExpire()
        }
    }

    if (isVisible) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    Color(0xFFFFF3E0),
                    RoundedCornerShape(8.dp)
                )
                .padding(horizontal = 12.dp, vertical = 8.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = message,
                    style = MaterialTheme.typography.bodySmall,
                    color = Color(0xFF4A2C2A),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f)
                )

                Spacer(modifier = Modifier.width(8.dp))

                OutlinedButton(
                    onClick = {
                        isVisible = false
                        onUndo()
                    },
                    modifier = Modifier.height(32.dp),
                    colors = CwocButtonDefaults.outsetColors(),
                    border = CwocButtonDefaults.outsetBorder,
                    shape = CwocButtonDefaults.outsetShape
                ) {
                    Text("Undo", fontSize = 12.sp)
                }
            }

            Spacer(modifier = Modifier.height(4.dp))

            // Progress bar
            LinearProgressIndicator(
                progress = { animatedProgress },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(3.dp)
                    .clip(RoundedCornerShape(2.dp)),
                color = Color(0xFF8B5A2B),
                trackColor = Color(0xFFE8DCC8)
            )
        }
    }
}

/**
 * Formats a due datetime string for display in the search results.
 * Shows just the date portion in a short format.
 */
private fun formatDueDate(datetime: String): String {
    return try {
        // Extract just the date part (YYYY-MM-DD)
        val datePart = datetime.substring(0, 10)
        val parts = datePart.split("-")
        if (parts.size == 3) {
            "${parts[1]}/${parts[2]}"
        } else {
            datePart
        }
    } catch (_: Exception) {
        datetime.take(10)
    }
}
