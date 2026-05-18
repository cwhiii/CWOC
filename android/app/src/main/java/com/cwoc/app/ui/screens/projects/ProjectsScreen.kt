package com.cwoc.app.ui.screens.projects

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateContentSize
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
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
import androidx.hilt.navigation.compose.hiltViewModel
import com.cwoc.app.data.local.entity.ChitEntity
import com.cwoc.app.data.repository.ChitRepository
import com.cwoc.app.domain.filter.FilterEngine
import com.cwoc.app.domain.filter.FilterState
import com.cwoc.app.domain.sort.SortEngine
import com.cwoc.app.domain.sort.SortState
import com.cwoc.app.ui.components.ChitActionMenu
import com.cwoc.app.ui.components.CwocChitCardStyle
import com.cwoc.app.ui.components.SnoozePickerDialog
import com.cwoc.app.ui.viewmodel.FilterSortViewModel
import kotlinx.coroutines.launch

/**
 * Projects/Kanban view — displays project master chits with expandable Kanban boards.
 * Applies FilterEngine and SortEngine from FilterSortViewModel to the project list before rendering.
 * Long-press on a project card shows ChitActionMenu for pin/archive/snooze actions.
 *
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 9.8, 10.4
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun ProjectsScreen(
    onNavigateToEditor: (String) -> Unit,
    modifier: Modifier = Modifier,
    viewModel: ProjectsViewModel = hiltViewModel(),
    filterSortViewModel: FilterSortViewModel? = null,
    chitRepository: ChitRepository? = null
) {
    val projects by viewModel.projects.collectAsState()
    val expandedIds by viewModel.expandedProjects.collectAsState()

    // Projects view mode: "kanban" (default) or "list"
    var projectsMode by remember { mutableStateOf("kanban") }

    // Collect filter/sort state if ViewModel is provided
    val filterState = filterSortViewModel?.filterState?.collectAsState()?.value ?: FilterState()
    val sortState = filterSortViewModel?.sortState?.collectAsState()?.value ?: SortState()

    // Long-press action menu state
    var menuChit by remember { mutableStateOf<ChitEntity?>(null) }
    var showSnoozeDialog by remember { mutableStateOf(false) }
    val coroutineScope = rememberCoroutineScope()

    // Apply filters and sort to the project master chits
    val filteredSortedProjects = remember(projects, filterState, sortState) {
        val projectChits = projects.map { it.project }
        val filteredChits = FilterEngine.applyFilters(projectChits, filterState)
        val sortedChits = SortEngine.sort(filteredChits, sortState.field, sortState.direction)
        // Map back to ProjectWithChildren, preserving the filtered/sorted order
        val filteredIds = sortedChits.map { it.id }
        filteredIds.mapNotNull { id -> projects.find { it.project.id == id } }
    }

    // Check if filters are active (non-default state)
    val hasActiveFilters = filterState != FilterState()

    Box(modifier = modifier.fillMaxSize()) {
        when {
            filteredSortedProjects.isEmpty() && hasActiveFilters -> {
                FilteredEmptyState(
                    onClearFilters = { filterSortViewModel?.clearFilters() }
                )
            }
            projects.isEmpty() -> {
                EmptyProjectsState()
            }
            filteredSortedProjects.isEmpty() -> {
                FilteredEmptyState(
                    onClearFilters = { filterSortViewModel?.clearFilters() }
                )
            }
            else -> {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 12.dp, vertical = 8.dp)
                ) {
                    // FilterChip row for Kanban/List toggle
                    item {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(bottom = 8.dp),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            FilterChip(
                                selected = projectsMode == "kanban",
                                onClick = { projectsMode = "kanban" },
                                label = { Text("Kanban") }
                            )
                            FilterChip(
                                selected = projectsMode == "list",
                                onClick = { projectsMode = "list" },
                                label = { Text("List") }
                            )
                        }
                    }

                    when (projectsMode) {
                        "kanban" -> {
                            items(filteredSortedProjects, key = { it.project.id }) { projectWithChildren ->
                                ProjectCard(
                                    project = projectWithChildren,
                                    isExpanded = projectWithChildren.project.id in expandedIds,
                                    onToggleExpand = { viewModel.toggleExpanded(projectWithChildren.project.id) },
                                    onChildTap = { chitId -> onNavigateToEditor(chitId) },
                                    onLongPress = { menuChit = projectWithChildren.project }
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                            }
                        }
                        "list" -> {
                            filteredSortedProjects.forEach { projectWithChildren ->
                                val allChildren = projectWithChildren.children.values.flatten()
                                // Project header
                                item(key = "header-${projectWithChildren.project.id}") {
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clickable { onNavigateToEditor(projectWithChildren.project.id) }
                                            .padding(vertical = 8.dp),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text(
                                            text = projectWithChildren.project.title ?: "Untitled Project",
                                            style = MaterialTheme.typography.titleSmall,
                                            fontWeight = FontWeight.Bold,
                                            color = Color(0xFF6B4E31),
                                            modifier = Modifier.weight(1f),
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis
                                        )
                                        Text(
                                            text = "(${allChildren.size})",
                                            style = MaterialTheme.typography.labelMedium,
                                            color = Color(0xFF8B7355)
                                        )
                                    }
                                }
                                // Child chits indented below
                                items(allChildren, key = { it.id }) { child ->
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clickable { onNavigateToEditor(child.id) }
                                            .padding(start = 24.dp, top = 4.dp, bottom = 4.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                                    ) {
                                        Text(
                                            text = "▸",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = Color(0xFF6B4E31)
                                        )
                                        Text(
                                            text = child.title ?: "Untitled",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = Color(0xFF1A1208),
                                            modifier = Modifier.weight(1f),
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis
                                        )
                                        // Status badge
                                        if (!child.status.isNullOrBlank()) {
                                            val statusColor = when (child.status.lowercase()) {
                                                "complete", "completed", "done" -> Color(0xFF4A6741)
                                                "in progress", "inprogress" -> Color(0xFF2E6B8A)
                                                "blocked" -> Color(0xFFB33A3A)
                                                else -> Color(0xFF8B7355)
                                            }
                                            Text(
                                                text = child.status,
                                                style = MaterialTheme.typography.labelSmall,
                                                color = statusColor,
                                                fontWeight = FontWeight.Medium
                                            )
                                        }
                                        // Priority
                                        if (!child.priority.isNullOrBlank()) {
                                            Text(
                                                text = child.priority,
                                                style = MaterialTheme.typography.labelSmall,
                                                color = Color(0xFF8B5E3C)
                                            )
                                        }
                                        // Due date
                                        if (!child.dueDatetime.isNullOrBlank()) {
                                            Text(
                                                text = child.dueDatetime.take(10),
                                                style = MaterialTheme.typography.labelSmall,
                                                color = Color(0xFF8B7355)
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // ChitActionMenu for long-press
        val currentMenuChit = menuChit
        if (currentMenuChit != null) {
            ChitActionMenu(
                expanded = true,
                chit = currentMenuChit,
                onDismiss = { menuChit = null },
                onPin = {
                    chitRepository?.let { repo ->
                        coroutineScope.launch {
                            if (currentMenuChit.pinned) repo.unpin(currentMenuChit.id)
                            else repo.pin(currentMenuChit.id)
                        }
                    }
                },
                onArchive = {
                    chitRepository?.let { repo ->
                        coroutineScope.launch {
                            if (currentMenuChit.archived) repo.unarchive(currentMenuChit.id)
                            else repo.archive(currentMenuChit.id)
                        }
                    }
                },
                onSnooze = {
                    showSnoozeDialog = true
                },
                onEdit = { onNavigateToEditor(currentMenuChit.id) },
                onDelete = { /* Projects screen doesn't have soft-delete */ }
            )
        }

        // Snooze picker dialog
        if (showSnoozeDialog && currentMenuChit != null) {
            SnoozePickerDialog(
                onSnoozeSelected = { isoString ->
                    chitRepository?.let { repo ->
                        coroutineScope.launch {
                            repo.snooze(currentMenuChit.id, isoString)
                        }
                    }
                    showSnoozeDialog = false
                    menuChit = null
                },
                onDismiss = {
                    showSnoozeDialog = false
                }
            )
        }
    }
}

@Composable
private fun FilteredEmptyState(
    onClearFilters: () -> Unit
) {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = "No chits match filters",
                style = MaterialTheme.typography.headlineSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.height(12.dp))
            Button(onClick = onClearFilters) {
                Text("Clear Filters")
            }
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun ProjectCard(
    project: ProjectWithChildren,
    isExpanded: Boolean,
    onToggleExpand: () -> Unit,
    onChildTap: (String) -> Unit,
    onLongPress: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .animateContentSize()
            .combinedClickable(
                onClick = onToggleExpand,
                onLongClick = onLongPress
            ),
        border = CwocChitCardStyle.cardBorder,
        colors = CwocChitCardStyle.cardColors(),
        elevation = CwocChitCardStyle.cardElevation()
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            // Project header
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = project.project.title ?: "Untitled Project",
                    style = MaterialTheme.typography.titleSmall,
                    color = Color(0xFF6B4E31),
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.weight(1f),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Icon(
                    imageVector = if (isExpanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                    contentDescription = if (isExpanded) "Collapse" else "Expand",
                    tint = Color(0xFF6B4E31)
                )
            }

            // Pin indicator
            if (project.project.pinned) {
                Text(
                    text = "📌 Pinned",
                    style = MaterialTheme.typography.labelSmall,
                    color = Color(0xFF6B4E31),
                    modifier = Modifier.padding(top = 4.dp)
                )
            }

            // Q7: Project progress bar (% of children in Complete status)
            val totalChildren = project.children.values.sumOf { it.size }
            val completedChildren = (project.children[KanbanStatus.COMPLETE] ?: emptyList()).size
            if (totalChildren > 0) {
                Spacer(modifier = Modifier.height(4.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    LinearProgressIndicator(
                        progress = { completedChildren.toFloat() / totalChildren.toFloat() },
                        modifier = Modifier
                            .weight(1f)
                            .height(6.dp),
                        color = Color(0xFF4A6741),
                        trackColor = Color(0xFFEDE0D4)
                    )
                    Text(
                        text = "$completedChildren/$totalChildren",
                        style = MaterialTheme.typography.labelSmall,
                        color = Color(0xFF6B4E31)
                    )
                }
            }

            // Kanban board (expanded)
            AnimatedVisibility(
                visible = isExpanded,
                enter = expandVertically(),
                exit = shrinkVertically()
            ) {
                KanbanBoard(
                    columns = project.children,
                    onChildTap = onChildTap
                )
            }
        }
    }
}

@Composable
private fun KanbanBoard(
    columns: Map<KanbanStatus, List<ChitEntity>>,
    onChildTap: (String) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 8.dp)
            .horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        KanbanStatus.entries.forEach { status ->
            val chits = columns[status] ?: emptyList()
            KanbanColumnView(
                status = status,
                chits = chits,
                onChildTap = onChildTap
            )
        }
    }
}

@Composable
private fun KanbanColumnView(
    status: KanbanStatus,
    chits: List<ChitEntity>,
    onChildTap: (String) -> Unit,
    // Q5: Add existing chit to this column
    onAddExisting: (() -> Unit)? = null,
    // Q6: Create new child in this column
    onCreateNew: (() -> Unit)? = null
) {
    Column(
        modifier = Modifier
            .width(140.dp)
            .clip(RoundedCornerShape(8.dp))
            .background(Color(0xFFEDE0D0))
            .padding(8.dp)
    ) {
        // Column header with count badge
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = status.displayName,
                style = MaterialTheme.typography.labelSmall,
                color = Color(0xFF6B4E31),
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.width(4.dp))
            Box(
                modifier = Modifier
                    .size(18.dp)
                    .clip(CircleShape)
                    .background(Color(0xFF6B4E31)),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "${chits.size}",
                    color = Color.White,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }

        Spacer(modifier = Modifier.height(6.dp))

        // Child chit cards with Q2 (due date) and Q3 (status indicator)
        chits.forEach { chit ->
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 2.dp)
                    .clickable { onChildTap(chit.id) },
                border = CwocChitCardStyle.cardBorder,
                colors = CwocChitCardStyle.cardColors(),
                elevation = CwocChitCardStyle.cardElevation()
            ) {
                Column(modifier = Modifier.padding(6.dp)) {
                    Text(
                        text = chit.title ?: "Untitled",
                        style = MaterialTheme.typography.bodySmall,
                        color = Color(0xFF1A1208),
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                    // Q2: Due date on child cards
                    if (chit.dueDatetime != null) {
                        Text(
                            text = "Due: ${chit.dueDatetime.take(10)}",
                            style = MaterialTheme.typography.labelSmall,
                            color = Color(0xFF8B7355),
                            fontSize = 9.sp
                        )
                    }
                }
            }
        }

        if (chits.isEmpty()) {
            Text(
                text = "—",
                style = MaterialTheme.typography.bodySmall,
                color = Color(0xFFAA9977),
                modifier = Modifier.padding(4.dp)
            )
        }

        // Q5/Q6: Add buttons at bottom of column
        Spacer(modifier = Modifier.height(4.dp))
        if (onAddExisting != null) {
            Text(
                text = "+ Add",
                style = MaterialTheme.typography.labelSmall,
                color = Color(0xFF6B4E31),
                modifier = Modifier
                    .clickable { onAddExisting() }
                    .padding(4.dp)
            )
        }
    }
}

@Composable
private fun EmptyProjectsState() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Spacer(modifier = Modifier.height(120.dp))
        Text(
            text = "No projects yet",
            style = MaterialTheme.typography.titleMedium,
            color = Color(0xFF6B4E31)
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "Create a project chit with child chits to see them here.",
            style = MaterialTheme.typography.bodyMedium,
            color = Color(0xFF8B7355)
        )
    }
}
