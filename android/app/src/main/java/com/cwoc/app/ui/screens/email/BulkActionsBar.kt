package com.cwoc.app.ui.screens.email

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Archive
import androidx.compose.material.icons.filled.CheckBox
import androidx.compose.material.icons.filled.CheckBoxOutlineBlank
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Label
import androidx.compose.material.icons.filled.MarkEmailRead
import androidx.compose.material.icons.filled.MarkEmailUnread
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

// ─── Theme Colors ───────────────────────────────────────────────────────────────

private val DangerRed = Color(0xFFD32F2F)

/**
 * Bulk actions bar displayed as row 1 of the Bundle Toolbar.
 * Contains: Cycling select button (All → None → Read → Unread), action buttons
 * (Archive, Tag, Read/Unread, Delete), mode label indicator, and "N selected" count text.
 *
 * Validates: Requirements 2.5, 27.1-27.4, 28.1-28.5, 29.1-29.5, 30.1-30.5, 31.1-31.6
 */
@Composable
fun BulkActionsBar(
    selectedCount: Int,
    totalCount: Int,
    isMultiSelectMode: Boolean,
    onSelectAll: () -> Unit,
    onDeselectAll: () -> Unit,
    onCycleSelectMode: () -> Unit,
    selectModeLabel: String?,
    onArchive: () -> Unit,
    onTag: () -> Unit,
    onToggleRead: () -> Unit,
    onDelete: () -> Unit,
    modifier: Modifier = Modifier
) {
    val hasSelection = selectedCount > 0
    val allSelected = selectedCount == totalCount && totalCount > 0
    val buttonAlpha = if (hasSelection) 1f else 0.4f

    // Determine icon based on selection state
    val selectIcon = when {
        allSelected -> Icons.Filled.CheckBox
        hasSelection -> Icons.Filled.CheckBox // partial selection shows filled
        else -> Icons.Filled.CheckBoxOutlineBlank
    }

    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 8.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Start
    ) {
        // Cycling select button
        IconButton(
            onClick = onCycleSelectMode,
            modifier = Modifier.size(40.dp)
        ) {
            Icon(
                imageVector = selectIcon,
                contentDescription = "Cycle selection mode",
                modifier = Modifier.size(24.dp)
            )
        }

        // Mode label indicator (fades in/out)
        AnimatedVisibility(
            visible = selectModeLabel != null,
            enter = fadeIn(),
            exit = fadeOut()
        ) {
            Text(
                text = selectModeLabel ?: "",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f),
                modifier = Modifier.padding(start = 2.dp)
            )
        }

        // "N selected" text
        if (isMultiSelectMode && selectModeLabel == null) {
            Text(
                text = "$selectedCount selected",
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.padding(start = 4.dp)
            )
        }

        Spacer(modifier = Modifier.weight(1f))

        // Archive button
        IconButton(
            onClick = onArchive,
            enabled = hasSelection,
            modifier = Modifier.alpha(buttonAlpha)
        ) {
            Icon(
                imageVector = Icons.Filled.Archive,
                contentDescription = "Archive selected",
                modifier = Modifier.size(24.dp)
            )
        }

        // Tag button
        IconButton(
            onClick = onTag,
            enabled = hasSelection,
            modifier = Modifier.alpha(buttonAlpha)
        ) {
            Icon(
                imageVector = Icons.Filled.Label,
                contentDescription = "Tag selected",
                modifier = Modifier.size(24.dp)
            )
        }

        // Read/Unread toggle button
        IconButton(
            onClick = onToggleRead,
            enabled = hasSelection,
            modifier = Modifier.alpha(buttonAlpha)
        ) {
            Icon(
                imageVector = if (hasSelection) Icons.Filled.MarkEmailUnread else Icons.Filled.MarkEmailRead,
                contentDescription = "Toggle read/unread",
                modifier = Modifier.size(24.dp)
            )
        }

        // Delete button with danger styling
        IconButton(
            onClick = onDelete,
            enabled = hasSelection,
            modifier = Modifier.alpha(buttonAlpha)
        ) {
            Icon(
                imageVector = Icons.Filled.Delete,
                contentDescription = "Delete selected",
                tint = if (hasSelection) DangerRed else DangerRed.copy(alpha = 0.4f),
                modifier = Modifier.size(24.dp)
            )
        }
    }
}
