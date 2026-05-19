package com.cwoc.app.ui.screens.editor.zones

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.cwoc.app.domain.checklist.ChecklistItemV2
import com.cwoc.app.domain.checklist.ChecklistOperationsV2
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * Auto-save state machine for the checklist zone.
 */
enum class AutoSaveState {
    IDLE,       // No pending changes
    PENDING,    // Changes made, waiting for debounce (2s)
    SAVING,     // PATCH in flight
    SAVED,      // Just saved (shows ✓ briefly)
    FAILED      // Save failed, fall back to manual
}

/**
 * State holder for the ChecklistZoneV2 composable.
 * Manages items, undo/redo, multi-select, inline editing, and auto-save.
 *
 * This is NOT a Hilt ViewModel — it's scoped to the zone's lifecycle within the editor
 * via remember {} in the composable.
 */
class ChecklistZoneViewModel(
    private val coroutineScope: CoroutineScope,
    private val onChecklistChange: (String?) -> Unit,
    private val onMarkUnsaved: () -> Unit = {},
    private val patchChecklist: (suspend (String, String) -> Result<Unit>)? = null
) {
    // ── Core State ───────────────────────────────────────────────────────────

    var items by mutableStateOf<List<ChecklistItemV2>>(emptyList())
        private set

    // ── Undo / Redo ──────────────────────────────────────────────────────────

    private val undoStack = mutableListOf<String>()
    private val redoStack = mutableListOf<String>()
    private val maxUndoSize = 50

    val canUndo: Boolean get() = undoStack.isNotEmpty()
    val canRedo: Boolean get() = redoStack.isNotEmpty()

    // ── Multi-Select ─────────────────────────────────────────────────────────

    var selectedIds by mutableStateOf<Set<String>>(emptySet())
        private set
    val isMultiSelectActive: Boolean get() = selectedIds.isNotEmpty()
    var lastSelectedId: String? = null
        private set

    // ── Inline Editing ───────────────────────────────────────────────────────

    var editingItemId by mutableStateOf<String?>(null)

    // ── Auto-Save ────────────────────────────────────────────────────────────

    var autoSaveState by mutableStateOf(AutoSaveState.IDLE)
        private set
    var autoSaveEnabled: Boolean = true
    var autoSaveChitOverride: Boolean? = null // null = use global
    var chitId: String? = null
    var isNewChit: Boolean = true

    private var autoSaveJob: Job? = null
    private var savedIndicatorJob: Job? = null

    // ── Add Item Input ───────────────────────────────────────────────────────

    var addItemInputText by mutableStateOf("")

    // ── Derived ──────────────────────────────────────────────────────────────

    val checkedCount: Int get() = items.count { it.checked }
    val totalCount: Int get() = items.size
    val uncheckedItems: List<ChecklistItemV2> get() = items.filter { !it.checked }
    val checkedItems: List<ChecklistItemV2> get() = items.filter { it.checked }

    // ── Load ─────────────────────────────────────────────────────────────────

    fun loadItems(json: String?) {
        items = ChecklistOperationsV2.parse(json)
        undoStack.clear()
        redoStack.clear()
    }

    // ── Undo / Redo Operations ───────────────────────────────────────────────

    private fun pushUndoState() {
        val snapshot = ChecklistOperationsV2.serialize(items)
        // Don't push if identical to last state
        if (undoStack.isNotEmpty() && undoStack.last() == snapshot) return
        undoStack.add(snapshot)
        if (undoStack.size > maxUndoSize) undoStack.removeAt(0)
        redoStack.clear()
    }

    fun undo() {
        if (undoStack.isEmpty()) return
        val current = ChecklistOperationsV2.serialize(items)
        redoStack.add(current)
        val prev = undoStack.removeLast()
        items = ChecklistOperationsV2.parse(prev)
        notifyChange()
    }

    fun redo() {
        if (redoStack.isEmpty()) return
        val current = ChecklistOperationsV2.serialize(items)
        undoStack.add(current)
        val next = redoStack.removeLast()
        items = ChecklistOperationsV2.parse(next)
        notifyChange()
    }

    // ── Apply Changes ────────────────────────────────────────────────────────

    /**
     * Apply a change with undo tracking. Pushes current state to undo stack,
     * updates items, triggers auto-save, and notifies parent.
     */
    fun applyChange(newItems: List<ChecklistItemV2>) {
        pushUndoState()
        items = newItems
        notifyChange()
        triggerAutoSave()
    }

    /**
     * Apply a change WITHOUT pushing to undo stack.
     * Used for per-keystroke text edits during inline editing.
     */
    fun applyChangeQuiet(newItems: List<ChecklistItemV2>) {
        items = newItems
        notifyChange()
        triggerAutoSave()
    }

    private fun notifyChange() {
        val json = if (items.isEmpty()) null else ChecklistOperationsV2.serialize(items)
        onChecklistChange(json)
    }

    // ── Item Operations ──────────────────────────────────────────────────────

    fun addItem(text: String) {
        if (text.isBlank()) return
        applyChange(ChecklistOperationsV2.addItem(items, text))
    }

    fun toggleCheck(itemId: String) {
        applyChange(ChecklistOperationsV2.toggleCheck(items, itemId))
    }

    fun deleteItem(itemId: String) {
        applyChange(ChecklistOperationsV2.deleteWithSubtree(items, itemId))
    }

    fun indentItem(itemId: String) {
        applyChange(ChecklistOperationsV2.indent(items, itemId))
    }

    fun outdentItem(itemId: String) {
        applyChange(ChecklistOperationsV2.outdent(items, itemId))
    }

    fun indentSubtree(itemId: String) {
        applyChange(ChecklistOperationsV2.indentSubtree(items, itemId))
    }

    fun outdentSubtree(itemId: String) {
        applyChange(ChecklistOperationsV2.outdentSubtree(items, itemId))
    }

    fun splitItem(itemId: String, cursorPos: Int): String {
        val (newItems, newItemId) = ChecklistOperationsV2.splitItem(items, itemId, cursorPos)
        applyChange(newItems)
        return newItemId
    }

    fun moveAbove(draggedId: String, targetId: String) {
        applyChange(ChecklistOperationsV2.moveAbove(items, draggedId, targetId))
    }

    fun moveBelow(draggedId: String, targetId: String) {
        applyChange(ChecklistOperationsV2.moveBelow(items, draggedId, targetId))
    }

    fun moveOnto(draggedId: String, targetId: String) {
        applyChange(ChecklistOperationsV2.moveOnto(items, draggedId, targetId))
    }

    fun updateItemText(itemId: String, newText: String) {
        val newItems = items.map { if (it.id == itemId) it.copy(text = newText) else it }
        applyChangeQuiet(newItems)
    }

    fun clearCheckedItems() {
        applyChange(items.filter { !it.checked })
    }

    fun clearUncheckedItems() {
        applyChange(items.filter { it.checked })
    }

    fun cleanUpEmptyItems() {
        val cleaned = items.filter { it.text.isNotBlank() }
        if (cleaned.size != items.size) {
            applyChange(cleaned)
        }
    }

    fun pasteItems(text: String) {
        val newItems = ChecklistOperationsV2.parseClipboardText(text)
        if (newItems.isNotEmpty()) {
            applyChange(items + newItems)
        }
    }

    // ── Multi-Select Operations ──────────────────────────────────────────────

    fun toggleSelectItem(itemId: String) {
        selectedIds = if (selectedIds.contains(itemId)) {
            selectedIds - itemId
        } else {
            selectedIds + itemId
        }
        lastSelectedId = itemId
    }

    fun rangeSelectTo(itemId: String) {
        val unchecked = items.filter { !it.checked }
        val anchor = lastSelectedId
        if (anchor == null) {
            selectedIds = selectedIds + itemId
            lastSelectedId = itemId
            return
        }

        val startIdx = unchecked.indexOfFirst { it.id == anchor }
        val endIdx = unchecked.indexOfFirst { it.id == itemId }
        if (startIdx < 0 || endIdx < 0) return

        val from = minOf(startIdx, endIdx)
        val to = maxOf(startIdx, endIdx)
        val rangeIds = unchecked.subList(from, to + 1).map { it.id }.toSet()
        selectedIds = selectedIds + rangeIds
    }

    fun selectAll() {
        selectedIds = items.filter { !it.checked }.map { it.id }.toSet()
    }

    fun clearSelection() {
        selectedIds = emptySet()
        lastSelectedId = null
    }

    fun checkSelected() {
        pushUndoState()
        val newItems = items.map { item ->
            if (item.id in selectedIds) {
                item.copy(checked = true)
            } else item
        }
        items = newItems
        clearSelection()
        notifyChange()
        triggerAutoSave()
    }

    fun deleteSelected() {
        pushUndoState()
        items = items.filter { it.id !in selectedIds }
        clearSelection()
        notifyChange()
        triggerAutoSave()
    }

    fun indentSelected() {
        pushUndoState()
        var current = items
        for (id in selectedIds) {
            current = ChecklistOperationsV2.indent(current, id)
        }
        items = current
        notifyChange()
        triggerAutoSave()
    }

    fun outdentSelected() {
        pushUndoState()
        var current = items
        for (id in selectedIds) {
            current = ChecklistOperationsV2.outdent(current, id)
        }
        items = current
        notifyChange()
        triggerAutoSave()
    }

    // ── Auto-Save ────────────────────────────────────────────────────────────

    private fun isAutoSaveActive(): Boolean {
        return when (autoSaveChitOverride) {
            true -> true
            false -> false
            null -> autoSaveEnabled
        }
    }

    private fun triggerAutoSave() {
        if (!isAutoSaveActive() || chitId == null || isNewChit) return

        autoSaveState = AutoSaveState.PENDING
        autoSaveJob?.cancel()
        autoSaveJob = coroutineScope.launch {
            delay(2000)
            autoSaveState = AutoSaveState.SAVING
            val json = ChecklistOperationsV2.serialize(items)
            val result = patchChecklist?.invoke(chitId!!, json)
            if (result?.isSuccess == true) {
                autoSaveState = AutoSaveState.SAVED
                savedIndicatorJob?.cancel()
                savedIndicatorJob = coroutineScope.launch {
                    delay(2000)
                    if (autoSaveState == AutoSaveState.SAVED) {
                        autoSaveState = AutoSaveState.IDLE
                    }
                }
            } else {
                autoSaveState = AutoSaveState.FAILED
                onMarkUnsaved()
            }
        }
    }

    fun toggleAutoSaveOverride() {
        autoSaveChitOverride = when (autoSaveChitOverride) {
            null -> !autoSaveEnabled // flip from global
            else -> null // back to global
        }
    }

    // ── Pending Content Detection ────────────────────────────────────────────

    fun hasPendingContent(): Boolean {
        return addItemInputText.isNotBlank() || editingItemId != null
    }

    fun commitPendingContent() {
        if (addItemInputText.isNotBlank()) {
            addItem(addItemInputText.trim())
            addItemInputText = ""
        }
        if (editingItemId != null) {
            // Text is already in model via applyChangeQuiet
            editingItemId = null
        }
    }

    // ── Note ↔ Checklist Conversion ──────────────────────────────────────────

    /**
     * Move all checklist items to note format. Returns the markdown string.
     * Clears the checklist.
     */
    fun moveChecklistToNote(): String {
        val markdown = ChecklistOperationsV2.itemsToMarkdown(items)
        applyChange(emptyList())
        return markdown
    }

    /**
     * Move note text into checklist items. Parses the text and appends to checklist.
     */
    fun moveNoteToChecklist(noteText: String) {
        val newItems = ChecklistOperationsV2.parseClipboardText(noteText)
        if (newItems.isNotEmpty()) {
            applyChange(items + newItems)
        }
    }

    // ── Copy Incomplete to Clipboard ─────────────────────────────────────────

    /**
     * Get all unchecked items formatted as markdown for clipboard.
     * Returns null if no unchecked items exist.
     */
    fun getIncompleteAsMarkdown(): String? {
        val unchecked = items.filter { !it.checked }
        if (unchecked.isEmpty()) return null
        return unchecked.joinToString("\n") { item ->
            "${"  ".repeat(item.level)}- [ ] ${item.text}"
        }
    }
}
