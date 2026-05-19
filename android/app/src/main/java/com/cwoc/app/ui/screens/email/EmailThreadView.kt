package com.cwoc.app.ui.screens.email

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Egg
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.cwoc.app.data.local.entity.ChitEntity
import com.cwoc.app.domain.email.EmailDateFormatter

// ─── Email Thread View — Nested Chit Cards ────────────────────────────────────

/**
 * Displays nested chit cards inline within an expanded email thread.
 *
 * Nested chits are non-email chits (emailMessageId == null, emailStatus == null)
 * with nestThreadId matching a thread message ID. They are displayed as compact
 * cards with a nest icon, title, content preview, and optional due date.
 *
 * The chits are expected to already be sorted by due_date ascending, then
 * start_datetime ascending (done in EmailViewModel.findNestedChits()).
 *
 * A nested chit is NEVER displayed as the topmost card of a collapsed thread —
 * that logic is handled by the caller (EmailScreen) which only renders this
 * composable inside the expanded thread section.
 *
 * @param nestedChits List of nested ChitEntity objects for this thread (pre-sorted)
 * @param onChitTap Callback when a nested chit card is tapped — navigates to chit editor
 * @param modifier Optional modifier for the container column
 */
@Composable
fun EmailThreadView(
    nestedChits: List<ChitEntity>,
    onChitTap: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    if (nestedChits.isEmpty()) return

    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(start = 8.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        nestedChits.forEach { chit ->
            NestedChitCard(
                chit = chit,
                onClick = { onChitTap(chit.id) }
            )
        }
    }
}

// ─── Nested Chit Card ─────────────────────────────────────────────────────────

/**
 * A compact card representing a non-email chit nested within an email thread.
 * Styled with indentation and a lighter background to distinguish from email cards.
 *
 * Displays:
 * - Nest icon (egg icon)
 * - Chit title
 * - Content preview (first ~100 chars of note, stripped of whitespace)
 * - Due date if present (formatted via EmailDateFormatter)
 */
@Composable
private fun NestedChitCard(
    chit: ChitEntity,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
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
                    .size(20.dp)
                    .padding(top = 2.dp),
                tint = MaterialTheme.colorScheme.primary.copy(alpha = 0.7f)
            )

            Spacer(modifier = Modifier.width(8.dp))

            // Content column: title, preview, due date
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

                // Content preview — first ~100 chars of note, stripped
                val preview = stripNotePreview(chit.note)
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
                val formattedDate = formatChitDate(chit.dueDatetime, chit.startDatetime)
                if (formattedDate.isNotBlank()) {
                    Text(
                        text = formattedDate,
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
 * Strips a chit note to a clean preview of ~100 characters.
 * Removes markdown syntax, collapses whitespace, and truncates.
 */
private fun stripNotePreview(note: String?): String {
    if (note.isNullOrBlank()) return ""

    val stripped = note
        .replace(Regex("#+\\s*"), "")           // Remove heading markers
        .replace(Regex("\\*\\*|__"), "")         // Remove bold markers
        .replace(Regex("[*_]"), "")              // Remove italic markers
        .replace(Regex("~~"), "")               // Remove strikethrough markers
        .replace(Regex("`{1,3}"), "")           // Remove code markers
        .replace(Regex("\\[([^]]*)]\\([^)]*\\)"), "$1") // [text](url) → text
        .replace(Regex("https?://\\S+"), "")    // Remove raw URLs
        .replace(Regex("\\s+"), " ")            // Collapse whitespace
        .trim()

    return if (stripped.length > 100) stripped.take(100) + "…" else stripped
}

/**
 * Formats a chit's date for display. Prefers due date, falls back to start date.
 * Uses EmailDateFormatter for consistent formatting.
 */
private fun formatChitDate(dueDatetime: String?, startDatetime: String?): String {
    val dateStr = dueDatetime ?: startDatetime ?: return ""
    val formatted = EmailDateFormatter.format(dateStr)
    if (formatted.isBlank()) return ""

    return if (dueDatetime != null) "Due: $formatted" else "Starts: $formatted"
}
