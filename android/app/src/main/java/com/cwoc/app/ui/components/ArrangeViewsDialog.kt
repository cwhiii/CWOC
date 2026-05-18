package com.cwoc.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Alarm
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Checklist
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Folder
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.Layers
import androidx.compose.material.icons.filled.Notes
import androidx.compose.material.icons.filled.ShowChart
import androidx.compose.material.icons.filled.Task
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontStyle
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
 * All available C CAPTN tab entries with their icons (excludes Omni which is always fixed first).
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
 * Default view order — matches the web's _defaultViewOrder.
 */
private val DEFAULT_VIEW_ORDER = listOf(
    "Calendar", "Checklists", "Tasks", "Projects", "Notes", "Email", "Indicators", "Alarms"
)

/**
 * Arrange Views bottom sheet dialog.
 * Allows users to reorder and toggle visibility of C CAPTN tabs.
 *
 * Features:
 * - Omni fixed as non-draggable first item in visible zone
 * - Visible tabs zone with up/down reorder buttons
 * - Hidden zone where tabs can be moved to hide them
 * - Cancel (reverts changes), Reset to Default (restores default order), Done (applies new order)
 *
 * Persists the order as a JSON array of {id, visible, position} objects
 * via the view_order settings field.
 *
 * Validates: Requirements 6.2, 6.3
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

    // Parse current view order into visible and hidden lists
    val visibleEntries = remember(currentViewOrder) {
        mutableStateListOf(*parseVisibleEntries(currentViewOrder).toTypedArray())
    }
    val hiddenEntries = remember(currentViewOrder) {
        mutableStateListOf(*parseHiddenEntries(currentViewOrder).toTypedArray())
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
                text = "📋 Arrange Views",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                color = CwocZoneHeaderBrown
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = "Reorder tabs on the dashboard. Move tabs to Hidden to remove them.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.height(16.dp))

            // --- Visible Tabs Zone ---
            Text(
                text = "Visible",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold,
                color = CwocZoneHeaderBrown,
                modifier = Modifier.padding(bottom = 8.dp)
            )

            LazyColumn(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f, fill = false)
            ) {
                // Omni — fixed, non-draggable first item
                item(key = "omni_fixed") {
                    OmniFixedRow()
                    HorizontalDivider(
                        modifier = Modifier.padding(start = 48.dp),
                        color = MaterialTheme.colorScheme.outlineVariant
                    )
                }

                // Draggable visible entries
                itemsIndexed(visibleEntries, key = { _, entry -> entry.id }) { index, entry ->
                    ArrangeViewRow(
                        entry = entry,
                        isFirst = index == 0,
                        isLast = index == visibleEntries.size - 1,
                        onMoveUp = {
                            if (index > 0) {
                                val item = visibleEntries.removeAt(index)
                                visibleEntries.add(index - 1, item)
                            }
                        },
                        onMoveDown = {
                            if (index < visibleEntries.size - 1) {
                                val item = visibleEntries.removeAt(index)
                                visibleEntries.add(index + 1, item)
                            }
                        },
                        onHide = {
                            val item = visibleEntries.removeAt(index)
                            hiddenEntries.add(item.copy(visible = false))
                        }
                    )
                    if (index < visibleEntries.size - 1) {
                        HorizontalDivider(
                            modifier = Modifier.padding(start = 48.dp),
                            color = MaterialTheme.colorScheme.outlineVariant
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // --- Hidden Zone ---
            Text(
                text = "Hidden",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(bottom = 8.dp)
            )

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .border(
                        width = 1.dp,
                        color = MaterialTheme.colorScheme.outlineVariant,
                        shape = RoundedCornerShape(8.dp)
                    )
                    .background(
                        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f),
                        shape = RoundedCornerShape(8.dp)
                    )
                    .padding(8.dp)
            ) {
                if (hiddenEntries.isEmpty()) {
                    // Placeholder when empty
                    Text(
                        text = "Drag tabs here to hide them",
                        style = MaterialTheme.typography.bodyMedium,
                        fontStyle = FontStyle.Italic,
                        color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f),
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 12.dp)
                            .align(Alignment.Center)
                    )
                } else {
                    Column(modifier = Modifier.fillMaxWidth()) {
                        hiddenEntries.forEachIndexed { index, entry ->
                            HiddenViewRow(
                                entry = entry,
                                onShow = {
                                    val item = hiddenEntries.removeAt(index)
                                    visibleEntries.add(item.copy(visible = true))
                                }
                            )
                            if (index < hiddenEntries.size - 1) {
                                HorizontalDivider(
                                    modifier = Modifier.padding(start = 48.dp),
                                    color = MaterialTheme.colorScheme.outlineVariant
                                )
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // --- Action Buttons: Cancel, Reset to Default, Done ---
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End
            ) {
                TextButton(onClick = onDismiss) {
                    Text("Cancel")
                }
                Spacer(modifier = Modifier.width(8.dp))
                TextButton(onClick = {
                    // Reset to default order
                    visibleEntries.clear()
                    hiddenEntries.clear()
                    DEFAULT_VIEW_ORDER.forEach { id ->
                        val template = ALL_TAB_ENTRIES.find { it.id == id }
                        if (template != null) {
                            visibleEntries.add(template.copy(visible = true))
                        }
                    }
                }) {
                    Text("↩️ Reset to Default")
                }
                Spacer(modifier = Modifier.width(8.dp))
                CwocPrimaryButton(onClick = {
                    onSave(serializeViewOrder(visibleEntries + hiddenEntries))
                    onDismiss()
                }) {
                    Text("Done")
                }
            }

            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}

/**
 * Fixed Omni row — always first, non-draggable.
 */
@Composable
private fun OmniFixedRow() {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Disabled up/down placeholders for alignment
        IconButton(onClick = {}, enabled = false) {
            Icon(
                imageVector = Icons.Default.KeyboardArrowUp,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.2f)
            )
        }
        IconButton(onClick = {}, enabled = false) {
            Icon(
                imageVector = Icons.Default.KeyboardArrowDown,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.2f)
            )
        }

        // Omni icon
        Icon(
            imageVector = Icons.Default.Layers,
            contentDescription = null,
            tint = CwocZoneHeaderBrown,
            modifier = Modifier.padding(horizontal = 8.dp)
        )

        // Omni label
        Text(
            text = "Omni",
            style = MaterialTheme.typography.bodyLarge,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurface,
            modifier = Modifier.weight(1f)
        )

        // Fixed indicator (no hide button)
        Text(
            text = "Fixed",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f),
            modifier = Modifier.padding(end = 12.dp)
        )
    }
}

/**
 * A single row in the visible zone of the Arrange Views list.
 * Has up/down reorder buttons and a hide button.
 */
@Composable
private fun ArrangeViewRow(
    entry: ViewTabEntry,
    isFirst: Boolean,
    isLast: Boolean,
    onMoveUp: () -> Unit,
    onMoveDown: () -> Unit,
    onHide: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Move up button
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
        // Move down button
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
            tint = CwocZoneHeaderBrown,
            modifier = Modifier.padding(horizontal = 8.dp)
        )

        // Tab name
        Text(
            text = entry.label,
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurface,
            modifier = Modifier.weight(1f)
        )

        // Hide button (move to hidden zone)
        IconButton(onClick = onHide) {
            Icon(
                imageVector = Icons.Default.VisibilityOff,
                contentDescription = "Hide ${entry.label}",
                tint = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

/**
 * A single row in the hidden zone. Has a show button to move back to visible.
 */
@Composable
private fun HiddenViewRow(
    entry: ViewTabEntry,
    onShow: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Tab icon (dimmed)
        Icon(
            imageVector = entry.icon,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.4f),
            modifier = Modifier.padding(start = 16.dp, end = 8.dp)
        )

        // Tab name (dimmed)
        Text(
            text = entry.label,
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f),
            modifier = Modifier.weight(1f)
        )

        // Show button (move back to visible zone)
        IconButton(onClick = onShow) {
            Icon(
                imageVector = Icons.Default.Visibility,
                contentDescription = "Show ${entry.label}",
                tint = CwocZoneHeaderBrown
            )
        }
    }
}

/**
 * Parses the view_order setting into a list of VISIBLE ViewTabEntry objects.
 * Supports both comma-separated format ("Calendar,Checklists,...") and
 * JSON array format ([{"id":"Calendar","visible":true,"position":0},...]).
 */
internal fun parseVisibleEntries(viewOrder: String): List<ViewTabEntry> {
    if (viewOrder.isBlank()) {
        return ALL_TAB_ENTRIES.map { it.copy(visible = true) }
    }

    // Try JSON array format first
    if (viewOrder.trimStart().startsWith("[")) {
        return try {
            val jsonArray = JSONArray(viewOrder)
            val result = mutableListOf<ViewTabEntry>()
            for (i in 0 until jsonArray.length()) {
                val element = jsonArray.get(i)
                if (element is JSONObject) {
                    val obj = element
                    val id = obj.getString("id")
                    val visible = obj.optBoolean("visible", true)
                    if (visible) {
                        val template = ALL_TAB_ENTRIES.find { it.id == id }
                        if (template != null) {
                            result.add(template.copy(visible = true))
                        }
                    }
                } else if (element is String) {
                    // Simple string array format: ["Calendar", "Checklists", ...]
                    val template = ALL_TAB_ENTRIES.find { it.id == element }
                    if (template != null) {
                        result.add(template.copy(visible = true))
                    }
                }
            }
            // If no visible entries found from JSON, return all as visible
            if (result.isEmpty()) ALL_TAB_ENTRIES.map { it.copy(visible = true) }
            else result
        } catch (_: Exception) {
            ALL_TAB_ENTRIES.map { it.copy(visible = true) }
        }
    }

    // Comma-separated format
    val ids = viewOrder.split(",").map { it.trim() }.filter { it.isNotEmpty() }
    val result = mutableListOf<ViewTabEntry>()
    for (id in ids) {
        val template = ALL_TAB_ENTRIES.find { it.id == id }
        if (template != null) {
            result.add(template.copy(visible = true))
        }
    }
    return if (result.isEmpty()) ALL_TAB_ENTRIES.map { it.copy(visible = true) } else result
}

/**
 * Parses the view_order setting into a list of HIDDEN ViewTabEntry objects.
 * Hidden entries are those in ALL_TAB_ENTRIES that are NOT in the visible set.
 */
internal fun parseHiddenEntries(viewOrder: String): List<ViewTabEntry> {
    if (viewOrder.isBlank()) {
        return emptyList()
    }

    // Try JSON array format first
    if (viewOrder.trimStart().startsWith("[")) {
        return try {
            val jsonArray = JSONArray(viewOrder)
            val result = mutableListOf<ViewTabEntry>()
            val visibleIds = mutableSetOf<String>()
            val hiddenIds = mutableListOf<String>()

            for (i in 0 until jsonArray.length()) {
                val element = jsonArray.get(i)
                if (element is JSONObject) {
                    val obj = element
                    val id = obj.getString("id")
                    val visible = obj.optBoolean("visible", true)
                    if (visible) {
                        visibleIds.add(id)
                    } else {
                        hiddenIds.add(id)
                    }
                } else if (element is String) {
                    // Simple string array: all listed are visible
                    visibleIds.add(element)
                }
            }

            // Explicitly hidden entries from JSON
            for (id in hiddenIds) {
                val template = ALL_TAB_ENTRIES.find { it.id == id }
                if (template != null) {
                    result.add(template.copy(visible = false))
                }
            }

            // Entries not mentioned at all are also hidden
            ALL_TAB_ENTRIES.filter { it.id !in visibleIds && it.id !in hiddenIds }.forEach {
                result.add(it.copy(visible = false))
            }

            result
        } catch (_: Exception) {
            emptyList()
        }
    }

    // Comma-separated format: anything not listed is hidden
    val ids = viewOrder.split(",").map { it.trim() }.filter { it.isNotEmpty() }.toSet()
    return ALL_TAB_ENTRIES.filter { it.id !in ids }.map { it.copy(visible = false) }
}

/**
 * Parses the view_order setting into a combined list of ViewTabEntry objects (visible + hidden).
 * Kept for backward compatibility with ViewsSettingsTab.
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
                val element = jsonArray.get(i)
                if (element is JSONObject) {
                    val obj = element
                    val id = obj.getString("id")
                    val visible = obj.optBoolean("visible", true)
                    val template = ALL_TAB_ENTRIES.find { it.id == id }
                    if (template != null) {
                        result.add(template.copy(visible = visible))
                    }
                } else if (element is String) {
                    val template = ALL_TAB_ENTRIES.find { it.id == element }
                    if (template != null) {
                        result.add(template.copy(visible = true))
                    }
                }
            }
            // Add any missing tabs at the end
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
