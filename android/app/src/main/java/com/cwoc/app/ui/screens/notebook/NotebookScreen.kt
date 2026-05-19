package com.cwoc.app.ui.screens.notebook

import androidx.compose.animation.animateContentSize
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
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.cwoc.app.data.local.entity.ChitEntity
import com.cwoc.app.data.repository.ChitRepository
import com.cwoc.app.domain.filter.FilterEngine
import com.cwoc.app.domain.filter.FilterState
import com.cwoc.app.domain.sort.SortEngine
import com.cwoc.app.domain.sort.SortField
import com.cwoc.app.domain.sort.SortState
import com.cwoc.app.ui.components.ArchiveSnoozeIndicators
import com.cwoc.app.ui.components.ChecklistProgressBadge
import com.cwoc.app.ui.components.ChitActionMenu
import com.cwoc.app.ui.components.ChitListScaffold
import com.cwoc.app.ui.components.CwocChitCardStyle
import com.cwoc.app.ui.components.HealthIndicatorBadges
import com.cwoc.app.ui.components.LocationIndicator
import com.cwoc.app.ui.components.MarkdownRenderer
import com.cwoc.app.ui.components.PeopleChipsRow
import com.cwoc.app.ui.components.QuickEditSheet
import com.cwoc.app.ui.components.ReorderableStaggeredGrid
import com.cwoc.app.ui.components.SharingIndicators
import com.cwoc.app.ui.components.SnoozePickerDialog
import com.cwoc.app.ui.components.TagChipsRow
import com.cwoc.app.ui.components.UndoToast
import com.cwoc.app.ui.components.WeatherIndicator
import com.cwoc.app.ui.components.sortPinnedFirst
import com.cwoc.app.domain.checklist.ChecklistItem
import com.cwoc.app.domain.checklist.ChecklistOperations
import com.cwoc.app.ui.viewmodel.FilterSortViewModel
import androidx.compose.foundation.lazy.staggeredgrid.StaggeredGridCells
import kotlinx.coroutines.launch
import java.time.Instant

/**
 * Notebook screen — combined Notes + Checklists view in a masonry layout.
 * Shows chits that have either a non-empty note OR non-empty checklist items.
 * Matches the web's "Notebook" tab which replaces separate Notes/Checklists tabs.
 *
 * Each card shows a type badge (📝 for notes, ☑ for checklists, 📝☑ for both),
 * renders note content as markdown, and shows inline checklist items.
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun NotebookScreen(
    onNavigateToEditor: (String) -> Unit,
    viewModel: NotebookViewModel = hiltViewModel(),
    filterSortViewModel: FilterSortViewModel? = null,
    chitRepository: ChitRepository? = null
) {
    val uiState by viewModel.uiState.collectAsState()
    val syncState by viewModel.syncState.collectAsState()

    val pendingDeleteChitId by viewModel.pendingDeleteChitId.collectAsState()
    val pendingDeleteTitle by viewModel.pendingDeleteTitle.collectAsState()

    val filterState = filterSortViewModel?.filterState?.collectAsState()?.value ?: FilterState()
    val sortState = filterSortViewModel?.sortState?.collectAsState()?.value ?: SortState()

    var quickEditChit by remember { mutableStateOf<ChitEntity?>(null) }
    val coroutineScope = rememberCoroutineScope()

    val filteredSortedChits = remember(uiState.chits, filterState, sortState) {
        val filtered = FilterEngine.applyFilters(uiState.chits, filterState)
        val sorted = when (sortState.field) {
            SortField.MANUAL -> {
                // Apply saved manual order: items in order come first, then new items
                val manualOrder = filterSortViewModel?.getManualOrder() ?: emptyList()
                if (manualOrder.isNotEmpty()) {
                    val orderMap = manualOrder.withIndex().associate { (i, id) -> id to i }
                    filtered.sortedBy { orderMap[it.id] ?: Int.MAX_VALUE }
                } else {
                    filtered
                }
            }
            else -> SortEngine.sort(filtered, sortState.field, sortState.direction)
        }
        sortPinnedFirst(sorted) { it.pinned }
    }

    val hasActiveFilters = filterState != FilterState()

    Box(modifier = Modifier.fillMaxSize()) {
        ChitListScaffold(
            title = "Notebook",
            syncState = syncState,
            onFabClick = { onNavigateToEditor("new") }
        ) { paddingValues ->
            Column(modifier = Modifier.padding(paddingValues)) {
                when {
                    uiState.isLoading -> {
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
                    filteredSortedChits.isEmpty() && hasActiveFilters -> {
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
                                Button(onClick = { filterSortViewModel?.clearFilters() }) {
                                    Text("Clear Filters")
                                }
                            }
                        }
                    }
                    uiState.chits.isEmpty() -> {
                        Box(
                            modifier = Modifier.fillMaxSize(),
                            contentAlignment = Alignment.Center
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text(
                                    text = "No Notes or Checklists",
                                    style = MaterialTheme.typography.headlineSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                                Text(
                                    text = "Notes and checklists will appear here after syncing",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                    }
                    else -> {
                        // Masonry layout matching Notes view — with drag-to-reorder when manual sort
                        ReorderableStaggeredGrid(
                            items = filteredSortedChits,
                            key = { it.id },
                            columns = StaggeredGridCells.Adaptive(160.dp),
                            onReorder = { fromIndex, toIndex ->
                                viewModel.reorderNotebook(filteredSortedChits, fromIndex, toIndex)
                            },
                            enabled = sortState.field == SortField.MANUAL,
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(horizontal = 8.dp),
                            verticalItemSpacing = 8.dp,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) { chit, isDragging ->
                            NotebookCard(
                                chit = chit,
                                onClick = { onNavigateToEditor(chit.id) },
                                onLongClick = { quickEditChit = chit },
                                onToggleChecklistItem = { itemIndex ->
                                    viewModel.toggleChecklistItem(chit.id, itemIndex)
                                },
                                currentUserId = viewModel.currentUserId
                            )
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

        // Quick-edit bottom sheet
        val currentQuickEditChit = quickEditChit
        if (currentQuickEditChit != null) {
            QuickEditSheet(
                title = currentQuickEditChit.title ?: "",
                content = currentQuickEditChit.note ?: "",
                onSave = { newTitle, newContent ->
                    chitRepository?.let { repo ->
                        coroutineScope.launch {
                            repo.updateTitleAndNote(currentQuickEditChit.id, newTitle, newContent)
                        }
                    }
                    quickEditChit = null
                },
                onDismiss = { quickEditChit = null },
                onOpenFullEditor = {
                    quickEditChit = null
                    onNavigateToEditor(currentQuickEditChit.id)
                }
            )
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun NotebookCard(
    chit: ChitEntity,
    onClick: () -> Unit,
    onLongClick: () -> Unit,
    onToggleChecklistItem: (Int) -> Unit,
    currentUserId: String
) {
    var isExpanded by remember { mutableStateOf(false) }

    val cardBgColor = remember(chit.color) { CwocChitCardStyle.resolveChitBgColor(chit.color) }
    val cardTextColor = remember(cardBgColor) { CwocChitCardStyle.contrastTextColor(cardBgColor) }

    val isDeclined = chit.availability == "declined"
    val cardAlpha = if (isDeclined) 0.5f else 1f

    val hasNote = !chit.note.isNullOrBlank()
    val checklistItems = remember(chit.checklist) { ChecklistOperations.parseChecklist(chit.checklist) }
    val hasChecklist = checklistItems.any { it.text.isNotBlank() }
    val isViewerRole = chit.availability == "declined"

    // Type badge: 📝☑ for both, ☑ for checklist only, 📝 for note only
    val typeBadge = when {
        hasNote && hasChecklist -> "📝☑"
        hasChecklist -> "☑"
        else -> "📝"
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .alpha(cardAlpha)
            .animateContentSize()
            .combinedClickable(
                onClick = {
                    if (isExpanded) onClick()
                    else isExpanded = true
                },
                onLongClick = onLongClick
            ),
        border = CwocChitCardStyle.cardBorder,
        colors = CardDefaults.cardColors(containerColor = cardBgColor),
        elevation = CwocChitCardStyle.cardElevation()
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            // Title row with indicators
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Indicator icons
                val indicators = remember(chit, currentUserId) { buildNotebookIndicators(chit, currentUserId) }
                if (indicators.isNotEmpty()) {
                    Text(
                        text = indicators,
                        fontSize = 12.sp,
                        modifier = Modifier.padding(end = 4.dp)
                    )
                }

                // Type badge
                Text(
                    text = typeBadge,
                    fontSize = 11.sp,
                    color = cardTextColor.copy(alpha = 0.6f),
                    modifier = Modifier.padding(end = 4.dp)
                )

                Text(
                    text = chit.title ?: "(Untitled)",
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Medium,
                    color = cardTextColor,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f)
                )

                // Drag handle
                Text(
                    text = "⋮⋮",
                    style = MaterialTheme.typography.bodyLarge,
                    color = cardTextColor.copy(alpha = 0.5f)
                )
            }

            // Owner badge
            if (!chit.ownerDisplayName.isNullOrBlank() && chit.ownerId != currentUserId) {
                Text(
                    text = "👤 ${chit.ownerDisplayName}",
                    style = MaterialTheme.typography.labelSmall,
                    color = cardTextColor.copy(alpha = 0.7f),
                    modifier = Modifier.padding(top = 2.dp)
                )
            }

            Spacer(modifier = Modifier.height(4.dp))

            // Note content (markdown)
            if (hasNote) {
                if (isExpanded) {
                    MarkdownRenderer(
                        markdown = chit.note!!,
                        modifier = Modifier.fillMaxWidth()
                    )
                } else {
                    Text(
                        text = com.cwoc.app.ui.util.MarkdownRenderer.renderToAnnotatedString(chit.note!!.take(300)),
                        style = MaterialTheme.typography.bodyMedium,
                        color = cardTextColor.copy(alpha = 0.8f),
                        maxLines = 5,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }

            // Checklist items
            if (hasChecklist) {
                if (hasNote) Spacer(modifier = Modifier.height(6.dp))

                // Checklist progress badge
                ChecklistProgressBadge(
                    checklistJson = chit.checklist,
                    modifier = Modifier.padding(bottom = 4.dp),
                    textColor = cardTextColor
                )

                // Show unchecked items (or all if expanded)
                val displayItems = if (isExpanded) checklistItems else checklistItems.filter { !it.checked }
                displayItems.take(if (isExpanded) Int.MAX_VALUE else 5).forEachIndexed { _, item ->
                    val originalIndex = checklistItems.indexOf(item)
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(start = (item.indent * 16).dp)
                            .clickable(enabled = !isViewerRole) { onToggleChecklistItem(originalIndex) },
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Checkbox(
                            checked = item.checked,
                            onCheckedChange = if (isViewerRole) null else { { onToggleChecklistItem(originalIndex) } },
                            modifier = Modifier.size(20.dp),
                            colors = CheckboxDefaults.colors(
                                checkedColor = cardTextColor.copy(alpha = 0.8f),
                                uncheckedColor = cardTextColor.copy(alpha = 0.7f)
                            )
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = item.text,
                            style = MaterialTheme.typography.bodySmall,
                            textDecoration = if (item.checked) TextDecoration.LineThrough else TextDecoration.None,
                            color = if (item.checked) cardTextColor.copy(alpha = 0.5f) else cardTextColor,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }
            }

            // Collapse button when expanded
            if (isExpanded) {
                Text(
                    text = "▲ Collapse",
                    style = MaterialTheme.typography.labelSmall,
                    color = cardTextColor.copy(alpha = 0.7f),
                    modifier = Modifier
                        .padding(top = 4.dp)
                        .clickable { isExpanded = false }
                )
            }

            // Weather + Location indicators
            WeatherIndicator(
                weatherDataJson = chit.weatherData,
                modifier = Modifier.padding(top = 4.dp),
                textColor = cardTextColor.copy(alpha = 0.7f)
            )
            LocationIndicator(
                location = chit.location,
                modifier = Modifier.padding(top = 4.dp),
                textColor = cardTextColor.copy(alpha = 0.7f)
            )

            // Tag chips
            TagChipsRow(tags = chit.tags, modifier = Modifier.padding(top = 4.dp))

            // People chips
            PeopleChipsRow(people = chit.people, modifier = Modifier.padding(top = 4.dp))

            // Sharing/stealth indicators
            SharingIndicators(chit = chit, modifier = Modifier.padding(top = 4.dp))

            // Archive/snooze indicators
            ArchiveSnoozeIndicators(chit = chit, modifier = Modifier.padding(top = 4.dp))

            // Health indicator badges
            HealthIndicatorBadges(healthDataJson = chit.healthData, modifier = Modifier.padding(top = 4.dp))
        }
    }
}

/**
 * Build indicator emoji string for a notebook card.
 */
private fun buildNotebookIndicators(chit: ChitEntity, currentUserId: String): String {
    return buildString {
        if (chit.pinned) append("🔖 ")
        if (chit.archived) append("📦 ")
        if (!chit.snoozedUntil.isNullOrBlank()) {
            try {
                val snoozeEnd = Instant.parse(chit.snoozedUntil)
                if (snoozeEnd.isAfter(Instant.now())) append("😴 ")
            } catch (_: Exception) {}
        }
        if (chit.stealth == true && chit.ownerId == currentUserId) append("🥷 ")
        if (chit.alarm == true || chit.notification == true) append("🔔 ")
        if (chit.habit) append("🎯 ")
        else if (!chit.recurrenceRule.isNullOrBlank()) append("🔁 ")
        val attachRaw = chit.attachments
        if (!attachRaw.isNullOrBlank() && attachRaw != "[]") append("📎 ")
    }.trim()
}
