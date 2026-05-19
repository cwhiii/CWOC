package com.cwoc.app.domain.checklist

/**
 * V2 checklist item data model matching the web's JSON structure exactly.
 * Adds parent tracking for proper hierarchy operations (subtree moves, cascading checks, ghost parents).
 *
 * @param id Unique identifier (UUID string), always present
 * @param text Item content, supports markdown formatting
 * @param level Nesting depth 0–4 (MAX_INDENT_LEVEL)
 * @param checked Whether the item is completed
 * @param parent ID of the parent item, null for top-level items
 */
data class ChecklistItemV2(
    val id: String,
    val text: String,
    val level: Int = 0,
    val checked: Boolean = false,
    val parent: String? = null
)
