package com.cwoc.app.ui.screens.checklists

import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.staggeredgrid.StaggeredGridCells
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
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
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.cwoc.app.data.local.entity.ChitEntity
import com.cwoc.app.data.repository.ChitRepository
import com.cwoc.app.domain.checklist.ChecklistItem
import com.cwoc.app.domain.checklist.ChecklistOperations
import com.cwoc.app.domain.filter.FilterEngine
import com.cwoc.app.domain.filter.FilterState
import com.cwoc.app.domain.sort.SortEngine
import com.cwoc.app.domain.sort.SortField
import com.cwoc.app.domain.sort.SortState
import com.cwoc.app.ui.components.ChitActionMenu
import com.cwoc.app.ui.components.SnoozePickerDialog
import com.cwoc.app.ui.components.TagChipsRow
import com.cwoc.app.ui.components.ChecklistProgressBadge
import com.cwoc.app.ui.components.PeopleChipsRow
import com.cwoc.app.ui.components.SharingIndicators
import com.cwoc.app.ui.components.RsvpIndicators
import com.cwoc.app.ui.components.ArchiveSnoozeIndicators
import com.cwoc.app.ui.components.chitColorBorder
import com.cwoc.app.ui.components.CwocChitCardStyle
import com.cwoc.app.ui.components.sortPinnedFirst
import com.cwoc.app.ui.components.ReorderableStaggeredGrid
import com.cwoc.app.ui.viewmodel.FilterSortViewModel
import kotlinx.coroutines.launch

/**
 * Checklists view — displays all chits with checklist data.
 * Each chit is shown as a card with its nested checklist items.
 * Tap an item to toggle its checked state.
 * Applies FilterEngine and SortEngine from FilterSortViewModel before rendering.
 * Long-press on a card shows ChitActionMenu for pin/archive/snooze actions.
 *
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 9.8, 10.4
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun ChecklistsScreen(
    onNavigateToEditor: (String) -> Unit,
    modifier: Modifier = Modifier,
    viewModel: ChecklistsViewModel = hiltViewModel(),
    filterSortViewModel: FilterSortViewModel? = null,
    chitRepository: ChitRepository? = null
) {
    val chits by viewModel.checklistChits.collectAsState()

    // Collect filter/sort state if ViewModel is provided
    val filterState = filterSortViewModel?.filterState?.collectAsState()?.value ?: FilterState()
    val sortState = filterSortViewModel?.sortState?.collectAsState()?.value ?: SortState()

    // Determine if manual sort is active (enables drag-to-reorder)
    val isManualSort = sortState.field == SortField.MANUAL

    // Long-press action menu state
    var menuChit by remember { mutableStateOf<ChitEntity?>(null) }
    var showSnoozeDialog by remember { mutableStateOf(false) }
    val coroutineScope = rememberCoroutineScope()

    // Apply filters, sort, and pin-to-top to the checklist chits
    val filteredSortedChits = remember(chits, filterState, sortState) {
        val filtered = FilterEngine.applyFilters(chits, filterState)
        val sorted = SortEngine.sort(filtered, sortState.field, sortState.direction)
        sortPinnedFirst(sorted) { it.pinned }
    }

    // Check if filters are active (non-default state)
    val hasActiveFilters = filterState != FilterState()

    Box(modifier = modifier.fillMaxSize()) {
        when {
            filteredSortedChits.isEmpty() && hasActiveFilters -> {
                FilteredEmptyState(
                    onClearFilters = { filterSortViewModel?.clearFilters() }
                )
            }
            chits.isEmpty() -> {
                EmptyChecklistsState()
            }
            filteredSortedChits.isEmpty() -> {
                FilteredEmptyState(
                    onClearFilters = { filterSortViewModel?.clearFilters() }
                )
            }
            else -> {
                ReorderableStaggeredGrid(
                    items = filteredSortedChits,
                    key = { it.id },
                    columns = StaggeredGridCells.Fixed(1),
                    onReorder = { fromIndex, toIndex ->
                        viewModel.reorderChecklists(filteredSortedChits, fromIndex, toIndex)
                    },
                    enabled = isManualSort,
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                    verticalItemSpacing = 8.dp
                ) { chit, _ ->
                    ChecklistChitCard(
                        chit = chit,
                        onToggleItem = { index -> viewModel.toggleItem(chit.id, index) },
                        onCardTap = { onNavigateToEditor(chit.id) },
                        onCardLongPress = { menuChit = chit }
                    )
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
                onDelete = { /* Checklists screen doesn't have soft-delete yet */ }
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
private fun ChecklistChitCard(
    chit: ChitEntity,
    onToggleItem: (Int) -> Unit,
    onCardTap: () -> Unit,
    onCardLongPress: () -> Unit
) {
    val items = ChecklistOperations.parseChecklist(chit.checklist)

    // Full background color matching web's applyChitColors(el, chitColor(chit))
    val cardBgColor = remember(chit.color) { CwocChitCardStyle.resolveChitBgColor(chit.color) }
    val cardTextColor = remember(cardBgColor) { CwocChitCardStyle.contrastTextColor(cardBgColor) }

    // Declined chit opacity (matches web's .declined-chit class)
    val isDeclined = chit.availability == "declined"
    val cardAlpha = if (isDeclined) 0.5f else 1f

    // All-done check: every non-empty checklist item is checked
    val allDone = remember(items) {
        items.isNotEmpty() && items.all { it.checked }
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .alpha(cardAlpha)
            .animateContentSize()
            .combinedClickable(
                onClick = onCardTap,
                onLongClick = onCardLongPress
            ),
        border = CwocChitCardStyle.cardBorder,
        colors = CardDefaults.cardColors(containerColor = cardBgColor),
        elevation = CwocChitCardStyle.cardElevation()
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            // Chit title + indicator icons + checklist progress
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Indicator icons (pinned, archived, snoozed, stealth, alerts)
                val indicators = buildString {
                    if (chit.pinned) append("🔖 ")
                    if (chit.archived) append("📦 ")
                    if (!chit.snoozedUntil.isNullOrBlank()) append("😴 ")
                    if (chit.stealth == true) append("🥷 ")
                    if (chit.alarm == true || chit.notification == true) append("🔔 ")
                }.trim()
                if (indicators.isNotEmpty()) {
                    Text(
                        text = indicators,
                        fontSize = 12.sp,
                        modifier = Modifier.padding(end = 4.dp)
                    )
                }

                // Title with strikethrough when all items are checked
                val allChecked = items.isNotEmpty() && items.all { it.checked }
                Text(
                    text = chit.title ?: "Untitled",
                    style = MaterialTheme.typography.titleSmall,
                    color = if (allChecked) cardTextColor.copy(alpha = 0.5f) else cardTextColor,
                    textDecoration = if (allChecked) TextDecoration.LineThrough else TextDecoration.None,
                    modifier = Modifier.weight(1f),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                // B3: Checklist progress count
                ChecklistProgressBadge(
                    checklistJson = chit.checklist,
                    modifier = Modifier.padding(start = 8.dp),
                    textColor = cardTextColor
                )
            }

            Spacer(modifier = Modifier.height(4.dp))

            // B8: Sharing/stealth indicators
            SharingIndicators(chit = chit)

            // B15: RSVP indicators
            RsvpIndicators(sharesJson = chit.shares)

            // B9: Archive/snooze indicators
            ArchiveSnoozeIndicators(chit = chit)

            // Checklist items — only show unchecked items (checked are counted in progress badge)
            items.forEachIndexed { index, item ->
                if (!item.checked) {
                    ChecklistItemRow(
                        item = item,
                        textColor = cardTextColor,
                        onToggle = { onToggleItem(index) }
                    )
                }
            }

            // Tags at the bottom (system tags filtered by TagChipsRow)
            TagChipsRow(
                tags = chit.tags,
                modifier = Modifier.padding(top = 4.dp)
            )

            // B4: People chips
            if (!chit.people.isNullOrEmpty()) {
                PeopleChipsRow(
                    people = chit.people,
                    modifier = Modifier.padding(top = 4.dp)
                )
            }

            // Location indicator
            if (!chit.location.isNullOrBlank()) {
                com.cwoc.app.ui.components.LocationIndicator(
                    location = chit.location,
                    modifier = Modifier.padding(top = 4.dp),
                    textColor = cardTextColor.copy(alpha = 0.7f)
                )
            }
        }
    }
}

@Composable
private fun ChecklistItemRow(
    item: ChecklistItem,
    textColor: Color = Color(0xFF1A1208),
    onToggle: () -> Unit
) {
    val indentDp = ChecklistOperations.indentationDp(item.indent)

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(start = indentDp.dp)
            .clickable { onToggle() },
        verticalAlignment = Alignment.CenterVertically
    ) {
        Checkbox(
            checked = item.checked,
            onCheckedChange = { onToggle() },
            colors = CheckboxDefaults.colors(
                checkedColor = textColor.copy(alpha = 0.8f),
                uncheckedColor = textColor.copy(alpha = 0.7f),
                checkmarkColor = if (textColor == Color(0xFF2B1E0F) || textColor == Color(0xFF1A1208))
                    Color(0xFFFDF5E6) else Color(0xFF2B1E0F)
            )
        )
        Spacer(modifier = Modifier.width(4.dp))
        Text(
            text = item.text,
            style = MaterialTheme.typography.bodyMedium,
            textDecoration = if (item.checked) TextDecoration.LineThrough else TextDecoration.None,
            color = if (item.checked) textColor.copy(alpha = 0.6f) else textColor,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis
        )
    }
}

@Composable
private fun EmptyChecklistsState() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Spacer(modifier = Modifier.height(120.dp))
        Text(
            text = "No checklists yet",
            style = MaterialTheme.typography.titleMedium,
            color = Color(0xFF6B4E31)
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "Create a chit with checklist items to see them here.",
            style = MaterialTheme.typography.bodyMedium,
            color = Color(0xFF8B7355)
        )
    }
}
