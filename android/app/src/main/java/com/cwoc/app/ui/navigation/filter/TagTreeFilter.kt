package com.cwoc.app.ui.navigation.filter

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Data class representing a tag available for filtering.
 */
data class TagItem(
    val name: String,       // full path e.g. "Work/Projects/CWOC"
    val color: String?,     // hex color or null
    val favorite: Boolean
)

/**
 * Internal tree node for hierarchical tag rendering.
 */
private data class TagTreeNode(
    val segment: String,        // leaf segment (e.g., "CWOC")
    val fullPath: String,       // full path (e.g., "Work/Projects/CWOC")
    val color: String?,
    val favorite: Boolean,
    val children: List<TagTreeNode>
)

/**
 * Build a tag tree from a flat list of TagItems.
 * Splits by "/" separator, groups hierarchically, sorts favorites first then alphabetical.
 */
private fun buildTagTree(tags: List<TagItem>): List<TagTreeNode> {
    // Group tags by their first path segment
    data class TagEntry(val segments: List<String>, val item: TagItem)

    val entries = tags.map { TagEntry(it.name.split("/"), it) }

    fun buildLevel(entries: List<TagEntry>, depth: Int): List<TagTreeNode> {
        // Group by segment at this depth
        val groups = entries.groupBy { it.segments.getOrNull(depth) ?: "" }
            .filter { it.key.isNotEmpty() }

        return groups.map { (segment, groupEntries) ->
            // Find the entry that terminates at this depth (exact match)
            val exactMatch = groupEntries.firstOrNull { it.segments.size == depth + 1 }
            // Entries that continue deeper
            val childEntries = groupEntries.filter { it.segments.size > depth + 1 }

            val fullPath = if (exactMatch != null) {
                exactMatch.item.name
            } else {
                groupEntries.first().segments.take(depth + 1).joinToString("/")
            }

            TagTreeNode(
                segment = segment,
                fullPath = fullPath,
                color = exactMatch?.item?.color,
                favorite = exactMatch?.item?.favorite ?: false,
                children = buildLevel(childEntries, depth + 1)
            )
        }.sortedWith(compareByDescending<TagTreeNode> { it.favorite }.thenBy { it.segment.lowercase() })
    }

    return buildLevel(entries, 0)
}

/**
 * Tag tree filter composable matching the web sidebar's Tags filter group.
 * Features: Select All/None toggle, search, hierarchical tree with colored badges,
 * favorites first, expand/collapse for parents.
 */
@Composable
fun TagTreeFilter(
    tags: List<TagItem>,
    selectedTags: Set<String>,
    onSelectionChanged: (Set<String>) -> Unit,
    onClear: () -> Unit,
    modifier: Modifier = Modifier
) {
    var searchQuery by remember { mutableStateOf("") }
    val expandedNodes = remember { mutableStateMapOf<String, Boolean>() }

    val allTagNames = remember(tags) { tags.map { it.name }.toSet() }
    val allSelected = allTagNames.isNotEmpty() && allTagNames == selectedTags
    val tree = remember(tags) { buildTagTree(tags) }

    Column(modifier = modifier.fillMaxWidth()) {
        // Select All / Select None toggle button
        OutlinedButton(
            onClick = {
                if (allSelected) {
                    onSelectionChanged(emptySet())
                } else {
                    onSelectionChanged(allTagNames)
                }
            },
            modifier = Modifier.fillMaxWidth(),
            border = BorderStroke(1.dp, FilterBrownBorder.copy(alpha = 0.3f)),
            shape = RoundedCornerShape(3.dp),
            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp),
            colors = ButtonDefaults.outlinedButtonColors(
                containerColor = if (allSelected) FilterBrownBorder.copy(alpha = 0.1f) else Color.Transparent,
                contentColor = FilterBrownBorder
            )
        ) {
            Text(
                text = if (allSelected) "Select None" else "Select All",
                fontSize = 12.sp,
                color = FilterBrownBorder
            )
        }

        Spacer(modifier = Modifier.height(6.dp))

        // Search input
        OutlinedTextField(
            value = searchQuery,
            onValueChange = { searchQuery = it },
            placeholder = { Text("Search tags...", fontSize = 12.sp, color = FilterBrownText.copy(alpha = 0.5f)) },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
            textStyle = androidx.compose.ui.text.TextStyle(fontSize = 12.sp, color = FilterBrownText),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = FilterBrownBorder,
                unfocusedBorderColor = FilterBrownBorder.copy(alpha = 0.6f),
                focusedContainerColor = FilterParchmentBg,
                unfocusedContainerColor = FilterParchmentBg,
                cursorColor = FilterBrownBorder
            ),
            shape = RoundedCornerShape(3.dp)
        )

        Spacer(modifier = Modifier.height(6.dp))

        // Tag tree
        if (tags.isEmpty()) {
            Text(
                text = "No tags defined",
                fontSize = 12.sp,
                color = FilterBrownText.copy(alpha = 0.5f),
                modifier = Modifier.padding(start = 4.dp)
            )
        } else {
            TagTreeLevel(
                nodes = tree,
                depth = 0,
                selectedTags = selectedTags,
                searchQuery = searchQuery.lowercase(),
                expandedNodes = expandedNodes,
                onToggleSelection = { fullPath ->
                    val newSelection = if (fullPath in selectedTags) {
                        selectedTags - fullPath
                    } else {
                        selectedTags + fullPath
                    }
                    onSelectionChanged(newSelection)
                },
                onToggleExpand = { path ->
                    expandedNodes[path] = !(expandedNodes[path] ?: false)
                }
            )
        }

        Spacer(modifier = Modifier.height(4.dp))

        // Clear button
        FilterClearButton(
            onClick = onClear,
            modifier = Modifier.padding(start = 8.dp)
        )
    }
}

@Composable
private fun TagTreeLevel(
    nodes: List<TagTreeNode>,
    depth: Int,
    selectedTags: Set<String>,
    searchQuery: String,
    expandedNodes: MutableMap<String, Boolean>,
    onToggleSelection: (String) -> Unit,
    onToggleExpand: (String) -> Unit
) {
    nodes.forEach { node ->
        val matchesSearch = searchQuery.isEmpty() || node.fullPath.lowercase().contains(searchQuery)
        val childrenMatchSearch = node.children.any { childMatchesSearch(it, searchQuery) }

        if (matchesSearch || childrenMatchSearch) {
            TagTreeRow(
                node = node,
                depth = depth,
                isSelected = node.fullPath in selectedTags,
                isExpanded = expandedNodes[node.fullPath] ?: (searchQuery.isNotEmpty()),
                hasChildren = node.children.isNotEmpty(),
                onTap = { onToggleSelection(node.fullPath) },
                onExpandToggle = { onToggleExpand(node.fullPath) }
            )

            // Render children if expanded or searching
            val showChildren = (expandedNodes[node.fullPath] ?: false) || searchQuery.isNotEmpty()
            if (showChildren && node.children.isNotEmpty()) {
                TagTreeLevel(
                    nodes = node.children,
                    depth = depth + 1,
                    selectedTags = selectedTags,
                    searchQuery = searchQuery,
                    expandedNodes = expandedNodes,
                    onToggleSelection = onToggleSelection,
                    onToggleExpand = onToggleExpand
                )
            }
        }
    }
}

private fun childMatchesSearch(node: TagTreeNode, query: String): Boolean {
    if (query.isEmpty()) return true
    if (node.fullPath.lowercase().contains(query)) return true
    return node.children.any { childMatchesSearch(it, query) }
}

@Composable
private fun TagTreeRow(
    node: TagTreeNode,
    depth: Int,
    isSelected: Boolean,
    isExpanded: Boolean,
    hasChildren: Boolean,
    onTap: () -> Unit,
    onExpandToggle: () -> Unit
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            .padding(start = (depth * 16).dp)
            .clickable { onTap() }
            .padding(vertical = 3.dp)
    ) {
        // Expand/collapse arrow for parents
        if (hasChildren) {
            Text(
                text = if (isExpanded) "▼" else "▶",
                fontSize = 10.sp,
                color = FilterHeaderBrown,
                modifier = Modifier
                    .clickable { onExpandToggle() }
                    .padding(end = 4.dp)
            )
        } else {
            Spacer(modifier = Modifier.width(14.dp))
        }

        // Favorite star
        if (node.favorite) {
            Text(
                text = "★ ",
                fontSize = 11.sp,
                color = Color(0xFFDAA520)
            )
        }

        // Colored tag badge
        val bgColor = parseHexColor(node.color, generatePastelColor(node.fullPath))
        Surface(
            shape = RoundedCornerShape(4.dp),
            color = bgColor,
            border = if (isSelected) BorderStroke(2.dp, FilterSelectedOutline) else null,
            modifier = Modifier.padding(vertical = 1.dp)
        ) {
            Text(
                text = node.segment,
                fontSize = 12.sp,
                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                color = if (isLightColor(bgColor)) FilterBrownDark else Color.White,
                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
            )
        }
    }
}
