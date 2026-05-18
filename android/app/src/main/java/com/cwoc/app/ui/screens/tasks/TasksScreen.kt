package com.cwoc.app.ui.screens.tasks

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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.cwoc.app.data.local.entity.ChitEntity
import com.cwoc.app.data.repository.ChitRepository
import com.cwoc.app.data.sync.SyncState
import com.cwoc.app.domain.filter.FilterEngine
import com.cwoc.app.domain.filter.FilterState
import com.cwoc.app.domain.sort.SortEngine
import com.cwoc.app.domain.sort.SortState
import com.cwoc.app.ui.components.ChitActionMenu
import com.cwoc.app.ui.components.ChitListScaffold
import com.cwoc.app.ui.components.CwocChitCardStyle
import com.cwoc.app.ui.components.SnoozePickerDialog
import com.cwoc.app.ui.components.SwipeableChitCard
import com.cwoc.app.ui.components.UndoToast
import com.cwoc.app.ui.components.TagChipsRow
import com.cwoc.app.ui.components.ChecklistProgressBadge
import com.cwoc.app.ui.components.PeopleChipsRow
import com.cwoc.app.ui.components.SharingIndicators
import com.cwoc.app.ui.components.ArchiveSnoozeIndicators
import com.cwoc.app.ui.components.HealthIndicatorBadges
import com.cwoc.app.ui.components.chitColorBorder
import com.cwoc.app.ui.components.isOverdue
import com.cwoc.app.ui.components.overdueBorder
import com.cwoc.app.ui.components.sortPinnedFirst
import com.cwoc.app.ui.components.filterSnoozedItems
import com.cwoc.app.ui.navigation.Screen
import com.cwoc.app.ui.screens.editor.zones.calculateStreak
import com.cwoc.app.ui.util.DateUtils
import com.cwoc.app.ui.viewmodel.FilterSortViewModel
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import androidx.compose.material3.Checkbox

/**
 * Tasks screen displaying chits grouped by status (ToDo, In Progress, Blocked, Complete).
 * Uses ChitListScaffold for FAB + sync indicator, SwipeableChitCard for swipe-to-delete,
 * and navigates to the Editor on card click.
 * Applies FilterEngine and SortEngine from FilterSortViewModel before rendering.
 * Shows UndoToast on swipe-to-delete with 5-second countdown before syncing.
 * Long-press on a card shows ChitActionMenu for pin/archive/snooze actions.
 *
 * Validates: Requirements 2.1, 4.1, 4.2, 4.3, 4.4, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 9.8, 10.4, 12.1, 12.2, 13.1, 13.3, 13.4
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun TasksScreen(
    onNavigateToEditor: (String) -> Unit,
    viewModel: TasksViewModel = hiltViewModel(),
    filterSortViewModel: FilterSortViewModel? = null,
    chitRepository: ChitRepository? = null
) {
    val uiState by viewModel.uiState.collectAsState()
    val syncState by viewModel.syncState.collectAsState()

    // Undo toast state
    val pendingDeleteChitId by viewModel.pendingDeleteChitId.collectAsState()
    val pendingDeleteTitle by viewModel.pendingDeleteTitle.collectAsState()

    // Collect filter/sort state if ViewModel is provided
    val filterState = filterSortViewModel?.filterState?.collectAsState()?.value ?: FilterState()
    val sortState = filterSortViewModel?.sortState?.collectAsState()?.value ?: SortState()

    // Tasks/Habits/Assigned mode toggle
    var tasksMode by remember { mutableStateOf("tasks") } // "tasks", "habits", "assigned"

    // Long-press action menu state
    var menuChit by remember { mutableStateOf<ChitEntity?>(null) }
    var showSnoozeDialog by remember { mutableStateOf(false) }
    val coroutineScope = rememberCoroutineScope()

    // Apply filters, sort, pin-to-top, and snooze filter to the task list
    val filteredSortedTasks = remember(uiState.tasks, filterState, sortState) {
        val filtered = FilterEngine.applyFilters(uiState.tasks, filterState)
        val sorted = SortEngine.sort(filtered, sortState.field, sortState.direction)
        val pinned = sortPinnedFirst(sorted) { it.pinned }
        filterSnoozedItems(pinned)
    }

    // Check if filters are active (non-default state)
    val hasActiveFilters = filterState != FilterState()

    Box(modifier = Modifier.fillMaxSize()) {
        ChitListScaffold(
            title = "Tasks",
            syncState = syncState,
            onFabClick = { onNavigateToEditor(Screen.Editor.NEW_CHIT_ID) }
        ) { paddingValues ->
            when {
                uiState.isLoading -> {
                    TasksLoadingSkeleton()
                }
                filteredSortedTasks.isEmpty() && hasActiveFilters -> {
                    FilteredEmptyState(
                        onClearFilters = { filterSortViewModel?.clearFilters() }
                    )
                }
                uiState.tasks.isEmpty() -> {
                    TasksEmptyState()
                }
                filteredSortedTasks.isEmpty() -> {
                    FilteredEmptyState(
                        onClearFilters = { filterSortViewModel?.clearFilters() }
                    )
                }
                else -> {
                    val groupedTasks = filteredSortedTasks.groupBy { it.status ?: "Unknown" }
                    when (tasksMode) {
                        "tasks" -> {
                            TasksList(
                                groupedTasks = groupedTasks,
                                onDeleteTask = { chitId -> viewModel.softDelete(chitId) },
                                onClickTask = { chitId -> onNavigateToEditor(chitId) },
                                onLongPressTask = { chit -> menuChit = chit },
                                modifier = Modifier.padding(paddingValues),
                                filterChipRow = {
                                    item {
                                        Row(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .padding(bottom = 8.dp),
                                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                                        ) {
                                            FilterChip(
                                                selected = tasksMode == "tasks",
                                                onClick = { tasksMode = "tasks" },
                                                label = { Text("Tasks") }
                                            )
                                            FilterChip(
                                                selected = tasksMode == "habits",
                                                onClick = { tasksMode = "habits" },
                                                label = { Text("Habits") }
                                            )
                                            FilterChip(
                                                selected = tasksMode == "assigned",
                                                onClick = { tasksMode = "assigned" },
                                                label = { Text("Assigned") }
                                            )
                                        }
                                    }
                                }
                            )
                        }
                        "habits" -> {
                            HabitsView(
                                allTasks = filteredSortedTasks,
                                tasksMode = tasksMode,
                                onTasksModeChange = { tasksMode = it },
                                onClickTask = { chitId -> onNavigateToEditor(chitId) },
                                modifier = Modifier.padding(paddingValues)
                            )
                        }
                        "assigned" -> {
                            val currentUsername by viewModel.currentUsername.collectAsState()
                            val assignedTasks = remember(filteredSortedTasks, currentUsername) {
                                filteredSortedTasks.filter {
                                    it.assignedTo?.equals(currentUsername ?: "", ignoreCase = true) == true
                                }
                            }

                            if (assignedTasks.isEmpty()) {
                                LazyColumn(
                                    modifier = Modifier
                                        .padding(paddingValues)
                                        .fillMaxSize()
                                        .padding(horizontal = 16.dp),
                                    verticalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    item {
                                        TasksModeChipRow(tasksMode = tasksMode, onTasksModeChange = { tasksMode = it })
                                    }
                                    item {
                                        Box(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .padding(top = 48.dp),
                                            contentAlignment = Alignment.Center
                                        ) {
                                            Text(
                                                text = "No tasks assigned to you",
                                                style = MaterialTheme.typography.bodyMedium,
                                                color = MaterialTheme.colorScheme.onSurfaceVariant
                                            )
                                        }
                                    }
                                }
                            } else {
                                val groupedAssigned = assignedTasks.groupBy { it.status ?: "Unknown" }
                                TasksList(
                                    groupedTasks = groupedAssigned,
                                    onDeleteTask = { chitId -> viewModel.softDelete(chitId) },
                                    onClickTask = { chitId -> onNavigateToEditor(chitId) },
                                    onLongPressTask = { chit -> menuChit = chit },
                                    modifier = Modifier.padding(paddingValues),
                                    filterChipRow = {
                                        item {
                                            TasksModeChipRow(tasksMode = tasksMode, onTasksModeChange = { tasksMode = it })
                                        }
                                    }
                                )
                            }
                        }
                    }
                }
            }
        }

        // Show UndoToast when a deletion is pending
        val currentPendingId = pendingDeleteChitId
        if (currentPendingId != null) {
            key(currentPendingId) {
                UndoToast(
                    message = "\"${pendingDeleteTitle ?: "Chit"}\" deleted",
                    onUndo = { viewModel.undoDelete() },
                    onExpire = { viewModel.finalizeDelete() }
                )
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
                onDelete = { viewModel.softDelete(currentMenuChit.id) }
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
private fun FilteredEmptyState(onClearFilters: () -> Unit) {
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
private fun TasksList(
    groupedTasks: Map<String, List<ChitEntity>>,
    onDeleteTask: (String) -> Unit,
    onClickTask: (String) -> Unit,
    onLongPressTask: (ChitEntity) -> Unit,
    modifier: Modifier = Modifier,
    filterChipRow: (androidx.compose.foundation.lazy.LazyListScope.() -> Unit)? = null
) {
    val statusOrder = listOf("ToDo", "In Progress", "Blocked", "Complete")

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        // FilterChip row at the top (if provided)
        filterChipRow?.invoke(this)

        statusOrder.forEach { status ->
            val tasks = groupedTasks[status]
            if (!tasks.isNullOrEmpty()) {
                item {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = status,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = statusColor(status),
                        modifier = Modifier.padding(vertical = 4.dp)
                    )
                }
                items(tasks, key = { it.id }) { task ->
                    SwipeableChitCard(
                        onDelete = { onDeleteTask(task.id) }
                    ) {
                        TaskCard(
                            task = task,
                            onClick = { onClickTask(task.id) },
                            onLongClick = { onLongPressTask(task) }
                        )
                    }
                }
            }
        }

        // Show any tasks with unexpected status values
        groupedTasks.forEach { (status, tasks) ->
            if (status !in statusOrder) {
                item {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = status,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(vertical = 4.dp)
                    )
                }
                items(tasks, key = { it.id }) { task ->
                    SwipeableChitCard(
                        onDelete = { onDeleteTask(task.id) }
                    ) {
                        TaskCard(
                            task = task,
                            onClick = { onClickTask(task.id) },
                            onLongClick = { onLongPressTask(task) }
                        )
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun TaskCard(
    task: ChitEntity,
    onClick: () -> Unit,
    onLongClick: () -> Unit,
    onStatusChange: ((String, String) -> Unit)? = null // F4: (chitId, newStatus) -> Unit
) {
    // F4: Inline status dropdown state
    var showStatusDropdown by remember { mutableStateOf(false) }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .chitColorBorder(task.color)
            .overdueBorder(task)
            .combinedClickable(
                onClick = onClick,
                onLongClick = onLongClick
            ),
        border = CwocChitCardStyle.cardBorder,
        colors = CwocChitCardStyle.cardColors(),
        elevation = CwocChitCardStyle.cardElevation()
    ) {
        Column(
            modifier = Modifier.padding(12.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = task.title ?: "Untitled",
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Medium,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f)
                )

                if (task.priority != null) {
                    Spacer(modifier = Modifier.width(8.dp))
                    PriorityBadge(priority = task.priority)
                }

                // F4: Inline status dropdown
                if (onStatusChange != null) {
                    Spacer(modifier = Modifier.width(4.dp))
                    Box {
                        Surface(
                            shape = RoundedCornerShape(4.dp),
                            color = statusColor(task.status ?: "ToDo").copy(alpha = 0.15f),
                            modifier = Modifier.clickable { showStatusDropdown = true }
                        ) {
                            Text(
                                text = task.status ?: "ToDo",
                                style = MaterialTheme.typography.labelSmall,
                                color = statusColor(task.status ?: "ToDo"),
                                fontWeight = FontWeight.Medium,
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                            )
                        }
                        androidx.compose.material3.DropdownMenu(
                            expanded = showStatusDropdown,
                            onDismissRequest = { showStatusDropdown = false }
                        ) {
                            listOf("ToDo", "In Progress", "Blocked", "Complete", "Rejected").forEach { status ->
                                androidx.compose.material3.DropdownMenuItem(
                                    text = { Text(status) },
                                    onClick = {
                                        showStatusDropdown = false
                                        onStatusChange(task.id, status)
                                    }
                                )
                            }
                        }
                    }
                }
            }

            // Due date + overdue indicator
            if (task.dueDatetime != null) {
                Spacer(modifier = Modifier.height(4.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = "Due: ${DateUtils.formatDisplayDate(task.dueDatetime)}",
                        style = MaterialTheme.typography.bodySmall,
                        color = if (isOverdue(task)) Color(0xFFB22222) else MaterialTheme.colorScheme.onSurfaceVariant,
                        fontWeight = if (isOverdue(task)) FontWeight.Bold else FontWeight.Normal
                    )
                    if (isOverdue(task)) {
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "⚠ OVERDUE",
                            style = MaterialTheme.typography.labelSmall,
                            color = Color(0xFFB22222),
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }

            // B1: Tag chips
            TagChipsRow(
                tags = task.tags,
                modifier = Modifier.padding(top = 4.dp)
            )

            // B3: Checklist progress
            ChecklistProgressBadge(
                checklistJson = task.checklist,
                modifier = Modifier.padding(top = 4.dp)
            )

            // B4: People chips
            PeopleChipsRow(
                people = task.people,
                modifier = Modifier.padding(top = 4.dp)
            )

            // B8: Sharing/stealth indicators
            SharingIndicators(
                chit = task,
                modifier = Modifier.padding(top = 4.dp)
            )

            // B9: Archive/snooze indicators
            ArchiveSnoozeIndicators(
                chit = task,
                modifier = Modifier.padding(top = 4.dp)
            )

            // B10: Health indicator badges
            HealthIndicatorBadges(
                healthDataJson = task.healthData,
                modifier = Modifier.padding(top = 4.dp)
            )

            // Pin indicator
            if (task.pinned) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "📌 Pinned",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.primary
                )
            }

            // Habit indicators
            if (task.habit) {
                Spacer(modifier = Modifier.height(6.dp))
                HabitIndicatorRow(
                    habitGoal = task.habitGoal,
                    habitSuccess = task.habitSuccess,
                    habitResetPeriod = task.habitResetPeriod,
                    habitLastActionDate = task.habitLastActionDate
                )
            }
        }
    }
}

// ─── Habit Indicator Row ──────────────────────────────────────────────────────

/**
 * Compact row showing habit indicators on task cards: streak badge, progress bar, success rate.
 * Only displayed when chit.habit == true.
 *
 * Validates: Requirements 7.1, 7.4
 */
@Composable
private fun HabitIndicatorRow(
    habitGoal: Int?,
    habitSuccess: Int?,
    habitResetPeriod: String?,
    habitLastActionDate: String?
) {
    val goal = habitGoal ?: 1
    val success = habitSuccess ?: 0
    val streak = calculateStreak(habitLastActionDate, habitResetPeriod)
    val progressFraction = if (goal > 0) (success.toFloat() / goal.toFloat()).coerceIn(0f, 1f) else 0f
    val successRate = if (goal > 0) ((success.toFloat() / goal.toFloat()) * 100).toInt().coerceIn(0, 100) else 0

    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        // Streak badge
        Surface(
            shape = RoundedCornerShape(4.dp),
            color = if (streak > 0) MaterialTheme.colorScheme.primaryContainer
                    else MaterialTheme.colorScheme.surfaceVariant,
            modifier = Modifier
        ) {
            Text(
                text = "🔥 $streak",
                style = MaterialTheme.typography.labelSmall,
                color = if (streak > 0) MaterialTheme.colorScheme.onPrimaryContainer
                        else MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
            )
        }

        // Progress bar
        LinearProgressIndicator(
            progress = { progressFraction },
            modifier = Modifier
                .weight(1f)
                .height(6.dp),
            color = MaterialTheme.colorScheme.primary,
            trackColor = MaterialTheme.colorScheme.surfaceVariant
        )

        // Success rate text
        Text(
            text = "$successRate%",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
private fun PriorityBadge(priority: String) {
    val color = when (priority) {
        "Critical" -> Color(0xFFB22222)
        "High" -> Color(0xFFD2691E)
        "Medium" -> Color(0xFF8B6914)
        "Low" -> Color(0xFF4A6741)
        else -> MaterialTheme.colorScheme.onSurfaceVariant
    }

    Text(
        text = priority,
        style = MaterialTheme.typography.labelSmall,
        color = color,
        fontWeight = FontWeight.Bold
    )
}

@Composable
private fun TasksLoadingSkeleton() {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        CircularProgressIndicator(
            modifier = Modifier.size(48.dp),
            color = MaterialTheme.colorScheme.primary
        )
    }
}

@Composable
private fun TasksEmptyState() {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = "No Tasks",
                style = MaterialTheme.typography.headlineSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "Tap + to create a new task",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

private fun statusColor(status: String): Color {
    return when (status) {
        "ToDo" -> Color(0xFF6B4E31)
        "In Progress" -> Color(0xFF1565C0)
        "Blocked" -> Color(0xFFB22222)
        "Complete" -> Color(0xFF4A6741)
        else -> Color(0xFF5C4A3A)
    }
}

// ─── Habits View ──────────────────────────────────────────────────────────────

/**
 * Habits mode view: filters chits to habit == true, groups into
 * On Deck / Out of Mind / Accomplished sections, sorted by urgency.
 *
 * Validates: Requirements 5, 6
 */
@Composable
private fun HabitsView(
    allTasks: List<ChitEntity>,
    tasksMode: String,
    onTasksModeChange: (String) -> Unit,
    onClickTask: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val habits = remember(allTasks) { allTasks.filter { it.habit } }

    if (habits.isEmpty()) {
        LazyColumn(
            modifier = modifier
                .fillMaxSize()
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            item {
                TasksModeChipRow(tasksMode = tasksMode, onTasksModeChange = onTasksModeChange)
            }
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 48.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "No habits yet. Mark a recurring chit as a habit in the editor to start tracking.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
        return
    }

    // Group habits into sections
    val today = remember { LocalDate.now() }
    val grouped = remember(habits, today) {
        val onDeck = mutableListOf<ChitEntity>()
        val outOfMind = mutableListOf<ChitEntity>()
        val accomplished = mutableListOf<ChitEntity>()

        habits.forEach { chit ->
            val goal = chit.habitGoal ?: 1
            val success = chit.habitSuccess ?: 0
            val isCompleted = success >= goal

            if (isCompleted) {
                accomplished.add(chit)
            } else if (chit.habitResetPeriod != null && isResetPeriodActive(chit) && success > 0) {
                outOfMind.add(chit)
            } else {
                onDeck.add(chit)
            }
        }

        // Sort On Deck by urgency (lower = more urgent = first)
        val sortedOnDeck = onDeck.sortedBy { habitUrgencyScore(it) }

        Triple(sortedOnDeck, outOfMind, accomplished)
    }

    val (onDeck, outOfMind, accomplished) = grouped

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        item {
            TasksModeChipRow(tasksMode = tasksMode, onTasksModeChange = onTasksModeChange)
        }

        // On Deck section
        if (onDeck.isNotEmpty()) {
            item {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "🔜 On Deck",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFF6B4E31),
                    modifier = Modifier.padding(vertical = 4.dp)
                )
            }
            items(onDeck, key = { it.id }) { chit ->
                HabitCard(
                    chit = chit,
                    section = "onDeck",
                    onClick = { onClickTask(chit.id) }
                )
            }
        }

        // Out of Mind section
        if (outOfMind.isNotEmpty()) {
            item {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "😌 Out of Mind",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFF5C4A3A),
                    modifier = Modifier.padding(vertical = 4.dp)
                )
            }
            items(outOfMind, key = { it.id }) { chit ->
                HabitCard(
                    chit = chit,
                    section = "outOfMind",
                    onClick = { onClickTask(chit.id) }
                )
            }
        }

        // Accomplished section
        if (accomplished.isNotEmpty()) {
            item {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "✅ Accomplished",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFF4A6741),
                    modifier = Modifier.padding(vertical = 4.dp)
                )
            }
            items(accomplished, key = { it.id }) { chit ->
                HabitCard(
                    chit = chit,
                    section = "accomplished",
                    onClick = { onClickTask(chit.id) }
                )
            }
        }
    }
}

/**
 * Shared FilterChip row for Tasks/Habits/Assigned mode toggle.
 */
@Composable
private fun TasksModeChipRow(
    tasksMode: String,
    onTasksModeChange: (String) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(bottom = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        FilterChip(
            selected = tasksMode == "tasks",
            onClick = { onTasksModeChange("tasks") },
            label = { Text("Tasks") }
        )
        FilterChip(
            selected = tasksMode == "habits",
            onClick = { onTasksModeChange("habits") },
            label = { Text("Habits") }
        )
        FilterChip(
            selected = tasksMode == "assigned",
            onClick = { onTasksModeChange("assigned") },
            label = { Text("Assigned") }
        )
    }
}

// ─── HabitCard Composable ─────────────────────────────────────────────────────

/**
 * Card composable for a single habit, showing progress, streak, and reset period.
 * For goal=1 habits, shows a checkbox instead of a progress bar.
 * Section-specific status text is shown based on which group the habit belongs to.
 */
@Composable
private fun HabitCard(
    chit: ChitEntity,
    section: String, // "onDeck", "outOfMind", "accomplished"
    onClick: () -> Unit
) {
    val goal = chit.habitGoal ?: 1
    val success = chit.habitSuccess ?: 0
    val streak = calculateStreak(chit.habitLastActionDate, chit.habitResetPeriod)
    val progressFraction = if (goal > 0) (success.toFloat() / goal.toFloat()).coerceIn(0f, 1f) else 0f

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(
            modifier = Modifier.padding(12.dp)
        ) {
            // Title row with streak badge
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = chit.title ?: "Untitled",
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Medium,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f)
                )

                // Streak badge
                if (streak > 0) {
                    Spacer(modifier = Modifier.width(8.dp))
                    Surface(
                        shape = RoundedCornerShape(4.dp),
                        color = MaterialTheme.colorScheme.primaryContainer
                    ) {
                        Text(
                            text = "🔥 $streak",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onPrimaryContainer,
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Progress: checkbox for goal=1, progress bar for goal>1
            if (goal == 1) {
                Row(
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Checkbox(
                        checked = success >= goal,
                        onCheckedChange = null, // Read-only in list view
                        enabled = false
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = if (success >= goal) "Complete" else "Not done",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            } else {
                // Progress bar with text
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    LinearProgressIndicator(
                        progress = { progressFraction },
                        modifier = Modifier
                            .weight(1f)
                            .height(8.dp),
                        color = if (section == "accomplished") Color(0xFF4A6741)
                                else MaterialTheme.colorScheme.primary,
                        trackColor = MaterialTheme.colorScheme.surfaceVariant
                    )
                    Text(
                        text = "$success / $goal",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            Spacer(modifier = Modifier.height(6.dp))

            // Reset period display
            val resetDisplay = formatResetPeriod(chit.habitResetPeriod)
            if (resetDisplay != null) {
                Text(
                    text = "Resets: $resetDisplay",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            // Section-specific status text
            when (section) {
                "outOfMind" -> {
                    val resetDate = getResetEndDateFormatted(chit)
                    if (resetDate != null) {
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "Resets on $resetDate",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f)
                        )
                    }
                }
                "accomplished" -> {
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "✅ Complete for this cycle",
                        style = MaterialTheme.typography.bodySmall,
                        color = Color(0xFF4A6741)
                    )
                }
            }
        }
    }
}

// ─── Habit Helper Functions ───────────────────────────────────────────────────

/**
 * Check if a habit's reset period is currently active (user acted within the period).
 * Parses "N:UNIT" format (e.g., "1:DAILY", "3:WEEKLY") or legacy "DAILY".
 */
private fun isResetPeriodActive(chit: ChitEntity): Boolean {
    val resetPeriod = chit.habitResetPeriod ?: return false
    val lastActionStr = chit.habitLastActionDate ?: return false

    return try {
        val lastAction = LocalDate.parse(lastActionStr, DateTimeFormatter.ISO_LOCAL_DATE)
        val today = LocalDate.now()

        val (resetNum, resetUnit) = parseResetPeriod(resetPeriod)

        val resetEnd = when (resetUnit) {
            "DAILY" -> lastAction.plusDays(resetNum.toLong())
            "WEEKLY" -> lastAction.plusWeeks(resetNum.toLong())
            "MONTHLY" -> lastAction.plusMonths(resetNum.toLong())
            else -> return false
        }

        today.isBefore(resetEnd)
    } catch (_: Exception) {
        false
    }
}

/**
 * Get the formatted reset end date for display (e.g., "Jan 15").
 */
private fun getResetEndDateFormatted(chit: ChitEntity): String? {
    val resetPeriod = chit.habitResetPeriod ?: return null
    val lastActionStr = chit.habitLastActionDate ?: return null

    return try {
        val lastAction = LocalDate.parse(lastActionStr, DateTimeFormatter.ISO_LOCAL_DATE)
        val (resetNum, resetUnit) = parseResetPeriod(resetPeriod)

        val resetEnd = when (resetUnit) {
            "DAILY" -> lastAction.plusDays(resetNum.toLong())
            "WEEKLY" -> lastAction.plusWeeks(resetNum.toLong())
            "MONTHLY" -> lastAction.plusMonths(resetNum.toLong())
            else -> return null
        }

        val formatter = DateTimeFormatter.ofPattern("MMM d")
        resetEnd.format(formatter)
    } catch (_: Exception) {
        null
    }
}

/**
 * Parse a reset period string into (count, unit).
 * Supports "N:UNIT" format (e.g., "1:DAILY", "3:WEEKLY") and legacy "DAILY".
 */
private fun parseResetPeriod(resetPeriod: String): Pair<Int, String> {
    return if (resetPeriod.contains(":")) {
        val parts = resetPeriod.split(":")
        val num = parts[0].toIntOrNull() ?: 1
        val unit = parts[1].uppercase()
        Pair(num, unit)
    } else {
        Pair(1, resetPeriod.uppercase())
    }
}

/**
 * Format a reset period for display (e.g., "Daily", "Every 3 days", "Weekly").
 */
private fun formatResetPeriod(resetPeriod: String?): String? {
    if (resetPeriod.isNullOrBlank()) return null

    val (num, unit) = parseResetPeriod(resetPeriod)

    return when {
        unit == "DAILY" && num == 1 -> "Daily"
        unit == "DAILY" -> "Every $num days"
        unit == "WEEKLY" && num == 1 -> "Weekly"
        unit == "WEEKLY" -> "Every $num weeks"
        unit == "MONTHLY" && num == 1 -> "Monthly"
        unit == "MONTHLY" -> "Every $num months"
        else -> resetPeriod
    }
}

/**
 * Calculate urgency score for a habit — lower = more urgent (needs action sooner).
 * Urgency = days left in cycle / remaining completions.
 */
private fun habitUrgencyScore(chit: ChitEntity): Float {
    val goal = chit.habitGoal ?: 1
    val success = chit.habitSuccess ?: 0
    val remaining = goal - success
    if (remaining <= 0) return 9999f

    val resetPeriod = chit.habitResetPeriod
    if (resetPeriod.isNullOrBlank()) return 0f // No reset period = most urgent

    val (resetNum, resetUnit) = parseResetPeriod(resetPeriod)

    val daysInCycle = when (resetUnit) {
        "DAILY" -> resetNum
        "WEEKLY" -> resetNum * 7
        "MONTHLY" -> resetNum * 30
        else -> 1
    }

    // Calculate days left in current cycle
    val lastActionStr = chit.habitLastActionDate
    val daysLeft = if (lastActionStr != null) {
        try {
            val lastAction = LocalDate.parse(lastActionStr, DateTimeFormatter.ISO_LOCAL_DATE)
            val today = LocalDate.now()
            val elapsed = ChronoUnit.DAYS.between(lastAction, today).toInt()
            (daysInCycle - elapsed).coerceAtLeast(1)
        } catch (_: Exception) {
            daysInCycle
        }
    } else {
        daysInCycle
    }

    return daysLeft.toFloat() / remaining.toFloat()
}
