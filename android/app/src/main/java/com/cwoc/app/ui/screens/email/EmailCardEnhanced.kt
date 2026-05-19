package com.cwoc.app.ui.screens.email

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AttachFile
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.Reply
import androidx.compose.material.icons.outlined.BookmarkBorder
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.cwoc.app.domain.email.ContrastColor
import com.cwoc.app.ui.components.ContactAvatar
import com.cwoc.app.ui.components.CwocChitCardStyle
import com.cwoc.app.ui.components.parseHexColor
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken

/**
 * Enhanced email card composable for the email list view.
 *
 * Displays: circular contact avatar (image or initial), pin bookmark button,
 * status badges (Draft/Sent), reply indicator, body preview, tag chips with
 * colors (via ContrastColor), attachment thumbnails, smart link badges,
 * custom chit color background, thread ribbon bar and count badge.
 *
 * Handles multi-select mode: replaces avatar with checkbox on long-press.
 * Handles date formatting via EmailDateFormatter.
 *
 * Validates: Requirements 1.1-1.4, 2.1-2.4, 3.1-3.3, 4.1-4.4, 5.1-5.2,
 * 6.1-6.8, 7.1-7.4, 10.1-10.5, 11.1-11.4, 12.1-12.3, 17.1-17.4
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun EmailCardEnhanced(
    thread: EmailThread,
    isMultiSelectMode: Boolean,
    isSelected: Boolean,
    tagColorMap: Map<String, String> = emptyMap(),
    senderImageUrl: String? = null,
    serverUrl: String = "",
    authToken: String = "",
    onTap: () -> Unit,
    onLongPress: () -> Unit,
    onToggleSelection: () -> Unit,
    onTogglePin: () -> Unit
) {
    val latestMessage = thread.latestMessage
    val isUnread = thread.unreadCount > 0
    val hasMultipleMessages = thread.messages.size > 1

    // Resolve card background color from chit color
    val cardBgColor = remember(latestMessage.color) {
        CwocChitCardStyle.resolveChitBgColor(latestMessage.color)
    }
    val hasCustomColor = latestMessage.color != null &&
        latestMessage.color.isNotBlank() &&
        latestMessage.color != "transparent"

    // Compute contrast-safe text color for the card background
    val cardTextColor = remember(cardBgColor) {
        if (hasCustomColor) {
            ContrastColor.forBackground(cardBgColor)
        } else {
            CwocChitCardStyle.TextColor
        }
    }
    val secondaryTextColor = cardTextColor.copy(alpha = 0.7f)

    // Extract sender info
    val senderName = remember(latestMessage.emailFrom) {
        extractSenderDisplayName(latestMessage.emailFrom)
    }

    // Parse attachments
    val attachments = remember(latestMessage.attachments) {
        parseAttachments(latestMessage.attachments)
    }

    // Non-system tags for tag chips
    val nonSystemTags = remember(latestMessage.tags) {
        latestMessage.tags?.filter { tag ->
            tag !in SYSTEM_TAGS &&
                !tag.startsWith("CWOC_System/", ignoreCase = true)
        } ?: emptyList()
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .combinedClickable(
                onClick = {
                    if (isMultiSelectMode) {
                        onToggleSelection()
                    } else {
                        onTap()
                    }
                },
                onLongClick = onLongPress
            ),
        border = CwocChitCardStyle.cardBorder,
        colors = CardDefaults.cardColors(containerColor = cardBgColor),
        elevation = CwocChitCardStyle.cardElevation()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(IntrinsicSize.Min)
        ) {
            // Thread ribbon bar on left edge for multi-message threads
            if (hasMultipleMessages) {
                Box(
                    modifier = Modifier
                        .width(4.dp)
                        .fillMaxHeight()
                        .background(
                            color = cardTextColor.copy(alpha = 0.4f),
                            shape = RoundedCornerShape(topStart = 12.dp, bottomStart = 12.dp)
                        )
                )
            }

            Row(
                modifier = Modifier
                    .weight(1f)
                    .padding(12.dp),
                verticalAlignment = Alignment.Top
            ) {
                // Left column: Avatar or Checkbox
                if (isMultiSelectMode) {
                    // Multi-select mode: show checkbox
                    Checkbox(
                        checked = isSelected,
                        onCheckedChange = { onToggleSelection() },
                        modifier = Modifier.size(40.dp),
                        colors = CheckboxDefaults.colors(
                            checkedColor = MaterialTheme.colorScheme.primary,
                            uncheckedColor = secondaryTextColor
                        )
                    )
                } else {
                    // Normal mode: show circular contact avatar with image or initials
                    ContactAvatar(
                        imageUrl = senderImageUrl,
                        name = senderName,
                        size = 40.dp,
                        serverUrl = serverUrl,
                        authToken = authToken
                    )
                }

                Spacer(modifier = Modifier.width(12.dp))

                // Main content column
                Column(modifier = Modifier.weight(1f)) {
                    // Row 1: Status badges + Sender name + Thread count + Date + Pin
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        // Left side: badges + sender + thread count
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.weight(1f)
                        ) {
                            // Status badges (Draft/Sent)
                            val emailStatus = latestMessage.emailStatus
                            if (emailStatus == "draft") {
                                StatusBadge(
                                    text = "Draft",
                                    backgroundColor = Color(0xFFFFA000),
                                    textColor = Color.White
                                )
                                Spacer(modifier = Modifier.width(4.dp))
                            } else if (emailStatus == "sent") {
                                StatusBadge(
                                    text = "Sent",
                                    backgroundColor = Color(0xFF1976D2),
                                    textColor = Color.White
                                )
                                Spacer(modifier = Modifier.width(4.dp))
                            }

                            // Sender name
                            Text(
                                text = senderName,
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = if (isUnread) FontWeight.Bold else FontWeight.Normal,
                                color = cardTextColor,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                modifier = Modifier.weight(1f, fill = false)
                            )

                            // Thread count badge (inline after sender name)
                            if (hasMultipleMessages) {
                                Spacer(modifier = Modifier.width(4.dp))
                                ThreadCountBadge(
                                    count = thread.messages.size,
                                    textColor = secondaryTextColor
                                )
                            }

                            // Reply indicator
                            if (thread.hasReplyIndicator) {
                                Spacer(modifier = Modifier.width(4.dp))
                                Icon(
                                    imageVector = Icons.Default.Reply,
                                    contentDescription = "Replied",
                                    modifier = Modifier.size(14.dp),
                                    tint = secondaryTextColor
                                )
                            }
                        }

                        // Right side: Date + Pin button
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            // Formatted date
                            Text(
                                text = thread.formattedDate,
                                style = MaterialTheme.typography.labelSmall,
                                color = secondaryTextColor
                            )

                            // Pin bookmark button
                            IconButton(
                                onClick = onTogglePin,
                                modifier = Modifier.size(28.dp)
                            ) {
                                Icon(
                                    imageVector = if (thread.isPinned) {
                                        Icons.Filled.Bookmark
                                    } else {
                                        Icons.Outlined.BookmarkBorder
                                    },
                                    contentDescription = if (thread.isPinned) "Unpin" else "Pin",
                                    modifier = Modifier.size(16.dp),
                                    tint = if (thread.isPinned) {
                                        Color(0xFFD4A017) // Gold for pinned
                                    } else {
                                        secondaryTextColor
                                    }
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(2.dp))

                    // Row 2: Subject line
                    Text(
                        text = thread.subject,
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = if (isUnread) FontWeight.Bold else FontWeight.Normal,
                        color = cardTextColor,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )

                    Spacer(modifier = Modifier.height(2.dp))

                    // Row 3: Body preview (single line with ellipsis)
                    if (thread.bodyPreview.isNotBlank()) {
                        Text(
                            text = thread.bodyPreview,
                            style = MaterialTheme.typography.bodySmall,
                            color = secondaryTextColor,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                    }

                    // Row 4: Tag chips with colors (max 3 + overflow)
                    if (nonSystemTags.isNotEmpty()) {
                        EmailTagChipsRow(
                            tags = nonSystemTags,
                            tagColorMap = tagColorMap,
                            maxTags = 3,
                            cardTextColor = cardTextColor
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                    }

                    // Row 5: Attachment thumbnails
                    if (attachments.isNotEmpty()) {
                        AttachmentThumbnailsRow(
                            attachments = attachments,
                            textColor = secondaryTextColor
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                    }

                    // Row 6: Smart link badges
                    if (thread.smartLinks.isNotEmpty()) {
                        SmartLinkBadges(
                            smartLinks = thread.smartLinks
                        )
                    }
                }
            }
        }
    }
}

// ─── Status Badge ────────────────────────────────────────────────────────────────

/**
 * Inline status badge (Draft or Sent) displayed before the sender name.
 */
@Composable
private fun StatusBadge(
    text: String,
    backgroundColor: Color,
    textColor: Color
) {
    Surface(
        shape = RoundedCornerShape(4.dp),
        color = backgroundColor
    ) {
        Text(
            text = text,
            style = MaterialTheme.typography.labelSmall,
            color = textColor,
            fontWeight = FontWeight.Medium,
            modifier = Modifier.padding(horizontal = 4.dp, vertical = 1.dp),
            fontSize = 10.sp
        )
    }
}

// ─── Thread Count Badge ──────────────────────────────────────────────────────────

/**
 * Inline thread count badge displayed after the sender name.
 * Shows the total message count in the thread.
 */
@Composable
private fun ThreadCountBadge(
    count: Int,
    textColor: Color
) {
    Surface(
        shape = RoundedCornerShape(8.dp),
        color = textColor.copy(alpha = 0.15f)
    ) {
        Text(
            text = "$count",
            style = MaterialTheme.typography.labelSmall,
            color = textColor,
            fontWeight = FontWeight.Medium,
            modifier = Modifier.padding(horizontal = 5.dp, vertical = 1.dp),
            fontSize = 10.sp
        )
    }
}

// ─── Email Tag Chips Row ─────────────────────────────────────────────────────────

/**
 * Renders tag chips with colored backgrounds and contrast-safe text.
 * Shows max 3 non-system tags with a "+N" overflow indicator.
 * Uses ContrastColor for WCAG-compliant text color computation.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun EmailTagChipsRow(
    tags: List<String>,
    tagColorMap: Map<String, String>,
    maxTags: Int,
    cardTextColor: Color
) {
    FlowRow(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        verticalArrangement = Arrangement.spacedBy(2.dp)
    ) {
        val displayTags = if (tags.size > maxTags) tags.take(maxTags) else tags

        displayTags.forEach { tag ->
            val chipBgColor = remember(tag, tagColorMap[tag]) {
                val configuredHex = tagColorMap[tag]
                if (configuredHex != null) {
                    parseHexColor(configuredHex) ?: tagColorFromHash(tag)
                } else {
                    tagColorFromHash(tag)
                }
            }
            val chipTextColor = remember(chipBgColor) {
                ContrastColor.forBackground(chipBgColor)
            }

            Surface(
                shape = RoundedCornerShape(10.dp),
                color = chipBgColor.copy(alpha = 0.85f)
            ) {
                Text(
                    text = tag,
                    style = MaterialTheme.typography.labelSmall,
                    color = chipTextColor,
                    fontWeight = FontWeight.Medium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                )
            }
        }

        // "+N" overflow indicator
        if (tags.size > maxTags) {
            Text(
                text = "+${tags.size - maxTags}",
                style = MaterialTheme.typography.labelSmall,
                color = cardTextColor.copy(alpha = 0.7f),
                modifier = Modifier.padding(start = 2.dp)
            )
        }
    }
}

// ─── Attachment Thumbnails Row ───────────────────────────────────────────────────

/**
 * Displays attachment thumbnails/icons inline on the email card.
 * Image attachments show a small image icon; non-image show file type icon + filename.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun AttachmentThumbnailsRow(
    attachments: List<AttachmentInfo>,
    textColor: Color
) {
    FlowRow(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        attachments.take(4).forEach { attachment ->
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .background(
                        color = textColor.copy(alpha = 0.08f),
                        shape = RoundedCornerShape(4.dp)
                    )
                    .padding(horizontal = 6.dp, vertical = 3.dp)
            ) {
                Icon(
                    imageVector = if (attachment.isImage) Icons.Default.Image else Icons.Default.AttachFile,
                    contentDescription = attachment.filename,
                    modifier = Modifier.size(12.dp),
                    tint = textColor
                )
                Spacer(modifier = Modifier.width(3.dp))
                Text(
                    text = attachment.filename,
                    style = MaterialTheme.typography.labelSmall,
                    color = textColor,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    fontSize = 10.sp
                )
            }
        }
        if (attachments.size > 4) {
            Text(
                text = "+${attachments.size - 4}",
                style = MaterialTheme.typography.labelSmall,
                color = textColor
            )
        }
    }
}

// ─── Data Classes ────────────────────────────────────────────────────────────────

/**
 * Parsed attachment info from the JSON attachments field.
 */
private data class AttachmentInfo(
    val filename: String,
    val contentType: String?,
    val size: Long?,
    val url: String?
) {
    val isImage: Boolean
        get() = contentType?.startsWith("image/") == true ||
            filename.lowercase().let {
                it.endsWith(".jpg") || it.endsWith(".jpeg") || it.endsWith(".png") ||
                    it.endsWith(".gif") || it.endsWith(".webp") || it.endsWith(".bmp")
            }
}

// ─── Helper Functions ────────────────────────────────────────────────────────────

/** System tags that should not be displayed as tag chips. */
private val SYSTEM_TAGS = setOf(
    "Inbox", "Sent", "Trash", "Drafts", "Scheduled",
    "Calendar", "Checklists", "Alarms", "Projects", "Tasks", "Notes"
)

/**
 * Extracts the display name from an email "From" field.
 * Handles formats like "John Doe <john@example.com>" → "John Doe"
 * or plain "john@example.com" → "john@example.com"
 */
private fun extractSenderDisplayName(emailFrom: String?): String {
    if (emailFrom.isNullOrBlank()) return "Unknown"
    val angleBracketIndex = emailFrom.indexOf('<')
    return if (angleBracketIndex > 0) {
        emailFrom.substring(0, angleBracketIndex).trim().trim('"', '\'', ' ')
    } else {
        emailFrom.trim()
    }
}

/**
 * Generates a deterministic tag chip color from the tag name hash.
 * Matches the palette used in ChitCardEnhancements.kt.
 */
private fun tagColorFromHash(tagName: String): Color {
    val colors = listOf(
        Color(0xFF8B5A2B), // Brown
        Color(0xFF4A6741), // Green
        Color(0xFF6B4E31), // Dark brown
        Color(0xFF1565C0), // Blue
        Color(0xFF9B59B6), // Purple
        Color(0xFFD2691E), // Chocolate
        Color(0xFF2E7D32), // Dark green
        Color(0xFF5C4A3A), // Muted brown
        Color(0xFF795548), // Brown 400
        Color(0xFF00695C)  // Teal
    )
    val index = (tagName.hashCode().and(0x7FFFFFFF)) % colors.size
    return colors[index]
}

/**
 * Parses the attachments JSON field into a list of AttachmentInfo objects.
 * The attachments field is a JSON array of objects with filename, content_type, size, url.
 */
private fun parseAttachments(attachmentsJson: String?): List<AttachmentInfo> {
    if (attachmentsJson.isNullOrBlank() || attachmentsJson == "[]" || attachmentsJson == "null") {
        return emptyList()
    }
    return try {
        val gson = Gson()
        val type = object : TypeToken<List<Map<String, Any?>>>() {}.type
        val parsed: List<Map<String, Any?>> = gson.fromJson(attachmentsJson, type)
        parsed.mapNotNull { map ->
            val filename = (map["filename"] as? String)
                ?: (map["name"] as? String)
                ?: return@mapNotNull null
            AttachmentInfo(
                filename = filename,
                contentType = map["content_type"] as? String ?: map["contentType"] as? String,
                size = (map["size"] as? Number)?.toLong(),
                url = map["url"] as? String
            )
        }
    } catch (_: Exception) {
        emptyList()
    }
}
