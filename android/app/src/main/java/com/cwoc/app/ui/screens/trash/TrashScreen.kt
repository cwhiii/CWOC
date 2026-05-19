package com.cwoc.app.ui.screens.trash

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.RestoreFromTrash
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.cwoc.app.data.local.entity.ChitEntity
import com.cwoc.app.ui.theme.CwocZoneHeaderBrown
import com.cwoc.app.ui.util.DateUtils

/**
 * Trash screen displaying all soft-deleted chits with restore and purge actions.
 * TopAppBar with "Trash" title and back navigation.
 * Each item shows title, deletion date, type indicator chips, and action buttons.
 * Confirmation dialog before purge ("This cannot be undone").
 * Empty state when trash is empty.
 * Task 38.1: FilterChip row for "All" | "Emails Only" filtering.
 *
 * Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TrashScreen(
    onNavigateBack: () -> Unit,
    viewModel: TrashViewModel = hiltViewModel()
) {
    val trashedChits by viewModel.trashedChits.collectAsState()
    val selectedIds by viewModel.selectedIds.collectAsState()
    var chitToPurge by remember { mutableStateOf<ChitEntity?>(null) }
    var showBulkPurgeConfirm by remember { mutableStateOf(false) }
    var emailFilterActive by remember { mutableStateOf(false) }

    // Filter chits based on email filter
    val filteredChits by remember(trashedChits, emailFilterActive) {
        derivedStateOf {
            if (emailFilterActive) {
                trashedChits.filter { chit ->
                    !chit.emailMessageId.isNullOrBlank() || !chit.emailStatus.isNullOrBlank()
                }
            } else {
                trashedChits
            }
        }
    }

    val pageTitle = if (emailFilterActive) "Email Trash" else "Trash"

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(pageTitle) },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back"
                        )
                    }
                },
                actions = {
                    if (selectedIds.isNotEmpty()) {
                        // Bulk restore
                        IconButton(onClick = { viewModel.bulkRestore() }) {
                            Icon(Icons.Default.RestoreFromTrash, "Restore Selected", tint = Color(0xFF2E7D32))
                        }
                        // Bulk purge
                        IconButton(onClick = { showBulkPurgeConfirm = true }) {
                            Icon(Icons.Default.Delete, "Delete Selected", tint = MaterialTheme.colorScheme.error)
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            // Filter chips row (Task 38.1)
            TrashFilterChips(
                emailFilterActive = emailFilterActive,
                onFilterChange = { emailFilterActive = it }
            )

            // Count + select all row
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                androidx.compose.material3.Checkbox(
                    checked = viewModel.isAllSelected(filteredChits),
                    onCheckedChange = { viewModel.toggleSelectAll(filteredChits) }
                )
                Text(
                    text = "${filteredChits.size} deleted ${if (emailFilterActive) "email" else "chit"}${if (filteredChits.size != 1) "s" else ""}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                if (selectedIds.isNotEmpty()) {
                    Text(
                        text = " · ${selectedIds.size} selected",
                        style = MaterialTheme.typography.bodySmall,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            if (filteredChits.isEmpty()) {
                TrashEmptyState()
            } else {
                TrashList(
                    chits = filteredChits,
                    selectedIds = selectedIds,
                    onToggleSelect = { viewModel.toggleSelection(it) },
                    onRestore = { chitId -> viewModel.restore(chitId) },
                    onPurge = { chit -> chitToPurge = chit }
                )
            }
        }
    }

    // Purge confirmation dialog
    chitToPurge?.let { chit ->
        PurgeConfirmationDialog(
            chitTitle = chit.title ?: "Untitled",
            onConfirm = {
                viewModel.purge(chit.id)
                chitToPurge = null
            },
            onDismiss = { chitToPurge = null }
        )
    }

    // Bulk purge confirmation
    if (showBulkPurgeConfirm) {
        AlertDialog(
            onDismissRequest = { showBulkPurgeConfirm = false },
            title = { Text("Permanently Delete ${selectedIds.size} Chit(s)") },
            text = { Text("These chits will be permanently deleted. This cannot be undone.") },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.bulkPurge()
                    showBulkPurgeConfirm = false
                }) { Text("Delete All", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = {
                TextButton(onClick = { showBulkPurgeConfirm = false }) { Text("Cancel") }
            }
        )
    }
}

/**
 * Filter chips for trash: "All" and "Emails Only".
 * Uses brown selected color matching the app's FilterChip pattern.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TrashFilterChips(
    emailFilterActive: Boolean,
    onFilterChange: (Boolean) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        FilterChip(
            selected = !emailFilterActive,
            onClick = { onFilterChange(false) },
            label = { Text("All") },
            colors = FilterChipDefaults.filterChipColors(
                selectedContainerColor = CwocZoneHeaderBrown,
                selectedLabelColor = Color.White
            )
        )
        FilterChip(
            selected = emailFilterActive,
            onClick = { onFilterChange(true) },
            label = { Text("Emails Only") },
            colors = FilterChipDefaults.filterChipColors(
                selectedContainerColor = CwocZoneHeaderBrown,
                selectedLabelColor = Color.White
            )
        )
    }
}

@Composable
private fun TrashEmptyState(modifier: Modifier = Modifier) {
    Box(
        modifier = modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = "Trash is empty",
                style = MaterialTheme.typography.headlineSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "Deleted chits will appear here",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
private fun TrashList(
    chits: List<ChitEntity>,
    selectedIds: Set<String>,
    onToggleSelect: (String) -> Unit,
    onRestore: (String) -> Unit,
    onPurge: (ChitEntity) -> Unit,
    modifier: Modifier = Modifier
) {
    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        item { Spacer(modifier = Modifier.height(8.dp)) }
        items(chits, key = { it.id }) { chit ->
            TrashChitCard(
                chit = chit,
                isSelected = chit.id in selectedIds,
                onToggleSelect = { onToggleSelect(chit.id) },
                onRestore = { onRestore(chit.id) },
                onPurge = { onPurge(chit) }
            )
        }
        item { Spacer(modifier = Modifier.height(8.dp)) }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun TrashChitCard(
    chit: ChitEntity,
    isSelected: Boolean,
    onToggleSelect: () -> Unit,
    onRestore: () -> Unit,
    onPurge: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = if (isSelected) MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f)
                else MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Row(
            modifier = Modifier.padding(start = 4.dp, top = 12.dp, bottom = 12.dp, end = 12.dp),
            verticalAlignment = Alignment.Top
        ) {
            // Selection checkbox
            androidx.compose.material3.Checkbox(
                checked = isSelected,
                onCheckedChange = { onToggleSelect() }
            )

            Column(modifier = Modifier.weight(1f)) {
                // Title
                Text(
                    text = chit.title ?: "Untitled",
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Medium,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )

                // Status + Priority row
                val statusPriority = buildList {
                    chit.status?.takeIf { it.isNotBlank() }?.let { add("Status: $it") }
                    chit.priority?.takeIf { it.isNotBlank() }?.let { add("Priority: $it") }
                }
                if (statusPriority.isNotEmpty()) {
                    Spacer(modifier = Modifier.height(2.dp))
                    Text(
                        text = statusPriority.joinToString(" · "),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                // Note preview (first 80 chars, matching web)
                chit.note?.takeIf { it.isNotBlank() }?.let { note ->
                    Spacer(modifier = Modifier.height(2.dp))
                    Text(
                        text = if (note.length > 80) note.take(80) + "…" else note,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                // Deletion date (using modifiedDatetime as the deletion timestamp)
                chit.modifiedDatetime?.let { deletedAt ->
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "Deleted: ${DateUtils.formatDisplayDate(deletedAt)}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                // Type indicator chips
                val typeChips = buildChitTypeChips(chit)
                if (typeChips.isNotEmpty()) {
                    Spacer(modifier = Modifier.height(6.dp))
                    FlowRow(
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                        verticalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        typeChips.forEach { label ->
                            AssistChip(
                                onClick = {},
                                label = {
                                    Text(
                                        text = label,
                                        style = MaterialTheme.typography.labelSmall
                                    )
                                }
                            )
                        }
                    }
                }

                // Action buttons
                Spacer(modifier = Modifier.height(8.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End
                ) {
                    OutlinedButton(onClick = onRestore) {
                        Icon(
                            imageVector = Icons.Default.RestoreFromTrash,
                            contentDescription = null,
                            modifier = Modifier.padding(end = 4.dp)
                        )
                        Text("Restore")
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    OutlinedButton(onClick = onPurge) {
                        Icon(
                            imageVector = Icons.Default.Delete,
                            contentDescription = null,
                            modifier = Modifier.padding(end = 4.dp)
                        )
                        Text("Purge")
                    }
                }
            }
        }
    }
}

@Composable
private fun PurgeConfirmationDialog(
    chitTitle: String,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Permanently Delete?") },
        text = {
            Text("\"$chitTitle\" will be permanently deleted. This cannot be undone.")
        },
        confirmButton = {
            TextButton(onClick = onConfirm) {
                Text(
                    text = "Purge",
                    color = MaterialTheme.colorScheme.error
                )
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}

/**
 * Builds a list of type indicator chip labels based on chit properties.
 * Mirrors the system tag logic: Calendar, Checklists, Alarms, Projects, Tasks, Notes.
 */
private fun buildChitTypeChips(chit: ChitEntity): List<String> {
    val chips = mutableListOf<String>()

    // Status indicates it's a Task
    if (!chit.status.isNullOrBlank()) {
        chips.add("Task")
    }

    // Has checklist content
    if (!chit.checklist.isNullOrBlank() && chit.checklist != "[]") {
        chips.add("Checklist")
    }

    // Has dates (calendar item)
    if (chit.startDatetime != null || chit.dueDatetime != null || chit.pointInTime != null) {
        chips.add("Calendar")
    }

    // Has alerts/alarms
    if (chit.alarm == true || chit.notification == true ||
        (!chit.alerts.isNullOrBlank() && chit.alerts != "[]")) {
        chips.add("Alarm")
    }

    // Is a project master
    if (chit.isProjectMaster) {
        chips.add("Project")
    }

    // Has note content (and no other strong type indicator → Notes type)
    if (!chit.note.isNullOrBlank() && chips.isEmpty()) {
        chips.add("Note")
    }

    return chips
}
