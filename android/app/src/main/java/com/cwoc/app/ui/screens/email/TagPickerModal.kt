package com.cwoc.app.ui.screens.email

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
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
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.cwoc.app.domain.tags.TagNode

/**
 * Full-screen modal for bulk tagging emails.
 * Displays the shared tag tree with search, expand/collapse, and checkboxes.
 *
 * Validates: Requirements 29.2, 29.3, 29.4, 29.5
 *
 * @param emailCount Number of selected emails (displayed in header)
 * @param allTags The full tag tree (root-level nodes with children)
 * @param initialSelectedTags Tags already applied (pre-checked)
 * @param onApply Callback with the list of selected tag full paths when Apply is tapped
 * @param onDismiss Callback when the modal is dismissed (Cancel or back)
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TagPickerModal(
    emailCount: Int,
    allTags: List<TagNode>,
    initialSelectedTags: List<String> = emptyList(),
    onApply: (List<String>) -> Unit,
    onDismiss: () -> Unit
) {
    // Local selection state — starts with any pre-existing tags
    val selectedTags = remember { mutableStateListOf<String>().apply { addAll(initialSelectedTags) } }
    var searchQuery by remember { mutableStateOf("") }
    val expandedNodes = remember { mutableStateListOf<String>() }

    // Filter tree based on search query
    val filteredTree = remember(allTags, searchQuery) {
        if (searchQuery.isBlank()) {
            allTags
        } else {
            filterTagTree(allTags, searchQuery.trim())
        }
    }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(
            usePlatformDefaultWidth = false,
            dismissOnBackPress = true,
            dismissOnClickOutside = false
        )
    ) {
        Scaffold(
            topBar = {
                TopAppBar(
                    title = {
                        Text(
                            text = "Tag $emailCount email(s)",
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold
                        )
                    },
                    navigationIcon = {
                        IconButton(onClick = onDismiss) {
                            Icon(
                                imageVector = Icons.Default.Close,
                                contentDescription = "Cancel"
                            )
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = MaterialTheme.colorScheme.surface,
                        titleContentColor = MaterialTheme.colorScheme.onSurface
                    )
                )
            },
            bottomBar = {
                // Apply / Cancel action buttons
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 12.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp, Alignment.End)
                ) {
                    OutlinedButton(onClick = onDismiss) {
                        Text("Cancel")
                    }
                    Button(
                        onClick = { onApply(selectedTags.toList()) },
                        enabled = selectedTags.isNotEmpty()
                    ) {
                        Text("Apply")
                    }
                }
            },
            containerColor = MaterialTheme.colorScheme.background
        ) { paddingValues ->
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
                    .padding(horizontal = 16.dp)
            ) {
                Spacer(modifier = Modifier.height(8.dp))

                // ─── Search Field ───────────────────────────────────────────
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

                // ─── Expand/Collapse All ────────────────────────────────────
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End
                ) {
                    IconButton(
                        onClick = {
                            if (expandedNodes.isNotEmpty()) {
                                expandedNodes.clear()
                            } else {
                                expandedNodes.addAll(collectAllParentPaths(allTags))
                            }
                        }
                    ) {
                        Icon(
                            imageVector = if (expandedNodes.isNotEmpty()) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                            contentDescription = if (expandedNodes.isNotEmpty()) "Collapse All" else "Expand All"
                        )
                    }
                }

                // ─── Tag Tree ───────────────────────────────────────────────
                LazyColumn(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f)
                ) {
                    renderTagPickerTree(
                        nodes = filteredTree,
                        selectedTags = selectedTags,
                        expandedNodes = expandedNodes,
                        onTagToggled = { tagPath ->
                            if (selectedTags.contains(tagPath)) {
                                selectedTags.remove(tagPath)
                            } else {
                                selectedTags.add(tagPath)
                            }
                        },
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
            }
        }
    }
}

// ─── Tag Tree Rendering ─────────────────────────────────────────────────────────

/**
 * Recursively renders the tag tree into a LazyColumn for the tag picker modal.
 * Each node shows an expand/collapse icon (if parent), color indicator, name, and checkbox.
 */
private fun androidx.compose.foundation.lazy.LazyListScope.renderTagPickerTree(
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

        item(key = "tagpicker_${node.fullPath}") {
            TagPickerRow(
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
            renderTagPickerTree(
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
 * A single row in the tag picker tree: expand icon + color dot + name + checkbox.
 */
@Composable
private fun TagPickerRow(
    node: TagNode,
    isSelected: Boolean,
    hasChildren: Boolean,
    isExpanded: Boolean,
    depth: Int,
    onToggleSelect: () -> Unit,
    onToggleExpand: () -> Unit
) {
    val indentPadding = (depth * 24).dp

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onToggleSelect)
            .padding(start = indentPadding, top = 6.dp, bottom = 6.dp, end = 8.dp),
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

        // Color indicator dot
        val dotColor = node.color?.let { parseHexColor(it) }
            ?: MaterialTheme.colorScheme.outline
        Box(
            modifier = Modifier
                .size(12.dp)
                .clip(CircleShape)
                .background(dotColor)
        )

        Spacer(modifier = Modifier.width(10.dp))

        // Tag name
        Text(
            text = node.name,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurface,
            modifier = Modifier.weight(1f)
        )

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
 * Collects all parent node fullPaths from the tree for expand-all functionality.
 */
private fun collectAllParentPaths(nodes: List<TagNode>): List<String> {
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
private fun parseHexColor(hex: String): Color {
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
