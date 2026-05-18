package com.cwoc.app.ui.screens.adminchits

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.combinedClickable
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Search
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
import androidx.compose.material3.Surface
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel

// ─── Theme Colors ───────────────────────────────────────────────────────────────

private val ParchmentBrown = Color(0xFF6B4E31)
private val ParchmentText = Color(0xFF4A3520)

// ─── Status Colors ──────────────────────────────────────────────────────────────

private val StatusTodo = Color(0xFF757575)
private val StatusInProgress = Color(0xFF1976D2)
private val StatusBlocked = Color(0xFFC62828)
private val StatusComplete = Color(0xFF2E7D32)

// ─── Main Screen ────────────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AdminChitsScreen(
    onNavigateBack: () -> Unit,
    onNavigateToEditor: (String) -> Unit,
    viewModel: AdminChitsViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }

    // Show snackbar for action messages
    LaunchedEffect(uiState.actionMessage) {
        uiState.actionMessage?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearActionMessage()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    if (uiState.isSelectionMode) {
                        Text("${uiState.selectedIds.size} selected")
                    } else {
                        Text("Chit Manager")
                    }
                },
                navigationIcon = {
                    IconButton(onClick = {
                        if (uiState.isSelectionMode) {
                            viewModel.clearSelection()
                        } else {
                            onNavigateBack()
                        }
                    }) {
                        Icon(
                            imageVector = if (uiState.isSelectionMode)
                                Icons.Default.Close
                            else
                                Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = if (uiState.isSelectionMode) "Cancel selection" else "Back"
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        },
        bottomBar = {
            if (uiState.isSelectionMode) {
                BulkActionBar(
                    owners = uiState.owners,
                    onDelete = { viewModel.bulkDelete() },
                    onChangeOwner = { viewModel.bulkChangeOwner(it) },
                    onChangeStatus = { viewModel.bulkChangeStatus(it) }
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
                ownerFilter = uiState.ownerFilter,
                searchQuery = uiState.searchQuery,
                owners = uiState.owners,
                onOwnerFilterChange = { viewModel.setOwnerFilter(it) },
                onSearchQueryChange = { viewModel.setSearchQuery(it) }
            )

            when {
                uiState.isLoading -> LoadingState()
                uiState.error != null -> ErrorState(
                    message = uiState.error!!,
                    onRetry = { viewModel.loadChits() }
                )
                uiState.chits.isEmpty() -> EmptyState()
                else -> {
                    LazyColumn(
                        modifier = Modifier
                            .weight(1f)
                            .padding(horizontal = 16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        item { Spacer(modifier = Modifier.height(4.dp)) }
                        items(uiState.chits, key = { it.id }) { chit ->
                            AdminChitCard(
                                chit = chit,
                                isSelected = chit.id in uiState.selectedIds,
                                isSelectionMode = uiState.isSelectionMode,
                                onClick = {
                                    if (uiState.isSelectionMode) {
                                        viewModel.toggleSelection(chit.id)
                                    } else {
                                        onNavigateToEditor(chit.id)
                                    }
                                },
                                onLongClick = {
                                    if (!uiState.isSelectionMode) {
                                        viewModel.enterSelectionMode(chit.id)
                                    }
                                }
                            )
                        }
                        item { Spacer(modifier = Modifier.height(8.dp)) }
                    }

                    // Pagination controls
                    PaginationControls(
                        offset = uiState.offset,
                        limit = uiState.limit,
                        hasMore = uiState.hasMore,
                        onPrevious = { viewModel.previousPage() },
                        onNext = { viewModel.nextPage() }
                    )
                }
            }
        }
    }
}

// ─── Filter Bar ─────────────────────────────────────────────────────────────────

@Composable
private fun FilterBar(
    ownerFilter: String,
    searchQuery: String,
    owners: List<String>,
    onOwnerFilterChange: (String) -> Unit,
    onSearchQueryChange: (String) -> Unit
) {
    var ownerDropdownExpanded by remember { mutableStateOf(false) }
    var localSearch by remember { mutableStateOf(searchQuery) }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        // Search field
        OutlinedTextField(
            value = localSearch,
            onValueChange = { localSearch = it },
            label = { Text("Search chits") },
            leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
            trailingIcon = {
                if (localSearch.isNotEmpty()) {
                    IconButton(onClick = {
                        localSearch = ""
                        onSearchQueryChange("")
                    }) {
                        Icon(Icons.Default.Close, contentDescription = "Clear search")
                    }
                }
            },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )

        // Trigger search on done (simple approach: search on every change with debounce-like behavior)
        LaunchedEffect(localSearch) {
            kotlinx.coroutines.delay(500)
            if (localSearch != searchQuery) {
                onSearchQueryChange(localSearch)
            }
        }

        // Owner filter dropdown
        Box {
            OutlinedButton(
                onClick = { ownerDropdownExpanded = true }
            ) {
                Text(
                    text = if (ownerFilter.isBlank()) "All Owners" else ownerFilter,
                    color = ParchmentText
                )
            }

            DropdownMenu(
                expanded = ownerDropdownExpanded,
                onDismissRequest = { ownerDropdownExpanded = false }
            ) {
                DropdownMenuItem(
                    text = { Text("All Owners") },
                    onClick = {
                        onOwnerFilterChange("")
                        ownerDropdownExpanded = false
                    }
                )
                owners.forEach { owner ->
                    DropdownMenuItem(
                        text = { Text(owner) },
                        onClick = {
                            onOwnerFilterChange(owner)
                            ownerDropdownExpanded = false
                        }
                    )
                }
            }
        }
    }
}

// ─── Chit Card ──────────────────────────────────────────────────────────────────

@OptIn(ExperimentalFoundationApi::class, ExperimentalLayoutApi::class)
@Composable
private fun AdminChitCard(
    chit: AdminChitItem,
    isSelected: Boolean,
    isSelectionMode: Boolean,
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
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.Top
        ) {
            // Checkbox in selection mode
            if (isSelectionMode) {
                Checkbox(
                    checked = isSelected,
                    onCheckedChange = { onClick() },
                    colors = CheckboxDefaults.colors(
                        checkedColor = ParchmentBrown
                    )
                )
                Spacer(modifier = Modifier.width(8.dp))
            }

            Column(modifier = Modifier.weight(1f)) {
                // Title + Status badge row
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = chit.title ?: "(untitled)",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold,
                        color = ParchmentText,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f)
                    )
                    if (!chit.status.isNullOrBlank()) {
                        Spacer(modifier = Modifier.width(8.dp))
                        StatusBadge(status = chit.status)
                    }
                }

                Spacer(modifier = Modifier.height(4.dp))

                // Owner
                if (!chit.ownerUsername.isNullOrBlank()) {
                    Text(
                        text = "Owner: ${chit.ownerUsername}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                // Created date
                if (!chit.createdDatetime.isNullOrBlank()) {
                    Text(
                        text = "Created: ${formatDate(chit.createdDatetime)}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                // Tags
                if (!chit.tags.isNullOrEmpty()) {
                    Spacer(modifier = Modifier.height(6.dp))
                    FlowRow(
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                        verticalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        chit.tags.forEach { tag ->
                            TagChip(tag = tag)
                        }
                    }
                }
            }
        }
    }
}

// ─── Status Badge ───────────────────────────────────────────────────────────────

@Composable
private fun StatusBadge(status: String) {
    val (backgroundColor, label) = when (status.lowercase()) {
        "todo" -> StatusTodo to "Todo"
        "in_progress" -> StatusInProgress to "In Progress"
        "blocked" -> StatusBlocked to "Blocked"
        "complete" -> StatusComplete to "Complete"
        else -> StatusTodo to status
    }

    Surface(
        shape = RoundedCornerShape(4.dp),
        color = backgroundColor
    ) {
        Text(
            text = label,
            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
            style = MaterialTheme.typography.labelSmall,
            color = Color.White,
            fontWeight = FontWeight.Bold
        )
    }
}

// ─── Tag Chip ───────────────────────────────────────────────────────────────────

@Composable
private fun TagChip(tag: String) {
    Surface(
        shape = RoundedCornerShape(12.dp),
        color = ParchmentBrown.copy(alpha = 0.12f)
    ) {
        Text(
            text = tag,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
            style = MaterialTheme.typography.labelSmall,
            color = ParchmentBrown
        )
    }
}

// ─── Bulk Action Bar ────────────────────────────────────────────────────────────

@Composable
private fun BulkActionBar(
    owners: List<String>,
    onDelete: () -> Unit,
    onChangeOwner: (String) -> Unit,
    onChangeStatus: (String) -> Unit
) {
    var showDeleteConfirm by remember { mutableStateOf(false) }
    var showOwnerDropdown by remember { mutableStateOf(false) }
    var showStatusDropdown by remember { mutableStateOf(false) }

    Surface(
        modifier = Modifier.fillMaxWidth(),
        shadowElevation = 8.dp,
        color = MaterialTheme.colorScheme.surface
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Delete button
            IconButton(onClick = { showDeleteConfirm = true }) {
                Icon(
                    Icons.Default.Delete,
                    contentDescription = "Delete selected",
                    tint = Color(0xFFC62828)
                )
            }

            // Change Owner
            Box {
                OutlinedButton(onClick = { showOwnerDropdown = true }) {
                    Text("Owner", color = ParchmentText)
                }
                DropdownMenu(
                    expanded = showOwnerDropdown,
                    onDismissRequest = { showOwnerDropdown = false }
                ) {
                    owners.forEach { owner ->
                        DropdownMenuItem(
                            text = { Text(owner) },
                            onClick = {
                                onChangeOwner(owner)
                                showOwnerDropdown = false
                            }
                        )
                    }
                }
            }

            // Change Status
            Box {
                OutlinedButton(onClick = { showStatusDropdown = true }) {
                    Text("Status", color = ParchmentText)
                }
                DropdownMenu(
                    expanded = showStatusDropdown,
                    onDismissRequest = { showStatusDropdown = false }
                ) {
                    val statuses = listOf("todo", "in_progress", "blocked", "complete")
                    statuses.forEach { status ->
                        DropdownMenuItem(
                            text = { Text(formatStatusLabel(status)) },
                            onClick = {
                                onChangeStatus(status)
                                showStatusDropdown = false
                            }
                        )
                    }
                }
            }
        }
    }

    // Delete confirmation dialog
    if (showDeleteConfirm) {
        AlertDialog(
            onDismissRequest = { showDeleteConfirm = false },
            title = { Text("Delete Chits", color = ParchmentText) },
            text = { Text("Are you sure you want to delete the selected chits? This action cannot be undone.") },
            confirmButton = {
                Button(
                    onClick = {
                        onDelete()
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

// ─── Pagination Controls ────────────────────────────────────────────────────────

@Composable
private fun PaginationControls(
    offset: Int,
    limit: Int,
    hasMore: Boolean,
    onPrevious: () -> Unit,
    onNext: () -> Unit
) {
    val page = (offset / limit) + 1

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        OutlinedButton(
            onClick = onPrevious,
            enabled = offset > 0
        ) {
            Text("Previous")
        }

        Text(
            text = "Page $page",
            style = MaterialTheme.typography.bodyMedium,
            color = ParchmentText
        )

        OutlinedButton(
            onClick = onNext,
            enabled = hasMore
        ) {
            Text("Next")
        }
    }
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
                color = MaterialTheme.colorScheme.error
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
            Text(
                text = "No chits found",
                style = MaterialTheme.typography.headlineSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "Try adjusting your filters",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

// ─── Utility Functions ──────────────────────────────────────────────────────────

private fun formatDate(dateStr: String): String {
    return try {
        val inputFormat = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", java.util.Locale.US)
        inputFormat.timeZone = java.util.TimeZone.getTimeZone("UTC")
        val date = inputFormat.parse(dateStr)
            ?: java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS", java.util.Locale.US).apply {
                timeZone = java.util.TimeZone.getTimeZone("UTC")
            }.parse(dateStr)
            ?: return dateStr

        val outputFormat = java.text.SimpleDateFormat("MMM d, yyyy", java.util.Locale.US)
        outputFormat.timeZone = java.util.TimeZone.getDefault()
        outputFormat.format(date)
    } catch (e: Exception) {
        dateStr
    }
}

private fun formatStatusLabel(status: String): String {
    return when (status) {
        "todo" -> "Todo"
        "in_progress" -> "In Progress"
        "blocked" -> "Blocked"
        "complete" -> "Complete"
        else -> status
    }
}
