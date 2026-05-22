package com.cwoc.app.ui.screens.editor

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.BottomSheetDefaults
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SheetState
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.cwoc.app.data.local.entity.ChitEntity
import com.cwoc.app.ui.theme.CwocDialogDefaults
import com.cwoc.app.ui.theme.CwocPrimary
import com.cwoc.app.ui.theme.CwocInputDefaults

/**
 * A ModalBottomSheet that displays a searchable list of email chits for selecting
 * a nest thread target. The user can search by subject or sender, then tap a row
 * to select that email thread as the nest target.
 *
 * @param emailChits The list of email chits available for nesting (from ViewModel's emailChitsForNestPicker StateFlow)
 * @param isLoading Whether the email chits are still being loaded
 * @param onSelect Callback when a row is tapped — provides the chit ID and subject for the nest association
 * @param onDismiss Callback when the sheet is dismissed
 * @param sheetState The Material3 SheetState for controlling the bottom sheet
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NestThreadPickerSheet(
    emailChits: List<ChitEntity>,
    isLoading: Boolean = false,
    onSelect: (chitId: String, subject: String) -> Unit,
    onDismiss: () -> Unit,
    sheetState: SheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
) {
    var searchText by remember { mutableStateOf("") }

    val filteredChits = remember(emailChits, searchText) {
        if (searchText.isBlank()) {
            emailChits
        } else {
            val query = searchText.lowercase()
            emailChits.filter { chit ->
                val subject = (chit.emailSubject ?: chit.title ?: "").lowercase()
                val from = (chit.emailFrom ?: "").lowercase()
                subject.contains(query) || from.contains(query)
            }
        }
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = CwocDialogDefaults.containerColor,
        dragHandle = { BottomSheetDefaults.DragHandle(color = CwocPrimary) }
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp)
        ) {
            // ─── Header ──────────────────────────────────────────────────
            Text(
                text = "Select Email Thread",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(bottom = 12.dp)
            )

            // ─── Search Field ────────────────────────────────────────────
            OutlinedTextField(
                value = searchText,
                onValueChange = { searchText = it },
                modifier = Modifier.fillMaxWidth(),
                placeholder = { Text("Search by subject or sender…") },
                leadingIcon = {
                    Icon(
                        imageVector = Icons.Default.Search,
                        contentDescription = "Search"
                    )
                },
                singleLine = true,
                shape = RoundedCornerShape(12.dp),
                colors = CwocInputDefaults.outlinedColors()
            )

            Spacer(modifier = Modifier.height(12.dp))
            HorizontalDivider(color = Color(0xFF8B5A2B), thickness = 1.dp)
            Spacer(modifier = Modifier.height(8.dp))

            // ─── Content ─────────────────────────────────────────────────
            when {
                isLoading -> {
                    // Loading state
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(200.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator(modifier = Modifier.size(36.dp))
                    }
                }

                filteredChits.isEmpty() -> {
                    // Empty state
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(200.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "No email threads found",
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }

                else -> {
                    // Email chit list
                    LazyColumn(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(400.dp),
                        verticalArrangement = Arrangement.spacedBy(2.dp)
                    ) {
                        items(filteredChits, key = { it.id }) { chit ->
                            EmailChitRow(
                                chit = chit,
                                onClick = {
                                    val subject = chit.emailSubject ?: chit.title ?: "No subject"
                                    onSelect(chit.id, subject)
                                }
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}

/**
 * A single row in the email chit list within NestThreadPickerSheet.
 * Shows subject (bold), from (secondary), and date (tertiary).
 */
@Composable
private fun EmailChitRow(
    chit: ChitEntity,
    onClick: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 10.dp)
    ) {
        // Subject — bold, primary
        Text(
            text = chit.emailSubject ?: chit.title ?: "No subject",
            style = MaterialTheme.typography.bodyLarge,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurface,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )

        // From — secondary
        val fromText = chit.emailFrom ?: ""
        if (fromText.isNotEmpty()) {
            Text(
                text = fromText,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }

        // Date — tertiary
        val dateText = formatEmailDate(chit.emailDate)
        if (dateText.isNotEmpty()) {
            Text(
                text = dateText,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}

/**
 * Formats an ISO-style email date string for display.
 * Returns a user-friendly date string, or empty string if null/unparseable.
 */
private fun formatEmailDate(dateString: String?): String {
    if (dateString.isNullOrBlank()) return ""
    return try {
        // Parse ISO format and display in a readable format
        // The emailDate field is typically in ISO 8601 format (e.g., "2024-01-15T10:30:00Z")
        val cleaned = dateString.replace("T", " ").replace("Z", "")
        // Take just the date and time portion (YYYY-MM-DD HH:MM)
        if (cleaned.length >= 16) {
            cleaned.substring(0, 16)
        } else {
            cleaned
        }
    } catch (_: Exception) {
        dateString
    }
}
