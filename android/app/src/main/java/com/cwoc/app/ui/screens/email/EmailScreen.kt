package com.cwoc.app.ui.screens.email

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.material.icons.filled.Archive
import androidx.compose.material.icons.filled.AttachFile
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Forward
import androidx.compose.material.icons.filled.Reply
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.SwipeToDismissBox
import androidx.compose.material3.SwipeToDismissBoxState
import androidx.compose.material3.SwipeToDismissBoxValue
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.rememberSwipeToDismissBoxState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.cwoc.app.data.local.entity.ChitEntity
import com.cwoc.app.ui.components.CwocChitCardStyle
import com.cwoc.app.ui.components.TagChipsRow

/**
 * Email client screen — displays email inbox with folder navigation, threading, and compose.
 * Supports folder switching, bundle tabs, thread expansion, and swipe actions.
 *
 * Validates: Requirements 3.2
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EmailScreen(
    onNavigateToEditor: (String) -> Unit = {},
    modifier: Modifier = Modifier,
    viewModel: EmailViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    Scaffold(
        modifier = modifier,
        topBar = {
            TopAppBar(
                title = { Text("Email") }
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = { onNavigateToEditor("new") },
                containerColor = MaterialTheme.colorScheme.primary
            ) {
                Icon(
                    imageVector = Icons.Default.Edit,
                    contentDescription = "Compose email"
                )
            }
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            // Content area
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
                uiState.threads.isEmpty() -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(
                                text = "No emails",
                                style = MaterialTheme.typography.headlineSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = "Tap + to compose a new email",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
                else -> {
                    // 4. Email thread list
                    EmailThreadList(
                        threads = uiState.threads,
                        onNavigateToEditor = onNavigateToEditor,
                        onArchive = { chitId -> viewModel.archive(chitId) },
                        onMoveToTrash = { chitId -> viewModel.moveToTrash(chitId) },
                        onReply = { chitId -> viewModel.createReply(chitId) { newId -> onNavigateToEditor(newId) } },
                        onForward = { chitId -> viewModel.createForward(chitId) { newId -> onNavigateToEditor(newId) } }
                    )
                }
            }
        }
    }
}

// ─── Email Thread List ────────────────────────────────────────────────────────

@Composable
private fun EmailThreadList(
    threads: List<EmailThread>,
    onNavigateToEditor: (String) -> Unit,
    onArchive: (String) -> Unit,
    onMoveToTrash: (String) -> Unit,
    onReply: (String) -> Unit,
    onForward: (String) -> Unit
) {
    // Track which threads are expanded
    var expandedThreadIds by remember { mutableStateOf(setOf<String>()) }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        items(threads, key = { it.id }) { thread ->
            val isExpanded = expandedThreadIds.contains(thread.id)

            EmailSwipeableCard(
                onArchive = { onArchive(thread.latestMessage.id) },
                onDelete = { onMoveToTrash(thread.latestMessage.id) }
            ) {
                Column {
                    EmailThreadCard(
                        thread = thread,
                        isExpanded = isExpanded,
                        onClick = {
                            expandedThreadIds = if (isExpanded) {
                                expandedThreadIds - thread.id
                            } else {
                                expandedThreadIds + thread.id
                            }
                        }
                    )

                    // Thread expansion: show all messages when expanded
                    AnimatedVisibility(
                        visible = isExpanded,
                        enter = expandVertically(),
                        exit = shrinkVertically()
                    ) {
                        Column(
                            modifier = Modifier.padding(start = 16.dp, top = 4.dp),
                            verticalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            thread.messages.forEach { message ->
                                EmailMessageCard(
                                    message = message,
                                    onClick = { onNavigateToEditor(message.id) },
                                    onReply = { onReply(message.id) },
                                    onForward = { onForward(message.id) }
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

// ─── Email Swipeable Card ─────────────────────────────────────────────────────

/**
 * Bidirectional swipe wrapper for email cards:
 * - Swipe right (StartToEnd) → Archive (green background)
 * - Swipe left (EndToStart) → Delete/Trash (red background)
 */
@Composable
private fun EmailSwipeableCard(
    onArchive: () -> Unit,
    onDelete: () -> Unit,
    content: @Composable () -> Unit
) {
    val dismissState = rememberSwipeToDismissBoxState(
        confirmValueChange = { value ->
            when (value) {
                SwipeToDismissBoxValue.StartToEnd -> {
                    onArchive()
                    true
                }
                SwipeToDismissBoxValue.EndToStart -> {
                    onDelete()
                    true
                }
                SwipeToDismissBoxValue.Settled -> false
            }
        }
    )

    SwipeToDismissBox(
        state = dismissState,
        backgroundContent = { EmailSwipeBackground(dismissState) },
        content = { content() }
    )
}

@Composable
private fun EmailSwipeBackground(dismissState: SwipeToDismissBoxState) {
    val direction = dismissState.dismissDirection

    val color by animateColorAsState(
        when (direction) {
            SwipeToDismissBoxValue.StartToEnd -> Color(0xFF4CAF50) // Green for archive
            SwipeToDismissBoxValue.EndToStart -> Color(0xFFD32F2F) // Red for delete
            else -> Color.Transparent
        },
        label = "email_swipe_bg_color"
    )

    val icon = when (direction) {
        SwipeToDismissBoxValue.StartToEnd -> Icons.Default.Archive
        SwipeToDismissBoxValue.EndToStart -> Icons.Default.Delete
        else -> Icons.Default.Archive
    }

    val alignment = when (direction) {
        SwipeToDismissBoxValue.StartToEnd -> Alignment.CenterStart
        SwipeToDismissBoxValue.EndToStart -> Alignment.CenterEnd
        else -> Alignment.CenterStart
    }

    val scale by animateFloatAsState(
        if (dismissState.targetValue == SwipeToDismissBoxValue.Settled) 0.75f else 1f,
        label = "email_swipe_icon_scale"
    )

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(color)
            .padding(horizontal = 20.dp),
        contentAlignment = alignment
    ) {
        Icon(
            imageVector = icon,
            contentDescription = if (direction == SwipeToDismissBoxValue.StartToEnd) "Archive" else "Delete",
            modifier = Modifier.scale(scale),
            tint = Color.White
        )
    }
}

// ─── Email Thread Card ────────────────────────────────────────────────────────

/**
 * Card composable for an email thread showing:
 * unread dot, sender, reply indicator, subject, tag chips, attachment icon,
 * preview snippet, date, and badge chips.
 */
@Composable
private fun EmailThreadCard(
    thread: EmailThread,
    isExpanded: Boolean,
    onClick: () -> Unit
) {
    val isUnread = thread.unreadCount > 0
    val latestMessage = thread.latestMessage

    // Full background color matching web's applyChitColors(card, chitColor(chit))
    val cardBgColor = remember(latestMessage.color) { CwocChitCardStyle.resolveChitBgColor(latestMessage.color) }
    val cardTextColor = remember(cardBgColor) { CwocChitCardStyle.contrastTextColor(cardBgColor) }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        border = CwocChitCardStyle.cardBorder,
        colors = CardDefaults.cardColors(containerColor = cardBgColor),
        elevation = CwocChitCardStyle.cardElevation()
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.Top
        ) {
            // Unread indicator dot
            if (isUnread) {
                Box(
                    modifier = Modifier
                        .padding(top = 6.dp, end = 8.dp)
                        .size(8.dp)
                        .clip(CircleShape)
                        .background(cardTextColor)
                )
            } else {
                Spacer(modifier = Modifier.width(16.dp))
            }

            // Main content
            Column(modifier = Modifier.weight(1f)) {
                // Top row: sender + reply indicator + date
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.weight(1f)
                    ) {
                        // Sender name
                        Text(
                            text = extractSenderName(latestMessage.emailFrom),
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = if (isUnread) FontWeight.Bold else FontWeight.Normal,
                            color = cardTextColor,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.weight(1f, fill = false)
                        )

                        // Reply indicator (thread has > 1 message)
                        if (thread.messages.size > 1) {
                            Spacer(modifier = Modifier.width(4.dp))
                            Icon(
                                imageVector = Icons.Default.Reply,
                                contentDescription = "Thread",
                                modifier = Modifier.size(14.dp),
                                tint = cardTextColor.copy(alpha = 0.7f)
                            )
                            Text(
                                text = "${thread.messages.size}",
                                style = MaterialTheme.typography.labelSmall,
                                color = cardTextColor.copy(alpha = 0.7f)
                            )
                        }
                    }

                    // Date
                    Text(
                        text = formatEmailDate(thread.latestDate),
                        style = MaterialTheme.typography.labelSmall,
                        color = cardTextColor.copy(alpha = 0.7f)
                    )
                }

                Spacer(modifier = Modifier.height(2.dp))

                // Subject line + attachment indicator
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = thread.subject,
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = if (isUnread) FontWeight.Bold else FontWeight.Normal,
                        color = cardTextColor,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f)
                    )

                    // Attachment indicator
                    if (hasAttachments(latestMessage)) {
                        Spacer(modifier = Modifier.width(4.dp))
                        Icon(
                            imageVector = Icons.Default.AttachFile,
                            contentDescription = "Has attachments",
                            modifier = Modifier.size(14.dp),
                            tint = cardTextColor.copy(alpha = 0.7f)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(2.dp))

                // Preview snippet
                val snippet = latestMessage.note?.take(80) ?: latestMessage.emailBodyText?.take(80) ?: ""
                if (snippet.isNotBlank()) {
                    Text(
                        text = snippet.replace("\n", " "),
                        style = MaterialTheme.typography.bodySmall,
                        color = cardTextColor.copy(alpha = 0.7f),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                // Tag chips (non-system tags only)
                val nonSystemTags = latestMessage.tags?.filter { tag ->
                    tag !in listOf("Inbox", "Sent", "Trash", "Calendar", "Checklists",
                        "Alarms", "Projects", "Tasks", "Notes")
                }
                if (!nonSystemTags.isNullOrEmpty()) {
                    Spacer(modifier = Modifier.height(4.dp))
                    TagChipsRow(
                        tags = nonSystemTags,
                        maxTags = 3
                    )
                }
            }
        }
    }
}

// ─── Email Message Card (expanded thread) ─────────────────────────────────────

/**
 * Compact card for an individual message within an expanded thread.
 * Tap navigates to the editor. Reply/Forward buttons create new draft chits.
 */
@Composable
private fun EmailMessageCard(
    message: ChitEntity,
    onClick: () -> Unit,
    onReply: () -> Unit,
    onForward: () -> Unit
) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(8.dp),
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
        tonalElevation = 0.dp
    ) {
        Column(modifier = Modifier.padding(10.dp)) {
            Row(
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Unread dot for individual message
                if (message.emailRead != true) {
                    Box(
                        modifier = Modifier
                            .padding(end = 8.dp)
                            .size(6.dp)
                            .clip(CircleShape)
                            .background(Color(0xFF6B4E31))
                    )
                } else {
                    Spacer(modifier = Modifier.width(14.dp))
                }

                Column(modifier = Modifier.weight(1f)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = extractSenderName(message.emailFrom),
                            style = MaterialTheme.typography.bodySmall,
                            fontWeight = if (message.emailRead != true) FontWeight.Bold else FontWeight.Normal,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.weight(1f)
                        )
                        Text(
                            text = formatEmailDate(message.emailDate ?: message.createdDatetime),
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }

                    val snippet = message.note?.take(60) ?: message.emailBodyText?.take(60) ?: ""
                    if (snippet.isNotBlank()) {
                        Text(
                            text = snippet.replace("\n", " "),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }
            }

            // Reply / Forward action buttons
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 6.dp),
                horizontalArrangement = Arrangement.End,
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(
                    onClick = onReply,
                    modifier = Modifier.size(32.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Reply,
                        contentDescription = "Reply",
                        modifier = Modifier.size(18.dp),
                        tint = MaterialTheme.colorScheme.primary
                    )
                }
                Spacer(modifier = Modifier.width(4.dp))
                IconButton(
                    onClick = onForward,
                    modifier = Modifier.size(32.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Forward,
                        contentDescription = "Forward",
                        modifier = Modifier.size(18.dp),
                        tint = MaterialTheme.colorScheme.primary
                    )
                }
            }
        }
    }
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Extracts the display name from an email "From" field.
 * Handles formats like "John Doe <john@example.com>" → "John Doe"
 * or plain "john@example.com" → "john@example.com"
 */
private fun extractSenderName(emailFrom: String?): String {
    if (emailFrom.isNullOrBlank()) return "Unknown"
    val angleBracketIndex = emailFrom.indexOf('<')
    return if (angleBracketIndex > 0) {
        emailFrom.substring(0, angleBracketIndex).trim().trimEnd('"').trimStart('"')
    } else {
        emailFrom.trim()
    }
}

/**
 * Formats an email date string for display.
 * Shows time for today, date for older messages.
 */
private fun formatEmailDate(dateStr: String?): String {
    if (dateStr.isNullOrBlank()) return ""
    return try {
        // Try to parse ISO datetime and show a short format
        val date = dateStr.substringBefore("T")
        val time = dateStr.substringAfter("T", "").substringBefore("Z").substringBefore("+").take(5)
        val today = java.time.LocalDate.now().toString()
        if (date == today && time.isNotBlank()) {
            time // Show just time for today
        } else if (date.isNotBlank()) {
            // Show month/day for older
            val parts = date.split("-")
            if (parts.size == 3) "${parts[1]}/${parts[2]}" else date
        } else {
            dateStr.take(10)
        }
    } catch (_: Exception) {
        dateStr.take(10)
    }
}

/**
 * Checks if a message has attachments.
 * The attachments field is a JSON string — non-null and non-empty means attachments exist.
 */
private fun hasAttachments(message: ChitEntity): Boolean {
    val attachments = message.attachments
    return !attachments.isNullOrBlank() && attachments != "[]" && attachments != "null"
}
