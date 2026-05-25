package com.cwoc.app.ui.screens.notes

import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
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
import com.cwoc.app.domain.sort.SortEngine
import com.cwoc.app.domain.sort.SortState
import com.cwoc.app.ui.components.ChitActionMenu
import com.cwoc.app.ui.components.AttachmentPrintPickerDialog
import com.cwoc.app.ui.components.ChitListScaffold
import com.cwoc.app.ui.components.CwocChitCardStyle
import com.cwoc.app.ui.components.LoadingChitsState
import com.cwoc.app.ui.components.QuickEditSheet
import com.cwoc.app.ui.components.SnoozePickerDialog
import com.cwoc.app.ui.components.UndoToast
import com.cwoc.app.ui.components.chitColorBorder
import com.cwoc.app.ui.components.sortPinnedFirst
import com.cwoc.app.ui.viewmodel.FilterSortViewModel
import kotlinx.coroutines.launch
import com.cwoc.app.ui.screens.editor.zones.AttachmentInfo
import com.cwoc.app.util.PrintAttachmentHelper
import androidx.compose.ui.platform.LocalContext
import java.time.Instant

/**
 * Notes screen displaying note chits with title and markdown preview.
 * Uses ChitListScaffold for FAB + sync indicator,
 * and click-to-edit navigation.
 * Applies FilterEngine and SortEngine from FilterSortViewModel before rendering.
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
    chitRepository: ChitRepository? = null,
    onQuickAlert: (() -> Unit)? = null,
    onCreateRule: ((ChitEntity) -> Unit)? = null
) {
    val uiState by viewModel.uiState.collectAsState()
    val syncState by viewModel.syncState.collectAsState()

    // Undo toast state
    val pendingDeleteChitId by viewModel.pendingDeleteChitId.collectAsState()
    val pendingDeleteTitle by viewModel.pendingDeleteTitle.collectAsState()

    // Settings for SnoozePickerDialog
    val timeFormat by viewModel.timeFormat.collectAsState()
    val calendarSnap by viewModel.calendarSnap.collectAsState()

    // Collect filter/sort state if ViewModel is provided
    val filterState = filterSortViewModel?.filterState?.collectAsState()?.value ?: FilterState()
    val sortState = filterSortViewModel?.sortState?.collectAsState()?.value ?: SortState()

    // Long-press action menu state
    var menuChit by remember { mutableStateOf<ChitEntity?>(null) }
    var showSnoozeDialog by remember { mutableStateOf(false) }
    var showPrintAttachmentPicker by remember { mutableStateOf(false) }
    // D3: Quick-edit sheet state
    var quickEditChit by remember { mutableStateOf<ChitEntity?>(null) }
    val coroutineScope = rememberCoroutineScope()
    val context = LocalContext.current
    val prefs = remember { context.getSharedPreferences("cwoc_prefs", android.content.Context.MODE_PRIVATE) }
    val notesServerUrl = remember { prefs.getString("server_url", "")?.trimEnd('/') ?: "" }
    val notesAuthToken = remember { prefs.getString("auth_token", "") ?: "" }

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
            onFabClick = { onNavigateToEditor("new") },
            onFabLongPress = onQuickAlert
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
                uiState.notes.isEmpty() && syncState == SyncState.SYNCING -> {
                    LoadingChitsState()
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
                        currentUserId = viewModel.currentUserId,
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
                onDelete = { viewModel.softDelete(currentMenuChit.id) },
                onCreateRule = if (onCreateRule != null) { { onCreateRule(currentMenuChit) } } else null,
                onPrintAttachment = { showPrintAttachmentPicker = true }
            )
        }

        // Snooze picker dialog
        if (showSnoozeDialog && currentMenuChit != null) {
            SnoozePickerDialog(
                is24Hour = (timeFormat == "24hour"),
                calendarSnap = calendarSnap,
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

        // Print Attachment picker dialog
        if (showPrintAttachmentPicker && currentMenuChit != null) {
            val attachments = PrintAttachmentHelper.parseAttachments(currentMenuChit.attachments)
            if (attachments.size == 1) {
                showPrintAttachmentPicker = false
                coroutineScope.launch {
                    PrintAttachmentHelper.downloadAndPrint(
                        context, attachments[0], currentMenuChit.id, notesServerUrl, notesAuthToken
                    )
                }
            } else if (attachments.size > 1) {
                AttachmentPrintPickerDialog(
                    attachments = attachments,
                    onSelect = { selected ->
                        showPrintAttachmentPicker = false
                        coroutineScope.launch {
                            PrintAttachmentHelper.downloadAndPrint(
                                context, selected, currentMenuChit.id, notesServerUrl, notesAuthToken
                            )
                        }
                    },
                    onDismiss = { showPrintAttachmentPicker = false }
                )
            } else {
                showPrintAttachmentPicker = false
            }
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
    currentUserId: String,
    modifier: Modifier = Modifier
) {
    // D1: Masonry layout using LazyVerticalStaggeredGrid
    // Single column on phone (≤600dp), responsive multi-column on tablet
    BoxWithConstraints(modifier = modifier.fillMaxSize()) {
        val isPhone = maxWidth <= 600.dp
        val columns = if (isPhone) {
            androidx.compose.foundation.lazy.staggeredgrid.StaggeredGridCells.Fixed(1)
        } else {
            androidx.compose.foundation.lazy.staggeredgrid.StaggeredGridCells.Adaptive(160.dp)
        }

        androidx.compose.foundation.lazy.staggeredgrid.LazyVerticalStaggeredGrid(
            columns = columns,
            modifier = Modifier
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
                    onLongClick = { onNoteLongPress(note) },
                    currentUserId = currentUserId
                )
            }
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun NoteCard(
    note: ChitEntity,
    onClick: () -> Unit,
    onLongClick: () -> Unit,
    currentUserId: String
) {
    // Show more/less toggle state for content preview
    var isExpanded by remember { mutableStateOf(false) }
    var hasOverflow by remember { mutableStateOf(false) }

    // Full background color matching web's applyChitColors(el, chitColor(chit))
    val cardBgColor = remember(note.color) { CwocChitCardStyle.resolveChitBgColor(note.color) }
    val cardTextColor = remember(cardBgColor) { CwocChitCardStyle.contrastTextColor(cardBgColor) }

    // Declined chit opacity (matches web's .declined-chit class)
    val isDeclined = note.availability == "declined"
    val cardAlpha = if (isDeclined) 0.5f else 1f

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .alpha(cardAlpha)
            .animateContentSize()
            .combinedClickable(
                onClick = { onClick() },
                onLongClick = onLongClick
            ),
        border = CwocChitCardStyle.cardBorder,
        colors = CardDefaults.cardColors(containerColor = cardBgColor),
        elevation = CwocChitCardStyle.cardElevation()
    ) {
        Column(
            modifier = Modifier.padding(12.dp)
        ) {
            // Title row with indicator icons (matches web's titleRow)
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Indicator icons before title (pinned, archived, snoozed, stealth, alerts, habit, recurrence, attachments)
                val indicators = remember(note, currentUserId) { buildNoteIndicators(note, currentUserId) }
                if (indicators.isNotEmpty()) {
                    Text(
                        text = indicators,
                        fontSize = 12.sp,
                        modifier = Modifier.padding(end = 4.dp)
                    )
                }

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
                    Text(
                        text = "(Untitled)",
                        style = MaterialTheme.typography.bodyLarge,
                        fontWeight = FontWeight.Medium,
                        color = cardTextColor.copy(alpha = 0.5f),
                        modifier = Modifier.weight(1f)
                    )
                }

                // Drag handle icon
                Text(
                    text = "⋮⋮",
                    style = MaterialTheme.typography.bodyLarge,
                    color = cardTextColor.copy(alpha = 0.5f)
                )
            }

            // Owner badge — show when owner differs from current user
            if (!note.ownerDisplayName.isNullOrBlank() && note.ownerId != currentUserId) {
                Text(
                    text = "👤 ${note.ownerDisplayName}",
                    style = MaterialTheme.typography.labelSmall,
                    color = cardTextColor.copy(alpha = 0.7f),
                    modifier = Modifier.padding(top = 2.dp)
                )
            }

            // Assignee badge
            if (!note.assignedTo.isNullOrBlank()) {
                Text(
                    text = "📌 ${note.assignedTo}",
                    style = MaterialTheme.typography.labelSmall,
                    color = cardTextColor.copy(alpha = 0.7f),
                    modifier = Modifier.padding(top = 2.dp)
                )
            }

            if (!note.title.isNullOrBlank() || !note.ownerDisplayName.isNullOrBlank()) {
                Spacer(modifier = Modifier.height(4.dp))
            }

            // Note content — truncated preview with "Show more" / "Show less" toggle
            if (!note.note.isNullOrBlank()) {
                Text(
                    text = com.cwoc.app.ui.util.MarkdownRenderer.renderToAnnotatedString(note.note.take(300)),
                    style = MaterialTheme.typography.bodyMedium,
                    color = cardTextColor.copy(alpha = 0.8f),
                    maxLines = if (isExpanded) Int.MAX_VALUE else 4,
                    overflow = TextOverflow.Ellipsis,
                    onTextLayout = { textLayoutResult ->
                        if (!isExpanded) {
                            hasOverflow = textLayoutResult.hasVisualOverflow
                        }
                    }
                )

                // "Show more" / "Show less" toggle — tap does NOT propagate to card onClick
                if (hasOverflow || isExpanded) {
                    Text(
                        text = if (isExpanded) "Show less" else "Show more",
                        fontSize = 12.sp,
                        color = Color(0xFF8B5A2B),
                        fontStyle = FontStyle.Italic,
                        modifier = Modifier
                            .padding(top = 4.dp)
                            .clickable { isExpanded = !isExpanded }
                    )
                }
            }

            // Tag chips — web shows these in _buildChitHeader on other views but
            // Notes view on web does NOT show tags, people, health badges, weather text,
            // location text, sharing, RSVP, or archive/snooze as separate sections.
            // The emoji indicators in the title row (weather icon, map icon, alerts, etc.)
            // are the only metadata shown on web note cards.
        }
    }
}

/**
 * Build indicator emoji string for a note card, matching web's titleRow icons.
 * Shows: pinned, archived, snoozed, stealth (owner only), alarm/notification, habit, recurrence, attachments.
 */
private fun buildNoteIndicators(note: ChitEntity, currentUserId: String): String {
    return buildString {
        if (note.pinned) append("🔖 ")
        if (note.archived) append("📦 ")
        if (!note.snoozedUntil.isNullOrBlank()) {
            try {
                val snoozeEnd = Instant.parse(note.snoozedUntil)
                if (snoozeEnd.isAfter(Instant.now())) append("😴 ")
            } catch (_: Exception) {}
        }
        // Stealth — only visible to the owner (matches web's Requirement 6.5)
        if (note.stealth == true && note.ownerId == currentUserId) append("🥷 ")
        if (note.alarm == true || note.notification == true) append("🔔 ")
        if (note.habit) append("🎯 ")
        else if (!note.recurrenceRule.isNullOrBlank()) append("🔁 ")
        // Attachment indicator
        val attachRaw = note.attachments
        if (!attachRaw.isNullOrBlank() && attachRaw != "[]") append("📎 ")
    }.trim()
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
