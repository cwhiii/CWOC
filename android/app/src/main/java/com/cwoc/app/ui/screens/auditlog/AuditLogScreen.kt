package com.cwoc.app.ui.screens.auditlog

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.rememberDatePickerState
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
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

// ─── Theme Colors ───────────────────────────────────────────────────────────────

private val ParchmentBrown = Color(0xFF6B4E31)
private val ParchmentText = Color(0xFF4A3520)
private val ActionCreated = Color(0xFF2E7D32)
private val ActionUpdated = Color(0xFF1565C0)
private val ActionDeleted = Color(0xFFC62828)

// ─── Entity Type Filter Options ─────────────────────────────────────────────────

private val entityTypeFilters = listOf(
    "" to "All",
    "chit" to "Chits",
    "contact" to "Contacts",
    "indicator" to "Ind. Alerts",
    "settings" to "Settings",
    "system" to "System"
)

// ─── Sort Options ───────────────────────────────────────────────────────────────

private data class SortOption(
    val label: String,
    val sortBy: String,
    val sortOrder: String
)

private val sortOptions = listOf(
    SortOption("Time ▼", "timestamp", "desc"),
    SortOption("Time ▲", "timestamp", "asc"),
    SortOption("Entity", "entity_type", "asc"),
    SortOption("Actor", "actor", "asc")
)

// ─── Page Size Options ──────────────────────────────────────────────────────────

private val pageSizeOptions = listOf(25, 50, 100, 200)

// ─── Main Screen ────────────────────────────────────────────────────────────────

/**
 * Audit Log screen displaying paginated audit entries with filtering by entity type
 * and date range. Each entry shows timestamp, actor, action badge, entity info, and
 * collapsible changes list.
 *
 * Validates: Requirements 2.1, 2.2
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AuditLogScreen(
    onNavigateBack: () -> Unit,
    onNavigateToEditor: ((String) -> Unit)? = null,
    initialEntityType: String? = null,
    initialEntityId: String? = null,
    viewModel: AuditLogViewModel = hiltViewModel()
) {
    val entries by viewModel.entries.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val isExporting by viewModel.isExporting.collectAsState()
    val error by viewModel.error.collectAsState()
    val entityTypeFilter by viewModel.entityTypeFilter.collectAsState()

    // Apply initial filters from navigation args (deep-link support)
    LaunchedEffect(initialEntityType) {
        if (!initialEntityType.isNullOrBlank()) {
            viewModel.setEntityTypeFilter(initialEntityType)
        }
    }
    val actorFilter by viewModel.actorFilter.collectAsState()
    val sinceFilter by viewModel.sinceFilter.collectAsState()
    val untilFilter by viewModel.untilFilter.collectAsState()
    val offset by viewModel.offset.collectAsState()
    val limit by viewModel.limit.collectAsState()
    val total by viewModel.total.collectAsState()
    val sortBy by viewModel.sortBy.collectAsState()
    val sortOrder by viewModel.sortOrder.collectAsState()
    val uniqueActors by viewModel.uniqueActors.collectAsState()

    // Date picker state
    var showSincePicker by remember { mutableStateOf(false) }
    var showUntilPicker by remember { mutableStateOf(false) }
    var showPruneDialog by remember { mutableStateOf(false) }
    var showRevertConfirm by remember { mutableStateOf<String?>(null) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Audit Log") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back"
                        )
                    }
                },
                actions = {
                    // CSV Export button
                    IconButton(
                        onClick = { viewModel.exportCsv() },
                        enabled = !isExporting
                    ) {
                        if (isExporting) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(20.dp),
                                strokeWidth = 2.dp,
                                color = ParchmentBrown
                            )
                        } else {
                            Icon(
                                imageVector = Icons.Default.Share,
                                contentDescription = "Export CSV",
                                tint = ParchmentBrown
                            )
                        }
                    }
                    // Prune/Delete button
                    IconButton(onClick = { showPruneDialog = true }) {
                        Icon(
                            imageVector = Icons.Default.Delete,
                            contentDescription = "Delete old entries",
                            tint = MaterialTheme.colorScheme.error
                        )
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
            // Filter chips row
            EntityTypeFilterRow(
                selectedFilter = entityTypeFilter,
                onFilterSelected = { viewModel.setEntityTypeFilter(it) }
            )

            // Actor filter + Sort + Page size row
            FilterControlsRow(
                actorFilter = actorFilter,
                uniqueActors = uniqueActors,
                onActorSelected = { viewModel.setActorFilter(it) },
                sortBy = sortBy,
                sortOrder = sortOrder,
                onSortSelected = { option -> viewModel.setSort(option.sortBy, option.sortOrder) },
                pageSize = limit,
                onPageSizeSelected = { viewModel.setPageSize(it) }
            )

            // Date range row
            DateRangeRow(
                sinceFilter = sinceFilter,
                untilFilter = untilFilter,
                onSinceClick = { showSincePicker = true },
                onUntilClick = { showUntilPicker = true },
                onClearDates = { viewModel.setDateRange(null, null) }
            )

            // Content area
            when {
                isLoading -> LoadingState()
                error != null -> ErrorState(
                    message = error!!,
                    onRetry = { viewModel.loadEntries() }
                )
                entries.isEmpty() -> EmptyState()
                else -> {
                    // Entry list
                    LazyColumn(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        item { Spacer(modifier = Modifier.height(4.dp)) }
                        items(entries, key = { it.id }) { entry ->
                            AuditEntryCard(
                                entry = entry,
                                onNavigateToEditor = onNavigateToEditor,
                                onRevert = { entryId -> showRevertConfirm = entryId }
                            )
                        }
                        item { Spacer(modifier = Modifier.height(8.dp)) }
                    }

                    // Pagination controls
                    PaginationControls(
                        offset = offset,
                        limit = limit,
                        total = total,
                        onPrevious = { viewModel.previousPage() },
                        onNext = { viewModel.nextPage() }
                    )
                }
            }
        }
    }

    // Date picker dialogs
    if (showSincePicker) {
        AuditDatePickerDialog(
            title = "From Date",
            onDateSelected = { dateStr ->
                viewModel.setDateRange(dateStr, untilFilter)
                showSincePicker = false
            },
            onDismiss = { showSincePicker = false }
        )
    }

    if (showUntilPicker) {
        AuditDatePickerDialog(
            title = "Until Date",
            onDateSelected = { dateStr ->
                viewModel.setDateRange(sinceFilter, dateStr)
                showUntilPicker = false
            },
            onDismiss = { showUntilPicker = false }
        )
    }

    // Prune dialog
    if (showPruneDialog) {
        PruneAuditDialog(
            onConfirm = { days ->
                viewModel.pruneEntries(days)
                showPruneDialog = false
            },
            onDismiss = { showPruneDialog = false }
        )
    }

    // Revert confirmation dialog
    showRevertConfirm?.let { entryId ->
        AlertDialog(
            onDismissRequest = { showRevertConfirm = null },
            title = { Text("⏪ Revert Chit?") },
            text = { Text("This will undo the changes from this edit and create a new audit entry.") },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.revertEntry(entryId)
                    showRevertConfirm = null
                }) {
                    Text("Revert", color = Color(0xFF0C5460))
                }
            },
            dismissButton = {
                TextButton(onClick = { showRevertConfirm = null }) {
                    Text("Cancel")
                }
            }
        )
    }
}

// ─── Filter Components ──────────────────────────────────────────────────────────

@Composable
private fun EntityTypeFilterRow(
    selectedFilter: String,
    onFilterSelected: (String) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState())
            .padding(horizontal = 16.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        entityTypeFilters.forEach { (value, label) ->
            FilterChip(
                selected = selectedFilter == value,
                onClick = { onFilterSelected(value) },
                label = { Text(label) },
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = ParchmentBrown,
                    selectedLabelColor = Color.White
                )
            )
        }
    }
}

@Composable
private fun FilterControlsRow(
    actorFilter: String,
    uniqueActors: List<String>,
    onActorSelected: (String) -> Unit,
    sortBy: String,
    sortOrder: String,
    onSortSelected: (SortOption) -> Unit,
    pageSize: Int,
    onPageSizeSelected: (Int) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Actor filter dropdown
        ActorFilterDropdown(
            selectedActor = actorFilter,
            actors = uniqueActors,
            onActorSelected = onActorSelected,
            modifier = Modifier.weight(1f)
        )

        // Sort dropdown
        SortDropdown(
            sortBy = sortBy,
            sortOrder = sortOrder,
            onSortSelected = onSortSelected,
            modifier = Modifier.weight(1f)
        )

        // Page size dropdown
        PageSizeDropdown(
            pageSize = pageSize,
            onPageSizeSelected = onPageSizeSelected,
            modifier = Modifier.weight(0.7f)
        )
    }
}

@Composable
private fun ActorFilterDropdown(
    selectedActor: String,
    actors: List<String>,
    onActorSelected: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    var expanded by remember { mutableStateOf(false) }

    Box(modifier = modifier) {
        OutlinedButton(
            onClick = { expanded = true },
            modifier = Modifier.fillMaxWidth()
        ) {
            Text(
                text = if (selectedActor.isBlank()) "Actor" else selectedActor,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                style = MaterialTheme.typography.bodySmall
            )
        }

        DropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false }
        ) {
            DropdownMenuItem(
                text = { Text("All Actors") },
                onClick = {
                    onActorSelected("")
                    expanded = false
                }
            )
            actors.forEach { actor ->
                DropdownMenuItem(
                    text = { Text(actor, maxLines = 1, overflow = TextOverflow.Ellipsis) },
                    onClick = {
                        onActorSelected(actor)
                        expanded = false
                    }
                )
            }
        }
    }
}

@Composable
private fun SortDropdown(
    sortBy: String,
    sortOrder: String,
    onSortSelected: (SortOption) -> Unit,
    modifier: Modifier = Modifier
) {
    var expanded by remember { mutableStateOf(false) }
    val currentLabel = sortOptions.find { it.sortBy == sortBy && it.sortOrder == sortOrder }?.label
        ?: sortOptions.first().label

    Box(modifier = modifier) {
        OutlinedButton(
            onClick = { expanded = true },
            modifier = Modifier.fillMaxWidth()
        ) {
            Text(
                text = currentLabel,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                style = MaterialTheme.typography.bodySmall
            )
        }

        DropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false }
        ) {
            sortOptions.forEach { option ->
                DropdownMenuItem(
                    text = { Text(option.label) },
                    onClick = {
                        onSortSelected(option)
                        expanded = false
                    }
                )
            }
        }
    }
}

@Composable
private fun PageSizeDropdown(
    pageSize: Int,
    onPageSizeSelected: (Int) -> Unit,
    modifier: Modifier = Modifier
) {
    var expanded by remember { mutableStateOf(false) }

    Box(modifier = modifier) {
        OutlinedButton(
            onClick = { expanded = true },
            modifier = Modifier.fillMaxWidth()
        ) {
            Text(
                text = "$pageSize",
                maxLines = 1,
                style = MaterialTheme.typography.bodySmall
            )
        }

        DropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false }
        ) {
            pageSizeOptions.forEach { size ->
                DropdownMenuItem(
                    text = { Text("$size per page") },
                    onClick = {
                        onPageSizeSelected(size)
                        expanded = false
                    }
                )
            }
        }
    }
}

@Composable
private fun DateRangeRow(
    sinceFilter: String?,
    untilFilter: String?,
    onSinceClick: () -> Unit,
    onUntilClick: () -> Unit,
    onClearDates: () -> Unit
) {
    val hasDateFilter = sinceFilter != null || untilFilter != null

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        OutlinedButton(
            onClick = onSinceClick,
            modifier = Modifier.weight(1f)
        ) {
            Icon(
                imageVector = Icons.Default.DateRange,
                contentDescription = null,
                modifier = Modifier.size(16.dp)
            )
            Spacer(modifier = Modifier.width(4.dp))
            Text(
                text = sinceFilter?.let { formatDateLabel(it) } ?: "From",
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }

        OutlinedButton(
            onClick = onUntilClick,
            modifier = Modifier.weight(1f)
        ) {
            Icon(
                imageVector = Icons.Default.DateRange,
                contentDescription = null,
                modifier = Modifier.size(16.dp)
            )
            Spacer(modifier = Modifier.width(4.dp))
            Text(
                text = untilFilter?.let { formatDateLabel(it) } ?: "Until",
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }

        if (hasDateFilter) {
            TextButton(onClick = onClearDates) {
                Text("Clear", color = ParchmentBrown)
            }
        }
    }
}

// ─── Entry Card ─────────────────────────────────────────────────────────────────

@Composable
private fun AuditEntryCard(
    entry: AuditEntry,
    onNavigateToEditor: ((String) -> Unit)? = null,
    onRevert: ((String) -> Unit)? = null
) {
    var expanded by remember { mutableStateOf(false) }
    val changes = entry.changes ?: emptyList()
    val hasMoreChanges = changes.size > 2

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
        onClick = {
            // Navigate to editor if entity is a chit
            if (entry.entityType == "chit" && entry.entityId != null && onNavigateToEditor != null) {
                onNavigateToEditor(entry.entityId)
            }
        }
    ) {
        Column(
            modifier = Modifier.padding(12.dp)
        ) {
            // Top row: timestamp + actor
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = formatTimestamp(entry.timestamp),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    text = entry.actorDisplayName ?: entry.actor ?: "System",
                    style = MaterialTheme.typography.bodySmall,
                    fontWeight = FontWeight.Medium,
                    color = ParchmentText
                )
            }

            Spacer(modifier = Modifier.height(6.dp))

            // Action badge + entity info row
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                ActionBadge(action = entry.action)
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = entry.entityType.replaceFirstChar { it.uppercase() },
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    if (!entry.entityTitle.isNullOrBlank()) {
                        Text(
                            text = entry.entityTitle,
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = FontWeight.Medium,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            color = ParchmentText
                        )
                    } else if (!entry.entityId.isNullOrBlank()) {
                        Text(
                            text = entry.entityId,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }
            }

            // Changes section
            if (changes.isNotEmpty()) {
                Spacer(modifier = Modifier.height(8.dp))

                val visibleChanges = if (expanded || !hasMoreChanges) changes else changes.take(2)
                visibleChanges.forEach { change ->
                    ChangeRow(change = change)
                }

                if (hasMoreChanges) {
                    TextButton(
                        onClick = { expanded = !expanded },
                        modifier = Modifier.padding(top = 2.dp)
                    ) {
                        Text(
                            text = if (expanded) "Show less" else "Show more (${changes.size - 2} more)",
                            color = ParchmentBrown,
                            style = MaterialTheme.typography.labelSmall
                        )
                    }
                }

                // Revert button — only for "updated" chit entries with changes
                if (entry.action.lowercase() == "updated" && entry.entityType == "chit" && entry.entityId != null && onRevert != null) {
                    TextButton(
                        onClick = { onRevert(entry.id) },
                        modifier = Modifier.padding(top = 2.dp)
                    ) {
                        Text(
                            text = "⏪ Revert",
                            color = Color(0xFF0C5460),
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun ActionBadge(action: String) {
    val (backgroundColor, textColor) = when (action.lowercase()) {
        "created", "create" -> ActionCreated to Color.White
        "updated", "update" -> ActionUpdated to Color.White
        "deleted", "delete" -> ActionDeleted to Color.White
        else -> MaterialTheme.colorScheme.surfaceVariant to MaterialTheme.colorScheme.onSurfaceVariant
    }

    Surface(
        shape = RoundedCornerShape(4.dp),
        color = backgroundColor
    ) {
        Text(
            text = action.replaceFirstChar { it.uppercase() },
            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
            style = MaterialTheme.typography.labelSmall,
            color = textColor,
            fontWeight = FontWeight.Bold
        )
    }
}

@Composable
private fun ChangeRow(change: AuditChange) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 2.dp),
        verticalAlignment = Alignment.Top
    ) {
        Text(
            text = "${change.field}: ",
            style = MaterialTheme.typography.bodySmall,
            fontWeight = FontWeight.Medium,
            color = ParchmentText
        )
        Text(
            text = buildChangeText(change),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis
        )
    }
}

private fun buildChangeText(change: AuditChange): String {
    val old = change.oldValue ?: "∅"
    val new = change.newValue ?: "∅"
    return "$old → $new"
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
                colors = ButtonDefaults.buttonColors(
                    containerColor = ParchmentBrown
                )
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
                text = "No audit entries found",
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

// ─── Pagination ─────────────────────────────────────────────────────────────────

@Composable
private fun PaginationControls(
    offset: Int,
    limit: Int,
    total: Int,
    onPrevious: () -> Unit,
    onNext: () -> Unit
) {
    val currentPage = (offset / limit) + 1
    val totalPages = if (total == 0) 1 else ((total - 1) / limit) + 1
    val hasPrevious = offset > 0
    val hasNext = (offset + limit) < total

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        TextButton(
            onClick = onPrevious,
            enabled = hasPrevious
        ) {
            Icon(
                imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                contentDescription = null,
                modifier = Modifier.size(16.dp)
            )
            Spacer(modifier = Modifier.width(4.dp))
            Text("Previous")
        }

        Text(
            text = "Page $currentPage of $totalPages",
            style = MaterialTheme.typography.bodyMedium,
            color = ParchmentText
        )

        TextButton(
            onClick = onNext,
            enabled = hasNext
        ) {
            Text("Next")
            Spacer(modifier = Modifier.width(4.dp))
            Icon(
                imageVector = Icons.AutoMirrored.Filled.ArrowForward,
                contentDescription = null,
                modifier = Modifier.size(16.dp)
            )
        }
    }
}

// ─── Date Picker Dialog ─────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AuditDatePickerDialog(
    title: String,
    onDateSelected: (String) -> Unit,
    onDismiss: () -> Unit
) {
    val datePickerState = rememberDatePickerState()

    DatePickerDialog(
        onDismissRequest = onDismiss,
        confirmButton = {
            TextButton(
                onClick = {
                    datePickerState.selectedDateMillis?.let { millis ->
                        val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.US)
                        sdf.timeZone = TimeZone.getTimeZone("UTC")
                        onDateSelected(sdf.format(Date(millis)))
                    } ?: onDismiss()
                }
            ) {
                Text("OK", color = ParchmentBrown)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel", color = ParchmentBrown)
            }
        }
    ) {
        Column {
            Text(
                text = title,
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.padding(start = 24.dp, top = 16.dp)
            )
            DatePicker(state = datePickerState)
        }
    }
}

// ─── Utility Functions ──────────────────────────────────────────────────────────

/**
 * Formats an ISO timestamp string into a friendly display format like "May 15, 2:30 PM".
 */
private fun formatTimestamp(timestamp: String): String {
    return try {
        // Try ISO 8601 format
        val inputFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US)
        inputFormat.timeZone = TimeZone.getTimeZone("UTC")
        val date = inputFormat.parse(timestamp)
            ?: // Try with milliseconds
            SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS", Locale.US).apply {
                timeZone = TimeZone.getTimeZone("UTC")
            }.parse(timestamp)
            ?: return timestamp

        val outputFormat = SimpleDateFormat("MMM d, h:mm a", Locale.US)
        outputFormat.timeZone = TimeZone.getDefault()
        outputFormat.format(date)
    } catch (e: Exception) {
        timestamp
    }
}

/**
 * Formats a date string (yyyy-MM-dd) into a short label like "May 15".
 */
private fun formatDateLabel(dateStr: String): String {
    return try {
        val inputFormat = SimpleDateFormat("yyyy-MM-dd", Locale.US)
        val date = inputFormat.parse(dateStr) ?: return dateStr
        val outputFormat = SimpleDateFormat("MMM d", Locale.US)
        outputFormat.format(date)
    } catch (e: Exception) {
        dateStr
    }
}

// ─── Prune Audit Dialog ─────────────────────────────────────────────────────────

private val pruneOptions = listOf(
    7 to "Older than 7 days",
    30 to "Older than 30 days",
    90 to "Older than 90 days",
    180 to "Older than 6 months",
    365 to "Older than 1 year"
)

@Composable
private fun PruneAuditDialog(
    onConfirm: (Int) -> Unit,
    onDismiss: () -> Unit
) {
    var selectedDays by remember { mutableStateOf<Int?>(null) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("🗑️ Delete Audit Logs") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Select entries to delete:", style = MaterialTheme.typography.bodyMedium)
                pruneOptions.forEach { (days, label) ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { selectedDays = days }
                            .padding(vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        androidx.compose.material3.RadioButton(
                            selected = selectedDays == days,
                            onClick = { selectedDays = days }
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(label, style = MaterialTheme.typography.bodyMedium)
                    }
                }
                Text(
                    "⚠️ This cannot be undone.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = { selectedDays?.let { onConfirm(it) } },
                enabled = selectedDays != null
            ) {
                Text("☢️ Delete", color = MaterialTheme.colorScheme.error)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}
