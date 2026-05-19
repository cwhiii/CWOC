package com.cwoc.app.ui.screens.notes

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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.cwoc.app.data.local.entity.ChitEntity
import com.cwoc.app.data.repository.ChitRepository
import com.cwoc.app.domain.filter.FilterEngine
import com.cwoc.app.domain.filter.FilterState
import com.cwoc.app.domain.sort.SortEngine
import com.cwoc.app.domain.sort.SortState
import com.cwoc.app.ui.components.ChitActionMenu
import com.cwoc.app.ui.components.ChitListScaffold
import com.cwoc.app.ui.components.CwocChitCardStyle
import com.cwoc.app.ui.components.QuickEditSheet
import com.cwoc.app.ui.components.SnoozePickerDialog
import com.cwoc.app.ui.components.SwipeableChitCard
import com.cwoc.app.ui.components.UndoToast
import com.cwoc.app.ui.components.TagChipsRow
import com.cwoc.app.ui.components.PeopleChipsRow
import com.cwoc.app.ui.components.SharingIndicators
import com.cwoc.app.ui.components.ArchiveSnoozeIndicators
import com.cwoc.app.ui.components.chitColorBorder
import com.cwoc.app.ui.components.sortPinnedFirst
import com.cwoc.app.ui.util.MarkdownRenderer
import com.cwoc.app.ui.viewmodel.FilterSortViewModel
import kotlinx.coroutines.launch

/**
 * Notes screen displaying note chits with title and markdown preview.
 * Uses ChitListScaffold for FAB + sync indicator, SwipeableChitCard for swipe-to-delete,
 * and click-to-edit navigation.
 * Applies FilterEngine and SortEngine from FilterSortViewModel before rendering.
 * Shows UndoToast on swipe-to-delete with 5-second countdown before syncing.
 * Long-press on a card shows ChitActionMenu for pin/archive/snooze actions.
 *
 * Validates: Requirements 2.1, 4.1, 4.2, 4.3, 4.4, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 9.8, 10.4, 12.1, 13.1, 13.3, 13.4
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun NotesScreen(
    onNavigateToEditor: (String) -> Unit,
    viewModel: NotesViewModel = hiltViewModel(),
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

    // Long-press action menu state
    var menuChit by remember { mutableStateOf<ChitEntity?>(null) }
    var showSnoozeDialog by remember { mutableStateOf(false) }
    // D3: Quick-edit sheet state
    var quickEditChit by remember { mutableStateOf<ChitEntity?>(null) }
    val coroutineScope = rememberCoroutineScope()

    // Apply filters, sort, and pin-to-top to the notes list
    val filteredSortedNotes = remember(uiState.notes, filterState, sortState) {
        val filtered = FilterEngine.applyFilters(uiState.notes, filterState)
        val sorted = SortEngine.sort(filtered, sortState.field, sortState.direction)
        sortPinnedFirst(sorted) { it.pinned }
    }

    // Check if filters are active (non-default state)
    val hasActiveFilters = filterState != FilterState()

    Box(modifier = Modifier.fillMaxSize()) {
        ChitListScaffold(
            title = "Notes",
            syncState = syncState,
            onFabClick = { onNavigateToEditor("new") }
        ) { paddingValues ->
            Column(modifier = Modifier.padding(paddingValues)) {
            when {
                uiState.isLoading -> {
                    NotesLoadingSkeleton()
                }
                filteredSortedNotes.isEmpty() && hasActiveFilters -> {
                    FilteredEmptyState(
                        onClearFilters = { filterSortViewModel?.clearFilters() }
                    )
                }
                uiState.notes.isEmpty() -> {
                    NotesEmptyState()
                }
                filteredSortedNotes.isEmpty() -> {
                    FilteredEmptyState(
                        onClearFilters = { filterSortViewModel?.clearFilters() }
                    )
                }
                else -> {
                    NotesList(
                        notes = filteredSortedNotes,
                        onNoteClick = { chitId -> onNavigateToEditor(chitId) },
                        onNoteDelete = { chitId -> viewModel.softDelete(chitId) },
                        onNoteLongPress = { chit -> quickEditChit = chit },
                        modifier = Modifier
                    )
                }
            }
            } // Column
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

        // D3: Quick-edit bottom sheet
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
private fun NotesList(
    notes: List<ChitEntity>,
    onNoteClick: (String) -> Unit,
    onNoteDelete: (String) -> Unit,
    onNoteLongPress: (ChitEntity) -> Unit,
    modifier: Modifier = Modifier
) {
    // D1: Masonry layout using LazyVerticalStaggeredGrid
    // 2 columns on phone, responsive to screen width
    androidx.compose.foundation.lazy.staggeredgrid.LazyVerticalStaggeredGrid(
        columns = androidx.compose.foundation.lazy.staggeredgrid.StaggeredGridCells.Adaptive(160.dp),
        modifier = modifier
            .fillMaxSize()
            .padding(horizontal = 8.dp),
        verticalItemSpacing = 8.dp,
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        items(notes.size, key = { notes[it].id }) { index ->
            val note = notes[index]
            NoteCard(
                note = note,
                onClick = { onNoteClick(note.id) },
                onLongClick = { onNoteLongPress(note) }
            )
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun NoteCard(
    note: ChitEntity,
    onClick: () -> Unit,
    onLongClick: () -> Unit
) {
    // D7: Expandable card — tap to expand/collapse preview
    var isExpanded by remember { mutableStateOf(false) }

    // Full background color matching web's applyChitColors(el, chitColor(chit))
    val cardBgColor = remember(note.color) { CwocChitCardStyle.resolveChitBgColor(note.color) }
    val cardTextColor = remember(cardBgColor) { CwocChitCardStyle.contrastTextColor(cardBgColor) }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .animateContentSize()
            .combinedClickable(
                onClick = {
                    // Single tap toggles expand; double-tap or long-press for other actions
                    if (isExpanded) {
                        // When expanded, tap navigates to full editor
                        onClick()
                    } else {
                        // When collapsed, tap expands the preview
                        isExpanded = true
                    }
                },
                onLongClick = onLongClick
            ),
        border = CwocChitCardStyle.cardBorder,
        colors = CardDefaults.cardColors(containerColor = cardBgColor),
        elevation = CwocChitCardStyle.cardElevation()
    ) {
        Column(
            modifier = Modifier.padding(12.dp)
        ) {
            // D2: Drag handle row at top of card
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                if (!note.title.isNullOrBlank()) {
                    Text(
                        text = note.title,
                        style = MaterialTheme.typography.bodyLarge,
                        fontWeight = FontWeight.Medium,
                        color = cardTextColor,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f)
                    )
                } else {
                    Spacer(modifier = Modifier.weight(1f))
                }
                // Drag handle icon
                Text(
                    text = "⋮⋮",
                    style = MaterialTheme.typography.bodyLarge,
                    color = cardTextColor.copy(alpha = 0.5f)
                )
            }

            if (!note.title.isNullOrBlank()) {
                Spacer(modifier = Modifier.height(4.dp))
            }

            if (!note.note.isNullOrBlank()) {
                val previewText = if (isExpanded) note.note else note.note.take(300)
                Text(
                    text = MarkdownRenderer.renderToAnnotatedString(previewText),
                    style = MaterialTheme.typography.bodyMedium,
                    color = cardTextColor.copy(alpha = 0.8f),
                    maxLines = if (isExpanded) Int.MAX_VALUE else 5,
                    overflow = if (isExpanded) TextOverflow.Clip else TextOverflow.Ellipsis
                )
                // D7: Collapse button when expanded
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
            }

            // B1: Tag chips
            TagChipsRow(
                tags = note.tags,
                modifier = Modifier.padding(top = 4.dp)
            )

            // B4: People chips
            PeopleChipsRow(
                people = note.people,
                modifier = Modifier.padding(top = 4.dp)
            )

            // B8: Sharing/stealth indicators
            SharingIndicators(
                chit = note,
                modifier = Modifier.padding(top = 4.dp)
            )

            // B9: Archive/snooze indicators
            ArchiveSnoozeIndicators(
                chit = note,
                modifier = Modifier.padding(top = 4.dp)
            )

            // Pin indicator
            if (note.pinned) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "📌 Pinned",
                    style = MaterialTheme.typography.labelSmall,
                    color = cardTextColor.copy(alpha = 0.7f)
                )
            }
        }
    }
}

@Composable
private fun NotesLoadingSkeleton() {
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
private fun NotesEmptyState() {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = "No Notes",
                style = MaterialTheme.typography.headlineSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "Notes will appear here after syncing",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}
