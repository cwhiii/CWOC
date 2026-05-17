package com.cwoc.app.domain.checklist

/**
 * Represents a single checklist item (mirrors the server's JSON structure).
 */
data class ChecklistItem(
    val text: String,
    val checked: Boolean = false,
    val indent: Int = 0,        // nesting level (0 = top-level)
    val id: String? = null      // optional unique ID for drag-drop tracking
)

/**
 * Pure domain operations for checklist manipulation.
 * These operate on immutable lists and return new lists.
 */
object ChecklistOperations {

    /**
     * Toggle the checked state of a checklist item at the given index.
     * Returns a new list with the item's checked state flipped.
     *
     * This is an involution: toggling twice returns the original state.
     */
    fun toggleChecklistItem(items: List<ChecklistItem>, index: Int): List<ChecklistItem> {
        if (index < 0 || index >= items.size) return items
        return items.toMutableList().apply {
            this[index] = this[index].copy(checked = !this[index].checked)
        }
    }

    /**
     * Reorder a checklist item from one position to another.
     * Returns a new list with the item moved.
     *
     * Preserves all items (no items are lost or duplicated).
     */
    fun reorderChecklistItem(
        items: List<ChecklistItem>,
        fromIndex: Int,
        toIndex: Int
    ): List<ChecklistItem> {
        if (fromIndex < 0 || fromIndex >= items.size) return items
        if (toIndex < 0 || toIndex >= items.size) return items
        if (fromIndex == toIndex) return items

        val result = items.toMutableList()
        val item = result.removeAt(fromIndex)
        result.add(toIndex, item)
        return result
    }

    /**
     * Compute the indentation in dp for a given nesting depth.
     * Each level adds 24dp of indentation.
     */
    fun indentationDp(indent: Int): Int {
        return indent.coerceAtLeast(0) * 24
    }

    /**
     * Parse a JSON checklist string into a list of ChecklistItems.
     * Returns an empty list if the JSON is null, blank, or malformed.
     */
    fun parseChecklist(json: String?): List<ChecklistItem> {
        if (json.isNullOrBlank() || json == "[]" || json == "null") return emptyList()

        return try {
            val gson = com.google.gson.Gson()
            val type = object : com.google.gson.reflect.TypeToken<List<Map<String, Any>>>() {}.type
            val rawItems: List<Map<String, Any>> = gson.fromJson(json, type)

            rawItems.map { raw ->
                ChecklistItem(
                    text = (raw["text"] as? String) ?: (raw["label"] as? String) ?: "",
                    checked = (raw["checked"] as? Boolean) ?: (raw["done"] as? Boolean) ?: false,
                    indent = ((raw["indent"] as? Double)?.toInt()) ?: ((raw["level"] as? Double)?.toInt()) ?: 0,
                    id = raw["id"] as? String
                )
            }
        } catch (_: Exception) {
            emptyList()
        }
    }

    /**
     * Serialize a list of ChecklistItems back to JSON string.
     */
    fun serializeChecklist(items: List<ChecklistItem>): String {
        val gson = com.google.gson.Gson()
        val rawItems = items.map { item ->
            buildMap {
                put("text", item.text)
                put("checked", item.checked)
                put("indent", item.indent)
                item.id?.let { put("id", it) }
            }
        }
        return gson.toJson(rawItems)
    }
}
