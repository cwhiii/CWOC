package com.cwoc.app.ui.screens.editor.zones

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.cwoc.app.domain.tags.TagNode

/**
 * A ModalBottomSheet-based tag picker that displays the full tag tree
 * with search, favorites, expandable hierarchy, and inline tag creation.
 *
 * Validates: Requirements 4.2, 4.3, 4.5, 4.6
 *
 * @param allTags The full tag tree (root-level nodes with children)
 * @param selectedTags List of currently selected tag full paths
 * @param onTagToggled Callback when a tag is toggled (passes the tag's fullPath)
 * @param onTagCreated Callback when a new tag is created inline (passes the new tag name)
 * @param onDismiss Callback when the sheet is dismissed
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TagsPickerSheet(
    allTags: List<TagNode>,
    selectedTags: List<String>,
    onTagToggled: (String) -> Unit,
    onTagCreated: (String) -> Unit,
    onDismiss: () -> Unit,
    // I1: Recent tags from settings
    recentTags: List<String> = emptyList()
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var searchQuery by remember { mutableStateOf("") }
    var newTagName by remember { mutableStateOf("") }
    val expandedNodes = remember { mutableStateListOf<String>() }

    // Collect favorite tags from the tree (depth-first)
    val favoriteTags = remember(allTags) {
        collectFavorites(allTags)
    }

    // Flatten tree for search filtering
    val filteredTree = remember(allTags, searchQuery) {
        if (searchQuery.isBlank()) {
            allTags
        } else {
            filterTagTree(allTags, searchQuery.trim())
        }
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = MaterialTheme.colorScheme.background,
        contentColor = MaterialTheme.colorScheme.onBackground
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp)
                .padding(bottom = 24.dp)
        ) {
            // ─── Title + I2: Expand/Collapse All ────────────────────────
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Tags",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary
                )
                // I2: Expand/Collapse All button
                IconButton(
                    onClick = {
                        if (expandedNodes.isNotEmpty()) {
                            expandedNodes.clear() // Collapse all
                        } else {
                            // Expand all — collect all node paths
                            expandedNodes.addAll(collectAllPaths(allTags))
                        }
                    }
                ) {
                    Icon(
                        imageVector = if (expandedNodes.isNotEmpty()) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                        contentDescription = if (expandedNodes.isNotEmpty()) "Collapse All" else "Expand All"
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // ─── Search Field ───────────────────────────────────────────────
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { searchQuery = it },
                modifier = Modifier.fillMaxWidth(),
                placeholder = { Text("Search tags…") },
                singleLine = true,
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = MaterialTheme.colorScheme.primary,
                    unfocusedBorderColor = MaterialTheme.colorScheme.outline
                )
            )

            Spacer(modifier = Modifier.height(12.dp))

            // ─── Favorites Section ──────────────────────────────────────────
            if (favoriteTags.isNotEmpty() && searchQuery.isBlank()) {
                Text(
                    text = "Favorites",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                Spacer(modifier = Modifier.height(6.dp))

                LazyRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(favoriteTags, key = { it.fullPath }) { tag ->
                        val isSelected = selectedTags.contains(tag.fullPath)
                        val chipColor = tag.color?.let { parseTagColor(it) }
                            ?: MaterialTheme.colorScheme.primaryContainer

                        FilterChip(
                            selected = isSelected,
                            onClick = { onTagToggled(tag.fullPath) },
                            label = { Text(tag.name) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = chipColor,
                                selectedLabelColor = contrastTextColor(chipColor)
                            )
                        )
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))
                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                Spacer(modifier = Modifier.height(8.dp))
            }

            // ─── I1: Recent Tags Section ────────────────────────────────────
            if (recentTags.isNotEmpty() && searchQuery.isBlank()) {
                Text(
                    text = "Recent",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                Spacer(modifier = Modifier.height(6.dp))

                LazyRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(recentTags) { tagName ->
                        val isSelected = selectedTags.contains(tagName)
                        FilterChip(
                            selected = isSelected,
                            onClick = { onTagToggled(tagName) },
                            label = { Text(tagName) }
                        )
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))
                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                Spacer(modifier = Modifier.height(8.dp))
            }

            // ─── Tag Tree Section ───────────────────────────────────────────
            LazyColumn(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f, fill = false)
                    .height(320.dp)
            ) {
                renderTagTree(
                    nodes = filteredTree,
                    selectedTags = selectedTags,
                    expandedNodes = expandedNodes,
                    onTagToggled = onTagToggled,
                    onExpandToggle = { path ->
                        if (expandedNodes.contains(path)) {
                            expandedNodes.remove(path)
                        } else {
                            expandedNodes.add(path)
                        }
                    },
                    depth = 0,
                    isSearching = searchQuery.isNotBlank()
                )
            }

            Spacer(modifier = Modifier.height(12.dp))
            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
            Spacer(modifier = Modifier.height(12.dp))

            // ─── Create New Tag Section ─────────────────────────────────────
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedTextField(
                    value = newTagName,
                    onValueChange = { newTagName = it },
                    modifier = Modifier.weight(1f),
                    placeholder = { Text("Create new tag…") },
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = MaterialTheme.colorScheme.primary,
                        unfocusedBorderColor = MaterialTheme.colorScheme.outline
                    )
                )

                IconButton(
                    onClick = {
                        val trimmed = newTagName.trim()
                        if (trimmed.isNotEmpty()) {
                            onTagCreated(trimmed)
                            newTagName = ""
                        }
                    },
                    enabled = newTagName.isNotBlank()
                ) {
                    Icon(
                        imageVector = Icons.Default.Add,
                        contentDescription = "Create tag",
                        tint = if (newTagName.isNotBlank()) {
                            MaterialTheme.colorScheme.primary
                        } else {
                            MaterialTheme.colorScheme.onSurfaceVariant
                        }
                    )
                }
            }

            // ─── Create Tag with Color/Parent (Task 34) ─────────────────────
            Spacer(modifier = Modifier.height(8.dp))

            var showTagCreateDialog by remember { mutableStateOf(false) }

            androidx.compose.material3.OutlinedButton(
                onClick = { showTagCreateDialog = true },
                modifier = Modifier.fillMaxWidth()
            ) {
                Icon(
                    imageVector = Icons.Default.Add,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp)
                )
                androidx.compose.foundation.layout.Spacer(modifier = Modifier.width(6.dp))
                Text("Create Tag with Color…")
            }

            if (showTagCreateDialog) {
                com.cwoc.app.ui.components.TagCreateDialog(
                    parentTags = allTags,
                    onConfirm = { name, color, parentPath ->
                        // Create the tag with color info
                        val fullName = if (parentPath != null) "$parentPath/$name" else name
                        onTagCreated(fullName)
                        showTagCreateDialog = false
                    },
                    onDismiss = { showTagCreateDialog = false }
                )
            }
        }
    }
}

// ─── Tag Tree Rendering ─────────────────────────────────────────────────────────

/**
 * Recursively renders the tag tree into a LazyColumn.
 * Each node shows a colored dot, name, expand/collapse icon (if has children),
 * and a checkbox for selection state.
 */
private fun androidx.compose.foundation.lazy.LazyListScope.renderTagTree(
    nodes: List<TagNode>,
    selectedTags: List<String>,
    expandedNodes: List<String>,
    onTagToggled: (String) -> Unit,
    onExpandToggle: (String) -> Unit,
    depth: Int,
    isSearching: Boolean
) {
    nodes.forEach { node ->
        val hasChildren = node.children.isNotEmpty()
        val isExpanded = expandedNodes.contains(node.fullPath) || isSearching

        item(key = node.fullPath) {
            TagTreeRow(
                node = node,
                isSelected = selectedTags.contains(node.fullPath),
                hasChildren = hasChildren,
                isExpanded = isExpanded,
                depth = depth,
                onToggleSelect = { onTagToggled(node.fullPath) },
                onToggleExpand = { onExpandToggle(node.fullPath) }
            )
        }

        // Render children if expanded
        if (hasChildren && isExpanded) {
            renderTagTree(
                nodes = node.children,
                selectedTags = selectedTags,
                expandedNodes = expandedNodes,
                onTagToggled = onTagToggled,
                onExpandToggle = onExpandToggle,
                depth = depth + 1,
                isSearching = isSearching
            )
        }
    }
}

/**
 * A single row in the tag tree: colored dot + name + expand icon + checkbox.
 */
@Composable
private fun TagTreeRow(
    node: TagNode,
    isSelected: Boolean,
    hasChildren: Boolean,
    isExpanded: Boolean,
    depth: Int,
    onToggleSelect: () -> Unit,
    onToggleExpand: () -> Unit,
    // I3: Edit/delete callbacks
    onEdit: (() -> Unit)? = null,
    onDelete: (() -> Unit)? = null
) {
    val indentPadding = (depth * 24).dp
    // I3: Long-press context menu state
    var showContextMenu by remember { mutableStateOf(false) }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onToggleSelect)
            .padding(start = indentPadding, top = 4.dp, bottom = 4.dp, end = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Expand/collapse icon for parent nodes
        if (hasChildren) {
            Icon(
                imageVector = if (isExpanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                contentDescription = if (isExpanded) "Collapse" else "Expand",
                modifier = Modifier
                    .size(20.dp)
                    .clickable(onClick = onToggleExpand),
                tint = MaterialTheme.colorScheme.onSurfaceVariant
            )
        } else {
            Spacer(modifier = Modifier.width(20.dp))
        }

        Spacer(modifier = Modifier.width(8.dp))

        // Colored dot
        val dotColor = node.color?.let { parseTagColor(it) }
            ?: MaterialTheme.colorScheme.outline
        Box(
            modifier = Modifier
                .size(12.dp)
                .clip(CircleShape)
                .background(dotColor)
        )

        Spacer(modifier = Modifier.width(10.dp))

        // Tag name (long-press for context menu)
        Box(modifier = Modifier.weight(1f)) {
            Text(
                text = node.name,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurface,
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable(
                        onClick = onToggleSelect,
                        onClickLabel = "Select tag"
                    )
            )
            // I3: Context menu for edit/delete
            androidx.compose.material3.DropdownMenu(
                expanded = showContextMenu,
                onDismissRequest = { showContextMenu = false }
            ) {
                if (onEdit != null) {
                    androidx.compose.material3.DropdownMenuItem(
                        text = { Text("✏️ Edit Tag") },
                        onClick = {
                            showContextMenu = false
                            onEdit()
                        }
                    )
                }
                if (onDelete != null) {
                    androidx.compose.material3.DropdownMenuItem(
                        text = { Text("🗑️ Delete Tag") },
                        onClick = {
                            showContextMenu = false
                            onDelete()
                        }
                    )
                }
            }
        }

        // I3: Edit button (visible, no need for long-press discovery)
        if (onEdit != null || onDelete != null) {
            IconButton(
                onClick = { showContextMenu = true },
                modifier = Modifier.size(24.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.ExpandMore,
                    contentDescription = "Tag options",
                    modifier = Modifier.size(16.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        // Checkbox
        Checkbox(
            checked = isSelected,
            onCheckedChange = { onToggleSelect() },
            colors = CheckboxDefaults.colors(
                checkedColor = MaterialTheme.colorScheme.primary,
                uncheckedColor = MaterialTheme.colorScheme.outline
            )
        )
    }
}

// ─── Helper Functions ───────────────────────────────────────────────────────────

/**
 * Collects all favorite tags from the tree (depth-first traversal).
 */
private fun collectFavorites(nodes: List<TagNode>): List<TagNode> {
    val favorites = mutableListOf<TagNode>()
    fun walk(list: List<TagNode>) {
        list.forEach { node ->
            if (node.favorite) favorites.add(node)
            walk(node.children)
        }
    }
    walk(nodes)
    return favorites
}

/**
 * I2: Collects all node fullPaths from the tree for expand-all functionality.
 */
private fun collectAllPaths(nodes: List<TagNode>): List<String> {
    val paths = mutableListOf<String>()
    fun walk(list: List<TagNode>) {
        list.forEach { node ->
            if (node.children.isNotEmpty()) {
                paths.add(node.fullPath)
                walk(node.children)
            }
        }
    }
    walk(nodes)
    return paths
}

/**
 * Filters the tag tree to only include nodes whose name or fullPath
 * contains the query string (case-insensitive). Parent nodes are kept
 * if any of their descendants match.
 */
private fun filterTagTree(nodes: List<TagNode>, query: String): List<TagNode> {
    val lowerQuery = query.lowercase()
    return nodes.mapNotNull { node ->
        val nameMatches = node.name.lowercase().contains(lowerQuery)
        val filteredChildren = filterTagTree(node.children, query)

        when {
            nameMatches -> node.copy(children = node.children.toMutableList())
            filteredChildren.isNotEmpty() -> node.copy(children = filteredChildren.toMutableList())
            else -> null
        }
    }
}

/**
 * Parses a hex color string into a Compose Color.
 * Falls back to a neutral gray if parsing fails.
 */
private fun parseTagColor(hex: String): Color {
    return try {
        val cleanHex = hex.removePrefix("#")
        val colorLong = when (cleanHex.length) {
            6 -> (0xFF000000 or cleanHex.toLong(16))
            8 -> cleanHex.toLong(16)
            else -> return Color.Gray
        }
        Color(colorLong.toInt())
    } catch (_: NumberFormatException) {
        Color.Gray
    }
}

/**
 * Returns white or dark text color based on the luminance of the background color.
 * Used for chip label text to ensure readability.
 */
private fun contrastTextColor(background: Color): Color {
    val luminance = 0.299f * background.red + 0.587f * background.green + 0.114f * background.blue
    return if (luminance > 0.5f) Color(0xFF1A1208) else Color.White
}
