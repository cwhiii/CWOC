package com.cwoc.app.domain.tags

import com.google.gson.Gson
import com.google.gson.reflect.TypeToken

/**
 * A node in the tag tree hierarchy.
 *
 * Tags are stored as a flat array of objects with slash-separated paths
 * (e.g., "Work/Projects/Alpha"). This tree structure is built by splitting
 * those paths and creating intermediate parent nodes as needed.
 */
data class TagNode(
    val name: String,
    val fullPath: String,
    var color: String?,
    val fontColor: String?,
    val favorite: Boolean,
    val children: MutableList<TagNode> = mutableListOf()
)

/**
 * Parses the SettingsEntity.tags JSON string into a hierarchical tag tree.
 *
 * The JSON format is a flat array of objects:
 * [{"name": "Work/Projects/Alpha", "color": "#ff0000", "fontColor": "#fff", "favorite": true}, ...]
 *
 * The parser splits each name on "/" to build a nested tree, inherits colors
 * from parent to child, and sorts favorites first then alphabetically.
 */
object TagTreeParser {

    private val gson = Gson()

    /**
     * Raw tag data as stored in the settings JSON.
     */
    private data class RawTag(
        val name: String?,
        val color: String? = null,
        val fontColor: String? = null,
        val favorite: Boolean? = false
    )

    /**
     * Parse the tags JSON string into a tree of TagNodes.
     *
     * @param tagsJson The JSON string from SettingsEntity.tags
     * @return Root-level list of TagNodes forming the tree
     */
    fun parseTagTree(tagsJson: String?): List<TagNode> {
        if (tagsJson.isNullOrBlank() || tagsJson == "[]" || tagsJson == "null") {
            return emptyList()
        }

        val rawTags = parseRawTags(tagsJson)
        if (rawTags.isEmpty()) return emptyList()

        // Filter out system tags
        val userTags = rawTags.filter { tag ->
            val name = tag.name ?: return@filter false
            !name.startsWith("cwoc_system/", ignoreCase = true) &&
                !name.startsWith("CWOC_System/", ignoreCase = true) &&
                name !in setOf("Calendar", "Checklists", "Alarms", "Projects", "Tasks", "Notes")
        }

        val root = mutableListOf<TagNode>()
        val nodeMap = mutableMapOf<String, TagNode>()

        userTags.forEach { tag ->
            val fullName = tag.name ?: return@forEach
            val parts = fullName.split("/")
            var currentLevel = root
            var pathSoFar = ""

            parts.forEachIndexed { index, part ->
                pathSoFar = if (pathSoFar.isEmpty()) part else "$pathSoFar/$part"

                if (!nodeMap.containsKey(pathSoFar)) {
                    val isLeaf = index == parts.size - 1
                    val node = TagNode(
                        name = part,
                        fullPath = pathSoFar,
                        color = if (isLeaf) tag.color else null,
                        fontColor = if (isLeaf) tag.fontColor else null,
                        favorite = if (isLeaf) (tag.favorite ?: false) else false
                    )
                    nodeMap[pathSoFar] = node
                    currentLevel.add(node)
                }
                currentLevel = nodeMap[pathSoFar]!!.children
            }
        }

        // Inherit colors from parent to children that have no color
        inheritColors(root, null)

        // Sort: favorites first, then alphabetically at every level
        sortTree(root)

        return root
    }

    /**
     * Flatten the tag tree into a single list of all nodes (depth-first).
     * Useful for search/filter functionality.
     *
     * @param tree The root-level tag tree
     * @return Flat list of all TagNodes in depth-first order
     */
    fun flattenTree(tree: List<TagNode>): List<TagNode> {
        val result = mutableListOf<TagNode>()
        fun walk(nodes: List<TagNode>) {
            nodes.forEach { node ->
                result.add(node)
                walk(node.children)
            }
        }
        walk(tree)
        return result
    }

    /**
     * Flatten the tree and return only leaf nodes (nodes with no children).
     * These represent the actual assignable tags.
     *
     * @param tree The root-level tag tree
     * @return Flat list of leaf TagNodes only
     */
    fun getLeafTags(tree: List<TagNode>): List<TagNode> {
        val result = mutableListOf<TagNode>()
        fun walk(nodes: List<TagNode>) {
            nodes.forEach { node ->
                if (node.children.isEmpty()) {
                    result.add(node)
                } else {
                    walk(node.children)
                }
            }
        }
        walk(tree)
        return result
    }

    private fun parseRawTags(json: String): List<RawTag> {
        return try {
            val type = object : TypeToken<List<RawTag>>() {}.type
            gson.fromJson(json, type) ?: emptyList()
        } catch (_: Exception) {
            emptyList()
        }
    }

    private fun inheritColors(nodes: List<TagNode>, parentColor: String?) {
        nodes.forEach { node ->
            if (node.color == null && parentColor != null) {
                node.color = parentColor
            }
            if (node.children.isNotEmpty()) {
                inheritColors(node.children, node.color ?: parentColor)
            }
        }
    }

    private fun sortTree(nodes: MutableList<TagNode>) {
        nodes.sortWith(compareBy<TagNode> { !it.favorite }.thenBy { it.name.lowercase() })
        nodes.forEach { node ->
            if (node.children.isNotEmpty()) {
                sortTree(node.children)
            }
        }
    }
}
