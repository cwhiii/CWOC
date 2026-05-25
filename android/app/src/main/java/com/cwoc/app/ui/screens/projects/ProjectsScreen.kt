package com.cwoc.app.ui.screens.projects

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateContentSize
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.ExperimentalFoundationApi
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
import androidx.compose.foundation.lazy.staggeredgrid.StaggeredGridCells
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.cwoc.app.data.local.entity.ChitEntity
import com.cwoc.app.data.repository.ChitRepository
import com.cwoc.app.data.sync.SyncState
import com.cwoc.app.domain.filter.FilterEngine
import com.cwoc.app.domain.filter.FilterState
import com.cwoc.app.domain.sort.SortEngine
import com.cwoc.app.domain.sort.SortField
import com.cwoc.app.domain.sort.SortState
import com.cwoc.app.ui.components.CwocChitCardStyle
import com.cwoc.app.ui.components.CwocPromptDialog
import com.cwoc.app.ui.components.LoadingChitsState
import com.cwoc.app.ui.components.ReorderableStaggeredGrid
import com.cwoc.app.ui.components.parseHexColor
import com.cwoc.app.ui.viewmodel.FilterSortViewModel
import com.cwoc.app.ui.viewmodel.SidebarStateViewModel

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
    val syncState by viewModel.syncState.collectAsState()

    // Projects view mode: read from sidebar state (controlled by sidebar buttons)
    val projectsMode = sidebarStateViewModel?.state?.collectAsState()?.value?.projectsViewMode ?: "kanban"

    // Collect filter/sort state if ViewModel is provided
    val filterState = filterSortViewModel?.filterState?.collectAsState()?.value ?: FilterState()
    val sortState = filterSortViewModel?.sortState?.collectAsState()?.value ?: SortState()

    // Determine if manual sort is active (enables drag-to-reorder)
    val isManualSort = sortState.field == SortField.MANUAL

    // Project header count settings
    val showChildCount by viewModel.showChildCount.collectAsState()
    val showChecklistCount by viewModel.showChecklistCount.collectAsState()

    // Apply filters and sort to the project master chits
    // Read manual order directly from ChitReorderHelper (uses "Projects" key directly,
    // doesn't depend on FilterSortViewModel.currentTabRoute being set)
    val manualOrder = remember(projects) {
        viewModel.getManualOrder()
    }

    val filteredSortedProjects = remember(projects, filterState, sortState, manualOrder) {
        val projectChits = projects.map { it.project }
        val filteredChits = FilterEngine.applyFilters(projectChits, filterState)
        val sortedChits = if (manualOrder.isNotEmpty() && (sortState.field == SortField.MANUAL || sortState.field == SortField.NONE)) {
            // Apply saved manual order: items in order come first, then new items at end
            val orderMap = manualOrder.withIndex().associate { (i, id) -> id to i }
            filteredChits.sortedBy { orderMap[it.id] ?: Int.MAX_VALUE }
        } else if (sortState.field == SortField.NONE || sortState.field == SortField.MANUAL) {
            // No manual order saved and no explicit sort — preserve original order
            filteredChits
        } else {
            SortEngine.sort(filteredChits, sortState.field, sortState.direction)
        }
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
            projects.isEmpty() && syncState == SyncState.SYNCING -> {
                LoadingChitsState()
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
                when (projectsMode) {
                    "kanban" -> {
                        // Kanban mode: project cards with expandable boards
                        // Uses ReorderableStaggeredGrid for drag-to-reorder when sort is manual
                        ReorderableStaggeredGrid(
                            items = filteredSortedProjects,
                            key = { it.project.id },
                            columns = StaggeredGridCells.Fixed(1),
                            onReorder = { fromIndex, toIndex ->
                                viewModel.reorderProjects(filteredSortedProjects, fromIndex, toIndex)
                            },
                            enabled = isManualSort,
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(horizontal = 4.dp, vertical = 4.dp),
                            verticalItemSpacing = 6.dp
                        ) { projectWithChildren, _ ->
                            ProjectCard(
                                project = projectWithChildren,
                                isExpanded = expandedIds?.contains(projectWithChildren.project.id) ?: true,
                                onToggleExpand = { viewModel.toggleExpanded(projectWithChildren.project.id) },
                                onChildTap = { chitId -> onNavigateToEditor(chitId) },
                                onLongPress = { /* No context menu on project masters */ },
                                onCreateChild = { title -> viewModel.createChildChit(projectWithChildren.project.id, title) },
                                onStatusChange = { chitId, newStatus -> viewModel.moveToColumn(chitId, newStatus) },
                                showChildCount = showChildCount,
                                showChecklistCount = showChecklistCount
                            )
                        }
                    }
                    "list" -> {
                        LazyColumn(
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(horizontal = 12.dp, vertical = 8.dp)
                        ) {
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
    onCreateChild: (String) -> Unit = {},
    onStatusChange: ((String, KanbanStatus) -> Unit)? = null,
    showChildCount: Boolean = false,
    showChecklistCount: Boolean = false
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
        CwocChitCardStyle.contrastTextColor(projectBgColor)
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

    // Matches web: border:2px solid #8b5a2b, border-radius:6px, margin-bottom:0.6em
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .animateContentSize(),
        shape = RoundedCornerShape(6.dp),
        border = BorderStroke(2.dp, Color(0xFF8B5A2B)),
        colors = CardDefaults.cardColors(containerColor = projectBgColor),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        Column {
            // Project header — matches web: padding:0.3em 0.4em, font-size:0.82em
            // Tap to expand/collapse, NO long-press menu on project masters
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { onToggleExpand() }
                    .padding(horizontal = 6.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Drag grip indicator
                Text(
                    text = "≡",
                    fontSize = 12.sp,
                    color = projectTextColor.copy(alpha = 0.5f),
                    modifier = Modifier.padding(end = 4.dp)
                )
                Text(
                    text = project.project.title ?: "Untitled Project",
                    color = projectTextColor,
                    fontWeight = FontWeight.Bold,
                    fontSize = 13.sp,
                    modifier = Modifier.weight(1f),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    lineHeight = 16.sp
                )
                // Progress count — matches web: only shown when settings enabled
                val totalChildren = project.children.values.sumOf { it.size }
                val completedChildren = (project.children[KanbanStatus.COMPLETE] ?: emptyList()).size
                if (totalChildren > 0 && (showChildCount || showChecklistCount)) {
                    val progressParts = mutableListOf<String>()
                    if (showChildCount) {
                        val checkmark = if (completedChildren == totalChildren) " ✓" else ""
                        progressParts.add("$completedChildren/$totalChildren$checkmark")
                    }
                    if (showChecklistCount) {
                        // Aggregate checklist progress across all children
                        var clChecked = 0
                        var clTotal = 0
                        project.children.values.flatten().forEach { child ->
                            val cl = child.checklist
                            if (!cl.isNullOrBlank() && cl != "[]") {
                                try {
                                    val itemType = object : com.google.gson.reflect.TypeToken<List<Map<String, Any>>>() {}.type
                                    val items: List<Map<String, Any>>? = com.google.gson.Gson().fromJson(cl, itemType)
                                    items?.forEach { item ->
                                        val text = item["text"]?.toString()?.trim() ?: ""
                                        if (text.isNotEmpty()) {
                                            clTotal++
                                            val checked = item["checked"] == true || item["done"] == true
                                            if (checked) clChecked++
                                        }
                                    }
                                } catch (_: Exception) {}
                            }
                        }
                        if (clTotal > 0) {
                            val checkmark = if (clChecked == clTotal) " ☑" else ""
                            progressParts.add("$clChecked/$clTotal$checkmark")
                        }
                    }
                    if (progressParts.isNotEmpty()) {
                        Text(
                            text = "(${progressParts.joinToString(", ")})",
                            fontSize = 10.sp,
                            color = projectTextColor.copy(alpha = 0.7f),
                            modifier = Modifier.padding(horizontal = 4.dp)
                        )
                    }
                }
                // "+" button to create a new child chit
                IconButton(
                    onClick = { showCreateChildDialog = true },
                    modifier = Modifier.size(22.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Add,
                        contentDescription = "Create new child chit",
                        tint = projectTextColor,
                        modifier = Modifier.size(14.dp)
                    )
                }
                Icon(
                    imageVector = if (isExpanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                    contentDescription = if (isExpanded) "Collapse" else "Expand",
                    tint = projectTextColor,
                    modifier = Modifier.size(18.dp)
                )
            }

            // Kanban board (expanded) — no extra padding, sits directly below header
            AnimatedVisibility(
                visible = isExpanded,
                enter = expandVertically(),
                exit = shrinkVertically()
            ) {
                KanbanBoard(
                    columns = project.children,
                    onChildTap = onChildTap,
                    onStatusChange = onStatusChange
                )
            }
        }
    }
}

@Composable
private fun KanbanBoard(
    columns: Map<KanbanStatus, List<ChitEntity>>,
    onChildTap: (String) -> Unit,
    onStatusChange: ((String, KanbanStatus) -> Unit)? = null
) {
    // Only show 4 top-level columns — Rejected is nested inside Complete
    val topLevelStatuses = listOf(
        KanbanStatus.TODO,
        KanbanStatus.IN_PROGRESS,
        KanbanStatus.BLOCKED,
        KanbanStatus.COMPLETE
    )

    // Matches web: display:flex, gap:0, border-right between columns
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 0.dp),
        horizontalArrangement = Arrangement.spacedBy(0.dp)
    ) {
        topLevelStatuses.forEachIndexed { index, status ->
            val chits = columns[status] ?: emptyList()
            val rejectedChits = if (status == KanbanStatus.COMPLETE) {
                columns[KanbanStatus.REJECTED] ?: emptyList()
            } else {
                emptyList()
            }
            KanbanColumnView(
                status = status,
                chits = chits,
                rejectedChits = rejectedChits,
                onChildTap = onChildTap,
                onStatusChange = onStatusChange,
                modifier = Modifier.weight(1f),
                showRightBorder = index < topLevelStatuses.size - 1
            )
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun KanbanColumnView(
    status: KanbanStatus,
    chits: List<ChitEntity>,
    onChildTap: (String) -> Unit,
    onStatusChange: ((String, KanbanStatus) -> Unit)? = null,
    modifier: Modifier = Modifier,
    rejectedChits: List<ChitEntity> = emptyList(),
    showRightBorder: Boolean = true
) {
    // State for collapsed Rejected sub-section (collapsed by default when it has items)
    var rejectedExpanded by remember { mutableStateOf(rejectedChits.isEmpty()) }

    // Matches web: flex:1, border-right:2px solid rgba(139,90,43,0.35), padding:0.2em
    Column(
        modifier = modifier
            .then(
                if (showRightBorder) Modifier.drawRightBorder()
                else Modifier
            )
            .padding(horizontal = 3.dp, vertical = 2.dp)
    ) {
        // Column header — matches web: font-weight:bold, opacity:0.85, text-align:center,
        // padding:2px 0 3px, font-size:0.75em, border-bottom:2px solid rgba(139,90,43,0.3)
        Text(
            text = status.displayName,
            color = Color(0xFF6B4E31).copy(alpha = 0.85f),
            fontWeight = FontWeight.Bold,
            fontSize = 9.sp,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 2.dp)
                .drawBottomBorder()
                .padding(bottom = 3.dp),
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(2.dp))

        // Child chit cards — matches web: padding:0.2em 0.3em, font-size:0.78em,
        // margin-bottom:0.15em, line-height:1.2, border-width:1px
        chits.forEach { chit ->
            KanbanChitCard(
                chit = chit,
                status = status,
                onChildTap = onChildTap,
                onStatusChange = onStatusChange
            )
        }

        if (chits.isEmpty() && rejectedChits.isEmpty()) {
            Text(
                text = "—",
                fontSize = 9.sp,
                color = Color(0xFFAA9977),
                modifier = Modifier.padding(2.dp)
            )
        }

        // Rejected sub-section nested inside Complete column
        if (status == KanbanStatus.COMPLETE && rejectedChits.isNotEmpty()) {
            Spacer(modifier = Modifier.height(2.dp))
            // Divider + collapsible header
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { rejectedExpanded = !rejectedExpanded }
                    .padding(vertical = 2.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Rej",
                    color = Color(0xFF9E9E9E),
                    fontWeight = FontWeight.Bold,
                    fontSize = 8.sp
                )
                Spacer(modifier = Modifier.width(1.dp))
                Text(
                    text = "(${rejectedChits.size})",
                    color = Color(0xFF9E9E9E).copy(alpha = 0.6f),
                    fontSize = 7.sp
                )
                Spacer(modifier = Modifier.weight(1f))
                Text(
                    text = if (rejectedExpanded) "▼" else "▶",
                    fontSize = 6.sp,
                    color = Color(0xFF9E9E9E)
                )
            }
            // Rejected chit cards (collapsible)
            AnimatedVisibility(
                visible = rejectedExpanded,
                enter = expandVertically(),
                exit = shrinkVertically()
            ) {
                Column {
                    rejectedChits.forEach { chit ->
                        KanbanChitCard(
                            chit = chit,
                            status = KanbanStatus.REJECTED,
                            onChildTap = onChildTap,
                            onStatusChange = onStatusChange
                        )
                    }
                }
            }
        }
    }
}

/**
 * Draw a right border matching web's border-right:2px solid rgba(139,90,43,0.35)
 */
private fun Modifier.drawRightBorder(): Modifier = this.drawWithContent {
    drawContent()
    drawLine(
        color = Color(0xFF8B5A2B).copy(alpha = 0.35f),
        start = Offset(size.width, 0f),
        end = Offset(size.width, size.height),
        strokeWidth = 2.dp.toPx()
    )
}

/**
 * Draw a bottom border matching web's border-bottom:2px solid rgba(139,90,43,0.3)
 */
private fun Modifier.drawBottomBorder(): Modifier = this.drawWithContent {
    drawContent()
    drawLine(
        color = Color(0xFF8B5A2B).copy(alpha = 0.3f),
        start = Offset(0f, size.height),
        end = Offset(size.width, size.height),
        strokeWidth = 2.dp.toPx()
    )
}

/**
 * Individual chit card within a Kanban column.
 * Matches web mobile: padding:0.2em 0.3em, font-size:0.78em, border-width:1px, line-height:1.2
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun KanbanChitCard(
    chit: ChitEntity,
    status: KanbanStatus,
    onChildTap: (String) -> Unit,
    onStatusChange: ((String, KanbanStatus) -> Unit)?
) {
    // Determine card background from chit color
    val cardBgColor = remember(chit.color) {
        if (!chit.color.isNullOrBlank() && chit.color != "transparent") {
            parseHexColor(chit.color) ?: CwocChitCardStyle.CardBackground
        } else {
            CwocChitCardStyle.CardBackground
        }
    }
    val cardTextColor = remember(cardBgColor) {
        CwocChitCardStyle.contrastTextColor(cardBgColor)
    }

    var showStatusMenu by remember { mutableStateOf(false) }

    Box {
        // Matches web: padding:0.2em 0.3em, border:1px solid #8b5a2b, border-radius:6px,
        // margin-bottom:0.15em, line-height:1.2
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 1.dp)
                .combinedClickable(
                    onClick = { onChildTap(chit.id) },
                    onLongClick = { showStatusMenu = true }
                ),
            shape = RoundedCornerShape(4.dp),
            border = BorderStroke(1.dp, Color(0xFF8B5A2B)),
            colors = CardDefaults.cardColors(containerColor = cardBgColor),
            elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
        ) {
            Column(modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp)) {
                Text(
                    text = chit.title ?: "Untitled",
                    color = cardTextColor,
                    fontSize = 10.sp,
                    lineHeight = 12.sp,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    fontWeight = FontWeight.Bold,
                    textDecoration = if (status == KanbanStatus.COMPLETE || status == KanbanStatus.REJECTED)
                        TextDecoration.LineThrough else TextDecoration.None
                )
                // Due date (compact)
                if (chit.dueDatetime != null) {
                    Text(
                        text = chit.dueDatetime.take(10),
                        color = cardTextColor.copy(alpha = 0.7f),
                        fontSize = 8.sp,
                        lineHeight = 10.sp
                    )
                }
                // Priority (compact)
                if (!chit.priority.isNullOrBlank()) {
                    Text(
                        text = chit.priority,
                        color = cardTextColor.copy(alpha = 0.7f),
                        fontSize = 8.sp,
                        lineHeight = 10.sp
                    )
                }
            }
        }
        // Long-press status change dropdown
        DropdownMenu(
            expanded = showStatusMenu,
            onDismissRequest = { showStatusMenu = false }
        ) {
            KanbanStatus.entries.filter { it != status }.forEach { targetStatus ->
                DropdownMenuItem(
                    text = { Text("→ ${targetStatus.displayName}", fontSize = 12.sp) },
                    onClick = {
                        showStatusMenu = false
                        onStatusChange?.invoke(chit.id, targetStatus)
                    }
                )
            }
        }
    } // end Box
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
