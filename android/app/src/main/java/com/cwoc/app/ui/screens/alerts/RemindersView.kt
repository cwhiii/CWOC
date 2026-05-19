package com.cwoc.app.ui.screens.alerts

import androidx.compose.animation.animateContentSize
import androidx.compose.animation.core.animateFloatAsState
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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Archive
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.outlined.BookmarkBorder
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarDuration
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.SnackbarResult
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.cwoc.app.data.local.entity.ChitEntity
import com.cwoc.app.data.repository.SettingsRepository
import kotlinx.coroutines.launch
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

// ─── Theme Colors ───────────────────────────────────────────────────────────────

private val ParchmentBrown = Color(0xFF6B4E31)
private val ParchmentText = Color(0xFF4A3520)
private val PastBadgeRed = Color(0xFFD32F2F)
private val DoneBadgeGreen = Color(0xFF2E7D32)

/**
 * Reminders mode view — displays chits with notification=true AND pointInTime != null,
 * split into "⏰ Upcoming" and "📭 Past" sections with quick actions.
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 9.10, 9.11
 */
@Composable
fun RemindersView(
    viewModel: AlertsViewModel,
    onNavigateToEditor: (String) -> Unit,
    settingsRepository: SettingsRepository
) {
    val reminders by viewModel.reminders.collectAsState()
    val settings by settingsRepository.settings.collectAsState(initial = null)
    val timeFormat = settings?.timeFormat ?: "12"

    val snackbarHostState = remember { SnackbarHostState() }
    val coroutineScope = rememberCoroutineScope()

    // Track which chits are in "completing" state (faded, pending undo)
    var completingChitIds by remember { mutableStateOf(setOf<String>()) }

    // Delete confirmation dialog state
    var deleteConfirmChitId by remember { mutableStateOf<String?>(null) }

    // Split reminders into upcoming and past
    val now = remember { LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME) }
    val upcoming = remember(reminders, now) {
        reminders.filter { (it.pointInTime ?: "") >= now }
    }
    val past = remember(reminders, now) {
        reminders.filter { (it.pointInTime ?: "") < now }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(hostState = snackbarHostState) },
        containerColor = Color.Transparent
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            if (reminders.isEmpty()) {
                // Empty state
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "No reminders.",
                        style = MaterialTheme.typography.titleMedium,
                        color = ParchmentBrown
                    )
                }
            } else {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 12.dp, vertical = 8.dp)
                ) {
                    // ⏰ Upcoming section
                    if (upcoming.isNotEmpty()) {
                        item {
                            ReminderSectionHeader(
                                title = "⏰ Upcoming",
                                count = upcoming.size
                            )
                        }
                        items(upcoming, key = { it.id }) { chit ->
                            val isCompleting = chit.id in completingChitIds
                            ReminderCard(
                                chit = chit,
                                timeFormat = timeFormat,
                                isUpcoming = true,
                                isCompleting = isCompleting,
                                onPinToggle = { viewModel.toggleReminderPin(chit.id) },
                                onComplete = {
                                    completingChitIds = completingChitIds + chit.id
                                    viewModel.completeReminder(chit.id)
                                    coroutineScope.launch {
                                        val result = snackbarHostState.showSnackbar(
                                            message = "Completing \"${chit.title ?: "Untitled"}\"...",
                                            actionLabel = "Undo",
                                            duration = SnackbarDuration.Short
                                        )
                                        if (result == SnackbarResult.ActionPerformed) {
                                            viewModel.cancelComplete(chit.id)
                                            completingChitIds = completingChitIds - chit.id
                                        }
                                    }
                                },
                                onArchive = { viewModel.archiveReminder(chit.id) },
                                onDelete = { deleteConfirmChitId = chit.id },
                                onNavigateToEditor = { onNavigateToEditor(chit.id) }
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                        }
                    }

                    // 📭 Past section
                    if (past.isNotEmpty()) {
                        item {
                            Spacer(modifier = Modifier.height(16.dp))
                            ReminderSectionHeader(
                                title = "📭 Past",
                                count = past.size
                            )
                        }
                        items(past, key = { it.id }) { chit ->
                            val isCompleting = chit.id in completingChitIds
                            ReminderCard(
                                chit = chit,
                                timeFormat = timeFormat,
                                isUpcoming = false,
                                isCompleting = isCompleting,
                                onPinToggle = { viewModel.toggleReminderPin(chit.id) },
                                onComplete = {
                                    completingChitIds = completingChitIds + chit.id
                                    viewModel.completeReminder(chit.id)
                                    coroutineScope.launch {
                                        val result = snackbarHostState.showSnackbar(
                                            message = "Completing \"${chit.title ?: "Untitled"}\"...",
                                            actionLabel = "Undo",
                                            duration = SnackbarDuration.Short
                                        )
                                        if (result == SnackbarResult.ActionPerformed) {
                                            viewModel.cancelComplete(chit.id)
                                            completingChitIds = completingChitIds - chit.id
                                        }
                                    }
                                },
                                onArchive = { viewModel.archiveReminder(chit.id) },
                                onDelete = { deleteConfirmChitId = chit.id },
                                onNavigateToEditor = { onNavigateToEditor(chit.id) }
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                        }
                    }
                }
            }
        }
    }

    // Delete confirmation dialog
    deleteConfirmChitId?.let { chitId ->
        val chitTitle = reminders.firstOrNull { it.id == chitId }?.title ?: "Untitled"
        AlertDialog(
            onDismissRequest = { deleteConfirmChitId = null },
            title = { Text("Delete Reminder", color = ParchmentText) },
            text = {
                Text(
                    "Are you sure you want to delete \"$chitTitle\"?",
                    color = ParchmentText
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        viewModel.deleteReminder(chitId)
                        deleteConfirmChitId = null
                    },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color(0xFFD32F2F)
                    )
                ) {
                    Text("Delete")
                }
            },
            dismissButton = {
                TextButton(onClick = { deleteConfirmChitId = null }) {
                    Text("Cancel", color = ParchmentBrown)
                }
            }
        )
    }
}

// ─── Section Header ─────────────────────────────────────────────────────────────

@Composable
private fun ReminderSectionHeader(title: String, count: Int) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = "$title ($count)",
            style = MaterialTheme.typography.titleSmall,
            color = ParchmentBrown,
            fontWeight = FontWeight.Bold
        )
    }
}

// ─── Reminder Card ──────────────────────────────────────────────────────────────

@Composable
private fun ReminderCard(
    chit: ChitEntity,
    timeFormat: String,
    isUpcoming: Boolean,
    isCompleting: Boolean,
    onPinToggle: () -> Unit,
    onComplete: () -> Unit,
    onArchive: () -> Unit,
    onDelete: () -> Unit,
    onNavigateToEditor: () -> Unit
) {
    val isComplete = chit.status == "Complete"
    val isPast = !isUpcoming
    val showPastBadge = isPast && !isComplete
    val showDoneBadge = isComplete

    // Reduced opacity for completed cards or cards being completed
    val cardAlpha by animateFloatAsState(
        targetValue = when {
            isCompleting -> 0.4f
            isComplete -> 0.6f
            else -> 1f
        },
        label = "cardAlpha"
    )

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .alpha(cardAlpha)
            .animateContentSize(),
        colors = CardDefaults.cardColors(
            containerColor = Color(0xFFFFFAF0)
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier.padding(12.dp)
        ) {
            // Top row: Pin button + Title
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Pin toggle button
                IconButton(
                    onClick = onPinToggle,
                    modifier = Modifier.size(36.dp)
                ) {
                    Icon(
                        imageVector = if (chit.pinned) Icons.Filled.Bookmark
                        else Icons.Outlined.BookmarkBorder,
                        contentDescription = if (chit.pinned) "Unpin" else "Pin",
                        tint = if (chit.pinned) ParchmentBrown else Color(0xFF8B7355),
                        modifier = Modifier.size(20.dp)
                    )
                }

                Spacer(modifier = Modifier.width(4.dp))

                // Chit title (tappable to navigate to editor)
                TextButton(
                    onClick = onNavigateToEditor,
                    modifier = Modifier.weight(1f)
                ) {
                    Text(
                        text = chit.title ?: "Untitled",
                        style = MaterialTheme.typography.bodyLarge,
                        color = ParchmentText,
                        fontWeight = FontWeight.Medium,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Meta row: date with badges
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "📢 ${formatPointInTime(chit.pointInTime, timeFormat)}",
                    style = MaterialTheme.typography.bodySmall,
                    color = Color(0xFF8B7355)
                )

                // Past badge (red) — shown when past and not complete
                if (showPastBadge) {
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "past",
                        style = MaterialTheme.typography.labelSmall,
                        color = PastBadgeRed,
                        fontWeight = FontWeight.Bold
                    )
                }

                // Done badge (green) — shown when status is Complete
                if (showDoneBadge) {
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "✓ done",
                        style = MaterialTheme.typography.labelSmall,
                        color = DoneBadgeGreen,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Action buttons row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Complete button
                TextButton(
                    onClick = onComplete,
                    enabled = !isCompleting && !isComplete
                ) {
                    Icon(
                        imageVector = Icons.Filled.Check,
                        contentDescription = "Complete",
                        tint = if (!isCompleting && !isComplete) DoneBadgeGreen else Color.Gray,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = "Complete",
                        style = MaterialTheme.typography.labelMedium,
                        color = if (!isCompleting && !isComplete) DoneBadgeGreen else Color.Gray
                    )
                }

                // Archive button
                TextButton(onClick = onArchive) {
                    Icon(
                        imageVector = Icons.Filled.Archive,
                        contentDescription = "Archive",
                        tint = ParchmentBrown,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = "Archive",
                        style = MaterialTheme.typography.labelMedium,
                        color = ParchmentBrown
                    )
                }

                // Delete button
                TextButton(onClick = onDelete) {
                    Icon(
                        imageVector = Icons.Filled.Delete,
                        contentDescription = "Delete",
                        tint = PastBadgeRed,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = "Delete",
                        style = MaterialTheme.typography.labelMedium,
                        color = PastBadgeRed
                    )
                }
            }
        }
    }
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Formats a pointInTime ISO string to "YYYY-Mon-DD HH:MM" format,
 * respecting the user's time_format setting (12h or 24h).
 */
private fun formatPointInTime(pointInTime: String?, timeFormat: String): String {
    if (pointInTime.isNullOrBlank()) return "—"
    return try {
        val dateTime = LocalDateTime.parse(pointInTime, DateTimeFormatter.ISO_LOCAL_DATE_TIME)
        val dateStr = dateTime.format(DateTimeFormatter.ofPattern("yyyy-MMM-dd"))
        val timeStr = if (timeFormat == "24") {
            dateTime.format(DateTimeFormatter.ofPattern("HH:mm"))
        } else {
            dateTime.format(DateTimeFormatter.ofPattern("hh:mm a"))
        }
        "$dateStr $timeStr"
    } catch (_: Exception) {
        pointInTime
    }
}
