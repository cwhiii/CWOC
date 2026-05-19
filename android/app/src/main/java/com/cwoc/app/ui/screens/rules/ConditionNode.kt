package com.cwoc.app.ui.screens.rules

import com.google.gson.Gson
import java.util.UUID

/**
 * Sealed class representing a node in the condition tree for the rule editor.
 * Matches the web app's JSON structure:
 *   Group: { type: "group", operator: "AND"/"OR", children: [...] }
 *   Leaf:  { type: "leaf", field: "...", operator: "...", value: "..." }
 *
 * Internal [id] is used for Compose keying and UI tracking — stripped on serialization.
 */
sealed class ConditionNode {
    abstract val id: String

    /**
     * A logical group that combines child conditions with AND/OR.
     * Supports arbitrary nesting depth matching the web recursive condition tree.
     */
    data class Group(
        override val id: String = UUID.randomUUID().toString(),
        val operator: String = "AND", // "AND" or "OR"
        val children: MutableList<ConditionNode> = mutableListOf()
    ) : ConditionNode()

    /**
     * A single condition comparing a field to a value using an operator.
     * Operators match the web's OPERATOR_GROUPS:
     *   Comparison: equals, not_equals, greater_than, less_than
     *   Text: contains, not_contains, starts_with, ends_with, regex_match
     *   Presence: is_empty, is_not_empty
     *   Tags & People: tag_present, tag_not_present, person_on_chit, person_not_on_chit
     *   Date Age: days_ago_greater_than, days_ago_less_than
     *   Weather: weather_temp_low_below, weather_forecast_contains_*, etc.
     */
    data class Leaf(
        override val id: String = UUID.randomUUID().toString(),
        val field: String = "",
        val operator: String = "equals",
        val value: String = ""
    ) : ConditionNode()
}

// ─── Serialization ──────────────────────────────────────────────────────────────

/**
 * Serializes a condition tree to a JSON object matching the web API format.
 * Strips internal IDs — produces the same structure as the web's _serializeTree().
 *
 * Output format:
 *   Group: { "type": "group", "operator": "AND"/"OR", "children": [...] }
 *   Leaf:  { "type": "leaf", "field": "...", "operator": "...", "value": "..." }
 */
fun serializeTree(node: ConditionNode): Map<String, Any?> {
    return when (node) {
        is ConditionNode.Group -> mapOf(
            "type" to "group",
            "operator" to node.operator,
            "children" to node.children.map { serializeTree(it) }
        )
        is ConditionNode.Leaf -> mapOf(
            "type" to "leaf",
            "field" to node.field,
            "operator" to node.operator,
            "value" to node.value
        )
    }
}

/**
 * Serializes the condition tree root to a JSON string for API transmission.
 */
fun serializeTreeToJson(root: ConditionNode.Group, gson: Gson): String {
    return gson.toJson(serializeTree(root))
}

// ─── Deserialization ────────────────────────────────────────────────────────────

/**
 * Deserializes a condition tree from API JSON (as a Map parsed by Gson).
 * Adds internal IDs for Compose keying — mirrors the web's _deserializeTree().
 *
 * Accepts the parsed JSON object (Map<String, Any?>) from the API response.
 * Returns a ConditionNode.Group as the root. If input is null or invalid,
 * returns a default empty group.
 */
fun deserializeTree(data: Any?): ConditionNode.Group {
    if (data == null) return ConditionNode.Group()

    val node = deserializeNode(data)
    // Ensure root is always a Group
    return when (node) {
        is ConditionNode.Group -> node
        is ConditionNode.Leaf -> ConditionNode.Group(children = mutableListOf(node))
    }
}

/**
 * Deserializes a condition tree from a JSON string.
 * Adds internal IDs for Compose keying.
 */
fun deserializeTreeFromJson(json: String?, gson: Gson): ConditionNode.Group {
    if (json.isNullOrBlank()) return ConditionNode.Group()
    return try {
        val parsed = gson.fromJson(json, Map::class.java)
        deserializeTree(parsed)
    } catch (e: Exception) {
        ConditionNode.Group()
    }
}

/**
 * Recursively deserializes a single node from a parsed JSON map.
 */
private fun deserializeNode(data: Any?): ConditionNode {
    if (data == null || data !is Map<*, *>) {
        return ConditionNode.Leaf()
    }

    val type = data["type"] as? String
    return when (type) {
        "group" -> {
            val operator = (data["operator"] as? String) ?: "AND"
            val childrenRaw = data["children"] as? List<*> ?: emptyList<Any>()
            val children = childrenRaw.map { deserializeNode(it) }.toMutableList()
            ConditionNode.Group(
                id = UUID.randomUUID().toString(),
                operator = operator,
                children = children
            )
        }
        else -> {
            // "leaf" or unknown type — treat as leaf
            val field = (data["field"] as? String) ?: ""
            val operator = (data["operator"] as? String) ?: "equals"
            val value = (data["value"] as? String) ?: ""
            ConditionNode.Leaf(
                id = UUID.randomUUID().toString(),
                field = field,
                operator = operator,
                value = value
            )
        }
    }
}
