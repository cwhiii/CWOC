package com.cwoc.app.ui.screens.editor.zones

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

/**
 * Reusable collapsible zone header for the chit editor.
 *
 * Displays a title with an expand/collapse chevron icon and an optional
 * trailing content slot. The [content] composable is shown/hidden with
 * an animated expand/collapse transition using [AnimatedVisibility].
 *
 * Used by DateZone, ChecklistZone, ColorZone, AlertsZone, and RecurrenceZone.
 *
 * Validates: Requirements 3.1
 *
 * @param title The zone section title displayed in the header.
 * @param isExpanded Whether the zone content is currently visible.
 * @param onToggle Callback invoked when the header is tapped to toggle expand/collapse.
 * @param trailingContent Optional composable rendered at the trailing end of the header row.
 * @param content The zone body content, animated in/out based on [isExpanded].
 */
@Composable
fun EditorZoneHeader(
    title: String,
    isExpanded: Boolean,
    onToggle: () -> Unit,
    trailingContent: @Composable (() -> Unit)? = null,
    content: @Composable () -> Unit
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        // Header row — clickable to toggle expand/collapse
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable(onClick = onToggle)
                .padding(vertical = 12.dp, horizontal = 4.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Expand/collapse chevron icon
            Icon(
                imageVector = if (isExpanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                contentDescription = if (isExpanded) "Collapse $title" else "Expand $title",
                tint = MaterialTheme.colorScheme.primary
            )

            Spacer(modifier = Modifier.width(8.dp))

            // Zone title
            Text(
                text = title,
                style = MaterialTheme.typography.titleSmall,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.weight(1f)
            )

            // Optional trailing content (e.g., progress count, summary text)
            if (trailingContent != null) {
                trailingContent()
            }
        }

        // Animated zone body content
        AnimatedVisibility(
            visible = isExpanded,
            enter = expandVertically(),
            exit = shrinkVertically()
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(start = 32.dp, end = 4.dp, bottom = 8.dp)
            ) {
                content()
            }
        }
    }
}
