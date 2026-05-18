package com.cwoc.app.domain.search

import com.cwoc.app.data.local.entity.ChitEntity
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import javax.inject.Inject

/**
 * Evaluates a parsed SearchNode AST against a ChitEntity.
 *
 * Searches across: title, note, tags, and checklist item text.
 * All matching is case-insensitive substring matching.
 */
class BooleanSearchEvaluator @Inject constructor() {

    private val gson = Gson()

    /**
     * Check if a chit matches the given search node.
     */
    fun matches(chit: ChitEntity, node: SearchNode): Boolean {
        val searchableText = extractSearchableText(chit)
        return evaluate(node, searchableText)
    }

    /**
     * Extract all searchable text from a chit as a single lowercase string.
     * Includes: title, note, tags, and checklist item text.
     */
    fun extractSearchableText(chit: ChitEntity): String {
        val parts = mutableListOf<String>()

        chit.title?.let { parts.add(it) }
        chit.note?.let { parts.add(it) }

        // Tags
        chit.tags?.forEach { parts.add(it) }

        // Checklist items — parse JSON and extract text
        chit.checklist?.let { checklistJson ->
            if (checklistJson.isNotBlank() && checklistJson != "[]" && checklistJson != "null") {
                try {
                    val type = object : TypeToken<List<Map<String, Any>>>() {}.type
                    val items: List<Map<String, Any>> = gson.fromJson(checklistJson, type)
                    items.forEach { item ->
                        (item["text"] as? String)?.let { parts.add(it) }
                        (item["label"] as? String)?.let { parts.add(it) }
                    }
                } catch (_: Exception) {
                    // Malformed JSON — skip
                }
            }
        }

        return parts.joinToString(" ").lowercase()
    }

    private fun evaluate(node: SearchNode, text: String): Boolean {
        return when (node) {
            is SearchNode.Term -> text.contains(node.value)
            is SearchNode.And -> evaluate(node.left, text) && evaluate(node.right, text)
            is SearchNode.Or -> evaluate(node.left, text) || evaluate(node.right, text)
            is SearchNode.Not -> !evaluate(node.child, text)
        }
    }
}
