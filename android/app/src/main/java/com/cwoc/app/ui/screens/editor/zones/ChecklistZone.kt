package com.cwoc.app.ui.screens.editor.zones

import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.background
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
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowDownward
import androidx.compose.material.icons.filled.ArrowUpward
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.DragHandle
import androidx.compose.material.icons.filled.FormatIndentDecrease
import androidx.compose.material.icons.filled.FormatIndentIncrease
import androidx.compose.material.icons.filled.Send
import androidx.compose.material.icons.filled.Undo
import androidx.compose.material3.Checkbox
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SwipeToDismissBox
import androidx.compose.material3.SwipeToDismissBoxValue
import androidx.compose.material3.Text
import androidx.compose.material3.rememberSwipeToDismissBoxState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import com.cwoc.app.domain.checklist.ChecklistItem
import com.cwoc.app.domain.checklist.ChecklistOperations
import java.util.UUID

/**
 * ChecklistZone composable for the chit editor.
 *
 * Provides a collapsible zone with:
 * - Parse checklist JSON into ChecklistItem list using existing ChecklistOperations
 * - Render items as rows: checkbox + indented text + action buttons
 * - Progress count header ("3/7 complete")
 * - Add item text input at bottom
 * - Swipe-to-delete on items
 * - Move up/down buttons for reordering
 * - Indent/outdent buttons (+/-) on each row
 * - Undo support: maintain operation stack, expose undo callback
 * - Serialize back to JSON on every change
 *
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7
 *
 * @param checklistJson The raw JSON string representing the checklist (nullable)
 * @param onChecklistChange Callback invoked with the updated JSON string on every change
 * @param onUndo Callback exposed for external undo triggering (e.g., from toolbar)
 */
@Composable
fun ChecklistZone(
    checklistJson: String?,
    onChecklistChange: (String?) -> Unit,
    onUndo: () -> Unit = {}
) {
    var isExpanded by remember { mutableStateOf(true) }

    // Parse the checklist from JSON
    var items by remember(checklistJson) {
        mutableStateOf(ChecklistOperations.parseChecklist(checklistJson))
    }

    // Undo stack: stores previous states for undo support
    var undoStack by remember { mutableStateOf(listOf<List<ChecklistItem>>()) }

    // New item text input state
    var newItemText by remember { mutableStateOf("") }

    // Progress calculation
    val checkedCount = items.count { it.checked }
    val totalCount = items.size

    /**
     * Pushes the current state onto the undo stack and applies a new state.
     * Serializes the new state back to JSON and notifies the parent.
     */
    fun applyChange(newItems: List<ChecklistItem>) {
        undoStack = undoStack + listOf(items)
        items = newItems
        val json = if (newItems.isEmpty()) null else ChecklistOperations.serializeChecklist(newItems)
        onChecklistChange(json)
    }

    /**
     * Performs undo: pops the last state from the undo stack.
     */
    fun performUndo() {
        if (undoStack.isNotEmpty()) {
            val previousState = undoStack.last()
            undoStack = undoStack.dropLast(1)
            items = previousState
            val json = if (previousState.isEmpty()) null else ChecklistOperations.serializeChecklist(previousState)
            onChecklistChange(json)
        }
    }

    EditorZoneHeader(
        title = "Checklist",
        isExpanded = isExpanded,
        onToggle = { isExpanded = !isExpanded },
        trailingContent = {
            // Progress count in the header
            if (totalCount > 0) {
                Text(
                    text = "$checkedCount/$totalCount complete",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    ) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            // --- Undo button (shown when undo stack is non-empty) ---
            if (undoStack.isNotEmpty()) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End
                ) {
                    IconButton(
                        onClick = {
                            performUndo()
                            onUndo()
                        }
                    ) {
                        Icon(
                            imageVector = Icons.Default.Undo,
                            contentDescription = "Undo last checklist operation",
                            tint = MaterialTheme.colorScheme.primary
                        )
                    }
                }
            }

            // --- Checklist items ---
            if (items.isNotEmpty()) {
                // Separate unchecked and checked items (gap 27/35: completed section separator)
                val uncheckedItems = items.filter { !it.checked }
                val checkedItems = items.filter { it.checked }

                LazyColumn(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height((items.size * 64).coerceAtMost(400).dp)
                ) {
                    // Unchecked items first
                    itemsIndexed(
                        items = uncheckedItems,
                        key = { index, item -> item.id ?: "unchecked-$index" }
                    ) { _, item ->
                        val originalIndex = items.indexOf(item)
                        ChecklistItemRow(
                            item = item,
                            index = originalIndex,
                            totalItems = items.size,
                            onToggleChecked = {
                                val newItems = ChecklistOperations.toggleChecklistItem(items, originalIndex)
                                applyChange(newItems)
                            },
                            onMoveUp = {
                                if (originalIndex > 0) {
                                    val newItems = ChecklistOperations.reorderChecklistItem(items, originalIndex, originalIndex - 1)
                                    applyChange(newItems)
                                }
                            },
                            onMoveDown = {
                                if (originalIndex < items.size - 1) {
                                    val newItems = ChecklistOperations.reorderChecklistItem(items, originalIndex, originalIndex + 1)
                                    applyChange(newItems)
                                }
                            },
                            onIndent = {
                                val newItems = items.toMutableList().apply {
                                    this[originalIndex] = this[originalIndex].copy(indent = this[originalIndex].indent + 1)
                                }
                                applyChange(newItems)
                            },
                            onOutdent = {
                                val currentIndent = item.indent
                                if (currentIndent > 0) {
                                    val newItems = items.toMutableList().apply {
                                        this[originalIndex] = this[originalIndex].copy(indent = currentIndent - 1)
                                    }
                                    applyChange(newItems)
                                }
                            },
                            onDelete = {
                                val newItems = items.toMutableList().apply {
                                    removeAt(originalIndex)
                                }
                                applyChange(newItems)
                            }
                        )
                    }

                    // Completed section separator
                    if (checkedItems.isNotEmpty() && uncheckedItems.isNotEmpty()) {
                        item {
                            HorizontalDivider(
                                modifier = Modifier.padding(vertical = 8.dp),
                                color = MaterialTheme.colorScheme.outlineVariant
                            )
                            Text(
                                text = "Completed (${checkedItems.size})",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.padding(bottom = 4.dp)
                            )
                        }
                    }

                    // Checked items below separator
                    itemsIndexed(
                        items = checkedItems,
                        key = { index, item -> item.id ?: "checked-$index" }
                    ) { _, item ->
                        val originalIndex = items.indexOf(item)
                        ChecklistItemRow(
                            item = item,
                            index = originalIndex,
                            totalItems = items.size,
                            onToggleChecked = {
                                val newItems = ChecklistOperations.toggleChecklistItem(items, originalIndex)
                                applyChange(newItems)
                            },
                            onMoveUp = {
                                if (originalIndex > 0) {
                                    val newItems = ChecklistOperations.reorderChecklistItem(items, originalIndex, originalIndex - 1)
                                    applyChange(newItems)
                                }
                            },
                            onMoveDown = {
                                if (originalIndex < items.size - 1) {
                                    val newItems = ChecklistOperations.reorderChecklistItem(items, originalIndex, originalIndex + 1)
                                    applyChange(newItems)
                                }
                            },
                            onIndent = {
                                val newItems = items.toMutableList().apply {
                                    this[originalIndex] = this[originalIndex].copy(indent = this[originalIndex].indent + 1)
                                }
                                applyChange(newItems)
                            },
                            onOutdent = {
                                val currentIndent = item.indent
                                if (currentIndent > 0) {
                                    val newItems = items.toMutableList().apply {
                                        this[originalIndex] = this[originalIndex].copy(indent = currentIndent - 1)
                                    }
                                    applyChange(newItems)
                                }
                            },
                            onDelete = {
                                val newItems = items.toMutableList().apply {
                                    removeAt(originalIndex)
                                }
                                applyChange(newItems)
                            }
                        )
                    }
                }
            } else {
                // Empty state
                Text(
                    text = "No checklist items. Add one below.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(vertical = 8.dp)
                )
            }

            HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))

            // --- Add item input ---
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedTextField(
                    value = newItemText,
                    onValueChange = { newItemText = it },
                    modifier = Modifier.weight(1f),
                    singleLine = true,
                    placeholder = { Text("Add checklist item...") },
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                    keyboardActions = KeyboardActions(
                        onDone = {
                            if (newItemText.isNotBlank()) {
                                val newItem = ChecklistItem(
                                    text = newItemText.trim(),
                                    checked = false,
                                    indent = 0,
                                    id = UUID.randomUUID().toString()
                                )
                                val newItems = items + newItem
                                applyChange(newItems)
                                newItemText = ""
                            }
                        }
                    )
                )
                Spacer(modifier = Modifier.width(8.dp))
                IconButton(
                    onClick = {
                        if (newItemText.isNotBlank()) {
                            val newItem = ChecklistItem(
                                text = newItemText.trim(),
                                checked = false,
                                indent = 0,
                                id = UUID.randomUUID().toString()
                            )
                            val newItems = items + newItem
                            applyChange(newItems)
                            newItemText = ""
                        }
                    }
                ) {
                    Icon(
                        imageVector = Icons.Default.Add,
                        contentDescription = "Add checklist item",
                        tint = MaterialTheme.colorScheme.primary
                    )
                }
            }
        }
    }
}

// ─── Checklist Item Row ─────────────────────────────────────────────────────────

/**
 * A single checklist item row with:
 * - Indentation based on depth
 * - Checkbox for toggle
 * - Text (with strikethrough when checked)
 * - Move up/down buttons for reordering
 * - Indent/outdent buttons
 * - Swipe-to-delete support
 *
 * @param item The checklist item to render
 * @param index The item's position in the list
 * @param totalItems Total number of items (for disabling move buttons at boundaries)
 * @param onToggleChecked Callback when checkbox is toggled
 * @param onMoveUp Callback to move item up
 * @param onMoveDown Callback to move item down
 * @param onIndent Callback to increase indent
 * @param onOutdent Callback to decrease indent
 * @param onDelete Callback to delete the item
 */
@Composable
private fun ChecklistItemRow(
    item: ChecklistItem,
    index: Int,
    totalItems: Int,
    onToggleChecked: () -> Unit,
    onMoveUp: () -> Unit,
    onMoveDown: () -> Unit,
    onIndent: () -> Unit,
    onOutdent: () -> Unit,
    onDelete: () -> Unit,
    // K2/K3: Send item to another chit
    onSendToChit: (() -> Unit)? = null
) {
    val dismissState = rememberSwipeToDismissBoxState(
        confirmValueChange = { dismissValue ->
            if (dismissValue == SwipeToDismissBoxValue.EndToStart) {
                onDelete()
                true
            } else {
                false
            }
        }
    )

    SwipeToDismissBox(
        state = dismissState,
        backgroundContent = {
            // Red background shown when swiping to delete
            val color by animateColorAsState(
                targetValue = if (dismissState.targetValue == SwipeToDismissBoxValue.EndToStart) {
                    Color(0xFFFF6B6B)
                } else {
                    Color.Transparent
                },
                label = "swipe-bg"
            )
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(color)
                    .padding(horizontal = 16.dp),
                contentAlignment = Alignment.CenterEnd
            ) {
                if (dismissState.targetValue == SwipeToDismissBoxValue.EndToStart) {
                    Icon(
                        imageVector = Icons.Default.Delete,
                        contentDescription = "Delete",
                        tint = Color.White
                    )
                }
            }
        },
        enableDismissFromStartToEnd = false,
        enableDismissFromEndToStart = true
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(MaterialTheme.colorScheme.surface)
                .padding(
                    start = (ChecklistOperations.indentationDp(item.indent)).dp,
                    end = 0.dp,
                    top = 4.dp,
                    bottom = 4.dp
                ),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Checkbox
            Checkbox(
                checked = item.checked,
                onCheckedChange = { onToggleChecked() }
            )

            // Item text
            Text(
                text = item.text,
                style = MaterialTheme.typography.bodyMedium.copy(
                    textDecoration = if (item.checked) TextDecoration.LineThrough else TextDecoration.None
                ),
                color = if (item.checked) {
                    MaterialTheme.colorScheme.onSurfaceVariant
                } else {
                    MaterialTheme.colorScheme.onSurface
                },
                modifier = Modifier.weight(1f)
            )

            // Action buttons row
            // Indent/Outdent
            IconButton(
                onClick = onOutdent,
                enabled = item.indent > 0,
                modifier = Modifier.size(32.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.FormatIndentDecrease,
                    contentDescription = "Outdent",
                    modifier = Modifier.size(18.dp)
                )
            }
            IconButton(
                onClick = onIndent,
                modifier = Modifier.size(32.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.FormatIndentIncrease,
                    contentDescription = "Indent",
                    modifier = Modifier.size(18.dp)
                )
            }

            // K1: Drag handle for drag-drop reordering
            Icon(
                imageVector = Icons.Default.DragHandle,
                contentDescription = "Drag to reorder",
                modifier = Modifier.size(20.dp),
                tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
            )

            // K2/K3: Send to another chit
            if (onSendToChit != null) {
                IconButton(
                    onClick = onSendToChit,
                    modifier = Modifier.size(32.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Send,
                        contentDescription = "Send to another chit",
                        modifier = Modifier.size(16.dp)
                    )
                }
            }

            // Move up/down
            IconButton(
                onClick = onMoveUp,
                enabled = index > 0,
                modifier = Modifier.size(32.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.ArrowUpward,
                    contentDescription = "Move up",
                    modifier = Modifier.size(18.dp)
                )
            }
            IconButton(
                onClick = onMoveDown,
                enabled = index < totalItems - 1,
                modifier = Modifier.size(32.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.ArrowDownward,
                    contentDescription = "Move down",
                    modifier = Modifier.size(18.dp)
                )
            }
        }
    }
}
