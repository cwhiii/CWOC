package com.cwoc.app.domain.checklist

import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import java.util.UUID

/**
 * V2 pure domain operations for checklist manipulation.
 * Supports full hierarchy (parent/child), subtree operations, and matches
 * the web's checklist behavior exactly.
 *
 * All functions are pure — they operate on immutable lists and return new lists.
 */
object ChecklistOperationsV2 {

    const val MAX_INDENT_LEVEL = 4
    const val INDENT_DP_PER_LEVEL = 20

    private val gson = Gson()

    // ── Parse & Serialize ────────────────────────────────────────────────────

    /**
     * Parse a JSON checklist string into a list of ChecklistItemV2.
     * Handles both legacy format (indent field) and V2 format (level + parent fields).
     * Generates UUIDs for items missing IDs. Caps level at MAX_INDENT_LEVEL.
     */
    fun parse(json: String?): List<ChecklistItemV2> {
        if (json.isNullOrBlank() || json == "[]" || json == "null") return emptyList()

        return try {
            val type = object : TypeToken<List<Map<String, Any>>>() {}.type
            val rawItems: List<Map<String, Any>> = gson.fromJson(json, type)

            rawItems.map { raw ->
                ChecklistItemV2(
                    id = (raw["id"] as? String) ?: UUID.randomUUID().toString(),
                    text = (raw["text"] as? String) ?: (raw["label"] as? String) ?: "",
                    level = ((raw["level"] as? Double)?.toInt()
                        ?: (raw["indent"] as? Double)?.toInt()
                        ?: 0).coerceIn(0, MAX_INDENT_LEVEL),
                    checked = (raw["checked"] as? Boolean) ?: (raw["done"] as? Boolean) ?: false,
                    parent = raw["parent"] as? String
                )
            }
        } catch (_: Exception) {
            emptyList()
        }
    }

    /**
     * Serialize items to JSON matching the web's format: {id, text, level, checked, parent}.
     */
    fun serialize(items: List<ChecklistItemV2>): String {
        val rawItems = items.map { item ->
            buildMap {
                put("id", item.id)
                put("text", item.text)
                put("level", item.level)
                put("checked", item.checked)
                if (item.parent != null) put("parent", item.parent)
            }
        }
        return gson.toJson(rawItems)
    }

    // ── Hierarchy Queries ────────────────────────────────────────────────────

    /**
     * Get an item and all its descendants (children, grandchildren, etc.).
     * Returns items in list order.
     */
    fun getSubtree(items: List<ChecklistItemV2>, itemId: String): List<ChecklistItemV2> {
        val item = items.find { it.id == itemId } ?: return emptyList()
        val result = mutableListOf(item)
        val children = getChildren(items, itemId)
        for (child in children) {
            result.addAll(getSubtree(items, child.id))
        }
        return result
    }

    /**
     * Get direct children of an item (items whose parent == itemId).
     */
    fun getChildren(items: List<ChecklistItemV2>, itemId: String): List<ChecklistItemV2> {
        return items.filter { it.parent == itemId }
    }

    /**
     * Get the parent of an item, or null if top-level.
     */
    fun getParent(items: List<ChecklistItemV2>, item: ChecklistItemV2): ChecklistItemV2? {
        if (item.parent == null) return null
        return items.find { it.id == item.parent }
    }

    // ── Indent / Outdent ─────────────────────────────────────────────────────

    /**
     * Indent a single item one level. Sets parent to nearest preceding item at (newLevel - 1).
     * Returns unchanged list if indent is invalid (already at max, or no valid parent).
     */
    fun indent(items: List<ChecklistItemV2>, itemId: String): List<ChecklistItemV2> {
        val idx = items.indexOfFirst { it.id == itemId }
        if (idx < 0) return items
        val item = items[idx]
        if (item.level >= MAX_INDENT_LEVEL) return items
        if (idx == 0) return items // Can't indent first item (no preceding item)

        val prevLevel = items[idx - 1].level
        if (item.level > prevLevel) return items // Can't indent deeper than prev + 1

        val newLevel = item.level + 1
        val newParent = findParentForLevel(items, idx, newLevel)

        return items.toMutableList().apply {
            this[idx] = item.copy(level = newLevel, parent = newParent)
        }
    }

    /**
     * Indent an item and its entire subtree one level.
     */
    fun indentSubtree(items: List<ChecklistItemV2>, itemId: String): List<ChecklistItemV2> {
        val idx = items.indexOfFirst { it.id == itemId }
        if (idx < 0) return items
        val item = items[idx]
        if (item.level >= MAX_INDENT_LEVEL) return items
        if (idx == 0) return items

        val prevLevel = items[idx - 1].level
        if (item.level > prevLevel) return items

        val subtree = getSubtree(items, itemId)
        val subtreeIds = subtree.map { it.id }.toSet()
        val newParent = findParentForLevel(items, idx, item.level + 1)

        return items.map { i ->
            if (i.id in subtreeIds) {
                val newLevel = (i.level + 1).coerceAtMost(MAX_INDENT_LEVEL)
                if (i.id == itemId) {
                    i.copy(level = newLevel, parent = newParent)
                } else {
                    i.copy(level = newLevel)
                }
            } else i
        }
    }

    /**
     * Outdent a single item one level. Reassigns following siblings to the outdented item.
     */
    fun outdent(items: List<ChecklistItemV2>, itemId: String): List<ChecklistItemV2> {
        val idx = items.indexOfFirst { it.id == itemId }
        if (idx < 0) return items
        val item = items[idx]
        if (item.level <= 0) return items

        val oldParentId = item.parent
        val newLevel = item.level - 1
        val newParent = findParentForLevel(items, idx, newLevel)

        val result = items.toMutableList()
        result[idx] = item.copy(level = newLevel, parent = newParent)

        // Reassign following former siblings to the promoted item
        if (oldParentId != null) {
            for (i in (idx + 1) until result.size) {
                val sibling = result[i]
                if (sibling.level <= item.level - 1) break // Left the region
                if (sibling.parent == oldParentId && sibling.level == newLevel + 1) {
                    result[i] = sibling.copy(parent = itemId)
                }
            }
        }

        return result
    }

    /**
     * Outdent an item and its entire subtree one level.
     */
    fun outdentSubtree(items: List<ChecklistItemV2>, itemId: String): List<ChecklistItemV2> {
        val idx = items.indexOfFirst { it.id == itemId }
        if (idx < 0) return items
        val item = items[idx]
        if (item.level <= 0) return items

        val oldParentId = item.parent
        val subtree = getSubtree(items, itemId)
        val subtreeIds = subtree.map { it.id }.toSet()
        val newParent = findParentForLevel(items, idx, item.level - 1)

        val result = items.map { i ->
            if (i.id in subtreeIds) {
                val newLevel = (i.level - 1).coerceAtLeast(0)
                if (i.id == itemId) {
                    i.copy(level = newLevel, parent = newParent)
                } else {
                    i.copy(level = newLevel)
                }
            } else i
        }.toMutableList()

        // Reassign following former siblings
        if (oldParentId != null) {
            val newIdx = result.indexOfFirst { it.id == itemId }
            for (i in (newIdx + 1) until result.size) {
                val sibling = result[i]
                if (sibling.level <= result[newIdx].level) break
                if (sibling.parent == oldParentId && sibling.level == result[newIdx].level + 1) {
                    result[i] = sibling.copy(parent = itemId)
                }
            }
        }

        return result
    }

    /**
     * Find the nearest preceding item at (targetLevel - 1) to serve as parent.
     */
    private fun findParentForLevel(items: List<ChecklistItemV2>, idx: Int, targetLevel: Int): String? {
        if (targetLevel <= 0) return null
        for (i in (idx - 1) downTo 0) {
            if (items[i].level == targetLevel - 1) return items[i].id
        }
        return null
    }

    // ── Check / Delete ───────────────────────────────────────────────────────

    /**
     * Toggle an item's checked state and cascade to all descendants.
     */
    fun toggleCheck(items: List<ChecklistItemV2>, itemId: String): List<ChecklistItemV2> {
        val item = items.find { it.id == itemId } ?: return items
        val newChecked = !item.checked
        val subtreeIds = getSubtree(items, itemId).map { it.id }.toSet()

        return items.map { i ->
            if (i.id in subtreeIds) i.copy(checked = newChecked) else i
        }
    }

    /**
     * Delete an item and all its descendants.
     */
    fun deleteWithSubtree(items: List<ChecklistItemV2>, itemId: String): List<ChecklistItemV2> {
        val subtreeIds = getSubtree(items, itemId).map { it.id }.toSet()
        return items.filter { it.id !in subtreeIds }
    }

    // ── Split Item ───────────────────────────────────────────────────────────

    /**
     * Split an item at the cursor position. Text before cursor stays in the current item,
     * text after cursor becomes a new item inserted below (after all children).
     * Returns (newItems, newItemId).
     */
    fun splitItem(
        items: List<ChecklistItemV2>,
        itemId: String,
        cursorPos: Int
    ): Pair<List<ChecklistItemV2>, String> {
        val idx = items.indexOfFirst { it.id == itemId }
        if (idx < 0) return Pair(items, "")

        val item = items[idx]
        val textBefore = item.text.substring(0, cursorPos.coerceIn(0, item.text.length)).trim()
        val textAfter = item.text.substring(cursorPos.coerceIn(0, item.text.length)).trim()

        val newItemId = UUID.randomUUID().toString()
        val newItem = ChecklistItemV2(
            id = newItemId,
            text = textAfter,
            level = item.level,
            checked = false,
            parent = item.parent
        )

        // Find insert position: after item and all its children
        var insertIdx = idx + 1
        while (insertIdx < items.size && items[insertIdx].level > item.level) {
            insertIdx++
        }

        val result = items.toMutableList()
        result[idx] = item.copy(text = textBefore)
        result.add(insertIdx, newItem)

        return Pair(result, newItemId)
    }

    // ── Drag & Drop (Move Operations) ────────────────────────────────────────

    /**
     * Move a subtree to insert ABOVE the target item, at the target's level.
     */
    fun moveAbove(
        items: List<ChecklistItemV2>,
        draggedId: String,
        targetId: String
    ): List<ChecklistItemV2> {
        val subtree = getSubtree(items, draggedId)
        if (subtree.isEmpty()) return items
        if (subtree.any { it.id == targetId }) return items // Can't drop onto self

        val target = items.find { it.id == targetId } ?: return items
        val subtreeIds = subtree.map { it.id }.toSet()

        // Remove subtree from list
        val remaining = items.filter { it.id !in subtreeIds }.toMutableList()

        // Adjust levels: root of subtree becomes target's level
        val levelDelta = target.level - subtree[0].level
        val adjusted = subtree.map { it.copy(level = (it.level + levelDelta).coerceIn(0, MAX_INDENT_LEVEL)) }
            .toMutableList()
        adjusted[0] = adjusted[0].copy(parent = target.parent)

        // Insert before target
        val targetIdx = remaining.indexOfFirst { it.id == targetId }
        if (targetIdx < 0) return items
        remaining.addAll(targetIdx, adjusted)

        return remaining
    }

    /**
     * Move a subtree to insert BELOW the target item (after target and all its children),
     * at the target's level.
     */
    fun moveBelow(
        items: List<ChecklistItemV2>,
        draggedId: String,
        targetId: String
    ): List<ChecklistItemV2> {
        val subtree = getSubtree(items, draggedId)
        if (subtree.isEmpty()) return items
        if (subtree.any { it.id == targetId }) return items

        val target = items.find { it.id == targetId } ?: return items
        val subtreeIds = subtree.map { it.id }.toSet()

        // Remove subtree from list
        val remaining = items.filter { it.id !in subtreeIds }.toMutableList()

        // Adjust levels
        val levelDelta = target.level - subtree[0].level
        val adjusted = subtree.map { it.copy(level = (it.level + levelDelta).coerceIn(0, MAX_INDENT_LEVEL)) }
            .toMutableList()
        adjusted[0] = adjusted[0].copy(parent = target.parent)

        // Find insert position: after target and all its descendants
        val targetIdx = remaining.indexOfFirst { it.id == targetId }
        if (targetIdx < 0) return items
        var insertIdx = targetIdx + 1
        while (insertIdx < remaining.size && remaining[insertIdx].level > target.level) {
            insertIdx++
        }
        remaining.addAll(insertIdx, adjusted)

        return remaining
    }

    /**
     * Move a subtree to become a child of the target item (level = target.level + 1).
     * Inserted after target's last descendant.
     */
    fun moveOnto(
        items: List<ChecklistItemV2>,
        draggedId: String,
        targetId: String
    ): List<ChecklistItemV2> {
        val subtree = getSubtree(items, draggedId)
        if (subtree.isEmpty()) return items
        if (subtree.any { it.id == targetId }) return items

        val target = items.find { it.id == targetId } ?: return items
        val subtreeIds = subtree.map { it.id }.toSet()

        // Remove subtree from list
        val remaining = items.filter { it.id !in subtreeIds }.toMutableList()

        // Adjust levels: root becomes target.level + 1
        val newRootLevel = target.level + 1
        val levelDelta = newRootLevel - subtree[0].level
        val adjusted = subtree.map { it.copy(level = (it.level + levelDelta).coerceIn(0, MAX_INDENT_LEVEL)) }
            .toMutableList()
        adjusted[0] = adjusted[0].copy(parent = targetId)

        // Find insert position: after target's last descendant
        val targetIdx = remaining.indexOfFirst { it.id == targetId }
        if (targetIdx < 0) return items
        var insertIdx = targetIdx + 1
        while (insertIdx < remaining.size && isDescendant(remaining, remaining[insertIdx], target)) {
            insertIdx++
        }
        remaining.addAll(insertIdx, adjusted)

        return remaining
    }

    /**
     * Check if an item is a descendant of an ancestor by walking up the parent chain.
     */
    private fun isDescendant(
        items: List<ChecklistItemV2>,
        item: ChecklistItemV2,
        ancestor: ChecklistItemV2
    ): Boolean {
        var current: ChecklistItemV2? = item
        while (current != null) {
            val p = getParent(items, current)
            if (p?.id == ancestor.id) return true
            current = p
        }
        return false
    }

    // ── Clipboard / Markdown Conversion ──────────────────────────────────────

    /**
     * Parse clipboard/note text into checklist items.
     * Recognizes:
     * - Markdown checkboxes: `- [ ] text`, `- [x] text`, `* [ ] text`, `* [x] text`
     * - List markers: `- text`, `* text`, `• text`, `1. text`, `1) text`
     * - Indentation: 4 spaces or 1 tab = 1 level, 2 spaces = 1 level
     */
    fun parseClipboardText(text: String): List<ChecklistItemV2> {
        if (text.isBlank()) return emptyList()

        val lines = text.split("\n")
        val items = mutableListOf<ChecklistItemV2>()

        for (line in lines) {
            if (line.isBlank()) continue

            // Detect indent level
            var indent = 0
            var stripped = line
            while (stripped.startsWith("    ") || stripped.startsWith("\t")) {
                indent++
                stripped = if (stripped.startsWith("\t")) stripped.substring(1) else stripped.substring(4)
            }
            if (stripped.startsWith("  ")) {
                indent++
                stripped = stripped.substring(2)
            }

            // Detect markdown checklist format: - [x] or - [ ] or * [x] or * [ ]
            var isChecked = false
            val mdChecklistRegex = Regex("^[-*]\\s+\\[([ xX])\\]\\s*")
            val mdMatch = mdChecklistRegex.find(stripped)
            if (mdMatch != null) {
                isChecked = mdMatch.groupValues[1].lowercase() == "x"
                stripped = stripped.removeRange(mdMatch.range)
            } else {
                // Strip list markers
                stripped = stripped.replace(Regex("^[-*•]\\s+"), "")
                stripped = stripped.replace(Regex("^\\d+[.)]\\s+"), "")
                // Check for standalone [x] or [ ] at start
                val legacyRegex = Regex("^\\[([ xX])\\]\\s*")
                val legacyMatch = legacyRegex.find(stripped)
                if (legacyMatch != null) {
                    isChecked = legacyMatch.groupValues[1].lowercase() == "x"
                    stripped = stripped.removeRange(legacyMatch.range)
                }
            }

            if (stripped.isBlank()) continue

            items.add(
                ChecklistItemV2(
                    id = UUID.randomUUID().toString(),
                    text = stripped.trim(),
                    level = indent.coerceAtMost(MAX_INDENT_LEVEL),
                    checked = isChecked,
                    parent = null
                )
            )
        }

        // Assign parents based on levels
        for (i in 1 until items.size) {
            if (items[i].level > 0) {
                for (j in (i - 1) downTo 0) {
                    if (items[j].level == items[i].level - 1) {
                        items[i] = items[i].copy(parent = items[j].id)
                        break
                    }
                }
            }
        }

        return items
    }

    /**
     * Convert checklist items to markdown task list format.
     * Format: `"  ".repeat(level) + "- [ ] " + text` or `"- [x] "` for checked items.
     */
    fun itemsToMarkdown(items: List<ChecklistItemV2>): String {
        return items.joinToString("\n") { item ->
            val indent = "  ".repeat(item.level)
            val checkbox = if (item.checked) "- [x] " else "- [ ] "
            "$indent$checkbox${item.text}"
        }
    }

    // ── Utility ──────────────────────────────────────────────────────────────

    /**
     * Generate a new unique item ID.
     */
    fun generateId(): String = UUID.randomUUID().toString()

    /**
     * Add a new item at the end of the unchecked items.
     */
    fun addItem(
        items: List<ChecklistItemV2>,
        text: String,
        level: Int = 0,
        parent: String? = null
    ): List<ChecklistItemV2> {
        val newItem = ChecklistItemV2(
            id = generateId(),
            text = text,
            level = level.coerceIn(0, MAX_INDENT_LEVEL),
            checked = false,
            parent = parent
        )
        return items + newItem
    }

    /**
     * Get ghost parents for the completed section.
     * Returns unchecked ancestors of checked items that need to be shown for context.
     */
    fun getGhostParents(items: List<ChecklistItemV2>): Set<String> {
        val checkedItems = items.filter { it.checked }
        val ghostIds = mutableSetOf<String>()

        for (item in checkedItems) {
            var current: ChecklistItemV2? = item
            while (current != null) {
                val parent = getParent(items, current)
                if (parent != null && !parent.checked && parent.id !in ghostIds) {
                    ghostIds.add(parent.id)
                }
                current = parent
            }
        }

        return ghostIds
    }
}
