package com.cwoc.app.ui.screens.projects

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateContentSize
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
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
import com.cwoc.app.ui.components.CwocPromptDialog
import com.cwoc.app.ui.components.SnoozePickerDialog
import com.cwoc.app.ui.components.chitColorBorder
import com.cwoc.app.ui.components.parseHexColor
import com.cwoc.app.ui.viewmodel.FilterSortViewModel
import com.cwoc.app.ui.viewmodel.SidebarStateViewModel
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
    chitRepository: ChitRepository? = null,
    sidebarStateViewModel: SidebarStateViewModel? = null
) {
    val projects by viewModel.projects.collectAsState()
    val expandedIds by viewModel.expandedProjects.collectAsState()

    // Projects view mode: read from sidebar state (controlled by sidebar buttons)
    val projectsMode = sidebarStateViewModel?.state?.collectAsState()?.value?.projectsViewMode ?: "kanban"

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
                    when (projectsMode) {
                        "kanban" -> {
                            items(filteredSortedProjects, key = { it.project.id }) { projectWithChildren ->
                                ProjectCard(
                                    project = projectWithChildren,
                                    isExpanded = projectWithChildren.project.id in expandedIds,
                                    onToggleExpand = { viewModel.toggleExpanded(projectWithChildren.project.id) },
                                    onChildTap = { chitId -> onNavigateToEditor(chitId) },
                                    onLongPress = { menuChit = projectWithChildren.project },
                                    onCreateChild = { title -> viewModel.createChildChit(projectWithChildren.project.id, title) }
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
    onLongPress: () -> Unit,
    onCreateChild: (String) -> Unit = {}
) {
    // Determine project card background color from chit color
    val projectBgColor = remember(project.project.color) {
        if (!project.project.color.isNullOrBlank() && project.project.color != "transparent") {
            parseHexColor(project.project.color) ?: CwocChitCardStyle.CardBackground
        } else {
            CwocChitCardStyle.CardBackground
        }
    }
    // Contrast text color for the project header
    val projectTextColor = remember(projectBgColor) {
        val luminance = (0.299f * projectBgColor.red + 0.587f * projectBgColor.green + 0.114f * projectBgColor.blue)
        if (luminance > 0.5f) Color(0xFF1A1208) else Color(0xFFFDF5E6)
    }

    // State for the "Create New Child Chit" dialog
    var showCreateChildDialog by remember { mutableStateOf(false) }

    if (showCreateChildDialog) {
        CwocPromptDialog(
            title = "Create New Child Chit",
            placeholder = "Enter chit title\u2026",
            onConfirm = { title ->
                onCreateChild(title)
                showCreateChildDialog = false
            },
            onDismiss = { showCreateChildDialog = false },
            confirmLabel = "Create"
        )
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .chitColorBorder(project.project.color)
            .animateContentSize()
            .combinedClickable(
                onClick = onToggleExpand,
                onLongClick = onLongPress
            ),
        border = CwocChitCardStyle.cardBorder,
        colors = CardDefaults.cardColors(containerColor = projectBgColor),
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
                    color = projectTextColor,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.weight(1f),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                // "+" button to create a new child chit
                IconButton(
                    onClick = { showCreateChildDialog = true },
                    modifier = Modifier.size(28.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Add,
                        contentDescription = "Create new child chit",
                        tint = projectTextColor,
                        modifier = Modifier.size(18.dp)
                    )
                }
                Icon(
                    imageVector = if (isExpanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                    contentDescription = if (isExpanded) "Collapse" else "Expand",
                    tint = projectTextColor
                )
            }

            // Pin indicator
            if (project.project.pinned) {
                Text(
                    text = "📌 Pinned",
                    style = MaterialTheme.typography.labelSmall,
                    color = projectTextColor.copy(alpha = 0.7f),
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
                        color = projectTextColor.copy(alpha = 0.8f)
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
            .padding(top = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        KanbanStatus.entries.forEach { status ->
            val chits = columns[status] ?: emptyList()
            KanbanColumnView(
                status = status,
                chits = chits,
                onChildTap = onChildTap,
                modifier = Modifier.weight(1f)
            )
        }
    }
}

@Composable
private fun KanbanColumnView(
    status: KanbanStatus,
    chits: List<ChitEntity>,
    onChildTap: (String) -> Unit,
    modifier: Modifier = Modifier,
    // Q5: Add existing chit to this column
    onAddExisting: (() -> Unit)? = null,
    // Q6: Create new child in this column
    onCreateNew: (() -> Unit)? = null
) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(8.dp))
            .background(Color(0xFFEDE0D0))
            .padding(4.dp)
    ) {
        // Column header with count badge
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = status.displayName,
                style = MaterialTheme.typography.labelSmall,
                color = Color(0xFF6B4E31),
                fontWeight = FontWeight.Bold,
                fontSize = 9.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f, fill = false)
            )
            Spacer(modifier = Modifier.width(2.dp))
            Box(
                modifier = Modifier
                    .size(16.dp)
                    .clip(CircleShape)
                    .background(Color(0xFF6B4E31)),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "${chits.size}",
                    color = Color.White,
                    fontSize = 8.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }

        Spacer(modifier = Modifier.height(4.dp))

        // Child chit cards with colors applied
        chits.forEach { chit ->
            // Determine card background from chit color
            val cardBgColor = remember(chit.color) {
                if (!chit.color.isNullOrBlank() && chit.color != "transparent") {
                    parseHexColor(chit.color) ?: CwocChitCardStyle.CardBackground
                } else {
                    CwocChitCardStyle.CardBackground
                }
            }
            val cardTextColor = remember(cardBgColor) {
                val luminance = (0.299f * cardBgColor.red + 0.587f * cardBgColor.green + 0.114f * cardBgColor.blue)
                if (luminance > 0.5f) Color(0xFF1A1208) else Color(0xFFFDF5E6)
            }

            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 2.dp)
                    .clickable { onChildTap(chit.id) },
                border = CwocChitCardStyle.cardBorder,
                colors = CardDefaults.cardColors(containerColor = cardBgColor),
                elevation = CwocChitCardStyle.cardElevation()
            ) {
                Column(modifier = Modifier.padding(4.dp)) {
                    Text(
                        text = chit.title ?: "Untitled",
                        style = MaterialTheme.typography.bodySmall,
                        color = cardTextColor,
                        fontSize = 10.sp,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                    // Due date on child cards
                    if (chit.dueDatetime != null) {
                        Text(
                            text = "Due: ${chit.dueDatetime.take(10)}",
                            style = MaterialTheme.typography.labelSmall,
                            color = cardTextColor.copy(alpha = 0.7f),
                            fontSize = 8.sp
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
