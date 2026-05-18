package com.cwoc.app.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Alarm
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Checklist
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Folder
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.Notes
import androidx.compose.material.icons.filled.ShowChart
import androidx.compose.material.icons.filled.Task
import androidx.compose.material3.Checkbox
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.cwoc.app.ui.theme.CwocZoneHeaderBrown
import org.json.JSONArray
import org.json.JSONObject

/**
 * Data class representing a single view tab entry for arrangement.
 */
data class ViewTabEntry(
    val id: String,
    val label: String,
    val icon: ImageVector,
    val visible: Boolean = true
)

/**
 * All available C CAPTN tab entries with their icons.
 */
private val ALL_TAB_ENTRIES = listOf(
    ViewTabEntry("Calendar", "Calendar", Icons.Default.CalendarMonth),
    ViewTabEntry("Checklists", "Checklists", Icons.Default.Checklist),
    ViewTabEntry("Alarms", "Alerts", Icons.Default.Alarm),
    ViewTabEntry("Projects", "Projects", Icons.Default.Folder),
    ViewTabEntry("Tasks", "Tasks", Icons.Default.Task),
    ViewTabEntry("Notes", "Notes", Icons.Default.Notes),
    ViewTabEntry("Email", "Email", Icons.Default.Email),
    ViewTabEntry("Indicators", "Indicators", Icons.Default.ShowChart)
)

/**
 * Arrange Views bottom sheet dialog.
 * Allows users to reorder and toggle visibility of C CAPTN tabs.
 * Persists the order as a JSON array of {id, visible, position} objects
 * via the view_order settings field.
 *
 * Task 37: Arrange Views dialog for tab order.
 *
 * @param currentViewOrder The current view_order setting value (comma-separated or JSON).
 * @param onSave Callback with the new view_order value to persist.
 * @param onDismiss Callback when the sheet is dismissed.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ArrangeViewsDialog(
    currentViewOrder: String,
    onSave: (String) -> Unit,
    onDismiss: () -> Unit
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    // Parse current view order into mutable list
    val entries = remember(currentViewOrder) {
        mutableStateListOf(*parseViewOrder(currentViewOrder).toTypedArray())
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = MaterialTheme.colorScheme.surface
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp)
        ) {
            // Header
            Text(
                text = "Arrange Views",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                color = CwocZoneHeaderBrown
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = "Reorder tabs and toggle visibility",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.height(16.dp))

            // Tab entries list
            LazyColumn(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f, fill = false)
            ) {
                itemsIndexed(entries, key = { _, entry -> entry.id }) { index, entry ->
                    ArrangeViewRow(
                        entry = entry,
                        isFirst = index == 0,
                        isLast = index == entries.size - 1,
                        onMoveUp = {
                            if (index > 0) {
                                val item = entries.removeAt(index)
                                entries.add(index - 1, item)
                            }
                        },
                        onMoveDown = {
                            if (index < entries.size - 1) {
                                val item = entries.removeAt(index)
                                entries.add(index + 1, item)
                            }
                        },
                        onToggleVisibility = {
                            entries[index] = entry.copy(visible = !entry.visible)
                        }
                    )
                    if (index < entries.size - 1) {
                        HorizontalDivider(
                            modifier = Modifier.padding(start = 48.dp),
                            color = MaterialTheme.colorScheme.outlineVariant
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Save button
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End
            ) {
                androidx.compose.material3.TextButton(onClick = onDismiss) {
                    Text("Cancel")
                }
                Spacer(modifier = Modifier.width(8.dp))
                CwocPrimaryButton(onClick = {
                    onSave(serializeViewOrder(entries))
                    onDismiss()
                }) {
                    Text("Save")
                }
            }

            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}

/**
 * A single row in the Arrange Views list.
 */
@Composable
private fun ArrangeViewRow(
    entry: ViewTabEntry,
    isFirst: Boolean,
    isLast: Boolean,
    onMoveUp: () -> Unit,
    onMoveDown: () -> Unit,
    onToggleVisibility: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Move up/down buttons
        IconButton(
            onClick = onMoveUp,
            enabled = !isFirst
        ) {
            Icon(
                imageVector = Icons.Default.KeyboardArrowUp,
                contentDescription = "Move ${entry.label} up",
                tint = if (!isFirst) MaterialTheme.colorScheme.onSurface
                else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.3f)
            )
        }
        IconButton(
            onClick = onMoveDown,
            enabled = !isLast
        ) {
            Icon(
                imageVector = Icons.Default.KeyboardArrowDown,
                contentDescription = "Move ${entry.label} down",
                tint = if (!isLast) MaterialTheme.colorScheme.onSurface
                else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.3f)
            )
        }

        // Tab icon
        Icon(
            imageVector = entry.icon,
            contentDescription = null,
            tint = if (entry.visible) CwocZoneHeaderBrown
            else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.4f),
            modifier = Modifier.padding(horizontal = 8.dp)
        )

        // Tab name
        Text(
            text = entry.label,
            style = MaterialTheme.typography.bodyLarge,
            color = if (entry.visible) MaterialTheme.colorScheme.onSurface
            else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f),
            modifier = Modifier.weight(1f)
        )

        // Visibility checkbox
        Checkbox(
            checked = entry.visible,
            onCheckedChange = { onToggleVisibility() }
        )
    }
}

/**
 * Parses the view_order setting into a list of ViewTabEntry objects.
 * Supports both comma-separated format ("Calendar,Checklists,...") and
 * JSON array format ([{"id":"Calendar","visible":true,"position":0},...]).
 */
internal fun parseViewOrder(viewOrder: String): List<ViewTabEntry> {
    if (viewOrder.isBlank()) {
        return ALL_TAB_ENTRIES.toList()
    }

    // Try JSON array format first
    if (viewOrder.trimStart().startsWith("[")) {
        return try {
            val jsonArray = JSONArray(viewOrder)
            val result = mutableListOf<ViewTabEntry>()
            for (i in 0 until jsonArray.length()) {
                val obj = jsonArray.getJSONObject(i)
                val id = obj.getString("id")
                val visible = obj.optBoolean("visible", true)
                val template = ALL_TAB_ENTRIES.find { it.id == id }
                if (template != null) {
                    result.add(template.copy(visible = visible))
                }
            }
            // Add any missing tabs at the end (in case new tabs were added)
            val existingIds = result.map { it.id }.toSet()
            ALL_TAB_ENTRIES.filter { it.id !in existingIds }.forEach { result.add(it) }
            result
        } catch (_: Exception) {
            ALL_TAB_ENTRIES.toList()
        }
    }

    // Comma-separated format
    val ids = viewOrder.split(",").map { it.trim() }.filter { it.isNotEmpty() }
    val result = mutableListOf<ViewTabEntry>()
    for (id in ids) {
        val template = ALL_TAB_ENTRIES.find { it.id == id }
        if (template != null) {
            result.add(template)
        }
    }
    // Add any missing tabs at the end
    val existingIds = result.map { it.id }.toSet()
    ALL_TAB_ENTRIES.filter { it.id !in existingIds }.forEach { result.add(it) }
    return result
}

/**
 * Serializes the view order entries to a JSON array string for persistence.
 * Format: [{"id":"Calendar","visible":true,"position":0}, ...]
 */
internal fun serializeViewOrder(entries: List<ViewTabEntry>): String {
    val jsonArray = JSONArray()
    entries.forEachIndexed { index, entry ->
        val obj = JSONObject()
        obj.put("id", entry.id)
        obj.put("visible", entry.visible)
        obj.put("position", index)
        jsonArray.put(obj)
    }
    return jsonArray.toString()
}
