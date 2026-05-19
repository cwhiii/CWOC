package com.cwoc.app.ui.screens.tasks

import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
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
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
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
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.cwoc.app.data.local.entity.ChitEntity
import com.cwoc.app.data.repository.ChitRepository
import com.cwoc.app.data.sync.SyncState
import com.cwoc.app.domain.filter.FilterEngine
import com.cwoc.app.domain.filter.FilterState
import com.cwoc.app.domain.sort.SortDirection
import com.cwoc.app.domain.sort.SortEngine
import com.cwoc.app.domain.sort.SortField
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
import com.cwoc.app.ui.components.RsvpIndicators
import com.cwoc.app.ui.components.ReorderableLazyColumn
import com.cwoc.app.ui.components.ArchiveSnoozeIndicators
import com.cwoc.app.ui.components.HealthIndicatorBadges
import com.cwoc.app.ui.components.LocationIndicator
import com.cwoc.app.ui.components.isOverdue
import com.cwoc.app.ui.components.overdueBorder
import com.cwoc.app.ui.components.sortPinnedFirst
import com.cwoc.app.ui.components.filterSnoozedItems
import com.cwoc.app.ui.navigation.Screen
import com.cwoc.app.ui.screens.editor.zones.calculateStreak
import com.cwoc.app.ui.util.DateUtils
import com.cwoc.app.ui.viewmodel.FilterSortViewModel
import com.cwoc.app.ui.viewmodel.SidebarStateViewModel
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import androidx.compose.material3.Checkbox
import androidx.compose.runtime.LaunchedEffect
import com.cwoc.app.data.remote.dto.RuleHabitDto

/**
 * Tasks screen — flat list of task chits with inline status dropdown, note preview,
 * indicator icons, and full meta values matching the web mobile browser spec.
 *
 * Phase 1-15 parity implementation:
 * - Flat list (no status group headers) sorted by status weight when no sort selected
 * - Inline status dropdown per card with color-coded styling
 * - Note preview with expand/collapse toggle
 * - Full indicator icons (pinned, archived, snoozed, stealth, sub-chit, alerts, weather)
 * - Full meta values (priority, due, start, point-in-time, updated, created, tags)
 * - Card-level opacity for completed (0.5) and archived (0.45)
 * - Sort indicator on active sort field
 * - Habits and Assigned sub-modes
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun TasksScreen(
    onNavigateToEditor: (String) -> Unit,
    viewModel: TasksViewModel = hiltViewModel(),
    filterSortViewModel: FilterSortViewModel? = null,
    chitRepository: ChitRepository? = null,
    sidebarStateViewModel: SidebarStateViewModel? = null
) {
    val uiState by viewModel.uiState.collectAsState()
    val syncState by viewModel.syncState.collectAsState()

    val pendingDeleteChitId by viewModel.pendingDeleteChitId.collectAsState()
    val pendingDeleteTitle by viewModel.pendingDeleteTitle.collectAsState()

    val showMapThumbnails by viewModel.showMapThumbnails.collectAsState()
    val subChitIds by viewModel.subChitIds.collectAsState()

    val contactImages by viewModel.contactImages.collectAsState()
    val serverUrl = viewModel.serverUrl
    val authToken = viewModel.authToken

    val filterState = filterSortViewModel?.filterState?.collectAsState()?.value ?: FilterState()
    val sortState = filterSortViewModel?.sortState?.collectAsState()?.value ?: SortState()

    val tasksMode = sidebarStateViewModel?.state?.collectAsState()?.value?.tasksViewMode ?: "tasks"

    var menuChit by remember { mutableStateOf<ChitEntity?>(null) }
    var showSnoozeDialog by remember { mutableStateOf(false) }
    val coroutineScope = rememberCoroutineScope()

    // Phase 7: Apply filters then sort. When sort=NONE, use status weight order.
    // When sort=MANUAL, apply the saved manual order from FilterSortViewModel.
    val manualOrder = remember(sortState) {
        if (sortState.field == SortField.MANUAL) filterSortViewModel?.getManualOrder() ?: emptyList()
        else emptyList()
    }

    val filteredSortedTasks = remember(uiState.tasks, filterState, sortState, manualOrder) {
        val filtered = FilterEngine.applyFilters(uiState.tasks, filterState)
        val sorted = when {
            sortState.field == SortField.NONE -> {
                // Phase 7.1: Default sort by status weight
                filtered.sortedBy { statusWeight(it.status) }
            }
            sortState.field == SortField.MANUAL && manualOrder.isNotEmpty() -> {
                // Apply saved manual order: items in order come first, then new items
                val orderMap = manualOrder.withIndex().associate { (i, id) -> id to i }
                filtered.sortedBy { orderMap[it.id] ?: Int.MAX_VALUE }
            }
            else -> {
                SortEngine.sort(filtered, sortState.field, sortState.direction)
            }
        }
        val pinned = sortPinnedFirst(sorted) { it.pinned }
        filterSnoozedItems(pinned)
    }

    val hasActiveFilters = filterState != FilterState()

    Box(modifier = Modifier.fillMaxSize()) {
        ChitListScaffold(
            title = "Tasks",
            syncState = syncState,
            onFabClick = { onNavigateToEditor(Screen.Editor.NEW_CHIT_ID) }
        ) { paddingValues ->
            when {
                uiState.isLoading -> TasksLoadingSkeleton()
                filteredSortedTasks.isEmpty() && hasActiveFilters -> {
                    FilteredEmptyState(onClearFilters = { filterSortViewModel?.clearFilters() })
                }
                uiState.tasks.isEmpty() -> TasksEmptyState()
                filteredSortedTasks.isEmpty() -> {
                    FilteredEmptyState(onClearFilters = { filterSortViewModel?.clearFilters() })
                }
                else -> {
                    when (tasksMode) {
                        "tasks" -> {
                            // Phase 2.3 / 7.3: Flat list, no status group headers
                            TasksFlatList(
                                tasks = filteredSortedTasks,
                                sortState = sortState,
                                onDeleteTask = { viewModel.softDelete(it) },
                                onClickTask = { onNavigateToEditor(it) },
                                onLongPressTask = { menuChit = it },
                                onStatusChange = { chitId, newStatus ->
                                    chitRepository?.let { repo ->
                                        coroutineScope.launch { repo.updateStatus(chitId, newStatus) }
                                    }
                                },
                                showMapThumbnails = showMapThumbnails,
                                subChitIds = subChitIds,
                                onRsvpAction = { chitId, status -> viewModel.updateRsvp(chitId, status) },
                                onReorder = { from, to ->
                                    filterSortViewModel?.reorderItems(
                                        filteredSortedTasks.map { it.id }, from, to
                                    )
                                },
                                currentUserId = viewModel.currentUserId,
                                contactImages = contactImages,
                                serverUrl = serverUrl,
                                authToken = authToken,
                                modifier = Modifier.padding(paddingValues)
                            )
                        }
                        "habits" -> {
                            // Fetch rule habits when habits mode activates
                            LaunchedEffect(Unit) {
                                viewModel.fetchRuleHabits()
                            }
                            val ruleHabits by viewModel.ruleHabits.collectAsState()
                            val combinedSuccessRate by viewModel.combinedSuccessRate.collectAsState()
                            val habitsWindow by viewModel.habitsSuccessWindow.collectAsState()
                            HabitsView(
                                allTasks = filteredSortedTasks,
                                ruleHabits = ruleHabits,
                                combinedSuccessRate = combinedSuccessRate,
                                windowDays = habitsWindow,
                                onClickTask = { onNavigateToEditor(it) },
                                onIncrementHabit = { chitId ->
                                    chitRepository?.let { repo ->
                                        coroutineScope.launch { repo.incrementHabitSuccess(chitId) }
                                    }
                                },
                                onDecrementHabit = { chitId ->
                                    chitRepository?.let { repo ->
                                        coroutineScope.launch { repo.decrementHabitSuccess(chitId) }
                                    }
                                },
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
                                Box(
                                    modifier = Modifier.fillMaxSize().padding(paddingValues),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        text = "No tasks assigned to you",
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                            } else {
                                TasksFlatList(
                                    tasks = assignedTasks,
                                    sortState = sortState,
                                    onDeleteTask = { viewModel.softDelete(it) },
                                    onClickTask = { onNavigateToEditor(it) },
                                    onLongPressTask = { menuChit = it },
                                    onStatusChange = { chitId, newStatus ->
                                        chitRepository?.let { repo ->
                                            coroutineScope.launch { repo.updateStatus(chitId, newStatus) }
                                        }
                                    },
                                    showMapThumbnails = showMapThumbnails,
                                    subChitIds = subChitIds,
                                    onRsvpAction = { chitId, status -> viewModel.updateRsvp(chitId, status) },
                                    onReorder = { from, to ->
                                        filterSortViewModel?.reorderItems(
                                            assignedTasks.map { it.id }, from, to
                                        )
                                    },
                                    currentUserId = viewModel.currentUserId,
                                    contactImages = contactImages,
                                    serverUrl = serverUrl,
                                    authToken = authToken,
                                    modifier = Modifier.padding(paddingValues)
                                )
                            }
                        }
                    }
                }
            }
        }

        // Undo toast
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

        // Action menu
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
                onSnooze = { showSnoozeDialog = true },
                onEdit = { onNavigateToEditor(currentMenuChit.id) },
                onDelete = { viewModel.softDelete(currentMenuChit.id) }
            )
        }

        if (showSnoozeDialog && currentMenuChit != null) {
            SnoozePickerDialog(
                onSnoozeSelected = { isoString ->
                    chitRepository?.let { repo ->
                        coroutineScope.launch { repo.snooze(currentMenuChit.id, isoString) }
                    }
                    showSnoozeDialog = false
                    menuChit = null
                },
                onDismiss = { showSnoozeDialog = false }
            )
        }
    }
}

// ─── Phase 2.3 / 7.3: Flat Task List (no status group headers) ──────────────────

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun TasksFlatList(
    tasks: List<ChitEntity>,
    sortState: SortState,
    onDeleteTask: (String) -> Unit,
    onClickTask: (String) -> Unit,
    onLongPressTask: (ChitEntity) -> Unit,
    onStatusChange: (String, String) -> Unit,
    showMapThumbnails: Boolean = false,
    subChitIds: Set<String> = emptySet(),
    onRsvpAction: ((String, String) -> Unit)? = null,
    onReorder: ((Int, Int) -> Unit)? = null,
    currentUserId: String = "",
    contactImages: Map<String, String?> = emptyMap(),
    serverUrl: String = "",
    authToken: String = "",
    modifier: Modifier = Modifier
) {
    // Use ReorderableLazyColumn when manual sort is active and reorder callback provided
    if (sortState.field == SortField.MANUAL && onReorder != null) {
        ReorderableLazyColumn(
            items = tasks,
            key = { it.id },
            onReorder = onReorder,
            enabled = true,
            modifier = modifier.padding(horizontal = 12.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
            contentPadding = PaddingValues(top = 4.dp, bottom = 80.dp)
        ) { task, isDragging ->
            SwipeableChitCard(onDelete = { onDeleteTask(task.id) }) {
                TaskCard(
                    task = task,
                    sortState = sortState,
                    onClick = { onClickTask(task.id) },
                    onLongClick = { onLongPressTask(task) },
                    onStatusChange = onStatusChange,
                    showMapThumbnails = showMapThumbnails,
                    isSubChit = task.id in subChitIds,
                    onRsvpAction = onRsvpAction,
                    currentUserId = currentUserId,
                    contactImages = contactImages,
                    serverUrl = serverUrl,
                    authToken = authToken
                )
            }
        }
    } else {
        LazyColumn(
            modifier = modifier
                .fillMaxSize()
                .padding(horizontal = 12.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            item { Spacer(modifier = Modifier.height(4.dp)) }
            items(tasks, key = { it.id }) { task ->
                SwipeableChitCard(onDelete = { onDeleteTask(task.id) }) {
                    TaskCard(
                        task = task,
                        sortState = sortState,
                        onClick = { onClickTask(task.id) },
                        onLongClick = { onLongPressTask(task) },
                        onStatusChange = onStatusChange,
                        showMapThumbnails = showMapThumbnails,
                        isSubChit = task.id in subChitIds,
                        onRsvpAction = onRsvpAction,
                        currentUserId = currentUserId,
                        contactImages = contactImages,
                        serverUrl = serverUrl,
                        authToken = authToken
                    )
                }
            }
            item { Spacer(modifier = Modifier.height(80.dp)) } // FAB clearance
        }
    }
}

// ─── Phase 1-5: Task Card with full web parity ──────────────────────────────────

@OptIn(ExperimentalFoundationApi::class, ExperimentalLayoutApi::class)
@Composable
private fun TaskCard(
    task: ChitEntity,
    sortState: SortState,
    onClick: () -> Unit,
    onLongClick: () -> Unit,
    onStatusChange: (String, String) -> Unit,
    showMapThumbnails: Boolean = false,
    isSubChit: Boolean = false,
    onRsvpAction: ((String, String) -> Unit)? = null,
    currentUserId: String = "",
    contactImages: Map<String, String?> = emptyMap(),
    serverUrl: String = "",
    authToken: String = ""
) {
    var showStatusDropdown by remember { mutableStateOf(false) }
    var noteExpanded by remember { mutableStateOf(false) }

    val cardBgColor = remember(task.color) { CwocChitCardStyle.resolveChitBgColor(task.color) }
    val cardTextColor = remember(cardBgColor) { CwocChitCardStyle.contrastTextColor(cardBgColor) }

    // Phase 5: Card-level opacity for completed/archived/declined
    val cardAlpha = when {
        task.status == "Complete" || task.status == "Rejected" -> 0.5f
        task.archived -> 0.45f
        task.availability == "declined" -> 0.5f
        else -> 1f
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .alpha(cardAlpha)
            .overdueBorder(task)
            .combinedClickable(onClick = onClick, onLongClick = onLongClick),
        border = CwocChitCardStyle.cardBorder,
        colors = CardDefaults.cardColors(containerColor = cardBgColor),
        elevation = CwocChitCardStyle.cardElevation()
    ) {
        Column(modifier = Modifier.padding(10.dp)) {
            // ── Phase 1: Header Row (icons + title) ──
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Phase 1.2: Status icon
                Text(
                    text = statusIcon(task.status),
                    fontSize = 14.sp,
                    modifier = Modifier.padding(end = 4.dp)
                )
                // Phase 1.3: Indicator icons
                IndicatorIcons(task = task, textColor = cardTextColor, isSubChit = isSubChit, currentUserId = currentUserId)
                // Title
                Text(
                    text = task.title ?: "(Untitled)",
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Medium,
                    color = cardTextColor,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f)
                )
            }

            // ── Phase 1.4: Meta values row ──
            MetaValuesRow(task = task, sortState = sortState, textColor = cardTextColor)

            // ── Phase 2: Inline status dropdown ──
            Spacer(modifier = Modifier.height(6.dp))
            StatusDropdownRow(
                task = task,
                showDropdown = showStatusDropdown,
                onToggleDropdown = { showStatusDropdown = it },
                onStatusChange = onStatusChange,
                textColor = cardTextColor,
                currentUserId = currentUserId
            )

            // ── Phase 3: Note preview ──
            if (!task.note.isNullOrBlank()) {
                Spacer(modifier = Modifier.height(4.dp))
                NotePreview(
                    note = task.note,
                    expanded = noteExpanded,
                    onToggle = { noteExpanded = !noteExpanded },
                    textColor = cardTextColor
                )
            }

            // ── Phase 4: Location indicator ──
            if (!task.location.isNullOrBlank()) {
                LocationIndicator(location = task.location, modifier = Modifier.padding(top = 4.dp), showMapThumbnail = showMapThumbnails, textColor = cardTextColor.copy(alpha = 0.7f))
            }

            // Existing shared components
            TagChipsRow(tags = task.tags, modifier = Modifier.padding(top = 4.dp))
            ChecklistProgressBadge(checklistJson = task.checklist, modifier = Modifier.padding(top = 4.dp), textColor = cardTextColor)
            PeopleChipsRow(
                people = task.people,
                modifier = Modifier.padding(top = 4.dp),
                contactImages = contactImages,
                serverUrl = serverUrl,
                authToken = authToken
            )
            SharingIndicators(chit = task, modifier = Modifier.padding(top = 4.dp))
            RsvpIndicators(
                sharesJson = task.shares,
                modifier = Modifier.padding(top = 4.dp),
                chitId = task.id,
                onRsvpAction = onRsvpAction
            )
            // Assignee badge (matching web's cwoc-assignee-badge)
            if (!task.assignedTo.isNullOrBlank()) {
                Text(
                    text = "📌 ${task.assignedTo}",
                    style = MaterialTheme.typography.labelSmall,
                    color = cardTextColor.copy(alpha = 0.7f),
                    modifier = Modifier.padding(top = 4.dp)
                )
            }
            HealthIndicatorBadges(healthDataJson = task.healthData, modifier = Modifier.padding(top = 4.dp))

            // Habit indicators
            if (task.habit) {
                Spacer(modifier = Modifier.height(6.dp))
                HabitIndicatorRow(
                    habitGoal = task.habitGoal,
                    habitSuccess = task.habitSuccess,
                    habitResetPeriod = task.habitResetPeriod,
                    habitLastActionDate = task.habitLastActionDate,
                    textColor = cardTextColor
                )
            }
        }
    }
}

// ─── Phase 1.3: Indicator Icons ─────────────────────────────────────────────────

@Composable
private fun IndicatorIcons(task: ChitEntity, textColor: Color, isSubChit: Boolean = false, currentUserId: String = "") {
    // Show inline indicator emojis before the title (matching web's _buildChitHeader left side)
    val indicators = buildString {
        if (task.pinned) append("🔖 ")
        if (task.archived) append("📦 ")
        if (!task.snoozedUntil.isNullOrBlank()) {
            try {
                val snoozeEnd = Instant.parse(task.snoozedUntil)
                if (snoozeEnd.isAfter(Instant.now())) append("😴 ")
            } catch (_: Exception) {}
        }
        // Stealth — only visible to the owner (Requirement 6.5)
        if (task.stealth == true && (currentUserId.isBlank() || task.ownerId == currentUserId)) append("🥷 ")
        if (isSubChit) append("🔗📋 ")
        // Timezone warning — unrecognized timezone on anchored chit
        if (!task.timezone.isNullOrBlank() && task.startDatetime != null) {
            try {
                val tz = java.util.TimeZone.getTimeZone(task.timezone)
                if (tz.id == "GMT" && task.timezone != "GMT" && task.timezone != "UTC") {
                    append("⚠️ ")
                }
            } catch (_: Exception) { append("⚠️ ") }
        }
        if (task.alarm == true || task.notification == true) append("🔔 ")
        // Weather indicator from stored weather_data
        if (!task.weatherData.isNullOrBlank()) {
            val emoji = parseWeatherEmojiFromJson(task.weatherData)
            if (emoji.isNotBlank()) append("$emoji ")
        }
    }
    if (indicators.isNotEmpty()) {
        Text(
            text = indicators.trim(),
            fontSize = 12.sp,
            modifier = Modifier.padding(end = 4.dp)
        )
    }
}

// ─── Phase 1.4: Meta Values Row ─────────────────────────────────────────────────

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun MetaValuesRow(task: ChitEntity, sortState: SortState, textColor: Color) {
    val metaColor = textColor.copy(alpha = 0.75f)
    val hasAnyMeta = task.priority != null || task.dueDatetime != null ||
        task.startDatetime != null || task.pointInTime != null ||
        task.modifiedDatetime != null || task.createdDatetime != null

    if (!hasAnyMeta) return

    Spacer(modifier = Modifier.height(3.dp))
    FlowRow(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalArrangement = Arrangement.spacedBy(2.dp)
    ) {
        // Priority
        if (task.priority != null) {
            MetaChip(
                text = task.priority,
                isSortActive = sortState.field == SortField.PRIORITY,
                sortDir = sortState.direction,
                color = priorityColor(task.priority)
            )
        }
        // Due date (Phase 1.5: overdue pill)
        if (task.dueDatetime != null) {
            if (isOverdue(task)) {
                val overdueColor = Color(0xFFB22222)
                Surface(
                    shape = RoundedCornerShape(3.dp),
                    color = overdueColor
                ) {
                    Text(
                        text = "Past Due: ${DateUtils.formatDisplayDate(task.dueDatetime)}" +
                            if (sortState.field == SortField.DUE_DATE) sortArrow(sortState.direction) else "",
                        style = MaterialTheme.typography.labelSmall,
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 4.dp, vertical = 1.dp)
                    )
                }
            } else {
                MetaChip(
                    text = "Due: ${DateUtils.formatDisplayDate(task.dueDatetime)}",
                    isSortActive = sortState.field == SortField.DUE_DATE,
                    sortDir = sortState.direction,
                    color = metaColor
                )
            }
        }
        // Start date
        if (task.startDatetime != null) {
            MetaChip(
                text = "Start: ${DateUtils.formatDisplayDate(task.startDatetime)}",
                isSortActive = sortState.field == SortField.START_DATE,
                sortDir = sortState.direction,
                color = metaColor
            )
        }
        // Point in time
        if (task.pointInTime != null) {
            MetaChip(
                text = "📌 ${DateUtils.formatDisplayDate(task.pointInTime)}",
                isSortActive = false,
                sortDir = sortState.direction,
                color = metaColor
            )
        }
        // Updated
        if (task.modifiedDatetime != null) {
            MetaChip(
                text = "Updated: ${DateUtils.formatDisplayDate(task.modifiedDatetime)}",
                isSortActive = sortState.field == SortField.MODIFIED_DATE,
                sortDir = sortState.direction,
                color = metaColor
            )
        }
        // Created
        if (task.createdDatetime != null) {
            MetaChip(
                text = "Created: ${DateUtils.formatDisplayDate(task.createdDatetime)}",
                isSortActive = sortState.field == SortField.CREATED_DATE,
                sortDir = sortState.direction,
                color = metaColor
            )
        }
    }
}

@Composable
private fun MetaChip(text: String, isSortActive: Boolean, sortDir: SortDirection, color: Color) {
    Text(
        text = text + if (isSortActive) sortArrow(sortDir) else "",
        style = MaterialTheme.typography.labelSmall,
        color = color,
        fontWeight = if (isSortActive) FontWeight.Bold else FontWeight.Normal,
        fontSize = 11.sp
    )
}

private fun sortArrow(dir: SortDirection): String = if (dir == SortDirection.ASC) " ▲" else " ▼"

// ─── Phase 2: Inline Status Dropdown ────────────────────────────────────────────

@Composable
private fun StatusDropdownRow(
    task: ChitEntity,
    showDropdown: Boolean,
    onToggleDropdown: (Boolean) -> Unit,
    onStatusChange: (String, String) -> Unit,
    textColor: Color,
    currentUserId: String = ""
) {
    val status = task.status ?: "ToDo"
    val statusCol = statusColor(status)
    // Phase 1.6: Blocked highlighting
    val isBlocked = status == "Blocked"
    val blockedColor = Color(0xFFDAA520) // configurable blocked_border_color default

    // Viewer-role check: disable status dropdown for viewer-role shared chits
    val isViewerRole = remember(task.shares, currentUserId) {
        com.cwoc.app.domain.sharing.SharingUtils.isViewerRole(task, currentUserId)
    }

    Row(verticalAlignment = Alignment.CenterVertically) {
        // Status icon
        Text(text = statusIcon(status), fontSize = 13.sp)
        Spacer(modifier = Modifier.width(4.dp))
        Text(text = "Status:", style = MaterialTheme.typography.labelSmall, color = textColor.copy(alpha = 0.7f))
        Spacer(modifier = Modifier.width(4.dp))

        Box {
            Surface(
                shape = RoundedCornerShape(4.dp),
                color = if (isBlocked) blockedColor else statusCol.copy(alpha = 0.12f),
                modifier = Modifier.clickable(enabled = !isViewerRole) { onToggleDropdown(true) }
            ) {
                Text(
                    text = if (isBlocked && task.prerequisites?.isNotEmpty() == true) "$status ⛓️" else status,
                    style = MaterialTheme.typography.labelSmall,
                    color = if (isBlocked) CwocChitCardStyle.contrastTextColor(blockedColor) else statusCol,
                    fontWeight = if (isBlocked) FontWeight.Bold else FontWeight.Medium,
                    modifier = Modifier
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                        .alpha(if (isViewerRole) 0.5f else 1f)
                )
            }
            if (!isViewerRole) {
                DropdownMenu(
                    expanded = showDropdown,
                    onDismissRequest = { onToggleDropdown(false) }
                ) {
                    listOf("ToDo", "In Progress", "Blocked", "Complete", "Rejected").forEach { s ->
                        DropdownMenuItem(
                            text = {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text(text = statusIcon(s), fontSize = 12.sp)
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text(text = s)
                                }
                            },
                            onClick = {
                                onToggleDropdown(false)
                                onStatusChange(task.id, s)
                            }
                        )
                    }
                }
            }
        }
    }
}

// ─── Phase 3: Note Preview ──────────────────────────────────────────────────────

@Composable
private fun NotePreview(note: String, expanded: Boolean, onToggle: () -> Unit, textColor: Color) {
    val previewText = if (note.length > 300 && !expanded) note.take(300) + "…" else note
    val maxLines = if (expanded) Int.MAX_VALUE else 3

    Column(modifier = Modifier.animateContentSize()) {
        // Render markdown (matching web's marked.js rendering in note preview)
        com.cwoc.app.ui.components.MarkdownRenderer(
            markdown = previewText,
            modifier = Modifier.fillMaxWidth()
        )
        // Toggle button
        Text(
            text = if (expanded) "show less" else "show more…",
            style = MaterialTheme.typography.labelSmall,
            color = textColor.copy(alpha = 0.6f),
            fontStyle = FontStyle.Italic,
            modifier = Modifier
                .align(Alignment.End)
                .clickable(onClick = onToggle)
                .padding(top = 2.dp)
        )
    }
}

// ─── Helper Functions ───────────────────────────────────────────────────────────

/** Phase 7.1/7.2: Status weight for default sort order (matching web). */
private fun statusWeight(status: String?): Int = when (status) {
    "ToDo" -> 1
    "In Progress" -> 2
    "Blocked" -> 3
    null, "" -> 4
    "Complete" -> 5
    "Rejected" -> 6
    else -> 4
}

/** Status icon emoji matching web's _STATUS_ICONS. */
private fun statusIcon(status: String?): String = when (status) {
    "ToDo" -> "⚪"
    "In Progress" -> "🔄"
    "Blocked" -> "🚫"
    "Complete" -> "✅"
    "Rejected" -> "❌"
    else -> "⚪"
}

/** Status color for UI elements. */
private fun statusColor(status: String): Color = when (status) {
    "ToDo" -> Color(0xFF8B5A2B)
    "In Progress" -> Color(0xFFD68A59)
    "Blocked" -> Color(0xFFB22222)
    "Complete" -> Color(0xFF5A8A5B)
    "Rejected" -> Color(0xFF9E9E9E)
    else -> Color(0xFF5C4A3A)
}

/** Priority color for meta display. */
private fun priorityColor(priority: String): Color = when (priority) {
    "Critical" -> Color(0xFFB22222)
    "High" -> Color(0xFFD2691E)
    "Medium" -> Color(0xFF8B6914)
    "Low" -> Color(0xFF4A6741)
    else -> Color(0xFF5C4A3A)
}

// ─── Empty States (Phase 13) ────────────────────────────────────────────────────

@Composable
private fun FilteredEmptyState(onClearFilters: () -> Unit) {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = "No tasks found.",
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.height(12.dp))
            Button(onClick = onClearFilters) { Text("Clear Filters") }
        }
    }
}

@Composable
private fun TasksEmptyState() {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.alpha(0.7f)
        ) {
            Text(
                text = "No tasks found.",
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.height(12.dp))
            Button(onClick = { /* FAB handles creation */ }) { Text("+ Create Chit") }
        }
    }
}

@Composable
private fun TasksLoadingSkeleton() {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        CircularProgressIndicator(modifier = Modifier.size(48.dp), color = MaterialTheme.colorScheme.primary)
    }
}

// ─── Habit Indicator Row ────────────────────────────────────────────────────────

@Composable
private fun HabitIndicatorRow(
    habitGoal: Int?,
    habitSuccess: Int?,
    habitResetPeriod: String?,
    habitLastActionDate: String?,
    textColor: Color = MaterialTheme.colorScheme.onSurfaceVariant
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
        Surface(
            shape = RoundedCornerShape(4.dp),
            color = if (streak > 0) MaterialTheme.colorScheme.primaryContainer
                    else MaterialTheme.colorScheme.surfaceVariant
        ) {
            Text(
                text = "🔥 $streak",
                style = MaterialTheme.typography.labelSmall,
                color = if (streak > 0) MaterialTheme.colorScheme.onPrimaryContainer
                        else MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
            )
        }
        LinearProgressIndicator(
            progress = { progressFraction },
            modifier = Modifier.weight(1f).height(6.dp),
            color = textColor.copy(alpha = 0.8f),
            trackColor = textColor.copy(alpha = 0.2f)
        )
        Text(
            text = "$successRate%",
            style = MaterialTheme.typography.labelSmall,
            color = textColor.copy(alpha = 0.8f)
        )
    }
}

// ─── Habits View (Phase 14) ─────────────────────────────────────────────────────

@Composable
private fun HabitsView(
    allTasks: List<ChitEntity>,
    ruleHabits: List<RuleHabitDto> = emptyList(),
    combinedSuccessRate: Int? = null,
    windowDays: Int = -1,
    onClickTask: (String) -> Unit,
    onIncrementHabit: (String) -> Unit = {},
    onDecrementHabit: (String) -> Unit = {},
    modifier: Modifier = Modifier
) {
    val habits = remember(allTasks) { allTasks.filter { it.habit } }

    if (habits.isEmpty() && ruleHabits.isEmpty()) {
        Box(modifier = modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text(
                text = "No habits yet. Mark a recurring chit as a habit in the editor.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(24.dp)
            )
        }
        return
    }

    val today = remember { LocalDate.now() }
    val grouped = remember(habits, today) {
        val onDeck = mutableListOf<ChitEntity>()
        val outOfMind = mutableListOf<ChitEntity>()
        val accomplished = mutableListOf<ChitEntity>()

        habits.forEach { chit ->
            val goal = chit.habitGoal ?: 1
            val success = chit.habitSuccess ?: 0
            if (success >= goal) {
                accomplished.add(chit)
            } else if (chit.habitResetPeriod != null && isResetPeriodActive(chit) && success > 0) {
                outOfMind.add(chit)
            } else {
                onDeck.add(chit)
            }
        }
        Triple(onDeck.sortedBy { habitUrgencyScore(it) }, outOfMind, accomplished)
    }

    val (onDeck, outOfMind, accomplished) = grouped

    LazyColumn(
        modifier = modifier.fillMaxSize().padding(horizontal = 12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        // ── Aggregate Success Rate Bar ──
        if (combinedSuccessRate != null) {
            item {
                Spacer(modifier = Modifier.height(8.dp))
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFFFDF5E6)),
                    border = CwocChitCardStyle.cardBorder,
                    elevation = CwocChitCardStyle.cardElevation()
                ) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Text(
                            text = "📊 Combined Success Rate: $combinedSuccessRate%",
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF6B4E31)
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        LinearProgressIndicator(
                            progress = { combinedSuccessRate / 100f },
                            modifier = Modifier.fillMaxWidth().height(8.dp),
                            color = Color(0xFF6B4E31),
                            trackColor = Color(0xFFE8D5B7)
                        )
                    }
                }
            }
        }
        if (onDeck.isNotEmpty()) {
            item {
                Spacer(modifier = Modifier.height(8.dp))
                Text("🔜 On Deck", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = Color(0xFF6B4E31))
            }
            items(onDeck, key = { it.id }) { chit ->
                HabitCard(chit = chit, section = "onDeck", windowDays = windowDays, onClick = { onClickTask(chit.id) }, onIncrement = { onIncrementHabit(chit.id) }, onDecrement = { onDecrementHabit(chit.id) })
            }
        }
        if (outOfMind.isNotEmpty()) {
            item {
                Spacer(modifier = Modifier.height(8.dp))
                Text("😌 Out of Mind", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = Color(0xFF5C4A3A))
            }
            items(outOfMind, key = { it.id }) { chit ->
                HabitCard(chit = chit, section = "outOfMind", windowDays = windowDays, onClick = { onClickTask(chit.id) }, onIncrement = { onIncrementHabit(chit.id) }, onDecrement = { onDecrementHabit(chit.id) })
            }
        }
        if (accomplished.isNotEmpty()) {
            item {
                Spacer(modifier = Modifier.height(8.dp))
                Text("✅ Accomplished", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = Color(0xFF4A6741))
            }
            items(accomplished, key = { it.id }) { chit ->
                HabitCard(chit = chit, section = "accomplished", windowDays = windowDays, onClick = { onClickTask(chit.id) }, onIncrement = { onIncrementHabit(chit.id) }, onDecrement = { onDecrementHabit(chit.id) })
            }
        }

        // ── Rule Habits Section ──
        if (ruleHabits.isNotEmpty()) {
            item {
                Spacer(modifier = Modifier.height(16.dp))
                Text("🤖 Rule Habits", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = Color(0xFF6B4E31))
            }
            items(ruleHabits, key = { it.id }) { rule ->
                RuleHabitCard(rule = rule)
            }
        }

        item { Spacer(modifier = Modifier.height(80.dp)) }
    }
}

// ─── HabitCard ──────────────────────────────────────────────────────────────────

@Composable
private fun HabitCard(chit: ChitEntity, section: String, windowDays: Int = -1, onClick: () -> Unit, onIncrement: () -> Unit = {}, onDecrement: () -> Unit = {}) {
    val goal = chit.habitGoal ?: 1
    val success = chit.habitSuccess ?: 0
    val streak = calculateStreak(chit.habitLastActionDate, chit.habitResetPeriod)
    val progressFraction = if (goal > 0) (success.toFloat() / goal.toFloat()).coerceIn(0f, 1f) else 0f
    val isComplete = success >= goal
    val isResetActive = isResetPeriodActive(chit)
    val freqLabel = getFrequencyLabel(chit)
    val (successRate, metCount, totalPeriods) = calculateHistoricalSuccessRate(chit, windowDays)
    val cyclePct = if (goal > 0) (success * 100) / goal else 0

    val cardBgColor = remember(chit.color) { CwocChitCardStyle.resolveChitBgColor(chit.color) }
    val cardTextColor = remember(cardBgColor) { CwocChitCardStyle.contrastTextColor(cardBgColor) }

    Card(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
        colors = CardDefaults.cardColors(containerColor = cardBgColor),
        border = CwocChitCardStyle.cardBorder,
        elevation = CwocChitCardStyle.cardElevation()
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = chit.title ?: "Untitled",
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Medium,
                    color = cardTextColor,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f)
                )
                if (streak > 0) {
                    Spacer(modifier = Modifier.width(8.dp))
                    Surface(shape = RoundedCornerShape(4.dp), color = MaterialTheme.colorScheme.primaryContainer) {
                        Text("🔥 $streak", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onPrimaryContainer, modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp))
                    }
                }
            }
            Spacer(modifier = Modifier.height(8.dp))
            if (goal == 1) {
                // Checkbox for goal=1 habits — functional
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(
                        checked = isComplete,
                        onCheckedChange = { checked ->
                            if (checked && !isComplete) onIncrement()
                            else if (!checked && isComplete) onDecrement()
                        },
                        enabled = !isResetActive || !isComplete
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        if (isComplete) "Complete" else "Not done",
                        style = MaterialTheme.typography.bodySmall,
                        color = cardTextColor.copy(alpha = 0.7f)
                    )
                }
            } else {
                // Counter with +/- buttons for goal>1 habits
                Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(
                        onClick = onDecrement,
                        enabled = success > 0,
                        modifier = Modifier.size(36.dp),
                        contentPadding = androidx.compose.foundation.layout.PaddingValues(0.dp)
                    ) { Text("−", fontSize = 18.sp) }
                    LinearProgressIndicator(
                        progress = { progressFraction },
                        modifier = Modifier.weight(1f).height(8.dp),
                        color = if (section == "accomplished") Color(0xFF4A6741) else MaterialTheme.colorScheme.primary,
                        trackColor = MaterialTheme.colorScheme.surfaceVariant
                    )
                    Text("$success / $goal", style = MaterialTheme.typography.labelMedium, color = cardTextColor.copy(alpha = 0.8f))
                    Button(
                        onClick = onIncrement,
                        enabled = !isComplete && (!isResetActive || !isComplete),
                        modifier = Modifier.size(36.dp),
                        contentPadding = androidx.compose.foundation.layout.PaddingValues(0.dp)
                    ) { Text("+", fontSize = 18.sp) }
                }
            }
            Spacer(modifier = Modifier.height(6.dp))
            // ── Metrics Row (matching web's habit-metrics) ──
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Progress text with frequency
                Text(
                    text = "$success / $goal${if (freqLabel.isNotBlank()) " $freqLabel" else ""}",
                    style = MaterialTheme.typography.labelSmall,
                    color = cardTextColor.copy(alpha = 0.7f)
                )
                // Cycle %
                Surface(shape = RoundedCornerShape(3.dp), color = MaterialTheme.colorScheme.surfaceVariant) {
                    Text("🎯 $cyclePct%", style = MaterialTheme.typography.labelSmall, modifier = Modifier.padding(horizontal = 4.dp, vertical = 1.dp))
                }
                // Overall success rate (from history)
                if (totalPeriods > 0 && chit.habitHideOverall != true) {
                    Surface(shape = RoundedCornerShape(3.dp), color = MaterialTheme.colorScheme.surfaceVariant) {
                        Text("📈 $successRate%", style = MaterialTheme.typography.labelSmall, modifier = Modifier.padding(horizontal = 4.dp, vertical = 1.dp))
                    }
                }
                // Streak
                if (streak > 0) {
                    Surface(shape = RoundedCornerShape(3.dp), color = MaterialTheme.colorScheme.primaryContainer) {
                        Text("🔥 $streak", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onPrimaryContainer, modifier = Modifier.padding(horizontal = 4.dp, vertical = 1.dp))
                    }
                }
            }
            val resetDisplay = formatResetPeriod(chit.habitResetPeriod)
            if (resetDisplay != null) {
                Text("Resets: $resetDisplay", style = MaterialTheme.typography.bodySmall, color = cardTextColor.copy(alpha = 0.7f))
            }
            when (section) {
                "outOfMind" -> {
                    val resetDate = getResetEndDateFormatted(chit)
                    if (resetDate != null) {
                        Spacer(modifier = Modifier.height(4.dp))
                        Text("Resets on $resetDate", style = MaterialTheme.typography.bodySmall, color = cardTextColor.copy(alpha = 0.6f))
                    }
                }
                "accomplished" -> {
                    Spacer(modifier = Modifier.height(4.dp))
                    Text("✅ Complete for this cycle", style = MaterialTheme.typography.bodySmall, color = Color(0xFF4A6741))
                }
            }

            // Note preview (matching web's habit-note-preview)
            if (!chit.note.isNullOrBlank()) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = chit.note.take(120) + if (chit.note.length > 120) "…" else "",
                    style = MaterialTheme.typography.bodySmall,
                    color = cardTextColor.copy(alpha = 0.6f),
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }
    }
}

// ─── RuleHabitCard ──────────────────────────────────────────────────────────────

@Composable
private fun RuleHabitCard(rule: RuleHabitDto) {
    val summary = rule.habitSummary
    val currentStatus = summary?.currentStatus ?: "due"
    val streak = summary?.streak ?: 0
    val successRate = if (summary?.successRate != null) (summary.successRate * 100).toInt() else 0
    val period = summary?.period ?: "daily"

    val statusColor = when (currentStatus) {
        "achieved" -> Color(0xFF4A6741)
        "missed" -> Color(0xFFB22222)
        else -> Color(0xFF8B6914) // due — amber/brown
    }
    val statusIcon = when (currentStatus) {
        "achieved" -> "✅"
        "missed" -> "❌"
        else -> "⏳"
    }
    val statusLabel = currentStatus.replaceFirstChar { it.uppercase() }

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color(0xFFFDF5E6)),
        border = CwocChitCardStyle.cardBorder,
        elevation = CwocChitCardStyle.cardElevation()
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            // ── Header: 🤖 badge + name + period ──
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Robot badge
                Surface(
                    shape = RoundedCornerShape(4.dp),
                    color = Color(0xFFE8DDD0)
                ) {
                    Text(
                        "🤖",
                        style = MaterialTheme.typography.labelSmall,
                        modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp)
                    )
                }
                Spacer(modifier = Modifier.width(8.dp))
                // Rule name
                Text(
                    text = rule.name.ifBlank { "(Unnamed Rule)" },
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Medium,
                    color = Color(0xFF1A1208),
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f)
                )
                Spacer(modifier = Modifier.width(8.dp))
                // Period label
                Text(
                    text = period.replaceFirstChar { it.uppercase() },
                    style = MaterialTheme.typography.labelSmall,
                    color = Color(0xFF6B4E31).copy(alpha = 0.7f)
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            // ── Metrics row: status pill, streak, success rate ──
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Status pill
                Surface(
                    shape = RoundedCornerShape(4.dp),
                    color = statusColor.copy(alpha = 0.15f)
                ) {
                    Text(
                        text = "$statusIcon $statusLabel",
                        style = MaterialTheme.typography.labelSmall,
                        color = statusColor,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                    )
                }
                // Streak
                if (streak > 0) {
                    Surface(
                        shape = RoundedCornerShape(4.dp),
                        color = MaterialTheme.colorScheme.primaryContainer
                    ) {
                        Text(
                            text = "🔥 $streak",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onPrimaryContainer,
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 3.dp)
                        )
                    }
                }
                // Success rate
                Surface(
                    shape = RoundedCornerShape(4.dp),
                    color = MaterialTheme.colorScheme.surfaceVariant
                ) {
                    Text(
                        text = "📈 $successRate%",
                        style = MaterialTheme.typography.labelSmall,
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 3.dp)
                    )
                }
            }

            // ── Description (if present) ──
            if (!rule.description.isNullOrBlank()) {
                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    text = rule.description,
                    style = MaterialTheme.typography.bodySmall,
                    color = Color(0xFF1A1208).copy(alpha = 0.6f),
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }
    }
}

// ─── Habit Helper Functions ─────────────────────────────────────────────────────

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
    } catch (_: Exception) { false }
}

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
        resetEnd.format(DateTimeFormatter.ofPattern("MMM d"))
    } catch (_: Exception) { null }
}

private fun parseResetPeriod(resetPeriod: String): Pair<Int, String> {
    return if (resetPeriod.contains(":")) {
        val parts = resetPeriod.split(":")
        Pair(parts[0].toIntOrNull() ?: 1, parts[1].uppercase())
    } else {
        Pair(1, resetPeriod.uppercase())
    }
}

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
 * Calculate historical success rate from recurrence_exceptions rollover snapshots.
 * Matches web's logic: count periods where habit_success >= habit_goal.
 * Returns a Triple of (successRate%, metCount, totalPeriods).
 */
private fun calculateHistoricalSuccessRate(chit: ChitEntity, windowDays: Int = -1): Triple<Int, Int, Int> {
    val goal = chit.habitGoal ?: 1
    val success = chit.habitSuccess ?: 0
    val isComplete = success >= goal

    // Calculate the cutoff date for window filtering
    // windowDays: 7, 30, 90 = last N days; -1 = all time
    val cutoffDate: LocalDate? = if (windowDays > 0) {
        LocalDate.now().minusDays(windowDays.toLong())
    } else null // null means include all entries (all time)

    // Parse recurrence_exceptions JSON for period snapshots
    val exceptions = try {
        if (!chit.recurrenceExceptions.isNullOrBlank()) {
            com.google.gson.Gson().fromJson<List<Map<String, Any?>>>(
                chit.recurrenceExceptions,
                object : com.google.gson.reflect.TypeToken<List<Map<String, Any?>>>() {}.type
            ) ?: emptyList()
        } else emptyList()
    } catch (_: Exception) { emptyList() }

    // Filter to only entries with habit-specific fields (rollover snapshots)
    // and apply date window filter
    val periodEntries = exceptions.filter { ex ->
        ex.containsKey("habit_success") && ex.containsKey("habit_goal") && ex["broken_off"] != true &&
            (cutoffDate == null || isEntryWithinWindow(ex, cutoffDate))
    }

    // Add current period only if goal is met
    val allEntries = if (isComplete) {
        periodEntries + mapOf("habit_success" to success.toDouble(), "habit_goal" to goal.toDouble())
    } else periodEntries

    if (allEntries.isEmpty()) return Triple(0, 0, 0)

    var metCount = 0
    allEntries.forEach { entry ->
        val entrySuccess = (entry["habit_success"] as? Number)?.toInt() ?: 0
        val entryGoal = (entry["habit_goal"] as? Number)?.toInt() ?: 1
        if (entrySuccess >= entryGoal) metCount++
    }

    val rate = if (allEntries.isNotEmpty()) (metCount * 100) / allEntries.size else 0
    return Triple(rate, metCount, allEntries.size)
}

/**
 * Check if a recurrence_exceptions entry's date falls within the window (on or after cutoffDate).
 * Entries have a "date" field in "YYYY-MM-DD" format.
 */
private fun isEntryWithinWindow(entry: Map<String, Any?>, cutoffDate: LocalDate): Boolean {
    val dateStr = entry["date"] as? String ?: return true // If no date field, include by default
    return try {
        val entryDate = LocalDate.parse(dateStr)
        !entryDate.isBefore(cutoffDate)
    } catch (_: Exception) {
        true // If date can't be parsed, include by default
    }
}

/**
 * Get the frequency label for display (e.g., "each Week").
 */
private fun getFrequencyLabel(chit: ChitEntity): String {
    val ruleJson = chit.recurrenceRule ?: return ""
    return try {
        val rule = com.google.gson.Gson().fromJson(ruleJson, Map::class.java)
        when ((rule["freq"] as? String)?.uppercase()) {
            "DAILY" -> "each Day"
            "WEEKLY" -> "each Week"
            "MONTHLY" -> "each Month"
            "YEARLY" -> "each Year"
            else -> ""
        }
    } catch (_: Exception) { "" }
}

private fun habitUrgencyScore(chit: ChitEntity): Float {
    val goal = chit.habitGoal ?: 1
    val success = chit.habitSuccess ?: 0
    val remaining = goal - success
    if (remaining <= 0) return 9999f
    val resetPeriod = chit.habitResetPeriod
    if (resetPeriod.isNullOrBlank()) return 0f
    val (resetNum, resetUnit) = parseResetPeriod(resetPeriod)
    val daysInCycle = when (resetUnit) {
        "DAILY" -> resetNum
        "WEEKLY" -> resetNum * 7
        "MONTHLY" -> resetNum * 30
        else -> 1
    }
    val lastActionStr = chit.habitLastActionDate
    val daysLeft = if (lastActionStr != null) {
        try {
            val lastAction = LocalDate.parse(lastActionStr, DateTimeFormatter.ISO_LOCAL_DATE)
            val elapsed = ChronoUnit.DAYS.between(lastAction, LocalDate.now()).toInt()
            (daysInCycle - elapsed).coerceAtLeast(1)
        } catch (_: Exception) { daysInCycle }
    } else { daysInCycle }
    return daysLeft.toFloat() / remaining.toFloat()
}

// ─── Weather Emoji Helper ───────────────────────────────────────────────────────

/**
 * Parse weather_data JSON and return the weather emoji for the weather code.
 * Matches web's _getWeatherIcon logic.
 */
private fun parseWeatherEmojiFromJson(weatherJson: String?): String {
    if (weatherJson.isNullOrBlank()) return ""
    return try {
        val codeMatch = Regex(""""weather_code"\s*:\s*(\d+)""").find(weatherJson)
        val code = codeMatch?.groupValues?.get(1)?.toIntOrNull() ?: return ""
        when (code) {
            0 -> "☀️"
            1, 2, 3 -> "⛅"
            45, 48 -> "🌫️"
            51, 53, 55, 61, 63, 65, 80, 81, 82 -> "🌧️"
            71, 73, 75, 77, 85, 86 -> "❄️"
            95, 96, 99 -> "⛈️"
            else -> "🌤️"
        }
    } catch (_: Exception) { "" }
}
