package com.cwoc.app.ui.screens.email

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Egg
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.Forum
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.cwoc.app.data.local.entity.ChitEntity
import com.cwoc.app.domain.email.EmailDateFormatter

// ─── Email Thread View In Editor ──────────────────────────────────────────────

/**
 * Displays the full conversation thread within the email editor/viewer.
 *
 * This is different from EmailThreadView.kt (task 7.10) which shows nested chits
 * in the list view. This composable shows the full thread conversation below the
 * email body in the editor, including all messages and nested chits interspersed.
 *
 * Layout behavior:
 * - Section header: "Thread (N messages)" with expand/collapse toggle
 * - ≤3 messages: show all in a simple Column
 * - >3 messages: show first and last message, with "N more messages" collapsed
 *   in between, plus an Expand button
 * - Expanded: LazyColumn with maxHeight = 60% of screen height
 * - Each message row: sender name, formatted date, 100-char body preview
 * - Current message: highlighted background
 * - Nested chits: interspersed between messages
 *
 * @param currentMessageId The emailMessageId of the message currently being viewed/edited
 * @param threadMessages All email messages in this thread (ChitEntity with emailMessageId != null)
 * @param nestedChits Non-email chits in this thread (nestThreadId matches a thread message)
 * @param onNavigateToMessage Callback when user taps another message — navigates to that email's editor
 * @param modifier Optional modifier
 */
@Composable
fun EmailThreadViewInEditor(
    currentMessageId: String?,
    threadMessages: List<ChitEntity>,
    nestedChits: List<ChitEntity>,
    onNavigateToMessage: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    // Don't show thread section if there's only 1 or fewer messages
    if (threadMessages.size <= 1) return

    var isExpanded by remember { mutableStateOf(false) }
    val totalMessageCount = threadMessages.size
    val screenHeight = LocalConfiguration.current.screenHeightDp.dp

    // Merge messages and nested chits into a sorted display list
    val displayItems = remember(threadMessages, nestedChits) {
        buildThreadDisplayItems(threadMessages, nestedChits)
    }

    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp)
    ) {
        HorizontalDivider(modifier = Modifier.padding(bottom = 8.dp))

        // Section header: "Thread (N messages)" with expand/collapse
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable { isExpanded = !isExpanded }
                .padding(horizontal = 4.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Default.Forum,
                    contentDescription = null,
                    modifier = Modifier.size(20.dp),
                    tint = MaterialTheme.colorScheme.primary
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "Thread ($totalMessageCount messages)",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold
                )
            }

            Icon(
                imageVector = if (isExpanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                contentDescription = if (isExpanded) "Collapse thread" else "Expand thread",
                modifier = Modifier.size(24.dp),
                tint = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        Spacer(modifier = Modifier.height(8.dp))

        // Thread content
        if (totalMessageCount <= 3) {
            // Simple list for ≤3 messages — always show all
            SimpleThreadList(
                displayItems = displayItems,
                currentMessageId = currentMessageId,
                onNavigateToMessage = onNavigateToMessage
            )
        } else {
            // Stacked/collapsed view for >3 messages
            AnimatedVisibility(
                visible = !isExpanded,
                enter = expandVertically(),
                exit = shrinkVertically()
            ) {
                CollapsedThreadView(
                    threadMessages = threadMessages,
                    currentMessageId = currentMessageId,
                    onNavigateToMessage = onNavigateToMessage,
                    onExpand = { isExpanded = true }
                )
            }

            AnimatedVisibility(
                visible = isExpanded,
                enter = expandVertically(),
                exit = shrinkVertically()
            ) {
                // Expanded: full scrollable list (max 60% viewport height)
                LazyColumn(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(max = screenHeight * 0.6f)
                        .clip(RoundedCornerShape(8.dp))
                        .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.1f)),
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    items(
                        items = displayItems,
                        key = { it.id }
                    ) { item ->
                        when (item) {
                            is ThreadDisplayItem.Message -> {
                                ThreadMessageRow(
                                    chit = item.chit,
                                    isCurrentMessage = item.chit.emailMessageId == currentMessageId,
                                    onClick = { onNavigateToMessage(item.chit.id) }
                                )
                            }
                            is ThreadDisplayItem.NestedChit -> {
                                ThreadNestedChitRow(
                                    chit = item.chit,
                                    onClick = { onNavigateToMessage(item.chit.id) }
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

// ─── Display Item Model ───────────────────────────────────────────────────────

/**
 * Sealed class representing items in the thread display list.
 * Messages and nested chits are interspersed based on their dates.
 */
private sealed class ThreadDisplayItem {
    abstract val id: String
    abstract val sortDate: String?

    data class Message(val chit: ChitEntity) : ThreadDisplayItem() {
        override val id: String = chit.id
        override val sortDate: String? = chit.emailDate
    }

    data class NestedChit(val chit: ChitEntity) : ThreadDisplayItem() {
        override val id: String = chit.id
        override val sortDate: String? = chit.dueDatetime ?: chit.startDatetime ?: chit.createdDatetime
    }
}

// ─── Build Display Items ──────────────────────────────────────────────────────

/**
 * Merges thread messages and nested chits into a single sorted list.
 * Messages are sorted by emailDate ascending (oldest first for conversation flow).
 * Nested chits are interspersed based on their date relative to messages.
 */
private fun buildThreadDisplayItems(
    messages: List<ChitEntity>,
    nestedChits: List<ChitEntity>
): List<ThreadDisplayItem> {
    val messageItems = messages.map { ThreadDisplayItem.Message(it) }
    val chitItems = nestedChits.map { ThreadDisplayItem.NestedChit(it) }

    return (messageItems + chitItems).sortedBy { it.sortDate ?: "" }
}

// ─── Simple Thread List (≤3 messages) ─────────────────────────────────────────

@Composable
private fun SimpleThreadList(
    displayItems: List<ThreadDisplayItem>,
    currentMessageId: String?,
    onNavigateToMessage: (String) -> Unit
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        displayItems.forEach { item ->
            when (item) {
                is ThreadDisplayItem.Message -> {
                    ThreadMessageRow(
                        chit = item.chit,
                        isCurrentMessage = item.chit.emailMessageId == currentMessageId,
                        onClick = { onNavigateToMessage(item.chit.id) }
                    )
                }
                is ThreadDisplayItem.NestedChit -> {
                    ThreadNestedChitRow(
                        chit = item.chit,
                        onClick = { onNavigateToMessage(item.chit.id) }
                    )
                }
            }
        }
    }
}

// ─── Collapsed Thread View (>3 messages) ──────────────────────────────────────

/**
 * Shows first and last message with a collapsed "N more messages" indicator
 * and an Expand button in between.
 */
@Composable
private fun CollapsedThreadView(
    threadMessages: List<ChitEntity>,
    currentMessageId: String?,
    onNavigateToMessage: (String) -> Unit,
    onExpand: () -> Unit
) {
    val sortedMessages = remember(threadMessages) {
        threadMessages.sortedBy { it.emailDate ?: "" }
    }
    val firstMessage = sortedMessages.first()
    val lastMessage = sortedMessages.last()
    val hiddenCount = sortedMessages.size - 2

    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        // First message
        ThreadMessageRow(
            chit = firstMessage,
            isCurrentMessage = firstMessage.emailMessageId == currentMessageId,
            onClick = { onNavigateToMessage(firstMessage.id) }
        )

        // Collapsed indicator with expand button
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(8.dp))
                .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f))
                .clickable(onClick = onExpand)
                .padding(horizontal = 12.dp, vertical = 10.dp),
            contentAlignment = Alignment.Center
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center
            ) {
                Text(
                    text = "$hiddenCount more messages",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.primary,
                    fontWeight = FontWeight.Medium
                )
                Spacer(modifier = Modifier.width(8.dp))
                TextButton(onClick = onExpand) {
                    Text("Expand")
                }
            }
        }

        // Last message
        ThreadMessageRow(
            chit = lastMessage,
            isCurrentMessage = lastMessage.emailMessageId == currentMessageId,
            onClick = { onNavigateToMessage(lastMessage.id) }
        )
    }
}

// ─── Thread Message Row ───────────────────────────────────────────────────────

/**
 * A single message row in the thread view.
 * Displays: sender name, formatted date, 100-char body preview.
 * Highlighted if it's the current message being viewed.
 */
@Composable
private fun ThreadMessageRow(
    chit: ChitEntity,
    isCurrentMessage: Boolean,
    onClick: () -> Unit
) {
    val highlightColor = if (isCurrentMessage) {
        MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.4f)
    } else {
        MaterialTheme.colorScheme.surface
    }

    val borderModifier = if (isCurrentMessage) {
        Modifier.border(
            width = 1.5.dp,
            color = MaterialTheme.colorScheme.primary.copy(alpha = 0.5f),
            shape = RoundedCornerShape(8.dp)
        )
    } else {
        Modifier
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .then(borderModifier)
            .clickable(enabled = !isCurrentMessage, onClick = onClick),
        shape = RoundedCornerShape(8.dp),
        colors = CardDefaults.cardColors(containerColor = highlightColor),
        elevation = CardDefaults.cardElevation(defaultElevation = if (isCurrentMessage) 2.dp else 0.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(10.dp),
            verticalArrangement = Arrangement.spacedBy(2.dp)
        ) {
            // Row 1: Sender name + date
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Sender name (extract display name from "Name <email>" format)
                Text(
                    text = extractSenderName(chit.emailFrom),
                    style = MaterialTheme.typography.bodySmall,
                    fontWeight = if (isCurrentMessage) FontWeight.Bold else FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f)
                )

                Spacer(modifier = Modifier.width(8.dp))

                // Formatted date
                Text(
                    text = EmailDateFormatter.format(chit.emailDate),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            // Row 2: Body preview (100 chars)
            val preview = truncateBodyPreview(chit.emailBodyText, maxChars = 100)
            if (preview.isNotBlank()) {
                Text(
                    text = preview,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
            }

            // Current message indicator label
            if (isCurrentMessage) {
                Text(
                    text = "Current",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.primary,
                    fontWeight = FontWeight.Medium
                )
            }
        }
    }
}

// ─── Thread Nested Chit Row ───────────────────────────────────────────────────

/**
 * A compact card for a nested chit (non-email) interspersed within the thread.
 * Shows nest icon, title, and content preview.
 */
@Composable
private fun ThreadNestedChitRow(
    chit: ChitEntity,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(start = 8.dp)
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(8.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f)
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(10.dp),
            verticalAlignment = Alignment.Top
        ) {
            // Nest icon
            Icon(
                imageVector = Icons.Default.Egg,
                contentDescription = "Nested chit",
                modifier = Modifier
                    .size(18.dp)
                    .padding(top = 2.dp),
                tint = MaterialTheme.colorScheme.primary.copy(alpha = 0.7f)
            )

            Spacer(modifier = Modifier.width(8.dp))

            // Content column
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(2.dp)
            ) {
                // Title
                Text(
                    text = chit.title ?: "Untitled",
                    style = MaterialTheme.typography.bodySmall,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )

                // Content preview
                val preview = truncateBodyPreview(chit.note, maxChars = 100)
                if (preview.isNotBlank()) {
                    Text(
                        text = preview,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                // Due date if present
                val dateStr = chit.dueDatetime ?: chit.startDatetime
                if (dateStr != null) {
                    val label = if (chit.dueDatetime != null) "Due" else "Starts"
                    Text(
                        text = "$label: ${EmailDateFormatter.format(dateStr)}",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.primary.copy(alpha = 0.8f)
                    )
                }
            }
        }
    }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extracts the display name from an email "From" field.
 * Handles formats like "John Doe <john@example.com>" → "John Doe"
 * or plain "john@example.com" → "john@example.com"
 */
private fun extractSenderName(from: String?): String {
    if (from.isNullOrBlank()) return "Unknown"

    val trimmed = from.trim()

    // Check for "Name <email>" format
    val angleBracketIndex = trimmed.indexOf('<')
    if (angleBracketIndex > 0) {
        val name = trimmed.substring(0, angleBracketIndex).trim()
        // Remove surrounding quotes if present
        return name.removeSurrounding("\"").removeSurrounding("'").ifBlank { trimmed }
    }

    return trimmed
}

/**
 * Truncates body text to a clean preview of the specified max characters.
 * Strips basic whitespace and collapses multiple spaces.
 */
private fun truncateBodyPreview(body: String?, maxChars: Int = 100): String {
    if (body.isNullOrBlank()) return ""

    val cleaned = body
        .replace(Regex("\\s+"), " ")
        .trim()

    return if (cleaned.length > maxChars) {
        cleaned.take(maxChars) + "…"
    } else {
        cleaned
    }
}
